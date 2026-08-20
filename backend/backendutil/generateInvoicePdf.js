"use strict";

const path = require("path");
const fs = require("fs");

const LOGO_PATH = path.resolve(__dirname, "../../frontend/src/layout/Madhura-logo.png");
let LOGO_B64 = "";
try { LOGO_B64 = fs.readFileSync(LOGO_PATH).toString("base64"); } catch (_) { }
const LOGO_SRC = LOGO_B64 ? `data:image/png;base64,${LOGO_B64}` : "";

const BRAND_SRC = LOGO_SRC;

function esc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BRANCH_DATA = {
  "Coimbatore": { address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX", phone: "0422 4397555 , 2563666" },
  "Bangalore": { address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM", phone: "9842235515, 8012555718" },
  "Chennai": { address: "5th Floor, 5CD PM Towers, Greams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX", phone: "8012555706, 8012555710" },
};

const BANK_DETAILS = [
  { id: "hdfc", company: "ACHME COMMUNICATION", bank: "HDFC BANK", account: "00312320005822", ifsc: "HDFC0000031", branch: "Coimbatore" },
  { id: "kotak", company: "Achme Communication", bank: "KOTAK MAHINDRA BANK", account: "9211242667", ifsc: "KKBK0000491", branch: "Avinashi Road, Coimbatore" },
];

const BRANCHES = {
  Coimbatore: { name: "Coimbatore", address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX" },
  Bangalore: { name: "Bangalore", address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM" },
  Chennai: { name: "Chennai", address: "5th Floor, 5CD PM Towers, Greams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX" },
};

async function generateInvoicePdf({ invoice, items, type, label, prefix }) {
  const puppeteer = require("puppeteer");

  const TYPE_MAP = {
    quotation: { label: "QUOTATION", prefix: "QT" },
    proforma: { label: "PROFORMA INVOICE", prefix: "PI" },
    estimation: { label: "ESTIMATION", prefix: "EI" },
    service: { label: "SERVICE ESTIMATION", prefix: "SE" },
  };
  const def = TYPE_MAP[type] || TYPE_MAP.quotation;
  const docLabel = (label || def.label).toUpperCase();
  const docPfx = prefix || def.prefix;
  const h = invoice;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "---";
  const fmtNum = (n, showSym = true) => {
    const v = Number(n || 0);
    const formatted = v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
    return showSym ? `\u20B9 ${formatted}` : formatted;
  };

  const numberToWords = (num) => {
    const a = ["", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
      "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ",
      "Seventeen ", "Eighteen ", "Nineteen "];
    const b = ["", "", "Twenty ", "Thirty ", "Forty ", "Fifty ", "Sixty ", "Seventy ", "Eighty ", "Ninety "];
    const helper = (n) => {
      let str = "";
      if (n >= 10000000) { str += helper(Math.floor(n / 10000000)) + "Crore "; n %= 10000000; }
      if (n >= 100000) { str += helper(Math.floor(n / 100000)) + "Lakh "; n %= 100000; }
      if (n >= 1000) { str += helper(Math.floor(n / 1000)) + "Thousand "; n %= 1000; }
      if (n >= 100) { str += a[Math.floor(n / 100)] + "Hundred "; n %= 100; }
      if (n > 0) {
        if (n < 20) str += a[n];
        else str += b[Math.floor(n / 10)] + a[n % 10];
      }
      return str;
    };
    let n = Math.round(num);
    if (n === 0) return "Zero Rupees Only";
    return helper(n).trim() + " Rupees Only";
  };

  const invoiceDate = h.invoice_date || h.quotation_date || h.estimate_date || new Date().toISOString();
  const docId = h.invoice_id || h.quotation_id || h.id;
  const docNumber = `${docPfx}-${new Date(invoiceDate).getFullYear()}-${String(docId).padStart(3, "0")}`;

  let taxRate = 18;
  if (h.custom_tax) taxRate = Number(h.custom_tax);
  else if (h.tax_type === "GST5") taxRate = 5;
  else if (h.tax_type === "NONE" || h.tax_type === "Without GST") taxRate = 0;

  const subtotal = Number(h.subtotal || 0);
  const totalDiscount = Number(h.total_discount || 0);
  const totalCGST = Number(h.total_cgst || 0);
  const totalSGST = Number(h.total_sgst || 0);
  const totalIGST = Number(h.total_igst || 0);
  const grandTotal = Number(h.grand_total || 0) || (subtotal - totalDiscount + totalCGST + totalSGST + totalIGST);

  const hasGST = taxRate > 0 || totalCGST > 0 || totalSGST > 0 || totalIGST > 0;
  const showCGST = totalCGST > 0;
  const showSGST = totalSGST > 0;
  const showIGST = totalIGST > 0;
  const showDiscount = totalDiscount > 0;

  const gstModeStr = h.gst_mode || "Exclusive";

  let showBreakdown = true;
  try {
    const so = typeof h.terms_separate_orders === "string"
      ? JSON.parse(h.terms_separate_orders)
      : (h.terms_separate_orders || {});
    if (so && (so.show_gst_breakdown === false || so.hide_gst_percentage === true)) {
      showBreakdown = false;
    }
  } catch (_) { }

  let gstRows = "";
  if (gstModeStr !== "Exempt" && gstModeStr !== "Without GST") {
    if (showBreakdown) {
      const groups = {};
      (items || []).forEach(r => {
        const taxRate = Number(r.tax) || 0;
        if (taxRate === 0) return;
        const qty = Number(r.quantity || r.qty || 0);
        const price = Number(r.price || 0);
        const discount = Number(r.discount || 0);
        const base = price * qty - discount;

        let gstAmount = 0;
        if (gstModeStr === "Inclusive") {
          const taxableValue = base / (1 + taxRate / 100);
          gstAmount = base - taxableValue;
        } else {
          gstAmount = (base * taxRate) / 100;
        }

        if (gstAmount > 0) {
          if (!groups[taxRate]) groups[taxRate] = 0;
          groups[taxRate] += gstAmount;
        }
      });

      const branchState = (h.supplier_branch === "Bangalore" ? "karnataka" : "tamil nadu");
      const clientState = (h.client_state || "").toLowerCase().trim();
      const same = branchState === clientState && clientState !== "";

      const hasCgstSgst = totalCGST > 0 || totalSGST > 0;
      const hasIgst = totalIGST > 0;
      const isCgstSgst = hasCgstSgst ? true : (hasIgst ? false : same);

      Object.keys(groups).sort((a, b) => Number(b) - Number(a)).forEach(rateStr => {
        const rate = Number(rateStr);
        const amt = groups[rateStr];
        if (isCgstSgst) {
          gstRows += `<tr><td>CGST ${(rate / 2)}%</td><td>${fmtNum(amt / 2)}</td></tr>`;
          gstRows += `<tr><td>SGST ${(rate / 2)}%</td><td>${fmtNum(amt / 2)}</td></tr>`;
        } else {
          gstRows += `<tr><td>IGST ${rate}%</td><td>${fmtNum(amt)}</td></tr>`;
        }
      });
    } else {
      const branchState = (h.supplier_branch === "Bangalore" ? "karnataka" : "tamil nadu");
      const clientState = (h.client_state || "").toLowerCase().trim();
      const same = branchState === clientState && clientState !== "";

      const hasCgstSgst = totalCGST > 0 || totalSGST > 0;
      const hasIgst = totalIGST > 0;

      if (hasCgstSgst && hasIgst) {
        gstRows += `<tr><td>CGST</td><td>${fmtNum(totalCGST)}</td></tr>`;
        gstRows += `<tr><td>SGST</td><td>${fmtNum(totalSGST)}</td></tr>`;
        gstRows += `<tr><td>IGST</td><td>${fmtNum(totalIGST)}</td></tr>`;
      } else if (hasCgstSgst || (totalIGST === 0 && same)) {
        gstRows += `<tr><td>CGST</td><td>${fmtNum(totalCGST)}</td></tr>`;
        gstRows += `<tr><td>SGST</td><td>${fmtNum(totalSGST)}</td></tr>`;
      } else if (hasIgst || (totalCGST === 0 && totalSGST === 0 && !same)) {
        gstRows += `<tr><td>IGST</td><td>${fmtNum(totalIGST)}</td></tr>`;
      }
    }
  }
  const hasHSN = (items || []).some((i) => i.hsn_sac);
  const hasBrandModel = (items || []).some((r) => r.brand_model && String(r.brand_model).trim() !== "");
  const hasDescription = (items || []).some((r) => r.description && String(r.description).trim() !== "");

  const terms = [];
  let attachedImages = [];
  if (h.terms_general) { /* General T&C — checkbox only, no body text */ }
  if (h.terms_tax) terms.push("Prices quoted are exclusive of Sales and Service Tax.");
  if (h.terms_project_period) terms.push(`Project Period: ${esc(h.terms_project_period)}`);
  if (h.terms_validity) terms.push(`Quote valid for ${esc(h.terms_validity)} from quotation date.`);
  try {
    const so = typeof h.terms_separate_orders === "string" ? JSON.parse(h.terms_separate_orders) : (h.terms_separate_orders || {});
    if (so.material) terms.push("A. Material Supply (As per actuals)");
    if (so.installation) terms.push("B. Installation / Services");
    if (so.usd) terms.push("C. Price may vary based on USD rates");
    if (so.boq) terms.push("D. Factory BOQ may vary");
    if (so.attached_images) attachedImages = so.attached_images;
  } catch (_) { }
  if (h.terms_payment) {
    const pt = h.terms_payment === "Custom" ? h.terms_payment_custom : h.terms_payment;
    if (pt) terms.push(`Payment Terms: ${esc(pt)}`);
  }
  if (h.terms_payment_custom && h.terms_payment !== "Custom") terms.push(`Payment Terms: ${esc(h.terms_payment_custom)}`);
  if (h.terms_warranty) terms.push(`Warranty: ${esc(h.terms_warranty)}`);
  if (h.custom_terms) terms.push(esc(h.custom_terms));

  const branchData = BRANCH_DATA[h.supplier_branch] || BRANCH_DATA["Coimbatore"];
  const fromAddress = esc(h.resolved_from_address || h.from_address_custom || branchData.address || "436H Avinashi Road Opp to SMS Hotel, Peelamedu, Coimbatore-641004");
  const fromGstin = esc(h.from_gstin || branchData.gstin || "33AAHFA7876M1ZX");

  const bank = {
    company: esc(h.bank_company || (h.bank_details_id ? (BANK_DETAILS.find((b) => b.id === h.bank_details_id) || BANK_DETAILS[0]).company : "ACHME COMMUNICATION")),
    bank: esc(h.bank_name || (h.bank_details_id ? (BANK_DETAILS.find((b) => b.id === h.bank_details_id) || BANK_DETAILS[0]).bank : "HDFC BANK")),
    account: esc(h.bank_account || (h.bank_details_id ? (BANK_DETAILS.find((b) => b.id === h.bank_details_id) || BANK_DETAILS[0]).account : "00312320005822")),
    ifsc: esc(h.bank_ifsc || (h.bank_details_id ? (BANK_DETAILS.find((b) => b.id === h.bank_details_id) || BANK_DETAILS[0]).ifsc : "HDFC0000031")),
    branch: esc(h.bank_branch || (h.bank_details_id ? (BANK_DETAILS.find((b) => b.id === h.bank_details_id) || BANK_DETAILS[0]).branch : "Coimbatore")),
  };

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${esc(h.client_pincode)}` : "";
  const clientCountry = h.client_country && h.client_country !== "India" ? `, ${esc(h.client_country)}` : "";

  const execName = esc(h.exec_name || "");
  const execPhone = esc(h.exec_phone || "");
  const execEmail = h.exec_email ? esc(h.exec_email) : "";
  const fromPhoneRaw = branchData.phone || "0422 4397555 , 2563666";
  const fromPhone = fromPhoneRaw.split(",").map(p => `+91 ${p.trim()}`).join("  |  ");

  const otherBranches = Object.entries(BRANCHES)
    .filter(([key]) => key !== h.supplier_branch)
    .map(([, v]) => v);

  const itemRows = (items || []).map((item, i) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const lineTotal = qty * price;

    const desc = item.description || "";
    const commaIndex = desc.indexOf(",");
    let descHtml = "";
    if (!desc.trim()) {
      descHtml = "";
    } else if (commaIndex !== -1) {
      const heading = desc.substring(0, commaIndex + 1);
      const body = desc.substring(commaIndex + 1);
      descHtml = `<div style="display:flex;flex-direction:column;gap:2px;text-align:left;">
        <span style="font-weight:700;color:#1e293b;font-size:12px;">${esc(heading)}</span>
        <span style="font-weight:400;color:#64748b;font-size:10.5px;margin-top:2px;">${esc(body.trim())}</span>
      </div>`;
    } else {
      descHtml = `<strong>${esc(desc)}</strong>`;
    }

    return `<tr>
      <td>${i + 1}</td>
      ${hasBrandModel ? `<td style="width:80px;max-width:80px;word-break:break-word;">${esc(item.brand_model || "---")}</td>` : ""}
      ${hasDescription ? `<td style="width:240px;max-width:240px;word-break:break-word;">${descHtml}</td>` : ""}
      ${hasHSN ? `<td>${esc(item.hsn_sac || "---")}</td>` : ""}
      <td>${qty}</td>
      <td style="text-align:center;">${fmtNum(price, false)}</td>
      <td>${esc(item.uom || "Nos")}</td>
      ${hasGST ? `<td>${item.tax || taxRate}%</td>` : ""}
      <td style="font-weight:bold;">${fmtNum(lineTotal, false)}</td>
    </tr>`;
  }).join("");

  const termsListItems = terms.map((t) => `<li style="margin-bottom:4px;">${t}</li>`).join("");

  const summaryRows = `
    <tr><td style="width:50%">Subtotal</td><td style="width:50%">${fmtNum(subtotal)}</td></tr>
    ${showDiscount ? `<tr><td>Discount</td><td>${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${gstRows}
    ${!hasGST ? `<tr><td style="color:#64748b;font-size:10px;">Without GST</td><td></td></tr>` : ""}
    <tr class="ft-grand-total"><td style="width:50%">GRAND TOTAL</td><td style="width:50%">${fmtNum(grandTotal)}</td></tr>
    <tr><td colspan="2" style="font-size:10px;color:#64748b;font-style:italic;text-align:right;padding:4px 6px 6px 6px;"><strong>Amount in Words:</strong> ${numberToWords(grandTotal)}</td></tr>`;

  const branchesHtml = otherBranches.length > 0 ? `
    <div class="ft-branch-box">
      <div class="ft-section-heading">OUR BRANCHES</div>
      ${otherBranches.map((b, i) => `<span><strong>${esc(b.name)}:</strong> ${esc(b.address)} | <strong>GSTIN:</strong> ${esc(b.gstin)}${i < otherBranches.length - 1 ? "<br>" : ""}</span>`).join("")}
    </div>` : "";

  // ─── HTML: uses the EXACT SAME class names and structure as form-template.css ───
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${docLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ─── Exact copy of form-template.css (PDF-mode) ─── */
    :root {
      --ink: #1a1f2e; --muted: #64748b; --line: #64748b; --line-soft: #94a3b8;
      --brand: #1e3a8a; --brand-deep: #1e293b; --paper: #ffffff;
      --shadow-sm: 0 2px 10px rgba(37,99,235,0.15); --card-bg: rgba(255,255,255,0.96);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Poppins", Arial, sans-serif; color: var(--ink); background: #fff; margin: 0; padding: 0; }

    /* ── Wrapper: flex column so footer group is pushed to page bottom ── */
    .ft-quotation-wrapper {
      position: relative; width: 100%; min-height: calc(297mm - 20mm);
      background: var(--paper); padding: 0;
      display: flex; flex-direction: column;
    }

    /* Watermark + top bar hidden in HTML — added by pdf-lib post-processing */
    .ft-watermark { display: none; }
    .ft-top-bar { display: none; }

    .ft-content { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; }

    /* Branches + Executive footer — always pinned to bottom of last page */
    .ft-page-footer-group { margin-top: 0; padding-top: 0; }

    /* ── Header ── */
    .ft-header {
      display: grid; grid-template-columns: minmax(210px,1fr) auto;
      gap: 18px; align-items: start;
      padding-bottom: 12px; border-bottom: 3px solid var(--brand);
    }
    .ft-brand img { display: block; width: min(100%,330px); height: auto; }
    .ft-quotation-title { display: grid; justify-items: end; gap: 10px; text-align: right; }
    .ft-quotation-title h2 { color: var(--brand); font-size: 22px; font-weight: 500; line-height: 0.98; }
    .ft-doc-box {
      display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: flex-end;
      border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
      background: #f8fafc; color: var(--muted); font-size: 12px;
    }
    .ft-doc-box span { color: var(--ink); font-weight: 600; }

    /* ── FROM / BILLED TO boxes – EQUAL SIZE via grid stretch ── */
    .ft-top-boxes {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px; margin-top: 14px; align-items: stretch;
    }

    .ft-info-box,
    .ft-terms-box, .ft-summary-box, .ft-notes-box,
    .ft-bank-box, .ft-branch-box, .ft-footer {
      background: var(--card-bg); border: 1px solid var(--line);
      border-radius: 10px; box-shadow: var(--shadow-sm);
    }
    .ft-info-box {
      min-height: 176px; padding: 12px; height: 100%; text-align: left;
    }
    .ft-box-title, .ft-section-heading { color: var(--brand); font-weight: 700; }
    .ft-box-title { margin-bottom: 8px; font-size: 13px; }
    .ft-info-box h3 { margin-bottom: 3px; font-size: 15px; line-height: 1.25; font-weight: 700; }
    .ft-gst { margin-bottom: 9px; color: var(--muted); font-size: 11px; font-weight: 600; }

    .ft-summary-box { padding: 0; overflow: hidden; height: 100%; }

    .ft-compact, .ft-contact-line, .ft-terms-box li,
    .ft-notes-box, .ft-bank-grid, .ft-branch-box, .ft-footer {
      font-size: 11.5px; line-height: 1.55;
    }
    .ft-contact-line { display: flex; gap: 7px; align-items: baseline; margin-top: 7px; word-break: break-word; }
    .ft-contact-line .label { min-width: 40px; color: var(--brand-deep); font-weight: 600; }

    /* ── Items table ── */
    .ft-table-wrap {
      width: 100%; margin-top: 14px;
      border: 1px solid var(--line); border-radius: 10px;
      background: var(--paper); box-shadow: var(--shadow-sm); overflow: hidden;
    }
    .ft-table-wrap table { width: 100%; border-collapse: collapse; }
    .ft-table-wrap th {
      padding: 10px 8px; border-bottom: 2px solid var(--brand);
      color: var(--brand-deep); font-size: 10.5px; font-weight: 700;
      text-align: left; white-space: nowrap; background: #f8fafc;
    }
    .ft-table-wrap td {
      padding: 10px 8px; border-bottom: 1px solid var(--line-soft);
      font-size: 11px; vertical-align: top; color: var(--ink);
    }
    .ft-table-wrap tbody tr:last-child td,
    .ft-summary-table tr:last-child td { border-bottom: 0; }
    .ft-table-wrap td:last-child, .ft-table-wrap th:last-child,
    .ft-summary-table td:last-child { text-align: right; }

    /* ── Mid section 2×2 grid ── */
    .ft-mid-section { display: block; margin-top: 12px; }
    .ft-grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .ft-terms-box, .ft-notes-box, .ft-bank-box, .ft-branch-box { padding: 12px; }
    .ft-section-heading { margin-bottom: 8px; font-size: 13px; }
    .ft-terms-box ul { padding-left: 16px; }

    /* ── Summary table ── */
    .ft-summary-table {
      border-collapse: collapse; table-layout: fixed; width: 100%;
      border: none; box-shadow: none; border-radius: 0; background: none;
    }
    .ft-summary-table td { padding: 9px 6px; font-size: 12px; }
    .ft-grand-total td { color: var(--brand); font-size: 14px; font-weight: 700; background: #f0f4ff; }

    /* ── Bank grid ── */
    .ft-bank-grid { display: grid; grid-template-columns: 88px minmax(0,1fr); gap: 7px 10px; }
    .ft-bank-grid div:nth-child(odd) { color: var(--muted); }

    /* ── Branches ── */
    .ft-branch-box { margin-top: 12px; }

    /* ── Footer: fixed at bottom of EVERY page ── */
    .ft-footer {
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: nowrap !important;
      justify-content: flex-end !important;
      align-items: center !important;
      gap: 20px !important;
      padding: 10px 12px !important;
      width: 100% !important;
    }
    .ft-footer span { color: var(--brand); font-weight: 600; }

    .ft-footer, .ft-branch-box {
      border: 2px solid #1D3A8A !important;
      box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important;
    }
    .ft-attached-images-box {
      background: var(--card-bg);
      border: 2px solid #1D3A8A !important;
      box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important;
      border-radius: 10px;
      padding: 14px;
      margin-top: 14px;
    }
    .ft-attached-images-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .ft-attached-images-grid.count-1 {
      display: flex;
      justify-content: center;
    }
    .ft-attached-images-grid.count-1 .ft-attached-image-container {
      width: 608px;
      height: 226px;
      margin: 0 auto;
    }
    .ft-attached-images-grid.count-2 {
      display: grid;
      grid-template-columns: 307px 307px;
      gap: 11px;
      justify-content: center;
    }
    .ft-attached-images-grid.count-2 .ft-attached-image-container {
      width: 307px;
      height: 265px;
    }
    .ft-attached-images-grid.count-3 {
      display: grid;
      grid-template-columns: 307px 285px;
      gap: 11px;
      justify-content: center;
    }
    .ft-attached-images-grid.count-3 .ft-attached-image-container:nth-child(1) {
      grid-column: span 2;
      width: 608px;
      height: 226px;
      margin: 0 auto;
    }
    .ft-attached-images-grid.count-3 .ft-attached-image-container:nth-child(2) {
      width: 307px;
      height: 265px;
    }
    .ft-attached-images-grid.count-3 .ft-attached-image-container:nth-child(3) {
      width: 285px;
      height: 267px;
    }
    .ft-attached-image-container {
      background: #fff;
      border: 2px solid #1D3A8A !important;
      box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important;
      border-radius: 8px;
      padding: 0px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 140px;
      overflow: hidden;
    }
    .ft-attached-image-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 6px;
    }

    /* ── Page break controls ── */
    tr, .ft-terms-box, .ft-summary-box, .ft-notes-box,
    .ft-bank-box, .ft-attached-images-box { page-break-inside: avoid; }
    .ft-branch-box, .ft-footer { page-break-inside: avoid; }

    /* bottom 12mm reserves space for the footer */
    @page { size: A4 portrait; margin: 8mm 8mm 12mm 8mm; }
  </style>
</head>
<body>
  <!-- Fixed top bar (repeats on every page) -->
  <div class="ft-top-bar"></div>

  <!-- Fixed watermark (repeats centered on every page) -->
  ${LOGO_SRC ? `<img class="ft-watermark" src="${LOGO_SRC}" alt="" />` : ""}

  <main class="ft-quotation-wrapper" style="padding-top:0;">
    <div class="ft-content">
      <table style="width:100%;border-collapse:collapse;border:none;">
        <thead>
          <tr>
            <td style="padding:0;border:none;">
              <!-- HEADER -->
              <header class="ft-header">
                <div class="ft-brand">
                  ${BRAND_SRC ? `<img src="${BRAND_SRC}" alt="Achme Communication" />` : `<h3 style="color:#1e3a8a;font-size:20px;">Achme Communication</h3>`}
                </div>
                <div class="ft-quotation-title">
                  <h2>${docLabel}</h2>
                  <div class="ft-doc-box">
                    <div><span>Doc No:</span> ${docNumber}</div>
                    <div><span>Date:</span> ${fmtDate(invoiceDate)}</div>
                  </div>
                </div>
              </header>
              <div style="height:14px;"></div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:0;border:none;">

              <!-- FROM / BILLED TO (equal-height grid) -->
              <section class="ft-top-boxes">
                <div class="ft-info-box">
                  <div class="ft-box-title">FROM</div>
                  <h3>Achme Communication</h3>
                  <div class="ft-gst">GSTIN: ${fromGstin}</div>
                  <div class="ft-compact">${fromAddress}</div>
                  <div class="ft-contact-line"><span class="label">Ph:</span><span>${fromPhone}</span></div>
                  <div class="ft-contact-line"><span class="label">Email:</span><span>sales@achmecommunication.com</span></div>
                  <div class="ft-contact-line"><span class="label">Web:</span><span>www.achmecommunication.com</span></div>
                </div>
                <div class="ft-info-box">
                  <div class="ft-box-title">BILLED TO</div>
                  ${(() => {
      const clientCompany = (h.client_company || "").trim();
      return `<h3>${esc(clientCompany || h.customer_name || "---")}</h3>
                    ${clientCompany ? `<div class="ft-compact" style="font-size:11px;color:#64748b;margin-bottom:4px;">${esc(h.customer_name)}</div>` : ""}`;
    })()}
                  ${h.gst_number ? `<div class="ft-gst">GSTIN: ${esc(h.gst_number)}</div>` : ""}
                  ${(clientAddr || h.client_pincode) ? `<div class="ft-compact">${esc(clientAddr)}${clientPin}${clientCountry}</div>` : ""}
                  ${h.mobile_number ? `<div class="ft-contact-line"><span class="label">Ph:</span><span>+91 ${esc(h.mobile_number)}</span></div>` : ""}
                  ${h.email ? `<div class="ft-contact-line"><span class="label">Email:</span><span>${esc(h.email)}</span></div>` : ""}
                </div>
              </section>

              <!-- ITEMS TABLE -->
              <div class="ft-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width:32px;">S.NO</th>
                      ${hasBrandModel ? '<th style="width:80px;max-width:80px;">BRAND</th>' : ""}
                      ${hasDescription ? '<th style="width:240px;max-width:240px;">DESCRIPTION</th>' : ""}
                      ${hasHSN ? '<th style="width:80px;">HSN/SAC</th>' : ""}
                      <th style="width:40px;">QTY</th>
                      <th style="width:100px;text-align:center;">UNIT PRICE</th>
                      <th style="width:50px;">UOM</th>
                      ${hasGST ? '<th style="width:48px;">GST%</th>' : ""}
                      <th style="width:90px;text-align:right;">TOTAL VALUE</th>
                    </tr>
                  </thead>
                  <tbody>${itemRows}</tbody>
                </table>
              </div>

              <!-- MID SECTION: 2×2 grid -->
              <section class="ft-mid-section">
                <div class="ft-grid-2x2">
                  <!-- Terms -->
                  ${terms.length > 0 ? `
                  <div class="ft-terms-box">
                    <div class="ft-section-heading">TERMS &amp; CONDITIONS</div>
                    <ul style="font-size:11.5px;line-height:1.55;">${termsListItems}</ul>
                  </div>` : `<div class="ft-terms-box"><div class="ft-section-heading">TERMS &amp; CONDITIONS</div><div style="font-size:11.5px;color:#94a3b8;">No terms specified</div></div>`}

                  <!-- Summary -->
                  <div class="ft-summary-box">
                    <table class="ft-summary-table">
                      <tbody>${summaryRows}</tbody>
                    </table>
                  </div>

                  <!-- Notes -->
                  <div class="ft-notes-box">
                    <div class="ft-section-heading">IMPORTANT NOTES</div>
                    <div style="font-size:11.5px;line-height:1.55;">
                      <strong>Materials:</strong> BOQ based on discussion. Extra materials required at execution charged extra. CABLE &amp; ACCESSORIES AS PER ACTUALS.<br><br>
                      <strong>Delay:</strong> Delays due to external dependencies at site - Achme Communication will not be responsible.<br><br>
                      <strong>NOTE:</strong> Civil, Electrical &amp; Interior Works not included.
                    </div>
                  </div>

                  <!-- Bank -->
                  <div class="ft-bank-box">
                    <div class="ft-section-heading">BANK DETAILS</div>
                    <div class="ft-bank-grid">
                      <div>Company</div><div><strong>${bank.company}</strong></div>
                      <div>Bank</div><div><strong>${bank.bank}</strong></div>
                      <div>Account</div><div><strong>${bank.account}</strong></div>
                      <div>IFSC</div><div><strong>${bank.ifsc}</strong></div>
                      <div>Branch</div><div><strong>${bank.branch}</strong></div>
                    </div>
                  </div>
                </div>
              </section>

              ${attachedImages && attachedImages.length > 0 ? `
              <div class="ft-attached-images-box">
                <div class="ft-attached-images-grid count-${attachedImages.length}">
                  ${attachedImages.map((img, idx) => `
                    <div class="ft-attached-image-container">
                      <img src="${img}" alt="Attachment ${idx + 1}" />
                    </div>
                  `).join("")}
                </div>
              </div>` : ""}

              <!-- EXECUTIVE (top) + BRANCHES (under): pinned to bottom of last page -->
              <div class="ft-page-footer-group">
                ${(execName || execPhone || execEmail) ? `
                <footer class="ft-footer">
                  ${execName ? `<span><strong>Executive:</strong> ${execName}</span>` : ""}
                  ${execPhone ? `<span><strong>PH:</strong> ${execPhone}</span>` : ""}
                  ${execEmail ? `<span><strong>Email:</strong> ${execEmail}</span>` : ""}
                </footer>` : ""}

                ${branchesHtml}
              </div>

            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>`;

  let browser;
  const launchOptions = {
    headless: true,
    args: ["--disable-gpu", "--disable-extensions", "--disable-software-rasterizer", "--no-sandbox"],
  };

  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (launchErr) {
    console.warn("⚠️ Standard Puppeteer launch failed. Attempting system browser fallback...", launchErr.message);

    const possiblePaths = [
      // Chrome standard paths on Windows
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
      // Edge standard paths (Chromium-based, completely compatible!)
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];

    let launched = false;
    for (const execPath of possiblePaths) {
      if (fs.existsSync(execPath)) {
        try {
          browser = await puppeteer.launch({
            ...launchOptions,
            executablePath: execPath,
          });
          console.log(`🚀 System browser fallback successful using: ${execPath}`);
          launched = true;
          break;
        } catch (err) {
          console.warn(`Failed to launch system browser at ${execPath}:`, err.message);
        }
      }
    }

    if (!launched) {
      throw new Error("Could not launch Puppeteer. Please install Google Chrome or Edge, or run 'npx puppeteer browsers install chrome' in your terminal. Details: " + launchErr.message);
    }
  }

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((i) =>
        i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })
      ));
    });

    // ── Pin footer group to the bottom of the LAST page, WITHOUT touching the
    //    Notes / Bank boxes above it ──
    // We rely on Chrome's REAL pagination (not JS math):
    //   • Probe A counts the CONTENT-ALONE pages (footer hidden).
    //   • Probe B lays the footer out in NORMAL flow with a clear gap above it and
    //     page-break-inside:avoid, then counts pages. If the footer can't fit under
    //     the content with that gap, Chrome moves the WHOLE footer onto a fresh
    //     page — so the count tells us the correct number of pages N.
    //   • If B > A the footer was bumped onto an otherwise-empty page (no repeated
    //     <thead> header there), so we re-stamp the captured header image on it.
    //   • Finally we make the wrapper exactly N pages tall and pin the footer to
    //     the very bottom of the last page.
    // A4 (297mm) minus 8mm top + 12mm bottom margins = 277mm content per page.
    await page.emulateMediaType('print');

    const PDF_OPTS = {
      format: "A4",
      printBackground: true,
      margin: { top: "8mm", bottom: "12mm", left: "8mm", right: "8mm" },
    };

    // Capture the header (logo + title + Doc No/Date) as an image so it can be
    // re-stamped on a bumped, otherwise-empty footer page (see the pdf-lib pass).
    let headerShot = null;
    try {
      const headerEl = await page.$(".ft-header");
      if (headerEl) headerShot = await headerEl.screenshot({ type: "png" });
    } catch (e) {
      console.warn("Could not capture header image:", e.message);
    }

    const probePageCount = async () => {
      try {
        const probePdf = await page.pdf(PDF_OPTS);
        const { PDFDocument: PDFDocProbe } = require("pdf-lib");
        return (await PDFDocProbe.load(probePdf)).getPageCount() || 1;
      } catch (e) {
        console.warn("Page-count probe failed, defaulting to 1 page:", e.message);
        return 1;
      }
    };

    // Probe A — content-alone page count (footer hidden).
    await page.evaluate(() => {
      const wrap = document.querySelector(".ft-quotation-wrapper");
      const group = document.querySelector(".ft-page-footer-group");
      if (wrap) wrap.style.removeProperty("min-height");
      if (group) {
        group.style.setProperty("display", "none", "important");
        ["position", "bottom", "left", "right", "margin", "margin-top", "padding-top", "break-inside", "page-break-inside"]
          .forEach((p) => group.style.removeProperty(p));
      }
    });
    const contentPages = await probePageCount();

    // Probe B — footer in natural flow with a reserved gap; the page count is
    // exactly where the footer belongs (same page if it fits, fresh page if not).
    await page.evaluate(() => {
      const GAP_PX = (8 * 96) / 25.4; // ~8mm clear gap kept above the footer
      const wrap = document.querySelector(".ft-quotation-wrapper");
      const group = document.querySelector(".ft-page-footer-group");
      if (wrap) wrap.style.removeProperty("min-height");
      if (group) {
        // Override the flex `margin-top:auto` so the footer sits right after the
        // content (with the gap), and keep the whole group together so it spills
        // to the next page as one block instead of splitting across the boundary.
        ["position", "bottom", "left", "right", "padding-top"].forEach((p) => group.style.removeProperty(p));
        group.style.setProperty("display", "block", "important");
        group.style.setProperty("margin-top", GAP_PX + "px", "important");
        group.style.setProperty("break-inside", "avoid", "important");
        group.style.setProperty("page-break-inside", "avoid", "important");
      }
    });
    const pageCount = await probePageCount();

    // Footer bumped onto a fresh, content-less last page -> it needs a stamped header.
    const footerBumped = pageCount > contentPages;

    // Pass 2 — size the wrapper to exactly `pageCount` pages and pin the footer
    // to the very bottom of the last page via absolute positioning.
    await page.evaluate((nPages) => {
      const PAGE_H_PX = (277 * 96) / 25.4; // content height per A4 page at 96 dpi
      const wrap = document.querySelector(".ft-quotation-wrapper");
      const group = document.querySelector(".ft-page-footer-group");
      if (!wrap || !group) return;

      // Restore the footer to its pinned-card layout (undo the probe overrides).
      group.style.removeProperty("display");
      group.style.removeProperty("break-inside");
      group.style.removeProperty("page-break-inside");
      void group.offsetHeight; // reflow with footer visible again

      wrap.style.setProperty("position", "relative", "important");
      // Fill exactly N pages (−1px so rounding never spills onto a blank N+1 page).
      wrap.style.setProperty("min-height", (nPages * PAGE_H_PX - 1) + "px", "important");

      group.style.setProperty("position", "absolute", "important");
      group.style.setProperty("left", "0", "important");
      group.style.setProperty("right", "0", "important");
      group.style.setProperty("bottom", "0", "important");
      group.style.setProperty("margin", "0", "important");
      group.style.setProperty("padding-top", "0", "important");
    }, pageCount);

    const basePdf = await page.pdf(PDF_OPTS);

    // ── Post-process with pdf-lib: stamp watermark + top bar on EVERY page ──
    const { PDFDocument, rgb } = require("pdf-lib");
    const pdfDoc = await PDFDocument.load(basePdf);
    const pages = pdfDoc.getPages();

    // Embed watermark image
    let wmImage = null;
    if (LOGO_B64) {
      try {
        const wmBytes = Buffer.from(LOGO_B64, "base64");
        wmImage = await pdfDoc.embedJpg(wmBytes);
      } catch (e) {
        console.warn("Could not embed watermark:", e.message);
      }
    }

    // Embed the captured header image (used only on a bumped, empty footer page).
    let hdrImage = null;
    if (footerBumped && headerShot) {
      try {
        hdrImage = await pdfDoc.embedPng(headerShot);
      } catch (e) {
        console.warn("Could not embed header image:", e.message);
      }
    }

    const MARGIN_PT = (8 * 72) / 25.4; // 8mm page margin in PDF points

    for (let pi = 0; pi < pages.length; pi++) {
      const pdfPage = pages[pi];
      const { width, height } = pdfPage.getSize();
      const isLastPage = pi === pages.length - 1;

      // Draw top gradient bar at VERY TOP of page, edge-to-edge (corner to corner)
      const barHeight = 5; // ~6px on screen
      pdfPage.drawRectangle({
        x: 0, y: height - barHeight, width, height: barHeight,
        color: rgb(0.12, 0.03, 0.47), // #1e0779
        opacity: 1,
      });

      // Draw watermark centered on page
      if (wmImage) {
        const wmNatWidth = wmImage.width;
        const wmNatHeight = wmImage.height;
        const maxWm = 340; // max width in points (~120mm)
        const scale = Math.min(maxWm / wmNatWidth, maxWm / wmNatHeight);
        const wmW = wmNatWidth * scale;
        const wmH = wmNatHeight * scale;
        const wmX = (width - wmW) / 2;
        const wmY = (height - wmH) / 2;
        pdfPage.drawImage(wmImage, {
          x: wmX, y: wmY, width: wmW, height: wmH,
          opacity: 0.07,
        });
      }

      // On a bumped, content-less last page the repeating <thead> header is gone,
      // so stamp the captured header image at the top to match a normal page.
      if (isLastPage && hdrImage) {
        const drawW = width - 2 * MARGIN_PT;
        const drawH = hdrImage.height * (drawW / hdrImage.width);
        pdfPage.drawImage(hdrImage, {
          x: MARGIN_PT,
          y: height - MARGIN_PT - drawH,
          width: drawW,
          height: drawH,
        });
      }
    }

    const finalPdf = await pdfDoc.save();
    return Buffer.from(finalPdf);
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePdf };
