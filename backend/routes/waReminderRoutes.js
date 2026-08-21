"use strict";

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const waConfirmation = require("../services/waConfirmationService");
const waReminderScheduler = require("../services/waReminderScheduler");

// ── 1. Summary Statistics ──────────────────────────────────────────────────
router.get("/summary", verifyToken, async (req, res) => {
  try {
    const [[stats]] = await db.promise().query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) AS rescheduled,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
        SUM(CASE WHEN status IN ('sent', 'pending') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
      FROM wa_interactive_reminders
    `);

    const total = stats.total || 0;
    const responded = (stats.confirmed || 0) + (stats.rescheduled || 0) + (stats.cancelled || 0) + (stats.paid || 0);
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

    res.json({
      total,
      confirmed: stats.confirmed || 0,
      rescheduled: stats.rescheduled || 0,
      cancelled: stats.cancelled || 0,
      paid: stats.paid || 0,
      pending: stats.pending || 0,
      failed: stats.failed || 0,
      responseRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. List Reminders & Response Logs ───────────────────────────────────────
router.get("/list", verifyToken, async (req, res) => {
  try {
    const { status, type, search, limit = 50, offset = 0 } = req.query;
    let sql = "SELECT * FROM wa_interactive_reminders WHERE 1=1";
    const params = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (type) {
      sql += " AND reminder_type = ?";
      params.push(type);
    }
    if (search) {
      sql += " AND (phone LIKE ? OR contact_name LIKE ? OR title LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Get Reminder Settings ────────────────────────────────────────────────
router.get("/settings", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
    const row = rows[0] || {};
    res.json({
      appointment_reminders_enabled: row.appointment_reminders_enabled !== 0,
      appointment_reminder_hours_before: row.appointment_reminder_hours_before || 24,
      payment_due_reminders_enabled: row.payment_due_reminders_enabled !== 0,
      payment_due_days_before: row.payment_due_days_before || 1,
      lead_followup_reminders_enabled: row.lead_followup_reminders_enabled !== 0,
      amc_renewal_reminders_enabled: row.amc_renewal_reminders_enabled !== 0,
      amc_renewal_days_before: row.amc_renewal_days_before || 7,
      confirmation_auto_update_crm: row.confirmation_auto_update_crm !== 0,
      notify_staff_on_response: row.notify_staff_on_response !== 0,
      default_confirm_prompt: row.default_confirm_prompt || "",
      default_reschedule_prompt: row.default_reschedule_prompt || "",
      default_cancel_prompt: row.default_cancel_prompt || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. Save Reminder Settings ────────────────────────────────────────────────
router.put("/settings", verifyToken, async (req, res) => {
  try {
    const {
      appointment_reminders_enabled,
      appointment_reminder_hours_before,
      payment_due_reminders_enabled,
      payment_due_days_before,
      lead_followup_reminders_enabled,
      amc_renewal_reminders_enabled,
      amc_renewal_days_before,
      confirmation_auto_update_crm,
      notify_staff_on_response,
      default_confirm_prompt,
      default_reschedule_prompt,
      default_cancel_prompt,
    } = req.body;

    await db.promise().query(
      `UPDATE wa_reminder_settings SET
        appointment_reminders_enabled = ?,
        appointment_reminder_hours_before = ?,
        payment_due_reminders_enabled = ?,
        payment_due_days_before = ?,
        lead_followup_reminders_enabled = ?,
        amc_renewal_reminders_enabled = ?,
        amc_renewal_days_before = ?,
        confirmation_auto_update_crm = ?,
        notify_staff_on_response = ?,
        default_confirm_prompt = ?,
        default_reschedule_prompt = ?,
        default_cancel_prompt = ?
       WHERE id = 1`,
      [
        appointment_reminders_enabled ? 1 : 0,
        parseInt(appointment_reminder_hours_before, 10) || 24,
        payment_due_reminders_enabled ? 1 : 0,
        parseInt(payment_due_days_before, 10) || 1,
        lead_followup_reminders_enabled ? 1 : 0,
        amc_renewal_reminders_enabled ? 1 : 0,
        parseInt(amc_renewal_days_before, 10) || 7,
        confirmation_auto_update_crm ? 1 : 0,
        notify_staff_on_response ? 1 : 0,
        default_confirm_prompt || null,
        default_reschedule_prompt || null,
        default_cancel_prompt || null,
      ]
    );

    res.json({ success: true, message: "Reminder & confirmation settings saved successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 5. Instant Interactive Send ─────────────────────────────────────────────
router.post("/send-now", verifyToken, async (req, res) => {
  try {
    const { phone, contact_name, reminder_type, title, message_text, options, ref_table, ref_id } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });

    const result = await waConfirmation.sendInteractiveReminder({
      phone,
      contactName: contact_name || "Customer",
      reminderType: reminder_type || "appointment_reminder",
      title: title || "Interactive Reminder",
      messageText: message_text,
      options,
      refTable: ref_table || null,
      refId: ref_id || null,
    });

    res.json({ success: true, message: "Interactive reminder sent successfully!", result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 6. Trigger Scheduler Check on Demand ────────────────────────────────────
router.post("/trigger-check", verifyToken, async (req, res) => {
  try {
    const { scheduler_type = "all" } = req.body;
    if (scheduler_type === "appointment" || scheduler_type === "all") {
      await waReminderScheduler.runAppointmentReminderCheck();
    }
    if (scheduler_type === "payment" || scheduler_type === "all") {
      await waReminderScheduler.runPaymentDueInteractiveCheck();
    }
    if (scheduler_type === "quotation" || scheduler_type === "all") {
      await waReminderScheduler.runQuotationFollowupCheck();
    }
    if (scheduler_type === "amc" || scheduler_type === "all") {
      await waReminderScheduler.runAmcRenewalCheck();
    }

    res.json({ success: true, message: "Reminder check executed successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. Resend Reminder ──────────────────────────────────────────────────────
router.post("/:id/resend", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_interactive_reminders WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Reminder not found" });

    const rem = rows[0];
    let opts = [];
    try {
      opts = typeof rem.options_payload === "string" ? JSON.parse(rem.options_payload) : rem.options_payload;
    } catch (_) {}

    await waConfirmation.sendInteractiveReminder({
      phone: rem.phone,
      contactName: rem.contact_name,
      reminderType: rem.reminder_type,
      title: rem.title,
      messageText: rem.message_text,
      options: opts,
      refTable: rem.reference_table,
      refId: rem.reference_id,
      staffName: rem.assigned_staff_name,
    });

    res.json({ success: true, message: "Reminder resent successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 8. Delete Reminder Log ──────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_interactive_reminders WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
