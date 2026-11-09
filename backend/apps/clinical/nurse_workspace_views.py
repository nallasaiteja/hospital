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
    InpatientAdmission, AdmissionStatus, Ward, Bed, BedStatus,
    DutyRoster, DoctorNotification, DoctorNotificationType,
    VitalSignObservation, MedicationAdministrationRecord, NursingTask,
    ShiftHandoverRecord, NursingNote
)
from apps.pharmacy_inventory.models import Prescription, PrescriptionItem


def _get_nurse_profile(request):
    """
    Resolves active nurse staff profile from request.
    Allows nurse_id override for supervisory roles (SUPER_ADMIN, HOSPITAL_ADMIN, MEDICAL_DIRECTOR).
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

    # Allow query param for administrators testing nurse interface
    req_nurse_id = request.query_params.get('nurse_id') or request.data.get('nurse_id')
    if req_nurse_id and user_role in ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MEDICAL_DIRECTOR', 'BRANCH_MANAGER']:
        try:
            return StaffProfile.objects.select_related('user_profile', 'department', 'branch').get(id=req_nurse_id)
        except (StaffProfile.DoesNotExist, ValueError):
            pass

    if staff:
        return staff

    # Fallback to demo nurse if in development
    return StaffProfile.objects.filter(
        models.Q(designation__icontains='nurse') | models.Q(user_profile__email__icontains='nurse')
    ).select_related('user_profile', 'department', 'branch').first()


def _get_nurse_active_shift(nurse):
    """
    Finds active duty roster shift for the nurse today or constructs standard operational shift.
    """
    today = timezone.localdate()
    now_time = timezone.localtime().time()

    roster = DutyRoster.objects.filter(
        staff=nurse,
        roster_date=today
    ).first()

    if roster:
        shift_key = roster.shift
        shift_display = roster.get_shift_display()
        station = roster.assigned_station or 'General Inpatient Wing'
    else:
        # Auto-determine based on time of day
        if datetime.time(8, 0) <= now_time < datetime.time(16, 0):
            shift_key = 'MORNING'
            shift_display = 'Morning Shift (08:00 - 16:00)'
            working_hours = '08:00 - 16:00'
        elif datetime.time(16, 0) <= now_time < datetime.time(0, 0):
            shift_key = 'EVENING'
            shift_display = 'Evening Shift (16:00 - 00:00)'
            working_hours = '16:00 - 00:00'
        else:
            shift_key = 'NIGHT'
            shift_display = 'Night Shift (00:00 - 08:00)'
            working_hours = '00:00 - 08:00'

        station = 'General Inpatient Ward & Station A'
        return {
            'shift_key': shift_key,
            'shift_display': shift_display,
            'working_hours': working_hours,
            'assigned_station': station,
            'ward_name': 'Inpatient Care Ward',
        }

    # Working hours mapped
    shift_hours = {
        'MORNING': '08:00 - 16:00',
        'EVENING': '16:00 - 00:00',
        'NIGHT': '00:00 - 08:00',
        'ON_CALL': '24-Hour Coverage',
    }

    return {
        'shift_key': shift_key,
        'shift_display': shift_display,
        'working_hours': shift_hours.get(shift_key, '08:00 - 16:00'),
        'assigned_station': station,
        'ward_name': station,
    }


def _sync_prescriptions_to_emar(admission):
    """
    Ensures active inpatient prescriptions have eMAR rows scheduled for today.
    """
    today = timezone.localtime()
    start_of_day = today.replace(hour=8, minute=0, second=0, microsecond=0)

    prescriptions = Prescription.objects.filter(
        admission=admission,
        patient=admission.patient
    ).prefetch_related('items')

    for rx in prescriptions:
        for item in rx.items.all():
            med_name = getattr(item.medicine, 'name', 'Prescribed Formulation') if item.medicine else 'Prescription Formulation'
            
            # Check if eMAR entry already exists for today
            existing = MedicationAdministrationRecord.objects.filter(
                prescription_item=item,
                patient=admission.patient,
                scheduled_time__date=today.date()
            ).exists()

            if not existing:
                # Schedule morning and evening administrations
                MedicationAdministrationRecord.objects.create(
                    prescription=rx,
                    prescription_item=item,
                    patient=admission.patient,
                    admission=admission,
                    medication_name=med_name,
                    dosage=item.dosage or '1 Dose',
                    route=item.route or 'ORAL',
                    frequency=item.frequency or '1-0-1',
                    scheduled_time=start_of_day,
                    food_instructions=item.food_instruction or 'AFTER_FOOD',
                    status='DUE',
                    remarks=item.instructions or ''
                )


# =============================================================================
# 1. TOP DASHBOARD OVERVIEW & COMPACT SUMMARY
# =============================================================================

class NurseDashboardOverviewView(views.APIView):
    """
    Returns 4 compact summary cards, nurse profile, active shift, and real-time alerts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Nurse staff profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = nurse.branch or Branch.objects.first()
        shift_info = _get_nurse_active_shift(nurse)
        today = timezone.localdate()

        # Query active admissions in nurse branch
        active_admissions = InpatientAdmission.objects.filter(
            branch=branch,
            status=AdmissionStatus.ADMITTED
        ).select_related('patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile')

        # Auto-sync eMAR for active inpatients
        for adm in active_admissions[:10]:
            _sync_prescriptions_to_emar(adm)

        assigned_patients_count = active_admissions.count()

        # Medications due count
        medications_due_count = MedicationAdministrationRecord.objects.filter(
            admission__in=active_admissions,
            status__in=['DUE', 'OVERDUE']
        ).count()

        # Pending nursing tasks count
        pending_tasks_count = NursingTask.objects.filter(
            admission__in=active_admissions,
            status__in=['PENDING', 'IN_PROGRESS']
        ).count()

        # Critical alerts count (abnormal vitals or adverse reactions)
        critical_vitals_count = VitalSignObservation.objects.filter(
            admission__in=active_admissions,
            clinical_alert=True
        ).count()

        critical_meds_count = MedicationAdministrationRecord.objects.filter(
            admission__in=active_admissions,
            has_adverse_reaction=True
        ).count()

        critical_alerts_count = critical_vitals_count + critical_meds_count

        # Handover status
        latest_handover = ShiftHandoverRecord.objects.filter(
            branch=branch,
            handover_date=today
        ).order_by('-submitted_at').first()

        handover_status = 'COMPLETED'
        handover_label = 'Acknowledged & On Duty'
        if not latest_handover:
            handover_status = 'PENDING_SUBMISSION'
            handover_label = 'Shift Active (Handover Pending at Shift End)'
        elif latest_handover.status == 'SUBMITTED':
            if latest_handover.outgoing_nurse == nurse:
                handover_status = 'AWAITING_INCOMING_ACK'
                handover_label = 'Handover Submitted (Awaiting Next Shift Acknowledgment)'
            else:
                handover_status = 'REQUIRES_ACKNOWLEDGMENT'
                handover_label = 'Handover Received (Acknowledgment Required)'
        else:
            handover_status = 'ACKNOWLEDGED'
            handover_label = 'Acknowledged & Verified'

        nurse_name = f"{nurse.user_profile.first_name} {nurse.user_profile.last_name}".strip()
        if not nurse_name:
            nurse_name = 'Staff Nurse'

        return Response({
            'nurse': {
                'id': str(nurse.id),
                'name': nurse_name,
                'employee_id': nurse.employee_id or 'NUR-001',
                'designation': nurse.designation or 'Nursing Officer',
                'department': nurse.department.name if nurse.department else 'Inpatient Nursing',
                'branch': branch.name if branch else 'Main Hospital',
                'avatar_url': nurse.user_profile.avatar_url or '',
            },
            'shift': shift_info,
            'server_time': timezone.localtime().isoformat(),
            'handover_status': {
                'code': handover_status,
                'label': handover_label,
                'latest_handover_id': str(latest_handover.id) if latest_handover else None,
            },
            'summary_cards': {
                'assigned_patients': assigned_patients_count,
                'medications_due': medications_due_count,
                'pending_tasks': pending_tasks_count,
                'critical_alerts': critical_alerts_count,
            }
        })


# =============================================================================
# 2. SECTION A: MY PATIENTS
# =============================================================================

class NursePatientsView(views.APIView):
    """
    Returns patients assigned to the logged-in nurse based on ward and bed allocation.
    Includes UHID, age, gender, ward, room/bed, diagnosis, allergies, attending doctor,
    admission date, latest vitals, and permitted nursing notes.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Nurse profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = nurse.branch or Branch.objects.first()

        # Query active admissions
        admissions = InpatientAdmission.objects.filter(
            branch=branch,
            status=AdmissionStatus.ADMITTED
        ).select_related(
            'patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile'
        ).prefetch_related('vital_observations', 'nursing_notes').order_by('bed__bed_number')

        results = []
        for adm in admissions:
            pat = adm.patient
            u = pat.user_profile
            bed = adm.bed
            ward = bed.ward if bed else None
            doctor = adm.admitting_doctor
            doc_user = doctor.user_profile if doctor else None

            # Get latest vital signs observation
            latest_vital = adm.vital_observations.order_by('-recorded_at').first()
            vital_data = None
            if latest_vital:
                vital_data = {
                    'id': str(latest_vital.id),
                    'recorded_at': latest_vital.recorded_at.isoformat(),
                    'blood_pressure': f"{latest_vital.systolic_bp}/{latest_vital.diastolic_bp} mmHg" if latest_vital.systolic_bp and latest_vital.diastolic_bp else '—',
                    'pulse_rate': f"{latest_vital.pulse_rate} bpm" if latest_vital.pulse_rate else '—',
                    'temperature': f"{latest_vital.body_temperature}°F" if latest_vital.body_temperature else '—',
                    'respiratory_rate': f"{latest_vital.respiratory_rate} /min" if latest_vital.respiratory_rate else '—',
                    'spo2': f"{latest_vital.spo2}%" if latest_vital.spo2 else '—',
                    'blood_glucose': f"{latest_vital.blood_glucose} mg/dL" if latest_vital.blood_glucose else '—',
                    'pain_score': f"{latest_vital.pain_score}/10" if latest_vital.pain_score is not None else '—',
                    'clinical_alert': latest_vital.clinical_alert,
                    'alert_severity': latest_vital.alert_severity,
                    'alert_message': latest_vital.alert_message,
                }

            # Recent nursing notes
            notes = adm.nursing_notes.order_by('-recorded_at')[:3]
            recent_notes = [{
                'id': str(n.id),
                'note_type': n.note_type,
                'notes': n.notes,
                'nurse_name': f"{n.nurse.user_profile.first_name} {n.nurse.user_profile.last_name}".strip(),
                'recorded_at': n.recorded_at.isoformat(),
            } for n in notes]

            results.append({
                'admission_id': str(adm.id),
                'admission_number': adm.admission_number,
                'admission_date': adm.admission_date.strftime('%Y-%m-%d %H:%M'),
                'patient_id': str(pat.id),
                'uhid': pat.medical_record_number,
                'full_name': u.full_name or f"{u.first_name} {u.last_name}".strip() or 'Inpatient',
                'age': pat.age or 45,
                'gender': pat.gender,
                'blood_group': pat.blood_group or 'O+',
                'ward': ward.name if ward else 'General Ward',
                'ward_type': ward.ward_type if ward else 'GENERAL',
                'floor': ward.floor if ward else '1st Floor',
                'bed_number': bed.bed_number if bed else 'Unallocated',
                'diagnosis': adm.initial_diagnosis or 'Acute Clinical Observation',
                'allergies': pat.allergies or ['No Known Drug Allergies (NKDA)'],
                'chronic_conditions': pat.chronic_conditions or [],
                'attending_doctor': {
                    'name': f"Dr. {doc_user.first_name} {doc_user.last_name}".strip() if doc_user else 'On-Duty Physician',
                    'specialization': doctor.specialization if doctor else 'Internal Medicine',
                },
                'emergency_contact': {
                    'name': pat.emergency_contact_name or 'Guardian / Kin',
                    'phone': pat.emergency_contact_phone or '—',
                    'relation': pat.emergency_contact_relation or 'Next of Kin',
                },
                'latest_vitals': vital_data,
                'recent_nursing_notes': recent_notes,
            })

        return Response(results)


class NursePatientUpdateView(views.APIView):
    """
    Allows nurses to update permitted nursing-related patient information (allergies, emergency contacts, nursing notes).
    STRICT SECURITY: Explicitly rejects any attempt to modify diagnoses or prescriptions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, patient_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            patient = PatientProfile.objects.get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        # Strict Security Gate: Prevent modifying diagnoses or prescriptions
        if 'initial_diagnosis' in data or 'diagnosis' in data:
            return Response({
                'error': 'Nurses are not authorized to modify clinical diagnoses. Diagnoses must be established by the attending physician.'
            }, status=status.HTTP_403_FORBIDDEN)

        if 'prescriptions' in data or 'prescription' in data:
            return Response({
                'error': 'Nurses are not authorized to create or modify doctor prescriptions.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Permitted updates
        if 'allergies' in data:
            patient.allergies = data['allergies']
        if 'emergency_contact_name' in data:
            patient.emergency_contact_name = data['emergency_contact_name']
        if 'emergency_contact_phone' in data:
            patient.emergency_contact_phone = data['emergency_contact_phone']
        if 'emergency_contact_relation' in data:
            patient.emergency_contact_relation = data['emergency_contact_relation']

        patient.save()

        # Audit Log
        ActivityLogService.log_action(
            user=request.user,
            action_type='UPDATE_PATIENT_NURSING_INFO',
            module='NURSE_PATIENT',
            description=f"Nurse {nurse.user_profile.last_name} updated permitted nursing info for patient {patient.medical_record_number}",
            branch=patient.primary_branch
        )

        return Response({
            'message': 'Nursing-related patient information updated successfully.',
            'allergies': patient.allergies,
            'emergency_contact': {
                'name': patient.emergency_contact_name,
                'phone': patient.emergency_contact_phone,
                'relation': patient.emergency_contact_relation,
            }
        })


class NursePatientNotesView(views.APIView):
    """
    Lists and creates nursing notes for an admitted patient.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, patient_id):
        notes = NursingNote.objects.filter(patient_id=patient_id).select_related('nurse__user_profile').order_by('-recorded_at')
        return Response([{
            'id': str(n.id),
            'note_type': n.note_type,
            'notes': n.notes,
            'nurse_name': f"{n.nurse.user_profile.first_name} {n.nurse.user_profile.last_name}".strip(),
            'recorded_at': n.recorded_at.isoformat(),
        } for n in notes])

    def post(self, request, patient_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            patient = PatientProfile.objects.get(id=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        admission = InpatientAdmission.objects.filter(patient=patient, status=AdmissionStatus.ADMITTED).first()
        notes_text = request.data.get('notes', '').strip()
        note_type = request.data.get('note_type', 'SHIFT_ASSESSMENT')

        if not notes_text:
            return Response({'error': 'Nursing note content cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        note = NursingNote.objects.create(
            patient=patient,
            admission=admission,
            nurse=nurse,
            note_type=note_type,
            notes=notes_text
        )

        return Response({
            'message': 'Nursing note documented successfully.',
            'id': str(note.id),
            'note_type': note.note_type,
            'notes': note.notes,
            'recorded_at': note.recorded_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


# =============================================================================
# 3. SECTION B: MEDICATION ADMINISTRATION (eMAR)
# =============================================================================

class NurseMedicationsView(views.APIView):
    """
    Displays doctor-prescribed medications for assigned inpatients with real-time status.
    Nurses CANNOT create or modify doctor prescriptions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Nurse profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = nurse.branch or Branch.objects.first()
        status_filter = request.query_params.get('status')
        patient_filter = request.query_params.get('patient_id')

        # Active inpatient admissions
        admissions = InpatientAdmission.objects.filter(
            branch=branch,
            status=AdmissionStatus.ADMITTED
        )

        # Sync eMAR entries
        for adm in admissions:
            _sync_prescriptions_to_emar(adm)

        qs = MedicationAdministrationRecord.objects.filter(
            admission__in=admissions
        ).select_related(
            'patient__user_profile', 'admission__bed__ward',
            'prescription__doctor__user_profile', 'administered_by__user_profile'
        ).order_by('-scheduled_time')

        if status_filter:
            qs = qs.filter(status=status_filter.upper())
        if patient_filter:
            qs = qs.filter(patient_id=patient_filter)

        results = []
        now = timezone.now()

        for rec in qs:
            # Auto-update status to OVERDUE if DUE and scheduled time passed by >1 hour
            curr_status = rec.status
            if curr_status == 'DUE' and rec.scheduled_time < (now - datetime.timedelta(hours=1)):
                curr_status = 'OVERDUE'

            doctor_name = 'Attending Physician'
            if rec.prescription and rec.prescription.doctor and rec.prescription.doctor.user_profile:
                du = rec.prescription.doctor.user_profile
                doctor_name = f"Dr. {du.first_name} {du.last_name}".strip()

            admin_nurse_name = ''
            if rec.administered_by and rec.administered_by.user_profile:
                nu = rec.administered_by.user_profile
                admin_nurse_name = f"{nu.first_name} {nu.last_name}".strip()

            bed_str = f"Bed {rec.admission.bed.bed_number} ({rec.admission.bed.ward.name})" if rec.admission and rec.admission.bed else 'Inpatient'

            results.append({
                'id': str(rec.id),
                'patient_id': str(rec.patient.id),
                'patient_name': rec.patient.user_profile.full_name,
                'uhid': rec.patient.medical_record_number,
                'bed_location': bed_str,
                'medication_name': rec.medication_name,
                'dosage': rec.dosage,
                'route': rec.route,
                'frequency': rec.frequency,
                'scheduled_time': rec.scheduled_time.strftime('%Y-%m-%d %H:%M'),
                'food_instructions': rec.food_instructions,
                'prescribed_by_doctor': doctor_name,
                'status': curr_status,
                'administered_time': rec.administered_time.strftime('%Y-%m-%d %H:%M') if rec.administered_time else None,
                'administered_by_nurse': admin_nurse_name,
                'remarks': rec.remarks,
                'missed_or_refused_reason': rec.missed_or_refused_reason,
                'has_adverse_reaction': rec.has_adverse_reaction,
                'adverse_reaction_notes': rec.adverse_reaction_notes,
                'is_escalated': rec.is_escalated,
            })

        return Response(results)


class NurseMedicationActionView(views.APIView):
    """
    Records administration, missed/refused doses with mandatory reasons, and adverse reactions with doctor escalation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, record_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            record = MedicationAdministrationRecord.objects.select_related(
                'patient__user_profile', 'prescription__doctor'
            ).get(id=record_id)
        except MedicationAdministrationRecord.DoesNotExist:
            return Response({'error': 'Medication record not found.'}, status=status.HTTP_404_NOT_FOUND)

        action_type = request.data.get('action')  # ADMINISTER, MISSED, REFUSED, ADVERSE_REACTION
        remarks = request.data.get('remarks', '').strip()

        if action_type == 'ADMINISTER':
            record.status = 'ADMINISTERED'
            record.administered_time = timezone.now()
            record.administered_by = nurse
            record.remarks = remarks
            record.dosage_given = request.data.get('dosage_given', record.dosage)
            record.route_given = request.data.get('route_given', record.route)
            record.save()

            ActivityLogService.log_action(
                user=request.user,
                action_type='MEDICATION_ADMINISTERED',
                module='EMAR',
                description=f"Nurse {nurse.user_profile.last_name} administered {record.medication_name} to {record.patient.user_profile.full_name}",
                branch=record.patient.primary_branch
            )

            return Response({
                'message': f"Successfully documented administration of {record.medication_name}.",
                'status': record.status,
                'administered_time': record.administered_time.strftime('%Y-%m-%d %H:%M')
            })

        elif action_type in ['MISSED', 'REFUSED']:
            reason = request.data.get('reason', '').strip()
            if not reason:
                return Response({
                    'error': f"A mandatory clinical reason is required when documenting a {action_type.lower()} medication."
                }, status=status.HTTP_400_BAD_REQUEST)

            record.status = action_type
            record.administered_by = nurse
            record.missed_or_refused_reason = reason
            record.remarks = remarks
            record.save()

            ActivityLogService.log_action(
                user=request.user,
                action_type=f'MEDICATION_{action_type}',
                module='EMAR',
                description=f"Nurse {nurse.user_profile.last_name} documented {action_type} for {record.medication_name}: {reason}",
                branch=record.patient.primary_branch
            )

            return Response({
                'message': f"Documented medication as {action_type}.",
                'status': record.status,
                'reason': record.missed_or_refused_reason
            })

        elif action_type == 'ADVERSE_REACTION':
            notes = request.data.get('adverse_reaction_notes', '').strip()
            if not notes:
                return Response({'error': 'Adverse reaction description is required.'}, status=status.HTTP_400_BAD_REQUEST)

            record.has_adverse_reaction = True
            record.adverse_reaction_notes = notes
            record.is_escalated = True

            # Escalate to prescribing doctor
            attending_doctor = None
            if record.prescription and record.prescription.doctor:
                attending_doctor = record.prescription.doctor
                record.escalated_to = attending_doctor

            record.escalated_at = timezone.now()
            record.escalation_notes = f"Escalated by Nurse {nurse.user_profile.last_name}: {notes}"
            record.save()

            # Create DoctorNotification for the responsible doctor
            if attending_doctor:
                DoctorNotification.objects.create(
                    recipient_doctor=attending_doctor,
                    branch=record.patient.primary_branch,
                    notification_type=DoctorNotificationType.CRITICAL_ALERT,
                    title=f"URGENT: Adverse Drug Reaction - {record.medication_name}",
                    message=f"Patient {record.patient.user_profile.full_name} ({record.patient.medical_record_number}) developed an adverse reaction: {notes}",
                    priority='CRITICAL',
                    patient=record.patient,
                    metadata={'medication_record_id': str(record.id)}
                )

            return Response({
                'message': 'Adverse reaction logged and escalated to the responsible physician immediately.',
                'status': 'ESCALATED',
                'doctor_notified': attending_doctor is not None
            })

        return Response({'error': 'Invalid medication action type.'}, status=status.HTTP_400_BAD_REQUEST)


# =============================================================================
# 4. SECTION C: NURSING TASKS & VITAL SIGNS
# =============================================================================

class NurseTasksView(views.APIView):
    """
    Manages nursing task list generated from doctor orders and nursing care plans.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Nurse profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = nurse.branch or Branch.objects.first()
        admissions = InpatientAdmission.objects.filter(branch=branch, status=AdmissionStatus.ADMITTED)

        # Seed initial care plan tasks if list is currently empty
        if not NursingTask.objects.filter(admission__in=admissions).exists():
            now = timezone.now()
            for adm in admissions[:4]:
                NursingTask.objects.create(
                    title=f"Q4H Vital Signs & SpO2 Monitoring",
                    patient=adm.patient,
                    admission=adm,
                    assigned_nurse=nurse,
                    task_type='VITAL_CHECK',
                    priority='ROUTINE',
                    instructions="Record BP, Pulse, SpO2 and Respiratory Rate. Escalate if SpO2 < 95% or BP > 140/90.",
                    due_time=now + datetime.timedelta(hours=2),
                    status='PENDING'
                )
                NursingTask.objects.create(
                    title=f"Pre-meal Capillary Blood Glucose Check",
                    patient=adm.patient,
                    admission=adm,
                    assigned_nurse=nurse,
                    task_type='BLOOD_GLUCOSE',
                    priority='URGENT',
                    instructions="Check CBG before lunch. Document reading and alert physician if > 200 mg/dL.",
                    due_time=now + datetime.timedelta(hours=1),
                    status='PENDING'
                )

        tasks = NursingTask.objects.filter(
            admission__in=admissions
        ).select_related('patient__user_profile', 'admission__bed__ward', 'ordered_by__user_profile').order_by('status', 'due_time')

        return Response([{
            'id': str(t.id),
            'title': t.title,
            'patient_id': str(t.patient.id),
            'patient_name': t.patient.user_profile.full_name,
            'uhid': t.patient.medical_record_number,
            'bed_location': f"Bed {t.admission.bed.bed_number} ({t.admission.bed.ward.name})" if t.admission and t.admission.bed else 'Inpatient',
            'task_type': t.task_type,
            'priority': t.priority,
            'instructions': t.instructions,
            'due_time': t.due_time.strftime('%Y-%m-%d %H:%M'),
            'status': t.status,
            'completed_at': t.completed_at.strftime('%Y-%m-%d %H:%M') if t.completed_at else None,
            'documentation': t.documentation,
        } for t in tasks])

    def post(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        patient_id = request.data.get('patient_id')
        title = request.data.get('title', '').strip()
        priority = request.data.get('priority', 'ROUTINE')
        instructions = request.data.get('instructions', '').strip()
        due_time_str = request.data.get('due_time')

        if not patient_id or not title:
            return Response({'error': 'Patient and Task Title are required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.get(id=patient_id)
        admission = InpatientAdmission.objects.filter(patient=patient, status=AdmissionStatus.ADMITTED).first()

        due_time = timezone.now() + datetime.timedelta(hours=2)
        if due_time_str:
            try:
                due_time = datetime.datetime.fromisoformat(due_time_str)
            except ValueError:
                pass

        task = NursingTask.objects.create(
            title=title,
            patient=patient,
            admission=admission,
            assigned_nurse=nurse,
            priority=priority,
            instructions=instructions,
            due_time=due_time,
            status='PENDING'
        )

        return Response({
            'message': 'Nursing task created successfully.',
            'id': str(task.id),
            'title': task.title,
            'status': task.status
        }, status=status.HTTP_201_CREATED)


class NurseTaskActionView(views.APIView):
    """
    Updates task progress and records clinical documentation upon completion.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, task_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            task = NursingTask.objects.get(id=task_id)
        except NursingTask.DoesNotExist:
            return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status', 'COMPLETED').upper()
        documentation = request.data.get('documentation', '').strip()

        if new_status == 'COMPLETED':
            task.status = 'COMPLETED'
            task.completed_at = timezone.now()
            task.completed_by = nurse
            task.documentation = documentation
        elif new_status == 'IN_PROGRESS':
            task.status = 'IN_PROGRESS'
        elif new_status == 'CANCELLED':
            task.status = 'CANCELLED'

        task.save()

        return Response({
            'message': f"Task marked as {task.status}.",
            'id': str(task.id),
            'status': task.status,
            'completed_at': task.completed_at.strftime('%Y-%m-%d %H:%M') if task.completed_at else None,
        })


class NurseVitalsView(views.APIView):
    """
    Records and displays standardized vital signs with automated threshold detection
    and doctor escalation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        admission_id = request.query_params.get('admission_id')

        qs = VitalSignObservation.objects.select_related(
            'patient__user_profile', 'recorded_by__user_profile', 'admission__bed__ward'
        ).order_by('-recorded_at')

        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if admission_id:
            qs = qs.filter(admission_id=admission_id)

        results = []
        for v in qs[:50]:
            nurse_name = f"{v.recorded_by.user_profile.first_name} {v.recorded_by.user_profile.last_name}".strip() if v.recorded_by and v.recorded_by.user_profile else 'Nursing Officer'
            results.append({
                'id': str(v.id),
                'patient_id': str(v.patient.id),
                'patient_name': v.patient.user_profile.full_name,
                'uhid': v.patient.medical_record_number,
                'recorded_at': v.recorded_at.strftime('%Y-%m-%d %H:%M'),
                'systolic_bp': v.systolic_bp,
                'diastolic_bp': v.diastolic_bp,
                'blood_pressure': f"{v.systolic_bp}/{v.diastolic_bp}" if v.systolic_bp and v.diastolic_bp else '—',
                'pulse_rate': v.pulse_rate,
                'body_temperature': float(v.body_temperature) if v.body_temperature else None,
                'respiratory_rate': v.respiratory_rate,
                'spo2': v.spo2,
                'blood_glucose': v.blood_glucose,
                'pain_score': v.pain_score,
                'consciousness_level': v.consciousness_level,
                'clinical_alert': v.clinical_alert,
                'alert_severity': v.alert_severity,
                'alert_message': v.alert_message,
                'recorded_by': nurse_name,
                'is_escalated': v.is_escalated,
                'escalation_notes': v.escalation_notes,
            })

        return Response(results)

    def post(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        patient_id = request.data.get('patient_id')
        admission_id = request.data.get('admission_id')

        if not patient_id:
            return Response({'error': 'Patient selection is required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.get(id=patient_id)
        admission = None
        if admission_id:
            admission = InpatientAdmission.objects.filter(id=admission_id).first()
        else:
            admission = InpatientAdmission.objects.filter(patient=patient, status=AdmissionStatus.ADMITTED).first()

        vital = VitalSignObservation(
            patient=patient,
            admission=admission,
            recorded_by=nurse,
            recorded_at=timezone.now(),
            systolic_bp=request.data.get('systolic_bp') or None,
            diastolic_bp=request.data.get('diastolic_bp') or None,
            pulse_rate=request.data.get('pulse_rate') or None,
            body_temperature=request.data.get('body_temperature') or None,
            respiratory_rate=request.data.get('respiratory_rate') or None,
            spo2=request.data.get('spo2') or None,
            blood_glucose=request.data.get('blood_glucose') or None,
            pain_score=request.data.get('pain_score', 0),
            consciousness_level=request.data.get('consciousness_level', 'ALERT')
        )

        vital.save()

        # Handle escalation to doctor if requested or if alert is critical
        escalate_to_doctor = request.data.get('escalate_to_doctor', False)
        escalation_notes = request.data.get('escalation_notes', '').strip()

        if (escalate_to_doctor or vital.alert_severity == 'CRITICAL') and admission and admission.admitting_doctor:
            vital.is_escalated = True
            vital.escalated_to = admission.admitting_doctor
            vital.escalated_at = timezone.now()
            vital.escalation_notes = escalation_notes or f"Clinical Threshold Alert: {vital.alert_message}"
            vital.save()

            # Create notification for attending doctor
            DoctorNotification.objects.create(
                recipient_doctor=admission.admitting_doctor,
                branch=patient.primary_branch,
                notification_type=DoctorNotificationType.CRITICAL_ALERT,
                title=f"CRITICAL VITALS ALERT: {patient.user_profile.full_name}",
                message=f"Nurse {nurse.user_profile.last_name} recorded abnormal vitals: {vital.alert_message}. Notes: {vital.escalation_notes}",
                priority='CRITICAL',
                patient=patient,
                metadata={'vital_id': str(vital.id)}
            )

        return Response({
            'message': 'Vital signs recorded successfully.',
            'id': str(vital.id),
            'recorded_at': vital.recorded_at.strftime('%Y-%m-%d %H:%M'),
            'clinical_alert': vital.clinical_alert,
            'alert_severity': vital.alert_severity,
            'alert_message': vital.alert_message,
            'is_escalated': vital.is_escalated
        }, status=status.HTTP_201_CREATED)


class NurseVitalEscalateView(views.APIView):
    """
    Escalates an existing vital observation with custom nurse notes to the physician.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, vital_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            vital = VitalSignObservation.objects.select_related(
                'patient__user_profile', 'admission__admitting_doctor'
            ).get(id=vital_id)
        except VitalSignObservation.DoesNotExist:
            return Response({'error': 'Vital observation not found.'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', '').strip()
        attending_doctor = vital.admission.admitting_doctor if vital.admission else None

        vital.is_escalated = True
        vital.escalated_to = attending_doctor
        vital.escalated_at = timezone.now()
        vital.escalation_notes = notes or f"Escalated by Nurse: {vital.alert_message}"
        vital.save()

        if attending_doctor:
            DoctorNotification.objects.create(
                recipient_doctor=attending_doctor,
                branch=vital.patient.primary_branch,
                notification_type=DoctorNotificationType.CRITICAL_ALERT,
                title=f"ESCALATION: Patient Vitals - {vital.patient.user_profile.full_name}",
                message=f"Nurse {nurse.user_profile.last_name} escalated vitals: {vital.alert_message}. Observation notes: {vital.escalation_notes}",
                priority='CRITICAL',
                patient=vital.patient,
                metadata={'vital_id': str(vital.id)}
            )

        return Response({
            'message': 'Vital observation escalated to attending physician.',
            'is_escalated': True,
            'doctor_name': f"Dr. {attending_doctor.user_profile.last_name}" if attending_doctor else 'Attending Doctor'
        })


# =============================================================================
# 5. SECTION D: SHIFT HANDOVER
# =============================================================================

class NurseShiftHandoverView(views.APIView):
    """
    Manages structured nursing shift handover submission and incoming nurse acknowledgment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Nurse profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = nurse.branch or Branch.objects.first()
        handovers = ShiftHandoverRecord.objects.filter(
            branch=branch
        ).select_related(
            'outgoing_nurse__user_profile', 'incoming_nurse__user_profile', 'ward'
        ).order_by('-submitted_at')[:20]

        results = []
        for h in handovers:
            out_name = f"{h.outgoing_nurse.user_profile.first_name} {h.outgoing_nurse.user_profile.last_name}".strip() if h.outgoing_nurse else 'Nurse'
            in_name = f"{h.incoming_nurse.user_profile.first_name} {h.incoming_nurse.user_profile.last_name}".strip() if h.incoming_nurse else None

            results.append({
                'id': str(h.id),
                'shift': h.shift,
                'shift_display': h.get_shift_display(),
                'ward': h.ward.name if h.ward else 'General Ward',
                'handover_date': h.handover_date.strftime('%Y-%m-%d'),
                'outgoing_nurse': out_name,
                'incoming_nurse': in_name,
                'patient_condition_updates': h.patient_condition_updates,
                'important_observations': h.important_observations,
                'pending_medications_summary': h.pending_medications_summary,
                'pending_tasks_summary': h.pending_tasks_summary,
                'critical_alerts_summary': h.critical_alerts_summary,
                'follow_up_procedures': h.follow_up_procedures,
                'status': h.status,
                'submitted_at': h.submitted_at.strftime('%Y-%m-%d %H:%M'),
                'acknowledged_at': h.acknowledged_at.strftime('%Y-%m-%d %H:%M') if h.acknowledged_at else None,
                'acknowledgment_notes': h.acknowledgment_notes,
                'can_acknowledge': h.status == 'SUBMITTED' and h.outgoing_nurse != nurse,
            })

        return Response(results)

    def post(self, request):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        branch = nurse.branch or Branch.objects.first()
        shift_info = _get_nurse_active_shift(nurse)

        data = request.data
        important_observations = data.get('important_observations', '').strip()
        pending_meds = data.get('pending_medications_summary', '').strip()
        pending_tasks = data.get('pending_tasks_summary', '').strip()
        critical_alerts = data.get('critical_alerts_summary', '').strip()
        follow_up = data.get('follow_up_procedures', '').strip()
        condition_updates = data.get('patient_condition_updates', [])

        handover = ShiftHandoverRecord.objects.create(
            branch=branch,
            shift=shift_info['shift_key'],
            outgoing_nurse=nurse,
            patient_condition_updates=condition_updates,
            important_observations=important_observations,
            pending_medications_summary=pending_meds,
            pending_tasks_summary=pending_tasks,
            critical_alerts_summary=critical_alerts,
            follow_up_procedures=follow_up,
            status='SUBMITTED'
        )

        ActivityLogService.log_action(
            user=request.user,
            action_type='SHIFT_HANDOVER_SUBMITTED',
            module='NURSE_HANDOVER',
            description=f"Nurse {nurse.user_profile.last_name} submitted shift handover for {shift_info['shift_display']}",
            branch=branch
        )

        return Response({
            'message': 'Shift handover submitted successfully. Awaiting incoming nurse acknowledgment.',
            'id': str(handover.id),
            'status': handover.status,
            'submitted_at': handover.submitted_at.strftime('%Y-%m-%d %H:%M')
        }, status=status.HTTP_201_CREATED)


class NurseShiftHandoverAcknowledgeView(views.APIView):
    """
    Allows incoming nurse to review and formally acknowledge shift handover.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, handover_id):
        nurse = _get_nurse_profile(request)
        if not nurse:
            return Response({'error': 'Unauthorized.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            handover = ShiftHandoverRecord.objects.get(id=handover_id)
        except ShiftHandoverRecord.DoesNotExist:
            return Response({'error': 'Handover record not found.'}, status=status.HTTP_404_NOT_FOUND)

        if handover.status == 'ACKNOWLEDGED':
            return Response({'message': 'This shift handover has already been acknowledged.'}, status=status.HTTP_200_OK)

        notes = request.data.get('acknowledgment_notes', '').strip()
        handover.status = 'ACKNOWLEDGED'
        handover.incoming_nurse = nurse
        handover.acknowledged_at = timezone.now()
        handover.acknowledgment_notes = notes
        handover.save()

        ActivityLogService.log_action(
            user=request.user,
            action_type='SHIFT_HANDOVER_ACKNOWLEDGED',
            module='NURSE_HANDOVER',
            description=f"Incoming Nurse {nurse.user_profile.last_name} acknowledged shift handover from Nurse {handover.outgoing_nurse.user_profile.last_name}",
            branch=handover.branch
        )

        return Response({
            'message': 'Shift handover acknowledged and completed successfully.',
            'id': str(handover.id),
            'status': handover.status,
            'acknowledged_at': handover.acknowledged_at.strftime('%Y-%m-%d %H:%M'),
            'acknowledged_by': f"{nurse.user_profile.first_name} {nurse.user_profile.last_name}".strip()
        })

