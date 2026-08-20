const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const c = mysql.createConnection({
  host: '127.0.0.1', port: 3306,
  user: 'achme_user', password: 'AchmeSecure@2024',
  database: 'achme'
});

c.query('SELECT id, first_name, email, emp_id FROM users', async (e, users) => {
  if (e) return console.error('ERROR:', e.message);

  console.log('Users to update:\n');

  for (const u of users) {
    const newPass = 'Achme@' + u.first_name;
    const hash = await bcrypt.hash(newPass, 10);
    
    await new Promise((resolve, reject) => {
      c.query('UPDATE users SET user_password = ? WHERE id = ?', [hash, u.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(u.id + ' | ' + u.email + ' / ' + u.emp_id + ' | New Pass: ' + newPass);
  }

  c.end();
  console.log('\nDone. All passwords updated.');
});
