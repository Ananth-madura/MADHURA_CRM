const axios = require("axios");
const db = require("../config/database");
const { decrypt } = require("../backendutil/cryptoHelper");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function getSettings() {
  const rows = await queryAsync("SELECT * FROM wa_ai_settings WHERE id = 1");
  const row = rows[0];
  return {
    enabled: !!(row && row.enabled),
    model: (row && row.model) || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    system_prompt: (row && row.system_prompt) || "",
    apiKey: (row && row.api_key ? decrypt(row.api_key) : "") || process.env.OPENROUTER_API_KEY || "",
  };
}

// ponytail: contact lookup checks each CRM table in turn — fine at this scale, add a single indexed view if it ever shows up in a slow query log
async function findContactName(phone) {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const lookups = [
    ["wa_contacts", "name", "phone"],
    ["clients", "COALESCE(name, company_name)", "phone"],
    ["telecalls", "COALESCE(customer_name, company_name)", "mobile_number"],
    ["walkins", "COALESCE(customer_name, company_name)", "mobile_number"],
    ["fields", "COALESCE(customer_name, company_name)", "mobile_number"],
  ];
  for (const [table, col, phoneCol] of lookups) {
    try {
      const rows = await queryAsync(`SELECT ${col} as name FROM ${table} WHERE ${phoneCol} LIKE ? LIMIT 1`, [`%${last10}`]);
      if (rows[0] && rows[0].name) return rows[0].name;
    } catch (_) {
      // table/column may not exist in this deployment — skip
    }
  }
  return null;
}

async function getRecentHistory(phone, limit = 6) {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const rows = await queryAsync(
    `SELECT direction, message_text FROM wa_message_logs
     WHERE phone LIKE ? AND message_text IS NOT NULL AND message_text != ''
     ORDER BY created_at DESC LIMIT ?`,
    [`%${last10}`, limit]
  );
  return rows.reverse().map((r) => ({
    role: r.direction === "inbound" ? "user" : "assistant",
    content: r.message_text,
  }));
}

// The model is instructed to answer with ONLY a JSON object when it wants to
// offer tappable choices. Some models still wrap it in a ```json fence —
// strip that before parsing. Returns null for a normal plain-text reply.
function parseStructuredReply(raw) {
  if (!raw) return null;
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith("{")) return null;

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj.message !== "string") return null;

  if (Array.isArray(obj.reply_buttons) && obj.reply_buttons.length) {
    const buttons = obj.reply_buttons.slice(0, 3).map((b, i) => ({
      id: String(b.id || `opt_${i}`),
      title: String(b.title || b.id || `Option ${i + 1}`).slice(0, 20),
    }));
    return { message: obj.message, buttons };
  }
  if (obj.list && Array.isArray(obj.list.items) && obj.list.items.length) {
    const items = obj.list.items.slice(0, 10).map((item, i) => ({
      id: `opt_${i}`,
      title: String(item).slice(0, 24),
    }));
    return { message: obj.message, list: { title: String(obj.list.title || "View Options").slice(0, 20), items } };
  }
  return { message: obj.message };
}

// Detects the model asking to run a tool: {"action": "tool_name"}. Distinct
// from parseStructuredReply's {message, reply_buttons/list} shape — an action
// request has no "message" and is never sent to the customer as-is.
function parseActionRequest(raw) {
  if (!raw) return null;
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith("{")) return null;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.action === "string" && !obj.message) return { action: obj.action };
  } catch {
    // not JSON — a normal plain-text reply
  }
  return null;
}

function buildNumberedText(message, options) {
  return `${message}\n\n` + options.map((o, i) => `${i + 1}. ${o.title}`).join("\n");
}

async function logOutbound(phone, messageType, text) {
  try {
    await queryAsync(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, status, created_at)
       VALUES (?, 'outbound', ?, ?, 'sent', NOW())`,
      [phone, messageType, text]
    );
  } catch (_) {}
}

async function generateReply(phone, incomingText, contactNameOverride) {
  const settings = await getSettings();
  if (!settings.apiKey) return null;

  const contactName = contactNameOverride || (await findContactName(phone).catch(() => null));
  const history = await getRecentHistory(phone).catch(() => []);
  const knowledge = await require("./waKnowledgeBase").buildContext().catch(() => "");

  let systemPrompt =
    settings.system_prompt ||
    `You are a friendly, helpful WhatsApp assistant for a business. Chat naturally and openly with the customer, answer their questions directly and conversationally (1-4 sentences), like a real team member would. Avoid quoting exact prices or making firm commitments you're not certain about — say a team member will confirm those instead.${
      contactName ? ` The customer's name is ${contactName}.` : ""
    }`;

  if (knowledge) {
    systemPrompt += `\n\nUse the following reference material to answer questions accurately. Only use it when relevant — don't mention that you were given documents:\n\n${knowledge}`;
  }

  systemPrompt += `\n\nWhenever you want the user to choose from a small set of predefined options instead of typing a free-form reply, respond with ONLY a JSON object (no other text, no markdown code fences) in one of these two shapes:
Up to 3 choices — reply buttons: {"message": "...", "reply_buttons": [{"id": "...", "title": "..."}, {"id": "...", "title": "..."}]}
More than 3 choices — a list: {"message": "...", "list": {"title": "...", "items": ["...", "...", "..."]}}
Otherwise, just reply normally with plain text. The user's tap is sent back to you automatically as their next message — never ask them to type or reply with a number.

${require("./waAiTools").TOOLS_DESCRIPTION}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: incomingText },
  ];

  const OPEN_WEIGHT_MODELS = [
    settings.model || DEFAULT_MODEL,
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "google/gemma-2-9b-it:free",
    "mistralai/mistral-7b-instruct:free",
  ];

  const callModelWithFallback = async () => {
    // Try primary model first, then fallback across open-weight models if rate-limited
    const tried = new Set();
    for (const m of OPEN_WEIGHT_MODELS) {
      if (!m || tried.has(m)) continue;
      tried.add(m);
      try {
        const { data } = await axios.post(
          OPENROUTER_URL,
          { model: m, messages, max_tokens: 300 },
          {
            headers: {
              Authorization: `Bearer ${settings.apiKey}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          }
        );
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      } catch (err) {
        console.warn(`⚠️ [WA AI Reply] Open-weight model '${m}' failed/timed out: ${err.message}. Trying next model...`);
      }
    }
    return null;
  };

  try {
    for (let round = 0; round < 2; round++) {
      const raw = await callModelWithFallback();
      if (!raw) return null;

      const action = parseActionRequest(raw);
      if (!action) return raw;

      const toolResult = await require("./waAiTools").runTool(action.action, phone);
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `[Tool result for ${action.action}]: ${JSON.stringify(toolResult)}\nNow reply to the customer using this real data — plain text, or buttons/list JSON if that fits better. Don't mention "tool" or "JSON" to them.`,
      });
    }
    await require("./waAiTools").runTool("request_human_support", phone).catch(() => {});
    return "Let me have a team member confirm that for you.";
  } catch (err) {
    console.error("[WA AI Reply] generation failed:", err.response?.data || err.message);
    return null;
  }
}

async function maybeAutoReply(phone, incomingText, contactName, sessionKey) {
  if (!phone || !incomingText) return;
  const cleanPhone = phone.replace(/\D/g, "");
  const last10 = cleanPhone.slice(-10);

  try {
    const settings = await getSettings();
    if (!settings.enabled) return;

    const optedOut = await queryAsync("SELECT id FROM wa_opt_outs WHERE phone LIKE ? LIMIT 1", [`%${last10}`]);
    if (optedOut.length) return;

    // One query covers all three per-contact gates: blocked, the per-chat AI
    // switch, and the human-takeover pause set when an operator replies by hand.
    const contact = (await queryAsync(
      "SELECT is_blocked, ai_enabled, ai_paused_until FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
      [`%${last10}`]
    ))[0];
    if (contact) {
      if (contact.is_blocked) return;
      if (contact.ai_enabled === 0) return;
      if (contact.ai_paused_until && new Date(contact.ai_paused_until) > new Date()) {
        console.log(`🤖 [WA AI Reply] Skipped ${cleanPhone} — human is handling this chat`);
        return;
      }
    }

    // ── Generate reply from AI model ──
    const reply = await generateReply(cleanPhone, incomingText, contactName);
    if (!reply) return;

    // ── Check for [[HANDOFF]] sentinel in AI reply ─────────────────────────
    if (reply.includes("[[HANDOFF]]")) {
      console.log(`🙋 [WA AI Reply] [[HANDOFF]] detected for ${cleanPhone}. Pausing AI and handing off to human agent.`);
      const cleanedReply = reply.replace(/\[\[HANDOFF\]\]/g, "").trim() || "I have notified our team to connect with you directly. An agent will reply shortly!";
      
      // Pause AI for 180 minutes on this contact
      await queryAsync(
        "UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 180 MINUTE), ai_autoreply_disabled = 1 WHERE phone LIKE ?",
        [`%${last10}`]
      ).catch(() => {});

      const waLoadBalancer = require("./waLoadBalancer");
      const mdToWa = require("./mdToWa");
      await waLoadBalancer.sendTextMessage(cleanPhone, mdToWa.toWhatsApp(cleanedReply), sessionKey);
      await logOutbound(cleanPhone, "text", cleanedReply);
      return;
    }

    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    const structured = parseStructuredReply(reply);
    const textToSend = structured ? structured.message : reply;
    const formattedText = mdToWa.toWhatsApp(textToSend);

    // Increment AI reply counter for this contact
    await queryAsync(
      "UPDATE wa_contacts SET ai_reply_count = COALESCE(ai_reply_count, 0) + 1 WHERE phone LIKE ?",
      [`%${last10}`]
    ).catch(() => {});

    // Replies leave from the number that received the message.
    await waLoadBalancer.sendTextMessage(cleanPhone, formattedText, sessionKey);
    await logOutbound(cleanPhone, "text", formattedText);

    console.log(`🤖 [WA AI Reply] Auto-replied to ${cleanPhone} via Load Balancer`);
  } catch (err) {
    console.error("[WA AI Reply] maybeAutoReply error:", err.message);
  }
}

module.exports = { getSettings, generateReply, maybeAutoReply };
