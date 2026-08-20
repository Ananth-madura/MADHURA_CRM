import React, { useState, useEffect, useMemo } from "react";
import "../Styles/tailwind.css";
import axios from "axios";
import { normalizeDate, getToday } from "../utils/leadutil";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend, AreaChart, Area } from "recharts";
import { Calendar, Filter, RefreshCw, Search, TrendingUp, Users, Briefcase, Award, CheckSquare, ShieldAlert, X, Phone, UserCheck, Activity, Clock, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#14B8A6"];
const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

const Reports = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
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
  const [userActivity, setUserActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [udSearch, setUdSearch] = useState("");
  const [udSort, setUdSort] = useState("todayLeads");
  const [udSelected, setUdSelected] = useState(null);

  const today = getToday();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const queryParams = `?filter=${filter}${customFromDate ? `&from=${customFromDate}` : ""}${customToDate ? `&to=${customToDate}` : ""}${searchTerm ? `&customer=${searchTerm}` : ""}`;
      const trendsType = filter === 'day' ? 'daily' : filter === 'week' ? 'daily' : filter === 'year' ? 'yearly' : 'monthly';

      try {
        const [team, ov, emp, mt, bd] = await Promise.all([
          axios.get(`${API}/api/teammember`, config),
          axios.get(`${API}/api/reports/overview${queryParams}`, config),
          axios.get(`${API}/api/reports/employee-comparison${queryParams}`, config),
          axios.get(`${API}/api/reports/trends?type=${trendsType}${queryParams}`, config),
          axios.get(`${API}/api/reports/breakdown${queryParams}`, config),
        ]);

        setTeamMembers(team.data);
        setOverview(ov.data);
        setEmployeeData(emp.data);
        setMonthlyTrends(mt.data);
        setBreakdownData(bd.data);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setLoading(false);
      }
    };
    fetchData();
  }, [filter, customFromDate, customToDate, searchTerm]);

  // Fetch user activity dashboard (admin only)
  const isAdmin = user?.role === "admin" || user?.role === "subadmin";
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

  const getStartDate = () => {
    if (showCustomDate && customFromDate) return customFromDate;
    const d = new Date();
    if (filter === "day") return today;
    if (filter === "week") d.setDate(d.getDate() - 6);
    if (filter === "month") d.setDate(1);
    if (filter === "year") { d.setMonth(0); d.setDate(1); }
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  const getEndDate = () => {
    if (showCustomDate && customToDate) return customToDate;
    return today;
  };

  const startDate = getStartDate();
  const endDate = getEndDate();
  const inRange = (dateStr) => dateStr && normalizeDate(dateStr) >= startDate && normalizeDate(dateStr) <= endDate;

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

  const getBreakdownColumnLabel = () => {
    if (filter === "day") return "Day";
    if (filter === "week") return "Week";
    if (filter === "month") return "Month";
    if (filter === "year") return "Year";
    return "Month";
  };

  const getBreakdownData = () => {
    if (breakdownData.length > 0) return breakdownData;
    return monthlyTrends;
  };

  const overviewData = useMemo(() => {
    if (!overview) return {
      totalSales: 0, totalLeads: 0, totalCalls: 0, totalWalkins: 0, totalFields: 0,
      totalServices: 0, totalRevenue: 0, convertedLeads: 0, totalClients: 0, totalContracts: 0, totalProposals: 0
    };
    return {
      ...overview,
      totalWalkins: overview.totalWalkins || overview.totalwalkins || 0
    };
  }, [overview]);

  const getLeadSourceData = () => [
    { name: "Telecalling", value: overviewData.totalCalls, color: "#3B82F6" },
    { name: "Walkins", value: overviewData.totalWalkins, color: "#10B981" },
    { name: "Field Work", value: overviewData.totalFields, color: "#8B5CF6" },
  ];

  const getConversionData = () => [
    { name: "Converted", value: overviewData.convertedLeads, color: "#10B981" },
    { name: "Not Converted", value: Math.max(0, overviewData.totalLeads - overviewData.convertedLeads), color: "#EF4444" },
  ];

  const getEmployeePerformanceData = () => employeeData.slice(0, 6).map(emp => ({
    name: emp.name.split(" ")[0],
    Leads: emp.totalLeads,
    Revenue: emp.serviceRevenue,
    Conversion: emp.conversionRate,
    Services: emp.services,
  }));

  const OverviewTab = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          {["day", "week", "month", "year"].map(f => (
            <button key={f} onClick={() => handleFilterChange(f)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filter === f && !showCustomDate ? "bg-white shadow text-blue-600" : "text-gray-500"}`}>
              {f === "day" ? "Day" : f === "week" ? "Week" : f === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCustomDate(!showCustomDate)}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${showCustomDate ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
        >
          <Calendar size={16} /> Custom Date
        </button>
        {showCustomDate && (
          <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow border">
            <input
              type="date"
              value={customFromDate}
              onChange={(e) => setCustomFromDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={customToDate}
              onChange={(e) => setCustomToDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
            <button onClick={handleCustomDateApply} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">Apply</button>
          </div>
        )}
        <div className="ml-auto text-sm text-gray-500 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-1.5 shadow-sm">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Filter by Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="outline-none text-sm w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} />
            Showing: <span className="font-semibold text-gray-700">{getDateRangeLabel()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white"><p className="text-blue-100 text-sm">Total Sales</p><p className="text-2xl font-bold">₹{overviewData.totalSales.toLocaleString()}</p></div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white"><p className="text-green-100 text-sm">Total Leads</p><p className="text-2xl font-bold">{overviewData.totalLeads}</p></div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white"><p className="text-purple-100 text-sm">Services Done</p><p className="text-2xl font-bold">{overviewData.totalServices}</p></div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white"><p className="text-orange-100 text-sm">Revenue</p><p className="text-2xl font-bold">₹{overviewData.totalRevenue.toLocaleString()}</p></div>
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white"><p className="text-cyan-100 text-sm">Conversion</p><p className="text-2xl font-bold">{overviewData.totalLeads > 0 ? Math.round((overviewData.convertedLeads / overviewData.totalLeads) * 100) : 0}%</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Monthly Sales & Leads Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
              <Tooltip formatter={(value, name) => [name === "Sales" || name === "Revenue" ? `₹${value.toLocaleString()}` : value, name]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="Leads" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="Services" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Revenue & Services Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip formatter={(value, name) => [name === "Revenue" ? `₹${value.toLocaleString()}` : value, name]} />
              <Legend />
              <Area type="monotone" dataKey="Revenue" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.6} />
              <Area type="monotone" dataKey="Services" stackId="2" stroke="#EC4899" fill="#EC4899" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Lead Sources</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={getLeadSourceData()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {getLeadSourceData().map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {getLeadSourceData().map((item, i) => (
              <div key={i} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div><span className="text-sm text-gray-600">{item.name}</span></div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Lead Conversion</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={getConversionData()} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {getConversionData().map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {getConversionData().map((item, i) => (
              <div key={i} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div><span className="text-sm text-gray-600">{item.name}</span></div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Employee Performance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={getEmployeePerformanceData()} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={60} />
              <Tooltip />
              <Bar dataKey="Leads" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow border"><p className="text-gray-500 text-sm">Telecalls</p><p className="text-2xl font-bold text-blue-600">{overviewData.totalCalls}</p></div>
        <div className="bg-white rounded-xl p-4 shadow border"><p className="text-gray-500 text-sm">Walkins</p><p className="text-2xl font-bold text-green-600">{overviewData.totalWalkins}</p></div>
        <div className="bg-white rounded-xl p-4 shadow border"><p className="text-gray-500 text-sm">Field Visits</p><p className="text-2xl font-bold text-purple-600">{overviewData.totalFields}</p></div>
        <div className="bg-white rounded-xl p-4 shadow border"><p className="text-gray-500 text-sm">Total Clients</p><p className="text-2xl font-bold text-orange-600">{overviewData.totalClients}</p></div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b"><h3 className="text-lg font-semibold text-gray-700">Breakdown</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 font-semibold">
              <tr><th className="px-4 py-3 text-left">{getBreakdownColumnLabel()}</th><th className="px-4 py-3 text-right">Sales (₹)</th><th className="px-4 py-3 text-right">Leads</th><th className="px-4 py-3 text-right">Services</th><th className="px-4 py-3 text-right">Converted</th><th className="px-4 py-3 text-right">Revenue (₹)</th></tr>
            </thead>
            <tbody>
              {getBreakdownData().map((m, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-right text-blue-600 font-semibold">₹{(m.Sales || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{m.Leads || 0}</td>
                  <td className="px-4 py-3 text-right">{m.Services || 0}</td>
                  <td className="px-4 py-3 text-right"><span className={`px-2 py-1 rounded-full text-xs font-medium ${m.Converted > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{m.Converted || 0}</span></td>
                  <td className="px-4 py-3 text-right text-purple-600">₹{(m.Revenue || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const EmployeeTab = () => {
    const filteredEmployeeData = useMemo(() => {
      return employeeData.filter(emp =>
        emp.name.toLowerCase().includes(empSearch.toLowerCase()) ||
        (emp.position || "").toLowerCase().includes(empSearch.toLowerCase())
      );
    }, [empSearch]);

    const sortedEmployeeData = useMemo(() => {
      return [...filteredEmployeeData].sort((a, b) => {
        if (sortBy === "leads") return b.totalLeads - a.totalLeads;
        if (sortBy === "revenue") return b.serviceRevenue - a.serviceRevenue;
        if (sortBy === "conversion") return b.conversionRate - a.conversionRate;
        if (sortBy === "target") {
          const rateA = a.tasksAssigned > 0 ? (a.tasksCompleted / a.tasksAssigned) : 0;
          const rateB = b.tasksAssigned > 0 ? (b.tasksCompleted / b.tasksAssigned) : 0;
          return rateB - rateA;
        }
        if (sortBy === "tasks") return b.tasksCompleted - a.tasksCompleted;
        return b.totalLeads - a.totalLeads;
      });
    }, [filteredEmployeeData, sortBy]);

    const teamSummary = useMemo(() => {
      return {
        totalEmployees: employeeData.length,
        totalLeads: employeeData.reduce((s, m) => s + m.totalLeads, 0),
        totalConverted: employeeData.reduce((s, m) => s + m.leadsConverted, 0),
        totalRevenue: employeeData.reduce((s, m) => s + m.serviceRevenue, 0),
        avgConversion: employeeData.length > 0 ? Math.round(employeeData.reduce((s, m) => s + m.conversionRate, 0) / employeeData.length) : 0,
      };
    }, [employeeData]);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {["day", "week", "month", "year"].map(f => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${filter === f && !showCustomDate ? "bg-white shadow text-blue-600 font-bold" : "text-gray-500 hover:text-gray-800"}`}
                >
                  {f === "day" ? "Today" : f === "week" ? "Week" : f === "month" ? "Month" : "Year"}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCustomDate(!showCustomDate)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${showCustomDate ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              <Calendar size={14} /> Custom Date
            </button>

            {showCustomDate && (
              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="border rounded px-2 py-1 text-xs outline-none"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="border rounded px-2 py-1 text-xs outline-none"
                />
                <button onClick={handleCustomDateApply} className="bg-blue-600 text-white px-2.5 py-1 rounded text-xs hover:bg-blue-700 font-semibold">Apply</button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-inner">
              <Search size={14} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search Employee..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="outline-none text-xs w-36 bg-transparent text-gray-700"
              />
            </div>

            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "grid" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
              >
                Cards View
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "table" ? "bg-white shadow text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
              >
                Table View
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-20 -mb-20 blur-xl"></div>
          <h3 className="text-lg font-extrabold mb-4 tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-300" /> Team Performance Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center relative z-10">
            <div className="bg-white/10 p-3.5 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Employees</p>
              <p className="text-3xl font-black mt-1">{teamSummary.totalEmployees}</p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Total Leads</p>
              <p className="text-3xl font-black mt-1">{teamSummary.totalLeads}</p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Converted</p>
              <p className="text-3xl font-black mt-1 text-green-300">{teamSummary.totalConverted}</p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Revenue</p>
              <p className="text-2xl font-black mt-1.5 text-yellow-300">₹{teamSummary.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 p-3.5 rounded-xl backdrop-blur-md border border-white/10">
              <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">Avg Conv %</p>
              <p className="text-3xl font-black mt-1">{teamSummary.avgConversion}%</p>
            </div>
          </div>
        </div>

        {sortedEmployeeData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Revenue Leaderboard (Top 5)
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedEmployeeData.slice(0, 5).map(emp => ({
                      name: emp.name.split(" ")[0],
                      Revenue: emp.serviceRevenue
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} formatter={(v) => `₹${v.toLocaleString()}`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} width={65} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
                      formatter={(v) => [`₹${v.toLocaleString()}`, "Revenue"]}
                    />
                    <Bar dataKey="Revenue" fill="#10B981" radius={[0, 6, 6, 0]}>
                      {sortedEmployeeData.slice(0, 5).map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Leads: Total vs Converted (Top 5)
              </h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={sortedEmployeeData.slice(0, 5).map(emp => ({
                      name: emp.name.split(" ")[0],
                      Total: emp.totalLeads,
                      Converted: emp.leadsConverted
                    }))}
                    margin={{ top: 10, right: 10, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #f3f4f6", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, pt: 10 }} />
                    <Bar dataKey="Total" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Total Leads" />
                    <Bar dataKey="Converted" fill="#10B981" radius={[4, 4, 0, 0]} name="Converted Leads" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <h3 className="font-extrabold text-gray-700 text-base flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" /> Employee Performance Rankings
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-semibold">Sort By:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-gray-50 text-gray-700 outline-none font-bold">
                <option value="leads">Total Leads</option>
                <option value="revenue">Service Revenue</option>
                <option value="conversion">Conversion Rate</option>
                <option value="target">Task Completion %</option>
                <option value="tasks">Tasks Count</option>
              </select>
            </div>
          </div>

          <div className="p-5">
            {sortedEmployeeData.length === 0 ? (
              <div className="py-12 text-center text-gray-400 italic">No matching employees found</div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedEmployeeData.map((emp, idx) => {
                  let rankBadge = null;
                  if (idx === 0) rankBadge = <span className="bg-yellow-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border border-yellow-400">🏆 1st Rank</span>;
                  else if (idx === 1) rankBadge = <span className="bg-slate-400 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border border-slate-300">🥈 2nd Rank</span>;
                  else if (idx === 2) rankBadge = <span className="bg-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border border-amber-500">🥉 3rd Rank</span>;
                  else rankBadge = <span className="bg-gray-100 text-gray-600 text-[9px] font-black px-2 py-0.5 rounded-full">Rank #{idx + 1}</span>;

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedEmployee(emp)}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg hover:border-blue-300 hover:scale-[1.01] transition-all duration-200 cursor-pointer flex flex-col justify-between animate-in fade-in duration-200"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-600 text-sm">
                              {emp.name[0].toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-gray-800 text-sm">{emp.name}</h4>
                              <p className="text-[11px] text-gray-400 font-semibold">{emp.position}</p>
                            </div>
                          </div>
                          {rankBadge}
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-1.5">
                            <span>Leads (Conv / Total)</span>
                            <span className="font-bold text-gray-800">{emp.leadsConverted} / {emp.totalLeads}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-1.5">
                            <span>Conversion Rate</span>
                            <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] ${emp.conversionRate >= 50 ? "bg-green-100 text-green-700" : emp.conversionRate >= 25 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                              }`}>{emp.conversionRate}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 pb-1.5">
                            <span>Tasks (Completed/Total)</span>
                            <span className="font-bold text-gray-800">{emp.tasksCompleted} / {emp.tasksAssigned}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Services Delivered</span>
                            <span className="font-bold text-gray-800">{emp.services}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase tracking-wider font-extrabold">Revenue Generated</p>
                          <p className="text-base font-black text-green-600">₹{emp.serviceRevenue.toLocaleString()}</p>
                        </div>
                        <span className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-0.5">
                          Spotlight &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left w-12">#</th>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-center">Position</th>
                      <th className="px-4 py-3 text-right">Tel</th>
                      <th className="px-4 py-3 text-right">Walk</th>
                      <th className="px-4 py-3 text-right">Field</th>
                      <th className="px-4 py-3 text-right">Leads</th>
                      <th className="px-4 py-3 text-right">Conv%</th>
                      <th className="px-4 py-3 text-right">Tasks (Done/Total)</th>
                      <th className="px-4 py-3 text-right">Services</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                      <th className="px-4 py-3 text-right">Tasks%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployeeData.map((emp, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelectedEmployee(emp)}
                        className="border-b border-gray-100 hover:bg-blue-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3.5 text-gray-400 font-bold">{i + 1}</td>
                        <td className="px-4 py-3.5 font-bold text-blue-600 hover:underline">{emp.name}</td>
                        <td className="px-4 py-3.5 text-center text-gray-500 font-semibold text-xs">{emp.position}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 font-semibold">{emp.telecalls}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 font-semibold">{emp.walkins}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 font-semibold">{emp.fields}</td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-gray-700">{emp.totalLeads}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.conversionRate >= 50 ? "bg-green-100 text-green-700" : emp.conversionRate >= 25 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                            }`}>{emp.conversionRate}%</span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-600 font-bold">{emp.tasksCompleted} / {emp.tasksAssigned}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600 font-bold">{emp.services}</td>
                        <td className="px-4 py-3.5 text-right font-black text-green-600">₹{emp.serviceRevenue.toLocaleString()}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${emp.tasksAssigned > 0 && (emp.tasksCompleted / emp.tasksAssigned) >= 0.75
                            ? "bg-green-100 text-green-700"
                            : emp.tasksAssigned > 0 && (emp.tasksCompleted / emp.tasksAssigned) >= 0.40
                              ? "bg-yellow-100 text-yellow-700"
                              : emp.tasksAssigned > 0
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                            {emp.tasksAssigned > 0 ? Math.round((emp.tasksCompleted / emp.tasksAssigned) * 100) : 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     USER DASHBOARD TAB (admin only)
  ═══════════════════════════════════════════════════════════ */
  const UserDashboardTab = () => {
    const now = new Date();
    const timeAgo = (dateStr) => {
      if (!dateStr) return "No activity";
      const diff = Math.floor((now - new Date(dateStr)) / 1000);
      if (diff < 60) return "Just now";
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
      return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    };

    const filtered = useMemo(() => {
      const term = udSearch.toLowerCase();
      return userActivity.filter(u =>
        u.name.toLowerCase().includes(term) || u.position.toLowerCase().includes(term)
      );
    }, [udSearch, userActivity]);

    const sorted = useMemo(() => {
      return [...filtered].sort((a, b) => {
        if (udSort === "todayLeads") return b.todayLeads - a.todayLeads;
        if (udSort === "monthLeads") return b.monthLeads - a.monthLeads;
        if (udSort === "conversion") return b.conversionRate - a.conversionRate;
        if (udSort === "callReports") return b.callReportsToday - a.callReportsToday;
        if (udSort === "tasks") return b.tasksTotal - a.tasksTotal;
        if (udSort === "active") return (b.isActiveToday ? 1 : 0) - (a.isActiveToday ? 1 : 0);
        return b.todayLeads - a.todayLeads;
      });
    }, [filtered, udSort]);

    const activeCount = userActivity.filter(u => u.isActiveToday).length;
    const totalLeadsToday = userActivity.reduce((s, u) => s + u.todayLeads, 0);
    const totalMonthLeads = userActivity.reduce((s, u) => s + u.monthLeads, 0);
    const totalCallReports = userActivity.reduce((s, u) => s + u.callReportsToday, 0);

    return (
      <div className="space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1"><Activity size={16} className="text-green-200" /><p className="text-green-100 text-xs font-bold uppercase tracking-wide">Active Today</p></div>
            <p className="text-3xl font-black">{activeCount}<span className="text-lg text-green-200">/{userActivity.length}</span></p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1"><Users size={16} className="text-blue-200" /><p className="text-blue-100 text-xs font-bold uppercase tracking-wide">Today's Leads</p></div>
            <p className="text-3xl font-black">{totalLeadsToday}</p>
          </div>
          <div className="bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-violet-200" /><p className="text-violet-100 text-xs font-bold uppercase tracking-wide">Month Leads</p></div>
            <p className="text-3xl font-black">{totalMonthLeads}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1"><Briefcase size={16} className="text-orange-200" /><p className="text-orange-100 text-xs font-bold uppercase tracking-wide">Call Reports Today</p></div>
            <p className="text-3xl font-black">{totalCallReports}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search user..."
              value={udSearch}
              onChange={e => setUdSearch(e.target.value)}
              className="outline-none text-sm bg-transparent w-40 text-gray-700"
            />
            {udSearch && <button onClick={() => setUdSearch("")} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500">Sort By:</span>
            <select value={udSort} onChange={e => setUdSort(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white text-gray-700 outline-none font-bold">
              <option value="todayLeads">Today's Leads</option>
              <option value="monthLeads">Month Leads</option>
              <option value="conversion">Conversion %</option>
              <option value="callReports">Call Reports Today</option>
              <option value="tasks">Tasks Pending</option>
              <option value="active">Active Status</option>
            </select>
          </div>
          <button
            onClick={fetchUserActivity}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {activityLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <RefreshCw className="animate-spin w-6 h-6 mr-3" /> Loading user activity...
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-20 text-center text-gray-400">No users found</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sorted.map((u, idx) => (
              <div
                key={u.id}
                onClick={() => setUdSelected(u)}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-lg hover:scale-[1.015] transition-all duration-200 cursor-pointer overflow-hidden ${
                  u.isActiveToday ? "border-green-200" : "border-gray-100"
                }`}
              >
                {/* Card header */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  u.isActiveToday ? "bg-gradient-to-r from-green-50 to-emerald-50" : "bg-gray-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm border-2 ${
                      u.isActiveToday ? "bg-green-500 text-white border-green-400" : "bg-gray-200 text-gray-600 border-gray-300"
                    }`}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-800 text-sm">{u.name}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{u.position}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                      u.isActiveToday ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ u.isActiveToday ? "bg-green-500 animate-pulse" : "bg-gray-400" }`}></span>
                      {u.isActiveToday ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[9px] text-gray-400">{u.lastActivity ? `Last: ` : ""}<span className="font-bold">{/* timeAgo done below */}</span></span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="p-4 grid grid-cols-2 gap-3">
                  {/* TODAY LEADS */}
                  <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-wide mb-1 flex items-center gap-1"><Users size={9} /> Today's Leads</p>
                    <p className="text-2xl font-black text-blue-700">{u.todayLeads}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] text-blue-400 font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">📞 {u.todayTelecalls}</span>
                      <span className="text-[9px] text-blue-400 font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">🚶 {u.todayWalkins}</span>
                      <span className="text-[9px] text-blue-400 font-semibold bg-blue-100 px-1.5 py-0.5 rounded-full">📍 {u.todayFields}</span>
                    </div>
                  </div>

                  {/* MONTH LEADS */}
                  <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                    <p className="text-[9px] font-black text-violet-500 uppercase tracking-wide mb-1 flex items-center gap-1"><TrendingUp size={9} /> Month Leads</p>
                    <p className="text-2xl font-black text-violet-700">{u.monthLeads}</p>
                    <p className="text-[9px] text-violet-400 font-semibold mt-1">
                      {u.monthConverted} converted · {u.conversionRate}%
                    </p>
                  </div>

                  {/* CALL REPORTS */}
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-wide mb-1 flex items-center gap-1"><Briefcase size={9} /> Call Reports Today</p>
                    <p className="text-2xl font-black text-orange-700">{u.callReportsToday}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.callReportsClosed > 0 && <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">✓ {u.callReportsClosed} closed</span>}
                      {u.callReportsCompleted > 0 && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">{u.callReportsCompleted} done</span>}
                      {u.callReportsInProgress > 0 && <span className="text-[9px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded-full">⚡ {u.callReportsInProgress} live</span>}
                      {u.callReportsToday === 0 && <span className="text-[9px] text-gray-400">None today</span>}
                    </div>
                  </div>

                  {/* TASKS */}
                  <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-wide mb-1 flex items-center gap-1"><CheckSquare size={9} /> Open Tasks</p>
                    <p className="text-2xl font-black text-rose-700">{u.tasksTotal}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {u.tasksInProgress > 0 && <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">⚡ {u.tasksInProgress}</span>}
                      {u.tasksPending > 0 && <span className="text-[9px] bg-yellow-100 text-yellow-700 font-bold px-1.5 py-0.5 rounded-full">⏳ {u.tasksPending}</span>}
                      {u.tasksTotal === 0 && <span className="text-[9px] text-gray-400">All clear</span>}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 pb-3 flex items-center justify-between">
                  <span className="text-[9px] text-gray-400 flex items-center gap-1">
                    <Clock size={9} /> {u.lastActivity ? timeAgo(u.lastActivity) : "No activity recorded"}
                  </span>
                  <span className="text-[10px] text-blue-500 font-bold hover:underline">Spotlight →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SPOTLIGHT MODAL */}
        {udSelected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className={`px-6 py-5 text-white relative ${ udSelected.isActiveToday ? "bg-gradient-to-r from-green-600 to-emerald-600" : "bg-gradient-to-r from-gray-600 to-gray-700" }`}>
                <button onClick={() => setUdSelected(null)} className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 p-1.5 rounded-full">
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center text-xl font-black border border-white/20">
                    {udSelected.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold">{udSelected.name}</h3>
                    <p className="text-sm opacity-80">{udSelected.position}</p>
                    {udSelected.email && <p className="text-xs opacity-60 mt-0.5">{udSelected.email}</p>}
                  </div>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-black ${ udSelected.isActiveToday ? "bg-green-300 text-green-900" : "bg-gray-300 text-gray-700" }`}>
                    {udSelected.isActiveToday ? "🟢 Active Today" : "⚫ Inactive Today"}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Today's leads breakdown */}
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Today's Leads Breakdown</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                      <p className="text-xs text-blue-400 font-bold mb-1">📞 Telecalls</p>
                      <p className="text-2xl font-black text-blue-700">{udSelected.todayTelecalls}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                      <p className="text-xs text-green-400 font-bold mb-1">🚶 Walkins</p>
                      <p className="text-2xl font-black text-green-700">{udSelected.todayWalkins}</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                      <p className="text-xs text-purple-400 font-bold mb-1">📍 Field</p>
                      <p className="text-2xl font-black text-purple-700">{udSelected.todayFields}</p>
                    </div>
                  </div>
                </div>

                {/* Month stats */}
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">This Month</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                      <p className="text-[10px] text-violet-400 font-bold uppercase">Total Leads</p>
                      <p className="text-xl font-black text-violet-700 mt-0.5">{udSelected.monthLeads}</p>
                      <p className="text-[10px] text-violet-400">Tel:{udSelected.monthTelecalls} Walk:{udSelected.monthWalkins} Field:{udSelected.monthFields}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                      <p className="text-[10px] text-green-400 font-bold uppercase">Converted</p>
                      <p className="text-xl font-black text-green-700 mt-0.5">{udSelected.monthConverted}</p>
                      <p className="text-[10px] text-green-400">Conv. Rate: {udSelected.conversionRate}%</p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                      <span>Conversion Rate</span><span>{udSelected.conversionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${ udSelected.conversionRate >= 50 ? "bg-green-500" : udSelected.conversionRate >= 25 ? "bg-yellow-500" : "bg-red-400" }`}
                        style={{ width: `${Math.min(udSelected.conversionRate, 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Call Reports */}
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Call Reports Today</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
                      <p className="text-[10px] text-orange-400 font-bold">Total</p>
                      <p className="text-xl font-black text-orange-600">{udSelected.callReportsToday}</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center">
                      <p className="text-[10px] text-green-400 font-bold">Closed</p>
                      <p className="text-xl font-black text-green-600">{udSelected.callReportsClosed}</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 text-center">
                      <p className="text-[10px] text-yellow-500 font-bold">In Progress</p>
                      <p className="text-xl font-black text-yellow-600">{udSelected.callReportsInProgress}</p>
                    </div>
                  </div>
                </div>

                {/* Tasks */}
                <div>
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Open Tasks</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-400 font-bold">In Progress</p>
                      <p className="text-xl font-black text-blue-600">{udSelected.tasksInProgress}</p>
                    </div>
                    <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                      <p className="text-[10px] text-rose-400 font-bold">Pending</p>
                      <p className="text-xl font-black text-rose-600">{udSelected.tasksPending}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 text-xs text-gray-400 flex items-center gap-2">
                  <Clock size={12} /> Last activity: <span className="font-bold text-gray-600">{udSelected.lastActivity ? new Date(udSelected.lastActivity).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "No activity recorded"}</span>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
                <button onClick={() => setUdSelected(null)} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-300 transition">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full p-4 md:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1694CE]">Reports & Analytics</h2>
          <span className="text-sm text-gray-500">Dashboard &gt; Reports</span>
        </div>
        <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow mb-4 overflow-hidden">
        <div className="flex border-b flex-wrap">
          <button onClick={() => setActiveTab("overview")} className={`px-6 py-4 font-medium text-sm ${activeTab === "overview" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>Overview</button>
          <button onClick={() => setActiveTab("byEmployee")} className={`px-6 py-4 font-medium text-sm ${activeTab === "byEmployee" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-600"}`}>Employee Rankings</button>
          {isAdmin && (
            <button onClick={() => setActiveTab("userDashboard")} className={`px-6 py-4 font-medium text-sm flex items-center gap-2 ${activeTab === "userDashboard" ? "bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600" : "text-gray-600"}`}>
              <Activity size={14} /> User Dashboard
            </button>
          )}
        </div>
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "byEmployee" && <EmployeeTab />}
      {activeTab === "userDashboard" && isAdmin && <UserDashboardTab />}

      {/* SPOTLIGHT DETAIL MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white relative">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors font-bold text-lg"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center text-lg font-bold text-white border border-white/10">
                  {selectedEmployee.name[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">{selectedEmployee.name}</h3>
                  <p className="text-xs text-blue-100 font-medium">{selectedEmployee.position}</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Revenue Generated</p>
                  <p className="text-lg font-black text-green-600 mt-1">₹{selectedEmployee.serviceRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Services Delivered</p>
                  <p className="text-lg font-black text-indigo-600 mt-1">{selectedEmployee.services} Done</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span>Lead Conversion Rate</span>
                  <span>{selectedEmployee.conversionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${selectedEmployee.conversionRate >= 50 ? "bg-green-500" : selectedEmployee.conversionRate >= 25 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                    style={{ width: `${selectedEmployee.conversionRate}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  Converted {selectedEmployee.leadsConverted} of {selectedEmployee.totalLeads} total leads.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span>Task Completion Rate</span>
                  <span>
                    {selectedEmployee.tasksAssigned > 0
                      ? Math.round((selectedEmployee.tasksCompleted / selectedEmployee.tasksAssigned) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${selectedEmployee.tasksAssigned > 0
                        ? Math.round((selectedEmployee.tasksCompleted / selectedEmployee.tasksAssigned) * 100)
                        : 0}%`
                    }}
                  ></div>
                </div>
                <p className="text-[11px] text-gray-400 italic">
                  Completed {selectedEmployee.tasksCompleted} of {selectedEmployee.tasksAssigned} assigned tasks.
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-gray-500" /> Lead Source Breakdown
                </h4>
                <div className="flex items-center justify-between gap-4">
                  {(selectedEmployee.telecalls || selectedEmployee.walkins || selectedEmployee.fields) ? (
                    <>
                      <div className="h-[100px] w-[100px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: "Telecalls", value: selectedEmployee.telecalls },
                                { name: "Walkins", value: selectedEmployee.walkins },
                                { name: "Fields", value: selectedEmployee.fields },
                              ].filter(d => d.value > 0)}
                              cx="50%"
                              cy="50%"
                              innerRadius={20}
                              outerRadius={35}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              <Cell fill="#3B82F6" />
                              <Cell fill="#10B981" />
                              <Cell fill="#8B5CF6" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2 text-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                          <span className="flex items-center gap-1.5 font-semibold text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Telecalls
                          </span>
                          <span className="font-bold text-gray-700">{selectedEmployee.telecalls}</span>
                        </div>
                        <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                          <span className="flex items-center gap-1.5 font-semibold text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span> Walkins
                          </span>
                          <span className="font-bold text-gray-700">{selectedEmployee.walkins}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span> Field Visits
                          </span>
                          <span className="font-bold text-gray-700">{selectedEmployee.fields}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 italic py-4 text-center w-full">
                      No lead sources data registered for this filter range
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-100">
              <button
                onClick={() => setSelectedEmployee(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-300 transition"
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