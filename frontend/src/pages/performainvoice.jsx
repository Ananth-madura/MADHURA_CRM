import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, Download, X, Edit2, MinusCircle, Trash2, Mail, MapPin, History, FileText } from "lucide-react";
import ClientSearchDropdown from "../components/ClientSearchDropdown";
import Invoice from "../components/invoicetemplate";
import { calculateItemTotal } from "../utils/invoicecal";
import { downloadAsHtml } from "../utils/downloadHtml";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";
import { BRANCH_DATA, BRANCH_OPTIONS } from "../config/branchConfig";
import SMTPConfigPrompt from "../components/SMTPConfigPrompt";


const API_BACKEND = API;

const UOM_OPTIONS = ["Nos", "Units", "Pieces", "Boxes", "Sets", "Meters", "Kg", "Liters"];
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];
const VALIDITY_OPTIONS = ["2 days", "5 days", "10 days", "15 days", "30 days"];
const PAYMENT_OPTIONS = ["100% Advance", "Payment Against Delivery", "15 Days", "30 Days", "45 Days", "Custom"];
const WARRANTY_OPTIONS = ["No Warranty", "Testing Warranty", "1 Month", "3 Months", "6 Months", "12 Months", "24 Months", "36 Months", "OEM Warranty", "Supplier Warranty", "OEM Hardware Warranty", "No Software Warranty"];

const GST_MODES = ["Exclusive", "Inclusive", "Exempt"];
const STATUS_OPTIONS = ["Send", "Pending", "Close", "Billed", "Cancel"];
const STATUS_COLORS = {
  Send: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  Pending: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  Close: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-200" },
  Billed: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  Cancel: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};
const GST_STATE_MAP = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
  "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Dadra and Nagar Haveli and Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh"
};

const BANK_DETAILS_CONFIG = [
  { id: "hdfc", company: "ACHME COMMUNICATION", bank: "HDFC BANK", account: "00312320005822", ifsc: "HDFC0000031", branch: "Coimbatore" },
  { id: "kotak", company: "Achme Communication", bank: "KOTAK MAHINDRA BANK", account: "9211242667", ifsc: "KKBK0000491", branch: "Avinashi Road, Coimbatore" }
];

const emptyExtra = () => ({
  from_address_id: "", from_address_custom: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004 | GSTIN: 33AAHFA7876M1ZX",
  client_company: "", client_address1: "", client_address2: "",
  client_city: "", client_state: "", client_pincode: "", client_country: "India",
  tax_type: "GST18", custom_tax: "",
  exec_name: "", exec_phone: "", exec_email: "",
  terms_general: false, terms_tax: false,
  terms_project_period: "30-60 days from Purchase Order date",
  terms_validity: "15 days",
  terms_separate_orders: { material: false, installation: false, usd: false, boq: false },
  terms_payment: "", terms_payment_custom: "", terms_warranty: "",
  supplier_branch: "Coimbatore",
  bank_details_id: "hdfc",
  bank_company: "ACHME COMMUNICATION",
  bank_name: "HDFC BANK",
  bank_account: "00312320005822",
  bank_ifsc: "HDFC0000031",
  bank_branch: "Coimbatore",
  custom_terms: "",
  gst_mode: "Exclusive",
});

const PerformaInvoice = () => {
  const { user } = useAuth();
  const userRole = user?.role || "employee";
  const canEditDelete = userRole === "admin" || userRole === "subadmin";
  const [performaInvoices, setPerformaInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [fromAddresses, setFromAddresses] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [showinvoice, setShowInvoice] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mailOpen, setMailOpen] = useState(false);
  const [mailTo, setMailTo] = useState("");
  const [mailCc, setMailCc] = useState("");
  const [mailSubject, setMailSubject] = useState("");
  const [mailContent, setMailContent] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [showSMTPPrompt, setShowSMTPPrompt] = useState(false);
  const [descInput, setDescInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddrLabel, setNewAddrLabel] = useState("");
  const [newAddrText, setNewAddrText] = useState("");

  const [items, setItems] = useState([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
  const [customer, setCustomer] = useState({ customer_name: "", mobile_number: "", email: "", gst_number: "", location_city: "" });
  const [performaInvoice, setPerformaInvoice] = useState({ invoice_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() });
  const [extra, setExtra] = useState(emptyExtra());
  const [editingIndex, setEditingIndex] = useState(null);

  const invoiceRef = useRef(null);

  // ── Version History ──────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [historyCustomerName, setHistoryCustomerName] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyRootId, setHistoryRootId] = useState(null);

  const formatPINumber = (id, dateStr) => {
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    return `PI-${year}-${String(id).padStart(3, "0")}`;
  };

  const findInvoice = (id) => performaInvoices.find(p => p.id === id) || historyList.find(p => p.id === id);

  const downloadPDF = async () => {
    const id = viewId || selectedId;
    if (!id) return alert("Select an invoice first");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BACKEND}/api/performainvoice/download-pdf/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { const err = await res.json(); return alert(err.message || "Download failed"); }
      if (!res.headers.get("content-type")?.includes("application/pdf")) { const err = await res.json(); return alert(err.message || "Invalid response"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `ProformaInvoice_${formatPINumber(id, findInvoice(id)?.invoice_date)}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { alert("Download failed: " + e.message); }
  };

  const downloadHTML = async () => {
    const id = viewId || selectedId;
    if (!id) return alert("Select an invoice first");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BACKEND}/api/performainvoice/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      downloadAsHtml(data, "proforma");
    } catch (e) { alert("Download failed: " + e.message); }
  };

  useEffect(() => {
    fetchPerformaInvoices();
    fetchQuotations();
    fetchFromAddresses();

    // Check for query params
    const urlParams = new URLSearchParams(window.location.search);
    const qName = urlParams.get('client_name');
    if (qName) {
      setCustomer(c => ({
        ...c,
        customer_name: decodeURIComponent(qName),
        email: urlParams.get("client_email") ? decodeURIComponent(urlParams.get("client_email")) : c.email
      }));
      setOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const pf = sessionStorage.getItem("qt_prefill");
      if (pf) {
        try {
          const v = JSON.parse(pf);
          setCustomer(c => ({
            ...c,
            customer_name: v.customer_name || "",
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
          if (v.service_description) {
            setDescInput(v.service_description); setBrandInput("");
            setItems([{ name: v.service_description, brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
          }
          setOpen(true);
          sessionStorage.removeItem("qt_prefill");
        } catch (_) { }
      }
    }
  }, []);

  const fetchPerformaInvoices = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BACKEND}/api/performainvoice`, config);
      setPerformaInvoices(res.data);
    }
    catch (err) { console.error(err); }
  };
  const fetchQuotations = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BACKEND}/api/quotations`, config);
      setQuotations(res.data);
    }
    catch (err) { console.error(err); }
  };
  const fetchFromAddresses = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BACKEND}/api/performainvoice/from-addresses`, config);
      setFromAddresses(res.data);
    }
    catch (err) { console.error(err); }
  };

  const openHistory = async (e, invoiceId, customerName, parentId) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BACKEND}/api/performainvoice/version-history/${invoiceId}`, config);
      setHistoryList(res.data);
      setHistoryCustomerName(customerName);
      setHistorySearch("");
      setHistoryRootId(parentId || invoiceId);
      setHistoryOpen(true);
    } catch (err) { console.error(err); alert("Failed to load history"); }
  };

  const deleteHistoryVersion = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this version?")) return;
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_BACKEND}/api/performainvoice/${id}`, config);
      setHistoryList(prev => prev.filter(q => q.id !== id));
    } catch (err) { alert("Failed to delete version"); }
  };

  const formatSubPINumber = (rootId, version, dateStr) => {
    const year = dateStr ? new Date(dateStr).getFullYear() : new Date().getFullYear();
    return `PI-${year}-${String(rootId).padStart(3, "0")}-${version}`;
  };



  const handleAddAddress = async () => {
    if (!newAddrLabel || !newAddrText) return alert("Label and address required");
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.post(`${API_BACKEND}/api/performainvoice/from-addresses`, { label: newAddrLabel, address: newAddrText }, config);
      setFromAddresses(prev => [...prev, res.data]);
      setNewAddrLabel(""); setNewAddrText(""); setShowAddAddress(false);
    } catch (err) { alert("Failed to add address"); }
  };



  const handleSelectProposal = async (proposalId) => {
    if (!proposalId) return;
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(`${API_BACKEND}/api/quotations/${proposalId}`, config);
      const rows = res.data;
      if (rows.length > 0) {
        const h = rows[0];
        setCustomer({
          customer_name: h.customer_name,
          mobile_number: h.mobile_number,
          email: h.email,
          gst_number: h.gst_number || "",
          location_city: h.location_city
        });
        setExtra(ex => ({
          ...ex,
          client_company: h.client_company || "",
          client_address1: h.client_address1 || "",
          client_address2: h.client_address2 || "",
          client_city: h.client_city || h.location_city || "",
          client_state: h.client_state || "",
          client_pincode: h.client_pincode || ""
        }));
        const loadedItems = rows.map(r => ({ name: r.description, brand_model: "", hsn_sac: r.hsn_sac || "", uom: "Nos", price: Number(r.price) || 0, qty: Number(r.quantity) || 1, tax: 18, discount: Number(r.discount) || 0 }));
        setItems(loadedItems);
        setDescInput(loadedItems.map(i => i.name).join(", "));
        setBrandInput(loadedItems[0]?.brand_model || "");
      }
    } catch (err) { alert("Error loading proposal data"); }
  };

  const handleEdit = async (id) => {
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const res = await axios.get(`${API_BACKEND}/api/performainvoice/${id}`, config);
    const rows = res.data;
    const h = rows[0];
    setCustomer({ customer_name: h.customer_name, mobile_number: h.mobile_number, email: h.email, gst_number: h.gst_number || "", location_city: h.location_city });
    setPerformaInvoice({ invoice_date: h.invoice_date?.split("T")[0] || "" });
    const loadedItems = rows.map(r => ({ name: r.description, brand_model: r.brand_model || "", hsn_sac: r.hsn_sac || "", uom: r.uom || "Nos", price: Number(r.price) || 0, qty: Number(r.quantity) || 1, tax: 18, discount: Number(r.discount) || 0 }));
    setItems(loadedItems);
    setDescInput(loadedItems.map(i => i.name).join(", "));
    setBrandInput(loadedItems[0]?.brand_model || "");
    setExtra({
      from_address_id: h.from_address_id || "", from_address_custom: h.from_address_custom || (BRANCH_DATA[h.supplier_branch || "Coimbatore"] ? `${BRANCH_DATA[h.supplier_branch || "Coimbatore"].address} | GSTIN: ${BRANCH_DATA[h.supplier_branch || "Coimbatore"].gstin}` : ""),
      client_company: h.client_company || "", client_address1: h.client_address1 || "",
      client_address2: h.client_address2 || "", client_city: h.client_city || "",
      client_state: h.client_state || "", client_pincode: h.client_pincode || "", client_country: h.client_country || "India",
      tax_type: h.tax_type || "GST18", custom_tax: h.custom_tax || "",
      exec_name: h.exec_name || "", exec_phone: h.exec_phone || "", exec_email: h.exec_email || "",
      terms_general: !!h.terms_general, terms_tax: !!h.terms_tax,
      terms_project_period: h.terms_project_period || "30-60 days from Purchase Order date",
      terms_validity: h.terms_validity || "15 days",
      terms_separate_orders: h.terms_separate_orders ? JSON.parse(h.terms_separate_orders) : { material: false, installation: false, usd: false, boq: false },
      terms_payment: h.terms_payment || "", terms_payment_custom: h.terms_payment_custom || "",
      terms_warranty: h.terms_warranty || "",
      supplier_branch: h.supplier_branch || "Coimbatore",
      bank_details_id: h.bank_details_id || "hdfc",
      bank_company: h.bank_company || "ACHME COMMUNICATION",
      bank_name: h.bank_name || "HDFC BANK",
      bank_account: h.bank_account || "00312320005822",
      bank_ifsc: h.bank_ifsc || "HDFC0000031",
      bank_branch: h.bank_branch || "Coimbatore",
      gst_mode: h.gst_mode || "Exclusive",
    });
    setEditId(id);
    setOpen(true);
  };

  const getTaxCalculations = () => {
    const gstMode = extra.gst_mode || "Exclusive";
    if (extra.terms_tax || gstMode === "Exempt") {
      const subtotal = items.reduce((acc, i) => acc + (i.price * (i.qty || i.quantity || 0)), 0);
      const totalDiscount = items.reduce((acc, i) => acc + (i.discount || 0), 0);
      const grandTotal = subtotal - totalDiscount;
      return { subtotal, total_discount: totalDiscount, total_cgst: 0, total_sgst: 0, total_igst: 0, grand_total: grandTotal };
    }
    const branchState = (BRANCH_OPTIONS.find(b => b.value === extra.supplier_branch)?.state || "Tamil Nadu").toLowerCase().trim();
    const clientState = (extra.client_state || "").toLowerCase().trim();
    const isSameState = branchState === clientState && clientState !== "";

    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let subtotal = 0;
    let totalDiscount = 0;

    items.forEach(item => {
      const itemSubtotal = item.price * item.qty;
      const discountAmount = item.discount || 0;
      const taxableAmount = itemSubtotal - discountAmount;
      const taxRate = item.tax || 0;

      subtotal += itemSubtotal;
      totalDiscount += discountAmount;

      let taxAmount;
      if (gstMode === "Inclusive") {
        const taxableValue = taxableAmount / (1 + taxRate / 100);
        taxAmount = taxableAmount - taxableValue;
      } else {
        taxAmount = (taxableAmount * taxRate) / 100;
      }

      if (isSameState) {
        totalCGST += taxAmount / 2;
        totalSGST += taxAmount / 2;
      } else {
        totalIGST += taxAmount;
      }
    });

    const grandTotal = gstMode === "Inclusive" ? subtotal - totalDiscount : subtotal - totalDiscount + totalCGST + totalSGST + totalIGST;
    return { subtotal, total_discount: totalDiscount, total_cgst: totalCGST, total_sgst: totalSGST, total_igst: totalIGST, grand_total: grandTotal };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!performaInvoice.invoice_date) return alert("Please select date");
    if (items.some(i => !i.name.trim())) return alert("Description cannot be empty");
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const totals = getTaxCalculations();
      const payload = {
        customer,
        performaInvoice: {
          invoice_date: performaInvoice.invoice_date,
          subtotal: totals.subtotal, total_discount: totals.total_discount,
          total_cgst: totals.total_cgst, total_sgst: totals.total_sgst, total_igst: totals.total_igst,
          total_tax: totals.total_cgst + totals.total_sgst + totals.total_igst, grand_total: totals.grand_total,
        },
        items: items.map(i => ({
          description: i.name, brand_model: i.brand_model, hsn_sac: i.hsn_sac, uom: i.uom,
          price: i.price, quantity: i.qty, tax: i.tax, discount: i.discount, subtotal: calculateItemTotal(i),
        })),
        extra,
      };
      if (editId) {
        await axios.put(`${API_BACKEND}/api/performainvoice/${editId}`, payload, config);
        alert("Updated successfully");
      } else {
        await axios.post(`${API_BACKEND}/api/performainvoice/create`, payload, config);
        alert("Created successfully");
      }
      setOpen(false); resetForm(); fetchPerformaInvoices();
    } catch (err) { console.error(err); alert("Error saving Proforma Invoice"); }
  };

  const handleAddItem = () => {
    if (!descInput.trim()) return;
    const newItem = { name: descInput, brand_model: brandInput || "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 };

    if (editingIndex !== null) {
      const updated = [...items];
      updated[editingIndex] = { ...updated[editingIndex], name: descInput, brand_model: brandInput || updated[editingIndex].brand_model };
      setItems(updated);
      setEditingIndex(null);
    } else {
      setItems(prev => {
        if (prev.length === 1 && !prev[0].name.trim()) return [newItem];
        return [...prev, newItem];
      });
    }
    setDescInput("");
    setBrandInput("");
  };

  const resetForm = () => {
    setCustomer({ customer_name: "", mobile_number: "", email: "", gst_number: "", location_city: "" });
    setItems([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
    setDescInput("");
    setBrandInput("");
    setPerformaInvoice({ invoice_date: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })() });
    setExtra(emptyExtra());
    setEditId(null);
    setEditingIndex(null);
  };

  const handleDelete = async () => {
    if (!selectedId) return alert("Select an item to delete");
    if (!window.confirm("Are you sure?")) return;
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(`${API_BACKEND}/api/performainvoice/${selectedId}`, config);
      setSelectedId(null); setViewId(null); fetchPerformaInvoices();
    } catch (error) { console.error(error); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.patch(`${API_BACKEND}/api/performainvoice/${id}`, { status }, config);
      fetchPerformaInvoices();
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.message || err.message));
    }
  };

  const openMailModal = async () => {
    const id = viewId || selectedId;
    if (!id) return alert("Please select a proforma invoice first");
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_BACKEND}/api/auth/check-email-config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem("token");
      const adminRes = await axios.get(`${API_BACKEND}/api/auth/admin-email`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      adminEmail = adminRes.data.email || "";
    } catch (e) {
      console.error("Error fetching admin email:", e);
      adminEmail = "admin@achme.com";
    }
    setMailTo(inv?.email || "");
    setMailCc(adminEmail);
    setMailSubject(`Proforma Invoice ${formatPINumber(id, inv?.invoice_date)}`);
    setMailContent("");
    setMailOpen(true);
  };

  const handleSendEmail = async () => {
    const id = viewId || selectedId;
    if (!mailTo) return alert("Please enter recipient email");
    setMailSending(true);
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(`${API_BACKEND}/api/performainvoice/send-email/${id}`, { to: mailTo, cc: mailCc, subject: mailSubject, body: mailContent }, config);
      alert("Email sent successfully"); setMailOpen(false);
    } catch (error) { alert(error.response?.data?.message || "Failed to send email"); }
    finally { setMailSending(false); }
  };

  const updateItem = (i, field, value) => { const copy = [...items]; copy[i][field] = value; setItems(copy); };
  const removeItem = () => { if (items.length <= 1) return; const n = items.slice(0, -1); setItems(n); setDescInput(n.map(i => i.name).join(", ")); setBrandInput(n[n.length - 1]?.brand_model || ""); };
  const formatDate = (date) => date ? new Date(date).toLocaleString("en-IN", { dateStyle: "medium" }) : "---";

  useEffect(() => {
    document.body.classList.toggle("modal-open", open || mailOpen);
    return () => document.body.classList.remove("modal-open");
  }, [open, mailOpen]);

  const filteredInvoices = performaInvoices.filter(q => q.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  const SectionTitle = ({ children }) => (
    <div className="flex items-center gap-2 mb-4 mt-6">
      <div className="h-1 w-6 bg-blue-500 rounded"></div>
      <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">{children}</h3>
      <div className="flex-1 h-px bg-blue-100"></div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="invoice-heading-tab flex gap-4 justify-between items-center flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#1694CE]">Proforma Invoice</h2>
          <nav className="text-sm text-gray-500">Dashboard &gt; Finance &gt; Proforma Invoice</nav>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-3 bg-gray-100 px-3 py-1 rounded-lg border h-10 mt-2">
            <Search size={18} className="text-gray-500" />
            <input type="text" placeholder="Search by customer..." className="outline-none text-sm w-40 bg-transparent" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={downloadPDF} title="Download PDF" className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition"><Download size={20} /></button>
            <button onClick={openMailModal} title="Send Email" className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition"><Mail size={18} /></button>
            <button onClick={() => { if (!selectedId) return alert("Please select a proforma invoice first"); handleEdit(selectedId); }} title="Edit" className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition"><Edit2 size={18} /></button>
            {canEditDelete && (
              <button onClick={handleDelete} title="Delete" className="w-10 h-10 bg-white border rounded-lg shadow-sm flex justify-center items-center hover:bg-gray-50 transition"><Trash2 size={18} className="text-red-500" /></button>
            )}
          </div>
          <div className="mt-2">
            <button onClick={() => { resetForm(); setOpen(true); }} className="bg-[#FF3355] text-white w-12 h-12 rounded-full flex justify-center items-center shadow-lg hover:bg-[#e62848] transition"><Plus size={24} /></button>
          </div>
        </div>
      </div>

      {/* Table */}
      {!viewId && (
        <div className="bg-white shadow-sm rounded-xl mt-6 overflow-hidden border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse min-w-[600px]">
            <thead className="bg-[#f8fafc]">
              <tr className="text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
                <th className="px-4 py-4 border-r">PI Number</th>
                <th className="px-4 py-4 border-r">Customer Name</th>
                <th className="px-4 py-4 border-r">Email</th>
                <th className="px-4 py-4 border-r">Mobile</th>
                <th className="px-4 py-4 border-r">Date</th>
                <th className="px-4 py-4 border-r">Total</th>
                <th className="px-4 py-4 border-r">City</th>
                <th className="px-4 py-4 border-r">Status</th>
                <th className="px-4 py-4">History</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(p => {
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.Pending;
                return (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} onDoubleClick={() => { setViewId(p.id); setTimeout(() => setShowInvoice(true), 50); }}
                  className={`cursor-pointer border-b hover:bg-gray-50 transition ${selectedId === p.id ? "bg-blue-50/50" : ""}`}>
                  <td className="px-4 py-4 border-r font-medium text-blue-600">{formatPINumber(p.id, p.invoice_date)}</td>
                  <td className="px-4 py-4 border-r">{p.customer_name}</td>
                  <td className="px-4 py-4 border-r text-gray-500">{p.email || "---"}</td>
                  <td className="px-4 py-4 border-r">{p.mobile_number}</td>
                  <td className="px-4 py-4 border-r">{formatDate(p.invoice_date)}</td>
                  <td className="px-4 py-4 border-r font-bold text-gray-900">&#8377;{p.grand_total?.toLocaleString()}</td>
                  <td className="px-4 py-4 border-r">{p.location_city}</td>
                  <td className="px-4 py-4 border-r">
                    <select
                      value={p.status || "Pending"}
                      onClick={e => e.stopPropagation()}
                      onChange={e => handleStatusUpdate(p.id, e.target.value)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${sc.bg} ${sc.text} ${sc.border}`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s} className="bg-white text-gray-700 font-normal">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <button onClick={e => openHistory(e, p.id, p.customer_name, p.parent_id)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition">
                      <History size={13} /> History
                    </button>
                  </td>
                </tr>
              );})}
              {filteredInvoices.length === 0 && (<tr><td colSpan="9" className="py-10 text-gray-400 italic">No invoices found</td></tr>)}
            </tbody>
          </table>
          <p className="p-3 text-xs text-gray-400 italic text-left">Double-click a row to preview invoice</p>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      <div className={`overlay ${open ? "show" : ""} flex justify-center items-start overflow-y-auto pt-6 pb-10`}>
        <div className="bg-white rounded-xl shadow-2xl w-[95%] max-w-5xl p-8 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{editId ? "Edit Proforma Invoice" : "Create Proforma Invoice"}</h2>
            <X className="cursor-pointer text-gray-400 hover:text-red-500" onClick={() => { setOpen(false); resetForm(); }} />
          </div>

          {/* Quick fill */}
          <div className="mb-4 bg-blue-50 p-3 rounded-lg flex items-center gap-4 border border-blue-100">
            <span className="text-sm font-semibold text-blue-800">Quick Fill from Proposal:</span>
            <select onChange={e => handleSelectProposal(e.target.value)} className="bg-white border text-sm rounded-md px-3 py-1.5 outline-none flex-1 max-w-xs">
              <option value="">Select a Proposal</option>
              {quotations.map(q => <option key={q.id} value={q.id}>{q.customer_name} (#{q.id})</option>)}
            </select>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── SECTION 1: FROM ADDRESS ── */}
            <SectionTitle>From Address</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Branch</label>
                <select value={extra.supplier_branch} onChange={e => {
                  const branch = e.target.value;
                  const branchInfo = BRANCH_DATA[branch];
                  setExtra(ex => ({
                    ...ex,
                    supplier_branch: branch,
                    from_address_custom: branchInfo ? `${branchInfo.address} | GSTIN: ${branchInfo.gstin}` : ex.from_address_custom,
                    from_address_id: ""
                  }));
                }}
                  className="border rounded-lg px-3 py-2 outline-none bg-white text-sm">
                  <option value="">-- Select Branch --</option>
                  {BRANCH_OPTIONS.map(b => (
                    <option key={b.value} value={b.value}>{b.label} ({b.state})</option>
                  ))}
                </select>
              </div>
              {/* 
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Office Address</label>
                <select value={extra.from_address_id} onChange={e => {
                  const val = e.target.value;
                  if (val === "ADD_NEW") {
                    setExtra(ex => ({ ...ex, from_address_id: "", from_address_custom: "" }));
                  } else if (BRANCH_DATA[val]) {
                    const branchInfo = BRANCH_DATA[val];
                    setExtra(ex => ({ ...ex, from_address_id: "", from_address_custom: `${branchInfo.address} | GSTIN: ${branchInfo.gstin}` }));
                  } else {
                    setExtra(ex => ({ ...ex, from_address_id: val, from_address_custom: "" }));
                  }
                }}
                  className="border rounded-lg px-3 py-2 outline-none bg-white text-sm">
                  <option value="">-- Select Address --</option>
                  {fromAddresses.map(a => (
                    <option key={a.id} value={a.id}>{a.label} — {a.address.substring(0, 40)}...</option>
                  ))}
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
                    setExtra(ex => ({ ...ex, supplier_branch: b.value,
                      from_address_custom: branchInfo ? `${branchInfo.address} | GSTIN: ${branchInfo.gstin}` : ex.from_address_custom,
                      from_address_id: "" }));
                  }}>
                    <p className="text-sm font-semibold text-gray-800">{b.label} <span className="text-xs font-normal text-gray-400">({b.state})</span></p>
                    <p className="text-xs text-gray-600 mt-0.5">{BRANCH_DATA[b.value]?.address}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">GSTIN: {BRANCH_DATA[b.value]?.gstin}</p>
                  </div>
                ))}
              </div>
            )}
            */}

            {/* Add new address inline */}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setShowAddAddress(p => !p)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={12} /> Add New Address to List
              </button>
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

            {/* Redesigned Bank Details Section inside Company Profile */}
            <div className="mt-4 p-5 bg-[#f8fafc] border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h4 className="text-sm font-black text-blue-800 uppercase tracking-tighter flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Bank Details
                </h4>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Bank A/C:</label>
                  <select
                    value={extra.bank_details_id}
                    onChange={e => {
                      const b = BANK_DETAILS_CONFIG.find(x => x.id === e.target.value);
                      if (b) {
                        setExtra(ex => ({
                          ...ex,
                          bank_details_id: b.id,
                          bank_company: b.company,
                          bank_name: b.bank,
                          bank_account: b.account,
                          bank_ifsc: b.ifsc,
                          bank_branch: b.branch
                        }));
                      }
                    }}
                    className="text-[11px] border-none rounded bg-white shadow-sm px-2 py-1 outline-none font-bold text-slate-600 cursor-pointer hover:bg-slate-50"
                  >
                    {BANK_DETAILS_CONFIG.map(b => (
                      <option key={b.id} value={b.id}>{b.bank} A/C: ***{b.account.slice(-4)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                <div className="flex items-center border-b border-slate-100 pb-1">
                  <span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Company</span>
                  <span className="mr-3 text-slate-300">:</span>
                  <input type="text" value={extra.bank_company} onChange={e => setExtra(ex => ({ ...ex, bank_company: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" />
                </div>
                <div className="flex items-center border-b border-slate-100 pb-1">
                  <span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Bank</span>
                  <span className="mr-3 text-slate-300">:</span>
                  <input type="text" value={extra.bank_name} onChange={e => setExtra(ex => ({ ...ex, bank_name: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" />
                </div>
                <div className="flex items-center border-b border-slate-100 pb-1">
                  <span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Account</span>
                  <span className="mr-3 text-slate-300">:</span>
                  <input type="text" value={extra.bank_account} onChange={e => setExtra(ex => ({ ...ex, bank_account: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" />
                </div>
                <div className="flex items-center border-b border-slate-100 pb-1">
                  <span className="w-20 text-[11px] font-bold text-slate-500 uppercase">IFSC</span>
                  <span className="mr-3 text-slate-300">:</span>
                  <input type="text" value={extra.bank_ifsc} onChange={e => setExtra(ex => ({ ...ex, bank_ifsc: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none uppercase" />
                </div>
                <div className="flex items-center border-b border-slate-100 pb-1 md:col-span-2">
                  <span className="w-20 text-[11px] font-bold text-slate-500 uppercase">Branch</span>
                  <span className="mr-3 text-slate-300">:</span>
                  <input type="text" value={extra.bank_branch} onChange={e => setExtra(ex => ({ ...ex, bank_branch: e.target.value }))} className="flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none" />
                </div>
              </div>
            </div>

            {/* ── SECTION 2: CLIENT DETAILS (TO ADDRESS) ── */}
            <SectionTitle>Client Details (To Address)</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Reference No</label>
                <input type="text" value={editId ? "Auto-generated" : "Will be auto-generated"} readOnly className="border rounded-lg px-3 py-2 outline-none bg-gray-50 text-gray-400 text-sm cursor-not-allowed" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Company Name</label>
                <input type="text" value={extra.client_company} onChange={e => setExtra(ex => ({ ...ex, client_company: e.target.value }))} placeholder="e.g. ABC Technologies" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Customer Name *</label>
                <div className="relative">
                  <ClientSearchDropdown
                    value={customer.customer_name}
                    onSelect={(client) => {
                      setCustomer({
                        customer_name: client.name || "",
                        mobile_number: client.phone || "",
                        email: client.email || client.lead_email || "",
                        gst_number: client.gst_number || "",
                        location_city: client.lead_city || client.city || ""
                      });
                      setExtra(ex => ({
                        ...ex,
                        client_company: client.company_name || "",
                        client_address1: client.address || "",
                        client_address2: "",
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
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Mobile Number *</label>
                <input type="text" value={customer.mobile_number} onChange={e => { if (/^\d{0,13}$/.test(e.target.value)) setCustomer({ ...customer, mobile_number: e.target.value }); }} maxLength={13} inputMode="numeric" className="border rounded-lg px-3 py-2 outline-none text-sm" required />
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
                <input type="text" value={extra.client_address1} onChange={e => setExtra(ex => ({ ...ex, client_address1: e.target.value }))} placeholder="Street / Building" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Address Line 2 (Optional)</label>
                <input type="text" value={extra.client_address2} onChange={e => setExtra(ex => ({ ...ex, client_address2: e.target.value }))} placeholder="Area / Landmark" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">City / District</label>
                <input type="text" value={extra.client_city} onChange={e => setExtra(ex => ({ ...ex, client_city: e.target.value }))} placeholder="e.g. Chennai" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">State</label>
                <select value={extra.client_state} onChange={e => setExtra(ex => ({ ...ex, client_state: e.target.value }))}
                  className="border rounded-lg px-3 py-2 outline-none text-sm bg-white">
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">PIN Code</label>
                <input type="text" value={extra.client_pincode} onChange={e => { if (/^\d{0,6}$/.test(e.target.value)) setExtra(ex => ({ ...ex, client_pincode: e.target.value })); }} maxLength={6} inputMode="numeric" placeholder="e.g. 600001" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Country</label>
                <input type="text" value={extra.client_country} readOnly className="border rounded-lg px-3 py-2 outline-none bg-gray-50 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Invoice Date *</label>
                <input type="date" value={performaInvoice.invoice_date} onChange={e => setPerformaInvoice({ ...performaInvoice, invoice_date: e.target.value })} className="border rounded-lg px-3 py-2 outline-none text-sm" required />
              </div>
            </div>

            {/* TAX CONFIG section removed */}

            {/* ── SECTION 4: ITEMS TABLE ── */}
            <SectionTitle>Quote Items</SectionTitle>
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
                <button type="button" onClick={handleAddItem} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold h-fit hover:bg-blue-700 transition">
                  {editingIndex !== null ? "Update Item" : "Add Item"}
                </button>
              </div>
              <p className="text-[10px] text-orange-500 italic font-medium">Content before the first comma will be bolded in the template</p>
            </div>
            <div className="border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-center text-sm min-w-[700px]">
                <thead>
                  <tr className="text-gray-600 font-bold uppercase text-[10px]">
                    <th className="px-3 py-3 text-left">S.No</th>
                    <th className="px-3 py-3 text-left">Description</th>
                    <th className="px-3 py-3 text-left">Brand &amp; Model</th>
                    <th className="px-3 py-3 text-left">HSN/SAC</th>
                    <th className="px-3 py-3">UOM</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Qty</th>
                    <th className="px-3 py-3 text-gray-400">Tax %</th>
                    <th className="px-3 py-3">Disc (&#8377;)</th>
                    <th className="px-3 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(i, "name", e.target.value)}
                          onClick={() => { setDescInput(item.name); setBrandInput(item.brand_model); setEditingIndex(i); }}
                          className="w-full outline-none bg-transparent text-sm cursor-text hover:text-blue-600 font-medium"
                          placeholder="Enter item description..."
                        />
                      </td>
                      <td className="px-3 py-2"><input type="text" value={item.brand_model} onChange={e => updateItem(i, "brand_model", e.target.value)} onClick={() => { setDescInput(item.name); setBrandInput(item.brand_model); setEditingIndex(i); }} className="w-full outline-none bg-transparent text-sm cursor-text hover:text-blue-600" placeholder="Brand/Model" /></td>
                      <td className="px-3 py-2"><input type="text" value={item.hsn_sac} onChange={e => updateItem(i, "hsn_sac", e.target.value)} className="w-full outline-none bg-transparent text-sm" placeholder="HSN/SAC" /></td>
                      <td className="px-3 py-2">
                        <select value={item.uom} onChange={e => updateItem(i, "uom", e.target.value)} className="border rounded px-2 py-1 text-xs outline-none bg-white">
                          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          <option value="custom">Custom</option>
                        </select>
                        {item.uom === "custom" && <input type="text" placeholder="Enter UOM" onChange={e => updateItem(i, "uom", e.target.value)} className="mt-1 border rounded px-2 py-1 text-xs w-full outline-none" />}
                      </td>
                      <td className="px-3 py-2"><input type="number" value={item.price} onChange={e => updateItem(i, "price", Number(e.target.value))} className="w-20 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.qty} onChange={e => updateItem(i, "qty", Number(e.target.value))} className="w-12 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.tax} onChange={e => updateItem(i, "tax", Number(e.target.value))} className="w-12 text-center bg-transparent outline-none text-sm border-b border-gray-200" /></td>
                      <td className="px-3 py-2"><input type="number" value={item.discount} onChange={e => updateItem(i, "discount", Number(e.target.value))} className="w-20 text-center outline-none bg-transparent text-sm" /></td>
                      <td className="px-3 py-2 text-right font-bold text-sm">&#8377;{calculateItemTotal(item).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-50 p-3 flex gap-4">
                <button type="button" onClick={removeItem} className="flex items-center gap-2 text-red-500 font-bold text-xs hover:underline"><MinusCircle size={14} /> Remove Line</button>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end pt-2">
              <div className="w-72 border rounded-xl p-4 bg-gray-50 shadow-sm">
                  {(() => {
                  const t = getTaxCalculations();
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

            {/* ── SECTION 5: EXECUTIVE DETAILS ── */}
            <SectionTitle>Executive Details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Executive Name</label>
                <input type="text" value={extra.exec_name} onChange={e => { if (!/[0-9]/.test(e.nativeEvent.data)) setExtra(ex => ({ ...ex, exec_name: e.target.value })); }} placeholder="e.g. Anbu Selvan" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Contact Number</label>
                <input type="text" value={extra.exec_phone} onChange={e => { if (/^\d{0,13}$/.test(e.target.value)) setExtra(ex => ({ ...ex, exec_phone: e.target.value })); }} maxLength={13} inputMode="numeric" placeholder="e.g. 9876543210" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Email ID</label>
                <input type="email" value={extra.exec_email} onChange={e => setExtra(ex => ({ ...ex, exec_email: e.target.value }))} placeholder="exec@company.com" className="border rounded-lg px-3 py-2 outline-none text-sm" />
              </div>
            </div>

            {/* ── SECTION 6: TERMS & CONDITIONS ── */}
            <SectionTitle>Terms &amp; Conditions</SectionTitle>
            <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-200">

              {/* General */}
              <div className="space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={extra.terms_general} onChange={e => setExtra(ex => ({ ...ex, terms_general: e.target.checked }))} className="mt-1 accent-blue-600 w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">General Terms &amp; Conditions</p>
                    <p className="text-xs text-gray-500">Standard terms apply to this proforma invoice</p>
                  </div>
                </label>
                <div className="flex flex-col gap-1 ml-7">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Custom Note</label>
                  <input type="text" value={extra.custom_terms} onChange={e => setExtra(ex => ({ ...ex, custom_terms: e.target.value }))} placeholder="Additional terms..." className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" />
                </div>
              </div>

              {/* Tax */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={extra.terms_tax} onChange={e => setExtra(ex => ({ ...ex, terms_tax: e.target.checked }))} className="mt-1 accent-blue-600 w-4 h-4" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Tax Exempt</p>
                  <p className="text-xs text-gray-500">Prices quoted are exclusive of Sales and Service Tax (SEZ – NIL Tax applicable)</p>
                </div>
              </label>
              {!extra.terms_tax && (
                <div className="ml-7">
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">GST Mode</label>
                  <div className="flex flex-wrap gap-3">
                    {GST_MODES.map(mode => (
                      <label key={mode} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition text-sm ${extra.gst_mode === mode ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                        <input type="radio" name="pi_gst_mode" value={mode} checked={extra.gst_mode === mode} onChange={e => setExtra(ex => ({ ...ex, gst_mode: e.target.value }))} className="accent-blue-600" />
                        <span>{mode} — {mode === "Exclusive" ? "GST added to price" : mode === "Inclusive" ? "GST included in price" : "No GST charged"}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Project Period */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Project Period</label>
                <input type="text" value={extra.terms_project_period} onChange={e => setExtra(ex => ({ ...ex, terms_project_period: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none text-sm bg-white" placeholder="e.g. 30-60 days from Purchase Order date" />
              </div>

              {/* Validity */}
              <div>
                <p className="text-sm font-semibold text-gray-700">Validity</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  {VALIDITY_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition ${extra.terms_validity === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                      <input type="radio" name="terms_validity" value={opt} checked={extra.terms_validity === opt} onChange={e => setExtra(ex => ({ ...ex, terms_validity: e.target.value }))} className="accent-blue-600" />
                      <span className="text-xs">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Separate Orders */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Separate Orders</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: "material", label: "A. Material Supply (As per actuals)" },
                    { key: "installation", label: "B. Installation / Services" },
                    { key: "usd", label: "C. Price may vary based on USD rates" },
                    { key: "boq", label: "D. Factory BOQ may vary" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={extra.terms_separate_orders?.[key] || false}
                        onChange={e => setExtra(ex => ({ ...ex, terms_separate_orders: { ...ex.terms_separate_orders, [key]: e.target.checked } }))}
                        className="accent-blue-600 w-4 h-4" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment Terms</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {PAYMENT_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition ${extra.terms_payment === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="terms_payment" value={opt} checked={extra.terms_payment === opt} onChange={e => setExtra(ex => ({ ...ex, terms_payment: e.target.value }))} className="accent-blue-600" />
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

              {/* Warranty */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Warranty</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {WARRANTY_OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-xs transition ${extra.terms_warranty === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}>
                      <input type="radio" name="terms_warranty" value={opt} checked={extra.terms_warranty === opt} onChange={e => setExtra(ex => ({ ...ex, terms_warranty: e.target.value }))} className="accent-blue-600" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <button type="submit" className="bg-blue-600 text-white px-10 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-lg transition">Save Proforma Invoice</button>
              <button type="button" onClick={() => { setOpen(false); resetForm(); }} className="bg-gray-200 text-gray-600 px-10 py-2.5 rounded-lg hover:bg-gray-300 font-bold transition">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Version History Modal ── */}
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
            <div className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2 mb-4">
              <Search size={15} className="text-gray-400" />
              <input type="text" placeholder="Search by sub-invoice number..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="outline-none text-sm bg-transparent flex-1" />
              {historySearch && <X size={14} className="text-gray-400 cursor-pointer hover:text-red-500" onClick={() => setHistorySearch("")} />}
            </div>
            {(() => {
              const filtered = historyList.filter(q => {
                const subNum = formatSubPINumber(q.parent_id || historyRootId, q.version, q.invoice_date).toLowerCase();
                return !historySearch || subNum.includes(historySearch.toLowerCase());
              });
              return filtered.length === 0 ? (
                <p className="text-center text-gray-400 py-10 italic">{historyList.length === 0 ? "No previous versions. This is the original." : "No results match your search."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-50">
                      <tr className="text-gray-600 font-bold uppercase text-xs border-b">
                        <th className="px-4 py-3 text-left">Sub-PI Number</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        <th className="px-4 py-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(q => (
                        <tr key={q.id}
                          onDoubleClick={() => { setViewId(q.id); setTimeout(() => setShowInvoice(true), 50); setHistoryOpen(false); }}
                          className="border-b cursor-pointer hover:bg-indigo-50/40 transition">
                          <td className="px-4 py-3 font-semibold text-blue-600">
                            {formatSubPINumber(q.parent_id || historyRootId, q.version, q.invoice_date)}
                            <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-bold">v{q.version || 1}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">{formatDate(q.invoice_date)}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">₹{q.grand_total?.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={e => { e.stopPropagation(); setViewId(q.id); setTimeout(() => setShowInvoice(true), 50); setHistoryOpen(false); }} title="View" className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center hover:bg-blue-100"><Download size={14} /></button>
                              <button onClick={e => { e.stopPropagation(); handleEdit(q.id); setHistoryOpen(false); }} title="Edit" className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center hover:bg-green-100"><Edit2 size={14} /></button>
                              <button onClick={e => { e.stopPropagation(); openMailModal(); setSelectedId(q.id); setHistoryOpen(false); }} title="Email" className="w-8 h-8 bg-orange-50 text-orange-500 rounded-lg flex items-center justify-center hover:bg-orange-100"><Mail size={14} /></button>
                              {canEditDelete && (
                            <button onClick={e => deleteHistoryVersion(e, q.id)} title="Delete" className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100"><Trash2 size={14} /></button>
                          )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400 italic mt-3 text-center">Double-click any row to open that invoice</p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mail Modal */}
      <div className={`overlay ${mailOpen ? "show" : ""} flex justify-center items-center`}>
        <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-lg p-8 relative">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Mail size={20} /> Send Proforma Invoice</h2>
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
            <button onClick={handleSendEmail} disabled={mailSending} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow transition disabled:opacity-60">
              {mailSending ? "Sending..." : "Send Email"}
            </button>
            <button onClick={() => setMailOpen(false)} className="bg-gray-200 text-gray-600 px-8 py-2.5 rounded-lg hover:bg-gray-300 font-bold transition">Cancel</button>
          </div>
        </div>
      </div>

      {/* Invoice Preview */}
      {viewId && showinvoice && (
        <div key={viewId} ref={invoiceRef} className="w-full mt-6 bg-white shadow-xl p-6 relative">
          <div className="flex gap-3 absolute right-6 top-6 z-10">
            <X className="cursor-pointer text-gray-400 hover:text-red-500 bg-white rounded-full p-1" onClick={() => { setShowInvoice(false); setTimeout(() => setViewId(null), 400); }} />
          </div>
          <Invoice quotationId={viewId} type="proforma" />
        </div>
      )}
      {showSMTPPrompt && (
        <SMTPConfigPrompt
          email={user?.email || ""}
          onClose={() => setShowSMTPPrompt(false)}
        />
      )}
    </div>
  );
};

export default PerformaInvoice;
