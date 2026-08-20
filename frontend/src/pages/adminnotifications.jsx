import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  CheckCircle, XCircle, Clock, User, Edit, Lock, Bell, ShieldCheck,
  ChevronRight, ChevronLeft, Filter, AlertTriangle, Calendar, FileText,
  Trash2, Archive, RotateCcw, ArrowLeft, Search, X
} from "lucide-react";
import { API } from "../config/api";

const N = {
  primary: "#5645d4",
  primaryPressed: "#4534b3",
  orange: "#dd5b00",
  green: "#1aae39",
  error: "#e03131",
  ink: "#1a1a1a",
  charcoal: "#37352f",
  slate: "#5d5b54",
  steel: "#787671",
  stone: "#a4a097",
  hairline: "#e5e3df",
  hairlineStrong: "#c8c4be",
  surface: "#f6f5f4",
  surfaceSoft: "#fafaf9",
  canvas: "#ffffff",
  lavender: "#e6e0f5",
  mint: "#d9f3e1",
  peach: "#ffe8d4",
  sky: "#dcecfa",
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "---";

const timeAgo = (date) => {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
};

const getFieldLabel = (field) => {
  const map = { first_name: "Name", email: "Email", mobile_number: "Mobile Number", emp_address: "Address", password: "Password" };
  return map[field] || field;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const StatusBadge = ({ status }) => {
  const styles = { active: "bg-[#d9f3e1] text-[#1aae39]", rejected: "bg-[#fde0ec] text-[#e03131]" };
  const labels = { active: "Approved", rejected: "Rejected" };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] || "bg-[#f0eeec] text-[#787671]"}`}>
      {labels[status] || "No user data"}
    </span>
  );
};

const NOTIF_TYPE_CONFIG = {
  overdue_task: { icon: AlertTriangle, color: "#e03131", bg: "#fde0ec", label: "Overdue Task" },
  missed_reminder: { icon: Calendar, color: "#dd5b00", bg: "#ffe8d4", label: "Missed Reminder" },
  approval_request: { icon: FileText, color: "#5645d4", bg: "#e6e0f5", label: "Approval Request" },
  target_achievement: { icon: CheckCircle, color: "#1aae39", bg: "#d9f3e1", label: "Target Achievement" },
  task_completed: { icon: CheckCircle, color: "#1aae39", bg: "#d9f3e1", label: "Task Completed" },
  task_assigned: { icon: User, color: "#5645d4", bg: "#e6e0f5", label: "Task Assigned" },
  missed_reminder_alert: { icon: AlertTriangle, color: N.orange, bg: N.peach, label: "Missed Reminder Alert" },
  target_completed: { icon: CheckCircle, color: N.green, bg: N.mint, label: "Target Completed" },
};

const AdminNotifCard = ({ n, onDelete, onArchive }) => {
  const config = NOTIF_TYPE_CONFIG[n.type] || { icon: Bell, color: "#5645d4", bg: "#e6e0f5", label: n.type?.replaceAll("_", " ") };
  const Icon = config.icon;
  const priorityColors = { high: "border-l-4 border-[#e03131]", medium: "border-l-4 border-[#dd5b00]", normal: "" };

  return (
    <div className={`rounded-xl border bg-white p-4 ${priorityColors[n.priority] || ""} ${!n.is_read ? "border-[#d6b6f6]" : "border-[#e5e3df]"}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: config.bg }}>
          <Icon size={16} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>{config.label}</p>
            {n.priority === "high" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e03131] text-white font-semibold">HIGH</span>
            )}
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#5645d4] flex-shrink-0" />}
          </div>
          {n.employee_name && <p className="text-xs font-medium" style={{ color: "#5d5b54" }}>Employee: {n.employee_name}</p>}
          {n.message && <p className="text-xs mt-1" style={{ color: "#5d5b54" }}>{n.message}</p>}
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#a4a097" }}>
            <Clock size={10} /> {timeAgo(n.created_at)}
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => onArchive?.(n.id)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors" title="Archive" style={{ color: N.steel }}>
            <Archive size={14} />
          </button>
          <button onClick={() => onDelete?.(n.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors" title="Delete" style={{ color: N.error }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const NotifCard = ({ n, onDelete, onArchive }) => {
  const config = NOTIF_TYPE_CONFIG[n.type] || { icon: Bell, color: N.primary, bg: N.lavender, label: n.type?.replaceAll("_", " ") };
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border bg-white p-4 ${!n.is_read ? "border-[#d6b6f6]" : "border-[#e5e3df]"}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: config.bg }}>
          <Icon size={16} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: N.ink }}>{config.label}</p>
            {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#5645d4] flex-shrink-0" />}
          </div>
          {n.title && <p className="text-xs font-medium" style={{ color: N.slate }}>{n.title}</p>}
          {n.description && <p className="text-xs mt-1" style={{ color: N.slate }}>{n.description}</p>}
          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: N.stone }}>
            <Clock size={10} /> {timeAgo(n.created_at)}
          </p>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={() => onArchive?.(n.id)} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors" title="Archive" style={{ color: N.steel }}>
            <Archive size={14} />
          </button>
          <button onClick={() => onDelete?.(n.id)} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors" title="Delete" style={{ color: N.error }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const EmployeeCard = ({ emp, onClick }) => {
  const totalUnread = (emp.unread_count || 0) + (emp.admin_unread_count || 0);
  const totalCount = (emp.total_count || 0) + (emp.admin_total_count || 0);

  return (
    <div
      onClick={() => onClick(emp)}
      className="rounded-xl border bg-white p-4 cursor-pointer transition-all hover:shadow-md hover:border-[#d6b6f6]"
      style={{ borderColor: totalUnread > 0 ? N.primary : N.hairline }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: totalUnread > 0 ? N.lavender : N.surface }}>
          <User size={18} style={{ color: totalUnread > 0 ? N.primary : N.steel }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: N.ink }}>{emp.first_name} {emp.last_name || ""}</p>
          <p className="text-xs" style={{ color: N.steel }}>{emp.emp_role || "Employee"}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {totalUnread > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: N.error, color: "#fff" }}>
              {totalUnread}
            </span>
          )}
          <span className="text-xs" style={{ color: N.stone }}>{totalCount} total</span>
          <ChevronRight size={16} style={{ color: N.stone }} />
        </div>
      </div>
    </div>
  );
};

const applyHistoryFilter = (items, filter, customFrom, customTo) => {
  if (filter === "all") return items;
  const now = new Date();
  return items.filter(item => {
    const d = new Date(item.created_at);
    if (filter === "today") return d.toDateString() === now.toDateString();
    if (filter === "week") return (now - d) <= SEVEN_DAYS_MS;
    if (filter === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return (!from || d >= from) && (!to || d <= to);
    }
    return true;
  });
};

const AdminNotifications = () => {
  const [view, setView] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeNotifs, setEmployeeNotifs] = useState([]);
  const [adminNotifsForEmployee, setAdminNotifsForEmployee] = useState([]);
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [histFilter, setHistFilter] = useState("all");
  const [histCustomFrom, setHistCustomFrom] = useState("");
  const [histCustomTo, setHistCustomTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [notifFilter, setNotifFilter] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/notifications/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAdminNotifs = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/notifications/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminNotifs(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchChangeRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/profile-change-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChangeRequests(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchEmployeeNotifications = async (employee, archived = false) => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [empNotifsRes, adminNotifsRes] = await Promise.all([
        axios.get(`${API}/api/notifications/employee/${employee.user_id}?archived=${archived}`, { headers }),
        axios.get(`${API}/api/notifications/admin/employee/${employee.user_id}?archived=${archived}`, { headers })
      ]);
      setEmployeeNotifs(empNotifsRes.data);
      setAdminNotifsForEmployee(adminNotifsRes.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchEmployees();
    fetchAdminNotifs();
    fetchNotifications();
    fetchChangeRequests();
  }, []);

  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    setView("employee-detail");
    setShowArchived(false);
    fetchEmployeeNotifications(emp, false);
  };

  const handleDeleteNotif = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeNotifs(prev => prev.filter(n => n.id !== id));
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleDeleteAdminNotif = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/notifications/admin/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminNotifsForEmployee(prev => prev.filter(n => n.id !== id));
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleArchiveNotif = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/notifications/${id}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployeeNotifs(prev => prev.filter(n => n.id !== id));
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleArchiveAdminNotif = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/notifications/admin/${id}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminNotifsForEmployee(prev => prev.filter(n => n.id !== id));
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleUnarchiveNotif = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/notifications/${id}/unarchive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployeeNotifications(selectedEmployee, true);
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const handleUnarchiveAdminNotif = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/notifications/admin/${id}/unarchive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEmployeeNotifications(selectedEmployee, true);
      fetchEmployees();
    } catch (err) { console.error(err); }
  };

  const markAdminNotifRead = async (notifId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/notifications/admin/${notifId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAdminNotifs();
    } catch (err) { console.error(err); }
  };

  const handleAction = async (userId, action, notifId) => {
    if (!userId) { alert("User ID missing"); return; }
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/api/auth/approve/${userId}`, { action }, { headers });
      if (notifId) await axios.put(`${API}/api/notifications/admin/${notifId}/read`, {}, { headers });
      window.dispatchEvent(new Event("refresh-pending-count"));
      fetchNotifications();
    } catch (err) { alert(err.response?.data?.message || "Action failed"); }
  };

  const handleProfileChange = async (requestId, action) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/auth/handle-change-request/${requestId}`, { action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      window.dispatchEvent(new Event("refresh-pending-count"));
      fetchChangeRequests();
    } catch (err) { alert(err.response?.data?.message || "Action failed"); }
  };

  const filteredEmployeeNotifs = employeeNotifs.filter(n => {
    if (notifFilter === "all") return true;
    return n.type === notifFilter;
  }).filter(n => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (n.message || "").toLowerCase().includes(search) ||
           (n.title || "").toLowerCase().includes(search) ||
           (n.description || "").toLowerCase().includes(search);
  });

  const filteredAdminNotifsForEmployee = adminNotifsForEmployee.filter(n => {
    if (notifFilter === "all") return true;
    return n.type === notifFilter;
  }).filter(n => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (n.message || "").toLowerCase().includes(search) ||
           (n.employee_name || "").toLowerCase().includes(search);
  });

  const now = new Date();
  const recentAdminNotifs = adminNotifs.filter(n => (now - new Date(n.created_at)) <= SEVEN_DAYS_MS);
  const olderAdminNotifs = adminNotifs.filter(n => (now - new Date(n.created_at)) > SEVEN_DAYS_MS);
  const recentNotifs = notifications.filter(n => (now - new Date(n.created_at)) <= SEVEN_DAYS_MS);
  const olderNotifs = notifications.filter(n => (now - new Date(n.created_at)) > SEVEN_DAYS_MS);
  const unread = recentAdminNotifs.filter(n => n.is_read === 0).length + recentNotifs.filter(n => n.is_read === 0).length;
  const pendingApprovals = recentNotifs.filter(n => n.status === "pending" && n.user_id);
  const totalApprovalNeeded = pendingApprovals.length + changeRequests.length;
  const filteredHistory = applyHistoryFilter([...olderAdminNotifs, ...olderNotifs], histFilter, histCustomFrom, histCustomTo);

  // System Alerts filter
  const SYSTEM_FILTERS = [
    { key: "all", label: "All", emoji: "🔔" },
    { key: "target_completed", label: "Target Completed", emoji: "🎯" },
    { key: "target_achievement", label: "Target Achievement", emoji: "📈" },
    { key: "task_completed", label: "Task Done", emoji: "✅" },
    { key: "task_assigned", label: "Task Assigned", emoji: "📋" },
    { key: "approval_request", label: "Approvals", emoji: "🔐" },
    { key: "overdue_task", label: "Overdue", emoji: "⚠️" },
    { key: "missed_reminder", label: "Reminders", emoji: "📅" },
  ];
  const filteredSystemNotifs = recentAdminNotifs.filter(n =>
    systemFilter === "all" ? true : n.type === systemFilter
  );

  const filteredEmployees = employees.filter(emp => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return `${emp.first_name} ${emp.last_name || ""}`.toLowerCase().includes(search) ||
           (emp.emp_role || "").toLowerCase().includes(search);
  });

  if (view === "employee-detail" && selectedEmployee) {
    const allNotifsForEmployee = [...filteredEmployeeNotifs, ...filteredAdminNotifsForEmployee];
    const notifTypes = [...new Set(allNotifsForEmployee.map(n => n.type))];

    return (
      <div className="w-full p-4 md:p-6 min-h-screen" style={{ background: N.surfaceSoft }}>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("employees")} className="flex items-center gap-1 text-sm font-medium cursor-pointer" style={{ color: N.primary }}>
            <ChevronLeft size={16} /> Back to Employees
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold" style={{ color: N.ink }}>{selectedEmployee.first_name} {selectedEmployee.last_name || ""}</h2>
            <p className="text-xs" style={{ color: N.steel }}>{selectedEmployee.emp_role}</p>
          </div>
          <button
            onClick={() => { setShowArchived(!showArchived); fetchEmployeeNotifications(selectedEmployee, !showArchived); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ background: showArchived ? N.primary : N.surface, color: showArchived ? "#fff" : N.slate, border: `1px solid ${showArchived ? N.primary : N.hairline}` }}
          >
            {showArchived ? <RotateCcw size={14} /> : <Archive size={14} />}
            {showArchived ? "Active" : "Archived"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-1 rounded-xl p-1" style={{ background: N.surface }}>
            <button onClick={() => setNotifFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${notifFilter === "all" ? "bg-white shadow" : ""}`}
              style={{ color: notifFilter === "all" ? N.primary : N.steel }}>
              All
            </button>
            {notifTypes.map(type => {
              const config = NOTIF_TYPE_CONFIG[type];
              return (
                <button key={type} onClick={() => setNotifFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${notifFilter === type ? "bg-white shadow" : ""}`}
                  style={{ color: notifFilter === type ? (config?.color || N.primary) : N.steel }}>
                  {config?.label || type}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
            <Search size={14} style={{ color: N.stone }} />
            <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
              placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="cursor-pointer" style={{ color: N.stone }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {allNotifsForEmployee.length === 0 ? (
          <div className="rounded-xl border p-10 text-center" style={{ background: N.canvas, borderColor: N.hairline }}>
            <Bell size={40} className="mx-auto mb-3" style={{ color: N.stone }} />
            <p className="text-sm font-medium" style={{ color: N.slate }}>
              {showArchived ? "No archived notifications" : "No notifications"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredEmployeeNotifs.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: N.steel, letterSpacing: "1px" }}>
                  Employee Notifications ({filteredEmployeeNotifs.length})
                </h3>
                <div className="space-y-3">
                  {filteredEmployeeNotifs.map(n => (
                    <NotifCard key={n.id} n={n}
                      onDelete={showArchived ? () => handleUnarchiveNotif(n.id) : () => handleDeleteNotif(n.id)}
                      onArchive={showArchived ? undefined : () => handleArchiveNotif(n.id)} />
                  ))}
                </div>
              </section>
            )}
            {filteredAdminNotifsForEmployee.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: N.steel, letterSpacing: "1px" }}>
                  Admin Notifications ({filteredAdminNotifsForEmployee.length})
                </h3>
                <div className="space-y-3">
                  {filteredAdminNotifsForEmployee.map(n => (
                    <AdminNotifCard key={n.id} n={n}
                      onDelete={showArchived ? () => handleUnarchiveAdminNotif(n.id) : () => handleDeleteAdminNotif(n.id)}
                      onArchive={showArchived ? undefined : () => handleArchiveAdminNotif(n.id)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="w-full p-4 md:p-6 min-h-screen" style={{ background: N.surfaceSoft }}>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setShowHistory(false)} className="flex items-center gap-1 text-sm font-medium cursor-pointer" style={{ color: N.primary }}>
            <ChevronLeft size={16} /> Back
          </button>
          <h2 className="text-2xl font-semibold" style={{ color: N.ink, letterSpacing: "-0.5px" }}>Notification History</h2>
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: N.lavender, color: "#391c57" }}>{olderAdminNotifs.length + olderNotifs.length} older</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Filter size={14} style={{ color: N.steel }} />
          {["all","today","week","month","custom"].map(f => (
            <button key={f} onClick={() => setHistFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
              style={histFilter === f
                ? { background: "#1a1a1a", color: "#fff", border: "1px solid #1a1a1a" }
                : { background: "transparent", color: N.steel, border: `1px solid ${N.hairline}` }}>
              {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "This Week" : f === "month" ? "This Month" : "Custom"}
            </button>
          ))}
          {histFilter === "custom" && (
            <div className="flex items-center gap-2 ml-1">
              <input type="date" value={histCustomFrom} onChange={e => setHistCustomFrom(e.target.value)}
                className="border rounded-lg px-2 py-1 text-xs outline-none" style={{ borderColor: N.hairlineStrong }} />
              <span className="text-xs" style={{ color: N.steel }}>to</span>
              <input type="date" value={histCustomTo} onChange={e => setHistCustomTo(e.target.value)}
                className="border rounded-lg px-2 py-1 text-xs outline-none" style={{ borderColor: N.hairlineStrong }} />
            </div>
          )}
        </div>

        {filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-[#e5e3df] bg-white p-10 text-center" style={{ color: N.stone }}>
            No notifications for this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map(n => n.type && NOTIF_TYPE_CONFIG[n.type] ? <AdminNotifCard key={n.id} n={n} /> : <NotifCard key={n.id} n={n} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 min-h-screen" style={{ background: N.surfaceSoft }}>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-2xl font-semibold" style={{ color: N.ink, letterSpacing: "-0.5px" }}>Notifications</h2>
        {unread > 0 && (
          <span className="bg-[#5645d4] text-white text-xs font-semibold px-2.5 py-1 rounded-full">{unread} unread</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16" style={{ color: N.stone }}>Loading…</div>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="flex items-center gap-2 mb-4">
              <User size={16} style={{ color: N.primary }} />
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: N.slate, letterSpacing: "1px" }}>
                Employees
              </h3>
              <span className="ml-auto text-xs" style={{ color: N.stone }}>{employees.length} total</span>
            </div>

            <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
              <Search size={14} style={{ color: N.stone }} />
              <input className="outline-none text-sm bg-transparent flex-1" style={{ color: N.ink }}
                placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="cursor-pointer" style={{ color: N.stone }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {filteredEmployees.length === 0 ? (
              <div className="rounded-xl border border-[#e5e3df] bg-white p-8 text-center" style={{ color: N.stone }}>
                No employees found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredEmployees.map(emp => (
                  <EmployeeCard key={emp.employee_id} emp={emp} onClick={handleSelectEmployee} />
                ))}
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Bell size={16} style={{ color: N.primary }} />
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: N.slate, letterSpacing: "1px" }}>
                  System Alerts
                </h3>
                <span className="ml-auto text-xs" style={{ color: N.stone }}>{recentAdminNotifs.length} this week</span>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {SYSTEM_FILTERS.map(f => {
                  const count = f.key === "all" ? recentAdminNotifs.length : recentAdminNotifs.filter(n => n.type === f.key).length;
                  if (f.key !== "all" && count === 0) return null;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setSystemFilter(f.key)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all"
                      style={{
                        background: systemFilter === f.key ? N.primary : N.surface,
                        color: systemFilter === f.key ? "#fff" : N.slate,
                        border: `1px solid ${systemFilter === f.key ? N.primary : N.hairline}`
                      }}
                    >
                      <span>{f.emoji}</span> {f.label}
                      {count > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: systemFilter === f.key ? "rgba(255,255,255,0.25)" : N.lavender, color: systemFilter === f.key ? "#fff" : N.primary }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredSystemNotifs.length === 0 ? (
                <div className="rounded-xl border border-[#e5e3df] bg-white p-8 text-center" style={{ color: N.stone }}>
                  <CheckCircle size={32} className="mx-auto mb-2 text-[#1aae39]" />
                  {systemFilter === "all" ? "No system alerts in the last 7 days." : `No "${SYSTEM_FILTERS.find(f=>f.key===systemFilter)?.label}" alerts this week.`}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSystemNotifs.map(n => (
                    <div key={n.id} onClick={() => !n.is_read && markAdminNotifRead(n.id)} className={!n.is_read ? "cursor-pointer" : ""}>
                      <AdminNotifCard n={n} onDelete={async (id) => {
                        try {
                          const token = localStorage.getItem("token");
                          await axios.delete(`${API}/api/notifications/admin/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                          fetchAdminNotifs();
                        } catch(e){}
                      }} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={16} style={{ color: N.orange }} />
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: N.slate, letterSpacing: "1px" }}>
                  Approvals Needed
                </h3>
                {totalApprovalNeeded > 0 && (
                  <span className="ml-auto bg-[#dd5b00] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {totalApprovalNeeded}
                  </span>
                )}
              </div>

              {totalApprovalNeeded === 0 ? (
                <div className="rounded-xl border border-[#e5e3df] bg-white p-8 text-center" style={{ color: N.stone }}>
                  <CheckCircle size={32} className="mx-auto mb-2 text-[#1aae39]" />
                  All caught up.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map(n => (
                    <div key={n.id} className="rounded-xl border border-[#ffe8d4] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#ffe8d4] flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-[#dd5b00]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: N.ink }}>{n.first_name || "New User"}</p>
                          {n.email && <p className="text-xs" style={{ color: N.steel }}>{n.email}</p>}
                          {n.role && <p className="text-xs mt-0.5" style={{ color: N.slate }}>Role: <span className="font-semibold capitalize">{n.role}</span></p>}
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: N.stone }}><Clock size={10} /> {formatDate(n.created_at)}</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => handleAction(n.user_id, "active", n.id)} className="flex items-center gap-1.5 bg-[#1aae39] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button onClick={() => handleAction(n.user_id, "rejected", n.id)} className="flex items-center gap-1.5 bg-[#e03131] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {changeRequests.map(cr => (
                    <div key={cr.id} className="rounded-xl border border-[#e6e0f5] bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#e6e0f5] flex items-center justify-center flex-shrink-0">
                          {cr.field === "password" ? <Lock size={16} className="text-[#5645d4]" /> : <Edit size={16} className="text-[#5645d4]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: N.ink }}>{cr.first_name} <span className="font-normal text-xs" style={{ color: N.steel }}>({cr.email})</span></p>
                          <p className="text-xs mt-0.5" style={{ color: N.slate }}>
                            Change: <span className="font-semibold">{getFieldLabel(cr.field)}</span>
                            {cr.field !== "password" && <span className="ml-1 text-[#1aae39]">→ {cr.new_value}</span>}
                          </p>
                          <p className="text-xs mt-1 flex items-center gap-1" style={{ color: N.stone }}><Clock size={10} /> {formatDate(cr.created_at)}</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => handleProfileChange(cr.id, "approved")} className="flex items-center gap-1.5 bg-[#1aae39] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button onClick={() => handleProfileChange(cr.id, "declined")} className="flex items-center gap-1.5 bg-[#e03131] text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                              <XCircle size={13} /> Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {(olderAdminNotifs.length > 0 || olderNotifs.length > 0) && (
            <button onClick={() => setShowHistory(true)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-xl border cursor-pointer transition-colors"
              style={{ background: N.surface, borderColor: N.hairline }}>
              <div className="flex items-center gap-3">
                <Clock size={16} style={{ color: N.steel }} />
                <span className="text-sm font-medium" style={{ color: N.charcoal }}>Notification History</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: N.hairline, color: N.slate }}>
                  {olderAdminNotifs.length + olderNotifs.length} older notifications
                </span>
              </div>
              <ChevronRight size={16} style={{ color: N.steel }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
