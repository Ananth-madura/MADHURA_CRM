"use strict";

const path = require("path");
const fs = require("fs");

let LOGO_B64 = "";
for (const p of [
  path.resolve(__dirname, "../../frontend/src/images/achme2logo-high.jpeg"),
  path.resolve(__dirname, "../../frontend/src/images/logo.png"),
  path.resolve(__dirname, "../../frontend/src/images/logo.jpeg"),
]) {
  try { LOGO_B64 = fs.readFileSync(p).toString("base64"); break; } catch (_) {}
}
const LOGO_SRC = LOGO_B64 ? `data:image/jpeg;base64,${LOGO_B64}` : "";

let BRAND_B64 = "";
for (const p of [
  path.resolve(__dirname, "../../frontend/src/images/achme-logo-high.jpeg"),
  path.resolve(__dirname, "../../frontend/src/images/backhead.png"),
]) {
  try { BRAND_B64 = fs.readFileSync(p).toString("base64"); break; } catch (_) {}
}
const BRAND_SRC = BRAND_B64 ? `data:image/jpeg;base64,${BRAND_B64}` : "";

function esc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BRANCH_DATA = {
  "Coimbatore": { address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX" },
  "Bangalore": { address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM" },
  "Chennai": { address: "5th Floor, 5CD PM Towers, Dreams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX" },
};

const BANK_DETAILS = [
  { id: "hdfc", company: "ACHME COMMUNICATION", bank: "HDFC BANK", account: "00312320005822", ifsc: "HDFC0000031", branch: "Coimbatore" },
  { id: "kotak", company: "Achme Communication", bank: "KOTAK MAHINDRA BANK", account: "9211242667", ifsc: "KKBK0000491", branch: "Avinashi Road, Coimbatore" },
];

const BRANCHES = {
  Coimbatore: { name: "Coimbatore", address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX" },
  Bangalore: { name: "Bangalore", address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM" },
  Chennai: { name: "Chennai", address: "5th Floor, 5CD PM Towers, Dreams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX" },
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
  const fmtNum = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const hasGST = taxRate > 0;
  const showCGST = totalCGST > 0;
  const showSGST = totalSGST > 0;
  const showIGST = totalIGST > 0;
  const showDiscount = totalDiscount > 0;
  const hasHSN = (items || []).some((i) => i.hsn_sac);
  const hasBrandModel = (items || []).some((r) => r.brand_model && String(r.brand_model).trim() !== "");

  const terms = [];
  if (h.terms_general) terms.push("General Terms & Conditions apply.");
  if (h.terms_tax) terms.push("Prices quoted are exclusive of Sales and Service Tax.");
  if (h.terms_project_period) terms.push(`Project Period: ${esc(h.terms_project_period)}`);
  if (h.terms_validity) terms.push(`Quote valid for ${esc(h.terms_validity)} from quotation date.`);
  try {
    const so = typeof h.terms_separate_orders === "string" ? JSON.parse(h.terms_separate_orders) : (h.terms_separate_orders || {});
    if (so.material) terms.push("A. Material Supply (As per actuals)");
    if (so.installation) terms.push("B. Installation / Services");
    if (so.usd) terms.push("C. Price may vary based on USD rates");
    if (so.boq) terms.push("D. Factory BOQ may vary");
  } catch (_) {}
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

  const execName = esc(h.exec_name || "KRISHNA KUMAR M");
  const execPhone = esc(h.exec_phone || "9842235515");
  const execEmail = h.exec_email ? esc(h.exec_email) : "";

  const otherBranches = Object.entries(BRANCHES)
    .filter(([key]) => key !== h.supplier_branch)
    .map(([, v]) => v);

  const itemRows = (items || []).map((item, i) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const lineTotal = qty * price;

    const desc = item.description || "---";
    const commaIndex = desc.indexOf(",");
    let descHtml = "";
    if (commaIndex !== -1) {
      const heading = desc.substring(0, commaIndex + 1);
      const body = desc.substring(commaIndex + 1);
      descHtml = `<div style="display:flex;flex-direction:column;gap:2px;text-align:left;">
        <span style="font-weight:700;color:#1e293b;font-size:11px;">${esc(heading)}</span>
        <span style="font-weight:400;color:#64748b;font-size:10px;margin-top:2px;display:block;">${esc(body.trim())}</span>
      </div>`;
    } else {
      descHtml = `<strong>${esc(desc)}</strong>`;
    }

    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;">${i + 1}</td>
      ${hasBrandModel ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;">${esc(item.brand_model || "---")}</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;">
        ${descHtml}
      </td>
      ${hasHSN ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;">${esc(item.hsn_sac || "---")}</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:center;">${qty}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;">${esc(item.uom || "Nos")}</td>
      ${hasGST ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;">${item.tax || taxRate}%</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;">Rs. ${fmtNum(price)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:right;"><strong>Rs. ${fmtNum(lineTotal)}</strong></td>
    </tr>`;
  }).join("");

  const termsListItems = terms.map((t) => `<li style="margin-bottom:4px;">${t}</li>`).join("");

  const summaryRows = `
    <tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">Subtotal</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">Rs. ${fmtNum(subtotal)}</td></tr>
    ${showDiscount ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">Discount</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">Rs. ${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${showCGST ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">CGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">Rs. ${fmtNum(totalCGST)}</td></tr>` : ""}
    ${showSGST ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">SGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">Rs. ${fmtNum(totalSGST)}</td></tr>` : ""}
    ${showIGST ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">IGST (${taxRate}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">Rs. ${fmtNum(totalIGST)}</td></tr>` : ""}
    ${!hasGST ? `<tr><td style="padding:10px 8px;font-size:10px;color:#64748b;width:50%;">Without GST</td><td style="padding:10px 8px;width:50%;"></td></tr>` : ""}
    <tr><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;font-weight:700;background:#f0f4ff;width:50%;">GRAND TOTAL</td><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;text-align:right;font-weight:700;background:#f0f4ff;width:50%;">Rs. ${fmtNum(grandTotal)}</td></tr>`;

  const branchesHtml = otherBranches.length > 0 ? `
    <div class="brb">
      <div class="sh">OUR BRANCHES</div>
      <div style="font-size:11.5px;line-height:1.6;color:#1a1f2e;">
        ${otherBranches.map((b) => `<div style="margin-bottom:4px;"><strong>${esc(b.name)}:</strong> ${esc(b.address)} | <strong>GSTIN:</strong> ${esc(b.gstin)}</div>`).join("")}
      </div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${docLabel}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; width: 210mm; background: #fff; }
    body { font-family: "Poppins", Arial, sans-serif; color: #1a1f2e; }

    .qw {
      position: relative; width: 210mm; min-height: 297mm;
      background: #fff; padding: 9mm;
    }
    /* Fixed top color bar — appears on every page */
    .top-bar {
      position: fixed; top: 0; left: 0; right: 0; height: 6px;
      background: linear-gradient(to right, #1f0779e0, #340285, #1b03a1); z-index: 110;
    }
    /* Fixed watermark — appears centered on every page */
    .wm {
      position: fixed; top: 50vh; left: 50%; max-width: 55%; max-height: 55%;
      transform: translate(-50%, -50%); opacity: 0.07; pointer-events: none;
      z-index: 50; object-fit: contain;
    }
    /* Fixed page header — appears on every page */
    .page-header {
      position: fixed; top: 6px; left: 0; right: 0; background: #fff; z-index: 100;
      padding: 6px 9mm 0;
    }
    /* Content pushed down to clear fixed header (~30mm tall) */
    .ct { position: relative; z-index: 1; padding-top: 30mm; }

    .hdr {
      display: table; width: 100%; border-bottom: 3px solid #1e3a8a; padding-bottom: 12px;
    }
    .hdr-left { display: table-cell; vertical-align: top; width: 55%; }
    .hdr-right { display: table-cell; vertical-align: top; width: 45%; text-align: right; }
    .brand img { display: block; max-width: 330px; height: auto; }
    .qt h2 { color: #1e3a8a; font-size: 22px; font-weight: 500; line-height: 1; margin-bottom: 10px; }
    .db {
      display: inline-block; border: 1px solid #cbd5e1; border-radius: 8px;
      padding: 10px 14px; background: #f8fafc; color: #64748b; font-size: 12px;
    }
    .db span { color: #1a1f2e; font-weight: 600; }
    .db-item { display: inline-block; margin-right: 14px; }

    .tb { display: table; width: 100%; margin-top: 14px; border-spacing: 12px 0; }
    .tb-cell { display: table-cell; width: 50%; vertical-align: top; }

    .ib {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 12px; min-height: 160px; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
    }
    .bt { color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 8px; }
    .ib h3 { font-size: 15px; font-weight: 700; color: #2c2c2c; margin-bottom: 3px; line-height: 1.25; }
    .gst-line { color: #64748b; font-size: 11px; font-weight: 600; margin-bottom: 9px; }
    .cp { font-size: 11.5px; line-height: 1.55; color: #1a1f2e; }
    .cl { display: table; width: 100%; margin-top: 7px; font-size: 11.5px; line-height: 1.55; }
    .cl-label { display: table-cell; color: #1e293b; font-weight: 600; min-width: 44px; }
    .cl-value { display: table-cell; color: #1a1f2e; word-break: break-word; }

    .tw {
      width: 100%; margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 10px;
      background: #fff; box-shadow: 0 2px 8px rgba(30,41,59,0.08); overflow: hidden;
    }
    .tw table { width: 100%; border-collapse: collapse; }
    .tw th {
      padding: 10px 8px; border-bottom: 2px solid #1e3a8a; color: #1e293b;
      font-size: 10.5px; font-weight: 700; text-align: left; white-space: nowrap; background: #f8fafc;
    }
    .tw td {
      padding: 10px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;
      vertical-align: top; color: #1a1f2e;
    }
    .tw tbody tr:last-child td { border-bottom: none; }

    .ms { margin-top: 12px; }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .box {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 14px; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
      min-height: 100px;
    }
    .sh { color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 8px; }

    .st-wrap {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      box-shadow: 0 2px 8px rgba(30,41,59,0.08); overflow: hidden;
      min-height: 100px;
    }
    .st {
      width: 100%; border-collapse: collapse; table-layout: fixed;
    }
    .st td { padding: 10px 8px; font-size: 12px; }
    .st tr:last-child td { border-bottom: none; }

    .bb {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 14px; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
      min-height: 100px;
    }

    .bg { display: grid; grid-template-columns: 88px 1fr; gap: 7px 10px; }
    .bg-label { color: #64748b; font-size: 11.5px; }
    .bg-value { font-weight: 700; font-size: 11.5px; color: #1a1f2e; }

    .brb {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 14px; margin-top: 14px; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
    }

    .ft {
      display: flex; flex-wrap: wrap; gap: 8px 20px; justify-content: flex-end;
      align-items: center; margin-top: 12px; padding: 10px 12px;
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      box-shadow: 0 2px 8px rgba(30,41,59,0.08);
    }
    .ft span { color: #1e3a8a; font-weight: 600; }
    .ft div { font-size: 11.5px; line-height: 1.55; }
  </style>
</head>
<body>
  <!-- Fixed top color bar — repeats on every PDF page -->
  <div class="top-bar"></div>

  <!-- Fixed watermark — repeats centered on every PDF page -->
  ${LOGO_SRC ? `<img class="wm" src="${LOGO_SRC}" alt="watermark">` : ""}

  <!-- Fixed page header — repeats on every PDF page -->
  <div class="page-header">
    <div class="hdr">
      <div class="hdr-left">
        <div class="brand">
          ${BRAND_SRC ? `<img src="${BRAND_SRC}" alt="Achme Communication">` : `<h3 style="color:#1e3a8a;font-size:20px;">Achme Communication</h3>`}
        </div>
      </div>
      <div class="hdr-right">
        <div class="qt">
          <h2>${docLabel}</h2>
          <div class="db">
            <span class="db-item"><span>Doc No:</span> ${docNumber}</span>
            <span class="db-item"><span>Date:</span> ${fmtDate(invoiceDate)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Main paginated content -->
  <div class="qw">
    <div class="ct">

      <!-- FROM / BILLED TO -->
      <div class="tb">
        <div class="tb-cell">
          <div class="ib">
            <div class="bt">FROM</div>
            <h3>Achme Communication</h3>
            <div class="gst-line">GSTIN: ${fromGstin}</div>
            <div class="cp">${fromAddress}</div>
            <div class="cl"><span class="cl-label">Ph:</span><span class="cl-value">0422-2569966, 4376555</span></div>
            <div class="cl"><span class="cl-label">Email:</span><span class="cl-value">info@achmecommunication.com</span></div>
            <div class="cl"><span class="cl-label">Web:</span><span class="cl-value">www.achmecommunication.com</span></div>
          </div>
        </div>
        <div class="tb-cell">
          <div class="ib">
            <div class="bt">BILLED TO</div>
            <h3>${esc(h.client_company || h.customer_name || "---")}</h3>
            ${h.client_company ? `<div class="cp" style="font-size:11px;color:#64748b;margin-bottom:4px;">${esc(h.customer_name)}</div>` : ""}
            ${(clientAddr || h.client_pincode) ? `<div class="cp" style="margin-top:6px;">${esc(clientAddr)}${clientPin}${clientCountry}</div>` : ""}
            ${h.mobile_number ? `<div class="cl" style="margin-top:6px;"><span class="cl-label">Ph:</span><span class="cl-value">${esc(h.mobile_number)}</span></div>` : ""}
            ${h.email ? `<div class="cl"><span class="cl-label">Email:</span><span class="cl-value">${esc(h.email)}</span></div>` : ""}
            ${h.gst_number ? `<div class="cl"><span class="cl-label">GST:</span><span class="cl-value">${esc(h.gst_number)}</span></div>` : ""}
          </div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th style="width:30px;">S.NO</th>
              ${hasBrandModel ? "<th>BRAND / MODEL</th>" : ""}
              <th>DESCRIPTION</th>
              ${hasHSN ? "<th>HSN/SAC</th>" : ""}
              <th style="width:40px;text-align:center;">QTY</th>
              <th style="width:50px;">UOM</th>
              ${hasGST ? '<th style="width:45px;text-align:right;">GST%</th>' : ""}
              <th style="width:80px;text-align:right;">PRICE</th>
              <th style="width:90px;text-align:right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- MID SECTION: 4 boxes in 2x2 grid -->
      <div class="ms">
        <div class="g2">
          <!-- Top-Left: Terms -->
          <div class="box">
            <div class="sh">TERMS &amp; CONDITIONS</div>
            ${terms.length > 0 ? `<ul style="padding-left:18px;margin:0;font-size:11.5px;line-height:1.6;color:#1a1f2e;">${termsListItems}</ul>` : '<div style="font-size:11.5px;color:#94a3b8;">No terms specified</div>'}
          </div>
          <!-- Top-Right: Summary (fixed size box) -->
          <div class="st-wrap">
            <table class="st"><tbody>${summaryRows}</tbody></table>
          </div>
          <!-- Bottom-Left: Notes -->
          <div class="box">
            <div class="sh">IMPORTANT NOTES</div>
            <div style="font-size:11.5px;line-height:1.6;color:#1a1f2e;">
              <div style="margin-bottom:6px;"><strong>Materials:</strong> BOQ based on discussion. Extra materials required at execution charged extra. CABLE &amp; ACCESSORIES AS PER ACTUALS.</div>
              <div style="margin-bottom:6px;"><strong>Delay:</strong> Delays due to external dependencies at site - Achme Communication will not be responsible.</div>
              <div><strong>NOTE:</strong> Civil, Electrical &amp; Interior Works not included.</div>
            </div>
          </div>
          <!-- Bottom-Right: Bank -->
          <div class="bb">
            <div class="sh">BANK DETAILS</div>
            <div class="bg">
              <div class="bg-label">Company</div><div class="bg-value">${bank.company}</div>
              <div class="bg-label">Bank</div><div class="bg-value">${bank.bank}</div>
              <div class="bg-label">Account</div><div class="bg-value">${bank.account}</div>
              <div class="bg-label">IFSC</div><div class="bg-value">${bank.ifsc}</div>
              <div class="bg-label">Branch</div><div class="bg-value">${bank.branch}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- BRANCHES (other 2 branches) -->
      ${branchesHtml}

      <!-- FOOTER -->
      <div class="ft">
        <div><span>Executive:</span> ${execName}</div>
        <div><span>PH:</span> ${execPhone}</div>
        ${execEmail ? `<div><span>Email:</span> ${execEmail}</div>` : ""}
      </div>

    </div>
  </div>
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
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePdf };
