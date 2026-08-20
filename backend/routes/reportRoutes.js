const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");

// Helper to handle date ranges with precise timestamps
const getDateRange = (filter, from, to) => {
  let startDate, endDate;
  const now = new Date();

  if (from && to) {
    startDate = from;
    endDate = to;
  } else {
    endDate = now.toISOString().split("T")[0];
    const d = new Date();
    if (filter === "day") {
      startDate = endDate;
    } else if (filter === "week") {
      d.setDate(d.getDate() - 6);
      startDate = d.toISOString().split("T")[0];
    } else if (filter === "year") {
      d.setMonth(0);
      d.setDate(1);
      startDate = d.toISOString().split("T")[0];
    } else {
      // Default to month
      d.setDate(1);
      startDate = d.toISOString().split("T")[0];
    }
  }
  return { startDate, endDate };
};

/* ── 1. GET OVERVIEW METRICS ──────────────────────────────────────────────── */
router.get("/overview", verifyToken, async (req, res) => {
  const { filter, from, to, customer } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin" || req.user.role === "subadmin";

  const userFilterCreated = isAdmin ? "" : ` AND created_by = ${userId}`;
  const userFilterLeads = isAdmin ? "" : ` AND (created_by = ${userId} OR assigned_to = ${userId})`;
  const userFilterStaff = isAdmin ? "" : ` AND (created_by = ${userId} OR staff_name LIKE (SELECT CONCAT(first_name, '%') FROM teammember WHERE id = ${userId}) OR technician LIKE (SELECT CONCAT(first_name, '%') FROM teammember WHERE id = ${userId}))`;

  const custFilterLeads = customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : "";
  const custFilterInvoice = customer ? ` AND client_company LIKE '%${customer}%'` : "";
  const custFilterServices = customer ? ` AND (customer_name LIKE '%${customer}%' OR client_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : "";

  try {
    // 1. Invoices / Sales
    const [salesResult] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count 
       FROM performainvoices 
       WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilterCreated} ${custFilterInvoice}`,
      [startDate, endDate]
    );

    // 2. Quotations Pipeline
    const [quotationsResult] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count,
              COALESCE(SUM(CASE WHEN status IN ('Won', 'Approved', 'Converted', 'Accepted') THEN grand_total ELSE 0 END), 0) as won_total,
              COUNT(CASE WHEN status IN ('Won', 'Approved', 'Converted', 'Accepted') THEN 1 END) as won_count
       FROM quotations 
       WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilterCreated} ${custFilterInvoice}`,
      [startDate, endDate]
    );

    // 3. AMC Contracts
    const [contractsResult] = await db.promise().query(
      `SELECT COALESCE(SUM(amount_value), 0) as total, COUNT(*) as count 
       FROM contracts 
       WHERE DATE(created_at) BETWEEN ? AND ? ${userFilterCreated} ${customer ? ` AND client_company LIKE '%${customer}%'` : ""}`,
      [startDate, endDate]
    );

    // 4. Leads & Conversions
    const [leadsResult] = await db.promise().query(
      `SELECT 
        (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilterLeads} ${custFilterLeads}) as telecalls,
        (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilterLeads} ${custFilterLeads}) as walkins,
        (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilterLeads} ${custFilterLeads}) as fields,
        (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilterLeads} ${custFilterLeads}) as tc_conv,
        (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilterLeads} ${custFilterLeads}) as wk_conv,
        (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilterLeads} ${custFilterLeads}) as fld_conv
      `,
      [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]
    );

    // 5. Clients Count
    const [clientsResult] = await db.promise().query(
      `SELECT COUNT(*) as count FROM clients WHERE DATE(created_at) BETWEEN ? AND ? ${customer ? ` AND (company_name LIKE '%${customer}%' OR name LIKE '%${customer}%')` : ""}`,
      [startDate, endDate]
    );

    // 6. Services & Expenses (from call_reports + amc_alc_services)
    const [servicesResult] = await db.promise().query(
      `SELECT 
        COUNT(*) as count,
        COALESCE(SUM(amount_collected), 0) as collected,
        COALESCE(SUM(total_expenses), 0) as expenses,
        COALESCE(SUM(petrol_charges), 0) as petrol,
        COALESCE(SUM(spare_parts_price), 0) as spare_parts,
        COALESCE(SUM(labour_charges), 0) as labour,
        COUNT(CASE WHEN status IN ('Closed', 'Completed') THEN 1 END) as closed_count,
        COUNT(CASE WHEN status NOT IN ('Closed', 'Completed') THEN 1 END) as pending_count
       FROM call_reports 
       WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)) ${userFilterStaff} ${custFilterServices}`,
      [startDate, endDate, startDate, endDate]
    );

    // 7. Payments Recorded
    const [paymentsResult] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(payment_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const leads = leadsResult[0] || {};
    const totalCalls = leads.telecalls || 0;
    const totalWalkins = leads.walkins || 0;
    const totalFields = leads.fields || 0;
    const totalLeads = totalCalls + totalWalkins + totalFields;
    const convertedLeads = (leads.tc_conv || 0) + (leads.wk_conv || 0) + (leads.fld_conv || 0) + (clientsResult[0].count || 0);

    const totalSales = Number(salesResult[0].total || 0);
    const totalQuoted = Number(quotationsResult[0].total || 0);
    const totalContracts = Number(contractsResult[0].total || 0);
    const totalCollected = Number(paymentsResult[0].total || 0) + Number(servicesResult[0].collected || 0);
    const totalExpenses = Number(servicesResult[0].expenses || 0);
    const totalRevenue = totalSales > 0 ? totalSales : (totalCollected > 0 ? totalCollected : totalQuoted);

    res.json({
      totalSales,
      salesCount: salesResult[0].count || 0,
      totalQuotations: totalQuoted,
      quotationsCount: quotationsResult[0].count || 0,
      wonQuotationsTotal: Number(quotationsResult[0].won_total || 0),
      wonQuotationsCount: quotationsResult[0].won_count || 0,
      totalContracts,
      contractsCount: contractsResult[0].count || 0,
      totalLeads,
      totalCalls,
      totalWalkins,
      totalwalkins: totalWalkins,
      totalFields,
      convertedLeads,
      conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
      totalClients: clientsResult[0].count || 0,
      totalServices: servicesResult[0].count || 0,
      servicesClosed: servicesResult[0].closed_count || 0,
      servicesPending: servicesResult[0].pending_count || 0,
      totalCollected,
      totalExpenses,
      petrolExpenses: Number(servicesResult[0].petrol || 0),
      sparePartsExpenses: Number(servicesResult[0].spare_parts || 0),
      labourExpenses: Number(servicesResult[0].labour || 0),
      totalRevenue,
      netProfit: (totalSales + totalContracts) - totalExpenses,
      startDate,
      endDate,
    });
  } catch (err) {
    console.error("Overview metrics error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 2. GET EMPLOYEE COMPARISON & RANKINGS ─────────────────────────────────── */
router.get("/employee-comparison", verifyToken, async (req, res) => {
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);

  try {
    const [employees] = await db.promise().query(
      "SELECT id, first_name, last_name, job_title, emp_email, emp_role FROM teammember ORDER BY first_name ASC"
    );

    const reportData = await Promise.all(
      employees.map(async (emp) => {
        const empName = `${emp.first_name} ${emp.last_name || ""}`.trim();
        const empId = emp.id;
        const namePattern = `%${emp.first_name}%`;

        // 1. Leads
        const [leads] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(call_date) BETWEEN ? AND ?) as telecalls,
            (SELECT COUNT(*) FROM walkins WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(walkin_date) BETWEEN ? AND ?) as walkins,
            (SELECT COUNT(*) FROM fields WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(visit_date) BETWEEN ? AND ?) as fields,
            (SELECT COUNT(*) FROM telecalls WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted') as tc_conv,
            (SELECT COUNT(*) FROM walkins WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted') as wk_conv,
            (SELECT COUNT(*) FROM fields WHERE (created_by = ? OR staff_name LIKE ? OR assigned_to = ?) AND DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted') as fld_conv
          `,
          [
            empId, namePattern, empId, startDate, endDate,
            empId, namePattern, empId, startDate, endDate,
            empId, namePattern, empId, startDate, endDate,
            empId, namePattern, empId, startDate, endDate,
            empId, namePattern, empId, startDate, endDate,
            empId, namePattern, empId, startDate, endDate,
          ]
        );

        // 2. Services from call_reports & amc_alc_services
        const [services] = await db.promise().query(
          `SELECT 
            COUNT(*) as count,
            COALESCE(SUM(amount_collected), 0) as collected,
            COALESCE(SUM(total_expenses), 0) as expenses,
            COUNT(CASE WHEN status IN ('Closed', 'Completed') THEN 1 END) as closed_count
           FROM call_reports 
           WHERE (technician LIKE ? OR staff_name LIKE ? OR created_by = ?)
             AND (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))`,
          [namePattern, namePattern, empId, startDate, endDate, startDate, endDate]
        );

        // 3. Quotations & Invoices created
        const [sales] = await db.promise().query(
          `SELECT 
            (SELECT COALESCE(SUM(grand_total), 0) FROM quotations WHERE created_by = ? AND DATE(quotation_date) BETWEEN ? AND ?) as quote_val,
            (SELECT COUNT(*) FROM quotations WHERE created_by = ? AND DATE(quotation_date) BETWEEN ? AND ?) as quote_cnt,
            (SELECT COALESCE(SUM(grand_total), 0) FROM performainvoices WHERE created_by = ? AND DATE(invoice_date) BETWEEN ? AND ?) as inv_val,
            (SELECT COUNT(*) FROM performainvoices WHERE created_by = ? AND DATE(invoice_date) BETWEEN ? AND ?) as inv_cnt`,
          [empId, startDate, endDate, empId, startDate, endDate, empId, startDate, endDate, empId, startDate, endDate]
        );

        // 4. Tasks assigned & completed
        const [tasks] = await db.promise().query(
          `SELECT COUNT(*) as total, SUM(CASE WHEN project_status = 'Completed' THEN 1 ELSE 0 END) as completed 
           FROM tasks 
           WHERE (assigned_to = ? OR staff_name LIKE ?) AND DATE(created_date) BETWEEN ? AND ?`,
          [empId, namePattern, startDate, endDate]
        );

        const l = leads[0] || {};
        const s = services[0] || {};
        const sl = sales[0] || {};
        const tk = tasks[0] || {};

        const totalLeads = (l.telecalls || 0) + (l.walkins || 0) + (l.fields || 0);
        const leadsConverted = (l.tc_conv || 0) + (l.wk_conv || 0) + (l.fld_conv || 0);
        const serviceRevenue = Number(sl.inv_val || 0) > 0 ? Number(sl.inv_val) : (Number(s.collected || 0) > 0 ? Number(s.collected) : Number(sl.quote_val || 0));

        return {
          id: empId,
          name: empName,
          position: emp.job_title || emp.emp_role || "Staff",
          email: emp.emp_email || "",
          telecalls: l.telecalls || 0,
          walkins: l.walkins || 0,
          fields: l.fields || 0,
          totalLeads,
          leadsConverted,
          conversionRate: totalLeads > 0 ? Math.round((leadsConverted / totalLeads) * 100) : 0,
          services: s.count || 0,
          servicesClosed: s.closed_count || 0,
          serviceRevenue,
          serviceExpenses: Number(s.expenses || 0),
          quotationsCount: sl.quote_cnt || 0,
          quotationsValue: Number(sl.quote_val || 0),
          invoicesCount: sl.inv_cnt || 0,
          invoicesValue: Number(sl.inv_val || 0),
          tasksAssigned: tk.total || 0,
          tasksCompleted: tk.completed || 0,
        };
      })
    );

    res.json(reportData);
  } catch (err) {
    console.error("Employee comparison error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 3. GET DYNAMIC BREAKDOWN TABLE (Day / Week / Month / Year) ───────────── */
router.get("/breakdown", verifyToken, async (req, res) => {
  const { filter, from, to, employeeId, customer } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);
  const userId = req.user.id;
  const isAdmin = req.user.role === "admin" || req.user.role === "subadmin";

  const userFilter = isAdmin ? "" : ` AND created_by = ${userId}`;
  const empFilter = employeeId ? ` AND (created_by = ${employeeId} OR staff_name LIKE (SELECT CONCAT(first_name, '%') FROM teammember WHERE id = ${employeeId}) OR assigned_to = ${employeeId})` : "";
  const empFilterStaff = employeeId ? ` AND (technician LIKE (SELECT CONCAT(first_name, '%') FROM teammember WHERE id = ${employeeId}) OR staff_name LIKE (SELECT CONCAT(first_name, '%') FROM teammember WHERE id = ${employeeId}) OR created_by = ${employeeId})` : "";
  const custFilterLeads = customer ? ` AND (customer_name LIKE '%${customer}%' OR company_name LIKE '%${customer}%')` : "";
  const custFilterInvoice = customer ? ` AND client_company LIKE '%${customer}%'` : "";

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
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE DATE(invoice_date) = ? ${userFilter} ${custFilterInvoice}`,
          [dateStr]
        );
        const [quoteRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Quotes FROM quotations WHERE DATE(quotation_date) = ? ${userFilter} ${custFilterInvoice}`,
          [dateStr]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? ${userFilter} ${empFilter} ${custFilterLeads}) as Leads`,
          [dateStr, dateStr, dateStr]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? AND call_outcome = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? AND walkin_status = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? AND field_outcome = 'Converted' ${userFilter} ${empFilter}) as Converted`,
          [dateStr, dateStr, dateStr]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(amount_collected), 0) as Collected, COALESCE(SUM(total_expenses), 0) as Expenses 
           FROM call_reports 
           WHERE (DATE(report_date) = ? OR (report_date IS NULL AND DATE(created_at) = ?)) ${empFilterStaff}`,
          [dateStr, dateStr]
        );

        const salesVal = Number(salesRes[0].Sales || 0);
        const quotesVal = Number(quoteRes[0].Quotes || 0);
        const revenue = salesVal > 0 ? salesVal : (Number(servRes[0].Collected || 0) > 0 ? Number(servRes[0].Collected) : quotesVal);

        rows.push({
          name: `${d} ${dayNames[dayOfWeek]}`,
          Sales: salesVal > 0 ? salesVal : quotesVal,
          Quotes: quotesVal,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: revenue,
          Expenses: Number(servRes[0].Expenses || 0),
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
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ws, we]
        );
        const [quoteRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Quotes FROM quotations WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ws, we]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) as Leads`,
          [ws, we, ws, we, ws, we]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilter} ${empFilter}) as Converted`,
          [ws, we, ws, we, ws, we]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(amount_collected), 0) as Collected, COALESCE(SUM(total_expenses), 0) as Expenses 
           FROM call_reports 
           WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)) ${empFilterStaff}`,
          [ws, we, ws, we]
        );

        const salesVal = Number(salesRes[0].Sales || 0);
        const quotesVal = Number(quoteRes[0].Quotes || 0);

        rows.push({
          name: label,
          Sales: salesVal > 0 ? salesVal : quotesVal,
          Quotes: quotesVal,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: salesVal > 0 ? salesVal : (Number(servRes[0].Collected || 0) > 0 ? Number(servRes[0].Collected) : quotesVal),
          Expenses: Number(servRes[0].Expenses || 0),
        });
      }
    } else if (filter === "year") {
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const ys = `${y}-01-01`;
        const ye = `${y}-12-31`;

        const [salesRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ys, ye]
        );
        const [quoteRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Quotes FROM quotations WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ys, ye]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) as Leads`,
          [ys, ye, ys, ye, ys, ye]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilter} ${empFilter}) as Converted`,
          [ys, ye, ys, ye, ys, ye]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(amount_collected), 0) as Collected, COALESCE(SUM(total_expenses), 0) as Expenses 
           FROM call_reports 
           WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)) ${empFilterStaff}`,
          [ys, ye, ys, ye]
        );

        const salesVal = Number(salesRes[0].Sales || 0);
        const quotesVal = Number(quoteRes[0].Quotes || 0);

        rows.push({
          name: String(y),
          Sales: salesVal > 0 ? salesVal : quotesVal,
          Quotes: quotesVal,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: salesVal > 0 ? salesVal : (Number(servRes[0].Collected || 0) > 0 ? Number(servRes[0].Collected) : quotesVal),
          Expenses: Number(servRes[0].Expenses || 0),
        });
      }
    } else {
      // Default: Month (Jan to Dec of Current Year)
      const targetYear = new Date(startDate).getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      for (let m = 1; m <= 12; m++) {
        const ms = `${targetYear}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(targetYear, m, 0).getDate();
        const me = `${targetYear}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const [salesRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Sales FROM performainvoices WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ms, me]
        );
        const [quoteRes] = await db.promise().query(
          `SELECT COALESCE(SUM(grand_total), 0) as Quotes FROM quotations WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilter} ${custFilterInvoice}`,
          [ms, me]
        );
        const [leadsRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilter} ${empFilter} ${custFilterLeads}) as Leads`,
          [ms, me, ms, me, ms, me]
        );
        const [convRes] = await db.promise().query(
          `SELECT 
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted' ${userFilter} ${empFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted' ${userFilter} ${empFilter}) as Converted`,
          [ms, me, ms, me, ms, me]
        );
        const [servRes] = await db.promise().query(
          `SELECT COUNT(*) as Services, COALESCE(SUM(amount_collected), 0) as Collected, COALESCE(SUM(total_expenses), 0) as Expenses 
           FROM call_reports 
           WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)) ${empFilterStaff}`,
          [ms, me, ms, me]
        );

        const salesVal = Number(salesRes[0].Sales || 0);
        const quotesVal = Number(quoteRes[0].Quotes || 0);

        rows.push({
          name: monthNames[m - 1],
          Sales: salesVal > 0 ? salesVal : quotesVal,
          Quotes: quotesVal,
          Leads: leadsRes[0].Leads || 0,
          Services: servRes[0].Services || 0,
          Converted: convRes[0].Converted || 0,
          Revenue: salesVal > 0 ? salesVal : (Number(servRes[0].Collected || 0) > 0 ? Number(servRes[0].Collected) : quotesVal),
          Expenses: Number(servRes[0].Expenses || 0),
        });
      }
    }

    res.json(rows);
  } catch (err) {
    console.error("Breakdown error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 4. GET TIMELINE TRENDS FOR CHARTS ────────────────────────────────────── */
router.get("/trends", verifyToken, async (req, res) => {
  const { type, filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter || "month", from, to);
  const isAdmin = req.user.role === "admin" || req.user.role === "subadmin";
  const userId = req.user.id;
  const userFilter = isAdmin ? "" : ` AND created_by = ${userId}`;

  try {
    if (type === "daily" || filter === "day" || filter === "week") {
      // Last 14-30 days timeline
      const [rows] = await db.promise().query(`
        SELECT 
          DATE_FORMAT(date_series.date, '%d %b') as name,
          DATE_FORMAT(date_series.date, '%Y-%m-%d') as fullDate,
          (SELECT COALESCE(SUM(grand_total), 0) FROM performainvoices WHERE DATE(invoice_date) = date_series.date ${userFilter}) as Sales,
          (SELECT COALESCE(SUM(grand_total), 0) FROM quotations WHERE DATE(quotation_date) = date_series.date ${userFilter}) as Quotes,
          (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = date_series.date ${userFilter}) +
          (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = date_series.date ${userFilter}) +
          (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = date_series.date ${userFilter}) as Leads,
          (SELECT COUNT(*) FROM call_reports WHERE DATE(report_date) = date_series.date OR (report_date IS NULL AND DATE(created_at) = date_series.date)) as Services,
          (SELECT COALESCE(SUM(amount_collected), 0) FROM call_reports WHERE DATE(report_date) = date_series.date OR (report_date IS NULL AND DATE(created_at) = date_series.date)) as Revenue,
          (SELECT COALESCE(SUM(total_expenses), 0) FROM call_reports WHERE DATE(report_date) = date_series.date OR (report_date IS NULL AND DATE(created_at) = date_series.date)) as Expenses
        FROM (
          SELECT CURDATE() - INTERVAL (a.a + (10 * b.a)) DAY as date
          FROM (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) as a
          CROSS JOIN (SELECT 0 as a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3) as b
        ) as date_series
        WHERE date_series.date BETWEEN ? AND ?
        ORDER BY date_series.date ASC
      `, [startDate, endDate]);

      const formatted = rows.map(r => ({
        ...r,
        Sales: Number(r.Sales) > 0 ? Number(r.Sales) : Number(r.Quotes),
        Revenue: Number(r.Sales) > 0 ? Number(r.Sales) : (Number(r.Revenue) > 0 ? Number(r.Revenue) : Number(r.Quotes)),
      }));
      res.json(formatted);
    } else if (type === "yearly" || filter === "year") {
      const currentYear = new Date().getFullYear();
      const rows = [];
      for (let y = currentYear - 4; y <= currentYear; y++) {
        const ys = `${y}-01-01`;
        const ye = `${y}-12-31`;
        const [result] = await db.promise().query(`
          SELECT 
            ? as name,
            (SELECT COALESCE(SUM(grand_total), 0) FROM performainvoices WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilter}) as Sales,
            (SELECT COALESCE(SUM(grand_total), 0) FROM quotations WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilter}) as Quotes,
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilter}) as Leads,
            (SELECT COUNT(*) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Services,
            (SELECT COALESCE(SUM(amount_collected), 0) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Revenue,
            (SELECT COALESCE(SUM(total_expenses), 0) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Expenses
        `, [y, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye, ys, ye]);

        const r = result[0] || {};
        rows.push({
          name: String(y),
          Sales: Number(r.Sales) > 0 ? Number(r.Sales) : Number(r.Quotes),
          Quotes: Number(r.Quotes || 0),
          Leads: Number(r.Leads || 0),
          Services: Number(r.Services || 0),
          Revenue: Number(r.Sales) > 0 ? Number(r.Sales) : (Number(r.Revenue) > 0 ? Number(r.Revenue) : Number(r.Quotes)),
          Expenses: Number(r.Expenses || 0),
        });
      }
      res.json(rows);
    } else {
      // Monthly trends (Jan to Dec of Current Year)
      const targetYear = new Date().getFullYear();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const rows = [];

      for (let m = 1; m <= 12; m++) {
        const ms = `${targetYear}-${String(m).padStart(2, "0")}-01`;
        const lastDay = new Date(targetYear, m, 0).getDate();
        const me = `${targetYear}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const [result] = await db.promise().query(`
          SELECT 
            (SELECT COALESCE(SUM(grand_total), 0) FROM performainvoices WHERE DATE(invoice_date) BETWEEN ? AND ? ${userFilter}) as Sales,
            (SELECT COALESCE(SUM(grand_total), 0) FROM quotations WHERE DATE(quotation_date) BETWEEN ? AND ? ${userFilter}) as Quotes,
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? ${userFilter}) +
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? ${userFilter}) +
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? ${userFilter}) as Leads,
            (SELECT COUNT(*) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Services,
            (SELECT COALESCE(SUM(amount_collected), 0) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Revenue,
            (SELECT COALESCE(SUM(total_expenses), 0) FROM call_reports WHERE (DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?))) as Expenses
        `, [ms, me, ms, me, ms, me, ms, me, ms, me, ms, me, ms, me, ms, me, ms, me, ms, me, ms, me]);

        const r = result[0] || {};
        const salesVal = Number(r.Sales || 0);
        const quotesVal = Number(r.Quotes || 0);

        rows.push({
          name: monthNames[m - 1],
          Sales: salesVal > 0 ? salesVal : quotesVal,
          Quotes: quotesVal,
          Leads: Number(r.Leads || 0),
          Services: Number(r.Services || 0),
          Revenue: salesVal > 0 ? salesVal : (Number(r.Revenue || 0) > 0 ? Number(r.Revenue) : quotesVal),
          Expenses: Number(r.Expenses || 0),
        });
      }
      res.json(rows);
    }
  } catch (err) {
    console.error("Trends error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 5. GET FINANCIALS & P&L SUMMARY ───────────────────────────────────────── */
router.get("/financials-summary", verifyToken, async (req, res) => {
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);

  try {
    // 1. Quotations by Status
    const [quotations] = await db.promise().query(
      `SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(grand_total), 0) as total_value,
        COUNT(CASE WHEN status IN ('Won', 'Approved', 'Accepted') THEN 1 END) as won_count,
        COALESCE(SUM(CASE WHEN status IN ('Won', 'Approved', 'Accepted') THEN grand_total ELSE 0 END), 0) as won_value,
        COUNT(CASE WHEN status IN ('Draft', 'Sent', 'Pending', 'In Review') OR status IS NULL THEN 1 END) as pending_count,
        COALESCE(SUM(CASE WHEN status IN ('Draft', 'Sent', 'Pending', 'In Review') OR status IS NULL THEN grand_total ELSE 0 END), 0) as pending_value,
        COUNT(CASE WHEN status = 'Lost' THEN 1 END) as lost_count,
        COALESCE(SUM(CASE WHEN status = 'Lost' THEN grand_total ELSE 0 END), 0) as lost_value
       FROM quotations 
       WHERE DATE(quotation_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // 2. Proforma Invoices
    const [invoices] = await db.promise().query(
      `SELECT COUNT(*) as count, COALESCE(SUM(grand_total), 0) as value,
              COALESCE(SUM(total_tax), 0) as tax,
              COALESCE(SUM(subtotal), 0) as subtotal
       FROM performainvoices 
       WHERE DATE(invoice_date) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // 3. Contracts (AMC)
    const [contracts] = await db.promise().query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount_value), 0) as value
       FROM contracts 
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    // 4. Service Expenses & Collections
    const [serviceFinancials] = await db.promise().query(
      `SELECT 
        COALESCE(SUM(amount_collected), 0) as collected,
        COALESCE(SUM(total_expenses), 0) as total_expenses,
        COALESCE(SUM(petrol_charges), 0) as petrol,
        COALESCE(SUM(spare_parts_price), 0) as spare_parts,
        COALESCE(SUM(labour_charges), 0) as labour
       FROM call_reports 
       WHERE DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)`,
      [startDate, endDate, startDate, endDate]
    );

    const q = quotations[0] || {};
    const inv = invoices[0] || {};
    const co = contracts[0] || {};
    const sf = serviceFinancials[0] || {};

    const billedValue = Number(inv.value || 0);
    const contractsValue = Number(co.value || 0);
    const totalExpenses = Number(sf.total_expenses || 0);
    const totalInflow = billedValue + contractsValue;
    const netProfit = totalInflow - totalExpenses;
    const profitMargin = totalInflow > 0 ? Math.round((netProfit / totalInflow) * 100) : 100;

    res.json({
      quotations: {
        totalCount: q.total_count || 0,
        totalValue: Number(q.total_value || 0),
        wonCount: q.won_count || 0,
        wonValue: Number(q.won_value || 0),
        pendingCount: q.pending_count || 0,
        pendingValue: Number(q.pending_value || 0),
        lostCount: q.lost_count || 0,
        lostValue: Number(q.lost_value || 0),
      },
      invoicing: {
        count: inv.count || 0,
        billedValue,
        subtotal: Number(inv.subtotal || 0),
        tax: Number(inv.tax || 0),
      },
      contracts: {
        count: co.count || 0,
        contractsValue,
      },
      serviceExpenses: {
        totalExpenses,
        petrol: Number(sf.petrol || 0),
        spareParts: Number(sf.spare_parts || 0),
        labour: Number(sf.labour || 0),
        collected: Number(sf.collected || 0),
      },
      summary: {
        totalInflow,
        totalExpenses,
        netProfit,
        profitMargin,
      }
    });
  } catch (err) {
    console.error("Financials summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 6. GET FIELD SERVICE & TECHNICIAN SUMMARY ─────────────────────────────── */
router.get("/services-summary", verifyToken, async (req, res) => {
  const { filter, from, to } = req.query;
  const { startDate, endDate } = getDateRange(filter, from, to);

  try {
    // 1. Status breakdown
    const [statusBreakdown] = await db.promise().query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount_collected), 0) as collected, COALESCE(SUM(total_expenses), 0) as expenses
       FROM call_reports 
       WHERE DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)
       GROUP BY status`,
      [startDate, endDate, startDate, endDate]
    );

    // 2. Service type breakdown
    const [typeBreakdown] = await db.promise().query(
      `SELECT COALESCE(service_type, 'General Service') as service_type, COUNT(*) as count, COALESCE(SUM(total_expenses), 0) as expenses
       FROM call_reports 
       WHERE DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)
       GROUP BY service_type`,
      [startDate, endDate, startDate, endDate]
    );

    // 3. Technician leaderboard
    const [technicians] = await db.promise().query(
      `SELECT 
        COALESCE(NULLIF(technician, ''), staff_name, 'Unassigned') as technician_name,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status IN ('Closed', 'Completed') THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN status NOT IN ('Closed', 'Completed') THEN 1 END) as pending_tickets,
        COALESCE(SUM(amount_collected), 0) as collected,
        COALESCE(SUM(total_expenses), 0) as expenses,
        COALESCE(SUM(petrol_charges), 0) as petrol,
        COALESCE(SUM(spare_parts_price), 0) as spare_parts
       FROM call_reports 
       WHERE DATE(report_date) BETWEEN ? AND ? OR (report_date IS NULL AND DATE(created_at) BETWEEN ? AND ?)
       GROUP BY technician_name
       ORDER BY total_tickets DESC`,
      [startDate, endDate, startDate, endDate]
    );

    res.json({
      statusBreakdown: statusBreakdown || [],
      typeBreakdown: typeBreakdown || [],
      technicians: technicians || [],
    });
  } catch (err) {
    console.error("Services summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── 7. GET LIVE USER ACTIVITY DASHBOARD (Admin only) ──────────────────────── */
router.get("/user-activity", verifyToken, async (req, res) => {
  const isAdmin = req.user.role === "admin" || req.user.role === "subadmin";
  if (!isAdmin) return res.status(403).json({ error: "Forbidden" });

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.substring(0, 7) + "-01";

  try {
    const [members] = await db.promise().query(
      `SELECT id, first_name, last_name, job_title, emp_email, emp_role, created_at FROM teammember ORDER BY first_name ASC`
    );

    const data = await Promise.all(
      members.map(async (emp) => {
        const empId = emp.id;
        const empName = `${emp.first_name} ${emp.last_name || ""}`.trim();
        const namePattern = `%${emp.first_name}%`;

        // 1. Today's leads
        const [todayLeads] = await db.promise().query(
          `SELECT
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_today,
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_today,
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) = ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_today
          `,
          [today, empId, namePattern, empId, today, empId, namePattern, empId, today, empId, namePattern, empId]
        );

        // 2. Month's leads
        const [monthLeads] = await db.promise().query(
          `SELECT
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_month,
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_month,
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_month,
            (SELECT COUNT(*) FROM telecalls WHERE DATE(call_date) BETWEEN ? AND ? AND call_outcome = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as tc_conv,
            (SELECT COUNT(*) FROM walkins WHERE DATE(walkin_date) BETWEEN ? AND ? AND walkin_status = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as wk_conv,
            (SELECT COUNT(*) FROM fields WHERE DATE(visit_date) BETWEEN ? AND ? AND field_outcome = 'Converted' AND (created_by = ? OR staff_name LIKE ? OR assigned_to = ?)) as fld_conv
          `,
          [
            monthStart, today, empId, namePattern, empId,
            monthStart, today, empId, namePattern, empId,
            monthStart, today, empId, namePattern, empId,
            monthStart, today, empId, namePattern, empId,
            monthStart, today, empId, namePattern, empId,
            monthStart, today, empId, namePattern, empId,
          ]
        );

        // 3. Call reports
        const [callReports] = await db.promise().query(
          `SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as closed,
            SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status NOT IN ('Closed', 'Completed') THEN 1 ELSE 0 END) as in_progress,
            COALESCE(SUM(amount_collected), 0) as collected,
            COALESCE(SUM(total_expenses), 0) as expenses
           FROM call_reports 
           WHERE (technician LIKE ? OR staff_name LIKE ? OR created_by = ?) 
             AND (DATE(report_date) = ? OR (report_date IS NULL AND DATE(created_at) = ?))`,
          [namePattern, namePattern, empId, today, today]
        );

        // 4. Quotations
        const [quotations] = await db.promise().query(
          `SELECT COUNT(*) as total, COALESCE(SUM(grand_total), 0) as value FROM quotations WHERE created_by = ? AND DATE(quotation_date) BETWEEN ? AND ?`,
          [empId, monthStart, today]
        );

        // 5. Tasks
        const [tasks] = await db.promise().query(
          `SELECT 
            COUNT(*) as total, 
            SUM(CASE WHEN project_status='Completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN project_status='In Progress' THEN 1 ELSE 0 END) as in_progress,
            SUM(CASE WHEN project_status='Pending' THEN 1 ELSE 0 END) as pending
           FROM tasks 
           WHERE (assigned_to = ? OR staff_name LIKE ?) AND project_status != 'Completed'`,
          [empId, namePattern]
        );

        // 6. Last Activity Timestamp
        const [lastAct] = await db.promise().query(
          `SELECT MAX(ts) as last_activity FROM (
            SELECT MAX(created_at) as ts FROM telecalls WHERE created_by = ?
            UNION SELECT MAX(created_at) FROM walkins WHERE created_by = ?
            UNION SELECT MAX(created_at) FROM fields WHERE created_by = ?
            UNION SELECT MAX(created_at) FROM call_reports WHERE created_by = ?
            UNION SELECT MAX(created_at) FROM quotations WHERE created_by = ?
            UNION SELECT MAX(created_at) FROM tasks WHERE assigned_to = ?
          ) as t`,
          [empId, empId, empId, empId, empId, empId]
        );

        const tl = todayLeads[0] || {};
        const ml = monthLeads[0] || {};
        const cr = callReports[0] || {};
        const tk = tasks[0] || {};
        const q = quotations[0] || {};

        const todayTotal = (tl.tc_today || 0) + (tl.wk_today || 0) + (tl.fld_today || 0);
        const monthTotal = (ml.tc_month || 0) + (ml.wk_month || 0) + (ml.fld_month || 0);
        const monthConverted = (ml.tc_conv || 0) + (ml.wk_conv || 0) + (ml.fld_conv || 0);
        const isActiveToday = todayTotal > 0 || (cr.total || 0) > 0;

        return {
          id: empId,
          name: empName,
          position: emp.job_title || emp.emp_role || "Staff",
          email: emp.emp_email || "",
          todayTelecalls: tl.tc_today || 0,
          todayWalkins: tl.wk_today || 0,
          todayFields: tl.fld_today || 0,
          todayLeads: todayTotal,
          monthTelecalls: ml.tc_month || 0,
          monthWalkins: ml.wk_month || 0,
          monthFields: ml.fld_month || 0,
          monthLeads: monthTotal,
          monthConverted,
          conversionRate: monthTotal > 0 ? Math.round((monthConverted / monthTotal) * 100) : 0,
          callReportsToday: cr.total || 0,
          callReportsClosed: cr.closed || 0,
          callReportsCompleted: cr.completed || 0,
          callReportsInProgress: cr.in_progress || 0,
          collectedToday: Number(cr.collected || 0),
          expensesToday: Number(cr.expenses || 0),
          quotationsMonthCount: q.total || 0,
          quotationsMonthValue: Number(q.value || 0),
          tasksPending: tk.pending || 0,
          tasksInProgress: tk.in_progress || 0,
          tasksTotal: tk.total || 0,
          isActiveToday,
          lastActivity: lastAct[0]?.last_activity || null,
        };
      })
    );

    res.json(data);
  } catch (err) {
    console.error("User-activity error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

