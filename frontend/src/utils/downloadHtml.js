import logoImg from "../layout/Madhura-logo.png";
import brandLogo from "../layout/Madhura-logo.png";

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
  const hasDescription = data.some((r) => r.description && String(r.description).trim() !== "");

  const branchData = {
    "Coimbatore": { address: "Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004", gstin: "33AAHFA7876M1ZX", phone: "0422 4397555 , 2563666" },
    "Bangalore": { address: "14th Main Road, GK Layout, Electronic City Post, Bangalore-560100", gstin: "29AAHFA7876M1ZM", phone: "9842235515, 8012555718" },
    "Chennai": { address: "5th Floor, 5CD PM Towers, Greams Road, Thousand Lights, Chennai-600006", gstin: "33AAHFA7876M1ZX", phone: "8012555706, 8012555710" },
  };
  const bd = branchData[h.supplier_branch] || branchData["Coimbatore"];
  const fromPhoneRaw = bd.phone || "0422-2569966, 4376555";
  const fromPhone = fromPhoneRaw.split(",").map(p => `+91 ${p.trim()}`).join("  |  ");
  const fromAddress = esc((h.resolved_from_address || h.from_address_custom || bd.address).replace(/\n/g, ", "));
  const fromGstin = esc(h.from_gstin || bd.gstin);

  const bank = {
    company: esc(h.bank_company || "ACHME COMMUNICATION"),
    bank: esc(h.bank_name || "HDFC BANK"),
    account: esc(h.bank_account || "00312320005822"),
    ifsc: esc(h.bank_ifsc || "HDFC0000031"),
    branch: esc(h.bank_branch || "Coimbatore"),
  };

  let attachedImages = [];
  if (h.terms_separate_orders) {
    try {
      const so = typeof h.terms_separate_orders === "string"
        ? JSON.parse(h.terms_separate_orders)
        : h.terms_separate_orders;
      if (so && so.attached_images) {
        attachedImages = so.attached_images;
      }
    } catch (e) { }
  }

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${h.client_pincode}` : "";
  const clientCountry = h.client_country && h.client_country !== "India" ? `, ${h.client_country}` : "";

  const terms = [];
  if (h.terms_general) { /* General T&C — checkbox only, no body text */ }
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
    const desc = r.description || "";
    const commaIdx = desc.indexOf(",");
    let descHtml = "";
    if (!desc.trim()) {
      descHtml = "";
    } else if (commaIdx !== -1) {
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
      <td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#1a1f2e;vertical-align:top;">${i + 1}</td>
      ${hasBrandModel ? `<td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#444;vertical-align:top;width:80px;max-width:80px;word-break:break-word;">${esc(r.brand_model || "---")}</td>` : ""}
      ${hasDescription ? `<td style="padding:10px 8px;border-bottom:1px solid #dbeafe;vertical-align:top;width:240px;max-width:240px;word-break:break-word;">${descHtml}</td>` : ""}
      ${hasHSN ? `<td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#444;vertical-align:top;">${esc(r.hsn_sac || "---")}</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:center;">${qty}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#444;vertical-align:top;text-align:center;">${fmtNum(price, false)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#1a1f2e;vertical-align:top;">${esc(r.uom || "Nos")}</td>
      ${hasGST ? `<td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#444;vertical-align:top;text-align:right;">${r.tax || taxRate}%</td>` : ""}
      <td style="padding:10px 8px;border-bottom:1px solid #dbeafe;font-size:11px;color:#1a1f2e;vertical-align:top;text-align:right;">${fmtNum(lineTotal, false)}</td>
    </tr>`;
  }).join("");

  const dlGstMode = h.gst_mode || "Exclusive";
  const dlGrossBase = subtotal - totalDiscount;
  const dlTaxBase = dlGstMode === "Inclusive"
    ? Math.max(dlGrossBase - totalCGST - totalSGST - totalIGST, 0)
    : dlGrossBase;

  let showBreakdown = true;
  if (h.terms_separate_orders) {
    try {
      const so = typeof h.terms_separate_orders === "string"
        ? JSON.parse(h.terms_separate_orders)
        : h.terms_separate_orders;
      if (so && (so.show_gst_breakdown === false || so.hide_gst_percentage === true)) {
        showBreakdown = false;
      }
    } catch (e) { }
  }

  let gstRows = "";
  if (dlGstMode !== "Exempt" && dlGstMode !== "Without GST") {
    if (showBreakdown) {
      const groups = {};
      data.forEach(r => {
        const taxRate = Number(r.tax) || 0;
        if (taxRate === 0) return;
        const qty = Number(r.quantity || r.qty || 0);
        const price = Number(r.price || 0);
        const discount = Number(r.discount || 0);
        const base = price * qty - discount;

        let gstAmount = 0;
        if (dlGstMode === "Inclusive") {
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
          gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">CGST ${(rate / 2)}%</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(amt / 2)}</td></tr>`;
          gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">SGST ${(rate / 2)}%</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(amt / 2)}</td></tr>`;
        } else {
          gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">IGST ${rate}%</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(amt)}</td></tr>`;
        }
      });
    } else {
      const branchState = (h.supplier_branch === "Bangalore" ? "karnataka" : "tamil nadu");
      const clientState = (h.client_state || "").toLowerCase().trim();
      const same = branchState === clientState && clientState !== "";

      const hasCgstSgst = totalCGST > 0 || totalSGST > 0;
      const hasIgst = totalIGST > 0;

      if (hasCgstSgst && hasIgst) {
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">CGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalCGST)}</td></tr>`;
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">SGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalSGST)}</td></tr>`;
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">IGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalIGST)}</td></tr>`;
      } else if (hasCgstSgst || (totalIGST === 0 && same)) {
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">CGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalCGST)}</td></tr>`;
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">SGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalSGST)}</td></tr>`;
      } else if (hasIgst || (totalCGST === 0 && totalSGST === 0 && !same)) {
        gstRows += `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">IGST</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalIGST)}</td></tr>`;
      }
    }
  }

  const summaryRows = `
    <tr><td style="padding:10px 8px;font-size:12px;color:#64748b;width:50%;">Subtotal</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;width:50%;">${fmtNum(subtotal)}</td></tr>
    ${totalDiscount > 0 ? `<tr><td style="padding:10px 8px;font-size:12px;color:#64748b;">Discount</td><td style="padding:10px 8px;font-size:12px;color:#1a1f2e;text-align:right;font-weight:700;">${fmtNum(totalDiscount)}</td></tr>` : ""}
    ${gstRows}
    <tr><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;font-weight:700;background:#f0f4ff;">GRAND TOTAL</td><td style="padding:10px 8px;font-size:14px;color:#1e3a8a;text-align:right;font-weight:700;background:#f0f4ff;">${fmtNum(grandTotal)}</td></tr>
    <tr><td colspan="2" style="padding:4px 8px 8px 8px;font-size:10px;color:#64748b;font-style:italic;text-align:right;"><strong>Amount in Words:</strong> ${numberToWords(grandTotal)}</td></tr>`;

  const otherBranches = Object.entries(branchData).filter(([key]) => key !== (h.supplier_branch || "Coimbatore"));
  const branchesHtml = otherBranches.length > 0
    ? `<div class="branches-box" style="background:#fff;border:1px solid #93c5fd;border-radius:10px;padding:14px;margin-top:14px;box-shadow:0 2px 10px rgba(37,99,235,0.15);">
        <div style="color:#1e3a8a;font-weight:700;font-size:13px;margin-bottom:8px;">OUR BRANCHES</div>
        <div style="font-size:11.5px;line-height:1.6;color:#1a1f2e;">
          ${otherBranches.map(([name, v]) => `<div style="margin-bottom:4px;"><strong>${esc(name)}:</strong> ${esc(v.address)} | <strong>GSTIN:</strong> ${esc(v.gstin)}</div>`).join("")}
        </div>
      </div>`
    : "";

  const execName = esc(h.exec_name || "");
  const execPhone = esc(h.exec_phone || "");
  const execEmail = h.exec_email ? esc(h.exec_email) : "";



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
      border: 1px solid #93c5fd;
      box-shadow: 0 16px 48px rgba(37,99,235,0.18);
      padding: 0;
      position: relative;
      display: flex;
      flex-direction: column;
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
    .page-content {
      position: relative;
      z-index: 1;
      padding: 0 12mm 0 12mm;
    }

    /* Spacer fills remaining space to push footer to page bottom */
    .footer-spacer { flex: 1 0 0px; }

    /* Footer group — pinned to bottom of last A4 page via flexbox + spacer */
    .page-footer-group {
      padding: 0 12mm 12mm 12mm;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

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
      border: 1px solid #93c5fd; border-radius: 8px;
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
      background: #fff; border: 1px solid #93c5fd; border-radius: 10px;
      padding: 14px; height: 100%;
      box-shadow: 0 2px 10px rgba(37,99,235,0.15);
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
      border: 1px solid #93c5fd; border-radius: 10px;
      background: #fff; box-shadow: 0 2px 10px rgba(37,99,235,0.15);
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
      background: #fff; border: 1px solid #93c5fd; border-radius: 10px;
      padding: 14px; box-shadow: 0 2px 10px rgba(37,99,235,0.15); height: 100%;
    }
    .sh { color: #1e3a8a; font-weight: 700; font-size: 13px; margin-bottom: 8px; }

    /* Summary table */
    .st { width: 100%; border-collapse: collapse; table-layout: fixed; border: none; }
    .st td { padding: 10px 8px; font-size: 12px; border: none; }
    .st tr:last-child td { border-bottom: none; }

    /* Bank details grid */
    .bg { display: table; width: 100%; border-spacing: 0 4px; }
    .bg-row { display: table-row; }
    .bg-lbl { display: table-cell; color: #64748b; font-size: 11.5px; width: 88px; padding: 2px 0; }
    .bg-val { display: table-cell; font-weight: 700; font-size: 11.5px; color: #1a1f2e; padding: 2px 0; }

    /* Bottom row (Notes + Bank) */
    .ms-row2 { display: table; width: 100%; margin-top: 14px; border-spacing: 14px 0; table-layout: fixed; }
    .ms-row2-cell { display: table-cell; width: 50%; vertical-align: top; }

    /* Footer group styling defined above */

    /* Footer */
    .ft {
      display: table; width: 100%;
      border: 1px solid #93c5fd; border-radius: 10px;
      background: #fff; box-shadow: 0 2px 10px rgba(37,99,235,0.15);
      padding: 10px 14px; margin-top: 14px;
    }
    .ft-inner { display: flex; flex-wrap: nowrap; gap: 6px 20px; justify-content: flex-end; align-items: center; font-size: 11.5px; }
    .ft span { color: #1e3a8a; font-weight: 600; }

    /* Executive + Branches boxes — emphasized brand-blue border */
    .ft, .branches-box {
      border: 2px solid #1D3A8A !important;
      box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important;
    }
    .attached-images-box {
      background: #fff;
      border: 2px solid #1D3A8A !important;
      box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important;
      border-radius: 10px;
      padding: 14px;
      margin-top: 14px;
    }
    .attached-images-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .attached-images-grid.count-1 {
      display: flex;
      justify-content: center;
    }
    .attached-images-grid.count-1 .attached-image-container {
      width: 608px;
      height: 226px;
      margin: 0 auto;
    }
    .attached-images-grid.count-2 {
      display: grid;
      grid-template-columns: 307px 307px;
      gap: 11px;
      justify-content: center;
    }
    .attached-images-grid.count-2 .attached-image-container {
      width: 307px;
      height: 265px;
    }
    .attached-images-grid.count-3 {
      display: grid;
      grid-template-columns: 307px 285px;
      gap: 11px;
      justify-content: center;
    }
    .attached-images-grid.count-3 .attached-image-container:nth-child(1) {
      grid-column: span 2;
      width: 608px;
      height: 226px;
      margin: 0 auto;
    }
    .attached-images-grid.count-3 .attached-image-container:nth-child(2) {
      width: 307px;
      height: 265px;
    }
    .attached-images-grid.count-3 .attached-image-container:nth-child(3) {
      width: 285px;
      height: 267px;
    }
    .attached-image-container {
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
    .attached-image-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 6px;
    }

    /* ─── PRINT STYLES ─────────────────────────── */
    @media print {
      /* bottom 18mm reserves space for the fixed .ft footer bar */
      @page { size: A4 portrait; margin: 0; }

      body { background: #fff; }

      .page-wrap {
        width: 100%; border: none; box-shadow: none;
        margin: 0; padding: 0;
        display: block;
        min-height: auto;
      }

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
      .print-header-fixed .top-bar {
        position: fixed; top: 0; left: 0; right: 0;
        height: 6px; z-index: 100;
        background: linear-gradient(to right, #1f0779e0, #340285, #1b03a1);
      }
      /* screen-header's top-bar must NOT be fixed on print */
      .screen-header { display: none !important; }

      /* Fixed header repeats on every page */
      .print-header-fixed {
        display: block !important;
        position: fixed; top: 6px; left: 0; right: 0;
        background: #fff; z-index: 99;
        padding: 6mm 9mm 6px 9mm;
        border-bottom: 3px solid #1e3a8a;
      }
      .print-header-fixed .hdr { border-bottom: none; padding: 0; }

      /* Content padding: top clears fixed header (~38mm), bottom clears fixed footer (~18mm) */
      .page-content { padding: 38mm 12mm 18mm 12mm; display: block; }

      /* Spacer not needed — footer is now position:fixed */
      .footer-spacer { display: none !important; }

      /* Branches stay in normal flow; footer bar is fixed below */
      .page-footer-group {
        padding: 0 12mm 0 12mm;
        margin-top: 0;
      }

      .ft {
        box-sizing: border-box !important;
        display: block !important;
      }

      /* Page break controls */
      .tb, .tw thead, .tw tr, .g2, .ms-row2 {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .branches-box, .ft, .attached-images-box {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* Do NOT repeat thead across pages — fixed header handles repetition */
      thead { display: table-header-group; }
      /* Prevent the in-flow screen header from printing at all */
      .screen-header { display: none !important; }
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
      <div class="page-content" style="padding-bottom:0;">
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
    <div class="page-content">

      <!-- FROM / BILLED TO (equal height via display:table) -->
      <div class="tb">
        <div class="tb-cell">
          <div class="ib">
            <div class="ib-label">FROM</div>
            <h3>Achme Communication</h3>
            <div class="gst-tag">GSTIN: ${fromGstin}</div>
            <div class="cp">${fromAddress}</div>
            <div class="cl"><span class="cl-lbl">Ph:</span><span class="cl-val">${fromPhone}</span></div>
            <div class="cl"><span class="cl-lbl">Email:</span><span class="cl-val">sales@achmecommunication.com</span></div>
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
            ${(clientAddr || h.client_pincode) ? `<div class="cp" style="margin-top:4px;">${esc(clientAddr)}${esc(clientPin)}${esc(clientCountry)}</div>` : ""}
            ${h.mobile_number ? `<div class="cl"><span class="cl-lbl">Ph:</span><span class="cl-val">+91 ${esc(h.mobile_number)}</span></div>` : ""}
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
              ${hasBrandModel ? '<th style="width:80px;max-width:80px;">BRAND</th>' : ""}
              ${hasDescription ? '<th style="width:240px;max-width:240px;">DESCRIPTION</th>' : ""}
              ${hasHSN ? '<th style="width:80px;">HSN/SAC</th>' : ""}
              <th style="width:40px;text-align:center;">QTY</th>
              <th style="width:100px;text-align:center;">UNIT PRICE</th>
              <th style="width:50px;">UOM</th>
              ${hasGST ? '<th style="width:48px;text-align:right;">GST%</th>' : ""}
              <th style="width:96px;text-align:right;">TOTAL VALUE</th>
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
            <div class="box" style="padding:0;overflow:hidden;">
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

      ${attachedImages && attachedImages.length > 0 ? `
      <div class="attached-images-box">
        <div class="attached-images-grid count-${attachedImages.length}">
          ${attachedImages.map((img, idx) => `
            <div class="attached-image-container">
              <img src="${img}" alt="Attachment ${idx + 1}" />
            </div>
          `).join("")}
        </div>
      </div>` : ""}

    </div><!-- /page-content -->

    <!-- Spacer: flex-grows to push footer to bottom of last A4 page -->
    <div class="footer-spacer"></div>

    <!-- EXECUTIVE (top) + OUR BRANCHES (under): pinned to bottom of page -->
    <div class="page-footer-group">
      <!-- FOOTER (Executive details on top) -->
      ${(execName || execPhone || execEmail) ? `
      <div class="ft">
        <div class="ft-inner">
          ${execName ? `<span><strong>Executive:</strong> ${execName}</span>` : ""}
          ${execPhone ? `<span><strong>PH:</strong> ${execPhone}</span>` : ""}
          ${execEmail ? `<span><strong>Email:</strong> ${execEmail}</span>` : ""}
        </div>
      </div>` : ""}

      ${branchesHtml}
    </div>

  </div><!-- /page-wrap -->

  <script>
    // Count how many A4 pages the CONTENT alone needs, simulating the print
    // engine's page-break-inside:avoid behaviour so blocks pushed to the next
    // page (leaving blank space) are accounted for. The fixed header occupies
    // the top headerClear px of page 1 (content starts below it).
    function computeContentPages(mainEl, pageH, headerClear) {
      var cursor = headerClear;
      function isAvoidBreak(el) {
        var cs = window.getComputedStyle(el);
        return cs.breakInside === 'avoid' || cs.pageBreakInside === 'avoid';
      }
      function breakIfNeeded(h) {
        var sl = pageH - (cursor % pageH);
        if (h > sl && h <= pageH) cursor += sl;
      }
      function walkTable(table) {
        var thead = table.querySelector('thead');
        var thH = thead ? thead.offsetHeight : 0;
        if (thH) cursor += thH;
        var rows = table.querySelectorAll('tbody tr');
        for (var i = 0; i < rows.length; i++) {
          var rh = rows[i].offsetHeight;
          var sl = pageH - (cursor % pageH);
          if (rh > sl) { cursor += sl; if (thH) cursor += thH; }
          cursor += rh;
        }
      }
      function walk(el) {
        if (el.tagName === 'TABLE') { walkTable(el); return; }
        var h = el.offsetHeight;
        if (h === 0) return;
        if (isAvoidBreak(el)) { breakIfNeeded(h); cursor += h; }
        else if (el.children.length) { for (var i = 0; i < el.children.length; i++) walk(el.children[i]); }
        else { breakIfNeeded(h); cursor += h; }
      }
      for (var i = 0; i < mainEl.children.length; i++) walk(mainEl.children[i]);
      return { pages: Math.max(1, Math.ceil(cursor / pageH)), end: cursor };
    }

    // Pin the footer group to the bottom of the LAST content page by making the
    // wrapper exactly N pages tall and absolutely positioning the footer at its
    // bottom edge. Absolute placement is exact regardless of break gaps above it.
    function pinFooterToLastPageBottom() {
      const wrap = document.querySelector(".page-wrap");
      if (!wrap) return;
      const group = document.querySelector(".page-footer-group");
      if (!group) return;
      // NOTE: there are two .page-content elements (one nested in .screen-header
      // for the header, one for the body). Pick the body one — the direct child
      // of .page-wrap — not the first match.
      let content = null;
      for (let k = 0; k < wrap.children.length; k++) {
        if (wrap.children[k].classList && wrap.children[k].classList.contains("page-content")) {
          content = wrap.children[k];
        }
      }
      if (!content) return;

      // Reset previous computations before measuring
      ["margin-top", "padding-top", "position", "left", "right", "bottom", "margin"]
        .forEach(function (p) { group.style.removeProperty(p); });
      wrap.style.removeProperty("min-height");
      void wrap.offsetHeight;

      const wrapWidth = wrap.offsetWidth;
      const PAGE_H_PX = wrapWidth * (297 / 210);   // full A4 height (print @page margin:0)
      const HEADER_CLEAR = wrapWidth * (38 / 210); // 38mm fixed header on page 1

      const measured = computeContentPages(content, PAGE_H_PX, HEADER_CLEAR);
      let nPages = measured.pages;
      const contentEnd = measured.end;

      // The footer (Executive + Branches) is pinned to the EXACT bottom line of
      // the page. It only needs a small clear gap so it never touches the Notes /
      // Bank box outlines; if that gap can't be met on the current last page, push
      // the whole footer group onto a fresh page (which still shows the fixed
      // header + watermark) — where it again sits at the exact bottom line.
      const footerH = group.offsetHeight;
      const MIN_GAP = wrapWidth * (8 / 210); // ~8mm clear gap above the footer

      const footerTop = nPages * PAGE_H_PX - footerH; // footer pinned at bottom: 0
      if (footerTop - contentEnd < MIN_GAP) {
        nPages += 1; // would touch a box outline — bump the footer to the next page
      }

      wrap.style.setProperty("position", "relative", "important");
      // Fill exactly N pages (minus 1px so rounding never spills onto a blank N+1 page).
      wrap.style.setProperty("min-height", (nPages * PAGE_H_PX - 1) + "px", "important");

      group.style.setProperty("position", "absolute", "important");
      group.style.setProperty("left", "0", "important");
      group.style.setProperty("right", "0", "important");
      group.style.setProperty("bottom", "0", "important");
      group.style.setProperty("margin", "0", "important");
    }

    window.addEventListener('load', function () {
      document.fonts.ready.then(function() {
        pinFooterToLastPageBottom();
        setTimeout(function () { window.print(); }, 300);
      });
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
