import React, { useState, useEffect } from "react";
import { Search, X, Edit, Trash2, FileSignature, Phone, User, Mail, Building, MapPin, FileBarChart, RefreshCw } from "lucide-react";
import "../Styles/tailwind.css";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";

const Clients = () => {
  const { user } = useAuth();
  const canEditDelete = user?.role === "admin" || user?.role === "subadmin";
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  const N = {
    primary: "#5645d4",
    primaryPressed: "#4534b3",
    orange: "#dd5b00",
    green: "#1aae39",
    error: "#e03131",
    ink: "#1a1a1a",
    charcoal: "#37352f",
    slate: "#5d5b54",
    steel: "#787671",
    stone: "#a4a097",
    hairline: "#e5e3df",
    hairlineStrong: "#c8c4be",
    surface: "#f6f5f4",
    surfaceSoft: "#fafaf9",
    canvas: "#ffffff",
    lavender: "#e6e0f5",
    mint: "#d9f3e1",
    peach: "#ffe8d4",
    sky: "#dcecfa",
    rose: "#fde0ec",
    yellow: "#fef7d6",
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${API}/api/client`, config);
      setClients(response.data);
      setLastUpdate(new Date());
    } catch (err) {
      console.log("Fetch Error:", err);
    }
  };



  useEffect(() => {
    fetchClients();
    const handleRefresh = () => fetchClients();
    window.addEventListener("refresh-clients", handleRefresh);

    // Fetch team members
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios.get(`${API}/api/teammember`, config)
      .then(r => setTeamMembers(r.data))
      .catch(e => console.error("Error fetching team members:", e));

    return () => window.removeEventListener("refresh-clients", handleRefresh);
  }, []);

  const deleteClient = async (id) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return;
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API}/api/client/${id}`, config);
      fetchClients();
    } catch (err) {
      console.log("delete error", err);
    }
  };

  const [form, setForm] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    alternate_phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    service: "",
    gst_number: "",
    notes: "",
    client_status: "active",
    assigned_teammember_id: "",
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const saveClient = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      if (isEdit) {
        await axios.put(`${API}/api/client/${selectedClientId}`, form, config);
        alert("Client updated successfully");
      } else {
        await axios.post(`${API}/api/client`, form, config);
        alert("Client added successfully");
      }
      resetForm();
      setOpen(false);
      fetchClients();
    } catch (err) {
      if (err.response?.status === 409) {
        const dups = err.response?.data?.duplicates;
        const details = err.response?.data?.details || "This client already exists.";
        if (dups && dups.length > 0) {
          const dupList = dups.map(d => `• ${d.name} (${d.phone || "N/A"})`).join("\n");
          alert(`⚠️ Duplicate Client Found!\n\n${details}\n\nExisting clients:\n${dupList}\n\nPlease check before creating a new one.`);
        } else {
          alert(`⚠️ ${details}`);
        }
      } else {
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Failed to save client";
        console.error("Client save error:", err.response?.data);
        alert(`Error: ${errMsg}`);
      }
    }
  };

  const resetForm = () => {
    setForm({
      name: "", company_name: "", email: "", phone: "", alternate_phone: "",
      address: "", city: "", state: "", pincode: "",
      service: "", gst_number: "", notes: "", client_status: "active",
      assigned_teammember_id: ""
    });
    setIsEdit(false);
    setSelectedClientId(null);
  };

  const openEditModal = (selectedClient) => {
    setForm({
      name: selectedClient.name || "",
      company_name: selectedClient.company_name || "",
      email: selectedClient.email || "",
      phone: selectedClient.phone || "",
      alternate_phone: selectedClient.alternate_phone || "",
      address: selectedClient.address || "",
      city: selectedClient.city || "",
      state: selectedClient.state || "",
      pincode: selectedClient.pincode || "",
      service: selectedClient.service || "",
      gst_number: selectedClient.gst_number || "",
      notes: selectedClient.notes || "",
      client_status: selectedClient.client_status || "active",
      assigned_teammember_id: selectedClient.assigned_teammember_id || "",
    });
    setSelectedClientId(selectedClient.id);
    setIsEdit(true);
    setOpen(true);
  };

  const openDetailsModal = (client) => {
    setSelectedClientDetails(client);
    setShowDetailsModal(true);
  };

  useEffect(() => {
    if (open) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [open]);

  const getSourceBadge = (source) => {
    const badges = {
      telecall: { bg: N.sky, text: "#0075de", label: "Tele Call" },
      walkin: { bg: N.mint, text: N.green, label: "Walk-in" },
      field: { bg: N.lavender, text: N.primary, label: "Field Visit" },
      direct: { bg: N.surface, text: N.steel, label: "Direct" }
    };
    const badge = badges[source] || badges.direct;
    return <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>;
  };

  const getStatusBadge = (status) => {
    const map = {
      active: { bg: N.mint, color: N.green },
      inactive: { bg: N.rose, color: N.error },
      prospect: { bg: N.yellow, color: N.orange },
    };
    const s = map[status] || map.active;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>{status || "active"}</span>;
  };

  const filteredClients = clients.filter(c => {
    const matchesSearch =
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = filterSource === "all" || c.original_lead_type === filterSource;
    const isConverted = c.original_lead_id !== null && c.original_lead_type !== null;
    if (activeTab === "converted") return matchesSearch && matchesSource && isConverted;
    if (activeTab === "direct") return matchesSearch && matchesSource && !isConverted;
    return matchesSearch && matchesSource;
  });

  const convertedCount = clients.filter(c => c.original_lead_id !== null && c.original_lead_type !== null).length;
  const directCount = clients.filter(c => c.original_lead_id === null || c.original_lead_type === null).length;
  const activeCount = clients.filter(c => c.client_status === "active").length;

  return (
    <div className="w-full min-h-screen p-4 md:p-6" style={{ background: N.surfaceSoft }}>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: N.ink }}>Clients</h1>
          <a href="/dashboard" className="text-sm" style={{ color: N.stone }}>Dashboard &gt; Customers &gt; Clients</a>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchClients} className="p-2 rounded-lg border hover:bg-gray-50" style={{ borderColor: N.hairline }} title="Refresh">
            <RefreshCw size={16} style={{ color: N.steel }} />
          </button>
          <button onClick={() => { resetForm(); setOpen(true); }}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition"
            style={{ background: N.primary }}>
            <span>+</span> Add Client
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Clients", count: clients.length, bg: N.lavender, color: N.primary },
          { label: "Active", count: activeCount, bg: N.mint, color: N.green },
          { label: "Converted", count: convertedCount, bg: N.sky, color: "#0075de" },
          { label: "Direct", count: directCount, bg: N.peach, color: N.orange },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 border" style={{ background: s.bg, borderColor: "transparent" }}>
            <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "all", label: `All (${clients.length})`, color: N.ink },
          { key: "converted", label: `Converted (${convertedCount})`, color: N.green },
          { key: "direct", label: `Direct (${directCount})`, color: N.orange },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: activeTab === t.key ? t.color : "transparent",
              color: activeTab === t.key ? "#fff" : N.steel,
              border: `1px solid ${activeTab === t.key ? t.color : N.hairline}`,
            }}>
            {t.label}
          </button>
        ))}
        {lastUpdate && (
          <span className="ml-auto text-xs flex items-center gap-1 self-center" style={{ color: N.stone }}>
            <RefreshCw size={11} /> {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border flex-1" style={{ background: N.canvas, borderColor: N.hairline }}>
          <Search size={16} style={{ color: N.stone }} />
          <input type="text" placeholder="Search by name, email, phone, company..." className="outline-none text-sm flex-1 bg-transparent" style={{ color: N.ink }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]" style={{ borderColor: N.hairline, color: N.ink }}>
          <option value="all">All Sources</option>
          <option value="telecall">Tele Call</option>
          <option value="walkin">Walk-in</option>
          <option value="field">Field Visit</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: N.surface }}>
              <tr>
                {["Client", "Phone", "Company", "Source", "Created By", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(c => (
                <tr key={c.id} className="border-t cursor-pointer hover:bg-gray-50 transition" style={{ borderColor: N.hairline }}
                  onDoubleClick={() => openDetailsModal(c)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: N.lavender, color: N.primary }}>
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: N.ink }}>{c.name}</p>
                        <p className="text-xs" style={{ color: N.stone }}>{c.email || "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" style={{ color: N.charcoal }}>
                      <Phone size={12} style={{ color: N.stone }} />
                      {c.phone || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: N.charcoal }}>{c.company_name || "-"}</td>
                  <td className="px-4 py-3">{getSourceBadge(c.original_lead_type || "direct")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" style={{ color: N.charcoal }}>
                      <User size={12} style={{ color: N.stone }} />
                      {c.creator_name || "Admin"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(c.client_status)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => {
                        sessionStorage.setItem("qt_prefill", JSON.stringify({
                          customer_name: c.name,
                          mobile_number: c.phone || "",
                          email: c.email || "",
                          location_city: c.address || c.city || "",
                          company_name: c.company_name || "",
                          gst_number: c.gst_number || "",
                          state: c.state || "",
                          pincode: c.pincode || "",
                          address: c.address || "",
                          client_id: c.id,
                          source: "client"
                        }));
                        window.location.href = "/dashboard/quotation";
                      }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 transition" style={{ color: "#0075de" }} title="Create Quotation">
                        <FileBarChart size={16} />
                      </button>
                      <button onClick={() => {
                        sessionStorage.setItem("contract_prefill", JSON.stringify({
                          customer_name: c.name,
                          mobile_number: c.phone || "",
                          email: c.email || "",
                          location_city: c.address || c.city || "",
                          company_name: c.company_name || "",
                          client_id: c.id,
                          source: "client"
                        }));
                        window.location.href = "/dashboard/amc";
                      }}
                        className="p-1.5 rounded-lg hover:bg-green-50 transition" style={{ color: N.green }} title="Create Contract">
                        <FileSignature size={16} />
                      </button>
                      <button onClick={() => openEditModal(c)}
                        className="p-1.5 rounded-lg hover:bg-amber-50 transition" style={{ color: N.orange }} title="Edit">
                        <Edit size={16} />
                      </button>
                      {canEditDelete && <button onClick={() => deleteClient(c.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition" style={{ color: N.error }} title="Delete">
                        <Trash2 size={16} />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center" style={{ color: N.stone }}>No clients found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Details Modal */}
      {showDetailsModal && selectedClientDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-gray-200 animate-scale-in">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl" style={{ background: N.lavender, color: N.primary }}>
                  {(selectedClientDetails.name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold font-display text-gray-900">{selectedClientDetails.name}</h2>
                  <p className="text-sm font-mono text-gray-500">Client ID: #{String(selectedClientDetails.id).padStart(3, '0')} &nbsp;·&nbsp; {getStatusBadge(selectedClientDetails.client_status)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Phone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Primary Phone</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.phone || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Mail size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Email Address</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.email || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Building size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Company / Organization</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.company_name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Location</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">
                      {[selectedClientDetails.address, selectedClientDetails.city, selectedClientDetails.state, selectedClientDetails.pincode].filter(Boolean).join(", ") || selectedClientDetails.lead_city || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Service & Tax */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 mb-1">Service Interest</p>
                  <p className="text-sm font-medium text-gray-900">{selectedClientDetails.service || "—"}</p>
                </div>
                <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-purple-600 mb-1">GST Number</p>
                  <p className="text-sm font-mono text-gray-900">{selectedClientDetails.gst_number || "—"}</p>
                </div>
              </div>

              {/* Conversion & Staff Details */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-800 mb-4 flex items-center gap-2">
                  <FileSignature size={16} /> Origin & Assignment Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Source Type</p>
                    <div className="mt-1">{getSourceBadge(selectedClientDetails.original_lead_type)}</div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Lead ID</p>
                    <p className="text-sm font-mono text-gray-900 mt-1">{selectedClientDetails.original_lead_id ? `${selectedClientDetails.original_lead_type?.toUpperCase()}-${selectedClientDetails.original_lead_id}` : "Direct"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Converted / Created By</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1">
                      <User size={14} className="text-gray-400" /> {selectedClientDetails.creator_name || "Admin"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-500 uppercase">Assigned Staff</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1 flex items-center gap-1">
                      <User size={14} className="text-amber-500" /> {selectedClientDetails.assigned_staff_name || "Unassigned"}
                    </p>
                    {selectedClientDetails.assigned_staff_role && (
                      <p className="text-[10px] text-gray-500 mt-0.5">{selectedClientDetails.assigned_staff_role}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-amber-200/50">
                  <p className="text-[11px] text-gray-500">Created Date: {selectedClientDetails.created_at ? new Date(selectedClientDetails.created_at).toLocaleString("en-IN") : "—"}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedClientDetails.notes && (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Remarks / Notes</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedClientDetails.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => { setShowDetailsModal(false); openEditModal(selectedClientDetails); }}
                className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-sm hover:shadow-md" style={{ background: N.primary }}>
                Edit Client
              </button>
              <button onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Client Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl shadow-xl w-full max-w-lg" style={{ background: N.canvas }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: N.hairline }}>
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>{isEdit ? "Edit Client" : "Add New Client"}</h3>
              <button onClick={() => setOpen(false)} style={{ color: N.steel }}><X size={20} /></button>
            </div>
            <form onSubmit={saveClient} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Name <span className="text-red-500">*</span></label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} required />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Company Name</label>
                  <input type="text" name="company_name" value={form.company_name} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Phone <span className="text-red-500">*</span></label>
                  <input type="text" name="phone" value={form.phone} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} required />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Alternate Phone</label>
                  <input type="text" name="alternate_phone" value={form.alternate_phone} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Address</label>
                <input type="text" name="address" value={form.address} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>City</label>
                  <input type="text" name="city" value={form.city} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>State</label>
                  <input type="text" name="state" value={form.state} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Pincode</label>
                  <input type="text" name="pincode" value={form.pincode} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Service Interest</label>
                  <input type="text" name="service" value={form.service} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                    placeholder="e.g. AMC, Installation" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>GST Number</label>
                  <input type="text" name="gst_number" value={form.gst_number} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Status</label>
                <select name="client_status" value={form.client_status} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Assigned Staff</label>
                <select name="assigned_teammember_id" value={form.assigned_teammember_id} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}>
                  <option value="">Unassigned</option>
                  {teamMembers.map(t => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name || ""} ({t.emp_role || "Staff"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Additional notes..." />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: N.surface, color: N.slate }}>
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ background: N.primary }}>
                  {isEdit ? "Update Client" : "Save Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;