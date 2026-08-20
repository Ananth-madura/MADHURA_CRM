const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "achme_user",
  password: "AchmeSecure@2024",
  database: "achme",
});

db.connect((err) => {
  if (err) {
    console.error("DB error:", err.message);
    process.exit(1);
  }
  console.log("Connected to DB");

  db.query(
    "SHOW COLUMNS FROM call_reports LIKE 'delivery_call_type'",
    (err, rows) => {
      if (err) {
        console.error("Error checking column:", err.message);
        db.end();
        return;
      }
      if (rows.length > 0) {
        console.log("Column delivery_call_type already exists. No migration needed.");
        db.end();
      } else {
        db.query(
          "ALTER TABLE call_reports ADD COLUMN delivery_call_type VARCHAR(50) DEFAULT NULL",
          (err2) => {
            if (err2) {
              console.error("Migration error:", err2.message);
            } else {
              console.log("SUCCESS: delivery_call_type column added to call_reports!");
            }
            db.end();
          }
        );
      }
    }
  );
});
