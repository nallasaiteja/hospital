import io
import uuid
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import Hospital, Branch, Department
from apps.authentication.models import Role, RoleEnum, UserProfile, StaffProfile, PatientProfile
from apps.billing_finance.models import (
    FinancialAccount, FinancialAccountTransaction, BankStatementImport,
    BankStatementEntry, AccountReconciliation, FinancialAccountDocument,
    FinancialAccountType, AccountingClassification, AccountReconciliationStatus,
    StatementEntryStatus, ReconciliationSessionStatus, FinancialDocumentType,
    InvestmentRegister, LoanRegister, PatientDeposit
)

User = get_user_model()


class Section13FinancialAccountsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Organization Structure
        self.hospital = Hospital.objects.create(name='Apex Super Specialty Hospital', code=f"HOSP-{uuid.uuid4().hex[:4].upper()}")
        self.branch = Branch.objects.create(hospital=self.hospital, name='South City Campus', code=f"BR-{uuid.uuid4().hex[:4].upper()}")
        self.dept_finance = Department.objects.create(branch=self.branch, name='Finance & Treasury', code=f"FIN-{uuid.uuid4().hex[:4].upper()}")

        # 2. Roles
        self.role_accountant, _ = Role.objects.get_or_create(name=RoleEnum.ACCOUNTANT, defaults={'display_name': 'Accountant'})
        self.role_admin, _ = Role.objects.get_or_create(name=RoleEnum.HOSPITAL_ADMIN, defaults={'display_name': 'Hospital Administrator'})
        self.role_patient, _ = Role.objects.get_or_create(name=RoleEnum.PATIENT, defaults={'display_name': 'Patient'})

        # 3. Accountant 1 (Preparer)
        uid_acc1 = uuid.uuid4()
        self.user_acc1 = User.objects.create_user(username=str(uid_acc1), email='accountant1@hospital.com')
        self.up_acc1 = UserProfile.objects.create(
            supabase_user_id=uid_acc1, email='accountant1@hospital.com',
            first_name='Anil', last_name='Mehta', role=self.role_accountant
        )
        self.staff_acc1 = StaffProfile.objects.create(
            user_profile=self.up_acc1, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"EMP-ACC1-{uuid.uuid4().hex[:4].upper()}", designation='Senior Accountant', status='ACTIVE'
        )

        # 4. Finance Admin (Approver)
        uid_admin = uuid.uuid4()
        self.user_admin = User.objects.create_user(username=str(uid_admin), email='admin@hospital.com')
        self.up_admin = UserProfile.objects.create(
            supabase_user_id=uid_admin, email='admin@hospital.com',
            first_name='Sunita', last_name='Sharma', role=self.role_admin
        )
        self.staff_admin = StaffProfile.objects.create(
            user_profile=self.up_admin, hospital=self.hospital, branch=self.branch,
            department=self.dept_finance, employee_id=f"EMP-ADM-{uuid.uuid4().hex[:4].upper()}", designation='Finance Director', status='ACTIVE'
        )

        # 5. Patient User
        uid_pat = uuid.uuid4()
        self.user_patient = User.objects.create_user(username=str(uid_pat), email='patient@hospital.com')
        self.up_pat = UserProfile.objects.create(
            supabase_user_id=uid_pat, email='patient@hospital.com',
            first_name='Vikram', last_name='Singh', role=self.role_patient
        )
        self.patient = PatientProfile.objects.create(
            user_profile=self.up_pat, primary_branch=self.branch,
            medical_record_number=f"MRN-{uuid.uuid4().hex[:6].upper()}", gender='MALE', date_of_birth='1985-06-15'
        )

    def test_01_authorized_account_creation_and_retrieval(self):
        """Accountant can create financial accounts across types with masked account numbers."""
        self.client.force_authenticate(user=self.user_acc1)
        payload = {
            'account_code': 'FA-TEST-HDFC',
            'name': 'HDFC Hospital Main Operations',
            'account_type': FinancialAccountType.BANK,
            'institution_name': 'HDFC Bank Ltd',
            'account_number_raw': '50200098765432',
            'branch_name': 'South Extension',
            'ifsc_code': 'HDFC0001234',
            'currency': 'INR',
            'opening_balance': '500000.00',
            'branch': str(self.branch.id)
        }
        res = self.client.post('/api/v1/billing-finance/financial-accounts/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['account_code'], 'FA-TEST-HDFC')
        self.assertEqual(res.data['classification'], AccountingClassification.ASSET)
        self.assertEqual(res.data['masked_account_number'], '•••• •••• 5432')

        # Retrieve detail
        acc_id = res.data['id']
        detail_res = self.client.get(f"/api/v1/billing-finance/financial-accounts/{acc_id}/")
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data['name'], 'HDFC Hospital Main Operations')

    def test_02_duplicate_account_code_prevention(self):
        """Server-side validation strictly rejects duplicate account codes."""
        self.client.force_authenticate(user=self.user_acc1)
        payload = {
            'account_code': 'FA-DUP-001',
            'name': 'Cash Counter 1',
            'account_type': FinancialAccountType.CASH,
            'opening_balance': '10000.00'
        }
        res1 = self.client.post('/api/v1/billing-finance/financial-accounts/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempt to create duplicate
        res2 = self.client.post('/api/v1/billing-finance/financial-accounts/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('account_code', res2.data)

    def test_03_required_field_validation_by_account_type(self):
        """Bank accounts require institution name; cash accounts do not."""
        self.client.force_authenticate(user=self.user_acc1)
        # Bank account without institution_name
        bad_bank_payload = {
            'account_code': 'FA-BAD-BNK',
            'name': 'Nameless Bank',
            'account_type': FinancialAccountType.BANK,
            'institution_name': ''  # Empty!
        }
        res_bad = self.client.post('/api/v1/billing-finance/financial-accounts/', bad_bank_payload, format='json')
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('institution_name', res_bad.data)

        # Cash account with no institution_name succeeds
        good_cash_payload = {
            'account_code': 'FA-PETTY-01',
            'name': 'ICU Petty Cash Float',
            'account_type': FinancialAccountType.PETTY_CASH,
            'opening_balance': '5000.00'
        }
        res_good = self.client.post('/api/v1/billing-finance/financial-accounts/', good_cash_payload, format='json')
        self.assertEqual(res_good.status_code, status.HTTP_201_CREATED)

    def test_04_correct_account_balance_calculation_asset_vs_liability(self):
        """Asset: Opening + Dr - Cr; Liability: Opening + Cr - Dr."""
        # 1. Asset Account (Bank)
        bank = FinancialAccount.objects.create(
            account_code='FA-BAL-ASSET',
            name='Test Operating Bank',
            account_type=FinancialAccountType.BANK,
            classification=AccountingClassification.ASSET,
            institution_name='State Bank of India',
            opening_balance=Decimal('10000.00'),
            current_balance=Decimal('10000.00')
        )
        # Debit ₹5,000 (increases asset)
        FinancialAccountTransaction.objects.create(
            account=bank, transaction_number='TX-ASSET-01',
            debit_amount=Decimal('5000.00'), credit_amount=Decimal('0.00'),
            description='Patient Collection', posting_status='POSTED'
        )
        # Credit ₹2,000 (decreases asset)
        FinancialAccountTransaction.objects.create(
            account=bank, transaction_number='TX-ASSET-02',
            debit_amount=Decimal('0.00'), credit_amount=Decimal('2000.00'),
            description='Vendor Payment', posting_status='POSTED'
        )
        calc_asset, debits_asset, credits_asset = bank.calculate_balance()
        # 10,000 + 5,000 - 2,000 = 13,000
        self.assertEqual(calc_asset, Decimal('13000.00'))
        self.assertEqual(debits_asset, Decimal('5000.00'))
        self.assertEqual(credits_asset, Decimal('2000.00'))

        # 2. Liability Account (Loan)
        loan = FinancialAccount.objects.create(
            account_code='FA-BAL-LIAB',
            name='Medical Equipment Loan',
            account_type=FinancialAccountType.LOAN_FACILITY,
            classification=AccountingClassification.LIABILITY,
            opening_balance=Decimal('100000.00'),
            current_balance=Decimal('100000.00')
        )
        # Credit ₹50,000 (drawdown increases liability)
        FinancialAccountTransaction.objects.create(
            account=loan, transaction_number='TX-LIAB-01',
            debit_amount=Decimal('0.00'), credit_amount=Decimal('50000.00'),
            description='Equipment Loan Drawdown', posting_status='POSTED'
        )
        # Debit ₹20,000 (repayment decreases liability)
        FinancialAccountTransaction.objects.create(
            account=loan, transaction_number='TX-LIAB-02',
            debit_amount=Decimal('20000.00'), credit_amount=Decimal('0.00'),
            description='Principal EMI Repayment', posting_status='POSTED'
        )
        calc_liab, debits_liab, credits_liab = loan.calculate_balance()
        # 100,000 + 50,000 - 20,000 = 130,000
        self.assertEqual(calc_liab, Decimal('130000.00'))
        self.assertEqual(debits_liab, Decimal('20000.00'))
        self.assertEqual(credits_liab, Decimal('50000.00'))

    def test_05_account_transaction_history_and_filters(self):
        """Transaction ledger endpoint supports date, category, and keyword filters."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-HIST-01', name='Cash Office Desk',
            account_type=FinancialAccountType.CASH, classification=AccountingClassification.ASSET
        )
        FinancialAccountTransaction.objects.create(
            account=account, transaction_number='TX-HIST-01', transaction_date='2026-10-01',
            category='PATIENT_COLLECTION', description='OPD Consultation Fees',
            debit_amount=Decimal('1500.00'), posting_status='POSTED'
        )
        FinancialAccountTransaction.objects.create(
            account=account, transaction_number='TX-HIST-02', transaction_date='2026-10-15',
            category='VENDOR_DISBURSEMENT', description='Medical Supplies Cash',
            credit_amount=Decimal('800.00'), posting_status='POSTED'
        )

        # Filter by category
        res_cat = self.client.get(f"/api/v1/billing-finance/financial-accounts/{account.id}/transactions/?category=PATIENT_COLLECTION")
        self.assertEqual(res_cat.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_cat.data), 1)
        self.assertEqual(res_cat.data[0]['transaction_number'], 'TX-HIST-01')

        # Filter by date range
        res_date = self.client.get(f"/api/v1/billing-finance/financial-accounts/{account.id}/transactions/?from_date=2026-10-10&to_date=2026-10-20")
        self.assertEqual(res_date.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_date.data), 1)
        self.assertEqual(res_date.data[0]['transaction_number'], 'TX-HIST-02')

    def test_06_unauthorized_account_access_rejection(self):
        """Patients cannot access internal financial accounts."""
        self.client.force_authenticate(user=self.user_patient)
        res = self.client.get('/api/v1/billing-finance/financial-accounts/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_protection_against_deleting_accounts_with_dependencies(self):
        """Accounts with transactions cannot be deleted; must be deactivated."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-DEL-PROT', name='Protected Account',
            account_type=FinancialAccountType.BANK, institution_name='Bank of Baroda'
        )
        FinancialAccountTransaction.objects.create(
            account=account, transaction_number='TX-PROT-01',
            debit_amount=Decimal('100.00'), posting_status='POSTED'
        )

        # Attempt DELETE
        del_res = self.client.delete(f"/api/v1/billing-finance/financial-accounts/{account.id}/")
        self.assertEqual(del_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cannot delete', del_res.data['error'])

        # Deactivation via toggle-status succeeds
        toggle_res = self.client.post(f"/api/v1/billing-finance/financial-accounts/{account.id}/toggle-status/")
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_res.data['is_active'])

    def test_08_inactive_account_posting_rejection(self):
        """Inactive accounts reject new postings unless authorized adjustment."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-INACTIVE', name='Closed Cash Counter',
            account_type=FinancialAccountType.CASH, is_active=False
        )
        # Normal posting fails
        res_fail = self.client.post(f"/api/v1/billing-finance/financial-accounts/{account.id}/post-transaction/", {
            'description': 'Regular Cash Collection',
            'debit_amount': '500.00',
            'category': 'PATIENT_COLLECTION'
        }, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Authorized adjustment succeeds
        res_adj = self.client.post(f"/api/v1/billing-finance/financial-accounts/{account.id}/post-transaction/", {
            'description': 'Audit adjustment for closure balance',
            'credit_amount': '500.00',
            'category': 'AUTHORIZED_ADJUSTMENT'
        }, format='json')
        self.assertEqual(res_adj.status_code, status.HTTP_201_CREATED)

    def test_09_valid_bank_statement_import_csv(self):
        """CSV statement import parses rows, maps columns, and saves statement entries."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-STMT-01', name='HDFC Clearing',
            account_type=FinancialAccountType.BANK, institution_name='HDFC Bank'
        )

        csv_content = (
            "Date,Description,Reference,Debit,Credit,Balance\n"
            "2026-10-20,Razorpay Payment Settlement,RZP-12345,0.00,45000.00,145000.00\n"
            "2026-10-21,Medical Oxygen Cylinder Gas,CHQ-998811,12000.00,0.00,133000.00\n"
        )
        csv_file = SimpleUploadedFile("statement.csv", csv_content.encode('utf-8'), content_type="text/csv")

        # 1. Preview CSV
        prev_res = self.client.post('/api/v1/billing-finance/bank-statements/preview-csv/', {'file': csv_file})
        self.assertEqual(prev_res.status_code, status.HTTP_200_OK)
        self.assertEqual(prev_res.data['total_rows'], 2)
        self.assertEqual(prev_res.data['headers'], ['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance'])

        # 2. Import CSV
        csv_file.seek(0)
        import_res = self.client.post('/api/v1/billing-finance/bank-statements/import-csv/', {
            'account_id': str(account.id),
            'file': csv_file,
            'date_col': 0, 'desc_col': 1, 'ref_col': 2, 'debit_col': 3, 'credit_col': 4, 'balance_col': 5
        })
        self.assertEqual(import_res.status_code, status.HTTP_201_CREATED, import_res.data)
        self.assertEqual(import_res.data['imported_rows'], 2)
        self.assertEqual(import_res.data['duplicate_rows'], 0)

        # Verify entries in DB
        entries = BankStatementEntry.objects.filter(account=account)
        self.assertEqual(entries.count(), 2)
        entry1 = entries.get(reference_number='RZP-12345')
        self.assertEqual(entry1.credit_amount, Decimal('45000.00'))
        self.assertEqual(entry1.reconciliation_status, StatementEntryStatus.UNMATCHED)

    def test_10_duplicate_statement_import_prevention(self):
        """Importing the same statement rows again skips duplicates and preserves idempotency."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-STMT-DUP', name='ICICI Escrow',
            account_type=FinancialAccountType.BANK, institution_name='ICICI Bank'
        )

        csv_content = (
            "TxnDate,Particulars,RefNo,Withdrawal,Deposit\n"
            "2026-10-22,Insurance Claim Star Health,NEFT-STAR-7788,0.00,95000.00\n"
        )
        csv_file1 = SimpleUploadedFile("stmt1.csv", csv_content.encode('utf-8'), content_type="text/csv")
        self.client.post('/api/v1/billing-finance/bank-statements/import-csv/', {
            'account_id': str(account.id), 'file': csv_file1,
            'date_col': 0, 'desc_col': 1, 'ref_col': 2, 'debit_col': 3, 'credit_col': 4
        })

        # Re-upload same row
        csv_file2 = SimpleUploadedFile("stmt2.csv", csv_content.encode('utf-8'), content_type="text/csv")
        res2 = self.client.post('/api/v1/billing-finance/bank-statements/import-csv/', {
            'account_id': str(account.id), 'file': csv_file2,
            'date_col': 0, 'desc_col': 1, 'ref_col': 2, 'debit_col': 3, 'credit_col': 4
        })
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res2.data['imported_rows'], 0)
        self.assertEqual(res2.data['duplicate_rows'], 1)

    def test_11_reconciliation_suggest_and_confirm_match(self):
        """Matching engine suggests match based on reference & amount, and staff confirms it."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-RECON-MATCH', name='Axis Operations',
            account_type=FinancialAccountType.BANK, institution_name='Axis Bank'
        )
        # Recorded hospital transaction (credit to bank = money in)
        tx = FinancialAccountTransaction.objects.create(
            account=account, transaction_number='TX-AXIS-01', transaction_date='2026-10-20',
            description='Patient Surgery Package Payment', reference_number='AXIS-REF-999',
            debit_amount=Decimal('75000.00'), credit_amount=Decimal('0.00'),
            posting_status='POSTED', reconciliation_status='UNRECONCILED'
        )

        # Bank statement entry (credit to statement = money in)
        import_batch = BankStatementImport.objects.create(
            account=account, batch_number='BATCH-AXIS-01', file_name='axis.csv', uploaded_by=self.staff_acc1
        )
        stmt_entry = BankStatementEntry.objects.create(
            statement_import=import_batch, account=account, entry_date='2026-10-20',
            description='UPI Apex Hospital Surgery', reference_number='AXIS-REF-999',
            debit_amount=Decimal('0.00'), credit_amount=Decimal('75000.00'),
            reconciliation_status=StatementEntryStatus.UNMATCHED
        )

        # Initiate reconciliation
        init_res = self.client.post('/api/v1/billing-finance/reconciliations/initiate/', {
            'account_id': str(account.id),
            'period_start': '2026-10-01',
            'period_end': '2026-10-31',
            'statement_closing_balance': '75000.00',
            'statement_import_id': str(import_batch.id)
        }, format='json')
        self.assertEqual(init_res.status_code, status.HTTP_201_CREATED)
        recon_id = init_res.data['id']

        # Run auto-suggest matches
        sug_res = self.client.post(f"/api/v1/billing-finance/reconciliations/{recon_id}/suggest-matches/")
        self.assertEqual(sug_res.status_code, status.HTTP_200_OK)
        self.assertEqual(sug_res.data['suggested_count'], 1)

        stmt_entry.refresh_from_db()
        self.assertEqual(stmt_entry.reconciliation_status, StatementEntryStatus.SUGGESTED)
        self.assertEqual(stmt_entry.matched_ledger_transaction_id, tx.id)
        self.assertEqual(stmt_entry.match_confidence, 100)

        # Confirm match
        conf_res = self.client.post(f"/api/v1/billing-finance/reconciliations/{recon_id}/confirm-match/", {
            'statement_entry_id': str(stmt_entry.id),
            'ledger_transaction_id': str(tx.id)
        }, format='json')
        self.assertEqual(conf_res.status_code, status.HTTP_200_OK)

        stmt_entry.refresh_from_db()
        tx.refresh_from_db()
        self.assertEqual(stmt_entry.reconciliation_status, StatementEntryStatus.MATCHED)
        self.assertEqual(tx.reconciliation_status, 'RECONCILED')

    def test_12_reconciliation_record_adjustment(self):
        """Unmatched statement entry (e.g. bank charge) resolved through authorized adjustment."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-ADJ-TEST', name='Kotak Treasury',
            account_type=FinancialAccountType.BANK, institution_name='Kotak Bank'
        )
        import_batch = BankStatementImport.objects.create(
            account=account, batch_number='BATCH-KOTAK-01', file_name='kotak.csv', uploaded_by=self.staff_acc1
        )
        stmt_entry = BankStatementEntry.objects.create(
            statement_import=import_batch, account=account, entry_date='2026-10-23',
            description='Bank Monthly Consolidated Charges', reference_number='CHG-KOTAK-88',
            debit_amount=Decimal('450.00'), credit_amount=Decimal('0.00'),
            reconciliation_status=StatementEntryStatus.UNMATCHED
        )
        recon = AccountReconciliation.objects.create(
            reconciliation_number='REC-KOTAK-01', account=account, statement_import=import_batch,
            period_start='2026-10-01', period_end='2026-10-31',
            statement_closing_balance=Decimal('50000.00'), ledger_closing_balance=Decimal('50450.00'),
            prepared_by=self.staff_acc1
        )

        # Record adjustment
        adj_res = self.client.post(f"/api/v1/billing-finance/reconciliations/{recon.id}/record-adjustment/", {
            'statement_entry_id': str(stmt_entry.id),
            'category': 'BANK_CHARGES',
            'description': 'Monthly ledger maintenance charges'
        }, format='json')
        self.assertEqual(adj_res.status_code, status.HTTP_201_CREATED)

        stmt_entry.refresh_from_db()
        self.assertEqual(stmt_entry.reconciliation_status, StatementEntryStatus.ADJUSTED)
        self.assertIsNotNone(stmt_entry.matched_ledger_transaction)
        self.assertEqual(stmt_entry.matched_ledger_transaction.category, 'BANK_CHARGES')

    def test_13_separation_of_duties_enforcement_on_finalization(self):
        """Preparer cannot finalize/approve their own reconciliation; distinct supervisor required."""
        account = FinancialAccount.objects.create(
            account_code='FA-DUTY-01', name='Canara Bank Operational',
            account_type=FinancialAccountType.BANK, institution_name='Canara Bank'
        )
        recon = AccountReconciliation.objects.create(
            reconciliation_number='REC-DUTY-01', account=account,
            period_start='2026-10-01', period_end='2026-10-31',
            statement_closing_balance=Decimal('20000.00'), ledger_closing_balance=Decimal('20000.00'),
            unreconciled_difference=Decimal('0.00'), prepared_by=self.staff_acc1
        )

        # 1. Preparer attempts to finalize -> 403 Forbidden
        self.client.force_authenticate(user=self.user_acc1)
        res_prep = self.client.post(f"/api/v1/billing-finance/reconciliations/{recon.id}/finalize/")
        self.assertEqual(res_prep.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Separation of duties violation', res_prep.data['error'])

        # 2. Distinct Supervisor (staff_admin) approves -> 200 OK
        self.client.force_authenticate(user=self.user_admin)
        res_admin = self.client.post(f"/api/v1/billing-finance/reconciliations/{recon.id}/finalize/", {'notes': 'Approved after audit review.'})
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

        recon.refresh_from_db()
        account.refresh_from_db()
        self.assertEqual(recon.status, ReconciliationSessionStatus.RECONCILED)
        self.assertEqual(recon.approved_by, self.staff_admin)
        self.assertEqual(account.reconciliation_status, AccountReconciliationStatus.RECONCILED)
        self.assertIsNotNone(account.last_reconciled_at)

    def test_14_dashboard_stats_endpoint(self):
        """Dashboard statistics aggregate real balances for all 12 categories."""
        self.client.force_authenticate(user=self.user_acc1)
        res = self.client.get('/api/v1/billing-finance/financial-accounts/dashboard-stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        keys = [
            'total_active_accounts', 'total_bank_balances', 'total_cash_balances',
            'payment_gateway_clearing', 'upi_card_settlement', 'total_fixed_deposits',
            'investment_account_balances', 'outstanding_loan_liabilities',
            'patient_advance_deposit_liabilities', 'insurance_receivables',
            'supplier_payables', 'accounts_requiring_reconciliation',
            'accounts_overdue_reconciliation', 'summary'
        ]
        for k in keys:
            self.assertIn(k, res.data)

    def test_15_financial_supporting_documents(self):
        """Documents can be attached to accounts with valid formats and permissions."""
        self.client.force_authenticate(user=self.user_acc1)
        account = FinancialAccount.objects.create(
            account_code='FA-DOC-01', name='Doc Test Account',
            account_type=FinancialAccountType.BANK, institution_name='IDFC First'
        )
        fake_pdf = SimpleUploadedFile("account_opening.pdf", b"%PDF-1.4 Fake PDF Content", content_type="application/pdf")
        res = self.client.post('/api/v1/billing-finance/financial-documents/', {
            'account': str(account.id),
            'title': 'Certified Board Resolution & Signature Card',
            'document_type': FinancialDocumentType.ACCOUNT_OPENING,
            'file': fake_pdf
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['title'], 'Certified Board Resolution & Signature Card')
        self.assertEqual(res.data['document_type'], 'ACCOUNT_OPENING')
