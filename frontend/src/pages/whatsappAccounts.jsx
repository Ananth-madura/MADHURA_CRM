import React, { useState, useEffect } from "react";
import {
  Smartphone, CheckCircle2, XCircle, Loader2, Settings, Wifi,
  Key, Globe, Zap, RefreshCw, AlertCircle, Shield, Bot, Send,
  BookOpen, Upload, Trash2, FileText, PhoneCall, ArrowRight,
  Copy, Check, ShieldCheck, Clock, Layers, Sparkles, Eye, EyeOff,
  Play, UserCheck, MessageSquare, Cpu, Sliders, HelpCircle, Server
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

const QUALITY_COLORS = {
  GREEN: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-800", label: "Green — High Quality (Tier 1)" },
  YELLOW: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800", label: "Yellow — Medium Quality (Tier 2)" },
  RED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", badge: "bg-rose-100 text-rose-800", label: "Red — Low Quality Warning" },
};

const PROMPT_PRESETS = [
  {
    id: "general_crm",
    title: "💼 General Business & CRM",
    prompt: "You are the helpful, professional WhatsApp assistant for our company. Answer customer questions politely and accurately. If they express interest in our services or products, collect their name and requirements and save them as a lead. Keep replies concise (2-3 sentences).",
  },
  {
    id: "amc_support",
    title: "🛠️ AMC & Service Specialist",
    prompt: "You are our company's technical service & AMC maintenance assistant. Guide customers on Annual Maintenance Contracts (AMC), warranty status, periodic inspections, and repair services. If they need on-site inspection or technician dispatch, record their details and schedule a callback.",
  },
  {
    id: "lead_qualifier",
    title: "🎯 Lead Qualifier & Sales Agent",
    prompt: "You are an enthusiastic sales advisor for our company. Your goal is to understand what the customer needs, explain our key solutions, and politely ask for their name, location, and requirements so our sales engineer can send an official quotation.",
  },
  {
    id: "billing_helper",
    title: "🧾 Invoicing & Payments Helper",
    prompt: "You are our customer billing assistant. Assist clients with invoice payment inquiries, due date reminders, and payment receipts. Use the check_invoice_status tool to verify invoice details when asked.",
  },
];

const MODEL_PRESETS = [
  { label: "Llama 3.3 70B (Free / Ultra-Fast)", value: "meta-llama/llama-3.3-70b-instruct:free", provider: "openrouter" },
  { label: "DeepSeek R1 (Free / Reasoning)", value: "deepseek/deepseek-r1:free", provider: "openrouter" },
  { label: "GPT-4o Mini (OpenAI)", value: "gpt-4o-mini", provider: "openai" },
  { label: "GPT-4o Flagship (OpenAI)", value: "gpt-4o", provider: "openai" },
  { label: "Gemini 2.0 Flash (Google)", value: "gemini-2.0-flash", provider: "gemini" },
  { label: "Llama 3.3 70B Versatile (Groq)", value: "llama-3.3-70b-versatile", provider: "groq" },
];

export default function WhatsAppAccounts() {
  const [activeTab, setActiveTab] = useState("ai"); // "ai" | "meta" | "web" | "test"
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
  const [testEngine, setTestEngine] = useState("auto"); // "auto" | "web" | "cloud_api"
  const [sendingTestMsg, setSendingTestMsg] = useState(false);
  const [testSendResult, setTestSendResult] = useState(null);

  // AI Auto-Reply & Knowledge Base
  const [aiForm, setAiForm] = useState({
    enabled: false,
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    system_prompt: "",
    api_key: "",
    auto_lead_capture: true,
    human_handoff_keywords: "human, agent, executive, support, speak to person, call me",
    custom_api_url: "",
    temperature: 0.70,
    max_tokens: 350,
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [maskedApiKey, setMaskedApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiSaveLoading, setAiSaveLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);

  // AI Playground & Simulation
  const [aiTestMessage, setAiTestMessage] = useState("Hi, what services and AMC packages do you offer?");
  const [aiTestPhone, setAiTestPhone] = useState("9876543210");
  const [aiTestName, setAiTestName] = useState("Alex Johnson");
  const [aiTestReply, setAiTestReply] = useState("");
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestError, setAiTestError] = useState("");

  // Knowledge Base
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
          access_token: "••••••••••••••••",
        }));
      }

      if (qRes?.data) setQualityRating(qRes.data);

      if (aiRes?.data) {
        setHasApiKey(aiRes.data.has_api_key);
        setMaskedApiKey(aiRes.data.masked_api_key || "");
        setAiForm((prev) => ({
          ...prev,
          enabled: !!aiRes.data.enabled,
          provider: aiRes.data.provider || "openrouter",
          model: aiRes.data.model || "meta-llama/llama-3.3-70b-instruct:free",
          system_prompt: aiRes.data.system_prompt || "",
          auto_lead_capture: aiRes.data.auto_lead_capture !== false,
          human_handoff_keywords: aiRes.data.human_handoff_keywords || "human, agent, executive, support, speak to person, call me",
          custom_api_url: aiRes.data.custom_api_url || "",
          temperature: aiRes.data.temperature || 0.70,
          max_tokens: aiRes.data.max_tokens || 350,
          api_key: "",
        }));
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
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
    if (!form.phone_number_id) {
      alert("Phone Number ID is required");
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
    if (!form.phone_number_id) {
      alert("Please enter Phone Number ID to test");
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
          engine: testEngine !== "auto" ? testEngine : undefined,
        },
        { headers: headers() }
      );
      setTestSendResult({
        success: true,
        message: `Message sent successfully to +${testPhone.trim()} via ${res.data?.engineUsed || "Active Engine"}!`,
      });
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
      setKbError(err.response?.data?.error || "Upload failed. Please upload .txt, .md, .csv, or .docx");
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
      alert(err.response?.data?.error || err.message || "Failed to save AI settings");
    }
    setAiSaveLoading(false);
  };

  const handleTestAiReply = async () => {
    if (!aiTestMessage.trim()) return;
    setAiTestLoading(true);
    setAiTestReply("");
    setAiTestError("");
    try {
      const { data } = await axios.post(
        `${API}/api/wa/ai/test`,
        {
          message: aiTestMessage.trim(),
          phone: aiTestPhone.trim() || "919876543210",
          contact_name: aiTestName.trim() || "Demo Client",
        },
        { headers: headers() }
      );
      setAiTestReply(data.reply || "");
    } catch (err) {
      setAiTestError(err.response?.data?.error || "Test failed. Please verify that your AI API Key is configured.");
    }
    setAiTestLoading(false);
  };

  const applyPreset = (preset) => {
    setAiForm((prev) => ({ ...prev, system_prompt: preset.prompt }));
  };

  const webConnected = status?.web?.connected || status?.isWeb;
  const cloudConfigured = status?.cloud?.configured || status?.isCloud || config?.phone_number_id;
  const activeEngine = status?.activeEngine || (cloudConfigured && webConnected ? "Dual (Cloud API + Web)" : cloudConfigured ? "Meta Cloud API" : webConnected ? "WhatsApp Web Session" : "Offline");

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
    <div className="w-full pb-16 bg-slate-50/60 min-h-screen">
      <WhatsAppNav />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Settings & AI Engine</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${cloudConfigured || webConnected ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                {activeEngine}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure intelligent AI auto-replies, automated CRM lead capture, Meta Cloud API, and WhatsApp Web sessions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === "ai"
              ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Bot size={16} />
          <span>🤖 AI Assistant & Lead Bot</span>
        </button>

        <button
          onClick={() => setActiveTab("meta")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === "meta"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Key size={16} />
          <span>☁️ Meta Cloud API (Official)</span>
        </button>

        <button
          onClick={() => setActiveTab("web")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === "web"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Smartphone size={16} />
          <span>📱 WhatsApp Web & Anti-Ban</span>
        </button>

        <button
          onClick={() => setActiveTab("test")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === "test"
              ? "bg-slate-800 text-white shadow-md"
              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Send size={16} />
          <span>⚡ Test Dispatcher</span>
        </button>
      </div>

      {loading && !status ? (
        <div className="flex justify-center py-24">
          <Loader2 size={36} className="animate-spin text-purple-600" />
        </div>
      ) : (
        <div>
          {/* TAB 1: AI ASSISTANT & AUTO-REPLY */}
          {activeTab === "ai" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column (2 cols): AI Settings Form & Knowledge Base */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-gray-100">
                    <div>
                      <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <Bot size={20} className="text-purple-600" />
                        <span>AI Assistant Engine & Lead Capture</span>
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enables 24/7 intelligent conversational responses, automatic CRM lead capture, and action execution.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAiForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto ${
                        aiForm.enabled
                          ? "bg-purple-100 text-purple-800 border border-purple-300 shadow-sm"
                          : "bg-gray-100 text-gray-600 border border-gray-200"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${aiForm.enabled ? "bg-purple-600 animate-pulse" : "bg-gray-400"}`} />
                      <span>{aiForm.enabled ? "AI Bot: ACTIVE" : "AI Bot: DISABLED"}</span>
                    </button>
                  </div>

                  <div className="space-y-4 text-xs">
                    {/* Provider & Model Selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-gray-700 uppercase mb-1">AI Provider</label>
                        <select
                          value={aiForm.provider}
                          onChange={(e) => setAiForm({ ...aiForm, provider: e.target.value })}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-white font-semibold text-gray-800"
                        >
                          <option value="openrouter">⚡ OpenRouter (Access 100+ Free & Premium Models)</option>
                          <option value="openai">🧠 OpenAI (Official ChatGPT - GPT-4o / GPT-4o-mini)</option>
                          <option value="groq">🚀 Groq (Ultra-Speed Llama 3.3 70B)</option>
                          <option value="gemini">✨ Google Gemini (Gemini 2.0 Flash / Pro)</option>
                          <option value="custom">💻 Custom OpenAI-Compatible / Local Ollama Endpoint</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 uppercase mb-1">Model Name</label>
                        <input
                          type="text"
                          value={aiForm.model}
                          onChange={(e) => setAiForm({ ...aiForm, model: e.target.value })}
                          placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                      </div>
                    </div>

                    {/* Quick Model Chips */}
                    <div>
                      <span className="text-[11px] font-bold text-gray-500 mb-1.5 block">Recommended Fast Models:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {MODEL_PRESETS.map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setAiForm({ ...aiForm, model: m.value, provider: m.provider })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition ${
                              aiForm.model === m.value
                                ? "bg-purple-50 text-purple-700 border-purple-300 font-bold"
                                : "bg-slate-50 text-gray-600 border-gray-200 hover:bg-slate-100"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom API URL (if custom provider) */}
                    {aiForm.provider === "custom" && (
                      <div>
                        <label className="block font-bold text-gray-700 uppercase mb-1">Custom API Base URL</label>
                        <input
                          type="text"
                          value={aiForm.custom_api_url}
                          onChange={(e) => setAiForm({ ...aiForm, custom_api_url: e.target.value })}
                          placeholder="e.g. http://localhost:11434/v1"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                      </div>
                    )}

                    {/* API Key Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-gray-700 uppercase">
                          API Key {hasApiKey && <span className="text-emerald-600 font-normal ml-1">({maskedApiKey} configured)</span>}
                        </label>
                        {hasApiKey && (
                          <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                            ✓ Key Saved
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showApiKey ? "text" : "password"}
                          value={aiForm.api_key}
                          onChange={(e) => setAiForm({ ...aiForm, api_key: e.target.value })}
                          placeholder={hasApiKey ? "Enter new key to replace existing, or leave blank to keep" : "sk-..."}
                          className="w-full pl-3.5 pr-10 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* System Prompt & Presets */}
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <label className="font-bold text-gray-700 uppercase">System Prompt & Persona</label>
                        <span className="text-[11px] text-gray-400">Click a preset below to auto-fill</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                        {PROMPT_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="p-2 rounded-xl text-left border bg-slate-50 hover:bg-purple-50 border-gray-200 hover:border-purple-200 transition text-[11px] font-semibold text-gray-700"
                          >
                            {p.title}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={4}
                        value={aiForm.system_prompt}
                        onChange={(e) => setAiForm({ ...aiForm, system_prompt: e.target.value })}
                        placeholder="You are an expert customer service assistant for MADHURA CRM. Be polite, concise, and helpful."
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none font-sans"
                      />
                    </div>

                    {/* Automated Lead Capture & Human Handoff */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                            <UserCheck size={16} className="text-emerald-600" />
                            <span>Automated CRM Lead Capture</span>
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Auto-extract customer names, inquiries, and requirements into CRM Telecalls & Contacts (Source = WhatsApp AI).
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={aiForm.auto_lead_capture}
                          onChange={(e) => setAiForm({ ...aiForm, auto_lead_capture: e.target.checked })}
                          className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <label className="block font-bold text-gray-700 uppercase mb-1">Human Agent Handoff Keywords</label>
                        <input
                          type="text"
                          value={aiForm.human_handoff_keywords}
                          onChange={(e) => setAiForm({ ...aiForm, human_handoff_keywords: e.target.value })}
                          placeholder="human, agent, executive, support, speak to person, call me"
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          When a customer mentions these words, AI auto-reply pauses for 180 min and alerts your team.
                        </p>
                      </div>
                    </div>

                    {/* Knowledge Base Documents */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="font-bold text-gray-700 uppercase flex items-center gap-1.5">
                          <BookOpen size={16} className="text-purple-600" />
                          <span>Knowledge Base Documents ({kbDocs.length})</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl border border-purple-200 transition">
                          <Upload size={13} />
                          <span>Upload File (.txt/.md/.csv/.docx)</span>
                          <input type="file" accept=".txt,.md,.csv,.docx" onChange={handleUploadKbDoc} className="hidden" />
                        </label>
                      </div>

                      {kbError && (
                        <div className="p-2.5 mb-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                          {kbError}
                        </div>
                      )}

                      {kbUploading && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-purple-800 mb-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Parsing and indexing document for AI...</span>
                        </div>
                      )}

                      {kbDocs.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-gray-400">
                          No knowledge documents uploaded yet. Upload product catalogs, brochures, or pricing sheets.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {kbDocs.map((doc) => (
                            <div key={doc.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                <FileText size={14} className="text-purple-600 shrink-0" />
                                <span className="font-bold text-gray-800 truncate">{doc.filename}</span>
                                <span className="text-[10px] text-gray-400">({doc.char_count} chars)</span>
                              </div>
                              <button onClick={() => handleDeleteKbDoc(doc.id)} className="p-1 text-gray-400 hover:text-rose-600">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleSaveAiSettings}
                        disabled={aiSaveLoading}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition shadow-md shadow-purple-500/20 flex items-center gap-2 disabled:opacity-50"
                      >
                        {aiSaveLoading ? <Loader2 size={14} className="animate-spin" /> : aiSaved ? <Check size={14} /> : <Settings size={14} />}
                        <span>{aiSaved ? "Settings Saved!" : "Save AI Settings"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (1 col): Live AI Interactive Simulation Playground */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
                    <Play size={16} className="text-purple-600" />
                    <span>AI Testing & Simulation Playground</span>
                  </h2>
                  <p className="text-xs text-gray-500 mb-4">
                    Test your system prompt, knowledge base, and CRM tool execution before going live.
                  </p>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-bold text-gray-700 uppercase mb-1">Simulated Customer Name</label>
                      <input
                        type="text"
                        value={aiTestName}
                        onChange={(e) => setAiTestName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 uppercase mb-1">Customer Inbound Message</label>
                      <textarea
                        rows={2}
                        value={aiTestMessage}
                        onChange={(e) => setAiTestMessage(e.target.value)}
                        placeholder="e.g. Can you check my invoice status?"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 resize-none text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestAiReply}
                      disabled={aiTestLoading || !aiTestMessage.trim()}
                      className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition shadow-md shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Generate AI Test Reply</span>
                    </button>

                    {aiTestError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                        {aiTestError}
                      </div>
                    )}

                    {aiTestReply && (
                      <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                        <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">AI Generated Response:</span>
                        <div className="p-3 bg-white border border-purple-100 rounded-xl text-xs text-gray-800 whitespace-pre-wrap shadow-sm">
                          {aiTestReply}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* CRM Tools Summary Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm text-xs space-y-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Cpu size={16} className="text-emerald-600" />
                    <span>Enabled CRM AI Tools</span>
                  </h3>
                  <div className="space-y-2 text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span><strong>create_lead:</strong> Records new leads in Telecalls</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span><strong>check_invoice_status:</strong> Checks invoice records</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span><strong>schedule_callback:</strong> Sets callback reminder</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span><strong>get_company_services:</strong> Fetches live services list</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span><strong>request_human_support:</strong> Instant team handoff</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: META CLOUD API OFFICIAL INTEGRATION */}
          {activeTab === "meta" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                    <div>
                      <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <Key size={18} className="text-blue-600" />
                        <span>Meta Cloud API Credentials</span>
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Connect your official Meta WhatsApp Business Account without needing to keep a phone connected.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
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
                        <p className="text-[11px] mt-0.5">
                          {testResult.error || `Connected Number: ${testResult.data?.phoneInfo?.display_phone_number || "Active"}`}
                        </p>
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
                      <label className="block font-bold text-gray-700 uppercase mb-1">WABA Account ID</label>
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
                      disabled={testLoading || !form.phone_number_id}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      {testLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      <span>Test Connection</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={saveLoading || !form.phone_number_id}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {saveLoading ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Settings size={14} />}
                      <span>{saved ? "Saved!" : "Save Meta Config"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Meta Account Status Card */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm text-xs">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-blue-600" />
                    <span>Meta Account Quality Status</span>
                  </h3>
                  <div className={`p-4 rounded-2xl border ${qualityInfo.bg} mb-4`}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${qualityInfo.badge}`}>
                      {qualityInfo.label}
                    </span>
                    <p className="text-[11px] text-gray-600 mt-2">
                      Messaging Tier 1: 1,000 business-initiated conversations / 24 hours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP WEB & ANTI-BAN */}
          {activeTab === "web" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Wifi size={18} className="text-[#25D366]" />
                  <span>WhatsApp Web Session Status</span>
                </h2>

                <div className={`flex items-center gap-3 p-4 rounded-2xl border ${webConnected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                  {webConnected ? <CheckCircle2 size={24} className="text-emerald-500" /> : <XCircle size={24} className="text-gray-400" />}
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{webConnected ? "Connected" : "Disconnected"}</p>
                    <p className="text-xs text-gray-500">
                      {webConnected ? `Phone: +${status?.web?.phone || accountDetails?.phone || "Linked"}` : "Scan QR code on Live Chat page to connect."}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-2">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span>Multi-Device Platform:</span>
                    <span className="font-bold text-gray-800">{accountDetails?.platform || "WhatsApp Web Baileys"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span>Push Name:</span>
                    <span className="font-bold text-gray-800">{accountDetails?.pushname || "CRM WhatsApp"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3">
                <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" />
                  <span>Anti-Ban Humanized Broadcast Protection</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Broadcasts automatically apply human-like random pacing to prevent device number blocks.
                </p>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                    <span className="font-semibold text-gray-700">Random Delay Between Messages:</span>
                    <span className="font-bold text-emerald-700">35s – 55s</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between">
                    <span className="font-semibold text-gray-700">Batch Cooldown:</span>
                    <span className="font-bold text-emerald-700">Pause 3m every 25 msgs</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TEST MESSAGE DISPATCHER */}
          {activeTab === "test" && (
            <div className="max-w-xl mx-auto bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-bold text-gray-900 text-base flex items-center gap-2 mb-2">
                <Send size={18} className="text-[#25D366]" />
                <span>Instant Test Dispatcher</span>
              </h2>
              <p className="text-xs text-gray-500 mb-5">
                Dispatch a live message to any WhatsApp number to verify outbound delivery.
              </p>

              {testSendResult && (
                <div
                  className={`mb-4 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    testSendResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                  }`}
                >
                  {testSendResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testSendResult.message || testSendResult.error}</span>
                </div>
              )}

              <form onSubmit={handleSendTestMessage} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Sending Channel</label>
                  <select
                    value={testEngine}
                    onChange={(e) => setTestEngine(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-semibold text-gray-800"
                  >
                    <option value="auto">⚡ Smart Auto-Detect (Active Engine)</option>
                    <option value="web" disabled={!webConnected}>
                      📱 WhatsApp Web {webConnected ? `(+${status?.web?.phone || "Connected"})` : "— [Offline]"}
                    </option>
                    <option value="cloud_api" disabled={!cloudConfigured}>
                      ☁️ Meta Cloud API {cloudConfigured ? "— [Configured]" : "— [Not Setup]"}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Recipient Mobile Number</label>
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-2.5 bg-slate-100 border border-gray-200 rounded-xl font-bold text-gray-600">+91</span>
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="9876543210"
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 uppercase mb-1">Message Body</label>
                  <textarea
                    rows={3}
                    value={testMsgText}
                    onChange={(e) => setTestMsgText(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingTestMsg || !testPhone}
                  className="w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold rounded-xl transition shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingTestMsg ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Send Test Message</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
