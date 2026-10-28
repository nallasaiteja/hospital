import uuid
import datetime
from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiResponse

from apps.core.models import Branch, Department, AuditLog
from apps.authentication.models import (
    Role,
    RoleEnum,
    UserProfile,
    StaffProfile,
    PatientProfile,
    PatientStatusEnum,
    ConsentType,
    ConsentStatus,
    PatientConsent,
    PatientDocument,
    GenderEnum,
    BloodGroupEnum,
)
from apps.authentication.serializers import (
    PatientProfileSerializer,
    PatientConsentSerializer,
    PatientDocumentSerializer,
    PatientRegistrationSerializer,
    PatientMedicalHistoryUpdateSerializer,
    PatientMergeSerializer,
)
from apps.clinical.models import (
    Appointment,
    AppointmentStatus,
    InpatientAdmission,
    EmergencyEncounter,
    SurgicalCase,
    LabOrder,
    LabOrderItem,
    RadiologyOrder,
    DailyProgressNote,
)
from apps.pharmacy_inventory.models import Prescription, PrescriptionItem, DispenseRecord
from apps.billing_finance.models import Invoice, Payment, InsuranceClaim


def get_current_user_profile(request):
    """Helper to get UserProfile from request claims/user."""
    claims = getattr(request, 'supabase_claims', {})
    sub = claims.get('sub') or getattr(request.user, 'username', '')
    import uuid
    from django.core.exceptions import ValidationError
    try:
        sub_uuid = uuid.UUID(str(sub))
        prof = UserProfile.objects.select_related('role', 'patient_profile', 'staff_profile').filter(
            supabase_user_id=sub_uuid
        ).first()
        if prof:
            return prof
    except (ValueError, TypeError, ValidationError):
        pass

    # Fallback by email
    email = getattr(request.user, 'email', '') or claims.get('email', '')
    if email:
        return UserProfile.objects.select_related('role', 'patient_profile', 'staff_profile').filter(
            email=email
        ).first()
    return None


class PatientDashboardStatsView(APIView):
    """
    Returns persistent database statistics for the Patient Management Dashboard.
    Calculated strictly from persistent database records.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Patient Management Dashboard Stats")
    def get(self, request):
        today = datetime.date.today()
        week_ago = timezone.now() - datetime.timedelta(days=7)
        branch_id = request.query_params.get('branch_id')

        patient_qs = PatientProfile.objects.all()
        if branch_id:
            patient_qs = patient_qs.filter(primary_branch_id=branch_id)

        total_patients = patient_qs.exclude(status=PatientStatusEnum.MERGED).count()
        registered_today = patient_qs.filter(created_at__date=today).count()
        active_patients = patient_qs.filter(status=PatientStatusEnum.ACTIVE).count()
        recently_updated = patient_qs.filter(updated_at__gte=week_ago).count()

        # Appointments metrics
        appt_qs = Appointment.objects.all()
        if branch_id:
            appt_qs = appt_qs.filter(branch_id=branch_id)

        upcoming_appointments = appt_qs.filter(
            appointment_date__gte=today,
            status=AppointmentStatus.SCHEDULED
        ).values('patient_id').distinct().count()

        requiring_follow_up = appt_qs.filter(
            follow_up_date__gte=today
        ).values('patient_id').distinct().count()

        # Potential duplicates: phone numbers associated with multiple active patients
        duplicate_phone_count = PatientProfile.objects.filter(
            status=PatientStatusEnum.ACTIVE
        ).exclude(
            user_profile__phone_number=''
        ).values(
            'user_profile__phone_number'
        ).annotate(
            phone_count=Count('id')
        ).filter(phone_count__gt=1).count()

        return Response({
            'total_registered': total_patients,
            'registered_today': registered_today,
            'active_patients': active_patients,
            'upcoming_appointments': upcoming_appointments,
            'recently_updated': recently_updated,
            'requiring_follow_up': requiring_follow_up,
            'potential_duplicates_count': duplicate_phone_count,
        }, status=status.HTTP_200_OK)


class PatientManagementView(APIView):
    """
    Lists registered patients with search, filtering, and pagination.
    Also handles staff-initiated patient registration with unique MRN generation.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_prof = get_current_user_profile(request)
        # Patient data isolation: PATIENT role can only view their own record
        if user_prof and user_prof.role.name == RoleEnum.PATIENT:
            patient = getattr(user_prof, 'patient_profile', None)
            if not patient:
                return Response({'results': [], 'total_count': 0, 'page': 1, 'page_size': 10}, status=status.HTTP_200_OK)
            serializer = PatientProfileSerializer(patient)
            return Response({
                'results': [serializer.data],
                'total_count': 1,
                'page': 1,
                'page_size': 10,
            }, status=status.HTTP_200_OK)

        qs = PatientProfile.objects.select_related(
            'user_profile', 'primary_branch', 'merged_into'
        ).prefetch_related('consents', 'documents').all()

        branch_id = request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(primary_branch_id=branch_id)

        search = request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(medical_record_number__icontains=search) |
                Q(user_profile__first_name__icontains=search) |
                Q(user_profile__last_name__icontains=search) |
                Q(user_profile__phone_number__icontains=search) |
                Q(user_profile__email__icontains=search)
            )

        gender = request.query_params.get('gender')
        if gender:
            qs = qs.filter(gender=gender)

        status_param = request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        else:
            # By default exclude merged records from primary listing
            exclude_merged = request.query_params.get('include_merged', 'false').lower() != 'true'
            if exclude_merged:
                qs = qs.exclude(status=PatientStatusEnum.MERGED)

        reg_date = request.query_params.get('registration_date')
        if reg_date:
            try:
                date_val = datetime.date.fromisoformat(reg_date)
                qs = qs.filter(created_at__date=date_val)
            except ValueError:
                pass

        total_count = qs.count()

        # Sorting
        ordering = request.query_params.get('ordering', '-created_at')
        valid_orderings = ['created_at', '-created_at', 'medical_record_number', '-medical_record_number', 'user_profile__first_name', '-user_profile__first_name']
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-created_at')

        # Pagination
        try:
            page = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 10))))
        except (ValueError, TypeError):
            page, page_size = 1, 10

        start = (page - 1) * page_size
        end = start + page_size
        paged_records = qs[start:end]

        serializer = PatientProfileSerializer(paged_records, many=True)
        return Response({
            'results': serializer.data,
            'total_count': total_count,
            'page': page,
            'page_size': page_size,
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        user_prof = get_current_user_profile(request)
        # Only staff or admins can register walk-in patients
        if user_prof and user_prof.role.name == RoleEnum.PATIENT:
            return Response({'detail': 'Patients cannot register other patients.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PatientRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        branch_id = data['primary_branch_id']
        try:
            branch = Branch.objects.get(id=branch_id, is_active=True)
        except Branch.DoesNotExist:
            return Response({'primary_branch_id': ['Branch not found or inactive.']}, status=status.HTTP_400_BAD_REQUEST)

        # Patient role
        patient_role, _ = Role.objects.get_or_create(
            name=RoleEnum.PATIENT,
            defaults={'display_name': 'Patient', 'description': 'Patient self-service portal'}
        )

        email = data.get('email')
        if not email:
            # Generate deterministic fallback email for offline/walk-in patient
            email = f"patient_{uuid.uuid4().hex[:8]}@aurahms.org"

        # Check existing user
        if UserProfile.objects.filter(email=email).exists():
            return Response({'email': ['A user with this email address already exists.']}, status=status.HTTP_400_BAD_REQUEST)

        user_profile = UserProfile.objects.create(
            supabase_user_id=uuid.uuid4(),
            email=email,
            first_name=data['first_name'],
            last_name=data.get('last_name', ''),
            phone_number=data.get('phone_number', ''),
            role=patient_role,
            is_verified=True,
            is_active=True,
        )

        # Generate unique MRN atomically
        year = datetime.date.today().year
        count = PatientProfile.objects.count() + 1
        mrn = f"MRN-{year}-{count:05d}"
        while PatientProfile.objects.filter(medical_record_number=mrn).exists():
            count += 1
            mrn = f"MRN-{year}-{count:05d}"

        patient = PatientProfile.objects.create(
            user_profile=user_profile,
            primary_branch=branch,
            medical_record_number=mrn,
            status=PatientStatusEnum.ACTIVE,
            date_of_birth=data.get('date_of_birth'),
            gender=data.get('gender', GenderEnum.OTHER),
            blood_group=data.get('blood_group', ''),
            photo_url=data.get('photo_url', ''),
            address=data.get('address', ''),
            city=data.get('city', ''),
            state=data.get('state', ''),
            postal_code=data.get('postal_code', ''),
            country=data.get('country', 'India'),
            emergency_contact_name=data.get('emergency_contact_name', ''),
            emergency_contact_phone=data.get('emergency_contact_phone', ''),
            emergency_contact_relation=data.get('emergency_contact_relation', ''),
            allergies=data.get('allergies', []),
            chronic_conditions=data.get('chronic_conditions', []),
            past_medical_history=data.get('past_medical_history', []),
            past_surgical_history=data.get('past_surgical_history', []),
            family_history=data.get('family_history', ''),
            social_history=data.get('social_history', ''),
            insurance_provider=data.get('insurance_provider', ''),
            insurance_policy_number=data.get('insurance_policy_number', ''),
        )

        # Create initial consent if provided
        initial_consent = data.get('initial_consent_type')
        if initial_consent:
            staff_prof = getattr(user_prof, 'staff_profile', None) if user_prof else None
            PatientConsent.objects.create(
                patient=patient,
                consent_type=initial_consent,
                status=ConsentStatus.GRANTED,
                recorded_by=staff_prof,
                notes=data.get('initial_consent_notes', 'Consent documented during registration'),
            )

        # Audit Log
        actor_id = user_prof.supabase_user_id if user_prof else None
        AuditLog.objects.create(
            actor_user_id=actor_id,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='PATIENT_REGISTERED',
            entity_type='PatientProfile',
            entity_id=str(patient.id),
            branch=branch,
            new_values={'mrn': mrn, 'name': f"{data['first_name']} {data.get('last_name', '')}".strip()},
        )

        return Response(PatientProfileSerializer(patient).data, status=status.HTTP_201_CREATED)


class PatientDetailView(APIView):
    """
    Retrieves or updates a single patient profile record.
    """
    permission_classes = [IsAuthenticated]

    def get_patient(self, pk, user_prof):
        try:
            patient = PatientProfile.objects.select_related(
                'user_profile', 'primary_branch', 'merged_into'
            ).get(id=pk)
        except PatientProfile.DoesNotExist:
            return None

        # Data isolation for PATIENT role
        if user_prof and user_prof.role.name == RoleEnum.PATIENT:
            if patient.user_profile_id != user_prof.id:
                return 'FORBIDDEN'
        return patient

    def get(self, request, pk):
        user_prof = get_current_user_profile(request)
        patient = self.get_patient(pk, user_prof)
        if patient == 'FORBIDDEN':
            return Response({'detail': 'You are not authorized to view another patient record.'}, status=status.HTTP_403_FORBIDDEN)
        if not patient:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(PatientProfileSerializer(patient).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request, pk):
        user_prof = get_current_user_profile(request)
        patient = self.get_patient(pk, user_prof)
        if patient == 'FORBIDDEN':
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if not patient:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Staff with write permissions or patient updating permitted profile fields
        d = request.data
        up = patient.user_profile

        # Update UserProfile attributes
        if 'first_name' in d:
            up.first_name = d['first_name']
        if 'last_name' in d:
            up.last_name = d['last_name']
        if 'phone_number' in d:
            up.phone_number = d['phone_number']
        up.save()

        # Update PatientProfile attributes
        fields = [
            'date_of_birth', 'gender', 'blood_group', 'photo_url', 'address', 'city',
            'state', 'postal_code', 'country', 'emergency_contact_name',
            'emergency_contact_phone', 'emergency_contact_relation',
            'insurance_provider', 'insurance_policy_number', 'status'
        ]
        old_values = {}
        new_values = {}
        for f in fields:
            if f in d:
                old_values[f] = getattr(patient, f)
                setattr(patient, f, d[f])
                new_values[f] = d[f]
        patient.save()

        # Audit logging
        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='PATIENT_DEMOGRAPHICS_UPDATED',
            entity_type='PatientProfile',
            entity_id=str(patient.id),
            branch=patient.primary_branch,
            old_values=old_values,
            new_values=new_values,
        )

        return Response(PatientProfileSerializer(patient).data, status=status.HTTP_200_OK)


class PatientFullEMRView(APIView):
    """
    Comprehensive Electronic Medical Record (EMR) aggregator.
    Aggregates all 15 clinical tabs from real database records:
    1. Overview (summary vitals, key alerts, quick counts)
    2. Demographics & Contact
    3. Emergency Contacts
    4. Medical History
    5. Allergies
    6. Consents & Legal Documents
    7. Appointments
    8. Consultations
    9. Diagnoses & Treatment Plans
    10. Prescriptions
    11. Inpatient Admissions & Discharge Summaries
    12. Laboratory Reports
    13. Radiology & Imaging Reports
    14. Billing & Payment History
    15. Clinical Notes & Progress Logs
    16. Audit Log History
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user_prof = get_current_user_profile(request)
        try:
            patient = PatientProfile.objects.select_related(
                'user_profile', 'primary_branch', 'merged_into'
            ).prefetch_related('consents', 'documents').get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient record not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce patient data isolation
        if user_prof and user_prof.role.name == RoleEnum.PATIENT:
            if patient.user_profile_id != user_prof.id:
                return Response({'detail': 'Access denied: Patient cannot access another record.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Appointments & Consultations
        appointments = Appointment.objects.filter(patient=patient).select_related(
            'doctor__user_profile', 'department', 'branch'
        ).order_by('-appointment_date', '-created_at')

        appointments_data = []
        consultations_data = []
        diagnoses_data = []

        for appt in appointments:
            appt_dict = {
                'id': str(appt.id),
                'appointment_number': appt.appointment_number,
                'date': str(appt.appointment_date),
                'time_slot': appt.time_slot,
                'token_number': appt.token_number,
                'doctor_name': f"Dr. {appt.doctor.user_profile.full_name}",
                'department_name': appt.department.name,
                'status': appt.status,
                'reason_for_visit': appt.reason_for_visit,
                'created_at': appt.created_at.isoformat(),
            }
            appointments_data.append(appt_dict)

            # Consultations tab
            if appt.consultation_notes or appt.diagnosis or appt.vitals:
                consultations_data.append({
                    'appointment_id': str(appt.id),
                    'appointment_number': appt.appointment_number,
                    'date': str(appt.appointment_date),
                    'doctor_name': f"Dr. {appt.doctor.user_profile.full_name}",
                    'department_name': appt.department.name,
                    'vitals': appt.vitals,
                    'consultation_notes': appt.consultation_notes,
                    'diagnosis': appt.diagnosis,
                    'prescription_summary': appt.prescription_summary,
                    'follow_up_date': str(appt.follow_up_date) if appt.follow_up_date else None,
                })

            if appt.diagnosis:
                diagnoses_data.append({
                    'type': 'OPD_DIAGNOSIS',
                    'date': str(appt.appointment_date),
                    'diagnosis': appt.diagnosis,
                    'doctor_name': f"Dr. {appt.doctor.user_profile.full_name}",
                    'treatment_plan': appt.prescription_summary or 'Consultation plan recorded',
                })

        # 2. Inpatient Admissions & Discharge Summaries
        admissions = InpatientAdmission.objects.filter(patient=patient).select_related(
            'bed__ward', 'admitting_doctor__user_profile', 'branch'
        ).prefetch_related('progress_notes__recorded_by__user_profile').order_by('-admission_date')

        admissions_data = []
        clinical_notes_data = []

        for adm in admissions:
            admissions_data.append({
                'id': str(adm.id),
                'admission_number': adm.admission_number,
                'admission_date': adm.admission_date.isoformat(),
                'discharge_date': adm.discharge_date.isoformat() if adm.discharge_date else None,
                'ward_name': adm.bed.ward.name,
                'ward_type': adm.bed.ward.get_ward_type_display(),
                'bed_number': adm.bed.bed_number,
                'admitting_doctor': f"Dr. {adm.admitting_doctor.user_profile.full_name}",
                'initial_diagnosis': adm.initial_diagnosis,
                'status': adm.status,
                'discharge_condition': adm.discharge_condition,
                'discharge_summary': adm.discharge_summary,
                'discharge_medications': adm.discharge_medications,
            })

            if adm.initial_diagnosis:
                diagnoses_data.append({
                    'type': 'IPD_ADMISSION_DIAGNOSIS',
                    'date': adm.admission_date.strftime('%Y-%m-%d'),
                    'diagnosis': adm.initial_diagnosis,
                    'doctor_name': f"Dr. {adm.admitting_doctor.user_profile.full_name}",
                    'treatment_plan': f"Inpatient management in {adm.bed.ward.name}",
                })

            for pn in adm.progress_notes.all():
                clinical_notes_data.append({
                    'type': 'IPD_PROGRESS_NOTE',
                    'recorded_at': pn.recorded_at.isoformat(),
                    'recorded_by': f"Dr. {pn.recorded_by.user_profile.full_name}" if 'DOC' in pn.recorded_by.employee_id else f"Nurse {pn.recorded_by.user_profile.full_name}",
                    'clinical_notes': pn.clinical_notes,
                    'vitals': pn.vitals,
                    'treatment_plan': pn.treatment_plan,
                })

        # Emergency encounters & Surgeries
        emergency_cases = EmergencyEncounter.objects.filter(patient=patient).select_related(
            'attending_doctor__user_profile', 'triage_nurse__user_profile'
        ).order_by('-arrival_time')
        for em in emergency_cases:
            clinical_notes_data.append({
                'type': 'EMERGENCY_TRIAGE_NOTE',
                'recorded_at': em.arrival_time.isoformat(),
                'recorded_by': f"Triage Nurse: {em.triage_nurse.user_profile.full_name}" if em.triage_nurse else 'Emergency Staff',
                'clinical_notes': f"Acuity: {em.get_triage_acuity_display()}. Chief Complaint: {em.chief_complaint}. Treatment: {em.treatment_given}",
                'vitals': em.vitals_on_arrival,
                'treatment_plan': f"Status: {em.status}",
            })

        surgeries = SurgicalCase.objects.filter(patient=patient).select_related(
            'theatre', 'lead_surgeon__user_profile'
        ).order_by('-scheduled_date')
        for s in surgeries:
            if s.surgical_findings or s.post_op_orders:
                clinical_notes_data.append({
                    'type': 'SURGICAL_OPERATIVE_NOTE',
                    'recorded_at': f"{s.scheduled_date} {s.start_time}",
                    'recorded_by': f"Surgeon: Dr. {s.lead_surgeon.user_profile.full_name}",
                    'clinical_notes': f"Procedure: {s.procedure_name}. Findings: {s.surgical_findings}",
                    'vitals': {},
                    'treatment_plan': f"Post-op orders: {s.post_op_orders}",
                })

        # 3. Prescriptions & Medications
        prescriptions = Prescription.objects.filter(patient=patient).select_related(
            'doctor__user_profile', 'branch'
        ).prefetch_related('items__medicine').order_by('-created_at')

        prescriptions_data = []
        for rx in prescriptions:
            items_list = []
            for item in rx.items.all():
                items_list.append({
                    'medicine_name': item.medicine.name,
                    'generic_name': item.medicine.generic_name,
                    'dosage': item.dosage,
                    'frequency': item.frequency,
                    'duration_days': item.duration_days,
                    'total_quantity': item.total_quantity,
                    'instructions': item.instructions,
                })
            prescriptions_data.append({
                'id': str(rx.id),
                'prescription_number': rx.prescription_number,
                'doctor_name': f"Dr. {rx.doctor.user_profile.full_name}",
                'diagnosis': rx.diagnosis,
                'clinical_notes': rx.clinical_notes,
                'is_dispensed': rx.is_dispensed,
                'created_at': rx.created_at.isoformat(),
                'items': items_list,
            })

        # 4. Diagnostic Lab Reports
        lab_orders = LabOrder.objects.filter(patient=patient).select_related(
            'doctor__user_profile'
        ).prefetch_related('items__test', 'items__verified_by__user_profile').order_by('-created_at')

        lab_reports_data = []
        for lo in lab_orders:
            items_list = []
            for itm in lo.items.all():
                items_list.append({
                    'test_code': itm.test.code,
                    'test_name': itm.test.name,
                    'category': itm.test.get_category_display(),
                    'result_value': itm.result_value,
                    'reference_range': itm.reference_range or itm.test.reference_range,
                    'unit': itm.test.unit_of_measurement,
                    'is_abnormal': itm.is_abnormal,
                    'result_notes': itm.result_notes,
                    'verified_by': f"Dr. {itm.verified_by.user_profile.full_name}" if itm.verified_by else None,
                    'verified_at': itm.verified_at.isoformat() if itm.verified_at else None,
                })
            lab_reports_data.append({
                'id': str(lo.id),
                'order_number': lo.order_number,
                'doctor_name': f"Dr. {lo.doctor.user_profile.full_name}",
                'priority': lo.priority,
                'status': lo.status,
                'created_at': lo.created_at.isoformat(),
                'items': items_list,
            })

        # 5. Radiology & Imaging Reports
        radiology_orders = RadiologyOrder.objects.filter(patient=patient).select_related(
            'doctor__user_profile', 'radiologist__user_profile'
        ).order_by('-created_at')

        radiology_reports_data = []
        for ro in radiology_orders:
            radiology_reports_data.append({
                'id': str(ro.id),
                'order_number': ro.order_number,
                'doctor_name': f"Dr. {ro.doctor.user_profile.full_name}",
                'radiologist_name': f"Dr. {ro.radiologist.user_profile.full_name}" if ro.radiologist else None,
                'modality': ro.get_modality_display(),
                'study_name': ro.study_name,
                'clinical_indication': ro.clinical_indication,
                'findings': ro.findings,
                'impression': ro.impression,
                'dicom_viewer_url': ro.dicom_viewer_url,
                'status': ro.status,
                'reported_at': ro.reported_at.isoformat() if ro.reported_at else None,
                'created_at': ro.created_at.isoformat(),
            })

        # 6. Billing and Payments
        invoices = Invoice.objects.filter(patient=patient).prefetch_related(
            'items', 'payments__received_by__user_profile'
        ).order_by('-invoice_date', '-created_at')

        billing_history_data = []
        for inv in invoices:
            payments_list = []
            for pmt in inv.payments.all():
                payments_list.append({
                    'payment_number': pmt.payment_number,
                    'amount': str(pmt.amount),
                    'method': pmt.get_payment_method_display(),
                    'reference': pmt.transaction_reference,
                    'date': pmt.payment_date.isoformat(),
                })
            billing_history_data.append({
                'id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'date': str(inv.invoice_date),
                'total_amount': str(inv.total_amount),
                'paid_amount': str(inv.paid_amount),
                'balance_amount': str(inv.balance_amount),
                'status': inv.status,
                'items_count': inv.items.count(),
                'payments': payments_list,
            })

        # 7. Consents & Legal Documents
        consents_data = PatientConsentSerializer(patient.consents.all(), many=True).data
        documents_data = PatientDocumentSerializer(patient.documents.all(), many=True).data

        # 8. Audit Trail (Only for staff roles)
        audit_trail_data = []
        if not user_prof or user_prof.role.name != RoleEnum.PATIENT:
            audit_logs = AuditLog.objects.filter(
                entity_type='PatientProfile',
                entity_id=str(patient.id)
            ).order_by('-created_at')[:30]
            for al in audit_logs:
                audit_trail_data.append({
                    'action': al.action,
                    'actor_email': al.actor_email,
                    'timestamp': al.created_at.isoformat(),
                    'old_values': al.old_values,
                    'new_values': al.new_values,
                })

        # Build full consolidated response
        return Response({
            'patient': PatientProfileSerializer(patient).data,
            'overview': {
                'mrn': patient.medical_record_number,
                'full_name': patient.user_profile.full_name,
                'age': patient.age,
                'gender': patient.gender,
                'blood_group': patient.blood_group,
                'status': patient.status,
                'primary_branch': patient.primary_branch.name,
                'active_allergies_count': len(patient.allergies),
                'chronic_conditions_count': len(patient.chronic_conditions),
                'total_appointments': len(appointments_data),
                'total_admissions': len(admissions_data),
                'total_prescriptions': len(prescriptions_data),
                'total_lab_orders': len(lab_reports_data),
                'total_invoices': len(billing_history_data),
            },
            'demographics': {
                'address': patient.address,
                'city': patient.city,
                'state': patient.state,
                'postal_code': patient.postal_code,
                'country': patient.country,
                'phone': patient.user_profile.phone_number,
                'email': patient.user_profile.email,
                'registered_date': patient.created_at.isoformat(),
            },
            'emergency_contacts': {
                'name': patient.emergency_contact_name,
                'phone': patient.emergency_contact_phone,
                'relationship': patient.emergency_contact_relation,
            },
            'medical_history': {
                'chronic_conditions': patient.chronic_conditions,
                'past_medical_history': patient.past_medical_history,
                'past_surgical_history': patient.past_surgical_history,
                'family_history': patient.family_history,
                'social_history': patient.social_history,
            },
            'allergies': patient.allergies,
            'consents': consents_data,
            'documents': documents_data,
            'appointments': appointments_data,
            'consultations': consultations_data,
            'diagnoses_and_plans': diagnoses_data,
            'prescriptions': prescriptions_data,
            'admissions': admissions_data,
            'lab_reports': lab_reports_data,
            'radiology_reports': radiology_reports_data,
            'billing_history': billing_history_data,
            'clinical_notes': clinical_notes_data,
            'audit_trail': audit_trail_data,
        }, status=status.HTTP_200_OK)


class PatientMedicalHistoryView(APIView):
    """
    Allows clinical staff to record, update, or correct medical history and allergies.
    Preserves audit history and attribution.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        user_prof = get_current_user_profile(request)
        if user_prof and user_prof.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.DOCTOR, RoleEnum.NURSE]:
            return Response({'detail': 'Only clinical staff can update medical history and allergies.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            patient = PatientProfile.objects.get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PatientMedicalHistoryUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        old_values = {
            'allergies': patient.allergies,
            'chronic_conditions': patient.chronic_conditions,
            'past_medical_history': patient.past_medical_history,
            'past_surgical_history': patient.past_surgical_history,
        }

        if 'allergies' in d:
            patient.allergies = d['allergies']
        if 'chronic_conditions' in d:
            patient.chronic_conditions = d['chronic_conditions']
        if 'past_medical_history' in d:
            patient.past_medical_history = d['past_medical_history']
        if 'past_surgical_history' in d:
            patient.past_surgical_history = d['past_surgical_history']
        if 'family_history' in d:
            patient.family_history = d['family_history']
        if 'social_history' in d:
            patient.social_history = d['social_history']
        patient.save()

        # Audit log
        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='CLINICAL_HISTORY_UPDATED',
            entity_type='PatientProfile',
            entity_id=str(patient.id),
            branch=patient.primary_branch,
            old_values=old_values,
            new_values={
                'allergies': patient.allergies,
                'chronic_conditions': patient.chronic_conditions,
                'past_medical_history': patient.past_medical_history,
                'past_surgical_history': patient.past_surgical_history,
            },
        )

        return Response({
            'message': 'Medical history and allergies updated successfully.',
            'allergies': patient.allergies,
            'chronic_conditions': patient.chronic_conditions,
            'past_medical_history': patient.past_medical_history,
            'past_surgical_history': patient.past_surgical_history,
            'family_history': patient.family_history,
            'social_history': patient.social_history,
        }, status=status.HTTP_200_OK)


class PatientConsentView(APIView):
    """
    Manages consent forms and waivers for patient procedures and records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            patient = PatientProfile.objects.get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        consents = patient.consents.all()
        return Response(PatientConsentSerializer(consents, many=True).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, pk):
        user_prof = get_current_user_profile(request)
        try:
            patient = PatientProfile.objects.get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff_prof = getattr(user_prof, 'staff_profile', None) if user_prof else None
        consent_type = request.data.get('consent_type', ConsentType.GENERAL_TREATMENT)
        notes = request.data.get('notes', '')
        document_url = request.data.get('document_url', '')

        consent = PatientConsent.objects.create(
            patient=patient,
            consent_type=consent_type,
            status=ConsentStatus.GRANTED,
            recorded_by=staff_prof,
            document_url=document_url,
            notes=notes,
        )

        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='CONSENT_RECORDED',
            entity_type='PatientConsent',
            entity_id=str(consent.id),
            branch=patient.primary_branch,
            new_values={'consent_type': consent_type, 'patient_mrn': patient.medical_record_number},
        )

        return Response(PatientConsentSerializer(consent).data, status=status.HTTP_201_CREATED)


class PatientConsentRevokeView(APIView):
    """
    Revokes an existing patient consent with justification and timestamp.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk, consent_id):
        user_prof = get_current_user_profile(request)
        try:
            consent = PatientConsent.objects.get(id=consent_id, patient_id=pk)
        except PatientConsent.DoesNotExist:
            return Response({'detail': 'Consent record not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('reason', 'Consent withdrawn by patient/guardian')
        consent.status = ConsentStatus.REVOKED
        consent.revocation_reason = reason
        consent.revoked_at = timezone.now()
        consent.save()

        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='CONSENT_REVOKED',
            entity_type='PatientConsent',
            entity_id=str(consent.id),
            branch=consent.patient.primary_branch,
            new_values={'reason': reason, 'revoked_at': consent.revoked_at.isoformat()},
        )

        return Response(PatientConsentSerializer(consent).data, status=status.HTTP_200_OK)


class PatientDocumentView(APIView):
    """
    Uploads and retrieves document references (e.g. Govt ID, Insurance Card, Scans).
    Protected against unauthorized IDOR access, cross-branch snooping, and malicious file uploads.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user_prof = get_current_user_profile(request)
        try:
            patient = PatientProfile.objects.select_related('primary_branch', 'user_profile').get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        # IDOR Protection: Patients can only inspect their own documents
        if user_prof and user_prof.role and user_prof.role.name == RoleEnum.PATIENT:
            if not hasattr(user_prof, 'patient_profile') or user_prof.patient_profile.id != patient.id:
                return Response(
                    {'detail': 'Access denied: You can only access your own patient documents.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Staff Branch Isolation: Non-admin staff must belong to patient's primary branch
        if user_prof and user_prof.role and user_prof.role.name != RoleEnum.PATIENT and not request.user.is_superuser:
            if user_prof.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN]:
                staff = getattr(user_prof, 'staff_profile', None)
                if staff and staff.branch_id != patient.primary_branch_id:
                    return Response(
                        {'detail': 'Cross-branch patient access denied.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        docs = patient.documents.all()
        return Response(PatientDocumentSerializer(docs, many=True).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, pk):
        user_prof = get_current_user_profile(request)
        try:
            patient = PatientProfile.objects.select_related('primary_branch', 'user_profile').get(id=pk)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        # IDOR Protection: Patients can only upload documents for their own profile
        if user_prof and user_prof.role and user_prof.role.name == RoleEnum.PATIENT:
            if not hasattr(user_prof, 'patient_profile') or user_prof.patient_profile.id != patient.id:
                return Response(
                    {'detail': 'Access denied: You cannot upload documents for another patient.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Staff Branch Isolation
        if user_prof and user_prof.role and user_prof.role.name != RoleEnum.PATIENT and not request.user.is_superuser:
            if user_prof.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN]:
                staff = getattr(user_prof, 'staff_profile', None)
                if staff and staff.branch_id != patient.primary_branch_id:
                    return Response(
                        {'detail': 'Cross-branch patient access denied.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        staff_prof = getattr(user_prof, 'staff_profile', None) if user_prof else None
        title = request.data.get('title', 'Clinical Attachment')
        doc_type = request.data.get('document_type', 'OTHER')
        file_url = request.data.get('file_url', '').strip()
        file_size_kb = int(request.data.get('file_size_kb', 0))
        mime_type = request.data.get('mime_type', 'application/pdf').strip().lower()
        notes = request.data.get('notes', '')

        if not file_url:
            return Response({'file_url': ['File URL is required.']}, status=status.HTTP_400_BAD_REQUEST)

        # Malicious File Upload Prevention
        FORBIDDEN_EXTENSIONS = ['.exe', '.bat', '.sh', '.cmd', '.php', '.js', '.py', '.dll', '.bin', '.vbs', '.msi']
        if any(file_url.lower().endswith(ext) for ext in FORBIDDEN_EXTENSIONS):
            return Response(
                {'error': 'Executable and script file uploads are strictly forbidden for security compliance.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ALLOWED_MIME_TYPES = [
            'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
            'application/dicom', 'application/octet-stream'
        ]
        if mime_type not in ALLOWED_MIME_TYPES and not any(file_url.lower().endswith(ext) for ext in ['.pdf', '.jpg', '.jpeg', '.png', '.dcm']):
            return Response(
                {'error': f'Invalid file type ({mime_type}). Allowed types: PDF, JPEG, PNG, DICOM.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce maximum file size limit (15 MB = 15360 KB)
        if file_size_kb > 15360:
            return Response(
                {'error': 'File size exceeds maximum permitted limit (15 MB).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        doc = PatientDocument.objects.create(
            patient=patient,
            document_type=doc_type,
            title=title,
            file_url=file_url,
            file_size_kb=file_size_kb,
            mime_type=mime_type,
            uploaded_by=staff_prof,
            notes=notes,
        )

        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='DOCUMENT_UPLOADED',
            entity_type='PatientDocument',
            entity_id=str(doc.id),
            branch=patient.primary_branch,
            new_values={'title': title, 'type': doc_type, 'size_kb': file_size_kb},
        )

        return Response(PatientDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class PatientDuplicatesView(APIView):
    """
    Identifies potential duplicate patient records matching by:
    - Same phone number
    - Matching first & last name with same gender
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_prof = get_current_user_profile(request)
        if user_prof and user_prof.role.name == RoleEnum.PATIENT:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Matching phone numbers across active patients
        active_patients = PatientProfile.objects.filter(
            status=PatientStatusEnum.ACTIVE
        ).select_related('user_profile', 'primary_branch')

        duplicate_groups = []
        processed_pairs = set()

        phone_map = {}
        for p in active_patients:
            phone = p.user_profile.phone_number.strip() if p.user_profile.phone_number else None
            if phone and len(phone) >= 7:
                if phone not in phone_map:
                    phone_map[phone] = []
                phone_map[phone].append(p)

        for phone, plist in phone_map.items():
            if len(plist) > 1:
                duplicate_groups.append({
                    'reason': f'Identical Contact Phone: {phone}',
                    'similarity_score': 95,
                    'patients': PatientProfileSerializer(plist, many=True).data,
                })
                for i in range(len(plist)):
                    for j in range(i + 1, len(plist)):
                        processed_pairs.add(tuple(sorted([str(plist[i].id), str(plist[j].id)])))

        # 2. Matching First Name & Last Name (case-insensitive)
        name_map = {}
        for p in active_patients:
            key = (p.user_profile.first_name.strip().lower(), p.user_profile.last_name.strip().lower(), p.gender)
            if key[0] and key[1]:  # Both first and last name present
                if key not in name_map:
                    name_map[key] = []
                name_map[key].append(p)

        for (first, last, gen), plist in name_map.items():
            if len(plist) > 1:
                # Check if already reported in phone matches
                pair_keys = [tuple(sorted([str(plist[i].id), str(plist[j].id)])) for i in range(len(plist)) for j in range(i + 1, len(plist))]
                if not any(pk in processed_pairs for pk in pair_keys):
                    duplicate_groups.append({
                        'reason': f'Matching Name & Gender: {first.capitalize()} {last.capitalize()} ({gen})',
                        'similarity_score': 80,
                        'patients': PatientProfileSerializer(plist, many=True).data,
                    })

        return Response({
            'total_candidate_groups': len(duplicate_groups),
            'duplicate_groups': duplicate_groups,
        }, status=status.HTTP_200_OK)


class PatientMergeView(APIView):
    """
    Authorized Patient Record Merging.
    Transactionally reassigns all clinical and billing foreign keys to the surviving patient,
    marks source patient as MERGED, and writes a comprehensive audit trail.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user_prof = get_current_user_profile(request)
        if user_prof and user_prof.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.RECEPTIONIST]:
            return Response({'detail': 'Only administrators, branch managers, or receptionists can merge patient records.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = PatientMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        source_id = data['source_patient_id']
        target_id = data['target_patient_id']
        reason = data['reason'].strip()

        if source_id == target_id:
            return Response({'detail': 'Source and target patient cannot be the same record.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            source = PatientProfile.objects.select_related('user_profile').get(id=source_id)
            target = PatientProfile.objects.select_related('user_profile').get(id=target_id)
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'One or both patient records do not exist.'}, status=status.HTTP_404_NOT_FOUND)

        if source.status == PatientStatusEnum.MERGED:
            return Response({'detail': 'Source patient is already merged.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Transactionally reassign all foreign key relationships
        reassigned_counts = {
            'appointments': Appointment.objects.filter(patient=source).update(patient=target),
            'admissions': InpatientAdmission.objects.filter(patient=source).update(patient=target),
            'emergency_cases': EmergencyEncounter.objects.filter(patient=source).update(patient=target),
            'surgeries': SurgicalCase.objects.filter(patient=source).update(patient=target),
            'lab_orders': LabOrder.objects.filter(patient=source).update(patient=target),
            'radiology_orders': RadiologyOrder.objects.filter(patient=source).update(patient=target),
            'prescriptions': Prescription.objects.filter(patient=source).update(patient=target),
            'dispense_records': DispenseRecord.objects.filter(patient=source).update(patient=target),
            'invoices': Invoice.objects.filter(patient=source).update(patient=target),
            'payments': Payment.objects.filter(patient=source).update(patient=target),
            'insurance_claims': InsuranceClaim.objects.filter(patient=source).update(patient=target),
            'consents': PatientConsent.objects.filter(patient=source).update(patient=target),
            'documents': PatientDocument.objects.filter(patient=source).update(patient=target),
        }

        # 2. Merge clinical allergies & chronic conditions without duplicates
        combined_allergies = list(dict.fromkeys((target.allergies or []) + (source.allergies or [])))
        combined_conditions = list(dict.fromkeys((target.chronic_conditions or []) + (source.chronic_conditions or [])))
        combined_past_med = list(dict.fromkeys((target.past_medical_history or []) + (source.past_medical_history or [])))
        combined_past_surg = list(dict.fromkeys((target.past_surgical_history or []) + (source.past_surgical_history or [])))

        target.allergies = combined_allergies
        target.chronic_conditions = combined_conditions
        target.past_medical_history = combined_past_med
        target.past_surgical_history = combined_past_surg
        target.save()

        # 3. Mark source record as MERGED pointing to target
        source.status = PatientStatusEnum.MERGED
        source.merged_into = target
        source.save()

        # Deactivate source UserProfile
        source.user_profile.is_active = False
        source.user_profile.save()

        # 4. Audit Log
        AuditLog.objects.create(
            actor_user_id=user_prof.supabase_user_id if user_prof else None,
            actor_email=user_prof.email if user_prof else request.user.email,
            action='PATIENT_RECORDS_MERGED',
            entity_type='PatientProfile',
            entity_id=str(target.id),
            branch=target.primary_branch,
            new_values={
                'source_mrn': source.medical_record_number,
                'target_mrn': target.medical_record_number,
                'reason': reason,
                'reassigned_counts': reassigned_counts,
            },
        )

        return Response({
            'message': f"Patient record {source.medical_record_number} successfully merged into {target.medical_record_number}.",
            'surviving_mrn': target.medical_record_number,
            'reassigned_records': reassigned_counts,
            'target_patient': PatientProfileSerializer(target).data,
        }, status=status.HTTP_200_OK)
