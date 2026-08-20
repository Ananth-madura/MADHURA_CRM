import React, { useState, useEffect, useMemo } from "react";
import "../Styles/tailwind.css";
import axios from "axios";
import { normalizeDate, getToday } from "../utils/leadutil";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area
} from "recharts";
import {
  Calendar, Filter, RefreshCw, Search, TrendingUp, Users, Briefcase, Award,
  CheckSquare, ShieldAlert, X, Phone, UserCheck, Activity, Clock, CheckCircle2,
  AlertCircle, MapPin, Download, DollarSign, Wrench, FileText, ArrowUpRight,
  ChevronDown, Layers, Sparkles, PieChart as PieIcon, BarChart3, ArrowDownRight,
  Truck, ShieldCheck
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";

const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#EF4444", "#14B8A6"];

// CSV Export Utility
const exportToCsv = (filename, headers, rows) => {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }
  const csvContent = [
    headers.join(","),
    ...rows.map(row =>
      headers
        .map(header => {
          const val = row[header] ?? "";
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'financials' | 'services' | 'byEmployee' | 'userDashboard'
  const [teamMembers, setTeamMembers] = useState([]);
  const [sortBy, setSortBy] = useState("leads");
  const [filter, setFilter] = useState("month");
  const [viewMode, setViewMode] = useState("grid");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [overview, setOverview] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [breakdownData, setBreakdownData] = useState([]);
  const [financials, setFinancials] = useState(null);
  const [servicesSummary, setServicesSummary] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [udSearch, setUdSearch] = useState("");
  const [udSort, setUdSort] = useState("todayLeads");
  const [udSelected, setUdSelected] = useState(null);

  const today = getToday();
  const isAdmin = user?.role === "admin" || user?.role === "subadmin";

  const fetchMainReports = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const queryParams = `?filter=${filter}${customFromDate ? `&from=${customFromDate}` : ""}${customToDate ? `&to=${customToDate}` : ""}${searchTerm ? `&customer=${encodeURIComponent(searchTerm)}` : ""}`;
    const trendsType = filter === "day" || filter === "week" ? "daily" : filter === "year" ? "yearly" : "monthly";

    try {
      const [teamRes, ovRes, empRes, mtRes, bdRes, finRes, srvRes] = await Promise.all([
        axios.get(`${API}/api/teammember`, config).catch(() => ({ data: [] })),
        axios.get(`${API}/api/reports/overview${queryParams}`, config).catch(() => ({ data: null })),
        axios.get(`${API}/api/reports/employee-comparison${queryParams}`, config).catch(() => ({ data: [] })),
        axios.get(`${API}/api/reports/trends?type=${trendsType}${queryParams}`, config).catch(() => ({ data: [] })),
        axios.get(`${API}/api/reports/breakdown${queryParams}`, config).catch(() => ({ data: [] })),
        axios.get(`${API}/api/reports/financials-summary${queryParams}`, config).catch(() => ({ data: null })),
        axios.get(`${API}/api/reports/services-summary${queryParams}`, config).catch(() => ({ data: null })),
      ]);

      setTeamMembers(teamRes.data || []);
      setOverview(ovRes.data);
      setEmployeeData(empRes.data || []);
      setMonthlyTrends(mtRes.data || []);
      setBreakdownData(bdRes.data || []);
      if (finRes.data) setFinancials(finRes.data);
      if (srvRes.data) setServicesSummary(srvRes.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMainReports();
  }, [filter, customFromDate, customToDate, searchTerm]);

  // Fetch user activity dashboard (admin only)
  const fetchUserActivity = async () => {
    if (!isAdmin) return;
    setActivityLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await axios.get(`${API}/api/reports/user-activity`, { headers: { Authorization: `Bearer ${token}` } });
      setUserActivity(res.data || []);
    } catch (e) {
      console.error("user-activity fetch error", e);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "userDashboard") fetchUserActivity();
  }, [activeTab]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setShowCustomDate(false);
    setCustomFromDate("");
    setCustomToDate("");
  };

  const handleCustomDateApply = () => {
    if (customFromDate && customToDate) {
      setShowCustomDate(false);
    }
  };

  const getDateRangeLabel = () => {
    if (showCustomDate && customFromDate && customToDate) {
      return `${customFromDate} to ${customToDate}`;
    }
    if (filter === "day") return "Today";
    if (filter === "week") return "Last 7 Days";
    if (filter === "month") return "This Month";
    if (filter === "year") return "This Year";
    return "This Month";
  };

  const overviewData = useMemo(() => {
    if (!overview) {
      return {
        totalSales: 0,
        salesCount: 0,
        totalQuotations: 0,
        quotationsCount: 0,
        wonQuotationsTotal: 0,
        wonQuotationsCount: 0,
        totalContracts: 0,
        contractsCount: 0,
        totalLeads: 0,
        totalCalls: 0,
        totalWalkins: 0,
        totalFields: 0,
        convertedLeads: 0,
        conversionRate: 0,
        totalClients: 0,
        totalServices: 0,
        servicesClosed: 0,
        servicesPending: 0,
        totalExpenses: 0,
        petrolExpenses: 0,
        sparePartsExpenses: 0,
        labourExpenses: 0,
        totalCollected: 0,
        totalRevenue: 0,
        netProfit: 0,
      };
    }
    return {
      ...overview,
      totalWalkins: overview.totalWalkins || overview.totalwalkins || 0,
    };
  }, [overview]);

  const leadSourceData = useMemo(() => [
    { name: "Telecalling", value: overviewData.totalCalls, color: "#3B82F6" },
    { name: "Walkins", value: overviewData.totalWalkins, color: "#10B981" },
    { name: "Field Work", value: overviewData.totalFields, color: "#8B5CF6" },
  ], [overviewData]);

  const leadConversionData = useMemo(() => [
    { name: "Converted", value: overviewData.convertedLeads, color: "#10B981" },
    { name: "In Progress / Follow-Up", value: Math.max(0, overviewData.totalLeads - overviewData.convertedLeads), color: "#F59E0B" },
  ], [overviewData]);

  const serviceStatusData = useMemo(() => [
    { name: "Closed / Resolved", value: overviewData.servicesClosed, color: "#10B981" },
    { name: "Pending / In Progress", value: overviewData.servicesPending, color: "#EF4444" },
  ], [overviewData]);

  /* ── FILTER & SEARCH BAR COMPONENT ────────────────────────────────────────── */
  const FilterBar = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm mb-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { key: "day", label: "Today" },
            { key: "week", label: "Last 7D" },
            { key: "month", label: "This Month" },
            { key: "year", label: "This Year" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === f.key && !showCustomDate
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
            showCustomDate
              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          <Calendar size={13} />
          <span>Custom Range</span>
        </button>

        {showCustomDate && (
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-blue-200 shadow-sm animate-in fade-in duration-150">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-xs font-medium">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleCustomDateApply}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 ml-auto">
        <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Search size={14} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search Customer / Company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none text-xs w-44"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border">
          <Calendar size={13} className="text-blue-600" />
          <span>Period:</span>
          <span className="font-bold text-gray-900">{getDateRangeLabel()}</span>
        </div>
      </div>
    </div>
  );

  /* ── TAB 1: 360° OVERVIEW TAB ─────────────────────────────────────────────── */
  const OverviewTab = () => {
    return (
      <div className="space-y-6">
        <FilterBar />

        {/* Top 5 Executive Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md shadow-blue-500/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-100 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Invoiced Sales</span>
              <FileText size={18} className="opacity-80" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">₹{overviewData.totalSales.toLocaleString()}</p>
              <p className="text-[11px] text-blue-200 mt-1 font-medium">{overviewData.salesCount} Invoices Created</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-violet-700 rounded-2xl p-4 text-white shadow-md shadow-purple-500/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-100 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Quotations Pipeline</span>
              <Briefcase size={18} className="opacity-80" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">₹{overviewData.totalQuotations.toLocaleString()}</p>
              <p className="text-[11px] text-purple-200 mt-1 font-medium">
                {overviewData.quotationsCount} Quotes · {overviewData.wonQuotationsCount} Won (₹{overviewData.wonQuotationsTotal.toLocaleString()})
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-4 text-white shadow-md shadow-emerald-500/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-100 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Leads & Conv</span>
              <Users size={18} className="opacity-80" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">{overviewData.totalLeads}</p>
              <p className="text-[11px] text-emerald-200 mt-1 font-medium">
                {overviewData.convertedLeads} Converted ({overviewData.conversionRate}%)
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-md shadow-orange-500/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-amber-100 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Service Tickets</span>
              <Wrench size={18} className="opacity-80" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">{overviewData.totalServices}</p>
              <p className="text-[11px] text-amber-100 mt-1 font-medium">
                {overviewData.servicesClosed} Closed · {overviewData.servicesPending} In Progress
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-rose-600 to-pink-700 rounded-2xl p-4 text-white shadow-md shadow-rose-500/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-100 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Net Margin / Profit</span>
              <DollarSign size={18} className="opacity-80" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight">₹{overviewData.netProfit.toLocaleString()}</p>
              <p className="text-[11px] text-rose-200 mt-1 font-medium">
                Costs: ₹{overviewData.totalExpenses.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Middle Charts: Timeline Trends & Revenue Area Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Sales, Quotations & Leads Trajectory</h3>
                <p className="text-xs text-gray-500">Timeline performance across active period</p>
              </div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                {filter.toUpperCase()}
              </span>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "Sales" || name === "Quotes" || name === "Revenue" ? `₹${Number(value).toLocaleString()}` : value,
                      name,
                    ]}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} />
                  <Line yAxisId="left" type="monotone" dataKey="Quotes" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="3 3" />
                  <Line yAxisId="right" type="monotone" dataKey="Leads" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800">Service Operations & Cost Distribution</h3>
                <p className="text-xs text-gray-500">Service ticket volume vs field costs</p>
              </div>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                FIELD METRICS
              </span>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip formatter={(value, name) => [name === "Expenses" || name === "Revenue" ? `₹${Number(value).toLocaleString()}` : value, name]} />
                  <Legend />
                  <Area type="monotone" dataKey="Services" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="Expenses" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3 Donut / Distribution Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone size={14} className="text-blue-600" />
              <span>Lead Source Channels</span>
            </h4>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadSourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                    {leadSourceData.map((entry, index) => (
                      <Cell key={`src-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2 border-t pt-3">
              <div>
                <div className="font-bold text-blue-600">{overviewData.totalCalls}</div>
                <div className="text-[10px] text-gray-500">Telecalls</div>
              </div>
              <div>
                <div className="font-bold text-emerald-600">{overviewData.totalWalkins}</div>
                <div className="text-[10px] text-gray-500">Walkins</div>
              </div>
              <div>
                <div className="font-bold text-purple-600">{overviewData.totalFields}</div>
                <div className="text-[10px] text-gray-500">Fields</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Lead Conversion Ratio</span>
            </h4>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={leadConversionData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                    {leadConversionData.map((entry, index) => (
                      <Cell key={`conv-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-between items-center text-xs mt-2 border-t pt-3 px-2">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-bold">Conversion Rate</span>
                <p className="text-base font-black text-emerald-600">{overviewData.conversionRate}%</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Total Clients</span>
                <p className="text-base font-black text-gray-900">{overviewData.totalClients}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench size={14} className="text-amber-600" />
              <span>Service Resolution Status</span>
            </h4>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                    {serviceStatusData.map((entry, index) => (
                      <Cell key={`srv-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs mt-2 border-t pt-3">
              <div>
                <div className="font-bold text-emerald-600">{overviewData.servicesClosed} Closed</div>
                <div className="text-[10px] text-gray-500">Completed</div>
              </div>
              <div>
                <div className="font-bold text-rose-600">{overviewData.servicesPending} Pending</div>
                <div className="text-[10px] text-gray-500">Live / Open</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Period Breakdown Table with CSV Export */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Periodic Business Performance Breakdown</h3>
              <p className="text-xs text-gray-500">Comprehensive tabular ledger for the selected date range</p>
            </div>
            <button
              onClick={() =>
                exportToCsv(
                  "CRM_Performance_Breakdown",
                  ["name", "Sales", "Quotes", "Leads", "Services", "Converted", "Revenue", "Expenses"],
                  breakdownData
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-600 font-bold border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-right">Invoiced Sales (₹)</th>
                  <th className="px-4 py-3 text-right">Quotations (₹)</th>
                  <th className="px-4 py-3 text-right">Leads Count</th>
                  <th className="px-4 py-3 text-right">Services Done</th>
                  <th className="px-4 py-3 text-right">Converted</th>
                  <th className="px-4 py-3 text-right">Expenses (₹)</th>
                  <th className="px-4 py-3 text-right">Net Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {breakdownData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      No records found for the selected period
                    </td>
                  </tr>
                ) : (
                  breakdownData.map((m, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-gray-800">{m.name}</td>
                      <td className="px-4 py-3 text-right text-blue-600 font-bold">₹{(m.Sales || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-purple-600 font-semibold">₹{(m.Quotes || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium">{m.Leads || 0}</td>
                      <td className="px-4 py-3 text-right font-medium">{m.Services || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.Converted > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"}`}>
                          {m.Converted || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-rose-600 font-medium">₹{(m.Expenses || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-black">₹{(m.Revenue || 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ── TAB 2: SALES & FINANCIALS TAB ────────────────────────────────────────── */
  const FinancialsTab = () => {
    const fin = financials || {
      quotations: { totalCount: 0, totalValue: 0, wonCount: 0, wonValue: 0, pendingCount: 0, pendingValue: 0, lostCount: 0, lostValue: 0 },
      invoicing: { count: 0, billedValue: 0, subtotal: 0, tax: 0 },
      contracts: { count: 0, contractsValue: 0 },
      serviceExpenses: { totalExpenses: 0, petrol: 0, spareParts: 0, labour: 0, collected: 0 },
      summary: { totalInflow: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0 },
    };

    return (
      <div className="space-y-6">
        <FilterBar />

        {/* 4 Financial Pillar Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Billed Invoices</span>
              <FileText size={16} className="text-blue-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-blue-700">₹{fin.invoicing.billedValue.toLocaleString()}</p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Subtotal:</span><span className="font-semibold">₹{fin.invoicing.subtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>GST Tax:</span><span className="font-semibold">₹{fin.invoicing.tax.toLocaleString()}</span></div>
                <div className="flex justify-between text-blue-600 font-bold"><span>Total Count:</span><span>{fin.invoicing.count} Invoices</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Quotations Pipeline</span>
              <Briefcase size={16} className="text-purple-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-purple-700">₹{fin.quotations.totalValue.toLocaleString()}</p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between text-emerald-600 font-bold"><span>Won / Converted:</span><span>₹{fin.quotations.wonValue.toLocaleString()} ({fin.quotations.wonCount})</span></div>
                <div className="flex justify-between text-amber-600"><span>In Review:</span><span>₹{fin.quotations.pendingValue.toLocaleString()} ({fin.quotations.pendingCount})</span></div>
                <div className="flex justify-between text-rose-600"><span>Lost:</span><span>₹{fin.quotations.lostValue.toLocaleString()} ({fin.quotations.lostCount})</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>AMC Maintenance Contracts</span>
              <ShieldCheck size={16} className="text-teal-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-teal-700">₹{fin.contracts.contractsValue.toLocaleString()}</p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Active Contracts:</span><span className="font-semibold">{fin.contracts.count}</span></div>
                <div className="flex justify-between text-teal-600 font-bold"><span>Recurring AMC Value:</span><span>₹{fin.contracts.contractsValue.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-gray-500 uppercase">
              <span>Field Service Expenses</span>
              <Truck size={16} className="text-rose-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-rose-700">₹{fin.serviceExpenses.totalExpenses.toLocaleString()}</p>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Petrol / Travel:</span><span className="font-semibold">₹{fin.serviceExpenses.petrol.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Spare Parts:</span><span className="font-semibold">₹{fin.serviceExpenses.spareParts.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Labour Charges:</span><span className="font-semibold">₹{fin.serviceExpenses.labour.toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* P&L Barometer Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                P&L Net Financial Barometer
              </span>
              <h3 className="text-xl font-bold text-white mt-2">Net Operating Revenue & Margins</h3>
              <p className="text-xs text-indigo-200 mt-0.5">Calculated from Billed Invoices + AMC Contracts minus Field Service Operating Costs</p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-400 font-bold uppercase">Total Inflow</p>
                <p className="text-xl font-extrabold text-white">₹{fin.summary.totalInflow.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-400 font-bold uppercase">Total Outflow</p>
                <p className="text-xl font-extrabold text-rose-400">₹{fin.summary.totalExpenses.toLocaleString()}</p>
              </div>
              <div className="text-center bg-white/10 p-3 rounded-2xl border border-white/10">
                <p className="text-xs text-emerald-300 font-bold uppercase">Net Profit Margin</p>
                <p className="text-2xl font-black text-emerald-400">{fin.summary.profitMargin}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── TAB 3: FIELD SERVICES & TICKETS TAB ──────────────────────────────────── */
  const ServicesTab = () => {
    const srv = servicesSummary || { statusBreakdown: [], typeBreakdown: [], technicians: [] };

    return (
      <div className="space-y-6">
        <FilterBar />

        {/* Top Service Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase">Total Field Tickets</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{overviewData.totalServices}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase">Closed / Resolved</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{overviewData.servicesClosed}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase">Pending / In Progress</div>
            <div className="text-2xl font-black text-rose-600 mt-1">{overviewData.servicesPending}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div className="text-xs font-bold text-gray-500 uppercase">Field Expenses (Petrol & Spares)</div>
            <div className="text-2xl font-black text-purple-600 mt-1">₹{overviewData.totalExpenses.toLocaleString()}</div>
          </div>
        </div>

        {/* Technician Leaderboard Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Technician & Service Engineer Leaderboard</h3>
              <p className="text-xs text-gray-500">Service volume, resolution rates, and expenses by technician</p>
            </div>
            <button
              onClick={() =>
                exportToCsv(
                  "Technician_Performance_Report",
                  ["technician_name", "total_tickets", "closed_tickets", "pending_tickets", "collected", "expenses", "petrol", "spare_parts"],
                  srv.technicians
                )
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-gray-600 font-bold border-b">
                <tr>
                  <th className="px-4 py-3 text-left">Technician Name</th>
                  <th className="px-4 py-3 text-right">Total Tickets</th>
                  <th className="px-4 py-3 text-right">Closed</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Resolution Rate</th>
                  <th className="px-4 py-3 text-right">Collected (₹)</th>
                  <th className="px-4 py-3 text-right">Expenses (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {srv.technicians.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No technician call reports found for this period
                    </td>
                  </tr>
                ) : (
                  srv.technicians.map((t, idx) => {
                    const resRate = t.total_tickets > 0 ? Math.round((t.closed_tickets / t.total_tickets) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-bold text-gray-800 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">
                            {t.technician_name[0]}
                          </div>
                          <span>{t.technician_name}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{t.total_tickets}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-bold">{t.closed_tickets}</td>
                        <td className="px-4 py-3 text-right text-rose-600 font-bold">{t.pending_tickets}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${resRate >= 70 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {resRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">₹{Number(t.collected || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-rose-600">₹{Number(t.expenses || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  /* ── TAB 4: EMPLOYEE RANKINGS TAB ─────────────────────────────────────────── */
  const EmployeeTab = () => {
    const filteredEmployeeData = useMemo(() => {
      return employeeData.filter(
        (emp) =>
          emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
          (emp.position || "").toLowerCase().includes(empSearch.toLowerCase())
      );
    }, [employeeData, empSearch]);

    const sortedEmployeeData = useMemo(() => {
      return [...filteredEmployeeData].sort((a, b) => {
        if (sortBy === "leads") return b.totalLeads - a.totalLeads;
        if (sortBy === "revenue") return b.serviceRevenue - a.serviceRevenue;
        if (sortBy === "conversion") return b.conversionRate - a.conversionRate;
        if (sortBy === "services") return b.services - a.services;
        if (sortBy === "tasks") return b.tasksCompleted - a.tasksCompleted;
        return b.totalLeads - a.totalLeads;
      });
    }, [filteredEmployeeData, sortBy]);

    return (
      <div className="space-y-6">
        <FilterBar />

        {/* Action & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Sort By:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              {[
                { key: "leads", label: "🎯 Leads" },
                { key: "revenue", label: "💰 Revenue" },
                { key: "conversion", label: "📈 Conv %" },
                { key: "services", label: "🛠️ Services" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    sortBy === s.key ? "bg-white text-blue-600 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="bg-transparent outline-none text-xs w-36"
              />
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === "grid" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  viewMode === "table" ? "bg-white text-blue-600 shadow-sm" : "text-gray-600"
                }`}
              >
                Table
              </button>
            </div>

            <button
              onClick={() =>
                exportToCsv(
                  "Staff_Performance_Rankings",
                  ["name", "position", "totalLeads", "leadsConverted", "conversionRate", "services", "serviceRevenue", "tasksCompleted"],
                  sortedEmployeeData
                )
              }
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* View Mode: Grid Cards */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedEmployeeData.map((emp, idx) => (
              <div
                key={emp.id}
                onClick={() => setSelectedEmployee(emp)}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
                        {emp.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition line-clamp-1">
                          {emp.name}
                        </h4>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{emp.position}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Rank #{idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Leads</span>
                      <p className="font-extrabold text-blue-600 text-base">{emp.totalLeads}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Converted</span>
                      <p className="font-extrabold text-emerald-600 text-base">{emp.leadsConverted} ({emp.conversionRate}%)</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Services</span>
                      <p className="font-extrabold text-amber-600 text-base">{emp.services} Done</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Generated (₹)</span>
                      <p className="font-extrabold text-purple-700 text-base">₹{emp.serviceRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Tasks: {emp.tasksCompleted}/{emp.tasksAssigned} Done</span>
                  <span className="font-bold text-blue-600 group-hover:underline">View Spotlight →</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-gray-600 font-bold border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Staff Name</th>
                    <th className="px-4 py-3 text-left">Role / Designation</th>
                    <th className="px-4 py-3 text-right">Leads</th>
                    <th className="px-4 py-3 text-right">Converted</th>
                    <th className="px-4 py-3 text-right">Conv %</th>
                    <th className="px-4 py-3 text-right">Services Done</th>
                    <th className="px-4 py-3 text-right">Value Generated (₹)</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedEmployeeData.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-bold text-gray-800">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-500">{emp.position}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{emp.totalLeads}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-bold">{emp.leadsConverted}</td>
                      <td className="px-4 py-3 text-right font-bold">{emp.conversionRate}%</td>
                      <td className="px-4 py-3 text-right text-amber-600 font-bold">{emp.services}</td>
                      <td className="px-4 py-3 text-right font-black text-purple-700">₹{emp.serviceRevenue.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedEmployee(emp)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition"
                        >
                          Spotlight
                        </button>
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

  /* ── TAB 5: REAL-TIME USER DASHBOARD TAB (Admin Only) ────────────────────── */
  const UserDashboardTab = () => {
    const filteredUsers = useMemo(() => {
      return userActivity.filter(
        (u) =>
          u.name.toLowerCase().includes(udSearch.toLowerCase()) ||
          (u.position || "").toLowerCase().includes(udSearch.toLowerCase())
      );
    }, [userActivity, udSearch]);

    const sortedUsers = useMemo(() => {
      return [...filteredUsers].sort((a, b) => {
        if (udSort === "todayLeads") return b.todayLeads - a.todayLeads;
        if (udSort === "monthLeads") return b.monthLeads - a.monthLeads;
        if (udSort === "reports") return b.callReportsToday - a.callReportsToday;
        if (udSort === "active") return (b.isActiveToday ? 1 : 0) - (a.isActiveToday ? 1 : 0);
        return 0;
      });
    }, [filteredUsers, udSort]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Live Team Presence & Daily Activity</h3>
              <p className="text-xs text-gray-500">Real-time daily lead capture, service tickets, and task status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search team member..."
                value={udSearch}
                onChange={(e) => setUdSearch(e.target.value)}
                className="bg-transparent outline-none text-xs w-40"
              />
            </div>

            <button
              onClick={fetchUserActivity}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
            >
              <RefreshCw size={13} className={activityLoading ? "animate-spin" : ""} />
              <span>Refresh Presence</span>
            </button>
          </div>
        </div>

        {activityLoading ? (
          <div className="flex justify-center py-20">
            <RefreshCw className="animate-spin text-blue-600 w-8 h-8" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => setUdSelected(u)}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition cursor-pointer p-5 flex flex-col justify-between ${
                  u.isActiveToday ? "border-emerald-200" : "border-gray-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm text-white ${
                        u.isActiveToday ? "bg-emerald-600 shadow-md shadow-emerald-500/20" : "bg-gray-400"
                      }`}>
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900">{u.name}</h4>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{u.position}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                      u.isActiveToday ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActiveToday ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                      {u.isActiveToday ? "Active Today" : "Inactive"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Today's Leads</span>
                      <p className="font-extrabold text-blue-600 text-base">{u.todayLeads}</p>
                      <span className="text-[10px] text-gray-400 font-medium">
                        📞{u.todayTelecalls} 🚶{u.todayWalkins} 📍{u.todayFields}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold uppercase">This Month</span>
                      <p className="font-extrabold text-purple-600 text-base">{u.monthLeads}</p>
                      <span className="text-[10px] text-emerald-600 font-semibold">{u.monthConverted} converted ({u.conversionRate}%)</span>
                    </div>
                    <div className="pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Service Reports Today</span>
                      <p className="font-extrabold text-amber-600 text-base">{u.callReportsToday}</p>
                    </div>
                    <div className="pt-2 border-t border-gray-200/60">
                      <span className="text-[10px] text-gray-500 font-bold uppercase">Open Tasks</span>
                      <p className="font-extrabold text-rose-600 text-base">{u.tasksTotal}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <Clock size={11} /> {u.lastActivity ? timeAgo(u.lastActivity) : "No activity"}
                  </span>
                  <span className="font-bold text-blue-600 hover:underline">Spotlight →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      {/* Top Header Bar */}
      <div className="p-6 pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <TrendingUp size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-gray-900">CRM Intelligence & Analytics Reports</h1>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                  Live Real Data
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time financial ledgers, lead conversion funnels, service operations, and technician leaderboards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchMainReports}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-600" : ""} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* 5 Main Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2 overflow-x-auto">
          {[
            { key: "overview", label: "📊 360° Overview", icon: BarChart3 },
            { key: "financials", label: "💼 Sales & Financials", icon: DollarSign },
            { key: "services", label: "🛠️ Field Services & Tickets", icon: Wrench },
            { key: "byEmployee", label: "🏆 Employee Rankings", icon: Award },
            ...(isAdmin ? [{ key: "userDashboard", label: "⚡ Real-Time User Dashboard", icon: Activity }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-50"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="px-6">
        {loading ? (
          <div className="flex justify-center py-24">
            <RefreshCw className="animate-spin text-blue-600 w-10 h-10" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "financials" && <FinancialsTab />}
            {activeTab === "services" && <ServicesTab />}
            {activeTab === "byEmployee" && <EmployeeTab />}
            {activeTab === "userDashboard" && isAdmin && <UserDashboardTab />}
          </>
        )}
      </div>

      {/* SPOTLIGHT DETAIL MODAL */}
      {selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedEmployee(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white relative">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 p-1.5 rounded-full"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-lg font-bold text-white border border-white/20">
                  {selectedEmployee.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">{selectedEmployee.name}</h3>
                  <p className="text-xs text-blue-100 font-medium">{selectedEmployee.position}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-blue-500 font-bold uppercase">Total Leads</p>
                  <p className="text-xl font-black text-blue-700 mt-0.5">{selectedEmployee.totalLeads}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Converted</p>
                  <p className="text-xl font-black text-emerald-700 mt-0.5">{selectedEmployee.leadsConverted}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Lead Conversion Rate:</span>
                  <span className="font-bold text-emerald-600">{selectedEmployee.conversionRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Tickets Handled:</span>
                  <span className="font-bold text-gray-900">{selectedEmployee.services}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Value / Revenue Generated:</span>
                  <span className="font-bold text-purple-700">₹{selectedEmployee.serviceRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tasks Completed:</span>
                  <span className="font-bold text-gray-900">{selectedEmployee.tasksCompleted} / {selectedEmployee.tasksAssigned}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedEmployee(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs shadow-md shadow-blue-500/20"
              >
                Close Spotlight
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USER DASHBOARD SPOTLIGHT MODAL */}
      {udSelected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setUdSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 text-white relative">
              <button
                onClick={() => setUdSelected(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 p-1.5 rounded-full"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-lg font-bold text-white border border-white/20">
                  {udSelected.name[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">{udSelected.name}</h3>
                  <p className="text-xs text-indigo-200 font-medium">{udSelected.position}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-blue-500 font-bold uppercase">Today's Leads</p>
                  <p className="text-xl font-black text-blue-700 mt-0.5">{udSelected.todayLeads}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">📞{udSelected.todayTelecalls} 🚶{udSelected.todayWalkins} 📍{udSelected.todayFields}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                  <p className="text-[10px] text-purple-500 font-bold uppercase">Month's Leads</p>
                  <p className="text-xl font-black text-purple-700 mt-0.5">{udSelected.monthLeads}</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">{udSelected.monthConverted} converted ({udSelected.conversionRate}%)</p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Reports Today:</span>
                  <span className="font-bold text-amber-600">{udSelected.callReportsToday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Open Tasks:</span>
                  <span className="font-bold text-rose-600">{udSelected.tasksTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Activity:</span>
                  <span className="font-bold text-gray-800">{udSelected.lastActivity ? timeAgo(udSelected.lastActivity) : "No activity"}</span>
                </div>
              </div>

              <button
                onClick={() => setUdSelected(null)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition text-xs shadow-md shadow-blue-500/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;