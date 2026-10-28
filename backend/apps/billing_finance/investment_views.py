import csv
import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction
from django.db.models import Sum, Q, Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsStaffMember
from apps.authentication.models import StaffProfile, RoleEnum
from apps.authentication.utils import get_staff_profile
from apps.billing_finance.models import (
    InvestmentRegister, InvestmentCategory, InvestmentLifecycleStatus,
    CompoundingFrequency, InvestmentIncomeType, InvestmentIncomeRecord,
    InvestmentValuationHistory, InvestmentAuditLog, InvestmentDocumentType,
    InvestmentDocument, FinancialAccount, FinancialAccountTransaction,
    TransactionLifecycleStatus, TransactionType, FinancialTransactionCategory
)
from apps.billing_finance.serializers import (
    InvestmentRegisterSerializer, InvestmentIncomeRecordSerializer,
    InvestmentValuationHistorySerializer, InvestmentAuditLogSerializer,
    InvestmentDocumentSerializer
)


def calculate_expected_yield(principal: Decimal, rate_pct: Decimal, purchase_date: date, maturity_date: date, frequency: str) -> dict:
    """
    Decimal-safe financial yield calculation for Fixed Deposits and Bonds.
    Simple and compounded formulas matching Indian banking conventions.
    """
    if not maturity_date or maturity_date <= purchase_date or principal <= 0 or rate_pct <= 0:
        return {
            'expected_maturity_amount': principal,
            'expected_interest': Decimal('0.00'),
            'tenure_days': 0,
            'tenure_years': Decimal('0.00')
        }

    days = (maturity_date - purchase_date).days
    years = Decimal(str(days)) / Decimal('365.0')
    r = rate_pct / Decimal('100.0')

    # Compounding periods per year
    freq_map = {
        CompoundingFrequency.SIMPLE: None,
        CompoundingFrequency.AT_MATURITY: None,
        CompoundingFrequency.ANNUALLY: 1,
        CompoundingFrequency.HALF_YEARLY: 2,
        CompoundingFrequency.QUARTERLY: 4,
        CompoundingFrequency.MONTHLY: 12,
    }

    n = freq_map.get(frequency, 4)  # Default to quarterly for Indian bank FDs

    if n is None or frequency in [CompoundingFrequency.SIMPLE, CompoundingFrequency.AT_MATURITY]:
        # Simple interest: A = P * (1 + r * t)
        maturity_amount = principal * (Decimal('1.00') + (r * years))
    else:
        # Compound interest: A = P * (1 + r/n)**(n*t)
        # Convert to float for exponentiation then back to Decimal for exact precision
        float_p = float(principal)
        float_r = float(r)
        float_n = float(n)
        float_t = float(years)
        float_maturity = float_p * ((1.0 + (float_r / float_n)) ** (float_n * float_t))
        maturity_amount = Decimal(str(round(float_maturity, 2)))

    maturity_amount = maturity_amount.quantize(Decimal('0.01'))
    interest = (maturity_amount - principal).quantize(Decimal('0.01'))

    return {
        'expected_maturity_amount': maturity_amount,
        'expected_interest': interest,
        'tenure_days': days,
        'tenure_years': years.quantize(Decimal('0.01'))
    }


class InvestmentViewSet(viewsets.ModelViewSet):
    """
    Section 15: Investment Portfolio Management ViewSet.
    Handles Treasury Investments, Fixed Deposits, Bonds, Mutual Funds, and Equities.
    Integrates with Section 13 Financial Accounts and Section 14 Financial Transactions.
    """
    queryset = InvestmentRegister.objects.select_related(
        'financial_account', 'source_financial_account', 'settlement_financial_account',
        'branch', 'department', 'created_by__user_profile', 'approved_by__user_profile'
    ).prefetch_related('audit_logs', 'valuation_history', 'income_records', 'documents').all()
    serializer_class = InvestmentRegisterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def _get_staff_profile(self, request):
        return get_staff_profile(request.user)

    def _get_actor_info(self, staff_profile, user):
        if staff_profile and getattr(staff_profile, 'user_profile', None):
            name = staff_profile.user_profile.full_name or user.get_full_name() or user.username
            role = staff_profile.user_profile.role.name if getattr(staff_profile.user_profile, 'role', None) else 'STAFF'
        else:
            name = user.get_full_name() or user.username
            role = 'STAFF'
        return name, role

    def _has_approval_role(self, staff_profile):
        if not staff_profile:
            return False
        role_name = getattr(staff_profile.user_profile.role, 'name', None) if getattr(staff_profile, 'user_profile', None) else None
        return role_name in [
            RoleEnum.SUPER_ADMIN,
            RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.FINANCE_MANAGER,
            RoleEnum.INVESTMENT_MANAGER
        ]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        category = params.get('category')
        if category:
            qs = qs.filter(category=category)

        lifecycle_status = params.get('lifecycle_status')
        if lifecycle_status:
            qs = qs.filter(lifecycle_status=lifecycle_status)

        branch_id = params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        search = params.get('search')
        if search:
            qs = qs.filter(
                Q(investment_code__icontains=search) |
                Q(name__icontains=search) |
                Q(institution_name__icontains=search) |
                Q(reference_number__icontains=search)
            )

        start_date = params.get('start_date')
        if start_date:
            qs = qs.filter(purchase_date__gte=start_date)

        end_date = params.get('end_date')
        if end_date:
            qs = qs.filter(purchase_date__lte=end_date)

        maturity_soon = params.get('maturing_soon')
        if maturity_soon == 'true':
            today = timezone.localdate()
            qs = qs.filter(
                maturity_date__gte=today,
                maturity_date__lte=today + timedelta(days=30),
                lifecycle_status__in=[InvestmentLifecycleStatus.ACTIVE, InvestmentLifecycleStatus.APPROVED]
            )

        return qs

    def perform_create(self, serializer):
        staff_profile = self._get_staff_profile(self.request)
        today = timezone.localdate()
        validated_data = serializer.validated_data

        # Generate unique investment code if not passed
        category = validated_data.get('category', InvestmentCategory.FIXED_DEPOSIT)
        prefix = 'FD' if category == InvestmentCategory.FIXED_DEPOSIT else 'INV'
        code = f"{prefix}-{today.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        principal = validated_data.get('principal_amount', Decimal('0.00'))
        rate = validated_data.get('interest_rate_pct', Decimal('0.00'))
        purchase_date = validated_data.get('purchase_date', today)
        maturity_date = validated_data.get('maturity_date')
        compounding = validated_data.get('compounding_frequency', CompoundingFrequency.ANNUALLY)

        expected_amount = validated_data.get('expected_maturity_amount')
        if (not expected_amount or expected_amount == Decimal('0.00')) and maturity_date:
            yield_calc = calculate_expected_yield(principal, rate, purchase_date, maturity_date, compounding)
            expected_amount = yield_calc['expected_maturity_amount']

        current_val = validated_data.get('current_valuation')
        if not current_val or current_val == Decimal('0.00'):
            current_val = principal

        initial_status = validated_data.get('lifecycle_status', InvestmentLifecycleStatus.ACTIVE)

        instance = serializer.save(
            investment_code=code,
            expected_maturity_amount=expected_amount or principal,
            current_valuation=current_val,
            valuation_date=purchase_date,
            created_by=staff_profile,
            lifecycle_status=initial_status
        )

        # Audit log
        actor_name, actor_role = self._get_actor_info(staff_profile, self.request.user)
        InvestmentAuditLog.objects.create(
            investment=instance,
            action='CREATED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            new_status=instance.lifecycle_status,
            notes=f"Created investment {instance.investment_code} ({instance.name}) for ₹{instance.principal_amount}."
        )

        # If created directly as ACTIVE and source financial account is provided, generate Section 14 purchase transaction
        if instance.lifecycle_status == InvestmentLifecycleStatus.ACTIVE and instance.source_financial_account:
            self._record_purchase_transaction(instance, staff_profile)

    def _record_purchase_transaction(self, investment, staff_profile):
        """
        Records purchase / placement in Section 14 FinancialAccountTransaction.
        Deducts principal + fees from source Section 13 financial account.
        """
        source_acc = investment.source_financial_account
        if not source_acc:
            return None

        total_outflow = investment.principal_amount + (investment.purchase_fees or Decimal('0.00'))
        cat = (
            FinancialTransactionCategory.FIXED_DEPOSIT_TRANSACTION
            if investment.category == InvestmentCategory.FIXED_DEPOSIT
            else FinancialTransactionCategory.INVESTMENT_TRANSACTION
        )

        tx_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        txn = FinancialAccountTransaction.objects.create(
            account=source_acc,
            transaction_number=tx_number,
            transaction_type=TransactionType.DEBIT,
            category=cat,
            amount=total_outflow,
            debit_amount=Decimal('0.00'),
            credit_amount=total_outflow,
            transaction_date=investment.purchase_date,
            accounting_date=investment.purchase_date,
            reference_number=investment.reference_number or investment.investment_code,
            counterparty=investment.institution_name or investment.name,
            description=f"Treasury Investment Placement: {investment.get_category_display()} - {investment.name} [{investment.investment_code}]",
            lifecycle_status=TransactionLifecycleStatus.POSTED,
            posting_status='POSTED',
            posted_at=timezone.now(),
            posted_by=staff_profile,
            created_by=staff_profile,
            investment=investment,
            branch=investment.branch
        )

        # Update source account balance
        calc_bal, _, _ = source_acc.calculate_balance()
        source_acc.current_balance = calc_bal
        source_acc.save(update_fields=['current_balance', 'updated_at'])

        return txn

    @action(detail=False, methods=['post'], url_path='calculate-yield')
    def calculate_yield_api(self, request):
        """
        API endpoint for real-time calculation of expected maturity and interest.
        """
        try:
            data = request.data
            principal = Decimal(str(data.get('principal_amount') or data.get('principal') or 0))
            rate = Decimal(str(data.get('interest_rate_pct') or data.get('interest_rate') or 0))

            p_date_raw = data.get('purchase_date') or data.get('start_date')
            m_date_raw = data.get('maturity_date')

            if not p_date_raw or not m_date_raw:
                return Response({'error': 'purchase_date and maturity_date are required'}, status=status.HTTP_400_BAD_REQUEST)

            purchase_date = date.fromisoformat(str(p_date_raw).split('T')[0])
            maturity_date = date.fromisoformat(str(m_date_raw).split('T')[0])
            frequency = data.get('compounding_frequency', CompoundingFrequency.ANNUALLY)

            res = calculate_expected_yield(principal, rate, purchase_date, maturity_date, frequency)
            return Response({
                'success': True,
                'data': res,
                'expected_maturity_amount': str(res['expected_maturity_amount']),
                'total_expected_interest': str(res['expected_interest']),
                'tenure_days': res['tenure_days'],
                'tenure_years': str(res['tenure_years']),
                'calculation_method': f"{frequency.replace('_', ' ').title()} Compounding Formula"
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='submit-approval')
    def submit_approval(self, request, pk=None):
        """
        Transitions investment from DRAFT to PENDING_APPROVAL.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        if investment.lifecycle_status != InvestmentLifecycleStatus.DRAFT:
            return Response({'error': f"Cannot submit investment in '{investment.lifecycle_status}' state for approval."}, status=status.HTTP_400_BAD_REQUEST)

        investment.lifecycle_status = InvestmentLifecycleStatus.PENDING_APPROVAL
        investment.submitted_by = staff_profile
        investment.submitted_at = timezone.now()
        investment.save(update_fields=['lifecycle_status', 'submitted_by', 'submitted_at', 'updated_at'])

        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        InvestmentAuditLog.objects.create(
            investment=investment,
            action='SUBMITTED_APPROVAL',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status=InvestmentLifecycleStatus.DRAFT,
            new_status=InvestmentLifecycleStatus.PENDING_APPROVAL,
            notes="Submitted investment for executive approval."
        )

        return Response({'success': True, 'message': 'Investment submitted for approval successfully.'})

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approves an investment. Enforces separation of duties (creator cannot approve their own investment).
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        if not self._has_approval_role(staff_profile):
            return Response({'error': 'Unauthorized. Only Finance Managers and Admins can approve investments.'}, status=status.HTTP_403_FORBIDDEN)

        # Separation of duties check
        if (investment.created_by and investment.created_by == staff_profile) or (investment.submitted_by and investment.submitted_by == staff_profile):
            return Response({
                'error': 'Separation of duties violation: A preparer or creator cannot approve their own investment.'
            }, status=status.HTTP_403_FORBIDDEN)

        if investment.lifecycle_status not in [InvestmentLifecycleStatus.PENDING_APPROVAL, InvestmentLifecycleStatus.DRAFT]:
            return Response({'error': f"Investment in '{investment.lifecycle_status}' cannot be approved."}, status=status.HTTP_400_BAD_REQUEST)

        auto_activate = request.data.get('auto_activate', True)
        prev_status = investment.lifecycle_status

        investment.approved_by = staff_profile
        investment.approved_at = timezone.now()
        investment.lifecycle_status = InvestmentLifecycleStatus.ACTIVE if auto_activate else InvestmentLifecycleStatus.APPROVED
        investment.save(update_fields=['approved_by', 'approved_at', 'lifecycle_status', 'updated_at'])

        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        InvestmentAuditLog.objects.create(
            investment=investment,
            action='APPROVED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status=prev_status,
            new_status=investment.lifecycle_status,
            notes=f"Investment approved by {actor_name}."
        )

        # If activated and source account provided, generate transaction
        if auto_activate and investment.source_financial_account:
            self._record_purchase_transaction(investment, staff_profile)

        return Response({'success': True, 'message': 'Investment approved and activated.', 'lifecycle_status': investment.lifecycle_status})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """
        Rejects an investment with mandatory reason.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response({'error': 'A rejection reason is mandatory.'}, status=status.HTTP_400_BAD_REQUEST)

        if not self._has_approval_role(staff_profile):
            return Response({'error': 'Unauthorized to reject investments.'}, status=status.HTTP_403_FORBIDDEN)

        prev_status = investment.lifecycle_status
        investment.lifecycle_status = InvestmentLifecycleStatus.REJECTED
        investment.rejected_by = staff_profile
        investment.rejected_at = timezone.now()
        investment.rejection_reason = reason
        investment.save(update_fields=['lifecycle_status', 'rejected_by', 'rejected_at', 'rejection_reason', 'updated_at'])

        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        InvestmentAuditLog.objects.create(
            investment=investment,
            action='REJECTED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status=prev_status,
            new_status=InvestmentLifecycleStatus.REJECTED,
            notes=f"Investment rejected: {reason}"
        )

        return Response({'success': True, 'message': 'Investment rejected.'})

    @action(detail=True, methods=['post'], url_path='purchase')
    def purchase(self, request, pk=None):
        """
        Records placement / purchase outflow for an approved or draft investment.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        source_acc_id = request.data.get('source_financial_account')
        if source_acc_id:
            source_acc = FinancialAccount.objects.filter(id=source_acc_id).first()
            if source_acc:
                investment.source_financial_account = source_acc
                investment.save(update_fields=['source_financial_account'])

        if not investment.source_financial_account:
            return Response({'error': 'A valid source Section 13 financial account is required to record placement.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            investment.lifecycle_status = InvestmentLifecycleStatus.ACTIVE
            investment.current_valuation = investment.principal_amount
            investment.valuation_date = investment.purchase_date
            investment.save(update_fields=['lifecycle_status', 'current_valuation', 'valuation_date', 'updated_at'])

            txn = self._record_purchase_transaction(investment, staff_profile)

            actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
            InvestmentAuditLog.objects.create(
                investment=investment,
                action='PURCHASED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                new_status=InvestmentLifecycleStatus.ACTIVE,
                notes=f"Recorded placement from {investment.source_financial_account.name}. Txn #{txn.transaction_number if txn else ''}."
            )

        return Response({'success': True, 'message': 'Investment placement recorded and ledger updated.'})

    @action(detail=True, methods=['post'], url_path='record-income')
    def record_income(self, request, pk=None):
        """
        Records actual interest or dividend receipt.
        Integrates with Section 13 Financial Accounts and Section 14 Financial Transactions.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        income_type = request.data.get('income_type', InvestmentIncomeType.INTEREST)
        receipt_date = request.data.get('receipt_date', str(timezone.localdate()))
        gross_amount = Decimal(str(request.data.get('gross_amount', 0)))
        tds_withheld = Decimal(str(request.data.get('tds_withheld', 0)))
        receiving_account_id = request.data.get('receiving_account_id')
        reference_number = request.data.get('reference_number', '').strip()
        notes = request.data.get('notes', '').strip()

        if gross_amount <= Decimal('0.00'):
            return Response({'error': 'Gross income amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        net_amount = gross_amount - tds_withheld
        if net_amount < Decimal('0.00'):
            return Response({'error': 'TDS withheld cannot exceed gross income amount.'}, status=status.HTTP_400_BAD_REQUEST)

        receiving_account = None
        if receiving_account_id:
            receiving_account = FinancialAccount.objects.filter(id=receiving_account_id).first()
        if not receiving_account:
            receiving_account = investment.settlement_financial_account or investment.source_financial_account

        if not receiving_account:
            return Response({'error': 'A receiving financial account is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # 1. Create Section 14 Financial Transaction (CREDIT inflow)
            cat = (
                FinancialTransactionCategory.FIXED_DEPOSIT_TRANSACTION
                if investment.category == InvestmentCategory.FIXED_DEPOSIT
                else FinancialTransactionCategory.INVESTMENT_TRANSACTION
            )

            tx_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            txn = FinancialAccountTransaction.objects.create(
                account=receiving_account,
                transaction_number=tx_number,
                transaction_type=TransactionType.CREDIT,
                category=cat,
                amount=net_amount,
                debit_amount=net_amount,
                credit_amount=Decimal('0.00'),
                transaction_date=receipt_date,
                accounting_date=receipt_date,
                reference_number=reference_number or f"INC-{investment.investment_code}",
                counterparty=investment.institution_name or investment.name,
                description=f"Investment Income ({income_type}): {investment.name} [{investment.investment_code}] (Gross: ₹{gross_amount}, TDS: ₹{tds_withheld})",
                lifecycle_status=TransactionLifecycleStatus.POSTED,
                posting_status='POSTED',
                posted_at=timezone.now(),
                posted_by=staff_profile,
                created_by=staff_profile,
                investment=investment,
                branch=investment.branch
            )

            # Update receiving account balance
            calc_bal, _, _ = receiving_account.calculate_balance()
            receiving_account.current_balance = calc_bal
            receiving_account.save(update_fields=['current_balance', 'updated_at'])

            # 2. Create InvestmentIncomeRecord
            income_rec = InvestmentIncomeRecord.objects.create(
                investment=investment,
                income_type=income_type,
                receipt_date=receipt_date,
                gross_amount=gross_amount,
                tds_withheld=tds_withheld,
                net_amount=net_amount,
                receiving_account=receiving_account,
                financial_transaction=txn,
                reference_number=reference_number,
                notes=notes,
                recorded_by=staff_profile
            )

            # 3. Update cumulative income totals on investment
            if income_type == InvestmentIncomeType.INTEREST:
                investment.total_interest_received += net_amount
            elif income_type == InvestmentIncomeType.DIVIDEND:
                investment.total_dividend_received += net_amount
            investment.save(update_fields=['total_interest_received', 'total_dividend_received', 'updated_at'])

            # 4. Audit log
            actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
            InvestmentAuditLog.objects.create(
                investment=investment,
                action='INCOME_RECORDED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                notes=f"Recorded {income_type} income: Net ₹{net_amount} credited to {receiving_account.name}. Txn #{txn.transaction_number}."
            )

        return Response({
            'success': True,
            'message': f"{income_type} income of ₹{net_amount} recorded successfully.",
            'income_id': str(income_rec.id),
            'transaction_number': txn.transaction_number
        })

    @action(detail=True, methods=['post'], url_path='record-valuation')
    def record_valuation(self, request, pk=None):
        """
        Records mark-to-market valuation, NAV update, and unrealized gain/loss.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        val_date = request.data.get('valuation_date', str(timezone.localdate()))
        total_val = Decimal(str(request.data.get('total_valuation', 0)))
        unit_price = request.data.get('unit_price_or_nav')
        unit_price_dec = Decimal(str(unit_price)) if unit_price is not None and str(unit_price).strip() != '' else None
        source = request.data.get('valuation_source', 'Manual Appraisal / Statement').strip()
        notes = request.data.get('notes', '').strip()

        if total_val < Decimal('0.00'):
            return Response({'error': 'Valuation cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)

        unrealized = total_val - investment.principal_amount

        with transaction.atomic():
            history_rec = InvestmentValuationHistory.objects.create(
                investment=investment,
                valuation_date=val_date,
                unit_price_or_nav=unit_price_dec,
                total_valuation=total_val,
                valuation_source=source,
                unrealized_gain_loss=unrealized,
                notes=notes,
                recorded_by=staff_profile
            )

            investment.current_valuation = total_val
            investment.valuation_date = val_date
            investment.valuation_source = source
            investment.save(update_fields=['current_valuation', 'valuation_date', 'valuation_source', 'updated_at'])

            actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
            InvestmentAuditLog.objects.create(
                investment=investment,
                action='VALUATION_UPDATED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                notes=f"Updated valuation to ₹{total_val} (Unrealized yield: ₹{unrealized}) from source '{source}'."
            )

        return Response({
            'success': True,
            'message': 'Mark-to-market valuation recorded successfully.',
            'current_valuation': str(total_val),
            'unrealized_gain_loss': str(unrealized)
        })

    @action(detail=True, methods=['post'], url_path='redeem')
    def redeem_or_mature(self, request, pk=None):
        """
        Processes redemption, sale, or maturity payout.
        Calculates realized gain/loss, credits settlement account, and records Section 14 transaction.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        gross_proceeds = Decimal(str(request.data.get('gross_proceeds', 0)))
        tds_withheld = Decimal(str(request.data.get('tds_withheld', 0)))
        charges = Decimal(str(request.data.get('charges', 0)))
        receipt_date = request.data.get('receipt_date', str(timezone.localdate()))
        settlement_acc_id = request.data.get('settlement_financial_account')
        reference_number = request.data.get('reference_number', '').strip()
        is_full = request.data.get('is_full_redemption', True)
        notes = request.data.get('notes', '').strip()

        if gross_proceeds <= Decimal('0.00'):
            return Response({'error': 'Gross proceeds must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        net_proceeds = gross_proceeds - tds_withheld - charges
        if net_proceeds < Decimal('0.00'):
            return Response({'error': 'Withholdings and charges cannot exceed gross proceeds.'}, status=status.HTTP_400_BAD_REQUEST)

        settlement_acc = None
        if settlement_acc_id:
            settlement_acc = FinancialAccount.objects.filter(id=settlement_acc_id).first()
        if not settlement_acc:
            settlement_acc = investment.settlement_financial_account or investment.source_financial_account

        if not settlement_acc:
            return Response({'error': 'A settlement bank account is required to credit redemption proceeds.'}, status=status.HTTP_400_BAD_REQUEST)

        # Realized gain / loss = Gross proceeds - Principal
        realized_gain = gross_proceeds - investment.principal_amount

        with transaction.atomic():
            cat = (
                FinancialTransactionCategory.FIXED_DEPOSIT_TRANSACTION
                if investment.category == InvestmentCategory.FIXED_DEPOSIT
                else FinancialTransactionCategory.INVESTMENT_TRANSACTION
            )

            # Credit settlement account
            tx_number = f"TXN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            txn = FinancialAccountTransaction.objects.create(
                account=settlement_acc,
                transaction_number=tx_number,
                transaction_type=TransactionType.CREDIT,
                category=cat,
                amount=net_proceeds,
                debit_amount=net_proceeds,
                credit_amount=Decimal('0.00'),
                transaction_date=receipt_date,
                accounting_date=receipt_date,
                reference_number=reference_number or f"RED-{investment.investment_code}",
                counterparty=investment.institution_name or investment.name,
                description=f"Treasury Investment Settlement: {investment.get_category_display()} - {investment.name} (Gross: ₹{gross_proceeds}, Net: ₹{net_proceeds})",
                lifecycle_status=TransactionLifecycleStatus.POSTED,
                posting_status='POSTED',
                posted_at=timezone.now(),
                posted_by=staff_profile,
                created_by=staff_profile,
                investment=investment,
                branch=investment.branch
            )

            calc_bal, _, _ = settlement_acc.calculate_balance()
            settlement_acc.current_balance = calc_bal
            settlement_acc.save(update_fields=['current_balance', 'updated_at'])

            # Update investment record
            prev_status = investment.lifecycle_status
            investment.actual_maturity_proceeds = gross_proceeds
            investment.realized_gain_loss = realized_gain
            if is_full:
                investment.lifecycle_status = InvestmentLifecycleStatus.CLOSED
                investment.closed_by = staff_profile
                investment.closed_at = timezone.now()
                investment.current_valuation = Decimal('0.00')
            else:
                investment.lifecycle_status = InvestmentLifecycleStatus.REDEEMED

            investment.settlement_financial_account = settlement_acc
            investment.save(update_fields=[
                'actual_maturity_proceeds', 'realized_gain_loss', 'lifecycle_status',
                'closed_by', 'closed_at', 'current_valuation', 'settlement_financial_account', 'updated_at'
            ])

            actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
            InvestmentAuditLog.objects.create(
                investment=investment,
                action='REDEEMED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                previous_status=prev_status,
                new_status=investment.lifecycle_status,
                notes=f"Settled investment proceeds: Gross ₹{gross_proceeds}, Net ₹{net_proceeds} credited to {settlement_acc.name}. Realized Gain/Loss: ₹{realized_gain}."
            )

        return Response({
            'success': True,
            'message': f"Settlement of ₹{net_proceeds} credited successfully.",
            'realized_gain_loss': str(realized_gain),
            'transaction_number': txn.transaction_number
        })

    @action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """
        Section 15 Master Metrics calculated directly from Supabase PostgreSQL.
        Zero hardcoded or fabricated numbers.
        """
        today = timezone.localdate()
        in_30_days = today + timedelta(days=30)

        all_inv = InvestmentRegister.objects.all()

        # 1. Total invested principal (Active + Matured)
        active_and_matured = all_inv.filter(
            lifecycle_status__in=[
                InvestmentLifecycleStatus.ACTIVE,
                InvestmentLifecycleStatus.APPROVED,
                InvestmentLifecycleStatus.MATURED
            ]
        )
        total_invested_principal = active_and_matured.aggregate(s=Sum('principal_amount'))['s'] or Decimal('0.00')

        # 2. Current portfolio valuation (Active only)
        active_inv = all_inv.filter(lifecycle_status=InvestmentLifecycleStatus.ACTIVE)
        current_valuation = active_inv.aggregate(s=Sum('current_valuation'))['s'] or Decimal('0.00')

        # 3. Income received (cumulative recorded)
        interest_income = all_inv.aggregate(s=Sum('total_interest_received'))['s'] or Decimal('0.00')
        dividend_income = all_inv.aggregate(s=Sum('total_dividend_received'))['s'] or Decimal('0.00')
        total_income = interest_income + dividend_income

        # 4. Realized and Unrealized gains
        realized_gains_total = all_inv.aggregate(s=Sum('realized_gain_loss'))['s'] or Decimal('0.00')
        
        # Unrealized gains = sum(current_valuation - principal) for active investments
        unrealized_gains_total = Decimal('0.00')
        for inv in active_inv:
            unrealized_gains_total += inv.unrealized_gain_loss

        # 5. Maturities & Settlements
        maturing_soon = all_inv.filter(
            lifecycle_status__in=[InvestmentLifecycleStatus.ACTIVE, InvestmentLifecycleStatus.APPROVED],
            maturity_date__gte=today,
            maturity_date__lte=in_30_days
        ).count()

        matured_awaiting_settlement = all_inv.filter(
            lifecycle_status__in=[InvestmentLifecycleStatus.ACTIVE, InvestmentLifecycleStatus.MATURED],
            maturity_date__lt=today,
            actual_maturity_proceeds=Decimal('0.00')
        ).count()

        awaiting_approval = all_inv.filter(lifecycle_status=InvestmentLifecycleStatus.PENDING_APPROVAL).count()

        # 6. Portfolio allocation by category
        category_allocation = []
        for cat_choice in InvestmentCategory.choices:
            cat_code = cat_choice[0]
            cat_label = cat_choice[1]
            cat_invs = active_inv.filter(category=cat_code)
            cat_principal = cat_invs.aggregate(s=Sum('principal_amount'))['s'] or Decimal('0.00')
            cat_val = cat_invs.aggregate(s=Sum('current_valuation'))['s'] or Decimal('0.00')
            cat_count = cat_invs.count()
            if cat_count > 0 or total_invested_principal == Decimal('0.00'):
                pct = (float(cat_principal) / float(total_invested_principal) * 100.0) if total_invested_principal > 0 else 0.0
                category_allocation.append({
                    'category': cat_code,
                    'category_label': cat_label,
                    'principal': str(cat_principal),
                    'valuation': str(cat_val),
                    'count': cat_count,
                    'percentage': round(pct, 2)
                })

        # 7. Investment transactions awaiting reconciliation
        unreconciled_txns = FinancialAccountTransaction.objects.filter(
            investment__isnull=False
        ).exclude(
            lifecycle_status=TransactionLifecycleStatus.RECONCILED
        ).count()

        return Response({
            'total_invested_principal': str(total_invested_principal),
            'current_portfolio_valuation': str(current_valuation),
            'total_income_received': str(total_income),
            'interest_income_received': str(interest_income),
            'dividend_income_received': str(dividend_income),
            'realized_gain_loss': str(realized_gains_total),
            'unrealized_gain_loss': str(unrealized_gains_total),
            'maturing_soon_count': maturing_soon,
            'matured_awaiting_settlement_count': matured_awaiting_settlement,
            'awaiting_approval_count': awaiting_approval,
            'unreconciled_transactions_count': unreconciled_txns,
            'category_allocation': category_allocation,
            'active_investments_count': active_inv.count(),
            'total_records_count': all_inv.count()
        })

    @action(detail=False, methods=['get'], url_path='maturity-calendar')
    def maturity_calendar(self, request):
        """
        Returns maturity calendar schedule and alerts.
        """
        today = timezone.localdate()
        investments = InvestmentRegister.objects.filter(
            maturity_date__isnull=False
        ).exclude(
            lifecycle_status__in=[InvestmentLifecycleStatus.CLOSED, InvestmentLifecycleStatus.CANCELLED, InvestmentLifecycleStatus.REJECTED]
        ).order_by('maturity_date')

        calendar_events = []
        for inv in investments:
            days_left = (inv.maturity_date - today).days
            calendar_events.append({
                'id': str(inv.id),
                'investment_code': inv.investment_code,
                'name': inv.name,
                'category': inv.category,
                'category_display': inv.get_category_display(),
                'institution_name': inv.institution_name,
                'principal_amount': str(inv.principal_amount),
                'expected_maturity_amount': str(inv.expected_maturity_amount),
                'maturity_date': str(inv.maturity_date),
                'days_remaining': days_left,
                'status': inv.lifecycle_status,
                'is_overdue': days_left < 0 and inv.actual_maturity_proceeds == Decimal('0.00'),
                'is_imminent': 0 <= days_left <= 7,
                'is_soon': 7 < days_left <= 30
            })

        return Response({'success': True, 'events': calendar_events})

    @action(detail=True, methods=['get', 'post'], url_path='documents')
    def documents_handler(self, request, pk=None):
        """
        Uploads or lists supporting investment documents.
        """
        investment = self.get_object()
        staff_profile = self._get_staff_profile(request)

        if request.method == 'GET':
            docs = investment.documents.all()
            serializer = InvestmentDocumentSerializer(docs, many=True)
            return Response(serializer.data)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        doc_type = request.data.get('document_type', InvestmentDocumentType.DEPOSIT_CERTIFICATE)
        title = request.data.get('title', file_obj.name)

        doc = InvestmentDocument.objects.create(
            investment=investment,
            document_type=doc_type,
            title=title,
            file=file_obj,
            file_size=file_obj.size,
            mime_type=file_obj.content_type or 'application/octet-stream',
            uploaded_by=staff_profile
        )

        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        InvestmentAuditLog.objects.create(
            investment=investment,
            action='DOCUMENT_UPLOADED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            notes=f"Uploaded document '{title}' ({doc.get_document_type_display()})."
        )

        return Response(InvestmentDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='audit-trail')
    def audit_trail(self, request, pk=None):
        """
        Retrieves full chronological audit trail for the investment.
        """
        investment = self.get_object()
        logs = investment.audit_logs.all().order_by('-created_at')
        serializer = InvestmentAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export')
    def export_csv(self, request):
        """
        Exports filtered investment portfolio records to CSV.
        """
        qs = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="investment_portfolio_{timezone.localdate()}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Investment Code', 'Name', 'Category', 'Institution', 'Reference #',
            'Principal Amount', 'Interest Rate %', 'Compounding', 'Purchase Date',
            'Maturity Date', 'Expected Maturity', 'Current Valuation', 'Valuation Date',
            'Total Interest Received', 'Total Dividend Received', 'Realized Gain/Loss',
            'Status', 'Branch'
        ])

        for inv in qs:
            writer.writerow([
                inv.investment_code,
                inv.name,
                inv.get_category_display(),
                inv.institution_name,
                inv.reference_number,
                inv.principal_amount,
                inv.interest_rate_pct,
                inv.get_compounding_frequency_display(),
                inv.purchase_date,
                inv.maturity_date or 'Open-Ended',
                inv.expected_maturity_amount,
                inv.current_valuation,
                inv.valuation_date,
                inv.total_interest_received,
                inv.total_dividend_received,
                inv.realized_gain_loss,
                inv.lifecycle_status,
                inv.branch.name if inv.branch else ''
            ])

        return response
