import React, { useState, useEffect } from "react";
import { X, Send, Loader2, Sparkles, Smartphone, CheckCircle2, AlertCircle } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";

const REMINDER_CONFIGS = {
  payment_due: {
    title: "Payment Due Reminder",
    defaultOptions: [
      { id: "btn_paid", label: "💳 Already Paid", action: "confirm_payment" },
      { id: "btn_invoice", label: "📄 Send Invoice", action: "send_invoice_copy" },
      { id: "btn_call_acc", label: "📞 Speak to Accounts", action: "request_callback" },
    ],
    generateMessage: (name, refTitle) =>
      `Hi ${name || "Customer"}, reminder that payment for *${refTitle || "your pending invoice"}* is due. Please review your options below:`,
  },
  quotation_followup: {
    title: "Quotation Proposal Follow-up",
    defaultOptions: [
      { id: "btn_approve_quote", label: "👍 Approve & Proceed", action: "approve_quotation" },
      { id: "btn_modify_quote", label: "💬 Need Changes", action: "request_callback" },
      { id: "btn_reject_quote", label: "❌ Not Interested", action: "reject_quotation" },
    ],
    generateMessage: (name, refTitle) =>
      `Hello ${name || "Customer"}, following up on quotation proposal *${refTitle || "sent recently"}*. Would you like to approve and proceed?`,
  },
  appointment_reminder: {
    title: "Appointment / Visit Reminder",
    defaultOptions: [
      { id: "btn_confirm", label: "✅ Confirm Visit", action: "confirm_appointment" },
      { id: "btn_reschedule", label: "🔄 Reschedule", action: "reschedule_appointment" },
      { id: "btn_cancel", label: "❌ Cancel", action: "cancel_appointment" },
    ],
    generateMessage: (name, refTitle) =>
      `Hi ${name || "Customer"}, reminder for your scheduled service appointment (${refTitle || "AMC & Technical Support"}). Please confirm your availability:`,
  },
  amc_renewal: {
    title: "AMC Contract Renewal",
    defaultOptions: [
      { id: "btn_renew_amc", label: "🛡️ Renew AMC", action: "renew_amc" },
      { id: "btn_call_amc", label: "📞 Speak to Engineer", action: "request_callback" },
    ],
    generateMessage: (name, refTitle) =>
      `Dear ${name || "Valued Client"}, your Annual Maintenance Contract (AMC) *${refTitle || "Agreement"}* is expiring soon. Please choose your renewal preference:`,
  },
};

export default function SendWhatsAppReminderModal({
  isOpen,
  onClose,
  defaultPhone = "",
  defaultContactName = "",
  reminderType = "payment_due",
  refTable = null,
  refId = null,
  refTitle = "",
  onSuccess,
}) {
  const [type, setType] = useState(reminderType);
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [options, setOptions] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = REMINDER_CONFIGS[reminderType] || REMINDER_CONFIGS.payment_due;
      const initialName = defaultContactName || "Customer";
      setType(reminderType);
      setPhone(defaultPhone || "");
      setContactName(initialName);
      setTitle(refTitle ? `${config.title}: ${refTitle}` : config.title);
      setMessage(config.generateMessage(initialName, refTitle));
      setOptions(config.defaultOptions);
      setError("");
      setSuccess(false);
    }
  }, [isOpen, reminderType, defaultPhone, defaultContactName, refTitle]);

  const handleTypeChange = (newType) => {
    const config = REMINDER_CONFIGS[newType];
    if (!config) return;
    setType(newType);
    setTitle(refTitle ? `${config.title}: ${refTitle}` : config.title);
    setMessage(config.generateMessage(contactName, refTitle));
    setOptions(config.defaultOptions);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setError("Please provide a valid recipient phone number.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess(false);

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = {
        phone: phone.trim(),
        contact_name: contactName.trim(),
        reminder_type: type,
        title,
        message_text: message,
        options,
        ref_table: refTable,
        ref_id: refId,
      };

      const res = await axios.post(`${API}/api/wa/reminders/send-now`, payload, { headers });
      if (res.data?.success) {
        setSuccess(true);
        if (onSuccess) onSuccess(res.data);
        setTimeout(() => {
          onClose();
        }, 1600);
      } else {
        setError(res.data?.error || "Failed to dispatch reminder.");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to dispatch interactive reminder.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-lg tracking-tight">Send 2-Way Interactive WhatsApp Reminder</h3>
              <p className="text-amber-100 text-xs">Customer receives native clickable buttons to respond instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body: Split between Form and Live Smartphone Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0">
          {/* Left: Input Form (7 cols) */}
          <form onSubmit={handleSend} className="p-6 space-y-4 md:col-span-7 border-r border-gray-100">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>Interactive reminder dispatched successfully!</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reminder Category</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(REMINDER_CONFIGS).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleTypeChange(k)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition text-left border ${
                      type === k
                        ? "bg-amber-50 border-amber-500 text-amber-900 shadow-sm"
                        : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {REMINDER_CONFIGS[k].title.split(" ")[0]} {k === "payment_due" ? "Payment" : k === "quotation_followup" ? "Quote" : k === "appointment_reminder" ? "Visit" : "AMC"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Recipient Phone *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9840012345"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact / Client Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => {
                    setContactName(e.target.value);
                    const config = REMINDER_CONFIGS[type];
                    if (config) setMessage(config.generateMessage(e.target.value, refTitle));
                  }}
                  placeholder="e.g. Ananth Natarajan"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Message Body</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none font-mono text-[11px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">Interactive Response Buttons (Max 3)</label>
              <div className="space-y-1.5">
                {options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-gray-200">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...options];
                        next[idx].label = e.target.value;
                        setOptions(next);
                      }}
                      className="bg-transparent text-xs font-bold text-gray-800 outline-none w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || success}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/20 flex items-center gap-2 transition disabled:opacity-50"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                <span>{sending ? "Sending..." : "Send Interactive Reminder"}</span>
              </button>
            </div>
          </form>

          {/* Right: Real-time Live Phone Simulator (5 cols) */}
          <div className="p-6 bg-slate-100/70 md:col-span-5 flex flex-col items-center justify-center">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Smartphone size={13} />
              <span>Recipient Phone Preview</span>
            </div>

            {/* Smartphone Device Frame */}
            <div className="w-64 bg-slate-900 rounded-[28px] p-2.5 shadow-2xl border-4 border-slate-800">
              <div className="w-full bg-[#0b141a] rounded-[20px] overflow-hidden text-white flex flex-col min-h-[340px]">
                {/* Status Bar */}
                <div className="bg-[#202c33] px-3 py-2 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                      M
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-100 leading-tight">Madhura CRM</div>
                      <div className="text-[9px] text-emerald-400">Business Verified</div>
                    </div>
                  </div>
                </div>

                {/* Chat Stream Bubble */}
                <div className="p-2.5 flex-1 flex flex-col justify-end space-y-2">
                  <div className="bg-[#005c4b] p-2.5 rounded-2xl rounded-tr-none text-[11px] text-slate-100 shadow-md">
                    <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
                    <div className="text-[8px] text-emerald-200 text-right mt-1">10:42 AM ✓✓</div>
                  </div>

                  {/* Interactive Button Stack */}
                  <div className="space-y-1.5">
                    {options.map((opt) => (
                      <div
                        key={opt.id}
                        className="w-full py-1.5 px-3 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-center text-[11px] font-bold text-sky-400 border border-white/10 shadow-sm transition"
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-gray-500 text-center mt-3 max-w-[220px]">
              Customer taps any button on their phone to submit response back into CRM automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
