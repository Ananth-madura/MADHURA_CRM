import React, { useState, useEffect } from "react";
import axios from "axios";
import { API } from "../config/api";
import logoImg from "../images/achme2logo-high.jpeg";
import brandLogo from "../images/achme-logo-high.jpeg";
import { BRANCH_DATA, BANK_DETAILS } from "../config/branchConfig";
import "../Styles/form-template.css";

const TYPE_MAP = {
  quotation: { label: "QUOTATION", prefix: "QT" },
  proforma: { label: "PROFORMA INVOICE", prefix: "PI" },
  estimation: { label: "ESTIMATION", prefix: "EI" },
  service: { label: "SERVICE ESTIMATION", prefix: "SE" },
};

const fmt = (val) => `Rs. ${(Number(val || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const hasGST = taxRate > 0;
  const showCGST = totalCGST > 0;
  const showSGST = totalSGST > 0;
  const showIGST = totalIGST > 0;
  const showDiscount = totalDiscount > 0;

  const hasHSN = rows.some((r) => r.hsn_sac);
  const hasBrandModel = rows.some((r) => r.brand_model && String(r.brand_model).trim() !== "");

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
  if (h.terms_general === 1 || h.terms_general === true) terms.push("General Terms & Conditions apply.");
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
    } catch (e) {}
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

          {/* FROM / BILLED TO */}
          <section className="ft-top-boxes">
            <div className="ft-info-box">
              <div className="ft-box-title">FROM</div>
              <h3>Achme Communication</h3>
              <div className="ft-gst">GSTIN: {fromGstin}</div>
              <div className="ft-compact">{fromAddress}</div>
              <div className="ft-contact-line">
                <span className="label">Ph:</span>
                <span>0422-2569966, 4376555</span>
              </div>
              <div className="ft-contact-line">
                <span className="label">Email:</span>
                <span>info@achmecommunication.com</span>
              </div>
              <div className="ft-contact-line">
                <span className="label">Web:</span>
                <span>www.achmecommunication.com</span>
              </div>
            </div>

            <div className="ft-info-box">
              <div className="ft-box-title">BILLED TO</div>
              <h3>{h.client_company || h.customer_name || "---"}</h3>
              {h.client_company && <div className="ft-compact" style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{h.customer_name}</div>}
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
                  <span>{h.mobile_number}</span>
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
                  <th>S.NO</th>
                  {/* Show BRAND / MODEL first if available */}
                  {hasBrandModel && <th>BRAND / MODEL</th>}
                  <th>DESCRIPTION</th>
                  {hasHSN && <th>HSN/SAC</th>}
                  <th>QTY</th>
                  <th>UOM</th>
                  {hasGST && <th>GST%</th>}
                  <th>PRICE</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const qty = Number(r.quantity || 0);
                  const price = Number(r.price || 0);
                  const lineTotal = qty * price;
                  return (
                    <tr key={i}>
                      <td data-label="S.NO">{i + 1}</td>
                      {hasBrandModel && <td data-label="BRAND / MODEL">{r.brand_model || "---"}</td>}
                      <td data-label="DESCRIPTION">
                        {(() => {
                          const desc = r.description || "---";
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
                      {hasHSN && <td data-label="HSN/SAC">{r.hsn_sac || "---"}</td>}
                      <td data-label="QTY">{qty}</td>
                      <td data-label="UOM">{r.uom || "Nos"}</td>
                      {hasGST && <td data-label="GST%">{r.tax || taxRate}%</td>}
                      <td data-label="PRICE">{fmt(price)}</td>
                      <td data-label="TOTAL">
                        <strong>{fmt(lineTotal)}</strong>
                      </td>
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
                  {showCGST && (
                    <tr>
                      <td style={{ width: "50%" }}>CGST ({taxRate / 2}%)</td>
                      <td style={{ width: "50%" }}>{fmt(totalCGST)}</td>
                    </tr>
                  )}
                  {showSGST && (
                    <tr>
                      <td style={{ width: "50%" }}>SGST ({taxRate / 2}%)</td>
                      <td style={{ width: "50%" }}>{fmt(totalSGST)}</td>
                    </tr>
                  )}
                  {showIGST && (
                    <tr>
                      <td style={{ width: "50%" }}>IGST ({taxRate}%)</td>
                      <td style={{ width: "50%" }}>{fmt(totalIGST)}</td>
                    </tr>
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

          {/* BRANCHES */}
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

          {/* FOOTER */}
          {(execName || execPhone || execEmail) && (
            <footer className="ft-footer">
              {execName && (
                <div>
                  <span>Executive:</span> {execName}
                </div>
              )}
              {execPhone && (
                <div>
                  <span>PH:</span> {execPhone}
                </div>
              )}
              {execEmail && (
                <div>
                  <span>Email:</span> {execEmail}
                </div>
              )}
            </footer>
          )}
        </div>
      </main>
    </div>
  );
};

export default Invoice;
