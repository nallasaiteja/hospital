from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from apps.core.models import Branch, Department
from apps.clinical.models import (
    Ward, WardType, Bed, BedStatus, OperatingTheatre,
    LabTestCatalogue, LabCategory
)
from apps.pharmacy_inventory.models import (
    Medicine, MedicineCategory, DosageForm, MedicineBatch,
    Supplier, HospitalAsset, AssetCategory
)
from apps.billing_finance.models import (
    AccountCategory, AccountCategoryType, ChartOfAccount,
    BankAccount, InsuranceProvider, FinancialAccount,
    FinancialAccountType, AccountingClassification,
    FinancialAccountTransaction
)


class Command(BaseCommand):
    help = 'Seeds clinical wards, beds, lab tests, medicine formulary, suppliers, chart of accounts, and insurance providers.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting hospital operations catalog seeding...'))

        main_branch = Branch.objects.filter(code='AURA-MAIN').first()
        if not main_branch:
            main_branch = Branch.objects.first()

        if not main_branch:
            self.stdout.write(self.style.ERROR('No branch found! Please run seed_hospital_core first.'))
            return

        south_branch = Branch.objects.filter(code='AURA-SOUTH').first() or main_branch

        # 1. Wards and Beds
        ward_specs = [
            ('General Medical Ward A', WardType.GENERAL, '1st Floor', 8, Decimal('1200.00')),
            ('Semi-Private Room Wing B', WardType.SEMI_PRIVATE, '2nd Floor', 6, Decimal('2800.00')),
            ('Private Deluxe Suite', WardType.PRIVATE, '3rd Floor', 4, Decimal('5500.00')),
            ('Critical Care ICU', WardType.ICU, '2nd Floor', 6, Decimal('8500.00')),
            ('Post-Surgical Recovery Wing', WardType.POST_OP, '1st Floor', 4, Decimal('3200.00')),
        ]

        total_beds_created = 0
        for ward_name, w_type, floor, bed_count, rate in ward_specs:
            ward, _ = Ward.objects.get_or_create(
                branch=main_branch,
                name=ward_name,
                defaults={'ward_type': w_type, 'floor': floor, 'total_beds': bed_count}
            )
            for i in range(1, bed_count + 1):
                bed_num = f"{ward_name[:3].upper()}-{i:02d}"
                bed, created = Bed.objects.get_or_create(
                    ward=ward,
                    bed_number=bed_num,
                    defaults={'daily_rate': rate, 'status': BedStatus.AVAILABLE}
                )
                if created:
                    total_beds_created += 1

        self.stdout.write(self.style.SUCCESS(f"Seeded wards and {total_beds_created} available beds."))

        # 2. Operating Theatres
        ot_specs = [
            ('Modular Surgery Suite 1 (General & Laparoscopy)', 'OT-01'),
            ('Cardiovascular & Thoracic OT Suite 2', 'OT-02'),
            ('Emergency Trauma Operating Theatre', 'OT-03'),
        ]
        for name, room in ot_specs:
            OperatingTheatre.objects.get_or_create(
                branch=main_branch,
                room_number=room,
                defaults={'name': name, 'status': 'AVAILABLE'}
            )
        self.stdout.write(self.style.SUCCESS("Seeded Operating Theatres."))

        # 3. Lab Test Catalogue
        lab_tests = [
            ('LAB-CBC', 'Complete Blood Count (CBC) with ESR', LabCategory.HEMATOLOGY, 'Whole Blood (EDTA)', Decimal('450.00'), 2, 'Hb: 12-16 g/dL, WBC: 4000-11000 /cumm', 'g/dL'),
            ('LAB-LIPID', 'Comprehensive Lipid Profile', LabCategory.BIOCHEMISTRY, 'Serum', Decimal('750.00'), 4, 'Total Chol: <200 mg/dL, HDL: >40 mg/dL', 'mg/dL'),
            ('LAB-LFT', 'Liver Function Test (LFT Panel)', LabCategory.BIOCHEMISTRY, 'Serum', Decimal('800.00'), 4, 'Bilirubin: 0.2-1.2 mg/dL, SGOT/AST: <40 U/L', 'U/L'),
            ('LAB-KFT', 'Renal Function Test (BUN & Creatinine)', LabCategory.BIOCHEMISTRY, 'Serum', Decimal('650.00'), 3, 'Creatinine: 0.6-1.2 mg/dL, Urea: 15-40 mg/dL', 'mg/dL'),
            ('LAB-HBA1C', 'Glycated Hemoglobin (HbA1c)', LabCategory.BIOCHEMISTRY, 'Whole Blood (EDTA)', Decimal('550.00'), 3, 'Normal: <5.7%, Diabetic: >6.5%', '%'),
            ('LAB-TROP', 'Serum Troponin-I High Sensitivity (Cardiac Stat)', LabCategory.BIOCHEMISTRY, 'Serum', Decimal('1200.00'), 1, 'Negative: <0.04 ng/mL', 'ng/mL'),
            ('LAB-URINE', 'Urine Routine & Microscopic Examination', LabCategory.PATHOLOGY, 'Mid-stream Urine', Decimal('250.00'), 2, 'Pus cells: 0-2 /hpf, Albumin: Nil', '/hpf'),
            ('LAB-THYROID', 'Thyroid Profile (Total T3, T4, TSH)', LabCategory.IMMUNOLOGY, 'Serum', Decimal('850.00'), 6, 'TSH: 0.4-4.5 uIU/mL', 'uIU/mL'),
        ]
        for code, name, cat, sample, rate, hours, ref, unit in lab_tests:
            LabTestCatalogue.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'category': cat,
                    'sample_type': sample,
                    'standard_rate': rate,
                    'turnaround_hours': hours,
                    'reference_range': ref,
                    'unit_of_measurement': unit,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded master Lab Test Catalogue."))

        # 4. Medicine Formulary & Batches
        medicines = [
            ('MED-AMX500', 'Amoxicillin Trihydrate', 'Augmentin Duo / Amoxycillin', MedicineCategory.ANTIBIOTICS, DosageForm.TABLET, '500mg', 100, Decimal('12.50'), Decimal('18.00')),
            ('MED-PCM650', 'Paracetamol / Acetaminophen', 'Dolo 650', MedicineCategory.ANALGESICS, DosageForm.TABLET, '650mg', 200, Decimal('2.00'), Decimal('3.50')),
            ('MED-PAN40', 'Pantoprazole Sodium', 'Pan 40', MedicineCategory.GASTROINTESTINAL, DosageForm.TABLET, '40mg', 150, Decimal('6.00'), Decimal('10.00')),
            ('MED-MET500', 'Metformin Hydrochloride', 'Glycomet 500', MedicineCategory.ENDOCRINE, DosageForm.TABLET, '500mg', 150, Decimal('3.00'), Decimal('5.50')),
            ('MED-ATV20', 'Atorvastatin Calcium', 'Atorva 20', MedicineCategory.CARDIOVASCULAR, DosageForm.TABLET, '20mg', 100, Decimal('8.00'), Decimal('14.00')),
            ('MED-CEF1G', 'Ceftriaxone Sodium Injection', 'Monocef 1g', MedicineCategory.ANTIBIOTICS, DosageForm.INJECTION, '1g Vial', 80, Decimal('45.00'), Decimal('72.00')),
            ('MED-NS500', 'Normal Saline 0.9%', 'Baxter NS 500ml', MedicineCategory.IV_FLUIDS, DosageForm.SYRUP, '500ml IV Bottle', 120, Decimal('28.00'), Decimal('45.00')),
            ('MED-SALB', 'Salbutamol Inhaler 100mcg', 'Asthalin Inhaler', MedicineCategory.RESPIRATORY, DosageForm.INHALER, '200 Doses', 40, Decimal('95.00'), Decimal('145.00')),
        ]

        exp_date = timezone.now().date().replace(year=timezone.now().year + 2)
        for code, generic, brand, cat, dosage, strength, reorder, cost, price in medicines:
            med, _ = Medicine.objects.update_or_create(
                code=code,
                defaults={
                    'generic_name': generic,
                    'brand_name': brand,
                    'category': cat,
                    'dosage_form': dosage,
                    'strength': strength,
                    'reorder_level': reorder,
                    'is_prescription_required': True,
                }
            )
            # Create branch stock batch
            MedicineBatch.objects.update_or_create(
                branch=main_branch,
                medicine=med,
                batch_number=f"BAT-{code[-4:]}-26A",
                defaults={
                    'expiry_date': exp_date,
                    'quantity_in_stock': 250,
                    'unit_purchase_cost': cost,
                    'unit_selling_price': price,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded medicine formulary and active stock batches."))

        # 5. Suppliers
        suppliers = [
            ('SUP-001', 'Apex Healthcare & Pharma Distributors', 'Rajesh Gupta', '+91 98112 34567', 'sales@apexpharma.in', 'GSTIN07AAACA1234F1Z5'),
            ('SUP-002', 'Global Surgicals & Diagnostic Supplies Ltd', 'Sunita Mehta', '+91 98220 54321', 'orders@globalsurgicals.com', 'GSTIN27AABCS9876D1Z2'),
        ]
        for code, name, contact, phone, email, tax_id in suppliers:
            Supplier.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'contact_person': contact,
                    'phone': phone,
                    'email': email,
                    'gst_or_tax_id': tax_id,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded medical suppliers."))

        # 6. Chart of Accounts Categories and Accounts
        acc_cats = [
            ('1000', 'Current Assets', AccountCategoryType.ASSET),
            ('1500', 'Fixed / Capital Assets', AccountCategoryType.ASSET),
            ('2000', 'Current Liabilities & Payables', AccountCategoryType.LIABILITY),
            ('3000', 'Hospital Equity & Reserves', AccountCategoryType.EQUITY),
            ('4000', 'Clinical Operating Revenue', AccountCategoryType.REVENUE),
            ('5000', 'Operating & Administrative Expenses', AccountCategoryType.EXPENSE),
        ]
        cat_objs = {}
        for code, name, c_type in acc_cats:
            cat, _ = AccountCategory.objects.update_or_create(
                code=code,
                defaults={'name': name, 'category_type': c_type}
            )
            cat_objs[code] = cat

        coa_list = [
            ('1010', 'Cash in Hand (Front Desk & Cashier)', '1000', Decimal('45000.00'), True),
            ('1020', 'HDFC Bank Healthcare Operating Account', '1000', Decimal('3850000.00'), True),
            ('1030', 'Patient Accounts Receivable', '1000', Decimal('240000.00'), False),
            ('1040', 'TPA Insurance Claims Receivable', '1000', Decimal('480000.00'), False),
            ('1050', 'Pharmacy Inventory Stock Asset', '1000', Decimal('620000.00'), False),
            ('1510', 'Medical Diagnostic Equipment Asset', '1500', Decimal('12500000.00'), False),
            ('2010', 'Accounts Payable (Vendors & Suppliers)', '2000', Decimal('180000.00'), False),
            ('3010', 'Retained Earnings & Hospital Capital', '3000', Decimal('15000000.00'), False),
            ('4010', 'OPD Consultation Revenue', '4000', Decimal('950000.00'), False),
            ('4020', 'IPD Ward & Bed Charges Revenue', '4000', Decimal('1450000.00'), False),
            ('4030', 'Diagnostic Pathology Lab Revenue', '4000', Decimal('680000.00'), False),
            ('4040', 'Pharmacy Sales Revenue', '4000', Decimal('590000.00'), False),
            ('5010', 'Staff Salaries & Nursing Payroll Expense', '5000', Decimal('1200000.00'), False),
            ('5020', 'Hospital Utilities & Electricity Expense', '5000', Decimal('145000.00'), False),
        ]
        for acc_code, name, cat_code, balance, is_recon in coa_list:
            ChartOfAccount.objects.update_or_create(
                account_code=acc_code,
                defaults={
                    'name': name,
                    'category': cat_objs[cat_code],
                    'branch': main_branch,
                    'current_balance': balance,
                    'is_reconcilable': is_recon,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded Chart of Accounts."))

        # 7. Bank Accounts
        BankAccount.objects.update_or_create(
            account_number='50200012345678',
            defaults={
                'bank_name': 'HDFC Bank - Healthcare Corporate Banking',
                'branch_code': 'Connaught Place Main',
                'ifsc_code': 'HDFC0000123',
                'current_balance': Decimal('3850000.00'),
            }
        )
        BankAccount.objects.update_or_create(
            account_number='000405012345',
            defaults={
                'bank_name': 'ICICI Bank - Treasury & Escrow Account',
                'branch_code': 'Barakhamba Road',
                'ifsc_code': 'ICIC0000004',
                'current_balance': Decimal('2100000.00'),
            }
        )
        self.stdout.write(self.style.SUCCESS("Seeded Bank Accounts."))

        # 7b. Section 13 Financial Accounts Master (12 Categories)
        accounts_seed = [
            ('FA-BNK-HDFC', 'HDFC Bank Corporate Operating Account', FinancialAccountType.BANK, AccountingClassification.ASSET, 'HDFC Bank Ltd.', '50200012345678', 'Connaught Place Main', 'HDFC0000123', Decimal('3850000.00')),
            ('FA-BNK-ICICI', 'ICICI Bank Treasury & Escrow Account', FinancialAccountType.BANK, AccountingClassification.ASSET, 'ICICI Bank Ltd.', '000405012345', 'Barakhamba Road', 'ICIC0000004', Decimal('2100000.00')),
            ('FA-CSH-MAIN', 'Hospital Main Cash Desk (OPD & Pharmacy)', FinancialAccountType.CASH, AccountingClassification.ASSET, '', '', 'Ground Floor Central Counter', '', Decimal('145000.00')),
            ('FA-CSH-PETTY', 'Emergency & Clinical Petty Cash Float', FinancialAccountType.PETTY_CASH, AccountingClassification.ASSET, '', '', 'Emergency Triage', '', Decimal('25000.00')),
            ('FA-PG-RAZOR', 'Razorpay Payment Gateway Clearing Account', FinancialAccountType.GATEWAY_CLEARING, AccountingClassification.ASSET, 'Razorpay Software Pvt. Ltd.', 'MID-RAZOR-998811', 'Gateway Virtual Clearing', '', Decimal('420000.00')),
            ('FA-UPI-SETTLE', 'Hospital Dynamic UPI Settlement Account', FinancialAccountType.UPI_SETTLEMENT, AccountingClassification.ASSET, 'NPCI / Axis Bank', 'VPA-HOSPITAL@AXIS', 'Virtual UPI Node', '', Decimal('180000.00')),
            ('FA-CRD-POS', 'POS Credit/Debit Card Terminal Clearing', FinancialAccountType.CARD_SETTLEMENT, AccountingClassification.ASSET, 'PineLabs / HDFC POS', 'TID-98765432', 'Billing Counters', '', Decimal('310000.00')),
            ('FA-INV-TREAS', 'Hospital Treasury & Liquid Mutual Funds', FinancialAccountType.INVESTMENT, AccountingClassification.ASSET, 'HDFC AMC / Zerodha', 'INV-TREAS-887766', 'Treasury Desk', '', Decimal('5000000.00')),
            ('FA-FD-SBI', 'State Bank of India Fixed Deposit Account', FinancialAccountType.FIXED_DEPOSIT, AccountingClassification.ASSET, 'State Bank of India', 'FD-3988221100', 'Parliament Street', 'SBIN0000691', Decimal('7500000.00')),
            ('FA-LN-EQUIP', 'Medical Equipment Term Financing Facility', FinancialAccountType.LOAN_FACILITY, AccountingClassification.LIABILITY, 'Siemens Healthcare Financial Services', 'LN-EQUIP-2024-001', 'Commercial Finance', '', Decimal('6500000.00')),
            ('FA-DEP-PAT', 'Inpatient Advance & Procedure Deposit Liabilities', FinancialAccountType.PATIENT_DEPOSIT_LIABILITY, AccountingClassification.LIABILITY, 'Apex Hospital Treasury', 'DEP-LIAB-INTERNAL', 'Inpatient Billing', '', Decimal('890000.00')),
            ('FA-REC-INS', 'Empanelled TPA & Corporate Insurance Receivables', FinancialAccountType.INSURANCE_RECEIVABLE, AccountingClassification.ASSET, 'TPA Empanelled Desk', 'TPA-REC-CONTROL', 'Insurance & Claims', '', Decimal('1420000.00')),
            ('FA-PAY-SUPP', 'Pharmacy & Medical Consumables Supplier Payables', FinancialAccountType.SUPPLIER_PAYABLE, AccountingClassification.LIABILITY, 'Hospital Procurement Cell', 'AP-SUPP-CONTROL', 'Procurement & Stores', '', Decimal('1150000.00')),
        ]
        for code, name, acc_type, cls_type, inst, acc_no, branch_str, ifsc, bal in accounts_seed:
            fa, created = FinancialAccount.objects.update_or_create(
                account_code=code,
                defaults={
                    'name': name,
                    'account_type': acc_type,
                    'classification': cls_type,
                    'institution_name': inst,
                    'account_number_raw': acc_no,
                    'branch_name': branch_str,
                    'ifsc_code': ifsc,
                    'branch': main_branch,
                    'opening_balance': bal,
                    'opening_balance_date': timezone.localdate(),
                    'current_balance': bal,
                    'is_active': True
                }
            )
            # Create opening balance transaction if created
            if created and bal > Decimal('0.00'):
                is_asset = cls_type == AccountingClassification.ASSET
                FinancialAccountTransaction.objects.get_or_create(
                    account=fa,
                    transaction_number=f"OB-{code}-INIT",
                    defaults={
                        'transaction_date': timezone.localdate(),
                        'accounting_date': timezone.localdate(),
                        'category': 'OPENING_BALANCE',
                        'description': f"Initial Opening Balance for {name}",
                        'debit_amount': bal if is_asset else Decimal('0.00'),
                        'credit_amount': Decimal('0.00') if is_asset else bal,
                        'payment_method': 'SYSTEM_INIT',
                        'reference_number': f"INIT-{code}",
                        'posting_status': 'POSTED'
                    }
                )
        self.stdout.write(self.style.SUCCESS("Seeded Section 13 Financial Accounts Master across 12 classifications."))


        # 8. Insurance Providers
        insurers = [
            ('INS-STAR', 'Star Health and Allied Insurance Co. Ltd.', 'Rohit Verma', '+91 98100 11223', 'claims@starhealth.in', 10),
            ('INS-ICICI', 'ICICI Lombard General Insurance', 'Kavita Iyer', '+91 98200 22334', 'healthclaims@icicilombard.com', 12),
            ('INS-HDFC', 'HDFC ERGO General Insurance Company', 'Vikram Singh', '+91 98300 33445', 'preauth@hdfcergo.com', 8),
            ('INS-NIVA', 'Niva Bupa Health Insurance (Max Bupa)', 'Neha Deshmukh', '+91 98400 44556', 'tpa@nivabupa.com', 14),
        ]
        for code, name, contact, phone, email, avg_days in insurers:
            InsuranceProvider.objects.update_or_create(
                code=code,
                defaults={
                    'name': name,
                    'contact_person': contact,
                    'phone': phone,
                    'email': email,
                    'tpa_desk_email': email,
                    'claim_settlement_avg_days': avg_days,
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded Insurance Providers."))

        # 9. Hospital Assets
        assets = [
            ('AST-USG-01', 'GE Voluson E10 4D Ultrasound System', AssetCategory.BIOMEDICAL, 'Radiology', Decimal('4200000.00')),
            ('AST-DEF-01', 'Philips HeartStart MRx Biphasic Defibrillator', AssetCategory.BIOMEDICAL, 'Emergency & Trauma', Decimal('380000.00')),
            ('AST-XRAY-01', 'Siemens Multix Impact Digital Radiography System', AssetCategory.BIOMEDICAL, 'Radiology', Decimal('2900000.00')),
            ('AST-VENT-01', 'Hamilton Medical C6 High-End ICU Ventilator', AssetCategory.BIOMEDICAL, 'Intensive Care Unit (ICU)', Decimal('850000.00')),
            ('AST-GEN-01', 'Cummins 250kVA Emergency Diesel Generator', AssetCategory.FACILITY, 'Hospital Administration', Decimal('1650000.00')),
        ]
        dept_cache = {d.name: d for d in Department.objects.all()}
        for tag, name, cat, dept_name, cost in assets:
            dept = dept_cache.get(dept_name)
            HospitalAsset.objects.update_or_create(
                asset_tag=tag,
                defaults={
                    'name': name,
                    'category': cat,
                    'branch': main_branch,
                    'department': dept,
                    'purchase_date': timezone.now().date().replace(year=2024, month=4, day=1),
                    'purchase_cost': cost,
                    'status': 'OPERATIONAL',
                }
            )
        self.stdout.write(self.style.SUCCESS("Seeded Hospital Capital Assets."))

        self.stdout.write(self.style.SUCCESS('Hospital operations catalogs successfully seeded!'))
