from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MedicineViewSet, PrescriptionViewSet,
    SupplierViewSet, PurchaseOrderViewSet, ReceiveGoodsView,
    StockMovementViewSet, HospitalAssetViewSet
)
from .pharmacy_views import (
    PharmacyDashboardStatsView, MedicineBatchViewSet,
    PurchaseRequisitionViewSet, GoodsReceiptNoteViewSet,
    SupplierInvoiceViewSet, PrescriptionDispenseView,
    IPDMedicationIssueView, StockTransferViewSet,
    StockAdjustmentViewSet, PharmacyReturnViewSet,
    StockReconciliationViewSet, InventoryValuationView,
    PharmacyFinancialReportsView, BarcodeLookupView,
    LowStockReorderAlertsView
)

from .procurement_views import (
    SupplierManagementViewSet, ProcurementRequisitionViewSet,
    SupplierQuotationViewSet, ComparativeStatementViewSet,
    ProcurementPurchaseOrderViewSet, SupplierReturnViewSet,
    SupplierCreditNoteViewSet, SupplierPaymentScheduleViewSet,
    SupplierOutstandingBalancesView, VendorPerformanceReportView
)

app_name = 'pharmacy_inventory'

router = DefaultRouter()
router.register(r'medicines', MedicineViewSet, basename='medicine')
router.register(r'batches', MedicineBatchViewSet, basename='medicine-batch')
router.register(r'prescriptions', PrescriptionViewSet, basename='prescription')
router.register(r'suppliers', SupplierManagementViewSet, basename='supplier')
router.register(r'purchase-orders', ProcurementPurchaseOrderViewSet, basename='purchase-order')
router.register(r'requisitions', ProcurementRequisitionViewSet, basename='requisition')
router.register(r'purchase-requisitions', ProcurementRequisitionViewSet, basename='purchase-requisition')
router.register(r'quotations', SupplierQuotationViewSet, basename='supplier-quotation')
router.register(r'comparative-statements', ComparativeStatementViewSet, basename='comparative-statement')
router.register(r'supplier-returns', SupplierReturnViewSet, basename='supplier-return')
router.register(r'credit-notes', SupplierCreditNoteViewSet, basename='supplier-credit-note')
router.register(r'payment-schedules', SupplierPaymentScheduleViewSet, basename='supplier-payment-schedule')
router.register(r'grns', GoodsReceiptNoteViewSet, basename='goods-receipt-note')
router.register(r'supplier-invoices', SupplierInvoiceViewSet, basename='supplier-invoice')
router.register(r'transfers', StockTransferViewSet, basename='stock-transfer')
router.register(r'adjustments', StockAdjustmentViewSet, basename='stock-adjustment')
router.register(r'returns', PharmacyReturnViewSet, basename='pharmacy-return')
router.register(r'reconciliations', StockReconciliationViewSet, basename='stock-reconciliation')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'assets', HospitalAssetViewSet, basename='hospital-asset')

urlpatterns = [
    path('', include(router.urls)),
    path('dashboard-stats/', PharmacyDashboardStatsView.as_view(), name='pharmacy-dashboard-stats'),
    path('dispense/', PrescriptionDispenseView.as_view(), name='pharmacy-dispense'),
    path('ipd-issue/', IPDMedicationIssueView.as_view(), name='pharmacy-ipd-issue'),
    path('valuation/', InventoryValuationView.as_view(), name='pharmacy-valuation'),
    path('financial-reports/', PharmacyFinancialReportsView.as_view(), name='pharmacy-financial-reports'),
    path('barcode-lookup/', BarcodeLookupView.as_view(), name='pharmacy-barcode-lookup'),
    path('reorder-alerts/', LowStockReorderAlertsView.as_view(), name='pharmacy-reorder-alerts'),
    path('outstanding-balances/', SupplierOutstandingBalancesView.as_view(), name='supplier-outstanding-balances'),
    path('vendor-performance/', VendorPerformanceReportView.as_view(), name='vendor-performance-reports'),
    path('purchase-orders/<uuid:pk>/receive/', ReceiveGoodsView.as_view(), name='purchase-order-receive'),
]

