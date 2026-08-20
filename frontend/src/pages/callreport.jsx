import React, { useState, useEffect, useCallback, useMemo } from "react";
import "../Styles/tailwind.css";
import {
  Search,
  Plus,
  X,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Phone,
  CreditCard,
  DollarSign,
  AlertTriangle,
  MapPin,
  Phone as PhoneIcon,
  FileText,
  Calendar,
  DollarSign as DollarIcon,
  User,
  Tag,
  MessageSquare,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Mail,
  Wrench,
} from "lucide-react";
import axios from "axios";
import socket from "../socket/socket";
import { API } from "../config";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const PIE_COLORS = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16",
];

const getAuthConfig = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const getUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}").role || "employee";
  } catch {
    return "employee";
  }
};

// Call Report permission: admin role OR malarvannan/priyanka by name
const CALL_REPORT_EDITOR_NAMES = ["malarvannan", "priyanka"];
const getCanEditCallReport = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const role = user.role || "employee";
    const name = (user.name || "").trim().toLowerCase();
    return role === "admin" || CALL_REPORT_EDITOR_NAMES.includes(name);
  } catch {
    return false;
  }
};

const getEngineerForCurrentUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName = (user.name || "").trim().toLowerCase();
    if (!userName) return "";
    const match = ENGINEERS.find((eng) =>
      eng.value.toLowerCase().startsWith(userName),
    );
    return match ? match.value : "";
  } catch {
    return "";
  }
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
  "Krishna kumar",
  "Jai sankar",
  "Uma",
  "Malar vannan",
  "Vimal",
  "Moorthi",
  "Priyanka",
  "Thanapalan",
  "Princee",
  "Walkin",
];

const STATUS_OPTIONS = ["Closed", "Pending", "Live", "Observation"];
const CALL_TYPE_OPTIONS = [
  "AMC",
  "ALC",
  "Warranty",
  "New Installation",
  "Repeated",
  "Delivery Calls",
  "Project Work",
];
const PRIORITY_OPTIONS = ["Critical", "High", "Medium"];
const PAYMENT_TYPE_OPTIONS = ["Cash", "Card", "Credit", "Cheque", "UPI"];
const PAYMENT_STATUS_OPTIONS = ["Collected", "Pending"];
const DELIVERY_CALL_TYPE_OPTIONS = ["Delivery Calls", "Project Work"];
// Call types that can be closed without requiring payment collection
const PAYMENT_FREE_TYPES = ["Delivery Calls", "Project Work"];

const STATUS_COLORS = {
  Closed: {
    bg: "hsl(142 71% 45% / 0.1)",
    text: "hsl(142 71% 45%)",
    border: "hsl(142 71% 45% / 0.2)",
  },
  Pending: {
    bg: "hsl(38 92% 50% / 0.1)",
    text: "hsl(38 92% 50%)",
    border: "hsl(38 92% 50% / 0.2)",
  },
  Live: {
    bg: "hsl(217 91% 60% / 0.1)",
    text: "hsl(217 91% 60%)",
    border: "hsl(217 91% 60% / 0.2)",
  },
  Observation: {
    bg: "hsl(271 81% 56% / 0.1)",
    text: "hsl(271 81% 56%)",
    border: "hsl(271 81% 56% / 0.2)",
  },
};

const PRIORITY_COLORS = {
  Critical: {
    bg: "hsl(0 72% 51% / 0.1)",
    text: "hsl(0 72% 51%)",
    border: "hsl(0 72% 51% / 0.2)",
  },
  High: {
    bg: "hsl(24 94% 50% / 0.1)",
    text: "hsl(24 94% 50%)",
    border: "hsl(24 94% 50% / 0.2)",
  },
  Medium: {
    bg: "hsl(210 40% 96%)",
    text: "hsl(215 16% 47%)",
    border: "hsl(214 32% 91%)",
  },
};

const PAYMENT_STATUS_COLORS = {
  Collected: {
    bg: "hsl(142 71% 45% / 0.1)",
    text: "hsl(142 71% 45%)",
    border: "hsl(142 71% 45% / 0.2)",
  },
  Pending: {
    bg: "hsl(0 72% 51% / 0.1)",
    text: "hsl(0 72% 51%)",
    border: "hsl(0 72% 51% / 0.2)",
  },
};

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  label,
  onSearch,
  loading,
  disabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchTimeoutRef = React.useRef(null);

  const filtered = onSearch
    ? options
    : options.filter((opt) => {
      const val = typeof opt === "string" ? opt : opt.value;
      return val.toLowerCase().includes(search.toLowerCase());
    });

  const selectedLabel = options.find((opt) => {
    const val = typeof opt === "string" ? opt : opt.value;
    return val === value;
  });

  const displayValue = selectedLabel
    ? typeof selectedLabel === "string"
      ? selectedLabel
      : selectedLabel.label
    : value;

  const handleSearchChange = (val) => {
    setSearch(val);
    if (onSearch && isOpen) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(val);
      }, 300);
    }
  };

  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  return (
    <div className="relative">
      {label && (
        <label
          className="text-xs font-medium mb-1.5 block"
          style={{ color: "var(--color-slate, #5d5b54)" }}
        >
          {label}
        </label>
      )}
      <div
        className={`flex items-center justify-between px-3 py-2 transition-all duration-150 ${disabled ? "cursor-not-allowed opacity-60 bg-gray-50" : "cursor-pointer bg-white"}`}
        style={{
          color: "var(--color-ink, #1a1a1a)",
          border: `1px solid ${isOpen && !disabled ? "var(--color-primary, #5645d4)" : "var(--color-hairline-strong, #c8c4be)"}`,
          borderRadius: "var(--radius-md, 8px)",
          boxShadow:
            isOpen && !disabled ? "0 0 0 2px rgba(86, 69, 212, 0.2)" : "none",
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearch("");
            if (onSearch && !isOpen) onSearch("");
          }
        }}
      >
        <span
          className="text-sm truncate"
          style={{
            color: value
              ? "var(--color-ink, #1a1a1a)"
              : "var(--color-muted, #bbb8b1)",
          }}
        >
          {displayValue || placeholder}
        </span>
        {isOpen && !disabled ? (
          <ChevronUp
            size={14}
            style={{ color: "var(--color-steel, #787671)" }}
          />
        ) : (
          <ChevronDown
            size={14}
            style={{ color: "var(--color-steel, #787671)" }}
          />
        )}
      </div>
      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 overflow-hidden animate-scale-in"
          style={{
            backgroundColor: "var(--color-canvas, #ffffff)",
            border: "1px solid var(--color-hairline, #e5e3df)",
            borderRadius: "var(--radius-md, 8px)",
            boxShadow: "var(--shadow-level-2, 0 4px 12px rgba(15,15,15,0.08))",
          }}
        >
          {onSearch && (
            <div
              className="p-2"
              style={{
                borderBottom: "1px solid var(--color-hairline, #e5e3df)",
              }}
            >
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Type to search..."
                className="w-full outline-none text-sm bg-transparent"
                style={{ color: "var(--color-ink, #1a1a1a)" }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div
                className="px-3 py-2 text-xs"
                style={{ color: "var(--color-steel, #787671)" }}
              >
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div
                className="px-3 py-2 text-xs"
                style={{ color: "var(--color-steel, #787671)" }}
              >
                {onSearch ? "Type to search..." : "No results"}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const val = typeof opt === "string" ? opt : opt.value;
                const lbl = typeof opt === "string" ? opt : opt.label;
                return (
                  <div
                    key={idx}
                    className="px-3 py-2 text-sm cursor-pointer transition-colors"
                    style={{
                      backgroundColor:
                        value === val
                          ? "rgba(86, 69, 212, 0.1)"
                          : "var(--color-surface, #f6f5f4)",
                      color:
                        value === val
                          ? "var(--color-primary, #5645d4)"
                          : "var(--color-ink, #1a1a1a)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(val);
                      setIsOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (value !== val)
                        e.target.style.backgroundColor =
                          "var(--color-surface, #f6f5f4)";
                    }}
                    onMouseLeave={(e) => {
                      if (value !== val)
                        e.target.style.backgroundColor =
                          "var(--color-surface, #f6f5f4)";
                    }}
                  >
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
      <label
        className="flex items-center gap-1.5 text-xs font-medium"
        style={{ color: "var(--color-slate, #5d5b54)", marginBottom: "6px" }}
      >
        {icon && (
          <icon size={14} style={{ color: "var(--color-primary, #5645d4)" }} />
        )}
        {label}
        {required && (
          <span style={{ color: "var(--color-error, #e03131)" }}>*</span>
        )}
      </label>
    )}
    <div style={{ marginTop: "6px" }}>{children}</div>
  </div>
);

const inputBase =
  "w-full p-2.5 text-sm outline-none transition-all duration-150 bg-white text-gray-900 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm";

const SectionDivider = ({ icon: Icon, title }) => (
  <div
    className="flex items-center gap-2 py-2"
    style={{ borderBottom: "1px solid var(--color-hairline, #e5e3df)" }}
  >
    {Icon && (
      <Icon size={14} style={{ color: "var(--color-primary, #5645d4)" }} />
    )}
    <h3
      className="text-xs font-semibold uppercase tracking-wide"
      style={{ color: "var(--color-primary, #5645d4)" }}
    >
      {title}
    </h3>
  </div>
);

const Badge = ({ children, bg, text, border }) => (
  <span
    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
    style={{ background: bg, color: text, border: `1px solid ${border}` }}
  >
    {children}
  </span>
);

// Parse any date value into a LOCAL Date object — never UTC-shifts the calendar date.
// Handles: "2026-06-25", "2026-06-25T00:00:00.000Z", "2026-06-25 18:00:00", ISO with offset, etc.
const parseLocalDate = (dateVal) => {
  if (!dateVal) return null;
  try {
    const str = String(dateVal).trim();
    // Always extract just the YYYY-MM-DD prefix and build local midnight
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]); // 1-12
      const d = Number(match[3]);
      return new Date(y, m - 1, d); // local midnight, NO UTC conversion
    }
    return new Date(str);
  } catch (e) {
    return null;
  }
};

const safeFormatDate = (dateVal) => {
  if (!dateVal) return "—";
  const d = parseLocalDate(dateVal);
  if (!d || isNaN(d)) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Convert "HH:MM" (24h) → "h:MM AM/PM"
const to12h = (time24) => {
  if (!time24) return "—";
  const str = String(time24).trim();
  // strip any date prefix like "2026-06-30 21:50"
  const timePart = str.includes(" ") ? str.split(" ").pop() : str;
  if (!/^\d{1,2}:\d{2}/.test(timePart)) return timePart;
  const [h, m] = timePart.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const formatTimeOnly = (timeVal) => to12h(timeVal);

const parseTime24To12 = (time24) => {
  if (!time24) return { hour12: 12, minute: 0, period: "AM" };
  const str = String(time24).trim();
  const timePart = str.includes(" ") ? str.split(" ").pop() : str;
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return { hour12: 12, minute: 0, period: "AM" };
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) || 0;
  const period = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: m, period };
};

const formatTime12To24 = (hour12, minute, period) => {
  let h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const TimePicker12h = ({ value, onChange, disabled }) => {
  const display12h = value ? to12h(value) : "";

  return (
    <div className="relative w-full">
      <input
        type="time"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${inputBase} ${disabled ? "opacity-60 bg-gray-50 cursor-not-allowed" : ""} pr-16`}
        style={{ scrollbarWidth: "thin" }}
      />
      {value && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none bg-white px-1.5 py-0.5 rounded-md border border-indigo-100">
          {display12h}
        </span>
      )}
    </div>
  );
};

// Format a full datetime for display: "DD Mon YYYY at h:MM AM/PM"
const formatDateTime = (dateVal, timeVal) => {
  const datePart = safeFormatDate(dateVal);
  if (timeVal) return `${datePart} at ${to12h(timeVal)}`;
  return datePart;
};

// Get local today string as YYYY-MM-DD
const getLocalToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Get current local time as HH:MM
const getLocalNow = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const DetailModal = ({ call, onClose, formatCurrency }) => {
  if (!call) return null;
  const sc = STATUS_COLORS[call.status] || STATUS_COLORS.Pending;
  const pc = PRIORITY_COLORS[call.priority] || PRIORITY_COLORS.Medium;
  const psc =
    PAYMENT_STATUS_COLORS[call.payment_status] || PAYMENT_STATUS_COLORS.Pending;

  const DetailItem = ({
    icon: Icon,
    label,
    value,
    valueColor,
    badge,
    badgeBg,
    badgeText,
    badgeBorder,
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors">
      {Icon && <Icon size={15} className="text-primary mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {badge ? (
          <span
            className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{
              background: badgeBg,
              color: badgeText,
              border: `1px solid ${badgeBorder}`,
            }}
          >
            {value || "—"}
          </span>
        ) : (
          <p
            className="text-sm font-semibold mt-0.5 truncate"
            style={{ color: valueColor || "hsl(var(--foreground))" }}
          >
            {value || "—"}
          </p>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ title, color = "text-primary" }) => (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-border`}>
      <h3 className={`text-xs font-black uppercase tracking-widest ${color}`}>
        {title}
      </h3>
    </div>
  );

  const totalExpenses =
    (parseFloat(call.petrol_charges) || 0) +
    (parseFloat(call.spare_parts_price) || 0) +
    (parseFloat(call.labour_charges) || 0) +
    (parseFloat(call.delivery_project_work) || 0);
  const displayTotal = call.total_expenses || totalExpenses;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl border border-border animate-scale-in mb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex justify-between items-center z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black font-display text-foreground">
                Call Report Details
              </h2>
              <p className="text-[11px] font-mono text-primary">
                Call #{call.call_sequence || 1} &nbsp;·&nbsp; ID:{" "}
                {String(call.id).padStart(3, "0")} &nbsp;·&nbsp;
                {safeFormatDate(call.report_date || call.created_at)}
                {call.scheduled_time ? ` at ${to12h(call.scheduled_time)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                background: sc.bg,
                color: sc.text,
                borderColor: sc.border,
              }}
            >
              {call.status || "Pending"}
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold border"
              style={{
                background: pc.bg,
                color: pc.text,
                borderColor: pc.border,
              }}
            >
              {call.priority || "Medium"}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ── FORM 1: Customer Details ── */}
          <div className="rounded-xl border border-primary/20 bg-primary/3 p-4">
            <SectionHeader title="① Customer Details (Form 1)" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem
                icon={User}
                label="Customer Name"
                value={call.customer_name || call.client_name || call.name}
              />
              <DetailItem
                icon={PhoneIcon}
                label="Mobile Number"
                value={call.mobile_number || call.phone}
              />
              <DetailItem icon={Mail} label="Email" value={call.email} />
              <DetailItem
                icon={MapPin}
                label="Location / City"
                value={call.location_city || call.location}
              />
              <DetailItem
                icon={FileText}
                label="Company Name"
                value={call.company_name}
              />
              <DetailItem
                icon={FileText}
                label="GST Number"
                value={call.gst_number}
              />
            </div>
          </div>

          {/* ── FORM 1: Call Classification ── */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <SectionHeader
              title="① Call Classification (Form 1)"
              color="text-amber-700"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem icon={Tag} label="Call Type" value={call.call_type} />
              <DetailItem
                icon={Tag}
                label="Contract Title"
                value={call.contract_title}
              />
              <DetailItem
                icon={Phone}
                label="Call Referrer"
                value={call.call_referrer}
              />
              <DetailItem
                icon={Tag}
                label="Priority"
                value={call.priority}
                badge
                badgeBg={pc.bg}
                badgeText={pc.text}
                badgeBorder={pc.border}
              />
              <DetailItem
                icon={CheckCircle}
                label="Status"
                value={call.status}
                badge
                badgeBg={sc.bg}
                badgeText={sc.text}
                badgeBorder={sc.border}
              />
              <DetailItem
                icon={Calendar}
                label="Scheduled Date"
                value={safeFormatDate(call.report_date || call.created_at)}
              />
              {call.scheduled_time && (
                <DetailItem
                  icon={Clock}
                  label="Scheduled Time"
                  value={to12h(call.scheduled_time)}
                />
              )}
            </div>
            {(call.call_details || call.complaint || call.description) && (
              <div className="mt-3 p-3 rounded-lg bg-white border border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">
                  Call Details / Issue Description
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {call.call_details || call.complaint || call.description}
                </p>
              </div>
            )}
          </div>

          {/* ── FORM 2: Engineer Assignment ── */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <SectionHeader
              title="② Engineer Assignment (Form 2)"
              color="text-blue-700"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <DetailItem
                icon={User}
                label="Engineer / Technician"
                value={call.staff_name || call.technician || call.engineer}
              />
              <DetailItem
                icon={User}
                label="Executive / Referrer"
                value={call.executive_name || call.call_referrer}
              />
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <CheckCircle
                  size={15}
                  className="text-blue-600 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Step 2 Status
                  </p>
                  <span
                    className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${call.step2_completed ? "bg-green-100 text-green-700 border border-green-200" : "bg-blue-100 text-blue-700 border border-blue-200"}`}
                  >
                    {call.step2_completed ? "✓ Complete" : "Basic (Pending)"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM 2: Time & Travel ── */}
          <div className="rounded-xl border border-green-200 bg-green-50/30 p-4">
            <SectionHeader
              title="② Time & Travel (Form 2)"
              color="text-green-700"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DetailItem
                icon={Clock}
                label="Start Time"
                value={formatTimeOnly(call.start_time)}
              />
              <DetailItem
                icon={Clock}
                label="End Time"
                value={formatTimeOnly(call.end_time)}
              />
              <div
                className={`flex items-start gap-3 p-3 rounded-xl border ${call.is_exceeded ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
              >
                <Clock
                  size={15}
                  className={`mt-0.5 ${call.is_exceeded ? "text-red-600" : "text-green-600"}`}
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Duration
                  </p>
                  <p
                    className={`text-sm font-bold mt-0.5 ${call.is_exceeded ? "text-red-600" : "text-green-700"}`}
                  >
                    {call.actual_duration || 0} min
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Limit: {call.duration_limit || call.assigned_time || 30} min
                  </p>
                  {call.is_exceeded && (
                    <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                      <AlertTriangle size={9} /> +
                      {(call.actual_duration || 0) -
                        (call.duration_limit || call.assigned_time || 30)}{" "}
                      min over
                    </span>
                  )}
                </div>
              </div>
              <DetailItem
                icon={MapPin}
                label="Kilometers (KM)"
                value={
                  call.km != null && call.km !== "" ? `${call.km} km` : "0 km"
                }
              />
            </div>
          </div>

          {/* ── FORM 2: Expenses ── */}
          <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
            <SectionHeader
              title="② Expenses (Form 2)"
              color="text-orange-700"
            />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <DetailItem
                icon={DollarIcon}
                label="Petrol Charges"
                value={formatCurrency(call.petrol_charges)}
              />
              <DetailItem
                icon={DollarIcon}
                label="Spare Parts"
                value={formatCurrency(call.spare_parts_price)}
              />
              <DetailItem
                icon={DollarIcon}
                label="Labour Charges"
                value={formatCurrency(call.labour_charges)}
              />
              <DetailItem
                icon={DollarIcon}
                label="Delivery Calls and Project Work"
                value={formatCurrency(call.delivery_project_work)}
              />
              <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-100 border border-orange-300">
                <DollarIcon
                  size={15}
                  className="text-orange-700 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">
                    Total Expenses
                  </p>
                  <p className="text-lg font-black text-orange-800 font-display">
                    {formatCurrency(displayTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── FORM 2: Payment ── */}
          <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4">
            <SectionHeader title="② Payment (Form 2)" color="text-purple-700" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-100 border border-purple-300 md:col-span-1">
                <DollarIcon
                  size={15}
                  className="text-purple-700 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
                    Invoice Value
                  </p>
                  <p className="text-xl font-black text-purple-900 font-display">
                    {formatCurrency(call.invoice_value)}
                  </p>
                </div>
              </div>
              <DetailItem
                icon={CreditCard}
                label="Payment Type"
                value={call.payment_type || call.payment_mode}
              />
              <DetailItem
                icon={CheckCircle}
                label="Payment Status"
                value={call.payment_status}
                badge
                badgeBg={psc.bg}
                badgeText={psc.text}
                badgeBorder={psc.border}
              />
            </div>
          </div>

          {/* ── Remarks ── */}
          {call.remarks && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Remarks / Notes
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {call.remarks}
              </p>
            </div>
          )}

          {/* ── Footer metadata ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px] text-muted-foreground border-t border-border pt-4">
            <div>
              <span className="font-bold">Session ID:</span>{" "}
              {call.session_id || "—"}
            </div>
            <div>
              <span className="font-bold">Created:</span>{" "}
              {safeFormatDate(call.created_at)}
            </div>
            <div>
              <span className="font-bold">Completed At:</span>{" "}
              {call.completed_at ? safeFormatDate(call.completed_at) : "—"}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-white border-t border-border px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const CallReport = () => {
  const canEditDelete = getCanEditCallReport();
  // Export is allowed for both admin and subadmin roles
  const canExport = ["admin", "subadmin"].includes(getUserRole());

  const exportClientsCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      };
      const response = await axios.get(`${API}/api/client/export`, config);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `clients_export_${getLocalToday()}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export clients.");
    }
  };

  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push("");
      } else if ((char === "\r" || char === "\n") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const importClientsCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        alert("Invalid CSV structure or empty file.");
        return;
      }

      const headers = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1);
      const parsedClients = dataRows
        .map((row) => {
          const clientObj = {};
          headers.forEach((header, idx) => {
            clientObj[header] = row[idx] || "";
          });
          return clientObj;
        })
        .filter((c) => (c.Name || c.name || "").trim() !== "");

      if (parsedClients.length === 0) {
        alert("No valid client records found in CSV.");
        return;
      }

      if (
        !window.confirm(
          `Are you sure you want to import ${parsedClients.length} clients? Duplicate phone/email records will be updated dynamically.`,
        )
      ) {
        e.target.value = "";
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const response = await axios.post(
          `${API}/api/client/import`,
          { clients: parsedClients },
          config,
        );

        const { imported, updated, failed, errors } = response.data;
        let summaryMsg = `🎉 Import Process Completed!\n\n• Imported (New): ${imported}\n• Updated (Existing): ${updated}\n• Failed: ${failed}`;

        if (errors && errors.length > 0) {
          summaryMsg += `\n\nRecent Errors:\n${errors.join("\n")}`;
        }
        alert(summaryMsg);
        window.dispatchEvent(new Event("refresh-clients"));
      } catch (err) {
        console.error("Import error:", err);
        const errMsg =
          err.response?.data?.message ||
          err.message ||
          "Failed to import clients.";
        alert(`Error: ${errMsg}`);
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

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

  const [form, setForm] = useState({
    customer: "",
    customer_id: "",
    mobile_number: "",
    email: "",
    location_city: "",
    call_details: "",
    priority: "Medium",
    call_referrer: "",
    status: "Pending",
    call_type: "",
    payment_type: "",
    invoice_value: "",
    payment_status: "Pending",
    duration: "",
    contract_title: "",
    gst_number: "",
    company_name: "",
    engineer: "",
    start_time: "",
    end_time: "",
    km: "",
    petrol_charges: "",
    spare_parts_price: "",
    labour_charges: "",
    delivery_call_type: "",
    delivery_project_work: "",
    remarks: "",
    session_id: "",
    call_sequence: 1,
    step2_completed: 0,
    report_date: getLocalToday(),
    scheduled_time: "",
  });

  const [step2Form, setStep2Form] = useState({
    engineer: "",
    start_time: "",
    end_time: "",
    travel_start_time: "",
    travel_reach_time: "",
    km: "",
    duration: "",
    petrol_charges: "",
    spare_parts_price: "",
    labour_charges: "",
    delivery_call_type: "",
    delivery_project_work: "",
    remarks: "",
    status: "",
    invoice_value: "",
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
    exactDate: getLocalToday(),
    from: "",
    to: "",
    month: "",
    year: new Date().getFullYear().toString(),
    customer: "",
    engineer: "All",
  });
  const [historySearchInput, setHistorySearchInput] = useState("");

  // Debounce history search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setHistoryFilters((prev) => {
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
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Instant offline/cached startup before network call resolves
    try {
      const cached = localStorage.getItem("cached_calls");
      if (cached) setCalls(JSON.parse(cached));
    } catch (e) {
      console.error(e);
    }

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

      const ld = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const today = new Date();
      const todayStr = ld(today);

      if (historyFilters.dateRangeType === "exact_day") {
        if (historyFilters.exactDate) {
          params.append("from", historyFilters.exactDate);
          params.append("to", historyFilters.exactDate);
        }
      } else if (historyFilters.dateRangeType === "last_7") {
        const last7 = new Date();
        last7.setDate(today.getDate() - 7);
        params.append("from", ld(last7));
        params.append("to", todayStr);
      } else if (historyFilters.dateRangeType === "last_30") {
        const last30 = new Date();
        last30.setDate(today.getDate() - 30);
        params.append("from", ld(last30));
        params.append("to", todayStr);
      } else if (historyFilters.dateRangeType === "custom") {
        if (historyFilters.from) params.append("from", historyFilters.from);
        if (historyFilters.to) params.append("to", historyFilters.to);
      } else if (historyFilters.dateRangeType === "month_year") {
        if (historyFilters.month) params.append("month", historyFilters.month);
        if (historyFilters.year) params.append("year", historyFilters.year);
      }

      if (historyFilters.customer)
        params.append("customer", historyFilters.customer);
      if (historyFilters.engineer && historyFilters.engineer !== "All")
        params.append("engineer", historyFilters.engineer);

      const res = await axios.get(
        `${API}/api/call-reports?${params.toString()}`,
        getAuthConfig(),
      );
      setHistoryCalls(res.data || []);
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilters]);

  const handleHistorySearchClick = () => {
    setHistoryFilters((prev) => {
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
        ...getAuthConfig(),
      });
      setCustomerSearchResults(
        (res.data || []).map(mapClientOption).filter((c) => c.value),
      );
    } catch (err) {
      console.error(err);
      try {
        const res = await axios.get(`${API}/api/call-reports/customers`, {
          params: { q },
          ...getAuthConfig(),
        });
        setCustomerSearchResults(
          (res.data || []).map(mapClientOption).filter((c) => c.value),
        );
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setCustomerSearchResults([]);
      }
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  const searchContracts = useCallback(async (type, searchTerm = "") => {
    if (type !== "AMC" && type !== "ALC") {
      setContractSearchResults([]);
      return;
    }

    setContractLoading(true);
    try {
      const res = await axios.get(
        `${API}/api/contract/with-usage`,
        getAuthConfig(),
      );
      const q = searchTerm.trim().toLowerCase();
      const filtered = (res.data || []).filter((c) => {
        const matchesType = c.contract_type === type;
        const haystack =
          `${c.contract_title || ""} ${c.client_company || ""} ${c.mobile_number || ""} ${c.email || ""}`.toLowerCase();
        return matchesType && (!q || haystack.includes(q));
      });
      setContractSearchResults(filtered.map(mapContractOption));
    } catch (err) {
      console.error(err);
      setContractSearchResults([]);
    } finally {
      setContractLoading(false);
    }
  }, []);

  const handleCallTypeChange = (type) => {
    setForm((prev) => ({
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
    const contract = contractSearchResults.find(
      (c) => c.value === contractTitle,
    );
    if (contract) {
      setSelectedContract(contract);
      setForm((prev) => ({
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

  const calculateDuration = () => {
    if (!form.start_time || !form.end_time)
      return { actual: 0, limit: 0, exceeded: false, overflow: 0 };
    const [sh, sm] = form.start_time.split(":").map(Number);
    const [eh, em] = form.end_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let actual = endMins - startMins;
    if (actual < 0) {
      actual += 24 * 60; // handles cross-midnight
    }
    const durationMap = { "1hr": 60, "1.5hr": 90, "2hr": 120 };
    const limit =
      durationMap[form.duration] || selectedContract?.duration_limit || 30;
    const exceeded = actual > limit;
    const overflow = exceeded ? actual - limit : 0;
    return { actual, limit, exceeded, overflow };
  };

  const calculateStep2Duration = () => {
    if (!step2Form.start_time || !step2Form.end_time)
      return { actual: 0, limit: 0, exceeded: false, overflow: 0 };
    const currentCall = calls.find((c) => c.id === step2CallId);
    const durMap = { "1hr": 60, "1.5hr": 90, "2hr": 120 };
    const limit =
      (step2Form.duration && durMap[step2Form.duration]) ||
      currentCall?.duration_limit ||
      currentCall?.assigned_time ||
      30;
    const [sh, sm] = step2Form.start_time.split(":").map(Number);
    const [eh, em] = step2Form.end_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    let actual = endMins - startMins;
    if (actual < 0) {
      actual += 24 * 60; // handles cross-midnight
    }
    const exceeded = actual > limit;
    const overflow = exceeded ? actual - limit : 0;
    return { actual, limit, exceeded, overflow };
  };

  const step2Duration = calculateStep2Duration();
  const parseNum = (v) =>
    v === "" || v === null || v === undefined ? 0 : parseFloat(v) || 0;
  const step2TotalExpenses =
    parseNum(step2Form.petrol_charges) +
    parseNum(step2Form.spare_parts_price) +
    parseNum(step2Form.labour_charges) +
    parseNum(step2Form.delivery_project_work);

  const resetForm = () => {
    setForm({
      customer: "",
      customer_id: "",
      mobile_number: "",
      email: "",
      location_city: "",
      call_details: "",
      priority: "Medium",
      call_referrer: "",
      status: "Pending",
      call_type: "",
      payment_type: "",
      invoice_value: "",
      payment_status: "Pending",
      duration: "",
      contract_title: "",
      gst_number: "",
      company_name: "",
      engineer: "",
      start_time: "",
      end_time: "",
      km: "",
      petrol_charges: "",
      spare_parts_price: "",
      labour_charges: "",
      delivery_call_type: "",
      delivery_project_work: "",
      remarks: "",
      session_id: "",
      call_sequence: 1,
      step2_completed: 0,
      report_date: getLocalToday(),
      scheduled_time: "",
    });
    setStep2Form({
      engineer: "",
      start_time: "",
      end_time: "",
      travel_start_time: "",
      travel_reach_time: "",
      km: "",
      duration: "",
      petrol_charges: "",
      spare_parts_price: "",
      labour_charges: "",
      delivery_call_type: "",
      delivery_project_work: "",
      remarks: "",
      status: "",
      invoice_value: "",
      payment_status: "Pending",
      payment_type: "",
    });
    setIsEdit(false);
    setEditId(null);
    setSelectedContract(null);
    setCustomerSearchResults([]);
    setContractSearchResults([]);
    setStep2CallId(null);
    setStep2ModalOpen(false);
  };

  const openEditModal = (call) => {
    const gt0 = (v) => (parseFloat(v) > 0 ? String(v) : "");
    setForm({
      customer: call.customer_name || call.client_name || "",
      customer_id: call.customer_id || "",
      mobile_number: call.mobile_number || call.phone || "",
      email: call.email || "",
      location_city: call.location_city || call.location || "",
      call_details:
        call.call_details || call.complaint || call.description || "",
      priority: call.priority || "Medium",
      call_referrer: call.call_referrer || "",
      status: call.status || "Pending",
      call_type: call.call_type || "",
      payment_type: call.payment_type || "",
      invoice_value: gt0(call.invoice_value),
      payment_status: call.payment_status || "Pending",
      contract_title: call.contract_title || "",
      duration: call.duration_limit
        ? call.duration_limit == 60
          ? "1hr"
          : call.duration_limit == 90
            ? "1.5hr"
            : call.duration_limit == 120
              ? "2hr"
              : ""
        : "",
      gst_number: call.gst_number || "",
      company_name: call.company_name || "",
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      km: call.km || "",
      petrol_charges: gt0(call.petrol_charges),
      spare_parts_price: gt0(call.spare_parts_price),
      labour_charges: gt0(call.labour_charges),
      delivery_call_type: call.delivery_call_type || "",
      delivery_project_work: call.delivery_project_work || "",
      remarks: call.remarks || "",
      session_id: call.session_id || "",
      call_sequence: call.call_sequence || 1,
      step2_completed: call.step2_completed || 0,
      report_date: getLocalToday(),
      scheduled_time: call.scheduled_time || "",
    });
    setStep2Form({
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      travel_start_time: call.travel_start_time || "",
      travel_reach_time: call.travel_reach_time || "",
      km: call.km || "",
      petrol_charges: gt0(call.petrol_charges),
      spare_parts_price: gt0(call.spare_parts_price),
      labour_charges: gt0(call.labour_charges),
      delivery_call_type: call.delivery_call_type || "",
      delivery_project_work: call.delivery_project_work || "",
      remarks: call.remarks || "",
      status: call.status || "Pending",
      invoice_value: gt0(call.invoice_value),
      payment_status: call.payment_status || "Pending",
      payment_type: call.payment_type || "",
    });
    setEditId(call.id);
    setIsEdit(true);
    setModalOpen(true);
  };

  const openStep2Form = async (call) => {
    if (!canEditDelete) return;
    setStep2CallId(call.id);
    const durLimit = call.duration_limit || call.assigned_time || 30;
    const durStr =
      durLimit === 60
        ? "1hr"
        : durLimit === 90
          ? "1.5hr"
          : durLimit === 120
            ? "2hr"
            : "";
    const gt0 = (v) => (parseFloat(v) > 0 ? String(v) : "");
    setStep2Form({
      engineer: call.engineer || call.staff_name || "",
      start_time: call.start_time || "",
      end_time: call.end_time || "",
      travel_start_time: call.travel_start_time || "",
      travel_reach_time: call.travel_reach_time || "",
      km: call.km || "",
      duration: durStr,
      petrol_charges: gt0(call.petrol_charges),
      spare_parts_price: gt0(call.spare_parts_price),
      labour_charges: gt0(call.labour_charges),
      delivery_call_type: call.delivery_call_type || "",
      delivery_project_work: call.delivery_project_work || "",
      remarks: call.remarks || "",
      status: call.status || "Pending",
      invoice_value: gt0(call.invoice_value),
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

    if (!form.engineer) {
      return alert("Engineer is required!");
    }

    // Closing a call requires Step 2 to be filled
    if (form.status === "Closed") {
      const isStep2Completed = form.step2_completed === 1;
      if (!isStep2Completed) {
        return alert(
          "Cannot close call report without completing the second form (Step 2: Engineer Details)!",
        );
      }

      const isPaymentFree =
        PAYMENT_FREE_TYPES.includes(form.call_type) ||
        PAYMENT_FREE_TYPES.includes(form.delivery_call_type);
      if (!isPaymentFree && form.payment_status !== "Collected") {
        return alert("Cannot close call report unless payment is Collected!");
      }
    }

    const durVal = calculateDuration();
    if (durVal.exceeded && !form.remarks?.trim()) {
      return alert(
        `Duration exceeded by ${durVal.overflow} min. Please specify the reason in the remarks!`,
      );
    }

    try {
      const parse0 = (v) =>
        v === "" || v === null || v === undefined ? 0 : parseFloat(v) || 0;
      const payload = {
        ...form,
        status: form.status,
        invoice_value: parseFloat(form.invoice_value) || 0,
        petrol_charges: parse0(form.petrol_charges),
        spare_parts_price: parse0(form.spare_parts_price),
        labour_charges: parse0(form.labour_charges),
        delivery_project_work: parse0(form.delivery_project_work),
        duration_limit:
          form.duration === "1hr"
            ? 60
            : form.duration === "1.5hr"
              ? 90
              : form.duration === "2hr"
                ? 120
                : 30,
        assigned_time:
          form.duration === "1hr"
            ? 60
            : form.duration === "1.5hr"
              ? 90
              : form.duration === "2hr"
                ? 120
                : 30,
        // Always use today's system date (no user selection, no UTC shifting)
        report_date: getLocalToday(),
        scheduled_time: form.scheduled_time || null,
      };
      if (isEdit && editId) {
        await axios.put(
          `${API}/api/call-reports/${editId}`,
          payload,
          getAuthConfig(),
        );
      } else {
        payload.session_id = form.session_id || `SES-${Date.now()}`;
        payload.call_sequence = form.call_sequence || 1;
        await axios.post(`${API}/api/call-reports`, payload, getAuthConfig());
      }
      setModalOpen(false);
      resetForm();
      fetchCalls();
      // Fire push notification for new call
      if (!isEdit) {
        sendPushNotification(
          `📋 New Call: ${form.customer}`,
          `${form.call_type || "Call"} — ${form.location_city || ""} | ${form.report_date} ${form.scheduled_time ? "at " + to12h(form.scheduled_time) : ""}`.trim(),
        );
      }
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!step2Form.engineer) {
      return alert(
        "Engineer is required and must be assigned in Form 1 first!",
      );
    }

    const payVal = isNaN(parseFloat(step2Form.invoice_value))
      ? 0
      : parseFloat(step2Form.invoice_value);
    if (payVal < 0) {
      return alert("Invoice value cannot be negative!");
    }

    // Calls that can be closed without collecting payment (by call type or delivery_call_type)
    const callRecord = calls.find((c) => c.id === step2CallId);
    const callTypeMain = callRecord?.call_type || "";
    const isPaymentFree =
      PAYMENT_FREE_TYPES.includes(step2Form.delivery_call_type) ||
      PAYMENT_FREE_TYPES.includes(callTypeMain);

    if (payVal === 0 && !isPaymentFree) {
      const confirmZero = window.confirm(
        "Invoice value is ₹0. Are you sure you want to save with ₹0?",
      );
      if (!confirmZero) return;
    }

    let finalPaymentStatus = step2Form.payment_status;
    let finalStatus = step2Form.status;

    if (finalStatus === "Closed") {
      if (!step2Form.start_time || !step2Form.start_time.trim()) {
        return alert("Start Time is required to close the call!");
      }
      if (!step2Form.end_time || !step2Form.end_time.trim()) {
        return alert("End Time is required to close the call!");
      }
      // KM: allow 0, but require it to be a valid number
      if (
        step2Form.km === undefined ||
        step2Form.km === null ||
        String(step2Form.km).trim() === ""
      ) {
        setStep2Form((prev) => ({ ...prev, km: "" }));
      }
      // Allow empty — treat as 0.00
      if (
        step2Form.petrol_charges === undefined ||
        step2Form.petrol_charges === null
      ) {
        setStep2Form((prev) => ({ ...prev, petrol_charges: "" }));
      }
      if (
        step2Form.spare_parts_price === undefined ||
        step2Form.spare_parts_price === null
      ) {
        setStep2Form((prev) => ({ ...prev, spare_parts_price: "" }));
      }
      if (
        step2Form.labour_charges === undefined ||
        step2Form.labour_charges === null
      ) {
        setStep2Form((prev) => ({ ...prev, labour_charges: "" }));
      }
    }

    // Delivery Calls and Project Work can be closed without collecting payment
    if (!isPaymentFree) {
      if (finalStatus === "Closed" && finalPaymentStatus !== "Collected") {
        const confirmCollect = window.confirm(
          "Cannot close call unless payment is Collected. Would you like to mark it as Collected now?",
        );
        if (confirmCollect) {
          finalPaymentStatus = "Collected";
          setStep2Form((prev) => ({ ...prev, payment_status: "Collected" }));
        } else {
          return;
        }
      }

      if (finalPaymentStatus === "Pending" && finalStatus === "Closed") {
        const confirmStatus = window.confirm(
          "A closed call must have its payment marked as 'Collected'. Do you want to set status back to 'Pending'?",
        );
        if (confirmStatus) {
          finalStatus = "Pending";
          setStep2Form((prev) => ({ ...prev, status: "Pending" }));
        } else {
          return;
        }
      }
    }

    const step2Duration = calculateStep2Duration();
    if (step2Duration.exceeded && !step2Form.remarks?.trim()) {
      return alert(
        `Duration exceeded by ${step2Duration.overflow} min. Please specify the reason why the time was exceeded in the remarks field!`,
      );
    }

    try {
      const durLimit =
        step2Form.duration === "1hr"
          ? 60
          : step2Form.duration === "1.5hr"
            ? 90
            : step2Form.duration === "2hr"
              ? 120
              : 30;
      const parse0 = (v) =>
        v === "" || v === null || v === undefined ? 0 : parseFloat(v) || 0;
      const payload = {
        engineer: step2Form.engineer,
        staff_name: step2Form.engineer,
        start_time: step2Form.start_time,
        end_time: step2Form.end_time,
        travel_start_time: step2Form.travel_start_time || null,
        travel_reach_time: step2Form.travel_reach_time || null,
        km:
          step2Form.km === "" ||
            step2Form.km === null ||
            step2Form.km === undefined
            ? 0
            : parseFloat(step2Form.km) || 0,
        duration_limit: durLimit,
        assigned_time: durLimit,
        petrol_charges: parse0(step2Form.petrol_charges),
        spare_parts_price: parse0(step2Form.spare_parts_price),
        labour_charges: parse0(step2Form.labour_charges),
        delivery_call_type: step2Form.delivery_call_type,
        delivery_project_work: step2Form.delivery_project_work || 0,
        remarks: step2Form.remarks,
        status: finalStatus,
        invoice_value: payVal,
        payment_status: finalPaymentStatus,
        payment_type: step2Form.payment_type,
        step2_completed: 1,
      };
      await axios.put(
        `${API}/api/call-reports/${step2CallId}`,
        payload,
        getAuthConfig(),
      );
      setStep2ModalOpen(false);
      setStep2CallId(null);
      fetchCalls();
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    }
  };

  const deleteCall = async (id) => {
    if (!window.confirm("Delete this call record?")) return;
    try {
      await axios.delete(`${API}/api/call-reports/${id}`, getAuthConfig());
      fetchCalls();
    } catch (err) {
      alert("Failed to delete");
    }
  };

  // ── Shared call-report CSV export (used by both Calls and History tabs) ──────
  // Full column set so every table field is captured in the export.
  const CALL_EXPORT_HEADERS = [
    "Call ID",
    "Session ID",
    "Call Sequence",
    "Report Date",
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
    "Executive Name",
    "Start Time",
    "End Time",
    "Duration Limit (min)",
    "Actual Duration (min)",
    "Duration Exceeded",
    "Kilometers (KM)",
    "Petrol Charges (Rs)",
    "Spare Parts Price (Rs)",
    "Labour Charges (Rs)",
    "Delivery Calls & Project Work (Rs)",
    "Total Expenses (Rs)",
    "Payment Type",
    "Invoice Value (Rs)",
    "Payment Status",
    "Call Status",
    "Completion Status",
    "Remarks",
    "Created At",
    "Completed At",
  ];

  const callToExportRow = (c) => {
    const dur = c.actual_duration || 0;
    const dash = "-";
    return [
      c.call_id || `#${c.id}`,
      c.session_id || dash,
      c.call_sequence || 1,
      c.report_date ? safeFormatDate(c.report_date) : dash,
      c.customer || c.client_name || c.customer_name || dash,
      c.company_name || dash,
      c.mobile_number || c.phone || dash,
      c.email || dash,
      c.location_city || c.location || dash,
      c.gst_number || dash,
      c.call_type || dash,
      c.contract_title || dash,
      c.call_details || c.complaint || c.description || dash,
      c.priority || "Medium",
      c.call_referrer || dash,
      c.engineer || c.staff_name || c.technician || dash,
      c.executive_name || dash,
      c.start_time ? to12h(c.start_time) : dash,
      c.end_time ? to12h(c.end_time) : dash,
      c.duration_limit || c.assigned_time || 30,
      dur,
      c.is_exceeded ? "Yes" : "No",
      c.km !== "" && c.km != null ? c.km : dash,
      c.petrol_charges || 0,
      c.spare_parts_price || 0,
      c.labour_charges || 0,
      c.delivery_project_work || 0,
      c.total_expenses || 0,
      c.payment_type || dash,
      c.invoice_value || 0,
      c.payment_status || dash,
      c.status || "Pending",
      c.step2_completed ? "Complete" : "Basic",
      c.remarks || dash,
      c.created_at ? safeFormatDate(c.created_at) : dash,
      c.completed_at ? safeFormatDate(c.completed_at) : dash,
    ];
  };

  const triggerCSVDownload = (headers, rows, filename) => {
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a readable label of the currently applied history date range so the
  // export filename reflects exactly what range was exported.
  const historyRangeLabel = () => {
    const f = historyFilters;
    switch (f.dateRangeType) {
      case "exact_day":
        return f.exactDate || "exact-day";
      case "last_7":
        return "last-7-days";
      case "last_30":
        return "last-30-days";
      case "custom":
        return `${f.from || "start"}_to_${f.to || "end"}`;
      case "month_year":
        return `${f.month ? `month-${f.month}` : "all-months"}-${f.year || ""}`;
      default:
        return "all-dates";
    }
  };

  // Export exactly the History tab data currently displayed (range-filtered).
  const exportHistoryCSV = () => {
    if (!historyCalls.length) return alert("No history data to export");
    triggerCSVDownload(
      CALL_EXPORT_HEADERS,
      historyCalls.map(callToExportRow),
      `CallHistory_${historyRangeLabel()}_${getLocalToday()}.csv`,
    );
  };

  // Active "Calls" tab export — full column set via the shared helper.
  const downloadCSV = () => {
    if (!filteredCalls.length) return alert("No data to export");
    triggerCSVDownload(
      CALL_EXPORT_HEADERS,
      filteredCalls.map(callToExportRow),
      `CallReport_${getLocalToday()}.csv`,
    );
  };

  // Top-bar Export button — routes to the correct export for the active tab.
  const handleExport = () => {
    if (activeTab === "history") return exportHistoryCSV();
    if (activeTab === "performance") return downloadPerformanceCSV();
    return downloadCSV();
  };

  const filteredCalls = useMemo(() => {
    return calls
      .filter((c) => {
        const matchSearch =
          !searchTerm ||
          (c.customer_name || c.client_name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (c.call_id || "").includes(searchTerm) ||
          (c.engineer || c.staff_name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === "All" || c.status === statusFilter;
        const matchPriority =
          priorityFilter === "All" || c.priority === priorityFilter;
        const matchEngineer =
          engineerFilter === "All" ||
          (c.engineer || c.staff_name) === engineerFilter;
        const matchPayment =
          paymentStatusFilter === "All" ||
          c.payment_status === paymentStatusFilter;
        return (
          matchSearch &&
          matchStatus &&
          matchPriority &&
          matchEngineer &&
          matchPayment
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.report_date || a.created_at || 0);
        const dateB = new Date(b.report_date || b.created_at || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        return (b.id || 0) - (a.id || 0);
      });
  }, [
    calls,
    searchTerm,
    statusFilter,
    priorityFilter,
    engineerFilter,
    paymentStatusFilter,
  ]);

  const groupedCallsByMonth = useMemo(() => {
    const groups = {};
    filteredCalls.forEach((c) => {
      // Use parseLocalDate to avoid UTC midnight causing wrong month/day
      const date = parseLocalDate(c.report_date || c.created_at) || new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
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

  const stats = useMemo(
    () => ({
      total: calls.length,
      closed: calls.filter((c) => c.status === "Closed").length,
      pending: calls.filter((c) => c.status === "Pending").length,
      live: calls.filter((c) => c.status === "Live").length,
      observation: calls.filter((c) => c.status === "Observation").length,
      exceeded: calls.filter((c) => c.is_exceeded).length,
      step2Complete: calls.filter((c) => c.step2_completed).length,
      step2Pending: calls.filter((c) => !c.step2_completed).length,
      totalValue: calls.reduce(
        (sum, c) => sum + (parseFloat(c.invoice_value) || 0),
        0,
      ),
      collected: calls
        .filter((c) => c.payment_status === "Collected")
        .reduce((sum, c) => sum + (parseFloat(c.invoice_value) || 0), 0),
    }),
    [calls],
  );

  const formatCurrency = (v) => `₹${(parseFloat(v) || 0).toLocaleString()}`;

  const busyEngineers = useMemo(() => {
    return calls
      .filter(
        (c) =>
          ["Live", "Pending", "Observation"].includes(c.status) &&
          (c.engineer || c.staff_name),
      )
      .map((c) => c.engineer || c.staff_name);
  }, [calls]);

  const getEngineerStatus = (engineerName) => {
    const isBusy = busyEngineers.includes(engineerName);
    const currentCall = calls.find(
      (c) =>
        (c.engineer || c.staff_name) === engineerName &&
        ["Live", "Pending", "Observation"].includes(c.status),
    );
    return {
      isBusy,
      customerName: currentCall
        ? currentCall.customer_name || currentCall.client_name
        : null,
    };
  };

  const openFollowUpCall = async (c) => {
    const sessionCalls = calls.filter(
      (call) => call.session_id === c.session_id,
    );
    const maxSeq = sessionCalls.reduce(
      (max, call) => Math.max(max, call.call_sequence || 1),
      0,
    );
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
        service_type:
          c.call_type === "AMC" || c.call_type === "ALC" ? c.call_type : "None",
        report_date: getLocalToday(),
        session_id: c.session_id,
        call_sequence: nextSeq,
      };

      const res = await axios.post(
        `${API}/api/call-reports`,
        payload,
        getAuthConfig(),
      );
      const newCallId = res.data.id;

      // Refresh calls list in the background
      await fetchCalls();

      // Open the Step 2 modal directly for this newly created follow-up call!
      setStep2CallId(newCallId);
      setStep2Form({
        engineer: "",
        start_time: "",
        end_time: "",
        travel_start_time: "",
        travel_reach_time: "",
        km: "",
        petrol_charges: "",
        spare_parts_price: "",
        labour_charges: "",
        delivery_call_type: "",
        delivery_project_work: "",
        remarks: "",
        status: "Pending",
        invoice_value: "",
        payment_status: "Pending",
        payment_type: "",
      });
      setStep2ModalOpen(true);
    } catch (err) {
      alert(
        "Error creating follow-up call: " +
        (err.response?.data?.error || err.message),
      );
    }
  };

  const openBasicForm = () => {
    const autoEngineer = getEngineerForCurrentUser();
    setForm({
      customer: "",
      customer_id: "",
      mobile_number: "",
      email: "",
      location_city: "",
      call_details: "",
      priority: "Medium",
      call_referrer: "",
      status: "Pending",
      call_type: "",
      payment_type: "",
      invoice_value: "",
      payment_status: "Pending",
      duration: "",
      contract_title: "",
      gst_number: "",
      company_name: "",
      engineer: autoEngineer,
      start_time: "",
      end_time: "",
      km: "",
      petrol_charges: "",
      spare_parts_price: "",
      labour_charges: "",
      delivery_project_work: "",
      remarks: "",
      session_id: `SES-${Date.now()}`,
      call_sequence: 1,
      step2_completed: 0,
      report_date: getLocalToday(),
      scheduled_time: getLocalNow(),
    });
    setSelectedContract(null);
    setContractSearchResults([]);
    setModalOpen(true);
    setIsEdit(false);
    setEditId(null);
  };

  // Push notification helper
  const sendPushNotification = (title, body) => {
    if (!("Notification" in window)) return;
    const fire = () => {
      try {
        new Notification(title, {
          body,
          icon: "/Madhura-logo.png",
          badge: "/Madhura-logo.png",
          tag: `call-report-${Date.now()}`,
          requireInteraction: false,
        });
      } catch (e) {
        console.warn("Notification error:", e);
      }
    };
    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") fire();
      });
    }
  };

  const handleInlineUpdate = async (callId, updatedFields) => {
    try {
      const res = await axios.get(
        `${API}/api/call-reports/${callId}`,
        getAuthConfig(),
      );
      const currentCall = res.data;
      if (!currentCall) return;

      const newStatus =
        updatedFields.status !== undefined
          ? updatedFields.status
          : currentCall.status;
      const engineerAssigned =
        updatedFields.engineer !== undefined
          ? updatedFields.engineer
          : currentCall.engineer || currentCall.staff_name;
      if (
        ["Live", "Observation", "Closed"].includes(newStatus) &&
        !engineerAssigned
      ) {
        alert(
          "Engineer is required when status is Live, Observation, or Closed!",
        );
        return;
      }

      if (updatedFields.status === "Closed") {
        const step2_comp = currentCall.step2_completed === 1;
        if (!step2_comp) {
          alert(
            "Cannot close call report without completing the second form (Step 2: Engineer Details)!",
          );
          return;
        }

        const missingFields = [];
        if (!currentCall.start_time) missingFields.push("Start Time");
        if (!currentCall.end_time) missingFields.push("End Time");
        if (
          currentCall.km === undefined ||
          currentCall.km === null ||
          String(currentCall.km).trim() === ""
        )
          missingFields.push("Kilometers (KM)");

        if (missingFields.length > 0) {
          alert(
            `Cannot close call report. The following fields are missing from Step 2: ${missingFields.join(", ")}. Please open the Step 2 details form and fill them.`,
          );
          return;
        }
      }

      // Delivery Calls and Project Work can be closed without collecting payment
      const isPaymentFree =
        PAYMENT_FREE_TYPES.includes(currentCall.delivery_call_type) ||
        PAYMENT_FREE_TYPES.includes(currentCall.call_type);

      if (!isPaymentFree) {
        if (
          updatedFields.status === "Closed" &&
          (updatedFields.payment_status || currentCall.payment_status) !==
          "Collected"
        ) {
          const confirmCollect = window.confirm(
            "Cannot close call unless payment is Collected. Would you like to mark it as Collected now?",
          );
          if (confirmCollect) {
            updatedFields.payment_status = "Collected";
          } else {
            return;
          }
        }

        if (
          updatedFields.payment_status === "Pending" &&
          (updatedFields.status || currentCall.status) === "Closed"
        ) {
          const confirmStatus = window.confirm(
            "A closed call must have its payment marked as 'Collected'. Do you want to set status back to 'Pending'?",
          );
          if (confirmStatus) {
            updatedFields.status = "Pending";
          } else {
            return;
          }
        }
      }

      const parse0 = (v) =>
        v === "" || v === null || v === undefined ? 0 : parseFloat(v) || 0;
      const payload = {
        customer: currentCall.customer_name || currentCall.client_name || "",
        customer_id: currentCall.customer_id || null,
        mobile_number: currentCall.mobile_number || currentCall.phone || "",
        email: currentCall.email || "",
        location_city: currentCall.location_city || currentCall.location || "",
        call_details:
          currentCall.call_details ||
          currentCall.complaint ||
          currentCall.description ||
          "",
        priority: currentCall.priority || "Medium",
        engineer: currentCall.engineer || currentCall.staff_name || "",
        call_referrer: currentCall.call_referrer || "",
        status: currentCall.status || "Pending",
        call_type: currentCall.call_type || "AMC",
        payment_type: currentCall.payment_type || "",
        invoice_value: parseFloat(currentCall.invoice_value) || 0,
        payment_status: currentCall.payment_status || "",
        duration_limit:
          currentCall.duration_limit || currentCall.assigned_time || 30,
        assigned_time:
          currentCall.duration_limit || currentCall.assigned_time || 30,
        start_time: currentCall.start_time || null,
        end_time: currentCall.end_time || null,
        km:
          currentCall.km !== "" && currentCall.km != null
            ? parseFloat(currentCall.km)
            : 0,
        petrol_charges: parse0(currentCall.petrol_charges),
        spare_parts_price: parse0(currentCall.spare_parts_price),
        labour_charges: parse0(currentCall.labour_charges),
        delivery_call_type: currentCall.delivery_call_type || "",
        delivery_project_work:
          parseFloat(currentCall.delivery_project_work) || 0,
        remarks: currentCall.remarks || "",
        step2_completed: currentCall.step2_completed || 0,
        ...updatedFields,
      };

      await axios.put(
        `${API}/api/call-reports/${callId}`,
        payload,
        getAuthConfig(),
      );
      fetchCalls();
    } catch (err) {
      alert("Error updating: " + (err.response?.data?.error || err.message));
    }
  };

  // ── Performance Tab: API-driven data ────────────────────────────────────────
  const [perfData, setPerfData] = useState([]);
  const [perfSummary, setPerfSummary] = useState({});
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfFilters, setPerfFilters] = useState({
    dateRangeType: "all",
    from: "",
    to: "",
    month: "",
    year: new Date().getFullYear().toString(),
    engineer: "All",
  });

  const fetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const params = new URLSearchParams();
      const ld = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const today = new Date();
      const todayStr = ld(today);

      if (perfFilters.dateRangeType === "last_7") {
        const d = new Date();
        d.setDate(today.getDate() - 7);
        params.append("from", ld(d));
        params.append("to", todayStr);
      } else if (perfFilters.dateRangeType === "last_30") {
        const d = new Date();
        d.setDate(today.getDate() - 30);
        params.append("from", ld(d));
        params.append("to", todayStr);
      } else if (perfFilters.dateRangeType === "this_month") {
        params.append("month", String(today.getMonth() + 1));
        params.append("year", String(today.getFullYear()));
      } else if (perfFilters.dateRangeType === "last_month") {
        const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        params.append("month", String(lm.getMonth() + 1));
        params.append("year", String(lm.getFullYear()));
      } else if (perfFilters.dateRangeType === "this_year") {
        params.append("year", String(today.getFullYear()));
      } else if (perfFilters.dateRangeType === "custom") {
        if (perfFilters.from) params.append("from", perfFilters.from);
        if (perfFilters.to) params.append("to", perfFilters.to);
      } else if (perfFilters.dateRangeType === "month_year") {
        if (perfFilters.month) params.append("month", perfFilters.month);
        if (perfFilters.year) params.append("year", perfFilters.year);
      }

      if (perfFilters.engineer && perfFilters.engineer !== "All") {
        params.append("engineer", perfFilters.engineer);
      }

      const res = await axios.get(
        `${API}/api/call-reports/performance?${params.toString()}`,
        getAuthConfig(),
      );
      const { engineers = [], summary = {} } = res.data || {};
      setPerfData(engineers);
      setPerfSummary(summary);
    } catch (err) {
      console.error("Fetch performance error:", err);
      setPerfData([]);
      setPerfSummary({});
    } finally {
      setPerfLoading(false);
    }
  }, [perfFilters]);

  useEffect(() => {
    if (activeTab === "performance") fetchPerformance();
  }, [activeTab, fetchPerformance]);

  const downloadPerformanceCSV = () => {
    if (!perfData.length) return alert("No performance data to export");
    const headers = [
      "Engineer Name",
      "Total Calls",
      "Closed Calls",
      "Pending Calls",
      "Total KM Driven",
      "Petrol Cost (₹)",
      "Spare Parts (₹)",
      "Labour Charges (₹)",
      "Delivery Calls & Project Work (₹)",
      "Total Expenses (₹)",
      "Total Revenue (₹)",
      "Collected Revenue (₹)",
      "Pending Revenue (₹)",
      "Total Time (Hours)",
      "Avg Duration/Call (min)",
      "On-Time Rate (%)",
      "Calls per Hour",
      "Profit (₹)",
      "Profit Margin (%)",
      "Exceeded Calls",
    ];
    const rows = perfData.map((p) => [
      p.engineer_name,
      p.total_calls,
      p.closed_calls,
      p.pending_calls,
      p.total_km,
      p.total_petrol,
      p.total_spare_parts,
      p.total_labour,
      p.total_delivery_project_work,
      p.total_expenses,
      p.total_revenue,
      p.collected_revenue,
      p.pending_revenue,
      p.total_hours,
      p.avg_duration_per_call,
      p.on_time_rate,
      p.calls_per_hour,
      p.profit,
      p.profit_margin,
      p.exceeded_calls,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r
          .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Engineer_Performance_${perfFilters.dateRangeType}_${getLocalToday()}.csv`;
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
    <div
      className="w-full p-2 md:p-4"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-primary">
            Call Report
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Dashboard &gt; Services &gt; Call Report
          </p>
        </div>
        <div className="flex gap-2">
          {/* {isStrictAdmin && (
            <>
              <button onClick={exportClientsCSV} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors">
                <Download size={14} /> Export Clients
              </button>
              <button onClick={() => document.getElementById("client-import-input-callreport").click()} className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors">
                Import Clients
              </button>
              <input id="client-import-input-callreport" type="file" accept=".csv" className="hidden" onChange={importClientsCSV} />
            </>
          )} */}
          {canExport && (
            <button
              onClick={handleExport}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
            >
              <Download size={14} />{" "}
              {activeTab === "history"
                ? "Export History"
                : activeTab === "performance"
                  ? "Export Performance"
                  : "Export"}
            </button>
          )}
          {canEditDelete && (
            <button
              onClick={openBasicForm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 bg-primary hover:bg-primary/90 transition-colors shadow-md hover:shadow-lg"
            >
              <Plus size={16} /> New Call
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-card rounded-xl border border-border p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === tab.id ? "shadow-sm" : "hover:bg-muted/50"}`}
            style={{
              background:
                activeTab === tab.id ? "hsl(var(--primary))" : "transparent",
              color:
                activeTab === tab.id
                  ? "hsl(var(--primary-foreground))"
                  : "hsl(var(--muted-foreground))",
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
              {
                label: "Total Active",
                value: stats.total,
                icon: Phone,
                color: "hsl(var(--primary))",
                bg: "hsl(var(--primary) / 0.1)",
              },
              {
                label: "Pending",
                value: stats.pending,
                icon: Clock,
                color: "hsl(38 92% 50%)",
                bg: "hsl(38 92% 50% / 0.1)",
              },
              {
                label: "Live",
                value: stats.live,
                icon: AlertCircle,
                color: "hsl(217 91% 60%)",
                bg: "hsl(217 91% 60% / 0.1)",
              },
              {
                label: "Observation",
                value: stats.observation,
                icon: Activity,
                color: "hsl(271 81% 56%)",
                bg: "hsl(271 81% 56% / 0.1)",
              },
              {
                label: "Exceeded",
                value: stats.exceeded,
                icon: AlertTriangle,
                color: "hsl(var(--destructive))",
                bg: "hsl(var(--destructive) / 0.1)",
              },
              {
                label: "Complete",
                value: stats.step2Complete,
                icon: CheckCircle,
                color: "hsl(var(--accent))",
                bg: "hsl(var(--accent) / 0.1)",
              },
              {
                label: "Basic Only",
                value: stats.step2Pending,
                icon: Clock,
                color: "hsl(38 92% 50%)",
                bg: "hsl(38 92% 50% / 0.1)",
              },
              {
                label: "Total Value",
                value: formatCurrency(stats.totalValue),
                icon: DollarSign,
                color: "hsl(271 81% 56%)",
                bg: "hsl(271 81% 56% / 0.1)",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl p-4 border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: s.bg }}
                  >
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="text-lg font-bold font-display text-foreground">
                      {s.value}
                    </p>
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
                  placeholder="Search by customer, call ID, engineer..."
                  className="outline-none text-sm w-full bg-transparent text-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Priority</option>
                {PRIORITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={engineerFilter}
                onChange={(e) => setEngineerFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Engineers</option>
                {ENGINEERS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Payments</option>
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 pt-3 pb-1 text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-700 font-semibold">
                👆 Double-click any call row to open the details form (Step 2)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                    <th className="px-4 py-3 text-left w-[100px]">ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-center w-[90px]">Status</th>
                    <th className="px-4 py-3 text-center w-[90px]">Type</th>
                    <th className="px-4 py-3 text-center w-[110px]">
                      Completion
                    </th>
                    <th className="px-4 py-3 text-center w-[80px]">Duration</th>
                    <th className="px-4 py-3 text-center w-[90px]">Total</th>
                    <th className="px-4 py-3 text-center w-[90px]">Pay</th>
                    <th className="px-4 py-3 text-center w-[100px]">
                      Pay Status
                    </th>
                    <th className="px-4 py-3 text-center w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="text-center py-12 text-muted-foreground"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : filteredCalls.length === 0 ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="text-center py-12 text-muted-foreground"
                      >
                        No call records found
                      </td>
                    </tr>
                  ) : (
                    groupedCallsByMonth.map((group) => {
                      const isCollapsed = collapsedMonths[group.key];
                      const toggleCollapse = () => {
                        setCollapsedMonths((prev) => ({
                          ...prev,
                          [group.key]: !prev[group.key],
                        }));
                      };
                      return (
                        <React.Fragment key={group.key}>
                          <tr
                            onClick={toggleCollapse}
                            className="bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer border-b border-border select-none"
                          >
                            <td
                              colSpan="10"
                              className="px-4 py-3 font-semibold text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {isCollapsed ? (
                                    <ChevronDown
                                      size={16}
                                      className="text-primary"
                                    />
                                  ) : (
                                    <ChevronUp
                                      size={16}
                                      className="text-primary"
                                    />
                                  )}
                                  <span className="text-primary font-bold text-base font-display">
                                    {group.label}
                                  </span>
                                  <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                                    {group.calls.length}{" "}
                                    {group.calls.length === 1
                                      ? "Call"
                                      : "Calls"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-6 text-xs text-muted-foreground mr-4">
                                  <span className="font-medium">
                                    Total Expenses:{" "}
                                    <strong className="text-foreground">
                                      {formatCurrency(group.totalExpenses)}
                                    </strong>
                                  </span>
                                  <span className="font-medium">
                                    Total Revenue:{" "}
                                    <strong className="text-accent text-sm font-bold">
                                      {formatCurrency(group.totalRevenue)}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {!isCollapsed &&
                            group.calls.map((c) => {
                              const sc =
                                STATUS_COLORS[c.status] ||
                                STATUS_COLORS.Pending;
                              const psc =
                                PAYMENT_STATUS_COLORS[c.payment_status] ||
                                PAYMENT_STATUS_COLORS.Pending;
                              const dur = c.actual_duration || 0;
                              const isComplete = c.step2_completed;
                              return (
                                <tr
                                  key={c.id}
                                  className="border-b border-border hover:bg-amber-50/40 transition-colors cursor-pointer select-none"
                                  onDoubleClick={() =>
                                    canEditDelete && openStep2Form(c)
                                  }
                                  title={
                                    canEditDelete
                                      ? "Double-click to open Step 2 details form"
                                      : ""
                                  }
                                >
                                  <td className="px-4 py-3 font-mono font-bold text-xs text-primary">
                                    <div className="text-primary font-black text-sm">
                                      Call #{c.call_sequence || 1}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                      ID: {String(c.id).padStart(3, "0")}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground mt-0.5">
                                      {safeFormatDate(
                                        c.report_date || c.created_at,
                                      )}
                                      {c.scheduled_time
                                        ? ` · ${to12h(c.scheduled_time)}`
                                        : ""}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-sm truncate text-foreground">
                                        {c.customer_name ||
                                          c.client_name ||
                                          "—"}
                                      </p>
                                      {c.status === "Pending" &&
                                        c.report_date &&
                                        parseLocalDate(c.report_date) <
                                        new Date(
                                          new Date().toDateString(),
                                        ) && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                            Overdue
                                          </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] truncate text-muted-foreground">
                                      {c.location_city || c.location || ""}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {canEditDelete ? (
                                      <select
                                        value={c.status || "Pending"}
                                        onChange={(e) =>
                                          handleInlineUpdate(c.id, {
                                            status: e.target.value,
                                          })
                                        }
                                        onDoubleClick={(e) =>
                                          e.stopPropagation()
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-1 text-[11px] font-bold rounded-full border outline-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary"
                                        style={{
                                          background: sc.bg,
                                          color: sc.text,
                                          borderColor: sc.border,
                                        }}
                                      >
                                        {STATUS_OPTIONS.filter(
                                          (opt) =>
                                            opt !== "Closed" ||
                                            c.step2_completed === 1,
                                        ).map((opt) => (
                                          <option
                                            key={opt}
                                            value={opt}
                                            style={{
                                              background: "#ffffff",
                                              color: "#1a1a1a",
                                            }}
                                          >
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <Badge
                                        bg={sc.bg}
                                        text={sc.text}
                                        border={sc.border}
                                      >
                                        {c.status || "Pending"}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-center text-muted-foreground">
                                    {c.call_type || "—"}
                                  </td>
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
                                            <Edit
                                              size={12}
                                              className="stroke-[2.5px]"
                                            />
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
                                            <Plus
                                              size={12}
                                              className="stroke-[3px]"
                                            />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.is_exceeded ? "bg-red-100 text-red-700 border border-red-200" : "bg-accent/10 text-accent"}`}
                                    >
                                      {dur}m{" "}
                                      {c.is_exceeded
                                        ? `(+${c.actual_duration - (c.duration_limit || c.assigned_time || 30)}m Extra)`
                                        : ""}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs font-bold text-center text-foreground">
                                    {c.total_expenses !== null &&
                                      c.total_expenses !== undefined
                                      ? formatCurrency(c.total_expenses)
                                      : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-xs font-bold text-center text-foreground">
                                    {c.invoice_value !== null &&
                                      c.invoice_value !== undefined
                                      ? formatCurrency(c.invoice_value)
                                      : "—"}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {canEditDelete ? (
                                      <select
                                        value={c.payment_status || "Pending"}
                                        onChange={(e) =>
                                          handleInlineUpdate(c.id, {
                                            payment_status: e.target.value,
                                          })
                                        }
                                        onDoubleClick={(e) =>
                                          e.stopPropagation()
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-2 py-1 text-[11px] font-bold rounded-full border outline-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary"
                                        style={{
                                          background: psc.bg,
                                          color: psc.text,
                                          borderColor: psc.border,
                                        }}
                                      >
                                        {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                          <option
                                            key={opt}
                                            value={opt}
                                            style={{
                                              background: "#ffffff",
                                              color: "#1a1a1a",
                                            }}
                                          >
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <Badge
                                        bg={psc.bg}
                                        text={psc.text}
                                        border={psc.border}
                                      >
                                        {c.payment_status || "Pending"}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex gap-1 justify-center items-center">
                                      <button
                                        onClick={() => setDetailCall(c)}
                                        className="p-1 rounded hover:bg-primary/10 transition-colors"
                                        title="View Details"
                                      >
                                        <Eye
                                          size={14}
                                          className="text-primary"
                                        />
                                      </button>

                                      {canEditDelete &&
                                        (!isComplete || canEditDelete) && (
                                          <button
                                            onClick={() => openStep2Form(c)}
                                            className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                            title={
                                              isComplete
                                                ? "Edit Details"
                                                : "Complete Details"
                                            }
                                          >
                                            <CheckCircle size={14} />
                                          </button>
                                        )}
                                      {canEditDelete && (
                                        <button
                                          onClick={() => openEditModal(c)}
                                          className="p-1 rounded hover:bg-accent/10 transition-colors"
                                          title="Edit"
                                        >
                                          <Edit
                                            size={14}
                                            className="text-accent"
                                          />
                                        </button>
                                      )}
                                      {canEditDelete && (
                                        <button
                                          onClick={() => openFollowUpCall(c)}
                                          className="p-1 rounded hover:bg-purple-100 transition-colors text-purple-600"
                                          title="Add follow-up call to this session"
                                        >
                                          <Plus size={14} />
                                        </button>
                                      )}
                                      {canEditDelete && (
                                        <button
                                          onClick={() => deleteCall(c.id)}
                                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2
                                            size={14}
                                            className="text-destructive"
                                          />
                                        </button>
                                      )}
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
              {
                label: "Completed Calls",
                value: historyCalls.length,
                icon: CheckCircle,
                color: "hsl(var(--accent))",
                bg: "hsl(var(--accent) / 0.1)",
              },
              {
                label: "Total Revenue",
                value: `₹${historyCalls.reduce((s, c) => s + (parseFloat(c.invoice_value) || 0), 0).toLocaleString()}`,
                icon: DollarSign,
                color: "hsl(271 81% 56%)",
                bg: "hsl(271 81% 56% / 0.1)",
              },
              {
                label: "Total Expenses",
                value: `₹${historyCalls.reduce((s, c) => s + (parseFloat(c.total_expenses) || 0), 0).toLocaleString()}`,
                icon: TrendingUp,
                color: "hsl(217 91% 60%)",
                bg: "hsl(217 91% 60% / 0.1)",
              },
              {
                label: "Collected",
                value: `₹${historyCalls
                  .filter((c) => c.payment_status === "Collected")
                  .reduce((s, c) => s + (parseFloat(c.invoice_value) || 0), 0)
                  .toLocaleString()}`,
                icon: Phone,
                color: "hsl(142 71% 45%)",
                bg: "hsl(142 71% 45% / 0.1)",
              },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-xl p-4 border border-border bg-card hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: s.bg }}
                  >
                    <s.icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {s.label}
                    </p>
                    <p className="text-lg font-bold font-display text-foreground">
                      {s.value}
                    </p>
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
                  onChange={(e) => setHistorySearchInput(e.target.value)}
                />
              </div>

              <select
                value={historyFilters.dateRangeType}
                onChange={(e) =>
                  setHistoryFilters((p) => ({
                    ...p,
                    dateRangeType: e.target.value,
                  }))
                }
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
                  onChange={(e) =>
                    setHistoryFilters((p) => ({
                      ...p,
                      exactDate: e.target.value,
                    }))
                  }
                  className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  title="Select Date"
                />
              )}

              {historyFilters.dateRangeType === "custom" && (
                <>
                  <input
                    type="date"
                    value={historyFilters.from}
                    onChange={(e) =>
                      setHistoryFilters((p) => ({ ...p, from: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                    title="From"
                  />
                  <input
                    type="date"
                    value={historyFilters.to}
                    onChange={(e) =>
                      setHistoryFilters((p) => ({ ...p, to: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                    title="To"
                  />
                </>
              )}

              {historyFilters.dateRangeType === "month_year" && (
                <>
                  <select
                    value={historyFilters.month}
                    onChange={(e) =>
                      setHistoryFilters((p) => ({
                        ...p,
                        month: e.target.value,
                      }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString("default", {
                          month: "long",
                        })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={historyFilters.year}
                    onChange={(e) =>
                      setHistoryFilters((p) => ({ ...p, year: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}

              <select
                value={historyFilters.engineer}
                onChange={(e) =>
                  setHistoryFilters((p) => ({ ...p, engineer: e.target.value }))
                }
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Engineers</option>
                {ENGINEERS.map((e) => (
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

              {canExport && (
                <button
                  onClick={exportHistoryCSV}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors ml-auto"
                  title="Export the currently shown history (respects the date range & filters)"
                >
                  <Download size={14} /> Export Range
                </button>
              )}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-muted-foreground font-bold uppercase text-xs border-b border-border">
                    <th className="px-4 py-3 text-left w-[100px]">ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Engineer</th>
                    <th className="px-4 py-3 text-center w-[80px]">Duration</th>
                    <th className="px-4 py-3 text-center w-[90px]">Expenses</th>
                    <th className="px-4 py-3 text-center w-[90px]">Invoice</th>
                    <th className="px-4 py-3 text-center w-[100px]">
                      Pay Status
                    </th>
                    <th className="px-4 py-3 text-center w-[120px]">
                      Completed At
                    </th>
                  </tr>
                </thead>
                <caption className="text-[10px] text-muted-foreground pb-1 caption-bottom">
                  Double-click any row to view full call details
                </caption>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="text-center py-12 text-muted-foreground"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : historyCalls.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="text-center py-12 text-muted-foreground"
                      >
                        No completed calls found
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const groups = {};
                      historyCalls.forEach((c) => {
                        const d =
                          parseLocalDate(c.report_date || c.completed_at) ||
                          new Date();
                        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        const ml = d.toLocaleString("default", {
                          month: "long",
                          year: "numeric",
                        });
                        if (!groups[mk])
                          groups[mk] = {
                            key: mk,
                            label: ml,
                            calls: [],
                            totalRevenue: 0,
                            totalExpenses: 0,
                          };
                        groups[mk].calls.push(c);
                        groups[mk].totalRevenue +=
                          parseFloat(c.invoice_value) || 0;
                        groups[mk].totalExpenses +=
                          parseFloat(c.total_expenses) || 0;
                      });
                      return Object.values(groups)
                        .sort((a, b) => b.key.localeCompare(a.key))
                        .map((group) => (
                          <React.Fragment key={group.key}>
                            <tr className="bg-primary/5 hover:bg-primary/10 transition-colors border-b border-border">
                              <td
                                colSpan="8"
                                className="px-4 py-3 font-semibold text-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="text-primary font-bold text-base font-display">
                                      {group.label}
                                    </span>
                                    <span className="bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                                      {group.calls.length} calls
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground mr-4">
                                    <span>
                                      Expenses:{" "}
                                      <strong className="text-foreground">
                                        {formatCurrency(group.totalExpenses)}
                                      </strong>
                                    </span>
                                    <span>
                                      Revenue:{" "}
                                      <strong className="text-accent">
                                        {formatCurrency(group.totalRevenue)}
                                      </strong>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                            {group.calls.map((c) => {
                              const hpsc =
                                PAYMENT_STATUS_COLORS[c.payment_status] ||
                                PAYMENT_STATUS_COLORS.Pending;
                              return (
                                <tr
                                  key={c.id}
                                  className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                                  onDoubleClick={() => setDetailCall(c)}
                                  title="Double-click to view full details"
                                >
                                  <td className="px-4 py-3 font-mono font-bold text-xs text-primary">
                                    <div className="text-primary font-black text-sm">
                                      Call #{c.call_sequence || 1}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                                      ID: {String(c.id).padStart(3, "0")}
                                    </div>
                                    {PAYMENT_FREE_TYPES.includes(
                                      c.call_type,
                                    ) && (
                                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                          {c.call_type}
                                        </span>
                                      )}
                                    {c.delivery_call_type &&
                                      !PAYMENT_FREE_TYPES.includes(
                                        c.call_type,
                                      ) && (
                                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                                          {c.delivery_call_type}
                                        </span>
                                      )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-sm text-foreground">
                                      {c.customer_name || c.client_name || "—"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {c.location_city || ""}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-muted-foreground">
                                    {c.staff_name || c.technician || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm">
                                    {c.actual_duration || 0}m
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm font-medium">
                                    {formatCurrency(c.total_expenses)}
                                  </td>
                                  <td className="px-4 py-3 text-center text-sm font-bold text-accent">
                                    {formatCurrency(c.invoice_value)}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {canEditDelete ? (
                                      <select
                                        value={c.payment_status || "Pending"}
                                        onChange={(e) =>
                                          handleInlineUpdate(c.id, {
                                            payment_status: e.target.value,
                                          })
                                        }
                                        onClick={(ev) => ev.stopPropagation()}
                                        className="px-2 py-1 text-[11px] font-bold rounded-full border outline-none cursor-pointer shadow-sm transition-all focus:ring-1 focus:ring-primary"
                                        style={{
                                          background: hpsc.bg,
                                          color: hpsc.text,
                                          borderColor: hpsc.border,
                                        }}
                                        title="Edit payment status"
                                      >
                                        {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                          <option
                                            key={opt}
                                            value={opt}
                                            style={{
                                              background: "#ffffff",
                                              color: "#1a1a1a",
                                            }}
                                          >
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span
                                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold`}
                                        style={{
                                          background: hpsc.bg,
                                          color: hpsc.text,
                                          border: `1px solid ${hpsc.border}`,
                                        }}
                                      >
                                        {c.payment_status || "Pending"}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center text-[11px] text-muted-foreground">
                                    {c.completed_at ? (
                                      <>
                                        <div>
                                          {new Date(
                                            c.completed_at,
                                          ).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })}
                                        </div>
                                        <div className="text-[10px]">
                                          {to12h(
                                            new Date(c.completed_at)
                                              .toTimeString()
                                              .slice(0, 5),
                                          )}
                                        </div>
                                      </>
                                    ) : c.scheduled_time ? (
                                      <>
                                        <div>
                                          {safeFormatDate(c.report_date)}
                                        </div>
                                        <div className="text-[10px] text-primary font-medium">
                                          {to12h(c.scheduled_time)}
                                        </div>
                                      </>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
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
            <h2 className="text-lg font-bold font-display text-foreground">
              Engineer Status
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time availability of all engineers
            </p>
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
                    <tr
                      key={eng.value}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {eng.label}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: isBusy
                              ? "hsl(var(--destructive) / 0.1)"
                              : "hsl(var(--accent) / 0.1)",
                            color: isBusy
                              ? "hsl(var(--destructive))"
                              : "hsl(var(--accent))",
                          }}
                        >
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
          {/* Filter Bar */}
          <div className="bg-card rounded-xl border border-border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Performance Filters:
                </span>
              </div>
              <select
                value={perfFilters.dateRangeType}
                onChange={(e) =>
                  setPerfFilters((p) => ({
                    ...p,
                    dateRangeType: e.target.value,
                  }))
                }
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="all">All Time</option>
                <option value="last_7">Last 7 Days</option>
                <option value="last_30">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
                <option value="month_year">Month & Year</option>
              </select>
              {perfFilters.dateRangeType === "custom" && (
                <>
                  <input
                    type="date"
                    value={perfFilters.from}
                    onChange={(e) =>
                      setPerfFilters((p) => ({ ...p, from: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground"
                    title="From"
                  />
                  <input
                    type="date"
                    value={perfFilters.to}
                    onChange={(e) =>
                      setPerfFilters((p) => ({ ...p, to: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground"
                    title="To"
                  />
                </>
              )}
              {perfFilters.dateRangeType === "month_year" && (
                <>
                  <select
                    value={perfFilters.month}
                    onChange={(e) =>
                      setPerfFilters((p) => ({ ...p, month: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground"
                  >
                    <option value="">All Months</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(0, i).toLocaleString("default", {
                          month: "long",
                        })}
                      </option>
                    ))}
                  </select>
                  <select
                    value={perfFilters.year}
                    onChange={(e) =>
                      setPerfFilters((p) => ({ ...p, year: e.target.value }))
                    }
                    className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const y = new Date().getFullYear() - i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </>
              )}
              <select
                value={perfFilters.engineer}
                onChange={(e) =>
                  setPerfFilters((p) => ({ ...p, engineer: e.target.value }))
                }
                className="border border-border rounded-lg px-3 py-2 text-sm outline-none bg-white text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="All">All Engineers</option>
                {ENGINEERS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchPerformance}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/95 transition-colors shadow flex items-center gap-2"
              >
                <Search size={14} /> Search
              </button>
              {canExport && (
                <button
                  onClick={downloadPerformanceCSV}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors ml-auto"
                >
                  <Download size={14} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {/* Loading State */}
          {perfLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              <span className="ml-3 text-sm text-muted-foreground">
                Loading performance data...
              </span>
            </div>
          )}

          {!perfLoading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                {[
                  {
                    label: "Total Calls",
                    value: perfSummary.total_calls || 0,
                    icon: Phone,
                    color: "hsl(var(--primary))",
                    bg: "hsl(var(--primary) / 0.1)",
                  },
                  {
                    label: "Closed",
                    value: perfSummary.closed_calls || 0,
                    icon: CheckCircle,
                    color: "hsl(142 71% 45%)",
                    bg: "hsl(142 71% 45% / 0.1)",
                  },
                  {
                    label: "Pending",
                    value: perfSummary.pending_calls || 0,
                    icon: Clock,
                    color: "hsl(38 92% 50%)",
                    bg: "hsl(38 92% 50% / 0.1)",
                  },
                  {
                    label: "Revenue",
                    value: formatCurrency(perfSummary.total_revenue || 0),
                    icon: DollarSign,
                    color: "hsl(var(--accent))",
                    bg: "hsl(var(--accent) / 0.1)",
                  },
                  {
                    label: "Collected",
                    value: formatCurrency(perfSummary.collected_revenue || 0),
                    icon: CreditCard,
                    color: "hsl(142 71% 45%)",
                    bg: "hsl(142 71% 45% / 0.1)",
                  },
                  {
                    label: "Expenses",
                    value: formatCurrency(perfSummary.total_expenses || 0),
                    icon: AlertTriangle,
                    color: "hsl(0 72% 51%)",
                    bg: "hsl(0 72% 51% / 0.1)",
                  },
                  {
                    label: "Total KM",
                    value: (perfSummary.total_km || 0).toFixed(1),
                    icon: MapPin,
                    color: "hsl(38 92% 50%)",
                    bg: "hsl(38 92% 50% / 0.1)",
                  },
                  {
                    label: "Avg Calls/Hr",
                    value: perfSummary.avg_calls_per_hour || 0,
                    icon: TrendingUp,
                    color: "hsl(271 81% 56%)",
                    bg: "hsl(271 81% 56% / 0.1)",
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 border border-border bg-card hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: s.bg }}
                      >
                        <s.icon size={14} style={{ color: s.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-muted-foreground truncate">
                          {s.label}
                        </p>
                        <p className="text-sm font-bold font-display text-foreground truncate">
                          {s.value}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue & Expenses Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl p-4 border border-border bg-gradient-to-br from-green-50 to-green-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-700">
                    Collected Revenue
                  </p>
                  <p className="text-xl font-black text-green-800 font-display">
                    {formatCurrency(perfSummary.collected_revenue || 0)}
                  </p>
                </div>
                <div className="rounded-xl p-4 border border-border bg-gradient-to-br from-red-50 to-red-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                    Pending Revenue
                  </p>
                  <p className="text-xl font-black text-red-800 font-display">
                    {formatCurrency(perfSummary.pending_revenue || 0)}
                  </p>
                </div>
                <div className="rounded-xl p-4 border border-border bg-gradient-to-br from-orange-50 to-orange-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700">
                    Total Expenses
                  </p>
                  <p className="text-lg font-black text-orange-800 font-display">
                    {formatCurrency(perfSummary.total_expenses || 0)}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px] text-orange-600">
                    <span>
                      Petrol: {formatCurrency(perfSummary.total_petrol || 0)}
                    </span>
                    <span>
                      Parts:{" "}
                      {formatCurrency(perfSummary.total_spare_parts || 0)}
                    </span>
                    <span>
                      Labour: {formatCurrency(perfSummary.total_labour || 0)}
                    </span>
                    <span>
                      Deliv/Proj:{" "}
                      {formatCurrency(
                        perfSummary.total_delivery_project_work || 0,
                      )}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl p-4 border border-border bg-gradient-to-br from-purple-50 to-purple-100/50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700">
                    Net Profit
                  </p>
                  <p
                    className={`text-xl font-black font-display ${(perfSummary.total_revenue || 0) - (perfSummary.total_expenses || 0) >= 0 ? "text-green-800" : "text-red-800"}`}
                  >
                    {formatCurrency(
                      (perfSummary.total_revenue || 0) -
                      (perfSummary.total_expenses || 0),
                    )}
                  </p>
                  <p className="text-[10px] text-purple-600 mt-0.5">
                    {perfSummary.total_hours || 0} hours ·{" "}
                    {perfSummary.exceeded_calls || 0} exceeded
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={18} className="text-primary" />
                    <h3 className="text-sm font-bold text-foreground">
                      Calls per Engineer
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={perfData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="closed_calls"
                          fill="hsl(142 71% 45%)"
                          name="Closed"
                          radius={[4, 4, 0, 0]}
                          stackId="a"
                        />
                        <Bar
                          dataKey="pending_calls"
                          fill="hsl(38 92% 50%)"
                          name="Pending"
                          stackId="a"
                        />
                        <Bar
                          dataKey="live_calls"
                          fill="hsl(217 91% 60%)"
                          name="Live"
                          stackId="a"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign size={18} className="text-accent" />
                    <h3 className="text-sm font-bold text-foreground">
                      Revenue vs Expenses (₹)
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={perfData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip
                          formatter={(v) => `₹${v.toLocaleString()}`}
                          contentStyle={tooltipStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar
                          dataKey="total_revenue"
                          fill="hsl(var(--accent))"
                          name="Revenue"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="total_expenses"
                          fill="hsl(0 72% 51%)"
                          name="Expenses"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-purple-500" />
                    <h3 className="text-sm font-bold text-foreground">
                      Calls/Hour Efficiency
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={perfData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Area
                          type="monotone"
                          dataKey="calls_per_hour"
                          stroke="hsl(271 81% 56%)"
                          fill="hsl(271 81% 56%)"
                          fillOpacity={0.15}
                          name="Calls/Hour"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="calls_per_hour"
                          stroke="hsl(271 81% 56%)"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name="Calls/Hour"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin size={18} className="text-amber-600" />
                    <h3 className="text-sm font-bold text-foreground">
                      KM Driven per Engineer
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={perfData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip
                          formatter={(v) => `${v} km`}
                          contentStyle={tooltipStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line
                          type="monotone"
                          dataKey="total_km"
                          stroke="hsl(38 92% 50%)"
                          strokeWidth={3}
                          dot={{ r: 5, fill: "hsl(38 92% 50%)" }}
                          name="KM"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon size={18} className="text-destructive" />
                    <h3 className="text-sm font-bold text-foreground">
                      Expense Distribution
                    </h3>
                  </div>
                  {perfData.filter((p) => p.total_expenses > 0).length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={perfData.filter((p) => p.total_expenses > 0)}
                          dataKey="total_expenses"
                          nameKey="engineer_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) =>
                            `${(name || "").split(" ")[0]}: ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {perfData
                            .filter((p) => p.total_expenses > 0)
                            .map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => `₹${v.toLocaleString()}`}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No expense data
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-foreground">
                      Time Spent (Hours)
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={perfData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Tooltip
                          formatter={(v) => `${v} hrs`}
                          contentStyle={tooltipStyle}
                        />
                        <Bar
                          dataKey="total_hours"
                          fill="hsl(217 91% 60%)"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-accent" />
                    <h3 className="text-sm font-bold text-foreground">
                      Efficiency Score
                    </h3>
                  </div>
                  {perfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={perfData.slice(0, 8)}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis
                          dataKey="engineer_name"
                          tick={{
                            fontSize: 9,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <PolarRadiusAxis
                          tick={{
                            fontSize: 10,
                            fill: "hsl(var(--muted-foreground))",
                          }}
                        />
                        <Radar
                          name="Calls/Hour"
                          dataKey="calls_per_hour"
                          stroke="hsl(var(--accent))"
                          fill="hsl(var(--accent))"
                          fillOpacity={0.3}
                          strokeWidth={2}
                        />
                        <Tooltip contentStyle={tooltipStyle} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Performance Table */}
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h2 className="text-lg font-bold font-display text-foreground">
                    Detailed Performance Table
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    All data fetched from database · Auto-calculated metrics ·
                    Sorted by total calls
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-muted-foreground font-bold uppercase text-[10px] border-b border-border">
                        <th className="px-3 py-3 text-left">Engineer</th>
                        <th className="px-2 py-3 text-center">Total</th>
                        <th className="px-2 py-3 text-center">Closed</th>
                        <th className="px-2 py-3 text-center">Pending</th>
                        <th className="px-2 py-3 text-center">KM</th>
                        <th className="px-2 py-3 text-center">Petrol</th>
                        <th className="px-2 py-3 text-center">Parts</th>
                        <th className="px-2 py-3 text-center">Labour</th>
                        <th className="px-2 py-3 text-center">
                          Delivery Calls & Project Work
                        </th>
                        <th className="px-2 py-3 text-center">Expenses</th>
                        <th className="px-2 py-3 text-center">Revenue</th>
                        <th className="px-2 py-3 text-center">Collected</th>
                        <th className="px-2 py-3 text-center">Profit</th>
                        <th className="px-2 py-3 text-center">Time(hrs)</th>
                        <th className="px-2 py-3 text-center">On-Time</th>
                        <th className="px-2 py-3 text-center">Calls/Hr</th>
                        <th className="px-2 py-3 text-center">Exceeded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.length === 0 ? (
                        <tr>
                          <td
                            colSpan="17"
                            className="text-center py-12 text-muted-foreground"
                          >
                            No performance data available for the selected
                            filters
                          </td>
                        </tr>
                      ) : (
                        <>
                          {perfData.map((p, idx) => (
                            <tr
                              key={p.engineer_name}
                              className="border-b border-border hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-3 py-2.5 font-semibold text-foreground">
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? "bg-yellow-400 text-yellow-900" : idx === 1 ? "bg-gray-300 text-gray-700" : idx === 2 ? "bg-orange-300 text-orange-900" : "bg-muted text-muted-foreground"}`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs truncate max-w-[120px]">
                                    {p.engineer_name}
                                  </span>
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center font-bold text-primary text-xs">
                                {p.total_calls}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs">
                                <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-bold text-[10px]">
                                  {p.closed_calls}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs">
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px]">
                                  {(parseInt(p.pending_calls) || 0) +
                                    (parseInt(p.live_calls) || 0) +
                                    (parseInt(p.observation_calls) || 0)}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {(p.total_km || 0).toFixed(1)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {formatCurrency(p.total_petrol)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {formatCurrency(p.total_spare_parts)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {formatCurrency(p.total_labour)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {formatCurrency(p.total_delivery_project_work)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs font-semibold text-orange-700">
                                {formatCurrency(p.total_expenses)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs font-bold text-accent">
                                {formatCurrency(p.total_revenue)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs font-semibold text-green-700">
                                {formatCurrency(p.collected_revenue)}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs">
                                <span
                                  className={`font-bold ${p.profit >= 0 ? "text-green-700" : "text-red-700"}`}
                                >
                                  {formatCurrency(p.profit)}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs text-muted-foreground">
                                {p.total_hours}
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs">
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${p.on_time_rate >= 80 ? "bg-green-100 text-green-700" : p.on_time_rate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}
                                >
                                  {p.on_time_rate}%
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center">
                                <span
                                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{
                                    background:
                                      p.calls_per_hour >= 1
                                        ? "hsl(var(--accent) / 0.1)"
                                        : p.calls_per_hour >= 0.5
                                          ? "hsl(38 92% 50% / 0.1)"
                                          : "hsl(var(--destructive) / 0.1)",
                                    color:
                                      p.calls_per_hour >= 1
                                        ? "hsl(var(--accent))"
                                        : p.calls_per_hour >= 0.5
                                          ? "hsl(38 92% 50%)"
                                          : "hsl(var(--destructive))",
                                  }}
                                >
                                  {p.calls_per_hour}
                                </span>
                              </td>
                              <td className="px-2 py-2.5 text-center text-xs">
                                {p.exceeded_calls > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                                    {p.exceeded_calls}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    0
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          {/* Totals Row */}
                          <tr className="bg-primary/5 border-t-2 border-primary/20 font-bold">
                            <td className="px-3 py-3 text-xs text-primary font-black uppercase">
                              TOTALS
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-primary">
                              {perfSummary.total_calls || 0}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-green-700">
                              {perfSummary.closed_calls || 0}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-amber-700">
                              {perfSummary.pending_calls || 0}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {(perfSummary.total_km || 0).toFixed(1)}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {formatCurrency(perfSummary.total_petrol || 0)}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {formatCurrency(
                                perfSummary.total_spare_parts || 0,
                              )}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {formatCurrency(perfSummary.total_labour || 0)}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {formatCurrency(
                                perfSummary.total_delivery_project_work || 0,
                              )}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-orange-700">
                              {formatCurrency(perfSummary.total_expenses || 0)}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-accent">
                              {formatCurrency(perfSummary.total_revenue || 0)}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-green-700">
                              {formatCurrency(
                                perfSummary.collected_revenue || 0,
                              )}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              <span
                                className={
                                  (perfSummary.total_revenue || 0) -
                                    (perfSummary.total_expenses || 0) >=
                                    0
                                    ? "text-green-700"
                                    : "text-red-700"
                                }
                              >
                                {formatCurrency(
                                  (perfSummary.total_revenue || 0) -
                                  (perfSummary.total_expenses || 0),
                                )}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-center text-xs">
                              {perfSummary.total_hours || 0}
                            </td>
                            <td className="px-2 py-3 text-center text-xs">—</td>
                            <td className="px-2 py-3 text-center text-xs text-primary">
                              {perfSummary.avg_calls_per_hour || 0}
                            </td>
                            <td className="px-2 py-3 text-center text-xs text-red-700">
                              {perfSummary.exceeded_calls || 0}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {detailCall && (
        <DetailModal
          call={detailCall}
          onClose={() => setDetailCall(null)}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Unified Call Report Modal — only for editors */}
      {canEditDelete && modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center overflow-y-auto pt-4 pb-4 animate-fade-in">
          <div
            className="bg-white rounded-2xl w-[95%] max-w-4xl shadow-2xl my-4 relative border border-border animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEdit ? "bg-accent/10" : "bg-primary/10"}`}
                >
                  {isEdit ? (
                    <Edit size={18} className="text-accent" />
                  ) : (
                    <Plus size={18} className="text-primary" />
                  )}
                </div>
                <h2 className="text-base sm:text-lg font-bold font-display text-foreground">
                  {isEdit ? "Edit Call Record" : "New Call Record"}
                </h2>
              </div>
              <X
                className="cursor-pointer hover:text-destructive transition-colors text-muted-foreground p-1 rounded hover:bg-destructive/10"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
              />
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
                            setForm({
                              ...form,
                              customer: e.target.value,
                              customer_id: "",
                              contract_title: "",
                            });
                            setSelectedContract(null);
                            if (e.target.value.length >= 2) {
                              searchCustomers(e.target.value);
                            } else if (e.target.value.length === 0) {
                              setCustomerSearchResults([]);
                            }
                          }}
                          onKeyPress={(e) => {
                            if (
                              e.key === "Enter" &&
                              customerSearchResults.length > 0
                            ) {
                              const firstCustomer = customerSearchResults[0];
                              setForm({
                                ...form,
                                customer: firstCustomer.value,
                                customer_id: firstCustomer.customer_id || "",
                                contract_title: "",
                                mobile_number:
                                  firstCustomer.mobile_number || "",
                                email: firstCustomer.email || "",
                                location_city:
                                  firstCustomer.location_city || "",
                                gst_number: firstCustomer.gst_number || "",
                                company_name: firstCustomer.company_name || "",
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
                        {(customerLoading ||
                          customerSearchResults.length > 0) && (
                            <div className="absolute z-50 w-full mt-1 overflow-hidden border border-border rounded-lg bg-white shadow-lg max-h-60 overflow-y-auto">
                              {customerLoading ? (
                                <div className="px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2 bg-white">
                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent"></div>
                                  <span>Searching customers...</span>
                                </div>
                              ) : (
                                customerSearchResults.map((customer, idx) => (
                                  <div
                                    key={idx}
                                    className="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 text-foreground bg-white"
                                    onClick={() => {
                                      setForm({
                                        ...form,
                                        customer: customer.value,
                                        customer_id: customer.customer_id || "",
                                        contract_title: "",
                                        mobile_number:
                                          customer.mobile_number || "",
                                        email: customer.email || "",
                                        location_city:
                                          customer.location_city || "",
                                        gst_number: customer.gst_number || "",
                                        company_name: customer.company_name || "",
                                      });
                                      setCustomerSearchResults([]);
                                    }}
                                  >
                                    {customer.label}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                      </div>
                    </FormField>
                  </div>
                  <FormField label="Mobile Number" icon={PhoneIcon} required>
                    <input
                      type="tel"
                      value={form.mobile_number}
                      onChange={(e) =>
                        setForm({ ...form, mobile_number: e.target.value })
                      }
                      className={inputBase}
                      placeholder="Auto-filled or manual"
                      required
                    />
                  </FormField>
                  <FormField label="Email" icon={Mail} required>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className={inputBase}
                      placeholder="Auto-filled or manual"
                      required
                    />
                  </FormField>
                  <FormField label="Location/City" icon={MapPin} required>
                    <input
                      type="text"
                      value={form.location_city}
                      onChange={(e) =>
                        setForm({ ...form, location_city: e.target.value })
                      }
                      className={inputBase}
                      placeholder="Auto-filled or manual"
                      required
                    />
                  </FormField>
                  <FormField label="Company Name" icon={FileText}>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) =>
                        setForm({ ...form, company_name: e.target.value })
                      }
                      className={inputBase}
                      placeholder="Auto-filled or manual"
                    />
                  </FormField>
                  <FormField label="GST Number" icon={FileText}>
                    <input
                      type="text"
                      value={form.gst_number}
                      onChange={(e) =>
                        setForm({ ...form, gst_number: e.target.value })
                      }
                      className={inputBase}
                      placeholder="Auto-filled or manual"
                    />
                  </FormField>
                  <FormField label="Call Type" icon={Tag} required>
                    <SearchableSelect
                      options={CALL_TYPE_OPTIONS}
                      value={form.call_type}
                      onChange={handleCallTypeChange}
                      placeholder="Select Call Type"
                    />
                  </FormField>
                  {/* Fixed date — always shows system today's date, not user-selectable */}
                  <FormField label="Scheduled Date" icon={Calendar} required>
                    <input
                      type="date"
                      value={getLocalToday()}
                      disabled
                      className={`${inputBase} opacity-80 cursor-not-allowed`}
                    />
                  </FormField>
                  <FormField label="Scheduled Time" icon={Clock}>
                    <div className="relative">
                      <input
                        type="time"
                        value={form.scheduled_time || ""}
                        onChange={(e) =>
                          setForm({ ...form, scheduled_time: e.target.value })
                        }
                        className={inputBase}
                      />
                      {form.scheduled_time && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
                          {to12h(form.scheduled_time)}
                        </span>
                      )}
                    </div>
                  </FormField>
                </div>
                {(form.call_type === "AMC" || form.call_type === "ALC") && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <FormField
                      label={`${form.call_type} Contract (Auto-fill)`}
                      icon={FileText}
                    >
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
                {PAYMENT_FREE_TYPES.includes(form.call_type) && (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 mb-1">
                    <CheckCircle
                      size={15}
                      className="text-blue-600 flex-shrink-0"
                    />
                    <p className="text-xs font-semibold text-blue-700">
                      <span className="font-black">{form.call_type}</span> —
                      This call can be{" "}
                      <span className="underline">
                        closed without collecting payment
                      </span>
                      . Payment status can be updated later from History.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <FormField
                      label="Call Details"
                      icon={MessageSquare}
                      required
                    >
                      <textarea
                        value={form.call_details}
                        onChange={(e) =>
                          setForm({ ...form, call_details: e.target.value })
                        }
                        className={`${inputBase} resize-none`}
                        placeholder="Describe the issue or service performed"
                        rows={2}
                        required
                      />
                    </FormField>
                  </div>
                  <FormField label="Priority" icon={AlertTriangle} required>
                    <SearchableSelect
                      options={PRIORITY_OPTIONS}
                      value={form.priority}
                      onChange={(v) => setForm({ ...form, priority: v })}
                      placeholder="Select Priority"
                    />
                  </FormField>
                  <FormField label="Engineer" icon={User} required>
                    <SearchableSelect
                      options={[
                        { value: "", label: "— Select Engineer —" },
                        ...ENGINEERS,
                      ]}
                      value={form.engineer}
                      onChange={(v) => setForm({ ...form, engineer: v })}
                      placeholder="Select Engineer"
                    />
                  </FormField>
                  <FormField label="Call Referrer" icon={Phone} required>
                    <SearchableSelect
                      options={CALL_REFERRERS}
                      value={form.call_referrer}
                      onChange={(v) => setForm({ ...form, call_referrer: v })}
                      placeholder="Select Referrer"
                    />
                  </FormField>
                  <FormField label="Status" required icon={CheckCircle}>
                    <SearchableSelect
                      options={
                        form.step2_completed === 1
                          ? STATUS_OPTIONS
                          : STATUS_OPTIONS.filter((opt) => opt !== "Closed")
                      }
                      value={form.status}
                      onChange={(v) => setForm({ ...form, status: v })}
                      placeholder="Select Status"
                    />
                  </FormField>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
                  >
                    {isEdit ? "Update Call" : "Save Call"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      resetForm();
                    }}
                    className="px-6 py-3 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 - Detail Form */}
      {step2ModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center overflow-y-auto pt-4 pb-4 animate-fade-in">
          <div
            className="bg-white rounded-2xl w-[95%] max-w-3xl shadow-2xl my-4 relative border border-border animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-border px-4 sm:px-6 py-4 flex justify-between items-center z-20">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10">
                  <Clock size={18} className="text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold font-display text-foreground">
                    Call #
                    {calls.find((c) => c.id === step2CallId)?.call_sequence ||
                      1}{" "}
                    ID: {String(step2CallId).padStart(3, "0")}{" "}
                    {!canEditDelete && (
                      <span className="text-xs font-normal text-destructive">
                        (View Only)
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Step 2: Time, Travel & Expenses
                  </p>
                </div>
              </div>
              <X
                className="cursor-pointer hover:text-destructive transition-colors text-muted-foreground p-1 rounded hover:bg-destructive/10"
                onClick={() => {
                  setStep2ModalOpen(false);
                }}
              />
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <form
                onSubmit={handleStep2Submit}
                className="p-4 sm:p-6 space-y-5"
              >
                <div className="p-3 sm:p-4 rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  {(() => {
                    const call = calls.find((c) => c.id === step2CallId);
                    if (!call) return null;
                    const sc =
                      STATUS_COLORS[call.status] || STATUS_COLORS.Pending;
                    const pc =
                      PRIORITY_COLORS[call.priority] || PRIORITY_COLORS.Medium;
                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-primary">
                            Customer Details
                          </h3>
                          <div className="flex gap-2">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: sc.bg,
                                color: sc.text,
                                border: `1px solid ${sc.border}`,
                              }}
                            >
                              {call.status}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: pc.bg,
                                color: pc.text,
                                border: `1px solid ${pc.border}`,
                              }}
                            >
                              {call.priority}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Customer
                            </p>
                            <p className="font-semibold text-xs sm:text-sm truncate text-foreground">
                              {call.customer_name || call.client_name || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Mobile
                            </p>
                            <p className="font-semibold text-xs sm:text-sm text-foreground">
                              {call.mobile_number || call.phone || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Location
                            </p>
                            <p className="font-semibold text-xs sm:text-sm text-foreground">
                              {call.location_city || call.location || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Assigned Engineer
                            </p>
                            <p className="font-semibold text-xs sm:text-sm text-primary font-bold truncate">
                              {call.engineer || call.staff_name || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Call Type
                            </p>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                              {call.call_type || "—"}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Invoice
                            </p>
                            <p className="font-semibold text-xs sm:text-sm text-accent">
                              {formatCurrency(call.invoice_value)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Email
                            </p>
                            <p className="font-semibold text-xs sm:text-sm text-foreground truncate">
                              {call.email || "—"}
                            </p>
                          </div>
                        </div>
                        {(call.call_details ||
                          call.complaint ||
                          call.description) && (
                            <div className="mt-3 p-3 rounded-lg bg-white border border-primary/20">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">
                                Call Details / Issue Description
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {call.call_details ||
                                  call.complaint ||
                                  call.description}
                              </p>
                            </div>
                          )}
                      </>
                    );
                  })()}
                </div>

                <SectionDivider icon={CheckCircle} title="Call Status" />
                <div className="grid grid-cols-1 gap-4">
                  <FormField label="Status" icon={CheckCircle}>
                    <SearchableSelect
                      options={STATUS_OPTIONS}
                      value={step2Form.status}
                      onChange={(v) =>
                        setStep2Form({ ...step2Form, status: v })
                      }
                      placeholder="Select Status"
                      disabled={!canEditDelete}
                    />
                  </FormField>
                </div>

                <SectionDivider icon={Clock} title="Time & Travel" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Start Time">
                    <TimePicker12h
                      value={step2Form.start_time}
                      onChange={(v) =>
                        setStep2Form({ ...step2Form, start_time: v })
                      }
                      disabled={!canEditDelete}
                    />
                  </FormField>
                  <FormField label="End Time">
                    <TimePicker12h
                      value={step2Form.end_time}
                      onChange={(v) =>
                        setStep2Form({ ...step2Form, end_time: v })
                      }
                      disabled={!canEditDelete}
                    />
                  </FormField>
                  {/* ── Engineer Travel Time ── */}
                  <div className="sm:col-span-2">
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-3 flex items-center gap-1">
                        🚗 Engineer Travel Time
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Travel Start Time">
                          <TimePicker12h
                            value={step2Form.travel_start_time}
                            onChange={(v) =>
                              setStep2Form({ ...step2Form, travel_start_time: v })
                            }
                            disabled={!canEditDelete}
                          />
                        </FormField>
                        <FormField label="Reached Time">
                          <TimePicker12h
                            value={step2Form.travel_reach_time}
                            onChange={(v) =>
                              setStep2Form({ ...step2Form, travel_reach_time: v })
                            }
                            disabled={!canEditDelete}
                          />
                        </FormField>
                      </div>
                      {/* Live travel duration display */}
                      {step2Form.travel_start_time && step2Form.travel_reach_time && (() => {
                        const toM = (t) => {
                          if (!t || !t.includes(":")) return 0;
                          const [h, m] = t.split(":").map(Number);
                          return isNaN(h) || isNaN(m) ? 0 : h * 60 + m;
                        };
                        let mins = toM(step2Form.travel_reach_time) - toM(step2Form.travel_start_time);
                        if (mins < 0) mins += 24 * 60;
                        const hrs = Math.floor(mins / 60);
                        const rem = mins % 60;
                        const label = hrs > 0
                          ? `${hrs}h ${rem}m`
                          : `${mins} min`;
                        return (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs font-semibold text-blue-700 bg-blue-100 border border-blue-300 px-3 py-1 rounded-full">
                              🕐 Total Travel: {label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              ({to12h(step2Form.travel_start_time)} → {to12h(step2Form.travel_reach_time)})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <FormField label="Kilometers (KM)" icon={MapPin}>
                    <input
                      type="number"
                      value={step2Form.km}
                      onChange={(e) =>
                        setStep2Form({ ...step2Form, km: e.target.value })
                      }
                      className={inputBase}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      disabled={!canEditDelete}
                    />
                  </FormField>
                  <FormField label="Duration Limit">
                    <select
                      value={step2Form.duration || ""}
                      onChange={(e) =>
                        setStep2Form({ ...step2Form, duration: e.target.value })
                      }
                      className={inputBase}
                      disabled={!canEditDelete}
                    >
                      <option value="">30 min (default)</option>
                      <option value="1hr">1 Hour</option>
                      <option value="1.5hr">1.5 Hours</option>
                      <option value="2hr">2 Hours</option>
                    </select>
                  </FormField>
                  {step2Duration.actual > 0 && (
                    <div
                      className={`p-3 rounded-lg border flex flex-col justify-center sm:col-span-2 ${step2Duration.exceeded ? "bg-red-50 border-red-200 text-red-700" : "bg-accent/5 border-accent/20"}`}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`text-xs font-semibold ${step2Duration.exceeded ? "text-red-600" : "text-accent"}`}
                        >
                          ⏱ {to12h(step2Form.start_time)} →{" "}
                          {to12h(step2Form.end_time)} ({step2Duration.actual}{" "}
                          min)
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Limit: {step2Duration.limit} min
                        </span>
                      </div>
                      {step2Duration.exceeded && (
                        <span className="text-[10px] font-bold text-red-600 flex items-center gap-1 mt-1">
                          <AlertTriangle size={10} /> Exceeded by{" "}
                          {step2Duration.overflow} min!
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <SectionDivider icon={DollarSign} title="Expenses & Billing" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FormField label="Petrol (₹)">
                    <input
                      type="number"
                      value={step2Form.petrol_charges}
                      onChange={(e) =>
                        setStep2Form({
                          ...step2Form,
                          petrol_charges: e.target.value,
                        })
                      }
                      className={inputBase}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      disabled={!canEditDelete}
                    />
                  </FormField>
                  <FormField label="Spare Parts (₹)">
                    <input
                      type="number"
                      value={step2Form.spare_parts_price}
                      onChange={(e) =>
                        setStep2Form({
                          ...step2Form,
                          spare_parts_price: e.target.value,
                        })
                      }
                      className={inputBase}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      disabled={!canEditDelete}
                    />
                  </FormField>
                  <FormField label="Labour Charges (₹)">
                    <input
                      type="number"
                      value={step2Form.labour_charges}
                      onChange={(e) =>
                        setStep2Form({
                          ...step2Form,
                          labour_charges: e.target.value,
                        })
                      }
                      className={inputBase}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      disabled={!canEditDelete}
                    />
                  </FormField>

                  {/* Delivery Calls & Project Work — Sub Call Type */}
                  {(() => {
                    const parentCall = calls.find((c) => c.id === step2CallId);
                    const parentCallType = parentCall?.call_type || "";
                    const parentIsPaymentFree =
                      PAYMENT_FREE_TYPES.includes(parentCallType);
                    const subIsPaymentFree = PAYMENT_FREE_TYPES.includes(
                      step2Form.delivery_call_type,
                    );
                    const isPaymentFreeCall =
                      parentIsPaymentFree || subIsPaymentFree;

                    return (
                      <>
                        {/* Sub-Type (Delivery / Project) selector — hidden from Form 2 UI per request. Kept here (commented) for future use.
                        {!parentIsPaymentFree && (
                          <FormField
                            label="Sub-Type (Delivery / Project)"
                            icon={Tag}
                          >
                            <select
                              value={step2Form.delivery_call_type}
                              onChange={(e) =>
                                setStep2Form({
                                  ...step2Form,
                                  delivery_call_type: e.target.value,
                                })
                              }
                              className={inputBase}
                              disabled={!canEditDelete}
                            >
                              <option value="">— None —</option>
                              {DELIVERY_CALL_TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        )}
                        */}

                        {isPaymentFreeCall && (
                          <div className="col-span-full mb-2">
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 w-fit">
                              <CheckCircle
                                size={14}
                                className="text-blue-600 shrink-0"
                              />
                              <span className="text-xs font-semibold text-blue-700">
                                {parentCallType || step2Form.delivery_call_type}
                                : Can close without payment
                              </span>
                            </div>
                          </div>
                        )}

                        {/*
                      <FormField label="Delivery / Project Amount (₹)">
                        <div className="relative">
                          <input
                            type="number"
                            value={step2Form.delivery_project_work}
                            onChange={e => setStep2Form({ ...step2Form, delivery_project_work: e.target.value })}
                            className={inputBase}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            disabled={!canEditDelete || (!parentIsPaymentFree && !step2Form.delivery_call_type)}
                          />
                        </div>
                      </FormField>
                      */}

                        <div className="lg:col-span-1">
                          <div className="p-3 rounded-lg bg-orange-100 border border-orange-300 flex justify-between items-center h-[42px]">
                            <span className="text-xs font-bold uppercase tracking-wide text-orange-700">
                              Live Total
                            </span>
                            <span className="text-sm font-black text-orange-800">
                              {formatCurrency(step2TotalExpenses)}
                            </span>
                          </div>
                        </div>

                        <FormField label="Invoice Value (₹)" icon={DollarSign}>
                          <input
                            type="number"
                            value={step2Form.invoice_value}
                            onChange={(e) =>
                              setStep2Form({
                                ...step2Form,
                                invoice_value: e.target.value,
                              })
                            }
                            className={inputBase}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            disabled={!canEditDelete}
                          />
                        </FormField>
                        <FormField label="Payment Type" icon={CreditCard}>
                          <SearchableSelect
                            options={PAYMENT_TYPE_OPTIONS}
                            value={step2Form.payment_type}
                            onChange={(v) =>
                              setStep2Form({ ...step2Form, payment_type: v })
                            }
                            placeholder="Select Payment Type"
                            disabled={!canEditDelete}
                          />
                        </FormField>
                        <FormField label="Payment Status" icon={CheckCircle}>
                          <SearchableSelect
                            options={PAYMENT_STATUS_OPTIONS}
                            value={step2Form.payment_status}
                            onChange={(v) =>
                              setStep2Form({ ...step2Form, payment_status: v })
                            }
                            placeholder="Select Payment Status"
                            disabled={!canEditDelete}
                          />
                          {isPaymentFreeCall && (
                            <p className="text-[10px] text-blue-600 mt-1 font-medium">
                              💡{" "}
                              {parentCallType || step2Form.delivery_call_type}{" "}
                              calls can be closed with Pending payment —
                              editable in History
                            </p>
                          )}
                        </FormField>
                      </>
                    );
                  })()}
                </div>

                <FormField
                  label={
                    step2Duration.exceeded
                      ? "Why was the time exceeded? (Remarks Required)*"
                      : "Remarks"
                  }
                  icon={MessageSquare}
                  required={step2Duration.exceeded}
                >
                  <textarea
                    value={step2Form.remarks}
                    onChange={(e) =>
                      setStep2Form({ ...step2Form, remarks: e.target.value })
                    }
                    className={`${inputBase} resize-none ${step2Duration.exceeded ? "border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/10" : ""}`}
                    placeholder={
                      step2Duration.exceeded
                        ? "Please explain why the service time exceeded the limit..."
                        : "Additional notes"
                    }
                    rows={2}
                    required={step2Duration.exceeded}
                    disabled={!canEditDelete}
                  />
                </FormField>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
                  {canEditDelete ? (
                    <>
                      <button
                        type="submit"
                        className="flex-1 py-3 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all hover:opacity-90 active:scale-[0.98] shadow-md"
                      >
                        Save Details
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStep2ModalOpen(false);
                        }}
                        className="px-6 py-3 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setStep2ModalOpen(false);
                      }}
                      className="flex-1 py-3 border border-border rounded-lg text-sm font-semibold text-muted-foreground hover:bg-muted/50 transition-all active:scale-[0.98]"
                    >
                      Close (View Only)
                    </button>
                  )}
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
