const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

const { getNotificationIO } = require("../sockets/notifications");

// FROM ADDRESSES (shared table)
router.get("/from-addresses", verifyToken, (req, res) => {
  db.query("SELECT * FROM pi_from_addresses ORDER BY id ASC", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});
router.post("/from-addresses", verifyToken, (req, res) => {
  const { label, address } = req.body;
  if (!label || !address) return res.status(400).json({ message: "Label and address required" });
  db.query("INSERT INTO pi_from_addresses (label, address) VALUES (?,?)", [label, address], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ id: result.insertId, label, address });
  });
});
router.delete("/from-addresses/:id", verifyToken, isAdmin, (req, res) => {
  db.query("DELETE FROM pi_from_addresses WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Deleted" });
  });
});

router.get("/", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT q.id, DATE_FORMAT(q.quotation_date, '%Y-%m-%d') AS invoice_date, q.grand_total, q.reference_no,
           q.version, q.is_latest, q.parent_id, q.status, q.created_by,
           c.customer_name, c.mobile_number, c.email,
           COALESCE(c.location_city, q.client_city) AS location_city,
           q.client_state, q.client_country,
           u.first_name AS creator_name,
           MIN(qi.description) AS description
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id
    LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
    LEFT JOIN users u ON u.id = q.created_by
    WHERE q.is_latest = 1`;

  const params = [];
  if (role === "employee") {
    sql += ` AND (
      q.created_by = ?
      OR q.customer_id IN (
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

  sql += " GROUP BY q.id, u.first_name ORDER BY q.id DESC";
  db.query(sql, params, (err, rows) => {
    if (err) { console.error(err); return res.status(500).json(err); }
    res.json(rows);
  });
});

// GET all versions of a quotation (history — includes current latest)
router.get("/customer-history/:id", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT q.id, DATE_FORMAT(q.quotation_date, '%Y-%m-%d') AS invoice_date,
           DATE_FORMAT(q.created_at, '%Y-%m-%d') AS created_at,
           q.grand_total, q.reference_no,
           q.version, q.is_latest, q.parent_id,
           c.customer_name, c.mobile_number, c.email,
           COALESCE(q.client_city, c.location_city) AS location_city,
           q.client_state, q.client_country
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id
    WHERE (
        q.parent_id = ?
        OR q.id = ?
        OR q.id = (SELECT parent_id FROM quotations WHERE id = ?)
        OR q.parent_id = (SELECT parent_id FROM quotations WHERE id = ? AND parent_id IS NOT NULL)
      )`;

  const params = [req.params.id, req.params.id, req.params.id, req.params.id];
  if (role === "employee") {
    sql += ` AND (
      q.created_by = ?
      OR q.customer_id IN (
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

  sql += " ORDER BY q.version ASC, q.id ASC";
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    const seen = new Set();
    const unique = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    res.json(unique);
  });
});



/* GET INVOICE */
router.get("/:id", verifyToken, (req, res) => {
  const id = req.params.id;
  const { id: user_id, role } = req.user;
  let sql = `
    SELECT 
      q.id AS quotation_id,
      DATE_FORMAT(q.quotation_date, '%Y-%m-%d') AS invoice_date,
      q.subtotal, q.total_tax, q.total_cgst, q.total_sgst, q.total_igst, q.total_discount, q.grand_total,
      q.reference_no, q.from_address_id, q.from_address_custom,
      COALESCE(q.from_address_custom, fa.address) AS resolved_from_address,
      q.client_company, q.client_address1, q.client_address2, q.client_city,
      q.client_state, q.client_pincode, q.client_country,
      q.tax_type, q.custom_tax, q.exec_name, q.exec_phone, q.exec_email,
      q.terms_general, q.terms_tax, q.terms_project_period, q.terms_validity,
      q.terms_separate_orders, q.terms_payment, q.terms_payment_custom, q.terms_warranty,
      q.hsn_sac_code, q.supplier_branch,
      q.bank_details_id, q.bank_company, q.bank_name, q.bank_account, q.bank_ifsc, q.bank_branch, q.custom_terms, q.gst_mode,
      c.customer_name, c.mobile_number, c.email, c.gst_number, c.location_city,
      qi.product_number, qi.description, qi.brand_model, qi.uom,
      qi.price, qi.quantity, qi.tax, qi.discount, qi.subtotal AS item_subtotal,
      qi.hsn_sac
    FROM quotations q
    JOIN customers c ON c.id = q.customer_id
    JOIN quotation_items qi ON qi.quotation_id = q.id
    LEFT JOIN pi_from_addresses fa ON fa.id = q.from_address_id
    WHERE q.id = ?
  `;

  if (role === "employee") {
    sql += ` AND (
      q.created_by = ?
      OR q.customer_id IN (
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
  }

  const params = role === "employee"
    ? [id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id]
    : [id];

  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    if (!rows.length) return res.status(404).json([]);
    res.json(rows);
  });
});

/* ================= CREATE QUOTATION ================= */

const validateQuotation = (body) => {
  if (!body || typeof body !== "object") return "Invalid request body";
  const { customer, quotation, invoice, items } = body;
  const q = quotation || invoice;
  const c = customer || {};

  if (!c.customer_name) return "Customer name is required";
  if (!q || !q.quotation_date && !q.invoice_date) return "Date is required";
  if (!items || items.length === 0) return "At least one item is required";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Description is optional — allow empty
    if (item.price === "" || item.price === null || item.price === undefined) return `Item ${i + 1}: Price is required`;
    if (!item.quantity || item.quantity <= 0) return `Item ${i + 1}: Quantity must be greater than 0`;
  }
  return null;
};


router.post("/create", verifyToken, (req, res) => {
  const error = validateQuotation(req.body);
  if (error) return res.status(400).json({ message: error });

  const { customer, quotation, invoice, items, extra } = req.body;
  const q = quotation || invoice; // unified form sends "invoice"
  const ex = extra || {};
  const refNo = `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
  const quotationDate = (q && (q.quotation_date || q.invoice_date)) || new Date().toISOString().slice(0, 10);

  db.beginTransaction(err => {
    if (err) return res.status(500).json({ message: "Transaction error" });

    // Save to customers table
    db.query(
      `INSERT INTO customers (customer_name, mobile_number, email, gst_number, location_city) VALUES (?,?,?,?,?)`,
      [customer.customer_name, customer.mobile_number, customer.email, customer.gst_number || null, customer.location_city],
      (err, customerResult) => {
        if (err) {
          console.error("Customer INSERT error:", err);
          return db.rollback(() => res.status(500).json({ message: "Customer insert failed: " + err.message }));
        }
        const customerId = customerResult.insertId;

        // Also save to clients table for cross-module reuse
        db.query(
          "SELECT id FROM clients WHERE phone = ?",
          [customer.mobile_number],
          (err, clientRows) => {
            if (err) { console.error("Client SELECT error:", err); return; }
            if (!err && clientRows.length === 0) {
              db.query(
                `INSERT INTO clients (name, company_name, email, phone, gst_number, address, state, pincode) VALUES (?,?,?,?,?,?,?,?)`,
                [
                  customer.customer_name,
                  ex.client_company || customer.customer_name,
                  customer.email,
                  customer.mobile_number,
                  customer.gst_number || null,
                  ex.client_address1 || null,
                  ex.client_state || null,
                  ex.client_pincode || null
                ],
                (insErr) => { if (insErr) console.error("Client INSERT error:", insErr); }
              );
            } else if (!err && clientRows.length > 0) {
              db.query(
                `UPDATE clients SET name=?, company_name=?, email=?, gst_number=?, address=?, state=?, pincode=? WHERE id=?`,
                [
                  customer.customer_name,
                  ex.client_company || customer.customer_name,
                  customer.email,
                  customer.gst_number || null,
                  ex.client_address1 || null,
                  ex.client_state || null,
                  ex.client_pincode || null,
                  clientRows[0].id
                ],
                (updErr) => { if (updErr) console.error("Client UPDATE error:", updErr); }
              );
            }
          }
        );

        db.query(
          `INSERT INTO quotations
           (customer_id, quotation_date, total_cgst, total_sgst, total_igst, subtotal, total_tax, total_discount, grand_total,
            reference_no, from_address_id, from_address_custom,
            client_company, client_address1, client_address2, client_city, client_state, client_pincode, client_country,
            tax_type, custom_tax, exec_name, exec_phone, exec_email,
            terms_general, terms_tax, terms_project_period, terms_validity, terms_separate_orders,
            terms_payment, terms_payment_custom, terms_warranty, hsn_sac_code, supplier_branch,
            bank_details_id, bank_company, bank_name, bank_account, bank_ifsc, bank_branch, custom_terms, gst_mode, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            customerId, quotationDate,
            q.total_cgst || 0, q.total_sgst || 0, q.total_igst || 0, q.subtotal || 0,
            (q.total_cgst || 0) + (q.total_sgst || 0) + (q.total_igst || 0), q.total_discount || 0, q.grand_total || 0,
            refNo, (ex.from_address_id === "" || !ex.from_address_id) ? null : ex.from_address_id, ex.from_address_custom || null,
            ex.client_company || null, ex.client_address1 || null, ex.client_address2 || null,
            ex.client_city || null, ex.client_state || null, ex.client_pincode || null, ex.client_country || "India",
            ex.tax_type || "GST18", (ex.custom_tax === "" || !ex.custom_tax) ? null : ex.custom_tax,
            ex.exec_name || null, ex.exec_phone || null, ex.exec_email || null,
            ex.terms_general ? 1 : 0, ex.terms_tax ? 1 : 0, ex.terms_project_period || null,
            ex.terms_validity || ex.terms_validity_days || null, ex.terms_separate_orders ? JSON.stringify(ex.terms_separate_orders) : null,
            ex.terms_payment || null, ex.terms_payment_custom || null, ex.terms_warranty || null,
            ex.hsn_sac_code || null, ex.supplier_branch || null,
            ex.bank_details_id || null, ex.bank_company || null, ex.bank_name || null, ex.bank_account || null, ex.bank_ifsc || null, ex.bank_branch || null, ex.custom_terms || null,
            ex.gst_mode || "Exclusive", req.user.id
          ],
          (err, quotationResult) => {
            if (err) {
              console.error("Quotation INSERT error:", err);
              return db.rollback(() => res.status(500).json({ message: "Quotation insert failed: " + err.message }));
            }
            const quotationId = quotationResult.insertId;
            const values = items.map((item, index) => [
              quotationId, index + 1, item.description || item.name || "", item.brand_model || null, item.hsn_sac || null, item.uom || "Nos",
              item.price, item.quantity, item.tax || 0, item.discount || 0, item.subtotal || 0,
            ]);
            db.query(
              `INSERT INTO quotation_items (quotation_id, product_number, description, brand_model, hsn_sac, uom, price, quantity, tax, discount, subtotal) VALUES ?`,
              [values],
              err => {
                if (err) {
                  console.error("Quotation items INSERT error:", err.message);
                  return db.rollback(() => res.status(500).json({ message: "Item insert failed: " + err.message }));
                }
                db.commit(err => {
                  if (err) return db.rollback(() => res.status(500).json(err));

                  // DISABLED: Old notification system
                  /*
                  const notificationIO = getNotificationIO();
                  if (notificationIO) {
                    const time = new Date().toLocaleString();
                    notificationIO.emitNotification("proposal_created", {
                      id: quotationId,
                      referenceNo: refNo,
                      customerName: customer.customer_name,
                      clientCompany: ex.client_company || customer.customer_name,
                      grandTotal: q.grand_total || 0,
                      createdBy: ex.exec_name || "Employee",
                      createdAt: time,
                      type: "proposal"
                    }, null, true);
                  }
                  */
                  // Auto-trigger WhatsApp automation for quotation_created
                  try {
                    const { triggerAutomation } = require("../services/waAutomationService");
                    triggerAutomation("quotation_created", {
                      phone: customer.mobile_number,
                      contactName: customer.customer_name,
                      data: {
                        service: "Quotation Proposal",
                        quotation_no: refNo,
                        invoice_no: refNo,
                        amount: q.grand_total || 0,
                        date: quotationDate,
                        city: customer.location_city,
                        company: ex.client_company || customer.customer_name,
                      }
                    }).catch(() => {});

                    // Emit to CRM Universal Event Bus
                    try {
                      const crmEventBus = require("../services/crmEventBus");
                      crmEventBus.emit("quotation_created", {
                        quotation_id: quotationId,
                        reference_no: refNo,
                        customer_name: customer.customer_name,
                        phone: customer.mobile_number,
                        email: customer.email,
                        amount: q.grand_total || 0,
                        date: quotationDate,
                        company: ex.client_company || customer.customer_name,
                        created_by: req.user?.id
                      });
                    } catch (_) {}
                  } catch (_) {}

                  res.status(201).json({ message: "Quotation Created Successfully", quotationId, reference_no: refNo });
                });
              }
            );
          }
        );
      }
    );
  });
});

// Update — creates a NEW version instead of overwriting, preserving history
router.put("/:id", verifyToken, (req, res) => {
  const error = validateQuotation(req.body);
  if (error) return res.status(400).json({ message: error });

  const { id } = req.params;
  const { customer, quotation, invoice, items, extra } = req.body;
  const q = quotation || invoice;
  const ex = extra || {};
  const quotationDate = (q && (q.quotation_date || q.invoice_date)) || new Date().toISOString().slice(0, 10);

  db.beginTransaction(err => {
    if (err) return res.status(500).json(err);

    // 1. Update customer details
    db.query(
      `UPDATE customers SET customer_name=?, mobile_number=?, email=?, gst_number=?, location_city=?
       WHERE id = (SELECT customer_id FROM quotations WHERE id=?)`,
      [customer.customer_name, customer.mobile_number, customer.email, customer.gst_number || null, customer.location_city, id],
      err => {
        if (err) return db.rollback(() => res.status(500).json(err));

        // 2. Get current quotation to find parent_id and version
        db.query(`SELECT customer_id, parent_id, version, reference_no FROM quotations WHERE id=?`, [id], (err, rows) => {
          if (err) return db.rollback(() => res.status(500).json(err));
          if (!rows.length) return db.rollback(() => res.status(404).json({ message: "Quotation not found" }));

          const current = rows[0];
          // The root id is either parent_id (if already a revision) or id itself
          const rootId = current.parent_id || id;

          db.query(`SELECT MAX(version) AS maxVersion FROM quotations WHERE id=? OR parent_id=?`, [rootId, rootId], (err, maxRows) => {
            if (err) return db.rollback(() => res.status(500).json(err));
            const newVersion = ((maxRows[0] && maxRows[0].maxVersion) || current.version || 1) + 1;
            const refNo = current.reference_no || `QT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

            // 3. Mark all previous versions as not latest
            db.query(
              `UPDATE quotations SET is_latest=0 WHERE id=? OR parent_id=?`,
              [rootId, rootId],
              err => {
                if (err) return db.rollback(() => res.status(500).json(err));

                // 4. Insert new version row
                db.query(
                  `INSERT INTO quotations
                 (customer_id, quotation_date, total_cgst, total_sgst, total_igst, subtotal, total_tax, total_discount, grand_total,
                  reference_no, from_address_id, from_address_custom,
                  client_company, client_address1, client_address2, client_city, client_state, client_pincode, client_country,
                  tax_type, custom_tax, exec_name, exec_phone, exec_email,
                  terms_general, terms_tax, terms_project_period, terms_validity, terms_separate_orders,
                  terms_payment, terms_payment_custom, terms_warranty,
                  hsn_sac_code, supplier_branch,
                  bank_details_id, bank_company, bank_name, bank_account, bank_ifsc, bank_branch, custom_terms,
                  gst_mode, parent_id, version, is_latest, created_by)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  [
                    current.customer_id, quotationDate,
                    q.total_cgst || 0, q.total_sgst || 0, q.total_igst || 0, q.subtotal || 0,
                    (q.total_cgst || 0) + (q.total_sgst || 0) + (q.total_igst || 0), q.total_discount || 0, q.grand_total || 0,
                    refNo, ex.from_address_id || null, ex.from_address_custom || null,
                    ex.client_company || null, ex.client_address1 || null, ex.client_address2 || null,
                    ex.client_city || null, ex.client_state || null, ex.client_pincode || null, ex.client_country || "India",
                    ex.tax_type || "GST18", ex.custom_tax || null,
                    ex.exec_name || null, ex.exec_phone || null, ex.exec_email || null,
                    ex.terms_general ? 1 : 0, ex.terms_tax ? 1 : 0, ex.terms_project_period || null,
                    ex.terms_validity || null, ex.terms_separate_orders ? JSON.stringify(ex.terms_separate_orders) : null,
                    ex.terms_payment || null, ex.terms_payment_custom || null, ex.terms_warranty || null,
                    ex.hsn_sac_code || null, ex.supplier_branch || null,
                    ex.bank_details_id || null, ex.bank_company || null, ex.bank_name || null, ex.bank_account || null, ex.bank_ifsc || null, ex.bank_branch || null, ex.custom_terms || null,
                    ex.gst_mode || "Exclusive", rootId, newVersion, 1, req.user.id
                  ],
                  (err, result) => {
                    if (err) {
                      console.error("Quotation UPDATE/VERSION INSERT error:", err);
                      return db.rollback(() => res.status(500).json({ message: "Quotation version insert failed: " + err.message }));
                    }
                    const newId = result.insertId;

                    // 5. Insert items for new version
                    const values = items.map((item, index) => [
                      newId, index + 1, item.description || item.name || "", item.brand_model || null, item.hsn_sac || null, item.uom || "Nos",
                      item.price, item.quantity, item.tax || 0, item.discount || 0, item.subtotal || 0,
                    ]);
                    db.query(
                      `INSERT INTO quotation_items (quotation_id, product_number, description, brand_model, hsn_sac, uom, price, quantity, tax, discount, subtotal) VALUES ?`,
                      [values],
                      err => {
                        if (err) {
                          console.error("Quotation UPDATE items INSERT error:", err.message);
                          return db.rollback(() => res.status(500).json({ message: "Item insert failed: " + err.message }));
                        }
                        db.commit(err => {
                          if (err) return db.rollback(() => res.status(500).json(err));
                          res.json({ message: "New version saved", newId, version: newVersion });
                        });
                      }
                    );
                  }
                );
              }
            );
          });
        });
      }
    );
  });
});



// PATCH — quick status update (allow non-admin with ownership check)
router.patch("/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required" });

  db.query("SELECT created_by, status FROM quotations WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: "Not found" });
    if (req.user.role !== "admin" && req.user.role !== "subadmin" && req.user.role !== "employee" && results[0].created_by !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    const oldStatus = results[0].status;
    db.query("UPDATE quotations SET status = ? WHERE id = ?", [status, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      handleQuotationTargetSync(id, oldStatus, status, results[0].created_by);

      res.json({ message: "Status updated", status });
    });
  });
});

/// DELETE QUOTATION (SAFE)
router.delete("/:id", verifyToken, isAdmin, (req, res) => {
  const { id } = req.params;

  db.beginTransaction(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Transaction failed" });
    }

    // Check ownership
    db.query("SELECT created_by FROM quotations WHERE id = ?", [id], (err, results) => {
      if (err) return db.rollback(() => res.status(500).json(err));
      if (results.length === 0) return db.rollback(() => res.status(404).json({ message: "Not found" }));

      if (req.user.role !== 'admin' && results[0].created_by !== req.user.id) {
        return db.rollback(() => res.status(403).json({ message: "Access denied" }));
      }

      // delete items first
      db.query(
        "DELETE FROM quotation_items WHERE quotation_id = ?",
        [id],
        err => {
          if (err) {
            console.error(err);
            return db.rollback(() =>
              res.status(500).json({ error: "Item delete failed" })
            );
          }

          // delete quotation
          db.query(
            "DELETE FROM quotations WHERE id = ?",
            [id],
            err => {
              if (err) {
                console.error(err);
                return db.rollback(() =>
                  res.status(500).json({ error: "Quotation delete failed" })
                );
              }

              db.commit(err => {
                if (err) {
                  console.error(err);
                  return db.rollback(() =>
                    res.status(500).json({ error: "Commit failed" })
                  );
                }

                res.json({ message: "Quotation deleted successfully" });
              });
            }
          );
        }
      );
    });
  });
});



const nodemailer = require("nodemailer");
const { generateInvoicePdf } = require("../backendutil/generateInvoicePdf");
const { generateEmailHtml } = require("../backendutil/generateEmailHtml");

// Download PDF directly
router.get("/download-pdf/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const headerSql = `SELECT q.*, c.email, c.customer_name, c.mobile_number, c.location_city, c.gst_number,
    q.quotation_date AS invoice_date, COALESCE(q.from_address_custom, fa.address) AS resolved_from_address
    FROM quotations q JOIN customers c ON q.customer_id = c.id
    LEFT JOIN pi_from_addresses fa ON fa.id = q.from_address_id WHERE q.id = ?`;
  const itemsSql = `SELECT product_number, description, brand_model, hsn_sac, uom, price, quantity, tax, discount, subtotal FROM quotation_items WHERE quotation_id = ? ORDER BY product_number`;
  db.query(headerSql, [id], (err, headerRows) => {
    if (err) { console.error("PDF header query error:", err); return res.status(500).json({ message: "Database error: " + err.message }); }
    if (!headerRows.length) return res.status(404).json({ message: "Quotation not found" });
    db.query(itemsSql, [id], async (err, items) => {
      if (err) { console.error("PDF items query error:", err); return res.status(500).json({ message: "Database error: " + err.message }); }
      try {
        const pdfBuffer = await generateInvoicePdf({ invoice: headerRows[0], items, type: "quotation" });
        const year = new Date(headerRows[0].invoice_date).getFullYear();
        const filename = `Quotation_QT-${year}-${String(headerRows[0].id).padStart(3, "0")}.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      } catch (e) { console.error("PDF generation error:", e); res.status(500).json({ message: "PDF generation failed: " + e.message }); }
    });
  });
});

router.post("/send-email/:id", verifyToken, (req, res) => {
  const { id } = req.params;
  const { to, subject, cc, body } = req.body;

  const headerSql = `
    SELECT q.*, c.email, c.customer_name, c.mobile_number, c.location_city,
           q.quotation_date AS invoice_date,
           COALESCE(q.from_address_custom, fa.address) AS resolved_from_address
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    LEFT JOIN pi_from_addresses fa ON fa.id = q.from_address_id
    WHERE q.id = ?`;

  const itemsSql = `
    SELECT product_number, description, brand_model, hsn_sac, uom, price, quantity, tax, discount, subtotal
    FROM quotation_items WHERE quotation_id = ? ORDER BY product_number`;

  db.query(headerSql, [id], (err, headerRows) => {
    if (err) return res.status(500).json(err);
    if (!headerRows.length) return res.status(404).json({ message: "Quotation not found" });

    const quotation = headerRows[0];
    // invoice_date already aliased in SQL

    const recipientEmail = to || quotation.email;
    if (!recipientEmail) return res.status(400).json({ message: "No email address provided" });

    db.query(itemsSql, [id], async (err, items) => {
      if (err) return res.status(500).json(err);

      const year = new Date(quotation.quotation_date).getFullYear();
      const qtNumber = `QT-${year}-${String(quotation.id).padStart(3, "0")}`;

      try {
        // Generate PDF with exact same design as the app
        const pdfBuffer = await generateInvoicePdf({ invoice: quotation, items, type: "quotation" });

        // Generate HTML email body based on custom or default content
        const mailText = (body && body.trim()) ? body.replace(/\n/g, "<br/>") : `Dear Customer,<br/><br/>Greeting from Achme Communication.<br/><br/>Please find the attached Quotation document (<strong>${qtNumber}</strong>) for your review.<br/><br/>Best regards,<br/><strong>Achme Communication</strong>`;
        const emailHtml = `
          <div style="font-family: 'Outfit', 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 24px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">ACHME COMMUNICATION</h2>
            </div>
            <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 15px;">
              ${mailText}
            </div>
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0;">This is an automated email from Achme Communication. Please do not reply to this email directly.</p>
            </div>
          </div>
        `;

        const { getTransporterForUser } = require("../backendutil/emailConfig");
        const { transporter, fromAddress } = await getTransporterForUser(req.user.id);

        await transporter.sendMail({
          from: fromAddress,
          to: recipientEmail,
          cc: cc || undefined,
          subject: subject || `Quotation ${qtNumber}`,
          html: emailHtml,
          attachments: [
            {
              filename: `Quotation_${qtNumber}.pdf`,
              content: pdfBuffer,
              contentType: "application/pdf",
            },
          ],
        });

        res.json({ message: "Email sent successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send email", error: err.message });
      }
    });
  });
});

const handleQuotationTargetSync = (quotationId, oldStatus, newStatus, createdByUserId) => {
  if (oldStatus === newStatus) return;

  const isOldBilled = (oldStatus || "").toLowerCase() === "billed";
  const isNewBilled = (newStatus || "").toLowerCase() === "billed";

  if (isOldBilled === isNewBilled) return;

  // Fetch quotation + full user name (first + last) to match task_targets.user_name
  db.query(
    `SELECT q.grand_total, q.reference_no, q.quotation_date,
            u.first_name, u.last_name, u.id AS user_id
     FROM quotations q
     JOIN users u ON q.created_by = u.id
     WHERE q.id = ?`,
    [quotationId],
    (err, rows) => {
      if (err || rows.length === 0) {
        console.error("Quotation sync error fetching quotation:", err);
        return;
      }

      const { grand_total, reference_no, quotation_date, first_name, last_name, user_id: quoteCreatorId } = rows[0];
      const fullName = `${first_name || ""} ${last_name || ""}`.trim();
      const amount = Number(grand_total || 0);

      // Use quotation_date month if available, else current month
      const syncMonth = quotation_date
        ? new Date(quotation_date).toISOString().slice(0, 7)
        : new Date().toISOString().slice(0, 7);

      // Try matching by user_id first, then full name, then first name alone
      db.query(
        `SELECT id, user_name, monthly_target FROM task_targets
         WHERE user_id = ? OR user_name = ? OR user_name = ?
         ORDER BY CASE WHEN user_id = ? THEN 0 WHEN user_name = ? THEN 1 ELSE 2 END
         LIMIT 1`,
        [quoteCreatorId, fullName, first_name, quoteCreatorId, fullName],
        (errTarget, targetRows) => {
          if (errTarget || targetRows.length === 0) {
            console.warn(`[TargetSync] No target found for user_id=${quoteCreatorId} name="${fullName}" — skipping sync`);
            return;
          }

          const targetId = targetRows[0].id;
          const targetUserName = targetRows[0].user_name;
          const monthlyTarget = targetRows[0].monthly_target;

          const syncAmount = isNewBilled ? amount : -amount;
          const updateMsg = isNewBilled
            ? `Auto-achieved Rs.${amount.toLocaleString()} via quotation Billed (Ref: ${reference_no})`
            : `Reversed Rs.${amount.toLocaleString()} due to quotation status change from Billed (Ref: ${reference_no})`;

          console.log(`[TargetSync] ${isNewBilled ? "Adding" : "Reversing"} Rs.${amount} for ${targetUserName} (${syncMonth}) — ${reference_no}`);

          // Log the update entry
          db.query(
            `INSERT INTO task_updates (user_id, user_name, target_id, month_year, amount, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [quoteCreatorId, targetUserName, targetId, syncMonth, syncAmount, updateMsg],
            (errUpdate) => {
              if (errUpdate) console.error("Error inserting target sync update log:", errUpdate);

              // Upsert the achievement for the specific month
              db.query(
                `INSERT INTO task_achievements (user_id, user_name, target_id, month_year, achieved_amount)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE achieved_amount = GREATEST(0, achieved_amount + ?)`,
                [quoteCreatorId, targetUserName, targetId, syncMonth, Math.max(0, syncAmount), syncAmount],
                (errAch) => {
                  if (errAch) {
                    console.error("Error updating achievements in target sync:", errAch);
                    return;
                  }

                  db.query("INSERT INTO task_activity (task_id, action, message) VALUES (?, ?, ?)",
                    [targetId, "Target Sync", `${targetUserName}: ${updateMsg}`]);

                  // Compute current total for notification
                  db.query(
                    "SELECT SUM(achieved_amount) as total FROM task_achievements WHERE user_name = ? AND month_year = ?",
                    [targetUserName, syncMonth],
                    (selErr, selRows) => {
                      const totalAchieved = Number(selRows?.[0]?.total || 0);
                      const percentage = monthlyTarget > 0 ? Math.round((totalAchieved / monthlyTarget) * 100) : 0;
                      const isCompleted = isNewBilled && percentage >= 100;

                      const adminMsg = isCompleted
                        ? `🎯 ${targetUserName} has COMPLETED their target for ${syncMonth}! Achieved ₹${totalAchieved.toLocaleString()} (${percentage}%) via Quotation Billed: ${reference_no}`
                        : isNewBilled
                          ? `${targetUserName} auto-achieved ₹${amount.toLocaleString()} (Quotation Billed: ${reference_no}) — ${syncMonth} Total: ₹${totalAchieved.toLocaleString()} (${percentage}%)`
                          : `${targetUserName} target reversed ₹${amount.toLocaleString()} (Status change: ${reference_no}) — ${syncMonth} Total: ₹${totalAchieved.toLocaleString()} (${percentage}%)`;

                      db.query(
                        "INSERT INTO admin_notifications (type, user_id, message, related_id, related_type, priority) VALUES (?, ?, ?, ?, ?, ?)",
                        [
                          isCompleted ? "target_completed" : "target_achievement",
                          quoteCreatorId, adminMsg, targetId, "target",
                          isCompleted ? "high" : "normal"
                        ],
                        (errNotif, resultNotif) => {
                          if (!errNotif) {
                            const io = getNotificationIO();
                            if (io) {
                              io.sendToAdmin("new_notification", {
                                id: resultNotif.insertId,
                                type: isCompleted ? "target_completed" : "target_achievement",
                                message: adminMsg,
                                employee_name: targetUserName,
                                priority: isCompleted ? "high" : "normal",
                                is_read: 0,
                                created_at: new Date().toISOString()
                              });

                              // Special celebratory broadcast when target is hit
                              if (isCompleted) {
                                io.sendToAdmin("target_completed", {
                                  user_name: targetUserName,
                                  totalAchieved,
                                  percentage,
                                  targetId,
                                  month: syncMonth,
                                  message: `🎯 ${targetUserName} completed their target for ${syncMonth}!`
                                });
                              }

                              io.emit("data_changed", {
                                type: "target_achievement",
                                user_name: targetUserName,
                                amount: syncAmount,
                                totalAchieved,
                                percentage,
                                targetId,
                                month: syncMonth
                              });
                            }
                          }
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

module.exports = router;
