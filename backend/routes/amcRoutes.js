const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

const resolveServicePersonId = (servicePerson, callback) => {
  if (!servicePerson) return callback(null);
  const cleanName = servicePerson.trim().replace(/\s+/g, ' ');
  db.query(
    "SELECT user_id FROM teammember WHERE TRIM(CONCAT(first_name, ' ', COALESCE(last_name, ''))) = ? OR TRIM(first_name) = ? OR TRIM(last_name) = ?",
    [cleanName, cleanName, cleanName],
    (err, rows) => {
      if (err || rows.length === 0) return callback(null);
      callback(rows[0].user_id || null);
    }
  );
};

/* ================= AMC/ALC SERVICE MANAGEMENT ================= */

/* CREATE AMC/ALC SERVICE */
router.post("/amc-alc", verifyToken, (req, res) => {
  const {
    contract_id,
    service_type,
    customer_name,
    mobile_number,
    location_city,
    service_date,
    service_person,
    description,
    petrol_charges,
    spare_parts_price,
    labour_charges,
    total_expenses,
    amount_collected,
    payment_mode,
    status,
    call_number,
    breakpoints,
    duration_limit
  } = req.body;

  if (!contract_id || !service_type || !service_date) {
    return res.status(400).json({ error: "Contract ID, service type, and date are required" });
  }

  const { start_time, end_time, km, technician, sales_person, remarks } = req.body;

  resolveServicePersonId(service_person, (resolvedId) => {
    const servicePersonId = resolvedId || null;
    const sql = `
      INSERT INTO amc_alc_services
      (contract_id, service_type, customer_name, mobile_number, location_city, service_date, start_time, end_time, km, technician, sales_person, service_person, description, remarks, petrol_charges, spare_parts_price, labour_charges, total_expenses, amount_collected, payment_mode, status, call_number, breakpoints, duration_limit, service_person_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [contract_id, service_type, customer_name, mobile_number, location_city, service_date, start_time || null, end_time || null, km || null, technician || null, sales_person || null, service_person, description, remarks || null, petrol_charges || 0, spare_parts_price || 0, labour_charges || 0, total_expenses || 0, amount_collected || 0, payment_mode || null, status || "Completed", call_number || 1, breakpoints || null, duration_limit || null, servicePersonId, req.user.id],
      (err, result) => {
        if (err) {
          console.error("AMC/ALC service insert error:", err);
          return res.status(500).json({ error: "Failed to create service record" });
        }

        db.query(
          "INSERT INTO service_activity (service_id, activity_type, description) VALUES (?, ?, ?)",
          [result.insertId, "Service Created", `${service_type} service completed for ${customer_name}`]
        );

        // Auto-trigger WhatsApp automation for service_visit_scheduled
        try {
          const { triggerAutomation } = require("../services/waAutomationService");
          triggerAutomation("service_visit_scheduled", {
            phone: mobile_number,
            contactName: customer_name,
            data: {
              service: service_type,
              service_date: service_date,
              start_time: start_time || "09:00 AM",
              end_time: end_time || "06:00 PM",
              technician: technician || service_person,
              city: location_city,
              amount: amount_collected,
            }
          }).catch(() => {});
        } catch (_) {}

        res.json({ success: true, id: result.insertId });
      }
    );
  });
});

/* GET AMC/ALC SERVICES FOR CONTRACT */
router.get("/amc-alc/:contract_id", verifyToken, (req, res) => {
  const { contract_id } = req.params;
  const { id: user_id, role } = req.user;

  let sql = `
    SELECT s.* FROM amc_alc_services s
    JOIN contracts c ON s.contract_id = c.id
    WHERE s.contract_id = ?
  `;
  const params = [contract_id];

  if (role === "employee") {
    sql += " AND (s.service_person_id = ? OR s.created_by = ? OR c.created_by = ? OR c.client_company IN (SELECT company_name FROM clients WHERE assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)))";
    params.push(user_id, user_id, user_id, user_id);
  }

  sql += " ORDER BY s.service_date DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* GET ALL AMC/ALC SERVICES */
router.get("/amc-alc", verifyToken, (req, res) => {
  const { service_type, status } = req.query;
  const { id: user_id, role } = req.user;

  let sql = "SELECT s.*, c.contract_title, c.client_company FROM amc_alc_services s JOIN contracts c ON s.contract_id = c.id";
  const params = [];

  let hasWhere = false;

  if (role === "employee") {
    sql += " WHERE (s.service_person_id = ? OR s.created_by = ? OR c.created_by = ? OR c.client_company IN (SELECT company_name FROM clients WHERE assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)))";
    params.push(user_id, user_id, user_id, user_id);
    hasWhere = true;
  }

  if (service_type) {
    sql += (hasWhere ? " AND" : " WHERE") + " s.service_type = ?";
    params.push(service_type);
    hasWhere = true;
  }

  if (status) {
    sql += (hasWhere ? " AND" : " WHERE") + " s.status = ?";
    params.push(status);
  }

  sql += " ORDER BY s.service_date DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* UPDATE AMC/ALC SERVICE */
router.put("/amc-alc/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const {
    service_type,
    customer_name,
    mobile_number,
    location_city,
    service_date,
    start_time,
    end_time,
    km,
    technician,
    sales_person,
    service_person,
    description,
    remarks,
    petrol_charges,
    spare_parts_price,
    labour_charges,
    total_expenses,
    amount_collected,
    payment_mode,
    status,
    call_number,
    breakpoints,
    duration_limit
  } = req.body;

  resolveServicePersonId(service_person, (resolvedId) => {
    const servicePersonId = resolvedId || null;
    db.query(
      `UPDATE amc_alc_services SET
        service_type = ?,
        customer_name = ?,
        mobile_number = ?,
        location_city = ?,
        service_date = ?,
        start_time = ?,
        end_time = ?,
        km = ?,
        technician = ?,
        sales_person = ?,
        service_person = ?,
        description = ?,
        remarks = ?,
        petrol_charges = ?,
        spare_parts_price = ?,
        labour_charges = ?,
        total_expenses = ?,
        amount_collected = ?,
        payment_mode = ?,
        status = ?,
        call_number = ?,
        breakpoints = ?,
        duration_limit = ?,
        service_person_id = ?
       WHERE id = ?`,
      [service_type, customer_name, mobile_number, location_city, service_date, start_time || null, end_time || null, km || null, technician || null, sales_person || null, service_person, description, remarks || null, petrol_charges || 0, spare_parts_price || 0, labour_charges || 0, total_expenses || 0, amount_collected || 0, payment_mode || null, status, call_number || 1, breakpoints || null, duration_limit || null, servicePersonId, id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Log activity
        db.query(
          "INSERT INTO service_activity (service_id, activity_type, description) VALUES (?, ?, ?)",
          [id, "Service Updated", `Service updated: ${description}`]
        );

        res.json({ message: "Service updated" });
      }
    );
  });
});

/* DELETE AMC/ALC SERVICE */
router.delete("/amc-alc/:id", verifyToken, isAdmin, (req, res) => {
  db.query("DELETE FROM amc_alc_services WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Service deleted" });
  });
});

/* ================= SERVICE EXPENSES REPORT ================= */

/* GET EXPENSES REPORT */
router.get("/expenses", verifyToken, (req, res) => {
  const { start_date, end_date, service_type } = req.query;

  let sql = `
    SELECT
      service_date,
      service_type,
      service_person,
      SUM(petrol_charges) as total_petrol,
      SUM(spare_parts_price) as total_spare_parts,
      SUM(labour_charges) as total_labour,
      SUM(total_expenses) as total_expenses,
      COUNT(*) as total_services
    FROM amc_alc_services
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    sql += " AND service_date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND service_date <= ?";
    params.push(end_date);
  }

  if (service_type) {
    sql += " AND service_type = ?";
    params.push(service_type);
  }

  sql += " GROUP BY service_date, service_type, service_person ORDER BY service_date DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* GET SERVICE PERSON PERFORMANCE */
router.get("/person-performance", verifyToken, (req, res) => {
  const { start_date, end_date } = req.query;

  let sql = `
    SELECT
      service_person,
      COUNT(*) as total_services,
      SUM(petrol_charges) as total_petrol,
      SUM(spare_parts_price) as total_spare_parts,
      SUM(labour_charges) as total_labour,
      SUM(total_expenses) as total_expenses,
      AVG(total_expenses) as avg_expenses_per_service
    FROM amc_alc_services
    WHERE service_person IS NOT NULL AND service_person != ''
  `;
  const params = [];

  if (start_date) {
    sql += " AND service_date >= ?";
    params.push(start_date);
  }

  if (end_date) {
    sql += " AND service_date <= ?";
    params.push(end_date);
  }

  sql += " GROUP BY service_person ORDER BY total_services DESC";

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* ================= SERVICE ACTIVITY LOG ================= */
router.get("/activity", verifyToken, (req, res) => {
  db.query(
    "SELECT * FROM service_activity ORDER BY created_at DESC LIMIT 50",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;