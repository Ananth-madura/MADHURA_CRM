import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Bell, Phone, Clock, CheckCircle2 } from "lucide-react";
import { notificationSocket } from "../socket/socket";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config/api";
import { showPushNotification, requestPushPermission, playNotificationSound } from "../utils/pushNotifications";

// How long the user has to click "OK" before the reminder is treated as missed.
const GRACE_MS = 5 * 60 * 1000; // 5 minutes

const getAuthConfig = () => {
  const token = localStorage.getItem("token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

// Build a local Date from a reminder's date ("YYYY-MM-DD…") + time ("HH:MM:SS").
const reminderDateTime = (reminder) => {
  const dateStr = (reminder.reminder_date || reminder.reminderDate || "")
    .toString()
    .slice(0, 10);
  const timeStr = (reminder.reminder_time || reminder.reminderTime || "00:00:00")
    .toString()
    .slice(0, 8);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi, s] = timeStr.split(":").map((n) => Number(n) || 0);
  const dt = new Date(y, mo - 1, d, h, mi, s);
  return isNaN(dt.getTime()) ? null : dt;
};

// Normalize a reminder coming from either the socket payload or the REST poll.
const normalize = (r) => ({
  id: r.id || r.reminderId,
  leadId: r.lead_id || r.leadId,
  leadType: r.lead_type || r.leadType || "telecall",
  customerName: r.customer_name || r.customerName || "this customer",
  mobileNumber: r.mobile_number || r.mobileNumber || "",
  notes: r.reminder_notes || r.reminderNotes || "",
  reminder_date: r.reminder_date || r.reminderDate,
  reminder_time: r.reminder_time || r.reminderTime,
});

const pad = (n) => String(n).padStart(2, "0");

export default function ReminderPopup() {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]); // reminders waiting to be shown
  const [active, setActive] = useState(null); // the one currently on screen
  const [remaining, setRemaining] = useState(GRACE_MS);

  // Reminders we've already surfaced this session (so the socket event, the
  // exact-time timer and the recovery poll never show the same one twice).
  const handledRef = useRef(new Set());
  // Pending exact-time timers keyed by reminder id.
  const timersRef = useRef(new Map());

  // ── Enqueue a reminder (deduped) and fire an OS desktop notification ──────
  const enqueue = useCallback((raw) => {
    const r = normalize(raw);
    if (!r.id || handledRef.current.has(r.id)) return;

    // Skip anything already past its 5-minute grace — that's a missed reminder,
    // not a live popup. (Future ones are scheduled, not enqueued.)
    const dt = reminderDateTime(r);
    if (dt && Date.now() > dt.getTime() + GRACE_MS) return;

    handledRef.current.add(r.id);
    setQueue((prev) => [...prev, r]);

    // OS-level desktop notification (works even if this tab is in the background).
    try {
      showPushNotification("🔔 Reminder Now", {
        body: `Follow up with ${r.customerName}${r.mobileNumber ? ` (${r.mobileNumber})` : ""}${r.notes ? ` — ${r.notes}` : ""}`,
        tag: `reminder-${r.id}`,
        requireInteraction: true,
        onClick: () => window.focus(),
      });
    } catch (_) {}

    // Play pleasant audio chime
    playNotificationSound();
  }, []);

  // ── Schedule exact-time popups for today's pending reminders ──────────────
  const scheduleToday = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API}/api/leads/my-reminders/today`, getAuthConfig());
      const now = Date.now();
      (res.data || []).forEach((row) => {
        const r = normalize(row);
        if (!r.id || handledRef.current.has(r.id)) return;
        const dt = reminderDateTime(r);
        if (!dt) return;
        const delta = dt.getTime() - now;

        if (delta <= 0) {
          // Already due — show now if still inside the grace window.
          if (delta > -GRACE_MS) enqueue(row);
        } else if (delta <= 75 * 1000) {
          // Fires within the next refresh cycle: arm a precise timer so the
          // popup lands at the exact second the user chose.
          if (!timersRef.current.has(r.id)) {
            const t = setTimeout(() => {
              timersRef.current.delete(r.id);
              enqueue(row);
            }, delta);
            timersRef.current.set(r.id, t);
          }
        }
        // Further-out reminders get armed on a later refresh tick.
      });
    } catch (_) {
      /* offline / non-critical — socket + push still cover the popup */
    }
  }, [user, enqueue]);

  // ── Socket: owner-only blocking popup pushed by the backend scheduler ─────
  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      requestPushPermission();
    }
    const handler = (payload) => enqueue(payload);
    notificationSocket.on("reminder_popup", handler);
    return () => notificationSocket.off("reminder_popup", handler);
  }, [user, enqueue]);

  // ── Poll today's reminders (recovery + exact-time arming) ─────────────────
  useEffect(() => {
    if (!user) {
      // Reset everything on logout.
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      handledRef.current.clear();
      setQueue([]);
      setActive(null);
      return;
    }
    scheduleToday();
    const iv = setInterval(scheduleToday, 60 * 1000);
    return () => clearInterval(iv);
  }, [user, scheduleToday]);

  // ── Promote next queued reminder when nothing is showing ──────────────────
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
    const dt = reminderDateTime(next);
    const deadline = dt ? dt.getTime() + GRACE_MS : Date.now() + GRACE_MS;
    setRemaining(Math.max(0, deadline - Date.now()));
  }, [active, queue]);

  // ── Live countdown for the active popup; auto-miss at zero ────────────────
  useEffect(() => {
    if (!active) return;
    const dt = reminderDateTime(active);
    const deadline = dt ? dt.getTime() + GRACE_MS : Date.now() + GRACE_MS;
    const tick = () => {
      const left = deadline - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        // Time's up — leave it for the backend to mark Missed and move on.
        setActive(null);
      }
    };
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [active]);

  const acknowledge = useCallback(async () => {
    if (!active) return;
    const id = active.id;
    setActive(null);
    try {
      await axios.put(
        `${API}/api/leads/reminders/${id}`,
        { status: "Done" },
        getAuthConfig(),
      );
    } catch (_) {
      /* non-critical: backend grace will still resolve it */
    }
  }, [active]);

  if (!active) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const schedTime = (active.reminder_time || "").toString().slice(0, 5);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "rp-fade 0.2s ease",
      }}
    >
      <style>{`
        @keyframes rp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rp-pop { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes rp-ring { 0%,100% { transform: rotate(0) } 20% { transform: rotate(12deg) } 40% { transform: rotate(-10deg) } 60% { transform: rotate(8deg) } 80% { transform: rotate(-6deg) } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
          animation: "rp-pop 0.28s cubic-bezier(0.175,0.885,0.32,1.275)",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            padding: "22px 24px 18px",
            textAlign: "center",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 10px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={30} color="#fff" style={{ animation: "rp-ring 1.4s ease-in-out infinite" }} />
          </div>
          <div style={{ fontSize: "19px", fontWeight: 800, letterSpacing: "0.01em" }}>
            Reminder
          </div>
          <div style={{ fontSize: "12.5px", opacity: 0.85, marginTop: "2px" }}>
            It's time to follow up
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 8px" }}>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 700,
              color: "#1e293b",
              textAlign: "center",
              marginBottom: "6px",
              wordBreak: "break-word",
            }}
          >
            {active.customerName}
          </div>

          {active.mobileNumber && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                fontSize: "14px",
                color: "#475569",
                marginBottom: "6px",
              }}
            >
              <Phone size={14} />
              <a href={`tel:${active.mobileNumber}`} style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>
                {active.mobileNumber}
              </a>
            </div>
          )}

          {active.notes && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "10px 12px",
                fontSize: "13.5px",
                color: "#334155",
                marginTop: "10px",
                wordBreak: "break-word",
              }}
            >
              {active.notes}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "14px",
              fontSize: "12.5px",
              color: remaining <= 60000 ? "#dc2626" : "#64748b",
              fontWeight: 600,
            }}
          >
            <Clock size={14} />
            {schedTime && <span>Scheduled {schedTime} · </span>}
            <span>
              Auto-missed in {pad(mins)}:{pad(secs)}
            </span>
          </div>
        </div>

        {/* Action */}
        <div style={{ padding: "12px 24px 22px" }}>
          <button
            onClick={acknowledge}
            style={{
              width: "100%",
              padding: "13px",
              border: "none",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 8px 20px rgba(22,163,74,0.35)",
            }}
          >
            <CheckCircle2 size={18} /> OK, Got it
          </button>
        </div>
      </div>
    </div>
  );
}
