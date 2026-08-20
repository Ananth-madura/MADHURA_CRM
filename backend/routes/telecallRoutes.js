const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

const checkDuplicateLead = (phone, email, excludeId, callback) => {
  if (typeof excludeId === 'function') { callback = excludeId; excludeId = null; }
  const checks = [];
  if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM telecalls WHERE mobile_number = ? AND id != ?", params: [phone, excludeId || 0] });
  if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM walkins WHERE mobile_number = ?", params: [phone] });
  if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM fields WHERE mobile_number = ?", params: [phone] });
  if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM telecalls WHERE email = ? AND id != ?", params: [email, excludeId || 0] });
  if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM walkins WHERE email = ?", params: [email] });
  if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM fields WHERE email = ?", params: [email] });
  if (phone) checks.push({ sql: "SELECT id, name, phone FROM clients WHERE phone = ? AND NOT (original_lead_id = ? AND original_lead_type = 'telecall')", params: [phone, excludeId || 0] });
  if (email) checks.push({ sql: "SELECT id, name, email as phone FROM clients WHERE email = ? AND NOT (original_lead_id = ? AND original_lead_type = 'telecall')", params: [email, excludeId || 0] });

  if (checks.length === 0) return callback(null);

  let completed = 0;
  const results = [];
  checks.forEach((c) => {
    db.query(c.sql, c.params, (err, rows) => {
      if (err) { completed++; if (completed === checks.length) callback(null); return; }
      if (rows.length > 0) results.push({ id: rows[0].id, table: "Lead", name: rows[0].customer_name || rows[0].name, phone: rows[0].phone });
      completed++;
      if (completed === checks.length) callback(results.length > 0 ? results : null);
    });
  });
};

// Helper to safely format date to YYYY-MM-DD
const toDateOnly = (val) => {
  if (!val) return null;
  return val.toString().slice(0, 10);
};

// Helper to safely format time to HH:MM:SS
const toTimeOnly = (val) => {
  if (!val) return null;
  const s = val.toString().trim();
  if (s.length >= 8) return s.slice(0, 8); // trim millis/timezone if present
  return s;
};


const resolveAssignedTo = (staffName, callback) => {
  if (!staffName) return callback(null);
  const cleanName = staffName.trim().replace(/\s+/g, ' ');
  db.query(
    "SELECT user_id FROM teammember WHERE TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) = ? OR TRIM(first_name) = ? OR TRIM(last_name) = ?",
    [cleanName, cleanName, cleanName],
    (err, rows) => {
      if (err || rows.length === 0) return callback(null);
      callback(rows[0].user_id || null);
    }
  );
};

const isAuthorizedToEdit = (lead, user) => {
  if (user.role === 'admin' || user.role === 'subadmin') return true;
  if (lead.assigned_to && lead.assigned_to !== user.id) return false;

  const userName = (user.name || "").trim().toLowerCase();
  if (lead.staff_name && lead.staff_name.trim().length > 0) {
    if (userName.length > 0 && !lead.staff_name.toLowerCase().includes(userName)) {
      return false;
    }
  }

  if (lead.created_by === user.id) return true;
  if (lead.assigned_to === user.id) return true;

  // JWT contains `name` (which is user's first_name)
  if (lead.staff_name && lead.staff_name.trim().toLowerCase().includes(userName) && userName.length > 0) return true;

  return false;
};

router.get("/", verifyToken, (req, res) => {
  const { id: user_id, role, name: user_name } = req.user;
  let sql = `
    SELECT t.*, u.first_name as creator_name,
      (SELECT COUNT(*) FROM lead_reminders WHERE lead_id = t.id AND lead_type = 'telecall' AND status = 'Pending') AS pending_reminder_count,
      (SELECT COUNT(*) FROM lead_followups WHERE lead_id = t.id AND lead_type = 'telecall' AND status = 'Pending') AS pending_followup_count,
      (SELECT COUNT(*) FROM lead_reminders WHERE lead_id = t.id AND lead_type = 'telecall' AND status = 'Pending' AND reminder_date = CURDATE()) AS today_reminder_count,
      (SELECT COUNT(*) FROM lead_followups WHERE lead_id = t.id AND lead_type = 'telecall' AND status = 'Pending' AND followup_date = CURDATE()) AS today_followup_count
    FROM telecalls t
    LEFT JOIN users u ON t.created_by = u.id
  `;
  const params = [];

  if (role === "employee") {
    sql += " WHERE t.created_by = ?";
    params.push(user_id);
    sql += " ORDER BY t.id DESC";
    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
    return;
  }

  sql += " ORDER BY t.id DESC";
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

const syncClient = (data, userId, leadId, teammemberId) => {
  const { customer_name, company_name, mobile_number, location_city, service_name, email, call_outcome, gst_number, staff_name, landline_number, alternate_mobile_number, reference_by, nearest_landmark } = data;
  const leadIdDisplay = `T-${leadId}`;

  if (call_outcome === "Converted") {
    db.query("SELECT id FROM clients WHERE original_lead_id = ? AND original_lead_type = 'telecall'", [leadId], (err, result) => {
      if (err) {
        console.error("Error checking client existence:", err);
        return;
      }

      if (result.length === 0) {
        // Check by phone OR email
        const phoneCheck = mobile_number ? "phone = ?" : "1=0";
        const emailCheck = email ? "OR email = ?" : "";
        const params = [];
        if (mobile_number) params.push(mobile_number);
        if (email) params.push(email);

        db.query(`SELECT id FROM clients WHERE (${phoneCheck}) ${emailCheck} AND (original_lead_id IS NULL OR original_lead_type != 'telecall')`, params, (err2, phoneResult) => {
          if (!err2 && phoneResult.length > 0) {
            db.query(
              `UPDATE clients SET name=?, company_name=?, phone=?, address=?, city=?, service=?, email=?, gst_number=?, 
               original_lead_id=?, original_lead_type='telecall', assigned_teammember_id=?,
               lead_staff_name=?, lead_id_display=?, client_status='converted', converted_at=NOW(),
               landline_number=?, alternate_mobile_number=?, reference_by=?, nearest_landmark=?
               WHERE id=?`,
              [customer_name, company_name || null, mobile_number, location_city, location_city, service_name, email, gst_number || "", leadId, teammemberId || null,
                staff_name || "", leadIdDisplay, landline_number || null, alternate_mobile_number || null, reference_by || null, nearest_landmark || null, phoneResult[0].id]
            );
          } else {
            db.query(
              `INSERT INTO clients (name, company_name, phone, address, city, service, email, gst_number, created_by, assigned_teammember_id, 
               original_lead_id, original_lead_type, lead_staff_name, lead_id_display, client_status, converted_at,
               landline_number, alternate_mobile_number, reference_by, nearest_landmark) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'telecall', ?, ?, 'converted', NOW(), ?, ?, ?, ?)`,
              [customer_name, company_name || null, mobile_number, location_city, location_city, service_name, email, gst_number || "", userId, teammemberId || null,
                leadId, staff_name || "", leadIdDisplay, landline_number || null, alternate_mobile_number || null, reference_by || null, nearest_landmark || null],
              (insertErr) => {
                if (insertErr) console.error("Client conversion (telecall insert) failed:", insertErr);
              }
            );
          }
        });
      } else {
        db.query(
          `UPDATE clients SET name=?, company_name=?, phone=?, address=?, city=?, service=?, email=?, gst_number=?, 
           assigned_teammember_id=?, lead_staff_name=?, lead_id_display=?,
           landline_number=?, alternate_mobile_number=?, reference_by=?, nearest_landmark=?
           WHERE original_lead_id=? AND original_lead_type='telecall'`,
          [customer_name, company_name || null, mobile_number, location_city, location_city, service_name, email, gst_number || "", teammemberId || null,
            staff_name || "", leadIdDisplay, landline_number || null, alternate_mobile_number || null, reference_by || null, nearest_landmark || null, leadId],
          (updateErr) => {
            if (updateErr) console.error("Client conversion (telecall update) failed:", updateErr);
          }
        );
      }
    });
  }
};


// GET single telecall (EDIT)
router.get("/:id", verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  db.query(
    "SELECT * FROM telecalls WHERE id = ?",
    [id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ message: "Not found" });

      const lead = results[0];
      if (!isAuthorizedToEdit(lead, req.user)) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(lead);
    }
  );
});


// POST telecall
router.post("/", verifyToken, (req, res) => {
  const {
    customer_name,
    company_name,
    mobile_number,
    location_city,
    call_date,
    service_name,
    staff_name,
    call_outcome,
    followup_required,
    followup_date,
    followup_notes,
    reminder_required,
    reminder_date,
    reminder_notes,
    reference,
    gst_number,
    email,
    landline_number,
    alternate_mobile_number,
    reference_by,
    nearest_landmark
  } = req.body;

  // Check for duplicates across all lead tables and clients
  checkDuplicateLead(mobile_number, email, (duplicates) => {
    if (duplicates && duplicates.length > 0) {
      const msgs = duplicates.map(d => `${d.name} (${d.phone || "N/A"})`);
      return res.status(409).json({ message: "Duplicate lead found", duplicates, details: `Phone/Email already exists: ${msgs.join("; ")}` });
    }

    resolveAssignedTo(staff_name, (resolvedId) => {
      const finalAssignedTo = resolvedId || req.body.assigned_to || null;
      const sql = `
        INSERT INTO telecalls (
          customer_name,
          company_name,
          mobile_number,
          location_city,
          call_date,
          service_name,
          staff_name,
          call_outcome,
          followup_required,
          followup_date,
          followup_notes,
          reminder_required,
          reminder_date,
          reminder_notes,
          reference,
          gst_number,
          email,
          created_by,
          assigned_to,
          landline_number,
          alternate_mobile_number,
          reference_by,
          nearest_landmark
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.query(
        sql,
        [
          customer_name,
          company_name || null,
          mobile_number,
          location_city,
          toDateOnly(call_date),
          service_name,
          staff_name,
          call_outcome,
          followup_required,
          toDateOnly(followup_date),
          followup_notes,
          reminder_required,
          toDateOnly(reminder_date),
          reminder_notes,
          reference,
          gst_number,
          email,
          req.user.id,
          finalAssignedTo,
          landline_number || null,
          alternate_mobile_number || null,
          reference_by || null,
          nearest_landmark || null
        ],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          const newId = result.insertId;
          syncClient(req.body, req.user.id, newId, req.body.teammember_id || null);

          // Log activity
          db.query(
            "INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)",
            [newId, "telecall", "Lead Created", `Status: ${call_outcome || "New"}`]
          );
          // If reminder set, add to lead_reminders
          if (reminder_required === "Yes" && reminder_date) {
            db.query(
              "INSERT INTO lead_reminders (lead_id, lead_type, reminder_date, reminder_time, reminder_notes, status, employee_id) VALUES (?,?,?,?,?,'Pending',?)",
              [newId, "telecall", toDateOnly(reminder_date), toTimeOnly(req.body.reminder_time) || null, reminder_notes || "", req.user?.id || null]
            );
          }

          // Auto-trigger WhatsApp Automations
          try {
            const { triggerAutomation } = require("../services/waAutomationService");
            triggerAutomation("new_lead", {
              phone: mobile_number,
              contactName: customer_name,
              data: { customer_name, company_name, service_name, location_city }
            }).catch(e => console.error("WA Automation trigger error:", e.message));
          } catch (_) {}

          res.json({ message: "Telecall added", id: newId });
        }
      );
    });
  });
});


// Edit 

router.put("/:id", verifyToken, (req, res) => {
  const {
    customer_name,
    company_name,
    mobile_number,
    location_city,
    call_date,
    service_name,
    staff_name,
    call_outcome,
    followup_required,
    followup_date,
    followup_notes,
    reminder_required,
    reminder_date,
    reminder_notes,
    reference,
    gst_number,
    email,
    landline_number,
    alternate_mobile_number,
    reference_by,
    nearest_landmark
  } = req.body;

  // Check ownership & authorization
  db.query("SELECT created_by, assigned_to, staff_name FROM telecalls WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });

    if (!isAuthorizedToEdit(results[0], req.user)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Check for duplicates (exclude current record)
    checkDuplicateLead(mobile_number, email, Number(req.params.id), (duplicates) => {
      if (duplicates && duplicates.length > 0) {
        const msgs = duplicates.map(d => `${d.name} (${d.phone || "N/A"})`);
        return res.status(409).json({ message: "Duplicate lead found", duplicates, details: `Phone/Email already exists: ${msgs.join("; ")}` });
      }

      resolveAssignedTo(staff_name, (resolvedId) => {
        const finalAssignedTo = resolvedId || req.body.assigned_to || null;
        db.query(
          `UPDATE telecalls SET
              customer_name=?,
              company_name=?,
              mobile_number=?,
              location_city=?,
              call_date=?,
              service_name=?,
              staff_name=?,
              call_outcome=?,
              followup_required=?,
              followup_date=?,
              followup_notes=?,
              reminder_required=?,
              reminder_date=?,
              reminder_notes=?,
              reference=?,
              gst_number=?,
              email=?,
              assigned_to=?,
              landline_number=?,
              alternate_mobile_number=?,
              reference_by=?,
              nearest_landmark=?
             WHERE id=?`,
          [
            customer_name,
            company_name || null,
            mobile_number,
            location_city,
            toDateOnly(call_date),
            service_name,
            staff_name,
            call_outcome,
            followup_required,
            toDateOnly(followup_date),
            followup_notes,
            reminder_required,
            toDateOnly(reminder_date),
            reminder_notes,
            reference,
            gst_number,
            email,
            finalAssignedTo,
            landline_number || null,
            alternate_mobile_number || null,
            reference_by || null,
            nearest_landmark || null,
            req.params.id
          ],
          (err) => {
            if (err) {
              console.error("Update error:", err);
              return res.status(500).json({ error: err.message });
            }
            syncClient(req.body, results[0].created_by || req.user.id, Number(req.params.id), req.body.teammember_id || null);
            const id = req.params.id;

            db.query(
              "INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)",
              [id, "telecall", "Status Updated", `Outcome: ${call_outcome || "New"}`]
            );

            if (followup_required === "Yes" && followup_date) {
              db.query(
                "INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)",
                [id, "telecall", "Follow-up Scheduled", `Date: ${toDateOnly(followup_date)}${followup_notes ? " | Notes: " + followup_notes : ""}`]
              );
            }

            if (reminder_required === "Yes" && reminder_date) {
              db.query(
                "INSERT INTO lead_reminders (lead_id, lead_type, reminder_date, reminder_time, reminder_notes, status, employee_id) VALUES (?,?,?,?,?,'Pending',?)",
                [id, "telecall", toDateOnly(reminder_date), toTimeOnly(req.body.reminder_time) || null, reminder_notes || "", req.user?.id || null],
                (e) => {
                  if (!e) {
                    db.query(
                      "INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)",
                      [id, "telecall", "Reminder Added", `Date: ${toDateOnly(reminder_date)}${reminder_notes ? " | " + reminder_notes : ""}`]
                    );
                  }
                }
              );
            }

            res.json({ message: "Telecall updated successfully" });
          }
        );
      });
    });
  });
});

// PATCH - partial update for quick actions (owned by any user)
router.patch("/:id", verifyToken, (req, res) => {
  const allowedFields = ["call_outcome", "followup_required", "followup_date", "followup_notes", "reminder_required", "reminder_date", "reminder_notes"];
  const updates = [];
  const params = [];
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field}=?`);
      params.push(field === "followup_date" || field === "reminder_date" || field === "call_date" ? toDateOnly(req.body[field]) : req.body[field]);
    }
  });
  if (updates.length === 0) return res.status(400).json({ message: "No valid fields to update" });
  db.query("SELECT created_by, assigned_to, staff_name FROM telecalls WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });
    if (!isAuthorizedToEdit(results[0], req.user)) return res.status(403).json({ message: "Access denied" });
    params.push(req.params.id);
    db.query(`UPDATE telecalls SET ${updates.join(", ")} WHERE id=?`, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      if (req.body.call_outcome) {
        db.query("INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)", [req.params.id, "telecall", "Status Updated", `Outcome: ${req.body.call_outcome}`]);
        // Sync client if converted
        if (req.body.call_outcome === "Converted") {
          db.query("SELECT * FROM telecalls WHERE id=?", [req.params.id], (e2, leadRows) => {
            if (!e2 && leadRows.length > 0) syncClient(leadRows[0], results[0].created_by || req.user.id, Number(req.params.id), leadRows[0].assigned_to || null);
          });
        }
      }
      if (req.body.followup_required === "Yes") {
        db.query("INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)", [req.params.id, "telecall", "Follow-up Scheduled", `Date: ${toDateOnly(req.body.followup_date) || "Today"}`]);
      }
      if (req.body.followup_required === "No") {
        db.query("INSERT INTO lead_activity (lead_id, lead_type, action, details) VALUES (?,?,?,?)", [req.params.id, "telecall", "Follow-up Completed", "Marked as done via shortcut"]);
      }
      res.json({ message: "Updated successfully" });
    });
  });
});

router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  db.query("SELECT created_by FROM telecalls WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });

    if (req.user.role !== "admin" && results[0].created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    db.query("DELETE FROM telecalls WHERE id = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json({ message: "Delete failed" });
      res.json({ message: "Telecall deleted" });
    });
  });
});

module.exports = router;
