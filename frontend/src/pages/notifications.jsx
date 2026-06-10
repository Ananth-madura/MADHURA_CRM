import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bell, AlertTriangle, Trophy, Clock, Search, X, Trash2, Archive, RotateCcw, ClipboardList } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { API } from "../config/api";
import { requestPushPermission, isPushSupported } from "../utils/pushNotifications";

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

const NOTIF_CONFIG = {
  missed_reminder_alert: {
    icon: AlertTriangle,
    color: N.orange,
    bg: N.peach,
    label: "Missed Reminder Alert",
    desc: "3+ reminders missed for a client",
  },
  target_completed: {
    icon: Trophy,
    color: N.green,
    bg: N.mint,
    label: "Target Completed",
    desc: "Monthly target fully achieved",
  },
  daily_task_summary: {
    icon: ClipboardList,
    color: N.primary,
    bg: N.lavender,
    label: "Daily Task Summary",
    desc: "Summary of outstanding and overdue tasks",
  },
  task_not_completed: {
    icon: AlertTriangle,
    color: N.error,
    bg: N.peach,
    label: "Incomplete Task Alert",
    desc: "Task overdue and incomplete",
  },
};

const NotifCard = ({ n, onMarkRead, onDelete, onArchive, showArchived, onShowTasksModal }) => {
  const config = NOTIF_CONFIG[n.type] || { icon: Bell, color: N.steel, bg: N.surface, label: n.type, desc: "" };
  const Icon = config.icon;
  const isUnread = n.is_read === 0;
  const source = n._source;

  return (
    <div
      className="rounded-xl border p-4 transition-all cursor-pointer hover:shadow-sm"
      style={{
        background: N.canvas,
        borderColor: isUnread ? config.color : N.hairline,
        borderLeftWidth: "4px",
        borderLeftColor: config.color,
      }}
      onClick={(e) => {
        if (isUnread && !showArchived) {
          onMarkRead?.(n.id, source);
        }
        if (n.type === "daily_task_summary") {
          onShowTasksModal?.();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: config.bg }}>
          <Icon size={18} style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold" style={{ color: N.ink }}>{config.label}</p>
            {isUnread && !showArchived && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: config.color }} />}
          </div>
          <p className="text-xs mb-2" style={{ color: N.slate }}>{n.message || n.description || n.data?.message || ""}</p>
          <div className="flex items-center gap-3 text-xs" style={{ color: N.stone }}>
            <span className="flex items-center gap-1"><Clock size={10} />{timeAgo(n.created_at || n.timestamp)}</span>
            {n.data?.customerName && <span>Client: {n.data.customerName}</span>}
            {n.data?.userName && <span>Employee: {n.data.userName}</span>}
            {n.data?.count && <span>Missed: {n.data.count}</span>}
            {n.data?.percentage && <span>Progress: {n.data.percentage}%</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-shrink-0">
          {showArchived ? (
            <button onClick={(e) => { e.stopPropagation(); onArchive?.(n.id, source); }} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors" title="Unarchive" style={{ color: N.primary }}>
              <RotateCcw size={14} />
            </button>
          ) : (
            <>
              <button onClick={(e) => { e.stopPropagation(); onArchive?.(n.id, source); }} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors" title="Archive" style={{ color: N.steel }}>
                <Archive size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete?.(n.id, source); }} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors" title="Delete" style={{ color: N.error }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const TasksSummaryModal = ({ isOpen, onClose, tasks, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  if (!isOpen) return null;

  const filteredTasks = tasks.filter(t => {
    const nameMatch = (t.project_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (t.task_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (t.staff_name || t.assigned_to || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === "all") return nameMatch;
    if (statusFilter === "New") return nameMatch && t.project_status === "New";
    if (statusFilter === "Process") return nameMatch && t.project_status === "Process";
    if (statusFilter === "Completed") return nameMatch && t.project_status === "Completed";
    return nameMatch;
  });

  const getPriorityStyle = (p) => {
    switch (p) {
      case "Urgent": return { color: "#e03131", bg: "#ffe3e3" };
      case "High": return { color: "#dd5b00", bg: "#ffe8d4" };
      case "Medium": return { color: "#5645d4", bg: "#e6e0f5" };
      default: return { color: "#37352f", bg: "#f6f5f4" };
    }
  };

  const getStatusStyle = (s) => {
    switch (s) {
      case "Completed": return { color: "#1aae39", bg: "#d9f3e1" };
      case "Process": return { color: "#0072f5", bg: "#dcecfa" };
      default: return { color: "#787671", bg: "#f6f5f4" };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border" style={{ background: N.canvas, borderColor: N.hairline }}>
        {/* Header */}
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: N.hairline }}>
          <div>
            <h3 className="text-lg font-bold" style={{ color: N.ink }}>Current Task Statuses</h3>
            <p className="text-xs mt-1" style={{ color: N.steel }}>Live details of all active and pending tasks</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer" style={{ color: N.steel }}>
            <X size={20} />
          </button>
        </div>

        {/* Filter controls */}
        <div className="p-6 border-b flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: N.hairline, background: N.surfaceSoft }}>
          <div className="flex gap-1 rounded-xl p-1 w-full md:w-auto" style={{ background: N.surface }}>
            {[
              { key: "all", label: "All Statuses" },
              { key: "New", label: "New" },
              { key: "Process", label: "In Process" },
              { key: "Completed", label: "Completed" },
            ].map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${statusFilter === f.key ? "bg-white shadow" : ""}`}
                style={{ color: statusFilter === f.key ? N.primary : N.steel }}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border w-full md:w-80" style={{ background: N.canvas, borderColor: N.hairline }}>
            <Search size={14} style={{ color: N.stone }} />
            <input className="outline-none text-sm bg-transparent w-full" style={{ color: N.ink }}
              placeholder="Search tasks or staff..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="cursor-pointer" style={{ color: N.stone }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm font-medium" style={{ color: N.slate }}>Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-20">
              <ClipboardList size={48} className="mx-auto mb-3" style={{ color: N.stone }} />
              <p className="text-sm font-medium" style={{ color: N.slate }}>No tasks found</p>
              <p className="text-xs mt-1" style={{ color: N.stone }}>Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b text-xs font-semibold uppercase tracking-wider" style={{ borderColor: N.hairline, color: N.stone }}>
                    <th className="pb-3 pl-2">Project & Task</th>
                    <th className="pb-3">Assigned Staff</th>
                    <th className="pb-3">Due Date</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm" style={{ borderColor: N.hairline }}>
                  {filteredTasks.map(t => {
                    const pStyle = getPriorityStyle(t.project_priority);
                    const sStyle = getStatusStyle(t.project_status);
                    return (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="py-4 pl-2">
                          <p className="font-semibold group-hover:text-indigo-600 transition-colors" style={{ color: N.ink }}>{t.task_title}</p>
                          <p className="text-xs mt-0.5" style={{ color: N.steel }}>{t.project_name || "General Project"}</p>
                        </td>
                        <td className="py-4 font-medium" style={{ color: N.charcoal }}>{t.staff_name || t.assigned_to || "Unassigned"}</td>
                        <td className="py-4" style={{ color: N.slate }}>{t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No due date"}</td>
                        <td className="py-4">
                          <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide inline-block" style={{ color: pStyle.color, background: pStyle.bg }}>
                            {t.project_priority || "Normal"}
                          </span>
                        </td>
                        <td className="py-4 pr-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold inline-block" style={{ color: sStyle.color, background: sStyle.bg }}>
                            {t.project_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Notifications = () => {
  const { user } = useAuth();
  const { notifications, adminNotifications, markAsRead, markAdminAsRead, refreshNotifications,
    archiveNotification, unarchiveNotification, deleteNotification,
    archiveAdminNotification, unarchiveAdminNotification, deleteAdminNotification } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pushStatus, setPushStatus] = useState("unknown");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedNotifs, setArchivedNotifs] = useState([]);

  const [showTasksModal, setShowTasksModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const isAdmin = user?.role === "admin";
  const isSubAdmin = user?.role === "subadmin";

  const handleShowTasksModal = async () => {
    setShowTasksModal(true);
    setLoadingTasks(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/task`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTasks(res.data || []);
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (isPushSupported()) {
      setPushStatus(Notification.permission);
    }
  }, []);

  const fetchArchived = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [empRes, adminRes] = await Promise.all([
        axios.get(`${API}/api/notifications?limit=100`, { headers }),
        axios.get(`${API}/api/notifications/admin?limit=100`, { headers })
      ]);
      const archived = [...empRes.data.filter(n => n.is_archived === 1), ...adminRes.data.filter(n => n.is_archived === 1)];
      setArchivedNotifs(archived.sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp)));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (showArchived) fetchArchived();
  }, [showArchived]);

  const requestNotificationPermission = async () => {
    if (!isPushSupported()) return;
    const granted = await requestPushPermission();
    setPushStatus(granted ? "granted" : "denied");
  };

  const allNotifs = isAdmin || isSubAdmin
    ? [
        ...notifications.map(n => ({ ...n, _source: "employee" })),
        ...adminNotifications.map(n => ({ ...n, _source: "admin" }))
      ]
    : notifications;

  const filteredNotifs = allNotifs
    .filter(n => {
      if (filter === "missed") return n.type === "missed_reminder_alert";
      if (filter === "target") return n.type === "target_completed";
      return true;
    })
    .filter(n => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      const msg = (n.message || n.description || n.data?.message || "").toLowerCase();
      const customer = (n.data?.customerName || "").toLowerCase();
      const employee = (n.data?.userName || "").toLowerCase();
      return msg.includes(search) || customer.includes(search) || employee.includes(search);
    })
    .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));

  const handleMarkRead = async (id, source) => {
    if (source === "admin" || (isAdmin && source === undefined && adminNotifications.some(n => n.id === id))) {
      await markAdminAsRead(id);
    } else {
      await markAsRead(id);
    }
  };

  const handleArchive = async (id, source) => {
    if (source === "admin" || (isAdmin && source === undefined && adminNotifications.some(n => n.id === id))) {
      await archiveAdminNotification(id);
    } else {
      await archiveNotification(id);
    }
    refreshNotifications();
  };

  const handleUnarchive = async (id, source) => {
    if (source === "admin" || (isAdmin && source === undefined && adminNotifications.some(n => n.id === id))) {
      await unarchiveAdminNotification(id);
    } else {
      await unarchiveNotification(id);
    }
    refreshNotifications();
    fetchArchived();
  };

  const handleDelete = async (id, source) => {
    if (!window.confirm("Delete this notification?")) return;
    if (source === "admin" || (isAdmin && source === undefined && adminNotifications.some(n => n.id === id))) {
      await deleteAdminNotification(id);
    } else {
      await deleteNotification(id);
    }
    refreshNotifications();
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      if (isAdmin || isSubAdmin) {
        await axios.put(`${API}/api/notifications/admin/read-all`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await axios.put(`${API}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      refreshNotifications();
    } catch (e) { console.error(e); }
  };

  const missedCount = filteredNotifs.filter(n => n.type === "missed_reminder_alert").length;
  const targetCount = filteredNotifs.filter(n => n.type === "target_completed").length;
  const unreadCount = filteredNotifs.filter(n => n.is_read === 0).length;

  return (
    <div className="w-full p-4 md:p-6 min-h-screen" style={{ background: N.surfaceSoft }}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: N.ink }}>Notifications</h2>
          <p className="text-sm mt-1" style={{ color: N.steel }}>Missed reminders & target completions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md"
            style={{ background: showArchived ? N.primary : N.surface, color: showArchived ? "#fff" : N.slate, border: `1px solid ${showArchived ? N.primary : N.hairline}` }}
          >
            {showArchived ? "Active" : "Archived"}
          </button>
          {pushStatus !== "granted" && isPushSupported() && (
            <button
              onClick={requestNotificationPermission}
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md"
              style={{ background: N.primary, color: "#fff" }}
            >
              Enable Desktop Notifications
            </button>
          )}
          {pushStatus === "granted" && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: N.mint, color: N.green }}>
              Desktop Notifications On
            </span>
          )}
          {unreadCount > 0 && !showArchived && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md"
              style={{ background: N.surface, color: N.slate, border: `1px solid ${N.hairline}` }}
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4 border" style={{ background: N.canvas, borderColor: N.hairline }}>
          <p className="text-xs font-medium" style={{ color: N.steel }}>Total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: N.ink }}>{filteredNotifs.length}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: N.peach, borderColor: N.orange }}>
          <p className="text-xs font-medium" style={{ color: N.orange }}>Missed Reminders</p>
          <p className="text-2xl font-bold mt-1" style={{ color: N.orange }}>{missedCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: N.mint, borderColor: N.green }}>
          <p className="text-xs font-medium" style={{ color: N.green }}>Targets Completed</p>
          <p className="text-2xl font-bold mt-1" style={{ color: N.green }}>{targetCount}</p>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: N.lavender, borderColor: N.primary }}>
          <p className="text-xs font-medium" style={{ color: N.primary }}>Unread</p>
          <p className="text-2xl font-bold mt-1" style={{ color: N.primary }}>{unreadCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: N.surface }}>
          {[
            { key: "all", label: "All" },
            { key: "missed", label: "Missed Reminders" },
            { key: "target", label: "Targets Completed" },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f.key ? "bg-white shadow" : ""}`}
              style={{ color: filter === f.key ? N.primary : N.steel }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
          <Search size={14} style={{ color: N.stone }} />
          <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
            placeholder="Search notifications..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="cursor-pointer" style={{ color: N.stone }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      {showArchived ? (
        archivedNotifs.length === 0 ? (
          <div className="rounded-xl border p-10 text-center" style={{ background: N.canvas, borderColor: N.hairline }}>
            <Archive size={40} className="mx-auto mb-3" style={{ color: N.stone }} />
            <p className="text-sm font-medium" style={{ color: N.slate }}>No archived notifications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {archivedNotifs.map(n => (
              <NotifCard key={n.id || n.dbId} n={n} showArchived onMarkRead={handleMarkRead} onArchive={handleUnarchive} onShowTasksModal={handleShowTasksModal} />
            ))}
          </div>
        )
      ) : filteredNotifs.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={{ background: N.canvas, borderColor: N.hairline }}>
          <Bell size={40} className="mx-auto mb-3" style={{ color: N.stone }} />
          <p className="text-sm font-medium" style={{ color: N.slate }}>No notifications yet</p>
          <p className="text-xs mt-1" style={{ color: N.stone }}>
            You'll see alerts when reminders are missed or targets are completed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifs.map(n => (
            <NotifCard key={n.id || n.dbId} n={n} onMarkRead={handleMarkRead} onArchive={handleArchive} onDelete={handleDelete} onShowTasksModal={handleShowTasksModal} />
          ))}
        </div>
      )}

      {/* Tasks Summary Modal */}
      <TasksSummaryModal isOpen={showTasksModal} onClose={() => setShowTasksModal(false)} tasks={tasks} loading={loadingTasks} />
    </div>
  );
};

export default Notifications;
