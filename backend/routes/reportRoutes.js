const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");

// Helper to handle date ranges
const getDateRange = (filter, from, to) => {
  let startDate, endDate;
  const now = new Date();

  if (from && to) {
    startDate = from;
    endDate = to;
  } else {
    endDate = now.toISOString().split('T')[0];
    const d = new Date();
    if (filter === "day") {
      startDate = endDate;
    } else if (filter === "week") {
      // Last 7 days
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split('T')[0];
    } else if (filter === "month") {
      d.setDate(1);
      startDate = d.toISOString().split('T')[0];
    } else if (filter === "year") {
      d.setMonth(0);
      d.setDate(1);
      startDate = d.toISOString().split('T')[0];
    } else {
      // Default to month
      d.setDate(1);
      startDate = d.toISOString().split('T')[0];
    }
  }
  return { startDate, endDate };
};

/* GET OVERVIEW METRICS */
router.get("/overview", verifyToken, async (req, res) => {
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const userFilter = isAdmin ? "" : ` AND created_by = ${userId}`;
  const userFilterLeads = isAdmin ? "" : ` AND (created_by = ${userId} OR assigned_to = ${userId})`;

  const { customer } = req.query;
  const customerFilter = customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : "";

  try {
    const queries = {
      sales: `SELECT SUM(grand_total) as total FROM performainvoices WHERE invoice_date BETWEEN ? AND ? ${userFilter} ${customer ? ` AND client_company LIKE '%${customer}%'` : ""}`,
      leads: `
        SELECT 
          (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? ${userFilterLeads} ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as telecalls,
          (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? ${userFilterLeads} ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as walkins,
          (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? ${userFilterLeads} ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as fields,
          (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? ${userFilterLeads} AND call_outcome = 'Converted' ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as tc_conv,
          (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? ${userFilterLeads} AND walkin_status = 'Converted' ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as wk_conv,
          (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? ${userFilterLeads} AND field_outcome = 'Converted' ${customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : ""}) as fld_conv
      `,
      services: `SELECT COUNT(*) as count, SUM(total_expenses) as revenue FROM amc_alc_services WHERE service_date BETWEEN ? AND ? ${isAdmin ? "" : " AND (service_person_id = " + userId + " OR created_by = " + userId + ")"} ${customer ? ` AND customer_name LIKE '%${customer}%'` : ""}`
    };
    const [salesResult] = await db.promise().query(queries.sales, [startDate, endDate]);
    const [leadsResult] = await db.promise().query(queries.leads, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);
    const [servicesResult] = await db.promise().query(queries.services, [startDate, endDate]);

    const leads = leadsResult[0];
    const totalLeads = leads.telecalls + leads.walkins + leads.fields;
    const convertedLeads = leads.tc_conv + leads.wk_conv + leads.fld_conv;

    res.json({
      totalSales: salesResult[0].total || 0,
      totalLeads,
      totalCalls: leads.telecalls,
      totalwalkins: leads.walkins,
      totalFields: leads.fields,
      convertedLeads,
      totalServices: servicesResult[0].count || 0,
      totalRevenue: servicesResult[0].revenue || 0,
      startDate,
      endDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET EMPLOYEE COMPARISON */
router.get("/employee-comparison", verifyToken, async (req, res) => {
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);

  try {
    const [employees] = await db.promise().query("SELECT id, first_name, last_name, job_title, emp_email FROM teammember");

    const reportData = await Promise.all(employees.map(async (emp) => {
      const empName = `${emp.first_name} ${emp.last_name || ""}`.trim();
      const empId = emp.id;

      const [leads] = await db.promise().query(`
        SELECT 
          (SELECT COUNT(*) FROM telecalls WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND call_date BETWEEN ? AND ?) as telecalls,
          (SELECT COUNT(*) FROM walkins WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND walkin_date BETWEEN ? AND ?) as walkins,
          (SELECT COUNT(*) FROM fields WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND visit_date BETWEEN ? AND ?) as fields,
          (SELECT COUNT(*) FROM telecalls WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND call_date BETWEEN ? AND ? AND call_outcome = 'Converted') as tc_conv,
          (SELECT COUNT(*) FROM walkins WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND walkin_date BETWEEN ? AND ? AND walkin_status = 'Converted') as wk_conv,
          (SELECT COUNT(*) FROM fields WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND visit_date BETWEEN ? AND ? AND field_outcome = 'Converted') as fld_conv
      `, [empId, `%${empName}%`, empId, startDate, endDate, empId, `%${empName}%`, empId, startDate, endDate, empId, `%${empName}%`, empId, startDate, endDate, empId, `%${empName}%`, empId, startDate, endDate, empId, `%${empName}%`, empId, startDate, endDate, empId, `%${empName}%`, empId, startDate, endDate]);

      const [services] = await db.promise().query(`SELECT COUNT(*) as count, SUM(total_expenses) as revenue FROM amc_alc_services WHERE (service_person_id = ? OR service_person LIKE ?) AND service_date BETWEEN ? AND ?`, [empId, `%${empName}%`, startDate, endDate]);

      const [tasks] = await db.promise().query(`SELECT COUNT(*) as total, SUM(CASE WHEN project_status = 'Completed' THEN 1 ELSE 0 END) as completed FROM tasks WHERE (assigned_to = ? OR staff_name LIKE ?) AND created_date BETWEEN ? AND ?`, [empId, `%${empName}%`, startDate, endDate]);

      const l = leads[0];
      const totalLeads = l.telecalls + l.walkins + l.fields;
      const leadsConverted = l.tc_conv + l.wk_conv + l.fld_conv;

      return {
        id: empId,
        name: empName,
        position: emp.job_title || "Staff",
        telecalls: l.telecalls,
        walkins: l.walkins,
        fields: l.fields,
        totalLeads,
        leadsConverted,
        conversionRate: totalLeads > 0 ? Math.round((leadsConverted / totalLeads) * 100) : 0,
        services: services[0].count || 0,
        serviceRevenue: services[0].revenue || 0,
        tasksAssigned: tasks[0].total || 0,
        tasksCompleted: tasks[0].completed || 0
      };
    }));

    res.json(reportData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET DYNAMIC BREAKDOWN (Day/Week/Month/Year) */
router.get("/breakdown", verifyToken, async (req, res) => {
  const { filter, from, to, employeeId } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const userFilter = isAdmin ? "" : ` AND created_by = ${userId}`;
  const userFilterLeads = isAdmin ? "" : ` AND (created_by = ${userId} OR assigned_to = ${userId})`;
  const empFilter = employeeId ? ` AND (created_by = ${employeeId} OR staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR assigned_to = ${employeeId})` : "";
  const empFilterService = employeeId ? ` AND (service_person_id = ${employeeId} OR service_person LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}))` : "";
  const empFilterInvoice = employeeId ? ` AND created_by = ${employeeId}` : "";

  const { customer } = req.query;
  const customerFilter = customer ? ` AND customer_name LIKE '%${customer}%'` : "";
  const customerFilterInvoice = customer ? ` AND client_company LIKE '%${customer}%'` : "";

  try {
    let rows = [];

    if (filter === "day") {
      const year = startDate.substring(0, 4);
      const month = startDate.substring(5, 7);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month}-${String(d).padStart(2, "0")}`;
        const dayOfWeek = new Date(dateStr).getDay();

        const [salesRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE DATE(invoice_date) = ? ${userFilter} ${customerFilterInvoice} ${empFilterInvoice}`,
          [dateStr]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? ${userFilterLeads} ${empFilter}) as Leads`,
          [dateStr, dateStr, dateStr]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? AND call_outcome = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? AND walkin_status = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? AND field_outcome = 'Converted' ${userFilterLeads} ${empFilter}) as Converted`,
          [dateStr, dateStr, dateStr]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(total_expenses), 0) as Revenue FROM amc_alc_services WHERE DATE(service_date) = ? ${isAdmin ? "" : " AND (service_person_id = " + userId + " OR created_by = " + userId + ")"} ${empFilterService}`,
          [dateStr]
        );

        rows.push({
          name: `${d} ${dayNames[dayOfWeek]}`,
          Sales: salesRes[0].Sales || 0,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: servRes[0].Revenue || 0,
        });
      }
    } else if (filter === "week") {
      const year = new Date(startDate).getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];

      for (let w = 1; w <= 52; w++) {
        const weekStart = new Date(year, 0, 1 + (w - 1) * 7);
        const monthIdx = weekStart.getMonth();
        const weekOfMonth = Math.floor((weekStart.getDate() - 1) / 7) + 1;
        const label = `${ordinals[Math.min(weekOfMonth - 1, 4)]} Week of ${monthNames[monthIdx]}`;

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const ws = weekStart.toISOString().split("T")[0];
        const we = weekEnd.toISOString().split("T")[0];

        const [salesRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE invoice_date BETWEEN ? AND ? ${userFilter} ${customerFilterInvoice} ${empFilterInvoice}`,
          [ws, we]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) as Leads`,
          [ws, we, ws, we, ws, we]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilterLeads} ${empFilter}) as Converted`,
          [ws, we, ws, we, ws, we]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(total_expenses), 0) as Revenue FROM amc_alc_services WHERE service_date BETWEEN ? AND ? ${isAdmin ? "" : " AND (service_person_id = " + userId + " OR created_by = " + userId + ")"} ${empFilterService}`,
          [ws, we]
        );

        rows.push({
          name: label,
          Sales: salesRes[0].Sales || 0,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: servRes[0].Revenue || 0,
        });
      }
    } else if (filter === "month") {
      const [result] = await db.promise().query(`
        SELECT 
          m.month_name as name,
          COALESCE(SUM(p.grand_total), 0) as Sales,
          (SELECT COUNT(*) FROM telecalls t WHERE MONTH(t.call_date) = m.month_num AND YEAR(t.call_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND t.created_by = " + userId} ${empFilter ? ` AND (t.created_by = ${employeeId} OR t.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR t.assigned_to = ${employeeId})` : ""}) +
          (SELECT COUNT(*) FROM walkins w WHERE MONTH(w.walkin_date) = m.month_num AND YEAR(w.walkin_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND w.created_by = " + userId} ${empFilter ? ` AND (w.created_by = ${employeeId} OR w.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR w.assigned_to = ${employeeId})` : ""}) +
          (SELECT COUNT(*) FROM fields f WHERE MONTH(f.visit_date) = m.month_num AND YEAR(f.visit_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND f.created_by = " + userId} ${empFilter ? ` AND (f.created_by = ${employeeId} OR f.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR f.assigned_to = ${employeeId})` : ""}) as Leads,
          COALESCE(COUNT(s.id), 0) as Services,
          (SELECT COUNT(*) FROM telecalls t WHERE MONTH(t.call_date) = m.month_num AND YEAR(t.call_date) = YEAR(CURDATE()) AND t.call_outcome = 'Converted' ${isAdmin ? "" : " AND t.created_by = " + userId} ${empFilter ? ` AND (t.created_by = ${employeeId} OR t.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR t.assigned_to = ${employeeId})` : ""}) +
          (SELECT COUNT(*) FROM walkins w WHERE MONTH(w.walkin_date) = m.month_num AND YEAR(w.walkin_date) = YEAR(CURDATE()) AND w.walkin_status = 'Converted' ${isAdmin ? "" : " AND w.created_by = " + userId} ${empFilter ? ` AND (w.created_by = ${employeeId} OR w.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR w.assigned_to = ${employeeId})` : ""}) +
          (SELECT COUNT(*) FROM fields f WHERE MONTH(f.visit_date) = m.month_num AND YEAR(f.visit_date) = YEAR(CURDATE()) AND f.field_outcome = 'Converted' ${isAdmin ? "" : " AND f.created_by = " + userId} ${empFilter ? ` AND (f.created_by = ${employeeId} OR f.staff_name LIKE (SELECT CONCAT(first_name, ' ', COALESCE(last_name, '')) FROM teammember WHERE id = ${employeeId}) OR f.assigned_to = ${employeeId})` : ""}) as Converted,
          COALESCE(SUM(s.total_expenses), 0) as Revenue
        FROM (
          SELECT 1 as month_num, 'Jan' as month_name UNION SELECT 2, 'Feb' UNION SELECT 3, 'Mar' UNION SELECT 4, 'Apr' UNION SELECT 5, 'May' UNION SELECT 6, 'Jun' 
          UNION SELECT 7, 'Jul' UNION SELECT 8, 'Aug' UNION SELECT 9, 'Sep' UNION SELECT 10, 'Oct' UNION SELECT 11, 'Nov' UNION SELECT 12, 'Dec'
        ) as m
        LEFT JOIN performainvoices p ON MONTH(p.invoice_date) = m.month_num AND YEAR(p.invoice_date) = YEAR(CURDATE()) ${userFilter} ${customerFilterInvoice} ${empFilterInvoice}
        LEFT JOIN amc_alc_services s ON MONTH(s.service_date) = m.month_num AND YEAR(s.service_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND s.service_person_id = " + userId} ${empFilterService}
        GROUP BY m.month_num, m.month_name
        ORDER BY m.month_num ASC
      `);
      rows = result;
    } else if (filter === "year") {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const ys = `${y}-01-01`;
        const ye = `${y}-12-31`;

        const [salesRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE invoice_date BETWEEN ? AND ? ${userFilter} ${customerFilterInvoice} ${empFilterInvoice}`,
          [ys, ye]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? ${userFilterLeads} ${empFilter}) as Leads`,
          [ys, ye, ys, ye, ys, ye]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilterLeads} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilterLeads} ${empFilter}) as Converted`,
          [ys, ye, ys, ye, ys, ye]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(total_expenses), 0) as Revenue FROM amc_alc_services WHERE service_date BETWEEN ? AND ? ${isAdmin ? "" : " AND (service_person_id = " + userId + " OR created_by = " + userId + ")"} ${empFilterService}`,
          [ys, ye]
        );

        rows.push({
          name: String(y),
          Sales: salesRes[0].Sales || 0,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: servRes[0].Revenue || 0,
        });
      }
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET TRENDS */
router.get("/trends", verifyToken, async (req, res) => {
  const { type } = req.query;
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter || "month", from, to);
  const isAdmin = req.user.role === 'admin';
  const userId = req.user.id;
  const userFilter = isAdmin ? "" : ` AND created_by = ${userId}`;
  const userFilterService = isAdmin ? "" : ` AND s.service_person_id = ${userId}`;

  try {
    if (type === 'daily' || filter === 'day') {
      const [rows] = await db.promise().query(`
        SELECT 
          DATE_FORMAT(date_series.date, '%m-%d') as date,
          COALESCE(SUM(p.grand_total), 0) as Sales,
          (SELECT COUNT(*) FROM telecalls t WHERE DATE(t.call_date) = date_series.date ${isAdmin ? "" : " AND t.created_by = " + userId}) +
          (SELECT COUNT(*) FROM walkins w WHERE DATE(w.walkin_date) = date_series.date ${isAdmin ? "" : " AND w.created_by = " + userId}) +
          (SELECT COUNT(*) FROM fields f WHERE DATE(f.visit_date) = date_series.date ${isAdmin ? "" : " AND f.created_by = " + userId}) as Leads,
          COALESCE(COUNT(s.id), 0) as Services,
          COALESCE(SUM(s.total_expenses), 0) as Revenue
        FROM (
          SELECT CURDATE() - INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY as date
          FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
          CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as b
          CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as c
        ) as date_series
        LEFT JOIN performainvoices p ON DATE(p.invoice_date) = date_series.date ${userFilter}
        LEFT JOIN amc_alc_services s ON DATE(s.service_date) = date_series.date ${userFilterService}
        WHERE date_series.date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
        GROUP BY date_series.date
        ORDER BY date_series.date ASC
      `);
      res.json(rows);
    } else if (type === 'yearly' || filter === 'year') {
      const currentYear = new Date().getFullYear();
      const rows = [];
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const ys = `${y}-01-01`;
        const ye = `${y}-12-31`;
        const [result] = await db.promise().query(`
          SELECT 
            ? as name,
            COALESCE(SUM(p.grand_total), 0) as Sales,
            (SELECT COUNT(*) FROM telecalls t WHERE YEAR(t.call_date) = ? ${isAdmin ? "" : " AND t.created_by = " + userId}) +
            (SELECT COUNT(*) FROM walkins w WHERE YEAR(w.walkin_date) = ? ${isAdmin ? "" : " AND w.created_by = " + userId}) +
            (SELECT COUNT(*) FROM fields f WHERE YEAR(f.visit_date) = ? ${isAdmin ? "" : " AND f.created_by = " + userId}) as Leads,
            (SELECT COUNT(*) FROM amc_alc_services s WHERE YEAR(s.service_date) = ? ${userFilterService}) as Services,
            (SELECT COALESCE(SUM(s.total_expenses), 0) FROM amc_alc_services s WHERE YEAR(s.service_date) = ? ${userFilterService}) as Revenue
          FROM performainvoices p
          WHERE YEAR(p.invoice_date) = ? ${userFilter}
        `, [y, y, y, y, y, y, y]);
        rows.push(result[0] || { name: String(y), Sales: 0, Leads: 0, Services: 0, Revenue: 0 });
      }
      res.json(rows);
    } else {
      const [rows] = await db.promise().query(`
        SELECT 
          m.month_name as name,
          COALESCE(SUM(p.grand_total), 0) as Sales,
          (SELECT COUNT(*) FROM telecalls t WHERE MONTH(t.call_date) = m.month_num AND YEAR(t.call_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND t.created_by = " + userId}) +
          (SELECT COUNT(*) FROM walkins w WHERE MONTH(w.walkin_date) = m.month_num AND YEAR(w.walkin_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND w.created_by = " + userId}) +
          (SELECT COUNT(*) FROM fields f WHERE MONTH(f.visit_date) = m.month_num AND YEAR(f.visit_date) = YEAR(CURDATE()) ${isAdmin ? "" : " AND f.created_by = " + userId}) as Leads,
          COALESCE(COUNT(s.id), 0) as Services,
          COALESCE(SUM(s.total_expenses), 0) as Revenue
        FROM (
          SELECT 1 as month_num, 'Jan' as month_name UNION SELECT 2, 'Feb' UNION SELECT 3, 'Mar' UNION SELECT 4, 'Apr' UNION SELECT 5, 'May' UNION SELECT 6, 'Jun' 
          UNION SELECT 7, 'Jul' UNION SELECT 8, 'Aug' UNION SELECT 9, 'Sep' UNION SELECT 10, 'Oct' UNION SELECT 11, 'Nov' UNION SELECT 12, 'Dec'
        ) as m
        LEFT JOIN performainvoices p ON MONTH(p.invoice_date) = m.month_num AND YEAR(p.invoice_date) = YEAR(CURDATE()) ${userFilter}
        LEFT JOIN amc_alc_services s ON MONTH(s.service_date) = m.month_num AND YEAR(s.service_date) = YEAR(CURDATE()) ${userFilterService}
        GROUP BY m.month_num, m.month_name
        ORDER BY m.month_num ASC
      `);
      res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET USER ACTIVITY DASHBOARD (admin only) */
router.get("/user-activity", verifyToken, async (req, res) => {
  const isAdmin = req.user.role === "admin" || req.user.role === "subadmin";
  if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

  const today = new Date().toISOString().split("T")[0];

  try {
    // Get all users (both teammember and users tables)
    const [members] = await db.promise().query(
      `SELECT id, first_name, last_name, job_title, emp_email, emp_role, created_at FROM teammember ORDER BY first_name ASC`
    );

    const data = await Promise.all(members.map(async (emp) => {
      const empId = emp.id;
      const empName = `${emp.first_name} ${emp.last_name || ""}`.trim();
      const namePattern = `%${empName}%`;

      // Today's leads
      const [todayLeads] = await db.promise().query(`
        SELECT
          (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_today,
          (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_today,
          (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_today
      `, [today, empId, namePattern, empId, today, empId, namePattern, empId, today, empId, namePattern, empId]);

      // Total leads (this month)
      const monthStart = today.substring(0, 7) + "-01";
      const [monthLeads] = await db.promise().query(`
        SELECT
          (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_month,
          (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_month,
          (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_month,
          (SELECT COUNT(*) FROM telecalls WHERE call_date BETWEEN ? AND ? AND call_outcome = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_conv,
          (SELECT COUNT(*) FROM walkins WHERE walkin_date BETWEEN ? AND ? AND walkin_status = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_conv,
          (SELECT COUNT(*) FROM fields WHERE visit_date BETWEEN ? AND ? AND field_outcome = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_conv
      `, [
        monthStart, today, empId, namePattern, empId,
        monthStart, today, empId, namePattern, empId,
        monthStart, today, empId, namePattern, empId,
        monthStart, today, empId, namePattern, empId,
        monthStart, today, empId, namePattern, empId,
        monthStart, today, empId, namePattern, empId,
      ]);

      // Call reports today
      const [callReports] = await db.promise().query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as closed,
         SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status='In Progress' OR status='Live' THEN 1 ELSE 0 END) as in_progress
         FROM call_reports WHERE DATE(created_at) = ? AND (created_by = ? OR staff_name LIKE ? OR technician LIKE ?)`,
        [today, empId, namePattern, namePattern]
      );

      // Tasks
      const [tasks] = await db.promise().query(
        `SELECT COUNT(*) as total, SUM(CASE WHEN project_status='Completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN project_status='In Progress' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN project_status='Pending' THEN 1 ELSE 0 END) as pending
         FROM tasks WHERE (assigned_to = ? OR staff_name LIKE ?) AND project_status != 'Completed'`,
        [empId, namePattern]
      );

      // Last activity (most recent record created)
      const [lastAct] = await db.promise().query(`
        SELECT MAX(ts) as last_activity FROM (
          SELECT MAX(created_at) as ts FROM telecalls WHERE created_by = ?
          UNION SELECT MAX(created_at) FROM walkins WHERE created_by = ?
          UNION SELECT MAX(created_at) FROM fields WHERE created_by = ?
          UNION SELECT MAX(created_at) FROM call_reports WHERE created_by = ?
          UNION SELECT MAX(created_at) FROM tasks WHERE assigned_to = ?
        ) as t
      `, [empId, empId, empId, empId, empId]);

      const tl = todayLeads[0];
      const ml = monthLeads[0];
      const cr = callReports[0];
      const tk = tasks[0];

      const todayTotal = tl.tc_today + tl.wk_today + tl.fld_today;
      const monthTotal = ml.tc_month + ml.wk_month + ml.fld_month;
      const monthConverted = ml.tc_conv + ml.wk_conv + ml.fld_conv;

      // "Active today" = has any activity today
      const isActiveToday = todayTotal > 0 || (cr.total || 0) > 0;

      return {
        id: empId,
        name: empName,
        position: emp.job_title || emp.emp_role || "Staff",
        email: emp.emp_email || "",
        // Today's numbers
        todayTelecalls: tl.tc_today,
        todayWalkins: tl.wk_today,
        todayFields: tl.fld_today,
        todayLeads: todayTotal,
        // Month numbers
        monthTelecalls: ml.tc_month,
        monthWalkins: ml.wk_month,
        monthFields: ml.fld_month,
        monthLeads: monthTotal,
        monthConverted,
        conversionRate: monthTotal > 0 ? Math.round((monthConverted / monthTotal) * 100) : 0,
        // Call reports
        callReportsToday: cr.total || 0,
        callReportsClosed: cr.closed || 0,
        callReportsCompleted: cr.completed || 0,
        callReportsInProgress: cr.in_progress || 0,
        // Tasks
        tasksPending: tk.pending || 0,
        tasksInProgress: tk.in_progress || 0,
        tasksTotal: tk.total || 0,
        // Status
        isActiveToday,
        lastActivity: lastAct[0]?.last_activity || null,
      };
    }));

    res.json(data);
  } catch (err) {
    console.error("user-activity error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
