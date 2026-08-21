const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken: auth } = require("../middleware/authMiddleware");
const waFlowEngine = require("../services/waFlowEngine");

// ── List Flows ───────────────────────────────────────────────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const [flows] = await db.promise().query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id = f.id) as node_count,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'active') as active_runs,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'completed') as completed_runs,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'handed_off') as handoff_runs
       FROM wa_flows f
       ORDER BY f.created_at DESC`
    );
    res.json(flows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Single Flow with Nodes ───────────────────────────────────────────────
router.get("/:id", auth, async (req, res) => {
  try {
    const [flows] = await db.promise().query(
      "SELECT * FROM wa_flows WHERE id = ?",
      [req.params.id]
    );
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const [nodes] = await db.promise().query(
      "SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC",
      [req.params.id]
    );

    const parsedNodes = nodes.map(n => ({
      ...n,
      config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
    }));

    res.json({ ...flows[0], nodes: parsedNodes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Flow ──────────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const { name, description, trigger_type = "keyword", trigger_config = {}, entry_node_key = "start", nodes = [] } = req.body;
    if (!name) return res.status(400).json({ error: "Flow name is required" });

    const [flowResult] = await db.promise().query(
      `INSERT INTO wa_flows (name, description, status, trigger_type, trigger_config, entry_node_key, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?, ?)`,
      [
        name,
        description || null,
        trigger_type,
        JSON.stringify(trigger_config),
        entry_node_key,
        req.user?.id || null,
      ]
    );
    const flowId = flowResult.insertId;

    // Default starter template if none provided
    const nodesToInsert = nodes.length > 0 ? nodes : [
      { node_key: "start", node_type: "start", config: { next_node_key: "welcome_menu" }, position_x: 100, position_y: 100 },
      { node_key: "welcome_menu", node_type: "send_buttons", config: { 
          text: "Hello {name}! Welcome to ACHME. How can we assist you today?",
          buttons: [
            { reply_id: "btn_services", title: "1. 🛠️ Services", next_node_key: "services_msg" },
            { reply_id: "btn_support", title: "2. 👤 Live Support", next_node_key: "support_handoff" }
          ]
        }, position_x: 100, position_y: 220 
      },
      { node_key: "services_msg", node_type: "send_message", config: { text: "We provide comprehensive HVAC, Electrical, and AMC solutions across {city}!", next_node_key: "end" }, position_x: 50, position_y: 360 },
      { node_key: "support_handoff", node_type: "handoff", config: { note: "Connecting you to our support specialist..." }, position_x: 250, position_y: 360 },
      { node_key: "end", node_type: "end", config: {}, position_x: 150, position_y: 500 }
    ];

    for (const node of nodesToInsert) {
      await db.promise().query(
        `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          flowId,
          node.node_key,
          node.node_type,
          JSON.stringify(node.config || {}),
          node.position_x || 0,
          node.position_y || 0,
        ]
      );
    }

    const [newFlow] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [flowId]);
    res.status(201).json(newFlow[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update Flow & Nodes ──────────────────────────────────────────────────────
router.put("/:id", auth, async (req, res) => {
  try {
    const { name, description, status, trigger_type, trigger_config, entry_node_key = "start", nodes } = req.body;
    const flowId = req.params.id;

    await db.promise().query(
      `UPDATE wa_flows 
       SET name = COALESCE(?, name),
           description = ?,
           status = COALESCE(?, status),
           trigger_type = COALESCE(?, trigger_type),
           trigger_config = COALESCE(?, trigger_config),
           entry_node_key = COALESCE(?, entry_node_key),
           updated_at = NOW()
       WHERE id = ?`,
      [
        name,
        description,
        status,
        trigger_type,
        trigger_config ? JSON.stringify(trigger_config) : null,
        entry_node_key,
        flowId,
      ]
    );

    if (Array.isArray(nodes)) {
      // Replace nodes
      await db.promise().query("DELETE FROM wa_flow_nodes WHERE flow_id = ?", [flowId]);
      for (const node of nodes) {
        await db.promise().query(
          `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            flowId,
            node.node_key,
            node.node_type,
            JSON.stringify(node.config || {}),
            node.position_x || 0,
            node.position_y || 0,
          ]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Toggle Active Status ─────────────────────────────────────────────────────
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "active", "archived"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    await db.promise().query(
      "UPDATE wa_flows SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, req.params.id]
    );

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Flow ──────────────────────────────────────────────────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM wa_flows WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Flow directly for a Phone Number ──────────────────────────────────
router.post("/:id/trigger-phone", auth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    const cleanPhone = phone.replace(/\D/g, "");

    const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [req.params.id]);
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const result = await waFlowEngine.startFlowRun(flows[0], cleanPhone);
    res.json({ success: true, message: `Flow "${flows[0].name}" started for +${cleanPhone}`, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Flow Runs Audit History ───────────────────────────────────────────────
router.get("/:id/runs", auth, async (req, res) => {
  try {
    const [runs] = await db.promise().query(
      `SELECT r.*, c.name as contact_name, c.company as contact_company
       FROM wa_flow_runs r
       LEFT JOIN wa_contacts c ON r.phone = c.phone
       WHERE r.flow_id = ?
       ORDER BY r.started_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Interactive In-Memory Test Simulator ──────────────────────────────────────
router.post("/:id/test-simulate", auth, async (req, res) => {
  try {
    const { input = "", state = null } = req.body;
    const [flows] = await db.promise().query("SELECT * FROM wa_flows WHERE id = ?", [req.params.id]);
    if (!flows.length) return res.status(404).json({ error: "Flow not found" });

    const [nodes] = await db.promise().query("SELECT * FROM wa_flow_nodes WHERE flow_id = ? ORDER BY id ASC", [req.params.id]);
    const flow = {
      ...flows[0],
      nodes: nodes.map(n => ({
        ...n,
        config: typeof n.config === "string" ? JSON.parse(n.config) : (n.config || {})
      }))
    };

    const simResult = await waFlowEngine.simulateFlowStep(flow, input, state);
    res.json({ success: true, ...simResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Flow Analytics & Conversion Funnel ─────────────────────────────────────────
router.get("/:id/analytics", auth, async (req, res) => {
  try {
    const flowId = req.params.id;
    const [[summary]] = await db.promise().query(
      `SELECT 
        COUNT(*) as total_runs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'handed_off' THEN 1 ELSE 0 END) as handoff_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
       FROM wa_flow_runs WHERE flow_id = ?`,
      [flowId]
    );

    const [events] = await db.promise().query(
      `SELECT node_key, COUNT(*) as hit_count
       FROM wa_flow_run_events e
       JOIN wa_flow_runs r ON e.run_id = r.id
       WHERE r.flow_id = ?
       GROUP BY node_key ORDER BY hit_count DESC LIMIT 20`,
      [flowId]
    );

    res.json({
      totalRuns: summary?.total_runs || 0,
      completedRuns: summary?.completed_count || 0,
      handoffRuns: summary?.handoff_count || 0,
      activeRuns: summary?.active_count || 0,
      nodeDropoffs: events || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Seed 6 Comprehensive Prebuilt Business Chatbot Flows ───────────────────────
router.post("/seed", auth, async (req, res) => {
  try {
    const seedFlows = [
      {
        name: "Interactive Main Business & Services Menu",
        description: "24/7 Universal WhatsApp receptionist: Services, Instant Appointment Booking, Working Hours, and Live Agent Transfer for all inbound chats.",
        trigger_type: "all_inbound",
        trigger_config: { keywords: ["hi", "hello", "menu", "start", "help", "hey", "namaste", "info", "welcome"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "main_menu" } },
          {
            node_key: "main_menu",
            node_type: "send_buttons",
            config: {
              text: "👋 {Hi|Hello|Greetings} {name}! Welcome to {company}.\nHow can we help you today? Please choose an option or reply with the number:",
              footer_text: "ACHME Smart Assistant • Reply MENU anytime",
              buttons: [
                { reply_id: "opt_services", title: "1. 🛠️ Our Services", next_node_key: "services_menu" },
                { reply_id: "opt_booking", title: "2. 📅 Book Service", next_node_key: "ask_booking_date" },
                { reply_id: "opt_hours", title: "3. 🕒 Hours & Address", next_node_key: "hours_info" },
                { reply_id: "opt_agent", title: "4. 👤 Live Agent", next_node_key: "agent_handoff" },
              ]
            }
          },
          {
            node_key: "services_menu",
            node_type: "send_buttons",
            config: {
              text: "🛠️ *Our Core Solutions across {city}:*\n• Commercial HVAC & AC Maintenance\n• Comprehensive AMC Contracts\n• Electrical & Fire Safety Compliance\n\nWould you like our brochure or request an instant quote?",
              buttons: [
                { reply_id: "opt_brochure", title: "📄 Send Brochure", next_node_key: "send_brochure_pdf" },
                { reply_id: "opt_quote", title: "💼 Request Quote", next_node_key: "ask_quote_service" },
                { reply_id: "opt_back", title: "🔙 Back to Menu", next_node_key: "main_menu" },
              ]
            }
          },
          {
            node_key: "send_brochure_pdf",
            node_type: "send_message",
            config: {
              text: "📄 Here is our complete Service & AMC Catalog for {company}:\nhttps://achme.in/brochure.pdf\n\nReply MENU anytime to return to the main menu.",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_quote_service",
            node_type: "collect_input",
            config: {
              prompt_text: "Please describe what service or equipment you need a quote for:",
              var_key: "service_inquiry",
              next_node_key: "save_quote_lead"
            }
          },
          {
            node_key: "save_quote_lead",
            node_type: "create_lead",
            config: {
              default_service: "Quotation Request",
              notes: "WhatsApp Quotation Request: {service_inquiry}",
              next_node_key: "thank_you_quote"
            }
          },
          {
            node_key: "thank_you_quote",
            node_type: "send_message",
            config: {
              text: "✅ Thank you {name}! Your inquiry for *{service_inquiry}* has been sent to our estimation engineers. We will send the proposal shortly.",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_booking_date",
            node_type: "collect_input",
            config: {
              prompt_text: "📅 Which date would you like to schedule your service appointment for? (e.g. Tomorrow or 25 Aug)",
              var_key: "booking_date",
              next_node_key: "ask_booking_city"
            }
          },
          {
            node_key: "ask_booking_city",
            node_type: "collect_input",
            config: {
              prompt_text: "Which city/area is the service location in? (e.g. Bangalore, Chennai)",
              var_key: "booking_city",
              next_node_key: "save_appointment_lead"
            }
          },
          {
            node_key: "save_appointment_lead",
            node_type: "create_lead",
            config: {
              default_service: "Service Appointment",
              notes: "Service Appointment Booked: Date {booking_date} in {booking_city}",
              next_node_key: "confirm_appointment_msg"
            }
          },
          {
            node_key: "confirm_appointment_msg",
            node_type: "send_message",
            config: {
              text: "🎉 Appointment Confirmed!\n• *Date:* {booking_date}\n• *Location:* {booking_city}\n• *Service:* AMC & Inspection\n\nOur technician will arrive between {start_time} and {end_time}. Thank you for choosing {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "hours_info",
            node_type: "send_message",
            config: {
              text: "🕒 *{company} Working Hours & Info:*\n• Monday to Saturday: {start_time} – {end_time}\n• Location: {city}\n• Emergency Hotline: +91 98765 43210\n\nReply MENU anytime to view the main menu.",
              next_node_key: "end"
            }
          },
          {
            node_key: "agent_handoff",
            node_type: "handoff",
            config: { note: "Connecting you with our support specialist. Please stay online." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Live CRM Invoice & Payment Status Lookup Bot",
        description: "Allows customers to query their latest invoice, due date, outstanding amount, and payment options automatically from CRM database.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["invoice", "bill", "payment", "due", "pay", "receipt", "account"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "crm_lookup_invoice" } },
          {
            node_key: "crm_lookup_invoice",
            node_type: "crm_lookup",
            config: {
              lookup_type: "invoice",
              branch_on_result: true,
              found_next: "show_invoice_details",
              not_found_next: "no_invoice_found"
            }
          },
          {
            node_key: "show_invoice_details",
            node_type: "send_buttons",
            config: {
              text: "📄 *Invoice Details for {customer_name}:*\n• *Invoice #:* {invoice_no}\n• *Total Amount:* {amount}\n• *Status:* {payment_status}\n• *Due Date:* {due_date}\n\nWould you like to pay online or download the PDF?",
              buttons: [
                { reply_id: "pay_now", title: "💳 Pay Online Link", next_node_key: "send_pay_link" },
                { reply_id: "download_pdf", title: "📥 Download PDF", next_node_key: "send_invoice_pdf" },
                { reply_id: "billing_agent", title: "👤 Billing Support", next_node_key: "handoff_billing" }
              ]
            }
          },
          {
            node_key: "send_pay_link",
            node_type: "send_message",
            config: {
              text: "💳 You can securely pay invoice *{invoice_no}* ({amount}) online via UPI, NetBanking or Cards:\nhttps://achme.in/pay/{invoice_no}\n\nOnce paid, your payment receipt will be generated instantly!",
              next_node_key: "end"
            }
          },
          {
            node_key: "send_invoice_pdf",
            node_type: "send_message",
            config: {
              text: "📥 Here is your official invoice copy:\nhttps://achme.in/invoices/{invoice_no}.pdf\n\nThank you for your business with {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "no_invoice_found",
            node_type: "send_buttons",
            config: {
              text: "🔍 We couldn't find an open invoice for this phone number.\nWould you like our accounts desk to verify your details?",
              buttons: [
                { reply_id: "check_agent", title: "👤 Talk to Accounts", next_node_key: "handoff_billing" },
                { reply_id: "back_home", title: "🏠 Main Menu", next_node_key: "end" }
              ]
            }
          },
          {
            node_key: "handoff_billing",
            node_type: "handoff",
            config: { note: "Connecting to Accounts & Billing desk regarding invoice inquiries." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "AMC Contract Expiry & Service Renewal Bot",
        description: "Checks active AMC contracts from CRM database and assists customers in scheduling regular service or renewing expiring contracts.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["amc", "contract", "renewal", "maintenance", "service visit"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "crm_lookup_amc" } },
          {
            node_key: "crm_lookup_amc",
            node_type: "crm_lookup",
            config: {
              lookup_type: "amc",
              branch_on_result: true,
              found_next: "show_amc_status",
              not_found_next: "no_amc_found"
            }
          },
          {
            node_key: "show_amc_status",
            node_type: "send_buttons",
            config: {
              text: "🛡️ *AMC Contract Status for {customer_name}:*\n• *Contract #:* {amc_contract_no}\n• *Service Type:* {amc_service}\n• *Status:* {amc_status}\n• *Valid Until:* {amc_expiry}\n\nHow can we help with your maintenance?",
              buttons: [
                { reply_id: "book_visit", title: "📅 Schedule Visit", next_node_key: "ask_visit_date" },
                { reply_id: "renew_amc", title: "🔄 Renew AMC", next_node_key: "ask_amc_renewal" },
                { reply_id: "amc_desk", title: "👤 AMC Helpdesk", next_node_key: "handoff_amc" }
              ]
            }
          },
          {
            node_key: "ask_visit_date",
            node_type: "collect_input",
            config: {
              prompt_text: "📅 Please enter your preferred date for the technician visit:",
              var_key: "visit_date",
              next_node_key: "confirm_amc_visit"
            }
          },
          {
            node_key: "confirm_amc_visit",
            node_type: "send_message",
            config: {
              text: "✅ AMC Inspection scheduled for *{visit_date}* under Contract #{amc_contract_no}. An engineer will reach out prior to visit!",
              next_node_key: "end"
            }
          },
          {
            node_key: "ask_amc_renewal",
            node_type: "create_lead",
            config: {
              default_service: "AMC Contract Renewal",
              notes: "Requested AMC Contract Renewal for #{amc_contract_no}",
              next_node_key: "confirm_amc_renewal"
            }
          },
          {
            node_key: "confirm_amc_renewal",
            node_type: "send_message",
            config: {
              text: "🎉 Thank you {name}! Our AMC Renewal Manager will send you an exclusive renewal quote with early bird benefits shortly.",
              next_node_key: "end"
            }
          },
          {
            node_key: "no_amc_found",
            node_type: "send_buttons",
            config: {
              text: "🛡️ No active AMC contract found for your number. Would you like a free inspection & AMC quotation?",
              buttons: [
                { reply_id: "get_amc_quote", title: "💼 Get AMC Quote", next_node_key: "ask_amc_renewal" },
                { reply_id: "talk_rep", title: "👤 Talk to Specialist", next_node_key: "handoff_amc" }
              ]
            }
          },
          {
            node_key: "handoff_amc",
            node_type: "handoff",
            config: { note: "Connecting to AMC contracts & technical support desk." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Instant Quotation & Lead Qualifier Bot",
        description: "Step-by-step qualification tree collecting customer name, equipment size, location, and automatically creates qualified CRM leads.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["quote", "price", "pricing", "cost", "estimate", "rate"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "ask_name" } },
          {
            node_key: "ask_name",
            node_type: "collect_input",
            config: {
              prompt_text: "👋 Welcome to {company}! What is your full name or company name?",
              var_key: "lead_name",
              next_node_key: "ask_service_type"
            }
          },
          {
            node_key: "ask_service_type",
            node_type: "send_buttons",
            config: {
              text: "Nice to meet you, {lead_name}! Which service category are you looking for?",
              buttons: [
                { reply_id: "opt_ac", title: "1. ❄️ HVAC / AC AMC", next_node_key: "ask_location" },
                { reply_id: "opt_elec", title: "2. ⚡ Electrical Audit", next_node_key: "ask_location" },
                { reply_id: "opt_fire", title: "3. 🧯 Fire Safety", next_node_key: "ask_location" }
              ]
            }
          },
          {
            node_key: "ask_location",
            node_type: "collect_input",
            config: {
              prompt_text: "Which city/area is your site located in?",
              var_key: "lead_city",
              next_node_key: "save_qualified_lead"
            }
          },
          {
            node_key: "save_qualified_lead",
            node_type: "create_lead",
            config: {
              default_service: "{selected_option}",
              notes: "Qualified Lead: {lead_name} in {lead_city} interested in {selected_option}",
              next_node_key: "thank_you_qualified"
            }
          },
          {
            node_key: "thank_you_qualified",
            node_type: "send_message",
            config: {
              text: "🎉 Thank you {lead_name}!\nYour quotation request for *{selected_option}* in *{lead_city}* has been registered in our CRM.\n\nOur project engineer will contact you shortly with a personalized proposal!",
              next_node_key: "end"
            }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "24/7 VIP Support Desk & Live Agent Handoff",
        description: "Handles emergency service requests, ticket logging, and transfers urgent complaints directly to human agents in Live Chat.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["support", "agent", "human", "complaint", "issue", "emergency", "breakdown"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "support_menu" } },
          {
            node_key: "support_menu",
            node_type: "send_buttons",
            config: {
              text: "🛠️ *{company} Support & Service Desk*\nHow can we help resolve your issue today?",
              buttons: [
                { reply_id: "opt_breakdown", title: "🚨 Emergency Breakdown", next_node_key: "ask_emergency_details" },
                { reply_id: "opt_status", title: "📋 Service Ticket Status", next_node_key: "crm_lookup_ticket" },
                { reply_id: "opt_live_agent", title: "👤 Live Support Agent", next_node_key: "live_handoff" }
              ]
            }
          },
          {
            node_key: "ask_emergency_details",
            node_type: "collect_input",
            config: {
              prompt_text: "🚨 Please describe the breakdown or emergency issue and site location:",
              var_key: "emergency_note",
              next_node_key: "save_emergency_lead"
            }
          },
          {
            node_key: "save_emergency_lead",
            node_type: "create_lead",
            config: {
              default_service: "Emergency Breakdown",
              notes: "URGENT BREAKDOWN REPORT: {emergency_note}",
              next_node_key: "live_handoff"
            }
          },
          {
            node_key: "crm_lookup_ticket",
            node_type: "send_message",
            config: {
              text: "📋 Checking your recent service requests... Your ticket for *{service}* is currently assigned to a senior technician. Expected resolution by {end_time}.",
              next_node_key: "end"
            }
          },
          {
            node_key: "live_handoff",
            node_type: "handoff",
            config: { note: "🚨 Urgent support request transferred to Live Chat agent desk." }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      },
      {
        name: "Customer Feedback & Google Review Collector",
        description: "Post-service CSAT rating collector (1-5 Stars). 5-star ratings get Google Review link; lower ratings route to quality assurance team.",
        trigger_type: "keyword",
        trigger_config: { keywords: ["feedback", "review", "rate", "rating", "survey"] },
        entry_node_key: "start",
        nodes: [
          { node_key: "start", node_type: "start", config: { next_node_key: "ask_rating" } },
          {
            node_key: "ask_rating",
            node_type: "send_buttons",
            config: {
              text: "🌟 {Hi|Hello} {name}! How satisfied were you with our recent service by {company}?",
              buttons: [
                { reply_id: "rate_5", title: "⭐⭐⭐⭐⭐ Excellent (5)", next_node_key: "rating_5_branch" },
                { reply_id: "rate_4", title: "⭐⭐⭐⭐ Good (4)", next_node_key: "rating_5_branch" },
                { reply_id: "rate_low", title: "⚠️ Needs Improvement (1-3)", next_node_key: "rating_low_branch" }
              ]
            }
          },
          {
            node_key: "rating_5_branch",
            node_type: "send_message",
            config: {
              text: "🎉 We are thrilled to hear that, {name}! Could you take 30 seconds to share your review on Google? It helps us tremendously:\n👉 https://g.page/r/achme/review\n\nThank you for choosing {company}!",
              next_node_key: "end"
            }
          },
          {
            node_key: "rating_low_branch",
            node_type: "collect_input",
            config: {
              prompt_text: "We apologize that our service did not meet your full expectations. Please share what we can improve:",
              var_key: "feedback_comment",
              next_node_key: "save_feedback_lead"
            }
          },
          {
            node_key: "save_feedback_lead",
            node_type: "create_lead",
            config: {
              default_service: "Quality Escalation",
              notes: "Service Feedback (Escalation): {feedback_comment}",
              next_node_key: "thank_you_feedback"
            }
          },
          {
            node_key: "thank_you_feedback",
            node_type: "send_message",
            config: {
              text: "🙏 Thank you for your honest feedback. Our Quality Assurance Head has been notified and will contact you to resolve this immediately.",
              next_node_key: "end"
            }
          },
          { node_key: "end", node_type: "end", config: {} }
        ]
      }
    ];

    for (const f of seedFlows) {
      const [existing] = await db.promise().query("SELECT id FROM wa_flows WHERE name = ?", [f.name]);
      let flowId = null;
      if (existing.length > 0) {
        flowId = existing[0].id;
        await db.promise().query(
          "UPDATE wa_flows SET description=?, trigger_type=?, trigger_config=?, entry_node_key=?, status='active', updated_at=NOW() WHERE id=?",
          [f.description, f.trigger_type, JSON.stringify(f.trigger_config), f.entry_node_key, flowId]
        );
      } else {
        const [resFlow] = await db.promise().query(
          `INSERT INTO wa_flows (name, description, status, trigger_type, trigger_config, entry_node_key, created_by)
           VALUES (?, ?, 'active', ?, ?, ?, ?)`,
          [f.name, f.description, f.trigger_type, JSON.stringify(f.trigger_config), f.entry_node_key, req.user?.id || null]
        );
        flowId = resFlow.insertId;
      }

      // Re-insert nodes
      await db.promise().query("DELETE FROM wa_flow_nodes WHERE flow_id = ?", [flowId]);
      let yPos = 100;
      for (const node of f.nodes) {
        await db.promise().query(
          `INSERT INTO wa_flow_nodes (flow_id, node_key, node_type, config, position_x, position_y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [flowId, node.node_key, node.node_type, JSON.stringify(node.config || {}), 150, yPos]
        );
        yPos += 120;
      }
    }

    const [allFlows] = await db.promise().query(
      `SELECT f.*, 
        (SELECT COUNT(*) FROM wa_flow_nodes n WHERE n.flow_id = f.id) as node_count,
        (SELECT COUNT(*) FROM wa_flow_runs r WHERE r.flow_id = f.id AND r.status = 'active') as active_runs
       FROM wa_flows f
       ORDER BY f.created_at DESC`
    );
    res.json({ success: true, count: allFlows.length, flows: allFlows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
