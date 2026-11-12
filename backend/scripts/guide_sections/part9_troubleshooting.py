# -*- coding: utf-8 -*-
"""Part 9: Comprehensive Hospital Operations Troubleshooting Guide (17 Scenarios)"""

def get_part9():
    return """# PART 9: Comprehensive Hospital Operations Troubleshooting Guide

When running a 24/7 hospital, operational bottlenecks and technical questions will arise. Below are the 17 most common operational and software scenarios, their root causes, and step-by-step diagnostic resolutions.

---

### Scenario 1: Staff Member Cannot Log In ("Invalid Credentials" or Blank Screen)
- **What the user sees:** Error banner: *"Invalid email or password"* or login button spins indefinitely.
- **Root Cause:** Incorrect password, caps lock enabled, or account suspended by administrator.
- **Diagnostic Checklist:**
  1. Verify Caps Lock is turned off.
  2. Confirm official corporate email syntax (e.g. `doctor.kumar@aura.org`).
  3. Check if your home Wi-Fi or hospital Ethernet cable is connected.
- **Resolution:**
  - If password forgotten: Click "Forgot Password" or ask Super Admin to issue a temporary password reset on `/staff/users-roles`.
  - Super Admin checks user status on `/staff/users-roles`: if account is marked `SUSPENDED`, click "Unlock Account".
- **Escalate to IT:** If password reset succeeds but login still fails, IT checks if the Django backend server is running.

---

### Scenario 2: Dashboard Shows Zero for All Metrics
- **What the user sees:** Cards show `0` for OPD Registrations, `0%` Bed Occupancy, or spinning loader.
- **Root Cause:** User selected a new or inactive hospital branch in the top header bar where zero transactions have occurred today, or backend API is unreachable.
- **Diagnostic Checklist:**
  1. Inspect the top header: which Branch is selected? (e.g. "West Wing Clinic" vs "Downtown Main").
  2. Check if appointments were actually scheduled today in that branch.
- **Resolution:**
  - Click the Branch Switcher dropdown (`Building2` icon) and switch to the active hospital branch.
  - Refresh the browser page (`Ctrl + F5`) to force a clean API reload.
- **Escalate to IT:** If selected branch has confirmed active patients but cards remain `0`, IT verifies database connectivity.

---

### Scenario 3: Cannot Register Patient ("Duplicate Mobile Number Detected")
- **What the user sees:** Red validation error: *"A patient profile with mobile number 9876543210 already exists in the Master Patient Index."*
- **Root Cause:** The patient has previously visited this hospital or another branch under that phone number.
- **Diagnostic Checklist:**
  1. Copy the phone number.
  2. Paste it into the Patient Search Bar on `/staff/patients`.
- **Resolution:**
  - System pulls up the existing record. Check if the patient name matches (e.g. Rahul Verma).
  - If it is the same patient: Do not register again! Simply click their existing profile and click "Book Appointment".
  - If it is a family member sharing the same phone (e.g. child using father's phone): Check the "Family Member / Dependent" box to create a separate MRN linked to the guardian's phone.

---

### Scenario 4: Duplicate Patient Created Accidental Double Entry
- **What the user sees:** Two different MRNs exist for the same human patient (e.g. `MRN-00142` and `MRN-00198`).
- **Root Cause:** A receptionist misspelled the name or entered an alternate mobile number on a subsequent visit.
- **Diagnostic Checklist:**
  1. Open `/staff/patients` -> Click "Merge Duplicate Records" tab.
- **Resolution:**
  - Hospital Admin selects Source MRN (`MRN-00198` - duplicate) and Target MRN (`MRN-00142` - original master).
  - Enters mandatory reason: *"Accidental double registration by front desk."*
  - Clicks "Merge Patients". System atomically moves all visit histories, lab reports, and invoices into the master MRN, and marks the duplicate as `MERGED`.

---

### Scenario 5: Appointment Timeslot Unavailable or Greyed Out
- **What the user sees:** When selecting a doctor, timeslots (e.g. 10:30 AM) are red or disabled.
- **Root Cause:** Another receptionist already booked that slot, or the doctor's roster has ended.
- **Diagnostic Checklist:**
  1. Inspect the doctor's duty hours for that date.
  2. Check how many patients are already booked in that 15-minute window.
- **Resolution:**
  - Select the immediate next available open slot (e.g. 10:45 AM).
  - If an emergency consult is required: Doctor or Admin can use the "Emergency Walk-In Override" button to book an overflow slot.

---

### Scenario 6: Token Number Not Appearing on Waiting Lounge TV
- **What the user sees:** Patient holds Token #A-014, but the Lounge TV does not display it in "Up Next".
- **Root Cause:** The appointment is still in `SCHEDULED` status because the consultation fee has not yet been paid or patient was not checked in.
- **Diagnostic Checklist:**
  1. Open `/staff/appointments`.
  2. Find Token #A-014. Look at the Payment column.
- **Resolution:**
  - If payment is pending: Click "Collect Payment & Issue Token", enter ₹500 fee, and submit.
  - If payment is completed: Click "Check-In Patient" (`UserCheck`). The token will appear on the Lounge TV immediately.

---

### Scenario 7: Consultation Payment Not Reflecting in Billing Cash Drawer
- **What the user sees:** Receptionist collected ₹500 cash, but Cashier Drawer total did not increase.
- **Root Cause:** The receptionist collected the payment under an alternate payment mode (e.g. marked UPI instead of Cash), or the cashier has not opened their daily shift drawer.
- **Diagnostic Checklist:**
  1. Open `/staff/billing` -> Click "Cashier Shifts".
  2. Check if your current shift is marked `OPEN`.
  3. Open transaction log and inspect the Payment Mode for that receipt.
- **Resolution:**
  - Ensure the Cashier clicks "Open Shift Drawer" at the start of the morning shift.
  - If payment mode was misclassified: Finance Manager reclassifies the transaction from UPI to Cash with audit reason.

---

### Scenario 8: Doctor Finalized Prescription, But Not Appearing in Pharmacy
- **What the user sees:** Pharmacist searches patient MRN, but screen says: *"No active pending prescriptions found."*
- **Root Cause:** The doctor drafted the prescription in EMR, but forgot to click the final **"Finalize & Sign Consultation"** button, leaving it in draft mode.
- **Diagnostic Checklist:**
  1. Check Doctor Workspace queue: is the visit marked `IN_CONSULTATION` (orange) or `COMPLETED` (green)?
- **Resolution:**
  - Call the consulting doctor. Doctor opens visit, reviews medications, and clicks "Finalize & Sign Consultation".
  - The prescription instantly drops into the pharmacy dispensing queue.

---

### Scenario 9: Lab Results Entered, But Report Not Appearing in Doctor EMR
- **What the user sees:** Doctor sees lab test status as `IN_PROCESSING` even though technician finished testing.
- **Root Cause:** The lab technician entered the numerical values, but the Pathologist has not yet digitally verified and released the report.
- **Diagnostic Checklist:**
  1. Open `/staff/laboratory`.
  2. Check report status: is it `SUBMITTED_FOR_REVIEW`?
- **Resolution:**
  - Pathologist opens the verification queue, reviews measured values against biological reference intervals, and clicks "Verify & Release Report".
  - The report immediately publishes to the Doctor EMR and Patient Portal.

---

### Scenario 10: Inpatient Bed Shows Occupied Even Though Patient Went Home
- **What the user sees:** Bed G-04 is physically empty in the ward, but the computer Bed Board shows it as Red (Occupied).
- **Root Cause:** The patient left the hospital, but staff did not complete the official computer discharge workflow.
- **Diagnostic Checklist:**
  1. Open `/staff/admissions` -> Click Bed G-04.
  2. Check the 4-Point Discharge Checklist status.
- **Resolution:**
  - Complete the 4-Point Clearance: Doctor signs summary -> Nurse clears custody -> Pharmacy clears returns -> Billing settles invoice.
  - Click "Complete Discharge". Bed turns Yellow (Cleaning).
  - Housekeeping disinfects room and clicks "Mark Bed Cleaned" -> Bed turns Green (Available).

---

### Scenario 11: Patient Discharge Blocked by System ("Discharge Clearance Incomplete")
- **What the user sees:** Billing executive clicks "Discharge Patient", but system blocks action with red warning: *"Cannot discharge patient. Pharmacy Return Clearance is pending."*
- **Root Cause:** The mandatory **4-Point Discharge Clearance** safeguards are active: all 4 hospital departments must sign off before custody is released.
- **Diagnostic Checklist:**
  1. Inspect the 4 clearance gates:
     - Gate 1: Doctor Clinical Summary (Signed?)
     - Gate 2: Nursing Custody Checklist (Cleared?)
     - Gate 3: Pharmacy Unused Drug Returns (Cleared?)
     - Gate 4: Billing Final Payment Settlement (Zero Balance?)
- **Resolution:**
  - Identify the grey/unapproved gate. Contact that department to complete their clearance.
  - Once all 4 gates turn Green, the system unlocks final discharge.

---

### Scenario 12: Pharmacy Inventory Shows Zero Stock, But Physical Box is on Shelf
- **What the user sees:** Pharmacist searches for "Augmentin 625mg"; computer says `0 Tablets On Hand`, but a physical box is sitting on the pharmacy shelf.
- **Root Cause:** The delivery arrived from the supplier, but the warehouse receiving dock has not yet logged the **Goods Received Note (GRN)** in the computer, or the box belongs to an unassigned batch.
- **Diagnostic Checklist:**
  1. Check if the box has a warehouse barcode sticker.
  2. Open `/staff/inventory` -> Search GRN status for that supplier.
- **Resolution:**
  - Warehouse Manager opens Procurement -> selects Purchase Order -> clicks "Log Goods Received Note (GRN)" -> inputs batch number, quantity, and expiry date.
  - Stock increments immediately and becomes available for dispensing.

---

### Scenario 13: Insurance Cashless Pre-Auth Pending for Over 3 Hours
- **What the user sees:** Inpatient admission delayed because TPA insurer has not responded to pre-auth packet.
- **Root Cause:** Insurer portal has a backlog or raised an unanswered medical query.
- **Diagnostic Checklist:**
  1. Open `/staff/insurance` -> Check claim status.
  2. Check if status says `QUERY_RAISED`.
- **Resolution:**
  - If query raised: Open query drawer, review insurer request (e.g. "Attach ultrasound image"), attach document from LIS/RIS, and click "Submit Query Response".
  - If no query: Call dedicated TPA hospital relationship manager using direct helpline listed in TPA master directory.

---

### Scenario 14: User Gets "403 Forbidden - Access Denied"
- **What the user sees:** Red banner: *"403 Forbidden • You do not have permission to access this module."*
- **Root Cause:** The logged-in staff member clicked a sidebar menu or action outside their authorized professional role (e.g. a Receptionist clicked General Ledger).
- **Diagnostic Checklist:**
  1. Check your assigned role displayed in the top right user avatar.
  2. Review the Master RBAC Matrix in Part 8 of this guide.
- **Resolution:**
  - If this module is outside your job responsibilities: This is working as intended to protect hospital compliance.
  - If your job role recently changed (e.g. promoted from Nurse to Head Nurse): Contact Super Admin to update your security role on `/staff/users-roles`.

---

### Scenario 15: Multi-Branch Data Not Showing After Switching Branches
- **What the user sees:** User switched from Downtown to City Center in header dropdown, but screens still show Downtown records.
- **Root Cause:** Browser cache retained stale API responses.
- **Diagnostic Checklist:**
  1. Check the Branch name displayed in the top header.
- **Resolution:**
  - Press `Ctrl + F5` (Hard Refresh) to clear cached browser state.
  - If problem persists: Log out, close browser tab, log back in, and select City Center branch.

---

### Scenario 16: Language Toggle Did Not Translate Certain Technical Names
- **What the user sees:** System translates headers to Hindi, but drug names like "Paracetamol 650mg" remain in English.
- **Root Cause:** This is an intentional clinical safety feature! International medical guidelines strictly forbid translating chemical pharmaceutical drug names and ICD-10 medical codes into regional languages to prevent fatal medication errors.
- **Resolution:**
  - Operational buttons, labels, and directions translate into all 5 languages; pharmaceutical formulas remain standardized in international medical Latin/English.

---

### Scenario 17: Cashier Drawer Shows Cash Shortage or Surplus at Shift End
- **What the user sees:** At shift closing, system expected ₹48,500, but physical currency counted is ₹48,300 (₹200 shortage).
- **Root Cause:** Cashier gave incorrect change to a patient, or a cash receipt was not logged in the computer.
- **Diagnostic Checklist:**
  1. Recount physical currency notes carefully.
  2. Check physical paper receipt carbon copies against computer transaction list.
- **Resolution:**
  - Enter the exact physical denomination count into the system.
  - System logs an audited **Cash Discrepancy Note** of -₹200.
  - Cashier signs the handover slip with explanation. Finance Manager reviews and signs off during weekly audit.
"""

