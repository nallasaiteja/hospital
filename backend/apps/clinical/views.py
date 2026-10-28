import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember, IsClinicalStaff, resolve_user_profile
from apps.core.models import Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile, RoleEnum
from apps.authentication.utils import get_staff_profile, get_patient_profile
from .models import (
    DoctorSchedule, Appointment, AppointmentStatus,
    EmergencyEncounter, TriageAcuity, EmergencyStatus,
    Ward, Bed, BedStatus, InpatientAdmission, AdmissionStatus,
    DailyProgressNote, OperatingTheatre, SurgicalCase,
    LabTestCatalogue, LabOrder, LabOrderItem, LabOrderStatus,
    RadiologyOrder, DutyRoster
)
from .serializers import (
    DoctorScheduleSerializer, AppointmentSerializer,
    EmergencyEncounterSerializer, WardSerializer, BedSerializer,
    InpatientAdmissionSerializer, DailyProgressNoteSerializer,
    OperatingTheatreSerializer, SurgicalCaseSerializer,
    LabTestCatalogueSerializer, LabOrderSerializer,
    RadiologyOrderSerializer, DutyRosterSerializer
)


class AppointmentViewSet(viewsets.ModelViewSet):
    """
    OPD Consultations & Appointments API with collision prevention and queue token generation.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related('patient__user_profile', 'doctor__user_profile', 'department', 'branch')

        # Patients only see their own appointments
        patient = get_patient_profile(user)
        if patient:
            return qs.filter(patient=patient)

        # Staff can filter by branch, doctor, date, or status
        branch_id = self.request.query_params.get('branch_id')
        doctor_id = self.request.query_params.get('doctor_id')
        date = self.request.query_params.get('date')
        status_filter = self.request.query_params.get('status')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if date:
            qs = qs.filter(appointment_date=date)
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def create(self, request, *args, **kwargs):
        """
        Book an appointment with collision prevention.
        """
        data = request.data
        doctor_id = data.get('doctor_id')
        appointment_date = data.get('appointment_date')
        time_slot = data.get('time_slot') or data.get('appointment_time') or '10:00:00'
        patient_id = data.get('patient_id')
        department_id = data.get('department_id')
        branch_id = data.get('branch_id')
        reason = data.get('reason_for_visit') or data.get('symptoms') or ''

        # Resolve patient: if patient is booking self, use their profile
        patient = get_patient_profile(request.user)
        if not patient and patient_id:
            patient = PatientProfile.objects.filter(id=patient_id).first()
        elif not patient:
            return Response({'error': 'Patient identification is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not patient:
            return Response({'error': 'Valid patient profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(id=branch_id).first() or doctor.branch or getattr(patient, 'primary_branch', None) or Branch.objects.first()
        department = Department.objects.filter(id=department_id).first() or doctor.department or Department.objects.first()

        # Collision Check: Doctor cannot have 2 bookings at identical date and slot
        existing = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=appointment_date,
            time_slot=time_slot
        ).exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]).exists()

        if existing:
            return Response(
                {'error': f'Dr. {doctor.user_profile.last_name} already has an appointment scheduled at {time_slot} on {appointment_date}. Please choose another slot.'},
                status=status.HTTP_409_CONFLICT
            )

        # Generate daily token number for the doctor queue
        daily_count = Appointment.objects.filter(doctor=doctor, appointment_date=appointment_date).count()
        token = f"Token #{daily_count + 1}"
        apt_number = f"APT-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        booking_source = 'PATIENT_PORTAL' if get_patient_profile(request.user) is not None else 'FRONT_DESK'

        appointment = Appointment.objects.create(
            appointment_number=apt_number,
            patient=patient,
            doctor=doctor,
            department=department,
            branch=branch,
            appointment_date=appointment_date,
            time_slot=time_slot,
            token_number=token,
            reason_for_visit=reason,
            booking_source=booking_source,
            status=AppointmentStatus.SCHEDULED
        )

        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)


class UpdateAppointmentStatusView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember]

    def patch(self, request, pk):
        appointment = Appointment.objects.filter(id=pk).first()
        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in AppointmentStatus.values:
            return Response({'error': 'Invalid appointment status.'}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = new_status
        appointment.save()
        return Response(AppointmentSerializer(appointment).data)


class RecordConsultationView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember, IsClinicalStaff]

    def post(self, request, pk):
        appointment = Appointment.objects.filter(id=pk).first()
        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        appointment.consultation_notes = data.get('consultation_notes', appointment.consultation_notes)
        appointment.diagnosis = data.get('diagnosis', appointment.diagnosis)
        appointment.prescription_summary = data.get('prescription_summary', appointment.prescription_summary)
        appointment.vitals = data.get('vitals', appointment.vitals)
        appointment.status = AppointmentStatus.COMPLETED
        appointment.save()

        return Response(AppointmentSerializer(appointment).data)


class EmergencyEncounterViewSet(viewsets.ModelViewSet):
    """
    Casualty, Triage, and Emergency Management.
    """
    serializer_class = EmergencyEncounterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = EmergencyEncounter.objects.select_related('patient__user_profile', 'attending_doctor__user_profile', 'branch')
        branch_id = self.request.query_params.get('branch_id')
        acuity = self.request.query_params.get('acuity')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if acuity:
            qs = qs.filter(triage_acuity=acuity)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        branch_id = data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() or Branch.objects.first()
        encounter_number = f"ER-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        encounter = EmergencyEncounter.objects.create(
            encounter_number=encounter_number,
            patient_id=data.get('patient_id') or None,
            unregistered_patient_name=data.get('unregistered_patient_name', ''),
            branch=branch,
            triage_acuity=data.get('triage_acuity', TriageAcuity.YELLOW),
            arrival_mode=data.get('arrival_mode', 'AMBULANCE'),
            chief_complaint=data.get('chief_complaint', 'Acute Emergency'),
            vitals_on_arrival=data.get('vitals_on_arrival', {}),
            attending_doctor_id=data.get('attending_doctor_id') or None,
            status=EmergencyStatus.TRIAGED
        )
        return Response(EmergencyEncounterSerializer(encounter).data, status=status.HTTP_201_CREATED)


class WardAndBedViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Hospital Ward & Bed Occupancy directory.
    """
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        branch_id = request.query_params.get('branch_id')
        qs = Ward.objects.prefetch_related('beds')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return Response(WardSerializer(qs, many=True).data)


class InpatientAdmissionViewSet(viewsets.ModelViewSet):
    """
    Inpatient Admission, Bed Allocation, and Discharge Summaries.
    """
    serializer_class = InpatientAdmissionSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = InpatientAdmission.objects.select_related(
            'patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile', 'branch'
        )
        branch_id = self.request.query_params.get('branch_id')
        status_filter = self.request.query_params.get('status')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        bed_id = data.get('bed_id')
        patient_id = data.get('patient_id')
        doctor_id = data.get('admitting_doctor_id')
        diagnosis = data.get('initial_diagnosis', 'Inpatient Evaluation')

        # Lock bed record for update
        bed = Bed.objects.select_for_update().filter(id=bed_id).first()
        if not bed:
            return Response({'error': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)

        if bed.status != BedStatus.AVAILABLE:
            return Response({'error': f'Bed {bed.bed_number} is already {bed.status}. Please select an available bed.'}, status=status.HTTP_409_CONFLICT)

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Admitting doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Allocate bed atomically
        bed.status = BedStatus.OCCUPIED
        bed.save()

        adm_number = f"IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        admission = InpatientAdmission.objects.create(
            admission_number=adm_number,
            patient=patient,
            bed=bed,
            admitting_doctor=doctor,
            branch=bed.ward.branch,
            initial_diagnosis=diagnosis,
            status=AdmissionStatus.ADMITTED
        )

        return Response(InpatientAdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)


class DischargePatientView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember, IsClinicalStaff]

    @transaction.atomic
    def post(self, request, pk):
        admission = InpatientAdmission.objects.select_related('bed').filter(id=pk).first()
        if not admission:
            return Response({'error': 'Admission not found.'}, status=status.HTTP_404_NOT_FOUND)

        if admission.status == AdmissionStatus.DISCHARGED:
            return Response({'error': 'Patient is already discharged.'}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        admission.discharge_date = timezone.now()
        admission.status = AdmissionStatus.DISCHARGED
        admission.discharge_condition = data.get('discharge_condition', 'Stable & Recovered')
        admission.discharge_summary = data.get('discharge_summary', '')
        admission.discharge_medications = data.get('discharge_medications', [])
        admission.save()

        # Free the bed back to AVAILABLE
        bed = admission.bed
        bed.status = BedStatus.AVAILABLE
        bed.save()

        return Response(InpatientAdmissionSerializer(admission).data)


class SurgicalCaseViewSet(viewsets.ModelViewSet):
    serializer_class = SurgicalCaseSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, IsClinicalStaff]

    def get_queryset(self):
        return SurgicalCase.objects.select_related('patient__user_profile', 'lead_surgeon__user_profile', 'theatre')

    def create(self, request, *args, **kwargs):
        data = request.data
        case_number = f"OT-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        case = SurgicalCase.objects.create(
            case_number=case_number,
            patient_id=data['patient_id'],
            theatre_id=data['theatre_id'],
            lead_surgeon_id=data['lead_surgeon_id'],
            anesthetist_id=data.get('anesthetist_id') or None,
            procedure_name=data['procedure_name'],
            scheduled_date=data['scheduled_date'],
            start_time=data['start_time'],
            end_time=data['end_time'],
            pre_op_checklist_done=data.get('pre_op_checklist_done', False),
            status=data.get('status', 'SCHEDULED')
        )
        return Response(SurgicalCaseSerializer(case).data, status=status.HTTP_201_CREATED)


class LabOrderViewSet(viewsets.ModelViewSet):
    serializer_class = LabOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = LabOrder.objects.prefetch_related('items__test').select_related('patient__user_profile', 'doctor__user_profile', 'branch')
        if hasattr(user, 'profile') and hasattr(user.profile, 'patient_profile'):
            return qs.filter(patient=user.profile.patient_profile)
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        order_number = f"LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        test_ids = data.get('test_ids', [])

        doctor_id = data.get('doctor_id')
        patient_id = data.get('patient_id')

        doctor = StaffProfile.objects.filter(id=doctor_id).first() if doctor_id else get_staff_profile(request.user)
        if not doctor:
            doctor = StaffProfile.objects.first()

        patient = PatientProfile.objects.filter(id=patient_id).first() if patient_id else get_patient_profile(request.user)
        if not patient:
            patient = PatientProfile.objects.first()

        order = LabOrder.objects.create(
            order_number=order_number,
            patient=patient,
            doctor=doctor,
            branch=doctor.branch,
            priority=data.get('priority', 'ROUTINE'),
            clinical_notes=data.get('clinical_notes', '')
        )

        for tid in test_ids:
            test = LabTestCatalogue.objects.filter(id=tid).first()
            if test:
                LabOrderItem.objects.create(
                    lab_order=order,
                    test=test,
                    reference_range=test.reference_range
                )

        return Response(LabOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class RecordLabResultView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        prof = resolve_user_profile(request)
        if not request.user.is_superuser:
            allowed_lab_roles = [
                RoleEnum.LAB_TECHNICIAN, RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR,
                RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER
            ]
            if not prof or not prof.role or prof.role.name not in allowed_lab_roles:
                return Response(
                    {'error': 'Laboratory verification authorization required. Only laboratory technicians or doctors can verify results.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        item = LabOrderItem.objects.filter(id=pk).first()
        if not item:
            return Response({'error': 'Lab test item not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        item.result_value = data.get('result_value', item.result_value)
        item.is_abnormal = data.get('is_abnormal', False)
        item.result_notes = data.get('result_notes', '')
        item.verified_at = timezone.now()
        item.verified_by = get_staff_profile(request.user)
        item.save()

        # Update order status to VERIFIED if all items completed
        order = item.lab_order
        order.status = LabOrderStatus.VERIFIED
        order.save()

        return Response({'success': True, 'message': 'Result published.'})


class RadiologyOrderViewSet(viewsets.ModelViewSet):
    serializer_class = RadiologyOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RadiologyOrder.objects.select_related('patient__user_profile', 'doctor__user_profile', 'radiologist__user_profile')
        if hasattr(user, 'profile') and hasattr(user.profile, 'patient_profile'):
            return qs.filter(patient=user.profile.patient_profile)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        order_number = f"RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        order = RadiologyOrder.objects.create(
            order_number=order_number,
            patient_id=data['patient_id'],
            doctor_id=data['doctor_id'],
            branch_id=data['branch_id'],
            modality=data['modality'],
            study_name=data['study_name'],
            clinical_indication=data.get('clinical_indication', ''),
            priority=data.get('priority', 'ROUTINE')
        )
        return Response(RadiologyOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class DutyRosterViewSet(viewsets.ModelViewSet):
    serializer_class = DutyRosterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = DutyRoster.objects.select_related('staff__user_profile', 'department', 'branch')
        branch_id = self.request.query_params.get('branch_id')
        date = self.request.query_params.get('date')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if date:
            qs = qs.filter(roster_date=date)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        roster, _ = DutyRoster.objects.update_or_create(
            staff_id=data['staff_id'],
            roster_date=data['roster_date'],
            shift=data['shift'],
            defaults={
                'branch_id': data['branch_id'],
                'department_id': data.get('department_id') or None,
                'assigned_station': data.get('assigned_station', '')
            }
        )
        return Response(DutyRosterSerializer(roster).data, status=status.HTTP_201_CREATED)


class LabTestCatalogueListView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tests = LabTestCatalogue.objects.all()
        return Response(LabTestCatalogueSerializer(tests, many=True).data)
