from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.authentication.models import (
    Role, RoleEnum, Permission,
    FinancialApprovalPolicy, FinancialOperationType,
    SecurityAuditEvent, SecurityEventType
)
from apps.authentication.rbac_matrix import ROLE_MODULE_ACTIONS


class Command(BaseCommand):
    help = "Seeds all 22 organizational roles, 3D RBAC permissions, and separation-of-duties financial policies."

    def handle(self, *args, **options):
        self.stdout.write("Starting Master RBAC and Permissions seeding...")

        ROLES_DATA = [
            (RoleEnum.SUPER_ADMIN, "Super Administrator", "Overall system administration, branch/department governance, and security settings."),
            (RoleEnum.HOSPITAL_ADMIN, "Hospital Administrator", "Read-only branch operations monitoring across authorized hospital departments and activity logs."),
            (RoleEnum.BRANCH_MANAGER, "Branch Manager", "Read-only branch operations monitoring across all 9 branch operational domains and activity logs."),
            (RoleEnum.MEDICAL_DIRECTOR, "Medical Director", "Clinical governance, medical quality oversight, OPD/IPD metrics, and clinical audit review."),
            (RoleEnum.DEPARTMENT_HEAD, "Department Head", "Departmental supervision, staff attendance, shift rosters, workload monitoring, and leave approvals."),
            (RoleEnum.DOCTOR, "Doctor", "Assigned patient records, OPD/IPD consultations, diagnoses, treatment plans, and prescriptions."),
            (RoleEnum.NURSE, "Nurse", "Patient nursing care, vitals charting, nursing notes, medication administration, and shift handover."),
            (RoleEnum.RECEPTIONIST, "Receptionist", "Front-office patient registration, appointment management, OPD/IPD admission initiation."),
            (RoleEnum.BILLING_EXECUTIVE, "Billing Executive", "Invoice preparation, charge calculation, billing adjustments, and receipt initiation."),
            (RoleEnum.LAB_TECHNICIAN, "Laboratory Technician", "Laboratory test order processing, sample tracking, result entry, and report verification."),
            (RoleEnum.RADIOLOGY_TECHNICIAN, "Radiology Technician", "Imaging orders, DICOM studies, and radiological technical procedures."),
            (RoleEnum.PHARMACIST, "Pharmacist", "Prescription review, medication dispensing, batch/expiry tracking, and pharmacy stock management."),
            (RoleEnum.INVENTORY_MANAGER, "Inventory Manager", "Medical stock, batches, expiry tracking, stock movements, and inventory auditing."),
            (RoleEnum.PROCUREMENT_OFFICER, "Procurement Officer", "Purchase requisitions, vendor management, and purchase order preparation."),
            (RoleEnum.ACCOUNTANT, "Accountant", "Double-entry journal records, accounts reconciliation, bank statements, and general ledger."),
            (RoleEnum.FINANCE_MANAGER, "Finance Manager", "Financial performance oversight, transaction approvals, payroll disbursement, and separation of duties."),
            (RoleEnum.INVESTMENT_MANAGER, "Investment Manager", "Hospital treasury investments, fixed deposits, maturities, and portfolio yield reports."),
            (RoleEnum.CASHIER, "Cashier", "Cash counter receipts, electronic payments, interim deposits, and settlement reconciliation."),
            (RoleEnum.INSURANCE_COORDINATOR, "Insurance Coordinator", "Cashless TPA pre-authorizations, insurance claims documentation, and settlement tracking."),
            (RoleEnum.HR_MANAGER, "HR Manager", "Employee onboarding, staff account provisioning, operational role assignment, attendance, leaves, and payroll preparation."),
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
            ('payroll', 'Payroll Processing & Disbursement'),
            ('assets', 'Assets & Equipment'),
            ('reports', 'Reports & Business Intelligence'),
            ('admin', 'User, Role & System Administration'),
            ('audit', 'Audit Logs & Security Compliance'),
        ]

        ACTIONS = [
            ('view', 'View Records'),
            ('create', 'Create Records'),
            ('edit', 'Edit Records'),
            ('delete', 'Delete / Cancel Records'),
            ('approve', 'Approve Records & Orders'),
            ('reject', 'Reject Requests'),
            ('post', 'Post Financial & Ledger Transactions'),
            ('dispense', 'Dispense Medications'),
            ('verify', 'Verify Diagnostic Reports'),
            ('export', 'Export Reports & Datasets'),
            ('manage', 'Manage Operational Workflows'),
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

        for role_code, role_obj in roles_map.items():
            mod_actions = ROLE_MODULE_ACTIONS.get(role_code, {})
            selected_perms = []
            for mod_code, actions in mod_actions.items():
                for act in actions:
                    p_code = f"{mod_code}:{act}"
                    if p_code in perms_map:
                        selected_perms.append(perms_map[p_code])
            role_obj.permissions.set(selected_perms)

        self.stdout.write("Granted 3D RBAC role-permission assignments to all 22 roles.")

        POLICIES = [
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('0.00'), Decimal('10000.00'), RoleEnum.BILLING_EXECUTIVE, True, "Routine invoice discounts up to ₹10,000"),
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('10000.01'), Decimal('50000.00'), RoleEnum.FINANCE_MANAGER, True, "Major invoice adjustments requiring Finance Manager approval"),
            (FinancialOperationType.INVOICE_ADJUSTMENT, Decimal('50000.01'), None, RoleEnum.SUPER_ADMIN, True, "Critical adjustments > ₹50,000 requiring Super Admin approval"),
            (FinancialOperationType.REFUND_REVERSAL, Decimal('0.00'), Decimal('5000.00'), RoleEnum.ACCOUNTANT, True, "Patient refunds up to ₹5,000 (Cashier cannot approve self)"),
            (FinancialOperationType.REFUND_REVERSAL, Decimal('5000.01'), None, RoleEnum.FINANCE_MANAGER, True, "High-value patient refunds requiring Finance Manager approval"),
            (FinancialOperationType.SUPPLIER_PAYMENT, Decimal('0.00'), Decimal('100000.00'), RoleEnum.FINANCE_MANAGER, True, "Supplier invoices up to ₹1,00,000 approved by Finance Manager"),
            (FinancialOperationType.SUPPLIER_PAYMENT, Decimal('100000.01'), None, RoleEnum.SUPER_ADMIN, True, "Large supplier payments > ₹1,00,000 approved by Super Admin"),
            (FinancialOperationType.PURCHASE_APPROVAL, Decimal('0.00'), Decimal('50000.00'), RoleEnum.FINANCE_MANAGER, True, "Standard purchase requisitions up to ₹50,000 approved by Finance Manager"),
            (FinancialOperationType.PURCHASE_APPROVAL, Decimal('50000.01'), None, RoleEnum.SUPER_ADMIN, True, "Capital purchase orders > ₹50,000 requiring Super Admin authorization"),
            (FinancialOperationType.JOURNAL_POSTING, Decimal('0.00'), Decimal('250000.00'), RoleEnum.ACCOUNTANT, True, "Standard GL journal posting (Creator cannot post)"),
            (FinancialOperationType.JOURNAL_POSTING, Decimal('250000.01'), None, RoleEnum.FINANCE_MANAGER, True, "Large GL journal entries > ₹2,50,000 approved by Finance Manager"),
            (FinancialOperationType.INVESTMENT_TRANSACTION, Decimal('0.00'), None, RoleEnum.FINANCE_MANAGER, True, "Treasury & Fixed Deposit liquidation authorized by Finance Manager"),
            (FinancialOperationType.WRITE_OFF, Decimal('0.00'), None, RoleEnum.FINANCE_MANAGER, True, "Bad debt and medicine inventory write-offs approved by Finance Manager"),
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

        SecurityAuditEvent.objects.create(
            event_type=SecurityEventType.PERMISSIONS_UPDATED,
            actor_email='system@aurahms.org',
            details={'message': 'Master 3D RBAC & Role Responsibility Separation Matrix initialized.'}
        )

        self.stdout.write(self.style.SUCCESS("Master RBAC & Permissions Seeding Completed Successfully!"))
