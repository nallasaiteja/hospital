# -*- coding: utf-8 -*-
"""Part 3: Deep-Dive Module-by-Module Guide (Governance, Administration & Operations Modules)"""

def get_part3_admin():
    return """# PART 3: Deep-Dive Module-by-Module Guide (Part 4: Governance & Administration)

---

## 3.27 Module 26: HR Operations, Biometrics & Payroll (`/staff/hr-payroll`)

### 1. Module Name & Route
- **Displayed Name:** 22. HR & Staff Payroll
- **Frontend Route:** `/staff/hr-payroll`

### 2. Simple Explanation
The hospital's Human Resources and salary office. It manages all doctors, nurses, and administrative staff: records biometric fingerprint/facial clock-ins, calculates overtime hours, processes leave applications, generates monthly paychecks, and deducts Provident Fund (PF) and taxes.

### 3. Real Hospital Example
At 7:00 AM, Nurse Sunita punches her fingerprint at the ward entrance. The system records her clock-in at 06:58 AM. At month-end, the HR Manager runs payroll: Sunita worked 24 standard shifts and 12 overtime hours. The system calculates her gross salary (₹38,000) plus overtime bonus (₹3,800), deducts PF (₹2,160), and generates her official payslip.

### 4. Who Uses It?
HR Managers, Payroll Officers, Finance Directors, Department Heads, All Staff (for payslip download).

### 5. Why Does This Module Exist?
Hospitals employ hundreds of shift workers with complex night allowances and overtime rules. Automated HR calculations eliminate salary disputes and enforce statutory labor compliance.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Active Staff, Staff Present Today, Staff on Approved Leave, Monthly Payroll Liability (₹).
- **Employee Directory Table:** Employee ID (e.g. `EMP-DOC-0042`), Name, Role, Department, Contact, Joining Date, Employment Status, Actions.
- **Biometric Attendance Worklist:** Daily clock-in, clock-out, total hours worked, and overtime multiplier flags (derived from live `EmployeeAttendance` records).
- **Monthly Payroll Processing Drawer:** Salary calculations with Basic Pay, HRA, Travel Allowance, Overtime, PF, TDS Tax deductions, and Net Pay.

### 7. Every Tab Explained
- *Employee Directory Tab:* Complete staff profiles, credentials, and contact details.
- *Daily Attendance & Biometrics Tab:* Live punch logs, late marks, and overtime hours.
- *Leave Management Tab:* Sick leave, casual leave, and annual vacation applications.
- *Payroll & Payslips Tab:* Salary generation, direct bank salary files, and payslip printing.

### 8. Every Button Explained
1. **"Onboard Staff Member" (`UserPlus`):** Creates employee profile and links biometric ID.
2. **"Run Monthly Payroll" (`Calculator`):** Computes monthly salaries across all departments.
3. **"Approve Leave Application" (`Check`):** Approves nurse or doctor leave request.
4. **"Download Payslip PDF" (`FileText`):** Generates certified salary slip for employee.

### 9. Complete Workflow
1. HR onboards staff member -> Sets base salary and allowances.
2. Staff clocks in/out daily -> System records live attendance.
3. On 28th of month, HR clicks "Run Monthly Payroll".
4. System calculates worked days, subtracts unpaid leave, adds overtime.
5. Finance Manager reviews salary sheet and authorizes direct bank salary disbursement.

### 10. Data Entry Explanation
- *Basic Salary:* Base contractual salary in ₹.
- *Statutory Deductions:* Employee Provident Fund (EPF 12%), Professional Tax, TDS Income Tax.
- *Overtime Multiplier:* Standard 1.5x hourly rate for extra hours worked.

### 11. Status Explanation
- `PRESENT`: Clocked in on time.
- `LATE`: Clocked in >15 minutes past shift start.
- `ON_LEAVE`: Approved leave day.
- `SALARY_DISBURSED`: Salary transferred to employee bank account.

### 12. Database Explanation
- Stored in: `operations_hr_employee`, `operations_hr_employeeattendance`, `operations_hr_leaveapplication`, `operations_hr_payrollrun`.

### 13. Module Connections
- Feeds monthly salary expenses directly into General Ledger and Profit & Loss statement.

### 14. Permissions
- HR Managers manage staff and leave; Finance Managers authorize salary disbursements.

### 15. Error Handling
- Blocks generating duplicate payroll for the same employee in the same calendar month.

### 16. Practical Examples
- Nurse Sunita applies for 3 days sick leave with medical certificate attached; HOD approves in 1 click.
- Generating direct NEFT bank transfer file for 240 staff salaries at month-end.

### 17. Important Things to Remember
- Always reconcile biometric punch logs before running the final monthly payroll!

---

## 3.28 Module 27: Medical Equipment, Assets & Maintenance (`/staff/assets`)

### 1. Module Name & Route
- **Displayed Name:** 23. Equipment & Assets
- **Frontend Route:** `/staff/assets`

### 2. Simple Explanation
The hospital's medical equipment and asset tracker. It maintains a register of all expensive hospital machines (CT scanners, MRI machines, ventilators, dialysis units, ambulances), schedules preventive maintenance (servicing), handles breakdown repairs, and calculates annual equipment depreciation.

### 3. Real Hospital Example
The ICU Ventilator #4 shows a "Pressure Sensor Error". The ICU nurse logs an urgent breakdown work order. The Biomedical Engineering team receives an immediate alert on their phone, replaces the faulty sensor within 35 minutes, tests the machine, and marks it back in service.

### 4. Who Uses It?
Biomedical Engineers, Maintenance Technicians, Facility Managers, Finance Controllers.

### 5. Why Does This Module Exist?
Medical machines keep patients alive. Equipment failure during surgery or in the ICU is fatal. This module enforces preventive maintenance schedules to keep machines 100% reliable.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Asset Portfolio Value (₹), Active Critical Medical Devices, Maintenance Work Orders Pending, Assets Under AMC Contract.
- **Hospital Asset Register Table:** Asset Tag # (e.g. `ASSET-VENT-04`), Equipment Name, Manufacturer, Serial #, Department, Purchase Date, Cost (₹), Current Book Value, Status.
- **Preventive Maintenance Calendar:** Color-coded schedule showing upcoming calibration and servicing dates.
- **Breakdown Work Order Drawer:** Incident logs, repair technician notes, replacement parts cost, downtime duration.

### 7. Every Tab Explained
- *Asset Register Tab:* Searchable master catalog of all medical and facility machinery.
- *Preventive Maintenance Tab:* Scheduled calibration and routine servicing checklist.
- *Breakdown Work Orders Tab:* Emergency repair tickets for broken equipment.
- *Depreciation Schedules Tab:* Annual straight-line asset value write-down for tax accounting.

### 8. Every Button Explained
1. **"Register New Asset" (`PlusCircle`):** Adds a new machine with serial number and AMC details.
2. **"Log Breakdown Ticket" (`Wrench` / `AlertTriangle`):** Reports a malfunctioning machine.
3. **"Complete Maintenance Service" (`CheckSquare`):** Records completed servicing and uploads vendor calibration certificate.
4. **"Calculate Annual Depreciation" (`TrendingDown`):** Computes asset value reduction for the fiscal year.

### 9. Complete Workflow
1. Hospital buys new Sonosite Ultrasound machine for ₹18 Lakhs.
2. Engineer sticks barcode `ASSET-USG-02` on machine and registers it.
3. System schedules preventive servicing every 6 months.
4. If a probe fails, technician clicks "Log Breakdown" -> Repairs machine -> Closes ticket.
5. At year-end, system deducts 15% depreciation, updating the balance sheet.

### 10. Data Entry Explanation
- *Asset Tag / Barcode:* Unique asset identification number.
- *AMC / CMC Contract:* Annual Maintenance Contract expiry date and vendor emergency helpline.
- *Useful Life:* Expected lifespan in years (e.g. 7 years for digital X-ray, 10 years for generator).

### 11. Status Explanation
- `OPERATIONAL`: Machine working perfectly.
- `UNDER_MAINTENANCE`: Routine servicing in progress.
- `BREAKDOWN`: Broken down, unavailable for patient use.
- `DECOMMISSIONED`: Retired and sold for scrap.

### 12. Database Explanation
- Stored in: `operations_hr_hospitalasset`, `operations_hr_maintenancetask`, `operations_hr_breakdownticket`, `operations_hr_assetdepreciation`.

### 13. Module Connections
- Displays equipment availability in OT and ICU; posts depreciation expenses to General Ledger.

### 14. Permissions
- Biomedical engineers log maintenance; Finance managers oversee depreciation and purchases.

### 15. Error Handling
- Alerts hospital management 30 days before critical life-support machine AMC contracts expire.

### 16. Practical Examples
- Calibration of 8 dialysis machines completed and certified under ISO standards.
- Ambulance breaks down; maintenance logs repair ticket, tracks ₹14,000 alternator replacement.

### 17. Important Things to Remember
- Never use a medical machine that has missed its mandatory preventive calibration date!

---

## 3.29 Module 28: Patient Portal Gateway (`/staff/patient-portal` & `/patient/*`)

### 1. Module Name & Route
- **Displayed Name:** 24. Patient Portal Gateway
- **Frontend Route:** `/staff/patient-portal` (Staff Gateway) and `/patient/*` (Patient Self-Service)

### 2. Simple Explanation
The patient's digital window into the hospital. It allows patients to log in securely from their smartphones or laptops at home to view their lab test results, download doctor prescriptions, see upcoming appointments, and pay hospital bills online.

### 3. Real Hospital Example
Rahul wakes up at home feeling much better. He logs into `https://hospital.aura.org/patient`, clicks "Diagnostic Reports", and downloads his verified CBC blood report as a certified PDF. He also reviews his doctor's prescription instructions without having to travel back to the hospital.

### 4. Who Uses It?
Registered Patients, Family Caregivers, and Hospital Front Desk Staff (for patient portal account assistance).

### 5. Why Does This Module Exist?
Saves patients hours of travel time just to collect a paper report, eliminates paper loss, and satisfies modern patient healthcare transparency laws.

### 6. Complete Screen Explanation
- **Patient Home Dashboard:**
  - *Welcome Banner:* Patient Name, MRN, and Assigned Primary Branch.
  - *Upcoming Consultations Card:* Date, time, and doctor cabin details.
  - *Recent Prescriptions Card:* Prescribed drugs with 1-click PDF download.
  - *Verified Lab Results Card:* Tests ready with green "Ready" badges.
  - *Billing & Payment History:* Paid receipts and outstanding invoices.

### 7. Every Tab Explained
- *My Dashboard Tab:* Overview of active health summary.
- *My Appointments Tab:* History of past visits and booking future consultations.
- *My Prescriptions Tab:* Digital signed e-prescriptions.
- *Diagnostic Reports Tab:* Verified pathology and radiology reports.
- *Billing & Receipts Tab:* Official GST payment receipts.

### 8. Every Button Explained
1. **"Book New Appointment" (`CalendarPlus`):** Selects doctor, date, and preferred timeslot.
2. **"Download Prescription PDF" (`Download`):** Generates certified prescription slip.
3. **"View Lab Results" (`FileText`):** Opens interactive report with normal reference intervals.
4. **"Pay Bill Online" (`CreditCard`):** Integrates with payment gateway for card/UPI payments.

### 9. Complete Workflow
1. Patient visits hospital once and registers phone number.
2. Receives portal login credentials via SMS.
3. Logs into `/patient/dashboard` from home.
4. Views completed doctor visits, downloads PDF reports, and books follow-up appointments.

### 10. Data Entry Explanation
- Patients can update their home address, emergency contacts, and book appointments. Medical clinical records are strictly read-only for patients.

### 11. Status Explanation
- `ACTIVE_PORTAL_USER`: Account enabled for secure login.
- `PASSWORD_RESET_REQUIRED`: First-time login prompt.

### 12. Database Explanation
- Filtered query on `core_patientprofile` restricted by session user ID: `WHERE user_id = request.user.id`.

### 13. Module Connections
- Reads verified data directly from Doctor EMR, LIS Pathology, and Billing Desk.

### 14. Permissions
- Patients can see *only their own data*. Zero access to other patients or hospital staff screens.

### 15. Error Handling
- Rate-limiting prevents automated password guessing; locks account after 5 failed attempts.

### 16. Practical Examples
- Patient shows downloaded digital prescription on his phone to an outside chemist at midnight.
- Patient checks historical blood sugar trends over the past 6 months to discuss with his diabetologist.

### 17. Important Things to Remember
- Diagnostic lab reports only appear on the patient portal after official Pathologist digital sign-off!

---

## 3.30 Module 29: Business Intelligence Reports & Analytics (`/staff/reports`)

### 1. Module Name & Route
- **Displayed Name:** 25. Reports & Analytics
- **Frontend Route:** `/staff/reports`

### 2. Simple Explanation
The hospital's big-data brain and executive scoreboard. It analyzes thousands of patient visits, surgeries, lab tests, and billing receipts to generate charts, performance graphs, clinical quality metrics, and business intelligence reports for hospital directors.

### 3. Real Hospital Example
The Hospital Board meets to decide whether to purchase an expensive second MRI machine. The Medical Director opens Reports & Analytics: the data shows the existing MRI has run at 96% capacity for 8 consecutive months with an average patient wait time of 4.2 days. The board approves the purchase based on solid evidence.

### 4. Who Uses It?
Hospital Owners, Chief Executive Officers, Medical Directors, Chief Financial Officers, Department Heads.

### 5. Why Does This Module Exist?
Eliminates guesswork. Hospital executives can make decisions based on real data, monitor doctor clinical productivity, track infection rates, and identify revenue trends.

### 6. Complete Screen Explanation
- **Top Metric Cards:** Total Patients Treated This Month, Average Length of Stay (ALOS in days), Bed Turnover Rate, Hospital Gross Revenue.
- **Interactive Analytics Charts:**
  - *OPD Patient Volume Curve:* Daily walk-in trends across departments.
  - *Bed Occupancy Heatmap:* Percentage occupancy by ward category.
  - *Revenue Breakdown Donut Chart:* Income percentage from Surgery vs Pharmacy vs Lab.
  - *Clinical Quality Indicators:* Hospital-acquired infection rates, readmission rates.
- **Custom Report Generator:** Date range pickers, department filters, and multi-format export buttons (PDF, Excel, CSV).

### 7. Every Tab Explained
- *Executive Overview Tab:* High-level hospital KPI dashboard.
- *Clinical Quality & NABH Tab:* Patient safety, infection control, and mortality metrics.
- *Financial & Revenue Analytics Tab:* Departmental earnings, billing collections, and outstanding dues.
- *Operational Efficiency Tab:* Average patient waiting time, doctor consultation duration, and bed turnaround time.

### 8. Every Button Explained
1. **"Generate Custom Report" (`BarChart3`):** Compiles multi-variable analytical report.
2. **"Export to Excel (XLSX)" (`FileSpreadsheet`):** Downloads raw tabular data for statistical analysis.
3. **"Export Executive PDF" (`Download`):** Generates polished graphical presentation deck.

### 9. Complete Workflow
1. Director selects Date Range: "Last Quarter".
2. Selects Metric: "Average Length of Stay (ALOS)".
3. System calculates ALOS across all admitted patients (e.g. 3.8 days).
4. Highlights that Cardiology ALOS is 4.2 days while Orthopedics is 2.9 days.
5. Director exports report for the clinical governance meeting.

### 10. Data Entry Explanation
- Pure analytical intelligence module; zero manual data entry.

### 11. Status Explanation
- Reports run in real time directly against PostgreSQL database indexes.

### 12. Database Explanation
- Aggregation queries over `clinical_consultation`, `clinical_inpatientadmission`, `billing_invoice`, and `pharmacy_prescriptiondispense`.

### 13. Module Connections
- Pulls data from every single operational, clinical, and financial module across all branches.

### 14. Permissions
- Restricted to executive leadership roles (SUPER_ADMIN, HOSPITAL_ADMIN, MEDICAL_DIRECTOR, FINANCE_MANAGER).

### 15. Error Handling
- Cached query architecture ensures large 12-month analytics queries load in under 2 seconds without slowing down the live hospital database.

### 16. Practical Examples
- Identifying that Friday afternoons experience a 40% surge in pediatric emergency walk-ins.
- Discovering that Pharmacy sales increased 18% after implementing automated FEFO batch allocation.

### 17. Important Things to Remember
- Always compare metrics against regional NABH benchmarks to ensure top-tier clinical care quality!

---

## 3.31 Module 30: Users, Staff Provisioning & Master RBAC (`/staff/users-roles`)

### 1. Module Name & Route
- **Displayed Name:** 26. Users, Roles & RBAC
- **Frontend Route:** `/staff/users-roles`

### 2. Simple Explanation
The hospital's master security gate and badge office. It creates login accounts for all hospital staff, assigns their professional roles (Doctor, Nurse, Receptionist, Cashier), controls which screens they can open, and sets granular view/create/edit/delete permissions.

### 3. Real Hospital Example
A new receptionist named Priya joins the hospital. The Super Admin opens this screen, creates Priya's account, and assigns her the `RECEPTIONIST` role. Immediately, Priya can access Patient Registration, Appointments, and Beds, but the system completely locks her out of Pharmacy Stock, General Ledger, and Doctor Prescriptions.

### 4. Who Uses It?
Super Administrators, Chief Technology Officers, IT Security Officers.

### 5. Why Does This Module Exist?
Enforces the **Principle of Least Privilege**. Staff members only have access to the exact screens required to do their job, protecting patient medical privacy and hospital financial assets.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Registered Staff Accounts, Active Security Roles (21 Roles), Locked/Suspended Accounts, Global System Permissions (180+ Permissions).
- **Staff User Directory Table:** Username / Email, Full Name, Assigned Role, Primary Branch, Account Status (Active/Locked), Last Login Timestamp, Actions.
- **Role Permission Matrix:** Visual matrix listing all 21 roles across all modules with granular checkboxes: View, Create, Edit, Delete, Approve.
- **Staff Provisioning Drawer:** Comprehensive form to set up official hospital credentials.

### 7. Every Tab Explained
- *Staff Users Tab:* Managing individual employee login accounts.
- *Roles Directory Tab:* Directory of all 21 system roles and descriptions.
- *Permission Matrix Tab:* Master grid configuring security boundaries per role.
- *Security Audits Tab:* Tracking failed password attempts and privilege escalations.

### 8. Every Button Explained
1. **"Provision New User" (`UserPlus`):** Creates staff account and assigns security role.
2. **"Lock / Unlock Account" (`Lock` / `Unlock`):** Suspends or restores staff login access.
3. **"Reset Password" (`Key`):** Generates temporary one-time password for locked user.
4. **"Save RBAC Matrix" (`ShieldCheck`):** Commits custom permission overrides.

### 9. Complete Workflow
1. Super Admin clicks "Provision New User".
2. Enters Email (`priya.rec@aura.org`), Name, Phone, Branch (`Downtown`).
3. Selects Role: `RECEPTIONIST`.
4. System creates user, sets default secure password, and assigns front-desk security token.
5. Priya logs in and sees only front-desk authorized screens.

### 10. Data Entry Explanation
- *Email:* Official corporate hospital email (used as unique login username).
- *Role:* One of 21 standardized system roles.
- *Branch Assignment:* Designated home hospital campus.

### 11. Status Explanation
- `ACTIVE`: Account verified and authorized to log in.
- `SUSPENDED`: Account temporarily locked due to policy breach or leave of absence.
- `TERMINATED`: Former employee account permanently disabled.

### 12. Database Explanation
- Stored in: `authentication_customuser`, `staff_staffprofile`, `auth_permission`, `auth_group`.

### 13. Module Connections
- Controls user authentication and authorization across every route in the entire application.

### 14. Permissions
- Strictly restricted to SUPER_ADMIN.

### 15. Error Handling
- Blocks creating two accounts with the same email address.
- Blocks deleting an admin account if it is the sole active superuser in the system.

### 16. Practical Examples
- Locking a cashier's account immediately upon resignation to prevent unauthorized cash drawer entries.
- Granting a senior nurse temporary charge-nurse permissions to oversee ward admissions during night shift.

### 17. Important Things to Remember
- Never share your personal staff password with any other employee; all actions are permanently logged under your name!

---

## 3.32 Module 31: Settings, Branch Config & Audit Trail (`/staff/settings-audit`)

### 1. Module Name & Route
- **Displayed Name:** 27. Settings & Audit Trail
- **Frontend Route:** `/staff/settings-audit`

### 2. Simple Explanation
The hospital's master settings control room and digital black box. It configures hospital branches, emergency phone numbers, and departments, and maintains an unchangeable, permanent record (Audit Trail) of every single click, edit, payment, and deletion made in the software.

### 3. Real Hospital Example
An internal auditor notices a ₹10,000 billing refund was processed on a Sunday evening. The auditor opens Settings & Audit Trail, types the invoice number: the audit log instantly displays: "User `cashier.mohan@aura.org` initiated refund of ₹10,000 from IP `192.168.1.45` at 08:42:15 PM with reason 'Duplicate billing payment'."

### 4. Who Uses It?
Super Admins, Hospital Administrators, Internal & External Compliance Auditors.

### 5. Why Does This Module Exist?
Guarantees absolute accountability. No staff member can delete an invoice or change a medical chart and claim "I didn't do it." The audit log records the truth permanently.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Audit Events Logged, Today's System Events, Security Exceptions (403 Forbidden Denials), Active Hospital Branches.
- **Cryptographic Audit Log Table:** Timestamp, User ID / Name, Role, Action (CREATE / UPDATE / DELETE / LOGIN), Entity Affected, Record ID, IP Address, Pre/Post State Changes.
- **Branch Management Panel:** Branch Name, Code, Address, Phone Helpline, Total Beds, Operating License Number.
- **System Parameters Panel:** Auto-logout session duration, password expiration rules, multi-branch synchronization toggles.

### 7. Every Tab Explained
- *Audit Trail Log Tab:* Searchable chronological black-box record of all user activities.
- *Branch Management Tab:* Adding and configuring physical hospital campus locations.
- *Clinical Departments Tab:* Setting up medical specialties (Cardiology, Neurology, Pediatrics).
- *Security Parameters Tab:* Password complexity, session timeouts, and encryption settings.

### 8. Every Button Explained
1. **"Add Hospital Branch" (`Building` / `Plus`):** Sets up a new satellite clinic or hospital campus.
2. **"Export Audit Trail (CSV)" (`Download`):** Exports certified compliance log for legal inquiries.
3. **"Filter Audit by User / Entity" (`Filter`):** Narrows logs down to a specific employee or invoice.
4. **"Update Hospital Details" (`Save`):** Updates hospital address, logo, and phone helpline.

### 9. Complete Workflow
1. Any staff member performs an action (e.g. edits patient phone number).
2. Backend middleware intercepts request.
3. Extracts User ID, Timestamp, IP Address, Old Value, and New Value.
4. Writes an immutable audit row into `core_auditlog`.
5. Auditors can inspect this log at any time; audit rows cannot be deleted or modified by anyone.

### 10. Data Entry Explanation
- *Branch Code:* Short identifier (e.g. `BR-DT-01` for Downtown, `BR-CC-02` for City Center).
- *Audit Filter Fields:* Date range, User email, Entity type (e.g. `PatientProfile`, `Invoice`, `Prescription`).

### 11. Status Explanation
- `LOGGED`: Event permanently written to database.
- `ANOMALY_FLAGGED`: Suspicious activity flagged for administrative review (e.g. multiple failed logins).

### 12. Database Explanation
- Stored in: `core_auditlog`, `core_branch`, `core_department`, `core_systemparameter`.

### 13. Module Connections
- Background listener monitors every database mutation across all 27 modules.

### 14. Permissions
- Viewing audit trails is restricted to SUPER_ADMIN, HOSPITAL_ADMIN, and AUDITOR.
- Modifying branch settings is restricted to SUPER_ADMIN.

### 15. Error Handling
- Database triggers strictly block any `DELETE` or `UPDATE` SQL statements executed on the `core_auditlog` table.

### 16. Practical Examples
- Legal inquiry requests proof of when a consent form was signed; auditor extracts timestamped audit entry within 30 seconds.
- Super Admin adds a new "Pediatric Intensive Care Unit (PICU)" department.

### 17. Important Things to Remember
- The audit trail is permanent and unchangeable; every click you make is recorded for legal safety!

---

## 3.33 Module 32: Branch Manager 14-Domain Supervisory Hub (`/staff/branch-manager`)

### 1. Module Name & Route
- **Displayed Name:** Branch Operations Hub / Supervisory Command Cockpit
- **Frontend Route:** `/staff/branch-manager`

### 2. Simple Explanation
The branch manager's personal oversight bridge. It gives the manager of a specific hospital campus a 360-degree real-time view across 14 operational domains (OPD, beds, pharmacy, cash, emergency, staff rosters) in a strictly read-only mode so they can monitor operations without accidentally changing any patient or financial records.

### 3. Real Hospital Example
The Downtown Branch Operations Manager opens his dashboard at 11:30 AM. He clicks through the domains: OPD has 82 patients with 14 in waiting; Inpatient General Ward is at 88% capacity; Pharmacy has 3 low-stock items; Cashier Counter has collected ₹1,42,000; all 12 morning shift nurses are on duty. He knows the branch is running smoothly.

### 4. Who Uses It?
Branch Operations Managers, Assistant Medical Superintendents, Facility Directors.

### 5. Why Does This Module Exist?
Branch managers need complete visibility to solve operational bottlenecks, but must be prevented from editing invoices or medical charts to preserve legal compliance.

### 6. Complete Screen Explanation
- **Top Branch Banner:** Branch Name, Facility Status, Live Clock, Export Summary Button.
- **14-Domain Navigation Grid:** Interactive tiles covering:
  1. *OPD Queue & Appointments*
  2. *Inpatient Bed Census & Wards*
  3. *Emergency & Trauma Triage*
  4. *Doctor Clinical Duty Roster*
  5. *Nursing Station Care Activities*
  6. *Pharmacy Inventory & Dispensing*
  7. *Diagnostic Pathology (LIS)*
  8. *Radiology & Medical Imaging (RIS)*
  9. *Operating Theatres & Surgical Suites*
  10. *Cashier Collections & Daily Drawer*
  11. *Insurance & Cashless TPA Tracker*
  12. *Biomedical Equipment & Assets*
  13. *HR Staff Attendance & Punches*
  14. *Branch Security & Incident Logs*
- **Domain Inspection View:** Live data tables and metrics for the selected domain with strict read-only indicators.

### 7. Every Tab Explained
- *Domain Overview Tab:* Grid showing high-level status badges across all 14 domains.
- *Detailed Domain Inspector Tab:* Deep-dive tables showing live records in the selected domain.
- *Branch Incident Logs Tab:* Operational bottlenecks, queue delays, and equipment breakdowns.

### 8. Every Button Explained
1. **"Select Domain Tile" (1 to 14):** Switches inspection view to that operational area.
2. **"Export Branch Status PDF" (`Download`):** Generates a certified operational health report.
3. **"Flag Operational Delay" (`AlertCircle`):** Sends an internal supervisory notification to department head.

### 9. Complete Workflow
1. Branch Manager logs in -> Opens `/staff/branch-manager`.
2. Inspects Domain 1 (OPD Queue): Spots excessive wait time in Cabin 2.
3. Calls Doctor to assist with queue.
4. Checks Domain 2 (Beds): Verifies 12 clean beds are available for evening admissions.
5. Checks Domain 10 (Cash Collections): Confirms daily cash matches targets.

### 10. Data Entry Explanation
- **STRICT READ-ONLY MODULE.** Zero data entry forms. Any backend API mutation attempt automatically returns `403 Forbidden`.

### 11. Status Explanation
- Green Dot: Domain operating normally within standard thresholds.
- Yellow Dot: Operational warning (e.g. queue wait time >40 minutes).
- Red Dot: Urgent bottleneck (e.g. ICU beds 100% full or critical equipment breakdown).

### 12. Database Explanation
- Read-only multi-table query combining data from across clinical, billing, inventory, and staff apps filtered strictly by `branch_id`.

### 13. Module Connections
- Aggregates live data streams from all other 26 modules into a single supervisory view.

### 14. Permissions
- Accessible to BRANCH_MANAGER, HOSPITAL_ADMIN, and SUPER_ADMIN.
- Enforces strict read-only permissions on all child endpoints.

### 15. Error Handling
- If a user tries to forge a POST/PUT request in this view, backend security triggers immediate HTTP 403 Forbidden.

### 16. Practical Examples
- Manager spots that Pharmacy Paracetamol stock is low -> Alerts warehouse manager to expedite restocking.
- Manager verifies that all scheduled night-shift emergency doctors have clocked in on time.

### 17. Important Things to Remember
- The Branch Operations Hub is a supervisory inspection cockpit; all data modifications must be performed by authorized operational staff in their respective dedicated modules!
"""

