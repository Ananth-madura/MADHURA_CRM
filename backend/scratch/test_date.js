const mysql = require("mysql2");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const runTest = (dateStringsOption) => {
  return new Promise((resolve) => {
    const db = mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      dateStrings: dateStringsOption,
    });

    db.query("SELECT reminder_date, created_at FROM lead_reminders LIMIT 1", (err, rows) => {
      db.end();
      if (err) {
        resolve({ err: err.message });
      } else {
        resolve({ rows, types: rows[0] ? Object.keys(rows[0]).reduce((acc, k) => ({ ...acc, [k]: typeof rows[0][k] + ' / ' + (rows[0][k] instanceof Date ? 'Date' : rows[0][k]?.constructor?.name) }), {}) : "no data" });
      }
    });
  });
};

(async () => {
  console.log("Testing default dateStrings: false");
  const res1 = await runTest(false);
  console.log("Result 1:", JSON.stringify(res1, null, 2));

  console.log("\nTesting dateStrings: true");
  const res2 = await runTest(true);
  console.log("Result 2:", JSON.stringify(res2, null, 2));

  console.log("\nTesting dateStrings: ['DATE']");
  const res3 = await runTest(['DATE']);
  console.log("Result 3:", JSON.stringify(res3, null, 2));
})();
