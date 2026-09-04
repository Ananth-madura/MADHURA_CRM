const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// CREATE INVOICE
router.post("/new", verifyToken, (req, res) => {
  const { client_company, project_names, invoice_date, invoice_duedate, category } = req.body;
  db.query(
    `INSERT INTO clientinvoices (client_company, project_names, invoice_date, invoice_duedate, category, created_by) VALUES (?,?,?,?,?,?)`,
    [client_company, project_names, invoice_date, invoice_duedate, category, req.user.id],
    (err, result) => {
      const newInvoiceId = result.insertId;

      // Auto-trigger WhatsApp invoice_created automation & CRM Event Bus
      try {
        db.query(
          "SELECT name, phone FROM clients WHERE company_name = ? OR name = ? LIMIT 1",
          [client_company, client_company],
          (cErr, cRows) => {
            const clientPhone = cRows?.[0]?.phone;
            const clientName = cRows?.[0]?.name;

            // 1. Emit on Universal CRM Event Bus
            const crmEventBus = require("../services/crmEventBus");
            crmEventBus.emit("invoice_created", {
              id: newInvoiceId,
              client_company,
              project_names,
              invoice_date,
              invoice_duedate,
              category,
              client_phone: clientPhone,
              client_name: clientName,
            });

            // 2. Trigger Rule Automations
            if (clientPhone) {
              const { triggerAutomation } = require("../services/waAutomationService");
              triggerAutomation("invoice_created", {
                phone: clientPhone,
                contactName: clientName,
                data: {
                  invoice_no: `INV-${newInvoiceId}`,
                  company: client_company,
                  due_date: invoice_duedate,
                  date: invoice_date
                }
              }).catch(e => console.error("WA Automation error:", e.message));
            }
          }
        );
      } catch (_) {}

      res.json({ message: "Invoice created", id: newInvoiceId });
    }
  );
});

// GET ALL WITH PAYMENTS
router.get("/with-payments", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  const sql = `
    SELECT i.id, i.client_company, DATE_FORMAT(i.invoice_date, '%Y-%m-%d') AS invoice_date, DATE_FORMAT(i.invoice_duedate, '%Y-%m-%d') AS invoice_duedate, i.project_names, i.category,
      IFNULL(SUM(p.amount), 0) AS paid_amount,
      (SELECT c.phone FROM clients c WHERE (c.company_name = i.client_company OR c.name = i.client_company) AND c.phone IS NOT NULL AND c.phone != '' LIMIT 1) AS client_phone,
      (SELECT c.name FROM clients c WHERE (c.company_name = i.client_company OR c.name = i.client_company) LIMIT 1) AS contact_name
    FROM clientinvoices i
    LEFT JOIN payments p ON p.invoice_id = i.id
    ${role === 'employee' ? `WHERE (
      i.created_by = ? 
      OR i.client_company IN (
        SELECT company_name FROM clients c
        WHERE c.created_by = ?
          OR c.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (c.original_lead_type = 'telecall' AND c.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (c.original_lead_type = 'walkin' AND c.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (c.original_lead_type = 'field' AND c.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )` : ''}
    GROUP BY i.id ORDER BY i.id DESC`;
  const params = role === 'employee' ? [user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id] : [];
  db.query(sql, params, (err, results) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Fetch failed" }); }
    res.json(results);
  });
});

// GET SINGLE INVOICE BY ID
router.get("/:id", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  const sql = `SELECT * FROM clientinvoices WHERE id = ? ${role === 'employee' ? `AND (
    created_by = ? 
    OR client_company IN (
      SELECT company_name FROM clients c
      WHERE c.created_by = ?
        OR c.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
        OR (c.original_lead_type = 'telecall' AND c.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
        OR (c.original_lead_type = 'walkin' AND c.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
        OR (c.original_lead_type = 'field' AND c.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
    )
  )` : ''}`;
  const params = role === 'employee' 
    ? [req.params.id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id] 
    : [req.params.id];
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: "Fetch failed" });
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json(rows[0]);
  });
});

// UPDATE INVOICE
router.put("/:id", verifyToken, (req, res) => {
  const { client_company, project_names, invoice_date, invoice_duedate, category } = req.body;
  db.query(
    `UPDATE clientinvoices SET client_company=?, project_names=?, invoice_date=?, invoice_duedate=?, category=? WHERE id=?`,
    [client_company, project_names, invoice_date, invoice_duedate, category, req.params.id],
    (err) => {
      if (err) { console.error(err); return res.status(500).json({ message: "Update failed" }); }
      res.json({ message: "Invoice updated" });
    }
  );
});

// DELETE INVOICE
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  db.query(`DELETE FROM clientinvoices WHERE id = ? AND (created_by=? OR 'admin'=?)`, [req.params.id, req.user.id, req.user.role], (err) => {
    if (err) { console.error(err); return res.status(500).json({ message: "Delete failed" }); }
    res.json({ message: "Invoice deleted" });
  });
});

module.exports = router;
