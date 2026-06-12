require('dotenv').config();
const db = require('../config/database');

db.query('SELECT id, first_name, email, role, status FROM users', (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
    process.exit();
});
