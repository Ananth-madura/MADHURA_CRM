"use strict";
/**
 * waConfirmationService.js
 *
 * Enterprise Interactive WhatsApp Reminders & Multi-Gated Confirmation Engine
 * Handles 2-way interactive confirmation gateways across Meta Cloud API and WhatsApp Web.
 * Automates CRM status updates (Confirmed, Rescheduled, Cancelled, Approved),
 * staff alerts, and dynamic customer follow-up prompts.
 */

const db = require("../config/database");

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function cleanPhone(phone) {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length === 10 ? "91" + cleaned : cleaned;
}

/**
 * Sends an interactive reminder with 2-way confirmation buttons/options.
 */
async function sendInteractiveReminder(params = {}) {
  const {
    phone,
    contactName = "Customer",
    reminderType = "appointment_reminder",
    title = "Interactive Reminder",
    messageText,
    options = [],
    refTable = null,
    refId = null,
    staffName = null,
    sessionKey = null,
  } = params;

  const normalizedPhone = cleanPhone(phone);
  if (!normalizedPhone || normalizedPhone.length < 10) {
    throw new Error("Valid recipient phone number is required");
  }

  const defaultOptionsMap = {
    appointment_reminder: [
      { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
    ],
    payment_due: [
      { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
    ],
    quotation_followup: [
      { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
    ],
    amc_renewal: [
      { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
      { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
    ],
    lead_followup: [
      { id: "btn_interested", label: "👍 Interested", action: "confirm_lead_interest" },
      { id: "btn_demo", label: "📅 Book Demo", action: "reschedule_appointment" },
      { id: "btn_not_now", label: "❌ Not Now", action: "cancel_appointment" },
    ],
  };

  const finalOptions = options && options.length > 0
    ? options
    : (defaultOptionsMap[reminderType] || defaultOptionsMap.appointment_reminder);

  const formattedText = messageText || `Hello ${contactName}! This is a reminder regarding your scheduled service with us. Please confirm your availability:`;

  // 1. Record in wa_interactive_reminders
  const [insertRes] = await db.promise().query(
    `INSERT INTO wa_interactive_reminders (
      phone, contact_name, reminder_type, reference_table, reference_id,
      title, message_text, options_payload, status, scheduled_for, sent_at, assigned_staff_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW(), NOW(), ?)`,
    [
      normalizedPhone,
      contactName,
      reminderType,
      refTable,
      refId,
      title,
      formattedText,
      JSON.stringify(finalOptions),
      staffName,
    ]
  );
  const reminderId = insertRes.insertId;

  // 2. Dispatch interactive message (Cloud API buttons vs Baileys Web numbered menu)
  const waCloud = require("./whatsappCloudApi");
  const waLoadBalancer = require("./waLoadBalancer");
  const mdToWa = require("./mdToWa");

  try {
    if (waCloud.isConfigured() && finalOptions.length <= 3) {
      // Send native Meta interactive buttons
      await waCloud.sendInteractiveButtons(
        normalizedPhone,
        formattedText,
        finalOptions.map((o) => ({ id: o.id, title: o.label.slice(0, 20) }))
      );
    } else if (waCloud.isConfigured() && finalOptions.length <= 10) {
      // Send native Meta interactive list
      await waCloud.sendInteractiveList(
        normalizedPhone,
        formattedText,
        "Choose Option",
        finalOptions.map((o) => ({ id: o.id, title: o.label.slice(0, 24) }))
      );
    } else {
      // Baileys / Web session numbered text
      const optionsText = finalOptions
        .map((o, idx) => `${idx + 1}️⃣  *${o.label}*`)
        .join("\n");
      const fullText = `${formattedText}\n\n*Please reply with option number (1, 2, or 3) or tap below:*\n${optionsText}`;
      await waLoadBalancer.sendTextMessage(normalizedPhone, mdToWa.toWhatsApp(fullText), sessionKey).catch((sendErr) => {
        console.warn(`⚠️ [WA Interactive Reminder] Live dispatch queued/warn (+${normalizedPhone}): ${sendErr.message}`);
      });
    }

    // Log outbound message in wa_message_logs
    await queryAsync(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, status, created_at)
       VALUES (?, 'outbound', 'interactive_reminder', ?, 'sent', NOW())`,
      [normalizedPhone, formattedText]
    ).catch(() => {});

    console.log(`🔔 [WA Interactive Reminder] Sent reminder #${reminderId} (${reminderType}) to +${normalizedPhone}`);
    return { success: true, reminderId, phone: normalizedPhone, options: finalOptions };
  } catch (err) {
    console.error(`❌ [WA Interactive Reminder] Send failed to +${normalizedPhone}:`, err.message);
    await queryAsync("UPDATE wa_interactive_reminders SET status = 'failed', notes = ? WHERE id = ?", [err.message, reminderId]).catch(() => {});
    return { success: false, reminderId, error: err.message };
  }
}

/**
 * Checks whether an incoming WhatsApp message is an answer to a pending interactive confirmation.
 * Returns true if consumed and processed, false otherwise.
 */
async function handleInboundConfirmation(phone, messageText, interactiveReplyId = null, sessionKey = null) {
  const normalizedPhone = cleanPhone(phone);
  const last10 = normalizedPhone.slice(-10);
  const rawText = (messageText || "").trim();
  const lowerText = rawText.toLowerCase();

  // Find recent pending interactive reminder for this phone (last 48 hours)
  const [rows] = await db.promise().query(
    `SELECT * FROM wa_interactive_reminders 
     WHERE phone LIKE ? AND status IN ('sent', 'pending') 
       AND sent_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
     ORDER BY id DESC LIMIT 1`,
    [`%${last10}`]
  );

  if (!rows || rows.length === 0) return false;
  const reminder = rows[0];

  let options = [];
  try {
    options = typeof reminder.options_payload === "string" ? JSON.parse(reminder.options_payload) : (reminder.options_payload || []);
  } catch (_) {
    options = [];
  }

  let matchedOption = null;

  // 1. Direct Button / List ID match
  if (interactiveReplyId) {
    matchedOption = options.find((o) => o.id === interactiveReplyId || o.action === interactiveReplyId);
  }

  // 2. Number choice match ("1", "2", "3")
  if (!matchedOption && /^[1-9]$/.test(rawText)) {
    const idx = parseInt(rawText, 10) - 1;
    if (options[idx]) matchedOption = options[idx];
  }

  // 3. Fuzzy Keyword / Intent matching
  if (!matchedOption) {
    // Confirmation matches
    const isConfirm = /confirm|yes|ok|sure|coming|accepted|approved|proceed|agree|correct/i.test(lowerText);
    const isReschedule = /reschedule|change|postpone|later|tomorrow|next week|busy|shift|adjust|different time/i.test(lowerText);
    const isCancel = /cancel|not coming|no|reject|not interested|stop|close/i.test(lowerText);
    const isPaid = /paid|done payment|transferred|google pay|phonepe|upi/i.test(lowerText);
    const isCall = /call|talk|speak|support|help|executive|callback/i.test(lowerText);

    if (isConfirm) matchedOption = options.find((o) => o.action.includes("confirm") || o.action.includes("approve") || o.action.includes("renew")) || options[0];
    else if (isReschedule) matchedOption = options.find((o) => o.action.includes("reschedule") || o.action.includes("demo")) || options[1];
    else if (isCancel) matchedOption = options.find((o) => o.action.includes("cancel") || o.action.includes("reject")) || options[2];
    else if (isPaid) matchedOption = options.find((o) => o.action.includes("paid") || o.action.includes("payment")) || options[0];
    else if (isCall) matchedOption = options.find((o) => o.action.includes("call") || o.action.includes("support")) || options[1];
  }

  if (!matchedOption) {
    // If not matched to options, let regular AI reply or flow engine handle it
    return false;
  }

  const action = matchedOption.action;
  const actionLabel = matchedOption.label || action;
  console.log(`🎯 [WA Confirmation] Phone +${normalizedPhone} selected: "${actionLabel}" (${action}) for Reminder #${reminder.id}`);

  // Fetch reminder settings
  const [settingsRows] = await db.promise().query("SELECT * FROM wa_reminder_settings WHERE id = 1");
  const settings = settingsRows[0] || {
    confirmation_auto_update_crm: 1,
    notify_staff_on_response: 1,
  };

  let responseStatus = "confirmed";
  let acknowledgementText = "";

  // ── Execute Action Branches ──
  if (action === "confirm_appointment" || action === "confirm_lead_interest" || action === "renew_amc") {
    responseStatus = "confirmed";
    acknowledgementText = settings.default_confirm_prompt || `🎉 Thank you ${reminder.contact_name || ""}! Your appointment has been CONFIRMED. Our service team will arrive on schedule.`;

    if (settings.confirmation_auto_update_crm) {
      if (reminder.reference_table === "services" && reminder.reference_id) {
        await queryAsync("UPDATE services SET issues = CONCAT(COALESCE(issues,''), ' [WhatsApp Confirmed]') WHERE id = ?", [reminder.reference_id]).catch(() => {});
      } else if (reminder.reference_table === "call_reports" && reminder.reference_id) {
        await queryAsync("UPDATE call_reports SET priority = 'Confirmed' WHERE id = ?", [reminder.reference_id]).catch(() => {});
      } else if (reminder.reference_table === "telecalls" && reminder.reference_id) {
        await queryAsync("UPDATE telecalls SET call_outcome = 'Confirmed - Visit Scheduled' WHERE id = ?", [reminder.reference_id]).catch(() => {});
      }
    }
  } else if (action === "reschedule_appointment") {
    responseStatus = "rescheduled";
    acknowledgementText = settings.default_reschedule_prompt || "We understand! When would you like to reschedule your visit? Please reply with your preferred date/time (e.g. Tomorrow 11 AM) or reply CALL to speak with our coordinator.";

    if (settings.confirmation_auto_update_crm && reminder.reference_table === "telecalls" && reminder.reference_id) {
      await queryAsync("UPDATE telecalls SET followup_required = 'Yes', followup_notes = CONCAT(COALESCE(followup_notes,''), '\n[WhatsApp]: Customer requested to reschedule appointment.') WHERE id = ?", [reminder.reference_id]).catch(() => {});
    }
  } else if (action === "cancel_appointment" || action === "reject_quotation") {
    responseStatus = "cancelled";
    acknowledgementText = settings.default_cancel_prompt || "Your appointment has been cancelled as requested. If you need any assistance in the future, feel free to message us anytime!";

    if (settings.confirmation_auto_update_crm) {
      if (reminder.reference_table === "telecalls" && reminder.reference_id) {
        await queryAsync("UPDATE telecalls SET call_outcome = 'Cancelled by Customer' WHERE id = ?", [reminder.reference_id]).catch(() => {});
      } else if (reminder.reference_table === "quotations" && reminder.reference_id) {
        await queryAsync("UPDATE quotations SET status = 'Rejected' WHERE id = ?", [reminder.reference_id]).catch(() => {});
      }
    }
  } else if (action === "approve_quotation") {
    responseStatus = "confirmed";
    acknowledgementText = `🎉 Thank you ${reminder.contact_name || ""}! Your quotation approval has been recorded. Our team will prepare the official invoice and agreement shortly.`;

    if (settings.confirmation_auto_update_crm && reminder.reference_table === "quotations" && reminder.reference_id) {
      await queryAsync("UPDATE quotations SET status = 'Approved' WHERE id = ?", [reminder.reference_id]).catch(() => {});
    }
  } else if (action === "confirm_payment") {
    responseStatus = "paid";
    acknowledgementText = "Thank you for confirming your payment! Our accounts department will verify the transaction and update your account.";

    if (settings.confirmation_auto_update_crm && reminder.reference_table === "clientinvoices" && reminder.reference_id) {
      await queryAsync("UPDATE clientinvoices SET wa_payment_due_sent = 2 WHERE id = ?", [reminder.reference_id]).catch(() => {});
    }
  } else if (action === "send_invoice_copy") {
    responseStatus = "confirmed";
    acknowledgementText = "Here is your invoice summary. Our team has also sent a complete copy to your registered email address.";
  } else if (action === "request_callback") {
    responseStatus = "rescheduled";
    acknowledgementText = "We have notified our executive to call you back shortly. Thank you for your patience!";
    
    // Register high-priority callback in telecalls
    require("./waLeadCapture").captureLeadFromWhatsApp({
      phone: normalizedPhone,
      name: reminder.contact_name,
      notes: `Customer requested callback regarding ${reminder.reminder_type} (Reminder #${reminder.id})`,
      sourceDetail: "WhatsApp Confirmation Callback Request",
    }).catch(() => {});
  }

  // 1. Update wa_interactive_reminders
  await queryAsync(
    `UPDATE wa_interactive_reminders 
     SET status = ?, response_received_at = NOW(), response_text = ?, response_action = ?
     WHERE id = ?`,
    [responseStatus, rawText || actionLabel, action, reminder.id]
  );

  // 2. Notify staff / admin via Socket & DB notification
  if (settings.notify_staff_on_response) {
    const notifMsg = `WhatsApp Reminder Response: ${reminder.contact_name || `+${normalizedPhone}`} marked "${actionLabel}" for ${reminder.reminder_type}`;
    try {
      const [nRes] = await db.promise().query(
        `INSERT INTO admin_notifications (type, message, related_type, related_id, priority) 
         VALUES ('wa_reminder_response', ?, 'whatsapp', ?, 'high')`,
        [notifMsg, reminder.id]
      );
      const { getNotificationIO } = require("../sockets/notifications");
      const helpers = getNotificationIO();
      if (helpers) {
        helpers.sendToAdmin("new_notification", {
          id: Date.now(),
          dbId: nRes.insertId,
          type: "wa_reminder_response",
          title: `WhatsApp Confirmation: ${responseStatus.toUpperCase()}`,
          message: notifMsg,
          timestamp: new Date().toISOString(),
          is_read: 0,
        });
      }
    } catch (_) {}
  }

  // 3. Send dynamic branded acknowledgment back to customer
  const waLoadBalancer = require("./waLoadBalancer");
  const mdToWa = require("./mdToWa");
  await waLoadBalancer.sendTextMessage(normalizedPhone, mdToWa.toWhatsApp(acknowledgementText), sessionKey).catch((e) => {
    console.warn(`⚠️ [WA Confirmation] Acknowledgment send warning (+${normalizedPhone}):`, e.message);
  });

  // Log outbound acknowledgement in wa_message_logs
  await queryAsync(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, status, created_at)
     VALUES (?, 'outbound', 'text', ?, 'sent', NOW())`,
    [normalizedPhone, acknowledgementText]
  ).catch(() => {});

  return true;
}

async function getConfirmationSummary() {
  const [summaryRows] = await queryAsync(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN status = 'rescheduled' THEN 1 ELSE 0 END) AS rescheduled,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid,
      SUM(CASE WHEN status = 'pending' OR status = 'sent' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM wa_interactive_reminders
  `);
  const s = summaryRows[0] || {};
  const total = Number(s.total) || 0;
  const responded = (Number(s.confirmed) || 0) + (Number(s.rescheduled) || 0) + (Number(s.cancelled) || 0) + (Number(s.paid) || 0);
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  return {
    total,
    confirmed: Number(s.confirmed) || 0,
    rescheduled: Number(s.rescheduled) || 0,
    cancelled: Number(s.cancelled) || 0,
    paid: Number(s.paid) || 0,
    pending: Number(s.pending) || 0,
    failed: Number(s.failed) || 0,
    responseRate,
  };
}

module.exports = {
  sendInteractiveReminder,
  handleInboundConfirmation,
  getConfirmationSummary,
};
