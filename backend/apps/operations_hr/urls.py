from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    StaffManagementViewSet, HospitalShiftViewSet, ShiftRosterAssignmentViewSet,
    EmployeeAttendanceViewSet, LeaveBalanceViewSet, HospitalHolidayViewSet,
    LeaveRequestViewSet, ApproveLeaveView, SalaryStructureViewSet,
    PayrollPeriodViewSet, PayslipViewSet, FixedAssetViewSet,
    AssetDepreciationScheduleViewSet, EquipmentMaintenanceTaskViewSet,
    OperatingTheatreSuiteViewSet, OperationTheatreBookingViewSet,
    ICUObservationRecordViewSet, AmbulanceViewSet, AmbulanceDispatchViewSet,
    BloodBankStockViewSet, HousekeepingTaskViewSet, BiomedicalWasteRecordViewSet,
    HRDashboardView, AssetDashboardView, OperationsDashboardView,
    BranchOperationsDashboardView,
    HospitalSettingViewSet, OperationsAnalyticsOverview, AuditLogListView,
    JobVacancyViewSet, JobApplicationViewSet, StaffRequirementRequestViewSet,
    PerformanceAppraisalViewSet, TrainingProgramViewSet, EmployeeTrainingEnrollmentViewSet,
    EmployeeGrievanceViewSet, DepartmentOperationalIssueViewSet,
    ComprehensiveHRDashboardView, DepartmentHeadDashboardView
)

app_name = 'operations_hr'

router = DefaultRouter()
# Employee & Staff
router.register(r'staff-members', StaffManagementViewSet, basename='staff-management')
router.register(r'shifts', HospitalShiftViewSet, basename='shifts')
router.register(r'rosters', ShiftRosterAssignmentViewSet, basename='rosters')
router.register(r'attendance', EmployeeAttendanceViewSet, basename='attendance')

# Leaves & Holidays
router.register(r'leaves', LeaveRequestViewSet, basename='leave-request')
router.register(r'leave-balances', LeaveBalanceViewSet, basename='leave-balance')
router.register(r'holidays', HospitalHolidayViewSet, basename='holidays')

# Payroll
router.register(r'salary-structures', SalaryStructureViewSet, basename='salary-structure')
router.register(r'payroll', PayrollPeriodViewSet, basename='payroll')
router.register(r'payslips', PayslipViewSet, basename='payslips')

# Fixed Assets & Equipment
router.register(r'fixed-assets', FixedAssetViewSet, basename='fixed-assets')
router.register(r'depreciation-schedules', AssetDepreciationScheduleViewSet, basename='depreciation-schedules')
router.register(r'maintenance-tasks', EquipmentMaintenanceTaskViewSet, basename='maintenance-tasks')

# Operation Theatres & ICU
router.register(r'ot-suites', OperatingTheatreSuiteViewSet, basename='ot-suites')
router.register(r'ot-bookings', OperationTheatreBookingViewSet, basename='ot-bookings')
router.register(r'icu-observations', ICUObservationRecordViewSet, basename='icu-observations')

# Operations: Fleet, Blood Bank, Facility
router.register(r'ambulances', AmbulanceViewSet, basename='ambulances')
router.register(r'ambulance-dispatches', AmbulanceDispatchViewSet, basename='ambulance-dispatches')
router.register(r'blood-bank', BloodBankStockViewSet, basename='blood-bank')
router.register(r'housekeeping', HousekeepingTaskViewSet, basename='housekeeping')
router.register(r'biomedical-waste', BiomedicalWasteRecordViewSet, basename='biomedical-waste')

# Settings
router.register(r'settings', HospitalSettingViewSet, basename='hospital-setting')

# Recruitment, Appraisals, Grievances, Workforce Requests (Phase 2-6)
router.register(r'vacancies', JobVacancyViewSet, basename='vacancies')
router.register(r'applications', JobApplicationViewSet, basename='applications')
router.register(r'staff-requirements', StaffRequirementRequestViewSet, basename='staff-requirements')
router.register(r'appraisals', PerformanceAppraisalViewSet, basename='appraisals')
router.register(r'training-programs', TrainingProgramViewSet, basename='training-programs')
router.register(r'training-enrollments', EmployeeTrainingEnrollmentViewSet, basename='training-enrollments')
router.register(r'grievances', EmployeeGrievanceViewSet, basename='grievances')
router.register(r'operational-issues', DepartmentOperationalIssueViewSet, basename='operational-issues')

urlpatterns = [
    path('', include(router.urls)),
    
    # Real-Time Dashboards
    path('dashboards/hr/', HRDashboardView.as_view(), name='dashboard-hr'),
    path('dashboards/comprehensive-hr/', ComprehensiveHRDashboardView.as_view(), name='dashboard-comprehensive-hr'),
    path('dashboards/department-head/', DepartmentHeadDashboardView.as_view(), name='dashboard-department-head'),
    path('dashboards/assets/', AssetDashboardView.as_view(), name='dashboard-assets'),
    path('dashboards/operations/', OperationsDashboardView.as_view(), name='dashboard-operations'),
    path('dashboards/branch-operations/', BranchOperationsDashboardView.as_view(), name='dashboard-branch-operations'),

    # Legacy & Specific routes
    path('leaves/<uuid:pk>/approve/', ApproveLeaveView.as_view(), name='leave-approve'),
    path('analytics/overview/', OperationsAnalyticsOverview.as_view(), name='analytics-overview'),
    path('audit-logs/', AuditLogListView.as_view(), name='audit-logs'),
]
