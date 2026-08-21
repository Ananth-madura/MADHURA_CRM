"use strict";

const axios = require("axios");
const db = require("../config/database");
const { decrypt } = require("../backendutil/cryptoHelper");

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function getSettings() {
  try {
    const rows = await queryAsync("SELECT * FROM wa_ai_settings WHERE id = 1");
    const row = rows[0] || {};
    return {
      enabled: !!row.enabled,
      provider: row.provider || "openrouter",
      model: row.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      system_prompt: row.system_prompt || "",
      apiKey: (row.api_key ? decrypt(row.api_key) : "") || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "",
      auto_lead_capture: row.auto_lead_capture !== 0,
      human_handoff_keywords: row.human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
      custom_api_url: row.custom_api_url || null,
      temperature: parseFloat(row.temperature) || 0.7,
      max_tokens: parseInt(row.max_tokens, 10) || 350,
    };
  } catch {
    return {
      enabled: false,
      provider: "openrouter",
      model: DEFAULT_MODEL,
      system_prompt: "",
      apiKey: process.env.OPENROUTER_API_KEY || "",
      auto_lead_capture: true,
      human_handoff_keywords: "human, agent, executive, support, speak to person, call me",
      temperature: 0.7,
      max_tokens: 350,
    };
  }
}

function resolveProviderUrl(provider, apiKey, customUrl) {
  if (customUrl) return customUrl.replace(/\/$/, "") + "/chat/completions";

  const cleanKey = (apiKey || "").trim();
  if (provider === "openai") return OPENAI_URL;
  if (provider === "groq") return GROQ_URL;
  if (provider === "gemini") return GEMINI_OPENAI_URL;
  if (provider === "openrouter") return OPENROUTER_URL;

  // Auto-detect from key prefix
  if (cleanKey.startsWith("gsk_")) return GROQ_URL;
  if (cleanKey.startsWith("AIza")) return GEMINI_OPENAI_URL;
  if (cleanKey.startsWith("sk-or-")) return OPENROUTER_URL;
  if (cleanKey.startsWith("sk-")) return OPENAI_URL;

  return OPENROUTER_URL;
}

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
      if (rows[0] && rows[0].name && rows[0].name !== "WhatsApp Lead") return rows[0].name;
    } catch (_) {}
  }
  return null;
}

async function getRecentHistory(phone, limit = 8) {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  const rows = await queryAsync(
    `SELECT direction, message_text FROM wa_message_logs
     WHERE phone LIKE ? AND message_text IS NOT NULL AND message_text != ''
     ORDER BY id DESC LIMIT ?`,
    [`%${last10}`, limit]
  );
  return rows.reverse().map((r) => ({
    role: r.direction === "inbound" ? "user" : "assistant",
    content: r.message_text,
  }));
}

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

function parseActionRequest(raw) {
  if (!raw) return null;
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  if (!text.startsWith("{")) return null;
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj.action === "string" && !obj.message) {
      return { action: obj.action, params: obj.params || {} };
    }
  } catch (_) {}
  return null;
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
  if (!settings.apiKey) {
    console.warn("⚠️ [WA AI Reply] Missing AI API Key. Please configure API Key in WhatsApp Settings.");
    return null;
  }

  const contactName = contactNameOverride || (await findContactName(phone).catch(() => null));
  const history = await getRecentHistory(phone).catch(() => []);
  const knowledge = await require("./waKnowledgeBase").buildContext().catch(() => "");

  let systemPrompt =
    settings.system_prompt ||
    `You are the official intelligent WhatsApp assistant for our company.
You are professional, polite, concise, and helpful. Answer customer queries conversationally (2-4 sentences max).
Help them with product/service inquiries, pricing quotes, AMC maintenance, invoice questions, and support.${
      contactName ? ` The customer's registered name is ${contactName}.` : ""
    }`;

  if (knowledge) {
    systemPrompt += `\n\n=== COMPANY KNOWLEDGE BASE ===\nUse this official information to answer accurately:\n${knowledge}`;
  }

  systemPrompt += `\n\n=== INTERACTIVE BUTTONS ===
When you want the user to pick from predefined options, reply with ONLY a JSON object:
- Up to 3 buttons: {"message": "...", "reply_buttons": [{"id": "1", "title": "Option 1"}, {"id": "2", "title": "Option 2"}]}
- More than 3 items: {"message": "...", "list": {"title": "View Services", "items": ["Service A", "Service B", "Service C"]}}

${require("./waAiTools").TOOLS_DESCRIPTION}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: incomingText },
  ];

  const apiUrl = resolveProviderUrl(settings.provider, settings.apiKey, settings.custom_api_url);
  const primaryModel = settings.model || DEFAULT_MODEL;

  const candidateModels = [
    primaryModel,
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "qwen/qwen-2.5-72b-instruct:free",
    "gpt-4o-mini",
  ];

  const callModel = async (modelToUse) => {
    const isGemini = apiUrl.includes("generativelanguage.googleapis.com");
    const headers = {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    };
    if (apiUrl.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "https://achmecrm.com";
      headers["X-Title"] = "MADHURA WhatsApp CRM";
    }

    const payload = {
      model: modelToUse,
      messages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 350,
    };

    const { data } = await axios.post(apiUrl, payload, { headers, timeout: 20000 });
    return data?.choices?.[0]?.message?.content?.trim();
  };

  try {
    for (let round = 0; round < 3; round++) {
      let raw = null;
      let lastErr = null;

      // Try primary model first
      try {
        raw = await callModel(primaryModel);
      } catch (err) {
        lastErr = err;
        console.warn(`⚠️ [WA AI Reply] Primary model '${primaryModel}' call failed (${err.message}). Trying fallback models...`);
        // If OpenRouter, try fallbacks
        if (apiUrl.includes("openrouter.ai")) {
          for (const fallback of candidateModels) {
            if (fallback === primaryModel) continue;
            try {
              raw = await callModel(fallback);
              if (raw) break;
            } catch (_) {}
          }
        }
      }

      if (!raw) {
        console.error("❌ [WA AI Reply] All AI model calls failed:", lastErr?.response?.data || lastErr?.message);
        return null;
      }

      const action = parseActionRequest(raw);
      if (!action) return raw;

      console.log(`⚡ [WA AI Reply] Executing tool: ${action.action} for ${phone}`);
      const toolResult = await require("./waAiTools").runTool(action.action, phone, action.params);
      
      messages.push({ role: "assistant", content: raw });
      messages.push({
        role: "user",
        content: `[System Tool Result for ${action.action}]: ${JSON.stringify(toolResult)}\nNow respond to the customer naturally using this verified CRM data. Do not mention "tool" or output code fences.`,
      });
    }

    await require("./waAiTools").runTool("request_human_support", phone, { reason: "Conversation max tool loops reached" }).catch(() => {});
    return "Thank you for reaching out! Our specialist will connect with you shortly.";
  } catch (err) {
    console.error("[WA AI Reply] Generation failed:", err.response?.data || err.message);
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

    // Check opt-outs
    const optedOut = await queryAsync("SELECT id FROM wa_opt_outs WHERE phone LIKE ? LIMIT 1", [`%${last10}`]);
    if (optedOut.length) return;

    // Check per-contact AI status & human pause
    const contact = (await queryAsync(
      "SELECT is_blocked, ai_enabled, ai_paused_until FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
      [`%${last10}`]
    ))[0];

    if (contact) {
      if (contact.is_blocked) return;
      if (contact.ai_enabled === 0) return;
      if (contact.ai_paused_until && new Date(contact.ai_paused_until) > new Date()) {
        console.log(`🤖 [WA AI Reply] Skipped ${cleanPhone} — Human agent is actively handling this conversation`);
        return;
      }
    }

    // ── Check for Human Handoff Keywords in incoming message ──
    const handoffKeywords = (settings.human_handoff_keywords || "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const normText = incomingText.trim().toLowerCase();
    const wantsHuman = handoffKeywords.some((kw) => normText.includes(kw));

    if (wantsHuman) {
      console.log(`🙋 [WA AI Reply] Human handoff keyword matched for ${cleanPhone}: "${incomingText}"`);
      await require("./waAiTools").runTool("request_human_support", cleanPhone, { reason: `Keyword match: "${incomingText}"` });
      
      const handoffReply = "I have notified our support executive to take over this chat. A team member will reply to you here shortly! 🙏";
      const waLoadBalancer = require("./waLoadBalancer");
      const mdToWa = require("./mdToWa");
      await waLoadBalancer.sendTextMessage(cleanPhone, mdToWa.toWhatsApp(handoffReply), sessionKey);
      await logOutbound(cleanPhone, "text", handoffReply);
      return;
    }

    // ── Automatic Lead Capture on Inbound Inquiry ──
    if (settings.auto_lead_capture) {
      // If contact is not yet registered or has inquiry text, capture lead in background
      require("./waLeadCapture").captureLeadFromWhatsApp({
        phone: cleanPhone,
        name: contactName,
        notes: incomingText,
        sourceDetail: "WhatsApp AI Inbound",
      }).catch(() => {});
    }

    // ── Generate AI reply ──
    const reply = await generateReply(cleanPhone, incomingText, contactName);
    if (!reply) return;

    if (reply.includes("[[HANDOFF]]")) {
      const cleanedReply = reply.replace(/\[\[HANDOFF\]\]/g, "").trim() || "I have notified our team to connect with you directly. An agent will reply shortly!";
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

    await queryAsync(
      "UPDATE wa_contacts SET ai_reply_count = COALESCE(ai_reply_count, 0) + 1, last_message_text = ?, last_message_at = NOW() WHERE phone LIKE ?",
      [formattedText, `%${last10}`]
    ).catch(() => {});

    await waLoadBalancer.sendTextMessage(cleanPhone, formattedText, sessionKey);
    await logOutbound(cleanPhone, "text", formattedText);

    console.log(`🤖 [WA AI Reply] Successfully auto-replied to ${cleanPhone}`);
  } catch (err) {
    console.error("[WA AI Reply] maybeAutoReply error:", err.message);
  }
}

module.exports = { getSettings, generateReply, maybeAutoReply };
