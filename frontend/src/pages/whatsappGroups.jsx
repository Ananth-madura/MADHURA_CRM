import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Upload, Download, X, ChevronDown, ChevronRight, Loader2, UserPlus, Send } from "lucide-react";
import axios from "axios";
import { API } from "../config/api";
import WhatsAppNav from "../components/WhatsAppNav";
import WhatsAppCampaignWizard from "../components/WhatsAppCampaignWizard";

export default function WAGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupContacts, setGroupContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [importModal, setImportModal] = useState(null);
  const [bulkInput, setBulkInput] = useState("");
  const [selectedGroupForBulk, setSelectedGroupForBulk] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/groups`, { headers: { Authorization: `Bearer ${token}` } });
      setGroups(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleCreate = async () => {
    if (!groupName) return;
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/groups`, { name: groupName, description: groupDesc }, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setGroupName("");
      setGroupDesc("");
      fetchGroups();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this group and all its contacts?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (expandedGroup === id) setExpandedGroup(null);
      fetchGroups();
    } catch (err) { console.error(err); }
  };

  const toggleExpand = async (id) => {
    if (expandedGroup === id) { setExpandedGroup(null); return; }
    setExpandedGroup(id);
    setContactsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API}/api/wa/groups/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setGroupContacts(data.contacts || []);
    } catch (err) { console.error(err); }
    setContactsLoading(false);
  };

  const handleDeleteContact = async (groupId, contactId) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/api/wa/groups/${groupId}/contacts/${contactId}`, { headers: { Authorization: `Bearer ${token}` } });
      setGroupContacts(prev => prev.filter(c => c.id !== contactId));
      fetchGroups();
    } catch (err) { console.error(err); }
  };

  const handleBulkImport = async (id) => {
    if (!bulkInput.trim()) return;
    const lines = bulkInput.trim().split("\n").filter(l => l.trim());
    const contacts = lines.map(line => {
      const parts = line.split(",").map(s => s.trim());
      return { phone: parts[0]?.replace(/[^0-9]/g, "").slice(-10), name: parts[1] || null, notes: parts[2] || null };
    }).filter(c => c.phone.length >= 10);

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/api/wa/groups/${id}/contacts`, { contacts }, { headers: { Authorization: `Bearer ${token}` } });
      setBulkInput("");
      setImportModal(null);
      toggleExpand(id);
      fetchGroups();
    } catch (err) { console.error(err); }
  };

  const handleImportCustomers = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(`${API}/api/wa/groups/${id}/import-customers`, {}, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Imported ${data.imported} customers. Total contacts: ${data.totalContacts}`);
      toggleExpand(id);
      fetchGroups();
    } catch (err) { alert(err.response?.data?.error || "Import failed"); }
  };

  const downloadCSV = (contacts, groupName) => {
    const csv = "Phone,Name,Notes\n" + contacts.map(c => `${c.phone},${c.name || ""},${c.notes || ""}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${groupName || "contacts"}.csv`;
    a.click();
  };

  return (
    <div className="w-full">
      <WhatsAppNav />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-[#25D366]" size={28} />
          <h1 className="text-xl font-bold text-gray-800">Contact Groups</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{groups.length} groups</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition text-sm">
          <Plus size={16} /> New Group
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-[#25D366]" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-gray-200">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No groups yet</p>
          <p className="text-sm">Create contact groups to organize your audience</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(g.id)}>
                <div className="flex items-center gap-3">
                  {expandedGroup === g.id ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <div>
                    <h3 className="font-semibold text-gray-800">{g.name}</h3>
                    <p className="text-xs text-gray-500">{g.contact_count || 0} contacts{g.description ? ` — ${g.description}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={async () => {
                      const token = localStorage.getItem("token");
                      const { data } = await axios.get(`${API}/api/wa/groups/${g.id}`, { headers: { Authorization: `Bearer ${token}` } });
                      setSelectedGroupForBulk(data.contacts || []);
                      setShowBulkModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#1ebe5d] transition shadow-sm"
                    title="Launch WhatsApp broadcast wizard"
                  >
                    <Send size={14} />
                    <span>Send Bulk</span>
                  </button>
                  <button onClick={() => { setImportModal(g.id); setBulkInput(""); }} className="p-2 hover:bg-gray-100 rounded-lg" title="Import contacts"><UserPlus size={16} className="text-gray-500" /></button>
                  <button onClick={() => handleImportCustomers(g.id)} className="p-2 hover:bg-gray-100 rounded-lg" title="Import from CRM customers"><Upload size={16} className="text-gray-500" /></button>
                  <button onClick={() => handleDelete(g.id)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16} className="text-red-500" /></button>
                </div>
              </div>

              {expandedGroup === g.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  {contactsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
                  ) : groupContacts.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">No contacts in this group. Import contacts to start.</div>
                  ) : (
                    <div className="space-y-1">
                      {groupContacts.map((c) => (
                        <div key={c.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-100">
                          <div>
                            <span className="text-sm font-medium text-gray-700">{c.name || "Unknown"}</span>
                            <span className="text-sm text-gray-500 ml-2">+{c.country_code || "91"} {c.phone}</span>
                            {c.notes && <span className="text-xs text-gray-400 ml-2">{c.notes}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <a
                              href={`/whatsapp?phone=${c.phone}`}
                              className="p-1 hover:bg-emerald-50 rounded text-emerald-600 transition"
                              title="Open in Live Chat"
                            >
                              <Send size={13} />
                            </a>
                            <button onClick={() => handleDeleteContact(g.id, c.id)} className="p-1 hover:bg-red-50 rounded text-red-400" title="Remove from group">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => downloadCSV(groupContacts, g.name)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-2 px-1">
                        <Download size={12} /> Export CSV
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">New Contact Group</h2>
              <button onClick={() => setShowCreate(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Customers 2024" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="All active customers" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={!groupName} className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm hover:bg-[#1ebe5d] disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setImportModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Import Contacts</h2>
              <button onClick={() => setImportModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-3">One phone number per line. Optionally add name and notes:</p>
              <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)} rows={8} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="9876543210, Rajesh, VIP customer&#10;9876543211, Priya&#10;9876543212" />
              <p className="text-xs text-gray-400 mt-1">Format: phone, name, notes (one per line)</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setImportModal(null)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleBulkImport(importModal)} disabled={!bulkInput.trim()} className="flex-1 px-4 py-2.5 bg-[#25D366] text-white rounded-lg text-sm hover:bg-[#1ebe5d] disabled:opacity-50">Import</button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppCampaignWizard
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        onSuccess={() => fetchGroups()}
        initialContacts={selectedGroupForBulk || []}
      />
    </div>
  );
}