/**
 * Migration: Full call_reports table upgrade
 * Adds ALL missing columns needed by both Form 1 and Form 2
 * Safe to re-run — skips columns that already exist
 * Run: node migrations/call_reports_full_migration.js  (from backend/ directory)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "achme",
  waitForConnections: true,
  connectionLimit: 5,
});

// All columns needed by both Form 1 and Form 2
const alterations = [
  // ── Session / identity ──────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN session_id VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN call_sequence INT DEFAULT 1",
  "ALTER TABLE call_reports ADD COLUMN customer_name VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN client_name VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN customer_id INT DEFAULT NULL",

  // ── Contact info ─────────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN mobile_number VARCHAR(20) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN email VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN location_city VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN gst_number VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN company_name VARCHAR(150) DEFAULT NULL",

  // ── Engineer / staff ─────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN staff_name VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN technician VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN executive_name VARCHAR(150) DEFAULT ''",

  // ── Call meta ────────────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN call_type VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN service_type VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN contract_title VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN call_referrer VARCHAR(150) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN call_details TEXT DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN description TEXT DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN priority VARCHAR(50) DEFAULT 'Medium'",
  "ALTER TABLE call_reports ADD COLUMN status VARCHAR(50) DEFAULT 'Pending'",
  "ALTER TABLE call_reports ADD COLUMN report_date DATE DEFAULT NULL",

  // ── Time & duration ──────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN start_time TIME DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN end_time TIME DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN assigned_time INT DEFAULT 30",
  "ALTER TABLE call_reports ADD COLUMN actual_duration INT DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN duration_limit INT DEFAULT 30",
  "ALTER TABLE call_reports ADD COLUMN is_exceeded TINYINT(1) DEFAULT 0",

  // ── Travel & expenses ────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN km DECIMAL(10,2) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN petrol_charges DECIMAL(10,2) DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN spare_parts_price DECIMAL(10,2) DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN labour_charges DECIMAL(10,2) DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN total_expenses DECIMAL(10,2) DEFAULT 0",

  // ── Payment ──────────────────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN payment_type VARCHAR(50) DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN invoice_value DECIMAL(10,2) DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN payment_status VARCHAR(50) DEFAULT 'Pending'",

  // ── Step 2 / completion ──────────────────────────────────────
  "ALTER TABLE call_reports ADD COLUMN step2_completed TINYINT(1) DEFAULT 0",
  "ALTER TABLE call_reports ADD COLUMN completed_at DATETIME DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN remarks TEXT DEFAULT NULL",
  "ALTER TABLE call_reports ADD COLUMN created_by INT DEFAULT NULL",
];

console.log("\n======================================================");
console.log("🔧 CALL REPORTS — FULL COLUMN MIGRATION");
console.log("======================================================\n");

let done = 0;
let added = 0;
let skipped = 0;

alterations.forEach((sql) => {
  db.query(sql, (err) => {
    done++;
    const colName = sql.match(/ADD COLUMN (\w+)/)?.[1] || "?";
    if (err) {
      if (err.code === "ER_DUP_FIELDNAME" || err.message.includes("Duplicate column")) {
        process.stdout.write(`  ⏭  ${colName} (already exists)\n`);
        skipped++;
      } else {
        console.error(`  ❌ ${colName}: ${err.message}`);
      }
    } else {
      console.log(`  ✅ Added: ${colName}`);
      added++;
    }

    if (done === alterations.length) {
      console.log("\n======================================================");
      console.log(`✅ Migration complete — Added: ${added}, Skipped: ${skipped}`);
      console.log("======================================================\n");
      db.end();
      process.exit(0);
    }
  });
});
