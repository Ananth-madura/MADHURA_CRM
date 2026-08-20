// FILE: backend/migrate_company_name.js
const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASS || "";
const dbName = process.env.DB_NAME || "achme";

async function checkAndAddColumn(connection, tableName, columnName, sqlDefinition) {
  try {
    const [rows] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, tableName, columnName]
    );

    if (rows.length === 0) {
      console.log(`Adding '${columnName}' column to '${tableName}'...`);
      await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${sqlDefinition}`);
      console.log(`✅ Column '${columnName}' successfully added to '${tableName}'.`);
    } else {
      console.log(`ℹ️ Column '${columnName}' already exists in '${tableName}'.`);
    }
  } catch (err) {
    console.error(`❌ Error updating table '${tableName}':`, err.message);
    throw err;
  }
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`⚙️  RUNNING SCHEMA MIGRATION: ADD company_name`);
  console.log(`Connecting to database '${dbName}' at ${dbHost}:${dbPort}...`);
  console.log(`======================================================`);

  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      database: dbName
    });

    console.log(`✅ Connected successfully.`);

    // Add company_name to telecalls
    await checkAndAddColumn(
      connection,
      "telecalls",
      "company_name",
      "`company_name` VARCHAR(150) DEFAULT NULL AFTER `customer_name`"
    );

    // Add company_name to walkins
    await checkAndAddColumn(
      connection,
      "walkins",
      "company_name",
      "`company_name` VARCHAR(150) DEFAULT NULL AFTER `customer_name`"
    );

    // Add company_name to fields
    await checkAndAddColumn(
      connection,
      "fields",
      "company_name",
      "`company_name` VARCHAR(150) DEFAULT NULL AFTER `customer_name`"
    );

    console.log(`\n🎉 Schema migration completed successfully!`);
  } catch (err) {
    console.error(`\n❌ Migration failed:`, err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
