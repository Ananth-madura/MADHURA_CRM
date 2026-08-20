const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");
const waAiReply = require("../services/waAiReply");

// Opt-out keywords (case-insensitive)
const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "opt out", "optout", "cancel", "quit", "end", "remove me", "no more"];

router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const result = wa.verifyWebhook(mode, token, challenge);
  if (result) {
    return res.status(200).send(result);
  }
  res.sendStatus(403);
});

function isValidSignature(req) {
  const appSecret = process.env.WA_APP_SECRET;
  if (!appSecret) return true; // signature check only enforced when an app secret is configured
  const signature = req.headers["x-hub-signature-256"];
  if (!signature || !req.rawBody) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

router.post("/", async (req, res) => {
  try {
    if (!isValidSignature(req)) return res.sendStatus(403);
    const body = req.body;

    await db.promise().query(
      "INSERT INTO wa_webhook_events (event_type, payload) VALUES (?, ?)",
      ["webhook_received", JSON.stringify(body)]
    );

    if (body.entry) {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              const value = change.value;
              if (value.messages) {
                for (const msg of value.messages) {
                  await handleIncomingMessage(msg, value.metadata);
                }
              }
              if (value.statuses) {
                for (const status of value.statuses) {
                  await handleStatusUpdate(status);
                }
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

async function handleIncomingMessage(msg, metadata) {
  const phone = msg.from;
  const msgId = msg.id;
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();

  let messageText = "";
  let messageType = "text";

  if (msg.type === "text") {
    messageText = msg.text.body;
  } else if (msg.type === "interactive") {
    messageType = "interactive";
    messageText = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "";
  } else {
    messageType = msg.type;
    messageText = msg[msg.type]?.caption || msg[msg.type]?.id || "";
  }

  await db.promise().query(
    `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, metadata, created_at)
     VALUES (?, 'inbound', ?, ?, ?, 'delivered', ?, ?)`,
    [phone, messageType, messageText, msgId, JSON.stringify(msg), timestamp]
  );

  await db.promise().query(
    "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
    ["incoming_message", msgId, phone, "received", JSON.stringify(msg)]
  );

  // Emit socket event for real-time live chat update
  const chatId = `${phone}@c.us`;
  try {
    const wa = require("../services/whatsappService").default();
    delete wa.messagesFetchCache[chatId];
  } catch (_) {}
  try {
    const app = require("../server");
    const io = app.get && app.get("io");
    if (io) {
      io.emit("wa_message_received", {
        phone,
        chatId,
        message: {
          id: msgId,
          from: phone,
          body: messageText,
          timestamp: Math.floor(timestamp.getTime() / 1000),
          isMe: false,
          type: messageType,
          hasMedia: messageType !== "text" && messageType !== "interactive",
        },
      });
    }
  } catch (_) {}

  // Mark as replied in any active campaign messages for this phone
  await db.promise().query(
    "UPDATE wa_campaign_messages SET reply_received=1 WHERE phone=? AND status IN ('sent','delivered','read')",
    [phone]
  ).catch(() => {});

  // ── Opt-out detection ─────────────────────────────────────────────────────
  const normalized = messageText.trim().toLowerCase();
  const matchedKeyword = OPT_OUT_KEYWORDS.find(kw => normalized === kw || normalized.startsWith(kw));

  if (matchedKeyword) {
    try {
      // Insert into opt-outs table
      await db.promise().query(
        `INSERT IGNORE INTO wa_opt_outs (phone, reason, opt_out_keyword) VALUES (?, 'user_request', ?)`,
        [phone, matchedKeyword]
      );

      // Mark contact as unsubscribed in wa_contacts
      await db.promise().query(
        `UPDATE wa_contacts SET is_unsubscribed=1, opt_in_status=0, updated_at=NOW() WHERE phone LIKE ?`,
        [`%${phone.slice(-10)}`]
      );

      // Mark pending campaign messages as opted_out
      await db.promise().query(
        `UPDATE wa_campaign_messages SET status='opted_out', opt_out=1, error='User opted out' WHERE phone=? AND status='queued'`,
        [phone]
      );

      await db.promise().query(
        "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
        ["opt_out", msgId, phone, "opted_out", JSON.stringify({ keyword: matchedKeyword, message: messageText })]
      );

      console.log(`✋ Opt-out recorded for ${phone} (keyword: "${matchedKeyword}")`);
    } catch (e) {
      console.error("Opt-out handling error:", e.message);
    }
  } else {
    const waFlowEngine = require("../services/waFlowEngine");
    const buttonReplyId = msg.interactive?.button_reply?.id;
    const listReplyId = msg.interactive?.list_reply?.id;
    const interactiveId = buttonReplyId || listReplyId || null;

    waFlowEngine.dispatchInbound(phone, messageText, interactiveId).then(async (flowHandled) => {
      if (flowHandled) return;

      const waMenuHandler = require("../services/waMenuHandler");
      const menuMsg = {
        text: messageText,
        buttonReplyId,
        listReplyId,
      };
      const menuHandled = await waMenuHandler.handleMenuReply(phone, menuMsg).catch(() => false);
      if (!menuHandled && messageText) {
        const welcomeSent = await require("../services/waAutomationService").maybeSendWelcomeReply(phone).catch(() => false);
        if (!welcomeSent) return waAiReply.maybeAutoReply(phone, messageText);
      }
    }).catch(() => {});
  }
}

async function handleStatusUpdate(status) {
  const msgId = status.id;
  const statusName = status.status;
  const phone = status.recipient_id;
  const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();
  const errorMsg = statusName === "failed" ? (status.errors?.[0]?.message || "Unknown error") : null;

  const statusColumnMap = { sent: "sent_at", delivered: "delivered_at", read: "read_at", failed: "sent_at" };
  const statusColumn = statusColumnMap[statusName];

  if (statusColumn) {
    const logFields = [`status = ?`, `${statusColumn} = ?`];
    const logParams = [statusName, timestamp];
    if (statusName === "failed") {
      logFields.push(`error = ?`);
      logParams.push(errorMsg);
    }
    logParams.push(msgId);

    await db.promise().query(
      `UPDATE wa_message_logs SET ${logFields.join(", ")} WHERE wa_message_id = ?`,
      logParams
    );

    const campFields = [`status = ?`, `${statusColumn} = ?`];
    const campParams = [statusName, timestamp];
    if (statusName === "failed") {
      campFields.push(`error = ?`);
      campParams.push(errorMsg);
    }
    campParams.push(msgId);

    await db.promise().query(
      `UPDATE wa_campaign_messages SET ${campFields.join(", ")} WHERE wa_message_id = ?`,
      campParams
    );

    if (statusName === "delivered" || statusName === "read") {
      const [rows] = await db.promise().query("SELECT campaign_id FROM wa_campaign_messages WHERE wa_message_id = ?", [msgId]);
      if (rows.length) {
        const col = statusName === "delivered" ? "delivered_count" : "read_count";
        await db.promise().query(`UPDATE wa_campaigns SET ${col} = ${col} + 1 WHERE id = ?`, [rows[0].campaign_id]);
      }
    }

    if (statusName === "failed") {
      const [rows] = await db.promise().query("SELECT campaign_id FROM wa_campaign_messages WHERE wa_message_id = ?", [msgId]);
      if (rows.length) {
        await db.promise().query("UPDATE wa_campaigns SET failed_count = failed_count + 1 WHERE id = ?", [rows[0].campaign_id]);
      }
    }
  }

  await db.promise().query(
    "INSERT INTO wa_webhook_events (event_type, wa_message_id, phone, status, payload) VALUES (?, ?, ?, ?, ?)",
    ["status_update", msgId, phone, statusName, JSON.stringify(status)]
  );
}

module.exports = router;