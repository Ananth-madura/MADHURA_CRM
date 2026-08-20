const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setup/info
// Returns the current server IP so the client knows what to configure
// ─────────────────────────────────────────────────────────────────────────────
router.get("/info", (req, res) => {
  // Detect the real LAN IP of this server
  const nets = os.networkInterfaces();
  let serverIp = "192.168.1.110"; // fallback

  for (const name of Object.keys(nets)) {
    if (/loopback|vethernet|virtual|bluetooth/i.test(name)) continue;
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254")) {
        serverIp = net.address;
        break;
      }
    }
  }

  res.json({
    serverIp,
    frontendPort: 82,
    backendPort: process.env.PORT || 5000,
    domains: ["achme.com", "www.achme.com", "IBM-SERVER"],
    setupScriptUrl: "/api/setup/download",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setup/download
// Serves employee-hosts-setup.bat as a download
// ─────────────────────────────────────────────────────────────────────────────
router.get("/download", (req, res) => {
  // Path to the bat file (two levels up from backend/)
  const batPath = path.join(__dirname, "../../employee-hosts-setup.bat");

  if (!fs.existsSync(batPath)) {
    return res.status(404).json({ error: "Setup script not found on server." });
  }

  res.setHeader("Content-Disposition", "attachment; filename=employee-hosts-setup.bat");
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(batPath);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/setup/check-domain
// Client calls this after running the setup script to verify domain resolves
// ─────────────────────────────────────────────────────────────────────────────
router.get("/check-domain", (req, res) => {
  const host = req.hostname || req.headers.host || "";
  const isOnDomain =
    host.includes("achme.com") ||
    host.includes("IBM-SERVER") ||
    host === "localhost" ||
    host === "127.0.0.1";

  res.json({
    host,
    isOnDomain,
    message: isOnDomain
      ? "You are already accessing via domain/localhost."
      : "You are accessing via IP. Run employee-hosts-setup.bat to use domain names.",
  });
});

router.all("/restart-backend", (req, res) => {
  res.json({ ok: true, message: "Restarting backend process..." });
  setTimeout(() => {
    process.exit(0);
  }, 200);
});

module.exports = router;
