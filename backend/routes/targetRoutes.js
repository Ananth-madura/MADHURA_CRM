const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

/* GET ALL TARGETS (Admin) */
router.get("/", verifyToken, isAdmin, (req, res) => {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentYear = now.getFullYear();

  db.query(
    `SELECT t.*, COALESCE(a.achieved_amount, 0) AS achieved_amount, COALESCE(a.achieved_count, 0) AS achieved_count
     FROM task_targets t
     LEFT JOIN task_achievements a ON t.id = a.target_id AND a.month_year = ?
     ORDER BY t.created_at DESC`,
    [currentMonth],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.json(rows);

      // For each user, compute full carry-forward chain and ytd
      const enrichedRows = await Promise.all(rows.map(row => new Promise(resolve => {
        db.query(
          `SELECT a.month_year, a.achieved_amount, a.achieved_count, t.monthly_target AS target_monthly
           FROM task_achievements a
           JOIN task_targets t ON a.target_id = t.id
           WHERE a.user_name = ?
           ORDER BY a.month_year ASC`,
          [row.user_name],
          (err2, allAch) => {
            const monthlyTarget = parseFloat(row.monthly_target) || 0;
            const yearlyTarget = parseFloat(row.yearly_target) || 0;

            const enrichedHistory = [];
            let runningCarry = 0;

            for (const h of (allAch || [])) {
              const mTarget = parseFloat(h.target_monthly) || monthlyTarget;
              const achieved = parseFloat(h.achieved_amount) || 0;
              const effTarget = mTarget + runningCarry;
              const balance = Math.max(0, effTarget - achieved);
              const pct = effTarget > 0 ? Math.round((achieved / effTarget) * 100) : 0;

              enrichedHistory.push({
                month_year: h.month_year,
                monthly_target: mTarget,
                carry_forward: runningCarry,
                effective_target: effTarget,
                achieved_amount: achieved,
                achieved_count: h.achieved_count || 0,
                balance,
                pct,
                status: pct >= 100 ? "Completed" : pct >= 50 ? "Process" : "New"
              });

              runningCarry = achieved < effTarget ? (effTarget - achieved) : 0;
            }

            const hasCurrentMonth = (allAch || []).some(h => h.month_year === currentMonth);
            const currentCarry = hasCurrentMonth
              ? (enrichedHistory.find(h => h.month_year === currentMonth)?.carry_forward ?? 0)
              : runningCarry;

            const effectiveTarget = monthlyTarget + currentCarry;
            const pendingAmount = Math.max(0, effectiveTarget - parseFloat(row.achieved_amount || 0));

            const ytdAmount = (allAch || [])
              .filter(h => h.month_year && h.month_year.startsWith(`${currentYear}`))
              .reduce((sum, h) => sum + parseFloat(h.achieved_amount || 0), 0);

            // Update carry_forward and effective_target in DB for this user
            db.query(
              "UPDATE task_targets SET carry_forward = ?, effective_target = ? WHERE id = ?",
              [currentCarry, effectiveTarget, row.id],
              () => resolve({
                ...row,
                carry_forward: currentCarry,
                effective_target: effectiveTarget,
                pending_amount: pendingAmount,
                ytd_amount: ytdAmount,
                current_month: currentMonth,
                history: [...enrichedHistory].reverse() // DESC for display
              })
            );
          }
        );
      })));

      res.json(enrichedRows);
    }
  );
});



/* GET TARGET FOR USER */
router.get("/my", verifyToken, (req, res) => {
  const user_id = req.user.id;
  const user_name = req.query.user_name || req.user.first_name || req.user.name;
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const currentYear = now.getFullYear();

  // Fetch target record
  db.query(
    `SELECT t.*, COALESCE(a.achieved_amount, 0) AS achieved_amount, COALESCE(a.achieved_count, 0) AS achieved_count
     FROM task_targets t
     LEFT JOIN task_achievements a ON t.id = a.target_id AND a.month_year = ?
     WHERE (t.user_id = ? OR t.user_name = ?) LIMIT 1`,
    [currentMonth, user_id, user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows[0]) return res.json(null);

      const target = rows[0];
      const monthlyTarget = parseFloat(target.monthly_target) || 0;
      const yearlyTarget = parseFloat(target.yearly_target) || 0;

      // Fetch ALL monthly achievements for this user (full history, ordered ASC for carry-forward chain)
      db.query(
        `SELECT a.month_year, a.achieved_amount, a.achieved_count, t.monthly_target AS target_monthly
         FROM task_achievements a
         JOIN task_targets t ON a.target_id = t.id
         WHERE a.user_name = ?
         ORDER BY a.month_year ASC`,
        [target.user_name],
        (err2, allAchRows) => {
          if (err2) return res.status(500).json({ error: err2.message });

          // ── Build enriched history with per-month carry-forward chain ────────
          const enrichedHistory = [];
          let runningCarry = 0;

          for (const row of (allAchRows || [])) {
            const mTarget = parseFloat(row.target_monthly) || monthlyTarget;
            const achieved = parseFloat(row.achieved_amount) || 0;
            const effTarget = mTarget + runningCarry;
            const balance = Math.max(0, effTarget - achieved);
            const pct = effTarget > 0 ? Math.round((achieved / effTarget) * 100) : 0;

            enrichedHistory.push({
              month_year: row.month_year,
              monthly_target: mTarget,
              carry_forward: runningCarry,
              effective_target: effTarget,
              achieved_amount: achieved,
              achieved_count: row.achieved_count || 0,
              balance,
              pct,
              status: pct >= 100 ? "Completed" : pct >= 50 ? "Process" : "New"
            });

            // Next month carries forward any unmet portion of EFFECTIVE target
            if (achieved < effTarget) {
              runningCarry = effTarget - achieved; // shortfall carries forward
            } else {
              runningCarry = 0; // fully met or exceeded — no carry-forward
            }
          }

          // Current month carry-forward = last computed runningCarry
          // (if current month already in allAchRows, it was processed above)
          // If current month is NOT yet in allAchRows, carry-forward is runningCarry
          const hasCurrentMonth = (allAchRows || []).some(r => r.month_year === currentMonth);
          const currentCarry = hasCurrentMonth
            ? (enrichedHistory.find(h => h.month_year === currentMonth)?.carry_forward ?? 0)
            : runningCarry;

          const effectiveTarget = monthlyTarget + currentCarry;
          const currentAchieved = parseFloat(target.achieved_amount) || 0;
          const pendingAmount = Math.max(0, effectiveTarget - currentAchieved);

          // ── YTD (Year-To-Date): sum all achievements in current calendar year ─
          const ytdAmount = (allAchRows || [])
            .filter(r => r.month_year && r.month_year.startsWith(`${currentYear}`))
            .reduce((sum, r) => sum + parseFloat(r.achieved_amount || 0), 0);

          // Return history in DESC order (most recent first) for display
          const historyDesc = [...enrichedHistory].reverse();

          // Fetch recent submissions/updates for timeline
          db.query(
            `SELECT id, amount, description, month_year, created_at
             FROM task_updates WHERE user_name = ? ORDER BY created_at DESC LIMIT 20`,
            [target.user_name],
            (err3, submRows) => {
              const submissions = submRows ? submRows.map(s => ({
                id: s.id,
                amount: s.amount,
                description: s.description || "",
                month_year: s.month_year,
                created_at: s.created_at,
                source: (s.description || "").toLowerCase().includes("via quotation billed") ? "auto" : "manual"
              })) : [];

              res.json({
                ...target,
                hasTarget: true,
                carry_forward: currentCarry,
                effective_target: effectiveTarget,
                pending_amount: pendingAmount,
                ytd_amount: ytdAmount,
                current_month: currentMonth,
                history: historyDesc,
                submissions
              });
            }
          );
        }
      );
    }
  );
});


/* CREATE/UPDATE TARGET (Admin) */
router.post("/", verifyToken, isAdmin, (req, res) => {
  const { user_id, user_name, yearly_target, monthly_target, created_by_admin, teammember_id } = req.body;

  if (!user_name || !yearly_target) {
    return res.status(400).json({ error: "user_name and yearly_target required" });
  }

  const finalMonthlyTarget = monthly_target || Math.round(yearly_target / 12);
  const tmId = parseInt(teammember_id) || null;
  const currentYear = new Date().getFullYear();

  db.query(
    "SELECT id FROM task_targets WHERE user_name = ?",
    [user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const notificationIO = getNotificationIO();

      if (rows.length > 0) {
        db.query(
          "UPDATE task_targets SET yearly_target = ?, monthly_target = ?, teammember_id = ?, updated_at = NOW() WHERE id = ?",
          [yearly_target, finalMonthlyTarget, tmId, rows[0].id],
          (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            // DISABLED: Old notification system
            /*
            if (notificationIO) notificationIO.emitNotification("target_updated", { id: rows[0].id, userId: user_id, userName: user_name, newAmount: yearly_target, type: "target" }, null, true);
            */
            res.json({ message: "Target updated", id: rows[0].id });
          }
        );
      } else {
        db.query(
          "INSERT INTO task_targets (user_id, user_name, yearly_target, monthly_target, created_by_admin, teammember_id) VALUES (?, ?, ?, ?, ?, ?)",
          [user_id, user_name, yearly_target, finalMonthlyTarget, created_by_admin || 1, tmId],
          (err2, result) => {
            if (err2) return res.status(500).json({ error: err2.message });
            const newTargetId = result.insertId;
            const message = `New target assigned to you: Rs.${Number(yearly_target || 0).toLocaleString()}/year (Monthly: Rs.${finalMonthlyTarget.toLocaleString()})`;
            if (tmId) {
              db.query("SELECT u.id, u.first_name FROM users u LEFT JOIN teammember t ON t.user_id = u.id WHERE t.id = ? LIMIT 1",
                [tmId],
                (userErr, userRows) => {
                  if (!userErr && userRows.length && userRows[0].id) {
                    const targetUser = userRows[0];
                    if (notificationIO) {
                      // DISABLED: Old notification system
                      /*
                      notificationIO.emitNotification("new_target", { id: newTargetId, userId: targetUser.id, userName: targetUser.first_name || user_name, targetAmount: yearly_target, monthlyTarget: finalMonthlyTarget, type: "target" }, targetUser.id, false);
                      */
                    }
                    db.query("INSERT INTO notifications (task_id, user_id, type, title, description) VALUES (?, ?, ?, ?, ?)",
                      [0, targetUser.id, "target_assigned", "New Target Assigned", message],
                      () => { }
                    );
                  }
                }
              );
            }
            // DISABLED: Old notification system
            /*
            if (notificationIO) notificationIO.emitNotification("new_target", { id: newTargetId, userId: user_id, userName: user_name, targetAmount: yearly_target, monthlyTarget: finalMonthlyTarget, type: "target" }, null, true);
            */
            res.json({ message: "Target created", id: newTargetId });
          }
        );
      }
    }
  );
});

/* UPDATE ACHIEVEMENT (User) */
router.post("/update", verifyToken, (req, res) => {
  const { user_id, user_name, amount, description } = req.body;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear();

  if (!user_name || !amount) {
    return res.status(400).json({ error: "user_name and amount required" });
  }

  db.query(
    "SELECT id, monthly_target FROM task_targets WHERE user_name = ?",
    [user_name],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(404).json({ error: "Target not set for user" });

      const targetId = rows[0].id;
      const monthlyTarget = rows[0].monthly_target;

      db.query(
        `INSERT INTO task_updates (user_id, user_name, target_id, month_year, amount, description) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, user_name, targetId, currentMonth, amount, description],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });

          db.query(
            `INSERT INTO task_achievements (user_id, user_name, target_id, month_year, achieved_amount) 
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE achieved_amount = achieved_amount + ?`,
            [user_id, user_name, targetId, currentMonth, amount, amount],
            (err3) => {
              if (err3) return res.status(500).json({ error: err3.message });

              db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
                [targetId, "Target Update", `${user_name} updated achievement by Rs.${Number(amount).toLocaleString()}`]);

              db.query("SELECT SUM(achieved_amount) as total FROM task_achievements WHERE user_name = ? AND month_year = ?",
                [user_name, currentMonth],
                (selErr, selRows) => {
                  const totalAchieved = Number(selRows?.[0]?.total || 0);
                  const percentage = monthlyTarget > 0 ? Math.round((totalAchieved / monthlyTarget) * 100) : 0;
                  const isCompleted = percentage >= 100;

                  const notifMsg = isCompleted
                    ? `🎯 ${user_name} has COMPLETED their monthly target! Achieved ₹${Number(totalAchieved).toLocaleString()} (${percentage}%)`
                    : `${user_name} achieved ₹${Number(amount).toLocaleString()} — Total: ₹${Number(totalAchieved).toLocaleString()} (${percentage}%)`;

                  db.query(
                    "INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority) VALUES (?, ?, ?, ?, ?, ?)",
                    [
                      isCompleted ? "target_completed" : "target_achievement",
                      user_id, notifMsg, targetId, "target",
                      isCompleted ? "high" : "normal"
                    ],
                    (errN, resultN) => {
                      if (!errN) {
                        const io = getNotificationIO();
                        if (io) {
                          // Send to admin: achievement update
                          io.sendToAdmin("new_notification", {
                            id: resultN.insertId,
                            type: isCompleted ? "target_completed" : "target_achievement",
                            message: notifMsg,
                            employee_name: user_name,
                            priority: isCompleted ? "high" : "normal",
                            is_read: 0,
                            created_at: new Date().toISOString()
                          });

                          // If target completed — also send a special celebratory alert
                          if (isCompleted) {
                            io.sendToAdmin("target_completed", {
                              user_name,
                              totalAchieved: Number(totalAchieved),
                              percentage,
                              targetId,
                              month: currentMonth,
                              message: `🎯 ${user_name} completed their target for ${currentMonth}!`
                            });
                          }

                          // Broadcast data change so all open dashboards refresh
                          io.emit("data_changed", {
                            type: "target_achievement",
                            user_name,
                            amount: Number(amount),
                            totalAchieved: Number(totalAchieved),
                            percentage,
                            targetId,
                            month: currentMonth
                          });
                        }
                      }

                      res.json({
                        message: "Achievement updated",
                        target_id: targetId,
                        achieved_amount: Number(totalAchieved),
                        percentage,
                        is_completed: isCompleted
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
});

/* GET ACHIEVEMENT HISTORY */
router.get("/history", verifyToken, (req, res) => {
  const { user_name, months } = req.query;
  const limit = parseInt(months) || 12;

  db.query(
    `SELECT a.month_year, a.achieved_amount, a.achieved_count,
      (SELECT monthly_target FROM task_targets WHERE id = a.target_id) as monthly_target
    FROM task_achievements a
    WHERE a.user_name = ?
    ORDER BY a.month_year DESC
    LIMIT ?`,
    [user_name, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query("SELECT id, amount, description, month_year, created_at FROM task_updates WHERE user_name = ? ORDER BY created_at DESC LIMIT 100",
        [user_name],
        (err2, submissionRows) => {
          const submissions = submissionRows ? submissionRows.map(s => ({
            id: s.id,
            amount: s.amount,
            description: s.description || "",
            month_year: s.month_year,
            created_at: s.created_at,
            source: (s.description || "").toLowerCase().includes("via quotation billed") ? "auto" : "manual"
          })) : [];

          res.json({ monthly: rows, submissions });
        }
      );
    }
  );
});

/* GET TARGET GRAPH DATA */
router.get("/graph", verifyToken, (req, res) => {
  const { user_id, user_name } = req.query;
  const currentMonth = new Date().toISOString().slice(0, 7);

  db.query(
    `SELECT 
      t.yearly_target,
      t.monthly_target,
      COALESCE(a.achieved_amount, 0) as achieved_amount,
      (t.monthly_target - COALESCE(a.achieved_amount, 0)) as pending,
      (t.yearly_target / 12) as per_month_avg
    FROM task_targets t
    LEFT JOIN task_achievements a ON t.id = a.target_id AND a.month_year = ?
    WHERE t.user_name = ? OR t.user_id = ?`,
    [currentMonth, user_name, user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows[0] || {});
    }
  );
});

module.exports = router;
