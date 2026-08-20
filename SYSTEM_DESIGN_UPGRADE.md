# SOCIA CLINIC (HMS) — FULL SYSTEM DESIGN & UPGRADE BLUEPRINT
### From Current Codebase to a Fully Working, Enterprise-Grade Hospital Management System
**Prepared for:** SOCIA Technologies Private Limited (Founder & CEO: Ananth / Alex)
**Subject repo:** `socia-clinic` (Vite + React 18 + TypeScript + shadcn/ui + Supabase)
**Document type:** System design + gap analysis + module-by-module upgrade plan
**Status:** Working prototype → target: production-grade multi-tenant HMS

---

## HOW TO READ THIS DOCUMENT

This is not a rewrite from scratch. The codebase already uploaded (`socia-clinic.zip`) is a real,
substantially-built product — not a mockup. It has 66 route pages, 93+ components, 15 SQL migrations,
role-based dashboards for 19 roles, multi-tenant subdomain routing, and a working Supabase backend.
This document audits what is **already there**, identifies exactly what is **missing, weak, or
half-built**, and lays out a complete, sequenced plan to take it to a **fully working, sellable,
audit-ready Hospital/Clinic Management System**.

Every section follows the same pattern:
1. **What exists today** (from direct inspection of the code/schema)
2. **What's missing or risky**
3. **Exact upgrade tasks** (files to add/change, tables to create, checks to run)

Use this alongside the existing `SOCIA_CLINIC_BLUEPRINT.md` (already in the repo, ~1,461 lines,
version 5.0) — that file is the aspirational 30-part architecture reference. This document is the
**delta/execution plan**: it tells you specifically what to do *next*, in what order, and why.

---

## TABLE OF CONTENTS

1. Executive Summary & Verdict
2. Current State Audit (Codebase Forensics)
3. Architecture As-Built vs. Architecture Required
4. Full Module Inventory: Built / Partial / Missing
5. Database Schema Audit
6. RBAC & Permission System Audit
7. Security, Privacy & Compliance Gap Analysis
8. Testing, QA & Reliability Gap Analysis
9. DevOps, CI/CD & Environment Gap Analysis
10. Observability & Monitoring Gap Analysis
11. Module-by-Module Upgrade Specification (22 modules)
12. New Database Migrations Required (full list, ordered)
13. New Edge Functions / Backend Services Required
14. Third-Party Integration Ecosystem Plan
15. Frontend Architecture Upgrades
16. Real-Time & Offline Architecture Upgrades
17. Performance & Scalability Plan
18. Disaster Recovery & Business Continuity Plan
19. Mobile & PWA Strategy
20. AI/ML Roadmap
21. Compliance Program (HIPAA / DPDPA / NABH / SOC2)
22. Testing Strategy (Full Pyramid)
23. CI/CD Pipeline Design
24. Phased Delivery Roadmap (Sprint-by-Sprint)
25. Risk Register
26. Definition of Done — "Fully Working" Checklist
27. Appendix A — Full Route/Page Inventory
28. Appendix B — Full Permission Matrix
29. Appendix C — Environment Variables Reference
30. Appendix D — Glossary

---

## 1. EXECUTIVE SUMMARY & VERDICT

### 1.1 What this product is right now

Socia Clinic ("SOCIA Clinic Pharmacy Pro+") is a **multi-tenant, multi-branch clinic/hospital
management SPA** built on:

- **Frontend:** Vite 5, React 18, TypeScript 5 (strict), shadcn/ui (Radix primitives), Tailwind CSS,
  React Router 6, TanStack React Query, React Hook Form + Zod, Recharts, Framer Motion.
- **Backend:** Supabase (PostgreSQL + Auth + Row-Level Security + Realtime + Edge Functions + Storage).
- **Deployment target:** Vercel, with SPA rewrites and wildcard-subdomain, multi-tenant hostname
  resolution already implemented (`src/lib/tenant-host.ts`, `resolve_host` RPC).
- **Domain coverage:** Patients, appointments, consultations, treatments, pharmacy, lab, bed
  management, billing, HR/payroll, emergency triage, insurance claims, notifications, audit log,
  staff onboarding & invitations, branch/tenant management, custom domains.

This is a **credible v1/v2 product**, not a toy. The gap between "demo" and "production-grade,
sellable-to-a-real-hospital HMS" is real but well-defined and closeable. The biggest risks are not
in the clinical feature surface (which is broad) — they are in **testing (zero automated tests),
CI/CD (none), compliance hardening (RLS coverage unverified, audit trail incomplete), and
interoperability (no HL7/FHIR, no payment gateway, no real messaging channel)**.

### 1.2 Verdict by category

| Category | Maturity | Notes |
|---|---|---|
| Core clinical workflows (patients, OPD, consultation, treatments) | 🟢 Strong | Interconnected, real-time, click-through navigation already wired |
| Pharmacy & dispensing | 🟡 Good MVP | No batch/expiry tracking, no reorder automation, no vendor management |
| Lab (LIS) | 🟡 Good MVP | No analyzer integration, no barcode sample tracking, no QC module |
| Billing & Insurance | 🟡 Partial | Insurance claims table exists but thin; no real payment gateway; no GST/tax engine |
| Bed/IPD management | 🟢 Strong | Ward/bed CRUD, occupancy, admission/discharge workflow present |
| Multi-tenancy | 🟢 Strong | Subdomain + custom domain resolution, tenant/branch isolation designed in |
| RBAC | 🟢 Strong | 19 roles, capability-based permissions, single source of truth file |
| Security / Compliance | 🔴 Weak | No verified RLS coverage report, no encryption-at-rest strategy doc, no consent management, no immutable audit chain |
| Testing | 🔴 Absent | Zero test files found in repo |
| CI/CD | 🔴 Absent | No `.github/workflows`, no pipeline config found |
| Observability | 🔴 Absent | No Sentry/monitoring SDK, no structured logging, no metrics |
| Interoperability (HL7/FHIR/DICOM) | 🔴 Absent | Not started — expected, this is normally phase 3+ |
| Payments | 🔴 Absent | No Razorpay/Stripe/PayU integration in codebase |
| Messaging (SMS/WhatsApp) | 🔴 Absent | Notifications table exists (in-app only); no outbound channel wired |
| Telemedicine | 🔴 Absent | No video/WebRTC module |
| AI/ML layer | 🔴 Absent | Planned in blueprint doc only |
| Mobile / offline | 🔴 Absent | PWA manifest + service worker present but no offline data queue |

### 1.3 The one-sentence plan

**Freeze new feature sprawl for 2 sprints, harden what exists (RLS, tests, CI, audit trail,
error boundaries), then expand outward module-by-module in the priority order defined in Section 24,
closing with interoperability, payments, and AI/ML.**

---

## 2. CURRENT STATE AUDIT (CODEBASE FORENSICS)

This section is a factual inventory produced by directly inspecting the uploaded archive.

### 2.1 Repository shape

```
socia-clinic/
├── .env                          → Supabase project id / anon key / platform domains
├── .opencode/plans/               → prior agent planning docs (hms-new.md, role-dashboards-reports-billing.md)
├── PRODUCT.md                     → brand/product one-pager
├── SOCIA_CLINIC_BLUEPRINT.md      → 1,461-line, 30-part aspirational architecture doc (v5.0)
├── SUBDOMAINS.md                  → multi-tenant hostname routing runbook
├── UIUX.md                        → design system / UI guidelines
├── summary.md                     → session log of a prior refactor (4 clinical pages rewritten)
├── dist/                          → a committed production build (should NOT be in git — see §9)
├── public/                        → manifest.json, sw.js (service worker), favicon, robots.txt
├── src/
│   ├── components/                → 93+ .tsx components across auth, branches, common, dashboard,
│   │                                 employee, forms, landing, layout, patients, reports, setup, staff, ui/
│   ├── config/                    → navigation.ts (role→menu map), permissions.ts (capability RBAC)
│   ├── hooks/                     → use-mobile, use-toast, useClinicStats, useNotifications, useRealtimeReload
│   ├── integrations/supabase/     → client.ts, types.ts (generated DB types)
│   ├── lib/                       → branches, crypto-utils, dashboard, demo-clinic, hms-store,
│   │                                 invitations, notifications, operations, patient-events, staff, tenant-host, utils
│   ├── pages/                     → 66 route-level pages (see Appendix A)
│   └── types/billing.ts
├── supabase/
│   ├── config.toml
│   ├── functions/                 → admin-create-user, send-invite, verify-domain (3 edge functions only)
│   └── migrations/                → 15 SQL migration files, ~3,000 lines total
├── package.json / bun.lock(b) / package-lock.json  → dual lockfiles present (bun + npm) — pick one
├── vercel.json, vite.config.ts, tailwind.config.ts, tsconfig*.json, eslint.config.js
```

### 2.2 Key forensic findings

- **No test files anywhere** (`*.test.*`, `*.spec.*` — zero matches). Every workflow (billing math,
  bed occupancy transitions, RBAC checks, RLS policies) is currently unverified by automation.
- **No CI/CD config** (no `.github/workflows/*.yml`, no `.gitlab-ci.yml`, no Vercel-side test gate
  visible in-repo). Merges to `main` are not gated by lint/build/test.
- **54 files** contain `TODO`, `FIXME`, `mock`, `dummy`, or `placeholder` markers — these are the
  first places to sweep during hardening (Section 9 has the process).
- **Two lockfiles** (`bun.lock`/`bun.lockb` and `package-lock.json`) — dependency resolution is
  ambiguous between Bun and npm; this **will** cause "works on my machine" bugs and must be resolved
  to a single package manager before scaling the team.
- **`dist/` is committed** to the repo — build artifacts should never be version-controlled; this
  bloats the repo and risks shipping stale bundles.
- **Only 3 Supabase Edge Functions** exist (`admin-create-user`, `send-invite`, `verify-domain`).
  Everything else — billing calculations, notification fan-out, report generation, claim
  submission — currently happens client-side, which is both a **security risk** (business logic
  and secrets exposed to the browser) and a **compliance risk** (PHI-touching logic without a
  server-side audit boundary).
- **`.env` is present in the zip** — confirms Supabase URL/anon key are already exposed to git
  history at least once. Anon keys are meant to be public (RLS should protect data), but this must
  be verified, not assumed (see Section 6).

### 2.3 Tech stack summary (from `package.json`)

| Layer | Choice | Assessment |
|---|---|---|
| Build tool | Vite 5 + SWC | ✅ Modern, fast — keep |
| UI kit | shadcn/ui (Radix + Tailwind) | ✅ Good — accessible primitives, matches PRODUCT.md's "clinical restraint" brand |
| State/data | TanStack React Query 5 | ✅ Good choice for server-state caching |
| Forms | react-hook-form + zod | ✅ Good — keep as the standard for all new forms |
| Routing | react-router-dom 6 | ✅ Fine for SPA scale reached so far |
| Realtime | Supabase Realtime (Postgres logical replication) | ✅ Appropriate for this scale |
| Charts | Recharts | ✅ Sufficient for MIS dashboards |
| QR | qrcode.react + @zxing/library + react-qr-scanner | ✅ Supports patient ID / sample barcode workflows |
| Backend | Supabase (BaaS) | 🟡 Good for velocity; will need a thin server layer (Edge Functions) for anything touching money, PHI export, or third-party APIs |
| No dedicated backend framework (Express/Nest/Fastify) | — | Acceptable at current scale; Section 13 defines where server-side logic must live regardless |

---

## 3. ARCHITECTURE AS-BUILT VS. ARCHITECTURE REQUIRED

### 3.1 As-built (today)

```
Browser (React SPA)
   │  reads/writes directly via supabase-js
   ▼
Supabase Postgres  ── RLS policies gate all access
   │
   ├── Supabase Auth (JWT, roles in a custom claim / profile table)
   ├── Supabase Realtime (logical replication → WebSocket)
   ├── Supabase Storage (implied, for documents — not yet wired to a bucket policy audit)
   └── 3 Edge Functions (admin-create-user, send-invite, verify-domain)
```

This is a **"thick client, thin backend"** design. It is legitimate and scales further than people
assume — but it puts enormous weight on RLS policies being airtight, because the browser has direct
SQL-level access. Any missing `WHERE clinic_id = ...` policy is a full tenant data breach, not a bug.

### 3.2 Architecture required for "fully working, enterprise-ready"

```
Browser (React SPA, PWA-capable, offline queue for critical actions)
   │
   ├── Direct Supabase access (read-mostly, RLS-protected) — patients, appointments, dashboards
   │
   └── Edge Function API layer (write-path for money/PHI-export/3rd-party) ──────────────┐
                                                                                            │
Supabase Postgres (RLS everywhere) ◄── triggers ──► Event outbox table ──► Queue worker ──►│
   │                                                                                        │
   ├── Auth (JWT + MFA for staff roles)                                                    │
   ├── Realtime (WebSocket fan-out)                                                        │
   ├── Storage (bucket-level RLS, signed URLs, virus scan on upload)                        │
   └── Scheduled Functions (cron: reminders, expiry checks, backups verification)          │
                                                                                            ▼
                                                                        External Integration Layer
                                                                        ├── Payment gateway (Razorpay/Stripe)
                                                                        ├── SMS/WhatsApp (MSG91/Gupshup/Twilio)
                                                                        ├── Email (SES/SendGrid, DKIM/SPF/DMARC)
                                                                        ├── HL7/FHIR gateway (labs, insurers)
                                                                        ├── DICOM viewer (licensed, not built)
                                                                        └── Observability (Sentry, Logflare/Datadog)
```

The core architectural shift needed is: **anything that (a) moves money, (b) exports/prints PHI,
(c) calls a third party, or (d) needs to be provably tamper-proof for audit — must go through an
Edge Function, never straight from the browser to the table.** Everything else (read-heavy
dashboards, live status boards) can and should stay direct-to-Postgres via RLS, because that's
where Supabase's realtime and caching story shines.


## 4. FULL MODULE INVENTORY: BUILT / PARTIAL / MISSING

Mapped against the full HMS umbrella (HIS, EMR, LIS, RIS/PACS, PIS, Blood Bank, OT, Ambulance,
Telemedicine, HR/Payroll, Insurance/TPA, Nursing, Dietary, Biomedical Asset Mgmt) so nothing is
missed. Status legend: 🟢 Built & working · 🟡 Partially built · 🔴 Not started.

### 4.1 Patient Registration & Front Desk

| Feature | Status | Evidence / Gap |
|---|---|---|
| Patient registration (new/returning) | 🟢 | `PatientForm.tsx`, `PatientHub.tsx`/`PatientHubSupabase.tsx` |
| UHID generation | 🟡 | Needs a verified, collision-proof, tenant-scoped ID generator (see §11.1) |
| Appointment scheduling | 🟢 | `Appointments.tsx` / `AppointmentsSupabase.tsx`, realtime migration `20260622130000_realtime_appointments_beds.sql` |
| Online/patient self-booking | 🟡 | `PatientPortal.tsx`, `PatientSignup.tsx` exist; needs slot-locking to prevent double-book race conditions |
| Token/queue management | 🟡 | `QueueDisplay.tsx` exists; needs a public, unauthenticated read-only screen mode for waiting-room TVs |
| MPI / duplicate merge | 🔴 | No "merge patient" workflow found — high priority, prevents fragmented records |
| Document upload (ID/insurance) | 🔴 | No Storage bucket wiring visible for patient documents |

### 4.2 OPD (Outpatient) Management

| Feature | Status | Evidence / Gap |
|---|---|---|
| Doctor consultation workflow | 🟢 | `Consultation.tsx` / `ConsultationSupabase.tsx` |
| Vitals capture | 🟢 | Referenced in patient timeline / nurse dashboard |
| E-prescription generation | 🟡 | Prescriptions exist as DB records; no print-ready, digitally-signed PDF prescription yet |
| OPD billing integration | 🟡 | `Billing.tsx`/`BillingSupabase.tsx`, `BillingForm.tsx` family exist; tax/discount engine thin |
| Queue/waiting-time display | 🟡 | See Queue above |

### 4.3 IPD (Inpatient) Management

| Feature | Status | Evidence / Gap |
|---|---|---|
| Bed management (ward/ICU/room) | 🟢 | `BedManagement.tsx`, `EnhancedBedManagement.tsx`, ward/bed CRUD, occupancy % |
| ADT (Admit/Discharge/Transfer) | 🟢 | Admission/discharge/cleaning/maintenance states present |
| Nursing charting / MAR | 🟡 | `NurseDashboard.tsx` exists; no explicit Medication Administration Record table found in migrations |
| Doctor rounds / progress notes | 🔴 | Not found as a distinct entity |
| Discharge summary generation | 🔴 | No PDF/document generator found |
| Bed occupancy dashboard | 🟢 | Live stats cards present |
| IPD package billing | 🔴 | Only itemized billing evident; no package/scheme pricing engine |

### 4.4 EMR/EHR

| Feature | Status | Evidence / Gap |
|---|---|---|
| Longitudinal patient history | 🟢 | `PatientTimeline.tsx`, `PatientHistory.tsx`/`Supabase.tsx` |
| Diagnosis coding (ICD-10/11) | 🔴 | No coded-diagnosis field/table found — currently likely free text |
| Clinical notes / SOAP templates | 🟡 | Consultation notes exist; no structured SOAP template system |
| Allergy & medication history | 🔴 | Not found as a first-class table — critical patient-safety gap |
| Clinical decision support (drug interaction/allergy alerts) | 🔴 | Not started |
| Consent forms & e-signature | 🔴 | Not found |
| Referral management | 🟡 | `CareTeam.tsx` + `care_team` migration suggests partial support |

### 4.5 Laboratory (LIS)

| Feature | Status | Evidence / Gap |
|---|---|---|
| Test order entry | 🟢 | `Lab.tsx`, 5-status workflow (Ordered→Collected→Processing→Completed→Reviewed) |
| Sample barcode tracking | 🔴 | QR/barcode libs are in `package.json` (`@zxing/library`, `qrcode.react`) but not yet wired into Lab specimen flow |
| Analyzer/machine integration (HL7) | 🔴 | Not started (expected — phase 3+) |
| Result verification workflow | 🟢 | "Review & Verify" tab exists |
| Reference-range abnormal flagging | 🔴 | Not found |
| Lab inventory (reagents) | 🔴 | Not found |
| QC tracking | 🔴 | Not found |

### 4.6 Radiology (RIS/PACS)

| Feature | Status | Evidence / Gap |
|---|---|---|
| Imaging order management | 🟡 | `RadiologyDashboard.tsx` exists as a role dashboard shell |
| DICOM viewer | 🔴 | Not started — **recommendation: license, don't build** (see §14.5) |
| Radiologist reporting | 🔴 | Not found |

### 4.7 Pharmacy (PIS)

| Feature | Status | Evidence / Gap |
|---|---|---|
| Drug inventory | 🟢 | `Pharmacy.tsx`/`PharmacySupabase.tsx`, `MedicineForm.tsx`, `PharmacyControl.tsx` |
| Batch/expiry tracking | 🔴 | No batch/lot number or expiry date field evidenced |
| E-prescription auto-routing | 🟢 | "Prescriptions" tab pulls pending Rx from consultations |
| Dispensing workflow | 🟢 | Pending→Dispensed→Delivered/Not Given/Missed via `dispenses` table |
| Stock reorder alerts | 🔴 | Not found |
| Narcotic/controlled-substance tracking | 🔴 | Not found — regulatory requirement in most jurisdictions |
| Vendor/supplier management | 🔴 | Not found |

### 4.8 Billing & Revenue Cycle

| Feature | Status | Evidence / Gap |
|---|---|---|
| OPD/IPD consolidated billing | 🟡 | Multiple billing form variants (`BillingForm`, `EnhancedBillingForm`, `ResponsiveBillingForm`) — signals iteration/duplication, needs consolidation |
| Package/scheme billing | 🔴 | Not found |
| Insurance/TPA claims | 🟡 | `20260526155322_insurance_claims.sql` (only 40 lines — a stub, not a full claims lifecycle) |
| Payment gateway | 🔴 | No Razorpay/Stripe/PayU SDK in `package.json` |
| Discount/waiver approval workflow | 🔴 | Not found |
| Revenue leakage detection | 🔴 | Not found |

### 4.9 Insurance & TPA

| Feature | Status | Evidence / Gap |
|---|---|---|
| Eligibility verification | 🔴 | Not found |
| Pre-authorization tracking | 🔴 | Not found |
| Claim submission/status | 🟡 | Basic claims table only |
| Denial management | 🔴 | Not found |

### 4.10 OT (Operation Theatre) Management — 🔴 Not started
No OT scheduling, consent, anesthesia record, or utilization dashboard found anywhere in `src/pages`
or migrations. This is a full net-new module (see §11.11).

### 4.11 Blood Bank Management — 🔴 Not started
No donor, blood-inventory, or cross-match tables found. Full net-new module (see §11.12).

### 4.12 Nursing & Ward Management

| Feature | Status | Evidence / Gap |
|---|---|---|
| Nurse dashboard | 🟢 | `NurseDashboard.tsx` |
| MAR (medication administration record) | 🔴 | Not found as distinct table |
| Shift handover notes | 🔴 | Not found |
| Duty roster | 🟡 | `AddStaffWizard.tsx` + staff-onboarding migration touch scheduling loosely; no dedicated roster table |

### 4.13 Emergency & Ambulance

| Feature | Status | Evidence / Gap |
|---|---|---|
| Emergency triage | 🟢 | `EmergencyDashboard.tsx` + `20260627130000_emergency_triage.sql` migration |
| Ambulance GPS tracking/dispatch | 🔴 | Not started |
| Emergency bed live availability | 🟡 | Overlaps with general bed management |

### 4.14 Telemedicine — 🔴 Not started
No WebRTC/video SDK dependency found. Full net-new module (see §11.15).

### 4.15 HR & Staff Management

| Feature | Status | Evidence / Gap |
|---|---|---|
| Staff directory & onboarding | 🟢 | `StaffManagement.tsx`, `AddStaffWizard.tsx`, `StaffCard.tsx`, staff-onboarding migration |
| Invitations & approvals | 🟢 | `InviteAccept.tsx`, `PendingApproval.tsx`, `invitations_approvals` migration |
| Payroll | 🟡 | `Payroll.tsx`/`PayrollSupabase.tsx` exist as pages — depth of computation (statutory deductions, PF/ESI/TDS for India) unverified |
| Duty roster / on-call | 🔴 | Not found |
| Credentialing/license expiry alerts | 🔴 | Not found |
| Biometric attendance | 🔴 | Not found (would need a hardware integration layer) |

### 4.16 Inventory & Biomedical Asset Management — 🔴 Not started (beyond pharmacy stock)
No non-pharmacy asset/equipment tracking, preventive maintenance, or calibration log tables found.

### 4.17 Patient Engagement / Portal

| Feature | Status | Evidence / Gap |
|---|---|---|
| Patient portal (appointments/reports/bills) | 🟡 | `PatientPortal.tsx`, `PatientDashboard.tsx`/`Supabase.tsx` exist |
| Reminders (SMS/WhatsApp) | 🔴 | In-app notifications only (`useNotifications.ts`, notifications migration) — no outbound channel |
| Feedback/satisfaction survey | 🔴 | Not found |
| Family-linked accounts | 🔴 | Not found |

### 4.18 Analytics & Reporting

| Feature | Status | Evidence / Gap |
|---|---|---|
| Role dashboards with stats | 🟢 | `StatsOverview.tsx`, `useClinicStats.ts`, per-role dashboards (Doctor/Finance/HR/Records/Security/Housekeeping) |
| Accounting reports | 🟡 | `AccountingReports.tsx`/`EnhancedAccountingReports.tsx` — depth vs. real GL/ledger unclear |
| Custom MIS dashboards | 🟡 | Framework (Recharts + StatCard) exists; specific enterprise KPIs (readmission rate, doctor-wise revenue) not confirmed |
| Export (PDF/CSV) | 🟡 | `ExportButtons.tsx` exists — verify formats cover audit needs |

### 4.19 Compliance & Regulatory — 🔴 Largely not started
`AuditLog.tsx` + audit-related pieces exist (🟡), but: no immutable/append-only audit chain verified,
no consent-management module, no data-retention policy enforcement, no NABH/JCI documentation
support, no birth/death registration reporting.

### 4.20 AI/ML Layer — 🔴 Not started (only referenced in the blueprint doc)

### 4.21 Enterprise/Platform-Level Features

| Feature | Status | Evidence / Gap |
|---|---|---|
| RBAC | 🟢 | Strong — `permissions.ts` capability model, 19 roles |
| Multi-branch/tenant architecture | 🟢 | `BranchManager.tsx`, `TenantDashboard.tsx`, multitenancy migration, MPI not centralized yet |
| Subdomain/custom-domain routing | 🟢 | Fully designed (`SUBDOMAINS.md`) with DNS-TXT verification edge function |
| HL7/FHIR interoperability | 🔴 | Not started |
| DICOM support | 🔴 | Not started |
| API-first architecture for 3rd parties | 🔴 | No public API surface / API keys system found |
| PHI access audit logs (who viewed what) | 🟡 | `AuditLog.tsx` exists; needs verification it logs **reads**, not just writes |
| High availability / zero-downtime | 🟡 | Inherited from Supabase/Vercel SLAs — no app-level HA runbook |
| Offline-capable modules | 🔴 | Service worker present (`sw.js`) but no IndexedDB write-queue for critical actions |
| Disaster recovery | 🔴 | No documented RPO/RTO or backup-restore drill |
| Immutable audit trail | 🔴 | Not verified — see §7.4 |

### 4.22 Integration Ecosystem

| Integration | Status |
|---|---|
| Insurance/TPA systems | 🔴 |
| Government health registries | 🔴 |
| Lab analyzers (HL7) | 🔴 |
| Radiology (DICOM) | 🔴 |
| Pharmacy supply chain | 🔴 |
| Payment gateways | 🔴 |
| SMS/WhatsApp/Email | 🔴 (in-app notifications only) |
| Biomedical devices | 🔴 |
| Accounting/ERP export | 🟡 (report export exists; no direct Tally/Zoho Books connector) |
| Telemedicine video infra | 🔴 |


## 5. DATABASE SCHEMA AUDIT

### 5.1 Migration timeline (as found)

| File | Lines | Purpose |
|---|---|---|
| `20260428110712_...initial.sql` | 717 | Core schema: patients, appointments, encounters, prescriptions, dispenses, beds, employees, etc. |
| `20260526155322_insurance_claims.sql` | 40 | Stub insurance claims table |
| `20260620090000_notifications_foundation.sql` | 345 | Notification infrastructure |
| `20260621000000_treatments.sql` | 65 | Treatments table + status enum |
| `20260622120000_invitations_approvals.sql` | 147 | Staff invitation + approval workflow |
| `20260622130000_realtime_appointments_beds.sql` | 21 | Enables Postgres realtime publication on appointments/beds |
| `20260622140000_care_team.sql` | 26 | Care-team linkage table |
| `20260622150000_staff_onboarding.sql` | 260 | Staff roles, onboarding steps |
| `20260622160000_multitenancy.sql` | 238 | Tenants, branches, tenant_id columns retrofitted |
| `20260622170000_patient_events.sql` | 45 | `logPatientEvent()` audit-style event table |
| `20260627000000_enterprise_hms_phase2.sql` | 644 | Large "phase 2" expansion — largest single migration after the initial schema |
| `20260627100000_subdomain_routing.sql` | 183 | Subdomain resolution support (`resolve_host`) |
| `20260627110000_tenant_isolation_and_domain_verify.sql` | 93 | Tenant isolation hardening + domain verification |
| `20260627120000_operational_modules.sql` | 130 | Additional operational tables |
| `20260627130000_emergency_triage.sql` | 46 | Emergency triage table |

**Total: ~3,000 lines of SQL across 15 migrations.** This is a healthy, incrementally-evolved
schema — the naming convention (`YYYYMMDDHHMMSS_description.sql`) is correct and should be kept.

### 5.2 Schema strengths

- **Retrofit-safe multi-tenancy**: `multitenancy.sql` and `tenant_isolation_and_domain_verify.sql`
  show the team correctly went back and added `tenant_id`/`branch_id` isolation *after* the initial
  schema, rather than bolting it on with app-level filtering only — this is the right instinct.
- **Realtime is deliberately scoped**: `realtime_appointments_beds.sql` enables logical replication
  only on specific tables, not blanket — good for performance and reduces the realtime attack surface.
- **Event-sourcing seed already present**: `patient_events.sql` + `logPatientEvent()` is the correct
  foundation for an audit trail — it just needs to be extended to cover *every* PHI-touching mutation,
  not only admissions/discharges (see §7.4).

### 5.3 Schema gaps to close (ordered by risk)

1. **No verified RLS policy coverage report.** With 15 migrations touching dozens of tables, there is
   no single source of truth confirming every table has `ENABLE ROW LEVEL SECURITY` plus a
   `tenant_id = current_tenant()` policy. **Action:** write a SQL introspection script
   (`SELECT relname FROM pg_class WHERE relrowsecurity = false AND relkind='r'`) and run it in CI on
   every migration (see §12.1, §23).
2. **No allergy/medication-history/diagnosis-coding tables** — flagged in §4.4, this is a patient
   safety gap, not just a feature gap.
3. **No MAR (medication administration record)** table distinct from `dispenses` — dispensing from
   pharmacy ≠ administering to an inpatient; conflating them is a clinical documentation risk.
4. **No document/attachment table with Storage bucket policy** for ID proofs, insurance cards,
   discharge summaries, signed consents.
5. **No append-only audit log at the database trigger level** — see §7.4 for the specific
   `audit_log` table design with `INSERT`-only permissions and a hash-chain column.
6. **No soft-delete / retention-policy columns** (`deleted_at`, `retention_until`) on PHI tables —
   needed for both "undo" safety and regulatory retention/erasure rules.
7. **No `idempotency_key` columns** on billing/payment tables — required once a payment gateway is
   wired in, to make webhook retries safe.


## 6. RBAC & PERMISSION SYSTEM AUDIT

### 6.1 What's there

`src/config/permissions.ts` is a well-designed **capability-based** RBAC system (not just role
checks) — permissions follow a clean `<module>.<action>` naming convention (`patients.edit`,
`billing.manage`, `lab.review`, etc.), with a single `ALL_PERMISSIONS` source of truth and
(implied) a `roleCan()` resolver plus `usePermissions()` hook and `<Can>` / `<AccessGuard>`
components for consistent enforcement across pages. `src/config/navigation.ts` maps 19 roles
(`super_admin` → `patient`) to their landing dashboards and visible menu items.

This is genuinely above-average design for a project at this stage — most teams don't reach
capability-based RBAC until much later. **Keep this pattern; extend it, don't replace it.**

### 6.2 Gaps

1. **Client-side-only enforcement is a display concern, not a security boundary.** `permissions.ts`
   correctly gates *navigation and UI*, but the real security boundary must be **Postgres RLS
   policies mirroring the same capability list**. **Action:** generate RLS policies from the same
   permission taxonomy (or at minimum, write a test suite — §22 — that attempts every
   `<module>.<action>` from every role directly against Supabase and asserts pass/fail matches
   `permissions.ts`).
2. **No MFA for privileged roles.** `super_admin`, `tenant_admin`, `doctor`, `pharmacist`,
   `billing_officer` should require TOTP/WebAuthn MFA — Supabase Auth supports this natively
   (`enroll` MFA factors) but nothing in the codebase wires it up yet.
3. **No session/permission caching invalidation strategy documented** — when an admin changes a
   staff member's role mid-session, does their JWT/claims refresh immediately or only on next
   login? Needs an explicit answer (recommend: short-lived JWT + refresh-on-permission-change via
   a `role_version` claim bumped on every role change).
4. **No "break-glass" emergency access audit** — in real hospitals, a doctor must sometimes access
   a patient outside their normal care-team assignment (emergency). This needs an explicit,
   logged, justified override flow — not silently permitted, not silently blocked.

---

## 7. SECURITY, PRIVACY & COMPLIANCE GAP ANALYSIS

### 7.1 Data classification

Every table should be classified before hardening begins:
- **PHI (Protected Health Information):** patients, encounters, prescriptions, lab results,
  vitals, treatments, bed admissions, insurance claims.
- **PII (non-clinical personal data):** staff records, payroll, employee documents.
- **Operational/non-sensitive:** ward/bed definitions, medicine catalog (without pricing), tenant
  branding config.

This classification should live as a comment/tag on every migration going forward and drives
retention, encryption, and audit-logging requirements below.

### 7.2 Encryption

- **At rest:** Supabase/Postgres encrypts at rest by default at the infrastructure level — confirm
  this is enabled on the actual project tier being used, and additionally field-level-encrypt the
  highest-sensitivity columns (SSN/Aadhaar-equivalent ID numbers, if collected) using
  `pgcrypto` (`pgp_sym_encrypt`), not application-layer AES with keys in `.env`.
- **In transit:** TLS is inherited from Supabase/Vercel — verify no mixed-content or HTTP fallback
  paths exist (audit `vercel.json` headers for HSTS).
- **`src/lib/crypto-utils.ts` already exists** — audit it: confirm it is *not* being used to
  encrypt PHI client-side with a key that's also shipped to the client (a common anti-pattern that
  provides zero real protection). If it's just for QR payload signing, that's fine — but this must
  be verified, not assumed.

### 7.3 Consent & data subject rights

- No consent-capture table/flow found. Add `consents` table: `patient_id, consent_type
  (treatment/data_sharing/marketing/telemedicine), granted_at, revoked_at, document_ref, version`.
- No "right to access / right to erasure" self-service flow for patients (required under
  India's DPDPA 2023 and, if serving any EU patients, GDPR). Add a patient-portal "Download my
  data" (structured export) and a tenant-admin-mediated "Request erasure" workflow (full erasure
  is rarely legal for clinical records due to retention law — implement as anonymization after the
  statutory retention period, not deletion).

### 7.4 Audit trail — the single highest-priority compliance gap

Current state: `AuditLog.tsx` + `logPatientEvent()` exist but coverage is unverified and there is
no tamper-evidence.

**Required design:**
```sql
create table audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  tenant_id uuid not null,
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,           -- e.g. 'patient.view', 'prescription.create'
  resource_type text not null,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  before_hash text,               -- sha256 of previous row state (for updates)
  after_hash text,                -- sha256 of new row state
  chain_hash text not null        -- sha256(previous chain_hash || this row's canonical json)
);
revoke update, delete on audit_log from all;  -- append-only, enforced at DB grant level
```
Every PHI table gets an `AFTER INSERT/UPDATE/DELETE` trigger writing to `audit_log`. Critically,
**reads of individual patient records must also be logged** for HIPAA-style "who viewed this
chart" reporting — this typically means routing single-patient-record fetches through an Edge
Function (or a Postgres function called via RPC) rather than a raw `select *` from the browser,
specifically so the read event can be logged before the row is returned.

### 7.5 Compliance framework mapping

| Framework | Applicability | Current readiness |
|---|---|---|
| HIPAA (if serving US patients/partners) | Conditional | 🔴 Not ready — no BAA process, audit trail incomplete |
| DPDPA 2023 (India — primary jurisdiction given Coimbatore/Tamil Nadu base) | **Primary, required** | 🔴 Not ready — no consent module, no data-fiduciary registration process documented |
| NABH (Indian hospital accreditation) | Recommended for credibility with hospital clients | 🔴 Not started |
| SOC 2 (needed to sell to larger hospital chains/enterprise) | Future | 🔴 Not started — but architecture choices now (audit log, RLS, MFA) directly feed a future SOC2 readiness assessment |
| PCI-DSS (once payment gateway is added) | Required at that point | 🔴 N/A yet — mitigate by using gateway-hosted checkout/tokenization (Razorpay Checkout, Stripe Elements) so card data never touches Socia's servers |


## 8. TESTING, QA & RELIABILITY GAP ANALYSIS

### 8.1 Current state: zero automated tests

This is the single most urgent non-clinical gap. A hospital system with billing math, bed-state
transitions, dispensing/stock decrements, and RBAC — and no automated tests — means every deploy is
a manual regression risk on systems where mistakes affect patient safety and money.

### 8.2 Required test pyramid (see §22 for full strategy)

- **Unit tests** (Vitest, since Vite is already the build tool): pure functions in `src/lib/*`
  (`operations.ts`, `dashboard.ts`, `branches.ts`, `notifications.ts`) — these are already isolated
  and testable with no refactor needed.
- **Component tests** (React Testing Library + Vitest): forms (`PatientForm`, `BillingForm` family,
  `MedicineForm`) — assert validation rules (Zod schemas) reject bad input.
- **Integration tests against a real (local) Supabase instance**: RBAC enforcement, RLS policies,
  realtime subscription behavior, the four interconnected clinical pages described in `summary.md`.
- **E2E tests** (Playwright): the critical paths — patient registration → appointment → consultation
  → prescription → pharmacy dispense → billing → discharge. This single flow, automated, catches
  more real bugs than any other investment on this list.
- **RLS policy tests**: a dedicated suite that logs in as each of the 19 roles and asserts exactly
  which rows/tables are visible — this is the test suite that actually proves multi-tenant isolation
  holds, rather than hoping it does.

### 8.3 Reliability gaps beyond testing

- **No error boundaries confirmed per-route** — the blueprint doc calls for these; verify each major
  route (`Dashboard`, `Billing`, `Consultation`, etc.) actually wraps in a React Error Boundary that
  reports to a monitoring service rather than white-screening.
- **No retry/backoff wrapper around Supabase calls** — transient network failures during, e.g., a
  bed-status update should retry with backoff, not silently fail.
- **No optimistic-update rollback pattern documented** for React Query mutations — needed so a failed
  write (e.g., discharge) visibly reverts the UI rather than leaving stale "discharged" state showing
  when the write actually failed.

---

## 9. DEVOPS, CI/CD & ENVIRONMENT GAP ANALYSIS

### 9.1 Current state

- No `.github/workflows` or equivalent — every merge to `main` is ungated.
- `dist/` is committed to git — must be removed and added to `.gitignore` (a `.gitignore` file does
  exist; verify `dist/` is actually listed, and if not, add it and purge history if the repo is not
  yet public/shared widely).
- **Dual lockfiles** (`bun.lock`, `bun.lockb`, `package-lock.json`) — pick one package manager
  (recommend **npm** for maximum CI/hosting compatibility, or **bun** if the team is committed to
  its speed — either is fine, but not both) and delete the other lockfile(s).
- No environment separation documented (dev/staging/prod Supabase projects) — confirm three
  separate Supabase projects exist (or will exist) so schema migrations can be tested in staging
  before hitting production PHI.

### 9.2 Required CI/CD pipeline (see §23 for full YAML)

Minimum gate on every PR: `npm ci` → `eslint .` → `tsc --noEmit` → `vitest run` → `vite build` →
(on `main` merge) `playwright test` against a preview deploy → Supabase migration dry-run against a
throwaway branch database → deploy to Vercel.

### 9.3 Secrets management

- `.env` committed in the uploaded zip — confirm this is the **publishable/anon** key only (safe to
  expose given RLS) and that the **service role key** used by Edge Functions is stored only in
  Supabase's function secrets / Vercel environment variables, never in any file that reaches git.
- Add a pre-commit hook (e.g., `gitleaks` or `trufflehog`) to catch future secret leaks before they
  land in history.

---

## 10. OBSERVABILITY & MONITORING GAP ANALYSIS

### 10.1 Current state: none found

No Sentry, Logflare, Datadog, or structured logging SDK in `package.json`. This means today, if a
pharmacist's dispense action silently fails at 2am, nobody finds out until a patient complains.

### 10.2 Minimum viable observability stack

- **Error tracking:** Sentry (React + source maps) — free tier is enough to start. Wire into every
  Error Boundary and every Edge Function.
- **Frontend performance:** Vercel Analytics or Web Vitals reporting to Sentry Performance —
  track Largest Contentful Paint / Time to Interactive per route, since PRODUCT.md explicitly
  states "Performance is a feature."
- **Backend/DB:** Supabase's built-in Postgres logs + a weekly slow-query review; add
  `pg_stat_statements` review to the ops runbook.
- **Uptime:** a simple external uptime monitor (UptimeRobot / Better Uptime) pinging the app and a
  `/health` Edge Function that checks DB connectivity.
- **Business-metric alerting:** a scheduled Edge Function that checks for anomalies (e.g., zero
  appointments booked in the last 4 hours during clinic hours, pharmacy stock hitting zero) and
  notifies via Slack/email — cheap, high-value, and hospital-specific.


## 11. MODULE-BY-MODULE UPGRADE SPECIFICATION

Each module below follows: **Current state → Upgrade tasks → New tables → New/changed components →
Acceptance criteria.**

### 11.1 Patient Registration & MPI

**Current:** `PatientForm.tsx`, `PatientHub(Supabase).tsx` handle create/search; UHID generation
exists but collision-safety across branches is unverified.

**Upgrade tasks:**
- Move UHID generation into a Postgres function (`generate_uhid(tenant_id, branch_id)`) using a
  per-tenant sequence, not a client-generated random string — guarantees uniqueness under concurrency.
- Build a **Master Patient Index (MPI)** duplicate-detection step at registration: fuzzy match on
  name + DOB + phone (Postgres `pg_trgm` extension) and surface "possible duplicate" before creating
  a new record.
- Build a **merge patients** admin tool: re-parents all foreign keys (encounters, prescriptions,
  bills, bed admissions) from a duplicate record to the canonical one inside a single transaction,
  logs the merge to `audit_log`, and soft-deletes the duplicate.
- Add a `patient_documents` table + Supabase Storage bucket (`patient-docs`) with per-tenant RLS
  path prefixes for ID proofs, insurance cards, referral letters.

**New tables:** `patient_documents(id, patient_id, tenant_id, doc_type, storage_path, uploaded_by,
uploaded_at, verified boolean)`.

**Acceptance criteria:** registering a patient with an existing phone+DOB shows a duplicate warning;
merging two patients preserves full history under one UHID with an audit entry.

### 11.2 OPD & Consultation

**Current:** Strong — `Consultation(Supabase).tsx` already interconnects with treatments, lab, and
pharmacy per `summary.md`.

**Upgrade tasks:**
- Add **structured SOAP note templates** per specialization (configurable in `SpecializationsForm.tsx`
  which already exists at setup time) instead of a single free-text field.
- Add **ICD-10/11 diagnosis coding**: a `diagnosis_codes` reference table (seed from the public
  WHO ICD-10 dataset) + a `encounter_diagnoses` join table with a searchable autocomplete component.
- Add a **printable, digitally-stamped e-prescription PDF** (server-side generated via an Edge
  Function using a PDF library, not client-side, so the tenant's letterhead/signature can be applied
  consistently and the artifact is tamper-evident).

**New tables:** `diagnosis_codes(code, description, category)`,
`encounter_diagnoses(encounter_id, diagnosis_code, is_primary)`.

### 11.3 EMR / Clinical Safety Layer

**Current:** History timeline exists; **no allergy or medication-history first-class table** — the
single highest-priority clinical-safety gap in the whole audit.

**Upgrade tasks:**
- Add `patient_allergies(patient_id, allergen, reaction, severity, recorded_by, recorded_at)`.
- Add `patient_medication_history(patient_id, medication, dose, status[active/discontinued],
  started_at, discontinued_at)`.
- Build a **Clinical Decision Support (CDS) check**: before a prescription is saved, run it against
  the patient's allergy list and current medications (start with a static drug-interaction lookup
  table — a full interaction database like First Databank/Micromex is a paid enterprise integration
  for later) and block/warn accordingly.
- Add a visible **allergy banner** on every patient-facing clinical screen (consultation, pharmacy
  dispense, nursing) — this is standard-of-care UX in every real EMR and currently absent.

**New tables:** `patient_allergies`, `patient_medication_history`, `drug_interactions(drug_a,
drug_b, severity, notes)`.

### 11.4 Laboratory (LIS)

**Current:** Solid 5-status workflow with review/verify. No barcode sample tracking, no reference
ranges, no analyzer integration.

**Upgrade tasks:**
- Wire the existing `qrcode.react` + `@zxing/library` + `react-qr-scanner` dependencies (currently
  unused for this purpose) into a **specimen barcode label** print step at "Collected" status and a
  **scan-to-confirm** step at "Processing" — this closes a real chain-of-custody gap.
- Add `lab_test_reference_ranges(test_code, sex, age_min, age_max, unit, low, high)` and auto-flag
  results outside range with a colored badge on the result entry screen.
- Add `lab_reagent_inventory` table (same shape as pharmacy inventory — reuse the pattern).
- **Phase 3+:** HL7 v2 ORU/ORM listener Edge Function for real analyzer integration — scope this
  only once a specific analyzer model is contracted, since HL7 message shapes are vendor-specific.

**New tables:** `lab_test_reference_ranges`, `lab_reagent_inventory`, `lab_sample_events` (barcode
scan audit trail).

### 11.5 Radiology (RIS/PACS)

**Current:** Dashboard shell only.

**Upgrade tasks:**
- Build order-management CRUD (modality, body part, priority, requesting doctor) — this part is
  cheap to build in-house, matching the pattern of Lab orders.
- **Do not build a DICOM viewer/PACS server in-house.** License an embeddable viewer (e.g.
  OHIF-based commercial offering, or a vendor like Orthanc for a self-hosted open-source PACS) and
  integrate via iframe/API. This matches the standard industry pattern noted in the source HMS
  breakdown: RIS/PACS is "often licensed from a specialist vendor rather than built."
- Store only the **order + report metadata** in Socia's DB; store actual DICOM images in the PACS
  system, referenced by study UID.

**New tables:** `radiology_orders(patient_id, encounter_id, modality, body_part, priority, status,
ordered_by)`, `radiology_reports(order_id, radiologist_id, report_text, study_uid, reported_at)`.

### 11.6 Pharmacy (PIS)

**Current:** Good dispensing workflow. Missing batch/expiry, reorder automation, narcotic tracking,
vendor management.

**Upgrade tasks:**
- Add `medicine_batches(medicine_id, batch_no, expiry_date, quantity, cost_price, vendor_id)` —
  dispensing decrements from the **earliest-expiring batch first (FEFO)**, not just a flat stock
  count as currently implied.
- Add a scheduled Edge Function (daily cron) that flags batches expiring within 60/30/7 days and
  raises an in-app + email notification to the pharmacy role.
- Add `vendors(name, contact, gst_number, ...)` and `purchase_orders` / `purchase_order_items` for
  reorder workflow, with a **low-stock auto-suggested PO** screen.
- Add a `is_narcotic boolean` + `narcotic_register` audit table for controlled substances — required
  for regulatory compliance (India NDPS Act tracking) with mandatory reason-for-dispense capture.

**New tables:** `medicine_batches`, `vendors`, `purchase_orders`, `purchase_order_items`,
`narcotic_register`.

### 11.7 Billing & Revenue Cycle Management

**Current:** Multiple overlapping billing form components signal iteration without consolidation —
this is a maintainability risk as much as a feature gap.

**Upgrade tasks:**
- **Consolidate `BillingForm.tsx`, `EnhancedBillingForm.tsx`, `ResponsiveBillingForm.tsx`** into one
  component with responsive variants via CSS/Tailwind breakpoints, not three parallel components —
  reduces bug surface and keeps billing math in exactly one place.
- Move all billing arithmetic (tax, discount, package pricing) into a single pure function in
  `src/lib/billing-engine.ts`, unit-tested exhaustively (this is the #1 place to start automated
  testing given money is on the line).
- Add **package/scheme pricing**: `billing_packages(name, included_services[], fixed_price)`,
  selectable at IPD admission.
- Add **discount/waiver approval workflow**: any discount above a configurable threshold requires a
  second role's (manager) approval before the bill is finalized — logged to `audit_log`.
- Integrate a **real payment gateway** (Razorpay recommended for an India-based clinic — UPI support
  is essential) via a **server-side Edge Function** that creates the order, and a webhook Edge
  Function that verifies the signature and marks the bill paid — **never trust a client-side
  "payment succeeded" callback alone.**

**New tables:** `billing_packages`, `bill_discount_approvals`, `payments(bill_id, gateway,
gateway_order_id, gateway_payment_id, amount, status, idempotency_key, verified_at)`.

### 11.8 Insurance & TPA

**Current:** 40-line stub migration — claims table exists but no lifecycle.

**Upgrade tasks:**
- Expand to a full claim lifecycle state machine: `Eligibility Checked → Pre-auth Requested →
  Pre-auth Approved/Denied → Treatment → Claim Submitted → Claim Approved/Partially Approved/Denied
  → Payment Received → Reconciled`.
- Add `insurance_policies(patient_id, insurer, policy_number, valid_from, valid_to, coverage_type)`.
- Add `pre_authorizations(claim_id, requested_amount, approved_amount, status, tat_hours)` with a
  turnaround-time metric surfaced on the finance dashboard.
- **Phase 3+:** integrate with specific TPA/insurer APIs once partnerships are signed — these are
  bespoke per-insurer and cannot be generically built ahead of a contract.

**New tables:** `insurance_policies`, `pre_authorizations`, expand `insurance_claims` with a
`status_history` jsonb or a separate `claim_status_log` table.

### 11.9 IPD / Bed Management

**Current:** Strong — this is one of the best-built modules already.

**Upgrade tasks:**
- Add **package-based IPD billing** (link to §11.7's `billing_packages`).
- Add **doctor rounds / progress notes** table, distinct from the initial consultation note, with a
  timeline view alongside vitals trends.
- Add **discharge summary generator**: an Edge Function that compiles diagnosis, treatment course,
  medications on discharge, and follow-up instructions into a signed PDF — currently the biggest
  missing IPD deliverable.
- Add a **bed-turnover time metric** (discharge → cleaning-complete → available) to the analytics
  module — a standard hospital operations KPI currently not tracked.

**New tables:** `doctor_rounds(admission_id, doctor_id, note, vitals_snapshot, created_at)`,
`discharge_summaries(admission_id, pdf_storage_path, generated_at, signed_by)`.

### 11.10 Nursing & MAR

**Current:** Nurse dashboard exists; no MAR distinct from pharmacy dispensing.

**Upgrade tasks:**
- Add `medication_administration_records(admission_id, prescription_item_id, scheduled_time,
  administered_time, administered_by, status[given/missed/refused], notes)` — this is what a nurse
  actually charts against, separate from the pharmacy's dispense-to-ward event.
- Build a **live MAR schedule view** on `NurseDashboard.tsx`: today's due/overdue doses per ward,
  sorted by time — this is the single highest-value nursing screen in any real HMS.
- Add **shift handover notes**: `shift_handovers(ward_id, from_staff, to_staff, shift_date,
  notes, patient_flags jsonb)`.

**New tables:** `medication_administration_records`, `shift_handovers`, `duty_roster(staff_id,
shift_date, shift_type, ward_id)`.

### 11.11 Operation Theatre (OT) Management — Net New

**Upgrade tasks (full build):**
- `ot_rooms`, `ot_bookings(patient_id, surgeon_id, ot_room_id, scheduled_start, scheduled_end,
  status, procedure)`.
- Pre-op checklist (WHO Surgical Safety Checklist pattern — a proven, adoptable standard) as a
  structured form, not free text, with mandatory sign-off before OT status can move to "In Progress."
- `anesthesia_records(booking_id, anesthesiologist_id, type, notes, vitals_log jsonb)`.
- `ot_consumable_usage(booking_id, item, quantity, cost)` feeding directly into billing.
- OT utilization dashboard: bookings vs. available slots per room per week.

### 11.12 Blood Bank Management — Net New

**Upgrade tasks (full build):**
- `blood_donors(name, blood_group, last_donation_date, eligibility_status)`.
- `blood_inventory(component[whole_blood/plasma/platelets/rbc], blood_group, unit_id, collected_at,
  expiry_at, status[available/reserved/issued/discarded])`.
- `blood_requests(patient_id, ward_id, blood_group, component, units_requested, status,
  cross_match_result)`.
- Expiry-driven wastage dashboard — same "expiring soon" pattern as pharmacy batches (§11.6),
  reusable component.

### 11.13 Emergency & Ambulance

**Current:** Triage migration + dashboard exist — good foundation.

**Upgrade tasks:**
- Add a **triage acuity score** (e.g., ESI 1–5 or a simplified 3-tier) as a required field driving
  sort order on the emergency dashboard, not just a status string.
- **Ambulance dispatch** (net new): `ambulances(vehicle_no, status, current_lat, current_lng)`,
  `ambulance_dispatches(request_id, ambulance_id, dispatched_at, arrived_at)`. GPS tracking requires
  a driver-side mobile web view posting location periodically — scope as a lightweight PWA page, not
  a native app, for v1.

### 11.14 HR & Payroll

**Current:** Staff management, onboarding, invitations are strong. Payroll pages exist but
computation depth (India-specific PF/ESI/TDS/professional tax) is unverified.

**Upgrade tasks:**
- Verify/complete `Payroll(Supabase).tsx` computes: Basic + HRA + allowances − PF (12% employee +
  12% employer) − ESI (where applicable) − Professional Tax (state-specific, Tamil Nadu slab) − TDS
  (per IT slabs) → net pay, and generates a compliant payslip PDF.
- Add `staff_credentials(staff_id, license_type, license_number, issued_at, expires_at)` with an
  expiry-alert cron (reuse pattern from §11.6).
- Add `duty_roster` (already introduced in §11.10) surfaced in an HR-wide roster calendar, not just
  per-ward.

### 11.15 Telemedicine — Net New

**Upgrade tasks (full build, phased):**
- **Phase A (cheap, fast):** integrate a hosted video SDK (Twilio Video, Agora, or Daily.co) rather
  than raw WebRTC — dramatically less code, TURN/STUN infra handled for you.
- `teleconsultations(appointment_id, room_url, started_at, ended_at, recording_consent boolean)`.
- Post-consultation flow reuses the existing e-prescription generator (§11.2) — no new prescription
  logic needed, just a different entry point.
- Payment before session start, reusing §11.7's payment integration.

### 11.16 Patient Portal & Engagement

**Current:** Portal pages exist; in-app notifications only, no outbound channel, no family accounts.

**Upgrade tasks:**
- Wire **WhatsApp Business API** (via a BSP like Gupshup or Twilio) and **SMS** (MSG91, has strong
  India delivery rates) as an Edge Function `send-notification` that fans out based on the patient's
  channel preference — appointment reminders, report-ready alerts, bill-due reminders.
- Add `family_links(primary_patient_id, linked_patient_id, relationship, access_level)` for parents
  managing children's/elderly dependents' records — a very common real-world need this system
  currently has no model for.
- Add a lightweight **post-visit feedback** flow (1–5 stars + optional comment) triggered by the
  same notification Edge Function after appointment completion.

### 11.17 Analytics & Reporting

**Current:** Framework (Recharts, StatCard, per-role dashboards) is solid; specific enterprise KPIs
and export depth unverified.

**Upgrade tasks:**
- Define and ship a fixed set of **hospital-standard KPIs**: bed occupancy rate, average length of
  stay, doctor-wise revenue, department-wise revenue, no-show rate, readmission-within-30-days rate,
  insurance claim recovery rate, pharmacy stock turnover.
- Move heavy aggregation queries into **Postgres materialized views**, refreshed on a schedule
  (via `pg_cron` if available on the Supabase tier, else a scheduled Edge Function), rather than
  computing them live in the browser on every dashboard load.
- Standardize `ExportButtons.tsx` to guarantee PDF exports carry the tenant's letterhead and a
  generated-by/generated-at footer for audit traceability.

### 11.18 Compliance & Regulatory Module

**Upgrade tasks:** consolidate everything from §7 (consent, audit trail, retention) into a single
**Compliance** admin surface: `AuditLog.tsx` extended with filters (by patient/actor/date/action),
a **consent management** screen, a **data retention job** (Edge Function, scheduled) that
anonymizes records past the statutory retention window rather than deleting them outright, and a
**NABH documentation pack generator** — a big differentiator when selling into Indian hospitals
pursuing accreditation, and realistically just a curated PDF export of existing policy + audit data.

### 11.19 AI/ML Layer

Sequenced last deliberately — do not build this before the data model and workflows above are
solid, because every AI feature here depends on clean structured data (diagnosis codes, allergy
lists, vitals trends) that doesn't fully exist yet.

**Upgrade tasks, roughly in build-order:**
1. **No-show prediction** — simplest first win; a logistic regression over historical
   appointment/patient features, run as a nightly batch Edge Function, surfaced as a risk flag on
   the appointment list (helps front-desk overbook intelligently).
2. **Drug interaction / allergy CDS** — already scoped in §11.3, technically "AI/ML-adjacent" but
   rule-based, not ML, and should ship first since it's a safety feature, not a nice-to-have.
3. **Bed occupancy forecasting** — time-series forecast (even a simple moving-average/Prophet model
   run server-side) to help planning.
4. **Readmission risk** and **sepsis early-warning** — genuinely hard, clinically sensitive models;
   treat as **decision support only**, never autonomous action, with a mandatory human-in-the-loop
   review and a clear disclaimer, and validate against clinical literature/local clinician review
   before any deployment — these carry real patient-safety and liability weight.
5. **Radiology AI assistance** — only pursue via a licensed vendor API, not an in-house model;
   medical imaging AI has its own regulatory approval requirements (e.g., CDSCO in India) that a
   general-purpose HMS vendor should not take on internally.

### 11.20 Enterprise Platform Features

**Upgrade tasks:**
- Build a real **public API** (versioned, `/api/v1/...` via Edge Functions or a light API gateway)
  with per-tenant API keys and rate limiting — required before any serious third-party integration
  (insurer, government registry, accounting software) can plug in.
- Formalize **multi-branch centralized MPI** — currently branches exist, but confirm patient search
  can span branches within a tenant (with permission) rather than being branch-siloed by accident.
- Add a **sandbox/staging tenant** that hospital IT teams can self-serve for evaluation before
  go-live — currently every new tenant likely goes straight to a production-equivalent environment.

### 11.21 Integration Ecosystem — see Section 14 for the full plan.

### 11.22 Dietary/Nutrition & Biomedical Asset Management — Net New (lowest priority)

**Upgrade tasks (defer to a later phase, scope only when a customer requires it):**
- `patient_diet_charts(admission_id, meal_type, diet_type, restrictions, scheduled_time)`.
- `biomedical_assets(name, serial_no, location, last_calibration, next_calibration_due,
  maintenance_log jsonb)` with the same expiry/due-date alert pattern used across pharmacy/lab/HR.


## 12. NEW DATABASE MIGRATIONS REQUIRED (FULL LIST, ORDERED)

Follow the existing naming convention (`YYYYMMDDHHMMSS_description.sql`). Suggested sequencing —
each depends only on prior items in this list:

1. `_rls_coverage_audit.sql` — introspection function `check_rls_coverage()`; fix any table found
   without RLS enabled (**do this first, before adding any new PHI table**).
2. `_audit_log_immutable.sql` — the `audit_log` table + triggers from §7.4.
3. `_patient_documents.sql` — §11.1.
4. `_patient_allergies_medhistory.sql` — §11.3 (highest clinical-safety priority).
5. `_diagnosis_coding.sql` — §11.2.
6. `_lab_reference_ranges_reagents.sql` — §11.4.
7. `_medicine_batches_vendors_po.sql` — §11.6.
8. `_narcotic_register.sql` — §11.6.
9. `_billing_engine_tables.sql` — packages, discount approvals, payments — §11.7.
10. `_insurance_lifecycle_expansion.sql` — §11.8.
11. `_doctor_rounds_discharge_summaries.sql` — §11.9.
12. `_mar_shift_handover_roster.sql` — §11.10.
13. `_ot_management.sql` — §11.11.
14. `_blood_bank.sql` — §11.12.
15. `_ambulance_dispatch.sql` — §11.13.
16. `_staff_credentials.sql` — §11.14.
17. `_teleconsultations.sql` — §11.15.
18. `_family_links_feedback.sql` — §11.16.
19. `_analytics_materialized_views.sql` — §11.17.
20. `_consents.sql` — §7.3.
21. `_api_keys_public_api.sql` — §11.20.
22. `_radiology_orders_reports.sql` — §11.5.
23. `_dietary_biomedical_assets.sql` — §11.22 (lowest priority, last).

Every migration in this list must ship with: RLS enabled + tenant-scoped policy, an accompanying
entry in the audit-trigger set (§7.4) if it touches PHI, and a Vitest/Playwright test asserting the
policy (§22).

---

## 13. NEW EDGE FUNCTIONS / BACKEND SERVICES REQUIRED

Current: `admin-create-user`, `send-invite`, `verify-domain` (3 total). Target set:

| Function | Purpose | Priority |
|---|---|---|
| `generate-uhid` | Server-side collision-safe UHID issuance | High |
| `merge-patients` | Transactional patient record merge | High |
| `log-patient-view` | RPC wrapper so single-record reads get audit-logged before returning data | High |
| `create-payment-order` | Payment gateway order creation (Razorpay) | High |
| `payment-webhook` | Verify gateway signature, mark bill paid, idempotent | High |
| `send-notification` | Fan-out to SMS/WhatsApp/email based on patient channel preference | High |
| `generate-prescription-pdf` | Signed, letterhead-branded e-prescription | Medium |
| `generate-discharge-summary` | Compiles admission record into signed PDF | Medium |
| `expiry-watch-cron` | Scheduled: pharmacy batches, blood units, staff credentials, contracts | Medium |
| `anomaly-alert-cron` | Scheduled: business-metric sanity checks (§10.2) | Medium |
| `data-retention-cron` | Scheduled: anonymize records past statutory retention window | Medium |
| `public-api-v1` | Versioned, API-key-authenticated external integration surface | Medium |
| `hl7-inbound-listener` | Lab analyzer / external HL7 message ingestion | Low (phase 3+) |
| `dicom-bridge` | Metadata sync with licensed PACS viewer | Low (phase 3+) |
| `insurer-eligibility-check` | Per-insurer API integration (bespoke per partner) | Low (contract-driven) |

**Design rule for every Edge Function above:** validate the caller's JWT + role, re-check
authorization server-side (never trust the client's claimed permission), log to `audit_log`, and
return typed errors that the frontend's error boundary can render meaningfully.

---

## 14. THIRD-PARTY INTEGRATION ECOSYSTEM PLAN

### 14.1 Payments
**Recommendation: Razorpay** (India-first, strong UPI + card + netbanking coverage, Indian GST
invoicing support). Use **Razorpay Checkout** (hosted) so card data never touches Socia's servers —
this keeps PCI-DSS scope minimal (SAQ-A level). Webhook signature verification is mandatory
(`payment-webhook` function above) — never mark a bill paid from a client-side success callback alone.

### 14.2 SMS / WhatsApp
**Recommendation: MSG91 or Gupshup** for India-first delivery rates and official WhatsApp Business
API access. Build one `send-notification` Edge Function with a channel-abstraction interface so
swapping providers later doesn't touch calling code.

### 14.3 Email
**Recommendation: AWS SES or Resend.** Configure SPF/DKIM/DMARC on the tenant's sending domain
(or a Socia-managed subdomain per tenant, e.g. `mail.<tenant>.hsm.com`) to keep deliverability high
and avoid spam-folder placement for report-ready/billing emails.

### 14.4 HL7/FHIR
Defer until a specific lab/insurer/government registry integration is contracted — HL7 message
shapes are vendor-specific enough that building "generic HL7 support" speculatively wastes effort.
When needed: a dedicated Edge Function acting as an HL7 v2 MLLP listener, translating inbound
ORU (results) messages into `lab_results` rows, and FHIR R4 resources (`Patient`, `Observation`,
`DiagnosticReport`) for any partner requiring FHIR specifically (increasingly common with Indian
ABDM/government health-ID integration).

### 14.5 Radiology / DICOM
**License, don't build.** Options range from a self-hosted open-source PACS (Orthanc) to a fully
managed commercial viewer with an embeddable API. Socia's DB stores only order/report metadata and
a `study_uid` reference (§11.5).

### 14.6 Telemedicine Video
**Recommendation: Daily.co or Twilio Video** — prebuilt UI components exist for both, minimizing
custom WebRTC work. Avoid building raw WebRTC/TURN infrastructure in-house at this stage.

### 14.7 Government / ABDM (Ayushman Bharat Digital Mission) — India-specific
Given the Coimbatore/Tamil Nadu base, plan for **ABDM integration** (Health ID linkage, Health
Information Provider registration) as a distinct, India-specific phase-3+ workstream — this is
increasingly expected by Indian hospital buyers and is a genuine competitive differentiator versus
generic international HMS products.

### 14.8 Accounting/ERP export
Add a **Tally-compatible XML export** or **Zoho Books API push** for the finance/accounts module —
most Indian clinics already run Tally for statutory bookkeeping; a one-way sync (Socia → Tally) of
day-end billing summaries is a small build with outsized customer value.


## 15. FRONTEND ARCHITECTURE UPGRADES

### 15.1 Component consolidation
The pattern seen in billing (`BillingForm` / `EnhancedBillingForm` / `ResponsiveBillingForm`) and in
pages (`Billing.tsx` vs `BillingSupabase.tsx`, `Appointments.tsx` vs `AppointmentsSupabase.tsx`,
and similarly for Consultation, PatientDashboard, PatientHistory, PatientHub, Payroll, Pharmacy,
Reports, Treatments — roughly **13 page pairs** follow this "legacy vs Supabase" naming pattern)
strongly suggests an in-progress migration from an earlier local-state/mock-data version
(`hms-store.ts`, `demo-clinic.ts` in `src/lib/` support this reading) to the live Supabase-backed
version. **This migration should be finished, not left half-done**: audit each pair, confirm the
`*Supabase.tsx` version is feature-complete relative to its predecessor, update all routes to point
only to the Supabase version, and delete the legacy file. Shipping both indefinitely doubles
maintenance cost and risks staff being trained on a page that silently isn't wired to real data.

### 15.2 Design system discipline
`UIUX.md` and `PRODUCT.md` already articulate a strong, specific design point of view ("clarity
above all," "professional restraint," WCAG 2.1 AA target). Upgrade tasks:
- Add a **visual regression test** (Chromatic or Playwright screenshot diffing) on the core
  `shadcn/ui`-based component library so the "professional restraint" brand doesn't drift as more
  contributors touch the UI.
- Run an actual **axe-core accessibility audit** in CI (not just aspirational WCAG target in a doc)
  against the highest-traffic pages (Dashboard, Patients, Billing, Consultation).
- Confirm **reduced-motion** is respected (PRODUCT.md commits to this) by testing Framer Motion
  components with `prefers-reduced-motion` toggled.

### 15.3 State management boundary
React Query is the right choice for server state — confirm `hms-store.ts` (if it's a manual global
store) isn't duplicating what React Query already does; if it predates the Supabase migration, it's
a candidate for deletion alongside the legacy pages in §15.1.

### 15.4 Route-level code splitting
With 66 pages, confirm `React.lazy()` + `Suspense` route-level splitting is in place so the initial
bundle isn't shipping all 66 pages' code to a patient hitting the login screen. `summary.md` notes a
~1.6MB main bundle — that's a concrete, fixable performance number (see §17).

---

## 16. REAL-TIME & OFFLINE ARCHITECTURE UPGRADES

### 16.1 Real-time — already strong
Supabase Realtime is wired for appointments, beds, and (per `summary.md`) treatments, prescriptions,
lab, and pharmacy dispenses. Upgrade tasks:
- Add a **connection-status indicator** in the UI (small dot in the Navbar) so staff know if they've
  silently dropped to stale/polling data — critical in a clinical setting where "the bed board looks
  free but isn't" is a real safety issue.
- Add **presence** (who's currently viewing/editing a given patient chart) to prevent two clinicians
  silently overwriting each other's consultation notes.

### 16.2 Offline — not yet built
A service worker (`sw.js`) and PWA manifest exist, but no IndexedDB write-queue for critical actions.
Upgrade tasks:
- For **vitals capture** and **MAR administration** specifically (the two actions most likely to
  happen in a network dead-zone — ICU, basement radiology, ambulance), queue writes in IndexedDB
  when offline, with a visible "pending sync" badge, and replay in order on reconnect.
- Explicitly **do not** attempt offline-first for billing/payments — those must be online-only to
  avoid double-charge/idempotency nightmares; keep offline scope narrow and safety-justified.

---

## 17. PERFORMANCE & SCALABILITY PLAN

### 17.1 Frontend
- Route-level code splitting (§15.4) to cut the ~1.6MB main bundle.
- Image/asset optimization for the landing pages (`EnterpriseHeader`/`EnterpriseFooter`,
  `Home.tsx`, `Features.tsx`) — these are public, SEO-relevant, and currently unaudited for
  Lighthouse score.
- React Query cache-time tuning per data type (patient list: short stale-time given realtime;
  medicine catalog: long stale-time, rarely changes).

### 17.2 Database
- Add indexes on every foreign key used in a `WHERE` or `JOIN` in hot-path queries (patient search,
  appointment-by-date, bed-by-ward) — audit via `EXPLAIN ANALYZE` on the top 10 slowest queries once
  `pg_stat_statements` is enabled (§10.2).
- Move dashboard aggregations to **materialized views** (§11.17), refreshed every 5–15 minutes for
  non-real-time KPIs, rather than recomputing on every page load.
- Plan a **read replica** once a tenant's data volume/query load justifies it — not needed at
  current scale, but the architecture (Supabase supports read replicas on higher tiers) should be
  understood before it's urgently needed.

### 17.3 Multi-tenant scale
- Confirm the subdomain-routing design (already strong per `SUBDOMAINS.md`) doesn't require a
  redeploy per branch — it doesn't, per the doc, which is correct and should be preserved as tenant
  count grows.
- Load-test with a **synthetic multi-tenant dataset** (e.g., 50 tenants × 5 branches × 10k patients
  each) before onboarding the first real multi-branch hospital chain, to catch any query that scans
  without a tenant filter under real volume.

---

## 18. DISASTER RECOVERY & BUSINESS CONTINUITY PLAN

Currently undocumented. Minimum required before onboarding any paying hospital customer:

- **Backups:** confirm Supabase's automatic daily backups are enabled on the project tier in use;
  add a **weekly manual restore drill** to a scratch project to prove backups are actually
  restorable, not just taken (a completely untested backup is not a backup).
- **RPO/RTO targets:** define explicitly — e.g., RPO ≤ 24h (daily backup), RTO ≤ 4h (time to stand
  up a restored environment and repoint DNS). Write this into a customer-facing SLA once solid.
- **Multi-region consideration:** for a single-country (India-first) customer base, single-region
  Supabase is acceptable initially; document the upgrade path to multi-region if/when serving
  hospital chains with strict continuity requirements.
- **Incident response runbook:** a short, concrete doc — who gets paged, what the rollback procedure
  is for a bad migration, how a tenant is notified of an outage — this is cheap to write now and
  expensive to improvise during a real incident.

---

## 19. MOBILE & PWA STRATEGY

- The PWA manifest + service worker foundation already exists (`public/manifest.json`, `public/sw.js`)
  — good starting point; audit whether the service worker currently does anything beyond a default
  Vite PWA plugin scaffold, or if it's genuinely caching for offline use.
- **Recommendation: stay PWA-first, do not build native apps yet.** A responsive, installable PWA
  covers doctors/nurses/reception on tablets and phones without the cost of two native codebases.
  Revisit native (React Native, sharing types/business logic with the web app) only if a specific
  customer requires app-store presence or deep hardware integration (biometric attendance, barcode
  scanner hardware SDKs) that PWA APIs can't reach.
- For the **ambulance dispatch** use case (§11.13), a lightweight installable PWA page for the
  driver is sufficient — avoid the temptation to build a separate native driver app for v1.


## 20. AI/ML ROADMAP

See detailed sequencing in §11.19. Summary roadmap view:

| Phase | Capability | Type | Risk |
|---|---|---|---|
| 1 | Drug interaction / allergy CDS | Rule-based | Low — ships as a safety feature, not "AI" marketing |
| 1 | No-show prediction | Simple ML (logistic regression) | Low |
| 2 | Bed occupancy forecasting | Time-series | Low-Medium |
| 3 | Readmission risk flagging | ML, human-reviewed | Medium — decision support only, never autonomous |
| 3 | Sepsis/deterioration early warning | ML, human-reviewed | High — requires clinical validation partner |
| Ongoing | Revenue leakage / fraud detection | Rule-based + anomaly detection | Low-Medium |
| Deferred | Radiology image AI | Licensed vendor only | High — regulatory (CDSCO/FDA-class) territory, do not build in-house |

**Governing principle for all of the above:** every AI/ML feature in a clinical system is decision
*support*, never decision *replacement*. Every model output must be labeled as such in the UI, must
be overridable by the clinician, and must log both the model's suggestion and the clinician's actual
action to `audit_log` — this is both an ethical requirement and, practically, the dataset that lets
you later measure whether the model is actually helping.

---

## 21. COMPLIANCE PROGRAM (HIPAA / DPDPA / NABH / SOC2)

### 21.1 Immediate (0–3 months) — DPDPA 2023 baseline, since India is the primary market
- Publish a clear **Privacy Notice** covering what patient data is collected, why, and for how long.
- Stand up the **consent management** module (§7.3).
- Register as a **Data Fiduciary** if/when required under DPDPA rules as they finalize, and track
  the **Data Protection Board** compliance timeline — this is evolving regulation; assign someone at
  SOCIA to monitor official notifications rather than treating this document as the final word.
- Complete the **audit trail** (§7.4) — this underpins every other framework below, build it once.

### 21.2 Near-term (3–9 months) — sales-enabling credibility
- **NABH pre-accreditation documentation support**: many mid-size Indian hospitals pursuing NABH
  accreditation will ask whether the HMS supports their documentation requirements — build the
  compliance-pack export (§11.18) with this specifically in mind; it is a genuine sales
  differentiator versus generic competitors.
- Conduct a **third-party security assessment / penetration test** — even a lightweight one — before
  claiming "enterprise-grade security" in sales materials, since that phrase currently appears in
  the codebase's blueprint doc without a verifying assessment behind it.

### 21.3 Longer-term (9+ months) — enterprise/chain sales
- **SOC 2 Type I → Type II** readiness, once the customer base includes hospital chains or investors
  requiring it. All the groundwork (RLS, MFA, audit trail, incident response runbook, backup drills)
  laid out in this document directly feeds a SOC2 audit — treat SOC2 as "the paperwork that proves
  what you already built," not a separate project.
- **HIPAA** only becomes relevant if/when serving US-based clients or partners (e.g., an
  international telemedicine partnership) — do not over-invest here ahead of an actual US-market
  need; DPDPA is the correct near-term priority given the Coimbatore/India base.

---

## 22. TESTING STRATEGY (FULL PYRAMID)

### 22.1 Tooling choices
- **Unit/component:** Vitest (native Vite integration) + React Testing Library.
- **E2E:** Playwright (multi-browser, good CI story, can drive real Supabase-backed flows against a
  preview deploy).
- **RLS/security tests:** a dedicated Node script (or Vitest suite) authenticating as each of the 19
  roles via the Supabase JS client and asserting expected row visibility per table.
- **Load testing:** k6 or Artillery for the highest-traffic endpoints (patient search, appointment
  booking) ahead of any large hospital-chain onboarding.

### 22.2 Coverage priorities, in order
1. `billing-engine.ts` (§11.7) — money math, 100% branch coverage target.
2. RLS policy suite — every role × every table.
3. The core clinical E2E flow from `summary.md` (register → appointment → consult → prescribe →
   dispense → bill → discharge) as a single Playwright test — this one test, kept green, is worth
   more than fragmented unit tests across the same flow.
4. Bed-state transition logic (Assign/Discharge/Ready/Maintenance) — a state machine, ideal for
   exhaustive unit testing of every legal/illegal transition.
5. Zod schemas on every form — assert both valid and invalid input handling.
6. Realtime subscription behavior — does the UI actually update when another session mutates data.

### 22.3 CI gating
No PR merges to `main` without: lint pass, typecheck pass, unit+component tests pass, build
succeeds. E2E suite runs on every merge to `main` against a preview deployment (not on every PR, to
keep PR feedback fast) — see §23 for the concrete pipeline.

---

## 23. CI/CD PIPELINE DESIGN

Concrete GitHub Actions structure (adapt to GitLab CI if that's the team's platform):

```yaml
# .github/workflows/ci.yml — runs on every PR
name: CI
on: [pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npx vitest run --coverage
      - run: npm run build

# .github/workflows/e2e.yml — runs on merge to main, against the Vercel preview URL
name: E2E
on:
  push:
    branches: [main]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npx playwright install --with-deps
      - run: npx playwright test --base-url=${{ secrets.PREVIEW_URL }}

# .github/workflows/migration-check.yml — runs when supabase/migrations/** changes
name: Migration Dry-Run
on:
  pull_request:
    paths: ['supabase/migrations/**']
jobs:
  dry-run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --dry-run --db-url ${{ secrets.STAGING_DB_URL }}
      - run: |
          # RLS coverage check — fail the build if any table lacks RLS
          psql ${{ secrets.STAGING_DB_URL }} -c \
            "select relname from pg_class where relrowsecurity = false and relkind='r' and relnamespace = 'public'::regnamespace;" \
            | grep -q '(0 rows)' || (echo "Tables without RLS found" && exit 1)
```

Deployment itself stays on **Vercel's native Git integration** (already configured per `vercel.json`)
— the CI above is a *gate*, not a replacement for Vercel's deploy pipeline.


## 24. PHASED DELIVERY ROADMAP (SPRINT-BY-SPRINT)

Assumes 2-week sprints and a small team (2–4 engineers). Adjust pace to actual team size — the
*sequence* matters more than the calendar.

### Phase 0 — Stabilization (Sprints 1–2) — "Stop the bleeding"
- Resolve dual-lockfile ambiguity (§9.1); remove `dist/` from git.
- Stand up CI (§23): lint + typecheck + build gate on every PR.
- Sweep the 54 files with TODO/mock/dummy/placeholder markers — triage each into "delete," "finish
  now," or "ticket for later" (no silent mocks left in code that looks production-ready).
- Write the RLS coverage audit script (§12, item 1) and fix every gap it finds — this is the
  single highest-leverage security task available.
- Stand up Sentry error tracking (§10.2).

### Phase 1 — Core Hardening (Sprints 3–5) — "Make what exists trustworthy"
- Build the audit_log immutable trail (§7.4) and wire triggers on every existing PHI table.
- Add Vitest + first test suite: `billing-engine.ts` extraction + unit tests (§11.7, §22.2).
- Add the RLS role-matrix test suite (§22.2 item 2).
- Finish the legacy-vs-Supabase page consolidation (§15.1) — delete every superseded page.
- Add MFA enrollment for privileged roles (§6.2).
- Add the single core-flow Playwright E2E test (§22.2 item 3) and wire it into CI on `main`.

### Phase 2 — Clinical Safety & Depth (Sprints 6–9)
- Patient allergies + medication history + CDS interaction check (§11.3) — highest clinical-safety
  priority in the entire backlog.
- Diagnosis coding (ICD-10/11) (§11.2).
- MAR + shift handover (§11.10).
- Medicine batch/expiry (FEFO) + narcotic register (§11.6).
- Lab reference ranges + barcode sample tracking (§11.4).
- Discharge summary generator (§11.9).

### Phase 3 — Revenue & Payments (Sprints 10–12)
- Consolidate billing components (§15.1), ship package pricing + discount approval workflow.
- Integrate Razorpay end-to-end (§11.7, §14.1) with the payment-webhook Edge Function.
- Expand insurance claim lifecycle (§11.8).
- Add Tally/Zoho export (§14.8).

### Phase 4 — Patient-Facing & Communication (Sprints 13–15)
- Wire SMS/WhatsApp/email via `send-notification` (§11.16, §14.2, §14.3).
- Family-linked accounts + feedback surveys (§11.16).
- Patient document upload + MPI duplicate detection/merge (§11.1).
- Consent management module (§7.3, §21.1).

### Phase 5 — Net-New Clinical Modules (Sprints 16–20)
- OT management (§11.11).
- Blood bank (§11.12).
- Ambulance dispatch (§11.13).
- Radiology order management + licensed PACS viewer integration (§11.5, §14.5).
- Telemedicine via Daily.co/Twilio (§11.15, §14.6).

### Phase 6 — Compliance, DR & Scale (Sprints 21–24)
- Complete DPDPA baseline + NABH documentation pack (§21.1–21.2).
- Backup restore drill + documented RPO/RTO + incident response runbook (§18).
- Materialized-view analytics + index audit + load test with synthetic multi-tenant dataset (§17).
- Public API v1 + API keys (§11.20).

### Phase 7 — AI/ML & Advanced Interoperability (Sprints 25+)
- No-show prediction, bed occupancy forecasting (§20).
- ABDM/government registry integration exploration (§14.7).
- HL7/FHIR listener once a specific lab/insurer partner is contracted (§14.4).
- Readmission risk / early-warning models, with a clinical review partner (§20).

---

## 25. RISK REGISTER

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Missing/incomplete RLS policy allows cross-tenant PHI leak | Medium | Critical | RLS coverage audit + role-matrix test suite (§12, §22) — do first |
| 2 | No automated tests → regression ships to production affecting billing or patient safety | High | Critical | Test pyramid rollout (§22), starting with billing engine |
| 3 | Client-side "payment succeeded" trusted without webhook verification | Medium (once payments are added) | Critical (financial fraud/reconciliation failure) | Server-side webhook verification only (§11.7, §14.1) |
| 4 | No allergy/interaction checking → adverse drug event | Medium | Critical (patient safety) | CDS module (§11.3), prioritized in Phase 2 |
| 5 | Untested backups turn out to be unrestorable during a real incident | Low-Medium | Critical | Quarterly restore drills (§18) |
| 6 | Dual package-manager lockfiles cause inconsistent builds across environments | Medium | Medium | Pick one, delete the other (§9.1), Phase 0 |
| 7 | Legacy vs. Supabase page duplication → staff trained on a non-live page | Medium | Medium | Consolidation sweep (§15.1), Phase 1 |
| 8 | No MFA on privileged roles → credential-stuffing account takeover | Medium | High | MFA enrollment (§6.2), Phase 1 |
| 9 | Regulatory shift in DPDPA rules outpaces compliance program | Medium | Medium-High | Assign an internal compliance owner to monitor Data Protection Board notifications (§21.1) |
| 10 | Building DICOM/PACS in-house consumes months with no differentiated value | Medium (if not explicitly avoided) | Medium | Explicit "license, don't build" decision recorded (§11.5, §14.5) |
| 11 | AI/ML feature ships as autonomous decision-maker rather than decision support, creating liability | Low (if governance in §20 is followed) | Critical | Human-in-the-loop requirement, logged overrides (§20) |
| 12 | Team scales without CI gates, quality regresses as more contributors touch the code | High (if unaddressed) | High | CI pipeline (§23), Phase 0 |

---

## 26. DEFINITION OF DONE — "FULLY WORKING" CHECKLIST

A pragmatic checklist for "is this actually a fully working HMS, not just a demo":

**Foundations**
- [ ] Single package manager, no committed `dist/`, CI gating every PR
- [ ] Every table has RLS enabled and a passing role-matrix test
- [ ] Audit log is append-only, covers every PHI table's writes, and covers patient-record reads
- [ ] MFA enforced for super_admin, tenant_admin, doctor, pharmacist, billing_officer
- [ ] Sentry (or equivalent) capturing frontend + Edge Function errors
- [ ] Documented, drilled backup/restore process with stated RPO/RTO

**Clinical safety**
- [ ] Allergy and medication-history checks run before every prescription save
- [ ] MAR distinct from pharmacy dispense, with a live due/overdue nursing view
- [ ] Discharge summaries generated as signed, storable PDFs

**Money**
- [ ] Billing math lives in one tested module, not three parallel form components
- [ ] Real payment gateway wired with server-verified webhooks, idempotent
- [ ] Insurance claim lifecycle tracked end-to-end, not just a stub table

**Everything else works because it's tested**
- [ ] Core patient journey covered by a green E2E test in CI
- [ ] No silent mocks/placeholders remain from the original 54-file sweep

Only once every box above is checked should this be marketed to a hospital as "production-ready" —
everything else in this document (OT, blood bank, telemedicine, AI/ML, HL7/FHIR) is real,
valuable, and sequenced correctly, but is expansion *on top of* a foundation, not a substitute for it.


## 27. APPENDIX A — FULL ROUTE/PAGE INVENTORY (AS FOUND)

66 route-level pages in `src/pages/`. Grouped by function, with the recommended disposition for
each (`Keep`, `Consolidate`, `Finish`, `Extend`) per the consolidation guidance in §15.1.

### 27.1 Public / marketing pages
| Page | Purpose | Disposition |
|---|---|---|
| `Home.tsx` | Public landing page | Keep — audit Lighthouse score (§17.1) |
| `Index.tsx` | Root route entry, likely redirect logic | Keep |
| `About.tsx` | Company/product info | Keep |
| `Features.tsx` | Feature marketing page | Keep — sync with actual shipped features as this document's phases land |
| `Pricing.tsx` | Pricing page | Keep |
| `FAQ.tsx` | Frequently asked questions | Keep |
| `Contact.tsx` | Contact form | Keep |
| `Privacy.tsx` | Privacy policy | Extend — must reflect the DPDPA consent program (§21.1) once shipped |
| `Terms.tsx` | Terms of service | Keep — legal review recommended before public launch |
| `Security.tsx` | Public security posture page | Extend — update once §21 assessment/pen-test is complete; don't overclaim ahead of verification |

### 27.2 Auth & onboarding
| Page | Purpose | Disposition |
|---|---|---|
| `Login.tsx` | Staff/patient login | Extend — add MFA challenge step (§6.2) |
| `Signup.tsx` | New tenant/account signup | Keep |
| `PatientSignup.tsx` | Patient self-registration | Extend — link to consent capture (§7.3) |
| `Setup.tsx` | One-time clinic setup wizard entry | Keep |
| `InviteAccept.tsx` | Staff invitation acceptance | Keep |
| `PendingApproval.tsx` | Post-invite awaiting-approval state | Keep |
| `NotFound.tsx` | 404 handler | Keep |

### 27.3 Core clinical workflow pages
| Page | Purpose | Disposition |
|---|---|---|
| `Appointments.tsx` | Legacy appointment booking | **Consolidate into `AppointmentsSupabase.tsx`, then delete** |
| `AppointmentsSupabase.tsx` | Live appointment booking (realtime) | Keep — canonical version |
| `Consultation.tsx` | Legacy consultation workflow | **Consolidate into `ConsultationSupabase.tsx`, then delete** |
| `ConsultationSupabase.tsx` | Live consultation workflow | Keep — canonical; extend with SOAP templates + diagnosis coding (§11.2) |
| `Treatments.tsx` | Legacy treatment tracking | **Consolidate into `TreatmentsSupabase.tsx`, then delete** |
| `TreatmentsSupabase.tsx` | Live treatment tracking, interconnected per `summary.md` | Keep — canonical |
| `PatientHistory.tsx` | Legacy patient history view | **Consolidate into `PatientHistorySupabase.tsx`, then delete** |
| `PatientHistorySupabase.tsx` | Live patient history, timeline-based | Keep — canonical |
| `PatientHub.tsx` | Legacy patient list/search | **Consolidate into `PatientHubSupabase.tsx`, then delete** |
| `PatientHubSupabase.tsx` | Live patient list/search | Keep — canonical; extend with MPI duplicate detection (§11.1) |

### 27.4 IPD / bed management
| Page | Purpose | Disposition |
|---|---|---|
| `BedManagement.tsx` | Legacy bed board | **Consolidate into `BedManagementSupabase.tsx`, then delete** |
| `BedManagementSupabase.tsx` | Live ward/bed board with occupancy | Keep — canonical; extend with package billing link (§11.9) |

### 27.5 Pharmacy
| Page | Purpose | Disposition |
|---|---|---|
| `Pharmacy.tsx` | Legacy pharmacy page | **Consolidate/verify against `PharmacySupabase.tsx`, then delete** |
| `PharmacySupabase.tsx` | Live dispensing workflow | Keep — canonical; extend with batch/expiry (§11.6) |
| `PharmacyDashboard.tsx` | Pharmacist role landing dashboard | Keep |

### 27.6 Laboratory & radiology
| Page | Purpose | Disposition |
|---|---|---|
| `Lab.tsx` | Lab order + review/verify workflow | Keep — extend with barcode + reference ranges (§11.4) |
| `RadiologyDashboard.tsx` | Radiology role dashboard | Extend — build order CRUD, integrate licensed PACS viewer (§11.5) |

### 27.7 Billing & finance
| Page | Purpose | Disposition |
|---|---|---|
| `Billing.tsx` | Legacy billing page | **Consolidate into `BillingSupabase.tsx`, then delete** |
| `BillingSupabase.tsx` | Live billing | Keep — canonical; extract billing-engine.ts (§11.7, §15.1) |
| `FinanceDashboard.tsx` | Finance role dashboard | Keep |
| `AccountsDashboard.tsx` | Accounts role dashboard | Keep |
| `Payroll.tsx` | Legacy payroll page | **Consolidate into `PayrollSupabase.tsx`, then delete** |
| `PayrollSupabase.tsx` | Live payroll | Keep — verify India statutory deduction completeness (§11.14) |

### 27.8 Reports & records
| Page | Purpose | Disposition |
|---|---|---|
| `Reports.tsx` | Legacy reports page | **Consolidate into `ReportsSupabase.tsx`, then delete** |
| `ReportsSupabase.tsx` | Live reports | Keep — canonical; extend with hospital-standard KPIs (§11.17) |
| `RecordsDashboard.tsx` | Medical records officer dashboard | Keep |
| `AuditLog.tsx` | Audit trail viewer | Extend to consume the new immutable `audit_log` table (§7.4) |

### 27.9 Role dashboards
| Page | Role |
|---|---|
| `Dashboard.tsx` | Generic/admin dashboard |
| `DoctorDashboard.tsx` | Doctor |
| `NurseDashboard.tsx` | Nurse — extend with live MAR schedule (§11.10) |
| `ReceptionDashboard.tsx` | Receptionist |
| `EmergencyDashboard.tsx` | Emergency staff — extend with triage acuity sort (§11.13) |
| `HRDashboard.tsx` | HR |
| `SecurityDashboard.tsx` | Security role |
| `HousekeepingDashboard.tsx` | Housekeeping (bed cleaning turnover) |
| `PlatformDashboard.tsx` | Super admin — platform-wide console |
| `TenantDashboard.tsx` | Tenant admin |
| `BranchDashboard.tsx` | Branch manager |

### 27.10 Patient-facing pages
| Page | Purpose | Disposition |
|---|---|---|
| `PatientDashboard.tsx` | Legacy patient dashboard | **Consolidate into `PatientDashboardSupabase.tsx`, then delete** |
| `PatientDashboardSupabase.tsx` | Live patient dashboard | Keep — canonical; extend with family-linked accounts (§11.16) |
| `PatientPortal.tsx` | Broader patient portal shell | Extend — document upload, feedback survey |

### 27.11 Staff & organization administration
| Page | Purpose |
|---|---|
| `StaffManagement.tsx` | Staff directory/CRUD |
| `Employees.tsx` | Employee records |
| `DoctorManagement.tsx` | Doctor-specific staff admin |
| `CareTeam.tsx` | Care-team assignment |
| `ClinicSettings.tsx` | Tenant/branch configuration, domains |
| `Settings.tsx` | General settings |
| `Notifications.tsx` | In-app notification center — extend with outbound channel prefs (§11.16) |
| `QueueDisplay.tsx` | Waiting-room queue TV display — extend with unauthenticated public read-only mode |

---

## 28. APPENDIX B — FULL PERMISSION MATRIX (AS FOUND)

`src/config/permissions.ts` defines the following capability taxonomy (from direct inspection).
This should remain the single source of truth — new modules from Section 11 must add their
permissions here following the same `<module>.<action>` convention rather than inventing a
parallel scheme.

### 28.1 Existing permission groups

| Group | Permissions |
|---|---|
| Dashboards | `module.admin-dashboard`, `module.doctor-dashboard`, `module.nurse-dashboard`, `module.reception-dashboard`, `module.pharmacy-dashboard`, `module.patient-dashboard`, `module.lab-dashboard`, `module.accounts-dashboard`, `module.hr-dashboard`, `module.platform-dashboard`, `module.tenant-dashboard`, `module.branch-dashboard`, `module.radiology-dashboard`, `module.emergency-dashboard`, `module.finance-dashboard`, `module.records-dashboard`, `module.security-dashboard`, `module.housekeeping-dashboard`, `module.developer-dashboard` |
| Organization | `branches.view`, `branches.manage`, `tenants.manage` |
| Patients | `patients.view`, `patients.create`, `patients.edit`, `patients.delete` |
| Appointments | `appointments.view`, `appointments.book`, `appointments.manage`, `appointments.approve`, `appointments.reassign` |
| Doctors | `doctors.view`, `doctors.manage` |
| Consultation | `consultation.view`, `consultation.write` |
| Treatments | `treatments.view`, `treatments.manage` |
| History | `history.view`, `history.edit`, `history.viewOwn` |
| Pharmacy | `pharmacy.view`, `pharmacy.dispense`, `pharmacy.manage` |
| Beds | `beds.view`, `beds.manage` |
| Lab | `lab.view`, `lab.order`, `lab.result`, `lab.review` |
| Billing | `billing.view`, `billing.manage` |
| Staff/org admin | `employees.view`, `employees.manage`, `careTeam.view`, `careTeam.manage`, `staffRoles.view`, `staffRoles.manage`, `payroll.view`, `payroll.manage` |
| Oversight | `reports.view`, `audit.view` |
| Settings | `clinicSettings.manage`, `systemSettings.manage` |
| Shared | `notifications.view` |

### 28.2 The 19 roles

`super_admin`, `tenant_admin`, `branch_manager`, `department_head`, `admin`, `doctor`, `nurse`,
`receptionist`, `pharmacist`, `lab_technician`, `radiology_technician`, `emergency_staff`,
`billing_officer`, `medical_records_officer`, `accountant`, `hr`, `security`, `housekeeping`,
`patient`. `ADMIN_LIKE_ROLES` (`admin`, `tenant_admin`, `super_admin`) inherit the full
Administrator navigation, scoped by RLS.

### 28.3 New permissions required by this upgrade plan

As each module in Section 11 ships, extend the taxonomy with:

| New group | Suggested permissions |
|---|---|
| Diagnosis/CDS (§11.2–11.3) | `diagnosis.code`, `allergies.view`, `allergies.manage`, `cds.override` |
| MAR/Nursing (§11.10) | `mar.view`, `mar.administer`, `handover.view`, `handover.write`, `roster.view`, `roster.manage` |
| OT (§11.11) | `ot.view`, `ot.schedule`, `ot.checklist.sign`, `anesthesia.record` |
| Blood Bank (§11.12) | `bloodbank.view`, `bloodbank.manage`, `bloodbank.issue` |
| Ambulance (§11.13) | `ambulance.dispatch`, `ambulance.track` |
| Telemedicine (§11.15) | `telemedicine.host`, `telemedicine.join` |
| Insurance (§11.8) | `insurance.eligibility.check`, `insurance.preauth.request`, `insurance.preauth.approve`, `insurance.claim.submit` |
| Payments (§11.7) | `payments.view`, `payments.refund`, `payments.reconcile` |
| Compliance (§11.18, §21) | `consent.view`, `consent.manage`, `compliance.export` |
| Public API (§11.20) | `apikeys.view`, `apikeys.manage` |

---

## 29. APPENDIX C — ENVIRONMENT VARIABLES REFERENCE

### 29.1 Currently defined (`.env`, values redacted here for safety)
```
VITE_SUPABASE_PROJECT_ID=<per-environment>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key — safe to expose given RLS is airtight>
VITE_SUPABASE_URL=<per-environment>
VITE_PLATFORM_DOMAINS=hsm.com,hsm.app,hsm.vercel.app,localhost
```

### 29.2 Required additions as this plan is executed

| Variable | Where used | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | **Never** in any `VITE_`-prefixed (client-exposed) variable |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `create-payment-order`, `payment-webhook` Edge Functions | Secret stored in Supabase function secrets, not `.env` |
| `RAZORPAY_WEBHOOK_SECRET` | `payment-webhook` | Used to verify webhook signatures |
| `MSG91_AUTH_KEY` / `WHATSAPP_BSP_TOKEN` | `send-notification` | Per §14.2 |
| `SES_SMTP_CREDENTIALS` or `RESEND_API_KEY` | `send-notification` (email channel) | Per §14.3 |
| `SENTRY_DSN` | Frontend + Edge Functions | Per §10.2 |
| `DAILY_API_KEY` or `TWILIO_VIDEO_SID/SECRET` | Telemedicine module | Per §14.6 |
| `PACS_VIEWER_API_KEY` | Radiology metadata bridge | Per §14.5 |

All secrets above must be set via **Supabase Function Secrets** and **Vercel Environment
Variables**, scoped per environment (dev/staging/prod), never committed to any file in the repo.

---

## 30. APPENDIX D — GLOSSARY

| Term | Meaning |
|---|---|
| **ADT** | Admission, Discharge, Transfer — the core inpatient lifecycle |
| **CDS** | Clinical Decision Support — automated checks (allergy, interaction) assisting clinicians |
| **DPDPA** | Digital Personal Data Protection Act, 2023 (India) — the primary privacy law for this product |
| **EMR/EHR** | Electronic Medical/Health Record |
| **FEFO** | First-Expired-First-Out — inventory dispensing rule (vs. FIFO) |
| **HIS** | Hospital Information System — the core patient/billing/records umbrella |
| **HL7/FHIR** | Health Level 7 / Fast Healthcare Interoperability Resources — data exchange standards |
| **LIS** | Laboratory Information System |
| **MAR** | Medication Administration Record — nursing's real-time dosing chart |
| **MPI** | Master Patient Index — the deduplicated, canonical patient registry |
| **NABH** | National Accreditation Board for Hospitals & Healthcare Providers (India) |
| **OT** | Operation Theatre |
| **PHI** | Protected Health Information |
| **PIS** | Pharmacy Information System |
| **RIS/PACS** | Radiology Information System / Picture Archiving and Communication System |
| **RLS** | Row-Level Security — Postgres's per-row access control, the core of this app's tenant isolation |
| **RPO/RTO** | Recovery Point/Time Objective — disaster-recovery targets |
| **SOAP note** | Subjective, Objective, Assessment, Plan — standard clinical note structure |
| **TAT** | Turnaround Time — e.g., insurance pre-authorization TAT |
| **TPA** | Third-Party Administrator — manages insurance claims on an insurer's behalf |
| **UHID** | Unique Hospital/Health ID — the patient's primary identifier within a tenant |

---

## CLOSING NOTE

The codebase in `socia-clinic.zip` is a real, working foundation — not a prototype to be discarded.
The path to "fully working" is not a rewrite; it is: **harden what exists (Phase 0–1), close the
clinical-safety gaps (Phase 2), make money flow safely (Phase 3), open the communication channels
(Phase 4), then build outward into the remaining HMS modules and interoperability (Phases 5–7)** —
in that order, because each phase is a prerequisite for selling the next one safely. Treat this
document as a living plan: update the status tables in Sections 4 and the checklist in Section 26
as each phase actually ships, so it stays a source of truth rather than a snapshot.

**— End of document —**

## 31. APPENDIX E — SAMPLE DDL FOR HIGHEST-PRIORITY NEW TABLES

Reference DDL for the tables called out as highest priority in Sections 7 and 11, written to match
the existing migration style (tenant-scoped, RLS-enabled). Adapt column types to match the exact
conventions already used in `20260428110712_...initial.sql` (e.g., if patients.id is `uuid`, keep
`uuid` throughout for foreign keys).

```sql
-- Patient allergies (§11.3) — highest clinical-safety priority in the whole plan
create table patient_allergies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  allergen text not null,
  reaction text,
  severity text check (severity in ('mild','moderate','severe','life_threatening')),
  recorded_by uuid not null references profiles(id),
  recorded_at timestamptz not null default now(),
  active boolean not null default true
);
alter table patient_allergies enable row level security;
create policy tenant_isolation on patient_allergies
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Patient medication history (§11.3)
create table patient_medication_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  patient_id uuid not null references patients(id),
  medication text not null,
  dose text,
  status text check (status in ('active','discontinued')) default 'active',
  started_at date not null default current_date,
  discontinued_at date,
  recorded_by uuid references profiles(id)
);
alter table patient_medication_history enable row level security;
create policy tenant_isolation on patient_medication_history
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Medication Administration Record (§11.10) — nursing's real-time dosing chart
create table medication_administration_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  admission_id uuid not null references bed_admissions(id),
  prescription_item_id uuid references prescription_items(id),
  scheduled_time timestamptz not null,
  administered_time timestamptz,
  administered_by uuid references profiles(id),
  status text check (status in ('due','given','missed','refused')) default 'due',
  notes text
);
alter table medication_administration_records enable row level security;
create policy tenant_isolation on medication_administration_records
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
create index idx_mar_due on medication_administration_records (admission_id, scheduled_time)
  where status = 'due';

-- Medicine batches — FEFO dispensing (§11.6)
create table medicine_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  medicine_id uuid not null references medicines(id),
  batch_no text not null,
  expiry_date date not null,
  quantity integer not null check (quantity >= 0),
  cost_price numeric(10,2),
  vendor_id uuid references vendors(id),
  received_at timestamptz not null default now()
);
alter table medicine_batches enable row level security;
create policy tenant_isolation on medicine_batches
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
create index idx_batches_fefo on medicine_batches (medicine_id, expiry_date)
  where quantity > 0;

-- Payments — idempotent, gateway-verified (§11.7, §14.1)
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  bill_id uuid not null references bills(id),
  gateway text not null default 'razorpay',
  gateway_order_id text not null,
  gateway_payment_id text,
  amount numeric(10,2) not null,
  status text check (status in ('created','pending','verified','failed','refunded')) default 'created',
  idempotency_key text not null unique,
  verified_at timestamptz
);
alter table payments enable row level security;
create policy tenant_isolation on payments
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
-- Only the payment-webhook Edge Function (service role) may transition status to 'verified'.
revoke update on payments from authenticated;

-- Audit log — append-only, tamper-evident (§7.4)
create table audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  tenant_id uuid not null,
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  before_hash text,
  after_hash text,
  chain_hash text not null
);
alter table audit_log enable row level security;
create policy tenant_read_own_audit on audit_log for select
  using (tenant_id = current_setting('app.current_tenant_id')::uuid);
revoke update, delete on audit_log from authenticated, anon;
```

### 31.1 RLS coverage introspection query (§12, item 1)

Run this in CI on every migration PR to guarantee no table ships without tenant isolation:

```sql
select relname
from pg_class
where relkind = 'r'
  and relnamespace = 'public'::regnamespace
  and relrowsecurity = false
  and relname not in ('schema_migrations');  -- add any genuinely tenant-agnostic reference tables here explicitly
```

A non-empty result must fail the CI job (§23's `migration-check.yml` already encodes this).

---

## 32. APPENDIX F — QUICK-START FOR THE NEXT ENGINEER PICKING THIS UP

1. Read `SOCIA_CLINIC_BLUEPRINT.md` (existing, 30-part aspirational architecture) for the *long-term*
   target shape, and this document for the *sequenced execution plan* against the actual codebase.
2. Run `npm ci` (after resolving the dual-lockfile issue in §9.1) and `npm run dev` to confirm the
   app boots locally against a Supabase project.
3. Start at **Phase 0** (§24) — do not jump to a "fun" module like telemedicine or AI before the
   RLS audit and CI gate are in place; every later phase depends on those foundations holding.
4. Every new table: copy the DDL pattern in §31 (tenant_id, RLS enabled, tenant_isolation policy) —
   do not add a table without this pattern, even for "just a quick internal thing."
5. Every new mutation that touches money or PHI: route it through an Edge Function per the rule in
   §3.2, not a direct client-side `supabase.from(...).insert(...)`.
6. Keep this document updated: as phases in §24 complete, flip their status in §4's tables from 🔴/🟡
   to 🟢, so the document remains an accurate live audit rather than a historical snapshot.

**— End of document —**
