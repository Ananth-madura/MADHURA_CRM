const mysql = require('mysql2');
const c = mysql.createConnection({
  host: '127.0.0.1', port: 3306,
  user: 'achme_user', password: 'AchmeSecure@2024',
  database: 'achme'
});
c.query('SELECT id, email, COALESCE(emp_id,"") AS emp_id, user_password FROM users', (e, r) => {
  if (e) return console.error('ERROR:', e.message);
  console.log("ID | Email/EMP | Password Hash");
  console.log("---|-----------|---------------");
  r.forEach(u => console.log(u.id + ' | ' + u.email + ' / ' + u.emp_id + ' | ' + u.user_password));
  c.end();
});
