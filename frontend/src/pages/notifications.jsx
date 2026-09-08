import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import {
  Bell,
  AlertTriangle,
  Trophy,
  Clock,
  Search,
  X,
  Trash2,
  Archive,
  RotateCcw,
  ClipboardList,
  ChevronRight,
  User,
  Calendar,
  Hash,
  MapPin,
  Phone,
  MessageSquare,
  CheckCircle,
  CheckCheck,
  RefreshCw,
  Volume2,
  Shield,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Inbox,
  AlertCircle,
  Share2,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { API } from "../config/api";
import {
  requestPushPermission,
  isPushSupported,
  playNotificationSound,
} from "../utils/pushNotifications";

// ── Color Theme Tokens ────────────────────────────────────────────────────────
const THEME = {
  primary: "#5645d4",
  primaryHover: "#4333b8",
  primarySoft: "#f4f2ff",
  primaryBorder: "#e0dcf8",
  indigo: "#4f46e5",
  indigoSoft: "#eef2ff",
  emerald: "#10b981",
  emeraldSoft: "#ecfdf5",
  amber: "#f59e0b",
  amberSoft: "#fffbeb",
  rose: "#f43f5e",
  roseSoft: "#fff1f2",
  sky: "#0284c7",
  skySoft: "#f0f9ff",
  purple: "#8b5cf6",
  purpleSoft: "#f5f3ff",
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748b",
  slate400: "#94a3b8",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  slate50: "#f8fafc",
};

// ── Formatters & Helpers ──────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return "---";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const timeAgo = (date) => {
  if (!date) return "";
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 30) return "Just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
};

const getDateGroupLabel = (dateStr) => {
  if (!dateStr) return "Earlier";
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDate.getTime() === today.getTime()) return "Today";
  if (itemDate.getTime() === yesterday.getTime()) return "Yesterday";
  const diffDays = Math.floor((today - itemDate) / (1000 * 60 * 60 * 24));
  if (diffDays <= 7) return "Earlier This Week";
  return "Older";
};

// ── Notification Configurations ──────────────────────────────────────────────
const NOTIF_CONFIG = {
  missed_reminder_alert: {
    icon: AlertTriangle,
    color: "#d97706",
    bg: "#fef3c7",
    badgeBg: "#fffbeb",
    border: "#fcd34d",
    label: "Missed Reminder Alert",
    category: "reminders",
    priority: "high",
    actionPath: "/dashboard/telecalling",
    actionLabel: "View Telecalls",
  },
  missed_reminder: {
    icon: AlertTriangle,
    color: "#d97706",
    bg: "#fef3c7",
    badgeBg: "#fffbeb",
    border: "#fcd34d",
    label: "Missed Reminder",
    category: "reminders",
    priority: "high",
    actionPath: "/dashboard/telecalling",
    actionLabel: "View Telecalls",
  },
  reminder_due: {
    icon: Clock,
    color: "#7c3aed",
    bg: "#ede9fe",
    badgeBg: "#f5f3ff",
    border: "#c4b5fd",
    label: "Reminder Due Soon",
    category: "reminders",
    priority: "medium",
    actionPath: "/dashboard/telecalling",
    actionLabel: "Open Lead",
  },
  reminder_due_now: {
    icon: Clock,
    color: "#dc2626",
    bg: "#fee2e2",
    badgeBg: "#fff1f2",
    border: "#fca5a5",
    label: "Reminder Due Now!",
    category: "reminders",
    priority: "high",
    actionPath: "/dashboard/telecalling",
    actionLabel: "Call Now",
  },
  target_completed: {
    icon: Trophy,
    color: "#059669",
    bg: "#d1fae5",
    badgeBg: "#ecfdf5",
    border: "#6ee7b7",
    label: "Target Completed",
    category: "targets",
    priority: "normal",
    actionPath: "/dashboard/targets",
    actionLabel: "View Targets",
  },
  target_achievement: {
    icon: Trophy,
    color: "#059669",
    bg: "#d1fae5",
    badgeBg: "#ecfdf5",
    border: "#6ee7b7",
    label: "Target Milestone Reached",
    category: "targets",
    priority: "normal",
    actionPath: "/dashboard/targets",
    actionLabel: "View Targets",
  },
  daily_task_summary: {
    icon: ClipboardList,
    color: "#4f46e5",
    bg: "#e0e7ff",
    badgeBg: "#eef2ff",
    border: "#a5b4fc",
    label: "Daily Task Summary",
    category: "tasks",
    priority: "normal",
    actionPath: "/dashboard/task",
    actionLabel: "View Tasks",
  },
  task_not_completed: {
    icon: AlertCircle,
    color: "#dc2626",
    bg: "#fee2e2",
    badgeBg: "#fff1f2",
    border: "#fca5a5",
    label: "Task Incomplete Alert",
    category: "tasks",
    priority: "high",
    actionPath: "/dashboard/task",
    actionLabel: "Resolve Task",
  },
  overdue_task: {
    icon: AlertCircle,
    color: "#dc2626",
    bg: "#fee2e2",
    badgeBg: "#fff1f2",
    border: "#fca5a5",
    label: "Task Overdue",
    category: "tasks",
    priority: "high",
    actionPath: "/dashboard/task",
    actionLabel: "View Task",
  },
  task_assigned: {
    icon: ClipboardList,
    color: "#0284c7",
    bg: "#e0f2fe",
    badgeBg: "#f0f9ff",
    border: "#7dd3fc",
    label: "Task Assigned",
    category: "tasks",
    priority: "normal",
    actionPath: "/dashboard/task",
    actionLabel: "View Task",
  },
  task_assigned_to_employee: {
    icon: ClipboardList,
    color: "#0284c7",
    bg: "#e0f2fe",
    badgeBg: "#f0f9ff",
    border: "#7dd3fc",
    label: "New Task Assigned",
    category: "tasks",
    priority: "normal",
    actionPath: "/dashboard/task",
    actionLabel: "View Task",
  },
  task_completed: {
    icon: CheckCircle,
    color: "#059669",
    bg: "#d1fae5",
    badgeBg: "#ecfdf5",
    border: "#6ee7b7",
    label: "Task Completed",
    category: "tasks",
    priority: "normal",
    actionPath: "/dashboard/task",
    actionLabel: "Open Tasks",
  },
  approval_request: {
    icon: Shield,
    color: "#7c3aed",
    bg: "#ede9fe",
    badgeBg: "#f5f3ff",
    border: "#c4b5fd",
    label: "Approval Request",
    category: "approvals",
    priority: "high",
    actionPath: "/dashboard/users",
    actionLabel: "Review Request",
  },
  new_lead: {
    icon: User,
    color: "#0284c7",
    bg: "#e0f2fe",
    badgeBg: "#f0f9ff",
    border: "#7dd3fc",
    label: "New Lead Created",
    category: "reminders",
    priority: "normal",
    actionPath: "/dashboard/telecalling",
    actionLabel: "View Leads",
  },
  whatsapp_message: {
    icon: MessageSquare,
    color: "#25D366",
    bg: "#dcfce7",
    badgeBg: "#f0fdf4",
    border: "#86efac",
    label: "WhatsApp Activity",
    category: "whatsapp",
    priority: "normal",
    actionPath: "/dashboard/whatsapp",
    actionLabel: "Open Chat",
  },
};

const getConfig = (type) => {
  if (NOTIF_CONFIG[type]) return NOTIF_CONFIG[type];
  return {
    icon: Bell,
    color: THEME.primary,
    bg: THEME.primarySoft,
    badgeBg: THEME.slate50,
    border: THEME.slate200,
    label: (type || "System Notification").replace(/_/g, " "),
    category: "system",
    priority: "normal",
    actionPath: null,
    actionLabel: "View",
  };
};

// ── Notification Detail Modal ────────────────────────────────────────────────
const NotifDetailPopup = ({ notification, onClose, onMarkRead, onArchive }) => {
  if (!notification) return null;
  const config = getConfig(notification.type);
  const Icon = config.icon;
  const data = notification.data || {};
  const isUnread = notification.is_read === 0;

  const phoneRaw = data.mobileNumber || data.mobile || "";
  const phoneClean = phoneRaw.replace(/[^0-9]/g, "");

  const details = [
    data.customerName && { icon: User, label: "Client Name", value: data.customerName },
    phoneRaw && {
      icon: Phone,
      label: "Mobile Number",
      value: phoneRaw,
      isPhone: true,
    },
    data.userName && { icon: User, label: "Assigned Staff", value: data.userName },
    data.count && { icon: Hash, label: "Missed Count", value: `${data.count} missed reminders` },
    data.percentage && { icon: Trophy, label: "Target Progress", value: `${data.percentage}% achieved` },
    data.leadType && { icon: MapPin, label: "Lead Category", value: data.leadType },
    data.reminderTime && { icon: Clock, label: "Scheduled At", value: data.reminderTime },
    data.reminderNotes && { icon: ClipboardList, label: "Reminder Notes", value: data.reminderNotes },
    data.missedAt && { icon: Calendar, label: "Missed Date", value: data.missedAt },
  ].filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden bg-white shadow-2xl border border-slate-200"
        style={{ animation: "detailPopup 0.25s cubic-bezier(0.16, 1, 0.3, 1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          className="p-5 border-b flex items-start justify-between"
          style={{
            background: config.bg,
            borderBottomColor: config.border,
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: config.color, color: "#fff" }}
            >
              <Icon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base" style={{ color: config.color }}>
                  {config.label}
                </h3>
                {isUnread && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white tracking-wide uppercase">
                    Unread
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {notification._source === "admin" ? "Admin System Alert" : "Employee Alert"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Main message text */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed font-medium">
            {notification.message || notification.description || data.message || "No detailed message provided."}
          </div>

          {/* Target Progress Bar if percentage present */}
          {data.percentage !== undefined && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mb-1.5">
                <span>Progress Milestone</span>
                <span>{data.percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-emerald-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, Number(data.percentage)))}%` }}
                />
              </div>
            </div>
          )}

          {/* Key-Value Details */}
          {details.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
              {details.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <d.icon size={13} className="text-slate-400" />
                    <span>{d.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{d.value}</span>
                    {d.isPhone && phoneClean && (
                      <div className="flex items-center gap-1 ml-1">
                        <a
                          href={`tel:${phoneClean}`}
                          className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          title="Call"
                        >
                          <Phone size={12} />
                        </a>
                        <a
                          href={`https://wa.me/${phoneClean.startsWith("91") ? phoneClean : "91" + phoneClean}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
                          title="WhatsApp"
                        >
                          <MessageSquare size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Timestamp Info */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>{formatDate(notification.created_at || notification.timestamp)}</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
              {timeAgo(notification.created_at || notification.timestamp)}
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {isUnread && (
              <button
                onClick={() => {
                  onMarkRead?.(notification.id, notification._source);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck size={14} />
                <span>Mark as Read</span>
              </button>
            )}
            <button
              onClick={() => {
                onArchive?.(notification.id, notification._source);
                onClose();
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Archive size={14} />
              <span>Archive</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {config.actionPath && (
              <a
                href={config.actionPath}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-95 transition flex items-center gap-1.5"
                style={{ background: config.color }}
              >
                <span>{config.actionLabel}</span>
                <ExternalLink size={13} />
              </a>
            )}
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes detailPopup {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};

// ── Notification Card Component ──────────────────────────────────────────────
const NotifCard = ({
  n,
  isSelected,
  onToggleSelect,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onArchive,
  showArchived,
  onShowDetail,
}) => {
  const config = getConfig(n.type);
  const Icon = config.icon;
  const isUnread = n.is_read === 0;
  const source = n._source;
  const data = n.data || {};
  const phoneRaw = data.mobileNumber || data.mobile || "";
  const phoneClean = phoneRaw.replace(/[^0-9]/g, "");

  // Priority indicator
  const priority = n.priority || config.priority || "normal";
  const isHighPriority = priority === "high" || priority === "urgent";

  return (
    <div
      onClick={() => onShowDetail?.(n)}
      className={`group relative rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden p-4 md:p-5 ${
        isUnread && !showArchived
          ? "bg-white shadow-sm hover:shadow-md border-indigo-200"
          : "bg-white/90 hover:bg-white border-slate-200 hover:shadow-sm"
      }`}
      style={{
        borderLeftWidth: "5px",
        borderLeftColor: isUnread ? config.color : THEME.slate300,
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Batch Selection Checkbox */}
        <div
          className="pt-0.5 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(n.id || n.dbId);
          }}
        >
          <div
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer ${
              isSelected
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-slate-300 hover:border-indigo-400 bg-white"
            }`}
          >
            {isSelected && <Check size={12} strokeWidth={3} />}
          </div>
        </div>

        {/* Icon Avatar */}
        <div
          className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition group-hover:scale-105"
          style={{ background: config.bg }}
        >
          <Icon size={20} style={{ color: config.color }} />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Header Row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: config.badgeBg, color: config.color }}
            >
              {config.label}
            </span>

            {isHighPriority && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Urgent
              </span>
            )}

            {source === "admin" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                Admin
              </span>
            )}

            {isUnread && !showArchived && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                New
              </span>
            )}

            <span className="text-xs text-slate-400 ml-auto flex items-center gap-1 flex-shrink-0">
              <Clock size={11} />
              {timeAgo(n.created_at || n.timestamp)}
            </span>
          </div>

          {/* Notification Message Text */}
          <p
            className={`text-sm leading-snug line-clamp-2 my-1 ${
              isUnread && !showArchived ? "font-semibold text-slate-900" : "font-medium text-slate-700"
            }`}
          >
            {n.message || n.description || data.message || "Notification alert"}
          </p>

          {/* Contextual Badges Row */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-600">
            {data.customerName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                <User size={11} className="text-slate-400" />
                <span>Client: <strong className="text-slate-900">{data.customerName}</strong></span>
              </span>
            )}

            {phoneRaw && (
              <span
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
              >
                <Phone size={11} className="text-slate-400" />
                <span>{phoneRaw}</span>
                {phoneClean && (
                  <a
                    href={`https://wa.me/${phoneClean.startsWith("91") ? phoneClean : "91" + phoneClean}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-emerald-600 hover:text-emerald-700"
                    title="WhatsApp"
                  >
                    <MessageSquare size={11} />
                  </a>
                )}
              </span>
            )}

            {data.userName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                <span>Staff: <strong className="text-slate-800">{data.userName}</strong></span>
              </span>
            )}

            {data.count && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold border border-amber-200">
                <AlertTriangle size={11} />
                <span>{data.count} missed</span>
              </span>
            )}

            {data.percentage !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                <Trophy size={11} />
                <span>{data.percentage}% target</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div
          className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Deep link button */}
          {config.actionPath && (
            <a
              href={config.actionPath}
              className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
              title={config.actionLabel}
            >
              <span>{config.actionLabel}</span>
              <ExternalLink size={12} />
            </a>
          )}

          {showArchived ? (
            <button
              onClick={() => onArchive?.(n.id || n.dbId, source)}
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
              title="Restore to active inbox"
            >
              <RotateCcw size={16} />
            </button>
          ) : (
            <>
              {/* Quick Mark Read / Unread toggle */}
              <button
                onClick={() => {
                  if (isUnread) {
                    onMarkRead?.(n.id || n.dbId, source);
                  } else {
                    onMarkUnread?.(n.id || n.dbId, source);
                  }
                }}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isUnread
                    ? "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                }`}
                title={isUnread ? "Mark as read" : "Mark as unread"}
              >
                {isUnread ? <CheckCheck size={16} /> : <EyeOff size={16} />}
              </button>

              {/* Archive button */}
              <button
                onClick={() => onArchive?.(n.id || n.dbId, source)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Archive"
              >
                <Archive size={16} />
              </button>
            </>
          )}

          {/* Delete button */}
          <button
            onClick={() => onDelete?.(n.id || n.dbId, source)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="Delete notification"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Live Tasks Summary Modal ──────────────────────────────────────────────────
const TasksSummaryModal = ({ isOpen, onClose, tasks, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  if (!isOpen) return null;

  const filteredTasks = tasks.filter((t) => {
    const nameMatch =
      (t.project_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.task_title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.staff_name || t.assigned_to || "").toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === "all") return nameMatch;
    if (statusFilter === "New") return nameMatch && t.project_status === "New";
    if (statusFilter === "Process") return nameMatch && t.project_status === "Process";
    if (statusFilter === "Completed") return nameMatch && t.project_status === "Completed";
    return nameMatch;
  });

  const getPriorityBadge = (p) => {
    switch ((p || "").toLowerCase()) {
      case "urgent":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "high":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "medium":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getStatusBadge = (s) => {
    switch ((s || "").toLowerCase()) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "process":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(6px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden bg-white border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Task Overview Console</h3>
              <p className="text-xs text-slate-500">Live inspection of all active and pending team tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              title="Reload tasks"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex gap-1 rounded-xl p-1 bg-slate-100 w-full sm:w-auto">
            {[
              { key: "all", label: "All Statuses" },
              { key: "New", label: "New" },
              { key: "Process", label: "In Process" },
              { key: "Completed", label: "Completed" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === f.key ? "bg-white shadow-sm text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 w-full sm:w-72 bg-slate-50">
            <Search size={14} className="text-slate-400" />
            <input
              className="outline-none text-xs bg-transparent w-full text-slate-900 placeholder:text-slate-400"
              placeholder="Search tasks, project, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="cursor-pointer text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Task Table Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500">Loading task status records...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <ClipboardList size={44} className="mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold">No tasks found matching criteria</p>
              <p className="text-xs text-slate-400 mt-1">Try switching statuses or resetting search terms.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 pl-2">Task & Project</th>
                    <th className="pb-3">Assigned Staff</th>
                    <th className="pb-3">Due Date</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3 pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 pl-2">
                        <p className="font-semibold text-slate-900">{t.task_title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{t.project_name || "General Project"}</p>
                      </td>
                      <td className="py-3.5 font-medium text-slate-700">
                        {t.staff_name || t.assigned_to || "Unassigned"}
                      </td>
                      <td className="py-3.5 text-slate-600">
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "No due date"}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityBadge(
                            t.project_priority
                          )}`}
                        >
                          {t.project_priority || "Normal"}
                        </span>
                      </td>
                      <td className="py-3.5 pr-2">
                        <span
                          className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${getStatusBadge(
                            t.project_status
                          )}`}
                        >
                          {t.project_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </span>
          <a
            href="/dashboard/task"
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition flex items-center gap-1"
          >
            <span>Open Tasks Dashboard</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};

// ── Main Notifications Component ─────────────────────────────────────────────
const Notifications = () => {
  const { user } = useAuth();
  const {
    notifications,
    adminNotifications,
    markAsRead,
    markAllAsRead,
    markAdminAsRead,
    refreshNotifications,
    archiveNotification,
    unarchiveNotification,
    deleteNotification,
    archiveAdminNotification,
    unarchiveAdminNotification,
    deleteAdminNotification,
  } = useNotifications();

  const isAdmin = user?.role === "admin";
  const isSubAdmin = user?.role === "subadmin";
  const canAccessAdminFeeds = isAdmin || isSubAdmin;

  // View States
  const [activeTab, setActiveTab] = useState("inbox"); // "inbox" | "archive"
  const [sourceScope, setSourceScope] = useState("all"); // "all" | "admin" | "employee"
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all"); // "all" | "unread" | "read"
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "oldest" | "priority"

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Push & Audio status
  const [pushStatus, setPushStatus] = useState("unknown");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Archived Notifications State
  const [archivedNotifs, setArchivedNotifs] = useState([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Modals
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Push notification permission detection
  useEffect(() => {
    if (isPushSupported()) {
      setPushStatus(Notification.permission);
    }
  }, []);

  // Fetch archived notifications from backend
  const fetchArchived = useCallback(async () => {
    setLoadingArchived(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const requests = [axios.get(`${API}/api/notifications?limit=100`, { headers })];
      if (canAccessAdminFeeds) {
        requests.push(axios.get(`${API}/api/notifications/admin?limit=100`, { headers }));
      }
      const responses = await Promise.all(requests);
      const empList = (responses[0]?.data || []).filter((n) => n.is_archived === 1);
      const adminList = (responses[1]?.data || [])
        .filter((n) => n.is_archived === 1)
        .map((n) => ({ ...n, _source: "admin" }));

      const combined = [...empList.map((n) => ({ ...n, _source: "employee" })), ...adminList];
      setArchivedNotifs(combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) {
      console.error("Error fetching archived notifications:", e);
    } finally {
      setLoadingArchived(false);
    }
  }, [canAccessAdminFeeds]);

  useEffect(() => {
    if (activeTab === "archive") {
      fetchArchived();
    }
  }, [activeTab, fetchArchived]);

  // Request browser push permission
  const handleRequestPush = async () => {
    if (!isPushSupported()) return;
    const granted = await requestPushPermission();
    setPushStatus(granted ? "granted" : "denied");
  };

  // Test sound chime
  const handleTestSound = () => {
    playNotificationSound();
  };

  // Manual refresh with rotating icon animation
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshNotifications();
      if (activeTab === "archive") {
        await fetchArchived();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Fetch Tasks for Task Modal
  const handleOpenTasksModal = async () => {
    setShowTasksModal(true);
    setLoadingTasks(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/task`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(res.data || []);
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Consolidate Active Notifications based on user role & selected scope
  const activeNotifs = useMemo(() => {
    let list = [];
    if (canAccessAdminFeeds) {
      if (sourceScope === "admin") {
        list = adminNotifications.map((n) => ({ ...n, _source: "admin" }));
      } else if (sourceScope === "employee") {
        list = notifications.map((n) => ({ ...n, _source: "employee" }));
      } else {
        list = [
          ...notifications.map((n) => ({ ...n, _source: "employee" })),
          ...adminNotifications.map((n) => ({ ...n, _source: "admin" })),
        ];
      }
    } else {
      list = notifications.map((n) => ({ ...n, _source: "employee" }));
    }

    // Filter out archived if in inbox view
    return list.filter((n) => n.is_archived !== 1);
  }, [canAccessAdminFeeds, sourceScope, notifications, adminNotifications]);

  // Determine current active list (Inbox vs Archive)
  const currentList = activeTab === "inbox" ? activeNotifs : archivedNotifs;

  // Compute category breakdown metrics for filter cards
  const metrics = useMemo(() => {
    const total = activeNotifs.length;
    const unread = activeNotifs.filter((n) => n.is_read === 0).length;
    const missed = activeNotifs.filter(
      (n) => n.type === "missed_reminder_alert" || n.type === "missed_reminder"
    ).length;
    const targets = activeNotifs.filter(
      (n) => n.type === "target_completed" || n.type === "target_achievement"
    ).length;
    const tasksDue = activeNotifs.filter(
      (n) =>
        n.type === "task_not_completed" ||
        n.type === "overdue_task" ||
        n.type === "daily_task_summary"
    ).length;

    return { total, unread, missed, targets, tasksDue };
  }, [activeNotifs]);

  // Filter and Sort Notifications
  const processedNotifs = useMemo(() => {
    let result = [...currentList];

    // Read status filter
    if (readFilter === "unread") {
      result = result.filter((n) => n.is_read === 0);
    } else if (readFilter === "read") {
      result = result.filter((n) => n.is_read === 1);
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((n) => {
        const config = getConfig(n.type);
        return config.category === categoryFilter;
      });
    }

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((n) => {
        const msg = (n.message || n.description || n.data?.message || "").toLowerCase();
        const client = (n.data?.customerName || "").toLowerCase();
        const staff = (n.data?.userName || n.employee_name || "").toLowerCase();
        const notes = (n.data?.reminderNotes || "").toLowerCase();
        const phone = (n.data?.mobileNumber || n.data?.mobile || "").toLowerCase();
        return (
          msg.includes(q) ||
          client.includes(q) ||
          staff.includes(q) ||
          notes.includes(q) ||
          phone.includes(q)
        );
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "priority") {
        const pRank = { urgent: 3, high: 2, medium: 1, normal: 0 };
        const pa = pRank[a.priority || getConfig(a.type).priority] || 0;
        const pb = pRank[b.priority || getConfig(b.type).priority] || 0;
        if (pb !== pa) return pb - pa;
      }
      const da = new Date(a.created_at || a.timestamp || 0);
      const db = new Date(b.created_at || b.timestamp || 0);
      return sortBy === "oldest" ? da - db : db - da;
    });

    return result;
  }, [currentList, readFilter, categoryFilter, searchTerm, sortBy]);

  // Group by Date ("Today", "Yesterday", "Earlier This Week", "Older")
  const groupedNotifs = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      "Earlier This Week": [],
      Older: [],
    };

    processedNotifs.forEach((n) => {
      const dateVal = n.created_at || n.timestamp;
      const groupKey = getDateGroupLabel(dateVal);
      if (groups[groupKey]) {
        groups[groupKey].push(n);
      } else {
        groups.Older.push(n);
      }
    });

    return Object.entries(groups).filter(([_, items]) => items.length > 0);
  }, [processedNotifs]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleMarkRead = async (id, source) => {
    if (source === "admin" || (canAccessAdminFeeds && adminNotifications.some((n) => n.id === id))) {
      await markAdminAsRead(id);
    } else {
      await markAsRead(id);
    }
  };

  const handleMarkUnread = async (id, source) => {
    // Optional unread endpoint fallback
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const endpoint = source === "admin" ? `${API}/api/notifications/admin/${id}/unread` : `${API}/api/notifications/${id}/unread`;
      await axios.put(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } });
      refreshNotifications();
    } catch {
      // Graceful fallback
    }
  };

  const handleArchive = async (id, source) => {
    if (source === "admin" || (canAccessAdminFeeds && adminNotifications.some((n) => n.id === id))) {
      await archiveAdminNotification(id);
    } else {
      await archiveNotification(id);
    }
    refreshNotifications();
    if (activeTab === "archive") fetchArchived();
  };

  const handleUnarchive = async (id, source) => {
    if (source === "admin" || (canAccessAdminFeeds && adminNotifications.some((n) => n.id === id))) {
      await unarchiveAdminNotification(id);
    } else {
      await unarchiveNotification(id);
    }
    refreshNotifications();
    fetchArchived();
  };

  const handleDelete = async (id, source) => {
    if (!window.confirm("Permanently delete this notification?")) return;
    if (source === "admin" || (canAccessAdminFeeds && adminNotifications.some((n) => n.id === id))) {
      await deleteAdminNotification(id);
    } else {
      await deleteNotification(id);
    }
    refreshNotifications();
    if (activeTab === "archive") fetchArchived();
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    refreshNotifications();
  };

  // ── Batch Selection Handlers ────────────────────────────────────────────────
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllInView = () => {
    if (selectedIds.size === processedNotifs.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(processedNotifs.map((n) => n.id || n.dbId));
      setSelectedIds(allIds);
    }
  };

  const handleBatchMarkRead = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleMarkRead(id);
    }
    setSelectedIds(new Set());
    refreshNotifications();
  };

  const handleBatchArchive = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      if (activeTab === "archive") {
        await handleUnarchive(id);
      } else {
        await handleArchive(id);
      }
    }
    setSelectedIds(new Set());
    refreshNotifications();
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} selected notifications?`)) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await handleDelete(id);
    }
    setSelectedIds(new Set());
    refreshNotifications();
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/80 p-4 md:p-8">
      {/* ── Top Header & Global Actions ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <Bell size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Notification Center
                  </h1>
                  {metrics.unread > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm">
                      {metrics.unread} new
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                  Stay updated on lead reminders, completed targets, overdue tasks, and CRM alerts.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Live Refresh Button */}
            <button
              onClick={handleManualRefresh}
              className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm cursor-pointer ${
                isRefreshing ? "opacity-50 pointer-events-none" : ""
              }`}
              title="Refresh alerts"
            >
              <RefreshCw size={17} className={isRefreshing ? "animate-spin text-indigo-600" : ""} />
            </button>

            {/* Chime Sound Test */}
            <button
              onClick={handleTestSound}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition shadow-sm cursor-pointer"
              title="Test notification sound chime"
            >
              <Volume2 size={17} />
            </button>

            {/* Desktop Push Permissions Toggle */}
            {isPushSupported() && (
              <>
                {pushStatus !== "granted" ? (
                  <button
                    onClick={handleRequestPush}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>Enable Push Notifications</span>
                  </button>
                ) : (
                  <div className="px-3 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 flex items-center gap-1.5 shadow-sm">
                    <CheckCircle size={14} className="text-emerald-600" />
                    <span>Push Active</span>
                  </div>
                )}
              </>
            )}

            {/* Inspect Task Statuses Modal */}
            <button
              onClick={handleOpenTasksModal}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <ClipboardList size={14} className="text-indigo-600" />
              <span>Inspect Tasks</span>
            </button>

            {/* Mark All Read */}
            {metrics.unread > 0 && activeTab === "inbox" && (
              <button
                onClick={handleMarkAllRead}
                className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck size={15} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Interactive Metric Cards Strip ───────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mt-6">
          {/* Total Alerts */}
          <div
            onClick={() => {
              setCategoryFilter("all");
              setReadFilter("all");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              categoryFilter === "all" && readFilter === "all"
                ? "bg-white shadow-md border-indigo-500 ring-2 ring-indigo-500/10"
                : "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">All Alerts</span>
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Bell size={14} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">{metrics.total}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Inbox notifications</p>
          </div>

          {/* Unread Alerts */}
          <div
            onClick={() => {
              setReadFilter(readFilter === "unread" ? "all" : "unread");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              readFilter === "unread"
                ? "bg-indigo-50/70 shadow-md border-indigo-500 ring-2 ring-indigo-500/10"
                : "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Unread</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                <Inbox size={14} />
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-700 mt-2">{metrics.unread}</p>
            <p className="text-[11px] text-indigo-500/80 mt-0.5">Need attention</p>
          </div>

          {/* Missed Reminders */}
          <div
            onClick={() => {
              setCategoryFilter(categoryFilter === "reminders" ? "all" : "reminders");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              categoryFilter === "reminders"
                ? "bg-amber-50/70 shadow-md border-amber-500 ring-2 ring-amber-500/10"
                : "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Missed Calls</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
                <AlertTriangle size={14} />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-700 mt-2">{metrics.missed}</p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Scheduled leads</p>
          </div>

          {/* Targets Achieved */}
          <div
            onClick={() => {
              setCategoryFilter(categoryFilter === "targets" ? "all" : "targets");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              categoryFilter === "targets"
                ? "bg-emerald-50/70 shadow-md border-emerald-500 ring-2 ring-emerald-500/10"
                : "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Target Wins</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Trophy size={14} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-2">{metrics.targets}</p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5">Goals accomplished</p>
          </div>

          {/* Overdue / Due Tasks */}
          <div
            onClick={() => {
              setCategoryFilter(categoryFilter === "tasks" ? "all" : "tasks");
            }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              categoryFilter === "tasks"
                ? "bg-purple-50/70 shadow-md border-purple-500 ring-2 ring-purple-500/10"
                : "bg-white/80 hover:bg-white border-slate-200 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Tasks & Action</span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                <ClipboardList size={14} />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700 mt-2">{metrics.tasksDue}</p>
            <p className="text-[11px] text-purple-600/80 mt-0.5">Pending updates</p>
          </div>
        </div>

        {/* ── Controls, Filter Tabs & Search Bar ────────────────────────────── */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Inbox vs Archive Segmented Control */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl w-fit">
              <button
                onClick={() => {
                  setActiveTab("inbox");
                  setSelectedIds(new Set());
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === "inbox" ? "bg-white shadow-sm text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Inbox size={15} />
                <span>Inbox Alerts</span>
                {metrics.unread > 0 && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab("archive");
                  setSelectedIds(new Set());
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                  activeTab === "archive" ? "bg-white shadow-sm text-indigo-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Archive size={15} />
                <span>Archive Vault</span>
                {archivedNotifs.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-md bg-slate-100 text-[10px] text-slate-600">
                    {archivedNotifs.length}
                  </span>
                )}
              </button>
            </div>

            {/* Admin Source Scope (if admin) */}
            {canAccessAdminFeeds && (
              <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit">
                {[
                  { key: "all", label: "All Feeds" },
                  { key: "admin", label: "Admin Alerts" },
                  { key: "employee", label: "My Alerts" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSourceScope(s.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      sourceScope === s.key ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Pills & Search & Sort */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {[
                { key: "all", label: "All Categories" },
                { key: "reminders", label: "Reminders" },
                { key: "targets", label: "Targets & Wins" },
                { key: "tasks", label: "Tasks & Overdue" },
                { key: "approvals", label: "Approvals" },
                { key: "whatsapp", label: "WhatsApp" },
              ].map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategoryFilter(c.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    categoryFilter === c.key
                      ? "bg-indigo-600 text-white shadow-sm font-bold"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-2 ml-auto w-full lg:w-auto">
              {/* Search input */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm flex-1 lg:w-72">
                <Search size={14} className="text-slate-400" />
                <input
                  className="outline-none text-xs bg-transparent w-full text-slate-900 placeholder:text-slate-400"
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="cursor-pointer text-slate-400 hover:text-slate-700">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white shadow-sm text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-300"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="priority">Priority First</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Batch Selection Floating Bar ─────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-30 mt-4 p-3.5 bg-slate-900 text-white rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold">
                {selectedIds.size} notification{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === "inbox" && (
                <button
                  onClick={handleBatchMarkRead}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck size={14} />
                  <span>Mark Read</span>
                </button>
              )}

              <button
                onClick={handleBatchArchive}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <Archive size={14} />
                <span>{activeTab === "archive" ? "Restore" : "Archive"}</span>
              </button>

              <button
                onClick={handleBatchDelete}
                className="px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Delete</span>
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs transition cursor-pointer"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* ── Notification Feed / List ─────────────────────────────────────── */}
        <div className="mt-6 space-y-6">
          {/* Header Row with Select All */}
          {processedNotifs.length > 0 && (
            <div className="flex items-center justify-between px-2 text-xs text-slate-500 font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedIds.size === processedNotifs.length && processedNotifs.length > 0}
                  onChange={handleSelectAllInView}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Select All ({processedNotifs.length} items)</span>
              </label>

              <span>
                Showing {processedNotifs.length} {activeTab === "archive" ? "archived" : "active"} item{processedNotifs.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Loading or Empty State */}
          {activeTab === "archive" && loadingArchived ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="w-8 h-8 rounded-full border-3 border-indigo-200 border-t-indigo-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Accessing notification archives...</p>
            </div>
          ) : processedNotifs.length === 0 ? (
            <div className="p-16 rounded-3xl bg-white border border-slate-200 text-center shadow-sm max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                {activeTab === "archive" ? <Archive size={28} /> : <Inbox size={28} />}
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {searchTerm || categoryFilter !== "all" || readFilter !== "all"
                  ? "No matching notifications found"
                  : activeTab === "archive"
                  ? "Your archive vault is empty"
                  : "You're all caught up!"}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {searchTerm || categoryFilter !== "all" || readFilter !== "all"
                  ? "Try resetting your search query or filters to display other notifications."
                  : activeTab === "archive"
                  ? "Notifications archived from your inbox will appear safely preserved here."
                  : "No pending reminders, alerts, or incomplete task notifications in your feed."}
              </p>

              {(searchTerm || categoryFilter !== "all" || readFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setReadFilter("all");
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            /* Grouped List */
            groupedNotifs.map(([groupName, items]) => (
              <div key={groupName} className="space-y-3">
                <div className="flex items-center gap-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {groupName}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[11px] font-semibold text-slate-400">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {items.map((n) => (
                    <NotifCard
                      key={n.id || n.dbId}
                      n={n}
                      isSelected={selectedIds.has(n.id || n.dbId)}
                      onToggleSelect={handleToggleSelect}
                      onMarkRead={handleMarkRead}
                      onMarkUnread={handleMarkUnread}
                      onArchive={activeTab === "archive" ? handleUnarchive : handleArchive}
                      onDelete={handleDelete}
                      showArchived={activeTab === "archive"}
                      onShowDetail={setSelectedNotif}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {selectedNotif && (
        <NotifDetailPopup
          notification={selectedNotif}
          onClose={() => setSelectedNotif(null)}
          onMarkRead={handleMarkRead}
          onArchive={activeTab === "archive" ? handleUnarchive : handleArchive}
        />
      )}

      {/* ── Live Tasks Modal ──────────────────────────────────────────────── */}
      <TasksSummaryModal
        isOpen={showTasksModal}
        onClose={() => setShowTasksModal(false)}
        tasks={tasks}
        loading={loadingTasks}
        onRefresh={handleOpenTasksModal}
      />
    </div>
  );
};

export default Notifications;
