import React, { useState, useEffect } from "react";
import {
  Smartphone, CheckCircle2, XCircle, Loader2, Settings, Wifi,
  Key, Globe, Zap, RefreshCw, AlertCircle, Shield, Bot, Send,
  BookOpen, Upload, Trash2, FileText, PhoneCall, ArrowRight,
  Copy, Check
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

const QUALITY_COLORS = {
  GREEN: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800", label: "Green — High Quality" },
  YELLOW: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800", label: "Yellow — Medium Quality" },
  RED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800", label: "Red — Low Quality" },
};

export default function WhatsAppAccounts() {
  const [status, setStatus] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState(null);
  const [qualityRating, setQualityRating] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cloud API Form & Testing
  const [form, setForm] = useState({
    phone_number_id: "", access_token: "", waba_id: "", app_secret: "", verify_token: "crm_verify_123", business_account_id: ""
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
        setForm(prev => ({
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
        setAiForm(prev => ({
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
        error: err.response?.data?.message || err.message
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
      const res = await axios.post(`${API}/api/whatsapp/test-send`, {
        phone: testPhone.trim(),
        message: testMsgText.trim()
      }, { headers: headers() });
      setTestSendResult({ success: true, message: `Message sent successfully to +${testPhone.trim()}!` });
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
      setAiForm(prev => ({ ...prev, api_key: "" }));
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
  const activeEngine = status?.activeEngine || (webConnected ? "WhatsApp Web (Baileys)" : "Not Connected");

  const qualityInfo = qualityRating?.quality_rating
    ? (QUALITY_COLORS[qualityRating.quality_rating] || QUALITY_COLORS.GREEN)
    : QUALITY_COLORS.GREEN;

  const webhookUrl = `${window.location.origin}/api/wa/webhook`;

  return (
    <div className="w-full pb-10">
      <WhatsAppNav />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shadow-sm">
            <Smartphone size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">WhatsApp Accounts & Engine Status</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${webConnected || cloudConfigured ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {webConnected ? "⚡ Web Connected" : cloudConfigured ? "☁️ Cloud API" : "Offline"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage WhatsApp Web sessions, Meta Cloud API credentials, Anti-Ban safety pacing, and AI auto-reply bot.
            </p>
          </div>
        </div>

        <button
          onClick={fetchAll}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-xs font-bold shadow-sm"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-20">
          <Loader2 size={36} className="animate-spin text-[#25D366]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (1 col): Live Session State & Quality */}
          <div className="space-y-5">
            {/* 1. Active Engine Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
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
                    {webConnected ? "Live Socket Active • Ready to Broadcast" : cloudConfigured ? "Cloud API Configured" : "Connect via QR in Live Chat"}
                  </p>
                </div>
              </div>

              {/* WhatsApp Web Session Details */}
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
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-emerald-100">
                      <span className="text-gray-500">Phone:</span>
                      <span className="font-mono font-bold text-emerald-900">+{status?.web?.phone || accountDetails?.phone || "Connected"}</span>
                    </div>
                    {accountDetails?.pushname && (
                      <div className="flex items-center justify-between py-1 border-b border-emerald-100">
                        <span className="text-gray-500">Profile Name:</span>
                        <span className="font-semibold text-gray-800">{accountDetails.pushname}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1 border-b border-emerald-100">
                      <span className="text-gray-500">Synced Contacts:</span>
                      <span className="font-bold text-blue-700">{accountDetails?.contactsCount || 0} contacts</span>
                    </div>

                    <button
                      onClick={async () => {
                        setSyncing(true);
                        await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers: headers() }).catch(() => {});
                        await axios.post(`${API}/api/whatsapp/sync-chats`, {}, { headers: headers() }).catch(() => {});
                        await fetchAll();
                        setSyncing(false);
                      }}
                      disabled={syncing}
                      className="w-full mt-3 py-2 px-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                      <span>{syncing ? "Syncing Device Data..." : "Sync Contacts & Chats"}</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2 space-y-2">
                    <p className="text-xs text-gray-500">No active WhatsApp Web pairing.</p>
                    <a
                      href="/dashboard/whatsapp/live"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 underline"
                    >
                      <span>Open Live Chat to Scan QR Code</span>
                      <ArrowRight size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Number Health & Anti-Ban Shield */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <Shield size={18} className="text-emerald-600" />
                <span>Anti-Ban Safety & Health</span>
              </h2>

              <div className={`p-4 rounded-2xl border ${qualityInfo.bg} mb-3`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${qualityInfo.text}`}>{qualityInfo.label}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qualityInfo.badge}`}>Protected</span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  Safe dispatch pacing: 35–55s human delays with 600–800 daily limit active.
                </p>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Daily Cap:</span>
                  <span className="font-bold text-gray-800">600–800 messages / day</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Typing Simulation:</span>
                  <span className="font-bold text-emerald-600">Active (composing...)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Spintax Engine:</span>
                  <span className="font-bold text-purple-600">Auto Hash Variation</span>
                </div>
              </div>
            </div>

            {/* 3. Send Quick Test Message */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <PhoneCall size={16} className="text-blue-500" />
                <span>Test Live Message Dispatch</span>
              </h2>

              <form onSubmit={handleSendTestMessage} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Target Phone Number</label>
                  <input
                    type="text"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="e.g. 9876543210 or 919876543210"
                    className="w-full px-3 py-2 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Message Text</label>
                  <input
                    type="text"
                    value={testMsgText}
                    onChange={e => setTestMsgText(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                  />
                </div>

                {testSendResult && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${testSendResult.success ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                    {testSendResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{testSendResult.message || testSendResult.error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sendingTestMsg || !testPhone.trim()}
                  className="w-full py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {sendingTestMsg ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Send Test Message</span>
                </button>
              </form>
            </div>

            {/* 4. Webhook Configuration */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                <Globe size={16} className="text-blue-500" />
                <span>Meta Webhook Configuration</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Webhook URL</label>
                  <div className="flex items-center gap-1.5 bg-gray-50 p-2 rounded-xl border border-gray-200 font-mono text-[11px] break-all">
                    <span className="flex-1">{webhookUrl}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                      className="p-1 text-gray-500 hover:text-gray-800 shrink-0"
                      title="Copy URL"
                    >
                      {copiedWebhook ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Verify Token</label>
                  <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 font-mono text-[11px] text-gray-800 font-bold">
                    {config?.verify_token || "crm_verify_123"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (2 cols): Meta Cloud API Credentials & AI Auto-Reply */}
          <div className="lg:col-span-2 space-y-6">
            {/* Meta Cloud API Credentials Card */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-md">
                    <Key size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-base">Meta Cloud API Credentials</h2>
                    <p className="text-xs text-gray-500">Configure your official WhatsApp Business Platform credentials</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testLoading || !form.phone_number_id || !form.access_token}
                  className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-bold transition disabled:opacity-40 flex items-center gap-1.5"
                >
                  {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                  <span>Test Connection</span>
                </button>
              </div>

              {saved && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} /> Meta Cloud API configuration saved successfully!
                </div>
              )}

              {testResult && (
                <div className={`mb-4 p-3.5 rounded-2xl text-xs border ${testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{testResult.success ? "Meta Cloud Connection Verified!" : "Connection Test Failed"}</span>
                  </div>
                  <p className="text-[11px] mt-0.5">{testResult.error || "Meta Graph API successfully responded and authenticated credentials."}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Phone Number ID *</label>
                  <input
                    type="text"
                    value={form.phone_number_id}
                    onChange={e => setForm({ ...form, phone_number_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="e.g. 104592837482910"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">From Meta Developer App → WhatsApp → API Setup</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">WhatsApp Business Account ID (WABA)</label>
                  <input
                    type="text"
                    value={form.waba_id}
                    onChange={e => setForm({ ...form, waba_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="e.g. 109283746501928"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Permanent Access Token *</label>
                  <input
                    type="password"
                    value={form.access_token}
                    onChange={e => setForm({ ...form, access_token: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">System user token with `whatsapp_business_messaging` permissions</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">App Secret</label>
                  <input
                    type="password"
                    value={form.app_secret}
                    onChange={e => setForm({ ...form, app_secret: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="App Secret (for HMAC verification)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Webhook Verify Token</label>
                  <input
                    type="text"
                    value={form.verify_token}
                    onChange={e => setForm({ ...form, verify_token: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                    placeholder="crm_verify_123"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saveLoading || !form.phone_number_id || !form.access_token}
                className="mt-5 w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-2xl font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/20"
              >
                {saveLoading ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
                <span>Save Meta Cloud API Configuration</span>
              </button>
            </div>

            {/* AI Auto-Reply Bot & Knowledge Base Studio */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900 text-base">AI Auto-Reply Bot & Knowledge Studio</h2>
                    <p className="text-xs text-gray-500">Autonomous LLM assistant with FAQ & pricing document retrieval</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAiForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-12 h-6 rounded-full transition relative shrink-0 ${aiForm.enabled ? "bg-indigo-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${aiForm.enabled ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              {aiSaved && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={14} /> AI configuration saved successfully!
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">OpenRouter / LLM API Key</label>
                  <input
                    type="password"
                    value={aiForm.api_key}
                    onChange={e => setAiForm({ ...aiForm, api_key: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder={aiSettings?.has_api_key ? "•••••••••••••• (already configured)" : "sk-or-v1-..."}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Get free or low-cost API keys from openrouter.ai</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">AI Model Name</label>
                  <input
                    type="text"
                    value={aiForm.model}
                    onChange={e => setAiForm({ ...aiForm, model: e.target.value })}
                    className="w-full px-3.5 py-2.5 border rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="meta-llama/llama-3.3-70b-instruct:free"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">System Prompt & Guidelines</label>
                  <textarea
                    rows={3}
                    value={aiForm.system_prompt}
                    onChange={e => setAiForm({ ...aiForm, system_prompt: e.target.value })}
                    className="w-full p-3 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    placeholder="You are an expert customer service assistant for ACHME Solutions. Answer questions politely using the uploaded knowledge base..."
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleSaveAiSettings}
                  disabled={aiSaveLoading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {aiSaveLoading ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
                  <span>Save AI Settings</span>
                </button>
              </div>

              {/* Interactive Test Reply Console */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">Interactive AI Test Console</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiTestMessage}
                    onChange={e => setAiTestMessage(e.target.value)}
                    className="flex-1 px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Ask a question (e.g. What are your AMC packages?)..."
                  />
                  <button
                    type="button"
                    onClick={handleTestAiReply}
                    disabled={aiTestLoading || !aiTestMessage.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition flex items-center gap-1"
                  >
                    {aiTestLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    <span>Test Reply</span>
                  </button>
                </div>

                {aiTestReply && (
                  <div className="mt-2.5 p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-900 leading-relaxed">
                    <p className="font-bold text-[10px] text-indigo-500 uppercase mb-0.5">AI Response:</p>
                    {aiTestReply}
                  </div>
                )}

                {aiTestError && (
                  <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800">
                    {aiTestError}
                  </div>
                )}
              </div>

              {/* Knowledge Base Document Manager */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1.5">
                    <BookOpen size={14} className="text-indigo-600" />
                    <span>Knowledge Base Documents ({kbDocs.length} files)</span>
                  </label>
                  <label className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-1">
                    {kbUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    <span>{kbUploading ? "Uploading..." : "Upload Document"}</span>
                    <input type="file" accept=".txt,.md,.csv,.docx" className="hidden" onChange={handleUploadKbDoc} disabled={kbUploading} />
                  </label>
                </div>

                <p className="text-[11px] text-gray-400 mb-3">
                  Upload service lists, pricing sheets, or company FAQs (.txt, .md, .csv, .docx) for RAG context retrieval.
                </p>

                {kbError && <p className="text-xs text-rose-600 mb-2">{kbError}</p>}

                {kbDocs.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {kbDocs.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={15} className="text-indigo-500 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-gray-800 truncate">{d.filename}</p>
                            <p className="text-[10px] text-gray-400">{(d.char_count || 0).toLocaleString()} characters</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteKbDoc(d.id)}
                          className="p-1 text-gray-400 hover:text-rose-600 rounded-lg transition"
                          title="Delete Document"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
                    No documents uploaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
