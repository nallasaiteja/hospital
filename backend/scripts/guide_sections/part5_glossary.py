# -*- coding: utf-8 -*-
"""Part 5: Beginner-Friendly Hospital & Technical Glossary (40+ Terms)"""

def get_part5():
    return """# PART 5: Beginner-Friendly Hospital & Technical Glossary

Hospital terminology and software acronyms can be confusing for a beginner. Below is a comprehensive glossary explaining every important clinical, financial, and technical term in simple English with real-world comparisons.

---

### 1. OPD (Outpatient Department)
- **What it means:** The department for patients who walk into the hospital for a check-up, see a doctor, get medicines, and go home the same day without sleeping overnight in a bed.
- **Real-World Example:** Rahul visits the hospital at 10:00 AM because he has a cough, sees Dr. Kumar, buys cough syrup at the pharmacy, and returns home at 11:30 AM.

### 2. IPD (Inpatient Department)
- **What it means:** The department for patients who are too ill to go home and must stay overnight in a hospital bed for medical treatment, surgery, or nursing care.
- **Real-World Example:** Sunita is admitted to the hospital with acute appendicitis, stays in Bed G-04 for 3 nights, undergoes surgery, and is discharged on Thursday.

### 3. EMR (Electronic Medical Records)
- **What it means:** The digital replacement for the patient's paper medical folder. It stores vital signs, doctor examination notes, diagnoses, prescriptions, and lab results on a secure computer.
- **Real-World Example:** Instead of digging through dusty file folders in a basement, Dr. Kumar types Rahul's MRN and sees his complete medical history in 2 seconds.

### 4. EHR (Electronic Health Record)
- **What it means:** A comprehensive digital health record that travels with the patient across different hospitals, clinics, and diagnostic labs throughout their lifetime.

### 5. MRN (Medical Record Number)
- **What it means:** A permanent, unique digital serial number assigned to a patient upon their very first registration at the hospital. It never changes.
- **Real-World Example:** Rahul's MRN is `MRN-2026-00142`. Even if he returns to the hospital 10 years later, all his medical records remain linked to this exact number.

### 6. UHID (Universal Health Identification)
- **What it means:** A national government health identifier (such as India's Ayushman Bharat Health Account - ABHA ID) linking patient records across the entire healthcare ecosystem.

### 7. Triage
- **What it means:** The rapid clinical sorting process performed in the Emergency Room to decide which patients need immediate life-saving care and which can wait safely.
- **Real-World Example:** A nurse checks two arrivals: a heart attack patient is labeled **RED** (immediate doctor attention), while a patient with a small finger cut is labeled **GREEN** (can wait safely).

### 8. Acuity
- **What it means:** The measurement of how critically sick a patient is and how much nursing and medical attention they require. High-acuity patients are kept in the ICU; low-acuity patients stay in general wards.

### 9. Casualty / Emergency Department (ED / ER)
- **What it means:** The 24/7 hospital wing dedicated to treating sudden, life-threatening illnesses, heart attacks, road accidents, and acute trauma.

### 10. ICU (Intensive Care Unit)
- **What it means:** A high-technology hospital ward with ventilators, heart monitors, and 1-to-1 nurse staffing dedicated to treating patients whose vital organs are failing.

### 11. Ward
- **What it means:** A specialized floor or room in the hospital housing inpatient beds grouped by medical specialty (e.g. Male Medical Ward, Pediatric Ward, Maternity Ward).

### 12. Bed Occupancy Rate
- **What it means:** The percentage of hospital beds currently occupied by admitted patients compared to total beds.
- **Calculation:** `(Occupied Beds ÷ Total Available Beds) × 100`. If 84 out of 100 beds are full, Bed Occupancy is **84%**.

### 13. Token & Queue Management
- **What it means:** A sequential numbered ticket (e.g. `#A-014`) issued to patients so they can sit comfortably in the waiting lounge while waiting for their turn without standing in lines.

### 14. Consultation
- **What it means:** The formal meeting inside a doctor's private cabin where the physician listens to the patient's complaints, performs an examination, and decides on a treatment plan.

### 15. Diagnosis & ICD-10 Coding
- **What it means:** The formal medical identification of an illness using the International Classification of Diseases (ICD-10) standard established by the World Health Organization.
- **Real-World Example:** Instead of typing "lung infection", the doctor selects `J18.9 - Pneumonia, unspecified organism` so any doctor or insurance company worldwide understands the exact diagnosis.

### 16. Prescription (e-Rx)
- **What it means:** An official, digitally signed order written by a licensed doctor instructing the pharmacist which medicines to dispense to the patient.

### 17. Dosage, Frequency, Route, Duration
- **Dosage:** The amount of medicine to take (e.g. `500 mg` or `10 ml`).
- **Frequency:** How often to take it (`OD` = Once daily, `BD` = Twice daily, `TDS` = Thrice daily).
- **Route:** How the drug enters the body (`Oral` = swallowed, `IV` = injected into vein).
- **Duration:** How many days to take it (e.g. `5 Days`).

### 18. Specimen Accessioning
- **What it means:** The laboratory check-in process where a phlebotomist verifies a blood or urine sample tube, logs it into the computer, and sticks a scannable barcode label on it.

### 19. CBC (Complete Blood Count)
- **What it means:** The most common diagnostic blood test that measures Hemoglobin (red blood cells for oxygen), White Blood Cells (WBC for fighting infection), and Platelets (for blood clotting).

### 20. Pathology & LIS (Laboratory Information System)
- **What it means:** Pathology is the study of disease through laboratory testing. An LIS is the specialized software module managing test orders, barcode tracking, and report verification.

### 21. Radiology & RIS (Radiology Information System)
- **What it means:** Radiology is the medical specialty using medical imaging (X-rays, CT scans, MRI, Ultrasound) to see inside the body. An RIS is the software module scheduling and tracking imaging exams.

### 22. PACS & DICOM
- **DICOM:** The universal international file format for digital medical images (like JPEG, but containing patient medical metadata).
- **PACS (Picture Archiving and Communication System):** The high-speed hospital server that stores gigabytes of DICOM scan images so doctors can view them on computers.

### 23. TPA (Third-Party Administrator)
- **What it means:** An independent company licensed by the insurance regulator to process health insurance claims and cashless hospitalizations on behalf of insurance companies.
- **Real-World Examples in India:** Medi Assist, Vidal Health, Star Health, Paramount TPA.

### 24. Pre-Authorization
- **What it means:** The formal process where the hospital sends the patient's diagnosis and estimated cost to the insurance company *before* treatment starts to get advance approval for cashless hospitalization.

### 25. Cashless Hospitalization & Insurance Claim
- **What it means:** A hospital stay where the insurance company pays the hospital directly for approved medical bills, so the patient does not need to pay large cash upfront.

### 26. Co-Payment & Deductible
- **Co-Payment:** The small percentage of the hospital bill (e.g. 10% or non-medical items like gloves and thermometer) that the patient's insurance policy requires the patient to pay from their own pocket.
- **Deductible:** The fixed amount a patient must pay before insurance starts covering expenses.

### 27. Running Bill / Interim Bill
- **What it means:** An itemized statement showing all hospitalization charges accrued so far (room rent, medicines, tests) while the patient is still admitted in a hospital bed.

### 28. Chart of Accounts
- **What it means:** The structured filing directory of all hospital financial categories, divided into Assets, Liabilities, Equity, Revenue, and Expenses.

### 29. General Ledger (GL) & Double-Entry Bookkeeping
- **What it means:** The master accounting book where every transaction writes equal Debits and Credits (`Total Debits == Total Credits`), ensuring financial books always balance.

### 30. Accounts Receivable (AR) & Accounts Payable (AP)
- **Accounts Receivable (AR):** Money owed *to* the hospital by insurance companies and corporate clients for treatments already provided.
- **Accounts Payable (AP):** Money the hospital owes *to* medicine suppliers, equipment vendors, and utility companies for supplies received on credit.

### 31. Bank Reconciliation Statement (BRS)
- **What it means:** The monthly accounting audit comparing the hospital's internal computer cashbook against the official bank account statement to prove the difference is exactly zero.

### 32. Segregation of Duties (SoD)
- **What it means:** A core anti-fraud security rule ensuring no single person can start and finish a high-value financial transaction alone.
- **Real-World Example:** An accountant can *draft* a ₹1,00,000 vendor check, but only the Finance Manager can *sign and authorize* it.

### 33. FEFO (First-Expiring, First-Out)
- **What it means:** The inventory rule where medicine batches that expire earliest are systematically dispensed to patients first, preventing expired medicine waste.

### 34. Stock Reorder Level
- **What it means:** The minimum inventory threshold (e.g. 50 boxes of Paracetamol) that triggers an automatic warning to buy more supplies before the hospital runs out.

### 35. Straight-Line Depreciation
- **What it means:** Writing down the accounting value of a machine equally over its useful lifespan.
- **Real-World Example:** An X-ray machine bought for ₹10 Lakhs with a 10-year lifespan depreciates by ₹1 Lakh every year.

### 36. Asset Register & AMC
- **Asset Register:** The master digital list of every machine, vehicle, and computer the hospital owns.
- **AMC (Annual Maintenance Contract):** A formal contract with the manufacturer (like GE or Siemens) to service and repair medical equipment regularly.

### 37. Preventive Maintenance vs. Breakdown Maintenance
- **Preventive Maintenance:** Routine scheduled servicing (like changing engine oil) to stop machines from breaking down.
- **Breakdown Maintenance:** Emergency repairs performed after a machine stops working unexpectedly.

### 38. Audit Trail & Immutable Logging
- **What it means:** A tamper-proof digital record that permanently logs who did what, when, from which computer, and what changed. It cannot be deleted or altered by anyone.

### 39. RBAC (Role-Based Access Control)
- **What it means:** Security rules granting screen access based on your job badge: Doctors see clinical charts; Cashiers see money drawers; Receptionists see appointments.

### 40. RLS (Row Level Security)
- **What it means:** A database security shield inside PostgreSQL ensuring that a branch user or patient can only read rows in the database belonging to their authorized scope.

### 41. REST API (Application Programming Interface)
- **What it means:** The secure digital messenger that allows the web browser screen to send instructions to the backend server and receive data in milliseconds.

### 42. Supabase PostgreSQL
- **What it means:** An enterprise-grade, open-source relational database that permanently stores hospital data in organized tables with relationships, foreign keys, and cryptographic encryption.
"""

