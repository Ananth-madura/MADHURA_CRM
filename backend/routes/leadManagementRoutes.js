const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");
const toDateOnly = (val) => (!val ? null : val.toString().slice(0, 10));
const toTimeOnly = (val) => {
  if (!val) return null;
  const s = val.toString().trim();
  if (s.length >= 8) return s.slice(-8);
  return s;
};
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

const sendMissedAlert = (lead, count) => {
  const notificationIO = getNotificationIO();
  if (!notificationIO) {
    console.error("[leadManagementRoutes] NotificationIO not initialized, cannot emit alert");
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
};

// ── REMINDERS ──────────────────────────────────────────────────────────────

// GET all reminders for a lead
router.get("/reminders/:leadType/:leadId", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM lead_reminders WHERE lead_id=? AND lead_type=?";
  const params = [req.params.leadId, req.params.leadType];
  if (role === 'employee') {
    sql += " AND employee_id = ?";
    params.push(user_id);
  }
  sql += " ORDER BY reminder_date ASC, id DESC";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST add a reminder
router.post("/reminders", verifyToken, (req, res) => {
  const { lead_id, lead_type, reminder_date, reminder_time, reminder_notes, employee_id } = req.body;
  const finalEmployeeId = employee_id || req.user.id || null;
  db.query(
    "INSERT INTO lead_reminders (lead_id, lead_type, reminder_date, reminder_time, reminder_notes, status, employee_id) VALUES (?,?,?,?,?,'Pending',?)",
    [lead_id, lead_type || "telecall", toDateOnly(reminder_date), toTimeOnly(reminder_time), reminder_notes || "", finalEmployeeId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      // Log activity
      db.query(
        "INSERT INTO lead_activity (lead_id, lead_type, employee_id, action, details) VALUES (?,?,?,?,?)",
        [lead_id, lead_type || "telecall", finalEmployeeId, "Reminder Created", `Reminder set for ${reminder_date}`]
      );
      res.json({ id: result.insertId, message: "Reminder added" });
    }
  );
});

// PUT update reminder status.
// When a reminder is acknowledged from the center-screen popup (status="Done")
// we also flag popup_sent so the scheduler/poll never re-fires it, and log it.
router.put("/reminders/:id", verifyToken, (req, res) => {
  const { status } = req.body;
  const markDone = status === "Done";
  const sql = markDone
    ? "UPDATE lead_reminders SET status=?, popup_sent=1 WHERE id=?"
    : "UPDATE lead_reminders SET status=? WHERE id=?";
  db.query(sql, [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    if (markDone) {
      db.query("SELECT lead_id, lead_type, employee_id FROM lead_reminders WHERE id=?", [req.params.id], (e, rows) => {
        if (!e && rows && rows.length) {
          const r = rows[0];
          db.query(
            "INSERT INTO lead_activity (lead_id, lead_type, employee_id, action, details) VALUES (?,?,?,?,?)",
            [r.lead_id, r.lead_type || "telecall", r.employee_id || req.user.id || null, "Reminder Acknowledged", "Reminder marked Done from popup"]
          );
        }
      });
    }
    res.json({ message: "Updated" });
  });
});

// DELETE reminder
router.delete("/reminders/:id", verifyToken, (req, res) => {
  db.query("DELETE FROM lead_reminders WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Deleted" });
  });
});

// GET the logged-in user's own pending reminders for today.
// Used by the global reminder popup to (a) schedule exact-time popups on the
// client and (b) recover any popup whose socket event was missed (e.g. the user
// logged in after the reminder fired but is still inside the 5-minute grace).
router.get("/my-reminders/today", verifyToken, (req, res) => {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  const sql = `
    SELECT lr.id, lr.lead_id, lr.lead_type, lr.reminder_date, lr.reminder_time,
           lr.reminder_notes, lr.status,
           COALESCE(t.customer_name, w.customer_name, f.customer_name) AS customer_name,
           COALESCE(t.mobile_number, w.mobile_number, f.mobile_number) AS mobile_number
    FROM lead_reminders lr
    LEFT JOIN telecalls t ON t.id = lr.lead_id AND lr.lead_type = 'telecall'
    LEFT JOIN walkins w ON w.id = lr.lead_id AND lr.lead_type = 'walkin'
    LEFT JOIN fields f ON f.id = lr.lead_id AND lr.lead_type = 'field'
    WHERE lr.status = 'Pending'
      AND lr.employee_id = ?
      AND lr.reminder_date = ?
      AND lr.reminder_time IS NOT NULL
    ORDER BY lr.reminder_time ASC
  `;
  db.query(sql, [req.user.id, today], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// ── FOLLOW-UPS ───────────────────────────────────────────────────────────────
// Parallel to reminders: each row is one follow-up (date + optional time + note)
// stored as history per lead.

// GET follow-up summary for all leads of a type (for bulk filter on list pages)
// Returns: [{ lead_id, total_count, pending_count, today_count, earliest_pending }]
router.get("/followups-summary/:leadType", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local
  let sql = `
    SELECT
      lead_id,
      COUNT(*) AS total_count,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status='Pending' AND followup_date = ? THEN 1 ELSE 0 END) AS today_count,
      MIN(CASE WHEN status='Pending' THEN followup_date END) AS earliest_pending
    FROM lead_followups
    WHERE lead_type = ?`;
  const params = [today, req.params.leadType];
  if (role === 'employee') {
    sql += " AND employee_id = ?";
    params.push(user_id);
  }
  sql += " GROUP BY lead_id";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET all follow-ups for a lead
router.get("/followups/:leadType/:leadId", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM lead_followups WHERE lead_id=? AND lead_type=?";
  const params = [req.params.leadId, req.params.leadType];
  if (role === 'employee') {
    sql += " AND employee_id = ?";
    params.push(user_id);
  }
  sql += " ORDER BY followup_date ASC, id DESC";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST add a follow-up
router.post("/followups", verifyToken, (req, res) => {
  const { lead_id, lead_type, followup_date, followup_time, followup_notes, employee_id } = req.body;
  const finalEmployeeId = employee_id || req.user.id || null;
  db.query(
    "INSERT INTO lead_followups (lead_id, lead_type, followup_date, followup_time, followup_notes, status, employee_id) VALUES (?,?,?,?,?,'Pending',?)",
    [lead_id, lead_type || "telecall", toDateOnly(followup_date), toTimeOnly(followup_time), followup_notes || "", finalEmployeeId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      // Log activity
      db.query(
        "INSERT INTO lead_activity (lead_id, lead_type, employee_id, action, details) VALUES (?,?,?,?,?)",
        [lead_id, lead_type || "telecall", finalEmployeeId, "Follow-up Scheduled", `Follow-up set for ${followup_date}`]
      );
      res.json({ id: result.insertId, message: "Follow-up added" });
    }
  );
});

// PUT update follow-up status
router.put("/followups/:id", verifyToken, (req, res) => {
  const { status } = req.body;
  db.query("UPDATE lead_followups SET status=? WHERE id=?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Updated" });
  });
});

// DELETE follow-up
router.delete("/followups/:id", verifyToken, (req, res) => {
  db.query("DELETE FROM lead_followups WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Deleted" });
  });
});

// ── MARK MISSED & ESCALATION CHECK ────────────────────────────────────────

// POST check and mark overdue reminders as Missed, trigger escalation if needed
router.post("/check-missed", verifyToken, (req, res) => {
  const now = new Date();
  // Use local date (not UTC) so IST/+5:30 users get correct "today"
  const today = now.toLocaleDateString("en-CA"); // en-CA gives YYYY-MM-DD in local time
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const currentTime = `${hh}:${mm}:${ss}`; // HH:MM:SS in local time

  // Mark as Missed if:
  // 1. reminder_date is before today (any time), OR
  // 2. reminder_date is today AND reminder_time is set AND reminder_time < current time
  db.query(
    `UPDATE lead_reminders SET status='Missed'
     WHERE status='Pending' AND (
       reminder_date < ?
       OR (reminder_date = ? AND reminder_time IS NOT NULL AND TIME(reminder_time) < ?)
     )`,
    [today, today, currentTime],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const markedMissed = result.affectedRows;

      // Check for leads with 3+ missed reminders → escalate (all lead types)
      const escalateSql = `
        SELECT lr.lead_id, lr.lead_type, COUNT(*) as total_missed,
               lr.employee_id,
               COALESCE(t.customer_name, w.customer_name, f.customer_name) as customer_name,
               COALESCE(t.mobile_number, w.mobile_number, f.mobile_number) as mobile_number,
               COALESCE(t.staff_name, w.staff_name, f.staff_name) as staff_name,
               COALESCE(t.followup_date, w.followup_date, f.followup_date) as followup_date
        FROM lead_reminders lr
        LEFT JOIN telecalls t ON t.id = lr.lead_id AND lr.lead_type = 'telecall'
        LEFT JOIN walkins w ON w.id = lr.lead_id AND lr.lead_type = 'walkin'
        LEFT JOIN fields f ON f.id = lr.lead_id AND lr.lead_type = 'field'
        WHERE lr.status = 'Missed' AND (lr.notification_sent IS NULL OR lr.notification_sent < 2)
        GROUP BY lr.lead_id, lr.lead_type, lr.employee_id, t.customer_name, w.customer_name, f.customer_name, t.mobile_number, w.mobile_number, f.mobile_number, t.staff_name, w.staff_name, f.staff_name, t.followup_date, w.followup_date, f.followup_date
        HAVING total_missed >= 3
      `;
      db.query(escalateSql, (err2, leads) => {
        if (err2) return res.json({ markedMissed, escalated: 0 });
        if (!leads.length) return res.json({ markedMissed, escalated: 0 });

        let pending = leads.length;
        let escalated = 0;

        leads.forEach(lead => {
          // Check consecutive missed count first!
          const consecSql = `
            SELECT id, status, notification_sent FROM lead_reminders 
            WHERE lead_id = ? AND lead_type = ? 
            ORDER BY reminder_date DESC, COALESCE(reminder_time, '00:00:00') DESC, id DESC
            LIMIT 10
          `;
          db.query(consecSql, [lead.lead_id, lead.lead_type], (err3, rows) => {
            if (err3) {
              if (--pending === 0) res.json({ markedMissed, escalated });
              return;
            }
            if (!rows) {
              if (--pending === 0) res.json({ markedMissed, escalated });
              return;
            }

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

            if (consecutiveMissed >= 3) {
              db.query(
                "UPDATE lead_reminders SET notification_sent = 2 WHERE id IN (?)",
                [missedIds],
                (updateErr) => {
                  if (updateErr) {
                    console.error("[leadManagementRoutes] Failed to update reminder notification_sent:", updateErr.message);
                  }
                }
              );

              db.query(
                "SELECT id FROM lead_escalations WHERE lead_id=? AND lead_type=? AND status='Open'",
                [lead.lead_id, lead.lead_type],
                (e, existing) => {
                  if (e) {
                    if (--pending === 0) res.json({ markedMissed, escalated });
                    return;
                  }

                  if (existing && existing.length > 0) {
                    // Update missed count on existing escalation
                    db.query("UPDATE lead_escalations SET missed_count = missed_count + 3 WHERE id=?", [existing[0].id]);
                    sendMissedAlert(lead, 3);
                    escalated++;
                    if (--pending === 0) res.json({ markedMissed, escalated });
                  } else {
                    // Create new escalation and send exactly 1 alert
                    db.query(
                      "INSERT INTO lead_escalations (lead_id, lead_type, employee_id, customer_name, mobile_number, staff_name, last_followup_date, missed_count, missed_threshold_reached) VALUES (?,?,?,?,?,?,?,?,1)",
                      [lead.lead_id, lead.lead_type, lead.employee_id || null, lead.customer_name, lead.mobile_number, lead.staff_name, toDateOnly(lead.followup_date), 3],
                      (e2) => {
                        if (!e2) {
                          escalated++;
                          sendMissedAlert(lead, 3);
                        }
                        if (--pending === 0) res.json({ markedMissed, escalated });
                      }
                    );
                  }
                }
              );
            } else {
              if (--pending === 0) res.json({ markedMissed, escalated });
            }
          });
        });
      });
    }
  );
});

// ── ESCALATIONS ────────────────────────────────────────────────────────────

// GET all open escalations (admin only)
router.get("/escalations", verifyToken, (req, res) => {
  const { status } = req.query;
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT e.*, tm.first_name as employee_name, tm.emp_role
    FROM lead_escalations e
    LEFT JOIN teammember tm ON e.employee_id = tm.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += " AND e.status = ?";
    params.push(status);
  } else {
    sql += " AND e.status = 'Open'";
  }

  if (role === 'employee') {
    const resolveTmId = (cb) => {
      if (req.user.teammember_id) return cb(null, req.user.teammember_id);
      db.query("SELECT id FROM teammember WHERE user_id = ? OR emp_email = ? LIMIT 1", [user_id, req.user.email || ""], (err, rows) => {
        cb(err, rows && rows.length ? rows[0].id : null);
      });
    };
    resolveTmId((err, tmId) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!tmId) return res.json([]);
      sql += " AND e.employee_id = ?";
      params.push(tmId);
      sql += " ORDER BY e.created_at DESC";
      db.query(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      });
    });
    return;
  }

  sql += " ORDER BY e.created_at DESC";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// PUT resolve escalation
router.put("/escalations/:id/resolve", verifyToken, (req, res) => {
  db.query("SELECT * FROM lead_escalations WHERE id=?", [req.params.id], (err, rows) => {
    if (err || rows.length === 0) return res.status(404).json({ message: "Not found" });
    const escalation = rows[0];

    db.query("UPDATE lead_escalations SET status='Resolved', resolved_at=NOW() WHERE id=?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // Notify the employee if we have their employee_id
      if (escalation.employee_id) {
        // Get user_id from teammember
        db.query("SELECT user_id FROM teammember WHERE id=?", [escalation.employee_id], (e, tmRows) => {
          if (!e && tmRows.length > 0 && tmRows[0].user_id) {
            const notificationIO = getNotificationIO();
            if (notificationIO && notificationIO.emitNotification) {
              // DISABLED: Old notification system
              /*
              notificationIO.emitNotification("escalation_resolved", {
                leadId: escalation.lead_id,
                leadType: escalation.lead_type,
                customerName: escalation.customer_name,
                message: `Your missed reminder escalation for lead ${escalation.customer_name} has been resolved.`,
                type: "lead"
              }, tmRows[0].user_id, false);
              */
            }
          }
        });
      }

      res.json({ message: "Resolved" });
    });
  });
});

// ── ACTIVITY LOG ───────────────────────────────────────────────────────────

// GET activity log for a lead
router.get("/activity/:leadType/:leadId", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  if (role === 'employee') {
    const tableMap = { telecall: "telecalls", walkin: "walkins", field: "fields" };
    const leadTable = tableMap[req.params.leadType];
    if (leadTable) {
      db.query(`SELECT created_by FROM ${leadTable} WHERE id = ?`, [req.params.leadId], (err, rows) => {
        if (err || rows.length === 0 || rows[0].created_by !== user_id) {
          return res.status(403).json({ message: "Access denied" });
        }
        db.query(
          "SELECT * FROM lead_activity WHERE lead_id=? AND lead_type=? ORDER BY created_at DESC",
          [req.params.leadId, req.params.leadType],
          (err, activityRows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(activityRows);
          }
        );
      });
      return;
    }
  }

  db.query(
    "SELECT * FROM lead_activity WHERE lead_id=? AND lead_type=? ORDER BY created_at DESC",
    [req.params.leadId, req.params.leadType],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST log activity
router.post("/activity", verifyToken, (req, res) => {
  const { lead_id, lead_type, action, details, employee_id } = req.body;
  db.query(
    "INSERT INTO lead_activity (lead_id, lead_type, employee_id, action, details) VALUES (?,?,?,?,?)",
    [lead_id, lead_type || "telecall", employee_id || null, action, details || ""],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

// ── DASHBOARD NOTIFICATIONS ────────────────────────────────────────────────

// GET notification summary for dashboard
router.get("/notifications", verifyToken, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const { id: user_id, role } = req.user;
  
  if (role === 'employee') {
    const resolveTmId = (cb) => {
      if (req.user.teammember_id) return cb(null, req.user.teammember_id);
      db.query("SELECT id FROM teammember WHERE user_id = ? OR emp_email = ? LIMIT 1", [user_id, req.user.email || ""], (err, rows) => {
        cb(err, rows && rows.length ? rows[0].id : null);
      });
    };
    resolveTmId((err, tmId) => {
      if (err) return res.status(500).json({ error: err.message });
      const sql = `
        SELECT
          (SELECT COUNT(*) FROM lead_reminders WHERE status='Pending' AND reminder_date = ? AND employee_id = ?) AS todays_reminders,
          (SELECT COUNT(*) FROM lead_reminders WHERE status='Pending' AND reminder_date > ? AND employee_id = ?) AS due_reminders,
          (SELECT COUNT(*) FROM lead_reminders WHERE status='Missed' AND employee_id = ?) AS missed_reminders,
          (SELECT COUNT(*) FROM lead_escalations WHERE status='Open' AND employee_id = ?) AS open_escalations
      `;
      db.query(sql, [today, user_id, today, user_id, user_id, tmId || 0], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows[0]);
      });
    });
    return;
  }

  const sql = `
    SELECT
      (SELECT COUNT(*) FROM lead_reminders WHERE status='Pending' AND reminder_date = ?) AS todays_reminders,
      (SELECT COUNT(*) FROM lead_reminders WHERE status='Pending' AND reminder_date > ?) AS due_reminders,
      (SELECT COUNT(*) FROM lead_reminders WHERE status='Missed') AS missed_reminders,
      (SELECT COUNT(*) FROM lead_escalations WHERE status='Open') AS open_escalations
  `;
  db.query(sql, [today, today], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows[0]);
  });
});

// GET missed reminder count per lead (for table badge)
router.get("/missed-counts/:leadType", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT lead_id, COUNT(*) as missed_count FROM lead_reminders WHERE lead_type=? AND status='Missed'";
  const params = [req.params.leadType];
  if (role === 'employee') {
    sql += " AND employee_id = ?";
    params.push(user_id);
  }
  sql += " GROUP BY lead_id";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ── LEAD CONVERSION ────────────────────────────────────────────────────────
// These routes match the frontend's expected /api/leads/ subpaths

// Helper function to create/update client from lead
const createClientFromLead = (lead, leadType, callback) => {
  const leadIdDisplay = `${leadType.charAt(0).toUpperCase()}-${lead.id}`;
  const leadData = {
    name: lead.customer_name || "",
    company_name: lead.company_name || null,
    phone: lead.mobile_number || "",
    email: lead.email || "",
    address: lead.location_city || "",
    service: lead.service_name || lead.purpose || "",
    gst_number: lead.gst_number || "",
    original_lead_id: lead.id,
    original_lead_type: leadType,
    lead_email: lead.email || "",
    lead_city: lead.location_city || "",
    lead_reference: lead.reference || "",
    lead_purpose: lead.purpose || lead.service_name || "",
    client_status: "converted",
    converted_at: new Date(),
    lead_staff_name: lead.staff_name || "",
    lead_id_display: leadIdDisplay,
    landline_number: lead.landline_number || null,
    alternate_mobile_number: lead.alternate_mobile_number || null,
    reference_by: lead.reference_by || null,
    nearest_landmark: lead.nearest_landmark || null
  };

  const doInsert = () => {
    db.query(
      `INSERT INTO clients (name, company_name, phone, email, address, city, service, gst_number, created_by, original_lead_id, original_lead_type, lead_email, lead_city, lead_reference, lead_purpose, client_status, converted_at, lead_staff_name, lead_id_display, landline_number, alternate_mobile_number, reference_by, nearest_landmark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'converted', NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [leadData.name, leadData.company_name, leadData.phone, leadData.email, leadData.address, leadData.lead_city, leadData.service,
      leadData.gst_number, lead.created_by || null, leadData.original_lead_id, leadData.original_lead_type,
      leadData.lead_email, leadData.lead_city, leadData.lead_reference, leadData.lead_purpose,
      leadData.lead_staff_name, leadData.lead_id_display, leadData.landline_number, leadData.alternate_mobile_number, leadData.reference_by, leadData.nearest_landmark],
      (err5, result) => {
        if (err5) { console.error("Error creating client:", err5); callback(null); }
        else { console.log(`Client created from ${leadType} lead ${lead.id}, client ID: ${result.insertId}`); callback(result.insertId); }
      }
    );
  };

  const doUpdate = (clientId) => {
    db.query(
      `UPDATE clients SET name=?, company_name=?, phone=?, email=?, address=?, city=?, service=?, gst_number=?, 
       original_lead_id=?, original_lead_type=?, lead_email=?, lead_city=?, 
       lead_reference=?, lead_purpose=?, client_status='converted', converted_at=NOW(),
       lead_staff_name=?, lead_id_display=?, landline_number=?, alternate_mobile_number=?, reference_by=?, nearest_landmark=? WHERE id=?`,
      [leadData.name, leadData.company_name, leadData.phone, leadData.email, leadData.address, leadData.lead_city, leadData.service, leadData.gst_number,
      leadData.original_lead_id, leadData.original_lead_type, leadData.lead_email, leadData.lead_city,
      leadData.lead_reference, leadData.lead_purpose, leadData.lead_staff_name, leadData.lead_id_display,
      leadData.landline_number, leadData.alternate_mobile_number, leadData.reference_by, leadData.nearest_landmark, clientId],
      (err5) => {
        if (err5) { console.error("Error updating client:", err5); callback(null); }
        else { console.log(`Client ${clientId} updated from ${leadType} lead ${lead.id}`); callback(clientId); }
      }
    );
  };


  db.query("SELECT id FROM clients WHERE original_lead_id = ? AND original_lead_type = ?", [lead.id, leadType], (err3, existing) => {
    if (err3) { console.error("Error checking existing client:", err3); callback(null); return; }

    if (existing.length > 0) {
      doUpdate(existing[0].id);
      return;
    }

    // Check for duplicate phone/email in other clients
    const dupChecks = [];
    if (lead.mobile_number) dupChecks.push({ sql: "SELECT id, name, phone FROM clients WHERE phone = ? AND (original_lead_id IS NULL OR original_lead_type IS NULL) AND client_status != 'converted'", params: [lead.mobile_number] });
    if (lead.email) dupChecks.push({ sql: "SELECT id, name, email as phone FROM clients WHERE email = ? AND (original_lead_id IS NULL OR original_lead_type IS NULL) AND client_status != 'converted'", params: [lead.email] });

    if (dupChecks.length === 0) { doInsert(); return; }

    let completed = 0;
    const dupResults = [];
    dupChecks.forEach((check) => {
      db.query(check.sql, check.params, (err, rows) => {
        if (err) { completed++; if (completed === dupChecks.length) doInsert(); return; }
        if (rows.length > 0) dupResults.push({ id: rows[0].id, name: rows[0].name, phone: rows[0].phone });
        completed++;
        if (completed === dupChecks.length) {
          if (dupResults.length > 0) {
            // Update existing client instead of creating duplicate
            console.log(`Found existing client ${dupResults[0].id} matching ${leadType} lead ${lead.id} by phone/email, updating instead`);
            doUpdate(dupResults[0].id);
          } else {
            doInsert();
          }
        }
      });
    });
  });
};

// PUT convert telecall
router.put("/telecall/:id", verifyToken, (req, res) => {
  const { call_outcome } = req.body;
  db.query(
    "UPDATE telecalls SET call_outcome=? WHERE id=?",
    [call_outcome || "Converted", req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query("SELECT * FROM telecalls WHERE id=?", [req.params.id], (err2, rows) => {
        if (!err2 && rows.length > 0) {
          const lead = rows[0];
          createClientFromLead(lead, "telecall", (clientId) => {
            // DISABLED: Old notification system
            /*
            const notificationIO = getNotificationIO();
            if (notificationIO && notificationIO.emitNotification) {
              notificationIO.emitNotification("lead_converted", {
                staffName: lead.staff_name || "Employee",
                customerName: lead.customer_name || "A Lead",
                convertedAt: new Date().toLocaleString(),
                leadType: "telecall",
                clientId: clientId
              }, null, true);
            }
            */
          });
        }
      });

      res.json({ message: "Lead converted successfully" });
    }
  );
});

// PUT convert walkin
router.put("/walkin/:id", verifyToken, (req, res) => {
  const { walkin_status } = req.body;
  db.query(
    "UPDATE walkins SET walkin_status=? WHERE id=?",
    [walkin_status || "Converted", req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query("SELECT * FROM walkins WHERE id=?", [req.params.id], (err2, rows) => {
        if (!err2 && rows.length > 0) {
          const lead = rows[0];
          createClientFromLead(lead, "walkin", (clientId) => {
            // DISABLED: Old notification system
            /*
            const notificationIO = getNotificationIO();
            if (notificationIO && notificationIO.emitNotification) {
              notificationIO.emitNotification("lead_converted", {
                staffName: lead.staff_name || "Employee",
                customerName: lead.customer_name || "A Lead",
                convertedAt: new Date().toLocaleString(),
                leadType: "walkin",
                clientId: clientId
              }, null, true);
            }
            */
          });
        }
      });

      res.json({ message: "Lead converted successfully" });
    }
  );
});

// PUT convert field
router.put("/field/:id", verifyToken, (req, res) => {
  const { field_outcome } = req.body;
  db.query(
    "UPDATE fields SET field_outcome=? WHERE id=?",
    [field_outcome || "Converted", req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query("SELECT * FROM fields WHERE id=?", [req.params.id], (err2, rows) => {
        if (!err2 && rows.length > 0) {
          const lead = rows[0];
          createClientFromLead(lead, "field", (clientId) => {
            // DISABLED: Old notification system
            /*
            const notificationIO = getNotificationIO();
            if (notificationIO && notificationIO.emitNotification) {
              notificationIO.emitNotification("lead_converted", {
                staffName: lead.staff_name || "Employee",
                customerName: lead.customer_name || "A Lead",
                convertedAt: new Date().toLocaleString(),
                leadType: "field",
                clientId: clientId
              }, null, true);
            }
            */
          });
        }
      });

      res.json({ message: "Lead converted successfully" });
    }
  );
});

// GET converted leads list
router.get("/converted", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT c.*, 
           u.first_name as creator_name,
           CASE c.original_lead_type 
             WHEN 'telecall' THEN 'Tele Call'
             WHEN 'walkin' THEN 'Walk-in'
             WHEN 'field' THEN 'Field Visit'
             ELSE 'Unknown'
           END as lead_source,
           DATE_FORMAT(c.converted_at, '%Y-%m-%dT%H:%i') as converted_date,
           c.lead_staff_name as converted_by_name,
           c.lead_id_display as lead_reference_id
    FROM clients c
    LEFT JOIN users u ON c.created_by = u.id
    WHERE c.client_status = 'converted' AND c.original_lead_id IS NOT NULL
  `;
  const params = [];
  if (role === 'employee') {
    sql += " AND c.created_by = ?";
    params.push(user_id);
  }
  sql += " ORDER BY c.converted_at DESC";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
