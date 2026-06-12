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
  if (h.terms_general) terms.push("General Terms &amp; Conditions apply.");
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

  const execName = esc(h.exec_name || "");
  const execPhone = esc(h.exec_phone || "");
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
        <span style="font-weight:700;color:#1e293b;font-size:12px;">${esc(heading)}</span>
        <span style="font-weight:400;color:#64748b;font-size:10.5px;margin-top:2px;">${esc(body.trim())}</span>
      </div>`;
    } else {
      descHtml = `<strong>${esc(desc)}</strong>`;
    }

    return `<tr>
      <td>${i + 1}</td>
      ${hasBrandModel ? `<td>${esc(item.brand_model || "---")}</td>` : ""}
      <td>${descHtml}</td>
      ${hasHSN ? `<td>${esc(item.hsn_sac || "---")}</td>` : ""}
      <td>${qty}</td>
      <td>${esc(item.uom || "Nos")}</td>
      ${hasGST ? `<td>${item.tax || taxRate}%</td>` : ""}
      <td>Rs. ${fmtNum(price)}</td>
      <td><strong>Rs. ${fmtNum(lineTotal)}</strong></td>
    </tr>`;
  }).join("");

  const termsListItems = terms.map((t) => `<li style="margin-bottom:4px;">${t}</li>`).join("");

  const summaryRows = `
    <tr><td style="width:50%">Subtotal</td><td style="width:50%">Rs. ${fmtNum(subtotal)}</td></tr>
    ${showDiscount ? `<tr><td>Discount</td><td>Rs. ${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${showCGST ? `<tr><td>CGST (${taxRate / 2}%)</td><td>Rs. ${fmtNum(totalCGST)}</td></tr>` : ""}
    ${showSGST ? `<tr><td>SGST (${taxRate / 2}%)</td><td>Rs. ${fmtNum(totalSGST)}</td></tr>` : ""}
    ${showIGST ? `<tr><td>IGST (${taxRate}%)</td><td>Rs. ${fmtNum(totalIGST)}</td></tr>` : ""}
    ${!hasGST ? `<tr><td style="color:#64748b;font-size:10px;">Without GST</td><td></td></tr>` : ""}
    <tr class="ft-grand-total"><td style="width:50%">GRAND TOTAL</td><td style="width:50%">Rs. ${fmtNum(grandTotal)}</td></tr>`;

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
      --ink: #1a1f2e; --muted: #64748b; --line: #cbd5e1; --line-soft: #e2e8f0;
      --brand: #1e3a8a; --brand-deep: #1e293b; --paper: #ffffff;
      --shadow-sm: 0 2px 8px rgba(30,41,59,0.08); --card-bg: rgba(255,255,255,0.96);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Poppins", Arial, sans-serif; color: var(--ink); background: #fff; margin: 0; padding: 0; }

    /* ── Wrapper (no ::before bar — pdf-lib draws it at page edge) ── */
    .ft-quotation-wrapper {
      position: relative; width: 100%; min-height: auto;
      background: var(--paper); padding: 0;
    }

    /* Watermark + top bar hidden in HTML — added by pdf-lib post-processing */
    .ft-watermark { display: none; }
    .ft-top-bar { display: none; }

    .ft-content { position: relative; z-index: 1; }

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
    .ft-terms-box, .ft-summary-box, .ft-notes-box, .ft-bank-box, .ft-branch-box { padding: 12px; }
    .ft-section-heading { margin-bottom: 8px; font-size: 13px; }
    .ft-terms-box ul { padding-left: 16px; }

    /* ── Summary table ── */
    .ft-summary-table {
      border-radius: 10px; overflow: hidden; border: 1px solid var(--line);
      box-shadow: var(--shadow-sm); table-layout: fixed; width: 100%;
    }
    .ft-summary-table td { padding: 9px 6px; font-size: 12px; }
    .ft-grand-total td { color: var(--brand); font-size: 14px; font-weight: 700; background: #f0f4ff; }

    /* ── Bank grid ── */
    .ft-bank-grid { display: grid; grid-template-columns: 88px minmax(0,1fr); gap: 7px 10px; }
    .ft-bank-grid div:nth-child(odd) { color: var(--muted); }

    /* ── Branches ── */
    .ft-branch-box { margin-top: 12px; }

    /* ── Footer ── */
    .ft-footer {
      display: flex; flex-wrap: wrap; gap: 8px 20px;
      justify-content: flex-end; align-items: center;
      margin-top: 12px; padding: 10px 12px;
    }
    .ft-footer span { color: var(--brand); font-weight: 600; }

    /* ── Page break controls ── */
    tr, .ft-terms-box, .ft-summary-box, .ft-notes-box,
    .ft-bank-box, .ft-branch-box { page-break-inside: avoid; }

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
                  <div class="ft-contact-line"><span class="label">Ph:</span><span>0422-2569966, 4376555</span></div>
                  <div class="ft-contact-line"><span class="label">Email:</span><span>info@achmecommunication.com</span></div>
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
                  ${h.mobile_number ? `<div class="ft-contact-line"><span class="label">Ph:</span><span>${esc(h.mobile_number)}</span></div>` : ""}
                  ${h.email ? `<div class="ft-contact-line"><span class="label">Email:</span><span>${esc(h.email)}</span></div>` : ""}
                </div>
              </section>

              <!-- ITEMS TABLE -->
              <div class="ft-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width:32px;">S.NO</th>
                      ${hasBrandModel ? "<th>BRAND / MODEL</th>" : ""}
                      <th>DESCRIPTION</th>
                      ${hasHSN ? "<th>HSN/SAC</th>" : ""}
                      <th style="width:40px;">QTY</th>
                      <th style="width:50px;">UOM</th>
                      ${hasGST ? '<th style="width:48px;">GST%</th>' : ""}
                      <th style="width:80px;text-align:right;">PRICE</th>
                      <th style="width:90px;text-align:right;">TOTAL</th>
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

              <!-- BRANCHES -->
              ${branchesHtml}

              <!-- FOOTER -->
              ${(execName || execPhone || execEmail) ? `
              <footer class="ft-footer">
                ${execName ? `<div><span>Executive:</span> ${execName}</div>` : ""}
                ${execPhone ? `<div><span>PH:</span> ${execPhone}</div>` : ""}
                ${execEmail ? `<div><span>Email:</span> ${execEmail}</div>` : ""}
              </footer>` : ""}

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
    const basePdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "8mm", bottom: "12mm", left: "8mm", right: "8mm" },
    });

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

    for (const pdfPage of pages) {
      const { width, height } = pdfPage.getSize();

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
    }

    const finalPdf = await pdfDoc.save();
    return Buffer.from(finalPdf);
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePdf };
