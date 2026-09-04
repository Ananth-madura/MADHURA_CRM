import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Download, X, Edit2, MinusCircle, PlusCircle, Trash2, Mail, MapPin, History, FileText, Eye, Clock, MessageCircle } from "lucide-react";
import ClientSearchDropdown from "../components/ClientSearchDropdown";
import { calculateItemTotal } from "../utils/invoicecal";
import { downloadAsHtml } from "../utils/downloadHtml";
import axios from "axios";
import Invoice from "../components/invoicetemplate";
import { API } from "../config";
import { BRANCH_DATA, BRANCH_OPTIONS, BANK_DETAILS } from "../config/branchConfig";
import SMTPConfigPrompt from "../components/SMTPConfigPrompt";
import SendWhatsAppReminderModal from "../components/SendWhatsAppReminderModal";

const parseName = (fullName = "") => {
  const prefixes = ["Mr.", "Mrs.", "M/S."];
  for (const prefix of prefixes) {
    if (fullName.startsWith(prefix + " ")) {
      return { salutation: prefix, name: fullName.substring(prefix.length + 1) };
    } else if (fullName.startsWith(prefix)) {
      return { salutation: prefix, name: fullName.substring(prefix.length) };
    }
  }
  return { salutation: "", name: fullName };
};

const UOM_OPTIONS = ["Nos", "Units", "Pieces", "Boxes", "Sets", "Meters", "Kg", "Liters"];
const INDIAN_STATES = ["Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];
const VALIDITY_OPTIONS = ["2 days", "5 days", "10 days", "15 days", "30 days"];
const PAYMENT_OPTIONS = ["100% Advance", "Payment Against Delivery", "15 Days", "30 Days", "45 Days", "Custom"];
const WARRANTY_OPTIONS = ["No Warranty", "Testing Warranty", "1 Month", "3 Months", "6 Months", "12 Months", "24 Months", "36 Months", "OEM Warranty", "Supplier Warranty", "OEM Hardware Warranty", "No Software Warranty"];
const GST_STATE_MAP = { "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "25": "Dadra and Nagar Haveli and Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh" };

const resizeAndCompressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scale;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
  });
};

const GST_MODES = ["Exclusive", "Inclusive", "Exempt"];
const QUOTATION_STATUS = ["Send", "Pending", "Close", "Billed", "Cancel"];
const QUOTATION_STATUS_COLORS = {
  Send: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  Pending: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  Close: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  Billed: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  Cancel: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};
const emptyExtra = () => ({
  from_address_id: "", from_address_custom: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004 | GSTIN: 33AAHFA7876M1ZX", client_company: "", client_address1: "", client_address2: "",
  client_city: "", client_state: "", client_pincode: "", client_country: "India",
  tax_type: "GST18", custom_tax: "", exec_name: "", exec_phone: "", exec_email: "",
  terms_general: false, terms_tax: false, terms_project_period: "30-60 days from Purchase Order date",
  terms_validity: "15 days", terms_separate_orders: { material: false, installation: false, usd: false, boq: false, hide_gst_percentage: false, attached_images: [] },
  terms_payment: "", terms_payment_custom: "", terms_warranty: "", supplier_branch: "Coimbatore",
  bank_details_id: "hdfc", bank_company: "ACHME COMMUNICATION", bank_name: "HDFC BANK",
  bank_account: "00312320005822", bank_ifsc: "HDFC0000031", bank_branch: "Coimbatore", custom_terms: "",
  gst_mode: "Exclusive",
});
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const Quotation = () => {
  const userRole = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}").role || "employee"; } catch { return "employee"; } })();
  const canEditDelete = userRole === "admin" || userRole === "subadmin";
  const [list, setList] = useState([]);
  const [fromAddresses, setFromAddresses] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showinvoice, setShowInvoice] = useState(false);
  const [waModal, setWaModal] = useState({ open: false, quote: null });
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("");
  const [followupFilter, setFollowupFilter] = useState("");
  const [followupDateFilter, setFollowupDateFilter] = useState("");
  const [followupSummaryMap, setFollowupSummaryMap] = useState({});
  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [followupLeadName, setFollowupLeadName] = useState("");
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [newFollowupTime, setNewFollowupTime] = useState("");
  const [newFollowupNote, setNewFollowupNote] = useState("");
  const [leadFollowups, setLeadFollowups] = useState([]);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailCc, setMailCc] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailContent, setMailContent] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrText, setNewAddrText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyCustomerName, setHistoryCustomerName] = useState("");
  const [historyRootId, setHistoryRootId] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [showSMTPPrompt, setShowSMTPPrompt] = useState(false);
  const [items, setItems] = useState([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
  const [savedBrands, setSavedBrands] = useState([]);
  const [customer, setCustomer] = useState({ salutation: "", customer_name: "", mobile_number: "", email: "", gst_number: "", location_city: "" });
  const [quotationData, setQuotationData] = useState({ quotation_date: todayStr() });
  const [extra, setExtra] = useState(emptyExtra());
  const [editingIndex, setEditingIndex] = useState(null);
  const invoiceRef = useRef(null);

  const fmtQT = (id, d) => `QT-${d ? new Date(d).getFullYear() : new Date().getFullYear()}-${String(id).padStart(3, "0")}`;
  const fmtSubQT = (rootId, ver, d) => `QT-${d ? new Date(d).getFullYear() : new Date().getFullYear()}-${String(rootId).padStart(3, "0")}-${ver}`;
  const findInvoice = (id) => list.find(p => p.id === id) || historyList.find(p => p.id === id);
  const fmtDate = (d) => d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium" }) : "---";

  useEffect(() => {
    fetchList();
    fetchAddresses();
    fetchFollowupSummary();
    // load saved brands from localStorage
    try {
      const sb = JSON.parse(localStorage.getItem("saved_brands")) || [];
      setSavedBrands(Array.isArray(sb) ? sb : []);
    } catch (_) { setSavedBrands([]); }
    const p = new URLSearchParams(window.location.search);
    const qName = p.get("client_name");
    if (qName) {
      const decodedName = decodeURIComponent(qName);
      const parsed = parseName(decodedName);
      setCustomer(c => ({ ...c, salutation: parsed.salutation, customer_name: parsed.name, email: p.get("client_email") ? decodeURIComponent(p.get("client_email")) : c.email }));
      setOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const pf = sessionStorage.getItem("qt_prefill");
      if (pf) {
        try {
          const v = JSON.parse(pf);
          const parsed = parseName(v.customer_name || "");
          setCustomer(c => ({
            ...c,
            salutation: parsed.salutation,
            customer_name: parsed.name,
            mobile_number: v.mobile_number || c.mobile_number,
            email: v.email || c.email,
            gst_number: v.gst_number || c.gst_number,
            location_city: v.location_city || c.location_city
          }));
          setExtra(ex => ({
            ...ex,
            client_company: v.company_name || v.customer_name || ex.client_company,
            client_address1: v.address || ex.client_address1,
            client_city: v.location_city || ex.client_city,
            client_state: v.state || ex.client_state,
            client_pincode: v.pincode || ex.client_pincode,
            gst_mode: v.gst_mode || "Exclusive"
          }));
          if (v.contract_id) {
            setQuotationData(qd => ({ ...qd, reference_no: v.contract_title || "", quotation_date: v.start_date || todayStr() }));
          }
          if (v.service_description) {
            setDescInput(v.service_description); setBrandInput("");
            setItems([{ name: v.service_description, brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
          }
          setOpen(true);
          sessionStorage.removeItem("qt_prefill");
        } catch (_) { }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchList = async () => { try { const r = await axios.get(`${API}/api/quotations`, getAuthConfig()); setList(r.data); } catch (e) { console.error(e); } };
  const fetchAddresses = async () => { try { const r = await axios.get(`${API}/api/quotations/from-addresses`, getAuthConfig()); setFromAddresses(r.data); } catch (e) { console.error(e); } };
  const fetchFollowupSummary = async () => {
    try {
      const r = await axios.get(`${API}/api/leads/followups-summary/quotation`, getAuthConfig());
      const map = {};
      (r.data || []).forEach(row => { map[row.lead_id] = row; });
      setFollowupSummaryMap(map);
    } catch (_) { }
  };

  const handleAddAddress = async () => {
    if (!newAddrLabel || !newAddrText) return alert("Label and address required");
    try { const r = await axios.post(`${API}/api/quotations/from-addresses`, { label: newAddrLabel, address: newAddrText }, getAuthConfig()); setFromAddresses(p => [...p, r.data]); setNewAddrLabel(""); setNewAddrText(""); setShowAddAddress(false); }
    catch (e) { alert("Failed to add address"); }
  };

  const handleEdit = async (id) => {
    try {
      const res = await axios.get(`${API}/api/quotations/${id}`, getAuthConfig());
      const rows = res.data; const h = rows[0];
      const parsed = parseName(h.customer_name || "");
      setCustomer({ salutation: parsed.salutation, customer_name: parsed.name, mobile_number: h.mobile_number, email: h.email, gst_number: h.gst_number || "", location_city: h.location_city });
      setQuotationData({ quotation_date: h.quotation_date?.split("T")[0] || h.invoice_date?.split("T")[0] || "" });
      const li = rows.map(r => ({ name: r.description, brand_model: r.brand_model || "", hsn_sac: r.hsn_sac || "", uom: r.uom || "Nos", price: Number(r.price) || 0, qty: Number(r.quantity) || 1, tax: 18, discount: Number(r.discount) || 0 }));
      setItems(li); setDescInput(li.map(i => i.name).join(", ")); setBrandInput(li[0]?.brand_model || "");
      setExtra({ from_address_id: h.from_address_id || "", from_address_custom: h.from_address_custom || (BRANCH_DATA[h.supplier_branch || "Coimbatore"] ? `${BRANCH_DATA[h.supplier_branch || "Coimbatore"].address} | GSTIN: ${BRANCH_DATA[h.supplier_branch || "Coimbatore"].gstin}` : ""), client_company: h.client_company || "", client_address1: h.client_address1 || "", client_address2: h.client_address2 || "", client_city: h.client_city || "", client_state: h.client_state || "", client_pincode: h.client_pincode || "", client_country: h.client_country || "India", tax_type: h.tax_type || "GST18", custom_tax: h.custom_tax || "", exec_name: h.exec_name || "", exec_phone: h.exec_phone || "", exec_email: h.exec_email || "", terms_general: !!h.terms_general, terms_tax: !!h.terms_tax, terms_project_period: h.terms_project_period || "30-60 days from Purchase Order date", terms_validity: h.terms_validity || "15 days", terms_separate_orders: h.terms_separate_orders ? JSON.parse(h.terms_separate_orders) : { material: false, installation: false, usd: false, boq: false }, terms_payment: h.terms_payment || "", terms_payment_custom: h.terms_payment_custom || "", terms_warranty: h.terms_warranty || "", supplier_branch: h.supplier_branch || "Coimbatore", bank_details_id: h.bank_details_id || "hdfc", bank_company: h.bank_company || "ACHME COMMUNICATION", bank_name: h.bank_name || "HDFC BANK", bank_account: h.bank_account || "00312320005822", bank_ifsc: h.bank_ifsc || "HDFC0000031", bank_branch: h.bank_branch || "Coimbatore", custom_terms: h.custom_terms || "", gst_mode: h.gst_mode || "Exclusive" });
      setEditId(id); setOpen(true);
    } catch (e) { alert("Failed to load quotation"); }
  };

  const getTotals = () => {
    const gstMode = extra.gst_mode || "Exclusive";
    if (extra.terms_tax || gstMode === "Exempt") {
      const sub = items.reduce((a, i) => a + (i.price * (i.qty || 0)), 0);
      const disc = items.reduce((a, i) => a + (i.discount || 0), 0);
      return { subtotal: sub, total_discount: disc, total_cgst: 0, total_sgst: 0, total_igst: 0, grand_total: sub - disc };
    }
    const bState = (BRANCH_OPTIONS.find(b => b.value === extra.supplier_branch)?.state || "Tamil Nadu").toLowerCase().trim();
    const cState = (extra.client_state || "").toLowerCase().trim();
    const same = bState === cState && cState !== "";
    let sub = 0, disc = 0, cgst = 0, sgst = 0, igst = 0;
    items.forEach(i => {
      const s = i.price * i.qty;
      const d = i.discount || 0;
      const afterDisc = s - d;
      if (gstMode === "Inclusive") {
        const taxableValue = afterDisc / (1 + (i.tax || 0) / 100);
        const t = afterDisc - taxableValue;
        sub += s; disc += d;
        if (same) { cgst += t / 2; sgst += t / 2; } else { igst += t; }
      } else {
        const t = (afterDisc * (i.tax || 0)) / 100;
        sub += s; disc += d;
        if (same) { cgst += t / 2; sgst += t / 2; } else { igst += t; }
      }
    });
    return { subtotal: sub, total_discount: disc, total_cgst: cgst, total_sgst: sgst, total_igst: igst, grand_total: gstMode === "Inclusive" ? sub - disc : sub - disc + cgst + sgst + igst };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!quotationData.quotation_date) return alert("Please select date");
    if (items.some(i => !i.name.trim())) return alert("Description cannot be empty");
    try {
      const t = getTotals();
      const fullCustomerName = (customer.salutation ? customer.salutation + " " : "") + customer.customer_name;
      const payload = { customer: { ...customer, customer_name: fullCustomerName }, invoice: { invoice_date: quotationData.quotation_date, quotation_date: quotationData.quotation_date, ...t, total_tax: t.total_cgst + t.total_sgst + t.total_igst }, items: items.map(i => ({ description: i.name, brand_model: i.brand_model, hsn_sac: i.hsn_sac, uom: i.uom, price: i.price, quantity: i.qty, tax: i.tax, discount: i.discount, subtotal: calculateItemTotal(i) })), extra };
      if (editId) { const r = await axios.put(`${API}/api/quotations/${editId}`, payload, getAuthConfig()); alert(`Version ${r.data.version || ""} saved`); }
      else { await axios.post(`${API}/api/quotations/create`, payload, getAuthConfig()); alert("Created successfully"); }
      setOpen(false); resetForm(); fetchList();
    } catch (err) { console.error(err); alert("Error saving Quotation: " + (err.response?.data?.message || err.message)); }
  };

  const resetForm = () => { setCustomer({ salutation: "", customer_name: "", mobile_number: "", email: "", gst_number: "", location_city: "" }); setItems([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]); setDescInput(""); setBrandInput(""); setQuotationData({ quotation_date: todayStr() }); setExtra(emptyExtra()); setEditId(null); setEditingIndex(null); };

  const handleDelete = async () => {
    if (!selectedId) return alert("Select an item to delete");
    if (!window.confirm("Are you sure?")) return;
    try {
      await axios.delete(`${API}/api/quotations/${selectedId}`, getAuthConfig());
      alert("Quotation deleted successfully");
      setSelectedId(null);
      fetchList();
    } catch (e) {
      console.error(e);
      alert("Failed to delete quotation: " + (e.response?.data?.message || e.response?.data?.error || e.message));
    }
  };

  const handleAddItem = () => {
    if (!descInput.trim()) return;
    const newItem = { name: descInput, brand_model: brandInput || "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 };
    if (editingIndex !== null) {
      const u = [...items];
      u[editingIndex] = { ...u[editingIndex], name: descInput, brand_model: brandInput || u[editingIndex].brand_model };
      setItems(u);
      setEditingIndex(null);
    } else {
      setItems(p => p.length === 1 && !p[0].name.trim() ? [newItem] : [...p, newItem]);
    }
    setDescInput("");
    setBrandInput("");
  };

  const updateItem = (i, f, v) => { const c = [...items]; c[i][f] = v; setItems(c); };
  const removeItemAtIndex = (index) => {
    setItems(p => p.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setDescInput("");
      setBrandInput("");
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const openMailModal = async () => {
    const id = viewId || selectedId;
    if (!id) return alert("Please select a quotation first");
    try {
      const res = await axios.get(`${API}/api/auth/check-email-config`, getAuthConfig());
      if (!res.data.hasConfig) {
        setShowSMTPPrompt(true);
        return;
      }
    } catch (e) {
      console.error("Error checking SMTP config before sending mail:", e);
    }
    const inv = findInvoice(id);
    let adminEmail = "";
    try {
      const adminRes = await axios.get(`${API}/api/auth/admin-email`, getAuthConfig());
      adminEmail = adminRes.data.email || "";
    } catch (e) {
      console.error("Error fetching admin email:", e);
      adminEmail = "admin@achme.com";
    }
    setMailTo(inv?.email || "");
    setMailCc(adminEmail);
    setMailSubject(`Proposal ${fmtQT(id, inv?.quotation_date || inv?.invoice_date)}`);
    setMailContent("");
    setMailOpen(true);
  };

  const handleSendEmail = async () => {
    const id = viewId || selectedId;
    if (!mailTo) return alert("Please enter recipient email");
    setMailSending(true);
    try { await axios.post(`${API}/api/quotations/send-email/${id}`, { to: mailTo, cc: mailCc, subject: mailSubject, body: mailContent }, getAuthConfig()); alert("Email sent"); setMailOpen(false); }
    catch (e) { alert(e.response?.data?.message || "Failed to send email"); } finally { setMailSending(false); }
  };

  const openHistory = async (e, id, name) => {
    e.stopPropagation();
    try {
      const res = await axios.get(`${API}/api/quotations/customer-history/${id}`, getAuthConfig());
      setHistoryList(res.data); setHistoryCustomerName(name); setHistorySearch("");
      const cur = list.find(p => p.id === id); setHistoryRootId(cur?.parent_id || id); setHistoryOpen(true);
    } catch (e) { alert("Failed to load history"); }
  };

  const deleteHistoryVersion = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this version?")) return;
    try {
      await axios.delete(`${API}/api/quotations/${id}`, getAuthConfig());
      setHistoryList(p => p.filter(q => q.id !== id));
      alert("Version deleted successfully");
    } catch (e) {
      console.error(e);
      alert("Failed to delete version: " + (e.response?.data?.message || e.response?.data?.error || e.message));
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await axios.patch(`${API}/api/quotations/${id}`, { status }, getAuthConfig());
      fetchList();
    } catch (err) { alert("Failed to update status: " + (err.response?.data?.message || err.message)); }
  };

  // ── Follow-up helpers ────────────────────────────────────────────────────
  const openFollowupPanel = async (e, inv) => {
    e.stopPropagation();
    setFollowupLeadId(inv.id);
    setFollowupLeadName(inv.customer_name);
    setNewFollowupDate(""); setNewFollowupTime(""); setNewFollowupNote("");
    try {
      const res = await axios.get(`${API}/api/leads/followups/quotation/${inv.id}`, getAuthConfig());
      setLeadFollowups(res.data);
    } catch (_) { setLeadFollowups([]); }
    setFollowupOpen(true);
  };
  const saveFollowup = async () => {
    if (!newFollowupDate) return alert("Please select a date");
    try {
      await axios.post(`${API}/api/leads/followups`, {
        lead_id: followupLeadId, lead_type: "quotation",
        followup_date: newFollowupDate, followup_time: newFollowupTime || null, followup_notes: newFollowupNote,
      }, getAuthConfig());
      const res = await axios.get(`${API}/api/leads/followups/quotation/${followupLeadId}`, getAuthConfig());
      setLeadFollowups(res.data);
      setNewFollowupDate(""); setNewFollowupTime(""); setNewFollowupNote("");
      fetchFollowupSummary();
    } catch (err) { alert("Failed to save follow-up: " + (err.response?.data?.error || err.message)); }
  };
  const deleteFollowup = async (id) => {
    await axios.delete(`${API}/api/leads/followups/${id}`, getAuthConfig());
    setLeadFollowups(prev => prev.filter(f => f.id !== id));
    fetchFollowupSummary();
  };
  const sendFollowupEmail = async () => {
    const inv = list.find(p => p.id === followupLeadId);
    if (!inv?.email) return alert("No email address found for this customer");
    try {
      setMailTo(inv.email);
      const adminRes = await axios.get(`${API}/api/auth/admin-email`, getAuthConfig()).catch(() => ({ data: {} }));
      setMailCc(adminRes.data?.email || "");
      setMailSubject(`Follow-up: ${fmtQT(inv.id, inv.quotation_date || inv.invoice_date)}`);
      setMailContent(`Dear ${inv.customer_name},\n\nThis is a follow-up regarding your quotation. Please let us know if you have any questions.\n\nThank you.`);
      setFollowupOpen(false);
      setMailOpen(true);
    } catch (err) { alert("Failed to open mail: " + err.message); }
  };
  const fmtFollowDate = (d) => d ? new Date(d.toString().split("T")[0]).toLocaleString("en-IN", { dateStyle: "medium" }) : "---";

  useEffect(() => { document.body.classList.toggle("modal-open", open || mailOpen); return () => document.body.classList.remove("modal-open"); }, [open, mailOpen]);

  const uniqueCreators = Array.from(new Set(list.map(item => item.creator_name).filter(Boolean)));

  const filtered = list.filter(q => {
    const matchesCustomer = q.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesDate = true;
    const dateStr = q.quotation_date || q.invoice_date;
    if (dateStr) {
      const invDate = new Date(dateStr.split("T")[0]);
      if (startDate && invDate < new Date(startDate)) matchesDate = false;
      if (endDate && invDate > new Date(endDate)) matchesDate = false;
    }
    let matchesStatus = true;
    if (statusFilter && statusFilter !== "All") matchesStatus = (q.status || "Pending") === statusFilter;
    let matchesCreator = true;
    if (creatorFilter && creatorFilter !== "All") matchesCreator = q.creator_name === creatorFilter;
    const fuSum = followupSummaryMap[q.id];
    let matchesFollowup = true;
    if (followupFilter === "has") matchesFollowup = !!(fuSum && fuSum.total_count > 0);
    else if (followupFilter === "today") matchesFollowup = !!(fuSum && fuSum.today_count > 0);
    else if (followupFilter === "pending") matchesFollowup = !!(fuSum && fuSum.pending_count > 0);
    let matchesFollowupDate = true;
    if (followupDateFilter && fuSum) matchesFollowupDate = fuSum.earliest_pending?.toString().slice(0, 10) === followupDateFilter;
    else if (followupDateFilter && !fuSum) matchesFollowupDate = false;
    return matchesCustomer && matchesDate && matchesStatus && matchesCreator && matchesFollowup && matchesFollowupDate;
  });

  const ST = ({ children }) => (<div className="flex items-center gap-2 mb-4 mt-6"><div className="h-1 w-6 bg-blue-500 rounded" /><h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">{children}</h3><div className="flex-1 h-px bg-blue-100" /></div>);


  return (
    <div className="w-full">
      {/* Header */}
      <div className="invoice-heading-tab flex gap-4 justify-between items-center flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#1694CE]">Quotation</h2>
          <nav className="text-sm text-gray-500">Dashboard &gt; Finance &gt; Quotation</nav>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-3 bg-gray-100 px-3 py-1 rounded-lg border h-10 mt-2">
            <Search size={18} className="text-gray-500" />
            <input type="text" placeholder="Search by customer..." className="outline-none text-sm w-40 bg-transparent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={async () => {
              const id = viewId || selectedId;
              if (!id) return alert("Please select a quotation first");
              try {
                const r = await fetch(`${API}/api/quotations/download-pdf/${id}`, {
                  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
                });
                if (!r.ok) { const err = await r.json(); return alert(err.message || "Download failed"); }
                if (!r.headers.get("content-type")?.includes("application/pdf")) { const err = await r.json(); return alert(err.message || "Server returned invalid response"); }
                const blob = await r.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Quotation_${fmtQT(id, findInvoice(id)?.quotation_date || findInvoice(id)?.invoice_date)}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { alert("Download failed: " + e.message); }
            }} className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition" title="Download PDF"><Download size={20} /></button>
            <button onClick={openMailModal} className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition" title="Send Email"><Mail size={18} /></button>
            <button onClick={() => { if (!selectedId) return alert("Please select a quotation first"); handleEdit(selectedId); }} className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition" title="Edit"><Edit2 size={18} /></button>
            {canEditDelete && (
              <button onClick={handleDelete} className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition" title="Delete"><Trash2 size={18} className="text-red-500" /></button>
            )}
          </div>
          <div className="mt-2">
            <button onClick={() => { resetForm(); setOpen(true); }} className="bg-[#FF3355] text-white w-12 h-12 rounded-full flex justify-center items-center shadow-lg hover:bg-[#e62848] transition"><Plus size={24} /></button>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {!viewId && (
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mt-6 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-xs font-bold text-gray-500 uppercase">Start Date</span>
            <input type="date" className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-xs font-bold text-gray-500 uppercase">End Date</span>
            <input type="date" className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-xs font-bold text-gray-500 uppercase">Status</span>
            <select className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              {QUOTATION_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(userRole === "admin" || userRole === "subadmin") && (
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-xs font-bold text-gray-500 uppercase">Created By</span>
              <select className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer" value={creatorFilter} onChange={e => setCreatorFilter(e.target.value)}>
                <option value="All">All Creators</option>
                {uniqueCreators.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1 min-w-[170px]">
            <span className="text-xs font-bold text-gray-500 uppercase">Follow-up Filter</span>
            <select value={followupFilter} onChange={e => setFollowupFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition cursor-pointer">
              <option value="">All Records</option>
              <option value="has">Has Follow-ups</option>
              <option value="today">Today&apos;s Follow-ups</option>
              <option value="pending">Pending Follow-ups</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[150px]">
            <span className="text-xs font-bold text-gray-500 uppercase">Follow-up Date</span>
            <input type="date" value={followupDateFilter} onChange={e => setFollowupDateFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 outline-none text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white transition" />
          </div>
          <button onClick={() => { setStartDate(""); setEndDate(""); setStatusFilter(""); setCreatorFilter(""); setSearchTerm(""); setFollowupFilter(""); setFollowupDateFilter(""); }} className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition h-10 flex items-center justify-center gap-1 shadow-sm">Reset Filters</button>
        </div>
      )}

      {/* List Table */}
      {!viewId && (
        <div className="bg-white shadow-sm rounded-xl mt-6 overflow-hidden border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse min-w-[600px]">
            <thead className="bg-[#f8fafc]">
              <tr className="text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
                <th className="px-4 py-4 border-r">QT Number</th>
                <th className="px-4 py-4 border-r">Customer</th>
                <th className="px-4 py-4 border-r">Email</th>
                <th className="px-4 py-4 border-r">Mobile</th>
                <th className="px-4 py-4 border-r">City</th>
                <th className="px-4 py-4 border-r">Date</th>
                <th className="px-4 py-4 border-r">Total</th>
                {(userRole === "admin" || userRole === "subadmin") && <th className="px-4 py-4 border-r">Created By</th>}
                <th className="px-4 py-4 border-r">Status</th>
                <th className="px-4 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const sc = QUOTATION_STATUS_COLORS[p.status] || QUOTATION_STATUS_COLORS.Pending;
                return (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)} onDoubleClick={() => { setViewId(p.id); setTimeout(() => setShowInvoice(true), 50); }} className={`cursor-pointer border-b hover:bg-gray-50 transition ${selectedId === p.id ? "bg-blue-50/50" : ""}`}>
                    <td className="px-4 py-4 border-r font-medium text-blue-600">{fmtQT(p.id, p.quotation_date || p.invoice_date)}</td>
                    <td className="px-4 py-4 border-r">{p.customer_name}</td>
                    <td className="px-4 py-4 border-r text-gray-500">{p.email || "---"}</td>
                    <td className="px-4 py-4 border-r">{p.mobile_number}</td>
                    <td className="px-4 py-4 border-r text-gray-500">{[p.location_city, p.client_state, p.client_country].filter(Boolean).join(", ") || "---"}</td>
                    <td className="px-4 py-4 border-r">{fmtDate(p.quotation_date || p.invoice_date)}</td>
                    <td className="px-4 py-4 border-r font-bold text-gray-900">&#8377;{p.grand_total?.toLocaleString()}</td>
                    {(userRole === "admin" || userRole === "subadmin") && <td className="px-4 py-4 border-r font-medium text-gray-700">{p.creator_name || "---"}</td>}
                    <td className="px-4 py-4 border-r">
                      <select
                        value={p.status || "Pending"}
                        onClick={e => e.stopPropagation()}
                        onChange={e => handleStatusUpdate(p.id, e.target.value)}
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${sc.bg} ${sc.text} ${sc.border}`}
                      >
                        {QUOTATION_STATUS.map(s => <option key={s} value={s} className="bg-white text-gray-700 font-normal">{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex gap-2 justify-center flex-wrap">
                        <button onClick={e => { e.stopPropagation(); setViewId(p.id); setTimeout(() => setShowInvoice(true), 50); }} title="View" className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition flex items-center gap-1"><Eye size={12} /> View</button>
                        <button onClick={e => { e.stopPropagation(); handleEdit(p.id); }} title="Edit" className="px-2 py-1 rounded text-xs font-bold bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition flex items-center gap-1"><Edit2 size={12} /> Edit</button>
                        <button onClick={e => { e.stopPropagation(); setWaModal({ open: true, quote: p }); }} title="Send Interactive WhatsApp Proposal Reminder" className="px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1"><MessageCircle size={12} /> WhatsApp</button>
                        <button onClick={e => { e.stopPropagation(); setSelectedId(p.id); openHistory(e, p.id, p.customer_name); }} title="History" className="px-2 py-1 rounded text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-1"><History size={12} /> History</button>
                        <button onClick={e => openFollowupPanel(e, p)} title="Follow-ups"
                          className={`px-2 py-1 rounded text-xs font-bold border transition flex items-center gap-1 ${followupSummaryMap[p.id]?.today_count > 0 ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : followupSummaryMap[p.id]?.pending_count > 0 ? "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                          <Clock size={12} /> Follow-ups
                          {followupSummaryMap[p.id]?.pending_count > 0 && (
                            <span className={`ml-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${followupSummaryMap[p.id]?.today_count > 0 ? "bg-red-500 text-white" : "bg-cyan-500 text-white"}`}>{followupSummaryMap[p.id]?.pending_count}</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (<tr><td colSpan={(userRole === "admin" || userRole === "subadmin") ? 10 : 9} className="py-10 text-gray-400 italic">No quotations found</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      <div className={`overlay ${open ? "show" : ""} flex justify-center items-start overflow-y-auto pt-6 pb-10`}>
        <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-5xl p-8 relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{editId ? "Edit Quotation" : "Create Quotation"}</h2>
            <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => { setOpen(false); resetForm(); }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            <ST>From Address</ST>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
                <select value={extra.supplier_branch} onChange={e => {
                  const branch = e.target.value;
                  const branchInfo = BRANCH_DATA[branch];
                  setExtra(ex => ({
                    ...ex, supplier_branch: branch,
                    from_address_custom: branchInfo ? `${branchInfo.address} | GSTIN: ${branchInfo.gstin}` : ex.from_address_custom,
                    from_address_id: ""
                  }));
                }} className="border rounded-lg px-3 py-2 outline-none bg-white text-sm">
                  <option value="">-- Select Branch --</option>
                  {BRANCH_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label} ({b.state})</option>)}
                </select>
              </div>
              {/* 
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Office Address</label>
                <select value={extra.from_address_id} onChange={e => {
                  const val = e.target.value;
                  if (val === "ADD_NEW") setExtra(ex => ({ ...ex, from_address_id: "", from_address_custom: "" }));
                  else if (BRANCH_DATA[val]) setExtra(ex => ({ ...ex, from_address_id: "", from_address_custom: `${BRANCH_DATA[val].address} | GSTIN: ${BRANCH_DATA[val].gstin}` }));
                  else setExtra(ex => ({ ...ex, from_address_id: val, from_address_custom: "" }));
                }} className="border rounded-lg px-3 py-2 outline-none bg-white text-sm">
                  <option value="">-- Select Address --</option>
                  {fromAddresses.map(a => <option key={a.id} value={a.id}>{a.label} — {a.address.substring(0, 40)}...</option>)}
                  <option value="ADD_NEW">+ Add New Custom Address</option>
                </select>
              </div>
              */}
            </div>

            {extra.from_address_custom && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800 flex-wrap">
                <MapPin size={12} /> <span>{extra.from_address_custom}</span>
              </div>
            )}

            {/* 
            {extra.supplier_branch && (
              <div className="mt-2 border rounded-xl overflow-hidden">
                <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                  <MapPin size={13} /> Selected Branch Address
                </div>
                <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3">
                  <p className="text-sm font-semibold text-indigo-900">{extra.supplier_branch}</p>
                  <p className="text-xs text-indigo-700 mt-1">{BRANCH_DATA[extra.supplier_branch]?.address}</p>
                  <p className="text-xs text-indigo-600 font-mono mt-1">GSTIN: {BRANCH_DATA[extra.supplier_branch]?.gstin}</p>
                </div>
                <div className="bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">Other Branches</div>
                {BRANCH_OPTIONS.filter(b => b.value !== extra.supplier_branch).map(b => (
                  <div key={b.value} className="px-4 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-100 transition cursor-pointer" onClick={() => {
                    const branchInfo = BRANCH_DATA[b.value];
                    setExtra(ex => ({
                      ...ex, supplier_branch: b.value,
                      from_address_custom: branchInfo ? `${branchInfo.address} | GSTIN: ${branchInfo.gstin}` : ex.from_address_custom,
                      from_address_id: ""
                    }));
                  }}>
                    <p className="text-sm font-semibold text-gray-800">{b.label} <span className="text-xs font-normal text-gray-400">({b.state})</span></p>
                    <p className="text-xs text-gray-600 mt-0.5">{BRANCH_DATA[b.value]?.address}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">GSTIN: {BRANCH_DATA[b.value]?.gstin}</p>
                  </div>
                ))}
              </div>
            )}
            */}

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowAddAddress(p => !p)} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> Add New Address</button>
            </div>
            {showAddAddress && (
              <div className="bg-gray-50 border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={newAddrLabel} onChange={e => setNewAddrLabel(e.target.value)} placeholder="Label (e.g. Coimbatore)" className="border rounded-lg px-3 py-2 text-sm outline-none" />
                <input value={newAddrText} onChange={e => setNewAddrText(e.target.value)} placeholder="Full address..." className="border rounded-lg px-3 py-2 text-sm outline-none col-span-1 md:col-span-1" />
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddAddress} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">Save</button>
                  <button type="button" onClick={() => setShowAddAddress(false)} className="bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm">Cancel</button>
                </div>
              </div>
            )}

            <div className="mt-4 p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h4 className="text-sm font-black text-blue-800 uppercase tracking-tighter flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>Bank Details</h4>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Bank A/C:</label>
                  <select value={extra.bank_details_id} onChange={e => {
                    const b = BANK_DETAILS.find(x => x.id === e.target.value);
                    if (b) setExtra(ex => ({ ...ex, bank_details_id: e.target.value, bank_company: b.company, bank_name: b.bank, bank_account: b.account, bank_ifsc: b.ifsc, bank_branch: b.branch }));
                  }} className="text-[11px] border-none rounded bg-white shadow-sm px-2 py-1 outline-none font-bold text-slate-600 cursor-pointer">
                    {BANK_DETAILS.map(b => <option key={b.id} value={b.id}>{b.bank} A/C: ***{b.account.slice(-4)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                <div className="flex items-center border-b border-slate-100 pb-1"><span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Company</span><span className="mr-3 text-slate-300">:</span><input type="text" value={extra.bank_company} onChange={e => setExtra(ex => ({ ...ex, bank_company: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" /></div>
                <div className="flex items-center border-b border-slate-100 pb-1"><span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Bank</span><span className="mr-3 text-slate-300">:</span><input type="text" value={extra.bank_name} onChange={e => setExtra(ex => ({ ...ex, bank_name: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" /></div>
                <div className="flex items-center border-b border-slate-100 pb-1"><span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Account</span><span className="mr-3 text-slate-300">:</span><input type="text" value={extra.bank_account} onChange={e => setExtra(ex => ({ ...ex, bank_account: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" /></div>
                <div className="flex items-center border-b border-slate-100 pb-1"><span className="w-20 text-[11px] font-bold text-slate-500 uppercase">IFSC</span><span className="mr-3 text-slate-300">:</span><input type="text" value={extra.bank_ifsc} onChange={e => setExtra(ex => ({ ...ex, bank_ifsc: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none uppercase" /></div>
                <div className="flex items-center border-b border-slate-100 pb-1 md:col-span-2"><span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Branch</span><span className="mr-3 text-slate-300">:</span><input type="text" value={extra.bank_branch} onChange={e => setExtra(ex => ({ ...ex, bank_branch: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" /></div>
              </div>
            </div>

            <ST>Client Details (To Address)</ST>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Quotation Date *</label>
                <input type="date" value={quotationData.quotation_date} onChange={e => setQuotationData({ ...quotationData, quotation_date: e.target.value })} className="border rounded-lg px-3 py-2 outline-none text-sm" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Company Name</label>
                <input type="text" value={extra.client_company} onChange={e => setExtra(ex => ({ ...ex, client_company: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Customer Name *</label>
                <div className="flex gap-2">
                  <select
                    value={customer.salutation || ""}
                    onChange={e => setCustomer({ ...customer, salutation: e.target.value })}
                    className="border border-gray-200 rounded-xl px-2.5 py-2 outline-none bg-white text-sm font-semibold w-24 flex-shrink-0 cursor-pointer focus:border-blue-500 focus:ring-4 focus:ring-blue-50/50 transition-all"
                  >
                    <option value="">-- Title --</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="M/S.">M/S.</option>
                  </select>
                  <div className="flex-grow">
                    <ClientSearchDropdown
                      value={customer.customer_name}
                      onSelect={(client) => {
                        const parsed = parseName(client.name || "");
                        setCustomer({
                          salutation: parsed.salutation,
                          customer_name: parsed.name,
                          mobile_number: client.phone || "",
                          email: client.email || client.lead_email || "",
                          gst_number: client.gst_number || "",
                          location_city: client.lead_city || client.city || ""
                        });
                        setExtra(ex => ({
                          ...ex,
                          client_company: client.company_name || "",
                          client_address1: client.address || "",
                          client_address2: client.address_2 || "",
                          client_city: client.lead_city || client.city || "",
                          client_state: client.state || "",
                          client_pincode: client.pincode || "",
                          client_country: "India"
                        }));
                      }}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Mobile Number *</label>
                <input type="text" value={customer.mobile_number} onChange={e => { if (/^\d{0,13}$/.test(e.target.value)) setCustomer({ ...customer, mobile_number: e.target.value }); }} maxLength={13} className="border rounded-lg px-3 py-2 outline-none text-sm" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                <input type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">GST Number</label>
                <input type="text" value={customer.gst_number} onChange={e => {
                  const val = e.target.value.toUpperCase();
                  setCustomer({ ...customer, gst_number: val });
                  if (val.length >= 2) {
                    const stateCode = val.substring(0, 2);
                    const stateName = GST_STATE_MAP[stateCode];
                    if (stateName) setExtra(ex => ({ ...ex, client_state: stateName }));
                  }
                }} placeholder="33AABCA1234D1Z5" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Address Line 1</label>
                <input type="text" value={extra.client_address1} onChange={e => setExtra(ex => ({ ...ex, client_address1: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Address Line 2</label>
                <input type="text" value={extra.client_address2} onChange={e => setExtra(ex => ({ ...ex, client_address2: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">City / District</label>
                <input type="text" value={extra.client_city} onChange={e => setExtra(ex => ({ ...ex, client_city: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">State</label>
                <select value={extra.client_state} onChange={e => setExtra(ex => ({ ...ex, client_state: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm bg-white">
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">PIN Code</label>
                <input type="text" value={extra.client_pincode} onChange={e => { if (/^\d{0,6}$/.test(e.target.value)) setExtra(ex => ({ ...ex, client_pincode: e.target.value })); }} maxLength={6} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Country</label>
                <input type="text" value={extra.client_country} readOnly className="border rounded-lg px-3 py-2 outline-none bg-gray-50 text-sm" />
              </div>
            </div>

            <ST>Quote Items</ST>
            <div className="flex flex-col gap-1 mb-3">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                  <textarea value={descInput} onChange={e => setDescInput(e.target.value)} placeholder="e.g. Laptop, specs..." className="w-full border rounded-lg px-3 py-2 outline-none min-h-[60px] text-sm" />
                </div>
                {/* 
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Brand / Model</label>
                  <textarea value={brandInput} onChange={e => setBrandInput(e.target.value)} placeholder="e.g. Dell, Cisco..." className="w-full border rounded-lg px-3 py-2 outline-none min-h-[60px] text-sm" />
                </div>
                */}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1" />
                <button type="button" onClick={handleAddItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold h-fit hover:bg-blue-700 transition">{editingIndex !== null ? "Update Item" : "Add Item"}</button>
              </div>
              <p className="text-[10px] text-orange-500 italic font-medium">Content before the first comma will be bolded in the template</p>
            </div>
            <div className="border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-center text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-gray-600 font-bold uppercase text-[10px]">
                    <th className="px-3 py-3 text-left">S.No</th>
                    <th className="px-3 py-3 text-left">Brand / Model</th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-left">HSN/SAC</th>
                    <th className="px-3 py-3">UOM</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3">Tax %</th>
                    <th className="px-3 py-3">Disc (&#8377;)</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className={`border-b last:border-0 ${editingIndex === i ? "bg-blue-50" : ""}`}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <input type="text" value={item.brand_model} onChange={e => updateItem(i, "brand_model", e.target.value)} onClick={() => { setDescInput(item.name); setBrandInput(item.brand_model); setEditingIndex(i); }} className="w-full outline-none bg-transparent text-sm cursor-text hover:text-blue-600" placeholder="Brand / Model" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={item.name} onChange={e => updateItem(i, "name", e.target.value)} onClick={() => { setDescInput(item.name); setBrandInput(item.brand_model); setEditingIndex(i); }} className="w-full outline-none bg-transparent text-sm cursor-text hover:text-blue-600 font-medium" placeholder="Enter item description..." />
                      </td>
                      <td className="px-3 py-2"><input type="text" value={item.hsn_sac} onChange={e => updateItem(i, "hsn_sac", e.target.value)} className="w-full outline-none bg-transparent text-sm" placeholder="HSN/SAC" /></td>
                      <td className="px-3 py-2">
                        <select value={item.uom} onChange={e => updateItem(i, "uom", e.target.value)} className="border rounded px-2 py-1 text-xs outline-none bg-white">
                          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" value={item.price} onChange={e => updateItem(i, "price", Number(e.target.value))} className="w-20 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.qty} onChange={e => updateItem(i, "qty", Number(e.target.value))} className="w-12 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.tax} onChange={e => updateItem(i, "tax", Number(e.target.value))} className="w-12 text-center bg-transparent outline-none text-sm border-b border-gray-200" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.discount} onChange={e => updateItem(i, "discount", Number(e.target.value))} className="w-20 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2 text-right font-bold text-sm">&#8377;{calculateItemTotal(item).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeItemAtIndex(i)} className="p-1 rounded text-red-500 hover:bg-red-50 transition" title="Remove this line">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-72 border rounded-xl p-4 bg-gray-50 shadow-sm">
                {(() => {
                  const t = getTotals();
                  const gstMode = extra.gst_mode || "Exclusive";
                  const taxableValue = gstMode === "Inclusive" ? t.subtotal - t.total_discount - t.total_cgst - t.total_sgst - t.total_igst : t.subtotal - t.total_discount;
                  return (<>
                    <div className="flex justify-between text-sm text-gray-600 py-1"><span>Subtotal</span><span className="font-medium">&#8377;{t.subtotal.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm text-gray-600 py-1"><span>Discount</span><span className="font-medium">-&#8377;{t.total_discount.toLocaleString()}</span></div>
                    {gstMode === "Inclusive" && (
                      <div className="flex justify-between text-sm py-1 text-gray-600"><span>Taxable Value</span><span className="font-medium">&#8377;{taxableValue.toLocaleString()}</span></div>
                    )}
                    <div className="flex justify-between text-sm py-1" style={{ color: t.total_cgst > 0 ? "#4b5563" : "#d1d5db" }}><span>CGST</span><span className="font-medium">&#8377;{t.total_cgst.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm py-1" style={{ color: t.total_sgst > 0 ? "#4b5563" : "#d1d5db" }}><span>SGST</span><span className="font-medium">&#8377;{t.total_sgst.toLocaleString()}</span></div>
                    <div className="flex justify-between text-sm py-1" style={{ color: t.total_igst > 0 ? "#4b5563" : "#d1d5db" }}><span>IGST</span><span className="font-medium">&#8377;{t.total_igst.toLocaleString()}</span></div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 text-lg font-bold text-blue-700"><span>Grand Total</span><span>&#8377;{t.grand_total.toLocaleString()}</span></div>
                  </>);
                })()}
              </div>
            </div>

            <ST>Executive Details</ST>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Executive Name</label>
                <input type="text" value={extra.exec_name} onChange={e => setExtra(ex => ({ ...ex, exec_name: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Contact Number</label>
                <input type="text" value={extra.exec_phone} onChange={e => { if (/^\d{0,13}$/.test(e.target.value)) setExtra(ex => ({ ...ex, exec_phone: e.target.value })); }} maxLength={13} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Email ID</label>
                <input type="email" value={extra.exec_email} onChange={e => setExtra(ex => ({ ...ex, exec_email: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
            </div>

            <ST>Terms &amp; Conditions</ST>
            <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={extra.terms_general} onChange={e => setExtra(ex => ({ ...ex, terms_general: e.target.checked }))} className="mt-1 accent-blue-600 w-4 h-4" />
                  <div><p className="text-sm font-semibold text-gray-700">General Terms &amp; Conditions</p><p className="text-xs text-gray-500">Standard terms apply to this quotation</p></div>
                </label>
                <div className="flex flex-col gap-1 ml-7">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Custom Note</label>
                  <input type="text" value={extra.custom_terms} onChange={e => setExtra(ex => ({ ...ex, custom_terms: e.target.value }))} placeholder="Additional terms..." className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" />
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={extra.terms_tax} onChange={e => setExtra(ex => ({ ...ex, terms_tax: e.target.checked }))} className="mt-1 accent-blue-600 w-4 h-4" />
                <div><p className="text-sm font-semibold text-gray-700">Tax Exempt</p><p className="text-xs text-gray-500">Prices quoted are exclusive of Sales and Service Tax (SEZ - NIL Tax applicable)</p></div>
              </label>
              {!extra.terms_tax && (
                <div className="ml-7">
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">GST Mode</label>
                  <div className="flex flex-wrap gap-3">
                    {GST_MODES.map(mode => (
                      <label key={mode} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition text-sm ${extra.gst_mode === mode ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                        <input type="radio" name="gst_mode" value={mode} checked={extra.gst_mode === mode} onChange={e => setExtra(ex => ({ ...ex, gst_mode: e.target.value }))} className="accent-blue-600" />
                        <span>{mode} — {mode === "Exclusive" ? "GST added to price" : mode === "Inclusive" ? "GST included in price" : "No GST charged"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Project Period</label>
                <input type="text" value={extra.terms_project_period} onChange={e => setExtra(ex => ({ ...ex, terms_project_period: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Validity</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  {VALIDITY_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition ${extra.terms_validity === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                      <input type="radio" name="qt_validity" value={opt} checked={extra.terms_validity === opt} onChange={e => setExtra(ex => ({ ...ex, terms_validity: e.target.value }))} className="accent-blue-600" />
                      <span className="text-xs">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment Terms</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition ${extra.terms_payment === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="qt_payment" value={opt} checked={extra.terms_payment === opt} onChange={e => setExtra(ex => ({ ...ex, terms_payment: e.target.value }))} className="accent-blue-600" />
                      {opt}
                    </label>
                  ))}
                </div>
                {extra.terms_payment === "Custom" && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      value={extra.terms_payment_custom ? extra.terms_payment_custom.replace(" Days", "") : ""}
                      onChange={e => {
                        const val = e.target.value;
                        setExtra(ex => ({ ...ex, terms_payment_custom: val ? `${val} Days` : "" }));
                      }}
                      placeholder="Enter number of days..."
                      className="border rounded-lg px-3 py-2 outline-none text-sm w-48 bg-white"
                    />
                    <span className="text-sm text-gray-600 font-medium">Days</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Warranty</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {WARRANTY_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-xs transition ${extra.terms_warranty === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="qt_warranty" value={opt} checked={extra.terms_warranty === opt} onChange={e => setExtra(ex => ({ ...ex, terms_warranty: e.target.value }))} className="accent-blue-600" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <ST>Attached Images</ST>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-xs text-gray-500 mb-3">Attach up to 3 product/reference images (auto-compressed to JPEG)</p>
              <div className="flex gap-4 flex-wrap">
                {[0, 1, 2].map(idx => {
                  const currentImage = extra.terms_separate_orders?.attached_images?.[idx];
                  return (
                    <div key={idx} className="relative w-32 h-28 border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white flex items-center justify-center hover:border-blue-400 transition">
                      {currentImage ? (
                        <>
                          <img src={currentImage} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => { const nl = [...(extra.terms_separate_orders?.attached_images || [])]; nl.splice(idx, 1); setExtra(ex => ({ ...ex, terms_separate_orders: { ...(ex.terms_separate_orders || {}), attached_images: nl } })); }} className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition"><X size={12} /></button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2 text-center">
                          <Plus size={20} className="text-gray-400" />
                          <span className="text-[10px] text-gray-500 mt-1 font-semibold">Upload Image</span>
                          <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const compressed = await resizeAndCompressImage(file); const nl = [...(extra.terms_separate_orders?.attached_images || [])]; nl[idx] = compressed; setExtra(ex => ({ ...ex, terms_separate_orders: { ...(ex.terms_separate_orders || {}), attached_images: nl } })); }} className="hidden" />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button type="submit" className="bg-blue-600 text-white px-10 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-lg transition">{editId ? "Update Quotation" : "Create Quotation"}</button>
              <button type="button" onClick={() => { setOpen(false); resetForm(); }} className="bg-gray-200 text-gray-600 px-10 py-2.5 rounded-lg hover:bg-gray-300 font-bold transition">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      {/* Mail Modal */}
      <div className={`overlay ${mailOpen ? "show" : ""} flex justify-center items-center`}>
        <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-lg p-8 relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Mail size={20} /> Send Quotation</h2>
            <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => setMailOpen(false)} />
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">To (Email)</label>
              <input type="email" value={mailTo} onChange={e => setMailTo(e.target.value)} className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-100" placeholder="recipient@email.com" />
            </div>
            {/* CC admin email sent silently — not shown to user */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
              <input type="text" value={mailSubject} onChange={e => setMailSubject(e.target.value)} className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Content (Optional)</label>
              <textarea value={mailContent} onChange={e => setMailContent(e.target.value)} rows={4} className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-100 resize-none text-sm" placeholder="Enter custom email message... (Default greeting will be sent if empty)" />
            </div>
          </div>
          <div className="flex gap-4 pt-6">
            <button onClick={handleSendEmail} disabled={mailSending} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow transition disabled:opacity-60">{mailSending ? "Sending..." : "Send Email"}</button>
            <button onClick={() => setMailOpen(false)} className="bg-gray-200 text-gray-600 px-8 py-2.5 rounded-lg hover:bg-gray-300 font-bold transition">Cancel</button>
          </div>
        </div>
      </div>

      {/* Version History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-3xl p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><History size={20} className="text-indigo-500" /> Previous Versions</h2>
                <p className="text-sm text-indigo-600 font-semibold">{historyCustomerName}</p>
              </div>
              <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => setHistoryOpen(false)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr className="text-gray-600 font-bold uppercase text-xs border-b">
                    <th className="px-4 py-3 text-left">QT Number</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(q => (
                    <tr key={q.id}
                      onClick={() => setSelectedId(q.id)}
                      onDoubleClick={() => { setViewId(q.id); setTimeout(() => setShowInvoice(true), 50); setHistoryOpen(false); }}
                      className="border-b cursor-pointer hover:bg-indigo-50/40 transition">
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        {fmtSubQT(historyRootId, q.version, q.invoice_date)}
                        <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">v{q.version || 1}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{fmtDate(q.invoice_date || q.quotation_date)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">&#8377;{q.grand_total?.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={e => { e.stopPropagation(); setViewId(q.id); setTimeout(() => setShowInvoice(true), 50); setHistoryOpen(false); }} title="View" className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100"><Eye size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); handleEdit(q.id); setHistoryOpen(false); }} title="Edit" className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-100"><Edit2 size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); setWaModal({ open: true, quote: q }); setHistoryOpen(false); }} title="Send Interactive WhatsApp" className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100"><MessageCircle size={14} /></button>
                          <button onClick={e => { e.stopPropagation(); setSelectedId(q.id); openMailModal(); setHistoryOpen(false); }} title="Email" className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center hover:bg-orange-100"><Mail size={14} /></button>
                          {canEditDelete && (
                            <button onClick={e => deleteHistoryVersion(e, q.id)} title="Delete" className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {historyList.length === 0 && <tr><td colSpan="4" className="py-10 text-center text-gray-400 italic">No previous versions</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Follow-up Panel ── */}
      {followupOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-center items-start overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Clock size={18} className="text-cyan-500" /> Follow-ups — {followupLeadName}</h2>
              <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => setFollowupOpen(false)} />
            </div>
            <button onClick={sendFollowupEmail} className="w-full mb-4 bg-cyan-600 text-white py-2 rounded-lg font-bold hover:bg-cyan-700 text-sm flex items-center justify-center gap-2"><Mail size={15} /> Send Follow-up Email</button>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase">Set New Follow-up</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500 font-semibold">Date *</label><input type="date" value={newFollowupDate} onChange={e => setNewFollowupDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1" /></div>
                <div><label className="text-xs text-gray-500 font-semibold">Time</label><input type="time" value={newFollowupTime} onChange={e => setNewFollowupTime(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1" /></div>
              </div>
              <div><label className="text-xs text-gray-500 font-semibold">Reason / Note</label><input type="text" value={newFollowupNote} onChange={e => setNewFollowupNote(e.target.value)} placeholder="e.g. Call to confirm" className="w-full border rounded-lg px-3 py-2 text-sm outline-none mt-1" /></div>
              <button onClick={saveFollowup} className="w-full bg-cyan-600 text-white py-2 rounded-lg font-bold hover:bg-cyan-700 text-sm">+ Add Follow-up</button>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Existing Follow-ups</p>
            {leadFollowups.length === 0 ? <p className="text-xs text-gray-400 italic">No follow-ups yet.</p> : (
              <div className="space-y-2">{leadFollowups.map(f => (
                <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${f.status === "Done" ? "bg-green-50 border-green-200" : "bg-cyan-50 border-cyan-200"}`}>
                  <div><div className="font-semibold">{fmtFollowDate(f.followup_date)}{f.followup_time ? ` at ${f.followup_time}` : ""}</div>{f.followup_notes && <div className="text-gray-500 text-xs mt-0.5">{f.followup_notes}</div>}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.status === "Done" ? "bg-green-600 text-white" : "bg-cyan-600 text-white"}`}>{f.status}</span>
                    {f.status === "Pending" && <button onClick={() => { axios.put(`${API}/api/leads/followups/${f.id}`, { status: "Done" }, getAuthConfig()); setLeadFollowups(prev => prev.map(x => x.id === f.id ? { ...x, status: "Done" } : x)); }} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded font-bold">Done</button>}
                    <button onClick={() => deleteFollowup(f.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Preview */}
      {viewId && showinvoice && (
        <div key={viewId} ref={invoiceRef} className="w-full mt-6 bg-white shadow-xl p-6 relative">
          <div className="flex gap-3 absolute right-6 top-6 z-10">
            <X className="cursor-pointer text-gray-400 hover:text-red-500 bg-white rounded-full p-1" onClick={() => { setViewId(null); setShowInvoice(false); }} />
          </div>
          <Invoice quotationId={viewId} type="quotation" />
        </div>
      )}
      {showSMTPPrompt && (
        <SMTPConfigPrompt
          email={(() => { try { return JSON.parse(localStorage.getItem("user") || "{}").email || ""; } catch { return ""; } })()}
          onClose={() => setShowSMTPPrompt(false)}
        />
      )}

      {/* 1-Click WhatsApp Interactive Proposal Reminder Modal */}
      {waModal.open && (
        <SendWhatsAppReminderModal
          isOpen={waModal.open}
          onClose={() => setWaModal({ open: false, quote: null })}
          defaultPhone={waModal.quote?.mobile_number || ""}
          defaultContactName={waModal.quote?.customer_name || waModal.quote?.client_company || "Customer"}
          reminderType="quotation_followup"
          refTable="quotations"
          refId={waModal.quote?.id}
          refTitle={`Quotation #${waModal.quote?.id} (₹${waModal.quote?.grand_total?.toLocaleString() || "0"})`}
        />
      )}
    </div>
  );
};

export default Quotation;