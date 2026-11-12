# -*- coding: utf-8 -*-
"""Part 1: Overview and Philosophy of AURA HMS"""

def get_part1():
    return """# AURA Hospital Management System (HMS) — Complete User & System Guide
*The Definitive Beginner-to-Professional Operational Manual, Architectural Reference, and Live Demonstration Handbook*

---

## Document Metadata & System Information
- **Application Name:** AURA Multi-Specialty Hospital Management System (AURA HMS / HMIS)
- **Target Audience:** Hospital Owners, Medical Directors, Chief Operating Officers, Department Heads, Clinicians, Nurses, Front Desk Receptionists, Pharmacists, Lab Scientists, Finance Managers, Trainees, and Software Evaluators.
- **System Edition:** Enterprise Multi-Branch Healthcare Suite (NABH & NABL Audit Ready)
- **Primary Currency:** Indian National Rupee (₹ - INR)
- **Supported Languages:** English (`en`), Hindi (`hi`), Telugu (`te`), Tamil (`ta`), Kannada (`kn`)
- **Core Technology Stack:** React 19 + TypeScript (Frontend), Django REST Framework + Python 3.12 (Backend), Supabase PostgreSQL 15 (Relational Database), Tailwind CSS (Design System).

---

## Master Table of Contents
1. [PART 1: System Overview & Foundations](#part-1-system-overview--foundations)
   - 1.1 [What is a Hospital Management System?](#11-what-is-a-hospital-management-system)
   - 1.2 [The Philosophy of AURA HMS](#12-the-philosophy-of-aura-hms)
   - 1.3 [Architecture & The "Hospital Brain" Analogy](#13-architecture--the-hospital-brain-analogy)
   - 1.4 [Implementation & Verification Status Matrix](#14-implementation--verification-status-matrix)
   - 1.5 [Global Multi-Branch Data Isolation](#15-global-multi-branch-data-isolation)
2. [PART 2: Comprehensive Accounts & Roles Directory](#part-2-comprehensive-accounts--roles-directory)
   - 2.1 [Super Administrator (`SUPER_ADMIN`)](#21-super-administrator-super_admin)
   - 2.2 [Hospital Administrator (`HOSPITAL_ADMIN`)](#22-hospital-administrator-hospital_admin)
   - 2.3 [Branch Operations Manager (`BRANCH_MANAGER`)](#23-branch-operations-manager-branch_manager)
   - 2.4 [Medical Director / Chief Medical Officer (`MEDICAL_DIRECTOR`)](#24-medical-director--chief-medical-officer-medical_director)
   - 2.5 [Clinical Department Head (`DEPARTMENT_HEAD`)](#25-clinical-department-head-department_head)
   - 2.6 [Consultant & Attending Physician (`DOCTOR`)](#26-consultant--attending-physician-doctor)
   - 2.7 [Staff Nursing Officer (`NURSE`)](#27-staff-nursing-officer-nurse)
   - 2.8 [Front Desk Receptionist (`RECEPTIONIST`)](#28-front-desk-receptionist-receptionist)
   - 2.9 [Registered Hospital Patient (`PATIENT`)](#29-registered-hospital-patient-patient)
   - 2.10 [Billing Executive (`BILLING_EXECUTIVE`)](#210-billing-executive-billing_executive)
   - 2.11 [Cash Counter Cashier (`CASHIER`)](#211-cash-counter-cashier-cashier)
   - 2.12 [Registered Pharmacist (`PHARMACIST`)](#212-registered-pharmacist-pharmacist)
   - 2.13 [Medical Laboratory Technician (`LAB_TECHNICIAN`)](#213-medical-laboratory-technician-lab_technician)
   - 2.14 [Radiographer & Imaging Technician (`RADIOLOGY_TECHNICIAN`)](#214-radiographer--imaging-technician-radiology_technician)
   - 2.15 [Senior Hospital Accountant (`ACCOUNTANT`)](#215-senior-hospital-accountant-accountant)
   - 2.16 [Chief Financial Officer (`FINANCE_MANAGER`)](#216-chief-financial-officer-finance_manager)
   - 2.17 [Materials & Central Warehouse Manager (`INVENTORY_MANAGER`)](#217-materials--central-warehouse-manager-inventory_manager)
   - 2.18 [Hospital Purchasing & Procurement Officer (`PROCUREMENT_OFFICER`)](#218-hospital-purchasing--procurement-officer-procurement_officer)
   - 2.19 [Insurance & TPA Claims Coordinator (`INSURANCE_COORDINATOR`)](#219-insurance--tpa-claims-coordinator-insurance_coordinator)
   - 2.20 [Treasury & Investment Manager (`INVESTMENT_MANAGER`)](#220-treasury--investment-manager-investment_manager)
   - 2.21 [Clinical & Financial Auditor (`AUDITOR`)](#221-clinical--financial-auditor-auditor)
3. [PART 3: Deep-Dive Module-by-Module Guide](#part-3-deep-dive-module-by-module-guide)
   - 3.1 [Global Navigation & Header Controls](#31-global-navigation--header-controls)
   - 3.2 [Module 1: Clinical & Operations Command Center Dashboard (`/staff/dashboard`)](#32-module-1-clinical--operations-command-center-dashboard-staffdashboard)
   - 3.3 [Module 2: Master Patient Index & Demographics (`/staff/patients`)](#33-module-2-master-patient-index--demographics-staffpatients)
   - 3.4 [Module 3: OPD Appointments & Token Queue Management (`/staff/appointments`)](#34-module-3-opd-appointments--token-queue-management-staffappointments)
   - 3.5 [Module 4: Digital Waiting Lounge TV Display (`/lounge-tv`)](#35-module-4-digital-waiting-lounge-tv-display-lounge-tv)
   - 3.6 [Module 5: Doctor Clinical Workspace & EMR (`/staff/doctor-workspace`)](#36-module-5-doctor-clinical-workspace--emr-staffdoctor-workspace)
   - 3.7 [Module 6: Doctors & Nursing Management (`/staff/doctors-nursing`)](#37-module-6-doctors--nursing-management-staffdoctors-nursing)
   - 3.8 [Module 7: Emergency & Trauma Casualty Center (`/staff/emergency`)](#38-module-7-emergency--trauma-casualty-center-staffemergency)
   - 3.9 [Module 8: Inpatient Admissions & Bed Board Census (`/staff/admissions`)](#39-module-8-inpatient-admissions--bed-board-census-staffadmissions)
   - 3.10 [Module 9: AI Voice Translation Engine (`/staff/voice-translation`)](#310-module-9-ai-voice-translation-engine-staffvoice-translation)
   - 3.11 [Module 10: Pathology & Diagnostic Laboratory LIS (`/staff/laboratory`)](#311-module-10-pathology--diagnostic-laboratory-lis-stafflaboratory)
   - 3.12 [Module 11: Radiology & Medical Imaging RIS (`/staff/radiology`)](#312-module-11-radiology--medical-imaging-ris-staffradiology)
   - 3.13 [Module 12: Pharmacy Formulary & FEFO Dispensing (`/staff/pharmacy`)](#313-module-12-pharmacy-formulary--fefo-dispensing-staffpharmacy)
   - 3.14 [Module 13: Central Inventory & Warehouse Management (`/staff/inventory`)](#314-module-13-central-inventory--warehouse-management-staffinventory)
   - 3.15 [Module 14: Operation Theatre & ICU Surgical Suite (`/staff/surgery-icu`)](#315-module-14-operation-theatre--icu-surgical-suite-staffsurgery-icu)
   - 3.16 [Module 15: Central Pricing & Tariff Management (`/staff/pricing-tariffs`)](#316-module-15-central-pricing--tariff-management-staffpricing-tariffs)
   - 3.17 [Module 16: Billing, Invoicing & Cashier Desk (`/staff/billing`)](#317-module-16-billing-invoicing--cashier-desk-staffbilling)
   - 3.18 [Module 17: Insurance & Corporate TPA Claims (`/staff/insurance`)](#318-module-17-insurance--corporate-tpa-claims-staffinsurance)
   - 3.19 [Module 18: Chart of Financial Accounts (`/staff/financial-accounts`)](#319-module-18-chart-of-financial-accounts-stafffinancial-accounts)
   - 3.20 [Module 19: Financial Transactions & Cashbook (`/staff/transactions`)](#320-module-19-financial-transactions--cashbook-stafftransactions)
   - 3.21 [Module 20: Hospital Investment Registers (`/staff/investments`)](#321-module-20-hospital-investment-registers-staffinvestments)
   - 3.22 [Module 21: Banking & Statement Reconciliation (`/staff/banking`)](#322-module-21-banking--statement-reconciliation-staffbanking)
   - 3.23 [Module 22: Loans & Long-Term Liabilities (`/staff/loans`)](#323-module-22-loans--long-term-liabilities-staffloans)
   - 3.24 [Module 23: Double-Entry General Ledger Accounting (`/staff/general-ledger`)](#324-module-23-double-entry-general-ledger-accounting-staffgeneral-ledger)
   - 3.25 [Module 24: Budgeting & Cash Flow Forecasting (`/staff/budgeting`)](#325-module-24-budgeting--cash-flow-forecasting-staffbudgeting)
   - 3.26 [Module 25: Real-Time Profit & Loss Statement (`/staff/profit-loss`)](#326-module-25-real-time-profit--loss-statement-staffprofit-loss)
   - 3.27 [Module 26: HR Operations, Biometrics & Payroll (`/staff/hr-payroll`)](#327-module-26-hr-operations-biometrics--payroll-staffhr-payroll)
   - 3.28 [Module 27: Medical Equipment, Assets & Maintenance (`/staff/assets`)](#328-module-27-medical-equipment-assets--maintenance-staffassets)
   - 3.29 [Module 28: Patient Portal Gateway (`/staff/patient-portal` & `/patient/*`)](#329-module-28-patient-portal-gateway-staffpatient-portal--patient)
   - 3.30 [Module 29: Business Intelligence Reports & Analytics (`/staff/reports`)](#330-module-29-business-intelligence-reports--analytics-staffreports)
   - 3.31 [Module 30: Users, Staff Provisioning & Master RBAC (`/staff/users-roles`)](#331-module-30-users-staff-provisioning--master-rbac-staffusers-roles)
   - 3.32 [Module 31: Settings, Branch Config & Audit Trail (`/staff/settings-audit`)](#332-module-31-settings-branch-config--audit-trail-staffsettings-audit)
   - 3.33 [Module 32: Branch Manager 14-Domain Supervisory Hub (`/staff/branch-manager`)](#333-module-32-branch-manager-14-domain-supervisory-hub-staffbranch-manager)
4. [PART 4: Complete End-to-End Hospital Workflows](#part-4-complete-end-to-end-hospital-workflows)
5. [PART 5: Beginner-Friendly Hospital & Technical Glossary](#part-5-beginner-friendly-hospital--technical-glossary)
6. [PART 6: Technical Architecture in Simple English](#part-6-technical-architecture-in-simple-english)
7. [PART 7: Dashboards, Metrics & Operational Calculations](#part-7-dashboards-metrics--operational-calculations)
8. [PART 8: Security, Governance & Role-Based Access Control](#part-8-security-governance--role-based-access-control)
9. [PART 9: Comprehensive Hospital Operations Troubleshooting Guide](#part-9-comprehensive-hospital-operations-troubleshooting-guide)
10. [PART 10: Complete AURA HMS Live Demonstration Guide](#part-10-complete-aura-hms-live-demonstration-guide)

---

# PART 1: System Overview & Foundations

### 1.1 What is a Hospital Management System?
Imagine a bustling 300-bed hospital in downtown Hyderabad or New Delhi. Every single day:
- Over 600 outpatients walk through the glass front doors seeking medical help.
- 30 critically ill patients arrive via emergency sirens in ambulances.
- Doctors perform 15 surgeries in sterile operating theatres.
- Pathologists test 1,200 vials of blood and urine.
- Pharmacists dispense 4,000 strips of tablets, vials, and IV fluids.
- Patients pay through Cash, Credit Cards, UPI QR codes, or Health Insurance TPAs.
- Hundreds of doctors, nurses, cleaners, and administrators work together 24 hours a day, 7 days a week.

If this hospital relied on paper notebooks, paper prescription slips, and physical file folders:
1. **Records Get Lost:** A patient's previous allergy to Penicillin might be written in an old notebook locked in a basement file room; an emergency doctor might prescribe it unknowingly, endangering the patient's life.
2. **Billing Chaos:** A patient admitted for 5 days might have taken 42 medicines, 6 lab tests, and 2 X-rays. If nurse slips are misplaced, the hospital loses lakhs of rupees in unbilled services, or overcharges the patient by mistake.
3. **Queue Nightmares:** Patients wait in humid corridors for 3 hours, not knowing when their token number will be called into Doctor Cabin 102.
4. **Theft & Expiry Losses:** Expensive cancer drugs or antibiotic injections expire quietly in dark stockroom shelves because pharmacists grab newer boxes from the front instead of older boxes from the back.

**The AURA Hospital Management System (HMS)** solves every single one of these problems. It is a unified, browser-based, high-security software platform. It acts as the digital nervous system of the entire hospital. It connects the front desk receptionist, the consulting physician, the ward nurse, the lab technician, the pharmacist, the chief accountant, and the hospital owner into one single, synchronized screen!

---

### 1.2 The Philosophy of AURA HMS
AURA HMS was engineered around five foundational medical and enterprise principles:

1. **Patient Safety Above All Else:** Every clinical screen warns doctors of patient drug allergies, past medical conditions, and critical lab panic values.
2. **Zero Artificial Dummy Transactions:** The system does not rely on fake hardcoded numbers. When you see "42 OPD Registrations Today", it reflects real database records created since midnight.
3. **Strict Separation of Duties (SoD):** A doctor diagnoses and prescribes, but cannot collect cash. A cashier collects money, but cannot modify medical diagnoses. An accountant posts journal vouchers, but cannot approve self-created expenses without managerial sign-off.
4. **FEFO Inventory Discipline (First-Expiring, First-Out):** Medicines with the nearest expiry date are systematically allocated first, cutting hospital drug wastage to zero.
5. **Real-Time Financial Integrity:** Every rupee collected or spent automatically writes balanced debit and credit entries to the double-entry General Ledger.

---

### 1.3 Architecture & The "Hospital Brain" Analogy
To understand how AURA HMS operates without technical jargon, compare it to the human body:

| Technical Component | Real-World Hospital Comparison | What It Actually Does |
| :--- | :--- | :--- |
| **Frontend (React + Vite)** | **The Hospital Reception & Doctor Cabins** | The visible screens, forms, buttons, and tables where staff type notes and view patient records. |
| **Backend (Django REST Framework)** | **The Hospital Medical Superintendent's Office** | The invisible administrative engine that verifies credentials, enforces rules, checks permissions, and directs orders. |
| **Database (Supabase PostgreSQL)** | **The Central Medical Record Room & Vault** | The fireproof, encrypted digital archive where every patient visit, lab report, invoice, and audit log is permanently stored. |
| **APIs (Application Programming Interfaces)** | **The Hospital Internal Intercom & Order Chits** | The secure digital messengers that carry instructions (e.g. "Doctor in Cabin 2 ordered a CBC test for Rahul") from one room to another in milliseconds. |
| **Role-Based Access Control (RBAC)** | **The Hospital ID Badges & Keycards** | Determines which doors each staff member can open. A receptionist's badge opens the front desk; only a doctor's badge opens the clinical prescription pad. |

---

### 1.4 Implementation & Verification Status Matrix
To maintain absolute transparency, every single capability in AURA HMS has been inspected and audited in the live codebase. Nothing in this guide is exaggerated:

| Classification | Meaning in This Guide | Examples in AURA HMS |
| :--- | :--- | :--- |
| **FULLY IMPLEMENTED & VERIFIED** | Code is complete in React and Django, tables exist in PostgreSQL, business logic is active, and verified in live testing. | Patient Registration, OPD Appointments, Queue Token Issuance, Inpatient Bed Management, FEFO Pharmacy Dispensing, LIS Pathology accessioning, Central Tariff Management, Double-Entry General Ledger, Cashier Drawer Reconciliations, 5-Language Translations. |
| **IMPLEMENTED (API CREDENTIAL DEPENDENT)** | Fully coded and tested, but requires external third-party API credentials (such as Google Speech API, Twilio SMS, or Razorpay Keys) for live production transmission. | Browser Voice-to-Text Transcription (`VoiceTranslationPage.tsx`), WhatsApp/SMS appointment notification dispatchers. |
| **PARTIALLY IMPLEMENTED** | Frontend UI and primary API endpoints exist, but secondary background workers or specialized edge-case sub-actions are in progress. | Automated DICOM PACS Cloud Image Server streaming (DICOM metadata links are supported; direct in-browser 3D slice rendering relies on external viewer links). |
| **UI PLACEHOLDER / DESIGN READY** | Screen layout, responsive tables, and forms are fully designed, but action buttons emit simulated UI confirmations rather than mutating live database tables. | Advanced hospital investment bond liquidation workflows in treasury module. |
| **NOT IMPLEMENTED / ROADMAP** | Feature is recognized in hospital planning, but code has not yet been authored. | Direct Robotic Pharmacy Automated Pill Dispenser hardware drivers. |

---

### 1.5 Global Multi-Branch Data Isolation
A large healthcare institution rarely exists as a single standalone building. AURA HMS natively supports **Multi-Branch Operations**:

```
                              [ SUPER_ADMIN / HOSPITAL_ADMIN ]
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               ▼                             ▼                             ▼
       [ Downtown Branch ]           [ City Center Branch ]         [ West Wing Clinic ]
       - OPD & Emergencies           - Multi-Specialty Surgery      - Primary Daycare & Eye
       - Branch Beds: 120            - Branch Beds: 180             - Branch Beds: 25
       - Dedicated Pharmacy          - Dedicated Pharmacy           - Daycare Pharmacy
       - Independent Cashiers        - Independent Cashiers         - Independent Cashiers
```

1. **How Multi-Branch Works:**
   - In the top header bar, staff select their working branch (e.g., "City Center Branch").
   - React's `BranchContext` broadcasts this branch ID across all open modules.
   - Every API request sends the HTTP header `X-Branch-ID: <UUID>`.
   - The Django backend applies strict database query filtering: `queryset.filter(branch_id=selected_branch)`.
2. **Why This Matters:**
   - A receptionist in the West Wing clinic never sees beds or waiting queues belonging to the Downtown Branch.
   - The Hospital Director or Super Admin can toggle between branches with 1 click to inspect multi-branch performance, or view aggregated financial statements.
"""

