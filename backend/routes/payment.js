const express = require("express");
const router = express.Router();
const db = require("../config/database");
const jwt = require("jsonwebtoken");

const decodeOptionalToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
  }
  next();
};

const optionalAdmin = (req, res, next) => {
  if (req.user) {
    if (req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res.status(403).json({ message: "Admin or Sub-Admin only" });
    }
  }
  next();
};

// CREATE PAYMENT
router.post("/new", decodeOptionalToken, (req, res) => {
  const { invoice_id, amount, payment_date, payment_method, Transaction_ID, invoice_email } = req.body;

  // Backend validation
  const invoiceIdNum = Number(invoice_id);
  if (!invoice_id || isNaN(invoiceIdNum) || invoiceIdNum <= 0 || !Number.isInteger(invoiceIdNum)) {
    return res.status(400).json({ message: "Invoice ID must be a valid positive integer" });
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }
  if (!payment_method) {
    return res.status(400).json({ message: "Payment method is required" });
  }
  if (Transaction_ID !== null && Transaction_ID !== undefined && Transaction_ID !== "") {
    if (!/^\d+$/.test(String(Transaction_ID))) {
      return res.status(400).json({ message: "Transaction ID must contain numbers only" });
    }
  }

  db.query(
    `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, Transaction_ID, invoice_email) VALUES (?,?,?,?,?,?)`,
    [
      invoiceIdNum,
      Number(amount),
      payment_date,
      payment_method,
      Transaction_ID ? Number(Transaction_ID) : null,
      invoice_email ? 1 : 0,
    ],
    (err, result) => {
      const newPaymentId = result.insertId;

      // Auto-trigger WhatsApp payment_received automation
      try {
        db.query(
          `SELECT c.name, c.phone, i.client_company
           FROM clientinvoices i
           JOIN clients c ON (c.company_name = i.client_company OR c.name = i.client_company)
           WHERE i.id = ? LIMIT 1`,
          [invoiceIdNum],
          (cErr, cRows) => {
            if (!cErr && cRows.length > 0 && cRows[0].phone) {
              const { triggerAutomation } = require("../services/waAutomationService");
              triggerAutomation("payment_received", {
                phone: cRows[0].phone,
                contactName: cRows[0].name,
                data: {
                  amount: Number(amount),
                  company: cRows[0].client_company
                }
              }).catch(e => console.error("WA Automation error:", e.message));

              // Emit to CRM Universal Event Bus
              try {
                const crmEventBus = require("../services/crmEventBus");
                crmEventBus.emit("payment_received", {
                  payment_id: newPaymentId,
                  invoice_id: invoiceIdNum,
                  amount: Number(amount),
                  payment_date,
                  payment_method,
                  transaction_id: Transaction_ID,
                  phone: cRows[0].phone,
                  customer_name: cRows[0].name
                });
              } catch (_) {}
            }
          }
        );
      } catch (_) {}

      res.json({ message: "Payment added", id: newPaymentId });
    }
  );
});

// GET PAYMENTS
router.get("/", decodeOptionalToken, (req, res) => {
  const { id: user_id, role } = req.user || {};
  let sql = `
    SELECT 
      p.id,
      p.invoice_id,
      DATE(p.payment_date) AS payment_date,
      p.amount,
      p.payment_method,
      p.Transaction_ID,
      p.invoice_email
    FROM payments p
  `;
  const params = [];
  if (role === 'employee') {
    sql += " JOIN clientinvoices i ON p.invoice_id = i.id WHERE i.created_by = ?";
    params.push(user_id);
  }
  sql += " ORDER BY p.id DESC";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// UPDATE
router.put("/:id", decodeOptionalToken, (req, res) => {
  const id = req.params.id;
  const { invoice_id, amount, payment_date, payment_method, Transaction_ID, invoice_email } = req.body;

  if (Transaction_ID !== null && Transaction_ID !== undefined && Transaction_ID !== "") {
    if (!/^\d+$/.test(String(Transaction_ID))) {
      return res.status(400).json({ message: "Transaction ID must contain numbers only" });
    }
  }

  db.query(
    `UPDATE payments SET invoice_id=?, amount=?, payment_date=?, payment_method=?, Transaction_ID=?, invoice_email=? WHERE id=?`,
    [Number(invoice_id), Number(amount), payment_date, payment_method, Transaction_ID ? Number(Transaction_ID) : null, invoice_email, id],
    (err) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ message: "Payment updated" });
    }
  );
});

// DELETE

router.delete("/:id", decodeOptionalToken, optionalAdmin, (req, res) => {
  db.query(
    "DELETE FROM payments WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Payment deleted" });
    }
  );
});



module.exports = router;
