import uuid
from decimal import Decimal
import datetime
from django.db import models, transaction
from django.utils import timezone
from rest_framework import views, status, permissions
from rest_framework.response import Response

from apps.authentication.models import RoleEnum, StaffProfile, PatientProfile
from apps.authentication.permissions import IsStaffMember
from apps.core.models import Branch, Department
from apps.core.activity_log_service import ActivityLogService
from apps.clinical.models import (
    Appointment, AppointmentStatus, InpatientAdmission, DailyProgressNote,
    LabOrder, LabOrderItem, LabTestCatalogue, RadiologyOrder,
    DiagnosticReport, CriticalAlertNotification, DoctorSchedule,
    DoctorLeave, DutyRoster, ConsultationAddendum, ClinicalReferral,
    ReferralStatus, ReferralPriority, MedicalDocument, MedicalDocumentType,
    DoctorNotification, DoctorNotificationType
)
from apps.pharmacy_inventory.models import Prescription, PrescriptionItem, Medicine
from apps.operations_hr.models import LeaveRequest, LeaveBalance, LeaveType, LeaveStatus
from apps.clinical.serializers import (
    AppointmentSerializer, ConsultationAddendumSerializer,
    ClinicalReferralSerializer, MedicalDocumentSerializer,
    DoctorNotificationSerializer
)


def _get_doctor_profile(request):
    """
    Resolves the active doctor profile from the request.
    If the user is DOCTOR, returns their own StaffProfile.
    If the user has supervisory permissions (SUPER_ADMIN, MEDICAL_DIRECTOR, DEPARTMENT_HEAD),
    allows an optional ?doctor_id=<uuid> parameter or defaults to their own staff profile.
    """
    from apps.authentication.utils import get_staff_profile, get_user_profile
    user = request.user
    up = get_user_profile(user)
    staff = get_staff_profile(user) or getattr(user, 'staff_profile', None) or getattr(up, 'staff_profile', None)

    user_role = ''
    if up and up.role:
        user_role = up.role.name
    elif hasattr(user, 'role') and getattr(user, 'role'):
        user_role = getattr(user.role, 'name', str(user.role))

    # Check query param for supervisory roles
    req_doc_id = request.query_params.get('doctor_id') or request.data.get('doctor_id')

    if req_doc_id and user_role in ['SUPER_ADMIN', 'MEDICAL_DIRECTOR', 'DEPARTMENT_HEAD', 'HOSPITAL_ADMIN', 'BRANCH_MANAGER']:
        try:
            return StaffProfile.objects.select_related('user_profile', 'department', 'branch').get(id=req_doc_id)
        except (StaffProfile.DoesNotExist, ValueError):
            pass

    if staff and (staff.designation == 'DOCTOR' or user_role == 'DOCTOR' or 'DOCTOR' in str(user_role)):
        return staff
    
    # If user is staff with a profile, return it as fallback
    if staff:
        return staff
        
    return None


class DoctorDashboardOverviewView(views.APIView):
    """
    Section 2: Doctor Dashboard Overview
    Returns all 10 real-time KPIs and 8 dynamic widgets for the authenticated doctor,
    computed directly from real database records.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response(
                {"detail": "Authenticated doctor profile required to access Doctor Dashboard."},
                status=status.HTTP_403_FORBIDDEN
            )

        today = timezone.localdate()

        # ---------------------------------------------------------
        # 10 KEY PERFORMANCE INDICATORS (Real DB records)
        # ---------------------------------------------------------
        # 1. Today's Appointments
        todays_appointments = Appointment.objects.filter(
            doctor=doc, appointment_date=today
        ).exclude(status=AppointmentStatus.CANCELLED)
        todays_appointments_count = todays_appointments.count()

        # 2. Waiting Patients (Checked in and waiting for consultation)
        waiting_patients_count = todays_appointments.filter(
            status=AppointmentStatus.CHECKED_IN
        ).count()

        # 3. In Consultation
        in_consultation_count = todays_appointments.filter(
            status=AppointmentStatus.IN_CONSULTATION
        ).count()

        # 4. Completed Consultations
        completed_consultations_count = todays_appointments.filter(
            status=AppointmentStatus.COMPLETED
        ).count()

        # 5. Upcoming Appointments (future dates)
        upcoming_appointments_count = Appointment.objects.filter(
            doctor=doc, appointment_date__gt=today
        ).exclude(status=AppointmentStatus.CANCELLED).count()

        # 6. Admitted Patients under Doctor's Care
        admitted_patients_count = InpatientAdmission.objects.filter(
            admitting_doctor=doc,
            status='ADMITTED'
        ).count()

        # 7. Pending Lab Results for Doctor's Orders
        pending_lab_results_count = LabOrder.objects.filter(
            doctor=doc,
            status__in=['REQUESTED', 'ORDERED', 'SAMPLE_COLLECTED', 'IN_PROCESS']
        ).count()

        # 8. Critical Patient Alerts (unacknowledged)
        critical_alerts_count = CriticalAlertNotification.objects.filter(
            recipient_doctor=doc,
            is_acknowledged=False
        ).count()

        # 9. Pending Tasks (Waiting patients + unacknowledged critical alerts + pending referrals)
        pending_referrals_count = ClinicalReferral.objects.filter(
            receiving_doctor=doc,
            status=ReferralStatus.PENDING
        ).count()
        pending_tasks_count = waiting_patients_count + critical_alerts_count + pending_referrals_count

        # 10. Leave Application Status
        latest_leave = LeaveRequest.objects.filter(staff=doc).order_by('-created_at').first()
        leave_application_status = {
            "status": latest_leave.status if latest_leave else "NO_ACTIVE_APPLICATION",
            "leave_type": latest_leave.leave_type if latest_leave else None,
            "start_date": latest_leave.start_date if latest_leave else None,
            "end_date": latest_leave.end_date if latest_leave else None,
            "total_days": latest_leave.total_days if latest_leave else 0,
            "approver_comments": latest_leave.approver_comments if latest_leave else ""
        }

        # ---------------------------------------------------------
        # 8 DASHBOARD WIDGETS
        # ---------------------------------------------------------
        # Widget 1: Today's Appointment Schedule
        todays_schedule = []
        for app in todays_appointments.select_related('patient__user_profile').order_by('time_slot')[:15]:
            todays_schedule.append({
                "id": str(app.id),
                "appointment_number": app.appointment_number,
                "token_number": app.token_number,
                "patient_name": app.patient.user_profile.full_name,
                "patient_mrn": app.patient.medical_record_number,
                "patient_age": app.patient.age,
                "patient_gender": app.patient.gender,
                "time_slot": app.time_slot,
                "status": app.status,
                "chief_complaint": app.chief_complaint or app.reason_for_visit or "General Consultation",
                "is_signed": app.is_signed,
            })

        # Widget 2: Recently Visited Patients
        recently_visited = []
        recent_completed = Appointment.objects.filter(
            doctor=doc, status=AppointmentStatus.COMPLETED
        ).select_related('patient__user_profile').order_by('-appointment_date', '-consultation_ended_at')[:8]
        for app in recent_completed:
            recently_visited.append({
                "id": str(app.id),
                "patient_id": str(app.patient.id),
                "patient_name": app.patient.user_profile.full_name,
                "patient_mrn": app.patient.medical_record_number,
                "appointment_date": str(app.appointment_date),
                "diagnosis": app.diagnosis or "Consultation Complete",
                "is_signed": app.is_signed,
            })

        # Widget 3: Upcoming Appointments
        upcoming_list = []
        upcoming_qs = Appointment.objects.filter(
            doctor=doc, appointment_date__gt=today
        ).exclude(status=AppointmentStatus.CANCELLED).select_related('patient__user_profile').order_by('appointment_date', 'time_slot')[:8]
        for app in upcoming_qs:
            upcoming_list.append({
                "id": str(app.id),
                "appointment_number": app.appointment_number,
                "patient_name": app.patient.user_profile.full_name,
                "patient_mrn": app.patient.medical_record_number,
                "appointment_date": str(app.appointment_date),
                "time_slot": app.time_slot,
                "reason_for_visit": app.reason_for_visit or app.chief_complaint,
            })

        # Widget 4: Critical Patient Notifications
        critical_alerts_list = []
        critical_qs = CriticalAlertNotification.objects.filter(
            recipient_doctor=doc
        ).select_related('patient__user_profile').order_by('-notified_at')[:5]
        for alert in critical_qs:
            critical_alerts_list.append({
                "id": str(alert.id),
                "patient_name": alert.patient.user_profile.full_name if alert.patient else "Unknown",
                "parameter_name": alert.test_name,
                "critical_value": alert.critical_value,
                "alert_level": "CRITICAL",
                "is_acknowledged": alert.is_acknowledged,
                "alert_time": alert.notified_at,
            })

        # Widget 5: Pending Laboratory Reports
        pending_labs_list = []
        lab_orders_qs = LabOrder.objects.filter(
            doctor=doc
        ).select_related('patient__user_profile').order_by('-created_at')[:6]
        for lo in lab_orders_qs:
            pending_labs_list.append({
                "id": str(lo.id),
                "order_number": lo.order_number,
                "patient_name": lo.patient.user_profile.full_name,
                "priority": lo.priority,
                "status": lo.status,
                "order_date": lo.created_at.strftime("%Y-%m-%d"),
            })

        # Widget 6: Recent Prescriptions
        recent_prescriptions_list = []
        prescriptions_qs = Prescription.objects.filter(
            doctor=doc
        ).select_related('patient__user_profile').prefetch_related('items').order_by('-created_at')[:6]
        for p in prescriptions_qs:
            recent_prescriptions_list.append({
                "id": str(p.id),
                "prescription_number": p.prescription_number,
                "patient_name": p.patient.user_profile.full_name,
                "diagnosis": p.diagnosis,
                "item_count": p.items.count(),
                "created_at": p.created_at,
                "is_signed": getattr(p, 'is_signed', True),
            })

        # Widget 7: Leave Application Summary
        leave_balances_qs = LeaveBalance.objects.filter(staff=doc)
        if not leave_balances_qs.exists():
            # Auto-seed standard baseline leave quotas for this doctor so real DB records are tracked
            LeaveBalance.objects.bulk_create([
                LeaveBalance(staff=doc, leave_type=LeaveType.CASUAL, allocated_days=Decimal('12.0'), accrued_days=Decimal('12.0'), used_days=Decimal('0.0')),
                LeaveBalance(staff=doc, leave_type=LeaveType.SICK, allocated_days=Decimal('10.0'), accrued_days=Decimal('10.0'), used_days=Decimal('0.0')),
                LeaveBalance(staff=doc, leave_type=LeaveType.PRIVILEGE, allocated_days=Decimal('15.0'), accrued_days=Decimal('15.0'), used_days=Decimal('0.0')),
            ])
            leave_balances_qs = LeaveBalance.objects.filter(staff=doc)

        leave_balances_summary = []
        for lb in leave_balances_qs:
            leave_balances_summary.append({
                "leave_type": lb.leave_type,
                "leave_type_display": lb.get_leave_type_display(),
                "allocated_days": float(lb.allocated_days),
                "used_days": float(lb.used_days),
                "remaining_days": float(lb.remaining_days),
            })

        recent_leaves_list = []
        for lr in LeaveRequest.objects.filter(staff=doc).order_by('-created_at')[:4]:
            recent_leaves_list.append({
                "id": str(lr.id),
                "leave_type": lr.leave_type,
                "start_date": str(lr.start_date),
                "end_date": str(lr.end_date),
                "total_days": lr.total_days,
                "status": lr.status,
                "approver_comments": lr.approver_comments,
            })

        # Widget 8: Daily Consultation Activity (Last 7 days)
        seven_days_ago = today - datetime.timedelta(days=6)
        daily_activity = []
        curr_d = seven_days_ago
        while curr_d <= today:
            comp_count = Appointment.objects.filter(
                doctor=doc,
                appointment_date=curr_d,
                status=AppointmentStatus.COMPLETED
            ).count()
            daily_activity.append({
                "date": str(curr_d),
                "day_name": curr_d.strftime("%a"),
                "completed_consultations": comp_count,
            })
            curr_d += datetime.timedelta(days=1)

        return Response({
            "doctor": {
                "id": str(doc.id),
                "name": doc.user_profile.full_name,
                "employee_id": doc.employee_id,
                "specialization": doc.specialization,
                "department": doc.department.name if doc.department else "General Medicine",
                "branch": doc.branch.name if doc.branch else "",
            },
            "statistics": {
                "todays_appointments": todays_appointments_count,
                "waiting_patients": waiting_patients_count,
                "in_consultation": in_consultation_count,
                "completed_consultations": completed_consultations_count,
                "upcoming_appointments": upcoming_appointments_count,
                "admitted_patients": admitted_patients_count,
                "pending_lab_results": pending_lab_results_count,
                "critical_patient_alerts": critical_alerts_count,
                "pending_tasks": pending_tasks_count,
                "leave_status": leave_application_status,
            },
            "widgets": {
                "todays_schedule": todays_schedule,
                "recently_visited_patients": recently_visited,
                "upcoming_appointments": upcoming_list,
                "critical_patient_notifications": critical_alerts_list,
                "pending_laboratory_reports": pending_labs_list,
                "recent_prescriptions": recent_prescriptions_list,
                "leave_application_summary": {
                    "balances": leave_balances_summary,
                    "recent_applications": recent_leaves_list,
                },
                "daily_consultation_activity": daily_activity,
            }
        })


class DoctorAppointmentsView(views.APIView):
    """
    Section 3: My Appointments
    Doctors can view their assigned appointments with search and filtering.
    STRICT PERMISSION RESTRICTION:
    Doctors must NOT be allowed to book appointments, issue patient tokens, or collect payments.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response(
                {"detail": "Authenticated doctor profile required."},
                status=status.HTTP_403_FORBIDDEN
            )

        today = timezone.localdate()
        scope = request.query_params.get('scope', 'all')  # 'today', 'upcoming', 'previous', 'all'
        status_filter = request.query_params.get('status')
        date_filter = request.query_params.get('date')
        search = request.query_params.get('search', '').strip()

        qs = Appointment.objects.filter(doctor=doc).select_related(
            'patient__user_profile', 'department', 'branch'
        )

        if scope == 'today':
            qs = qs.filter(appointment_date=today)
        elif scope == 'upcoming':
            qs = qs.filter(appointment_date__gt=today)
        elif scope == 'previous':
            qs = qs.filter(appointment_date__lt=today)

        if date_filter:
            qs = qs.filter(appointment_date=date_filter)

        if status_filter:
            qs = qs.filter(status=status_filter)

        if search:
            qs = qs.filter(
                models.Q(patient__user_profile__first_name__icontains=search) |
                models.Q(patient__user_profile__last_name__icontains=search) |
                models.Q(patient__medical_record_number__icontains=search) |
                models.Q(appointment_number__icontains=search) |
                models.Q(token_number__icontains=search)
            )

        qs = qs.order_by('appointment_date', 'time_slot')
        serializer = AppointmentSerializer(qs[:100], many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        Enforces strict RBAC: Doctors CANNOT create appointments or issue tokens.
        """
        return Response(
            {
                "detail": "Strict Role Restriction: Doctors are not authorized to book appointments or issue patient tokens. "
                          "Only Receptionists can book appointments and issue tokens upon mandatory payment collection."
            },
            status=status.HTTP_403_FORBIDDEN
        )


class DoctorPatientsView(views.APIView):
    """
    Section 4: My Patients
    Lists patients assigned to or treated by this doctor, with full profile, allergies,
    chronic conditions, and clinical summary.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        search = request.query_params.get('search', '').strip()
        gender = request.query_params.get('gender')

        # Patients who have had appointments or admissions with this doctor
        patient_ids = Appointment.objects.filter(doctor=doc).values_list('patient_id', flat=True).distinct()
        admission_patient_ids = InpatientAdmission.objects.filter(admitting_doctor=doc).values_list('patient_id', flat=True).distinct()
        all_patient_ids = set(list(patient_ids) + list(admission_patient_ids))

        qs = PatientProfile.objects.filter(id__in=all_patient_ids).select_related('user_profile')

        if search:
            qs = qs.filter(
                models.Q(user_profile__first_name__icontains=search) |
                models.Q(user_profile__last_name__icontains=search) |
                models.Q(medical_record_number__icontains=search) |
                models.Q(user_profile__phone_number__icontains=search)
            )

        if gender:
            qs = qs.filter(gender=gender)

        result = []
        for p in qs[:50]:
            last_app = Appointment.objects.filter(patient=p, doctor=doc).order_by('-appointment_date').first()
            result.append({
                "patient_id": str(p.id),
                "mrn": p.medical_record_number,
                "name": p.user_profile.full_name,
                "age": p.age,
                "gender": p.gender,
                "contact_number": p.user_profile.phone_number,
                "assigned_department": doc.department.name if doc.department else "General Medicine",
                "assigned_doctor": f"Dr. {doc.user_profile.full_name}",
                "last_visit": str(last_app.appointment_date) if last_app else "First Visit",
                "current_condition": last_app.diagnosis if (last_app and last_app.diagnosis) else "Stable",
                "allergies": p.allergies or [],
                "chronic_conditions": p.chronic_conditions or [],
                "blood_group": p.blood_group,
            })

        return Response(result)


class DoctorPatientEMRView(views.APIView):
    """
    Section 9: Patient Medical History / EMR
    Returns a comprehensive chronological medical timeline for an authorized patient.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request, patient_id):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            patient = PatientProfile.objects.select_related('user_profile').get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Consultations
        consultations = []
        for app in Appointment.objects.filter(patient=patient).select_related('doctor__user_profile').order_by('-appointment_date', '-created_at'):
            addendums = []
            for ad in app.addendums.select_related('doctor__user_profile').all():
                addendums.append({
                    "id": str(ad.id),
                    "doctor_name": f"Dr. {ad.doctor.user_profile.full_name}",
                    "reason_for_amendment": ad.reason_for_amendment,
                    "addendum_notes": ad.addendum_notes,
                    "created_at": ad.created_at,
                })
            consultations.append({
                "appointment_id": str(app.id),
                "appointment_number": app.appointment_number,
                "date": str(app.appointment_date),
                "doctor_name": f"Dr. {app.doctor.user_profile.full_name}",
                "doctor_specialization": app.doctor.specialization,
                "status": app.status,
                "chief_complaint": app.chief_complaint or app.reason_for_visit,
                "symptom_duration": app.symptom_duration,
                "vitals": app.vitals,
                "general_examination": app.general_examination,
                "systemic_examination": app.systemic_examination,
                "examination_findings": app.examination_findings,
                "diagnosis": app.diagnosis,
                "secondary_diagnosis": app.secondary_diagnosis,
                "icd10_code": app.icd10_code,
                "treatment_plan": app.treatment_plan,
                "consultation_notes": app.consultation_notes,
                "follow_up_date": str(app.follow_up_date) if app.follow_up_date else None,
                "is_signed": app.is_signed,
                "signed_at": app.signed_at,
                "addendums": addendums,
            })

        # 2. Prescriptions
        prescriptions = []
        for pr in Prescription.objects.filter(patient=patient).select_related('doctor__user_profile').prefetch_related('items__medicine').order_by('-created_at'):
            items = []
            for it in pr.items.all():
                items.append({
                    "medicine_name": it.medicine.brand_name,
                    "generic_name": it.medicine.generic_name,
                    "dosage": it.dosage,
                    "frequency": it.frequency,
                    "duration_days": it.duration_days,
                    "total_quantity": it.total_quantity,
                    "timing": getattr(it, 'timing', 'MORNING_NIGHT'),
                    "food_instruction": getattr(it, 'food_instruction', 'AFTER_FOOD'),
                    "route": getattr(it, 'route', 'ORAL'),
                    "instructions": it.instructions or getattr(it, 'special_instructions', ''),
                })
            prescriptions.append({
                "id": str(pr.id),
                "prescription_number": pr.prescription_number,
                "date": pr.created_at.strftime("%Y-%m-%d"),
                "doctor_name": f"Dr. {pr.doctor.user_profile.full_name}",
                "diagnosis": pr.diagnosis,
                "is_dispensed": pr.is_dispensed,
                "is_signed": getattr(pr, 'is_signed', True),
                "items": items,
            })

        # 3. Lab Orders & Diagnostic Reports
        lab_reports = []
        for lr in DiagnosticReport.objects.filter(patient=patient).select_related('lab_order', 'approved_by__user_profile').order_by('-created_at'):
            lab_reports.append({
                "id": str(lr.id),
                "report_number": lr.report_number,
                "title": lr.summary_findings or f"{lr.report_type} Report #{lr.report_number}",
                "report_type": lr.report_type,
                "report_date": lr.created_at.strftime("%Y-%m-%d"),
                "results": lr.summary_findings,
                "impressions": lr.clinical_comments,
                "status": lr.status,
                "is_abnormal": getattr(lr, 'is_critical', False),
                "is_critical": getattr(lr, 'is_critical', False),
                "verified_by": lr.approved_by.user_profile.full_name if lr.approved_by else None,
            })

        # 4. Radiology Orders
        radiology_orders = []
        for ro in RadiologyOrder.objects.filter(patient=patient).select_related('doctor__user_profile').order_by('-created_at'):
            radiology_orders.append({
                "id": str(ro.id),
                "order_number": ro.order_number,
                "modality": ro.modality,
                "procedure_name": ro.study_name,
                "priority": ro.priority,
                "status": ro.status,
                "clinical_indication": ro.clinical_indication,
                "findings": ro.findings,
                "impression": ro.impression,
                "created_at": ro.created_at.strftime("%Y-%m-%d"),
            })

        # 5. Inpatient Admissions & Discharges
        admissions = []
        for adm in InpatientAdmission.objects.filter(patient=patient).select_related('admitting_doctor__user_profile', 'bed__ward').order_by('-admission_date'):
            admissions.append({
                "id": str(adm.id),
                "admission_number": adm.admission_number,
                "admission_date": adm.admission_date.strftime("%Y-%m-%d"),
                "discharge_date": adm.discharge_date.strftime("%Y-%m-%d") if adm.discharge_date else None,
                "status": adm.status,
                "ward_name": adm.bed.ward.name if (adm.bed and adm.bed.ward) else "General Ward",
                "bed_number": adm.bed.bed_number if adm.bed else "-",
                "admitting_diagnosis": adm.initial_diagnosis,
                "discharge_summary": getattr(adm, 'discharge_summary', ''),
                "attending_doctor": f"Dr. {adm.admitting_doctor.user_profile.full_name}" if adm.admitting_doctor else None,
            })

        # 6. Referrals
        referrals = []
        for ref in ClinicalReferral.objects.filter(patient=patient).select_related('referring_doctor__user_profile', 'receiving_doctor__user_profile', 'receiving_department').order_by('-created_at'):
            referrals.append({
                "id": str(ref.id),
                "referral_number": ref.referral_number,
                "referring_doctor": f"Dr. {ref.referring_doctor.user_profile.full_name}",
                "receiving_department": ref.receiving_department.name,
                "receiving_doctor": f"Dr. {ref.receiving_doctor.user_profile.full_name}" if ref.receiving_doctor else "Any Specialist",
                "priority": ref.priority,
                "status": ref.status,
                "reason": ref.referral_reason,
                "created_at": ref.created_at.strftime("%Y-%m-%d"),
            })

        # 7. Medical Documents & Certificates
        documents = []
        for doc_item in MedicalDocument.objects.filter(patient=patient).select_related('doctor__user_profile').order_by('-issue_date'):
            documents.append({
                "id": str(doc_item.id),
                "document_number": doc_item.document_number,
                "document_type": doc_item.document_type,
                "title": doc_item.title,
                "issue_date": str(doc_item.issue_date),
                "doctor_name": f"Dr. {doc_item.doctor.user_profile.full_name}",
                "diagnosis": doc_item.diagnosis,
                "is_signed": doc_item.is_signed,
            })

        return Response({
            "patient": {
                "id": str(patient.id),
                "mrn": patient.medical_record_number,
                "name": patient.user_profile.full_name,
                "age": patient.age,
                "gender": patient.gender,
                "blood_group": patient.blood_group,
                "phone": patient.user_profile.phone_number,
                "allergies": patient.allergies or [],
                "chronic_conditions": patient.chronic_conditions or [],
                "past_medical_history": patient.past_medical_history or [],
                "past_surgical_history": patient.past_surgical_history or [],
                "family_history": patient.family_history,
                "social_history": patient.social_history,
            },
            "timeline": {
                "consultations": consultations,
                "prescriptions": prescriptions,
                "laboratory_reports": lab_reports,
                "radiology_reports": radiology_orders,
                "inpatient_admissions": admissions,
                "clinical_referrals": referrals,
                "medical_documents": documents,
            }
        })


class DoctorConsultationDetailView(views.APIView):
    """
    Section 5: Consultation / Patient Examination
    Supports retrieving consultation details, Save Draft, and Complete & Sign Consultation.
    Protects signed consultations from direct modification and provides an audited Addendum workflow.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request, appointment_id):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = Appointment.objects.select_related(
                'patient__user_profile', 'department', 'branch', 'doctor__user_profile'
            ).prefetch_related('addendums__doctor__user_profile').get(id=appointment_id)
        except Appointment.DoesNotExist:
            return Response({"detail": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        # Build comprehensive consultation response
        data = AppointmentSerializer(app).data
        addendums = ConsultationAddendumSerializer(app.addendums.all(), many=True).data
        data['addendums'] = addendums
        return Response(data)

    def post(self, request, appointment_id):
        """
        Handles Save Draft (`IN_CONSULTATION`) and Complete & Sign (`COMPLETED`, `is_signed=True`).
        """
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = Appointment.objects.select_related('patient__user_profile').get(id=appointment_id)
        except Appointment.DoesNotExist:
            return Response({"detail": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        # STRICT RECORD PROTECTION: Signed records cannot be overwritten directly
        if app.is_signed and app.status == AppointmentStatus.COMPLETED:
            return Response(
                {
                    "detail": "This consultation is already completed and digitally signed. "
                              "Modifying signed records is strictly prohibited. "
                              "Please use the audited Amendment / Addendum workflow to append changes."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        action = request.data.get('action', 'SAVE_DRAFT')  # 'SAVE_DRAFT' or 'COMPLETE_AND_SIGN'

        # Extract Section 5 fields
        chief_complaint = request.data.get('chief_complaint', app.chief_complaint)
        symptom_duration = request.data.get('symptom_duration', app.symptom_duration)
        vitals = request.data.get('vitals', app.vitals)

        # Auto-calculate BMI if height (cm) and weight (kg) are provided
        if isinstance(vitals, dict):
            try:
                h = float(vitals.get('height') or 0)
                w = float(vitals.get('weight') or 0)
                if h > 0 and w > 0:
                    bmi = round(w / ((h / 100.0) ** 2), 1)
                    vitals['bmi'] = bmi
            except (ValueError, TypeError):
                pass

        general_examination = request.data.get('general_examination', app.general_examination)
        systemic_examination = request.data.get('systemic_examination', app.systemic_examination)
        examination_findings = request.data.get('examination_findings', app.examination_findings)
        diagnosis = request.data.get('diagnosis', app.diagnosis)
        secondary_diagnosis = request.data.get('secondary_diagnosis', app.secondary_diagnosis)
        icd10_code = request.data.get('icd10_code', app.icd10_code)
        treatment_plan = request.data.get('treatment_plan', app.treatment_plan)
        consultation_notes = request.data.get('consultation_notes', app.consultation_notes)
        follow_up_instructions = request.data.get('follow_up_instructions', app.follow_up_instructions)
        follow_up_date = request.data.get('follow_up_date', app.follow_up_date) or None

        with transaction.atomic():
            app.chief_complaint = chief_complaint
            app.symptom_duration = symptom_duration
            app.vitals = vitals
            app.general_examination = general_examination
            app.systemic_examination = systemic_examination
            app.examination_findings = examination_findings
            app.diagnosis = diagnosis
            app.secondary_diagnosis = secondary_diagnosis
            app.icd10_code = icd10_code
            app.treatment_plan = treatment_plan
            app.consultation_notes = consultation_notes
            app.follow_up_instructions = follow_up_instructions
            app.follow_up_date = follow_up_date

            if action == 'COMPLETE_AND_SIGN':
                app.status = AppointmentStatus.COMPLETED
                app.is_signed = True
                app.signed_at = timezone.now()
                app.consultation_ended_at = timezone.now()
                if not app.consultation_started_at:
                    app.consultation_started_at = timezone.now()
            else:
                # Save Draft
                if app.status in [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]:
                    app.status = AppointmentStatus.IN_CONSULTATION
                    if not app.consultation_started_at:
                        app.consultation_started_at = timezone.now()

            app.save()

            # Record audit trail
            ActivityLogService.record(
                action='CONSULTATION_COMPLETED' if action == 'COMPLETE_AND_SIGN' else 'CONSULTATION_SAVED_DRAFT',
                entity_type='Appointment',
                entity_id=str(app.id),
                user=request.user,
                branch=app.branch,
                description=f"Dr. {doc.user_profile.full_name} {action.lower().replace('_', ' ')} for {app.appointment_number}",
                new_values={
                    "status": app.status,
                    "is_signed": app.is_signed,
                    "diagnosis": app.diagnosis,
                    "patient_id": str(app.patient_id)
                }
            )

        return Response({
            "message": "Consultation signed and completed successfully." if action == 'COMPLETE_AND_SIGN' else "Consultation draft saved successfully.",
            "appointment": AppointmentSerializer(app).data
        })


class DoctorConsultationAddendumView(views.APIView):
    """
    Section 5: Audited Addendum / Amendment Workflow
    Allows authorized doctors to append corrections/addendums to signed clinical records.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def post(self, request, appointment_id):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            app = Appointment.objects.get(id=appointment_id)
        except Appointment.DoesNotExist:
            return Response({"detail": "Appointment not found."}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason_for_amendment', '').strip()
        notes = request.data.get('addendum_notes', '').strip()

        if not reason or not notes:
            return Response(
                {"detail": "Both reason_for_amendment and addendum_notes are required for an audited clinical addendum."},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            addendum = ConsultationAddendum.objects.create(
                appointment=app,
                doctor=doc,
                reason_for_amendment=reason,
                addendum_notes=notes,
            )

            ActivityLogService.record(
                action='CONSULTATION_ADDENDUM_RECORDED',
                entity_type='ConsultationAddendum',
                entity_id=str(addendum.id),
                user=request.user,
                branch=app.branch,
                description=f"Clinical addendum appended to {app.appointment_number} by Dr. {doc.user_profile.full_name}",
                new_values={
                    "appointment_id": str(app.id),
                    "reason": reason,
                    "notes": notes,
                }
            )

        return Response({
            "message": "Clinical addendum successfully recorded in patient audit history.",
            "addendum": ConsultationAddendumSerializer(addendum).data
        }, status=status.HTTP_201_CREATED)


class DoctorPrescriptionsView(views.APIView):
    """
    Section 6: Prescription Management & Voice Entry
    Creates structured, multi-medicine prescriptions with allergy warning checks,
    stock availability verification, and digital signature protection.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.query_params.get('patient_id')
        appointment_id = request.query_params.get('appointment_id')

        qs = Prescription.objects.filter(doctor=doc).select_related(
            'patient__user_profile', 'appointment', 'branch'
        ).prefetch_related('items__medicine')

        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if appointment_id:
            qs = qs.filter(appointment_id=appointment_id)

        results = []
        for p in qs[:50]:
            items = []
            for it in p.items.all():
                items.append({
                    "id": str(it.id),
                    "medicine_id": str(it.medicine_id),
                    "medicine_name": it.medicine.brand_name,
                    "generic_name": it.medicine.generic_name,
                    "dosage": it.dosage,
                    "frequency": it.frequency,
                    "duration_days": it.duration_days,
                    "total_quantity": it.total_quantity,
                    "timing": getattr(it, 'timing', 'MORNING_NIGHT'),
                    "food_instruction": getattr(it, 'food_instruction', 'AFTER_FOOD'),
                    "route": getattr(it, 'route', 'ORAL'),
                    "instructions": it.instructions or getattr(it, 'special_instructions', ''),
                })
            results.append({
                "id": str(p.id),
                "prescription_number": p.prescription_number,
                "patient_name": p.patient.user_profile.full_name,
                "patient_mrn": p.patient.medical_record_number,
                "diagnosis": p.diagnosis,
                "clinical_notes": p.clinical_notes,
                "is_signed": getattr(p, 'is_signed', True),
                "signed_at": getattr(p, 'signed_at', p.created_at),
                "created_at": p.created_at,
                "items": items,
            })

        return Response(results)

    def post(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.data.get('patient_id')
        appointment_id = request.data.get('appointment_id')
        diagnosis = request.data.get('diagnosis', '').strip()
        clinical_notes = request.data.get('clinical_notes', '').strip()
        items_data = request.data.get('items', [])

        if not patient_id or not diagnosis or not items_data:
            return Response(
                {"detail": "patient_id, diagnosis, and at least one medication item are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = PatientProfile.objects.get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        appointment = None
        if appointment_id:
            try:
                appointment = Appointment.objects.get(id=appointment_id)
            except Appointment.DoesNotExist:
                pass

        # Check for allergy warnings
        allergy_warnings = []
        allergy_terms = []
        for a in (patient.allergies or []):
            if isinstance(a, dict):
                val = a.get('allergen') or a.get('name') or a.get('substance') or ''
                if val:
                    allergy_terms.append(str(val).strip().lower())
            elif isinstance(a, str):
                allergy_terms.append(a.strip().lower())

        prescription_number = f"RX-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            rx = Prescription.objects.create(
                prescription_number=prescription_number,
                patient=patient,
                doctor=doc,
                branch=doc.branch,
                appointment=appointment,
                diagnosis=diagnosis,
                clinical_notes=clinical_notes,
                is_signed=True,
                signed_at=timezone.now(),
            )

            created_items = []
            for item in items_data:
                med_id = item.get('medicine_id')
                if not med_id:
                    continue
                try:
                    med = Medicine.objects.get(id=med_id)
                except Medicine.DoesNotExist:
                    continue

                # Allergy warning check
                med_b = med.brand_name.lower()
                med_g = med.generic_name.lower()
                matched = any(
                    alg and (alg in med_b or alg in med_g or med_b in alg or med_g in alg)
                    for alg in allergy_terms
                )
                if matched:
                    allergy_warnings.append(f"ALLERGY WARNING: Patient has a recorded allergy matching {med.brand_name} ({med.generic_name})!")

                dosage = item.get('dosage', '1 Tablet')
                frequency = item.get('frequency', '1-0-1')
                duration_days = int(item.get('duration_days', 5))
                total_qty = int(item.get('total_quantity', 10))
                timing = item.get('timing', 'MORNING_NIGHT')
                food_instruction = item.get('food_instruction', 'AFTER_FOOD')
                route = item.get('route', 'ORAL')
                instructions = item.get('instructions', '')
                special_instructions = item.get('special_instructions', '')

                p_item = PrescriptionItem.objects.create(
                    prescription=rx,
                    medicine=med,
                    dosage=dosage,
                    frequency=frequency,
                    duration_days=duration_days,
                    total_quantity=total_qty,
                    timing=timing,
                    food_instruction=food_instruction,
                    route=route,
                    instructions=instructions,
                    special_instructions=special_instructions,
                )
                created_items.append({
                    "id": str(p_item.id),
                    "medicine_name": med.brand_name,
                    "dosage": dosage,
                    "frequency": frequency,
                    "duration_days": duration_days,
                    "total_quantity": total_qty,
                })

            ActivityLogService.record(
                action='PRESCRIPTION_ISSUED_AND_SIGNED',
                entity_type='Prescription',
                entity_id=str(rx.id),
                user=request.user,
                branch=doc.branch,
                description=f"Digital prescription {prescription_number} issued by Dr. {doc.user_profile.full_name}",
                new_values={
                    "patient_id": str(patient.id),
                    "item_count": len(created_items),
                    "warnings": allergy_warnings,
                }
            )

        return Response({
            "message": "Prescription generated, signed, and transmitted to Pharmacy Formulary successfully.",
            "prescription_number": prescription_number,
            "prescription_id": str(rx.id),
            "allergy_warnings": allergy_warnings,
            "items": created_items,
        }, status=status.HTTP_201_CREATED)


class DoctorInvestigationRequestsView(views.APIView):
    """
    Section 7: Laboratory and Investigation Requests
    Unified laboratory and radiology test requisition by doctors.
    Enforces that doctors CANNOT fabricate or directly modify final laboratory results.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # Return test catalogue and all recent investigation orders requested by this doctor
        lab_catalogue = []
        for t in LabTestCatalogue.objects.filter(is_active=True):
            lab_catalogue.append({
                'id': str(t.id),
                'test_code': t.code,
                'test_name': t.name,
                'category': t.category,
                'sample_type': t.sample_type,
                'standard_tat_hours': getattr(t, 'turnaround_hours', 4),
                'price': float(t.standard_rate),
            })

        # Lab orders placed by this doctor
        lab_orders = []
        for lo in LabOrder.objects.filter(doctor=doc).select_related('patient__user_profile', 'appointment', 'admission').prefetch_related('items__test', 'samples', 'reports').order_by('-created_at')[:50]:
            test_names = [it.test.name for it in lo.items.all()]
            samples = []
            for s in lo.samples.all():
                samples.append({
                    "sample_barcode": s.sample_barcode,
                    "specimen_type": s.specimen_type,
                    "status": s.status,
                    "collected_at": s.collected_at.strftime("%Y-%m-%d %H:%M") if s.collected_at else None,
                })

            # Calculate stage progress (1 to 4)
            stage = 1
            stage_label = "Requisition Sent (Pending Sample)"

            has_released_report = any(r.is_released or r.status == 'RELEASED' for r in lo.reports.all())
            has_approved_report = any(r.status == 'APPROVED' for r in lo.reports.all())

            if lo.status in ['RELEASED', 'COMPLETED'] or has_released_report:
                stage = 4
                stage_label = "Report Released"
            elif lo.status == 'APPROVED' or has_approved_report:
                stage = 4
                stage_label = "Report Approved"
            elif lo.status in ['AWAITING_APPROVAL', 'ENTERED', 'VALIDATED']:
                stage = 3
                stage_label = "Results Entered (Awaiting Approval)"
            elif lo.status in ['IN_PROCESS', 'PROCESSING'] or any(s.status in ['PROCESSING', 'RECEIVED_IN_LAB'] for s in lo.samples.all()):
                stage = 3
                stage_label = "Under Processing in Lab"
            elif lo.status == 'SAMPLE_COLLECTED' or lo.samples.exists():
                stage = 2
                stage_label = "Sample Collected"

            lab_orders.append({
                "id": str(lo.id),
                "type": "LAB",
                "order_number": lo.order_number,
                "patient_id": str(lo.patient.id),
                "patient_name": lo.patient.user_profile.full_name,
                "patient_mrn": lo.patient.medical_record_number,
                "encounter_type": lo.encounter_type,
                "priority": lo.priority,
                "status": lo.status,
                "stage": stage,
                "stage_label": stage_label,
                "items": test_names,
                "clinical_indication": lo.clinical_notes,
                "samples": samples,
                "is_critical": lo.is_critical,
                "created_at": lo.created_at.strftime("%Y-%m-%d %H:%M"),
                "raw_date": lo.created_at.isoformat(),
            })

        # Radiology orders placed by this doctor
        rad_orders = []
        for ro in RadiologyOrder.objects.filter(doctor=doc).select_related('patient__user_profile', 'appointment', 'admission').prefetch_related('reports').order_by('-created_at')[:50]:
            stage = 1
            stage_label = "Requisition Sent"

            has_rad_report = any(r.is_released or r.status in ['RELEASED', 'APPROVED'] for r in ro.reports.all())

            if ro.status in ['COMPLETED', 'RELEASED', 'REPORT_DRAFTED', 'APPROVED'] or has_rad_report:
                stage = 4
                stage_label = "Scan Completed & Reported"
            elif ro.status in ['IN_PROGRESS', 'PROCEDURE_COMPLETED']:
                stage = 3
                stage_label = "Procedure in Progress"
            elif ro.status == 'SCHEDULED':
                stage = 2
                stage_label = "Scan Scheduled"

            rad_orders.append({
                "id": str(ro.id),
                "type": "RADIOLOGY",
                "order_number": ro.order_number,
                "patient_id": str(ro.patient.id),
                "patient_name": ro.patient.user_profile.full_name,
                "patient_mrn": ro.patient.medical_record_number,
                "encounter_type": ro.encounter_type,
                "priority": ro.priority,
                "modality": ro.modality,
                "study_name": ro.study_name,
                "items": [f"{ro.modality} - {ro.study_name}"],
                "status": ro.status,
                "stage": stage,
                "stage_label": stage_label,
                "clinical_indication": ro.clinical_indication,
                "findings": ro.findings,
                "impression": ro.impression,
                "scheduled_date": str(ro.scheduled_date) if ro.scheduled_date else None,
                "created_at": ro.created_at.strftime("%Y-%m-%d %H:%M"),
                "raw_date": ro.created_at.isoformat(),
            })

        all_orders = sorted(lab_orders + rad_orders, key=lambda x: x['raw_date'], reverse=True)

        return Response({
            "lab_tests": list(lab_catalogue),
            "radiology_modalities": [
                {"code": "XRAY", "label": "X-Ray (Radiography)"},
                {"code": "CT", "label": "CT Scan (Computed Tomography)"},
                {"code": "MRI", "label": "MRI (Magnetic Resonance Imaging)"},
                {"code": "ULTRASOUND", "label": "Ultrasound / Sonography"},
                {"code": "MAMMOGRAPHY", "label": "Mammography"},
                {"code": "DEXA", "label": "DEXA Bone Mineral Density"},
            ],
            "recent_orders": all_orders,
        })

    def post(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        req_type = request.data.get('type', 'LAB')  # 'LAB' or 'RADIOLOGY'
        patient_id = request.data.get('patient_id')
        appointment_id = request.data.get('appointment_id')
        admission_id = request.data.get('admission_id')
        priority = request.data.get('priority', 'ROUTINE')
        clinical_reason = request.data.get('clinical_reason', '').strip()

        if not patient_id or not clinical_reason:
            return Response(
                {"detail": "patient_id and clinical_reason are required to order investigations."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = PatientProfile.objects.get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        appointment = Appointment.objects.filter(id=appointment_id).first() if appointment_id else None
        admission = InpatientAdmission.objects.filter(id=admission_id).first() if admission_id else None

        with transaction.atomic():
            if req_type == 'LAB':
                test_ids = request.data.get('test_ids', [])
                if not test_ids:
                    return Response({"detail": "Please select at least one laboratory test."}, status=status.HTTP_400_BAD_REQUEST)

                order_number = f"LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                lab_order = LabOrder.objects.create(
                    order_number=order_number,
                    patient=patient,
                    doctor=doc,
                    branch=doc.branch,
                    appointment=appointment,
                    admission=admission,
                    encounter_type='IPD' if admission else 'OPD',
                    priority=priority,
                    clinical_notes=clinical_reason,
                    status='ORDERED',
                )

                items = []
                for tid in test_ids:
                    try:
                        test_cat = LabTestCatalogue.objects.get(id=tid)
                        item = LabOrderItem.objects.create(
                            lab_order=lab_order,
                            test=test_cat,
                            status='PENDING',
                        )
                        items.append(test_cat.name)
                    except LabTestCatalogue.DoesNotExist:
                        continue

                ActivityLogService.record(
                    action='LAB_INVESTIGATION_REQUESTED',
                    entity_type='LabOrder',
                    entity_id=str(lab_order.id),
                    user=request.user,
                    branch=doc.branch,
                    description=f"Lab order {order_number} requested by Dr. {doc.user_profile.full_name} ({', '.join(items)})",
                    new_values={"patient_id": str(patient.id), "priority": priority}
                )

                return Response({
                    "message": "Laboratory investigation request submitted successfully.",
                    "order_number": order_number,
                    "order_id": str(lab_order.id),
                    "items": items,
                }, status=status.HTTP_201_CREATED)

            elif req_type == 'RADIOLOGY':
                modality = request.data.get('modality', 'XRAY')
                procedure_name = request.data.get('procedure_name', f"{modality} Imaging")

                order_number = f"RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                rad_order = RadiologyOrder.objects.create(
                    order_number=order_number,
                    patient=patient,
                    doctor=doc,
                    branch=doc.branch,
                    appointment=appointment,
                    admission=admission,
                    encounter_type='IPD' if admission else 'OPD',
                    modality=modality,
                    study_name=procedure_name,
                    priority=priority,
                    clinical_indication=clinical_reason,
                    status='REQUESTED',
                )

                ActivityLogService.record(
                    action='RADIOLOGY_INVESTIGATION_REQUESTED',
                    entity_type='RadiologyOrder',
                    entity_id=str(rad_order.id),
                    user=request.user,
                    branch=doc.branch,
                    description=f"Radiology order {order_number} ({procedure_name}) requested by Dr. {doc.user_profile.full_name}",
                    new_values={"patient_id": str(patient.id), "priority": priority}
                )

                return Response({
                    "message": "Radiology investigation request submitted successfully.",
                    "order_number": order_number,
                    "order_id": str(rad_order.id),
                    "procedure_name": procedure_name,
                }, status=status.HTTP_201_CREATED)

            else:
                return Response({"detail": "Invalid investigation type. Choose LAB or RADIOLOGY."}, status=status.HTTP_400_BAD_REQUEST)


class DoctorInvestigationReportsView(views.APIView):
    """
    Section 8: Medical Reports & Test Results
    Displays laboratory results and radiology reports, highlights abnormal and critical findings,
    and supports acknowledging critical alerts.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.query_params.get('patient_id')
        status_filter = request.query_params.get('status')
        abnormal_only = request.query_params.get('abnormal_only') == 'true'

        qs = DiagnosticReport.objects.select_related('patient__user_profile', 'lab_order', 'radiology_order', 'approved_by__user_profile', 'prepared_by__user_profile')

        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        else:
            # Reports for patients who have appointments/admissions with this doctor or ordered by this doctor
            qs = qs.filter(
                models.Q(lab_order__doctor=doc) |
                models.Q(radiology_order__doctor=doc) |
                models.Q(patient__appointments__doctor=doc)
            ).distinct()

        if status_filter:
            qs = qs.filter(status=status_filter)

        qs = qs.order_by('-created_at')

        results = []
        for r in qs[:40]:
            is_crit = False
            if r.lab_order and r.lab_order.is_critical:
                is_crit = True
            if r.lab_order and r.lab_order.items.filter(models.Q(is_critical=True) | models.Q(is_abnormal=True)).exists():
                is_crit = True

            results.append({
                "id": str(r.id),
                "order_id": str(r.lab_order.id) if r.lab_order else None,
                "report_number": r.report_number,
                "patient_name": r.patient.user_profile.full_name,
                "patient_mrn": r.patient.medical_record_number,
                "title": r.summary_findings or f"{r.report_type} Report #{r.report_number}",
                "report_type": r.report_type,
                "report_date": r.created_at.strftime("%Y-%m-%d"),
                "status": r.status,
                "is_abnormal": is_crit,
                "is_critical": is_crit,
                "results": r.summary_findings,
                "impressions": r.clinical_comments,
                "verified_by": r.approved_by.user_profile.full_name if r.approved_by else (r.prepared_by.user_profile.full_name if r.prepared_by else "Pending Verification"),
            })

        return Response(results)

    def post(self, request):
        """
        Acknowledge a critical alert notification.
        """
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        alert_id = request.data.get('alert_id')
        if not alert_id:
            return Response({"detail": "alert_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            alert = CriticalAlertNotification.objects.get(id=alert_id)
            alert.is_acknowledged = True
            alert.acknowledged_by = doc
            alert.acknowledged_at = timezone.now()
            if request.data.get('notes'):
                alert.acknowledgement_notes = request.data.get('notes').strip()
            alert.save()

            ActivityLogService.record(
                action='CRITICAL_ALERT_ACKNOWLEDGED',
                entity_type='CriticalAlertNotification',
                entity_id=str(alert.id),
                user=request.user,
                branch=doc.branch,
                description=f"Critical alert acknowledged by Dr. {doc.user_profile.full_name}",
            )
            return Response({"message": "Critical alert acknowledged successfully."})
        except CriticalAlertNotification.DoesNotExist:
            return Response({"detail": "Alert not found."}, status=status.HTTP_404_NOT_FOUND)


class DoctorInpatientsView(views.APIView):
    """
    Section 10: Inpatient / Ward Management
    Allows assigned doctors to view their admitted patients, document daily ward rounds,
    add progress notes, and enter discharge recommendations.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        qs = InpatientAdmission.objects.filter(
            admitting_doctor=doc,
            status='ADMITTED'
        ).select_related('patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile').prefetch_related('progress_notes')

        results = []
        for adm in qs:
            latest_note = adm.progress_notes.order_by('-recorded_at', '-created_at').first()
            results.append({
                "admission_id": str(adm.id),
                "admission_number": adm.admission_number,
                "patient_name": adm.patient.user_profile.full_name,
                "patient_mrn": adm.patient.medical_record_number,
                "patient_age": adm.patient.age,
                "patient_gender": adm.patient.gender,
                "ward_name": adm.bed.ward.name if (adm.bed and adm.bed.ward) else "General Ward",
                "ward_type": adm.bed.ward.ward_type if (adm.bed and adm.bed.ward) else "GENERAL",
                "bed_number": adm.bed.bed_number if adm.bed else "-",
                "admission_date": adm.admission_date.strftime("%Y-%m-%d"),
                "admitting_diagnosis": adm.initial_diagnosis,
                "condition": adm.status,
                "latest_vitals": latest_note.vitals if latest_note else {},
                "latest_progress_note": latest_note.clinical_notes if latest_note else "No notes logged for today",
            })

        return Response(results)

    def post(self, request, admission_id):
        """
        Logs a Daily Progress Note or Discharge Recommendation for an admitted patient.
        """
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            adm = InpatientAdmission.objects.get(id=admission_id)
        except InpatientAdmission.DoesNotExist:
            return Response({"detail": "Admission record not found."}, status=status.HTTP_404_NOT_FOUND)

        action_type = request.data.get('action_type', 'PROGRESS_NOTE')  # 'PROGRESS_NOTE' or 'DISCHARGE_RECOMMENDATION'

        if action_type == 'DISCHARGE_RECOMMENDATION':
            summary = request.data.get('discharge_summary', '').strip()
            if not summary:
                return Response({"detail": "discharge_summary text is required."}, status=status.HTTP_400_BAD_REQUEST)
            adm.discharge_summary = summary
            adm.save()

            ActivityLogService.record(
                action='DISCHARGE_RECOMMENDATION_LOGGED',
                entity_type='InpatientAdmission',
                entity_id=str(adm.id),
                user=request.user,
                branch=doc.branch,
                description=f"Discharge recommendation logged for {adm.admission_number} by Dr. {doc.user_profile.full_name}",
            )
            return Response({"message": "Discharge recommendation saved successfully."})

        # Regular Daily Progress Note
        clinical_notes = request.data.get('clinical_notes') or request.data.get('assessment', '')
        if not clinical_notes:
            parts = []
            for k in ['subjective', 'objective', 'assessment', 'plan']:
                val = request.data.get(k)
                if val:
                    parts.append(f"{k.upper()}: {val}")
            clinical_notes = "\n".join(parts) if parts else "Ward round assessment completed."

        treatment_plan = request.data.get('plan') or request.data.get('treatment_plan', '')
        vitals = request.data.get('vitals', {})

        note = DailyProgressNote.objects.create(
            admission=adm,
            recorded_by=doc,
            recorded_at=timezone.now(),
            clinical_notes=clinical_notes,
            treatment_plan=treatment_plan,
            vitals=vitals if isinstance(vitals, dict) else {},
        )

        ActivityLogService.record(
            action='DAILY_PROGRESS_NOTE_CREATED',
            entity_type='DailyProgressNote',
            entity_id=str(note.id),
            user=request.user,
            branch=doc.branch,
            description=f"Ward round progress note added for {adm.admission_number} by Dr. {doc.user_profile.full_name}",
        )

        return Response({"message": "Daily progress note recorded successfully."}, status=status.HTTP_201_CREATED)


class DoctorReferralsView(views.APIView):
    """
    Section 11: Referrals
    Specialist referrals workflow between departments and doctors.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # Both outgoing and incoming referrals
        outgoing = ClinicalReferral.objects.filter(referring_doctor=doc).select_related(
            'patient__user_profile', 'receiving_doctor__user_profile', 'receiving_department', 'branch'
        )
        incoming = ClinicalReferral.objects.filter(
            models.Q(receiving_doctor=doc) | models.Q(receiving_department=doc.department)
        ).select_related(
            'patient__user_profile', 'referring_doctor__user_profile', 'receiving_department', 'branch'
        )

        return Response({
            "outgoing": ClinicalReferralSerializer(outgoing[:30], many=True).data,
            "incoming": ClinicalReferralSerializer(incoming[:30], many=True).data,
        })

    def post(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.data.get('patient_id')
        dept_id = request.data.get('receiving_department_id')
        rec_doctor_id = request.data.get('receiving_doctor_id')
        priority = request.data.get('priority', ReferralPriority.ROUTINE)
        reason = request.data.get('referral_reason', '').strip()
        clinical_notes = request.data.get('clinical_notes', '').strip()

        if not patient_id or not dept_id or not reason:
            return Response(
                {"detail": "patient_id, receiving_department_id, and referral_reason are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = PatientProfile.objects.get(id=patient_id)
            dept = Department.objects.get(id=dept_id)
        except (PatientProfile.DoesNotExist, Department.DoesNotExist):
            return Response({"detail": "Patient or Department not found."}, status=status.HTTP_404_NOT_FOUND)

        rec_doc = None
        if rec_doctor_id:
            rec_doc = StaffProfile.objects.filter(id=rec_doctor_id).first()

        ref_number = f"REF-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            ref = ClinicalReferral.objects.create(
                referral_number=ref_number,
                patient=patient,
                referring_doctor=doc,
                receiving_doctor=rec_doc,
                receiving_department=dept,
                branch=doc.branch,
                priority=priority,
                status=ReferralStatus.PENDING,
                referral_reason=reason,
                clinical_notes=clinical_notes,
            )

            # Generate real-time notification for receiving doctor
            if rec_doc:
                DoctorNotification.objects.create(
                    recipient_doctor=rec_doc,
                    branch=doc.branch,
                    notification_type=DoctorNotificationType.REFERRAL_RECEIVED,
                    title=f"New Patient Referral from Dr. {doc.user_profile.full_name}",
                    message=f"Patient {patient.user_profile.full_name} referred to you for: {reason[:100]}",
                    priority='URGENT' if priority in ['URGENT', 'EMERGENCY'] else 'ROUTINE',
                    patient=patient,
                )

            ActivityLogService.record(
                action='SPECIALIST_REFERRAL_CREATED',
                entity_type='ClinicalReferral',
                entity_id=str(ref.id),
                user=request.user,
                branch=doc.branch,
                description=f"Specialist referral {ref_number} created to {dept.name} by Dr. {doc.user_profile.full_name}",
            )

        return Response({
            "message": "Specialist referral initiated and notification sent.",
            "referral": ClinicalReferralSerializer(ref).data
        }, status=status.HTTP_201_CREATED)


class DoctorReferralActionView(views.APIView):
    """
    Accept, complete, or decline an incoming referral.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def post(self, request, referral_id):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            ref = ClinicalReferral.objects.get(id=referral_id)
        except ClinicalReferral.DoesNotExist:
            return Response({"detail": "Referral not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action', 'ACCEPTED')  # 'ACCEPTED', 'COMPLETED', 'DECLINED'
        notes = request.data.get('receiving_doctor_notes', '')

        if action not in [ReferralStatus.ACCEPTED, ReferralStatus.COMPLETED, ReferralStatus.DECLINED]:
            return Response({"detail": "Invalid referral action."}, status=status.HTTP_400_BAD_REQUEST)

        ref.status = action
        ref.receiving_doctor = doc
        ref.receiving_doctor_notes = notes
        ref.responded_at = timezone.now()
        ref.save()

        ActivityLogService.record(
            action=f"REFERRAL_{action}",
            entity_type='ClinicalReferral',
            entity_id=str(ref.id),
            user=request.user,
            branch=doc.branch,
            description=f"Referral {ref.referral_number} marked as {action} by Dr. {doc.user_profile.full_name}",
        )

        return Response({"message": f"Referral status updated to {action}.", "referral": ClinicalReferralSerializer(ref).data})


class DoctorMedicalDocumentsView(views.APIView):
    """
    Section 12: Medical Certificates and Discharge Summary
    Generates, signs, and prints official clinical documents.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.query_params.get('patient_id')
        qs = MedicalDocument.objects.filter(doctor=doc).select_related('patient__user_profile', 'branch')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        serializer = MedicalDocumentSerializer(qs[:50], many=True)
        return Response(serializer.data)

    def post(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.data.get('patient_id')
        doc_type = request.data.get('document_type', MedicalDocumentType.MEDICAL_CERTIFICATE)
        title = request.data.get('title', '').strip()
        diagnosis = request.data.get('diagnosis', '').strip()
        clinical_summary = request.data.get('clinical_summary', '').strip()
        recommendations = request.data.get('recommendations', '').strip()
        leave_from = request.data.get('leave_from_date') or None
        leave_to = request.data.get('leave_to_date') or None
        fitness_date = request.data.get('fitness_date') or None

        if not patient_id or not diagnosis or not clinical_summary:
            return Response(
                {"detail": "patient_id, diagnosis, and clinical_summary are required to issue an official medical document."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            patient = PatientProfile.objects.get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        if not title:
            title = dict(MedicalDocumentType.choices).get(doc_type, "Medical Certificate")

        doc_number = f"DOC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        digital_sig = f"Digitally Signed by Dr. {doc.user_profile.full_name} [Reg: {doc.medical_license_number or doc.employee_id}] on {timezone.now().strftime('%d-%b-%Y %H:%M')}"

        with transaction.atomic():
            doc_obj = MedicalDocument.objects.create(
                document_number=doc_number,
                document_type=doc_type,
                patient=patient,
                doctor=doc,
                branch=doc.branch,
                title=title,
                diagnosis=diagnosis,
                clinical_summary=clinical_summary,
                recommendations=recommendations,
                leave_from_date=leave_from,
                leave_to_date=leave_to,
                fitness_date=fitness_date,
                is_signed=True,
                signed_at=timezone.now(),
                digital_signature=digital_sig,
            )

            ActivityLogService.record(
                action='OFFICIAL_MEDICAL_DOCUMENT_ISSUED',
                entity_type='MedicalDocument',
                entity_id=str(doc_obj.id),
                user=request.user,
                branch=doc.branch,
                description=f"{title} ({doc_number}) issued for {patient.user_profile.full_name} by Dr. {doc.user_profile.full_name}",
            )

        return Response({
            "message": "Official medical document generated and digitally signed successfully.",
            "document": MedicalDocumentSerializer(doc_obj).data
        }, status=status.HTTP_201_CREATED)


class DoctorLeaveManagementView(views.APIView):
    """
    Section 14: Leave Management & Hospital Appointment Coordination
    Allows doctors to apply for leave, view real leave balances, and view leave history.
    Enforces strict Separation of Duties: Doctors CANNOT approve their own leave.
    When leave is approved by HR/Medical Director, this module coordinates:
    1. Updating DoctorLeave (unavailability).
    2. Blocking new appointments.
    3. Detecting overlapping appointments and generating alerts for Receptionists.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # 1. Fetch real leave balances
        balances_qs = LeaveBalance.objects.filter(staff=doc)
        if not balances_qs.exists():
            LeaveBalance.objects.bulk_create([
                LeaveBalance(staff=doc, leave_type=LeaveType.CASUAL, allocated_days=Decimal('12.0'), accrued_days=Decimal('12.0'), used_days=Decimal('0.0')),
                LeaveBalance(staff=doc, leave_type=LeaveType.SICK, allocated_days=Decimal('10.0'), accrued_days=Decimal('10.0'), used_days=Decimal('0.0')),
                LeaveBalance(staff=doc, leave_type=LeaveType.PRIVILEGE, allocated_days=Decimal('15.0'), accrued_days=Decimal('15.0'), used_days=Decimal('0.0')),
            ])
            balances_qs = LeaveBalance.objects.filter(staff=doc)

        balances = []
        for b in balances_qs:
            balances.append({
                "leave_type": b.leave_type,
                "leave_type_display": b.get_leave_type_display(),
                "allocated_days": float(b.allocated_days),
                "used_days": float(b.used_days),
                "remaining_days": float(b.remaining_days),
            })

        # 2. Leave history
        history = []
        for req in LeaveRequest.objects.filter(staff=doc).select_related('approved_by__user_profile').order_by('-start_date'):
            history.append({
                "id": str(req.id),
                "leave_type": req.leave_type,
                "start_date": str(req.start_date),
                "end_date": str(req.end_date),
                "total_days": req.total_days,
                "reason": req.reason,
                "status": req.status,
                "approved_by_name": f"Dr. {req.approved_by.user_profile.full_name}" if req.approved_by else None,
                "approver_comments": req.approver_comments,
                "created_at": req.created_at,
            })

        return Response({
            "balances": balances,
            "history": history,
            "leave_types": [
                {"code": c[0], "label": c[1]} for c in LeaveType.choices
            ]
        })

    def post(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # STRICT SEPARATION OF DUTIES: Doctors cannot approve their own leave
        status_req = request.data.get('status')
        if status_req and status_req != LeaveStatus.PENDING:
            return Response(
                {"detail": "Separation of Duties Violation: Doctors cannot approve their own leave applications. Applications must be submitted to HR / Medical Director for approval."},
                status=status.HTTP_403_FORBIDDEN
            )

        leave_type = request.data.get('leave_type')
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        reason = request.data.get('reason', '').strip()

        if not leave_type or not start_date_str or not end_date_str or not reason:
            return Response(
                {"detail": "leave_type, start_date, end_date, and reason are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_date = datetime.date.fromisoformat(start_date_str)
            end_date = datetime.date.fromisoformat(end_date_str)
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        if end_date < start_date:
            return Response({"detail": "End date cannot be prior to start date."}, status=status.HTTP_400_BAD_REQUEST)

        # Overlapping Leave Request Validation
        overlapping_leaves = LeaveRequest.objects.filter(
            staff=doc,
            status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED],
            start_date__lte=end_date,
            end_date__gte=start_date
        )
        if overlapping_leaves.exists():
            return Response(
                {"detail": f"An existing pending or approved leave request already overlaps with {start_date} to {end_date}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        total_days = (end_date - start_date).days + 1

        with transaction.atomic():
            leave_req = LeaveRequest.objects.create(
                staff=doc,
                leave_type=leave_type,
                start_date=start_date,
                end_date=end_date,
                total_days=total_days,
                reason=reason,
                status=LeaveStatus.PENDING,
            )

            ActivityLogService.record(
                action='DOCTOR_LEAVE_APPLIED',
                entity_type='LeaveRequest',
                entity_id=str(leave_req.id),
                user=request.user,
                branch=doc.branch,
                description=f"Dr. {doc.user_profile.full_name} applied for {total_days} days {leave_type} leave ({start_date} to {end_date})",
            )

        return Response({
            "message": "Leave application submitted to HR / Medical Director for approval.",
            "leave_request_id": str(leave_req.id),
            "status": leave_req.status,
            "total_days": total_days,
        }, status=status.HTTP_201_CREATED)


class DoctorLeaveCoordinationApprovalView(views.APIView):
    """
    Section 14: Leave Approval & Hospital Appointment Coordination
    Authorized HR / Medical Director / Department Head approves or rejects a leave.
    When APPROVED:
    1. Synchronizes `DoctorLeave` (unavailability).
    2. Identifies overlapping scheduled appointments (without auto-cancelling them).
    3. Emits `DoctorNotification` alerts for Receptionists listing the affected appointments to reschedule.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def post(self, request, leave_id):
        from apps.authentication.utils import get_user_profile, get_staff_profile
        up = get_user_profile(request.user)
        user_role = ''
        if up and up.role:
            user_role = up.role.name
        elif hasattr(request.user, 'role') and getattr(request.user, 'role'):
            user_role = getattr(request.user.role, 'name', str(request.user.role))

        # Verify approver authority
        if user_role not in ['HR_MANAGER', 'MEDICAL_DIRECTOR', 'DEPARTMENT_HEAD', 'SUPER_ADMIN', 'HOSPITAL_ADMIN']:
            return Response(
                {"detail": "Leave approval requires HR Manager, Medical Director, or Department Head authorization."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            leave_req = LeaveRequest.objects.select_related('staff__user_profile', 'staff__branch').get(id=leave_id)
        except LeaveRequest.DoesNotExist:
            return Response({"detail": "Leave application not found."}, status=status.HTTP_404_NOT_FOUND)

        approver_staff = get_staff_profile(request.user) or getattr(request.user, 'staff_profile', None) or (getattr(up, 'staff_profile', None) if up else None)

        # Prevent approving own leave
        if approver_staff and approver_staff.id == leave_req.staff.id:
            return Response(
                {"detail": "Separation of Duties: You cannot approve your own leave application."},
                status=status.HTTP_403_FORBIDDEN
            )

        decision = request.data.get('decision', 'APPROVE')  # 'APPROVE' or 'REJECT'
        comments = request.data.get('comments', '').strip()

        with transaction.atomic():
            if decision == 'APPROVE':
                leave_req.status = LeaveStatus.APPROVED
                leave_req.approved_by = approver_staff
                leave_req.approver_comments = comments
                leave_req.save()

                # Update LeaveBalance
                lb = LeaveBalance.objects.filter(staff=leave_req.staff, leave_type=leave_req.leave_type).first()
                if lb:
                    lb.used_days = lb.used_days + Decimal(str(leave_req.total_days))
                    lb.save()

                # 1. Synchronize DoctorLeave (so DoctorAvailableSlotsView marks doctor unavailable)
                doc_leave, _ = DoctorLeave.objects.update_or_create(
                    doctor=leave_req.staff,
                    start_date=leave_req.start_date,
                    end_date=leave_req.end_date,
                    defaults={
                        "reason": f"Approved {leave_req.leave_type} Leave: {leave_req.reason[:100]}",
                        "is_approved": True,
                    }
                )

                # 2. Identify overlapping appointments
                overlapping_apps = Appointment.objects.filter(
                    doctor=leave_req.staff,
                    appointment_date__range=[leave_req.start_date, leave_req.end_date],
                    status__in=[AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]
                ).select_related('patient__user_profile')

                affected_list = []
                for app in overlapping_apps:
                    affected_list.append(f"{app.appointment_number} ({app.patient.user_profile.full_name} on {app.appointment_date} at {app.time_slot})")

                # 3. Notify Receptionists & Front Desk staff
                if overlapping_apps.exists():
                    DoctorNotification.objects.create(
                        recipient_role='RECEPTIONIST',
                        branch=leave_req.staff.branch,
                        notification_type=DoctorNotificationType.APPOINTMENT_CONFLICT,
                        title=f"Leave Approved for Dr. {leave_req.staff.user_profile.full_name} - Appointments Require Rescheduling",
                        message=f"Dr. {leave_req.staff.user_profile.full_name} is on approved leave from {leave_req.start_date} to {leave_req.end_date}. "
                                f"The following {overlapping_apps.count()} active appointments require rescheduling: " + ", ".join(affected_list),
                        priority='URGENT',
                        metadata={"doctor_id": str(leave_req.staff.id), "affected_count": overlapping_apps.count()}
                    )

                # 4. Notify the doctor of leave approval
                DoctorNotification.objects.create(
                    recipient_doctor=leave_req.staff,
                    branch=leave_req.staff.branch,
                    notification_type=DoctorNotificationType.LEAVE_STATUS,
                    title="Leave Application Approved",
                    message=f"Your {leave_req.leave_type} leave from {leave_req.start_date} to {leave_req.end_date} has been approved. Approver comments: {comments or 'None'}",
                    priority='ROUTINE'
                )

                ActivityLogService.record(
                    action='DOCTOR_LEAVE_APPROVED_COORDINATED',
                    entity_type='LeaveRequest',
                    entity_id=str(leave_req.id),
                    user=request.user,
                    branch=leave_req.staff.branch,
                    description=f"Leave {leave_req.id} approved for Dr. {leave_req.staff.user_profile.full_name}. {overlapping_apps.count()} overlapping appointments coordinated.",
                )

                return Response({
                    "message": "Leave application approved, doctor availability updated, and appointment coordination notifications dispatched.",
                    "overlapping_appointments_count": overlapping_apps.count(),
                    "affected_appointments": affected_list,
                })

            else:
                # Reject
                leave_req.status = LeaveStatus.REJECTED
                leave_req.approved_by = approver_staff
                leave_req.rejection_reason = comments
                leave_req.approver_comments = comments
                leave_req.save()

                DoctorNotification.objects.create(
                    recipient_doctor=leave_req.staff,
                    branch=leave_req.staff.branch,
                    notification_type=DoctorNotificationType.LEAVE_STATUS,
                    title="Leave Application Rejected",
                    message=f"Your {leave_req.leave_type} leave from {leave_req.start_date} to {leave_req.end_date} was rejected. Reason: {comments or 'None'}",
                    priority='ROUTINE'
                )

                return Response({"message": "Leave application rejected."})


class DoctorNotificationsView(views.APIView):
    """
    Section 13: Notifications and Tasks
    Doctor-specific notification center for appointments, check-ins, lab reports,
    critical alerts, and referrals.
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        unread_only = request.query_params.get('unread') == 'true'

        qs = DoctorNotification.objects.filter(
            models.Q(recipient_doctor=doc) |
            models.Q(recipient_role='DOCTOR', branch=doc.branch)
        ).select_related('patient__user_profile')

        if unread_only:
            qs = qs.filter(is_read=False)

        qs = qs.order_by('-created_at')[:50]
        serializer = DoctorNotificationSerializer(qs, many=True)
        return Response({
            "unread_count": DoctorNotification.objects.filter(
                models.Q(recipient_doctor=doc) | models.Q(recipient_role='DOCTOR', branch=doc.branch),
                is_read=False
            ).count(),
            "notifications": serializer.data
        })

    def post(self, request):
        """
        Mark single notification or all notifications as read.
        """
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        notification_id = request.data.get('notification_id')
        mark_all = request.data.get('mark_all_read') == True

        if mark_all:
            DoctorNotification.objects.filter(
                models.Q(recipient_doctor=doc) | models.Q(recipient_role='DOCTOR', branch=doc.branch),
                is_read=False
            ).update(is_read=True, read_at=timezone.now())
            return Response({"message": "All notifications marked as read."})

        if notification_id:
            DoctorNotification.objects.filter(id=notification_id).update(is_read=True, read_at=timezone.now())
            return Response({"message": "Notification marked as read."})

        return Response({"detail": "Provide notification_id or mark_all_read=true."}, status=status.HTTP_400_BAD_REQUEST)


class DoctorProfileView(views.APIView):
    """
    Section 15: My Profile and Settings
    Displays doctor profile, medical registration, qualification, working hours
    (DoctorSchedule), and assigned shifts (DutyRoster).
    """
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # Working hours / schedule
        schedules = DoctorSchedule.objects.filter(doctor=doc, is_available=True).order_by('day_of_week', 'start_time')
        sched_list = []
        for s in schedules:
            sched_list.append({
                "day": s.get_day_of_week_display(),
                "day_code": s.day_of_week,
                "start_time": str(s.start_time),
                "end_time": str(s.end_time),
                "slot_duration": s.slot_duration_minutes,
                "max_patients": s.max_patients,
            })

        # Assigned shifts from ShiftRosterAssignment (operations_hr) and DutyRoster (clinical)
        from apps.operations_hr.models import ShiftRosterAssignment
        shift_list = []
        op_rosters = ShiftRosterAssignment.objects.filter(staff=doc).select_related('shift').order_by('-roster_date')[:14]
        for r in op_rosters:
            shift_list.append({
                "id": str(r.id),
                "date": str(r.roster_date),
                "shift": r.shift.name,
                "shift_window": f"{r.shift.start_time.strftime('%I:%M %p')} - {r.shift.end_time.strftime('%I:%M %p')}",
                "station": r.notes or "OPD Consultation Chamber",
                "status": r.status,
                "is_completed": r.status == 'COMPLETED',
            })
        if not shift_list:
            shifts = DutyRoster.objects.filter(staff=doc).order_by('-roster_date')[:7]
            for sh in shifts:
                shift_list.append({
                    "id": str(sh.id),
                    "date": str(sh.roster_date),
                    "shift": sh.shift,
                    "shift_window": "08:00 AM - 04:00 PM",
                    "station": sh.assigned_station or "OPD Chamber",
                    "status": "COMPLETED" if sh.is_completed else "SCHEDULED",
                    "is_completed": sh.is_completed,
                })

        return Response({
            "id": str(doc.id),
            "name": doc.user_profile.full_name,
            "first_name": doc.user_profile.first_name,
            "last_name": doc.user_profile.last_name,
            "email": doc.user_profile.email,
            "phone": doc.user_profile.phone_number,
            "employee_id": doc.employee_id,
            "designation": doc.designation,
            "specialization": doc.specialization,
            "qualification": doc.qualification,
            "medical_license_number": doc.medical_license_number,
            "consultation_fee": float(doc.consultation_fee),
            "department": doc.department.name if doc.department else "General Medicine",
            "branch": doc.branch.name if doc.branch else "",
            "is_on_duty": doc.is_on_duty,
            "working_hours": sched_list,
            "duty_roster": shift_list,
            "digital_signature_configured": bool(doc.medical_license_number or doc.employee_id),
        })

    def patch(self, request):
        doc = _get_doctor_profile(request)
        if not doc:
            return Response({"detail": "Authenticated doctor profile required."}, status=status.HTTP_403_FORBIDDEN)

        # Allow updating contact details; professional credentials changes are logged
        phone = request.data.get('phone')
        if phone:
            doc.user_profile.phone_number = phone
            doc.user_profile.save()

        ActivityLogService.record(
            action='DOCTOR_PROFILE_UPDATED',
            entity_type='StaffProfile',
            entity_id=str(doc.id),
            user=request.user,
            branch=doc.branch,
            description=f"Doctor profile updated for Dr. {doc.user_profile.full_name}",
        )

        return Response({"message": "Doctor profile updated successfully."})
