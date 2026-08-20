// Creates the lead_followups table — parallel to lead_reminders.
// Each row is one follow-up entry (date + optional time + reason notes)
// for a lead (telecall / walkin / field), shown as history in the UI.
const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  multipleStatements: true,
});

const runQuery = (sql, desc) => {
  return new Promise((resolve) => {
    db.query(sql, (err) => {
      if (err) {
        if (err.message.includes("Duplicate column") || err.message.includes("already exists") || err.message.includes("Duplicate key")) {
          console.log(`⚠️  ${desc} (skipped: ${err.message.split('\n')[0]})`);
        } else {
          console.error(`❌ ${desc}:`, err.message);
        }
      } else {
        console.log(`✅ ${desc}`);
      }
      resolve();
    });
  });
};

async function runMigrations() {
  try {
    console.log("\n=== Lead Follow-ups Table ===");

    await runQuery(
      `CREATE TABLE IF NOT EXISTS lead_followups (
        id INT NOT NULL AUTO_INCREMENT,
        lead_id INT NOT NULL,
        lead_type VARCHAR(50) DEFAULT NULL,
        followup_date DATE DEFAULT NULL,
        followup_time TIME DEFAULT NULL,
        followup_notes TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        employee_id INT DEFAULT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_lead (lead_id, lead_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      "lead_followups: created table"
    );

    console.log("\n🎉 Follow-up migration completed!");
  } catch (e) {
    console.error("Migration error:", e);
  } finally {
    db.end();
  }
}

db.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to database:", process.env.DB_NAME);
  runMigrations();
});
