import logoImg from "../images/achme2logo-high.jpeg";
import brandLogo from "../images/achme-logo-high.jpeg";

export function downloadAsHtml(data, type) {
  const TYPE_MAP = {
    quotation: { label: "QUOTATION", prefix: "QT" },
    proforma: { label: "PROFORMA INVOICE", prefix: "PI" },
    estimation: { label: "ESTIMATION", prefix: "EI" },
    service: { label: "SERVICE ESTIMATION", prefix: "SE" },
  };
  const config = TYPE_MAP[type] || TYPE_MAP.quotation;
  const h = data[0] || {};
  const docId = h.quotation_id || h.invoice_id || h.id;
  const docDate = h.invoice_date || h.quotation_date || h.estimate_date;
  const docNumber = `${config.prefix}-${new Date(docDate).getFullYear()}-${String(docId).padStart(3, "0")}`;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "---";
  const fmtNum = (n) => `Rs. ${(Number(n || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = (v) => v == null ? "" : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let taxRate = 18;
  if (h.custom_tax) taxRate = Number(h.custom_tax);
  else if (h.tax_type === "GST5") taxRate = 5;
  else if (h.tax_type === "NONE" || h.tax_type === "Without GST") taxRate = 0;

  const subtotal = Number(h.subtotal || 0) || data.reduce((sum, r) => sum + (Number(r.quantity || 0) * Number(r.price || 0)), 0);
  const totalDiscount = Number(h.total_discount || 0);
  const totalCGST = Number(h.total_cgst || 0);
  const totalSGST = Number(h.total_sgst || 0);
  const totalIGST = Number(h.total_igst || 0);
  const grandTotal = Number(h.grand_total || 0) || (subtotal - totalDiscount + totalCGST + totalSGST + totalIGST);
  const hasGST = taxRate > 0;
  const hasHSN = data.some((r) => r.hsn_sac);
  const hasBrandModel = data.some((r) => r.brand_model && String(r.brand_model).trim() !== "");

  const branchData = {
    "Coimbatore": { address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX" },
    "Bangalore": { address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM" },
    "Chennai": { address: "5th Floor, 5CD PM Towers, Dreams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX" },
  };
  const bd = branchData[h.supplier_branch] || branchData["Coimbatore"];
  const fromAddress = esc((h.resolved_from_address || h.from_address_custom || bd.address).replace(/\n/g, ", "));
  const fromGstin = esc(h.from_gstin || bd.gstin);

  const bank = {
    company: esc(h.bank_company || "ACHME COMMUNICATION"),
    bank: esc(h.bank_name || "HDFC BANK"),
    account: esc(h.bank_account || "00312320005822"),
    ifsc: esc(h.bank_ifsc || "HDFC0000031"),
    branch: esc(h.bank_branch || "Coimbatore"),
  };

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${h.client_pincode}` : "";

  const terms = [];
  if (h.terms_general) terms.push("General Terms &amp; Conditions apply.");
  if (h.terms_tax) terms.push("Prices quoted are exclusive of Sales and Service Tax.");
  if (h.terms_project_period) terms.push(`Project Period: ${esc(h.terms_project_period)}`);
  if (h.terms_validity) terms.push(`Quote valid for ${esc(h.terms_validity)} from quotation date.`);
  if (h.terms_payment) terms.push(`Payment Terms: ${esc(h.terms_payment === "Custom" ? h.terms_payment_custom : h.terms_payment)}`);
  if (h.terms_warranty) terms.push(`Warranty: ${esc(h.terms_warranty)}`);
  if (h.custom_terms) terms.push(esc(h.custom_terms));

  // Item rows — description: bold part before comma, sub-text after
  const itemRows = data.map((r, i) => {
    const qty = Number(r.quantity || 0);
    const price = Number(r.price || 0);
    const lineTotal = qty * price;
    const desc = r.description || "---";
    const commaIdx = desc.indexOf(",");
    let descHtml = "";
    if (commaIdx !== -1) {
      const head = esc(desc.substring(0, commaIdx + 1));
      const body = esc(desc.substring(commaIdx + 1).trim());
      descHtml = `<div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-weight:700;color:#1e293b;font-size:11px;">${head}</span>
        <span style="font-weight:400;color:#64748b;font-size:10px;">${body}</span>
      </div>`;
    } else {
      descHtml = `<strong style="font-size:11px;">${esc(desc)}</strong>`;
    }

    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;">${i + 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;">${descHtml}</td>
      ${hasBrandModel ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;">${esc(r.brand_model || "---")}</td>` : ""}
      ${hasHSN ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;">${esc(r.hsn_sac || "---")}</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:center;">${qty}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;">${esc(r.uom || "Nos")}</td>
      ${hasGST ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;">${r.tax || taxRate}%</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;">${fmtNum(price)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;font-weight:700;vertical-align:top;text-align:right;">${fmtNum(lineTotal)}</td>
    </tr>`;
  }).join("");

  const summaryRows = `
    <tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">Subtotal</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">${fmtNum(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">Discount</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${totalCGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">CGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalCGST)}</td></tr>` : ""}
    ${totalSGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">SGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalSGST)}</td></tr>` : ""}
    ${totalIGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">IGST (${taxRate}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalIGST)}</td></tr>` : ""}
    <tr><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;font-weight:700;background:#f0f4ff;">GRAND TOTAL</td><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;text-align:right;font-weight:700;background:#f0f4ff;">${fmtNum(grandTotal)}</td></tr>`;

  const otherBranches = Object.entries(branchData).filter(([key]) => key !== (h.supplier_branch || "Coimbatore"));
  const branchesHtml = otherBranches.length > 0
    ? `<div style="background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin-top:14px;box-shadow:0 2px 8px rgba(30,41,59,0.08);">
        <div style="color:#1e3a8a;font-weight:700;font-size:13px;margin-bottom:8px;">OUR BRANCHES</div>
        <div style="font-size:11.5px;line-height:1.6;color:#1a1f2e;">
          ${otherBranches.map(([name, v]) => `<div style="margin-bottom:4px;"><strong>${esc(name)}:</strong> ${esc(v.address)} | <strong>GSTIN:</strong> ${esc(v.gstin)}</div>`).join("")}
        </div>
      </div>`
    : "";

  const execName = esc(h.exec_name || "");
  const execPhone = esc(h.exec_phone || "");
  const execEmail = h.exec_email ? esc(h.exec_email) : "";

  // Header HTML reused for both screen display and print repeat
  const headerHtml = `
  <div class="top-bar"></div>
  <div class="page-header">
    <div class="hdr">
      <div class="hdr-left">
        <img src="${brandLogo}" alt="Achme Communication" style="display:block;max-width:300px;height:auto;" />
      </div>
      <div class="hdr-right">
        <div class="qt-label">${config.label}</div>
        <div class="db">
          <span class="db-item"><span class="db-key">Doc No:</span> ${docNumber}</span>
          <span class="db-item"><span class="db-key">Date:</span> ${fmtDate(docDate)}</span>
        </div>
      </div>
    </div>
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${config.label} - ${docNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ─── Reset ─────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: "Poppins", Arial, sans-serif; color: #1a1f2e; background: #f1f5f9; }

    /* ─── Screen wrapper ─────────────────────────── */
    .page-wrap {
      width: 210mm;
      min-height: 297mm;
      margin: 20px auto;
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 16px 48px rgba(30,41,59,0.14);
      padding: 0;
      position: relative;
    }

    /* ─── Top gradient bar ──────────────────────── */
    .top-bar {
      height: 6px;
      background: linear-gradient(to right, #1f0779e0, #340285, #1b03a1);
      width: 100%;
    }

    /* ─── Watermark (screen) ────────────────────── */
    .wm-screen {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      max-width: 55%;
      opacity: 0.07;
      pointer-events: none;
      z-index: 0;
      object-fit: contain;
    }

    /* ─── Main content above watermark ─────────── */
    .content { position: relative; z-index: 1; padding: 0 12mm 12mm 12mm; }

    /* ─── Header ────────────────────────────────── */
    .page-header { padding: 0; }
    .hdr {
      display: table; width: 100%;
      border-bottom: 3px solid #1e3a8a;
      padding: 10mm 0 10px 0;
    }
    .hdr-left { display: table-cell; vertical-align: middle; width: 55%; }
    .hdr-right { display: table-cell; vertical-align: middle; width: 45%; text-align: right; }
    .qt-label { color: #1e3a8a; font-size: 22px; font-weight: 600; line-height: 1; margin-bottom: 10px; }
    .db {
      display: inline-block;
      border: 1px solid #cbd5e1; border-radius: 8px;
      padding: 8px 12px; background: #f8fafc;
      font-size: 12px; color: #64748b;
    }
    .db-item { display: inline-block; margin-right: 12px; }
    .db-item:last-child { margin-right: 0; }
    .db-key { color: #1a1f2e; font-weight: 600; }

    /* ─── FROM / BILLED TO – equal‑height table ── */
    .tb { display: table; width: 100%; margin-top: 14px; border-spacing: 12px 0; table-layout: fixed; }
    .tb-cell { display: table-cell; width: 50%; vertical-align: top; }
    .ib {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 14px; height: 100%;
      box-shadow: 0 2px 8px rgba(30,41,59,0.08);
    }
    .ib-label { color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 8px; }
    .ib h3 { font-size: 15px; font-weight: 700; color: #2c2c2c; margin-bottom: 3px; line-height: 1.25; }
    .gst-tag { color: #64748b; font-size: 11px; font-weight: 600; margin-bottom: 9px; }
    .cp { font-size: 11.5px; line-height: 1.55; color: #1a1f2e; }
    .cl { display: table; width: 100%; margin-top: 6px; font-size: 11.5px; line-height: 1.55; }
    .cl-lbl { display: table-cell; color: #1e293b; font-weight: 600; min-width: 44px; white-space: nowrap; }
    .cl-val { display: table-cell; color: #1a1f2e; word-break: break-word; }

    /* ─── Items table ────────────────────────────── */
    .tw {
      width: 100%; margin-top: 14px;
      border: 1px solid #cbd5e1; border-radius: 10px;
      background: #fff; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
      overflow: hidden;
    }
    .tw table { width: 100%; border-collapse: collapse; }
    .tw th {
      padding: 10px 8px; border-bottom: 2px solid #1e3a8a;
      color: #1e293b; font-size: 10.5px; font-weight: 700;
      text-align: left; white-space: nowrap; background: #f8fafc;
    }
    .tw th:last-child, .tw td:last-child { text-align: right; }
    .tw tbody tr:last-child td { border-bottom: none; }

    /* ─── Mid section 2×2 grid ─────────────────── */
    .ms { margin-top: 14px; }
    .g2 { display: table; width: 100%; border-spacing: 14px 0; table-layout: fixed; }
    .g2-cell { display: table-cell; width: 50%; vertical-align: top; }

    .box {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      padding: 14px; box-shadow: 0 2px 8px rgba(30,41,59,0.08); height: 100%;
    }
    .sh { color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 8px; }

    /* Summary table */
    .st-wrap {
      background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
      box-shadow: 0 2px 8px rgba(30,41,59,0.08); overflow: hidden; height: 100%;
    }
    .st { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .st td { padding: 10px 8px; font-size: 12px; }
    .st tr:last-child td { border-bottom: none; }

    /* Bank details grid */
    .bg { display: table; width: 100%; border-spacing: 0 4px; }
    .bg-row { display: table-row; }
    .bg-lbl { display: table-cell; color: #64748b; font-size: 11.5px; width: 88px; padding: 2px 0; }
    .bg-val { display: table-cell; font-weight: 700; font-size: 11.5px; color: #1a1f2e; padding: 2px 0; }

    /* Bottom row (Notes + Bank) */
    .ms-row2 { display: table; width: 100%; margin-top: 14px; border-spacing: 14px 0; table-layout: fixed; }
    .ms-row2-cell { display: table-cell; width: 50%; vertical-align: top; }

    /* Footer */
    .ft {
      display: table; width: 100%; margin-top: 14px;
      border: 1px solid #cbd5e1; border-radius: 10px;
      background: #fff; box-shadow: 0 2px 8px rgba(30,41,59,0.08);
      padding: 10px 14px;
    }
    .ft-inner { display: flex; flex-wrap: wrap; gap: 6px 20px; justify-content: flex-end; align-items: center; font-size: 11.5px; }
    .ft span { color: #1e3a8a; font-weight: 600; }

    /* ─── PRINT STYLES ─────────────────────────── */
    @media print {
      @page { size: A4 portrait; margin: 0; }

      body { background: #fff; }

      /* Hide screen wrapper, show full content */
      .page-wrap { width: 100%; min-height: auto; border: none; box-shadow: none; margin: 0; padding: 0; }

      /* Screen watermark hidden; fixed watermark used instead */
      .wm-screen { display: none; }

      /* Fixed watermark repeats on every printed page */
      .wm-print {
        display: block !important;
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        max-width: 130mm; width: auto; height: auto;
        opacity: 0.09; pointer-events: none; z-index: -1;
        object-fit: contain;
      }

      /* Fixed top gradient bar repeats on every page */
      .top-bar {
        position: fixed; top: 0; left: 0; right: 0;
        height: 6px; z-index: 100;
        background: linear-gradient(to right, #1f0779e0, #340285, #1b03a1);
      }

      /* Fixed header repeats on every page */
      .print-header-fixed {
        display: block !important;
        position: fixed; top: 6px; left: 0; right: 0;
        background: #fff; z-index: 99;
        padding: 6mm 9mm 6px 9mm;
        border-bottom: 3px solid #1e3a8a;
      }
      .print-header-fixed .hdr { border-bottom: none; padding: 0; }

      /* Hide the in-flow header on print (fixed one takes over) */
      .screen-header { display: none; }

      /* Content padding to clear fixed header (approx 38mm) */
      .content { padding: 38mm 9mm 12mm 9mm; }

      /* Page break controls */
      tr, .box, .st-wrap, .ms-row2, .g2 { page-break-inside: avoid; }

      thead { display: table-header-group; }
    }

    /* Hide print-only elements on screen */
    .wm-print { display: none; }
    .print-header-fixed { display: none; }
  </style>
</head>
<body>

  <!-- Fixed watermark (print only, repeats on every page) -->
  <img class="wm-print" src="${logoImg}" alt="" />

  <!-- Fixed header (print only, repeats on every page) -->
  <div class="print-header-fixed">
    <div class="top-bar"></div>
    <div class="hdr">
      <div class="hdr-left">
        <img src="${brandLogo}" alt="Achme Communication" style="display:block;max-width:280px;height:auto;" />
      </div>
      <div class="hdr-right">
        <div class="qt-label">${config.label}</div>
        <div class="db">
          <span class="db-item"><span class="db-key">Doc No:</span> ${docNumber}</span>
          <span class="db-item"><span class="db-key">Date:</span> ${fmtDate(docDate)}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="page-wrap">
    <!-- Watermark (screen display) -->
    <img class="wm-screen" src="${logoImg}" alt="" />

    <!-- Screen header (visible on screen, hidden on print) -->
    <div class="screen-header">
      <div class="top-bar"></div>
      <div class="content" style="padding-bottom:0;">
        <div class="hdr">
          <div class="hdr-left">
            <img src="${brandLogo}" alt="Achme Communication" style="display:block;max-width:300px;height:auto;" />
          </div>
          <div class="hdr-right">
            <div class="qt-label">${config.label}</div>
            <div class="db">
              <span class="db-item"><span class="db-key">Doc No:</span> ${docNumber}</span>
              <span class="db-item"><span class="db-key">Date:</span> ${fmtDate(docDate)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- All body content -->
    <div class="content">

      <!-- FROM / BILLED TO (equal height via display:table) -->
      <div class="tb">
        <div class="tb-cell">
          <div class="ib">
            <div class="ib-label">FROM</div>
            <h3>Achme Communication</h3>
            <div class="gst-tag">GSTIN: ${fromGstin}</div>
            <div class="cp">${fromAddress}</div>
            <div class="cl"><span class="cl-lbl">Ph:</span><span class="cl-val">0422-2569966, 4376555</span></div>
            <div class="cl"><span class="cl-lbl">Email:</span><span class="cl-val">info@achmecommunication.com</span></div>
            <div class="cl"><span class="cl-lbl">Web:</span><span class="cl-val">www.achmecommunication.com</span></div>
          </div>
        </div>
        <div class="tb-cell">
          <div class="ib">
            <div class="ib-label">BILLED TO</div>
            ${(() => {
              const clientCompany = (h.client_company || "").trim();
              const clientName = esc(clientCompany || h.customer_name || "---");
              return `<h3>${clientName}</h3>
              ${clientCompany ? `<div class="cp" style="font-size:11px;color:#64748b;margin-bottom:4px;">${esc(h.customer_name)}</div>` : ""}`;
            })()}
            ${h.gst_number ? `<div class="gst-tag">GSTIN: ${esc(h.gst_number)}</div>` : ""}
            ${(clientAddr || h.client_pincode) ? `<div class="cp" style="margin-top:4px;">${esc(clientAddr)}${esc(clientPin)}</div>` : ""}
            ${h.mobile_number ? `<div class="cl"><span class="cl-lbl">Ph:</span><span class="cl-val">${esc(h.mobile_number)}</span></div>` : ""}
            ${h.email ? `<div class="cl"><span class="cl-lbl">Email:</span><span class="cl-val">${esc(h.email)}</span></div>` : ""}
          </div>
        </div>
      </div>

      <!-- ITEMS TABLE -->
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th style="width:32px;">S.NO</th>
              <th>DESCRIPTION</th>
              ${hasBrandModel ? "<th>BRAND / MODEL</th>" : ""}
              ${hasHSN ? "<th>HSN/SAC</th>" : ""}
              <th style="width:40px;text-align:center;">QTY</th>
              <th style="width:50px;">UOM</th>
              ${hasGST ? '<th style="width:48px;text-align:right;">GST%</th>' : ""}
              <th style="width:88px;text-align:right;">PRICE</th>
              <th style="width:96px;text-align:right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>

      <!-- TERMS + SUMMARY (top row) -->
      <div class="ms">
        <div class="g2">
          <div class="g2-cell">
            <div class="box">
              <div class="sh">TERMS &amp; CONDITIONS</div>
              ${terms.length > 0
                ? `<ul style="padding-left:18px;margin:0;font-size:11.5px;line-height:1.65;color:#1a1f2e;">${terms.map(t => `<li style="margin-bottom:3px;">${t}</li>`).join("")}</ul>`
                : '<div style="font-size:11.5px;color:#94a3b8;">No terms specified</div>'
              }
            </div>
          </div>
          <div class="g2-cell">
            <div class="st-wrap">
              <table class="st">
                <tbody>${summaryRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- NOTES + BANK DETAILS (bottom row) -->
      <div class="ms-row2">
        <div class="ms-row2-cell">
          <div class="box">
            <div class="sh">IMPORTANT NOTES</div>
            <div style="font-size:11.5px;line-height:1.65;color:#1a1f2e;">
              <div style="margin-bottom:6px;"><strong>Materials:</strong> BOQ based on discussion. Extra materials required at execution charged extra. CABLE &amp; ACCESSORIES AS PER ACTUALS.</div>
              <div style="margin-bottom:6px;"><strong>Delay:</strong> Delays due to external dependencies at site - Achme Communication will not be responsible.</div>
              <div><strong>NOTE:</strong> Civil, Electrical &amp; Interior Works not included.</div>
            </div>
          </div>
        </div>
        <div class="ms-row2-cell">
          <div class="box">
            <div class="sh">BANK DETAILS</div>
            <div class="bg">
              <div class="bg-row"><div class="bg-lbl">Company</div><div class="bg-val">${bank.company}</div></div>
              <div class="bg-row"><div class="bg-lbl">Bank</div><div class="bg-val">${bank.bank}</div></div>
              <div class="bg-row"><div class="bg-lbl">Account</div><div class="bg-val">${bank.account}</div></div>
              <div class="bg-row"><div class="bg-lbl">IFSC</div><div class="bg-val">${bank.ifsc}</div></div>
              <div class="bg-row"><div class="bg-lbl">Branch</div><div class="bg-val">${bank.branch}</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- OUR BRANCHES -->
      ${branchesHtml}

      <!-- FOOTER -->
      <div class="ft">
        <div class="ft-inner">
          ${execName ? `<div><span>Executive:</span> ${execName}</div>` : ""}
          ${execPhone ? `<div><span>PH:</span> ${execPhone}</div>` : ""}
          ${execEmail ? `<div><span>Email:</span> ${execEmail}</div>` : ""}
        </div>
      </div>

    </div><!-- /content -->
  </div><!-- /page-wrap -->

  <script>
    // Auto-open print dialog so user just hits "Save as PDF"
    window.addEventListener("load", function() {
      setTimeout(function() { window.print(); }, 800);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Fallback: force download if popup blocked
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.label}_${docNumber}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
