const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin, canEditCallReport } = require("../middleware/authMiddleware");

// ── Helper: parse "HH:MM" → minutes since midnight (returns 0 if invalid) ──
const toMins = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
};

// ── Helper: compute duration fields ─────────────────────────────────────────
const calcDuration = (startTime, endTime, assignedTime) => {
  if (!startTime || !endTime) return { actual: 0, isExceeded: 0 };
  const startMins = toMins(startTime);
  const endMins = toMins(endTime);
  let actual = endMins - startMins;
  if (actual < 0) {
    actual += 24 * 60; // handles cross-midnight
  }
  const isExceeded = actual > assignedTime ? 1 : 0;
  return { actual, isExceeded };
};

// ── GET all call reports (with optional filters and scope) ───────────────────
router.get("/", verifyToken, (req, res) => {
  const { from, to, status, engineer, priority, payment_status, scope, customer, month, year } = req.query;
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM call_reports WHERE 1=1";
  const params = [];

  // Scope: active = Pending + Live + Observation; history = only Closed
  if (scope === "history") {
    sql += " AND status = 'Closed'";
  } else {
    sql += " AND status IN ('Pending', 'Live', 'Observation')";
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

  if (role === "employee") {
    sql += ` AND (
      created_by = ? 
      OR customer_id IN (
        SELECT cust.id FROM customers cust
        LEFT JOIN clients cl ON (cl.phone = cust.mobile_number AND cust.mobile_number IS NOT NULL AND cust.mobile_number != '') 
          OR (cl.email = cust.email AND cust.email IS NOT NULL AND cust.email != '') 
          OR (cl.name = cust.customer_name AND cust.customer_name IS NOT NULL AND cust.customer_name != '')
        WHERE 
          cust.created_by = ?
          OR cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
          OR cl.id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }

  sql += " ORDER BY report_date DESC, id DESC";

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ── GET grouped sessions ─────────────────────────────────────────────────────
router.get("/sessions", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = `
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
  `;
  const params = [];
  if (role === "employee") {
    sql += ` WHERE (
      created_by = ? 
      OR customer_id IN (
        SELECT cust.id FROM customers cust
        LEFT JOIN clients cl ON (cl.phone = cust.mobile_number AND cust.mobile_number IS NOT NULL AND cust.mobile_number != '') 
          OR (cl.email = cust.email AND cust.email IS NOT NULL AND cust.email != '') 
          OR (cl.name = cust.customer_name AND cust.customer_name IS NOT NULL AND cust.customer_name != '')
        WHERE 
          cust.created_by = ?
          OR cl.created_by = ?
          OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
          OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
          OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      )
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }
  sql += `
    GROUP BY session_id 
    ORDER BY created_at DESC
  `;
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ── GET reports by session ───────────────────────────────────────────────────
router.get("/session/:sessionId", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  if (req.params.sessionId.startsWith("NOSESS-")) {
    const id = req.params.sessionId.split("-")[1];
    let sql = "SELECT * FROM call_reports WHERE id = ?";
    const params = [id];
    if (role === "employee") {
      sql += ` AND (
        created_by = ? 
        OR customer_id IN (
          SELECT cust.id FROM customers cust
          LEFT JOIN clients cl ON (cl.phone = cust.mobile_number AND cust.mobile_number IS NOT NULL AND cust.mobile_number != '') 
            OR (cl.email = cust.email AND cust.email IS NOT NULL AND cust.email != '') 
            OR (cl.name = cust.customer_name AND cust.customer_name IS NOT NULL AND cust.customer_name != '')
          WHERE 
            cust.created_by = ?
            OR cl.created_by = ?
            OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
            OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
            OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
            OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
            OR cl.id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
        )
      )`;
      params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
    }
    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  } else {
    let sql = "SELECT * FROM call_reports WHERE session_id = ?";
    const params = [req.params.sessionId];
    if (role === "employee") {
      sql += ` AND (
        created_by = ? 
        OR customer_id IN (
          SELECT cust.id FROM customers cust
          LEFT JOIN clients cl ON (cl.phone = cust.mobile_number AND cust.mobile_number IS NOT NULL AND cust.mobile_number != '') 
            OR (cl.email = cust.email AND cust.email IS NOT NULL AND cust.email != '') 
            OR (cl.name = cust.customer_name AND cust.customer_name IS NOT NULL AND cust.customer_name != '')
          WHERE 
            cust.created_by = ?
            OR cl.created_by = ?
            OR cl.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
            OR (cl.original_lead_type = 'telecall' AND cl.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
            OR (cl.original_lead_type = 'walkin' AND cl.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
            OR (cl.original_lead_type = 'field' AND cl.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
            OR cl.id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
        )
      )`;
      params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
    }
    sql += " ORDER BY call_sequence ASC";
    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  }
});

// ── GET staff performance stats (comprehensive, with filters) ────────────────
router.get("/performance", verifyToken, (req, res) => {
  const { from, to, month, year, engineer } = req.query;
  const { id: user_id, role } = req.user;

  let where = "WHERE staff_name IS NOT NULL AND staff_name != ''";
  const params = [];

  const executeQuery = () => {
    if (from && to) { where += " AND report_date BETWEEN ? AND ?"; params.push(from, to); }
    else if (from) { where += " AND report_date >= ?"; params.push(from); }
    else if (to)   { where += " AND report_date <= ?"; params.push(to); }

    if (month && year) { where += " AND MONTH(report_date) = ? AND YEAR(report_date) = ?"; params.push(parseInt(month), parseInt(year)); }
    else if (month) { where += " AND MONTH(report_date) = ?"; params.push(parseInt(month)); }
    else if (year)  { where += " AND YEAR(report_date) = ?"; params.push(parseInt(year)); }

    if (engineer && engineer !== "All") { where += " AND (staff_name = ? OR technician = ?)"; params.push(engineer, engineer); }

    const sql = `
      SELECT
        COALESCE(staff_name, technician) AS engineer_name,
        COUNT(*)                                                       AS total_calls,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END)            AS closed_calls,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END)           AS pending_calls,
        SUM(CASE WHEN status = 'Live' THEN 1 ELSE 0 END)              AS live_calls,
        SUM(CASE WHEN status = 'Observation' THEN 1 ELSE 0 END)       AS observation_calls,
        COALESCE(SUM(COALESCE(km, 0)), 0)                              AS total_km,
        COALESCE(SUM(COALESCE(petrol_charges, 0)), 0)                  AS total_petrol,
        COALESCE(SUM(COALESCE(spare_parts_price, 0)), 0)              AS total_spare_parts,
        COALESCE(SUM(COALESCE(labour_charges, 0)), 0)                  AS total_labour,
        COALESCE(SUM(COALESCE(delivery_project_work, 0)), 0)           AS total_delivery_project_work,
        COALESCE(SUM(COALESCE(total_expenses, 0)), 0)                  AS total_expenses,
        COALESCE(SUM(COALESCE(invoice_value, 0)), 0)                   AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'Collected' THEN COALESCE(invoice_value, 0) ELSE 0 END), 0) AS collected_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN COALESCE(invoice_value, 0) ELSE 0 END), 0)   AS pending_revenue,
        COALESCE(SUM(COALESCE(actual_duration, 0)), 0)                 AS total_minutes,
        SUM(CASE WHEN is_exceeded = 1 THEN 1 ELSE 0 END)              AS exceeded_calls,
        ROUND(COALESCE(SUM(COALESCE(actual_duration, 0)), 0) / 60, 2) AS total_hours,
        ROUND(AVG(COALESCE(actual_duration, 0)), 1)                    AS avg_duration_per_call,
        ROUND((SUM(CASE WHEN is_exceeded = 0 THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1)) * 100, 1) AS on_time_rate
      FROM call_reports
      ${where}
      GROUP BY COALESCE(staff_name, technician)
      ORDER BY total_calls DESC
    `;

    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      // Compute derived fields per engineer
      const engineers = (results || []).map(r => {
        const totalHours = parseFloat(r.total_hours) || 0;
        const totalCalls = parseInt(r.total_calls) || 0;
        const callsPerHour = totalHours > 0 ? parseFloat((totalCalls / totalHours).toFixed(2)) : 0;
        const profit = parseFloat(r.total_revenue) - parseFloat(r.total_expenses);
        const profitMargin = parseFloat(r.total_revenue) > 0
          ? parseFloat(((profit / parseFloat(r.total_revenue)) * 100).toFixed(1))
          : 0;
        return {
          ...r,
          total_km: parseFloat(r.total_km) || 0,
          total_petrol: parseFloat(r.total_petrol) || 0,
          total_spare_parts: parseFloat(r.total_spare_parts) || 0,
          total_labour: parseFloat(r.total_labour) || 0,
          total_delivery_project_work: parseFloat(r.total_delivery_project_work) || 0,
          total_expenses: parseFloat(r.total_expenses) || 0,
          total_revenue: parseFloat(r.total_revenue) || 0,
          collected_revenue: parseFloat(r.collected_revenue) || 0,
          pending_revenue: parseFloat(r.pending_revenue) || 0,
          total_hours: totalHours,
          avg_duration_per_call: parseFloat(r.avg_duration_per_call) || 0,
          on_time_rate: parseFloat(r.on_time_rate) || 0,
          calls_per_hour: callsPerHour,
          profit,
          profit_margin: profitMargin,
        };
      });

      // Summary totals
      const summary = {
        total_engineers: engineers.length,
        total_calls: engineers.reduce((s, e) => s + (parseInt(e.total_calls) || 0), 0),
        closed_calls: engineers.reduce((s, e) => s + (parseInt(e.closed_calls) || 0), 0),
        pending_calls: engineers.reduce((s, e) => s + (parseInt(e.pending_calls) || 0), 0),
        total_km: parseFloat(engineers.reduce((s, e) => s + e.total_km, 0).toFixed(1)),
        total_petrol: parseFloat(engineers.reduce((s, e) => s + e.total_petrol, 0).toFixed(2)),
        total_spare_parts: parseFloat(engineers.reduce((s, e) => s + e.total_spare_parts, 0).toFixed(2)),
        total_labour: parseFloat(engineers.reduce((s, e) => s + e.total_labour, 0).toFixed(2)),
        total_delivery_project_work: parseFloat(engineers.reduce((s, e) => s + e.total_delivery_project_work, 0).toFixed(2)),
        total_expenses: parseFloat(engineers.reduce((s, e) => s + e.total_expenses, 0).toFixed(2)),
        total_revenue: parseFloat(engineers.reduce((s, e) => s + e.total_revenue, 0).toFixed(2)),
        collected_revenue: parseFloat(engineers.reduce((s, e) => s + e.collected_revenue, 0).toFixed(2)),
        pending_revenue: parseFloat(engineers.reduce((s, e) => s + e.pending_revenue, 0).toFixed(2)),
        total_hours: parseFloat(engineers.reduce((s, e) => s + e.total_hours, 0).toFixed(2)),
        avg_duration_per_call: engineers.length > 0 ? parseFloat((engineers.reduce((s, e) => s + e.avg_duration_per_call, 0) / engineers.length).toFixed(1)) : 0,
        on_time_rate: engineers.length > 0 ? parseFloat((engineers.reduce((s, e) => s + e.on_time_rate, 0) / engineers.length).toFixed(1)) : 0
      };

      res.json({ engineers, summary });
    });
  };

  if (role === "employee") {
    db.query("SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) as full_name, first_name FROM teammember WHERE user_id = ? LIMIT 1", [user_id], (err, nameRows) => {
      const full_name = nameRows && nameRows.length ? nameRows[0].full_name : req.user.name;
      const first_name = nameRows && nameRows.length ? nameRows[0].first_name : req.user.name;
      where += " AND (staff_name = ? OR staff_name = ? OR technician = ? OR technician = ?)";
      params.push(full_name, first_name, full_name, first_name);
      executeQuery();
    });
  } else {
    executeQuery();
  }
});

// ── GET customers/clients for searchable dropdown ────────────────────────────
router.get("/customers", verifyToken, (req, res) => {
  const { q } = req.query;
  const likeQ = q ? `%${q}%` : "%";
  let clientQuery = `SELECT id, name as customer, phone as mobile_number, COALESCE(city, address) as location_city, company_name, email, gst_number FROM clients WHERE (name LIKE ? OR phone LIKE ? OR company_name LIKE ? OR email LIKE ?)`;
  const clientParams = [likeQ, likeQ, likeQ, likeQ];
  
  if (req.user.role === "employee") {
    clientQuery += ` AND (
      created_by = ? 
      OR assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
      OR (original_lead_type = 'telecall' AND original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'walkin' AND original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'field' AND original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      OR id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
    )`;
    clientParams.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }

  let customerQuery = `SELECT id, customer_name as customer, mobile_number, location_city, '' as company_name, email, gst_number FROM customers WHERE (customer_name LIKE ? OR mobile_number LIKE ? OR email LIKE ?)`;
  const customerParams = [likeQ, likeQ, likeQ];

  if (req.user.role === "employee") {
    customerQuery += ` AND (
      created_by = ? 
      OR mobile_number IN (SELECT phone FROM clients WHERE created_by = ? OR assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?) OR id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?)))
      OR email IN (SELECT email FROM clients WHERE created_by = ? OR assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?) OR id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?)))
    )`;
    customerParams.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }

  db.query(`${clientQuery} UNION ALL ${customerQuery} ORDER BY customer ASC LIMIT 100`, [...clientParams, ...customerParams], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ── GET contracts by type for AMC/ALC auto-fill ──────────────────────────────
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

// ── GET single call report by ID ─────────────────────────────────────────────
router.get("/:id", verifyToken, (req, res) => {
  db.query("SELECT * FROM call_reports WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!results.length) return res.status(404).json({ error: "Call report not found" });
    res.json(results[0]);
  });
});

// ── POST — create new call report (Form 1 — all fields including duration) ───
router.post("/", verifyToken, canEditCallReport, (req, res) => {
  const c = req.body;
  const pad2 = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}`;
  const reportDate = c.report_date || today;
  const sessionId = c.session_id || `SES-${Date.now()}`;

  const assignedTime = c.duration_limit ||
    (c.duration === "1hr" ? 60 : c.duration === "1.5hr" ? 90 : c.duration === "2hr" ? 120 : c.assigned_time || 30);

  // Extract plain HH:MM from incoming value (may come as "HH:MM" or "HH:MM:SS")
  const cleanTime = (t) => {
    if (!t) return null;
    return String(t).slice(0, 5) || null; // "HH:MM"
  };
  const startTimeRaw = cleanTime(c.start_time);
  const endTimeRaw   = cleanTime(c.end_time);

  const { actual: actualDuration, isExceeded } = calcDuration(startTimeRaw, endTimeRaw, assignedTime);
  const hasEngineer = !!(c.engineer || c.staff_name || c.technician);
  const step2Completed = hasEngineer ? 1 : (c.step2_completed || 0);

  if (c.status === "Closed" && step2Completed !== 1) {
    return res.status(400).json({ error: "Cannot close call report without completing Step 2 (Engineer Details)!" });
  }

  if (["Live", "Observation", "Closed"].includes(c.status) && !hasEngineer) {
    return res.status(400).json({ error: "Engineer is required when status is Live, Observation, or Closed!" });
  }

  const PAYMENT_FREE_TYPES = ["Delivery Calls", "Project Work"];
  const isPaymentFree = PAYMENT_FREE_TYPES.includes(c.delivery_call_type) || PAYMENT_FREE_TYPES.includes(c.call_type);

  if (c.status === "Closed" && !isPaymentFree) {
    if ((c.payment_status || "Pending") !== "Collected") {
      return res.status(400).json({ error: "Cannot close call report unless payment is Collected!" });
    }
  }

  const totalExpenses =
    (parseFloat(c.petrol_charges) || 0) +
    (parseFloat(c.spare_parts_price) || 0) +
    (parseFloat(c.labour_charges) || 0) +
    (parseFloat(c.delivery_project_work) || 0);

  // Compute travel duration from travel_start_time and travel_reach_time
  const travelStartRaw = cleanTime(c.travel_start_time);
  const travelReachRaw = cleanTime(c.travel_reach_time);
  let travelDuration = null;
  if (travelStartRaw && travelReachRaw) {
    const diff = toMins(travelReachRaw) - toMins(travelStartRaw);
    travelDuration = diff < 0 ? diff + 24 * 60 : diff;
  }

  const sql = `
    INSERT INTO call_reports (
      session_id, call_sequence,
      customer_id, customer_name, client_name, name,
      mobile_number, phone, email, location_city, location,
      gst_number, company_name,
      staff_name, technician, executive_name,
      call_type, service_type, contract_title, call_referrer,
      call_details, complaint, description,
      priority, status, report_date,
      start_time, end_time, assigned_time, actual_duration, duration_limit, is_exceeded,
      travel_start_time, travel_reach_time, travel_duration,
      km, petrol_charges, spare_parts_price, labour_charges, delivery_call_type, delivery_project_work, total_expenses,
      payment_type, invoice_value, payment_status,
      remarks, step2_completed, created_by
    ) VALUES (
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )
  `;

  const customerName = c.customer || c.customer_name || c.client_name || "";

  db.query(
    "SELECT COUNT(*) as prevCount FROM call_reports WHERE customer_name = ?",
    [customerName],
    (err, countResult) => {
      if (err) return res.status(500).json({ error: "Failed to determine call sequence: " + err.message });
      const sequence = (countResult && countResult[0] && countResult[0].prevCount || 0) + 1;

      const params = [
        sessionId,
        sequence,
        c.customer_id || null,
        customerName,
        customerName,
        customerName,
        c.mobile_number || c.phone || "",
        c.phone || c.mobile_number || "",
        c.email || "",
        c.location_city || c.location || "",
        c.location || c.location_city || "",
        c.gst_number || "",
        c.company_name || "",
        c.engineer || c.staff_name || c.technician || "",
        c.engineer || c.technician || c.staff_name || "",
        c.executive_name || "",
        c.call_type || c.service_type || "",
        c.service_type || (c.call_type === "AMC" || c.call_type === "ALC" ? c.call_type : "None"),
        c.contract_title || "",
        c.call_referrer || "",
        c.call_details || c.complaint || c.description || "",
        c.call_details || c.complaint || c.description || "",
        c.call_details || c.description || "",
        c.priority || "Medium",
        c.status || "Pending",
        reportDate,
        startTimeRaw,
        endTimeRaw,
        assignedTime,
        actualDuration,
        assignedTime,
        isExceeded,
        travelStartRaw,
        travelReachRaw,
        travelDuration,
        c.km != null && c.km !== "" ? parseFloat(c.km) : null,
        parseFloat(c.petrol_charges) || 0,
        parseFloat(c.spare_parts_price) || 0,
        parseFloat(c.labour_charges) || 0,
        c.delivery_call_type || "",
        parseFloat(c.delivery_project_work) || 0,
        totalExpenses,
        c.payment_type || c.payment_mode || "",
        parseFloat(c.invoice_value) || parseFloat(c.amount_collected) || 0,
        c.payment_status || "Pending",
        c.remarks || "",
        step2Completed,
        req.user?.id || null,
      ];

      db.query(sql, params, (err, result) => {
        if (err) {
          console.error("POST /call-reports error:", err.message);
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Call report created successfully", id: result.insertId, sequence });
      });
    });
});

// ── PUT — update call report (full edit OR Step 2 partial update) ────────────
router.put("/:id", verifyToken, canEditCallReport, (req, res) => {
  const { id } = req.params;
  const c = req.body;

  const cleanTime = (t) => {
    if (!t) return null;
    const s = String(t);
    // Handle "HH:MM", "HH:MM:SS", or datetime "YYYY-MM-DD HH:MM:SS"
    const timePart = s.includes(" ") ? s.split(" ")[1] : s;
    return timePart.slice(0, 5) || null;
  };

  const startTimeRaw = cleanTime(c.start_time);
  const endTimeRaw   = cleanTime(c.end_time);

  const assignedTime = c.duration_limit ||
    (c.duration === "1hr" ? 60 : c.duration === "1.5hr" ? 90 : c.duration === "2hr" ? 120 : c.assigned_time || 30);

  const { actual: actualDuration, isExceeded } = calcDuration(startTimeRaw, endTimeRaw, assignedTime);
  const hasEngineer = !!(c.engineer || c.staff_name || c.technician);

  // Fetch current row to merge missing fields
  db.query("SELECT step2_completed, call_reports.* FROM call_reports WHERE id = ?", [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.status(404).json({ error: "Call report not found" });

    const current = rows[0];
    const currentStep2 = current.step2_completed || 0;
    const newStep2 = c.step2_completed !== undefined
      ? (c.step2_completed ? 1 : 0)
      : (hasEngineer ? 1 : currentStep2);

    if (c.status === "Closed" && newStep2 !== 1) {
      return res.status(400).json({ error: "Cannot close call report without completing Step 2 (Engineer Details)!" });
    }

    const finalStatus = c.status !== undefined ? c.status : current.status;
    const finalEngineer = c.engineer || c.staff_name || c.technician || current.staff_name || current.technician;
    if (["Live", "Observation", "Closed"].includes(finalStatus) && !finalEngineer) {
      return res.status(400).json({ error: "Engineer is required when status is Live, Observation, or Closed!" });
    }

    if (c.status === "Closed") {

      const startTime = c.start_time !== undefined ? c.start_time : current.start_time;
      const endTime = c.end_time !== undefined ? c.end_time : current.end_time;
      const km = c.km !== undefined ? c.km : current.km;
      const petrol = c.petrol_charges !== undefined ? c.petrol_charges : current.petrol_charges;
      const spare = c.spare_parts_price !== undefined ? c.spare_parts_price : current.spare_parts_price;
      const labour = c.labour_charges !== undefined ? c.labour_charges : current.labour_charges;

      if (!startTime || !String(startTime).trim()) {
        return res.status(400).json({ error: "Start Time is required to close the call!" });
      }
      if (!endTime || !String(endTime).trim()) {
        return res.status(400).json({ error: "End Time is required to close the call!" });
      }
      if (km === undefined || km === null || String(km).trim() === "") {
        return res.status(400).json({ error: "Kilometers (KM) is required to close the call!" });
      }
      if (petrol === undefined || petrol === null || String(petrol).trim() === "") {
        return res.status(400).json({ error: "Petrol charges is required to close the call!" });
      }
      if (spare === undefined || spare === null || String(spare).trim() === "") {
        return res.status(400).json({ error: "Spare parts price is required to close the call!" });
      }
      if (labour === undefined || labour === null || String(labour).trim() === "") {
        return res.status(400).json({ error: "Labour charges is required to close the call!" });
      }
    }

    // Allow "Delivery Calls" and "Project Work" to be closed without payment collected
    const PAYMENT_FREE_TYPES = ["Delivery Calls", "Project Work"];
    const isPaymentFree = PAYMENT_FREE_TYPES.includes(c.delivery_call_type) ||
                          PAYMENT_FREE_TYPES.includes(current.delivery_call_type) ||
                          PAYMENT_FREE_TYPES.includes(c.call_type) ||
                          PAYMENT_FREE_TYPES.includes(current.call_type);

    if (c.status === "Closed" && !isPaymentFree) {
      const paymentStatus = c.payment_status || current.payment_status || "Pending";
      if (paymentStatus !== "Collected") {
        return res.status(400).json({ error: "Cannot close call report unless payment is Collected!" });
      }
    }

    const isCompleted = newStep2 === 1 && c.status === "Closed";
    const completedAt = isCompleted ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

    const totalExpenses =
      (c.petrol_charges !== undefined ? (parseFloat(c.petrol_charges) || 0) : (parseFloat(current.petrol_charges) || 0)) +
      (c.spare_parts_price !== undefined ? (parseFloat(c.spare_parts_price) || 0) : (parseFloat(current.spare_parts_price) || 0)) +
      (c.labour_charges !== undefined ? (parseFloat(c.labour_charges) || 0) : (parseFloat(current.labour_charges) || 0)) +
      (c.delivery_project_work !== undefined ? (parseFloat(c.delivery_project_work) || 0) : (parseFloat(current.delivery_project_work) || 0));

    const customerName = c.customer || c.customer_name || c.client_name || current.customer_name || "";

    // Compute travel duration
    const travelStartRaw2 = cleanTime(c.travel_start_time);
    const travelReachRaw2 = cleanTime(c.travel_reach_time);
    let travelDuration2 = null;
    if (travelStartRaw2 && travelReachRaw2) {
      const diff = toMins(travelReachRaw2) - toMins(travelStartRaw2);
      travelDuration2 = diff < 0 ? diff + 24 * 60 : diff;
    } else if (current.travel_start_time && current.travel_reach_time && !travelStartRaw2 && !travelReachRaw2) {
      // preserve existing travel duration if not updating travel fields
      travelDuration2 = current.travel_duration;
    }

    const sql = `
      UPDATE call_reports SET
        customer_id      = ?,
        customer_name    = ?,
        client_name      = ?,
        name             = ?,
        mobile_number    = ?,
        phone            = ?,
        email            = ?,
        location_city    = ?,
        location         = ?,
        gst_number       = ?,
        company_name     = ?,
        staff_name       = ?,
        technician       = ?,
        executive_name   = ?,
        call_type        = ?,
        service_type     = ?,
        contract_title   = ?,
        call_referrer    = ?,
        call_details     = ?,
        complaint        = ?,
        description      = ?,
        priority         = ?,
        status           = ?,
        report_date      = ?,
        start_time       = ?,
        end_time         = ?,
        assigned_time    = ?,
        actual_duration  = ?,
        duration_limit   = ?,
        is_exceeded      = ?,
        travel_start_time = ?,
        travel_reach_time = ?,
        travel_duration  = ?,
        km               = ?,
        petrol_charges   = ?,
        spare_parts_price= ?,
        labour_charges   = ?,
        delivery_call_type = ?,
        delivery_project_work = ?,
        total_expenses   = ?,
        payment_type     = ?,
        invoice_value    = ?,
        payment_status   = ?,
        remarks          = ?,
        step2_completed  = ?,
        completed_at     = ?
      WHERE id = ?
    `;

    const callDetails = c.call_details || c.complaint || c.description || current.call_details || "";

    const params = [
      c.customer_id || current.customer_id || null,
      customerName,
      customerName,
      customerName,
      c.mobile_number || c.phone || current.mobile_number || "",
      c.phone || c.mobile_number || current.phone || "",
      c.email || current.email || "",
      c.location_city || c.location || current.location_city || "",
      c.location || c.location_city || current.location || "",
      c.gst_number || current.gst_number || "",
      c.company_name || current.company_name || "",
      c.engineer || c.staff_name || c.technician || current.staff_name || "",
      c.engineer || c.technician || c.staff_name || current.technician || "",
      c.executive_name || c.call_referrer || current.executive_name || "",
      c.call_type || current.call_type || "",
      c.service_type || (c.call_type === "AMC" || c.call_type === "ALC" ? c.call_type : (current.service_type || "None")),
      c.contract_title || current.contract_title || "",
      c.call_referrer || current.call_referrer || "",
      callDetails,
      callDetails,
      callDetails,
      c.priority || current.priority || "Medium",
      c.status || current.status || "Pending",
      c.report_date || current.report_date || (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; })(),
      startTimeRaw || current.start_time || null,
      endTimeRaw || current.end_time || null,
      assignedTime,
      actualDuration || current.actual_duration || 0,
      assignedTime,
      isExceeded,
      // travel time
      travelStartRaw2 !== null ? travelStartRaw2 : (current.travel_start_time || null),
      travelReachRaw2 !== null ? travelReachRaw2 : (current.travel_reach_time || null),
      travelDuration2 !== null ? travelDuration2 : (current.travel_duration !== undefined ? current.travel_duration : null),
      c.km !== undefined && c.km !== "" && c.km != null ? parseFloat(c.km) : current.km,
      parseFloat(c.petrol_charges) || current.petrol_charges || 0,
      parseFloat(c.spare_parts_price) || current.spare_parts_price || 0,
      parseFloat(c.labour_charges) || current.labour_charges || 0,
      c.delivery_call_type !== undefined ? (c.delivery_call_type || "") : (current.delivery_call_type || ""),
      c.delivery_project_work !== undefined ? (parseFloat(c.delivery_project_work) || 0) : (current.delivery_project_work || 0),
      totalExpenses,
      c.payment_type || c.payment_mode || current.payment_type || "",
      parseFloat(c.invoice_value) || current.invoice_value || 0,
      c.payment_status || current.payment_status || "Pending",
      c.remarks !== undefined ? c.remarks : (current.remarks || ""),
      newStep2,
      completedAt || current.completed_at || null,
      id,
    ];

    db.query(sql, params, (err2) => {
      if (err2) {
        console.error("PUT /call-reports/:id error:", err2.message);
        return res.status(500).json({ error: err2.message });
      }

      // Auto-trigger WhatsApp automation if ticket is closed/completed
      if (c.status === "Closed" || newStep2 === 1) {
        try {
          const { triggerAutomation } = require("../services/waAutomationService");
          const targetPhone = c.mobile_number || c.phone || current.mobile_number || current.phone;
          if (targetPhone) {
            triggerAutomation("ticket_closed", {
              phone: targetPhone,
              contactName: customerName,
              data: {
                service: c.service_type || current.service_type || "Service Call",
                technician: c.engineer || c.staff_name || current.staff_name || "Engineer",
                company: c.company_name || current.company_name || "Company",
                invoice_no: `SR-${id}`,
                date: new Date().toLocaleDateString("en-IN"),
              }
            }).catch(() => {});
          }
        } catch (_) {}
      }

      res.json({
        message: "Updated",
        step2_completed: newStep2,
        completed_at: completedAt,
      });
    });
  });
});

// ── DELETE call report ───────────────────────────────────────────────────────
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
