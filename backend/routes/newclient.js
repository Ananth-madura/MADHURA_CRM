const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");
const { getNotificationIO } = require("../sockets/notifications");

/* SEARCH CLIENT */
router.get("/search", verifyToken, (req, res) => {
  const search = `%${req.query.name || ""}%`;
  let sql = `SELECT id, name, company_name, phone, email, gst_number,
              address, address_2, lead_city, city, state, pincode
              FROM clients WHERE (name LIKE ? OR company_name LIKE ? OR phone LIKE ? OR email LIKE ?)`;
  const params = [search, search, search, search];

  if (req.user.role === "employee") {
    sql += ` AND (
      created_by = ? 
      OR assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
      OR (original_lead_type = 'telecall' AND original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'walkin' AND original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'field' AND original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      OR id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
    )`;
    params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }

  sql += " ORDER BY name ASC LIMIT 50";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Client search error:", err);
      return res.status(500).json({ message: "Search failed", error: err.message });
    }
    res.json(results);
  });
});

/* GET client converted from a specific lead */
router.get("/converted-from/:leadType/:leadId", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT * FROM clients WHERE original_lead_id = ? AND original_lead_type = ?";
  const params = [req.params.leadId, req.params.leadType];
  if (role === 'employee') {
    sql += ` AND (
      created_by = ? 
      OR assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
      OR (original_lead_type = 'telecall' AND original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'walkin' AND original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
      OR (original_lead_type = 'field' AND original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      OR id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
    )`;
    params.push(user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id);
  }
  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result[0] || null);
  });
});

/* EXPORT CLIENTS TO CSV */
router.get("/export", verifyToken, (req, res) => {
  if (req.user.role !== "admin" && req.user.role !== "subadmin" && req.user.role !== "employee") {
    return res.status(403).json({ message: "Access denied. Only admin, subadmin or employee can export clients." });
  }

  let sql = `
    SELECT c.*, CONCAT(t.first_name, ' ', COALESCE(t.last_name, '')) AS assigned_staff_name
    FROM clients c
    LEFT JOIN teammember t ON c.assigned_teammember_id = t.id
  `;
  const params = [];
  if (req.user.role === "employee") {
    sql += ` WHERE (
      c.created_by = ? 
      OR c.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
      OR (c.original_lead_type = 'telecall' AND c.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to = ?))
      OR (c.original_lead_type = 'walkin' AND c.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to = ?))
      OR (c.original_lead_type = 'field' AND c.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to = ?))
      OR c.id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
    )`;
    params.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }
  sql += " ORDER BY c.id DESC";
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error("Export Error:", err);
      return res.status(500).json({ error: err.message });
    }

    const headers = [
      "Customer name", "Company Name", "Email", "Contact number", "Contact number 2",
      "Contact person", "Address", "Address 2", "City", "State", "Pincode",
      "Service Interest", "GST Number", "Client Status", "Assigned Staff", "Notes"
    ];

    let csvContent = headers.join(",") + "\r\n";

    results.forEach(c => {
      const row = [
        c.name || "",
        c.company_name || "",
        c.email || "",
        c.phone || "",
        c.alternate_phone || "",
        c.contact_person || "",
        c.address || "",
        c.address_2 || "",
        c.city || "",
        c.state || "",
        c.pincode || "",
        c.service || "",
        c.gst_number || "",
        c.client_status || "active",
        c.assigned_staff_name || "",
        c.notes || ""
      ].map(val => {
        let stringVal = String(val).replace(/"/g, '""');
        if (stringVal.includes(",") || stringVal.includes("\n") || stringVal.includes("\r") || stringVal.includes('"')) {
          stringVal = `"${stringVal}"`;
        }
        return stringVal;
      });
      csvContent += row.join(",") + "\r\n";
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=clients_export.csv");
    return res.status(200).send(csvContent);
  });
});

/* IMPORT CLIENTS FROM JSON (Bulk/Optimized/Transaction-based) */
router.post("/import", verifyToken, async (req, res) => {
  if (req.user.role !== "admin" && req.user.role !== "subadmin" && req.user.role !== "employee") {
    return res.status(403).json({ message: "Access denied. Only admin, subadmin or employee can import clients." });
  }

  const { clients } = req.body;
  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(400).json({ message: "No client data provided or invalid format." });
  }

  const queryAsync = (sql, params) => {
    return new Promise((resolve, reject) => {
      db.query(sql, params, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });
  };

  const beginTransactionAsync = () => {
    return new Promise((resolve, reject) => {
      db.beginTransaction((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  };

  const commitAsync = () => {
    return new Promise((resolve, reject) => {
      db.commit((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  };

  const rollbackAsync = () => {
    return new Promise((resolve) => {
      db.rollback(() => {
        resolve();
      });
    });
  };

  try {
    // Start transaction
    await beginTransactionAsync();

    // 1. Fetch team members to resolve staff names/IDs
    let teamMembers = [];
    try {
      teamMembers = await queryAsync("SELECT id, first_name, last_name, emp_email, emp_id FROM teammember", []);
    } catch (err) {
      console.error("Error fetching team members for client import:", err);
    }

    // Helpers to extract fields dynamically case-insensitively and space/underscore-insensitively
    const getVal = (obj, keys) => {
      for (const key of keys) {
        if (obj[key] !== undefined) return obj[key];
        const normalizedKey = key.toLowerCase().replace(/[\s_-]/g, "");
        for (const k in obj) {
          const normalizedK = k.toLowerCase().replace(/[\s_-]/g, "");
          if (normalizedKey === normalizedK) {
            return obj[k];
          }
        }
      }
      return undefined;
    };

    const findTeamMemberId = (value) => {
      if (!value) return null;
      const valStr = String(value).trim().toLowerCase();
      if (!valStr) return null;

      const matchById = teamMembers.find(t => String(t.id) === valStr || (t.emp_id && String(t.emp_id).trim().toLowerCase() === valStr));
      if (matchById) return matchById.id;

      const matchByEmail = teamMembers.find(t => t.emp_email && t.emp_email.trim().toLowerCase() === valStr);
      if (matchByEmail) return matchByEmail.id;

      const matchByName = teamMembers.find(t => {
        const fullName = `${t.first_name || ""} ${t.last_name || ""}`.trim().toLowerCase();
        return fullName === valStr || (t.first_name && t.first_name.trim().toLowerCase() === valStr);
      });
      if (matchByName) return matchByName.id;

      return null;
    };

    let importedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors = [];

    // 2. Parse and normalize all input rows
    const parsedClients = [];
    const emailsToLookup = new Set();
    const phonesToLookup = new Set();

    // Map to prevent duplicate rows *within* the upload itself
    const phoneMapInBatch = {};
    const emailMapInBatch = {};

    clients.forEach((c, index) => {
      const nameRaw = getVal(c, ["name", "client_name", "client name", "customer_name", "customer name", "full_name", "full name", "client", "customer", "first_name", "first name", "firstname"]);
      const name = nameRaw ? String(nameRaw).trim() : "";

      if (!name) {
        failedCount++;
        errors.push(`Row ${index + 1}: Name is required`);
        return;
      }

      const company_name = getVal(c, ["company_name", "company name", "companyname", "company", "firm", "firm_name", "firm name", "business", "business_name", "business name", "organisation", "organization", "org"]) || "";
      const emailRaw = getVal(c, ["email", "email_address", "email address", "emailaddress", "mail", "mail_address", "mail address"]);
      const email = emailRaw ? String(emailRaw).trim() : "";
      const phoneRaw = getVal(c, ["phone", "contact_number", "contact number", "contactnumber", "phone_number", "phone number", "phonenumber", "mobile", "mobile_number", "mobile number", "mobilenumber", "contact", "phone no", "mobile no"]);
      const phone = phoneRaw ? String(phoneRaw).trim() : "";
      const alternate_phone = getVal(c, ["alternate_phone", "contact_number_2", "contact number 2", "contactnumber2", "alternate phone", "alternatephone", "alternate_phone", "secondary_phone", "secondary phone", "secondaryphone"]) || "";
      const contact_person = getVal(c, ["contact_person", "contact person", "contactperson", "person", "contact_name", "contact name", "attn", "attention"]) || "";
      const address = getVal(c, ["address", "address_1", "address 1", "address1", "street", "street_address", "street address", "location"]) || "";
      const address_2 = getVal(c, ["address_2", "address 2", "address2", "addr2", "address_line_2", "address line 2", "area", "landmark"]) || "";
      const city = getVal(c, ["city", "town", "district", "city_town", "city town", "location_city", "location city"]) || "";
      const state = getVal(c, ["state", "province", "region"]) || "";
      const pincode = getVal(c, ["pincode", "pin_code", "pin code", "pin", "zip", "zip_code", "zip code", "zipcode", "postal_code", "postal code", "postalcode", "postal"]) || "";
      const service = getVal(c, ["service", "service_interest", "service interest", "serviceinterest", "interest", "purpose", "requirement", "service_type", "service type", "servicetype"]) || "";
      const gst_number = getVal(c, ["gst_number", "gst number", "gstnumber", "gst", "gstin", "gst_no", "gst no", "gstno"]) || "";

      const statusRaw = getVal(c, ["client_status", "client status", "clientstatus", "status", "type", "client_type", "client type"]) || "active";
      const client_status = String(statusRaw).toLowerCase().trim();
      const validStatuses = ["active", "inactive", "prospect", "converted"];
      const finalStatus = validStatuses.includes(client_status) ? client_status : "active";

      const notes = getVal(c, ["notes", "remarks", "description", "comment", "comments", "about", "detail", "details"]) || "";

      const staffVal = getVal(c, ["assigned_staff", "assigned staff", "assignedstaff", "assigned_staff_name", "assigned staff name", "assigned_teammember_id", "assigned teammember id", "assigned_teammember", "assigned teammember", "staff", "staff_name", "staff name", "assigned_to", "assigned to", "employee", "salesperson", "agent", "executive", "executive_name", "executive name"]);
      const assigned_teammember_id = findTeamMemberId(staffVal);

      const parsedClient = {
        rowIndex: index + 1,
        name, company_name, email, phone, alternate_phone, contact_person, address, address_2, city, state, pincode, service, gst_number, notes, finalStatus, assigned_teammember_id
      };

      parsedClients.push(parsedClient);
      if (email) emailsToLookup.add(email);
      if (phone) phonesToLookup.add(phone);
    });

    // 3. Query existing records for bulk lookup
    const existingClientsMap = {};
    if (emailsToLookup.size > 0 || phonesToLookup.size > 0) {
      const lookupConditions = [];
      const lookupParams = [];

      if (phonesToLookup.size > 0) {
        lookupConditions.push("phone IN (?)");
        lookupParams.push(Array.from(phonesToLookup));
      }
      if (emailsToLookup.size > 0) {
        lookupConditions.push("email IN (?)");
        lookupParams.push(Array.from(emailsToLookup));
      }

      const lookupSql = `SELECT id, phone, email FROM clients WHERE ${lookupConditions.join(" OR ")}`;
      const dbRows = await queryAsync(lookupSql, lookupParams);

      dbRows.forEach(r => {
        if (r.phone) existingClientsMap[`phone:${r.phone}`] = r.id;
        if (r.email) existingClientsMap[`email:${r.email}`] = r.id;
      });
    }

    // 4. Categorize to insert vs update
    const toInsert = [];
    const toUpdate = [];

    parsedClients.forEach(c => {
      let existingId = null;
      if (c.phone && existingClientsMap[`phone:${c.phone}`]) {
        existingId = existingClientsMap[`phone:${c.phone}`];
      } else if (c.email && existingClientsMap[`email:${c.email}`]) {
        existingId = existingClientsMap[`email:${c.email}`];
      }

      // Check duplicates *within* this batch upload itself
      let isDuplicateInBatch = false;
      if (c.phone) {
        if (phoneMapInBatch[c.phone]) {
          isDuplicateInBatch = true;
        } else {
          phoneMapInBatch[c.phone] = true;
        }
      }
      if (c.email) {
        if (emailMapInBatch[c.email]) {
          isDuplicateInBatch = true;
        } else {
          emailMapInBatch[c.email] = true;
        }
      }

      if (isDuplicateInBatch) {
        failedCount++;
        errors.push(`Row ${c.rowIndex}: Duplicate phone/email in the uploaded file.`);
        return;
      }

      if (existingId) {
        toUpdate.push({
          id: existingId,
          ...c
        });
      } else {
        toInsert.push([
          c.name, c.company_name, c.email, c.phone, c.alternate_phone, c.contact_person,
          c.address, c.address_2, c.city, c.state, c.pincode, c.service, c.gst_number,
          c.notes, c.finalStatus, req.user.id, c.assigned_teammember_id
        ]);
      }
    });

    // 5. Execute insertions in one bulk statement
    if (toInsert.length > 0) {
      const insertSql = `
        INSERT INTO clients 
        (name, company_name, email, phone, alternate_phone, contact_person, address, address_2, city, state, pincode, service, gst_number, notes, client_status, created_by, assigned_teammember_id)
        VALUES ?
      `;
      try {
        await queryAsync(insertSql, [toInsert]);
        importedCount += toInsert.length;
      } catch (err) {
        console.error("Bulk insert error:", err);
        throw err; // Cause rollback
      }
    }

    // 6. Execute updates in small parallel batches inside the transaction
    if (toUpdate.length > 0) {
      const updateSql = `
        UPDATE clients SET 
          name = ?, company_name = ?, email = ?, phone = ?, alternate_phone = ?, contact_person = ?, address = ?, address_2 = ?, city = ?, state = ?, pincode = ?, service = ?, gst_number = ?, notes = ?, client_status = ?, assigned_teammember_id = ?
        WHERE id = ?
      `;

      const UPDATE_BATCH_SIZE = 50;
      for (let idx = 0; idx < toUpdate.length; idx += UPDATE_BATCH_SIZE) {
        const batch = toUpdate.slice(idx, idx + UPDATE_BATCH_SIZE);
        await Promise.all(batch.map(async (u) => {
          try {
            await queryAsync(updateSql, [
              u.name, u.company_name, u.email, u.phone, u.alternate_phone, u.contact_person,
              u.address, u.address_2, u.city, u.state, u.pincode, u.service, u.gst_number,
              u.notes, u.finalStatus, u.assigned_teammember_id, u.id
            ]);
            updatedCount++;
          } catch (err) {
            console.error(`Update error for ID ${u.id}:`, err);
            failedCount++;
            errors.push(`Row ${u.rowIndex} update error: ${err.message}`);
          }
        }));
      }
    }

    // Commit transaction
    await commitAsync();

    res.json({
      message: "Import process completed",
      total: clients.length,
      imported: importedCount,
      updated: updatedCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined
    });

  } catch (err) {
    // Roll back if error occurs
    await rollbackAsync();
    console.error("Import global error, transaction rolled back:", err);
    res.status(500).json({ message: "Import failed during transaction processing", error: err.message });
  }
});

/* GET ALL CLIENTS with optional filters */
router.get("/", verifyToken, (req, res) => {
  const { search, source, date_from, date_to, tab } = req.query;

  // Base filters for SQL
  let filterSql = "";
  const filterParams = [];

  if (req.user.role === "employee") {
    filterSql += ` AND (
      c.created_by = ? 
      OR c.assigned_teammember_id IN (SELECT id FROM teammember WHERE user_id = ?)
      OR (c.original_lead_type = 'telecall' AND c.original_lead_id IN (SELECT id FROM telecalls WHERE created_by = ? OR assigned_to IN (SELECT id FROM teammember WHERE user_id = ?) OR assigned_to = ?))
      OR (c.original_lead_type = 'walkin' AND c.original_lead_id IN (SELECT id FROM walkins WHERE created_by = ? OR assigned_to IN (SELECT id FROM teammember WHERE user_id = ?) OR assigned_to = ?))
      OR (c.original_lead_type = 'field' AND c.original_lead_id IN (SELECT id FROM fields WHERE created_by = ? OR assigned_to IN (SELECT id FROM teammember WHERE user_id = ?) OR assigned_to = ?))
      OR c.id IN (SELECT client_id FROM client_shares WHERE shared_to IN (SELECT id FROM teammember WHERE user_id = ?))
    )`;
    filterParams.push(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  }

  if (search) {
    filterSql += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.company_name LIKE ? OR c.city LIKE ?)";
    const s = `%${search}%`;
    filterParams.push(s, s, s, s, s);
  }

  if (source && source !== "all") {
    if (source === "direct") {
      filterSql += " AND (c.original_lead_type IS NULL OR c.original_lead_type = '' OR c.original_lead_type = 'direct' OR c.source = 'direct')";
    } else {
      filterSql += " AND (c.original_lead_type = ? OR c.source = ?)";
      filterParams.push(source, source);
    }
  }

  if (date_from) {
    filterSql += " AND c.created_at >= ?";
    filterParams.push(date_from);
  }

  if (date_to) {
    filterSql += " AND c.created_at <= ?";
    filterParams.push(date_to + " 23:59:59");
  }

  // Check if pagination is requested
  const pageParam = req.query.page;
  if (pageParam === undefined) {
    // BACKWARD COMPATIBLE RAW ARRAY response
    let tabSql = "";
    if (tab === "converted") {
      tabSql = " AND c.original_lead_id IS NOT NULL AND c.original_lead_type IS NOT NULL";
    } else if (tab === "direct") {
      tabSql = " AND (c.original_lead_id IS NULL OR c.original_lead_type IS NULL)";
    }

    const sql = `
      SELECT c.*, u.first_name as creator_name,
             tm.first_name as assigned_staff_name, tm.emp_role as assigned_staff_role,
             u_shared.first_name as shared_by_name,
             (SELECT COUNT(*) FROM client_shares WHERE client_id = c.id) AS share_count,
             (SELECT GROUP_CONCAT(tm2.first_name SEPARATOR ', ') FROM client_shares cs2 JOIN teammember tm2 ON cs2.shared_to = tm2.id WHERE cs2.client_id = c.id) AS shared_with_names
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN teammember tm ON c.assigned_teammember_id = tm.id
      LEFT JOIN client_shares cs_me ON cs_me.client_id = c.id AND cs_me.shared_to IN (SELECT id FROM teammember WHERE user_id = ${db.escape(req.user.id)})
      LEFT JOIN users u_shared ON cs_me.shared_by = u_shared.id
      WHERE 1=1 ${filterSql} ${tabSql}
      ORDER BY c.id DESC
    `;
    db.query(sql, filterParams, (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    });
    return;
  }

  // PAGINATED response
  const page = parseInt(pageParam, 10) || 1;
  const limitQuery = req.query.limit;

  // Run stats count query under these filters (before tab filter is applied)
  const countSql = `
    SELECT 
      COUNT(*) as totalCount,
      SUM(CASE WHEN c.client_status = 'active' THEN 1 ELSE 0 END) as activeCount,
      SUM(CASE WHEN c.original_lead_id IS NOT NULL AND c.original_lead_type IS NOT NULL THEN 1 ELSE 0 END) as convertedCount,
      SUM(CASE WHEN c.original_lead_id IS NULL OR c.original_lead_type IS NULL THEN 1 ELSE 0 END) as directCount
    FROM clients c
    WHERE 1=1 ${filterSql}
  `;

  db.query(countSql, filterParams, (err, countResults) => {
    if (err) {
      console.error("Client counts query error:", err);
      return res.status(500).json({ message: "Failed to load client counts", error: err.message });
    }

    const counts = countResults[0] || { totalCount: 0, activeCount: 0, convertedCount: 0, directCount: 0 };
    const totalCount = counts.totalCount || 0;
    const activeCount = counts.activeCount || 0;
    const convertedCount = counts.convertedCount || 0;
    const directCount = counts.directCount || 0;

    // Determine total matching records for the selected tab
    let totalFiltered = totalCount;
    let tabSql = "";
    if (tab === "converted") {
      tabSql = " AND c.original_lead_id IS NOT NULL AND c.original_lead_type IS NOT NULL";
      totalFiltered = convertedCount;
    } else if (tab === "direct") {
      tabSql = " AND (c.original_lead_id IS NULL OR c.original_lead_type IS NULL)";
      totalFiltered = directCount;
    }

    // List query
    let listSql = `
      SELECT c.*, u.first_name as creator_name,
             tm.first_name as assigned_staff_name, tm.emp_role as assigned_staff_role,
             u_shared.first_name as shared_by_name,
             (SELECT COUNT(*) FROM client_shares WHERE client_id = c.id) AS share_count,
             (SELECT GROUP_CONCAT(tm2.first_name SEPARATOR ', ') FROM client_shares cs2 JOIN teammember tm2 ON cs2.shared_to = tm2.id WHERE cs2.client_id = c.id) AS shared_with_names
      FROM clients c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN teammember tm ON c.assigned_teammember_id = tm.id
      LEFT JOIN client_shares cs_me ON cs_me.client_id = c.id AND cs_me.shared_to IN (SELECT id FROM teammember WHERE user_id = ${db.escape(req.user.id)})
      LEFT JOIN users u_shared ON cs_me.shared_by = u_shared.id
      WHERE 1=1 ${filterSql} ${tabSql}
      ORDER BY c.id DESC
    `;

    const listParams = [...filterParams];

    // Handle pagination limits
    const isUnpaginated = limitQuery === "none" || limitQuery === "all";
    if (!isUnpaginated) {
      const limitNum = parseInt(limitQuery, 10) || 50;
      const offset = (page - 1) * limitNum;
      listSql += " LIMIT ? OFFSET ?";
      listParams.push(limitNum, offset);
    }

    db.query(listSql, listParams, (err, clients) => {
      if (err) {
        console.error("Clients query error:", err);
        return res.status(500).json({ message: "Failed to load clients", error: err.message });
      }

      const limitNum = isUnpaginated ? totalFiltered : (parseInt(limitQuery, 10) || 50);
      res.json({
        clients,
        total: totalFiltered,
        page,
        limit: limitNum,
        totalPages: limitNum > 0 ? Math.ceil(totalFiltered / limitNum) : 1,
        counts: {
          total: totalCount,
          active: activeCount,
          converted: convertedCount,
          direct: directCount
        }
      });
    });
  });
});

/* GET single client */
router.get("/:id", verifyToken, (req, res) => {
  db.query(
    `SELECT c.*, u.first_name as creator_name,
            tm.first_name as assigned_staff_name, tm.emp_role as assigned_staff_role
     FROM clients c
     LEFT JOIN users u ON c.created_by = u.id
     LEFT JOIN teammember tm ON c.assigned_teammember_id = tm.id
     WHERE c.id = ?`,
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0) return res.status(404).json({ message: "Client not found" });
      res.json(result[0]);
    }
  );
});

/* CREATE CLIENT */
router.post("/", verifyToken, (req, res) => {
  const { name, company_name, email, phone, alternate_phone, contact_person, address, address_2, city, state, pincode, service, gst_number, notes, client_status, assigned_teammember_id, landline_number, alternate_mobile_number, reference_by, nearest_landmark } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });

  // Check duplicates
  const checks = [];
  if (phone) checks.push({ sql: "SELECT id, name, phone FROM clients WHERE phone = ?", params: [phone] });
  if (email) checks.push({ sql: "SELECT id, name, email FROM clients WHERE email = ?", params: [email] });

  if (checks.length === 0) {
    return doInsertClient();
  }

  let completed = 0;
  const duplicates = [];
  checks.forEach((c) => {
    db.query(c.sql, c.params, (err, rows) => {
      if (err) {
        console.error("Client duplicate check error:", err);
        completed++;
        if (completed === checks.length) doInsertClient();
        return;
      }
      if (rows.length > 0) duplicates.push({ name: rows[0].name, phone: rows[0].phone || rows[0].email });
      completed++;
      if (completed === checks.length) {
        if (duplicates.length > 0) {
          const msgs = duplicates.map(d => `${d.name} (${d.phone || "N/A"})`);
          return res.status(409).json({ message: "Duplicate client found", duplicates, details: `Phone/Email already exists: ${msgs.join("; ")}` });
        }
        doInsertClient();
      }
    });
  });

  function doInsertClient() {
    const sql = `INSERT INTO clients (name, company_name, email, phone, alternate_phone, contact_person, address, address_2, city, state, pincode, service, gst_number, notes, client_status, created_by, assigned_teammember_id, landline_number, alternate_mobile_number, reference_by, nearest_landmark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      name.trim(),
      company_name || "",
      email || "",
      phone || "",
      alternate_phone || "",
      contact_person || "",
      address || "",
      address_2 || "",
      city || "",
      state || "",
      pincode || "",
      service || "",
      gst_number || "",
      notes || "",
      client_status || "active",
      req.user.id,
      assigned_teammember_id || null,
      landline_number || null,
      alternate_mobile_number || null,
      reference_by || null,
      nearest_landmark || null
    ];
    db.query(sql, values, (err, result) => {
      try {
        const { triggerAutomation } = require("../services/waAutomationService");
        triggerAutomation("welcome_message", {
          phone: phone,
          contactName: name,
          data: { name, company_name, email, service, city }
        }).catch(e => console.error("WA Automation trigger error:", e.message));
      } catch (_) {}

      res.json({ message: "Client created successfully", id: result.insertId });
    });
  }
});

/* UPDATE CLIENT */
router.put("/:id", verifyToken, (req, res) => {
  const { name, company_name, email, phone, alternate_phone, contact_person, address, address_2, city, state, pincode, service, gst_number, notes, client_status, assigned_teammember_id, landline_number, alternate_mobile_number, reference_by, nearest_landmark } = req.body;

  // Check duplicates (exclude current client)
  const checks = [];
  if (phone) checks.push({ sql: "SELECT id, name, phone FROM clients WHERE phone = ? AND id != ?", params: [phone, req.params.id] });
  if (email) checks.push({ sql: "SELECT id, name, email FROM clients WHERE email = ? AND id != ?", params: [email, req.params.id] });

  if (checks.length === 0) {
    return doUpdateClient();
  }

  let completed = 0;
  const duplicates = [];
  checks.forEach((c) => {
    db.query(c.sql, c.params, (err, rows) => {
      if (err) {
        console.error("Client duplicate check error:", err);
        completed++;
        if (completed === checks.length) doUpdateClient();
        return;
      }
      if (rows.length > 0) duplicates.push({ name: rows[0].name, phone: rows[0].phone || rows[0].email });
      completed++;
      if (completed === checks.length) {
        if (duplicates.length > 0) {
          const msgs = duplicates.map(d => `${d.name} (${d.phone || "N/A"})`);
          return res.status(409).json({ message: "Duplicate client found", duplicates, details: `Phone/Email already exists: ${msgs.join("; ")}` });
        }
        doUpdateClient();
      }
    });
  });

  function doUpdateClient() {
    db.query(
      "UPDATE clients SET name=?, company_name=?, email=?, phone=?, alternate_phone=?, contact_person=?, address=?, address_2=?, city=?, state=?, pincode=?, service=?, gst_number=?, notes=?, client_status=?, assigned_teammember_id=?, landline_number=?, alternate_mobile_number=?, reference_by=?, nearest_landmark=? WHERE id=?",
      [name, company_name || "", email || "", phone || "", alternate_phone || "",
        contact_person || "", address || "", address_2 || "", city || "", state || "", pincode || "",
        service || "", gst_number || "", notes || "", client_status || "active",
        assigned_teammember_id || null, landline_number || null, alternate_mobile_number || null,
        reference_by || null, nearest_landmark || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Client updated successfully" });
      }
    );
  }
});

/* DELETE CLIENT */
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  const clientId = req.params.id;

  db.beginTransaction(err => {
    if (err) {
      console.error("Transaction start error:", err);
      return res.status(500).json({ error: "Transaction failed" });
    }

    db.query("SELECT created_by FROM clients WHERE id = ?", [clientId], (err, results) => {
      if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
      if (results.length === 0) return db.rollback(() => res.status(404).json({ message: "Client not found" }));

      if (req.user.role !== "admin" && results[0].created_by !== req.user.id) {
        return db.rollback(() => res.status(403).json({ message: "Access denied" }));
      }

      // Clean up related records to avoid foreign key constraint errors
      const cleanupQueries = [
        "DELETE FROM quotations WHERE customer_id IN (SELECT id FROM customers WHERE mobile_number = (SELECT phone FROM clients WHERE id = ?) OR email = (SELECT email FROM clients WHERE id = ?))",
        "DELETE FROM customers WHERE mobile_number = (SELECT phone FROM clients WHERE id = ?) OR email = (SELECT email FROM clients WHERE id = ?)",
      ];

      let completed = 0;
      let hasError = false;

      const runCleanup = (index) => {
        if (index >= cleanupQueries.length) {
          // Finally delete the client
          db.query("DELETE FROM clients WHERE id = ?", [clientId], (err) => {
            if (err) return db.rollback(() => res.status(500).json({ error: err.message }));
            db.commit(err => {
              if (err) return db.rollback(() => res.status(500).json({ error: "Commit failed" }));
              res.json({ message: "Client deleted successfully" });
            });
          });
          return;
        }

        db.query(cleanupQueries[index], [clientId, clientId], (err) => {
          if (err && !hasError) {
            hasError = true;
            console.error("Client cleanup error:", err);
            // Continue anyway - some tables may not exist or have no related records
          }
          runCleanup(index + 1);
        });
      };

      runCleanup(0);
    });
  });
});

/* SHARE CLIENT */
router.post("/share", verifyToken, (req, res) => {
  const { client_id, shared_to } = req.body; // shared_to is an array of teammember_ids
  if (!client_id || !Array.isArray(shared_to)) {
    return res.status(400).json({ message: "client_id and shared_to array of teammember_ids are required" });
  }

  // 1. Get client details for notification info
  db.query("SELECT name, created_by FROM clients WHERE id = ?", [client_id], (clientErr, clientRows) => {
    if (clientErr) return res.status(500).json({ error: clientErr.message });
    if (clientRows.length === 0) return res.status(404).json({ message: "Client not found" });

    const clientName = clientRows[0].name;

    // Verify employee has access to share this client (must be creator, assigned staff, admin or subadmin)
    const isAdminUser = req.user.role === 'admin' || req.user.role === 'subadmin';
    const isCreator = clientRows[0].created_by === req.user.id;

    const checkAccess = (callback) => {
      if (isAdminUser || isCreator) return callback(true);
      // Check if assigned staff
      db.query("SELECT id FROM teammember WHERE user_id = ? LIMIT 1", [req.user.id], (tmErr, tmRows) => {
        if (!tmErr && tmRows.length > 0) {
          const myTmId = tmRows[0].id;
          db.query("SELECT id FROM clients WHERE id = ? AND assigned_teammember_id = ?", [client_id, myTmId], (checkErr, checkRows) => {
            if (!checkErr && checkRows.length > 0) return callback(true);

            // Check if shared with me
            db.query("SELECT id FROM client_shares WHERE client_id = ? AND shared_to = ?", [client_id, myTmId], (shareErr, shareRows) => {
              callback(!shareErr && shareRows.length > 0);
            });
          });
        } else {
          callback(false);
        }
      });
    };

    checkAccess((hasAccess) => {
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to share this client" });
      }

      // 2. Fetch team member details to build the admin notification message
      db.query("SELECT id, CONCAT(first_name, ' ', COALESCE(last_name, '')) AS name FROM teammember WHERE id IN (?)", [shared_to.length > 0 ? shared_to : [0]], (teamErr, teamRows) => {
        if (teamErr) return res.status(500).json({ error: teamErr.message });

        const sharedNames = teamRows.map(r => r.name).join(", ");
        const senderName = req.user.name || req.user.first_name || "Employee";

        // Start transaction for database inserts
        db.beginTransaction((transactionErr) => {
          if (transactionErr) return res.status(500).json({ error: transactionErr.message });

          // Delete existing shares for this client
          db.query("DELETE FROM client_shares WHERE client_id = ?", [client_id], (deleteErr) => {
            if (deleteErr) {
              return db.rollback(() => res.status(500).json({ error: deleteErr.message }));
            }

            if (shared_to.length === 0) {
              // Just clearing shares
              db.commit((commitErr) => {
                if (commitErr) {
                  return db.rollback(() => res.status(500).json({ error: commitErr.message }));
                }
                return res.json({ message: "Client shares updated successfully" });
              });
              return;
            }

            // Insert new shares
            const insertSql = "INSERT INTO client_shares (client_id, shared_by, shared_to) VALUES ?";
            const insertValues = shared_to.map(tmId => [client_id, req.user.id, tmId]);

            db.query(insertSql, [insertValues], (insertErr) => {
              if (insertErr) {
                return db.rollback(() => res.status(500).json({ error: insertErr.message }));
              }

              // Create admin notification
              const notificationMessage = `${senderName} shared client "${clientName}" to employee(s) [${sharedNames}]`;
              db.query("INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority) VALUES (?, ?, ?, ?, ?, ?)",
                ["client_shared", 0, notificationMessage, client_id, "client", "medium"],
                (notifErr, notifResult) => {
                  if (notifErr) {
                    console.error("Admin notification insert failed:", notifErr);
                  } else {
                    // Send notification via socket if available
                    const notificationIO = getNotificationIO();
                    if (notificationIO) {
                      notificationIO.sendToAdmin("new_notification", {
                        id: notifResult.insertId,
                        type: "client_shared",
                        message: notificationMessage,
                        employee_name: senderName,
                        priority: "medium",
                        is_read: 0,
                        created_at: new Date().toISOString()
                      });
                    }
                  }

                  db.commit((commitErr) => {
                    if (commitErr) {
                      return db.rollback(() => res.status(500).json({ error: commitErr.message }));
                    }
                    res.json({ message: "Client shares updated successfully" });
                  });
                }
              );
            });
          });
        });
      });
    });
  });
});

/* GET SHARED CLIENT MEMBERS */
router.get("/:id/shares", verifyToken, (req, res) => {
  db.query("SELECT shared_to FROM client_shares WHERE client_id = ?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => r.shared_to));
  });
});

module.exports = router;
