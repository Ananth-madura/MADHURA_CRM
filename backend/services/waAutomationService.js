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
  const str = String(phone).trim();
  if (str.includes("@g.us") || str.includes("@broadcast") || (str.replace(/\D/g, "").length >= 18 && str.replace(/\D/g, "").startsWith("120363"))) {
    return null;
  }
  let clean = str.replace(/\D/g, "");
  if (clean.length === 10) clean = "91" + clean;
  return clean.length >= 10 ? clean : null;
}

// Looks up a contact's real CRM record by phone so template/message
// placeholders can be filled with actual deep data across all modules
async function lookupCrmDataByPhone(phone) {
  const last10 = (phone || "").replace(/\D/g, "").slice(-10);
  const digitsOnly = (phone || "").replace(/\D/g, "");
  if (last10.length < 10) return {};

  const profile = {};

  const sources = [
    ["clients", "name", "company_name", "city", "address", "email", "phone"],
    ["telecalls", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "service", "assigned_to", "remarks"],
    ["walkins", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "purpose", "assigned_to"],
    ["fields", "customer_name", "company_name", "location_city", "address", "email", "mobile_number", "service", "assigned_to"],
    ["wa_contacts", "name", "company", "city", "address", "email", "phone", "service", "assigned_agent_name", "notes"],
  ];

  for (const [table, nameCol, companyCol, cityCol, addressCol, emailCol, phoneCol, serviceCol, agentCol, notesCol] of sources) {
    try {
      const selectFields = [
        nameCol ? `${nameCol} AS name` : null,
        companyCol ? `${companyCol} AS company` : null,
        cityCol ? `${cityCol} AS city` : null,
        addressCol ? `${addressCol} AS address` : null,
        emailCol ? `${emailCol} AS email` : null,
        serviceCol ? `${serviceCol} AS service` : null,
        agentCol ? `${agentCol} AS assigned_agent` : null,
        notesCol ? `${notesCol} AS notes` : null,
      ].filter(Boolean).join(", ");

      const [rows] = await db.promise().query(
        `SELECT ${selectFields} FROM ${table} WHERE ${phoneCol} LIKE ? OR ${phoneCol} LIKE ? LIMIT 1`,
        [`%${last10}`, `%${digitsOnly}`]
      );
      if (rows && rows[0]) {
        Object.assign(profile, rows[0]);
        break;
      }
    } catch (_) {}
  }

  // Also query latest invoice & contract if client company or name exists
  const lookupName = profile.company || profile.name;
  if (lookupName) {
    try {
      const [invRows] = await db.promise().query(
        `SELECT invoice_no, total_amount, due_date, status 
         FROM clientinvoices 
         WHERE client_company = ? OR customer_name = ? 
         ORDER BY id DESC LIMIT 1`,
        [lookupName, lookupName]
      );
      if (invRows && invRows[0]) {
        profile.invoice_no = invRows[0].invoice_no;
        profile.invoice_amount = invRows[0].total_amount;
        profile.amount = invRows[0].total_amount;
        profile.due_date = invRows[0].due_date;
        profile.invoice_status = invRows[0].status;
      }
    } catch (_) {}

    try {
      const [amcRows] = await db.promise().query(
        `SELECT contract_title, total_amount, start_date, end_date, status 
         FROM contracts 
         WHERE client_company = ? 
         ORDER BY id DESC LIMIT 1`,
        [lookupName]
      );
      if (amcRows && amcRows[0]) {
        profile.contract_title = amcRows[0].contract_title;
        profile.amc_plan = amcRows[0].contract_title;
        profile.amc_expiry = amcRows[0].end_date;
      }
    } catch (_) {}
  }

  return profile;
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
  if (injectMicroJitter && result.length > 0) {
    const zwChars = ["\u200B", "\u200C", "\u200D", "\uFEFF"];
    const randomZw = zwChars[Math.floor(Math.random() * zwChars.length)];
    result = result + randomZw;
  }

  return result;
}

// Substitutes multi-dynamic {{placeholder}} and {placeholder} tokens in a message
function formatMessagePlaceholders(templateText, contactName, data = {}) {
  let msg = templateText || "Hello {{name}}!";
  const rawName = contactName || data.name || data.customer_name || data.client_name || data.company_name || data.company || "Customer";
  const nameParts = (rawName || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const now = new Date();
  const currentHour = now.getHours();
  let greetingTime = "Hello";
  if (currentHour < 12) greetingTime = "Good morning";
  else if (currentHour < 17) greetingTime = "Good afternoon";
  else greetingTime = "Good evening";

  const dateOptions = { day: "2-digit", month: "short", year: "numeric" };
  const formattedDate = now.toLocaleDateString("en-IN", dateOptions);
  const formattedTime = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dayName = now.toLocaleDateString("en-IN", { weekday: "long" });

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormatted = tomorrow.toLocaleDateString("en-IN", dateOptions);

  const amountVal = data.amount || data.total_amount || data.invoice_amount || data.balance || "";
  const formattedAmount = amountVal ? (String(amountVal).startsWith("₹") ? String(amountVal) : `₹${amountVal}`) : "";

  const known = {
    // 👤 Contact Person & Customer
    name: rawName,
    first_name: firstName,
    firstname: firstName,
    last_name: lastName,
    lastname: lastName,
    customer_name: rawName,
    client_name: rawName,
    "customer.name": rawName,
    "customer.first_name": firstName,
    "customer.phone": data.phone || data.mobile || "",
    "customer.email": data.email || data.email_id || "",
    "customer.city": data.city || data.location_city || "our city",
    "customer.company": data.company || data.company_name || data.business_name || "Madhura Tech",
    
    // 🏢 Business & Company
    company: data.company || data.company_name || data.business_name || "Madhura Tech",
    company_name: data.company || data.company_name || data.business_name || "Madhura Tech",
    brand_name: "Madhura Tech",
    sender_company: "Madhura Tech",
    my_company: "Madhura Tech",

    // 📞 Phone & Email
    phone: data.phone || data.mobile || data.mobile_number || "",
    mobile: data.phone || data.mobile || data.mobile_number || "",
    email: data.email || data.email_id || "",

    // 📍 Location & Address
    address: data.address || data.street_address || data.city || data.location_city || "our office",
    street_address: data.address || data.street_address || "",
    city: data.city || data.location_city || "our city",
    location: data.location || data.address || data.city || "",
    location_city: data.city || data.location_city || "our city",
    state: data.state || "",
    pincode: data.pincode || data.zip || "",

    // 💼 Service & Offerings
    service: data.service || data.product || data.service_name || "AMC & Services",
    service_name: data.service || data.product || "AMC & Services",
    product: data.product || data.service || "Solutions",
    purpose: data.purpose || data.remarks || data.notes || "",
    notes: data.notes || data.remarks || "",
    assigned_agent: data.assigned_agent || data.agent_name || data.assigned_to || "Support Executive",
    agent_name: data.assigned_agent || data.agent_name || data.assigned_to || "Support Executive",
    "agent.name": data.assigned_agent || data.agent_name || data.assigned_to || "Support Executive",

    // 🧾 Invoicing & Payments
    invoice_no: data.invoice_no || data.invoice_number || data.bill_no || "",
    invoice_number: data.invoice_no || data.invoice_number || "",
    amount: formattedAmount,
    total_amount: formattedAmount,
    invoice_amount: formattedAmount,
    balance: formattedAmount,
    due_date: data.due_date ? String(data.due_date).split("T")[0] : "",
    invoice_status: data.invoice_status || "Pending",
    contract_title: data.contract_title || data.amc_plan || "",
    amc_plan: data.amc_plan || data.contract_title || "",
    amc_expiry: data.amc_expiry || "",

    // ⏰ Dynamic Time & Date
    greeting_time: greetingTime,
    time: formattedTime,
    current_time: formattedTime,
    date: formattedDate,
    current_date: formattedDate,
    "current.date": formattedDate,
    today: formattedDate,
    day: dayName,
    day_of_week: dayName,
    tomorrow_date: tomorrowFormatted,
    year: String(now.getFullYear()),
    month: now.toLocaleDateString("en-IN", { month: "long" }),
    start_time: data.start_time || "09:00 AM",
    end_time: data.end_time || "08:00 PM",

    // 💬 Conversation & State Variables
    "conversation.id": data.conversation_id || data.conversationId || data.run_id || "",
    "selected.option": data.selected_option || data.selectedOption || data.last_input || "",
    "last.message": data.last_message || data.last_input || data.input || "",
    selected_option: data.selected_option || data.selectedOption || "",
    last_input: data.last_input || data.input || "",

    // 🏷️ Custom Fields
    custom_1: data.custom_1 || "",
    custom_2: data.custom_2 || "",
    custom_3: data.custom_3 || "",
    custom_4: data.custom_4 || "",
    custom_5: data.custom_5 || "",
  };

  const dataLookup = {};
  for (const key of Object.keys(data)) {
    dataLookup[key.toLowerCase()] = data[key];
    dataLookup[key.toLowerCase().replace(/_/g, ".")] = data[key];
  }

  // 1. Resolve {{placeholder}} and {placeholder} tokens (case-insensitive & whitespace-tolerant)
  let resolved = msg.replace(/\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}/g, (match, rawToken) => {
    const rawLower = rawToken.toLowerCase().trim();
    const dotNormalized = rawLower.replace(/_/g, ".");
    const underscoreNormalized = rawLower.replace(/\./g, "_");

    // Exact match in known
    if (Object.prototype.hasOwnProperty.call(known, rawLower) && known[rawLower] !== "") {
      return String(known[rawLower]);
    }
    if (Object.prototype.hasOwnProperty.call(known, dotNormalized) && known[dotNormalized] !== "") {
      return String(known[dotNormalized]);
    }
    if (Object.prototype.hasOwnProperty.call(known, underscoreNormalized) && known[underscoreNormalized] !== "") {
      return String(known[underscoreNormalized]);
    }

    // Direct lookup in dataLookup
    if (Object.prototype.hasOwnProperty.call(dataLookup, rawLower) && dataLookup[rawLower] != null && dataLookup[rawLower] !== "") {
      return String(dataLookup[rawLower]);
    }
    if (Object.prototype.hasOwnProperty.call(dataLookup, dotNormalized) && dataLookup[dotNormalized] != null && dataLookup[dotNormalized] !== "") {
      return String(dataLookup[dotNormalized]);
    }
    if (Object.prototype.hasOwnProperty.call(dataLookup, underscoreNormalized) && dataLookup[underscoreNormalized] != null && dataLookup[underscoreNormalized] !== "") {
      return String(dataLookup[underscoreNormalized]);
    }

    // Deep dot path in data (e.g. data.customer.name)
    if (rawToken.includes(".")) {
      const parts = rawToken.split(".");
      let val = data;
      for (const p of parts) {
        if (val && typeof val === "object" && Object.prototype.hasOwnProperty.call(val, p)) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }
      if (val != null && val !== "") return String(val);

      // Fallback: match last part of dot path (e.g., customer.name -> name)
      const lastPart = parts[parts.length - 1].toLowerCase();
      if (Object.prototype.hasOwnProperty.call(known, lastPart) && known[lastPart] !== "") {
        return String(known[lastPart]);
      }
      if (Object.prototype.hasOwnProperty.call(dataLookup, lastPart) && dataLookup[lastPart] != null && dataLookup[lastPart] !== "") {
        return String(dataLookup[lastPart]);
      }
    }

    return match; // Unknown variable — leave as-is
  });

  // 2. Resolve Spintax dynamic text choices [Option 1|Option 2] and {Option 1|Option 2}
  return resolveSpintax(resolved);
}

function buildTemplateBodyComponent(templateBody, contactName, data = {}) {
  if (!templateBody) return null;
  const tokens = [...templateBody.matchAll(/\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}/g)].map((m) => m[1]);
  if (!tokens.length) return null;
  return {
    type: "body",
    parameters: tokens.map((t) => ({ type: "text", text: formatMessagePlaceholders(`{{${t}}}`, contactName, data) })),
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
    // 1. Check if phone is opted out or blocked.
    // Opt-outs are recorded from several paths with different phone formats
    // ("9876543210" vs "919876543210"), so this MUST match on the last 10 digits
    // like the campaign engine does — an exact match let opted-out people keep
    // receiving automated messages.
    const [optOuts] = await db.promise().query(
      "SELECT id FROM wa_opt_outs WHERE phone = ? OR phone LIKE ? LIMIT 1",
      [cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (optOuts.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: user opted out`);
      return { success: false, reason: "opted_out" };
    }

    // is_unsubscribed matters as much as is_blocked — the opt-out writers set
    // is_unsubscribed, so checking only is_blocked missed every unsubscribe.
    const [blocked] = await db.promise().query(
      "SELECT id FROM wa_contacts WHERE (phone = ? OR phone LIKE ?) AND (is_blocked = 1 OR is_unsubscribed = 1) LIMIT 1",
      [cleanPhone, `%${cleanPhone.slice(-10)}`]
    );
    if (blocked.length > 0) {
      console.log(`[WA Automation] Skipped '${triggerType}' for ${cleanPhone}: contact blocked or unsubscribed`);
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
        // Persist the intent FIRST so a restart can't lose it, and log it as
        // 'scheduled' rather than 'sent' — the old code claimed success before
        // the message had even been attempted.
        const [ins] = await db.promise().query(
          `INSERT INTO wa_automation_logs (automation_id, phone, contact_name, trigger_data, status, scheduled_for)
           VALUES (?, ?, ?, ?, 'scheduled', DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
          [
            rule.id,
            cleanPhone,
            resolvedName,
            JSON.stringify({ triggerType, scheduledDelay: rule.delay_minutes, messageText, ...mergedData }),
            rule.delay_minutes,
          ]
        );
        const logId = ins.insertId;

        // Fast path: fire in-process so short delays stay punctual. The claim
        // below makes this safe against the sweeper picking up the same row.
        setTimeout(() => {
          runScheduledAutomation(logId, rule, cleanPhone, resolvedName, messageText, mergedData).catch(() => {});
        }, rule.delay_minutes * 60 * 1000);
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

/**
 * Run one scheduled automation exactly once.
 * The row is claimed atomically, so the in-process timer and the restart
 * sweeper can both point at the same log row without double-sending.
 */
async function runScheduledAutomation(logId, rule, cleanPhone, contactName, messageText, data) {
  const [claim] = await db.promise().query(
    "UPDATE wa_automation_logs SET status = 'sending' WHERE id = ? AND status = 'scheduled'",
    [logId]
  );
  if (!claim.affectedRows) return false; // already handled elsewhere

  try {
    await executeAutomationSend(rule, cleanPhone, contactName, messageText, data);
    await db.promise().query("UPDATE wa_automation_logs SET status = 'sent' WHERE id = ?", [logId]);
    return true;
  } catch (err) {
    await db.promise().query(
      "UPDATE wa_automation_logs SET status = 'failed', error = ? WHERE id = ?",
      [String(err.message || err).slice(0, 500), logId]
    ).catch(() => {});
    return false;
  }
}

/**
 * Sweeper for delayed automations whose in-process timer never fired
 * (server restart / crash). Without this every delayed rule was lost silently.
 */
async function runDueAutomationsSweep() {
  try {
    const [due] = await db.promise().query(
      `SELECT l.*, a.*, l.id AS log_id, a.id AS rule_id,
              t.name AS template_name, t.body AS template_body,
              ft.name AS followup_template_name, ft.body AS followup_template_body
       FROM wa_automation_logs l
       JOIN wa_automations a ON l.automation_id = a.id
       LEFT JOIN wa_templates t ON a.template_id = t.id
       LEFT JOIN wa_templates ft ON a.followup_template_id = ft.id
       WHERE l.status = 'scheduled' AND l.scheduled_for IS NOT NULL AND l.scheduled_for <= NOW()
         AND a.is_active = 1
       ORDER BY l.scheduled_for ASC LIMIT 50`
    );
    if (!due.length) return 0;

    console.log(`⏰ [WA Automation] Recovering ${due.length} delayed automation(s) whose timer was lost`);
    let ran = 0;
    for (const row of due) {
      let payload = {};
      try {
        payload = typeof row.trigger_data === "string" ? JSON.parse(row.trigger_data) : (row.trigger_data || {});
      } catch (_) {}

      const rule = { ...row, id: row.rule_id };
      const messageText = payload.messageText
        || formatMessagePlaceholders(rule.message_text || rule.template_body || "Hello {name}!", row.contact_name, payload);

      const ok = await runScheduledAutomation(row.log_id, rule, row.phone, row.contact_name, messageText, payload);
      if (ok) ran++;
    }
    return ran;
  } catch (err) {
    console.error("[WA Automation] Delayed-automation sweep error:", err.message);
    return 0;
  }
}

let sweepTimer = null;
function startAutomationScheduler(intervalMs = 60 * 1000) {
  if (sweepTimer) return;
  // One catch-up pass at boot, then every minute
  runDueAutomationsSweep().catch(() => {});
  sweepTimer = setInterval(() => runDueAutomationsSweep().catch(() => {}), intervalMs);
  if (sweepTimer.unref) sweepTimer.unref();
  console.log("✅ Delayed WhatsApp Automation scheduler started (restart-safe)");
}

async function getWelcomeSettings() {
  try {
    const [rows] = await db.promise().query("SELECT * FROM wa_welcome_settings WHERE id = 1");
    if (!rows.length) {
      return {
        enabled: false,
        welcome_type: "text",
        welcome_text: "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
        template_id: null,
        cooldown_hours: 24,
        working_hours_only: false,
        start_time: "09:00",
        end_time: "21:00",
      };
    }
    return {
      enabled: Boolean(rows[0].enabled),
      welcome_type: rows[0].welcome_type || "text",
      welcome_text: rows[0].welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
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
      welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?",
      template_id || null,
      parseInt(cooldown_hours != null ? cooldown_hours : 24, 10),
      working_hours_only ? 1 : 0,
      start_time || "09:00",
      end_time || "21:00",
    ]
  );
  return getWelcomeSettings();
}

async function maybeSendWelcomeReply(targetPhoneOrJid, contactName, sessionKey) {
  if (!targetPhoneOrJid) return false;
  const rawTarget = String(targetPhoneOrJid).trim();
  if (rawTarget.includes("@g.us") || rawTarget.includes("@broadcast") || rawTarget.startsWith("status@")) {
    return false; // Skip groups, broadcast lists, and status updates
  }

  const cleanPhone = cleanPhoneNumber(rawTarget) || rawTarget.replace(/\D/g, "");
  if (!cleanPhone && !rawTarget.includes("@")) return false;

  const settings = await getWelcomeSettings();
  if (!settings.enabled) return false; // Safe default: strictly requires user to enable it

  // 1. Check working hours if enabled
  if (settings.working_hours_only && settings.start_time && settings.end_time) {
    try {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, "0");
      const currentMinutes = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHours}:${currentMinutes}`;
      if (currentTime < settings.start_time || currentTime > settings.end_time) {
        console.log(`⏰ [WA Welcome] Outside working hours (${currentTime} not in ${settings.start_time}-${settings.end_time}) for ${cleanPhone}`);
        return false;
      }
    } catch (_) {}
  }

  // 2. Check cooldown / deduplication: One-time welcome reply per contact
  const cooldownHours = parseInt(settings.cooldown_hours != null ? settings.cooldown_hours : 24, 10);
  try {
    const timeClause = cooldownHours > 0 ? "AND created_at >= NOW() - INTERVAL ? HOUR" : "";
    const autoTimeClause = cooldownHours > 0 ? "AND sent_at >= NOW() - INTERVAL ? HOUR" : "";
    const params = cooldownHours > 0
      ? [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`, cooldownHours]
      : [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`];

    const [recentWelcomeLogs] = await db.promise().query(
      `SELECT id FROM wa_message_logs
       WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'outbound'
         AND (message_type = 'welcome' OR message_text LIKE '%Welcome%' OR message_text LIKE '%Thank you for reaching out%')
         ${timeClause}
       LIMIT 1`,
      params
    );

    const [recentAutoLogs] = await db.promise().query(
      `SELECT id FROM wa_automation_logs
       WHERE (phone LIKE ? OR phone LIKE ?)
         ${autoTimeClause}
       LIMIT 1`,
      params
    );

    if (recentWelcomeLogs.length > 0 || recentAutoLogs.length > 0) {
      console.log(`⏳ [WA Welcome] Welcome already sent previously to ${cleanPhone} (cooldown: ${cooldownHours}h)`);
      return false;
    }
  } catch (e) {
    console.error("[WA Welcome] Cooldown check error:", e.message);
  }

  // 3. Resolve CRM Contact Info
  const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
  const resolvedName = contactName || crmData.name || crmData.customer_name || "Valued Customer";

  // 4. Default fallback to wa_welcome_settings
  const rawWelcome = settings.welcome_text || "Hello {name}! Welcome to Madhura Tech. Thank you for reaching out to us. How can we help you today?";
  const messageText = formatMessagePlaceholders(rawWelcome, resolvedName, crmData);

  const waLoadBalancer = require("./waLoadBalancer");
  try {
    let res;
    if (settings.welcome_type === "template" && settings.template_id) {
      const [tmplRows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ? LIMIT 1", [settings.template_id]);
      if (tmplRows.length > 0) {
        const bodyComp = buildTemplateBodyComponent(tmplRows[0].body, resolvedName, crmData);
        res = await waLoadBalancer.sendTemplateMessage(rawTarget, tmplRows[0].name, tmplRows[0].language || "en", bodyComp ? [bodyComp] : [], sessionKey);
      } else {
        res = await waLoadBalancer.sendTextMessage(rawTarget, messageText, sessionKey);
      }
    } else {
      res = await waLoadBalancer.sendTextMessage(rawTarget, messageText, sessionKey);
    }

    console.log(`👋 [WA Welcome] Sent Welcome Auto-Reply to ${rawTarget} via ${res?.engineUsed || "WA"}`);

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
          chatId: rawTarget.includes("@") ? rawTarget : `${cleanPhone}@c.us`,
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
    console.error(`❌ [WA Welcome] Failed to send Welcome Auto-Reply to ${rawTarget}:`, err.message);
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
  runDueAutomationsSweep,
  startAutomationScheduler,
};
