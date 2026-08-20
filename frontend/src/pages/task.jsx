import React, { useState, useEffect } from "react";
import { Search, Plus, X, Target as TargetIcon, Calendar, Clock, CheckCircle, User, RefreshCw, ChevronLeft, Filter } from "lucide-react";
import { getToday } from "../utils/leadutil";
import "../Styles/tailwind.css";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import socket, { notificationSocket } from "../socket/socket";
import { API } from "../config/api";

// ─── Design tokens (Notion) ───────────────────────────────────────────────────
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
  rose: "#fde0ec",
  yellow: "#fef7d6",
};

// ─── Tiny shared components ───────────────────────────────────────────────────
const PillTab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-150 cursor-pointer"
    style={active
      ? { background: N.ink, color: "#fff", border: `1px solid ${N.ink}` }
      : { background: "transparent", color: N.steel, border: `1px solid ${N.hairline}` }}
  >
    {children}
  </button>
);

const StatusBadge = ({ status }) => {
  const map = {
    New: { bg: N.peach, color: N.orange },
    Process: { bg: N.sky, color: "#0075de" },
    Completed: { bg: N.mint, color: N.green },
    Expired: { bg: N.rose, color: N.error },
  };
  const s = map[status] || { bg: N.surface, color: N.steel };
  return (
    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
};

const PriorityDot = ({ priority }) => {
  const c = { High: N.error, Medium: N.orange, Low: N.green, Urgent: "#9b1c1c" }[priority] || N.steel;
  return <span className="text-xs font-semibold" style={{ color: c }}>{priority || "Medium"}</span>;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── Date filter helpers ──────────────────────────────────────────────────────
const parseMonthYear = (monthYear) => {
  if (!monthYear) return new Date(NaN);
  const parts = monthYear.split(" ");
  if (parts.length !== 2) return new Date(NaN);
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const m = months[parts[0]];
  const y = parseInt(parts[1]);
  if (m === undefined || isNaN(y)) return new Date(NaN);
  return new Date(y, m, 1);
};

const applyDateFilter = (items, dateField, filter, customFrom, customTo) => {
  if (filter === "all") return items;
  const now = new Date();
  return items.filter(item => {
    let d = new Date(item[dateField]);
    if (isNaN(d.getTime())) d = parseMonthYear(item[dateField]);
    if (isNaN(d.getTime())) return false;
    if (filter === "day") return d.toDateString() === now.toDateString();
    if (filter === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo && d <= now;
    }
    if (filter === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (filter === "year") return d.getFullYear() === now.getFullYear();
    if (filter === "custom") {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + "T23:59:59") : null;
      return (!from || d >= from) && (!to || d <= to);
    }
    return true;
  });
};

const DateFilterBar = ({ filter, setFilter, customFrom, setCustomFrom, customTo, setCustomTo, showCustom }) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="flex gap-1 rounded-xl p-1" style={{ background: N.surface }}>
      {["all", "day", "week", "month", "year", "custom"].map(f => (
        <button key={f} onClick={() => setFilter(f)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f ? "bg-white shadow" : ""}`}
          style={{ color: filter === f ? N.primary : N.steel }}>
          {f === "all" ? "All" : f === "day" ? "Day" : f === "week" ? "Week" : f === "month" ? "Month" : f === "year" ? "Year" : "Custom"}
        </button>
      ))}
    </div>
    {showCustom && filter === "custom" && (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm" style={{ background: N.canvas, borderColor: N.hairline }}>
        <Calendar size={14} style={{ color: N.steel }} />
        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
          className="border-0 outline-none text-sm" style={{ color: N.ink }} />
        <span className="text-sm" style={{ color: N.steel }}>to</span>
        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
          className="border-0 outline-none text-sm" style={{ color: N.ink }} />
      </div>
    )}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const Task = () => {
  const { user } = useAuth();
  const { refreshNotifications } = useNotifications();
  const isAdmin = user?.role === "admin";
  const isSubAdmin = user?.role === "subadmin";
  const isEmployee = user?.role === "employee";
  const canManageTasks = isAdmin || isSubAdmin;

  const [tasks, setTasks] = useState([]);
  const [taskTargets, setTaskTargets] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [activeTab, setActiveTab] = useState("tasks");
  const [lastUpdate, setLastUpdate] = useState(null);

  // Task form / modals
  const [open, setOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState(null);

  // Target form / modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetForm, setTargetForm] = useState({ user_name: "", yearly_target: "", user_id: "", teammember_id: "" });

  // Active tasks filters
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // History drill-in state (tasks)
  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [histFilter, setHistFilter] = useState("all");
  const [histCustomFrom, setHistCustomFrom] = useState("");
  const [histCustomTo, setHistCustomTo] = useState("");
  const [histSearch, setHistSearch] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState("all");
  const [histEmployeeFilter, setHistEmployeeFilter] = useState("all");

  // Target history drill-in state
  const [targetHistEmployee, setTargetHistEmployee] = useState(null);
  const [tHistFilter, setTHistFilter] = useState("all");
  const [tHistCustomFrom, setTHistCustomFrom] = useState("");
  const [tHistCustomTo, setTHistCustomTo] = useState("");
  const [tHistSearch, setTHistSearch] = useState("");
  const [tHistStatusFilter, setTHistStatusFilter] = useState("all");

  const [form, setForm] = useState({
    project_name: "", task_title: "", task_description: "", client_name: "", staff_name: "",
    assigned_to: "", assigned_teammember_id: "",
    created_date: getToday(),
    due_date: getToday(),
    project_status: "New", project_priority: "Medium",
  });

  const resetForm = () => {
    setForm({
      project_name: "", task_title: "", task_description: "", client_name: "", staff_name: "", assigned_to: "", assigned_teammember_id: "",
      created_date: getToday(), due_date: getToday(),
      project_status: "New", project_priority: "Medium"
    });
    setSelectedTask(null);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    const loadCached = () => {
      try {
        const cachedTasks = localStorage.getItem("cached_tasks");
        const cachedTargets = localStorage.getItem("cached_targets");
        const cachedTeam = localStorage.getItem("cached_team_members");
        const cachedClients = localStorage.getItem("cached_clients");
        if (cachedTasks) setTasks(JSON.parse(cachedTasks));
        if (cachedTargets) setTaskTargets(JSON.parse(cachedTargets));
        if (cachedTeam) setTeamMembers(JSON.parse(cachedTeam));
        if (cachedClients) setClients(JSON.parse(cachedClients));
      } catch (e) { console.error("Cache load error:", e); }
    };

    try {
      const token = localStorage.getItem("token");
      const cfg = { headers: { Authorization: `Bearer ${token}` } };
      const teamProm = axios.get(`${API}/api/teammember`).catch(() => ({ data: [] }));
      const clientProm = axios.get(`${API}/api/client`, cfg).catch(() => ({ data: [] }));

      if (isAdmin) {
        const [tasksRes, targetsRes, teamRes, clientsRes] = await Promise.all([
          axios.get(`${API}/api/task`, cfg),
          axios.get(`${API}/api/task/targets`, cfg),
          teamProm,
          clientProm,
        ]);
        const tData = tasksRes.data || [];
        const tgData = targetsRes.data || [];
        const tmData = teamRes.data || [];
        const cData = clientsRes.data || [];

        setTasks(tData);
        setTaskTargets(tgData);
        setTeamMembers(tmData);
        setClients(cData);

        localStorage.setItem("cached_tasks", JSON.stringify(tData));
        localStorage.setItem("cached_targets", JSON.stringify(tgData));
        localStorage.setItem("cached_team_members", JSON.stringify(tmData));
        localStorage.setItem("cached_clients", JSON.stringify(cData));
      } else {
        const userName = user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email?.split("@")[0] || "";
        const [tasksRes, targetsRes, teamRes, clientsRes] = await Promise.all([
          axios.get(`${API}/api/task`, cfg),
          axios.get(`${API}/api/task/targets/my?user_name=${encodeURIComponent(userName)}`, cfg).catch(() => ({ data: { hasTarget: false } })),
          teamProm,
          clientProm,
        ]);
        const tData = tasksRes.data || [];
        const tgData = (targetsRes.data && targetsRes.data.id) ? [targetsRes.data] : [];
        const tmData = teamRes.data || [];
        const cData = clientsRes.data || [];

        setTasks(tData);
        setTaskTargets(tgData);
        setTeamMembers(tmData);
        setClients(cData);

        localStorage.setItem("cached_tasks", JSON.stringify(tData));
        localStorage.setItem("cached_targets", JSON.stringify(tgData));
        localStorage.setItem("cached_team_members", JSON.stringify(tmData));
        localStorage.setItem("cached_clients", JSON.stringify(cData));
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Fetch error, loading cache:", err);
      loadCached();
    }
  };

  useEffect(() => {
    // Instant offline/cached startup before network call resolves
    try {
      const cachedTasks = localStorage.getItem("cached_tasks");
      const cachedTargets = localStorage.getItem("cached_targets");
      const cachedTeam = localStorage.getItem("cached_team_members");
      const cachedClients = localStorage.getItem("cached_clients");
      if (cachedTasks) setTasks(JSON.parse(cachedTasks));
      if (cachedTargets) setTaskTargets(JSON.parse(cachedTargets));
      if (cachedTeam) setTeamMembers(JSON.parse(cachedTeam));
      if (cachedClients) setClients(JSON.parse(cachedClients));
    } catch (e) { console.error("Cache load mount error:", e); }

    fetchAll();
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => { fetchAll(); refreshNotifications(); };
    socket.on("task_updated", refresh); socket.on("new_task", refresh);
    socket.on("target_updated", refresh); socket.on("new_target", refresh);
    socket.on("data_changed", refresh);
    
    return () => {
      socket.off("task_updated", refresh); socket.off("new_task", refresh);
      socket.off("target_updated", refresh); socket.off("new_target", refresh);
      socket.off("data_changed", refresh);
    };
  }, []);

  useEffect(() => {
    if (!notificationSocket) return;

    // Listen for real-time employee achievements (admin only)
    notificationSocket.on("employee_achievement", (data) => {
      if (isAdmin) {
        setAchievements(prev => {
          const existing = prev.findIndex(a => a.id === data.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], ...data };
            return updated;
          }
          return [data, ...prev];
        });
      }
    });

    // Listen for achievement recorded (employee side)
    notificationSocket.on("achievement_recorded", (data) => {
      if (!isAdmin) {
        // Refresh employee's target card
        fetchAll();
      }
    });

    // Listen for target data changes
    notificationSocket.on("target_data_changed", (data) => {
      fetchAll();
      refreshNotifications();
    });

    // Listen for target updated data (for admin dashboard)
    notificationSocket.on("target_updated_data", (data) => {
      if (isAdmin) {
        setTaskTargets(prev => prev.map(target =>
          target.id === data.target_id
            ? {
              ...target,
              achieved_amount: data.monthly_achieved,
              ytd_amount: data.yearly_achieved,
              current_percentage: data.monthly_percentage,
              yearly_percentage: data.yearly_percentage,
              carry_forward: data.carry_forward !== undefined ? data.carry_forward : target.carry_forward,
              effective_target: data.effective_target !== undefined ? data.effective_target : target.effective_target,
              updated_at: data.timestamp
            }
            : target
        ));
      }
    });

    // Global data changed event
    notificationSocket.on("data_changed", (data) => {
      if (data.type === "target_achievement") {
        fetchAll();
        refreshNotifications();
      }
    });

    return () => {
      notificationSocket.off("employee_achievement");
      notificationSocket.off("achievement_recorded");
      notificationSocket.off("target_data_changed");
      notificationSocket.off("target_updated_data");
      notificationSocket.off("data_changed");
    };
  }, [isAdmin]);

  // ── Derived data ───────────────────────────────────────────────────────────
  // Backend already filters tasks for employees, so just use the returned data
  const myTasks = tasks;

  // Active = pending (New or Process), not completed/expired
  const activeTasks = myTasks.filter(t => t.project_status === "New" || t.project_status === "Process");

  // History = completed or expired
  const historyTasks = myTasks.filter(t => t.project_status === "Completed" || t.project_status === "Expired");

  // Unique employees who have history tasks (for admin drill-in list)
  const historyEmployees = isAdmin
    ? [...new Map(historyTasks.map(t => [t.staff_name || t.assigned_to, t])).values()]
      .map(t => t.staff_name || t.assigned_to).filter(Boolean)
    : [];

  // Tasks for selected employee in history drill-in
  const drillTasks = historyEmployee
    ? applyDateFilter(
      historyTasks.filter(t => (t.staff_name || t.assigned_to) === historyEmployee),
      "due_date", histFilter, histCustomFrom, histCustomTo
    )
    : [];

  // Filtered active tasks
  const filteredActive = activeTasks.filter(t => {
    const matchSearch = !searchTerm ||
      t.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.task_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.staff_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchEmp = !isAdmin || employeeFilter === "all" ||
      (t.staff_name || t.assigned_to)?.toLowerCase().includes(employeeFilter.toLowerCase());
    return matchSearch && matchEmp;
  });

  // Target history drill-in
  const targetHistoryEmployees = isAdmin
    ? taskTargets.map(t => t.user_name).filter(Boolean)
    : [];

  const drillTargetHistory = targetHistEmployee
    ? applyDateFilter(
      (taskTargets.find(t => t.user_name === targetHistEmployee)?.history || []),
      "month_year", tHistFilter, tHistCustomFrom, tHistCustomTo
    )
    : [];

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const cfg = { headers: { Authorization: `Bearer ${token}` } };
    try {
      const data = {
        project_name: form.project_name,
        task_title: form.task_title,
        task_description: form.task_description,
        client_name: form.client_name,
        staff_name: form.assigned_to || user?.name,
        assigned_to: form.assigned_to,
        assigned_teammember_id: form.assigned_teammember_id || null,
        created_date: form.created_date,
        due_date: form.due_date,
        project_status: form.project_status,
        project_priority: form.project_priority,
      };
      if (selectedTask) {
        await axios.put(`${API}/api/task/${selectedTask.id}`, data, cfg);
        socket?.emit("task_updated", { taskId: selectedTask.id });
      } else {
        await axios.post(`${API}/api/task`, data, cfg);
        socket?.emit("new_task", { assignedTo: form.assigned_to });
      }
      fetchAll(); setOpen(false); resetForm(); refreshNotifications();
    } catch (err) { alert(err.response?.data?.message || "Failed to save task"); }
  };

  const updateStatus = async (taskId, status) => {
    const token = localStorage.getItem("token");
    try {
      await axios.put(`${API}/api/task/${taskId}`, { project_status: status }, { headers: { Authorization: `Bearer ${token}` } });
      if (status === "Completed") {
        socket?.emit("task_completed", { taskId, status });
        socket?.emit("new_notification", { type: "task_completed", data: { taskId, status }, is_read: 0, timestamp: new Date().toISOString() });
      }
      socket?.emit("task_updated", { taskId, status });
      fetchAll(); setStatusModalOpen(false); refreshNotifications();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    if (!targetForm.user_id && !targetForm.user_name) return alert("Please select employee");
    if (!targetForm.yearly_target) return alert("Please enter target amount");
    const token = localStorage.getItem("token");
    try {
      let name = targetForm.user_name;
      if (targetForm.user_id && !name) {
        const m = teamMembers.find(m => m.user_id == targetForm.user_id || m.id == targetForm.user_id);
        name = `${m?.first_name} ${m?.last_name || ""}`.trim();
      }
      await axios.post(`${API}/api/task/targets`, {
        user_id: targetForm.user_id, user_name: targetForm.user_name,
        teammember_id: targetForm.teammember_id,
        yearly_target: parseFloat(targetForm.yearly_target), created_by_admin: true
      }, { headers: { Authorization: `Bearer ${token}` } });
      socket?.emit("new_target", { userName: name });
      setTargetModalOpen(false);
      setTargetForm({ user_name: "", yearly_target: "", user_id: "", teammember_id: "" });
      fetchAll(); refreshNotifications();
    } catch (err) { alert(err.response?.data?.error || "Failed to save target"); }
  };

  const handleAchievementUpdate = async (amount, description) => {
    const token = localStorage.getItem("token");
    const userName = user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
    try {
      const res = await axios.post(`${API}/api/task/targets/update`, {
        user_id: user.id, user_name: userName, amount, description
      }, { headers: { Authorization: `Bearer ${token}` } });
      socket?.emit("target_updated", { userId: user.id });
      fetchAll(); refreshNotifications();
      return res.data;
    } catch (err) { alert(err.response?.data?.error || "Failed to update achievement"); return null; }
  };

  const deleteTask = async (taskId) => {
    const token = localStorage.getItem("token");
    try {
      await axios.delete(`${API}/api/task/${taskId}`, { headers: { Authorization: `Bearer ${token}` } });
      socket?.emit("task_updated", { taskId });
      fetchAll(); refreshNotifications();
      alert("Task deleted successfully");
    } catch (err) { alert(err.response?.data?.message || "Failed to delete task"); }
  };


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full p-4 md:p-6 min-h-screen" style={{ background: N.surfaceSoft }}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold" style={{ color: N.ink, letterSpacing: "-0.5px" }}>Task & Target</h2>
        <span className="text-sm" style={{ color: N.stone }}>Dashboard › Task & Target</span>
      </div>

{/* Top-level tabs */}
<div className="flex gap-2 mb-6 flex-wrap">
  {[["tasks", "Active Tasks"], ["history", "Task History"], ["targets", "Targets"], ["targetHistory", "Target History"]].map(([key, label]) => (
    <PillTab key={key} active={activeTab === key} onClick={() => setActiveTab(key)}>{label}</PillTab>
  ))}
  {lastUpdate && (
    <span className="ml-auto text-xs flex items-center gap-1 self-center" style={{ color: N.stone }}>
      <RefreshCw size={11} /> {lastUpdate.toLocaleTimeString()}
    </span>
  )}
</div>

      {/* ── ACTIVE TASKS ─────────────────────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
              <Search size={15} style={{ color: N.stone }} />
              <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
                placeholder="Search tasks…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {canManageTasks && (
              <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
                <option value="all">All Employees</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={`${m.first_name} ${m.last_name || ""}`.trim()}>
                    {m.first_name} {m.last_name || ""}
                  </option>
                ))}
              </select>
            )}
            {canManageTasks && (
              <button onClick={() => { resetForm(); setOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                style={{ background: N.primary }}>
                <Plus size={15} /> Assign Task
              </button>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "New", count: activeTasks.filter(t => t.project_status === "New").length, bg: N.peach, color: N.orange },
              { label: "In Process", count: activeTasks.filter(t => t.project_status === "Process").length, bg: N.sky, color: "#0075de" },
              { label: "Completed", count: historyTasks.filter(t => t.project_status === "Completed").length, bg: N.mint, color: N.green },
              { label: "Total", count: myTasks.length, bg: N.lavender, color: N.primary },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 border" style={{ background: s.bg, borderColor: "transparent" }}>
                <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.count}</p>
              </div>
            ))}
          </div>

          {/* Tasks table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: N.surface }}>
                  <tr>
                    {["Task", "Assigned To", "Due Date", "Priority", "Status", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredActive.map(task => (
                    <tr key={task.id} className="border-t" style={{ borderColor: N.hairline }}>
                      <td className="px-4 py-3">
                        <button onClick={() => { setDetailTask(task); setTaskDetailOpen(true); }} className="text-left hover:underline">
                          <div className="font-medium" style={{ color: N.ink }}>{task.project_name}</div>
                          {task.task_title && <div className="text-xs mt-0.5" style={{ color: N.steel }}>{task.task_title}</div>}
                          {task.task_description && <div className="text-xs mt-1 text-gray-500 line-clamp-2">{task.task_description}</div>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: N.lavender }}>
                            <User size={13} style={{ color: N.primary }} />
                          </div>
                          <span style={{ color: N.charcoal }}>{task.staff_name || task.assigned_to || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs" style={{ color: N.steel }}>
                          <Calendar size={12} /> {fmtDate(task.due_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3"><PriorityDot priority={task.project_priority} /></td>
                      <td className="px-4 py-3"><StatusBadge status={task.project_status} /></td>
                      <td className="px-4 py-3">
                        {isEmployee ? (
                          <div className="flex gap-1">
                            {task.project_status === "New" && (
                              <button onClick={() => { setSelectedTask(task); updateStatus(task.id, "Process"); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md active:scale-95"
                                style={{ background: N.green, color: "#fff" }}>Accept</button>
                            )}
                            {task.project_status === "Process" && (
                              <button onClick={() => { setSelectedTask(task); updateStatus(task.id, "Completed"); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:shadow-md active:scale-95"
                                style={{ background: N.primary, color: "#fff" }}>Mark Done</button>
                            )}
                            {task.project_status === "Completed" && (
                              <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: N.mint, color: N.green }}>Completed</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <button onClick={() => { setSelectedTask(task); setForm({ project_name: task.project_name || "", task_title: task.task_title || "", task_description: task.task_description || "", client_name: task.client_name || "", staff_name: task.staff_name || task.assigned_to || "", assigned_to: task.assigned_to || task.staff_name || "", assigned_teammember_id: task.assigned_teammember_id || "", created_date: task.created_date || getToday(), due_date: task.due_date || getToday(), project_status: task.project_status || "New", project_priority: task.project_priority || "Medium" }); setOpen(true); }}
                              className="text-xs font-medium cursor-pointer px-2 py-1 rounded hover:bg-indigo-50" style={{ color: N.primary }}>Edit</button>
                            {canManageTasks && (
                              <button onClick={() => { if (window.confirm("Are you sure you want to delete this task?")) { deleteTask(task.id); } }}
                                className="text-xs font-medium cursor-pointer px-2 py-1 rounded hover:bg-red-50" style={{ color: N.error }}>Delete</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredActive.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: N.stone }}>No active tasks</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TASK HISTORY ─────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Admin: employee list → drill-in */}
          {isAdmin && !historyEmployee && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <DateFilterBar filter={histFilter} setFilter={setHistFilter}
                  customFrom={histCustomFrom} setCustomFrom={setHistCustomFrom}
                  customTo={histCustomTo} setCustomTo={setHistCustomTo} showCustom />
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
                    <Search size={14} style={{ color: N.stone }} />
                    <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
                      placeholder="Search by task..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                  </div>
                  <select value={histStatusFilter} onChange={e => setHistStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
                    <option value="all">All Status</option>
                    <option value="New">New</option>
                    <option value="Process">Process</option>
                    <option value="Completed">Completed</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
                <table className="w-full text-sm">
                  <thead style={{ background: N.surface }}>
                    <tr>
                      {["Employee", "Completed", "Expired", "Total History"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historyEmployees.map(emp => {
                      let empTasks = historyTasks.filter(t => (t.staff_name || t.assigned_to) === emp);
                      if (histFilter !== "all") empTasks = applyDateFilter(empTasks, "due_date", histFilter, histCustomFrom, histCustomTo);
                      if (histSearch) empTasks = empTasks.filter(t => t.project_name?.toLowerCase().includes(histSearch.toLowerCase()) || t.task_title?.toLowerCase().includes(histSearch.toLowerCase()));
                      if (histStatusFilter !== "all") empTasks = empTasks.filter(t => t.project_status === histStatusFilter);
                      return (
                        <tr key={emp} className="border-t cursor-pointer hover:bg-[#f6f5f4] transition-colors"
                          style={{ borderColor: N.hairline }}
                          onClick={() => { setHistoryEmployee(emp); setHistFilter("all"); setHistSearch(""); setHistStatusFilter("all"); }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: N.lavender }}>
                                <User size={14} style={{ color: N.primary }} />
                              </div>
                              <span className="font-medium" style={{ color: N.ink }}>{emp}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span style={{ color: N.green }}>{empTasks.filter(t => t.project_status === "Completed").length}</span></td>
                          <td className="px-4 py-3"><span style={{ color: N.error }}>{empTasks.filter(t => t.project_status === "Expired").length}</span></td>
                          <td className="px-4 py-3 font-medium" style={{ color: N.ink }}>{empTasks.length}</td>
                        </tr>
                      );
                    })}
                    {historyEmployees.length === 0 && (
                      <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: N.stone }}>No history yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Admin: drill-in view for selected employee */}
          {isAdmin && historyEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setHistoryEmployee(null); setHistFilter("all"); setHistSearch(""); setHistStatusFilter("all"); }}
                  className="flex items-center gap-1 text-sm font-medium cursor-pointer" style={{ color: N.primary }}>
                  <ChevronLeft size={16} /> Back
                </button>
                <h3 className="text-base font-semibold" style={{ color: N.ink }}>{historyEmployee} — Task History</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <DateFilterBar filter={histFilter} setFilter={setHistFilter}
                  customFrom={histCustomFrom} setCustomFrom={setHistCustomFrom}
                  customTo={histCustomTo} setCustomTo={setHistCustomTo} showCustom />
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
                    <Search size={14} style={{ color: N.stone }} />
                    <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
                      placeholder="Search by task..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                  </div>
                  <select value={histStatusFilter} onChange={e => setHistStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
                    <option value="all">All Status</option>
                    <option value="New">New</option>
                    <option value="Process">Process</option>
                    <option value="Completed">Completed</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              {(() => {
                let filtered = drillTasks;
                if (histFilter !== "all") filtered = applyDateFilter(filtered, "due_date", histFilter, histCustomFrom, histCustomTo);
                if (histSearch) filtered = filtered.filter(t => t.project_name?.toLowerCase().includes(histSearch.toLowerCase()) || t.task_title?.toLowerCase().includes(histSearch.toLowerCase()));
                if (histStatusFilter !== "all") filtered = filtered.filter(t => t.project_status === histStatusFilter);
                return <HistoryTable tasks={filtered} />;
              })()}
            </div>
          )}

          {/* Employee: own history with filters */}
          {isEmployee && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <DateFilterBar filter={histFilter} setFilter={setHistFilter}
                  customFrom={histCustomFrom} setCustomFrom={setHistCustomFrom}
                  customTo={histCustomTo} setCustomTo={setHistCustomTo} showCustom />
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
                    <Search size={14} style={{ color: N.stone }} />
                    <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
                      placeholder="Search by task..." value={histSearch} onChange={e => setHistSearch(e.target.value)} />
                  </div>
                  <select value={histStatusFilter} onChange={e => setHistStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
                    <option value="all">All Status</option>
                    <option value="New">New</option>
                    <option value="Process">Process</option>
                    <option value="Completed">Completed</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              {(() => {
                let filtered = applyDateFilter(historyTasks, "due_date", histFilter, histCustomFrom, histCustomTo);
                if (histSearch) filtered = filtered.filter(t => t.project_name?.toLowerCase().includes(histSearch.toLowerCase()) || t.task_title?.toLowerCase().includes(histSearch.toLowerCase()));
                if (histStatusFilter !== "all") filtered = filtered.filter(t => t.project_status === histStatusFilter);
                return <HistoryTable tasks={filtered} />;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── STATUS MODAL ─────────────────────────────────────────────────── */}
      {statusModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl shadow-xl w-full max-w-sm" style={{ background: N.canvas }}>
            <div className="p-4 border-b" style={{ borderColor: N.hairline }}>
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>Update Task Status</h3>
            </div>
            <div className="p-4 space-y-2">
              {["New", "Process", "Completed"].map(status => (
                <button key={status} onClick={() => updateStatus(selectedTask.id, status)}
                  disabled={isEmployee && status === "New"}
                  className="w-full p-3 rounded-lg text-left text-sm font-medium border cursor-pointer transition-colors"
                  style={{
                    borderColor: newStatus === status ? N.primary : N.hairline,
                    background: newStatus === status ? N.lavender : N.canvas,
                    color: isEmployee && status === "New" ? N.stone : N.ink,
                    cursor: isEmployee && status === "New" ? "not-allowed" : "pointer"
                  }}>
                  <StatusBadge status={status} /> {isEmployee && status === "New" ? " (not allowed)" : ""}
                </button>
              ))}
            </div>
            <div className="p-4 border-t" style={{ borderColor: N.hairline }}>
              <button onClick={() => setStatusModalOpen(false)}
                className="w-full py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: N.surface, color: N.slate }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TASK FORM MODAL ─────────────────────────────────────────────── */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl shadow-xl w-full max-w-lg" style={{ background: N.canvas }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: N.hairline }}>
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>{selectedTask ? "Update Task" : "Assign New Task"}</h3>
              <button onClick={() => { setOpen(false); resetForm(); }} className="cursor-pointer" style={{ color: N.steel }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {[["project_name", "Project Name *", "text", true], ["task_title", "Task Title", "text", false]].map(([name, label, type, req]) => (
                <div key={name}>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>{label}</label>
                  <input type={type} name={name} value={form[name]} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ borderColor: N.hairlineStrong, color: N.ink }} required={req} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Task Description</label>
                <textarea name="task_description" value={form.task_description} onChange={e => setForm({ ...form, task_description: e.target.value })}
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Enter task details..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Client Name *</label>
                <select name="client_name" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none"
                  style={{ borderColor: N.hairlineStrong, color: N.ink }} required>
                  <option value="">— Select Client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Assign To</label>
                  <select name="assigned_to" value={form.assigned_teammember_id || ""} onChange={e => {
                    const m = teamMembers.find(t => String(t.id) === e.target.value);
                    setForm({ ...form, assigned_teammember_id: m ? Number(m.id) : "", assigned_to: m ? `${m.first_name} ${m.last_name || ""}`.trim() : e.target.value });
                  }}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong }}>
                    <option value="">— Select Staff —</option>
                    {teamMembers.map(t => (
                      <option key={t.id} value={String(t.id)}>
                        {t.first_name} {t.last_name || ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Priority</label>
                  <select name="project_priority" value={form.project_priority} onChange={e => setForm({ ...form, project_priority: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong }}>
                    {["Low", "Medium", "High", "Urgent"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["created_date", "Created Date"], ["due_date", "Due Date"]].map(([name, label]) => (
                  <div key={name}>
                    <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>{label}</label>
                    <input type="date" name={name} value={form[name]} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong }} />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Status</label>
                <select name="project_status" value={form.project_status} onChange={e => setForm({ ...form, project_status: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong }}>
                  {["New", "Process", "Completed"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 py-2 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: N.primary }}>
                  {selectedTask ? "Update" : "Assign"}
                </button>
                <button type="button" onClick={() => { setOpen(false); resetForm(); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: N.surface, color: N.slate }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TARGET FORM MODAL ───────────────────────────────────────────── */}
      {targetModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl shadow-xl w-full max-w-md" style={{ background: N.canvas }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: N.hairline }}>
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>Set User Target</h3>
              <button onClick={() => { setTargetModalOpen(false); setTargetForm({ user_name: "", yearly_target: "", user_id: "", teammember_id: "" }); }} className="cursor-pointer" style={{ color: N.steel }}><X size={18} /></button>
            </div>
            <form onSubmit={handleTargetSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Select User</label>
                <select value={targetForm.teammember_id || ""} onChange={e => {
                  const m = teamMembers.find(t => String(t.id) === e.target.value);
                  setTargetForm({ ...targetForm, teammember_id: m ? m.id : "", user_name: m ? `${m.first_name} ${m.last_name || ""}`.trim() : "", user_id: m?.user_id || "" });
                }} className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong }}>
                  <option value="">— Select Staff —</option>
                  {teamMembers.map(t => (
                    <option key={t.id} value={String(t.id)}>{t.first_name} {t.last_name || ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Yearly Target (₹)</label>
                <input type="number" value={targetForm.yearly_target} onChange={e => setTargetForm({ ...targetForm, yearly_target: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong }} required placeholder="e.g. 3600000" />
                {targetForm.yearly_target && (
                  <p className="text-xs mt-1" style={{ color: N.primary }}>Monthly: ₹{Math.round(parseFloat(targetForm.yearly_target) / 12).toLocaleString()}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="flex-1 py-2 rounded-lg text-sm font-medium text-white cursor-pointer" style={{ background: N.primary }}>Save Target</button>
                <button type="button" onClick={() => { setTargetModalOpen(false); setTargetForm({ user_name: "", yearly_target: "", user_id: "", teammember_id: "" }); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: N.surface, color: N.slate }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TARGETS TAB ─────────────────────────────────────────────────── */}
      {activeTab === "targets" && (
        <div className="space-y-4">
          {canManageTasks && (
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>All Targets</h3>
              <button onClick={() => setTargetModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                style={{ background: N.primary }}>
                <Plus size={15} /> Set Target
              </button>
            </div>
          )}
          <div className={isEmployee ? "flex flex-col gap-4" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
            {taskTargets.length === 0 && (
              <div className="col-span-full text-center py-10 text-sm" style={{ color: N.stone }}>
                No targets set yet.
              </div>
            )}
            {taskTargets.map(t => (
              <div key={t.id} className={isEmployee ? "w-full space-y-3" : "rounded-xl border p-4 space-y-3 w-full"} style={isEmployee ? {} : { background: N.canvas, borderColor: N.hairline }}>
                <div className={isEmployee ? "flex items-center gap-2 px-1" : "flex items-center gap-2"}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: N.lavender }}>
                    <User size={16} style={{ color: N.primary }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: N.ink }}>{t.user_name || "Unknown"}</p>
                    <p className="text-xs" style={{ color: N.stone }}>Yearly: ₹{(parseFloat(t.yearly_target) || 0).toLocaleString()}</p>
                  </div>
                </div>
                {isEmployee ? (
                  <EmployeeTargetCard user={user} onUpdateAchievement={handleAchievementUpdate} />
                ) : (
                  <div className="space-y-2">
                    {/* Yearly Section */}
                    {(() => {
                      const yearly = parseFloat(t.yearly_target) || 0;
                      const ytdAch = parseFloat(t.ytd_amount) || 0;
                      const ytdPct = yearly > 0 ? Math.round((ytdAch / yearly) * 100) : 0;
                      const yrBalance = Math.max(0, yearly - ytdAch);
                      return (
                        <>
                          <div className="flex justify-between text-xs font-semibold pt-1 pb-1 border-b" style={{ color: N.primary, borderColor: N.hairline }}>
                            <span>Yearly Target</span>
                            <span>₹{yearly.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                            <span>YTD Achieved</span>
                            <span className="font-medium" style={{ color: N.green }}>₹{ytdAch.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                            <span>Yearly Balance</span>
                            <span className="font-medium" style={{ color: yrBalance === 0 ? N.green : N.error }}>₹{yrBalance.toLocaleString()}</span>
                          </div>
                          <div className="w-full rounded-full h-1.5" style={{ background: N.hairline }}>
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(ytdPct, 100)}%`, background: ytdPct >= 100 ? N.green : ytdPct >= 50 ? N.orange : N.error }} />
                          </div>
                          <p className="text-[10px]" style={{ color: N.stone }}>Yearly: {ytdPct}% completed</p>
                        </>
                      );
                    })()}
                    <div className="border-t pt-2" style={{ borderColor: N.hairline }}>
                      <p className="text-[10px] font-semibold mb-1" style={{ color: N.steel }}>This Month</p>
                      <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                        <span>Monthly Target</span>
                        <span className="font-medium" style={{ color: N.ink }}>₹{(parseFloat(t.monthly_target) || 0).toLocaleString()}</span>
                      </div>
                      {(t.carry_forward > 0) && (
                        <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                          <span>Carry Forward</span>
                          <span className="font-medium" style={{ color: N.orange }}>₹{(parseFloat(t.carry_forward) || 0).toLocaleString()}</span>
                        </div>
                      )}
                      {(() => {
                        const effective = parseFloat(t.effective_target) || (parseFloat(t.monthly_target) + parseFloat(t.carry_forward || 0));
                        const ach = t.achieved_amount || 0;
                        const pct = effective > 0 ? Math.round((ach / effective) * 100) : 0;
                        const balance = Math.max(0, effective - ach);
                        return (
                          <>
                            <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                              <span>Effective Target</span>
                              <span className="font-medium" style={{ color: N.primary }}>₹{effective.toLocaleString()}</span>
                            </div>
                            <div className="w-full rounded-full h-2" style={{ background: N.hairline }}>
                              <div className="h-2 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? N.green : pct >= 50 ? N.orange : N.error }} />
                            </div>
                            <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                              <span>Achieved</span>
                              <span className="font-medium" style={{ color: N.green }}>₹{ach.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs" style={{ color: N.steel }}>
                              <span>Balance</span>
                              <span className="font-medium" style={{ color: N.error }}>₹{balance.toLocaleString()}</span>
                            </div>
                            <p className="text-xs" style={{ color: N.stone }}>Progress: ₹{ach.toLocaleString()} / ₹{effective.toLocaleString()} ({pct}%)</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TARGET HISTORY TAB ───────────────────────────────────────────── */}
      {activeTab === "targetHistory" && (
        <div className="space-y-4">
          {isAdmin && !targetHistEmployee && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <DateFilterBar filter={tHistFilter} setFilter={setTHistFilter}
                  customFrom={tHistCustomFrom} setCustomFrom={setTHistCustomFrom}
                  customTo={tHistCustomTo} setCustomTo={setTHistCustomTo} showCustom />
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border" style={{ background: N.canvas, borderColor: N.hairline }}>
                    <Search size={14} style={{ color: N.stone }} />
                    <input className="outline-none text-sm bg-transparent" style={{ color: N.ink }}
                      placeholder="Search employee..." value={tHistSearch} onChange={e => setTHistSearch(e.target.value)} />
                  </div>
                  <select value={tHistStatusFilter} onChange={e => setTHistStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
                    <option value="all">All Status</option>
                    <option value="Completed">Completed</option>
                    <option value="Process">Process</option>
                    <option value="New">New</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
                <table className="w-full text-sm">
                  <thead style={{ background: N.surface }}>
                    <tr>
                      {["Employee", "Yearly Target", "Monthly Target", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let filtered = targetHistoryEmployees;
                      if (tHistSearch) filtered = filtered.filter(emp => emp.toLowerCase().includes(tHistSearch.toLowerCase()));
                      return filtered.map(emp => {
                        const t = taskTargets.find(x => x.user_name === emp);
                        const history = t?.history || [];
                        let filteredHistory = history;
                        if (tHistFilter !== "all") filteredHistory = applyDateFilter(filteredHistory, "month_year", tHistFilter, tHistCustomFrom, tHistCustomTo);
                        if (tHistStatusFilter !== "all") {
                          filteredHistory = filteredHistory.filter(h => {
                            const pct = h.monthly_target > 0 ? Math.round((h.achieved_amount / h.monthly_target) * 100) : 0;
                            const status = pct >= 100 ? "Completed" : pct >= 50 ? "Process" : "New";
                            return status === tHistStatusFilter;
                          });
                        }
                        return (
                          <tr key={emp} className="border-t cursor-pointer hover:bg-[#f6f5f4]"
                            style={{ borderColor: N.hairline }}
                            onClick={() => { setTargetHistEmployee(emp); setTHistFilter("all"); setTHistSearch(""); setTHistStatusFilter("all"); }}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: N.lavender }}>
                                  <User size={14} style={{ color: N.primary }} />
                                </div>
                                <span className="font-medium" style={{ color: N.ink }}>{emp}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3" style={{ color: N.charcoal }}>₹{(parseFloat(t?.yearly_target) || 0).toLocaleString()}</td>
                            <td className="px-4 py-3" style={{ color: N.charcoal }}>₹{(parseFloat(t?.monthly_target) || 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium" style={{ color: N.primary }}>{filteredHistory.length} records →</span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {targetHistoryEmployees.length === 0 && (
                      <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: N.stone }}>No target history.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {isAdmin && targetHistEmployee && (
            <AdminTargetDrillDown
              employeeName={targetHistEmployee}
              history={drillTargetHistory}
              tHistFilter={tHistFilter}
              onBack={() => { setTargetHistEmployee(null); setTHistFilter("all"); setTHistSearch(""); setTHistStatusFilter("all"); }}
              tHistCustomFrom={tHistCustomFrom} tHistCustomTo={tHistCustomTo}
              onFilterChange={setTHistFilter}
              onCustomFromChange={setTHistCustomFrom}
              onCustomToChange={setTHistCustomTo}
              tHistStatusFilter={tHistStatusFilter}
              onStatusFilterChange={setTHistStatusFilter}
            />
          )}
          {isEmployee && (
            <EmployeeTargetCard user={user} onUpdateAchievement={handleAchievementUpdate} />
          )}
        </div>
      )}

      {/* ── EMPLOYEE ACHIEVEMENTS (ADMIN ONLY) ──────────────────────────── */}
      {activeTab === "achievements" && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <h3 className="text-lg font-semibold" style={{ color: N.ink }}>Real-Time Employee Achievements</h3>
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: N.lavender, color: N.primary }}>
              {achievements.length} achievements
            </span>
          </div>

          {achievements.length === 0 ? (
            <div className="rounded-xl border p-8 text-center" style={{ background: N.surface, borderColor: N.hairline }}>
              <p style={{ color: N.stone }}>No achievements recorded yet. Employees' achievements will appear here in real-time.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: N.surface }}>
                    <tr>
                      {["Employee", "Amount", "Description", "Monthly %", "YTD %", "YTD Total", "Status", "Time"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {achievements.map((ach, idx) => {
                      const statusColor = ach.is_target_completed ? N.green : 
                                        ach.monthly_percentage >= 50 ? N.orange : N.error;
                      const statusLabel = ach.is_target_completed ? "Target Completed ✓" : 
                                        ach.monthly_percentage >= 50 ? "In Progress" : "Started";
                      return (
                        <tr key={`${ach.id}-${idx}`} className="border-t hover:bg-gray-50 transition-colors" style={{ borderColor: N.hairline }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: N.lavender, color: N.primary }}>
                                {ach.employee_name?.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium" style={{ color: N.ink }}>{ach.employee_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: N.green }}>₹{Number(ach.amount).toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: N.slate }}>{ach.description}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold" style={{ color: ach.monthly_percentage >= 100 ? N.green : ach.monthly_percentage >= 50 ? N.orange : N.error }}>
                              {ach.monthly_percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold" style={{ color: ach.yearly_percentage >= 100 ? N.green : ach.yearly_percentage >= 50 ? N.orange : N.error }}>
                              {ach.yearly_percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: N.primary }}>₹{Number(ach.ytd_amount).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: ach.is_target_completed ? N.mint : ach.monthly_percentage >= 50 ? N.peach : "#fde0ec", color: statusColor }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: N.steel }}>
                            {new Date(ach.timestamp).toLocaleTimeString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Achievements", count: achievements.length, bg: N.lavender, color: N.primary },
              { label: "Target Completed", count: achievements.filter(a => a.is_target_completed).length, bg: N.mint, color: N.green },
              { label: "Total YTD Achieved", amount: achievements.reduce((sum, a) => sum + (Number(a.ytd_amount) || 0), 0), bg: N.sky, color: "#0075de" },
              { label: "This Period Added", amount: achievements.reduce((sum, a) => sum + (Number(a.amount) || 0), 0), bg: N.peach, color: N.orange },
            ].map((stat, idx) => (
              <div key={idx} className="rounded-xl p-4 border" style={{ background: stat.bg, borderColor: "transparent" }}>
                <p className="text-xs font-medium" style={{ color: stat.color }}>{stat.label}</p>
                <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>
                  {stat.count !== undefined ? stat.count : `₹${Number(stat.amount).toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};


// ─── HistoryTable sub-component ───────────────────────────────────────────────
const HistoryTable = ({ tasks }) => (
  <div className="rounded-xl border overflow-hidden" style={{ background: "#ffffff", borderColor: "#e5e3df" }}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead style={{ background: "#f6f5f4" }}>
          <tr>
            {["Task", "Assigned To", "Due Date", "Status"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "#787671" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} className="border-t" style={{ borderColor: "#e5e3df" }}>
              <td className="px-4 py-3">
                <div className="font-medium" style={{ color: "#1a1a1a" }}>{task.project_name}</div>
                {task.task_title && <div className="text-xs mt-0.5" style={{ color: "#787671" }}>{task.task_title}</div>}
                {task.task_description && <div className="text-xs mt-1 text-gray-400 line-clamp-2">{task.task_description}</div>}
              </td>
              <td className="px-4 py-3" style={{ color: "#37352f" }}>{task.staff_name || task.assigned_to || "—"}</td>
              <td className="px-4 py-3 text-xs" style={{ color: "#787671" }}>{task.due_date ? new Date(task.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={task.project_status} /></td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: "#a4a097" }}>No records for this filter.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

// ─── EmployeeTargetCard sub-component ────────────────────────────────────────
const EmployeeTargetCard = ({ user, onUpdateAchievement }) => {
  const [myTarget, setMyTarget] = useState(null);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetch = async () => {
    try {
      const userName = user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || user?.email?.split("@")[0] || "";
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/task/targets/my?user_name=${encodeURIComponent(userName)}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setMyTarget((res.data && res.data.id) ? res.data : null);
    } catch { setMyTarget(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) { fetch(); const t = setInterval(fetch, 15000); return () => clearInterval(t); } }, [user]);
  useEffect(() => {
    if (!socket) return;
    socket.on("target_updated", fetch); socket.on("new_target", fetch);
    return () => { socket.off("target_updated", fetch); socket.off("new_target", fetch); };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      const result = await onUpdateAchievement(parseFloat(amount), desc || "Achievement update");
      if (result) {
        setSuccessMsg(`✓ ₹${parseFloat(amount).toLocaleString()} added successfully!`);
        setAmount("");
        setDesc("");
        setTimeout(() => {
          setShowForm(false);
          setSuccessMsg("");
        }, 2000);
        await fetch();
      }
    } catch (err) {
      alert("Failed to add achievement");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8" style={{ color: N.stone }}>Loading…</div>;
  if (!myTarget) return (
    <div className="rounded-xl border p-6 text-center" style={{ background: N.peach, borderColor: N.orange }}>
      <p style={{ color: "#793400" }}>No target set yet. Contact admin.</p>
    </div>
  );

  const monthly = myTarget.monthly_target || 0;
  const achieved = myTarget.achieved_amount || 0;
  const carry = myTarget.carry_forward || 0;
  const effective = parseFloat(myTarget.effective_target) || (monthly + carry);
  const balance = Math.max(0, effective - achieved);
  const pct = effective > 0 ? Math.round((achieved / effective) * 100) : 0;

  // Yearly data
  const yearlyTarget = myTarget.yearly_target || 0;
  const ytdAch = myTarget.ytd_amount || 0;
  const yrBalance = Math.max(0, yearlyTarget - ytdAch);
  const yrPct = yearlyTarget > 0 ? Math.round((ytdAch / yearlyTarget) * 100) : 0;

  // Preview calculations for real-time feedback
  const previewAmount = parseFloat(amount) || 0;
  const previewNewYtd = ytdAch + previewAmount;
  const previewNewBalance = Math.max(0, yearlyTarget - previewNewYtd);
  const previewNewPct = yearlyTarget > 0 ? Math.round((previewNewYtd / yearlyTarget) * 100) : 0;
  const showPreview = amount && previewAmount > 0;

  return (
    <div className="space-y-3">
      {/* Main Target Card - Full Width Responsive Layout */}
      <div className="rounded-xl border p-4 md:p-5 w-full transition-all duration-300" style={{ background: N.canvas, borderColor: N.hairline }}>
        <div className="flex flex-col gap-4">
          {/* Top Row: Target Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: N.lavender }}>
              <TargetIcon size={16} style={{ color: N.primary }} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium" style={{ color: N.steel }}>Yearly Target</p>
              <p className="text-lg md:text-xl font-bold" style={{ color: N.ink }}>₹{yearlyTarget.toLocaleString()}</p>
              <div className="text-[10px] flex gap-2 flex-wrap" style={{ color: N.steel }}>
                <span>Monthly: ₹{monthly.toLocaleString()}</span>
                {carry > 0 && <span style={{ color: N.orange }}>Carry: ₹{carry.toLocaleString()}</span>}
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold cursor-pointer transition-all hover:shadow-md whitespace-nowrap"
              style={{ background: N.primary, color: "#fff" }}>
              {showForm ? "Cancel" : "Add Achievement"}
            </button>
          </div>

          {/* Stats Grid - Responsive */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <div className="rounded-lg p-3 text-center" style={{ background: N.surface }}>
              <p className="text-xs" style={{ color: N.steel }}>YTD Achieved</p>
              <p className="text-lg md:text-xl font-bold mt-1" style={{ color: N.green }}>₹{ytdAch.toLocaleString()}</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: N.surface }}>
              <p className="text-xs" style={{ color: N.steel }}>Balance</p>
              <p className="text-lg md:text-xl font-bold mt-1" style={{ color: yrBalance === 0 ? N.green : N.error }}>₹{yrBalance.toLocaleString()}</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: N.surface }}>
              <p className="text-xs" style={{ color: N.steel }}>This Month</p>
              <p className="text-lg md:text-xl font-bold mt-1" style={{ color: N.primary }}>₹{achieved.toLocaleString()}</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ background: N.surface }}>
              <p className="text-xs" style={{ color: N.steel }}>Progress</p>
              <p className="text-lg md:text-xl font-bold mt-1" style={{ color: yrPct >= 100 ? N.green : yrPct >= 50 ? N.orange : N.error }}>{yrPct}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-xs font-medium" style={{ color: N.steel }}>Yearly Progress</p>
              {showPreview && (
                <p className="text-xs font-semibold" style={{ color: N.primary }}>
                  Preview: {previewNewPct}% ({previewAmount > 0 ? "+" : ""}₹{previewAmount.toLocaleString()})
                </p>
              )}
            </div>
            <div className="w-full rounded-full h-3" style={{ background: N.hairline }}>
              <div className="h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(yrPct, 100)}%`,
                  background: yrPct >= 100 ? N.green : yrPct >= 50 ? N.orange : N.error
                }} />
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Form (Collapsible) - Responsive */}
      {showForm && (
        <div className="rounded-xl border p-4 md:p-6 w-full transition-all duration-300 animate-in fade-in" style={{ background: N.surface, borderColor: N.hairline }}>
          <h4 className="text-sm md:text-base font-semibold mb-4" style={{ color: N.ink }}>Add Achievement</h4>
          
          {successMsg && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium transition-all" style={{ background: N.mint, color: N.green }}>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: N.slate }}>Amount (INR) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 md:py-3 text-sm md:text-base outline-none transition-all"
                  style={{ borderColor: amount ? N.primary : N.hairlineStrong }}
                  placeholder="Enter amount"
                  min="0"
                  required
                  disabled={submitting}
                />
                {showPreview && (
                  <p className="text-xs mt-2" style={{ color: N.primary }}>
                    New Balance: ₹{previewNewBalance.toLocaleString()} (₹{previewNewYtd.toLocaleString()} total YTD)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: N.slate }}>Description</label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  className="w-full border rounded-lg px-4 py-2.5 md:py-3 text-sm md:text-base outline-none transition-all"
                  style={{ borderColor: N.hairlineStrong }}
                  placeholder="e.g. Sale, Contract"
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Real-time Preview Card */}
            {showPreview && (
              <div className="rounded-lg p-4 border-2" style={{ background: N.sky, borderColor: N.primary }}>
                <p className="text-xs font-semibold mb-3" style={{ color: N.primary }}>PREVIEW (After Submission)</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs" style={{ color: N.steel }}>New YTD</p>
                    <p className="text-lg font-bold mt-1" style={{ color: N.primary }}>₹{previewNewYtd.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: N.steel }}>New Balance</p>
                    <p className="text-lg font-bold mt-1" style={{ color: previewNewBalance === 0 ? N.green : N.error }}>₹{previewNewBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: N.steel }}>Progress</p>
                    <p className="text-lg font-bold mt-1" style={{ color: previewNewPct >= 100 ? N.green : N.orange }}>{previewNewPct}%</p>
                  </div>
                </div>
                {previewNewPct >= 100 && (
                  <div className="mt-3 p-2 rounded text-xs font-semibold text-center" style={{ background: N.mint, color: N.green }}>
                    ✓ Target will be ACHIEVED!
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !amount || parseFloat(amount) <= 0}
              className="w-full px-4 py-3 rounded-lg text-sm md:text-base font-semibold text-white cursor-pointer transition-all hover:shadow-md active:scale-95 disabled:opacity-50"
              style={{ background: submitting || !amount || parseFloat(amount) <= 0 ? N.stone : N.green }}>
              {submitting ? "Submitting..." : "Submit Achievement"}
            </button>
          </form>
        </div>
      )}

      {/* Monthly History */}
      {myTarget.history && myTarget.history.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: N.hairline, background: N.surface }}>
            <h4 className="text-xs md:text-sm font-semibold" style={{ color: N.steel }}>Monthly Achievement History</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: N.surfaceSoft }}>
                <tr>
                  {["Month", "Target", "Achieved", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myTarget.history.slice(0, 3).map(h => {
                  const hpct = h.monthly_target > 0 ? Math.round((h.achieved_amount / h.monthly_target) * 100) : 0;
                  return (
                    <tr key={h.month_year} className="border-t hover:bg-gray-50" style={{ borderColor: N.hairline }}>
                      <td className="px-3 py-2" style={{ color: N.charcoal }}>{h.month_year}</td>
                      <td className="px-3 py-2" style={{ color: N.charcoal }}>₹{(parseFloat(h.monthly_target) || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: N.green }}>₹{(parseFloat(h.achieved_amount) || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold inline-block"
                          style={{
                            background: hpct >= 100 ? N.mint : hpct >= 50 ? N.peach : "#fde0ec",
                            color: hpct >= 100 ? N.green : hpct >= 50 ? N.orange : N.error
                          }}>
                          {hpct >= 100 ? "✓ Completed" : hpct >= 50 ? "In Progress" : "Started"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Individual Submissions with Descriptions */}
      {myTarget.submissions && myTarget.submissions.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: N.hairline, background: N.surface }}>
            <h4 className="text-xs md:text-sm font-semibold" style={{ color: N.steel }}>Recent Submissions</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: N.surfaceSoft }}>
                <tr>
                  {["Date", "Month", "Amount", "Description"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myTarget.submissions.slice(0, 10).map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50" style={{ borderColor: N.hairline }}>
                    <td className="px-3 py-2 text-[10px]" style={{ color: N.steel }}>{new Date(s.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="px-3 py-2" style={{ color: N.charcoal }}>{s.month_year}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: s.source === 'auto' ? N.primary : N.green }}>₹{(parseFloat(s.amount) || 0).toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ color: N.slate }}>
                      {s.source === 'auto' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold mr-1" style={{ background: '#ede9fe', color: '#6d28d9' }}>🧾 Quotation</span>
                      )}
                      <span className="max-w-[120px] truncate inline-block" title={s.description}>{s.description || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Admin Target Drill-Down ──────────────────────────────────────────────────
const AdminTargetDrillDown = ({ employeeName, history, tHistFilter, onBack, tHistCustomFrom, tHistCustomTo, onFilterChange, onCustomFromChange, onCustomToChange, tHistStatusFilter, onStatusFilterChange }) => {
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API}/api/task/targets/history?user_name=${encodeURIComponent(employeeName)}&months=12`,
          { headers: { Authorization: `Bearer ${token}` } });
        setSubmissions(res.data?.submissions || []);
      } catch { setSubmissions([]); }
    };
    fetchSubmissions();
  }, [employeeName]);

  const DateFilterBar2 = ({ filter, setFilter, customFrom, setCustomFrom, customTo, setCustomTo, showCustom }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[["all", "All"], ["month", "Month"], ["year", "Year"]].map(([k, l]) => (
        <button key={k} onClick={() => setFilter(k)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${filter === k ? "bg-white shadow" : ""}`}
          style={{ color: filter === k ? N.primary : N.steel }}>
          {l}
        </button>
      ))}
      {showCustom && (
        <div className="flex items-center gap-1 ml-2">
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            className="border-0 outline-none text-xs" style={{ color: N.ink }} />
          <span className="text-xs" style={{ color: N.steel }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            className="border-0 outline-none text-xs" style={{ color: N.ink }} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium cursor-pointer" style={{ color: N.primary }}>
          <ChevronLeft size={16} /> Back
        </button>
        <h3 className="text-base font-semibold" style={{ color: N.ink }}>{employeeName} — Target History</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DateFilterBar2 filter={tHistFilter} setFilter={onFilterChange}
          customFrom={tHistCustomFrom} setCustomFrom={onCustomFromChange}
          customTo={tHistCustomTo} setCustomTo={onCustomToChange} showCustom />
        <div className="ml-auto flex items-center gap-2">
          <select value={tHistStatusFilter} onChange={e => onStatusFilterChange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white" style={{ borderColor: N.hairline, color: N.ink }}>
            <option value="all">All Status</option>
            <option value="Completed">Completed</option>
            <option value="Process">Process</option>
            <option value="New">New</option>
          </select>
        </div>
      </div>

      {/* Monthly Aggregate Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
        <table className="w-full text-sm">
          <thead style={{ background: N.surface }}>
            <tr>
              {["Month", "Target", "Carry Fwd", "Effective", "Achieved", "Balance", "Status"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let filtered = history;
              if (tHistFilter !== "all") filtered = applyDateFilter(filtered, "month_year", tHistFilter, tHistCustomFrom, tHistCustomTo);
              if (tHistStatusFilter !== "all") {
                filtered = filtered.filter(h => {
                  const eff = parseFloat(h.effective_target) || parseFloat(h.monthly_target);
                  const pct = eff > 0 ? Math.round((h.achieved_amount / eff) * 100) : 0;
                  const status = pct >= 100 ? "Completed" : pct >= 50 ? "Process" : "New";
                  return status === tHistStatusFilter;
                });
              }
              return filtered.map(h => {
                const eff = parseFloat(h.effective_target) || parseFloat(h.monthly_target);
                const balance = Math.max(0, eff - h.achieved_amount);
                const pct = eff > 0 ? Math.round((h.achieved_amount / eff) * 100) : 0;
                return (
                  <tr key={h.month_year} className="border-t" style={{ borderColor: N.hairline }}>
                    <td className="px-4 py-3" style={{ color: N.charcoal }}>{h.month_year}</td>
                    <td className="px-4 py-3" style={{ color: N.charcoal }}>₹{(parseFloat(h.monthly_target) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: N.orange }}>₹{(parseFloat(h.carry_forward) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: N.primary }}>₹{eff.toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: N.green }}>₹{(parseFloat(h.achieved_amount) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: balance === 0 ? N.green : N.error }}>₹{balance.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pct >= 100 ? "Completed" : pct >= 50 ? "Process" : "New"} />
                    </td>
                  </tr>
                );
              });
            })()}
            {history.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-sm" style={{ color: N.stone }}>No history records.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Individual Submissions */}
      {submissions.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: N.hairline, background: N.surface }}>
            <h4 className="text-sm font-semibold" style={{ color: N.steel }}>Individual Submissions</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: N.surfaceSoft }}>
                <tr>
                  {["Date", "Month", "Amount", "Description"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <tr key={s.id} className="border-t hover:bg-gray-50" style={{ borderColor: N.hairline }}>
                    <td className="px-4 py-3 text-xs" style={{ color: N.steel }}>{new Date(s.created_at).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3" style={{ color: N.charcoal }}>{s.month_year}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: s.source === 'auto' ? N.primary : N.green }}>₹{(parseFloat(s.amount) || 0).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: N.slate }}>
                      {s.source === 'auto' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1" style={{ background: '#ede9fe', color: '#6d28d9' }}>🧾 Quotation</span>
                      )}
                      <span className="max-w-[200px] truncate inline-block" title={s.description}>{s.description || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Task;
