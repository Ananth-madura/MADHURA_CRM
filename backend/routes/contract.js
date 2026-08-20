const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

/* CREATE CONTRACT - Full form with all fields */
router.post("/new", verifyToken, (req, res) => {
  const {
    client_company,
    contract_title,
    start_date,
    end_date,
    amount_value,
    service_type,
    mobile_number,
    location_city,
    email,
    quotation_id
  } = req.body;

  const trimmedCompany = (client_company || "").trim();
  const trimmedTitle = (contract_title || "").trim();
  const parsedAmount = parseFloat(amount_value);
  const trimmedServiceType = (service_type || "").trim();

  if (!trimmedCompany || !trimmedTitle || isNaN(parsedAmount) || parsedAmount < 0 || !trimmedServiceType) {
    return res.status(400).json({ message: "Client company, contract title, amount, and service type are required" });
  }

  const sql = `
    INSERT INTO contracts
    (client_company, contract_title, start_date, end_date, amount_value, contract_type, mobile_number, location_city, email, quotation_id, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      trimmedCompany,
      trimmedTitle,
      start_date || new Date().toISOString().slice(0, 10),
      end_date || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
      parsedAmount,
      trimmedServiceType,
      mobile_number || null,
      location_city || null,
      email || null,
      quotation_id || null,
      req.user.id
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Insert failed: " + err.message });
      }

      // DISABLED: Old notification system
      /*
      const notificationIO = getNotificationIO();
      if (notificationIO) {
        const time = new Date().toLocaleString();
        notificationIO.emitNotification("contract_created", {
          id: result.insertId,
          clientName: client_company,
          contractTitle: contract_title,
          amountValue: amount_value,
          serviceType: service_type,
          createdAt: time,
          type: "contract"
        }, null, true);
      }
      */
      // Auto-trigger WhatsApp automation for amc_created
      try {
        const { triggerAutomation } = require("../services/waAutomationService");
        triggerAutomation("amc_created", {
          phone: mobile_number,
          contactName: trimmedCompany,
          data: {
            service: trimmedServiceType,
            amc_contract_no: `AMC-${result.insertId}`,
            amount: parsedAmount,
            start_date: start_date,
            end_date: end_date,
            due_date: end_date,
            city: location_city,
            company: trimmedCompany,
          }
        }).catch(() => {});
      } catch (_) {}

      res.json({ success: true, id: result.insertId });
    }
  );
});

/* GET CONTRACTS BY SERVICE TYPE */
router.get("/by-type/:type", verifyToken, (req, res) => {
  const { type } = req.params;
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM contracts WHERE 1=1";
  const params = [];

  if (type && type !== "None") {
    sql += " AND contract_type = ?";
    params.push(type);
  }

  if (role === "employee") {
    sql += ` AND (
      c.created_by = ?
      OR c.client_company IN (
        SELECT company_name FROM clients cl
        WHERE cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }

  sql += " ORDER BY id DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* FETCH */
router.get("/", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM contracts";
  const params = [];

  if (role === "employee") {
    sql += ` WHERE (
      c.created_by = ?
      OR c.client_company IN (
        SELECT company_name FROM clients cl
        WHERE cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }

  sql += " ORDER BY id DESC";
  
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

/* UPDATE */
router.put("/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const {
    client_company,
    template_names,
    contract_title,
    start_date,
    end_date,
    amount_value,
    category,
    contract_type,
    quotation_id,
    mobile_number,
    location_city,
    email,
  } = req.body;

  const parsedAmount = amount_value !== undefined ? parseFloat(amount_value) : null;

  db.query(
    `UPDATE contracts SET
      client_company=?,
      template_names=?,
      contract_title=?,
      start_date=?,
      end_date=?,
      amount_value=?,
      category=?,
      contract_type=?,
      quotation_id=?,
      mobile_number=?,
      location_city=?,
      email=?
     WHERE id=?`,
    [client_company || null, template_names || null, contract_title || null, start_date || null, end_date || null, parsedAmount, category || "Default", contract_type || "Service", quotation_id || null, mobile_number || null, location_city || null, email || null, id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Updated" });
    }
  );
});

/* DELETE */
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  db.query("DELETE FROM contracts WHERE id=? AND (created_by=? OR 'admin'=?)", [req.params.id, req.user.id, req.user.role], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted" });
  });
});

/* GET ALL CONTRACTS WITH USAGE SUMMARY */
router.get("/with-usage", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT
      c.*,
      COALESCE(SUM(s.total_expenses), 0) as used_total,
      COUNT(s.id) as service_count,
      u.first_name AS creator_name
    FROM contracts c
    LEFT JOIN amc_alc_services s ON c.id = s.contract_id
    LEFT JOIN users u ON u.id = c.created_by`;
  
  const params = [];
  if (role === "employee") {
    sql += ` WHERE (
      c.created_by = ?
      OR c.client_company IN (
        SELECT company_name FROM clients cl
        WHERE cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }

  sql += ` GROUP BY c.id, u.first_name ORDER BY c.id DESC`;

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const contracts = rows.map(c => ({
      ...c,
      remaining: parseFloat(c.amount_value) - parseFloat(c.used_total || 0)
    }));
    res.json(contracts);
  });
});

/* GET CONTRACT WITH USAGE SUMMARY */
router.get("/usage/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const { id: user_id, role } = req.user;

  let sql = `
    SELECT
      c.*,
      COALESCE(SUM(s.petrol_charges), 0) as used_petrol,
      COALESCE(SUM(s.spare_parts_price), 0) as used_spare_parts,
      COALESCE(SUM(s.labour_charges), 0) as used_labour,
      COALESCE(SUM(s.total_expenses), 0) as used_total,
      COUNT(s.id) as service_count
    FROM contracts c
    LEFT JOIN amc_alc_services s ON c.id = s.contract_id
    WHERE c.id = ?`;
  
  const params = [id];
  if (role === "employee") {
    sql += ` AND (
      c.created_by = ?
      OR c.client_company IN (
        SELECT company_name FROM clients cl
        WHERE cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }

  sql += " GROUP BY c.id";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ error: "Contract not found" });
    const contract = rows[0];
    contract.remaining = parseFloat(contract.amount_value) - parseFloat(contract.used_total);
    res.json(contract);
  });
});

module.exports = router;
