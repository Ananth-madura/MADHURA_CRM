/**
 * Migration: Add contact_person and address_2 columns to clients table.
 * Run once: node add_contact_person_address2.js
 */
const db = require("./config/database");

const alterations = [
  {
    col: "contact_person",
    sql: "ALTER TABLE clients ADD COLUMN contact_person VARCHAR(255) DEFAULT '' AFTER alternate_phone"
  },
  {
    col: "address_2",
    sql: "ALTER TABLE clients ADD COLUMN address_2 VARCHAR(500) DEFAULT '' AFTER address"
  }
];

let done = 0;

alterations.forEach(({ col, sql }) => {
  db.query(sql, (err) => {
    if (err) {
      if (err.code === "ER_DUP_FIELDNAME") {
        console.log(`✅ Column '${col}' already exists — skipped.`);
      } else {
        console.error(`❌ Error adding '${col}':`, err.message);
      }
    } else {
      console.log(`✅ Column '${col}' added successfully.`);
    }
    done++;
    if (done === alterations.length) {
      console.log("\nMigration complete. You can delete this file.");
      process.exit(0);
    }
  });
});
