from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RecordPaymentView,
    BankAccountViewSet, ReconcileBankTransactionView,
    BudgetPlanViewSet
)
from .general_ledger_views import (
    ChartOfAccountViewSet, JournalEntryViewSet,
    FiscalYearViewSet, AccountingPeriodViewSet,
    GeneralLedgerRegisterView, TrialBalanceView, BalanceSheetView,
    ProfitLossView, CashFlowView, CashBankBookView,
    ReceivablesPayablesLedgerView, AutoPostModuleView
)
from .profit_loss_views import (
    ProfitLossDashboardAPIView, ProfitLossDetailedReportAPIView,
    DepartmentProfitabilityAPIView, BranchProfitabilityAPIView,
    ProfitLossDrilldownAPIView, ProfitLossExportCSVView
)
from .cash_flow_views import (
    CashFlowDashboardAPIView, CashFlowActualBreakdownAPIView,
    CashFlowForecastAPIView, ExpectedPatientCollectionsAPIView,
    ExpectedInsuranceReceiptsAPIView, SupplierPaymentScheduleAPIView,
    PayrollTaxScheduleAPIView, LoanRepaymentForecastAPIView,
    InvestmentMaturityForecastAPIView, BudgetVarianceReportAPIView,
    CashFlowExportCSVAPIView, FinancialBudgetViewSet,
    CapitalExpenditurePlanViewSet, MinimumCashThresholdViewSet,
    LiquidityAlertViewSet
)
from .investment_views import InvestmentViewSet
from .loan_liability_views import (
    LoanViewSet, HospitalLiabilityViewSet,
    LoanLiabilityDashboardView, LoanLiabilityReportExportView
)
from .billing_views import (
    CentralBillingViewSet, HospitalServiceViewSet, TariffPlanViewSet,
    HospitalPackageViewSet, PackageSubscriptionViewSet,
    DiscountRequestViewSet, PatientDepositViewSet,
    PaymentReceiptViewSet, PatientCreditNoteViewSet,
    PatientRefundViewSet, CashierShiftViewSet,
    BillingDashboardStatsView
)
from .gateway_views import (
    RazorpayCreateOrderView, RazorpayVerifyPaymentView,
    RazorpayWebhookView, GatewaySettlementViewSet
)
from .insurance_views import (
    InsuranceProviderViewSet, CorporateCustomerViewSet,
    PatientInsuranceCoverageViewSet, EligibilityCheckViewSet,
    PreAuthorizationRequestViewSet, InsuranceClaimViewSet,
    ClaimDocumentViewSet, ClaimQueryViewSet,
    ClaimSettlementViewSet, CorporateInvoiceViewSet,
    InsuranceReceivablesView, InsuranceDashboardStatsView
)
from .financial_account_views import (
    FinancialAccountViewSet, BankStatementViewSet,
    AccountReconciliationViewSet, FinancialDocumentViewSet
)
from .financial_transaction_views import FinancialTransactionViewSet

app_name = 'billing_finance'

router = DefaultRouter()
router.register(r'invoices', CentralBillingViewSet, basename='invoice')
router.register(r'services', HospitalServiceViewSet, basename='hospital-service')
router.register(r'tariffs', TariffPlanViewSet, basename='tariff-plan')
router.register(r'packages', HospitalPackageViewSet, basename='hospital-package')
router.register(r'package-subscriptions', PackageSubscriptionViewSet, basename='package-subscription')
router.register(r'discounts', DiscountRequestViewSet, basename='discount-request')
router.register(r'deposits', PatientDepositViewSet, basename='patient-deposit')
router.register(r'receipts', PaymentReceiptViewSet, basename='payment-receipt')
router.register(r'credit-notes', PatientCreditNoteViewSet, basename='patient-credit-note')
router.register(r'refunds', PatientRefundViewSet, basename='patient-refund')
router.register(r'cashier-shifts', CashierShiftViewSet, basename='cashier-shift')
router.register(r'settlements', GatewaySettlementViewSet, basename='gateway-settlement')

# Section 12 Insurance & Corporate Billing
router.register(r'insurance-providers', InsuranceProviderViewSet, basename='insurance-provider')
router.register(r'corporate-customers', CorporateCustomerViewSet, basename='corporate-customer')
router.register(r'patient-coverages', PatientInsuranceCoverageViewSet, basename='patient-coverage')
router.register(r'eligibility-checks', EligibilityCheckViewSet, basename='eligibility-check')
router.register(r'pre-authorizations', PreAuthorizationRequestViewSet, basename='pre-authorization')
router.register(r'claims', InsuranceClaimViewSet, basename='insurance-claim')
router.register(r'claim-documents', ClaimDocumentViewSet, basename='claim-document')
router.register(r'claim-queries', ClaimQueryViewSet, basename='claim-query')
router.register(r'claim-settlements', ClaimSettlementViewSet, basename='claim-settlement')
router.register(r'corporate-invoices', CorporateInvoiceViewSet, basename='corporate-invoice')
router.register(r'chart-of-accounts', ChartOfAccountViewSet, basename='chart-of-account')
router.register(r'journal-entries', JournalEntryViewSet, basename='journal-entry')
router.register(r'fiscal-years', FiscalYearViewSet, basename='fiscal-year')
router.register(r'accounting-periods', AccountingPeriodViewSet, basename='accounting-period')
router.register(r'bank-accounts', BankAccountViewSet, basename='bank-account')
router.register(r'financial-accounts', FinancialAccountViewSet, basename='financial-account')
router.register(r'financial-transactions', FinancialTransactionViewSet, basename='financial-transaction')
router.register(r'bank-statements', BankStatementViewSet, basename='bank-statement')
router.register(r'reconciliations', AccountReconciliationViewSet, basename='account-reconciliation')
router.register(r'financial-documents', FinancialDocumentViewSet, basename='financial-document')
router.register(r'investments', InvestmentViewSet, basename='investment')
router.register(r'loans', LoanViewSet, basename='loan')
router.register(r'liabilities', HospitalLiabilityViewSet, basename='liability')
router.register(r'budgets', BudgetPlanViewSet, basename='budget')
router.register(r'financial-budgets', FinancialBudgetViewSet, basename='financial-budget')
router.register(r'capex-plans', CapitalExpenditurePlanViewSet, basename='capex-plan')
router.register(r'minimum-cash-thresholds', MinimumCashThresholdViewSet, basename='minimum-cash-threshold')
router.register(r'liquidity-alerts', LiquidityAlertViewSet, basename='liquidity-alert')

urlpatterns = [
    path('loans/dashboard/', LoanLiabilityDashboardView.as_view(), name='loan-liability-dashboard'),
    path('loans/export-csv/', LoanLiabilityReportExportView.as_view(), name='loan-liability-export-csv'),
    path('', include(router.urls)),
    path('dashboard-stats/', BillingDashboardStatsView.as_view(), name='billing-dashboard-stats'),
    path('insurance/dashboard-stats/', InsuranceDashboardStatsView.as_view(), name='insurance-dashboard-stats'),
    path('insurance/receivables/', InsuranceReceivablesView.as_view(), name='insurance-receivables'),
    path('payments/record/', RecordPaymentView.as_view(), name='payment-record'),
    path('gateway/create-order/', RazorpayCreateOrderView.as_view(), name='gateway-create-order'),
    path('gateway/verify/', RazorpayVerifyPaymentView.as_view(), name='gateway-verify-payment'),
    path('gateway/webhook/', RazorpayWebhookView.as_view(), name='gateway-webhook'),
    path('general-ledger/', GeneralLedgerRegisterView.as_view(), name='general-ledger-register'),
    path('trial-balance/', TrialBalanceView.as_view(), name='trial-balance'),
    path('balance-sheet/', BalanceSheetView.as_view(), name='balance-sheet'),
    path('profit-loss/', ProfitLossView.as_view(), name='profit-loss'),
    path('pnl/dashboard/', ProfitLossDashboardAPIView.as_view(), name='pnl-dashboard'),
    path('pnl/report/', ProfitLossDetailedReportAPIView.as_view(), name='pnl-report'),
    path('pnl/departments/', DepartmentProfitabilityAPIView.as_view(), name='pnl-departments'),
    path('pnl/branches/', BranchProfitabilityAPIView.as_view(), name='pnl-branches'),
    path('pnl/drilldown/', ProfitLossDrilldownAPIView.as_view(), name='pnl-drilldown'),
    path('pnl/export-csv/', ProfitLossExportCSVView.as_view(), name='pnl-export-csv'),
    path('cash-flow/dashboard/', CashFlowDashboardAPIView.as_view(), name='cash-flow-dashboard'),
    path('cash-flow/actual-breakdown/', CashFlowActualBreakdownAPIView.as_view(), name='cash-flow-actual-breakdown'),
    path('cash-flow/forecast/', CashFlowForecastAPIView.as_view(), name='cash-flow-forecast'),
    path('cash-flow/patient-collections/', ExpectedPatientCollectionsAPIView.as_view(), name='cash-flow-patient-collections'),
    path('cash-flow/insurance-receipts/', ExpectedInsuranceReceiptsAPIView.as_view(), name='cash-flow-insurance-receipts'),
    path('cash-flow/supplier-schedules/', SupplierPaymentScheduleAPIView.as_view(), name='cash-flow-supplier-schedules'),
    path('cash-flow/supplier-schedules/update-date/', SupplierPaymentScheduleAPIView.as_view(), name='cash-flow-supplier-update-date'),
    path('cash-flow/payroll-tax-schedules/', PayrollTaxScheduleAPIView.as_view(), name='cash-flow-payroll-tax-schedules'),
    path('cash-flow/loan-forecasts/', LoanRepaymentForecastAPIView.as_view(), name='cash-flow-loan-forecasts'),
    path('cash-flow/investment-forecasts/', InvestmentMaturityForecastAPIView.as_view(), name='cash-flow-investment-forecasts'),
    path('cash-flow/budget-variance/', BudgetVarianceReportAPIView.as_view(), name='cash-flow-budget-variance'),
    path('cash-flow/export-csv/', CashFlowExportCSVAPIView.as_view(), name='cash-flow-export-csv'),
    path('cash-flow/', CashFlowView.as_view(), name='cash-flow'),
    path('cash-bank-book/', CashBankBookView.as_view(), name='cash-bank-book'),
    path('receivables-payables-ledger/', ReceivablesPayablesLedgerView.as_view(), name='receivables-payables-ledger'),
    path('auto-post-module/', AutoPostModuleView.as_view(), name='auto-post-module'),
    path('bank-transactions/<uuid:pk>/reconcile/', ReconcileBankTransactionView.as_view(), name='bank-transaction-reconcile'),
]
