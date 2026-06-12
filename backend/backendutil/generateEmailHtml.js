"use strict";

function esc(v) {
  if (v == null) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtNum(n) {
  return `Rs. ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "---";
}

const BRANCHES = {
  Bangalore: { name: "Bangalore", address: "14th Main Road, GK Layout, Electronic City Post, Bangalore - 560100", gstin: "29AAHFA7876M1ZM" },
  Chennai: { name: "Chennai", address: "5th Floor, 5CD PM Towers, Dreams Road, Thousand Lights, Chennai - 600006", gstin: "33AAHFA7876M1ZX" },
};

function generateEmailHtml({ invoice, items, type, docNumber, docLabel, companyName, companyEmail, companyPhone, companyWebsite, companyGstin, companyAddress }) {
  const h = invoice;
  const taxRate = h.custom_tax ? Number(h.custom_tax) : h.tax_type === "GST5" ? 5 : h.tax_type === "NONE" || h.tax_type === "Without GST" ? 0 : 18;
  const hasGST = taxRate > 0;
  const hasHSN = (items || []).some((i) => i.hsn_sac);

  const subtotal = Number(h.subtotal || 0);
  const totalDiscount = Number(h.total_discount || 0);
  const totalCGST = Number(h.total_cgst || 0);
  const totalSGST = Number(h.total_sgst || 0);
  const totalIGST = Number(h.total_igst || 0);
  const grandTotal = Number(h.grand_total || 0) || (subtotal - totalDiscount + totalCGST + totalSGST + totalIGST);

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${esc(h.client_pincode)}` : "";
  const clientCountry = h.client_country && h.client_country !== "India" ? `, ${esc(h.client_country)}` : "";

  const itemRows = (items || []).map((item, i) => {
    const desc = item.description || "";
    const commaIdx = desc.indexOf(",");
    const productName = commaIdx > -1 ? desc.slice(0, commaIdx).trim() : desc;
    const specDetails = commaIdx > -1 ? desc.slice(commaIdx + 1).trim() : "";
    const qty = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    const lineTotal = qty * price;
    return `<tr>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;font-family:Arial,sans-serif;">${i + 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;font-family:Arial,sans-serif;">
        <strong>${esc(productName)}</strong>
        ${specDetails ? `<div style="font-size:10px;color:#64748b;margin-top:2px;">${esc(specDetails)}</div>` : ""}
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;font-family:Arial,sans-serif;">${esc(item.brand_model || "---")}</td>
      ${hasHSN ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;font-family:Arial,sans-serif;">${esc(item.hsn_sac || "---")}</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:center;font-family:Arial,sans-serif;">${qty}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;font-family:Arial,sans-serif;">${esc(item.uom || "Nos")}</td>
      ${hasGST ? `<td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;font-family:Arial,sans-serif;">${item.tax || taxRate}%</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#444;vertical-align:top;text-align:right;font-family:Arial,sans-serif;">${fmtNum(price)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:right;font-family:Arial,sans-serif;"><strong>${fmtNum(lineTotal)}</strong></td>
    </tr>`;
  }).join("");

  const summaryRows = `
    <tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;font-family:Arial,sans-serif;">Subtotal</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;font-family:Arial,sans-serif;">${fmtNum(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;font-family:Arial,sans-serif;">Discount</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;font-family:Arial,sans-serif;">${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${totalCGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;font-family:Arial,sans-serif;">CGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;font-family:Arial,sans-serif;">${fmtNum(totalCGST)}</td></tr>` : ""}
    ${totalSGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;font-family:Arial,sans-serif;">SGST (${taxRate / 2}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;font-family:Arial,sans-serif;">${fmtNum(totalSGST)}</td></tr>` : ""}
    ${totalIGST > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;font-family:Arial,sans-serif;">IGST (${taxRate}%)</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;font-family:Arial,sans-serif;">${fmtNum(totalIGST)}</td></tr>` : ""}
    <tr><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;font-weight:700;background:#f0f4ff;width:50%;font-family:Arial,sans-serif;">GRAND TOTAL</td><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;text-align:right;font-weight:700;background:#f0f4ff;width:50%;font-family:Arial,sans-serif;">${fmtNum(grandTotal)}</td></tr>`;

  const bank = {
    company: esc(h.bank_company || "ACHME COMMUNICATION"),
    bank: esc(h.bank_name || "HDFC BANK"),
    account: esc(h.bank_account || "00312320005822"),
    ifsc: esc(h.bank_ifsc || "HDFC0000031"),
    branch: esc(h.bank_branch || "Coimbatore"),
  };

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

  const termsHtml = terms.length > 0 ? `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;background-color:#ffffff;">
      <tr>
        <td style="padding:12px;">
          <div style="color:#1e3a8a;font-weight:bold;font-size:13px;margin-bottom:8px;font-family:Arial,sans-serif;">TERMS &amp; CONDITIONS</div>
          <ul style="padding-left:18px;margin:0;font-size:12px;line-height:1.55;color:#1a1f2e;font-family:Arial,sans-serif;">
            ${terms.map((t) => `<li style="margin-bottom:4px;">${t}</li>`).join("")}
          </ul>
        </td>
      </tr>
    </table>
    <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>` : "";

  const otherBranches = Object.entries(BRANCHES)
    .filter(([key]) => key !== h.supplier_branch)
    .map(([, v]) => v);

  const branchesHtml = otherBranches.length > 0 ? `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;background-color:#ffffff;">
      <tr>
        <td style="padding:12px;">
          <div style="color:#1e3a8a;font-weight:bold;font-size:13px;margin-bottom:8px;font-family:Arial,sans-serif;">OUR BRANCHES</div>
          <div style="font-size:12px;line-height:1.55;color:#1a1f2e;font-family:Arial,sans-serif;">
            ${otherBranches.map((b) => `<div style="margin-bottom:4px;"><strong>${esc(b.name)}:</strong> ${esc(b.address)} | <strong>GSTIN:</strong> ${esc(b.gstin)}</div>`).join("")}
          </div>
        </td>
      </tr>
    </table>
    <div style="height:14px;line-height:14px;font-size:14px;">&nbsp;</div>` : "";

  const execName = esc(h.exec_name || "KRISHNA KUMAR M");
  const execPhone = esc(h.exec_phone || "9842235515");
  const execEmail = h.exec_email ? esc(h.exec_email) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(docLabel)} - ${esc(docNumber)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;padding:20px 10px;">
    <tr>
      <td align="center" style="padding:0;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;background-color:#ffffff;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;box-shadow:0 16px 48px rgba(30,41,59,0.1);border-collapse:collapse;">
          <!-- Top gradient bar -->
          <tr>
            <td style="padding:0;height:6px;background:linear-gradient(to right,#1f0779,#340285,#1b03a1);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:20px;border-bottom:3px solid #1e3a8a;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td valign="top" style="text-align:left;font-family:Arial,sans-serif;">
                    <h1 style="color:#1e3a8a;font-size:20px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${esc(companyName || "Achme Communication")}</h1>
                    <div style="color:#64748b;font-size:11px;font-weight:bold;margin-top:2px;font-family:Arial,sans-serif;">GSTIN: ${esc(companyGstin || "33AAHFA7876M1ZX")}</div>
                    <div style="color:#1a1f2e;font-size:12px;line-height:1.5;margin-top:6px;font-family:Arial,sans-serif;">${esc(companyAddress || "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004")}</div>
                    <div style="color:#1a1f2e;font-size:12px;margin-top:4px;font-family:Arial,sans-serif;">Ph: ${esc(companyPhone || "0422-2569966, 4376555")} | Email: ${esc(companyEmail || "info@achmecommunication.com")}</div>
                  </td>
                  <td valign="top" align="right" style="text-align:right;width:220px;font-family:Arial,sans-serif;">
                    <h2 style="color:#1e3a8a;font-size:18px;font-weight:bold;margin:0;font-family:Arial,sans-serif;">${esc(docLabel)}</h2>
                    <table align="right" border="0" cellpadding="0" cellspacing="0" style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;background-color:#f8fafc;color:#64748b;font-size:12px;margin-top:8px;text-align:left;">
                      <tr>
                        <td style="padding:2px 0;font-family:Arial,sans-serif;"><span style="color:#1a1f2e;font-weight:bold;">Doc No:</span> ${esc(docNumber)}</td>
                      </tr>
                      <tr>
                        <td style="padding:2px 0;font-family:Arial,sans-serif;"><span style="color:#1a1f2e;font-weight:bold;">Date:</span> ${fmtDate(h.invoice_date || h.quotation_date || h.estimate_date)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Billed To -->
          <tr>
            <td style="padding:20px;border-bottom:1px solid #e2e8f0;font-family:Arial,sans-serif;">
              <div style="color:#1e3a8a;font-weight:bold;font-size:13px;margin-bottom:8px;letter-spacing:0.5px;">BILLED TO</div>
              ${(() => {
                const clientCompany = (h.client_company || "").trim();
                return `<div style="font-size:15px;font-weight:bold;color:#2c2c2c;margin-bottom:4px;">${esc(clientCompany || h.customer_name || "---")}</div>
                ${clientCompany ? `<div style="font-size:12px;color:#64748b;margin-bottom:4px;">${esc(h.customer_name)}</div>` : ""}`;
              })()}
              ${h.mobile_number ? `<div style="font-size:12px;color:#1a1f2e;margin-top:4px;">Ph: ${esc(h.mobile_number)}</div>` : ""}
              ${h.email ? `<div style="font-size:12px;color:#1a1f2e;">Email: ${esc(h.email)}</div>` : ""}
              ${h.gst_number ? `<div style="font-size:12px;color:#1a1f2e;">GSTIN: ${esc(h.gst_number)}</div>` : ""}
              ${(clientAddr || h.client_pincode) ? `<div style="font-size:12px;color:#1a1f2e;margin-top:4px;line-height:1.4;">${esc(clientAddr)}${clientPin}${clientCountry}</div>` : ""}
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding:20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <thead>
                  <tr style="background-color:#f8fafc;">
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:left;font-family:Arial,sans-serif;">S.NO</th>
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:left;font-family:Arial,sans-serif;">DESCRIPTION</th>
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:left;font-family:Arial,sans-serif;">BRAND / MODEL</th>
                    ${hasHSN ? '<th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:left;font-family:Arial,sans-serif;">HSN/SAC</th>' : ""}
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:center;font-family:Arial,sans-serif;">QTY</th>
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;font-family:Arial,sans-serif;">UOM</th>
                    ${hasGST ? '<th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:right;font-family:Arial,sans-serif;">GST%</th>' : ""}
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:right;font-family:Arial,sans-serif;">PRICE</th>
                    <th style="padding:10px 8px;border-bottom:2px solid #1e3a8a;color:#1e293b;font-size:11px;font-weight:bold;text-align:right;font-family:Arial,sans-serif;">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>

              <!-- Summary Table -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:15px;">
                <tr>
                  <td align="right">
                    <table border="0" cellpadding="0" cellspacing="0" style="min-width:280px;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden;border-collapse:separate;background-color:#ffffff;">
                      <tbody>
                        ${summaryRows}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Terms & Branches -->
          <tr>
            <td style="padding:0 20px 20px;">
              ${termsHtml}
              ${branchesHtml}
            </td>
          </tr>

          <!-- Bank Details -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;background-color:#ffffff;">
                <tr>
                  <td style="padding:14px;">
                    <div style="color:#1e3a8a;font-weight:bold;font-size:13px;margin-bottom:8px;font-family:Arial,sans-serif;">BANK DETAILS</div>
                    <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size:12px;line-height:1.5;font-family:Arial,sans-serif;">
                      <tr>
                        <td style="color:#64748b;width:100px;font-family:Arial,sans-serif;">Company</td>
                        <td style="font-weight:bold;font-family:Arial,sans-serif;">${bank.company}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-family:Arial,sans-serif;">Bank</td>
                        <td style="font-weight:bold;font-family:Arial,sans-serif;">${bank.bank}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-family:Arial,sans-serif;">Account No</td>
                        <td style="font-weight:bold;font-family:Arial,sans-serif;">${bank.account}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-family:Arial,sans-serif;">IFSC Code</td>
                        <td style="font-weight:bold;font-family:Arial,sans-serif;">${bank.ifsc}</td>
                      </tr>
                      <tr>
                        <td style="color:#64748b;font-family:Arial,sans-serif;">Branch</td>
                        <td style="font-weight:bold;font-family:Arial,sans-serif;">${bank.branch}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:15px 20px;border-top:1px solid #e2e8f0;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:12px;color:#1a1f2e;font-family:Arial,sans-serif;">
                <tr>
                  <td align="left" style="font-family:Arial,sans-serif;">
                    <span style="color:#1e3a8a;font-weight:bold;">Executive:</span> ${execName}
                  </td>
                  <td align="right" style="font-family:Arial,sans-serif;">
                    <span style="color:#1e3a8a;font-weight:bold;">PH:</span> ${execPhone}
                    ${execEmail ? ` | <span style="color:#1e3a8a;font-weight:bold;">Email:</span> ${execEmail}` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { generateEmailHtml };
