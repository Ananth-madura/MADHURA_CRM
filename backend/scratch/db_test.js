const mysql = require("mysql2");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
  console.log("Connected to the database successfully!");

  const phone = "9999999999";
  const email = "test_duplicate_edit@example.com";
  
  console.log("Inserting mock lead and converted client...");
  db.query(
    "INSERT INTO telecalls (customer_name, mobile_number, email, call_outcome, call_date) VALUES (?, ?, ?, ?, CURDATE())",
    ["Test Duplicate Lead", phone, email, "Converted"],
    (err, leadResult) => {
      if (err) {
        console.error("Failed to insert mock lead:", err);
        db.end();
        process.exit(1);
      }
      
      const leadId = leadResult.insertId;
      console.log(`Inserted mock lead with ID: ${leadId}`);
      
      db.query(
        "INSERT INTO clients (name, phone, email, original_lead_id, original_lead_type, client_status) VALUES (?, ?, ?, ?, ?, ?)",
        ["Test Duplicate Lead", phone, email, leadId, "telecall", "converted"],
        (err, clientResult) => {
          if (err) {
            console.error("Failed to insert mock client:", err);
            db.query("DELETE FROM telecalls WHERE id = ?", [leadId]);
            db.end();
            process.exit(1);
          }
          const clientId = clientResult.insertId;
          console.log(`Inserted mock client with ID: ${clientId}`);
          
          const excludeId = leadId;
          
          const checks = [];
          if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM telecalls WHERE mobile_number = ? AND id != ?", params: [phone, excludeId || 0] });
          if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM walkins WHERE mobile_number = ?", params: [phone] });
          if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM fields WHERE mobile_number = ?", params: [phone] });
          if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM telecalls WHERE email = ? AND id != ?", params: [email, excludeId || 0] });
          if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM walkins WHERE email = ?", params: [email] });
          if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM fields WHERE email = ?", params: [email] });
          if (phone) checks.push({ sql: "SELECT id, name, phone FROM clients WHERE phone = ? AND NOT (original_lead_id = ? AND original_lead_type = 'telecall')", params: [phone, excludeId || 0] });
          if (email) checks.push({ sql: "SELECT id, name, email as phone FROM clients WHERE email = ? AND NOT (original_lead_id = ? AND original_lead_type = 'telecall')", params: [email, excludeId || 0] });

          let completed = 0;
          const results = [];
          
          console.log("Running duplicate checks mimicking telecall update...");
          checks.forEach((c) => {
            db.query(c.sql, c.params, (err, rows) => {
              completed++;
              if (err) {
                console.error("Error running sub-check:", err);
              } else if (rows.length > 0) {
                results.push({ id: rows[0].id, name: rows[0].customer_name || rows[0].name });
              }
              
              if (completed === checks.length) {
                console.log(`Duplicate check completed. Found ${results.length} duplicates.`);
                console.log("Results details:", results);
                
                db.query("DELETE FROM clients WHERE id = ?", [clientId], () => {
                  db.query("DELETE FROM telecalls WHERE id = ?", [leadId], () => {
                    db.end();
                    if (results.length === 0) {
                      console.log("🎉 SUCCESS: No duplicates found when editing the converted lead! The fix works perfectly!");
                      process.exit(0);
                    } else {
                      console.error("❌ FAILURE: Duplicates were detected during edit!");
                      process.exit(1);
                    }
                  });
                });
              }
            });
          });
        }
      );
    }
  );
});
