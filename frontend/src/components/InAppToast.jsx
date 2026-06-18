import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, AlertTriangle, Trophy, Clock, X, CheckCircle, ClipboardList, ChevronRight } from "lucide-react";

// ─── Toast Store (singleton, event-based) ─────────────────────────────────
let toastListeners = [];
let toastQueue = [];
let toastIdCounter = 0;

export const showInAppToast = (type, message, options = {}) => {
  const id = ++toastIdCounter;
  const toast = {
    id,
    type,
    message,
    title: options.title || getToastTitle(type),
    subtitle: options.subtitle || "",
    duration: options.duration || 6000,
    onClick: options.onClick || null,
    createdAt: Date.now(),
  };
  toastListeners.forEach((fn) => fn(toast));
  return id;
};

export const dismissInAppToast = (id) => {
  toastListeners.forEach((fn) => fn({ _dismiss: id }));
};

function getToastTitle(type) {
  switch (type) {
    case "reminder_due": return "⏰ Reminder Due Soon";
    case "reminder_due_now": return "🔔 Reminder Now";
    case "missed_reminder_alert": return "⚠️ Missed Reminder";
    case "target_completed": return "🎉 Target Completed!";
    case "task_not_completed": return "⏰ Task Overdue";
    case "daily_task_summary": return "📊 Daily Summary";
    case "new_lead": return "📞 New Lead";
    case "lead_converted": return "🎉 Lead Converted";
    case "task_assigned": return "📋 Task Assigned";
    default: return "🔔 Notification";
  }
}

function getToastConfig(type) {
  switch (type) {
    case "reminder_due":
    case "reminder_due_now":
      return {
        bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        border: "#764ba2",
        icon: Clock,
        iconBg: "rgba(255,255,255,0.2)",
      };
    case "missed_reminder_alert":
      return {
        bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        border: "#f5576c",
        icon: AlertTriangle,
        iconBg: "rgba(255,255,255,0.2)",
      };
    case "target_completed":
      return {
        bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        border: "#4facfe",
        icon: Trophy,
        iconBg: "rgba(255,255,255,0.2)",
      };
    case "task_not_completed":
      return {
        bg: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
        border: "#fa709a",
        icon: AlertTriangle,
        iconBg: "rgba(255,255,255,0.2)",
      };
    case "daily_task_summary":
      return {
        bg: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
        border: "#a8edea",
        icon: ClipboardList,
        iconBg: "rgba(255,255,255,0.3)",
        darkText: true,
      };
    case "lead_converted":
    case "target_achieved":
      return {
        bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
        border: "#43e97b",
        icon: CheckCircle,
        iconBg: "rgba(255,255,255,0.2)",
        darkText: true,
      };
    default:
      return {
        bg: "linear-gradient(135deg, #5645d4 0%, #8b5cf6 100%)",
        border: "#5645d4",
        icon: Bell,
        iconBg: "rgba(255,255,255,0.2)",
      };
  }
}

// ─── Single Toast Item ─────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const config = getToastConfig(toast.type);
  const Icon = config.icon;
  const textColor = config.darkText ? "#1a1a1a" : "#ffffff";

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    clearInterval(progressRef.current);
    clearTimeout(timerRef.current);
    setTimeout(() => onRemove(toast.id), 350);
  }, [leaving, onRemove, toast.id]);

  useEffect(() => {
    // Slide in
    const t = setTimeout(() => setVisible(true), 20);

    // Progress bar
    const duration = toast.duration;
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(progressRef.current);
        dismiss();
      }
    }, 50);

    // Auto dismiss
    timerRef.current = setTimeout(dismiss, duration);

    return () => {
      clearTimeout(t);
      clearInterval(progressRef.current);
      clearTimeout(timerRef.current);
    };
  }, [dismiss, toast.duration]);

  return (
    <div
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: "16px",
        padding: "0",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3), 0 8px 20px rgba(0,0,0,0.2)",
        marginBottom: "12px",
        cursor: toast.onClick ? "pointer" : "default",
        overflow: "hidden",
        width: "340px",
        maxWidth: "calc(100vw - 32px)",
        transform: visible && !leaving ? "translateX(0) scale(1)" : "translateX(120%) scale(0.9)",
        opacity: visible && !leaving ? 1 : 0,
        transition: "transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.35s ease",
        position: "relative",
      }}
      onClick={() => {
        if (toast.onClick) toast.onClick();
        dismiss();
      }}
    >
      {/* Progress bar */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        height: "3px",
        width: `${progress}%`,
        background: "rgba(255,255,255,0.5)",
        transition: "width 0.05s linear",
        borderRadius: "0 0 0 16px",
      }} />

      <div style={{ padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Icon */}
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          background: config.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          backdropFilter: "blur(10px)",
        }}>
          <Icon size={20} color={textColor} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "13px",
            fontWeight: "700",
            color: textColor,
            marginBottom: "2px",
            letterSpacing: "0.01em",
          }}>
            {toast.title}
          </div>
          <div style={{
            fontSize: "12px",
            color: config.darkText ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.88)",
            lineHeight: "1.45",
            wordBreak: "break-word",
          }}>
            {toast.message}
          </div>
          {toast.subtitle && (
            <div style={{
              fontSize: "11px",
              color: config.darkText ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.65)",
              marginTop: "4px",
            }}>
              {toast.subtitle}
            </div>
          )}
          {toast.onClick && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "6px",
              fontSize: "11px",
              fontWeight: "600",
              color: config.darkText ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.75)",
            }}>
              View details <ChevronRight size={12} />
            </div>
          )}
        </div>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "8px",
            width: "26px",
            height: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            color: textColor,
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Toast Container ───────────────────────────────────────────────────────
export function InAppToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (event) => {
      if (event._dismiss !== undefined) {
        setToasts(prev => prev.filter(t => t.id !== event._dismiss));
      } else {
        setToasts(prev => [...prev.slice(-4), event]); // max 5 toasts
      }
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        pointerEvents: "none",
      }}
    >
      {toasts.map(toast => (
        <div key={toast.id} style={{ pointerEvents: "all" }}>
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
}

export default InAppToastContainer;
