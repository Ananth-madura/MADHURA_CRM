const db = require("../config/database");

/**
 * waLoadBalancer.js
 *
 * Intelligent WhatsApp Engine Load Balancer & Failover Controller
 * Distributes message sending across active Meta Cloud API instances &
 * WhatsApp Web sessions using round-robin selection with automatic failover.
 */

class WALoadBalancer {
  constructor() {
    this.rrIndex = 0;
    this.stats = {
      totalDispatched: 0,
      cloudApiSent: 0,
      webSessionSent: 0,
      failoverCount: 0,
      lastFailoverAt: null,
    };
  }

  // sessionKey pins the Web engine to a specific linked number — an inbound
  // reply must go back out of the number that received it, not whichever
  // session happens to be the CRM default. Omitted => owner session.
  async getActiveEngines(sessionKey) {
    const engines = [];
    const waCloud = require("./whatsappCloudApi");
    const waWeb = require("./whatsappService").get(sessionKey);

    // 1. Meta Cloud API Engine
    if (waCloud.isConfigured()) {
      engines.push({
        id: "cloud_api_primary",
        name: "Meta Cloud API",
        type: "cloud_api",
        sendText: async (phone, text) => waCloud.sendText(phone, text),
        sendTemplate: async (phone, tmplName, lang, components) => waCloud.sendTemplate(phone, tmplName, lang, components),
        sendMedia: async (phone, mediaType, mediaUrl, caption) => waCloud.sendMedia(phone, mediaType, mediaUrl, caption),
      });
    }

    // 2. WhatsApp Web Active Session Engine
    if (waWeb.ready) {
      engines.push({
        id: "web_session_primary",
        name: `WhatsApp Web (+${waWeb.phone || "Active"})`,
        type: "web_session",
        sendText: async (phone, text) => {
          let clean = phone.replace(/\D/g, "");
          if (clean.length === 10) clean = "91" + clean;
          return waWeb.sendMessage(`${clean}@c.us`, text);
        },
        sendTemplate: async (phone, tmplName, lang, components) => {
          let clean = phone.replace(/\D/g, "");
          if (clean.length === 10) clean = "91" + clean;
          return waWeb.sendTemplateMessage(clean, tmplName, components);
        },
        sendMedia: async (phone, mediaType, mediaUrl, caption) => {
          let clean = phone.replace(/\D/g, "");
          if (clean.length === 10) clean = "91" + clean;
          return waWeb.sendMediaMessage(`${clean}@c.us`, mediaUrl, mediaType, caption);
        },
      });
    }

    // 3. Additional DB configured active accounts from wa_accounts
    try {
      const [rows] = await db.promise().query(
        "SELECT * FROM wa_accounts WHERE is_active = 1 AND connection_type = 'cloud_api' ORDER BY id ASC"
      );
      rows.forEach((acc) => {
        if (acc.phone_number_id && acc.access_token && !engines.some((e) => e.id === `acc_${acc.id}`)) {
          engines.push({
            id: `acc_${acc.id}`,
            name: acc.account_name || `Cloud Account +${acc.phone_number}`,
            type: "cloud_api",
            sendText: async (phone, text) => waCloud.sendText(phone, text),
            sendTemplate: async (phone, tmplName, lang, components) => waCloud.sendTemplate(phone, tmplName, lang, components),
            sendMedia: async (phone, mediaType, mediaUrl, caption) => waCloud.sendMedia(phone, mediaType, mediaUrl, caption),
          });
        }
      });
    } catch (_) {}

    return engines;
  }

  async sendTextMessage(phone, text, sessionKey) {
    const engines = await this.getActiveEngines(sessionKey);
    if (!engines.length) {
      throw new Error("No active WhatsApp engines available in Load Balancer pool");
    }

    // Select engine via round-robin index
    this.rrIndex = (this.rrIndex + 1) % engines.length;
    const primaryEngine = engines[this.rrIndex];

    try {
      const result = await primaryEngine.sendText(phone, text);
      this.recordSuccess(primaryEngine.type);
      return { success: true, engineUsed: primaryEngine.name, result };
    } catch (primaryErr) {
      console.warn(`⚠️ [WA LoadBalancer] Primary engine '${primaryEngine.name}' failed: ${primaryErr.message}. Attempting failover...`);
      this.stats.failoverCount++;
      this.stats.lastFailoverAt = new Date().toISOString();

      // Failover to secondary engine
      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendText(phone, text);
          this.recordSuccess(fallbackEngine.type);
          console.log(`✅ [WA LoadBalancer] Failover successful via '${fallbackEngine.name}'`);
          return { success: true, engineUsed: fallbackEngine.name, result, failover: true };
        } catch (fallbackErr) {
          console.error(`❌ [WA LoadBalancer] Fallback engine '${fallbackEngine.name}' also failed: ${fallbackErr.message}`);
        }
      }
      throw primaryErr;
    }
  }

  async sendTemplateMessage(phone, templateName, language = "en", components = [], sessionKey) {
    const engines = await this.getActiveEngines(sessionKey);
    if (!engines.length) {
      throw new Error("No active WhatsApp engines available in Load Balancer pool");
    }

    this.rrIndex = (this.rrIndex + 1) % engines.length;
    const primaryEngine = engines[this.rrIndex];

    try {
      const result = await primaryEngine.sendTemplate(phone, templateName, language, components);
      this.recordSuccess(primaryEngine.type);
      return { success: true, engineUsed: primaryEngine.name, result };
    } catch (primaryErr) {
      console.warn(`⚠️ [WA LoadBalancer] Failover sending template via backup engine...`);
      this.stats.failoverCount++;
      this.stats.lastFailoverAt = new Date().toISOString();

      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendTemplate(phone, templateName, language, components);
          this.recordSuccess(fallbackEngine.type);
          return { success: true, engineUsed: fallbackEngine.name, result, failover: true };
        } catch (_) {}
      }
      throw primaryErr;
    }
  }

  async sendMediaMessage(phone, mediaType, mediaUrl, caption = "", sessionKey) {
    const engines = await this.getActiveEngines(sessionKey);
    if (!engines.length) {
      throw new Error("No active WhatsApp engines available in Load Balancer pool");
    }

    this.rrIndex = (this.rrIndex + 1) % engines.length;
    const primaryEngine = engines[this.rrIndex];

    try {
      const result = await primaryEngine.sendMedia(phone, mediaType, mediaUrl, caption);
      this.recordSuccess(primaryEngine.type);
      return { success: true, engineUsed: primaryEngine.name, result };
    } catch (primaryErr) {
      this.stats.failoverCount++;
      for (const fallbackEngine of engines) {
        if (fallbackEngine.id === primaryEngine.id) continue;
        try {
          const result = await fallbackEngine.sendMedia(phone, mediaType, mediaUrl, caption);
          this.recordSuccess(fallbackEngine.type);
          return { success: true, engineUsed: fallbackEngine.name, result, failover: true };
        } catch (_) {}
      }
      throw primaryErr;
    }
  }

  recordSuccess(type) {
    this.stats.totalDispatched++;
    if (type === "cloud_api") this.stats.cloudApiSent++;
    else if (type === "web_session") this.stats.webSessionSent++;
  }

  async getLoadBalancerStats() {
    const engines = await this.getActiveEngines().catch(() => []);
    return {
      activeEnginesCount: engines.length,
      engines: engines.map((e) => ({ id: e.id, name: e.name, type: e.type })),
      stats: this.stats,
      loadBalanceMode: engines.length > 1 ? "Round-Robin & Failover Enabled" : "Single Active Engine",
    };
  }
}

module.exports = new WALoadBalancer();
