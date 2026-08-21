import React, { useState, useEffect } from "react";
import {
  Bell, CheckCircle2, RefreshCw, XCircle, Clock, Send,
  Settings, Play, Plus, Loader2, Sparkles, Check, AlertCircle,
  Calendar, CreditCard, ShieldCheck, FileText, UserCheck, Trash2,
  Layers, MessageSquare, ArrowRight, CornerDownRight, CheckSquare, Save
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";

const REMINDER_TYPES = [
  {
    value: "appointment_reminder",
    label: "📅 Service & Appointment Visit",
    desc: "24h before scheduled technician visit with [Confirm] [Reschedule] [Cancel]",
    icon: Calendar,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    defaultOptions: [
      { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
    ],
    defaultText: "Hi {name}, reminder for your upcoming service appointment scheduled with our team tomorrow. Please confirm your availability:",
  },
  {
    value: "payment_due",
    label: "💰 Payment Due Invoice",
    desc: "1 day before invoice due date with [Already Paid] [Send Invoice] [Speak to Accounts]",
    icon: CreditCard,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    defaultOptions: [
      { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
    ],
    defaultText: "Hi {name}, gentle reminder that payment for invoice {invoice_no} is due on {due_date}. Please choose an option below:",
  },
  {
    value: "quotation_followup",
    label: "💼 Quotation & Proposal Followup",
    desc: "3 days after quote proposal with [Approve & Proceed] [Need Changes] [Not Interested]",
    icon: FileText,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    defaultOptions: [
      { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
    ],
    defaultText: "Hello {name}, following up on your quotation proposal {quotation_no} for {service}. Would you like to approve and proceed?",
  },
  {
    value: "amc_renewal",
    label: "🛡️ AMC Contract Renewal",
    desc: "7 days before maintenance agreement expires with [Renew AMC] [Speak to Engineer]",
    icon: ShieldCheck,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    defaultOptions: [
      { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
      { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
    ],
    defaultText: "Dear {name}, your Annual Maintenance Contract (AMC) is expiring soon. Please confirm your renewal preference:",
  },
  {
    value: "lead_followup",
    label: "🎯 Lead Interest Check",
    desc: "Follow-up with fresh leads with [Interested] [Book Demo] [Not Now]",
    icon: UserCheck,
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    defaultOptions: [
      { id: "btn_interested", label: "👍 Interested", action: "confirm_lead_interest" },
      { id: "btn_demo", label: "📅 Book Demo", action: "reschedule_appointment" },
      { id: "btn_not_now", label: "❌ Not Now", action: "cancel_appointment" },
    ],
    defaultText: "Hi {name}, following up on your inquiry for {service}. Let us know if you would like a quick demo or technical consultation:",
  },
];

export default function WhatsAppInteractiveReminders() {
  const [summary, setSummary] = useState({
    total: 0,
    confirmed: 0,
    rescheduled: 0,
    cancelled: 0,
    paid: 0,
    pending: 0,
    failed: 0,
    responseRate: 0,
  });
  const [reminders, setReminders] = useState([]);
  const [settings, setSettings] = useState({
    appointment_reminders_enabled: true,
    appointment_reminder_hours_before: 24,
    payment_due_reminders_enabled: true,
    payment_due_days_before: 1,
    lead_followup_reminders_enabled: true,
    amc_renewal_reminders_enabled: true,
    amc_renewal_days_before: 7,
    confirmation_auto_update_crm: true,
    notify_staff_on_response: true,
    default_confirm_prompt: "",
    default_reschedule_prompt: "",
    default_cancel_prompt: "",
  });

  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Instant Send Modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendForm, setSendForm] = useState({
    phone: "",
    contact_name: "Rahul Sharma",
    reminder_type: "appointment_reminder",
    title: "Appointment Reminder: Service Visit",
    message_text: "Hi Rahul Sharma, reminder for your upcoming service appointment scheduled with our team tomorrow. Please confirm your availability:",
    options: REMINDER_TYPES[0].defaultOptions,
  });
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Trigger Check State
  const [triggeringCheck, setTriggeringCheck] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sumRes, remRes, setRes] = await Promise.all([
        axios.get(`${API}/api/wa/reminders/summary`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/reminders/list`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/reminders/settings`, { headers: headers() }).catch(() => null),
      ]);

      if (sumRes?.data) setSummary(sumRes.data);
      if (remRes?.data) setReminders(remRes.data);
      if (setRes?.data) setSettings(setRes.data);
    } catch (err) {
      console.error("Error loading interactive reminders:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReminderTypeChange = (typeVal) => {
    const matched = REMINDER_TYPES.find((t) => t.value === typeVal) || REMINDER_TYPES[0];
    setSendForm((prev) => ({
      ...prev,
      reminder_type: typeVal,
      title: `${matched.label.replace(/[^a-zA-Z &]/g, "").trim()}`,
      message_text: matched.defaultText.replace("{name}", prev.contact_name || "Customer"),
      options: matched.defaultOptions,
    }));
  };

  const handleSendNow = async (e) => {
    e.preventDefault();
    if (!sendForm.phone.trim()) return alert("Phone number is required");
    setSending(true);
    setSendSuccess(false);
    try {
      await axios.post(`${API}/api/wa/reminders/send-now`, sendForm, { headers: headers() });
      setSendSuccess(true);
      fetchData();
      setTimeout(() => {
        setSendSuccess(false);
        setShowSendModal(false);
      }, 1800);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to send interactive reminder");
    }
    setSending(false);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await axios.put(`${API}/api/wa/reminders/settings`, settings, { headers: headers() });
      setSettingsSaved(true);
      setTimeout(() => {
        setSettingsSaved(false);
        setShowSettingsModal(false);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.error || err.message || "Failed to save settings");
    }
    setSavingSettings(false);
  };

  const handleTriggerSchedulers = async () => {
    setTriggeringCheck(true);
    setTriggerMessage("");
    try {
      const { data } = await axios.post(`${API}/api/wa/reminders/trigger-check`, { scheduler_type: "all" }, { headers: headers() });
      setTriggerMessage(data.message || "Automated reminder checks executed!");
      fetchData();
      setTimeout(() => setTriggerMessage(""), 4000);
    } catch (err) {
      alert(err.response?.data?.error || "Check failed");
    }
    setTriggeringCheck(false);
  };

  const handleResend = async (id) => {
    if (!window.confirm("Resend this interactive reminder to customer now?")) return;
    try {
      await axios.post(`${API}/api/wa/reminders/${id}/resend`, {}, { headers: headers() });
      alert("Reminder resent successfully!");
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Resend failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this reminder record?")) return;
    try {
      await axios.delete(`${API}/api/wa/reminders/${id}`, { headers: headers() });
      fetchData();
    } catch {}
  };

  const filteredReminders = reminders.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterType !== "all" && r.reminder_type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (r.contact_name && r.contact_name.toLowerCase().includes(term)) ||
        (r.phone && r.phone.includes(term)) ||
        (r.title && r.title.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* ── Top Summary & Response Rate Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase">
            <span>Total Sent</span>
            <Send size={15} className="text-gray-400" />
          </div>
          <p className="text-2xl font-black text-gray-900">{summary.total || 0}</p>
          <span className="text-[11px] text-gray-400">Interactive Requests</span>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase">
            <span>Confirmed</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900">{summary.confirmed || 0}</p>
          <span className="text-[11px] font-bold text-emerald-700">
            {summary.total > 0 ? `${Math.round((summary.confirmed / summary.total) * 100)}% Conversion` : "0%"}
          </span>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase">
            <span>Rescheduled</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-900">{summary.rescheduled || 0}</p>
          <span className="text-[11px] text-amber-700 font-semibold">Gated Followup Set</span>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-rose-800 text-xs font-bold uppercase">
            <span>Cancelled</span>
            <XCircle size={16} className="text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-900">{summary.cancelled || 0}</p>
          <span className="text-[11px] text-rose-700 font-semibold">Closed in CRM</span>
        </div>

        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase">
            <span>Paid / Invoiced</span>
            <CreditCard size={16} className="text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-900">{summary.paid || 0}</p>
          <span className="text-[11px] text-purple-700 font-semibold">Payment Received</span>
        </div>

        <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-indigo-800 text-xs font-bold uppercase">
            <span>Response Rate</span>
            <Sparkles size={16} className="text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-900">{summary.responseRate || 0}%</p>
          <span className="text-[11px] font-bold text-indigo-700">2-Way Customer Action</span>
        </div>
      </div>

      {/* ── Action Header & Schedulers Controls ── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bell size={18} className="text-amber-600" />
              <span>Interactive WhatsApp Reminders & 2-Way Confirmations</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              ⚡ Multi-Gated Active
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Automates appointment visits, invoice dues, quotation followups, and contract renewals with dynamic customer confirmation gateways.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {triggerMessage && (
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fade-in">
              {triggerMessage}
            </span>
          )}

          <button
            onClick={handleTriggerSchedulers}
            disabled={triggeringCheck}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            title="Scan database and dispatch tomorrow's reminders right now"
          >
            {triggeringCheck ? <Loader2 size={14} className="animate-spin text-amber-600" /> : <Play size={14} />}
            <span>Run Schedulers Now</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Settings size={14} />
            <span>Settings & Prompts</span>
          </button>

          <button
            onClick={() => setShowSendModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-amber-600/20"
          >
            <Plus size={15} />
            <span>Send Instant Reminder</span>
          </button>
        </div>
      </div>

      {/* ── Active Automated Reminder Pipelines ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REMINDER_TYPES.slice(0, 4).map((pipe) => (
          <div key={pipe.value} className="p-4 bg-white rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pipe.color}`}>
                  {pipe.value === "appointment_reminder" ? "Daily 09:00 AM" : pipe.value === "payment_due" ? "Daily 10:00 AM" : pipe.value === "quotation_followup" ? "Daily 11:30 AM" : "Daily 12:00 PM"}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h4 className="font-bold text-gray-900 text-xs">{pipe.label}</h4>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{pipe.desc}</p>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Interactive Gateways:</span>
              <div className="flex flex-wrap gap-1">
                {pipe.defaultOptions.map((opt) => (
                  <span key={opt.id} className="text-[10px] font-semibold bg-slate-100 text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200/60">
                    {opt.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-700 mr-1">Status:</span>
          {["all", "confirmed", "rescheduled", "cancelled", "paid", "sent"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-xl font-bold transition capitalize ${
                filterStatus === st
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-slate-100 text-gray-600 hover:bg-slate-200"
              }`}
            >
              {st === "sent" ? "Pending Reply" : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search phone, name, or title..."
            className="px-3.5 py-1.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-60 text-xs"
          />
          <button
            onClick={fetchData}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-gray-600 transition shrink-0"
            title="Refresh logs"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Reminders & Logs Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-xs">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-amber-600" />
          </div>
        ) : filteredReminders.length === 0 ? (
          <div className="text-center py-16 p-6">
            <Bell size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="font-bold text-gray-700">No interactive reminder logs found</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Click "Send Instant Reminder" or "Run Schedulers Now" to dispatch interactive confirmations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Reminder Type & Title</th>
                  <th className="py-3 px-4">Sent / Scheduled</th>
                  <th className="py-3 px-4">Status & Gated Action</th>
                  <th className="py-3 px-4">Customer Response</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReminders.map((rem) => {
                  const isConfirmed = rem.status === "confirmed";
                  const isRescheduled = rem.status === "rescheduled";
                  const isCancelled = rem.status === "cancelled";
                  const isPaid = rem.status === "paid";

                  const statusBadgeClass = isConfirmed
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : isRescheduled
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : isCancelled
                    ? "bg-rose-100 text-rose-800 border-rose-300"
                    : isPaid
                    ? "bg-purple-100 text-purple-800 border-purple-300"
                    : "bg-gray-100 text-gray-700 border-gray-200";

                  return (
                    <tr key={rem.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900">{rem.contact_name || "Customer"}</div>
                        <div className="text-[11px] text-gray-500 font-mono">+{rem.phone}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-gray-800 capitalize block">{rem.title}</span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Type: {rem.reminder_type.replace(/_/g, " ")} {rem.reference_table ? `(${rem.reference_table} #${rem.reference_id})` : ""}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-[11px] text-gray-600">
                        <div>{new Date(rem.sent_at || rem.created_at).toLocaleDateString("en-IN")}</div>
                        <div className="text-[10px] text-gray-400">{new Date(rem.sent_at || rem.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}>
                          {isConfirmed ? <CheckCircle2 size={12} /> : isRescheduled ? <Clock size={12} /> : isCancelled ? <XCircle size={12} /> : <Clock size={12} />}
                          <span className="capitalize">{rem.status}</span>
                        </span>
                        {rem.response_action && (
                          <div className="text-[10px] text-gray-500 mt-1 font-mono">
                            Action: {rem.response_action}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {rem.response_text ? (
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 text-gray-800 text-[11px]">
                            <span className="font-semibold text-gray-900 block truncate">"{rem.response_text}"</span>
                            <span className="text-[9px] text-gray-400">
                              Received {new Date(rem.response_received_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">Awaiting customer reply...</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleResend(rem.id)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-[11px] font-bold transition"
                            title="Resend to WhatsApp"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleDelete(rem.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition"
                            title="Delete record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL 1: Send Instant Interactive Reminder ── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Send size={18} className="text-amber-600" />
                  <span>Send Instant Interactive Reminder</span>
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Dispatches a 2-way interactive message with clickable confirmation buttons.
                </p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            {sendSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Interactive Reminder Dispatched Successfully!</span>
              </div>
            )}

            <form onSubmit={handleSendNow} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Customer Mobile Number *</label>
                  <div className="flex items-center gap-1">
                    <span className="px-3 py-2 bg-slate-100 border border-gray-200 rounded-xl font-bold text-gray-600">+91</span>
                    <input
                      type="text"
                      value={sendForm.phone}
                      onChange={(e) => setSendForm({ ...sendForm, phone: e.target.value })}
                      placeholder="9876543210"
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={sendForm.contact_name}
                    onChange={(e) => setSendForm({ ...sendForm, contact_name: e.target.value })}
                    placeholder="Rahul Sharma"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Reminder Category</label>
                <select
                  value={sendForm.reminder_type}
                  onChange={(e) => handleReminderTypeChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-white font-semibold text-gray-800"
                >
                  {REMINDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Reminder Title</label>
                <input
                  type="text"
                  value={sendForm.title}
                  onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">Message Body</label>
                <textarea
                  rows={3}
                  value={sendForm.message_text}
                  onChange={(e) => setSendForm({ ...sendForm, message_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  required
                />
              </div>

              {/* Interactive Buttons Preview */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                  WhatsApp Interactive Action Buttons:
                </span>
                <div className="flex flex-wrap gap-2">
                  {sendForm.options?.map((opt) => (
                    <div key={opt.id} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <CheckSquare size={13} />
                      <span>{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !sendForm.phone}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-md shadow-amber-600/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Dispatch Interactive Reminder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Reminder Settings & Dynamic Prompts ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 text-xs space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Settings size={18} className="text-amber-600" />
                  <span>Reminder Schedulers & Confirmation Prompts</span>
                </h3>
                <p className="text-gray-500 text-[11px] mt-0.5">
                  Configure automated cron triggers, hours before dispatch, and dynamic confirmation response messages.
                </p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                ✕
              </button>
            </div>

            {settingsSaved && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Settings Saved Successfully!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">Service & Appointment Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 24h before technician visit</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appointment_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, appointment_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">Payment Due Invoice Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 1 day before invoice due date</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.payment_due_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, payment_due_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 block">AMC Contract Expiry Reminders</span>
                    <span className="text-[11px] text-gray-500">Auto-send 7 days before agreement expires</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.amc_renewal_reminders_enabled}
                    onChange={(e) => setSettings({ ...settings, amc_renewal_reminders_enabled: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Dynamic Confirmation Receipt Message</label>
                  <textarea
                    rows={2}
                    value={settings.default_confirm_prompt}
                    onChange={(e) => setSettings({ ...settings, default_confirm_prompt: e.target.value })}
                    placeholder="🎉 Thank you {name}! Your appointment has been CONFIRMED. Our executive will arrive on time."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Dynamic Reschedule Prompt Message</label>
                  <textarea
                    rows={2}
                    value={settings.default_reschedule_prompt}
                    onChange={(e) => setSettings({ ...settings, default_reschedule_prompt: e.target.value })}
                    placeholder="We understand! When would you like to reschedule your visit? Please reply with your preferred date/time."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-bold transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                >
                  {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
