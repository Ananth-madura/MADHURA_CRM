require('dotenv').config();
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const migrationSql = fs.readFileSync(path.join(__dirname, '../migrations_enum_to_varchar.sql'), 'utf8');
const queries = migrationSql.split(';').map(q => q.trim()).filter(q => q.length > 0);

async function runMigration() {
    for (let q of queries) {
        console.log(`Running: ${q}...`);
        await new Promise((resolve, reject) => {
            db.query(q, (err, result) => {
                if (err) {
                    console.error("Error running query:", err.message);
                } else {
                    console.log("Success");
                }
                resolve();
            });
        });
    }
    console.log("Migration finished.");
    process.exit();
}

runMigration();
