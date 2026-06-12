require('dotenv').config();
const db = require('../config/database');
db.query('DESCRIBE teammember', (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("=== teammember ===");
        console.log(rows);
    }
    db.query('DESCRIBE users', (err2, rows2) => {
        if (err2) {
            console.error(err2);
        } else {
            console.log("=== users ===");
            console.log(rows2);
        }
        process.exit();
    });
});
