import uuid
from decimal import Decimal
from django.utils import timezone
from django.db import models, transaction
from django.core.exceptions import ValidationError
from rest_framework import viewsets, views, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.models import StaffProfile, RoleEnum
from apps.billing_finance.models import (
    ChartOfAccount, AccountCategory, FiscalYear, AccountingPeriod,
    AccountingPeriodAuditLog, JournalEntry, JournalLineItem,
    JournalVoucherType, JournalStatus, JournalAuditLog, JournalDocument,
    JournalLineType
)
from apps.billing_finance.serializers import (
    ChartOfAccountSerializer, JournalEntrySerializer, JournalLineItemSerializer,
    FiscalYearSerializer, AccountingPeriodSerializer, JournalAuditLogSerializer,
    JournalDocumentSerializer
)
from apps.billing_finance.general_ledger_service import GeneralLedgerService


def get_staff_profile(user):
    """Safely retrieves staff profile for the authenticated user."""
    if hasattr(user, 'profile') and hasattr(user.profile, 'staff_profile'):
        return user.profile.staff_profile
    return StaffProfile.objects.filter(user_profile__email=user.email).first() or StaffProfile.objects.first()


class IsFinanceStaffOrAdmin:
    """Permission helper verifying accounting access."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        # Allow superusers, staff, and accountants
        profile = getattr(request.user, 'profile', None)
        if not profile:
            return request.user.is_staff or request.user.is_superuser
        allowed_roles = [RoleEnum.ACCOUNTANT, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BILLING_STAFF]
        return profile.role and profile.role.name in allowed_roles or request.user.is_staff


class ChartOfAccountViewSet(viewsets.ModelViewSet):
    """
    Hospital Chart of Accounts Master Management.
    Supports filtering by classification, account type, branch, and status.
    Provides running ledger statement export and safe deactivation controls.
    """
    serializer_class = ChartOfAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        GeneralLedgerService.ensure_standard_chart_of_accounts()
        qs = ChartOfAccount.objects.select_related('category', 'branch', 'department', 'parent_account').all()

        category_type = self.request.query_params.get('category_type')
        if category_type:
            qs = qs.filter(category__category_type=category_type.upper())

        account_type = self.request.query_params.get('account_type')
        if account_type:
            qs = qs.filter(account_type=account_type)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=(is_active.lower() == 'true'))

        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(models.Q(name__icontains=search) | models.Q(account_code__icontains=search))

        return qs.order_by('account_code')

    def create(self, request, *args, **kwargs):
        staff = get_staff_profile(request.user)
        data = request.data.copy()

        # Check unique account code
        code = data.get('account_code')
        if ChartOfAccount.objects.filter(account_code=code).exists():
            return Response({'error': f"Account code '{code}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        # Category resolution
        cat_id = data.get('category')
        if not cat_id and data.get('category_id'):
            cat_id = data.get('category_id')
        if not cat_id:
            cat_type = data.get('category_type', 'ASSET')
            cat = AccountCategory.objects.filter(category_type=cat_type).first()
            if cat:
                data['category'] = cat.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save()
        return Response(ChartOfAccountSerializer(account).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='ledger-statement')
    def ledger_statement(self, request, pk=None):
        """Retrieves real-time general ledger statement for this specific account."""
        account = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')

        try:
            report = GeneralLedgerService.get_general_ledger_register(account.id, start_date, end_date, branch_id)
            return Response(report, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Activates or deactivates an account.
        Prevents deactivation of accounts that have active posted journal entries.
        """
        account = self.get_object()
        if account.is_active:
            # Check for posted transactions
            has_posted = account.journal_lines.filter(journal_entry__status=JournalStatus.POSTED).exists()
            if has_posted:
                return Response({
                    'error': f"Cannot deactivate account '{account.account_code} - {account.name}' because it has posted general ledger transactions."
                }, status=status.HTTP_400_BAD_REQUEST)
            account.is_active = False
        else:
            account.is_active = True

        account.save(update_fields=['is_active'])
        return Response({
            'message': f"Account '{account.account_code}' status updated to {'ACTIVE' if account.is_active else 'INACTIVE'}.",
            'account': ChartOfAccountSerializer(account).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='seed-defaults')
    def seed_defaults(self, request):
        """Seeds standard hospital chart of accounts catalog."""
        branch_id = request.data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else None
        GeneralLedgerService.ensure_standard_chart_of_accounts(branch)
        return Response({'message': 'Standard hospital Chart of Accounts successfully seeded.'}, status=status.HTTP_200_OK)


class JournalEntryViewSet(viewsets.ModelViewSet):
    """
    Double-Entry Journal Voucher Register & Lifecycle Management.
    Workflows: Draft -> Pending Approval -> Approved -> Posted -> Reversed.
    Enforces Total Debits == Total Credits and accounting period restrictions.
    """
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        GeneralLedgerService.ensure_default_fiscal_year_and_periods()
        qs = JournalEntry.objects.prefetch_related(
            'lines__account__category', 'audit_logs__performed_by__user_profile', 'documents'
        ).select_related(
            'branch', 'department', 'accounting_period', 'created_by__user_profile',
            'approved_by__user_profile', 'posted_by__user_profile', 'reversed_by__user_profile',
            'reversal_of'
        )

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())

        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        voucher_type = self.request.query_params.get('voucher_type')
        if voucher_type:
            qs = qs.filter(voucher_type=voucher_type.upper())

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(entry_date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(entry_date__lte=end_date)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                models.Q(voucher_number__icontains=search) |
                models.Q(entry_number__icontains=search) |
                models.Q(narration__icontains=search) |
                models.Q(reference_number__icontains=search)
            )

        return qs.order_by('-entry_date', '-created_at')

    def create(self, request, *args, **kwargs):
        staff = get_staff_profile(request.user)
        try:
            journal = GeneralLedgerService.create_journal_voucher(request.data, staff)
            return Response(JournalEntrySerializer(journal).data, status=status.HTTP_201_CREATED)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='submit-approval')
    def submit_approval(self, request, pk=None):
        """Transitions voucher from DRAFT to PENDING_APPROVAL."""
        journal = self.get_object()
        if journal.status != JournalStatus.DRAFT:
            return Response({'error': f"Only DRAFT vouchers can be submitted for approval (Current: {journal.status})."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        journal.status = JournalStatus.PENDING_APPROVAL
        journal.submitted_by = staff
        journal.submitted_at = timezone.now()
        journal.save(update_fields=['status', 'submitted_by', 'submitted_at'])

        JournalAuditLog.objects.create(
            journal_entry=journal,
            action='SUBMITTED',
            from_status=JournalStatus.DRAFT,
            to_status=JournalStatus.PENDING_APPROVAL,
            performed_by=staff,
            comments="Submitted voucher for independent accounting approval."
        )
        return Response(JournalEntrySerializer(journal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approves a voucher pending approval.
        Enforces separation of duties: Creator cannot approve their own voucher
        unless user is an explicit Hospital Administrator.
        """
        journal = self.get_object()
        if journal.status != JournalStatus.PENDING_APPROVAL:
            return Response({'error': f"Only vouchers in 'PENDING_APPROVAL' can be approved (Current: {journal.status})."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        user_role = getattr(request.user.profile.role, 'name', '') if hasattr(request.user, 'profile') and request.user.profile.role else ''

        # Separation of duties check
        if journal.created_by and staff and journal.created_by.id == staff.id:
            if user_role != RoleEnum.HOSPITAL_ADMIN and not request.user.is_superuser:
                return Response({
                    'error': "Separation of Duties Violation: You cannot approve a journal voucher you created. Independent authorization is required."
                }, status=status.HTTP_403_FORBIDDEN)

        auto_post = request.data.get('auto_post', False)
        journal.status = JournalStatus.APPROVED
        journal.approved_by = staff
        journal.approved_at = timezone.now()
        journal.save(update_fields=['status', 'approved_by', 'approved_at'])

        JournalAuditLog.objects.create(
            journal_entry=journal,
            action='APPROVED',
            from_status=JournalStatus.PENDING_APPROVAL,
            to_status=JournalStatus.APPROVED,
            performed_by=staff,
            comments=request.data.get('comments', 'Voucher approved by authorized finance officer.')
        )

        if auto_post:
            try:
                journal = GeneralLedgerService.post_journal_voucher(journal.id, staff)
            except Exception as e:
                return Response({'error': f"Approved, but auto-post failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(JournalEntrySerializer(journal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """Rejects a voucher with a mandatory reason."""
        journal = self.get_object()
        if journal.status != JournalStatus.PENDING_APPROVAL:
            return Response({'error': f"Only vouchers in 'PENDING_APPROVAL' can be rejected (Current: {journal.status})."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'A rejection reason is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        journal.status = JournalStatus.REJECTED
        journal.rejected_by = staff
        journal.rejected_at = timezone.now()
        journal.rejection_reason = reason
        journal.save(update_fields=['status', 'rejected_by', 'rejected_at', 'rejection_reason'])

        JournalAuditLog.objects.create(
            journal_entry=journal,
            action='REJECTED',
            from_status=JournalStatus.PENDING_APPROVAL,
            to_status=JournalStatus.REJECTED,
            performed_by=staff,
            comments=f"Voucher rejected: {reason}"
        )
        return Response(JournalEntrySerializer(journal).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='post')
    def post_voucher(self, request, pk=None):
        """Posts an approved voucher to the General Ledger."""
        staff = get_staff_profile(request.user)
        try:
            journal = GeneralLedgerService.post_journal_voucher(pk, staff)
            return Response(JournalEntrySerializer(journal).data, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='reverse')
    def reverse(self, request, pk=None):
        """Posts an authorized reversal entry for a posted voucher."""
        staff = get_staff_profile(request.user)
        reason = request.data.get('reason', 'Authorized accounting correction').strip()
        try:
            reversal = GeneralLedgerService.reverse_journal_voucher(pk, staff, reason)
            return Response({
                'message': 'Voucher reversed successfully.',
                'reversal_voucher': JournalEntrySerializer(reversal).data
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({'error': str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='documents')
    def add_document(self, request, pk=None):
        """Uploads supporting documentation for a journal voucher."""
        journal = self.get_object()
        staff = get_staff_profile(request.user)
        doc = JournalDocument.objects.create(
            journal_entry=journal,
            document_type=request.data.get('document_type', 'VOUCHER_ATTACHMENT'),
            file_name=request.data.get('file_name', 'attachment.pdf'),
            file_url=request.data.get('file_url', ''),
            file_size_bytes=int(request.data.get('file_size_bytes', 0)),
            mime_type=request.data.get('mime_type', 'application/pdf'),
            uploaded_by=staff
        )
        return Response(JournalDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class FiscalYearViewSet(viewsets.ReadOnlyModelViewSet):
    """Configured Hospital Financial Years."""
    serializer_class = FiscalYearSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        GeneralLedgerService.ensure_default_fiscal_year_and_periods()
        return FiscalYear.objects.prefetch_related('periods').all().order_by('-start_date')


class AccountingPeriodViewSet(viewsets.ModelViewSet):
    """
    Accounting Period Management and Period Closing Controls.
    Prevents unauthorized postings to closed periods and logs closing/reopening audits.
    """
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        GeneralLedgerService.ensure_default_fiscal_year_and_periods()
        return AccountingPeriod.objects.select_related('fiscal_year', 'closed_by__user_profile', 'reopened_by__user_profile').all().order_by('start_date')

    @action(detail=True, methods=['post'], url_path='close-period')
    def close_period(self, request, pk=None):
        """Closes an accounting period to prevent further postings."""
        period = self.get_object()
        if period.is_closed:
            return Response({'error': f"Period '{period.period_name}' is already closed."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        period.is_closed = True
        period.closed_at = timezone.now()
        period.closed_by = staff
        period.save(update_fields=['is_closed', 'closed_at', 'closed_by'])

        AccountingPeriodAuditLog.objects.create(
            period=period,
            action='CLOSED',
            performed_by=staff,
            comments=request.data.get('comments', 'Period closed during monthly financial closing.')
        )
        return Response({
            'message': f"Accounting period '{period.period_name}' successfully closed.",
            'period': AccountingPeriodSerializer(period).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reopen-period')
    def reopen_period(self, request, pk=None):
        """Reopens a closed accounting period with an audit reason."""
        period = self.get_object()
        if not period.is_closed:
            return Response({'error': f"Period '{period.period_name}' is already open."}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'error': 'A justification reason is required to reopen an accounting period.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        period.is_closed = False
        period.reopened_at = timezone.now()
        period.reopened_by = staff
        period.reopen_reason = reason
        period.save(update_fields=['is_closed', 'reopened_at', 'reopened_by', 'reopen_reason'])

        AccountingPeriodAuditLog.objects.create(
            period=period,
            action='REOPENED',
            performed_by=staff,
            comments=f"Period reopened: {reason}"
        )
        return Response({
            'message': f"Accounting period '{period.period_name}' reopened.",
            'period': AccountingPeriodSerializer(period).data
        }, status=status.HTTP_200_OK)


# =============================================================================
# FINANCIAL REPORT APIS
# =============================================================================

class GeneralLedgerRegisterView(views.APIView):
    """Running General Ledger statement for any Chart of Account."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account_id = request.query_params.get('account_id')
        if not account_id:
            return Response({'error': 'account_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')

        try:
            report = GeneralLedgerService.get_general_ledger_register(account_id, start_date, end_date, branch_id)
            return Response(report, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TrialBalanceView(views.APIView):
    """Trial Balance verifying hospital-wide Debit == Credit equality."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        as_of_date = request.query_params.get('as_of_date')
        branch_id = request.query_params.get('branch_id')
        try:
            tb = GeneralLedgerService.get_trial_balance(as_of_date, branch_id)
            return Response(tb, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class BalanceSheetView(views.APIView):
    """Balance Sheet: Assets = Liabilities + Equity."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        as_of_date = request.query_params.get('as_of_date')
        branch_id = request.query_params.get('branch_id')
        try:
            bs = GeneralLedgerService.get_balance_sheet(as_of_date, branch_id)
            return Response(bs, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProfitLossView(views.APIView):
    """Profit and Loss: Revenues, Expenses, Net Surplus/Margin."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        try:
            pnl = GeneralLedgerService.get_profit_and_loss(start_date, end_date, branch_id)
            return Response(pnl, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CashFlowView(views.APIView):
    """Cash Flow Statement: Operating, Investing, and Financing activities."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        try:
            cf = GeneralLedgerService.get_cash_flow_statement(start_date, end_date, branch_id)
            return Response(cf, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CashBankBookView(views.APIView):
    """Cash Book and Bank Book records from posted General Ledger lines."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        account_id = request.query_params.get('account_id')
        book_type = request.query_params.get('book_type', 'ALL')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')

        try:
            books = GeneralLedgerService.get_cash_and_bank_books(account_id, book_type, start_date, end_date, branch_id)
            return Response(books, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReceivablesPayablesLedgerView(views.APIView):
    """Accounts Receivable and Accounts Payable ledger summaries and ageing analysis."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('report_type', 'ALL')
        as_of_date = request.query_params.get('as_of_date')
        branch_id = request.query_params.get('branch_id')

        try:
            summary = GeneralLedgerService.get_ar_and_ap_summary(report_type, as_of_date, branch_id)
            return Response(summary, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AutoPostModuleView(views.APIView):
    """API endpoint to trigger or test automatic module posting to the General Ledger."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        staff = get_staff_profile(request.user)
        event_type = request.data.get('event_type')
        payload = request.data.get('payload', {})
        if not event_type:
            return Response({'error': 'event_type is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            journal = GeneralLedgerService.auto_post_module_event(event_type, payload, staff)
            if not journal:
                return Response({'message': 'No journal entry generated (zero amount or unhandled event).'}, status=status.HTTP_200_OK)
            return Response({
                'message': f"Successfully posted {event_type} to General Ledger.",
                'journal': JournalEntrySerializer(journal).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
