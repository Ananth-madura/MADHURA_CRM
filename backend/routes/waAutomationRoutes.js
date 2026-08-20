const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");

const TRIGGER_LABELS = {
  welcome_message: "👋 First Inbound → Welcome Auto-Reply",
  new_lead: "🎯 New Lead Added → Instant Welcome & Brochure",
  invoice_created: "🧾 Invoice Created → Send Invoice PDF & Notice",
  quotation_created: "💼 Quotation Created → Send Proposal & Quote Details",
  amc_created: "🛡️ AMC Contract Created → Service Agreement Notice",
  payment_received: "✅ Payment Received → Instant Receipt Acknowledgement",
  payment_due: "💰 Payment Due → Automated Reminder Notice",
  service_visit_scheduled: "📅 Service Visit Scheduled → Technician Alert",
  walkin_created: "🚶 Walkin Lead Added → Shop Visit Thank You",
  ticket_closed: "🎫 Service Completed / Ticket Closed → Feedback Request",
  birthday: "🎂 Customer Birthday → Greeting & Special Discount",
  appointment_reminder: "🔔 Appointment Scheduled → Visit Reminder",
  lead_followup: "⏳ Lead Inactivity (7 Days) → Follow-Up Check-in",
  abandoned_cart: "🛒 Pending Quotation → Special Offer Recovery",
  custom: "⚡ Custom Background Trigger Rule",
};

// ── List automations ──────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(`
      SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body,
        f.name as flow_name,
        g.name as group_name,
        (SELECT COUNT(*) FROM wa_automation_options o WHERE o.automation_id = a.id) as option_count
      FROM wa_automations a
      LEFT JOIN wa_templates t ON a.template_id = t.id
      LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
      LEFT JOIN wa_flows f ON a.flow_id = f.id
      LEFT JOIN wa_contact_groups g ON a.group_id = g.id
      ORDER BY a.created_at DESC
    `);
    res.json(rows.map(r => ({ ...r, trigger_label: TRIGGER_LABELS[r.trigger_type] || r.trigger_type })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Automations Stats Summary ─────────────────────────────────────────────────
router.get("/stats", auth, async (req, res) => {
  try {
    const [[stats]] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_rules,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_rules,
        SUM(run_count) as total_runs
      FROM wa_automations
    `);

    const [[logStats]] = await db.promise().query(`
      SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM wa_automation_logs
    `);

    res.json({
      totalRules: stats?.total_rules || 0,
      activeRules: stats?.active_rules || 0,
      totalRuns: stats?.total_runs || 0,
      sentCount: logStats?.sent_count || 0,
      failedCount: logStats?.failed_count || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stop / resume every automation at once (emergency kill switch) ──────────
router.post("/stop-all", auth, async (req, res) => {
  try {
    const [result] = await db.promise().query("UPDATE wa_automations SET is_active=0, updated_at=NOW() WHERE is_active=1");
    res.json({ success: true, stopped: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/resume-all", auth, async (req, res) => {
  try {
    const [result] = await db.promise().query("UPDATE wa_automations SET is_active=1, updated_at=NOW() WHERE is_active=0");
    res.json({ success: true, resumed: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seed 10 Prebuilt Production CRM Automation Rules ─────────────────────────
router.post("/seed", auth, async (req, res) => {
  try {
    const seedAutomations = [
      {
        name: "Instant Welcome Notice for New Leads",
        trigger_type: "new_lead",
        message_text: "Hi {name}! 👋 Thank you for your interest in {service} with {company}. Our engineering specialist will connect with you shortly. Feel free to reply anytime!",
        delay_minutes: 0,
        is_active: 1,
        sequence_delay_seconds: 7,
        followup_message_text: "📄 In the meantime, here is our complete Service & AMC catalog: https://achme.in/brochure.pdf",
      },
      {
        name: "Instant Invoice PDF Notice & Payment Link",
        trigger_type: "invoice_created",
        message_text: "Hello {name}, your invoice *{invoice_no}* for amount *{amount}* has been generated. Due Date: {due_date}. Thank you for choosing {company}!",
        delay_minutes: 0,
        is_active: 1,
        sequence_delay_seconds: 7,
        followup_message_text: "💳 You can securely view and pay your invoice online here:\nhttps://achme.in/pay/{invoice_no}",
      },
      {
        name: "Quotation & Proposal Delivery Alert",
        trigger_type: "quotation_created",
        message_text: "Hello {name}, your quotation *{quotation_no}* for *{service}* (Total: {amount}) has been generated. Let us know if you would like to proceed or schedule a technical call!",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "AMC Maintenance Contract Confirmation",
        trigger_type: "amc_created",
        message_text: "🛡️ *AMC Contract Active:* Dear {name}, your maintenance contract *{amc_contract_no}* for {service} is active until {due_date}. Our team will manage your regular inspections!",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Payment Receipt Acknowledgement",
        trigger_type: "payment_received",
        message_text: "Dear {name}, thank you! We have received your payment of *{amount}* for invoice *{invoice_no}* on {date}. Your official receipt has been recorded.",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Payment Due 1-Day Automated Reminder",
        trigger_type: "payment_due",
        message_text: "Hi {name}, gentle reminder that payment for invoice *{invoice_no}* ({amount}) is due on *{due_date}*. Please reply if you need invoice copy or payment link.",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Service Visit Scheduled Technician Alert",
        trigger_type: "service_visit_scheduled",
        message_text: "📅 *Service Visit Confirmed:* Hi {name}, our technician has been scheduled for your *{service}* on *{service_date}*. Thank you for choosing {company}!",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Walkin Client Thank You & Welcome",
        trigger_type: "walkin_created",
        message_text: "Hi {name}! Thank you for visiting {company} today regarding {service}. It was a pleasure meeting you. Feel free to message us here anytime!",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Lead Inactivity 7-Day Follow-Up Nudge",
        trigger_type: "lead_followup",
        message_text: "Hi {name}, following up on your inquiry for *{service}*. Let us know if you have any questions or would like a quick 5-minute demo/call!",
        delay_minutes: 0,
        is_active: 1,
      },
      {
        name: "Customer Birthday Greeting & 15% Gift",
        trigger_type: "birthday",
        message_text: "🎉 Happy Birthday {name}! 🎂 Team {company} wishes you a fantastic year ahead. As a special gift, enjoy *15% OFF* on your next service request!",
        delay_minutes: 0,
        is_active: 1,
      },
    ];

    for (const rule of seedAutomations) {
      const [existing] = await db.promise().query("SELECT id FROM wa_automations WHERE name = ?", [rule.name]);
      if (existing.length > 0) {
        await db.promise().query(
          `UPDATE wa_automations 
           SET trigger_type=?, message_text=?, delay_minutes=?, is_active=?, sequence_delay_seconds=?, followup_message_text=?, updated_at=NOW()
           WHERE id=?`,
          [
            rule.trigger_type, rule.message_text, rule.delay_minutes, rule.is_active,
            rule.sequence_delay_seconds || 7, rule.followup_message_text || null, existing[0].id
          ]
        );
      } else {
        await db.promise().query(
          `INSERT INTO wa_automations (name, trigger_type, message_text, delay_minutes, is_active, sequence_delay_seconds, followup_message_text, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rule.name, rule.trigger_type, rule.message_text, rule.delay_minutes, rule.is_active,
            rule.sequence_delay_seconds || 7, rule.followup_message_text || null, req.user?.id || null
          ]
        );
      }
    }

    const [all] = await db.promise().query("SELECT * FROM wa_automations ORDER BY created_at DESC");
    res.json({ success: true, count: all.length, automations: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single automation with logs ──────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body,
        f.name as flow_name,
        g.name as group_name
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       LEFT JOIN wa_flows f ON a.flow_id = f.id
       LEFT JOIN wa_contact_groups g ON a.group_id = g.id
       WHERE a.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Automation not found" });

    const [logs] = await db.promise().query(
      "SELECT * FROM wa_automation_logs WHERE automation_id=? ORDER BY sent_at DESC LIMIT 50",
      [req.params.id]
    );

    const { getOptions } = require("../services/waMenuHandler");
    const options = await getOptions(req.params.id);

    res.json({ ...rows[0], logs, options, trigger_label: TRIGGER_LABELS[rows[0].trigger_type] || rows[0].trigger_type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create automation ─────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const {
      name, trigger_type, template_id, message_text, media_type, media_url,
      sequence_delay_seconds = 7, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
      flow_id, group_id, delay_minutes = 0, conditions, is_active = 1
    } = req.body;
    if (!name || !trigger_type) return res.status(400).json({ error: "name and trigger_type required" });

    const [result] = await db.promise().query(
      `INSERT INTO wa_automations (
        name, trigger_type, template_id, message_text, media_type, media_url,
        sequence_delay_seconds, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
        flow_id, group_id, delay_minutes, conditions, is_active, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, trigger_type, template_id || null, message_text || null, media_type || null, media_url || null,
        parseInt(sequence_delay_seconds, 10) || 7, followup_message_text || null, followup_media_type || null,
        followup_media_url || null, followup_template_id || null, flow_id || null, group_id || null,
        parseInt(delay_minutes, 10) || 0, conditions ? JSON.stringify(conditions) : null,
        is_active ? 1 : 0, req.user?.id || null
      ]
    );
    const [row] = await db.promise().query(
      `SELECT a.*, t.name as template_name FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id WHERE a.id=?`,
      [result.insertId]
    );
    res.status(201).json({ ...row[0], trigger_label: TRIGGER_LABELS[row[0].trigger_type] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update automation ─────────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const {
      name, trigger_type, template_id, message_text, media_type, media_url,
      sequence_delay_seconds, followup_message_text, followup_media_type, followup_media_url, followup_template_id,
      flow_id, group_id, delay_minutes, conditions, is_active
    } = req.body;
    await db.promise().query(
      `UPDATE wa_automations SET
        name=?, trigger_type=?, template_id=?, message_text=?, media_type=?, media_url=?,
        sequence_delay_seconds=?, followup_message_text=?, followup_media_type=?, followup_media_url=?, followup_template_id=?,
        flow_id=?, group_id=?, delay_minutes=?, conditions=?, is_active=?, updated_at=NOW()
       WHERE id=?`,
      [
        name, trigger_type, template_id || null, message_text || null, media_type || null, media_url || null,
        parseInt(sequence_delay_seconds, 10) || 7, followup_message_text || null, followup_media_type || null,
        followup_media_url || null, followup_template_id || null, flow_id || null, group_id || null,
        parseInt(delay_minutes || 0, 10), conditions ? JSON.stringify(conditions) : null,
        is_active ? 1 : 0, req.params.id
      ]
    );
    const [row] = await db.promise().query(
      `SELECT a.*, t.name as template_name FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id WHERE a.id=?`,
      [req.params.id]
    );
    res.json({ ...row[0], trigger_label: TRIGGER_LABELS[row[0].trigger_type] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle enable/disable ─────────────────────────────────────────────────────
router.post("/:id/toggle", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT is_active FROM wa_automations WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const newState = rows[0].is_active ? 0 : 1;
    await db.promise().query("UPDATE wa_automations SET is_active=?, updated_at=NOW() WHERE id=?", [newState, req.params.id]);
    res.json({ success: true, is_active: newState });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete automation ─────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_automations WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Quick-reply options (clickable menu attached to this automation) ─────────
router.get("/:id/options", auth, async (req, res) => {
  try {
    const { getOptions } = require("../services/waMenuHandler");
    res.json(await getOptions(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id/options", auth, async (req, res) => {
  try {
    const { options } = req.body;
    if (!Array.isArray(options)) return res.status(400).json({ error: "options array required" });

    await db.promise().query("DELETE FROM wa_automation_options WHERE automation_id = ?", [req.params.id]);

    const clean = options
      .map((o) => ({ label: (o.label || "").trim(), reply_text: (o.reply_text || "").trim() }))
      .filter((o) => o.label && o.reply_text);

    if (clean.length) {
      const values = clean.map((o, i) => [req.params.id, o.label, o.reply_text, i]);
      await db.promise().query(
        "INSERT INTO wa_automation_options (automation_id, label, reply_text, sort_order) VALUES ?",
        [values]
      );
    }

    const { getOptions } = require("../services/waMenuHandler");
    res.json(await getOptions(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger automation manually (for testing) ─────────────────────────────────
router.post("/:id/trigger", auth, async (req, res) => {
  try {
    const { phone, contact_name, trigger_data } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required" });

    const [rows] = await db.promise().query(
      `SELECT a.*, 
        t.name as template_name, t.body as template_body,
        ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE a.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Automation not found" });

    const automation = rows[0];
    const { executeAutomationSend, formatMessagePlaceholders, lookupCrmDataByPhone } = require("../services/waAutomationService");
    const cleanPhone = phone.replace(/\D/g, "");

    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    const mergedData = {
      invoice_no: "INV-2026-088",
      quotation_no: "QT-2026-104",
      amc_contract_no: "AMC-2026-904",
      amount: "14,500",
      service: "Comprehensive AMC Maintenance",
      due_date: "25 Aug 2026",
      date: new Date().toLocaleDateString("en-IN"),
      city: "Bangalore",
      company: "ACHME Solutions",
      ...crmData,
      ...(trigger_data || {})
    };
    const resolvedName = contact_name || crmData.name || "Customer";

    const rawText = automation.message_text || automation.template_body || "Hello {name}!";
    const messageText = formatMessagePlaceholders(rawText, resolvedName, mergedData);

    // Run execution
    await executeAutomationSend(automation, cleanPhone, resolvedName, messageText, mergedData);

    const hasSeq = automation.followup_message_text || automation.followup_media_url || automation.followup_template_name;
    res.json({
      success: true,
      message: hasSeq
        ? `Step 1 sent! Step 2 follow-up will send in ${automation.sequence_delay_seconds || 7} seconds.`
        : "Automation message sent successfully!"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get automation logs ───────────────────────────────────────────────────────
router.get("/logs/recent", auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [rows] = await db.promise().query(`
      SELECT l.*, a.name as automation_name, a.trigger_type
      FROM wa_automation_logs l
      LEFT JOIN wa_automations a ON l.automation_id = a.id
      ORDER BY l.sent_at DESC LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Welcome Auto-Reply Settings & Controls ─────────────────────────────────────
router.get("/welcome-settings", auth, async (req, res) => {
  try {
    const { getWelcomeSettings } = require("../services/waAutomationService");
    res.json(await getWelcomeSettings());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/welcome-settings", auth, async (req, res) => {
  try {
    const { updateWelcomeSettings } = require("../services/waAutomationService");
    res.json(await updateWelcomeSettings(req.body));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/test-welcome", auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "phone required for test send" });
    const { getWelcomeSettings, formatMessagePlaceholders, lookupCrmDataByPhone } = require("../services/waAutomationService");
    const settings = await getWelcomeSettings();
    const cleanPhone = phone.replace(/\D/g, "");
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    const text = formatMessagePlaceholders(settings.welcome_text || "Hello {name}! Welcome to ACHME.", crmData.name || "Test User", crmData);

    const waLoadBalancer = require("../services/waLoadBalancer");
    const result = await waLoadBalancer.sendTextMessage(cleanPhone, `[TEST WELCOME] ${text}`);
    res.json({ success: true, engineUsed: result.engineUsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp Load Balancer Stats ───────────────────────────────────────────────
router.get("/load-balancer-stats", auth, async (req, res) => {
  try {
    const waLoadBalancer = require("../services/waLoadBalancer");
    res.json(await waLoadBalancer.getLoadBalancerStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
