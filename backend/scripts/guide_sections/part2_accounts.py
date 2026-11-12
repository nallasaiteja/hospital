# -*- coding: utf-8 -*-
"""Part 2: Comprehensive Accounts & Roles Directory (All 21 Roles)"""

def get_part2():
    return """# PART 2: Comprehensive Accounts & Roles Directory

Every hospital employee is assigned a specific digital persona governed by Role-Based Access Control (RBAC). Below is the complete operational guide for all 21 account roles in AURA HMS.

---

## 2.1 Super Administrator (`SUPER_ADMIN`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Chief Technology Officer (CTO) or Head of Hospital IT Systems.
- **Actual Job:** Oversees the entire enterprise software infrastructure, provisions top-level administrative accounts, enforces data security, manages multi-branch configurations, and reviews global audit trails.
- **Why does the hospital need this account?** Without a Super Admin, no one would have the authority to create new departments, unlock locked staff accounts, or configure new hospital branches.
- **Responsibilities:** Master system configuration, provisioning healthcare staff, assigning security roles, monitoring server and database performance, and overseeing system-wide audit logs.
- **What is OUTSIDE their authority?** The Super Admin is strictly prohibited from altering finalized clinical diagnoses written by doctors, deleting past financial journal vouchers, or editing laboratory test values.

### B. Login & Dashboard
- **After Login:** Lands on the Master Command Center Dashboard (`/staff/dashboard`).
- **Dashboard Displays:**
  1. *OPD Registrations Today:* Live count of outpatients registered across branches.
  2. *Inpatient Bed Occupancy:* Current percentage occupancy and ready beds.
  3. *Pending Diagnostic Reports:* Critical laboratory orders awaiting pathologist verification.
  4. *Emergency Visits & Active Census:* Immediate trauma patients currently under resuscitation.
  5. *Real-Time Live Queue Table:* Active patient tokens waiting in Cardiology, Pediatrics, General Medicine.

### C. Sidebar & Navigation
Has unrestricted global access to all 27 sidebar sections:
- Master Patient Index, OPD Appointments, Emergency, IPD Admissions, Doctor Workspace, Nursing Station, Pathology, Radiology, Pharmacy Formulary, Inventory, OT/ICU Suite, Pricing & Tariffs, Billing Desk, Insurance TPA, General Ledger, Financial Accounts, Transactions, Banking Reconciliation, Investments, Loans, Budgeting, Profit & Loss, HR Operations & Payroll, Assets & Maintenance, Patient Portal, Reports & BI, Users & Roles, and Settings & Audit Trail.

### D. Every Button & Interaction
1. **"Provision Staff" (`+ UserPlus`):**
   - *Location:* Top right of Staff Dashboard.
   - *Behavior:* Opens modal to create a new doctor, nurse, or clerk. Requires Email, Name, Phone, Role, Designation, License, Consultation Fee. Submits `POST /api/v1/auth/provision/`.
2. **"Global Branch Switcher" (`Building2` Dropdown):**
   - *Location:* Top header.
   - *Behavior:* Switches view between Downtown, City Center, and West Wing branches. Updates React `BranchContext`.
3. **"Master RBAC Save" (`ShieldCheck`):**
   - *Location:* `/staff/users-roles`.
   - *Behavior:* Saves granular permission checkbox overrides per role.

### E. Real-Life Practical Examples
1. **Onboarding a Senior Cardiologist:**
   - Dr. Rajiv joins as Head of Cardiology. Super Admin opens Dashboard -> clicks "Provision Staff" -> enters `rajiv.cardio@aura.org`, selects `DOCTOR`, sets fee to ₹1,000, enters MCI license `MCI-2024-9912`. System creates user and generates credentials instantly.
2. **Opening a New Dialysis Ward:**
   - Hospital expands with 20 new dialysis beds. Super Admin goes to `/staff/settings-audit` -> adds Dialysis Ward -> navigates to `/staff/admissions` to generate bed numbers `D-01` to `D-20`.
3. **Investigating a Financial Anomaly:**
   - Hospital Owner spots a ₹50,000 cash refund. Super Admin opens `/staff/settings-audit` -> filters Audit Logs by entity `INVOICE` -> identifies exact cashier ID, IP address, and timestamp of the transaction.

### F. Permissions & Restrictions
- **Can:** View, create, edit, approve, and export all administrative records.
- **Cannot:** Fabricate medical records or bypass cryptographic audit logs.

---

## 2.2 Hospital Administrator (`HOSPITAL_ADMIN`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Chief Operating Officer (COO) or General Hospital Superintendent.
- **Actual Job:** Manages non-clinical hospital operations: branch profitability, patient service charges, pricing tariffs, departmental productivity, facility upkeep, and customer satisfaction.
- **Why needed?** Ensures the hospital functions efficiently as a sustainable business while maintaining clinical service standards.
- **Responsibilities:** Configuring consultation tariffs, bed pricing, monitoring department revenues, approving high-value supply orders, and reviewing incident reports.
- **Outside Authority:** Cannot perform clinical examinations or modify patient medical charts.

### B. Login & Dashboard
- Lands on `/staff/dashboard` with access to high-level clinical and operational indicators, bed occupancy rates, and revenue previews.

### C. Sidebar & Navigation
Has access to all operational, financial, and administrative modules: Patient Management, OPD, IPD, Billing, Tariffs, Pharmacy, Inventory, General Ledger, HR, Reports, and Settings. (Excludes direct doctor workspace editing).

### D. Every Button & Interaction
1. **"Push Tariffs to All Branches" (`Globe`):**
   - *Location:* `/staff/pricing-tariffs`.
   - *Behavior:* Updates hospital service rates across all branches simultaneously with impact analysis.
2. **"Approve Department Purchase Requisition" (`CheckCircle`):**
   - *Location:* `/staff/inventory`.
   - *Behavior:* Authorizes purchase orders exceeding ₹25,000.

### E. Real-Life Practical Examples
1. **Adjusting ICU Bed Rates for Inflation:**
   - Hospital updates ICU bed charges from ₹4,500/day to ₹5,000/day. Hospital Admin opens `/staff/pricing-tariffs` -> edits ICU Daily Rate -> reviews Impact Analysis -> clicks "Apply Central Tariffs".
2. **Reviewing Hospital Bed Shortage:**
   - Dengue outbreak fills 92% of beds. Admin inspects `/staff/dashboard` -> notices General Ward is 100% full -> instructs Nursing Superintendent to convert 15 Daycare beds into temporary IPD beds.
3. **Resolving a Patient Billing Dispute:**
   - Patient disputes a ₹1,200 pharmacy charge. Admin opens `/staff/billing` -> reviews itemized pharmacy dispensing log -> verifies nurse administered medication -> explains charge transparently to family.

### F. Permissions & Restrictions
- **Can:** Update tariffs, view financial ledgers, approve procurement, manage branches.
- **Cannot:** Alter doctor clinical diagnoses or dispense medications.

---

## 2.3 Branch Operations Manager (`BRANCH_MANAGER`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Branch Manager / Facility Director of a specific hospital branch location.
- **Actual Job:** Monitors day-to-day operations of one physical hospital building: OPD queues, bed availability, pharmacy stock levels, cashier reconciliation, and staff attendance.
- **Why needed?** To supervise branch workflows without having the authority to tamper with corporate financials or clinical charts.
- **Responsibilities:** Inspecting real-time branch performance across 14 operational domains in a strictly audited, read-only supervisory command cockpit.
- **Outside Authority:** **STRICT READ-ONLY ENFORCEMENT.** Cannot create invoices, alter clinical notes, edit tariffs, or post journal vouchers (enforced by HTTP 403 Forbidden on write operations).

### B. Login & Dashboard
- Lands on `/staff/branch-manager`, a dedicated **14-Domain Supervisory Cockpit** providing 360-degree operational oversight of the branch.

### C. Sidebar & Navigation
- Receives a specialized navigation menu highlighting the **Branch Operations Hub**, plus read-only views of OPD, IPD, Diagnostics, Pharmacy, and HR.

### D. Every Button & Interaction
1. **"Filter Branch Domain" (Domain Selector Buttons):**
   - *Location:* `/staff/branch-manager`.
   - *Behavior:* Toggles between OPD Queue, IPD Beds, Pharmacy Stock, Billing Totals, and Staff Duty Rosters.
2. **"Export Branch Summary PDF" (`Download`):**
   - *Location:* Top right of Branch Manager cockpit.
   - *Behavior:* Downloads a timestamped operational inspection report for the board of directors.

### E. Real-Life Practical Examples
1. **Investigating Front Desk Queue Bottlenecks:**
   - 45 patients are waiting in the OPD lobby. Branch Manager checks Domain 1 -> notices Doctor Cabin 103 has not started calling tokens -> calls Doctor on duty to resolve delay.
2. **Monitoring Pharmacy Stockouts:**
   - Branch Manager opens Domain 6 (Pharmacy) -> identifies that Paracetamol IV infusions have dropped below safety threshold (15 bottles left) -> alerts Central Warehouse.
3. **Verifying Cashier Daily Handover:**
   - At 8:00 PM shift end, Branch Manager checks Domain 8 (Cash Collections) -> verifies Cashier Counter 1 collected ₹48,500 matching system transactions.

### F. Permissions & Restrictions
- **Can:** View all 14 branch operational domains, download reports, monitor live queues.
- **Cannot:** Perform write, edit, delete, or approve actions anywhere in the system.

---

## 2.4 Medical Director / Chief Medical Officer (`MEDICAL_DIRECTOR`)

### A. Understanding the Account
- **Who is this in a real hospital?** Chief Medical Officer (CMO) or Head of Clinical Governance.
- **Actual Job:** Supervises all clinical care, medical protocols, doctor quality audits, mortality reviews, and clinical safety incidents.
- **Why needed?** Protects clinical standards and ensures compliance with medical council guidelines (NABH/NMC).
- **Responsibilities:** Clinical audit trails, reviewing high-risk surgeries, overseeing antibiotic stewardship, and monitoring clinical incident reports.
- **Outside Authority:** Cannot manipulate accounting journal entries or authorize vendor purchase checks.

### B. Login & Dashboard
- Lands on `/staff/dashboard` with clinical indicators: emergency admissions, ICU census, pending pathology verifications, and clinical mortality alerts.

### C. Sidebar & Navigation
- Access to: Doctor Workspace, Clinical EMR, Nursing MAR, OT/ICU Suites, Pathology LIS, Radiology RIS, Pharmacy Formulary, and Clinical Audit Reports.

### D. Every Button & Interaction
1. **"Review Clinical Audit Trail" (`FileText`):**
   - *Location:* `/staff/reports`.
   - *Behavior:* Inspects doctor prescribing patterns and antibiotic compliance.
2. **"Authorize High-Risk Clinical Protocol" (`ShieldCheck`):**
   - *Location:* `/staff/doctor-workspace`.
   - *Behavior:* Reviews and signs off on complex multi-specialty clinical treatment plans.

### E. Real-Life Practical Examples
1. **Auditing Sepsis Care Protocols:**
   - Medical Director inspects ICU sepsis patients -> verifies all patients received blood culture tests before first antibiotic dose within 60 minutes.
2. **Investigating a Clinical Panic Value:**
   - Lab reports serum potassium of 6.8 mmol/L (life-threatening cardiac risk). Medical Director verifies attending physician received immediate automated SMS alert.
3. **Conducting a Mortality & Morbidity (M&M) Review:**
   - Reviews complete clinical chronological log of a deceased inpatient from emergency admission to ICU cardiac arrest.

### F. Permissions & Restrictions
- **Can:** View all clinical records, unmask anonymized clinical audits, enforce medical policies.
- **Cannot:** Modify financial general ledgers or post cash refunds.

---

## 2.5 Clinical Department Head (`DEPARTMENT_HEAD`)

### A. Understanding the Account
- **Who is this in a real hospital?** Head of Department (HOD), e.g., Head of Cardiology, Head of Orthopedics.
- **Actual Job:** Manages clinical specialists, resident doctors, department duty rosters, and clinical equipment requirements.
- **Why needed?** Coordinates doctors within a medical specialty to ensure 24/7 consultant coverage.
- **Responsibilities:** Approving doctor shift swaps, reviewing department patient volume, requesting specialized surgical equipment.
- **Outside Authority:** Cannot manage other clinical departments or access corporate treasury records.

### B. Login & Dashboard
- Lands on `/staff/dashboard` filtered to their clinical specialty (e.g., Cardiology OPD queue and inpatient census).

### C. Sidebar & Navigation
- Access to: Doctor Workspace, Appointments, Inpatient Admissions, OT Schedules, Department Staff Rosters, and Departmental Reports.

### D. Every Button & Interaction
1. **"Approve Shift Swap" (`Check`):**
   - *Location:* `/staff/doctors-nursing`.
   - *Behavior:* Approves Dr. Sneha covering Dr. Rajiv's night on-call shift.
2. **"Submit Equipment Requisition" (`Plus`):**
   - *Location:* `/staff/inventory`.
   - *Behavior:* Requests 2 new 12-lead ECG machines for Cardiology OPD.

### E. Real-Life Practical Examples
1. **Managing Emergency On-Call Roster:**
   - HOD Cardiology ensures an interventional cardiologist is on duty 24/7 for emergency angioplasties.
2. **Reviewing Department OPD Wait Times:**
   - HOD notices Cardiology patients wait an average of 48 minutes -> opens an additional consultation room.
3. **Evaluating Resident Doctor Prescriptions:**
   - Reviews junior doctor prescription logs to ensure compliance with hospital antibiotic guidelines.

### F. Permissions & Restrictions
- **Can:** Edit department rosters, review department clinical records, submit supply requests.
- **Cannot:** Access financial ledgers or alter other medical departments.

---

## 2.6 Consultant & Attending Physician (`DOCTOR`)

### A. Understanding the Account
- **Who is this in a real hospital?** A licensed medical doctor (MBBS/MD/MS/DM) consulting patients.
- **Actual Job:** Examines outpatients and inpatients, records medical histories, diagnoses illnesses using ICD-10, prescribes medications (e-Rx), orders laboratory/radiology investigations, and plans surgeries.
- **Why needed?** Only licensed medical practitioners possess the legal authority to diagnose disease and prescribe prescription drugs.
- **Responsibilities:** Accurate documentation of Chief Complaints, vital signs, physical examinations, drug prescriptions, and discharge summaries.
- **Outside Authority:** **STRICT PROHIBITION:** Doctors cannot collect billing fees, book appointments, dispense pharmacy medicines, or edit historical consultation notes once locked.

### B. Login & Dashboard
- **After Login:** Directly opens the **Doctor Clinical Workspace** (`/staff/doctor-workspace`) or Staff Dashboard.
- **Key Display:**
  1. *My Waiting Queue Today:* Number of patients checked in and waiting outside cabin.
  2. *My Completed Visits:* Consultations completed today.
  3. *Critical Lab Panic Alerts:* Urgent abnormal test results for assigned patients.
  4. *Active Inpatients Under My Care:* Admitted ward and ICU patients.

### C. Sidebar & Navigation
- Streamlined clinical access: Doctor Workspace, Master Patient Index (restricted clinical view), OPD Queue, IPD Admissions & Wards, OT Schedules, Lab & Radiology Results.

### D. Every Button & Interaction
1. **"Call Patient" (`Volume2` / `UserCheck`):**
   - *Location:* Top of Doctor Workspace queue.
   - *Behavior:* Broadcasts audio chime on Waiting Lounge TV ("Token #A-014 please proceed to Cabin 102"). Transitions appointment status to `IN_CONSULTATION`.
2. **"Add Medication (e-Rx)" (`Plus` / `Pill`):**
   - *Location:* Prescription tab in Doctor Workspace.
   - *Behavior:* Opens formulary drug search. Doctor types brand or generic name (e.g. "Augmentin 625mg"), selects dosage (1 tablet), frequency (Twice Daily), duration (5 Days), instructions ("After Food"). Checks allergy alerts against patient record.
3. **"Order Diagnostic Test" (`Activity`):**
   - *Location:* Lab/Radiology Orders tab.
   - *Behavior:* Selects tests (e.g. "Complete Blood Count", "Lipid Profile", "Chest X-Ray PA View"). Transmits order immediately to LIS and RIS.
4. **"Finalize & Lock Consultation" (`Lock` / `CheckCircle`):**
   - *Location:* Bottom right of Doctor Workspace.
   - *Behavior:* Generates cryptographic digital signature. Locks consultation record against tampering. Pushes e-prescription to Pharmacy and orders to Lab/Billing.
5. **"Recommend Inpatient Admission" (`Bed`):**
   - *Location:* Clinical disposition section.
   - *Behavior:* Prepares electronic admission chit specifying admitting diagnosis and recommended ward category (General, ICU, Deluxe).

### E. Real-Life Practical Examples
1. **Consulting a Fever Patient (Rahul):**
   - Dr. Kumar clicks "Call Patient" for Token #A-014 (Rahul, 28M). Rahul enters Cabin 102.
   - Dr. Kumar logs vitals: Temp 102.4°F, BP 120/80, Pulse 98 bpm.
   - Notes Chief Complaints: "High grade fever with chills for 3 days".
   - Selects ICD-10 diagnosis: `A09 - Acute gastroenteritis`.
   - Prescribes Paracetamol 650mg TDS and ORS sachets.
   - Clicks "Finalize Consultation". Prescription appears on Pharmacist screen instantly.
2. **Managing a Critical Lab Panic Alert:**
   - While examining an outpatient, a red alert pops up: Inpatient Sunita's Platelet count dropped to 18,000/µL (severe thrombocytopenia). Dr. Kumar immediately orders 4 units of Random Donor Platelets (RDP) and stat bedside hematology review.
3. **Signing an Inpatient Discharge Summary:**
   - Admitted patient recovers from pneumonia. Dr. Kumar opens `/staff/admissions` -> types discharge course, home oral antibiotics, and follow-up date in 7 days -> clicks "Initiate Discharge".

### F. Permissions & Restrictions
- **Can:** Record clinical findings, prescribe drugs, order tests, sign discharge summaries.
- **Cannot:** Book appointments, collect cash, edit locked clinical notes, access accounting ledgers.

---

## 2.7 Staff Nursing Officer (`NURSE`)

### A. Understanding the Account
- **Who is this in a real hospital?** Registered General Nurse (GNM / B.Sc Nursing) on ward or ICU duty.
- **Actual Job:** Direct bedside patient care: recording hourly vital signs, administering IV medications, maintaining Medication Administration Records (MAR), wound dressings, and preparing patients for surgery.
- **Why needed?** Doctors visit patients once or twice a day; nurses safeguard patients 24 hours a day.
- **Responsibilities:** Timely administration of prescribed medicines, charting vitals, logging fluid intake/output, SBAR shift handovers, and nursing discharge clearance.
- **Outside Authority:** Nurses cannot prescribe new drugs, change medication dosages, or modify patient financial invoices.

### B. Login & Dashboard
- Lands on `/staff/dashboard` with ward census, bed occupancy, and nursing task lists.
- Uses `/staff/doctors-nursing` and `/staff/admissions` as primary operational homes.

### C. Sidebar & Navigation
- Access to: Inpatient Admissions, Doctors & Nursing, Patient Management, Emergency Casualty, Surgery & OT Suite, and Patient Portal Gateway.

### D. Every Button & Interaction
1. **"Log Vitals" (`Heart` / `Activity`):**
   - *Location:* Inpatient detail screen.
   - *Behavior:* Opens modal to record BP, Pulse, Temperature, SpO2, Respiratory Rate, and Pain Score. Charts on patient timeline.
2. **"Administer Dose" (`Check` in MAR tab):**
   - *Location:* Medication Administration Record.
   - *Behavior:* Marks scheduled medication dose as "Administered" with exact timestamp and digital nurse signature. Can also mark "Missed" or "Refused" with required clinical reason.
3. **"Nursing Discharge Clearance" (`CheckCircle`):**
   - *Location:* Inpatient Discharge 4-Point Clearance Checklist.
   - *Behavior:* Confirms removal of IV cannulas, catheter, wound dressing check, return of patient belongings, and bed handover.

### E. Real-Life Practical Examples
1. **Administering 8:00 AM IV Antibiotic:**
   - Nurse Sunita checks Inpatient Bed G-04 (Rahul). Sees scheduled 8:00 AM Ceftriaxone 1g IV. Scans medicine vial, checks patient ID band, administers IV infusion over 30 minutes, clicks "Administer Dose" on MAR.
2. **Handling Post-Op Hypotension:**
   - Patient returns from hernia surgery. Nurse logs vitals: BP drops to 85/50 mmHg. System flags yellow vital alert. Nurse immediately elevates patient legs, starts normal saline bolus, and presses "Call Attending Doctor".
3. **Conducting SBAR Shift Handover:**
   - At 2:00 PM shift change, Day Nurse Sunita logs electronic SBAR note (Situation, Background, Assessment, Recommendation) for Evening Nurse Priya.

### F. Permissions & Restrictions
- **Can:** Chart vitals, log MAR administrations, update nursing care sheets, clear nursing discharge.
- **Cannot:** Prescribe medications, change bed tariffs, collect billing payments.

---

## 2.8 Front Desk Receptionist (`RECEPTIONIST`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Front Desk Executive welcoming patients at the hospital main entrance.
- **Actual Job:** Greets patients, searches for existing records, registers new patients in the Master Patient Index, books OPD doctor appointments, collects consultation fees, issues sequential queue tokens, and directs patients to waiting lounges.
- **Why needed?** First human and digital touchpoint. Prevents duplicate patient records and ensures every patient has a verified token and paid consultation ticket.
- **Responsibilities:** Accurate demographic entry, doctor schedule coordination, queue management, cash drawer collection for consultation tickets.
- **Outside Authority:** **STRICT PROHIBITION:** Cannot view private clinical histories, write medical notes, alter pharmacy stock, access hospital general ledgers, or modify tariffs.

### B. Login & Dashboard
- **After Login:** Lands on the **Role-Tailored Receptionist Command Center** (`/staff/dashboard`).
- **Dashboard Displays:**
  1. *OPD Registrations Today:* Live count of outpatient tickets created today.
  2. *Inpatient Bed Occupancy:* Percentage occupancy and count of clean beds ready for admission.
  3. *Waiting in Lounge:* Active checked-in patients waiting for doctor token calls.
  4. *Completed Consultations:* Finished doctor visits today.
  5. *Front Desk Quick Launch Banner:* 1-click shortcut directly into OPD Appointments (`/staff/appointments`).
  6. *Live Operational Workflows:* OPD Consultations, Inpatient Admissions, and Patient Registration & Records. (Irrelevant cards like Pathology Lab, Pharmacy Formulary, General Ledger, and Hospital Audit are completely hidden).

### C. Sidebar & Navigation
- Strictly restricted to front-desk authorized modules:
  - `1. Dashboard` (`/staff/dashboard`)
  - `2. Patient Management` (`/staff/patients`)
  - `3. OPD & Appointments` (`/staff/appointments`)
  - `5. IPD & Admissions` (`/staff/admissions`)
  - `24. Patient Portal Gateway` (`/staff/patient-portal`)

### D. Every Button & Interaction
1. **"Register Patient" (`+ UserPlus`):**
   - *Location:* `/staff/patients`.
   - *Behavior:* Opens Master Patient Index registration modal. Enters First Name, Last Name, Phone, Gender, DOB, Blood Group, Emergency Contact, Allergies. Submits `POST /api/v1/core/patients/`. Automatically generates unique `MRN-2026-XXXXX`.
2. **"Book Appointment" (`CalendarPlus`):**
   - *Location:* `/staff/appointments`.
   - *Behavior:* Selects Patient MRN, Department (e.g. General Medicine), Consulting Doctor (Dr. Kumar), Date (Today), and Time Slot (10:30 AM). Checks doctor availability.
3. **"Collect Payment & Issue Token" (`CheckCircle` / `Receipt`):**
   - *Location:* Mandatory Payment Modal inside Appointment Booking.
   - *Behavior:* Selects payment mode (Cash, Card, UPI). Enters collected consultation fee (₹500). System records financial receipt, locks slot, issues sequential queue token (e.g. `#A-014`), and sends token to Lounge TV.
4. **"Check-In Patient" (`UserCheck`):**
   - *Location:* Today's Appointments table.
   - *Behavior:* Changes status from `SCHEDULED` to `CHECKED_IN`. Patient appears on Doctor's active waiting queue.
5. **"Admit Inpatient" (`Bed`):**
   - *Location:* `/staff/admissions`.
   - *Behavior:* Selects patient with doctor admission chit, chooses vacant bed (e.g. `G-04`), collects advance deposit (₹5,000), and creates admission record.

### E. Real-Life Practical Examples
1. **Registering a First-Time Patient (Rahul):**
   - Rahul visits with fever. Receptionist Priya asks: "Have you visited AURA Hospital before?" Rahul says no. Priya clicks "Register Patient", enters: Rahul Verma, 28, Male, Phone `9876543210`, Blood Group `O+`, No known drug allergies. System saves record and generates `MRN-2026-00142`.
2. **Booking OPD Consultation & Collecting Payment:**
   - Rahul wants to see a General Physician. Priya clicks "Book Appointment", selects Dr. Kumar, slot 10:30 AM. Fee is ₹500. Priya asks: "How will you pay?" Rahul pays via UPI QR code. Priya selects UPI, clicks "Collect Payment & Issue Token". Printer prints receipt and Token Slip #A-014. Priya says: "Please take a seat in Lounge A; screen will call your token."
3. **Searching for a Returning Patient by Phone Number:**
   - Patient Anjali visits without her card. Priya types `9849012345` into the search bar. System brings up Anjali's profile in 0.2 seconds with her permanent MRN, preventing duplicate registration.

### F. Permissions & Restrictions
- **Can:** Register patients, search records, book appointments, collect advance/consultation fees, admit patients to vacant beds, issue tokens.
- **Cannot:** Enter clinical diagnoses, view doctor private notes, dispense medicines, delete financial records, access general ledgers.

---

## 2.9 Registered Hospital Patient (`PATIENT`)

### A. Understanding the Account
- **Who is this in a real hospital?** The patient or their family caregiver accessing healthcare records.
- **Actual Job:** Accesses personal medical summaries, downloads digital prescriptions, views lab reports, checks upcoming appointments, and reviews hospital bills from a smartphone or home computer.
- **Why needed?** Empowers patients with transparency, eliminates physical paper loss, and satisfies medical privacy regulations.
- **Responsibilities:** Managing personal profile, attending booked appointments on time, settling outstanding bills.
- **Outside Authority:** **STRICT RECORD ISOLATION.** A patient can view *only their own records*. They have zero visibility into any other patient or hospital operational system.

### B. Login & Dashboard
- Lands on the dedicated **Patient Self-Service Portal** (`/patient/dashboard`).
- Displays: My Upcoming Appointments, My Prescriptions, My Lab Reports, My Billing Receipts, and Download Discharge Summary.

### C. Sidebar & Navigation
- Restricted strictly to patient self-service views:
  - Dashboard Overview (`/patient/dashboard`)
  - My Appointments (`/patient/appointments`)
  - My Prescriptions (`/patient/prescriptions`)
  - Diagnostic Reports (`/patient/reports`)
  - Invoices & Receipts (`/patient/billing`)

### D. Every Button & Interaction
1. **"Book New Appointment" (`Calendar`):**
   - *Behavior:* Allows patient to select doctor, specialty, and preferred slot from home.
2. **"Download Prescription PDF" (`Download`):**
   - *Behavior:* Generates certified digital PDF of doctor's signed prescription with clinic header and QR verification.
3. **"View Lab Results" (`FileText`):**
   - *Behavior:* Opens pathologist-verified lab report with biological reference ranges.

### E. Real-Life Practical Examples
1. **Downloading Prescription at a Chemist:**
   - Rahul visits a local chemist near his home. Opens his phone, logs into AURA Patient Portal, clicks "Download Prescription", and shows verified e-Rx to pharmacist.
2. **Checking Blood Test Results from Home:**
   - Rahul had blood drawn at 11:00 AM. At 3:00 PM, he receives an SMS notification. Logs into portal and views verified CBC report showing Normal WBC count.
3. **Checking Total Hospital Expense Receipt:**
   - Rahul downloads his ₹500 consultation payment receipt for tax / corporate health reimbursement.

### F. Permissions & Restrictions
- **Can:** View own appointments, prescriptions, verified lab reports, and billing receipts.
- **Cannot:** Access any other patient record, view doctor internal draft notes, or access hospital staff views.

---

## 2.10 Billing Executive (`BILLING_EXECUTIVE`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Senior Inpatient & Outpatient Billing Officer.
- **Actual Job:** Calculates patient hospitalization charges, itemizes doctor visit fees, bed tariffs, OT surgical charges, pharmacy dockets, and diagnostic services. Prepares finalized tax invoices and manages insurance pre-auth balances.
- **Why needed?** Ensures the hospital correctly bills every provided service and produces legally compliant, itemized tax invoices.
- **Responsibilities:** Inpatient running bills, final discharge invoices, advance deposit reconciliations, insurance claim itemizations, and payment collection.
- **Outside Authority:** Cannot alter clinical treatment notes or dispense physical drugs.

### B. Login & Dashboard
- Lands on `/staff/billing` with counters for Today's Total Collections, Outstanding Inpatient Balances, Bills Awaiting Settlement, and Cashier Drawer status.

### C. Sidebar & Navigation
- Access to: Billing Desk, Cashier Floats, Inpatient Admissions, Master Patient Index, Insurance & TPA Claims, Tariff Management (read-only), and Financial Reports.

### D. Every Button & Interaction
1. **"Generate Final Bill" (`FileSpreadsheet`):**
   - *Location:* `/staff/billing`.
   - *Behavior:* Pulls all unbilled charges from bed occupancy, nursing MAR, lab tests, radiology scans, and pharmacy dispensations into an itemized bill.
2. **"Apply Approved Discount" (`Percent`):**
   - *Location:* Invoice generation screen.
   - *Behavior:* Applies an authorized discount percentage with required administrative approval reason code.
3. **"Settle & Print Invoice" (`Printer`):**
   - *Location:* Payment collection screen.
   - *Behavior:* Deducts advance deposits from gross total, accepts balance payment via Cash/Card/UPI, locks invoice, and generates GST-compliant Tax Invoice PDF.

### E. Real-Life Practical Examples
1. **Settling a 4-Day Inpatient Bill:**
   - Patient Rahul is ready for discharge. Billing Executive reviews charges: 4 days General Ward (₹6,000), Doctor visits (₹2,400), Lab tests (₹1,800), Pharmacy medicines (₹2,200). Gross: ₹12,400. Subtracts ₹5,000 advance deposit. Collects net balance ₹7,400 via Credit Card. Prints Final Zero-Due Invoice.
2. **Processing an Inpatient Running Bill for Family Review:**
   - An admitted patient's son asks how much has been spent so far. Billing Executive clicks "Print Interim Bill" showing exact charges accrued up to that morning.
3. **Splitting Payment Across Multiple Modes:**
   - Patient owes ₹15,000. Pays ₹5,000 in Cash and ₹10,000 via UPI. Billing Executive selects Split Payment, enters both transaction IDs, and completes settlement.

### F. Permissions & Restrictions
- **Can:** Generate invoices, collect payments, apply approved discounts, print receipts.
- **Cannot:** Prescribe medications, change tariff base prices, delete finalized invoices.

---

## 2.11 Cash Counter Cashier (`CASHIER`)

### A. Understanding the Account
- **Who is this in a real hospital?** The Cash Counter Teller in the hospital billing lobby.
- **Actual Job:** Manages the physical cash drawer: receives cash and card payments for outpatient consultation tickets, diagnostic tests, and pharmacy purchases; issues printed receipts; reconciles cash at shift end.
- **Why needed?** Safeguards hospital physical currency and ensures zero variance between collected physical cash and recorded system revenue.
- **Responsibilities:** Opening shift cash float entry, collecting payments, counting currency denominations, and closing shift handover.
- **Outside Authority:** Cannot alter service prices, delete receipts, or waive charges without supervisor sign-off.

### B. Login & Dashboard
- Lands on the Cash Drawer Desk inside `/staff/billing`.
- Displays: My Active Drawer Float, Today's Cash Collected, UPI Collections, Credit Card Slips, and Cash Surplus/Deficit status.

### C. Sidebar & Navigation
- Streamlined access to Billing Cash Drawer, Payment Collection, and Cash Reconciliation Reports.

### D. Every Button & Interaction
1. **"Open Cash Drawer" (`Key`):**
   - *Location:* Shift start modal.
   - *Behavior:* Enters opening cash float (e.g. ₹5,000 in small change notes). Initializes cashier session.
2. **"Collect Cash Payment" (`DollarSign`):**
   - *Location:* Payment modal.
   - *Behavior:* Enters currency received (e.g. ₹1,000 for ₹800 bill). System calculates change to return (₹200) and prints receipt.
3. **"Close Drawer & Reconcile Shift" (`Lock`):**
   - *Location:* End of shift.
   - *Behavior:* Cashier enters physical denomination breakdown (number of ₹500, ₹200, ₹100, ₹50, ₹20, ₹10 notes). Compares against system total. Flags zero-variance or cash discrepancy.

### E. Real-Life Practical Examples
1. **Opening Morning Shift Cash Drawer:**
   - Cashier Ramesh arrives at 7:45 AM. Opens drawer, verifies ₹5,000 float provided by treasury, logs into system, enters ₹5,000 opening float, and activates counter.
2. **Collecting OPD Consultation Cash:**
   - Patient pays ₹500 cash for Doctor Kumar token. Ramesh enters ₹500, drawer opens automatically, receipt prints in 3 seconds, Ramesh hands receipt and token to patient.
3. **End-of-Day Shift Cash Audit:**
   - At 4:00 PM, Ramesh counts physical drawer: total ₹68,400. System records show ₹68,400. Perfect zero-variance match. Ramesh signs electronic cash handover slip and deposits cash into hospital safe.

### F. Permissions & Restrictions
- **Can:** Collect payments, issue receipts, count denominations, close shift drawer.
- **Cannot:** Issue refunds above ₹500 without manager approval, modify bills, delete transactions.

---

## 2.12 Registered Pharmacist (`PHARMACIST`)

### A. Understanding the Account
- **Who is this in a real hospital?** A licensed hospital pharmacist (B.Pharm / D.Pharm).
- **Actual Job:** Dispenses prescribed medications to outpatients and inpatients, checks for dangerous drug interactions and allergies, manages pharmacy inventory using First-Expiring, First-Out (FEFO), monitors narcotic drug lockers, and flags expired stock.
- **Why needed?** Ensures patient drug safety, prevents medication errors, and stops expired medications from reaching patients.
- **Responsibilities:** Validating doctor e-prescriptions, FEFO batch selection, inventory decrementing, patient medication counseling, and expiry date auditing.
- **Outside Authority:** Pharmacists cannot prescribe new drugs or alter doctor prescription dosages without consulting the physician.

### B. Login & Dashboard
- Lands on the **Pharmacy Command Dashboard** (`/staff/pharmacy`).
- Displays:
  1. *Pending Prescriptions:* Doctor prescriptions transmitted from OPD and Wards.
  2. *Near-Expiry Stock Alerts:* Drug batches expiring within 30, 60, or 90 days.
  3. *Out-of-Stock / Low Stock Warnings:* Items below reorder threshold.
  4. *Today's Dispensed Medications:* Count of fulfilled prescriptions.

### C. Sidebar & Navigation
- Access to: Pharmacy Formulary & Dispensing, Central Inventory, Master Patient Index (read-only), Inpatient Admissions, and Drug Consumption Reports.

### D. Every Button & Interaction
1. **"Dispense Prescription" (`PackageCheck`):**
   - *Location:* Prescription dispensing queue.
   - *Behavior:* Scans medicine barcode. System automatically selects nearest-expiry batch (FEFO). Validates available quantity. Decrements stock and sends charge to billing.
2. **"Flag Drug-Allergy Interaction" (`AlertTriangle`):**
   - *Location:* Prescription validation screen.
   - *Behavior:* Blocks dispensing if patient allergy record conflicts with prescribed drug (e.g. Penicillin allergy vs Amoxicillin). Prompts immediate doctor notification.
3. **"Mark Batch Expired / Quarantine" (`ShieldAlert`):**
   - *Location:* Stock inventory tab.
   - *Behavior:* Quarantines expired boxes into locked disposal area, blocking them from ever appearing in dispensing searches.

### E. Real-Life Practical Examples
1. **Dispensing Outpatient Antibiotic via FEFO:**
   - Rahul presents prescription for Azithromycin 500mg. Pharmacist searches inventory: Batch `AZ-101` expires in 2 months; Batch `AZ-205` expires in 14 months. System automatically locks Batch `AZ-101` for dispensing first, preventing waste.
2. **Catching a Drug-Allergy Hazard:**
   - Doctor inadvertently prescribes Cephalexin to a patient with documented severe cephalosporin anaphylaxis. System flashes bright red banner. Pharmacist stops dispensing and calls doctor to switch to Azithromycin.
3. **Returning Unused Inpatient Medicines on Discharge:**
   - Discharged patient has 4 unopened vials of IV Pantoprazole. Pharmacist inspects seal integrity, clicks "Restock Return", credits patient bill ₹480, and restocks inventory.

### F. Permissions & Restrictions
- **Can:** Dispense medications, adjust batch locations, quarantine expired stock, log returns.
- **Cannot:** Prescribe medications, delete stock logs, dispense expired batches.

---

## 2.13 Medical Laboratory Technician (`LAB_TECHNICIAN`)

### A. Understanding the Account
- **Who is this in a real hospital?** A qualified Medical Laboratory Technologist (DMLT / B.Sc MLT).
- **Actual Job:** Accessions biological specimens (blood, urine, tissue), prints barcode labels, runs automated hematology and biochemistry analyzers, enters diagnostic test results, flags critical panic values, and routes reports to pathologists for digital sign-off.
- **Why needed?** Over 70% of medical diagnoses depend on laboratory test findings.
- **Responsibilities:** Specimen accessioning, calibration of laboratory analyzers, result entry, panic value alerts, and quality control.
- **Outside Authority:** Lab technicians cannot release final diagnostic reports to patients without authorized Pathologist / Medical Officer sign-off.

### B. Login & Dashboard
- Lands on `/staff/laboratory`.
- Displays: Requisitions Received Today, Samples Awaiting Phlebotomy, Tests In-Process, Critical Panic Values Awaiting Escalation, and Reports Ready for Pathologist Review.

### C. Sidebar & Navigation
- Access to: Laboratory & Diagnostics (LIS), Master Patient Index (read-only), Doctor Workspace (test view), and Quality Control Logs.

### D. Every Button & Interaction
1. **"Accession Specimen & Print Barcode" (`Barcode`):**
   - *Location:* Laboratory orders queue.
   - *Behavior:* Verifies specimen collection tube (e.g. EDTA purple top for CBC), generates barcode `LAB-2026-9921`, changes status to `SAMPLE_COLLECTED`.
2. **"Enter Test Results" (`Edit3`):**
   - *Location:* Laboratory specimen worklist.
   - *Behavior:* Enters numerical values (e.g. Hemoglobin `13.5 g/dL`, WBC `8,200 /µL`). System compares against biological reference intervals.
3. **"Flag Critical Panic Value" (`AlertOctagon`):**
   - *Location:* Result entry modal.
   - *Behavior:* If a test result is life-threatening (e.g. Blood Glucose 35 mg/dL or Potassium 6.8 mmol/L), button triggers immediate flashing siren alert on Doctor and Nurse screens.
4. **"Submit for Pathologist Sign-Off" (`Send`):**
   - *Location:* Report review tab.
   - *Behavior:* Packages entered values into draft diagnostic report for Pathologist digital authorization.

### E. Real-Life Practical Examples
1. **Processing Rahul's Complete Blood Count (CBC):**
   - Lab Tech collects 3ml blood in EDTA tube. Prints barcode label `CBC-0042`. Runs tube through automated 5-part hematology analyzer. Inputs values: Hb 14.1, WBC 9,100, Platelets 220,000. All normal. Clicks "Submit for Pathologist Review".
2. **Handling a Severe Panic Value:**
   - Testing an inpatient's blood gas shows pH 7.12 (severe acidosis). Lab Tech presses "Flag Panic Value", logs immediate telephone notification to ICU Resident Doctor with timestamp and doctor name.
3. **Rejecting a Hemolyzed Blood Specimen:**
   - Blood sample arrives hemolyzed (red blood cells ruptured during collection). Lab Tech clicks "Reject Specimen", enters reason "In-vitro hemolysis", and triggers automatic re-draw requisition at nursing station.

### F. Permissions & Restrictions
- **Can:** Accession samples, print barcodes, input test values, flag panic alerts.
- **Cannot:** Authorize and publish diagnostic reports without Pathologist verification.

---

## 2.14 Radiographer & Imaging Technician (`RADIOLOGY_TECHNICIAN`)

### A. Understanding the Account
- **Who is this in a real hospital?** A licensed Radiologic Technologist (B.Sc Medical Imaging Technology).
- **Actual Job:** Performs diagnostic imaging studies: X-Rays, CT Scans, MRI, Ultrasound, and Mammography. Positions patients, ensures radiation safety protocols (ALARA), uploads DICOM study links to PACS, and prepares technical impressions.
- **Why needed?** Operates multi-crore medical imaging machinery and captures clear radiological views required for surgical and clinical diagnosis.
- **Responsibilities:** Patient radiation shielding, modality operations, DICOM image upload, imaging worklist management.
- **Outside Authority:** Radiographers cannot issue legal clinical radiological interpretations; only a Radiologist (MD Radiology) can sign final diagnostic reports.

### B. Login & Dashboard
- Lands on `/staff/radiology`.
- Displays: Imaging Modality Worklist (X-Ray, CT, MRI), Completed Scans Today, Scans Awaiting Radiologist Reporting, and Equipment Safety Logs.

### C. Sidebar & Navigation
- Access to: Radiology & Medical Imaging (RIS), Master Patient Index, Emergency Casualty, and Equipment Maintenance.

### D. Every Button & Interaction
1. **"Start Examination" (`Play`):**
   - *Location:* Modality worklist.
   - *Behavior:* Confirms patient identity, checks pregnancy status for females, records radiation dose (mGy), transitions order to `EXAMINATION_IN_PROGRESS`.
2. **"Attach DICOM / PACS Study Link" (`Link` / `Upload`):**
   - *Location:* Study completion modal.
   - *Behavior:* Connects imaging series from PACS server to the patient order record.
3. **"Route to Radiologist Workstation" (`Send`):**
   - *Location:* Completed study screen.
   - *Behavior:* Transmits imaging study for formal radiologist interpretation and clinical impression.

### E. Real-Life Practical Examples
1. **Executing an Emergency Chest X-Ray:**
   - Trauma patient arrives with breathing distress. Radiographer performs portable bedside Chest X-Ray, attaches DICOM study link within 4 minutes, and notifies Radiologist.
2. **Safety Screening for MRI:**
   - Patient scheduled for Brain MRI. Radiographer conducts strict metal screening: discovers cardiac pacemaker implant. Immediately halts scan, preventing severe patient injury.
3. **Uploading CT Scan Series:**
   - Completes 500-slice CT Abdomen study, links PACS accession number, routes to Senior Radiologist for contrast enhancement reporting.

### F. Permissions & Restrictions
- **Can:** Operate modalities, log radiation doses, attach DICOM study links.
- **Cannot:** Sign final radiological diagnostic interpretation reports.

---

## 2.15 Senior Hospital Accountant (`ACCOUNTANT`)

### A. Understanding the Account
- **Who is this in a real hospital?** Senior Hospital Accountant / Bookkeeper.
- **Actual Job:** Manages daily bookkeeping: verifies cashier drawer collections, posts journal vouchers to the General Ledger, audits Accounts Payable (AP) and Accounts Receivable (AR), checks vendor invoices against Goods Received Notes (GRN), and prepares bank reconciliations.
- **Why needed?** Ensures every rupee entering or leaving the hospital is legally documented under standard double-entry accounting rules.
- **Responsibilities:** Journal voucher drafting, bank reconciliation, vendor invoice verification, trial balance auditing.
- **Outside Authority:** Cannot approve self-created vouchers (requires Finance Manager separation of duty) or alter medical clinical records.

### B. Login & Dashboard
- Lands on the **Financial Management Command Hub** (`/staff/financial-accounts`).
- Displays: Today's Total Cash Collections, Accounts Receivable Aging, Accounts Payable Due, Unposted Journal Vouchers, and Bank Balance Summary.

### C. Sidebar & Navigation
- Full financial suite: Chart of Accounts, Financial Transactions, General Ledger, Banking Reconciliation, Investments, Loans, Budgeting, Profit & Loss, Billing, and Tariff Management.

### D. Every Button & Interaction
1. **"Draft Journal Voucher" (`Plus`):**
   - *Location:* `/staff/general-ledger`.
   - *Behavior:* Enters balanced debit and credit ledger lines with transaction narration. Validates that `Total Debits == Total Credits`.
2. **"Reconcile Bank Entry" (`Check`):**
   - *Location:* `/staff/banking`.
   - *Behavior:* Matches hospital bank statement lines against internal ledger cashbook entries.
3. **"Verify Vendor Invoice" (`CheckSquare`):**
   - *Location:* `/staff/transactions`.
   - *Behavior:* Matches vendor invoice against approved Purchase Order (PO) and warehouse Goods Received Note (GRN) (Three-Way Match).

### E. Real-Life Practical Examples
1. **Auditing Front Desk Cash Collections:**
   - Accountant checks daily cashier closing reports: 3 cashiers collected total ₹2,15,400. Accountant verifies cash deposit slips from the bank armored transport pickup.
2. **Posting Monthly Hospital Electricity Expense:**
   - Electricity bill of ₹1,80,000 arrives. Accountant posts: Debit: `Electricity & Utilities Expense (₹1,80,000)`, Credit: `HDFC Operating Bank Account (₹1,80,000)`.
3. **Reconciling Bank Statement Differences:**
   - Bank statement shows ₹450 monthly bank charge not recorded in books. Accountant logs journal entry debiting Bank Charges and crediting Bank Account.

### F. Permissions & Restrictions
- **Can:** Draft journal vouchers, reconcile bank statements, audit cashier shifts, inspect ledgers.
- **Cannot:** Self-approve high-value checks, delete posted journal vouchers, modify patient clinical notes.

---

## 2.16 Chief Financial Officer (`FINANCE_MANAGER`)

### A. Understanding the Account
- **Who is this in a real hospital?** Chief Financial Officer (CFO) / Director of Finance.
- **Actual Job:** Directs all corporate hospital finances: capital expenditure (CapEx), high-value vendor payments, corporate tax compliance, quarterly Profit & Loss (P&L) performance, budget allocations, and bank debt financing.
- **Why needed?** Guarantees the financial solvency, regulatory compliance, and fiscal growth of the hospital institution.
- **Responsibilities:** Authorizing vendor payments over ₹50,000, approving journal entries, reviewing monthly balance sheets, managing bank credit facilities, and fiscal audits.
- **Outside Authority:** Cannot modify patient medical charts or clinical diagnoses.

### B. Login & Dashboard
- Lands on `/staff/profit-loss` and `/staff/financial-accounts`.
- Displays: Monthly Gross Revenue, Operating Expenses, Net Hospital Surplus, Cash Flow Projections, Departmental Budget Variances, and Capital Asset Valuations.

### C. Sidebar & Navigation
- Complete unrestricted governance access across all financial, administrative, and inventory procurement modules.

### D. Every Button & Interaction
1. **"Approve High-Value Payment" (`CheckCircle`):**
   - *Location:* `/staff/transactions`.
   - *Behavior:* Authorizes electronic fund transfer (RTGS/NEFT) for bulk medicine supplier invoice (e.g. ₹8,50,000).
2. **"Authorize Journal Voucher" (`Stamp`):**
   - *Location:* `/staff/general-ledger`.
   - *Behavior:* Reviews drafted journal entry and posts it permanently to the general ledger.
3. **"Lock Monthly Fiscal Period" (`Lock`):**
   - *Location:* `/staff/settings-audit`.
   - *Behavior:* Locks past month accounting period against any retrospective edits or backdated postings.

### E. Real-Life Practical Examples
1. **Authorizing Quarterly Biomedical Equipment Purchase:**
   - Hospital purchases new Siemens Ultrasound machine for ₹32,00,000. CFO reviews comparative vendor bids, financing interest rate, and signs final purchase authorization.
2. **Reviewing Hospital Departmental Profitability:**
   - Inspects real-time P&L statement: discovers Radiology generated 34% operating surplus while Daycare Surgery ran a 4% deficit due to high disposable costs.
3. **Enforcing Separation of Duties (SoD):**
   - Senior Accountant drafts a ₹1,20,000 maintenance payment. System prohibits accountant from approving it. CFO reviews supporting bills and signs digital approval.

### F. Permissions & Restrictions
- **Can:** Authorize all financial transactions, post ledgers, approve budgets, close fiscal periods.
- **Cannot:** Alter clinical medical histories or prescribe drugs.

---

## 2.17 Materials & Central Warehouse Manager (`INVENTORY_MANAGER`)

### A. Understanding the Account
- **Who is this in a real hospital?** Central Stores & Warehouse In-Charge.
- **Actual Job:** Manages the central hospital warehouse: stock receipts, batch lot tracking, storage bin locations, departmental stock transfers, safety reorder thresholds, and audited stock write-offs.
- **Why needed?** Prevents stockouts of critical surgical supplies and stops internal theft, loss, and damage of hospital inventory.
- **Responsibilities:** Physical stock counts, monitoring warehouse storage temperatures, approving internal store transfers, and logging damaged goods write-offs.
- **Outside Authority:** Cannot approve external vendor payments directly (requires Accounts separation).

### B. Login & Dashboard
- Lands on `/staff/inventory`.
- Displays: Total Warehouse Valuation, Low Stock SKUs Below Reorder Point, Expired/Damaged Stock Quarantined, and Pending Department Store Requisitions.

### C. Sidebar & Navigation
- Access to: Central Inventory & Warehouse, Pharmacy Formulary, Equipment & Assets, and Procurement.

### D. Every Button & Interaction
1. **"Issue Department Transfer" (`ArrowRightCircle`):**
   - *Location:* `/staff/inventory`.
   - *Behavior:* Transfers 50 boxes of surgical gloves from Central Warehouse to Operation Theatre Store. Decrements warehouse stock and increments OT local inventory.
2. **"Log Stock Write-Off" (`Trash2`):**
   - *Location:* Warehouse audit screen.
   - *Behavior:* Records damaged or broken glass ampoules with required photographic evidence and supervisor sign-off reason code.
3. **"Update Reorder Threshold" (`Sliders`):**
   - *Location:* Inventory item setup.
   - *Behavior:* Sets minimum safety stock level (e.g. alert when N95 masks drop below 200 units).

### E. Real-Life Practical Examples
1. **Managing Sudden Surge in Emergency IV Fluids:**
   - Cholera outbreak causes high demand for Ringer's Lactate IV. Warehouse Manager transfers 400 bottles from Central Warehouse to Emergency Station in 10 minutes.
2. **Conducting Quarterly Physical Inventory Count:**
   - Warehouse team scans all bins. Physical count matches system inventory within 99.8% accuracy.
3. **Quarantining Recalled Surgical Sutures:**
   - Manufacturer issues batch recall for defective suture lot. Warehouse Manager clicks "Quarantine Batch", locking 120 boxes from distribution.

### F. Permissions & Restrictions
- **Can:** Receive stock, transfer inventory, log write-offs, set reorder points.
- **Cannot:** Authorize vendor payments, dispense medicines to individual patients.

---

## 2.18 Hospital Purchasing & Procurement Officer (`PROCUREMENT_OFFICER`)

### A. Understanding the Account
- **Who is this in a real hospital?** Head of Hospital Purchasing / Procurement.
- **Actual Job:** Manages supplier lifecycles: invites vendor quotations, prepares comparative price evaluation sheets, generates official Purchase Orders (POs), and logs Goods Received Notes (GRNs) at the loading dock.
- **Why needed?** Secures the lowest commercial prices for medical consumables and pharmaceutical drugs while enforcing anti-kickback compliance.
- **Responsibilities:** Vendor negotiations, Purchase Order issuance, delivery timeline tracking, and three-way invoice matching.
- **Outside Authority:** Prohibited from approving self-created purchase orders without administrative sign-off.

### B. Login & Dashboard
- Lands on `/staff/inventory` (Procurement tab).
- Displays: Open Purchase Requisitions, Vendor Quotations Under Evaluation, Approved POs Pending Delivery, and Delayed Shipments.

### C. Sidebar & Navigation
- Access to: Procurement & Purchase Orders, Central Inventory, Vendor Master Directories, and Accounts Payable interfaces.

### D. Every Button & Interaction
1. **"Create Purchase Order (PO)" (`FilePlus`):**
   - *Location:* `/staff/inventory`.
   - *Behavior:* Selects approved vendor, line items, quantities, agreed unit rates, payment credit terms (e.g. Net 30), and delivery deadline.
2. **"Log Goods Received Note (GRN)" (`Truck`):**
   - *Location:* Receiving dock screen.
   - *Behavior:* Inspects delivery truck, records received quantities, enters manufacturer batch numbers and expiration dates, logs damaged items.
3. **"Compare Vendor Quotations" (`BarChart2`):**
   - *Location:* Requisition evaluation tab.
   - *Behavior:* Displays side-by-side comparative table of 3 vendor bids for hospital disinfectant supply.

### E. Real-Life Practical Examples
1. **Procuring 50,000 Disposable Syringes:**
   - Procurement Officer invites bids from 3 medical distributors. Compares rates: Vendor A (₹2.20), Vendor B (₹2.05), Vendor C (₹2.40). Selects Vendor B, saving hospital ₹7,500 on order.
2. **Logging Delivery at Warehouse Dock:**
   - Delivery truck arrives with 100 boxes of Paracetamol IV. Officer verifies seals, checks batch numbers against delivery challan, logs GRN in system.
3. **Handling Short Shipment:**
   - Supplier sends 80 boxes instead of 100 ordered. Officer records partial delivery (80 received, 20 pending), preventing Accounts from paying for unreceived goods.

### F. Permissions & Restrictions
- **Can:** Solicit bids, draft POs, log GRNs, manage supplier performance.
- **Cannot:** Authorize bank payments, modify patient clinical records.

---

## 2.19 Insurance & TPA Claims Coordinator (`INSURANCE_COORDINATOR`)

### A. Understanding the Account
- **Who is this in a real hospital?** Cashless Mediclaim & Third-Party Administrator (TPA) Desk Officer.
- **Actual Job:** Coordinates with health insurance companies (e.g. Star Health, HDFC ERGO, Medi Assist, Vidal Health): verifies patient policy coverage, submits cashless pre-authorization requests, answers insurer medical queries, compiles final claim dockets, and reconciles settled claims.
- **Why needed?** Over 60% of private hospital admissions rely on cashless health insurance. Delays in TPA approvals cause patient dissatisfaction and delayed discharges.
- **Responsibilities:** Policy eligibility verification, pre-auth submissions, enhancement requests, claim document compilation, and claim settlement reconciliation.
- **Outside Authority:** Cannot mark hospital bills settled without verified TPA sanction letters.

### B. Login & Dashboard
- Lands on `/staff/insurance`.
- Displays: Pre-Auth Requests Under Review, Approved Cashless Limits, Queries Awaiting Medical Response, Claims Ready for Final Submission, and Settled TPA Payments.

### C. Sidebar & Navigation
- Access to: Insurance & TPA Claims, Billing Desk, Inpatient Admissions, Master Patient Index, and TPA Ledger Accounts.

### D. Every Button & Interaction
1. **"Submit Pre-Authorization Request" (`Send`):**
   - *Location:* `/staff/insurance`.
   - *Behavior:* Uploads patient health card, government ID, doctor admission advice chit, and estimated hospitalization cost to TPA insurer.
2. **"Request Limit Enhancement" (`TrendingUp`):**
   - *Location:* Inpatient insurance tracker.
   - *Behavior:* If patient undergoes unexpected surgery, requests increase in approved cashless limit (e.g. from ₹50,000 to ₹1,50,000).
3. **"Upload Final Claim Docket" (`UploadCloud`):**
   - *Location:* Post-discharge claim tab.
   - *Behavior:* Compiles discharge summary, itemized pharmacy bills, diagnostic reports, and hospital final bill into verified digital claim package.

### E. Real-Life Practical Examples
1. **Verifying Cashless Eligibility on Emergency Arrival:**
   - Patient arrives with acute appendicitis holding Star Health card. Coordinator verifies policy active status online within 15 minutes and submits initial ₹60,000 pre-auth.
2. **Resolving a TPA Query for Additional Clinical Evidence:**
   - TPA queries: "Provide ultrasound report confirming appendicitis." Coordinator pulls verified report from LIS and uploads it to portal in 5 minutes.
3. **Reconciling TPA Settlement Deductions:**
   - Insurer settles ₹85,000 out of ₹90,000 bill, deducting ₹5,000 for non-medical consumables. Coordinator allocates ₹85,000 to TPA account and collects ₹5,000 co-pay from patient.

### F. Permissions & Restrictions
- **Can:** Submit claims, upload medical dockets, track approvals, reconcile TPA payments.
- **Cannot:** Fabricate medical records, modify hospital base tariffs.

---

## 2.20 Treasury & Investment Manager (`INVESTMENT_MANAGER`)

### A. Understanding the Account
- **Who is this in a real hospital?** Corporate Treasury & Investment Officer.
- **Actual Job:** Manages hospital capital reserves: bank Fixed Deposits (FDs), government treasury bonds, yield calculations, interest accruals, liquidity ratios, and investment maturity alerts.
- **Why needed?** Ensures the hospital earns maximum safe returns on idle operating capital and maintains sufficient cash liquidity for emergency payroll and capital purchases.
- **Responsibilities:** Fixed deposit tracking, interest yield monitoring, maturity renewal planning, and treasury compliance.
- **Outside Authority:** Cannot divert hospital funds into unapproved speculative instruments.

### B. Login & Dashboard
- Lands on `/staff/investments`.
- Displays: Total Investment Portfolio Valuation, Average Annual Yield (APY), FDs Maturing Within 30 Days, Accrued Interest Receivable, and Liquidity Reserve Ratio.

### C. Sidebar & Navigation
- Access to: Investment Registers, Banking & Reconciliation, Chart of Accounts, Cash Flow Forecasts, and Treasury Reports.

### D. Every Button & Interaction
1. **"Book New Fixed Deposit" (`Landmark`):**
   - *Location:* `/staff/investments`.
   - *Behavior:* Records deposit amount (e.g. ₹50,00,000), bank name, tenure (12 months), interest rate (7.25%), maturity date, and compounding frequency.
2. **"Log Interest Accrual" (`Percent`):**
   - *Location:* Investment schedule.
   - *Behavior:* Calculates and posts earned interest to the General Ledger: Debits `Interest Receivable`, Credits `Interest Income`.
3. **"Liquidate / Reinvest on Maturity" (`RefreshCw`):**
   - *Location:* Matured investment modal.
   - *Behavior:* Automatically rolls over principal into new FD or transfers matured funds into main hospital operating bank account.

### E. Real-Life Practical Examples
1. **Investing Hospital Surplus Reserves:**
   - Hospital holds ₹1 Crore surplus after fiscal year. Investment Manager books a 12-month Fixed Deposit at 7.4% annual yield, generating ₹7,40,000 in passive interest income.
2. **Monitoring FD Maturity for Hospital Expansion:**
   - A ₹40,00,000 FD matures on June 15th, exactly when payments are due for a new CT scanner. Manager schedules liquidation into operating account.
3. **Auditing Monthly Interest Accruals:**
   - Reconciles ₹62,500 monthly accrued interest across 8 active bank FDs with bank tax certificates (Form 26AS).

### F. Permissions & Restrictions
- **Can:** Register investments, track interest yields, schedule renewals.
- **Cannot:** Move funds without Board / CFO multi-signature authorization.

---

## 2.21 Clinical & Financial Auditor (`AUDITOR`)

### A. Understanding the Account
- **Who is this in a real hospital?** Internal / External Quality & Financial Compliance Auditor.
- **Actual Job:** Inspects clinical and financial operations for regulatory compliance: NABH quality standards, NABL laboratory calibration logs, drug expiry handling, tax compliance, and anti-fraud audit trails.
- **Why needed?** Protects the hospital from regulatory penalties, medical negligence lawsuits, and financial fraud.
- **Responsibilities:** Independent inspection of tamper-proof audit trails, reviewing deleted or reversed transactions, auditing narcotics logs, and evaluating clinical care standard adherence.
- **Outside Authority:** **STRICT READ-ONLY AUDIT ROLE.** Cannot create, edit, approve, or delete any operational or clinical record.

### B. Login & Dashboard
- Lands on `/staff/settings-audit` and `/staff/reports`.
- Displays: Audit Log Timeline, Permission Denials (403 Forbidden spikes), High-Value Payment Audit List, Clinical Record Amendment Logs, and Incident Reports.

### C. Sidebar & Navigation
- Global read-only access across all 27 hospital modules with unrestricted inspection privileges into system audit trails.

### D. Every Button & Interaction
1. **"Export Immutable Audit Trail" (`Download` / `ShieldCheck`):**
   - *Location:* `/staff/settings-audit`.
   - *Behavior:* Exports cryptographic audit log showing User ID, Entity, Action (CREATE/UPDATE/DELETE), Timestamp, IP Address, and Pre/Post State changes.
2. **"Filter by Sensitive Entity" (`Search`):**
   - *Location:* Audit search bar.
   - *Behavior:* Filters logs for critical tables: `Prescription`, `Invoice`, `JournalEntry`, `UserRole`.

### E. Real-Life Practical Examples
1. **Auditing Narcotic Drug Administration:**
   - Inspects ICU Morphine ampoule logs: verifies every administered dose matches a signed doctor prescription and nurse MAR timestamp with zero unaccounted vials.
2. **Investigating High-Value Billing Reversals:**
   - Auditor filters all billing reversals above ₹10,000 across the past 90 days to confirm legitimate administrative reasons.
3. **Preparing for NABH Accreditation Inspection:**
   - Extracts complete patient safety indicator reports: surgical site infection rates, medication error incident reports, and average emergency response times.

### F. Permissions & Restrictions
- **Can:** View all records, inspect audit trails, export compliance reports.
- **Cannot:** Create, edit, delete, or approve any record in the system.
"""

