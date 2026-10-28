import uuid
from decimal import Decimal
from datetime import date, time
from django.test import TestCase
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, PatientProfile, Role, RoleEnum
from apps.clinical.models import (
    Appointment, AppointmentStatus, InpatientAdmission, AdmissionStatus,
    Bed, BedStatus, Ward, LabOrder, LabOrderStatus, EmergencyEncounter
)
from apps.pharmacy_inventory.models import (
    Medicine, MedicineBatch, StockMovement, MovementType, BatchStatus, Supplier
)
from apps.billing_finance.models import (
    HospitalService, TariffPlan, TariffRate, Invoice, InvoiceItem, InvoiceStatus,
    Payment, PaymentMethod, PatientRefund, PatientDeposit,
    ChartOfAccount, AccountCategory, JournalEntry, JournalLineItem, LoanRegister, InvestmentRegister
)
from apps.core.database_transaction_services import (
    DatabaseTransactionService, DatabaseIntegrityAuditService
)


class Section22DatabaseDesignTestCase(TestCase):
    """
    Comprehensive verification test suite for Section 22: Database Design.
    Verifies normalization, relational integrity, unique constraints, atomic transactions,
    historical price preservation, double-entry balancing, and idempotency controls.
    """

    def setUp(self):
        # 1. Hospital Enterprise Hierarchy
        self.hospital, _ = Hospital.objects.get_or_create(
            code='HOSP-SEC22-01',
            defaults={
                'name': 'Section 22 Enterprise Healthcare',
                'address_line1': '742 Evergreen Road',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400001',
                'currency': 'INR',
                'timezone': 'Asia/Kolkata',
            }
        )

        self.branch, _ = Branch.objects.get_or_create(
            code='BR-SEC22-01',
            defaults={
                'hospital': self.hospital,
                'name': 'Main Clinical Center',
                'address_line1': 'Sector 5, BKC',
                'city': 'Mumbai',
                'state': 'Maharashtra',
                'postal_code': '400051',
                'is_main_branch': True,
            }
        )

        self.dept, _ = Department.objects.get_or_create(
            code='CARD-SEC22',
            branch=self.branch,
            defaults={'name': 'Cardiology Department'}
        )

        # 2. Roles & Profiles
        self.admin_role, _ = Role.objects.get_or_create(
            name=RoleEnum.HOSPITAL_ADMIN,
            defaults={'display_name': 'Hospital Administrator'}
        )
        self.doctor_role, _ = Role.objects.get_or_create(
            name=RoleEnum.DOCTOR,
            defaults={'display_name': 'Physician'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        self.admin_user = UserProfile.objects.create(
            supabase_user_id=uuid.uuid4(),
            email='admin.sec22@hospital.com',
            first_name='Admin',
            last_name='Sec22',
            role=self.admin_role
        )
        self.admin_staff = StaffProfile.objects.create(
            user_profile=self.admin_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id='EMP-SEC22-ADM',
            designation='Administrator'
        )

        self.doctor_user = UserProfile.objects.create(
            supabase_user_id=uuid.uuid4(),
            email='doctor.sec22@hospital.com',
            first_name='Ananya',
            last_name='Roy',
            role=self.doctor_role
        )
        self.doctor_staff = StaffProfile.objects.create(
            user_profile=self.doctor_user,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept,
            employee_id='DOC-SEC22-01',
            designation='Cardiologist',
            consultation_fee=Decimal('850.00')
        )

        self.patient_user = UserProfile.objects.create(
            supabase_user_id=uuid.uuid4(),
            email='patient.sec22@hospital.com',
            first_name='Kavita',
            last_name='Menon',
            role=self.patient_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.patient_user,
            primary_branch=self.branch,
            medical_record_number='MRN-SEC22-9901',
            gender='FEMALE'
        )

    def test_01_schema_normalization_and_foreign_key_protection(self):
        """
        Verify database normalization and models.PROTECT prevents accidental deletion
        of parent hospital or branch while child clinical records exist.
        """
        # Attempting to delete self.hospital must raise ProtectedError due to Branch.hospital
        with self.assertRaises(ProtectedError):
            self.hospital.delete()

        # Create an appointment referencing patient; then patient deletion must raise ProtectedError
        Appointment.objects.create(
            appointment_number='APT-SEC22-PROT',
            patient=self.patient,
            doctor=self.doctor_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=date(2026, 12, 1),
            time_slot='09:00-09:15',
            status=AppointmentStatus.SCHEDULED
        )
        with self.assertRaises(ProtectedError):
            self.patient.delete()

    def test_02_unique_constraints_enforce_database_integrity(self):
        """
        Verify unique constraints on patient MRN, appointment slot, and medicine batch.
        """
        # Duplicate MRN must fail IntegrityError
        dup_user = UserProfile.objects.create(
            supabase_user_id=uuid.uuid4(),
            email='dup.patient@test.com',
            first_name='Dup',
            last_name='User',
            role=self.patient_role
        )
        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                PatientProfile.objects.create(
                    user_profile=dup_user,
                    primary_branch=self.branch,
                    medical_record_number='MRN-SEC22-9901',  # Already exists!
                    gender='MALE'
                )

        # Duplicate Appointment Slot for same doctor, date, and time slot must fail
        today_date = date(2026, 11, 10)
        Appointment.objects.create(
            appointment_number='APT-SEC22-01',
            patient=self.patient,
            doctor=self.doctor_staff,
            department=self.dept,
            branch=self.branch,
            appointment_date=today_date,
            time_slot='10:00-10:15',
            status=AppointmentStatus.SCHEDULED
        )

        with transaction.atomic():
            with self.assertRaises(IntegrityError):
                Appointment.objects.create(
                    appointment_number='APT-SEC22-02',
                    patient=self.patient,
                    doctor=self.doctor_staff,
                    department=self.dept,
                    branch=self.branch,
                    appointment_date=today_date,
                    time_slot='10:00-10:15',  # Duplicate slot for this doctor!
                    status=AppointmentStatus.SCHEDULED
                )

    def test_03_numeric_precision_preserves_exact_decimal_currency(self):
        """
        Verify DecimalField preserves exact currency precision without floating point error.
        """
        service = HospitalService.objects.create(
            service_code='SRV-SEC22-ECG',
            name='12-Lead Electrocardiogram (ECG)',
            department=self.dept,
            standard_price=Decimal('750.35'),
            tax_rate=Decimal('18.00')
        )
        invoice = Invoice.objects.create(
            invoice_number='INV-SEC22-PREC-01',
            patient=self.patient,
            branch=self.branch,
            invoice_date=date(2026, 10, 24)
        )
        item = InvoiceItem.objects.create(
            invoice=invoice,
            service=service,
            item_type='DIAGNOSTIC_LAB',
            description=service.name,
            quantity=2,
            unit_price=Decimal('750.35'),
            tax_rate=Decimal('18.00')
        )
        # gross = 2 * 750.35 = 1500.70
        # tax = 1500.70 * 18% = 270.126
        # line_total = 1500.70 + 270.126 = 1770.826
        self.assertEqual(item.subtotal, Decimal('1500.70'))
        self.assertEqual(item.line_total, Decimal('1770.826'))
        invoice.recalculate_totals()
        self.assertEqual(invoice.subtotal, Decimal('1500.70'))
        self.assertEqual(invoice.total_amount, Decimal('1770.83'))

    def test_04_historical_price_preservation_freezes_snapshot(self):
        """
        Verify modifying the current service catalog rate does NOT retroactively
        modify previously issued invoices and invoice line items.
        """
        service = HospitalService.objects.create(
            service_code='SRV-SEC22-ECHO',
            name='2D Echocardiography',
            department=self.dept,
            standard_price=Decimal('2200.00'),
            tax_rate=Decimal('0.00')
        )
        invoice = Invoice.objects.create(
            invoice_number='INV-SEC22-HIST-01',
            patient=self.patient,
            branch=self.branch,
            invoice_date=date(2026, 10, 1)
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            service=service,
            item_type='DIAGNOSTIC_LAB',
            description=service.name,
            quantity=1,
            unit_price=service.standard_price,
            tax_rate=Decimal('0.00')
        )
        invoice.recalculate_totals()
        self.assertEqual(invoice.total_amount, Decimal('2200.00'))

        # Hospital administration increases service price to ₹2800 in November
        service.standard_price = Decimal('2800.00')
        service.save(update_fields=['standard_price'])

        # Refresh invoice from database: historical invoice and line item MUST remain ₹2200
        invoice.refresh_from_db()
        item = invoice.items.first()
        self.assertEqual(item.unit_price, Decimal('2200.00'))
        self.assertEqual(invoice.total_amount, Decimal('2200.00'))

    def test_05_atomic_inventory_issue_and_rollback_on_failure(self):
        """
        Verify atomic inventory deduction succeeds, updates stock movement,
        and cleanly rolls back completely if an error or insufficient stock occurs.
        """
        medicine = Medicine.objects.create(
            code='MED-SEC22-ATORVA',
            generic_name='Atorvastatin',
            brand_name='Atorva 20mg',
            category='CARDIOVASCULAR',
            standard_purchase_cost=Decimal('8.50'),
            standard_selling_price=Decimal('15.00')
        )
        batch = MedicineBatch.objects.create(
            medicine=medicine,
            branch=self.branch,
            batch_number='BAT-SEC22-001',
            expiry_date=date(2027, 12, 31),
            quantity_in_stock=50,
            unit_purchase_cost=Decimal('8.50'),
            unit_selling_price=Decimal('15.00'),
            status=BatchStatus.AVAILABLE
        )

        # 1. Valid deduction of 20 units
        movement = DatabaseTransactionService.issue_inventory_stock_atomic(
            branch_id=self.branch.id,
            batch_id=batch.id,
            quantity=20,
            movement_type=MovementType.DISPENSE,
            recorded_by=self.doctor_staff,
            reference_document='DISP-SEC22-01'
        )
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 30)
        self.assertEqual(movement.quantity_delta, -20)
        self.assertEqual(movement.new_stock, 30)

        # 2. Attempt invalid deduction of 40 units (exceeds remaining 30)
        with self.assertRaises(ValidationError):
            DatabaseTransactionService.issue_inventory_stock_atomic(
                branch_id=self.branch.id,
                batch_id=batch.id,
                quantity=40,  # Exceeds 30!
                recorded_by=self.doctor_staff
            )

        # Verify rollback: stock remains untouched at 30
        batch.refresh_from_db()
        self.assertEqual(batch.quantity_in_stock, 30)

    def test_06_atomic_payment_posting_and_idempotency(self):
        """
        Verify atomic payment posting updates invoice balance and idempotency
        controls prevent duplicate payments on retry.
        """
        invoice = Invoice.objects.create(
            invoice_number='INV-SEC22-PMT-01',
            patient=self.patient,
            branch=self.branch,
            subtotal=Decimal('5000.00'),
            total_amount=Decimal('5000.00'),
            paid_amount=Decimal('0.00'),
            balance_amount=Decimal('5000.00'),
            status=InvoiceStatus.ISSUED
        )

        idempotency_key = 'IDEMP-RAZORPAY-TXN-9988'

        # First payment attempt
        pmt1 = DatabaseTransactionService.post_payment_atomic(
            invoice_id=invoice.id,
            amount=Decimal('2000.00'),
            payment_method=PaymentMethod.UPI,
            received_by=self.admin_staff,
            transaction_reference='UPI-REF-001',
            idempotency_key=idempotency_key
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal('2000.00'))
        self.assertEqual(invoice.balance_amount, Decimal('3000.00'))
        self.assertEqual(invoice.status, InvoiceStatus.PARTIALLY_PAID)

        # Retried payment attempt with same idempotency key: must NOT double charge
        pmt2 = DatabaseTransactionService.post_payment_atomic(
            invoice_id=invoice.id,
            amount=Decimal('2000.00'),
            payment_method=PaymentMethod.UPI,
            received_by=self.admin_staff,
            transaction_reference='UPI-REF-001',
            idempotency_key=idempotency_key
        )
        self.assertEqual(pmt1.id, pmt2.id)
        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal('2000.00'))  # Not doubled to 4000!

    def test_07_refund_processing_integrity(self):
        """
        Verify refund processing validates that refunds cannot exceed paid amounts.
        """
        invoice = Invoice.objects.create(
            invoice_number='INV-SEC22-REF-01',
            patient=self.patient,
            branch=self.branch,
            total_amount=Decimal('3000.00'),
            paid_amount=Decimal('1000.00'),
            balance_amount=Decimal('2000.00'),
            status=InvoiceStatus.PARTIALLY_PAID
        )

        # Valid refund of ₹500
        refund = DatabaseTransactionService.process_refund_atomic(
            invoice_id=invoice.id,
            refund_amount=Decimal('500.00'),
            processed_by=self.admin_staff,
            reason='Procedure cancellation fee waiver'
        )
        invoice.refresh_from_db()
        self.assertEqual(invoice.refunded_amount, Decimal('500.00'))

        # Excessive refund of ₹600 (remaining paid is only 500) must raise ValidationError
        with self.assertRaises(ValidationError):
            DatabaseTransactionService.process_refund_atomic(
                invoice_id=invoice.id,
                refund_amount=Decimal('600.00'),
                processed_by=self.admin_staff
            )

    def test_08_double_entry_general_ledger_balance_enforcement(self):
        """
        Verify double-entry accounting integrity: every journal entry must balance
        (sum of debits == sum of credits). Unbalanced entries are rejected atomically.
        """
        cat_asset, _ = AccountCategory.objects.get_or_create(
            code='CAT-1000',
            defaults={'name': 'Current Assets', 'category_type': 'ASSET'}
        )
        cat_rev, _ = AccountCategory.objects.get_or_create(
            code='CAT-4000',
            defaults={'name': 'Operating Revenue', 'category_type': 'REVENUE'}
        )
        bank_acc = ChartOfAccount.objects.create(
            account_code='1010-SEC22',
            name='Operating Bank Account',
            category=cat_asset,
            branch=self.branch,
            current_balance=Decimal('100000.00')
        )
        rev_acc = ChartOfAccount.objects.create(
            account_code='4010-SEC22',
            name='Hospital OPD Revenue',
            category=cat_rev,
            branch=self.branch,
            current_balance=Decimal('0.00')
        )

        # 1. Balanced Entry (Debit 5000, Credit 5000)
        balanced_lines = [
            {'account_id': bank_acc.id, 'debit': Decimal('5000.00'), 'credit': Decimal('0.00'), 'line_number': 1},
            {'account_id': rev_acc.id, 'debit': Decimal('0.00'), 'credit': Decimal('5000.00'), 'line_number': 2},
        ]
        jv = DatabaseTransactionService.post_balanced_journal_entry_atomic(
            branch_id=self.branch.id,
            journal_date=date(2026, 10, 24),
            description='OPD Cash Collections Journal',
            line_items=balanced_lines,
            created_by=self.admin_staff
        )
        self.assertIsNotNone(jv)
        bank_acc.refresh_from_db()
        rev_acc.refresh_from_db()
        self.assertEqual(bank_acc.current_balance, Decimal('105000.00'))
        self.assertEqual(rev_acc.current_balance, Decimal('5000.00'))

        # 2. Unbalanced Entry (Debit 5000, Credit 4000) must raise ValidationError and roll back
        unbalanced_lines = [
            {'account_id': bank_acc.id, 'debit': Decimal('5000.00'), 'credit': Decimal('0.00'), 'line_number': 1},
            {'account_id': rev_acc.id, 'debit': Decimal('0.00'), 'credit': Decimal('4000.00'), 'line_number': 2},
        ]
        with self.assertRaises(ValidationError):
            DatabaseTransactionService.post_balanced_journal_entry_atomic(
                branch_id=self.branch.id,
                journal_date=date(2026, 10, 24),
                description='Unbalanced Journal Entry',
                line_items=unbalanced_lines,
                created_by=self.admin_staff
            )

        # Verify rollback: balances remain unchanged
        bank_acc.refresh_from_db()
        rev_acc.refresh_from_db()
        self.assertEqual(bank_acc.current_balance, Decimal('105000.00'))
        self.assertEqual(rev_acc.current_balance, Decimal('5000.00'))

    def test_09_database_integrity_audit_service_reports_clean_pass(self):
        """
        Verify DatabaseIntegrityAuditService audits all 12 database areas and returns PASSED with 0 violations.
        """
        report = DatabaseIntegrityAuditService.verify_normalization_and_integrity()
        self.assertEqual(report['status'], 'PASSED')
        self.assertEqual(report['violations_found'], 0)
        self.assertEqual(report['areas_verified']['invoices']['status'], 'PASSED')
        self.assertEqual(report['areas_verified']['invoice_line_items']['status'], 'PASSED')
        self.assertEqual(report['areas_verified']['payments_and_refunds']['status'], 'PASSED')
        self.assertEqual(report['areas_verified']['pharmacy_batches']['status'], 'PASSED')
        self.assertEqual(report['areas_verified']['general_ledger']['status'], 'PASSED')
