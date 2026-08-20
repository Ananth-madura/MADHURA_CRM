"use strict";
/**
 * waAiTools.js
 *
 * Read-only "tools" the WhatsApp AI assistant can call to answer with real
 * CRM data instead of chatting blind. Each tool is scoped to the phone
 * number of whoever is actually chatting — there is no way for the AI (or a
 * prompt-injected customer) to ask about a different contact's data.
 */
const db = require("../config/database");

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// Describes each tool to the model — kept short since it's injected into every request.
const TOOLS_DESCRIPTION = `You also have these tools. To use one, respond with ONLY {"action": "<tool_name>"} (no other text) — you'll then be given the real result and asked to reply to the customer using it.
- check_invoice_status: this customer's recent invoices and whether each is paid or unpaid.
- create_lead: saves this customer as a new CRM lead with Source = WhatsApp when they share inquiry or contact details.
- request_human_support: notifies a real team member to follow up with this customer (use when they ask for a human, or you can't help).`;

// ponytail: clientinvoices has no amount column in this schema, so "paid" here
// means "at least one payment row recorded against it" — not a real balance.
async function checkInvoiceStatus(phone) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  const rows = await queryAsync(
    `SELECT ci.id, ci.invoice_duedate,
      (SELECT COUNT(*) FROM payments p WHERE p.invoice_id = ci.id) AS payment_count
     FROM clientinvoices ci
     JOIN clients c ON (c.company_name = ci.client_company OR c.name = ci.client_company)
     WHERE c.phone LIKE ?
     ORDER BY ci.invoice_duedate DESC LIMIT 5`,
    [`%${last10}`]
  );
  if (!rows.length) return { found: false };
  return {
    found: true,
    invoices: rows.map((r) => ({
      invoice_no: `INV-${r.id}`,
      due_date: r.invoice_duedate,
      status: r.payment_count > 0 ? "paid" : "unpaid",
    })),
  };
}

async function createLead(phone) {
  const waLeadCapture = require("./waLeadCapture");
  const result = await waLeadCapture.captureLeadFromWhatsApp({
    phone,
    sourceDetail: "WhatsApp AI Assistant",
  });
  return { lead_saved: true, is_new: result.isNew, source: "WhatsApp" };
}

async function requestHumanSupport(phone) {
  const message = `WhatsApp AI handoff: customer ${phone} asked to speak with a team member.`;
  try {
    const result = await queryAsync(
      `INSERT INTO admin_notifications (type, message, related_type, priority) VALUES ('wa_support_request', ?, 'whatsapp', 'high')`,
      [message]
    );
    try {
      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO();
      if (helpers) {
        helpers.sendToAdmin("new_notification", {
          id: Date.now(),
          dbId: result.insertId,
          type: "wa_support_request",
          title: "WhatsApp: Customer Requested Support",
          message,
          timestamp: new Date().toISOString(),
          is_read: 0,
        });
      }
    } catch (_) {}
  } catch (err) {
    console.error("[WA AI Tools] request_human_support notification failed:", err.message);
  }
  return { notified: true };
}

const TOOLS = {
  check_invoice_status: checkInvoiceStatus,
  create_lead: createLead,
  request_human_support: requestHumanSupport,
};

async function runTool(actionName, phone) {
  const fn = TOOLS[actionName];
  if (!fn) return { error: `Unknown tool "${actionName}"` };
  try {
    return await fn(phone);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { TOOLS_DESCRIPTION, runTool };
