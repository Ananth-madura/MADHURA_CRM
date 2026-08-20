"use strict";
/**
 * Reminder Scheduler — runs every 15 minutes automatically
 * Marks overdue reminders as Missed, triggers escalation at 3+ missed
 */
const schedule = require("node-schedule");
const db = require("../config/database");
const { getNotificationIO } = require("../sockets/notifications");
const { sendPushToUser } = require("./pushSender");

const toDateOnly = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Joined SELECT used to enrich a reminder row with its lead's customer details.
const REMINDER_JOIN_SQL = `
  SELECT lr.*,
         COALESCE(t.customer_name, w.customer_name, f.customer_name) AS customer_name,
         COALESCE(t.mobile_number, w.mobile_number, f.mobile_number) AS mobile_number,
         COALESCE(t.staff_name, w.staff_name, f.staff_name) AS staff_name
  FROM lead_reminders lr
  LEFT JOIN telecalls t ON t.id = lr.lead_id AND lr.lead_type = 'telecall'
  LEFT JOIN walkins w ON w.id = lr.lead_id AND lr.lead_type = 'walkin'
  LEFT JOIN fields f ON f.id = lr.lead_id AND lr.lead_type = 'field'
`;

const pad2 = (n) => String(n).padStart(2, "0");
const localTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

// Idempotently make sure the popup tracking column exists.
function ensureReminderSchema() {
  db.query("ALTER TABLE lead_reminders ADD COLUMN popup_sent TINYINT DEFAULT 0", (err) => {
    if (err && !/duplicate column|exists/i.test(err.message)) {
      console.error("[Scheduler] ensureReminderSchema error:", err.message);
    }
  });
}

// Emit the exact-time reminder:
//   • a blocking center-screen popup to the OWNER only (via `reminder_popup`)
//   • a notification-page entry for admins (NO popup)
//   • an OS-level web push to the owner (so it shows even if the tab is closed)
function emitReminderPopup(reminder) {
  const helpers = getNotificationIO();
  if (!helpers) return;

  const customer = reminder.customer_name || "customer";
  const mobile = reminder.mobile_number || "";
  const title = "🔔 Reminder Now";
  const note = reminder.reminder_notes ? ` — ${reminder.reminder_notes}` : "";
  const message = `Time to follow up with ${customer}${mobile ? ` (${mobile})` : ""}${note}`;

  const payload = {
    id: reminder.id,
    reminderId: reminder.id,
    leadId: reminder.lead_id,
    leadType: reminder.lead_type,
    userId: reminder.employee_id,
    customerName: customer,
    mobileNumber: mobile,
    reminderDate: toDateOnly(reminder.reminder_date),
    reminderTime: reminder.reminder_time,
    reminderNotes: reminder.reminder_notes || "",
    type: "reminder_due_now",
    title,
    message,
    timestamp: new Date().toISOString(),
  };

  // (1) Owner → blocking popup + their own notifications row + OS push
  if (reminder.employee_id) {
    helpers.sendToUser(reminder.employee_id, "reminder_popup", payload);
    db.query(
      "INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
      [reminder.lead_id || 0, reminder.employee_id, "reminder_due_now", title, message]
    );
    try { sendPushToUser(reminder.employee_id, title, message, "/dashboard/notifications"); } catch (_) {}
  }

  // (2) Admins → notification page only (NO blocking popup)
  const adminMessage = `🔔 Reminder due for ${reminder.staff_name || "employee"}: follow up with ${customer}${mobile ? ` (${mobile})` : ""}`;
  db.query(
    "INSERT INTO admin_notifications (type, message, user_id, related_id, related_type, created_by, priority) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["reminder_due_now", adminMessage, reminder.employee_id || null, reminder.lead_id || 0, reminder.lead_type || null, reminder.employee_id || null, "normal"],
    (err, result) => {
      if (err || !result) return;
      helpers.sendToAdmin("new_notification", {
        id: Date.now(),
        dbId: result.insertId,
        type: "reminder_due_now",
        title: "🔔 Reminder Due",
        message: adminMessage,
        data: { ...payload, message: adminMessage },
        timestamp: new Date().toISOString(),
        is_read: 0,
      });
    }
  );
}

// Fire the popup the moment a reminder's exact time arrives. A 10-minute
// catch-up window covers brief downtime; anything older is left to the missed
// check (5-minute grace) instead of popping a stale reminder.
function runCheckDueReminders() {
  if (!getNotificationIO()) return;

  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const currentTime = localTime(now);

  const winStart = new Date(now.getTime() - 10 * 60000);
  let earliest = localTime(winStart);
  if (winStart.toLocaleDateString("en-CA") !== today) earliest = "00:00:00";

  const sql = REMINDER_JOIN_SQL + `
    WHERE lr.status = 'Pending'
      AND lr.reminder_date = ?
      AND lr.reminder_time IS NOT NULL
      AND TIME(lr.reminder_time) <= ?
      AND TIME(lr.reminder_time) >= ?
      AND (lr.popup_sent IS NULL OR lr.popup_sent = 0)
  `;
  db.query(sql, [today, currentTime, earliest], (err, due) => {
    if (err) { console.error("[Scheduler] check-due error:", err.message); return; }
    (due || []).forEach((reminder) => {
      emitReminderPopup(reminder);
      db.query("UPDATE lead_reminders SET popup_sent = 1 WHERE id = ?", [reminder.id]);
      console.log(`[Scheduler] Exact-time reminder popup fired (ID ${reminder.id}, ${reminder.customer_name})`);
    });
  });
}


const checkAlertAlreadySent = (leadId, leadType, count, callback) => {
  db.query(
    `SELECT id FROM admin_notifications 
     WHERE type = 'missed_reminder_alert' 
       AND related_id = ? 
       AND related_type = ? 
       AND message LIKE ?`,
    [leadId, leadType, `%missed ${count} reminders%`],
    (err, rows) => {
      if (err) return callback(err, false);
      callback(null, rows && rows.length > 0);
    }
  );
};

function sendMissedAlert(lead, count) {
  const notificationIO = getNotificationIO();
  if (!notificationIO) {
    console.error("[Scheduler] NotificationIO not initialized, cannot emit alert");
    return;
  }

  const time = new Date().toLocaleString();
  const employeeMessage = `⚠️ You missed ${count} reminders / calls continuously for client "${lead.customer_name}"`;
  const adminMessage = `⚠️ ${lead.staff_name || "Employee"} missed ${count} reminders / calls continuously for client "${lead.customer_name}"`;

  // Send to employee
  notificationIO.emitNotification("missed_reminder_alert", {
    leadId: lead.lead_id,
    leadType: lead.lead_type,
    userId: lead.employee_id,
    userName: lead.staff_name,
    customerName: lead.customer_name,
    mobileNumber: lead.mobile_number,
    count: count,
    missedAt: time,
    title: "Missed Call / Reminder Alert",
    message: employeeMessage,
    type: "missed_reminder",
    priority: "high"
  }, lead.employee_id, false);

  // Send to admin
  notificationIO.emitNotification("missed_reminder_alert", {
    leadId: lead.lead_id,
    leadType: lead.lead_type,
    userId: lead.employee_id,
    userName: lead.staff_name,
    customerName: lead.customer_name,
    mobileNumber: lead.mobile_number,
    count: count,
    missedAt: time,
    title: "Employee Missed Reminders",
    message: adminMessage,
    type: "missed_reminder",
    priority: "high"
  }, null, true);
}

function runCheckMissed() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toTimeString().slice(0, 8);
  // 5-minute grace: the exact-time popup gives the user a full 5 minutes to click
  // OK before the reminder is counted as Missed. (Clamped so it never wraps midnight.)
  const graceDate = new Date(now.getTime() - 5 * 60000);
  const graceTime = graceDate.toDateString() === now.toDateString()
    ? graceDate.toTimeString().slice(0, 8)
    : "00:00:00";

  // 1. Mark overdue Pending reminders as Missed + increment missed_count
  db.query(
    `UPDATE lead_reminders SET status='Missed', missed_count = missed_count + 1
     WHERE status='Pending' AND (
       reminder_date < ?
       OR (reminder_date = ? AND reminder_time IS NOT NULL AND TIME(reminder_time) < ?)
     )`,
    [today, today, graceTime],
    (err, result) => {
      if (err) { console.error("[Scheduler] check-missed error:", err.message); return; }
      if (result.affectedRows > 0) {
        console.log(`[Scheduler] Marked ${result.affectedRows} reminders as Missed`);
      }

      // 2. Find leads with 3+ missed reminders → escalate
      const escalateSql = `
        SELECT lr.lead_id, lr.lead_type, COUNT(*) as total_missed,
               COALESCE(t.customer_name, w.customer_name, f.customer_name) as customer_name,
               COALESCE(t.mobile_number, w.mobile_number, f.mobile_number) as mobile_number,
               COALESCE(t.staff_name, w.staff_name, f.staff_name) as staff_name,
               lr.employee_id as employee_id,
               COALESCE(t.followup_date, w.followup_date, f.followup_date) as followup_date,
               MAX(lr.reminder_date) as last_reminder_date
        FROM lead_reminders lr
        LEFT JOIN telecalls t ON t.id = lr.lead_id AND lr.lead_type = 'telecall'
        LEFT JOIN walkins w ON w.id = lr.lead_id AND lr.lead_type = 'walkin'
        LEFT JOIN fields f ON f.id = lr.lead_id AND lr.lead_type = 'field'
        WHERE lr.status = 'Missed' AND (lr.notification_sent IS NULL OR lr.notification_sent < 2)
        GROUP BY lr.lead_id, lr.lead_type, t.customer_name, w.customer_name, f.customer_name, t.mobile_number, w.mobile_number, f.mobile_number, t.staff_name, w.staff_name, f.staff_name, lr.employee_id, t.followup_date, w.followup_date, f.followup_date
        HAVING total_missed >= 3
      `;

      db.query(escalateSql, (err2, leads) => {
        if (err2) { console.error("[Scheduler] escalateSql error:", err2.message); return; }
        if (!leads.length) return;

        leads.forEach(lead => {
          // Check consecutive missed count
          const consecSql = `
            SELECT id, status, notification_sent FROM lead_reminders 
            WHERE lead_id = ? AND lead_type = ? 
            ORDER BY reminder_date DESC, COALESCE(reminder_time, '00:00:00') DESC, id DESC
            LIMIT 10
          `;
          db.query(consecSql, [lead.lead_id, lead.lead_type], (err3, rows) => {
            if (err3) { console.error("[Scheduler] consecSql error:", err3.message); return; }
            if (!rows) return;
            
            let consecutiveMissed = 0;
            let missedIds = [];
            for (let i = 0; i < rows.length; i++) {
              if (rows[i].status === 'Missed') {
                if (rows[i].notification_sent !== null && rows[i].notification_sent >= 2) {
                  break;
                }
                consecutiveMissed++;
                missedIds.push(rows[i].id);
                if (consecutiveMissed === 3) {
                  break;
                }
              } else if (rows[i].status === 'Done') {
                break;
              }
            }

            // We only want to escalate and notify if consecutiveMissed is >= 3!
            if (consecutiveMissed >= 3) {
              db.query(
                "UPDATE lead_reminders SET notification_sent = 2 WHERE id IN (?)",
                [missedIds],
                (updateErr) => {
                  if (updateErr) {
                    console.error("[Scheduler] Failed to update reminder notification_sent:", updateErr.message);
                  }
                }
              );

              db.query(
                "SELECT id, missed_count FROM lead_escalations WHERE lead_id=? AND lead_type=? AND status='Open'",
                [lead.lead_id, lead.lead_type],
                (e, existing) => {
                  if (e) {
                    console.error("[Scheduler] lead_escalations fetch error:", e.message);
                    return;
                  }

                  if (existing && existing.length > 0) {
                    // Update missed count and last followup date
                    db.query(
                      "UPDATE lead_escalations SET missed_count = missed_count + 3, last_followup_date=? WHERE id=?",
                      [toDateOnly(lead.last_reminder_date), existing[0].id]
                    );
                    sendMissedAlert(lead, 3);
                  } else {
                    // Create new escalation and send exactly 1 alert
                    db.query(
                      `INSERT INTO lead_escalations 
                       (lead_id, lead_type, employee_id, customer_name, mobile_number, staff_name, last_followup_date, missed_count, status, missed_threshold_reached)
                       VALUES (?,?,?,?,?,?,?,?,'Open',1)`,
                      [lead.lead_id, lead.lead_type, lead.employee_id || null, lead.customer_name, lead.mobile_number,
                       lead.staff_name, toDateOnly(lead.last_reminder_date), 3],
                      (e2) => {
                        if (e2) {
                          console.error("[Scheduler] lead_escalations insert error:", e2.message);
                        } else {
                          console.log(`[Scheduler] Escalation created for lead ${lead.lead_id} (${lead.lead_type})`);
                          sendMissedAlert(lead, 3);
                        }
                      }
                    );
                  }
                }
              );
            }
          });
        });
      });
    }
  );
}

let scheduledJobs = [];
let startupTimers = [];
let schedulerStarted = false;

// End of day task check - runs daily at 6 PM
function runDailyTaskCheck() {
  const today = new Date().toISOString().slice(0, 10);

  db.query(
    `SELECT t.*, t.staff_name as user_name FROM tasks t
     WHERE t.due_date < ? AND t.project_status != 'Completed'`,
    [today],
    (err, incompleteTasks) => {
      if (err) {
        console.error("[Scheduler] Daily task check error:", err.message);
        return;
      }

      if (incompleteTasks.length === 0) {
        console.log("[Scheduler] No incomplete tasks for end-of-day check");
        return;
      }

      // Group by employee
      const employeeTasks = {};
      incompleteTasks.forEach(task => {
        const empName = task.staff_name || task.assigned_to || task.user_name || "Unknown";
        if (!employeeTasks[empName]) {
          employeeTasks[empName] = [];
        }
        employeeTasks[empName].push(task);
      });

      const notificationIO = getNotificationIO();
      if (!notificationIO) return;

      // Send notification for each employee with incomplete tasks ONLY IF not notified yet!
      Object.keys(employeeTasks).forEach(empName => {
        const tasks = employeeTasks[empName];
        tasks.forEach(task => {
          // Check if task_not_completed notification was already created for this task
          db.query(
            "SELECT id FROM admin_notifications WHERE type = 'task_not_completed' AND related_id = ?",
            [task.id],
            (checkErr, rows) => {
              if (checkErr) {
                console.error("[Scheduler] task_not_completed check error:", checkErr.message);
                return;
              }
              if (!rows || rows.length === 0) {
                notificationIO.emitNotification("task_not_completed", {
                  taskId: task.id,
                  taskName: task.project_name || task.task_title || "Task",
                  employeeName: empName,
                  dueDate: task.due_date,
                  status: task.project_status,
                  type: "task"
                }, null, true);
              }
            }
          );
        });
      });

      // Send daily summary notification ONLY ONCE per day!
      db.query(
        "SELECT id FROM admin_notifications WHERE type = 'daily_task_summary' AND created_at >= DATE_SUB(NOW(), INTERVAL 22 HOUR)",
        (summaryCheckErr, summaryRows) => {
          if (summaryCheckErr) {
            console.error("[Scheduler] daily_task_summary check error:", summaryCheckErr.message);
            return;
          }
          if (!summaryRows || summaryRows.length === 0) {
            const uniqueEmployees = Object.keys(employeeTasks).length;
            notificationIO.emitNotification("daily_task_summary", {
              incompleteCount: incompleteTasks.length,
              employeeCount: uniqueEmployees,
              date: today,
              type: "summary"
            }, null, true);
            console.log(`[Scheduler] End-of-day summary notification dispatched: ${incompleteTasks.length} incomplete tasks`);
          } else {
            console.log("[Scheduler] Daily summary notification already dispatched for today");
          }
        }
      );

      console.log(`[Scheduler] End-of-day task check complete. Evaluated ${incompleteTasks.length} incomplete tasks.`);
    }
  );
}

function rememberTimer(timer) {
  startupTimers.push(timer);
  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }
  return timer;
}

function startSchedulers() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Make sure the popup tracking column exists before the jobs run.
  ensureReminderSchema();

  // Run every 2 minutes so a reminder is marked Missed promptly once its
  // 5-minute "click OK" grace elapses (idempotent — escalation is guarded).
  scheduledJobs.push(schedule.scheduleJob("*/2 * * * *", runCheckMissed));

  // Run every minute to fire reminder popups at their exact set time.
  scheduledJobs.push(schedule.scheduleJob("* * * * *", runCheckDueReminders));

  // Also run once on startup.
  rememberTimer(setTimeout(runCheckMissed, 3000));
  rememberTimer(setTimeout(runCheckDueReminders, 5000));

  console.log("[Scheduler] Reminder escalation scheduler started (missed check every 2 min, exact-time popups every 1 min)");

  // Run daily at 6 PM.
  scheduledJobs.push(schedule.scheduleJob("0 18 * * *", runDailyTaskCheck));

  // Also run once on startup with a delay.
  rememberTimer(setTimeout(() => {
    console.log("[Scheduler] Running initial task check...");
    runDailyTaskCheck();
  }, 10000));

  console.log("[Scheduler] End-of-day task scheduler started (daily at 6 PM)");
}

function stopSchedulers() {
  scheduledJobs.forEach((job) => {
    if (job && typeof job.cancel === "function") job.cancel();
  });
  scheduledJobs = [];

  startupTimers.forEach((timer) => clearTimeout(timer));
  startupTimers = [];
  schedulerStarted = false;
}

module.exports = {
  runCheckMissed,
  runCheckDueReminders,
  ensureReminderSchema,
  runDailyTaskCheck,
  startSchedulers,
  stopSchedulers
};
