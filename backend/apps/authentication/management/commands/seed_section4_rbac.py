import uuid
from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.authentication.models import (
    Role, RoleEnum, Permission,
    FinancialApprovalPolicy, FinancialOperationType,
    SecurityAuditEvent, SecurityEventType
)

class Command(BaseCommand):
    help = "Seeds all 21 PDF-defined roles, granular permissions, and financial approval policies."

    def handle(self, *args, **options):
        self.stdout.write("Starting Section 4 RBAC and Permissions seeding...")

        # 1. DEFINE ALL 21 PDF ROLES (Exact Names)
        ROLES_DATA = [
            (RoleEnum.SUPER_ADMIN, "Super Administrator", "System-wide configuration, branch oversight, and master administrative access."),
            (RoleEnum.HOSPITAL_ADMIN, "Hospital Administrator", "Hospital operational management, branch governance, and staff access oversight."),
            (RoleEnum.BRANCH_MANAGER, "Branch Manager (Hospital Administrator)", "Branch administrative head and operational manager."),
            (RoleEnum.MEDICAL_DIRECTOR, "Medical Director", "Authorized clinical operations oversight, treatment protocols, and clinical report review."),
            (RoleEnum.DOCTOR, "Doctor", "Assigned patient records, OPD/IPD consultations, diagnoses, treatment plans, and prescriptions."),
            (RoleEnum.NURSE, "Nurse", "Patient-care workflows, vitals charting, nursing observations, and bed care administration."),
            (RoleEnum.RECEPTIONIST, "Receptionist", "Patient registration, appointment scheduling, token generation, and front-desk coordination."),
            (RoleEnum.BILLING_EXECUTIVE, "Billing Executive", "Invoice preparation, charge calculation, billing adjustments, and receipt management."),
            (RoleEnum.LAB_TECHNICIAN, "Laboratory Technician", "Laboratory test order processing, specimen tracking, and diagnostic results recording."),
            (RoleEnum.RADIOLOGY_TECHNICIAN, "Radiology Technician", "Imaging orders, DICOM studies, and radiological technical procedures."),
            (RoleEnum.PHARMACIST, "Pharmacist", "Prescription fulfillment, medication dispensing, and pharmacy stock reconciliation."),
            (RoleEnum.INVENTORY_MANAGER, "Inventory Manager", "Medical stock, batches, expiry tracking, stock movements, and inventory auditing."),
            (RoleEnum.PROCUREMENT_OFFICER, "Procurement Officer", "Purchase requisitions, vendor management, purchase orders, and procurement approvals."),
            (RoleEnum.ACCOUNTANT, "Accountant", "Double-entry journal records, accounts reconciliation, bank statements, and general ledger."),
            (RoleEnum.FINANCE_MANAGER, "Finance Manager", "Financial performance oversight, transaction approvals, expenditure limits, and separation of duties."),
            (RoleEnum.INVESTMENT_MANAGER, "Investment Manager", "Hospital treasury investments, fixed deposits, maturities, and portfolio yield reports."),
            (RoleEnum.CASHIER, "Cashier", "Cash counter receipts, electronic payments, interim deposits, and settlement reconciliation."),
            (RoleEnum.INSURANCE_COORDINATOR, "Insurance Coordinator", "Cashless TPA pre-authorizations, insurance claims documentation, and settlement tracking."),
            (RoleEnum.HR_MANAGER, "HR Manager", "Employee profiles, attendance, leave approvals, and hospital human resources administration."),
            (RoleEnum.DEPARTMENT_HEAD, "Department Head", "Clinical or administrative department supervision, duty rosters, and departmental analytics."),
            (RoleEnum.AUDITOR, "Auditor", "Read-only compliance auditing, ledger verification, and immutable security audit trails."),
            (RoleEnum.PATIENT, "Patient", "Personal medical portal, self appointments, prescriptions, diagnostic reports, and invoices.")
        ]

        roles_map = {}
        for code, display_name, desc in ROLES_DATA:
            role, created = Role.objects.update_or_create(
                name=code,
                defaults={
                    'display_name': display_name,
                    'description': desc,
                }
            )
            roles_map[code] = role
            self.stdout.write(f"  {'Created' if created else 'Updated'} Role: {display_name} ({code})")

        # 2. DEFINE GRANULAR MODULES & ACTIONS
        MODULES = [
            ('dashboard', 'Dashboard & Census'),
            ('patients', 'Patient Management & EMR'),
            ('opd', 'OPD & Appointments'),
            ('emergency', 'Emergency & Casualty'),
            ('ipd', 'IPD & Bed Management'),
            ('clinical', 'Clinical & Consultations'),
            ('nursing', 'Nursing & Vitals'),
            ('lab', 'Laboratory & Diagnostics'),
            ('radiology', 'Radiology & Imaging'),
            ('pharmacy', 'Pharmacy & Dispensing'),
            ('inventory', 'Inventory & Procurement'),
            ('ot_icu', 'Operation Theatre & ICU'),
            ('billing', 'Billing, Invoices & Payments'),
            ('insurance', 'Insurance & Claims'),
            ('accounts', 'Accounting & General Ledger'),
            ('investments', 'Treasury & Investments'),
            ('banking', 'Banking & Reconciliation'),
            ('loans', 'Loans & Liabilities'),
            ('budgets', 'Budgets & Financial Planning'),
            ('hr', 'HR, Staff & Payroll'),
            ('assets', 'Assets & Equipment'),
            ('reports', 'Reports & Business Intelligence'),
            ('admin', 'User, Role & System Administration'),
            ('audit', 'Audit Logs & Security Compliance'),
        ]

        ACTIONS = [
            ('view', 'View Records'),
            ('create', 'Create Records'),
            ('edit', 'Edit Records'),
            ('approve', 'Approve Records & Orders'),
            ('post', 'Post Financial & Ledger Transactions'),
            ('reverse', 'Reverse Transactions & Refunds'),
            ('export', 'Export Reports & Datasets'),
            ('administer', 'Administer Configuration'),
        ]

        perms_map = {}
        for mod_code, mod_name in MODULES:
            for act_code, act_name in ACTIONS:
                p_code = f"{mod_code}:{act_code}"
                p_name = f"{act_name} in {mod_name}"
                p_desc = f"Allows staff to {act_code} records in {mod_name}."
                perm, _ = Permission.objects.update_or_create(
                    code=p_code,
                    defaults={'name': p_name, 'module': mod_code, 'description': p_desc}
                )
                perms_map[p_code] = perm

        self.stdout.write(f"Seeded {len(perms_map)} granular permission tokens.")

        # 3. CONFIGURE ROLE-PERMISSION MAPPINGS
        # Helper to assign perms
        def grant(role_code, *perm_patterns):
            r = roles_map[role_code]
            selected_perms = []
            for pat in perm_patterns:
                if pat.endswith(':*'):
                    mod = pat.split(':')[0]
                    selected_perms.extend([p for code, p in perms_map.items() if code.startswith(f"{mod}:")])
                elif pat == '*:*':
                    selected_perms.extend(list(perms_map.values()))
                elif pat in perms_map:
                    selected_perms.append(perms_map[pat])
            r.permissions.set(selected_perms)

        # Super Admin gets everything
        grant(RoleEnum.SUPER_ADMIN, '*:*')

        # Hospital Administrator
        grant(RoleEnum.HOSPITAL_ADMIN,
              'dashboard:*', 'patients:*', 'opd:*', 'emergency:*', 'ipd:*',
              'clinical:view', 'nursing:view', 'lab:*', 'radiology:*', 'pharmacy:*',
              'inventory:*', 'ot_icu:*', 'billing:*', 'insurance:*', 'accounts:view',
              'accounts:approve', 'banking:view', 'budgets:*', 'hr:*', 'assets:*',
              'reports:*', 'admin:*', 'audit:view')

        # Branch Manager (synonym to Hospital Admin)
        grant(RoleEnum.BRANCH_MANAGER,
              'dashboard:*', 'patients:*', 'opd:*', 'emergency:*', 'ipd:*',
              'clinical:view', 'nursing:view', 'lab:*', 'radiology:*', 'pharmacy:*',
              'inventory:*', 'ot_icu:*', 'billing:*', 'insurance:*', 'accounts:view',
              'budgets:view', 'hr:*', 'assets:*', 'reports:*', 'audit:view')

        # Medical Director
        grant(RoleEnum.MEDICAL_DIRECTOR,
              'dashboard:view', 'patients:*', 'opd:*', 'emergency:*', 'ipd:*',
              'clinical:*', 'nursing:*', 'lab:*', 'radiology:*', 'pharmacy:view',
              'ot_icu:*', 'reports:view', 'audit:view')

        # Doctor
        grant(RoleEnum.DOCTOR,
              'dashboard:view', 'patients:view', 'patients:edit', 'opd:*', 'emergency:*',
              'ipd:view', 'clinical:*', 'nursing:view', 'lab:view', 'lab:create',
              'radiology:view', 'radiology:create', 'pharmacy:view', 'ot_icu:view',
              'ot_icu:edit', 'reports:view')

        # Nurse
        grant(RoleEnum.NURSE,
              'dashboard:view', 'patients:view', 'opd:view', 'emergency:view',
              'emergency:edit', 'ipd:*', 'nursing:*', 'clinical:view', 'pharmacy:view',
              'lab:view', 'lab:create', 'ot_icu:view')

        # Receptionist
        grant(RoleEnum.RECEPTIONIST,
              'dashboard:view', 'patients:view', 'patients:create', 'patients:edit',
              'opd:view', 'opd:create', 'emergency:view', 'emergency:create',
              'billing:view', 'billing:create')

        # Billing Executive
        grant(RoleEnum.BILLING_EXECUTIVE,
              'dashboard:view', 'patients:view', 'billing:*', 'insurance:view',
              'insurance:create', 'reports:view')

        # Laboratory Technician
        grant(RoleEnum.LAB_TECHNICIAN,
              'dashboard:view', 'lab:*', 'patients:view')

        # Radiology Technician
        grant(RoleEnum.RADIOLOGY_TECHNICIAN,
              'dashboard:view', 'radiology:*', 'patients:view')

        # Pharmacist
        grant(RoleEnum.PHARMACIST,
              'dashboard:view', 'pharmacy:*', 'inventory:view', 'patients:view')

        # Inventory Manager
        grant(RoleEnum.INVENTORY_MANAGER,
              'dashboard:view', 'inventory:*', 'pharmacy:view', 'assets:view', 'reports:view')

        # Procurement Officer
        grant(RoleEnum.PROCUREMENT_OFFICER,
              'dashboard:view', 'inventory:*', 'assets:view', 'accounts:view')

        # Accountant
        grant(RoleEnum.ACCOUNTANT,
              'dashboard:view', 'accounts:*', 'banking:*', 'billing:view',
              'loans:view', 'budgets:view', 'reports:*')

        # Finance Manager
        grant(RoleEnum.FINANCE_MANAGER,
              'dashboard:*', 'accounts:*', 'banking:*', 'billing:*', 'insurance:*',
              'investments:*', 'loans:*', 'budgets:*', 'reports:*', 'audit:view')

        # Investment Manager
        grant(RoleEnum.INVESTMENT_MANAGER,
              'dashboard:view', 'investments:*', 'banking:view', 'reports:view')

        # Cashier
        grant(RoleEnum.CASHIER,
              'dashboard:view', 'billing:view', 'billing:create', 'billing:post',
              'patients:view')

        # Insurance Coordinator
        grant(RoleEnum.INSURANCE_COORDINATOR,
              'dashboard:view', 'insurance:*', 'billing:view', 'patients:view', 'reports:view')

        # HR Manager
        grant(RoleEnum.HR_MANAGER,
              'dashboard:view', 'hr:*', 'reports:view', 'audit:view')

        # Department Head
        grant(RoleEnum.DEPARTMENT_HEAD,
              'dashboard:view', 'patients:view', 'opd:view', 'clinical:view',
              'ipd:view', 'nursing:view', 'hr:view', 'budgets:view', 'reports:*')

        # Auditor (Strictly Read-Only Access across Financial, Clinical, Operational)
        grant(RoleEnum.AUDITOR,
              'dashboard:view', 'patients:view', 'billing:view', 'insurance:view',
              'accounts:view', 'investments:view', 'banking:view', 'loans:view',
              'budgets:view', 'hr:view', 'reports:view', 'audit:*')

        # Patient (Self-Service Portal Only)
        grant(RoleEnum.PATIENT,
              'patients:view', 'opd:view', 'opd:create', 'clinical:view',
              'pharmacy:view', 'lab:view', 'radiology:view', 'billing:view')

        self.stdout.write("Granted role-permission assignments to all 21 PDF roles.")

        # 4. SEED FINANCIAL APPROVAL POLICIES (Separation of Duties Enforced)
        POLICIES = [
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('0.00'), Decimal('10000.00'), RoleEnum.BILLING_EXECUTIVE, True, "Routine invoice discounts up to ₹10,000"),
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('10000.01'), Decimal('50000.00'), RoleEnum.FINANCE_MANAGER, True, "Major invoice adjustments requiring Finance Manager approval"),
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('50000.01'), None, RoleEnum.HOSPITAL_ADMIN, True, "Critical adjustments > ₹50,000 requiring Hospital Administrator approval"),
            (FinancialOperationType.REFUND_REVERSAL, Decimal('0.00'), Decimal('5000.00'), RoleEnum.ACCOUNTANT, True, "Patient refunds up to ₹5,000 (Cashier cannot approve self)"),
            (FinancialOperationType.REFUND_REVERSAL, Decimal('5000.01'), None, RoleEnum.FINANCE_MANAGER, True, "High-value patient refunds requiring Finance Manager approval"),
            (FinancialOperationType.SUPPLIER_PAYMENT, Decimal('0.00'), Decimal('100000.00'), RoleEnum.FINANCE_MANAGER, True, "Supplier invoices up to ₹1,00,000 approved by Finance Manager"),
            (FinancialOperationType.SUPPLIER_PAYMENT, Decimal('100000.01'), None, RoleEnum.HOSPITAL_ADMIN, True, "Large supplier payments > ₹1,00,000 approved by Hospital Administrator"),
            (FinancialOperationType.PURCHASE_APPROVAL, Decimal('0.00'), Decimal('50000.00'), RoleEnum.PROCUREMENT_OFFICER, True, "Standard purchase requisitions up to ₹50,000"),
            (FinancialOperationType.PURCHASE_APPROVAL, Decimal('50000.01'), None, RoleEnum.FINANCE_MANAGER, True, "Capital purchase orders > ₹50,000 requiring Finance Manager authorization"),
            (FinancialOperationType.JOURNAL_POSTING, Decimal('0.00'), Decimal('250000.00'), RoleEnum.ACCOUNTANT, True, "Standard GL journal posting (Creator cannot post)"),
            (FinancialOperationType.JOURNAL_POSTING, Decimal('250000.01'), None, RoleEnum.FINANCE_MANAGER, True, "Large GL journal entries > ₹2,50,000 approved by Finance Manager"),
            (FinancialOperationType.INVESTMENT_TRANSACTION, Decimal('0.00'), None, RoleEnum.INVESTMENT_MANAGER, True, "Treasury & Fixed Deposit liquidation authorized by Investment Manager"),
            (FinancialOperationType.WRITE_OFF, Decimal('0.00'), None, RoleEnum.HOSPITAL_ADMIN, True, "Bad debt and medicine inventory write-offs approved by Hospital Administrator"),
        ]

        for op_type, min_amt, max_amt, approver_code, sep_duties, desc in POLICIES:
            FinancialApprovalPolicy.objects.update_or_create(
                operation_type=op_type,
                min_amount=min_amt,
                max_amount=max_amt,
                defaults={
                    'approver_role': roles_map[approver_code],
                    'requires_separation_of_duties': sep_duties,
                    'description': desc,
                }
            )

        self.stdout.write(f"Seeded {len(POLICIES)} financial approval limit policies.")

        # 5. RECORD INITIAL AUDIT EVENT
        SecurityAuditEvent.objects.create(
            event_type=SecurityEventType.PERMISSIONS_UPDATED,
            actor_email='system@aurahms.org',
            details={'message': 'Section 4 master prompt: 21 PDF roles and granular permissions initialized.'}
        )

        self.stdout.write(self.style.SUCCESS("Section 4 RBAC & Permissions Seeding Completed Successfully!"))
