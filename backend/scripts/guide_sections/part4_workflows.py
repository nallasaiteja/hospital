# -*- coding: utf-8 -*-
"""Part 4: Complete End-to-End Hospital Workflows (All 27 Workflows)"""

def get_part4():
    return """# PART 4: Complete End-to-End Hospital Workflows

In a real hospital, medical care is not a set of isolated computer screens. It is a continuous, living journey where information, specimens, medicines, and money move smoothly from one department to another. Below are the 27 complete end-to-end operational workflows that power AURA HMS.

---

### Master Patient Journey Architecture

```mermaid
flowchart TD
    A["Patient Arrival at Front Desk"] --> B["Register in Master Patient Index (MRN-2026-XXXXX)"]
    B --> C["Book OPD Consultation & Collect Fee (₹500)"]
    C --> D["Issue Queue Token (#A-014) & Broadcast to Lounge TV"]
    D --> E["Doctor Cabin Consultation (EMR, ICD-10, e-Prescription)"]
    E --> F{"Need Admission or Tests?"}
    F -->|"Outpatient Care"| G["Pharmacy Dispenses Drugs (FEFO)"]
    G --> H["Patient Goes Home"]
    F -->|"Diagnostics Required"| I["Lab Blood Draw (LIS) & Radiology Scans (RIS)"]
    I --> G
    F -->|"Severe Illness / Surgery"| J["Inpatient Admission (Bed G-04, ₹5,000 Deposit)"]
    J --> K["Ward Nursing Care, Hourly Vitals & MAR Administration"]
    K --> L["Doctor Signs Discharge Summary"]
    L --> M["4-Point Discharge Clearance (Doctor, Nurse, Pharmacy, Billing)"]
    M --> N["Final Settlement (Tax Invoice) & Bed Sanitization (Housekeeping)"]
```

---

### Workflow 1: New Patient Registration
1. **Who starts it:** Front Desk Receptionist (or Patient via Portal).
2. **Account used:** `RECEPTIONIST`.
3. **Button clicked:** "Register Patient" (`+ UserPlus`) on `/staff/patients`.
4. **Data entered:** Full Name (Rahul Verma), DOB (15-08-1998), Gender (Male), Mobile (`9876543210`), Blood Group (`O+`), Emergency Contact (Father - `9876543211`), Allergies (`None`).
5. **What happens next:** System executes duplicate phone check; finds zero matches.
6. **Database impact:** Creates row in `core_patientprofile`. Generates permanent Medical Record Number: `MRN-2026-00142`.
7. **Departments notified:** Patient profile is instantly searchable across all hospital branches, OPD, IPD, and Billing.
8. **Final result:** Rahul receives an SMS welcome message with his permanent MRN; physical patient barcode wristband prints.

---

### Workflow 2: Existing Patient Returning for Consultation
1. **Who starts it:** Front Desk Receptionist.
2. **Account used:** `RECEPTIONIST`.
3. **Button clicked:** Search Bar on `/staff/patients` or `/staff/appointments`.
4. **Data entered:** Phone number `9876543210` or MRN `MRN-2026-00142`.
5. **What happens next:** System pulls up Rahul's profile in 0.2 seconds, displaying past visits, blood group, and allergy warnings.
6. **Database impact:** Zero duplicate profiles created; links new visit to existing master ID.
7. **Departments notified:** Consulting doctor receives full access to previous medical consultation notes and lab reports.
8. **Final result:** Patient avoids filling repetitive paper forms.

---

### Workflow 3: OPD Appointment Booking
1. **Who starts it:** Receptionist (or Patient online).
2. **Account used:** `RECEPTIONIST`.
3. **Button clicked:** "Book Appointment" (`CalendarPlus`) on `/staff/appointments`.
4. **Data entered:** Patient MRN, Department (General Medicine), Doctor (Dr. Kumar), Date (Today), Timeslot (10:30 AM).
5. **What happens next:** System checks doctor duty roster; confirms Dr. Kumar is on duty and slot is open.
6. **Database impact:** Locks appointment slot in `clinical_appointment` with status `SCHEDULED`.
7. **Departments notified:** Slot is greyed out on other receptionist screens to prevent double-booking.
8. **Final result:** Patient ticket is prepared, triggering mandatory consultation fee payment dialog.

---

### Workflow 4: Token Generation & Waiting Lounge Broadcast
1. **Who starts it:** Receptionist.
2. **Account used:** `RECEPTIONIST`.
3. **Button clicked:** "Collect Payment & Issue Token" (`CheckCircle`) on Appointment Modal.
4. **Data entered:** Payment Mode (UPI QR), Amount (₹500).
5. **What happens next:** System generates sequential queue token `#A-014`.
6. **Database impact:** Updates `clinical_appointment` status to `CHECKED_IN`, sets `token_number = 'A-014'`, writes payment receipt.
7. **Departments notified:** WebSocket broadcast transmits Token #A-014 to Digital Waiting Lounge TV (`/lounge-tv`) and Dr. Kumar's waiting list.
8. **Final result:** Lounge TV shows Token #A-014 in "Up Next" column; printed token slip handed to patient.

---

### Workflow 5: Receptionist Consultation Payment Collection
1. **Who starts it:** Front Desk Receptionist or Cashier.
2. **Account used:** `RECEPTIONIST` / `CASHIER`.
3. **Button clicked:** "Confirm Payment" inside Token Issuance Modal.
4. **Data entered:** ₹500, UPI Transaction ID (`UPI-9842104812`).
5. **What happens next:** Financial payment voucher is generated and cash drawer ledger balance increases by ₹500.
6. **Database impact:** Writes row to `billing_paymenttransaction` and updates `billing_cashiershift`.
7. **Departments notified:** Accounts department sees ₹500 cash collection in real-time cashbook.
8. **Final result:** Official printed receipt handed to patient; consultation ticket unlocked for doctor call.

---

### Workflow 6: Doctor Consultation & EMR Clinical Charting
1. **Who starts it:** Attending Physician.
2. **Account used:** `DOCTOR`.
3. **Button clicked:** "Call Patient" (`Volume2`) on `/staff/doctor-workspace`.
4. **Data entered:** Vitals (Temp 102.4°F, BP 120/80, Pulse 98 bpm), Chief Complaints ("Fever with chills for 3 days"), ICD-10 Diagnosis (`A09 - Acute gastroenteritis`), Clinical notes.
5. **What happens next:** Waiting Lounge TV rings audio chime and announces Token #A-014 into Cabin 102. Doctor examines patient.
6. **Database impact:** Saves `clinical_consultation` linked to patient MRN and visit ID.
7. **Departments notified:** Consultation status changes to `IN_CONSULTATION`.
8. **Final result:** Medical findings recorded legally under international ICD-10 medical standards.

---

### Workflow 7: AI Voice-Based Prescription Creation
1. **Who starts it:** Doctor.
2. **Account used:** `DOCTOR`.
3. **Button clicked:** "Microphone / Voice Dictation" (`Mic`) in Doctor Workspace.
4. **Data entered:** Doctor speaks aloud: *"Tab Paracetamol 650 milligram, one tablet three times a day after meals for five days. Also capsule Omeprazole 20 milligram once daily before breakfast."*
5. **What happens next:** AI speech-to-text transcribes speech; medical parser extracts drug names, dosages, frequencies, and durations into structured table rows.
6. **Database impact:** Creates pending rows in `clinical_prescriptionitem`.
7. **Departments notified:** System cross-references patient allergy history (zero allergy flags found).
8. **Final result:** Doctor reviews parsed text in 2 seconds and clicks "Approve Prescription".

---

### Workflow 8: Prescription Reaching Pharmacy
1. **Who starts it:** Doctor.
2. **Account used:** `DOCTOR`.
3. **Button clicked:** "Finalize & Sign Consultation" (`CheckCircle`).
4. **Data entered:** Digital electronic signature PIN.
5. **What happens next:** Cryptographic signature locks consultation note; electronic prescription transmitted to pharmacy.
6. **Database impact:** Sets `clinical_prescription` status to `PENDING_DISPENSE`.
7. **Departments notified:** Real-time badge flashes on Pharmacy Dashboard (`/staff/pharmacy`): "1 New Prescription Received".
8. **Final result:** Patient walks to pharmacy counter; medicines are already lined up on the pharmacist's screen.

---

### Workflow 9: Laboratory Test Ordering
1. **Who starts it:** Doctor.
2. **Account used:** `DOCTOR`.
3. **Button clicked:** "Order Lab Tests" (`Activity`) in Doctor Workspace.
4. **Data entered:** Selects tests: "Complete Blood Count (CBC)" and "Widal Typhoid Agglutination Test". Priority: Routine.
5. **What happens next:** Order chit generated with required specimen tube types (EDTA Purple Top + Serum Yellow Top).
6. **Database impact:** Writes rows to `clinical_laborder` and `billing_invoicelineitem` (CBC ₹450 + Widal ₹350 = ₹800).
7. **Departments notified:** Laboratory phlebotomy worklist receives order; Billing desk adds ₹800 to patient account.
8. **Final result:** Patient directed to Phlebotomy Collection Booth in Room 14.

---

### Workflow 10: Sample Collection, Accessioning & Report Generation
1. **Who starts it:** Phlebotomist / Medical Lab Technician.
2. **Account used:** `LAB_TECHNICIAN`.
3. **Button clicked:** "Accession Sample & Print Barcode" (`Barcode`) on `/staff/laboratory`.
4. **Data entered:** Verifies patient ID, draws 3ml blood, scans barcode `LAB-0042`, enters analyzer results: Hb 14.1, WBC 9,200, Platelets 210,000.
5. **What happens next:** Technician clicks "Submit for Verification". Pathologist reviews values against biological reference intervals.
6. **Database impact:** Pathologist clicks "Verify & Release Report". Updates `clinical_diagnosticreport` to `VERIFIED`.
7. **Departments notified:** Doctor EMR screen and Patient Portal receive certified report immediately.
8. **Final result:** Doctor views normal blood report; patient downloads certified PDF report from smartphone.

---

### Workflow 11: Radiology Scan Ordering & Report Release
1. **Who starts it:** Doctor -> Radiographer -> Radiologist.
2. **Account used:** `DOCTOR` -> `RADIOLOGY_TECHNICIAN` -> `RADIOLOGIST`.
3. **Button clicked:** "Order Imaging" -> "Attach DICOM" -> "Sign Radiology Report".
4. **Data entered:** Doctor orders "Chest X-Ray PA View"; Radiographer captures scan and attaches PACS study link; Radiologist types: *"Clear lung fields, normal cardiothoracic ratio. No focal consolidation."*
5. **What happens next:** Radiologist signs report digitally.
6. **Database impact:** Updates `clinical_radiologyorder` to `REPORTED`; attaches DICOM URL.
7. **Departments notified:** High-resolution digital X-ray image appears directly inside Doctor Workspace.
8. **Final result:** Doctor inspects digital X-ray image without requiring physical plastic film.

---

### Workflow 12: Emergency Patient Registration & Triage
1. **Who starts it:** Emergency Triage Nurse.
2. **Account used:** `NURSE` / `DOCTOR`.
3. **Button clicked:** "Rapid ER Intake" (`AlertTriangle`) on `/staff/emergency`.
4. **Data entered:** Name ("Rahul Verma"), Mechanism ("Severe Dehydration & High Fever"), Triage Priority: **YELLOW (Urgent)**, Assigned to Bed E-03.
5. **What happens next:** Emergency physician alerted immediately; triage tag printed.
6. **Database impact:** Creates row in `clinical_emergencyvisit` with status `RESUSCITATION`.
7. **Departments notified:** ER nursing station opens emergency clinical care sheet.
8. **Final result:** Patient receives immediate IV cannula, normal saline infusion, and bedside physician evaluation within 4 minutes.

---

### Workflow 13: Emergency-to-IPD Admission
1. **Who starts it:** Emergency Physician.
2. **Account used:** `DOCTOR`.
3. **Button clicked:** "Recommend Inpatient Admission" (`Bed`) on Emergency Screen.
4. **Data entered:** Admitting Diagnosis ("Dengue Fever with Severe Thrombocytopenia"), Recommended Ward ("General Ward - Male Medical"), Admitting Consultant ("Dr. Kumar").
5. **What happens next:** Electronic admission recommendation packet transmits to Admission Desk.
6. **Database impact:** Creates `InpatientAdmission` requisition with status `ADMISSION_RECOMMENDED`.
7. **Departments notified:** Front Desk Receptionist and Ward Nursing Station receive admission alert.
8. **Final result:** Patient family directed to admission counter to select bed and place advance deposit.

---

### Workflow 14: Inpatient Bed Allocation & Advance Deposit
1. **Who starts it:** Admission Desk Executive / Receptionist.
2. **Account used:** `RECEPTIONIST`.
3. **Button clicked:** "Admit Patient" (`Bed`) on `/staff/admissions`.
4. **Data entered:** Patient MRN, Ward ("General Medical"), Bed (`G-04`), Advance Deposit Collected (₹5,000 via UPI).
5. **What happens next:** Bed G-04 status changes from Green (Available) to Red (Occupied).
6. **Database impact:** Updates `clinical_bed` to `OCCUPIED`; creates `clinical_inpatientadmission`; writes ₹5,000 advance receipt in `billing_paymenttransaction`.
7. **Departments notified:** Ward 3 Nurse receives notification: "New Inpatient arriving in Bed G-04".
8. **Final result:** Patient transferred via wheelchair to Bed G-04; family receives ₹5,000 advance deposit receipt.

---

### Workflow 15: Patient Bed Transfer (Ward to ICU)
1. **Who starts it:** Attending Doctor / Ward Charge Nurse.
2. **Account used:** `NURSE` / `DOCTOR`.
3. **Button clicked:** "Transfer Bed" (`ArrowRightLeft`) on Inpatient Detail Screen.
4. **Data entered:** Destination Ward ("Intensive Care Unit"), Destination Bed (`ICU-02`), Transfer Reason ("Drop in oxygen saturation to 88% requiring BiPAP support").
5. **What happens next:** System executes atomic reallocation: frees Bed G-04 (transitions to Yellow - Cleaning) and occupies Bed ICU-02 (Red - Occupied).
6. **Database impact:** Closes bed stay row for G-04; opens bed stay row for ICU-02; updates daily bed rent from ₹1,500/day to ₹9,500/day prorated by hour.
7. **Departments notified:** ICU team receives patient clinical file; Housekeeping alerted to disinfect Bed G-04.
8. **Final result:** Patient smoothly transferred to ICU; billing automatically charges accurate prorated bed rates.

---

### Workflow 16: Nursing Care & Vitals Recording (MAR)
1. **Who starts it:** Staff Nursing Officer.
2. **Account used:** `NURSE`.
3. **Button clicked:** "Log Vitals" and "Administer Dose" (`Check`) on Medication Administration Record.
4. **Data entered:** BP 118/76, Pulse 82 bpm, Temp 98.6°F, SpO2 99%; administers IV Ceftriaxone 1g at 08:00 AM; signs with nurse PIN.
5. **What happens next:** Electronic MAR logs dose as "Administered"; charts vitals on graphical patient trend curve.
6. **Database impact:** Writes rows to `clinical_patientvital` and `clinical_medicationadministration`.
7. **Departments notified:** Attending doctor inspects graphical temperature curve showing fever has subsided.
8. **Final result:** Complete, timestamped nursing care record maintained under NABH quality guidelines.

---

### Workflow 17: Medicine Dispensing via FEFO Discipline
1. **Who starts it:** Registered Pharmacist.
2. **Account used:** `PHARMACIST`.
3. **Button clicked:** "Dispense Prescription" (`PackageCheck`) on `/staff/pharmacy`.
4. **Data entered:** Scans drug barcode; system auto-selects Batch `AZ-101` (Expires in 2 months) over Batch `AZ-205` (Expires in 14 months).
5. **What happens next:** Pharmacist verifies 10 tablets; clicks "Confirm Dispense".
6. **Database impact:** Decrements 10 tablets from `pharmacy_stockbatch` (Batch AZ-101); writes `pharmacy_stockmovement`; adds ₹120 to patient invoice.
7. **Departments notified:** Central inventory records live stock decrement; Billing folio adds pharmacy charge.
8. **Final result:** Oldest safe batch dispensed first, cutting hospital expiry waste to zero.

---

### Workflow 18: Inpatient Running Bill Generation
1. **Who starts it:** Billing Executive.
2. **Account used:** `BILLING_EXECUTIVE`.
3. **Button clicked:** "View Inpatient Folio" on `/staff/billing`.
4. **Data entered:** Patient MRN `MRN-2026-00142`.
5. **What happens next:** System runs real-time aggregation across:
   - 4 days General Bed rent @ ₹1,500 = ₹6,000
   - 4 Doctor consultation rounds @ ₹600 = ₹2,400
   - Laboratory blood tests = ₹1,800
   - Pharmacy medications = ₹2,200
   - **Gross Total: ₹12,400**
   - Less Advance Deposit: -₹5,000
   - **Net Balance Due: ₹7,400**
6. **Database impact:** Prepares draft invoice in `billing_invoice`.
7. **Departments notified:** Family reviews itemized charges before final discharge.
8. **Final result:** Total financial transparency with zero unexpected billing surprises.

---

### Workflow 19: Insurance Eligibility & TPA Pre-Authorization
1. **Who starts it:** Insurance / TPA Coordinator.
2. **Account used:** `INSURANCE_COORDINATOR`.
3. **Button clicked:** "Submit Pre-Auth Request" (`Send`) on `/staff/insurance`.
4. **Data entered:** Insurer (Star Health), Policy #, Doctor Admission Advice, Estimated Cost (₹50,000), Diagnostic Reports.
5. **What happens next:** TPA reviews packet online; issues Initial Approval Sanction Letter for ₹40,000 within 45 minutes.
6. **Database impact:** Sets `billing_insuranceclaim` status to `APPROVED`; records pre-auth limit of ₹40,000.
7. **Departments notified:** Billing desk tags patient account as "Cashless Approved (Limit ₹40,000)".
8. **Final result:** Patient admitted without demanding large immediate cash payment from family.

---

### Workflow 20: Final Billing & Payment Settlement
1. **Who starts it:** Billing Executive & Cashier.
2. **Account used:** `BILLING_EXECUTIVE` / `CASHIER`.
3. **Button clicked:** "Settle & Print Invoice" (`Printer`) on `/staff/billing`.
4. **Data entered:** Balance payment collected (₹7,400 via Credit Card). Enters card approval authorization code.
5. **What happens next:** System closes patient invoice with ₹0.00 balance due; generates GST Tax Invoice.
6. **Database impact:** Updates `billing_invoice` status to `PAID`; posts debit to Bank Account and credits Patient Revenue Accounts.
7. **Departments notified:** Ward nursing station receives automated notification: "Billing Clearance Granted for Bed G-04".
8. **Final result:** Patient receives stamped official Tax Invoice; gate pass generated.

---

### Workflow 21: Patient Discharge (Mandatory 4-Point Clearance)
1. **Who starts it:** Attending Doctor, Ward Nurse, Pharmacist, Billing Executive.
2. **Account used:** Multi-department clearance workflow.
3. **Button clicked:** "Clear Discharge" across all 4 clearance gates on Inpatient Screen.
4. **Checklist steps:**
   - Gate 1: **Doctor Clinical Clearance:** Dr. Kumar completes discharge summary, home medications, and follow-up advice.
   - Gate 2: **Nursing Custody Clearance:** Nurse confirms removal of IV cannula, urine catheter, and wound dressing.
   - Gate 3: **Pharmacy Return Clearance:** Pharmacist verifies no unreturned medications.
   - Gate 4: **Billing Financial Clearance:** Cashier confirms zero outstanding balance.
5. **What happens next:** All 4 gates turn Green. System officially discharges patient.
6. **Database impact:** Updates `clinical_inpatientadmission` status to `DISCHARGED`.
7. **Departments notified:** Bed G-04 status automatically transitions to Yellow (Cleaning).
8. **Final result:** Patient leaves hospital safely; medical file permanently archived.

---

### Workflow 22: Bed Cleaning & Availability Restoration
1. **Who starts it:** Housekeeping Staff / Ward Attendant.
2. **Account used:** Housekeeping / Nurse.
3. **Button clicked:** "Mark Bed Cleaned" (`Sparkles`) on `/staff/admissions`.
4. **Data entered:** Confirms linen change, surface disinfection, and terminal sanitization of Bed G-04.
5. **What happens next:** Bed status transitions from Yellow (Cleaning) back to Green (Available).
6. **Database impact:** Updates `clinical_bed` status to `AVAILABLE` with timestamp.
7. **Departments notified:** Front Desk Receptionist and Dashboard immediately see Bed G-04 ready for new admissions.
8. **Final result:** Maximum bed turnover efficiency with zero risk of hospital-acquired infection.

---

### Workflow 23: Staff Onboarding & Account Provisioning
1. **Who starts it:** Super Administrator / HR Manager.
2. **Account used:** `SUPER_ADMIN`.
3. **Button clicked:** "Provision Staff" (`+ UserPlus`) on Dashboard.
4. **Data entered:** Name (Dr. Ananya), Email (`ananya.ped@aura.org`), Role (`DOCTOR`), Designation ("Senior Consultant Pediatrician"), License (`MCI-2024-8842`), Consultation Fee (₹700).
5. **What happens next:** Backend creates user account, hashes secure password, assigns role badge, and sets RBAC boundaries.
6. **Database impact:** Creates records in `authentication_customuser` and `staff_staffprofile`.
7. **Departments notified:** Dr. Ananya appears on Doctor Roster and OPD Appointment booking dropdowns.
8. **Final result:** Dr. Ananya logs in and immediately sees her pediatric consultation queue.

---

### Workflow 24: Staff Attendance, Shifts & Leave
1. **Who starts it:** Employee -> Department Head -> HR.
2. **Account used:** Staff Member -> `DEPARTMENT_HEAD` -> `HR_MANAGER`.
3. **Button clicked:** Biometric punch -> "Apply Leave" -> "Approve Leave".
4. **Data entered:** Nurse applies for 2 days medical leave; attaches doctor certificate.
5. **What happens next:** HOD approves leave; HR payroll engine marks 2 days as approved paid leave.
6. **Database impact:** Updates `operations_hr_leaveapplication` and `operations_hr_employeeattendance`.
7. **Departments notified:** Head Nurse warned to assign replacement nurse to Ward 3 morning shift.
8. **Final result:** Seamless staff coverage with 100% accurate month-end salary calculations.

---

### Workflow 25: Procurement & Inventory Replenishment
1. **Who starts it:** Department Head -> Procurement Officer -> Hospital Admin -> Warehouse.
2. **Account used:** Multi-department supply chain workflow.
3. **Button clicked:** "Purchase Requisition" -> "Generate PO" -> "Approve PO" -> "Log GRN".
4. **Lifecycle steps:**
   - Requisition: OT Head requests 50 boxes of surgical blades.
   - Quotation: Procurement Officer compares 3 vendor bids; selects lowest bidder @ ₹420/box.
   - Approval: Admin authorizes official Purchase Order (PO #9821).
   - Delivery: Vendor truck arrives at dock; warehouse logs Goods Received Note (GRN), verifies batch numbers and expiries.
5. **Database impact:** Increments warehouse inventory; creates vendor payable in Accounts Payable.
6. **Departments notified:** OT nurse receives 50 boxes; Accounts schedules electronic vendor payment.
7. **Final result:** Full supply chain transparency with zero stockouts and zero overpaying.

---

### Workflow 26: Medical Asset Maintenance & Housekeeping
1. **Who starts it:** Ward Nurse -> Biomedical Engineer.
2. **Account used:** `NURSE` -> Biomedical Engineer / `HOSPITAL_ADMIN`.
3. **Button clicked:** "Log Breakdown Ticket" (`Wrench`) on `/staff/assets`.
4. **Data entered:** Asset (`ASSET-ECG-02`), Department ("Emergency"), Issue ("Lead II cable loose connection").
5. **What happens next:** Biomedical engineer receives SMS work order alert; arrives in Emergency in 15 minutes.
6. **Database impact:** Creates row in `operations_hr_breakdownticket`; transitions asset status to `UNDER_MAINTENANCE`.
7. **Departments notified:** Engineer replaces cable, performs electrical calibration test, clicks "Complete Maintenance".
8. **Final result:** Asset status restored to `OPERATIONAL` in 22 minutes; calibration certificate attached.

---

### Workflow 27: Finance Reconciliation & Accounting Closing
1. **Who starts it:** Cashier -> Senior Accountant -> Chief Financial Officer.
2. **Account used:** `CASHIER` -> `ACCOUNTANT` -> `FINANCE_MANAGER`.
3. **Button clicked:** "Close Cash Drawer" -> "Run Bank Auto-Match" -> "Post Journal Entry" -> "Lock Fiscal Period".
4. **Lifecycle steps:**
   - Shift Closing: Cashier counts physical cash (₹84,500); matches system collections with zero variance.
   - Bank Reconciliation: Accountant matches bank statement lines against internal books (`Difference = ₹0.00`).
   - Journal Entries: Monthly depreciation (₹1,20,000) and interest accruals (₹42,000) posted.
   - Closing: CFO reviews real-time Profit & Loss statement (Net Surplus: ₹16,30,000) and locks the month.
5. **Database impact:** Sets fiscal period status to `LOCKED` in `billing_generalledgerposting`.
6. **Departments notified:** Prevents any user from making retrospective edits to closed financial periods.
7. **Final result:** Fully audited, certified financial statements ready for board review and statutory tax filing.
"""

