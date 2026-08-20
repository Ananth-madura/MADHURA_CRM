const axios = require("axios");

const WA_API_VERSION = "v22.0";
const BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;

class WhatsAppCloudApi {
  constructor() {
    this.phoneNumberId = process.env.WA_PHONE_NUMBER_ID || "";
    this.accessToken = process.env.WA_ACCESS_TOKEN || "";
    this.wabaId = process.env.WA_WABA_ID || "";
    this.appSecret = process.env.WA_APP_SECRET || "";
    this.verifyToken = process.env.WA_VERIFY_TOKEN || "crm_verify_123";
    this.businessAccountId = process.env.WA_BUSINESS_ACCOUNT_ID || "";
  }

  isConfigured() {
    return !!(this.phoneNumberId && this.accessToken);
  }

  getConfig() {
    return {
      configured: this.isConfigured(),
      phoneNumberId: this.phoneNumberId ? `${this.phoneNumberId.slice(0, 4)}...` : null,
      wabaId: this.wabaId || null,
    };
  }

  async sendText(to, text, previewUrl = false) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text, preview_url: previewUrl },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendInteractiveButtons(to, bodyText, buttons = []) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: String(bodyText).slice(0, 1024) },
          action: {
            buttons: buttons.slice(0, 3).map((b, i) => ({
              type: "reply",
              reply: {
                id: String(b.id || b.reply_id || `btn_${i + 1}`).slice(0, 256),
                title: String(b.title || `Option ${i + 1}`).slice(0, 20),
              },
            })),
          },
        },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendInteractiveList(to, bodyText, buttonLabel, rows = []) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: String(bodyText).slice(0, 1024) },
          action: {
            button: (buttonLabel || "View Options").slice(0, 20),
            sections: [
              {
                title: "Options",
                rows: rows.slice(0, 10).map((r, i) => ({
                  id: String(r.id || r.reply_id || `row_${i + 1}`).slice(0, 200),
                  title: String(r.title || `Option ${i + 1}`).slice(0, 24),
                  description: r.description ? String(r.description).slice(0, 72) : undefined,
                })),
              },
            ],
          },
        },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendTemplate(to, templateName, languageCode = "en", components = []) {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components.length) body.template.components = components;
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      body,
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendMedia(to, mediaType, mediaIdOrLink, caption = "") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: mediaType,
      [mediaType]: mediaIdOrLink.startsWith("http")
        ? { link: mediaIdOrLink, caption }
        : { id: mediaIdOrLink, caption },
    };
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      body,
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async sendLocation(to, latitude, longitude, name = "", address = "") {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "location",
        location: { latitude, longitude, name, address },
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async getTemplates() {
    if (!this.isConfigured()) throw new Error("WhatsApp Cloud API not configured");
    const { data } = await axios.get(
      `${BASE_URL}/${this.wabaId}/message_templates`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async uploadMedia(fileUrl, mimeType) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/media`,
      { messaging_product: "whatsapp", file: fileUrl, type: mimeType },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  async getMediaUrl(mediaId) {
    const { data } = await axios.get(
      `${BASE_URL}/${mediaId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async registerWebhook(url) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getPhoneNumbers() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.wabaId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getPhoneNumberInfo() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.phoneNumberId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async getBusinessProfile() {
    const { data } = await axios.get(
      `${BASE_URL}/${this.phoneNumberId}/whatsapp_business_profile`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    return data;
  }

  async updateBusinessProfile(profile) {
    const { data } = await axios.post(
      `${BASE_URL}/${this.phoneNumberId}/whatsapp_business_profile`,
      { messaging_product: "whatsapp", ...profile },
      { headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" } }
    );
    return data;
  }

  verifyWebhook(mode, token, challenge) {
    if (mode === "subscribe" && token === this.verifyToken) return challenge;
    return null;
  }
}

module.exports = new WhatsAppCloudApi();