# 📱 WhatsApp Standalone Suite — Architecture & Separation Guide

This guide details how to extract and decouple the entire WhatsApp module from **MADHURA CRM** and run it as an **independent, standalone enterprise WhatsApp Platform** (or Microservice).

---

## 📑 Table of Contents
1. [Architecture & System Overview](#1-architecture--system-overview)
2. [Standalone Directory & File Inventory](#2-standalone-directory--file-inventory)
3. [Database Schema (`wa_*` Tables)](#3-database-schema-wa_-tables)
4. [Decoupling CRM Dependencies](#4-decoupling-crm-dependencies)
5. [Standalone Project Setup & Dependencies](#5-standalone-project-setup--dependencies)
6. [Configuration & Environment Variables](#6-configuration--environment-variables)
7. [Running & Deploying Independently](#7-running--deploying-independently)
8. [External CRM & Webhook Integration API](#8-external-crm--webhook-integration-api)

---

## 1. Architecture & System Overview

The WhatsApp module is a full-featured, enterprise-grade omnichannel communication engine supporting **Hybrid Connectivity (WhatsApp Web / Baileys + Meta Cloud API)**, **Visual Chatbot Flow Engine**, **AI Assistant with Document RAG Knowledge Base**, **Bulk Campaign Load Balancer**, **Drip Automations**, and **Real-Time Multi-Agent Live Chat**.

```
                           ┌───────────────────────────────────────────────┐
                           │      WhatsApp Standalone Frontend (React)     │
                           │   Live Chat • Campaigns • Flowbot • AI • RAG  │
                           └───────────────────────┬───────────────────────┘
                                                   │ HTTP / WebSocket
                                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                WhatsApp Standalone Backend (Node.js)                               │
│                                                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────┐  │
│  │ waSessionManager.js  │  │   waCloudService.js  │  │   waLoadBalancer.js  │  │ waAiReply.js  │  │
│  │ Multi-Web Sessions   │  │   Meta Cloud API     │  │ Anti-Ban / Rotations │  │ LLM Engine    │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘  └───────┬───────┘  │
│             │                         │                         │                      │          │
│  ┌──────────▼───────────┐  ┌──────────▼───────────┐  ┌──────────▼───────────┐  ┌───────▼───────┐  │
│  │    waFlowEngine.js   │  │ waCampaignEngine.js  │  │waAutomationService.js│  │waKnowledgeBase│  │
│  │ Visual Chatbot Engine│  │ Bulk Broadcaster     │  │ Drip & Triggers      │  │ PDF / Doc RAG │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘  └───────────────┘  │
└──────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                   │
                   ┌───────────────────────────────┴───────────────────────────────┐
                   ▼                                                               ▼
    ┌─────────────────────────────┐                                 ┌─────────────────────────────┐
    │     WhatsApp Standalone     │                                 │    WhatsApp Gateway Servers │
    │      MySQL Database         │                                 │  Meta Cloud API / WA Web    │
    │      (20+ wa_* Tables)      │                                 │                             │
    └─────────────────────────────┘                                 └─────────────────────────────┘
```

---

## 2. Standalone Directory & File Inventory

To separate WhatsApp into a standalone project (e.g., `whatsapp-suite/`), move the following files:

### 📁 Backend Files to Move

| Source Path in CRM | Target Path in Standalone | Purpose |
|---|---|---|
| `backend/services/whatsappService.js` | `backend/services/whatsappService.js` | Core WhatsApp Web / puppeteer session client & cache |
| `backend/services/waSessionManager.js` | `backend/services/waSessionManager.js` | Multi-device multi-account session manager |
| `backend/services/waCloudService.js` | `backend/services/waCloudService.js` | Official Meta WhatsApp Cloud API integration |
| `backend/services/waLoadBalancer.js` | `backend/services/waLoadBalancer.js` | Smart multi-sender pool, health scoring & anti-ban rotation |
| `backend/services/waFlowEngine.js` | `backend/services/waFlowEngine.js` | State-machine visual chatbot flow engine & lead capture |
| `backend/services/waAutomationService.js` | `backend/services/waAutomationService.js` | Drip campaigns, dynamic variable engine (`{{name}}`, `{{time}}`) |
| `backend/services/waAiReply.js` | `backend/services/waAiReply.js` | AI auto-reply engine (OpenRouter, OpenAI, Gemini, Ollama) |
| `backend/services/waKnowledgeBase.js` | `backend/services/waKnowledgeBase.js` | Document ingestion (`.pdf`, `.docx`, `.csv`, `.txt`) & RAG search |
| `backend/services/waCampaignEngine.js` | `backend/services/waCampaignEngine.js` | Bulk broadcast sender, Spintax parser & jitter scheduler |
| `backend/services/waDatabase.js` | `backend/services/waDatabase.js` | Automatic database table migrations, schemas & seeders |
| `backend/routes/whatsappRoutes.js` | `backend/routes/whatsappRoutes.js` | Live chat, messages, QR generation, pairing code, read status |
| `backend/routes/whatsappEnhancedRoutes.js`| `backend/routes/whatsappEnhancedRoutes.js`| Unified enhanced endpoints for session & messaging |
| `backend/routes/waCampaignRoutes.js` | `backend/routes/waCampaignRoutes.js` | Broadcast campaign creation, pause/resume, recipient stats |
| `backend/routes/waFlowRoutes.js` | `backend/routes/waFlowRoutes.js` | Visual chatbot flow CRUD & interactive node definitions |
| `backend/routes/waAutomationRoutes.js`| `backend/routes/waAutomationRoutes.js`| Drip rules, event triggers & options |
| `backend/routes/waAccountRoutes.js` | `backend/routes/waAccountRoutes.js` | Multi-account credentials, AI settings, document uploads |
| `backend/routes/waContactRoutes.js` | `backend/routes/waContactRoutes.js` | Contact directory, tags, CSV import/export, opt-in/opt-out |
| `backend/routes/waTemplateRoutes.js` | `backend/routes/waTemplateRoutes.js` | Meta message templates & pre-saved quick replies |
| `backend/routes/waGroupRoutes.js` | `backend/routes/waGroupRoutes.js` | Group discovery, member lists & group broadcast |
| `backend/routes/waAnalyticsRoutes.js` | `backend/routes/waAnalyticsRoutes.js` | Delivery rates, read rates, response time & ROI analytics |
| `backend/sockets/chatSocket.js` | `backend/sockets/chatSocket.js` | WebSocket server for real-time messages, QR codes & online status |

---

### 💻 Frontend Files to Move

| Source Path in CRM | Target Path in Standalone | Purpose |
|---|---|---|
| `frontend/src/pages/whatsapp.jsx` | `frontend/src/pages/LiveChat.jsx` | 💬 Live Multi-Device Chat Inbox & Conversation Window |
| `frontend/src/pages/whatsappAccounts.jsx` | `frontend/src/pages/Accounts.jsx` | ⚙️ Phone Numbers, Meta Cloud API, AI Brain & Knowledge Base |
| `frontend/src/pages/whatsappCampaigns.jsx` | `frontend/src/pages/Campaigns.jsx` | 🚀 Bulk Broadcast Composer, Audience Selector & Scheduler |
| `frontend/src/pages/whatsappFlows.jsx` | `frontend/src/pages/Flowbot.jsx` | 🤖 Visual Drag-and-Drop Chatbot Flow Builder |
| `frontend/src/pages/whatsappAutomations.jsx` | `frontend/src/pages/Automations.jsx` | ⏱️ Drip Sequences & Auto-Trigger Rules |
| `frontend/src/pages/whatsappContacts.jsx` | `frontend/src/pages/Contacts.jsx` | 👥 Audience Directory, CSV Uploader & Tag Manager |
| `frontend/src/pages/whatsappTemplates.jsx` | `frontend/src/pages/Templates.jsx` | 📄 Message Template Manager & Meta Template Sync |
| `frontend/src/pages/whatsappGroups.jsx` | `frontend/src/pages/Groups.jsx` | 👥 WhatsApp Communities & Group Management |
| `frontend/src/pages/whatsappAnalytics.jsx` | `frontend/src/pages/Analytics.jsx` | 📊 Analytics, Delivery Charts & Agent Performance |
| `frontend/src/components/WhatsAppNav.jsx` | `frontend/src/components/Navbar.jsx` | Top navigation bar connecting all WhatsApp modules |
| `frontend/src/components/WAContactAvatar.jsx` | `frontend/src/components/WAContactAvatar.jsx` | Contact profile photo display with fallback gradient avatar |
| `frontend/src/components/WAVariablePicker.jsx` | `frontend/src/components/WAVariablePicker.jsx` | 1-Click dynamic variable insert chips (`{{name}}`, `{{city}}`) |
| `frontend/src/components/RichMessageContent.jsx`| `frontend/src/components/RichMessageContent.jsx`| Interactive button, list, media, and invoice message renderer |
| `frontend/src/components/WAConfigPrompt.jsx` | `frontend/src/components/WAConfigPrompt.jsx` | Quick setup & onboarding modal checklist |

---

## 3. Database Schema (`wa_*` Tables)

When running standalone, create a dedicated database (e.g., `CREATE DATABASE whatsapp_db;`). `waDatabase.js` will automatically provision all necessary tables and indexes upon starting the server:

```sql
-- 1. Accounts & Multi-Tenant Credentials
wa_accounts                     -- Cloud API & Web session accounts
wa_sender_pools                 -- Load balancing pools
wa_sender_pool_members          -- Numbers assigned to pools

-- 2. Audience & Contacts
wa_contacts                     -- Phone numbers, profile photos, opt-in/opt-out, tags
wa_contact_groups               -- Audience segments
wa_contact_group_members        -- Contacts assigned to groups
wa_opt_outs                     -- Unsubscribe blacklist (Compliance)

-- 3. Broadcasts & Campaigns
wa_campaigns                    -- Bulk campaigns, scheduling, Spintax
wa_campaign_messages            -- Individual message queue, delivery status, cost

-- 4. Chatbot Flows & Automation
wa_flows                        -- Visual bot workflows
wa_flow_nodes                   -- Flow nodes (Message, Question, Media, Condition)
wa_flow_sessions                -- Multi-turn conversational state tracking
wa_automations                  -- Event-triggered automations
wa_automation_rules             -- Automation triggers & conditions
wa_automation_drips             -- Multi-day drip steps
wa_drip_enrollments             -- Active drip progress per contact

-- 5. AI Assistant & Knowledge Base
wa_ai_settings                  -- LLM provider, API key, system prompt, temperature
wa_knowledge_base               -- Indexed PDF, Word, CSV documents & chunks

-- 6. Live Chat, Logs & Templates
wa_message_logs                 -- Inbound & outbound messages, media, timestamps
wa_templates                    -- Meta templates & pre-saved quick replies
wa_internal_notes               -- Team notes per conversation
wa_interactive_reminders        -- Scheduled reminders & followups
```

---

## 4. Decoupling CRM Dependencies

In `backend/services/waAutomationService.js`, `waFlowEngine.js`, and `waAiReply.js`, there are direct database queries to CRM tables (`clients`, `clientinvoices`, `contracts`, `telecalls`, `walkins`, `fields`).

### How to Decouple for Standalone:

1. **Option A: Generic Webhook / REST Hook (Recommended)**
   - When the WhatsApp bot or automation needs contact metadata, call an external CRM webhook endpoint:
     ```js
     // Example Decoupled CRM Lookup:
     async function lookupCrmData(phone) {
       if (process.env.CRM_WEBHOOK_URL) {
         try {
           const { data } = await axios.get(`${process.env.CRM_WEBHOOK_URL}?phone=${encodeURIComponent(phone)}`, {
             headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}` }
           });
           return data; // { name: "John", company: "Acme", invoice_no: "INV-101", amount: 5000 }
         } catch (_) {}
       }
       // Fallback to local wa_contacts table
       const [rows] = await db.promise().query("SELECT * FROM wa_contacts WHERE phone LIKE ? LIMIT 1", [`%${phone.slice(-10)}`]);
       return rows[0] || {};
     }
     ```

2. **Option B: Standalone Contact Profile Attributes**
   - Store custom fields (`company`, `address`, `city`, `custom_field_1`) directly inside the `wa_contacts` table using a `custom_attributes JSON` column.

3. **Authentication Decoupling**:
   - In standalone mode, use standard JWT token authentication in `backend/middleware/auth.js` for standalone user accounts (`wa_users`).

---

## 5. Standalone Project Setup & Dependencies

### Backend `package.json`

Create `whatsapp-backend/package.json`:

```json
{
  "name": "whatsapp-suite-backend",
  "version": "2.0.0",
  "description": "Standalone Enterprise WhatsApp Engine",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mammoth": "^1.6.0",
    "multer": "^1.4.5-lts.1",
    "mysql2": "^3.9.0",
    "pdf-parse": "^1.1.1",
    "qrcode": "^1.5.3",
    "socket.io": "^4.7.4",
    "whatsapp-web.js": "^1.23.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.3"
  }
}
```

### Standalone Main Server (`backend/server.js`)

```javascript
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { initDatabase } = require("./services/waDatabase");
const { initSocket } = require("./sockets/chatSocket");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize WebSocket for Real-Time WhatsApp Events
initSocket(server);

// Mount WhatsApp Routes
app.use("/api/whatsapp", require("./routes/whatsappRoutes"));
app.use("/api/whatsapp/enhanced", require("./routes/whatsappEnhancedRoutes"));
app.use("/api/wa/accounts", require("./routes/waAccountRoutes"));
app.use("/api/wa/campaigns", require("./routes/waCampaignRoutes"));
app.use("/api/wa/flows", require("./routes/waFlowRoutes"));
app.use("/api/wa/automations", require("./routes/waAutomationRoutes"));
app.use("/api/wa/contacts", require("./routes/waContactRoutes"));
app.use("/api/wa/templates", require("./routes/waTemplateRoutes"));
app.use("/api/wa/groups", require("./routes/waGroupRoutes"));
app.use("/api/wa/analytics", require("./routes/waAnalyticsRoutes"));

// Root Health Check
app.get("/health", (req, res) => res.json({ status: "ok", app: "WhatsApp Standalone Suite" }));

const PORT = process.env.PORT || 5000;

// Initialize DB & Start Server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 WhatsApp Standalone Suite Server running on http://localhost:${PORT}`);
  });
});
```

---

### Frontend `package.json`

Create `whatsapp-frontend/package.json`:

```json
{
  "name": "whatsapp-suite-frontend",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "lucide-react": "^0.344.0",
    "qrcode.react": "^3.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "socket.io-client": "^4.7.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "vite": "^5.1.4"
  }
}
```

---

## 6. Configuration & Environment Variables

### Backend `.env`

```env
# Server Port
PORT=5000

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=whatsapp_db
DB_PORT=3306

# JWT Security
JWT_SECRET=your_super_secret_jwt_key_2026

# Meta WhatsApp Cloud API (Optional Default)
META_WA_PHONE_NUMBER_ID=
META_WA_ACCESS_TOKEN=
META_WA_BUSINESS_ACCOUNT_ID=
META_WA_WEBHOOK_VERIFY_TOKEN=whatsapp_suite_secure_token

# AI Assistant Provider (openrouter, openai, ollama)
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Optional External CRM Webhook Integration
CRM_WEBHOOK_URL=https://your-crm.com/api/contact-lookup
CRM_API_KEY=crm_secret_key
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5000
```

---

## 7. Running & Deploying Independently

### Option A: Local Development

1. **Start Backend**:
   ```bash
   cd whatsapp-backend
   npm install
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd whatsapp-frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:5173` to access the WhatsApp Suite.

---

### Option B: Production Deployment via Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  whatsapp-db:
    image: mysql:8.0
    container_name: whatsapp-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: secure_root_password
      MYSQL_DATABASE: whatsapp_db
    ports:
      - "3306:3306"
    volumes:
      - wa_db_data:/var/lib/mysql

  whatsapp-backend:
    build: ./whatsapp-backend
    container_name: whatsapp-api
    restart: always
    environment:
      - DB_HOST=whatsapp-db
      - DB_USER=root
      - DB_PASSWORD=secure_root_password
      - DB_NAME=whatsapp_db
      - PORT=5000
    ports:
      - "5000:5000"
    depends_on:
      - whatsapp-db
    volumes:
      - wa_sessions:/app/.wwebjs_auth

  whatsapp-frontend:
    build: ./whatsapp-frontend
    container_name: whatsapp-ui
    restart: always
    ports:
      - "80:80"
    depends_on:
      - whatsapp-backend

volumes:
  wa_db_data:
  wa_sessions:
```

---

## 8. External CRM & Webhook Integration API

Once running as a standalone app, any external CRM (Salesforce, HubSpot, Zoho, custom PHP/Node CRM) can control WhatsApp using clean REST APIs:

### 1. Send Single Message (with Dynamic Variables)
```http
POST /api/whatsapp/send
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "chatId": "919876543210@c.us",
  "message": "Hello {{name}}! Your invoice #{{invoice_no}} for ₹{{amount}} is ready."
}
```

### 2. Send Media / PDF Document
```http
POST /api/whatsapp/send-media
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "chatId": "919876543210@c.us",
  "mediaUrl": "https://your-domain.com/invoices/INV-101.pdf",
  "mediaType": "document",
  "caption": "Here is your invoice copy, {{name}}.",
  "filename": "Invoice-INV101.pdf"
}
```

### 3. Trigger Chatbot Visual Flow for a Contact
```http
POST /api/wa/flows/:flowId/trigger
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "phone": "919876543210",
  "contactName": "Rahul Sharma"
}
```

### 4. Enroll Contact in Drip Sequence
```http
POST /api/wa/automations/drip/enroll
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "phone": "919876543210",
  "sequenceId": 3
}
```

---

## ✅ Summary Checklist for Separation

1. [x] **Backend Services & Routes**: Copy 10 service files and 10 route files listed in Section 2.
2. [x] **Frontend Views & Components**: Copy 9 pages and 5 reusable components listed in Section 2.
3. [x] **Database Isolation**: Create `whatsapp_db` and allow `waDatabase.js` to initialize all 20+ tables.
4. [x] **Decouple CRM Lookups**: Use `CRM_WEBHOOK_URL` in `.env` or local `wa_contacts` metadata.
5. [x] **Deploy Standalone**: Start backend (`PORT=5000`) and frontend (`PORT=5173` or `80`).
