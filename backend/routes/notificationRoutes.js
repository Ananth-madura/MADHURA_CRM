const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// GET employee notifications for current user
router.get("/", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  const { type, limit, offset } = req.query;
  const params = [];

  let sql = "SELECT * FROM notifications WHERE 1=1";

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  } else if (req.query.user_id) {
    sql += " AND user_id = ?";
    params.push(req.query.user_id);
  }

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC";

  if (limit) {
    sql += " LIMIT ?";
    params.push(parseInt(limit));
    if (offset) {
      sql += " OFFSET ?";
      params.push(parseInt(offset));
    }
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET unread count for current user
router.get("/unread-count", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0";
  const params = [];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ count: result[0].count });
  });
});

// PUT mark single notification as read
router.put("/:id/read", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "UPDATE notifications SET is_read = 1 WHERE id = ?";
  const params = [req.params.id];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// PUT mark all notifications as read
router.put("/read-all", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "UPDATE notifications SET is_read = 1 WHERE is_read = 0";
  const params = [];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// DELETE single notification
router.delete("/:id", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "DELETE FROM notifications WHERE id = ?";
  const params = [req.params.id];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// GET admin notifications (admin only)
router.get("/admin", verifyToken, isAdmin, (req, res) => {
  const { type, priority, limit } = req.query;
  const params = [];

  let sql = `
    SELECT an.*, tm.first_name as employee_name
    FROM admin_notifications an
    LEFT JOIN teammember tm ON an.user_id = tm.user_id
    WHERE 1=1
  `;

  if (type) {
    sql += " AND an.type = ?";
    params.push(type);
  }

  if (priority) {
    sql += " AND an.priority = ?";
    params.push(priority);
  }

  sql += " ORDER BY an.created_at DESC";

  if (limit) {
    sql += " LIMIT ?";
    params.push(parseInt(limit));
  }

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET admin unread count
router.get("/admin/unread-count", verifyToken, isAdmin, (req, res) => {
  db.query(
    "SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ count: result[0].count });
    }
  );
});

// PUT mark admin notification as read
router.put("/admin/:id/read", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE admin_notifications SET is_read = 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// PUT mark all admin notifications as read
router.put("/admin/read-all", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0",
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// DELETE admin notification
router.delete("/admin/:id", verifyToken, isAdmin, (req, res) => {
  db.query("DELETE FROM admin_notifications WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// PUT archive employee notification
router.put("/:id/archive", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "UPDATE notifications SET is_archived = 1 WHERE id = ?";
  const params = [req.params.id];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// PUT unarchive employee notification
router.put("/:id/unarchive", verifyToken, (req, res) => {
  const { id: user_id, role } = req.user;
  let sql = "UPDATE notifications SET is_archived = 0 WHERE id = ?";
  const params = [req.params.id];

  if (role === "employee") {
    sql += " AND (user_id = ? OR user_id IS NULL)";
    params.push(user_id);
  }

  db.query(sql, params, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});

// PUT archive admin notification
router.put("/admin/:id/archive", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE admin_notifications SET is_archived = 1 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// PUT unarchive admin notification
router.put("/admin/:id/unarchive", verifyToken, isAdmin, (req, res) => {
  db.query(
    "UPDATE admin_notifications SET is_archived = 0 WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});

// GET employees with notification counts
router.get("/employees", verifyToken, isAdmin, (req, res) => {
  const sql = `
    SELECT 
      tm.id as employee_id,
      tm.first_name,
      tm.last_name,
      tm.emp_role,
      tm.user_id,
      COUNT(DISTINCT CASE WHEN n.is_read = 0 AND n.is_archived = 0 THEN n.id END) as unread_count,
      COUNT(DISTINCT CASE WHEN n.is_archived = 0 THEN n.id END) as total_count,
      COUNT(DISTINCT CASE WHEN an.is_read = 0 AND an.is_archived = 0 AND an.user_id = tm.user_id THEN an.id END) as admin_unread_count,
      COUNT(DISTINCT CASE WHEN an.is_archived = 0 AND an.user_id = tm.user_id THEN an.id END) as admin_total_count
    FROM teammember tm
    LEFT JOIN notifications n ON n.user_id = tm.user_id
    LEFT JOIN admin_notifications an ON an.user_id = tm.user_id
    WHERE tm.user_id IS NOT NULL
    GROUP BY tm.id, tm.first_name, tm.last_name, tm.emp_role, tm.user_id
    ORDER BY unread_count DESC, admin_unread_count DESC, tm.first_name ASC
  `;
  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET notifications for a specific employee (admin only)
router.get("/employee/:userId", verifyToken, isAdmin, (req, res) => {
  const { userId } = req.params;
  const { type, archived } = req.query;
  const params = [userId];

  let sql = `
    SELECT n.*, tm.first_name as employee_name
    FROM notifications n
    LEFT JOIN teammember tm ON n.user_id = tm.user_id
    WHERE n.user_id = ?
  `;

  if (archived === "true") {
    sql += " AND n.is_archived = 1";
  } else {
    sql += " AND n.is_archived = 0";
  }

  if (type) {
    sql += " AND n.type = ?";
    params.push(type);
  }

  sql += " ORDER BY n.created_at DESC";

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// GET admin notifications for a specific employee (admin only)
router.get("/admin/employee/:userId", verifyToken, isAdmin, (req, res) => {
  const { userId } = req.params;
  const { type, priority, archived } = req.query;
  const params = [userId];

  let sql = `
    SELECT an.*, tm.first_name as employee_name
    FROM admin_notifications an
    LEFT JOIN teammember tm ON an.user_id = tm.user_id
    WHERE an.user_id = ?
  `;

  if (archived === "true") {
    sql += " AND an.is_archived = 1";
  } else {
    sql += " AND an.is_archived = 0";
  }

  if (type) {
    sql += " AND an.type = ?";
    params.push(type);
  }

  if (priority) {
    sql += " AND an.priority = ?";
    params.push(priority);
  }

  sql += " ORDER BY an.created_at DESC";

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

const { getVapidPublicKey } = require("../backendutil/pushSender");

// GET VAPID public key
router.get("/vapid-public-key", verifyToken, (req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});

// POST save push subscription
router.post("/push-subscribe", verifyToken, (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  const sql = `
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)
  `;
  
  db.query(sql, [req.user.id, endpoint, keys.p256dh, keys.auth], (err) => {
    if (err) {
      console.error("[Web Push] Save subscription error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: "Subscription saved successfully" });
  });
});

// POST unsubscribe / remove subscription
router.post("/push-unsubscribe", verifyToken, (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: "Endpoint is required" });
  }

  db.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint], (err) => {
    if (err) {
      console.error("[Web Push] Delete subscription error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: "Unsubscribed successfully" });
  });
});

module.exports = router;
