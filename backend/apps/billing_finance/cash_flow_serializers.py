from decimal import Decimal
from rest_framework import serializers
from apps.billing_finance.models import (
    FinancialBudget, BudgetLineItem, BudgetRevision,
    CapitalExpenditurePlan, MinimumCashThreshold, LiquidityAlert,
    CashFlowForecastAssumption, BudgetApprovalStatus, CapexStatus
)
from apps.core.models import Branch, Department
from apps.authentication.models import UserProfile, StaffProfile


def get_request_staff(user):
    if not user or not user.is_authenticated:
        return None
    if hasattr(user, 'staff_profile'):
        return user.staff_profile
    up = UserProfile.objects.filter(supabase_user_id=user.username).first()
    if up:
        return StaffProfile.objects.filter(user_profile=up).first()
    return None


class BudgetLineItemSerializer(serializers.ModelSerializer):
    chart_of_account_code = serializers.CharField(source='chart_of_account.account_code', read_only=True)
    chart_of_account_name = serializers.CharField(source='chart_of_account.name', read_only=True)

    class Meta:
        model = BudgetLineItem
        fields = [
            'id', 'category_name', 'chart_of_account', 'chart_of_account_code',
            'chart_of_account_name', 'allocated_amount', 'utilized_amount', 'notes'
        ]


class BudgetRevisionSerializer(serializers.ModelSerializer):
    revised_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BudgetRevision
        fields = [
            'id', 'revision_number', 'previous_amount', 'revised_amount',
            'reason', 'revised_by', 'revised_by_name', 'created_at'
        ]

    def get_revised_by_name(self, obj):
        if obj.revised_by and obj.revised_by.user_profile:
            u = obj.revised_by.user_profile
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return "System"


class FinancialBudgetSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    prepared_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    line_items = BudgetLineItemSerializer(many=True, read_only=True)
    revisions = BudgetRevisionSerializer(many=True, read_only=True)
    variance_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    utilization_percentage = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = FinancialBudget
        fields = [
            'id', 'budget_code', 'fiscal_year', 'period_type', 'month',
            'branch', 'branch_name', 'department', 'department_name',
            'budget_type', 'total_budget_amount', 'actual_spent_amount',
            'status', 'notes_assumptions', 'prepared_by', 'prepared_by_name',
            'approved_by', 'approved_by_name', 'approved_at', 'closed_at',
            'rejection_reason', 'line_items', 'revisions', 'variance_amount',
            'utilization_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'budget_code', 'actual_spent_amount', 'approved_by', 'approved_at',
            'closed_at', 'created_at', 'updated_at'
        ]

    def get_prepared_by_name(self, obj):
        if obj.prepared_by and obj.prepared_by.user_profile:
            u = obj.prepared_by.user_profile
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return "System"

    def get_approved_by_name(self, obj):
        if obj.approved_by and obj.approved_by.user_profile:
            u = obj.approved_by.user_profile
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return None

    def create(self, validated_data):
        import uuid
        count = FinancialBudget.objects.count() + 1
        validated_data['budget_code'] = f"BDG-{validated_data.get('fiscal_year', '2026-2027')}-{count:03d}"
        user = self.context.get('request').user if self.context.get('request') else None
        staff = get_request_staff(user)
        if staff:
            validated_data['prepared_by'] = staff
        return super().create(validated_data)


class CapitalExpenditurePlanSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='requesting_department.name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CapitalExpenditurePlan
        fields = [
            'id', 'capex_code', 'project_name', 'description', 'business_justification',
            'requesting_department', 'department_name', 'branch', 'branch_name',
            'estimated_cost', 'expected_purchase_date', 'proposed_payment_schedule',
            'budget_allocation', 'status', 'actual_expenditure', 'supplier_reference',
            'related_asset', 'requested_by', 'requested_by_name', 'approved_by',
            'approved_by_name', 'approved_at', 'rejection_reason', 'created_at'
        ]
        read_only_fields = [
            'capex_code', 'actual_expenditure', 'approved_by', 'approved_at', 'created_at'
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by and obj.requested_by.user_profile:
            u = obj.requested_by.user_profile
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return "N/A"

    def get_approved_by_name(self, obj):
        if obj.approved_by and obj.approved_by.user_profile:
            u = obj.approved_by.user_profile
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return None

    def create(self, validated_data):
        count = CapitalExpenditurePlan.objects.count() + 1
        validated_data['capex_code'] = f"CAPEX-{count:04d}"
        user = self.context.get('request').user if self.context.get('request') else None
        staff = get_request_staff(user)
        if staff:
            validated_data['requested_by'] = staff
        return super().create(validated_data)


class MinimumCashThresholdSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='financial_account.name', read_only=True)
    account_code = serializers.CharField(source='financial_account.account_code', read_only=True)
    current_balance = serializers.DecimalField(source='financial_account.current_balance', max_digits=14, decimal_places=2, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = MinimumCashThreshold
        fields = [
            'id', 'financial_account', 'account_code', 'account_name',
            'current_balance', 'branch', 'branch_name', 'is_hospital_wide',
            'threshold_amount', 'alert_severity', 'notify_roles', 'is_active', 'created_at'
        ]


class LiquidityAlertSerializer(serializers.ModelSerializer):
    financial_account_name = serializers.CharField(source='financial_account.name', read_only=True)

    class Meta:
        model = LiquidityAlert
        fields = [
            'id', 'alert_type', 'severity', 'financial_account',
            'financial_account_name', 'title', 'message', 'obligation_amount',
            'due_date', 'recommended_action', 'is_acknowledged',
            'acknowledged_by', 'acknowledged_at', 'created_at'
        ]


class CashFlowForecastAssumptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CashFlowForecastAssumption
        fields = '__all__'


class UpdatePlannedPaymentDateSerializer(serializers.Serializer):
    schedule_id = serializers.CharField()
    planned_payment_date = serializers.DateField()
