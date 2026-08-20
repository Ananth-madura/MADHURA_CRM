import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import "../Styles/tailwind.css";
import Followup from "../components/followupsummary";
import Remainder from "../components/remaindersummary";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  departmentCount,
  bottomText,
  getToday,
  normalizeDate,
  isThisMonth,
} from "../utils/leadutil";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import { DashboardSearchContext, ReminderContext } from "../layout/dashboarlayout";
import socket from "../socket/socket";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, Phone, MapPin, IndianRupee,
  FileText, FileSpreadsheet, CreditCard, UserCheck,
  ClipboardList, Target, Shield, Calculator,
  Bell, AlertTriangle, CheckCircle, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Search, Eye, Activity, Calendar, UserPlus,
  BarChart3, ChevronRight, Building2, Wifi
} from "lucide-react";
import { useToast } from "../components/Toast";

import { API } from "../config/api";

const API_BACKEND = API;

const badgeStyles = {
  New: { text: "text-orange-500", bg: "bg-orange-500", ring: "ring-2 ring-offset-1 ring-orange-500" },
  Converted: { text: "text-green-600", bg: "bg-green-600", ring: "ring-2 ring-offset-1 ring-green-600" },
  Disqualified: { text: "text-red-600", bg: "bg-red-600", ring: "ring-2 ring-offset-1 ring-red-600" },
};

const st = (key) => badgeStyles[key] || { text: "text-muted", bg: "bg-gray-400", ring: "" };

const LiveDot = () => {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn(v => !v), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full rounded-full bg-green-400 ${on ? "opacity-75" : "opacity-0"} transition-opacity`}></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
    </span>
  );
};

const AnimatedCounter = ({ value, prefix = "", decimals = 0 }) => {
  const [display, setDisplay] = useState(Number(value) || 0);
  const ref = useRef(Number(value) || 0);
  useEffect(() => {
    const num = Number(value) || 0;
    const start = ref.current;
    if (Math.abs(num - start) < 0.5) { setDisplay(num); ref.current = num; return; }
    const duration = 350;
    const t0 = performance.now();
    let id;
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      setDisplay(start + (num - start) * p);
      if (p < 1) id = requestAnimationFrame(tick); else ref.current = num;
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <span>{prefix}{typeof display === "number" ? display.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : display}</span>;
};

const StatusBadge = ({ count, label, status, active, onClick }) => {
  const s = st(status);
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all active:scale-95">
      <span className={`text-xs font-bold tracking-wide ${active ? s.text : "text-muted"}`}>{label}</span>
      <span className={`text-white text-xs font-bold px-2.5 py-0.5 rounded-full ${active ? s.bg : "bg-gray-300"} ${active ? s.ring : "opacity-80"}`}>{count}</span>
      {active && <div className="w-full h-0.5 rounded-full bg-brand-orange mt-0.5"></div>}
    </button>
  );
};

const Dashboard = () => {
  const searchQuery = useContext(DashboardSearchContext) || "";
  const { setReminderData, setReminderNotes } = useContext(ReminderContext);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { info } = useToast();
  const fetching = useRef(false);

  const [leads, setLeads] = useState([]);
  const [walkins, setWalkins] = useState([]);
  const [fields, setFields] = useState([]);
  const [team, setTeam] = useState([]);
  const [performaInvoices, setPerformaInvoices] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [showEscalations, setShowEscalations] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [targets, setTargets] = useState([]);
  const [amcContracts, setAmcContracts] = useState([]);
  const [services, setServices] = useState([]);
  const [callReports, setCallReports] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [estimateInvoices, setEstimateInvoices] = useState([]);
  const [serviceEstimations, setServiceEstimations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(new Date());
  const [activeTab1, setActiveTab1] = useState("New");
  const [selectedUser, setSelectedUser] = useState("all");
  const [activeTelecall, setActiveTelecall] = useState("New");
  const [activeWalkin, setActiveWalkin] = useState("New");
  const [activeField, setActiveField] = useState("New");
  const [isStaffExpanded, setIsStaffExpanded] = useState(false);

  const today = getToday();

  const batchSet = useCallback((data) => {
    setLeads(data[0]); setWalkins(data[1]); setFields(data[2]);
    setTeam(data[3]); setPerformaInvoices(data[4]);
    setPendingRegistrations(data[5]); setEscalations(data[6]);
    setQuotations(data[7]); setInvoices(data[8]); setPayments(data[9]);
    setClients(data[10]); setTasks(data[11]); setTargets(data[12]);
    setAmcContracts(data[13]); setServices(data[14]); setCallReports(data[15]);
    setContracts(data[16]); setEstimates(data[17]);
    setEstimateInvoices(data[18]); setServiceEstimations(data[19]);
  }, []);

  const fetchAll = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    const urls = [`${API_BACKEND}/api/Telecalls`, `${API_BACKEND}/api/Walkins`, `${API_BACKEND}/api/Fields`,
    `${API_BACKEND}/api/teammember`, `${API_BACKEND}/api/performainvoice`,
    `${API_BACKEND}/api/auth/pending-users`, `${API_BACKEND}/api/leads/escalations`,
    `${API_BACKEND}/api/quotations`, `${API_BACKEND}/api/invoice`, `${API_BACKEND}/api/payments`,
    `${API_BACKEND}/api/client`, `${API_BACKEND}/api/task`, `${API_BACKEND}/api/targets`,
    `${API_BACKEND}/api/amc`, `${API_BACKEND}/api/services`, `${API_BACKEND}/api/call-reports`,
    `${API_BACKEND}/api/contract`, `${API_BACKEND}/api/estimate`,
    `${API_BACKEND}/api/estimate-invoice`, `${API_BACKEND}/api/service-estimation`];
    const token = localStorage.getItem("token");
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    try {
      const res = await Promise.all(urls.map(u => axios.get(u, config).catch(() => null)));
      const d = res.map(r => r && r.data ? r.data : []);
      batchSet(d);
    } catch (_) {
      try {
        const fallback = urls.map(u => u.replace(API_BACKEND, ""));
        const res = await Promise.all(fallback.map(u => axios.get(u, config).catch(() => null)));
        const d = res.map(r => r && r.data ? r.data : []);
        batchSet(d);
      } catch (__) { }
    }
    setLoading(false);
    setLastFetch(new Date());
    fetching.current = false;
  }, [batchSet]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const fn = () => fetchAll();
    window.addEventListener("refresh-dashboard", fn);
    return () => window.removeEventListener("refresh-dashboard", fn);
  }, [fetchAll]);

  useEffect(() => {
    const fn = (payload) => {
      fetchAll();
      let message = "Dashboard updated with live changes!";
      if (payload && payload.path) {
        const path = payload.path.toLowerCase();
        let action = "Updated";
        if (payload.method === "POST") action = "Created";
        if (payload.method === "DELETE") action = "Deleted";

        if (path.includes("telecall")) {
          message = `Telecalling Lead ${action} Live!`;
        } else if (path.includes("walkin")) {
          message = `Walk-in Lead ${action} Live!`;
        } else if (path.includes("fields") || path.includes("field")) {
          message = `Field Visit Lead ${action} Live!`;
        } else if (path.includes("quotation")) {
          message = `Quotation ${action} Live!`;
        } else if (path.includes("invoice") || path.includes("performainvoice")) {
          message = `Proforma/Invoice ${action} Live!`;
        } else if (path.includes("task")) {
          message = `Task ${action} Live!`;
        } else if (path.includes("amc") || path.includes("contract")) {
          message = `Contract ${action} Live!`;
        }
      }
      info(message);
    };
    socket.on("data_changed", fn);
    return () => socket.off("data_changed", fn);
  }, [fetchAll, info]);

  useEffect(() => {
    const id = setInterval(() => fetchAll(), 20000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const uniqueStaff = useMemo(() => [...new Set([
    ...leads.map(l => l.staff_name).filter(Boolean),
    ...walkins.map(w => w.staff_name).filter(Boolean),
    ...fields.map(f => f.staff_name).filter(Boolean),
    ...team.map(t => t.emp_name || t.first_name).filter(Boolean)
  ])], [leads, walkins, fields, team]);

  const safeMatch = (val, query) => String(val || "").toLowerCase().includes(String(query).toLowerCase());
  const ufl = useMemo(() => selectedUser === "all" ? leads : leads.filter(l => safeMatch(l.staff_name || l.created_by, selectedUser)), [leads, selectedUser]);
  const ufw = useMemo(() => selectedUser === "all" ? walkins : walkins.filter(w => safeMatch(w.staff_name || w.created_by, selectedUser)), [walkins, selectedUser]);
  const uff = useMemo(() => selectedUser === "all" ? fields : fields.filter(f => safeMatch(f.staff_name || f.created_by, selectedUser)), [fields, selectedUser]);

  const ttd = useMemo(() => ufl.filter(l => normalizeDate(l.call_date) === today), [ufl, today]);
  const twd = useMemo(() => ufw.filter(w => normalizeDate(w.walkin_date) === today), [ufw, today]);
  const tfd = useMemo(() => uff.filter(f => normalizeDate(f.visit_date) === today), [uff, today]);

  const telecallToday = departmentCount(ttd, "call_outcome");
  const walkinToday = departmentCount(twd, "walkin_status");
  const fieldToday = departmentCount(tfd, "field_outcome");

  const telecallMonth = useMemo(() => departmentCount(leads.filter(l => isThisMonth(l.call_date)), "call_outcome"), [leads]);
  const walkinMonth = useMemo(() => departmentCount(walkins.filter(w => isThisMonth(w.walkin_date)), "walkin_status"), [walkins]);
  const fieldMonth = useMemo(() => departmentCount(fields.filter(f => isThisMonth(f.visit_date)), "field_outcome"), [fields]);

  const overallMonthly = useMemo(() => ({
    New: telecallMonth.New + walkinMonth.New + fieldMonth.New,
    Converted: telecallMonth.Converted + walkinMonth.Converted + fieldMonth.Converted,
    Disqualified: telecallMonth.Disqualified + walkinMonth.Disqualified + fieldMonth.Disqualified,
  }), [telecallMonth, walkinMonth, fieldMonth]);

  const followupNotes = useMemo(() => ({
    Todays: leads.filter(l => l.followup_required === "Yes" && normalizeDate(l.followup_date) === today && l.followup_notes),
    Due: leads.filter(l => l.followup_required === "Yes" && normalizeDate(l.followup_date) > today && l.followup_notes),
    Overdue: leads.filter(l => l.followup_required === "Yes" && normalizeDate(l.followup_date) < today && l.followup_notes),
  }), [leads, today]);
  const followupSummary = useMemo(() => ({ Todays: followupNotes.Todays.length, Due: followupNotes.Due.length, Overdue: followupNotes.Overdue.length }), [followupNotes]);

  const remainderNotes = useMemo(() => ({
    Todays: leads.filter(l => l.reminder_required === "Yes" && normalizeDate(l.reminder_date) === today && l.reminder_notes),
    Due: leads.filter(l => l.reminder_required === "Yes" && normalizeDate(l.reminder_date) > today && l.reminder_notes),
    Overdue: leads.filter(l => l.reminder_required === "Yes" && normalizeDate(l.reminder_date) < today && l.reminder_notes),
  }), [leads, today]);
  const remainderSummary = useMemo(() => ({ Todays: remainderNotes.Todays.length, Due: remainderNotes.Due.length, Overdue: remainderNotes.Overdue.length }), [remainderNotes]);

  useEffect(() => {
    setReminderData(remainderSummary);
    setReminderNotes(remainderNotes);
  }, [remainderSummary, remainderNotes, setReminderData, setReminderNotes]);

  const todaysSales = useMemo(() => performaInvoices.filter(p => normalizeDate(p.invoice_date) === today).reduce((s, p) => s + (Number(p.grand_total) || 0), 0), [performaInvoices, today]);

  const yesterday = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }, []);

  const yesterdaySales = useMemo(() => performaInvoices.filter(p => normalizeDate(p.invoice_date) === yesterday).reduce((s, p) => s + (Number(p.grand_total) || 0), 0), [performaInvoices, yesterday]);
  const salesChange = useMemo(() => yesterdaySales > 0 ? (((todaysSales - yesterdaySales) / yesterdaySales) * 100).toFixed(1) : todaysSales > 0 ? 100 : 0, [todaysSales, yesterdaySales]);

  const visitorsToday = twd.length;
  const visitorsYesterday = useMemo(() => walkins.filter(w => normalizeDate(w.walkin_date) === yesterday).length, [walkins, yesterday]);
  const visitorsChange = useMemo(() => visitorsYesterday > 0 ? (((visitorsToday - visitorsYesterday) / visitorsYesterday) * 100).toFixed(1) : visitorsToday > 0 ? 100 : 0, [visitorsToday, visitorsYesterday]);

  const callsToday = ttd.length;
  const callsYesterday = useMemo(() => leads.filter(l => normalizeDate(l.call_date) === yesterday).length, [leads, yesterday]);
  const callsChange = useMemo(() => callsYesterday > 0 ? (((callsToday - callsYesterday) / callsYesterday) * 100).toFixed(1) : callsToday > 0 ? 100 : 0, [callsToday, callsYesterday]);

  const fieldToday2 = tfd.length;
  const fieldYesterday = useMemo(() => fields.filter(f => normalizeDate(f.visit_date) === yesterday).length, [fields, yesterday]);
  const fieldChange = useMemo(() => fieldYesterday > 0 ? (((fieldToday2 - fieldYesterday) / fieldYesterday) * 100).toFixed(1) : fieldToday2 > 0 ? 100 : 0, [fieldToday2, fieldYesterday]);

  const monthNames = useMemo(() => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], []);
  const currentYear = new Date().getFullYear();
  const revenueByMonth = useMemo(() => monthNames.map((month, idx) => {
    const profit = performaInvoices.filter(p => {
      const d = new Date(p.invoice_date);
      return d.getFullYear() === currentYear && d.getMonth() === idx;
    }).reduce((s, p) => s + (Number(p.grand_total) || 0), 0);
    return { month, profit, loss: Math.round(profit * 0.75) };
  }), [performaInvoices, monthNames, currentYear]);

  const monthlyRevenue = useMemo(() => performaInvoices.filter(p => isThisMonth(p.invoice_date)).reduce((s, p) => s + (Number(p.grand_total) || 0), 0), [performaInvoices]);

  const totalQuotations = quotations.length;
  const todaysQuotations = useMemo(() => quotations.filter(q => normalizeDate(q.quotation_date) === today).length, [quotations, today]);
  const totalQuotationValue = useMemo(() => quotations.reduce((s, q) => s + (Number(q.grand_total) || 0), 0), [quotations]);

  const totalInvoices = invoices.length;
  const totalInvoiceValue = useMemo(() => invoices.reduce((s, i) => s + (Number(i.grand_total) || 0), 0), [invoices]);
  const todaysInvoices = useMemo(() => invoices.filter(i => normalizeDate(i.invoice_date) === today).length, [invoices, today]);

  const totalPayments = payments.length;
  const totalPaymentAmount = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const todaysPayments = useMemo(() => payments.filter(p => normalizeDate(p.payment_date) === today).length, [payments, today]);
  const todaysPaymentAmount = useMemo(() => payments.filter(p => normalizeDate(p.payment_date) === today).reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments, today]);

  const totalClients = clients.length;
  const newClientsThisMonth = useMemo(() => clients.filter(c => isThisMonth(c.created_at)).length, [clients]);

  const totalTasks = tasks.length;
  const completedTasks = useMemo(() => tasks.filter(t => t.project_status === "Completed").length, [tasks]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.project_status === "Process").length, [tasks]);
  const taskCompletionRate = useMemo(() => totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0, [totalTasks, completedTasks]);

  const totalTargets = targets.length;
  const achievedTargets = useMemo(() => targets.filter(t => (Number(t.achieved_amount) || 0) >= (Number(t.monthly_target) || 0)).length, [targets]);

  const totalMonthlyTargetSum = useMemo(() => targets.reduce((s, t) => s + (Number(t.monthly_target) || 0), 0), [targets]);
  const totalAchievedTargetSum = useMemo(() => targets.reduce((s, t) => s + (Number(t.achieved_amount) || 0), 0), [targets]);
  const targetAchievementPercentage = useMemo(() => totalMonthlyTargetSum > 0 ? Math.min(100, Math.round((totalAchievedTargetSum / totalMonthlyTargetSum) * 100)) : 0, [totalAchievedTargetSum, totalMonthlyTargetSum]);

  const leadSourceData = useMemo(() => [
    { name: "Telecalling", value: leads.length, color: "#a855f7" },
    { name: "Walk-ins", value: walkins.length, color: "#3b82f6" },
    { name: "Field Visits", value: fields.length, color: "#eab308" }
  ], [leads.length, walkins.length, fields.length]);

  const totalAmcContracts = amcContracts.length;
  const activeAmcContracts = useMemo(() => amcContracts.filter(a => a.status === "Active").length, [amcContracts]);

  const totalEstimates = estimates.length;
  const totalEstimateValue = useMemo(() => estimates.reduce((s, e) => s + (Number(e.grand_total) || 0), 0), [estimates]);

  const totalCallReports = callReports.length;
  const todaysCallReports = useMemo(() => callReports.filter(c => normalizeDate(c.call_date) === today).length, [callReports, today]);

  const q = searchQuery.toLowerCase().trim();
  const anyMatch = q && ["Lead Summary", "Telecalling Summary", "Walkin Summary", "Fieldwork Summary", "Remainder Summary", "Followup Summary", "Total Sales", "Visitors", "Total Calls", "Field Work", "Revenue", "Team Summary"].some(l => l.toLowerCase().includes(q));
  const dim = (key, labels) => anyMatch && !labels.some(l => l.toLowerCase().includes(q)) ? "opacity-30 pointer-events-none" : "";

  const StatCard = ({ icon: Icon, title, value, change, sub, positive, color, labels, onClick }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`card p-4 md:p-5 cursor-pointer transition-all duration-200 hover:shadow-level-2 active:scale-[0.98] ${dim("stat", labels || [title])}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold ${positive ? "text-success" : "text-error"}`}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {typeof change === "number" ? `${change >= 0 ? "+" : ""}${change}%` : change}
        </span>
      </div>
      <p className="text-xs md:text-sm text-muted font-medium truncate">{title}</p>
      <h3 className="text-lg md:text-2xl font-bold text-ink mt-1 truncate">
        <AnimatedCounter value={value} prefix={title.includes("₹") || title.toLowerCase().includes("sales") ? "₹" : ""} />
      </h3>
      <p className="text-xs text-muted mt-1 truncate">{sub}</p>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="w-full p-4 md:p-8 bg-surface flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted mt-6 text-sm font-medium">Loading live data...</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <LiveDot />
            <span className="text-xs text-green-500 font-medium">Real-time connection</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">

        {/* Welcome Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink flex items-center gap-2">
              Welcome back, <span className="text-primary">{user?.name || "Admin"}</span>
            </h1>
            <p className="text-muted text-sm mt-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Admin Dashboard &mdash; Live Data
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <button onClick={() => navigate("/dashboard/team")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"><UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Add User</span></button>
            <button onClick={() => navigate("/dashboard/quotation")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-orange text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"><FileText className="w-4 h-4" /><span className="hidden sm:inline">Quotation</span></button>
            <button onClick={() => navigate("/dashboard/clients")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand-teal text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"><Building2 className="w-4 h-4" /><span className="hidden sm:inline">Client</span></button>
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-hairline">
              <LiveDot />
              <span className="text-xs text-green-500 font-semibold">LIVE</span>
              <span className="text-xs text-muted">{lastFetch.toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-2"><LiveDot /><span className="text-xs text-green-500 font-semibold">LIVE</span></div>
            <span className="text-xs text-muted">{lastFetch.toLocaleTimeString()}</span>
          </div>
        </motion.div>

        {/* Staff Filter */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <Users className="w-4 h-4 text-muted" />
            <span className="text-xs font-semibold text-muted">Staff:</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedUser("all")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedUser === "all" ? "bg-primary text-white shadow-sm" : "bg-surface text-muted hover:bg-hairline"}`}>All</button>
              {uniqueStaff.slice(0, 8).map(name => (
                <button key={name} onClick={() => setSelectedUser(name)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${selectedUser === name ? "bg-primary text-white shadow-sm" : "bg-surface text-muted hover:bg-hairline"}`}>{name}</button>
              ))}
              {isStaffExpanded ? (
                <>
                  {uniqueStaff.slice(8).map(name => (
                    <button key={name} onClick={() => setSelectedUser(name)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${selectedUser === name ? "bg-primary text-white shadow-sm" : "bg-surface text-muted hover:bg-hairline"}`}>{name}</button>
                  ))}
                  <button onClick={() => setIsStaffExpanded(false)} className="text-xs text-primary hover:text-primary-dark font-semibold bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-all self-center cursor-pointer whitespace-nowrap ml-1">Show Less</button>
                </>
              ) : (
                uniqueStaff.length > 8 && (
                  <button onClick={() => setIsStaffExpanded(true)} className="text-xs text-primary hover:text-primary-dark font-semibold bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-all self-center cursor-pointer whitespace-nowrap ml-1">
                    +{uniqueStaff.length - 8}
                  </button>
                )
              )}
            </div>
          </div>
        </motion.div>

        {/* Search Results */}
        {searchQuery && searchQuery.trim() !== "" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4 border-l-4 border-l-primary">
            <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2"><Search className="w-4 h-4" /> Results for &quot;{searchQuery}&quot;</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Clients", data: clients, filter: c => (c.first_name || c.client_company || c.mobile || c.email || c.customer_name || "").toString().toLowerCase().includes(q), nav: "/dashboard/clients", display: c => c.first_name || c.client_company, sub: c => c.mobile || c.email },
                { label: "Quotations", data: quotations, filter: qt => (qt.customer_name || qt.quotation_id || qt.invoice_id || "").toString().toLowerCase().includes(q), nav: "/dashboard/quotation", display: qt => qt.customer_name || "#" + qt.id, sub: qt => qt.quotation_date ? new Date(qt.quotation_date).toLocaleDateString() : '' },
                { label: "Leads", data: leads, filter: ld => (ld.customer_name || ld.company_name || ld.mobile_number || ld.staff_name || "").toString().toLowerCase().includes(q), nav: "/dashboard/telecalling", display: ld => ld.customer_name || ld.mobile_number, sub: ld => ld.staff_name },
              ].map(section => (
                <div key={section.label}>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">{section.label}</div>
                  {section.data.filter(section.filter).slice(0, 5).map((item, i) => (
                    <div key={item.id || i} onClick={() => navigate(section.nav)} className="text-sm py-1.5 px-2 rounded-lg border-b border-hairline last:border-0 cursor-pointer hover:bg-surface flex items-center justify-between">
                      <span className="text-ink font-medium truncate">{section.display(item)}</span>
                      <span className="text-xs text-muted shrink-0">{section.sub(item)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pending Approvals */}
        {pendingRegistrations.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-tint-peach p-4 md:p-5 rounded-xl border border-orange-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm md:text-base font-bold text-charcoal flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-orange" />
                Pending Approvals
                <span className="bg-brand-orange text-white text-xs px-2 py-0.5 rounded-full">{pendingRegistrations.length}</span>
              </h2>
              <button onClick={() => navigate("/dashboard/notifications")} className="text-xs text-brand-orange font-bold hover:underline flex items-center gap-1">View All <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {pendingRegistrations.slice(0, 3).map(reg => (
                <div key={reg.id} className="flex items-center justify-between bg-white/60 backdrop-blur rounded-lg p-3 border border-orange-100">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-charcoal truncate">{reg.first_name}</p>
                    <p className="text-xs text-muted truncate">{reg.email}</p>
                    <p className="text-[10px] text-muted">{new Date(reg.created_at).toLocaleDateString("en-IN")}</p>
                  </div>
                  <span className="badge-tag-orange text-xs shrink-0">Pending</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={IndianRupee} title="Today's Sales" value={todaysSales} change={`${salesChange >= 0 ? "+" : ""}${salesChange}%`} sub={`vs yesterday ₹${Math.abs(todaysSales - yesterdaySales).toLocaleString("en-IN")}`} positive={salesChange >= 0} color="bg-gradient-to-br from-emerald-500 to-emerald-600" labels={["Total Sales"]} onClick={() => navigate("/dashboard/performainvoice")} />
          <StatCard icon={Users} title="Visitors Today" value={visitorsToday} change={`${visitorsChange >= 0 ? "+" : ""}${visitorsChange}%`} sub={`${visitorsToday - visitorsYesterday >= 0 ? "+" : ""}${visitorsToday - visitorsYesterday} vs yesterday`} positive={visitorsChange >= 0} color="bg-gradient-to-br from-blue-500 to-blue-600" labels={["Visitors"]} onClick={() => navigate("/dashboard/walkins")} />
          <StatCard icon={Phone} title="Calls Today" value={callsToday} change={`${callsChange >= 0 ? "+" : ""}${callsChange}%`} sub={`${callsToday - callsYesterday >= 0 ? "+" : ""}${callsToday - callsYesterday} vs yesterday`} positive={callsChange >= 0} color="bg-gradient-to-br from-purple-500 to-purple-600" labels={["Total Calls"]} onClick={() => navigate("/dashboard/telecalling")} />
          <StatCard icon={MapPin} title="Field Visits Today" value={fieldToday2} change={`${fieldChange >= 0 ? "+" : ""}${fieldChange}%`} sub={`${fieldToday2 - fieldYesterday >= 0 ? "+" : ""}${fieldToday2 - fieldYesterday} vs yesterday`} positive={fieldChange >= 0} color="bg-gradient-to-br from-amber-500 to-amber-600" labels={["Field Work"]} onClick={() => navigate("/dashboard/field")} />
        </div>

        {/* Lead Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h2 className="text-base md:text-lg font-bold text-ink flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Lead Summary {selectedUser !== "all" && <span className="text-sm text-primary font-medium">&mdash; {selectedUser}</span>}
            </h2>
            <div className="flex items-center gap-2 md:gap-4">
              {["New", "Converted", "Disqualified"].map(item => (
                <StatusBadge key={item} count={overallMonthly[item]} label={item} status={item} active={activeTab1 === item} onClick={() => setActiveTab1(item)} />
              ))}
            </div>
          </div>
          <div className="border-t border-hairline pt-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${st(activeTab1).bg}`}></div>
            <p className="text-sm md:text-base font-semibold text-ink">{bottomText(overallMonthly[activeTab1], activeTab1)}</p>
          </div>
        </motion.div>

        {/* Telecalling / Walkin / Field */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Telecalling Summary", data: telecallToday, active: activeTelecall, setActive: setActiveTelecall },
            { title: "Walk-in Summary", data: walkinToday, active: activeWalkin, setActive: setActiveWalkin },
            { title: "Field Work Summary", data: fieldToday, active: activeField, setActive: setActiveField },
          ].map(section => (
            <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-5">
              <h3 className="text-sm font-bold text-ink mb-4 text-center">{section.title}</h3>
              <div className="flex justify-center gap-3 md:gap-6 mb-4">
                {["New", "Converted", "Disqualified"].map(s => (
                  <StatusBadge key={s} count={section.data[s] || 0} label={s} status={s} active={section.active === s} onClick={() => section.setActive(s)} />
                ))}
              </div>
              <div className="border-t border-hairline pt-3 flex items-center justify-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${st(section.active).bg}`}></div>
                <p className="text-xs font-semibold text-ink">{bottomText(section.data[section.active] || 0, section.active)}</p>
              </div>
            </motion.div>
          ))}
        </div>



        {/* Team Targets Achievement Tracker */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-6 bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-100 shadow-sm rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm md:text-base font-bold text-ink flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600 animate-pulse" />
                Active Sales Target Progress
              </h2>
              <p className="text-xs text-muted mt-1">Real-time tracker of combined team monthly targets vs payments achieved</p>
            </div>
            <div className="text-right">
              <span className="text-lg md:text-2xl font-black text-indigo-700">{targetAchievementPercentage}%</span>
              <span className="text-xs text-muted ml-2">({achievedTargets} of {totalTargets} targets achieved)</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[11px] font-bold text-indigo-600 mb-1">
              <span>₹{totalAchievedTargetSum.toLocaleString("en-IN")} Achieved</span>
              <span>Target: ₹{totalMonthlyTargetSum.toLocaleString("en-IN")}</span>
            </div>
            <div className="w-full h-3 bg-indigo-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${targetAchievementPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Metrics + Revenue Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6">
          <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {[
              { icon: FileText, title: "Quotations", value: totalQuotations, sub: `₹${(totalQuotationValue / 100000).toFixed(1)}L · ${todaysQuotations} today`, onClick: () => navigate("/dashboard/quotation"), color: "bg-gradient-to-br from-violet-500 to-violet-600" },
              // { icon: FileSpreadsheet, title: "Invoices", value: totalInvoices, sub: `₹${(totalInvoiceValue / 100000).toFixed(1)}L · ${todaysInvoices} today`, onClick: () => navigate("/dashboard/invoice"), color: "bg-gradient-to-br from-sky-500 to-sky-600" },
              // { icon: CreditCard, title: "Payments", value: totalPayments, sub: `₹${(todaysPaymentAmount / 1000).toFixed(1)}K today`, onClick: () => navigate("/dashboard/payments"), color: "bg-gradient-to-br from-teal-500 to-teal-600" },
              { icon: UserCheck, title: "Clients", value: totalClients, sub: `${newClientsThisMonth} new this month`, onClick: () => navigate("/dashboard/clients"), color: "bg-gradient-to-br from-indigo-500 to-indigo-600" },
              { icon: ClipboardList, title: "Tasks", value: totalTasks, sub: `${completedTasks} done · ${taskCompletionRate}% rate`, onClick: () => navigate("/dashboard/task"), color: "bg-gradient-to-br from-rose-500 to-rose-600" },
              { icon: Target, title: "Targets", value: totalTargets, sub: `${achievedTargets} achieved · ${totalTargets - achievedTargets} left`, onClick: () => navigate("/dashboard/targets"), color: "bg-gradient-to-br from-cyan-500 to-cyan-600" },
              { icon: Shield, title: "AMC Contracts", value: totalAmcContracts, sub: `${activeAmcContracts} active`, onClick: () => navigate("/dashboard/amc"), color: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
              { icon: Calculator, title: "Estimates", value: totalEstimates, sub: `₹${(totalEstimateValue / 100000).toFixed(1)}L total`, onClick: () => navigate("/dashboard/estimates"), color: "bg-gradient-to-br from-pink-500 to-pink-600" },
              { icon: Phone, title: "Call Reports", value: totalCallReports, sub: `${todaysCallReports} today`, onClick: () => navigate("/dashboard/call-report"), color: "bg-gradient-to-br from-orange-500 to-orange-600" },
            ].map(card => (
              <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="card p-3 md:p-4 cursor-pointer transition-all duration-200 hover:shadow-level-2 hover:-translate-y-0.5 active:scale-[0.97]" onClick={card.onClick}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                    <card.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted font-medium truncate">{card.title}</p>
                    <h3 className="text-base md:text-lg font-bold text-ink truncate"><AnimatedCounter value={card.value} /></h3>
                  </div>
                </div>
                <p className="text-[10px] md:text-xs text-muted truncate pl-[44px]">{card.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="xl:col-span-2">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4 md:p-6 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-ink flex items-center gap-2">
                      <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
                      Sales & Revenue
                    </h2>
                    <p className="text-xl md:text-2xl font-bold text-primary mt-1">
                      <AnimatedCounter value={monthlyRevenue} prefix="₹" />
                      <span className="text-xs text-success font-semibold ml-2">&uarr; Monthly</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span> Profit</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200"></span> Projected</span>
                  </div>
                </div>
                <div className="h-[200px] md:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueByMonth}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e3df" vertical={false} />
                      <XAxis dataKey="month" stroke="#bbb8b1" fontSize={10} tickLine={false} />
                      <YAxis stroke="#bbb8b1" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e3df", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(value) => [`₹${value.toLocaleString("en-IN")}`, undefined]} />
                      <Area type="monotone" dataKey="profit" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" name="Profit" />
                      <Area type="monotone" dataKey="loss" stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={1} fill="url(#projectedGrad)" name="Projected" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Lead Source Breakdown Chart & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="md:col-span-1 card p-4 md:p-6 flex flex-col justify-between min-h-[300px]">
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-indigo-500" />
                Lead Sources
              </h2>
              <p className="text-xs text-muted mb-4">Distribution of total leads by source type</p>
            </div>

            <div className="relative h-[160px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {leadSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} leads`, undefined]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-ink">{leads.length + walkins.length + fields.length}</span>
                <span className="text-[9px] text-muted uppercase font-bold tracking-wide">Total Leads</span>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {leadSourceData.map((src) => {
                const total = leads.length + walkins.length + fields.length;
                const pct = total > 0 ? Math.round((src.value / total) * 100) : 0;
                return (
                  <div key={src.name} className="flex items-center justify-between text-xs border-b border-hairline/30 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: src.color }}></span>
                      <span className="font-semibold text-ink">{src.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{src.value}</span>
                      <span className="font-bold text-primary-text min-w-[28px] text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* <div className="md:col-span-2 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 md:p-5"><Remainder data={remainderSummary} notes={remainderNotes} /></div>
              <div className="card p-4 md:p-5"><Followup data={followupSummary} notes={followupNotes} /></div>
            </div>
          </div> */}
        </div>

        {/* Team Summary */}
        {/* 
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-6">
          <h2 className="text-base md:text-lg font-bold text-ink mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Member Summary
          </h2>
          <div className="overflow-x-auto -mx-4 md:-mx-6">
            <div className="inline-block min-w-full align-middle px-4 md:px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="py-3 text-left text-xs font-bold text-muted uppercase tracking-wider">Member</th>
                    <th className="py-3 text-center text-xs font-bold text-muted uppercase tracking-wider">Quotations</th>
                    <th className="py-3 text-right text-xs font-bold text-muted uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {team.length === 0 ? (
                    <tr><td colSpan="3" className="py-10 text-center text-muted italic">No team data available</td></tr>
                  ) : team.slice(0, 10).map((t, idx) => (
                    <tr key={idx} className="border-b border-hairline-soft hover:bg-surface/50 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{(t.first_name || "U")[0].toUpperCase()}</div>
                          <span className="font-semibold text-ink text-sm">{t.first_name} {t.last_name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{t.quotation_count || 0}</span>
                      </td>
                      <td className="py-3 text-right">
                        <button onClick={() => navigate("/dashboard/team")} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 ml-auto">View <ChevronRight className="w-3 h-3" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
        */}

        {/* Escalations */}
        {/* 
        {escalations.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-4 md:p-5 border-l-4 border-l-error">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm md:text-base font-bold text-error flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Escalation Alerts
                <span className="bg-error text-white text-xs px-2 py-0.5 rounded-full">{escalations.length}</span>
              </h2>
              <button onClick={() => setShowEscalations(p => !p)} className="text-xs font-bold text-error hover:underline">{showEscalations ? "Hide" : "Show All"}</button>
            </div>
            {showEscalations && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-error/20">
                      <th className="px-2 py-2 text-left text-xs font-bold text-error">Lead</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-error">Mobile</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-error">Staff</th>
                      <th className="px-2 py-2 text-center text-xs font-bold text-error">Missed</th>
                      <th className="px-2 py-2 text-right text-xs font-bold text-error">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escalations.map(esc => (
                      <tr key={esc.id} className="border-b border-error/10 hover:bg-error/5">
                        <td className="px-2 py-2.5 font-semibold text-ink text-sm">{esc.customer_name}</td>
                        <td className="px-2 py-2.5 text-center text-muted text-xs">{esc.mobile_number}</td>
                        <td className="px-2 py-2.5 text-center text-muted text-xs">{esc.staff_name || "---"}</td>
                        <td className="px-2 py-2.5 text-center"><span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">{esc.missed_count}</span></td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={async () => { await axios.put(`${API_BACKEND}/api/leads/escalations/${esc.id}/resolve`); setEscalations(prev => prev.filter(x => x.id !== esc.id)); }} className="text-xs bg-success text-white px-3 py-1.5 rounded-lg font-semibold">Resolve</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
        */}

        <div className="text-center text-[10px] text-muted py-2">
          <RefreshCw className="w-3 h-3 inline mr-1" />
          Auto-refreshes every 20s &middot; Last: {lastFetch.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
