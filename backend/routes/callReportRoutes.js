const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, canEditCallReport } = require("../middleware/authMiddleware");

// GET all call reports (with optional filters and scope)
router.get("/", verifyToken, (req, res) => {
  const { from, to, status, engineer, priority, payment_status, scope, customer, month, year } = req.query;
  let sql = "SELECT * FROM call_reports WHERE 1=1";
  const params = [];

  // Scope: active = only Pending, history = everything else
  if (scope === "history") {
    sql += " AND status != 'Pending'";
  } else {
    // Default active scope — only pending calls
    sql += " AND status = 'Pending'";
  }

  if (from && to) { sql += " AND report_date BETWEEN ? AND ?"; params.push(from, to); }
  else if (from) { sql += " AND report_date >= ?"; params.push(from); }
  else if (to) { sql += " AND report_date <= ?"; params.push(to); }
  if (month && year) { sql += " AND MONTH(report_date) = ? AND YEAR(report_date) = ?"; params.push(parseInt(month), parseInt(year)); }
  else if (month) { sql += " AND MONTH(report_date) = ?"; params.push(parseInt(month)); }
  else if (year) { sql += " AND YEAR(report_date) = ?"; params.push(parseInt(year)); }
  if (customer) { sql += " AND (customer_name LIKE ? OR client_name LIKE ?)"; params.push(`%${customer}%`, `%${customer}%`); }
  if (status && status !== "All") { sql += " AND status = ?"; params.push(status); }
  if (engineer && engineer !== "All") { sql += " AND (staff_name = ? OR technician = ?)"; params.push(engineer, engineer); }
  if (priority && priority !== "All") { sql += " AND priority = ?"; params.push(priority); }
  if (payment_status && payment_status !== "All") { sql += " AND payment_status = ?"; params.push(payment_status); }
  sql += " ORDER BY report_date DESC, id DESC";
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET grouped sessions
router.get("/sessions", verifyToken, (req, res) => {
  const sql = `
    SELECT 
      session_id,
      MIN(customer_name) as customer,
      MIN(mobile_number) as mobile_number,
      MIN(location_city) as location_city,
      MIN(call_type) as call_type,
      MIN(priority) as priority,
      MIN(call_referrer) as call_referrer,
      MIN(status) as status,
      MIN(payment_type) as payment_type,
      MIN(invoice_value) as invoice_value,
      MIN(payment_status) as payment_status,
      MIN(call_details) as call_details,
      MIN(duration_limit) as duration_limit,
      MIN(created_at) as created_at,
      MIN(report_date) as report_date,
      COUNT(*) as call_count,
      SUM(COALESCE(total_expenses, 0)) as total_expenses,
      SUM(COALESCE(invoice_value, 0)) as total_invoice_value
    FROM call_reports 
    GROUP BY session_id 
    ORDER BY created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET reports by session
router.get("/session/:sessionId", verifyToken, (req, res) => {
  if (req.params.sessionId.startsWith("NOSESS-")) {
    const id = req.params.sessionId.split("-")[1];
    db.query("SELECT * FROM call_reports WHERE id = ?", [id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  } else {
    db.query(
      "SELECT * FROM call_reports WHERE session_id = ? ORDER BY call_sequence ASC",
      [req.params.sessionId],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
      }
    );
  }
});

// GET single call report by ID (for Step 2 prefill)
router.get("/:id", verifyToken, (req, res) => {
  db.query("SELECT * FROM call_reports WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!results.length) return res.status(404).json({ error: "Call report not found" });
    res.json(results[0]);
  });
});

// GET staff performance stats
router.get("/performance", verifyToken, (req, res) => {
  const sql = `
    SELECT 
      staff_name,
      COUNT(*) as total_calls,
      SUM(CASE WHEN is_exceeded = 1 THEN 1 ELSE 0 END) as exceeded_calls,
      SUM(actual_duration) as total_duration,
      SUM(assigned_time) as total_assigned_time,
      ROUND((SUM(CASE WHEN is_exceeded = 0 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as performance_rating
    FROM call_reports
    GROUP BY staff_name
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET customers/clients for searchable dropdown
router.get("/customers", verifyToken, (req, res) => {
  const { q } = req.query;
  const likeQ = q ? `%${q}%` : '%';

  // Search clients table
  const clientQuery = `SELECT id, name as customer, phone as mobile_number, COALESCE(address, city) as location_city, company_name, email, gst_number FROM clients WHERE (name LIKE ? OR phone LIKE ? OR company_name LIKE ? OR email LIKE ?)`;
  const clientParams = [likeQ, likeQ, likeQ, likeQ];

  // Search customers table
  const customerQuery = `SELECT id, customer_name as customer, mobile_number, location_city, '' as company_name, email, gst_number FROM customers WHERE (customer_name LIKE ? OR mobile_number LIKE ? OR email LIKE ?)`;
  const customerParams = [likeQ, likeQ, likeQ];

  db.query(`${clientQuery} UNION ALL ${customerQuery} ORDER BY customer ASC LIMIT 100`, [...clientParams, ...customerParams], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET contracts by type for AMC/ALC auto-fill
router.get("/contracts/:type", verifyToken, (req, res) => {
  const { type } = req.params;
  const sql = `
    SELECT id, contract_title, client_company, mobile_number, location_city, email, amount_value as invoice_value, remaining, contract_type
    FROM contracts 
    WHERE contract_type = ? OR contract_type = 'Service'
    ORDER BY contract_title ASC
  `;
  db.query(sql, [type], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST — create new call report (Form 1 or Form 2)
router.post("/", verifyToken, canEditCallReport, (req, res) => {
  const c = req.body;
  
  const startMins = c.start_time ? (() => { const [h, m] = c.start_time.split(":").map(Number); return h * 60 + m; })() : 0;
  const endMins = c.end_time ? (() => { const [h, m] = c.end_time.split(":").map(Number); return h * 60 + m; })() : 0;
  const actualDuration = startMins && endMins && endMins > startMins ? endMins - startMins : 0;
  const assignedTime = c.assigned_time || c.duration_limit || 30;
  const isExceeded = actualDuration > assignedTime ? 1 : 0;
  const hasEngineer = !!(c.engineer || c.staff_name || c.technician);
  const step2Completed = hasEngineer ? 1 : (c.step2_completed || 0);

  if (c.status === "Closed" && step2Completed !== 1) {
    return res.status(400).json({ error: "Cannot close call report without completing Step 2 (Engineer Details)!" });
  }

  const sessionId = c.session_id || `SES-${Date.now()}`;
  
  const toDatetime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    return `${dateStr} ${timeStr}:00`;
  };

  const sql = `
    INSERT INTO call_reports 
    (session_id, client_name, customer_name, name, staff_name, technician, executive_name, phone, mobile_number, email, location, location_city, call_sequence,
     start_time, end_time, assigned_time, actual_duration, is_exceeded, remarks,
     report_date, complaint, description, km, petrol_charges, spare_parts_price, labour_charges, total_expenses,
     status, priority, call_type, service_type, payment_type, invoice_value, payment_status, duration_limit, contract_title,
     call_referrer, step2_completed, gst_number, company_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    sessionId,
    c.customer || c.client_name || "",
    c.customer || c.customer_name || "",
    c.customer || c.client_name || "",
    c.engineer || c.staff_name || c.technician || "",
    c.engineer || c.staff_name || c.technician || "",
    c.executive_name || "",
    c.phone || c.mobile_number || "",
    c.mobile_number || c.phone || "",
    c.email || "",
    c.location || c.location_city || "",
    c.location_city || c.location || "",
    c.call_sequence || 1,
    toDatetime(c.report_date || new Date().toISOString().split("T")[0], c.start_time),
    toDatetime(c.report_date || new Date().toISOString().split("T")[0], c.end_time),
    assignedTime,
    actualDuration,
    isExceeded,
    c.remarks || "",
    c.report_date || new Date().toISOString().split("T")[0],
    c.complaint || c.call_details || c.description || "",
    c.call_details || c.description || "",
    c.km != null ? c.km : null,
    c.petrol_charges || 0,
    c.spare_parts_price || 0,
    c.labour_charges || 0,
    (parseFloat(c.petrol_charges) || 0) + (parseFloat(c.spare_parts_price) || 0) + (parseFloat(c.labour_charges) || 0),
    c.status || "Pending",
    c.priority || "Medium",
    c.call_type || c.service_type || "AMC",
    c.service_type || (c.call_type === "AMC" || c.call_type === "ALC" ? c.call_type : "None"),
    c.payment_type || c.payment_mode || "",
    c.invoice_value || c.amount_collected || 0,
    c.payment_status || "",
    c.duration_limit || assignedTime,
    c.contract_title || "",
    c.call_referrer || "",
    step2Completed,
    c.gst_number || "",
    c.company_name || "",
  ];

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Call report created", id: result.insertId, sessionId });
  });
});

// PUT — update single call report (handles both full edit and Step 2 partial update)
router.put("/:id", verifyToken, canEditCallReport, (req, res) => {
  const { id } = req.params;
  const c = req.body;
  
  const startMins = c.start_time && typeof c.start_time === "string" && c.start_time.includes(":") 
    ? (() => { const [h, m] = c.start_time.split(":").map(Number); return (isNaN(h) || isNaN(m)) ? 0 : h * 60 + m; })() 
    : 0;
  const endMins = c.end_time && typeof c.end_time === "string" && c.end_time.includes(":") 
    ? (() => { const [h, m] = c.end_time.split(":").map(Number); return (isNaN(h) || isNaN(m)) ? 0 : h * 60 + m; })() 
    : 0;
  const actualDuration = startMins && endMins && endMins > startMins ? endMins - startMins : 0;
  const assignedTime = c.assigned_time || c.duration_limit || 30;
  const isExceeded = actualDuration > assignedTime ? 1 : 0;
  const hasEngineer = !!(c.engineer || c.staff_name || c.technician);

  // Check current step2_completed status
  db.query("SELECT step2_completed FROM call_reports WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const currentStep2 = rows.length ? rows[0].step2_completed : 0;
    // Set step2_completed=1 if engineer is assigned (Step 2 submission), unless explicitly overridden
    const newStep2 = c.step2_completed !== undefined ? (c.step2_completed ? 1 : 0) : (hasEngineer ? 1 : currentStep2);

    if (c.status === "Closed" && newStep2 !== 1) {
      return res.status(400).json({ error: "Cannot close call report without completing Step 2 (Engineer Details)!" });
    }

    const isCompleted = newStep2 === 1 && c.status === "Closed";

    const sql = `
      UPDATE call_reports SET
        client_name = ?, customer_name = ?, name = ?, staff_name = ?, technician = ?, executive_name = ?, phone = ?, mobile_number = ?, email = ?, location = ?, location_city = ?,
        start_time = ?, end_time = ?, assigned_time = ?, actual_duration = ?, is_exceeded = ?,
        remarks = ?, complaint = ?, description = ?, km = ?, petrol_charges = ?, spare_parts_price = ?,
        labour_charges = ?, total_expenses = ?, status = ?, priority = ?, call_type = ?, service_type = ?,
        payment_type = ?, invoice_value = ?, payment_status = ?, duration_limit = ?, contract_title = ?,
        call_referrer = ?, step2_completed = ?, gst_number = ?, company_name = ?,
        completed_at = ?
      WHERE id = ?
    `;
    const params = [
      c.customer || c.client_name || "", 
      c.customer || c.customer_name || "", 
      c.customer || c.client_name || "", 
      c.engineer || c.technician || c.staff_name || "", 
      c.engineer || c.technician || c.staff_name || "", 
      c.sales_person || c.executive_name || c.call_referrer || "",
      c.mobile_number || c.phone || "", 
      c.mobile_number || c.phone || "", 
      c.email || "", 
      c.location_city || c.location || "", 
      c.location_city || c.location || "",
      c.start_time || null, 
      c.end_time || null, 
      assignedTime, 
      actualDuration, 
      isExceeded,
      c.remarks || "", 
      c.call_details || c.complaint || c.description || "", 
      c.call_details || c.description || "",
      c.km !== "" && c.km != null ? parseFloat(c.km) : null,
      parseFloat(c.petrol_charges) || 0, 
      parseFloat(c.spare_parts_price) || 0, 
      parseFloat(c.labour_charges) || 0,
      (parseFloat(c.petrol_charges) || 0) + (parseFloat(c.spare_parts_price) || 0) + (parseFloat(c.labour_charges) || 0),
      c.status || "Pending", 
      c.priority || "Medium", 
      c.call_type || "AMC",
      c.service_type || (c.call_type === "AMC" || c.call_type === "ALC" ? c.call_type : "None"),
      c.payment_type || "", 
      parseFloat(c.invoice_value) || 0, 
      c.payment_status || "",
      c.duration_limit || assignedTime, 
      c.contract_title || "",
      c.call_referrer || "", 
      newStep2, 
      c.gst_number || "",
      c.company_name || "",
      isCompleted ? new Date().toISOString().slice(0, 19).replace("T", " ") : null,
      id
    ];

    db.query(sql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Updated", step2_completed: newStep2, completed_at: isCompleted ? new Date().toISOString() : null });
    });
  });
});

// DELETE call report
router.delete("/:id", verifyToken, canEditCallReport, (req, res) => {
  const userRole = req.user?.role;
  if (userRole !== "admin" && userRole !== "subadmin") {
    return res.status(403).json({ error: "Only admins can delete call reports" });
  }
  db.query("DELETE FROM call_reports WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Deleted" });
  });
});

module.exports = router;
