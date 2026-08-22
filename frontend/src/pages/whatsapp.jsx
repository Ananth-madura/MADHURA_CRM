import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  MessageCircle,
  MessageSquare,
  LogOut,
  RefreshCw,
  Send,
  Loader2,
  Smartphone,
  ChevronLeft,
  Plus,
  UserPlus,
  X,
  FileText,
  Paperclip,
  MapPin,
  Navigation,
  CreditCard,
  Search,
  Info,
  PhoneCall,
  Pin,
  VolumeX,
  Sparkles,
  Image,
  Music,
  Zap,
  BarChart3,
  ListOrdered,
  SendHorizontal,
  CheckCircle2,
  Database,
  Key,
  Globe,
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import socket from "../socket/socket";
import RichMessageContent from "../components/RichMessageContent";
import WAConfigPrompt from "../components/WAConfigPrompt";
import WAContactAvatar from "../components/WAContactAvatar";

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "numeric" });
}

function isFilename(str) {
  if (!str || typeof str !== "string") return false;
  return /\.(md|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar|7z|tar|gz|json|png|jpg|jpeg|webp|gif|mp4|mov|mp3|ogg|wav)$/i.test(str.trim());
}

// Mirrors the backend's describeLastMessage() — a live-pushed media/location
// message has no body text, so give the sidebar preview a label instead of
// leaving it blank (which read as "no messages yet").
function previewText(message) {
  if (message.body) return message.body;
  if (message.location) return "📍 Location";
  if (message.hasMedia) return "📎 Attachment";
  return "";
}

function MediaBubble({ chatId, messageId, filename = "", mediaUrl = null, mimetype = null, isMe = false, onPreview = null }) {
  const [media, setMedia] = useState(mediaUrl ? { url: mediaUrl, filename, mimetype } : null);
  const [loading, setLoading] = useState(!mediaUrl);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (mediaUrl) return;
    if (!chatId || !messageId) return;
    setLoading(true);
    setError(false);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/media/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data && (data.url || data.data)) {
        setMedia(data);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [chatId, messageId, mediaUrl]);

  useEffect(() => {
    if (mediaUrl) {
      setMedia({ url: mediaUrl, filename, mimetype });
      setLoading(false);
    } else {
      load();
    }
  }, [load, mediaUrl, filename, mimetype]);

  const rawFilename = filename || media?.filename || `Document_${messageId}`;
  const fileExt = (rawFilename.match(/\.([a-zA-Z0-9]+)$/) || [])[1]?.toLowerCase() ||
    (media?.mimetype ? media.mimetype.split("/")[1]?.split(";")[0]?.toLowerCase() : "file");

  const getBadgeStyle = (ext) => {
    switch (ext) {
      case "pdf": return "bg-red-500/20 text-red-400 border-red-500/40";
      case "doc":
      case "docx": return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "xls":
      case "xlsx":
      case "csv": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "ppt":
      case "pptx": return "bg-orange-500/20 text-orange-400 border-orange-500/40";
      case "md":
      case "txt":
      case "json": return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "zip":
      case "rar":
      case "7z": return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "png":
      case "jpg":
      case "jpeg":
      case "webp": return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      default: return "bg-[#00a884]/20 text-[#00a884] border-[#00a884]/40";
    }
  };

  const src = media?.url
    ? (media.url.startsWith("http") || media.url.startsWith("blob:") ? media.url : `${API}${media.url}`)
    : (media?.data ? `data:${media.mimetype || "application/octet-stream"};base64,${media.data}` : null);

  if (media && src) {
    if (media.mimetype?.startsWith("audio/") || media.mimetype?.includes("ogg") || ["mp3", "ogg", "wav", "m4a", "aac"].includes(fileExt)) {
      return (
        <div className="py-1 space-y-1">
          <audio src={src} controls className="max-w-[270px] h-9 rounded-lg" />
          <div className="flex items-center justify-between text-[11px] font-bold text-[#00a884] px-1">
            <span className="text-slate-300 text-[10px] font-mono truncate max-w-[160px]">{rawFilename}</span>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
    if (media.mimetype?.startsWith("video/") || ["mp4", "mov", "webm", "3gp", "mkv"].includes(fileExt)) {
      return (
        <div className="space-y-1.5">
          <video src={src} controls className="max-w-[290px] max-h-[340px] rounded-xl shadow-md border border-white/10" />
          <div className="flex items-center justify-between text-[11px] font-bold text-[#00a884] px-1">
            <span className="text-slate-300 text-[10px] font-mono truncate max-w-[180px]">{rawFilename}</span>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
    if (media.mimetype?.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(fileExt)) {
      const handleView = () => (onPreview ? onPreview(src, rawFilename) : window.open(src, "_blank"));
      return (
        <div className="space-y-1.5">
          <img
            src={src}
            alt={rawFilename}
            className="max-w-[320px] max-h-[360px] object-cover rounded-xl shadow-md cursor-pointer hover:opacity-95 transition border border-white/10"
            onClick={handleView}
          />
          <div className="flex items-center justify-between text-xs font-bold text-[#00a884] pt-1 px-1">
            <button onClick={handleView} className="hover:underline flex items-center gap-1">
              🔍 Preview
            </button>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
              Download ⬇️
            </a>
          </div>
        </div>
      );
    }
  }

  // Document attachment card (PDF, Excel .xlsx/.csv, Word doc, PowerPoint, Zip, etc.)
  return (
    <div className={`rounded-xl p-3 border space-y-2.5 min-w-[240px] max-w-[330px] ${isMe ? "bg-[#025142] border-emerald-800/40 text-white" : "bg-[#111b21] border-slate-700/50 text-white"}`}>
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 border ${getBadgeStyle(fileExt)}`}>
          {fileExt.slice(0, 4)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate" title={rawFilename}>{rawFilename}</p>
          <p className="text-[10px] text-slate-300 font-mono mt-0.5 uppercase">{fileExt} Attachment</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs font-bold text-[#00a884]">
        {src ? (
          <>
            <button onClick={() => window.open(src, "_blank")} className="hover:underline flex items-center gap-1">
              Open ↗
            </button>
            <a href={src} download={rawFilename} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
              Download ⬇️
            </a>
          </>
        ) : (
          <>
            <button onClick={load} disabled={loading} className="hover:underline flex items-center gap-1">
              {loading ? "Loading..." : "Open ↗"}
            </button>
            <button onClick={load} disabled={loading} className="hover:underline flex items-center gap-1">
              {loading ? "Loading..." : "Download ⬇️"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState({ connected: false, initializing: false, hasQr: false });
  const [qrCode, setQrCode] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState("");
  const [newChatName, setNewChatName] = useState("");
  const [newChatMessage, setNewChatMessage] = useState("");
  const [newChatLoading, setNewChatLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [mediaSending, setMediaSending] = useState(false);
  const [locationSending, setLocationSending] = useState(false);
  const [accountDetails, setAccountDetails] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Performance & On-Demand Balance States
  const [msgLimit, setMsgLimit] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAccountBalanceModal, setShowAccountBalanceModal] = useState(false);
  const [accountBalance, setAccountBalance] = useState(null);
  const [accountBalanceLoading, setAccountBalanceLoading] = useState(false);

  // Lightbox Modal, Contact Info Drawer, Sidebar Filters
  const [sidebarTab, setSidebarTab] = useState("all"); // 'all', 'unread', 'favourites', 'groups'
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showContactInfoDrawer, setShowContactInfoDrawer] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Quick Tools & Actions state
  const navigate = useNavigate();
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [flows, setFlows] = useState([]);
  const [flowsLoading, setFlowsLoading] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [triggeringFlow, setTriggeringFlow] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsMenuTitle, setOptionsMenuTitle] = useState("How can we assist you today?");
  const [optionsMenuItems, setOptionsMenuItems] = useState([
    "💼 Inquire About Services & Solutions",
    "🧾 Check Invoice & Payment Status",
    "🛠️ Request AMC Service / Maintenance",
    "📞 Connect with a Support Executive",
  ]);

  // Quote reply, Quick replies, CRM sidebar details
  const [replyingTo, setReplyingTo] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [crmDetails, setCrmDetails] = useState(null);
  const [crmDetailsLoading, setCrmDetailsLoading] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);

  // Team Inbox, Notes & Ticket Status
  const [teamMembers, setTeamMembers] = useState([]);
  const [ticketStatus, setTicketStatus] = useState("open");
  const [assignedAgentName, setAssignedAgentName] = useState("");
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [internalNotes, setInternalNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // WhatsApp Native Payments State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("Service & Solution Payment");
  const [creatingPayment, setCreatingPayment] = useState(false);

  // Drip Campaigns State
  const [showDripModal, setShowDripModal] = useState(false);
  const [dripSequences, setDripSequences] = useState([]);
  const [dripLoading, setDripLoading] = useState(false);
  const [selectedDripId, setSelectedDripId] = useState("");
  const [enrollingDrip, setEnrollingDrip] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  const selectedChatRef = useRef(selectedChat);
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/unified-status`, { headers, timeout: 10000 });
      } catch (e1) {
        try {
          res = await axios.get(`/api/whatsapp/unified-status`, { headers, timeout: 10000 });
        } catch (e2) {
          res = await axios.get(`${API}/api/whatsapp/status`, { headers, timeout: 10000 });
        }
      }
      const raw = res.data;
      const isCloud = Boolean(raw.cloud?.configured || raw.isCloud);
      const isWeb = Boolean(raw.web?.connected || raw.isWeb);
      const isConnected = Boolean(raw.connected || isCloud || isWeb);
      const activePhone = raw.phone || raw.web?.phone || raw.cloud?.display_phone_number || raw.cloud?.phoneNumberId || null;
      const serverQr = raw.qr || raw.web?.qr || null;

      const flat = {
        connected: isConnected,
        isCloud,
        isWeb,
        phone: activePhone,
        activeEngine: raw.activeEngine || (isCloud && isWeb ? "Dual (Cloud API + Web)" : isCloud ? "Meta Cloud API" : isWeb ? "WhatsApp Web" : "Disconnected"),
        initializing: raw.web?.initializing || false,
        hasQr: Boolean(raw.web?.hasQr || serverQr),
        cloud: raw.cloud || null,
        web: raw.web || null,
      };

      setStatus(flat);
      if (flat.connected) {
        setQrCode(null);
        setQrLoading(false);
      } else if (serverQr) {
        setQrCode(serverQr);
        setQrLoading(false);
        setError(null);
      }
      return flat;
    } catch {
      return null;
    }
  }, []);

  const fetchQr = useCallback(async (force = false) => {
    setQrLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = force ? "/api/whatsapp/qr?force=true" : "/api/whatsapp/qr";
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers, timeout: 20000 });
      } catch (e1) {
        res = await axios.get(endpoint, { headers, timeout: 20000 });
      }
      if (res.data && res.data.qr) {
        setQrCode(res.data.qr);
        setStatus((s) => ({ ...s, hasQr: true }));
        setQrLoading(false);
      } else if (res.data && res.data.initializing) {
        // Still initializing in background — keep spinner, websocket and status polling will pick it up
        setQrLoading(true);
      } else if (res.data && res.data.error) {
        setError(res.data.error);
        setQrLoading(false);
      } else {
        // Connected or completed without QR
        fetchStatus();
        setQrLoading(false);
      }
    } catch (err) {
      if (err.response?.status === 504 || err.code === "ECONNABORTED") {
        console.warn("ℹ️ WhatsApp QR generation in progress in background...");
        // Keep loading state alive for WebSocket wa_qr or status polling
        setQrLoading(true);
      } else {
        const msg = err.response?.data?.error || err.message || "Failed to generate QR code. Please click Fresh QR / Reset.";
        setError(msg);
        setQrLoading(false);
      }
    }
  }, [fetchStatus]);

  const fetchChats = useCallback(async (refresh = false) => {
    setChatsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = refresh ? `/api/whatsapp/chats?refresh=true` : `/api/whatsapp/chats`;
      let res;
      try {
        res = await axios.get(`${API}${endpoint}`, { headers });
      } catch (e1) {
        res = await axios.get(endpoint, { headers });
      }
      setChats(res.data || []);
    } catch { }
    setChatsLoading(false);
  }, []);

  const fetchAccountDetails = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/whatsapp/account`, { headers });
      setAccountDetails(data);
    } catch (_) { }
  }, []);

  const handleSyncWhatsApp = async () => {
    setSyncing(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers }).catch(() => { });
      await axios.post(`${API}/api/whatsapp/sync-chats`, {}, { headers }).catch(() => { });
      await fetchChats(true);
      await fetchAccountDetails();
    } catch (_) { }
    setSyncing(false);
  };

  const fetchMessages = useCallback(async (chatId, limit = 10) => {
    if (limit === 10) setMessagesLoading(true);
    else setLoadingMore(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/messages?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data || []);
      if (limit === 10) scrollToBottom();
    } catch { }
    setMessagesLoading(false);
    setLoadingMore(false);
  }, []);

  const handleLoadMoreMessages = async () => {
    if (!selectedChat || loadingMore) return;
    const nextLimit = msgLimit + 40;
    setMsgLimit(nextLimit);
    await fetchMessages(selectedChat.id, nextLimit);
  };

  const fetchAccountBalance = async () => {
    setAccountBalanceLoading(true);
    setShowAccountBalanceModal(true);
    setAccountBalance(null);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/whatsapp/account-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccountBalance(data);
    } catch (_) {
      setAccountBalance({ error: "Failed to fetch WhatsApp account stats" });
    }
    setAccountBalanceLoading(false);
  };

  const fetchTemplates = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/templates`, { headers: { Authorization: `Bearer ${token}` } });
      setTemplates(data || []);
    } catch { }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTmplName, setNewTmplName] = useState("");
  const [newTmplCategory, setNewTmplCategory] = useState("MARKETING");
  const [newTmplBody, setNewTmplBody] = useState("");
  const [tmplLoading, setTmplLoading] = useState(false);

  const handleSeedTemplates = async () => {
    setTmplLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/api/wa/templates/seed`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (data.templates) setTemplates(data.templates);
      else fetchTemplates();
    } catch (e) {
      alert("Failed to seed default templates: " + (e.response?.data?.error || e.message));
    }
    setTmplLoading(false);
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTmplName.trim() || !newTmplBody.trim()) return;
    setTmplLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API}/api/wa/templates`,
        { name: newTmplName.trim(), category: newTmplCategory, body: newTmplBody.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTemplates((prev) => [data, ...prev]);
      insertTemplate(data);
      setShowCreateTemplateModal(false);
      setNewTmplName("");
      setNewTmplBody("");
    } catch (e) {
      alert("Failed to create template: " + (e.response?.data?.error || e.message));
    }
    setTmplLoading(false);
  };

  const insertTemplate = (tmpl) => {
    const name = selectedChat?.name && !selectedChat.name.startsWith("+") ? selectedChat.name : "there";
    const filled = (tmpl.body || "").replace(/\{name\}|\{\{1\}\}/gi, name);
    setMessageInput(filled);
    setShowTemplatePicker(false);
  };

  const handleSelectChat = async (chat) => {
    setSelectedChat(chat);
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)));
    setShowMobileChat(true);
    setMsgLimit(10);

    // Mark as read on WhatsApp server & DB
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      axios.post(`${API}/api/whatsapp/chat/${encodeURIComponent(chat.id)}/read`, {}, { headers }).catch(() => {});
    } catch (_) {}

    await fetchMessages(chat.id, 10);
  };

  const handleSend = async () => {
    if (!messageInput.trim() || !selectedChat) return;
    const textToSend = messageInput.trim();
    setMessageInput("");
    setError(null);

    // Instant Optimistic UI update: push message immediately to chat thread
    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      from: "me",
      body: textToSend,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      status: "sending",
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setTimeout(scrollToBottom, 50);

    // Immediately update sidebar chat position and preview
    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedChat.id);
      if (idx !== -1) {
        const current = prev[idx];
        const updated = {
          ...current,
          hasMessages: true,
          lastMessage: { body: textToSend, timestamp: Math.floor(Date.now() / 1000), fromMe: true },
          timestamp: Math.floor(Date.now() / 1000),
          unreadCount: 0,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return prev;
    });

    const quotedId = replyingTo?.id || null;
    const quotedText = replyingTo?.body || null;
    setReplyingTo(null);

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: textToSend,
          quotedMessageId: quotedId,
          replyToMessageId: quotedId,
        }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: textToSend,
          quotedMessageId: quotedId,
          replyToMessageId: quotedId,
        }, { headers });
      }

      // Mark message as delivered/sent in thread
      const realId = res.data?.id || res.data?.result?.id || tempId;
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: realId, status: "sent", quotedMsg: quotedText ? { body: quotedText } : null } : m));
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to send message";
      setError(`Failed to send message: ${msg}`);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
    }
  };

  const handleReact = async (messageId, emoji) => {
    if (!selectedChat || !messageId) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/react`, {
        chatId: selectedChat.id,
        messageId,
        emoji,
      }, { headers });

      // Optimistically update reactions on message
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === messageId) {
            const existingReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
            const foundIdx = existingReactions.findIndex((r) => r.isMe || r.emoji === emoji);
            if (foundIdx >= 0) {
              existingReactions[foundIdx] = { emoji, isMe: true };
            } else {
              existingReactions.push({ emoji, isMe: true });
            }
            return { ...m, reactions: existingReactions };
          }
          return m;
        })
      );
    } catch (err) {
      console.warn("Reaction failed:", err.message);
    }
  };

  const fetchContactCrmDetails = async (phone) => {
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    setCrmDetailsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/contact-crm-details/${cleanPhone}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCrmDetails(res.data);
    } catch (err) {
      console.warn("Failed to fetch CRM details:", err.message);
      setCrmDetails(null);
    }
    setCrmDetailsLoading(false);
  };

  const fetchQuickReplies = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/whatsapp/quick-replies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuickReplies(res.data || []);
    } catch (_) { }
  };

  const extractQuickReplies = (msg) => {
    if (!msg) return [];
    // 1. From interactive payload
    if (msg.interactive?.buttons && Array.isArray(msg.interactive.buttons)) {
      return msg.interactive.buttons.map((b) => b.title || b.text || b.id).filter(Boolean);
    }
    if (msg.interactive?.rows && Array.isArray(msg.interactive.rows)) {
      return msg.interactive.rows.map((r) => r.title || r.id).filter(Boolean);
    }
    if (msg.interactive_payload) {
      try {
        const payload = typeof msg.interactive_payload === "string" ? JSON.parse(msg.interactive_payload) : msg.interactive_payload;
        if (payload.buttons && Array.isArray(payload.buttons)) return payload.buttons.map((b) => b.title || b.text || b.id).filter(Boolean);
        if (payload.rows && Array.isArray(payload.rows)) return payload.rows.map((r) => r.title || r.id).filter(Boolean);
      } catch (_) {}
    }
    // 2. Parse numbered / bullet options from message body text:
    const body = msg.body || "";
    if (body.includes("\n")) {
      const lines = body.split("\n");
      const options = [];
      for (const line of lines) {
        const trimmed = line.trim();
        const match = trimmed.match(/^(?:\*|•|-)?\s*(?:\d+[\s.)-]+)\s*\*?(.*?)\*?$/);
        if (match && match[1]) {
          const clean = match[1].trim().replace(/\*+/g, "");
          if (clean.length >= 2 && !clean.toLowerCase().startsWith("reply with") && !clean.toLowerCase().startsWith("or reply")) {
            options.push(clean);
          }
        }
      }
      if (options.length >= 2 && options.length <= 8) {
        return options;
      }
    }
    return [];
  };

  const handleSendDirect = async (textToSend) => {
    if (!textToSend || !selectedChat) return;
    const cleanText = String(textToSend).trim();
    if (!cleanText) return;

    setError(null);
    const tempId = "temp_" + Date.now();
    const tempMsg = {
      id: tempId,
      from: "me",
      body: cleanText,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      status: "sending",
    };
    setMessages((prev) => [tempMsg, ...prev]);
    setTimeout(scrollToBottom, 50);

    setChats((prev) => {
      const idx = prev.findIndex((c) => c.id === selectedChat.id);
      if (idx !== -1) {
        const current = prev[idx];
        const updated = {
          ...current,
          hasMessages: true,
          lastMessage: { body: cleanText, timestamp: Math.floor(Date.now() / 1000), fromMe: true },
          timestamp: Math.floor(Date.now() / 1000),
          unreadCount: 0,
        };
        return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      return prev;
    });

    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.post(`${API}/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: cleanText,
        }, { headers });
      } catch (e1) {
        res = await axios.post(`/api/whatsapp/send`, {
          chatId: selectedChat.id,
          message: cleanText,
        }, { headers });
      }

      const realId = res.data?.id || res.data?.result?.id || tempId;
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: realId, status: "sent" } : m));
    } catch (err) {
      console.warn("handleSendDirect error:", err.message);
    }
  };

  const handleTriggerFlowForChat = async (flowId) => {
    if (!selectedChat || !flowId) return;
    const cleanPhone = selectedChat.id.replace(/\D/g, "");
    setTriggeringFlow(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(`${API}/api/wa/flows/${flowId}/trigger-phone`, {
        phone: cleanPhone
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(res.data?.message || "Flow started successfully for this contact!");
      setShowFlowModal(false);
      await fetchMessages(selectedChat.id, 15);
    } catch (err) {
      alert("Failed to start flow: " + (err.response?.data?.error || err.message));
    }
    setTriggeringFlow(false);
  };

  const fetchFlows = useCallback(async () => {
    try {
      setFlowsLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/flows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFlows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Could not load flows:", e.message);
    } finally {
      setFlowsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickReplies();
    fetchFlows();
  }, [fetchFlows]);

  const handleAttachMedia = async (e, customMediaType = "document") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedChat) return;
    setMediaSending(true);
    setShowAttachMenu(false);
    setError(null);

    const tempId = "temp_" + Date.now();
    let localBlobUrl = "";
    try {
      localBlobUrl = URL.createObjectURL(file);
    } catch (_) {}

    const optimisticMsg = {
      id: tempId,
      from: "me",
      body: file.name,
      timestamp: Math.floor(Date.now() / 1000),
      isMe: true,
      hasMedia: true,
      mediaUrl: localBlobUrl,
      type: customMediaType || "document",
      filename: file.name,
      status: "sending",
    };
    setMessages((prev) => [optimisticMsg, ...prev]);
    scrollToBottom();

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const formData = new FormData();
      formData.append("file", file);
      
      let uploaded = null;
      try {
        const resUp = await axios.post(`${API}/api/whatsapp/upload-media`, formData, { headers });
        uploaded = resUp.data;
      } catch (_) {
        const resFallback = await axios.post(`${API}/api/wa/campaigns/upload-media`, formData, { headers });
        uploaded = resFallback.data;
      }

      const mediaType = uploaded.media_type || customMediaType || "document";
      const res = await axios.post(`${API}/api/whatsapp/send-media`, {
        chatId: selectedChat.id,
        mediaUrl: uploaded.url,
        mediaType,
        filename: uploaded.filename || file.name,
      }, { headers });
      const realId = res.data?.id || tempId;
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, id: realId, mediaUrl: uploaded.url, status: "sent" } : m)));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to send attachment");
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
    }
    setMediaSending(false);
  };

  const handleTriggerFlow = async (flowId) => {
    if (!selectedChat || !flowId) return;
    setTriggeringFlow(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const phone = selectedChat.id.replace(/\D/g, "");
      const res = await axios.post(`${API}/api/wa/flows/${flowId}/trigger-phone`, { phone }, { headers });
      setShowFlowModal(false);
      setShowAttachMenu(false);
      await fetchMessages(selectedChat.id);
    } catch (err) {
      alert("Failed to trigger flow: " + (err.response?.data?.error || err.message));
    } finally {
      setTriggeringFlow(false);
    }
  };

  const handleSendOptionsMenu = () => {
    if (!selectedChat || !optionsMenuTitle) return;
    const formatted = `📋 *${optionsMenuTitle}*\n\n${optionsMenuItems.filter(Boolean).map((opt, idx) => `${idx + 1}️⃣ ${opt}`).join("\n")}\n\n_👉 Reply with a number (1-${optionsMenuItems.filter(Boolean).length}) to choose an option._`;
    setMessageInput(formatted);
    setShowOptionsModal(false);
    setShowAttachMenu(false);
  };

  const fetchTeamMembers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API}/api/teammember`, { headers });
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch {
      setTeamMembers([]);
    }
  }, []);

  const handleAssignAgent = async (agentId, agentName) => {
    if (!selectedChat) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/chat/${selectedChat.id}/assign`, { agentId, agentName }, { headers });
      setAssignedAgentName(agentName);
    } catch (err) {
      alert("Failed to assign agent: " + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateTicketStatus = async (status) => {
    if (!selectedChat) return;
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/api/whatsapp/chat/${selectedChat.id}/ticket-status`, { status }, { headers });
      setTicketStatus(status);
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    }
  };

  const fetchInternalNotes = async (phone) => {
    if (!phone) return;
    setNotesLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = phone.replace(/\D/g, "");
      const { data } = await axios.get(`${API}/api/whatsapp/chat/${cleanPhone}/notes`, { headers });
      setInternalNotes(Array.isArray(data) ? data : []);
    } catch {
      setInternalNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleCreateInternalNote = async (e) => {
    e?.preventDefault();
    if (!selectedChat || !newNoteText.trim()) return;
    setSubmittingNote(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/whatsapp/chat/${cleanPhone}/notes`,
        { note: newNoteText, authorName: localStorage.getItem("userName") || "Agent" },
        { headers }
      );
      setNewNoteText("");
      await fetchInternalNotes(cleanPhone);
    } catch (err) {
      alert("Failed to save note: " + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleCreatePaymentRequest = async (e) => {
    e?.preventDefault();
    if (!selectedChat || !paymentAmount || Number(paymentAmount) <= 0) return;
    setCreatingPayment(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/wa/payments/create-link`,
        {
          phone: cleanPhone,
          contact_name: selectedChat.name,
          amount: paymentAmount,
          description: paymentDesc,
          send_to_whatsapp: true,
        },
        { headers }
      );
      setShowPaymentModal(false);
      setPaymentAmount("");
      await fetchMessages(selectedChat.id);
    } catch (err) {
      alert("Failed to create payment link: " + (err.response?.data?.error || err.message));
    } finally {
      setCreatingPayment(false);
    }
  };

  const fetchDripSequences = async () => {
    setDripLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const { data } = await axios.get(`${API}/api/wa/drip`, { headers });
      setDripSequences(Array.isArray(data) ? data : []);
    } catch {
      setDripSequences([]);
    } finally {
      setDripLoading(false);
    }
  };

  const handleEnrollDrip = async (sequenceId) => {
    if (!selectedChat || !sequenceId) return;
    setEnrollingDrip(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const cleanPhone = selectedChat.id.replace(/\D/g, "");
      await axios.post(
        `${API}/api/wa/drip/${sequenceId}/enroll`,
        {
          phones: [cleanPhone],
          contact_names: { [cleanPhone]: selectedChat.name },
        },
        { headers }
      );
      setShowDripModal(false);
      alert(`Contact successfully enrolled in automated drip sequence!`);
    } catch (err) {
      alert("Failed to enroll: " + (err.response?.data?.error || err.message));
    } finally {
      setEnrollingDrip(false);
    }
  };

  const handleShareLocation = () => {
    if (!selectedChat) return;
    if (!navigator.geolocation) { setError("Geolocation is not supported by this browser"); return; }
    setLocationSending(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = localStorage.getItem("token");
          const headers = { Authorization: `Bearer ${token}` };
          await axios.post(`${API}/api/whatsapp/send-location`, {
            chatId: selectedChat.id, lat: pos.coords.latitude, lng: pos.coords.longitude,
          }, { headers });
          await fetchMessages(selectedChat.id);
        } catch (err) {
          setError(err.response?.data?.error || err.message || "Failed to share location");
        }
        setLocationSending(false);
      },
      (err) => { setError("Could not get location: " + err.message); setLocationSending(false); },
      { timeout: 10000 }
    );
  };

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    const cleanPhone = newChatPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      alert("Please enter a valid phone number (at least 10 digits)");
      return;
    }
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const chatId = `${formattedPhone}@c.us`;
    const contactName = newChatName.trim() || `+${formattedPhone}`;

    const newChatObj = {
      id: chatId,
      name: contactName,
      source: "Direct",
      unreadCount: 0,
      timestamp: Math.floor(Date.now() / 1000),
      lastMessage: newChatMessage.trim() ? { body: newChatMessage.trim(), timestamp: Math.floor(Date.now() / 1000) } : null,
    };

    setChats((prev) => {
      const exists = prev.find((c) => c.id === chatId);
      if (exists) return prev;
      return [newChatObj, ...prev];
    });

    setSelectedChat(newChatObj);
    setShowMobileChat(true);
    setError(null);

    if (newChatMessage.trim()) {
      setNewChatLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        let res;
        try {
          res = await axios.post(`${API}/api/whatsapp/send`, { chatId, message: newChatMessage.trim() }, { headers });
        } catch (e1) {
          res = await axios.post(`/api/whatsapp/send`, { chatId, message: newChatMessage.trim() }, { headers });
        }
        setNewChatMessage("");
      } catch (err) {
        alert("Chat created, but message failed to send: " + (err.response?.data?.error || err.message));
      }
      setNewChatLoading(false);
    }

    setShowNewChatModal(false);
    setNewChatPhone("");
    setNewChatName("");
    await fetchMessages(chatId);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API}/api/whatsapp/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch { }
    setStatus({ connected: false, initializing: false, hasQr: false });
    setQrCode(null);
    setChats([]);
    setSelectedChat(null);
    setMessages([]);
  };

  const handleRefresh = () => {
    if (status.connected) {
      fetchChats();
    } else {
      setQrCode(null);
      fetchQr(true);
    }
  };

  const [connectMode, setConnectMode] = useState("qr"); // 'qr', 'pairing', 'api'
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState(null);

  useEffect(() => {
    fetchStatus();
    // While the QR screen is up we're waiting on the user to scan, and there's
    // no socket event for "session became ready" — so poll fast until linked,
    // otherwise the page sits on the QR for up to 15s after a successful scan.
    // Once connected, drop back to a slow heartbeat (real-time message changes
    // arrive over the socket below; this just catches anything missed).
    const interval = setInterval(fetchStatus, status.connected ? 15000 : 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, status.connected]);

  // Auto-fetch QR code on mount if not connected and no QR yet
  useEffect(() => {
    if (!status.connected && !qrCode && !qrLoading && connectMode === "qr") {
      fetchQr();
    }
  }, [status.connected, qrCode, qrLoading, connectMode, fetchQr]);

  const handleRequestPairingCode = async (e) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setPairingLoading(true);
    setPairingError(null);
    setPairingCode(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let res;
      try {
        res = await axios.get(`${API}/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      } catch (e1) {
        res = await axios.get(`/api/whatsapp/pairing-code?phone=${encodeURIComponent(pairingPhone.trim())}`, { headers, timeout: 40000 });
      }
      if (res.data && res.data.code) {
        setPairingCode(res.data.code);
      } else {
        setPairingError(res.data?.error || "Failed to generate pairing code");
      }
    } catch (err) {
      setPairingError(err.response?.data?.error || err.message || "Failed to request pairing code");
    }
    setPairingLoading(false);
  };

  // Auto-fetch chats & account details immediately when connected
  useEffect(() => {
    if (status.connected) {
      fetchChats(true);
      fetchAccountDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected]);

  useEffect(() => {
    if (status.connected) {
      if (pollRef.current) clearInterval(pollRef.current);
      // Real-time updates arrive over the socket below — this is just a slow
      // fallback in case a socket event is missed.
      pollRef.current = setInterval(() => {
        fetchChats();
        if (selectedChat) fetchMessages(selectedChat.id);
      }, 20000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status.connected, fetchChats, fetchMessages, selectedChat]);

  // Real-time socket listener for instant WhatsApp updates. The server now
  // pushes the actual message payload instead of just a "something changed"
  // ping, so we apply it directly to state — no round-trip fetch needed to
  // see a message land, which is what made incoming/outgoing messages feel
  // laggy or missing before.
  useEffect(() => {
    const handleRealtimeUpdate = (data) => {
      const { chatId, message, phone } = data || {};
      if (!chatId && !phone) {
        fetchChats();
        if (selectedChatRef.current) fetchMessages(selectedChatRef.current.id);
        return;
      }

      const activeSelected = selectedChatRef.current;
      const targetChatId = chatId || (phone ? `${phone}@c.us` : "");
      const selClean = (activeSelected?.id || activeSelected?.phone || "").replace(/\D/g, "");
      const msgClean = (targetChatId || phone || "").replace(/\D/g, "");
      const sel10 = selClean.slice(-10);
      const msg10 = msgClean.slice(-10);
      const isCurrentChat = Boolean(sel10 && msg10 && sel10 === msg10);

      const msgObj = message || {
        id: data?.id || `ws_${Date.now()}`,
        body: data?.body || previewText(data || {}),
        timestamp: data?.timestamp || Math.floor(Date.now() / 1000),
        isMe: Boolean(data?.isMe),
      };

      if (isCurrentChat && msgObj) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msgObj.id || (m.serializedId && m.serializedId === msgObj.serializedId))) {
            return prev;
          }
          return [msgObj, ...prev];
        });
        setTimeout(scrollToBottom, 50);
      }

      setChats((prev) => {
        const cleanDigits = (targetChatId || phone || "").replace(/\D/g, "");
        const clean10Digits = cleanDigits.slice(-10);
        const idx = prev.findIndex((c) => {
          const cClean = (c.id || c.phone || "").replace(/\D/g, "");
          return c.id === targetChatId || cClean === cleanDigits || (clean10Digits && cClean.slice(-10) === clean10Digits);
        });

        const msgBody = previewText(msgObj) || msgObj.body || (msgObj.isMe ? "Sent message" : "Incoming message");
        const msgTime = msgObj.timestamp || Math.floor(Date.now() / 1000);

        if (idx !== -1) {
          const current = prev[idx];
          const updated = {
            ...current,
            hasMessages: true,
            lastMessage: { body: msgBody, timestamp: msgTime, fromMe: Boolean(msgObj.isMe) },
            timestamp: msgTime,
            unreadCount: msgObj.isMe || isCurrentChat ? 0 : (current.unreadCount || 0) + 1,
          };
          return [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        } else {
          const newChat = {
            id: targetChatId || `${cleanDigits}@c.us`,
            name: msgObj.fromName || `+${cleanDigits}`,
            phone: cleanDigits,
            hasMessages: true,
            lastMessage: { body: msgBody, timestamp: msgTime, fromMe: Boolean(msgObj.isMe) },
            timestamp: msgTime,
            unreadCount: msgObj.isMe || isCurrentChat ? 0 : 1,
          };
          return [newChat, ...prev];
        }
      });
    };

    const handleChatHistoryUpdated = (data) => {
      const { chatId } = data || {};
      const activeSelected = selectedChatRef.current;
      if (activeSelected && chatId) {
        const selClean = (activeSelected.id || "").replace(/\D/g, "").slice(-10);
        const eventClean = (chatId || "").replace(/\D/g, "").slice(-10);
        if (selClean === eventClean) {
          fetchMessages(activeSelected.id);
        }
      }
    };

    socket.on("wa_message_received", handleRealtimeUpdate);
    socket.on("wa_message_sent", handleRealtimeUpdate);
    socket.on("wa_message", handleRealtimeUpdate);
    socket.on("wa_chat_history_updated", handleChatHistoryUpdated);

    const handleHandoffAlert = (data) => {
      if (data?.phone) {
        fetchChats(true);
      }
    };
    socket.on("wa_agent_handoff", handleHandoffAlert);

    const handleWaReady = () => {
      fetchStatus();
      fetchAccountDetails();
      fetchChats(true);
    };
    const handleWaSynced = () => {
      fetchChats(true);
      fetchAccountDetails();
    };

    const handleWaQr = (data) => {
      const qrVal = data?.qr || (typeof data === "string" ? data : null);
      if (qrVal) {
        setQrCode(qrVal);
        setQrLoading(false);
        setError(null);
        setStatus((s) => ({ ...s, hasQr: true }));
      }
    };
    const handleWaDisconnected = () => {
      setStatus((s) => ({ ...s, connected: false, isWeb: false }));
      fetchStatus();
    };

    socket.on("wa_qr", handleWaQr);
    socket.on("wa_ready", handleWaReady);
    socket.on("wa_disconnected", handleWaDisconnected);
    socket.on("wa_contacts_synced", handleWaSynced);
    socket.on("wa_chats_synced", handleWaSynced);

    const handleChatReadEvent = (data) => {
      const { chatId, phone } = data || {};
      const clean10 = (phone || chatId || "").replace(/\D/g, "").slice(-10);
      if (clean10) {
        setChats((prev) =>
          prev.map((c) => {
            const c10 = (c.id || c.phone || "").replace(/\D/g, "").slice(-10);
            return c10 === clean10 ? { ...c, unreadCount: 0 } : c;
          })
        );
      }
    };
    socket.on("wa_chat_read", handleChatReadEvent);

    // Check if user was navigated here with a phone parameter from Contacts / Groups / Templates
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get("phone");
    if (phoneParam) {
      const clean = phoneParam.replace(/\D/g, "");
      const formatted = clean.length === 10 ? `91${clean}` : clean;
      const targetId = `${formatted}@c.us`;
      setSelectedChat({ id: targetId, name: `+${formatted}`, isGroup: false });
      setShowMobileChat(true);
      fetchMessages(targetId);
      fetchContactCrmDetails(clean);
    }

    return () => {
      socket.off("wa_message_received", handleRealtimeUpdate);
      socket.off("wa_message_sent", handleRealtimeUpdate);
      socket.off("wa_message", handleRealtimeUpdate);
      socket.off("wa_chat_history_updated", handleChatHistoryUpdated);
      socket.off("wa_agent_handoff", handleHandoffAlert);
      socket.off("wa_qr", handleWaQr);
      socket.off("wa_ready", handleWaReady);
      socket.off("wa_disconnected", handleWaDisconnected);
      socket.off("wa_contacts_synced", handleWaSynced);
      socket.off("wa_chats_synced", handleWaSynced);
      socket.off("wa_chat_read", handleChatReadEvent);
    };
  }, [fetchChats, fetchMessages, fetchStatus, fetchAccountDetails]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter chat categories for sidebar tabs & search (Always defined at top scope)
  const isGroupChat = (c) => Boolean(c.isGroup || (c.id && c.id.includes("@g.us")));
  const contactChatsList = (chats || []).filter((c) => !isGroupChat(c));
  const groupChatsList = (chats || []).filter((c) => isGroupChat(c));
  const unreadChatsList = (chats || []).filter((c) => (c.unreadCount || 0) > 0);
  const favChatsList = (chats || []).filter((c) => c.isPinned);

  let displayChats = [];
  const searchLower = (searchTerm || "").toLowerCase().trim();
  let baseList = contactChatsList;
  if (sidebarTab === "all") {
    baseList = contactChatsList;
  } else if (sidebarTab === "unread") {
    baseList = unreadChatsList;
  } else if (sidebarTab === "favourites") {
    baseList = favChatsList;
  } else if (sidebarTab === "groups") {
    baseList = groupChatsList;
  }

  if (searchLower) {
    displayChats = baseList.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(searchLower) ||
        (c.id || "").includes(searchLower) ||
        (c.lastMessage?.body || "").toLowerCase().includes(searchLower)
    );
  } else {
    displayChats = baseList;
  }

  if (!status.connected) {
    return (
      <div className="w-full flex-1 flex flex-col">
        <WhatsAppNav />
        {showConfigModal && (
          <WAConfigPrompt
            onClose={() => {
              setShowConfigModal(false);
              fetchStatus();
            }}
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-emerald-700 text-white flex items-center justify-center shadow-md">
              <MessageCircle size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">WhatsApp Connection Center</h1>
              <p className="text-xs text-gray-500">Connect via Official Meta Cloud API (No QR needed) or Scan QR Code</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Key size={14} />
              <span>Configure Meta API</span>
            </button>
            <button
              onClick={() => fetchQr(true)}
              disabled={qrLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={qrLoading ? "animate-spin" : ""} />
              <span>{qrLoading ? "Generating..." : "Fresh QR / Reset"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Quick Meta API Callout Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Key size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">Using Official Meta WhatsApp Cloud API?</p>
              <p className="text-[11px] text-blue-700">You don't need to scan a QR code! Connect your Phone Number ID and Access Token to open immediately.</p>
            </div>
          </div>
          <button
            onClick={() => setShowConfigModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shrink-0 shadow-md shadow-blue-500/20"
          >
            Enter Meta API Keys ⚡
          </button>
        </div>

        {/* Connection Options Sub-Tabs */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm max-w-2xl mx-auto w-full">
          <div className="flex items-center justify-center gap-2 mb-6 border-b border-gray-100 pb-4">
            <button
              onClick={() => { setConnectMode("qr"); if (!qrCode) fetchQr(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${connectMode === "qr" ? "bg-[#25D366] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              📱 Scan QR Code
            </button>
            <button
              onClick={() => setConnectMode("pairing")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${connectMode === "pairing" ? "bg-[#25D366] text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              🔢 Phone Pairing Code
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            >
              ☁️ Meta Cloud API
            </button>
          </div>

          {/* Mode 1: QR Code Scan */}
          {connectMode === "qr" && (
            <div className="flex flex-col items-center justify-center text-center py-4">
              {qrLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={44} className="animate-spin text-[#25D366] mx-auto mb-4" />
                  <p className="text-gray-800 font-bold text-sm">Generating WhatsApp QR Code...</p>
                  <p className="text-gray-400 text-xs mt-1">Please wait a few seconds</p>
                </div>
              ) : qrCode ? (
                <div>
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 inline-block mb-4">
                    <QRCodeSVG value={qrCode} size={240} level="M" />
                  </div>
                  <h3 className="text-base font-bold text-gray-800 mb-1">Scan with your WhatsApp App</h3>
                  <p className="text-gray-500 text-xs max-w-md mx-auto mb-4">
                    Open WhatsApp on your phone → Settings / Menu → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and scan this code.
                  </p>
                  <button
                    onClick={() => fetchQr(true)}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Refresh QR Code
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <Smartphone size={52} className="text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-gray-800 mb-1">Ready to Link WhatsApp Phone</h3>
                  <p className="text-gray-500 text-xs max-w-sm mx-auto mb-4">Click below to generate a QR code to scan with your phone.</p>
                  <button
                    onClick={() => fetchQr()}
                    className="px-6 py-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#1ebe5d] transition font-bold text-xs shadow-md"
                  >
                    Display QR Code Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 2: Phone Pairing Code */}
          {connectMode === "pairing" && (
            <div className="py-4">
              <h3 className="text-base font-bold text-gray-800 mb-1 text-center">Link via Mobile Number</h3>
              <p className="text-gray-500 text-xs text-center mb-6 max-w-md mx-auto">
                Enter your mobile number with country code (e.g. 919876543210) to receive an 8-character WhatsApp pairing code.
              </p>

              {pairingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl text-center font-semibold">
                  {pairingError}
                </div>
              )}

              {pairingCode ? (
                <div className="text-center py-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                  <p className="text-xs text-emerald-700 font-semibold mb-2">YOUR WHATSAPP PAIRING CODE</p>
                  <div className="text-3xl font-mono font-black text-emerald-900 tracking-widest bg-white py-3 px-6 rounded-xl border border-emerald-300 inline-block mb-3 shadow-inner">
                    {pairingCode}
                  </div>
                  <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                    Open WhatsApp on phone → Linked Devices → <strong>Link with phone number instead</strong> → Enter this code.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRequestPairingCode} className="space-y-4 max-w-md mx-auto">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Mobile Number (with Country Code)</label>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210"
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={pairingLoading || !pairingPhone}
                    className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold text-xs hover:bg-[#1ebe5d] transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {pairingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Generating Code...</span>
                      </>
                    ) : (
                      <span>Get 8-Digit Pairing Code</span>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col h-screen min-h-screen bg-[#0b141a] text-slate-100 p-2 md:p-3 overflow-hidden shadow-2xl">
      <WhatsAppNav
        onAccountBalance={fetchAccountBalance}
        onSyncWhatsApp={handleSyncWhatsApp}
        onLogout={handleLogout}
        isSyncing={syncing}
        statusPhone={status.phone}
      />

      {error && (
        <div className="p-3 bg-red-950/80 border-b border-red-800 text-red-200 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main WhatsApp App Canvas */}
      <div className="flex-1 flex overflow-hidden w-full">

        {/* Chats Sidebar Column */}
        <div className={`w-full md:w-96 lg:w-[420px] bg-[#111b21] border-r border-[#222d34] flex flex-col shrink-0 ${showMobileChat ? "hidden md:flex" : "flex"}`}>
          {/* Search Bar & Action Buttons */}
          <div className="p-3 border-b border-[#222d34] flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search or start a new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#202c33] text-slate-100 placeholder-slate-400 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#00a884] border border-transparent"
              />
            </div>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-[#202c33] text-slate-300 hover:text-white hover:bg-[#2a3942] rounded-xl transition shrink-0"
              title="Start new chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => fetchChats(true)}
              className="p-2 bg-[#202c33] text-slate-300 hover:text-white hover:bg-[#2a3942] rounded-xl transition shrink-0"
              title="Refresh chat list"
            >
              <RefreshCw size={15} className={chatsLoading ? "animate-spin text-[#00a884]" : ""} />
            </button>
          </div>

          {/* Filter Capsules / Pills (All, Unread, Favourites, Groups) */}
          <div className="px-3 py-2 border-b border-[#222d34] flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSidebarTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${sidebarTab === "all"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setSidebarTab("unread")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${sidebarTab === "unread"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              <span>Unread</span>
              {unreadChatsList.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                  {unreadChatsList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab("favourites")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap ${sidebarTab === "favourites"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              Favourites
            </button>
            <button
              onClick={() => setSidebarTab("groups")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${sidebarTab === "groups"
                  ? "bg-[#00a884] text-white shadow-sm"
                  : "bg-[#202c33] text-slate-300 hover:bg-[#2a3942]"
                }`}
            >
              <span>Groups</span>
              {groupChatsList.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${sidebarTab === "groups" ? "bg-white/20 text-white" : "bg-[#111b21] text-slate-300"}`}>
                  {groupChatsList.length}
                </span>
              )}
            </button>
          </div>

          {/* Chat List Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/60">
            {chatsLoading && chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
                <Loader2 size={28} className="animate-spin text-[#00a884]" />
                <p className="text-xs font-medium">Loading conversations...</p>
              </div>
            ) : displayChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-center">
                <MessageSquare size={36} className="mb-2 text-[#00a884] opacity-80" />
                <p className="font-semibold text-slate-200 text-sm mb-1">
                  {searchTerm
                    ? "No chats match your search"
                    : sidebarTab === "unread"
                    ? "No unread messages"
                    : sidebarTab === "favourites"
                    ? "No starred or pinned chats"
                    : sidebarTab === "groups"
                    ? "No group chats found"
                    : "No WhatsApp chats yet"}
                </p>
                <p className="text-xs text-slate-400 mb-4 max-w-xs">
                  {searchTerm
                    ? "Try searching with a different name, phone number, or message"
                    : "Start a conversation directly with any contact or phone number"}
                </p>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="px-4 py-2 bg-[#00a884] text-white rounded-xl text-xs font-bold hover:bg-[#008f70] transition shadow-md flex items-center gap-1.5"
                >
                  <UserPlus size={14} />
                  <span>Start New Chat</span>
                </button>
              </div>
            ) : (
              displayChats.map((chat) => {
                const isActive = selectedChat?.id === chat.id;
                const timeStr = formatChatTime(chat.timestamp || chat.lastMessage?.timestamp);
                const hasUnread = (chat.unreadCount || 0) > 0;

                return (
                  <div
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 hover:bg-[#202c33] transition text-left cursor-pointer border-l-4 ${isActive ? "bg-[#2a3942] border-[#00a884]" : "border-transparent"
                      }`}
                  >
                    {/* Contact Profile Picture / Avatar */}
                    <WAContactAvatar
                      src={chat.profilePicUrl}
                      name={chat.name}
                      phone={chat.id}
                      isGroup={chat.isGroup}
                      size="md"
                      isOnline={!chat.isGroup}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`font-bold text-sm truncate ${isActive ? "text-white" : "text-slate-100"}`}>
                          {chat.name}
                        </span>
                        <span className={`text-[11px] font-semibold shrink-0 ${hasUnread ? "text-[#00a884]" : "text-slate-400"}`}>
                          {timeStr}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 text-xs text-slate-400 truncate">
                          {chat.lastMessage?.fromMe && (
                            <span className="text-[#53bdeb] font-bold text-xs shrink-0">✓✓</span>
                          )}
                          <span className="truncate">
                            {chat.lastMessage?.body || "Tap to open conversation"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {chat.isMuted && <VolumeX size={13} className="text-slate-400" />}
                          {chat.isPinned && <Pin size={13} className="text-slate-400 rotate-45" />}
                          {hasUnread && (
                            <span className="bg-[#00a884] text-[#111b21] text-[10px] px-1.5 py-0.5 rounded-full font-extrabold min-w-[18px] text-center shadow">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main Conversation Window / Empty State */}
        <div className={`flex-1 flex flex-col min-w-0 bg-[#0b141a] relative ${!showMobileChat ? "hidden md:flex" : "flex"}`}>
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#111b21] text-slate-400 select-none">
              <div className="max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#202c33] flex items-center justify-center text-[#00a884] shadow-inner">
                  <MessageCircle size={44} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-100 tracking-wide">WhatsApp Desktop & CRM Live</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Send and receive live messages without keeping your phone online. Connected with ACHME CRM.
                  </p>
                </div>

                {/* Quick Action Shortcut Buttons (Matching Screenshot) */}
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-[#00a884] group-hover:scale-110 transition">
                      <FileText size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Send document</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-[#00a884] group-hover:scale-110 transition">
                      <UserPlus size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Add contact</span>
                  </button>

                  <button
                    onClick={() => setShowNewChatModal(true)}
                    className="flex flex-col items-center gap-2 p-3.5 bg-[#202c33] hover:bg-[#2a3942] rounded-2xl transition w-28 border border-white/5 group shadow-md"
                  >
                    <div className="p-2.5 bg-[#111b21] rounded-xl text-purple-400 group-hover:scale-110 transition">
                      <Sparkles size={20} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200">Ask Meta AI</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Active Chat Header */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#222d34] bg-[#202c33] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1 text-slate-300 hover:text-white rounded">
                    <ChevronLeft size={20} />
                  </button>
                  <div
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="cursor-pointer"
                  >
                    <WAContactAvatar
                      src={selectedChat.profilePicUrl}
                      name={selectedChat.name}
                      phone={selectedChat.id}
                      isGroup={selectedChat.isGroup}
                      size="md"
                      isOnline={!selectedChat.isGroup}
                      clickable={true}
                    />
                  </div>
                  <div
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="cursor-pointer group min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm group-hover:text-[#00a884] transition truncate">{selectedChat.name}</p>
                      {selectedChat.source && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 shrink-0">
                          {selectedChat.source}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">+{selectedChat.id?.replace(/\D/g, "")}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {/* Trigger Chatbot Flow Button */}
                  <button
                    onClick={() => setShowFlowModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/60 text-amber-300 hover:bg-amber-900/50 rounded-lg transition text-xs font-semibold border border-amber-800/40 shadow-sm"
                    title="Trigger an automated Chatbot Flow for this contact"
                  >
                    <Zap size={14} />
                    <span className="hidden sm:inline">Trigger Flow</span>
                  </button>

                  {/* Template Picker Button */}
                  <button
                    onClick={() => setShowTemplatePicker((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/50 rounded-lg transition text-xs font-semibold border border-emerald-800/40 shadow-sm"
                    title="Insert WhatsApp message template"
                  >
                    <FileText size={14} />
                    <span className="hidden sm:inline">Templates</span>
                  </button>

                  {/* CRM Info & Hub Drawer */}
                  <button
                    onClick={() => {
                      fetchContactCrmDetails(selectedChat.id);
                      setShowContactInfoDrawer(true);
                    }}
                    className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                    title="View Contact Profile, CRM Inquiries & Quick Links"
                  >
                    <Info size={18} />
                  </button>
                </div>
              </div>

              {/* Shared Team Inbox Collaboration & Ticket Status Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#182229] border-b border-[#222d34] text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ticket Status Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                    {["open", "pending", "resolved", "spam"].map((st) => (
                      <button
                        key={st}
                        onClick={() => handleUpdateTicketStatus(st)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition ${
                          ticketStatus === st
                            ? st === "open"
                              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400"
                              : st === "pending"
                              ? "bg-amber-500/30 text-amber-300 border border-amber-400"
                              : st === "resolved"
                              ? "bg-blue-500/30 text-blue-300 border border-blue-400"
                              : "bg-red-500/30 text-red-300 border border-red-400"
                            : "bg-[#202c33] text-slate-400 hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Agent Assignment Selector */}
                  <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700/60 pl-2">
                    <span className="text-[11px] font-bold text-slate-400">Agent:</span>
                    <select
                      value={assignedAgentName}
                      onChange={(e) => {
                        const sel = teamMembers.find((m) => `${m.first_name} ${m.last_name || ""}`.trim() === e.target.value);
                        handleAssignAgent(sel?.id || null, e.target.value);
                      }}
                      className="bg-[#202c33] text-slate-200 border border-[#2a3942] rounded-lg px-2 py-1 text-xs outline-none cursor-pointer focus:border-[#00a884]"
                    >
                      <option value="">👤 Unassigned</option>
                      {teamMembers.map((m) => {
                        const name = `${m.first_name} ${m.last_name || ""}`.trim();
                        return (
                          <option key={m.id} value={name}>
                            👤 {name} ({m.emp_role || "Agent"})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Launch Chatbot Flow Button */}
                  <button
                    onClick={() => {
                      fetchFlows();
                      setShowFlowModal(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold text-[11px] transition shadow-sm"
                    title="Launch a smart chatbot flow for this customer"
                  >
                    <span>🤖 Launch Flow</span>
                  </button>

                  {/* Internal Team Notes Drawer Toggle */}
                  <button
                    onClick={() => {
                      fetchInternalNotes(selectedChat.id);
                      setShowNotesDrawer(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold text-[11px] transition shadow-sm"
                  >
                    <span>📝 Team Notes</span>
                    {internalNotes.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-amber-400 text-black font-extrabold text-[10px] rounded-full">
                        {internalNotes.length}
                      </span>
                    )}
                  </button>

                  {/* Engine Badge */}
                  {status.isCloud ? (
                    <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/80 text-blue-300 border border-blue-500/40 rounded-lg text-[10px] font-bold shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      <span>☁️ Meta Official API • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  ) : (
                    <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 bg-[#202c33] text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>📱 Web Linked • {status.phone ? `+${status.phone}` : "Active"}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0b141a] bg-opacity-95">
                {messages.length >= msgLimit && (
                  <div className="flex justify-center mb-3">
                    <button
                      onClick={handleLoadMoreMessages}
                      disabled={loadingMore}
                      className="px-4 py-1.5 bg-[#202c33] border border-white/10 text-xs font-semibold text-slate-300 rounded-full hover:bg-[#2a3942] transition shadow flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 size={13} className="animate-spin text-[#00a884]" /> : <RefreshCw size={13} />}
                      <span>Load older messages</span>
                    </button>
                  </div>
                )}
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={28} className="animate-spin text-[#00a884]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                    <MessageSquare size={44} className="mb-2 text-[#00a884] opacity-80" />
                    <p className="font-bold text-slate-200 text-base">No message history yet</p>
                    <p className="text-xs text-slate-400">Send a message below to start chatting with {selectedChat.name}</p>
                  </div>
                ) : (
                  [...messages].reverse().map((msg) => (
                    <div
                      key={msg.id || msg.timestamp}
                      className={`flex ${msg.isMe ? "justify-end" : "justify-start"} group relative`}
                    >
                      {/* Hover action toolbar for reactions & quote reply */}
                      <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-[#111b21] px-2 py-0.5 rounded-full shadow border border-slate-700/60 absolute -top-3 z-10 select-none">
                        {["👍", "❤️", "😂", "😮", "🙏"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReact(msg.id, emoji)}
                            className="hover:scale-125 transition text-xs p-0.5"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="text-slate-400 hover:text-white ml-1 text-xs px-1 hover:bg-white/10 rounded"
                          title="Quote reply"
                        >
                          ↩️
                        </button>
                      </div>

                      <div
                        className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm shadow-md relative ${msg.isMe
                            ? "bg-[#005c4b] text-white rounded-tr-none"
                            : "bg-[#202c33] text-white rounded-tl-none border border-slate-700/40"
                          }`}
                      >
                        {/* Quoted Message Preview in bubble */}
                        {msg.quotedMsg && (
                          <div className="mb-2 p-1.5 bg-black/25 rounded-lg border-l-2 border-[#00a884] text-xs text-slate-300">
                            <p className="font-bold text-[10px] text-[#00a884]">Quoted Message</p>
                            <p className="truncate text-slate-200">{msg.quotedMsg.body || "Attachment"}</p>
                          </div>
                        )}

                        {msg.location ? (
                          <a
                            href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 underline font-semibold text-emerald-300"
                          >
                            <MapPin size={14} /> {msg.location.name || "Shared location"}
                          </a>
                        ) : (msg.hasMedia || msg.type === "image" || msg.type === "video" || msg.type === "audio" || msg.type === "ptt" || msg.type === "document" || msg.type === "sticker" || isFilename(msg.body) || isFilename(msg.filename)) ? (
                          <div className="space-y-1">
                            <MediaBubble
                              chatId={selectedChat.id}
                              messageId={msg.id}
                              filename={msg.filename || msg.body}
                              isMe={msg.isMe}
                              onPreview={(src, title) => setLightboxImage({ src, title })}
                            />
                            {msg.body && !isFilename(msg.body) && !msg.body.startsWith("http") ? (
                              <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                            ) : null}
                          </div>
                        ) : (
                          <RichMessageContent
                            text={msg.body || previewText(msg) || (msg.isMe ? "Sent message" : "Incoming message")}
                            isMe={msg.isMe}
                          />
                        )}

                        {/* Interactive Quick Reply Option Buttons */}
                        {(() => {
                          const quickOptions = extractQuickReplies(msg);
                          if (!quickOptions || quickOptions.length === 0) return null;
                          return (
                            <div className="mt-2 pt-2 border-t border-white/15 space-y-1.5">
                              <div className="text-[10px] uppercase font-bold text-emerald-400/90 flex items-center gap-1">
                                <span>⚡ Quick Reply Options:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {quickOptions.map((opt, optIdx) => (
                                  <button
                                    key={optIdx}
                                    type="button"
                                    onClick={() => handleSendDirect(opt)}
                                    className="px-2.5 py-1.5 bg-[#00a884]/20 hover:bg-[#00a884] text-emerald-200 hover:text-white rounded-lg text-xs font-bold transition border border-[#00a884]/40 flex items-center gap-1 shadow-sm active:scale-95 text-left"
                                    title={`Send "${opt}"`}
                                  >
                                    <span>🔘</span>
                                    <span>{opt}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Reaction badges on bubble */}
                        {Array.isArray(msg.reactions) && msg.reactions.length > 0 && (
                          <div className="flex gap-1 mt-1 -mb-1">
                            {msg.reactions.map((r, rIdx) => (
                              <span key={rIdx} className="bg-[#111b21]/90 border border-slate-700/80 px-1.5 py-0.2 rounded-full text-[11px] shadow">
                                {r.emoji}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 text-[11px] mt-1 text-slate-300/80 font-medium">
                          <span>
                            {msg.timestamp
                              ? new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : ""}
                          </span>
                          {msg.isMe && (
                            <span className="text-[#53bdeb] font-bold text-xs">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quote Reply Banner above composer */}
              {replyingTo && (
                <div className="px-4 py-2 bg-[#182229] border-t border-[#222d34] flex items-center justify-between text-xs text-slate-300 shrink-0">
                  <div className="border-l-2 border-[#00a884] pl-2 truncate">
                    <span className="font-bold text-[#00a884]">Replying to {replyingTo.isMe ? "You" : selectedChat.name}:</span>{" "}
                    <span className="text-slate-300">{replyingTo.body?.slice(0, 80) || "Attachment"}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-white p-1">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Input Area & Tool Suite */}
              <div className="relative flex items-center gap-2 p-3 border-t border-[#222d34] bg-[#202c33] shrink-0">
                {/* Hidden File Inputs for Different Media Types */}
                <input
                  id="wa-doc-upload-input"
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip,.rar,.7z,.md,.json"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "document")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-excel-upload-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "document")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-media-upload-input"
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "media")}
                  disabled={mediaSending}
                />
                <input
                  id="wa-audio-upload-input"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => handleAttachMedia(e, "audio")}
                  disabled={mediaSending}
                />

                {/* Floating Attachment & Action Popover Menu */}
                {showAttachMenu && (
                  <div className="absolute bottom-full left-3 mb-3 w-72 bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl z-40 p-2 text-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="px-3 py-2 border-b border-[#222d34] flex items-center justify-between text-xs font-bold text-[#00a884]">
                      <span className="flex items-center gap-1.5"><Paperclip size={14} /> Share Media & Quick Tools</span>
                      <button onClick={() => setShowAttachMenu(false)} className="text-slate-400 hover:text-white p-0.5">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="p-1.5 space-y-1">
                      {/* Document / PDF */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-doc-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-red-400">PDF & Document</p>
                          <p className="text-[10px] text-slate-400 truncate">.pdf, .doc, .docx, .txt, .zip</p>
                        </div>
                      </button>

                      {/* Excel / Spreadsheet */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-excel-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Database size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-emerald-400">Excel / Spreadsheet</p>
                          <p className="text-[10px] text-slate-400 truncate">.xlsx, .xls, .csv spreadsheets</p>
                        </div>
                      </button>

                      {/* Photos & Videos */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-media-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Image size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-purple-400">Photos & Videos</p>
                          <p className="text-[10px] text-slate-400 truncate">Images (.png, .jpg), Videos (.mp4)</p>
                        </div>
                      </button>

                      {/* Audio / Voice Note */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          document.getElementById("wa-audio-upload-input")?.click();
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Music size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-[#00a884]">Audio / Voice</p>
                          <p className="text-[10px] text-slate-400 truncate">.mp3, .ogg, .wav audio files</p>
                        </div>
                      </button>

                      {/* Trigger Chatbot Flow */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowFlowModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Zap size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-amber-300">Trigger Chatbot Flow</p>
                          <p className="text-[10px] text-slate-400 truncate">Automated customer flow & bot reply</p>
                        </div>
                      </button>

                      {/* Send Inquiry Options Menu */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowOptionsModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
                          <ListOrdered size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-blue-300">Send Options / Inquiry Menu</p>
                          <p className="text-[10px] text-slate-400 truncate">Numbered inquiry buttons & quick replies</p>
                        </div>
                      </button>

                      {/* Insert Template */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowTemplatePicker(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-[#00a884]">Approved Template</p>
                          <p className="text-[10px] text-slate-400 truncate">Insert WhatsApp formatted template</p>
                        </div>
                      </button>

                      {/* Request WhatsApp Payment */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          setShowPaymentModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
                          <CreditCard size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-emerald-300">Request WhatsApp Payment</p>
                          <p className="text-[10px] text-slate-400 truncate">Generate 0% markup UPI / payment link</p>
                        </div>
                      </button>

                      {/* Enroll in Drip Sequence */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          fetchDripSequences();
                          setShowDripModal(true);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Sparkles size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-indigo-300">Enroll in Drip Sequence</p>
                          <p className="text-[10px] text-slate-400 truncate">Automated multi-day lead nurturing</p>
                        </div>
                      </button>

                      {/* Share Location */}
                      <button
                        onClick={() => {
                          setShowAttachMenu(false);
                          handleShareLocation();
                        }}
                        disabled={locationSending}
                        className="w-full text-left flex items-center gap-3 p-2.5 hover:bg-[#202c33] rounded-xl transition text-xs font-medium text-slate-200 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-105 transition">
                          <Navigation size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-100 group-hover:text-rose-300">Share GPS Location</p>
                          <p className="text-[10px] text-slate-400 truncate">Send current office / live coordinates</p>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Slash commands quick-replies popup */}
                {messageInput.startsWith("/") && (
                  <div className="absolute bottom-full left-3 mb-2 w-80 max-h-60 overflow-y-auto bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl z-30 p-2 space-y-1 text-slate-200">
                    <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#00a884]">Quick Replies (Click to insert)</div>
                    {quickReplies
                      .filter((qr) => qr.shortcut?.toLowerCase().includes(messageInput.slice(1).toLowerCase()) || qr.title?.toLowerCase().includes(messageInput.slice(1).toLowerCase()))
                      .map((qr) => (
                        <div
                          key={qr.id}
                          onClick={() => setMessageInput(qr.content)}
                          className="p-2 hover:bg-[#202c33] rounded-xl cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-[#00a884]">/{qr.shortcut}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{qr.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 truncate mt-0.5">{qr.content}</p>
                        </div>
                      ))}
                  </div>
                )}

                {/* Message Template Picker Modal Popup */}
                {showTemplatePicker && (
                  <div className="absolute bottom-full left-3 mb-2 w-88 max-h-80 overflow-y-auto bg-[#111b21] border border-[#222d34] rounded-2xl shadow-2xl z-30 text-slate-200">
                    <div className="px-3 py-2 bg-[#202c33] border-b border-[#222d34] text-xs font-bold text-slate-200 flex items-center justify-between">
                      <span>Insert Message Template</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }}
                          className="text-[10px] font-bold text-[#00a884] hover:underline"
                        >
                          + Create Template
                        </button>
                        <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {templates.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400 text-center space-y-2">
                        <p>No templates loaded yet</p>
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            onClick={handleSeedTemplates}
                            disabled={tmplLoading}
                            className="px-3 py-1 bg-[#00a884] text-[#111b21] rounded text-xs font-bold hover:bg-[#008f70]"
                          >
                            {tmplLoading ? "Seeding..." : "Seed 8 Default Templates"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#222d34]">
                        <div className="p-2 bg-[#111b21] flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">{templates.length} templates available</span>
                          <button onClick={() => { setShowTemplatePicker(false); setShowCreateTemplateModal(true); }} className="text-[#00a884] font-bold hover:underline">
                            + New Template
                          </button>
                        </div>
                        {templates.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => insertTemplate(t)}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#202c33] transition group"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-slate-200 group-hover:text-[#00a884]">{t.name}</p>
                              {t.category && (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                                  {t.category}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{t.body}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Paperclip Button (Opens Attachments & Quick Tools) */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu((v) => !v)}
                  className={`p-2.5 rounded-full transition shrink-0 ${showAttachMenu ? "bg-[#00a884] text-[#111b21]" : "text-slate-400 hover:text-[#00a884] hover:bg-[#2a3942]"}`}
                  title="Share document, photo, video, audio, trigger flows or inquiry menu"
                >
                  {mediaSending ? <Loader2 size={18} className="animate-spin text-[#00a884]" /> : <Paperclip size={18} />}
                </button>

                {/* Templates Quick Button */}
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className="p-2.5 text-slate-400 hover:text-[#00a884] hover:bg-[#2a3942] rounded-full transition shrink-0"
                  title="Insert a saved template"
                >
                  <FileText size={18} />
                </button>

                {/* Quick Flow Trigger Button */}
                <button
                  type="button"
                  onClick={() => setShowFlowModal(true)}
                  className="p-2.5 text-amber-400 hover:text-amber-300 hover:bg-[#2a3942] rounded-full transition shrink-0"
                  title="Trigger Chatbot Flow"
                >
                  <Zap size={18} />
                </button>

                {/* Message Input Box */}
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${selectedChat.name}... (Type / for quick replies)`}
                  className="flex-1 px-4 py-2.5 bg-[#2a3942] text-slate-100 placeholder-slate-400 rounded-xl text-sm outline-none border border-transparent focus:border-[#00a884]"
                  disabled={sending}
                />

                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                  className="p-2.5 bg-[#00a884] text-[#111b21] font-bold rounded-full hover:bg-[#008f70] transition disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Direct Chat & CRM Contact Picker Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowNewChatModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowNewChatModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <UserPlus size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Start New WhatsApp Chat</h3>
                <p className="text-xs text-gray-500">Enter a phone number to start a new chat directly</p>
              </div>
            </div>

            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mobile Number *</label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600 font-semibold">+91</span>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newChatPhone}
                    onChange={(e) => setNewChatPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                    required
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Enter 10-digit mobile number</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Contact Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">First Message (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Hello! Welcome to ACHME..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewChatModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newChatLoading || !newChatPhone.trim()}
                  className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {newChatLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Start Chat & Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-over Contact Profile Drawer */}
      {showContactInfoDrawer && selectedChat && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end backdrop-blur-sm" onClick={() => setShowContactInfoDrawer(false)}>
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 overflow-y-auto relative animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowContactInfoDrawer(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="text-center pb-6 border-b border-gray-100">
              <div className="flex flex-col items-center justify-center mx-auto mb-3">
                <WAContactAvatar
                  src={selectedChat.profilePicUrl}
                  name={selectedChat.name}
                  phone={selectedChat.id}
                  isGroup={selectedChat.isGroup}
                  size="2xl"
                  clickable={true}
                  className="shadow-lg shadow-black/10"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(selectedChat.id)}/profile-pic`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                      });
                      if (res.data?.profilePicUrl) {
                        setSelectedChat(prev => ({ ...prev, profilePicUrl: res.data.profilePicUrl }));
                        setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, profilePicUrl: res.data.profilePicUrl } : c));
                      }
                    } catch (_) {}
                  }}
                  className="mt-2 text-[10px] text-[#00a884] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>Refresh WhatsApp Photo</span>
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-800">{selectedChat.name}</h3>
              <p className="text-xs font-mono text-gray-500 mt-0.5">+{selectedChat.id?.replace(/\D/g, "")}</p>

              {selectedChat.source && (
                <span className="inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                  {selectedChat.source}
                </span>
              )}
            </div>

            {/* CRM Invoices, Quotations, and AMC History */}
            <div className="py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Linked CRM Records</h4>
                <button
                  onClick={() => fetchContactCrmDetails(selectedChat.id)}
                  className="text-[10px] text-[#00a884] font-bold hover:underline"
                >
                  Refresh
                </button>
              </div>

              {crmDetailsLoading ? (
                <div className="py-3 text-center">
                  <Loader2 size={18} className="animate-spin text-[#00a884] mx-auto" />
                </div>
              ) : crmDetails ? (
                <div className="space-y-3 text-xs">
                  {/* Invoices list */}
                  {crmDetails.invoices && crmDetails.invoices.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="font-bold text-gray-700 mb-1.5 text-[11px]">Recent Invoices ({crmDetails.invoices.length})</p>
                      <div className="space-y-1">
                        {crmDetails.invoices.slice(0, 3).map((inv) => (
                          <div key={inv.id} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate">{inv.invoice_number || `INV-#${inv.id}`}</span>
                            <span className="font-bold text-gray-800">₹{parseFloat(inv.grand_total || inv.total_amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quotations list */}
                  {crmDetails.quotations && crmDetails.quotations.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      <p className="font-bold text-gray-700 mb-1.5 text-[11px]">Quotations ({crmDetails.quotations.length})</p>
                      <div className="space-y-1">
                        {crmDetails.quotations.slice(0, 3).map((q) => (
                          <div key={q.id} className="flex justify-between text-[11px]">
                            <span className="text-gray-600 truncate">{q.quotation_number || `QTN-#${q.id}`}</span>
                            <span className="font-bold text-emerald-700">₹{parseFloat(q.grand_total || q.total_amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AMC Contracts */}
                  {crmDetails.amc && crmDetails.amc.length > 0 && (
                    <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                      <p className="font-bold text-emerald-800 mb-1 text-[11px]">Active AMC Contract</p>
                      <p className="text-[11px] text-emerald-900">{crmDetails.amc[0].contract_title || "Annual Maintenance"}</p>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fetchContactCrmDetails(selectedChat.id)}
                  className="w-full py-2 bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-100 transition border border-gray-200"
                >
                  Load CRM Invoices & Quotes
                </button>
              )}
            </div>

            {/* WhatsApp CRM & Marketing Hub Navigation Bar */}
            <div className="py-4 border-b border-gray-100 space-y-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">WhatsApp Suite Hub</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate("/dashboard/whatsapp/campaigns")}
                  className="flex items-center gap-2 p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl transition text-xs font-semibold text-left border border-blue-200/60"
                >
                  <SendHorizontal size={15} className="text-blue-600 shrink-0" />
                  <span className="truncate">Bulk Campaigns</span>
                </button>

                <button
                  onClick={() => navigate("/dashboard/whatsapp/automations")}
                  className="flex items-center gap-2 p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl transition text-xs font-semibold text-left border border-purple-200/60"
                >
                  <Sparkles size={15} className="text-purple-600 shrink-0" />
                  <span className="truncate">Automations</span>
                </button>

                <button
                  onClick={() => navigate("/dashboard/whatsapp/flows")}
                  className="flex items-center gap-2 p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition text-xs font-semibold text-left border border-amber-200/60"
                >
                  <Zap size={15} className="text-amber-600 shrink-0" />
                  <span className="truncate">Chatbot Flows</span>
                </button>

                <button
                  onClick={() => navigate("/dashboard/whatsapp/analytics")}
                  className="flex items-center gap-2 p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl transition text-xs font-semibold text-left border border-emerald-200/60"
                >
                  <BarChart3 size={15} className="text-emerald-600 shrink-0" />
                  <span className="truncate">Analytics</span>
                </button>
              </div>
            </div>

            {/* Quick Actions & Inquiries */}
            <div className="py-4 space-y-2.5">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quick Inquiries & Bot Tools</h4>
              
              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  setShowFlowModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Zap size={15} className="text-amber-600" />
                <span>Trigger Chatbot Flow</span>
              </button>

              <button
                onClick={() => {
                  setShowContactInfoDrawer(false);
                  setShowOptionsModal(true);
                }}
                className="w-full py-2.5 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <ListOrdered size={15} className="text-blue-600" />
                <span>Send Inquiry Options Menu</span>
              </button>

              <a
                href={`tel:+${selectedChat.id?.replace(/\D/g, "")}`}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <PhoneCall size={15} className="text-emerald-600" />
                <span>Direct Call +{selectedChat.id?.replace(/\D/g, "")}</span>
              </a>

              <button
                onClick={() => setShowContactInfoDrawer(false)}
                className="w-full py-2.5 px-4 bg-[#00a884] text-white rounded-xl text-xs font-bold hover:bg-[#008f70] transition shadow"
              >
                Return to Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Chatbot Flow Modal */}
      {showFlowModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowFlowModal(false)}>
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowFlowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                <Zap size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Trigger Chatbot Flow</h3>
                <p className="text-xs text-slate-400">Launch an automated multi-step chatbot flow for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {flowsLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[#00a884] mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading chatbot flows...</p>
              </div>
            ) : flows.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-3">
                <p>No Chatbot Flows created yet.</p>
                <button
                  onClick={() => navigate("/dashboard/whatsapp/flows")}
                  className="px-4 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition"
                >
                  Create Flow in Flow Builder
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300">Select a flow to execute:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {flows.map((fl) => (
                    <div
                      key={fl.id}
                      onClick={() => setSelectedFlowId(fl.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${selectedFlowId === fl.id ? "bg-[#005c4b]/40 border-[#00a884] text-white" : "bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942] text-slate-200"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{fl.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-slate-300 font-mono">
                            {fl.node_count || 1} nodes
                          </span>
                        </div>
                        {fl.description && <p className="text-[11px] text-slate-400 truncate mt-0.5">{fl.description}</p>}
                      </div>
                      {selectedFlowId === fl.id && <CheckCircle2 size={18} className="text-[#00a884] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[#222d34]">
                  <button
                    onClick={() => navigate("/dashboard/whatsapp/flows")}
                    className="text-xs text-[#00a884] hover:underline font-bold"
                  >
                    Open Flow Builder →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFlowModal(false)}
                      className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedFlowId || triggeringFlow}
                      onClick={() => handleTriggerFlow(selectedFlowId)}
                      className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                    >
                      {triggeringFlow ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                      <span>Launch Flow</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Inquiry Options / Interactive Menu Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowOptionsModal(false)}>
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowOptionsModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl">
                <ListOrdered size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Send Inquiry & Options Menu</h3>
                <p className="text-xs text-slate-400">Prompt the customer with numbered interactive inquiry choices</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Header / Prompt Title</label>
                <input
                  type="text"
                  value={optionsMenuTitle}
                  onChange={(e) => setOptionsMenuTitle(e.target.value)}
                  placeholder="e.g. Welcome to ACHME. How can we help you?"
                  className="w-full px-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-[#00a884]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase">Menu Options (Replies)</label>
                  <button
                    type="button"
                    onClick={() => setOptionsMenuItems((prev) => [...prev, `Option ${prev.length + 1}`])}
                    className="text-[11px] font-bold text-[#00a884] hover:underline"
                  >
                    + Add Option
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {optionsMenuItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="w-6 text-center text-xs font-bold text-[#00a884]">{idx + 1}.</span>
                      <input
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const updated = [...optionsMenuItems];
                          updated[idx] = e.target.value;
                          setOptionsMenuItems(updated);
                        }}
                        className="flex-1 px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-[#00a884]"
                      />
                      {optionsMenuItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setOptionsMenuItems(optionsMenuItems.filter((_, i) => i !== idx))}
                          className="p-1.5 text-slate-400 hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 space-y-1">
                <p className="text-[10px] font-bold text-[#00a884] uppercase tracking-wider">Preview in Chat:</p>
                <div className="text-xs text-slate-200 whitespace-pre-wrap font-sans">
                  <p className="font-bold">📋 {optionsMenuTitle}</p>
                  <div className="mt-1 space-y-0.5">
                    {optionsMenuItems.filter(Boolean).map((opt, i) => (
                      <p key={i}>{i + 1}️⃣ {opt}</p>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 italic mt-1.5">👉 Reply with a number (1-{optionsMenuItems.filter(Boolean).length}) to choose an option.</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#222d34]">
                <button
                  type="button"
                  onClick={() => setShowOptionsModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendOptionsMenu}
                  className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 shadow"
                >
                  <Send size={14} />
                  <span>Insert into Composer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Payment Request Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Request WhatsApp Payment</h3>
                <p className="text-xs text-slate-400">Generate 0% markup direct payment link for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            <form onSubmit={handleCreatePaymentRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Amount Due (INR ₹) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 5000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    className="w-full pl-8 pr-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-white font-bold outline-none focus:border-[#00a884]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Payment Description *</label>
                <input
                  type="text"
                  value={paymentDesc}
                  onChange={(e) => setPaymentDesc(e.target.value)}
                  placeholder="e.g. Annual Maintenance Contract / Service A"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-[#00a884]"
                />
              </div>

              <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 space-y-1 text-xs">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">0% Markup Guarantee:</p>
                <p className="text-slate-300 text-[11px]">Instant UPI / Payment link generated directly without 3rd-party aggregator markup fees. Real-time webhook marks invoice paid.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#222d34]">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPayment || !paymentAmount}
                  className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                >
                  {creatingPayment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Send Payment Link to WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drip Sequence Enrollment Modal */}
      {showDripModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowDripModal(false)}>
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDripModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-[#222d34] pb-3">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <Sparkles size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Enroll in Drip Sequence</h3>
                <p className="text-xs text-slate-400">Automated multi-day follow-up and nurturing for <span className="text-[#00a884] font-semibold">{selectedChat?.name}</span></p>
              </div>
            </div>

            {dripLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-[#00a884] mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading drip sequences...</p>
              </div>
            ) : dripSequences.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 space-y-3">
                <p>No active drip campaigns created yet.</p>
                <button
                  onClick={() => navigate("/dashboard/whatsapp/automations")}
                  className="px-4 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition"
                >
                  Create Drip Sequence in Automations
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300">Select a drip sequence:</p>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {dripSequences.map((seq) => (
                    <div
                      key={seq.id}
                      onClick={() => setSelectedDripId(seq.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${selectedDripId === seq.id ? "bg-indigo-950/60 border-indigo-500 text-white" : "bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942] text-slate-200"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs truncate">{seq.name}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-indigo-300 font-mono">
                            {seq.step_count || 1} steps
                          </span>
                        </div>
                        {seq.description && <p className="text-[11px] text-slate-400 truncate mt-0.5">{seq.description}</p>}
                      </div>
                      {selectedDripId === seq.id && <CheckCircle2 size={18} className="text-[#00a884] shrink-0 ml-2" />}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-[#222d34]">
                  <button
                    onClick={() => navigate("/dashboard/whatsapp/automations")}
                    className="text-xs text-[#00a884] hover:underline font-bold"
                  >
                    Manage Sequences →
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDripModal(false)}
                      className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] rounded-xl text-xs text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedDripId || enrollingDrip}
                      onClick={() => handleEnrollDrip(selectedDripId)}
                      className="px-5 py-2 bg-[#00a884] text-[#111b21] rounded-xl text-xs font-bold hover:bg-[#008f70] transition flex items-center gap-1.5 disabled:opacity-50 shadow"
                    >
                      {enrollingDrip ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      <span>Enroll Contact</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shared Team Inbox Internal Notes Slide-over Drawer */}
      {showNotesDrawer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-fadeIn" onClick={() => setShowNotesDrawer(false)}>
          <div className="w-full max-w-sm bg-[#111b21] border-l border-[#222d34] h-full flex flex-col shadow-2xl p-5 text-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-[#222d34]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Internal Team Notes</h3>
                  <p className="text-[11px] text-slate-400">Private notes for CRM agents (hidden from customer)</p>
                </div>
              </div>
              <button onClick={() => setShowNotesDrawer(false)} className="p-1 text-slate-400 hover:text-white rounded-full">
                <X size={18} />
              </button>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {notesLoading ? (
                <div className="py-10 text-center">
                  <Loader2 size={24} className="animate-spin text-[#00a884] mx-auto" />
                </div>
              ) : internalNotes.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-300">No internal notes yet</p>
                  <p>Add private notes below to collaborate with colleagues.</p>
                </div>
              ) : (
                internalNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-[#1e293b] border border-amber-500/30 rounded-xl space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-amber-400 flex items-center gap-1">
                        👤 {note.author_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(note.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add Note Input */}
            <form onSubmit={handleCreateInternalNote} className="pt-3 border-t border-[#222d34] space-y-2">
              <textarea
                rows={3}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Type private note or @colleague mention..."
                className="w-full px-3 py-2 bg-[#202c33] border border-[#2a3942] rounded-xl text-xs text-white outline-none focus:border-amber-400 resize-none"
                required
              />
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-amber-400/80">🔒 Only visible to team members</span>
                <button
                  type="submit"
                  disabled={submittingNote || !newNoteText.trim()}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submittingNote ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  <span>Save Note</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Messaging Quota Balance Modal */}
      {showAccountBalanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowAccountBalanceModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAccountBalanceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">WhatsApp Engine & Quota Balance</h3>
                <p className="text-xs text-gray-500">Live messaging analytics and connection status</p>
              </div>
            </div>

            {accountBalanceLoading ? (
              <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-600">Checking account quota balance...</p>
              </div>
            ) : accountBalance?.error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold">
                {accountBalance.error}
              </div>
            ) : accountBalance ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Connection Status:</span>
                    <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs flex items-center gap-1 ${accountBalance.connected ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                      <span className={`w-2 h-2 rounded-full ${accountBalance.connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                      {accountBalance.connected ? "Connected & Active" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-medium">Active Engine:</span>
                    <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
                      {accountBalance.activeEngine}
                    </span>
                  </div>
                  {accountBalance.phone && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Sender Number:</span>
                      <span className="font-mono text-gray-800">+{accountBalance.phone}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-emerald-700">Messages Today</p>
                    <p className="text-xl font-extrabold text-emerald-900 mt-1">{accountBalance.todaySent.toLocaleString()}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-blue-700">Total Outbound</p>
                    <p className="text-xl font-extrabold text-blue-900 mt-1">{accountBalance.totalSent.toLocaleString()}</p>
                  </div>
                  <div className="bg-teal-50 border border-teal-100 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-teal-700">Delivered</p>
                    <p className="text-xl font-extrabold text-teal-900 mt-1">{accountBalance.totalDelivered.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                    <p className="text-[10px] font-bold uppercase text-gray-600">Failed / Bounced</p>
                    <p className="text-xl font-extrabold text-gray-700 mt-1">{accountBalance.totalFailed.toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowAccountBalanceModal(false)}
                    className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] transition shadow"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Create New Template Modal */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowCreateTemplateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCreateTemplateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-3">
              <div className="p-3 bg-emerald-100 text-[#25D366] rounded-xl">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Create WhatsApp Template</h3>
                <p className="text-xs text-gray-500">Draft & save template with full Markdown support</p>
              </div>
            </div>

            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Template Identifier *</label>
                <input
                  type="text"
                  placeholder="e.g. promotional_discount_offer"
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Category</label>
                <select
                  value={newTmplCategory}
                  onChange={(e) => setNewTmplCategory(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366]"
                >
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Template Content (Supports Markdown & {"{name}"}) *</label>
                <textarea
                  rows={4}
                  placeholder={`Hello {name}!\n\n## Special Offer\nUse code **DISCOUNT20** to get 20% off.\n\n| Item | Discount |\n|---|---|\n| Service A | 20% |`}
                  value={newTmplBody}
                  onChange={(e) => setNewTmplBody(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#25D366] font-mono leading-relaxed resize-none"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">Supports Markdown headers (#), bold (**), lists (-), and tables (| col | col |)</p>
              </div>

              {/* Live Markdown Preview */}
              {newTmplBody.trim() && (
                <div className="p-3 bg-[#0b141a] rounded-xl border border-white/10 text-white space-y-1">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Live Chat Preview:</p>
                  <RichMessageContent text={newTmplBody} isMe={true} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateTemplateModal(false)} className="px-4 py-2 border rounded-lg text-xs text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tmplLoading || !newTmplName.trim() || !newTmplBody.trim()}
                  className="px-5 py-2 bg-[#25D366] text-white rounded-lg text-xs font-bold hover:bg-[#1ebe5d] flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {tmplLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>Save & Insert Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Launch Chatbot Flow Modal */}
      {showFlowModal && selectedChat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowFlowModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">
                  🤖
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Launch Chatbot Flow</h3>
                  <p className="text-xs text-gray-500">For {selectedChat.name} (+{selectedChat.id.replace(/\D/g, "")})</p>
                </div>
              </div>
              <button onClick={() => setShowFlowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {flowsLoading ? (
              <div className="py-8 text-center">
                <Loader2 size={24} className="animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading active chatbot flows...</p>
              </div>
            ) : flows.length === 0 ? (
              <div className="py-6 text-center text-gray-500 text-xs">
                <p className="font-bold">No active flows found.</p>
                <p className="mt-1 text-gray-400">Create flows in the Chatbot Flows manager first.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Select Smart Flow to Trigger</label>
                  <select
                    value={selectedFlowId}
                    onChange={(e) => setSelectedFlowId(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-[#25D366]"
                  >
                    <option value="">-- Choose a Flow --</option>
                    {flows.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.status === "active" ? "🟢 Active" : "⚪ Draft"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚡ Instant Auto-Pilot</span>
                  </p>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    The bot will immediately send the entry message with interactive options to this contact and handle their replies dynamically.
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFlowModal(false)}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedFlowId || triggeringFlow}
                    onClick={() => handleTriggerFlowForChat(selectedFlowId)}
                    className="px-5 py-2 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition shadow-md flex items-center gap-1.5"
                  >
                    {triggeringFlow ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{triggeringFlow ? "Starting Flow..." : "Launch Flow Now"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
            <a
              href={lightboxImage.src}
              download={lightboxImage.title || "photo.jpg"}
              className="px-4 py-2 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg"
            >
              <Paperclip size={14} /> Download image
            </a>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <X size={20} />
            </button>
          </div>
          <div className="max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl border border-white/10">
            <img src={lightboxImage.src} alt="Preview" className="w-full h-full object-contain" />
          </div>
          {lightboxImage.title && (
            <p className="text-white/80 text-sm font-semibold mt-3 bg-black/50 px-4 py-1.5 rounded-full border border-white/10">
              {lightboxImage.title}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
