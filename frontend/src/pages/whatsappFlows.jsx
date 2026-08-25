import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WAVariablePicker from "../components/WAVariablePicker";
import {
  Bot, Plus, Play, Edit2, Trash2, Loader2, GitFork, Send, X,
  Sparkles, PhoneCall, ArrowRight, Smartphone, Database, Globe,
  CheckCircle2, Clock, UserCheck, ShieldAlert, Cpu, ListOrdered,
  Layers, BarChart2, RefreshCw, HelpCircle, FileText, ChevronRight,
  MoveUp, MoveDown, Tag, UserPlus, Zap
} from "lucide-react";

const PLACEHOLDERS = [
  { tag: "{name}", label: "Customer Name" },
  { tag: "{company}", label: "Company" },
  { tag: "{service}", label: "Service / AMC" },
  { tag: "{city}", label: "City / Area" },
  { tag: "{date}", label: "Current Date" },
  { tag: "{start_time}", label: "Start Time" },
  { tag: "{end_time}", label: "End Time" },
  { tag: "{invoice_no}", label: "Invoice #" },
  { tag: "{amount}", label: "Amount (₹)" },
  { tag: "{due_date}", label: "Due Date" },
  { tag: "{booking_date}", label: "Booking Date" },
  { tag: "{amc_contract_no}", label: "AMC Contract #" },
];

const NODE_TYPES = [
  { type: "send_message", label: "Text Message", icon: "💬", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { type: "send_buttons", label: "Menu / Buttons", icon: "🔘", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { type: "send_list", label: "List Menu", icon: "📋", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { type: "collect_input", label: "Collect Input", icon: "📥", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { type: "crm_lookup", label: "CRM Live Lookup", icon: "🔍", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { type: "condition", label: "Condition Branch", icon: "🔀", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { type: "create_lead", label: "Save CRM Lead", icon: "💼", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { type: "send_media", label: "Media / PDF", icon: "📷", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { type: "send_template", label: "Approved Template", icon: "🧾", color: "bg-lime-50 text-lime-700 border-lime-200" },
  { type: "delay", label: "Pacing Delay", icon: "⏱️", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { type: "api_webhook", label: "API Webhook", icon: "🌐", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { type: "ai_generate", label: "AI Smart Reply", icon: "🧠", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  { type: "ai_intent", label: "AI Intent Router", icon: "🎯", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { type: "set_variable", label: "Set Variable", icon: "⚙️", color: "bg-slate-50 text-slate-700 border-slate-200" },
  { type: "set_tag", label: "Tag Contact", icon: "🏷️", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { type: "add_to_group", label: "Add to Group", icon: "👥", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { type: "jump_to_flow", label: "Jump to Flow", icon: "↪️", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { type: "handoff", label: "Live Agent Handoff", icon: "👤", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { type: "end", label: "End Flow", icon: "🛑", color: "bg-gray-100 text-gray-700 border-gray-200" }
];

/**
 * Editable key -> value map. Used by the AI Intent router (intent -> step)
 * and the API Webhook response mapping (variable -> JSON path).
 */
function KeyMapEditor({ map, onChange, keyPlaceholder, valuePlaceholder, valueOptions, addLabel }) {
  const entries = Object.entries(map || {});
  const commit = (next) => onChange(Object.fromEntries(next));

  return (
    <div className="space-y-1.5">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={k}
            placeholder={keyPlaceholder}
            onChange={(e) => commit(entries.map((en, j) => (j === i ? [e.target.value, v] : en)))}
            className="flex-1 min-w-0 p-1.5 border rounded-lg text-xs bg-white font-mono"
          />
          <ArrowRight size={14} className="text-gray-400 shrink-0" />
          {valueOptions ? (
            <select
              value={v || ""}
              onChange={(e) => commit(entries.map((en, j) => (j === i ? [k, e.target.value] : en)))}
              className="w-44 shrink-0 p-1.5 border rounded-lg text-xs font-mono bg-white"
            >
              <option value="">-- Target Step --</option>
              {valueOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={v || ""}
              placeholder={valuePlaceholder}
              onChange={(e) => commit(entries.map((en, j) => (j === i ? [k, e.target.value] : en)))}
              className="flex-1 min-w-0 p-1.5 border rounded-lg text-xs bg-white font-mono"
            />
          )}
          <button
            type="button"
            onClick={() => commit(entries.filter((_, j) => j !== i))}
            className="p-1 text-gray-400 hover:text-red-600 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...entries, ["", ""]])}
        className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-200"
      >
        {addLabel}
      </button>
    </div>
  );
}

export default function WhatsAppFlows() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("flows"); // "flows" | "runs"

  // Editor Modal State
  const [showEditor, setShowEditor] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTriggerType, setFormTriggerType] = useState("keyword");
  const [formKeywords, setFormKeywords] = useState("hi, hello, menu, help, start");
  const [formEntryNode, setFormEntryNode] = useState("start");
  const [formNodes, setFormNodes] = useState([]);
  const [saving, setSaving] = useState(false);

  // Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simFlow, setSimFlow] = useState(null);
  const [simInput, setSimInput] = useState("");
  const [simMessages, setSimMessages] = useState([]);
  const [simVars, setSimVars] = useState({});
  const [simCurrentNode, setSimCurrentNode] = useState(null);
  const [simLogs, setSimLogs] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [simEnded, setSimEnded] = useState(false);
  const [simTrigger, setSimTrigger] = useState(null);

  // Direct Phone Trigger Modal
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggerFlow, setTriggerFlow] = useState(null);
  const [targetPhone, setTargetPhone] = useState("");
  const [triggering, setTriggering] = useState(false);

  // Analytics Modal
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsFlow, setAnalyticsFlow] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Execution Runs Audit State
  const [runsList, setRunsList] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRunFlowId, setSelectedRunFlowId] = useState("all");

  const [seeding, setSeeding] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  // Reference lists used by the Template / Group / Jump steps
  const [templates, setTemplates] = useState([]);
  const [groups, setGroups] = useState([]);
  const simScrollRef = useRef(null);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/wa/flows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFlows(res.data || []);
    } catch (err) {
      console.error("Error fetching flows:", err);
    }
    setLoading(false);
  };

  const fetchRuns = async (flowId = null) => {
    setRunsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const targetId = flowId && flowId !== "all" ? flowId : (flows[0]?.id || 1);
      if (targetId) {
        const res = await axios.get(`${API}/api/wa/flows/${targetId}/runs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRunsList(res.data || []);
      }
    } catch (err) {
      console.error("Error fetching flow runs:", err);
    }
    setRunsLoading(false);
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  // Templates & contact groups power the dropdowns in the Template / Group steps.
  // Failing to load them must never block the builder — the steps fall back to a manual ID.
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { Authorization: `Bearer ${token}` };
    axios.get(`${API}/api/wa/templates`, { headers })
      .then((res) => setTemplates(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTemplates([]));
    axios.get(`${API}/api/wa/groups`, { headers })
      .then((res) => setGroups(Array.isArray(res.data) ? res.data : []))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (activeTab === "runs" && flows.length > 0) {
      fetchRuns(selectedRunFlowId);
    }
  }, [activeTab, selectedRunFlowId]);

  useEffect(() => {
    if (simScrollRef.current) {
      simScrollRef.current.scrollTop = simScrollRef.current.scrollHeight;
    }
  }, [simMessages, simLoading]);

  const handleSeedPrebuilt = async () => {
    setSeeding(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/wa/flows/seed`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchFlows();
      alert(`🎉 Successfully loaded ${res.data?.count || 6} enterprise business chatbot flows!`);
    } catch (err) {
      alert("Failed to seed flows: " + (err.response?.data?.error || err.message));
    }
    setSeeding(false);
  };

  const handleOpenCreate = () => {
    setEditingFlow(null);
    setFormName("");
    setFormDesc("");
    setFormTriggerType("keyword");
    setFormKeywords("hi, hello, menu, help, start, book");
    setFormEntryNode("start");
    setFormNodes([
      {
        node_key: "start",
        node_type: "start",
        config: { next_node_key: "main_menu" },
      },
      {
        node_key: "main_menu",
        node_type: "send_buttons",
        config: {
          text: "👋 {Hi|Hello|Greetings} {name}! Welcome to {company}.\nHow can we assist you today? Please choose an option:",
          footer_text: "ACHME Smart Assistant • 24/7 Support",
          buttons: [
            { reply_id: "opt_services", title: "1. 🛠️ Services", next_node_key: "services_info" },
            { reply_id: "opt_booking", title: "2. 📅 Book Service", next_node_key: "ask_booking_date" },
            { reply_id: "opt_agent", title: "3. 👤 Live Agent", next_node_key: "agent_handoff" },
          ],
        },
      },
      {
        node_key: "services_info",
        node_type: "send_message",
        config: {
          text: "🛠️ We provide comprehensive HVAC, Electrical, and AMC solutions across {city}!\n\nReply MENU anytime to return.",
          next_node_key: "end_flow",
        },
      },
      {
        node_key: "ask_booking_date",
        node_type: "collect_input",
        config: {
          prompt_text: "📅 Which date would you like to schedule your service appointment? (e.g. Tomorrow or 25 Aug)",
          var_key: "booking_date",
          validation_type: "none",
          next_node_key: "save_booking_lead",
        },
      },
      {
        node_key: "save_booking_lead",
        node_type: "create_lead",
        config: {
          default_service: "Service Appointment",
          notes: "Booked service for date {booking_date} in {city}",
          next_node_key: "confirm_booking_msg",
        },
      },
      {
        node_key: "confirm_booking_msg",
        node_type: "send_message",
        config: {
          text: "✅ Thank you {name}! Your service appointment for *{booking_date}* has been confirmed. Our technician will visit between {start_time} and {end_time}.",
          next_node_key: "end_flow",
        },
      },
      {
        node_key: "agent_handoff",
        node_type: "handoff",
        config: {
          note: "Customer requested human support specialist.",
        },
      },
      {
        node_key: "end_flow",
        node_type: "end",
        config: {},
      },
    ]);
    setShowEditor(true);
  };

  const handleEdit = async (flow) => {
    setEditingFlow(flow);
    setFormName(flow.name);
    setFormDesc(flow.description || "");
    setFormTriggerType(flow.trigger_type || "keyword");
    setFormEntryNode(flow.entry_node_key || "start");

    let cfg = {};
    try {
      cfg = typeof flow.trigger_config === "string" ? JSON.parse(flow.trigger_config) : (flow.trigger_config || {});
    } catch (_) {}
    setFormKeywords(Array.isArray(cfg.keywords) ? cfg.keywords.join(", ") : "hi, hello, menu");

    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/wa/flows/${flow.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFormNodes(res.data.nodes || []);
    } catch {
      setFormNodes([]);
    }
    setShowEditor(true);
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "draft" : "active";
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API}/api/wa/flows/${id}/status`,
        { status: nextStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFlows();
    } catch (err) {
      alert("Failed to toggle status: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this flow?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/flows/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchFlows();
    } catch (err) {
      alert("Failed to delete flow");
    }
  };

  const handleSaveFlow = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return alert("Flow name is required");
    setSaving(true);

    const keywords = formKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    const payload = {
      name: formName.trim(),
      description: formDesc.trim(),
      trigger_type: formTriggerType,
      trigger_config: { keywords },
      entry_node_key: formEntryNode || "start",
      nodes: formNodes,
    };

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      if (editingFlow) {
        await axios.put(`${API}/api/wa/flows/${editingFlow.id}`, payload, { headers });
      } else {
        await axios.post(`${API}/api/wa/flows`, payload, { headers });
      }
      setShowEditor(false);
      fetchFlows();
    } catch (err) {
      alert("Failed to save flow: " + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  const updateNodeConfig = (index, newConfig) => {
    setFormNodes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], config: { ...updated[index].config, ...newConfig } };
      return updated;
    });
  };

  const updateNodeKey = (index, newKey) => {
    setFormNodes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], node_key: newKey };
      return updated;
    });
  };

  // Upload an image / PDF / doc / video / audio straight into a Media step.
  // Reuses the existing WhatsApp media uploader, which returns a public URL,
  // the detected media_type and the original filename.
  const handleUploadNodeMedia = async (nodeIdx, file) => {
    if (!file) return;
    setUploadingIdx(nodeIdx);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/api/whatsapp/upload-media`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      updateNodeConfig(nodeIdx, {
        media_url: res.data.url,
        media_type: res.data.media_type,
        filename: res.data.filename,
      });
    } catch (err) {
      alert("Upload failed: " + (err.response?.data?.error || err.message));
    }
    setUploadingIdx(null);
  };

  const insertPlaceholderIntoNode = (nodeIdx, fieldName, tag) => {
    const currentVal = formNodes[nodeIdx]?.config?.[fieldName] || "";
    updateNodeConfig(nodeIdx, { [fieldName]: currentVal + (currentVal.length > 0 ? " " : "") + tag });
  };

  const addNode = (type) => {
    const nodeKey = `step_${Date.now().toString().slice(-4)}`;
    let defaultCfg = {};

    if (type === "send_message") defaultCfg = { text: "Hello {name}! How can we assist you with {service} today?", next_node_key: "end_flow" };
    if (type === "send_media") defaultCfg = { media_type: "image", media_url: "https://achme.in/brochure.pdf", caption: "Check out our latest catalog for {company}!", next_node_key: "end_flow" };
    if (type === "delay") defaultCfg = { delay_seconds: 5, next_node_key: "end_flow" };
    if (type === "send_buttons") defaultCfg = {
      text: "Please choose an option:",
      footer_text: "Reply with the number or tap a button",
      buttons: [
        { reply_id: "opt_1", title: "1. 🛠️ Services", next_node_key: "end_flow" },
        { reply_id: "opt_2", title: "2. 📅 Book Appointment", next_node_key: "end_flow" }
      ]
    };
    if (type === "send_list") defaultCfg = {
      text: "Explore our solutions:",
      button_text: "View Solutions",
      title: "ACHME Catalog",
      rows: [
        { id: "row_1", title: "HVAC Maintenance", description: "Preventive AC maintenance & AMC", next_node_key: "end_flow" },
        { id: "row_2", title: "Electrical Safety", description: "Audit & compliance inspections", next_node_key: "end_flow" }
      ]
    };
    if (type === "collect_input") defaultCfg = { prompt_text: "Please enter your city/location:", var_key: "city", validation_type: "none", next_node_key: "end_flow" };
    if (type === "crm_lookup") defaultCfg = { lookup_type: "invoice", branch_on_result: true, found_next: "end_flow", not_found_next: "end_flow" };
    if (type === "condition") defaultCfg = { subject_key: "input", operator: "equals", value: "yes", true_next: "end_flow", false_next: "end_flow" };
    if (type === "api_webhook") defaultCfg = { method: "GET", url: "https://api.example.com/check-status?phone={phone}", headers: "", body: "", response_mapping: {}, success_next: "end_flow", error_next: "end_flow" };
    if (type === "create_lead") defaultCfg = { default_service: "WhatsApp Lead", notes: "Captured via WhatsApp Flow", next_node_key: "end_flow" };
    if (type === "set_variable") defaultCfg = { variable_name: "lead_status", variable_value: "Hot", next_node_key: "end_flow" };
    if (type === "set_tag") defaultCfg = { tag: "Bot Qualified", next_node_key: "end_flow" };
    if (type === "send_template") defaultCfg = { template_id: "", next_node_key: "end_flow" };
    if (type === "ai_generate") defaultCfg = { system_prompt: "You are a helpful support assistant for {company}. Answer briefly and politely in the customer's language.", next_node_key: "end_flow" };
    if (type === "ai_intent") defaultCfg = { branches: { booking: "end_flow", pricing: "end_flow", support: "end_flow" }, fallback_node: "end_flow" };
    if (type === "add_to_group") defaultCfg = { group_id: "", next_node_key: "end_flow" };
    if (type === "jump_to_flow") defaultCfg = { target_flow_id: "", next_node_key: "end_flow" };
    if (type === "handoff") defaultCfg = { note: "Customer transferred to human live support agent." };
    if (type === "end") defaultCfg = {};

    setFormNodes((prev) => [...prev, { node_key: nodeKey, node_type: type, config: defaultCfg }]);
  };

  const removeNode = (index) => {
    setFormNodes((prev) => prev.filter((_, i) => i !== index));
  };

  const moveNode = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === formNodes.length - 1)) return;
    setFormNodes((prev) => {
      const copy = [...prev];
      const targetIdx = index + direction;
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Direct Trigger modal
  const openTriggerModal = (flow) => {
    setTriggerFlow(flow);
    setTargetPhone("");
    setShowTriggerModal(true);
  };

  const handleExecuteTrigger = async () => {
    if (!targetPhone.trim() || !triggerFlow) return;
    setTriggering(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/wa/flows/${triggerFlow.id}/trigger-phone`, {
        phone: targetPhone.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(res.data?.message || `Flow started for +${targetPhone}`);
      setShowTriggerModal(false);
      fetchFlows();
    } catch (err) {
      alert("Failed to trigger flow: " + (err.response?.data?.error || err.message));
    }
    setTriggering(false);
  };

  // Analytics Modal
  const openAnalytics = async (flow) => {
    setAnalyticsFlow(flow);
    setAnalyticsLoading(true);
    setShowAnalyticsModal(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/wa/flows/${flow.id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalyticsData(res.data);
    } catch (err) {
      console.error(err);
    }
    setAnalyticsLoading(false);
  };

  // Simulator Start & Interaction
  const handleOpenSimulator = async (flow) => {
    setSimFlow(flow);
    setSimMessages([]);
    setSimVars({});
    setSimCurrentNode(null);
    setSimLogs([]);
    setSimEnded(false);
    setSimTrigger(null);
    setShowSimulator(true);
    setSimLoading(true);

    // Open with a message that ACTUALLY fires this flow, so the preview matches
    // WhatsApp. A hardcoded "hi" starts an invoice-keyword flow in the simulator
    // that would never have started on a real chat.
    let cfg = {};
    try {
      cfg = typeof flow.trigger_config === "string" ? JSON.parse(flow.trigger_config) : (flow.trigger_config || {});
    } catch (_) {}
    const firstKeyword = (cfg.keywords || [])[0] || cfg.keyword || "hi";
    const openingMessage = (flow.trigger_type === "keyword" || !flow.trigger_type) ? firstKeyword : "hi";

    setSimMessages([{ sender: "user", type: "text", text: openingMessage, at: new Date() }]);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API}/api/wa/flows/${flow.id}/test-simulate`,
        { input: openingMessage, state: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        setSimMessages((prev) => [...prev, ...(res.data.messages || [])]);
        setSimVars(res.data.vars || {});
        setSimCurrentNode(res.data.currentNodeKey);
        setSimLogs(res.data.logs || []);
        setSimEnded(res.data.isEnded || false);
        setSimTrigger({
          type: res.data.triggerType,
          keywords: res.data.triggerKeywords || [],
          matched: res.data.triggerMatched,
          input: openingMessage,
        });
      }
    } catch (err) {
      setSimMessages([{ sender: "system", type: "text", text: `Simulation error: ${err.message}` }]);
    }
    setSimLoading(false);
  };

  const handleSendSimInput = async (inputText) => {
    if (!inputText || !simFlow || simLoading) return;
    const cleanInput = String(inputText).trim();
    if (!cleanInput) return;

    // Add user message to UI immediately
    setSimMessages((prev) => [...prev, { sender: "user", type: "text", text: cleanInput, at: new Date() }]);
    setSimInput("");
    setSimLoading(true);

    try {
      const token = localStorage.getItem("token");
      const currentState = {
        currentNodeKey: simCurrentNode,
        vars: simVars,
      };

      const res = await axios.post(
        `${API}/api/wa/flows/${simFlow.id}/test-simulate`,
        { input: cleanInput, state: currentState },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        const newBotMessages = res.data.messages || [];
        setSimMessages((prev) => [...prev, ...newBotMessages]);
        setSimVars(res.data.vars || {});
        setSimCurrentNode(res.data.currentNodeKey);
        setSimLogs(res.data.logs || []);
        setSimEnded(res.data.isEnded || false);
      }
    } catch (err) {
      setSimMessages((prev) => [...prev, { sender: "system", type: "text", text: `Error: ${err.message}` }]);
    }
    setSimLoading(false);
  };

  // Node Key List for Dropdowns
  const availableNodeKeys = formNodes.map((n) => n.node_key);

  return (
    <div className="w-full pb-12 bg-slate-50/50 min-h-screen">
      <WhatsAppNav />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#25D366] to-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Chatbot Flows</h1>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {flows.length} Smart Flows
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Visual decision trees, dynamic live CRM lookups, API webhooks, 24/7 lead capture, and live agent handoffs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSeedPrebuilt}
            disabled={seeding}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-300/80 rounded-xl hover:bg-emerald-100 transition text-xs font-bold shadow-sm"
          >
            {seeding ? <Loader2 size={15} className="animate-spin text-emerald-600" /> : <Sparkles size={15} className="text-emerald-600" />}
            <span>Load 6 Prebuilt Smart Flows</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl transition text-xs font-bold shadow-md shadow-[#25D366]/20"
          >
            <Plus size={16} />
            <span>Create New Flow</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("flows")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "flows"
              ? "bg-[#25D366] text-white shadow-sm"
              : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <Layers size={15} />
          <span>Active Chatbot Flows ({flows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("runs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === "runs"
              ? "bg-[#25D366] text-white shadow-sm"
              : "bg-white text-gray-600 border hover:bg-gray-50"
          }`}
        >
          <ListOrdered size={15} />
          <span>Execution Runs & Captured Leads</span>
        </button>
      </div>

      {/* TAB 1: Flows Grid */}
      {activeTab === "flows" && (
        <>
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 size={36} className="animate-spin text-[#25D366]" />
            </div>
          ) : flows.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm p-8 max-w-lg mx-auto">
              <Bot size={48} className="mx-auto mb-3 text-emerald-500/60" />
              <h3 className="text-base font-bold text-gray-800">No Chatbot Flows Found</h3>
              <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed">
                Click "Load 6 Prebuilt Smart Flows" to instantly install business menus, invoice lookup bots, and AMC booking trees.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleSeedPrebuilt}
                  className="px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 transition flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>Load Prebuilt Flows</span>
                </button>
                <button
                  onClick={handleOpenCreate}
                  className="px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] transition shadow-md shadow-[#25D366]/20"
                >
                  + Create First Flow
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {flows.map((flow) => {
                const isActive = flow.status === "active";
                let cfg = {};
                try {
                  cfg = typeof flow.trigger_config === "string" ? JSON.parse(flow.trigger_config) : (flow.trigger_config || {});
                } catch (_) {}

                return (
                  <div
                    key={flow.id}
                    className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top status & Action buttons */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
                          {isActive ? "Listening Live" : "Paused / Draft"}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenSimulator(flow)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Interactive WhatsApp Simulator"
                          >
                            <Smartphone size={15} />
                          </button>
                          <button
                            onClick={() => openTriggerModal(flow)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Launch on Phone Number"
                          >
                            <PhoneCall size={15} />
                          </button>
                          <button
                            onClick={() => openAnalytics(flow)}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            title="Flow Funnel Analytics"
                          >
                            <BarChart2 size={15} />
                          </button>
                          <button
                            onClick={() => handleEdit(flow)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Flow Nodes"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(flow.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete Flow"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition line-clamp-1">
                        {flow.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {flow.description || "Multi-branch conversational bot with dynamic CRM routing."}
                      </p>

                      {/* Specs */}
                      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Trigger:</span>
                          <span className={`font-semibold px-2 py-0.5 rounded text-[10px] ${
                            flow.trigger_type === "all_inbound"
                              ? "bg-emerald-100 text-emerald-800 font-bold"
                              : flow.trigger_type === "first_inbound" || flow.trigger_type === "welcome"
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : flow.trigger_type === "ai_intent"
                              ? "bg-purple-100 text-purple-800 font-bold"
                              : "bg-gray-100 text-gray-700 font-semibold uppercase"
                          }`}>
                            {flow.trigger_type === "all_inbound"
                              ? "🌐 24/7 Universal / No Keyword"
                              : flow.trigger_type === "first_inbound" || flow.trigger_type === "welcome"
                              ? "👋 First-Inbound Welcome"
                              : flow.trigger_type === "ai_intent"
                              ? "🧠 AI Intent"
                              : "🔑 " + (flow.trigger_type || "keyword")}
                          </span>
                        </div>

                        {flow.trigger_type === "keyword" && cfg.keywords && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Keywords:</span>
                            <span className="font-medium text-emerald-700 truncate max-w-[160px] text-[11px]">
                              {Array.isArray(cfg.keywords) ? cfg.keywords.join(", ") : cfg.keywords}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Steps / Nodes:</span>
                          <span className="font-bold text-gray-800">{flow.node_count || 0} steps</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Total Executions:</span>
                          <span className="font-bold text-emerald-600">{flow.execution_count || 0} runs</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(flow.id, flow.status)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          isActive
                            ? "bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        {isActive ? "Pause Flow" : "Activate Live"}
                      </button>

                      <button
                        onClick={() => handleOpenSimulator(flow)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Open interactive phone simulator"
                      >
                        <Play size={12} className="text-[#25D366]" />
                        <span>Test Simulator</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: Execution Runs & Captured Leads */}
      {activeTab === "runs" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Flow Execution Runs & Captured Context</h2>
              <p className="text-xs text-gray-500 mt-0.5">Audit log of customer conversations, captured variables, and handoffs</p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedRunFlowId}
                onChange={(e) => setSelectedRunFlowId(e.target.value)}
                className="px-3 py-2 border rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-[#25D366]"
              >
                {flows.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <button
                onClick={() => fetchRuns(selectedRunFlowId)}
                className="p-2 border rounded-xl hover:bg-gray-50 text-gray-600"
                title="Refresh logs"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          </div>

          {runsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={30} className="animate-spin text-[#25D366]" />
            </div>
          ) : runsList.length === 0 ? (
            <div className="text-center py-14 text-gray-400">
              <ListOrdered size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="text-xs font-bold">No runs recorded for this flow yet.</p>
              <p className="text-[11px] text-gray-400 mt-1">Send a message to your WhatsApp number or use the simulator to trigger a run.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-600 uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Customer Phone</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Captured CRM Variables</th>
                    <th className="py-2.5 px-3">End Reason</th>
                    <th className="py-2.5 px-3">Started At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {runsList.map((r) => {
                    let varsObj = {};
                    try {
                      varsObj = typeof r.vars === "string" ? JSON.parse(r.vars) : (r.vars || {});
                    } catch (_) {}

                    return (
                      <tr key={r.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-3 font-mono font-bold text-gray-800">
                          +{r.phone}
                          {r.contact_name && <span className="block text-[11px] font-normal text-gray-500">{r.contact_name}</span>}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.status === "handed_off"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(varsObj).slice(0, 4).map(([k, v]) => (
                              <span key={k} className="px-1.5 py-0.5 bg-gray-100 border text-gray-700 rounded text-[10px]">
                                <b>{k}:</b> {String(v)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-500 font-mono text-[11px]">{r.end_reason || "in_progress"}</td>
                        <td className="py-3 px-3 text-gray-400 text-[11px]">
                          {r.started_at ? new Date(r.started_at).toLocaleString("en-IN") : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Visual Flow Builder & Step Designer ── */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setShowEditor(false)}>
          <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[94vh] flex flex-col border border-gray-100 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <GitFork size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {editingFlow ? "Visual Flow Builder" : "Design New Chatbot Flow"}
                  </h2>
                  <p className="text-xs text-gray-500">Configure multi-turn nodes, CRM lookups, and branch logic</p>
                </div>
              </div>
              <button onClick={() => setShowEditor(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFlow} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Trigger & Settings Card */}
              <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Flow Name *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Main Interactive Business Menu"
                      className="w-full px-3.5 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Trigger Type</label>
                    <select
                      value={formTriggerType}
                      onChange={(e) => setFormTriggerType(e.target.value)}
                      className="w-full px-3 py-2.5 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-semibold text-gray-800"
                    >
                      <option value="keyword">🔑 Keyword Match (e.g. hi, menu, book, amc)</option>
                      <option value="all_inbound">🌐 Universal 24/7 Bot (All Inbound Messages)</option>
                      <option value="first_inbound">👋 First Inbound Message (Welcome Bot)</option>
                      <option value="ai_intent">🧠 AI Smart Intent Classifier</option>
                      <option value="manual">⚡ Manual / API Trigger Only</option>
                    </select>
                  </div>
                </div>

                {formTriggerType === "keyword" && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                      Trigger Keywords (comma separated)
                    </label>
                    <input
                      type="text"
                      value={formKeywords}
                      onChange={(e) => setFormKeywords(e.target.value)}
                      placeholder="e.g. hi, hello, menu, start, help, price, book, amc"
                      className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      💡 If incoming messages don't match these keywords, active First-Inbound / Welcome bots and Welcome Automations will automatically greet the customer.
                    </p>
                  </div>
                )}

                {formTriggerType === "first_inbound" && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>👋 First Inbound / Welcome Bot Enabled</span>
                    </p>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Automatically welcomes any user who messages your WhatsApp number for the first time (or begins a new conversation session), even if they type arbitrary questions without keywords.
                    </p>
                  </div>
                )}

                {formTriggerType === "all_inbound" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>🌐 Universal 24/7 Receptionist / Default Fallback Enabled</span>
                    </p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      This flow will automatically listen and reply within seconds to ANY incoming message that doesn't match a specific keyword, providing an instant 24/7 guided interactive menu.
                    </p>
                  </div>
                )}

                {formTriggerType === "ai_intent" && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-800">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>🧠 AI Smart Intent Routing Enabled</span>
                    </p>
                    <p className="text-[11px] text-purple-700 mt-0.5">
                      Uses advanced AI LLM to analyze the customer's intent (e.g., booking vs. billing vs. breakdown) and branches to the exact workflow step automatically.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Description</label>
                    <input
                      type="text"
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      placeholder="Describe what this bot does..."
                      className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Entry Step Node</label>
                    <select
                      value={formEntryNode}
                      onChange={(e) => setFormEntryNode(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366] bg-white font-mono"
                    >
                      {availableNodeKeys.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Node Sequence Builder */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase flex items-center gap-2">
                      <span>Flow Execution Steps ({formNodes.length} nodes)</span>
                    </h3>
                    <p className="text-[11px] text-gray-500">Each step executes sequentially or branches based on customer choices.</p>
                  </div>

                  {/* Node Add Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {NODE_TYPES.map((nt) => (
                      <button
                        key={nt.type}
                        type="button"
                        onClick={() => addNode(nt.type)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition flex items-center gap-1 ${nt.color} hover:opacity-90`}
                        title={`Add ${nt.label}`}
                      >
                        <span>{nt.icon}</span>
                        <span>{nt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nodes List */}
                <div className="space-y-3.5">
                  {formNodes.map((node, idx) => {
                    const nodeTypeMeta = NODE_TYPES.find((n) => n.type === node.node_type) || { label: node.node_type, icon: "⚡", color: "bg-gray-100" };

                    return (
                      <div
                        key={idx}
                        className="p-4 bg-white rounded-2xl border-2 border-gray-200/90 shadow-sm relative space-y-3 hover:border-emerald-300 transition"
                      >
                        {/* Step Card Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="w-6 h-6 bg-[#25D366] text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            
                            <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${nodeTypeMeta.color}`}>
                              <span>{nodeTypeMeta.icon}</span>
                              <span>{nodeTypeMeta.label}</span>
                            </span>

                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-gray-400 font-mono">key:</span>
                              <input
                                type="text"
                                value={node.node_key}
                                onChange={(e) => updateNodeKey(idx, e.target.value)}
                                className="px-2 py-0.5 bg-gray-50 border rounded-md text-xs font-mono font-bold text-gray-800 outline-none w-32 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveNode(idx, -1)}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Move step up"
                            >
                              <MoveUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveNode(idx, 1)}
                              disabled={idx === formNodes.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="Move step down"
                            >
                              <MoveDown size={14} />
                            </button>

                            {node.node_type !== "start" && (
                              <button
                                type="button"
                                onClick={() => removeNode(idx)}
                                className="p-1 text-gray-400 hover:text-red-600 rounded-lg ml-1"
                                title="Remove step"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Node Config Forms */}
                        {node.node_type === "send_message" && (
                          <div className="space-y-2">
                            <div>
                              <WAVariablePicker
                                onInsert={(tag) => updateNodeConfig(idx, { text: (node.config.text || "") + " " + tag })}
                                className="mb-2"
                              />
                              <textarea
                                rows={3}
                                value={node.config.text || ""}
                                onChange={(e) => updateNodeConfig(idx, { text: e.target.value })}
                                className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 resize-none outline-none focus:bg-white focus:ring-2 focus:ring-[#25D366]"
                                placeholder="Hello {{name}}! {{greeting_time}}, thank you for messaging {{company}}. Your service is {{service}} in {{city}}..."
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-xl text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Choose Next Step --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "send_buttons" && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">Menu Prompt Text</label>
                              <textarea
                                rows={2}
                                value={node.config.text || ""}
                                onChange={(e) => updateNodeConfig(idx, { text: e.target.value })}
                                className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 resize-none outline-none focus:bg-white focus:ring-2 focus:ring-[#25D366]"
                                placeholder="Please choose an option:"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                <label className="text-[11px] text-gray-600 font-bold uppercase">Interactive Buttons / Branches</label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentBtns = node.config.buttons || [];
                                      const newOptNum = currentBtns.length + 1;
                                      updateNodeConfig(idx, {
                                        buttons: [
                                          ...currentBtns,
                                          { reply_id: `opt_${newOptNum}`, title: `${newOptNum}. Option ${newOptNum}`, next_node_key: "" }
                                        ]
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded hover:bg-emerald-200"
                                  >
                                    + Add Option
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentBtns = node.config.buttons || [];
                                      updateNodeConfig(idx, {
                                        buttons: [
                                          ...currentBtns,
                                          { reply_id: "opt_back", title: "0. 🔙 Back to Menu", next_node_key: "start" }
                                        ]
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-200"
                                  >
                                    + 🔙 Back
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentBtns = node.config.buttons || [];
                                      updateNodeConfig(idx, {
                                        buttons: [
                                          ...currentBtns,
                                          { reply_id: "opt_agent", title: "👤 Live Agent", next_node_key: "agent_handoff" }
                                        ]
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded hover:bg-rose-100 border border-rose-200"
                                  >
                                    + 👤 Agent
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {(node.config.buttons || []).map((btn, bIdx) => (
                                  <div key={bIdx} className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border">
                                    <input
                                      type="text"
                                      placeholder="Option Title (e.g. 1. 🛠️ Services)"
                                      value={btn.title}
                                      onChange={(e) => {
                                        const updatedBtns = [...node.config.buttons];
                                        updatedBtns[bIdx] = { ...updatedBtns[bIdx], title: e.target.value };
                                        updateNodeConfig(idx, { buttons: updatedBtns });
                                      }}
                                      className="flex-1 p-1.5 border rounded-lg text-xs bg-white"
                                    />
                                    <ArrowRight size={14} className="text-gray-400" />
                                    <select
                                      value={btn.next_node_key || ""}
                                      onChange={(e) => {
                                        const updatedBtns = [...node.config.buttons];
                                        updatedBtns[bIdx] = { ...updatedBtns[bIdx], next_node_key: e.target.value };
                                        updateNodeConfig(idx, { buttons: updatedBtns });
                                      }}
                                      className="w-48 p-1.5 border rounded-lg text-xs font-mono bg-white"
                                    >
                                      <option value="">-- Target Step --</option>
                                      {availableNodeKeys.map((k) => (
                                        <option key={k} value={k}>{k}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updatedBtns = node.config.buttons.filter((_, i) => i !== bIdx);
                                        updateNodeConfig(idx, { buttons: updatedBtns });
                                      }}
                                      className="p-1 text-gray-400 hover:text-red-600"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {node.node_type === "send_list" && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">List Header Title</label>
                                <input
                                  type="text"
                                  value={node.config.title || ""}
                                  onChange={(e) => updateNodeConfig(idx, { title: e.target.value })}
                                  placeholder="e.g. Our Service Catalog"
                                  className="w-full p-2 border rounded-xl text-xs bg-gray-50"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">List Button Text</label>
                                <input
                                  type="text"
                                  value={node.config.button_text || "View Options"}
                                  onChange={(e) => updateNodeConfig(idx, { button_text: e.target.value })}
                                  placeholder="e.g. View Options"
                                  className="w-full p-2 border rounded-xl text-xs bg-gray-50"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] text-gray-600 font-bold uppercase mb-1">List Body Text</label>
                              <textarea
                                rows={2}
                                value={node.config.text || ""}
                                onChange={(e) => updateNodeConfig(idx, { text: e.target.value })}
                                className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 resize-none outline-none focus:bg-white focus:ring-2 focus:ring-[#25D366]"
                                placeholder="Please select a service from our catalog below:"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                                <label className="text-[11px] text-gray-600 font-bold uppercase">List Rows (Up to 10)</label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentRows = node.config.rows || [];
                                      const newNum = currentRows.length + 1;
                                      updateNodeConfig(idx, {
                                        rows: [
                                          ...currentRows,
                                          { id: `row_${newNum}`, title: `Service ${newNum}`, description: "Description", next_node_key: "" }
                                        ]
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded hover:bg-teal-200"
                                  >
                                    + Add Row
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentRows = node.config.rows || [];
                                      updateNodeConfig(idx, {
                                        rows: [
                                          ...currentRows,
                                          { id: "row_back", title: "0. 🔙 Back to Menu", description: "Return to previous menu", next_node_key: "start" }
                                        ]
                                      });
                                    }}
                                    className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded hover:bg-slate-200"
                                  >
                                    + 🔙 Back
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {(node.config.rows || []).map((row, rIdx) => (
                                  <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-gray-50 p-2 rounded-xl border items-center">
                                    <input
                                      type="text"
                                      placeholder="Title (e.g. AC Maintenance)"
                                      value={row.title}
                                      onChange={(e) => {
                                        const updated = [...node.config.rows];
                                        updated[rIdx] = { ...updated[rIdx], title: e.target.value };
                                        updateNodeConfig(idx, { rows: updated });
                                      }}
                                      className="sm:col-span-4 p-1.5 border rounded-lg text-xs bg-white"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Short description"
                                      value={row.description || ""}
                                      onChange={(e) => {
                                        const updated = [...node.config.rows];
                                        updated[rIdx] = { ...updated[rIdx], description: e.target.value };
                                        updateNodeConfig(idx, { rows: updated });
                                      }}
                                      className="sm:col-span-4 p-1.5 border rounded-lg text-xs bg-white"
                                    />
                                    <select
                                      value={row.next_node_key || ""}
                                      onChange={(e) => {
                                        const updated = [...node.config.rows];
                                        updated[rIdx] = { ...updated[rIdx], next_node_key: e.target.value };
                                        updateNodeConfig(idx, { rows: updated });
                                      }}
                                      className="sm:col-span-3 p-1.5 border rounded-lg text-xs font-mono bg-white"
                                    >
                                      <option value="">-- Target --</option>
                                      {availableNodeKeys.map((k) => (
                                        <option key={k} value={k}>{k}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = node.config.rows.filter((_, i) => i !== rIdx);
                                        updateNodeConfig(idx, { rows: updated });
                                      }}
                                      className="sm:col-span-1 p-1 text-gray-400 hover:text-red-600 flex justify-center"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {node.node_type === "collect_input" && (
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-gray-700 font-bold uppercase">Question Prompt Text *</label>
                                <span className="text-[10px] text-purple-700 font-semibold">Collects & saves user response</span>
                              </div>

                              <WAVariablePicker
                                onInsert={(tag) => updateNodeConfig(idx, { prompt_text: (node.config.prompt_text || "") + " " + tag })}
                                className="mb-2"
                              />

                              <input
                                type="text"
                                value={node.config.prompt_text || ""}
                                onChange={(e) => updateNodeConfig(idx, { prompt_text: e.target.value })}
                                placeholder="e.g. Hello {{name}}! Please provide your service location or city:"
                                className="w-full p-2.5 border rounded-xl text-xs bg-gray-50 outline-none focus:bg-white focus:ring-2 focus:ring-[#25D366]"
                              />

                              {/* 1-Click Question Presets */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Quick Questions:</span>
                                {[
                                  { label: "👤 Name", q: "Please share your full name:", v: "name", t: "none" },
                                  { label: "📍 City / Location", q: "Which city or area are you located in?", v: "city", t: "none" },
                                  { label: "📞 Mobile", q: "Please confirm your 10-digit mobile number:", v: "phone", t: "phone" },
                                  { label: "✉️ Email", q: "What is your email address for invoices?", v: "email", t: "email" },
                                  { label: "📅 Preferred Date", q: "When would you prefer our technician to visit? (e.g. Tomorrow or 25 Aug):", v: "booking_date", t: "none" },
                                  { label: "🛠️ Service Requirement", q: "Please describe your service or maintenance requirement:", v: "inquiry", t: "none" },
                                  { label: "📎 Photo / Document", q: "Please send a photo or PDF of the issue (or type your answer):", v: "attachment", t: "none", media: true },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => updateNodeConfig(idx, {
                                      prompt_text: preset.q,
                                      var_key: preset.v,
                                      validation_type: preset.t,
                                      accept_media: preset.media === true ? true : undefined
                                    })}
                                    className="px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-lg text-[10px] font-semibold transition"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Store in Variable</label>
                                <input
                                  type="text"
                                  value={node.config.var_key || ""}
                                  onChange={(e) => updateNodeConfig(idx, { var_key: e.target.value })}
                                  placeholder="e.g. booking_date, city, inquiry"
                                  className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Validation Type</label>
                                <select
                                  value={node.config.validation_type || "none"}
                                  onChange={(e) => updateNodeConfig(idx, { validation_type: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-gray-50"
                                >
                                  <option value="none">Any Text Response</option>
                                  <option value="number">Numeric Only (Digits)</option>
                                  <option value="email">Email Address (@)</option>
                                  <option value="phone">10-Digit Mobile Number</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                                <select
                                  value={node.config.next_node_key || ""}
                                  onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                                >
                                  <option value="">-- Choose Next Step --</option>
                                  {availableNodeKeys.map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Attachment answers */}
                            {(() => {
                              const strict = !!(node.config.regex) ||
                                (node.config.validation_type && node.config.validation_type !== "none");
                              const accepted = node.config.accept_media === true ||
                                (node.config.accept_media !== false && !strict);
                              return (
                                <label className="flex items-start gap-2 p-2.5 bg-cyan-50/60 border border-cyan-100 rounded-xl cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={accepted}
                                    onChange={(e) => updateNodeConfig(idx, { accept_media: e.target.checked })}
                                    className="mt-0.5 accent-cyan-600"
                                  />
                                  <span className="text-[10px] leading-relaxed text-gray-700">
                                    <span className="font-bold uppercase">Accept photo / PDF / file as the answer</span>
                                    <br />
                                    The file is saved to the CRM and stored in{" "}
                                    <code className="font-mono text-cyan-800">
                                      {"{"}{node.config.var_key || "input"}_url{"}"}
                                    </code>
                                    {strict && !accepted && (
                                      <span className="text-amber-700"> — off by default here because this question is validated as {node.config.validation_type || "regex"}.</span>
                                    )}
                                  </span>
                                </label>
                              );
                            })()}
                          </div>
                        )}

                        {node.node_type === "crm_lookup" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div>
                              <label className="block text-[10px] text-indigo-900 font-bold uppercase">CRM Query Target</label>
                              <select
                                value={node.config.lookup_type || "invoice"}
                                onChange={(e) => updateNodeConfig(idx, { lookup_type: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              >
                                <option value="invoice">Latest Client Invoice</option>
                                <option value="amc">Active AMC Maintenance Contract</option>
                                <option value="quotation">Latest Quotation / Proposal</option>
                                <option value="client">Client / Contact Record</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-indigo-900 font-bold uppercase">Found Record Next Step</label>
                              <select
                                value={node.config.found_next || ""}
                                onChange={(e) => updateNodeConfig(idx, { found_next: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Target when Found --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-indigo-900 font-bold uppercase">Not Found Next Step</label>
                              <select
                                value={node.config.not_found_next || ""}
                                onChange={(e) => updateNodeConfig(idx, { not_found_next: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Target when Not Found --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "condition" && (
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                            <div>
                              <label className="block text-[10px] text-amber-900 font-bold uppercase">Variable Subject</label>
                              <input
                                type="text"
                                value={node.config.subject_key || "input"}
                                onChange={(e) => updateNodeConfig(idx, { subject_key: e.target.value })}
                                placeholder="e.g. city, input, amount"
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-amber-900 font-bold uppercase">Operator</label>
                              <select
                                value={node.config.operator || "equals"}
                                onChange={(e) => updateNodeConfig(idx, { operator: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              >
                                <option value="equals">Equals</option>
                                <option value="not_equals">Not Equals</option>
                                <option value="contains">Contains</option>
                                <option value="greater_than">Greater Than (&gt;)</option>
                                <option value="less_than">Less Than (&lt;)</option>
                                <option value="is_empty">Is Empty</option>
                                <option value="is_not_empty">Is Not Empty</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] text-amber-900 font-bold uppercase">Value</label>
                              <input
                                type="text"
                                value={node.config.value || ""}
                                onChange={(e) => updateNodeConfig(idx, { value: e.target.value })}
                                placeholder="e.g. Bangalore"
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="block text-[10px] text-emerald-800 font-bold uppercase">True Target</label>
                              <select
                                value={node.config.true_next || ""}
                                onChange={(e) => updateNodeConfig(idx, { true_next: e.target.value })}
                                className="w-full p-1.5 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- If True --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>

                              <label className="block text-[10px] text-rose-800 font-bold uppercase pt-1">False Target</label>
                              <select
                                value={node.config.false_next || ""}
                                onChange={(e) => updateNodeConfig(idx, { false_next: e.target.value })}
                                className="w-full p-1.5 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- If False --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "create_lead" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-sky-50/50 rounded-xl border border-sky-100">
                            <div>
                              <label className="block text-[10px] text-sky-900 font-bold uppercase">Default Service Category</label>
                              <input
                                type="text"
                                value={node.config.default_service || ""}
                                onChange={(e) => updateNodeConfig(idx, { default_service: e.target.value })}
                                placeholder="e.g. AC AMC Service"
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-sky-900 font-bold uppercase">Inquiry Summary Note</label>
                              <input
                                type="text"
                                value={node.config.notes || ""}
                                onChange={(e) => updateNodeConfig(idx, { notes: e.target.value })}
                                placeholder="Booked via WhatsApp: {booking_date}"
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-sky-900 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "delay" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Pause Duration (Seconds)</label>
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={node.config.delay_seconds || 5}
                                onChange={(e) => updateNodeConfig(idx, { delay_seconds: parseInt(e.target.value, 10) || 5 })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Choose Next Step --</option>
                                {availableNodeKeys.map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "send_media" && (
                          <div className="space-y-3 p-3 bg-cyan-50/50 rounded-xl border border-cyan-100">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Media Type</label>
                                <select
                                  value={node.config.media_type || "image"}
                                  onChange={(e) => updateNodeConfig(idx, { media_type: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-medium"
                                >
                                  <option value="image">📷 Image (PNG, JPG, WEBP)</option>
                                  <option value="document">📄 File / PDF / Word / Excel</option>
                                  <option value="video">🎥 Video (MP4, MOV)</option>
                                  <option value="audio">🎵 Audio Voice Note (MP3, OGG)</option>
                                  <option value="link">🔗 Link (sends a rich URL preview)</option>
                                </select>
                              </div>
                              <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] text-gray-500 font-bold uppercase">
                                    {node.config.media_type === "link" ? "Link URL *" : "Media / Document URL *"}
                                  </label>
                                  {node.config.media_type !== "link" && (
                                    <label className="text-[10px] font-bold text-cyan-800 bg-white border border-cyan-300 rounded px-2 py-0.5 cursor-pointer hover:bg-cyan-50">
                                      {uploadingIdx === idx ? "Uploading…" : "⬆ Upload file"}
                                      <input
                                        type="file"
                                        className="hidden"
                                        disabled={uploadingIdx === idx}
                                        onChange={(e) => {
                                          handleUploadNodeMedia(idx, e.target.files?.[0]);
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={node.config.media_url || ""}
                                  onChange={(e) => updateNodeConfig(idx, { media_url: e.target.value })}
                                  placeholder="https://example.com/catalog.pdf — or upload a file"
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase">Caption / Message Text</label>
                                <span className="text-[9px] text-cyan-800">Dynamic variables supported</span>
                              </div>
                              <WAVariablePicker
                                onInsert={(tag) => updateNodeConfig(idx, { caption: (node.config.caption || "") + " " + tag, text: (node.config.text || "") + " " + tag })}
                                className="mb-2"
                              />
                              <input
                                type="text"
                                value={node.config.caption || node.config.text || ""}
                                onChange={(e) => updateNodeConfig(idx, { caption: e.target.value, text: e.target.value })}
                                placeholder="Here is your document / brochure for {{company}}, {{name}}!"
                                className="w-full p-2 border rounded-lg text-xs bg-white"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Attachment Filename (Optional)</label>
                                <input
                                  type="text"
                                  value={node.config.filename || ""}
                                  onChange={(e) => updateNodeConfig(idx, { filename: e.target.value })}
                                  placeholder="e.g. Brochure-2026.pdf"
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                                <select
                                  value={node.config.next_node_key || ""}
                                  onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                >
                                  <option value="">-- Next Step --</option>
                                  {availableNodeKeys.map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {node.node_type === "send_template" && (
                          <div className="space-y-2 p-3 bg-lime-50/50 rounded-xl border border-lime-100">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Approved WhatsApp Template</label>
                              {templates.length > 0 ? (
                                <select
                                  value={node.config.template_id || ""}
                                  onChange={(e) => updateNodeConfig(idx, { template_id: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-medium"
                                >
                                  <option value="">-- Choose Template --</option>
                                  {templates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.language || "en"})</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={node.config.template_id || ""}
                                  onChange={(e) => updateNodeConfig(idx, { template_id: e.target.value })}
                                  placeholder="Template ID or exact template name"
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                />
                              )}
                              <p className="text-[9px] text-gray-500 mt-1">Template variables are filled from the flow's collected data automatically.</p>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "api_webhook" && (
                          <div className="space-y-3 p-3 bg-violet-50/50 rounded-xl border border-violet-100">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Method</label>
                                <select
                                  value={node.config.method || "GET"}
                                  onChange={(e) => updateNodeConfig(idx, { method: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-bold"
                                >
                                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (<option key={m} value={m}>{m}</option>))}
                                </select>
                              </div>
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Endpoint URL *</label>
                                <input
                                  type="text"
                                  value={node.config.url || ""}
                                  onChange={(e) => updateNodeConfig(idx, { url: e.target.value })}
                                  placeholder="https://api.example.com/status?phone={phone}"
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Headers (JSON)</label>
                                <textarea
                                  rows={2}
                                  value={typeof node.config.headers === "string" ? node.config.headers : JSON.stringify(node.config.headers || {})}
                                  onChange={(e) => updateNodeConfig(idx, { headers: e.target.value })}
                                  placeholder='{"Authorization": "Bearer xxx"}'
                                  className="w-full p-2 border rounded-lg text-[11px] bg-white font-mono resize-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-gray-500 font-bold uppercase">Request Body (JSON, non-GET)</label>
                                <textarea
                                  rows={2}
                                  value={typeof node.config.body === "string" ? node.config.body : JSON.stringify(node.config.body || {})}
                                  onChange={(e) => updateNodeConfig(idx, { body: e.target.value })}
                                  placeholder='{"phone": "{phone}", "name": "{name}"}'
                                  className="w-full p-2 border rounded-lg text-[11px] bg-white font-mono resize-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Save Response Into Variables</label>
                              <KeyMapEditor
                                map={node.config.response_mapping || {}}
                                onChange={(next) => updateNodeConfig(idx, { response_mapping: next })}
                                keyPlaceholder="variable_name"
                                valuePlaceholder="data.items[0].status"
                                addLabel="+ Map a response field"
                              />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-emerald-700 font-bold uppercase">On Success →</label>
                                <select
                                  value={node.config.success_next || node.config.next_node_key || ""}
                                  onChange={(e) => updateNodeConfig(idx, { success_next: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                >
                                  <option value="">-- Next Step --</option>
                                  {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] text-rose-700 font-bold uppercase">On Error →</label>
                                <select
                                  value={node.config.error_next || ""}
                                  onChange={(e) => updateNodeConfig(idx, { error_next: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                                >
                                  <option value="">-- Next Step --</option>
                                  {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {node.node_type === "ai_generate" && (
                          <div className="space-y-2 p-3 bg-fuchsia-50/50 rounded-xl border border-fuchsia-100">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">AI Instructions (System Prompt)</label>
                              <WAVariablePicker
                                onInsert={(tag) => updateNodeConfig(idx, { system_prompt: (node.config.system_prompt || "") + " " + tag })}
                                className="mb-2"
                              />
                              <textarea
                                rows={3}
                                value={node.config.system_prompt || ""}
                                onChange={(e) => updateNodeConfig(idx, { system_prompt: e.target.value })}
                                placeholder="You are a helpful support assistant for {company}. Answer briefly in the customer's language."
                                className="w-full p-2.5 border rounded-xl text-xs bg-white resize-none outline-none focus:ring-2 focus:ring-fuchsia-400"
                              />
                              <p className="text-[9px] text-gray-500 mt-1">The customer's last message is sent as the user turn. Uses the AI model configured in WhatsApp AI Settings.</p>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "ai_intent" && (
                          <div className="space-y-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Route Detected Intent → Step</label>
                              <KeyMapEditor
                                map={node.config.branches || {}}
                                onChange={(next) => updateNodeConfig(idx, { branches: next })}
                                keyPlaceholder="intent (e.g. booking)"
                                valueOptions={availableNodeKeys}
                                addLabel="+ Add intent"
                              />
                              <p className="text-[9px] text-gray-500 mt-1">The AI classifies the customer's message into exactly one of these intent names.</p>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Unrecognised Intent →</label>
                              <select
                                value={node.config.fallback_node || ""}
                                onChange={(e) => updateNodeConfig(idx, { fallback_node: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-white font-mono"
                              >
                                <option value="">-- Fallback Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "set_variable" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Variable Name</label>
                              <input
                                type="text"
                                value={node.config.variable_name || ""}
                                onChange={(e) => updateNodeConfig(idx, { variable_name: e.target.value })}
                                placeholder="lead_status"
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Value (variables allowed)</label>
                              <input
                                type="text"
                                value={node.config.variable_value || ""}
                                onChange={(e) => updateNodeConfig(idx, { variable_value: e.target.value })}
                                placeholder="Hot — {selected_option}"
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "set_tag" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Tag to Apply</label>
                              <input
                                type="text"
                                value={node.config.tag || ""}
                                onChange={(e) => updateNodeConfig(idx, { tag: e.target.value })}
                                placeholder="Bot Qualified"
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "add_to_group" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Contact Group</label>
                              {groups.length > 0 ? (
                                <select
                                  value={node.config.group_id || ""}
                                  onChange={(e) => updateNodeConfig(idx, { group_id: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-medium"
                                >
                                  <option value="">-- Choose Group --</option>
                                  {groups.map((g) => (
                                    <option key={g.id} value={g.id}>{g.name} ({g.contact_count || 0})</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={node.config.group_id || ""}
                                  onChange={(e) => updateNodeConfig(idx, { group_id: e.target.value })}
                                  placeholder="Group ID"
                                  className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                                />
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Next Step</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Next Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "jump_to_flow" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">Hand Over To Flow</label>
                              <select
                                value={node.config.target_flow_id || ""}
                                onChange={(e) => updateNodeConfig(idx, { target_flow_id: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-medium"
                              >
                                <option value="">-- Choose Flow --</option>
                                {flows
                                  .filter((f) => !editingFlow || f.id !== editingFlow.id)
                                  .map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-500 font-bold uppercase">If Flow Missing →</label>
                              <select
                                value={node.config.next_node_key || ""}
                                onChange={(e) => updateNodeConfig(idx, { next_node_key: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs bg-gray-50 font-mono"
                              >
                                <option value="">-- Fallback Step --</option>
                                {availableNodeKeys.map((k) => (<option key={k} value={k}>{k}</option>))}
                              </select>
                            </div>
                          </div>
                        )}

                        {node.node_type === "handoff" && (
                          <div>
                            <label className="block text-[10px] text-gray-500 font-bold uppercase mb-1">Transfer Notice Message</label>
                            <input
                              type="text"
                              value={node.config.note || ""}
                              onChange={(e) => updateNodeConfig(idx, { note: e.target.value })}
                              placeholder="Connecting you to our support specialist now. Please stay online."
                              className="w-full p-2 border rounded-lg text-xs bg-gray-50"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>{saving ? "Saving Flow..." : editingFlow ? "Update Flow Pipeline" : "Create Flow"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: WhatsApp Interactive Phone Simulator ── */}
      {showSimulator && simFlow && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3" onClick={() => setShowSimulator(false)}>
          <div className="bg-slate-950 rounded-3xl w-full max-w-3xl h-[620px] grid grid-cols-1 md:grid-cols-12 shadow-2xl border-4 border-slate-800 overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Phone Screen Left Column (7 Cols) */}
            <div className="md:col-span-7 flex flex-col h-full border-r border-slate-800 bg-[#0B141A]">
              {/* WhatsApp Screen Header */}
              <div className="bg-[#202C33] px-4 py-3 flex items-center justify-between text-white border-b border-slate-700/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xs shadow-sm">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-100 truncate max-w-[170px]">{simFlow.name}</h3>
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Interactive Live Simulator
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenSimulator(simFlow)}
                  className="px-2.5 py-1 bg-slate-700/80 hover:bg-slate-600 text-slate-200 text-[10px] font-bold rounded-lg transition"
                >
                  Reset
                </button>
              </div>

              {/* Real-world trigger check — does this message actually start the bot? */}
              {simTrigger && (
                <div
                  className={`px-3.5 py-2 text-[10px] leading-relaxed border-b ${
                    simTrigger.matched
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  }`}
                >
                  {simTrigger.matched ? (
                    <>
                      <span className="font-bold">✓ Auto-starts on WhatsApp.</span>{" "}
                      {simTrigger.type === "keyword"
                        ? <>“{simTrigger.input}” matches this bot's trigger words.</>
                        : <>This bot runs on <span className="font-bold">{simTrigger.type}</span> — no keyword needed.</>}
                    </>
                  ) : (
                    <>
                      <span className="font-bold">⚠ Would NOT auto-start.</span>{" "}
                      “{simTrigger.input}” does not match this bot's trigger words — the preview below is forced.
                    </>
                  )}
                  {simTrigger.type === "keyword" && simTrigger.keywords.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {simTrigger.keywords.map((k) => (
                        <span key={k} className="px-1.5 py-0.5 bg-slate-800/80 border border-slate-600 rounded text-slate-300 font-mono">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  {simTrigger.type === "keyword" && simTrigger.keywords.length === 0 && (
                    <div className="mt-1 font-bold">No trigger words set — this bot can never start itself.</div>
                  )}
                </div>
              )}

              {/* Chat Message Stream */}
              <div ref={simScrollRef} className="flex-1 p-4 overflow-y-auto space-y-3.5">
                {simMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* User Text Bubble */}
                    {msg.sender === "user" && (
                      <div className="max-w-[85%] rounded-2xl rounded-tr-none px-3.5 py-2 text-xs leading-relaxed bg-[#005C4B] text-white shadow-sm">
                        {msg.text}
                      </div>
                    )}

                    {/* Bot Message Bubble */}
                    {msg.sender === "bot" && (
                      <div className="max-w-[88%] space-y-2">
                        {/* Media / Document / Image Attachment */}
                        {msg.type === "media" && (
                          <div className="bg-[#202C33] rounded-2xl rounded-tl-none p-2 border border-emerald-500/20 shadow-sm">
                            {msg.media_type === "image" && msg.media_url ? (
                              <img
                                src={msg.media_url}
                                alt={msg.filename || "attachment"}
                                className="rounded-xl max-h-44 w-full object-cover bg-slate-800"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            ) : (
                              <div className="flex items-center gap-2 px-2 py-2.5 bg-[#111B21] rounded-xl border border-slate-700">
                                <span className="text-lg">
                                  {msg.media_type === "video" ? "🎥" : msg.media_type === "audio" ? "🎵" : "📄"}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-bold text-gray-100 truncate">{msg.filename || "attachment"}</div>
                                  <div className="text-[9px] text-gray-400 uppercase">{msg.media_type || "document"}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Text / Caption */}
                        {(msg.text || msg.caption) && (
                          <div className="bg-[#202C33] text-gray-100 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs leading-relaxed border border-emerald-500/20 shadow-sm whitespace-pre-line">
                            {msg.text || msg.caption}
                            {msg.footer && <div className="text-[10px] text-gray-400 mt-1 italic border-t border-slate-700/50 pt-1">{msg.footer}</div>}
                          </div>
                        )}

                        {/* Interactive Clickable Buttons */}
                        {msg.type === "buttons" && Array.isArray(msg.buttons) && (
                          <div className="space-y-1.5">
                            {msg.buttons.map((b, bIdx) => (
                              <button
                                key={bIdx}
                                type="button"
                                onClick={() => handleSendSimInput(b.title)}
                                className="w-full py-2 px-3 bg-[#2A3942] hover:bg-[#202C33] text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition text-center border border-emerald-500/30 shadow-sm flex items-center justify-center gap-1.5 active:scale-[0.98]"
                              >
                                <span>🔘</span>
                                <span>{b.title}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Interactive Clickable List Rows */}
                        {msg.type === "list" && Array.isArray(msg.rows) && (
                          <div className="space-y-1.5 bg-[#111B21] p-2.5 rounded-2xl border border-slate-700">
                            <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">{msg.title || "Options"}</div>
                            {msg.rows.map((r, rIdx) => (
                              <button
                                key={rIdx}
                                type="button"
                                onClick={() => handleSendSimInput(r.title)}
                                className="w-full text-left p-2 bg-[#202C33] hover:bg-[#2A3942] rounded-xl text-xs text-gray-200 transition border border-slate-700 active:scale-[0.98]"
                              >
                                <div className="font-bold text-emerald-400">{r.title}</div>
                                {r.description && <div className="text-[10px] text-gray-400">{r.description}</div>}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Fallback option parser if text contains numbered lines */}
                        {msg.type !== "buttons" && msg.type !== "list" && (() => {
                          const lines = (msg.text || "").split("\n");
                          const options = [];
                          for (const line of lines) {
                            const match = line.trim().match(/^(?:\*|•|-)?\s*(?:\d+[\s.)-]+)\s*\*?(.*?)\*?$/);
                            if (match && match[1]) {
                              const clean = match[1].trim().replace(/\*+/g, "");
                              if (clean.length >= 2 && !clean.toLowerCase().startsWith("reply with") && !clean.toLowerCase().startsWith("or reply")) {
                                options.push(clean);
                              }
                            }
                          }
                          if (options.length < 2 || options.length > 8) return null;
                          return (
                            <div className="space-y-1 pt-1">
                              {options.map((opt, optIdx) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleSendSimInput(opt)}
                                  className="w-full py-1.5 px-2.5 bg-[#2A3942]/90 hover:bg-[#202C33] text-emerald-300 hover:text-emerald-200 rounded-xl text-xs font-semibold transition text-left border border-emerald-500/20 shadow-sm flex items-center gap-1.5"
                                >
                                  <span>👉</span>
                                  <span>{opt}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* System / Info Notice */}
                    {msg.sender === "system" && (
                      <div className="w-full text-center text-[10px] italic text-slate-400 py-1">
                        {msg.text}
                      </div>
                    )}
                  </div>
                ))}

                {simLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 bg-[#202C33] p-2.5 rounded-xl max-w-[130px] border border-slate-700">
                    <Loader2 size={13} className="animate-spin text-emerald-400" />
                    <span>Bot typing...</span>
                  </div>
                )}

                {simEnded && (
                  <div className="text-center py-2 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-[11px] text-emerald-400 font-bold">
                    🏁 Flow execution completed. Reply "menu" to restart.
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={(e) => { e.preventDefault(); handleSendSimInput(simInput); }} className="p-3 bg-[#202C33] flex items-center gap-2 border-t border-slate-700/80 shrink-0">
                <input
                  type="text"
                  value={simInput}
                  onChange={(e) => setSimInput(e.target.value)}
                  placeholder="Type message, number (1, 2) or 'menu'..."
                  className="flex-1 px-3.5 py-2.5 bg-[#2A3942] text-white rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#25D366] placeholder:text-gray-500"
                />
                <button
                  type="submit"
                  disabled={!simInput.trim() || simLoading}
                  className="p-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5d] disabled:opacity-40 transition"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>

            {/* Inspector Right Column (5 Cols) */}
            <div className="hidden md:flex md:col-span-5 bg-slate-950 p-5 flex-col justify-between text-slate-300 text-xs overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={14} className="text-[#25D366]" />
                    <span>Live State Inspector</span>
                  </span>
                  <button onClick={() => setShowSimulator(false)} className="text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>

                {/* Quick Shortcuts */}
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Inputs</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {["hi", "menu", "1", "2", "3", "agent", "invoice", "amc", "quote"].map((shortcut) => (
                      <button
                        key={shortcut}
                        type="button"
                        onClick={() => handleSendSimInput(shortcut)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-xs font-mono font-bold transition"
                      >
                        "{shortcut}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Variables Box */}
                <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
                    <Database size={11} />
                    <span>Flow Context Variables ({Object.keys(simVars).length})</span>
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {Object.entries(simVars).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-slate-800/60 pb-0.5">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-emerald-300 font-bold truncate max-w-[130px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Execution Logs */}
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-[10px] font-mono space-y-1 text-slate-400 max-h-32 overflow-y-auto">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Step Audit Logs</span>
                  {simLogs.map((l, i) => (
                    <div key={i} className="truncate">▶ {l}</div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 text-center border-t border-slate-800 pt-2.5">
                ACHME State Machine Simulator
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Trigger on Phone ── */}
      {showTriggerModal && triggerFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTriggerModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <PhoneCall size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Start Flow for Phone</h3>
                  <p className="text-xs text-gray-500">{triggerFlow.name}</p>
                </div>
              </div>
              <button onClick={() => setShowTriggerModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target 10-Digit Mobile Number</label>
                <input
                  type="text"
                  value={targetPhone}
                  onChange={e => setTargetPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono outline-none focus:ring-2 focus:ring-[#25D366]"
                />
                <p className="text-[11px] text-gray-400 mt-1">The bot will start the welcome step and listen for customer replies.</p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTriggerModal(false)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTrigger}
                  disabled={!targetPhone.trim() || triggering}
                  className="flex-1 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md shadow-[#25D366]/20"
                >
                  {triggering ? "Starting Flow..." : "Launch on WhatsApp"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Analytics & Funnel ── */}
      {showAnalyticsModal && analyticsFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAnalyticsModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <BarChart2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Flow Performance Funnel</h3>
                  <p className="text-xs text-gray-500">{analyticsFlow.name}</p>
                </div>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {analyticsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-[#25D366]" />
              </div>
            ) : analyticsData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                    <span className="text-lg font-bold text-blue-800">{analyticsData.totalRuns}</span>
                    <p className="text-[10px] text-blue-600 font-semibold uppercase">Total Runs</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-lg font-bold text-emerald-800">{analyticsData.completedRuns}</span>
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">Completed</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                    <span className="text-lg font-bold text-purple-800">{analyticsData.handoffRuns}</span>
                    <p className="text-[10px] text-purple-600 font-semibold uppercase">Live Handoffs</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-2xl border">
                  <h4 className="text-xs font-bold text-gray-700 uppercase mb-2">Step Drop-off & Hit Frequency</h4>
                  {analyticsData.nodeDropoffs && analyticsData.nodeDropoffs.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsData.nodeDropoffs.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="font-mono text-gray-700">{d.node_key}</span>
                          <span className="font-bold text-emerald-600">{d.hit_count} hits</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">No node drop-offs recorded yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
