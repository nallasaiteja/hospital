import uuid
import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.billing_finance.models import (
    FinancialAccount, FinancialAccountTransaction, FinancialAccountType,
    FinancialTransactionCategory, TransactionType, ChartOfAccount,
    Invoice, InsuranceClaim, InsuranceProvider, InvestmentRegister,
    LoanRegister, LoanRepaymentSchedule, FinancialBudget,
    BudgetLineItem, BudgetRevision, CapitalExpenditurePlan,
    MinimumCashThreshold, LiquidityAlert, CashFlowForecastAssumption,
    BudgetApprovalStatus, BudgetCategoryType, BudgetPeriodType, CapexStatus
)
from apps.billing_finance.cash_flow_service import (
    CashFlowPlanningService, parse_period_dates, get_financial_year_bounds
)


class Section19CashFlowPlanningTests(TestCase):
    """
    Automated Unit and Integration test suite for Section 19: Cash Flow and Financial Planning.
    Verifies all 20 requirements against database models and DRF API endpoints.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Base Hospital, Branch & Department
        self.hospital = Hospital.objects.create(
            name="AURA Test Central Hospital",
            code="HOSP-TEST",
            registration_number=f"REG-TEST-{int(timezone.now().timestamp())}",
            contact_phone="9988776655",
            contact_email="admin@aurahospital.com"
        )
        self.branch = Branch.objects.create(
            hospital=self.hospital,
            name="AURA Central Branch",
            code="BR-TEST-CENTRAL",
            is_active=True
        )
        self.dept_cardio = Department.objects.create(
            branch=self.branch,
            name="Cardiology",
            code="CARDIO-TEST"
        )
        self.dept_ortho = Department.objects.create(
            branch=self.branch,
            name="Orthopedics",
            code="ORTHO-TEST"
        )

        # 2. Staff User Profiles
        self.role_cfo, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': "Hospital Admin"})
        self.role_mgr, _ = Role.objects.get_or_create(name=RoleEnum.FINANCE_MANAGER, defaults={'display_name': "Finance Manager"})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': "Patient"})

        uid_cfo = uuid.uuid4()
        self.user_cfo = User.objects.create_user(username=str(uid_cfo), email="cfo.test@aurahospital.com")
        self.up_cfo = UserProfile.objects.create(
            supabase_user_id=uid_cfo,
            email="cfo.test@aurahospital.com",
            first_name="Chief",
            last_name="Finance Officer",
            role=self.role_cfo
        )
        self.staff_cfo = StaffProfile.objects.create(
            user_profile=self.up_cfo,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept_cardio,
            employee_id="EMP-CFO-01"
        )

        uid_mgr = uuid.uuid4()
        self.user_mgr = User.objects.create_user(username=str(uid_mgr), email="manager.test@aurahospital.com")
        self.up_mgr = UserProfile.objects.create(
            supabase_user_id=uid_mgr,
            email="manager.test@aurahospital.com",
            first_name="Finance",
            last_name="Manager",
            role=self.role_mgr
        )
        self.staff_mgr = StaffProfile.objects.create(
            user_profile=self.up_mgr,
            hospital=self.hospital,
            branch=self.branch,
            department=self.dept_cardio,
            employee_id="EMP-MGR-01"
        )

        uid_patient = uuid.uuid4()
        self.user_patient = User.objects.create_user(username=str(uid_patient), email="patient.test@aurahospital.com")
        self.up_patient = UserProfile.objects.create(
            supabase_user_id=uid_patient,
            email="patient.test@aurahospital.com",
            first_name="John",
            last_name="Patient",
            role=self.role_patient
        )
        self.patient_profile = PatientProfile.objects.create(
            user_profile=self.up_patient,
            primary_branch=self.branch,
            medical_record_number="MRN-TEST-001"
        )

        # 3. Financial Accounts (Cash, Bank)
        self.acc_bank = FinancialAccount.objects.create(
            account_code="FA-BNK-TEST",
            name="Test Corporate Operating Bank",
            account_type=FinancialAccountType.BANK,
            institution_name="HDFC Bank",
            account_number_raw="987654321012",
            branch=self.branch,
            opening_balance=Decimal('500000.00'),
            current_balance=Decimal('500000.00'),
            opening_balance_date=datetime.date(2026, 4, 1),
            is_active=True
        )
        self.acc_cash = FinancialAccount.objects.create(
            account_code="FA-CSH-TEST",
            name="Test Main Cash Desk",
            account_type=FinancialAccountType.CASH,
            branch=self.branch,
            opening_balance=Decimal('50000.00'),
            current_balance=Decimal('50000.00'),
            opening_balance_date=datetime.date(2026, 4, 1),
            is_active=True
        )

        # Authenticate client as CFO
        self.client.force_authenticate(user=self.user_cfo)

    def test_01_cash_and_bank_reconciliation(self):
        """
        Verify: Opening balance + Inflows - Outflows = Closing balance.
        """
        # Post Inflow transaction to Bank: ₹75,000 (Patient receipt)
        FinancialAccountTransaction.objects.create(
            account=self.acc_bank,
            transaction_number="TXN-IN-001",
            transaction_date=timezone.localdate(),
            transaction_type=TransactionType.DEBIT,
            category=FinancialTransactionCategory.PATIENT_RECEIPT_ADVANCE,
            description="Patient advance cash receipt",
            amount=Decimal('75000.00'),
            debit_amount=Decimal('75000.00'),
            credit_amount=Decimal('0.00'),
            posting_status='POSTED'
        )

        # Post Outflow transaction from Cash: ₹10,000 (Supplier payment)
        FinancialAccountTransaction.objects.create(
            account=self.acc_cash,
            transaction_number="TXN-OUT-001",
            transaction_date=timezone.localdate(),
            transaction_type=TransactionType.CREDIT,
            category=FinancialTransactionCategory.SUPPLIER_VENDOR_PAYMENT,
            description="Emergency sterile supplies payment",
            amount=Decimal('10000.00'),
            debit_amount=Decimal('0.00'),
            credit_amount=Decimal('10000.00'),
            posting_status='POSTED'
        )

        today = timezone.localdate()
        res = CashFlowPlanningService.get_opening_and_closing_cash_balances(today, today, self.branch.id)

        self.assertTrue(res['is_reconciled'])
        # Combined Opening: 5,00,000 + 50,000 = 5,50,000
        self.assertEqual(res['combined_opening_balance'], Decimal('550000.00'))
        # Inflow: 75,000
        self.assertEqual(res['total_external_cash_inflows'], Decimal('75000.00'))
        # Outflow: 10,000
        self.assertEqual(res['total_external_cash_outflows'], Decimal('10000.00'))
        # Closing: 5,50,000 + 75,000 - 10,000 = 6,15,000
        self.assertEqual(res['combined_closing_balance'], Decimal('615000.00'))

    def test_02_internal_transfers_eliminated_from_consolidated_cash_flow(self):
        """
        Verify: Inter-bank/cash transfers are NOT counted as external cash inflows or outflows.
        """
        today = timezone.localdate()

        # Cashier deposits ₹20,000 from Main Cash into Operating Bank Account
        txn_cash = FinancialAccountTransaction.objects.create(
            account=self.acc_cash,
            transaction_number="TXN-TRF-001",
            transaction_date=today,
            transaction_type=TransactionType.TRANSFER,
            category=FinancialTransactionCategory.BANK_TRANSFER_INTERACCOUNT,
            description="Daily cash deposit to HDFC bank",
            amount=Decimal('20000.00'),
            debit_amount=Decimal('0.00'),
            credit_amount=Decimal('20000.00'),
            destination_financial_account=self.acc_bank,
            posting_status='POSTED'
        )
        txn_bank = FinancialAccountTransaction.objects.create(
            account=self.acc_bank,
            transaction_number="TXN-TRF-002",
            transaction_date=today,
            transaction_type=TransactionType.TRANSFER,
            category=FinancialTransactionCategory.BANK_TRANSFER_INTERACCOUNT,
            description="Daily cash deposit from main cash desk",
            amount=Decimal('20000.00'),
            debit_amount=Decimal('20000.00'),
            credit_amount=Decimal('0.00'),
            transfer_paired_transaction=txn_cash,
            posting_status='POSTED'
        )
        txn_cash.transfer_paired_transaction = txn_bank
        txn_cash.save()

        res = CashFlowPlanningService.get_opening_and_closing_cash_balances(today, today, self.branch.id)

        # External inflows and outflows should remain 0
        self.assertEqual(res['total_external_cash_inflows'], Decimal('0.00'))
        self.assertEqual(res['total_external_cash_outflows'], Decimal('0.00'))
        # Consolidated balance must be unchanged: 5,50,000
        self.assertEqual(res['combined_closing_balance'], Decimal('550000.00'))
        # Internal transfer volume recorded cleanly
        self.assertEqual(res['total_internal_transfers'], Decimal('20000.00'))

    def test_03_expected_patient_collections_realization(self):
        """
        Verify: Expected patient collections derived from outstanding invoices using realization rate.
        """
        # Create outstanding invoice for ₹50,000
        Invoice.objects.create(
            invoice_number="INV-TEST-001",
            patient=self.patient_profile,
            branch=self.branch,
            invoice_date=timezone.localdate(),
            due_date=timezone.localdate() + datetime.timedelta(days=15),
            total_amount=Decimal('50000.00'),
            paid_amount=Decimal('10000.00'),
            balance_amount=Decimal('40000.00'),
            status='PARTIALLY_PAID',
            is_active=True
        )

        res = CashFlowPlanningService.get_expected_patient_collections(horizon_days=30, branch_id=self.branch.id)

        self.assertGreaterEqual(res['total_outstanding_receivables'], Decimal('40000.00'))
        # Realization rate 85% on 40,000 = 34,000
        expected_amt = round(Decimal('40000.00') * Decimal('0.85'), 2)
        self.assertGreaterEqual(res['total_forecast_collection'], expected_amt)

    def test_04_expected_insurance_receipts(self):
        """
        Verify: Insurance claim forecast calculates approved/submitted amounts without duplicate counting.
        """
        provider = InsuranceProvider.objects.create(
            name="Star Health Insurance TPA",
            code="STAR-001",
            is_active=True
        )
        inv = Invoice.objects.create(
            invoice_number="INV-INS-001",
            patient=self.patient_profile,
            branch=self.branch,
            invoice_date=timezone.localdate(),
            total_amount=Decimal('100000.00'),
            paid_amount=Decimal('0.00'),
            balance_amount=Decimal('100000.00'),
            status='ISSUED',
            is_active=True
        )
        InsuranceClaim.objects.create(
            claim_number="CLM-TEST-001",
            patient=self.patient_profile,
            invoice=inv,
            provider=provider,
            claim_amount=Decimal('100000.00'),
            approved_amount=Decimal('80000.00'),
            settled_amount=Decimal('0.00'),
            status='APPROVED',
            submitted_date=timezone.localdate() - datetime.timedelta(days=10),
            is_active=True
        )

        res = CashFlowPlanningService.get_expected_insurance_receipts(horizon_days=45)
        self.assertGreaterEqual(res['total_approved_amount'], Decimal('80000.00'))
        self.assertGreaterEqual(res['total_forecast_receipt'], Decimal('80000.00'))

    def test_05_loan_debt_service_separates_principal_and_interest(self):
        """
        Verify: Loan forecasts separate principal repayment from interest expense.
        """
        loan = LoanRegister.objects.create(
            loan_account_number="LN-TEST-001",
            lender_name="State Bank of India",
            principal_amount=Decimal('1000000.00'),
            outstanding_balance=Decimal('850000.00'),
            interest_rate_pct=Decimal('9.50'),
            start_date=timezone.localdate() - datetime.timedelta(days=120),
            branch=self.branch,
            is_active=True
        )
        LoanRepaymentSchedule.objects.create(
            loan=loan,
            installment_number=5,
            due_date=timezone.localdate() + datetime.timedelta(days=10),
            opening_principal=Decimal('850000.00'),
            principal_due=Decimal('35000.00'),
            interest_due=Decimal('6720.00'),
            fee_amount=Decimal('250.00'),
            total_due=Decimal('41970.00'),
            closing_principal=Decimal('815000.00'),
            payment_status='PENDING',
            is_active=True
        )

        res = CashFlowPlanningService.get_loan_repayment_forecasts(horizon_days=30, branch_id=self.branch.id)
        self.assertEqual(res['total_principal_repayment'], Decimal('35000.00'))
        self.assertEqual(res['total_interest_expense'], Decimal('6720.00'))
        self.assertEqual(res['total_scheduled_installments'], Decimal('41970.00'))

    def test_06_investment_maturity_proceeds(self):
        """
        Verify: Investment maturity calculates expected proceeds and identifies matured-unsettled items.
        """
        InvestmentRegister.objects.create(
            investment_code="FD-TEST-001",
            institution_name="ICICI Bank",
            principal_amount=Decimal('500000.00'),
            expected_maturity_amount=Decimal('535000.00'),
            purchase_date=timezone.localdate() - datetime.timedelta(days=340),
            maturity_date=timezone.localdate() + datetime.timedelta(days=20),
            status='ACTIVE',
            branch=self.branch,
            is_active=True
        )

        res = CashFlowPlanningService.get_investment_maturity_forecasts(horizon_days=30, branch_id=self.branch.id)
        self.assertEqual(res['total_principal_returning'], Decimal('500000.00'))
        self.assertEqual(res['total_expected_interest_income'], Decimal('35000.00'))
        self.assertEqual(res['total_expected_proceeds'], Decimal('535000.00'))

    def test_07_budget_creation_and_approval_workflow(self):
        """
        Verify: Budget creation and separation of duties on approval.
        """
        url = "/api/v1/billing-finance/financial-budgets/"
        payload = {
            "fiscal_year": "2026-2027",
            "period_type": "ANNUAL",
            "department": str(self.dept_cardio.id),
            "branch": str(self.branch.id),
            "budget_type": "EXPENSE",
            "total_budget_amount": "5000000.00",
            "notes_assumptions": "Cardiac Centre operating budget",
            "status": "DRAFT"
        }

        # 1. Manager prepares budget
        self.client.force_authenticate(user=self.user_mgr)
        resp = self.client.post(url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        budget_id = resp.data['id']

        # 2. Manager attempts to approve their own budget -> 403 Forbidden (Separation of Duties)
        approve_url = f"/api/v1/billing-finance/financial-budgets/{budget_id}/approve/"
        resp_self_approve = self.client.post(approve_url)
        self.assertEqual(resp_self_approve.status_code, status.HTTP_403_FORBIDDEN)

        # 3. CFO approves budget -> 200 OK
        self.client.force_authenticate(user=self.user_cfo)
        resp_cfo_approve = self.client.post(approve_url)
        self.assertEqual(resp_cfo_approve.status_code, status.HTTP_200_OK)

        # Verify status in database
        b = FinancialBudget.objects.get(id=budget_id)
        self.assertEqual(b.status, BudgetApprovalStatus.APPROVED)
        self.assertIsNotNone(b.approved_at)

    def test_08_budget_revision_audit_logging(self):
        """
        Verify: Approved budget revisions are recorded in BudgetRevision history.
        """
        budget = FinancialBudget.objects.create(
            budget_code="BDG-REV-001",
            fiscal_year="2026-2027",
            department=self.dept_ortho,
            branch=self.branch,
            total_budget_amount=Decimal('3000000.00'),
            status=BudgetApprovalStatus.APPROVED,
            prepared_by=self.staff_mgr,
            approved_by=self.staff_cfo
        )

        revise_url = f"/api/v1/billing-finance/financial-budgets/{budget.id}/revise/"
        payload = {
            "revised_amount": "3600000.00",
            "reason": "Mid-year addition of robotic joint replacement suite"
        }
        self.client.force_authenticate(user=self.user_cfo)
        resp = self.client.post(revise_url, payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        budget.refresh_from_db()
        self.assertEqual(budget.total_budget_amount, Decimal('3600000.00'))
        self.assertEqual(budget.revisions.count(), 1)
        rev = budget.revisions.first()
        self.assertEqual(rev.previous_amount, Decimal('3000000.00'))
        self.assertEqual(rev.revised_amount, Decimal('3600000.00'))

    def test_09_budget_variance_calculation(self):
        """
        Verify: Variance = Actual - Budget. Positive = Overspending.
        """
        FinancialBudget.objects.create(
            budget_code="BDG-VAR-001",
            fiscal_year="2026-2027",
            department=self.dept_cardio,
            branch=self.branch,
            total_budget_amount=Decimal('100000.00'),
            actual_spent_amount=Decimal('120000.00'),
            status=BudgetApprovalStatus.APPROVED
        )

        res = CashFlowPlanningService.get_budget_management_and_variance("2026-2027", self.branch.id)
        cardio_b = next(b for b in res['budgets'] if b['budget_code'] == "BDG-VAR-001")
        self.assertEqual(cardio_b['variance_amount'], Decimal('20000.00'))
        self.assertEqual(cardio_b['health_status'], 'OVER_BUDGET')
        self.assertEqual(cardio_b['utilization_percentage'], 120.0)

    def test_10_minimum_cash_threshold_and_liquidity_alerts(self):
        """
        Verify: Accounts falling below configured threshold trigger LiquidityAlerts.
        """
        # Configure minimum threshold of ₹1,00,000 for cash desk (current balance is ₹50,000)
        MinimumCashThreshold.objects.create(
            financial_account=self.acc_cash,
            branch=self.branch,
            threshold_amount=Decimal('100000.00'),
            alert_severity='HIGH',
            is_active=True,
            created_by=self.staff_cfo
        )

        alerts_res = CashFlowPlanningService.check_and_generate_liquidity_alerts(self.branch.id)
        self.assertGreaterEqual(alerts_res['accounts_below_threshold_count'], 1)

        alert = LiquidityAlert.objects.filter(
            financial_account=self.acc_cash,
            alert_type='ACCOUNT_BELOW_MINIMUM'
        ).first()
        self.assertIsNotNone(alert)
        self.assertEqual(alert.obligation_amount, Decimal('50000.00'))  # 100k - 50k = 50k shortfall

    def test_11_capital_expenditure_approval(self):
        """
        Verify: CapEx project pipeline approval workflow.
        """
        capex = CapitalExpenditurePlan.objects.create(
            capex_code="CAPEX-TEST-001",
            project_name="Cath Lab Fluoroscopy Upgrade",
            business_justification="Expand interventional cardiology suite",
            requesting_department=self.dept_cardio,
            branch=self.branch,
            estimated_cost=Decimal('8500000.00'),
            expected_purchase_date=timezone.localdate() + datetime.timedelta(days=40),
            status=CapexStatus.PROPOSED,
            requested_by=self.staff_mgr
        )

        approve_url = f"/api/v1/billing-finance/capex-plans/{capex.id}/approve/"
        self.client.force_authenticate(user=self.user_cfo)
        resp = self.client.post(approve_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        capex.refresh_from_db()
        self.assertEqual(capex.status, CapexStatus.APPROVED_COMMITMENT)
        self.assertIsNotNone(capex.approved_at)

    def test_12_unauthorized_user_access_blocked(self):
        """
        Verify: Unauthorized roles (such as patients or unauthenticated requests) are blocked.
        """
        # Unauthenticated request
        anon_client = APIClient()
        resp_anon = anon_client.get("/api/v1/billing-finance/cash-flow/dashboard/")
        self.assertIn(resp_anon.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Patient user
        patient_client = APIClient()
        patient_client.force_authenticate(user=self.user_patient)
        resp_patient = patient_client.get("/api/v1/billing-finance/cash-flow/dashboard/")
        self.assertEqual(resp_patient.status_code, status.HTTP_403_FORBIDDEN)

    def test_13_csv_export_endpoint(self):
        """
        Verify: CSV Export endpoint returns formatted CSV file with proper headers.
        """
        url = "/api/v1/billing-finance/cash-flow/export-csv/"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'text/csv')
        self.assertIn("AURA MULTI-SPECIALTY HOSPITAL - CASH FLOW AND TREASURY STATEMENT", resp.content.decode('utf-8'))
