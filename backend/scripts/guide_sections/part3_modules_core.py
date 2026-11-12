# -*- coding: utf-8 -*-
"""Part 3: Deep-Dive Module-by-Module Guide (Core Patient & Clinical Modules)"""

def get_part3_core():
    return """# PART 3: Deep-Dive Module-by-Module Guide (Part 1: Core Operations)

---

## 3.1 Global Navigation & Header Controls

### 1. Module Name & Route
- **Displayed Name:** Global Header Bar & Sidebar Navigation
- **Frontend Route:** Always persistent across `/staff/*`

### 2. Simple Explanation
The top bar and left sidebar are like the compass and hallway signboards of the hospital. Wherever you walk inside the building, the signboards show you where you are, which branch you are standing in, who you are, and which rooms you have keys to open.

### 3. Real Hospital Example
Dr. Sharma works across two hospital campuses: City Center and West Wing. When he logs in at City Center, the header shows "City Center Branch". When he drives to West Wing in the afternoon, he clicks the branch dropdown, selects "West Wing", and instantly sees West Wing's patient queue and bed census.

### 4. Who Uses It?
All authenticated hospital staff members across all 21 roles.

### 5. Why Does This Module Exist?
Prevents staff confusion, guarantees multi-branch data isolation, enables instant language translation, and displays real-time emergency notifications.

### 6. Complete Screen Explanation
- **Top Left:** Hospital Brand Logo ("AURA Multi-Specialty Hospital") and status dot.
- **Top Center:** Multi-Branch Switcher Dropdown (`Building2` icon).
- **Top Right:**
  - Language Selector (`Languages` globe icon: EN, HI, TE, TA, KN).
  - On-Duty / Off-Duty Toggle Badge (`Activity` green pulse).
  - Notification Bell (`Bell` with red badge counter).
  - User Profile Avatar with Role Badge and Sign-Out Menu.
- **Left Sidebar:** Collapsible accordion grouping 27 numbered operational modules with clear iconography.

### 7. Every Tab Explained
- *Core Operations Group:* Dashboard, Patient Management, OPD Appointments, Emergency, IPD Admissions, Voice Translation.
- *Clinical & Diagnostics Group:* Doctor Workspace, Doctors & Nursing, Pathology, Radiology, Pharmacy, Inventory, Surgery & OT Suite.
- *Financial Management Group:* Tariffs, Billing, Insurance, Accounts, Transactions, Investments, Banking, Loans, General Ledger, Budgeting, Profit & Loss.
- *Governance & Administration Group:* HR & Payroll, Assets, Patient Portal Gateway, Reports, Users & Roles, Settings & Audit.

### 8. Every Button Explained
1. **Branch Selector Dropdown:** Changes working branch, updating `BranchContext` and API request headers (`X-Branch-ID`).
2. **Language Toggle:** Instantly switches UI strings without page reload (`i18next`).
3. **On-Duty Toggle:** Toggles clinician availability between Green (Active in hospital) and Grey (Off-duty).
4. **Notification Bell:** Opens slide-over drawer displaying panic lab results and emergency alerts.
5. **Logout Button:** Clears JWT tokens from local storage and redirects to `/staff/login`.

### 9. Complete Workflow
1. User logs in -> Header loads profile and assigned branch.
2. User selects working branch -> All modules filter records to that branch.
3. User selects language -> UI updates immediately.
4. User logs out -> Session cleared safely.

### 10. Data Entry Explanation
- No manual data entry except selecting items from dropdowns.

### 11. Status Explanation
- `On Duty`: Active in building, available for queue assignments.
- `Off Duty`: Off shift, hidden from urgent consult calls.

### 12. Database Explanation
- Relational Tables: `core_branch`, `authentication_customuser`, `staff_staffprofile`.

### 13. Module Connections
- Connects to every page in the application by providing user identity and branch scope.

### 14. Permissions
- RBAC filters sidebar items: staff only see links authorized for their role.

### 15. Error Handling
- Network disconnection displays yellow toast: "Offline • LiveSync paused".

### 16. Practical Examples
- Receptionist switches from English to Telugu to assist a local patient.
- Nurse clicks notification bell to view urgent lab alert.

### 17. Important Things to Remember
- Always check the selected Branch in the header before booking an appointment or admitting a patient!

---

## 3.2 Module 1: Clinical & Operations Command Center Dashboard (`/staff/dashboard`)

### 1. Module Name & Route
- **Displayed Name:** Operations Dashboard / Command Center
- **Frontend Route:** `/staff/dashboard`

### 2. Simple Explanation
The hospital cockpit. Like an airplane cockpit shows altitude and fuel, this screen shows the hospital bosses and front desk staff everything happening in the hospital *right now* in one single glance.

### 3. Real Hospital Example
At 8:00 AM, the Hospital Director opens the Dashboard. Within 5 seconds, she sees 42 outpatients registered, 84% bed occupancy, 5 pending lab reports, and 2 trauma arrivals. She immediately knows whether the hospital needs extra staff.

### 4. Who Uses It?
Super Admin, Hospital Admin, Branch Manager, Medical Director, Department Heads, Doctors, Nurses, Receptionists.

### 5. Why Does This Module Exist?
Eliminates blind spots. Hospital leaders don't have to call 10 different rooms to know how many beds are free or how many patients are waiting.

### 6. Complete Screen Explanation
- **Top Row KPI Cards:** 4 live operational counter cards.
  - For Receptionists: *OPD Registrations Today*, *Inpatient Bed Occupancy*, *Waiting in Lounge*, *Completed Consultations*.
  - For Admins/Doctors: *OPD Registrations Today*, *Bed Occupancy*, *Pending Diagnostic Reports*, *Emergency Visits*.
- **Quick Launch Banner:** Front Desk Quick Access linking to Appointments.
- **Workflows Grid:** Role-tailored cards for OPD, IPD, and Patient Registration.
- **Real-Time Live Queue Table:** Live status of patient tokens in clinics.

### 7. Every Tab Explained
- Single unified overview screen; specialized sub-tabs are accessible via direct workflow card links.

### 8. Every Button Explained
1. **"Provision Staff" (`+ UserPlus`):** (Admins only) Opens modal to create a new staff account.
2. **"Quick Launch: OPD Appointments" Button:** Jumps straight to `/staff/appointments`.
3. **Workflow Cards (OPD, IPD, Patients):** Clickable cards navigating to respective modules.

### 9. Complete Workflow
1. Staff member opens `/staff/dashboard`.
2. System checks user role (`isReceptionist`, `isAdminOrMgr`).
3. Fetches live data from `/api/v1/clinical/appointments/` and `/api/v1/clinical/beds/`.
4. Renders live KPI numbers and current patient queue.

### 10. Data Entry Explanation
- Provision Staff Modal requires: Email, Name, Phone, Role, Designation, License, Consultation Fee.

### 11. Status Explanation
- Queue statuses: `SCHEDULED`, `CHECKED_IN`, `IN_CONSULTATION`, `COMPLETED`.

### 12. Database Explanation
- Queries `clinical_appointment`, `clinical_bed`, `clinical_inpatientadmission`, `clinical_diagnosticreport`.

### 13. Module Connections
- Aggregates data from Master Patient Index, OPD, IPD, Lab, and Emergency.

### 14. Permissions
- Receptionists see front-desk operational metrics; Admins see clinical pathology and emergency indicators.

### 15. Error Handling
- If backend is offline, cards display `0` with retry indicators without crashing.

### 16. Practical Examples
- Receptionist checks "Waiting in Lounge" to see that 8 patients are waiting outside doctor cabins.
- Director checks "Inpatient Bed Occupancy" to confirm 16 beds are free before accepting an emergency transfer.

### 17. Important Things to Remember
- Receptionists do not see diagnostic lab cards; they see actionable front-desk lounge counters.

---

## 3.3 Module 2: Master Patient Index & Demographics (`/staff/patients`)

### 1. Module Name & Route
- **Displayed Name:** 2. Patient Management / Master Patient Index (MPI)
- **Frontend Route:** `/staff/patients`

### 2. Simple Explanation
The hospital's central digital filing cabinet for patients. Every human being who ever visits the hospital gets a single, permanent identity card number called a **Medical Record Number (MRN)**.

### 3. Real Hospital Example
Rahul visits the hospital in 2024 for a fractured wrist. Two years later in 2026, he returns with a fever. The receptionist types his phone number, instantly finds his file, and sees his blood group, allergy history, and previous X-rays.

### 4. Who Uses It?
Receptionists, Nurses, Doctors, Admins, Billing Executives.

### 5. Why Does This Module Exist?
Prevents duplicate registrations, medical identity theft, and dangerous medical errors (such as not knowing a patient is allergic to Penicillin).

### 6. Complete Screen Explanation
- **Top Header:** Patient Search Bar (Search by Name, Phone, MRN, National ID).
- **Action Bar:** "Register Patient" button, Filter by Gender/Age, Export CSV.
- **Patient Directory Table:** Columns for MRN, Patient Name, Age/Gender, Phone, Blood Group, Registered Date, and Actions.
- **Duplicate Detection Banner:** Highlights potential duplicate patient records based on phone and name similarity.

### 7. Every Tab Explained
- *All Patients Tab:* Complete directory of registered patients.
- *Recent Registrations Tab:* Patients enrolled today.
- *Merge Duplicate Records Tab:* Administrative tool to combine accidental double entries.

### 8. Every Button Explained
1. **"Register Patient" (`+ UserPlus`):** Opens patient registration form.
2. **"View Clinical Profile" (`Eye`):** Opens full patient timeline, past visits, and diagnoses.
3. **"Edit Demographics" (`Edit`):** Updates phone number, address, or emergency contacts.
4. **"Merge Patients" (`GitMerge`):** (Admin only) Combines two duplicate MRNs into one master record.

### 9. Complete Workflow
1. Receptionist clicks "Register Patient".
2. Fills Name, DOB, Gender, Phone, Blood Group, Emergency Contact, Allergies.
3. Clicks "Save Patient".
4. Backend generates permanent MRN (e.g. `MRN-2026-00142`).
5. Patient is immediately available for appointment booking.

### 10. Data Entry Explanation
- *First & Last Name:* Full legal name.
- *Date of Birth / Age:* Computes exact age for pediatric/geriatric dosage safety.
- *Phone Number:* 10-digit mobile number for SMS token alerts.
- *Blood Group:* Critical for emergency transfusions (A+, B+, O+, AB+, etc.).
- *Allergies:* Documented drug allergies (e.g., "Penicillin", "Sulfa drugs").

### 11. Status Explanation
- `Active`: Registered and eligible for consultations.
- `Merged`: Duplicate record merged into primary master MRN.

### 12. Database Explanation
- Stored in PostgreSQL table: `core_patientprofile` (fields: `id`, `mrn`, `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`, `blood_group`, `allergies`, `branch_id`).

### 13. Module Connections
- Feeds patient identity into OPD Appointments, IPD Admissions, EMR, Billing, and Pharmacy.

### 14. Permissions
- Receptionists and Nurses can create and edit demographics.
- Merging records is restricted to Admins.

### 15. Error Handling
- Phone number validation rejects invalid formats.
- Warns immediately if phone number already exists in database.

### 16. Practical Examples
- Receptionist registers 5-year-old child and enters mother's phone number as guardian contact.
- Patient changes address; receptionist updates record in 10 seconds.

### 17. Important Things to Remember
- Always search by phone number before clicking "Register Patient" to avoid creating duplicates!

---

## 3.4 Module 3: OPD Appointments & Token Queue Management (`/staff/appointments`)

### 1. Module Name & Route
- **Displayed Name:** 3. OPD & Appointments
- **Frontend Route:** `/staff/appointments`

### 2. Simple Explanation
The digital booking counter and line organizer for outpatients. It books doctor appointments, collects consultation fees, issues waiting tokens, and coordinates patient queues so people don't fight over who goes into the doctor's room next.

### 3. Real Hospital Example
A patient named Rahul visits with a cough. Receptionist Priya books an appointment with Dr. Kumar for 10:30 AM, collects ₹500 consultation fee, and hands Rahul Token Slip #A-014. Dr. Kumar sees Token #A-014 on his computer screen.

### 4. Who Uses It?
Receptionists, Doctors, Nurses, Admins. (Patients also access it via Patient Portal).

### 5. Why Does This Module Exist?
Prevents doctor overbooking, eliminates chaotic paper token slips, guarantees consultation fee payment before visits, and synchronizes with waiting room TV displays.

### 6. Complete Screen Explanation
- **Top KPI Cards:** Total Appointments Today, Checked-In / Waiting, In Consultation, Completed Visits.
- **Filter Bar:** Filter by Doctor, Department, Date (Today, Tomorrow, Custom), and Status.
- **Appointment Queue Table:** Token #, Scheduled Time, Patient Name, MRN, Doctor, Status Badge, Payment Status, Action Buttons.
- **Action Buttons:** "Book Appointment", "Check-In", "Collect Payment", "Cancel".

### 7. Every Tab Explained
- *Today's Live Queue Tab:* Real-time active queue for current date.
- *Calendar Schedule Tab:* Weekly and monthly doctor appointment book.
- *Cancellations & Reschedules Tab:* Audit log of cancelled tickets.

### 8. Every Button Explained
1. **"Book Appointment" (`CalendarPlus`):** Opens booking modal (select patient, doctor, slot).
2. **"Collect Payment & Issue Token" (`DollarSign` / `CheckCircle`):** Opens payment dialog; issues token upon payment.
3. **"Check-In Patient" (`UserCheck`):** Marks patient physically present in waiting lobby.
4. **"Cancel Appointment" (`XCircle`):** Cancels visit with required cancellation reason.

### 9. Complete Workflow
1. Receptionist clicks "Book Appointment".
2. Selects Patient MRN, Department, Doctor, Time Slot.
3. System prompts mandatory consultation fee payment (₹500).
4. Receptionist selects Cash/UPI/Card and clicks "Collect & Issue Token".
5. System creates appointment, generates Token #A-014, and prints receipt.
6. Token appears on Lounge TV and Doctor's waiting list.

### 10. Data Entry Explanation
- *Doctor & Slot:* Validates doctor is on duty and slot is vacant.
- *Payment Mode:* Cash, Card, UPI, or Corporate Insurance.

### 11. Status Explanation
- `SCHEDULED`: Booked in advance, fee paid or pending.
- `CHECKED_IN`: Patient arrived in waiting lobby.
- `IN_CONSULTATION`: Patient currently inside doctor cabin.
- `COMPLETED`: Doctor finished visit and signed prescription.
- `CANCELLED`: Appointment cancelled and slot reopened.

### 12. Database Explanation
- Stored in PostgreSQL: `clinical_appointment` (fields: `id`, `patient_id`, `doctor_id`, `appointment_date`, `time_slot`, `token_number`, `status`, `consultation_fee`, `is_paid`).

### 13. Module Connections
- Feeds tokens to Lounge TV (`/lounge-tv`), patient records to Doctor Workspace, and money to Cashier Drawer.

### 14. Permissions
- Receptionists can book, collect payments, and check in.
- Doctors can view queue and call tokens. Doctors cannot book or collect money.

### 15. Error Handling
- Double-booking prevention: blocks selecting an already reserved time slot.

### 16. Practical Examples
- Walk-in patient arrives without appointment; receptionist books immediate next available slot.
- Patient arrives 20 minutes early; receptionist clicks "Check-In" to alert doctor.

### 17. Important Things to Remember
- A token is only generated after consultation payment is recorded!

---

## 3.5 Module 4: Digital Waiting Lounge TV Display (`/lounge-tv`)

### 1. Module Name & Route
- **Displayed Name:** Digital Waiting Lounge TV Queue Display
- **Frontend Route:** `/lounge-tv`

### 2. Simple Explanation
A big public display screen mounted on the wall in the hospital waiting lobby. It announces which patient token should walk into which doctor cabin, complete with pleasant audio chimes.

### 3. Real Hospital Example
Rahul sits on a comfortable sofa in Lounge A reading a magazine. Suddenly, the TV screen dings: **"Ding-Dong! Token #A-014, Rahul Verma, please proceed to Cabin 102 - Dr. Kumar."** Rahul stands up and walks directly to Cabin 102 without asking anyone for directions.

### 4. Who Uses It?
Watched by waiting patients and family members; controlled automatically by doctors inside their cabins.

### 5. Why Does This Module Exist?
Eliminates noisy nurses shouting patient names down hospital hallways, protects patient dignity, and reduces waiting anxiety.

### 6. Complete Screen Explanation
- **Left Panel (Now Calling):** Giant bold display of the token currently being called, patient name, doctor name, and Cabin Number in glowing cyan/emerald.
- **Right Panel (Up Next):** Next 5 tokens in queue so patients know when to get ready.
- **Audio Chime Engine:** Web Audio synthesizer playing two-tone announcement chime.
- **Top Ticker:** Live clock, hospital logo, and health tip ticker.

### 7. Every Tab Explained
- Fullscreen kiosk view; can be filtered to a specific department or set to show all hospital clinics.

### 8. Every Button Explained
- **Fullscreen Toggle (`Maximize`):** Enters browser fullscreen mode for wall TV screens.
- **Mute / Unmute Audio (`Volume2`):** Toggles audio chime announcements.
- **Department Filter:** Restricts display to Cardiology, Pediatrics, or General OPD.

### 9. Complete Workflow
1. Doctor in Cabin clicks "Call Patient" in Doctor Workspace.
2. Signal transmits instantly over WebSocket / LiveSync API.
3. Lounge TV flashes Token #, speaks/chimes announcement, and updates "Now Calling" box.

### 10. Data Entry Explanation
- Automated display screen; zero data entry required.

### 11. Status Explanation
- Shows tokens in `CHECKED_IN` (Up Next) and `IN_CONSULTATION` (Now Calling).

### 12. Database Explanation
- Reads live from `clinical_appointment`.

### 13. Module Connections
- Synchronized directly with Doctor Workspace (`/staff/doctor-workspace`).

### 14. Permissions
- Public display mode; does not expose private diagnoses or billing details.

### 15. Error Handling
- Auto-reconnects if Wi-Fi blinks, maintaining continuous queue display.

### 16. Practical Examples
- Wall-mounted TV in Cardiology waiting room announces Token #C-005 to Cabin 3.
- Pediatric lounge displays cartoon animations alongside token numbers.

### 17. Important Things to Remember
- Always keep the audio unmuted on the lobby computer so patients hear the chime!

---

## 3.6 Module 5: Doctor Clinical Workspace & EMR (`/staff/doctor-workspace`)

### 1. Module Name & Route
- **Displayed Name:** Doctor Clinical Workspace & EMR
- **Frontend Route:** `/staff/doctor-workspace`

### 2. Simple Explanation
The doctor's digital desk. Instead of writing on paper prescription pads with messy handwriting, the doctor types or speaks consultation notes, diagnoses illnesses using global medical codes (ICD-10), orders lab tests, and creates clean electronic prescriptions.

### 3. Real Hospital Example
Dr. Kumar examines Rahul. He types "Fever with chills", clicks `A09 - Gastroenteritis`, selects Paracetamol 650mg, and orders a blood test. When he clicks "Finalize", the pharmacy and lab receive the orders immediately.

### 4. Who Uses It?
Licensed Doctors, Medical Directors, Clinical Specialists.

### 5. Why Does This Module Exist?
Prevents dangerous handwriting misinterpretations by pharmacists, alerts doctors to patient drug allergies, and stores permanent, searchable medical histories.

### 6. Complete Screen Explanation
- **Left Sidebar:** Active Patient Queue (list of checked-in tokens waiting outside).
- **Center Main Panel:**
  - *Patient Banner:* Name, Age, MRN, Blood Group, Allergy Warning Badge.
  - *Vitals Bar:* BP, Pulse, Temp, SpO2, Weight, BMI.
  - *Chief Complaints & History:* Clinical notes editor.
  - *Diagnosis Search:* ICD-10 medical code search bar.
  - *Prescription Pad (e-Rx):* Drug search, dosage, frequency, duration, food instructions.
  - *Diagnostic Orders:* Lab tests and radiology scan checkboxes.
- **Bottom Action Bar:** "Call Patient", "Recommend Admission", "Finalize & Sign Consultation".

### 7. Every Tab Explained
- *Clinical Consultation Tab:* Active examination notes.
- *Past Medical History Tab:* All previous visits, prescriptions, and surgeries.
- *Diagnostic Reports Tab:* Verified lab reports and radiology images.
- *Inpatient Bed Care Tab:* For visiting admitted ward patients.

### 8. Every Button Explained
1. **"Call Patient" (`Volume2`):** Triggers audio chime on Lounge TV.
2. **"Add Drug" (`Plus`):** Adds a medication row to prescription.
3. **"Check Drug Interaction" (`ShieldAlert`):** Checks prescription against patient allergies.
4. **"Order Lab/Radiology" (`Activity`):** Sends electronic test orders to lab/imaging.
5. **"Finalize & Sign Consultation" (`CheckCircle`):** Locks consultation note and transmits orders.

### 9. Complete Workflow
1. Doctor clicks "Call Patient" for next token.
2. Patient enters cabin; doctor logs vitals and complaints.
3. Doctor selects ICD-10 diagnosis.
4. Adds medications and diagnostic tests.
5. Clicks "Finalize Consultation". Record is cryptographically signed and locked.

### 10. Data Entry Explanation
- *ICD-10 Code:* Standard international disease code (e.g. `J06.9 - Acute upper respiratory infection`).
- *Medication Fields:* Drug Name, Dosage (mg/ml), Route (Oral/IV), Frequency (OD/BD/TDS), Duration (Days), Instructions.

### 11. Status Explanation
- Transitions appointment from `IN_CONSULTATION` to `COMPLETED`.

### 12. Database Explanation
- Saves to: `clinical_consultation`, `clinical_prescription`, `clinical_prescriptionitem`, `clinical_laborder`.

### 13. Module Connections
- Pushes e-Rx to Pharmacy, orders to LIS/RIS, bills to Billing, and summary to Patient Portal.

### 14. Permissions
- Strictly restricted to DOCTOR, MEDICAL_DIRECTOR, and DEPARTMENT_HEAD.

### 15. Error Handling
- Prevents finalizing if diagnosis is blank.
- Blocks prescribing drugs containing patient's documented allergens.

### 16. Practical Examples
- Doctor prescribes antibiotic; system warns patient is allergic to Cephalosporins; doctor switches drug.
- Doctor orders stat Trop-I test for chest pain patient; lab receives order in 1 second.

### 17. Important Things to Remember
- Once finalized, a consultation note cannot be modified to preserve legal medical audit integrity!

---

## 3.7 Module 6: Doctors & Nursing Management (`/staff/doctors-nursing`)

### 1. Module Name & Route
- **Displayed Name:** 6. Doctors & Nursing Management
- **Frontend Route:** `/staff/doctors-nursing`

### 2. Simple Explanation
The clinical staff coordination hub. It tracks which doctors and nurses are on duty, manages shift rosters, handles shift swaps, and assigns nurses to specific ward rooms.

### 3. Real Hospital Example
Nurse Sunita is assigned to Ward 3 (General Medical Ward) for the Morning Shift (7:00 AM - 3:00 PM). The Head Nurse uses this screen to assign Sunita 6 specific inpatient beds to monitor.

### 4. Who Uses It?
Nursing Superintendents, Department Heads, Medical Directors, HR Managers, Admins.

### 5. Why Does This Module Exist?
Ensures every patient bed has an assigned nurse 24/7 and ensures emergency on-call doctors are always scheduled.

### 6. Complete Screen Explanation
- **Clinical Roster Calendar:** Grid showing doctors and nurses across Morning, Evening, and Night shifts.
- **On-Duty Live Board:** List of clinicians currently in the hospital.
- **Nurse-to-Bed Assignment Panel:** Matrix linking nurses to specific inpatient rooms.
- **Shift Swap Requests Table:** Pending peer-to-peer duty swap requests.

### 7. Every Tab Explained
- *Duty Rosters Tab:* Weekly shift schedules.
- *Ward Assignments Tab:* Nurse-bed allocation mapping.
- *Shift Swaps Tab:* Review and approval of duty trades.

### 8. Every Button Explained
1. **"Create Shift Roster" (`CalendarPlus`):** Schedules staff across 3 shifts.
2. **"Assign Beds to Nurse" (`UserCheck`):** Maps nurse to specific ward rooms.
3. **"Approve Shift Swap" (`Check`):** Authorizes one clinician covering for another.

### 9. Complete Workflow
1. Head Nurse opens roster calendar.
2. Selects Ward, Week, and Staff Members.
3. Assigns Morning (07:00-15:00), Evening (15:00-23:00), or Night (23:00-07:00) shifts.
4. Clicks "Publish Roster". Staff receive shift notifications.

### 10. Data Entry Explanation
- Shift Types: Morning, Evening, Night, On-Call, Weekly Off.

### 11. Status Explanation
- `Draft`: Roster under preparation.
- `Published`: Live official work schedule.
- `Swapped`: Shift transferred to colleague.

### 12. Database Explanation
- Tables: `staff_shiftroster`, `staff_shiftassignment`, `staff_shiftswap`.

### 13. Module Connections
- Feeds into HR Attendance, Biometric punch verification, and Nursing Station.

### 14. Permissions
- Nursing Superintendents and Department Heads have scheduling privileges.

### 15. Error Handling
- Prevents scheduling a nurse for double consecutive night shifts without mandatory 16-hour rest.

### 16. Practical Examples
- Dr. Sneha requests Dr. Rajiv to cover her Sunday on-call; HOD approves swap in 1 click.
- 5 new inpatients admitted; Head Nurse reassigns 2 extra beds to Senior Nurse Priya.

### 17. Important Things to Remember
- Always publish rosters at least 7 days in advance to maintain NABH nursing compliance!

---

## 3.8 Module 7: Emergency & Trauma Casualty Center (`/staff/emergency`)

### 1. Module Name & Route
- **Displayed Name:** 4. Emergency & Casualty
- **Frontend Route:** `/staff/emergency`

### 2. Simple Explanation
The emergency room (ER / Casualty). When ambulances arrive with sirens blaring, this module triages patients into Red (immediate life threat), Yellow (urgent), and Green (minor injuries) so the sickest patients get doctors first.

### 3. Real Hospital Example
A road accident victim arrives unconscious with bleeding. The triage nurse registers him as "Unknown Male #102", marks him **RED (Resuscitation)**, and assigns him to Trauma Bay 1. Three emergency doctors converge on him in 20 seconds.

### 4. Who Uses It?
Emergency Physicians, Trauma Nurses, Casualty Receptionists, Admins.

### 5. Why Does This Module Exist?
In emergency medicine, every second counts. Standard registration takes too long; the Emergency module allows 10-second rapid intake with immediate clinical alerts.

### 6. Complete Screen Explanation
- **Top Triage Counters:** Red Priority (Resuscitation), Yellow Priority (Urgent), Green Priority (Walking Wounded), Total ER Census.
- **Trauma Bay Visual Board:** Graphic layout of Emergency Bays (Beds E-01 to E-12) with color-coded severity.
- **Rapid Arrival Intake Form:** Quick-register patient with minimal fields (Name/Unknown, Age, Gender, Trauma Mechanism).
- **Emergency Order Chit:** Rapid 1-click orders for Trauma Blood Panel, Bedside Ultrasound (FAST), and IV Fluids.

### 7. Every Tab Explained
- *Active Trauma Bay Tab:* Current patients undergoing emergency resuscitation.
- *ER Observation Ward Tab:* Patients monitored for 4-24 hours before admission or discharge.
- *Medico-Legal Case (MLC) Tab:* Road accidents, assaults, and poisonings requiring police reporting.

### 8. Every Button Explained
1. **"Rapid ER Intake" (`AlertTriangle` / `Plus`):** Opens 10-second emergency registration modal.
2. **"Triage Priority Selector (Red/Yellow/Green)":** Sets clinical urgency color code.
3. **"Initiate Emergency Admission" (`Bed`):** Transfers ER patient directly into ICU or Surgery OT.
4. **"Mark Medico-Legal Case (MLC)" (`Shield`):** Flags record for official government police reporting.

### 9. Complete Workflow
1. Patient arrives via ambulance.
2. Nurse clicks "Rapid ER Intake" -> Selects Priority (Red/Yellow/Green).
3. Assigns patient to Trauma Bay E-01.
4. Doctors stabilize patient, record vitals, and order emergency scans.
5. If surgery required -> clicks "Transfer to OT" or "Admit to ICU".

### 10. Data Entry Explanation
- *Triage Level:* Red (Immediate), Yellow (Within 15 mins), Green (Within 60 mins).
- *Glasgow Coma Scale (GCS):* Eye, Verbal, Motor response score (3 to 15).
- *MLC Flag:* Yes/No with Police Station name and constable badge number.

### 11. Status Explanation
- `TRIAGED`: Priority assigned, awaiting doctor examination.
- `RESUSCITATION`: Actively undergoing life-saving interventions.
- `ADMITTED_IPD`: Transferred to hospital inpatient ward/ICU.
- `DISCHARGED_STABLE`: Treated and sent home safely.

### 12. Database Explanation
- Stored in: `clinical_emergencyvisit`, `clinical_triageassessment`, `clinical_medicolegalcase`.

### 13. Module Connections
- Feeds patients directly into Inpatient Admissions, OT Surgical Suite, and Blood Bank.

### 14. Permissions
- Emergency doctors and nurses have full emergency clinical authority.

### 15. Error Handling
- Red triage cases trigger immediate loud audio alerts across the emergency wing.

### 16. Practical Examples
- Cardiac arrest patient arrives; nurse clicks Red; resuscitation team starts CPR within 15 seconds.
- Sprained ankle patient marked Green; rests in observation until urgent cases are stabilized.

### 17. Important Things to Remember
- In life-threatening emergencies, medical care comes first; full demographic registration can be completed later!

---

## 3.9 Module 8: Inpatient Admissions & Bed Board Census (`/staff/admissions`)

### 1. Module Name & Route
- **Displayed Name:** 5. IPD & Admissions
- **Frontend Route:** `/staff/admissions`

### 2. Simple Explanation
The hospital hotel and ward manager. When a patient is too sick to go home and needs to stay overnight in a hospital bed, this module tracks bed availability, assigns ward rooms, manages bed transfers, charts daily nursing care, and coordinates patient discharge.

### 3. Real Hospital Example
Dr. Kumar recommends Rahul be admitted for severe dengue fever. Receptionist Priya checks the Bed Board, finds clean vacant Bed G-04 in General Ward, collects ₹5,000 advance deposit, and admits Rahul. The bed instantly turns from Green (Available) to Red (Occupied).

### 4. Who Uses It?
Admission Desk Executives, Ward Nurses, Doctors, Billing Executives, Housekeeping Staff.

### 5. Why Does This Module Exist?
Prevents admitting two patients into the same bed, tracks daily room rent accurately, coordinates nurse care sheets, and enforces strict discharge clearance.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Hospital Beds, Occupied Beds, Available Clean Beds, Beds Under Cleaning / Sanitization, Occupancy Rate %.
- **Interactive Visual Bed Board:** Graphic floor plan organized by Ward (General Ward, Semi-Private, Deluxe, ICU, Post-Op) with color-coded bed tiles:
  - 🟢 *Green:* Available / Ready for Admission.
  - 🔴 *Red:* Occupied by Inpatient.
  - 🟡 *Yellow:* Under Cleaning / Sanitization.
  - ⚪ *Grey:* Maintenance / Out of Service.
- **Active Inpatient Table:** Patient Name, MRN, Bed Number, Admitting Doctor, Admission Date, Running Bill Total, Discharge Status.

### 7. Every Tab Explained
- *Visual Bed Board Tab:* Graphic interactive floor map of all beds.
- *Active Inpatients Tab:* Searchable list of all currently admitted patients.
- *Bed Transfers Tab:* History of room changes during hospital stay.
- *Discharge Clearances Tab:* 4-Point checklist for patients going home.

### 8. Every Button Explained
1. **"Admit Patient" (`Bed` / `Plus`):** Opens admission modal (select patient, ward, bed, deposit).
2. **"Transfer Bed" (`ArrowRightLeft`):** Moves patient to a new bed (e.g. Ward to ICU).
3. **"Initiate Discharge" (`LogOut`):** Doctor starts discharge process.
4. **"Mark Bed Cleaned" (`Sparkles`):** Housekeeping confirms bed is sanitized and ready.

### 9. Complete Workflow
1. Patient arrives with doctor admission chit.
2. Receptionist clicks "Admit Patient", selects MRN, Ward, and vacant Bed (e.g. `G-04`).
3. Collects mandatory advance deposit (₹5,000) and prints admission docket.
4. Bed turns Red (Occupied). Ward nurse receives patient.
5. On discharge day: Doctor signs summary -> Nurse clears bed -> Pharmacy checks returns -> Billing settles invoice -> Bed turns Yellow (Cleaning) -> Housekeeping marks Green (Available).

### 10. Data Entry Explanation
- *Ward Category:* General Ward (₹1,500/day), Semi-Private (₹2,800/day), Private Deluxe (₹5,500/day), ICU (₹9,500/day).
- *Admitting Diagnosis:* Clinical reason for hospital stay.
- *Advance Deposit:* Cash/Card/UPI payment credited toward final bill.

### 11. Status Explanation
- `AVAILABLE`: Sanitized, vacant, ready for admission.
- `OCCUPIED`: Patient currently admitted in bed.
- `CLEANING`: Patient discharged; housekeeping sanitizing linens and mattress.
- `MAINTENANCE`: Bed broken or undergoing medical gas repair.

### 12. Database Explanation
- Stored in: `clinical_bed`, `clinical_ward`, `clinical_inpatientadmission`, `clinical_bedtransfer`.

### 13. Module Connections
- Feeds room tariffs into Billing daily at midnight, inpatient list into Nursing Station, and vacancies into Dashboard.

### 14. Permissions
- Receptionists and Nurses can admit and transfer.
- Housekeeping can mark beds Cleaned.
- Doctors initiate discharge.

### 15. Error Handling
- System blocks admitting a patient into an Occupied or Unsanitized bed.

### 16. Practical Examples
- Inpatient in General Ward develops breathing distress; nurse clicks "Transfer Bed" and moves patient to ICU Bed I-02 in 30 seconds.
- Patient discharged at 11:00 AM; housekeeping disinfects room and clicks "Mark Bed Cleaned" at 11:35 AM.

### 17. Important Things to Remember
- A bed cannot be assigned to a new patient until Housekeeping marks it Cleaned!
"""

