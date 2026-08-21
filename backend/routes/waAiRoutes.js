const express = require("express");
const multer = require("multer");
const router = express.Router();
const db = require("../config/database");
const { verifyToken } = require("../middleware/authMiddleware");
const { encrypt, decrypt } = require("../backendutil/cryptoHelper");
const waAi = require("../services/waAiReply");
const waAiTools = require("../services/waAiTools");
const waKnowledgeBase = require("../services/waKnowledgeBase");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/settings", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT enabled, provider, model, system_prompt, api_key, auto_lead_capture, human_handoff_keywords, custom_api_url, temperature, max_tokens FROM wa_ai_settings WHERE id = 1"
    );
    const row = rows[0] || {};
    let maskedKey = "";
    if (row.api_key) {
      try {
        const decrypted = decrypt(row.api_key);
        if (decrypted && decrypted.length > 8) {
          maskedKey = decrypted.slice(0, 4) + "••••••••" + decrypted.slice(-4);
        } else {
          maskedKey = "••••••••";
        }
      } catch (_) {
        maskedKey = "••••••••";
      }
    }

    const docs = await waKnowledgeBase.listDocuments().catch(() => []);

    res.json({
      enabled: Boolean(row.enabled),
      provider: row.provider || "openrouter",
      model: row.model || "meta-llama/llama-3.3-70b-instruct:free",
      system_prompt: row.system_prompt || "",
      has_api_key: Boolean(row.api_key),
      masked_api_key: maskedKey,
      auto_lead_capture: row.auto_lead_capture !== 0,
      human_handoff_keywords: row.human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
      custom_api_url: row.custom_api_url || "",
      temperature: parseFloat(row.temperature) || 0.70,
      max_tokens: parseInt(row.max_tokens, 10) || 350,
      kb_docs_count: docs.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings", verifyToken, async (req, res) => {
  try {
    const {
      enabled,
      provider,
      model,
      system_prompt,
      api_key,
      auto_lead_capture,
      human_handoff_keywords,
      custom_api_url,
      temperature,
      max_tokens,
    } = req.body;

    const fields = [
      "enabled = ?",
      "provider = ?",
      "model = ?",
      "system_prompt = ?",
      "auto_lead_capture = ?",
      "human_handoff_keywords = ?",
      "custom_api_url = ?",
      "temperature = ?",
      "max_tokens = ?",
    ];
    const params = [
      enabled ? 1 : 0,
      provider || "openrouter",
      model || "meta-llama/llama-3.3-70b-instruct:free",
      system_prompt || null,
      auto_lead_capture !== false ? 1 : 0,
      human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
      custom_api_url || null,
      parseFloat(temperature) || 0.70,
      parseInt(max_tokens, 10) || 350,
    ];

    if (api_key && api_key !== "••••••••" && !api_key.includes("••••")) {
      fields.push("api_key = ?");
      params.push(encrypt(api_key.trim()));
    }

    const [existing] = await db.promise().query("SELECT id FROM wa_ai_settings WHERE id = 1");
    if (existing.length) {
      await db.promise().query(`UPDATE wa_ai_settings SET ${fields.join(", ")} WHERE id = 1`, params);
    } else {
      await db.promise().query(
        `INSERT INTO wa_ai_settings (id, enabled, provider, model, system_prompt, auto_lead_capture, human_handoff_keywords, custom_api_url, temperature, max_tokens, api_key)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          enabled ? 1 : 0,
          provider || "openrouter",
          model || "meta-llama/llama-3.3-70b-instruct:free",
          system_prompt || null,
          auto_lead_capture !== false ? 1 : 0,
          human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
          custom_api_url || null,
          parseFloat(temperature) || 0.70,
          parseInt(max_tokens, 10) || 350,
          api_key ? encrypt(api_key.trim()) : null,
        ]
      );
    }

    res.json({ success: true, message: "WhatsApp AI Settings updated successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/test", verifyToken, async (req, res) => {
  try {
    const { message, phone = "919876543210", contact_name = "Demo Client" } = req.body;
    if (!message) return res.status(400).json({ error: "Test message is required" });

    const reply = await waAi.generateReply(phone, message.trim(), contact_name);
    if (!reply) {
      return res.status(400).json({
        error: "No AI reply generated. Please ensure your API Key is valid and the selected model is active.",
      });
    }
    res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Test specific CRM Tool execution directly ─────────────────────────────────
router.post("/test-tool", verifyToken, async (req, res) => {
  try {
    const { tool_name, phone = "919876543210", params = {} } = req.body;
    if (!tool_name) return res.status(400).json({ error: "tool_name is required" });

    const result = await waAiTools.runTool(tool_name, phone, params);
    res.json({ success: true, tool_name, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Knowledge Base (.txt, .md, .csv, .docx) ──────────────────────────────────
router.get("/knowledge", verifyToken, async (req, res) => {
  try {
    res.json(await waKnowledgeBase.listDocuments());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/knowledge", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File is required" });
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
