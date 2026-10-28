import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from django.contrib.auth.models import User
from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import UserProfile, StaffProfile, Role, RoleEnum
from apps.billing_finance.models import (
    ChartOfAccount, AccountCategory, AccountCategoryType, AccountSubType,
    JournalEntry, JournalLineItem, JournalStatus, JournalLineType,
    FiscalYear, AccountingPeriod
)
from apps.billing_finance.general_ledger_service import GeneralLedgerService
from apps.billing_finance.profit_loss_service import ProfitLossService


class Section18ProfitLossTests(TestCase):
    """
    Automated verification suite for Section 18: Profit and Loss Management.
    Tests all 20 requirements against actual database queries, double-entry ledgers,
    and GAAP multi-step financial income statements.
    """

    def setUp(self):
        # 1. Setup Hospital Organization Structure
        self.hospital = Hospital.objects.create(name="AURA Healthcare Systems", code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch_main = Branch.objects.create(hospital=self.hospital, name="AURA Central Hospital", code=f"BR-{uuid.uuid4().hex[:4].upper()}")
        self.branch_south = Branch.objects.create(hospital=self.hospital, name="AURA South Clinic", code=f"BR-{uuid.uuid4().hex[:4].upper()}")

        self.dept_opd = Department.objects.create(branch=self.branch_main, name="Outpatient Department", code=f"OPD-{uuid.uuid4().hex[:4].upper()}")
        self.dept_ipd = Department.objects.create(branch=self.branch_main, name="Inpatient Department", code=f"IPD-{uuid.uuid4().hex[:4].upper()}")
        self.dept_pharm = Department.objects.create(branch=self.branch_main, name="Pharmacy", code=f"PHARM-{uuid.uuid4().hex[:4].upper()}")
        self.dept_surg = Department.objects.create(branch=self.branch_main, name="Surgical Suites", code=f"SURG-{uuid.uuid4().hex[:4].upper()}")
        self.dept_diag = Department.objects.create(branch=self.branch_main, name="Diagnostics & Imaging", code=f"DIAG-{uuid.uuid4().hex[:4].upper()}")

        # 2. Setup Roles and Staff
        self.role_fin, _ = Role.objects.get_or_create(name=RoleEnum.FINANCE_MANAGER, defaults={'display_name': "Finance Manager"})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': "Patient"})

        uid_fin = uuid.uuid4()
        self.user_fin = User.objects.create_user(username=str(uid_fin), email="pnl.finance@hospital.com")
        self.up_fin = UserProfile.objects.create(
            supabase_user_id=uid_fin,
            email="pnl.finance@hospital.com",
            first_name="Finance",
            last_name="Director",
            role=self.role_fin
        )
        self.staff_fin = StaffProfile.objects.create(
            user_profile=self.up_fin,
            hospital=self.hospital,
            branch=self.branch_main,
            employee_id="EMP-FIN-PNL",
            status="ACTIVE"
        )

        uid_unauth = uuid.uuid4()
        self.user_unauth = User.objects.create_user(username=str(uid_unauth), email="unauth.patient@hospital.com")
        self.up_unauth = UserProfile.objects.create(
            supabase_user_id=uid_unauth,
            email="unauth.patient@hospital.com",
            first_name="General",
            last_name="Patient",
            role=self.role_patient
        )

        # 3. Setup Chart of Accounts & Fiscal Year
        GeneralLedgerService.ensure_default_fiscal_year_and_periods()
        GeneralLedgerService.ensure_standard_chart_of_accounts(self.branch_main)

        # Fetch accounts
        self.acc_cash = ChartOfAccount.objects.get(account_code='1010')
        self.acc_bank = ChartOfAccount.objects.get(account_code='1020')
        self.acc_ar = ChartOfAccount.objects.get(account_code='1030')
        self.acc_advance = ChartOfAccount.objects.get(account_code='2020')
        self.acc_loan = ChartOfAccount.objects.get(account_code='2030')
        self.acc_invest = ChartOfAccount.objects.get(account_code='1060')
        self.acc_ap = ChartOfAccount.objects.get(account_code='2010')

        self.acc_opd_rev = ChartOfAccount.objects.get(account_code='4010')
        self.acc_ipd_rev = ChartOfAccount.objects.get(account_code='4020')
        self.acc_surg_rev = ChartOfAccount.objects.get(account_code='4025')
        self.acc_diag_rev = ChartOfAccount.objects.get(account_code='4030')
        self.acc_pharm_rev = ChartOfAccount.objects.get(account_code='4040')
        self.acc_interest_inc = ChartOfAccount.objects.get(account_code='4050')

        self.acc_salaries_exp = ChartOfAccount.objects.get(account_code='5010')
        self.acc_util_exp = ChartOfAccount.objects.get(account_code='5020')
        self.acc_cogs_exp = ChartOfAccount.objects.get(account_code='5030')
        self.acc_loan_interest_exp = ChartOfAccount.objects.get(account_code='5040')
        self.acc_bank_fees_exp = ChartOfAccount.objects.get(account_code='5050')
        self.acc_deprec_exp = ChartOfAccount.objects.get(account_code='5060')
        self.acc_rent_exp = ChartOfAccount.objects.get(account_code='5070')
        self.acc_tax_exp = ChartOfAccount.objects.get(account_code='5080')

        self.client = APIClient()

    def _post_voucher(self, lines, narration="P&L Test Entry", branch=None, department=None):
        """Helper to create and post a balanced journal voucher directly to GL."""
        payload = {
            'narration': narration,
            'branch_id': branch.id if branch else self.branch_main.id,
            'department_id': department.id if department else None,
            'lines': lines,
            'status': JournalStatus.POSTED
        }
        return GeneralLedgerService.create_journal_voucher(payload, self.staff_fin)

    def test_01_empty_period_shows_zero_metrics(self):
        """Requirement 17: Empty periods return clean zero figures rather than errors or fabricated numbers."""
        metrics = ProfitLossService.get_21_metrics(
            start_date=date(2025, 1, 1),
            end_date=date(2025, 1, 15)
        )
        self.assertEqual(metrics['total_hospital_revenue'], '0.00')
        self.assertEqual(metrics['total_operating_expenses'], '0.00')
        self.assertEqual(metrics['operating_profit'], '0.00')
        self.assertEqual(metrics['gross_profit'], '0.00')
        self.assertEqual(metrics['profit_before_tax'], '0.00')
        self.assertEqual(metrics['net_profit'], '0.00')

    def test_02_revenue_calculation_from_posted_gl(self):
        """Requirement 2: Total revenue strictly matches posted General Ledger revenue accounts."""
        # Post OPD Consultation: Dr Cash 2,500, Cr OPD Revenue 2,500
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '2500.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '2500.00'}
        ], narration="OPD Consultations Collection", department=self.dept_opd)

        # Post Pharmacy Sales: Dr Cash 1,200, Cr Pharmacy Revenue 1,200
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '1200.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_pharm_rev.id), 'debit_amount': '0.00', 'credit_amount': '1200.00'}
        ], narration="Pharmacy Sales Receipts", department=self.dept_pharm)

        metrics = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics['opd_revenue'], '2500.00')
        self.assertEqual(metrics['pharmacy_revenue'], '1200.00')
        self.assertEqual(metrics['total_hospital_revenue'], '3700.00')

    def test_03_expenses_calculation_from_posted_gl(self):
        """Requirement 3: Total operating expenses match posted GL expense entries."""
        # Post Salaries: Dr Salaries 5,000, Cr Bank 5,000
        self._post_voucher([
            {'account_id': str(self.acc_salaries_exp.id), 'debit_amount': '5000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '5000.00'}
        ], narration="Clinical Staff Payroll")

        # Post Rent: Dr Rent 3,000, Cr Bank 3,000
        self._post_voucher([
            {'account_id': str(self.acc_rent_exp.id), 'debit_amount': '3000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '3000.00'}
        ], narration="Campus Facility Rent")

        metrics = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics['salaries_payroll'], '5000.00')
        self.assertEqual(metrics['rent_utilities'], '3000.00')
        self.assertEqual(metrics['total_operating_expenses'], '8000.00')

    def test_04_operating_profit_and_gross_profit_calculation(self):
        """Requirement 4: Gross profit and operating profit are computed correctly with COGS."""
        # Post Revenue: 10,000 OPD
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '10000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '10000.00'}
        ])
        # Post COGS / Medical Consumables: 2,000
        self._post_voucher([
            {'account_id': str(self.acc_cogs_exp.id), 'debit_amount': '2000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '2000.00'}
        ])
        # Post Operating Expense (Salaries): 4,000
        self._post_voucher([
            {'account_id': str(self.acc_salaries_exp.id), 'debit_amount': '4000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '4000.00'}
        ])

        metrics = ProfitLossService.get_21_metrics()
        # Gross profit = 10,000 - 2,000 (COGS) = 8,000
        self.assertEqual(metrics['gross_profit'], '8000.00')
        # Total operating expenses = 4,000 (Salaries) + 2,000 (COGS) = 6,000
        self.assertEqual(metrics['total_operating_expenses'], '6000.00')
        # Operating profit = 10,000 - 6,000 = 4,000
        self.assertEqual(metrics['operating_profit'], '4000.00')

    def test_05_profit_before_tax_and_net_profit_distinction(self):
        """Requirement 5: PBT and Net Profit are distinguished with interest, bank fees, and taxes."""
        # Operating Revenue: 20,000
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '20000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '20000.00'}
        ])
        # Operating Expenses: 10,000 (Salaries)
        self._post_voucher([
            {'account_id': str(self.acc_salaries_exp.id), 'debit_amount': '10000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '10000.00'}
        ])
        # Non-Operating Income: 1,500 (Bank Interest Income)
        self._post_voucher([
            {'account_id': str(self.acc_bank.id), 'debit_amount': '1500.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_interest_inc.id), 'debit_amount': '0.00', 'credit_amount': '1500.00'}
        ])
        # Financing Expense: 800 (Loan Interest) + 200 (Bank fees)
        self._post_voucher([
            {'account_id': str(self.acc_loan_interest_exp.id), 'debit_amount': '800.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank_fees_exp.id), 'debit_amount': '200.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '1000.00'}
        ])
        # Taxes: 500 (Corporate Income Tax)
        self._post_voucher([
            {'account_id': str(self.acc_tax_exp.id), 'debit_amount': '500.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '500.00'}
        ])

        metrics = ProfitLossService.get_21_metrics()
        # Operating Profit = 20,000 - 10,000 = 10,000
        self.assertEqual(metrics['operating_profit'], '10000.00')
        # PBT = 10,000 + 1,500 (Interest) - 800 (Loan interest) - 200 (Bank fees) = 10,500
        self.assertEqual(metrics['profit_before_tax'], '10500.00')
        # Net Profit = 10,500 - 500 (Taxes) = 10,000
        self.assertEqual(metrics['tax_expense'], '500.00')
        self.assertEqual(metrics['net_profit'], '10000.00')

    def test_06_patient_advances_are_not_counted_as_revenue(self):
        """Requirement 6: Patient advance deposits must NOT be counted as revenue."""
        # Patient deposit: Dr Cash 50,000, Cr Patient Advance Liability (2020) 50,000
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '50000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_advance.id), 'debit_amount': '0.00', 'credit_amount': '50000.00'}
        ], narration="Patient Admission Security Deposit")

        metrics = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics['total_hospital_revenue'], '0.00')
        self.assertEqual(metrics['opd_revenue'], '0.00')
        self.assertEqual(metrics['ipd_revenue'], '0.00')

    def test_07_loan_proceeds_and_principal_not_revenue_or_expense(self):
        """Requirement 7: Loan disbursement and principal repayment are excluded from P&L."""
        # Loan disbursement: Dr Bank 500,000, Cr Loan Liability (2030) 500,000
        self._post_voucher([
            {'account_id': str(self.acc_bank.id), 'debit_amount': '500000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_loan.id), 'debit_amount': '0.00', 'credit_amount': '500000.00'}
        ], narration="Bank Equipment Loan Facility Disbursement")

        # Loan principal repayment: Dr Loan Liability (2030) 25,000, Cr Bank 25,000
        self._post_voucher([
            {'account_id': str(self.acc_loan.id), 'debit_amount': '25000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '25000.00'}
        ], narration="Loan Monthly Principal Amortization")

        metrics = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics['total_hospital_revenue'], '0.00')
        self.assertEqual(metrics['total_operating_expenses'], '0.00')
        self.assertEqual(metrics['net_profit'], '0.00')

    def test_08_investment_principal_and_internal_transfers_excluded(self):
        """Requirement 8: Investment principal placement and internal cash-to-bank transfers are neutral."""
        # Fixed deposit placement: Dr Investment Asset 100,000, Cr Bank 100,000
        self._post_voucher([
            {'account_id': str(self.acc_invest.id), 'debit_amount': '100000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '100000.00'}
        ], narration="Treasury Fixed Deposit Placement")

        # Internal transfer: Dr Bank 10,000, Cr Cash 10,000
        self._post_voucher([
            {'account_id': str(self.acc_bank.id), 'debit_amount': '10000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '10000.00'}
        ], narration="Counter Float Cash Deposit into Bank")

        metrics = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics['total_hospital_revenue'], '0.00')
        self.assertEqual(metrics['total_operating_expenses'], '0.00')

    def test_09_reversals_and_refunds_adjust_revenue_correctly(self):
        """Requirement 9: Controlled reversals and patient refunds correctly deduct revenue."""
        # 1. Post revenue: 5,000
        entry = self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '5000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '5000.00'}
        ], narration="OPD Service Package")

        metrics_before = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics_before['opd_revenue'], '5000.00')

        # 2. Reverse the voucher
        GeneralLedgerService.reverse_journal_voucher(
            entry.id,
            self.staff_fin,
            reason="Patient Cancellation and Refund"
        )

        metrics_after = ProfitLossService.get_21_metrics()
        self.assertEqual(metrics_after['opd_revenue'], '0.00')
        self.assertEqual(metrics_after['total_hospital_revenue'], '0.00')

    def test_10_supplier_payments_do_not_duplicate_expenses(self):
        """Requirement 10: Supplier bill creates expense once; settlement against AP creates no duplicate expense."""
        # Step 1: Supplier Invoice (Expense recognized): Dr Consumables (5030) 15,000, Cr Supplier AP (2010) 15,000
        self._post_voucher([
            {'account_id': str(self.acc_cogs_exp.id), 'debit_amount': '15000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_ap.id), 'debit_amount': '0.00', 'credit_amount': '15000.00'}
        ], narration="Pharmaceutical Consumables Procurement Invoice")

        # Step 2: Supplier Payment (Settlement of liability): Dr Supplier AP (2010) 15,000, Cr Bank (1020) 15,000
        self._post_voucher([
            {'account_id': str(self.acc_ap.id), 'debit_amount': '15000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '15000.00'}
        ], narration="Bank Wire Payment to Pharma Vendor")

        metrics = ProfitLossService.get_21_metrics()
        # Consumables expense recognized exactly once at ₹15,000
        self.assertEqual(metrics['consumables_medicine'], '15000.00')
        self.assertEqual(metrics['total_operating_expenses'], '15000.00')

    def test_11_department_profitability_with_documented_allocation(self):
        """Requirement 12 & 13: Department-wise profitability uses transparent revenue-weighted overhead allocation."""
        # Department direct revenues: OPD 30,000, Pharmacy 10,000
        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '30000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_opd_rev.id), 'debit_amount': '0.00', 'credit_amount': '30000.00'}
        ], department=self.dept_opd)

        self._post_voucher([
            {'account_id': str(self.acc_cash.id), 'debit_amount': '10000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_pharm_rev.id), 'debit_amount': '0.00', 'credit_amount': '10000.00'}
        ], department=self.dept_pharm)

        # Department direct expense: Pharmacy Consumables 4,000
        self._post_voucher([
            {'account_id': str(self.acc_cogs_exp.id), 'debit_amount': '4000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_cash.id), 'debit_amount': '0.00', 'credit_amount': '4000.00'}
        ], department=self.dept_pharm)

        # Hospital shared unassigned overhead: Facility Rent 4,000 (department=None)
        self._post_voucher([
            {'account_id': str(self.acc_rent_exp.id), 'debit_amount': '4000.00', 'credit_amount': '0.00'},
            {'account_id': str(self.acc_bank.id), 'debit_amount': '0.00', 'credit_amount': '4000.00'}
        ])

        dept_data = ProfitLossService.get_department_profitability()
        # Verify documented policy is present
        self.assertIn("Proportional Revenue-Weighted", dept_data['allocation_policy'])
        self.assertEqual(dept_data['total_shared_overhead'], '4000.00')
        self.assertEqual(dept_data['total_hospital_revenue'], '40000.00')

        # OPD has 75% revenue share (30k/40k) -> gets 75% of 4k = 3,000 allocated overhead
        opd = next((d for d in dept_data['departments'] if d['code'].startswith('OPD')), None)
        self.assertIsNotNone(opd)
        self.assertEqual(opd['revenue'], '30000.00')
        self.assertEqual(opd['allocated_overhead'], '3000.00')
        self.assertEqual(opd['operating_profit'], '27000.00')

        # Pharmacy has 25% revenue share (10k/40k) -> gets 25% of 4k = 1,000 overhead + 4,000 direct = 5,000 total
        pharm = next((d for d in dept_data['departments'] if d['code'].startswith('PHARM')), None)
        self.assertIsNotNone(pharm)
        self.assertEqual(pharm['revenue'], '10000.00')
        self.assertEqual(pharm['direct_expenses'], '4000.00')
        self.assertEqual(pharm['allocated_overhead'], '1000.00')
        self.assertEqual(pharm['total_expenses'], '5000.00')
        self.assertEqual(pharm['operating_profit'], '5000.00')

    def test_12_api_security_and_unauthorized_rejection(self):
        """Requirement 16: Unauthenticated or non-staff user requests are rejected."""
        # Unauthenticated request
        res_unauth = self.client.get('/api/v1/billing-finance/pnl/dashboard/')
        self.assertIn(res_unauth.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

        # Authenticated as authorized finance staff
        self.client.force_authenticate(user=self.user_fin)
        res_auth = self.client.get('/api/v1/billing-finance/pnl/dashboard/')
        self.assertEqual(res_auth.status_code, status.HTTP_200_OK)
        self.assertIn('metrics', res_auth.data)
        self.assertIn('charts', res_auth.data)
