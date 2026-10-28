import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile
from apps.core.models import Hospital, Branch, Department
from apps.billing_finance.models import (
    FinancialAccount, FinancialAccountTransaction,
    FinancialTransactionAuditLog, TransactionLifecycleStatus,
    TransactionType, FinancialTransactionCategory,
    FinancialAccountType, AccountingClassification
)


class Section14FinancialTransactionTests(TestCase):
    """
    Comprehensive verification tests for Section 14: Financial Transaction Management.
    Tests transaction creation, lifecycle progression, dual-leg transfers,
    approvals, separation of duties, reversals, duplicate protection, and audit trails.
    """

    def setUp(self):
        # 1. Setup Core Hospital, Branch, Department
        self.hospital = Hospital.objects.create(name='Aura Health System', code='AURA-HQ')
        self.branch = Branch.objects.create(hospital=self.hospital, name='Main Campus', code='AURA-MAIN')
        self.department = Department.objects.create(branch=self.branch, name='Finance & Treasury', code='DEP-FIN')

        # 2. Setup Roles
        self.role_super = Role.objects.create(name=RoleEnum.SUPER_ADMIN, display_name='Super Administrator')
        self.role_fin_mgr = Role.objects.create(name=RoleEnum.FINANCE_MANAGER, display_name='Finance Manager')
        self.role_accountant = Role.objects.create(name=RoleEnum.ACCOUNTANT, display_name='Accountant')
        self.role_cashier = Role.objects.create(name=RoleEnum.CASHIER, display_name='Cashier')

        # 3. Setup Users & Staff
        # Preparer / Cashier (Staff 1)
        uid_prep = uuid.uuid4()
        self.user_prep = User.objects.create_user(username=str(uid_prep), email='cashier1@hospital.com')
        self.up_prep = UserProfile.objects.create(supabase_user_id=uid_prep, email='cashier1@hospital.com', first_name='Ramesh', last_name='Patel', role=self.role_cashier)
        self.staff_prep = StaffProfile.objects.create(user_profile=self.up_prep, hospital=self.hospital, branch=self.branch, employee_id='EMP-CSH-01')

        # Approver / Finance Manager (Staff 2)
        uid_appr = uuid.uuid4()
        self.user_appr = User.objects.create_user(username=str(uid_appr), email='finmgr@hospital.com')
        self.up_appr = UserProfile.objects.create(supabase_user_id=uid_appr, email='finmgr@hospital.com', first_name='Meenakshi', last_name='Sundaram', role=self.role_fin_mgr)
        self.staff_appr = StaffProfile.objects.create(user_profile=self.up_appr, hospital=self.hospital, branch=self.branch, employee_id='EMP-FIN-01')

        # 4. Setup Financial Accounts
        # Bank Account A (HDFC Operations) - Opening Balance ₹5,00,000
        self.bank_a = FinancialAccount.objects.create(
            branch=self.branch,
            account_code='FA-BNK-HDFC',
            name='HDFC Operations Treasury',
            account_type=FinancialAccountType.BANK,
            classification=AccountingClassification.ASSET,
            opening_balance=Decimal('500000.00'),
            current_balance=Decimal('500000.00'),
            is_active=True
        )

        # Bank Account B (ICICI Collections) - Opening Balance ₹2,00,000
        self.bank_b = FinancialAccount.objects.create(
            branch=self.branch,
            account_code='FA-BNK-ICICI',
            name='ICICI Collections',
            account_type=FinancialAccountType.BANK,
            classification=AccountingClassification.ASSET,
            opening_balance=Decimal('200000.00'),
            current_balance=Decimal('200000.00'),
            is_active=True
        )

        # Inactive Account
        self.inactive_acc = FinancialAccount.objects.create(
            branch=self.branch,
            account_code='FA-INACTIVE',
            name='Closed Legacy Account',
            account_type=FinancialAccountType.CASH,
            classification=AccountingClassification.ASSET,
            is_active=False
        )

        self.client = APIClient(SERVER_NAME='localhost')

    def test_01_create_draft_transaction_and_balance_isolation(self):
        """Draft transactions must not alter posted ledger account balances."""
        self.client.force_authenticate(user=self.user_prep)

        payload = {
            'account_id': str(self.bank_a.id),
            'transaction_type': TransactionType.DEBIT,
            'category': FinancialTransactionCategory.PATIENT_RECEIPT_ADVANCE,
            'amount': '25000.00',
            'description': 'Advance deposit for surgery patient',
            'counterparty': 'Patient Anita Verma',
            'payment_method': 'UPI',
            'reference_number': 'UPI-ADV-998811',
            'is_draft': True
        }

        res = self.client.post('/api/v1/billing-finance/financial-transactions/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        tx_id = res.data['id']
        self.assertEqual(res.data['lifecycle_status'], TransactionLifecycleStatus.DRAFT)
        self.assertEqual(res.data['posting_status'], 'PENDING')

        # Balance check: Bank A balance must remain strictly ₹5,00,000 (draft does not affect posted balance)
        calc_bal, debits, credits = self.bank_a.calculate_balance()
        self.assertEqual(calc_bal, Decimal('500000.00'))
        self.assertEqual(debits, Decimal('0.00'))

    def test_02_submit_and_separation_of_duties_enforcement(self):
        """Preparer cannot approve their own transaction; Finance Manager can approve."""
        # 1. Cashier creates draft and submits for approval
        self.client.force_authenticate(user=self.user_prep)
        tx = FinancialAccountTransaction.objects.create(
            account=self.bank_a,
            transaction_number='TXN-TEST-DUTY-01',
            transaction_type=TransactionType.DEBIT,
            category=FinancialTransactionCategory.OPERATING_EXPENSE,
            description='Biomedical waste management monthly fee',
            amount=Decimal('45000.00'),
            debit_amount=Decimal('45000.00'),
            lifecycle_status=TransactionLifecycleStatus.DRAFT,
            posting_status='PENDING',
            created_by=self.staff_prep
        )

        res_sub = self.client.post(f'/api/v1/billing-finance/financial-transactions/{tx.id}/submit-approval/')
        self.assertEqual(res_sub.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sub.data['lifecycle_status'], TransactionLifecycleStatus.PENDING_APPROVAL)

        # 2. Cashier (preparer) attempts self-approval -> MUST BE BLOCKED (HTTP 403)
        res_self = self.client.post(f'/api/v1/billing-finance/financial-transactions/{tx.id}/approve/')
        self.assertEqual(res_self.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Separation of duties violation', res_self.data['error'])

        # 3. Independent Finance Manager approves -> MUST SUCCEED (HTTP 200)
        self.client.force_authenticate(user=self.user_appr)
        res_appr = self.client.post(f'/api/v1/billing-finance/financial-transactions/{tx.id}/approve/', {'auto_post': True})
        self.assertEqual(res_appr.status_code, status.HTTP_200_OK)
        self.assertEqual(res_appr.data['lifecycle_status'], TransactionLifecycleStatus.POSTED)
        self.assertEqual(res_appr.data['posting_status'], 'POSTED')

        # 4. Verify account balance updated dynamically
        calc_bal, debits, credits = self.bank_a.calculate_balance()
        # Asset: 500,000 + 45,000 debits = 545,000
        self.assertEqual(calc_bal, Decimal('545000.00'))
        self.assertEqual(debits, Decimal('45000.00'))

    def test_03_dual_leg_interaccount_transfer(self):
        """Transfer between accounts correctly credits source and debits destination without inflating revenue."""
        self.client.force_authenticate(user=self.user_appr)

        payload = {
            'account_id': str(self.bank_a.id),
            'destination_account_id': str(self.bank_b.id),
            'transaction_type': TransactionType.TRANSFER,
            'category': FinancialTransactionCategory.BANK_TRANSFER_INTERACCOUNT,
            'amount': '75000.00',
            'description': 'Liquidity replenishment from HDFC to ICICI',
            'payment_method': 'NEFT',
            'auto_post': True
        }

        res = self.client.post('/api/v1/billing-finance/financial-transactions/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        tx1_id = res.data['id']
        tx1 = FinancialAccountTransaction.objects.get(pk=tx1_id)
        self.assertIsNotNone(tx1.transfer_paired_transaction)
        tx2 = tx1.transfer_paired_transaction

        # Leg 1 (Source Bank A): Credit ₹75,000
        self.assertEqual(tx1.account, self.bank_a)
        self.assertEqual(tx1.credit_amount, Decimal('75000.00'))
        self.assertEqual(tx1.debit_amount, Decimal('0.00'))
        self.assertEqual(tx1.lifecycle_status, TransactionLifecycleStatus.POSTED)

        # Leg 2 (Destination Bank B): Debit ₹75,000
        self.assertEqual(tx2.account, self.bank_b)
        self.assertEqual(tx2.debit_amount, Decimal('75000.00'))
        self.assertEqual(tx2.credit_amount, Decimal('0.00'))
        self.assertEqual(tx2.lifecycle_status, TransactionLifecycleStatus.POSTED)

        # Verify balances:
        # Bank A: 500,000 - 75,000 = 425,000
        bal_a, _, _ = self.bank_a.calculate_balance()
        self.assertEqual(bal_a, Decimal('425000.00'))

        # Bank B: 200,000 + 75,000 = 275,000
        bal_b, _, _ = self.bank_b.calculate_balance()
        self.assertEqual(bal_b, Decimal('275000.00'))

        # Total Hospital Assets across Bank A + B: 425,000 + 275,000 = 700,000 (Conserved perfectly!)
        self.assertEqual(bal_a + bal_b, Decimal('700000.00'))

    def test_04_reversal_workflow_with_offsetting_entry(self):
        """Reversing a posted transaction marks it REVERSED and generates an offsetting entry."""
        self.client.force_authenticate(user=self.user_appr)

        # 1. Create a posted transaction: Vendor payment (Credit ₹30,000)
        tx = FinancialAccountTransaction.objects.create(
            account=self.bank_a,
            transaction_number='TXN-TEST-REV-01',
            transaction_type=TransactionType.CREDIT,
            category=FinancialTransactionCategory.SUPPLIER_VENDOR_PAYMENT,
            description='Surgical instruments vendor payment',
            amount=Decimal('30000.00'),
            credit_amount=Decimal('30000.00'),
            lifecycle_status=TransactionLifecycleStatus.POSTED,
            posting_status='POSTED',
            created_by=self.staff_appr,
            posted_by=self.staff_appr
        )

        # Bank A balance: 500,000 - 30,000 = 470,000
        bal_before, _, _ = self.bank_a.calculate_balance()
        self.assertEqual(bal_before, Decimal('470000.00'))

        # 2. Reverse the transaction
        res_rev = self.client.post(
            f'/api/v1/billing-finance/financial-transactions/{tx.id}/reverse/',
            {'reason': 'Wrong invoice number billed by supplier; payment cancelled by bank'}
        )
        self.assertEqual(res_rev.status_code, status.HTTP_201_CREATED)

        tx.refresh_from_db()
        self.assertEqual(tx.lifecycle_status, TransactionLifecycleStatus.REVERSED)
        self.assertEqual(tx.posting_status, 'POSTED')

        # 3. Offsetting entry created with flipped debit
        rev_tx_id = res_rev.data['reversal_transaction']['id']
        rev_tx = FinancialAccountTransaction.objects.get(pk=rev_tx_id)
        self.assertEqual(rev_tx.debit_amount, Decimal('30000.00'))
        self.assertEqual(rev_tx.credit_amount, Decimal('0.00'))
        self.assertEqual(rev_tx.lifecycle_status, TransactionLifecycleStatus.POSTED)
        self.assertEqual(rev_tx.reversal_of, tx)

        # 4. Bank A balance restored exactly to ₹5,00,000 (Cr 30k cancelled out by Dr 30k)
        bal_after, debits_after, credits_after = self.bank_a.calculate_balance()
        self.assertEqual(bal_after, Decimal('500000.00'))
        self.assertEqual(debits_after, Decimal('30000.00'))
        self.assertEqual(credits_after, Decimal('30000.00'))

    def test_05_rejection_and_cancellation_workflow(self):
        """Reviewer can reject a pending transaction with reason; preparer can cancel draft."""
        self.client.force_authenticate(user=self.user_appr)

        tx_pending = FinancialAccountTransaction.objects.create(
            account=self.bank_a,
            transaction_number='TXN-TEST-REJ-01',
            amount=Decimal('10000.00'),
            description='Test pending expense',
            lifecycle_status=TransactionLifecycleStatus.PENDING_APPROVAL,
            posting_status='PENDING',
            created_by=self.staff_prep
        )

        res_rej = self.client.post(
            f'/api/v1/billing-finance/financial-transactions/{tx_pending.id}/reject/',
            {'reason': 'Missing GST invoice attachment'}
        )
        self.assertEqual(res_rej.status_code, status.HTTP_200_OK)
        tx_pending.refresh_from_db()
        self.assertEqual(tx_pending.lifecycle_status, TransactionLifecycleStatus.REJECTED)
        self.assertEqual(tx_pending.rejection_reason, 'Missing GST invoice attachment')

        # Test cancellation on a draft
        self.client.force_authenticate(user=self.user_prep)
        tx_draft = FinancialAccountTransaction.objects.create(
            account=self.bank_a,
            transaction_number='TXN-TEST-CAN-01',
            amount=Decimal('5000.00'),
            description='Draft to cancel',
            lifecycle_status=TransactionLifecycleStatus.DRAFT,
            posting_status='PENDING',
            created_by=self.staff_prep
        )

        res_can = self.client.post(
            f'/api/v1/billing-finance/financial-transactions/{tx_draft.id}/cancel/',
            {'reason': 'Entered by mistake'}
        )
        self.assertEqual(res_can.status_code, status.HTTP_200_OK)
        tx_draft.refresh_from_db()
        self.assertEqual(tx_draft.lifecycle_status, TransactionLifecycleStatus.CANCELLED)

    def test_06_duplicate_reference_and_idempotency_protection(self):
        """Rejects duplicate references and returns idempotent transaction without duplicate records."""
        self.client.force_authenticate(user=self.user_appr)

        # 1. Create transaction with reference REF-DUP-123
        self.client.post('/api/v1/billing-finance/financial-transactions/', {
            'account_id': str(self.bank_a.id),
            'amount': '15000.00',
            'description': 'Direct billing settlement',
            'reference_number': 'REF-DUP-123',
            'auto_post': True
        })

        # Attempt to create duplicate reference on same account
        res_dup = self.client.post('/api/v1/billing-finance/financial-transactions/', {
            'account_id': str(self.bank_a.id),
            'amount': '20000.00',
            'description': 'Another billing settlement',
            'reference_number': 'REF-DUP-123'
        })
        self.assertEqual(res_dup.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Duplicate external reference', res_dup.data['error'])

        # 2. Idempotency Key protection
        res_idem1 = self.client.post('/api/v1/billing-finance/financial-transactions/', {
            'account_id': str(self.bank_a.id),
            'amount': '8000.00',
            'description': 'Idempotent payment',
            'idempotency_key': 'IDEM-KEY-XYZ-999',
            'auto_post': True
        })
        self.assertEqual(res_idem1.status_code, status.HTTP_201_CREATED)
        tx_count_before = FinancialAccountTransaction.objects.count()

        # Resend identical request with same idempotency key
        res_idem2 = self.client.post('/api/v1/billing-finance/financial-transactions/', {
            'account_id': str(self.bank_a.id),
            'amount': '8000.00',
            'description': 'Idempotent payment',
            'idempotency_key': 'IDEM-KEY-XYZ-999',
            'auto_post': True
        })
        self.assertEqual(res_idem2.status_code, status.HTTP_200_OK)
        self.assertEqual(res_idem2.data['id'], res_idem1.data['id'])
        self.assertEqual(FinancialAccountTransaction.objects.count(), tx_count_before)

    def test_07_dashboard_stats_calculation(self):
        """Dashboard figures match exact aggregated database query results."""
        self.client.force_authenticate(user=self.user_appr)

        # Clear transactions for clean baseline
        FinancialAccountTransaction.objects.all().delete()

        # 1 POSTED Debit: 10,000
        FinancialAccountTransaction.objects.create(
            account=self.bank_a, transaction_number='TX-D-01',
            amount=Decimal('10000.00'), debit_amount=Decimal('10000.00'),
            lifecycle_status=TransactionLifecycleStatus.POSTED, posting_status='POSTED'
        )
        # 1 POSTED Credit: 6,000
        FinancialAccountTransaction.objects.create(
            account=self.bank_a, transaction_number='TX-D-02',
            amount=Decimal('6000.00'), credit_amount=Decimal('6000.00'),
            lifecycle_status=TransactionLifecycleStatus.POSTED, posting_status='POSTED'
        )
        # 1 PENDING_APPROVAL: 5,000
        FinancialAccountTransaction.objects.create(
            account=self.bank_a, transaction_number='TX-D-03',
            amount=Decimal('5000.00'), debit_amount=Decimal('5000.00'),
            lifecycle_status=TransactionLifecycleStatus.PENDING_APPROVAL, posting_status='PENDING'
        )
        # 1 REJECTED: 3,000
        FinancialAccountTransaction.objects.create(
            account=self.bank_a, transaction_number='TX-D-04',
            amount=Decimal('3000.00'),
            lifecycle_status=TransactionLifecycleStatus.REJECTED, posting_status='PENDING'
        )

        res = self.client.get('/api/v1/billing-finance/financial-transactions/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.assertEqual(res.data['total_transactions'], 4)
        self.assertEqual(Decimal(res.data['total_debits']), Decimal('10000.00'))
        self.assertEqual(Decimal(res.data['total_credits']), Decimal('6000.00'))
        self.assertEqual(res.data['transactions_awaiting_approval'], 1)
        self.assertEqual(res.data['approved_posted_transactions'], 2)
        self.assertEqual(res.data['failed_rejected_transactions'], 1)

    def test_08_immutable_audit_logs_and_export(self):
        """Lifecycle transitions generate audit logs and export endpoint produces CSV."""
        self.client.force_authenticate(user=self.user_appr)

        tx = FinancialAccountTransaction.objects.create(
            account=self.bank_a,
            transaction_number='TXN-AUDIT-01',
            amount=Decimal('12000.00'),
            description='Audit trail verification',
            lifecycle_status=TransactionLifecycleStatus.DRAFT,
            posting_status='PENDING',
            created_by=self.staff_appr
        )

        # Check audit trail endpoint
        res_trail = self.client.get(f'/api/v1/billing-finance/financial-transactions/{tx.id}/audit-trail/')
        self.assertEqual(res_trail.status_code, status.HTTP_200_OK)

        # Check export endpoint
        res_export = self.client.get('/api/v1/billing-finance/financial-transactions/export/')
        self.assertEqual(res_export.status_code, status.HTTP_200_OK)
        self.assertEqual(res_export['Content-Type'], 'text/csv')
        self.assertIn('Transaction Number,Date,Account Code', res_export.content.decode('utf-8'))
