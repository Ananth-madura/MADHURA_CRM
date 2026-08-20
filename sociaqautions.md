# Achme Communication Document Generation Specifications

This document defines the exact layout, styling rules, business logic, and page-rendering mechanics used in the Achme Communication document template (Quotations, Invoices, Service Estimations, and Proforma Invoices). Follow these specifications to produce a pixel-perfect, functionally identical clone of the document generation engine.

---

## 1. Visual Theme & CSS Variables

The document follows a premium, high-contrast corporate identity based on a clean grid system, modern typography, and curated blue/slate colors.

### A. Design Tokens (CSS Variables)
*   **Fonts:** `Poppins`, fallback to `Arial, sans-serif`. Imported via Google Fonts.
*   **Colors:**
    *   `--brand`: `#1e3a8a` (Deep Royal Blue used for main accents, headers, and active status)
    *   `--brand-deep`: `#1e293b` (Dark Slate used for primary labels and headings)
    *   `--ink`: `#1a1f2e` (Near Black used for main body text)
    *   `--muted`: `#64748b` (Cool Grey used for secondary labels and placeholders)
    *   `--line`: `#94a3b8` (Slate Grey used for card borders)
    *   `--line-soft`: `#cbd5e1` (Light Grey used for table row borders)
    *   `--paper`: `#ffffff` (Pure White page background)
    *   `--page-bg`: `#f1f5f9` (Light Slate background for preview mode only)
    *   `--card-bg`: `rgba(255, 255, 255, 0.96)` (White backdrop card fill)
*   **Shadows:** 
    *   `--shadow-sm`: `0 2px 8px rgba(30, 41, 59, 0.08)` (Subtle card elevations)
    *   `--shadow-lg`: `0 16px 48px rgba(30, 41, 59, 0.14)` (Main preview container shadow)
*   **Border Radius:** `10px` on all cards and tables; `8px` on document status badges.

---

## 2. Document Header Structure

The header spans the full width of the content area and contains brand branding and dynamic metadata.

### A. Layout Grid
*   Split into two columns using a grid/table structure:
    *   **Left Column (60%):** Achme Communication brand logo (`achme-logo-high.jpeg`), styled to stretch up to a maximum width of `330px`.
    *   **Right Column (40%):** Document identity details.
        *   **Document Label:** Large title (e.g., `QUOTATION`, `PROFORMA INVOICE`, `ESTIMATION`, `SERVICE ESTIMATION`) in uppercase, color `--brand`, font-size `22px`, font-weight `500`.
        *   **Document Box Badge:** Styled container (`.ft-doc-box`) with a `1px solid var(--line)` border, background `#f8fafc`, padding `10px 12px`, and border-radius `8px`. Inside, it holds:
            *   `Doc No:` (Bold label) followed by the formatted ID (e.g., `QT-2026-022`).
            *   `Date:` (Bold label) followed by the document date formatted as `DD MMM YYYY` (e.g., `13 Jun 2026`).

---

## 3. Contact & Billing Info (Top Grid)

A 2-column grid (`.ft-top-boxes`) with a `12px` gap. Columns stretch vertically to match heights (`align-items: stretch`).

### A. Left Card: "FROM" (Supplier Details)
*   Title: `FROM` (font-size `13px`, font-weight `700`, color `--brand`).
*   **Supplier Name:** `Achme Communication` (font-size `15px`, font-weight `700`, color `#2c2c2c`).
*   **Address & Details:** Multi-line text block with address resolved dynamically based on the supplier's branch.
    *   Coimbatore: `Opp to SMS Hotel, Peelamedu, Avinashi Road, Coimbatore-641004` (GSTIN: `33AAHFA7876M1ZX`)
    *   Bangalore: `14th Main Road, GK Layout, Electronic City Post, Bangalore-56010 post` (GSTIN: `29AAHFA7876M1ZM`)
    *   Chennai: `5th Floor, 5CD PM Towers, Greams Road, Thousand Lights, Chennai-600006` (GSTIN: `33AAHFA7876M1ZX`)
*   **Branch-Specific Contacts:**
    *   Coimbatore phone: `0422 4397555 , 2563666`
    *   Bangalore phone: `98422 35515 & 80125 55718`
    *   Chennai phone: `80125 55706 & 80125 55710`
*   **Phone Formatting:** All phone numbers shown must be prefixed dynamically with `+91 ` (e.g., `+91 8012555706 | +91 8012555710`).
*   **Static fields:**
    *   Email: `sales@achmecommunication.com`
    *   Website: `www.achmecommunication.com`

### B. Right Card: "BILLED TO" (Client Details)
*   Title: `BILLED TO` (font-size `13px`, font-weight `700`, color `--brand`).
*   **Client Heading:** Displays `h.client_company` or falls back to `h.customer_name` (font-size `15px`, font-weight `700`).
*   **GSTIN:** Displays `GSTIN: {gst_number}` if provided.
*   **Client Address:** Combines client address line 1, line 2, city, state, country, and pincode dynamically.
*   **Contacts:** Displays client phone and email. Phone numbers are formatted with the `+91 ` prefix.

---

## 4. Items Table Layout

A clean table with rounded corners, elevated on a container with card borders.

### A. Styling & Colors
*   **Header background:** Soft blue fill (`#d8e3f0` or `#f8fafc`).
*   **Header text:** Color `--brand-deep` (`#1e293b`), font-size `10.5px`, font-weight `700`, text-transform uppercase.
*   **Cell Borders:** Thin light-grey bottom borders (`1px solid #cbd5e1` or `#dbeafe`). The last row's cells have `border-bottom: 0`.
*   **Padding:** Cell paddings are `10px 8px`.

### B. Column Mappings & Alignments
1.  `S.NO` (Width: `32px` | Center aligned)
2.  `BRAND` (Optional: hidden if no item has a brand | Left aligned)
3.  `DESCRIPTION` (Max-width: `160px`, word-break: break-word | Left aligned)
    *   *Formatting:* If the description contains a comma, everything before the first comma is bolded (`font-weight: 700`, `12px`, color `--brand-deep`), and everything after it is styled as small, gray metadata (`font-weight: 400`, `10.5px`, color `#64748b`).
5.  `HSN/SAC` (Optional: hidden if no item has HSN/SAC | Left aligned)
6.  `QTY` (Width: `40px` | Center aligned)
7.  `UNIT PRICE` (Width: `80px` | Right aligned | **No Currency Symbol**, normal weight)
8.  `UOM` (Width: `50px` | Left aligned)
9.  `GST%` (Optional: hidden if tax rate is 0 | Right aligned)
10. `TOTAL VALUE` (Width: `90px` | Right aligned | **No Currency Symbol**, normal weight `font-weight: 400`)

---

## 5. Mid Section Grid (Terms, Bank, Notes & Totals)

Two rows of grids containing critical data blocks.

### A. Row 1: Terms & Conditions (Left) & Summary Table (Right)
*   **Terms & Conditions Card (`.ft-terms-box`):**
    *   A card styled with standard borders and shadows.
    *   Lists generated terms (Project Period, Validity, USD currency variations) and custom payment terms.
    *   *Custom Payment Terms:* Input is free-text allowed to contain words or numbers (not restricted to numeric days).
*   **Summary Table Card (`.ft-summary-box`):**
    *   **Border Structure:** The outer container `.ft-summary-box` is styled with standard card borders, background, and shadows, with `padding: 0; overflow: hidden; height: 100%`.
    *   **Inner Table (`.ft-summary-table`):** Set to `border: none; box-shadow: none; border-radius: 0; border-collapse: collapse;` to ensure it sits flush with the outer card edges, with no double borders.
    *   **Rows & Cells:**
        *   **Subtotal:** Standard display (`fmtNum` with `₹` symbol).
        *   **Discount:** Rendered only if greater than `0`.
        *   **GST Labels (CGST, SGST, IGST):** Labels are derived dynamically depending on the selected tax logic (e.g., CGST/SGST for intra-state supply, IGST for inter-state supply). **The tax percentage (%) suffix is hidden from all labels** (e.g., displays `CGST` and `SGST` or `IGST` without percentages).
        *   **Grand Total:** Grand total row highlighted with a soft blue background (`#f0f4ff`), bold font-size `14px`, and color `--brand`.
        *   **Amount in Words:** Placed below the grand total row, spans `colspan="2"`, aligned to the right, italicized (`color: #64748b`, font-size `10px`). Uses **no top border line** to prevent inner box division.

### B. Row 2: Important Notes (Left) & Bank Details (Right)
*   **Notes Box:** Outlines material BoQ conditions, delays, and civil work exclusions in small text.
*   **Bank Details Box:** Lists Company Name, Bank Name, Account Number, IFSC Code, and Branch. Values are styled as bold text.

---

## 6. Footer Group (Executive & Branches)

The footer is designed to reside at the bottom of the page.

### A. Executive Bar (`.ft-footer` / `.ft`)
*   Border: `2px solid #1D3A8A !important`, and `box-shadow: 0 4px 14px rgba(29,58,138,0.20) !important` to distinguish the executive bar.
*   Content: Displays `Executive: {Name}  |  PH: {Phone}  |  Email: {Email}` formatted horizontally.

### B. Our Branches Box (`.branches-box`)
*   Contains contact locations and GSTIN numbers for Coimbatore, Bangalore, and Chennai.
*   If a specific branch is selected as the supplier, that branch is omitted from the branches box to avoid redundancy (only "Other Branches" are displayed).
*   Border: `2px solid #1D3A8A !important` to match the executive bar styling.

---

## 7. Pagination & Print Mechanics

Multi-page PDF generation uses Puppeteer to render a self-contained HTML layout.

*   **Fixed Elements:** The watermark (`wm-print`) and header (`print-header-fixed`) are configured to repeat dynamically on every page of a printed or exported PDF document via CSS `position: fixed`.
*   **Screen vs Print Hide Rules:**
    *   `.screen-header` is hidden during print using `display: none !important;` to prevent duplicate headers on the first page.
    *   The `thead` print repeating rule `thead { display: table-header-group; }` is retained for table headers, but `.screen-header` top bars are prevented from duplicating on page 2.
*   **Page Break Rules:** Elements like table rows (`tr`), card boxes (`.ft-bank-box`, `.ft-notes-box`, `.box`, `.ft-summary-box`), and branch boxes are styled with `page-break-inside: avoid; break-inside: avoid;` to keep them from breaking across pages.
