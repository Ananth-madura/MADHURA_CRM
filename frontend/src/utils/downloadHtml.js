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

  let taxRate = 18;
  if (h.custom_tax) taxRate = Number(h.custom_tax);
  else if (h.tax_type === "GST5") taxRate = 5;
  else if (h.tax_type === "NONE" || h.tax_type === "Without GST") taxRate = 0;

  const subtotal = data.reduce((sum, r) => sum + (Number(r.quantity || 0) * Number(r.price || 0)), 0);
  const totalDiscount = Number(h.total_discount || 0);
  const totalCGST = Number(h.total_cgst || 0);
  const totalSGST = Number(h.total_sgst || 0);
  const totalIGST = Number(h.total_igst || 0);
  const grandTotal = Number(h.grand_total || 0) || (subtotal - totalDiscount + totalCGST + totalSGST + totalIGST);
  const hasGST = taxRate > 0;
  const hasHSN = data.some((r) => r.hsn_sac);

  const branchData = {
    "Coimbatore": { address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX" },
    "Bangalore": { address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM" },
    "Chennai": { address: "5th Floor, 5CD PM Towers, Dreams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX" },
  };
  const bd = branchData[h.supplier_branch] || branchData["Coimbatore"];
  const fromAddress = (h.resolved_from_address || h.from_address_custom || bd.address).replace(/\n/g, ", ");
  const fromGstin = h.from_gstin || bd.gstin;

  const bank = {
    company: h.bank_company || "ACHME COMMUNICATION",
    bank: h.bank_name || "HDFC BANK",
    account: h.bank_account || "00312320005822",
    ifsc: h.bank_ifsc || "HDFC0000031",
    branch: h.bank_branch || "Coimbatore",
  };

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${h.client_pincode}` : "";

  const terms = [];
  if (h.terms_general) terms.push("General Terms & Conditions apply.");
  if (h.terms_tax) terms.push("Prices quoted are exclusive of Sales and Service Tax.");
  if (h.terms_project_period) terms.push(`Project Period: ${h.terms_project_period}`);
  if (h.terms_validity) terms.push(`Quote valid for ${h.terms_validity} from quotation date.`);
  if (h.terms_payment) terms.push(`Payment Terms: ${h.terms_payment === "Custom" ? h.terms_payment_custom : h.terms_payment}`);
  if (h.terms_warranty) terms.push(`Warranty: ${h.terms_warranty}`);
  if (h.custom_terms) terms.push(h.custom_terms);

  const itemRows = data.map((r, i) => {
    const qty = Number(r.quantity || 0);
    const price = Number(r.price || 0);
    const lineTotal = qty * price;
    return `<tr>
      <td data-label="S.NO">${i + 1}</td>
      <td data-label="DESCRIPTION"><strong>${r.description || "---"}</strong></td>
      <td data-label="BRAND / MODEL">${r.brand_model || "---"}</td>
      ${hasHSN ? `<td data-label="HSN/SAC">${r.hsn_sac || "---"}</td>` : ""}
      <td data-label="QTY">${qty}</td>
      <td data-label="UOM">${r.uom || "Nos"}</td>
      ${hasGST ? `<td data-label="GST%">${r.tax || taxRate}%</td>` : ""}
      <td data-label="PRICE">${fmtNum(price)}</td>
      <td data-label="TOTAL"><strong>${fmtNum(lineTotal)}</strong></td>
    </tr>`;
  }).join("");

  const summaryRows = `
    <tr><td style="width:50%;padding:10px 8px;font-size:12px;color:#64748b;">Subtotal</td><td style="width:50%;padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td style="width:50%;padding:10px 8px;font-size:12px;color:#64748b;">Discount</td><td style="width:50%;padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${totalCGST > 0 ? `<tr><td style="width:50%;padding:10px 8px;font-size:12px;color:#64748b;">CGST (${taxRate / 2}%)</td><td style="width:50%;padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalCGST)}</td></tr>` : ""}
    ${totalSGST > 0 ? `<tr><td style="width:50%;padding:10px 8px;font-size:12px;color:#64748b;">SGST (${taxRate / 2}%)</td><td style="width:50%;padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalSGST)}</td></tr>` : ""}
    ${totalIGST > 0 ? `<tr><td style="width:50%;padding:10px 8px;font-size:12px;color:#64748b;">IGST (${taxRate}%)</td><td style="width:50%;padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalIGST)}</td></tr>` : ""}
    <tr class="grand-total"><td style="width:50%;padding:10px 8px;font-size:14px;color:#1e3a8a;font-weight:700;background:#f0f4ff;">GRAND TOTAL</td><td style="width:50%;padding:10px 8px;font-size:14px;color:#1e3a8a;text-align:right;font-weight:700;background:#f0f4ff;">${fmtNum(grandTotal)}</td></tr>`;

  const otherBranchEntries = Object.entries(branchData).filter(([key]) => key !== h.supplier_branch);
  const otherBranchesHtml = otherBranchEntries.length > 0
    ? `<div class="brb"><div class="sh">OUR BRANCHES</div>${otherBranchEntries.map(([name, v], i) => `<strong>${name}:</strong> ${v.address} | <strong>GSTIN:</strong> ${v.gstin}${i < otherBranchEntries.length - 1 ? "<br>" : ""}`).join("")}</div>`
    : "";

  const termsHtml = terms.length > 0 ? `<div class="trm"><div class="sh">TERMS & CONDITIONS</div><ul>${terms.map((t) => `<li>${t}</li>`).join("")}</ul></div>` : `<div></div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${config.label} - ${docNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root{--ink:#1a1f2e;--muted:#64748b;--line:#cbd5e1;--line-soft:#e2e8f0;--brand:#1e3a8a;--brand-deep:#1e293b;--paper:#fff;--page-bg:#f1f5f9;--shadow-sm:0 2px 8px rgba(30,41,59,.08);--card-bg:rgba(255,255,255,.96)}
    *{box-sizing:border-box;margin:0;padding:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{min-height:100vh;background:var(--page-bg);color:var(--ink);font-family:"Poppins",sans-serif;padding:clamp(10px,3vw,30px)}
    .qw{position:relative;width:min(100%,210mm);min-height:297mm;margin:0 auto;overflow:hidden;background:var(--paper);border:1px solid var(--line);box-shadow:0 16px 48px rgba(30,41,59,.14);padding:0;}
    .ct{position:relative;z-index:1;}
    .hdr{position:relative;display:grid;grid-template-columns:minmax(210px,1fr) auto;gap:18px;align-items:start;padding: clamp(14px,3vw,9mm) clamp(14px,3vw,9mm) 12px;border-bottom:3px solid var(--brand);background:#fff;}
    .hdr::before{content:"";position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(to right,#1f0779e0,#340285,#1b03a1);z-index:10;}
    .qt{display:grid;justify-items:end;gap:10px;text-align:right}
    .qt h2{color:var(--brand);font-size:clamp(10px,2.4vw,22px);font-weight:500;line-height:.98}
    .db{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:flex-end;border:1px solid var(--line);border-radius:8px;padding:10px 12px;background:#f8fafc;color:var(--muted);font-size:12px}
    .db span{color:var(--ink);font-weight:600}.tb{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:0px;grid-auto-rows:minmax(176px,auto);align-items:stretch;}
    .ib,.trm,.sb,.nb,.bb,.brb,.ft{background:var(--card-bg);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-sm)}
    .ib{padding:12px;text-align:left;align-self:stretch;}.bt,.sh{color:var(--brand);font-weight:700}.bt{margin-bottom:8px;font-size:13px}
    .ib h3{margin-bottom:3px;font-size:15px;line-height:1.25;font-weight:700}
    .gst{margin-bottom:9px;color:var(--muted);font-size:11px;font-weight:600}
    .cp,.cl,.trm li,.nb,.bg,.brb,.ft{font-size:11.5px;line-height:1.55}
    .cl{display:flex;gap:7px;align-items:baseline;margin-top:7px;word-break:break-word}.cl .label{min-width:40px;color:var(--brand-deep);font-weight:600}
    .tw{width:100%;margin-top:14px;border:1px solid var(--line);border-radius:10px;background:var(--paper);box-shadow:var(--shadow-sm)}
    .tw table{width:100%;border-collapse:collapse}.tw th{padding:10px 8px;border-bottom:2px solid var(--brand);color:var(--brand-deep);font-size:10.5px;font-weight:700;text-align:left;white-space:nowrap;background:#f8fafc}
    .tw td{padding:10px 8px;border-bottom:1px solid var(--line-soft);font-size:11px;vertical-align:top;color:var(--ink)}
    .tw tbody tr:last-child td,.st tr:last-child td{border-bottom:0}
    .st{border-radius:10px;overflow:hidden;border:1px solid var(--line);box-shadow:var(--shadow-sm);table-layout:fixed}.st td{padding:9px 6px;font-size:12px}
    .gt td{color:var(--brand);font-size:14px;font-weight:700;background:#f0f4ff}
    .tw td:last-child,.tw th:last-child,.st td:last-child{text-align:right}
    .ms{display:block;margin-top:12px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .trm,.sb,.nb,.bb,.brb{padding:12px}.sh{margin-bottom:8px;font-size:13px}.trm ul{padding-left:16px}
    .bg{display:grid;grid-template-columns:88px minmax(0,1fr);gap:7px 10px}.bg div:nth-child(odd){color:var(--muted)}
    .brb{margin-top:12px}.ft{display:flex;flex-wrap:wrap;gap:8px 20px;justify-content:flex-end;align-items:center;margin-top:12px;padding:10px 12px}
    .ft span{color:var(--brand);font-weight:600}
    
    .wm{position:fixed;top:50%;left:50%;max-width:55%;max-height:55%;width:auto;height:auto;display:block;transform:translate(-50%,-50%);opacity:.07;pointer-events:none;z-index:0;object-fit:contain;}
    .ct-td { padding: 14px clamp(14px,3vw,9mm) clamp(14px,3vw,9mm) clamp(14px,3vw,9mm); }
    
    @media print{
      @page{size:A4;margin:0;}
      body{min-height:auto;background:#fff;padding:0;}
      .qw{width:100%;min-height:auto;border:0;box-shadow:none;padding:0;overflow:visible;}
      .hdr{padding: 8mm 12mm 8px 12mm; background:#fff;}
      .ct-td { padding: 4mm 12mm 12mm 12mm; }
      /* position:fixed repeats the watermark at the exact same spot on every printed page */
      .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);max-width:130mm;max-height:130mm;width:auto;height:auto;opacity:.12;z-index:-1;pointer-events:none;}
      thead{display:table-header-group;}
      tr, .trm, .sb, .nb, .bb, .brb { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <img class="wm" src="${logoImg}" alt="watermark" />
  <main class="qw">
    <div class="ct">
      <table style="width:100%;border-collapse:collapse;border:none;">
        <thead>
          <tr>
            <td style="padding:0;border:none;">
              <header class="hdr">
                <div class="brand">
                  <img src="${brandLogo}" alt="Achme Communication" style="display:block;width:min(100%,330px);height:auto;" />
                </div>
                <div class="qt"><h2>${config.label}</h2><div class="db"><div><span>Doc No:</span> ${docNumber}</div><div><span>Date:</span> ${fmtDate(docDate)}</div></div></div>
              </header>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="ct-td" style="border:none;">
              <section class="tb">
                <div class="ib"><div class="bt">FROM</div><h3>Achme Communication</h3><div class="gst">GSTIN: ${fromGstin}</div><div class="cp">${fromAddress}</div><div class="cl"><span class="label">Ph:</span><span>0422-2569966, 4376555</span></div><div class="cl"><span class="label">Email:</span><span>info@achmecommunication.com</span></div><div class="cl"><span class="label">Web:</span><span>www.achmecommunication.com</span></div></div>
                <div class="ib">
                  <div class="bt">BILLED TO</div>
                  ${(() => {
                    const clientCompany = (h.client_company || "").trim();
                    return `<h3>${clientCompany || h.customer_name || "---"}</h3>
                    ${clientCompany ? `<div class="cp" style="font-size:11px;color:#64748b;margin-bottom:4px;">${h.customer_name}</div>` : ""}`;
                  })()}
                  ${h.mobile_number ? `<div class="cl"><span class="label">Ph:</span><span>${h.mobile_number}</span></div>` : ""}
                  ${h.email ? `<div class="cl"><span class="label">Email:</span><span>${h.email}</span></div>` : ""}
                  ${h.gst_number ? `<div class="cl"><span class="label">GST:</span><span>${h.gst_number}</span></div>` : ""}
                  ${(clientAddr || h.client_pincode) ? `<div class="cp" style="margin-top:10px;">${clientAddr}${clientPin}</div>` : ""}
                </div>
              </section>
              <div class="tw"><table><thead><tr><th>S.NO</th><th>DESCRIPTION</th><th>BRAND / MODEL</th>${hasHSN ? "<th>HSN/SAC</th>" : ""}<th>QTY</th><th>UOM</th>${hasGST ? "<th>GST%</th>" : ""}<th>PRICE</th><th>TOTAL</th></tr></thead><tbody>${itemRows}</tbody></table></div>
              <section class="ms"><div class="g2">${termsHtml}<div class="sb"><table class="st">${summaryRows}</table></div><div class="nb"><div class="sh">IMPORTANT NOTES</div><strong>Materials:</strong> BOQ based on discussion. Extra materials required at execution charged extra. CABLE & ACCESSORIES AS PER ACTUALS.<br><br><strong>Delay:</strong> Delays due to external dependencies at site - Achme Communication will not be responsible.<br><br><strong>NOTE:</strong> Civil, Electrical & Interior Works not included.</div><div class="bb"><div class="sh">BANK DETAILS</div><div class="bg"><div>Company</div><div><strong>${bank.company}</strong></div><div>Bank</div><div><strong>${bank.bank}</strong></div><div>Account</div><div><strong>${bank.account}</strong></div><div>IFSC</div><div><strong>${bank.ifsc}</strong></div><div>Branch</div><div><strong>${bank.branch}</strong></div></div></div></div></section>
              ${otherBranchesHtml}
              <footer class="ft"><div><span>Executive:</span> ${h.exec_name || "kumar"}</div><div><span>PH:</span> ${h.exec_phone || "12345678"}</div>${h.exec_email ? `<div><span>Email:</span> ${h.exec_email}</div>` : ""}</footer>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${config.label}_${docNumber}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
