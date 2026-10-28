import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import Hospital, Branch
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.billing_finance.models import (
    Invoice, InvoiceItem, Payment, AccountCategory, AccountCategoryType,
    ChartOfAccount, JournalEntry
)

User = get_user_model()


class TestBillingAndFinance(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.hospital = Hospital.objects.create(
            name='Test Hospital HQ',
            code=f"HOSP-{uuid.uuid4().hex[:4].upper()}"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name='Finance Branch',
            code=f"BR-{uuid.uuid4().hex[:4].upper()}"
        )

        self.accountant_role, _ = Role.objects.get_or_create(
            name=RoleEnum.ACCOUNTANT,
            defaults={'display_name': 'Accountant'}
        )
        self.patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient'}
        )

        # Accountant profile & Django user
        self.acc_supabase_id = uuid.uuid4()
        self.acc_django_user = User.objects.create_user(
            username=str(self.acc_supabase_id),
            email='accountant@hospital.local'
        )
        self.acc_user = UserProfile.objects.create(
            supabase_user_id=self.acc_supabase_id,
            email='accountant@hospital.local',
            first_name='Kavita',
            last_name='Sharma',
            role=self.accountant_role
        )
        self.accountant = StaffProfile.objects.create(
            user_profile=self.acc_user,
            hospital=self.hospital,
            branch=self.branch,
            employee_id=f"ACC-{uuid.uuid4().hex[:6].upper()}",
            designation='Lead Accountant',
            status='ACTIVE'
        )

        # Patient profile
        self.pat_supabase_id = uuid.uuid4()
        self.pat_django_user = User.objects.create_user(
            username=str(self.pat_supabase_id),
            email='patient@gmail.com'
        )
        self.pat_user = UserProfile.objects.create(
            supabase_user_id=self.pat_supabase_id,
            email='patient@gmail.com',
            first_name='Vikram',
            last_name='Seth',
            role=self.patient_role
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.pat_user,
            primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:8].upper()}",
            gender='MALE'
        )

        # Chart of Accounts
        self.cat_asset = AccountCategory.objects.create(code='1000', name='Assets', category_type=AccountCategoryType.ASSET)
        self.cat_rev = AccountCategory.objects.create(code='4000', name='Revenue', category_type=AccountCategoryType.REVENUE)

        self.acc_cash = ChartOfAccount.objects.create(
            account_code='1010',
            name='Main Cash Account',
            category=self.cat_asset,
            branch=self.branch,
            current_balance=Decimal('10000.00')
        )
        self.acc_opd_rev = ChartOfAccount.objects.create(
            account_code='4010',
            name='OPD Consultation Revenue',
            category=self.cat_rev,
            branch=self.branch,
            current_balance=Decimal('50000.00')
        )

    def test_invoice_creation_and_payment_settlement(self):
        """Verify invoice total calculation, payment recording, and status transition to PAID."""
        self.client.force_authenticate(user=self.acc_django_user)

        # 1. Create Invoice with itemized charges
        inv_payload = {
            'patient_id': str(self.patient.id),
            'branch_id': str(self.branch.id),
            'discount_amount': '100.00',
            'tax_amount': '50.00',
            'items': [
                {'description': 'Specialist Cardiology Consultation', 'unit_price': '800.00', 'quantity': 1},
                {'description': 'Electrocardiogram (ECG)', 'unit_price': '450.00', 'quantity': 1}
            ]
        }
        res_inv = self.client.post('/api/v1/billing-finance/invoices/', inv_payload, format='json')
        self.assertEqual(res_inv.status_code, status.HTTP_201_CREATED)
        invoice_id = res_inv.data['id']

        # Subtotal: 800 + 450 = 1250; Total: 1250 - 100 + 50 = 1200
        self.assertEqual(Decimal(str(res_inv.data['subtotal'])), Decimal('1250.00'))
        self.assertEqual(Decimal(str(res_inv.data['total_amount'])), Decimal('1200.00'))
        self.assertEqual(Decimal(str(res_inv.data['balance_amount'])), Decimal('1200.00'))

        # 2. Record partial payment of ₹500
        pay1 = {
            'invoice_id': invoice_id,
            'amount': '500.00',
            'payment_method': 'UPI',
            'transaction_reference': 'UPI/2026/001'
        }
        res_pay1 = self.client.post('/api/v1/billing-finance/payments/record/', pay1, format='json')
        self.assertEqual(res_pay1.status_code, status.HTTP_201_CREATED)

        # Check invoice status updated to PARTIALLY_PAID
        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.status, 'PARTIALLY_PAID')
        self.assertEqual(inv.balance_amount, Decimal('700.00'))

        # 3. Pay remaining ₹700
        pay2 = {
            'invoice_id': invoice_id,
            'amount': '700.00',
            'payment_method': 'CASH'
        }
        res_pay2 = self.client.post('/api/v1/billing-finance/payments/record/', pay2, format='json')
        self.assertEqual(res_pay2.status_code, status.HTTP_201_CREATED)

        inv.refresh_from_db()
        self.assertEqual(inv.status, 'PAID')
        self.assertEqual(inv.balance_amount, Decimal('0.00'))

    def test_double_entry_journal_balance_validation(self):
        """Verify journal posting requires Debit == Credit, rejecting unbalanced entries."""
        self.client.force_authenticate(user=self.acc_django_user)

        # Unbalanced entry: Debit ₹1000, Credit ₹800 -> must FAIL
        unbalanced_payload = {
            'branch_id': str(self.branch.id),
            'narration': 'Consultation Cash Receipt',
            'lines': [
                {'account_id': str(self.acc_cash.id), 'entry_type': 'DEBIT', 'amount': '1000.00'},
                {'account_id': str(self.acc_opd_rev.id), 'entry_type': 'CREDIT', 'amount': '800.00'}
            ]
        }
        res_unbalanced = self.client.post('/api/v1/billing-finance/journal-entries/', unbalanced_payload, format='json')
        self.assertEqual(res_unbalanced.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('double-entry violation', res_unbalanced.data['error'].lower())

        # Balanced entry: Debit ₹1000, Credit ₹1000 -> must SUCCEED
        balanced_payload = {
            'branch_id': str(self.branch.id),
            'narration': 'Consultation Cash Receipt',
            'status': 'POSTED',
            'lines': [
                {'account_id': str(self.acc_cash.id), 'entry_type': 'DEBIT', 'amount': '1000.00'},
                {'account_id': str(self.acc_opd_rev.id), 'entry_type': 'CREDIT', 'amount': '1000.00'}
            ]
        }
        res_balanced = self.client.post('/api/v1/billing-finance/journal-entries/', balanced_payload, format='json')
        self.assertEqual(res_balanced.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res_balanced.data['is_posted'])
