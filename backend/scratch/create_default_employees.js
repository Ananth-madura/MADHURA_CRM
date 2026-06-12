require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

const newUsers = [
  {
    first_name: "Jai sir",
    last_name: "",
    email: "jai@technostore.co.in",
    emp_id: "AC002",
    job_title: "Sub-Admin",
    emp_role: "Admin dept",
    mobile_number: "9876543210",
    emp_address: "ACHME Communication",
    password: "JaiAcmeSubadmin#1",
    role: "subadmin"
  },
  {
    first_name: "Manikandan",
    last_name: "",
    email: "mani@technostore.co.in",
    emp_id: "AC061",
    job_title: "Sales Representative",
    emp_role: "sales dept",
    mobile_number: "9876543211",
    emp_address: "ACHME Communication",
    password: "ManiAcmeSales#2",
    role: "employee"
  },
  {
    first_name: "Anand",
    last_name: "",
    email: "sales3@technostore.co.in",
    emp_id: "AC012",
    job_title: "Sales Representative",
    emp_role: "sales dept",
    mobile_number: "9876543212",
    emp_address: "ACHME Communication",
    password: "AnandAcmeSales#3",
    role: "employee"
  }
];

async function setupEmployees() {
  // 1. Make malarvannan@technostore.co.in an admin
  console.log("Updating malarvannan@technostore.co.in to admin role...");
  await new Promise((resolve) => {
    db.query(
      "UPDATE users SET role = 'admin' WHERE email = 'malarvannan@technostore.co.in'",
      (err, result) => {
        if (err) {
          console.error("Failed to update Malarvannan's role:", err.message);
        } else {
          console.log("Malarvannan updated successfully, rows affected:", result.affectedRows);
        }
        resolve();
      }
    );
  });

  // 2. Insert new employees
  for (const u of newUsers) {
    console.log(`\nProcessing user: ${u.email}...`);
    
    // Check if user already exists
    const existingUser = await new Promise((resolve) => {
      db.query("SELECT id FROM users WHERE email = ?", [u.email], (err, rows) => {
        if (!err && rows.length > 0) {
          resolve(rows[0]);
        } else {
          resolve(null);
        }
      });
    });

    if (existingUser) {
      console.log(`User ${u.email} already exists in 'users' table. Skipping insert.`);
      continue;
    }

    const hash = await bcrypt.hash(u.password, 10);
    
    // Insert into users
    const newUserId = await new Promise((resolve, reject) => {
      db.query(
        "INSERT INTO users (first_name, last_name, email, user_password, role, status, emp_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [u.first_name, u.last_name, u.email.toLowerCase(), hash, u.role, "active", u.emp_id],
        (err, result) => {
          if (err) {
            console.error(`Error inserting user ${u.email}:`, err.message);
            resolve(null);
          } else {
            resolve(result.insertId);
          }
        }
      );
    });

    if (!newUserId) continue;
    console.log(`Inserted into 'users' table with ID: ${newUserId}`);

    // Insert into teammember
    await new Promise((resolve) => {
      db.query(
        "INSERT INTO teammember (first_name, last_name, emp_email, emp_id, job_title, emp_role, mobile_number, emp_address, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [u.first_name, u.last_name, u.email.toLowerCase(), u.emp_id, u.job_title, u.emp_role, u.mobile_number, u.emp_address, newUserId],
        (err) => {
          if (err) {
            console.error(`Error inserting team member for ${u.email}:`, err.message);
          } else {
            console.log(`Inserted teammember record successfully.`);
          }
          resolve();
        }
      );
    });
    
    console.log(`--- ACCOUNT DETAILS ---`);
    console.log(`Name: ${u.first_name}`);
    console.log(`Email: ${u.email}`);
    console.log(`Emp ID: ${u.emp_id}`);
    console.log(`Password: ${u.password}`);
    console.log(`System Role: ${u.role}`);
    console.log(`Job Department/Role: ${u.emp_role}`);
  }

  process.exit();
}

setupEmployees();
