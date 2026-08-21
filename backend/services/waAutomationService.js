const db = require("../config/database");

/**
 * waAutomationService.js
 *
 * Automatic WhatsApp Trigger Engine
 * Automatically sends WhatsApp messages when CRM events occur
 * (new lead, invoice created, payment received, welcome message, etc.)
 */

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean.length >= 10 ? clean : null;
}

// Looks up a contact's real CRM record by phone so template/message
// placeholders can be filled with actual data instead of being left blank —
// checked in the same order everywhere else in the app treats these sources.
// ponytail: first match wins (one CRM row per phone assumed, as elsewhere in this codebase).
async function lookupCrmDataByPhone(phone) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  if (last10.length < 10) return {};

  const sources = [
    ["clients", "name", "company_name", "city", "email", "phone"],
    ["telecalls", "customer_name", "company_name", "location_city", "email", "mobile_number"],
    ["walkins", "customer_name", "company_name", "location_city", "email", "mobile_number"],
    ["fields", "customer_name", "company_name", "location_city", "email", "mobile_number"],
  ];

  for (const [table, nameCol, companyCol, cityCol, emailCol, phoneCol] of sources) {
    try {
      const [rows] = await db.promise().query(
        `SELECT ${nameCol} AS name, ${companyCol} AS company, ${cityCol} AS city, ${emailCol} AS email
         FROM ${table} WHERE ${phoneCol} LIKE ? LIMIT 1`,
        [`%${last10}`]
      );
      if (rows[0]) return rows[0];
    } catch (_) {
      // table may not exist in every deployment — skip
    }
  }
  return {};
}

// Resolves Spintax format {option1|option2|option3} or [option1|option2|option3]
// to generate dynamic message variations for each recipient so WhatsApp/Meta anti-spam
// hash filters never detect identical messages. Also injects non-rendering micro-jitter.
function resolveSpintax(text, injectMicroJitter = true) {
  if (!text || typeof text !== "string") return "";
  let result = text;
  let matches;
  let iterations = 0;

  // 1. Resolve square bracket spintax: [hii| heloo |welcom | yes we are | how it's | how that all ]
  const squareSpintaxRegex = /\[([^\[\]]+)\]/g;
  iterations = 0;
  while ((matches = result.match(squareSpintaxRegex)) && iterations < 10) {
    result = result.replace(squareSpintaxRegex, (match, choices) => {
      if (!choices.includes("|")) return match;
      const options = choices.split("|");
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    iterations++;
  }

  // 2. Resolve curly bracket spintax: {Hi|Hello|Hey|Greetings|Dear customer}
  const curlySpintaxRegex = /\{([^{}]+)\}/g;
  iterations = 0;
  while ((matches = result.match(curlySpintaxRegex)) && iterations < 10) {
    result = result.replace(curlySpintaxRegex, (match, choices) => {
      // If choices look like a standard placeholder (no pipe), keep it
      if (!choices.includes("|")) return `{${choices}}`;
      const options = choices.split("|");
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    iterations++;
  }

  // 3. Anti-Ban Invisible Micro-Jitter (Zero-Width Space & Non-Joiner Injection)
  // Ensures every outbound message has a 100% unique cryptographic hash for WhatsApp spam filters
  if (injectMicroJitter && result.length > 0) {
    const zwChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
    const randomZw = zwChars[Math.floor(Math.random() * zwChars.length)];
    result = result + randomZw;
  }

  return result;
}

// Substitutes {placeholder} tokens in a message and applies Spintax text variation.
function formatMessagePlaceholders(templateText, contactName, data = {}) {
  let msg = templateText || "Hello {name}!";
  const nameVal = contactName || data.name || data.customer_name || data.company_name || "Customer";

  const known = {
    name: nameVal,
    customer_name: nameVal,
    company: data.company || data.company_name || "",
    company_name: data.company || data.company_name || "",
    city: data.city || data.location_city || "our city",
    location_city: data.city || data.location_city || "our city",
    invoice_no: data.invoice_no || data.invoice_number || "",
    invoice_number: data.invoice_no || data.invoice_number || "",
    amount: data.amount ? `₹${data.amount}` : "",
    date: data.date || new Date().toLocaleDateString("en-IN"),
    due_date: data.due_date || "",
    service: data.service || data.product || "AMC & Services",
    start_time: data.start_time || "09:00 AM",
    end_time: data.end_time || "08:00 PM",
  };

  const dataLookup = {};
  for (const key of Object.keys(data)) dataLookup[key.toLowerCase()] = data[key];

  // 1. Resolve standard CRM placeholders
  let resolved = msg.replace(/\{\{?([a-zA-Z0-9_]+)\}?\}/g, (match, key) => {
    const lowerKey = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(known, lowerKey)) return known[lowerKey];
    if (Object.prototype.hasOwnProperty.call(dataLookup, lowerKey) && dataLookup[lowerKey] != null) {
      return String(dataLookup[lowerKey]);
    }
    return match; // unknown placeholder — leave as-is
  });

  // 2. Resolve Spintax dynamic choices {Hi|Hello|Dear}
  return resolveSpintax(resolved);
}

// Meta Cloud API template sends need a `body` component with one positional
// {{1}},{{2}}... parameter per variable — our wa_templates.body only stores a
// friendly {name}-style mirror of that copy. Extract the tokens in the order
// they appear in our stored body text and resolve each one the same way a
// plain-text send would, so the actual sent template isn't left with blank
// or literal {{n}} placeholders.
function buildTemplateBodyComponent(templateBody, contactName, data = {}) {
  if (!templateBody) return null;
  const tokens = [...templateBody.matchAll(/\{\{?([a-zA-Z0-9_]+)\}?\}/g)].map((m) => m[1]);
  if (!tokens.length) return null;
  return {
    type: "body",
    parameters: tokens.map((t) => ({ type: "text", text: formatMessagePlaceholders(`{${t}}`, contactName, data) })),
  };
}

/**
 * Trigger active WhatsApp automations for a CRM event
 * @param {string} triggerType - 'new_lead' | 'invoice_created' | 'payment_received' | 'welcome_message' | etc.
 * @param {object} eventInfo - { phone, contactName, data }
 */
async function triggerAutomation(triggerType, eventInfo = {}) {
  const { phone, contactName, data = {} } = eventInfo;
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    console.log(`[WA Automation] Skipped '${triggerType}': invalid phone '${phone}'`);
    return { success: false, reason: "invalid_phone" };
  }

  try {
    // 1. Check if phone is opted out or blocked
    const [optOuts] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE phone = ? LIMIT 1",
      [cleanPhone]
    );
    if (optOuts.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: user opted out`);
      return { success: false, reason: "opted_out" };
    }

    const [blocked] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE (phone = ? OR phone LIKE ?) AND is_blocked = 1 LIMIT 1",
      [cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (blocked.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: contact blocked`);
      return { success: false, reason: "blocked" };
    }

    // 2. Fetch active rules matching this exact trigger type
    const [rules] = await db.promise().query(
      `SELECT a.*, t.name as template_name, t.body as template_body,
              ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE a.is_active = 1 AND a.trigger_type = ?`,
      [triggerType]
    );

    if (!rules.length) {
      return { success: true, count: 0, reason: "no_active_rules" };
    }

    // Fill in anything the triggering event didn't already pass (city, email,
    // company...) from the contact's real CRM record — explicit event data
    // (e.g. invoice_no) always wins over the generic lookup.
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    const mergedData = { ...crmData, ...data };
    const resolvedName = contactName || crmData.name || null;

    console.log(`⚡ [WA Automation] Trigger '${triggerType}' matched ${rules.length} rule(s) for ${cleanPhone}`);

    for (const rule of rules) {
      const rawText = rule.message_text || rule.template_body || "Hello {name}! Thank you for reaching out.";
      const messageText = formatMessagePlaceholders(rawText, resolvedName, mergedData);

      if (rule.delay_minutes > 0) {
        // Schedule delayed execution
        setTimeout(async () => {
          await executeAutomationSend(rule, cleanPhone, resolvedName, messageText, mergedData);
        }, rule.delay_minutes * 60 * 1000);

        await db.promise().query(
          `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status)
           VALUES (?, ?, ?, ?, 'sent')`,
          [rule.id, cleanPhone, resolvedName, JSON.stringify({ triggerType, scheduledDelay: rule.delay_minutes, ...mergedData })]
        );
      } else {
        // Execute immediately
        await executeAutomationSend(rule, cleanPhone, resolvedName, messageText, mergedData);
      }
    }

    return { success: true, triggeredCount: rules.length };
  } catch (err) {
    console.error(`❌ [WA Automation] Error handling '${triggerType}':`, err.message);
    return { success: false, error: err.message };
  }
}

async function getWelcomeSettings() {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_welcome_settings WHERE id = 1");
    if (!rows.length) {
      return {
        enabled: true,
        welcome_type: "text",
        welcome_text: "Hello {name}! Welcome to ACHME. Thank you for reaching out to us. How can we help you today?",
        template_id: null,
        cooldown_hours: 24,
      };
    }
    return {
      enabled: !!rows[0].enabled,
      welcome_type: rows[0].welcome_type || "text",
      welcome_text: rows[0].welcome_text || "Hello {name}! Welcome to ACHME.",
      template_id: rows[0].template_id || null,
      cooldown_hours: rows[0].cooldown_hours != null ? rows[0].cooldown_hours : 24,
      working_hours_only: !!rows[0].working_hours_only,
      start_time: rows[0].start_time || "09:00",
      end_time: rows[0].end_time || "21:00",
    };
  } catch (_) {
    return { enabled: false };
  }
}

async function updateWelcomeSettings(settings) {
  const { enabled, welcome_type, welcome_text, template_id, cooldown_hours, working_hours_only, start_time, end_time } = settings;
  await db.promise().query(
    `INSERT INTO wa_welcome_settings (id, enabled, welcome_type, welcome_text, template_id, cooldown_hours, working_hours_only, start_time, end_time)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       enabled = VALUES(enabled),
       welcome_type = VALUES(welcome_type),
       welcome_text = VALUES(welcome_text),
       template_id = VALUES(template_id),
       cooldown_hours = VALUES(cooldown_hours),
       working_hours_only = VALUES(working_hours_only),
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       updated_at = NOW()`,
    [
      enabled ? 1 : 0,
      welcome_type || "text",
      welcome_text || "Hello {name}! Welcome to ACHME.",
      template_id || null,
      parseInt(cooldown_hours || 24, 10),
      working_hours_only ? 1 : 0,
      start_time || "09:00",
      end_time || "21:00",
    ]
  );
  return getWelcomeSettings();
}

async function maybeSendWelcomeReply(phone, contactName, sessionKey) {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) return false;

  const settings = await getWelcomeSettings();
  if (!settings.enabled) return false;

  // 1. Check working hours if enabled
  if (settings.working_hours_only && settings.start_time && settings.end_time) {
    try {
      const now = new Date();
      // Format server time in HH:MM
      const currentHours = now.getHours().toString().padStart(2, "0");
      const currentMinutes = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHours}:${currentMinutes}`;
      if (currentTime < settings.start_time || currentTime > settings.end_time) {
        console.log(`⏰ [WA Welcome] Outside working hours (${currentTime} not in ${settings.start_time}-${settings.end_time}) for ${cleanPhone}`);
        // Optionally send after-hours note if configured, or continue with standard welcome
      }
    } catch (_) {}
  }

  // 2. Check cooldown: Has an outbound welcome message or reply been sent to this phone within cooldown_hours?
  const cooldownHours = settings.cooldown_hours || 24;
  try {
    const [recentWelcomeLogs] = await db.promise().query(
      `SELECT id FROM wa_message_logs
       WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'outbound'
         AND (message_type = 'welcome' OR message_text LIKE '%Welcome%' OR message_text LIKE '%Thank you for reaching out%')
         AND created_at >= NOW() - INTERVAL ? HOUR
       LIMIT 1`,
      [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`, cooldownHours]
    );

    const [recentAutoLogs] = await db.promise().query(
      `SELECT id FROM wa_automation_logs
       WHERE (phone LIKE ? OR phone LIKE ?)
         AND created_at >= NOW() - INTERVAL ? HOUR
       LIMIT 1`,
      [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`, cooldownHours]
    );

    if (recentWelcomeLogs.length > 0 || recentAutoLogs.length > 0) {
      // Cooldown in effect — skip duplicate welcome reply
      console.log(`⏳ [WA Welcome] Cooldown in effect for ${cleanPhone} (${cooldownHours}h)`);
      return false;
    }
  } catch (e) {
    console.error("[WA Welcome] Cooldown check error:", e.message);
  }

  // 3. Resolve CRM Contact Info
  const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
  const resolvedName = contactName || crmData.name || "there";

  // 4. Check if a rich rule exists in wa_automations for 'welcome_message'
  try {
    const [rules] = await db.promise().query(
      `SELECT a.*, t.name as template_name, t.body as template_body,
              ft.name as followup_template_name, ft.body as followup_template_body
       FROM wa_automations a
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE a.is_active = 1 AND a.trigger_type = 'welcome_message'
       LIMIT 1`
    );

    if (rules.length > 0) {
      const rule = rules[0];
      const rawText = rule.message_text || rule.template_body || settings.welcome_text || "Hello {name}! Welcome to ACHME.";
      const messageText = formatMessagePlaceholders(rawText, resolvedName, crmData);
      await executeAutomationSend(rule, cleanPhone, resolvedName, messageText, crmData);
      console.log(`👋 [WA Welcome] Executed rich Welcome Automation rule '${rule.name}' for ${cleanPhone}`);
      return true;
    }
  } catch (ruleErr) {
    console.warn("[WA Welcome] Error querying wa_automations for welcome_message:", ruleErr.message);
  }

  // 5. Default fallback to wa_welcome_settings
  const messageText = formatMessagePlaceholders(
    settings.welcome_text || "Hello {name}! Welcome to ACHME. Thank you for reaching out to us. How can we help you today?",
    resolvedName,
    crmData
  );

  const waLoadBalancer = require("./waLoadBalancer");
  try {
    let res;
    if (settings.welcome_type === "template" && settings.template_id) {
      const [tmplRows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ? LIMIT 1", [settings.template_id]);
      if (tmplRows.length > 0) {
        const bodyComp = buildTemplateBodyComponent(tmplRows[0].body, resolvedName, crmData);
        res = await waLoadBalancer.sendTemplateMessage(cleanPhone, tmplRows[0].name, tmplRows[0].language || "en", bodyComp ? [bodyComp] : [], sessionKey);
      } else {
        res = await waLoadBalancer.sendTextMessage(cleanPhone, messageText, sessionKey);
      }
    } else {
      res = await waLoadBalancer.sendTextMessage(cleanPhone, messageText, sessionKey);
    }

    console.log(`👋 [WA Welcome] Sent Welcome Auto-Reply to ${cleanPhone} via ${res?.engineUsed || "WA"}`);

    // Log outbound welcome message in DB
    await db.promise().query(
      `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, status, created_at)
       VALUES (?, ?, 'outbound', 'welcome', ?, 'delivered', NOW())`,
      [sessionKey || require("./whatsappService").defaultKey, cleanPhone, messageText]
    ).catch(() => {});

    // Broadcast live message update to CRM Live Chat
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const livePayload = {
          phone: cleanPhone,
          chatId: `${cleanPhone}@c.us`,
          message: {
            id: "welcome_" + Date.now(),
            from: "me",
            body: messageText,
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            type: "text",
          },
        };
        io.emit("wa_message_sent", livePayload);
      }
    } catch (_) {}

    return true;
  } catch (err) {
    console.error(`❌ [WA Welcome] Failed to send Welcome Auto-Reply to ${cleanPhone}:`, err.message);
    return false;
  }
}

async function executeAutomationSend(rule, cleanPhone, contactName, messageText, data) {
  const waLoadBalancer = require("./waLoadBalancer");

  let sentResult = null;
  let sendError = null;
  const chatId = `${cleanPhone}@c.us`;

  try {
    // ── STEP 1: Main Message Send (Template, Rich Media, or Text) ──────────────
    if (rule.template_name) {
      const bodyComponent = buildTemplateBodyComponent(rule.template_body, contactName, data);
      sentResult = await waLoadBalancer.sendTemplateMessage(cleanPhone, rule.template_name, "en", bodyComponent ? [bodyComponent] : []);
    } else if (rule.media_type && rule.media_url) {
      sentResult = await waLoadBalancer.sendMediaMessage(cleanPhone, rule.media_type, rule.media_url, messageText || "", rule.media_filename || "");
    } else {
      sentResult = await waLoadBalancer.sendTextMessage(cleanPhone, messageText);
    }

    // Increment run count
    await db.promise().query(
      "UPDATE wa_automations SET run_count = run_count + 1 WHERE id = ?",
      [rule.id]
    );

    // Log automation execution Step 1
    await db.promise().query(
      `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status)
       VALUES (?, ?, ?, ?, 'sent')`,
      [rule.id, cleanPhone, contactName || null, JSON.stringify({ ...data, step: 1 })]
    );

    // Also auto-add/update wa_contacts table if not present
    await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_contacted)
       VALUES (?, ?, '91', 'Automation Trigger', 1, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), last_contacted=NOW()`,
      [contactName || "Customer", cleanPhone.slice(-10)]
    ).catch(() => {});

    // Emit socket event for real-time live chat updates
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const msgId = sentResult?.result?.id || "sent_" + Date.now();
        const ownerKey = require("./whatsappService").defaultKey;
        const livePayload = {
          phone: cleanPhone,
          chatId,
          sessionKey: ownerKey,
          message: {
            id: msgId,
            from: "me",
            body: messageText,
            timestamp: Math.floor(Date.now() / 1000),
            isMe: true,
            hasMedia: !!(rule.media_type && rule.media_url),
            mediaType: rule.media_type || null,
          },
        };
        io.to(`user:${ownerKey}`).emit("wa_message_sent", livePayload);
        io.emit("wa_message_sent", livePayload);
      }
    } catch (_) {}

    console.log(`✅ [WA Automation] Step 1 sent for rule '${rule.name}' to ${cleanPhone}`);

    // ── STEP 1.5: Auto Contact Group Enrollment (if configured) ─────────────
    if (rule.group_id) {
      try {
        await db.promise().query(
          `INSERT INTO wa_group_contacts (group_id, name, phone, country_code, notes)
           VALUES (?, ?, ?, '91', 'Added via Automation')
           ON DUPLICATE KEY UPDATE name=VALUES(name)`,
          [rule.group_id, contactName || "Customer", cleanPhone.slice(-10)]
        );
        console.log(`👥 [WA Automation] Contact ${cleanPhone} enrolled into Group ${rule.group_id}`);
      } catch (grpErr) {
        console.warn(`[WA Automation] Group enrollment failed:`, grpErr.message);
      }
    }

    // ── STEP 1.6: Auto Trigger Chatbot Flow (if configured) ─────────────────
    if (rule.flow_id) {
      try {
        const [flowRows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ? AND status = 'active' LIMIT 1", [rule.flow_id]);
        if (flowRows.length > 0) {
          const waFlowEngine = require("./waFlowEngine");
          await waFlowEngine.startFlowRun(flowRows[0], cleanPhone);
          console.log(`🤖 [WA Automation] Triggered Chatbot Flow "${flowRows[0].name}" for ${cleanPhone}`);
        }
      } catch (flowErr) {
        console.warn(`[WA Automation] Chatbot flow trigger failed:`, flowErr.message);
      }
    }

    // ── STEP 1.7: Send Interactive Menu Options (if configured) ─────────────
    try {
      const { sendMenu, getOptions } = require("./waMenuHandler");
      const options = await getOptions(rule.id);
      if (options.length) await sendMenu(cleanPhone, rule.id);
    } catch (menuErr) {
      console.error(`[WA Automation] Menu send failed for rule '${rule.name}':`, menuErr.message);
    }

    // ── STEP 2: Multi-Message Sequence with 7-second Gap (Anti-Ban delay) ──
    const hasFollowup = rule.followup_message_text || rule.followup_media_url || rule.followup_template_name || rule.followup_template_id;
    if (hasFollowup) {
      const delaySec = rule.sequence_delay_seconds || 7;
      console.log(`⏱️ [WA Automation] Rule '${rule.name}': Scheduling Step 2 follow-up with ${delaySec}s gap to ${cleanPhone}`);

      setTimeout(async () => {
        try {
          let followupText = "";
          if (rule.followup_message_text) {
            followupText = formatMessagePlaceholders(rule.followup_message_text, contactName, data);
          }

          let step2Result = null;
          if (rule.followup_template_name) {
            const bodyComponent = buildTemplateBodyComponent(rule.followup_template_body, contactName, data);
            step2Result = await waLoadBalancer.sendTemplateMessage(cleanPhone, rule.followup_template_name, "en", bodyComponent ? [bodyComponent] : []);
          } else if (rule.followup_media_type && rule.followup_media_url) {
            step2Result = await waLoadBalancer.sendMediaMessage(cleanPhone, rule.followup_media_type, rule.followup_media_url, followupText || "", rule.followup_media_filename || "");
          } else if (followupText) {
            step2Result = await waLoadBalancer.sendTextMessage(cleanPhone, followupText);
          }

          if (step2Result) {
            console.log(`✅ [WA Automation] Step 2 follow-up sent after ${delaySec}s gap to ${cleanPhone}`);
            await db.promise().query(
              `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status)
               VALUES (?, ?, ?, ?, 'sent')`,
              [rule.id, cleanPhone, contactName || null, JSON.stringify({ ...data, step: 2, sequenceDelaySec: delaySec })]
            );

            // Emit live socket event for Step 2
            try {
              const app = require("../server");
              const io = app.get && app.get("io");
              if (io) {
                const ownerKey = require("./whatsappService").defaultKey;
                const livePayload = {
                  phone: cleanPhone,
                  chatId,
                  sessionKey: ownerKey,
                  message: {
                    id: step2Result?.result?.id || "sent_step2_" + Date.now(),
                    from: "me",
                    body: followupText || (rule.followup_media_url ? "📎 Attachment" : ""),
                    timestamp: Math.floor(Date.now() / 1000),
                    isMe: true,
                    hasMedia: !!(rule.followup_media_type && rule.followup_media_url),
                    mediaType: rule.followup_media_type || null,
                  },
                };
                io.to(`user:${ownerKey}`).emit("wa_message_sent", livePayload);
                io.emit("wa_message_sent", livePayload);
              }
            } catch (_) {}
          }
        } catch (step2Err) {
          console.error(`❌ [WA Automation] Step 2 follow-up failed for ${cleanPhone}:`, step2Err.message);
        }
      }, delaySec * 1000);
    }

  } catch (err) {
    sendError = err.message;
    console.error(`❌ [WA Automation] Failed sending rule '${rule.name}' to ${cleanPhone}:`, sendError);

    await db.promise().query(
      `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, error)
       VALUES (?, ?, ?, ?, 'failed', ?)`,
      [rule.id, cleanPhone, contactName || null, JSON.stringify(data), sendError]
    ).catch(() => {});
  }
}

module.exports = {
  triggerAutomation,
  cleanPhoneNumber,
  formatMessagePlaceholders,
  resolveSpintax,
  buildTemplateBodyComponent,
  lookupCrmDataByPhone,
  getWelcomeSettings,
  updateWelcomeSettings,
  maybeSendWelcomeReply,
  executeAutomationSend,
};
