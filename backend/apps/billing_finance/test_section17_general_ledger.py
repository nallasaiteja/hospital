import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile
from apps.billing_finance.models import (
    ChartOfAccount, AccountCategory, AccountCategoryType, AccountSubType,
    FiscalYear, AccountingPeriod, AccountingPeriodAuditLog,
    JournalEntry, JournalLineItem, JournalVoucherType, JournalStatus,
    JournalAuditLog, FinancialAccount, FinancialAccountTransaction,
    TransactionLifecycleStatus, TransactionType, FinancialTransactionCategory
)
from apps.billing_finance.general_ledger_service import GeneralLedgerService

User = get_user_model()


class Section17GeneralLedgerTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Hospital Organization Structure
        self.hospital = Hospital.objects.create(name='Apex Super Specialty Hospital', code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch = Branch.objects.create(hospital=self.hospital, name='South City Campus', code=f"BR-{uuid.uuid4().hex[:4].upper()}")
        self.dept_finance = Department.objects.create(branch=self.branch, name='Finance & Treasury', code=f"FIN-{uuid.uuid4().hex[:4].upper()}")

        # 2. Roles
        self.role_accountant, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Senior Accountant'})
        self.role_admin, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Finance Director / Admin'})
        self.role_nurse, _ = Role.objects.get_or_create(name=RoleEnum.NURSE, defaults={'display_name': 'Clinical Nurse'})

        # 3. Preparer / Senior Accountant
        uid_prep = uuid.uuid4()
        self.user_prep = User.objects.create_user(username=str(uid_prep), email='preparer@hospital.com')
        self.up_prep = UserProfile.objects.create(
            supabase_user_id=uid_prep, email='preparer@hospital.com',
            first_name='Anil', last_name='Mehta', role=self.role_accountant
        )
        self.staff_prep = StaffProfile.objects.create(
            user_profile=self.up_prep, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"EMP-PREP-{uuid.uuid4().hex[:4].upper()}", designation='Accountant', status='ACTIVE'
        )

        # 4. Approver / Finance Director
        uid_appr = uuid.uuid4()
        self.user_appr = User.objects.create_user(username=str(uid_appr), email='approver@hospital.com')
        self.up_appr = UserProfile.objects.create(
            supabase_user_id=uid_appr, email='approver@hospital.com',
            first_name='Sunita', last_name='Sharma', role=self.role_admin
        )
        self.staff_appr = StaffProfile.objects.create(
            user_profile=self.up_appr, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"EMP-DIR-{uuid.uuid4().hex[:4].upper()}", designation='Finance Director', status='ACTIVE'
        )

        # 5. Unauthorized User (Clinical Nurse)
        uid_nurse = uuid.uuid4()
        self.user_nurse = User.objects.create_user(username=str(uid_nurse), email='nurse@hospital.com')
        self.up_nurse = UserProfile.objects.create(
            supabase_user_id=uid_nurse, email='nurse@hospital.com',
            first_name='Kavita', last_name='Patel', role=self.role_nurse
        )

        # 6. Initialize Standard Chart of Accounts & Fiscal Year Periods
        GeneralLedgerService.ensure_standard_chart_of_accounts(self.branch)
        self.fy = GeneralLedgerService.ensure_default_fiscal_year_and_periods()

        self.acc_cash = ChartOfAccount.objects.get(account_code='1010')
        self.acc_bank = ChartOfAccount.objects.get(account_code='1020')
        self.acc_patient_ar = ChartOfAccount.objects.get(account_code='1030')
        self.acc_supplier_ap = ChartOfAccount.objects.get(account_code='2010')
        self.acc_opd_rev = ChartOfAccount.objects.get(account_code='4010')
        self.acc_salaries = ChartOfAccount.objects.get(account_code='5010')

    # =========================================================================
    # TEST 1: Balanced Journal Voucher Creation & Direct Posting
    # =========================================================================
    def test_01_create_and_post_balanced_journal(self):
        """Verifies a balanced journal voucher (Debits == Credits) posts and updates account balances."""
        self.client.force_authenticate(user=self.user_prep)
        payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Cash deposited into operating bank account',
            'branch_id': str(self.branch.id),
            'status': JournalStatus.POSTED,
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '50000.00', 'credit_amount': '0.00', 'description': 'Bank receipt'},
                {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '50000.00', 'description': 'Cash vault withdrawal'}
            ]
        }
        res = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], JournalStatus.POSTED)
        self.assertEqual(res.data['is_posted'], True)
        self.assertEqual(Decimal(res.data['total_debit']), Decimal('50000.00'))
        self.assertEqual(Decimal(res.data['total_credit']), Decimal('50000.00'))

        # Verify running balance updates:
        # Bank (Asset): +50000.00
        # Cash (Asset): -50000.00
        self.acc_bank.refresh_from_db()
        self.acc_cash.refresh_from_db()
        self.assertEqual(self.acc_bank.current_balance, Decimal('50000.00'))
        self.assertEqual(self.acc_cash.current_balance, Decimal('-50000.00'))

    # =========================================================================
    # TEST 2: Unbalanced Journal Voucher Rejected
    # =========================================================================
    def test_02_unbalanced_journal_rejected(self):
        """Verifies backend strictly rejects unbalanced journals (Debits != Credits)."""
        self.client.force_authenticate(user=self.user_prep)
        payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Unbalanced fraud attempt',
            'branch_id': str(self.branch.id),
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '50000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '40000.00'}  # Variance 10,000
            ]
        }
        res = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Variance', res.data.get('error', ''))

    # =========================================================================
    # TEST 3: Negative Amounts and Inactive/Invalid Accounts Rejected
    # =========================================================================
    def test_03_negative_amounts_and_inactive_accounts_rejected(self):
        """Verifies negative numbers and inactive ledger accounts cannot be posted."""
        self.client.force_authenticate(user=self.user_prep)

        # 3A: Negative amount
        neg_payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Negative line',
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '-5000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '-5000.00'}
            ]
        }
        res_neg = self.client.post('/api/v1/billing-finance/journal-entries/', neg_payload, format='json')
        self.assertEqual(res_neg.status_code, status.HTTP_400_BAD_REQUEST)

        # 3B: Inactive account
        self.acc_cash.is_active = False
        self.acc_cash.save()

        inactive_payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Posting to inactive account',
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '5000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '5000.00'}
            ]
        }
        res_inactive = self.client.post('/api/v1/billing-finance/journal-entries/', inactive_payload, format='json')
        self.assertEqual(res_inactive.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('INACTIVE', res_inactive.data.get('error', ''))

    # =========================================================================
    # TEST 4: Full Voucher Workflow (Draft -> Pending -> Approved -> Posted)
    # =========================================================================
    def test_04_journal_voucher_lifecycle(self):
        """Verifies step-by-step voucher approval workflow with separation of duties."""
        self.client.force_authenticate(user=self.user_prep)

        # Step 1: Create Draft Voucher
        draft_payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Consultation revenue adjustment voucher',
            'branch_id': str(self.branch.id),
            'status': JournalStatus.DRAFT,
            'lines': [
                {'account_id': str(self.acc_patient_ar.id), 'debit_amount': '15000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '15000.00'}
            ]
        }
        res1 = self.client.post('/api/v1/billing-finance/journal-entries/', draft_payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        vid = res1.data['id']
        self.assertEqual(res1.data['status'], JournalStatus.DRAFT)
        self.assertEqual(res1.data['is_posted'], False)

        # Step 2: Submit for Approval
        res2 = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/submit-approval/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['status'], JournalStatus.PENDING_APPROVAL)

        # Step 3: Separation of Duties - Creator cannot self-approve
        res3_fail = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/approve/')
        self.assertEqual(res3_fail.status_code, status.HTTP_403_FORBIDDEN)

        # Step 4: Independent Finance Director Approves
        self.client.force_authenticate(user=self.user_appr)
        res4 = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/approve/', {'comments': 'Reviewed and authorized.'})
        self.assertEqual(res4.status_code, status.HTTP_200_OK)
        self.assertEqual(res4.data['status'], JournalStatus.APPROVED)

        # Step 5: Post Approved Voucher
        res5 = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/post/')
        self.assertEqual(res5.status_code, status.HTTP_200_OK)
        self.assertEqual(res5.data['status'], JournalStatus.POSTED)
        self.assertEqual(res5.data['is_posted'], True)

        # Verify revenue and AR balances
        self.acc_patient_ar.refresh_from_db()
        self.acc_opd_rev.refresh_from_db()
        self.assertEqual(self.acc_patient_ar.current_balance, Decimal('15000.00'))  # Asset + Dr
        self.assertEqual(self.acc_opd_rev.current_balance, Decimal('15000.00'))     # Revenue + Cr

    # =========================================================================
    # TEST 5: Reversal Entry Workflow
    # =========================================================================
    def test_05_reversal_entry_workflow(self):
        """Verifies posted entries are reversed via balanced offset vouchers with full audit trail."""
        self.client.force_authenticate(user=self.user_prep)
        post_payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Staff payroll payment entry',
            'branch_id': str(self.branch.id),
            'status': JournalStatus.POSTED,
            'lines': [
                {'account_id': str(self.acc_salaries.id), 'debit_amount': '75000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '75000.00'}
            ]
        }
        res = self.client.post('/api/v1/billing-finance/journal-entries/', post_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        vid = res.data['id']

        self.acc_salaries.refresh_from_db()
        self.acc_bank.refresh_from_db()
        self.assertEqual(self.acc_salaries.current_balance, Decimal('75000.00'))
        self.assertEqual(self.acc_bank.current_balance, Decimal('-75000.00'))

        # Perform Reversal
        self.client.force_authenticate(user=self.user_appr)
        rev_res = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/reverse/', {
            'reason': 'Payroll entry duplicated by batch system'
        })
        self.assertEqual(rev_res.status_code, status.HTTP_200_OK)
        reversal_data = rev_res.data['reversal_voucher']
        self.assertEqual(reversal_data['voucher_type'], JournalVoucherType.REVERSAL)
        self.assertEqual(reversal_data['status'], JournalStatus.POSTED)

        # Original voucher must be marked REVERSED
        orig_j = JournalEntry.objects.get(id=vid)
        self.assertEqual(orig_j.status, JournalStatus.REVERSED)

        # Accounts must be restored to zero
        self.acc_salaries.refresh_from_db()
        self.acc_bank.refresh_from_db()
        self.assertEqual(self.acc_salaries.current_balance, Decimal('0.00'))
        self.assertEqual(self.acc_bank.current_balance, Decimal('0.00'))

        # Duplicate reversal must be rejected
        rev_res2 = self.client.post(f'/api/v1/billing-finance/journal-entries/{vid}/reverse/', {'reason': 'Repeat'})
        self.assertEqual(rev_res2.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # TEST 6: Closed-Period Posting Restrictions
    # =========================================================================
    def test_06_closed_period_posting_restrictions(self):
        """Verifies postings to closed accounting periods are strictly blocked."""
        # Find period covering today and close it
        period = GeneralLedgerService.get_period_for_date(timezone.localdate())
        period.is_closed = True
        period.save()

        self.client.force_authenticate(user=self.user_prep)
        payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Posting into closed period',
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '1000.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '1000.00'}
            ]
        }
        res = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('CLOSED', res.data.get('error', ''))

        # Reopen period with justification
        self.client.force_authenticate(user=self.user_appr)
        reopen_res = self.client.post(f'/api/v1/billing-finance/accounting-periods/{period.id}/reopen-period/', {
            'reason': 'Auditor adjustment required'
        })
        self.assertEqual(reopen_res.status_code, status.HTTP_200_OK)
        period.refresh_from_db()
        self.assertFalse(period.is_closed)

        # Now posting must succeed
        self.client.force_authenticate(user=self.user_prep)
        res_ok = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_201_CREATED)

    # =========================================================================
    # TEST 7: Idempotency Protection Against Duplicate Postings
    # =========================================================================
    def test_07_idempotency_prevents_duplicate_entries(self):
        """Verifies duplicate posting requests with same idempotency key return existing journal."""
        self.client.force_authenticate(user=self.user_prep)
        key = f"IDEMP-{uuid.uuid4().hex}"
        payload = {
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Automated insurance settlement sync',
            'idempotency_key': key,
            'status': JournalStatus.POSTED,
            'lines': [
                {'account_id': str(self.acc_bank.id), 'debit_amount': '12500.00', 'credit_amount': '0.00'},
                {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '12500.00'}
            ]
        }
        res1 = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        first_id = res1.data['id']

        # Repeat identical call with same key
        res2 = self.client.post('/api/v1/billing-finance/journal-entries/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res2.data['id'], first_id)

        # Balance must NOT be double-counted (Bank should be +12500.00, not +25000.00)
        self.acc_bank.refresh_from_db()
        self.assertEqual(self.acc_bank.current_balance, Decimal('12500.00'))

    # =========================================================================
    # TEST 8: Auto-Posting From Existing Modules (Billing, Deposits, Loans)
    # =========================================================================
    def test_08_automatic_module_posting_and_source_linkage(self):
        """Verifies auto-posting connects modules to GL with idempotency and source links."""
        # Patient Cash Collection
        j1 = GeneralLedgerService.auto_post_module_event(
            event_type='PATIENT_CASH_COLLECTION',
            payload={
                'source_id': 'PAY-TEST-001',
                'source_module': 'BILLING_PAYMENTS',
                'amount': '3500.00',
                'payment_method': 'UPI',
                'reference': 'REC-TEST-001',
                'narration': 'OPD consultation collection',
                'branch_id': self.branch.id
            },
            staff_profile=self.staff_prep
        )
        self.assertIsNotNone(j1)
        self.assertEqual(j1.status, JournalStatus.POSTED)
        self.assertEqual(j1.source_module, 'BILLING_PAYMENTS')
        self.assertEqual(j1.source_transaction_id, 'PAY-TEST-001')

        # Patient Advance Deposit
        j2 = GeneralLedgerService.auto_post_module_event(
            event_type='PATIENT_ADVANCE',
            payload={
                'source_id': 'DEP-TEST-001',
                'source_module': 'PATIENT_DEPOSITS',
                'amount': '20000.00',
                'payment_method': 'CASH',
                'reference': 'DEP-REC-001',
                'branch_id': self.branch.id
            },
            staff_profile=self.staff_prep
        )
        self.assertIsNotNone(j2)
        acc_adv = ChartOfAccount.objects.get(account_code='2020')
        self.assertEqual(acc_adv.current_balance, Decimal('20000.00'))

        # Supplier Invoice
        j3 = GeneralLedgerService.auto_post_module_event(
            event_type='SUPPLIER_INVOICE',
            payload={
                'source_id': 'SUP-INV-001',
                'source_module': 'SUPPLIER_PROCUREMENT',
                'amount': '45000.00',
                'reference': 'PO-9921',
                'branch_id': self.branch.id
            },
            staff_profile=self.staff_prep
        )
        self.assertIsNotNone(j3)
        self.acc_supplier_ap.refresh_from_db()
        self.assertEqual(self.acc_supplier_ap.current_balance, Decimal('45000.00'))

    # =========================================================================
    # TEST 9: General Ledger Account Register Running Balances
    # =========================================================================
    def test_09_general_ledger_register_running_balance(self):
        """Verifies row-by-row running balances calculate accurately from posted entries."""
        # Post 3 consecutive vouchers on bank account
        GeneralLedgerService.create_journal_voucher({
            'entry_date': '2026-10-01',
            'narration': 'Day 1 Deposit',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_bank.id, 'debit_amount': '10000.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_opd_rev.id, 'debit_amount': '0.00', 'credit_amount': '10000.00'}
            ]
        }, self.staff_prep)

        GeneralLedgerService.create_journal_voucher({
            'entry_date': '2026-10-02',
            'narration': 'Day 2 Utility Payment',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_salaries.id, 'debit_amount': '4000.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_bank.id, 'debit_amount': '0.00', 'credit_amount': '4000.00'}
            ]
        }, self.staff_prep)

        GeneralLedgerService.create_journal_voucher({
            'entry_date': '2026-10-03',
            'narration': 'Day 3 Patient Collection',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_bank.id, 'debit_amount': '6000.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_opd_rev.id, 'debit_amount': '0.00', 'credit_amount': '6000.00'}
            ]
        }, self.staff_prep)

        # Call General Ledger API
        self.client.force_authenticate(user=self.user_prep)
        res = self.client.get(f'/api/v1/billing-finance/general-ledger/?account_id={self.acc_bank.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        entries = res.data['entries']
        self.assertEqual(len(entries), 3)

        # Check running balances
        self.assertEqual(Decimal(entries[0]['running_balance']), Decimal('10000.00'))  # 0 + 10000
        self.assertEqual(Decimal(entries[1]['running_balance']), Decimal('6000.00'))   # 10000 - 4000
        self.assertEqual(Decimal(entries[2]['running_balance']), Decimal('12000.00'))  # 6000 + 6000
        self.assertEqual(Decimal(res.data['closing_balance']), Decimal('12000.00'))

    # =========================================================================
    # TEST 10: Trial Balance, Balance Sheet, P&L, and Cash Flow Reports
    # =========================================================================
    def test_10_financial_reports_reconcile_with_database(self):
        """Verifies Trial Balance balances and all financial statements reconcile with database records."""
        # 1. Post a sample balanced revenue entry
        GeneralLedgerService.create_journal_voucher({
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'OPD consultation revenue',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_bank.id, 'debit_amount': '25000.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_opd_rev.id, 'debit_amount': '0.00', 'credit_amount': '25000.00'}
            ]
        }, self.staff_prep)

        # 2. Post an operating expense entry
        GeneralLedgerService.create_journal_voucher({
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Clinical supplies expense',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_salaries.id, 'debit_amount': '10000.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_bank.id, 'debit_amount': '0.00', 'credit_amount': '10000.00'}
            ]
        }, self.staff_prep)

        self.client.force_authenticate(user=self.user_prep)

        # 10A: Trial Balance
        tb_res = self.client.get('/api/v1/billing-finance/trial-balance/')
        self.assertEqual(tb_res.status_code, status.HTTP_200_OK)
        self.assertTrue(tb_res.data['is_balanced'])
        self.assertEqual(Decimal(tb_res.data['total_debits']), Decimal(tb_res.data['total_credits']))

        # 10B: Profit and Loss
        pnl_res = self.client.get('/api/v1/billing-finance/profit-loss/')
        self.assertEqual(pnl_res.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(pnl_res.data['total_revenue']), Decimal('25000.00'))
        self.assertEqual(Decimal(pnl_res.data['total_expense']), Decimal('10000.00'))
        self.assertEqual(Decimal(pnl_res.data['net_surplus_or_profit']), Decimal('15000.00'))

        # 10C: Balance Sheet
        bs_res = self.client.get('/api/v1/billing-finance/balance-sheet/')
        self.assertEqual(bs_res.status_code, status.HTTP_200_OK)
        self.assertTrue(bs_res.data['is_balanced'])
        self.assertEqual(Decimal(bs_res.data['total_assets']), Decimal(bs_res.data['total_liabilities_and_equity']))

        # 10D: Cash Flow
        cf_res = self.client.get('/api/v1/billing-finance/cash-flow/')
        self.assertEqual(cf_res.status_code, status.HTTP_200_OK)
        # Net change in cash = Inflow (25000) - Outflow (10000) = 15000
        self.assertEqual(Decimal(cf_res.data['net_change_in_cash']), Decimal('15000.00'))

    # =========================================================================
    # TEST 11: Account Deactivation Prevention
    # =========================================================================
    def test_11_cannot_deactivate_account_with_posted_transactions(self):
        """Verifies accounts with posted transactions cannot be deactivated."""
        GeneralLedgerService.create_journal_voucher({
            'entry_date': timezone.localdate().isoformat(),
            'narration': 'Initial ledger entry',
            'status': JournalStatus.POSTED,
            'branch_id': self.branch.id,
            'lines': [
                {'account_id': self.acc_bank.id, 'debit_amount': '500.00', 'credit_amount': '0.00'},
                {'account_id': self.acc_cash.id, 'debit_amount': '0.00', 'credit_amount': '500.00'}
            ]
        }, self.staff_prep)

        self.client.force_authenticate(user=self.user_appr)
        res = self.client.post(f'/api/v1/billing-finance/chart-of-accounts/{self.acc_bank.id}/toggle-status/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('posted', res.data.get('error', '').lower())
        self.acc_bank.refresh_from_db()
        self.assertTrue(self.acc_bank.is_active)

    # =========================================================================
    # TEST 12: Cash Book and Bank Book Distinction
    # =========================================================================
    def test_12_cash_and_bank_books(self):
        """Verifies cash book and bank book views show actual movements."""
        self.client.force_authenticate(user=self.user_prep)
        res = self.client.get('/api/v1/billing-finance/cash-bank-book/?book_type=BANK')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('books', res.data)
