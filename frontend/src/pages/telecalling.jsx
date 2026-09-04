// Updated for RBAC and Creator Attribution
import React, { useState, useEffect, useRef } from "react";
import "../Styles/tailwind.css";
import {
  Search,
  Plus,
  ChevronDown,
  X,
  Trash2,
  Edit,
  FileText,
  History,
  Bell,
  Clock,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import axios from "axios";
import { getToday } from "../utils/leadutil";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";
import socket, { notificationSocket } from "../socket/socket";
import SendWhatsAppReminderModal from "../components/SendWhatsAppReminderModal";

const Telecall = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [remainderDetails, setRemainderDetails] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [customOutcomeInput, setCustomOutcomeInput] = useState("");
  const OUTCOME_OPTIONS = [
    "New",
    "Hot Case",
    "Warm Case",
    "Cold Case",
    "Not Required",
    "Converted",
    "Closed",
    "Billed",
    "Custom",
  ];
  const tabopen = () => {
    setOpen(true);
  };
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);

  // Date Time
  const formatDate = (date) => {
    if (!date) return "---";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Format reminder date — handles both ISO strings and YYYY-MM-DD safely
  const formatReminderDate = (dateStr) => {
    if (!dateStr) return "---";
    const str = dateStr.toString();
    if (str.includes("T")) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
      }
    }
    const parts = str.slice(0, 10).split("-");
    if (parts.length === 3) {
      const y = parts[0];
      const m = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${day} ${months[m - 1]} ${y}`;
    }
    return str;
  };

  // Convert HH:MM or HH:MM:SS → 12-hour AM/PM
  const to12h = (timeStr) => {
    if (!timeStr) return "";
    const [hStr, mStr] = timeStr.toString().split(":");
    const h = parseInt(hStr, 10);
    const m = mStr ? mStr.slice(0, 2).padStart(2, "0") : "00";
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m} ${period}`;
  };

  const [form, setForm] = useState({
    customer_name: "",
    company_name: "",
    mobile_number: "",
    location_city: "",
    call_date: getToday(),
    service_name: "",
    staff_name: "",
    call_outcome: "New",
    followup_required: "Default",
    followup_date: getToday(),
    followup_notes: "",
    reminder_required: "Default",
    reminder_date: getToday(),
    reminder_time: "",
    reminder_notes: "",
    reference: "",
    email: "",
    gst_number: "",
    landline_number: "",
    alternate_mobile_number: "",
    reference_by: "",
    nearest_landmark: "",
  });

  // Background Scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";
    return () => (document.body.style.overflow = "auto");
  }, [open]);

  //

  const [Telecalls, setTelecall] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [onlyReminders, setOnlyReminders] = useState(false);
  const [onlyFollowups, setOnlyFollowups] = useState(false);
  const [todayReminders, setTodayReminders] = useState(false);
  const [todayFollowups, setTodayFollowups] = useState(false);
  const [dateTypeFilter, setDateTypeFilter] = useState("lead_date");
  const [missedCounts, setMissedCounts] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);

  // Quotation prefill modal state
  const [qtPrefill, setQtPrefill] = useState(null);

  // Tabs: "leads" | "history" | "reminders"
  const [activeTab, setActiveTab] = useState("leads");

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState(null);
  const [historyActivity, setHistoryActivity] = useState([]);
  const [historyReminders, setHistoryReminders] = useState([]);
  const [historyFollowups, setHistoryFollowups] = useState([]);

  // Notification state for UI indicator
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const bellRef = useRef(null);

  // Reminder panel
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderLeadId, setReminderLeadId] = useState(null);
  const [reminderLeadName, setReminderLeadName] = useState("");
  const [newReminderDate, setNewReminderDate] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");
  const [newReminderNote, setNewReminderNote] = useState("");
  const [leadReminders, setLeadReminders] = useState([]);

  // Follow-up panel (mirrors the reminder panel)
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [followupLeadName, setFollowupLeadName] = useState("");
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [newFollowupTime, setNewFollowupTime] = useState("");
  const [newFollowupNote, setNewFollowupNote] = useState("");
  const [leadFollowups, setLeadFollowups] = useState([]);
  const [waModal, setWaModal] = useState({ open: false, telecall: null });

  // Fetch all data

  const fetchTelecalls = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API}/api/Telecalls`, config);
      setTelecall(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMissedCounts = async () => {
    try {
      const res = await axios.get(
        `${API}/api/leads/missed-counts/telecall`,
        getAuthConfig(),
      );
      const map = {};
      res.data.forEach((r) => {
        map[r.lead_id] = r.missed_count;
      });
      setMissedCounts(map);
    } catch (_) { }
  };

  useEffect(() => {
    fetchTelecalls();
    fetchMissedCounts();
    axios
      .get(`${API}/api/teammember`, getAuthConfig())
      .then((r) => setTeamMembers(r.data))
      .catch(() => { });
  }, []);

  useEffect(() => {
    const handleDataChanged = () => {
      fetchTelecalls();
      fetchMissedCounts();
    };
    socket.on("data_changed", handleDataChanged);
    return () => {
      socket.off("data_changed", handleDataChanged);
    };
  }, []);

  // ── Desktop Notifications for Reminders ─────────────────────────────
  const sendDesktopNotif = (title, body, tag) => {
    if (!("Notification" in window)) return;
    const fire = () => {
      try {
        new Notification(title, {
          body,
          icon: "/Madhura-logo.png",
          badge: "/Madhura-logo.png",
          tag: tag || `reminder-${Date.now()}`,
          requireInteraction: true,
        });
      } catch (e) {
        console.warn("Notif error:", e);
      }
    };
    if (Notification.permission === "granted") {
      fire();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") fire();
      });
    }
  };

  useEffect(() => {
    const handleReminderDue = (data) => {
      const leadName = data?.customer_name || data?.lead_name || "a lead";
      const minBefore = data?.minutes_before || 5;
      sendDesktopNotif(
        `⏰ Reminder Due in ${minBefore} min`,
        `${leadName} — ${data?.reminder_notes || "No notes"}`,
        `reminder-due-${data?.reminder_id || Date.now()}`,
      );
      const n = {
        id: Date.now(),
        type: "reminder",
        text: `⏰ ${leadName} — ${minBefore} min`,
        ts: Date.now(),
      };
      setRecentNotifs((prev) => [n, ...prev].slice(0, 10));
      setNotifDropdownOpen(true);
      setTimeout(
        () => setRecentNotifs((prev) => prev.filter((x) => x.id !== n.id)),
        10000,
      );
    };

    const handleMissedAlert = (data) => {
      const totalMissed = data?.total_missed || data?.missed_count || 3;
      const userName = data?.employee_name || data?.user_name || "Someone";
      sendDesktopNotif(
        `🚨 Missed ${totalMissed} Reminders`,
        `${userName} has missed ${totalMissed} reminders! Please check.`,
        `missed-alert-${data?.lead_id || Date.now()}`,
      );
      const n = {
        id: Date.now(),
        type: "missed",
        text: `🚨 ${userName} missed ${totalMissed} reminders`,
        ts: Date.now(),
      };
      setRecentNotifs((prev) => [n, ...prev].slice(0, 10));
      setNotifDropdownOpen(true);
      setTimeout(
        () => setRecentNotifs((prev) => prev.filter((x) => x.id !== n.id)),
        20000,
      );
    };

    notificationSocket.on("reminder_due", handleReminderDue);
    notificationSocket.on("missed_reminder_alert", handleMissedAlert);

    // Also request notification permission on mount
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      notificationSocket.off("reminder_due", handleReminderDue);
      notificationSocket.off("missed_reminder_alert", handleMissedAlert);
    };
  }, []);

  // ── Poll check-missed every 60s so missed counts stay fresh ──────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await axios.post(`${API}/api/leads/check-missed`, {}, getAuthConfig());
        fetchMissedCounts();
      } catch (_) { }
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Close notification dropdown on outside click ────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openHistory = async (lead) => {
    setHistoryLead(lead);
    try {
      const [actRes, remRes, folRes] = await Promise.all([
        axios.get(
          `${API}/api/leads/activity/telecall/${lead.id}`,
          getAuthConfig(),
        ),
        axios.get(
          `${API}/api/leads/reminders/telecall/${lead.id}`,
          getAuthConfig(),
        ),
        axios.get(
          `${API}/api/leads/followups/telecall/${lead.id}`,
          getAuthConfig(),
        ),
      ]);
      setHistoryActivity(actRes.data);
      setHistoryReminders(remRes.data);
      setHistoryFollowups(folRes.data);
    } catch (_) { }
    setHistoryOpen(true);
  };

  const openReminderPanel = async (lead) => {
    setReminderLeadId(lead.id);
    setReminderLeadName(lead.customer_name);
    setNewReminderDate("");
    setNewReminderTime("");
    setNewReminderNote("");
    try {
      // Check for missed reminders before showing panel so status is always current
      await axios
        .post(`${API}/api/leads/check-missed`, {}, getAuthConfig())
        .catch(() => { });
      const res = await axios.get(
        `${API}/api/leads/reminders/telecall/${lead.id}`,
        getAuthConfig(),
      );
      setLeadReminders(res.data);
    } catch (_) {
      setLeadReminders([]);
    }
    setReminderOpen(true);
  };

  const saveReminder = async () => {
    if (!newReminderDate) return alert("Please select a date");
    try {
      await axios.post(
        `${API}/api/leads/reminders`,
        {
          lead_id: reminderLeadId,
          lead_type: "telecall",
          reminder_date: newReminderDate,
          reminder_time: newReminderTime || null,
          reminder_notes: newReminderNote,
        },
        getAuthConfig(),
      );
      const res = await axios.get(
        `${API}/api/leads/reminders/telecall/${reminderLeadId}`,
        getAuthConfig(),
      );
      setLeadReminders(res.data);
      fetchMissedCounts();
      setNewReminderDate("");
      setNewReminderTime("");
      setNewReminderNote("");
    } catch (err) {
      alert(
        "Failed to save reminder: " +
        (err.response?.data?.error || err.message),
      );
    }
  };

  const deleteReminder = async (id) => {
    await axios.delete(`${API}/api/leads/reminders/${id}`, getAuthConfig());
    setLeadReminders((prev) => prev.filter((r) => r.id !== id));
    fetchMissedCounts();
  };

  // ── Follow-up panel (mirrors the reminder panel) ──
  const openFollowupPanel = async (lead) => {
    setFollowupLeadId(lead.id);
    setFollowupLeadName(lead.customer_name);
    setNewFollowupDate("");
    setNewFollowupTime("");
    setNewFollowupNote("");
    try {
      const res = await axios.get(
        `${API}/api/leads/followups/telecall/${lead.id}`,
        getAuthConfig(),
      );
      setLeadFollowups(res.data);
    } catch (_) {
      setLeadFollowups([]);
    }
    setFollowupOpen(true);
  };

  const saveFollowup = async () => {
    if (!newFollowupDate) return alert("Please select a date");
    try {
      await axios.post(
        `${API}/api/leads/followups`,
        {
          lead_id: followupLeadId,
          lead_type: "telecall",
          followup_date: newFollowupDate,
          followup_time: newFollowupTime || null,
          followup_notes: newFollowupNote,
        },
        getAuthConfig(),
      );
      // Keep the lead's followup flag in sync so the list badge reflects it
      await axios
        .patch(
          `${API}/api/Telecalls/${followupLeadId}`,
          { followup_required: "Yes", followup_date: newFollowupDate },
          getAuthConfig(),
        )
        .catch(() => { });
      const res = await axios.get(
        `${API}/api/leads/followups/telecall/${followupLeadId}`,
        getAuthConfig(),
      );
      setLeadFollowups(res.data);
      fetchTelecalls();
      setNewFollowupDate("");
      setNewFollowupTime("");
      setNewFollowupNote("");
    } catch (err) {
      alert(
        "Failed to save follow-up: " +
        (err.response?.data?.error || err.message),
      );
    }
  };

  const deleteFollowup = async (id) => {
    await axios.delete(`${API}/api/leads/followups/${id}`, getAuthConfig());
    setLeadFollowups((prev) => prev.filter((f) => f.id !== id));
  };

  // Handle Change

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Save
  const saveTelecall = async (e) => {
    e.preventDefault();
    const today = getToday();

    const payload = {
      ...form,
      call_date: form.call_date || today,
    };

    try {
      if (isEdit) {
        await axios.put(
          `${API}/api/Telecalls/${editId}`,
          payload,
          getAuthConfig(),
        );
        alert("Successfully Updated");
        setForm((prev) => ({
          ...prev,
          followup_required: "Default",
          followup_date: "",
          followup_notes: "",
          reminder_required: "Default",
          reminder_date: "",
          reminder_time: "",
          reminder_notes: "",
        }));
      } else {
        await axios.post(`${API}/api/Telecalls`, payload, getAuthConfig());
        alert("Successfully Created");
      }

      fetchTelecalls();
      window.dispatchEvent(new Event("refresh-dashboard"));
      setOpen(false);
      setIsEdit(false);
      if (["Converted", "Closed", "Billed"].includes(payload.call_outcome)) {
        window.location.href = "/dashboard/clients";
      }
    } catch (err) {
      console.error("Error saving telecall:", err);
      if (err.response?.status === 409) {
        const dups = err.response?.data?.duplicates;
        const details =
          err.response?.data?.details || "This lead already exists.";
        if (dups && dups.length > 0) {
          const dupList = dups
            .map((d) => `• ${d.name} (${d.phone || "N/A"})`)
            .join("\n");
          alert(
            `⚠️ Duplicate Lead Found!\n\n${details}\n\nExisting leads:\n${dupList}\n\nPlease check before creating a new one.`,
          );
        } else {
          alert(`⚠️ ${details}`);
        }
      } else {
        const msg =
          err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          "Failed to save telecall";
        alert(msg);
      }
    }
  };

  // Edit;
  const openEdit = async (id) => {
    try {
      const res = await axios.get(
        `${API}/api/Telecalls/${id}`,
        getAuthConfig(),
      );
      const data = res.data;

      setForm({
        customer_name: data.customer_name || "",
        company_name: data.company_name || "",
        mobile_number: data.mobile_number || "",
        location_city: data.location_city || "",
        call_date: data.call_date || "",
        service_name: data.service_name || "",
        staff_name: data.staff_name || "",
        call_outcome: data.call_outcome || "New",
        followup_required: data.followup_required || "Default",
        followup_date: data.followup_date || "",
        followup_notes: data.followup_notes || "",
        reminder_required: data.reminder_required || "Default",
        reminder_date: data.reminder_date
          ? data.reminder_date.toString().slice(0, 10)
          : "",
        reminder_time: data.reminder_time || "",
        reminder_notes: data.reminder_notes || "",
        reference: data.reference || "",
        email: data.email || "",
        gst_number: data.gst_number || "",
        landline_number: data.landline_number || "",
        alternate_mobile_number: data.alternate_mobile_number || "",
        reference_by: data.reference_by || "",
        nearest_landmark: data.nearest_landmark || "",
      });

      setEditId(id);
      setIsEdit(true);
      setOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to load field data");
    }
  };

  // delete;

  const deletefield = async (id) => {
    try {
      await axios.delete(`${API}/api/Telecalls/${id}`, getAuthConfig());
      fetchTelecalls();
      window.dispatchEvent(new Event("refresh-dashboard"));
    } catch (err) {
      alert("message Deleted", err);
    }
  };

  //
  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    // Clean up when component unmounts
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  const uniqueCreators = Array.from(new Set(Telecalls.map(item => item.creator_name).filter(Boolean)));

  const filteredTelecalls = Telecalls.filter(T => {
    const matchesSearch = T.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || T.company_name?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    let targetDateStr = null;
    if (dateTypeFilter === "lead_date") {
      targetDateStr = T.call_date;
    } else if (dateTypeFilter === "followup_date") {
      targetDateStr = T.followup_date;
    } else if (dateTypeFilter === "reminder_date") {
      targetDateStr = T.reminder_date;
    }

    if (targetDateStr) {
      const cDate = new Date(targetDateStr.toString().split("T")[0]);
      if (startDate) {
        const start = new Date(startDate);
        if (cDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (cDate > end) matchesDate = false;
      }
    } else if (startDate || endDate) {
      matchesDate = false;
    }

    let matchesOutcome = true;
    if (outcomeFilter && outcomeFilter !== "All") {
      matchesOutcome = T.call_outcome === outcomeFilter;
    }

    let matchesCreator = true;
    if (creatorFilter && creatorFilter !== "All") {
      matchesCreator = T.creator_name === creatorFilter;
    }

    let matchesReminders = true;
    if (onlyReminders) {
      matchesReminders = T.reminder_required === "Yes" || T.pending_reminder_count > 0;
    }

    let matchesFollowups = true;
    if (onlyFollowups) {
      matchesFollowups = T.followup_required === "Yes" || T.pending_followup_count > 0;
    }

    let matchesTodayReminders = true;
    if (todayReminders) {
      matchesTodayReminders = 
        (T.reminder_required === "Yes" && T.reminder_date && T.reminder_date.toString().split("T")[0].trim() === getToday())
        || T.today_reminder_count > 0;
    }

    let matchesTodayFollowups = true;
    if (todayFollowups) {
      matchesTodayFollowups = 
        (T.followup_required === "Yes" && T.followup_date && T.followup_date.toString().split("T")[0].trim() === getToday())
        || T.today_followup_count > 0;
    }

    return matchesSearch && matchesDate && matchesOutcome && matchesCreator && matchesReminders && matchesFollowups && matchesTodayReminders && matchesTodayFollowups;
  });

  return (
    <div className="w-full">
      <div className="invoice-heading-tab flex gap-4 justify-between item-center">
        <div>
          <h2 className="text-2xl font-[Times-Roman] text-[25px] font-bold text-[#1694CE]">
            Telecalling Summary
          </h2>
          <a
            className="text-[30px] text-black-500 font-['Times_New_Roman',serif] mr-[110px]"
            href="vii"
          >
            Leed &gt; Telecalling
          </a>
        </div>

        <div className="flex gap-3 items-center">
          {/* Notification Bell */}
          <div className="relative mt-4" ref={bellRef}>
            <button
              onClick={() => setNotifDropdownOpen((prev) => !prev)}
              className="relative p-2 rounded-full hover:bg-amber-50 transition-colors"
              title="Reminder notifications"
            >
              <Bell size={20} className="text-amber-500" />
              {recentNotifs.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {recentNotifs.length}
                </span>
              )}
            </button>
            {notifDropdownOpen && recentNotifs.length > 0 && (
              <div className="absolute right-0 mt-2 w-72 bg-white border rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="flex justify-between items-center px-3 py-2 bg-amber-50 border-b text-xs font-bold text-amber-700 uppercase tracking-wide">
                  <span>Reminder Alerts</span>
                  <button
                    onClick={() => {
                      setRecentNotifs([]);
                      setNotifDropdownOpen(false);
                    }}
                    className="text-amber-500 hover:text-amber-700"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {recentNotifs.map((n) => (
                    <div
                      key={n.id}
                      className={`px-3 py-2.5 text-sm border-b last:border-0 flex items-start gap-2 ${n.type === "missed" ? "bg-red-50" : "bg-amber-50/50"}`}
                    >
                      <span className="text-base flex-shrink-0">
                        {n.type === "missed" ? "🚨" : "⏰"}
                      </span>
                      <span className="text-gray-800">{n.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 bg-gray px-2 py-1 rounded-lg  border w-50 h-9 mt-4">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder="Search by customer name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="Search outline-none text-sm w-full bg-gray-100"
            />
          </div>

          <div className="mt-2">
            <button
              onClick={() => {
                setIsEdit(false);
                setForm({
                  customer_name: "",
                  company_name: "",
                  mobile_number: "",
                  location_city: "",
                  call_date: getToday(),
                  service_name: "",
                  staff_name: "",
                  call_outcome: "New",
                  followup_required: "Default",
                  followup_date: getToday(),
                  followup_notes: "",
                  reminder_required: "Default",
                  reminder_date: getToday(),
                  reminder_time: "",
                  reminder_notes: "",
                  reference: "",
                  gst_number: "",
                  email: "",
                  landline_number: "",
                  alternate_mobile_number: "",
                  reference_by: "",
                  nearest_landmark: "",
                });
                setCustomOutcomeInput("");
                setOpen(true);
              }}
              className="bg-[#FF3355] text-white w-12 h-12 rounded-full flex justify-center items-center shadow-lg hover:bg-[#e62848] "
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-4 flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1 min-w-[150px]">
          <span className="text-xs font-bold text-gray-500 uppercase">Start Date</span>
          <input
            type="date"
            className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <span className="text-xs font-bold text-gray-500 uppercase">End Date</span>
          <input
            type="date"
            className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1 w-[150px] min-w-[150px]">
          <span className="text-xs font-bold text-gray-500 uppercase">Filter Date By</span>
          <select
            className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer"
            value={dateTypeFilter}
            onChange={e => setDateTypeFilter(e.target.value)}
          >
            <option value="lead_date">Lead Date</option>
            <option value="followup_date">Follow-up Date</option>
            <option value="reminder_date">Reminder Date</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 w-[150px] min-w-[150px]">
          <span className="text-xs font-bold text-gray-500 uppercase">Outcome Status</span>
          <select
            className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer"
            value={outcomeFilter}
            onChange={e => setOutcomeFilter(e.target.value)}
          >
            <option value="All">All Outcomes</option>
            {OUTCOME_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {(isAdmin || user?.role === "subadmin") && (
          <div className="flex flex-col gap-1 min-w-[150px] w-[150px]">
            <span className="text-xs font-bold text-gray-500 uppercase">Created By</span>
            <select
              className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer"
              value={creatorFilter}
              onChange={e => setCreatorFilter(e.target.value)}
            >
              <option value="All">All Creators</option>
              {uniqueCreators.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reminders / Followups filters */}
        <div className="flex items-center gap-2 h-10 border rounded-lg px-2 bg-gray-50/50 w-[168px] justify-between">
          <label className="flex items-center gap-1 text-[10px] font-bold text-gray-600 uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyReminders}
              onChange={e => {
                setOnlyReminders(e.target.checked);
                if (e.target.checked) {
                  setTodayReminders(false);
                  setDateTypeFilter("reminder_date");
                } else if (dateTypeFilter === "reminder_date") {
                  setDateTypeFilter("lead_date");
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            Reminders
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-gray-600 uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyFollowups}
              onChange={e => {
                setOnlyFollowups(e.target.checked);
                if (e.target.checked) {
                  setTodayFollowups(false);
                  setDateTypeFilter("followup_date");
                } else if (dateTypeFilter === "followup_date") {
                  setDateTypeFilter("lead_date");
                }
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            Follow-ups
          </label>
        </div>

        {/* Today's Special Click Toggles */}
        <div className="flex items-center gap-2 h-10 border border-blue-200 rounded-lg px-2 bg-blue-50/40 w-[177px] justify-between">
          <label className="flex items-center gap-1 text-[10px] font-bold text-blue-700 uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={todayReminders}
              onChange={e => {
                setTodayReminders(e.target.checked);
                if (e.target.checked) setOnlyReminders(false);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            ⏰ Today's
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold text-blue-700 uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={todayFollowups}
              onChange={e => {
                setTodayFollowups(e.target.checked);
                if (e.target.checked) setOnlyFollowups(false);
              }}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            📞 Today's
          </label>
        </div>

        <button
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setOutcomeFilter("");
            setCreatorFilter("");
            setSearchTerm("");
            setOnlyReminders(false);
            setOnlyFollowups(false);
            setTodayReminders(false);
            setTodayFollowups(false);
            setDateTypeFilter("lead_date");
          }}
          className="ml-auto px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition h-10 flex items-center justify-center gap-1 shadow-sm"
        >
          Reset Filters
        </button>
      </div>

      {/*Form */}
      <div className="application-maintab  p-5">
        <div
          className={`overlay ${open ? "show" : ""} flex justify-center items-start overflow-y-auto p-4 md:p-10 z-50`}
        >
          <div
            className={`task-application bg-white shadow w-full max-w-4xl overflow-y-auto p-6 md:p-8 rounded-xl my-8 z-50  ${open ? "show" : ""
              }`}
          >
            {/*  */}

            <div className="flex justify-between items-center ">
              <h2 className="text-2xl font-semibold mb-8 text-gray-700 mt-[-20px]">
                {isEdit
                  ? "Edit Telecalling Summary"
                  : "Add A Telecalling Summary"}
              </h2>
              <span className="mt-[-20px] x-icon">
                <X onClick={() => setOpen(false)} />
              </span>
            </div>

            <form
              onSubmit={saveTelecall}
              className=" invoice-form p-6 space-y-6 relative"
            >
              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Customer Name <span className="text-red-600">*</span>{" "}
                </label>
                <input
                  type="text"
                  required
                  value={form.customer_name}
                  onChange={handleChange}
                  name="customer_name"
                  placeholder="e.g. Ravi Kumar"
                  onKeyDown={(e) => {
                    if (/[0-9]/.test(e.key)) e.preventDefault();
                  }}
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Company Name
                </label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={handleChange}
                  name="company_name"
                  placeholder="e.g. Acme Corp"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              {/*  */}
              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Mobile Number
                </label>
                <input
                  type="text"
                  value={form.mobile_number}
                  onChange={handleChange}
                  name="mobile_number"
                  maxLength={13}
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (
                      !/[0-9]/.test(e.key) &&
                      ![
                        "Backspace",
                        "Delete",
                        "ArrowLeft",
                        "ArrowRight",
                        "Tab",
                      ].includes(e.key)
                    )
                      e.preventDefault();
                  }}
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm text-gray-600 text-left">
                  Landline Number
                </label>
                <input
                  type="text"
                  value={form.landline_number || ""}
                  onChange={handleChange}
                  name="landline_number"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm text-gray-600 text-left">
                  Alternate Mobile Number
                </label>
                <input
                  type="text"
                  value={form.alternate_mobile_number || ""}
                  onChange={handleChange}
                  name="alternate_mobile_number"
                  maxLength={13}
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (
                      !/[0-9]/.test(e.key) &&
                      ![
                        "Backspace",
                        "Delete",
                        "ArrowLeft",
                        "ArrowRight",
                        "Tab",
                      ].includes(e.key)
                    )
                      e.preventDefault();
                  }}
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              {/*  */}

              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Location / City
                </label>
                <input
                  type="text"
                  value={form.location_city}
                  onChange={handleChange}
                  name="location_city"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm text-gray-600 text-left">
                  Nearest Landmark
                </label>
                <input
                  type="text"
                  value={form.nearest_landmark || ""}
                  onChange={handleChange}
                  name="nearest_landmark"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              {/*  */}

              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Call Date
                </label>
                <input
                  type="Date"
                  readOnly
                  value={form.call_date}
                  onChange={handleChange}
                  name="call_date"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Description
                </label>
                <input
                  type="text"
                  value={form.service_name}
                  onChange={handleChange}
                  name="service_name"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Assigned Staff
                </label>
                <div className="col-span-3">
                  <select
                    value={form.staff_name}
                    onChange={handleChange}
                    name="staff_name"
                    className="border rounded-md px-3 py-2 outline-none bg-white w-full text-sm"
                  >
                    <option value="">-- Select Staff --</option>
                    {teamMembers.map((t) => {
                      const fullName = `${t.first_name} ${t.last_name || ""}`.trim();
                      return (
                        <option key={t.id} value={fullName}>
                          {fullName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Purpose of call
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={handleChange}
                  name="reference"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label htmlFor="" className="text-sm text-gray-600 text-left">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  name="email"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm text-gray-600 text-left">
                  Reference By
                </label>
                <input
                  type="text"
                  value={form.reference_by || ""}
                  onChange={handleChange}
                  name="reference_by"
                  className="col-span-3 border rounded-md px-3 py-2 outline-none bg-white w-[100%]"
                />
              </div>

              {/*Call outcome  */}

              <div className="grid grid-cols-4 items-center gap-6">
                <label className="text-sm text-gray-600 text-left">
                  Call Outcome <span className="text-red-500">*</span>
                </label>
                <div className="relative col-span-3">
                  {/* INPUT */}
                  <input
                    type="text"
                    readOnly
                    value={form.call_outcome}
                    name="call_outcome"
                    placeholder="Select Outcome"
                    onClick={() => setOutcomeOpen(!outcomeOpen)}
                    className="border rounded-md px-3 py-2 outline-none w-full cursor-pointer "
                  />

                  {/* ICON */}
                  <ChevronDown
                    size={18}
                    className={`absolute top-3.5 right-4 cursor-pointer transition-transform duration-300 ${outcomeOpen ? "rotate-180" : ""
                      }`}
                    onClick={() => setOutcomeOpen(!outcomeOpen)}
                  />

                  {/* DROPDOWN OPTIONS */}
                  {outcomeOpen && (
                    <div className="absolute left-0 right-0 bg-white border rounded-md mt-1 shadow-lg z-20">
                      {OUTCOME_OPTIONS.map((outcome) => (
                        <div
                          key={outcome}
                          onClick={() => {
                            if (outcome === "Custom") {
                              setCustomOutcomeInput("");
                            }
                            setForm({ ...form, call_outcome: outcome });
                            setOutcomeOpen(false);
                          }}
                          className="px-3 py-2 cursor-pointer hover:bg-blue-600 hover:text-white text-left"
                        >
                          {outcome}
                        </div>
                      ))}
                    </div>
                  )}
                  {form.call_outcome === "Custom" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={customOutcomeInput}
                        onChange={(e) => {
                          setCustomOutcomeInput(e.target.value);
                          setForm({ ...form, call_outcome: e.target.value });
                        }}
                        placeholder="Enter custom outcome..."
                        className="border rounded-md px-3 py-2 outline-none w-full bg-white text-sm"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Follow-up & Reminder ── */}
              {/* <div className="border-t pt-4 mt-2">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-gray-700">
                    Follow-up & Reminder
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={showMoreDetails}
                      onChange={() => setShowMoreDetails(!showMoreDetails)}
                    />
                    <div className="w-10 h-5 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:h-4 after:w-4 after:rounded-full after:transition peer-checked:after:translate-x-5"></div>
                  </label>
                </div>

                {showMoreDetails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                          Follow-up
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Required
                          </label>
                          <div className="relative mt-1">
                            <input
                              type="text"
                              readOnly
                              value={form.followup_required}
                              onClick={() => setFollowOpen(!followOpen)}
                              className="border rounded-lg px-3 py-2 outline-none w-full cursor-pointer bg-white text-sm"
                            />
                            <ChevronDown
                              size={15}
                              className={`absolute top-3 right-3 cursor-pointer transition-transform ${followOpen ? "rotate-180" : ""}`}
                              onClick={() => setFollowOpen(!followOpen)}
                            />
                            {followOpen && (
                              <div className="absolute left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20">
                                {["Yes", "No"].map((o) => (
                                  <div
                                    key={o}
                                    onClick={() => {
                                      setForm({
                                        ...form,
                                        followup_required: o,
                                      });
                                      setFollowOpen(false);
                                    }}
                                    className="px-3 py-2 cursor-pointer hover:bg-blue-600 hover:text-white text-sm"
                                  >
                                    {o}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Date
                          </label>
                          <input
                            type="date"
                            value={form.followup_date}
                            onChange={handleChange}
                            name="followup_date"
                            className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Notes
                          </label>
                          <textarea
                            value={form.followup_notes}
                            onChange={handleChange}
                            name="followup_notes"
                            rows={2}
                            placeholder="Follow-up notes..."
                            className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm mt-1 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border border-yellow-200 rounded-xl p-4 bg-yellow-50/40">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                        <span className="text-xs font-bold text-yellow-700 uppercase tracking-wide">
                          Reminder
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Required
                          </label>
                          <div className="relative mt-1">
                            <input
                              type="text"
                              readOnly
                              value={form.reminder_required}
                              onClick={() =>
                                setRemainderDetails(!remainderDetails)
                              }
                              className="border rounded-lg px-3 py-2 outline-none w-full cursor-pointer bg-white text-sm"
                            />
                            <ChevronDown
                              size={15}
                              className={`absolute top-3 right-3 cursor-pointer transition-transform ${remainderDetails ? "rotate-180" : ""}`}
                              onClick={() =>
                                setRemainderDetails(!remainderDetails)
                              }
                            />
                            {remainderDetails && (
                              <div className="absolute left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg z-20">
                                {["Yes", "No"].map((o) => (
                                  <div
                                    key={o}
                                    onClick={() => {
                                      setForm({
                                        ...form,
                                        reminder_required: o,
                                      });
                                      setRemainderDetails(false);
                                    }}
                                    className="px-3 py-2 cursor-pointer hover:bg-yellow-500 hover:text-white text-sm"
                                  >
                                    {o}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Date
                          </label>
                          <input
                            type="date"
                            value={form.reminder_date}
                            onChange={handleChange}
                            name="reminder_date"
                            className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            ⏰ Time{" "}
                            <span className="text-yellow-600 font-bold">
                              (Required for pre-warning)
                            </span>
                          </label>
                          <input
                            type="time"
                            value={form.reminder_time}
                            onChange={handleChange}
                            name="reminder_time"
                            className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm mt-1"
                          />
                          {form.reminder_time && (
                            <p className="text-xs text-yellow-700 font-semibold mt-1 flex items-center gap-1">
                              🔔 Reminder set for{" "}
                              <span className="bg-yellow-100 px-1.5 py-0.5 rounded font-bold">
                                {to12h(form.reminder_time)}
                              </span>{" "}
                              — you'll be notified 10 min &amp; 5 min before
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500">
                            Notes
                          </label>
                          <textarea
                            value={form.reminder_notes}
                            onChange={handleChange}
                            name="reminder_notes"
                            rows={2}
                            placeholder="Reminder notes..."
                            className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm mt-1 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div> */}

              {/* submit and  close */}
              <div className="flex flex-wrap gap-3 pt-4 more2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Submit
                </button>
                <button
                  type="button"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
                  onClick={() => {
                    sessionStorage.setItem(
                      "qt_prefill",
                      JSON.stringify({
                        customer_name: form.customer_name,
                        company_name: form.company_name,
                        mobile_number: form.mobile_number,
                        email: form.email || "",
                        location_city: form.location_city,
                        lead_id: editId || null,
                        lead_type: "telecall",
                      }),
                    );
                    sessionStorage.setItem("qt_prefill_tab", "quotation");
                    window.location.href = "/dashboard/proposal";
                  }}
                >
                  <FileText size={15} /> Create Quotation
                </button>
                <button
                  type="button"
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm"
                  onClick={() => {
                    sessionStorage.setItem(
                      "qt_prefill",
                      JSON.stringify({
                        customer_name: form.customer_name,
                        company_name: form.company_name,
                        mobile_number: form.mobile_number,
                        email: form.email || "",
                        location_city: form.location_city,
                        lead_id: editId || null,
                        lead_type: "telecall",
                      }),
                    );
                    sessionStorage.setItem("qt_prefill_tab", "service");
                    window.location.href = "/dashboard/proposal";
                  }}
                >
                  <FileText size={15} /> Service Estimation
                </button>
                <button
                  type="button"
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 flex items-center gap-2 text-sm"
                  onClick={() => {
                    sessionStorage.setItem(
                      "qt_prefill",
                      JSON.stringify({
                        customer_name: form.customer_name,
                        company_name: form.company_name,
                        mobile_number: form.mobile_number,
                        email: form.email || "",
                        location_city: form.location_city,
                        lead_id: editId || null,
                        lead_type: "telecall",
                      }),
                    );
                    sessionStorage.setItem("qt_prefill_tab", "proforma");
                    window.location.href = "/dashboard/proposal";
                  }}
                >
                  <FileText size={15} /> Proforma Invoice
                </button>
                <button
                  type="button"
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 flex items-center gap-2 text-sm"
                  onClick={() => {
                    sessionStorage.setItem(
                      "contract_prefill",
                      JSON.stringify({
                        customer_name: form.customer_name,
                        company_name: form.company_name,
                        mobile_number: form.mobile_number,
                        email: form.email || "",
                        location_city: form.location_city,
                        lead_id: editId || null,
                        lead_type: "telecall",
                      }),
                    );
                    window.location.href = "/dashboard/amc";
                  }}
                >
                  <FileText size={15} /> Create Contract
                </button>
                <button
                  onClick={() => setOpen(false)}
                  type="button"
                  className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-red-500"
                >
                  Close
                </button>
              </div>

            </form>
          </div>

          {/*Table  */}
        </div>
        <div className="bg-white shadow rounded-xl overflow-x-auto mt-5 ">
          <table className="w-full min-w-[900px] text-sm border border-gray-300">
            <thead className="bg-[#f8faf9]">
              <tr className="text-black font-[Times-New-Roman] uppercase text-xs ">
                <th className="border px-4 py-3 w-[50px] text-center">ID</th>
                <th className="border px-4 py-3">Customer Name</th>
                <th className="border px-4 py-3">Company Name</th>
                <th className="border px-4 py-3">Mobile Number</th>
                <th className="border px-4 py-3">Reference By</th>
                <th className="border px-4 py-3 w-[140px]">Call Date</th>
                <th className="border px-4 py-3">Staff</th>
                {(isAdmin || user?.role === "subadmin") && (
                  <th className="border px-4 py-3">Created By</th>
                )}
                <th className="border px-4 py-3">Status</th>
                <th className="border px-4 py-3 w-[130px] text-center">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="text-sm font-[Times-New-Roman] text-center">
              {filteredTelecalls.map((T) => {
                const statusColors = {
                  New: "bg-gray-100 text-gray-700",
                  "Hot Case": "bg-red-100 text-red-700",
                  "Warm Case": "bg-orange-100 text-orange-700",
                  "Cold Case": "bg-blue-100 text-blue-700",
                  "Not Required": "bg-gray-200 text-gray-500",
                  Converted: "bg-green-100 text-green-700",
                  Closed: "bg-purple-100 text-purple-700",
                  Billed: "bg-emerald-100 text-emerald-700",
                };
                const missed = missedCounts[T.id] || 0;
                return (
                  <tr
                    key={T.id}
                    className="hover:bg-gray-100 hover:text-black transition"
                  >
                    <td className="border px-4 py-2 text-center">{T.id}</td>
                    <td className="border px-4 py-2 text-left font-medium">
                      {T.customer_name}
                    </td>
                    <td className="border px-4 py-2 text-left font-medium">
                      {T.company_name || "---"}
                    </td>
                    <td className="border px-4 py-2 whitespace-nowrap">
                      {T.mobile_number}
                    </td>
                    <td className="border px-4 py-2">
                      {T.reference_by || "---"}
                    </td>
                    <td className="border px-4 py-2">
                      {formatDate(T.call_date)}
                    </td>
                    <td className="border px-4 py-2">
                      {T.staff_name || "---"}
                    </td>
                    {(isAdmin || user?.role === "subadmin") && (
                      <td className="border px-4 py-2">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Added By
                          </span>
                          <span className="text-xs font-semibold text-blue-600">
                            {T.created_by === user?.id
                              ? "Me"
                              : T.creator_name || "Admin"}
                          </span>
                        </div>
                      </td>
                    )}

                    <td className="border px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[T.call_outcome] || "bg-gray-100 text-gray-600"}`}
                      >
                        {T.call_outcome}
                      </span>
                    </td>
                    <td className="border px-4 py-2 text-center">
                      <div className="flex justify-center gap-2 items-center">
                        <a
                          href={`https://wa.me/91${(T.mobile_number || "").replace(/\D/g, "").slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Chat on WhatsApp"
                          className="text-[#25D366] hover:text-[#1ebe5d] p-1.5 rounded-lg hover:bg-green-50 transition-all"
                        >
                          <MessageCircle size={16} />
                        </a>
                        <button
                          type="button"
                          onClick={() => setWaModal({ open: true, telecall: T })}
                          title="Send 2-Way Interactive WhatsApp Confirmation"
                          className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-50 transition-all"
                        >
                          <Sparkles size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openReminderPanel(T)}
                          title="Reminders"
                          className="relative text-yellow-500 hover:text-yellow-700 p-1.5 rounded-lg hover:bg-yellow-50 transition-all"
                        >
                          <Bell size={16} />
                          {missed > 0 && (
                            <span
                              className={`absolute -top-1.5 -right-1.5 text-[9px] font-black px-1 rounded-full text-white ${missed >= 3 ? "bg-red-600" : "bg-orange-500"}`}
                            >
                              {missed}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openFollowupPanel(T)}
                          title="Follow-ups"
                          className={`p-1.5 rounded-lg transition-all ${T.followup_required === "Yes"
                            ? "text-green-600 bg-green-50 hover:text-green-800 hover:bg-green-100"
                            : "text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            }`}
                        >
                          <Clock size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(T.id)}
                          title="Edit"
                          className="text-green-600 hover:text-green-800 p-1.5 rounded-lg hover:bg-green-50 transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => deletefield(T.id)}
                            title="Delete"
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTelecalls.length === 0 && (
                <tr>
                  <td
                    colSpan={(isAdmin || user?.role === "subadmin") ? 9 : 8}
                    className="py-10 text-gray-400 italic text-center"
                  >
                    No telecalling records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── History Modal ─────────────────────────────────────────────── */}
      {historyOpen && historyLead && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-2xl p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <History size={18} className="text-indigo-500" /> Lead History
                </h2>
                <p className="text-sm text-indigo-600 font-semibold">
                  {historyLead.customer_name} · {historyLead.mobile_number}
                </p>
              </div>
              <X
                className="cursor-pointer text-gray-400 hover:text-red-500"
                onClick={() => setHistoryOpen(false)}
              />
            </div>

            {/* Lead Info Card */}
            <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-xl p-4 mb-5 border">
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Status
                </span>
                <div className="mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${historyLead.call_outcome === "Hot Case"
                      ? "bg-red-100 text-red-700"
                      : historyLead.call_outcome === "Warm Case"
                        ? "bg-orange-100 text-orange-700"
                        : historyLead.call_outcome === "Cold Case"
                          ? "bg-blue-100 text-blue-700"
                          : historyLead.call_outcome === "Converted"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                  >
                    {historyLead.call_outcome}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Company Name
                </span>
                <div className="mt-0.5 font-medium">
                  {historyLead.company_name || "---"}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Staff
                </span>
                <div className="mt-0.5 font-medium">
                  {historyLead.staff_name || "---"}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Service
                </span>
                <div className="mt-0.5">
                  {historyLead.service_name || "---"}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  City
                </span>
                <div className="mt-0.5">
                  {historyLead.location_city || "---"}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Reference
                </span>
                <div className="mt-0.5">{historyLead.reference || "---"}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Landline No
                </span>
                <div className="mt-0.5">{historyLead.landline_number || "---"}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Alt Mobile No
                </span>
                <div className="mt-0.5">{historyLead.alternate_mobile_number || "---"}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Landmark
                </span>
                <div className="mt-0.5">{historyLead.nearest_landmark || "---"}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Reference By
                </span>
                <div className="mt-0.5">{historyLead.reference_by || "---"}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs font-semibold uppercase">
                  Call Date
                </span>
                <div className="mt-0.5">
                  {formatDate(historyLead.call_date)}
                </div>
              </div>
            </div>

            {/* Reminder Log */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Bell size={13} className="text-yellow-500" /> Reminder Log
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {historyReminders.length}
                </span>
              </h3>
              {historyReminders.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg p-3">
                  No reminders set for this lead.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyReminders.map((r, idx) => (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${r.status === "Missed"
                        ? "bg-red-50 border-red-200"
                        : r.status === "Done"
                          ? "bg-green-50 border-green-200"
                          : "bg-blue-50 border-blue-200"
                        }`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gray-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {formatReminderDate(r.reminder_date)}
                          {r.reminder_time
                            ? ` · ${to12h(r.reminder_time)}`
                            : ""}
                        </div>
                        {r.reminder_notes && (
                          <div className="text-gray-500 text-xs mt-0.5">
                            {r.reminder_notes}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${r.status === "Missed"
                          ? "bg-red-600 text-white"
                          : r.status === "Done"
                            ? "bg-green-600 text-white"
                            : "bg-blue-600 text-white"
                          }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Follow-up Log */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock size={13} className="text-blue-500" /> Follow-up Log
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {historyFollowups.length}
                </span>
              </h3>
              {historyFollowups.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg p-3">
                  No follow-ups set for this lead.
                </p>
              ) : (
                <div className="space-y-2">
                  {historyFollowups.map((f, idx) => (
                    <div
                      key={f.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${f.status === "Done" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-blue-400">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {formatReminderDate(f.followup_date)}
                          {f.followup_time
                            ? ` · ${to12h(f.followup_time)}`
                            : ""}
                        </div>
                        {f.followup_notes && (
                          <div className="text-gray-500 text-xs mt-0.5">
                            {f.followup_notes}
                          </div>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${f.status === "Done" ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}
                      >
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Clock size={13} className="text-blue-500" /> Activity Timeline
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                  {historyActivity.length}
                </span>
              </h3>
              {historyActivity.length === 0 ? (
                <p className="text-xs text-gray-400 italic bg-gray-50 rounded-lg p-3">
                  No activity recorded.
                </p>
              ) : (
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-3 pl-8">
                    {historyActivity.map((a) => {
                      const actionColor =
                        a.action === "Lead Created"
                          ? "bg-green-500"
                          : a.action === "Status Updated"
                            ? "bg-blue-500"
                            : a.action === "Follow-up Scheduled"
                              ? "bg-indigo-500"
                              : a.action === "Reminder Added"
                                ? "bg-yellow-500"
                                : a.action === "Reminder Created"
                                  ? "bg-yellow-500"
                                  : "bg-gray-400";
                      return (
                        <div key={a.id} className="relative">
                          <div
                            className={`absolute -left-5 w-3 h-3 rounded-full ${actionColor} border-2 border-white`}
                          ></div>
                          <div className="bg-gray-50 rounded-lg p-3 border">
                            <div className="flex justify-between items-start">
                              <span className="font-semibold text-sm text-gray-800">
                                {a.action}
                              </span>
                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                                {new Date(a.created_at).toLocaleString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            {a.details && (
                              <p className="text-xs text-gray-500 mt-1">
                                {a.details}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reminder Panel ─────────────────────────────────────────────── */}
      {reminderOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Bell size={18} className="text-yellow-500" /> Reminders —{" "}
                {reminderLeadName}
              </h2>
              <X
                className="cursor-pointer text-gray-400 hover:text-red-500"
                onClick={() => setReminderOpen(false)}
              />
            </div>

            {/* Add new reminder */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">
                Set New Reminder
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={newReminderDate}
                    onChange={(e) => setNewReminderDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                  />
                  {newReminderTime && (
                    <p className="text-xs text-yellow-700 font-semibold mt-1">
                      🔔{" "}
                      <span className="bg-yellow-100 px-1.5 py-0.5 rounded font-bold">
                        {to12h(newReminderTime)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">
                  Note
                </label>
                <input
                  type="text"
                  value={newReminderNote}
                  onChange={(e) => setNewReminderNote(e.target.value)}
                  placeholder="e.g. Call back about pricing"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                />
              </div>
              <button
                onClick={saveReminder}
                className="w-full bg-yellow-500 text-white py-2 rounded-lg font-bold hover:bg-yellow-600 text-sm"
              >
                + Add Reminder
              </button>
            </div>

            {/* Existing reminders */}
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              Existing Reminders
            </p>
            {leadReminders.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No reminders yet.</p>
            ) : (
              <div className="space-y-2">
                {leadReminders.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm ${r.status === "Missed" ? "bg-red-50 border-red-200" : r.status === "Done" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
                  >
                    <div>
                      <div className="font-semibold">
                        {formatReminderDate(r.reminder_date)}
                        {r.reminder_time ? ` at ${to12h(r.reminder_time)}` : ""}
                      </div>
                      {r.reminder_notes && (
                        <div className="text-gray-500 text-xs mt-0.5">
                          {r.reminder_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.status === "Missed" ? "bg-red-600 text-white" : r.status === "Done" ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}
                      >
                        {r.status}
                      </span>
                      {r.status === "Pending" && (
                        <button
                          onClick={() => {
                            axios.put(
                              `${API}/api/leads/reminders/${r.id}`,
                              { status: "Done" },
                              getAuthConfig(),
                            );
                            setLeadReminders((prev) =>
                              prev.map((x) =>
                                x.id === r.id ? { ...x, status: "Done" } : x,
                              ),
                            );
                          }}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold"
                        >
                          Done
                        </button>
                      )}
                      <button
                        onClick={() => deleteReminder(r.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Follow-up Panel ────────────────────────────────────────────── */}
      {followupOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Clock size={18} className="text-blue-500" /> Follow-ups —{" "}
                {followupLeadName}
              </h2>
              <X
                className="cursor-pointer text-gray-400 hover:text-red-500"
                onClick={() => setFollowupOpen(false)}
              />
            </div>

            {/* Add new follow-up */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">
                Set New Follow-up
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-semibold">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={newFollowupDate}
                    onChange={(e) => setNewFollowupDate(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold">
                    Time
                  </label>
                  <input
                    type="time"
                    value={newFollowupTime}
                    onChange={(e) => setNewFollowupTime(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                  />
                  {newFollowupTime && (
                    <p className="text-xs text-blue-700 font-semibold mt-1">
                      📞{" "}
                      <span className="bg-blue-100 px-1.5 py-0.5 rounded font-bold">
                        {to12h(newFollowupTime)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">
                  Reason / Note
                </label>
                <input
                  type="text"
                  value={newFollowupNote}
                  onChange={(e) => setNewFollowupNote(e.target.value)}
                  placeholder="e.g. Send revised quotation"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1"
                />
              </div>
              <button
                onClick={saveFollowup}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 text-sm"
              >
                + Add Follow-up
              </button>
            </div>

            {/* Existing follow-ups */}
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              Existing Follow-ups
            </p>
            {leadFollowups.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No follow-ups yet.</p>
            ) : (
              <div className="space-y-2">
                {leadFollowups.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm ${f.status === "Done" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
                  >
                    <div>
                      <div className="font-semibold">
                        {formatReminderDate(f.followup_date)}
                        {f.followup_time ? ` at ${to12h(f.followup_time)}` : ""}
                      </div>
                      {f.followup_notes && (
                        <div className="text-gray-500 text-xs mt-0.5">
                          {f.followup_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.status === "Done" ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}
                      >
                        {f.status}
                      </span>
                      {f.status === "Pending" && (
                        <button
                          onClick={() => {
                            axios.put(
                              `${API}/api/leads/followups/${f.id}`,
                              { status: "Done" },
                              getAuthConfig(),
                            );
                            setLeadFollowups((prev) =>
                              prev.map((x) =>
                                x.id === f.id ? { ...x, status: "Done" } : x,
                              ),
                            );
                          }}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold"
                        >
                          Done
                        </button>
                      )}
                      <button
                        onClick={() => deleteFollowup(f.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 1-Click WhatsApp Interactive Appointment / Visit Reminder Modal */}
      {waModal.open && (
        <SendWhatsAppReminderModal
          isOpen={waModal.open}
          onClose={() => setWaModal({ open: false, telecall: null })}
          defaultPhone={waModal.telecall?.mobile_number || ""}
          defaultContactName={waModal.telecall?.customer_name || "Customer"}
          reminderType="appointment_reminder"
          refTable="telecalls"
          refId={waModal.telecall?.id}
          refTitle={`Service: ${waModal.telecall?.service_name || "Appointment Visit"} (${waModal.telecall?.customer_name || ""})`}
        />
      )}
    </div>
  );
};
export default Telecall;
