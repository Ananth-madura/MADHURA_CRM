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

  const phone = "9876543210";
  const email = "existing_lead@example.com";
  
  console.log("Inserting an existing lead...");
  db.query(
    "INSERT INTO telecalls (customer_name, mobile_number, email, call_outcome, call_date) VALUES (?, ?, ?, ?, CURDATE())",
    ["Existing Lead", phone, email, "New"],
    (err, leadResult) => {
      if (err) {
        console.error("Failed to insert existing lead:", err);
        db.end();
        process.exit(1);
      }
      
      const leadId = leadResult.insertId;
      console.log(`Inserted existing lead with ID: ${leadId}`);
      
      // Now, try to run a checkDuplicateLead for a NEW lead with the same phone/email (excludeId = null / 0)
      const excludeId = 0;
      
      const checks = [];
      if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM telecalls WHERE mobile_number = ? AND id != ?", params: [phone, excludeId || 0] });
      if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM walkins WHERE mobile_number = ?", params: [phone] });
      if (phone) checks.push({ sql: "SELECT id, customer_name, mobile_number as phone FROM fields WHERE mobile_number = ?", params: [phone] });
      if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM telecalls WHERE email = ? AND id != ?", params: [email, excludeId || 0] });
      if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM walkins WHERE email = ?", params: [email] });
      if (email) checks.push({ sql: "SELECT id, customer_name, email as phone FROM fields WHERE email = ?", params: [email] });

      let completed = 0;
      const results = [];
      
      console.log("Running duplicate checks for a new lead...");
      checks.forEach((c) => {
        db.query(c.sql, c.params, (err, rows) => {
          completed++;
          if (err) {
            console.error("Error running sub-check:", err);
          } else if (rows.length > 0) {
            results.push({ id: rows[0].id, name: rows[0].customer_name });
          }
          
          if (completed === checks.length) {
            console.log(`Duplicate check completed. Found ${results.length} duplicates.`);
            console.log("Results details:", results);
            
            db.query("DELETE FROM telecalls WHERE id = ?", [leadId], () => {
              db.end();
              if (results.length > 0) {
                console.log("🎉 SUCCESS: Correctly flagged duplicate when trying to create a new lead with existing mobile/email!");
                process.exit(0);
              } else {
                console.error("❌ FAILURE: Failed to flag duplicate for new lead!");
                process.exit(1);
              }
            });
          }
        });
      });
    }
  );
});
