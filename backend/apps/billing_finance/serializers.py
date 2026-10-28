from decimal import Decimal
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Invoice, InvoiceItem, Payment, InsuranceProvider,
    InsuranceClaim, AccountCategory, ChartOfAccount,
    JournalEntry, JournalLineItem, BankAccount,
    BankTransaction, InvestmentRegister, LoanRegister, BudgetPlan,
    HospitalService, TariffPlan, TariffRate, HospitalPackage,
    PackageComponent, PatientPackageSubscription, PackageUsageLog,
    DiscountRequest, PatientDeposit, DepositAllocation,
    PaymentReceipt, PatientCreditNote, PatientRefund,
    CashierShift, PaymentGatewayOrder, PaymentWebhookLog,
    GatewaySettlement, BillingAuditEvent,
    CorporateCustomer, PatientInsuranceCoverage, EligibilityCheck,
    PreAuthorizationRequest, ClaimDocument, ClaimQuery,
    ClaimSettlement, CorporateInvoice,
    FinancialAccount, FinancialAccountTransaction, BankStatementImport,
    BankStatementEntry, AccountReconciliation, FinancialAccountDocument,
    FinancialAccountType, AccountingClassification, AccountReconciliationStatus,
    StatementEntryStatus, ReconciliationSessionStatus, FinancialDocumentType,
    FinancialTransactionAuditLog, TransactionLifecycleStatus, TransactionType,
    FinancialTransactionCategory,
    InvestmentCategory, InvestmentLifecycleStatus, CompoundingFrequency,
    InvestmentIncomeType, InvestmentIncomeRecord, InvestmentValuationHistory,
    InvestmentAuditLog, InvestmentDocumentType, InvestmentDocument,
    LoanType, LoanLifecycleStatus, LoanRepaymentFrequency,
    RepaymentInstallmentStatus, LoanRepaymentSchedule, LoanRepaymentRecord,
    LiabilityCategory, LiabilityTenureType, LiabilityPaymentStatus, LiabilityPriority,
    HospitalLiability, LiabilityPaymentRecord, LoanAuditLog, LiabilityAuditLog,
    LoanDocumentType, LoanDocument, LiabilityDocumentType, LiabilityDocument,
    FiscalYear, AccountingPeriod, AccountingPeriodAuditLog, JournalAuditLog, JournalDocument
)


class HospitalServiceSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = HospitalService
        fields = '__all__'


class TariffRateSerializer(serializers.ModelSerializer):
    service_code = serializers.CharField(source='service.service_code', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    standard_price = serializers.DecimalField(source='service.standard_price', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = TariffRate
        fields = '__all__'


class TariffPlanSerializer(serializers.ModelSerializer):
    rates = TariffRateSerializer(many=True, read_only=True)
    insurance_name = serializers.CharField(source='insurance_provider.name', read_only=True)
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)

    class Meta:
        model = TariffPlan
        fields = '__all__'


class PackageComponentSerializer(serializers.ModelSerializer):
    service_code = serializers.CharField(source='service.service_code', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    service_standard_price = serializers.DecimalField(source='service.standard_price', max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PackageComponent
        fields = '__all__'


class HospitalPackageSerializer(serializers.ModelSerializer):
    components = PackageComponentSerializer(many=True, read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = HospitalPackage
        fields = '__all__'


class PackageUsageLogSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = PackageUsageLog
        fields = '__all__'


class PatientPackageSubscriptionSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package.name', read_only=True)
    package_code = serializers.CharField(source='package.package_code', read_only=True)
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    usage_logs = PackageUsageLogSerializer(many=True, read_only=True)

    class Meta:
        model = PatientPackageSubscription
        fields = '__all__'


class InvoiceItemSerializer(serializers.ModelSerializer):
    service_code = serializers.CharField(source='service.service_code', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = '__all__'


class PaymentReceiptSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)

    class Meta:
        model = PaymentReceipt
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    receipt = PaymentReceiptSerializer(read_only=True)

    class Meta:
        model = Payment
        fields = '__all__'


class DiscountRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = DiscountRequest
        fields = '__all__'


class DepositAllocationSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    deposit_receipt = serializers.CharField(source='deposit.receipt_number', read_only=True)
    allocated_by_name = serializers.CharField(source='allocated_by.user_profile.full_name', read_only=True)

    class Meta:
        model = DepositAllocation
        fields = '__all__'


class PatientDepositSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    received_by_name = serializers.CharField(source='received_by.user_profile.full_name', read_only=True)
    admission_number = serializers.CharField(source='admission.admission_number', read_only=True)
    allocations = DepositAllocationSerializer(many=True, read_only=True)

    class Meta:
        model = PatientDeposit
        fields = '__all__'


class PatientCreditNoteSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientCreditNote
        fields = '__all__'


class PatientRefundSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientRefund
        fields = '__all__'


class InvoiceSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    tariff_plan_name = serializers.CharField(source='tariff_plan.name', read_only=True)
    package_name = serializers.CharField(source='package_subscription.package.name', read_only=True)
    items = InvoiceItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    receipts = PaymentReceiptSerializer(source='issued_receipts', many=True, read_only=True)
    discount_requests = DiscountRequestSerializer(many=True, read_only=True)
    allocations = DepositAllocationSerializer(source='deposit_allocations', many=True, read_only=True)
    credit_notes = PatientCreditNoteSerializer(source='patient_credit_notes', many=True, read_only=True)
    refunds = PatientRefundSerializer(source='patient_refunds', many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'


class CashierShiftSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.user_profile.full_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.user_profile.full_name', read_only=True)

    class Meta:
        model = CashierShift
        fields = '__all__'


class PaymentGatewayOrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model = PaymentGatewayOrder
        fields = '__all__'


class PaymentWebhookLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentWebhookLog
        fields = '__all__'


class GatewaySettlementSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatewaySettlement
        fields = '__all__'


class BillingAuditEventSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = BillingAuditEvent
        fields = '__all__'


class InsuranceProviderSerializer(serializers.ModelSerializer):
    default_tariff_name = serializers.CharField(source='default_tariff.name', read_only=True)
    claims_count = serializers.IntegerField(source='claims.count', read_only=True)

    class Meta:
        model = InsuranceProvider
        fields = '__all__'


class CorporateCustomerSerializer(serializers.ModelSerializer):
    corporate_tariff_name = serializers.CharField(source='corporate_tariff.name', read_only=True)
    claims_count = serializers.IntegerField(source='claims.count', read_only=True)
    available_credit = serializers.SerializerMethodField()

    class Meta:
        model = CorporateCustomer
        fields = '__all__'

    def get_available_credit(self, obj):
        return str(obj.credit_limit - obj.current_credit_utilized)


class PatientInsuranceCoverageSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.user_profile.username', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    corporate_customer_name = serializers.CharField(source='corporate_customer.name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientInsuranceCoverage
        fields = '__all__'


class EligibilityCheckSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    checked_by_name = serializers.CharField(source='checked_by.user_profile.full_name', read_only=True)
    policy_number = serializers.CharField(source='coverage.policy_number', read_only=True)
    provider_name = serializers.CharField(source='coverage.provider.name', read_only=True)

    class Meta:
        model = EligibilityCheck
        fields = '__all__'
        read_only_fields = ['checked_by']


class PreAuthorizationRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.user_profile.username', read_only=True)
    policy_number = serializers.CharField(source='coverage.policy_number', read_only=True)
    provider_name = serializers.CharField(source='coverage.provider.name', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PreAuthorizationRequest
        fields = '__all__'
        read_only_fields = ['request_number', 'requested_by', 'processed_by', 'approved_amount', 'approval_date', 'status']


class ClaimDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = ClaimDocument
        fields = '__all__'
        read_only_fields = ['uploaded_by']


class ClaimQuerySerializer(serializers.ModelSerializer):
    responded_by_name = serializers.CharField(source='responded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = ClaimQuery
        fields = '__all__'
        read_only_fields = ['query_number', 'responded_by', 'responded_at', 'status']


class ClaimSettlementSerializer(serializers.ModelSerializer):
    settled_by_name = serializers.CharField(source='settled_by.user_profile.full_name', read_only=True)
    claim_number = serializers.CharField(source='claim.claim_number', read_only=True)

    class Meta:
        model = ClaimSettlement
        fields = '__all__'
        read_only_fields = ['settlement_number', 'settled_by']


class InsuranceClaimSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.user_profile.username', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    corporate_name = serializers.CharField(source='corporate_customer.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_total = serializers.CharField(source='invoice.total_amount', read_only=True)
    invoice_balance = serializers.CharField(source='invoice.balance_amount', read_only=True)
    assigned_staff_name = serializers.CharField(source='assigned_staff.user_profile.full_name', read_only=True)
    documents = ClaimDocumentSerializer(many=True, read_only=True)
    queries = ClaimQuerySerializer(many=True, read_only=True)
    settlements = ClaimSettlementSerializer(many=True, read_only=True)

    class Meta:
        model = InsuranceClaim
        fields = '__all__'
        read_only_fields = ['claim_number', 'assigned_staff', 'settled_amount', 'settlement_date']


class CorporateInvoiceSerializer(serializers.ModelSerializer):
    corporate_customer_name = serializers.CharField(source='corporate_customer.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True)

    class Meta:
        model = CorporateInvoice
        fields = '__all__'
        read_only_fields = ['invoice_number', 'created_by', 'paid_amount', 'balance_amount', 'status']


class ChartOfAccountSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_type = serializers.CharField(source='category.category_type', read_only=True)
    classification = serializers.CharField(read_only=True)
    normal_balance = serializers.CharField(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    parent_account_name = serializers.CharField(source='parent_account.name', read_only=True)
    sub_type_display = serializers.CharField(source='get_account_type_display', read_only=True)

    class Meta:
        model = ChartOfAccount
        fields = '__all__'


class JournalLineItemSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.account_code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_classification = serializers.CharField(source='account.classification', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = JournalLineItem
        fields = '__all__'


class JournalAuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = JournalAuditLog
        fields = '__all__'


class JournalDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = JournalDocument
        fields = '__all__'


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineItemSerializer(many=True, read_only=True)
    audit_logs = JournalAuditLogSerializer(many=True, read_only=True)
    documents = JournalDocumentSerializer(many=True, read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    accounting_period_name = serializers.CharField(source='accounting_period.period_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    posted_by_name = serializers.CharField(source='posted_by.user_profile.full_name', read_only=True)
    reversed_by_name = serializers.CharField(source='reversed_by.user_profile.full_name', read_only=True)
    reversal_voucher_number = serializers.CharField(source='reversal_of.voucher_number', read_only=True)

    class Meta:
        model = JournalEntry
        fields = '__all__'


class AccountingPeriodSerializer(serializers.ModelSerializer):
    fiscal_year_code = serializers.CharField(source='fiscal_year.code', read_only=True)
    fiscal_year_name = serializers.CharField(source='fiscal_year.name', read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.user_profile.full_name', read_only=True)
    reopened_by_name = serializers.CharField(source='reopened_by.user_profile.full_name', read_only=True)

    class Meta:
        model = AccountingPeriod
        fields = '__all__'


class FiscalYearSerializer(serializers.ModelSerializer):
    periods = AccountingPeriodSerializer(many=True, read_only=True)
    closed_by_name = serializers.CharField(source='closed_by.user_profile.full_name', read_only=True)

    class Meta:
        model = FiscalYear
        fields = '__all__'


class BankTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankTransaction
        fields = '__all__'


class BankAccountSerializer(serializers.ModelSerializer):
    transactions = BankTransactionSerializer(many=True, read_only=True)

    class Meta:
        model = BankAccount
        fields = '__all__'


class InvestmentAuditLogSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    from_status = serializers.CharField(source='previous_status', read_only=True)
    to_status = serializers.CharField(source='new_status', read_only=True)
    remarks = serializers.CharField(source='notes', read_only=True)
    action_display = serializers.CharField(source='action', read_only=True)

    class Meta:
        model = InvestmentAuditLog
        fields = '__all__'


class InvestmentValuationHistorySerializer(serializers.ModelSerializer):
    recorded_valuation = serializers.DecimalField(source='total_valuation', max_digits=14, decimal_places=2, read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True, default='')

    class Meta:
        model = InvestmentValuationHistory
        fields = '__all__'


class InvestmentIncomeRecordSerializer(serializers.ModelSerializer):
    amount_received = serializers.DecimalField(source='net_amount', max_digits=14, decimal_places=2, read_only=True)
    bank_reference = serializers.CharField(source='reference_number', read_only=True)
    receiving_account_name = serializers.CharField(source='receiving_account.name', read_only=True)
    receiving_account_code = serializers.CharField(source='receiving_account.account_code', read_only=True)
    income_type_display = serializers.CharField(source='get_income_type_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True, default='')
    transaction_number = serializers.CharField(source='financial_transaction.transaction_number', read_only=True)

    class Meta:
        model = InvestmentIncomeRecord
        fields = '__all__'


class InvestmentDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True, default='')

    class Meta:
        model = InvestmentDocument
        fields = '__all__'


class InvestmentRegisterSerializer(serializers.ModelSerializer):
    investment_code = serializers.CharField(required=False, allow_blank=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    lifecycle_status_display = serializers.CharField(source='get_lifecycle_status_display', read_only=True)
    compounding_frequency_display = serializers.CharField(source='get_compounding_frequency_display', read_only=True)
    financial_account_name = serializers.CharField(source='financial_account.name', read_only=True)
    financial_account_code = serializers.CharField(source='financial_account.account_code', read_only=True)
    source_account_name = serializers.CharField(source='source_financial_account.name', read_only=True)
    source_account_code = serializers.CharField(source='source_financial_account.account_code', read_only=True)
    settlement_account_name = serializers.CharField(source='settlement_financial_account.name', read_only=True)
    settlement_account_code = serializers.CharField(source='settlement_financial_account.account_code', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True, default='')
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True, default='')
    unrealized_gain_loss = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    # Aliases for frontend compatibility
    investment_id = serializers.CharField(source='investment_code', read_only=True)
    investment_name = serializers.CharField(source='name', required=False)
    issuing_institution = serializers.CharField(source='institution_name', required=False, allow_blank=True)
    interest_rate = serializers.DecimalField(source='interest_rate_pct', max_digits=5, decimal_places=2, required=False)
    acquisition_fees = serializers.DecimalField(source='purchase_fees', max_digits=12, decimal_places=2, required=False)
    latest_valuation = serializers.DecimalField(source='current_valuation', max_digits=14, decimal_places=2, read_only=True)
    latest_valuation_date = serializers.DateField(source='valuation_date', read_only=True)
    latest_valuation_source = serializers.CharField(source='valuation_source', read_only=True)
    interest_income_received = serializers.DecimalField(source='total_interest_received', max_digits=14, decimal_places=2, read_only=True)
    dividend_income_received = serializers.DecimalField(source='total_dividend_received', max_digits=14, decimal_places=2, read_only=True)
    total_income_received = serializers.SerializerMethodField()
    days_to_maturity = serializers.SerializerMethodField()
    is_maturing_soon = serializers.SerializerMethodField()
    is_matured = serializers.SerializerMethodField()

    audit_logs = InvestmentAuditLogSerializer(many=True, read_only=True)
    valuation_history = InvestmentValuationHistorySerializer(many=True, read_only=True)
    income_records = InvestmentIncomeRecordSerializer(many=True, read_only=True)
    documents = InvestmentDocumentSerializer(many=True, read_only=True)

    def get_total_income_received(self, obj):
        return (obj.total_interest_received or Decimal('0.00')) + (obj.total_dividend_received or Decimal('0.00'))

    def get_days_to_maturity(self, obj):
        if obj.maturity_date:
            today = timezone.localdate()
            return (obj.maturity_date - today).days
        return None

    def get_is_maturing_soon(self, obj):
        days = self.get_days_to_maturity(obj)
        return days is not None and 0 <= days <= 30

    def get_is_matured(self, obj):
        days = self.get_days_to_maturity(obj)
        return days is not None and days < 0

    def to_internal_value(self, data):
        if hasattr(data, 'dict'):
            data = data.dict()
        elif hasattr(data, 'copy'):
            data = data.copy()
        else:
            data = dict(data)

        if 'investment_name' in data and not data.get('name'):
            data['name'] = data['investment_name']
        if 'issuing_institution' in data and not data.get('institution_name'):
            data['institution_name'] = data['issuing_institution']
        if 'interest_rate' in data and not data.get('interest_rate_pct'):
            data['interest_rate_pct'] = data['interest_rate']
        if 'acquisition_fees' in data and not data.get('purchase_fees'):
            data['purchase_fees'] = data['acquisition_fees']
        if 'financial_account' in data and not data.get('source_financial_account'):
            if data['financial_account']:
                data['source_financial_account'] = data['financial_account']
        if not data.get('lifecycle_status'):
            data['lifecycle_status'] = 'DRAFT'
        return super().to_internal_value(data)

    class Meta:
        model = InvestmentRegister
        fields = '__all__'


# ==============================================================================
# SECTION 16: LOAN AND LIABILITY SERIALIZERS
# ==============================================================================

class LoanRepaymentScheduleSerializer(serializers.ModelSerializer):
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model = LoanRepaymentSchedule
        fields = '__all__'


class LoanRepaymentRecordSerializer(serializers.ModelSerializer):
    servicing_account_name = serializers.CharField(source='servicing_account.name', read_only=True, default='')
    servicing_account_code = serializers.CharField(source='servicing_account.account_code', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True, default='')
    transaction_number = serializers.CharField(source='financial_transaction.transaction_number', read_only=True, default='')

    class Meta:
        model = LoanRepaymentRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'repayment_number', 'financial_transaction']


class LoanDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True, default='')
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LoanDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'uploaded_at', 'uploaded_by', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class LoanAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(read_only=True)
    actor_role = serializers.CharField(read_only=True)

    class Meta:
        model = LoanAuditLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class LoanRegisterSerializer(serializers.ModelSerializer):
    loan_type_display = serializers.CharField(source='get_loan_type_display', read_only=True)
    lifecycle_status_display = serializers.CharField(source='get_lifecycle_status_display', read_only=True)
    repayment_frequency_display = serializers.CharField(source='get_repayment_frequency_display', read_only=True)
    liability_account_name = serializers.CharField(source='liability_financial_account.name', read_only=True, default='')
    servicing_account_name = serializers.CharField(source='servicing_financial_account.name', read_only=True, default='')
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    department_name = serializers.CharField(source='department.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True, default='')
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True, default='')
    closed_by_name = serializers.CharField(source='closed_by.user_profile.full_name', read_only=True, default='')
    
    # Nested relations
    repayment_schedules = LoanRepaymentScheduleSerializer(many=True, read_only=True)
    repayment_records = LoanRepaymentRecordSerializer(many=True, read_only=True)
    documents = LoanDocumentSerializer(many=True, read_only=True)
    audit_logs = LoanAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = LoanRegister
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'outstanding_balance', 'monthly_emi',
            'total_repaid', 'total_principal_repaid', 'total_interest_paid', 'total_fees_paid',
            'disbursed_amount', 'submitted_at', 'approved_at', 'approved_by',
            'rejected_at', 'rejected_by', 'closed_at', 'closed_by'
        ]


class LiabilityDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True, default='')
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = LiabilityDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'uploaded_at', 'uploaded_by', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None


class LiabilityAuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(read_only=True)
    actor_role = serializers.CharField(read_only=True)

    class Meta:
        model = LiabilityAuditLog
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class LiabilityPaymentRecordSerializer(serializers.ModelSerializer):
    servicing_account_name = serializers.CharField(source='servicing_account.name', read_only=True, default='')
    servicing_account_code = serializers.CharField(source='servicing_account.account_code', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True, default='')
    transaction_number = serializers.CharField(source='financial_transaction.transaction_number', read_only=True, default='')

    class Meta:
        model = LiabilityPaymentRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'payment_number', 'financial_transaction']


class HospitalLiabilitySerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    tenure_type_display = serializers.CharField(source='get_tenure_type_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    department_name = serializers.CharField(source='department.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True, default='')
    supplier_name = serializers.CharField(source='linked_supplier.name', read_only=True, default='')
    supplier_invoice_number = serializers.CharField(source='linked_supplier_invoice.invoice_number', read_only=True, default='')
    
    payments = LiabilityPaymentRecordSerializer(many=True, read_only=True)
    documents = LiabilityDocumentSerializer(many=True, read_only=True)
    audit_logs = LiabilityAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = HospitalLiability
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'liability_number',
            'outstanding_amount', 'paid_amount', 'created_by'
        ]


class BudgetPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetPlan
        fields = '__all__'


# ==============================================================================
# SECTION 13: FINANCIAL ACCOUNTS SERIALIZERS
# ==============================================================================

class FinancialAccountSerializer(serializers.ModelSerializer):
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    classification_display = serializers.CharField(source='get_classification_display', read_only=True)
    reconciliation_status_display = serializers.CharField(source='get_reconciliation_status_display', read_only=True)
    masked_account_number = serializers.CharField(read_only=True)
    branch_name_display = serializers.CharField(source='branch.name', read_only=True, default='')
    department_name_display = serializers.CharField(source='department.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True, default='')
    calculated_closing_balance = serializers.SerializerMethodField()
    total_debits = serializers.SerializerMethodField()
    total_credits = serializers.SerializerMethodField()
    transaction_count = serializers.SerializerMethodField()

    class Meta:
        model = FinancialAccount
        fields = [
            'id', 'account_code', 'name', 'account_type', 'account_type_display',
            'classification', 'classification_display', 'institution_name',
            'account_holder', 'account_number_raw', 'masked_account_number',
            'branch_name', 'ifsc_code', 'branch', 'branch_name_display',
            'department', 'department_name_display', 'currency',
            'opening_balance', 'opening_balance_date', 'current_balance',
            'calculated_closing_balance', 'total_debits', 'total_credits',
            'transaction_count', 'linked_gl_account', 'legacy_bank_account',
            'is_active', 'reconciliation_status', 'reconciliation_status_display',
            'last_reconciled_at', 'notes', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'calculated_closing_balance', 'total_debits', 'total_credits', 'transaction_count']

    def get_calculated_closing_balance(self, obj):
        calc, _, _ = obj.calculate_balance()
        return str(calc)

    def get_total_debits(self, obj):
        _, debits, _ = obj.calculate_balance()
        return str(debits)

    def get_total_credits(self, obj):
        _, _, credits = obj.calculate_balance()
        return str(credits)

    def get_transaction_count(self, obj):
        return obj.ledger_transactions.filter(posting_status='POSTED').count()

    def validate_account_code(self, value):
        qs = FinancialAccount.objects.filter(account_code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"An account with code '{value}' already exists.")
        return value.upper().strip()

    def validate(self, attrs):
        acc_type = attrs.get('account_type', getattr(self.instance, 'account_type', None))
        inst_name = attrs.get('institution_name', getattr(self.instance, 'institution_name', ''))
        
        if acc_type in [FinancialAccountType.BANK, FinancialAccountType.FIXED_DEPOSIT] and not inst_name:
            raise serializers.ValidationError({'institution_name': 'Bank or financial institution name is required for bank and fixed deposit accounts.'})
        return attrs

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            role = getattr(getattr(user, 'profile', None), 'role', None)
            if role not in ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT']:
                ret['account_number_raw'] = instance.masked_account_number
        else:
            ret['account_number_raw'] = instance.masked_account_number
        return ret


class FinancialTransactionAuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.user_profile.full_name', read_only=True, default='System')
    performed_by_role = serializers.CharField(source='performed_by.user_profile.role.display_name', read_only=True, default='')

    class Meta:
        model = FinancialTransactionAuditLog
        fields = '__all__'


class FinancialAccountTransactionSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.account_code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_type = serializers.CharField(source='account.account_type', read_only=True)
    account_classification = serializers.CharField(source='account.classification', read_only=True)
    destination_account_code = serializers.CharField(source='destination_financial_account.account_code', read_only=True, default='')
    destination_account_name = serializers.CharField(source='destination_financial_account.name', read_only=True, default='')
    branch_name = serializers.CharField(source='branch.name', read_only=True, default='')
    department_name = serializers.CharField(source='department.name', read_only=True, default='')
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    lifecycle_status_display = serializers.CharField(source='get_lifecycle_status_display', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)

    created_by_name = serializers.CharField(source='created_by.user_profile.full_name', read_only=True, default='')
    submitted_by_name = serializers.CharField(source='submitted_by.user_profile.full_name', read_only=True, default='')
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True, default='')
    rejected_by_name = serializers.CharField(source='rejected_by.user_profile.full_name', read_only=True, default='')
    posted_by_name = serializers.CharField(source='posted_by.user_profile.full_name', read_only=True, default='')
    reversed_by_name = serializers.CharField(source='reversed_by.user_profile.full_name', read_only=True, default='')

    reversal_transaction_number = serializers.CharField(source='reversal_of.transaction_number', read_only=True, default='')
    paired_transfer_number = serializers.CharField(source='transfer_paired_transaction.transaction_number', read_only=True, default='')

    audit_logs = FinancialTransactionAuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = FinancialAccountTransaction
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'created_by', 'submitted_by', 'submitted_at',
            'approved_by', 'approved_at', 'rejected_by', 'rejected_at',
            'posted_by', 'posted_at', 'reversed_by', 'reversed_at'
        ]


class BankStatementEntrySerializer(serializers.ModelSerializer):
    reconciliation_status_display = serializers.CharField(source='get_reconciliation_status_display', read_only=True)
    matched_transaction_number = serializers.CharField(source='matched_ledger_transaction.transaction_number', read_only=True, default='')
    matched_transaction_desc = serializers.CharField(source='matched_ledger_transaction.description', read_only=True, default='')
    matched_by_name = serializers.CharField(source='matched_by.user_profile.full_name', read_only=True, default='')

    class Meta:
        model = BankStatementEntry
        fields = '__all__'


class BankStatementImportSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.account_code', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True, default='')
    entries = BankStatementEntrySerializer(many=True, read_only=True)

    class Meta:
        model = BankStatementImport
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'uploaded_at', 'uploaded_by']


class AccountReconciliationSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.account_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user_profile.full_name', read_only=True, default='')
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True, default='')
    batch_number = serializers.CharField(source='statement_import.batch_number', read_only=True, default='')

    class Meta:
        model = AccountReconciliation
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'prepared_at', 'prepared_by', 'approved_at', 'approved_by']


class FinancialAccountDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True, default='')
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = FinancialAccountDocument
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'uploaded_at', 'uploaded_by', 'file_size', 'mime_type']

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None
