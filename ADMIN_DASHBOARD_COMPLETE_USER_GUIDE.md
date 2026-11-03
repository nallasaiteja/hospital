# AURA Hospital Management System — Complete Admin Dashboard User Guide
*A Simple, Beginner-Friendly, Step-by-Step Manual for Hospital Leaders and Administrators*

---

## Welcome to Your Hospital Management System (HMS)

Imagine running a giant school or a mini-city where thousands of people come every day to get treated, get medicines, take X-rays, have surgeries, and pay their bills.

If the hospital used paper notebooks for everything:
- Papers would get lost.
- Doctors wouldn't know which medicines the patient took yesterday.
- Patients would wait in long lines for hours.
- Money could be counted wrong or misplaced.

**Our Hospital Management System (HMS)** is like a super-smart digital hospital brain. It runs in a web browser on computers and tablets. It connects the receptionist, doctors, nurses, lab scientists, pharmacists, accountants, and hospital bosses so that everyone sees the right information at the exact right second!

---

## SECTION 0: Global Navigation & Header Controls

Before entering any specific room in our hospital, look at the top bar and sidebar. These controls are always visible on every screen.

### 1. Hospital Brand & Logo (Top Left)
- **What is it?** The hospital name ("AURA Multi-Specialty Hospital") and clinical status badge.
- **Why do we need it?** So staff always know which software they are logged into.
- **Clicking it:** Takes you straight back to the main Dashboard.

### 2. Multi-Branch Selector Dropdown (`Building2` Icon)
- **What is it?** A switcher for hospitals that have multiple locations (e.g., Downtown Branch, City Center Branch, West Wing Clinic).
- **Why do we need it?** Doctors and administrators who visit different branches don't need different accounts. They just choose where they are working today!
- **What happens when clicked?** A dropdown opens showing all hospital branches with green/grey status dots.
- **Result:** When you click a branch name, the system immediately filters all patients, beds, appointments, and money reports to show only that selected branch. (Handled in React via `BranchContext`).

### 3. Language Selector (`Languages` Icon)
- **What is it?** A language switcher button (supporting English, Hindi, Telugu, Tamil, and Spanish).
- **Why do we need it?** Not all hospital workers speak the same language. A nurse in Chennai might prefer Tamil, while a doctor in Hyderabad might prefer English or Telugu.
- **What happens when clicked?** A menu opens listing available languages.
- **Result:** The whole dashboard translates its text immediately without reloading the page (`i18next`).

### 4. On-Duty / Off-Duty Toggle Badge
- **What is it?** A glowing green button that says "On Duty • Active".
- **Why do we need it?** Emergency teams and receptionists need to know if a doctor is currently in the hospital building or resting at home.
- **What happens when clicked?** Toggles the staff member's live availability status between On Duty (green pulse) and Off Duty (grey).

### 5. Notification Bell Icon (`Bell` Icon)
- **What is it?** A bell with a small red badge that rings whenever something urgent happens.
- **Why do we need it?** If an emergency patient arrives in an ambulance or a lab test shows a life-threatening result ("Panic Value"), doctors get alerted immediately.
- **What happens when clicked?** A side drawer opens listing recent hospital alerts, patient admissions, and doctor duty reminders.

### 6. User Profile & Logout Menu (Top Right)
- **What is it?** Shows your avatar, first name, last name, and role badge (e.g. `SUPER_ADMIN` or `DOCTOR`).
- **Why do we need it?** To verify who is logged in and safely lock the computer when stepping away.
- **Buttons inside:**
  - **"My Profile"**: Displays your employee ID, assigned branch, and phone number.
  - **"Sign Out / Logout"**: Safely ends your session, clears your secret security token, and redirects back to the hospital login screen.

---

## SECTION 1: Dashboard Overview (`/staff/dashboard`)

### 1. Section Name
**The Clinical & Operations Command Center** (The Hospital Pilot Cockpit).

### 2. Purpose
Just like the dashboard in a car shows your speed, fuel level, and engine temperature, this screen shows the hospital director everything happening in the hospital *right now* in one single view.

### 3. Real-Life Example
Dr. Sharma, the Hospital Director, arrives at 8:00 AM, opens his tablet, and looks at the Dashboard. In 5 seconds, he sees:
- 42 patients have already registered for OPD consultations today.
- 84% of hospital beds are full (only 16 beds are free for new admissions).
- 5 diagnostic lab reports are waiting for doctor approval.
- 2 emergency trauma patients are currently in the emergency bay.
He immediately knows whether to call in extra nurses or open an extra consultation room.

### 4. Every Button Explained

#### 1. "Provision Staff" Button (`+ UserPlus`)
- **What is this button?** A fast-track button for hospital administrators to create a new doctor, nurse, or clerk account.
- **Why do we need it?** When a new doctor joins the hospital, the admin can set up their login in 30 seconds without opening complex settings.
- **Who can see it?** Restricted to `SUPER_ADMIN`, `HOSPITAL_ADMIN`, and `BRANCH_MANAGER`.
- **What happens when clicked?** Opens the **"Provision Healthcare Staff"** modal window.
- **Information required:**
  - Official Email Address (e.g. `doctor.anil@hospital.org`)
  - First Name & Last Name
  - Phone Number
  - Role dropdown (`DOCTOR`, `NURSE`, `PHARMACIST`, `LAB_TECHNICIAN`, `ACCOUNTANT`, `RECEPTIONIST`)
  - Designation (e.g. "Senior Consultant Cardiologist")
  - Specialization (e.g. "Cardiology", "Pediatrics")
  - Medical License Number (e.g. `MCI-2024-98421`)
  - Outpatient Consultation Fee in ₹ (e.g. `800`)
- **What happens after clicking "Confirm & Provision"?**
  - Sends a secure `POST /api/v1/auth/provision/` call to the Django backend.
  - Automatically generates an Employee ID (e.g. `EMP-DOC-0042`) and default secure login credentials.
  - Displays a green success banner and saves the record in PostgreSQL.

#### 2. "OPD Registrations Today" Card
- **What is it?** A big KPI counter showing total outpatient tickets created since midnight.
- **Clicking it:** Directly navigates to Module 3 (OPD & Appointments).

#### 3. "Inpatient Bed Occupancy" Card
- **What is it?** Shows what percentage of hospital beds have sleeping patients in them, plus the exact number of clean, empty beds ready for new patients.
- **Clicking it:** Directly navigates to Module 5 (IPD & Admissions).

#### 4. "Pending Diagnostic Reports" Card
- **What is it?** Shows how many blood tests, urine tests, or scans have been completed by machines but are waiting for a pathologist or radiologist to sign.
- **Clicking it:** Directly navigates to Module 7 (Laboratory & Diagnostics).

#### 5. "Emergency Visits" Card
- **What is it?** Shows casualty arrivals and active intensive care patients.
- **Clicking it:** Directly navigates to Module 4 (Emergency & Casualty).

#### 6. Quick Workflow Navigation Tiles
Six large interactive cards that jump straight into core hospital wings:
- **Outpatient (OPD) & Clinics** (`/staff/appointments`)
- **Inpatient (IPD) & Wards** (`/staff/admissions`)
- **Laboratory & Pathology** (`/staff/laboratory`)
- **Pharmacy & Dispensary** (`/staff/pharmacy`)
- **Billing & Cashier** (`/staff/billing`)
- **Administration & Staff** (`/staff/users-roles`)

#### 7. Live Queue Table: "View Details" Buttons
- **What is it?** Each row in the live waiting room queue has a blue "View Details" button.
- **What happens when clicked?** Opens that specific patient's appointment details in the OPD consultation workspace.

---

## SECTION 2: Patient Management (`/staff/patients`)

### 1. Section Name
**Patient Master Directory & Demographics Hub** (The Digital Patient Filing Cabinet).

### 2. Purpose
Every person who walks into a hospital needs a unique ID card, just like an Aadhaar card or Passport. In a hospital, this is called an **MRN (Medical Record Number)**. This section ensures no patient ever gets mixed up with someone who has the same name!

### 3. Real-Life Example
A patient named "Rahul Kumar" walks in. There might be ten Rahul Kumars in the city! The receptionist searches his phone number or Aadhaar, finds his unique record (`MRN-202611-0012`), and sees his entire past history, allergies to penicillin, and previous prescriptions.

### 4. Every Button Explained

#### 1. "+ Register Patient" Button
- **What is this button?** Creates a brand-new digital file for a first-time hospital visitor.
- **What happens when clicked?** Opens a modern 5-Step Registration Wizard:
  - **Step 1: Identity & Demographics**: First Name, Last Name, Email, Phone, Birth Date, Gender (Male/Female/Other), Blood Group (A+, B+, O+, AB+, etc.).
  - **Step 2: Address & Location**: Street Address, City, State, PIN code.
  - **Step 3: Emergency Contact**: Name of spouse or parent, Phone Number, Relationship (e.g. "Father").
  - **Step 4: Clinical History**: Known allergies (e.g. "Peanuts", "Aspirin"), chronic diseases (e.g. "Diabetes", "Hypertension"), previous surgeries.
  - **Step 5: Consent & Insurance**: Insurance company name, Policy number, General treatment consent agreement.
- **What happens after clicking "Complete Registration"?**
  - Backend API `POST /api/v1/clinical/patients/` creates the patient record in PostgreSQL.
  - Automatically generates a permanent unique **MRN** (e.g. `MRN-20261103-8A2F`).
  - Automatically creates a secure Patient Portal login account so the patient can log in from home.

#### 2. "Duplicate Detection & Merge" Button (`GitMerge` Icon)
- **What is this button?** A smart hospital cleaner tool.
- **Why do we need it?** Sometimes a patient visits on Monday and gives their phone number, and visits on Friday giving their email. An accidental duplicate file gets created.
- **What happens when clicked?** Opens the **Duplicate Record Detective** modal. The system scans the database for matching names, birth dates, or phone numbers and shows pairs with a similarity percentage (e.g. "95% match").
- **Buttons inside:**
  - **"Source MRN" Dropdown**: The duplicate mistake file you want to delete.
  - **"Target MRN" Dropdown**: The real master file you want to keep.
  - **"Merge Records" Button**: Moves all appointments, prescriptions, bills, and blood reports from the duplicate file into the master file, then deactivates the duplicate!

#### 3. Search Bar (`Search` Icon)
- **What is it?** A real-time lookup box.
- **How to use it:** Type any patient's Name, MRN, Phone Number, or Email. The table filters instantly without refreshing.

#### 4. Gender Filter Dropdown
- Options: `All Genders`, `Male`, `Female`, `Other`. Helps staff find maternity or pediatric patients quickly.

#### 5. Status Filter Dropdown
- Options: `All Patients`, `Active`, `Inactive`, `Merged`.

#### 6. Table Row Button: "EMR Chart" (`FileText` Icon)
- **What happens when clicked?** Opens **Module 2b: The Full Electronic Medical Record (EMR) Chart** (`/staff/patients/:id`).

#### 7. Table Row Button: "Edit" (`Edit` Icon)
- **What happens when clicked?** Opens the **Edit Demographics** modal to update phone numbers, home address, or emergency contacts.

---

## SECTION 2b: Patient Electronic Medical Record (EMR Chart) (`/staff/patients/:id`)

### 1. Section Name
**The Comprehensive Electronic Medical Record (EMR)** (The Patient's Entire Lifetime Health Book).

### 2. Purpose
Doctors need to see everything that ever happened to a patient: blood pressure history, past surgeries, allergy warnings, X-rays, and bills, all in one organized file.

### 3. The 17 Interactive EMR Tabs Explained:
1. **Overview & Vitals**: Displays current Blood Pressure (BP), Pulse, Temperature, Oxygen (SpO2), Height, Weight, and BMI.
2. **Demographics & Address**: Full legal name, gender, home address, and primary language.
3. **Emergency Contacts**: Next of kin contact numbers with one-click phone dialing.
4. **Medical History**: Chronic illnesses (Asthma, Diabetes), past surgeries, and family disease history. Includes **"Edit Medical History"** button.
5. **Allergies & Alerts**: Highlighted in bright red banners (e.g. "Severe Penicillin Allergy"). Warns doctors before prescribing drugs!
6. **Consents & Legal**: Signed legal permissions (Surgery Consent, Anesthesia Consent, General Care). Buttons: **"Record New Consent"** and **"Revoke Consent"**.
7. **Documents & IDs**: Scanned Aadhaar cards, insurance cards, and outside hospital transfer letters. Button: **"Upload Document"**.
8. **Appointments**: Full history of every past and upcoming consultation.
9. **Consultations**: Doctor examination notes, clinical findings, and doctor signatures.
10. **Diagnoses & Care Plans**: ICD-10 medical condition codes and step-by-step recovery plans.
11. **Prescriptions**: List of every medicine ever prescribed, dosage, and duration.
12. **Admissions & Inpatient**: History of ward stays, ICU admissions, and bed transfers.
13. **Lab Reports**: Blood tests, urine tests, biopsy reports, and downloadable PDF results.
14. **Radiology & Imaging**: X-ray reports, CT scan impressions, and ultrasound findings.
15. **Billing & Invoices**: Itemized bills, advance payments, outstanding balance, and cashier receipts.
16. **Clinical Notes**: Nursing shift handover notes and doctor progress records.
17. **Audit Trail**: Security log showing exactly which staff member viewed or updated this chart and at what timestamp.

---

## SECTION 3: Outpatient Department (OPD) & Appointments (`/staff/appointments`)

### 1. Section Name
**OPD Clinic Hub & Doctor Consultation Workspace**.

### 2. Purpose
For patients who come to the hospital for a check-up and go home the same day (not staying overnight). This section manages doctor appointment schedules, waiting room queues, token calling, and the doctor's prescription writing desk.

### 3. Real-Life Example
A patient with a cough arrives at 10:00 AM. The receptionist gives him Token #14 for Dr. Priya. The screen in the waiting area displays "Token 14 — Room 3". Inside Room 3, Dr. Priya opens Token 14, checks his throat, speaks into her microphone, and the AI voice assistant automatically generates a neat printed prescription for cough syrup!

### 4. The 4 Main Tabs:

#### Tab 1: "Live Queue & Consultations" (`queue`)
- Displays all patients waiting outside the doctor's room today.
- **Buttons inside:**
  - **"Call Next Patient"**: Updates token status to `IN_CONSULTATION` and alerts the waiting room screen.
  - **"Open Consultation Workspace" (`Stethoscope` Icon)**: Opens the doctor's complete examination desk modal.
  - **"No Show / Cancel"**: Marks the patient absent if they didn't show up when called.

#### Tab 2: "Book Advance Appointment" (`book`)
- For patients booking an appointment for tomorrow or next week.
- **Buttons inside:**
  - **"Check Availability"**: Select a doctor and date; the calendar calculates free 15-minute slots (e.g. 10:00 AM, 10:15 AM, 10:30 AM).
  - **"Confirm Booking"**: Books the slot, sends an SMS/Email to the patient, and blocks the slot on the doctor's calendar.

#### Tab 3: "Doctor Rosters & Schedules" (`schedules`)
- Sets which days of the week each doctor works (e.g., Dr. Rajesh: Mon-Wed-Fri, 9:00 AM to 1:00 PM).
- **Buttons inside:**
  - **"+ Add Schedule"**: Sets doctor shift hours and patient limits per day.
  - **"+ Request Leave"**: Doctor vacation/leave planner that automatically prevents booking appointments on leave days.

#### Tab 4: "OPD Analytics & Reports" (`reports`)
- Shows graphs of average patient waiting times (e.g., "18 minutes average wait") and peak arrival hours.

### 5. The Doctor's Consultation Workspace Modal (The Heart of Clinical Care):
When the doctor clicks **"Consult Patient"**, a modal opens with:
1. **Vital Signs**: BP, Pulse, Temp, Oxygen, Weight.
2. **Chief Complaints & Exam Notes**: Why the patient visited and what the doctor saw.
3. **Diagnosis**: Medical name of illness (e.g. "Acute Viral Bronchitis").
4. **E-Prescription Builder**:
   - Medicine search (auto-suggests drugs from hospital pharmacy).
   - Dosage (e.g. "500 mg").
   - Frequency checkboxes: Morning / Afternoon / Evening / Night.
   - Food instructions: "Before Food" or "After Food".
   - Duration: e.g. "5 days".
5. **"Voice Prescription" Button (`Sparkles` / Mic Icon)**:
   - Doctor presses the mic and says: *"Give Paracetamol 650mg twice daily after meals for three days and Azithromycin 500mg once daily before bed."*
   - Google Gemini AI converts speech into structured prescription lines instantly!
6. **Diagnostic Lab Orders**: Doctor ticks checkboxes for blood tests (e.g., CBC, Lipid Profile, Thyroid).
7. **Follow-Up Date**: Selects next appointment date (e.g., "Review in 1 week").
8. **"Finalize & Complete Consultation" Button**:
   - Saves clinical encounter in database.
   - Automatically routes prescription to the Pharmacy dispensing queue!
   - Automatically routes lab test orders to the Laboratory desk!
   - Prompts a 1-click **"Print Prescription"** slip with hospital letterhead and doctor signature.

---

## SECTION 4: Emergency & Casualty (`/staff/emergency`)

### 1. Section Name
**Emergency, Casualty & Trauma Bay** (The Red-Alert Lifesaver Wing).

### 2. Purpose
When someone has a heart attack, serious accident, or breathing trouble, there is no time to wait in OPD lines. This section gives urgent trauma patients immediate treatment, even if they arrive unconscious without any name or money!

### 3. Real-Life Example
An ambulance brings an unconscious road accident victim. Paramedics don't know his name. The emergency nurse registers him as **"Unregistered Patient - Trauma Male #01"**, tags him with a **RED triage badge**, allocates him Bed ER-02, starts IV fluids, and orders an emergency CT scan. Two hours later, his brother arrives with his ID card, and the nurse clicks **"Reconcile Patient"** to merge everything into his real name!

### 4. Every Button Explained

#### 1. "+ Rapid Triage Intake" Button
- **What is it?** Registers an emergency patient in less than 15 seconds.
- **Buttons / Options inside:**
  - **Patient Mode Toggle**: Choose between `Registered Patient` (search existing MRN) or `Unregistered Emergency Victim` (auto-assigns temporary tag like `EMERGENCY-202611-0004`).
  - **Acuity Level Selector**:
    - **RED (Immediate / Resuscitation)**: Life-threatening (cardiac arrest, severe bleeding). Patient seen in 0 minutes.
    - **YELLOW (Urgent)**: High pain, fractures, asthma. Seen in under 15 minutes.
    - **GREEN (Non-Urgent)**: Minor sprain, small cuts. Seen within 60 minutes.
  - **Arrival Mode Dropdown**: `Ambulance`, `Walk-in`, `Police Transfer`, `Outside Clinic Referral`.
  - **Assigned Emergency Doctor Dropdown**: Assigns the doctor on casualty duty.
  - **"Submit Emergency Intake" Button**: Alerts the trauma team and books an ER bay bed.

#### 2. Table Action: "Record Treatment & Vitals"
- Opens a fast vital signs log (GCS coma score, BP, Oxygen, defibrillator status, IV fluids given).

#### 3. Table Action: "Reconcile Unregistered Case"
- Replaces temporary accident names with the patient's verified legal Aadhaar/Passport name once family arrives.

#### 4. Table Action: "Transfer to IPD (Admit to Ward/ICU)"
- If the emergency doctor decides the patient needs to stay overnight or undergo surgery, clicking this button immediately initiates an Inpatient Admission request!

#### 5. Table Action: "Emergency Discharge"
- If the patient has stabilized and is safe to go home, discharge notes and follow-up warnings are recorded.

---

## SECTION 5: Inpatient Department (IPD) & Admissions (`/staff/admissions`)

### 1. Section Name
**Inpatient Bed Management, Wards & Hospital Stays**.

### 2. Purpose
Manages patients who are admitted to stay overnight in hospital rooms or Intensive Care Units (ICU). It tracks every bed, ward, daily room rent, doctor visit, nurse round, and final discharge.

### 3. Real-Life Example
A patient needs knee surgery and must stay for 4 days. The admission clerk admits him into **Ward B (Orthopedic), Room 204, Bed 02**. For 4 days, the software automatically adds the daily bed charges, meals, nursing care, and doctor rounds to his running bill. On Day 4, the doctor signs the discharge clearance, the bill is paid, and the bed status changes to "Needs Cleaning".

### 4. The 7 Tabs Explained:

#### Tab 1: "Dashboard & Bed Board" (`dashboard`)
- Visual overview of the entire hospital's bed capacity.
- Color-coded bed cards:
  - 🟢 **Green (Vacant / Ready)**: Clean bed ready for a new patient.
  - 🔴 **Red (Occupied)**: Patient is sleeping in this bed.
  - 🟡 **Yellow (Reserved)**: Patient is in surgery and will return here.
  - 🔵 **Blue (Cleaning / Housekeeping)**: Patient discharged; cleaning staff must sanitize before next use.

#### Tab 2: "Inpatient Census" (`census`)
- Full roster of every patient currently sleeping in the hospital with their Ward, Bed number, Admitting Doctor, Diagnosis, and Length of Stay (number of days admitted).

#### Tab 3: "Admissions Desk" (`admissions`)
- **Buttons inside:**
  - **"+ Request Admission"**: Doctor requests a bed for a surgery or treatment plan.
  - **"Allocate Bed" Modal**: Selects patient, chooses available Ward (General Ward, Semi-Private, Deluxe Private Suite, ICU), selects exact Bed number, and assigns the Primary Attending Doctor.

#### Tab 4: "Bed Transfers" (`transfers`)
- **"Transfer Patient" Button**: Moves a patient from one bed to another (e.g. when a recovering patient moves from the high-cost ICU bed to a normal recovery room).

#### Tab 5: "Running Bills & Interim Ledger" (`running_bills`)
- Displays the live calculated hospital bill for admitted patients so far (Room rent + Nursing charges + Surgeries + Medicines + Labs) so families are never surprised by the final bill.

#### Tab 6: "Discharge Management" (`discharge`)
- **Discharge Clearance Checklist**: To prevent patients from leaving without proper care or payment, 4 green tick checks are required:
  1. Doctor Clinical Discharge Clearance.
  2. Pharmacy Take-Home Medicines Clearance.
  3. Laboratory Outstanding Reports Clearance.
  4. Final Billing & Accounts Settlement Clearance.
- **"Generate Discharge Summary" Button**: Prints the official hospital discharge document with admission diagnosis, surgery performed, recovery status, and home medication schedule.

#### Tab 7: "Inpatient Reports" (`reports`)
- Bed Turnover Rate, Average Length of Stay (ALOS), and Ward Occupancy charts.

---

## SECTION 6: Doctors & Nursing Management (`/staff/doctors-nursing`)

### 1. Section Name
**Clinical Staff Directory & Nursing Shift Coordinator**.

### 2. Purpose
Maintains professional records of all doctors, surgeons, specialists, and nurses. It tracks their active medical license numbers, consultation fees, departments, shift schedules, and duty statuses.

### 3. Real-Life Example
A pregnant woman arrives in labor. The receptionist needs an Obstetrician immediately. She opens this section, filters by "Obstetrics & Gynecology", sees Dr. Ananya is currently "On Duty • Floor 3", and pages her immediately.

### 4. Buttons and Controls:
- **Search Clinician Bar**: Fast search by doctor name, employee code, or department.
- **Department Filter**: Cardiology, Neurology, Orthopedics, Pediatrics, General Surgery, Emergency, etc.
- **"View Doctor Profile" Button**: Displays qualifications (e.g. MBBS, MD, DM), years of experience, OPD room number, and consultation fee.
- **"Nursing Shift Roster" Tab**: Lists nurse-to-bed allocation ratios (e.g. Nurse Maria assigned to ICU Beds 1 to 4 for the Night Shift).

---

## SECTION 7: Laboratory & Diagnostics (`/staff/laboratory`)

### 1. Section Name
**Pathology Laboratory & Diagnostic Testing Desk**.

### 2. Purpose
When a doctor suspects an infection, diabetes, or kidney problem, they order a blood or urine test. This module tracks the entire journey of that sample: from collecting the vial, running the test machine, typing the values, to a pathologist signing the report.

### 3. Real-Life Example
A doctor orders a "Complete Blood Count (CBC)" for little Rohan.
1. The phlebotomist takes a blood sample in a purple-top vial and sticks a printed barcode on it.
2. The lab technician scans the barcode into the machine, which measures Rohan's Hemoglobin as 13.5 g/dL.
3. Pathologist Dr. Varma reviews the numbers on screen, verifies they are within normal range, and clicks **"Approve & Release Report"**.
4. Rohan's mother gets an instant SMS notification and views the report on her phone!

### 4. The 8 Tabs Explained:
1. **Orders**: All test requests sent by OPD and IPD doctors.
   - Button: **"Collect Sample"**: Generates a barcode ID and confirms the blood/urine vial has been received.
2. **Samples & Accessioning**: Tracks sample tubes currently in the centrifuges and analyzers.
3. **Result Entry**: Where lab technicians type measured numbers. Has automatic high/low warnings (numbers turn red if outside normal reference range).
4. **Critical / Panic Values (`AlertTriangle` Icon)**: Tests with dangerous results (e.g. blood sugar over 500 mg/dL). Flags a bright red siren and notifies the doctor immediately.
5. **Test Catalogue**: Hospital price list and parameters for 400+ lab tests (e.g. Lipid Profile, Liver Function Test, Urine Routine).
   - Button: **"+ Add New Test to Catalogue"**: Sets test name, specimen type, turnaround time, normal ranges, and price.
6. **Outsourced Tests**: Tests sent to specialized outside partner laboratories (e.g. genetic DNA sequencing).
7. **Lab Equipment & Calibrations**: Maintenance tracker for automated analyzer machines.
8. **Financials**: Lab revenue, bill collection, and reagent cost tracking.

---

## SECTION 8: Radiology & Imaging (`/staff/radiology`)

### 1. Section Name
**Radiology, Scans & Medical Imaging**.

### 2. Purpose
For seeing inside the human body using advanced cameras and machines: X-Rays, CT Scans, MRIs, and Ultrasounds.

### 3. Real-Life Example
A boy falls off his bicycle and hurts his arm. The doctor orders an "X-Ray Right Forearm".
1. The radiology technician schedules the X-Ray in Room R-02.
2. The technician takes the scan and saves it to the hospital's image server (PACS).
3. The Radiologist views the digital bones on his high-definition monitor, types *"Hairline fracture of distal radius"*, and clicks **"Release Report"**.
4. The orthopedic surgeon views the report on his computer and puts a plaster cast on the boy's arm.

### 4. Buttons and Controls:
- **Modality Filter Dropdown**: Choose between `X-RAY`, `CT SCAN`, `MRI`, `ULTRASOUND`, `MAMMOGRAPHY`, `PET-CT`.
- **"Schedule Scan" Button**: Books an appointment time slot and scanner suite room.
- **"Enter Findings & Impression" Button**: Text editor where the radiologist writes clinical findings, radiological impression, and recommendations.
- **"Release Final Report" Button**: Digitally signs the report, locks it against unauthorized edits, and makes it available in the patient's EMR and Patient Portal.
- **"Print Report" Button**: Prints formal radiology report on hospital letterhead.

---

## SECTION 9: Pharmacy Formulary & Dispensing (`/staff/pharmacy`)

### 1. Section Name
**Hospital Pharmacy, Dispensary & Drug Formulary**.

### 2. Purpose
Medicines cure illnesses, but the wrong pill or an expired pill can be dangerous! This module manages the hospital pharmacy inventory, tracks expiry dates, processes electronic prescriptions from doctors, and handles medicine billing.

### 3. Real-Life Example
Mrs. Lakshmi brings her doctor's e-prescription to the pharmacy counter.
1. The pharmacist enters her token number. The screen instantly shows the 3 medicines her doctor prescribed 5 minutes ago.
2. The pharmacist scans the medicine barcodes from the shelf.
3. The system checks: *"Are these pills expired? No. Are they the correct dosage? Yes."*
4. The system prints a bill, subtracts 30 tablets from the warehouse inventory, prints label instructions (*"Take 1 tablet after breakfast"*), and hands the package to Mrs. Lakshmi.

### 4. Buttons and Controls:
- **"+ Add Medicine to Formulary" Button**: Adds a new drug with its Generic name, Brand name, Dosage form (Tablet, Syrup, Injection, Ointment), Strength (e.g. 500mg), Reorder stock level, Purchase cost, and Selling price.
- **"+ Add Medicine Batch" Button**: Records newly arrived medicine shipments with Batch Number, Expiry Date, Quantity Received, and Storage Shelf Location.
- **Prescription Dispensing Queue**:
  - **"Dispense Prescription" Button**: Verifies doctor orders, picks batches using **FEFO (First Expired, First Out)** logic, and creates an official pharmacy invoice.
- **"Near Expiry Alert" Tab**: Shows medicines expiring in the next 30, 60, or 90 days so the pharmacy can return them to the manufacturer before they expire!
- **"Narcotics / Schedule H Register"**: Special high-security tracker for potent pain medicines requiring dual pharmacist sign-offs.

---

## SECTION 10: Inventory & Procurement (`/staff/inventory`)

### 1. Section Name
**Hospital Procurement, Warehouse & Supply Chain**.

### 2. Purpose
A hospital uses tens of thousands of items every day: syringes, surgical gloves, bandages, oxygen cylinders, cleaning liquid, and surgical scissors. If the hospital runs out of gloves during surgery, operations stop! This module ensures the warehouse is always stocked.

### 3. Real-Life Example
The ICU nurse notices they only have 20 sterile syringes left.
1. She clicks **"+ Create Requisition"** requesting 500 syringes.
2. The purchase manager approves it and sends a **Purchase Order (PO)** to "MedSupply Ltd".
3. Two days later, a delivery truck arrives. The store clerk clicks **"Generate GRN (Goods Received Note)"**, counts 500 syringes, checks the boxes are undamaged, and confirms receipt.
4. The software automatically increases warehouse syringe stock by 500!

### 4. The 12 Tabs Explained:
1. **Suppliers & Vendors**: Directory of pharmaceutical and equipment companies with contact numbers, GST numbers, and payment credit terms.
2. **Requisitions**: Department requests for hospital supplies.
3. **Quotations / RFQs**: Price quotes from different vendors to choose the best price.
4. **Purchase Orders (PO)**: Official contracts sent to vendors to order items.
5. **Goods Received Notes (GRN)**: Inspection checklist when delivery trucks arrive at the hospital gate.
6. **Vendor Invoices**: Bills sent by suppliers for payment.
7. **Purchase Returns**: Items sent back to suppliers due to defects or damage.
8. **Vendor Credit Notes**: Money credits from vendors for returned items.
9. **Payment Schedules**: Calendar showing which supplier bills are due this week.
10. **AP Balances (Accounts Payable)**: Total money the hospital owes to suppliers.
11. **Vendor Performance**: Ratings based on delivery speed and product quality.
12. **Stock Movements & Ledger**: Audit trail of every syringe, bandage, or IV tube moved between departments.

---

## SECTION 11: Operation Theatre & ICU Surgical Suite (`/staff/surgery-icu`)

### 1. Section Name
**Operation Theatres (OT), Intensive Care & Specialized Facilities**.

### 2. Purpose
For complex surgical operations and life-support monitoring. It coordinates surgeons, anesthetists, sterile rooms, ambulances, blood bank donations, and medical waste disposal.

### 3. Real-Life Example
Dr. John is performing heart bypass surgery on Friday at 9:00 AM.
1. The OT Manager books **"OT Suite #03 (Cardiac)"**.
2. The system checks surgeon schedules, anesthetist availability, and pre-op anesthesia fitness clearance.
3. Two units of O-Positive blood are reserved from the hospital Blood Bank.
4. Post-surgery, the patient is transferred directly into Bed ICU-04, where nurses log heart telemetry and ventilator oxygen pressures every 30 minutes.

### 4. The 7 Tabs Explained:
1. **Dashboard**: Live status of all Operation Theatres (Occupied, Sanitizing, Free) and ICU ventilator beds.
2. **OT Bookings**: Scheduling surgeries, assigning lead surgeons, scrub nurses, and pre-op checklists.
3. **ICU Monitoring**: High-dependency vital signs, Glasgow Coma Scale (GCS), ventilator settings, and arterial blood gas numbers.
4. **Ambulance Fleet**: Real-time status of emergency vehicles (Available, On Mission, Maintenance), driver names, and oxygen cylinder checks.
5. **Blood Bank**: Cold-storage inventory of blood units (A+, B+, O+, AB+, etc.), donor collection records, and patient cross-matching.
6. **Housekeeping & Sanitation**: Room sanitization schedules, terminal cleaning audits after infectious patients, and bed turnover timers.
7. **Biomedical Waste Management**: Strict color-coded disposal tracker (Yellow = anatomical waste, Red = contaminated plastics, Blue = glassware, White = sharps/needles) complying with environmental safety laws.

---

## SECTION 12: Billing & Cashier Desk (`/staff/billing`)

### 1. Section Name
**Hospital Invoicing, Cash Counter & Payment Gateway**.

### 2. Purpose
Calculates hospital charges fairly, issues itemized receipts, collects advance security deposits, and lets patients pay via Cash, Credit Card, UPI (Google Pay / PhonePe), or online via Razorpay.

### 3. Real-Life Example
A patient is ready to pay for their consultation and lab test.
1. The cashier opens Invoice `INV-202611-0082`.
2. Total bill is ₹1,200.
3. The patient says, *"I want to pay ₹500 in Cash and ₹700 using Google Pay UPI."*
4. The cashier records the split payment, clicks **"Authorize Payment"**, and hands over a printed, stamped receipt with a clean zero balance!

### 4. The 12 Tabs Explained:
1. **Dashboard**: Today's cash collections, card collections, UPI payments, and outstanding hospital receivables.
2. **Invoices**: Every bill generated in the hospital.
   - Button: **"+ Create Invoice"**: Manually generates an itemized bill for any hospital service.
   - Button: **"Record Payment"**: Takes payments in Cash, Card, Netbanking, or UPI.
   - Button: **"View Statement / Print"**: Prints the official hospital bill itemizing every doctor visit, room day, medicine, and bandage.
3. **IPD Billing**: Daily room rent accumulation and interim discharge estimation.
4. **Services Catalogue**: Price list of all 500+ hospital services (e.g. ECG = ₹350, Dressing = ₹150).
5. **Tariff Schedules**: Different price categories (e.g. General Ward Tariff vs VIP Suite Tariff).
6. **Health Packages**: Bundled deals (e.g. "Executive Master Health Checkup Package = ₹2,999").
7. **Advance Deposits**: Pool of advance money paid by patients upon admission.
   - Button: **"+ Collect Deposit"**: Issues a deposit receipt.
   - Button: **"Allocate Deposit"**: Applies advance deposit money to offset the final discharge bill.
8. **Money Receipts**: Official printed cash receipts with unique receipt numbers (`REC-...`).
9. **Discount Approvals**: Special fee reduction requests requiring administrator or Medical Superintendent signature.
10. **Credit Notes**: Corrections for billed items that were cancelled or returned.
11. **Cashier Shifts**: Manages the physical cash drawer. Cashiers record their opening float at 8:00 AM, log every payment, and reconcile physical cash when handing over the shift at 4:00 PM.
12. **Razorpay Online Gateway**: Tracks digital online payments, webhooks, and bank settlement reconciliations.

---

## SECTION 13: Insurance & Corporate TPA Claims (`/staff/insurance`)

### 1. Section Name
**Health Insurance, Cashless Claims & Corporate Desk**.

### 2. Purpose
Many patients do not pay from their own pockets; their health insurance company (like Star Health, HDFC Ergo, or Medi Assist) or their employer (like Infosys or TCS) pays the bill. This desk manages pre-authorizations, claim forms, query letters, and final cashless settlements.

### 3. Real-Life Example
Mr. Verma has Star Health Insurance and needs gallbladder surgery costing ₹60,000.
1. The insurance coordinator submits a **Cashless Pre-Authorization Request** on this screen with the doctor's clinical notes.
2. Two hours later, Star Health approves an initial amount of ₹45,000.
3. The hospital performs the surgery.
4. On discharge, the hospital sends the final bills to Star Health and collects only the remaining non-medical co-pay of ₹5,000 from Mr. Verma!

### 4. The 13 Tabs Explained:
1. **Overview**: Live claims pipeline, pre-auth approval rates, and total money pending from insurance companies.
2. **Providers & TPAs**: Directory of empanelled insurance companies and TPAs.
3. **Corporate Accounts**: Corporate tie-up contracts with companies providing credit healthcare to their employees.
4. **Patient Coverages**: Records of patient policy numbers, TPA member IDs, and sum insured limits.
5. **Eligibility Verification**: Real-time policy active status verification.
6. **Pre-Authorization**: Requests sent to insurance doctors before admission.
7. **Cashless Desk**: Active inpatients undergoing treatment under cashless guarantee.
8. **Reimbursement Dockets**: Preparing complete claim packets with stamped summaries for patients paying upfront.
9. **Claim Documents**: Scans of Aadhaar cards, insurance e-cards, and diagnostic proofs.
10. **Queries & Deficiencies**: When insurance companies ask questions (*"Why was this medicine needed?"*), the team submits replies here.
11. **Settlement Vouchers**: Tracking actual bank deposits from insurers, TDS tax deductions, and disallowed deductions.
12. **Corporate Invoices**: Bulk monthly invoices sent directly to corporate partner companies.
13. **Receivables Aging**: Shows which insurance companies are late in paying their bills (0-30 days, 31-60 days, 60+ days).

---

## SECTIONS 14 to 21: Complete Hospital Finance & Accounting Suite

Hospitals are large financial organizations. These 8 modules form an enterprise-grade accounting system:

### 1. Section 14: Financial Accounts (`/staff/financial-accounts`)
- **What is it?** The hospital's **Chart of Accounts (COA)**.
- **Why do we need it?** Organizes all money into 5 standard buckets:
  1. **Assets**: Hospital buildings, MRI machines, bank cash.
  2. **Liabilities**: Bank loans, money owed to medicine suppliers.
  3. **Equity**: Owner capital and retained savings.
  4. **Revenue**: OPD consultation fees, surgery income, lab test charges.
  5. **Expenses**: Doctor salaries, electricity bills, oxygen cylinder purchases.

### 2. Section 15: Financial Transactions (`/staff/transactions`)
- **What is it?** The double-entry bookkeeping journal.
- **Why do we need it?** Every single rupee that moves in the hospital is recorded as a Debit and a Credit so that the books always balance perfectly.
- **Buttons inside:**
  - **"+ New Journal Voucher"**: Records adjustments, asset depreciation, or manual transfers.

### 3. Section 16: Investment Registers (`/staff/investments`)
- **What is it?** Tracks hospital long-term savings, Fixed Deposits (FDs) in banks, and interest earned.

### 4. Section 17: Banking & Reconciliation (`/staff/banking`)
- **What is it?** Connects hospital bank accounts with the accounting software.
- **Why do we need it?** Reconciles bank statements against hospital software receipts to make sure no money went missing.

### 5. Section 18: Loans & Liabilities (`/staff/loans`)
- **What is it?** Tracks bank loans taken to buy expensive machines (like a ₹5 Crore CT scanner) and calculates monthly EMI payments.

### 6. Section 19: Accounting & General Ledger (`/staff/general-ledger`)
- **What is it?** The master book of accounts and the **Trial Balance**.
- **Why do we need it?** Proves that total Debits equal total Credits. Used by statutory auditors.

### 7. Section 20: Budgeting & Cash Flow (`/staff/budgeting`)
- **What is it?** Annual spending plans for each department (e.g. "Cardiology budget for 2026: ₹50 Lakhs").
- **Why do we need it?** Warns management if a department is spending money too fast!

### 8. Section 21: Profit & Loss Statement (`/staff/profit-loss`)
- **What is it?** The final financial scoreboard: **Total Income minus Total Expenses = Net Profit**.
- **Why do we need it?** Shows hospital trustees whether the hospital made a profit or a loss this month.

---

## SECTION 22: HR & Staff Payroll (`/staff/hr-payroll`)

### 1. Section Name
**Human Resources, Staff Attendance & Monthly Payroll**.

### 2. Purpose
A hospital cannot heal patients without healthy, happy doctors, nurses, and staff. This section manages employee profiles, shifts, leaves, biometric attendance, and monthly salary payslips.

### 3. Real-Life Example
At the end of October, the HR manager opens this module.
1. The system reviews the biometric fingerprint punches of Nurse Priya: 26 days worked, 2 paid leaves, 0 unexcused absences.
2. Her salary is calculated: Basic Pay + House Rent Allowance (HRA) + Night Shift Bonus minus Provident Fund (PF) and Professional Tax.
3. The HR manager clicks **"Process Monthly Payroll"**.
4. Priya's net salary is deposited into her bank account, and her PDF payslip is generated automatically!

### 4. The 6 Tabs Explained:
1. **Dashboard**: Total employees, on-duty headcount, staff on leave, and monthly salary budget.
2. **Employees**: Staff records, designations, joining dates, bank account numbers, and emergency contacts.
3. **Attendance**: Daily clock-in and clock-out logs from biometric scanners.
4. **Rosters**: Weekly schedules assigning morning, evening, and night shifts.
5. **Leaves**: Employee vacation and sick leave requests with approval buttons for supervisors.
6. **Payroll**: Monthly salary processing, salary structure setup, PF/ESI deductions, and 1-click **"Download Payslip"** buttons.

---

## SECTION 23: Equipment & Asset Management (`/staff/assets`)

### 1. Section Name
**Biomedical Equipment & Hospital Asset Care**.

### 2. Purpose
Tracks millions of rupees worth of hospital equipment (ventilators, dialysis units, anesthesia workstations, monitors, hospital beds). Ensures machines receive regular servicing so they never fail during treatment!

### 3. Real-Life Example
Ventilator #04 in the ICU is due for its 6-month calibration. The software flags a preventive maintenance reminder. A biomedical engineer inspects the pressure sensors, replaces the air filter, clicks **"Log Maintenance Completed"**, and attaches the service certificate.

### 4. Buttons and Controls:
- **"+ Register New Asset" Button**: Enters equipment name, model number, serial number, manufacturer, purchase date, warranty expiration date, and assigned department.
- **"Log Breakdown / Maintenance" Button**: If a machine beeps with an error, staff log a breakdown ticket immediately alerting the engineering team.
- **"Preventive Maintenance Schedule" Tab**: Calendar showing upcoming AMC (Annual Maintenance Contract) service visits.

---

## SECTION 24: Patient Portal Gateway (`/staff/patient-portal`)

### 1. Section Name
**Patient Digital Access & Portal Security Desk**.

### 2. Purpose
Gives patients secure access to their own health records from home via their smartphone or computer, without letting them see other patients' confidential records!

### 3. Real-Life Example
A patient goes home after treatment and wants to download his blood test report to show his family doctor. The receptionist enables his portal account, and the patient logs in at [`/patient/login`](http://localhost:5173/patient/login) using his email and password to view his prescriptions, test results, and invoices.

### 4. Buttons and Controls:
- **Patient Account Status Table**: Shows all registered patients and whether their portal access is Active or Locked.
- **"Send Password Reset Link" Button**: Emails the patient a secure one-time password reset link if they forget their credentials.
- **"Toggle Portal Access" Button**: Temporarily disables or enables a patient's online login for security reasons.

---

## SECTION 25: Reports & Analytics (`/staff/reports`)

### 1. Section Name
**Hospital Business Intelligence & Executive Analytics**.

### 2. Purpose
Turns hundreds of thousands of patient records into clear charts, graphs, and performance numbers so hospital management can make smart business and clinical decisions.

### 3. Real-Life Example
The hospital board wants to know whether to buy a second MRI machine. They open this section, check the "Radiology Utilization Report", and see the current MRI machine was running at 98% capacity every day for the past six months with a 4-day waiting list. They immediately approve purchasing the second machine!

### 4. Key Reports Included:
1. **Clinical KPI Reports**: Total OPD consultations, admissions, mortality rates, and surgical recovery rates.
2. **Occupancy & Capacity Reports**: Bed occupancy percentages, average length of stay by department.
3. **Financial Revenue Reports**: Daily cash collections, insurance claim turnaround times, revenue per doctor.
4. **Pharmacy & Consumption Reports**: Top 10 most prescribed medicines, stock wastage rates.
5. **Export Buttons (`Download` / `FileSpreadsheet` Icons)**: Download any report as an **Excel CSV** or **PDF summary** with one click.

---

## SECTION 26: Users, Roles & Permissions (RBAC) (`/staff/users-roles`)

### 1. Section Name
**Hospital Security, Staff User Accounts & Role Permissions**.

### 2. Purpose
Healthcare data is strictly private and confidential. A receptionist should never see a patient's psychiatric doctor notes; a junior accountant should never change a surgical report! This module enforces **Role-Based Access Control (RBAC)** so each worker sees *only* what is necessary for their job.

### 3. Real-Life Example
Nurse Sunita logs into the system. She can view vital signs, record nursing rounds, and request medicines. But the "General Ledger" and "System Settings" buttons are completely hidden from her screen because her role is `NURSE`.

### 4. The Pre-Configured Hospital Roles:
- `SUPER_ADMIN`: The ultimate system master (can configure branches, databases, and permissions).
- `HOSPITAL_ADMIN` / `BRANCH_MANAGER`: General managers overseeing daily hospital operations.
- `MEDICAL_DIRECTOR`: Chief medical officer reviewing clinical protocols and quality.
- `DOCTOR`: Clinicians examining patients, writing prescriptions, and ordering tests.
- `NURSE`: Nursing staff recording vitals, administering medicines, and nursing notes.
- `PHARMACIST`: Pharmacy staff dispensing prescriptions and managing drug stocks.
- `LAB_TECHNICIAN` / `PATHOLOGIST`: Laboratory personnel processing samples and signing reports.
- `RADIOLOGIST`: Imaging specialists reading scans and writing impressions.
- `ACCOUNTANT` / `CASHIER`: Billing executives collecting payments and managing cash registers.
- `HR_MANAGER`: Personnel managers handling payroll, shifts, and leaves.
- `AUDITOR`: Independent inspectors reviewing financial and compliance records.
- `PATIENT`: Verified patients viewing only their own personal records.

### 5. Buttons and Controls:
- **"+ Provision New User" Button**: Creates a new user profile with selected role and branch.
- **"Lock / Unlock Account" Button**: Freezes a compromised user account immediately.
- **"Reset Password" Button**: Generates a secure temporary password.
- **"Permission Matrix"**: Checkbox grid defining exactly which roles can View, Create, Edit, or Delete records in each module.

---

## SECTION 27: System Settings & Security Audit Trail (`/staff/settings-audit`)

### 1. Section Name
**System Settings & Immutable Security Audit Log**.

### 2. Purpose
- **Settings**: Configures hospital brand name, tax rates (GST), default currency (₹ INR), logo, and branch addresses.
- **Audit Trail**: The unbreakable black-box security recorder of the hospital. Every time anyone looks at a patient's record, changes a prescription, or edits a bill, the system writes an permanent, tamper-proof record: *Who did it, from what IP address, at what second, and what they changed!*

### 3. Real-Life Example
An auditor investigates a deleted bill from three months ago. She searches the Audit Trail for the invoice number. The log shows: *"User cashier_anil changed Invoice #841 status to Cancelled on 12-August at 04:12 PM from Terminal IP 192.168.1.45"*. The mystery is solved in seconds!

### 4. Buttons and Controls:
- **"Save Hospital Settings" Button**: Saves hospital name, tax identification numbers, and contact details.
- **Audit Search & Filter Bar**: Filter audit logs by User, Date Range, Module, or Action (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `EXPORT`).
- **"Export Audit Log" Button**: Downloads a legal compliance audit log for healthcare inspection authorities.

---

## SECTION 28: AI Voice Translation Assistant (`/staff/voice-translation`)

### 1. Section Name
**Real-Time Multilingual Doctor-Patient Speech Translator**.

### 2. Purpose
When patients travel from different states or countries, they may not speak the doctor's language. This AI assistant acts like a human translator sitting in the room: the doctor speaks English, and the computer speaks Telugu or Hindi to the patient!

### 3. Real-Life Example
An elderly patient who speaks only Tamil visits Dr. Mehta, who speaks only Hindi and English.
1. Dr. Mehta sets Source Language: **English**, Target Language: **Tamil**.
2. Dr. Mehta clicks the microphone and says: *"Where does your chest hurt, and for how many days have you had this pain?"*
3. The computer instantly translates and speaks out in clear Tamil audio: *"உங்கள் மார்பில் எங்கு வலிக்கிறது, எத்தனை நாட்களாக இந்த வலி இருக்கிறது?"*
4. The patient replies in Tamil, and the computer speaks the English translation back to Dr. Mehta!

### 4. Buttons and Controls:
- **Microphone Record Button (`Mic` Icon)**: Listens to spoken voice through computer microphone.
- **Language Dropdowns**: Choose between English, Hindi, Telugu, Tamil, Kannada, Malayalam, Marathi, Bengali, Spanish, etc.
- **"Translate Text" Button**: Translates typed or transcribed text using Google Gemini AI.
- **Audio Playback Button (`Volume2` Icon)**: Speaks the translated text aloud using natural voice speech synthesis.
- **"Clear All" Button**: Clears current conversation history.

---

## SECTION 29: End-to-End Hospital Workflows (How Everything Connects)

Here is how all these individual modules work together like a well-rehearsed orchestra:

```
[Patient Walks In] 
       │
       ▼
1. Receptionist Registers Patient ──────────► Generated MRN & Digital File
       │                                     (Module 2: Patient Management)
       ▼
2. OPD Appointment / Token Generated ───────► Real-Time Waiting Room Queue
       │                                     (Module 3: OPD & Appointments)
       ▼
3. Doctor Consultation & Examination
       ├──► Speaks into Mic ────────────────► AI Voice E-Prescription (Gemini)
       ├──► Orders Blood Tests ─────────────► Sent to Lab Desk (Module 7)
       └──► Recommends Admission ───────────► Sent to IPD Desk (Module 5)
       │
       ├───► [Patient Goes to Pharmacy] ────► Real-time Stock Deducted & Dispensed
       │                                      (Module 9: Pharmacy)
       │
       ├───► [Patient Goes to Laboratory] ──► Barcode Vials, Machines Run, Pathologist Signs
       │                                      (Module 7: Laboratory)
       │
       └───► [Patient Admitted to Inpatient]► Bed Allocated, Daily Rent Accumulated, Surgery Done
                                              (Module 5 & Module 11)
                                                     │
                                                     ▼
4. Billing & Cashier Desk ───────────────────► Itemized Final Bill Calculated
       ├──► Pays Cash / Card / UPI ─────────► Money Receipt Issued (Module 12)
       ├──► Pays Online via Razorpay ───────► Real Razorpay Order Settled (Module 12)
       └──► Claims Health Insurance ────────► Cashless Pre-Auth & TPA Settlement (Module 13)
                                                     │
                                                     ▼
5. Financial General Ledger & P&L ──────────► Recorded in Hospital Accounts
                                              (Modules 14, 15, 19, 21)
                                                     │
                                                     ▼
6. Security Audit Trail & Executive Reports ─► Permanent Audit Stamp (Modules 25, 27)
```

---

## SECTION 30: Feature Status Checklist (What is Built and Verified)

This checklist provides an honest technical assessment of all features in your project:

### 1. Fully Functional Features (Working End-to-End with Live Database)
- **Authentication & User Provisioning**: Login, password reset, Supabase JWT tokens, RBAC roles.
- **Dashboard Command Center**: Real-time KPI counters, quick workflow navigation tiles, live waiting queue table.
- **Patient Management & Registration**: 5-step registration wizard, MRN generator, duplicate detection & record merge.
- **17-Tab Patient EMR Chart**: Overview, Vitals, Allergies, Medical History, Consents, Documents, Clinical Notes, and Audit Trail.
- **OPD & Appointments**: Live token queue, advance slot booking, doctor availability calendar, leave planner.
- **Clinical Consultation Workspace**: Complete vital entry, ICD diagnosis, treatment plans, follow-up scheduling, and prescription printing.
- **AI Voice Prescription Assistant**: Google Gemini 2.5 Flash speech-to-structured-prescription conversion.
- **Emergency / Casualty**: Acuity triage (Red/Yellow/Green), unregistered trauma intake, doctor assignment, reconciliation.
- **IPD Bed Management**: Bed board visualizer, ward allocations, bed transfers, running bills, discharge checklists.
- **Pharmacy & Formulary**: Drug master catalog, batch tracking, FEFO stock reduction, e-prescription dispensing.
- **Procurement & Inventory**: Purchase Requisitions, Vendor POs, Goods Received Notes (GRN), stock ledger.
- **Surgery & ICU**: Operation theatre suite bookings, surgical team rosters, ICU observation logs, ambulance fleet, blood bank units.
- **Billing & Invoices**: Itemized bills, partial/split payments, cashier shift cash reconciliation, printed receipts.
- **Razorpay Payment Gateway**: Real Razorpay Orders API (`api.razorpay.com/v1/orders`), Test Mode checkout popup, and HMAC-SHA256 signature verification.
- **Insurance & TPA Claims**: Cashless pre-authorizations, corporate accounts, claim documents, settlement vouchers.
- **Finance Suite**: Chart of accounts, journal vouchers, general ledger, trial balance, budgeting, and profit/loss statements.
- **HR & Payroll**: Employee directory, attendance logs, rosters, leave approvals, monthly salary payroll calculation, payslips.
- **Biomedical Asset Management**: Equipment inventory, breakdown work orders, preventive maintenance reminders.
- **Patient Portal Gateway**: Isolated patient login, appointments, lab reports, and billing.
- **Multilingual Support**: Real-time interface translation in English, Hindi, Telugu, Tamil, and Spanish.
- **Voice Translation Utility**: Real-time speech-to-speech translation across 12+ Indian and international languages.
- **Security Audit Logs**: Tamper-proof audit trail tracking all user operations.

### 2. Partially Functional / Simulation Supported
- **External PACS/DICOM Server**: The radiology module records study UIDs, clinical impressions, and findings; connecting to live physical hospital PACS imaging hardware uses simulated DICOM links.
- **Direct Biometric Machine Hardware**: Attendance can be logged via UI and API; physical thumbprint hardware sync uses standard API webhooks.
- **External TPA Gateway APIs**: Insurer pre-auths are tracked, calculated, and approved through the hospital's internal workflow; direct EDI transmission to external government insurance portals uses standardized export dockets.

### 3. UI-Only / Mock Elements
- **None**: All 27 modules in this project are connected to real backend Django REST Framework APIs and Supabase PostgreSQL database tables. There are no static dead-end dummy screens.

---

## SECTION 31: Important Hospital Terms and Simple Meanings

| Hospital Term | What It Means in Simple English |
| :--- | :--- |
| **OPD (Outpatient Department)** | For patients who visit the doctor for a consultation, get medicines, and go home the same day. |
| **IPD (Inpatient Department)** | For patients who are sick enough to need a hospital bed and sleep overnight for care. |
| **MRN (Medical Record Number)** | The unique permanent ID card number assigned to a patient for their entire life. |
| **EMR (Electronic Medical Record)** | The complete digital health notebook of a patient storing all their past illnesses, surgeries, and prescriptions. |
| **Triage** | The quick sorting process in the emergency room to decide who is in the most danger and needs a doctor first. |
| **Acuity (Red / Yellow / Green)** | Emergency danger level: Red = dying/immediate danger; Yellow = urgent; Green = minor scratch. |
| **TPA (Third Party Administrator)** | An organization that processes health insurance claims between the patient, hospital, and insurance company. |
| **Pre-Authorization (Pre-Auth)** | Getting written permission from the insurance company before a surgery to ensure they will pay the bill. |
| **Cashless Hospitalization** | When the patient walks into the hospital, gets treated, and walks out without paying cash because insurance pays directly. |
| **Reconciliation** | Checking two sets of records (like hospital software vs bank statement, or unregistered patient vs legal ID) to ensure they match. |
| **Formulary** | The official approved list of all medicines stocked and allowed in the hospital pharmacy. |
| **FEFO (First Expired, First Out)** | Selling or using medicines that expire sooner before newer medicines so nothing goes to waste. |
| **PO (Purchase Order)** | An official business letter ordering goods (like syringes or bandages) from a supplier. |
| **GRN (Goods Received Note)** | A receipt signed at the hospital warehouse gate confirming delivery boxes arrived safely. |
| **Discharge Summary** | The final report given to a patient leaving the hospital explaining what illness they had, what surgery was done, and what pills to take at home. |
| **General Ledger** | The master accounting book recording every single financial debit and credit across the entire hospital. |
| **Accounts Receivable (AR)** | Money that patients, insurance companies, or corporate clients owe the hospital that hasn't been paid yet. |
| **Accounts Payable (AP)** | Money that the hospital owes to medicine suppliers, equipment vendors, or doctors. |
| **RBAC (Role-Based Access Control)** | Digital security locks ensuring each staff member can only see screens necessary for their specific job. |

---

*Document prepared for AURA Hospital Management System administration, leadership, and client presentations.*

