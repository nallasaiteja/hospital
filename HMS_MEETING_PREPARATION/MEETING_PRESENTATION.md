# AURA Hospital Management System (HMS)
## Executive Project Meeting Presentation

---

## Slide 1: Title & Vision
**Project**: AURA Hospital Management System (HMS)  
**Subtitle**: Next-Generation Multi-Branch Clinical & Healthcare Operational Suite  
**Presenter**: Senior Healthcare Systems Engineering Team  
**Vision**: Delivering an end-to-end, paperless, multi-specialty hospital management platform engineered for patient transparency, clinical precision, and verifiable financial integrity.

---

## Slide 2: Industry Challenges & Hospital Pain Points
1. **Queue Friction & Long Patient Wait Times**: Uncoordinated outpatient scheduling causing overcrowded waiting areas and patient frustration.
2. **Clinical Disconnect & Illegible Records**: Fragmented medical records, disconnected lab orders, and medication errors arising from handwritten paper files.
3. **Revenue Leakage & Unbilled Consultations**: Patients consulting physicians without confirmed registration payments, and unbilled ward consumables at discharge.
4. **Multi-Branch Pricing Discrepancies**: Delays and human errors in propagating updated hospital tariffs across distributed clinic and hospital branches.
5. **Language Barriers in Regional Healthcare**: Clinical staff and patients communicate across regional languages (Hindi, Telugu, Tamil, Kannada), while legacy software remains English-only.

---

## Slide 3: The AURA Solution: Core Pillars
- **1. Zero Wait Friction with Digital Queue Displays**: Real-time waiting lounge screens, doctor cabin displays, synthetic medical audio chimes, and live queue status.
- **2. Strict Clinical Separation of Duties**: Doctors focus exclusively on diagnosis and care; receptionists manage bookings and payments; branch managers monitor operational telemetry without unauthorized write access.
- **3. Centralized Tariff Governance**: One-click master pricing updates that instantly synchronize across all active hospital branches while strictly safeguarding historical inpatient billing integrity.
- **4. 100% Dynamic Operational Data**: Zero fake or hardcoded revenue. All financial metrics derive directly from posted, balanced double-entry General Ledger vouchers.
- **5. Native 5-Language Localization**: Full dynamic UI switching across English, Hindi, Telugu, Tamil, and Kannada with 100% dictionary key parity.

---

## Slide 4: Enterprise System Architecture
- **Presentation Layer**: React 18, TypeScript, Tailwind CSS, Vite (Clean, hospital-grade white theme).
- **Application Layer**: Python 3.11/3.12, Django REST Framework 5.1, Gunicorn WSGI.
- **Database & Storage**: Managed PostgreSQL on Supabase (AWS Mumbai) with connection pooling and Row-Level Security (RLS).
- **Security & RBAC**: 3D Role-Based Access Control across 21 roles, asymmetric Supabase JWT Bearer authentication, and append-only MCA audit logging.
- **Infrastructure**: Cloud deployment via Render Blueprint (`render.yaml`) with isolated in-memory SQLite test harness.

---

## Slide 5: The Outpatient Care Journey (OPD)
```
Digital Intake & Registration (MRN Generation)
                ↓
Mandatory Payment Collection (Cash / UPI / Card)
                ↓
Token Generation & Digital Lounge TV Display
                ↓
Doctor Clinical Workspace Consultation
                ↓
Electronic Prescription (Rx) & Diagnostic Orders
                ↓
Pharmacy FEFO Dispensing & Laboratory Accessioning
```
- **Key Feature**: Token cannot be issued without verified payment confirmation.

---

## Slide 6: Inpatient Bed Census & 4-Point Discharge Clearance
- **Interactive Ward Bed Layout**: Real-time visual monitoring of General, Semi-Private, Deluxe, and ICU beds.
- **Bed Status Lifecycle**: `AVAILABLE` → `OCCUPIED` → `CLEANING` → `MAINTENANCE`.
- **Atomic Bed Transfers**: Immediate bed reallocation with automatic status updates.
- **4-Point Discharge Clearance**:
  1. Doctor Clinical Discharge Summary.
  2. Nursing Medication & Cannula Removal.
  3. Pharmacy Drug Return & Clearance.
  4. Billing Final Settlement & Receipt.
- Bed is released for sanitization only after all 4 clearances are recorded.

---

## Slide 7: Central Tariff & Multi-Branch Management
- **Central Pricing Authority**: Hospital Admin manages charges for Appointments, Tokens, Admissions, Room Tariffs, Procedures, and Lab Tests.
- **Multi-Branch Auto-Sync**: Changing a rate (e.g., General Ward bed from ₹1,500 to ₹1,800) updates Branch 1, Branch 2, and Branch 3 automatically.
- **Impact Preview Engine**: Calculates price differences, percentage variance, and affected branches before commit.
- **Non-Destructive Guarantee**: Past invoices, finalized visits, and running inpatient admissions continue at their historical contracted rates.

---

## Slide 8: Financial Governance & Audit Rigor
- **Double-Entry General Ledger**: Mathematical enforcement where `Total Debits == Total Credits`.
- **Zero Fake Revenue**: All revenue, operating expense, and net margin statistics are calculated directly from posted database vouchers.
- **Advance Deposit Isolation**: Admission deposits are held as escrow liabilities and recognized as revenue only upon finalized service invoicing.
- **Cashier Shift Reconciliation**: Compares physical cash counted against system transactions at shift close.
- **Forensic MCA Audit Trail**: Append-only security and price modification history records.

---

## Slide 9: Multi-Lingual Regional Accessibility
- Full language switching for:
  - **English (`en`)**
  - **Hindi (`hi`) – हिन्दी**
  - **Telugu (`te`) – తెలుగు**
  - **Tamil (`ta`) – தமிழ்**
  - **Kannada (`kn`) – ಕನ್ನಡ**
- **Instant Reactive Switching**: Zero page reloads required.
- **Dual Persistence**: Saves to `localStorage` and backend user profile preferences.
- **Clinical Data Safeguard**: Patient names, medical notes, drug formulations, and currency figures remain protected in their authentic format.

---

## Slide 10: Verification Results & Demonstration Readiness
- **Automated Backend Tests**: 329 tests collected; targeted test suites for RBAC, Receptionist payment enforcement, Doctor clinical workflows, Billing, General Ledger, and Procurement executed with **100% pass rate**.
- **Frontend Build Status**: `tsc && vite build` compiled in 4.51s with **0 TypeScript and 0 bundling errors**.
- **Key Parity Audit**: Verified exact **1,013 leaf keys** across all 5 language dictionaries.
- **Demonstration Readiness Classification**:
  $$\mathbf{Classification:\ A\ -\ Ready\ for\ Demonstration}$$
  *(With documented external dependencies for physical lab analyzer hardware and live payment gateway KYC)*.

---

## Slide 11: Roadmap & Commercial Next Steps
1. **Immediate**: Execute executive demonstration using the structured 10-step sequence in `HMS_DEMO_SCRIPT.md`.
2. **Weeks 1-4**: Provision production Render tier and complete Razorpay merchant KYC for live card/UPI processing.
3. **Weeks 5-8**: Deploy on-premise serial analyzer listener and Edge DICOM PACS bridge in pilot hospital branch.
4. **Weeks 9-12**: Complete Ayushman Bharat Digital Mission (ABDM) sandbox compliance.

