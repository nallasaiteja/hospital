# -*- coding: utf-8 -*-
"""Part 7: Dashboards, Metrics & Operational Calculations"""

def get_part7():
    return """# PART 7: Dashboards, Metrics & Operational Calculations

Hospital leadership cannot manage what they cannot measure. AURA HMS computes all operational indicators directly from live database transactions. Below is the exact mathematical formula, database source, and operational meaning behind every metric in the system.

---

### Master Metrics Directory

| Metric Name & Card | Operational Meaning | Exact Mathematical Formula | Live Database Source | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **OPD Registrations Today** | Total outpatients scheduled or checked in since midnight | `COUNT(appointments WHERE appointment_date = TODAY AND branch_id = CURRENT_BRANCH)` | `clinical_appointment` | **VERIFIED (LIVE)** |
| **Inpatient Bed Occupancy %** | Percentage of hospital beds currently occupied by sick patients | `(Occupied Beds ÷ Total Operational Beds) × 100` | `clinical_bed` | **VERIFIED (LIVE)** |
| **Available Beds** | Exact count of clean, sanitized beds ready for immediate admission | `COUNT(beds WHERE status = 'AVAILABLE' AND branch_id = CURRENT_BRANCH)` | `clinical_bed` | **VERIFIED (LIVE)** |
| **Waiting in Lounge** | Outpatients currently checked in and waiting outside doctor cabins | `COUNT(appointments WHERE appointment_date = TODAY AND status IN ('SCHEDULED', 'CHECKED_IN'))` | `clinical_appointment` | **VERIFIED (LIVE)** |
| **Completed Consultations** | Outpatient visits where doctor has finalized prescription | `COUNT(appointments WHERE appointment_date = TODAY AND status = 'COMPLETED')` | `clinical_appointment` | **VERIFIED (LIVE)** |
| **Pending Diagnostic Reports** | Laboratory tests awaiting Pathologist clinical review | `COUNT(reports WHERE status = 'SUBMITTED' AND verified_at IS NULL)` | `clinical_diagnosticreport` | **VERIFIED (LIVE)** |
| **Emergency Trauma Visits** | Patients admitted to Emergency Casualty in past 24 hours | `COUNT(emergency_visits WHERE arrival_time >= TODAY_MIDNIGHT)` | `clinical_emergencyvisit` | **VERIFIED (LIVE)** |
| **Today's Collections (₹)** | Physical cash, card, and UPI collected across all counters today | `SUM(amount WHERE payment_date >= TODAY_MIDNIGHT AND status = 'SUCCESS')` | `billing_paymenttransaction` | **VERIFIED (LIVE)** |
| **Outstanding Inpatient Balance** | Unsettled charges accrued by active ward patients | `SUM(total_amount - advance_deposits WHERE status = 'PENDING')` | `billing_invoice` | **VERIFIED (LIVE)** |
| **Gross Hospital Revenue (₹)** | Total earned hospital revenue across all departments | `SUM(credits WHERE account_type = 'REVENUE' AND date IN FISCAL_PERIOD)` | `billing_journalentryline` | **VERIFIED (LIVE)** |
| **Operating Expenses (₹)** | Total money spent on salaries, medicines, utilities, repairs | `SUM(debits WHERE account_type = 'EXPENSE' AND date IN FISCAL_PERIOD)` | `billing_journalentryline` | **VERIFIED (LIVE)** |
| **Net Hospital Surplus (₹)** | Operating profit/loss earned by the hospital institution | `Gross Revenue - Operating Expenses` | Derived from General Ledger | **VERIFIED (LIVE)** |
| **Average Length of Stay (ALOS)** | Average number of days an admitted patient occupies a bed | `Total Inpatient Days ÷ Total Discharged Patients` | `clinical_inpatientadmission` | **VERIFIED (LIVE)** |
| **Cashier Shift Variance (₹)** | Difference between physical cash counted and computer records | `Physical Denomination Count - Expected System Cash` | `billing_cashiershift` | **VERIFIED (LIVE)** |
| **Near-Expiry Medicine Batches** | Drug boxes expiring within 60 days requiring FEFO priority | `COUNT(batches WHERE expiry_date <= TODAY + 60 DAYS AND quantity > 0)` | `pharmacy_stockbatch` | **VERIFIED (LIVE)** |
| **Unreconciled Bank Difference** | Mismatch between hospital ledger and official bank statement | `Internal Ledger Cashbook Balance - Official Bank Statement Balance` | `billing_bankreconciliation` | **VERIFIED (LIVE)** |

---

### Detailed Operational Calculation Deep-Dive

#### 1. Inpatient Bed Occupancy Rate Calculation
- **Why it matters:** Standard NABH hospital benchmark. If occupancy is <60%, the hospital is losing money on empty rooms; if occupancy is >90%, emergency patients may be turned away due to lack of beds.
- **Example Calculation:**
  - Total Hospital Beds: `120`
  - Currently Admitted Patients (Occupied): `96`
  - Under Cleaning / Housekeeping: `8`
  - Available Ready Beds: `16`
  - **Occupancy Rate:** `(96 ÷ 120) × 100 = 80.0%`.

#### 2. Average Length of Stay (ALOS)
- **Why it matters:** Measures clinical care efficiency. Long hospital stays increase the risk of hospital-acquired infections (HAI); too short stays lead to patient readmissions.
- **NABH Target:** General multi-specialty hospitals typically target an ALOS of **3.5 to 4.5 days**.
- **Calculation in AURA HMS:**
  ```
  Total Bed Days of All Discharged Inpatients This Month: 380 Days
  Total Patients Discharged This Month: 100 Patients
  ALOS = 380 ÷ 100 = 3.8 Days
  ```

#### 3. Real-Time Net Operating Surplus (EBITDA)
- **Why it matters:** Proves hospital profitability without waiting for monthly accountant spreadsheets.
- **Calculation in AURA HMS:**
  ```
  Revenue Streams (October):
  - OPD Consultation Fees:         ₹14,50,000
  - Inpatient Room & ICU Rent:     ₹28,20,000
  - Operating Theatre Surgeries:   ₹18,40,000
  - Pharmacy Drug Sales:           ₹16,20,000
  - Diagnostic Pathology & Scans:   ₹7,20,000
  Gross Hospital Revenue:          ₹84,50,000

  Operating Expenses (October):
  - Doctor Fees & Staff Payroll:   ₹42,00,000
  - Medicine & Consumable Purchases: ₹18,40,000
  - Electricity, Water & Utilities:  ₹4,20,000
  - Biomedical Equipment AMC:        ₹2,10,000
  - Facility Sanitization & Security: ₹1,50,000
  Total Operating Expenses:        ₹68,20,000

  Net Operating Surplus (Profit):  ₹16,30,000 (19.3% Margin)
  ```
"""

