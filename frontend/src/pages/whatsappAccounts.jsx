import React, { useState, useEffect } from "react";
import {
  Smartphone, CheckCircle2, XCircle, Loader2, Settings, Wifi,
  Key, Globe, Zap, RefreshCw, AlertCircle, Shield, Bot, Send,
  BookOpen, Upload, Trash2, FileText, PhoneCall, ArrowRight,
  Copy, Check, ShieldCheck, Clock, Layers, Sparkles
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

const QUALITY_COLORS = {
  GREEN: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800", label: "Green — High Quality (Tier 1)" },
  YELLOW: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800", label: "Yellow — Medium Quality (Tier 2)" },
  RED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800", label: "Red — Low Quality Warning" },
};

export default function WhatsAppAccounts() {
  const [status, setStatus] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [config, setConfig] = useState(null);
  const [qualityRating, setQualityRating] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cloud API Form & Testing
  const [form, setForm] = useState({
    phone_number_id: "",
    access_token: "",
    waba_id: "",
    app_secret: "",
    verify_token: "crm_verify_123",
    business_account_id: "",
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Live Test Message Send
  const [testPhone, setTestPhone] = useState("");
  const [testMsgText, setTestMsgText] = useState("Hello from MADHURA CRM WhatsApp System! 🚀");
  const [sendingTestMsg, setSendingTestMsg] = useState(false);
  const [testSendResult, setTestSendResult] = useState(null);

  // AI Auto-Reply & Knowledge Base
  const [aiSettings, setAiSettings] = useState(null);
  const [aiForm, setAiForm] = useState({ enabled: false, model: "", system_prompt: "", api_key: "" });
  const [aiSaveLoading, setAiSaveLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiTestMessage, setAiTestMessage] = useState("");
  const [aiTestReply, setAiTestReply] = useState("");
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestError, setAiTestError] = useState("");
  const [kbDocs, setKbDocs] = useState([]);
  const [kbUploading, setKbUploading] = useState(false);
  const [kbError, setKbError] = useState("");

  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, cRes, qRes, aiRes, accRes] = await Promise.all([
        axios.get(`${API}/api/whatsapp/unified-status`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/config/user-config`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/analytics/quality-rating`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/wa/ai/settings`, { headers: headers() }).catch(() => null),
        axios.get(`${API}/api/whatsapp/account`, { headers: headers() }).catch(() => null),
      ]);
      if (sRes?.data) setStatus(sRes.data);
      if (accRes?.data) setAccountDetails(accRes.data);
      if (cRes?.data?.hasConfig && cRes.data.config) {
        setConfig(cRes.data.config);
        setForm((prev) => ({
          ...prev,
          phone_number_id: cRes.data.config.phone_number_id || "",
          waba_id: cRes.data.config.waba_id || "",
          verify_token: cRes.data.config.verify_token || "crm_verify_123",
          business_account_id: cRes.data.config.business_account_id || "",
        }));
      }
      if (qRes?.data) setQualityRating(qRes.data);
      if (aiRes?.data) {
        setAiSettings(aiRes.data);
        setAiForm((prev) => ({
          ...prev,
          enabled: !!aiRes.data.enabled,
          model: aiRes.data.model || "meta-llama/llama-3.3-70b-instruct:free",
          system_prompt: aiRes.data.system_prompt || "",
        }));
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
    setLoading(false);
  };

  const fetchKbDocs = async () => {
    try {
      const { data } = await axios.get(`${API}/api/wa/ai/knowledge`, { headers: headers() });
      setKbDocs(data || []);
    } catch {}
  };

  useEffect(() => {
    fetchAll();
    fetchKbDocs();
  }, []);

  const handleSaveConfig = async () => {
    if (!form.phone_number_id || !form.access_token) {
      alert("Phone Number ID and Access Token are required");
      return;
    }
    setSaveLoading(true);
    setSaved(false);
    try {
      await axios.post(`${API}/api/wa/config/save-config`, form, { headers: headers() });
      setSaved(true);
      fetchAll();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.error || "Failed to save config");
    }
    setSaveLoading(false);
  };

  const handleTestConnection = async () => {
    if (!form.phone_number_id || !form.access_token) {
      alert("Please enter Phone Number ID and Access Token to test");
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API}/api/wa/config/test-connection`, form, { headers: headers() });
      setTestResult({ success: true, data: res.data });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.message || err.message,
      });
    }
    setTestLoading(false);
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) return;
    setSendingTestMsg(true);
    setTestSendResult(null);
    try {
      const res = await axios.post(
        `${API}/api/whatsapp/test-send`,
        {
          phone: testPhone.trim(),
          message: testMsgText.trim(),
        },
        { headers: headers() }
      );
      setTestSendResult({ success: true, message: `Message sent successfully to +${testPhone.trim()} via ${res.data?.engineUsed || "Active Engine"}!` });
    } catch (err) {
      setTestSendResult({ success: false, error: err.response?.data?.error || err.message });
    }
    setSendingTestMsg(false);
  };

  const handleUploadKbDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKbUploading(true);
    setKbError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      await axios.post(`${API}/api/wa/ai/knowledge`, formData, { headers: headers() });
      fetchKbDocs();
    } catch (err) {
      setKbError(err.response?.data?.error || "Upload failed");
    }
    setKbUploading(false);
    e.target.value = "";
  };

  const handleDeleteKbDoc = async (id) => {
    if (!window.confirm("Remove this document from the AI knowledge base?")) return;
    try {
      await axios.delete(`${API}/api/wa/ai/knowledge/${id}`, { headers: headers() });
      fetchKbDocs();
    } catch {}
  };

  const handleSaveAiSettings = async () => {
    setAiSaveLoading(true);
    setAiSaved(false);
    try {
      await axios.put(`${API}/api/wa/ai/settings`, aiForm, { headers: headers() });
      setAiSaved(true);
      setAiForm((prev) => ({ ...prev, api_key: "" }));
      fetchAll();
      setTimeout(() => setAiSaved(false), 3000);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save AI settings");
    }
    setAiSaveLoading(false);
  };

  const handleTestAiReply = async () => {
    if (!aiTestMessage.trim()) return;
    setAiTestLoading(true);
    setAiTestReply("");
    setAiTestError("");
    try {
      const { data } = await axios.post(`${API}/api/wa/ai/test`, { message: aiTestMessage }, { headers: headers() });
      setAiTestReply(data.reply || "");
    } catch (err) {
      setAiTestError(err.response?.data?.error || "Test failed. Please check API key.");
    }
    setAiTestLoading(false);
  };

  const webConnected = status?.web?.connected;
  const cloudConfigured = status?.cloud?.phone_number_id || config?.phone_number_id;
  const activeEngine = status?.activeEngine || (webConnected ? "WhatsApp Web (Baileys)" : cloudConfigured ? "Meta Cloud API" : "Offline");

  const qualityInfo = qualityRating?.quality_rating
    ? (QUALITY_COLORS[qualityRating.quality_rating] || QUALITY_COLORS.GREEN)
    : QUALITY_COLORS.GREEN;

  const webhookUrl = `${window.location.origin}/api/wa/webhook`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "webhook") {
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      <WhatsAppNav />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-emerald-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Smartphone size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Accounts & Engine Settings</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${webConnected || cloudConfigured ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {webConnected ? "⚡ Web Connected" : cloudConfigured ? "☁️ Cloud API Active" : "Offline"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage WhatsApp Web sessions, Meta Cloud API credentials, Anti-Ban safety pacing, and AI auto-reply bot.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-24">
          <Loader2 size={36} className="animate-spin text-[#25D366]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Live Session State & Quality */}
          <div className="space-y-6">
            {/* 1. Active Engine Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4 text-sm flex items-center gap-2">
                <Wifi size={18} className="text-[#25D366]" />
                <span>Active Messaging Engine</span>
              </h2>

              <div className={`flex items-center gap-3 p-4 rounded-2xl mb-4 border ${webConnected || cloudConfigured ? "bg-emerald-50/80 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                {webConnected || cloudConfigured ? (
                  <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={24} className="text-gray-400 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-gray-900 text-sm">{activeEngine}</p>
                  <p className={`text-xs font-medium ${webConnected || cloudConfigured ? "text-emerald-700" : "text-gray-400"}`}>
                    {webConnected ? "Live Socket Connected • Ready to send" : cloudConfigured ? "Meta Cloud API Configured" : "Offline • Connect via QR in Live Chat"}
                  </p>
                </div>
              </div>

              {/* Web Session Details */}
              <div className={`p-4 rounded-2xl border ${webConnected ? "bg-emerald-50/40 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${webConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                    <span className="text-xs font-bold text-gray-800">WhatsApp Web Device</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${webConnected ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}>
                    {webConnected ? "Connected" : "Offline"}
                  </span>
                </div>

                {webConnected ? (
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span className="font-mono font-bold text-gray-800">+{status?.web?.phone || accountDetails?.phone || "Connected"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Device Name:</span>
                      <span className="font-bold text-gray-800">{accountDetails?.pushname || "CRM WhatsApp Web"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Platform:</span>
                      <span className="font-bold text-gray-800">{accountDetails?.platform || "Multi-Device"}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Scan the QR code in the <strong>Live Chats & QR</strong> tab to link your WhatsApp phone directly.
                  </p>
                )}
              </div>
            </div>

            {/* 2. Quality Rating & Safety Guard */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>Account Quality & Anti-Ban Safety</span>
              </h2>

              <div className={`p-4 rounded-2xl border ${qualityInfo.bg} mb-4`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700">Phone Quality Rating</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qualityInfo.badge}`}>
                    {qualityInfo.label}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Protected with dynamic anti-ban humanized delays (35s-55s) and automatic batch cooling.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Messaging Tier:</span>
                  <span className="font-bold text-gray-800">Tier 1 (1,000 unique conv/day)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Safety Pacing:</span>
                  <span className="font-bold text-emerald-600">35s - 55s Random Delays</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Cooldown Frequency:</span>
                  <span className="font-bold text-gray-800">Pause 3m every 25 msgs</span>
                </div>
              </div>
            </div>

            {/* 3. Live Test Message Sender */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-2 text-sm flex items-center gap-2">
                <Send size={16} className="text-[#25D366]" />
                <span>Instant Test Dispatch</span>
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Verify that your active WhatsApp connection is sending messages properly.
              </p>

              {testSendResult && (
                <div
                  className={`mb-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    testSendResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {testSendResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testSendResult.message || testSendResult.error}</span>
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Recipient Mobile Number</label>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-2 bg-slate-100 border border-gray-200 rounded-xl font-bold text-gray-600">+91</span>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="9876543210"
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Message Body</label>
                  <textarea
                    rows={2}
                    value={testMsgText}
                    onChange={(e) => setTestMsgText(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTestMsg || !testPhone}
                  className="w-full py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-xl transition shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingTestMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send Test Message</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column (2 cols): Meta Cloud API & AI Auto-Reply Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Meta Cloud API Credentials Form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Key size={18} className="text-blue-600" />
                    <span>Meta Cloud API Official Integration</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Connect Meta Business Manager to broadcast official pre-approved WhatsApp templates.
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 self-start sm:self-auto">
                  Official Meta API
                </span>
              </div>

              {testResult && (
                <div
                  className={`mb-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border ${
                    testResult.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <div>
                    <p className="font-bold">{testResult.success ? "Connection Verified Successfully!" : "Connection Failed"}</p>
                    <p className="text-[11px] mt-0.5">{testResult.error || testResult.data?.phoneInfo?.display_phone_number || "Meta credentials valid."}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Phone Number ID *</label>
                  <input
                    type="text"
                    value={form.phone_number_id}
                    onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
                    placeholder="e.g. 104857392019485"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Permanent Access Token *</label>
                  <input
                    type="password"
                    value={form.access_token}
                    onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                    placeholder="EAA..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">WhatsApp Business Account ID (WABA ID)</label>
                  <input
                    type="text"
                    value={form.waba_id}
                    onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
                    placeholder="e.g. 102938475610293"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Webhook Verify Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.verify_token}
                      onChange={(e) => setForm({ ...form, verify_token: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(form.verify_token, "token")}
                      className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition text-xs font-bold shrink-0"
                    >
                      {copiedToken ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Webhook URL Helper */}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">Meta Webhook Callback URL:</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(webhookUrl, "webhook")}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    {copiedWebhook ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedWebhook ? "Copied!" : "Copy URL"}</span>
                  </button>
                </div>
                <code className="block p-2 bg-white border border-gray-200 rounded-xl font-mono text-[11px] text-gray-700 select-all overflow-x-auto">
                  {webhookUrl}
                </code>
              </div>

              <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testLoading || !form.phone_number_id || !form.access_token}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  <span>Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={saveLoading || !form.phone_number_id || !form.access_token}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saveLoading ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Settings size={14} />}
                  <span>{saved ? "Saved!" : "Save Meta Config"}</span>
                </button>
              </div>
            </div>

            {/* 2. AI Auto-Reply & Knowledge Base */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Bot size={18} className="text-purple-600" />
                    <span>AI Auto-Reply Assistant & Knowledge Base</span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Train your AI bot on company brochures and PDFs to reply automatically to customer queries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAiForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                      aiForm.enabled
                        ? "bg-purple-100 text-purple-800 border border-purple-300"
                        : "bg-gray-100 text-gray-600 border border-gray-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${aiForm.enabled ? "bg-purple-600 animate-pulse" : "bg-gray-400"}`} />
                    <span>{aiForm.enabled ? "AI Bot Active" : "AI Disabled"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">System Instructions / Prompt</label>
                  <textarea
                    rows={3}
                    value={aiForm.system_prompt}
                    onChange={(e) => setAiForm({ ...aiForm, system_prompt: e.target.value })}
                    placeholder="You are an expert customer service assistant for MADHURA CRM. Be polite, concise, and helpful."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                {/* Knowledge Base Documents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-bold text-gray-700 uppercase">Knowledge Base Documents ({kbDocs.length})</label>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-800 cursor-pointer">
                      <Upload size={13} />
                      <span>Upload Document (PDF/TXT)</span>
                      <input type="file" accept=".pdf,.txt,.doc,.docx" onChange={handleUploadKbDoc} className="hidden" />
                    </label>
                  </div>

                  {kbUploading && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-purple-800 mb-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Parsing & indexing document for AI...</span>
                    </div>
                  )}

                  {kbDocs.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-gray-400">
                      No training documents uploaded yet. Upload product catalogs or price lists.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {kbDocs.map((doc) => (
                        <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={14} className="text-purple-600 shrink-0" />
                            <span className="font-bold text-gray-800 truncate">{doc.title || doc.filename}</span>
                          </div>
                          <button onClick={() => handleDeleteKbDoc(doc.id)} className="p-1 text-gray-400 hover:text-rose-600">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleSaveAiSettings}
                    disabled={aiSaveLoading}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-md shadow-purple-500/20 flex items-center gap-1.5"
                  >
                    {aiSaveLoading ? <Loader2 size={14} className="animate-spin" /> : aiSaved ? <Check size={14} /> : <Settings size={14} />}
                    <span>{aiSaved ? "AI Saved!" : "Save AI Settings"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
