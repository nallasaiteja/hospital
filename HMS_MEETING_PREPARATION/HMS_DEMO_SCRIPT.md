# Hospital Management System (HMS) – Master Demonstration Script

## Overview for Presenter
This demonstration script is organized into 10 structured sections designed to showcase the complete capabilities of the AURA Hospital Management System to project stakeholders, technical leads, and evaluators.

---

## Demonstration Sequence

### Section 1: System Overview & Architecture Introduction
- **Page to Open**: [Landing Page](http://localhost:5173/)
- **Action to Perform**: Scroll through the executive portal landing page; highlight the clean, professional medical white-background design and modular architecture.
- **Result to Demonstrate**: Modern, responsive layout with immediate entry points for Staff Login and Patient Portal.
- **Technical Explanation**: Built with React 18, TypeScript, Tailwind CSS, and Django REST Framework with Supabase PostgreSQL.
- **Business Value**: Professional hospital branding and single sign-on entry point for network-wide healthcare operations.

---

### Section 2: Authentication & Role-Based Access Control (RBAC)
- **Page to Open**: [Staff Login](http://localhost:5173/staff/login)
- **Action to Perform**:
  1. Log in as Super Admin (`super.admin@aurahospital.com` / password).
  2. Show user profile badge in the header: notice the role tag `SUPER_ADMIN` and data scope `GLOBAL SCOPE`.
  3. Show the sidebar with all 27 accessible modules.
  4. Now log in as Doctor (`dr.arun.sharma@aurahospital.com` / password).
  5. Show how the sidebar dynamically re-scopes strictly to the Doctor Clinical Workspace and Voice Translation.
- **Result to Demonstrate**: Automatic role-based menu filtering and route protection.
- **Technical Explanation**: Implements 3D RBAC: Role + Branch Scope + Maker-Checker separation. Access is validated both client-side via React router guards and server-side via DRF custom permission classes.
- **Business Value**: Prevents unauthorized privilege escalation and protects patient data privacy.

---

### Section 3: Patient Registration & Mandatory-Payment OPD Booking
- **Page to Open**: [Receptionist Appointments Desk](http://localhost:5173/staff/appointments)
- **Action to Perform**:
  1. Demonstrate booking an appointment for an existing or new patient.
  2. Point out that the system requires payment selection (Cash / Online) before booking can proceed.
  3. Confirm the payment and generate an OPD Queue Token.
- **Result to Demonstrate**: Token generated (e.g., Token #04) and registered in the live queue with receipt number.
- **Technical Explanation**: Enforces mandatory payment collection rules. Doctors and non-receptionist roles are blocked from appointment booking.
- **Business Value**: Eliminates unbilled consultations, guarantees revenue collection at intake, and provides queue transparency.

---

### Section 4: Digital Waiting Lounge TV & Queue Telemetry
- **Page to Open**: [Waiting Lounge Digital Display](http://localhost:5173/waiting-lounge-display) & [Lounge TV Page](http://localhost:5173/lounge-tv)
- **Action to Perform**:
  1. Open the Waiting Lounge TV display on a secondary tab/window.
  2. Show the real-time queue list with Token Number, Patient Name, Doctor, and Cabin.
  3. Show the audio call feature: click "Call on TV" from the receptionist or doctor desk to hear the two-tone medical chime and view the flashing alert.
- **Result to Demonstrate**: Audio-visual queue calling for waiting patients.
- **Technical Explanation**: Uses reactive state synchronization and the Web Audio API for synthetic chime generation without heavy external audio files.
- **Business Value**: Reduces patient anxiety, minimizes waiting lounge crowding, and speeds up patient turnaround.

---

### Section 5: Doctor Clinical Workspace & Electronic Prescriptions
- **Page to Open**: [Doctor Clinical Workspace](http://localhost:5173/staff/doctor-workspace)
- **Action to Perform**:
  1. Select the queued patient from the OPD Queue.
  2. Click "Start Consultation".
  3. Enter chief complaints, clinical examination findings, and diagnosis.
  4. Author a prescription: select a medication from the formulary (e.g., Paracetamol, Amoxicillin), select dosage instructions.
  5. Click "Sign & Finalize Consultation".
- **Result to Demonstrate**: Consultation locks as signed, prescription is issued with a digital timestamp and forwarded to the Pharmacy queue.
- **Technical Explanation**: Strict audit trail prevents retroactive alteration of finalized clinical notes; amendments are captured as formal addendums.
- **Business Value**: Eliminates illegible handwriting errors, enforces drug-allergy safeguards, and accelerates pharmacy fulfillment.

---

### Section 6: Nursing Care Station, MAR & Vitals Tracking
- **Page to Open**: [Nurse Clinical Workspace](http://localhost:5173/staff/nurse-workspace)
- **Action to Perform**:
  1. Show the 4 core nursing sections: My Patients, Medication Administration (MAR), Nursing Tasks & Vitals, and Shift Handover.
  2. Click on a patient to record vitals (Blood Pressure, Pulse, SpO2, Temperature).
  3. In the Medication Administration tab, mark a due dose as "Administered" with nurse credentials.
- **Result to Demonstrate**: Patient vitals trend line updates; medication status flips from "Due" to "Administered".
- **Technical Explanation**: Atomic logging of every dose with administering nurse ID and timestamp.
- **Business Value**: Guarantees zero missed medication doses and maintains compliance with inpatient clinical protocols.

---

### Section 7: Diagnostics (Laboratory & Radiology)
- **Page to Open**: [Laboratory Management](http://localhost:5173/staff/laboratory) & [Radiology Suite](http://localhost:5173/staff/radiology)
- **Action to Perform**:
  1. In the Laboratory page, show the Investigation Orders tab and sample collection barcode accessioning.
  2. Demonstrate entering a test result value: show how abnormal/panic values trigger a visual critical alert.
  3. In Radiology, show scheduled modalities (CT, MRI, X-Ray) and radiologist structured reporting.
- **Result to Demonstrate**: Verified laboratory reports ready for physician review; diagnostic results linked directly to patient EMR.
- **Technical Explanation**: Diagnostic orders maintain strict state transitions: `REQUESTED` → `SAMPLE_COLLECTED` → `IN_PROGRESS` → `REPORTED` → `VERIFIED`.
- **Business Value**: Fast diagnostic turnaround and instant clinical alert escalation for life-threatening values.

---

### Section 8: Central Hospital Pricing & Multi-Branch Tariff Sync
- **Page to Open**: [Hospital Pricing & Tariff Management](http://localhost:5173/staff/pricing-tariffs)
- **Action to Perform**:
  1. Open the pricing page as Hospital Admin.
  2. Show the 11 service categories (OPD Consultations, Bed Charges, ICU Care, Lab, Radiology, etc.).
  3. Click "Edit Price" on a service (e.g., General Consultation or Bed Charge).
  4. Change the rate (e.g., ₹500 to ₹600).
  5. Demonstrate the **Price Change Impact Preview**: show the difference (+₹100), percentage change (+20%), and affected branches list.
  6. Enter the required administrative reason and click "Commit Price Across Branches".
- **Result to Demonstrate**: Success banner confirms instantaneous propagation across all branches. The change is immutably appended to the Pricing Audit Trail.
- **Technical Explanation**: Central Tariff Service updates the master rate and propagates deltas to all branches atomically while preserving past invoices and existing inpatient admissions.
- **Business Value**: Eliminates branch pricing discrepancies and guarantees complete administrative tariff control.

---

### Section 9: IPD Inpatient Admissions, Ward Census & 4-Point Discharge
- **Page to Open**: [Inpatient Admissions & Bed Allocation](http://localhost:5173/staff/admissions)
- **Action to Perform**:
  1. Show the interactive Ward & Bed Grid Layout: visual indicators for Available (Green), Occupied (Red), and Cleaning (Yellow).
  2. Demonstrate patient bed allocation and admission deposit collection.
  3. Show the 4-Point Discharge Clearance workflow: Doctor discharge summary, Nursing clearance, Pharmacy return clearance, and Final Billing settlement.
- **Result to Demonstrate**: Bed occupancy stats update dynamically; bed is released for turnover only after all 4 clearances are satisfied.
- **Technical Explanation**: Integrated bed turnover engine prevents double-booking of beds and ensures zero unbilled charges upon discharge.
- **Business Value**: Optimizes hospital bed turnover, reduces Average Length of Stay (ALOS), and prevents revenue leakage at discharge.

---

### Section 10: Financial Suite & Dynamic 5-Language Switching
- **Page to Open**: [Profit & Loss Statement](http://localhost:5173/staff/profit-loss) & [General Ledger](http://localhost:5173/staff/general-ledger)
- **Action to Perform**:
  1. Show the financial dashboard: revenue, operating expenses, and net profit computed directly from posted double-entry journal vouchers.
  2. Point out that there is zero fake/hardcoded revenue: when filters have no transactions, values show clean zero metrics.
  3. **Global Language Switching**:
     - Click the Language Selector in the top navigation bar.
     - Switch to **Hindi (`hi`)**, **Telugu (`te`)**, **Tamil (`ta`)**, or **Kannada (`kn`)**.
     - Show that section titles, headers, cards, and buttons translate immediately across the entire page without reloading.
     - Point out that patient names, doctor names, drug dosages, and currency values remain strictly protected and unchanged.
- **Result to Demonstrate**: Professional, authentic multi-lingual user experience and mathematical financial integrity.
- **Technical Explanation**: Centralized translation dictionary with 100% key parity (1,013 keys across all 5 languages) powered by i18next and double-entry General Ledger accounting.
- **Business Value**: Fully accessible across Indian regional language workforces while meeting MCA audit compliance standards.

