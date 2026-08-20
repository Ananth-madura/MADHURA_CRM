import React, { useState, useEffect } from "react";
import { Search, X, Edit, Trash2, FileSignature, Phone, User, Mail, Building, MapPin, FileBarChart, RefreshCw, Download, Share2, MessageCircle, Loader2 } from "lucide-react";
import "../Styles/tailwind.css";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { API } from "../config";
import * as XLSX from "xlsx";
import { getToday } from "../utils/leadutil";
import WhatsAppCampaignWizard from "../components/WhatsAppCampaignWizard";

const Clients = () => {
  const { user } = useAuth();
  const canEditDelete = user?.role === "admin" || user?.role === "subadmin";
  const isStrictAdmin = user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingClient, setSharingClient] = useState(null);
  const [sharedMembers, setSharedMembers] = useState([]);
  const [savingShare, setSavingShare] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Pagination & Debouncing states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalClients, setTotalClients] = useState(0);
  const [counts, setCounts] = useState({ total: 0, active: 0, converted: 0, direct: 0 });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isExportLoading, setIsExportLoading] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSource, activeTab, limit]);

  // CSV Import mapping states
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  // High Performance Batch Import & Export states
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [importStats, setImportStats] = useState({
    total: 0,
    processed: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    elapsedTime: 0,
    speed: 0,
    eta: 0
  });
  const [importErrors, setImportErrors] = useState([]);
  const [failedRowsForExport, setFailedRowsForExport] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const isPausedRef = React.useRef(false);
  const isCancelledRef = React.useRef(false);

  const STANDARD_FIELDS = [
    {
      key: "name", label: "Customer Name", required: true, primary: true,
      aliases: [
        "customer name", "customername", "customer_name",
        "name", "clientname", "client_name", "fullname", "full name",
        "client", "customer", "firstname", "first name"
      ]
    },
    {
      key: "address", label: "Address", primary: true,
      aliases: [
        "address", "address 1", "address1", "address_1",
        "street", "streetaddress", "street address", "location"
      ]
    },
    {
      key: "address_2", label: "Address 2", primary: true,
      aliases: [
        "address 2", "address2", "address_2",
        "address line 2", "addressline2", "addr2", "addr 2",
        "area", "landmark"
      ]
    },
    {
      key: "phone", label: "Contact Number", primary: true,
      aliases: [
        "contact number", "contactnumber", "contact_number",
        "phone", "phonenumber", "phone number", "phone_number",
        "mobile", "mobilenumber", "mobile number", "mobile_number",
        "contact", "phone no", "mobile no"
      ]
    },
    {
      key: "alternate_phone", label: "Contact Number 2", primary: true,
      aliases: [
        "contact number 2", "contactnumber2", "contact_number_2", "contact number2",
        "alternate phone", "alternatephone", "alternate_phone",
        "phone 2", "phone2", "mobile 2", "mobile2",
        "secondary phone", "secondaryphone", "alt phone", "altphone"
      ]
    },
    {
      key: "email", label: "Email", primary: true,
      aliases: [
        "email", "emailaddress", "email address", "email_address",
        "mail", "mailaddress", "mail address"
      ]
    },
    {
      key: "contact_person", label: "Contact Person", primary: true,
      aliases: [
        "contact person", "contactperson", "contact_person",
        "person", "contact name", "contactname", "attn", "attention"
      ]
    },
    {
      key: "company_name", label: "Company Name",
      aliases: [
        "company name", "companyname", "company_name",
        "company", "firm", "firmname", "business", "businessname",
        "organisation", "organization", "org"
      ]
    },
    {
      key: "city", label: "City",
      aliases: [
        "city", "town", "district", "city town", "citytown", "location city"
      ]
    },
    {
      key: "state", label: "State",
      aliases: ["state", "province", "region"]
    },
    {
      key: "pincode", label: "Pincode",
      aliases: [
        "pincode", "pin code", "zip", "zipcode", "zip code",
        "postalcode", "postal code", "postal"
      ]
    },
    {
      key: "service", label: "Service Interest",
      aliases: [
        "service", "service interest", "serviceinterest", "service_interest",
        "interest", "purpose", "requirement"
      ]
    },
    {
      key: "gst_number", label: "GST Number",
      aliases: ["gst number", "gstnumber", "gst_number", "gst", "gstin", "gst no"]
    },
    {
      key: "client_status", label: "Client Status",
      aliases: ["client status", "clientstatus", "status", "type"]
    },
    {
      key: "assigned_staff", label: "Assigned Staff",
      aliases: [
        "assigned staff", "assignedstaff", "assigned_staff",
        "staff", "staffname", "staff name", "executive", "agent"
      ]
    },
    {
      key: "notes", label: "Notes",
      aliases: ["notes", "remarks", "description", "comment", "comments", "details"]
    }
  ];


  const N = {
    primary: "#5645d4ff",
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
      const response = await axios.get(
        `${API}/api/client?page=${currentPage}&limit=${limit}&search=${debouncedSearchTerm}&source=${filterSource}&tab=${activeTab}`,
        config
      );
      const data = response.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setClients(data.clients || []);
        setTotalClients(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.counts) {
          setCounts(data.counts);
        }
      } else {
        const arr = Array.isArray(data) ? data : [];
        setClients(arr);
        setTotalClients(arr.length);
        setTotalPages(1);
        setCounts({
          total: arr.length,
          active: arr.filter(c => c.client_status === "active").length,
          converted: arr.filter(c => c.original_lead_id !== null && c.original_lead_type !== null).length,
          direct: arr.filter(c => c.original_lead_id === null || c.original_lead_type === null).length
        });
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.log("Fetch Error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [currentPage, limit, debouncedSearchTerm, filterSource, activeTab]);

  const fetchClientsRef = React.useRef(fetchClients);
  useEffect(() => {
    fetchClientsRef.current = fetchClients;
  }, [fetchClients]);

  const exportClientsCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      };
      const response = await axios.get(`${API}/api/client/export`, config);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clients_export_${getToday()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export clients.");
    }
  };

  const parseCSV = (text) => {
    const firstLine = text.split(/\r?\n/)[0] || "";
    let delimiter = ",";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;

    if (tabCount > commaCount && tabCount > semiCount) {
      delimiter = "\t";
    } else if (semiCount > commaCount && semiCount > tabCount) {
      delimiter = ";";
    }

    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push("");
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const importClientsFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    const reader = new FileReader();
    if (isExcel) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

          if (rows.length < 2) {
            alert("Empty Excel file or invalid structure.");
            return;
          }

          processParsedData(rows);
        } catch (err) {
          console.error("Excel parse error:", err);
          alert("Failed to parse Excel file. Make sure it is valid.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (evt) => {
        const text = evt.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          alert("Invalid CSV structure or empty file.");
          return;
        }
        processParsedData(rows);
      };
      reader.readAsText(file);
    }

    const processParsedData = (rows) => {
      const headers = rows[0].map(h => String(h).trim());
      const dataRows = rows.slice(1).filter(r => r.some(cell => String(cell).trim() !== ""));

      const initialMapping = {};
      STANDARD_FIELDS.forEach(field => {
        let matchedHeader = "";

        for (const h of headers) {
          if (field.aliases.includes(h.toLowerCase())) {
            matchedHeader = h;
            break;
          }
        }

        if (!matchedHeader) {
          for (const h of headers) {
            const normH = h.toLowerCase().replace(/[\s_-]/g, "");
            if (field.aliases.some(a => a.replace(/[\s_-]/g, "") === normH)) {
              matchedHeader = h;
              break;
            }
          }
        }

        if (!matchedHeader) {
          for (const h of headers) {
            const normH = h.toLowerCase().replace(/[\s_-]/g, "");
            const normKey = field.key.toLowerCase().replace(/[\s_-]/g, "");
            if (normH.includes(normKey) || normKey.includes(normH)) {
              matchedHeader = h;
              break;
            }
          }
        }

        initialMapping[field.key] = matchedHeader;
      });

      setCsvHeaders(headers);
      setCsvRows(dataRows);
      setColumnMapping(initialMapping);
      setShowMappingModal(true);
      e.target.value = "";
    };
  };

  const handleCSVImportSubmit = async () => {
    const nameHeader = columnMapping["name"];
    if (!nameHeader) {
      alert("Please map a CSV column to the required 'Name' field.");
      return;
    }

    const mappedClients = csvRows.map((row, idx) => {
      const clientObj = {};
      STANDARD_FIELDS.forEach(field => {
        const mappedHeader = columnMapping[field.key];
        if (mappedHeader) {
          const headerIdx = csvHeaders.indexOf(mappedHeader);
          if (headerIdx !== -1) {
            clientObj[field.key] = row[headerIdx] || "";
          }
        }
      });
      clientObj._originalRowIdx = idx + 2;
      return clientObj;
    }).filter(c => (c.name || "").trim() !== "");

    if (mappedClients.length === 0) {
      alert("No valid client records found to import based on mapping.");
      return;
    }

    if (!window.confirm(`Are you sure you want to import ${mappedClients.length} clients? Duplicate records will be updated dynamically.`)) {
      return;
    }

    setShowMappingModal(false);
    setShowProgressModal(true);

    setIsPaused(false);
    setIsCancelled(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;

    const totalRecords = mappedClients.length;
    const CHUNK_SIZE = 2000;
    let processedCount = 0;
    let importedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errorsList = [];
    const failedRows = [];

    setImportStats({
      total: totalRecords,
      processed: 0,
      imported: 0,
      updated: 0,
      failed: 0,
      elapsedTime: 0,
      speed: 0,
      eta: 0
    });
    setProgressPercent(0);
    setImportErrors([]);
    setFailedRowsForExport([]);

    const startTime = Date.now();
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const runChunks = async () => {
      for (let i = 0; i < totalRecords; i += CHUNK_SIZE) {
        if (isCancelledRef.current) {
          errorsList.push("Import cancelled by user.");
          break;
        }

        while (isPausedRef.current && !isCancelledRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }

        if (isCancelledRef.current) {
          errorsList.push("Import cancelled by user.");
          break;
        }

        const chunk = mappedClients.slice(i, i + CHUNK_SIZE);

        try {
          const response = await axios.post(`${API}/api/client/import`, { clients: chunk }, config);
          const { imported, updated, failed: chunkFailed, errors: chunkErrors } = response.data;

          processedCount += chunk.length;
          importedCount += imported;
          updatedCount += updated;
          failedCount += chunkFailed;

          if (chunkErrors && chunkErrors.length > 0) {
            chunkErrors.forEach(err => {
              errorsList.push(err);
              const match = err.match(/Row (\d+):/i);
              if (match) {
                const idxInChunk = parseInt(match[1], 10) - 1;
                if (chunk[idxInChunk]) {
                  failedRows.push(chunk[idxInChunk]);
                }
              }
            });
          }
        } catch (err) {
          console.error("Chunk import error:", err);
          processedCount += chunk.length;
          failedCount += chunk.length;
          const errMsg = err.response?.data?.message || err.message;
          if (err.response?.status === 403) {
            errorsList.push(`Access denied (403): Your account does not have permission to import clients. Please contact your administrator.`);
            // Stop on auth error
            isCancelledRef.current = true;
          } else {
            errorsList.push(`Chunk starting at row ${i + 1} failed: ${errMsg}`);
          }
          chunk.forEach(item => {
            failedRows.push(item);
          });
        }

        const now = Date.now();
        const elapsedSec = Math.max(1, Math.round((now - startTime) / 1000));
        const speed = Math.round(processedCount / elapsedSec);
        const remainingRecords = totalRecords - processedCount;
        const eta = speed > 0 ? Math.round(remainingRecords / speed) : 0;
        const percent = Math.round((processedCount / totalRecords) * 100);

        setImportStats({
          total: totalRecords,
          processed: processedCount,
          imported: importedCount,
          updated: updatedCount,
          failed: failedCount,
          elapsedTime: elapsedSec,
          speed: speed,
          eta: eta
        });
        setProgressPercent(percent);
        setImportErrors([...errorsList]);
        setFailedRowsForExport([...failedRows]);
      }

      fetchClients();
    };

    runChunks();
  };

  const exportClientsExcel = async () => {
    try {
      setIsExportLoading(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const response = await axios.get(
        `${API}/api/client?limit=none&search=${debouncedSearchTerm}&source=${filterSource}&tab=${activeTab}`,
        config
      );

      const allClients = response.data.clients || response.data || [];

      if (allClients.length === 0) {
        alert("No client data to export.");
        setIsExportLoading(false);
        return;
      }

      const dataToExport = allClients.map((c, idx) => ({
        "S.No": idx + 1,
        "Customer Name": c.name || "",
        "Company Name": c.company_name || "",
        "Email": c.email || "",
        "Contact Number": c.phone || "",
        "Contact Number 2": c.alternate_phone || "",
        "Contact Person": c.contact_person || "",
        "Address": c.address || "",
        "Address 2": c.address_2 || "",
        "City": c.city || "",
        "State": c.state || "",
        "Pincode": c.pincode || "",
        "Service Interest": c.service || "",
        "GST Number": c.gst_number || "",
        "Client Status": c.client_status || "active",
        "Assigned Staff": c.assigned_staff_name || "",
        "Creator": c.creator_name || "Admin",
        "Created Date": c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN") : "",
        "Notes": c.notes || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");

      const maxLens = {};
      dataToExport.forEach(row => {
        Object.keys(row).forEach(key => {
          const valStr = String(row[key]);
          maxLens[key] = Math.max(maxLens[key] || 10, valStr.length);
        });
      });
      worksheet["!cols"] = Object.keys(maxLens).map(key => ({
        wch: Math.min(40, maxLens[key] + 2)
      }));

      XLSX.writeFile(workbook, `clients_export_${getToday()}.xlsx`);
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("Failed to export Excel file.");
    } finally {
      setIsExportLoading(false);
    }
  };



  useEffect(() => {
    fetchClients();
  }, [currentPage, limit, debouncedSearchTerm, filterSource, activeTab]);

  useEffect(() => {
    const handleRefresh = () => fetchClientsRef.current();
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
    contact_person: "",
    address: "",
    address_2: "",
    city: "",
    state: "",
    pincode: "",
    service: "",
    gst_number: "",
    notes: "",
    client_status: "active",
    assigned_teammember_id: "",
    landline_number: "",
    alternate_mobile_number: "",
    reference_by: "",
    nearest_landmark: "",
  });


  const openShareModal = (client) => {
    setSharingClient(client);
    setShowShareModal(true);
    setSharedMembers([]);
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios.get(`${API}/api/client/${client.id}/shares`, config)
      .then(r => setSharedMembers(r.data))
      .catch(e => console.error("Error loading client shares:", e));
  };

  const saveShares = () => {
    setSavingShare(true);
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };
    axios.post(`${API}/api/client/share`, { client_id: sharingClient.id, shared_to: sharedMembers }, config)
      .then(() => {
        setShowShareModal(false);
        fetchClients();
      })
      .catch(e => {
        console.error("Error saving shares:", e);
        alert(e.response?.data?.message || "Failed to update sharing");
      })
      .finally(() => setSavingShare(false));
  };

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
      contact_person: "", address: "", address_2: "",
      city: "", state: "", pincode: "",
      service: "", gst_number: "", notes: "", client_status: "active",
      assigned_teammember_id: "",
      landline_number: "", alternate_mobile_number: "", reference_by: "", nearest_landmark: ""
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
      contact_person: selectedClient.contact_person || "",
      address: selectedClient.address || "",
      address_2: selectedClient.address_2 || "",
      city: selectedClient.city || "",
      state: selectedClient.state || "",
      pincode: selectedClient.pincode || "",
      service: selectedClient.service || "",
      gst_number: selectedClient.gst_number || "",
      notes: selectedClient.notes || "",
      client_status: selectedClient.client_status || "active",
      assigned_teammember_id: selectedClient.assigned_teammember_id || "",
      landline_number: selectedClient.landline_number || "",
      alternate_mobile_number: selectedClient.alternate_mobile_number || "",
      reference_by: selectedClient.reference_by || "",
      nearest_landmark: selectedClient.nearest_landmark || "",
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

  const filteredClients = clients;

  const convertedCount = counts.converted || 0;
  const directCount = counts.direct || 0;
  const activeCount = counts.active || 0;
  const totalCount = counts.total || 0;

  return (
    <div className="w-full min-h-screen p-4 md:p-6" style={{ background: N.surfaceSoft }}>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: N.ink }}>Clients</h1>
          <a href="/dashboard" className="text-sm" style={{ color: N.stone }}>Dashboard &gt; Customers &gt; Clients</a>
        </div>
        <div className="flex items-center gap-2">
          {isStrictAdmin && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  disabled={isExportLoading}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg font-medium bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50 disabled:cursor-wait"
                  style={{ borderColor: N.hairline }}
                >
                  {isExportLoading ? (
                    <>
                      <span className="animate-spin mr-1">⌛</span> Exporting...
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Export Clients
                    </>
                  )}
                </button>
                {showExportDropdown && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-50 py-1" style={{ borderColor: N.hairline }}>
                    <button onClick={() => { exportClientsCSV(); setShowExportDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                      <span>📄</span> Export as CSV
                    </button>
                    <button onClick={() => { exportClientsExcel(); setShowExportDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2">
                      <span>📊</span> Export as Excel (XLSX)
                    </button>
                  </div>
                )}
              </div>
              <button onClick={() => document.getElementById("client-import-input-clients").click()} className="flex items-center gap-2 px-4 py-2 border rounded-lg font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition" style={{ borderColor: N.hairline }}>
                Import Clients (Excel/CSV)
              </button>
              <input id="client-import-input-clients" type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={importClientsFile} />
            </>
          )}
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-semibold rounded-lg hover:bg-[#1ebe5d] transition shadow-sm"
          >
            <MessageCircle size={16} />
            <span>Send Bulk WhatsApp {selectedClientIds.length > 0 ? `(${selectedClientIds.length})` : "(All)"}</span>
          </button>
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
          { label: "Total Clients", count: totalCount, bg: N.lavender, color: N.primary },
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
          { key: "all", label: `All (${totalCount})`, color: N.ink },
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
          <option value="direct">Direct</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: N.canvas, borderColor: N.hairline }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: N.surface }}>
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredClients.length > 0 && selectedClientIds.length === filteredClients.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedClientIds(filteredClients.map(c => c.id));
                      else setSelectedClientIds([]);
                    }}
                    className="rounded border-gray-300 text-[#25D366] focus:ring-[#25D366] cursor-pointer"
                  />
                </th>
                {["Client", "Phone", "Company", "Source", "Created By", "Status", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: N.steel }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-500 font-semibold">
                    <Loader2 size={24} className="animate-spin text-[#5645d4ff] mx-auto mb-2" />
                    <span>Loading clients data...</span>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center" style={{ color: N.stone }}>No clients found</td></tr>
              ) : (
                filteredClients.map(c => (
                  <tr key={c.id} className="border-t cursor-pointer hover:bg-gray-50 transition" style={{ borderColor: N.hairline }}
                    onDoubleClick={() => openDetailsModal(c)}>
                    <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.includes(c.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedClientIds(prev => [...prev, c.id]);
                          else setSelectedClientIds(prev => prev.filter(id => id !== c.id));
                        }}
                        className="rounded border-gray-300 text-[#25D366] focus:ring-[#25D366] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style={{ background: N.lavender, color: N.primary }}>
                          {(c.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: N.ink }}>{c.name}</p>
                          <p className="text-xs" style={{ color: N.stone }}>{c.email || "-"}</p>
                          {user?.role === "employee" && c.shared_by_name && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                                🔄 Redirect by {c.shared_by_name}
                              </span>
                            </div>
                          )}
                          {(user?.role === "admin" || user?.role === "subadmin") && c.share_count > 0 && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200" title={c.shared_with_names}>
                                👥 Shared ({c.share_count}): {c.shared_with_names}
                              </span>
                            </div>
                          )}
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
                        <a
                          href={`https://wa.me/91${(c.phone || c.alternate_phone || "").replace(/\D/g, "").slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-green-100 text-[#25D366] transition"
                          title="Chat on WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </a>
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
                        <button onClick={() => openShareModal(c)}
                          className="p-1.5 rounded-lg hover:bg-purple-50 transition" style={{ color: "#a855f7" }} title="Redirect / Share Client">
                          <Share2 size={16} />
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4 px-3 py-3 bg-white rounded-xl border border-gray-200" style={{ borderColor: N.hairline }}>
        {/* Entries info & limit selector */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            Showing {totalClients === 0 ? 0 : (currentPage - 1) * limit + 1} to{" "}
            {Math.min(currentPage * limit, totalClients)} of {totalClients} entries
          </span>
          <span className="hidden sm:inline">·</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs">Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-1 bg-white text-xs outline-none"
              style={{ borderColor: N.hairlineStrong }}
            >
              {[10, 25, 50, 100, 250].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              currentPage === 1
                ? "text-gray-300 border-gray-100 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-50 cursor-pointer"
            }`}
            style={{ borderColor: N.hairline }}
          >
            « First
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              currentPage === 1
                ? "text-gray-300 border-gray-100 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-50 cursor-pointer"
            }`}
            style={{ borderColor: N.hairline }}
          >
            ‹ Prev
          </button>

          {/* Render adjacent pages */}
          {(() => {
            const range = [];
            const delta = 2; // number of pages to show before/after current
            const left = currentPage - delta;
            const right = currentPage + delta + 1;
            
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || (i >= left && i < right)) {
                range.push(i);
              } else if (range[range.length - 1] !== "...") {
                range.push("...");
              }
            }

            return range.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`dots-${idx}`} className="px-2 text-gray-400">
                    ...
                  </span>
                );
              }
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    currentPage === p
                      ? "text-white cursor-default"
                      : "text-gray-600 hover:bg-gray-50 cursor-pointer"
                  }`}
                  style={{
                    background: currentPage === p ? N.primary : "transparent",
                    borderColor: currentPage === p ? N.primary : N.hairline,
                  }}
                >
                  {p}
                </button>
              );
            });
          })()}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              currentPage === totalPages
                ? "text-gray-300 border-gray-100 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-50 cursor-pointer"
            }`}
            style={{ borderColor: N.hairline }}
          >
            Next ›
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              currentPage === totalPages
                ? "text-gray-300 border-gray-100 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-50 cursor-pointer"
            }`}
            style={{ borderColor: N.hairline }}
          >
            Last »
          </button>
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

              {/* Additional Contact & Reference Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Phone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Landline Number</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.landline_number || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <Phone size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Alternate Mobile Number</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.alternate_mobile_number || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <MapPin size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Nearest Landmark</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.nearest_landmark || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <User size={18} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Reference By</p>
                    <p className="text-sm font-semibold mt-1 text-gray-900">{selectedClientDetails.reference_by || "—"}</p>
                  </div>
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
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Customer Name <span className="text-red-500">*</span></label>
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
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Mobile Number <span className="text-red-500">*</span></label>
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
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Contact Number 2 <span className="text-gray-400 font-normal">(Alternate)</span></label>
                  <input type="text" name="alternate_phone" value={form.alternate_phone} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                    placeholder="Alternate / second number" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Landline Number</label>
                  <input type="text" name="landline_number" value={form.landline_number} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                    placeholder="Landline Number" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Alternate Mobile Number</label>
                  <input type="text" name="alternate_mobile_number" value={form.alternate_mobile_number} onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                    placeholder="Alternate Mobile" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Reference By</label>
                <input type="text" name="reference_by" value={form.reference_by} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Referred by" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Contact Person</label>
                <input type="text" name="contact_person" value={form.contact_person} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Name of contact person at this company" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Address</label>
                <input type="text" name="address" value={form.address} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Street / Building" />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Address 2 <span className="text-gray-400 font-normal">(Area / Landmark)</span></label>
                <input type="text" name="address_2" value={form.address_2} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Area, landmark, floor, etc." />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Nearest Landmark</label>
                <input type="text" name="nearest_landmark" value={form.nearest_landmark} onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none" style={{ borderColor: N.hairlineStrong, color: N.ink }}
                  placeholder="Nearest landmark location" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Location / City</label>
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
                  <label className="block text-xs font-medium mb-1" style={{ color: N.slate }}>Service Interest / Purpose</label>
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
      {/* CSV Mapping Modal */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold font-display text-gray-900">Map CSV Columns to Client Fields</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your CSV columns are detected and auto-matched below.
                  Correct any mismatches, then click <strong>Proceed with Import</strong>.
                  <span className="ml-1 font-semibold text-red-600">Customer Name is required.</span>
                </p>
              </div>
              <button onClick={() => setShowMappingModal(false)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Alert / Warning for missing Name mapping */}
              {!columnMapping["name"] ? (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-base">⚠️</span> Missing Required Mapping: Customer Name
                  </div>
                  <div>
                    The required column <strong>Customer Name</strong> was not found or mapped. Please select which column in your CSV/Excel represents the client's name.
                  </div>
                  {csvHeaders.filter(h => {
                    const norm = h.toLowerCase().replace(/[\s_-]/g, "");
                    return norm.includes("name") || norm.includes("client") || norm.includes("customer") || norm.includes("user") || norm.includes("person") || norm.includes("fullname") || norm.includes("lead");
                  }).length > 0 && (
                      <div className="mt-2 p-2 bg-white/60 rounded border border-red-200/50">
                        💡 <strong>Suggestions for Customer Name:</strong> we found columns that look like name fields. Try mapping one of these:
                        <ul className="list-disc list-inside mt-1 font-mono text-xs">
                          {csvHeaders.filter(h => {
                            const norm = h.toLowerCase().replace(/[\s_-]/g, "");
                            return norm.includes("name") || norm.includes("client") || norm.includes("customer") || norm.includes("user") || norm.includes("person") || norm.includes("fullname") || norm.includes("lead");
                          }).map(h => (
                            <li key={h}>"{h}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-green-800 text-sm flex items-center gap-2">
                  <span>✅</span>
                  <div>
                    <strong>Ready to import!</strong> Required fields mapped. Review the column assignments below, then click <strong>Proceed with Import</strong>.
                    Duplicate records (matched by phone or email) will be <strong>updated automatically</strong>.
                  </div>
                </div>
              )}

              {/* Primary Fields - User Required */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">📋 Required Import Fields</span>
                  <span className="text-xs text-gray-400">Map these columns from your file</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {STANDARD_FIELDS.filter(f => f.primary).map((field) => {
                    const isRequired = field.required;
                    const isMapped = !!columnMapping[field.key];
                    return (
                      <div key={field.key} className={`p-3 rounded-xl border-2 transition-all ${
                        isRequired && !isMapped ? 'border-red-300 bg-red-50/30' :
                        isMapped ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/50'
                      }`}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex justify-between" style={{ color: isMapped ? '#15803d' : isRequired ? '#b91c1c' : '#6b7280' }}>
                          <span>
                            {field.label} {isRequired && <span className="text-red-500">*</span>}
                          </span>
                          {isMapped && <span className="text-[10px] text-green-600 font-bold">✓ MAPPED</span>}
                        </label>
                        <select
                          value={columnMapping[field.key] || ""}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none transition-colors ${
                            isRequired && !isMapped ? 'border-red-300 focus:border-red-500' :
                            isMapped ? 'border-green-300 focus:border-green-500' : 'border-gray-300 focus:border-purple-500'
                          }`}
                        >
                          <option value="">-- Ignore / Don't Import --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional Fields */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full">➕ Additional Fields (Optional)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {STANDARD_FIELDS.filter(f => !f.primary).map((field) => {
                    const isMapped = !!columnMapping[field.key];
                    return (
                      <div key={field.key} className={`p-3 rounded-xl border transition-all ${isMapped ? 'border-gray-200 bg-gray-50/50' : 'border-gray-100 bg-white'}`}>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5 flex justify-between">
                          <span>{field.label}</span>
                          {isMapped && <span className="text-[10px] text-green-600 font-bold">✓ MAPPED</span>}
                        </label>
                        <select
                          value={columnMapping[field.key] || ""}
                          onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2 text-sm bg-white outline-none border-gray-300 focus:border-purple-500 transition-colors"
                        >
                          <option value="">-- Ignore / Don't Import --</option>
                          {csvHeaders.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Preview */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800">Data Preview (First 3 rows)</h3>
                  <p className="text-xs text-gray-500">How the data will map under current selections.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100/80 border-b border-gray-200">
                      <tr>
                        {STANDARD_FIELDS.filter(f => f.primary).map(field => {
                          const mappedHeader = columnMapping[field.key];
                          return (
                            <th key={field.key} className="px-3 py-2 font-semibold text-gray-600 truncate max-w-[150px]">
                              {field.label}
                              {mappedHeader ? (
                                <span className="block text-[9px] font-mono text-purple-600 truncate">({mappedHeader})</span>
                              ) : (
                                <span className="block text-[9px] font-mono text-gray-400 font-normal">(ignored)</span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.slice(0, 3).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50/50">
                          {STANDARD_FIELDS.filter(f => f.primary).map(field => {
                            const mappedHeader = columnMapping[field.key];
                            const headerIdx = csvHeaders.indexOf(mappedHeader);
                            const val = headerIdx !== -1 ? row[headerIdx] : "";
                            return (
                              <td key={field.key} className="px-3 py-2 text-gray-700 truncate max-w-[150px]" title={val}>
                                {val || <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
              <span className="text-xs text-gray-500">
                Found {csvRows.length} rows of client data
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all"
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCSVImportSubmit}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-white transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                  style={{
                    background: columnMapping["name"] ? N.primary : '#a4a097',
                    cursor: columnMapping["name"] ? 'pointer' : 'not-allowed'
                  }}
                  disabled={!columnMapping["name"] || isImporting}
                >
                  {isImporting ? "Importing..." : `Proceed with Import`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Premium Import Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
              <div>
                <h2 className="text-lg font-bold">Importing Clients</h2>
                <p className="text-xs text-purple-100 mt-0.5">Please keep this page open until completion</p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-white/20 px-2.5 py-1 rounded-full font-semibold">
                {importStats.processed === importStats.total ? "Done" : (isPaused ? "Paused" : "Running")}
              </div>
            </div>

            {/* Progress Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">

              {/* Progress Bar & Percentage */}
              <div className="space-y-2">
                <div className="flex justify-between items-end text-sm">
                  <span className="text-gray-500 font-medium">Overall Progress</span>
                  <span className="text-2xl font-bold text-indigo-600">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 font-mono">
                  <span>{importStats.processed.toLocaleString()} / {importStats.total.toLocaleString()} rows</span>
                  <span>{importStats.speed > 0 ? `${importStats.speed} rows/sec` : "calculating..."}</span>
                </div>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-green-600 tracking-wider">New Clients</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{importStats.imported.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Updated</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{importStats.updated.toLocaleString()}</p>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase font-bold text-red-600 tracking-wider">Failed</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{importStats.failed.toLocaleString()}</p>
                </div>
              </div>

              {/* Time estimations */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3.5 rounded-xl border border-gray-100 font-medium text-gray-600">
                <div>
                  <span className="text-gray-400 text-xs block font-normal">ELAPSED TIME</span>
                  <span className="font-mono text-gray-800">
                    {Math.floor(importStats.elapsedTime / 60)}m {importStats.elapsedTime % 60}s
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block font-normal">EST. REMAINING</span>
                  <span className="font-mono text-gray-800">
                    {importStats.processed === importStats.total ? "0s" : (importStats.eta > 60 ? `${Math.floor(importStats.eta / 60)}m ${importStats.eta % 60}s` : `${importStats.eta}s`)}
                  </span>
                </div>
              </div>

              {/* Detailed Logs Box */}
              {importErrors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Error Logs ({importErrors.length})</p>
                  <div className="bg-gray-950 text-red-400 font-mono text-xs p-3 rounded-xl max-h-[160px] overflow-y-auto border border-gray-900 shadow-inner space-y-1">
                    {importErrors.map((err, idx) => (
                      <div key={idx} className="border-l-2 border-red-500 pl-2 py-0.5">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer / Controls */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                {failedRowsForExport.length > 0 && (
                  <button
                    onClick={() => {
                      const headers = ["name", "company_name", "email", "phone", "alternate_phone", "contact_person", "address", "address_2", "city", "state", "pincode", "service", "gst_number", "notes"];
                      let csvContent = headers.join(",") + "\r\n";
                      failedRowsForExport.forEach(r => {
                        const row = headers.map(h => {
                          let stringVal = String(r[h] || "").replace(/"/g, '""');
                          if (stringVal.includes(",") || stringVal.includes("\n") || stringVal.includes("\r") || stringVal.includes('"')) {
                            stringVal = `"${stringVal}"`;
                          }
                          return stringVal;
                        });
                        csvContent += row.join(",") + "\r\n";
                      });
                      const blob = new Blob([csvContent], { type: "text/csv" });
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.setAttribute("download", `import_failed_rows_${getToday()}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 px-3 py-2 border border-red-100 hover:bg-red-100 rounded-lg transition"
                  >
                    📥 Download Failed Rows ({failedRowsForExport.length})
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                {importStats.processed < importStats.total && !isCancelled && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const newState = !isPaused;
                        setIsPaused(newState);
                        isPausedRef.current = newState;
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 transition"
                    >
                      {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to stop importing? Remaining rows will be skipped.")) {
                          setIsCancelled(true);
                          isCancelledRef.current = true;
                        }
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {(importStats.processed === importStats.total || isCancelled) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProgressModal(false);
                    }}
                    className="px-6 py-2 rounded-lg text-sm font-bold text-white transition"
                    style={{ background: N.primary }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Share Modal */}
      {showShareModal && sharingClient && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="rounded-xl shadow-xl w-full max-w-md animate-fade-in" style={{ background: N.canvas }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: N.hairline }}>
              <h3 className="text-base font-semibold" style={{ color: N.ink }}>
                Redirect / Share Client: {sharingClient.name}
              </h3>
              <button onClick={() => setShowShareModal(false)} style={{ color: N.steel }}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-gray-500">
                Select employees to share this client with. Shared employees will be able to view this client and create call reports, quotations, or invoices.
              </p>
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <label key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors" style={{ borderColor: N.hairline }}>
                    <input
                      type="checkbox"
                      checked={sharedMembers.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSharedMembers([...sharedMembers, member.id]);
                        } else {
                          setSharedMembers(sharedMembers.filter(id => id !== member.id));
                        }
                      }}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: N.ink }}>
                        {member.first_name} {member.last_name || ""}
                      </p>
                      <p className="text-xs text-gray-400">
                        {member.emp_role} · {member.mobile_number || "No Phone"}
                      </p>
                    </div>
                  </label>
                ))}
                {teamMembers.length === 0 && (
                  <p className="text-sm text-center text-gray-400">No team members found</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: N.hairline }}>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border text-gray-700 hover:bg-gray-50 transition-colors"
                style={{ borderColor: N.hairlineStrong }}
                disabled={savingShare}
              >
                Cancel
              </button>
              <button
                onClick={saveShares}
                className="px-4 py-2 text-xs font-bold text-white rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: "#a855f7" }}
                disabled={savingShare}
              >
                {savingShare ? "Saving..." : "Save Sharing"}
              </button>
            </div>
          </div>
        </div>
      )}

      <WhatsAppCampaignWizard
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        initialContacts={(selectedClientIds.length ? clients.filter(c => selectedClientIds.includes(c.id)) : clients).map(c => ({
          name: c.name || c.customer_name || c.company_name || "Customer",
          phone: c.phone || c.mobile_number || "",
          source: "CRM Client",
        }))}
        onSuccess={() => setSelectedClientIds([])}
      />
    </div>
  );
};

export default Clients;