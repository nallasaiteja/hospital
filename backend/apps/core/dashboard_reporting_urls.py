from django.urls import path
from .dashboard_reporting_views import (
    HospitalAdminDashboardView,
    FinanceDashboardView,
    ClinicalDashboardView,
    PharmacyDashboardView,
    DiagnosticsDashboardView,
    InventoryDashboardView,
    BillingDashboardView,
    AccountingDashboardView,
    InvestmentDashboardView,
    DrillDownListView,
    DashboardExportView,
    DatabaseDesignAuditView,
    DatabaseBackupVerificationView,
    IndianComplianceAssessmentView,
)

urlpatterns = [
    # Role-Specific Dashboards
    path('admin/', HospitalAdminDashboardView.as_view(), name='dashboard-admin'),
    path('finance/', FinanceDashboardView.as_view(), name='dashboard-finance'),
    path('clinical/', ClinicalDashboardView.as_view(), name='dashboard-clinical'),
    path('pharmacy/', PharmacyDashboardView.as_view(), name='dashboard-pharmacy'),
    path('diagnostics/', DiagnosticsDashboardView.as_view(), name='dashboard-diagnostics'),
    path('inventory/', InventoryDashboardView.as_view(), name='dashboard-inventory'),
    path('billing/', BillingDashboardView.as_view(), name='dashboard-billing'),
    path('accounting/', AccountingDashboardView.as_view(), name='dashboard-accounting'),
    path('investments/', InvestmentDashboardView.as_view(), name='dashboard-investments'),

    # Granular Drill-Down and Data Export
    path('drill-down/', DrillDownListView.as_view(), name='reports-drill-down'),
    path('export/', DashboardExportView.as_view(), name='reports-export'),

    # Section 22: Database Design & Normalization Audit
    path('database-integrity/', DatabaseDesignAuditView.as_view(), name='reports-database-integrity'),

    # Section 23: Security & Compliance (Backup Verification & Indian Regulations Assessment)
    path('backup-verification/', DatabaseBackupVerificationView.as_view(), name='reports-backup-verification'),
    path('compliance-assessment/', IndianComplianceAssessmentView.as_view(), name='reports-compliance-assessment'),
]
