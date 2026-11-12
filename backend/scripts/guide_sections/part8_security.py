# -*- coding: utf-8 -*-
"""Part 8: Security, Governance & Role-Based Access Control"""

def get_part8():
    return """# PART 8: Security, Governance & Role-Based Access Control

A hospital management system holds the most sensitive data in society: private patient medical diagnoses, doctor notes, and large financial revenues. AURA HMS enforces military-grade access control, privacy boundaries, and financial separation of duties.

---

### Master Role-Based Access Control (RBAC) Permission Matrix

| Role | Patient Records (MPI) | OPD Appointments | Doctor Clinical EMR | Inpatient Bed Census | Pharmacy Dispensing | Laboratory LIS | Billing & Invoicing | General Ledger (GL) | HR & Payroll | System Settings & Audit |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUPER_ADMIN** | View/Edit | Full Access | View Only | Full Access | Full Access | Full Access | Full Access | Full Access | Full Access | **FULL CONTROL** |
| **HOSPITAL_ADMIN** | View/Edit | Full Access | View Only | Full Access | View/Audit | View/Audit | Full Access | View/Approve | Full Access | View/Configure |
| **BRANCH_MANAGER** | View Only | View (Read) | View (Read) | View (Read) | View (Read) | View (Read) | View (Read) | View (Read) | View (Read) | View Only |
| **MEDICAL_DIRECTOR** | Full Access | View Only | Full Access | Full Access | View/Audit | View/Audit | View Only | No Access | View Only | Audit View |
| **DEPARTMENT_HEAD** | View Only | View/Roster | Full Access | Full Access | View Only | View Only | View Only | No Access | Rosters Only | No Access |
| **DOCTOR** | View/Clinical | View Queue | **FULL WRITE** | Bed Visits | Order (e-Rx) | Order Tests | View Charges | No Access | Personal View | No Access |
| **NURSE** | View/Vitals | View Queue | MAR & Vitals | **WARD CENSUS**| Return Drugs | View Results | View Charges | No Access | Personal View | No Access |
| **RECEPTIONIST** | **FULL INTAKE** | **BOOK & TOKEN**| No Access | **ADMIT/TRANSFER**| No Access | No Access | Collect Deposit | No Access | Personal View | No Access |
| **PATIENT** | **OWN PROFILE** | **BOOK SELF** | **OWN SUMMARY** | No Access | View Own Rx | **OWN REPORTS** | **OWN RECEIPTS** | No Access | No Access | No Access |
| **BILLING_EXECUTIVE**| View Demo | View Status | View Charges | View Bed Days | View Charges | View Charges | **FULL INVOICE** | No Access | No Access | No Access |
| **CASHIER** | View Demo | View Payments | No Access | View Deposits | No Access | No Access | **CASH DRAWER** | No Access | No Access | No Access |
| **PHARMACIST** | View Allergies | No Access | View Prescripts | View Bed Rx | **FEFO DISPENSE**| No Access | Charge Bills | No Access | Personal View | No Access |
| **LAB_TECHNICIAN** | View Demog | No Access | View Orders | No Access | No Access | **SAMPLE / WORK**| Charge Tests | No Access | Personal View | No Access |
| **PATHOLOGIST** | View Demog | No Access | View Orders | No Access | No Access | **VERIFY & SIGN**| Charge Tests | No Access | Personal View | No Access |
| **RADIOLOGY_TECH** | View Demog | No Access | View Orders | No Access | No Access | No Access | Charge Scans | No Access | Personal View | No Access |
| **ACCOUNTANT** | No Access | No Access | No Access | No Access | View Values | View Charges | View Invoices | **DRAFT VOUCHERS**| View Payroll | No Access |
| **FINANCE_MANAGER** | No Access | No Access | No Access | No Access | Value Audit | Value Audit | Approve Bills | **POST LEDGERS** | Approve Pay | Audit View |
| **INVENTORY_MGR** | No Access | No Access | No Access | No Access | Warehouse Store| Lab Supplies | No Access | Stock Valuation | Personal View | No Access |
| **PROCUREMENT_OFF** | No Access | No Access | No Access | No Access | PO Quotes | PO Quotes | Vendor Invoices | Accounts Payable| Personal View | No Access |
| **INSURANCE_COORD** | View Records | No Access | View Clinical | View Bed Dockets| View Rx Bills | View Reports | **TPA DOCKETS** | TPA Receivables | Personal View | No Access |
| **INVESTMENT_MGR** | No Access | No Access | No Access | No Access | No Access | No Access | No Access | **FD & TREASURY** | No Access | No Access |
| **AUDITOR** | **AUDIT VIEW** | **AUDIT VIEW**| **AUDIT VIEW** | **AUDIT VIEW** | **AUDIT VIEW** | **AUDIT VIEW** | **AUDIT VIEW** | **AUDIT VIEW** | **AUDIT VIEW** | **FULL AUDIT** |

---

### Core Security & Governance Controls

#### 1. Separation of Duties (Anti-Fraud Rule)
- No single staff member has unilateral authority over the full lifecycle of a transaction:
  - A Doctor prescribes medicines, but cannot dispense them or collect cash.
  - A Receptionist books appointments and collects initial fees, but cannot enter clinical diagnoses.
  - An Accountant drafts journal vouchers, but cannot approve them without Finance Manager sign-off.
  - A Procurement Officer drafts purchase orders, but cannot authorize payment checks.

#### 2. Multi-Branch Security Boundaries
- Staff accounts are pinned to an authorized branch.
- A user working at Downtown Branch cannot view, edit, or search patient records or cash drawers belonging to City Center Branch unless granted elevated multi-branch credentials.

#### 3. Patient Data Privacy & Medical Confidentiality
- Clinical records are cryptographically sealed upon consultation finalization.
- Patient health records are accessible only to treating clinicians currently assigned to that patient's care.
- Patients accessing the Patient Portal are restricted strictly to their own records via database Row Level Security (`WHERE patient_id = current_user.patient_id`).

#### 4. Tamper-Proof Audit Logging
- Every `POST`, `PUT`, `PATCH`, and `DELETE` operation across all 27 modules writes an immutable event log to PostgreSQL.
- Database rules reject any SQL statement attempting to delete, edit, or purge audit trail records.
"""

