# -*- coding: utf-8 -*-
"""Part 3: Deep-Dive Module-by-Module Guide (Clinical, Diagnostics & Logistics Modules)"""

def get_part3_clinical():
    return """# PART 3: Deep-Dive Module-by-Module Guide (Part 2: Clinical, Diagnostics & Logistics)

---

## 3.10 Module 9: AI Voice Translation Engine (`/staff/voice-translation`)

### 1. Module Name & Route
- **Displayed Name:** AI Voice Translation & Clinical Dictation
- **Frontend Route:** `/staff/voice-translation`

### 2. Simple Explanation
The hospital's real-time digital interpreter and voice typist. When a doctor speaks in English, Hindi, or Telugu, the system converts speech to text, translates it into the patient's native tongue, and plays spoken audio so doctor and patient can understand each other perfectly.

### 3. Real Hospital Example
A patient from rural Andhra Pradesh who speaks only Telugu visits an English-speaking specialist in New Delhi. The doctor presses the microphone and speaks in English: "Take this tablet after dinner for 5 days." The system immediately translates and speaks aloud in fluent Telugu to the patient.

### 4. Who Uses It?
Doctors, Nurses, Receptionists, and International / Regional Patients.

### 5. Why Does This Module Exist?
India has 22 official languages and hundreds of dialects. Language barriers cause medication errors, poor patient compliance, and diagnostic delays.

### 6. Complete Screen Explanation
- **Left Panel (Doctor / Staff Input):** Source language selector, microphone button with pulsing audio visualizer, live transcript box.
- **Right Panel (Patient Output):** Target language selector, translated text box, audio playback button, and copy button.
- **Clinical Terminology Guard:** Special medical dictionary ensuring drug names (like Paracetamol, Metformin) are never mistranslated into common words.

### 7. Every Tab Explained
- *Real-Time Conversation Tab:* Two-way live voice translation for doctor consultations.
- *Clinical Dictation Tab:* Hands-free voice typing for doctors recording long clinical discharge summaries.

### 8. Every Button Explained
1. **"Start Recording" (`Mic`):** Activates browser microphone via Web Speech Recognition API.
2. **"Stop & Translate" (`Square`):** Stops audio capture and triggers AI translation.
3. **"Play Audio" (`Volume2`):** Synthesizes translated speech aloud via Web Speech Synthesis.
4. **"Copy to Clipboard" (`Copy`):** Copies translated text for pasting into doctor notes.

### 9. Complete Workflow
1. Doctor selects Source: English, Target: Telugu.
2. Doctor clicks microphone and speaks clinical instructions.
3. Speech-to-text generates English transcript.
4. Translation engine converts text to Telugu.
5. Speaker plays Telugu audio for the patient.

### 10. Data Entry Explanation
- Voice audio input via microphone; can also type text manually into source box.

### 11. Status Explanation
- `LISTENING`: Microphone actively recording.
- `TRANSLATING`: Processing neural translation.
- `READY`: Translation complete and ready for playback.

### 12. Database Explanation
- Translates client-side and via backend service: `voice_translation_service.py`.

### 13. Module Connections
- Embeddable into Doctor Clinical Workspace (`/staff/doctor-workspace`) for hands-free prescription writing.

### 14. Permissions
- Accessible to all clinical and front-desk staff.

### 15. Error Handling
- If microphone permission is denied, displays clear prompt to allow browser microphone access.

### 16. Practical Examples
- Receptionist speaks in Hindi to explain token directions to a Gujarati grandmother.
- Surgeon dictates operative findings directly into EMR without touching keyboard with sterile gloves.

### 17. Important Things to Remember
- Speak clearly into the microphone at a natural pace for 99% transcription accuracy!

---

## 3.11 Module 10: Pathology & Diagnostic Laboratory LIS (`/staff/laboratory`)

### 1. Module Name & Route
- **Displayed Name:** 7. Laboratory & Diagnostics (LIS)
- **Frontend Route:** `/staff/laboratory`

### 2. Simple Explanation
The diagnostic blood and pathology lab. When a doctor orders blood, urine, or biopsy tests, this module prints barcode stickers for the test tubes, records results from lab analyzers, flags dangerous results ("Panic Values"), and gets pathologist approval before reports go to patients.

### 3. Real Hospital Example
Dr. Kumar orders a Complete Blood Count (CBC) for Rahul. The phlebotomist draws 3ml of blood, prints barcode `LAB-0042`, runs the tube through the blood analyzer, and types the results. The Pathologist digitally signs the report, and it appears on Dr. Kumar's screen within 45 minutes.

### 4. Who Uses It?
Phlebotomists, Medical Lab Technicians, Pathologists, Biochemists, Microbiologists.

### 5. Why Does This Module Exist?
Prevents sample mix-ups (putting Patient A's blood into Patient B's report), flags life-threatening panic values automatically, and satisfies NABL laboratory quality standards.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Requisitions Received Today, Samples Collected, Tests In-Progress, Panic Values Pending Action, Verified Reports Ready.
- **Specimen Worklist Table:** Order ID, Barcode #, Patient Name, Test Requested, Tube Type, Collection Status, Technician, Actions.
- **Result Entry Grid:** Analyte Name, Measured Value, Unit (mg/dL, g/dL), Biological Reference Range, High/Low Flag (▲/▼).
- **Pathologist Verification Drawer:** Side-by-side view of past results, analyzer calibration, and 1-click digital sign-off.

### 7. Every Tab Explained
- *Orders & Accessioning Tab:* Intake of doctor requisitions and sample collection.
- *Test Worklist Tab:* Entering numerical and qualitative test values.
- *Panic Alerts Tab:* Red-flagged life-threatening results requiring urgent doctor notification.
- *Verified Archives Tab:* Historical signed reports.

### 8. Every Button Explained
1. **"Accession Sample & Print Barcode" (`Barcode`):** Confirms tube receipt and prints barcode sticker.
2. **"Enter Test Results" (`Edit3`):** Opens analyte entry grid.
3. **"Flag Critical Panic Value" (`AlertOctagon`):** Triggers urgent red alert on doctor and nurse screens.
4. **"Verify & Release Report" (`CheckCircle`):** Pathologist digitally authorizes and publishes report.

### 9. Complete Workflow
1. Doctor orders test in EMR -> Appears in Lab Accessioning queue.
2. Lab tech draws blood -> Clicks "Accession" -> Sticks barcode on tube.
3. Tech runs analyzer -> Enters measured values.
4. Pathologist reviews values against reference intervals.
5. Pathologist clicks "Verify & Release Report" -> Instantly viewable in Doctor EMR and Patient Portal.

### 10. Data Entry Explanation
- *Numerical Analytes:* Hemoglobin (12-16 g/dL), Fasting Sugar (70-100 mg/dL), Creatinine (0.7-1.3 mg/dL).
- *Qualitative Analytes:* Widal Test (Positive/Negative), Urine Pus Cells (0-2 /HPF).

### 11. Status Explanation
- `ORDERED`: Requisition sent by doctor.
- `SAMPLE_COLLECTED`: Specimen drawn and barcode attached.
- `IN_PROCESSING`: Under analyzer testing.
- `VERIFIED`: Pathologist signed, available to patient.

### 12. Database Explanation
- Stored in: `clinical_laborder`, `clinical_specimenaccession`, `clinical_diagnosticreport`, `clinical_labanalyteresult`.

### 13. Module Connections
- Feeds test results to Doctor EMR, billing charges to Invoicing, and reports to Patient Portal.

### 14. Permissions
- Technicians can enter values.
- Only PATHOLOGIST and MEDICAL_DIRECTOR can verify and release reports.

### 15. Error Handling
- System blocks entering impossible values (e.g. Hemoglobin 45 g/dL flags input validation error).

### 16. Practical Examples
- Platelet count of 15,000/µL triggers automated panic alert to ICU resident.
- Normal lipid profile signed off in 10 seconds and published to patient portal.

### 17. Important Things to Remember
- Always match the barcode sticker on the tube with the patient wristband before drawing blood!

---

## 3.12 Module 11: Radiology & Medical Imaging RIS (`/staff/radiology`)

### 1. Module Name & Route
- **Displayed Name:** 8. Radiology & Imaging (RIS)
- **Frontend Route:** `/staff/radiology`

### 2. Simple Explanation
The medical imaging and X-ray department. When a patient needs an X-Ray, CT Scan, MRI, or Ultrasound, this module manages the scan schedule, tracks radiation safety, attaches digital scan images (DICOM), and enables radiologists to write diagnostic reports.

### 3. Real Hospital Example
A patient with a suspected wrist fracture arrives from OPD. The radiographer positions the wrist, takes a digital X-Ray, links the image from the PACS machine, and sends it to the Radiologist. The Radiologist types: "Hairline fracture of distal radius" and signs the report.

### 4. Who Uses It?
Radiographers, Radiology Technicians, Consultant Radiologists (MD), Emergency Doctors.

### 5. Why Does This Module Exist?
Eliminates physical plastic X-Ray film loss, links high-resolution medical imaging directly to patient files, and tracks radiation exposure for patient safety.

### 6. Complete Screen Explanation
- **Modality Worklist:** Scheduled exams categorized by modality: X-Ray, CT, MRI, Ultrasound, Mammography.
- **Radiation Safety Panel:** Dose-Area Product (DAP) and pregnancy screening checklist.
- **PACS Viewer Link:** Deep-link opening full-resolution DICOM slices in web viewer.
- **Structured Impression Editor:** Radiologist report editor with anatomical templates.

### 7. Every Tab Explained
- *Modality Worklist Tab:* Daily scheduled imaging exams.
- *Unreported Studies Tab:* Scans completed by technician awaiting radiologist reporting.
- *Completed Imaging Archives Tab:* Searchable library of all historical scans.

### 8. Every Button Explained
1. **"Start Examination" (`Play`):** Marks exam in progress and logs technician name.
2. **"Attach DICOM / PACS Link" (`Link`):** Connects digital imaging series to order.
3. **"Sign Radiology Report" (`FileCheck`):** Radiologist signs clinical impression.

### 9. Complete Workflow
1. Doctor orders X-Ray -> Appears on Radiology Worklist.
2. Radiographer performs scan -> Uploads DICOM study link.
3. Radiologist inspects images -> Types findings and clinical impression.
4. Clicks "Sign Radiology Report" -> Image and report available in Doctor Workspace.

### 10. Data Entry Explanation
- *Modality:* X-Ray, CT Scan, MRI, Ultrasound.
- *Radiation Dose:* Measured in milligrays (mGy) for safety audits.
- *Impression:* Formal radiologist medical conclusion.

### 11. Status Explanation
- `SCHEDULED`: Exam booked.
- `EXAM_COMPLETED`: Scan captured by technician.
- `REPORTED`: Radiologist signed impression report.

### 12. Database Explanation
- Tables: `clinical_radiologyorder`, `clinical_dicomstudymetadata`, `clinical_radiologyreport`.

### 13. Module Connections
- Embeds scan links into Doctor EMR, Emergency Bay, and charges into Patient Billing.

### 14. Permissions
- Technicians operate machines and upload scans.
- Only RADIOLOGIST can sign final diagnostic reports.

### 15. Error Handling
- Mandatory pregnancy screening confirmation required before activating female pelvis CT/X-ray orders.

### 16. Practical Examples
- Emergency brain CT for stroke patient reported in 12 minutes.
- Orthopedic surgeon views 3D knee MRI slices inside operating theatre during surgery.

### 17. Important Things to Remember
- Always verify patient identity and remove metal objects before MRI scans!

---

## 3.13 Module 12: Pharmacy Formulary & FEFO Dispensing (`/staff/pharmacy`)

### 1. Module Name & Route
- **Displayed Name:** 9. Pharmacy Formulary & Dispensing
- **Frontend Route:** `/staff/pharmacy`

### 2. Simple Explanation
The hospital pharmacy store. When doctors prescribe medicines, the prescription appears here instantly. The pharmacist dispenses the exact tablets or syrups, using the **FEFO rule (First-Expiring, First-Out)** so medicines closest to their expiry date are given first, cutting drug wastage to zero.

### 3. Real Hospital Example
Rahul walks to the pharmacy counter with his prescription slip. Pharmacist Meena scans his token: the doctor's prescription pops up on her screen. The system tells Meena: "Pick Paracetamol from Shelf B, Batch AZ-101 (Expires in 2 months)." Meena hands the tablets to Rahul and explains: "Take 1 tablet after food."

### 4. Who Uses It?
Licensed Pharmacists, Pharmacy Assistants, Materials Managers.

### 5. Why Does This Module Exist?
Prevents dangerous handwriting interpretation errors, blocks dispensing expired drugs, enforces allergy safety checks, and manages medicine stock levels accurately.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Prescriptions Awaiting Dispensing, Near-Expiry Batches (<60 Days), Out-of-Stock SKUs, Today's Dispensed Prescriptions.
- **Prescription Queue Table:** Token #, Patient Name, Prescribing Doctor, Items Count, Priority, Dispense Status.
- **Dispensing Workbench:** Scanned medicine barcode input, Batch lot selector with FEFO recommendation, Quantity, Dosage instructions, Price.
- **Drug Formulary Search:** Master catalog of all approved hospital medications with generic names and ATC classifications.

### 7. Every Tab Explained
- *Dispensing Queue Tab:* Active doctor prescriptions waiting to be fulfilled.
- *Formulary & Stock Tab:* On-hand inventory, batch expiries, unit rates.
- *Near-Expiry Alert Tab:* Batches expiring within 30, 60, or 90 days.
- *Narcotics & Controlled Drugs Tab:* Double-locked Schedule X/H drug register.

### 8. Every Button Explained
1. **"Dispense Prescription" (`PackageCheck`):** Scans barcodes, allocates FEFO batches, decrements stock, and charges bill.
2. **"Restock Return" (`RotateCcw`):** Restocks unopened returned medicines on patient discharge and credits bill.
3. **"Quarantine Batch" (`ShieldAlert`):** Locks expired or damaged boxes from being sold.

### 9. Complete Workflow
1. Doctor finalizes e-Rx -> Appears in Pharmacy Dispensing Queue.
2. Pharmacist clicks prescription -> Reviews items and dosage.
3. System suggests nearest-expiry batch (FEFO).
4. Pharmacist scans barcode -> Confirms on-hand quantity.
5. Clicks "Dispense" -> Stock decrements; charges send to billing; patient receives medicine.

### 10. Data Entry Explanation
- *Batch Number:* Manufacturer batch code (e.g. `BATCH-2024-X42`).
- *Expiry Date:* Month and year printed on blister pack.
- *Storage Condition:* Room temperature, Refrigerated (2-8°C), Frozen.

### 11. Status Explanation
- `PENDING`: Prescription received, awaiting dispensing.
- `PARTIALLY_DISPENSED`: Some items dispensed, others out of stock.
- `DISPENSED`: All medications issued to patient.
- `CANCELLED`: Prescription cancelled by doctor.

### 12. Database Explanation
- Stored in: `pharmacy_medication`, `pharmacy_stockbatch`, `pharmacy_prescriptiondispense`, `pharmacy_stockmovement`.

### 13. Module Connections
- Receives orders from Doctor Workspace, deducts stock from Warehouse, and adds charges to Invoicing.

### 14. Permissions
- Strictly restricted to PHARMACIST and HOSPITAL_ADMIN.

### 15. Error Handling
- System hard-blocks dispensing any batch whose expiry date is today or in the past.

### 16. Practical Examples
- Pharmacist dispenses pediatric antibiotic suspension with calibrated measuring dropper.
- Pharmacist quarantines 20 boxes of cough syrup recalled by government regulator.

### 17. Important Things to Remember
- Always inspect the tamper seal on medicine bottles before handing them to patients!

---

## 3.14 Module 13: Central Inventory & Warehouse Management (`/staff/inventory`)

### 1. Module Name & Route
- **Displayed Name:** 10. Inventory & Procurement
- **Frontend Route:** `/staff/inventory`

### 2. Simple Explanation
The hospital's central storage warehouse and purchasing department. It stores thousands of medical supplies (syringes, gloves, IV tubes, surgical masks), tracks minimum stock levels, orders supplies from approved vendors, and inspects delivery trucks at the loading dock.

### 3. Real Hospital Example
The Operation Theatre runs low on sterile surgical gloves. The OT Nurse submits a request for 100 boxes. The Warehouse Manager approves the request, transfers 100 boxes from the Central Warehouse to the OT, and generates an automatic Purchase Order to vendor "MediSupply Ltd" to replenish the warehouse.

### 4. Who Uses It?
Inventory Managers, Procurement Officers, Department Heads, Hospital Admins.

### 5. Why Does This Module Exist?
Prevents hospital surgeries from being cancelled due to missing supplies, stops theft and pilferage, and negotiates bulk discounts with suppliers.

### 6. Complete Screen Explanation
- **Top Summary Counters:** Total Inventory Asset Valuation, Items Below Reorder Point, Open Purchase Orders, Pending Goods Receipt Notes (GRNs).
- **Warehouse Stock Table:** Item SKU, Description, Category, Bin Location, On-Hand Qty, Minimum Safety Stock, Unit Cost.
- **Purchase Requisitions Panel:** Department supply requests awaiting review.
- **Purchase Order (PO) Generator:** Vendor selection, line item pricing, payment terms, delivery deadlines.

### 7. Every Tab Explained
- *Central Warehouse Tab:* On-hand inventory balances and bin locations.
- *Store Transfers Tab:* Moving stock from warehouse to departments (ICU, OT, ER).
- *Purchase Orders Tab:* Supplier orders and delivery tracking.
- *Goods Received (GRN) Tab:* Inspecting delivered goods at loading dock.

### 8. Every Button Explained
1. **"Create Purchase Order" (`FilePlus`):** Drafts official PO for approved vendor.
2. **"Log Goods Received Note (GRN)" (`Truck`):** Inspects delivery and increments stock.
3. **"Issue Department Transfer" (`ArrowRightCircle`):** Transfers stock to wards.
4. **"Write-Off Damaged Stock" (`Trash2`):** Logs broken ampoules with supervisor reason.

### 9. Complete Workflow
1. Stock drops below reorder point -> System generates Reorder Alert.
2. Procurement Officer creates Purchase Order (PO) to vendor.
3. Hospital Admin authorizes PO.
4. Vendor delivers goods -> Warehouse logs GRN and batch numbers.
5. Accounts Payable matches PO, GRN, and Vendor Invoice, and issues payment.

### 10. Data Entry Explanation
- *Reorder Level:* Minimum threshold (e.g. 50 boxes) that triggers new order.
- *Lead Time:* Number of days vendor takes to deliver (e.g. 3 days).
- *Bin Location:* Exact warehouse shelf (e.g. `Aisle 3, Rack B, Bin 12`).

### 11. Status Explanation
- `PO_DRAFT`: Order under preparation.
- `PO_APPROVED`: Authorized by admin, sent to vendor.
- `GOODS_RECEIVED`: Delivered and inspected at dock.
- `INVOICE_SETTLED`: Paid by finance department.

### 12. Database Explanation
- Stored in: `inventory_item`, `inventory_warehouse`, `inventory_purchaseorder`, `inventory_goodsreceivednote`, `inventory_stocktransfer`.

### 13. Module Connections
- Supplies stock to Pharmacy, OT, ICU, and Wards; pushes vendor payable invoices to Accounts.

### 14. Permissions
- Procurement Officers draft POs; Admins approve POs (Separation of Duties).

### 15. Error Handling
- System blocks receiving goods that do not match the approved PO quantity without approval.

### 16. Practical Examples
- Dengue outbreak: Warehouse orders 2,000 IV infusion sets on emergency next-day delivery.
- Receiving dock discovers 5 broken bottles; logs damaged goods rejection on GRN.

### 17. Important Things to Remember
- Always inspect packaging integrity before signing the delivery challan at the loading dock!

---

## 3.15 Module 14: Operation Theatre & ICU Surgical Suite (`/staff/surgery-icu`)

### 1. Module Name & Route
- **Displayed Name:** 11. OT & ICU Surgical Suite
- **Frontend Route:** `/staff/surgery-icu`

### 2. Simple Explanation
The surgical operating rooms and intensive care units. It schedules surgeries, assigns surgical teams (Lead Surgeon, Anesthetist, Scrub Nurse), conducts WHO surgical safety checklists, and monitors critically ill patients on ventilators in the ICU.

### 3. Real Hospital Example
A patient is scheduled for laparoscopic hernia repair at 9:00 AM in OT-2. The surgical team conducts the "Time-Out" safety check: verifies patient identity, surgical site, and antibiotic administration. The surgery is completed successfully, and the patient is transferred to the Recovery Bay.

### 4. Who Uses It?
Surgeons, Anesthesiologists, OT Scrub Nurses, ICU Intensivists, Critical Care Nurses.

### 5. Why Does This Module Exist?
Surgeries involve high risk. This module enforces the **WHO Surgical Safety Checklist** (Sign-In, Time-Out, Sign-Out) to prevent wrong-site or wrong-patient surgical catastrophes.

### 6. Complete Screen Explanation
- **OT Schedule Grid:** Visual timeline of Operating Theatres (OT-1 to OT-6) with surgery start/end times and cleaning buffers.
- **Surgical Team Panel:** Lead Surgeon, Assisting Surgeon, Anesthetist, Scrub Nurse, Circulating Nurse.
- **WHO Surgical Safety Checklist Modal:** Sign-In (before anesthesia), Time-Out (before incision), Sign-Out (before leaving OT).
- **ICU Ventilator Telemetry Panel:** Real-time SpO2, invasive BP, ventilator mode, FiO2, and Glasgow Coma Scale (GCS).

### 7. Every Tab Explained
- *OT Surgery Booking Tab:* Scheduling upcoming operations and assigning staff.
- *Intra-Operative & Anesthesia Tab:* Vitals charting during active surgery.
- *ICU Critical Care Census Tab:* High-dependency and intensive care bed monitoring.
- *Post-Anesthesia Recovery (PACU) Tab:* Post-op recovery monitoring before ward transfer.

### 8. Every Button Explained
1. **"Book Surgery Slot" (`Calendar`):** Reserves OT room, timeslot, and surgical team.
2. **"Complete WHO Checklist" (`CheckSquare`):** Mandatory pre-op safety verification.
3. **"Log Anesthesia Record" (`Heart`):** Charts blood pressure and gas levels every 5 minutes.
4. **"Transfer to PACU / ICU" (`ArrowRight`):** Moves post-op patient to recovery care.

### 9. Complete Workflow
1. Surgeon books operation -> OT room and team reserved.
2. Patient arrives in pre-op -> Nurse completes "Sign-In" check.
3. Inside OT: Team conducts "Time-Out" (verifies site, consent, allergies).
4. Surgery performed -> Nurse logs swab and instrument count ("Sign-Out").
5. Patient transferred to Recovery Bay or ICU.

### 10. Data Entry Explanation
- *Surgical Procedure:* Formal medical name (e.g. `Laparoscopic Cholecystectomy`).
- *Anesthesia Type:* General Anesthesia (GA), Spinal, Epidural, Local.
- *Swab/Instrument Count:* Mandatory count confirmation before wound closure.

### 11. Status Explanation
- `PRE_OP`: Patient being prepped for surgery.
- `INTRA_OP`: Surgery actively underway.
- `RECOVERY`: Patient waking up in PACU.
- `COMPLETED`: Patient transferred to ward or ICU.

### 12. Database Explanation
- Stored in: `clinical_surgerybooking`, `clinical_surgicalsafetychecklist`, `clinical_anesthesiarecord`, `clinical_icutelemetry`.

### 13. Module Connections
- Pulls patients from Admissions; consumes supplies from Warehouse; charges surgery bills to Invoicing.

### 14. Permissions
- Restricted to SURGEON, ANESTHETIST, and OT_NURSE.

### 15. Error Handling
- System strictly blocks closing intra-op record if swab or sponge count is mismatched!

### 16. Practical Examples
- Emergency Cesarean section scheduled in OT-1 within 10 minutes.
- ICU intensivist adjusts ventilator FiO2 from 60% to 40% as patient lungs improve.

### 17. Important Things to Remember
- Never make a surgical skin incision until the team has paused and completed the WHO Time-Out check!
"""

