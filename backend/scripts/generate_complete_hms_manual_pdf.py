import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Skip cover page
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0E7490"))
        # Header
        self.drawString(40, A4[1] - 30, "AURA HOSPITAL MANAGEMENT SYSTEM (HMS)")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawRightString(A4[0] - 40, A4[1] - 30, "Complete Operations & Training Manual")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, A4[1] - 34, A4[0] - 40, A4[1] - 34)

        # Footer
        self.line(40, 36, A4[0] - 40, 36)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 24, "Confidential • Hospital Training & Operations Guide • Beginner to Professional")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(A4[0] - 40, 24, page_text)
        self.restoreState()

def create_manual(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0F172A")
    c_teal = colors.HexColor("#0E7490")
    c_slate = colors.HexColor("#334155")
    c_border = colors.HexColor("#CBD5E1")
    c_bg_light = colors.HexColor("#F8FAFC")
    c_highlight = colors.HexColor("#059669")

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=colors.HexColor("#0F172A"),
        alignment=1,
    )
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=c_teal,
        alignment=1,
    )
    meta_style = ParagraphStyle(
        'CoverMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#64748B"),
        alignment=1,
    )
    h1_style = ParagraphStyle(
        'Header1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Header2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=c_teal,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )
    h3_style = ParagraphStyle(
        'Header3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=c_slate,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_slate,
        spaceAfter=5
    )
    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=c_slate,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )
    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#1E293B"),
    )
    tbl_cell = ParagraphStyle(
        'TblCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=c_slate
    )
    tbl_header = ParagraphStyle(
        'TblHdr',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white
    )

    story = []

    # ---------------------------------------------------------
    # COVER PAGE
    # ---------------------------------------------------------
    story.append(Spacer(1, 40))
    story.append(Paragraph("AURA MULTI-SPECIALTY HOSPITAL", subtitle_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("COMPLETE HOSPITAL MANAGEMENT SYSTEM (HMS)<br/>TRAINING & OPERATIONS MANUAL", title_style))
    story.append(Spacer(1, 12))
    story.append(Paragraph("From Beginner to Professional: Architecture, Accounts, Modules, Workflows, and Every Button Explained", subtitle_style))
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="60%", thickness=2, color=c_teal, spaceAfter=25))

    cover_box_data = [
        [Paragraph("<b>Target Audience:</b>", tbl_header), Paragraph("Hospital Owners, Administrators, Medical Officers, Software Demonstrators & Trainees", tbl_cell)],
        [Paragraph("<b>Scope of Document:</b>", tbl_header), Paragraph("All 21 User Roles, 27 Core Modules, Every Operational Button, Double-Entry GL, Live Demo Script & Glossary", tbl_cell)],
        [Paragraph("<b>Core Technologies:</b>", tbl_header), Paragraph("React + TypeScript Frontend, Django REST Framework Backend, Supabase PostgreSQL, Render Cloud", tbl_cell)],
        [Paragraph("<b>Compliance:</b>", tbl_header), Paragraph("NABH / NABL Clinical Audit Trails, ICD-10 Coding, FEFO Drug Dispensing, Role-Based Access Control (RBAC)", tbl_cell)],
        [Paragraph("<b>Currency & Locale:</b>", tbl_header), Paragraph("Indian Rupees (₹), Multi-Branch Support, 5-Language Interface Synchronization", tbl_cell)]
    ]
    t_cover = Table(cover_box_data, colWidths=[120, 380])
    t_cover.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), c_teal),
        ('BACKGROUND', (1,0), (1,-1), c_bg_light),
        ('BOX', (0,0), (-1,-1), 1, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_cover)
    story.append(Spacer(1, 40))
    story.append(Paragraph("<i>Prepared for Hospital Demonstration, User Training & Technical Presentation</i>", meta_style))
    story.append(Paragraph("Version 3.4 • All Systems Connected • Zero Artificial Dummy Transactions", meta_style))
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 1: INTRODUCTION & PROJECT OVERVIEW
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 1: Introduction & High-Level Project Overview", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "<b>What is a Hospital Management System (HMS)?</b><br/>"
        "In a real hospital, hundreds of critical events occur simultaneously: outpatient walk-ins, emergency trauma admissions, "
        "doctor clinical consultations, medication charting, blood test analysis, medical imaging, pharmaceutical inventory management, "
        "cashier reconciliations, and vendor procurement. Without a unified digital system, hospitals suffer from lost medical paper records, "
        "billing discrepancies, dangerous drug-allergy interactions, and chaotic patient queues. AURA HMS serves as the centralized digital backbone "
        "connecting all hospital branches and departments into a single secure platform.",
        body_style
    ))
    story.append(Paragraph(
        "<b>The Three Foundational Pillars of the HMS:</b>", h2_style
    ))
    story.append(Paragraph("<b>1. Patient Care & Front Desk:</b> Master Patient Index (MRN generation), OPD appointment scheduling, mandatory advance payment collection, queue token generation, and Digital Waiting Lounge TV broadcasting.", bullet_style))
    story.append(Paragraph("<b>2. Clinical & Diagnostic Services:</b> Electronic Medical Records (EMR), Doctor Consultation Cabins, Nursing Station Medication Administration Records (MAR), Diagnostic Pathology (LIS), Medical Imaging (RIS), Operation Theatre (OT), and ICU telemetry.", bullet_style))
    story.append(Paragraph("<b>3. Finance & Logistics Operations:</b> First-Expiring, First-Out (FEFO) pharmacy dispensing, purchase order procurement, hospital warehouse inventory, cashier shift reconciliation, double-entry General Ledger accounting, HR employee rosters, and monthly payroll.", bullet_style))
    story.append(Spacer(1, 8))

    # ---------------------------------------------------------
    # SECTION 2: ALL 21 ROLES & ACCOUNTS
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 2: Detailed Account Roles & Permission Matrix", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "Every hospital staff member has a dedicated account governed by strict Role-Based Access Control (RBAC). Below is the complete directory of all 21 roles in the system:",
        body_style
    ))

    roles_data = [
        [Paragraph("Role Name", tbl_header), Paragraph("Real-Hospital Designation", tbl_header), Paragraph("Key Responsibilities & Allowed Actions", tbl_header), Paragraph("Strict Prohibitions", tbl_header)],
        [
            Paragraph("<b>SUPER_ADMIN</b>", tbl_cell),
            Paragraph("Chief System Administrator", tbl_cell),
            Paragraph("Full global authority across all branches. System configuration, provisioning staff accounts, master RBAC overrides, security audit inspection.", tbl_cell),
            Paragraph("Cannot delete finalized clinical medical records or past journal vouchers.", tbl_cell)
        ],
        [
            Paragraph("<b>HOSPITAL_ADMIN</b>", tbl_cell),
            Paragraph("Hospital Administrator / COO", tbl_cell),
            Paragraph("Central pricing & tariff management across all branches, service catalog rates, departmental operations oversight, facility management.", tbl_cell),
            Paragraph("Strictly blocked from modifying doctor clinical consultation notes or dispensing pharmacy stock.", tbl_cell)
        ],
        [
            Paragraph("<b>BRANCH_MANAGER</b>", tbl_cell),
            Paragraph("Branch Operations Manager", tbl_cell),
            Paragraph("Supervisory read-only command center across 14 operational domains (OPD, IPD, OT, LIS, RIS, Billing, Pharmacy, Staff Roster).", tbl_cell),
            Paragraph("Strict read-only enforcement (HTTP 403 on all write attempts). Cannot modify invoices, clinical notes, or tariffs.", tbl_cell)
        ],
        [
            Paragraph("<b>MEDICAL_DIRECTOR</b>", tbl_cell),
            Paragraph("Chief Medical Officer (CMO)", tbl_cell),
            Paragraph("Clinical governance, medical protocol review, doctor quality metrics, mortality review, clinical audit trails.", tbl_cell),
            Paragraph("Cannot alter financial general ledgers or bank reconciliation records.", tbl_cell)
        ],
        [
            Paragraph("<b>DEPARTMENT_HEAD</b>", tbl_cell),
            Paragraph("Clinical HOD (e.g. Cardiology)", tbl_cell),
            Paragraph("Departmental doctor roster scheduling, shift swap reviews, staff requirement requests, clinical performance reviews.", tbl_cell),
            Paragraph("Cannot provision login credentials or access other clinical departments.", tbl_cell)
        ],
        [
            Paragraph("<b>DOCTOR</b>", tbl_cell),
            Paragraph("Consultant / Attending Physician", tbl_cell),
            Paragraph("Conducts OPD consultations, records vitals and ICD-10 diagnoses, prescribes medications (e-Rx), orders lab/radiology tests, signs discharge summaries.", tbl_cell),
            Paragraph("Strictly blocked from booking appointments, collecting billing cash, or editing locked historical visits.", tbl_cell)
        ],
        [
            Paragraph("<b>NURSE</b>", tbl_cell),
            Paragraph("Staff Nursing Officer", tbl_cell),
            Paragraph("Ward inpatient care, hourly vital logs, Medication Administration Record (MAR), nursing handover notes (SBAR), nursing discharge clearance.", tbl_cell),
            Paragraph("Cannot prescribe new medications or alter financial invoices.", tbl_cell)
        ],
        [
            Paragraph("<b>RECEPTIONIST</b>", tbl_cell),
            Paragraph("Front Desk Executive", tbl_cell),
            Paragraph("Patient registration, OPD appointment scheduling, mandatory consultation payment collection, token issuance, queue coordination.", tbl_cell),
            Paragraph("Strictly blocked from entering clinical notes or altering pharmacy inventory.", tbl_cell)
        ],
        [
            Paragraph("<b>BILLING_EXECUTIVE</b>", tbl_cell),
            Paragraph("Inpatient & Outpatient Billing Staff", tbl_cell),
            Paragraph("Generates itemized patient bills, discharge settlements, advance deposits, split payments (Cash, Card, UPI), prints official tax invoices.", tbl_cell),
            Paragraph("Cannot approve unverified billing discounts without administrative authorization.", tbl_cell)
        ],
        [
            Paragraph("<b>CASHIER</b>", tbl_cell),
            Paragraph("Cash Counter Executive", tbl_cell),
            Paragraph("Cash drawer management, daily opening float entry, cash collection, shift closure cash reconciliation, physical count audit.", tbl_cell),
            Paragraph("Cannot modify clinical diagnosis or alter item prices on the fly.", tbl_cell)
        ],
        [
            Paragraph("<b>PHARMACIST</b>", tbl_cell),
            Paragraph("Registered Pharmacist", tbl_cell),
            Paragraph("Receives doctor-signed e-prescriptions, validates drug interactions, dispenses medications using FEFO, manages batch expiries.", tbl_cell),
            Paragraph("Cannot dispense expired batches or dispense without verified doctor prescription.", tbl_cell)
        ],
        [
            Paragraph("<b>INVENTORY_MANAGER</b>", tbl_cell),
            Paragraph("Materials & Stores Manager", tbl_cell),
            Paragraph("Central hospital warehouse, stock movements, batch tracking, stock write-offs, minimum reorder thresholds.", tbl_cell),
            Paragraph("Cannot authorize vendor payments directly (requires Accounts separation).", tbl_cell)
        ],
        [
            Paragraph("<b>PROCUREMENT_OFFICER</b>", tbl_cell),
            Paragraph("Hospital Purchasing Officer", tbl_cell),
            Paragraph("Prepares Purchase Requisitions, solicits vendor quotations, prepares comparative price charts, generates Purchase Orders (POs), logs Goods Received Notes (GRN).", tbl_cell),
            Paragraph("Strictly prohibited from self-approving purchase orders without separation of duty.", tbl_cell)
        ],
        [
            Paragraph("<b>LAB_TECHNICIAN</b>", tbl_cell),
            Paragraph("Medical Laboratory Technician", tbl_cell),
            Paragraph("Specimen accessioning, sample barcode labeling, analyzer result entry, critical panic value alerts, report submission for pathologist sign-off.", tbl_cell),
            Paragraph("Cannot release diagnostic reports without medical officer digital authorization.", tbl_cell)
        ],
        [
            Paragraph("<b>RADIOLOGY_TECHNICIAN</b>", tbl_cell),
            Paragraph("Radiographer / Imaging Tech", tbl_cell),
            Paragraph("Executes imaging studies (X-Ray, CT, MRI, Ultrasound), attaches PACS/DICOM study links, prepares draft technical impressions.", tbl_cell),
            Paragraph("Cannot authorize clinical radiological interpretations without Radiologist verification.", tbl_cell)
        ],
        [
            Paragraph("<b>FINANCE_MANAGER</b>", tbl_cell),
            Paragraph("Chief Financial Officer / Finance Head", tbl_cell),
            Paragraph("Authorizes high-value vendor payments, posts double-entry journal vouchers, reviews Profit & Loss (P&L), manages corporate bank accounts.", tbl_cell),
            Paragraph("Cannot alter verified patient clinical histories.", tbl_cell)
        ],
        [
            Paragraph("<b>ACCOUNTANT</b>", tbl_cell),
            Paragraph("Senior Hospital Accountant", tbl_cell),
            Paragraph("Prepares journal entries, reconciles bank statements, tracks Accounts Receivable (AR) and Accounts Payable (AP), audits cashier drawers.", tbl_cell),
            Paragraph("Cannot approve self-prepared vouchers without supervisor authorization.", tbl_cell)
        ],
        [
            Paragraph("<b>INVESTMENT_MANAGER</b>", tbl_cell),
            Paragraph("Treasury & Investment Officer", tbl_cell),
            Paragraph("Manages hospital fixed deposits (FD), government bonds, treasury reserves, valuation logs, interest accruals, investment liquidation.", tbl_cell),
            Paragraph("Cannot divert hospital funds outside approved corporate treasury policies.", tbl_cell)
        ],
        [
            Paragraph("<b>INSURANCE_COORDINATOR</b>", tbl_cell),
            Paragraph("TPA Desk Executive", tbl_cell),
            Paragraph("Patient insurance verification, cashless pre-authorization, TPA query resolution, claim document submission, settlement reconciliation.", tbl_cell),
            Paragraph("Cannot mark bills settled without verifiable TPA approval sanction letters.", tbl_cell)
        ],
        [
            Paragraph("<b>HR_MANAGER</b>", tbl_cell),
            Paragraph("Human Resources Head", tbl_cell),
            Paragraph("Onboards new staff, provisions approved operational login accounts, manages leave policies, attendance regularizations, payroll runs.", tbl_cell),
            Paragraph("Cannot provision high-governance administrative roles (SUPER_ADMIN, HOSPITAL_ADMIN, BRANCH_MANAGER).", tbl_cell)
        ],
        [
            Paragraph("<b>PATIENT</b>", tbl_cell),
            Paragraph("Registered Hospital Patient", tbl_cell),
            Paragraph("Accesses self-service portal: views past appointments, electronic prescriptions, verified diagnostic reports, invoices, and payment receipts.", tbl_cell),
            Paragraph("Strictly restricted to own records only; zero visibility into other patients or hospital internal modules.", tbl_cell)
        ]
    ]

    t_roles = Table(roles_data, colWidths=[90, 105, 185, 135])
    t_roles.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_roles)
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 3: THE 27 CORE MODULES
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 3: The 27 Core Modules – Purpose, Fields & Functionality", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))

    modules_desc = [
        ("1. Master Patient Index (MPI)", "Maintains universal demographic records, contact details, emergency contacts, blood group, allergies, and generates the permanent Medical Record Number (MRN-YYYY-XXXXX)."),
        ("2. OPD Appointments & Token Queue", "Doctor scheduling, time-slot allocation, advance consultation fee collection, token generation, and multi-counter queue management."),
        ("3. Digital Waiting Lounge TV Display", "Public audiovisual queue announcer broadcasted on waiting room screens showing current tokens being called into doctor chambers."),
        ("4. Doctor Consultation Cabin (EMR)", "Clinician workspace: vital signs logging, Chief Complaints, past medical history, ICD-10 diagnosis, e-Prescriptions with allergy alerts, and electronic test orders."),
        ("5. Nursing Station & MAR", "Ward-level inpatient monitoring: vital sign charts, Medication Administration Record (due, administered, missed, refused doses), and structured SBAR shift handovers."),
        ("6. Inpatient (IPD) Bed Census", "Interactive visual bed board managing General, Semi-Private, Deluxe, and ICU beds with status indicators (Available, Occupied, Cleaning, Maintenance)."),
        ("7. Emergency & Trauma Triage", "Rapid arrival triage sorting emergency patients into Red (Resuscitation), Yellow (Urgent), and Green (Non-urgent) priority streams."),
        ("8. Operating Theatre (OT) Suites", "Surgery scheduling, surgical team rostering (Lead Surgeon, Anesthetist, Scrub Nurse), pre-op checklists, and anesthesia recovery monitoring."),
        ("9. Intensive Care Unit (ICU)", "Critical care telemetry tracking invasive ventilator settings, continuous SpO2/BP monitoring, Glasgow Coma Scale (GCS), and organ failure scores."),
        ("10. Laboratory Information System (LIS)", "Requisition intake, specimen accessioning, barcode generation, analyzer result entry, reference range comparison, critical panic flags, and pathologist sign-off."),
        ("11. Radiology Information System (RIS)", "Imaging examination scheduling, DICOM study metadata linkage, modality worklist, and structured radiologist impression reports."),
        ("12. Pharmacy Formulary & Dispensing", "Direct intake of doctor e-prescriptions, FEFO inventory allocation, drug interaction checks, batch expiry blocking, and patient dispensing."),
        ("13. Multi-Branch Procurement", "Complete supply chain lifecycle: Department Purchase Requisitions -> Vendor Quotations -> Comparative Statements -> Purchase Orders (POs) -> Goods Received Notes (GRNs)."),
        ("14. Central Inventory & Warehouse", "Warehouse management tracking on-hand batch balances, storage locations, minimum safety stock alerts, and audited stock write-offs."),
        ("15. Billing, Invoicing & Cashier Shifts", "Comprehensive billing combining bed days, doctor fees, lab, radiology, and pharmacy items. Manages cashier drawer opening/closing floats and collections."),
        ("16. Insurance & Corporate TPA Claims", "Cashless hospitalization tracking, pre-authorization requests, insurer query management, claim document dockets, and settlement vouchers."),
        ("17. Central Pricing & Tariff Management", "Hospital Admin authority to centrally configure consultation fees, bed tariffs, and clinical service charges with synchronized 1-click push across all branches."),
        ("18. Double-Entry General Ledger (GL)", "Full financial accounting engine where every transaction generates balanced debit and credit entries. Immutable audit trails with reversal capability."),
        ("19. Profit & Loss (P&L) Statement", "Real-time revenue, direct operational costs, staff expenses, and net hospital surplus calculation derived strictly from posted ledger transactions."),
        ("20. Cash Flow & Bank Accounts", "Multi-branch bank account balances, cash-in-hand tracking, electronic fund transfers, cheque clearing, and bank reconciliation statements."),
        ("21. Fixed Assets & Depreciation", "Hospital medical machinery (MRI, X-Ray, Ambulances) tracking, preventive maintenance tasks, breakdown work orders, and straight-line annual depreciation."),
        ("22. Hospital Investment Registers", "Corporate treasury management for Fixed Deposits, government bonds, interest yield tracking, maturity alerts, and liquidity management."),
        ("23. HR Operations & Duty Rosters", "Staff profiles, department rosters, shift swap requests, leave applications, biometric punch regularizations, and credential verification."),
        ("24. Payroll & Salary Disbursal", "Monthly payroll generation, basic pay, house rent allowance (HRA), provident fund (PF) statutory deductions, 1.5x overtime multiplier, and payslip generation."),
        ("25. Branch Manager Supervisory Cockpit", "High-level operational overview across 14 domains with strict read-only permissions preventing operational record tampering."),
        ("26. Patient Self-Service Portal", "Secured web portal allowing patients to access their medical summaries, discharge dockets, lab reports, and payment history from home."),
        ("27. Security, Audits & Activity Logs", "Hospital-wide tamper-proof activity logging recording every user action, IP address, timestamp, affected entity, and permission denials.")
    ]

    for title, desc in modules_desc:
        story.append(Paragraph(f"<b>{title}</b>", h3_style))
        story.append(Paragraph(desc, body_style))

    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 4: BUTTON & ACTION DIRECTORY
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 4: Comprehensive Button & Action Directory", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "Below is the exact operational directory explaining what happens behind every primary button in the application:",
        body_style
    ))

    buttons_data = [
        [Paragraph("Button Name & Location", tbl_header), Paragraph("Who Can Click?", tbl_header), Paragraph("Action Performed & Data Entered", tbl_header), Paragraph("Post-Click Behavior & System Impact", tbl_header)],
        [
            Paragraph("<b>Register Patient</b><br/>Front Desk / Patients Page", tbl_cell),
            Paragraph("Receptionist, Admin", tbl_cell),
            Paragraph("Enters name, gender, DOB, phone, blood group, emergency contact, allergies.", tbl_cell),
            Paragraph("Saves to PostgreSQL `PatientProfile`. Generates unique `MRN-YYYY-XXXXX`. Immediately selectable in appointment and admission forms.", tbl_cell)
        ],
        [
            Paragraph("<b>Book Appointment</b><br/>Appointments Page", tbl_cell),
            Paragraph("Receptionist, Patient", tbl_cell),
            Paragraph("Selects branch, department, consulting doctor, date, and time slot.", tbl_cell),
            Paragraph("Locks appointment slot. Prompts mandatory payment collection dialog. Doctors are forbidden from booking.", tbl_cell)
        ],
        [
            Paragraph("<b>Collect Payment & Issue Token</b><br/>Appointment Modal", tbl_cell),
            Paragraph("Receptionist, Cashier", tbl_cell),
            Paragraph("Selects payment mode (Cash, Card, UPI). Enters collected amount.", tbl_cell),
            Paragraph("Creates payment transaction, posts debit to Cash/Bank account, generates sequential queue token (e.g. #A-014), and prints receipt.", tbl_cell)
        ],
        [
            Paragraph("<b>Call Patient</b><br/>Doctor Consultation Workspace", tbl_cell),
            Paragraph("Doctor", tbl_cell),
            Paragraph("Clicks token in active waiting queue.", tbl_cell),
            Paragraph("Plays digital audio chime on Waiting Lounge TV, flashes cabin number, marks appointment status as IN_CONSULTATION.", tbl_cell)
        ],
        [
            Paragraph("<b>Finalize Consultation</b><br/>Doctor Workspace", tbl_cell),
            Paragraph("Doctor", tbl_cell),
            Paragraph("Reviews diagnosis (ICD-10), vital signs, prescriptions, and lab orders.", tbl_cell),
            Paragraph("Cryptographically locks consultation note against post-visit edits. Transmits e-Rx to pharmacy and test orders to LIS/RIS.", tbl_cell)
        ],
        [
            Paragraph("<b>Admit Patient</b><br/>Admissions & Ward Bed Board", tbl_cell),
            Paragraph("Receptionist, Admission Staff", tbl_cell),
            Paragraph("Selects patient MRN, admitting doctor, ward category, bed number, and advance deposit amount.", tbl_cell),
            Paragraph("Changes bed status from AVAILABLE (Green) to OCCUPIED (Red). Creates `InpatientAdmission` record. Generates advance deposit receipt.", tbl_cell)
        ],
        [
            Paragraph("<b>Transfer Bed</b><br/>Inpatient Admission Detail", tbl_cell),
            Paragraph("Admission Staff, Ward Nurse", tbl_cell),
            Paragraph("Selects new destination ward and vacant bed. Enters clinical transfer reason.", tbl_cell),
            Paragraph("Atomic reallocation: frees previous bed (marked CLEANING), occupies new bed, updates prorated running bed tariffs.", tbl_cell)
        ],
        [
            Paragraph("<b>Log Medication (MAR)</b><br/>Nurse Workspace", tbl_cell),
            Paragraph("Nurse", tbl_cell),
            Paragraph("Selects scheduled medication dose: Administered, Missed, or Refused. Enters nurse notes.", tbl_cell),
            Paragraph("Logs digital signature, administering timestamp, and updates patient clinical care docket.", tbl_cell)
        ],
        [
            Paragraph("<b>Accession Sample</b><br/>Laboratory Orders Queue", tbl_cell),
            Paragraph("Lab Technician", tbl_cell),
            Paragraph("Verifies specimen tube container, collection time, and phlebotomy notes.", tbl_cell),
            Paragraph("Generates unique specimen barcode. Marks order status as SAMPLE_COLLECTED / IN_PROCESSING.", tbl_cell)
        ],
        [
            Paragraph("<b>Verify & Release Report</b><br/>Laboratory Report Screen", tbl_cell),
            Paragraph("Pathologist / Medical Officer", tbl_cell),
            Paragraph("Reviews entered test values against biological reference intervals and panic limits.", tbl_cell),
            Paragraph("Signs report digitally. Instantly publishes report to Doctor EMR workspace and Patient Portal.", tbl_cell)
        ],
        [
            Paragraph("<b>Dispense Prescription</b><br/>Pharmacy Dispensing Queue", tbl_cell),
            Paragraph("Pharmacist", tbl_cell),
            Paragraph("Scans medicine barcode. System auto-allocates nearest-expiry batch (FEFO).", tbl_cell),
            Paragraph("Validates on-hand stock and expiry dates. Deducts inventory quantity, logs `StockMovement`, and creates pharmacy billing charge.", tbl_cell)
        ],
        [
            Paragraph("<b>Initiate Discharge</b><br/>Inpatient Admissions", tbl_cell),
            Paragraph("Attending Doctor", tbl_cell),
            Paragraph("Completes clinical discharge summary, home prescriptions, and follow-up advice.", tbl_cell),
            Paragraph("Starts mandatory 4-Point Clearance workflow. Patient cannot leave until Nursing, Pharmacy, and Billing clear the account.", tbl_cell)
        ],
        [
            Paragraph("<b>Settle & Print Final Invoice</b><br/>Billing Desk", tbl_cell),
            Paragraph("Billing Executive, Cashier", tbl_cell),
            Paragraph("Aggregates bed days, doctor fees, lab, and pharmacy charges. Deducts advance deposits. Collects balance or processes refund.", tbl_cell),
            Paragraph("Issues tax invoice with zero balance due. Grants final billing clearance. Bed status transitions to CLEANING.", tbl_cell)
        ],
        [
            Paragraph("<b>Apply Central Tariffs</b><br/>Pricing & Tariff Management", tbl_cell),
            Paragraph("Hospital Admin", tbl_cell),
            Paragraph("Edits consultation fee or bed rate. Reviews Impact Analysis preview.", tbl_cell),
            Paragraph("Pushes new tariffs across all hospital branches simultaneously. Past invoices and ongoing admissions preserve contracted rates.", tbl_cell)
        ],
        [
            Paragraph("<b>Post Journal Voucher</b><br/>General Ledger Page", tbl_cell),
            Paragraph("Finance Manager, Accountant", tbl_cell),
            Paragraph("Enters balanced debit and credit ledger rows (`Total Debits == Total Credits`) with narration.", tbl_cell),
            Paragraph("Posts immutable journal entry. Updates General Ledger, Trial Balance, and Profit & Loss statement in real time.", tbl_cell)
        ],
        [
            Paragraph("<b>Reconcile Cashier Shift</b><br/>Billing Cash Drawer", tbl_cell),
            Paragraph("Cashier, Finance Manager", tbl_cell),
            Paragraph("Enters physical currency denomination count at end of shift.", tbl_cell),
            Paragraph("Compares physical cash against system collections. Flags cash surplus/shortage and locks cashier shift drawer.", tbl_cell)
        ]
    ]

    t_buttons = Table(buttons_data, colWidths=[100, 85, 160, 165])
    t_buttons.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_teal),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_buttons)
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 5: COMPLETE WORKFLOWS & DATA FLOW
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 5: End-to-End Hospital Workflows & Data Connections", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))

    story.append(Paragraph("<b>Workflow 1: Complete Patient Journey (OPD to IPD Discharge)</b>", h2_style))
    story.append(Paragraph(
        "1. <b>Intake:</b> Patient arrives at reception -> Registered in Master Patient Index -> Permanent MRN generated.<br/>"
        "2. <b>Booking & Payment:</b> OPD appointment booked with Dr. Ananya -> Mandatory consultation fee (₹500) collected in cash -> Queue Token (#A-014) issued.<br/>"
        "3. <b>Waiting Broadcast:</b> Lounge TV plays audio chime and directs Token #A-014 to Cabin 102.<br/>"
        "4. <b>Consultation:</b> Doctor records vitals, logs Chief Complaints, selects ICD-10 diagnosis, prescribes antibiotic, orders CBC lab test, and recommends IPD admission.<br/>"
        "5. <b>Admission & Deposit:</b> Receptionist allocates Bed G-04 in General Ward (₹1,500/day). Patient deposits ₹5,000 advance. Bed turns OCCUPIED.<br/>"
        "6. <b>Nursing Care:</b> Nurse monitors vitals hourly and records administered antibiotic injection on the Medication Administration Record (MAR).<br/>"
        "7. <b>Diagnostics:</b> Lab collects blood, enters CBC values, pathologist digitally verifies report -> Doctor reviews report on screen.<br/>"
        "8. <b>4-Point Discharge:</b> Doctor completes discharge summary -> Nurse clears bed custody -> Pharmacy accepts unused medicine returns -> Billing calculates total charges (₹3,400) and refunds ₹1,600 excess advance in cash -> Bed marked CLEANING.",
        body_style
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Workflow 2: Pharmacy Inventory & FEFO Dispensing</b>", h2_style))
    story.append(Paragraph(
        "1. <b>Electronic Prescription Receipt:</b> When a doctor finalizes a consultation, the prescription is securely pushed to the pharmacy dispensing queue.<br/>"
        "2. <b>First-Expiring, First-Out (FEFO) Allocation:</b> The pharmacy engine automatically matches the prescribed drug code with inventory batches and selects the batch closest to expiration.<br/>"
        "3. <b>Dispensing Validation:</b> The system blocks dispensing if on-hand quantity is insufficient or if a batch is past expiration.<br/>"
        "4. <b>Stock Movement & Audit:</b> Upon dispensing, quantity is decremented from the batch, a `StockMovement` ledger row is written, and medication charges are added to the patient's billing docket.",
        body_style
    ))
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Workflow 3: Procurement & Supply Chain Lifecycle</b>", h2_style))
    story.append(Paragraph(
        "1. <b>Purchase Requisition:</b> Department Head identifies low stock of surgical gloves and submits a Purchase Requisition.<br/>"
        "2. <b>Supplier Quotations:</b> Procurement Officer invites quotations from approved vendors and compiles a comparative price statement.<br/>"
        "3. <b>Purchase Order (PO):</b> Hospital Admin authorizes the Purchase Order with separated approval duty.<br/>"
        "4. <b>Goods Receipt Note (GRN):</b> Warehouse receiving dock inspects delivered items, enters batch numbers and expiries, and logs damaged goods rejections.<br/>"
        "5. <b>Accounts Payable (AP):</b> Accounts converts the verified GRN into a vendor invoice and schedules electronic payment.",
        body_style
    ))
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 6: FINANCIAL OPERATIONS & PRICING
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 6: Hospital Financial Operations & Pricing Architecture", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "Hospital financial management requires zero tolerance for errors. Our system combines automated patient billing with double-entry general ledger accounting:",
        body_style
    ))

    fin_table_data = [
        [Paragraph("Revenue & Billing Category", tbl_header), Paragraph("Pricing Model & Configured Rate", tbl_header), Paragraph("Financial Accounting Posting Rule", tbl_header)],
        [
            Paragraph("<b>General OPD Consultation</b>", tbl_cell),
            Paragraph("₹500 per visit (Standard tariff)", tbl_cell),
            Paragraph("Debit: Cash/Card Clearing Account<br/>Credit: OPD Consultation Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Specialist / Surgeon Consultation</b>", tbl_cell),
            Paragraph("₹800 – ₹1,200 per visit", tbl_cell),
            Paragraph("Debit: Cash/Card Clearing Account<br/>Credit: Specialist Consultation Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Emergency Consultation</b>", tbl_cell),
            Paragraph("₹1,000 (Triage rate)", tbl_cell),
            Paragraph("Debit: Cash/Card Clearing Account<br/>Credit: Emergency Medical Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>General Ward Bed Rate</b>", tbl_cell),
            Paragraph("₹1,500 per calendar day", tbl_cell),
            Paragraph("Debit: Patient Inpatient Ledger<br/>Credit: Room & Nursing Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Semi-Private Room</b>", tbl_cell),
            Paragraph("₹2,500 per calendar day", tbl_cell),
            Paragraph("Debit: Patient Inpatient Ledger<br/>Credit: Room & Nursing Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Deluxe Private Suite</b>", tbl_cell),
            Paragraph("₹4,500 per calendar day", tbl_cell),
            Paragraph("Debit: Patient Inpatient Ledger<br/>Credit: Room & Nursing Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Intensive Care Unit (ICU)</b>", tbl_cell),
            Paragraph("₹7,500 per day (Telemetry included)", tbl_cell),
            Paragraph("Debit: Patient Inpatient Ledger<br/>Credit: Critical Care ICU Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Diagnostic Pathology Tests</b>", tbl_cell),
            Paragraph("₹200 – ₹1,500 per test code", tbl_cell),
            Paragraph("Debit: Patient Billing Docket<br/>Credit: Pathology Diagnostic Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Radiology & Imaging Scans</b>", tbl_cell),
            Paragraph("₹800 (X-Ray) – ₹6,500 (MRI)", tbl_cell),
            Paragraph("Debit: Patient Billing Docket<br/>Credit: Radiology Imaging Revenue Account", tbl_cell)
        ],
        [
            Paragraph("<b>Pharmacy Medicines</b>", tbl_cell),
            Paragraph("Configured MRP with batch tracking", tbl_cell),
            Paragraph("Debit: Patient Billing Docket<br/>Credit: Pharmacy Sales Revenue; Inventory Asset reduced", tbl_cell)
        ],
        [
            Paragraph("<b>Inpatient Advance Deposit</b>", tbl_cell),
            Paragraph("₹5,000 – ₹50,000 security deposit", tbl_cell),
            Paragraph("Debit: Bank/Cash Clearing Account<br/>Credit: Patient Deposit Liability Account", tbl_cell)
        ]
    ]

    t_fin = Table(fin_table_data, colWidths=[130, 160, 220])
    t_fin.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_fin)
    story.append(Spacer(1, 10))

    story.append(Paragraph("<b>The Principle of Double-Entry General Ledger:</b>", h2_style))
    story.append(Paragraph(
        "Every single financial transaction in AURA HMS strictly posts equal debits and credits: <code>Total Debits == Total Credits</code>. "
        "When a patient pays ₹500 cash for a consultation: "
        "<b>Debit:</b> Cash in Hand (Asset increases by ₹500). "
        "<b>Credit:</b> OPD Consultation Income (Revenue increases by ₹500). "
        "This architectural discipline ensures that the hospital Balance Sheet and Profit & Loss statement reconcile down to the exact rupee without manual book balancing.",
        body_style
    ))
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 7: TECHNICAL ARCHITECTURE IN SIMPLE ENGLISH
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 7: Technical Architecture Explained in Simple English", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "You do not need to be a software programmer to understand how this system works internally. Here is the plain-English translation of our technology stack:",
        body_style
    ))

    tech_data = [
        [Paragraph("Technology", tbl_header), Paragraph("What It Means in Plain English", tbl_header), Paragraph("Hospital Analogy", tbl_header)],
        [
            Paragraph("<b>React + TypeScript</b><br/>(Frontend)", tbl_cell),
            Paragraph("The visual screen interface you click and see in your web browser. TypeScript ensures that numbers, text, and dates are entered without typing mistakes.", tbl_cell),
            Paragraph("The hospital reception desk, counters, and digital monitor displays.", tbl_cell)
        ],
        [
            Paragraph("<b>Django REST Framework</b><br/>(Backend)", tbl_cell),
            Paragraph("The powerful Python server engine that processes rules, enforces security, calculates bills, and validates medical policies.", tbl_cell),
            Paragraph("The hospital administration office and medical superintendent verifying every rule.", tbl_cell)
        ],
        [
            Paragraph("<b>Supabase PostgreSQL</b><br/>(Database)", tbl_cell),
            Paragraph("A rock-solid relational database that permanently stores patients, medical histories, invoices, and audit logs with enterprise security.", tbl_cell),
            Paragraph("The hospital strongroom where permanent legal health record binders are locked.", tbl_cell)
        ],
        [
            Paragraph("<b>REST API</b><br/>(Application Interface)", tbl_cell),
            Paragraph("The secure communication protocol connecting the browser screen to the server.", tbl_cell),
            Paragraph("The hospital pneumatic tube or orderly carrying verified documents between departments.", tbl_cell)
        ],
        [
            Paragraph("<b>RBAC</b><br/>(Role-Based Access Control)", tbl_cell),
            Paragraph("Digital security locks preventing staff from accessing screens outside their job role.", tbl_cell),
            Paragraph("Keycards: doctors open consulting cabins, cashiers open money drawers, nurses open medicine rooms.", tbl_cell)
        ],
        [
            Paragraph("<b>RLS</b><br/>(Row Level Security)", tbl_cell),
            Paragraph("Database-level security rules that guarantee Branch A staff cannot view or tamper with Branch B patient data.", tbl_cell),
            Paragraph("Separated locked storage cabinets for different hospital branches.", tbl_cell)
        ]
    ]

    t_tech = Table(tech_data, colWidths=[110, 240, 160])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_teal),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_tech)
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 8: IMPLEMENTATION AUDIT & DISCLOSURES
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 8: Comprehensive Implementation Audit & Disclosures", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "A senior architect must always present the exact, verifiable truth about what is live in the database versus what relies on simulated dockets:",
        body_style
    ))

    audit_data = [
        [Paragraph("Subsystem / Capability", tbl_header), Paragraph("Implementation Status", tbl_header), Paragraph("Technical Truth & Verifiable Evidence", tbl_header)],
        [
            Paragraph("<b>Patient Registration & EMR</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Live PostgreSQL tables (`PatientProfile`, `Appointment`, `ConsultationNote`). Unique MRN generation and cryptographically signed clinical notes.", tbl_cell)
        ],
        [
            Paragraph("<b>Inpatient Admissions & Beds</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Live `Ward`, `Bed`, `InpatientAdmission` tables. Real-time visual status transitions (Available, Occupied, Cleaning, Maintenance).", tbl_cell)
        ],
        [
            Paragraph("<b>Central Tariff Synchronization</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Hospital Admin centralized pricing authority. Instant multi-branch synchronization with non-destructive historical billing preservation.", tbl_cell)
        ],
        [
            Paragraph("<b>Pharmacy FEFO Dispensing</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Auto-selects nearest expiry batch. Prevents dispensing expired stock. Deducts live quantity and writes `StockMovement` audit logs.", tbl_cell)
        ],
        [
            Paragraph("<b>General Ledger & P&L</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Strict balanced double-entry vouchers (`Total Debits == Total Credits`). Real Profit & Loss derived from posted transaction vouchers.", tbl_cell)
        ],
        [
            Paragraph("<b>HR Attendance Engine</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("Directly queries `EmployeeAttendance` database records. Real clock-in/out timestamps, calculated duration, overtime, and zero dummy text.", tbl_cell)
        ],
        [
            Paragraph("<b>Multilingual UI Synchronization</b>", tbl_cell),
            Paragraph("<font color='#059669'><b>FULLY VERIFIED</b></font>", tbl_cell),
            Paragraph("100% dictionary parity across 5 languages (English, Hindi, Telugu, Tamil, Kannada) with instant live UI re-rendering.", tbl_cell)
        ],
        [
            Paragraph("<b>External PACS/DICOM Hardware</b>", tbl_cell),
            Paragraph("<font color='#D97706'><b>SIMULATION SUPPORTED</b></font>", tbl_cell),
            Paragraph("Clinical findings and study UIDs are stored in DB; viewing raw DICOM imaging files uses simulated viewers since physical MRI machines are external.", tbl_cell)
        ],
        [
            Paragraph("<b>Lab Analyzer Telemetry</b>", tbl_cell),
            Paragraph("<font color='#D97706'><b>SIMULATION SUPPORTED</b></font>", tbl_cell),
            Paragraph("An ASTM/HL7 packet simulator generates machine telemetry to demonstrate automated LIS ingestion when physical hematology analyzers are offline.", tbl_cell)
        ],
        [
            Paragraph("<b>Razorpay Payment Gateway</b>", tbl_cell),
            Paragraph("<font color='#D97706'><b>TEST-MODE VERIFIED</b></font>", tbl_cell),
            Paragraph("Real Razorpay Orders API integration with HMAC-SHA256 signature verification operating in Test Mode with standard sandbox credentials.", tbl_cell)
        ]
    ]

    t_audit = Table(audit_data, colWidths=[120, 110, 280])
    t_audit.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_audit)
    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 9: LIVE DEMO SCRIPT & PRESENTATION
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 9: Live HMS Demonstration Script for Executive Presentations", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))
    story.append(Paragraph(
        "Use this word-for-word presentation script when demonstrating the hospital application to leadership, management, or clients:",
        body_style
    ))

    demo_steps = [
        ("Step 1: Introduction (60 Seconds)", "Good morning everyone. Today I am presenting AURA HMS, our enterprise hospital management platform. Our system automates the complete operational lifecycle of a multi-specialty hospital across 21 user roles and 27 clinical and financial modules. Every department—from the front-desk token queue to doctor consultation rooms, inpatient wards, diagnostic laboratories, pharmacy inventory, and double-entry accounting—is seamlessly connected in real time."),
        ("Step 2: Patient Registration & OPD Token Queue", "Let us begin with a new patient, Rahul Sharma. At the reception desk, we register Rahul with one click. Notice how the system automatically issues a permanent Medical Record Number, MRN-2026-00105. We now book an appointment with Dr. Ananya. The system enforces our mandatory payment security gate: consultation fee ₹500 is collected in cash. Once confirmed, Token #A-014 is generated and instantly broadcasted to our Digital Waiting Lounge TV display with an automated audio chime."),
        ("Step 3: Doctor Consultation & Clinical EMR", "Logging in as Dr. Ananya, Rahul appears at the top of our OPD queue. We open his consultation. Here, the doctor logs vital signs, records Chief Complaints, and selects an ICD-10 diagnosis. Dr. Ananya prescribes an antibiotic and orders a Complete Blood Count lab test. Because Rahul has severe abdominal pain, she clicks 'Admit Patient' to recommend inpatient admission."),
        ("Step 4: Bed Allocation & Advance Deposit", "Moving to the Admissions module, we view our interactive Bed Visualizer. We allocate Bed G-04 in the General Medical Ward at ₹1,500 per day. The patient's family deposits a ₹5,000 security advance. Instantly, Bed G-04 transitions from Green (Available) to Red (Occupied) across the hospital network."),
        ("Step 5: Nursing Station & Diagnostic Lab", "At the Nursing Station, Sister Mary accesses her Medication Administration Record (MAR) and marks the antibiotic injection as administered. Simultaneously, in the diagnostic laboratory, technician Rajesh receives the specimen barcode, enters the CBC values, and the pathologist digitally authorizes the verified report, which appears immediately on Dr. Ananya's screen."),
        ("Step 6: 4-Point Discharge & Financial Settlement", "When Rahul recovers, the system enforces our strict 4-Point Discharge Clearance: Doctor clinical clearance, Nursing custody clearance, Pharmacy return clearance, and Billing settlement. Total hospital charges equal ₹3,400. Because the family deposited a ₹5,000 advance, the system generates the tax invoice and automatically calculates a ₹1,600 cash refund. Upon discharge, Bed G-04 automatically switches to Orange for housekeeping sanitization."),
        ("Step 7: Double-Entry Accounting & Management Oversight", "Finally, in the Finance Suite, our cashier shift reconciles cash collections down to the rupee. The General Ledger automatically records balanced debits and credits, updating our live Profit & Loss statement. Branch Managers have a complete 360-degree monitoring cockpit with strict read-only controls to prevent record tampering.")
    ]

    for title, script in demo_steps:
        story.append(Paragraph(f"<b>{title}</b>", h3_style))
        story.append(Paragraph(f"<i>Speaker Script:</i> \"{script}\"", callout_style))
        story.append(Spacer(1, 4))

    story.append(PageBreak())

    # ---------------------------------------------------------
    # SECTION 10: BEGINNER'S GLOSSARY
    # ---------------------------------------------------------
    story.append(Paragraph("SECTION 10: Beginner's Glossary of Hospital Terms", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=c_teal, spaceAfter=10))

    glossary_data = [
        [Paragraph("Hospital Term", tbl_header), Paragraph("Simple Everyday Meaning", tbl_header)],
        [Paragraph("<b>OPD</b>", tbl_cell), Paragraph("<b>Outpatient Department:</b> For patients who visit for a consultation and go home the same day.", tbl_cell)],
        [Paragraph("<b>IPD</b>", tbl_cell), Paragraph("<b>Inpatient Department:</b> For patients admitted to a hospital bed for overnight observation or surgery.", tbl_cell)],
        [Paragraph("<b>MRN</b>", tbl_cell), Paragraph("<b>Medical Record Number:</b> The unique, permanent hospital identity card number assigned to a patient for life.", tbl_cell)],
        [Paragraph("<b>EMR</b>", tbl_cell), Paragraph("<b>Electronic Medical Record:</b> The digital chart storing patient illnesses, diagnoses, and prescriptions.", tbl_cell)],
        [Paragraph("<b>MAR</b>", tbl_cell), Paragraph("<b>Medication Administration Record:</b> The nursing log recording exactly which nurse gave which medicine at what time.", tbl_cell)],
        [Paragraph("<b>FEFO</b>", tbl_cell), Paragraph("<b>First Expiring, First Out:</b> Dispensing medicines that expire earliest first to eliminate pharmacy wastage.", tbl_cell)],
        [Paragraph("<b>ICD-10</b>", tbl_cell), Paragraph("<b>International Classification of Diseases:</b> Standardized global codes for medical diagnoses (e.g. A09 for gastroenteritis).", tbl_cell)],
        [Paragraph("<b>TPA</b>", tbl_cell), Paragraph("<b>Third Party Administrator:</b> The agency processing insurance authorizations between hospital and insurer.", tbl_cell)],
        [Paragraph("<b>Pre-Auth</b>", tbl_cell), Paragraph("<b>Pre-Authorization:</b> Advance written approval from an insurance company agreeing to cover a surgery bill.", tbl_cell)],
        [Paragraph("<b>Cashless</b>", tbl_cell), Paragraph("When the patient is treated without paying cash upfront because their approved insurance covers the bill.", tbl_cell)],
        [Paragraph("<b>PO & GRN</b>", tbl_cell), Paragraph("<b>Purchase Order & Goods Received Note:</b> The official order sent to a supplier and the verified warehouse receipt signed at the gate.", tbl_cell)],
        [Paragraph("<b>General Ledger</b>", tbl_cell), Paragraph("The master accounting book where every single financial debit and credit is permanently recorded.", tbl_cell)],
        [Paragraph("<b>RBAC</b>", tbl_cell), Paragraph("<b>Role-Based Access Control:</b> Digital permissions ensuring staff only access screens relevant to their job.", tbl_cell)],
        [Paragraph("<b>Discharge Summary</b>", tbl_cell), Paragraph("The official medical report given to a departing inpatient detailing treatments, tests, and home medicines.", tbl_cell)]
    ]

    t_glossary = Table(glossary_data, colWidths=[120, 390])
    t_glossary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_teal),
        ('GRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_bg_light]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(t_glossary)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Master PDF successfully generated at: {output_path}")

if __name__ == '__main__':
    target = os.path.join(r"c:\Users\Mohan\OneDrive\Desktop\Hospital", "AURA_HMS_COMPLETE_OPERATIONS_AND_TRAINING_MANUAL.pdf")
    create_manual(target)

