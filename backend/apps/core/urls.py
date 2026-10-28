from django.urls import path
from apps.core.views import SystemInfoView, BranchListView
from apps.core.patient_views import (
    PatientDashboardStatsView,
    PatientManagementView,
    PatientDetailView,
    PatientFullEMRView,
    PatientMedicalHistoryView,
    PatientConsentView,
    PatientConsentRevokeView,
    PatientDocumentView,
    PatientDuplicatesView,
    PatientMergeView,
)

app_name = 'core'

urlpatterns = [
    path('info/', SystemInfoView.as_view(), name='system-info'),
    path('branches/', BranchListView.as_view(), name='branch-list'),

    # Section 5: Patient Management & EMR
    path('patients/dashboard-stats/', PatientDashboardStatsView.as_view(), name='patient-dashboard-stats'),
    path('patients/duplicates/', PatientDuplicatesView.as_view(), name='patient-duplicates'),
    path('patients/merge/', PatientMergeView.as_view(), name='patient-merge'),
    path('patients/', PatientManagementView.as_view(), name='patient-management'),
    path('patients/<uuid:pk>/', PatientDetailView.as_view(), name='patient-detail'),
    path('patients/<uuid:pk>/emr/', PatientFullEMRView.as_view(), name='patient-emr'),
    path('patients/<uuid:pk>/medical-history/', PatientMedicalHistoryView.as_view(), name='patient-medical-history'),
    path('patients/<uuid:pk>/consents/', PatientConsentView.as_view(), name='patient-consents'),
    path('patients/<uuid:pk>/consents/<uuid:consent_id>/revoke/', PatientConsentRevokeView.as_view(), name='patient-consent-revoke'),
    path('patients/<uuid:pk>/documents/', PatientDocumentView.as_view(), name='patient-documents'),
]
