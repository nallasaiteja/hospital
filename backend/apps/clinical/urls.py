from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AppointmentViewSet, UpdateAppointmentStatusView, RecordConsultationView,
    WardAndBedViewSet, DischargePatientView, SurgicalCaseViewSet,
    LabOrderViewSet, RecordLabResultView, DutyRosterViewSet,
    LabTestCatalogueListView
)
from .opd_views import (
    OPDDashboardStatsView, DoctorAvailableSlotsView,
    DoctorScheduleViewSet, DoctorLeaveViewSet,
    OPDConsultationFeePreviewView, OPDPaymentOrderCreateView,
    OPDPaymentOrderAuthorizeSandboxView, OPDAppointmentReceiptView,
    OPDWalkInRegistrationView, OPDQueueView, OPDQueueActionView,
    OPDConsultationEncounterView, OPDReportsView, OPDLoungeTVView
)
from .voice_views import VoicePrescriptionExtractView
from .nurse_workspace_views import (
    NurseDashboardOverviewView, NursePatientsView, NursePatientUpdateView,
    NursePatientNotesView, NurseMedicationsView, NurseMedicationActionView,
    NurseTasksView, NurseTaskActionView, NurseVitalsView,
    NurseVitalEscalateView, NurseShiftHandoverView, NurseShiftHandoverAcknowledgeView
)
from .doctor_workspace_views import (
    DoctorDashboardOverviewView, DoctorAppointmentsView, DoctorPatientsView,
    DoctorPatientEMRView, DoctorConsultationDetailView, DoctorConsultationAddendumView,
    DoctorPrescriptionsView, DoctorInvestigationRequestsView, DoctorInvestigationReportsView,
    DoctorInpatientsView, DoctorReferralsView, DoctorReferralActionView,
    DoctorMedicalDocumentsView, DoctorLeaveManagementView, DoctorLeaveCoordinationApprovalView,
    DoctorNotificationsView, DoctorProfileView
)
from .ipd_views import (
    EmergencyIPDDashboardStatsView, EmergencyEncounterViewSet,
    EmergencyActionView, InpatientAdmissionViewSet, BedViewSet,
    InpatientAdmissionActionView, PatientTransferView,
    InpatientRunningBillView, BedTurnoverActionView, IPDReportsView
)
from .lab_views import (
    LaboratoryDashboardStatsView, LabTestCatalogueViewSet,
    ExternalDiagnosticProviderViewSet, InvestigationOrderCreateView,
    LabOrderCancelView, LabSampleCollectionView, LabSampleActionView,
    BarcodeLookupView, LabResultEntryView, LabReportApprovalView,
    LabReportReleaseView, LabReportAmendmentView, CriticalAlertsListView,
    CriticalAlertAcknowledgeView, CriticalAlertEscalateView,
    RadiologyWorkflowViewSet, RadiologyScheduleActionView,
    RadiologyCompleteActionView, RadiologyReportActionView,
    DiagnosticReportDetailView, DiagnosticReportDownloadView,
    DiagnosticEquipmentViewSet, EquipmentIngestionView,
    EquipmentSimulatorView, OutsourcedTrackingViewSet,
    OutsourcedDispatchActionView, OutsourcedReceiveResultsView,
    DiagnosticFinancialReportsView, HL7FHIRIntegrationView
)

app_name = 'clinical'

router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet, basename='appointment')
router.register(r'schedules', DoctorScheduleViewSet, basename='doctor-schedule')
router.register(r'leaves', DoctorLeaveViewSet, basename='doctor-leave')
router.register(r'emergency', EmergencyEncounterViewSet, basename='emergency')
router.register(r'admissions', InpatientAdmissionViewSet, basename='admission')
router.register(r'beds', BedViewSet, basename='bed')
router.register(r'surgeries', SurgicalCaseViewSet, basename='surgery')
router.register(r'lab/orders', LabOrderViewSet, basename='lab-order')
router.register(r'lab/catalogue', LabTestCatalogueViewSet, basename='lab-catalogue')
router.register(r'lab/external-providers', ExternalDiagnosticProviderViewSet, basename='lab-external-provider')
router.register(r'lab/equipment', DiagnosticEquipmentViewSet, basename='lab-equipment')
router.register(r'lab/outsourced', OutsourcedTrackingViewSet, basename='lab-outsourced')
router.register(r'radiology/orders', RadiologyWorkflowViewSet, basename='radiology-order')
router.register(r'roster', DutyRosterViewSet, basename='duty-roster')

urlpatterns = [
    # OPD and Queue Management
    path('opd/dashboard-stats/', OPDDashboardStatsView.as_view(), name='opd-dashboard-stats'),
    path('doctors/<uuid:doctor_id>/available-slots/', DoctorAvailableSlotsView.as_view(), name='doctor-available-slots'),
    path('opd/consultation-fee/', OPDConsultationFeePreviewView.as_view(), name='opd-consultation-fee'),
    path('opd/payment-order/', OPDPaymentOrderCreateView.as_view(), name='opd-payment-order'),
    path('opd/payment-order/authorize-sandbox/', OPDPaymentOrderAuthorizeSandboxView.as_view(), name='opd-payment-order-authorize-sandbox'),
    path('opd/walk-in/', OPDWalkInRegistrationView.as_view(), name='opd-walk-in'),
    path('opd/queue/', OPDQueueView.as_view(), name='opd-queue'),
    path('opd/queue/<uuid:pk>/action/', OPDQueueActionView.as_view(), name='opd-queue-action'),
    path('opd/lounge-tv/', OPDLoungeTVView.as_view(), name='opd-lounge-tv'),
    path('opd/reports/', OPDReportsView.as_view(), name='opd-reports'),
    path('appointments/<uuid:pk>/receipt/', OPDAppointmentReceiptView.as_view(), name='appointment-receipt'),

    # Encounter & Consultation Workspace
    path('appointments/<uuid:pk>/encounter/', OPDConsultationEncounterView.as_view(), name='appointment-encounter'),
    path('appointments/<uuid:pk>/finalize-consultation/', OPDConsultationEncounterView.as_view(), name='appointment-finalize-consultation'),
    path('voice-prescription/extract/', VoicePrescriptionExtractView.as_view(), name='voice-prescription-extract'),

    # Section 7: Emergency & IPD Management
    path('ipd/dashboard-stats/', EmergencyIPDDashboardStatsView.as_view(), name='ipd-dashboard-stats'),
    path('emergency/<uuid:pk>/action/', EmergencyActionView.as_view(), name='emergency-action'),
    path('admissions/<uuid:pk>/action/', InpatientAdmissionActionView.as_view(), name='admission-action'),
    path('admissions/<uuid:pk>/running-bill/', InpatientRunningBillView.as_view(), name='admission-running-bill'),
    path('transfers/', PatientTransferView.as_view(), name='patient-transfers'),
    path('beds/<uuid:pk>/action/', BedTurnoverActionView.as_view(), name='bed-action'),
    path('ipd/reports/', IPDReportsView.as_view(), name='ipd-reports'),

    # Section 8: Laboratory and Diagnostic Management
    path('lab/dashboard-stats/', LaboratoryDashboardStatsView.as_view(), name='lab-dashboard-stats'),
    path('lab/orders/create/', InvestigationOrderCreateView.as_view(), name='lab-order-create'),
    path('lab/orders/<uuid:pk>/cancel/', LabOrderCancelView.as_view(), name='lab-order-cancel'),
    path('lab/orders/<uuid:order_id>/collect-sample/', LabSampleCollectionView.as_view(), name='lab-sample-collect'),
    path('lab/samples/<uuid:pk>/action/', LabSampleActionView.as_view(), name='lab-sample-action'),
    path('lab/barcode/<str:barcode>/', BarcodeLookupView.as_view(), name='lab-barcode-lookup'),
    path('lab/items/<uuid:item_id>/enter-result/', LabResultEntryView.as_view(), name='lab-item-enter-result'),
    path('lab/orders/<uuid:order_id>/approve/', LabReportApprovalView.as_view(), name='lab-order-approve'),
    path('lab/orders/<uuid:order_id>/release/', LabReportReleaseView.as_view(), name='lab-order-release'),
    path('lab/orders/<uuid:order_id>/amend/', LabReportAmendmentView.as_view(), name='lab-order-amend'),
    path('lab/critical-alerts/', CriticalAlertsListView.as_view(), name='lab-critical-alerts'),
    path('lab/critical-alerts/<uuid:pk>/acknowledge/', CriticalAlertAcknowledgeView.as_view(), name='lab-critical-alert-ack'),
    path('lab/critical-alerts/<uuid:pk>/escalate/', CriticalAlertEscalateView.as_view(), name='lab-critical-alert-escalate'),
    path('lab/reports/<uuid:pk>/detail/', DiagnosticReportDetailView.as_view(), name='lab-report-detail'),
    path('lab/reports/<uuid:pk>/download/', DiagnosticReportDownloadView.as_view(), name='lab-report-download'),
    path('lab/equipment/ingest/', EquipmentIngestionView.as_view(), name='lab-equipment-ingest'),
    path('lab/equipment/simulate/', EquipmentSimulatorView.as_view(), name='lab-equipment-simulate'),
    path('lab/outsourced/<uuid:pk>/dispatch/', OutsourcedDispatchActionView.as_view(), name='lab-outsourced-dispatch'),
    path('lab/outsourced/<uuid:pk>/receive-results/', OutsourcedReceiveResultsView.as_view(), name='lab-outsourced-receive'),
    path('lab/financial-reports/', DiagnosticFinancialReportsView.as_view(), name='lab-financial-reports'),
    path('lab/orders/<uuid:order_id>/interoperability/', HL7FHIRIntegrationView.as_view(), name='lab-hl7-fhir'),

    # Radiology Specific Endpoints
    path('radiology/orders/<uuid:pk>/schedule/', RadiologyScheduleActionView.as_view(), name='radiology-schedule'),
    path('radiology/orders/<uuid:pk>/complete/', RadiologyCompleteActionView.as_view(), name='radiology-complete'),
    path('radiology/orders/<uuid:pk>/report/', RadiologyReportActionView.as_view(), name='radiology-report'),

    # Doctor Clinical Workspace Endpoints
    path('doctor-workspace/dashboard/', DoctorDashboardOverviewView.as_view(), name='doctor-dashboard'),
    path('doctor-workspace/appointments/', DoctorAppointmentsView.as_view(), name='doctor-appointments'),
    path('doctor-workspace/patients/', DoctorPatientsView.as_view(), name='doctor-patients'),
    path('doctor-workspace/patients/<uuid:patient_id>/emr/', DoctorPatientEMRView.as_view(), name='doctor-patient-emr'),
    path('doctor-workspace/consultations/<uuid:appointment_id>/', DoctorConsultationDetailView.as_view(), name='doctor-consultation-detail'),
    path('doctor-workspace/consultations/<uuid:appointment_id>/addendum/', DoctorConsultationAddendumView.as_view(), name='doctor-consultation-addendum'),
    path('doctor-workspace/prescriptions/', DoctorPrescriptionsView.as_view(), name='doctor-prescriptions'),
    path('doctor-workspace/investigations/', DoctorInvestigationRequestsView.as_view(), name='doctor-investigations'),
    path('doctor-workspace/reports/', DoctorInvestigationReportsView.as_view(), name='doctor-reports'),
    path('doctor-workspace/inpatients/', DoctorInpatientsView.as_view(), name='doctor-inpatients'),
    path('doctor-workspace/inpatients/<uuid:admission_id>/notes/', DoctorInpatientsView.as_view(), name='doctor-inpatient-notes'),
    path('doctor-workspace/referrals/', DoctorReferralsView.as_view(), name='doctor-referrals'),
    path('doctor-workspace/referrals/<uuid:referral_id>/action/', DoctorReferralActionView.as_view(), name='doctor-referral-action'),
    path('doctor-workspace/documents/', DoctorMedicalDocumentsView.as_view(), name='doctor-documents'),
    path('doctor-workspace/leaves/', DoctorLeaveManagementView.as_view(), name='doctor-leaves'),
    path('doctor-workspace/leaves/<uuid:leave_id>/coordinate-approval/', DoctorLeaveCoordinationApprovalView.as_view(), name='doctor-leave-coordinate-approval'),
    path('doctor-workspace/notifications/', DoctorNotificationsView.as_view(), name='doctor-notifications'),
    path('doctor-workspace/profile/', DoctorProfileView.as_view(), name='doctor-profile'),

    # Nurse Workspace Endpoints
    path('nurse-workspace/overview/', NurseDashboardOverviewView.as_view(), name='nurse-overview'),
    path('nurse-workspace/patients/', NursePatientsView.as_view(), name='nurse-patients'),
    path('nurse-workspace/patients/<uuid:patient_id>/update/', NursePatientUpdateView.as_view(), name='nurse-patient-update'),
    path('nurse-workspace/patients/<uuid:patient_id>/notes/', NursePatientNotesView.as_view(), name='nurse-patient-notes'),
    path('nurse-workspace/medications/', NurseMedicationsView.as_view(), name='nurse-medications'),
    path('nurse-workspace/medications/<uuid:record_id>/action/', NurseMedicationActionView.as_view(), name='nurse-medication-action'),
    path('nurse-workspace/tasks/', NurseTasksView.as_view(), name='nurse-tasks'),
    path('nurse-workspace/tasks/<uuid:task_id>/action/', NurseTaskActionView.as_view(), name='nurse-task-action'),
    path('nurse-workspace/vitals/', NurseVitalsView.as_view(), name='nurse-vitals'),
    path('nurse-workspace/vitals/<uuid:vital_id>/escalate/', NurseVitalEscalateView.as_view(), name='nurse-vital-escalate'),
    path('nurse-workspace/shift-handover/', NurseShiftHandoverView.as_view(), name='nurse-shift-handover'),
    path('nurse-workspace/shift-handover/<uuid:handover_id>/acknowledge/', NurseShiftHandoverAcknowledgeView.as_view(), name='nurse-shift-handover-acknowledge'),

    # General Clinical Endpoints
    path('', include(router.urls)),
    path('wards/', WardAndBedViewSet.as_view({'get': 'list'}), name='ward-list'),
    path('appointments/<uuid:pk>/status/', UpdateAppointmentStatusView.as_view(), name='appointment-status'),
    path('appointments/<uuid:pk>/consultation/', RecordConsultationView.as_view(), name='appointment-consultation'),
    path('admissions/<uuid:pk>/discharge/', DischargePatientView.as_view(), name='admission-discharge'),
    path('lab/tests/', LabTestCatalogueListView.as_view(), name='lab-test-catalogue'),
    path('lab/items/<uuid:pk>/record-result/', RecordLabResultView.as_view(), name='lab-item-result'),
]

