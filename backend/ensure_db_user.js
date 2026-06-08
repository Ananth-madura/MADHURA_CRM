const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || "achme";
const appUser = process.env.DB_USER || "achme_user";
const appPass = process.env.DB_PASS || "AchmeSecure@2024";

const rootPasswords = [
  process.env.MYSQL_ROOT_PASSWORD,
  process.env.DB_ROOT_PASS,
  "admin@123",
  "",
  "root",
  "password",
  "mysql",
  "admin",
  "123456",
  "12345678",
  "1234",
  "root123",
  "root1234",
  "mysql123",
  "admin123",
  "Root@123",
  "root@123",
  "Admin@123",
].filter((value, index, list) => value !== undefined && list.indexOf(value) === index);

function escapeIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function escapeString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function appUserWorks() {
  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: appUser,
    password: appPass,
    database: dbName,
    connectTimeout: 5000,
  });
  await connection.ping();
  await connection.end();
}

async function createWithRoot(host, password) {
  const connection = await mysql.createConnection({
    host,
    port: dbPort,
    user: "root",
    password,
    multipleStatements: true,
    connectTimeout: 5000,
  });

  const database = escapeIdentifier(dbName);
  const user = escapeString(appUser);
  const pass = escapeString(appPass);

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${database} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`CREATE USER IF NOT EXISTS '${user}'@'localhost' IDENTIFIED BY '${pass}'`);
  await connection.query(`CREATE USER IF NOT EXISTS '${user}'@'127.0.0.1' IDENTIFIED BY '${pass}'`);
  await connection.query(`GRANT ALL PRIVILEGES ON ${database}.* TO '${user}'@'localhost'`);
  await connection.query(`GRANT ALL PRIVILEGES ON ${database}.* TO '${user}'@'127.0.0.1'`);
  await connection.query("FLUSH PRIVILEGES");
  await connection.end();
}

(async () => {
  try {
    await appUserWorks();
    console.log(`Database user '${appUser}' already works.`);
    return;
  } catch {
    console.log(`Database user '${appUser}' is not ready. Trying root bootstrap...`);
  }

  const hosts = [dbHost, "localhost", "127.0.0.1"];
  const uniqueHosts = [...new Set(hosts)];

  for (const host of uniqueHosts) {
    for (const password of rootPasswords) {
      try {
        await createWithRoot(host, password);
        await appUserWorks();
        console.log(`Database '${dbName}' and user '${appUser}' are ready via root@${host}.`);
        return;
      } catch (error) {
        const label = password ? "provided/root password" : "blank root password";
        console.log(`Root bootstrap failed for root@${host} with ${label}: ${error.message}`);
      }
    }
  }

  console.error("");
  console.error("Could not create the ACHME database user automatically.");
  console.error("Set MYSQL_ROOT_PASSWORD or DB_ROOT_PASS before running the batch file, or create this MySQL user manually:");
  console.error(`  user: ${appUser}`);
  console.error(`  password: ${appPass}`);
  console.error(`  database: ${dbName}`);
  process.exit(1);
})();
