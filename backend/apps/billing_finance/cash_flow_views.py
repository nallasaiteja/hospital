from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import views, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.billing_finance.models import (
    FinancialBudget, BudgetLineItem, BudgetRevision,
    CapitalExpenditurePlan, MinimumCashThreshold, LiquidityAlert,
    CashFlowForecastAssumption, BudgetApprovalStatus, CapexStatus
)
from apps.billing_finance.cash_flow_serializers import (
    FinancialBudgetSerializer, BudgetLineItemSerializer, BudgetRevisionSerializer,
    CapitalExpenditurePlanSerializer, MinimumCashThresholdSerializer,
    LiquidityAlertSerializer, CashFlowForecastAssumptionSerializer,
    UpdatePlannedPaymentDateSerializer
)
from apps.billing_finance.cash_flow_service import (
    CashFlowPlanningService, parse_period_dates, get_financial_year_bounds
)


class BaseFinancePermission(permissions.BasePermission):
    """
    Ensures user is authenticated and belongs to an authorized finance/staff role.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        user_role = getattr(request.user, 'role', None)
        if not user_role:
            from apps.authentication.models import UserProfile
            up = UserProfile.objects.filter(supabase_user_id=request.user.username).first()
            if up and up.role:
                user_role = up.role.name
        elif hasattr(user_role, 'name'):
            user_role = user_role.name

        if user_role == 'PATIENT':
            return False
        return True


def get_request_staff(user):
    if not user or not user.is_authenticated:
        return None
    if hasattr(user, 'staff_profile'):
        return user.staff_profile
    from apps.authentication.models import UserProfile, StaffProfile
    up = UserProfile.objects.filter(supabase_user_id=user.username).first()
    if up:
        return StaffProfile.objects.filter(user_profile=up).first()
    return None


class CashFlowDashboardAPIView(views.APIView):
    """
    Treasury Dashboard API returning 17 core database metrics,
    cash and bank balance reconciliation, and forecast summary.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        filters = {
            'period': request.query_params.get('period', 'financial_year'),
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'branch_id': request.query_params.get('branch_id'),
            'horizon_days': request.query_params.get('horizon_days', 30),
        }
        data = CashFlowPlanningService.get_treasury_dashboard_metrics(filters)
        return Response(data, status=status.HTTP_200_OK)


class CashFlowActualBreakdownAPIView(views.APIView):
    """
    Classified Actual Cash Inflows and Outflows statement:
    Operating, Investing, and Financing activities.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        period_filter = request.query_params.get('period', 'financial_year')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')

        start_date, end_date, period_label = parse_period_dates(
            period_filter, start_date_str, end_date_str
        )
        data = CashFlowPlanningService.get_actual_cash_inflows_and_outflows(
            start_date, end_date, branch_id
        )
        data['period'] = {
            'label': period_label,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
        }
        return Response(data, status=status.HTTP_200_OK)


class CashFlowForecastAPIView(views.APIView):
    """
    Cash Flow Forecasting Timeline across 30, 60, 90, 180 days.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_cash_flow_forecast(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class ExpectedPatientCollectionsAPIView(views.APIView):
    """
    Detailed Expected Patient Collections schedule and forecast from outstanding invoices.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_expected_patient_collections(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class ExpectedInsuranceReceiptsAPIView(views.APIView):
    """
    Expected Insurance Collections schedule from active claims.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_expected_insurance_receipts(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class SupplierPaymentScheduleAPIView(views.APIView):
    """
    Supplier Payment Schedules and planned payment date updates.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_supplier_payment_schedules(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = UpdatePlannedPaymentDateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        schedule_id = serializer.validated_data['schedule_id']
        planned_date = serializer.validated_data['planned_payment_date']
        
        try:
            res = CashFlowPlanningService.update_supplier_planned_payment_date(
                schedule_id, planned_date, user=request.user
            )
            return Response(res, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PayrollTaxScheduleAPIView(views.APIView):
    """
    Upcoming Payroll and Statutory Tax Obligations schedules.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_payroll_and_tax_schedules(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class LoanRepaymentForecastAPIView(views.APIView):
    """
    Upcoming Loan Debt Service Installments separating principal and interest.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_loan_repayment_forecasts(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class InvestmentMaturityForecastAPIView(views.APIView):
    """
    Maturing Investment Proceeds and Matured-Unsettled investments.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        horizon_days = int(request.query_params.get('horizon_days', 30))
        branch_id = request.query_params.get('branch_id')
        data = CashFlowPlanningService.get_investment_maturity_forecasts(horizon_days, branch_id)
        return Response(data, status=status.HTTP_200_OK)


class BudgetVarianceReportAPIView(views.APIView):
    """
    Budget-Versus-Actual Reports across departments and expense categories.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        _, _, _, default_fy = get_financial_year_bounds()
        fiscal_year = request.query_params.get('fiscal_year', default_fy)
        branch_id = request.query_params.get('branch_id')
        department_id = request.query_params.get('department_id')
        period_type = request.query_params.get('period_type', 'ANNUAL')

        data = CashFlowPlanningService.get_budget_management_and_variance(
            fiscal_year=fiscal_year,
            branch_id=branch_id,
            department_id=department_id,
            period_type=period_type
        )
        return Response(data, status=status.HTTP_200_OK)


class CashFlowExportCSVAPIView(views.APIView):
    """
    Exports GAAP Cash Flow Statement & Treasury metrics to CSV.
    """
    permission_classes = [BaseFinancePermission]

    def get(self, request):
        filters = {
            'period': request.query_params.get('period', 'financial_year'),
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'branch_id': request.query_params.get('branch_id'),
            'horizon_days': request.query_params.get('horizon_days', 30),
        }
        csv_content = CashFlowPlanningService.generate_cash_flow_csv(filters)
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="cash_flow_statement_{timezone.localdate().isoformat()}.csv"'
        return response


class FinancialBudgetViewSet(viewsets.ModelViewSet):
    """
    Full CRUD and approval lifecycle for Financial Budgets.
    Workflow: DRAFT -> PENDING_APPROVAL -> APPROVED -> CLOSED
    Supports formal revisions with audit logging.
    """
    permission_classes = [BaseFinancePermission]
    serializer_class = FinancialBudgetSerializer
    queryset = FinancialBudget.objects.all().select_related(
        'department', 'branch', 'prepared_by__user_profile', 'approved_by__user_profile'
    )

    def get_queryset(self):
        qs = super().get_queryset()
        fy = self.request.query_params.get('fiscal_year')
        if fy:
            qs = qs.filter(fiscal_year=fy)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        dept_id = self.request.query_params.get('department_id')
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

    @action(detail=True, methods=['post'], url_path='submit-approval')
    def submit_for_approval(self, request, pk=None):
        budget = self.get_object()
        if budget.status != BudgetApprovalStatus.DRAFT:
            return Response(
                {'error': f"Only DRAFT budgets can be submitted. Current status: {budget.status}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        budget.status = BudgetApprovalStatus.PENDING_APPROVAL
        budget.save(update_fields=['status', 'updated_at'])
        return Response({'status': 'success', 'message': f"Budget {budget.budget_code} submitted for approval."})

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        budget = self.get_object()
        staff = get_request_staff(request.user)

        # Separation of duties check: creator cannot approve their own budget if staff profile matches
        if staff and budget.prepared_by and budget.prepared_by.id == staff.id:
            return Response(
                {'error': "Separation of duties violation: You cannot approve a budget you prepared."},
                status=status.HTTP_403_FORBIDDEN
            )

        budget.status = BudgetApprovalStatus.APPROVED
        budget.approved_by = staff
        budget.approved_at = timezone.now()
        budget.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return Response({'status': 'success', 'message': f"Budget {budget.budget_code} successfully approved."})

    @action(detail=True, methods=['post'], url_path='revise')
    def revise(self, request, pk=None):
        budget = self.get_object()
        new_amount_str = request.data.get('revised_amount')
        reason = request.data.get('reason', 'Formal budget reallocation')

        if not new_amount_str:
            return Response({'error': "revised_amount is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_amount = Decimal(str(new_amount_str))
        except Exception:
            return Response({'error': "Invalid revised_amount format."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_request_staff(request.user)
        if not staff:
            return Response({'error': "Staff profile required to record revision."}, status=status.HTTP_400_BAD_REQUEST)

        rev_num = budget.revisions.count() + 1
        previous_amount = budget.total_budget_amount

        # Record Revision log
        BudgetRevision.objects.create(
            budget=budget,
            revision_number=rev_num,
            previous_amount=previous_amount,
            revised_amount=new_amount,
            reason=reason,
            revised_by=staff
        )

        budget.total_budget_amount = new_amount
        budget.status = BudgetApprovalStatus.REVISED
        budget.save(update_fields=['total_budget_amount', 'status', 'updated_at'])

        return Response({
            'status': 'success',
            'message': f"Budget {budget.budget_code} revised to ₹{new_amount} (Revision #{rev_num}).",
            'revision_number': rev_num,
            'previous_amount': previous_amount,
            'revised_amount': new_amount,
        })


class CapitalExpenditurePlanViewSet(viewsets.ModelViewSet):
    """
    Capital Expenditure (CapEx) Planning and Acquisition Pipeline.
    """
    permission_classes = [BaseFinancePermission]
    serializer_class = CapitalExpenditurePlanSerializer
    queryset = CapitalExpenditurePlan.objects.all().select_related(
        'requesting_department', 'branch', 'requested_by__user_profile', 'approved_by__user_profile'
    )

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        capex = self.get_object()
        staff = get_request_staff(request.user)
        capex.status = CapexStatus.APPROVED_COMMITMENT
        capex.approved_by = staff
        capex.approved_at = timezone.now()
        capex.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return Response({'status': 'success', 'message': f"CapEx plan {capex.capex_code} approved as formal commitment."})


class MinimumCashThresholdViewSet(viewsets.ModelViewSet):
    """
    Configurable Minimum Cash Balance Thresholds for individual accounts or entire hospital.
    """
    permission_classes = [BaseFinancePermission]
    serializer_class = MinimumCashThresholdSerializer
    queryset = MinimumCashThreshold.objects.all().select_related('financial_account', 'branch')

    def perform_create(self, serializer):
        staff = get_request_staff(self.request.user)
        serializer.save(created_by=staff)


class LiquidityAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Real-time Liquidity & Treasury Risk Alerts.
    """
    permission_classes = [BaseFinancePermission]
    serializer_class = LiquidityAlertSerializer
    queryset = LiquidityAlert.objects.all().select_related('financial_account')

    def get_queryset(self):
        qs = super().get_queryset()
        is_ack = self.request.query_params.get('acknowledged')
        if is_ack is not None:
            qs = qs.filter(is_acknowledged=is_ack.lower() == 'true')
        return qs

    @action(detail=True, methods=['post'], url_path='acknowledge')
    def acknowledge(self, request, pk=None):
        res = CashFlowPlanningService.acknowledge_liquidity_alert(pk, user=request.user)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='refresh')
    def refresh_alerts(self, request):
        branch_id = request.data.get('branch_id')
        res = CashFlowPlanningService.check_and_generate_liquidity_alerts(branch_id=branch_id)
        return Response(res, status=status.HTTP_200_OK)
