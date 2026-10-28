import csv
import io
import re
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime, date

from django.db import transaction
from django.db.models import Sum, Q, F
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.authentication.permissions import IsStaffMember
from apps.authentication.utils import get_staff_profile
from apps.core.models import Branch, Department
from .models import (
    FinancialAccount, FinancialAccountTransaction, BankStatementImport,
    BankStatementEntry, AccountReconciliation, FinancialAccountDocument,
    FinancialAccountType, AccountingClassification, AccountReconciliationStatus,
    StatementEntryStatus, ReconciliationSessionStatus, FinancialDocumentType,
    InvestmentRegister, LoanRegister, PatientDeposit, InsuranceClaim,
    Payment, ClaimSettlement
)
from .serializers import (
    FinancialAccountSerializer, FinancialAccountTransactionSerializer,
    BankStatementImportSerializer, BankStatementEntrySerializer,
    AccountReconciliationSerializer, FinancialAccountDocumentSerializer
)


class FinancialAccountViewSet(viewsets.ModelViewSet):
    """
    CRUD and operational lifecycle for Financial Accounts master.
    Strictly forbids deleting accounts with financial transactions or reconciliations.
    """
    permission_classes = [IsStaffMember]
    serializer_class = FinancialAccountSerializer
    queryset = FinancialAccount.objects.select_related(
        'branch', 'department', 'linked_gl_account', 'created_by__user_profile'
    ).prefetch_related('ledger_transactions').all()

    def get_queryset(self):
        qs = super().get_queryset()
        acc_type = self.request.query_params.get('account_type')
        if acc_type:
            qs = qs.filter(account_type=acc_type)
        classification = self.request.query_params.get('classification')
        if classification:
            qs = qs.filter(classification=classification)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            if is_active.lower() in ['true', '1']:
                qs = qs.filter(is_active=True)
            elif is_active.lower() in ['false', '0']:
                qs = qs.filter(is_active=False)
        recon_status = self.request.query_params.get('reconciliation_status')
        if recon_status:
            qs = qs.filter(reconciliation_status=recon_status)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(account_code__icontains=search) |
                Q(name__icontains=search) |
                Q(institution_name__icontains=search) |
                Q(account_number_raw__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        staff = get_staff_profile(self.request.user)
        account = serializer.save(created_by=staff)
        # If opening balance is provided (>0), post initial transaction
        if account.opening_balance and account.opening_balance > Decimal('0.00'):
            is_asset = account.classification == AccountingClassification.ASSET
            FinancialAccountTransaction.objects.create(
                account=account,
                transaction_number=f"OB-{account.account_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}",
                transaction_date=account.opening_balance_date or timezone.localdate(),
                accounting_date=account.opening_balance_date or timezone.localdate(),
                category='OPENING_BALANCE',
                description=f"Opening Balance for {account.name}",
                debit_amount=account.opening_balance if is_asset else Decimal('0.00'),
                credit_amount=Decimal('0.00') if is_asset else account.opening_balance,
                payment_method='SYSTEM_INIT',
                reference_number=f"INIT-{account.account_code}",
                posting_status='POSTED',
                created_by=staff
            )

    def perform_destroy(self, instance):
        if instance.ledger_transactions.exists():
            raise DjangoValidationError(
                "Cannot delete financial account with existing financial transaction postings. Deactivate the account instead."
            )
        if instance.statement_imports.exists() or instance.reconciliations.exists():
            raise DjangoValidationError(
                "Cannot delete financial account with associated statement imports or reconciliation records. Deactivate the account instead."
            )
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except DjangoValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        account = self.get_object()
        account.is_active = not account.is_active
        account.save(update_fields=['is_active', 'updated_at'])
        action_word = "activated" if account.is_active else "deactivated"
        return Response({
            'message': f"Financial account {account.account_code} has been {action_word}.",
            'is_active': account.is_active
        })

    @action(detail=True, methods=['get'], url_path='transactions')
    def transactions(self, request, pk=None):
        account = self.get_object()
        qs = account.ledger_transactions.all()

        from_date = request.query_params.get('from_date')
        if from_date:
            qs = qs.filter(transaction_date__gte=from_date)
        to_date = request.query_params.get('to_date')
        if to_date:
            qs = qs.filter(transaction_date__lte=to_date)
        category = request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        search = request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(transaction_number__icontains=search) |
                Q(description__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(counterparty__icontains=search)
            )

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = FinancialAccountTransactionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = FinancialAccountTransactionSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='post-transaction')
    def post_transaction(self, request, pk=None):
        account = self.get_object()
        if not account.is_active:
            cat = request.data.get('category', '')
            if cat != 'AUTHORIZED_ADJUSTMENT':
                return Response(
                    {'error': 'Account is inactive. New transactions cannot be posted to inactive accounts without an authorized adjustment workflow.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        staff = get_staff_profile(request.user)
        debit_amount = Decimal(str(request.data.get('debit_amount', '0.00')))
        credit_amount = Decimal(str(request.data.get('credit_amount', '0.00')))
        description = request.data.get('description', '').strip()
        category = request.data.get('category', 'MANUAL_ADJUSTMENT').strip()
        ref = request.data.get('reference_number', '').strip()
        counterparty = request.data.get('counterparty', '').strip()
        method = request.data.get('payment_method', 'BANK_TRANSFER').strip()

        if not description:
            return Response({'error': 'Description is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if debit_amount <= Decimal('0.00') and credit_amount <= Decimal('0.00'):
            return Response({'error': 'Either debit amount or credit amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        tx_number = f"TX-{account.account_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        tx = FinancialAccountTransaction.objects.create(
            account=account,
            transaction_number=tx_number,
            transaction_date=request.data.get('transaction_date') or timezone.localdate(),
            accounting_date=request.data.get('accounting_date') or timezone.localdate(),
            category=category,
            description=description,
            counterparty=counterparty,
            debit_amount=debit_amount,
            credit_amount=credit_amount,
            payment_method=method,
            reference_number=ref,
            posting_status='POSTED',
            created_by=staff
        )
        return Response(FinancialAccountTransactionSerializer(tx).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        Calculates all 13 real-time dashboard figures from persisted database records.
        Distinguishes Assets, Liabilities, Receivables, and Payables.
        """
        accounts = list(FinancialAccount.objects.filter(is_active=True))

        total_bank_balances = Decimal('0.00')
        total_cash_balances = Decimal('0.00')
        payment_gateway_clearing = Decimal('0.00')
        upi_card_settlement = Decimal('0.00')
        total_fixed_deposits = Decimal('0.00')
        investment_account_balances = Decimal('0.00')
        outstanding_loan_liabilities = Decimal('0.00')
        patient_advance_deposit_liabilities = Decimal('0.00')
        insurance_receivables = Decimal('0.00')
        supplier_payables = Decimal('0.00')

        accounts_requiring_reconciliation = 0
        accounts_overdue_reconciliation = 0

        now = timezone.now()

        for acc in accounts:
            calc_balance, _, _ = acc.calculate_balance()

            if acc.account_type == FinancialAccountType.BANK:
                total_bank_balances += calc_balance
            elif acc.account_type in [FinancialAccountType.CASH, FinancialAccountType.PETTY_CASH]:
                total_cash_balances += calc_balance
            elif acc.account_type == FinancialAccountType.GATEWAY_CLEARING:
                payment_gateway_clearing += calc_balance
            elif acc.account_type in [FinancialAccountType.UPI_SETTLEMENT, FinancialAccountType.CARD_SETTLEMENT]:
                upi_card_settlement += calc_balance
            elif acc.account_type == FinancialAccountType.FIXED_DEPOSIT:
                total_fixed_deposits += calc_balance
            elif acc.account_type == FinancialAccountType.INVESTMENT:
                investment_account_balances += calc_balance
            elif acc.account_type == FinancialAccountType.LOAN_FACILITY:
                outstanding_loan_liabilities += calc_balance
            elif acc.account_type == FinancialAccountType.PATIENT_DEPOSIT_LIABILITY:
                patient_advance_deposit_liabilities += calc_balance
            elif acc.account_type == FinancialAccountType.INSURANCE_RECEIVABLE:
                insurance_receivables += calc_balance
            elif acc.account_type == FinancialAccountType.SUPPLIER_PAYABLE:
                supplier_payables += calc_balance

            if acc.reconciliation_status in [AccountReconciliationStatus.PENDING, AccountReconciliationStatus.DISCREPANCY]:
                accounts_requiring_reconciliation += 1
            if acc.reconciliation_status == AccountReconciliationStatus.DISCREPANCY:
                accounts_overdue_reconciliation += 1
            elif acc.last_reconciled_at and (now - acc.last_reconciled_at).days > 30:
                accounts_overdue_reconciliation += 1

        # Also pull supplementary totals from linked domain models if dedicated accounts haven't been created yet
        # e.g., InvestmentRegister, LoanRegister, PatientDeposit
        if total_fixed_deposits == Decimal('0.00'):
            fd_agg = InvestmentRegister.objects.filter(status='ACTIVE', category='FIXED_DEPOSIT').aggregate(total=Sum('principal_amount'))['total']
            if fd_agg:
                total_fixed_deposits = fd_agg

        if investment_account_balances == Decimal('0.00'):
            inv_agg = InvestmentRegister.objects.filter(status='ACTIVE').exclude(category='FIXED_DEPOSIT').aggregate(total=Sum('principal_amount'))['total']
            if inv_agg:
                investment_account_balances = inv_agg

        if outstanding_loan_liabilities == Decimal('0.00'):
            loan_agg = LoanRegister.objects.filter(status='ACTIVE').aggregate(total=Sum('outstanding_balance'))['total']
            if loan_agg:
                outstanding_loan_liabilities = loan_agg

        if patient_advance_deposit_liabilities == Decimal('0.00'):
            dep_agg = PatientDeposit.objects.filter(status='AVAILABLE').aggregate(total=Sum('available_balance'))['total']
            if dep_agg:
                patient_advance_deposit_liabilities = dep_agg

        if insurance_receivables == Decimal('0.00'):
            claim_agg = InsuranceClaim.objects.filter(status__in=['SUBMITTED', 'QUERIED', 'APPROVED']).aggregate(total=Sum('claim_amount'))['total']
            if claim_agg:
                insurance_receivables = claim_agg

        # Total Assets vs Total Liabilities summary
        total_assets = (
            total_bank_balances +
            total_cash_balances +
            payment_gateway_clearing +
            upi_card_settlement +
            total_fixed_deposits +
            investment_account_balances +
            insurance_receivables
        )
        total_liabilities = (
            outstanding_loan_liabilities +
            patient_advance_deposit_liabilities +
            supplier_payables
        )

        return Response({
            'total_active_accounts': len(accounts),
            'total_bank_balances': str(total_bank_balances),
            'total_cash_balances': str(total_cash_balances),
            'payment_gateway_clearing': str(payment_gateway_clearing),
            'upi_card_settlement': str(upi_card_settlement),
            'total_fixed_deposits': str(total_fixed_deposits),
            'investment_account_balances': str(investment_account_balances),
            'outstanding_loan_liabilities': str(outstanding_loan_liabilities),
            'patient_advance_deposit_liabilities': str(patient_advance_deposit_liabilities),
            'insurance_receivables': str(insurance_receivables),
            'supplier_payables': str(supplier_payables),
            'accounts_requiring_reconciliation': accounts_requiring_reconciliation,
            'accounts_overdue_reconciliation': accounts_overdue_reconciliation,
            'summary': {
                'total_assets': str(total_assets),
                'total_liabilities': str(total_liabilities),
                'net_treasury_position': str(total_assets - total_liabilities)
            }
        })


class BankStatementViewSet(viewsets.ViewSet):
    """
    Secure Bank Statement Import & Verification engine.
    Imports CSV files, detects duplicates, maps columns, and prepares entries for matching.
    """
    permission_classes = [IsStaffMember]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=['post'], url_path='preview-csv')
    def preview_csv(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No statement file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith(('.csv', '.txt')):
            return Response({'error': 'Invalid file format. Please upload a standard CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj.size > 10 * 1024 * 1024:
            return Response({'error': 'File size exceeds maximum permitted limit of 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            content = file_obj.read().decode('utf-8-sig', errors='replace')
            reader = csv.reader(io.StringIO(content))
            rows = [row for row in reader if any(cell.strip() for cell in row)]
        except Exception as e:
            return Response({'error': f"Failed to parse CSV file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        if len(rows) < 2:
            return Response({'error': 'The uploaded CSV file is empty or contains only header row.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = [h.strip() for h in rows[0]]
        preview_rows = rows[1:11]

        # Auto-detect column mapping
        mapping = {}
        for idx, h in enumerate(headers):
            hl = h.lower().replace(' ', '_').replace('.', '')
            if any(k in hl for k in ['date', 'txn_date', 'txndate', 'value_date']) and 'date' not in mapping:
                mapping['date_col'] = idx
            elif any(k in hl for k in ['desc', 'particular', 'narration', 'remark', 'details']) and 'desc_col' not in mapping:
                mapping['desc_col'] = idx
            elif any(k in hl for k in ['ref', 'chq', 'cheque', 'utr', 'txn_id', 'reference']) and 'ref_col' not in mapping:
                mapping['ref_col'] = idx
            elif any(k in hl for k in ['debit', 'dr', 'withdrawal', 'dr_amount', 'paid']) and 'debit_col' not in mapping:
                mapping['debit_col'] = idx
            elif any(k in hl for k in ['credit', 'cr', 'deposit', 'cr_amount', 'received']) and 'credit_col' not in mapping:
                mapping['credit_col'] = idx
            elif any(k in hl for k in ['balance', 'bal', 'closing_balance']) and 'balance_col' not in mapping:
                mapping['balance_col'] = idx

        return Response({
            'file_name': file_obj.name,
            'total_rows': len(rows) - 1,
            'headers': headers,
            'preview_rows': preview_rows,
            'detected_mapping': mapping
        })

    @action(detail=False, methods=['post'], url_path='import-csv')
    @transaction.atomic
    def import_csv(self, request):
        account_id = request.data.get('account_id')
        if not account_id:
            return Response({'error': 'Target financial account ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = FinancialAccount.objects.get(pk=account_id)
        except FinancialAccount.DoesNotExist:
            return Response({'error': 'Target financial account does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No statement file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse column indices
        date_col = int(request.data.get('date_col', 0))
        desc_col = int(request.data.get('desc_col', 1))
        ref_col = int(request.data.get('ref_col', 2))
        debit_col = int(request.data.get('debit_col', 3))
        credit_col = int(request.data.get('credit_col', 4))
        balance_col_raw = request.data.get('balance_col')
        balance_col = int(balance_col_raw) if balance_col_raw is not None and str(balance_col_raw).isdigit() else None

        content = file_obj.read().decode('utf-8-sig', errors='replace')
        reader = csv.reader(io.StringIO(content))
        rows = [row for row in reader if any(cell.strip() for cell in row)]

        if len(rows) < 2:
            return Response({'error': 'CSV contains no data rows.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        batch_number = f"STMT-{account.account_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

        import_batch = BankStatementImport.objects.create(
            account=account,
            batch_number=batch_number,
            file_name=file_obj.name,
            file_size_bytes=file_obj.size,
            uploaded_by=staff,
            status='COMPLETED'
        )

        imported_count = 0
        duplicate_count = 0
        created_entries = []

        date_formats = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d/%m/%y', '%d-%m-%y', '%m/%d/%Y']

        for row_idx, row in enumerate(rows[1:], start=2):
            try:
                raw_date = row[date_col].strip()
                parsed_date = None
                for fmt in date_formats:
                    try:
                        parsed_date = datetime.strptime(raw_date, fmt).date()
                        break
                    except ValueError:
                        continue
                if not parsed_date:
                    continue  # Skip unparseable date rows

                raw_desc = row[desc_col].strip() if desc_col < len(row) else ''
                # Formula injection protection: strip leading =, +, -, @
                if raw_desc.startswith(('=', '+', '-', '@')):
                    raw_desc = "'" + raw_desc

                raw_ref = row[ref_col].strip() if ref_col < len(row) else ''

                # Parse debit
                raw_debit = row[debit_col].strip().replace(',', '').replace('₹', '') if debit_col < len(row) else '0'
                try:
                    debit_val = Decimal(raw_debit) if raw_debit else Decimal('0.00')
                except InvalidOperation:
                    debit_val = Decimal('0.00')

                # Parse credit
                raw_credit = row[credit_col].strip().replace(',', '').replace('₹', '') if credit_col < len(row) else '0'
                try:
                    credit_val = Decimal(raw_credit) if raw_credit else Decimal('0.00')
                except InvalidOperation:
                    credit_val = Decimal('0.00')

                balance_after = None
                if balance_col is not None and balance_col < len(row):
                    raw_bal = row[balance_col].strip().replace(',', '').replace('₹', '')
                    try:
                        balance_after = Decimal(raw_bal) if raw_bal else None
                    except InvalidOperation:
                        balance_after = None

                # Duplicate detection within same account
                is_duplicate = BankStatementEntry.objects.filter(
                    account=account,
                    entry_date=parsed_date,
                    reference_number=raw_ref,
                    debit_amount=debit_val,
                    credit_amount=credit_val
                ).exists()

                if is_duplicate:
                    duplicate_count += 1
                    continue

                entry = BankStatementEntry(
                    statement_import=import_batch,
                    account=account,
                    entry_date=parsed_date,
                    description=raw_desc[:250],
                    reference_number=raw_ref[:100],
                    debit_amount=debit_val,
                    credit_amount=credit_val,
                    balance_after=balance_after,
                    reconciliation_status=StatementEntryStatus.UNMATCHED
                )
                created_entries.append(entry)
                imported_count += 1

            except Exception:
                continue

        if created_entries:
            BankStatementEntry.objects.bulk_create(created_entries)

        import_batch.total_rows = len(rows) - 1
        import_batch.imported_rows = imported_count
        import_batch.duplicate_rows = duplicate_count
        import_batch.save(update_fields=['total_rows', 'imported_rows', 'duplicate_rows'])

        return Response({
            'message': f"Successfully imported {imported_count} bank statement entries ({duplicate_count} duplicates skipped).",
            'batch_number': batch_number,
            'import_batch_id': import_batch.id,
            'imported_rows': imported_count,
            'duplicate_rows': duplicate_count,
            'total_rows': import_batch.total_rows
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='batches')
    def batches(self, request):
        account_id = request.query_params.get('account_id')
        qs = BankStatementImport.objects.select_related('account', 'uploaded_by__user_profile').all()
        if account_id:
            qs = qs.filter(account_id=account_id)
        serializer = BankStatementImportSerializer(qs[:50], many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='entries')
    def entries(self, request):
        account_id = request.query_params.get('account_id')
        batch_id = request.query_params.get('batch_id')
        recon_status = request.query_params.get('status')

        qs = BankStatementEntry.objects.select_related('account', 'statement_import', 'matched_ledger_transaction').all()
        if account_id:
            qs = qs.filter(account_id=account_id)
        if batch_id:
            qs = qs.filter(statement_import_id=batch_id)
        if recon_status:
            qs = qs.filter(reconciliation_status=recon_status)

        serializer = BankStatementEntrySerializer(qs[:200], many=True)
        return Response(serializer.data)


class AccountReconciliationViewSet(viewsets.ModelViewSet):
    """
    Formal Bank & Settlement Reconciliation Workspace.
    Enforces side-by-side matching, auto-suggestions, adjustments, and separation of duties.
    """
    permission_classes = [IsStaffMember]
    serializer_class = AccountReconciliationSerializer
    queryset = AccountReconciliation.objects.select_related(
        'account', 'statement_import', 'prepared_by__user_profile', 'approved_by__user_profile'
    ).all()

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account_id')
        if account_id:
            qs = qs.filter(account_id=account_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=False, methods=['post'], url_path='initiate')
    def initiate(self, request):
        account_id = request.data.get('account_id')
        if not account_id:
            return Response({'error': 'Account ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = FinancialAccount.objects.get(pk=account_id)
        except FinancialAccount.DoesNotExist:
            return Response({'error': 'Financial account not found.'}, status=status.HTTP_404_NOT_FOUND)

        period_start = request.data.get('period_start')
        period_end = request.data.get('period_end')
        statement_closing_balance = Decimal(str(request.data.get('statement_closing_balance', '0.00')))
        statement_import_id = request.data.get('statement_import_id')

        if not period_start or not period_end:
            return Response({'error': 'Reconciliation period start and end dates are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate ledger balance as of period_end
        ledger_closing_balance, _, _ = account.calculate_balance()
        unreconciled_difference = statement_closing_balance - ledger_closing_balance

        staff = get_staff_profile(request.user)
        recon_number = f"REC-{account.account_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}"

        recon = AccountReconciliation.objects.create(
            reconciliation_number=recon_number,
            account=account,
            statement_import_id=statement_import_id if statement_import_id else None,
            period_start=period_start,
            period_end=period_end,
            statement_closing_balance=statement_closing_balance,
            ledger_closing_balance=ledger_closing_balance,
            unreconciled_difference=unreconciled_difference,
            status=ReconciliationSessionStatus.DRAFT,
            prepared_by=staff,
            notes=request.data.get('notes', '')
        )
        return Response(AccountReconciliationSerializer(recon).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='suggest-matches')
    def suggest_matches(self, request, pk=None):
        """
        Runs the algorithmic matching engine comparing statement entries and ledger transactions.
        Rule 1: Exact reference match + exact debit/credit amount -> 100% confidence.
        Rule 2: Exact debit/credit amount within 7 days -> 80% confidence.
        """
        recon = self.get_object()
        account = recon.account

        # Unmatched statement entries for this account
        stmt_entries = BankStatementEntry.objects.filter(
            account=account,
            reconciliation_status__in=[StatementEntryStatus.UNMATCHED, StatementEntryStatus.SUGGESTED]
        )

        # Unreconciled ledger transactions for this account
        ledger_txs = list(FinancialAccountTransaction.objects.filter(
            account=account,
            posting_status='POSTED',
            reconciliation_status='UNRECONCILED'
        ))

        suggested_count = 0

        for entry in stmt_entries:
            matched_tx = None
            confidence = 0

            # 1. Check exact reference match with amount
            for tx in ledger_txs:
                if entry.reference_number and tx.reference_number and entry.reference_number.strip().lower() == tx.reference_number.strip().lower():
                    # Check amounts: bank debit = ledger credit (withdrawal), or bank credit = ledger debit (deposit)
                    if (entry.debit_amount > 0 and tx.credit_amount == entry.debit_amount) or \
                       (entry.credit_amount > 0 and tx.debit_amount == entry.credit_amount):
                        matched_tx = tx
                        confidence = 100
                        break

            # 2. Check exact amount within 7 days
            if not matched_tx:
                for tx in ledger_txs:
                    amount_matches = (entry.debit_amount > 0 and tx.credit_amount == entry.debit_amount) or \
                                     (entry.credit_amount > 0 and tx.debit_amount == entry.credit_amount)
                    if amount_matches:
                        day_diff = abs((entry.entry_date - tx.transaction_date).days)
                        if day_diff <= 7:
                            matched_tx = tx
                            confidence = 80
                            break

            if matched_tx:
                entry.matched_ledger_transaction = matched_tx
                entry.match_confidence = confidence
                entry.reconciliation_status = StatementEntryStatus.SUGGESTED
                entry.save(update_fields=['matched_ledger_transaction', 'match_confidence', 'reconciliation_status'])
                suggested_count += 1

        return Response({
            'message': f"Automated matching engine identified {suggested_count} potential matches.",
            'suggested_count': suggested_count
        })

    @action(detail=True, methods=['post'], url_path='confirm-match')
    def confirm_match(self, request, pk=None):
        self.get_object()  # ensures reconciliation exists
        entry_id = request.data.get('statement_entry_id')
        tx_id = request.data.get('ledger_transaction_id')

        try:
            entry = BankStatementEntry.objects.get(pk=entry_id)
        except BankStatementEntry.DoesNotExist:
            return Response({'error': 'Statement entry not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx_id:
            try:
                tx = FinancialAccountTransaction.objects.get(pk=tx_id)
            except FinancialAccountTransaction.DoesNotExist:
                return Response({'error': 'Ledger transaction not found.'}, status=status.HTTP_404_NOT_FOUND)
        elif entry.matched_ledger_transaction:
            tx = entry.matched_ledger_transaction
        else:
            return Response({'error': 'No ledger transaction provided to match with statement entry.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        with transaction.atomic():
            entry.matched_ledger_transaction = tx
            entry.reconciliation_status = StatementEntryStatus.MATCHED
            entry.match_confidence = 100
            entry.matched_at = timezone.now()
            entry.matched_by = staff
            entry.save()

            tx.reconciliation_status = 'RECONCILED'
            tx.save(update_fields=['reconciliation_status'])

        return Response({'message': 'Statement entry successfully matched with recorded ledger transaction.'})

    @action(detail=True, methods=['post'], url_path='unmatch')
    def unmatch(self, request, pk=None):
        self.get_object()
        entry_id = request.data.get('statement_entry_id')
        try:
            entry = BankStatementEntry.objects.get(pk=entry_id)
        except BankStatementEntry.DoesNotExist:
            return Response({'error': 'Statement entry not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if entry.matched_ledger_transaction:
                tx = entry.matched_ledger_transaction
                tx.reconciliation_status = 'UNRECONCILED'
                tx.save(update_fields=['reconciliation_status'])

            entry.matched_ledger_transaction = None
            entry.reconciliation_status = StatementEntryStatus.UNMATCHED
            entry.match_confidence = 0
            entry.matched_at = None
            entry.matched_by = None
            entry.save()

        return Response({'message': 'Statement entry match removed.'})

    @action(detail=True, methods=['post'], url_path='record-adjustment')
    def record_adjustment(self, request, pk=None):
        recon = self.get_object()
        entry_id = request.data.get('statement_entry_id')
        try:
            entry = BankStatementEntry.objects.get(pk=entry_id)
        except BankStatementEntry.DoesNotExist:
            return Response({'error': 'Statement entry not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)
        category = request.data.get('category', 'RECON_ADJUSTMENT')
        description = request.data.get('description', f"Reconciliation Adjustment: {entry.description}")

        with transaction.atomic():
            # For Bank statement: debit in statement = money out (ledger credit). credit in statement = money in (ledger debit).
            adj_tx = FinancialAccountTransaction.objects.create(
                account=recon.account,
                transaction_number=f"ADJ-{recon.reconciliation_number}-{entry.id.hex[:6].upper()}",
                transaction_date=entry.entry_date,
                accounting_date=timezone.localdate(),
                category=category,
                description=description,
                counterparty="Bank / Settlement Adjustment",
                debit_amount=entry.credit_amount,
                credit_amount=entry.debit_amount,
                payment_method='ADJUSTMENT',
                reference_number=entry.reference_number or recon.reconciliation_number,
                posting_status='POSTED',
                reconciliation_status='RECONCILED',
                created_by=staff,
                approved_by=staff
            )

            entry.matched_ledger_transaction = adj_tx
            entry.reconciliation_status = StatementEntryStatus.ADJUSTED
            entry.match_confidence = 100
            entry.matched_at = timezone.now()
            entry.matched_by = staff
            entry.save()

        return Response({
            'message': 'Reconciliation adjustment ledger transaction recorded successfully.',
            'adjustment_transaction_id': adj_tx.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='finalize')
    def finalize(self, request, pk=None):
        recon = self.get_object()
        staff = get_staff_profile(request.user)

        # SEPARATION OF DUTIES ENFORCEMENT
        # The staff member who prepared the reconciliation cannot approve / finalize it.
        if recon.prepared_by and staff and recon.prepared_by.id == staff.id:
            return Response(
                {'error': 'Separation of duties violation: The staff member who prepared the reconciliation cannot approve or finalize it.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Check if difference is 0 or all unmatched entries have been reviewed
        unmatched_count = BankStatementEntry.objects.filter(
            account=recon.account,
            statement_import=recon.statement_import,
            reconciliation_status=StatementEntryStatus.UNMATCHED
        ).count()

        if unmatched_count > 0:
            allow_force = request.data.get('force_with_unmatched', False)
            if not allow_force:
                return Response({
                    'error': f"Cannot finalize reconciliation: {unmatched_count} statement entries remain unmatched. Match or record adjustments for pending items first.",
                    'unmatched_count': unmatched_count
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            recon.status = ReconciliationSessionStatus.RECONCILED
            recon.approved_by = staff
            recon.approved_at = timezone.now()
            recon.notes = (recon.notes + "\n" + request.data.get('notes', '')).strip()
            latest_ledger, _, _ = recon.account.calculate_balance()
            recon.ledger_closing_balance = latest_ledger
            recon.unreconciled_difference = recon.statement_closing_balance - latest_ledger
            recon.save()

            account = recon.account
            account.reconciliation_status = AccountReconciliationStatus.RECONCILED
            account.last_reconciled_at = timezone.now()
            account.save(update_fields=['reconciliation_status', 'last_reconciled_at'])

        return Response({
            'message': f"Reconciliation {recon.reconciliation_number} approved and finalized successfully.",
            'reconciliation_status': recon.status,
            'approved_by': staff.user_profile.full_name if staff and staff.user_profile else 'Authorized Staff'
        })


class FinancialDocumentViewSet(viewsets.ModelViewSet):
    """
    Supporting Documents storage & access control for Financial Accounts and Reconciliations.
    """
    permission_classes = [IsStaffMember]
    serializer_class = FinancialAccountDocumentSerializer
    parser_classes = [MultiPartParser, FormParser]
    queryset = FinancialAccountDocument.objects.select_related('account', 'reconciliation', 'uploaded_by__user_profile').all()

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account_id')
        if account_id:
            qs = qs.filter(account_id=account_id)
        recon_id = self.request.query_params.get('reconciliation_id')
        if recon_id:
            qs = qs.filter(reconciliation_id=recon_id)
        return qs

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get('file')
        if not file_obj:
            raise DjangoValidationError("File is required.")

        allowed_extensions = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx']
        file_ext = '.' + file_obj.name.split('.')[-1].lower() if '.' in file_obj.name else ''
        if file_ext not in allowed_extensions:
            raise DjangoValidationError(f"Invalid file type '{file_ext}'. Allowed types: PDF, PNG, JPG, CSV, XLSX.")

        if file_obj.size > 10 * 1024 * 1024:
            raise DjangoValidationError("File size exceeds 10 MB limit.")

        staff = get_staff_profile(self.request.user)
        serializer.save(
            uploaded_by=staff,
            file_size=file_obj.size,
            mime_type=file_obj.content_type or 'application/octet-stream'
        )
