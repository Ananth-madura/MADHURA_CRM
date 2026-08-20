const express = require("express");
const multer = require("multer");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { encrypt } = require("../backendutil/cryptoHelper");
const waAi = require("../services/waAiReply");
const waKnowledgeBase = require("../services/waKnowledgeBase");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get("/settings", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT enabled, provider, model, system_prompt, api_key FROM wa_ai_settings WHERE id = 1"
    );
    const row = rows[0] || {};
    res.json({
      enabled: !!row.enabled,
      provider: row.provider || "openrouter",
      model: row.model || "",
      system_prompt: row.system_prompt || "",
      has_api_key: !!row.api_key,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings", verifyToken, async (req, res) => {
  try {
    const { enabled, model, system_prompt, api_key } = req.body;
    const fields = ["enabled = ?", "model = ?", "system_prompt = ?"];
    const params = [enabled ? 1 : 0, model || null, system_prompt || null];
    if (api_key) {
      fields.push("api_key = ?");
      params.push(encrypt(api_key));
    }
    await db.promise().query(`UPDATE wa_ai_settings SET ${fields.join(", ")} WHERE id = 1`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/test", verifyToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });
    const reply = await waAi.generateReply("910000000000", message, "Test User");
    if (!reply) {
      return res.status(400).json({ error: "No reply generated — check that Auto-Reply is enabled and the API key is valid" });
    }
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Knowledge base (.txt/.md/.csv/.docx) the AI draws on when replying ──────
router.get("/knowledge", verifyToken, async (req, res) => {
  try {
    res.json(await waKnowledgeBase.listDocuments());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/knowledge", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    const doc = await waKnowledgeBase.addDocument(req.file, req.user?.id);
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete("/knowledge/:id", verifyToken, async (req, res) => {
  try {
    await waKnowledgeBase.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
