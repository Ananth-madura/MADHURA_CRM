const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const http = require("http");
const db = require("./config/database");
const { initSocket } = require("./sockets/chatsockets");
const { initNotificationsSocket } = require("./sockets/notifications");

// ── Fail fast if required env vars are missing ──────────────────────────────
const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  console.error("   Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
module.exports = app;

// ── Crash guard for whatsapp-web.js / Puppeteer ─────────────────────────────
// whatsapp-web.js occasionally throws an unhandled rejection deep inside
// Puppeteer during a WhatsApp Web page navigation (e.g. "Execution context
// was destroyed"), outside of any of its own event handlers. Left alone this
// takes down the entire CRM process, not just the WhatsApp session. Only this
// known, benign error class is swallowed here — anything else still crashes
// the process as Node intends, so real bugs aren't masked.
function isRecoverableWaError(err) {
  const text = `${(err && err.message) || err} ${(err && err.stack) || ""}`;
  return /puppeteer|whatsapp-web\.js|Execution context was destroyed|Protocol error|Session closed|Target closed/i.test(text);
}
function handleFatal(label, err) {
  if (isRecoverableWaError(err)) {
    console.error(`⚠️ Recovered from WhatsApp Web session error (${label}):`, err?.message || err);
    // whatsapp-web.js throws plenty of these (page-navigation races, etc.) while
    // the session is still perfectly linked. forceReset() destroys the client
    // and forces a fresh QR scan — calling it unconditionally on every one of
    // these was logging people out of a healthy WhatsApp session for no reason.
    // Only reset when the session is already down; a real disconnect is caught
    // by the client's own "disconnected" handler, which calls forceReset itself.
    //
    // getStatus() is async: `!wa.getStatus().connected` read `.connected` off a
    // Promise, got undefined, and so force-reset on EVERY one of these benign
    // errors — the exact behaviour the paragraph above says it avoids. That is
    // what kept unlinking healthy sessions and breaking outbound sends.
    // `ready` is a plain boolean and handleFatal is sync, so check that.
    try {
      const wa = require("./services/whatsappService");
      wa.all().forEach((s) => {
        if (!s.ready) s.forceReset(label);
      });
    } catch (_) {}
    return;
  }
  console.error(`❌ ${label}:`, err);
  process.exit(1);
}
process.on("unhandledRejection", (reason) => handleFatal("unhandledRejection", reason));
process.on("uncaughtException", (err) => handleFatal("uncaughtException", err));

// ── CORS ─────────────────────────────────────────────────────────────────────
// Dynamically echo back any origin in self-hosted mode to avoid CORS errors with dynamic IPs/hostnames
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
const dynamicOrigin = (origin, callback) => {
  callback(null, true);
};
app.use(cors({
  origin: dynamicOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));
const corsOrigins = dynamicOrigin;

app.use(express.json({ limit: "50mb", verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get(["/health", "/api/health"], (req, res) => {
  res.json({
    ok: true,
    database: "ready",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  const shouldEmit = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

  res.json = (body) => {
    if (shouldEmit && res.statusCode < 400) {
      const io = req.app.get("io");
      if (io) {
        io.emit("data_changed", {
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          at: new Date().toISOString()
        });
      }
    }
    return originalJson(body);
  };

  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/Telecalls", require("./routes/telecallRoutes"));
app.use("/api/Walkins", require("./routes/walkinRoutes"));
app.use("/api/quotations", require("./routes/quotationRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/task", require("./routes/taskRoutes"));
app.use("/api/Fields", require("./routes/fieldRoutes"));
app.use("/api/fields", require("./routes/fieldRoutes")); // lowercase alias
app.use("/api/client", require("./routes/newclient"));
app.use("/api/invoice", require("./routes/invoice"));
app.use("/api/payments", require("./routes/payment"));
app.use("/api/estimate-client", require("./routes/newestimates"));
app.use("/api/estimate", require("./routes/estimate"));
app.use("/api/contract", require("./routes/contract"));
app.use("/api/teammember", require("./routes/team"));
app.use("/api/performainvoice", require("./routes/performaInvoiceRoutes"));
app.use("/api/estimate-invoice", require("./routes/estimateInvoiceRoutes"));
app.use("/api/service-estimation", require("./routes/serviceEstimationRoutes"));
app.use("/api/call-reports", require("./routes/callReportRoutes"));
app.use("/api/services", require("./routes/serviceRoutes"));
app.use("/api/leads", require("./routes/leadManagementRoutes"));
app.use("/api/targets", require("./routes/targetRoutes"));
app.use("/api/amc", require("./routes/amcRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/setup", require("./routes/setupRoutes"));
// verifyToken here is both a fix (every /api/whatsapp/* route was public,
// including /send and /logout) and a requirement — per-user sessions are
// resolved from req.user.id.
app.use("/api/whatsapp", require("./middleware/authMiddleware").verifyToken, require("./routes/whatsappRoutes"));
app.use("/api/wa/templates", require("./routes/waTemplateRoutes"));
app.use("/api/wa/groups", require("./routes/waGroupRoutes"));
app.use("/api/wa/campaigns", require("./routes/waCampaignRoutes"));
app.use("/api/wa/analytics", require("./routes/waAnalyticsRoutes"));
app.use("/api/wa/config", require("./routes/waConfigRoutes"));
app.use("/api/wa/webhook", require("./routes/waWebhookRoutes"));
app.use("/api/wa/contacts", require("./routes/waContactRoutes"));
app.use("/api/wa/automations", require("./routes/waAutomationRoutes"));
app.use("/api/wa/flows", require("./routes/waFlowRoutes"));
app.use("/api/wa/ai", require("./routes/waAiRoutes"));
app.use("/api/wa/payments", require("./routes/waPaymentsRoutes"));
app.use("/api/wa/drip", require("./routes/waDripRoutes"));
app.use("/api/wa/reminders", require("./routes/waReminderRoutes"));

// ── Ensure Runtime Directories Exist ──────────────────────────────────────────
// Ensures application runs cleanly on fresh setups/clones where folders are gitignored
const fs = require("fs");
const runtimeDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads", "wa-media"),
  path.join(__dirname, "..", "whatsapp-sessions"),
  path.join(__dirname, "..", "logs"),
];
runtimeDirs.forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (_) {}
});

// Absolute path: express.static("uploads") resolves against process.cwd(), so
// uploaded media 404'd whenever the server was started from anywhere but backend/.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Serve React Frontend statically in production ───────────────────────────
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "../frontend/build");
  app.use(express.static(buildPath));
  
  // React BrowserRouter catch-all support
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads") || req.path.startsWith("/socket.io")) {
      return next();
    }
    res.sendFile(path.join(buildPath, "index.html"), (err) => {
      if (err) {
        res.status(500).send("React build directory not found. Please compile frontend before running.");
      }
    });
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Either stop the process currently listening on port ${PORT} or set a different PORT in backend/.env.`);
    process.exit(1);
  }
  throw error;
});

function startServer() {
  return db.ready.then(async () => {
    const io = initSocket(server, corsOrigins);
    const notificationIO = initNotificationsSocket(io, corsOrigins);
    app.set("io", io);
    app.set("notificationIO", io);
    require("./backendutil/reminderScheduler").startSchedulers();

    // Ensure WhatsApp tables exist
    try {
      await require("./services/waDatabase").ensureWATables();
    } catch (e) {
      console.warn("⚠️ WhatsApp tables setup warning:", e.message);
    }

    // Load active Meta WhatsApp Cloud API credentials on boot
    try {
      await require("./services/waConfigHelper").configureForUser(null);
    } catch (e) {
      console.warn("⚠️ Meta WhatsApp Cloud API config init warning:", e.message);
    }

    // Restore saved WhatsApp sessions. Nothing used to call init() at boot, so
    // after every restart `ready` was false and every outbound send threw until
    // a human opened the QR page. Launches nothing when no session is saved.
    try {
      await require("./services/whatsappService").restoreExisting();
    } catch (e) {
      console.warn("⚠️ WhatsApp session restore warning:", e.message);
    }

    // Daily payment_due WhatsApp reminder for invoices due tomorrow
    try {
      require("./services/waPaymentDueScheduler").startPaymentDueScheduler();
    } catch (e) {
      console.warn("⚠️ WA payment-due scheduler warning:", e.message);
    }

    // Daily lead_followup WhatsApp reminder for telecalls/walkins/fields due today
    try {
      require("./services/waLeadFollowupScheduler").startLeadFollowupScheduler();
    } catch (e) {
      console.warn("⚠️ WA lead-followup scheduler warning:", e.message);
    }

    // Master 2-Way Interactive Confirmation Schedulers (Appointments, Invoices, Quotations, AMC)
    try {
      require("./services/waReminderScheduler").startInteractiveReminderSchedulers();
    } catch (e) {
      console.warn("⚠️ WA interactive reminder schedulers warning:", e.message);
    }

    // Recovers delayed automation rules whose in-process timer was lost on restart
    try {
      require("./services/waAutomationService").startAutomationScheduler();
    } catch (e) {
      console.warn("⚠️ WA delayed automation scheduler warning:", e.message);
    }

    // Start WhatsApp Cloud API queue worker (no Redis fallback = synchronous)
    const { startWorker } = require("./services/waQueue");
    startWorker().catch(() => {});
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running: http://0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);

      // Optional Port 80 redirect server for client domain convenience
      if (process.env.NODE_ENV === "production" && PORT === 82) {
        const redirectApp = express();
        redirectApp.get("/{*splat}", (req, res) => {
          const host = req.headers.host ? req.headers.host.split(":")[0] : "achme.com";
          res.redirect(`http://${host}:82${req.originalUrl}`);
        });
        http.createServer(redirectApp).listen(80, "0.0.0.0", () => {
          console.log(`🚀 Automatic redirect server active on port 80 (routing http://achme.com -> http://achme.com:82)`);
        }).on("error", (err) => {
          if (err.code === "EADDRINUSE") {
            console.log(`ℹ️ Port 80 is occupied (redirect server bypassed; access CRM using port 82)`);
          } else {
            console.warn(`⚠️ Redirect server port 80 failed:`, err.message);
          }
        });
      }
    });
  }).catch((error) => {
    console.error("Database is not ready. Server not started.");
    console.error(`Check DB_HOST, DB_PORT, DB_USER, DB_PASS, and DB_NAME in backend/.env. Details: ${error.message}`);
    process.exit(1);
  });
}

app.startServer = startServer;

if (process.env.NODE_ENV !== "test") {
  startServer();
}
