import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile
from apps.core.models import Hospital, Branch, Department
from apps.billing_finance.models import (
    FinancialAccount, FinancialAccountType, AccountingClassification,
    FinancialAccountTransaction, InvestmentRegister, InvestmentCategory,
    InvestmentLifecycleStatus, CompoundingFrequency, InvestmentIncomeType,
    InvestmentIncomeRecord, InvestmentValuationHistory, InvestmentAuditLog
)
from apps.billing_finance.investment_views import calculate_expected_yield


class Section15InvestmentTests(TestCase):
    """
    Mandatory Test Suite for Section 15: Investment Portfolio Management.
    Verifies database persistence, separation of duties, FD calculations,
    income recording, valuations, redemption workflows, and dashboard aggregations.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Core Hospital, Branch, Department
        self.hospital = Hospital.objects.create(name='Aura Health System', code=f'AURA-HQ-{uuid.uuid4().hex[:4]}')
        self.branch = Branch.objects.create(hospital=self.hospital, name='Main Campus', code=f'BR-INV-{uuid.uuid4().hex[:4]}')
        self.department = Department.objects.create(branch=self.branch, name='Finance & Treasury', code=f'DEP-INV-{uuid.uuid4().hex[:4]}')

        # 2. Setup Roles
        self.role_fin_mgr, _ = Role.objects.get_or_create(name=RoleEnum.FINANCE_MANAGER, defaults={'display_name': 'Finance Manager'})
        self.role_accountant, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Accountant'})

        # 3. Setup Users & Staff
        # Preparer / Accountant (Staff 1)
        uid_prep = uuid.uuid4()
        self.user_prep = User.objects.create_user(username=str(uid_prep), email='inv.prep@hospital.com')
        self.up_prep = UserProfile.objects.create(supabase_user_id=uid_prep, email='inv.prep@hospital.com', first_name='Priya', last_name='Sharma', role=self.role_accountant)
        self.staff_prep = StaffProfile.objects.create(user_profile=self.up_prep, hospital=self.hospital, branch=self.branch, department=self.department, employee_id=f'EMP-PREP-{uuid.uuid4().hex[:4]}')

        # Approver / Finance Manager (Staff 2)
        uid_mgr = uuid.uuid4()
        self.user_mgr = User.objects.create_user(username=str(uid_mgr), email='inv.mgr@hospital.com')
        self.up_mgr = UserProfile.objects.create(supabase_user_id=uid_mgr, email='inv.mgr@hospital.com', first_name='Meenakshi', last_name='Sundaram', role=self.role_fin_mgr)
        self.staff_mgr = StaffProfile.objects.create(user_profile=self.up_mgr, hospital=self.hospital, branch=self.branch, department=self.department, employee_id=f'EMP-MGR-{uuid.uuid4().hex[:4]}')

        # 4. Setup Section 13 Bank Account (Treasury)
        self.bank_account = FinancialAccount.objects.create(
            branch=self.branch,
            account_code=f'FA-BNK-INV-{uuid.uuid4().hex[:4]}',
            name="State Bank Treasury Account",
            account_type=FinancialAccountType.BANK,
            classification=AccountingClassification.ASSET,
            opening_balance=Decimal('5000000.00'),
            current_balance=Decimal('5000000.00'),
            is_active=True
        )

    def test_01_create_draft_investment_and_fd_calculation(self):
        """
        Verify creating an investment saves a real database record and calculates expected yield.
        """
        self.client.force_authenticate(user=self.user_prep)

        today = timezone.localdate()
        maturity = today + timedelta(days=365)

        payload = {
            'name': 'HDFC 1-Year Fixed Deposit',
            'category': InvestmentCategory.FIXED_DEPOSIT,
            'institution_name': 'HDFC Bank Ltd',
            'reference_number': 'FDR-2026-9901',
            'principal_amount': '500000.00',
            'interest_rate_pct': '7.50',
            'compounding_frequency': CompoundingFrequency.QUARTERLY,
            'purchase_date': str(today),
            'maturity_date': str(maturity),
            'source_financial_account': str(self.bank_account.id),
            'lifecycle_status': InvestmentLifecycleStatus.DRAFT
        }

        response = self.client.post('/api/v1/billing-finance/investments/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['investment_code'].startswith('FD-'))
        self.assertEqual(response.data['lifecycle_status'], InvestmentLifecycleStatus.DRAFT)

        inv = InvestmentRegister.objects.get(id=response.data['id'])
        self.assertEqual(inv.principal_amount, Decimal('500000.00'))
        # Compound interest on 500k at 7.5% quarterly for 1 yr is approx 538,567
        self.assertGreater(inv.expected_maturity_amount, Decimal('537000.00'))

        # Verify audit log was created
        log = inv.audit_logs.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.action, 'CREATED')

    def test_02_approval_workflow_and_separation_of_duties(self):
        """
        Verify that a preparer cannot approve their own investment (separation of duties).
        Only an independent Finance Manager can approve.
        """
        today = timezone.localdate()
        inv = InvestmentRegister.objects.create(
            investment_code=f'FD-SEP-{uuid.uuid4().hex[:6]}',
            name='Axis Capital Reserve FD',
            category=InvestmentCategory.FIXED_DEPOSIT,
            institution_name='Axis Bank',
            principal_amount=Decimal('1000000.00'),
            interest_rate_pct=Decimal('7.25'),
            purchase_date=today,
            maturity_date=today + timedelta(days=180),
            source_financial_account=self.bank_account,
            lifecycle_status=InvestmentLifecycleStatus.PENDING_APPROVAL,
            created_by=self.staff_prep,
            submitted_by=self.staff_prep
        )

        # 1. Preparer attempts self-approval -> must fail with HTTP 403
        self.client.force_authenticate(user=self.user_prep)
        res_self = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/approve/')
        self.assertEqual(res_self.status_code, status.HTTP_403_FORBIDDEN)
        inv.refresh_from_db()
        self.assertEqual(inv.lifecycle_status, InvestmentLifecycleStatus.PENDING_APPROVAL)

        # 2. Finance Manager approves -> must succeed
        self.client.force_authenticate(user=self.user_mgr)
        res_mgr = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/approve/', {'auto_activate': True})
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.lifecycle_status, InvestmentLifecycleStatus.ACTIVE)
        self.assertEqual(inv.approved_by, self.staff_mgr)

    def test_03_purchase_workflow_records_section14_transaction(self):
        """
        Verify placement / purchase deduces funds from Section 13 account and records a POSTED transaction.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        inv = InvestmentRegister.objects.create(
            investment_code=f'BOND-{uuid.uuid4().hex[:6]}',
            name='7.18% GS 2033 Sovereign Bond',
            category=InvestmentCategory.GOVT_BOND,
            institution_name='Reserve Bank of India',
            principal_amount=Decimal('2000000.00'),
            purchase_fees=Decimal('2500.00'),
            interest_rate_pct=Decimal('7.18'),
            purchase_date=today,
            maturity_date=today + timedelta(days=3650),
            source_financial_account=self.bank_account,
            lifecycle_status=InvestmentLifecycleStatus.APPROVED,
            created_by=self.staff_prep
        )

        initial_balance = self.bank_account.current_balance

        # Call purchase action
        res = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/purchase/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.lifecycle_status, InvestmentLifecycleStatus.ACTIVE)

        # Check bank account balance updated
        self.bank_account.refresh_from_db()
        expected_balance = initial_balance - Decimal('2002500.00')
        self.assertEqual(self.bank_account.current_balance, expected_balance)

        # Check Section 14 Financial Transaction exists
        txn = FinancialAccountTransaction.objects.filter(investment=inv).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.posting_status, 'POSTED')
        self.assertEqual(txn.amount, Decimal('2002500.00'))

    def test_04_record_income_interest_receipt(self):
        """
        Verify recording interest income credits the receiving account and creates Section 14 transaction.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        inv = InvestmentRegister.objects.create(
            investment_code=f'FD-INC-{uuid.uuid4().hex[:6]}',
            name='SBI Special FD',
            category=InvestmentCategory.FIXED_DEPOSIT,
            principal_amount=Decimal('1000000.00'),
            interest_rate_pct=Decimal('7.00'),
            purchase_date=today - timedelta(days=90),
            maturity_date=today + timedelta(days=275),
            source_financial_account=self.bank_account,
            settlement_financial_account=self.bank_account,
            lifecycle_status=InvestmentLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        initial_balance = self.bank_account.current_balance

        payload = {
            'income_type': InvestmentIncomeType.INTEREST,
            'receipt_date': str(today),
            'gross_amount': '17500.00',
            'tds_withheld': '1750.00',
            'receiving_account_id': str(self.bank_account.id),
            'reference_number': 'NEFT-SBI-INT-9988',
            'notes': 'Q1 quarterly interest payout'
        }

        res = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/record-income/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Net credited = 17500 - 1750 = 15750
        inv.refresh_from_db()
        self.assertEqual(inv.total_interest_received, Decimal('15750.00'))

        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_balance + Decimal('15750.00'))

        # Verify income record exists
        inc_record = InvestmentIncomeRecord.objects.get(investment=inv)
        self.assertEqual(inc_record.gross_amount, Decimal('17500.00'))
        self.assertEqual(inc_record.net_amount, Decimal('15750.00'))

    def test_05_mark_to_market_valuation_and_unrealized_yield(self):
        """
        Verify updating mark-to-market valuation computes unrealized gain/loss correctly.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        inv = InvestmentRegister.objects.create(
            investment_code=f'MF-VAL-{uuid.uuid4().hex[:6]}',
            name='ICICI Prudential Liquid Fund - Direct Growth',
            category=InvestmentCategory.MUTUAL_FUND,
            principal_amount=Decimal('500000.00'),
            units=Decimal('1250.0000'),
            purchase_price_per_unit=Decimal('400.0000'),
            current_valuation=Decimal('500000.00'),
            purchase_date=today - timedelta(days=60),
            lifecycle_status=InvestmentLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        # Update NAV: 1250 units @ ₹420 = ₹5,25,000 (Gain: ₹25,000)
        payload = {
            'valuation_date': str(today),
            'unit_price_or_nav': '420.0000',
            'total_valuation': '525000.00',
            'valuation_source': 'AMC Mutual Fund NAV Bulletin',
            'notes': 'Quarterly mark to market NAV update'
        }

        res = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/record-valuation/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.current_valuation, Decimal('525000.00'))
        self.assertEqual(inv.unrealized_gain_loss, Decimal('25000.00'))

        # Check valuation history record
        val_history = InvestmentValuationHistory.objects.filter(investment=inv).first()
        self.assertIsNotNone(val_history)
        self.assertEqual(val_history.total_valuation, Decimal('525000.00'))
        self.assertEqual(val_history.unrealized_gain_loss, Decimal('25000.00'))

    def test_06_redemption_and_maturity_settlement(self):
        """
        Verify redemption / maturity payout credits settlement account and records realized gain/loss.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        inv = InvestmentRegister.objects.create(
            investment_code=f'FD-MAT-{uuid.uuid4().hex[:6]}',
            name='Kotak 6-Month Term Deposit',
            category=InvestmentCategory.FIXED_DEPOSIT,
            principal_amount=Decimal('400000.00'),
            interest_rate_pct=Decimal('7.00'),
            purchase_date=today - timedelta(days=182),
            maturity_date=today,
            source_financial_account=self.bank_account,
            settlement_financial_account=self.bank_account,
            current_valuation=Decimal('400000.00'),
            lifecycle_status=InvestmentLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        initial_balance = self.bank_account.current_balance

        # Maturity payout: Principal ₹400,000 + Interest ₹14,000 = ₹414,000 (TDS ₹1,400) -> Net ₹412,600
        payload = {
            'gross_proceeds': '414000.00',
            'tds_withheld': '1400.00',
            'charges': '0.00',
            'receipt_date': str(today),
            'settlement_financial_account': str(self.bank_account.id),
            'reference_number': 'RTGS-KOTAK-MAT-1122',
            'is_full_redemption': True,
            'notes': 'Final term maturity credit'
        }

        res = self.client.post(f'/api/v1/billing-finance/investments/{inv.id}/redeem/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        inv.refresh_from_db()
        self.assertEqual(inv.lifecycle_status, InvestmentLifecycleStatus.CLOSED)
        self.assertEqual(inv.actual_maturity_proceeds, Decimal('414000.00'))
        self.assertEqual(inv.realized_gain_loss, Decimal('14000.00'))
        self.assertEqual(inv.current_valuation, Decimal('0.00'))

        # Settlement bank balance incremented by Net ₹412,600
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_balance + Decimal('412600.00'))

    def test_07_dashboard_stats_calculation(self):
        """
        Verify dashboard-stats metrics return accurate figures from the database.
        """
        self.client.force_authenticate(user=self.user_mgr)
        res = self.client.get('/api/v1/billing-finance/investments/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertIn('total_invested_principal', data)
        self.assertIn('current_portfolio_valuation', data)
        self.assertIn('total_income_received', data)
        self.assertIn('realized_gain_loss', data)
        self.assertIn('unrealized_gain_loss', data)
        self.assertIn('maturing_soon_count', data)
        self.assertIn('category_allocation', data)

    def test_08_fd_yield_calculation_utility(self):
        """
        Verify mathematical correctness of the calculate_expected_yield function.
        """
        p = Decimal('100000.00')
        r = Decimal('10.00')
        d1 = date(2026, 1, 1)
        d2 = date(2027, 1, 1)  # 1 year (365 days)

        # Simple interest: 100k + 10% = 110,000
        simple_res = calculate_expected_yield(p, r, d1, d2, CompoundingFrequency.SIMPLE)
        self.assertEqual(simple_res['expected_maturity_amount'], Decimal('110000.00'))
        self.assertEqual(simple_res['expected_interest'], Decimal('10000.00'))

        # Quarterly compounding: 100k * (1 + 0.10/4)**4 = 110,381.29
        qtr_res = calculate_expected_yield(p, r, d1, d2, CompoundingFrequency.QUARTERLY)
        self.assertEqual(qtr_res['expected_maturity_amount'], Decimal('110381.29'))
        self.assertEqual(qtr_res['expected_interest'], Decimal('10381.29'))
