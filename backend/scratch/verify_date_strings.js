const db = require("../config/database");

db.query("SELECT reminder_date, created_at FROM lead_reminders LIMIT 1", (err, rows) => {
  db.end();
  if (err) {
    console.error("Error running query:", err.message);
    process.exit(1);
  }

  const row = rows[0];
  if (!row) {
    console.log("No data found, but connection succeeded.");
    process.exit(0);
  }

  console.log("Returned row:", JSON.stringify(row, null, 2));
  console.log("reminder_date type:", typeof row.reminder_date, "/ is Date:", row.reminder_date instanceof Date);
  console.log("created_at type:", typeof row.created_at, "/ is Date:", row.created_at instanceof Date);

  if (typeof row.reminder_date === 'string' && !(row.reminder_date instanceof Date)) {
    console.log("✅ Verification Passed: reminder_date is returned as a string!");
    process.exit(0);
  } else {
    console.error("❌ Verification Failed: reminder_date is not a string!");
    process.exit(1);
  }
});
