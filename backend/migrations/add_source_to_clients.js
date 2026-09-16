"use strict";

/**
 * Migration: Add `source` column to `clients` table
 * 
 * Tracks where each client originated from (e.g., 'WhatsApp', 'Telecall', 'Walk-in', 'Field Visit').
 * Safe to re-run — uses IF NOT EXISTS pattern.
 */

const db = require("../config/database");

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

async function run() {
  console.log("🔧 [Migration] Adding `source` column to `clients` table...");

  try {
    // Check if `source` column already exists
    const [cols] = await db.promise().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'source'"
    );

    if (cols.length === 0) {
      await queryAsync(
        "ALTER TABLE clients ADD COLUMN `source` VARCHAR(100) DEFAULT NULL AFTER `client_status`"
      );
      console.log("✅ Added `source` column to `clients` table.");
    } else {
      console.log("ℹ️  `source` column already exists in `clients` table. Skipping.");
    }

    // Ensure wa_contacts has last_message_text and last_message_at columns
    const [waColsText] = await db.promise().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_contacts' AND COLUMN_NAME = 'last_message_text'"
    );
    if (waColsText.length === 0) {
      await queryAsync("ALTER TABLE wa_contacts ADD COLUMN `last_message_text` TEXT DEFAULT NULL");
      console.log("✅ Added `last_message_text` column to `wa_contacts` table.");
    }

    const [waColsAt] = await db.promise().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_contacts' AND COLUMN_NAME = 'last_message_at'"
    );
    if (waColsAt.length === 0) {
      await queryAsync("ALTER TABLE wa_contacts ADD COLUMN `last_message_at` DATETIME DEFAULT NULL");
      console.log("✅ Added `last_message_at` column to `wa_contacts` table.");
    }

    // Ensure wa_contacts has assigned_agent_id column
    const [waColsAgent] = await db.promise().query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wa_contacts' AND COLUMN_NAME = 'assigned_agent_id'"
    );
    if (waColsAgent.length === 0) {
      await queryAsync("ALTER TABLE wa_contacts ADD COLUMN `assigned_agent_id` INT DEFAULT NULL");
      console.log("✅ Added `assigned_agent_id` column to `wa_contacts` table.");
    }

    console.log("🎉 [Migration] Complete.");
  } catch (err) {
    console.error("❌ [Migration] Error:", err.message);
  }

  process.exit(0);
}

run();
