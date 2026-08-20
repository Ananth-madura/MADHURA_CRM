/**
 * waCampaignEngine.js
 *
 * Safe WhatsApp Bulk Sending Engine
 * - Random delay between messages (configurable min–max)
 * - Pause every N messages for 2–5 minutes
 * - Working hours check (don't send outside configured hours)
 * - Daily limit enforcement
 * - Opt-in / opt-out check before every send
 * - Retry failed messages after 15–30 minutes (up to max_retries)
 * - Duplicate filter
 * - Campaign-aware pause/resume/cancel via DB status
 */

const db = require("../config/database");

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Sleeps in small chunks instead of one long setTimeout, re-checking the
// campaign's DB status between chunks — so Stop/Cancel (from the Stop All
// button or a single campaign's Stop) takes effect within a few seconds
// instead of waiting out a full 5-minute working-hours or pause-break sleep.
async function interruptibleSleep(totalMs, campaignId, checkIntervalMs = 3000) {
  let remaining = totalMs;
  while (remaining > 0) {
    const chunk = Math.min(checkIntervalMs, remaining);
    await sleep(chunk);
    remaining -= chunk;
    if (remaining <= 0) break;
    const campaign = await getCampaignStatus(campaignId);
    if (!campaign || campaign.status !== "running") break;
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if current time is within working hours for a given timezone.
 * Returns true if we should be sending now.
 */
function isWithinWorkingHours(startTime, endTime, timezone) {
  try {
    const now = new Date();
    const tzOptions = { timeZone: timezone || "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
    const timeStr = new Intl.DateTimeFormat("en-US", tzOptions).format(now);
    const [h, m] = timeStr.split(":").map(Number);
    const currentMinutes = h * 60 + m;

    const [sh, sm] = (startTime || "09:00").split(":").map(Number);
    const [eh, em] = (endTime || "21:00").split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return true; // fallback: always allow
  }
}

/**
 * Check if phone number has opted out (in wa_opt_outs table).
 */
async function isOptedOut(phone) {
  try {
    const [rows] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE phone = ? LIMIT 1",
      [phone]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if contact is blocked in wa_contacts.
 */
async function isBlocked(phone) {
  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const [rows] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE (phone = ? OR phone LIKE ?) AND is_blocked = 1 LIMIT 1",
      [phone, `%${cleanPhone}`]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get fresh campaign data from DB (including status).
 */
async function getCampaignStatus(campaignId) {
  const [rows] = await db.promise().query(
    "SELECT * FROM wa_campaigns WHERE id = ?",
    [campaignId]
  );
  return rows[0] || null;
}

/**
 * Count messages sent today for a campaign (for daily limit enforcement).
 */
async function getSentTodayCount(campaignId) {
  const [rows] = await db.promise().query(
    `SELECT COUNT(*) as cnt FROM wa_campaign_messages
     WHERE campaign_id = ? AND status IN ('sent','delivered','read')
     AND DATE(sent_at) = CURDATE()`,
    [campaignId]
  );
  return rows[0]?.cnt || 0;
}

// ── Core message sender ───────────────────────────────────────────────────────

// sessionKey pins the campaign to the number it was launched from.
async function sendOneCampaignMessage(msgRow, sessionKey) {
  const waCloud = require("./whatsappCloudApi");
  const waWeb = require("./whatsappService").get(sessionKey);

  const {
    id: msgId, campaign_id, phone, contact_name, message_text, template_name, template_components, attempts,
    media_type, media_url, location_lat, location_lng, location_name, location_address,
  } = msgRow;

  // Mark as sending
  await db.promise().query(
    "UPDATE wa_campaign_messages SET status='sending', attempts=attempts+1 WHERE id=?",
    [msgId]
  );

  let result;
  let waMessageId;

  try {
    const { formatMessagePlaceholders, buildTemplateBodyComponent, lookupCrmDataByPhone } = require("./waAutomationService");
    // Real CRM values (company/city/email) for any {placeholder} in the
    // message or template, not just the contact's name.
    const crmData = await lookupCrmDataByPhone(phone).catch(() => ({}));
    const mergedData = { ...crmData, phone };
    // message_text was never substituted for bulk campaigns before — every
    // contact got the literal "{name}" etc. Resolve it once here for text and
    // media-caption sends.
    const resolvedText = message_text ? formatMessagePlaceholders(message_text, contact_name, mergedData) : message_text;

    const waLoadBalancer = require("./waLoadBalancer");

    if (template_name) {
      const components = (typeof template_components === "string"
        ? JSON.parse(template_components || "[]")
        : (template_components || [])
      ).filter((c) => c.type !== "body");
      const [tmplRows] = await db.promise().query("SELECT body FROM wa_templates WHERE name = ? LIMIT 1", [template_name]);
      const bodyComponent = tmplRows[0] ? buildTemplateBodyComponent(tmplRows[0].body, contact_name, mergedData) : null;
      const finalComponents = bodyComponent ? [...components, bodyComponent] : components;
      result = await waLoadBalancer.sendTemplateMessage(phone, template_name, "en", finalComponents, sessionKey);
    } else if (media_type && media_url) {
      result = await waLoadBalancer.sendMediaMessage(phone, media_type, media_url, resolvedText || "", sessionKey);
    } else {
      result = await waLoadBalancer.sendTextMessage(phone, resolvedText, sessionKey);
    }

    waMessageId = result?.messages?.[0]?.id || result?.id?._serialized || "sent_" + Date.now();

    // Success
    await db.promise().query(
      `UPDATE wa_campaign_messages SET status='sent', wa_message_id=?, sent_at=NOW(), next_retry_at=NULL WHERE id=?`,
      [waMessageId, msgId]
    );

    // Log
    const loggedType = template_name ? "template" : (media_type && media_url) ? "media" : (location_lat != null && location_lng != null) ? "interactive" : "text";
    await db.promise().query(
      `INSERT IGNORE INTO wa_message_logs (session_key, campaign_id, campaign_message_id, phone, direction, message_type, message_text, template_name, wa_message_id, status, sent_at)
       VALUES (?,?,?,?,'outbound',?,?,?,?,'sent',NOW())`,
      [sessionKey || require("./whatsappService").defaultKey, campaign_id, msgId, phone, loggedType, message_text, template_name, waMessageId]
    );

    // Update campaign sent_count
    await db.promise().query(
      `UPDATE wa_campaigns SET sent_count = sent_count + 1, sent_today = sent_today + 1, last_sent_date = CURDATE() WHERE id=?`,
      [campaign_id]
    );

    // Update last_contacted in wa_contacts
    await db.promise().query(
      `UPDATE wa_contacts SET last_contacted=NOW() WHERE phone=? OR phone LIKE ?`,
      [phone, `%${phone.slice(-10)}`]
    ).catch(() => {});

    // Emit live socket event to update Live Chats in real-time
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const cleanPhone = phone.replace(/\D/g, "");
        const chatId = `${cleanPhone}@c.us`;
        const ownerKey = sessionKey || require("./whatsappService").defaultKey;
        const livePayload = {
          phone: cleanPhone,
          chatId,
          sessionKey: ownerKey,
          message: {
            id: waMessageId,
            from: "me",
            body: resolvedText || (media_url ? "📎 Attachment" : template_name ? `Template: ${template_name}` : ""),
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            hasMedia: !!(media_type && media_url),
            mediaType: media_type || null,
          },
        };
        io.to(`user:${ownerKey}`).emit("wa_message_sent", livePayload);
        io.emit("wa_message_sent", livePayload);
      }
    } catch (_) {}

    return { success: true, waMessageId };
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    const maxRetries = 3; // will be overridden from campaign settings in run loop

    await db.promise().query(
      `UPDATE wa_campaign_messages SET status='failed', error=?, next_retry_at=NULL WHERE id=?`,
      [errorMsg, msgId]
    );

    await db.promise().query(
      `UPDATE wa_campaigns SET failed_count = failed_count + 1 WHERE id=?`,
      [campaign_id]
    );

    return { success: false, error: errorMsg };
  }
}

// ── Main campaign run loop ────────────────────────────────────────────────────

/**
 * Run a single campaign with safe sending logic.
 * This is called once per campaign launch; it runs asynchronously
 * and checks campaign status before each message.
 */
async function runCampaign(campaignId) {
  console.log(`🚀 Campaign ${campaignId}: Starting safe send loop`);

  let campaign = await getCampaignStatus(campaignId);
  if (!campaign) {
    console.error(`Campaign ${campaignId} not found`);
    return;
  }

  const {
    random_delay_min = 7,
    random_delay_max = 12,
    pause_every = 25,
    pause_duration_min = 120,
    pause_duration_max = 300,
    retry_failed = 1,
    max_retries = 3,
    retry_delay_min = 15,
    retry_delay_max = 30,
    daily_limit = 0,
    start_time = "09:00",
    end_time = "21:00",
    timezone = "Asia/Kolkata",
    duplicate_filter = 1,
  } = campaign;

  let sentThisSession = 0;
  let totalProcessed = 0;

  // Track seen phones for duplicate filter
  const seenPhones = new Set();

  while (true) {
    // Re-fetch campaign status from DB (allows pause/cancel from UI)
    campaign = await getCampaignStatus(campaignId);
    if (!campaign) break;

    if (campaign.status === "paused") {
      console.log(`⏸️  Campaign ${campaignId}: Paused — waiting 10s before checking again`);
      await sleep(10000);
      continue;
    }

    if (campaign.status === "cancelled" || campaign.status === "completed" || campaign.status === "failed") {
      console.log(`⛔ Campaign ${campaignId}: Status is '${campaign.status}' — stopping`);
      break;
    }

    // Check working hours
    if (!isWithinWorkingHours(campaign.start_time || start_time, campaign.end_time || end_time, campaign.timezone || timezone)) {
      console.log(`🕐 Campaign ${campaignId}: Outside working hours — waiting 5 minutes`);
      await interruptibleSleep(5 * 60 * 1000, campaignId);
      continue;
    }

    // Check daily limit
    if (daily_limit > 0) {
      const sentToday = await getSentTodayCount(campaignId);
      if (sentToday >= daily_limit) {
        console.log(`📊 Campaign ${campaignId}: Daily limit (${daily_limit}) reached — pausing until tomorrow`);
        await db.promise().query("UPDATE wa_campaigns SET status='paused' WHERE id=?", [campaignId]);
        break;
      }
    }

    // Get next queued message(s) — fetch one at a time for safe control
    const [queuedRows] = await db.promise().query(
      `SELECT * FROM wa_campaign_messages
       WHERE campaign_id=? AND status='queued'
       ORDER BY id ASC LIMIT 1`,
      [campaignId]
    );

    // Also check for retryable failed messages
    let nextMsg = queuedRows[0] || null;

    if (!nextMsg && retry_failed) {
      const [retryRows] = await db.promise().query(
        `SELECT * FROM wa_campaign_messages
         WHERE campaign_id=? AND status='failed' AND attempts < ?
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY id ASC LIMIT 1`,
        [campaignId, max_retries]
      );
      nextMsg = retryRows[0] || null;
    }

    if (!nextMsg) {
      // Check if campaign is truly complete
      const [remaining] = await db.promise().query(
        "SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE campaign_id=? AND status IN ('queued','sending')",
        [campaignId]
      );
      if (remaining[0].cnt === 0) {
        console.log(`✅ Campaign ${campaignId}: All messages processed — marking complete`);
        await db.promise().query(
          "UPDATE wa_campaigns SET status='completed', completed_at=NOW() WHERE id=?",
          [campaignId]
        );
      }
      break;
    }

    // Duplicate filter
    if (duplicate_filter && seenPhones.has(nextMsg.phone)) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='skipped', error='Duplicate phone number' WHERE id=?",
        [nextMsg.id]
      );
      continue;
    }
    if (duplicate_filter) seenPhones.add(nextMsg.phone);

    // Opt-out check
    const optedOut = await isOptedOut(nextMsg.phone);
    if (optedOut) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='opted_out', error='User has opted out', opt_out=1 WHERE id=?",
        [nextMsg.id]
      );
      await db.promise().query(
        "UPDATE wa_campaigns SET failed_count=failed_count+1 WHERE id=?",
        [campaignId]
      );
      continue;
    }

    // Blocked check
    const blocked = await isBlocked(nextMsg.phone);
    if (blocked) {
      await db.promise().query(
        "UPDATE wa_campaign_messages SET status='skipped', error='Contact is blocked' WHERE id=?",
        [nextMsg.id]
      );
      continue;
    }

    // SEND THE MESSAGE
    console.log(`📤 Campaign ${campaignId}: Sending to ${nextMsg.phone} (attempt ${(nextMsg.attempts || 0) + 1})`);
    // Re-read from the row each iteration so it survives a pause/resume.
    const sendResult = await sendOneCampaignMessage({ ...nextMsg, campaign_id: campaignId }, campaign.session_key);

    sentThisSession++;
    totalProcessed++;

    if (!sendResult.success && retry_failed && (nextMsg.attempts || 0) < max_retries - 1) {
      // Schedule retry
      const retryDelay = randomInt(
        campaign.retry_delay_min || retry_delay_min,
        campaign.retry_delay_max || retry_delay_max
      );
      await db.promise().query(
        `UPDATE wa_campaign_messages SET status='queued', next_retry_at=DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=?`,
        [retryDelay, nextMsg.id]
      );
      console.log(`🔄 Campaign ${campaignId}: Message ${nextMsg.id} will retry in ${retryDelay} minutes`);
    }

    // Pause every N messages
    const pauseEvery = campaign.pause_every || pause_every;
    if (sentThisSession > 0 && sentThisSession % pauseEvery === 0) {
      const pauseSec = randomInt(
        campaign.pause_duration_min || pause_duration_min,
        campaign.pause_duration_max || pause_duration_max
      );
      console.log(`⏳ Campaign ${campaignId}: Sent ${sentThisSession} messages — taking a ${pauseSec}s break`);
      await interruptibleSleep(pauseSec * 1000, campaignId);
    } else {
      // Random delay between messages (human-like pattern)
      const delayMin = campaign.random_delay_min || random_delay_min;
      const delayMax = campaign.random_delay_max || random_delay_max;

      // Add slight variance: every 5th message gets a longer delay
      let actualDelayMax = delayMax;
      if (sentThisSession % 5 === 0) actualDelayMax = delayMax + 3;

      const delaySec = randomInt(delayMin, actualDelayMax);
      console.log(`⏱️  Campaign ${campaignId}: Waiting ${delaySec}s before next message`);
      await sleep(delaySec * 1000);
    }
  }

  console.log(`🏁 Campaign ${campaignId}: Loop ended. Processed ${totalProcessed} messages this session.`);
}

// ── Exported API (backward compatible with waQueue) ───────────────────────────

/**
 * Queue and immediately start a campaign in the background.
 * All campaign settings are read from the DB record.
 */
// Different campaigns run concurrently by design — each loop claims its own
// rows. The SAME campaign started twice would double-send, because the
// "pick next queued row" SELECT and its status='sending' UPDATE aren't atomic.
const runningCampaigns = new Set();

async function startCampaignEngine(campaignId) {
  const key = String(campaignId);
  if (runningCampaigns.has(key)) {
    console.log(`ℹ️ Campaign ${campaignId}: already running — ignoring duplicate start`);
    return;
  }
  runningCampaigns.add(key);

  // Run in background (don't await)
  runCampaign(campaignId)
    .catch((err) => {
      console.error(`Campaign ${campaignId} engine error:`, err.message);
      db.promise().query("UPDATE wa_campaigns SET status='failed' WHERE id=? AND status='running'", [campaignId]).catch(() => {});
    })
    .finally(() => runningCampaigns.delete(key));
}

/**
 * Legacy compatibility: process a list of messages with random delays.
 * Used by the old campaign routes that pre-insert wa_campaign_messages.
 */
async function addBulkMessages(campaignId, messages, delayMs = 0, customIntervalMs = 7000) {
  // For backward compat, just start the engine which will pick up queued messages
  setTimeout(() => {
    startCampaignEngine(campaignId).catch(() => {});
  }, delayMs || 500);
  return { success: true, count: messages.length };
}

async function addSingleMessage(data, delayMs = 0, sessionKey) {
  if (delayMs) await sleep(delayMs);
  return sendOneCampaignMessage(data, sessionKey);
}

async function getQueueStats() {
  try {
    const [[queued]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='queued'");
    const [[sending]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='sending'");
    const [[done]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status IN ('sent','delivered','read')");
    const [[failed]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_campaign_messages WHERE status='failed'");
    return { waiting: queued.cnt, active: sending.cnt, completed: done.cnt, failed: failed.cnt, delayed: 0, mode: "db-engine" };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, mode: "db-engine-error" };
  }
}

async function startWorker() {
  console.log("✅ WA Campaign Engine ready (DB-backed safe sending)");
}

module.exports = {
  startCampaignEngine,
  runCampaign,
  addBulkMessages,
  addSingleMessage,
  getQueueStats,
  startWorker,
  isOptedOut,
  isBlocked,
  isWithinWorkingHours,
};
