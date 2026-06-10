import React, { useState, useEffect } from "react";
import "../Styles/tailwind.css";
import { Search, Plus, X, Trash2, Edit, MapPin, MinusCircle } from "lucide-react";
import axios from "axios";
import { API } from "../config";
import { BRANCH_DATA, BRANCH_OPTIONS } from "../config/branchConfig";

const UOM_OPTIONS = ["Nos", "Units", "Pieces", "Boxes", "Sets", "Meters", "Kg", "Liters"];
const VALIDITY_OPTIONS = ["2 days", "5 days", "10 days", "15 days", "30 days"];
const PAYMENT_OPTIONS = ["100% Advance", "Payment Against Delivery", "15 Days", "30 Days", "45 Days", "Custom"];
const WARRANTY_OPTIONS = ["No Warranty", "Testing Warranty", "1 Month", "3 Months", "6 Months", "12 Months", "24 Months", "36 Months", "OEM Warranty", "Supplier Warranty", "OEM Hardware Warranty", "No Software Warranty"];
const GST_MODES = ["Exclusive", "Inclusive", "Exempt"];

const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 mb-4 mt-6">
    <div className="h-1 w-6 bg-blue-500 rounded"></div>
    <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">{children}</h3>
    <div className="flex-1 h-px bg-blue-100"></div>
  </div>
);

const getAuthConfig = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const getUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}").role || "employee";
  } catch {
    return "employee";
  }
};

const Estimate = () => {
  const userRole = getUserRole();
  const canEditDelete = userRole === "admin" || userRole === "subadmin";
  const [open, setOpen] = useState(false);

  const tabopen = () => {
    resetForm();
    setOpen(true);
  };

  const [clientSearch, setClientSearch] = useState("");
  const [clientList, setClientList] = useState([]);
  const [clientType, setClientType] = useState("existing");

  const [EstimateCompany, setCompanyName] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");

  const [estimateCompany, setProjectname] = useState("");
  const [EstimateDate, setInvoiceDate] = useState("");
  const [ExpiryDate, setInvoiceDueDate] = useState("");
  const [category, setCategory] = useState("Default");

  const [EstimateList, setEstimate] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierBranch, setSupplierBranch] = useState("Coimbatore");

  const [isEdit, setIsEdit] = useState(false);
  const [selectedEstimateId, setSelectedEstimateId] = useState(null);

  // Quote Items state variables
  const [items, setItems] = useState([
    { name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }
  ]);
  const [descInput, setDescInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  // Terms & Conditions state
  const [extra, setExtra] = useState({
    terms_general: false,
    terms_tax: false,
    gst_mode: "Exclusive",
    terms_project_period: "30-60 days from Purchase Order date",
    terms_validity: "15 days",
    terms_separate_orders: { material: false, installation: false, usd: false, boq: false },
    terms_payment: "",
    terms_payment_custom: "",
    terms_warranty: "",
    custom_terms: ""
  });

  // Fetch estimates
  const Fetchestimate = async () => {
    try {
      const response = await axios.get(`${API}/api/estimate`, getAuthConfig());
      console.log("ESTIMATES:", response.data);
      setEstimate(response.data);
    } catch (err) {
      console.log("Fetch Error:", err);
    }
  };

  useEffect(() => {
    Fetchestimate();
  }, []);

  // Search client
  const searchClient = async (value) => {
    setClientSearch(value);
    if (!value) return setClientList([]);

    try {
      const res = await axios.get(
        `${API}/api/estimate-client/search?name=${value}`, getAuthConfig()
      );
      setClientList(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  const selectClient = (client) => {
    setClientSearch(client.company_name);
    setClientList([]);
    setClientType("existing");
  };

  // Reset form
  const resetForm = () => {
    setClientSearch("");
    setClientList([]);
    setClientType("existing");

    setCompanyName("");
    setFirstname("");
    setLastname("");
    setEmail("");

    setProjectname("");
    setInvoiceDate("");
    setInvoiceDueDate("");
    setCategory("Default");
    setSupplierBranch("Coimbatore");

    setItems([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
    setDescInput("");
    setBrandInput("");
    setEditingIndex(null);

    setExtra({
      terms_general: false,
      terms_tax: false,
      gst_mode: "Exclusive",
      terms_project_period: "30-60 days from Purchase Order date",
      terms_validity: "15 days",
      terms_separate_orders: { material: false, installation: false, usd: false, boq: false },
      terms_payment: "",
      terms_payment_custom: "",
      terms_warranty: "",
      custom_terms: ""
    });

    setIsEdit(false);
    setSelectedEstimateId(null);
    setOpen(false);
  };

  // Tax calculations
  const getTaxCalculations = () => {
    if (extra.terms_tax) {
      const subtotal = items.reduce((acc, i) => acc + (i.price * (i.qty || 0)), 0);
      const totalDiscount = items.reduce((acc, i) => acc + (i.discount || 0), 0);
      const grandTotal = subtotal - totalDiscount;
      return { subtotal, total_discount: totalDiscount, total_cgst: 0, total_sgst: 0, total_igst: 0, grand_total: grandTotal };
    }

    const gstMode = extra.gst_mode || "Exclusive";

    if (gstMode === "Exempt") {
      const subtotal = items.reduce((acc, i) => acc + (i.price * (i.qty || 0)), 0);
      const totalDiscount = items.reduce((acc, i) => acc + (i.discount || 0), 0);
      return { subtotal, total_discount: totalDiscount, total_cgst: 0, total_sgst: 0, total_igst: 0, grand_total: subtotal - totalDiscount };
    }

    const isSameState = true; // Splitting to CGST/SGST by default
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let subtotal = 0;
    let totalDiscount = 0;

    items.forEach(item => {
      const itemSubtotal = item.price * item.qty;
      const discountAmount = item.discount || 0;
      const taxRate = item.tax || 0;

      subtotal += itemSubtotal;
      totalDiscount += discountAmount;

      if (gstMode === "Inclusive") {
        const taxableValue = itemSubtotal / (1 + taxRate / 100);
        const taxAmount = itemSubtotal - taxableValue;
        const discTaxRatio = discountAmount / itemSubtotal;
        const actualTax = taxAmount * (1 - discTaxRatio);
        if (isSameState) {
          totalCGST += actualTax / 2;
          totalSGST += actualTax / 2;
        } else {
          totalIGST += actualTax;
        }
      } else {
        const taxableAmount = itemSubtotal - discountAmount;
        const taxAmount = (taxableAmount * taxRate) / 100;
        if (isSameState) {
          totalCGST += taxAmount / 2;
          totalSGST += taxAmount / 2;
        } else {
          totalIGST += taxAmount;
        }
      }
    });

    const grandTotal = gstMode === "Inclusive" ? subtotal - totalDiscount : subtotal - totalDiscount + totalCGST + totalSGST + totalIGST;
    return { subtotal, total_discount: totalDiscount, total_cgst: totalCGST, total_sgst: totalSGST, total_igst: totalIGST, grand_total: grandTotal };
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

  const updateItem = (i, field, value) => {
    const copy = [...items];
    copy[i][field] = value;
    setItems(copy);
  };

  const removeItem = () => {
    if (items.length <= 1) return;
    const n = items.slice(0, -1);
    setItems(n);
  };

  const calculateItemTotal = (i) => (i.price * i.qty) - (i.discount || 0);

  // Save Client + Estimate
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let companyName = clientSearch;

      // New Client Flow
      if (clientType === "new") {
        if (!EstimateCompany || !firstname || !lastname || !email) {
          alert("All client fields required");
          return;
        }

        await axios.post(`${API}/api/estimate-client/new`, {
          company_name: EstimateCompany,
          client_firstname: firstname,
          client_lastname: lastname,
          client_email: email,
        }, getAuthConfig());
        alert("Client created successfully");
        resetForm();
        return;
      }

      // common validation
      if (!companyName || !EstimateDate || !ExpiryDate) {
        alert("All estimate fields required");
        return;
      }

      const totals = getTaxCalculations();

      const payload = {
        client_company: companyName,
        project_names: estimateCompany,
        Estimate_date: EstimateDate,
        Expiry_date: ExpiryDate,
        category,
        subtotal: totals.subtotal,
        total_tax: totals.total_cgst + totals.total_sgst + totals.total_igst,
        total_discount: totals.total_discount,
        grand_total: totals.grand_total,
        items: items.map(i => ({
          description: i.name,
          brand_model: i.brand_model,
          hsn_sac: i.hsn_sac,
          uom: i.uom,
          price: i.price,
          quantity: i.qty,
          tax: i.tax,
          discount: i.discount,
          subtotal: calculateItemTotal(i),
        })),
        extra,
      };

      // Edit Mode
      if (isEdit && selectedEstimateId) {
        await axios.put(
          `${API}/api/estimate/${selectedEstimateId}`,
          payload, getAuthConfig()
        );
        alert("Estimate updated successfully");
      }
      // Create Mode
      else {
        await axios.post(
          `${API}/api/estimate/new`,
          payload, getAuthConfig()
        );
        alert("Estimate created successfully");
      }

      // RESET & REFRESH
      resetForm();
      Fetchestimate();

    } catch (err) {
      console.error("SUBMIT ERROR:", err);
      alert(err.response?.data?.message || "Submit failed");
    }
  };

  // EDIT
  const openEditModal = (est) => {
    setClientSearch(est.client_company || "");
    setProjectname(est.project_names || "");
    setInvoiceDate(est.Estimate_date ? est.Estimate_date.split("T")[0] : "");
    setInvoiceDueDate(est.Expiry_date ? est.Expiry_date.split("T")[0] : "");
    setCategory(est.category || "Default");

    if (est.items) {
      setItems(est.items);
    } else {
      setItems([{ name: "", brand_model: "", hsn_sac: "", uom: "Nos", price: 0, qty: 1, tax: 18, discount: 0 }]);
    }
    if (est.extra) {
      try {
        const parsed = typeof est.extra === "string" ? JSON.parse(est.extra) : est.extra;
        setExtra({ ...parsed, gst_mode: parsed.gst_mode || "Exclusive" });
      } catch {
        setExtra({
          terms_general: false,
          terms_tax: false,
          gst_mode: "Exclusive",
          terms_project_period: "30-60 days from Purchase Order date",
          terms_validity: "15 days",
          terms_separate_orders: { material: false, installation: false, usd: false, boq: false },
          terms_payment: "",
          terms_payment_custom: "",
          terms_warranty: "",
          custom_terms: ""
        });
      }
    }

    setSelectedEstimateId(est.id);
    setIsEdit(true);
    setOpen(true);
  };

  // DELETE
  const deleteEstimate = async (id) => {
    if (!window.confirm("Delete this estimate?")) return;

    try {
      await axios.delete(`${API}/api/estimate/${id}`, getAuthConfig());
      alert("Estimate deleted");
      Fetchestimate();
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <div className="invoices-main-tab w-full">
      <div className="invoice-heading-tab flex gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#1694CE]">Estimates</h2>
          <span className="text-sm text-gray-500">APP &gt; SALES</span>
        </div>

        <div className="flex gap-3">
          <div className="flex items-center gap-3 bg-gray-100 px-3 py-1 rounded-lg border w-60 h-10 mt-3">
            <Search size={18} className="text-gray-500" />
            <input
              type="text"
              placeholder="Search by company name"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="Search outline-none text-sm w-full bg-transparent"
            />
          </div>

          <div className="mt-2">
            <button
              onClick={() => tabopen(true)}
              className="bg-[#FF3355] text-white w-12 h-12 rounded-full flex justify-center items-center shadow-lg hover:bg-[#e62848] transition"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto">
        <div className={`${open ? "fixed" : "hidden"} inset-0 bg-black/40 flex items-center justify-center z-50`}>
          <div className="bg-white shadow-2xl w-[95%] max-w-5xl max-h-[90vh] overflow-y-auto p-8 rounded-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {isEdit ? "Edit Estimate" : "Create A New Estimate"}
              </h2>
              <span className="cursor-pointer text-gray-400 hover:text-red-500 transition" onClick={resetForm}>
                <X size={24} />
              </span>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Branch Address Section */}
              <div className="border rounded-xl overflow-hidden mb-4 shadow-sm">
                <div className="bg-indigo-600 text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                  <MapPin size={13} /> Selected Branch Address
                </div>
                <div className="bg-indigo-50/50 border-b border-indigo-100 px-4 py-3">
                  <p className="text-sm font-semibold text-indigo-900">{supplierBranch}</p>
                  <p className="text-xs text-indigo-700 mt-1">{BRANCH_DATA[supplierBranch]?.address}</p>
                  <p className="text-xs text-indigo-600 font-mono mt-1">GSTIN: {BRANCH_DATA[supplierBranch]?.gstin}</p>
                </div>
                <div className="bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">Other Branches</div>
                <div className="max-h-[120px] overflow-y-auto">
                  {BRANCH_OPTIONS.filter(b => b.value !== supplierBranch).map(b => (
                    <div key={b.value} className="px-4 py-2 border-b border-gray-100 last:border-0 hover:bg-gray-100 transition cursor-pointer" onClick={() => setSupplierBranch(b.value)}>
                      <p className="text-xs font-semibold text-gray-800">{b.label} <span className="text-[10px] font-normal text-gray-400">({b.state})</span></p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{BRANCH_DATA[b.value]?.address}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">GSTIN: {BRANCH_DATA[b.value]?.gstin}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Client<span className="text-red-500">*</span>
                  </label>
                  {clientType === "existing" && (
                    <input
                      type="text"
                      name="client_company"
                      value={clientSearch}
                      onChange={(e) => searchClient(e.target.value)}
                      className="border rounded-lg px-3 py-2 outline-none bg-white w-full text-sm"
                      placeholder="Search Client Company..."
                    />
                  )}
                  {clientList.length > 0 && (
                    <div className="absolute bg-white border shadow-lg mt-1 w-[300px] max-h-[200px] overflow-y-auto rounded-lg z-50">
                      {clientList.map((c, index) => (
                        <p
                          key={index}
                          onClick={() => selectClient(c)}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        >
                          {c.company_name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Project</label>
                  <input
                    type="text"
                    name="project_names"
                    value={estimateCompany}
                    onChange={(e) => setProjectname(e.target.value)}
                    className={`border rounded-lg px-3 py-2 outline-none w-full text-sm ${
                      clientType === "new" ? "bg-gray-200 cursor-not-allowed" : "bg-white"
                    }`}
                    placeholder="Enter project name..."
                    disabled={clientType === "new"}
                  />
                </div>
              </div>

              {clientType === "new" && (
                <div className="bg-gray-50 p-6 rounded-xl space-y-4 border border-gray-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        Company Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        name="company_name"
                        value={EstimateCompany}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                        placeholder="ABC Tech"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        First Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        name="client_firstname"
                        value={firstname}
                        onChange={(e) => setFirstname(e.target.value)}
                        className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                        placeholder="John"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        Last Name<span className="text-red-500">*</span>
                      </label>
                      <input
                        name="client_lastname"
                        value={lastname}
                        onChange={(e) => setLastname(e.target.value)}
                        className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                        placeholder="Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        Email<span className="text-red-500">*</span>
                      </label>
                      <input
                        name="client_email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-500 text-right">
                <span
                  onClick={() => setClientType("new")}
                  className={`cursor-pointer hover:text-blue-600 font-medium ${clientType === "new" ? "text-blue-600 underline" : ""}`}
                >
                  New Client
                </span>
                <span className="mx-2">|</span>
                <span
                  onClick={() => setClientType("existing")}
                  className={`cursor-pointer hover:text-blue-600 font-medium ${clientType === "existing" ? "text-blue-600 underline" : ""}`}
                >
                  Existing Client
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Invoice Date<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="Estimate_date"
                    value={EstimateDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Due Date<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="Expiry_date"
                    value={ExpiryDate}
                    onChange={(e) => setInvoiceDueDate(e.target.value)}
                    className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Category<span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="border rounded-lg px-3 py-2 outline-none w-full text-sm bg-white"
                  >
                    <option value="Default">Default</option>
                  </select>
                </div>
              </div>

              {/* Quote Items Section */}
              <SectionTitle>Quote Items</SectionTitle>
              <div className="flex flex-col gap-1 mb-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Description</label>
                    <textarea
                      value={descInput}
                      onChange={e => setDescInput(e.target.value)}
                      placeholder="e.g. Laptop, specs..."
                      className="w-full border rounded-lg px-3 py-2 outline-none min-h-[60px] text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Brand &amp; Model</label>
                    <input
                      type="text"
                      value={brandInput}
                      onChange={e => setBrandInput(e.target.value)}
                      placeholder="e.g. Dell Inspiron 15"
                      className="w-full border rounded-lg px-3 py-2 outline-none text-sm bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2 items-end mt-2">
                  <div className="flex-grow text-[10px] text-orange-500 italic font-medium">
                    Content before the first comma will be bolded in the template
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition"
                  >
                    {editingIndex !== null ? "Update Item" : "Add Item"}
                  </button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-center text-sm min-w-[700px]">
                  <thead className="bg-gray-50 border-b">
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
                      <th className="px-3 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50/50 transition">
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
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.brand_model}
                            onChange={e => updateItem(i, "brand_model", e.target.value)}
                            onClick={() => { setDescInput(item.name); setBrandInput(item.brand_model); setEditingIndex(i); }}
                            className="w-full outline-none bg-transparent text-sm cursor-text hover:text-blue-600"
                            placeholder="Brand/Model"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.hsn_sac}
                            onChange={e => updateItem(i, "hsn_sac", e.target.value)}
                            className="w-full outline-none bg-transparent text-sm"
                            placeholder="HSN/SAC"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.uom}
                            onChange={e => updateItem(i, "uom", e.target.value)}
                            className="border rounded px-2 py-1 text-xs outline-none bg-white font-medium"
                          >
                            {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.price}
                            onChange={e => updateItem(i, "price", Number(e.target.value))}
                            className="w-20 text-center outline-none bg-transparent text-sm font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={e => updateItem(i, "qty", Number(e.target.value))}
                            className="w-12 text-center outline-none bg-transparent text-sm font-medium"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.tax}
                            onChange={e => updateItem(i, "tax", Number(e.target.value))}
                            className="w-12 text-center bg-transparent outline-none text-sm border-b border-gray-200"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={item.discount}
                            onChange={e => updateItem(i, "discount", Number(e.target.value))}
                            className="w-20 text-center outline-none bg-transparent text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-sm text-slate-800">
                          &#8377;{calculateItemTotal(item).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-gray-50 p-3 flex gap-4">
                  <button
                    type="button"
                    onClick={removeItem}
                    className="flex items-center gap-2 text-red-500 font-bold text-xs hover:underline"
                  >
                    <MinusCircle size={14} /> Remove Line
                  </button>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end pt-4">
                <div className="w-full max-w-[320px] border border-gray-200 rounded-2xl bg-white p-5 shadow-sm">
                  {(() => {
                    const t = getTaxCalculations();
                    const gstMode = extra.gst_mode || "Exclusive";
                    const taxableValue = gstMode === "Inclusive" ? t.subtotal - t.total_discount - t.total_cgst - t.total_sgst - t.total_igst : t.subtotal - t.total_discount;
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-600 py-1">
                          <span>Subtotal</span>
                          <span className="font-medium text-slate-800">&#8377;{t.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 py-1">
                          <span>Discount</span>
                          <span className="font-medium text-slate-800">-&#8377;{t.total_discount.toLocaleString()}</span>
                        </div>
                        {gstMode === "Inclusive" && (
                          <div className="flex justify-between text-sm py-1 text-gray-600"><span>Taxable Value</span><span className="font-medium">&#8377;{taxableValue.toLocaleString()}</span></div>
                        )}
                        <div className="flex justify-between text-sm py-1" style={{ color: t.total_cgst > 0 ? "#4b5563" : "#d1d5db" }}>
                          <span>CGST</span>
                          <span className="font-medium">&#8377;{t.total_cgst.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1" style={{ color: t.total_sgst > 0 ? "#4b5563" : "#d1d5db" }}>
                          <span>SGST</span>
                          <span className="font-medium">&#8377;{t.total_sgst.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1" style={{ color: t.total_igst > 0 ? "#4b5563" : "#d1d5db" }}>
                          <span>IGST</span>
                          <span className="font-medium">&#8377;{t.total_igst.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 pt-2 mt-1 text-lg font-bold text-blue-700">
                          <span>Grand Total</span>
                          <span>&#8377;{t.grand_total.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Terms & Conditions */}
              <SectionTitle>Terms &amp; Conditions</SectionTitle>
              <div className="space-y-4 bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={extra.terms_general}
                      onChange={e => setExtra(ex => ({ ...ex, terms_general: e.target.checked }))}
                      className="mt-1 accent-blue-600 w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">General Terms &amp; Conditions</p>
                      <p className="text-xs text-gray-500">Standard terms apply to this estimation</p>
                    </div>
                  </label>
                  <div className="flex flex-col gap-1 ml-7">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Custom Note</label>
                    <input
                      type="text"
                      value={extra.custom_terms}
                      onChange={e => setExtra(ex => ({ ...ex, custom_terms: e.target.value }))}
                      placeholder="Additional terms..."
                      className="border rounded-lg px-3 py-2 outline-none text-sm bg-white w-full"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extra.terms_tax}
                    onChange={e => setExtra(ex => ({ ...ex, terms_tax: e.target.checked }))}
                    className="mt-1 accent-blue-600 w-4 h-4"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Tax</p>
                    <p className="text-xs text-gray-500">Prices quoted are exclusive of Sales and Service Tax (SEZ – NIL Tax applicable)</p>
                  </div>
                </label>

                {!extra.terms_tax && (
                  <div className="ml-7">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">GST Mode</label>
                    <div className="flex flex-wrap gap-3">
                      {GST_MODES.map(mode => (
                        <label key={mode} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition text-sm ${extra.gst_mode === mode ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}>
                          <input type="radio" name="gst_mode_est" value={mode} checked={extra.gst_mode === mode} onChange={e => setExtra(ex => ({ ...ex, gst_mode: e.target.value }))} className="accent-blue-600" />
                          <span>{mode} — {mode === "Exclusive" ? "GST added to price" : mode === "Inclusive" ? "GST included in price" : "No GST charged"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Period */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Project Period</label>
                  <input
                    type="text"
                    value={extra.terms_project_period}
                    onChange={e => setExtra(ex => ({ ...ex, terms_project_period: e.target.value }))}
                    className="border rounded-lg px-3 py-2 outline-none text-sm bg-white"
                    placeholder="e.g. 30-60 days from Purchase Order date"
                  />
                </div>

                {/* Validity */}
                <div>
                  <p className="text-sm font-semibold text-gray-700">Validity</p>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {VALIDITY_OPTIONS.map(opt => (
                      <label
                        key={opt}
                        className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 transition ${extra.terms_validity === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200"}`}
                      >
                        <input
                          type="radio"
                          name="terms_validity"
                          value={opt}
                          checked={extra.terms_validity === opt}
                          onChange={e => setExtra(ex => ({ ...ex, terms_validity: e.target.value }))}
                          className="accent-blue-600"
                        />
                        <span className="text-xs font-medium">{opt}</span>
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
                        <input
                          type="checkbox"
                          checked={extra.terms_separate_orders?.[key] || false}
                          onChange={e => setExtra(ex => ({ ...ex, terms_separate_orders: { ...ex.terms_separate_orders, [key]: e.target.checked } }))}
                          className="accent-blue-600 w-4 h-4"
                        />
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
                      <label
                        key={opt}
                        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition ${extra.terms_payment === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input
                          type="radio"
                          name="terms_payment"
                          value={opt}
                          checked={extra.terms_payment === opt}
                          onChange={e => setExtra(ex => ({ ...ex, terms_payment: e.target.value }))}
                          className="accent-blue-600"
                        />
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
                      <label
                        key={opt}
                        className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-xs transition ${extra.terms_warranty === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <input
                          type="radio"
                          name="terms_warranty"
                          value={opt}
                          checked={extra.terms_warranty === opt}
                          onChange={e => setExtra(ex => ({ ...ex, terms_warranty: e.target.value }))}
                          className="accent-blue-600"
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-8 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-lg transition"
                >
                  Submit
                </button>

                <button
                  onClick={resetForm}
                  type="button"
                  className="bg-gray-400 text-white px-8 py-2.5 rounded-lg hover:bg-red-500 transition"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Estimates Table */}
        <div className="mt-8">
          <table className="w-full border-collapse bg-white font-[Times-New-Roman] text-center border shadow-sm rounded-xl overflow-hidden">
            <thead>
              <tr className="text-sm text-[#1694CE] bg-slate-50 border-b">
                <th className="p-4 font-bold">ID</th>
                <th className="p-4 font-bold text-left">Company Name</th>
                <th className="p-4 font-bold text-left">Project Title</th>
                <th className="p-4 font-bold">Estimate Date</th>
                <th className="p-4 font-bold">Expiry Date</th>
                <th className="p-4 font-bold text-right">Grand Total</th>
                <th className="p-4 font-bold">Action</th>
              </tr>
            </thead>

            <tbody>
              {EstimateList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-gray-400 italic">
                    No estimates found
                  </td>
                </tr>
              ) : (
                EstimateList.filter(E =>
                  E.client_company?.toLowerCase().includes(searchTerm.toLowerCase())
                ).map((E) => (
                  <tr key={E.id} className="border-b hover:bg-gray-50 text-sm transition">
                    <td className="p-4 text-slate-500">{E.id}</td>
                    <td className="p-4 text-left font-medium text-[#1694CE]">{E.client_company}</td>
                    <td className="p-4 text-left text-slate-600">{E.project_names || "---"}</td>
                    <td className="p-4 text-slate-600">{new Date(E.Estimate_date).toLocaleDateString()}</td>
                    <td className="p-4 text-slate-600">{new Date(E.Expiry_date).toLocaleDateString()}</td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      &#8377;{E.grand_total ? Number(E.grand_total).toLocaleString() : "0"}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-3 justify-center items-center">
                        <button
                          type="button"
                          onClick={() => deleteEstimate(E.id)}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                        {canEditDelete && (
                          <button
                            type="button"
                            onClick={() => openEditModal(E)}
                            className="text-green-600 hover:text-green-800 p-1 hover:bg-green-50 rounded transition"
                            title="Edit"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Estimate;
