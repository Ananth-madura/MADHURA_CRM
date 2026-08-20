const db = require("../config/database");

const MENU_EXPIRY_MS = 24 * 60 * 60 * 1000; // pending menus older than this are ignored

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function getOptions(automationId) {
  return queryAsync(
    "SELECT * FROM wa_automation_options WHERE automation_id = ? ORDER BY sort_order ASC, id ASC",
    [automationId]
  );
}

function buildMenuText(options) {
  return "Please choose an option by replying with its number:\n" + options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
}

// Sends the clickable option list for an automation and remembers it so the
// customer's next message can be matched back to one of the options.
async function sendMenu(phone, automationId, sessionKey) {
  const options = await getOptions(automationId);
  if (!options.length) return;

  const waCloud = require("./whatsappCloudApi");
  // sessionKey omitted (CRM-triggered automations) falls back to the owner session.
  const waWeb = require("./whatsappService").get(sessionKey);
  const cleanPhone = phone.replace(/\D/g, "");
  const chatId = `${cleanPhone}@c.us`;

  try {
    if (waCloud.isConfigured() && options.length <= 3) {
      await waCloud.sendInteractiveButtons(
        cleanPhone,
        "Please choose an option:",
        options.map((o) => ({ id: o.id, title: o.label }))
      );
    } else if (waCloud.isConfigured() && options.length <= 10) {
      await waCloud.sendInteractiveList(
        cleanPhone,
        "Please choose an option:",
        "View Options",
        options.map((o) => ({ id: o.id, title: o.label }))
      );
    } else {
      // Free/unofficial engine has no reliable native button support —
      // fall back to a numbered list the customer replies to with a digit.
      await waWeb.sendMessage(chatId, buildMenuText(options));
    }
  } catch (e) {
    console.error("[WA Menu] Interactive send failed, falling back to text:", e.message);
    await waWeb.sendMessage(chatId, buildMenuText(options)).catch(() => {});
  }

  await queryAsync(
    `INSERT INTO wa_pending_menus (phone, automation_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE automation_id = VALUES(automation_id), created_at = NOW()`,
    [cleanPhone, automationId]
  );
}

// Checks whether an inbound message resolves a pending menu for this phone.
// `msg` is normalized: { text, buttonReplyId, listReplyId }.
// Returns true if it was handled (caller should skip further auto-reply logic).
async function handleMenuReply(phone, msg, sessionKey) {
  const cleanPhone = phone.replace(/\D/g, "");
  const rows = await queryAsync("SELECT * FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
  const pending = rows[0];
  if (!pending) return false;

  if (Date.now() - new Date(pending.created_at).getTime() > MENU_EXPIRY_MS) {
    await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
    return false;
  }

  const options = await getOptions(pending.automation_id);
  if (!options.length) {
    await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
    return false;
  }

  let matched = null;
  const replyId = msg.buttonReplyId || msg.listReplyId;
  if (replyId) {
    matched = options.find((o) => String(o.id) === String(replyId));
  }
  if (!matched && msg.text) {
    const trimmed = msg.text.trim();
    const asNumber = parseInt(trimmed, 10);
    if (!isNaN(asNumber) && options[asNumber - 1]) {
      matched = options[asNumber - 1];
    } else {
      const lower = trimmed.toLowerCase();
      matched = options.find((o) => o.label.toLowerCase() === lower || lower.includes(o.label.toLowerCase()));
    }
  }

  if (!matched) return false;

  // Reply goes back out of the number that received the message.
  const waWeb = require("./whatsappService").get(sessionKey);
  await waWeb.sendMessage(`${cleanPhone}@c.us`, matched.reply_text);
  await queryAsync("DELETE FROM wa_pending_menus WHERE phone = ?", [cleanPhone]);
  await queryAsync(
    "INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status) VALUES (?, ?, NULL, ?, 'sent')",
    [pending.automation_id, cleanPhone, JSON.stringify({ menuOptionSelected: matched.label })]
  ).catch(() => {});

  return true;
}

module.exports = { sendMenu, handleMenuReply, getOptions, buildMenuText };
