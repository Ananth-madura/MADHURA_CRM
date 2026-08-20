const express = require("express");
const router = express.Router();
const db = require("../config/database");
const wa = require("../services/whatsappCloudApi");
const { getQueueStats } = require("../services/waCampaignEngine");
const { configureForUser, resetToEnvConfig } = require("../services/waConfigHelper");
const { verifyToken } = require("../middleware/authMiddleware");
const { encrypt } = require("../backendutil/cryptoHelper");

router.get("/status", (req, res) => {
  res.json(wa.getConfig());
});

router.get("/user-config", verifyToken, (req, res) => {
  const userId = req.user.id;
  db.query(
    "SELECT id, phone_number_id, waba_id, app_secret, verify_token, business_account_id, is_enabled FROM user_wa_configs WHERE user_id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Failed to check WA config" });
      if (!rows.length) return res.json({ hasConfig: false });
      res.json({ hasConfig: true, config: rows[0] });
    }
  );
});

router.post("/save-config", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled } = req.body;

  if (!phone_number_id || !access_token) {
    return res.status(400).json({ message: "Phone Number ID and Access Token are required" });
  }

  const encrypted_token = encrypt(access_token);
  const encrypted_secret = app_secret ? encrypt(app_secret) : null;

  try {
    const [existing] = await db.promise().query("SELECT id FROM user_wa_configs WHERE user_id = ?", [userId]);

    if (existing.length) {
      await db.promise().query(
        `UPDATE user_wa_configs SET phone_number_id=?, access_token=?, waba_id=?, app_secret=?, verify_token=?, business_account_id=?, is_enabled=? WHERE user_id=?`,
        [phone_number_id, encrypted_token, waba_id || null, encrypted_secret, verify_token || "crm_verify_123", business_account_id || null, is_enabled !== false, userId]
      );
    } else {
      await db.promise().query(
        `INSERT INTO user_wa_configs (user_id, phone_number_id, access_token, waba_id, app_secret, verify_token, business_account_id, is_enabled) VALUES (?,?,?,?,?,?,?,?)`,
        [userId, phone_number_id, encrypted_token, waba_id || null, encrypted_secret, verify_token || "crm_verify_123", business_account_id || null, is_enabled !== false]
      );
    }

    await configureForUser(userId);
    res.json({ success: true, message: "WhatsApp configuration saved successfully!" });
  } catch (err) {
    res.status(500).json({ message: "Failed to save config: " + err.message });
  }
});

router.post("/test-connection", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id } = req.body;

  if (!phone_number_id || !access_token) {
    return res.status(400).json({ message: "Phone Number ID and Access Token are required" });
  }

  try {
    wa.phoneNumberId = phone_number_id;
    wa.accessToken = access_token;
    wa.wabaId = waba_id || "";

    const phoneInfo = await wa.getPhoneNumberInfo();
    resetToEnvConfig();
    res.json({ success: true, message: "Connection verified!", phoneInfo });
  } catch (err) {
    resetToEnvConfig();
    const errMsg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ success: false, message: `Connection failed: ${errMsg}` });
  }
});

router.post("/test-template", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { phone_number_id, access_token, waba_id } = req.body;

  if (!waba_id) return res.status(400).json({ message: "WABA ID required for template fetch" });

  try {
    wa.phoneNumberId = phone_number_id;
    wa.accessToken = access_token;
    wa.wabaId = waba_id;

    const templates = await wa.getTemplates();
    resetToEnvConfig();
    res.json({ success: true, templateCount: templates.data?.length || 0 });
  } catch (err) {
    resetToEnvConfig();
    const errMsg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ success: false, message: `Template fetch failed: ${errMsg}` });
  }
});

router.get("/phone-info", async (req, res) => {
  try {
    const info = await wa.getPhoneNumberInfo();
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/business-profile", async (req, res) => {
  try {
    const profile = await wa.getBusinessProfile();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/queue-stats", async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err) {
    res.json({ error: "Queue not available", detail: err.message });
  }
});

router.get("/meta-templates", async (req, res) => {
  try {
    const templates = await wa.getTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;