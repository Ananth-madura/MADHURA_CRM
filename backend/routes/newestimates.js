const express = require("express");
const router = express.Router();
const db = require("../config/database");
const jwt = require("jsonwebtoken");

const decodeOptionalToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      return res.status(403).json({ message: "Invalid token" });
    }
  }
  next();
};

router.post("/new", decodeOptionalToken, (req, res) => {
  const { company_name, client_firstname, client_lastname, client_email } = req.body;

  if (!company_name || !client_firstname || !client_lastname || !client_email) {
    return res.status(400).json({ message: "filed required" });
  }

  const created_by = req.user ? req.user.id : null;
  db.query(
    `INSERT INTO estimatenew 
     (company_name, client_firstname, client_lastname, client_email, created_by)
     VALUES (?,?,?,?,?)`,
    [company_name, client_firstname, client_lastname, client_email, created_by],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true, id: result.insertId });
    }
  );
});


// SEARCH CLIENT
router.get("/search", decodeOptionalToken, (req, res) => {
  const search = req.query.name || "";
  const { id: user_id, role } = req.user || {};
  let sql = "SELECT company_name FROM estimatenew WHERE company_name LIKE ?";
  const params = [`${search}%`];
  if (role === "employee") {
    sql += " AND created_by = ?";
    params.push(user_id);
  }
  db.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});


module.exports = router;
