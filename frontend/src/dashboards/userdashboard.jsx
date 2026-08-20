import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import "../Styles/tailwind.css";
import Followup from "../components/followupsummary";
import Remainder from "../components/remaindersummary";
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
import socket from "../socket/socket";
import { motion } from "framer-motion";
import {
  TrendingUp, Users, Phone, MapPin, IndianRupee,
  FileText, FileSpreadsheet, CreditCard, UserCheck,
  ClipboardList, Target, Shield, Calculator,
  Bell, Clock, CheckCircle, XCircle,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  Activity, Calendar, BarChart3, ChevronRight,
  Building2, MessageSquare, AlertCircle,
  CheckSquare, ListTodo, Briefcase, User
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
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all active:scale-95">
      <span className={`text-[10px] md:text-xs font-bold tracking-wide ${active ? s.text : "text-muted"}`}>{label}</span>
      <span className={`text-white text-xs font-bold px-2 py-0.5 rounded-full ${active ? s.bg : "bg-gray-300"} ${active ? s.ring : "opacity-80"}`}>{count}</span>
      {active && <div className="w-full h-0.5 rounded-full bg-brand-orange mt-0.5"></div>}
    </button>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { info } = useToast();
  const fetching = useRef(false);

  const [leads, setLeads] = useState([]);
  const [walkins, setWalkins] = useState([]);
  const [fields, setFields] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskActivity, setTaskActivity] = useState([]);
  const [targets, setTargets] = useState([]);
  const [amcContracts, setAmcContracts] = useState([]);
  const [callReports, setCallReports] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [performaInvoices, setPerformaInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(new Date());
  const [activeTelecall, setActiveTelecall] = useState("New");
  const [activeWalkin, setActiveWalkin] = useState("New");
  const [activeField, setActiveField] = useState("New");

  const currentUserName = user?.name || user?.email?.split("@")[0] || "User";
  const userDisplayName = user?.name || currentUserName;
  const today = getToday();

  const batchSet = useCallback((data) => {
    setLeads(data[0]); setWalkins(data[1]); setFields(data[2]);
    setQuotations(data[3]); setInvoices(data[4]); setPayments(data[5]);
    setClients(data[6]); setTasks(data[7]); setTaskActivity(data[8]);
    setTargets(data[9]); setAmcContracts(data[10]); setCallReports(data[11]);
    setContracts(data[12]); setEstimates(data[13]); setPerformaInvoices(data[14]);
  }, []);

  const fetchAll = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    setLoading(true);
    const urls = [`${API_BACKEND}/api/Telecalls`, `${API_BACKEND}/api/Walkins`, `${API_BACKEND}/api/Fields`,
    `${API_BACKEND}/api/quotations`, `${API_BACKEND}/api/invoice`, `${API_BACKEND}/api/payments`,
    `${API_BACKEND}/api/client`, `${API_BACKEND}/api/task`, `${API_BACKEND}/api/task/activity`,
    `${API_BACKEND}/api/targets`, `${API_BACKEND}/api/amc`, `${API_BACKEND}/api/call-reports`,
    `${API_BACKEND}/api/contract`, `${API_BACKEND}/api/estimate`, `${API_BACKEND}/api/performainvoice`];
    try {
      const res = await Promise.all(urls.map(u => axios.get(u).catch(() => null)));
      const d = res.map(r => r && r.data ? r.data : []);
      batchSet(d);
    } catch (_) {
      try {
        const fb = urls.map(u => u.replace(API_BACKEND, ""));
        const res = await Promise.all(fb.map(u => axios.get(u).catch(() => null)));
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

  const ttd = useMemo(() => leads.filter(l => normalizeDate(l.call_date) === today), [leads, today]);
  const twd = useMemo(() => walkins.filter(w => normalizeDate(w.walkin_date) === today), [walkins, today]);
  const tfd = useMemo(() => fields.filter(f => normalizeDate(f.visit_date) === today), [fields, today]);

  const telecallToday = departmentCount(ttd, "call_outcome");
  const walkinToday = departmentCount(twd, "walkin_status");
  const fieldToday = departmentCount(tfd, "field_outcome");

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

  const totalLeads = leads.length + walkins.length + fields.length;
  const todaysLeads = ttd.length + twd.length + tfd.length;

  const totalQuotations = quotations.length;
  const totalQuotationValue = useMemo(() => quotations.reduce((s, q) => s + (Number(q.grand_total) || 0), 0), [quotations]);

  const totalPayments = payments.length;
  const totalPaymentAmount = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);

  const totalClients = clients.length;
  const myClients = useMemo(() => clients.filter(c => c.created_by === user?.id).length, [clients, user?.id]);

  const totalTasksCount = tasks.length;
  const completedTasks = useMemo(() => tasks.filter(t => t.project_status === "Completed").length, [tasks]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.project_status === "Process").length, [tasks]);
  const taskCompletionRate = useMemo(() => totalTasksCount > 0 ? ((completedTasks / totalTasksCount) * 100).toFixed(1) : 0, [totalTasksCount, completedTasks]);

  const totalAmcContracts = amcContracts.length;
  const activeAmcContracts = useMemo(() => amcContracts.filter(a => a.status === "Active").length, [amcContracts]);

  const totalCallReports = callReports.length;
  const todaysCallReports = useMemo(() => callReports.filter(c => normalizeDate(c.call_date) === today).length, [callReports, today]);

  const totalEstimates = estimates.length;
  const totalEstimateValue = useMemo(() => estimates.reduce((s, e) => s + (Number(e.grand_total) || 0), 0), [estimates]);

  const totalPerformaInvoices = performaInvoices.length;
  const todaysPerformaSales = useMemo(() => performaInvoices.filter(p => normalizeDate(p.invoice_date) === today).reduce((s, p) => s + (Number(p.grand_total) || 0), 0), [performaInvoices, today]);

  if (loading) {
    return (
      <div className="w-full bg-surface p-4 lead-summary-main flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted mt-6 text-sm font-medium">Loading your data...</p>
          <div className="flex items-center justify-center gap-2 mt-3"><LiveDot /><span className="text-xs text-green-500 font-medium">Real-time connection</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-surface">
      <div className="max-w-6xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6">

        {/* Welcome Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="card p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink flex items-center gap-2">
              Welcome back, <span className="text-primary">{userDisplayName}</span>
            </h1>
            <p className="text-muted text-sm mt-1 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Your Personal Dashboard &mdash; Live Data
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => navigate("/dashboard/telecalling")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-purple-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"><Phone className="w-4 h-4" /><span className="hidden sm:inline">New Call</span></button>
            <button onClick={() => navigate("/dashboard/field")} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"><MapPin className="w-4 h-4" /><span className="hidden sm:inline">Field Visit</span></button>
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-hairline"><LiveDot /><span className="text-xs text-green-500 font-semibold">LIVE</span></div>
          </div>
          <div className="flex md:hidden items-center justify-between w-full">
            <div className="flex items-center gap-2"><LiveDot /><span className="text-xs text-green-500 font-semibold">LIVE</span></div>
            <span className="text-xs text-muted">{lastFetch.toLocaleTimeString()}</span>
          </div>
        </motion.div>

        {/* Personal KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { icon: IndianRupee, title: "My Sales Today", value: todaysPerformaSales, sub: `₹${todaysPerformaSales.toLocaleString("en-IN")}`, color: "bg-gradient-to-br from-emerald-500 to-emerald-600", onClick: () => navigate("/dashboard/performainvoice") },
            { icon: FileText, title: "My Quotations", value: totalQuotations, sub: `₹${(totalQuotationValue / 1000).toFixed(1)}K total`, color: "bg-gradient-to-br from-violet-500 to-violet-600", onClick: () => navigate("/dashboard/quotation") },
            { icon: ClipboardList, title: "My Tasks", value: `${completedTasks}/${totalTasksCount}`, sub: `${taskCompletionRate}% completed`, color: "bg-gradient-to-br from-rose-500 to-rose-600", onClick: () => navigate("/dashboard/task") },
            { icon: UserCheck, title: "My Clients", value: myClients, sub: `${totalClients} total clients`, color: "bg-gradient-to-br from-indigo-500 to-indigo-600", onClick: () => navigate("/dashboard/clients") },
          ].map(card => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="card p-4 cursor-pointer transition-all duration-200 hover:shadow-level-2 active:scale-[0.97]" onClick={card.onClick}
            >
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${card.color} mb-3`}>
                <card.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <p className="text-xs text-muted font-medium truncate">{card.title}</p>
              <h3 className="text-lg md:text-xl font-bold text-ink mt-1 truncate">
                {card.title.includes("Sales") ? <><AnimatedCounter value={card.value} prefix="₹" /></> :
                  card.title.includes("Tasks") ? card.value :
                    <AnimatedCounter value={card.value} />}
              </h3>
              <p className="text-[10px] md:text-xs text-muted mt-1 truncate">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Today's Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-5">
          <h2 className="text-sm md:text-base font-bold text-ink mb-4 flex items-center gap-2">
            <Activity className="w-4 h-5 text-primary" />
            Today&apos;s Activity
          </h2>
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            <div className="text-center p-3 rounded-xl bg-purple-50">
              <Phone className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-lg md:text-xl font-bold text-purple-600"><AnimatedCounter value={ttd.length} /></p>
              <p className="text-[10px] md:text-xs text-muted">Calls</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-50">
              <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-lg md:text-xl font-bold text-blue-600"><AnimatedCounter value={twd.length} /></p>
              <p className="text-[10px] md:text-xs text-muted">Walk-ins</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50">
              <MapPin className="w-5 h-5 text-amber-500 mx-auto mb-1" />
              <p className="text-lg md:text-xl font-bold text-amber-600"><AnimatedCounter value={tfd.length} /></p>
              <p className="text-[10px] md:text-xs text-muted">Field Visits</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted border-t border-hairline pt-3">
            <LiveDot /><span>{totalLeads} total leads &middot; {todaysLeads} active today</span>
          </div>
        </motion.div>

        {/* Lead Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Telecalling Summary", data: telecallToday, active: activeTelecall, setActive: setActiveTelecall },
            { title: "Walk-in Summary", data: walkinToday, active: activeWalkin, setActive: setActiveWalkin },
            { title: "Field Work Summary", data: fieldToday, active: activeField, setActive: setActiveField },
          ].map(section => (
            <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
              <h3 className="text-sm font-bold text-ink mb-3 text-center">{section.title}</h3>
              <div className="flex justify-center gap-2 md:gap-4 mb-3">
                {["New", "Converted", "Disqualified"].map(s => (
                  <StatusBadge key={s} count={section.data[s] || 0} label={s} status={s} active={section.active === s} onClick={() => section.setActive(s)} />
                ))}
              </div>
              <div className="border-t border-hairline pt-2 flex items-center justify-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${st(section.active).bg}`}></div>
                <p className="text-xs font-semibold text-ink">{bottomText(section.data[section.active] || 0, section.active)}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Remainder & Followup
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 md:p-5"><Remainder data={remainderSummary} notes={remainderNotes} /></div>
          <div className="card p-4 md:p-5"><Followup data={followupSummary} notes={followupNotes} /></div>
        </div> */}

        {/* Secondary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            // { icon: CreditCard, title: "Payments", value: totalPayments, sub: `₹${(totalPaymentAmount / 1000).toFixed(1)}K`, onClick: () => navigate("/dashboard/payments"), color: "bg-gradient-to-br from-teal-500 to-teal-600" },
            { icon: Calculator, title: "Estimates", value: totalEstimates, sub: `₹${(totalEstimateValue / 100000).toFixed(1)}L`, onClick: () => navigate("/dashboard/estimates"), color: "bg-gradient-to-br from-pink-500 to-pink-600" },
            { icon: Shield, title: "AMC Active", value: activeAmcContracts, sub: `${totalAmcContracts} total`, onClick: () => navigate("/dashboard/amc"), color: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
            { icon: Phone, title: "Call Reports", value: todaysCallReports, sub: `${totalCallReports} total`, onClick: () => navigate("/dashboard/call-report"), color: "bg-gradient-to-br from-orange-500 to-orange-600" },
          ].map(card => (
            <motion.div key={card.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="card p-3 md:p-4 cursor-pointer transition-all hover:shadow-level-2 active:scale-[0.97]" onClick={card.onClick}
            >
              <div className="flex items-center gap-2 md:gap-3 mb-2">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted font-medium truncate">{card.title}</p>
                  <h3 className="text-sm md:text-lg font-bold text-ink truncate"><AnimatedCounter value={card.value} /></h3>
                </div>
              </div>
              <p className="text-[10px] md:text-xs text-muted truncate pl-[40px] md:pl-[52px]">{card.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Tasks & Activity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-5">
            <h3 className="text-sm md:text-base font-bold text-ink mb-4 flex items-center gap-2">
              <ListTodo className="w-4 h-5 text-primary" />
              Recent Tasks
              <span className="ml-auto text-xs font-bold text-muted">{completedTasks}/{totalTasksCount} done</span>
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {tasks.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No tasks assigned yet</p>
              ) : tasks.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-hairline hover:bg-surface/50 transition-colors cursor-pointer" onClick={() => navigate("/dashboard/task")}>
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${t.project_status === "Completed" ? "bg-success" : t.project_status === "Process" ? "bg-blue-500" : "bg-orange-500"}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{t.task_title || "Task"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {t.project_name && <span className="text-[10px] text-muted truncate">{t.project_name}</span>}
                      {t.staff_name && <span className="text-[10px] text-muted">· {t.staff_name}</span>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${t.project_priority === "High" || t.project_priority === "Urgent" ? "bg-error/10 text-error" : t.project_priority === "Low" ? "bg-gray-100 text-muted" : "bg-blue-100 text-blue-600"}`}>{t.project_priority || "Normal"}</span>
                </div>
              ))}
            </div>
            {tasks.length > 8 && (
              <button onClick={() => navigate("/dashboard/task")} className="mt-3 text-xs font-semibold text-primary flex items-center gap-1 hover:underline">View all tasks <ChevronRight className="w-3 h-3" /></button>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-4 md:p-5">
            <h3 className="text-sm md:text-base font-bold text-ink mb-4 flex items-center gap-2">
              <Activity className="w-4 h-5 text-primary" />
              Latest Activity
            </h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
              {taskActivity.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No recent activity</p>
              ) : taskActivity.slice(0, 10).map(a => (
                <div key={a.id} className="flex gap-3 p-3 rounded-lg hover:bg-surface/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted mb-1"><span className="text-primary font-semibold">Activity</span> {new Date(a.created_at).toLocaleString()}</p>
                    <p className="text-sm text-ink">{a.message}</p>
                    {a.action && (
                      <div className="mt-1.5 bg-surface rounded-lg px-3 py-1.5 text-xs inline-block">
                        <span className="font-semibold text-muted">Action: </span><span className="text-ink">{a.action}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="text-center text-[10px] text-muted py-2">
          <RefreshCw className="w-3 h-3 inline mr-1" />
          Auto-refreshes every 20s &middot; Last: {lastFetch.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
