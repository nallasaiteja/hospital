from django.core.management.base import BaseCommand
from django.db import transaction
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, Permission


class Command(BaseCommand):
    help = 'Seeds foundational hospital records, branches, departments, roles, and granular permissions.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting foundational hospital data seeding...'))

        # 1. Seed Permissions
        permissions_data = [
            # Clinical
            ('clinical:read', 'View Clinical Records', 'clinical', 'View consultations, vitals, and EMR records'),
            ('clinical:write', 'Create & Edit Clinical Records', 'clinical', 'Add clinical notes, diagnoses, and prescriptions'),
            ('clinical:admit', 'Inpatient Admissions', 'clinical', 'Admit patients and assign wards/beds'),
            ('clinical:discharge', 'Inpatient Discharge', 'clinical', 'Authorise patient medical discharge'),
            # Lab
            ('lab:order', 'Order Lab Tests', 'laboratory', 'Request laboratory diagnostics and specimen tests'),
            ('lab:process', 'Process Specimens', 'laboratory', 'Log specimens and enter test results'),
            ('lab:verify', 'Verify Lab Reports', 'laboratory', 'Pathologist signoff and report generation'),
            # Pharmacy
            ('pharmacy:dispense', 'Dispense Medication', 'pharmacy', 'Dispense drugs against authorized prescriptions'),
            ('pharmacy:manage_inventory', 'Manage Drug Formulary', 'pharmacy', 'Batch stock updates and expiry tracking'),
            # Billing & Finance
            ('billing:create_invoice', 'Create Invoices', 'billing', 'Generate outpatient and inpatient invoices'),
            ('billing:record_payment', 'Record Payments', 'billing', 'Accept cash, UPI, card, and insurance payments'),
            ('finance:post_journal', 'Post Journal Entries', 'finance', 'Create double-entry ledger transactions'),
            ('finance:view_reports', 'View Financial Reports', 'finance', 'Access P&L, balance sheets, and cash flow'),
            # Operations & Admin
            ('appointments:schedule', 'Manage Appointments', 'operations', 'Book, reschedule, and cancel slots'),
            ('staff:manage', 'Manage Staff & Roles', 'admin', 'Provision staff accounts and assign branches'),
            ('system:audit', 'View Audit Logs', 'admin', 'Inspect security and clinical audit trails'),
            # Patient Portal Self-Service
            ('patient:self_view', 'View Own Records', 'patient', 'Access personal medical records and bills'),
            ('patient:self_book', 'Book Appointments', 'patient', 'Book personal outpatient appointments'),
        ]

        permission_objs = {}
        for code, name, module, desc in permissions_data:
            perm, created = Permission.objects.update_or_create(
                code=code,
                defaults={'name': name, 'module': module, 'description': desc}
            )
            permission_objs[code] = perm

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(permission_objs)} granular permissions."))

        # 2. Seed Roles and map Permissions
        roles_data = [
            (
                RoleEnum.SUPER_ADMIN,
                'Super Administrator',
                'Unrestricted access across all hospitals, branches, and audit logs',
                list(permission_objs.keys())
            ),
            (
                RoleEnum.BRANCH_MANAGER,
                'Branch Manager',
                'Operational oversight, staff branch assignment, and branch revenue reporting',
                [
                    'clinical:read', 'lab:order', 'billing:create_invoice', 'billing:record_payment',
                    'finance:view_reports', 'appointments:schedule', 'staff:manage', 'system:audit'
                ]
            ),
            (
                RoleEnum.DOCTOR,
                'Doctor / Surgeon',
                'Consultations, e-prescriptions, ICD-10 diagnoses, and inpatient admissions',
                [
                    'clinical:read', 'clinical:write', 'clinical:admit', 'clinical:discharge',
                    'lab:order', 'lab:verify', 'appointments:schedule'
                ]
            ),
            (
                RoleEnum.NURSE,
                'Nurse / Nursing Supervisor',
                'Vitals recording, ward bed allocations, and medication administration',
                [
                    'clinical:read', 'clinical:write', 'clinical:admit', 'appointments:schedule'
                ]
            ),
            (
                RoleEnum.RECEPTIONIST,
                'Receptionist / Front Desk',
                'Patient registration, appointment scheduling, and OPD token generation',
                [
                    'appointments:schedule', 'billing:create_invoice', 'billing:record_payment'
                ]
            ),
            (
                RoleEnum.LAB_TECHNICIAN,
                'Laboratory Technician',
                'Specimen processing, lab test orders, and diagnostic results entry',
                [
                    'lab:order', 'lab:process'
                ]
            ),
            (
                RoleEnum.PHARMACIST,
                'Pharmacist',
                'Prescription validation, drug dispensation, and inventory stock management',
                [
                    'pharmacy:dispense', 'pharmacy:manage_inventory', 'billing:record_payment'
                ]
            ),
            (
                RoleEnum.ACCOUNTANT,
                'Accountant / Financial Officer',
                'Double-entry bookkeeping, general ledger, and financial reporting',
                [
                    'billing:create_invoice', 'billing:record_payment', 'finance:post_journal', 'finance:view_reports'
                ]
            ),
            (
                RoleEnum.INVENTORY_MANAGER,
                'Inventory & Procurement Manager',
                'Purchase requisitions, stock counts, and vendor order processing',
                [
                    'pharmacy:manage_inventory'
                ]
            ),
            (
                RoleEnum.PATIENT,
                'Patient',
                'Self-service appointment booking, viewing personal prescriptions and lab reports',
                [
                    'patient:self_view', 'patient:self_book'
                ]
            ),
        ]

        for role_name, display_name, desc, perms in roles_data:
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={'display_name': display_name, 'description': desc}
            )
            role.permissions.set([permission_objs[p] for p in perms if p in permission_objs])

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(roles_data)} roles with permissions."))

        # 3. Seed Primary Hospital
        hospital, _ = Hospital.objects.update_or_create(
            code='AURA-HQ',
            defaults={
                'name': 'AURA Multi-Specialty Healthcare Institute',
                'legal_name': 'AURA Healthcare Systems Private Limited',
                'tax_identifier': '27AAAAA0000A1Z5',
                'registration_number': 'MH-MED-2026-9812',
                'contact_email': 'contact@aurahms.org',
                'contact_phone': '+91 22 2654 0000',
                'website': 'https://aurahms.org',
                'address_line1': 'Plot 42, Health City Avenue, Bandra Kurla Complex',
                'address_line2': 'Opposite Medical Technology Park',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400051',
                'country': 'India',
                'currency': 'INR',
                'timezone': 'Asia/Kolkata',
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Seeded Hospital: {hospital.name} ({hospital.code})"))

        # 4. Seed Branches
        main_branch, _ = Branch.objects.update_or_create(
            code='AURA-MAIN',
            defaults={
                'hospital': hospital,
                'name': 'AURA Central Multi-Specialty Hospital',
                'is_main_branch': True,
                'phone': '+91 22 2654 0100',
                'email': 'central@aurahms.org',
                'address_line1': 'Plot 42, Health City Avenue, BKC',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400051',
                'operating_hours': {'emergency': '24x7', 'opd': '08:00-20:00'},
            }
        )

        south_branch, _ = Branch.objects.update_or_create(
            code='AURA-SOUTH',
            defaults={
                'hospital': hospital,
                'name': 'AURA South Specialty Clinic & Diagnostics',
                'is_main_branch': False,
                'phone': '+91 22 2490 0200',
                'email': 'south@aurahms.org',
                'address_line1': '15 Dr. E. Moses Road, Worli',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400018',
                'operating_hours': {'opd': '08:30-19:30'},
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Seeded Branches: {main_branch.name}, {south_branch.name}"))

        # 5. Seed Core Departments for Main Branch
        departments = [
            ('CARD', 'Cardiology & Cardiothoracic Surgery', 'Comprehensive heart health and intervention suite'),
            ('NEUR', 'Neurology & Neurosurgery', 'Brain, nerve, and spinal column diagnostics and surgery'),
            ('ORTH', 'Orthopedics & Joint Replacement', 'Musculoskeletal and trauma care'),
            ('MED', 'General Medicine & Diabetology', 'Primary care and internal medicine'),
            ('SURG', 'General & Laparoscopic Surgery', 'Minimally invasive and standard surgical procedures'),
            ('PED', 'Pediatrics & Neonatology', 'Child healthcare and NICU units'),
            ('PATH', 'Pathology & Diagnostic Laboratory', 'NABL-accredited clinical pathology and blood bank'),
            ('PHARM', 'Central Pharmacy & Dispensary', 'Inpatient and outpatient drug distribution'),
            ('RAD', 'Radiology & Advanced Imaging', 'MRI, CT, Ultrasound, and X-Ray diagnostics'),
            ('EMER', 'Emergency & Critical Care Trauma', 'Level-1 24x7 resuscitation and ICU department'),
            ('FIN', 'Finance, Accounts & Billing', 'Treasury, patient billing, and statutory audits'),
        ]

        for dept_code, dept_name, dept_desc in departments:
            Department.objects.update_or_create(
                branch=main_branch,
                code=dept_code,
                defaults={'name': dept_name, 'description': dept_desc}
            )

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(departments)} departments for Main Branch."))
        self.stdout.write(self.style.SUCCESS("Foundational database seeding completed successfully!"))
