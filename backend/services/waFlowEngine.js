const axios = require("axios");
const db = require("../config/database");

/**
 * WhatsApp Conversational Flow State-Machine Engine
 * Manages multi-turn chatbot flows, dynamic CRM lookups, API webhooks,
 * AI intent routing, input capture, universal 24/7 triggers, interactive buttons,
 * branching, and human handoff.
 */

class WaFlowEngine {
  /**
   * Helper: Escape regex special characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Read a flow's configured trigger keywords (tolerates the legacy single
   * `keyword` field and a JSON-string trigger_config).
   */
  getTriggerKeywords(flow) {
    let cfg = {};
    try {
      cfg = typeof flow?.trigger_config === "string"
        ? JSON.parse(flow.trigger_config)
        : (flow?.trigger_config || {});
    } catch (_) {}
    const kws = cfg.keywords || (cfg.keyword ? [cfg.keyword] : []);
    return Array.isArray(kws) ? kws.map((k) => String(k || "").toLowerCase().trim()).filter(Boolean) : [];
  }

  /**
   * Does this inbound message fire the flow's keyword trigger?
   * Single source of truth — starting a flow from idle and switching flows
   * mid-conversation previously used two different, silently inconsistent rule
   * sets, so a phrase like "invoice status please" would start the invoice flow
   * when idle but not switch to it mid-chat.
   *
   * strict = true is used for mid-conversation switching: only a deliberate,
   * command-like message may hijack a running flow, otherwise a passing mention
   * inside an answer ("the AC broke, and my invoice is wrong") would discard
   * everything the customer already typed.
   */
  matchesTriggerKeywords(rawText, flow, { strict = false } = {}) {
    const raw = String(rawText || "").trim();
    const lower = raw.toLowerCase();
    if (!lower) return false;

    const keywords = this.getTriggerKeywords(flow);
    if (!keywords.length) return false;

    return keywords.some((kw) => {
      // Exact match
      if (lower === kw) return true;
      // Keyword followed by a separator: "invoice, please" / "invoice!" / "menu?"
      if (lower.startsWith(kw) && /^[\s,.!?:;-]/.test(lower.slice(kw.length))) return true;
      if (strict) return false;

      // Whole-word mention anywhere in the sentence
      try {
        if (new RegExp(`\\b${this.escapeRegex(kw)}\\b`, "i").test(raw)) return true;
      } catch (_) {}
      // Loose containment for longer keywords. Both sides need >= 3 chars,
      // otherwise a 1-2 letter reply ("in", "a") triggers any flow containing it.
      if (kw.length >= 3 && lower.includes(kw)) return true;
      if (kw.length >= 3 && lower.length >= 3 && kw.includes(lower)) return true;
      return false;
    });
  }

  /**
   * Normalize a flow media reference.
   * - Resolves relative/uploaded paths ("/uploads/wa-media/x.pdf") to an absolute
   *   public URL so both WhatsApp Web and Meta Cloud API can fetch the file.
   * - Infers the WhatsApp media type (image | video | audio | document) from the
   *   file extension so a mislabelled node still delivers.
   * Returns null when there is nothing sendable.
   */
  resolveMedia(rawUrl, declaredType = "", declaredFilename = "") {
    const url = String(rawUrl || "").trim();
    if (!url) return null;

    let absolute = url;
    if (!/^https?:\/\//i.test(absolute)) {
      const base = String(
        process.env.PUBLIC_BASE_URL || process.env.REACT_APP_API_URL || ""
      ).replace(/\/+$/, "");
      if (!base) return null; // relative path with no public base — WhatsApp could never fetch it
      absolute = `${base}/${absolute.replace(/^\/+/, "")}`;
    }

    const path = absolute.split("?")[0];
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
    const BY_EXT = {
      jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
      mp4: "video", mov: "video", "3gp": "video", mkv: "video",
      mp3: "audio", ogg: "audio", wav: "audio", m4a: "audio", aac: "audio",
    };

    let type = String(declaredType || "").toLowerCase();
    if (["pdf", "doc", "docx", "xls", "xlsx", "csv", "excel", "txt", "ppt", "pptx", "file"].includes(type)) {
      type = "document";
    }
    if (!["image", "video", "audio", "document"].includes(type)) {
      type = BY_EXT[ext] || "document";
    } else if (type !== "document") {
      // An explicit "document" is always honoured; other types must match the real file
      type = BY_EXT[ext] || "document";
    }

    const filename =
      declaredFilename || decodeURIComponent(path.split("/").pop() || "attachment");

    return { url: absolute, type, filename };
  }

  /**
   * Record outbound bot message in database & broadcast live WebSocket event to CRM chat
   */
  async recordAndEmitBotMessage(phone, text, type = "text", interactivePayload = null) {
    const cleanPhone = phone.replace(/\D/g, "");
    const chatId = `${cleanPhone}@c.us`;
    const msgId = "bot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    // 1. Insert DB log for audit & live chat history
    await db.promise().query(
      `INSERT INTO wa_message_logs (phone, direction, message_type, message_text, wa_message_id, status, interactive_payload, created_at)
       VALUES (?, 'outbound', ?, ?, ?, 'delivered', ?, NOW())`,
      [cleanPhone, type, text, msgId, interactivePayload ? JSON.stringify(interactivePayload) : null]
    ).catch(() => {});

    // 2. Update wa_contacts last_message
    await db.promise().query(
      `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
       VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), 0)
       ON DUPLICATE KEY UPDATE
         last_message_text = VALUES(last_message_text),
         last_message_at = NOW()`,
      ["Customer", cleanPhone, text]
    ).catch(() => {});

    // 3. Emit real-time Socket event (< 1ms) to update CRM Live Chat
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        const liveMsg = {
          id: msgId,
          from: "me",
          to: cleanPhone,
          body: text,
          timestamp: Math.floor(Date.now() / 1000),
          isMe: true,
          type: type,
          status: "delivered",
          interactive: interactivePayload,
        };
        io.emit("wa_message_sent", { phone: cleanPhone, chatId, message: liveMsg });
        io.emit("wa_message", { phone: cleanPhone, chatId, message: liveMsg });
      }
    } catch (_) {}
  }

  /**
   * Dispatch inbound message to any active flow run or trigger a new flow.
   * Returns true if message was consumed by a flow, false otherwise.
   */
  async dispatchInbound(phone, messageText, interactiveReplyId = null, sessionKey = null, inboundMedia = null) {
    if (!phone) return false;
    const cleanPhone = phone.replace(/\D/g, "");

    try {
      // 1. Check for an active flow run for this phone
      const [activeRuns] = await db.promise().query(
        `SELECT r.*, f.fallback_policy, f.name as flow_name, f.trigger_type, f.trigger_config, f.entry_node_key
         FROM wa_flow_runs r
         JOIN wa_flows f ON r.flow_id = f.id
         WHERE r.phone LIKE ? AND r.status = 'active'
         ORDER BY r.id DESC LIMIT 1`,
        [`%${cleanPhone.slice(-10)}`]
      );

      // Check if run is stale (> 4 hours since last activity)
      let isStale = false;
      if (activeRuns && activeRuns.length > 0) {
        const run = activeRuns[0];
        const lastActive = new Date(run.last_advanced_at || run.started_at).getTime();
        if (Date.now() - lastActive > 4 * 60 * 60 * 1000) {
          isStale = true;
        }
      }

      // If active run exists and is fresh (and not an explicit new keyword trigger), advance it
      if (activeRuns && activeRuns.length > 0 && !isStale) {
        const run = activeRuns[0];

        // Check if customer typed a keyword explicitly for a DIFFERENT active flow
        const [otherFlows] = await db.promise().query(
          "SELECT * FROM wa_flows WHERE status = 'active' AND id != ? ORDER BY id DESC",
          [run.flow_id]
        );

        let switchedFlow = null;
        for (const f of otherFlows) {
          if (f.trigger_type === "keyword" || !f.trigger_type) {
            // strict: only a deliberate command may abandon a running flow
            if (this.matchesTriggerKeywords(messageText, f, { strict: true })) {
              switchedFlow = f;
              break;
            }
          }
        }

        if (switchedFlow) {
          console.log(`🔀 Customer switched from Flow #${run.flow_id} to Flow "${switchedFlow.name}" (#${switchedFlow.id})`);
          await this.completeRun(run.id, `switched_to_flow_${switchedFlow.id}`);
          return await this.startFlowRun(switchedFlow, cleanPhone, sessionKey, messageText);
        }

        return await this.advanceActiveRun(run, messageText, interactiveReplyId, sessionKey, inboundMedia);
      }

      // If stale run was open, mark as timed out before triggering fresh flow
      if (activeRuns && activeRuns.length > 0 && isStale) {
        await db.promise().query(
          "UPDATE wa_flow_runs SET status = 'timed_out', ended_at = NOW(), end_reason = 'inactivity_timeout' WHERE id = ?",
          [activeRuns[0].id]
        );
      }

      // 2. No active run (or reset) — check trigger rules across all active flows
      const [activeFlows] = await db.promise().query(
        "SELECT * FROM wa_flows WHERE status = 'active' ORDER BY id DESC"
      );

      if (!activeFlows || activeFlows.length === 0) {
        return false;
      }

      // Priority 1: Keyword Match Flows
      for (const flow of activeFlows) {
        if (flow.trigger_type === "keyword" || !flow.trigger_type) {
          if (this.matchesTriggerKeywords(messageText, flow)) {
            console.log(`🤖 Triggering Keyword WhatsApp Flow "${flow.name}" (ID: ${flow.id}) for +${cleanPhone}`);
            return await this.startFlowRun(flow, cleanPhone, sessionKey, messageText);
          }
        }
      }

      // Priority 2: First Inbound / Welcome Bot (triggers when customer has no prior inbound history or new conversation)
      for (const flow of activeFlows) {
        const isWelcomeTrigger = ["first_inbound", "welcome", "welcome_bot", "first_message"].includes(flow.trigger_type);
        if (isWelcomeTrigger) {
          try {
            const [[{ count }]] = await db.promise().query(
              "SELECT COUNT(*) as count FROM wa_message_logs WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'",
              [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`]
            );
            // Also check if there has been no inbound message in the last 24 hours (new session)
            const [recentInbounds] = await db.promise().query(
              `SELECT id FROM wa_message_logs
               WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'
                 AND created_at < NOW() - INTERVAL 1 MINUTE
                 AND created_at >= NOW() - INTERVAL 24 HOUR
               LIMIT 1`,
              [`%${cleanPhone.slice(-10)}`, `%${cleanPhone}`]
            );

            if (count <= 1 || recentInbounds.length === 0) {
              console.log(`👋 Triggering First-Inbound/Welcome Flow "${flow.name}" (ID: ${flow.id}) for +${cleanPhone}`);
              return await this.startFlowRun(flow, cleanPhone, sessionKey, messageText);
            }
          } catch (e) {
            console.warn("First-inbound check error:", e.message);
          }
        }
      }

      // Priority 3: Universal 24/7 Bot (Triggers for ALL Inbound Messages as Default / No-Keyword Fallback)
      for (const flow of activeFlows) {
        const isUniversalTrigger = ["all_inbound", "universal", "default", "fallback", "no_keyword", "catch_all"].includes(flow.trigger_type);
        if (isUniversalTrigger) {
          console.log(`🌐 Triggering Universal 24/7 WhatsApp Flow "${flow.name}" (ID: ${flow.id}) for +${cleanPhone}`);
          return await this.startFlowRun(flow, cleanPhone, sessionKey, messageText);
        }
      }

      // Priority 4: AI Intent Classifier
      for (const flow of activeFlows) {
        if (flow.trigger_type === "ai_intent") {
          console.log(`🧠 Triggering AI Intent Flow "${flow.name}" (ID: ${flow.id}) for +${cleanPhone}`);
          return await this.startFlowRun(flow, cleanPhone, sessionKey, messageText);
        }
      }

      return false;
    } catch (err) {
      console.error("waFlowEngine dispatch error:", err.message);
      return false;
    }
  }

  /**
   * Start a brand new flow execution for a phone number
   */
  async startFlowRun(flow, cleanPhone, sessionKey = null, triggerText = "") {
    const entryNodeKey = flow.entry_node_key || "start";

    // Close any previous active runs for this phone
    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'completed', end_reason = 'new_flow_started', ended_at = NOW() WHERE phone LIKE ? AND status = 'active'",
      [`%${cleanPhone.slice(-10)}`]
    );

    // Deep CRM Context auto-resolution from database
    const initialVars = await this.resolveInitialCrmVars(cleanPhone);

    // The message that triggered the flow is the AI nodes' input — without it,
    // an ai_generate / ai_intent step placed before any collect_input sees nothing.
    const trimmedTrigger = String(triggerText || "").trim();
    if (trimmedTrigger) {
      initialVars.last_input = trimmedTrigger;
      initialVars.input = trimmedTrigger;
      initialVars.trigger_message = trimmedTrigger;
    }

    const [runRes] = await db.promise().query(
      `INSERT INTO wa_flow_runs (flow_id, phone, status, current_node_key, vars, reprompt_count, started_at)
       VALUES (?, ?, 'active', ?, ?, 0, NOW())`,
      [flow.id, cleanPhone, entryNodeKey, JSON.stringify(initialVars)]
    );
    const runId = runRes.insertId;

    // Increment execution count
    await db.promise().query(
      "UPDATE wa_flows SET execution_count = execution_count + 1 WHERE id = ?",
      [flow.id]
    );

    await this.logEvent(runId, entryNodeKey, "flow_started", { flowName: flow.name, initialVars });

    // Execute the entry node with resolved CRM variables
    return await this.executeNodeChain(runId, flow.id, cleanPhone, entryNodeKey, initialVars, sessionKey);
  }

  /**
   * Advance an active flow run with customer reply
   */
  async advanceActiveRun(run, messageText, interactiveReplyId, sessionKey = null, inboundMedia = null) {
    const runId = run.id;
    const cleanPhone = run.phone;
    const rawTrimmed = (messageText || "").trim();
    const lowerText = rawTrimmed.toLowerCase();

    let vars = {};
    try {
      vars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {});
    } catch (_) {}

    // Every inbound reply — typed text OR a tapped option — becomes the input that
    // ai_generate / ai_intent steps read. Without this only collect_input fed them.
    if (rawTrimmed) vars.last_input = rawTrimmed;

    // Global Command: Live Agent Transfer
    if (["agent", "human", "support", "talk to human", "representative", "person", "help desk", "live support", "executive"].includes(lowerText)) {
      await this.sendFlowMessage(cleanPhone, "👤 Transferring you to our support specialist now. Please stay online.", sessionKey);
      await db.promise().query(
        "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'user_agent_command' WHERE id = ?",
        [runId]
      );
      // Mute AI auto-reply for 2 hours
      await db.promise().query(
        "UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 120 MINUTE) WHERE phone LIKE ?",
        [`%${cleanPhone.slice(-10)}`]
      );
      try {
        const app = require("../server");
        const io = app.get && app.get("io");
        if (io) io.emit("wa_agent_handoff", { phone: cleanPhone, flowId: run.flow_id, note: "Customer typed 'agent'", vars });
      } catch (_) {}
      return true;
    }

    // Global Command: Jump to Main Menu / Restart Flow
    if (["menu", "main menu", "start", "restart", "home"].includes(lowerText)) {
      const entryNode = run.entry_node_key || "start";
      await db.promise().query(
        "UPDATE wa_flow_runs SET current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
        [entryNode, runId]
      );
      return await this.executeNodeChain(runId, run.flow_id, cleanPhone, entryNode, vars, sessionKey);
    }

    // Load current node
    const [nodes] = await db.promise().query(
      "SELECT * FROM wa_flow_nodes WHERE flow_id = ? AND node_key = ? LIMIT 1",
      [run.flow_id, run.current_node_key]
    );
    const currentNode = nodes[0];
    if (!currentNode) {
      await this.completeRun(runId, "current_node_missing");
      return false;
    }

    let config = {};
    try {
      config = typeof currentNode.config === "string" ? JSON.parse(currentNode.config) : (currentNode.config || {});
    } catch (_) {}

    let nextNodeKey = null;

    if (currentNode.node_type === "collect_input") {
      const varKey = config.var_key || "input";
      const inputVal = (messageText || "").trim();
      const validationType = config.validation_type || "none";
      const strictValidation = (validationType !== "none" && validationType !== "") || !!config.regex;
      // Attachments answer free-text questions by default. A validated question
      // (email / phone / number / regex) rejects them unless explicitly opted in,
      // so a photo can never satisfy "what is your email?".
      const mediaAllowed = config.accept_media === true || (config.accept_media !== false && !strictValidation);

      if (inboundMedia && inboundMedia.hasMedia) {
        if (!mediaAllowed) {
          const repromptCount = (run.reprompt_count || 0) + 1;
          if (repromptCount >= 3) {
            return await this.handleFallback(runId, cleanPhone, run.fallback_policy, sessionKey);
          }
          await db.promise().query("UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?", [repromptCount, runId]);
          await this.sendFlowMessage(
            cleanPhone,
            config.invalid_prompt || "Sorry, I can't read attachments for this question. Please type your answer.",
            sessionKey
          );
          return true;
        }

        // Persist the file only now that we know a step actually wants it
        const saved = typeof inboundMedia.resolve === "function"
          ? await inboundMedia.resolve().catch((e) => {
              console.warn("[WA Flow] Inbound attachment download failed:", e.message);
              return null;
            })
          : null;

        const label = inputVal || saved?.filename || inboundMedia.filename || `[${inboundMedia.type || "attachment"}]`;
        vars[varKey] = label;
        vars[`${varKey}_url`] = saved?.url || "";
        vars[`${varKey}_type`] = inboundMedia.type || "document";
        vars[`${varKey}_filename`] = saved?.filename || inboundMedia.filename || "";
        vars.last_input = label;
        vars.last_attachment_url = saved?.url || "";
        vars.last_attachment_type = inboundMedia.type || "document";

        await this.logEvent(runId, run.current_node_key, "attachment_received", {
          varKey,
          type: inboundMedia.type,
          url: saved?.url || null,
          filename: vars[`${varKey}_filename`],
        });

        nextNodeKey = config.next_node_key;
        if (!nextNodeKey) {
          await this.completeRun(runId, "flow_end_reached");
          return true;
        }
        await db.promise().query(
          "UPDATE wa_flow_runs SET vars = ?, current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
          [JSON.stringify(vars), nextNodeKey, runId]
        );
        return await this.executeNodeChain(runId, run.flow_id, cleanPhone, nextNodeKey, vars, sessionKey);
      }

      // Input Validation
      let isValid = true;
      let errorMsg = config.invalid_prompt || "Please enter a valid response.";

      if (validationType === "number" || config.regex === "^\\d+$") {
        isValid = /^\d+$/.test(inputVal.replace(/\s/g, ""));
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid number.";
      } else if (validationType === "email") {
        isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputVal);
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid email address (e.g. name@example.com).";
      } else if (validationType === "phone") {
        const digits = inputVal.replace(/\D/g, "");
        isValid = digits.length >= 10;
        if (!isValid) errorMsg = config.invalid_prompt || "Please enter a valid 10-digit mobile number.";
      } else if (config.regex) {
        try {
          const reg = new RegExp(config.regex);
          isValid = reg.test(inputVal);
        } catch (_) {}
      }

      if (!isValid) {
        const repromptCount = (run.reprompt_count || 0) + 1;
        if (repromptCount >= 3) {
          return await this.handleFallback(runId, cleanPhone, run.fallback_policy, sessionKey);
        }
        await db.promise().query(
          "UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?",
          [repromptCount, runId]
        );
        await this.sendFlowMessage(cleanPhone, errorMsg, sessionKey);
        return true;
      }

      vars[varKey] = inputVal;
      vars.last_input = inputVal;
      nextNodeKey = config.next_node_key;

    } else if (currentNode.node_type === "send_buttons" || currentNode.node_type === "send_list") {
      const rawText = (messageText || "").trim();
      const tappedId = interactiveReplyId || rawText;
      const lowerRaw = rawText.toLowerCase();
      const buttons = config.buttons || config.rows || [];
      
      if (!Array.isArray(vars._nav_history)) vars._nav_history = [];

      // 1. Navigation Command: Back / Previous Menu
      const isBackCmd = ["0", "back", "previous", "prev", "go back", "return", "undo", "exit", "b", "p", "⬅️", "🔙", "↩️"].includes(lowerRaw);
      if (isBackCmd) {
        if (config.back_node_key) {
          nextNodeKey = config.back_node_key;
        } else if (vars._nav_history.length > 0) {
          nextNodeKey = vars._nav_history.pop();
        } else {
          nextNodeKey = run.entry_node_key || "start";
        }
        console.log(`↩️ [WA Flow] Customer navigating BACK to node: ${nextNodeKey}`);
      }

      // 2. Navigation Command: Next / More Options
      const isNextCmd = !isBackCmd && ["next", "more", "next page", "page 2", "continue", "forward", "n", "➡️"].includes(lowerRaw);
      if (isNextCmd && (config.next_page_key || config.next_node_key)) {
        nextNodeKey = config.next_page_key || config.next_node_key;
        if (!vars._nav_history.includes(run.current_node_key)) {
          vars._nav_history.push(run.current_node_key);
        }
      }

      let matchedBtn = null;

      // 3. Option Number Match: "1", "2", "3", "1.", "#1", "opt 1", "option 1", "choice 1"
      if (!nextNodeKey) {
        const numMatch = rawText.match(/^(?:option\s*|opt\s*|choice\s*|select\s*|#\s*)?(\d+)[.)]?$/i);
        if (numMatch) {
          const numVal = parseInt(numMatch[1], 10);
          if (numVal === 0) {
            // "0" is universal Back
            if (config.back_node_key) {
              nextNodeKey = config.back_node_key;
            } else if (vars._nav_history.length > 0) {
              nextNodeKey = vars._nav_history.pop();
            } else {
              nextNodeKey = run.entry_node_key || "start";
            }
          } else {
            const numIdx = numVal - 1;
            if (numIdx >= 0 && numIdx < buttons.length) {
              matchedBtn = buttons[numIdx];
            }
          }
        }
      }

      // 4. Interactive Reply ID / Exact ID / Exact Title Match
      if (!nextNodeKey && !matchedBtn && tappedId) {
        matchedBtn = buttons.find(b => 
          (b.reply_id && String(b.reply_id).toLowerCase() === String(tappedId).toLowerCase()) ||
          (b.id && String(b.id).toLowerCase() === String(tappedId).toLowerCase()) ||
          (b.title && String(b.title).toLowerCase() === String(tappedId).toLowerCase())
        );
      }

      // 5. Clean Title / Fuzzy Substring Match (ignoring leading numbers & emojis)
      if (!nextNodeKey && !matchedBtn && rawText.length >= 2) {
        const cleanInput = rawText.replace(/^[^\w\s]+/, "").toLowerCase().trim();
        matchedBtn = buttons.find(b => {
          if (!b.title) return false;
          const cleanTitle = b.title.replace(/^\d+[\s.)-]+\s*/, "").replace(/^[^\w\s]+/, "").toLowerCase().trim();
          return (
            cleanTitle === cleanInput ||
            cleanInput.includes(cleanTitle) ||
            cleanTitle.includes(cleanInput)
          );
        });
      }

      // 6. Configured Button Keywords / Synonyms
      if (!nextNodeKey && !matchedBtn) {
        matchedBtn = buttons.find(b => {
          if (!b.keywords) return false;
          const kws = Array.isArray(b.keywords) ? b.keywords : String(b.keywords).split(",");
          return kws.some(k => k.trim() && lowerRaw.includes(k.trim().toLowerCase()));
        });
      }
      
      if (matchedBtn && (matchedBtn.next_node_key || matchedBtn.next_node)) {
        // Record current node in navigation history stack for back button support
        if (!vars._nav_history.includes(run.current_node_key)) {
          vars._nav_history.push(run.current_node_key);
        }
        nextNodeKey = matchedBtn.next_node_key || matchedBtn.next_node;
        vars.selected_option = matchedBtn.title;
        vars.selected_option_id = matchedBtn.reply_id || matchedBtn.id;
      } else if (!nextNodeKey) {
        // If unrecognized reply, check if reprompting helps or proceed to fallback
        const repromptCount = (run.reprompt_count || 0) + 1;
        if (repromptCount < 2 && config.fallback_node_key) {
          nextNodeKey = config.fallback_node_key;
        } else if (repromptCount < 2 && buttons.length > 0) {
          await db.promise().query("UPDATE wa_flow_runs SET reprompt_count = ? WHERE id = ?", [repromptCount, runId]);
          let promptMsg = "Please choose one of the options below (reply with option number):\n\n";
          buttons.forEach((b, idx) => {
            promptMsg += `*${idx + 1}.* ${b.title}\n`;
          });
          promptMsg += "\n_Reply 0 or BACK for previous menu, or MENU for main menu._";
          await this.sendFlowMessage(cleanPhone, promptMsg, sessionKey);
          return true;
        } else {
          nextNodeKey = config.fallback_node_key || config.next_node_key || (buttons[0] && (buttons[0].next_node_key || buttons[0].next_node));
        }
      }
    } else {
      nextNodeKey = config.next_node_key;
    }

    if (!nextNodeKey) {
      await this.completeRun(runId, "flow_end_reached");
      return true;
    }

    // Save updated vars
    await db.promise().query(
      "UPDATE wa_flow_runs SET vars = ?, current_node_key = ?, reprompt_count = 0, last_advanced_at = NOW() WHERE id = ?",
      [JSON.stringify(vars), nextNodeKey, runId]
    );

    return await this.executeNodeChain(runId, run.flow_id, cleanPhone, nextNodeKey, vars, sessionKey);
  }

  /**
   * Sequentially execute nodes until a suspension node (collect_input / send_buttons / send_list) or end is reached
   */
  async executeNodeChain(runId, flowId, cleanPhone, startNodeKey, currentVars, sessionKey = null) {
    let nodeKey = startNodeKey;
    let vars = { ...currentVars };
    let safetyCounter = 0;

    while (nodeKey && safetyCounter < 25) {
      safetyCounter++;

      const [nodes] = await db.promise().query(
        "SELECT * FROM wa_flow_nodes WHERE flow_id = ? AND node_key = ? LIMIT 1",
        [flowId, nodeKey]
      );
      const node = nodes[0];
      if (!node) {
        await this.completeRun(runId, `node_not_found_${nodeKey}`);
        return true;
      }

      let config = {};
      try {
        config = typeof node.config === "string" ? JSON.parse(node.config) : (node.config || {});
      } catch (_) {}

      await this.logEvent(runId, nodeKey, `node_exec_${node.node_type}`, { config, vars });

      switch (node.node_type) {
        case "start":
          nodeKey = config.next_node_key;
          break;

        case "send_message": {
          const renderedText = this.interpolate(config.text || "", vars);
          if (renderedText.trim()) {
            await this.sendFlowMessage(cleanPhone, renderedText, sessionKey);
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "send_media": {
          const renderedCaption = this.interpolate(config.caption || config.text || "", vars);
          const renderedUrl = this.interpolate(config.media_url || config.url || "", vars);
          const renderedFilename = config.filename ? this.interpolate(config.filename, vars) : "";
          const declaredType = String(config.media_type || "").toLowerCase();

          if (declaredType === "link") {
            // Share a link as a normal text message so WhatsApp renders the rich preview
            const linkBody = [renderedCaption, renderedUrl].filter((s) => String(s || "").trim()).join("\n");
            if (linkBody.trim()) await this.sendFlowMessage(cleanPhone, linkBody, sessionKey);
          } else {
            const media = this.resolveMedia(renderedUrl, declaredType, renderedFilename);
            if (media) {
              await this.sendFlowMedia(cleanPhone, media.type, media.url, renderedCaption, media.filename, sessionKey);
            } else {
              console.warn(`[WA Flow] send_media node '${nodeKey}' skipped — no reachable media URL (set PUBLIC_BASE_URL for uploaded files).`);
              // Don't silently drop the message: at least deliver the caption
              if (renderedCaption.trim()) await this.sendFlowMessage(cleanPhone, renderedCaption, sessionKey);
            }
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "send_template": {
          await this.sendFlowTemplate(cleanPhone, config.template_id || config.template_name, vars, sessionKey);
          nodeKey = config.next_node_key;
          break;
        }

        case "delay": {
          const delaySec = Math.min(Math.max(parseInt(config.delay_seconds, 10) || 3, 1), 30);
          console.log(`⏱️ [WA Flow] Pausing ${delaySec}s before next step for +${cleanPhone}`);
          await new Promise((r) => setTimeout(r, delaySec * 1000));
          nodeKey = config.next_node_key;
          break;
        }

        case "send_buttons": {
          const renderedText = this.interpolate(config.text || "", vars);
          const renderedHeader = config.header_text ? this.interpolate(config.header_text, vars) : null;
          const renderedFooter = config.footer_text ? this.interpolate(config.footer_text, vars) : null;
          const buttons = (config.buttons || []).map(b => ({
            ...b,
            title: this.interpolate(b.title, vars)
          }));
          await this.sendFlowButtons(cleanPhone, renderedText, buttons, renderedHeader, renderedFooter, sessionKey);
          
          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "send_list": {
          const renderedText = this.interpolate(config.text || config.body || "Please choose from the list:", vars);
          const renderedButtonText = config.button_text || "View Options";
          const renderedTitle = config.title ? this.interpolate(config.title, vars) : null;
          const rows = (config.rows || config.buttons || []).map(r => ({
            ...r,
            title: this.interpolate(r.title, vars),
            description: r.description ? this.interpolate(r.description, vars) : undefined
          }));
          
          await this.sendFlowList(cleanPhone, renderedText, rows, renderedButtonText, renderedTitle, sessionKey);

          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "collect_input": {
          const renderedPrompt = this.interpolate(config.prompt_text || "", vars);
          if (renderedPrompt.trim()) {
            await this.sendFlowMessage(cleanPhone, renderedPrompt, sessionKey);
          }
          // Suspends execution — wait for user reply
          await db.promise().query(
            "UPDATE wa_flow_runs SET current_node_key = ?, vars = ? WHERE id = ?",
            [nodeKey, JSON.stringify(vars), runId]
          );
          return true;
        }

        case "crm_lookup": {
          // Dynamic live CRM query during execution
          const lookupType = config.lookup_type || "invoice";
          const crmResults = await this.performCrmLookup(cleanPhone, lookupType, config, vars);
          Object.assign(vars, crmResults);

          // If condition check configured inside lookup
          if (config.branch_on_result) {
            const hasRecord = !!(crmResults && Object.keys(crmResults).length > 0 && crmResults.record_found);
            nodeKey = hasRecord ? config.found_next : config.not_found_next;
          } else {
            nodeKey = config.next_node_key;
          }
          break;
        }

        case "api_webhook": {
          // Dynamic external REST API call
          try {
            const endpointUrl = this.interpolate(config.url || "", vars);
            const method = (config.method || "GET").toUpperCase();
            const headers = {};
            if (config.headers) {
              try {
                const parsedHeaders = typeof config.headers === "string" ? JSON.parse(config.headers) : config.headers;
                for (const [k, v] of Object.entries(parsedHeaders)) {
                  headers[k] = this.interpolate(String(v), vars);
                }
              } catch (_) {}
            }

            let requestData = null;
            if (method !== "GET" && config.body) {
              try {
                const renderedBody = this.interpolate(typeof config.body === "string" ? config.body : JSON.stringify(config.body), vars);
                requestData = JSON.parse(renderedBody);
              } catch (_) {
                requestData = config.body;
              }
            }

            const response = await axios({
              method,
              url: endpointUrl,
              headers,
              data: requestData,
              timeout: 10000,
            });

            // An empty mapping object must not swallow the response
            const mapping = config.response_mapping && typeof config.response_mapping === "object"
              ? Object.entries(config.response_mapping).filter(([k, v]) => k && v)
              : [];
            if (mapping.length) {
              for (const [varName, jsonPath] of mapping) {
                vars[varName] = this.extractJsonPath(response.data, jsonPath) || "";
              }
            } else if (response.data && typeof response.data === "object") {
              vars.webhook_response = JSON.stringify(response.data);
            }
            vars.webhook_status = "success";
            nodeKey = config.success_next || config.next_node_key;
          } catch (apiErr) {
            console.warn(`[WA Flow] Webhook error at node ${nodeKey}:`, apiErr.message);
            vars.webhook_status = "error";
            vars.webhook_error = apiErr.message;
            nodeKey = config.error_next || config.next_node_key;
          }
          break;
        }

        case "ai_generate":
        case "ai_intent": {
          // Dynamic AI Step (Generate Response or Classify Intent)
          const aiResult = await this.executeAiNode(node.node_type, config, vars, cleanPhone);
          if (node.node_type === "ai_intent") {
            const detectedIntent = aiResult.intent || "unknown";
            vars.ai_detected_intent = detectedIntent;
            const branchMap = config.branches || {};
            nodeKey = branchMap[detectedIntent] || config.fallback_node || config.next_node_key;
          } else {
            // ai_generate
            const replyText = aiResult.reply || "";
            if (replyText) {
              await this.sendFlowMessage(cleanPhone, replyText, sessionKey);
            }
            vars.ai_last_reply = replyText;
            nodeKey = config.next_node_key;
          }
          break;
        }

        case "condition": {
          const subjectKey = config.subject_key || "input";
          const varVal = String(vars[subjectKey] !== undefined ? vars[subjectKey] : "").trim();
          const targetVal = String(config.value !== undefined ? config.value : "").trim();
          const operator = config.operator || "equals";
          let isTrue = false;

          if (operator === "equals") isTrue = varVal.toLowerCase() === targetVal.toLowerCase();
          else if (operator === "not_equals") isTrue = varVal.toLowerCase() !== targetVal.toLowerCase();
          else if (operator === "contains") isTrue = varVal.toLowerCase().includes(targetVal.toLowerCase());
          else if (operator === "not_contains") isTrue = !varVal.toLowerCase().includes(targetVal.toLowerCase());
          else if (operator === "starts_with") isTrue = varVal.toLowerCase().startsWith(targetVal.toLowerCase());
          else if (operator === "ends_with") isTrue = varVal.toLowerCase().endsWith(targetVal.toLowerCase());
          else if (operator === "greater_than") isTrue = parseFloat(varVal) > parseFloat(targetVal);
          else if (operator === "less_than") isTrue = parseFloat(varVal) < parseFloat(targetVal);
          else if (operator === "greater_or_equal") isTrue = parseFloat(varVal) >= parseFloat(targetVal);
          else if (operator === "less_or_equal") isTrue = parseFloat(varVal) <= parseFloat(targetVal);
          else if (operator === "is_empty") isTrue = varVal === "";
          else if (operator === "is_not_empty" || operator === "present") isTrue = varVal !== "";
          else if (operator === "is_numeric") isTrue = !isNaN(parseFloat(varVal)) && isFinite(varVal);
          else if (operator === "matches_regex") {
            try { isTrue = new RegExp(targetVal, "i").test(varVal); } catch (_) { isTrue = false; }
          } else isTrue = !!varVal;

          nodeKey = isTrue ? (config.true_next || config.then_node) : (config.false_next || config.else_node);
          break;
        }

        case "set_variable": {
          if (config.variable_name) {
            const rawVal = config.variable_value !== undefined ? String(config.variable_value) : "";
            vars[config.variable_name] = this.interpolate(rawVal, vars);
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "set_tag": {
          if (config.tag) {
            await db.promise().query(
              "UPDATE wa_contacts SET tags = JSON_ARRAY_APPEND(COALESCE(tags, '[]'), '$', ?) WHERE phone LIKE ?",
              [config.tag, `%${cleanPhone.slice(-10)}`]
            ).catch(() => {});
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "add_to_group": {
          if (config.group_id) {
            await db.promise().query(
              `INSERT INTO wa_group_contacts (group_id, name, phone, country_code, notes)
               VALUES (?, ?, ?, '91', 'Added via Chatbot Flow')
               ON DUPLICATE KEY UPDATE name=VALUES(name)`,
              [config.group_id, vars.name || vars.customer_name || "Customer", cleanPhone.slice(-10)]
            ).catch(() => {});
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "create_lead": {
          const waLeadCapture = require("./waLeadCapture");
          await waLeadCapture.captureLeadFromWhatsApp({
            phone: cleanPhone,
            name: vars.name || vars.customer_name,
            company: vars.company || vars.company_name,
            email: vars.email,
            city: vars.city || vars.location_city || vars.booking_city,
            service: vars.service || vars.product || vars.service_inquiry || config.default_service || "WhatsApp Lead",
            notes: config.notes ? this.interpolate(config.notes, vars) : JSON.stringify(vars),
            sourceDetail: `WhatsApp Flow (${flowId})`,
          });
          nodeKey = config.next_node_key;
          break;
        }

        case "jump_to_flow": {
          if (config.target_flow_id) {
            const [targetFlows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [config.target_flow_id]);
            if (targetFlows[0]) {
              await this.completeRun(runId, `jumped_to_flow_${config.target_flow_id}`);
              return await this.startFlowRun(targetFlows[0], cleanPhone, sessionKey, vars.last_input || "");
            }
          }
          nodeKey = config.next_node_key;
          break;
        }

        case "handoff": {
          const noteText = config.note || "Transferring you to our support team. An agent will assist you shortly.";
          await this.sendFlowMessage(cleanPhone, this.interpolate(noteText, vars), sessionKey);
          await db.promise().query(
            "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'agent_handoff', vars = ? WHERE id = ?",
            [JSON.stringify(vars), runId]
          );
          // Mute AI auto-reply for this phone for 2 hours
          await db.promise().query(
            "UPDATE wa_contacts SET ai_paused_until = DATE_ADD(NOW(), INTERVAL 120 MINUTE) WHERE phone LIKE ?",
            [`%${cleanPhone.slice(-10)}`]
          );

          // Emit live handoff alert to Live Chat agents
          try {
            const app = require("../server");
            const io = app.get && app.get("io");
            if (io) {
              io.emit("wa_agent_handoff", {
                phone: cleanPhone,
                flowId,
                note: config.note || "Customer requested live support",
                vars,
              });
            }
          } catch (_) {}

          return true;
        }

        case "end":
        default:
          await this.completeRun(runId, "end_node");
          return true;
      }
    }

    return true;
  }

  /**
   * Deep CRM Database Querying Helper
   */
  async performCrmLookup(cleanPhone, lookupType, config, currentVars) {
    const last10 = cleanPhone.slice(-10);
    const results = { record_found: false };

    try {
      if (lookupType === "invoice") {
        // Query latest client invoice
        const [rows] = await db.promise().query(
          `SELECT i.invoice_number, i.total_amount, i.status, i.due_date, i.issue_date, c.name as client_name
           FROM clientinvoices i
           LEFT JOIN clients c ON i.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY i.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const inv = rows[0];
          results.record_found = true;
          results.invoice_no = inv.invoice_number || `INV-${inv.id}`;
          results.invoice_number = results.invoice_no;
          results.amount = inv.total_amount || "0.00";
          results.invoice_amount = results.amount;
          results.payment_status = inv.status || "Pending";
          results.due_date = inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-IN") : "Upon Receipt";
        }
      } else if (lookupType === "amc") {
        // Query active AMC contract
        const [rows] = await db.promise().query(
          `SELECT a.contract_number, a.start_date, a.end_date, a.status, a.service_type
           FROM amc a
           LEFT JOIN clients c ON a.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY a.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const amc = rows[0];
          results.record_found = true;
          results.amc_contract_no = amc.contract_number || `AMC-${amc.id}`;
          results.amc_service = amc.service_type || "Comprehensive Maintenance";
          results.amc_status = amc.status || "Active";
          results.amc_expiry = amc.end_date ? new Date(amc.end_date).toLocaleDateString("en-IN") : "Active";
        }
      } else if (lookupType === "quotation") {
        const [rows] = await db.promise().query(
          `SELECT q.quotation_number, q.total_amount, q.status, q.valid_until
           FROM quotations q
           LEFT JOIN clients c ON q.client_id = c.id
           WHERE (c.phone LIKE ? OR c.mobile LIKE ?)
           ORDER BY q.id DESC LIMIT 1`,
          [`%${last10}`, `%${last10}`]
        ).catch(() => [[]]);

        if (rows && rows[0]) {
          const quote = rows[0];
          results.record_found = true;
          results.quotation_no = quote.quotation_number || `QT-${quote.id}`;
          results.quote_amount = quote.total_amount || "0.00";
          results.quote_status = quote.status || "Draft";
          results.valid_until = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-IN") : "";
        }
      } else if (lookupType === "client") {
        const { lookupCrmDataByPhone } = require("./waAutomationService");
        const crmData = await lookupCrmDataByPhone(cleanPhone);
        if (crmData && crmData.name) {
          results.record_found = true;
          results.customer_name = crmData.name;
          results.name = crmData.name;
          results.company = crmData.company || "";
          results.company_name = crmData.company || "";
          results.city = crmData.city || "";
          results.email = crmData.email || "";
        }
      }
    } catch (e) {
      console.warn("CRM lookup error:", e.message);
    }

    return results;
  }

  /**
   * Execute AI Node (Generate text reply or Classify Intent)
   */
  async executeAiNode(nodeType, config, vars, phone) {
    try {
      const [aiSettingsRows] = await db.promise().query("SELECT * FROM wa_ai_settings WHERE id = 1");
      const aiSettings = aiSettingsRows[0] || {};
      const apiKey = aiSettings.api_key || process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return { reply: "Thank you for reaching out. A specialist will assist you shortly.", intent: "unknown" };
      }

      const userText = vars.last_input || vars.input || "";
      
      if (nodeType === "ai_intent") {
        const prompt = `Classify the following customer WhatsApp message into exactly one of these intent categories: ${Object.keys(config.branches || { booking: 1, pricing: 1, support: 1, human: 1 }).join(", ")}. Return only the intent name in lowercase with no extra text.\nCustomer message: "${userText}"`;
        
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: aiSettings.model || "meta-llama/llama-3.3-70b-instruct:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 }
        );

        const intent = (res.data?.choices?.[0]?.message?.content || "unknown").trim().toLowerCase().replace(/[^a-z_]/g, "");
        return { intent };
      } else {
        // ai_generate
        const systemPrompt = this.interpolate(config.system_prompt || "You are a helpful customer support assistant for ACHME Solutions.", vars);
        const res = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: aiSettings.model || "meta-llama/llama-3.3-70b-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText || "Hello" }
            ],
            temperature: 0.5,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
        );
        const reply = res.data?.choices?.[0]?.message?.content || "";
        return { reply };
      }
    } catch (e) {
      console.warn("executeAiNode error:", e.message);
      return { reply: "Thank you. Our team is reviewing your request.", intent: "unknown" };
    }
  }

  /**
   * Helper to resolve dot notation JSON paths (e.g. data.items[0].price)
   */
  extractJsonPath(obj, path) {
    if (!obj || !path) return null;
    try {
      const parts = path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "").split(".");
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return null;
        current = current[part];
      }
      return current;
    } catch (_) {
      return null;
    }
  }

  /**
   * In-Memory Simulation Engine for Flow Testing in Browser
   * Executes flow steps without sending real WhatsApp messages or hitting network timeouts.
   */
  async simulateFlowStep(flow, userMessage = "", currentRunState = null) {
    const rawTrimmed = (userMessage || "").trim();
    const lowerText = rawTrimmed.toLowerCase();
    
    let nodes = flow.nodes || [];
    if (!nodes || nodes.length === 0) {
      const [dbNodes] = await db.promise().query("SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC", [flow.id]);
      nodes = dbNodes.map(n => ({
        ...n,
        config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
      }));
    }

    const nodeMap = {};
    for (const n of nodes) {
      const cfg = typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {});
      nodeMap[n.node_key] = { ...n, config: cfg };
    }

    let vars = currentRunState?.vars ? { ...currentRunState.vars } : {
      name: "Rahul Sharma",
      customer_name: "Rahul Sharma",
      company: "ACHME Solutions",
      company_name: "ACHME Solutions",
      city: "Bangalore",
      service: "AC AMC Maintenance",
      amount: "14,500",
      invoice_no: "INV-2026-088",
      due_date: "25 Aug 2026",
      date: new Date().toLocaleDateString("en-IN"),
      start_time: "09:00 AM",
      end_time: "08:00 PM",
    };

    const simulatedMessages = [];
    const stepLogs = [];
    let currentNodeKey = currentRunState?.currentNodeKey;
    let isFlowEnded = false;
    let isHandedOff = false;

    // Global reset
    if (["menu", "start", "restart"].includes(lowerText)) {
      currentNodeKey = flow.entry_node_key || "start";
    }

    // Global handoff
    if (["agent", "human", "support", "person", "representative"].includes(lowerText)) {
      simulatedMessages.push({
        sender: "bot",
        type: "text",
        text: "👤 Transferring you to our support specialist now. Please stay online.",
        at: new Date()
      });
      return {
        handled: true,
        messages: simulatedMessages,
        vars,
        currentNodeKey: null,
        isEnded: true,
        isHandedOff: true,
        logs: ["Customer requested human agent."]
      };
    }

    // 1. If no active node, start at entry
    if (!currentNodeKey) {
      currentNodeKey = flow.entry_node_key || "start";
    } else {
      // Advance current waiting node with user input
      const currentNode = nodeMap[currentNodeKey];
      let nextNodeKey = null;

      if (currentNode) {
        if (currentNode.node_type === "collect_input") {
          const varKey = currentNode.config?.var_key || "input";
          vars[varKey] = rawTrimmed;
          vars.last_input = rawTrimmed;
          nextNodeKey = currentNode.config?.next_node_key;
        } else if (currentNode.node_type === "send_buttons" || currentNode.node_type === "send_list") {
          const buttons = currentNode.config?.buttons || currentNode.config?.rows || [];
          if (!Array.isArray(vars._nav_history)) vars._nav_history = [];

          // Navigation command: Back / Previous
          const isBackCmd = ["0", "back", "previous", "prev", "go back", "return", "undo", "exit", "b", "p", "⬅️", "🔙", "↩️"].includes(lowerText);
          if (isBackCmd) {
            if (currentNode.config?.back_node_key) {
              nextNodeKey = currentNode.config.back_node_key;
            } else if (vars._nav_history.length > 0) {
              nextNodeKey = vars._nav_history.pop();
            } else {
              nextNodeKey = flow.entry_node_key || "start";
            }
          }

          // Navigation command: Next / More
          const isNextCmd = !isBackCmd && ["next", "more", "next page", "page 2", "continue", "forward", "n", "➡️"].includes(lowerText);
          if (isNextCmd && (currentNode.config?.next_page_key || currentNode.config?.next_node_key)) {
            nextNodeKey = currentNode.config.next_page_key || currentNode.config.next_node_key;
            if (!vars._nav_history.includes(currentNode.node_key)) {
              vars._nav_history.push(currentNode.node_key);
            }
          }

          let matched = null;

          if (!nextNodeKey) {
            const numMatch = rawTrimmed.match(/^(?:option\s*|opt\s*|choice\s*|select\s*|#\s*)?(\d+)[.)]?$/i);
            if (numMatch) {
              const numVal = parseInt(numMatch[1], 10);
              if (numVal === 0) {
                if (currentNode.config?.back_node_key) {
                  nextNodeKey = currentNode.config.back_node_key;
                } else if (vars._nav_history.length > 0) {
                  nextNodeKey = vars._nav_history.pop();
                } else {
                  nextNodeKey = flow.entry_node_key || "start";
                }
              } else {
                const idx = numVal - 1;
                if (idx >= 0 && idx < buttons.length) matched = buttons[idx];
              }
            }
          }

          if (!nextNodeKey && !matched) {
            matched = buttons.find(b => 
              (b.reply_id && String(b.reply_id).toLowerCase() === lowerText) ||
              (b.id && String(b.id).toLowerCase() === lowerText) ||
              (b.title && String(b.title).toLowerCase() === lowerText)
            );
          }

          if (!nextNodeKey && !matched && rawTrimmed.length >= 2) {
            const cleanInput = rawTrimmed.replace(/^[^\w\s]+/, "").toLowerCase().trim();
            matched = buttons.find(b => {
              if (!b.title) return false;
              const cleanTitle = b.title.replace(/^\d+[\s.)-]+\s*/, "").replace(/^[^\w\s]+/, "").toLowerCase().trim();
              return (
                cleanTitle === cleanInput ||
                cleanInput.includes(cleanTitle) ||
                cleanTitle.includes(cleanInput)
              );
            });
          }

          if (matched) {
            if (!vars._nav_history.includes(currentNode.node_key)) {
              vars._nav_history.push(currentNode.node_key);
            }
            vars.selected_option = matched.title;
            vars.selected_option_id = matched.reply_id || matched.id;
            vars._reprompt_count = 0;
            nextNodeKey = matched.next_node_key || matched.next_node;
          } else if (!nextNodeKey) {
            // Mirror the live bot: re-show the numbered menu once before falling
            // through, instead of silently selecting option 1.
            const tries = (vars._reprompt_count || 0) + 1;
            if (!currentNode.config?.fallback_node_key && tries < 2 && buttons.length > 0) {
              vars._reprompt_count = tries;
              let promptMsg = "Please choose one of the options below (reply with option number):\n\n";
              buttons.forEach((b, i) => { promptMsg += `*${i + 1}.* ${b.title}\n`; });
              promptMsg += "\n_Reply 0 or BACK for previous menu, or MENU for main menu._";
              return {
                handled: true,
                messages: [{ sender: "bot", type: "text", text: promptMsg, at: new Date() }],
                vars,
                currentNodeKey: currentNode.node_key,
                isEnded: false,
                logs: [`Unrecognised reply "${rawTrimmed}" — reprompting with the option list.`]
              };
            }
            nextNodeKey = currentNode.config?.fallback_node_key || currentNode.config?.next_node_key || (buttons[0] && (buttons[0].next_node_key || buttons[0].next_node));
          }
        }
      }

      currentNodeKey = nextNodeKey;
    }

    // 2. Chain execute nodes until suspension
    let safetyCounter = 0;
    while (currentNodeKey && safetyCounter < 20) {
      safetyCounter++;
      const node = nodeMap[currentNodeKey];
      if (!node) {
        stepLogs.push(`Node '${currentNodeKey}' not found.`);
        isFlowEnded = true;
        break;
      }

      stepLogs.push(`Executed step '${node.node_key}' (${node.node_type})`);

      if (node.node_type === "start") {
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_message") {
        const text = this.interpolate(node.config?.text || "", vars);
        simulatedMessages.push({ sender: "bot", type: "text", text, at: new Date() });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_media") {
        const caption = this.interpolate(node.config?.caption || node.config?.text || "", vars);
        const rawUrl = this.interpolate(node.config?.media_url || node.config?.url || "", vars);
        const declared = String(node.config?.media_type || "").toLowerCase();

        if (declared === "link") {
          simulatedMessages.push({
            sender: "bot",
            type: "text",
            text: [caption, rawUrl].filter((s) => String(s || "").trim()).join("\n"),
            at: new Date()
          });
        } else {
          const media = this.resolveMedia(rawUrl, declared, node.config?.filename || "");
          simulatedMessages.push({
            sender: "bot",
            type: "media",
            media_type: media?.type || declared || "document",
            media_url: media?.url || rawUrl,
            filename: media?.filename || node.config?.filename || "",
            caption,
            at: new Date()
          });
          if (!media) stepLogs.push(`[Warning] '${node.node_key}' has no reachable media URL — set PUBLIC_BASE_URL for uploaded files.`);
        }
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_buttons") {
        const text = this.interpolate(node.config?.text || "", vars);
        const buttons = (node.config?.buttons || []).map(b => ({
          ...b,
          title: this.interpolate(b.title, vars)
        }));
        simulatedMessages.push({
          sender: "bot",
          type: "buttons",
          text,
          header: node.config?.header_text,
          footer: node.config?.footer_text,
          buttons,
          at: new Date()
        });
        // Suspends execution waiting for button tap or reply
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "send_list") {
        const text = this.interpolate(node.config?.text || node.config?.body || "Please choose:", vars);
        const rows = (node.config?.rows || []).map(r => ({
          ...r,
          title: this.interpolate(r.title, vars),
          description: r.description ? this.interpolate(r.description, vars) : null
        }));
        simulatedMessages.push({
          sender: "bot",
          type: "list",
          text,
          title: node.config?.title,
          button_text: node.config?.button_text || "View Options",
          rows,
          at: new Date()
        });
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "collect_input") {
        const prompt = this.interpolate(node.config?.prompt_text || "", vars);
        simulatedMessages.push({
          sender: "bot",
          type: "collect_input",
          text: prompt,
          var_key: node.config?.var_key,
          at: new Date()
        });
        return {
          handled: true,
          messages: simulatedMessages,
          vars,
          currentNodeKey: node.node_key,
          isEnded: false,
          logs: stepLogs
        };
      } else if (node.node_type === "crm_lookup") {
        // Simulated CRM Lookup
        vars.invoice_no = "INV-2026-088";
        vars.amount = "14,500";
        vars.due_date = "25 Aug 2026";
        vars.payment_status = "Pending";
        vars.amc_contract_no = "AMC-2026-904";
        vars.amc_status = "Active";
        vars.amc_expiry = "31 Dec 2026";
        vars.record_found = true;
        currentNodeKey = node.config?.next_node_key || node.config?.found_next;
      } else if (node.node_type === "condition") {
        const subject = String(vars[node.config?.subject_key || "input"] || "");
        const target = String(node.config?.value || "");
        const op = node.config?.operator || "equals";
        let match = false;
        if (op === "equals") match = subject.toLowerCase() === target.toLowerCase();
        else if (op === "contains") match = subject.toLowerCase().includes(target.toLowerCase());
        else if (op === "is_not_empty" || op === "present") match = !!subject.trim();
        else match = !!subject;

        currentNodeKey = match ? (node.config?.true_next || node.config?.then_node) : (node.config?.false_next || node.config?.else_node);
      } else if (node.node_type === "set_variable") {
        if (node.config?.variable_name) {
          vars[node.config.variable_name] = this.interpolate(String(node.config.variable_value || ""), vars);
        }
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "create_lead") {
        stepLogs.push(`[CRM] Lead auto-captured: ${JSON.stringify(vars)}`);
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "delay") {
        stepLogs.push(`[Pause] Delay ${node.config?.delay_seconds || 3}s`);
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "send_template") {
        stepLogs.push(`[Template] Sends approved template #${node.config?.template_id || node.config?.template_name || "?"}`);
        simulatedMessages.push({
          sender: "bot",
          type: "text",
          text: `🧾 _[Approved template #${node.config?.template_id || node.config?.template_name || "?"} would be delivered here]_`,
          at: new Date()
        });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "api_webhook") {
        // No live HTTP call in the simulator — follow the success path
        stepLogs.push(`[Webhook] ${node.config?.method || "GET"} ${node.config?.url || ""} (not called in simulation, taking success path)`);
        vars.webhook_status = "success";
        currentNodeKey = node.config?.success_next || node.config?.next_node_key;
      } else if (node.node_type === "ai_generate") {
        simulatedMessages.push({
          sender: "bot",
          type: "text",
          text: "🧠 _[AI-generated reply would appear here — the live bot answers using your AI settings]_",
          at: new Date()
        });
        currentNodeKey = node.config?.next_node_key;
      } else if (node.node_type === "ai_intent") {
        // Without calling the model, route on the first configured intent so the
        // rest of the branch stays walkable in the preview
        const branchKeys = Object.keys(node.config?.branches || {});
        const picked = branchKeys[0];
        vars.ai_detected_intent = picked || "unknown";
        stepLogs.push(`[AI Intent] Simulated as '${picked || "unknown"}' (live bot classifies the real message)`);
        currentNodeKey = (picked && node.config.branches[picked]) || node.config?.fallback_node || node.config?.next_node_key;
      } else if (node.node_type === "jump_to_flow") {
        stepLogs.push(`[Jump] Hands the customer over to flow #${node.config?.target_flow_id || "?"} — simulation stops here.`);
        isFlowEnded = true;
        break;
      } else if (node.node_type === "handoff") {
        const note = node.config?.note || "Connecting to live support agent...";
        simulatedMessages.push({ sender: "bot", type: "handoff", text: note, at: new Date() });
        isHandedOff = true;
        isFlowEnded = true;
        break;
      } else if (node.node_type === "end") {
        isFlowEnded = true;
        break;
      } else {
        currentNodeKey = node.config?.next_node_key;
      }
    }

    return {
      handled: true,
      messages: simulatedMessages,
      vars,
      currentNodeKey: isFlowEnded ? null : currentNodeKey,
      isEnded: isFlowEnded,
      isHandedOff,
      logs: stepLogs
    };
  }

  async resolveInitialCrmVars(cleanPhone) {
    const { lookupCrmDataByPhone } = require("./waAutomationService");
    const crmData = await lookupCrmDataByPhone(cleanPhone).catch(() => ({}));
    return {
      name: crmData.name || crmData.customer_name || "Valued Customer",
      customer_name: crmData.name || crmData.customer_name || "Valued Customer",
      company: crmData.company || crmData.company_name || "ACHME Solutions",
      company_name: crmData.company || crmData.company_name || "ACHME Solutions",
      city: crmData.city || crmData.location_city || "our city",
      email: crmData.email || "",
      is_existing_customer: !!(crmData.name || crmData.company),
      date: new Date().toLocaleDateString("en-IN"),
      start_time: "09:00 AM",
      end_time: "08:00 PM",
    };
  }

  async handleFallback(runId, cleanPhone, fallbackPolicy, sessionKey = null) {
    await this.sendFlowMessage(cleanPhone, "I am having trouble understanding. Let me connect you with a team member.", sessionKey);
    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'handed_off', ended_at = NOW(), end_reason = 'fallback_max_reprompts' WHERE id = ?",
      [runId]
    );
    return true;
  }

  async completeRun(runId, reason) {
    try {
      const [runs] = await db.promise().query(
        "SELECT r.*, f.name as flow_name FROM wa_flow_runs r LEFT JOIN wa_flows f ON r.flow_id = f.id WHERE r.id = ?",
        [runId]
      );
      if (runs && runs[0]) {
        const run = runs[0];
        let vars = {};
        try { vars = typeof run.vars === "string" ? JSON.parse(run.vars) : (run.vars || {}); } catch (_) {}
        if (vars.name || vars.service || vars.inquiry || vars.email || Object.keys(vars).length >= 3) {
          const waLeadCapture = require("./waLeadCapture");
          await waLeadCapture.captureLeadFromWhatsApp({
            phone: run.phone,
            name: vars.name || vars.customer_name,
            company: vars.company || vars.company_name,
            email: vars.email,
            city: vars.city || vars.location_city || vars.booking_city,
            service: vars.service || vars.product || vars.service_inquiry || "WhatsApp Inquiry",
            notes: JSON.stringify(vars),
            sourceDetail: `WhatsApp Flow: ${run.flow_name || "Chatbot"}`,
          }).catch(() => {});
        }
      }
    } catch (_) {}

    await db.promise().query(
      "UPDATE wa_flow_runs SET status = 'completed', ended_at = NOW(), end_reason = ? WHERE id = ?",
      [reason, runId]
    );
  }

  async sendFlowMessage(phone, text, sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    const formatted = mdToWa.toWhatsApp(text);
    
    // Broadcast & record in DB so live chat updates instantly
    await this.recordAndEmitBotMessage(phone, formatted, "text");

    return await waLoadBalancer.sendTextMessage(phone, formatted, sessionKey).catch((e) => {
      console.warn("sendFlowMessage error:", e.message);
      return null;
    });
  }

  async sendFlowMedia(phone, mediaType, mediaUrl, caption, filename = "", sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");
    const formattedCaption = caption ? mdToWa.toWhatsApp(caption) : "";

    await this.recordAndEmitBotMessage(phone, formattedCaption || filename || `[Media Attachment: ${mediaType}]`, "media");

    return await waLoadBalancer.sendMediaMessage(phone, mediaType || "image", mediaUrl, formattedCaption, filename, sessionKey).catch((e) => {
      console.warn("sendFlowMedia error:", e.message);
      return null;
    });
  }

  async sendFlowTemplate(phone, templateRef, vars = {}, sessionKey = null) {
    const waLoadBalancer = require("./waLoadBalancer");
    const { buildTemplateBodyComponent } = require("./waAutomationService");
    try {
      let tmpl = null;
      if (typeof templateRef === "number" || /^\d+$/.test(templateRef)) {
        const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE id = ? LIMIT 1", [templateRef]);
        tmpl = rows[0];
      } else if (templateRef) {
        const [rows] = await db.promise().query("SELECT * FROM wa_templates WHERE name = ? LIMIT 1", [templateRef]);
        tmpl = rows[0];
      }
      if (!tmpl) return null;

      const bodyComponent = buildTemplateBodyComponent(tmpl.body, vars.name, vars);
      const renderedBody = this.interpolate(tmpl.body, vars);
      await this.recordAndEmitBotMessage(phone, renderedBody, "template");

      return await waLoadBalancer.sendTemplateMessage(phone, tmpl.name, tmpl.language || "en", bodyComponent ? [bodyComponent] : [], sessionKey);
    } catch (e) {
      console.warn("sendFlowTemplate error:", e.message);
      return null;
    }
  }

  async sendFlowButtons(phone, text, buttons, headerText, footerText, sessionKey = null) {
    const waCloud = require("./whatsappCloudApi");
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");

    // Standardized numbered text menu for WhatsApp Web and fallback
    let menuBody = (headerText ? `*${headerText}*\n\n` : "") + mdToWa.toWhatsApp(text) + "\n\n";
    buttons.forEach((b, idx) => {
      menuBody += `*${idx + 1}.* ${b.title}\n`;
    });
    if (footerText) menuBody += `\n_${footerText}_`;

    // Record & broadcast interactive menu
    await this.recordAndEmitBotMessage(phone, menuBody, "interactive", {
      type: "buttons",
      header: headerText,
      footer: footerText,
      buttons,
      text
    });

    if (waCloud.isConfigured() && buttons.length) {
      // Cloud API reply-buttons cap at 3. Beyond that, render as a list so that
      // EVERY option stays tappable instead of being silently dropped.
      const sent = buttons.length > 3
        ? await waCloud.sendInteractiveList(
            phone,
            text,
            "View Options",
            buttons.slice(0, 10).map((b, i) => ({
              id: b.reply_id || b.id || `btn_${i + 1}`,
              title: (b.title || `Option ${i + 1}`).slice(0, 24),
              description: b.description || undefined,
            })),
            headerText,
            footerText
          ).catch(() => null)
        : await waCloud.sendInteractiveButtons(
            phone,
            text,
            buttons.map((b, i) => ({
              id: b.reply_id || b.id || `btn_${i + 1}`,
              title: (b.title || `Option ${i + 1}`).slice(0, 20),
            })),
            headerText,
            footerText
          ).catch(() => null);
      if (sent) return sent;
    }

    return await waLoadBalancer.sendTextMessage(phone, menuBody, sessionKey).catch(() => null);
  }

  async sendFlowList(phone, text, rows, buttonText = "View Options", title = null, sessionKey = null) {
    const waCloud = require("./whatsappCloudApi");
    const waLoadBalancer = require("./waLoadBalancer");
    const mdToWa = require("./mdToWa");

    let listBody = (title ? `*${title}*\n\n` : "") + mdToWa.toWhatsApp(text) + "\n\n";
    rows.forEach((r, idx) => {
      listBody += `*${idx + 1}.* ${r.title}`;
      if (r.description) listBody += ` - _${r.description}_`;
      listBody += "\n";
    });
    listBody += `\n_Reply with option number (1, 2, 3...)_`;

    await this.recordAndEmitBotMessage(phone, listBody, "interactive", {
      type: "list",
      title,
      button_text: buttonText,
      rows,
      text
    });

    if (waCloud.isConfigured() && rows.length) {
      const formattedSections = [{
        title: title || "Options",
        rows: rows.slice(0, 10).map((r, i) => ({
          id: r.id || r.reply_id || `row_${i + 1}`,
          title: (r.title || `Option ${i + 1}`).slice(0, 24),
          description: r.description ? String(r.description).slice(0, 72) : undefined
        }))
      }];
      const sent = await waCloud.sendInteractiveList(phone, text, buttonText, formattedSections, title).catch(() => null);
      if (sent) return sent;
    }

    return await waLoadBalancer.sendTextMessage(phone, listBody, sessionKey).catch(() => null);
  }

  interpolate(template, vars = {}) {
    if (!template || typeof template !== "string") return "";
    try {
      const { formatMessagePlaceholders } = require("./waAutomationService");
      return formatMessagePlaceholders(template, vars.name || vars.customer_name, vars);
    } catch (_) {
      return template;
    }
  }

  async logEvent(runId, nodeKey, eventType, payload = {}) {
    await db.promise().query(
      "INSERT INTO wa_flow_run_events (run_id, node_key, event_type, payload) VALUES (?, ?, ?, ?)",
      [runId, nodeKey, eventType, JSON.stringify(payload)]
    ).catch(() => {});
  }
}

module.exports = new WaFlowEngine();
