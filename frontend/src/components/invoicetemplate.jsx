import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config/api";
import logoImg from "../layout/Madhura-logo.png";
import brandLogo from "../layout/Madhura-logo.png";
import { BRANCH_DATA, BANK_DETAILS } from "../config/branchConfig";
import "../Styles/form-template.css";

const TYPE_MAP = {
  quotation: { label: "QUOTATION", prefix: "QT" },
  proforma: { label: "PROFORMA INVOICE", prefix: "PI" },
  estimation: { label: "ESTIMATION", prefix: "EI" },
  service: { label: "SERVICE ESTIMATION", prefix: "SE" },
};

const fmt = (val, showSym = true) => {
  const n = Number(val || 0);
  const formatted = n.toLocaleString("en-IN", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
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

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
    : "---";

const getTaxRate = (h) => {
  if (h.custom_tax) return Number(h.custom_tax);
  if (h.tax_type === "GST5") return 5;
  if (h.tax_type === "GST18") return 18;
  if (h.tax_type === "NONE" || h.tax_type === "Without GST") return 0;
  return 18;
};

const getBranchData = (branchName) => {
  return BRANCH_DATA[branchName] || BRANCH_DATA["Coimbatore"];
};

const getBankData = (bankId) => {
  const bank = BANK_DETAILS.find((b) => b.id === bankId);
  return bank || BANK_DETAILS[0];
};

const BRANCH_NAMES = Object.keys(BRANCH_DATA);
const BRANCHES = Object.fromEntries(
  BRANCH_NAMES.map((name) => [name, { name, address: BRANCH_DATA[name].address, gstin: BRANCH_DATA[name].gstin }])
);

const Invoice = ({ quotationId, type = "quotation", pdfMode = false }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ROUTE_MAP = {
      quotation: "quotations",
      proforma: "performainvoice",
      estimation: "estimate-invoice",
      service: "service-estimation",
    };
    const route = ROUTE_MAP[type] || "quotations";
    const endpoint = `${API}/api/${route}/${quotationId}`;
    const token = localStorage.getItem("token");

    axios
      .get(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setRows(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(`Failed to load ${type}`);
        setLoading(false);
      });
  }, [quotationId, type]);

  // The footer group is pinned to the bottom of the page via flexbox
  // (.ft-content is a flex column; .ft-page-footer-group uses margin-top:auto).
  // No JS pagination simulation is needed for the on-screen preview.

  if (loading) {
    return (
      <div className="ft-wrapper">
        <div className="ft-quotation-wrapper">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px" }}>
            <div style={{ fontSize: "16px", fontWeight: "500", color: "var(--muted)" }}>Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !rows.length) {
    return (
      <div className="ft-wrapper">
        <div className="ft-quotation-wrapper">
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "60px", color: "#e03131" }}>
            {error || "No document data found"}
          </div>
        </div>
      </div>
    );
  }

  const h = rows[0];
  const config = TYPE_MAP[type] || TYPE_MAP.quotation;
  const docId = h.quotation_id || h.invoice_id || h.id;
  const docDate = h.invoice_date || h.quotation_date || h.estimate_date;
  const docNumber = `${config.prefix}-${new Date(docDate).getFullYear()}-${String(docId).padStart(3, "0")}`;

  const subtotal = rows.reduce((sum, r) => {
    const qty = Number(r.quantity || 0);
    const price = Number(r.price || 0);
    return sum + qty * price;
  }, 0);

  const totalDiscount = Number(h.total_discount || 0);
  const totalCGST = Number(h.total_cgst || 0);
  const totalSGST = Number(h.total_sgst || 0);
  const totalIGST = Number(h.total_igst || 0);
  const grandTotal = Number(h.grand_total || 0) || (subtotal - totalDiscount + totalCGST + totalSGST + totalIGST);

  const taxRate = getTaxRate(h);
  const hasGST = taxRate > 0 || totalCGST > 0 || totalSGST > 0 || totalIGST > 0;
  const showCGST = totalCGST > 0;
  const showSGST = totalSGST > 0;
  const showIGST = totalIGST > 0;
  const showDiscount = totalDiscount > 0;

  // Derive actual % from stored amounts for accurate label display
  // For Inclusive GST, tax base is subtotal minus the tax amounts themselves
  const gstModeStr = h.gst_mode || "Exclusive";
  const grossBase = subtotal - totalDiscount;
  const taxableBase = gstModeStr === "Inclusive"
    ? Math.max(grossBase - totalCGST - totalSGST - totalIGST, 0)
    : grossBase;
  const cgstRate = showCGST && taxableBase > 0 ? +((totalCGST / taxableBase) * 100).toFixed(2).replace(/\.?0+$/, '') : taxRate / 2;
  const sgstRate = showSGST && taxableBase > 0 ? +((totalSGST / taxableBase) * 100).toFixed(2).replace(/\.?0+$/, '') : taxRate / 2;
  const igstRate = showIGST && taxableBase > 0 ? +((totalIGST / taxableBase) * 100).toFixed(2).replace(/\.?0+$/, '') : taxRate;

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

  const branchStateForGst = (h.supplier_branch === "Bangalore" ? "karnataka" : "tamil nadu");
  const clientStateForGst = (h.client_state || "").toLowerCase().trim();
  const sameState = branchStateForGst === clientStateForGst && clientStateForGst !== "";

  const gstBreakdown = [];
  if (gstModeStr !== "Exempt" && gstModeStr !== "Without GST") {
    const groups = {};
    rows.forEach(r => {
      const taxRate = Number(r.tax) || 0;
      if (taxRate === 0) return;
      const qty = Number(r.quantity || 0);
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

    const hasCgstSgst = totalCGST > 0 || totalSGST > 0;
    const hasIgst = totalIGST > 0;
    const isCgstSgst = hasCgstSgst ? true : (hasIgst ? false : sameState);

    Object.keys(groups).sort((a, b) => Number(b) - Number(a)).forEach(rateStr => {
      const rate = Number(rateStr);
      const amt = groups[rateStr];
      if (isCgstSgst) {
        gstBreakdown.push({ label: `CGST ${(rate / 2)}%`, amount: amt / 2 });
        gstBreakdown.push({ label: `SGST ${(rate / 2)}%`, amount: amt / 2 });
      } else {
        gstBreakdown.push({ label: `IGST ${rate}%`, amount: amt });
      }
    });
  }

  const hasHSN = rows.some((r) => r.hsn_sac);
  const hasBrandModel = rows.some((r) => r.brand_model && String(r.brand_model).trim() !== "");
  const hasDescription = rows.some((r) => r.description && String(r.description).trim() !== "");

  const branchPhone = BRANCH_DATA[h.supplier_branch]?.phone || "0422 4397555 , 2563666";
  const branchPhoneDisplay = branchPhone.split(",").map(p => p.trim()).map(p => `+91 ${p}`).join("  |  ");

  const branchData = getBranchData(h.supplier_branch);
  const fromAddress = h.resolved_from_address || h.from_address_custom || branchData.address || "436H Avinashi Road Opp to SMS Hotel, Peelamedu, Coimbatore-641004";
  const fromGstin = h.from_gstin || branchData.gstin || "33AAHFA7876M1ZX";

  const bank = {
    company: h.bank_company || (h.bank_details_id ? getBankData(h.bank_details_id).company : "ACHME COMMUNICATION"),
    bank: h.bank_name || (h.bank_details_id ? getBankData(h.bank_details_id).bank : "HDFC BANK"),
    account: h.bank_account || (h.bank_details_id ? getBankData(h.bank_details_id).account : "00312320005822"),
    ifsc: h.bank_ifsc || (h.bank_details_id ? getBankData(h.bank_details_id).ifsc : "HDFC0000031"),
    branch: h.bank_branch || (h.bank_details_id ? getBankData(h.bank_details_id).branch : "Coimbatore"),
  };

  const execName = h.exec_name || "";
  const execPhone = h.exec_phone || "";
  const execEmail = h.exec_email || "";

  const clientAddr = [h.client_address1, h.client_address2, [h.client_city, h.client_state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");
  const clientPin = h.client_pincode ? `, Pin: ${h.client_pincode}` : "";
  const clientCountry = h.client_country && h.client_country !== "India" ? `, ${h.client_country}` : "";

  const terms = [];
  if (h.terms_general === 1 || h.terms_general === true) { /* General T&C — checkbox only, no body text */ }
  if (h.terms_tax === 1 || h.terms_tax === true) terms.push("Prices quoted are exclusive of Sales and Service Tax.");
  if (h.gst_mode) terms.push(`GST: ${h.gst_mode === "Exclusive" ? "GST Extra" : h.gst_mode === "Inclusive" ? "GST Inclusive" : "GST Exempt"}`);
  if (h.terms_project_period) terms.push(`Project Period: ${h.terms_project_period}`);
  if (h.terms_validity) terms.push(`Quote valid for ${h.terms_validity} from quotation date.`);
  if (h.terms_separate_orders) {
    try {
      const so = typeof h.terms_separate_orders === "string" ? JSON.parse(h.terms_separate_orders) : h.terms_separate_orders;
      if (so?.material) terms.push("A. Material Supply (As per actuals)");
      if (so?.installation) terms.push("B. Installation / Services");
      if (so?.usd) terms.push("C. Price may vary based on USD rates");
      if (so?.boq) terms.push("D. Factory BOQ may vary");
    } catch (e) { }
  }
  if (h.terms_payment) {
    const pt = h.terms_payment === "Custom" ? h.terms_payment_custom : h.terms_payment;
    if (pt) terms.push(`Payment Terms: ${pt}`);
  }
  if (h.terms_payment_custom && h.terms_payment !== "Custom") terms.push(`Payment Terms: ${h.terms_payment_custom}`);
  if (h.terms_warranty) terms.push(`Warranty: ${h.terms_warranty}`);
  if (h.custom_terms) terms.push(h.custom_terms);

  const otherBranches = Object.entries(BRANCHES)
    .filter(([key]) => key !== h.supplier_branch)
    .map(([, v]) => v);

  return (
    <div className={pdfMode ? "ft-wrapper ft-pdf-mode" : "ft-wrapper"}>
      <main className="ft-quotation-wrapper">
        <img className="ft-watermark" src={logoImg} alt="watermark" />

        <div className="ft-content">
          <table style={{ width: "100%", borderCollapse: "collapse", border: "none" }}>
            <thead>
              <tr>
                <td style={{ padding: 0, border: "none" }}>
                  {/* HEADER */}
                  <header className="ft-header">
                    <div className="ft-brand">
                      <img src={brandLogo} alt="Achme Communication logo" />
                    </div>
                    <div className="ft-quotation-title">
                      <h2>{config.label}</h2>
                      <div className="ft-doc-box">
                        <div>
                          <span>Doc No:</span> {docNumber}
                        </div>
                        <div>
                          <span>Date:</span> {formatDate(docDate)}
                        </div>
                      </div>
                    </div>
                  </header>
                  <div style={{ height: "14px" }}></div>
                </td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: 0, border: "none" }}>
                  {/* FROM / BILLED TO */}
                  <section className="ft-top-boxes">
                    <div className="ft-info-box">
                      <div className="ft-box-title">FROM</div>
                      <h3>Achme Communication</h3>
                      <div className="ft-gst">GSTIN: {fromGstin}</div>
                      <div className="ft-compact">{fromAddress}</div>
                      <div className="ft-contact-line">
                        <span className="label">Ph:</span>
                        <span>{branchPhoneDisplay}</span>
                      </div>
                      <div className="ft-contact-line">
                        <span className="label">Email:</span>
                        <span>sales@achmecommunication.com</span>
                      </div>
                      <div className="ft-contact-line">
                        <span className="label">Web:</span>
                        <span>www.achmecommunication.com</span>
                      </div>
                    </div>

                    <div className="ft-info-box">
                      <div className="ft-box-title">BILLED TO</div>
                      {(() => {
                        const clientCompany = (h.client_company || "").trim();
                        return (
                          <>
                            <h3>{clientCompany || h.customer_name || "---"}</h3>
                            {clientCompany && <div className="ft-compact" style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{h.customer_name}</div>}
                          </>
                        );
                      })()}
                      {h.gst_number && <div className="ft-gst">GSTIN: {h.gst_number}</div>}
                      {(clientAddr || h.client_pincode) && (
                        <div className="ft-compact">
                          {clientAddr}
                          {clientPin}
                          {clientCountry}
                        </div>
                      )}
                      {h.mobile_number && (
                        <div className="ft-contact-line">
                          <span className="label">Ph:</span>
                          <span>+91 {h.mobile_number}</span>
                        </div>
                      )}
                      {h.email && (
                        <div className="ft-contact-line">
                          <span className="label">Email:</span>
                          <span>{h.email}</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ITEMS TABLE */}
                  <div className="ft-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: "35px" }}>S.NO</th>
                          {/* Show BRAND first if available */}
                          {hasBrandModel && <th style={{ width: "80px", maxWidth: "80px" }}>BRAND</th>}
                          {hasDescription && <th style={{ width: "240px", maxWidth: "240px" }}>DESCRIPTION</th>}
                          {hasHSN && <th style={{ width: "80px" }}>HSN/SAC</th>}
                          <th style={{ width: "40px" }}>QTY</th>
                          <th style={{ width: "100px", textAlign: "center" }}>UNIT PRICE</th>
                          <th style={{ width: "50px" }}>UOM</th>
                          {hasGST && <th style={{ width: "48px" }}>GST%</th>}
                          <th style={{ width: "90px", textAlign: "right" }}>TOTAL VALUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const qty = Number(r.quantity || 0);
                          const price = Number(r.price || 0);
                          const lineTotal = qty * price;
                          return (
                            <tr key={i}>
                              <td data-label="S.NO" style={{ width: "35px" }}>{i + 1}</td>
                              {hasBrandModel && (
                                <td data-label="BRAND" style={{ width: "80px", maxWidth: "80px", wordBreak: "break-word" }}>
                                  {r.brand_model || "---"}
                                </td>
                              )}
                              {hasDescription && (
                                <td data-label="DESCRIPTION" style={{ width: "240px", maxWidth: "240px", wordBreak: "break-word" }}>
                                  {(() => {
                                    const desc = r.description || "";
                                    if (!desc.trim()) return "";
                                    const commaIndex = desc.indexOf(",");
                                    if (commaIndex !== -1) {
                                      const heading = desc.substring(0, commaIndex + 1);
                                      const body = desc.substring(commaIndex + 1);
                                      return (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
                                          <span style={{ fontWeight: "700", color: "#1e293b", fontSize: "12px" }}>{heading}</span>
                                          <span style={{ fontWeight: "400", color: "#64748b", fontSize: "10.5px", marginTop: "2px" }}>{body.trim()}</span>
                                        </div>
                                      );
                                    }
                                    return <strong>{desc}</strong>;
                                  })()}
                                </td>
                              )}
                              {hasHSN && <td data-label="HSN/SAC" style={{ width: "80px" }}>{r.hsn_sac || "---"}</td>}
                              <td data-label="QTY" style={{ width: "40px" }}>{qty}</td>
                              <td data-label="UNIT PRICE" style={{ width: "100px", textAlign: "center" }}>{fmt(price, false)}</td>
                              <td data-label="UOM" style={{ width: "50px" }}>{r.uom || "Nos"}</td>
                              {hasGST && <td data-label="GST%" style={{ width: "48px" }}>{r.tax || taxRate}%</td>}
                              <td data-label="TOTAL VALUE" style={{ width: "90px", textAlign: "right", fontWeight: "bold" }}>{fmt(lineTotal, false)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* MID SECTION */}
                  <section className="ft-mid-section">
                    <div className="ft-grid-2x2">
                      {/* TERMS */}
                      {terms.length > 0 && (
                        <div className="ft-terms-box">
                          <div className="ft-section-heading">TERMS & CONDITIONS</div>
                          <ul>
                            {terms.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* SUMMARY */}
                      <div className="ft-summary-box">
                        <table className="ft-summary-table">
                          <tr>
                            <td style={{ width: "50%" }}>Subtotal</td>
                            <td style={{ width: "50%" }}>{fmt(subtotal)}</td>
                          </tr>
                          {showDiscount && (
                            <tr>
                              <td style={{ width: "50%" }}>Discount</td>
                              <td style={{ width: "50%" }}>{fmt(totalDiscount)}</td>
                            </tr>
                          )}
                          {showBreakdown ? (
                            gstBreakdown.map((b, idx) => (
                              <tr key={idx}>
                                <td style={{ width: "50%" }}>{b.label}</td>
                                <td style={{ width: "50%" }}>{fmt(b.amount)}</td>
                              </tr>
                            ))
                          ) : (
                            <>
                              {showCGST && showIGST ? (
                                <>
                                  <tr>
                                    <td style={{ width: "50%" }}>CGST</td>
                                    <td style={{ width: "50%" }}>{fmt(totalCGST)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ width: "50%" }}>SGST</td>
                                    <td style={{ width: "50%" }}>{fmt(totalSGST)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ width: "50%" }}>IGST</td>
                                    <td style={{ width: "50%" }}>{fmt(totalIGST)}</td>
                                  </tr>
                                </>
                              ) : showCGST || showSGST || (totalIGST === 0 && sameState) ? (
                                <>
                                  <tr>
                                    <td style={{ width: "50%" }}>CGST</td>
                                    <td style={{ width: "50%" }}>{fmt(totalCGST)}</td>
                                  </tr>
                                  <tr>
                                    <td style={{ width: "50%" }}>SGST</td>
                                    <td style={{ width: "50%" }}>{fmt(totalSGST)}</td>
                                  </tr>
                                </>
                              ) : showIGST || (totalCGST === 0 && totalSGST === 0 && !sameState) ? (
                                <tr>
                                  <td style={{ width: "50%" }}>IGST</td>
                                  <td style={{ width: "50%" }}>{fmt(totalIGST)}</td>
                                </tr>
                              ) : null}
                            </>
                          )}
                          {!hasGST && (
                            <tr>
                              <td style={{ color: "var(--muted)", fontSize: "10px", width: "50%" }}>Without GST</td>
                              <td style={{ width: "50%" }}></td>
                            </tr>
                          )}
                          <tr className="ft-grand-total">
                            <td style={{ width: "50%" }}>GRAND TOTAL</td>
                            <td style={{ width: "50%" }}>{fmt(grandTotal)}</td>
                          </tr>
                          <tr>
                            <td colSpan="2" style={{ fontSize: "10px", color: "#475569", fontStyle: "italic", paddingTop: "6px", textAlign: "right" }}>
                              <strong>Amount in Words:</strong> {numberToWords(grandTotal)}
                            </td>
                          </tr>
                        </table>
                      </div>

                      {/* NOTES */}
                      <div className="ft-notes-box">
                        <div className="ft-section-heading">IMPORTANT NOTES</div>
                        <strong>Materials:</strong> BOQ based on discussion. Extra materials required at execution charged extra. CABLE & ACCESSORIES AS PER ACTUALS.
                        <br />
                        <br />
                        <strong>Delay:</strong> Delays due to external dependencies at site - Achme Communication will not be responsible.
                        <br />
                        <br />
                        <strong>NOTE:</strong> Civil, Electrical & Interior Works not included.
                      </div>

                      {/* BANK */}
                      <div className="ft-bank-box">
                        <div className="ft-section-heading">BANK DETAILS</div>
                        <div className="ft-bank-grid">
                          <div>Company</div>
                          <div>
                            <strong>{bank.company}</strong>
                          </div>
                          <div>Bank</div>
                          <div>
                            <strong>{bank.bank}</strong>
                          </div>
                          <div>Account</div>
                          <div>
                            <strong>{bank.account}</strong>
                          </div>
                          <div>IFSC</div>
                          <div>
                            <strong>{bank.ifsc}</strong>
                          </div>
                          <div>Branch</div>
                          <div>
                            <strong>{bank.branch}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {attachedImages && attachedImages.length > 0 && (
                    <div className="ft-attached-images-box">
                      <div className={`ft-attached-images-grid count-${attachedImages.length}`}>
                        {attachedImages.map((img, idx) => (
                          <div key={idx} className="ft-attached-image-container">
                            <img src={img} alt={`Attachment ${idx + 1}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BRANCHES + FOOTER: always pinned to bottom of last page */}
                  <div className="ft-page-footer-group" style={{ marginTop: "auto" }}>
                    {otherBranches.length > 0 && (
                      <div className="ft-branch-box">
                        <div className="ft-section-heading">OUR BRANCHES</div>
                        {otherBranches.map((b, i) => (
                          <span key={i}>
                            <strong>{b.name}:</strong> {b.address} | <strong>GSTIN:</strong> {b.gstin}
                            {i < otherBranches.length - 1 && <br />}
                          </span>
                        ))}
                      </div>
                    )}

                    {(execName || execPhone || execEmail) && (
                      <footer className="ft-footer">
                        {execName && (
                          <span>
                            <strong>Executive:</strong> {execName}
                          </span>
                        )}
                        {execPhone && (
                          <span>
                            <strong>PH:</strong> {execPhone}
                          </span>
                        )}
                        {execEmail && (
                          <span>
                            <strong>Email:</strong> {execEmail}
                          </span>
                        )}
                      </footer>
                    )}
                  </div>

                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Invoice;
