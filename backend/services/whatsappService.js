const { Client, LocalAuth, MessageMedia, Location } = require("whatsapp-web.js");
const path = require("path");
const fs = require("fs");

function getExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidatePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

// Media/location messages often have an empty .body — showing that blank made
// the chat list read as "Tap to start chatting" (no messages yet) for chats
// that actually have history, which was confusing. Give the preview a label.
const MEDIA_TYPE_LABELS = {
  image: "📷 Photo",
  video: "🎥 Video",
  document: "📄 Document",
  audio: "🎤 Voice message",
  ptt: "🎤 Voice message",
  sticker: "Sticker",
  location: "📍 Location",
};
function describeLastMessage(msg) {
  if (msg.body) return msg.body;
  if (msg.type === "location") return MEDIA_TYPE_LABELS.location;
  if (msg.hasMedia || MEDIA_TYPE_LABELS[msg.type]) return MEDIA_TYPE_LABELS[msg.type] || "📎 Attachment";
  return msg.body || "";
}

function formatChatJid(chatId) {
  if (!chatId) return "";
  if (chatId.includes("@c.us") || chatId.includes("@g.us") || chatId.includes("@broadcast")) return chatId;
  let digits = chatId.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `${digits}@c.us`;
}

function withTimeout(promise, ms = 10000, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Root for all per-user session profiles. Each linked WhatsApp number gets
// whatsapp-sessions/<userId>/ — a full Chrome profile owned by LocalAuth.
const SESSIONS_ROOT = path.join(__dirname, "../../whatsapp-sessions");
// Pre-multi-session location. Migrated into SESSIONS_ROOT/<adminId> on first boot.
const LEGACY_SESSION_PATH = path.join(__dirname, "../../whatsapp-session");

class WhatsAppService {
  constructor(key) {
    this.key = String(key);
    this.client = null;
    this.qrCode = null;
    this.ready = false;
    this.phone = null;
    this.isInitializing = false;
    this.qrCallbacks = [];
    this.chatsCache = [];
    this.messagesCache = {};
    this.messagesFetchCache = {};
    this.lastChatsFetch = 0;
    this.chatsFetching = false;
    this._queue = Promise.resolve();
    this._sendQueue = Promise.resolve();
    this._lastSendAt = 0;
  }

  withTimeout(promise, ms = 10000, label = "operation") {
    return withTimeout(promise, ms, label);
  }

  get sessionPath() {
    return path.join(SESSIONS_ROOT, this.key);
  }

  // WhatsApp bans on the *aggregate* send rate of a number, not per campaign.
  // enqueue() serializes Puppeteer calls but doesn't throttle them, so three
  // concurrent campaigns each honouring their own 8s delay still triple the
  // rate on one phone. One gate on the session covers campaigns, AI replies,
  // automations, schedulers and manual sends alike.
  //
  // ponytail: fixed gap, not a token bucket — WA_MIN_SEND_GAP_MS is the
  // calibration knob. Swap for a bucket only if bursts need to be allowed.
  async _paceSend() {
    const gap = Number(process.env.WA_MIN_SEND_GAP_MS || 4000);
    const wait = gap - (Date.now() - this._lastSendAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this._lastSendAt = Date.now();
  }

  // whatsapp-web.js drives one shared Puppeteer page — overlapping calls
  // (chat polling, message fetch) race against each other on that page
  // and time out or throw under load. Serialize read calls through here.
  enqueue(fn) {
    const run = this._queue.then(fn, fn);
    this._queue = run.then(() => {}, () => {});
    return run;
  }

  // Dedicated fast queue for outbound sends so messages are never blocked behind slow contact scans
  enqueueSend(fn) {
    const run = this._sendQueue.then(fn, fn);
    this._sendQueue = run.then(() => {}, () => {});
    return run;
  }

  // Broadcasts real-time WhatsApp events across the shared team inbox and specific user rooms
  emitWaEvent(event, chatId, phone, message) {
    try {
      const app = require("../server");
      const io = app.get && app.get("io");
      if (io) {
        io.to(`user:${this.key}`).emit(event, { phone, chatId, message, sessionKey: this.key });
        io.emit(event, { phone, chatId, message, sessionKey: this.key });
      }
    } catch (_) {}
  }

  // Serializes every client-lifecycle transition (init / logout). These both
  // mutate the same LocalAuth profile directory — logout() deletes it outright —
  // so overlapping them left a live Puppeteer browser running against a deleted
  // profile, which shows up as "Attempted to use detached Frame" and can get the
  // freshly-linked device unlinked again.
  lifecycle(fn) {
    this._lifecycle = (this._lifecycle || Promise.resolve()).then(fn, fn);
    return this._lifecycle;
  }

  init(forceFresh = false) {
    return this.lifecycle(() => this._doInit(forceFresh));
  }

  async _doInit(forceFresh = false) {
    if (this.ready) return;
    if (this.isInitializing && !forceFresh) return;
    if (this.client && !forceFresh && !this.isInitializing && (this.ready || this.qrCode)) return;

    const sessionPath = this.sessionPath;
    // Clean up any stale/dead client instance before initializing a new one
    if (this.client) {
      try {
        await this.client.destroy().catch(() => {});
      } catch (_) {}
      this.client = null;
    }

    // Only wipe the saved session on an explicit reset (forceFresh). A normal
    // reconnect — e.g. after a server restart — must reuse the saved LocalAuth
    // session so the linked device stays connected until the user logs out,
    // instead of forcing a fresh QR scan every time the process restarts.
    if (forceFresh) {
      try {
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (_) {}
    }

    // Each live session is a headless Chrome holding WhatsApp Web (~350-500MB
    // RSS). On a multi-tenant VPS with 120+ tenants, LRU session hibernation
    // frees idle browser memory while preserving saved login tokens on disk.
    const maxSessions = Number(process.env.WA_MAX_SESSIONS || 15);
    const liveSessions = all().filter((s) => s !== this && s.client);
    if (liveSessions.length >= maxSessions) {
      // Find oldest idle session to hibernate
      const oldestIdle = liveSessions
        .filter((s) => s.ready && !s.isInitializing && !s._isSending)
        .sort((a, b) => (a.lastActiveAt || 0) - (b.lastActiveAt || 0))[0];

      if (oldestIdle) {
        console.log(`💤 [VPS Memory Optimizer] Hibernating idle session ${oldestIdle.key} to make room for session ${this.key}`);
        await oldestIdle.hibernate();
      } else {
        throw new Error(
          `Maximum of ${maxSessions} active WhatsApp browser sessions reached. Please use Meta Cloud API for high-volume bulk marketing.`
        );
      }
    }

    this.isInitializing = true;
    this._isHibernated = false;
    this.lastActiveAt = Date.now();
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const initTimer = setTimeout(() => {
      if (this.isInitializing && !this.ready && !this.qrCode) {
        console.warn("⚠️ WhatsApp Client init watchdog timeout — resetting state");
        this.isInitializing = false;
        if (this.client) {
          this.client.destroy().catch(() => {});
          this.client = null;
        }
      }
    }, 60000); // cold Chrome/Puppeteer launch + WhatsApp Web's JS bundle can legitimately take longer than 30s

    try {
      const execPath = getExecutablePath();
      if (execPath) {
        console.log(`ℹ️ WhatsApp Puppeteer using browser at: ${execPath}`);
      }

      const puppeteerOptions = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          // Memory/bandwidth trims — this is a headless automation profile,
          // none of these features are ever used.
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-default-browser-check",
          // NOTE: deliberately no --max-old-space-size cap here. WhatsApp Web's
          // own JS bundle is large; the previous 256MB old-space cap could OOM
          // the renderer mid-session, which surfaces as the
          // "Attempted to use detached Frame" crash seen in the logs.
        ],
      };
      if (execPath) puppeteerOptions.executablePath = execPath;

      // Pinned to a known-good pre-breakage WhatsApp Web build. Recent live
      // builds (2026-06-20 "ready never fires on session restore" and the
      // 2026-07-15 id._serialized -> id.$1 rename) broke whatsapp-web.js;
      // pinning avoids both instead of racing WhatsApp's frontend rollouts.
      //
      // ponytail: the pin is a calibration knob, not a constant — WhatsApp
      // unlinks a device right after a successful scan ("disconnected: LOGOUT")
      // when it decides the web build is too old, and with strict:true this pin
      // can never age out on its own. Override without a code edit:
      //   WA_WEB_VERSION=latest        -> let whatsapp-web.js negotiate the live build
      //   WA_WEB_VERSION=<build-id>    -> pin a different specific build
      const pinnedWebVersion = process.env.WA_WEB_VERSION || "latest";
      const clientOptions = {
        authStrategy: new LocalAuth({
          dataPath: sessionPath,
        }),
        puppeteer: puppeteerOptions,
      };
      if (pinnedWebVersion !== "latest") {
        clientOptions.webVersion = pinnedWebVersion;
        clientOptions.webVersionCache = {
          type: "local",
          path: path.join(__dirname, "../../whatsapp-webcache"),
          strict: false,
        };
      }
      console.log(`ℹ️ WhatsApp Web build: ${pinnedWebVersion === "latest" ? "live (not pinned)" : pinnedWebVersion}`);
      this.client = new Client(clientOptions);

      this.client.on("qr", (qr) => {
        clearTimeout(initTimer);
        this.qrCode = qr;
        this.ready = false;
        this.isInitializing = false;
        console.log("✅ WhatsApp QR Code generated successfully!");
        this.emitWaEvent("wa_qr", null, null, { qr });
        this.qrCallbacks.forEach((cb) => cb(qr));
        this.qrCallbacks = [];
      });

      this.client.on("ready", async () => {
        clearTimeout(initTimer);
        this.ready = true;
        this.qrCode = null;
        this.isInitializing = false;
        this.phone = this.client.info?.wid?.user || null;
        console.log(`✅ WhatsApp Client is Ready for phone: ${this.phone}`);

        try {
          const db = require("../config/database");
          await db.promise().query(
            `INSERT INTO wa_accounts (account_name, phone_number, connection_type, is_active, is_default)
             VALUES (?, ?, 'web_session', 1, 1)
             ON DUPLICATE KEY UPDATE
               account_name = VALUES(account_name),
               is_active = 1,
               updated_at = NOW()`,
            [`WhatsApp Web (${this.phone || 'Connected'})`, this.phone]
          );
        } catch (_) {}

        this.emitWaEvent("wa_ready", null, this.phone, { connected: true, phone: this.phone });

        (async () => {
          try {
            const res = await this.getChats(true);
            this.emitWaEvent("wa_chats_synced", null, this.phone, res);
          } catch (_) {}
          try {
            const res = await this.syncWhatsAppContacts();
            this.emitWaEvent("wa_contacts_synced", null, this.phone, res);
          } catch (_) {}
        })();
      });

      this.client.on("authenticated", () => {
        this.qrCode = null;
      });

      this.client.on("auth_failure", () => {
        this.ready = false;
        this.qrCode = null;
        this.pairingCode = null;
      });

      this.client.on("disconnected", (reason) => {
        this.ready = false;
        this.qrCode = null;
        this.pairingCode = null;
      });

      const handleLiveMessage = (msg) => {
        const chatId = msg.fromMe ? msg.to : msg.from;
        if (!chatId) return;
        const cleanPhone = chatId.replace(/\D/g, "");
        const rawFilename = msg._data?.filename || (/\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(msg.body || "") ? msg.body : "");
        const isMedia = Boolean(msg.hasMedia || msg.type === "document" || msg.type === "image" || msg.type === "video" || msg.type === "audio" || rawFilename);

        const liveMsg = {
          id: msg.id?.id || `msg_${Date.now()}`,
          serializedId: msg.id?._serialized || msg.id?.id,
          from: msg.from,
          to: msg.to,
          body: rawFilename || msg.body || (isMedia ? "📷 Media attachment" : ""),
          timestamp: msg.timestamp || Math.floor(Date.now() / 1000),
          isMe: Boolean(msg.fromMe),
          type: msg.type || (isMedia ? "document" : "text"),
          hasMedia: isMedia,
          filename: rawFilename || "",
          location: msg.type === "location" && msg.location
            ? { lat: msg.location.latitude, lng: msg.location.longitude, name: msg.location.description || "" }
            : null,
        };

        if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
        if (!this.messagesCache[chatId].some((m) => m.id === liveMsg.id)) {
          this.messagesCache[chatId].unshift(liveMsg);
          if (this.messagesCache[chatId].length > 200) {
            this.messagesCache[chatId].length = 200;
          }
        }
        delete this.messagesFetchCache[chatId];

        // 1. Emit live Socket event INSTANTLY (< 1ms)
        const eventName = msg.fromMe ? "wa_message_sent" : "wa_message_received";
        this.emitWaEvent(eventName, chatId, cleanPhone, liveMsg);
        this.emitWaEvent("wa_message", chatId, cleanPhone, liveMsg);

        // 2. Async DB log and bot automation in background (zero blocking)
        process.nextTick(async () => {
          try {
            const db = require("../config/database");
            await db.promise().query(
              `INSERT IGNORE INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, 'delivered', FROM_UNIXTIME(?))`,
              [
                this.key,
                cleanPhone,
                msg.fromMe ? "outbound" : "inbound",
                liveMsg.type,
                liveMsg.body,
                liveMsg.id,
                msg.timestamp || Math.floor(Date.now() / 1000)
              ]
            );

            // Update contact last message in CRM
            await db.promise().query(
              `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
               VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), ?)
               ON DUPLICATE KEY UPDATE
                 last_message_text = VALUES(last_message_text),
                 last_message_at = NOW()`,
              [
                msg.fromMe ? "Me" : (msg._data?.notifyName || `+${cleanPhone}`),
                cleanPhone,
                liveMsg.body,
                msg.fromMe ? 0 : 1
              ]
            ).catch(() => {});
          } catch (_) {}

          if (!msg.fromMe) {
            const bodyTrimmed = (msg.body || "").trim().toLowerCase();
            const OPT_OUT_WORDS = ["stop", "unsubscribe", "optout", "opt out", "stop promo", "cancel", "don't message", "dont message"];
            const isOptOut = OPT_OUT_WORDS.some((kw) => bodyTrimmed === kw || bodyTrimmed.startsWith(kw));

            if (isOptOut) {
              try {
                const db = require("../config/database");
                await db.promise().query(
                  "INSERT IGNORE INTO wa_opt_outs (phone, reason, opt_out_keyword) VALUES (?, 'user_request', ?)",
                  [cleanPhone, bodyTrimmed]
                );
                await db.promise().query(
                  "UPDATE wa_contacts SET is_unsubscribed=1, opt_in_status=0, updated_at=NOW() WHERE phone LIKE ?",
                  [`%${cleanPhone.slice(-10)}`]
                );
                await db.promise().query(
                  "UPDATE wa_campaign_messages SET status='opted_out', opt_out=1, error='User opted out' WHERE phone=? AND status='queued'",
                  [cleanPhone]
                );
                // Send polite unsubscribe confirmation
                await this.sendMessage(cleanPhone, "✅ You have been successfully unsubscribed. You will no longer receive promotional messages from us. Reply START anytime to re-subscribe.");
                return;
              } catch (_) {}
            }

            const interactiveReplyId = msg.selectedButtonId || msg.selectedRowId || msg.selectedListId || msg._data?.selectedButtonId || msg._data?.selectedRowId || null;
            const contactName = msg._data?.notifyName || msg.notifyName || null;

            // 1. Check if inbound message resolves a pending 2-way interactive confirmation
            const confirmationHandled = await require("./waConfirmationService").handleInboundConfirmation(cleanPhone, msg.body, interactiveReplyId, this.key).catch(() => false);
            if (confirmationHandled) return;

            // 2. Check if customer is requesting their bills / receipts (scoped strictly to their phone)
            const billHandled = await require("./waCustomerBillingService").handleInboundBillKeyword(cleanPhone, msg.body, this.key).catch(() => false);
            if (billHandled) return;

            const flowHandled = await require("./waFlowEngine").dispatchInbound(cleanPhone, msg.body, interactiveReplyId, this.key).catch(() => false);
            if (!flowHandled) {
              const handled = await require("./waMenuHandler").handleMenuReply(cleanPhone, { text: msg.body, buttonReplyId: interactiveReplyId }, this.key).catch(() => false);
              if (!handled) {
                const welcomeSent = await require("./waAutomationService").maybeSendWelcomeReply(cleanPhone, contactName, this.key).catch(() => false);
                if (!welcomeSent) {
                  await require("./waAiReply").maybeAutoReply(cleanPhone, msg.body, null, this.key).catch(() => {});
                }
              }
            }
          }
        });
      };

      const processedMsgIds = new Set();
      const safeHandleLiveMessage = (msg) => {
        const msgId = msg.id?._serialized || msg.id?.id || `${msg.from}_${msg.timestamp}`;
        if (processedMsgIds.has(msgId)) return;
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 1000) {
          const first = processedMsgIds.values().next().value;
          processedMsgIds.delete(first);
        }
        handleLiveMessage(msg);
      };

      this.client.on("message_create", safeHandleLiveMessage);
      this.client.on("message", (msg) => {
        if (!msg.fromMe) safeHandleLiveMessage(msg);
      });

      await this.client.initialize();
    } catch (err) {
      this.isInitializing = false;
      const deadClient = this.client;
      this.client = null;
      try { await deadClient?.destroy?.(); } catch (_) {}
      throw err;
    }
  }

  async sendMessage(chatId, message, options = {}) {
    const waCloud = require("./whatsappCloudApi");
    let cleanPhone = chatId.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    message = require("./mdToWa").toWhatsApp(message);
    const formattedJid = chatId.includes("@") ? chatId : `${cleanPhone}@c.us`;
    let msgId = "sent_" + Date.now();
    const quotedId = options?.quotedMessageId || options?.replyToMessageId || null;

    let sentResult = null;
    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const sendOpts = {};
        if (quotedId) {
          sendOpts.quotedMessageId = quotedId;
        }

        sentResult = await this.enqueueSend(() =>
          this.withTimeout(
            this.client.sendMessage(formattedJid, message, sendOpts),
            15000,
            "client.sendMessage direct"
          )
        ).catch(async (e) => {
          console.warn("⚠️ Direct send failed, attempting fallback to target JID:", e.message);
          const targetJid = await this.resolveTargetJid(cleanPhone).catch(() => null);
          const altJid = targetJid && targetJid !== formattedJid ? targetJid : `${cleanPhone.slice(-10)}@c.us`;
          return await this.enqueueSend(() =>
            this.withTimeout(
              this.client.sendMessage(altJid, message, sendOpts),
              12000,
              "client.sendMessage fallback"
            )
          ).catch(() => null);
        });
      } catch (err) {
        console.warn("⚠️ WhatsApp Web send error:", err.message);
      }
    }

    if (sentResult) {
      msgId = sentResult?.id?.id || sentResult?.id?._serialized || msgId;
    } else if (waCloud.isConfigured()) {
      console.log("⚡ Sending via Meta Cloud API for +", cleanPhone);
      try {
        const sent = await waCloud.sendText(cleanPhone, message);
        msgId = sent?.messages?.[0]?.id || msgId;
      } catch (cloudErr) {
        const errMsg = cloudErr.response?.data?.error?.message || cloudErr.message;
        console.error("Meta Cloud API sendText error:", errMsg);
        throw new Error(`Meta Cloud API error: ${errMsg}`);
      }
    } else {
      if (!this.ready || !this.client) {
        throw new Error("WhatsApp is not connected. Please configure Meta Cloud API or scan QR Code.");
      }
      throw new Error("Failed to deliver message via WhatsApp. Please check device internet connection.");
    }

    const newMsg = {
      id: msgId,
      serializedId: sentResult?.id?._serialized || msgId,
      from: "me",
      to: cleanPhone,
      body: message,
      replyToMessageId: quotedId,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      type: "text",
      status: "sent",
    };

    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    if (!this.messagesCache[chatId].some((m) => m.id === newMsg.id)) {
      this.messagesCache[chatId].unshift(newMsg);
    }
    delete this.messagesFetchCache[chatId];

    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, newMsg);

    process.nextTick(async () => {
      try {
        const db = require("../config/database");
        await db.promise().query(
          `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, reply_to_message_id, status, created_at)
           VALUES (?, ?, 'outbound', 'text', ?, ?, ?, 'sent', NOW())`,
          [this.key, cleanPhone, message, msgId, quotedId]
        );
        // Update contact last message in CRM
        await db.promise().query(
          `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status, last_message_text, last_message_at, unread_count)
           VALUES (?, ?, '91', 'WhatsApp Chat', 1, ?, NOW(), 0)
           ON DUPLICATE KEY UPDATE
             last_message_text = VALUES(last_message_text),
             last_message_at = NOW()`,
          ["Me", cleanPhone, message]
        ).catch(() => {});
      } catch (e) {}
    });

    return { success: true, id: msgId, result: sentResult };
  }

  async getStatus() {
    if (!this.ready && this.client) {
      try {
        const state = await this.enqueue(() =>
          this.withTimeout(this.client.getState(), 3000, "getState")
        ).catch(() => null);

        if (state === "CONNECTED") {
          this.ready = true;
          this.qrCode = null;
          this.isInitializing = false;
          this.phone = this.client.info?.wid?.user || this.phone || null;
          console.log(`✅ WhatsApp Client detected CONNECTED state! Phone: ${this.phone}`);
          this.emitWaEvent("wa_ready", null, this.phone, { connected: true, phone: this.phone });

          // Trigger background sync for contacts & chat history if not already triggered
          setTimeout(() => {
            this.syncWhatsAppContacts().catch(() => {});
            this.syncWhatsAppChatsAndMessages().catch(() => {});
          }, 1000);
        }
      } catch (_) {}
    }

    return {
      connected: this.ready,
      phone: this.phone || null,
      initializing: this.isInitializing,
      hasQr: !!this.qrCode,
      qr: this.qrCode || null,
    };
  }

  // Hibernates idle browser process while keeping saved LocalAuth profile on disk
  async hibernate() {
    if (!this.client) return;
    console.log(`💤 [VPS RAM Saver] Hibernating idle WhatsApp Web session ${this.key}`);
    const deadClient = this.client;
    this.client = null;
    this.isInitializing = false;
    this._isHibernated = true;
    try {
      await deadClient.destroy().catch(() => {});
    } catch (_) {}
  }

  // Tears down a dead/crashed client and schedules a reconnect.
  // Called from the "disconnected" event and from server.js's crash guard —
  // whatsapp-web.js/puppeteer occasionally throws unhandled navigation-timing
  // errors deep inside the library, outside any of its own event handlers.
  forceReset(reason = "unknown") {
    console.warn(`⚠️ WhatsApp Web session force-reset (${reason})`);
    const deadClient = this.client;
    this.ready = false;
    this.qrCode = null;
    this.phone = null;
    this.isInitializing = false;
    this.client = null;
    try { deadClient?.destroy?.().catch(() => {}); } catch (_) {}

    if (this._reconnectScheduled) return;
    this._reconnectScheduled = true;
    setTimeout(() => {
      this._reconnectScheduled = false;
      if (!this.ready && !this.isInitializing) {
        console.log("🔄 Auto-reconnecting WhatsApp Web session in background...");
        this.init(false).catch(() => {});
      }
    }, 10000);
  }

  async getUnifiedStatus() {
    const waCloud = require("./whatsappCloudApi");
    const cloudConfigured = waCloud.isConfigured();
    const status = await this.getStatus();
    const webConnected = status.connected;

    let activeEngine = "Disconnected";
    if (cloudConfigured && webConnected) activeEngine = "Dual (Cloud API + Web)";
    else if (cloudConfigured) activeEngine = "Meta Cloud API";
    else if (webConnected) activeEngine = "WhatsApp Web Session";

    const activePhone = (webConnected ? this.phone : null) || waCloud.displayPhoneNumber || (cloudConfigured ? waCloud.phoneNumberId : null);

    return {
      connected: cloudConfigured || webConnected,
      isCloud: cloudConfigured,
      isWeb: webConnected,
      activeEngine,
      phone: activePhone,
      qr: status.qr || this.qrCode || null,
      web: {
        connected: webConnected,
        phone: this.phone || null,
        initializing: this.isInitializing,
        hasQr: !!this.qrCode,
        qr: this.qrCode || null,
      },
      cloud: waCloud.getConfig(),
    };
  }

  async sendTestMessage(targetPhone, text = "Hello! This is a test message from ACHME CRM WhatsApp Engine.", enginePreference = null) {
    const waCloud = require("./whatsappCloudApi");
    const formattedPhone = targetPhone.replace(/\D/g, "");
    if (!formattedPhone) throw new Error("Valid phone number required");

    if (enginePreference === "web" || (this.ready && enginePreference !== "cloud_api" && enginePreference !== "meta")) {
      const chatId = `${formattedPhone}@c.us`;
      const res = await this.sendMessage(chatId, text);
      return { success: true, engineUsed: `WhatsApp Web (+${this.phone || "Own Number"})`, response: res };
    } else if (waCloud.isConfigured()) {
      const res = await waCloud.sendText(formattedPhone, text);
      return { success: true, engineUsed: "Meta Cloud API", response: res };
    } else if (this.ready) {
      const chatId = `${formattedPhone}@c.us`;
      const res = await this.sendMessage(chatId, text);
      return { success: true, engineUsed: `WhatsApp Web (+${this.phone || "Own Number"})`, response: res };
    } else {
      throw new Error("No active WhatsApp engine available. Please scan QR Code or configure Meta Cloud API.");
    }
  }

  async getPairingCode(phone) {
    if (!phone) throw new Error("Phone number is required");
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) throw new Error("Please enter a valid phone number with country code (e.g. 919876543210)");

    if (!this.client || (!this.isInitializing && !this.ready)) {
      await this.init(true);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Pairing code generation timed out. Please try QR Code instead.")), 35000);
      const interval = setInterval(async () => {
        try {
          if (this.client && typeof this.client.requestPairingCode === "function") {
            clearInterval(interval);
            clearTimeout(timer);
            const code = await this.client.requestPairingCode(cleanPhone);
            console.log("✅ WhatsApp Pairing Code generated:", code);
            resolve(code);
          }
        } catch (e) {
          clearInterval(interval);
          clearTimeout(timer);
          reject(e);
        }
      }, 500);
    });
  }

  async getQr(timeout = 12000) {
    if (this.qrCode) return this.qrCode;
    if (this.ready) return null; // already connected via a restored session — no QR needed

    if (!this.client || (!this.isInitializing && !this.ready && !this.qrCode)) {
      this.init(false).catch((err) => {
        console.warn("⚠️ WhatsApp init error in getQr:", err?.message || err);
      });
    }

    return new Promise((resolve, reject) => {
      const checkTimer = setInterval(() => {
        if (this.qrCode) {
          clearInterval(checkTimer);
          clearTimeout(timeoutTimer);
          return resolve(this.qrCode);
        }
        if (this.ready) {
          // saved session was restored directly — connected without needing a new QR
          clearInterval(checkTimer);
          clearTimeout(timeoutTimer);
          return resolve(null);
        }
      }, 200);

      const timeoutTimer = setTimeout(() => {
        clearInterval(checkTimer);
        const idx = this.qrCallbacks.indexOf(resolve);
        if (idx !== -1) this.qrCallbacks.splice(idx, 1);
        if (this.isInitializing) {
          return resolve(this.qrCode || null);
        }
        reject(new Error("QR code generation timed out. Please click Get QR Code to try again."));
      }, timeout);

      this.qrCallbacks.push((qr) => {
        clearInterval(checkTimer);
        clearTimeout(timeoutTimer);
        resolve(qr);
      });
    });
  }

  // CRM fallback contacts barely change minute-to-minute — cache them for 5
  // minutes unless forceRefresh is requested.
  async getCrmFallbackContacts(force = false) {
    const now = Date.now();
    if (!force && this._crmCache && now - (this._crmCacheAt || 0) < 5 * 60 * 1000) {
      return this._crmCache;
    }

    const db = require("../config/database");
    const contactsMap = new Map();
    const sources = [
      ["clients", "COALESCE(NULLIF(TRIM(name), ''), NULLIF(TRIM(company_name), ''), 'Client')", "phone", "Client"],
      ["telecalls", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Lead')", "mobile_number", "Telecalling"],
      ["walkins", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Walkin')", "mobile_number", "Walkin"],
      ["fields", "COALESCE(NULLIF(TRIM(customer_name), ''), NULLIF(TRIM(company_name), ''), 'Field')", "mobile_number", "Field"],
    ];

    try {
      for (const [table, nameExpr, phoneCol, label] of sources) {
        const [rows] = await db.promise().query(
          `SELECT ${nameExpr} as name, ${phoneCol} as phone FROM ${table} WHERE ${phoneCol} IS NOT NULL AND ${phoneCol} != '' ORDER BY id DESC LIMIT 500`
        );
        rows.forEach((c) => {
          const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
          if (cleanPhone.length === 10 && !contactsMap.has(cleanPhone)) {
            contactsMap.set(cleanPhone, { name: c.name, phone: cleanPhone, source: label });
          }
        });
      }

      const [waContacts] = await db.promise().query(
        "SELECT name, phone, source FROM wa_contacts WHERE is_blocked = 0 ORDER BY id DESC LIMIT 500"
      );
      waContacts.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (cleanPhone.length === 10) {
          if (!contactsMap.has(cleanPhone) || contactsMap.get(cleanPhone).name.startsWith("+")) {
            contactsMap.set(cleanPhone, { name: c.name || `+91 ${cleanPhone}`, phone: cleanPhone, source: c.source || "WhatsApp Contact" });
          }
        }
      });
    } catch (e) {
      console.error("CRM contacts load error:", e.message);
    }

    const contacts = Array.from(contactsMap.values());
    this._crmCache = contacts;
    this._crmCacheAt = now;
    return contacts;
  }

  async getChats(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && now - this.lastChatsFetch < 10000 && this.chatsCache.length > 0) {
      return this.chatsCache;
    }
    if (this.chatsFetching && this.chatsCache.length > 0 && !forceRefresh) return this.chatsCache;
    this.chatsFetching = true;

    const chatMap = new Map();
    const phoneToChatId = new Map();

    // 1. Fetch live chats from WhatsApp Web if connected
    if (this.ready && this.client) {
      try {
        let chats = await this.enqueue(() => this.withTimeout(this.client.getChats(), 4000, "WhatsApp Web getChats")).catch(() => []);

        (chats || []).forEach((c) => {
          const chatId = c.id?._serialized || String(c.id);
          const cleanPhone = (c.id?.user || "").replace(/\D/g, "").slice(-10);
          if (cleanPhone && cleanPhone.length === 10) {
            phoneToChatId.set(cleanPhone, chatId);
          }
          chatMap.set(chatId, {
            id: chatId,
            name: c.name || c.id?.user || "Unknown",
            unreadCount: c.unreadCount || 0,
            timestamp: c.timestamp || Math.floor(Date.now() / 1000),
            isPinned: Boolean(c.pinned || c.isPinned),
            isGroup: Boolean(c.isGroup || (chatId && chatId.includes("@g.us"))),
            isMuted: Boolean(c.isMuted),
            lastMessage: c.lastMessage
              ? {
                  body: describeLastMessage(c.lastMessage),
                  timestamp: c.lastMessage.timestamp,
                  fromMe: Boolean(c.lastMessage.fromMe),
                }
              : null,
            hasMessages: true,
          });
        });
      } catch (err) {
        console.error("WhatsApp Web fetch chats error:", err.message);
      }
    }

    // 2. Merge recent message activity for THIS active session (session_key = this.key or general/webhook)
    try {
      const db = require("../config/database");
      const [recentLogs] = await db.promise().query(
        `SELECT phone, direction, message_text, created_at, wa_message_id
         FROM wa_message_logs
         WHERE session_key = ? OR session_key IS NULL OR session_key = '1' OR session_key = 'default'
         ORDER BY id DESC LIMIT 500`,
        [this.key]
      );

      recentLogs.forEach((log) => {
        const cleanPhone = (log.phone || "").replace(/\D/g, "").slice(-10);
        if (!cleanPhone || cleanPhone.length < 10) return;
        const chatId = `91${cleanPhone}@c.us`;
        const logTime = Math.floor(new Date(log.created_at).getTime() / 1000);

        if (chatMap.has(chatId)) {
          const existing = chatMap.get(chatId);
          if (!existing.lastMessage || (logTime > (existing.lastMessage.timestamp || 0))) {
            existing.lastMessage = { body: log.message_text || "", timestamp: logTime, fromMe: log.direction === "outbound" };
            if (logTime > (existing.timestamp || 0)) {
              existing.timestamp = logTime;
            }
          }
        } else if (!this.ready) {
          // When client is offline, display historical session conversation logs for this session key
          chatMap.set(chatId, {
            id: chatId,
            name: `+91 ${cleanPhone}`,
            unreadCount: 0,
            timestamp: logTime,
            lastMessage: { body: log.message_text || "", timestamp: logTime, fromMe: log.direction === "outbound" },
            hasMessages: true,
          });
          phoneToChatId.set(cleanPhone, chatId);
        }
      });

      // 2b. Also include recent active contacts from wa_contacts when using Meta Cloud API or offline web
      const [recentContacts] = await db.promise().query(
        `SELECT name, phone, last_message_text, last_message_at, unread_count, profile_pic_url, avatar_url
         FROM wa_contacts
         WHERE is_blocked = 0
         ORDER BY COALESCE(last_message_at, updated_at, created_at) DESC LIMIT 100`
      ).catch(() => [[]]);

      recentContacts.forEach((c) => {
        const cleanPhone = (c.phone || "").replace(/\D/g, "").slice(-10);
        if (!cleanPhone || cleanPhone.length < 10) return;
        const chatId = `91${cleanPhone}@c.us`;
        const logTime = c.last_message_at ? Math.floor(new Date(c.last_message_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
        if (!chatMap.has(chatId)) {
          chatMap.set(chatId, {
            id: chatId,
            name: c.name || `+91 ${cleanPhone}`,
            unreadCount: c.unread_count || 0,
            timestamp: logTime,
            profilePicUrl: c.profile_pic_url || c.avatar_url || null,
            lastMessage: c.last_message_text ? { body: c.last_message_text, timestamp: logTime, fromMe: false } : null,
            hasMessages: Boolean(c.last_message_text),
          });
          phoneToChatId.set(cleanPhone, chatId);
        } else {
          const existing = chatMap.get(chatId);
          if (c.profile_pic_url || c.avatar_url) {
            existing.profilePicUrl = c.profile_pic_url || c.avatar_url;
          }
        }
      });
    } catch (e) {
      console.error("Fast DB chat fetch error:", e.message);
    }

    // 3. Enrich contact names & profile pictures for session chats
    if (phoneToChatId.size > 0) {
      try {
        const db = require("../config/database");
        const phones = Array.from(phoneToChatId.keys());
        if (phones.length > 0) {
          const [waContacts] = await db.promise().query(
            `SELECT name, phone, profile_pic_url, avatar_url FROM wa_contacts WHERE (${phones.map(() => "phone LIKE ?").join(" OR ")})`,
            phones.map((p) => `%${p}`)
          );

          (waContacts || []).forEach((c) => {
            const clean = (c.phone || "").replace(/\D/g, "").slice(-10);
            if (phoneToChatId.has(clean)) {
              const chatId = phoneToChatId.get(clean);
              const chat = chatMap.get(chatId);
              if (chat) {
                if (c.name && (!chat.name || chat.name.startsWith("+") || chat.name === "Unknown")) {
                  chat.name = c.name;
                }
                if (c.profile_pic_url || c.avatar_url) {
                  chat.profilePicUrl = c.profile_pic_url || c.avatar_url;
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Enrich session contact names error:", err.message);
      }
    }

    const finalChats = Array.from(chatMap.values());
    finalChats.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

    this.chatsCache = finalChats;
    this.lastChatsFetch = now;
    this.chatsFetching = false;
    return this.chatsCache;
  }

  async getProfilePicUrl(chatId) {
    if (!chatId) return null;
    const cleanPhone = String(chatId).replace(/\D/g, "").slice(-10);
    const db = require("../config/database");

    // 1. Check in wa_contacts DB first
    try {
      const [rows] = await db.promise().query(
        "SELECT profile_pic_url, avatar_url FROM wa_contacts WHERE phone LIKE ? LIMIT 1",
        [`%${cleanPhone}`]
      );
      if (rows[0] && (rows[0].profile_pic_url || rows[0].avatar_url)) {
        return rows[0].profile_pic_url || rows[0].avatar_url;
      }
    } catch (_) {}

    // 2. Fetch live from WhatsApp Web client if connected
    if (this.ready && this.client) {
      try {
        const fullChatId = chatId.includes("@") ? chatId : `91${cleanPhone}@c.us`;
        const picUrl = await this.enqueue(() =>
          this.withTimeout(this.client.getProfilePicUrl(fullChatId), 4000, "getProfilePicUrl")
        ).catch(() => null);

        if (picUrl) {
          await db.promise().query(
            "UPDATE wa_contacts SET profile_pic_url = ? WHERE phone LIKE ?",
            [picUrl, `%${cleanPhone}`]
          ).catch(() => {});
          return picUrl;
        }
      } catch (_) {}
    }

    return null;
  }

  async getMessages(chatId, forceRefresh = false, limit = 10) {
    const now = Date.now();
    const numericLimit = (limit === "all" || !limit) ? 250 : parseInt(limit, 10) || 10;
    const cacheKey = `${chatId}_${numericLimit}`;

    const digitsOnly = chatId.replace(/\D/g, "");
    const clean10 = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

    // 1. Fast DB message fetch (< 5ms response time)
    const dbMsgs = [];
    try {
      const db = require("../config/database");
      const dbLimit = Math.max(numericLimit, 50);
      const [rows] = await db.promise().query(
        `SELECT id, phone, direction, message_type, message_text as body, created_at, wa_message_id
         FROM wa_message_logs
         WHERE (session_key = ? OR session_key IS NULL OR session_key = '1' OR session_key = 'default')
           AND (phone LIKE ? OR phone LIKE ? OR phone LIKE ? OR phone = ?)
         ORDER BY created_at DESC LIMIT ?`,
        [this.key, `%${clean10}%`, `%${digitsOnly}%`, `%${chatId}%`, digitsOnly, dbLimit]
      );
      rows.forEach((r) => {
        const isFile = (r.message_type && r.message_type !== "text" && r.message_type !== "location") || /\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(r.body || "");
        dbMsgs.push({
          id: r.wa_message_id || `db_${r.id}`,
          from: r.direction === "inbound" ? r.phone : "me",
          body: r.body || (r.message_type === "media" ? "📎 Attachment" : r.message_type === "location" ? "📍 Location" : ""),
          timestamp: Math.floor(new Date(r.created_at).getTime() / 1000),
          isMe: r.direction === "outbound",
          hasMedia: Boolean(isFile),
          type: r.message_type || (isFile ? "document" : "text"),
          filename: r.body || "",
        });
      });
    } catch (e) {
      console.error("DB message fetch error:", e.message);
    }

    let liveMsgs = this.messagesCache[chatId] || [];

    // 2. Non-blocking background fetch if empty or forceRefresh to keep UI ultra-fast (< 5ms)
    if (this.ready && this.client && (forceRefresh || (!liveMsgs.length && dbMsgs.length === 0))) {
      process.nextTick(async () => {
        try {
          const formattedChatId = formatChatJid(chatId);
          let chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(formattedChatId), 3000, "WhatsApp Web getChatById")).catch(() => null);
          if (!chat && formattedChatId !== chatId) {
            chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(chatId), 2500, "WhatsApp Web getChatById fallback")).catch(() => null);
          }
          if (chat) {
            const fetchLimit = Math.max(numericLimit, 50);
            const msgs = await this.enqueue(() => this.withTimeout(chat.fetchMessages({ limit: fetchLimit }), 3000, "WhatsApp Web fetchMessages")).catch(() => []);
            const freshLive = msgs.map((m) => {
              const filename = m._data?.filename || (/\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|png|jpg|jpeg|webp|mp4|mp3|ogg|wav)$/i.test(m.body || "") ? m.body : "");
              const isMedia = Boolean(m.hasMedia || m.type === "document" || m.type === "image" || m.type === "video" || m.type === "audio" || filename);
              return {
                id: m.id.id,
                serializedId: m.id._serialized || m.id.id,
                from: m.from,
                body: filename || describeLastMessage(m) || m.body || "",
                timestamp: m.timestamp,
                isMe: m.fromMe,
                type: m.type || (isMedia ? "document" : "text"),
                hasMedia: isMedia,
                filename: filename || "",
                location: m.type === "location" && m.location
                  ? { lat: m.location.latitude, lng: m.location.longitude, name: m.location.description || "" }
                  : null,
              };
            });
            if (freshLive.length) {
              this.messagesCache[chatId] = freshLive;

              // Auto-persist loaded chat messages into wa_message_logs DB
              const db = require("../config/database");
              for (const m of freshLive) {
                await db.promise().query(
                  `INSERT IGNORE INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, 'sent', FROM_UNIXTIME(?))`,
                  [
                    this.key,
                    digitsOnly,
                    m.isMe ? "outbound" : "inbound",
                    m.hasMedia ? (m.type || "media") : "text",
                    m.body || describeLastMessage(m) || "",
                    m.id,
                    m.timestamp || Math.floor(Date.now() / 1000)
                  ]
                ).catch(() => {});
              }
              this.emitWaEvent("wa_chat_history_updated", chatId, digitsOnly, { count: freshLive.length });
            }
          }
        } catch (_) {}
      });
    }

    const msgMap = new Map();
    liveMsgs.forEach((m) => msgMap.set(m.id, m));
    dbMsgs.forEach((m) => {
      if (!msgMap.has(m.id)) {
        msgMap.set(m.id, m);
      }
    });

    const allMsgs = Array.from(msgMap.values());
    allMsgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const sliced = (limit === "all") ? allMsgs : allMsgs.slice(0, numericLimit);
    this.messagesFetchCache[cacheKey] = { data: sliced, at: now };
    return sliced;
  }

  async sendSeen(chatId) {
    if (!chatId) return { success: false };
    try {
      const cleanPhone = chatId.replace(/\D/g, "").slice(-10);
      const digitsOnly = chatId.replace(/\D/g, "");

      // 1. WhatsApp Web mark as seen
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        await this.enqueue(async () => {
          try {
            if (this.client.sendSeen) {
              await this.withTimeout(this.client.sendSeen(formattedChatId), 2000, "sendSeen").catch(() => {});
            }
            const chat = await this.client.getChatById(formattedChatId).catch(() => null);
            if (chat && chat.sendSeen) {
              await this.withTimeout(chat.sendSeen(), 2000, "chat.sendSeen").catch(() => {});
            }
          } catch (_) {}
        }).catch(() => {});
      }

      // 2. Clear unread in database
      const db = require("../config/database");
      await db.promise().query(
        "UPDATE wa_contacts SET unread_count = 0 WHERE phone LIKE ? OR phone LIKE ?",
        [`%${cleanPhone}`, `%${digitsOnly}`]
      ).catch(() => {});

      await db.promise().query(
        "UPDATE wa_message_logs SET is_read = 1 WHERE (phone LIKE ? OR phone LIKE ?) AND direction = 'inbound'",
        [`%${cleanPhone}`, `%${digitsOnly}`]
      ).catch(() => {});

      // 3. Emit real-time read event to UI
      this.emitWaEvent("wa_chat_read", chatId, digitsOnly, { unreadCount: 0 });
      return { success: true, chatId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendReaction(chatId, messageId, emoji) {
    if (!chatId || !messageId) return { success: false };
    try {
      if (this.ready && this.client) {
        const formattedChatId = formatChatJid(chatId);
        const chat = await this.client.getChatById(formattedChatId).catch(() => null);
        if (chat) {
          const msgs = await chat.fetchMessages({ limit: 20 }).catch(() => []);
          const target = msgs.find((m) => m.id?.id === messageId || m.id?._serialized === messageId);
          if (target && target.react) {
            await target.react(emoji);
            return { success: true };
          }
        }
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async getContactBalance(phone) {
    if (!phone) return { phone: "", clientName: "N/A", companyName: "N/A", source: "Unknown", totalInvoiced: 0, totalPaid: 0, pendingBalance: 0 };
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const fullPhone = phone.replace(/\D/g, "");
    const db = require("../config/database");

    let clientName = "";
    let companyName = "";
    let source = "WhatsApp Contact";

    try {
      const [clients] = await db.promise().query(
        "SELECT id, name, company_name FROM clients WHERE phone LIKE ? OR phone LIKE ? LIMIT 1",
        [`%${cleanPhone}`, `%${fullPhone}`]
      ).catch(() => [[]]);
      if (clients && clients.length > 0) {
        clientName = clients[0].name || "";
        companyName = clients[0].company_name || clients[0].name || "";
        source = "Client";
      } else {
        const [telecalls] = await db.promise().query(
          "SELECT customer_name, company_name FROM telecalls WHERE mobile_number LIKE ? LIMIT 1",
          [`%${cleanPhone}`]
        ).catch(() => [[]]);
        if (telecalls && telecalls.length > 0) {
          clientName = telecalls[0].customer_name || "";
          companyName = telecalls[0].company_name || telecalls[0].customer_name || "";
          source = "Telecalling";
        }
      }
    } catch (_) {}

    let totalInvoiced = 0;
    let totalPaid = 0;
    let pendingBalance = 0;

    const searchComp = companyName || clientName;
    if (searchComp) {
      try {
        const [invRows] = await db.promise().query(
          `SELECT i.id, 
                  COALESCE((SELECT SUM(qty * rate) FROM clientinvoice_items WHERE invoice_id = i.id), 0) as inv_total,
                  COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.id), 0) as paid_total
           FROM clientinvoices i
           WHERE i.client_company = ? OR i.customer_name = ?`,
          [searchComp, clientName]
        ).catch(() => [[]]);

        if (invRows && invRows.length) {
          invRows.forEach(r => {
            totalInvoiced += Number(r.inv_total || 0);
            totalPaid += Number(r.paid_total || 0);
          });
          pendingBalance = Math.max(0, totalInvoiced - totalPaid);
        }
      } catch (e) {
        console.error("Balance query error:", e.message);
      }
    }

    return {
      phone: cleanPhone,
      clientName: clientName || `+91 ${cleanPhone}`,
      companyName: companyName || clientName || "N/A",
      source,
      totalInvoiced,
      totalPaid,
      pendingBalance,
    };
  }

  async getAccountBalance() {
    const db = require("../config/database");
    let totalSent = 0;
    let todaySent = 0;
    let totalDelivered = 0;
    let totalFailed = 0;

    try {
      const [[r1]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE direction = 'outbound'");
      totalSent = r1?.cnt || 0;

      const [[r2]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE direction = 'outbound' AND DATE(created_at) = CURDATE()");
      todaySent = r2?.cnt || 0;

      const [[r3]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE status = 'delivered'");
      totalDelivered = r3?.cnt || 0;

      const [[r4]] = await db.promise().query("SELECT COUNT(*) as cnt FROM wa_message_logs WHERE status = 'failed'");
      totalFailed = r4?.cnt || 0;
    } catch (_) {}

    const unifiedStatus = await this.getUnifiedStatus().catch(() => ({ connected: false, activeEngine: "Unknown" }));

    return {
      connected: unifiedStatus.connected,
      activeEngine: unifiedStatus.activeEngine,
      phone: this.phone || null,
      totalSent,
      todaySent,
      totalDelivered,
      totalFailed,
      status: "Active",
    };
  }

  // Fails fast instead of hanging until nginx/the browser gives up with an
  // opaque 504 — whatsapp-web.js occasionally stalls on a slow/first-contact
  // Store lookup, especially on the pinned older WhatsApp Web build.
  withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async resolveTargetJid(cleanPhone) {
    if (!cleanPhone) return "";
    const digits = cleanPhone.replace(/\D/g, "");
    const formattedJid = digits.length === 10 ? `91${digits}@c.us` : `${digits}@c.us`;

    if (!this.ready || !this.client) return formattedJid;
    try {
      const contact = await this.enqueue(() =>
        this.withTimeout(this.client.getNumberId(digits), 3000, "WhatsApp getNumberId")
      ).catch(() => null);
      if (contact && contact._serialized) {
        return contact._serialized;
      }
    } catch (_) {}
    return formattedJid;
  }



  async sendReaction(chatId, messageId, emoji) {
    const cleanPhone = chatId.replace(/\D/g, "");
    if (!messageId || !emoji) throw new Error("messageId and emoji are required");

    let success = false;
    if (this.ready && this.client) {
      try {
        await this._paceSend();
        const msg = await this.enqueue(() =>
          this.withTimeout(this.client.getMessageById(messageId), 5000, "getMessageById for reaction")
        ).catch(() => null);

        if (msg && typeof msg.react === "function") {
          await this.enqueue(() => this.withTimeout(msg.react(emoji), 5000, "react"));
          success = true;
        }
      } catch (err) {
        console.warn("Reaction send error:", err.message);
      }
    }

    // Persist reaction into wa_reactions
    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_reactions (wa_message_id, phone, emoji, sender_type)
         VALUES (?, ?, ?, 'agent')`,
        [messageId, cleanPhone, emoji]
      );
    } catch (e) {
      console.error("DB log reaction error:", e.message);
    }

    this.emitWaEvent("wa_reaction_updated", chatId, cleanPhone, { messageId, emoji, senderType: "agent" });
    return { success: true, messageId, emoji };
  }

  // Returns a URL under /uploads, not base64. The old version re-fetched up to
  // 250 messages through the shared Puppeteer page on *every* render of *every*
  // media bubble, all serialized behind one enqueue chain — ten images in view
  // meant ten full chat scans and a frozen UI. Now: resolve the message
  // directly, download once, cache to disk, and let the browser HTTP-cache it.
  async getMediaForMessage(chatId, messageId, serializedId) {
    const cacheDir = path.join(__dirname, "..", "uploads", "wa-media", this.key);
    const safeId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, "");

    // Cache hit: no Puppeteer at all.
    try {
      const hit = fs.readdirSync(cacheDir).find((f) => f.startsWith(safeId + "."));
      if (hit) return { url: `/uploads/wa-media/${this.key}/${hit}`, filename: hit };
    } catch (_) {}

    if (!this.ready || !this.client) throw new Error("WhatsApp Web session not connected");

    let msg = null;
    // getMessageById is O(1) against the Store; the chat scan below is the
    // fallback for rows logged before serializedId was recorded.
    if (serializedId) {
      msg = await this.enqueue(() =>
        this.withTimeout(this.client.getMessageById(serializedId), 10000, "getMessageById")
      ).catch(() => null);
    }
    if (!msg) {
      const formattedChatId = formatChatJid(chatId);
      const chat = await this.enqueue(() => this.withTimeout(this.client.getChatById(formattedChatId), 15000, "getChatById"));
      const msgs = await this.enqueue(() => this.withTimeout(chat.fetchMessages({ limit: 100 }), 15000, "fetchMessages"));
      msg = msgs.find((m) => m.id.id === messageId || m.id._serialized === messageId);
    }
    if (!msg || !msg.hasMedia) throw new Error("Message not found or has no media");

    const media = await this.enqueue(() => this.withTimeout(msg.downloadMedia(), 20000, "downloadMedia"));
    if (!media) throw new Error("Media could not be downloaded");

    const ext = (media.mimetype || "application/octet-stream").split("/")[1]?.split(";")[0] || "bin";
    const filename = `${safeId}.${ext}`;
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, filename), Buffer.from(media.data, "base64"));

    return {
      url: `/uploads/wa-media/${this.key}/${filename}`,
      filename: media.filename || filename,
      mimetype: media.mimetype,
    };
  }

  async sendMediaMessage(chatId, mediaUrl, mediaType = "document", caption = "", filename = "") {
    const waCloud = require("./whatsappCloudApi");
    let cleanPhone = chatId.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    let targetJid = `${cleanPhone}@c.us`;
    let msgId = "sent_" + Date.now();

    if (this.ready && this.client) {
      try {
        await this._paceSend();
        targetJid = await this.resolveTargetJid(cleanPhone);
        const media = await MessageMedia.fromUrl(mediaUrl, { unsafeMime: true, filename: filename || undefined });
        if (filename && !media.filename) {
          media.filename = filename;
        }

        let sendOpts = {};
        const isDoc = mediaType === "document" || ["pdf", "xls", "xlsx", "csv", "doc", "docx", "ppt", "pptx", "excel"].includes(mediaType) || (filename && !["image", "video", "audio"].includes(mediaType));
        if (mediaType === "audio" || mediaType === "voice" || mediaType === "ptt") {
          sendOpts = { sendAudioAsVoice: false };
        } else if (isDoc) {
          sendOpts = { sendMediaAsDocument: true, caption: caption || undefined };
        } else {
          sendOpts = { caption: caption || undefined };
        }

        const sent = await this.enqueue(() => this.withTimeout(
          this.client.sendMessage(targetJid, media, sendOpts),
          30000,
          "WhatsApp Web send media"
        ));
        msgId = sent?.id?.id || msgId;
      } catch (e) {
        console.error("WhatsApp Web sendMediaMessage error:", e.message);
        if (waCloud.isConfigured()) {
          const sent = await waCloud.sendMedia(cleanPhone, mediaType, mediaUrl, caption, filename);
          msgId = sent?.messages?.[0]?.id || msgId;
        } else if (e.message && (e.message.includes("No LID") || e.message.includes("LID"))) {
          throw new Error(`Phone number +${cleanPhone} is not registered on WhatsApp or requires Meta Cloud API.`);
        } else {
          throw new Error(`WhatsApp Web error: ${e.message}`);
        }
      }
    } else if (waCloud.isConfigured()) {
      const sent = await waCloud.sendMedia(cleanPhone, mediaType, mediaUrl, caption, filename);
      msgId = sent?.messages?.[0]?.id || msgId;
    } else {
      throw new Error("WhatsApp not connected. Please scan QR Code or configure Meta Cloud API.");
    }

    const logText = filename || caption || `[${mediaType}]`;
    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
         VALUES (?, ?, 'outbound', ?, ?, ?, 'sent', NOW())`,
        [this.key, cleanPhone, mediaType || "document", logText, msgId]
      );
    } catch (e) {
      console.error("DB log outbound media error:", e.message);
    }
    delete this.messagesFetchCache[chatId];

    const mediaMsg = {
      id: msgId,
      from: "me",
      to: cleanPhone,
      body: logText,
      caption: caption || "",
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      hasMedia: true,
      type: mediaType || "document",
      mediaUrl: mediaUrl,
      filename: filename || logText,
    };
    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    this.messagesCache[chatId].unshift(mediaMsg);
    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, mediaMsg);

    return { success: true, id: msgId };
  }

  async sendLocationMessage(chatId, lat, lng, name = "") {
    const waCloud = require("./whatsappCloudApi");
    let cleanPhone = chatId.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    let targetJid = `${cleanPhone}@c.us`;
    let msgId = "sent_" + Date.now();

    if (this.ready && this.client) {
      try {
        await this._paceSend();
        targetJid = await this.resolveTargetJid(cleanPhone);
        const location = new Location(lat, lng, { name });
        const sent = await this.enqueue(() => this.withTimeout(
          this.client.sendMessage(targetJid, location),
          25000,
          "WhatsApp Web send location"
        ));
        msgId = sent?.id?.id || msgId;
      } catch (e) {
        console.error("WhatsApp Web sendLocationMessage error:", e.message);
        if (waCloud.isConfigured()) {
          const sent = await waCloud.sendLocation(cleanPhone, lat, lng, name);
          msgId = sent?.messages?.[0]?.id || msgId;
        } else if (e.message && (e.message.includes("No LID") || e.message.includes("LID"))) {
          throw new Error(`Phone number +${cleanPhone} is not registered on WhatsApp or requires Meta Cloud API.`);
        } else {
          throw new Error(`WhatsApp Web error: ${e.message}`);
        }
      }
    } else if (waCloud.isConfigured()) {
      const sent = await waCloud.sendLocation(cleanPhone, lat, lng, name);
      msgId = sent?.messages?.[0]?.id || msgId;
    } else {
      throw new Error("WhatsApp not connected. Please scan QR Code or configure Meta Cloud API.");
    }

    try {
      const db = require("../config/database");
      await db.promise().query(
        `INSERT INTO wa_message_logs (session_key, phone, direction, message_type, message_text, wa_message_id, status, created_at)
         VALUES (?, ?, 'outbound', 'location', ?, ?, 'sent', NOW())`,
        [this.key, cleanPhone, name || "Location", msgId]
      );
    } catch (e) {
      console.error("DB log outbound location error:", e.message);
    }
    delete this.messagesFetchCache[chatId];

    const locationMsg = {
      id: msgId,
      from: "me",
      to: cleanPhone,
      body: "",
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      location: { lat, lng, name },
    };
    if (!this.messagesCache[chatId]) this.messagesCache[chatId] = [];
    this.messagesCache[chatId].unshift(locationMsg);
    this.emitWaEvent("wa_message_sent", chatId, cleanPhone, locationMsg);

    return { success: true, id: msgId };
  }

  async syncWhatsAppContacts() {
    if (!this.ready || !this.client) {
      return { success: false, message: "WhatsApp client is not ready" };
    }
    try {
      const rawContacts = await this.enqueue(() =>
        this.withTimeout(this.client.getContacts(), 25000, "WhatsApp Web getContacts")
      ).catch(() => []);

      if (!rawContacts || !rawContacts.length) {
        return { success: true, count: 0, inserted: 0, updated: 0 };
      }

      const db = require("../config/database");
      let inserted = 0;
      let updated = 0;

      for (const c of rawContacts) {
        if (!c.isUser || !c.number) continue;
        const cleanPhone = c.number.replace(/\D/g, "");
        if (cleanPhone.length < 10) continue;

        const name = (c.name || c.pushname || c.shortName || `+${cleanPhone}`).trim();
        const countryCode = cleanPhone.length > 10 ? cleanPhone.slice(0, cleanPhone.length - 10) : "91";
        const fullPhone = cleanPhone;

        try {
          const [res] = await db.promise().query(
            `INSERT INTO wa_contacts (name, phone, country_code, source, opt_in_status)
             VALUES (?, ?, ?, 'WhatsApp Account', 1)
             ON DUPLICATE KEY UPDATE
               name = IF(name IS NULL OR name = '' OR name LIKE '+%', VALUES(name), name),
               updated_at = NOW()`,
            [name, fullPhone, countryCode]
          );
          if (res.affectedRows === 1) inserted++;
          else if (res.affectedRows === 2) updated++;
        } catch (e) {}
      }

      return { success: true, count: rawContacts.length, inserted, updated };
    } catch (err) {
      console.error("syncWhatsAppContacts error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async syncWhatsAppChatsAndMessages() {
    if (!this.ready || !this.client) {
      return { success: false, message: "WhatsApp client is not ready" };
    }
    try {
      const chats = await this.getChats(true);
      let syncedMessages = 0;

      for (const chat of (chats || []).slice(0, 30)) {
        if (!chat.id) continue;
        try {
          const msgs = await this.getMessages(chat.id, true);
          syncedMessages += (msgs || []).length;
        } catch (_) {}
      }

      return { success: true, syncedChats: (chats || []).length, syncedMessages };
    } catch (err) {
      console.error("syncWhatsAppChatsAndMessages error:", err.message);
      return { success: false, error: err.message };
    }
  }

  async getAccountDetails() {
    // getStatus() is async — without the await, status.connected was always
    // undefined and this endpoint reported "disconnected" on a live session.
    const status = await this.getStatus();
    if (!status.connected || !this.client) {
      return {
        connected: false,
        phone: null,
        pushname: null,
        profilePicUrl: null,
        contactsCount: 0,
        chatsCount: 0,
      };
    }

    let pushname = null;
    let profilePicUrl = null;

    try {
      pushname = this.client.info?.pushname || null;
      if (this.client.info?.wid?._serialized) {
        profilePicUrl = await this.client.getProfilePicUrl(this.client.info.wid._serialized).catch(() => null);
      }
    } catch (_) {}

    let contactsCount = 0;
    try {
      const db = require("../config/database");
      const [[{ total }]] = await db.promise().query(
        "SELECT COUNT(*) as total FROM wa_contacts WHERE source = 'WhatsApp Account' OR opt_in_status = 1"
      );
      contactsCount = total || 0;
    } catch (_) {}

    return {
      connected: true,
      phone: this.phone,
      pushname: pushname || `WhatsApp (+${this.phone})`,
      profilePicUrl,
      platform: this.client.info?.platform || "WhatsApp Web",
      contactsCount,
      chatsCount: this.chatsCache.length,
    };
  }

  async sendTemplateMessage(phone, templateName, components = []) {
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;

    let text = "";
    try {
      const db = require("../config/database");
      const [rows] = await db.promise().query(
        "SELECT body_text FROM wa_templates WHERE name = ? OR name LIKE ? LIMIT 1",
        [templateName, `%${templateName}%`]
      );
      if (rows.length > 0 && rows[0].body_text) {
        text = rows[0].body_text;
      }
    } catch (_) {}

    if (!text) {
      const DEFAULT_TEMPLATES = {
        welcome_message: "Hello! Welcome to our service. We are glad to connect with you. How can we help you today?",
        lead_inquiry_reply: "Hello, thank you for reaching out regarding your inquiry. Our team will connect with you shortly!",
        invoice_payment_reminder: "Dear Customer, this is a friendly reminder regarding your outstanding invoice payment. Please let us know if you need any details.",
        payment_received_ack: "Dear Customer, we have received your payment. Thank you!",
        amc_renewal_notice: "Dear Customer, your AMC Contract is due for renewal. Please contact us to extend coverage.",
      };
      text = DEFAULT_TEMPLATES[templateName] || `Hello! Reference: ${templateName}`;
    }

    if (Array.isArray(components)) {
      components.forEach((comp, idx) => {
        if (comp && comp.parameters && Array.isArray(comp.parameters)) {
          comp.parameters.forEach((p, pIdx) => {
            const val = p.text || p.value || "";
            text = text.replace(new RegExp(`\\{\\{${pIdx + 1}\\}\\}`, "g"), val);
          });
        } else if (typeof comp === "string" || typeof comp === "number") {
          text = text.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, "g"), String(comp));
        }
      });
    }

    return this.sendMessage(`${cleanPhone}@c.us`, text);
  }

  logout() {
    return this.lifecycle(() => this._doLogout());
  }

  async _doLogout() {
    try {
      if (this.client) {
        await this.client.destroy();
      }
    } catch (_) {}
    this.client = null;
    this.ready = false;
    this.qrCode = null;
    this.phone = null;
    this.isInitializing = false;
    this.chatsCache = [];
    this.messagesCache = {};
    this.messagesFetchCache = {};
    this.lastChatsFetch = 0;

    try {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
    } catch (_) {}
  }
}

// ── Session registry ────────────────────────────────────────────────────────
// One WhatsAppService per linked number, keyed by the owning CRM user id.
// The constructor is pure field assignment — get() launches no browser, so an
// unlinked key cheaply yields an object with ready === false, which every
// caller already handles.
const sessions = new Map();
let defaultKey = process.env.WA_DEFAULT_USER || "1";

function get(key) {
  const k = String(key || defaultKey);
  if (!sessions.has(k)) sessions.set(k, new WhatsAppService(k));
  return sessions.get(k);
}

function all() {
  return Array.from(sessions.values());
}

// The session CRM-side senders use when there is no user in context:
// schedulers, Cloud API webhooks, invoice/payment automations, the queue worker.
function getDefault() {
  return get(defaultKey);
}

// A LocalAuth profile only counts as linked once Chrome has written its user
// data dir. _doInit mkdirs the session folder *before* launching, so an empty
// directory is residue from an aborted QR scan, not a session.
function hasSavedProfile(dir) {
  try {
    return fs.existsSync(path.join(dir, "session", "Default"));
  } catch (_) {
    return false;
  }
}

async function migrateLegacySession(adminKey) {
  if (!fs.existsSync(LEGACY_SESSION_PATH) || !hasSavedProfile(LEGACY_SESSION_PATH)) return;
  const target = path.join(SESSIONS_ROOT, adminKey);
  if (fs.existsSync(target)) return;
  try {
    fs.mkdirSync(SESSIONS_ROOT, { recursive: true });
    // Copy rather than rename: a stale Chrome still holding the profile lock
    // makes rename throw EPERM, and a half-moved profile costs a QR re-scan.
    // The legacy folder is left in place as the rollback.
    fs.cpSync(LEGACY_SESSION_PATH, target, { recursive: true });
    console.log(`✅ Migrated existing WhatsApp session -> whatsapp-sessions/${adminKey} (original kept as backup)`);
  } catch (e) {
    console.warn("⚠️ Could not migrate legacy WhatsApp session:", e.message);
  }
}

// Called once at boot. Restores every saved session; launches nothing when
// none exist. Without this, `ready` was false after every restart and all
// outbound sends threw until someone opened the QR page by hand.
async function restoreExisting() {
  const db = require("../config/database");

  if (!process.env.WA_DEFAULT_USER) {
    try {
      const [rows] = await db.promise().query("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
      if (rows.length) defaultKey = String(rows[0].id);
    } catch (_) {}
  }

  await migrateLegacySession(defaultKey);

  // Pre-multi-session rows carry no session_key; attribute them to the owner
  // so their history doesn't vanish from the chat list. No-op after first boot.
  try {
    await db.promise().query("UPDATE wa_message_logs SET session_key = ? WHERE session_key IS NULL", [defaultKey]);
    await db.promise().query("UPDATE wa_campaigns SET session_key = ? WHERE session_key IS NULL", [defaultKey]);
  } catch (_) {}

  let dirs = [];
  try {
    dirs = fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch (_) {
    return { restored: 0 };
  }

  let restored = 0;
  for (const key of dirs) {
    const dir = path.join(SESSIONS_ROOT, key);
    if (!hasSavedProfile(dir)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      continue;
    }
    // Staggered and unawaited — N cold Chrome launches at once would stall boot.
    setTimeout(() => {
      console.log(`♻️ Restoring saved WhatsApp session for user ${key}...`);
      get(key).init(false).catch((e) => console.warn(`⚠️ WhatsApp session ${key} restore failed:`, e.message));
    }, restored * 5000);
    restored++;
  }

  console.log(restored ? `📱 ${restored} saved WhatsApp session(s) queued for restore` : "ℹ️ No saved WhatsApp sessions — none started");
  return { restored };
}

module.exports = {
  get,
  all,
  default: getDefault,
  restoreExisting,
  get defaultKey() { return defaultKey; },
  SESSIONS_ROOT,
};
