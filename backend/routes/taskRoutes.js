const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

// Timezone-safe local date formatting helpers
const getLocalYearMonth = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getPrevYearMonth = (yearMonthStr) => {
  const [year, month] = yearMonthStr.split("-").map(Number);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
};

const findUserForTask = (nameOrEmailOrTmId, callback) => {
  if (!nameOrEmailOrTmId) return callback(null, null);
  const numId = parseInt(nameOrEmailOrTmId);
  const isNumeric = !isNaN(numId) && String(numId) === String(nameOrEmailOrTmId);

  if (isNumeric) {
    db.query(
      "SELECT u.id, u.first_name, u.email, t.emp_email FROM users u LEFT JOIN teammember t ON t.user_id = u.id WHERE t.id = ? OR u.id = ? LIMIT 1",
      [numId, numId],
      (err, rows) => {
        if (err) return callback(err, null);
        if (rows && rows.length) return callback(null, rows[0]);
        db.query(
          "SELECT u.id, u.first_name, u.email, t.emp_email FROM users u LEFT JOIN teammember t ON t.user_id = u.id WHERE u.id = ? LIMIT 1",
          [numId],
          (err2, rows2) => callback(err2, rows2 && rows2.length ? rows2[0] : null)
        );
      }
    );
  } else {
    db.query(
      "SELECT u.id, u.first_name, u.email, t.emp_email FROM users u LEFT JOIN teammember t ON t.emp_email = u.email WHERE u.id = ? OR u.email = ? OR u.first_name = ? OR CONCAT_WS(' ', t.first_name, t.last_name) = ? OR t.emp_email = ? LIMIT 1",
      [nameOrEmailOrTmId, nameOrEmailOrTmId, nameOrEmailOrTmId, nameOrEmailOrTmId, nameOrEmailOrTmId],
      (err, rows) => callback(err, rows && rows.length ? rows[0] : null)
    );
  }
};

// DISABLED: Old notification system - replaced with 3-type redesign
/*
const notifyTaskAssigned = (task, assignedTo) => {
  findUserForTask(assignedTo, (err, user) => {
    if (err) { console.warn("task assignee lookup skipped:", err.message); return; }
    const message = `New task assigned: "${task.task_title || task.project_name || "Task"}"${task.due_date ? ` (Due: ${task.due_date})` : ""}`;
    const notificationIO = getNotificationIO();
    if (notificationIO && user?.id) {
      notificationIO.emitNotification("task_assigned", {
        taskId: task.id, taskName: task.task_title || task.project_name,
        userId: user.id, userName: user.first_name || assignedTo,
        dueDate: task.due_date, priority: task.project_priority, type: "task"
      }, user.id, false);
      return;
    }
    db.query("INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
      [task.id, user?.id || null, "task_assigned", "New Task Assigned", message],
      (notifErr) => { if (notifErr) console.warn("notifications insert skipped:", notifErr.message); }
    );
  });
};

const notifyTargetAssigned = (target, assignedTo) => {
  findUserForTask(assignedTo, (err, user) => {
    if (err) { console.warn("target assignee lookup skipped:", err.message); return; }
    const message = `New target assigned to you: Rs.${Number(target.yearly_target || 0).toLocaleString()}/year`;
    const notificationIO = getNotificationIO();
    if (notificationIO && user?.id) {
      notificationIO.emitNotification("new_target", {
        id: target.id, userId: user.id, userName: user.first_name || assignedTo,
        targetAmount: target.yearly_target, type: "target"
      }, user.id, false);
      return;
    }
    db.query("INSERT INTO notifications (user_id, type, title, description) VALUES (?, ?, ?, ?)",
      [user?.id || null, "target_assigned", "New Target Assigned", message],
      (notifErr) => { if (notifErr) console.warn("notifications insert skipped:", notifErr.message); }
    );
  });
};

const notifyTaskCompleted = (assignment) => {
  const notificationIO = getNotificationIO();
  if (notificationIO) {
    notificationIO.emitNotification("task_completed", {
      taskId: assignment.task_id, taskName: assignment.task_title || "Task",
      userId: assignment.assigned_to_user_id, userName: assignment.assigned_to_user_name,
      type: "task", priority: "high"
    }, null, true);
    return;
  }
  db.query("INSERT INTO admin_notifications (type, user_id, message) VALUES (?, ?, ?)",
    ["task_completed", assignment.assigned_to_user_id || null, `${assignment.assigned_to_user_name || "Employee"} completed task: "${assignment.task_title || "Task"}"`]
  );
};
*/

const checkOverdueTasks = () => {
  db.query(`SELECT ta.*, t.task_title, t.due_date FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.status NOT IN ('Completed', 'Declined') AND t.due_date < CURDATE()`,
    (err, overdueTasks) => {
      if (err) { console.error("Error checking overdue tasks:", err); return; }
      overdueTasks.forEach(task => {
        // DISABLED: Old notification system
        /*
        const notificationIO = getNotificationIO();
        if (notificationIO) {
          notificationIO.emitNotification("task_overdue", {
            taskId: task.task_id, taskName: task.task_title, assignedTo: task.assigned_to_user_name,
            dueDate: task.due_date, daysOverdue: Math.floor((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24)),
            type: "task", priority: "high"
          }, null, true);
        }
        */
        db.query("INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority) VALUES (?, ?, ?, ?, ?, ?)",
          ["overdue_task", 0, `Task "${task.task_title}" assigned to ${task.assigned_to_user_name} is overdue by ${Math.floor((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24))} days`, task.task_id, "task", "high"],
          (err, result) => {
            if (!err) {
              const notificationIO = getNotificationIO();
              if (notificationIO) {
                notificationIO.sendToAdmin("new_notification", {
                  id: result.insertId,
                  type: "overdue_task",
                  message: `Task "${task.task_title}" assigned to ${task.assigned_to_user_name} is overdue`,
                  employee_name: task.assigned_to_user_name,
                  priority: "high",
                  is_read: 0,
                  created_at: new Date().toISOString()
                });
              }
            }
          }
        );
      });
    }
  );
};

// DISABLED: Old upcoming deadlines checker
/*
const checkUpcomingDeadlines = () => {
  db.query(`SELECT ta.*, t.task_title, t.due_date FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.status NOT IN ('Completed', 'Declined') AND t.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 2 DAY)`,
    (err, upcomingTasks) => {
      if (err) { console.error("Error checking upcoming deadlines:", err); return; }
      upcomingTasks.forEach(task => {
        const notificationIO = getNotificationIO();
        if (notificationIO) {
          notificationIO.emitNotification("task_overdue_warning", {
            taskId: task.task_id, taskName: task.task_title, assignedTo: task.assigned_to_user_name,
            dueDate: task.due_date, daysUntilDue: Math.floor((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24)),
            type: "task", priority: "medium"
          }, null, true);
        }
        db.query("INSERT INTO admin_notifications (type, user_id, message) VALUES (?, ?, ?)",
          ["task_overdue_warning", 0, `Task "${task.task_title}" assigned to ${task.assigned_to_user_name} is due in ${Math.floor((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24))} days`]
        );
      });
    }
  );
};
*/

if (process.env.NODE_ENV !== "test") {
  setInterval(checkOverdueTasks, 60 * 60 * 1000);
}
// setInterval(checkUpcomingDeadlines, 60 * 60 * 1000); // DISABLED

router.get("/", verifyToken, (req, res) => {
  const { id: user_id, role, first_name: user_name } = req.user;
  let sql = `SELECT t.*, u.first_name as creator_name FROM tasks t LEFT JOIN users u ON t.created_by = u.id`;
  const params = [];
  if (role === "employee") {
    // Resolve teammember_id from teammember table if not in JWT
    const resolveTmId = (cb) => {
      if (req.user.teammember_id) return cb(null, req.user.teammember_id);
      db.query("SELECT id FROM teammember WHERE user_id = ? OR emp_email = ? LIMIT 1", [user_id, req.user.email || ""], (err, rows) => {
        cb(err, rows && rows.length ? rows[0].id : null);
      });
    };
    resolveTmId((err, tmId) => {
      if (err) return res.status(500).json({ error: err.message });
      let whereClause = "WHERE (t.created_by = ? OR t.staff_name LIKE ? OR t.assigned_to LIKE ?";
      params.push(user_id, `%${user_name}%`, `%${user_name}%`);
      if (tmId) {
        whereClause += " OR t.assigned_teammember_id = ?";
        params.push(tmId);
      }
      // Also match by full name from teammember table
      db.query("SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name FROM teammember WHERE user_id = ? OR id = ? LIMIT 1", [user_id, tmId], (err2, nameRows) => {
        if (!err2 && nameRows.length && nameRows[0].full_name) {
          whereClause += " OR t.staff_name LIKE ? OR t.assigned_to LIKE ?";
          params.push(`%${nameRows[0].full_name}%`, `%${nameRows[0].full_name}%`);
        }
        whereClause += ")";
        const finalSql = sql + " " + whereClause + " ORDER BY t.id DESC";
        db.query(finalSql, params, (qErr, rows) => { if (qErr) return res.status(500).json(qErr); res.json(rows); });
      });
    });
    return;
  }
  sql += " ORDER BY t.id DESC";
  db.query(sql, params, (err, rows) => { if (err) return res.status(500).json(err); res.json(rows); });
});

router.post("/", verifyToken, isAdmin, (req, res) => {
  const { project_name, staff_name, task_title, task_description, project_status, project_priority, client_name, created_date, due_date, assigned_to, assigned_teammember_id } = req.body;
  const finalStaffName = assigned_to || staff_name || "";
  const tmId = parseInt(assigned_teammember_id) || null;
  const safePriority = getValidPriority(project_priority);
  db.query(`INSERT INTO tasks (project_name, task_title, task_description, project_status, project_priority, staff_name, client_name, created_date, due_date, assigned_to, assigned_teammember_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [project_name, task_title, task_description || "", project_status, safePriority, finalStaffName, client_name, created_date, due_date, finalStaffName, tmId, req.user.id],
    (err, result) => {
      if (err) { console.error("Task create error:", err); return res.status(500).json({ message: err.message }); }
      const taskId = result.insertId;
      db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
        [taskId, "Created", `Task "${task_title}" created`],
        (logErr) => { if (logErr) console.warn("task_activity insert skipped:", logErr.message); }
      );
      if (tmId) {
        db.query("SELECT u.id, u.first_name, u.email, t.emp_email FROM users u LEFT JOIN teammember t ON t.user_id = u.id WHERE t.id = ? LIMIT 1",
          [tmId],
          (userErr, userRows) => {
            if (userErr || !userRows.length) return;
            const assignedUser = userRows[0];
            const message = `New task assigned: "${task_title || project_name || "Task"}"${due_date ? ` (Due: ${due_date})` : ""} - Priority: ${project_priority}`;
            const notifIO = getNotificationIO();
            if (notifIO && assignedUser.id) {
              notifIO.emitNotification("task_assigned", {
                taskId,
                taskName: task_title || project_name,
                userId: assignedUser.id,
                userName: assignedUser.first_name || finalStaffName,
                dueDate: due_date,
                priority: project_priority,
                type: "task",
                message: message,
                title: "New Task Assigned"
              }, assignedUser.id, false);
            } else if (assignedUser.id) {
              db.query("INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, 'task_assigned', 'New Task Assigned', ?)",
                [taskId, assignedUser.id, message],
                () => { }
              );
            }
          }
        );
      }
      // Emit socket event for live refresh
      const notifIO = getNotificationIO();
      if (notifIO) notifIO.emit("task_updated", { taskId });
      res.json({ message: "Task created", id: taskId });
    }
  );
});

const validPriorities = ['Low', 'Normal', 'Medium', 'High', 'Urgent'];
const getValidPriority = (p) => validPriorities.includes(p) ? p : 'Medium';

router.put("/:id", verifyToken, (req, res) => {
  const { project_name, task_title, task_description, project_status, project_priority, client_name, staff_name, created_date, due_date, assigned_to, assigned_teammember_id } = req.body;
  const finalStaffName = assigned_to || staff_name || "";
  const safePriority = getValidPriority(project_priority);

  db.query("SELECT created_by, assigned_teammember_id, staff_name, assigned_to FROM tasks WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });

    const task = results[0];
    const isAdminUser = req.user.role === 'admin' || req.user.role === 'subadmin';
    const isCreator = task.created_by === req.user.id;

    // Resolve teammember_id for access check
    const resolveTmId = (cb) => {
      if (req.user.teammember_id) return cb(null, req.user.teammember_id);
      db.query("SELECT id FROM teammember WHERE user_id = ? OR emp_email = ? LIMIT 1", [req.user.id, req.user.email || ""], (err, rows) => {
        cb(err, rows && rows.length ? rows[0].id : null);
      });
    };

    resolveTmId((tmErr, myTmId) => {
      const isAssigned = (task.assigned_teammember_id && myTmId && task.assigned_teammember_id === myTmId) ||
        (task.staff_name && task.staff_name.toLowerCase().includes((req.user.name || "").toLowerCase())) ||
        (task.assigned_to && task.assigned_to.toLowerCase().includes((req.user.name || "").toLowerCase()));

      if (!isAdminUser && !isCreator && !isAssigned) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If employee (not admin/creator), only allow updating project_status
      if (!isAdminUser && !isCreator && isAssigned) {
        db.query("UPDATE tasks SET project_status = ?, updated_at = NOW() WHERE id = ?",
          [project_status, req.params.id],
          (updErr) => {
            if (updErr) return res.status(500).json({ error: updErr.message });
            db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
              [req.params.id, "Status Updated", `Employee ${req.user.first_name} updated status to ${project_status}`]);
            const notifIO = getNotificationIO();
            if (notifIO) notifIO.emit("task_updated", { taskId: req.params.id, newStatus: project_status });

            if (project_status === "Completed") {
              db.query("SELECT task_title, project_name, project_priority FROM tasks WHERE id = ?", [req.params.id], (err, taskRows) => {
                if (!err && taskRows.length > 0 && notifIO) {
                  const taskName = taskRows[0].task_title || taskRows[0].project_name || "Task";
                  const time = new Date().toLocaleString();
                  notifIO.emitNotification("task_completed", {
                    taskId: req.params.id,
                    taskName: taskName,
                    userId: req.user.id,
                    userName: req.user.first_name || req.user.name || "Employee",
                    type: "task",
                    priority: taskRows[0].project_priority || "normal",
                    title: "Task Completed",
                    message: `${req.user.first_name || req.user.name || "Employee"} completed task: "${taskName}"`,
                    timestamp: time
                  }, null, true);
                }
              });
            }
            return res.json({ message: "Status updated" });
          }
        );
        return;
      }

      // Full update for admin or creator
      const finalTmId = parseInt(assigned_teammember_id) || task.assigned_teammember_id || null;
      db.query(`UPDATE tasks SET project_name=?, task_title=?, task_description=?, project_status=?, project_priority=?, client_name=?, staff_name=?, created_date=?, due_date=?, assigned_to=?, assigned_teammember_id=? WHERE id=?`,
        [project_name, task_title, task_description || "", project_status, safePriority, client_name, finalStaffName, created_date, due_date, assigned_to || null, finalTmId, req.params.id],
        (updErr) => {
          if (updErr) {
            if (updErr.message.includes("Data truncated")) {
              return db.query(`UPDATE tasks SET project_name=?, task_title=?, task_description=?, project_status=?, project_priority='Medium', client_name=?, staff_name=?, created_date=?, due_date=?, assigned_to=?, assigned_teammember_id=? WHERE id=?`,
                [project_name, task_title, task_description || "", project_status, client_name, finalStaffName, created_date, due_date, assigned_to || null, finalTmId, req.params.id],
                (e2) => { if (e2) return res.status(500).json({ error: e2.message }); res.json({ message: "Task updated" }); });
            }
            return res.status(500).json({ error: updErr.message });
          }
          db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
            [req.params.id, "Updated", `Task "${task_title}" updated`]);
          const notifIO = getNotificationIO();
          if (notifIO) notifIO.emit("task_updated", { taskId: req.params.id, newStatus: project_status });
          if (project_status === "Completed") {
            const taskName = task_title || project_name || "Task";
            if (notifIO) {
              const time = new Date().toLocaleString();
              notifIO.emitNotification("task_completed", {
                taskId: req.params.id,
                taskName: taskName,
                userId: req.user.id,
                userName: req.user.first_name || req.user.name || "Employee",
                type: "task",
                priority: project_priority || "normal",
                title: "Task Completed",
                message: `${req.user.first_name || req.user.name || "Employee"} completed task: "${taskName}"`,
                timestamp: time
              }, null, true);
            }
          }
          res.json({ message: "Task updated" });
        }
      );
    });
  });
});

router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  db.query("SELECT created_by FROM tasks WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== 'admin' && results[0].created_by !== req.user.id) return res.status(403).json({ message: "Access denied" });
    db.query("DELETE FROM tasks WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json(err);
      db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
        [req.params.id, "Deleted", "Task deleted"]);
      res.json({ message: "Task deleted" });
    });
  });
});

router.get("/dashboard/tasks", verifyToken, (req, res) => {
  db.query("SELECT id, task_title, project_status, project_priority, created_date FROM tasks ORDER BY created_date DESC LIMIT 5",
    (err, rows) => { if (err) return res.status(500).json(err); res.json(rows); });
});

// GET overdue tasks (admin dashboard)
router.get("/overdue", verifyToken, isAdmin, (req, res) => {
  db.query(
    `SELECT t.*, tm.first_name as employee_name, tm.emp_email
     FROM tasks t
     LEFT JOIN teammember tm ON t.assigned_teammember_id = tm.id
     WHERE t.due_date < CURDATE() AND t.project_status != 'Completed'
     ORDER BY t.due_date ASC`,
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});

router.get("/targets", verifyToken, isAdmin, (req, res) => {
  const currentMonth = getLocalYearMonth();
  const currentYear = currentMonth.slice(0, 4);
  const currentYearPrefix = currentYear + "-%";
  const prevMonthStr = getPrevYearMonth(currentMonth);
  const prevYear = String(Number(currentYear) - 1);
  const prevYearPrefix = prevYear + "-%";
  const isJanuary = currentMonth.endsWith("-01");

  db.query(`SELECT t.*, 
    COALESCE(a.achieved_amount, 0) as achieved_amount, 
    COALESCE(a.achieved_count, 0) as achieved_count,
    COALESCE(ytd.ytd_amount, 0) as ytd_amount,
    COALESCE(ytd.ytd_count, 0) as ytd_count
    FROM task_targets t 
    LEFT JOIN task_achievements a ON t.id = a.target_id AND a.month_year = ?
    LEFT JOIN (
      SELECT target_id, SUM(achieved_amount) as ytd_amount, SUM(achieved_count) as ytd_count
      FROM task_achievements WHERE month_year LIKE ?
      GROUP BY target_id
    ) ytd ON t.id = ytd.target_id
    ORDER BY t.created_at DESC`,
    [currentMonth, currentYearPrefix],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.json(rows);

      // Auto carry-forward: month-to-month + year-end rollover
      const carryForwardChecks = rows.map(row => {
        return new Promise((resolve) => {
          let monthlyCarry = 0;

          // Month-to-month carry-forward - query by target_id
          db.query("SELECT achieved_amount FROM task_achievements WHERE target_id = ? AND month_year = ?",
            [row.id, prevMonthStr],
            (err2, prevRows) => {
              if (prevRows.length > 0 && prevRows[0].achieved_amount < row.monthly_target) {
                monthlyCarry = row.monthly_target - prevRows[0].achieved_amount;
              }

              // Year-end carry-forward: if January, check previous year's yearly shortfall
              let yearEndCarry = 0;
              const doFinalize = (totalCarry) => {
                const effectiveTarget = row.monthly_target + totalCarry;
                db.query("UPDATE task_targets SET carry_forward = ?, effective_target = ? WHERE id = ?",
                  [totalCarry, effectiveTarget, row.id],
                  () => {
                    row.carry_forward = totalCarry;
                    row.effective_target = effectiveTarget;
                    row.monthly_balance = Math.max(0, effectiveTarget - row.achieved_amount);
                    row.ytd_amount = row.ytd_amount || 0;
                    row.yearly_balance = Math.max(0, row.yearly_target - row.ytd_amount);
                    resolve();
                  }
                );
              };

              if (isJanuary && row.yearly_target > 0) {
                db.query("SELECT SUM(achieved_amount) as prev_year_total FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
                  [row.id, prevYearPrefix],
                  (err3, yrRows) => {
                    const prevYearTotal = yrRows && yrRows.length ? Number(yrRows[0].prev_year_total) || 0 : 0;
                    if (prevYearTotal < row.yearly_target) {
                      yearEndCarry = row.yearly_target - prevYearTotal;
                    }
                    doFinalize(Math.max(monthlyCarry, yearEndCarry));
                  }
                );
              } else {
                doFinalize(monthlyCarry);
              }
            }
          );
        });
      });

      Promise.all(carryForwardChecks).then(() => {
        const targetIds = rows.map(r => r.id).filter(Boolean);
        if (targetIds.length === 0) return res.json(rows);

        const placeholders = targetIds.map(() => '?').join(',');
        db.query(`SELECT a.*, t.monthly_target as target_monthly, t.carry_forward, t.effective_target FROM task_achievements a JOIN task_targets t ON a.target_id = t.id WHERE a.target_id IN (${placeholders}) ORDER BY a.month_year DESC`,
          targetIds,
          (err2, historyRows) => {
            if (err2) return res.json(rows);

            const historyMap = {};
            historyRows.forEach(h => {
              if (!historyMap[h.target_id]) historyMap[h.target_id] = [];
              historyMap[h.target_id].push({
                month_year: h.month_year,
                monthly_target: h.target_monthly,
                achieved_amount: h.achieved_amount,
                achieved_count: h.achieved_count,
                carry_forward: h.carry_forward || 0,
                effective_target: h.effective_target || h.target_monthly,
                balance_target: Math.max(0, (h.effective_target || h.target_monthly) - h.achieved_amount)
              });
            });

            const finalRows = rows.map(row => ({
              ...row,
              current_month: currentMonth,
              history: historyMap[row.id] || []
            }));

            res.json(finalRows);
          });
      });
    });
});

router.get("/targets/my", verifyToken, (req, res) => {
  const user_id = req.user.id;
  const user_name = req.user.name || req.user.first_name;
  if (!user_id) return res.status(400).json({ error: "User ID required" });
  const currentMonth = getLocalYearMonth();
  const currentYear = currentMonth.slice(0, 4);
  const currentYearPrefix = currentYear + "-%";
  const prevMonthStr = getPrevYearMonth(currentMonth);
  const prevYear = String(Number(currentYear) - 1);
  const prevYearPrefix = prevYear + "-%";
  const isJanuary = currentMonth.endsWith("-01");

  db.query("SELECT id, user_id, user_name, yearly_target, monthly_target, carry_forward, effective_target, teammember_id FROM task_targets WHERE (user_id = ? OR user_name = ?)",
    [user_id, user_name],
    (err, targetRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (targetRows.length === 0) return res.json({ message: "No target set", hasTarget: false });

      const targetId = targetRows[0].id;
      const monthlyTarget = targetRows[0].monthly_target;
      const yearlyTarget = targetRows[0].yearly_target;

      // Month-to-month carry-forward - query by target_id
      db.query("SELECT achieved_amount FROM task_achievements WHERE target_id = ? AND month_year = ?",
        [targetId, prevMonthStr],
        (prevErr, prevRows) => {
          let monthlyCarry = 0;
          if (prevRows.length > 0 && prevRows[0].achieved_amount < monthlyTarget) {
            monthlyCarry = monthlyTarget - prevRows[0].achieved_amount;
          }

          // Year-end carry-forward check
          const finalize = (totalCarry) => {
            const effectiveTarget = monthlyTarget + totalCarry;

            // Get current month achievement - query by target_id
            db.query("SELECT achieved_amount, achieved_count FROM task_achievements WHERE target_id = ? AND month_year = ?",
              [targetId, currentMonth],
              (err2, currentRows) => {
                const achievedAmount = currentRows.length > 0 ? currentRows[0].achieved_amount : 0;
                const achievedCount = currentRows.length > 0 ? currentRows[0].achieved_count : 0;
                const monthlyBalance = Math.max(0, effectiveTarget - achievedAmount);

                // Get YTD (year-to-date) achievement - query by target_id
                db.query("SELECT SUM(achieved_amount) as ytd_amount, SUM(achieved_count) as ytd_count FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
                  [targetId, currentYearPrefix],
                  (err4, ytdRows) => {
                    const ytdAmount = ytdRows && ytdRows.length ? Number(ytdRows[0].ytd_amount) || 0 : 0;
                    const ytdCount = ytdRows && ytdRows.length ? Number(ytdRows[0].ytd_count) || 0 : 0;
                    const yearlyBalance = Math.max(0, yearlyTarget - ytdAmount);

                    // Persist carry_forward
                    db.query("UPDATE task_targets SET carry_forward = ?, effective_target = ? WHERE id = ?",
                      [totalCarry, effectiveTarget, targetId],
                      () => {
                        db.query(`SELECT a.*, t.monthly_target as target_monthly, t.carry_forward, t.effective_target FROM task_achievements a JOIN task_targets t ON a.target_id = t.id WHERE a.target_id = ? ORDER BY a.month_year DESC LIMIT 12`,
                          [targetId],
                          (err3, historyRows) => {
                            const history = historyRows ? historyRows.map(h => ({
                              month_year: h.month_year,
                              monthly_target: h.target_monthly,
                              achieved_amount: h.achieved_amount,
                              achieved_count: h.achieved_count,
                              carry_forward: h.carry_forward || 0,
                              effective_target: h.effective_target || h.target_monthly,
                              balance_target: Math.max(0, (h.effective_target || h.target_monthly) - h.achieved_amount)
                            })) : [];

                            // Fetch individual submissions with descriptions - query by target_id
                            db.query("SELECT id, amount, description, month_year, created_at FROM task_updates WHERE target_id = ? ORDER BY created_at DESC LIMIT 50",
                              [targetId],
                              (err5, submissionRows) => {
                                const submissions = submissionRows ? submissionRows.map(s => ({
                                  id: s.id,
                                  amount: s.amount,
                                  description: s.description || "",
                                  month_year: s.month_year,
                                  created_at: s.created_at
                                })) : [];

                                res.json({
                                  ...targetRows[0],
                                  hasTarget: true,
                                  achieved_amount: achievedAmount,
                                  achieved_count: achievedCount,
                                  ytd_amount: ytdAmount,
                                  ytd_count: ytdCount,
                                  yearly_balance: yearlyBalance,
                                  monthly_balance: monthlyBalance,
                                  pending_amount: monthlyBalance,
                                  balance_target: monthlyBalance,
                                  carry_forward: totalCarry,
                                  effective_target: effectiveTarget,
                                  current_month: currentMonth,
                                  history,
                                  submissions
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          };

          if (isJanuary && yearlyTarget > 0) {
            db.query("SELECT SUM(achieved_amount) as prev_year_total FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
              [targetId, prevYearPrefix],
              (err3, yrRows) => {
                let yearEndCarry = 0;
                const prevYearTotal = yrRows && yrRows.length ? Number(yrRows[0].prev_year_total) || 0 : 0;
                if (prevYearTotal < yearlyTarget) {
                  yearEndCarry = yearlyTarget - prevYearTotal;
                }
                finalize(Math.max(monthlyCarry, yearEndCarry));
              }
            );
          } else {
            finalize(monthlyCarry);
          }
        }
      );
    }
  );
});

router.get("/targets/user", verifyToken, (req, res) => {
  const { user_name } = req.query;
  if (!user_name) return res.status(400).json({ error: "user_name required" });
  const currentMonth = getLocalYearMonth();
  const currentYear = currentMonth.slice(0, 4);
  const currentYearPrefix = currentYear + "-%";
  const prevMonthStr = getPrevYearMonth(currentMonth);
  const prevYear = String(Number(currentYear) - 1);
  const prevYearPrefix = prevYear + "-%";
  const isJanuary = currentMonth.endsWith("-01");

  db.query("SELECT id, yearly_target, monthly_target, carry_forward, effective_target FROM task_targets WHERE user_name = ?",
    [user_name],
    (err, targetRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (targetRows.length === 0) return res.json(null);
      const monthlyTarget = targetRows[0].monthly_target;
      const yearlyTarget = targetRows[0].yearly_target;
      const targetId = targetRows[0].id;

      // Month-to-month carry-forward - query by target_id
      db.query("SELECT achieved_amount FROM task_achievements WHERE target_id = ? AND month_year = ?",
        [targetId, prevMonthStr],
        (err2, prevRows) => {
          let monthlyCarry = 0;
          if (prevRows.length > 0 && prevRows[0].achieved_amount < monthlyTarget) {
            monthlyCarry = monthlyTarget - prevRows[0].achieved_amount;
          }

          const finalize = (totalCarry) => {
            const effectiveTarget = monthlyTarget + totalCarry;
            db.query("UPDATE task_targets SET carry_forward = ?, effective_target = ? WHERE id = ?",
              [totalCarry, effectiveTarget, targetId],
              () => {
                // Get current month achievement - query by target_id
                db.query("SELECT achieved_amount, achieved_count FROM task_achievements WHERE target_id = ? AND month_year = ?",
                  [targetId, currentMonth],
                  (err3, currentRows) => {
                    const achievedAmount = currentRows.length > 0 ? currentRows[0].achieved_amount : 0;
                    const achievedCount = currentRows.length > 0 ? currentRows[0].achieved_count : 0;
                    const monthlyBalance = Math.max(0, effectiveTarget - achievedAmount);

                    // Get YTD (year-to-date) achievement - query by target_id
                    db.query("SELECT SUM(achieved_amount) as ytd_amount, SUM(achieved_count) as ytd_count FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
                      [targetId, currentYearPrefix],
                      (err4, ytdRows) => {
                        const ytdAmount = ytdRows && ytdRows.length ? Number(ytdRows[0].ytd_amount) || 0 : 0;
                        const ytdCount = ytdRows && ytdRows.length ? Number(ytdRows[0].ytd_count) || 0 : 0;
                        const yearlyBalance = Math.max(0, yearlyTarget - ytdAmount);

                        res.json({
                          ...targetRows[0],
                          achieved_amount: achievedAmount,
                          achieved_count: achievedCount,
                          ytd_amount: ytdAmount,
                          ytd_count: ytdCount,
                          yearly_balance: yearlyBalance,
                          monthly_balance: monthlyBalance,
                          pending_amount: monthlyBalance,
                          balance_target: monthlyBalance,
                          carry_forward: totalCarry,
                          effective_target: effectiveTarget,
                          current_month: currentMonth
                        });
                      }
                    );
                  }
                );
              }
            );
          };

          if (isJanuary && yearlyTarget > 0) {
            db.query("SELECT SUM(achieved_amount) as prev_year_total FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
              [targetId, prevYearPrefix],
              (err3, yrRows) => {
                let yearEndCarry = 0;
                const prevYearTotal = yrRows && yrRows.length ? Number(yrRows[0].prev_year_total) || 0 : 0;
                if (prevYearTotal < yearlyTarget) {
                  yearEndCarry = yearlyTarget - prevYearTotal;
                }
                finalize(Math.max(monthlyCarry, yearEndCarry));
              }
            );
          } else {
            finalize(monthlyCarry);
          }
        }
      );
    }
  );
});

router.post("/targets", verifyToken, isAdmin, (req, res) => {
  const { user_id, user_name, yearly_target, created_by_admin, teammember_id } = req.body;
  if (!user_name || !yearly_target) return res.status(400).json({ error: "user_name and yearly_target (in INR) required" });
  const currentYear = new Date().getFullYear();
  const monthlyTarget = Math.round(yearly_target / 12);
  const tmId = parseInt(teammember_id) || null;
  const notificationIO = getNotificationIO();
  db.query("SELECT id FROM task_targets WHERE user_name = ?",
    [user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        db.query("UPDATE task_targets SET yearly_target = ?, monthly_target = ?, teammember_id = ?, updated_at = NOW() WHERE id = ?",
          [yearly_target, monthlyTarget, tmId, rows[0].id],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            // DISABLED: Old notification system
            /*
            if (notificationIO) notificationIO.emitNotification("target_updated", { id: rows[0].id, userId: user_id, userName: user_name, newAmount: yearly_target, monthlyTarget, type: "target" }, user_id, true);
            */
            res.json({ message: "Target updated", id: rows[0].id, yearly_target, monthly_target: monthlyTarget });
          }
        );
      } else {
        db.query("INSERT INTO task_targets (user_id, user_name, yearly_target, monthly_target, created_by_admin, teammember_id) VALUES (?, ?, ?, ?, ?, ?)",
          [user_id, user_name, yearly_target, monthlyTarget, created_by_admin, tmId],
          (err2, result) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const newTargetId = result.insertId;
            const message = `New target assigned to you: Rs.${Number(yearly_target || 0).toLocaleString()}/year (Monthly: Rs.${monthlyTarget.toLocaleString()})`;
            if (tmId) {
              db.query("SELECT u.id, u.first_name, u.email FROM users u LEFT JOIN teammember t ON t.user_id = u.id WHERE t.id = ? LIMIT 1",
                [tmId],
                (userErr, userRows) => {
                  if (!userErr && userRows.length && userRows[0].id) {
                    const targetUser = userRows[0];
                    if (notificationIO && targetUser.id) {
                      notificationIO.emitNotification("new_target", {
                        id: newTargetId,
                        userId: targetUser.id,
                        userName: targetUser.first_name || user_name,
                        targetAmount: yearly_target,
                        monthlyTarget,
                        type: "target",
                        title: "New Target Assigned",
                        message: message
                      }, targetUser.id, false);
                    } else if (targetUser.id) {
                      db.query("INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
                        [0, targetUser.id, "target_assigned", "New Target Assigned", message],
                        () => { }
                      );
                    }
                  }
                }
              );
            }
            // DISABLED: Old notification system
            /*
            if (notificationIO) notificationIO.emitNotification("new_target", { id: newTargetId, userId: user_id, userName: user_name, targetAmount: yearly_target, monthlyTarget, type: "target" }, null, true);
            */
            res.json({ message: "Yearly target created", id: newTargetId, yearly_target, monthly_target: monthlyTarget });
          }
        );
      }
    }
  );
});

router.put("/targets/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  const { user_id, user_name, yearly_target, teammember_id } = req.body;
  if (!yearly_target) return res.status(400).json({ error: "yearly_target is required" });

  const monthlyTarget = Math.round(yearly_target / 12);
  const tmId = parseInt(teammember_id) || null;
  const notificationIO = getNotificationIO();

  db.query("UPDATE task_targets SET yearly_target = ?, monthly_target = ?, teammember_id = ?, user_id = ?, user_name = ?, updated_at = NOW() WHERE id = ?",
    [yearly_target, monthlyTarget, tmId, user_id || null, user_name || "", id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // DISABLED: Old notification system
      /*
      if (notificationIO) notificationIO.emitNotification("target_updated", { id: parseInt(id), userId: user_id, userName: user_name, newAmount: yearly_target, monthlyTarget, type: "target" }, user_id, true);
      */
      res.json({ message: "Target updated", id: parseInt(id), yearly_target, monthly_target: monthlyTarget });
    }
  );
});

router.delete("/targets/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM task_targets WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query("DELETE FROM task_achievements WHERE target_id = ?", [id], (err2) => {
      if (err2) console.warn("task_achievements cleanup skipped:", err2.message);
    });
    db.query("DELETE FROM task_updates WHERE target_id = ?", [id], (err3) => {
      if (err3) console.warn("task_updates cleanup skipped:", err3.message);
    });
    res.json({ message: "Target deleted successfully" });
  });
});

router.post("/targets/update", verifyToken, (req, res) => {
  const user_id = req.user.id;
  const user_name = req.user.name || req.user.first_name || req.body.user_name;
  const { amount, description } = req.body;
  const currentMonth = getLocalYearMonth();
  if (!user_name || !amount) return res.status(400).json({ error: "user_name and amount (in INR) required" });
  db.query("SELECT id, yearly_target, monthly_target, user_name FROM task_targets WHERE (user_id = ? OR user_name = ?)",
    [user_id, user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) {
        db.query(`INSERT INTO task_targets (user_id, user_name, yearly_target, monthly_target, created_by_admin) VALUES (?, ?, ?, ?, ?)`,
          [user_id, user_name, 0, 0, 0],
          (insErr, insResult) => {
            if (insErr) return res.status(500).json({ error: insErr.message });
            const newTargetId = insResult.insertId;
            processAchievement(user_id, user_name, newTargetId, 0, 0, currentMonth, amount, description, res);
          }
        );
      } else {
        const targetId = rows[0].id;
        const monthlyTarget = rows[0].monthly_target;
        const targetUserName = rows[0].user_name || user_name;
        processAchievement(user_id, targetUserName, targetId, monthlyTarget, 0, currentMonth, amount, description, res);
      }
    }
  );
});

router.post("/targets/my", verifyToken, (req, res) => {
  const { yearly_target } = req.body;
  const user_id = req.user.id;
  const user_name = req.user.first_name || req.user.name;
  if (!yearly_target) return res.status(400).json({ error: "yearly_target is required" });
  const monthlyTarget = Math.round(yearly_target / 12);
  db.query("SELECT id FROM task_targets WHERE user_id = ? OR user_name = ?",
    [user_id, user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length > 0) {
        db.query("UPDATE task_targets SET yearly_target = ?, monthly_target = ?, updated_at = NOW() WHERE id = ?",
          [yearly_target, monthlyTarget, rows[0].id],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: "Target updated", id: rows[0].id, yearly_target, monthly_target: monthlyTarget });
          }
        );
      } else {
        db.query("INSERT INTO task_targets (user_id, user_name, yearly_target, monthly_target, created_by_admin) VALUES (?, ?, ?, ?, 0)",
          [user_id, user_name, yearly_target, monthlyTarget],
          (err2, result) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const notifIO = getNotificationIO();
            db.query("INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority) VALUES (?, ?, ?, ?, ?, ?)",
              ["target_created", user_id, `${user_name} set their own target: Rs.${Number(yearly_target).toLocaleString()}/year`, result.insertId, "target", "normal"],
              (nErr) => {
                if (!nErr && notifIO) {
                  notifIO.sendToAdmin("new_notification", {
                    type: "target_created",
                    message: `${user_name} set their own target: Rs.${Number(yearly_target).toLocaleString()}/year`,
                    employee_name: user_name,
                    priority: "normal", is_read: 0,
                    created_at: new Date().toISOString()
                  });
                }
              }
            );
            res.json({ message: "Target created", id: result.insertId, yearly_target, monthly_target: monthlyTarget });
          }
        );
      }
    }
  );
});

const processAchievement = (user_id, user_name, targetId, monthlyTarget, achievedCount, currentMonth, amount, description, res) => {
  const currentYear = currentMonth.slice(0, 4);
  const currentYearPrefix = currentYear + "-%";
  const prevYear = String(Number(currentYear) - 1);
  const prevYearPrefix = prevYear + "-%";
  const isJanuary = currentMonth.endsWith("-01");
  const prevMonthStr = getPrevYearMonth(currentMonth);

  db.query("SELECT yearly_target FROM task_targets WHERE id = ?", [targetId],
    (targetErr, targetRow) => {
      const yearlyTarget = targetRow && targetRow.length ? Number(targetRow[0].yearly_target) || 0 : 0;

      // Month-to-month carry - Query by targetId for complete name robustness
      db.query("SELECT achieved_amount FROM task_achievements WHERE target_id = ? AND month_year = ?",
        [targetId, prevMonthStr],
        (err2, prevRows) => {
          let monthlyCarry = 0;
          if (prevRows.length > 0 && prevRows[0].achieved_amount < monthlyTarget) {
            monthlyCarry = monthlyTarget - prevRows[0].achieved_amount;
          }

          const finalize = (totalCarry) => {
            const effectiveTarget = monthlyTarget + totalCarry;
            const achievementTimestamp = new Date().toISOString();

            // ═══════════════════════════════════════════════════════════
            // STEP 1: Update task_targets with carry_forward and effective_target
            // ═══════════════════════════════════════════════════════════
            db.query("UPDATE task_targets SET carry_forward = ?, effective_target = ?, updated_at = NOW() WHERE id = ?",
              [totalCarry, effectiveTarget, targetId],
              () => {
                // ═══════════════════════════════════════════════════════════
                // STEP 2: Insert into task_updates (AUDIT TRAIL)
                // ═══════════════════════════════════════════════════════════
                db.query(`INSERT INTO task_updates (user_id, user_name, target_id, month_year, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                  [user_id, user_name, targetId, currentMonth, amount, description],
                  (err3, updateRes) => {
                    const updateId = updateRes?.insertId;
                    if (err3) console.warn("task_updates insert warning:", err3.message);

                    // ═══════════════════════════════════════════════════════════
                    // STEP 3: Insert/Update task_achievements (HISTORY + TRACKING)
                    // ═══════════════════════════════════════════════════════════
                    db.query(`INSERT INTO task_achievements (user_id, user_name, target_id, month_year, achieved_amount, updated_at) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE achieved_amount = achieved_amount + ?, updated_at = NOW()`,
                      [user_id, user_name, targetId, currentMonth, amount, amount],
                      (err4) => {
                        if (err4) return res.status(500).json({ error: err4.message });

                        // ═══════════════════════════════════════════════════════════
                        // STEP 4: Insert into task_activity (EVENT LOG)
                        // ═══════════════════════════════════════════════════════════
                        db.query("INSERT INTO task_activity (task_id, action, message, created_at) VALUES (?, ?, ?, NOW())",
                          [targetId, "Achievement Added", `${user_name} added Rs.${amount} achievement (${description}) - Effective target: Rs.${effectiveTarget}`],
                          (actErr) => {
                            if (actErr) console.warn("task_activity insert warning:", actErr.message);
                          }
                        );

                        // ═══════════════════════════════════════════════════════════
                        // STEP 5: Get current month achievement details (Using target_id)
                        // ═══════════════════════════════════════════════════════════
                        db.query("SELECT achieved_amount FROM task_achievements WHERE target_id = ? AND month_year = ?",
                          [targetId, currentMonth],
                          (achErr, achRows) => {
                            const newAchieved = achRows && achRows.length ? achRows[0].achieved_amount : amount;
                            const monthlyPercentage = effectiveTarget > 0 ? Math.round((newAchieved / effectiveTarget) * 100) : 0;
                            const balanceTarget = Math.max(0, effectiveTarget - newAchieved);

                            // ═══════════════════════════════════════════════════════════
                            // STEP 6: Get YTD (Year-To-Date) totals (Using target_id)
                            // ═══════════════════════════════════════════════════════════
                            db.query("SELECT SUM(achieved_amount) as ytd_amount, SUM(achieved_count) as achievement_count FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
                              [targetId, currentYearPrefix],
                              (ytdErr, ytdRows) => {
                                const ytdAmount = ytdRows && ytdRows.length ? Number(ytdRows[0].ytd_amount) || 0 : 0;
                                const ytdCount = ytdRows && ytdRows.length ? Number(ytdRows[0].achievement_count) || 0 : 0;
                                const yearlyBalance = Math.max(0, yearlyTarget - ytdAmount);
                                const yearlyPct = yearlyTarget > 0 ? Math.round((ytdAmount / yearlyTarget) * 100) : 0;

                                const notifIO = getNotificationIO();

                                // ═══════════════════════════════════════════════════════════
                                // STEP 7: Send notifications & update admin side
                                // ═══════════════════════════════════════════════════════════

                                // Admin notification (if target completed)
                                if (monthlyPercentage >= 100 && notifIO) {
                                  const time = new Date().toLocaleString();
                                  // Admin notification
                                  notifIO.emitNotification("target_completed", {
                                    userId: user_id, userName: user_name, targetId: targetId,
                                    percentage: monthlyPercentage, achievedAmount: newAchieved,
                                    effectiveTarget: effectiveTarget,
                                    title: "🎯 Employee Target Completed",
                                    message: `${user_name} has completed their monthly target of Rs.${Number(effectiveTarget).toLocaleString()} (${monthlyPercentage}%).`,
                                    type: "target_completed", timestamp: time
                                  }, null, true);
                                }

                                // ═══════════════════════════════════════════════════════════
                                // STEP 8: Insert into admin_notifications + Broadcast
                                // ═══════════════════════════════════════════════════════════
                                db.query("INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())",
                                  ["target_achievement", user_id, `${user_name} achieved Rs.${Number(amount).toLocaleString()} - Monthly: ${monthlyPercentage}% (YTD: ${yearlyPct}%)`, targetId, "target", monthlyPercentage >= 100 ? "high" : "normal"],
                                  (nErr, nResult) => {
                                    if (!nErr && notifIO && nResult && nResult.insertId) {
                                      // ═══════════════════════════════════════════════════════════
                                      // STEP 9: Broadcast to admin dashboard (REAL-TIME)
                                      // ═══════════════════════════════════════════════════════════
                                      const achievementData = {
                                        id: nResult.insertId,
                                        notification_id: nResult.insertId,
                                        employee_name: user_name,
                                        user_id: user_id,
                                        amount: Number(amount),
                                        description: description,
                                        monthly_achieved: newAchieved,
                                        monthly_percentage: monthlyPercentage,
                                        monthly_target: monthlyTarget,
                                        monthly_balance: balanceTarget,
                                        yearly_achieved: ytdAmount,
                                        yearly_percentage: yearlyPct,
                                        yearly_target: yearlyTarget,
                                        yearly_balance: yearlyBalance,
                                        achievement_count: ytdCount,
                                        effective_target: effectiveTarget,
                                        balance_target: balanceTarget,
                                        timestamp: achievementTimestamp,
                                        created_at: new Date().toISOString(),
                                        is_target_completed: monthlyPercentage >= 100,
                                        current_month: currentMonth,
                                        carry_forward: totalCarry
                                      };

                                      // Broadcast to all admin clients
                                      notifIO.namespace.to("admin_notifications").emit("employee_achievement", achievementData);

                                      // Broadcast to employee
                                      notifIO.namespace.to(`notifications:${user_id}`).emit("achievement_recorded", achievementData);

                                      // Broadcast to all connected clients (global sync)
                                      notifIO.emit("target_data_changed", {
                                        type: "achievement_added",
                                        user_id: user_id,
                                        user_name: user_name,
                                        target_id: targetId,
                                        timestamp: achievementTimestamp
                                      });
                                    }
                                  }
                                );

                                // ═══════════════════════════════════════════════════════════
                                // STEP 10: Emit data changed event for all targets refresh
                                // ═══════════════════════════════════════════════════════════
                                if (notifIO) {
                                  notifIO.emit("data_changed", {
                                    type: "target_achievement",
                                    userId: user_id,
                                    userName: user_name,
                                    targetId: targetId,
                                    timestamp: achievementTimestamp
                                  });

                                  // Emit to targets room to refresh admin targets view with enriched carry-forward
                                  notifIO.namespace.to("admin_notifications").emit("target_updated_data", {
                                    target_id: targetId,
                                    user_name: user_name,
                                    monthly_achieved: newAchieved,
                                    monthly_percentage: monthlyPercentage,
                                    yearly_achieved: ytdAmount,
                                    yearly_percentage: yearlyPct,
                                    carry_forward: totalCarry,
                                    effective_target: effectiveTarget,
                                    timestamp: achievementTimestamp
                                  });
                                }

                                // ═══════════════════════════════════════════════════════════
                                // STEP 11: Return complete response to frontend
                                // ═══════════════════════════════════════════════════════════
                                res.json({
                                  message: "Achievement recorded successfully",
                                  success: true,
                                  target_id: targetId,
                                  update_id: updateId,
                                  carry_forward: totalCarry,
                                  effective_target: effectiveTarget,
                                  amount_updated: amount,
                                  achieved_amount: newAchieved,
                                  balance_target: balanceTarget,
                                  monthly_percentage: monthlyPercentage,
                                  ytd_amount: ytdAmount,
                                  yearly_balance: yearlyBalance,
                                  yearly_target: yearlyTarget,
                                  yearly_percentage: yearlyPct,
                                  current_month: currentMonth,
                                  timestamp: achievementTimestamp,
                                  is_target_completed: monthlyPercentage >= 100
                                });
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          };

          if (isJanuary && yearlyTarget > 0) {
            db.query("SELECT SUM(achieved_amount) as prev_year_total FROM task_achievements WHERE target_id = ? AND month_year LIKE ?",
              [targetId, prevYearPrefix],
              (err3, yrRows) => {
                let yearEndCarry = 0;
                const prevYearTotal = yrRows && yrRows.length ? Number(yrRows[0].prev_year_total) || 0 : 0;
                if (prevYearTotal < yearlyTarget) {
                  yearEndCarry = yearlyTarget - prevYearTotal;
                }
                finalize(Math.max(monthlyCarry, yearEndCarry));
              }
            );
          } else {
            finalize(monthlyCarry);
          }
        }
      );
    }
  );
};

router.get("/targets/history", verifyToken, (req, res) => {
  const { user_name, months } = req.query;
  const limit = parseInt(months) || 12;
  db.query(`SELECT a.month_year, a.achieved_count, a.achieved_amount, (SELECT monthly_target FROM task_targets WHERE id = a.target_id) as monthly_target FROM task_achievements a WHERE a.user_name = ? ORDER BY a.month_year DESC LIMIT ?`,
    [user_name, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Also fetch individual submissions with descriptions
      db.query("SELECT id, amount, description, month_year, created_at FROM task_updates WHERE user_name = ? ORDER BY created_at DESC LIMIT 100",
        [user_name],
        (err2, submissionRows) => {
          const submissions = submissionRows ? submissionRows.map(s => ({
            id: s.id,
            amount: s.amount,
            description: s.description || "",
            month_year: s.month_year,
            created_at: s.created_at
          })) : [];

          res.json({ monthly: rows, submissions });
        }
      );
    });
});

router.post("/assign", verifyToken, isAdmin, (req, res) => {
  const { task_id, target_id, assigned_to_user_id, assigned_to_user_name, assigned_by, due_date, priority, notes, type, amount } = req.body;
  if (!assigned_to_user_name) return res.status(400).json({ error: "assigned_to_user_name is required" });
  const isTaskAssignment = type === "task" && task_id;
  const isTargetAssignment = type === "target";
  if (!isTaskAssignment && !isTargetAssignment) return res.status(400).json({ error: "Either task_id (for task) or target_id (for target) is required" });
  if (isTaskAssignment) {
    db.query("UPDATE tasks SET staff_name = ?, assigned_to = ? WHERE id = ?",
      [assigned_to_user_name, assigned_to_user_id || null, task_id],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ error: updateErr.message });
        db.query(`INSERT INTO task_assignments (task_id, assigned_to_user_id, assigned_to_user_name, assigned_by, assigned_date, due_date, priority, notes) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
          [task_id, assigned_to_user_id, assigned_to_user_name, assigned_by, due_date, priority, notes],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
              [task_id, "Task Assigned", "Task assigned to " + assigned_to_user_name]);
            notifyTaskAssigned({ id: task_id, task_title: "Task #" + task_id, project_priority: priority, due_date }, assigned_to_user_id || assigned_to_user_name);
            res.json({ message: "Task assigned successfully", id: result.insertId });
          }
        );
      }
    );
  } else if (isTargetAssignment) {
    if (amount) {
      const yearly_target = parseFloat(amount);
      const monthlyTarget = Math.round(yearly_target / 12);
      db.query("SELECT id FROM task_targets WHERE user_name = ? OR user_id = ?",
        [assigned_to_user_name, assigned_to_user_id],
        (targetErr, targetRows) => {
          if (targetErr) return res.status(500).json({ error: targetErr.message });
          if (targetRows.length > 0) db.query("UPDATE task_targets SET yearly_target = ?, monthly_target = ?, updated_at = NOW() WHERE id = ?", [yearly_target, monthlyTarget, targetRows[0].id]);
          else db.query("INSERT INTO task_targets (user_id, user_name, yearly_target, monthly_target, created_by_admin) VALUES (?, ?, ?, ?, 1)", [assigned_to_user_id, assigned_to_user_name, yearly_target, monthlyTarget]);
        }
      );
    }
    db.query(`INSERT INTO task_assignments (task_id, assigned_to_user_id, assigned_to_user_name, assigned_by, assigned_date, due_date, priority, notes) VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)`,
      [target_id || 0, assigned_to_user_id, assigned_to_user_name, assigned_by, due_date, priority, notes],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
          [target_id || 0, "Target Assigned", "Target assigned to " + assigned_to_user_name]);
        notifyTargetAssigned({ id: target_id || 0, yearly_target: amount || 0, target_name: "Target for " + assigned_to_user_name }, assigned_to_user_id || assigned_to_user_name);
        res.json({ message: "Target assigned successfully", id: result.insertId });
      }
    );
  }
});

router.get("/assigned/:user_name", verifyToken, (req, res) => {
  const { user_name } = req.params;
  const { status } = req.query;
  let sql = `SELECT ta.*, t.task_title, t.project_name, t.client_name, t.created_date FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.assigned_to_user_name = ?`;
  const params = [user_name];
  if (status) { sql += " AND ta.status = ?"; params.push(status); }
  sql += " ORDER BY ta.created_at DESC";
  db.query(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); });
});

router.put("/assignment/:id/respond", verifyToken, (req, res) => {
  const { action, notes } = req.body;
  if (!['accept', 'decline'].includes(action)) return res.status(400).json({ error: "Invalid action. Use 'accept' or 'decline'" });
  const newStatus = action === "accept" ? "Accepted" : "Declined";
  db.query("SELECT ta.*, t.task_title, t.project_name FROM task_assignments ta JOIN tasks t ON ta.task_id = t.id WHERE ta.id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(404).json({ error: "Assignment not found" });
      const assignment = rows[0];
      db.query("UPDATE task_assignments SET status = ?, response_notes = ?, updated_at = NOW() WHERE id = ?",
        [newStatus, notes || null, req.params.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const notifMessage = action === "accept" ? assignment.assigned_to_user_name + " ACCEPTED task: \"" + assignment.task_title + "\"" : assignment.assigned_to_user_name + " DECLINED task: \"" + assignment.task_title + "\"" + (notes ? " - Reason: " + notes : "");
          db.query("INSERT INTO admin_notifications (type, user_id, message) VALUES (?, ?, ?)",
            ["task_response", assignment.assigned_to_user_id || 0, notifMessage]);
          db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
            [assignment.task_id, newStatus, assignment.assigned_to_user_name + " " + newStatus.toLowerCase() + " the task" + (notes ? ": " + notes : "")]);
          res.json({ message: "Task " + newStatus.toLowerCase() + " successfully", status: newStatus });
        }
      );
    }
  );
});

router.put("/assignment/:id/status", verifyToken, (req, res) => {
  const { status } = req.body;
  if (!['Pending', 'In Progress', 'Completed'].includes(status)) return res.status(400).json({ error: "Invalid status" });
  db.query("SELECT ta.task_id, ta.assigned_to_user_name, ta.assigned_to_user_id, ta.status as old_status, t.task_title FROM task_assignments ta LEFT JOIN tasks t ON t.id = ta.task_id WHERE ta.id = ?",
    [req.params.id],
    (err, currentRows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (currentRows.length === 0) return res.status(404).json({ error: "Assignment not found" });
      const assignment = currentRows[0];
      const wasCompleted = assignment.old_status === "Completed";
      const nowCompleted = status === "Completed";
      db.query("UPDATE task_assignments SET status = ?, updated_at = NOW() WHERE id = ?",
        [status, req.params.id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          if (!wasCompleted && nowCompleted) {
            updateTaskAchievement(assignment.assigned_to_user_id, assignment.assigned_to_user_name, 1, "Task completed");
            notifyTaskCompleted(assignment);
          } else if (wasCompleted && !nowCompleted) {
            updateTaskAchievement(assignment.assigned_to_user_id, assignment.assigned_to_user_name, -1, "Task status changed from completed");
          }
          db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
            [assignment.task_id, "Status Updated", "Task status updated to " + status + " by " + assignment.assigned_to_user_name]);
          res.json({ message: "Status updated" });
        }
      );
    }
  );
});

function updateTaskAchievement(user_id, user_name, count, description) {
  const currentMonth = getLocalYearMonth();
  db.query("SELECT id, yearly_target, monthly_target FROM task_targets WHERE (user_id = ? OR user_name = ?)",
    [user_id, user_name],
    (err, targetRows) => {
      if (err || targetRows.length === 0) return;
      const targetId = targetRows[0].id;
      const monthlyTarget = targetRows[0].monthly_target;
      const prevMonthStr = getPrevYearMonth(currentMonth);
      db.query("SELECT achieved_count FROM task_achievements WHERE target_id = ? AND month_year = ?",
        [targetId, prevMonthStr],
        (err2, prevRows) => {
          let carryForward = 0;
          if (prevRows.length > 0 && prevRows[0].achieved_count < monthlyTarget) {
            carryForward = monthlyTarget - prevRows[0].achieved_count;
          }
          db.query(`INSERT INTO task_updates (user_id, user_name, target_id, month_year, count, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [user_id, user_name, targetId, currentMonth, count, description],
            () => {
              db.query(`INSERT INTO task_achievements (user_id, user_name, target_id, month_year, achieved_count) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE achieved_count = achieved_count + ?`,
                [user_id, user_name, targetId, currentMonth, count, count],
                () => {
                  db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
                    [targetId, "Task Achievement Update", user_name + " " + description + " (" + (count > 0 ? '+' : '') + count + ")"]);
                }
              );
            }
          );
        }
      );
    }
  );
}

router.get("/notifications", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  const params = [];
  let sql = "SELECT * FROM notifications WHERE type IN ('missed_reminder_alert', 'target_completed')";
  if (role === "employee") { sql += " AND (user_id = ? OR user_id IS NULL)"; params.push(user_id); }
  else if (req.query.user_id) { sql += " AND user_id = ?"; params.push(req.query.user_id); }
  sql += " ORDER BY created_at DESC";
  db.query(sql, params, (err, rows) => { if (err) return res.status(500).json(err); res.json(rows); });
});

router.put("/notifications/:id/read", verifyToken, (req, res) => {
  db.query("UPDATE notifications SET is_read = 1 WHERE id = ?",
    [req.params.id],
    (err) => { if (err) return res.status(500).json(err); res.json({ success: true }); }
  );
});

router.get("/activity", verifyToken, (req, res) => {
  db.query("SELECT * FROM task_activity ORDER BY created_at DESC LIMIT 10",
    (err, rows) => { if (err) return res.status(500).json(err); res.json(rows); });
});

module.exports = router;