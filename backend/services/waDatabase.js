const db = require("../config/database");

// Promisify the connection's query since it's a mysql2 connection (not pool)
function queryAsync(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

async function ensureWATables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS wa_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'MARKETING',
      language VARCHAR(10) DEFAULT 'en',
      header_type VARCHAR(50) DEFAULT NULL,
      header_value TEXT DEFAULT NULL,
      body TEXT NOT NULL,
      footer TEXT DEFAULT NULL,
      button_type VARCHAR(50) DEFAULT NULL,
      buttons JSON DEFAULT NULL,
      variables JSON DEFAULT NULL,
      meta_template_id VARCHAR(100) DEFAULT NULL,
      meta_status VARCHAR(50) DEFAULT 'APPROVED',
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_contact_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      total_contacts INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_group_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      name VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      notes TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES wa_contact_groups(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Dedicated WA contacts (distinct from group_contacts — these are your permanent WA contact book)
    `CREATE TABLE IF NOT EXISTS wa_contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      country_code VARCHAR(5) DEFAULT '91',
      email VARCHAR(255) DEFAULT NULL,
      tags JSON DEFAULT NULL,
      custom_fields JSON DEFAULT NULL,
      opt_in_status TINYINT(1) DEFAULT 1,
      last_contacted DATETIME DEFAULT NULL,
      is_blocked TINYINT(1) DEFAULT 0,
      is_unsubscribed TINYINT(1) DEFAULT 0,
      source VARCHAR(100) DEFAULT NULL,
      crm_ref_type VARCHAR(50) DEFAULT NULL,
      crm_ref_id INT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Track opt-outs (when user replies STOP / UNSUBSCRIBE)
    `CREATE TABLE IF NOT EXISTS wa_opt_outs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      reason VARCHAR(100) DEFAULT 'user_request',
      opt_out_keyword VARCHAR(50) DEFAULT NULL,
      opted_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_optout_phone (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Multiple WhatsApp Business account configurations
    `CREATE TABLE IF NOT EXISTS wa_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(30) DEFAULT NULL,
      phone_number_id VARCHAR(255) DEFAULT NULL,
      access_token TEXT DEFAULT NULL,
      waba_id VARCHAR(255) DEFAULT NULL,
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT 'crm_verify_123',
      business_account_id VARCHAR(255) DEFAULT NULL,
      connection_type ENUM('cloud_api','web_session') DEFAULT 'cloud_api',
      is_active TINYINT(1) DEFAULT 1,
      is_default TINYINT(1) DEFAULT 0,
      quality_rating VARCHAR(20) DEFAULT NULL,
      messaging_limit VARCHAR(50) DEFAULT NULL,
      webhook_url TEXT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Automation rules
    `CREATE TABLE IF NOT EXISTS wa_automations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL,
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      sequence_delay_seconds INT DEFAULT 7,
      followup_message_text TEXT DEFAULT NULL,
      followup_media_type VARCHAR(20) DEFAULT NULL,
      followup_media_url TEXT DEFAULT NULL,
      followup_template_id INT DEFAULT NULL,
      flow_id INT DEFAULT NULL,
      group_id INT DEFAULT NULL,
      delay_minutes INT DEFAULT 0,
      conditions JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      run_count INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Clickable quick-reply options attached to an automation's message
    `CREATE TABLE IF NOT EXISTS wa_automation_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      automation_id INT NOT NULL,
      label VARCHAR(255) NOT NULL,
      reply_text TEXT NOT NULL,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Tracks the most recent menu sent to a phone, so the next inbound
    // message/button-tap can be matched back to its options
    `CREATE TABLE IF NOT EXISTS wa_pending_menus (
      phone VARCHAR(20) PRIMARY KEY,
      automation_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Automation execution history
    `CREATE TABLE IF NOT EXISTS wa_automation_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      automation_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      trigger_data JSON DEFAULT NULL,
      status ENUM('sent','failed','skipped') DEFAULT 'sent',
      error TEXT DEFAULT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (automation_id) REFERENCES wa_automations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      type ENUM('text','template','media') DEFAULT 'text',
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      group_id INT DEFAULT NULL,
      whatsapp_number VARCHAR(30) DEFAULT NULL,
      status ENUM('draft','scheduled','running','completed','paused','failed','cancelled') DEFAULT 'draft',
      scheduled_at DATETIME DEFAULT NULL,
      started_at DATETIME DEFAULT NULL,
      completed_at DATETIME DEFAULT NULL,
      total_contacts INT DEFAULT 0,
      sent_count INT DEFAULT 0,
      delivered_count INT DEFAULT 0,
      read_count INT DEFAULT 0,
      failed_count INT DEFAULT 0,
      daily_limit INT DEFAULT 0,
      sent_today INT DEFAULT 0,
      last_sent_date DATE DEFAULT NULL,
      start_time VARCHAR(10) DEFAULT '09:00',
      end_time VARCHAR(10) DEFAULT '21:00',
      timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
      random_delay_min INT DEFAULT 8,
      random_delay_max INT DEFAULT 15,
      pause_every INT DEFAULT 25,
      pause_duration_min INT DEFAULT 120,
      pause_duration_max INT DEFAULT 300,
      retry_failed TINYINT(1) DEFAULT 1,
      max_retries INT DEFAULT 3,
      retry_delay_min INT DEFAULT 15,
      retry_delay_max INT DEFAULT 30,
      exclude_prev_recipients TINYINT(1) DEFAULT 0,
      duplicate_filter TINYINT(1) DEFAULT 1,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_campaign_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      template_components JSON DEFAULT NULL,
      status ENUM('queued','sending','sent','delivered','read','failed','skipped','opted_out') DEFAULT 'queued',
      wa_message_id VARCHAR(255) DEFAULT NULL,
      error TEXT DEFAULT NULL,
      attempts INT DEFAULT 0,
      next_retry_at DATETIME DEFAULT NULL,
      reply_received TINYINT(1) DEFAULT 0,
      opt_out TINYINT(1) DEFAULT 0,
      scheduled_time DATETIME DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_message_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaign_id INT DEFAULT NULL,
      campaign_message_id INT DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      direction ENUM('outbound','inbound') DEFAULT 'outbound',
      message_type ENUM('text','template','media','interactive') DEFAULT 'text',
      message_text TEXT DEFAULT NULL,
      template_name VARCHAR(255) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      status ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
      error TEXT DEFAULT NULL,
      metadata JSON DEFAULT NULL,
      sent_at DATETIME DEFAULT NULL,
      delivered_at DATETIME DEFAULT NULL,
      read_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_webhook_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_type VARCHAR(100) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(20) DEFAULT NULL,
      status VARCHAR(50) DEFAULT NULL,
      payload JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // AI knowledge base documents (.txt/.md/.csv/.docx) — extracted text is
    // injected into the AI auto-reply's system prompt as reference context
    `CREATE TABLE IF NOT EXISTS wa_knowledge_base (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      content LONGTEXT NOT NULL,
      char_count INT DEFAULT 0,
      uploaded_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // AI auto-reply settings (single row, id=1)
    `CREATE TABLE IF NOT EXISTS wa_ai_settings (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) DEFAULT 0,
      provider VARCHAR(50) DEFAULT 'openrouter',
      model VARCHAR(255) DEFAULT 'meta-llama/llama-3.3-70b-instruct:free',
      api_key TEXT DEFAULT NULL,
      system_prompt TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS user_wa_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      phone_number_id VARCHAR(255) NOT NULL,
      access_token TEXT NOT NULL,
      waba_id VARCHAR(255) DEFAULT NULL,
      app_secret TEXT DEFAULT NULL,
      verify_token VARCHAR(255) DEFAULT 'crm_verify_123',
      business_account_id VARCHAR(255) DEFAULT NULL,
      is_enabled TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Welcome Auto-Reply Configuration (single row, id=1)
    `CREATE TABLE IF NOT EXISTS wa_welcome_settings (
      id INT PRIMARY KEY DEFAULT 1,
      enabled TINYINT(1) DEFAULT 1,
      welcome_type ENUM('text','template','ai') DEFAULT 'text',
      welcome_text TEXT DEFAULT NULL,
      template_id INT DEFAULT NULL,
      cooldown_hours INT DEFAULT 24,
      working_hours_only TINYINT(1) DEFAULT 0,
      start_time VARCHAR(10) DEFAULT '09:00',
      end_time VARCHAR(10) DEFAULT '21:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Saved Quick Reply Snippets (/shortcut)
    `CREATE TABLE IF NOT EXISTS wa_quick_replies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      shortcut VARCHAR(50) NOT NULL,
      message_text TEXT NOT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Emoji reactions on messages
    `CREATE TABLE IF NOT EXISTS wa_reactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      wa_message_id VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      emoji VARCHAR(30) NOT NULL,
      sender_type ENUM('agent','customer') DEFAULT 'agent',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reaction_msg (wa_message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Chatbot Visual Flows & State Machine
    `CREATE TABLE IF NOT EXISTS wa_flows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      status ENUM('draft','active','archived') DEFAULT 'draft',
      trigger_type VARCHAR(50) DEFAULT 'keyword',
      trigger_config JSON DEFAULT NULL,
      entry_node_key VARCHAR(100) DEFAULT 'start',
      fallback_policy JSON DEFAULT NULL,
      execution_count INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Flow Nodes (graph steps)
    `CREATE TABLE IF NOT EXISTS wa_flow_nodes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      node_key VARCHAR(100) NOT NULL,
      node_type VARCHAR(50) NOT NULL,
      config JSON DEFAULT NULL,
      position_x FLOAT DEFAULT 0,
      position_y FLOAT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flow_id) REFERENCES wa_flows(id) ON DELETE CASCADE,
      UNIQUE KEY uq_flow_node (flow_id, node_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Active flow runs per customer
    `CREATE TABLE IF NOT EXISTS wa_flow_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flow_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      status ENUM('active','completed','handed_off','timed_out','paused_by_agent','failed') DEFAULT 'active',
      current_node_key VARCHAR(100) DEFAULT NULL,
      last_prompt_msg_id VARCHAR(255) DEFAULT NULL,
      vars JSON DEFAULT NULL,
      reprompt_count INT DEFAULT 0,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_advanced_at DATETIME DEFAULT NULL,
      ended_at DATETIME DEFAULT NULL,
      end_reason VARCHAR(255) DEFAULT NULL,
      FOREIGN KEY (flow_id) REFERENCES wa_flows(id) ON DELETE CASCADE,
      INDEX idx_active_phone_flow (phone, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Flow run execution audit events
    `CREATE TABLE IF NOT EXISTS wa_flow_run_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      run_id INT NOT NULL,
      node_key VARCHAR(100) DEFAULT NULL,
      event_type VARCHAR(50) DEFAULT NULL,
      payload JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES wa_flow_runs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Scoped Public API Keys
    `CREATE TABLE IF NOT EXISTS wa_api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      key_prefix VARCHAR(30) NOT NULL,
      key_hash VARCHAR(100) NOT NULL UNIQUE,
      scopes JSON DEFAULT NULL,
      last_used_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      revoked_at DATETIME DEFAULT NULL,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Knowledge Base Chunks (for hybrid / RAG retrieval)
    `CREATE TABLE IF NOT EXISTS wa_knowledge_chunks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      document_id INT NOT NULL,
      chunk_index INT NOT NULL,
      content LONGTEXT NOT NULL,
      char_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES wa_knowledge_base(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Native WhatsApp Payments & Transaction Tracking
    `CREATE TABLE IF NOT EXISTS wa_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'INR',
      description TEXT DEFAULT NULL,
      payment_link TEXT DEFAULT NULL,
      provider VARCHAR(50) DEFAULT 'razorpay',
      status ENUM('created','pending','paid','failed','expired','cancelled') DEFAULT 'created',
      transaction_id VARCHAR(255) DEFAULT NULL,
      invoice_id INT DEFAULT NULL,
      quotation_id INT DEFAULT NULL,
      created_by INT DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Drip Campaigns & Multi-Day Sequences
    `CREATE TABLE IF NOT EXISTS wa_drip_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      trigger_type ENUM('new_lead','tag_added','manual','invoice_created','walkin_created') DEFAULT 'manual',
      trigger_config JSON DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      stop_on_reply TINYINT(1) DEFAULT 1,
      stop_on_payment TINYINT(1) DEFAULT 1,
      total_enrolled INT DEFAULT 0,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_drip_steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sequence_id INT NOT NULL,
      step_number INT NOT NULL,
      delay_days INT DEFAULT 0,
      delay_hours INT DEFAULT 0,
      template_id INT DEFAULT NULL,
      message_text TEXT DEFAULT NULL,
      media_url TEXT DEFAULT NULL,
      media_type VARCHAR(20) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sequence_id) REFERENCES wa_drip_sequences(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS wa_drip_enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sequence_id INT NOT NULL,
      phone VARCHAR(20) NOT NULL,
      contact_name VARCHAR(255) DEFAULT NULL,
      current_step INT DEFAULT 0,
      status ENUM('active','completed','stopped_by_reply','stopped_by_payment','cancelled','failed') DEFAULT 'active',
      next_run_at DATETIME DEFAULT NULL,
      last_executed_at DATETIME DEFAULT NULL,
      enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sequence_id) REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
      INDEX idx_drip_phone_status (phone, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // 0% Markup Direct Meta Category Ledger
    `CREATE TABLE IF NOT EXISTS wa_meta_ledger (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_key VARCHAR(64) DEFAULT NULL,
      phone VARCHAR(20) NOT NULL,
      category ENUM('MARKETING','UTILITY','AUTHENTICATION','SERVICE') DEFAULT 'SERVICE',
      cost_inr DECIMAL(8,4) DEFAULT 0.0000,
      markup_inr DECIMAL(8,4) DEFAULT 0.0000,
      total_billed_inr DECIMAL(8,4) DEFAULT 0.0000,
      conversation_id VARCHAR(255) DEFAULT NULL,
      wa_message_id VARCHAR(255) DEFAULT NULL,
      campaign_id INT DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'delivered',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // Shared Team Inbox Internal Collaboration Notes
    `CREATE TABLE IF NOT EXISTS wa_internal_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      author_id INT NOT NULL,
      author_name VARCHAR(100) NOT NULL,
      note_text TEXT NOT NULL,
      mentions JSON DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  ];

  for (const sql of tables) {
    try {
      await queryAsync(sql);
    } catch (err) {
      if (!err.message.includes("already exists")) {
        console.error("Error creating WhatsApp table:", err.message);
      }
    }
  }

  // Safe ALTER TABLE for adding columns to existing tables (ignore if column already exists)
  const alterStatements = [
    // wa_automations rich media, sequence delay & flow/group linkage
    "ALTER TABLE wa_automations MODIFY COLUMN trigger_type VARCHAR(100) NOT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS sequence_delay_seconds INT DEFAULT 7",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_message_text TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_media_type VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_media_url TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_template_id INT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS flow_id INT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL",

    // wa_campaigns new columns with 7-second baseline delay
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30) DEFAULT NULL",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 0",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS sent_today INT DEFAULT 0",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS last_sent_date DATE DEFAULT NULL",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS start_time VARCHAR(10) DEFAULT '09:00'",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS end_time VARCHAR(10) DEFAULT '21:00'",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Kolkata'",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS random_delay_min INT DEFAULT 7",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS random_delay_max INT DEFAULT 12",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS pause_every INT DEFAULT 25",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS pause_duration_min INT DEFAULT 120",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS pause_duration_max INT DEFAULT 300",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS retry_failed TINYINT(1) DEFAULT 1",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS retry_delay_min INT DEFAULT 15",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS retry_delay_max INT DEFAULT 30",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS exclude_prev_recipients TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS duplicate_filter TINYINT(1) DEFAULT 1",
    "ALTER TABLE wa_campaigns MODIFY COLUMN IF EXISTS status ENUM('draft','scheduled','running','completed','paused','failed','cancelled') DEFAULT 'draft'",
    
    // wa_campaign_messages new columns
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS attempts INT DEFAULT 0",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS next_retry_at DATETIME DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS reply_received TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS opt_out TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS scheduled_time DATETIME DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS location_lat DOUBLE DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS location_lng DOUBLE DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS location_name VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE wa_campaign_messages ADD COLUMN IF NOT EXISTS location_address VARCHAR(500) DEFAULT NULL",
    
    // Dedupe flag for the daily payment_due WhatsApp reminder job
    "ALTER TABLE clientinvoices ADD COLUMN IF NOT EXISTS wa_payment_due_sent TINYINT(1) DEFAULT 0",
    // Dedupe for the daily lead_followup WhatsApp reminder job
    "ALTER TABLE telecalls ADD COLUMN IF NOT EXISTS wa_followup_sent_date DATE DEFAULT NULL",
    "ALTER TABLE walkins ADD COLUMN IF NOT EXISTS wa_followup_sent_date DATE DEFAULT NULL",
    "ALTER TABLE fields ADD COLUMN IF NOT EXISTS wa_followup_sent_date DATE DEFAULT NULL",
    
    // ── Per-user WhatsApp sessions ────────────────────────────────────────────
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS session_key VARCHAR(64) DEFAULT NULL",
    "ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS session_key VARCHAR(64) DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD INDEX IF NOT EXISTS idx_session_phone (session_key, phone)",
    "ALTER TABLE wa_message_logs MODIFY COLUMN message_type VARCHAR(20) DEFAULT 'text'",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS reply_to_message_id VARCHAR(255) DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS interactive_reply_id VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS interactive_payload JSON DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS media_mime_type VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS media_size INT DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS has_media TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS is_starred TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS assigned_agent_id INT DEFAULT NULL",
    
    // Per-chat AI auto-reply control + human-takeover pause + assignment
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ai_enabled TINYINT(1) DEFAULT 1",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ai_paused_until DATETIME DEFAULT NULL",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ai_reply_count INT DEFAULT 0",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ai_autoreply_disabled TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS assigned_agent_id INT DEFAULT NULL",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS assigned_agent_name VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS ticket_status ENUM('open','pending','resolved','spam') DEFAULT 'open'",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_message_text TEXT DEFAULT NULL",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_message_at DATETIME DEFAULT NULL",
    "ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS unread_count INT DEFAULT 0",

    // Shared Team Inbox & Meta Direct Cost Ledger
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS is_internal TINYINT(1) DEFAULT 0",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS author_name VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS conversation_category ENUM('MARKETING','UTILITY','AUTHENTICATION','SERVICE') DEFAULT 'SERVICE'",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS cost_inr DECIMAL(8,4) DEFAULT 0.0000",
    "ALTER TABLE wa_message_logs ADD COLUMN IF NOT EXISTS markup_inr DECIMAL(8,4) DEFAULT 0.0000",

    // wa_flows dynamic triggers
    "ALTER TABLE wa_flows MODIFY COLUMN trigger_type VARCHAR(50) DEFAULT 'keyword'",

    // wa_automations dynamic triggers & sequence columns
    "ALTER TABLE wa_automations MODIFY COLUMN trigger_type VARCHAR(50) NOT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS media_url TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS sequence_delay_seconds INT DEFAULT 7",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_message_text TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_media_type VARCHAR(20) DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_media_url TEXT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS followup_template_id INT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS flow_id INT DEFAULT NULL",
    "ALTER TABLE wa_automations ADD COLUMN IF NOT EXISTS group_id INT DEFAULT NULL",
  ];

  for (const sql of alterStatements) {
    try {
      await queryAsync(sql);
    } catch (err) {
      // Ignore errors for alters
    }
  }

  // ── Seed Prebuilt Templates and Automation Rules ───────────────────────────
  try {
    const templatesCount = await queryAsync("SELECT COUNT(*) as count FROM wa_templates");
    if (templatesCount[0].count === 0) {
      const defaultTemplates = [
        ["welcome_greeting", "UTILITY", "en", "Welcome to ACHME", "Hello {name}! Welcome to ACHME. We are delighted to assist you. Feel free to reply anytime!", "Thank you, Team ACHME", "APPROVED"],
        ["new_lead_acknowledgement", "MARKETING", "en", "Inquiry Received", "Hi {name}, thank you for reaching out to us! Our team received your inquiry for {service}. We will connect with you shortly.", "ACHME Sales Team", "APPROVED"],
        ["invoice_generated_notice", "UTILITY", "en", "Invoice Notice", "Hello {name}, your invoice {invoice_no} for amount {amount} has been generated. Due date: {due_date}. Thank you for choosing ACHME!", "ACHME Billing", "APPROVED"],
        ["payment_received_receipt", "UTILITY", "en", "Payment Received", "Dear {name}, we received your payment of {amount} for invoice {invoice_no} on {date}. Thank you for your prompt payment!", "ACHME Accounts", "APPROVED"],
        ["payment_due_reminder_notice", "UTILITY", "en", "Payment Due Reminder", "Hi {name}, gentle reminder that payment for invoice {invoice_no} (amount {amount}) is due on {due_date}. Please reply if you need help.", "ACHME Accounts", "APPROVED"],
        ["quotation_proposal_notice", "MARKETING", "en", "Proposal & Quotation", "Hello {name}, here is your quotation for {service} with total estimate {amount}. Let us know if you have any questions!", "ACHME Business", "APPROVED"],
        ["amc_service_due_reminder", "UTILITY", "en", "AMC Service Due", "Hi {name}, your AMC service for {service} is due on {date}. Our technical team will visit your location shortly.", "ACHME Support", "APPROVED"],
        ["walkin_appointment_reminder", "UTILITY", "en", "Appointment Reminder", "Hi {name}, reminder for your upcoming visit/appointment with ACHME on {date}. Reply CONFIRM to confirm or RESCHEDULE.", "ACHME Desk", "APPROVED"],
        ["birthday_wishes_discount", "MARKETING", "en", "Happy Birthday!", "🎉 Happy Birthday {name}! Wishing you a wonderful year ahead. Enjoy 15% off on your next service with ACHME!", "Special Gift", "APPROVED"],
        ["service_ticket_feedback", "UTILITY", "en", "Support Feedback", "Hello {name}, your support request for {service} has been resolved. We would love your feedback!", "ACHME Care", "APPROVED"],
      ];

      for (const t of defaultTemplates) {
        await queryAsync(
          `INSERT INTO wa_templates (name, category, language, header_value, body, footer, meta_status) VALUES (?,?,?,?,?,?,?)`,
          t
        );
      }
      console.log("✅ Seeded 10 universal WhatsApp template presets");
    }

    const automationsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_automations");
    if (automationsCount[0].count === 0) {
      const defaultAutomations = [
        ["Auto Welcome New Leads", "new_lead", "Hi {name}! Thank you for your inquiry regarding {service}. Our representative will contact you shortly!", 0, 1],
        ["Instant Invoice WhatsApp Notice", "invoice_created", "Hello {name}, your invoice {invoice_no} for {amount} has been generated. Due Date: {due_date}. Thank you!", 0, 1],
        ["Payment Receipt Acknowledgement", "payment_received", "Dear {name}, thank you! We received your payment of {amount} for invoice {invoice_no} on {date}.", 0, 1],
        ["New Client Welcome Onboarding", "welcome_message", "Welcome to ACHME, {name}! We are excited to work with {company}. Let us know if you have any questions.", 0, 1],
        ["Payment Due 1-Day Reminder", "payment_due", "Hi {name}, friendly reminder that payment for invoice {invoice_no} ({amount}) is due on {due_date}.", 0, 1],
        ["Lead Follow-Up Nudge", "lead_followup", "Hi {name}, following up regarding your interest in {service}. Let us know if you'd like a quick demo or call!", 0, 1],
      ];

      for (const a of defaultAutomations) {
        await queryAsync(
          `INSERT INTO wa_automations (name, trigger_type, message_text, delay_minutes, is_active) VALUES (?,?,?,?,?)`,
          a
        );
      }
      console.log("✅ Seeded 6 prebuilt WhatsApp automation rules");
    }

    const welcomeSettingsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_welcome_settings");
    if (welcomeSettingsCount[0].count === 0) {
      await queryAsync(
        `INSERT INTO wa_welcome_settings (id, enabled, welcome_type, welcome_text, cooldown_hours)
         VALUES (1, 1, 'text', 'Hello {name}! Welcome to ACHME. Thank you for reaching out to us. How can we help you today?', 24)`
      );
      console.log("✅ Seeded default Welcome Auto-Reply settings (enabled)");
    }

    const aiSettingsCount = await queryAsync("SELECT COUNT(*) as count FROM wa_ai_settings");
    if (aiSettingsCount[0].count === 0) {
      await queryAsync(
        "INSERT INTO wa_ai_settings (id, enabled, provider, model) VALUES (1, 0, 'openrouter', 'meta-llama/llama-3.3-70b-instruct:free')"
      );
      console.log("✅ Seeded default WhatsApp AI auto-reply settings (disabled)");
    }
  } catch (seedErr) {
    console.error("Error seeding prebuilt WhatsApp data:", seedErr.message);
  }

  console.log("✅ WhatsApp Cloud API & Load Balancer tables ready");
}

module.exports = { ensureWATables };