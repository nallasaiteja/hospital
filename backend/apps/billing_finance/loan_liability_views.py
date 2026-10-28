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
from rest_framework.views import APIView


def add_months(orig_date: date, months: int) -> date:
    """Pure standard-library month addition handling leap years and month ends."""
    year = orig_date.year + (orig_date.month + months - 1) // 12
    month = (orig_date.month + months - 1) % 12 + 1
    days_in_month = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
    day = min(orig_date.day, days_in_month)
    return date(year, month, day)

from apps.authentication.permissions import IsStaffMember
from apps.authentication.models import StaffProfile, RoleEnum
from apps.authentication.utils import get_staff_profile
from apps.billing_finance.models import (
    LoanRegister, LoanType, LoanLifecycleStatus, LoanRepaymentFrequency,
    RepaymentInstallmentStatus, LoanRepaymentSchedule, LoanRepaymentRecord,
    LiabilityCategory, LiabilityTenureType, LiabilityPaymentStatus, LiabilityPriority,
    HospitalLiability, LiabilityPaymentRecord, LoanAuditLog, LiabilityAuditLog,
    LoanDocumentType, LoanDocument, LiabilityDocumentType, LiabilityDocument,
    FinancialAccount, FinancialAccountTransaction, TransactionLifecycleStatus,
    TransactionType, FinancialTransactionCategory, AccountingClassification
)
from apps.billing_finance.serializers import (
    LoanRegisterSerializer, LoanRepaymentScheduleSerializer,
    LoanRepaymentRecordSerializer, LoanDocumentSerializer, LoanAuditLogSerializer,
    HospitalLiabilitySerializer, LiabilityPaymentRecordSerializer,
    LiabilityDocumentSerializer, LiabilityAuditLogSerializer
)


def calculate_emi(principal: Decimal, annual_rate_pct: Decimal, tenure_months: int) -> Decimal:
    """
    Standard monthly Equated Monthly Installment (EMI) formula:
    EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    Where:
    - P is principal
    - r is monthly interest rate (annual_rate_pct / 100 / 12)
    - n is tenure_months
    Handles zero-interest loans separately: EMI = P / n.
    """
    if principal <= Decimal('0.00') or tenure_months <= 0:
        return Decimal('0.00')
    
    if annual_rate_pct <= Decimal('0.00'):
        # Zero-interest loan
        return (principal / Decimal(str(tenure_months))).quantize(Decimal('0.01'))
    
    float_p = float(principal)
    float_r = float(annual_rate_pct) / 100.0 / 12.0
    float_n = float(tenure_months)
    
    try:
        pow_term = (1.0 + float_r) ** float_n
        float_emi = (float_p * float_r * pow_term) / (pow_term - 1.0)
        emi = Decimal(str(round(float_emi, 2))).quantize(Decimal('0.01'))
        return emi
    except (ZeroDivisionError, OverflowError):
        return (principal / Decimal(str(tenure_months))).quantize(Decimal('0.01'))


def generate_loan_amortization_schedule(loan: LoanRegister) -> list:
    """
    Generates amortization installments based on actual loan terms.
    Cleans up any un-paid pending schedules before regenerating.
    """
    # Delete existing pending schedules to avoid duplicates
    LoanRepaymentSchedule.objects.filter(loan=loan, paid_amount=Decimal('0.00')).delete()
    
    schedules = []
    p = loan.sanctioned_amount or loan.principal_amount
    rate = loan.interest_rate_pct
    tenure = loan.tenure_months
    frequency = loan.repayment_frequency
    start = loan.start_date
    
    # Calculate intervals and periods
    if frequency == LoanRepaymentFrequency.QUARTERLY:
        periods = max(1, tenure // 3)
        month_step = 3
        periodic_rate = (rate / Decimal('100.0')) / Decimal('4.0')
    elif frequency == LoanRepaymentFrequency.HALF_YEARLY:
        periods = max(1, tenure // 6)
        month_step = 6
        periodic_rate = (rate / Decimal('100.0')) / Decimal('2.0')
    elif frequency == LoanRepaymentFrequency.ANNUALLY:
        periods = max(1, tenure // 12)
        month_step = 12
        periodic_rate = (rate / Decimal('100.0'))
    elif frequency == LoanRepaymentFrequency.BULLET:
        # Bullet: 1 installment at maturity
        maturity = loan.maturity_date or add_months(start, tenure)
        interest = (p * (rate / Decimal('100.0')) * (Decimal(str(tenure)) / Decimal('12.0'))).quantize(Decimal('0.01'))
        sched = LoanRepaymentSchedule(
            loan=loan,
            installment_number=1,
            due_date=maturity,
            opening_principal=p,
            principal_due=p,
            interest_due=interest,
            fee_amount=Decimal('0.00'),
            total_due=(p + interest).quantize(Decimal('0.01')),
            closing_principal=Decimal('0.00'),
            payment_status=RepaymentInstallmentStatus.PENDING
        )
        schedules.append(sched)
        LoanRepaymentSchedule.objects.bulk_create(schedules)
        return schedules
    else:
        # Default: Monthly EMI
        periods = tenure
        month_step = 1
        periodic_rate = (rate / Decimal('100.0')) / Decimal('12.0')
    
    emi = loan.monthly_emi
    if not emi or emi <= Decimal('0.00'):
        emi = calculate_emi(p, rate, tenure)
        loan.monthly_emi = emi
        loan.save(update_fields=['monthly_emi'])
    
    cur_principal = p
    today = timezone.localdate()
    
    for i in range(1, periods + 1):
        due_date = add_months(start, i * month_step)
        opening = cur_principal
        
        if rate > Decimal('0.00'):
            interest_due = (cur_principal * periodic_rate).quantize(Decimal('0.01'))
        else:
            interest_due = Decimal('0.00')
        
        # Last installment settles remaining balance exactly
        if i == periods:
            principal_due = cur_principal
            total_due = principal_due + interest_due
            closing = Decimal('0.00')
        else:
            principal_due = (emi - interest_due).quantize(Decimal('0.01'))
            if principal_due > cur_principal:
                principal_due = cur_principal
            total_due = principal_due + interest_due
            closing = (cur_principal - principal_due).quantize(Decimal('0.01'))
        
        cur_principal = closing
        
        sched = LoanRepaymentSchedule(
            loan=loan,
            installment_number=i,
            due_date=due_date,
            opening_principal=opening,
            principal_due=principal_due,
            interest_due=interest_due,
            fee_amount=Decimal('0.00'),
            total_due=total_due,
            closing_principal=closing,
            payment_status=RepaymentInstallmentStatus.OVERDUE if due_date < today else RepaymentInstallmentStatus.PENDING
        )
        schedules.append(sched)
    
    LoanRepaymentSchedule.objects.bulk_create(schedules)
    return schedules


class LoanViewSet(viewsets.ModelViewSet):
    """
    Section 16: Hospital Loan Management ViewSet.
    Handles bank term loans, medical equipment debt, EMI amortization schedules,
    loan disbursements, repayments, and Section 13/14 financial ledger reconciliations.
    """
    queryset = LoanRegister.objects.select_related(
        'liability_financial_account', 'servicing_financial_account',
        'branch', 'department', 'created_by__user_profile', 'approved_by__user_profile'
    ).prefetch_related('repayment_schedules', 'repayment_records', 'documents', 'audit_logs').all()
    serializer_class = LoanRegisterSerializer
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
            RoleEnum.FINANCE_MANAGER
        ]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        loan_type = params.get('loan_type')
        if loan_type:
            qs = qs.filter(loan_type=loan_type)

        lifecycle_status = params.get('lifecycle_status') or params.get('status')
        if lifecycle_status:
            qs = qs.filter(Q(lifecycle_status=lifecycle_status) | Q(status=lifecycle_status))

        lender = params.get('lender')
        if lender:
            qs = qs.filter(lender_name__icontains=lender)

        search = params.get('search')
        if search:
            qs = qs.filter(
                Q(loan_account_number__icontains=search) |
                Q(lender_name__icontains=search) |
                Q(purpose__icontains=search) |
                Q(collateral_details__icontains=search)
            )

        start_date = params.get('start_date')
        if start_date:
            qs = qs.filter(start_date__gte=start_date)

        end_date = params.get('end_date')
        if end_date:
            qs = qs.filter(start_date__lte=end_date)

        is_secured = params.get('is_secured')
        if is_secured is not None and is_secured != '':
            qs = qs.filter(is_secured=(is_secured.lower() == 'true'))

        return qs

    def perform_create(self, serializer):
        staff_profile = self._get_staff_profile(self.request)
        today = timezone.localdate()
        validated_data = serializer.validated_data

        principal = validated_data.get('principal_amount', Decimal('0.00'))
        sanctioned = validated_data.get('sanctioned_amount') or principal
        rate = validated_data.get('interest_rate_pct', Decimal('0.00'))
        tenure = validated_data.get('tenure_months', 36)
        frequency = validated_data.get('repayment_frequency', LoanRepaymentFrequency.MONTHLY)
        start_date = validated_data.get('start_date', today)
        maturity_date = validated_data.get('maturity_date') or add_months(start_date, tenure)

        # Calculate EMI correctly
        calculated_emi = calculate_emi(principal, rate, tenure)
        monthly_emi = validated_data.get('monthly_emi') or calculated_emi

        # Auto generate loan account number if missing
        acc_num = validated_data.get('loan_account_number')
        if not acc_num:
            prefix = validated_data.get('loan_type', 'LOAN')[:4].upper()
            acc_num = f"{prefix}-{today.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        loan = serializer.save(
            loan_account_number=acc_num,
            sanctioned_amount=sanctioned,
            outstanding_balance=principal,
            monthly_emi=monthly_emi,
            maturity_date=maturity_date,
            created_by=staff_profile,
            submitted_by=staff_profile,
            submitted_at=timezone.now() if validated_data.get('lifecycle_status') == LoanLifecycleStatus.PENDING_APPROVAL else None
        )

        actor_name, actor_role = self._get_actor_info(staff_profile, self.request.user)
        LoanAuditLog.objects.create(
            loan=loan,
            action='CREATED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status='',
            new_status=loan.lifecycle_status,
            notes=f"Loan registered for ₹{principal} from {loan.lender_name} at {rate}% p.a."
        )

        # Generate schedule if active or approved
        if loan.lifecycle_status in [LoanLifecycleStatus.ACTIVE, LoanLifecycleStatus.APPROVED]:
            generate_loan_amortization_schedule(loan)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit_for_approval(self, request, pk=None):
        """Submit draft loan for manager approval."""
        loan = self.get_object()
        if loan.lifecycle_status != LoanLifecycleStatus.DRAFT:
            return Response({'error': f"Only DRAFT loans can be submitted. Current status: {loan.lifecycle_status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)

        loan.lifecycle_status = LoanLifecycleStatus.PENDING_APPROVAL
        loan.status = 'PENDING'
        loan.submitted_by = staff_profile
        loan.submitted_at = timezone.now()
        loan.save(update_fields=['lifecycle_status', 'status', 'submitted_by', 'submitted_at', 'updated_at'])

        LoanAuditLog.objects.create(
            loan=loan,
            action='SUBMITTED_FOR_APPROVAL',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status=LoanLifecycleStatus.DRAFT,
            new_status=LoanLifecycleStatus.PENDING_APPROVAL,
            notes="Loan application submitted for managerial approval."
        )
        return Response(LoanRegisterSerializer(loan).data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Approve Loan Facility. Enforces Separation of Duties:
        The staff member who created/submitted the loan cannot approve it.
        """
        loan = self.get_object()
        if loan.lifecycle_status != LoanLifecycleStatus.PENDING_APPROVAL:
            return Response({'error': f"Only loans in PENDING_APPROVAL can be approved. Current: {loan.lifecycle_status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        if not self._has_approval_role(staff_profile):
            return Response({'error': "Unauthorized: Only Finance Managers or Hospital Administrators can approve loans."}, status=status.HTTP_403_FORBIDDEN)

        # Separation of Duties check
        if staff_profile and loan.created_by and staff_profile.id == loan.created_by.id:
            return Response({'error': "Separation of Duties Violation: Preparer cannot approve their own loan application."}, status=status.HTTP_403_FORBIDDEN)

        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        auto_activate = request.data.get('auto_activate', False)

        with transaction.atomic():
            loan.approved_by = staff_profile
            loan.approved_at = timezone.now()
            prev_status = loan.lifecycle_status
            
            if auto_activate:
                loan.lifecycle_status = LoanLifecycleStatus.ACTIVE
                loan.status = 'ACTIVE'
                loan.disbursed_amount = loan.principal_amount
                loan.disbursement_date = timezone.localdate()
            else:
                loan.lifecycle_status = LoanLifecycleStatus.APPROVED
                loan.status = 'APPROVED'
            
            loan.save(update_fields=['approved_by', 'approved_at', 'lifecycle_status', 'status', 'disbursed_amount', 'disbursement_date', 'updated_at'])

            LoanAuditLog.objects.create(
                loan=loan,
                action='APPROVED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                previous_status=prev_status,
                new_status=loan.lifecycle_status,
                notes=request.data.get('notes', 'Loan sanctioned and approved.')
            )

            # Generate Amortization schedule
            generate_loan_amortization_schedule(loan)

        return Response(LoanRegisterSerializer(loan).data)

    @action(detail=True, methods=['post'], url_path='disburse')
    def disburse(self, request, pk=None):
        """
        Execute loan disbursement.
        Credits the servicing financial account and records Section 14 Financial Transaction.
        CRITICAL: Loan disbursements are borrowings/liabilities and NOT hospital revenue.
        """
        loan = self.get_object()
        if loan.lifecycle_status not in [LoanLifecycleStatus.APPROVED, LoanLifecycleStatus.PENDING_APPROVAL]:
            return Response({'error': f"Cannot disburse loan in status {loan.lifecycle_status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)

        disbursed_amount = Decimal(str(request.data.get('amount') or loan.principal_amount))
        servicing_account_id = request.data.get('servicing_account_id') or (loan.servicing_financial_account_id if loan.servicing_financial_account else None)

        if not servicing_account_id:
            return Response({'error': "Servicing financial bank account is required to receive disbursement."}, status=status.HTTP_400_BAD_REQUEST)

        servicing_account = FinancialAccount.objects.filter(id=servicing_account_id).first()
        if not servicing_account:
            return Response({'error': "Selected servicing bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        reference_number = request.data.get('reference_number', '')

        with transaction.atomic():
            # 1. Update Loan status
            prev_status = loan.lifecycle_status
            loan.disbursed_amount = disbursed_amount
            loan.outstanding_balance = disbursed_amount
            loan.disbursement_date = timezone.localdate()
            loan.servicing_financial_account = servicing_account
            loan.lifecycle_status = LoanLifecycleStatus.ACTIVE
            loan.status = 'ACTIVE'
            loan.save(update_fields=['disbursed_amount', 'outstanding_balance', 'disbursement_date', 'servicing_financial_account', 'lifecycle_status', 'status', 'updated_at'])

            # 2. Credit the receiving servicing bank account
            servicing_account.current_balance = (servicing_account.current_balance or Decimal('0.00')) + disbursed_amount
            servicing_account.save(update_fields=['current_balance', 'updated_at'])

            # 3. Create Section 14 Financial Transaction (CREDIT: inflow of borrowed funds, NOT revenue)
            txn_num = f"TXN-DISB-{timezone.localdate().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            financial_txn = FinancialAccountTransaction.objects.create(
                account=servicing_account,
                transaction_number=txn_num,
                transaction_date=timezone.localdate(),
                accounting_date=timezone.localdate(),
                transaction_type=TransactionType.CREDIT,
                category=FinancialTransactionCategory.LOAN_DISBURSEMENT_REPAYMENT,
                description=f"Loan Disbursement: {loan.lender_name} ({loan.loan_account_number})",
                counterparty=loan.lender_name,
                amount=disbursed_amount,
                credit_amount=disbursed_amount,
                debit_amount=Decimal('0.00'),
                payment_method=request.data.get('payment_method', 'BANK_TRANSFER'),
                reference_number=reference_number,
                posting_status='POSTED',
                lifecycle_status=TransactionLifecycleStatus.POSTED,
                branch=loan.branch,
                department=loan.department,
                loan=loan,
                created_by=staff_profile,
                approved_by=staff_profile,
                posted_by=staff_profile,
                posted_at=timezone.now()
            )

            # 4. Generate amortization schedule
            generate_loan_amortization_schedule(loan)

            # 5. Audit Log
            LoanAuditLog.objects.create(
                loan=loan,
                action='DISBURSED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                previous_status=prev_status,
                new_status=LoanLifecycleStatus.ACTIVE,
                notes=f"Loan disbursed ₹{disbursed_amount} credited to {servicing_account.name}. Txn #{txn_num}"
            )

        return Response({
            'success': True,
            'message': f"Disbursement of ₹{disbursed_amount} processed successfully.",
            'loan': LoanRegisterSerializer(loan).data,
            'transaction_number': txn_num
        })

    @action(detail=True, methods=['post'], url_path='record-repayment')
    def record_repayment(self, request, pk=None):
        """
        Record loan repayment / EMI installment payment.
        - Reduces outstanding principal
        - Separates principal vs interest vs fees
        - Debits servicing financial account
        - Creates Section 14 Financial Transaction
        - Prevents duplicate transaction reference entries
        """
        loan = self.get_object()
        if loan.lifecycle_status not in [LoanLifecycleStatus.ACTIVE, LoanLifecycleStatus.OVERDUE]:
            return Response({'error': f"Cannot make repayments on loan in status {loan.lifecycle_status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        data = request.data

        total_amount = Decimal(str(data.get('amount') or '0.00'))
        if total_amount <= Decimal('0.00'):
            return Response({'error': "Repayment amount must be strictly greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        principal_component = Decimal(str(data.get('principal_amount') or '0.00'))
        interest_component = Decimal(str(data.get('interest_amount') or '0.00'))
        fee_component = Decimal(str(data.get('fee_or_penalty') or '0.00'))

        # If breakdown not explicitly provided, allocate based on EMI formula or outstanding interest
        if principal_component <= Decimal('0.00') and interest_component <= Decimal('0.00'):
            if loan.interest_rate_pct > Decimal('0.00'):
                monthly_rate = (loan.interest_rate_pct / Decimal('100.0')) / Decimal('12.0')
                calc_interest = (loan.outstanding_balance * monthly_rate).quantize(Decimal('0.01'))
                if total_amount > calc_interest:
                    interest_component = calc_interest
                    principal_component = total_amount - calc_interest
                else:
                    interest_component = total_amount
                    principal_component = Decimal('0.00')
            else:
                principal_component = total_amount
                interest_component = Decimal('0.00')

        # Ensure sum matches total
        computed_total = principal_component + interest_component + fee_component
        if computed_total != total_amount:
            principal_component = total_amount - interest_component - fee_component

        # Servicing bank account
        servicing_account_id = data.get('servicing_account_id') or (loan.servicing_financial_account_id if loan.servicing_financial_account else None)
        if not servicing_account_id:
            return Response({'error': "Servicing financial bank account is required."}, status=status.HTTP_400_BAD_REQUEST)

        servicing_account = FinancialAccount.objects.filter(id=servicing_account_id).first()
        if not servicing_account:
            return Response({'error': "Servicing bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        reference_number = data.get('reference_number', '').strip()
        # Prevent accidental duplicate deductions with identical UTR reference
        if reference_number and LoanRepaymentRecord.objects.filter(loan=loan, reference_number=reference_number).exists():
            return Response({'error': f"Duplicate Payment Prevention: A repayment with reference '{reference_number}' already exists for this loan."}, status=status.HTTP_400_BAD_REQUEST)

        installment_id = data.get('installment_id')
        installment = None
        if installment_id:
            installment = LoanRepaymentSchedule.objects.filter(id=installment_id, loan=loan).first()

        repay_num = f"LRP-{timezone.localdate().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            # 1. Deduce from servicing bank account
            servicing_account.current_balance = (servicing_account.current_balance or Decimal('0.00')) - total_amount
            servicing_account.save(update_fields=['current_balance', 'updated_at'])

            # 2. Record Section 14 Financial Transaction (DEBIT: debt service outflow)
            txn_num = f"TXN-LRP-{timezone.localdate().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            financial_txn = FinancialAccountTransaction.objects.create(
                account=servicing_account,
                transaction_number=txn_num,
                transaction_date=timezone.localdate(),
                accounting_date=timezone.localdate(),
                transaction_type=TransactionType.DEBIT,
                category=FinancialTransactionCategory.LOAN_DISBURSEMENT_REPAYMENT,
                description=f"Loan Repayment: {loan.lender_name} ({loan.loan_account_number}) [Principal: ₹{principal_component}, Interest: ₹{interest_component}]",
                counterparty=loan.lender_name,
                amount=total_amount,
                debit_amount=total_amount,
                credit_amount=Decimal('0.00'),
                payment_method=data.get('payment_method', 'BANK_TRANSFER'),
                reference_number=reference_number,
                posting_status='POSTED',
                lifecycle_status=TransactionLifecycleStatus.POSTED,
                branch=loan.branch,
                department=loan.department,
                loan=loan,
                created_by=staff_profile,
                approved_by=staff_profile,
                posted_by=staff_profile,
                posted_at=timezone.now()
            )

            # 3. Create LoanRepaymentRecord
            repayment_record = LoanRepaymentRecord.objects.create(
                loan=loan,
                installment=installment,
                repayment_number=repay_num,
                repayment_date=data.get('repayment_date') or timezone.localdate(),
                total_amount=total_amount,
                principal_amount=principal_component,
                interest_amount=interest_component,
                fee_or_penalty=fee_component,
                payment_method=data.get('payment_method', 'BANK_TRANSFER'),
                reference_number=reference_number,
                servicing_account=servicing_account,
                financial_transaction=financial_txn,
                is_early_payoff=data.get('is_early_payoff', False),
                notes=data.get('notes', ''),
                recorded_by=staff_profile
            )

            # 4. Update Loan balances
            loan.total_repaid = (loan.total_repaid or Decimal('0.00')) + total_amount
            loan.total_principal_repaid = (loan.total_principal_repaid or Decimal('0.00')) + principal_component
            loan.total_interest_paid = (loan.total_interest_paid or Decimal('0.00')) + interest_component
            loan.total_fees_paid = (loan.total_fees_paid or Decimal('0.00')) + fee_component
            
            new_outstanding = max(Decimal('0.00'), (loan.outstanding_balance or Decimal('0.00')) - principal_component)
            loan.outstanding_balance = new_outstanding

            if new_outstanding <= Decimal('0.00'):
                loan.lifecycle_status = LoanLifecycleStatus.CLOSED
                loan.status = 'CLOSED'
                loan.closed_by = staff_profile
                loan.closed_at = timezone.now()

            loan.save()

            # 5. Update Installment Schedule if applicable
            if installment:
                installment.paid_amount = (installment.paid_amount or Decimal('0.00')) + total_amount
                installment.paid_principal = (installment.paid_principal or Decimal('0.00')) + principal_component
                installment.paid_interest = (installment.paid_interest or Decimal('0.00')) + interest_component
                installment.paid_fee = (installment.paid_fee or Decimal('0.00')) + fee_component
                installment.payment_date = timezone.localdate()
                if installment.paid_amount >= installment.total_due:
                    installment.payment_status = RepaymentInstallmentStatus.PAID
                else:
                    installment.payment_status = RepaymentInstallmentStatus.PARTIALLY_PAID
                installment.save()
            else:
                # Chronologically satisfy oldest pending schedule
                pending_sched = loan.repayment_schedules.filter(payment_status__in=[RepaymentInstallmentStatus.PENDING, RepaymentInstallmentStatus.OVERDUE, RepaymentInstallmentStatus.PARTIALLY_PAID]).order_by('installment_number').first()
                if pending_sched:
                    pending_sched.paid_amount = (pending_sched.paid_amount or Decimal('0.00')) + total_amount
                    pending_sched.paid_principal = (pending_sched.paid_principal or Decimal('0.00')) + principal_component
                    pending_sched.paid_interest = (pending_sched.paid_interest or Decimal('0.00')) + interest_component
                    pending_sched.payment_date = timezone.localdate()
                    if pending_sched.paid_amount >= pending_sched.total_due:
                        pending_sched.payment_status = RepaymentInstallmentStatus.PAID
                    else:
                        pending_sched.payment_status = RepaymentInstallmentStatus.PARTIALLY_PAID
                    pending_sched.save()

            # 6. Audit Trail
            LoanAuditLog.objects.create(
                loan=loan,
                action='REPAYMENT_RECORDED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                previous_status=loan.lifecycle_status,
                new_status=loan.lifecycle_status,
                notes=f"Repayment of ₹{total_amount} recorded (Principal: ₹{principal_component}, Interest: ₹{interest_component}). Balance: ₹{new_outstanding}."
            )

        return Response({
            'success': True,
            'message': f"Repayment of ₹{total_amount} processed successfully.",
            'repayment': LoanRepaymentRecordSerializer(repayment_record).data,
            'outstanding_balance': str(loan.outstanding_balance),
            'loan_status': loan.lifecycle_status
        })

    @action(detail=True, methods=['post'], url_path='early-payoff')
    def early_payoff(self, request, pk=None):
        """Foreclose / Early payoff of the entire remaining loan principal balance."""
        loan = self.get_object()
        if loan.lifecycle_status not in [LoanLifecycleStatus.ACTIVE, LoanLifecycleStatus.OVERDUE]:
            return Response({'error': f"Cannot early payoff loan in status {loan.lifecycle_status}"}, status=status.HTTP_400_BAD_REQUEST)

        outstanding = loan.outstanding_balance
        if outstanding <= Decimal('0.00'):
            return Response({'error': "Loan has zero outstanding balance."}, status=status.HTTP_400_BAD_REQUEST)

        request.data['amount'] = str(outstanding)
        request.data['principal_amount'] = str(outstanding)
        request.data['interest_amount'] = '0.00'
        request.data['is_early_payoff'] = True
        return self.record_repayment(request, pk=pk)

    @action(detail=True, methods=['get'], url_path='schedules')
    def get_schedules(self, request, pk=None):
        """Fetch all amortization schedule installments for this loan."""
        loan = self.get_object()
        schedules = loan.repayment_schedules.all().order_by('installment_number')
        return Response(LoanRepaymentScheduleSerializer(schedules, many=True).data)

    @action(detail=True, methods=['get'], url_path='repayments')
    def get_repayments(self, request, pk=None):
        """Fetch repayment history for this loan."""
        loan = self.get_object()
        repayments = loan.repayment_records.all().order_by('-repayment_date')
        return Response(LoanRepaymentRecordSerializer(repayments, many=True).data)

    @action(detail=True, methods=['get'], url_path='audit-logs')
    def get_audit_logs(self, request, pk=None):
        """Fetch chronological audit trail for this loan."""
        loan = self.get_object()
        logs = loan.audit_logs.all().order_by('-created_at')
        return Response(LoanAuditLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'], url_path='documents')
    def upload_document(self, request, pk=None):
        """Upload supporting document for loan."""
        loan = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        doc = LoanDocument.objects.create(
            loan=loan,
            title=request.data.get('title') or file_obj.name,
            document_type=request.data.get('document_type', LoanDocumentType.SANCTION_LETTER),
            file=file_obj,
            file_size=file_obj.size,
            mime_type=file_obj.content_type if hasattr(file_obj, 'content_type') else '',
            uploaded_by=staff_profile
        )
        return Response(LoanDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class HospitalLiabilityViewSet(viewsets.ModelViewSet):
    """
    Section 16: Hospital Liability Management ViewSet.
    Tracks supplier/vendor payables, equipment payables, operating expense obligations,
    short-term and long-term liabilities, with full financial ledger integration.
    """
    queryset = HospitalLiability.objects.select_related(
        'liability_financial_account', 'linked_supplier', 'linked_supplier_invoice',
        'branch', 'department', 'created_by__user_profile'
    ).prefetch_related('payments', 'documents', 'audit_logs').all()
    serializer_class = HospitalLiabilitySerializer
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

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        category = params.get('category')
        if category:
            qs = qs.filter(category=category)

        tenure_type = params.get('tenure_type')
        if tenure_type:
            qs = qs.filter(tenure_type=tenure_type)

        payment_status = params.get('payment_status') or params.get('status')
        if payment_status:
            qs = qs.filter(payment_status=payment_status)

        creditor = params.get('creditor')
        if creditor:
            qs = qs.filter(creditor_name__icontains=creditor)

        search = params.get('search')
        if search:
            qs = qs.filter(
                Q(liability_number__icontains=search) |
                Q(title__icontains=search) |
                Q(creditor_name__icontains=search) |
                Q(creditor_reference__icontains=search)
            )

        start_date = params.get('start_date')
        if start_date:
            qs = qs.filter(due_date__gte=start_date)

        end_date = params.get('end_date')
        if end_date:
            qs = qs.filter(due_date__lte=end_date)

        priority = params.get('priority')
        if priority:
            qs = qs.filter(priority=priority)

        return qs

    def perform_create(self, serializer):
        staff_profile = self._get_staff_profile(self.request)
        today = timezone.localdate()
        validated_data = serializer.validated_data

        orig_amt = validated_data.get('original_amount', Decimal('0.00'))
        due_date = validated_data.get('due_date', today + timedelta(days=30))

        # Auto generate liability number
        cat_prefix = validated_data.get('category', 'LIAB')[:4].upper()
        liab_num = f"{cat_prefix}-{today.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        # Determine short-term vs long-term automatically if not explicitly set
        tenure = validated_data.get('tenure_type')
        if not tenure:
            days = (due_date - today).days
            tenure = LiabilityTenureType.LONG_TERM if days > 365 else LiabilityTenureType.SHORT_TERM

        liability = serializer.save(
            liability_number=liab_num,
            outstanding_amount=orig_amt,
            tenure_type=tenure,
            created_by=staff_profile
        )

        actor_name, actor_role = self._get_actor_info(staff_profile, self.request.user)
        LiabilityAuditLog.objects.create(
            liability=liability,
            action='CREATED',
            actor=staff_profile,
            actor_name=actor_name,
            actor_role=actor_role,
            previous_status='',
            new_status=liability.payment_status,
            notes=f"Liability obligation registered for ₹{orig_amt} payable to {liability.creditor_name}."
        )

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """
        Record payment towards an outstanding hospital liability.
        - Reduces liability outstanding amount
        - Debits servicing financial account
        - Creates Section 14 Financial Transaction
        - Updates linked Section 10 Supplier Invoice if present (avoiding duplicates)
        """
        liability = self.get_object()
        if liability.payment_status == LiabilityPaymentStatus.PAID:
            return Response({'error': "This liability obligation is already fully settled."}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        actor_name, actor_role = self._get_actor_info(staff_profile, request.user)
        data = request.data

        amount = Decimal(str(data.get('amount') or '0.00'))
        if amount <= Decimal('0.00'):
            return Response({'error': "Payment amount must be strictly greater than zero."}, status=status.HTTP_400_BAD_REQUEST)

        if amount > liability.outstanding_amount:
            return Response({'error': f"Payment amount ₹{amount} exceeds outstanding liability ₹{liability.outstanding_amount}"}, status=status.HTTP_400_BAD_REQUEST)

        servicing_account_id = data.get('servicing_account_id')
        if not servicing_account_id:
            return Response({'error': "Servicing financial bank account is required."}, status=status.HTTP_400_BAD_REQUEST)

        servicing_account = FinancialAccount.objects.filter(id=servicing_account_id).first()
        if not servicing_account:
            return Response({'error': "Servicing bank account not found."}, status=status.HTTP_404_NOT_FOUND)

        reference_number = data.get('reference_number', '').strip()
        pay_num = f"PAY-LIA-{timezone.localdate().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            # 1. Deduct funds from bank account
            servicing_account.current_balance = (servicing_account.current_balance or Decimal('0.00')) - amount
            servicing_account.save(update_fields=['current_balance', 'updated_at'])

            # 2. Section 14 Financial Transaction (DEBIT)
            category = FinancialTransactionCategory.SUPPLIER_VENDOR_PAYMENT if liability.category == LiabilityCategory.SUPPLIER_PAYABLE else FinancialTransactionCategory.OPERATING_EXPENSE
            txn_num = f"TXN-LIA-{timezone.localdate().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            financial_txn = FinancialAccountTransaction.objects.create(
                account=servicing_account,
                transaction_number=txn_num,
                transaction_date=timezone.localdate(),
                accounting_date=timezone.localdate(),
                transaction_type=TransactionType.DEBIT,
                category=category,
                description=f"Liability Payment: {liability.creditor_name} - {liability.title} ({liability.liability_number})",
                counterparty=liability.creditor_name,
                amount=amount,
                debit_amount=amount,
                credit_amount=Decimal('0.00'),
                payment_method=data.get('payment_method', 'BANK_TRANSFER'),
                reference_number=reference_number,
                posting_status='POSTED',
                lifecycle_status=TransactionLifecycleStatus.POSTED,
                branch=liability.branch,
                department=liability.department,
                created_by=staff_profile,
                approved_by=staff_profile,
                posted_by=staff_profile,
                posted_at=timezone.now()
            )

            # 3. Create LiabilityPaymentRecord
            payment_record = LiabilityPaymentRecord.objects.create(
                liability=liability,
                payment_number=pay_num,
                payment_date=data.get('payment_date') or timezone.localdate(),
                amount=amount,
                payment_method=data.get('payment_method', 'BANK_TRANSFER'),
                reference_number=reference_number,
                servicing_account=servicing_account,
                financial_transaction=financial_txn,
                notes=data.get('notes', ''),
                recorded_by=staff_profile
            )

            # 4. Update Liability
            prev_status = liability.payment_status
            liability.paid_amount = (liability.paid_amount or Decimal('0.00')) + amount
            new_outstanding = max(Decimal('0.00'), (liability.outstanding_amount or Decimal('0.00')) - amount)
            liability.outstanding_amount = new_outstanding

            if new_outstanding <= Decimal('0.00'):
                liability.payment_status = LiabilityPaymentStatus.PAID
            else:
                liability.payment_status = LiabilityPaymentStatus.PARTIALLY_PAID

            liability.save()

            # 5. Integrate with Section 10 Supplier Invoice if linked
            if liability.linked_supplier_invoice:
                inv = liability.linked_supplier_invoice
                inv.paid_amount = (inv.paid_amount or Decimal('0.00')) + amount
                if inv.paid_amount >= inv.total_amount:
                    inv.payment_status = 'PAID'
                else:
                    inv.payment_status = 'PARTIAL'
                inv.save(update_fields=['paid_amount', 'payment_status', 'updated_at'])

            # 6. Audit Trail
            LiabilityAuditLog.objects.create(
                liability=liability,
                action='PAYMENT_RECORDED',
                actor=staff_profile,
                actor_name=actor_name,
                actor_role=actor_role,
                previous_status=prev_status,
                new_status=liability.payment_status,
                notes=f"Payment of ₹{amount} processed via {servicing_account.name}. Outstanding: ₹{new_outstanding}."
            )

        return Response({
            'success': True,
            'message': f"Payment of ₹{amount} processed successfully.",
            'payment': LiabilityPaymentRecordSerializer(payment_record).data,
            'outstanding_amount': str(liability.outstanding_amount),
            'payment_status': liability.payment_status
        })

    @action(detail=True, methods=['get'], url_path='audit-logs')
    def get_audit_logs(self, request, pk=None):
        """Fetch chronological audit trail for this liability."""
        liability = self.get_object()
        logs = liability.audit_logs.all().order_by('-created_at')
        return Response(LiabilityAuditLogSerializer(logs, many=True).data)

    @action(detail=True, methods=['post'], url_path='documents')
    def upload_document(self, request, pk=None):
        """Upload supporting document for liability."""
        liability = self.get_object()
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        staff_profile = self._get_staff_profile(request)
        doc = LiabilityDocument.objects.create(
            liability=liability,
            title=request.data.get('title') or file_obj.name,
            document_type=request.data.get('document_type', LiabilityDocumentType.VENDOR_INVOICE),
            file=file_obj,
            file_size=file_obj.size,
            mime_type=file_obj.content_type if hasattr(file_obj, 'content_type') else '',
            uploaded_by=staff_profile
        )
        return Response(LiabilityDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='sync-supplier-invoices')
    def sync_supplier_invoices(self, request):
        """
        Synchronizes approved unpaid supplier invoices from Section 10 Pharmacy/Inventory
        into Section 16 Hospital Liabilities without creating duplicate vendor records.
        """
        from apps.pharmacy_inventory.models import SupplierInvoice
        
        staff_profile = self._get_staff_profile(request)
        today = timezone.localdate()
        synced_count = 0

        unpaid_invoices = SupplierInvoice.objects.filter(
            payment_status__in=['UNPAID', 'PENDING', 'PARTIAL']
        ).select_related('supplier', 'branch')

        for inv in unpaid_invoices:
            # Check if already synced
            if HospitalLiability.objects.filter(linked_supplier_invoice=inv).exists():
                continue

            outstanding = inv.total_amount - (inv.paid_amount or Decimal('0.00'))
            if outstanding <= Decimal('0.00'):
                continue

            liab_num = f"SUPP-{today.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
            HospitalLiability.objects.create(
                liability_number=liab_num,
                title=f"Supplier Invoice #{inv.invoice_number}",
                category=LiabilityCategory.SUPPLIER_PAYABLE,
                tenure_type=LiabilityTenureType.SHORT_TERM,
                creditor_name=inv.supplier.name if inv.supplier else "Unknown Supplier",
                creditor_reference=inv.invoice_number,
                linked_supplier=inv.supplier,
                linked_supplier_invoice=inv,
                original_amount=inv.total_amount,
                paid_amount=inv.paid_amount or Decimal('0.00'),
                outstanding_amount=outstanding,
                incurred_date=inv.invoice_date or today,
                due_date=inv.due_date or (today + timedelta(days=30)),
                payment_status=LiabilityPaymentStatus.PARTIALLY_PAID if (inv.paid_amount or Decimal('0.00')) > 0 else LiabilityPaymentStatus.PENDING,
                branch=inv.branch,
                created_by=staff_profile,
                notes=f"Auto-synchronized from Section 10 Inventory PO/GRN Invoice {inv.invoice_number}"
            )
            synced_count += 1

        return Response({
            'success': True,
            'message': f"Synchronized {synced_count} supplier invoices into liabilities ledger.",
            'synced_count': synced_count
        })


class LoanLiabilityDashboardView(APIView):
    """
    Section 16: Comprehensive Loan and Liability KPI Dashboard & Analytics.
    All displayed totals are dynamically computed from underlying database records.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        today = timezone.localdate()
        next_30 = today + timedelta(days=30)
        next_60 = today + timedelta(days=60)
        next_90 = today + timedelta(days=90)

        # 1. Loan Aggregates
        loans = LoanRegister.objects.all()
        active_loans = loans.filter(lifecycle_status__in=[LoanLifecycleStatus.ACTIVE, LoanLifecycleStatus.OVERDUE])
        
        total_sanctioned = loans.aggregate(s=Sum('sanctioned_amount'))['s'] or Decimal('0.00')
        total_disbursed = loans.aggregate(s=Sum('disbursed_amount'))['s'] or Decimal('0.00')
        total_loan_outstanding = active_loans.aggregate(s=Sum('outstanding_balance'))['s'] or Decimal('0.00')
        total_monthly_emi = active_loans.aggregate(s=Sum('monthly_emi'))['s'] or Decimal('0.00')
        total_principal_repaid = loans.aggregate(s=Sum('total_principal_repaid'))['s'] or Decimal('0.00')
        total_interest_paid = loans.aggregate(s=Sum('total_interest_paid'))['s'] or Decimal('0.00')

        # 2. Liability Aggregates
        liabilities = HospitalLiability.objects.all()
        active_liabilities = liabilities.exclude(payment_status__in=[LiabilityPaymentStatus.PAID, LiabilityPaymentStatus.CANCELLED])
        
        total_liabilities_outstanding = active_liabilities.aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')
        short_term_liabilities = active_liabilities.filter(tenure_type=LiabilityTenureType.SHORT_TERM).aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')
        long_term_liabilities = active_liabilities.filter(tenure_type=LiabilityTenureType.LONG_TERM).aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')

        # Category Breakdown for Liabilities
        cat_breakdown = []
        for cat_choice in LiabilityCategory.choices:
            code, label = cat_choice
            amt = active_liabilities.filter(category=code).aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')
            count = active_liabilities.filter(category=code).count()
            cat_breakdown.append({
                'category': code,
                'label': label,
                'amount': amt,
                'count': count
            })

        # 3. Upcoming & Overdue Loan Installments
        all_schedules = LoanRepaymentSchedule.objects.filter(
            loan__lifecycle_status__in=[LoanLifecycleStatus.ACTIVE, LoanLifecycleStatus.OVERDUE]
        ).exclude(payment_status=RepaymentInstallmentStatus.PAID)
        
        upcoming_installments_30 = all_schedules.filter(due_date__gte=today, due_date__lte=next_30).order_by('due_date')
        upcoming_installments_amount = upcoming_installments_30.aggregate(s=Sum('total_due'))['s'] or Decimal('0.00')
        
        overdue_installments = all_schedules.filter(due_date__lt=today).order_by('due_date')
        overdue_installments_count = overdue_installments.count()
        overdue_installments_amount = overdue_installments.aggregate(s=Sum('total_due'))['s'] or Decimal('0.00')

        # 4. Upcoming & Overdue Liabilities
        upcoming_liabilities_30 = active_liabilities.filter(due_date__gte=today, due_date__lte=next_30).order_by('due_date')
        upcoming_liabilities_amount = upcoming_liabilities_30.aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')

        overdue_liabilities = active_liabilities.filter(due_date__lt=today).order_by('due_date')
        overdue_liabilities_count = overdue_liabilities.count()
        overdue_liabilities_amount = overdue_liabilities.aggregate(s=Sum('outstanding_amount'))['s'] or Decimal('0.00')

        # 5. Loan Maturity Horizons
        maturities = []
        for l in active_loans.order_by('maturity_date')[:5]:
            maturities.append({
                'id': str(l.id),
                'loan_account_number': l.loan_account_number,
                'lender_name': l.lender_name,
                'maturity_date': str(l.maturity_date) if l.maturity_date else '',
                'outstanding_balance': l.outstanding_balance,
                'monthly_emi': l.monthly_emi
            })

        # 6. Monthly Debt Service Trend (last 6 months repayments)
        trend = []
        for i in range(5, -1, -1):
            m_date = add_months(today, -i)
            m_start = m_date.replace(day=1)
            next_m = add_months(m_start, 1)
            
            repay_q = LoanRepaymentRecord.objects.filter(repayment_date__gte=m_start, repayment_date__lt=next_m)
            p_sum = repay_q.aggregate(s=Sum('principal_amount'))['s'] or Decimal('0.00')
            i_sum = repay_q.aggregate(s=Sum('interest_amount'))['s'] or Decimal('0.00')
            
            liab_q = LiabilityPaymentRecord.objects.filter(payment_date__gte=m_start, payment_date__lt=next_m)
            l_sum = liab_q.aggregate(s=Sum('amount'))['s'] or Decimal('0.00')

            trend.append({
                'month': m_start.strftime('%b %Y'),
                'principal_repaid': p_sum,
                'interest_paid': i_sum,
                'liability_paid': l_sum,
                'total_debt_service': p_sum + i_sum + l_sum
            })

        return Response({
            'total_loan_sanctioned': total_sanctioned,
            'total_loan_disbursed': total_disbursed,
            'total_loan_outstanding': total_loan_outstanding,
            'total_monthly_emi': total_monthly_emi,
            'total_principal_repaid': total_principal_repaid,
            'total_interest_paid': total_interest_paid,
            'total_liabilities_outstanding': total_liabilities_outstanding,
            'short_term_liabilities': short_term_liabilities,
            'long_term_liabilities': long_term_liabilities,
            'category_breakdown': cat_breakdown,
            'upcoming_installments_30_days_amount': upcoming_installments_amount,
            'upcoming_installments_count': upcoming_installments_30.count(),
            'upcoming_liabilities_30_days_amount': upcoming_liabilities_amount,
            'upcoming_liabilities_count': upcoming_liabilities_30.count(),
            'overdue_installments_count': overdue_installments_count,
            'overdue_installments_amount': overdue_installments_amount,
            'overdue_liabilities_count': overdue_liabilities_count,
            'overdue_liabilities_amount': overdue_liabilities_amount,
            'loan_maturities': maturities,
            'debt_service_trend': trend,
            'active_loans_count': active_loans.count(),
            'active_liabilities_count': active_liabilities.count()
        })


class LoanLiabilityReportExportView(APIView):
    """
    Export detailed CSV reports for Loans and Liabilities.
    Supports creditor/lender, date, and status filtering.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        report_type = request.query_params.get('type', 'loans') # 'loans' or 'liabilities'
        response = HttpResponse(content_type='text/csv')

        if report_type == 'liabilities':
            response['Content-Disposition'] = f'attachment; filename="hms_liabilities_report_{timezone.localdate()}.csv"'
            writer = csv.writer(response)
            writer.writerow([
                'Liability Number', 'Category', 'Tenure Type', 'Creditor Name', 'Reference #',
                'Original Amount (INR)', 'Paid Amount (INR)', 'Outstanding Amount (INR)',
                'Incurred Date', 'Due Date', 'Payment Status', 'Priority'
            ])

            qs = HospitalLiability.objects.all().order_by('due_date')
            cat = request.query_params.get('category')
            if cat:
                qs = qs.filter(category=cat)
            stat = request.query_params.get('status')
            if stat:
                qs = qs.filter(payment_status=stat)

            for l in qs:
                writer.writerow([
                    l.liability_number,
                    l.get_category_display(),
                    l.get_tenure_type_display(),
                    l.creditor_name,
                    l.creditor_reference,
                    str(l.original_amount),
                    str(l.paid_amount),
                    str(l.outstanding_amount),
                    str(l.incurred_date),
                    str(l.due_date),
                    l.payment_status,
                    l.priority
                ])
        else:
            response['Content-Disposition'] = f'attachment; filename="hms_loans_report_{timezone.localdate()}.csv"'
            writer = csv.writer(response)
            writer.writerow([
                'Loan Account Number', 'Lender Name', 'Loan Type', 'Sanctioned Amount (INR)',
                'Disbursed Amount (INR)', 'Outstanding Principal (INR)', 'Interest Rate (%)',
                'Tenure (Months)', 'Monthly EMI (INR)', 'Principal Repaid (INR)', 'Interest Paid (INR)',
                'Start Date', 'Maturity Date', 'Repayment Frequency', 'Secured', 'Status'
            ])

            qs = LoanRegister.objects.all().order_by('-start_date')
            l_type = request.query_params.get('loan_type')
            if l_type:
                qs = qs.filter(loan_type=l_type)
            stat = request.query_params.get('status')
            if stat:
                qs = qs.filter(lifecycle_status=stat)

            for l in qs:
                writer.writerow([
                    l.loan_account_number,
                    l.lender_name,
                    l.get_loan_type_display(),
                    str(l.sanctioned_amount or l.principal_amount),
                    str(l.disbursed_amount),
                    str(l.outstanding_balance),
                    str(l.interest_rate_pct),
                    l.tenure_months,
                    str(l.monthly_emi),
                    str(l.total_principal_repaid),
                    str(l.total_interest_paid),
                    str(l.start_date),
                    str(l.maturity_date or ''),
                    l.get_repayment_frequency_display(),
                    'Yes' if l.is_secured else 'No',
                    l.lifecycle_status
                ])

        return response
