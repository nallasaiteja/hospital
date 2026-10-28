from django.urls import path
from apps.authentication.views import (
    CurrentUserView,
    PatientProfileInitView,
    StaffProvisioningView,
    StaffDirectoryView,
    RoleListView,
)
from apps.authentication.rbac_views import (
    UserManagementListView,
    UserManagementDetailView,
    RolePermissionsDetailView,
    PermissionsListView,
    FinancialApprovalPolicyView,
    FinancialApprovalRequestView,
    FinancialApprovalActionView,
    SecurityAuditEventsView,
    PasswordRecoveryView,
    MFAStatusView,
)

app_name = 'authentication'

urlpatterns = [
    # Session & Identity
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('patient/profile-init/', PatientProfileInitView.as_view(), name='patient-profile-init'),
    path('staff/provision/', StaffProvisioningView.as_view(), name='staff-provision'),
    path('staff/', StaffDirectoryView.as_view(), name='staff-directory'),
    path('password-recovery/', PasswordRecoveryView.as_view(), name='password-recovery'),
    path('mfa/', MFAStatusView.as_view(), name='mfa-status'),

    # User & Permission Administration
    path('users/', UserManagementListView.as_view(), name='user-list'),
    path('users/<uuid:pk>/', UserManagementDetailView.as_view(), name='user-detail'),
    path('roles/', RoleListView.as_view(), name='role-list'),
    path('roles/<str:pk>/permissions/', RolePermissionsDetailView.as_view(), name='role-permissions'),
    path('permissions/', PermissionsListView.as_view(), name='permissions-list'),

    # Financial Approval Limits & Separation of Duties
    path('financial-policies/', FinancialApprovalPolicyView.as_view(), name='financial-policies-alias'),
    path('financial-approval-policies/', FinancialApprovalPolicyView.as_view(), name='financial-policies'),
    path('financial-approvals/', FinancialApprovalRequestView.as_view(), name='financial-approvals'),
    path('financial-approvals/<uuid:pk>/action/', FinancialApprovalActionView.as_view(), name='financial-approval-action'),

    # Security & Audit History
    path('security-audit-events/', SecurityAuditEventsView.as_view(), name='security-audit-events'),
]
