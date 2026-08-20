import { useState, useEffect, useCallback } from "react";
import {
  Users, Plus, Search, RefreshCw, UserCheck, UserX, ShieldOff, Shield,
  Download, Upload, X, Edit2, Phone, Tag, ChevronDown, Loader2, CheckCircle2, AlertCircle
} from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";

const FILTERS = [
  { id: "all", label: "All Contacts", icon: Users },
  { id: "opted_in", label: "Opted In", icon: UserCheck },
  { id: "blocked", label: "Blocked", icon: ShieldOff },
  { id: "unsubscribed", label: "Unsubscribed", icon: UserX },
];

const TAG_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700",
];

function tagColor(tag) {
  const idx = tag.charCodeAt(0) % TAG_COLORS.length;
  return TAG_COLORS[idx];
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{value?.toLocaleString() ?? 0}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function WhatsAppContacts() {
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", country_code: "91", email: "", tags: "", notes: "", opt_in_status: 1 });

  const token = () => localStorage.getItem("token");
  const headers = () => ({ Authorization: `Bearer ${token()}` });

  const fetchContacts = useCallback(async (p = page, f = filter, s = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 50, ...(f !== "all" && { filter: f }), ...(s && { search: s }) });
      const { data } = await axios.get(`${API}/api/wa/contacts?${params}`, { headers: headers() });
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {}
    setLoading(false);
  }, [page, filter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/wa/contacts/stats/summary`, { headers: headers() });
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { fetchContacts(1, filter, search); fetchStats(); }, [filter]);
  useEffect(() => {
    const t = setTimeout(() => { fetchContacts(1, filter, search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditContact(null);
    setForm({ name: "", phone: "", country_code: "91", email: "", tags: "", notes: "", opt_in_status: 1 });
    setShowModal(true);
  };
  const openEdit = (c) => {
    setEditContact(c);
    setForm({
      name: c.name, phone: c.phone, country_code: c.country_code || "91",
      email: c.email || "", tags: Array.isArray(c.tags) ? c.tags.join(", ") : (c.tags || ""),
      notes: c.notes || "", opt_in_status: c.opt_in_status ? 1 : 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) return;
    const tagsArr = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const payload = { ...form, tags: tagsArr };
    try {
      if (editContact) {
        await axios.put(`${API}/api/wa/contacts/${editContact.id}`, payload, { headers: headers() });
      } else {
        await axios.post(`${API}/api/wa/contacts`, payload, { headers: headers() });
      }
      setShowModal(false);
      fetchContacts(page, filter, search);
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save contact");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this contact?")) return;
    await axios.delete(`${API}/api/wa/contacts/${id}`, { headers: headers() });
    fetchContacts(page, filter, search);
    fetchStats();
  };

  const handleBlock = async (id, blocked) => {
    setActionLoading(id);
    await axios.post(`${API}/api/wa/contacts/${id}/${blocked ? "unblock" : "block"}`, {}, { headers: headers() });
    setActionLoading(null);
    fetchContacts(page, filter, search);
  };

  const handleImport = async (source) => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await axios.post(`${API}/api/wa/contacts/bulk-import`, { source }, { headers: headers() });
      setImportResult(data);
      fetchContacts(1, filter, search);
      fetchStats();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || "Import failed" });
    }
    setImporting(false);
  };

  const handleSyncWhatsAppContacts = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const { data } = await axios.post(`${API}/api/whatsapp/sync-contacts`, {}, { headers: headers() });
      if (data.success) {
        setImportResult({ inserted: data.inserted || 0, skipped: (data.count || 0) - (data.inserted || 0) });
      } else {
        setImportResult({ error: data.message || data.error || "Sync failed" });
      }
      fetchContacts(1, filter, search);
      fetchStats();
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || "Sync failed" });
    }
    setImporting(false);
  };

  return (
    <div className="w-full">
      <WhatsAppNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCheck className="text-[#25D366]" size={28} />
          <h1 className="text-xl font-bold text-gray-800">WhatsApp Contacts</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{total.toLocaleString()} contacts</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncWhatsAppContacts}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold shadow-sm disabled:opacity-50"
            title="Sync all contacts directly from connected WhatsApp phone"
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            <span>Sync from WhatsApp</span>
          </button>
          {/* Import dropdown */}
          <div className="relative group">
            <button
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              <span>Import from CRM</span>
              <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-48 hidden group-hover:block">
              {["clients", "telecalls", "walkins", "fields", "all"].map(src => (
                <button
                  key={src}
                  onClick={() => handleImport(src === "all" ? null : src)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 capitalize first:rounded-t-xl last:rounded-b-xl"
                >
                  {src === "all" ? "All Sources" : src}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition text-sm font-semibold shadow-sm"
          >
            <Plus size={16} /> Add Contact
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-3 ${importResult.error ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
          {importResult.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {importResult.error || `Imported ${importResult.inserted} contacts (${importResult.skipped} skipped)`}
          <button onClick={() => setImportResult(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} color="bg-gray-100 text-gray-600" icon={Users} />
        <StatCard label="Opted In" value={stats.opted_in} color="bg-emerald-100 text-emerald-600" icon={UserCheck} />
        <StatCard label="Blocked" value={stats.blocked} color="bg-red-100 text-red-600" icon={ShieldOff} />
        <StatCard label="Unsubscribed" value={stats.unsubscribed} color="bg-orange-100 text-orange-600" icon={UserX} />
        <StatCard label="Opt-Outs" value={stats.opt_outs} color="bg-purple-100 text-purple-600" icon={AlertCircle} />
      </div>

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1">
          {FILTERS.map(f => {
            const Icon = f.icon;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? "bg-[#25D366] text-white shadow" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Icon size={13} /> {f.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-sm">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="outline-none text-sm w-full text-gray-700"
          />
        </div>
        <button onClick={() => fetchContacts(page, filter, search)} className="p-2 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={16} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Contact Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Contacted</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 size={32} className="animate-spin text-[#25D366] mx-auto" /></td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400">
                  <UserCheck size={48} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-500 mb-2">No contacts found</p>
                  <p className="text-xs">Add contacts or import from CRM sources</p>
                </td></tr>
              ) : (
                contacts.map(c => {
                  const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === "string" && c.tags ? JSON.parse(c.tags || "[]") : []);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#25D366]/15 text-[#25D366] flex items-center justify-center font-bold text-sm">
                            {(c.name || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">{c.name}</p>
                            {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-gray-700">+{c.country_code || "91"} {c.phone}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map(t => (
                            <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagColor(t)}`}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {c.is_blocked ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              <ShieldOff size={10} /> Blocked
                            </span>
                          ) : c.is_unsubscribed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              <UserX size={10} /> Unsubscribed
                            </span>
                          ) : c.opt_in_status ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              <UserCheck size={10} /> Opted In
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              No Consent
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{c.source || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {c.last_contacted ? new Date(c.last_contacted).toLocaleDateString() : "Never"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <a
                            href={`/whatsapp?phone=${c.phone}`}
                            className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 transition"
                            title="Open in Live Chat"
                          >
                            <Phone size={14} />
                          </a>
                          <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleBlock(c.id, c.is_blocked)}
                            disabled={actionLoading === c.id}
                            className={`p-1.5 rounded-lg transition ${c.is_blocked ? "hover:bg-emerald-50 text-emerald-600" : "hover:bg-red-50 text-red-500"}`}
                            title={c.is_blocked ? "Unblock" : "Block"}
                          >
                            {actionLoading === c.id ? <Loader2 size={14} className="animate-spin" /> : c.is_blocked ? <Shield size={14} /> : <ShieldOff size={14} />}
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600" title="Delete">
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} ({total} total)</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchContacts(page - 1, filter, search); }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40">← Prev</button>
              <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchContacts(page + 1, filter, search); }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">{editContact ? "Edit Contact" : "Add Contact"}</h2>
              <button onClick={() => setShowModal(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Phone * (10 digits)</label>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">+91</span>
                    <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" placeholder="9876543210" maxLength={10} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366]" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tags (comma separated)</label>
                <div className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
                  <Tag size={14} className="text-gray-400" />
                  <input type="text" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                    className="flex-1 text-sm outline-none" placeholder="VIP, Hot Lead, Mumbai..." />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#25D366] resize-none" placeholder="Optional notes..." />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-gray-700">Opt-in Status:</label>
                <button
                  onClick={() => setForm({ ...form, opt_in_status: form.opt_in_status ? 0 : 1 })}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${form.opt_in_status ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-gray-100 text-gray-500 border border-gray-200"}`}
                >
                  {form.opt_in_status ? "✓ Opted In" : "✗ Not Opted In"}
                </button>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={!form.name || !form.phone}
                className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-[#1ebe5d] disabled:opacity-50 transition">
                {editContact ? "Save Changes" : "Add Contact"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
