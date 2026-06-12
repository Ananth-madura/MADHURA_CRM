import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, MapPin, Lock, Save, X, Eye, EyeOff, Clock, CheckCircle, XCircle, Settings, ToggleLeft, ToggleRight, CheckSquare, Sparkles, Server } from "lucide-react";
import SMTPConfigPrompt from "../components/SMTPConfigPrompt";
import socket from "../socket/socket";

import { API } from "../config/api";

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [profile, setProfile] = useState({
    first_name: "",
    email: "",
    role: "",
    status: "",
    created_at: "",
    job_title: "",
    emp_role: "",
    mobile_number: "",
    emp_address: ""
  });
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeField, setChangeField] = useState("");
  const [changeValue, setChangeValue] = useState("");
  const [passwordData, setPasswordData] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showSMTPPrompt, setShowSMTPPrompt] = useState(false);
  const [smtpData, setSmtpData] = useState(() => {
    try {
      const local = localStorage.getItem("user_smtp_config");
      if (local) {
        const parsed = JSON.parse(local);
        return {
          email_user: parsed.email_user || "",
          email_pass: parsed.email_pass || "",
          smtp_host: parsed.smtp_host || "smtp.gmail.com",
          smtp_port: parsed.smtp_port || "465",
          smtp_secure: parsed.smtp_secure || "true",
          from_email_address: parsed.from_email_address || "",
          sender_name: parsed.sender_name || "",
          provider: parsed.provider || "google",
          is_enabled: parsed.is_enabled === 1 || parsed.is_enabled === true
        };
      }
    } catch (_) {}
    return {
      email_user: "",
      email_pass: "",
      smtp_host: "smtp.gmail.com",
      smtp_port: "465",
      smtp_secure: "true",
      from_email_address: "",
      sender_name: "",
      provider: "google",
      is_enabled: true
    };
  });
  const [hasSMTP, setHasSMTP] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchChangeRequests();
    fetchSMTPConfig();

    if (socket) {
      socket.on("profile_change_response", () => {
        fetchChangeRequests();
        fetchProfile();
      });
    }
    return () => {
      if (socket) socket.off("profile_change_response");
    };
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
      setEditData(res.data);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  };

  const fetchChangeRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/my-change-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingRequests(res.data);
    } catch (err) {
      console.error("Fetch requests error:", err);
    }
  };

  const requestProfileChange = async () => {
    if (!changeValue.trim()) {
      setMessage({ type: "error", text: "Value is required" });
      return;
    }

    if (changeField === "password") {
      if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
        setMessage({ type: "error", text: "All password fields are required" });
        return;
      }
      if (passwordData.new_password !== passwordData.confirm_password) {
        setMessage({ type: "error", text: "New passwords do not match" });
        return;
      }
      if (passwordData.new_password.length < 6) {
        setMessage({ type: "error", text: "Password must be at least 6 characters" });
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        field: changeField,
        new_value: changeField === "password" ? passwordData.new_password : changeValue,
        current_password: changeField === "password" ? passwordData.current_password : null
      };

      await axios.post(`${API}/api/auth/request-profile-change`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ type: "success", text: "Change request submitted. Waiting for admin approval." });
      setShowChangeModal(false);
      setChangeField("");
      setChangeValue("");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
      fetchChangeRequests();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to submit change request" });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editData.first_name?.trim()) {
      setMessage({ type: "error", text: "Name is required" });
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/api/auth/profile`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: "success", text: "Profile updated successfully" });
      setProfile(editData);
      setEditMode(false);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update profile" });
    } finally {
      setSaving(false);
    }
  };

  const fetchSMTPConfig = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API}/api/auth/check-email-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.hasConfig) {
        setHasSMTP(true);
        const config = {
          email_user: res.data.config.email_user || "",
          email_pass: "••••••••••••••••",
          smtp_host: res.data.config.smtp_host || "smtp.gmail.com",
          smtp_port: String(res.data.config.smtp_port || 465),
          smtp_secure: res.data.config.smtp_secure || "true",
          from_email_address: res.data.config.from_email_address || "",
          sender_name: res.data.config.sender_name || "",
          provider: res.data.config.provider || "google",
          is_enabled: res.data.config.is_enabled === 1 || res.data.config.is_enabled === true
        };
        setSmtpData(config);
        localStorage.setItem("user_smtp_config", JSON.stringify({ ...config, email_pass: res.data.config.email_pass || "••••••••••••••••" }));
      }
    } catch (err) {
      console.error("Failed to load SMTP config:", err);
    }
  };

  const handleSMTPToggle = async (newVal) => {
    setSmtpLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/auth/save-email-config`, {
        email_user: smtpData.email_user,
        email_pass: "••••••••••••••••", // Handled as fallback in backend
        smtp_host: smtpData.smtp_host,
        smtp_port: parseInt(smtpData.smtp_port) || 465,
        smtp_secure: smtpData.smtp_secure,
        from_email_address: smtpData.from_email_address,
        sender_name: smtpData.sender_name,
        provider: smtpData.provider,
        is_enabled: newVal
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: "success", text: `SMTP outgoing service successfully ${newVal ? 'enabled' : 'disabled'}!` });
      fetchSMTPConfig();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to toggle SMTP status" });
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleAdminPasswordChange = async () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      setMessage({ type: "error", text: "All fields are required" });
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (passwordData.new_password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters" });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/auth/change-password-direct`, {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: "success", text: "Password updated successfully" });
      setShowPasswordModal(false);
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to update password" });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setChangeField("password");
    setShowChangeModal(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const getRoleBadge = (role) => {
    const colors = {
      admin: "bg-purple-100 text-purple-700",
      subadmin: "bg-orange-100 text-orange-700",
      employee: "bg-blue-100 text-blue-700"
    };
    return colors[role] || "bg-gray-100 text-gray-700";
  };

  const getStatusBadge = (status) => {
    const colors = { active: "bg-green-100 text-green-700", pending: "bg-yellow-100 text-yellow-700", rejected: "bg-red-100 text-red-700", banned: "bg-red-100 text-red-700" };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const getRequestStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <span className="flex items-center gap-1 text-yellow-600"><Clock size={14} /> Pending</span>;
      case "approved":
        return <span className="flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Approved</span>;
      case "declined":
        return <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> Declined</span>;
      default:
        return status;
    }
  };

  const getFieldLabel = (field) => {
    switch (field) {
      case "first_name": return "Name";
      case "email": return "Email";
      case "mobile_number": return "Mobile Number";
      case "emp_address": return "Address";
      case "password": return "Password";
      default: return field;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message.text}
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">Your Change Requests</h4>
          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-white p-2 rounded">
                <span className="text-sm">{getFieldLabel(req.field)} change</span>
                {getRequestStatusBadge(req.status)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <User size={32} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{profile.first_name || "User"}</h2>
                <p className="text-blue-100 text-sm">{profile.email}</p>
              </div>
            </div>
             <div className="flex gap-2">
               <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(profile.email === 'malarvannan@technostore.co.in' ? 'subadmin' : profile.role)}`}>
                 {profile.email === 'malarvannan@technostore.co.in' ? 'subadmin' : profile.role}
               </span>
               <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(profile.status)}`}>
                 {profile.status}
               </span>
             </div>
          </div>
        </div>

        <div className="p-6">
          {isAdmin ? (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Profile Information</h3>
              {!editMode ? (
                <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center gap-2">
                  <User size={16} /> Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setEditMode(false); setEditData(profile); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm flex items-center gap-2">
                    <X size={16} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center gap-2">
                    <Save size={16} /> {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800">Profile Information</h3>
              <div className="flex gap-2">
                <button onClick={() => { setChangeField("first_name"); setChangeValue(profile.first_name || ""); setShowChangeModal(true); }} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center gap-2">
                  <User size={16} /> Request Name Change
                </button>
                <button onClick={handlePasswordChange} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm flex items-center gap-2">
                  <Lock size={16} /> Change Password
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Full Name</p>
                  {editMode ? (
                    <input type="text" value={editData.first_name || ""} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" />
                  ) : (
                    <p className="font-medium text-gray-800">{profile.first_name || "Not set"}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Email Address</p>
                  <p className="font-medium text-gray-800">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Phone size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Mobile Number</p>
                  {editMode ? (
                    <input type="tel" value={editData.mobile_number || ""} onChange={(e) => setEditData({ ...editData, mobile_number: e.target.value })} className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" placeholder="Enter mobile number" />
                  ) : isAdmin ? (
                    <p className="font-medium text-gray-800">{profile.mobile_number || "Not set"}</p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-800">{profile.mobile_number || "Not set"}</p>
                      <button onClick={() => { setChangeField("mobile_number"); setChangeValue(profile.mobile_number || ""); setShowChangeModal(true); }} className="text-xs text-blue-500 hover:underline">Request Change</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Address</p>
                  {editMode ? (
                    <input type="text" value={editData.emp_address || ""} onChange={(e) => setEditData({ ...editData, emp_address: e.target.value })} className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" placeholder="Enter address" />
                  ) : isAdmin ? (
                    <p className="font-medium text-gray-800">{profile.emp_address || "Not set"}</p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-800">{profile.emp_address || "Not set"}</p>
                      <button onClick={() => { setChangeField("emp_address"); setChangeValue(profile.emp_address || ""); setShowChangeModal(true); }} className="text-xs text-blue-500 hover:underline">Request Change</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-500">{profile.job_title?.[0] || "?"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Job Title</p>
                  <p className="font-medium text-gray-800">{profile.job_title || "Not assigned"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-500">{profile.emp_role?.[0] || "?"}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Role in Team</p>
                  <p className="font-medium text-gray-800">{profile.emp_role || "Not assigned"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Member since</p>
                <p className="font-medium text-gray-800">{formatDate(profile.created_at)}</p>
              </div>
              {isAdmin && (
                <button onClick={() => setShowPasswordModal(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm flex items-center gap-2">
                  <Lock size={16} /> Change Password
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6 animate-fade-in">
        <div className="bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <Mail size={24} className="text-white" />
            <div>
              <h3 className="text-lg font-bold">SMTP Settings (Outgoing Mail)</h3>
              <p className="text-indigo-100 text-xs">Custom outbound mail settings for proposals, invoices, and estimates</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSMTPPrompt(true)}
            className="px-4 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold uppercase transition-all shadow-sm active:scale-95 outline-none font-sans"
          >
            {hasSMTP ? "Edit Settings" : "Configure SMTP"}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {hasSMTP ? (
            <div className="space-y-4">
              {/* Status Header */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Service Active Status</span>
                  <span className="text-[11px] text-slate-400">Toggle outbound email delivery status directly</span>
                </div>
                <button
                  type="button"
                  disabled={smtpLoading}
                  onClick={() => handleSMTPToggle(!smtpData.is_enabled)}
                  className="focus:outline-none transition-transform active:scale-95"
                >
                  {smtpData.is_enabled ? (
                    <ToggleRight size={40} className="text-indigo-600 cursor-pointer" />
                  ) : (
                    <ToggleLeft size={40} className="text-slate-300 cursor-pointer" />
                  )}
                </button>
              </div>

              {/* Grid of values */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center gap-3">
                  <Server size={18} className="text-indigo-500" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Provider & Server</span>
                    <span className="text-sm font-semibold text-slate-700 capitalize">{smtpData.provider || "Custom"} ({smtpData.smtp_host}:{smtpData.smtp_port})</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center gap-3">
                  <User size={18} className="text-indigo-500" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Sender Name</span>
                    <span className="text-sm font-semibold text-slate-700">{smtpData.sender_name || "Achme Communication"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center gap-3">
                  <Mail size={18} className="text-indigo-500" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Username / Account</span>
                    <span className="text-sm font-semibold text-slate-700 select-all">{smtpData.email_user}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-lg flex items-center gap-3">
                  <Sparkles size={18} className="text-indigo-500" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Sender From Address</span>
                    <span className="text-sm font-semibold text-slate-700 select-all">{smtpData.from_email_address || smtpData.email_user}</span>
                  </div>
                </div>
              </div>

              {/* Info alert */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-[11px] text-indigo-600 flex items-start gap-2.5">
                <CheckSquare size={16} className="shrink-0 mt-0.5" />
                <span>
                  All system invoices, performing proposals, and service estimation documents generated under this session will be routed securely through your SMTP mail servers.
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Mail size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No Custom SMTP Configured</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">Configure your custom Google Workspace or Yahoo Mail account to send emails from your own domains.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSMTPPrompt(true)}
                className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-xs font-bold uppercase transition-all shadow-sm active:scale-95 outline-none font-sans"
              >
                Configure SMTP Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input type={showCurrentPass ? "text" : "password"} value={passwordData.current_password} onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-blue-500" placeholder="Enter current password" />
                  <button type="button" onClick={() => setShowCurrentPass(!showCurrentPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input type={showNewPass ? "text" : "password"} value={passwordData.new_password} onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-blue-500" placeholder="Enter new password" />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input type={showConfirmPass ? "text" : "password"} value={passwordData.confirm_password} onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:border-blue-500" placeholder="Confirm new password" />
                  <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm">Cancel</button>
              <button onClick={handleAdminPasswordChange} disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                {saving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Request {getFieldLabel(changeField)} Change</h3>
              <button onClick={() => setShowChangeModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Your change request will be sent to admin for approval.</p>
              {changeField === "password" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <input type="password" value={passwordData.current_password} onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="Enter current password" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input type="password" value={passwordData.new_password} onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="Enter new password" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input type="password" value={passwordData.confirm_password} onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder="Confirm new password" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New {getFieldLabel(changeField)}</label>
                  <input type="text" value={changeValue} onChange={(e) => setChangeValue(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2" placeholder={`Enter new ${getFieldLabel(changeField).toLowerCase()}`} />
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setShowChangeModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm">Cancel</button>
              <button onClick={requestProfileChange} disabled={saving} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
                {saving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSMTPPrompt && (
        <SMTPConfigPrompt 
          email={profile.email} 
          onClose={() => {
            setShowSMTPPrompt(false);
            fetchSMTPConfig();
          }} 
        />
      )}
    </div>
  );
};

export default Profile;