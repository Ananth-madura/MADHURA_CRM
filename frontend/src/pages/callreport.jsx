import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../Styles/tailwind.css";
import { Search, Plus, X, Trash2, Edit, ChevronDown, ChevronUp, Download, Eye, AlertCircle, CheckCircle, Clock, Phone, CreditCard, DollarSign, AlertTriangle, MapPin, Phone as PhoneIcon, FileText, Calendar, DollarSign as DollarIcon, User, Tag, MessageSquare, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity, Mail, Wrench, Users, Layers } from "lucide-react";
import axios from "axios";
import socket from "../socket/socket";
import { API } from "../config";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";

const PIE_COLORS = ["#3B82F6", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const getAuthConfig = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const getUserRole = () => {
  try { return JSON.parse(localStorage.getItem("user") || "{}").role || "employee"; } catch { return "employee"; }
};

// Call Report permission: admin role OR malarvannan/priyanka by name
const CALL_REPORT_EDITOR_NAMES = ["malarvannan", "priyanka"];
const getCanEditCallReport = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const role = user.role || "employee";
    const name = (user.name || "").trim().toLowerCase();
    return role === "admin" || CALL_REPORT_EDITOR_NAMES.includes(name);
  } catch { return false; }
};

const ENGINEERS = [
  { value: "Thanapalan AC017", label: "Thanapalan AC017" },
  { value: "Rajesh AC080", label: "Rajesh AC080" },
  { value: "Kandhavel AC086", label: "Kandhavel AC086" },
  { value: "Gopi AC078", label: "Gopi AC078" },
  { value: "Saran raj AC087", label: "Saran raj AC087" },
  { value: "Bharani AC105", label: "Bharani AC105" },
  { value: "Damodaran AC085", label: "Damodaran AC085" },
  { value: "Suresh AC073", label: "Suresh AC073" },
  { value: "Ranjith AC054", label: "Ranjith AC054" },
  { value: "Sivakumar AC036", label: "Sivakumar AC036" },
  { value: "Manikandaraja AC097", label: "Manikandaraja AC097" },
  { value: "Malar vannan AC016", label: "Malar vannan AC016" },
  { value: "Faiz al AC068", label: "Faiz al AC068" },
];

const CALL_REFERRERS = [
  "Krishna kumar", "Jai sankar", "Uma", "Malar vannan", "Vimal",
  "Moorthi", "Priyanka", "Thanapalan", "Princee", "Walkin"
];

const STATUS_OPTIONS = ["Closed", "Pending", "Live", "Observation"];
const CALL_TYPE_OPTIONS = ["AMC", "ALC", "Warranty", "New Installation", "Repeated"];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium"];
const PAYMENT_TYPE_OPTIONS = ["Cash", "Card", "Credit", "Cheque", "UPI"];
const PAYMENT_STATUS_OPTIONS = ["Collected", "Pending"];

const STATUS_COLORS = {
  Closed: { bg: "hsl(142 71% 45% / 0.1)", text: "hsl(142 71% 45%)", border: "hsl(142 71% 45% / 0.2)" },
  Pending: { bg: "hsl(38 92% 50% / 0.1)", text: "hsl(38 92% 50%)", border: "hsl(38 92% 50% / 0.2)" },
  Live: { bg: "hsl(217 91% 60% / 0.1)", text: "hsl(217 91% 60%)", border: "hsl(217 91% 60% / 0.2)" },
  Observation: { bg: "hsl(271 81% 56% / 0.1)", text: "hsl(271 81% 56%)", border: "hsl(271 81% 56% / 0.2)" },
};

const PRIORITY_COLORS = {
  Critical: { bg: "hsl(0 72% 51% / 0.1)", text: "hsl(0 72% 51%)", border: "hsl(0 72% 51% / 0.2)" },
  High: { bg: "hsl(24 94% 50% / 0.1)", text: "hsl(24 94% 50%)", border: "hsl(24 94% 50% / 0.2)" },
  Medium: { bg: "hsl(210 40% 96%)", text: "hsl(215 16% 47%)", border: "hsl(214 32% 91%)" },
};

const PAYMENT_STATUS_COLORS = {
  Collected: { bg: "hsl(142 71% 45% / 0.1)", text: "hsl(142 71% 45%)", border: "hsl(142 71% 45% / 0.2)" },
  Pending: { bg: "hsl(0 72% 51% / 0.1)", text: "hsl(0 72% 51%)", border: "hsl(0 72% 51% / 0.2)" },
};

const SearchableSelect = ({ options, value, onChange, placeholder, label, onSearch, loading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchTimeoutRef = React.useRef(null);

  const filtered = onSearch ? options : options.filter(opt => {
    const val = typeof opt === "string" ? opt : opt.value;
    return val.toLowerCase().includes(search.toLowerCase());
  });

  const selectedLabel = options.find(opt => {
    const val = typeof opt === "string" ? opt : opt.value;
    return val === value;
  });

  const displayValue = selectedLabel ? (typeof selectedLabel === "string" ? selectedLabel : selectedLabel.label) : value;

  const handleSearchChange = (val) => {
    setSearch(val);
    if (onSearch && isOpen) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => { onSearch(val); }, 300);
    }
  };

  React.useEffect(() => {
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, []);

  return (
    <div className="relative">
      {label && <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--color-slate, #5d5b54)" }}>{label}</label>}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer transition-all duration-150"
        style={{ backgroundColor: "var(--color-canvas, #ffffff)", color: "var(--color-ink, #1a1a1a)", border: `1px solid ${isOpen ? "var(--color-primary, #5645d4)" : "var(--color-hairline-strong, #c8c4be)"}`, borderRadius: "var(--radius-md, 8px)", boxShadow: isOpen ? "0 0 0 2px rgba(86, 69, 212, 0.2)" : "none" }}
        onClick={() => { setIsOpen(!isOpen); setSearch(""); if (onSearch && !isOpen) onSearch(""); }}
      >
        <span className="text-sm truncate" style={{ color: value ? "var(--color-ink, #1a1a1a)" : "var(--color-muted, #bbb8b1)" }}>
          {displayValue || placeholder}
        </span>
        {isOpen ? <ChevronUp size={14} style={{ color: "var(--color-steel, #787671)" }} /> : <ChevronDown size={14} style={{ color: "var(--color-steel, #787671)" }} />}
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 overflow-hidden animate-scale-in" style={{ backgroundColor: "var(--color-canvas, #ffffff)", border: "1px solid var(--color-hairline, #e5e3df)", borderRadius: "var(--radius-md, 8px)", boxShadow: "var(--shadow-level-2, 0 4px 12px rgba(15,15,15,0.08))" }}>
          {onSearch && (
            <div className="p-2" style={{ borderBottom: "1px solid var(--color-hairline, #e5e3df)" }}>
              <input type="text" value={search} onChange={e => handleSearchChange(e.target.value)} placeholder="Type to search..." className="w-full outline-none text-sm bg-transparent" style={{ color: "var(--color-ink, #1a1a1a)" }} autoFocus onClick={e => e.stopPropagation()} />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--color-steel, #787671)" }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs" style={{ color: "var(--color-steel, #787671)" }}>{onSearch ? "Type to search..." : "No results"}</div>
            ) : (
               filtered.map((opt, idx) => {
                 const val = typeof opt === "string" ? opt : opt.value;
                 const lbl = typeof opt === "string" ? opt : opt.label;
                 return (
                   <div key={idx} className="px-3 py-2 text-sm cursor-pointer transition-colors" style={{ backgroundColor: value === val ? "rgba(86, 69, 212, 0.1)" : "var(--color-surface, #f6f5f4)", color: value === val ? "var(--color-primary, #5645d4)" : "var(--color-ink, #1a1a1a)" }} onClick={e => { e.stopPropagation(); onChange(val); setIsOpen(false); }} onMouseEnter={e => { if (value !== val) e.target.style.backgroundColor = "var(--color-surface, #f6f5f4)"; }} onMouseLeave={e => { if (value !== val) e.target.style.backgroundColor = "var(--color-surface, #f6f5f4)"; }}>
                     {lbl}
                   </div>
                 );
               })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FormField = ({ label, children, className, required, icon }) => (
  <div className={className || ""}>
    {label && (
      <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--color-slate, #5d5b54)", marginBottom: "6px" }}>
        {icon && <icon size={14} style={{ color: "var(--color-primary, #5645d4)" }} />}
        {label}{required && <span style={{ color: "var(--color-error, #e03131)" }}>*</span>}
      </label>
    )}
    <div style={{ marginTop: "6px" }}>{children}</div>
  </div>
);

const inputBase = "w-full p-2.5 text-sm outline-none transition-all duration-150 bg-white text-gray-900 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm";

const SectionDivider = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--color-hairline, #e5e3df)" }}>
    {Icon && <Icon size={14} style={{ color: "var(--color-primary, #5645d4)" }} />}
    <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-primary, #5645d4)" }}>{title}</h3>
  </div>
);

const Badge = ({ children, bg, text, border }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: bg, color: text, border: `1px solid ${border}` }}>
    {children}
  </span>
);

const safeFormatDate = (dateVal) => {
  if (!dateVal) return "—";
  try {
    const dateStr = typeof dateVal === "string" ? dateVal : new Date(dateVal).toISOString();
    return dateStr.split("T")[0];
  } catch (e) {
    return String(dateVal).split("T")[0] || "—";
  }
};

const formatTimeOnly = (timeVal) => {
  if (!timeVal) return "—";
  const str = String(timeVal);
  return str.includes(" ") ? (str.split(" ")[1] || str) : str;
};

const DetailModal = ({ call, onClose, formatCurrency }) => {
  if (!call) return null;
  const sc = STATUS_COLORS[call.status] || STATUS_COLORS.Pending;
  const pc = PRIORITY_COLORS[call.priority] || PRIORITY_COLORS.Medium;
  const psc = PAYMENT_STATUS_COLORS[call.payment_status] || PAYMENT_STATUS_COLORS.Pending;

  const DetailItem = ({ icon: Icon, label, value, valueColor, badge, badgeBg, badgeText, badgeBorder }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors">
      {Icon && <Icon size={15} className="text-primary mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        {badge ? (
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: badgeBg, color: badgeText, border: `1px solid ${badgeBorder}` }}>
            {value || "—"}
          </span>
        ) : (
          <p className="text-sm font-semibold mt-0.5 truncate" style={{ color: valueColor || "hsl(var(--foreground))" }}>{value || "—"}</p>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ title, color = "text-primary" }) => (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-border`}>
      <h3 className={`text-xs font-black uppercase tracking-widest ${color}`}>{title}</h3>
    </div>
  );

  const totalExpenses = (parseFloat(call.petrol_charges) || 0) + (parseFloat(call.spare_parts_price) || 0) + (parseFloat(call.labour_charges) || 0);
  const displayTotal = call.total_expenses || totalExpenses;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-border animate-scale-in mb-6" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black font-display text-foreground">Call Report Details</h2>
              <p className="text-[11px] font-mono text-primary">Call #{call.call_sequence || 1} &nbsp;·&nbsp; ID: {String(call.id).padStart(3, '0')} &nbsp;·&nbsp; {safeFormatDate(call.report_date || call.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold border" style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>{call.status || "Pending"}</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold border" style={{ background: pc.bg, color: pc.text, borderColor: pc.border }}>{call.priority || "Medium"}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* ── FORM 1: Customer Details ── */}
          <div className="rounded-xl border border-primary/20 bg-primary/3 p-4">
            <SectionHeader title="① Customer Details (Form 1)" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem icon={User} label="Customer Name" value={call.customer_name || call.client_name || call.name} />
              <DetailItem icon={PhoneIcon} label="Mobile Number" value={call.mobile_number || call.phone} />
              <DetailItem icon={Mail} label="Email" value={call.email} />
              <DetailItem icon={MapPin} label="Location / City" value={call.location_city || call.location} />
              <DetailItem icon={FileText} label="Company Name" value={call.company_name} />
              <DetailItem icon={FileText} label="GST Number" value={call.gst_number} />
            </div>
          </div>

          {/* ── FORM 1: Call Classification ── */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <SectionHeader title="① Call Classification (Form 1)" color="text-amber-700" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem icon={Tag} label="Call Type" value={call.call_type} />
              <DetailItem icon={Tag} label="Contract Title" value={call.contract_title} />
              <DetailItem icon={Phone} label="Call Referrer" value={call.call_referrer} />
              <DetailItem icon={Tag} label="Priority" value={call.priority} badge badgeBg={pc.bg} badgeText={pc.text} badgeBorder={pc.border} />
              <DetailItem icon={CheckCircle} label="Status" value={call.status} badge badgeBg={sc.bg} badgeText={sc.text} badgeBorder={sc.border} />
              <DetailItem icon={Calendar} label="Report Date" value={safeFormatDate(call.report_date || call.created_at)} />
            </div>
            {(call.call_details || call.complaint || call.description) && (
              <div className="mt-3 p-3 rounded-lg bg-white border border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Call Details / Issue Description</p>
                <p className="text-sm text-foreground leading-relaxed">{call.call_details || call.complaint || call.description}</p>
              </div>
            )}
          </div>

          {/* ── FORM 2: Engineer Assignment ── */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <SectionHeader title="② Engineer Assignment (Form 2)" color="text-blue-700" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem icon={User} label="Engineer / Technician" value={call.staff_name || call.technician || call.engineer} />
              <DetailItem icon={User} label="Executive / Referrer" value={call.executive_name || call.call_referrer} />
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <CheckCircle size={15} className="text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Step 2 Status</p>
                  <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${call.step2_completed ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}>
                    {call.step2_completed ? "✓ Complete" : "Basic (Pending)"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM 2: Time & Travel ── */}
          <div className="rounded-xl border border-green-200 bg-green-50/30 p-4">
            <SectionHeader title="② Time & Travel (Form 2)" color="text-green-700" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem icon={Clock} label="Start Time" value={formatTimeOnly(call.start_time)} />
              <DetailItem icon={Clock} label="End Time" value={formatTimeOnly(call.end_time)} />
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${call.is_exceeded ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <Clock size={15} className={`mt-0.5 ${call.is_exceeded ? "text-red-600" : "text-green-600"}`} />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duration</p>
                  <p className={`text-sm font-bold mt-0.5 ${call.is_exceeded ? "text-red-600" : "text-green-700"}`}>{call.actual_duration || 0} min</p>
                  <p className="text-[10px] text-muted-foreground">Limit: {call.duration_limit || call.assigned_time || 30} min</p>
                  {call.is_exceeded && (
                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle size={9} /> +{(call.actual_duration || 0) - (call.duration_limit || call.assigned_time || 30)} min over
                    </span>
                  )}
                </div>
              </div>
              <DetailItem icon={MapPin} label="Kilometers (KM)" value={call.km != null && call.km !== "" ? `${call.km} km` : "0 km"} />
            </div>
          </div>

          {/* ── FORM 2: Expenses ── */}
          <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
            <SectionHeader title="② Expenses (Form 2)" color="text-orange-700" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem icon={DollarIcon} label="Petrol Charges" value={formatCurrency(call.petrol_charges)} />
              <DetailItem icon={DollarIcon} label="Spare Parts" value={formatCurrency(call.spare_parts_price)} />
              <DetailItem icon={DollarIcon} label="Labour Charges" value={formatCurrency(call.labour_charges)} />
              <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-100 border border-orange-300">
                <DollarIcon size={15} className="text-orange-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">Total Expenses</p>
                  <p className="text-lg font-black text-orange-800 font-display">{formatCurrency(displayTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM 2: Payment ── */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4">
            <SectionHeader title="② Payment (Form 2)" color="text-purple-700" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-100 border border-purple-300 md:col-span-1">
                <DollarIcon size={15} className="text-purple-700 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">Invoice Value</p>
                  <p className="text-xl font-black text-purple-900 font-display">{formatCurrency(call.invoice_value)}</p>
                </div>
              </div>
              <DetailItem icon={CreditCard} label="Payment Type" value={call.payment_type || call.payment_mode} />
              <DetailItem icon={CheckCircle} label="Payment Status" value={call.payment_status} badge badgeBg={psc.bg} badgeText={psc.text} badgeBorder={psc.border} />
            </div>
          </div>

          {/* ── Remarks ── */}
          {call.remarks && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Remarks / Notes</p>
              <p className="text-sm text-foreground leading-relaxed">{call.remarks}</p>
            </div>
          )}

          {/* ── Footer metadata ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground border-t border-border pt-4">
            <div><span className="font-bold">Session ID:</span> {call.session_id || "—"}</div>
            <div><span className="font-bold">Created:</span> {safeFormatDate(call.created_at)}</div>
            <div><span className="font-bold">Completed At:</span> {call.completed_at ? safeFormatDate(call.completed_at) : "—"}</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

const CallReport = () => {
  const userRole = getUserRole();
  const canEditDelete = getCanEditCallReport();

  const [activeTab, setActiveTab] = useState("calls");
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [engineerFilter, setEngineerFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [detailCall, setDetailCall] = useState(null);
  const [perfEngineerFilter, setPerfEngineerFilter] = useState("All");

  const [form, setForm] = useState({
    customer: "", customer_id: "", mobile_number: "", email: "", location_city: "", call_details: "",
    priority: "Medium", call_referrer: "", status: "Pending", call_type: "",
    payment_type: "", invoice_value: "", payment_status: "Pending", duration: "", contract_title: "",
    gst_number: "", company_name: "",
    engineer: "", start_time: "", end_time: "", km: "",
    petrol_charges: "", spare_parts_price: "", labour_charges: "", remarks: "",
    session_id: "", call_sequence: 1,
    step2_completed: 0
  });

  const [step2Form, setStep2Form] = useState({
    engineer: "", start_time: "", end_time: "", km: "", duration: "",
    petrol_charges: "", spare_parts_price: "", labour_charges: "", remarks: "",
    status: "", invoice_value: "",
    payment_status: "Pending",
    payment_type: "",
  });

  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [contractSearchResults, setContractSearchResults] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [step2CallId, setStep2CallId] = useState(null);
  const [step2ModalOpen, setStep2ModalOpen] = useState(false);

  // History tab state
  const [historyCalls, setHistoryCalls] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    dateRangeType: "all", // "all", "exact_day", "last_7", "last_30", "custom", "month_year"
    exactDate: new Date().toISOString().split("T")[0],
    from: "",
    to: "",
    month: "",
    year: new Date().getFullYear().toString(),
    customer: "",
    engineer: "All"
  });
  const [historySearchInput, setHistorySearchInput] = useState("");

  // Debounce history search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setHistoryFilters(prev => {
        if (prev.customer === historySearchInput) return prev;
        return { ...prev, customer: historySearchInput };
      });
    }, 350);
    return () => clearTimeout(handler);
  }, [historySearchInput]);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/call-reports`, getAuthConfig());
      const data = res.data || [];
      setCalls(data);
      localStorage.setItem("cached_calls", JSON.stringify(data));
    } catch (err) {
      console.error("Fetch calls error, loading cache:", err);
      try {
        const cached = localStorage.getItem("cached_calls");
        if (cached) setCalls(JSON.parse(cached));
      } catch (e) { console.error(e); }
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Instant offline/cached startup before network call resolves
    try {
      const cached = localStorage.getItem("cached_calls");
      if (cached) setCalls(JSON.parse(cached));
    } catch (e) { console.error(e); }

    fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    const handler = () => fetchCalls();
    socket.on("data_changed", handler);
    return () => socket.off("data_changed", handler);
  }, [fetchCalls]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ scope: "history" });
      
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      if (historyFilters.dateRangeType === "exact_day") {
        if (historyFilters.exactDate) {
          params.append("from", historyFilters.exactDate);
          params.append("to", historyFilters.exactDate);
        }
      } else if (historyFilters.dateRangeType === "last_7") {
        const last7 = new Date();
        last7.setDate(today.getDate() - 7);
        params.append("from", last7.toISOString().split("T")[0]);
        params.append("to", todayStr);
      } else if (historyFilters.dateRangeType === "last_30") {
        const last30 = new Date();
        last30.setDate(today.getDate() - 30);
        params.append("from", last30.toISOString().split("T")[0]);
        params.append("to", todayStr);
      } else if (historyFilters.dateRangeType === "custom") {
        if (historyFilters.from) params.append("from", historyFilters.from);
        if (historyFilters.to) params.append("to", historyFilters.to);
      } else if (historyFilters.dateRangeType === "month_year") {
        if (historyFilters.month) params.append("month", historyFilters.month);
        if (historyFilters.year) params.append("year", historyFilters.year);
      }

      if (historyFilters.customer) params.append("customer", historyFilters.customer);
      if (historyFilters.engineer && historyFilters.engineer !== "All") params.append("engineer", historyFilters.engineer);

      const res = await axios.get(`${API}/api/call-reports?${params.toString()}`, getAuthConfig());
      setHistoryCalls(res.data || []);
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilters]);

  const handleHistorySearchClick = () => {
    setHistoryFilters(prev => {
      if (prev.customer === historySearchInput) {
        fetchHistory();
        return prev;
      }
      return { ...prev, customer: historySearchInput };
    });
  };

  useEffect(() => {
    if (activeTab === "history") fetchHistory();
  }, [activeTab, fetchHistory]);

   const mapClientOption = (c) => ({
     value: c.name || c.customer || "",
     customer_id: c.id,
     label: `${c.name || c.customer || ""}${c.company_name ? ` (${c.company_name})` : ""}`,
     mobile_number: c.phone || c.mobile_number || "",
     location_city: c.city || c.lead_city || c.location_city || c.address || "",
     email: c.email || "",
     gst_number: c.gst_number || "",
     company_name: c.company_name || "",
   });

   const mapContractOption = (c) => ({
     value: c.contract_title || "",
     contract_id: c.id,
     label: `${c.contract_title || "Untitled Contract"}${c.client_company ? ` - ${c.client_company}` : ""}`,
     mobile_number: c.mobile_number || "",
     location_city: c.location_city || "",
     email: c.email || "",
     invoice_value: c.amount_value || c.invoice_value || 0,
     contract_type: c.contract_type || "",
     client_company: c.client_company || "",
   });

   const searchCustomers = useCallback(async (q = "") => {
     setCustomerLoading(true);
     try {
       const res = await axios.get(`${API}/api/client/search`, {
         params: { name: q },
         ...getAuthConfig()
       });
       setCustomerSearchResults((res.data || []).map(mapClientOption).filter(c => c.value));
     } catch (err) {
       console.error(err);
       try {
         const res = await axios.get(`${API}/api/call-reports/customers`, {
           params: { q },
           ...getAuthConfig()
         });
         setCustomerSearchResults((res.data || []).map(mapClientOption).filter(c => c.value));
       } catch (fallbackErr) {
         console.error(fallbackErr);
         setCustomerSearchResults([]);
       }
     }
     finally { setCustomerLoading(false); }
   }, []);

   const searchContracts = useCallback(async (type, searchTerm = "") => {
     if (type !== "AMC" && type !== "ALC") {
       setContractSearchResults([]);
       return;
     }

     setContractLoading(true);
     try {
       const res = await axios.get(`${API}/api/contract/with-usage`, getAuthConfig());
       const q = searchTerm.trim().toLowerCase();
       const filtered = (res.data || []).filter(c => {
         const matchesType = c.contract_type === type;
         const haystack = `${c.contract_title || ""} ${c.client_company || ""} ${c.mobile_number || ""} ${c.email || ""}`.toLowerCase();
         return matchesType && (!q || haystack.includes(q));
       });
       setContractSearchResults(filtered.map(mapContractOption));
     } catch (err) {
       console.error(err);
       setContractSearchResults([]);
     }
     finally { setContractLoading(false); }
   }, []);

  const handleCallTypeChange = (type) => {
    setForm(prev => ({
      ...prev,
      call_type: type,
      contract_title: "",
      customer_id: "",
    }));
    setSelectedContract(null);
    if (type === "AMC" || type === "ALC") {
      searchContracts(type, "");
    } else {
      setContractSearchResults([]);
    }
  };

  const handleContractSelect = (contractTitle) => {
    const contract = contractSearchResults.find(c => c.value === contractTitle);
    if (contract) {
      setSelectedContract(contract);
      setForm(prev => ({
        ...prev,
        customer: contract.client_company || contract.label,
        customer_id: contract.contract_id || "",
        contract_title: contract.value || "",
        mobile_number: contract.mobile_number || "",
        email: contract.email || "",
        location_city: contract.location_city || "",
        invoice_value: contract.invoice_value || prev.invoice_value,
      }));
    }
  };

  const handleCustomerSelect = (customerVal) => {
    const customer = customerSearchResults.find(c => c.value === customerVal);
    if (customer) {
      setForm((prev) => ({
        ...prev,
        customer: customer.value,
        customer_id: customer.customer_id || "",
        mobile_number: customer.mobile_number || "",
        email: customer.email || "",
        location_city: customer.location_city || "",
      }));
    } else {
      setForm((prev) => ({ ...prev, customer: customerVal }));
    }
  };

  const calculateDuration = () => {
    if (!form.start_time || !form.end_time) return { actual: 0, limit: 0, exceeded: false, overflow: 0 };
    const [sh, sm] = form.start_time.split(":").map(Number);
    const [eh, em] = form.end_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const actual = endMins > startMins ? endMins - startMins : 0;
    const durationMap = { "1hr": 60, "1.5hr": 90, "2hr": 120 };
    const limit = durationMap[form.duration] || selectedContract?.duration_limit || 30;
    const exceeded = actual > limit;
    const overflow = exceeded ? actual - limit : 0;
    return { actual, limit, exceeded, overflow };
  };

  const duration = calculateDuration();

  const calculateStep2Duration = () => {
    if (!step2Form.start_time || !step2Form.end_time) return { actual: 0, limit: 0, exceeded: false, overflow: 0 };
    const currentCall = calls.find(c => c.id === step2CallId);
    const durMap = { "1hr": 60, "1.5hr": 90, "2hr": 120 };
    const limit = (step2Form.duration && durMap[step2Form.duration]) || currentCall?.duration_limit || currentCall?.assigned_time || 30;
    const [sh, sm] = step2Form.start_time.split(":").map(Number);
    const [eh, em] = step2Form.end_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const actual = endMins > startMins ? endMins - startMins : 0;
    const exceeded = actual > limit;
    const overflow = exceeded ? actual - limit : 0;
    return { actual, limit, exceeded, overflow };
  };

  const step2Duration = calculateStep2Duration();

  const resetForm = () => {
    setForm({
      customer: "", customer_id: "", mobile_number: "", email: "", location_city: "", call_details: "",
      priority: "Medium", call_referrer: "", status: "Pending", call_type: "",
      payment_type: "", invoice_value: "", payment_status: "Pending", duration: "", contract_title: "",
      gst_number: "", company_name: "",
      engineer: "", start_time: "", end_time: "", km: "",
      petrol_charges: "", spare_parts_price: "", labour_charges: "", remarks: "",
      session_id: "", call_sequence: 1,
      step2_completed: 0
    });
    setStep2Form({
      engineer: "", start_time: "", end_time: "", km: "", duration: "",
      petrol_charges: "", spare_parts_price: "", labour_charges: "", remarks: "",
      status: "", invoice_value: "",
      payment_status: "Pending",
      payment_type: "",
    });
    setIsEdit(false); setEditId(null);
    setSelectedContract(null);
    setCustomerSearchResults([]);
    setContractSearchResults([]);
    setStep2CallId(null);
    setStep2ModalOpen(false);
  };

  const openAddModal = () => { resetForm(); setModalOpen(true); searchCustomers(""); };

  const openEditModal = (call) => {
    setForm({
      customer: call.customer_name || call.client_name || "",
      customer_id: call.customer_id || "",
      mobile_number: call.mobile_number || call.phone || "",
      email: call.email || "",
      location_city: call.location_city || call.location || "",
      call_details: call.call_details || call.complaint || call.description || "",
      priority: call.priority || "Medium",
      call_referrer: call.call_referrer || "",
      status: call.status || "Pending",
      call_type: call.call_type || "",
      payment_type: call.payment_type || "",
      invoice_value: call.invoice_value || "",
      payment_status: call.payment_status || "Pending",
      contract_title: call.contract_title || "",
      duration: call.duration_limit ? (call.duration_limit == 60 ? "1hr" : call.duration_limit == 90 ? "1.5hr" : call.duration_limit == 120 ? "2hr" : "") : "",
      gst_number: call.gst_number || "",
      company_name: call.company_name || "",
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      km: call.km || "",
      petrol_charges: call.petrol_charges || "",
      spare_parts_price: call.spare_parts_price || "",
      labour_charges: call.labour_charges || "",
      remarks: call.remarks || "",
      session_id: call.session_id || "",
      call_sequence: call.call_sequence || 1,
      step2_completed: call.step2_completed || 0,
    });
    setStep2Form({
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      km: call.km || "",
      petrol_charges: call.petrol_charges || "",
      spare_parts_price: call.spare_parts_price || "",
      labour_charges: call.labour_charges || "",
      remarks: call.remarks || "",
      status: call.status || "Pending",
      invoice_value: call.invoice_value || "",
      payment_status: call.payment_status || "Pending",
      payment_type: call.payment_type || "",
    });
    setEditId(call.id);
    setIsEdit(true);
    setModalOpen(true);
  };

  const openStep2Form = async (call) => {
    setStep2CallId(call.id);
    const durLimit = call.duration_limit || call.assigned_time || 30;
    const durStr = durLimit === 60 ? "1hr" : durLimit === 90 ? "1.5hr" : durLimit === 120 ? "2hr" : "";
    setStep2Form({
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      km: call.km || "",
      duration: durStr,
      petrol_charges: call.petrol_charges || "",
      spare_parts_price: call.spare_parts_price || "",
      labour_charges: call.labour_charges || "",
      remarks: call.remarks || "",
      status: call.status || "Pending",
      invoice_value: call.invoice_value || "",
      payment_status: call.payment_status || "Pending",
      payment_type: call.payment_type || "",
    });
    setStep2ModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer.trim()) return alert("Customer name is required");
    if (!form.mobile_number?.trim()) return alert("Mobile number is required");
    if (!form.email?.trim()) return alert("Email is required");
    if (!form.location_city?.trim()) return alert("Location/City is required");
    if (!form.call_type) return alert("Call type is required");
    if (!form.call_details?.trim()) return alert("Call details are required");
    if (!form.priority) return alert("Priority is required");
    if (!form.call_referrer) return alert("Call referrer is required");
    if (!form.status) return alert("Status is required");

    // Closing a call requires Step 2 to be filled
    if (form.status === "Closed") {
      const hasEngineer = !!(form.engineer);
      const isStep2Completed = form.step2_completed || hasEngineer;
      if (!isStep2Completed) {
        return alert("Cannot close call report without filling out the second form (Step 2: Engineer Details)!");
      }
    }

    const durVal = calculateDuration();
    if (durVal.exceeded && !form.remarks?.trim()) {
      return alert(`Duration exceeded by ${durVal.overflow} min. Please specify the reason in the remarks!`);
    }

    try {
      const payload = {
        ...form,
        status: form.status,
        invoice_value: parseFloat(form.invoice_value) || 0,
        duration_limit: form.duration === "1hr" ? 60 : form.duration === "1.5hr" ? 90 : form.duration === "2hr" ? 120 : 30,
        assigned_time: form.duration === "1hr" ? 60 : form.duration === "1.5hr" ? 90 : form.duration === "2hr" ? 120 : 30,
      };
      if (isEdit && editId) {
        await axios.put(`${API}/api/call-reports/${editId}`, payload, getAuthConfig());
      } else {
        payload.report_date = new Date().toISOString().split("T")[0];
        payload.session_id = form.session_id || `SES-${Date.now()}`;
        payload.call_sequence = form.call_sequence || 1;
        await axios.post(`${API}/api/call-reports`, payload, getAuthConfig());
      }
      setModalOpen(false); resetForm(); fetchCalls();
    } catch (err) { alert("Error: " + (err.response?.data?.error || err.message)); }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!step2Form.engineer) return alert("Engineer is required");

    const payVal = parseFloat(step2Form.invoice_value);
    if (isNaN(payVal) || payVal <= 0) {
      return alert("Pay (invoice value) cannot be 0 or empty!");
    }

    let finalPaymentStatus = step2Form.payment_status;
    let finalStatus = step2Form.status;

    if (finalStatus === "Closed" && finalPaymentStatus !== "Collected") {
      const confirmCollect = window.confirm("Cannot close call unless payment is Collected. Would you like to mark it as Collected now?");
      if (confirmCollect) {
        finalPaymentStatus = "Collected";
        setStep2Form(prev => ({ ...prev, payment_status: "Collected" }));
      } else {
        return;
      }
    }

    if (finalPaymentStatus === "Pending" && finalStatus === "Closed") {
      const confirmStatus = window.confirm("A closed call must have its payment marked as 'Collected'. Do you want to set status back to 'Pending'?");
      if (confirmStatus) {
        finalStatus = "Pending";
        setStep2Form(prev => ({ ...prev, status: "Pending" }));
      } else {
        return;
      }
    }

    const step2Duration = calculateStep2Duration();
    if (step2Duration.exceeded && !step2Form.remarks?.trim()) {
      return alert(`Duration exceeded by ${step2Duration.overflow} min. Please specify the reason why the time was exceeded in the remarks field!`);
    }

    try {
      const durLimit = step2Form.duration === "1hr" ? 60 : step2Form.duration === "1.5hr" ? 90 : step2Form.duration === "2hr" ? 120 : 30;
      const payload = {
        engineer: step2Form.engineer,
        staff_name: step2Form.engineer,
        start_time: step2Form.start_time,
        end_time: step2Form.end_time,
        km: step2Form.km,
        duration_limit: durLimit,
        assigned_time: durLimit,
        petrol_charges: step2Form.petrol_charges,
        spare_parts_price: step2Form.spare_parts_price,
        labour_charges: step2Form.labour_charges,
        remarks: step2Form.remarks,
        status: finalStatus,
        invoice_value: payVal,
        payment_status: finalPaymentStatus,
        payment_type: step2Form.payment_type,
        step2_completed: 1,
      };
      await axios.put(`${API}/api/call-reports/${step2CallId}`, payload, getAuthConfig());
      setStep2ModalOpen(false);
      setStep2CallId(null);
      fetchCalls();
    } catch (err) { alert("Error: " + (err.response?.data?.error || err.message)); }
  };

  const deleteCall = async (id) => {
    if (!window.confirm("Delete this call record?")) return;
    try { await axios.delete(`${API}/api/call-reports/${id}`, getAuthConfig()); fetchCalls(); } catch (err) { alert("Failed to delete"); }
  };

  const downloadCSV = () => {
    if (!filteredCalls.length) return alert("No data to export");
    const headers = [
      "Call ID",
      "Session ID",
      "Call Sequence",
      "Customer Name",
      "Company Name",
      "Mobile Number",
      "Email",
      "Location/City",
      "GST Number",
      "Call Type",
      "Contract Title",
      "Call Details/Complaint",
      "Priority",
      "Call Referrer",
      "Engineer Assigned",
      "Start Time",
      "End Time",
      "Duration Limit (min)",
      "Actual Duration (min)",
      "Duration Exceeded",
      "Kilometers (KM)",
      "Petrol Charges (₹)",
      "Spare Parts Price (₹)",
      "Labour Charges (₹)",
      "Total Expenses (₹)",
      "Payment Type",
      "Invoice Value (₹)",
      "Payment Status",
      "Call Status",
      "Completion Status",
      "Remarks",
      "Created At"
    ];
    const rows = filteredCalls.map(c => {
      const dur = c.actual_duration || 0;
      return [
        c.call_id || `#${c.id}`,
        c.session_id || "—",
        c.call_sequence || 1,
        c.customer || c.client_name || c.customer_name || "—",
        c.company_name || "—",
        c.mobile_number || c.phone || "—",
        c.email || "—",
        c.location_city || c.location || "—",
        c.gst_number || "—",
        c.call_type || "—",
        c.contract_title || "—",
        c.call_details || c.complaint || c.description || "—",
        c.priority || "Medium",
        c.call_referrer || "—",
        c.engineer || c.staff_name || "—",
        c.start_time || "—",
        c.end_time || "—",
        c.duration_limit || c.assigned_time || 30,
        dur,
        c.is_exceeded ? "Yes" : "No",
        c.km !== "" && c.km != null ? c.km : "—",
        c.petrol_charges || 0,
        c.spare_parts_price || 0,
        c.labour_charges || 0,
        c.total_expenses || 0,
        c.payment_type || "—",
        c.invoice_value || 0,
        c.payment_status || "—",
        c.status || "Pending",
        c.step2_completed ? "Complete" : "Basic",
        c.remarks || "—",
        c.created_at || "—"
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `CallReport_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      const matchSearch = !searchTerm || (c.customer_name || c.client_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || (c.call_id || "").includes(searchTerm) || (c.engineer || c.staff_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === "All" || c.status === statusFilter;
      const matchPriority = priorityFilter === "All" || c.priority === priorityFilter;
      const matchEngineer = engineerFilter === "All" || (c.engineer || c.staff_name) === engineerFilter;
      const matchPayment = paymentStatusFilter === "All" || c.payment_status === paymentStatusFilter;
      return matchSearch && matchStatus && matchPriority && matchEngineer && matchPayment;
    }).sort((a, b) => {
      const dateA = new Date(a.report_date || a.created_at || 0);
      const dateB = new Date(b.report_date || b.created_at || 0);
      if (dateB - dateA !== 0) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    });
  }, [calls, searchTerm, statusFilter, priorityFilter, engineerFilter, paymentStatusFilter]);

  const groupedCallsByMonth = useMemo(() => {
    const groups = {};
    filteredCalls.forEach(c => {
      const date = new Date(c.report_date || c.created_at || Date.now());
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!groups[monthKey]) {
        groups[monthKey] = {
          key: monthKey,
          label: monthLabel,
          calls: [],
          totalRevenue: 0,
          totalExpenses: 0,
        };
      }
      groups[monthKey].calls.push(c);
      groups[monthKey].totalRevenue += parseFloat(c.invoice_value) || 0;
      groups[monthKey].totalExpenses += parseFloat(c.total_expenses) || 0;
    });
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [filteredCalls]);

  const stats = useMemo(() => ({
    total: calls.length,
    closed: calls.filter(c => c.status === "Closed").length,
    pending: calls.filter(c => c.status === "Pending").length,
    live: calls.filter(c => c.status === "Live").length,
    observation: calls.filter(c => c.status === "Observation").length,
    exceeded: calls.filter(c => c.is_exceeded).length,
    step2Complete: calls.filter(c => c.step2_completed).length,
    step2Pending: calls.filter(c => !c.step2_completed).length,
    totalValue: calls.reduce((sum, c) => sum + (parseFloat(c.invoice_value) || 0), 0),
    collected: calls.filter(c => c.payment_status === "Collected").reduce((sum, c) => sum + (parseFloat(c.invoice_value) || 0), 0),
  }), [calls]);

  const formatCurrency = (v) => `₹${(parseFloat(v) || 0).toLocaleString()}`;

  const busyEngineers = useMemo(() => {
    return calls
      .filter(c => ["Live", "Pending", "Observation"].includes(c.status) && (c.engineer || c.staff_name))
      .map(c => c.engineer || c.staff_name);
  }, [calls]);

  const getEngineerStatus = (engineerName) => {
    const isBusy = busyEngineers.includes(engineerName);
    const currentCall = calls.find(c => (c.engineer || c.staff_name) === engineerName && ["Live", "Pending", "Observation"].includes(c.status));
    return { isBusy, customerName: currentCall ? (currentCall.customer_name || currentCall.client_name) : null };
  };

  const freeEngineers = useMemo(() => {
    return ENGINEERS.filter(e => !busyEngineers.includes(e.value));
  }, [busyEngineers]);

  const openFollowUpCall = async (c) => {
    const sessionCalls = calls.filter(call => call.session_id === c.session_id);
    const maxSeq = sessionCalls.reduce((max, call) => Math.max(max, call.call_sequence || 1), 0);
    const nextSeq = maxSeq + 1;

    try {
      const payload = {
        customer: c.customer || c.client_name || "",
        customer_id: c.customer_id || null,
        mobile_number: c.mobile_number || c.phone || "",
        email: c.email || "",
        location_city: c.location_city || c.location || "",
        call_type: c.call_type || "AMC",
        contract_title: c.contract_title || "",
        call_details: `Follow-up Call #${nextSeq} under session ${c.session_id}`,
        priority: c.priority || "Medium",
        call_referrer: c.call_referrer || "",
        status: "Pending",
        payment_type: c.payment_type || "",
        invoice_value: 0,
        payment_status: "Pending",
        duration_limit: c.duration_limit || 60,
        assigned_time: c.assigned_time || 60,
        service_type: (c.call_type === "AMC" || c.call_type === "ALC") ? c.call_type : "None",
        report_date: new Date().toISOString().split("T")[0],
        session_id: c.session_id,
        call_sequence: nextSeq
      };

      const res = await axios.post(`${API}/api/call-reports`, payload, getAuthConfig());
      const newCallId = res.data.id;

      // Refresh calls list in the background
      await fetchCalls();

      // Open the Step 2 modal directly for this newly created follow-up call!
      setStep2CallId(newCallId);
      setStep2Form({
        engineer: "",
        start_time: "",
        end_time: "",
        km: "",
        petrol_charges: "",
        spare_parts_price: "",
        labour_charges: "",
        remarks: "",
        status: "Pending",
        invoice_value: "",
      });
      setStep2ModalOpen(true);
    } catch (err) {
      alert("Error creating follow-up call: " + (err.response?.data?.error || err.message));
    }
  };

  const openBasicForm = () => {
    setForm({
      customer: "", customer_id: "", mobile_number: "", email: "", location_city: "", call_details: "",
      priority: "Medium", call_referrer: "", status: "Pending", call_type: "",
      payment_type: "", invoice_value: "", payment_status: "Pending", duration: "", contract_title: "",
      gst_number: "", company_name: "",
      engineer: "", start_time: "", end_time: "", km: "",
      petrol_charges: "", spare_parts_price: "", labour_charges: "", remarks: "",
      session_id: `SES-${Date.now()}`,
      call_sequence: 1,
      step2_completed: 0
    });
    setSelectedContract(null);
    setContractSearchResults([]);
    setModalOpen(true);
    setIsEdit(false);
    setEditId(null);
  };

  const handleInlineUpdate = async (callId, updatedFields) => {
    try {
      const res = await axios.get(`${API}/api/call-reports/${callId}`, getAuthConfig());
      const currentCall = res.data;
      if (!currentCall) return;

      if (updatedFields.status === "Closed") {
        const step2_comp = currentCall.step2_completed;
        const hasEng = !!(currentCall.engineer || currentCall.staff_name);
        if (!step2_comp && !hasEng) {
          alert("Cannot close call report without filling out the second form (Step 2: Engineer Details)!");
          return;
        }
      }

      if (updatedFields.status === "Closed" && (updatedFields.payment_status || currentCall.payment_status) !== "Collected") {
        const confirmCollect = window.confirm("Cannot close call unless payment is Collected. Would you like to mark it as Collected now?");
        if (confirmCollect) {
          updatedFields.payment_status = "Collected";
        } else {
          return;
        }
      }

      if (updatedFields.payment_status === "Pending" && (updatedFields.status || currentCall.status) === "Closed") {
        const confirmStatus = window.confirm("A closed call must have its payment marked as 'Collected'. Do you want to set status back to 'Pending'?");
        if (confirmStatus) {
          updatedFields.status = "Pending";
        } else {
          return;
        }
      }

      const payload = {
        customer: currentCall.customer_name || currentCall.client_name || "",
        customer_id: currentCall.customer_id || null,
        mobile_number: currentCall.mobile_number || currentCall.phone || "",
        email: currentCall.email || "",
        location_city: currentCall.location_city || currentCall.location || "",
        call_details: currentCall.call_details || currentCall.complaint || currentCall.description || "",
        priority: currentCall.priority || "Medium",
        engineer: currentCall.engineer || currentCall.staff_name || "",
        call_referrer: currentCall.call_referrer || "",
        status: currentCall.status || "Pending",
        call_type: currentCall.call_type || "AMC",
        payment_type: currentCall.payment_type || "",
        invoice_value: parseFloat(currentCall.invoice_value) || 0,
        payment_status: currentCall.payment_status || "",
        duration_limit: currentCall.duration_limit || currentCall.assigned_time || 30,
        assigned_time: currentCall.duration_limit || currentCall.assigned_time || 30,
        start_time: currentCall.start_time || null,
        end_time: currentCall.end_time || null,
        km: currentCall.km !== "" && currentCall.km != null ? parseFloat(currentCall.km) : null,
        petrol_charges: parseFloat(currentCall.petrol_charges) || 0,
        spare_parts_price: parseFloat(currentCall.spare_parts_price) || 0,
        labour_charges: parseFloat(currentCall.labour_charges) || 0,
        remarks: currentCall.remarks || "",
        step2_completed: currentCall.step2_completed || 0,
        ...updatedFields
      };

      await axios.put(`${API}/api/call-reports/${callId}`, payload, getAuthConfig());
      fetchCalls();
    } catch (err) {
      alert("Error updating: " + (err.response?.data?.error || err.message));
    }
  };

  const performanceData = useMemo(() => {
    return ENGINEERS.map(eng => {
      const engCalls = calls.filter(c => (c.engineer || c.staff_name) === eng.value && (c.status === "Closed" || c.status === "Completed"));
      const totalCalls = engCalls.length;
      const totalKM = engCalls.reduce((sum, c) => sum + (parseFloat(c.km) || 0), 0);
      const totalPetrol = engCalls.reduce((sum, c) => sum + (parseFloat(c.petrol_charges) || 0), 0);
      const totalMinutes = engCalls.reduce((sum, c) => sum + (c.actual_duration || 0), 0);
      const totalHours = totalMinutes / 60;
      const totalRevenue = engCalls.reduce((sum, c) => sum + (parseFloat(c.invoice_value) || 0), 0);
      const callsPerHour = totalHours > 0 ? (totalCalls / totalHours).toFixed(2) : "0.00";
      return {
        name: eng.label,
        totalCalls,
        totalKM: totalKM.toFixed(1),
        totalPetrol,
        totalHours: totalHours.toFixed(1),
        totalRevenue,
        callsPerHour: parseFloat(callsPerHour),
      };
    }).sort((a, b) => b.callsPerHour - a.callsPerHour);
  }, [calls]);

  const filteredPerformanceData = useMemo(() => {
    if (perfEngineerFilter === "All") return performanceData;
    return performanceData.filter(p => p.name === perfEngineerFilter);
  }, [performanceData, perfEngineerFilter]);

  const downloadPerformanceCSV = () => {
    if (!filteredPerformanceData.length) return alert("No performance data to export");
    const headers = ["Engineer Name", "Total Calls Completed", "Total KM Driven", "Total Petrol Cost (₹)", "Total Time Spent (Hours)", "Total Revenue Generated (₹)", "Calls per Hour (Efficiency)"];
    const rows = filteredPerformanceData.map(p => [
      p.name,
      p.totalCalls,
      p.totalKM,
      p.totalPetrol,
      p.totalHours,
      p.totalRevenue,
      p.callsPerHour
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Engineer_Performance_Report_${perfEngineerFilter.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id: "calls", label: "Calls" },
    { id: "history", label: "History" },
    { id: "engineers", label: "Engineers" },
    { id: "performance", label: "Performance" },
  ];

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="w-full p-2 md:p-4" style={{ background: "hsl(var(--background))" }}>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-primary">Call Report</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Dashboard &gt; Services &gt; Call Report</p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadCSV} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors">
            <Download size={14} /> Export
          </button>
          {canEditDelete && (
            <button onClick={openBasicForm} className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 bg-primary hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg">
              <Plus size={16} /> New Call
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-card rounded-xl border border-border p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab.id ? "shadow-sm" : "hover:bg-muted/50"}`}
            style={{
              background: activeTab === tab.id ? "hsl(var(--primary))" : "transparent",
              color: activeTab === tab.id ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "calls" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
            {[
              { label: "Total Active", value: stats.total, icon: Phone, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.1)" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "hsl(38 92% 50%)", bg: "hsl(38 92% 50% / 0.1)" },
              { label: "Live", value: stats.live, icon: AlertCircle, color: "hsl(217 91% 60%)", bg: "hsl(217 91% 60% / 0.1)" },
              { label: "Observation", value: stats.observation, icon: Activity, color: "hsl(271 81% 56%)", bg: "hsl(271 81% 56% / 0.1)" },
              { label: "Exceeded", value: stats.exceeded, icon: AlertTriangle, color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.1)" },
              { label: "Complete", value: stats.step2Complete, icon: CheckCircle, color: "hsl(var(--accent))", bg: "hsl(var(--accent) / 0.1)" },
              { label: "Basic Only", value: stats.step2Pending, icon: Clock, color: "hsl(38 92% 50%)", bg: "hsl(38 92% 50% / 0.1)" },
              { label: "Total Value", value: formatCurrency(stats.totalValue), icon: DollarSign, color: "hsl(271 81% 56%)", bg: "hsl(271 81% 56% / 0.1)" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-4 border border-border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border bg-muted/50">
                <Search size={16} className="text-muted-foreground" />
                <input type="text" placeholder="Search by customer, call ID, engineer..." className="outline-none text-sm w-full bg-transparent text-foreground" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors">
                <option value="All">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors">
                <option value="All">All Priority</option>
                {PRIORITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={engineerFilter} onChange={e => setEngineerFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors">
                <option value="All">All Engineers</option>
                {ENGINEERS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors">
                <option value="All">All Payments</option>
                {PAYMENT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-700 font-semibold">👆 Double-click any call row to open the details form (Step 2)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                    <th className="px-4 py-3 text-left w-[100px]">ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-center w-[90px]">Status</th>
                    <th className="px-4 py-3 text-center w-[90px]">Type</th>
                    <th className="px-4 py-3 text-center w-[110px]">Completion</th>
                    <th className="px-4 py-3 text-center w-[80px]">Duration</th>
                    <th className="px-4 py-3 text-center w-[90px]">Total</th>
                    <th className="px-4 py-3 text-center w-[90px]">Pay</th>
                    <th className="px-4 py-3 text-center w-[100px]">Pay Status</th>
                    <th className="px-4 py-3 text-center w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="10" className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : filteredCalls.length === 0 ? (
                    <tr><td colSpan="10" className="text-center py-12 text-muted-foreground">No call records found</td></tr>
                  ) : (
                    groupedCallsByMonth.map((group) => {
                      const isCollapsed = collapsedMonths[group.key];
                      const toggleCollapse = () => {
                        setCollapsedMonths(prev => ({
                          ...prev,
                          [group.key]: !prev[group.key]
                        }));
                      };
                      return (
                        <React.Fragment key={group.key}>
                          <tr 
                            onClick={toggleCollapse} 
                            className="bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer border-b border-border select-none"
                          >
                            <td colSpan="10" className="px-4 py-3 font-semibold text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {isCollapsed ? <ChevronDown size={16} className="text-primary" /> : <ChevronUp size={16} className="text-primary" />}
                                  <span className="text-primary font-bold text-base font-display">{group.label}</span>
                                  <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                                    {group.calls.length} {group.calls.length === 1 ? 'Call' : 'Calls'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-6 text-xs text-muted-foreground mr-4">
                                  <span className="font-medium">Total Expenses: <strong className="text-foreground">{formatCurrency(group.totalExpenses)}</strong></span>
                                  <span className="font-medium">Total Revenue: <strong className="text-accent text-sm font-bold">{formatCurrency(group.totalRevenue)}</strong></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {!isCollapsed && group.calls.map((c) => {
                            const sc = STATUS_COLORS[c.status] || STATUS_COLORS.Pending;
                            const pc = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.Medium;
                            const psc = PAYMENT_STATUS_COLORS[c.payment_status] || PAYMENT_STATUS_COLORS.Pending;
                            const dur = c.actual_duration || 0;
                            const isComplete = c.step2_completed;
                            return (
                              <tr
                                key={c.id}
                                className="border-b border-border hover:bg-amber-50/40 transition-colors cursor-pointer select-none"
                                onDoubleClick={() => openStep2Form(c)}
                                title="Double-click to open Step 2 details form"
                              >
                                <td className="px-4 py-3 font-mono font-bold text-xs text-primary">
                                  <div className="text-primary font-black text-sm">Call #{c.call_sequence || 1}</div>
                                  <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">ID: {String(c.id).padStart(3, '0')}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm truncate text-foreground">{c.customer_name || c.client_name || "—"}</p>
                                    {c.status === "Pending" && c.report_date && new Date(c.report_date) < new Date(new Date().toDateString()) && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">Overdue</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] truncate text-muted-foreground">{c.location_city || c.location || ""}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {canEditDelete ? (
                                    <select
                                      value={c.status || "Pending"}
                                      onChange={(e) => handleInlineUpdate(c.id, { status: e.target.value })}
                                      onDoubleClick={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 text-[11px] font-bold rounded-full border outline-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary"
                                      style={{
                                        background: sc.bg,
                                        color: sc.text,
                                        borderColor: sc.border,
                                      }}
                                    >
                                      {STATUS_OPTIONS.map(opt => (
                                        <option key={opt} value={opt} style={{ background: "#ffffff", color: "#1a1a1a" }}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <Badge bg={sc.bg} text={sc.text} border={sc.border}>{c.status || "Pending"}</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-center text-muted-foreground">{c.call_type || "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  {isComplete ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 border border-green-200">
                                        Complete
                                      </span>
                                      {canEditDelete && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openStep2Form(c);
                                          }} 
                                          className="p-1 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors border border-accent/20 hover:scale-105 active:scale-95 flex items-center justify-center"
                                          title="Edit Details"
                                        >
                                          <Edit size={12} className="stroke-[2.5px]" />
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                        Basic
                                      </span>
                                      {canEditDelete && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openStep2Form(c);
                                          }} 
                                          className="p-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20 hover:scale-105 active:scale-95 flex items-center justify-center"
                                          title="Complete Details"
                                        >
                                          <Plus size={12} className="stroke-[3px]" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_exceeded ? "bg-red-100 text-red-700 border border-red-200" : "bg-accent/10 text-accent"}`}>
                                    {dur}m {c.is_exceeded ? `(+${c.actual_duration - (c.duration_limit || c.assigned_time || 30)}m Extra)` : ""}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-center text-foreground">{c.total_expenses !== null && c.total_expenses !== undefined ? formatCurrency(c.total_expenses) : "—"}</td>
                                <td className="px-4 py-3 text-xs font-bold text-center text-foreground">{c.invoice_value !== null && c.invoice_value !== undefined ? formatCurrency(c.invoice_value) : "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  {canEditDelete ? (
                                    <select
                                      value={c.payment_status || "Pending"}
                                      onChange={(e) => handleInlineUpdate(c.id, { payment_status: e.target.value })}
                                      onDoubleClick={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 text-[11px] font-bold rounded-full border outline-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary"
                                      style={{
                                        background: psc.bg,
                                        color: psc.text,
                                        borderColor: psc.border,
                                      }}
                                    >
                                      {PAYMENT_STATUS_OPTIONS.map(opt => (
                                        <option key={opt} value={opt} style={{ background: "#ffffff", color: "#1a1a1a" }}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <Badge bg={psc.bg} text={psc.text} border={psc.border}>{c.payment_status || "Pending"}</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1 justify-center items-center">
                                    <button onClick={() => setDetailCall(c)} className="p-1 rounded hover:bg-primary/10 transition-colors" title="View Details"><Eye size={14} className="text-primary" /></button>

                                    {canEditDelete && (!isComplete || canEditDelete) && <button onClick={() => openStep2Form(c)} className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title={isComplete ? "Edit Details" : "Complete Details"}><CheckCircle size={14} /></button>}
                                    {canEditDelete && <button onClick={() => openEditModal(c)} className="p-1 rounded hover:bg-accent/10 transition-colors" title="Edit"><Edit size={14} className="text-accent" /></button>}
                                    {canEditDelete && <button onClick={() => openFollowUpCall(c)} className="p-1 rounded hover:bg-purple-100 transition-colors text-purple-600" title="Add follow-up call to this session"><Plus size={14} /></button>}
                                    {canEditDelete && <button onClick={() => deleteCall(c.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete"><Trash2 size={14} className="text-destructive" /></button>}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "history" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Completed Calls", value: historyCalls.length, icon: CheckCircle, color: "hsl(var(--accent))", bg: "hsl(var(--accent) / 0.1)" },
              { label: "Total Revenue", value: `₹${historyCalls.reduce((s,c) => s + (parseFloat(c.invoice_value)||0), 0).toLocaleString()}`, icon: DollarSign, color: "hsl(271 81% 56%)", bg: "hsl(271 81% 56% / 0.1)" },
              { label: "Total Expenses", value: `₹${historyCalls.reduce((s,c) => s + (parseFloat(c.total_expenses)||0), 0).toLocaleString()}`, icon: TrendingUp, color: "hsl(217 91% 60%)", bg: "hsl(217 91% 60% / 0.1)" },
              { label: "Collected", value: `₹${historyCalls.filter(c => c.payment_status === "Collected").reduce((s,c) => s + (parseFloat(c.invoice_value)||0), 0).toLocaleString()}`, icon: Phone, color: "hsl(142 71% 45%)", bg: "hsl(142 71% 45% / 0.1)" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-4 border border-border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-border bg-muted/50">
                <Search size={16} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customer..."
                  className="outline-none text-sm w-full bg-transparent text-foreground"
                  value={historySearchInput}
                  onChange={e => setHistorySearchInput(e.target.value)}
                />
              </div>

              <select
                value={historyFilters.dateRangeType}
                onChange={e => setHistoryFilters(p => ({ ...p, dateRangeType: e.target.value }))}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="all">All Dates</option>
                <option value="exact_day">Exact Day</option>
                <option value="last_7">Last 7 Days</option>
                <option value="last_30">Last 30 Days</option>
                <option value="custom">Custom Range</option>
                <option value="month_year">Month & Year</option>
              </select>

              {historyFilters.dateRangeType === "exact_day" && (
                <input
                  type="date"
                  value={historyFilters.exactDate}
                  onChange={e => setHistoryFilters(p => ({ ...p, exactDate: e.target.value }))}
                  className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  title="Select Date"
                />
              )}

              {historyFilters.dateRangeType === "custom" && (
                <>
                  <input
                    type="date"
                    value={historyFilters.from}
                    onChange={e => setHistoryFilters(p => ({ ...p, from: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                    title="From"
                  />
                  <input
                    type="date"
                    value={historyFilters.to}
                    onChange={e => setHistoryFilters(p => ({ ...p, to: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                    title="To"
                  />
                </>
              )}

              {historyFilters.dateRangeType === "month_year" && (
                <>
                  <select
                    value={historyFilters.month}
                    onChange={e => setHistoryFilters(p => ({ ...p, month: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={historyFilters.year}
                    onChange={e => setHistoryFilters(p => ({ ...p, year: e.target.value }))}
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </>
              )}

              <select
                value={historyFilters.engineer}
                onChange={e => setHistoryFilters(p => ({ ...p, engineer: e.target.value }))}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Engineers</option>
                {ENGINEERS.map(e => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleHistorySearchClick}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/95 transition-colors shadow"
              >
                Search
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                    <th className="px-4 py-3 text-left w-[80px]">ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Engineer</th>
                    <th className="px-4 py-3 text-center w-[80px]">Duration</th>
                    <th className="px-4 py-3 text-center w-[90px]">Expenses</th>
                    <th className="px-4 py-3 text-center w-[90px]">Invoice</th>
                    <th className="px-4 py-3 text-center w-[100px]">Pay Status</th>
                    <th className="px-4 py-3 text-center w-[120px]">Completed At</th>
                  </tr>
                </thead>
                <caption className="text-[10px] text-muted-foreground pb-1 caption-bottom">Double-click any row to view full call details</caption>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan="8" className="text-center py-12 text-muted-foreground">Loading...</td></tr>
                  ) : historyCalls.length === 0 ? (
                    <tr><td colSpan="8" className="text-center py-12 text-muted-foreground">No completed calls found</td></tr>
                  ) : (
                    (() => {
                      const groups = {};
                      historyCalls.forEach(c => {
                        const d = new Date(c.report_date || c.completed_at || Date.now());
                        const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                        const ml = d.toLocaleString('default',{month:'long',year:'numeric'});
                        if (!groups[mk]) groups[mk] = { key: mk, label: ml, calls: [], totalRevenue: 0, totalExpenses: 0 };
                        groups[mk].calls.push(c);
                        groups[mk].totalRevenue += parseFloat(c.invoice_value) || 0;
                        groups[mk].totalExpenses += parseFloat(c.total_expenses) || 0;
                      });
                      return Object.values(groups).sort((a,b) => b.key.localeCompare(a.key)).map(group => (
                        <React.Fragment key={group.key}>
                          <tr className="bg-primary/5 hover:bg-primary/10 transition-colors border-b border-border">
                            <td colSpan="8" className="px-4 py-3 font-semibold text-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-primary font-bold text-base font-display">{group.label}</span>
                                  <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">{group.calls.length} calls</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground mr-4">
                                  <span>Expenses: <strong className="text-foreground">{formatCurrency(group.totalExpenses)}</strong></span>
                                  <span>Revenue: <strong className="text-accent">{formatCurrency(group.totalRevenue)}</strong></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {group.calls.map(c => (
                            <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onDoubleClick={() => setDetailCall(c)} title="Double-click to view full details">
                              <td className="px-4 py-3 font-mono text-xs font-bold text-primary">#{String(c.id).padStart(3,'0')}</td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-sm text-foreground">{c.customer_name || c.client_name || "—"}</p>
                                <p className="text-[10px] text-muted-foreground">{c.location_city || ""}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{c.staff_name || c.technician || "—"}</td>
                              <td className="px-4 py-3 text-center text-sm">{c.actual_duration || 0}m</td>
                              <td className="px-4 py-3 text-center text-sm font-medium">{formatCurrency(c.total_expenses)}</td>
                              <td className="px-4 py-3 text-center text-sm font-bold text-accent">{formatCurrency(c.invoice_value)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${c.payment_status === "Collected" ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>{c.payment_status || "Pending"}</span>
                              </td>
                              <td className="px-4 py-3 text-center text-[11px] text-muted-foreground">{c.completed_at ? new Date(c.completed_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : "—"}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ));
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "engineers" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold font-display text-foreground">Engineer Status</h2>
            <p className="text-xs text-muted-foreground">Real-time availability of all engineers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                  <th className="px-4 py-3 text-left">Engineer</th>
                  <th className="px-4 py-3 text-center w-[120px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {ENGINEERS.map((eng) => {
                  const { isBusy } = getEngineerStatus(eng.value);
                  return (
                    <tr key={eng.value} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{eng.label}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold" style={{
                          background: isBusy ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--accent) / 0.1)",
                          color: isBusy ? "hsl(var(--destructive))" : "hsl(var(--accent))",
                        }}>
                          {isBusy ? "On Call" : "Available"}
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

      {activeTab === "performance" && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 p-4 rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Filter by Engineer:</span>
              <select
                value={perfEngineerFilter}
                onChange={(e) => setPerfEngineerFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-1.5 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Engineers</option>
                {ENGINEERS.map(e => (
                  <option key={e.value} value={e.label}>{e.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={downloadPerformanceCSV}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-primary text-white hover:bg-primary/95 transition-colors shadow"
            >
              <Download size={14} /> Download Excel Report
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Calls", value: filteredPerformanceData.reduce((s, p) => s + p.totalCalls, 0), icon: Phone, color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.1)" },
              { label: "Total Revenue", value: formatCurrency(filteredPerformanceData.reduce((s, p) => s + p.totalRevenue, 0)), icon: DollarSign, color: "hsl(var(--accent))", bg: "hsl(var(--accent) / 0.1)" },
              { label: "Total KM", value: filteredPerformanceData.reduce((s, p) => s + parseFloat(p.totalKM), 0).toFixed(1), icon: MapPin, color: "hsl(38 92% 50%)", bg: "hsl(38 92% 50% / 0.1)" },
              { label: "Avg Calls/Hr", value: (filteredPerformanceData.reduce((s, p) => s + p.callsPerHour, 0) / (filteredPerformanceData.length || 1)).toFixed(2), icon: TrendingUp, color: "hsl(271 81% 56%)", bg: "hsl(271 81% 56% / 0.1)" },
            ].map((s, i) => (
              <div key={i} className="rounded-xl p-4 border border-border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: s.bg }}>
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold font-display text-foreground">{s.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground">Calls per Engineer</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="totalCalls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign size={18} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Revenue per Engineer (₹)</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} contentStyle={tooltipStyle} />
                  <Bar dataKey="totalRevenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-purple-500" />
                <h3 className="text-sm font-bold text-foreground">Calls/Hour Performance Trend</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={filteredPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="callsPerHour" stroke="hsl(271 81% 56%)" fill="hsl(271 81% 56%)" fillOpacity={0.15} name="Calls/Hour" strokeWidth={2} />
                  <Line type="monotone" dataKey="callsPerHour" stroke="hsl(271 81% 56%)" strokeWidth={2} dot={{ r: 4 }} name="Calls/Hour" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={18} className="text-amber-600" />
                <h3 className="text-sm font-bold text-foreground">KM Driven per Engineer</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v) => `${v} km`} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="totalKM" stroke="hsl(38 92% 50%)" strokeWidth={3} dot={{ r: 5, fill: "hsl(38 92% 50%)" }} name="KM" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <PieChartIcon size={18} className="text-destructive" />
                <h3 className="text-sm font-bold text-foreground">Petrol Cost Distribution</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={filteredPerformanceData.filter(p => p.totalPetrol > 0)} dataKey="totalPetrol" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {filteredPerformanceData.filter(p => p.totalPetrol > 0).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-foreground">Time Spent (Hours)</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={filteredPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-45} textAnchor="end" height={80} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(v) => `${v} hrs`} contentStyle={tooltipStyle} />
                  <Bar dataKey="totalHours" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Engineer Efficiency Score</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={filteredPerformanceData.slice(0, 8)}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <PolarRadiusAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar name="Calls/Hour" dataKey="callsPerHour" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} strokeWidth={2} />
                  <Tooltip contentStyle={tooltipStyle} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-bold font-display text-foreground">Detailed Performance Table</h2>
              <p className="text-xs text-muted-foreground">Sorted by Calls/Hour metric (best performance first)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                    <th className="px-4 py-3 text-left">Engineer</th>
                    <th className="px-4 py-3 text-center w-[80px]">Calls</th>
                    <th className="px-4 py-3 text-center w-[80px]">Total KM</th>
                    <th className="px-4 py-3 text-center w-[100px]">Petrol (₹)</th>
                    <th className="px-4 py-3 text-center w-[80px]">Time (hrs)</th>
                    <th className="px-4 py-3 text-center w-[100px]">Revenue (₹)</th>
                    <th className="px-4 py-3 text-center w-[100px]">Calls/Hour</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPerformanceData.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-12 text-muted-foreground">No performance data available</td></tr>
                  ) : (
                    filteredPerformanceData.map((p, idx) => (
                      <tr key={p.name} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-yellow-400 text-yellow-900" : idx === 1 ? "bg-gray-300 text-gray-700" : idx === 2 ? "bg-orange-300 text-orange-900" : "bg-muted text-muted-foreground"}`}>
                              {idx + 1}
                            </span>
                            {p.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{p.totalCalls}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{p.totalKM}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{formatCurrency(p.totalPetrol)}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{p.totalHours}</td>
                        <td className="px-4 py-3 text-center font-bold text-accent">{formatCurrency(p.totalRevenue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 rounded-full text-xs font-bold" style={{
                            background: p.callsPerHour >= 1 ? "hsl(var(--accent) / 0.1)" : p.callsPerHour >= 0.5 ? "hsl(38 92% 50% / 0.1)" : "hsl(var(--destructive) / 0.1)",
                            color: p.callsPerHour >= 1 ? "hsl(var(--accent))" : p.callsPerHour >= 0.5 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))",
                          }}>
                            {p.callsPerHour}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {detailCall && <DetailModal call={detailCall} onClose={() => setDetailCall(null)} formatCurrency={formatCurrency} />}

      {/* Unified Call Report Modal — only for editors */}
      {canEditDelete && modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center overflow-y-auto pt-4 pb-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-[95%] max-w-4xl shadow-2xl my-4 relative border border-border animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEdit ? "bg-accent/10" : "bg-primary/10"}`}>
                  {isEdit ? <Edit size={18} className="text-accent" /> : <Plus size={18} className="text-primary" />}
                </div>
                <h2 className="text-base sm:text-lg font-bold font-display text-foreground">
                  {isEdit ? "Edit Call Record" : "New Call Record"}
                </h2>
              </div>
              <X className="cursor-pointer hover:text-destructive transition-colors text-muted-foreground p-1 rounded hover:bg-destructive/10" onClick={() => { setModalOpen(false); resetForm(); }} />
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
              <SectionDivider icon={User} title="Customer Details" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormField label="Customer Name" required>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={form.customer || ""} 
                        onChange={(e) => {
                          setForm({ ...form, customer: e.target.value, customer_id: "", contract_title: "" });
                          setSelectedContract(null);
                          if (e.target.value.length >= 2) {
                            searchCustomers(e.target.value);
                          } else if (e.target.value.length === 0) {
                            setCustomerSearchResults([]);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && customerSearchResults.length > 0) {
                            const firstCustomer = customerSearchResults[0];
                            setForm({ 
                              ...form, 
                              customer: firstCustomer.value,
                              customer_id: firstCustomer.customer_id || "",
                              contract_title: "",
                              mobile_number: firstCustomer.mobile_number || "",
                              email: firstCustomer.email || "",
                              location_city: firstCustomer.location_city || "",
                              gst_number: firstCustomer.gst_number || "",
                              company_name: firstCustomer.company_name || ""
                            });
                            setCustomerSearchResults([]);
                          }
                        }}
                        onFocus={() => {
                          if (form.customer.length === 0) {
                            searchCustomers("");
                          }
                        }}
                        placeholder="Search customer (type and press Enter)..."
                        className={inputBase}
                      />
                      {customerSearchResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 overflow-hidden border border-border rounded-lg bg-white shadow-lg">
                          {customerSearchResults.map((customer, idx) => (
                            <div 
                              key={idx} 
                              className="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 text-foreground"
                              onClick={() => {
                                setForm({ 
                                  ...form, 
                                  customer: customer.value,
                                  customer_id: customer.customer_id || "",
                                  contract_title: "",
                                  mobile_number: customer.mobile_number || "",
                                  email: customer.email || "",
                                  location_city: customer.location_city || "",
                                  gst_number: customer.gst_number || "",
                                  company_name: customer.company_name || ""
                                });
                                setCustomerSearchResults([]);
                              }}
                            >
                              {customer.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>
                <FormField label="Mobile Number" icon={PhoneIcon} required>
                  <input type="tel" value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} className={inputBase} placeholder="Auto-filled or manual" required />
                </FormField>
                <FormField label="Email" icon={Mail} required>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputBase} placeholder="Auto-filled or manual" required />
                </FormField>
                <FormField label="Location/City" icon={MapPin} required>
                  <input type="text" value={form.location_city} onChange={e => setForm({ ...form, location_city: e.target.value })} className={inputBase} placeholder="Auto-filled or manual" required />
                </FormField>
                <FormField label="Company Name" icon={FileText}>
                  <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className={inputBase} placeholder="Auto-filled or manual" />
                </FormField>
                <FormField label="GST Number" icon={FileText}>
                  <input type="text" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} className={inputBase} placeholder="Auto-filled or manual" />
                </FormField>
                <FormField label="Call Type" icon={Tag} required>
                  <SearchableSelect options={CALL_TYPE_OPTIONS} value={form.call_type} onChange={handleCallTypeChange} placeholder="Select Call Type" />
                </FormField>
              </div>
              {(form.call_type === "AMC" || form.call_type === "ALC") && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormField label={`${form.call_type} Contract (Auto-fill)`} icon={FileText}>
                    <SearchableSelect 
                      options={contractSearchResults} 
                      value={form.contract_title} 
                      onChange={handleContractSelect} 
                      placeholder={`Select ${form.call_type} contract...`} 
                      onSearch={(q) => searchContracts(form.call_type, q)}
                      loading={contractLoading} 
                    />
                  </FormField>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormField label="Call Details" icon={MessageSquare} required>
                    <textarea value={form.call_details} onChange={e => setForm({ ...form, call_details: e.target.value })} className={`${inputBase} resize-none`} placeholder="Describe the issue or service performed" rows={2} required />
                  </FormField>
                </div>
                <FormField label="Priority" icon={AlertTriangle} required>
                  <SearchableSelect options={PRIORITY_OPTIONS} value={form.priority} onChange={v => setForm({ ...form, priority: v })} placeholder="Select Priority" />
                </FormField>
                <FormField label="Engineer" icon={User}>
                  <SearchableSelect options={ENGINEERS} value={form.engineer} onChange={v => setForm({ ...form, engineer: v })} placeholder="Select Engineer" />
                </FormField>
                <FormField label="Call Referrer" icon={Phone} required>
                  <SearchableSelect options={CALL_REFERRERS} value={form.call_referrer} onChange={v => setForm({ ...form, call_referrer: v })} placeholder="Select Referrer" />
                </FormField>
                <FormField label="Status" required icon={CheckCircle}>
                  <SearchableSelect options={STATUS_OPTIONS} value={form.status} onChange={v => setForm({ ...form, status: v })} placeholder="Select Status" />
                </FormField>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <button type="submit" className="flex-1 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all hover:opacity-90 active:scale-[0.98] shadow-md">
                  {isEdit ? "Update Call" : "Save Call"}
                </button>
                <button type="button" onClick={() => { setModalOpen(false); resetForm(); }} className="px-6 py-3 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all active:scale-[0.98]">Cancel</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 - Detail Form */}
      {step2ModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center overflow-y-auto pt-4 pb-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-[95%] max-w-3xl shadow-2xl my-4 relative border border-border animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10">
                  <Clock size={18} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-display text-foreground">
                    Call #{calls.find(c => c.id === step2CallId)?.call_sequence || 1} ID: {String(step2CallId).padStart(3, '0')}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Step 2: Engineer assignment & expenses</p>
                </div>
              </div>
              <X className="cursor-pointer hover:text-destructive transition-colors text-muted-foreground p-1 rounded hover:bg-destructive/10" onClick={() => { setStep2ModalOpen(false); }} />
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
            <form onSubmit={handleStep2Submit} className="p-4 sm:p-6 space-y-5">
              <div className="p-3 sm:p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                {(() => {
                  const call = calls.find(c => c.id === step2CallId);
                  if (!call) return null;
                  const sc = STATUS_COLORS[call.status] || STATUS_COLORS.Pending;
                  const pc = PRIORITY_COLORS[call.priority] || PRIORITY_COLORS.Medium;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-primary">Customer Details</h3>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{call.status}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>{call.priority}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Customer</p>
                          <p className="font-semibold text-xs sm:text-sm truncate text-foreground">{call.customer_name || call.client_name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Mobile</p>
                          <p className="font-semibold text-xs sm:text-sm text-foreground">{call.mobile_number || call.phone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Location</p>
                          <p className="font-semibold text-xs sm:text-sm text-foreground">{call.location_city || call.location || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Call Type</p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{call.call_type || "—"}</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Invoice</p>
                          <p className="font-semibold text-xs sm:text-sm text-accent">{formatCurrency(call.invoice_value)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Email</p>
                          <p className="font-semibold text-xs sm:text-sm text-foreground truncate">{call.email || "—"}</p>
                        </div>
                      </div>
                      {(call.call_details || call.complaint || call.description) && (
                        <div className="mt-3 pt-3 border-t border-primary/20">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Call Details / Complaint</p>
                          <p className="text-xs sm:text-sm mt-1 text-muted-foreground">{call.call_details || call.complaint || call.description}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <SectionDivider icon={Users} title="Engineer Assignment" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormField label="Engineer" required icon={User}>
                    <select value={step2Form.engineer} onChange={e => setStep2Form({ ...step2Form, engineer: e.target.value })} className={inputBase} required>
                      <option value="">Select engineer</option>
                      {ENGINEERS.map(e => {
                        const isBusy = busyEngineers.includes(e.value);
                        return (
                          <option key={e.value} value={e.value} disabled={isBusy}>
                            {e.label} {isBusy ? "(On Call)" : "(Free)"}
                          </option>
                        );
                      })}
                    </select>
                  </FormField>
                  {freeEngineers.length > 0 && (
                    <p className="text-[10px] mt-1 flex items-center gap-1 text-accent">
                      <CheckCircle size={10} /> {freeEngineers.length} engineer(s) available
                    </p>
                  )}
                  {busyEngineers.length > 0 && (
                    <p className="text-[10px] mt-1 flex items-center gap-1 text-destructive">
                      <AlertCircle size={10} /> {busyEngineers.length} engineer(s) currently on call
                    </p>
                  )}
                </div>
                <FormField label="Status" icon={CheckCircle}>
                  <SearchableSelect options={STATUS_OPTIONS} value={step2Form.status} onChange={v => setStep2Form({ ...step2Form, status: v })} placeholder="Select Status" />
                </FormField>
              </div>

              <SectionDivider icon={Clock} title="Time & Travel" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField label="Start Time">
                  <input type="time" value={step2Form.start_time} onChange={e => setStep2Form({ ...step2Form, start_time: e.target.value })} className={inputBase} />
                </FormField>
                <FormField label="End Time">
                  <input type="time" value={step2Form.end_time} onChange={e => setStep2Form({ ...step2Form, end_time: e.target.value })} className={inputBase} />
                </FormField>
                <FormField label="Kilometers (KM)" icon={MapPin}>
                  <input type="number" value={step2Form.km} onChange={e => setStep2Form({ ...step2Form, km: e.target.value })} className={inputBase} placeholder="0" min="0" step="0.1" />
                </FormField>
                <FormField label="Duration Limit">
                  <select value={step2Form.duration || ""} onChange={e => setStep2Form({ ...step2Form, duration: e.target.value })} className={inputBase}>
                    <option value="">30 min (default)</option>
                    <option value="1hr">1 Hour</option>
                    <option value="1.5hr">1.5 Hours</option>
                    <option value="2hr">2 Hours</option>
                  </select>
                </FormField>
                {step2Duration.actual > 0 && (
                  <div className={`p-3 rounded-lg border flex flex-col justify-center sm:col-span-2 lg:col-span-4 ${step2Duration.exceeded ? "bg-red-50 border-red-200 text-red-700" : "bg-accent/5 border-accent/20"}`}>
                    <span className={`text-xs font-semibold ${step2Duration.exceeded ? "text-red-600" : "text-accent"}`}>Actual Duration: {step2Duration.actual} min</span>
                    <span className="text-[10px] text-muted-foreground">Assigned Limit: {step2Duration.limit} min</span>
                    {step2Duration.exceeded && (
                      <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-1">
                        <AlertTriangle size={10} /> Overflow: Exceeded by {step2Duration.overflow} min!
                      </span>
                    )}
                  </div>
                )}
              </div>

              <SectionDivider icon={DollarSign} title="Expenses & Billing" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Petrol (₹)">
                  <input type="number" value={step2Form.petrol_charges} onChange={e => setStep2Form({ ...step2Form, petrol_charges: e.target.value })} className={inputBase} placeholder="0.00" min="0" step="0.01" />
                </FormField>
                <FormField label="Spare Parts (₹)">
                  <input type="number" value={step2Form.spare_parts_price} onChange={e => setStep2Form({ ...step2Form, spare_parts_price: e.target.value })} className={inputBase} placeholder="0.00" min="0" step="0.01" />
                </FormField>
                <FormField label="Labour Charges (₹)">
                  <input type="number" value={step2Form.labour_charges} onChange={e => setStep2Form({ ...step2Form, labour_charges: e.target.value })} className={inputBase} placeholder="0.00" min="0" step="0.01" />
                </FormField>
                <FormField label="Invoice Value (₹)" icon={DollarSign}>
                  <input type="number" value={step2Form.invoice_value} onChange={e => setStep2Form({ ...step2Form, invoice_value: e.target.value })} className={inputBase} placeholder="0.00" min="0" step="0.01" />
                </FormField>
                <FormField label="Payment Type" icon={CreditCard} required>
                  <SearchableSelect options={PAYMENT_TYPE_OPTIONS} value={step2Form.payment_type} onChange={v => setStep2Form({ ...step2Form, payment_type: v })} placeholder="Select Payment Type" />
                </FormField>
                <FormField label="Payment Status" icon={CheckCircle} required>
                  <SearchableSelect options={PAYMENT_STATUS_OPTIONS} value={step2Form.payment_status} onChange={v => setStep2Form({ ...step2Form, payment_status: v })} placeholder="Select Payment Status" />
                </FormField>
              </div>

              <FormField 
                label={step2Duration.exceeded ? "Why was the time exceeded? (Remarks Required)*" : "Remarks"} 
                icon={MessageSquare}
                required={step2Duration.exceeded}
              >
                <textarea 
                  value={step2Form.remarks} 
                  onChange={e => setStep2Form({ ...step2Form, remarks: e.target.value })} 
                  className={`${inputBase} resize-none ${step2Duration.exceeded ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/10" : ""}`} 
                  placeholder={step2Duration.exceeded ? "Please explain why the service time exceeded the limit..." : "Additional notes"} 
                  rows={2} 
                  required={step2Duration.exceeded}
                />
              </FormField>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                <button type="submit" className="flex-1 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all hover:opacity-90 active:scale-[0.98] shadow-md">Save Details</button>
                <button type="button" onClick={() => { setStep2ModalOpen(false); }} className="px-6 py-3 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all active:scale-[0.98]">Cancel</button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallReport;
