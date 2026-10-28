import csv
import io
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime, date

from django.db import transaction
from django.db.models import Sum, Q, Count
from django.utils import timezone
from django.http import HttpResponse

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from apps.authentication.models import (
    StaffProfile, RoleEnum, FinancialApprovalPolicy,
    FinancialOperationType
)
from .models import (
    FinancialAccount, FinancialAccountTransaction,
    FinancialTransactionAuditLog, FinancialAccountDocument,
    TransactionLifecycleStatus, TransactionType,
    FinancialTransactionCategory, AccountingClassification,
    FinancialDocumentType
)
from .serializers import (
    FinancialAccountTransactionSerializer,
    FinancialTransactionAuditLogSerializer,
    FinancialAccountDocumentSerializer
)
from .financial_account_views import get_staff_profile, IsStaffMember


def _sync_tx_to_gl(tx, staff):
    if tx.journal_entry:
        return
    try:
        from .general_ledger_service import GeneralLedgerService
        cat = str(tx.category)
        event_type = 'BANK_TRANSFER'
        if cat in ['PATIENT_RECEIPT_ADVANCE', 'PATIENT_COLLECTION', 'OPD_IPD_COLLECTION', 'PHARMACY_DIAGNOSTIC_COLLECTION']:
            event_type = 'PATIENT_CASH_COLLECTION'
        elif cat == 'INSURANCE_CORPORATE_COLLECTION':
            event_type = 'INSURANCE_SETTLEMENT'
        elif cat in ['SUPPLIER_VENDOR_PAYMENT', 'OPERATING_EXPENSE', 'PAYROLL_PAYMENT']:
            event_type = 'SUPPLIER_PAYMENT'
        elif cat in ['BANK_CHARGES', 'GATEWAY_SETTLEMENT_FEE']:
            event_type = 'BANK_CHARGES'
        elif cat == 'LOAN_DISBURSEMENT_REPAYMENT':
            event_type = 'LOAN_REPAYMENT'
        elif cat == 'FIXED_DEPOSIT_TRANSACTION':
            event_type = 'FIXED_DEPOSIT_PLACEMENT'
        elif cat == 'INVESTMENT_TRANSACTION':
            event_type = 'INVESTMENT_INCOME'
        elif cat == 'PATIENT_REFUND_REVERSAL':
            event_type = 'PATIENT_REFUND'
        elif cat in ['BANK_TRANSFER_INTERACCOUNT', 'UPI_CARD_SETTLEMENT']:
            event_type = 'BANK_TRANSFER'

        amt = tx.amount
        if not amt or amt == Decimal('0.00'):
            amt = tx.debit_amount if tx.debit_amount > 0 else tx.credit_amount

        journal = GeneralLedgerService.auto_post_module_event(
            event_type=event_type,
            payload={
                'source_id': str(tx.id),
                'source_module': 'FINANCIAL_TRANSACTION',
                'amount': amt,
                'payment_method': tx.payment_method or 'BANK',
                'reference': tx.transaction_number,
                'narration': tx.description,
                'branch_id': tx.branch_id if tx.branch else None,
                'date': tx.transaction_date,
            },
            staff_profile=staff
        )
        if journal:
            tx.journal_entry = journal
            tx.save(update_fields=['journal_entry'])
    except Exception:
        pass


class FinancialTransactionViewSet(viewsets.ModelViewSet):
    """
    Section 14: Comprehensive Financial Transaction Management.
    Enforces the complete transaction lifecycle:
    Draft -> Pending Approval -> Approved -> Posted -> Reconciled
    with support for Rejection, Reversal, Cancellation, Dual-leg Transfers,
    Audit Logging, and Separation of Duties.
    """
    permission_classes = [IsStaffMember]
    serializer_class = FinancialAccountTransactionSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    queryset = FinancialAccountTransaction.objects.select_related(
        'account', 'destination_financial_account', 'branch', 'department',
        'created_by__user_profile', 'submitted_by__user_profile',
        'approved_by__user_profile', 'rejected_by__user_profile',
        'posted_by__user_profile', 'reversed_by__user_profile',
        'reversal_of', 'transfer_paired_transaction'
    ).prefetch_related('audit_logs', 'documents').all()

    def get_queryset(self):
        qs = super().get_queryset()

        # Date range filters
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            try:
                qs = qs.filter(transaction_date__gte=datetime.strptime(start_date, '%Y-%m-%d').date())
            except ValueError:
                pass
        if end_date:
            try:
                qs = qs.filter(transaction_date__lte=datetime.strptime(end_date, '%Y-%m-%d').date())
            except ValueError:
                pass

        # Account filter
        account_id = self.request.query_params.get('account_id')
        if account_id:
            qs = qs.filter(Q(account_id=account_id) | Q(destination_financial_account_id=account_id))

        # Category filter
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        # Lifecycle status filter
        tx_status = self.request.query_params.get('status')
        if tx_status:
            qs = qs.filter(lifecycle_status=tx_status)

        # Transaction type filter (DEBIT, CREDIT, TRANSFER)
        tx_type = self.request.query_params.get('transaction_type')
        if tx_type:
            qs = qs.filter(transaction_type=tx_type)

        # Payment method filter
        payment_method = self.request.query_params.get('payment_method')
        if payment_method:
            qs = qs.filter(payment_method=payment_method)

        # Min and Max amount
        min_amount = self.request.query_params.get('min_amount')
        if min_amount:
            try:
                qs = qs.filter(amount__gte=Decimal(min_amount))
            except (InvalidOperation, ValueError):
                pass
        max_amount = self.request.query_params.get('max_amount')
        if max_amount:
            try:
                qs = qs.filter(amount__lte=Decimal(max_amount))
            except (InvalidOperation, ValueError):
                pass

        # Search filter
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(transaction_number__icontains=search) |
                Q(description__icontains=search) |
                Q(reference_number__icontains=search) |
                Q(counterparty__icontains=search) |
                Q(notes__icontains=search) |
                Q(account__name__icontains=search) |
                Q(account__account_code__icontains=search)
            )

        return qs.order_by('-transaction_date', '-created_at')

    # =========================================================================
    # DASHBOARD STATS
    # =========================================================================
    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        Computes Section 14 dashboard summary metrics directly from persisted database records.
        Distinguishes totals, approval queue counts, posted sums, and reconciliations.
        """
        all_txns = FinancialAccountTransaction.objects.all()

        total_txns = all_txns.exclude(lifecycle_status=TransactionLifecycleStatus.CANCELLED).count()

        # Only POSTED transactions calculate debits and credits
        posted_txns = all_txns.filter(lifecycle_status=TransactionLifecycleStatus.POSTED)
        total_debits = posted_txns.aggregate(total=Sum('debit_amount'))['total'] or Decimal('0.00')
        total_credits = posted_txns.aggregate(total=Sum('credit_amount'))['total'] or Decimal('0.00')

        awaiting_approval = all_txns.filter(lifecycle_status=TransactionLifecycleStatus.PENDING_APPROVAL).count()
        approved_posted = posted_txns.count()
        reconciled_txns = all_txns.filter(
            Q(lifecycle_status=TransactionLifecycleStatus.RECONCILED) |
            Q(reconciliation_status='RECONCILED')
        ).count()
        failed_rejected = all_txns.filter(lifecycle_status=TransactionLifecycleStatus.REJECTED).count()

        pending_refunds_reversals = all_txns.filter(
            category=FinancialTransactionCategory.PATIENT_REFUND_REVERSAL,
            lifecycle_status__in=[TransactionLifecycleStatus.DRAFT, TransactionLifecycleStatus.PENDING_APPROVAL]
        ).count()

        awaiting_reconciliation = posted_txns.filter(reconciliation_status='UNRECONCILED').count()

        # Category breakdowns
        category_breakdown = list(
            posted_txns.values('category').annotate(
                count=Count('id'),
                total_amount=Sum('amount')
            ).order_by('-total_amount')[:8]
        )

        # Status breakdowns
        status_breakdown = dict(
            all_txns.values('lifecycle_status').annotate(count=Count('id')).values_list('lifecycle_status', 'count')
        )

        return Response({
            'total_transactions': total_txns,
            'total_credits': str(total_credits),
            'total_debits': str(total_debits),
            'net_flow': str(total_credits - total_debits),
            'transactions_awaiting_approval': awaiting_approval,
            'approved_posted_transactions': approved_posted,
            'reconciled_transactions': reconciled_txns,
            'failed_rejected_transactions': failed_rejected,
            'pending_refunds_reversals': pending_refunds_reversals,
            'transactions_awaiting_reconciliation': awaiting_reconciliation,
            'category_breakdown': category_breakdown,
            'status_breakdown': status_breakdown
        })

    # =========================================================================
    # CREATE TRANSACTION (+ DUAL-LEG TRANSFER SUPPORT)
    # =========================================================================
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)

        # Idempotency duplicate check
        idempotency_key = data.get('idempotency_key', '').strip()
        if idempotency_key:
            existing = FinancialAccountTransaction.objects.filter(idempotency_key=idempotency_key).first()
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)

        account_id = data.get('account_id')
        if not account_id:
            return Response({'error': 'Source financial account is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            account = FinancialAccount.objects.get(pk=account_id)
        except FinancialAccount.DoesNotExist:
            return Response({'error': 'Selected financial account was not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not account.is_active:
            return Response({'error': f"Cannot post to inactive financial account '{account.account_code}'."}, status=status.HTTP_400_BAD_REQUEST)

        tx_type = data.get('transaction_type', TransactionType.DEBIT)
        category = data.get('category', FinancialTransactionCategory.OTHER_INCOME_EXPENSE)
        description = data.get('description', '').strip()
        counterparty = data.get('counterparty', '').strip()
        ref_num = data.get('reference_number', '').strip()
        notes = data.get('notes', '').strip()
        payment_method = data.get('payment_method', 'BANK_TRANSFER').strip()

        try:
            amount = Decimal(str(data.get('amount', '0.00')).replace(',', '').replace('₹', ''))
        except (InvalidOperation, ValueError):
            return Response({'error': 'Please provide a valid numeric transaction amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0.00'):
            return Response({'error': 'Transaction amount must be strictly greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        if not description:
            return Response({'error': 'Description is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Duplicate reference number check within account
        if ref_num:
            duplicate_ref = FinancialAccountTransaction.objects.filter(
                account=account,
                reference_number=ref_num
            ).exclude(lifecycle_status__in=[TransactionLifecycleStatus.CANCELLED, TransactionLifecycleStatus.REJECTED]).first()
            if duplicate_ref:
                return Response({
                    'error': f"Duplicate external reference '{ref_num}' already exists in transaction {duplicate_ref.transaction_number} for this account."
                }, status=status.HTTP_400_BAD_REQUEST)

        # Date validations
        tx_date_str = data.get('transaction_date')
        tx_date = datetime.strptime(tx_date_str, '%Y-%m-%d').date() if tx_date_str else timezone.localdate()
        acct_date_str = data.get('accounting_date')
        acct_date = datetime.strptime(acct_date_str, '%Y-%m-%d').date() if acct_date_str else tx_date

        is_draft = data.get('is_draft', False)
        requires_approval = data.get('requires_approval', False)
        auto_post = data.get('auto_post', False)

        is_admin_or_mgr = request.user.is_superuser or (
            staff and staff.user_profile and staff.user_profile.role and
            staff.user_profile.role.name in [RoleEnum.SUPER_ADMIN, RoleEnum.FINANCE_MANAGER, RoleEnum.HOSPITAL_ADMIN]
        )

        # Decide initial lifecycle status
        if is_draft:
            initial_status = TransactionLifecycleStatus.DRAFT
            initial_posting = 'PENDING'
        elif auto_post and is_admin_or_mgr:
            initial_status = TransactionLifecycleStatus.POSTED
            initial_posting = 'POSTED'
        elif requires_approval or (amount > Decimal('50000.00') and not is_admin_or_mgr):
            initial_status = TransactionLifecycleStatus.PENDING_APPROVAL
            initial_posting = 'PENDING'
        elif is_admin_or_mgr:
            initial_status = TransactionLifecycleStatus.POSTED
            initial_posting = 'POSTED'
        else:
            initial_status = TransactionLifecycleStatus.PENDING_APPROVAL
            initial_posting = 'PENDING'

        # =====================================================================
        # 1. INTER-ACCOUNT TRANSFER WORKFLOW (DUAL LEG)
        # =====================================================================
        if tx_type == TransactionType.TRANSFER:
            dest_id = data.get('destination_account_id')
            if not dest_id:
                return Response({'error': 'Destination account is required for an inter-account transfer.'}, status=status.HTTP_400_BAD_REQUEST)
            if str(dest_id) == str(account.id):
                return Response({'error': 'Source and destination accounts must be different for a transfer.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                dest_account = FinancialAccount.objects.get(pk=dest_id)
            except FinancialAccount.DoesNotExist:
                return Response({'error': 'Selected destination financial account was not found.'}, status=status.HTTP_404_NOT_FOUND)

            if not dest_account.is_active:
                return Response({'error': f"Destination account '{dest_account.account_code}' is inactive."}, status=status.HTTP_400_BAD_REQUEST)

            # Leg 1: Outgoing from Source (Credit)
            tx1_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}-OUT"
            tx1 = FinancialAccountTransaction.objects.create(
                account=account,
                destination_financial_account=dest_account,
                transaction_number=tx1_number,
                transaction_date=tx_date,
                accounting_date=acct_date,
                transaction_type=TransactionType.TRANSFER,
                category=FinancialTransactionCategory.BANK_TRANSFER_INTERACCOUNT,
                description=f"Transfer to {dest_account.name} ({dest_account.account_code}): {description}",
                source_account=account.name,
                destination_account=dest_account.name,
                counterparty=dest_account.name,
                amount=amount,
                debit_amount=Decimal('0.00'),
                credit_amount=amount,
                payment_method=payment_method,
                reference_number=ref_num or f"TRF-{tx1_number}",
                posting_status=initial_posting,
                lifecycle_status=initial_status,
                idempotency_key=idempotency_key,
                notes=notes,
                created_by=staff,
                submitted_by=staff if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
                submitted_at=timezone.now() if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
                posted_by=staff if initial_status == TransactionLifecycleStatus.POSTED else None,
                posted_at=timezone.now() if initial_status == TransactionLifecycleStatus.POSTED else None
            )

            # Leg 2: Incoming to Destination (Debit)
            tx2_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}-IN"
            tx2 = FinancialAccountTransaction.objects.create(
                account=dest_account,
                destination_financial_account=account,
                transaction_number=tx2_number,
                transaction_date=tx_date,
                accounting_date=acct_date,
                transaction_type=TransactionType.TRANSFER,
                category=FinancialTransactionCategory.BANK_TRANSFER_INTERACCOUNT,
                description=f"Transfer from {account.name} ({account.account_code}): {description}",
                source_account=account.name,
                destination_account=dest_account.name,
                counterparty=account.name,
                amount=amount,
                debit_amount=amount,
                credit_amount=Decimal('0.00'),
                payment_method=payment_method,
                reference_number=ref_num or f"TRF-{tx2_number}",
                posting_status=initial_posting,
                lifecycle_status=initial_status,
                notes=notes,
                transfer_paired_transaction=tx1,
                created_by=staff,
                submitted_by=staff if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
                submitted_at=timezone.now() if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
                posted_by=staff if initial_status == TransactionLifecycleStatus.POSTED else None,
                posted_at=timezone.now() if initial_status == TransactionLifecycleStatus.POSTED else None
            )

            # Cross-pair tx1 to tx2
            tx1.transfer_paired_transaction = tx2
            tx1.save(update_fields=['transfer_paired_transaction'])

            # Audit logs
            FinancialTransactionAuditLog.objects.create(
                transaction=tx1,
                action='CREATED_TRANSFER_PAIR',
                from_status='',
                to_status=initial_status,
                performed_by=staff,
                comments=f"Inter-account transfer initiated to {dest_account.account_code} (Paired with {tx2.transaction_number})"
            )
            FinancialTransactionAuditLog.objects.create(
                transaction=tx2,
                action='CREATED_TRANSFER_PAIR',
                from_status='',
                to_status=initial_status,
                performed_by=staff,
                comments=f"Inter-account transfer received from {account.account_code} (Paired with {tx1.transaction_number})"
            )

            serializer = self.get_serializer(tx1)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # =====================================================================
        # 2. STANDARD DEBIT OR CREDIT TRANSACTION WORKFLOW
        # =====================================================================
        is_debit = tx_type == TransactionType.DEBIT
        debit_amt = amount if is_debit else Decimal('0.00')
        credit_amt = Decimal('0.00') if is_debit else amount

        tx_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        tx = FinancialAccountTransaction.objects.create(
            account=account,
            transaction_number=tx_number,
            transaction_date=tx_date,
            accounting_date=acct_date,
            transaction_type=tx_type,
            category=category,
            description=description,
            counterparty=counterparty,
            amount=amount,
            debit_amount=debit_amt,
            credit_amount=credit_amt,
            payment_method=payment_method,
            reference_number=ref_num,
            posting_status=initial_posting,
            lifecycle_status=initial_status,
            idempotency_key=idempotency_key,
            notes=notes,
            created_by=staff,
            submitted_by=staff if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
            submitted_at=timezone.now() if initial_status == TransactionLifecycleStatus.PENDING_APPROVAL else None,
            posted_by=staff if initial_status == TransactionLifecycleStatus.POSTED else None,
            posted_at=timezone.now() if initial_status == TransactionLifecycleStatus.POSTED else None
        )

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='CREATED',
            from_status='',
            to_status=initial_status,
            performed_by=staff,
            comments=f"Transaction created with status {initial_status}"
        )

        serializer = self.get_serializer(tx)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # =========================================================================
    # EDIT DRAFT TRANSACTION
    # =========================================================================
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        tx = self.get_object()
        if tx.lifecycle_status not in [TransactionLifecycleStatus.DRAFT, TransactionLifecycleStatus.REJECTED]:
            return Response({
                'error': f"Cannot edit transaction in '{tx.lifecycle_status}' status. Only Draft or Rejected transactions may be edited."
            }, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        staff = get_staff_profile(request.user)

        if 'description' in data:
            tx.description = data['description'].strip()
        if 'counterparty' in data:
            tx.counterparty = data['counterparty'].strip()
        if 'reference_number' in data:
            tx.reference_number = data['reference_number'].strip()
        if 'notes' in data:
            tx.notes = data['notes'].strip()
        if 'payment_method' in data:
            tx.payment_method = data['payment_method'].strip()
        if 'category' in data:
            tx.category = data['category']

        if 'amount' in data:
            try:
                new_amt = Decimal(str(data['amount']).replace(',', '').replace('₹', ''))
                if new_amt > Decimal('0.00'):
                    tx.amount = new_amt
                    if tx.transaction_type == TransactionType.DEBIT:
                        tx.debit_amount = new_amt
                        tx.credit_amount = Decimal('0.00')
                    elif tx.transaction_type == TransactionType.CREDIT:
                        tx.debit_amount = Decimal('0.00')
                        tx.credit_amount = new_amt
            except (InvalidOperation, ValueError):
                pass

        tx.save()

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='UPDATED_DRAFT',
            from_status=tx.lifecycle_status,
            to_status=tx.lifecycle_status,
            performed_by=staff,
            comments="Draft transaction details modified by preparer."
        )

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # SUBMIT FOR APPROVAL
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='submit-approval')
    @transaction.atomic
    def submit_approval(self, request, pk=None):
        tx = self.get_object()
        if tx.lifecycle_status not in [TransactionLifecycleStatus.DRAFT, TransactionLifecycleStatus.REJECTED]:
            return Response({
                'error': f"Cannot submit transaction in '{tx.lifecycle_status}' state for approval."
            }, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        old_status = tx.lifecycle_status
        tx.lifecycle_status = TransactionLifecycleStatus.PENDING_APPROVAL
        tx.submitted_by = staff
        tx.submitted_at = timezone.now()
        tx.save(update_fields=['lifecycle_status', 'submitted_by', 'submitted_at'])

        if tx.transfer_paired_transaction:
            paired = tx.transfer_paired_transaction
            paired.lifecycle_status = TransactionLifecycleStatus.PENDING_APPROVAL
            paired.submitted_by = staff
            paired.submitted_at = timezone.now()
            paired.save(update_fields=['lifecycle_status', 'submitted_by', 'submitted_at'])

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='SUBMITTED_FOR_APPROVAL',
            from_status=old_status,
            to_status=TransactionLifecycleStatus.PENDING_APPROVAL,
            performed_by=staff,
            comments=request.data.get('notes', 'Submitted for review and management authorization.')
        )

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # APPROVE TRANSACTION (SEPARATION OF DUTIES ENFORCED)
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='approve')
    @transaction.atomic
    def approve(self, request, pk=None):
        tx = self.get_object()
        if tx.lifecycle_status != TransactionLifecycleStatus.PENDING_APPROVAL:
            return Response({
                'error': f"Only transactions in 'PENDING_APPROVAL' state may be approved (Current: {tx.lifecycle_status})."
            }, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        # SEPARATION OF DUTIES ENFORCEMENT:
        # The preparer / creator cannot approve their own transaction.
        preparer_id = tx.created_by_id or (tx.submitted_by_id if tx.submitted_by else None)
        if staff and preparer_id and staff.id == preparer_id and not request.user.is_superuser:
            return Response({
                'error': 'Separation of duties violation: The staff member who created or submitted the transaction cannot approve it.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Role permission verification
        user_role = staff.user_profile.role.name if staff and staff.user_profile and staff.user_profile.role else None
        authorized_roles = [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.FINANCE_MANAGER, RoleEnum.ACCOUNTANT]
        if user_role not in authorized_roles and not request.user.is_superuser:
            return Response({
                'error': 'Unauthorized: Your role does not possess financial transaction approval authority.'
            }, status=status.HTTP_403_FORBIDDEN)

        comments = request.data.get('comments', 'Approved by authorized financial reviewer.')
        auto_post = request.data.get('auto_post', True)

        now = timezone.now()
        tx.approved_by = staff
        tx.approved_at = now

        if auto_post:
            tx.lifecycle_status = TransactionLifecycleStatus.POSTED
            tx.posting_status = 'POSTED'
            tx.posted_by = staff
            tx.posted_at = now
        else:
            tx.lifecycle_status = TransactionLifecycleStatus.APPROVED

        tx.save()

        # Handle paired transfer leg
        if tx.transfer_paired_transaction:
            paired = tx.transfer_paired_transaction
            paired.approved_by = staff
            paired.approved_at = now
            if auto_post:
                paired.lifecycle_status = TransactionLifecycleStatus.POSTED
                paired.posting_status = 'POSTED'
                paired.posted_by = staff
                paired.posted_at = now
            else:
                paired.lifecycle_status = TransactionLifecycleStatus.APPROVED
            paired.save()

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='APPROVED_AND_POSTED' if auto_post else 'APPROVED',
            from_status=TransactionLifecycleStatus.PENDING_APPROVAL,
            to_status=tx.lifecycle_status,
            performed_by=staff,
            comments=comments
        )

        if auto_post:
            _sync_tx_to_gl(tx, staff)

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # REJECT TRANSACTION
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='reject')
    @transaction.atomic
    def reject(self, request, pk=None):
        tx = self.get_object()
        if tx.lifecycle_status != TransactionLifecycleStatus.PENDING_APPROVAL:
            return Response({
                'error': f"Only transactions in 'PENDING_APPROVAL' state may be rejected (Current: {tx.lifecycle_status})."
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        old_status = tx.lifecycle_status

        tx.lifecycle_status = TransactionLifecycleStatus.REJECTED
        tx.rejection_reason = reason
        tx.rejected_by = staff
        tx.rejected_at = timezone.now()
        tx.save(update_fields=['lifecycle_status', 'rejection_reason', 'rejected_by', 'rejected_at'])

        if tx.transfer_paired_transaction:
            paired = tx.transfer_paired_transaction
            paired.lifecycle_status = TransactionLifecycleStatus.REJECTED
            paired.rejection_reason = reason
            paired.rejected_by = staff
            paired.rejected_at = timezone.now()
            paired.save(update_fields=['lifecycle_status', 'rejection_reason', 'rejected_by', 'rejected_at'])

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='REJECTED',
            from_status=old_status,
            to_status=TransactionLifecycleStatus.REJECTED,
            performed_by=staff,
            comments=f"Rejected by reviewer. Reason: {reason}"
        )

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # POST APPROVED TRANSACTION
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='post')
    @transaction.atomic
    def post_transaction(self, request, pk=None):
        tx = self.get_object()
        if tx.lifecycle_status != TransactionLifecycleStatus.APPROVED:
            return Response({
                'error': f"Only transactions in 'APPROVED' status may be posted (Current: {tx.lifecycle_status})."
            }, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        now = timezone.now()

        tx.lifecycle_status = TransactionLifecycleStatus.POSTED
        tx.posting_status = 'POSTED'
        tx.posted_by = staff
        tx.posted_at = now
        tx.save(update_fields=['lifecycle_status', 'posting_status', 'posted_by', 'posted_at'])

        if tx.transfer_paired_transaction:
            paired = tx.transfer_paired_transaction
            paired.lifecycle_status = TransactionLifecycleStatus.POSTED
            paired.posting_status = 'POSTED'
            paired.posted_by = staff
            paired.posted_at = now
            paired.save(update_fields=['lifecycle_status', 'posting_status', 'posted_by', 'posted_at'])

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='POSTED_TO_LEDGER',
            from_status=TransactionLifecycleStatus.APPROVED,
            to_status=TransactionLifecycleStatus.POSTED,
            performed_by=staff,
            comments="Formally posted to financial account and general ledger."
        )

        _sync_tx_to_gl(tx, staff)

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # REVERSE POSTED TRANSACTION
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='reverse')
    @transaction.atomic
    def reverse(self, request, pk=None):
        original = self.get_object()
        if original.lifecycle_status != TransactionLifecycleStatus.POSTED:
            return Response({
                'error': f"Only 'POSTED' transactions may be reversed (Current: {original.lifecycle_status})."
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'Reversal reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        now = timezone.now()

        # Mark original as REVERSED in lifecycle (keep posting_status='POSTED' so ledger history retains Dr/Cr cancellation)
        original.lifecycle_status = TransactionLifecycleStatus.REVERSED
        original.reversed_by = staff
        original.reversed_at = now
        original.reversal_reason = reason
        original.save(update_fields=['lifecycle_status', 'reversed_by', 'reversed_at', 'reversal_reason'])

        # Create offsetting reversal transaction: flip debits and credits
        rev_number = f"REV-{original.transaction_number}"
        rev_tx = FinancialAccountTransaction.objects.create(
            account=original.account,
            transaction_number=rev_number,
            transaction_date=timezone.localdate(),
            accounting_date=timezone.localdate(),
            transaction_type=TransactionType.CREDIT if original.transaction_type == TransactionType.DEBIT else TransactionType.DEBIT,
            category=FinancialTransactionCategory.PATIENT_REFUND_REVERSAL if original.category in [
                FinancialTransactionCategory.PATIENT_RECEIPT_ADVANCE, FinancialTransactionCategory.OPD_IPD_COLLECTION
            ] else original.category,
            description=f"Reversal of {original.transaction_number}: {reason}",
            counterparty=original.counterparty,
            amount=original.amount,
            debit_amount=original.credit_amount,   # Flipped
            credit_amount=original.debit_amount,   # Flipped
            payment_method=original.payment_method,
            reference_number=f"REV-{original.reference_number or original.transaction_number}",
            posting_status='POSTED',
            lifecycle_status=TransactionLifecycleStatus.POSTED,
            reversal_of=original,
            reversal_reason=reason,
            notes=f"Authorized reversal posted by {staff.user_profile.full_name if staff and staff.user_profile else 'Staff'}.",
            created_by=staff,
            posted_by=staff,
            posted_at=now
        )

        if original.journal_entry and original.journal_entry.status == 'POSTED':
            try:
                from .general_ledger_service import GeneralLedgerService
                rev_j = GeneralLedgerService.reverse_journal_voucher(original.journal_entry.id, staff, reason)
                rev_tx.journal_entry = rev_j
                rev_tx.save(update_fields=['journal_entry'])
            except Exception:
                pass

        FinancialTransactionAuditLog.objects.create(
            transaction=original,
            action='REVERSED',
            from_status=TransactionLifecycleStatus.POSTED,
            to_status=TransactionLifecycleStatus.REVERSED,
            performed_by=staff,
            comments=f"Reversed with offsetting transaction {rev_number}. Reason: {reason}"
        )
        FinancialTransactionAuditLog.objects.create(
            transaction=rev_tx,
            action='CREATED_OFFSETTING_REVERSAL',
            from_status='',
            to_status=TransactionLifecycleStatus.POSTED,
            performed_by=staff,
            comments=f"Offsetting reversal transaction created for {original.transaction_number}."
        )

        serializer = self.get_serializer(rev_tx)
        return Response({
            'message': f"Transaction {original.transaction_number} successfully reversed with offsetting entry {rev_number}.",
            'original_transaction_number': original.transaction_number,
            'reversal_transaction': serializer.data
        }, status=status.HTTP_201_CREATED)

    # =========================================================================
    # CANCEL DRAFT / PENDING TRANSACTION
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='cancel')
    @transaction.atomic
    def cancel(self, request, pk=None):
        tx = self.get_object()
        if tx.lifecycle_status not in [TransactionLifecycleStatus.DRAFT, TransactionLifecycleStatus.PENDING_APPROVAL]:
            return Response({
                'error': f"Only Draft or Pending transactions can be cancelled. Posted transactions must be reversed."
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', 'Cancelled by user.').strip()
        staff = get_staff_profile(request.user)
        old_status = tx.lifecycle_status

        tx.lifecycle_status = TransactionLifecycleStatus.CANCELLED
        tx.notes = (tx.notes + f"\nCancelled: {reason}").strip()
        tx.save(update_fields=['lifecycle_status', 'notes'])

        if tx.transfer_paired_transaction:
            paired = tx.transfer_paired_transaction
            paired.lifecycle_status = TransactionLifecycleStatus.CANCELLED
            paired.notes = (paired.notes + f"\nCancelled: {reason}").strip()
            paired.save(update_fields=['lifecycle_status', 'notes'])

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='CANCELLED',
            from_status=old_status,
            to_status=TransactionLifecycleStatus.CANCELLED,
            performed_by=staff,
            comments=reason
        )

        serializer = self.get_serializer(tx)
        return Response(serializer.data)

    # =========================================================================
    # AUDIT TRAIL
    # =========================================================================
    @action(detail=True, methods=['get'], url_path='audit-trail')
    def audit_trail(self, request, pk=None):
        tx = self.get_object()
        logs = tx.audit_logs.all().order_by('created_at')
        serializer = FinancialTransactionAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    # =========================================================================
    # UPLOAD SUPPORTING VOUCHER / DOCUMENT
    # =========================================================================
    @action(detail=True, methods=['post'], url_path='documents')
    def upload_document(self, request, pk=None):
        tx = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No document file was provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if file_obj.size > 10 * 1024 * 1024:
            return Response({'error': 'Document exceeds 10MB limit.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        title = request.data.get('title', file_obj.name).strip()
        doc_type = request.data.get('document_type', FinancialDocumentType.TRANSACTION_VOUCHER)

        doc = FinancialAccountDocument.objects.create(
            account=tx.account,
            transaction=tx,
            title=title,
            document_type=doc_type,
            file=file_obj,
            file_size=file_obj.size,
            mime_type=getattr(file_obj, 'content_type', 'application/octet-stream'),
            uploaded_by=staff
        )

        FinancialTransactionAuditLog.objects.create(
            transaction=tx,
            action='DOCUMENT_ATTACHED',
            from_status=tx.lifecycle_status,
            to_status=tx.lifecycle_status,
            performed_by=staff,
            comments=f"Supporting document '{title}' attached ({doc.get_document_type_display()})."
        )

        serializer = FinancialAccountDocumentSerializer(doc, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # =========================================================================
    # EXPORT TRANSACTIONS TO CSV
    # =========================================================================
    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        qs = self.get_queryset()[:2000]

        response = HttpResponse(content_type='text/csv')
        filename = f"financial_transactions_{timezone.localdate().strftime('%Y%m%d')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'Transaction Number', 'Date', 'Account Code', 'Account Name',
            'Type', 'Category', 'Description', 'Counterparty',
            'Debit (INR)', 'Credit (INR)', 'Amount (INR)',
            'Payment Method', 'Reference Number', 'Status', 'Created By', 'Approved By'
        ])

        for tx in qs:
            # Formula injection sanitization: prefix =, +, -, @ with single quote
            desc = tx.description
            if desc and desc.startswith(('=', '+', '-', '@')):
                desc = "'" + desc

            writer.writerow([
                tx.transaction_number,
                tx.transaction_date.strftime('%Y-%m-%d') if tx.transaction_date else '',
                tx.account.account_code if tx.account else '',
                tx.account.name if tx.account else '',
                tx.get_transaction_type_display(),
                tx.get_category_display(),
                desc,
                tx.counterparty,
                str(tx.debit_amount),
                str(tx.credit_amount),
                str(tx.amount),
                tx.payment_method,
                tx.reference_number,
                tx.get_lifecycle_status_display(),
                tx.created_by.user_profile.full_name if tx.created_by and tx.created_by.user_profile else '',
                tx.approved_by.user_profile.full_name if tx.approved_by and tx.approved_by.user_profile else ''
            ])

        return response
