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
from apps.pharmacy_inventory.models import Supplier, SupplierInvoice
from apps.billing_finance.models import (
    FinancialAccount, FinancialAccountType, AccountingClassification,
    FinancialAccountTransaction, LoanRegister, LoanType, LoanLifecycleStatus,
    LoanRepaymentFrequency, RepaymentInstallmentStatus, LoanRepaymentSchedule,
    LoanRepaymentRecord, HospitalLiability, LiabilityCategory, LiabilityTenureType,
    LiabilityPaymentStatus, LiabilityPriority, LiabilityPaymentRecord,
    TransactionType, FinancialTransactionCategory
)
from apps.billing_finance.loan_liability_views import calculate_emi, add_months


class Section16LoanLiabilityTests(TestCase):
    """
    Mandatory Test Suite for Section 16: Loan and Liability Management.
    Verifies loan creation, standard and zero-interest EMI calculations,
    separation of duties, disbursement, principal/interest allocation,
    duplicate payment prevention, early payoff, liabilities, and ledger reconciliation.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Core Hospital, Branch, Department
        self.hospital = Hospital.objects.create(name='Aura Health System', code=f'AURA-HQ-{uuid.uuid4().hex[:4]}')
        self.branch = Branch.objects.create(hospital=self.hospital, name='Main Campus', code=f'BR-LOAN-{uuid.uuid4().hex[:4]}')
        self.department = Department.objects.create(branch=self.branch, name='Finance & Treasury', code=f'DEP-LOAN-{uuid.uuid4().hex[:4]}')

        # 2. Setup Roles
        self.role_fin_mgr, _ = Role.objects.get_or_create(name=RoleEnum.FINANCE_MANAGER, defaults={'display_name': 'Finance Manager'})
        self.role_accountant, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Accountant'})

        # 3. Setup Users & Staff
        # Preparer / Accountant (Staff 1)
        uid_prep = uuid.uuid4()
        self.user_prep = User.objects.create_user(username=str(uid_prep), email='loan.prep@hospital.com')
        self.up_prep = UserProfile.objects.create(supabase_user_id=uid_prep, email='loan.prep@hospital.com', first_name='Priya', last_name='Sharma', role=self.role_accountant)
        self.staff_prep = StaffProfile.objects.create(user_profile=self.up_prep, hospital=self.hospital, branch=self.branch, department=self.department, employee_id=f'EMP-PREP-{uuid.uuid4().hex[:4]}')

        # Approver / Finance Manager (Staff 2)
        uid_mgr = uuid.uuid4()
        self.user_mgr = User.objects.create_user(username=str(uid_mgr), email='loan.mgr@hospital.com')
        self.up_mgr = UserProfile.objects.create(supabase_user_id=uid_mgr, email='loan.mgr@hospital.com', first_name='Meenakshi', last_name='Sundaram', role=self.role_fin_mgr)
        self.staff_mgr = StaffProfile.objects.create(user_profile=self.up_mgr, hospital=self.hospital, branch=self.branch, department=self.department, employee_id=f'EMP-MGR-{uuid.uuid4().hex[:4]}')

        # 4. Setup Section 13 Bank Account (Treasury)
        self.bank_account = FinancialAccount.objects.create(
            branch=self.branch,
            account_code=f'FA-BNK-LOAN-{uuid.uuid4().hex[:4]}',
            name="State Bank Operations Treasury",
            account_type=FinancialAccountType.BANK,
            classification=AccountingClassification.ASSET,
            opening_balance=Decimal('10000000.00'),
            current_balance=Decimal('10000000.00'),
            is_active=True
        )

    def test_01_create_loan_and_emi_calculation(self):
        """
        Verify creating a loan calculates EMI using standard formula:
        EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
        """
        self.client.force_authenticate(user=self.user_prep)
        today = timezone.localdate()

        # Loan of ₹12,00,000 at 10% annual interest for 36 months
        # Monthly interest r = 10% / 12 = 0.0083333333
        # Expected EMI is approx ₹38,721
        p = Decimal('1200000.00')
        rate = Decimal('10.00')
        tenure = 36
        expected_emi = calculate_emi(p, rate, tenure)
        self.assertAlmostEqual(float(expected_emi), 38721.0, delta=5.0)

        payload = {
            'loan_account_number': f'TL-HDFC-{uuid.uuid4().hex[:6].upper()}',
            'lender_name': 'HDFC Bank Ltd',
            'loan_type': LoanType.TERM_LOAN,
            'principal_amount': '1200000.00',
            'interest_rate_pct': '10.00',
            'tenure_months': 36,
            'start_date': str(today),
            'servicing_financial_account': str(self.bank_account.id),
            'lifecycle_status': LoanLifecycleStatus.DRAFT,
            'purpose': 'Expansion of ICU and Cardiac Ward',
            'is_secured': True,
            'collateral_details': 'Hypothecation of Medical Equipment and Receivables'
        }

        response = self.client.post('/api/v1/billing-finance/loans/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(response.data['monthly_emi'])), expected_emi)
        self.assertEqual(response.data['lifecycle_status'], LoanLifecycleStatus.DRAFT)

        loan = LoanRegister.objects.get(id=response.data['id'])
        self.assertEqual(loan.principal_amount, Decimal('1200000.00'))
        self.assertEqual(loan.outstanding_balance, Decimal('1200000.00'))

        # Verify audit trail
        log = loan.audit_logs.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.action, 'CREATED')

    def test_02_zero_interest_loan_emi(self):
        """
        Verify that zero-interest loans calculate EMI as P / n and handle zero-rate schedules.
        """
        p = Decimal('600000.00')
        rate = Decimal('0.00')
        tenure = 12
        emi = calculate_emi(p, rate, tenure)
        # 600,000 / 12 = 50,000 exactly
        self.assertEqual(emi, Decimal('50000.00'))

        today = timezone.localdate()
        loan = LoanRegister.objects.create(
            loan_account_number=f'ZERO-{uuid.uuid4().hex[:6].upper()}',
            lender_name='State Healthcare Equipment Trust',
            loan_type=LoanType.EQUIPMENT_FINANCING,
            principal_amount=p,
            sanctioned_amount=p,
            interest_rate_pct=rate,
            tenure_months=tenure,
            monthly_emi=emi,
            outstanding_balance=p,
            start_date=today,
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.ACTIVE,
            created_by=self.staff_prep
        )

        from apps.billing_finance.loan_liability_views import generate_loan_amortization_schedule
        schedules = generate_loan_amortization_schedule(loan)
        self.assertEqual(len(schedules), 12)
        # In zero-interest loan, interest_due is 0 and principal_due is 50,000
        for s in schedules:
            self.assertEqual(s.interest_due, Decimal('0.00'))
            self.assertEqual(s.principal_due, Decimal('50000.00'))
            self.assertEqual(s.total_due, Decimal('50000.00'))

    def test_03_separation_of_duties_approval(self):
        """
        Verify that the preparer cannot approve their own loan application.
        Only an independent Finance Manager can approve.
        """
        today = timezone.localdate()
        loan = LoanRegister.objects.create(
            loan_account_number=f'TL-DUTY-{uuid.uuid4().hex[:6].upper()}',
            lender_name='Axis Commercial Bank',
            loan_type=LoanType.TERM_LOAN,
            principal_amount=Decimal('2500000.00'),
            sanctioned_amount=Decimal('2500000.00'),
            interest_rate_pct=Decimal('9.50'),
            tenure_months=24,
            monthly_emi=Decimal('114820.00'),
            outstanding_balance=Decimal('2500000.00'),
            start_date=today,
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.PENDING_APPROVAL,
            created_by=self.staff_prep,
            submitted_by=self.staff_prep
        )

        # 1. Preparer attempts self-approval -> must fail with HTTP 403
        self.client.force_authenticate(user=self.user_prep)
        res_self = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/approve/')
        self.assertEqual(res_self.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Finance Manager approves -> succeeds
        self.client.force_authenticate(user=self.user_mgr)
        res_mgr = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/approve/')
        self.assertEqual(res_mgr.status_code, status.HTTP_200_OK)

        loan.refresh_from_db()
        self.assertEqual(loan.lifecycle_status, LoanLifecycleStatus.APPROVED)
        self.assertEqual(loan.approved_by, self.staff_mgr)

    def test_04_loan_disbursement_and_financial_integration(self):
        """
        Verify that disbursing a loan credits the servicing bank account
        and records a Section 14 Financial Transaction (inflow of borrowed funds, not revenue).
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        loan = LoanRegister.objects.create(
            loan_account_number=f'TL-DISB-{uuid.uuid4().hex[:6].upper()}',
            lender_name='Bank of Baroda',
            loan_type=LoanType.TERM_LOAN,
            principal_amount=Decimal('5000000.00'),
            sanctioned_amount=Decimal('5000000.00'),
            interest_rate_pct=Decimal('8.75'),
            tenure_months=60,
            monthly_emi=Decimal('103217.00'),
            outstanding_balance=Decimal('5000000.00'),
            start_date=today,
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.APPROVED,
            created_by=self.staff_prep
        )

        initial_bank_balance = self.bank_account.current_balance

        # Call disburse endpoint
        payload = {
            'amount': '5000000.00',
            'servicing_account_id': str(self.bank_account.id),
            'reference_number': 'NEFT-BOB-DISB-7788',
            'payment_method': 'RTGS_NEFT'
        }
        res = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/disburse/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        loan.refresh_from_db()
        self.assertEqual(loan.lifecycle_status, LoanLifecycleStatus.ACTIVE)
        self.assertEqual(loan.disbursed_amount, Decimal('5000000.00'))

        # Check bank balance credited
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_bank_balance + Decimal('5000000.00'))

        # Check Section 14 Financial Transaction exists
        txn = FinancialAccountTransaction.objects.filter(loan=loan, transaction_type=TransactionType.CREDIT).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.posting_status, 'POSTED')
        self.assertEqual(txn.amount, Decimal('5000000.00'))
        self.assertEqual(txn.category, FinancialTransactionCategory.LOAN_DISBURSEMENT_REPAYMENT)

    def test_05_loan_repayment_principal_vs_interest_allocation(self):
        """
        Verify that recording a loan repayment reduces outstanding principal correctly,
        separates interest expense from principal, debits bank account, and creates Section 14 txn.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        loan = LoanRegister.objects.create(
            loan_account_number=f'TL-REPAY-{uuid.uuid4().hex[:6].upper()}',
            lender_name='ICICI Commercial Debt',
            loan_type=LoanType.TERM_LOAN,
            principal_amount=Decimal('1000000.00'),
            sanctioned_amount=Decimal('1000000.00'),
            disbursed_amount=Decimal('1000000.00'),
            outstanding_balance=Decimal('1000000.00'),
            interest_rate_pct=Decimal('12.00'),
            tenure_months=12,
            monthly_emi=Decimal('88849.00'),
            start_date=today - timedelta(days=30),
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        from apps.billing_finance.loan_liability_views import generate_loan_amortization_schedule
        generate_loan_amortization_schedule(loan)

        initial_bank_balance = self.bank_account.current_balance

        # First month EMI: ₹88,849
        # Interest: ₹1,000,000 * 1% = ₹10,000
        # Principal: ₹78,849
        payload = {
            'amount': '88849.00',
            'principal_amount': '78849.00',
            'interest_amount': '10000.00',
            'servicing_account_id': str(self.bank_account.id),
            'reference_number': 'ACH-ICICI-EMI-001',
            'payment_method': 'ACH_DEBIT',
            'notes': 'Installment #1 auto-debit'
        }

        res = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/record-repayment/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        loan.refresh_from_db()
        # Outstanding principal must reduce by 78,849 -> 1,000,000 - 78,849 = 921,151
        self.assertEqual(loan.outstanding_balance, Decimal('921151.00'))
        self.assertEqual(loan.total_repaid, Decimal('88849.00'))
        self.assertEqual(loan.total_principal_repaid, Decimal('78849.00'))
        self.assertEqual(loan.total_interest_paid, Decimal('10000.00'))

        # Bank account debited
        self.bank_account.refresh_from_db()
        self.assertEqual(self.bank_account.current_balance, initial_bank_balance - Decimal('88849.00'))

        # Section 14 Financial Transaction exists
        txn = FinancialAccountTransaction.objects.filter(loan=loan, transaction_type=TransactionType.DEBIT).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.posting_status, 'POSTED')
        self.assertEqual(txn.amount, Decimal('88849.00'))

    def test_06_duplicate_payment_prevention(self):
        """
        Verify that submitting another repayment with an identical reference number (UTR)
        is prevented to avoid accidental double deductions.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        loan = LoanRegister.objects.create(
            loan_account_number=f'TL-DUP-{uuid.uuid4().hex[:6].upper()}',
            lender_name='Kotak Mahindra Bank',
            principal_amount=Decimal('500000.00'),
            sanctioned_amount=Decimal('500000.00'),
            disbursed_amount=Decimal('500000.00'),
            outstanding_balance=Decimal('500000.00'),
            interest_rate_pct=Decimal('9.00'),
            tenure_months=12,
            monthly_emi=Decimal('43726.00'),
            start_date=today,
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        payload = {
            'amount': '43726.00',
            'principal_amount': '40000.00',
            'interest_amount': '3726.00',
            'servicing_account_id': str(self.bank_account.id),
            'reference_number': 'UNIQUE-UTR-KOTAK-9988',
            'payment_method': 'BANK_TRANSFER'
        }

        # First repayment succeeds
        res1 = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/record-repayment/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        # Second repayment with same UTR must fail with HTTP 400
        res2 = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/record-repayment/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Duplicate Payment Prevention', res2.data['error'])

    def test_07_early_payoff_loan_closure(self):
        """
        Verify that early payoff clears the entire remaining balance and sets status to CLOSED.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        loan = LoanRegister.objects.create(
            loan_account_number=f'TL-PAYOFF-{uuid.uuid4().hex[:6].upper()}',
            lender_name='Standard Chartered Commercial',
            principal_amount=Decimal('200000.00'),
            sanctioned_amount=Decimal('200000.00'),
            disbursed_amount=Decimal('200000.00'),
            outstanding_balance=Decimal('200000.00'),
            interest_rate_pct=Decimal('8.50'),
            tenure_months=12,
            monthly_emi=Decimal('17445.00'),
            start_date=today,
            servicing_financial_account=self.bank_account,
            lifecycle_status=LoanLifecycleStatus.ACTIVE,
            created_by=self.staff_mgr
        )

        res = self.client.post(f'/api/v1/billing-finance/loans/{loan.id}/early-payoff/', {
            'servicing_account_id': str(self.bank_account.id),
            'reference_number': 'UTR-FORECLOSE-9911',
            'notes': 'Complete foreclosure before tenure end'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        loan.refresh_from_db()
        self.assertEqual(loan.outstanding_balance, Decimal('0.00'))
        self.assertEqual(loan.lifecycle_status, LoanLifecycleStatus.CLOSED)

    def test_08_liability_creation_and_short_term_classification(self):
        """
        Verify creating an operating expense / equipment liability accurately records
        outstanding amounts and assigns short-term vs long-term tenure.
        """
        self.client.force_authenticate(user=self.user_prep)
        today = timezone.localdate()

        payload = {
            'title': 'GE Healthcare MRI Maintenance Contract',
            'category': LiabilityCategory.EQUIPMENT_PAYABLE,
            'creditor_name': 'GE Healthcare South Asia Ltd',
            'creditor_reference': 'INV-GE-2026-887',
            'original_amount': '350000.00',
            'due_date': str(today + timedelta(days=45)),
            'priority': LiabilityPriority.HIGH,
            'branch': str(self.branch.id)
        }

        res = self.client.post('/api/v1/billing-finance/liabilities/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['tenure_type'], LiabilityTenureType.SHORT_TERM)

        liab = HospitalLiability.objects.get(id=res.data['id'])
        self.assertEqual(liab.outstanding_amount, Decimal('350000.00'))
        self.assertEqual(liab.payment_status, LiabilityPaymentStatus.PENDING)

    def test_09_liability_payment_and_supplier_sync(self):
        """
        Verify recording a payment on a liability reduces its balance, debits bank account,
        and synchronizing Section 10 supplier invoices creates liabilities without duplicates.
        """
        self.client.force_authenticate(user=self.user_mgr)
        today = timezone.localdate()

        # Create Supplier from Section 10
        supplier = Supplier.objects.create(
            name='Medtronic Medical Systems Ltd',
            contact_person='Rajiv Menon',
            email=f'rajiv.{uuid.uuid4().hex[:4]}@medtronic.com',
            phone='9876543210'
        )
        invoice = SupplierInvoice.objects.create(
            supplier=supplier,
            invoice_number=f'MED-{uuid.uuid4().hex[:6].upper()}',
            invoice_date=today,
            due_date=today + timedelta(days=30),
            total_amount=Decimal('150000.00'),
            paid_amount=Decimal('0.00'),
            payment_status='UNPAID',
            branch=self.branch
        )

        # 1. Sync supplier invoices into liabilities
        res_sync = self.client.post('/api/v1/billing-finance/liabilities/sync-supplier-invoices/')
        self.assertEqual(res_sync.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_sync.data['synced_count'], 1)

        liab = HospitalLiability.objects.filter(linked_supplier_invoice=invoice).first()
        self.assertIsNotNone(liab)
        self.assertEqual(liab.outstanding_amount, Decimal('150000.00'))

        # 2. Resyncing should not duplicate
        res_resync = self.client.post('/api/v1/billing-finance/liabilities/sync-supplier-invoices/')
        self.assertEqual(res_resync.data['synced_count'], 0)

        # 3. Pay liability partial ₹50,000
        pay_payload = {
            'amount': '50000.00',
            'servicing_account_id': str(self.bank_account.id),
            'reference_number': 'NEFT-MED-PAY-50K',
            'payment_method': 'BANK_TRANSFER'
        }
        res_pay = self.client.post(f'/api/v1/billing-finance/liabilities/{liab.id}/record-payment/', pay_payload, format='json')
        self.assertEqual(res_pay.status_code, status.HTTP_200_OK)

        liab.refresh_from_db()
        self.assertEqual(liab.outstanding_amount, Decimal('100000.00'))
        self.assertEqual(liab.payment_status, LiabilityPaymentStatus.PARTIALLY_PAID)

        # Verify linked Section 10 supplier invoice was also updated
        invoice.refresh_from_db()
        self.assertEqual(invoice.paid_amount, Decimal('50000.00'))
        self.assertEqual(invoice.payment_status, 'PARTIAL')

    def test_10_loan_liability_dashboard_and_csv_export(self):
        """
        Verify that the dashboard endpoint dynamically aggregates loan and liability KPIs,
        and that CSV reports export valid formatted spreadsheets.
        """
        self.client.force_authenticate(user=self.user_mgr)

        # 1. Dashboard
        res_dash = self.client.get('/api/v1/billing-finance/loans/dashboard/')
        self.assertEqual(res_dash.status_code, status.HTTP_200_OK)
        self.assertIn('total_loan_outstanding', res_dash.data)
        self.assertIn('total_liabilities_outstanding', res_dash.data)
        self.assertIn('debt_service_trend', res_dash.data)

        # 2. Export CSV (Loans)
        res_csv_loans = self.client.get('/api/v1/billing-finance/loans/export-csv/?type=loans')
        self.assertEqual(res_csv_loans.status_code, status.HTTP_200_OK)
        self.assertEqual(res_csv_loans['Content-Type'], 'text/csv')
        self.assertIn('Loan Account Number', res_csv_loans.content.decode('utf-8'))

        # 3. Export CSV (Liabilities)
        res_csv_liab = self.client.get('/api/v1/billing-finance/loans/export-csv/?type=liabilities')
        self.assertEqual(res_csv_liab.status_code, status.HTTP_200_OK)
        self.assertEqual(res_csv_liab['Content-Type'], 'text/csv')
        self.assertIn('Liability Number', res_csv_liab.content.decode('utf-8'))
