const jwt = require("jsonwebtoken");

// Users (by first_name, case-insensitive) who can edit/add/delete call reports
const CALL_REPORT_EDITORS = ["malarvannan", "priyanka"];

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== "admin" && req.user.role !== "subadmin")) {
    return res.status(403).json({ message: "Admin or Sub-Admin only" });
  }
  next();
};

const isEmployee = (req, res, next) => {
  if (!req.user || (req.user.role !== "employee" && req.user.role !== "admin" && req.user.role !== "subadmin")) {
    return res.status(403).json({ message: "Access denied" });
  }
  next();
};

const isReadOnly = (req, res, next) => {
  if (req.user && req.user.role === "employee") {
    return res.status(403).json({ message: "Employees cannot modify data" });
  }
  next();
};

// Strict admin only (not subadmin) — prevents privilege escalation via role-change
const isAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Only admin can perform this action" });
  }
  next();
};

// Call Report specific: admin, subadmin, employee roles OR malarvannan/priyanka by name
const canEditCallReport = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const hasValidRole = ["admin", "subadmin", "employee"].includes(req.user.role);
  const userName = (req.user.name || "").trim().toLowerCase();
  const isAllowedUser = CALL_REPORT_EDITORS.includes(userName);
  if (hasValidRole || isAllowedUser) {
    return next();
  }
  return res.status(403).json({ message: "Access denied" });
};

module.exports = {
  verifyToken,
  isAdmin,
  isAdminOnly,
  isEmployee,
  isReadOnly,
  canEditCallReport,
};