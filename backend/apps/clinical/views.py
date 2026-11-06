import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import (
    IsStaffMember, IsClinicalStaff, IsReadOnlyOrAdmin, IsReceptionistOnly, resolve_user_profile
)
from apps.core.activity_log_service import ActivityLogService
from apps.core.models import Branch, Department
from apps.billing_finance.models import Invoice, InvoiceStatus
from apps.authentication.models import PatientProfile, StaffProfile, RoleEnum
from apps.authentication.utils import get_staff_profile, get_patient_profile
from .opd_payment_service import (
    OPDPaymentError, validate_opd_payment_payload, settle_opd_appointment_and_payment
)
from .models import (
    DoctorSchedule, DoctorLeave, Appointment, AppointmentStatus,
    EmergencyEncounter, TriageAcuity, EmergencyStatus,
    Ward, Bed, BedStatus, InpatientAdmission, AdmissionStatus,
    DailyProgressNote, OperatingTheatre, SurgicalCase,
    LabTestCatalogue, LabOrder, LabOrderItem, LabOrderStatus,
    RadiologyOrder, DutyRoster,
    DoctorNotification, DoctorNotificationType
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
    OPD Consultations & Appointments API with strict Receptionist-Only booking,
    mandatory payment collection (Cash / Online), collision prevention, and queue token generation.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated, IsReadOnlyOrAdmin]
    rbac_module = 'OPD'

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsReceptionistOnly()]
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        # Auto-reconcile overdue past appointments to NO_SHOW if appointment_date < today
        today = timezone.localdate()
        try:
            Appointment.objects.filter(
                appointment_date__lt=today,
                status__in=[AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]
            ).update(status=AppointmentStatus.NO_SHOW)
        except Exception:
            pass

        user = self.request.user
        qs = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch', 'invoice'
        ).prefetch_related('invoice__payments__received_by__user_profile', 'invoice__payments__receipt')

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
        Book a scheduled OPD appointment with mandatory payment (Cash or Online)
        and strict Receptionist-only access control.
        """
        data = request.data
        doctor_id = data.get('doctor_id')
        appointment_date = data.get('appointment_date')
        time_slot = data.get('time_slot') or data.get('appointment_time') or '10:00:00'
        patient_id = data.get('patient_id')
        department_id = data.get('department_id')
        branch_id = data.get('branch_id')
        reason = data.get('reason_for_visit') or data.get('symptoms') or ''

        if not patient_id:
            return Response({'error': 'Patient identification is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not doctor_id:
            return Response({'error': 'Doctor selection is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not appointment_date:
            return Response({'error': 'Appointment date is required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.select_related('user_profile', 'primary_branch').filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Valid patient profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.select_related('user_profile', 'branch', 'department').filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        receptionist_profile = resolve_user_profile(request)
        receptionist_staff = getattr(receptionist_profile, 'staff_profile', None) or get_staff_profile(request.user)
        if not receptionist_staff:
            return Response({'error': 'Active Receptionist staff profile is required.'}, status=status.HTTP_403_FORBIDDEN)

        branch = (
            Branch.objects.filter(id=branch_id).first()
            or doctor.branch
            or receptionist_staff.branch
            or getattr(patient, 'primary_branch', None)
            or Branch.objects.first()
        )
        department = Department.objects.filter(id=department_id).first() or doctor.department or Department.objects.first()

        # Pre-check if doctor is on approved leave
        is_on_leave = DoctorLeave.objects.filter(
            doctor=doctor,
            start_date__lte=appointment_date,
            end_date__gte=appointment_date,
            is_approved=True
        ).exists()
        if is_on_leave:
            return Response(
                {'error': f"Dr. {doctor.user_profile.full_name} is on approved leave on {appointment_date} and is unavailable for appointments."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Pre-check Slot Collision before payment processing
        existing_slot = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=appointment_date,
            time_slot=time_slot
        ).exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]).exists()

        if existing_slot:
            return Response(
                {'error': f'Dr. {doctor.user_profile.last_name} already has an appointment scheduled at {time_slot} on {appointment_date}. Please choose another slot.'},
                status=status.HTTP_409_CONFLICT
            )

        # Validate mandatory payment (CASH or verified ONLINE) BEFORE creating Appointment or Token
        try:
            with transaction.atomic():
                # Lock any existing slot for this doctor/date/time
                locked_collision = Appointment.objects.select_for_update().filter(
                    doctor=doctor,
                    appointment_date=appointment_date,
                    time_slot=time_slot
                ).exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]).exists()
                if locked_collision:
                    return Response(
                        {'error': f'Dr. {doctor.user_profile.last_name} already has an appointment scheduled at {time_slot} on {appointment_date}. Please choose another slot.'},
                        status=status.HTTP_409_CONFLICT
                    )

                validated_payment = validate_opd_payment_payload(
                    data=data,
                    patient=patient,
                    doctor=doctor,
                    department=department,
                    receptionist_staff=receptionist_staff,
                    request=request,
                )

                # Only AFTER successful payment validation: confirm appointment & generate token
                daily_count = Appointment.objects.select_for_update().filter(
                    doctor=doctor,
                    appointment_date=appointment_date
                ).count()
                token = f"Token #{daily_count + 1}"
                apt_number = f"APT-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

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
                    booking_source='FRONT_DESK',
                    status=AppointmentStatus.SCHEDULED
                )

                settlement = settle_opd_appointment_and_payment(
                    appointment=appointment,
                    validated_payment=validated_payment,
                    receptionist_staff=receptionist_staff,
                    request=request,
                )

                if appointment.doctor:
                    try:
                        DoctorNotification.objects.create(
                            recipient_doctor=appointment.doctor,
                            branch=branch,
                            notification_type=DoctorNotificationType.APPOINTMENT_ASSIGNED,
                            title=f"New Appointment: {patient.user_profile.full_name}",
                            message=f"{token} scheduled for {appointment.appointment_date} at {appointment.time_slot} ({reason or 'Consultation'}).",
                            priority='ROUTINE',
                            patient=patient,
                            target_url=f"/staff/doctor-workspace?tab=queue",
                            metadata={'appointment_id': str(appointment.id), 'appointment_number': appointment.appointment_number}
                        )
                    except Exception:
                        pass
        except OPDPaymentError as exc:
            err_payload = {'error': exc.message, **exc.extra}
            return Response(err_payload, status=exc.status_code)

        response_data = dict(AppointmentSerializer(appointment).data)
        response_data['receipt'] = settlement['receipt_payload']
        response_data['token_receipt'] = settlement['receipt_payload']
        response_data['payment_status'] = 'PAID'
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status == AppointmentStatus.COMPLETED:
            return Response({'error': 'Cannot cancel an appointment that is already completed.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason') or ('Cancelled by patient' if get_patient_profile(request.user) else 'Cancelled by doctor/staff')
        old_status = appointment.status
        appointment.status = AppointmentStatus.CANCELLED
        appointment.cancellation_reason = reason
        appointment.save()

        try:
            from apps.core.activity_log_service import ActivityLogService
            ActivityLogService.record(
                action='APPOINTMENT_CANCELLED',
                entity_type='Appointment',
                entity_id=str(appointment.id),
                module='OPD',
                request=request,
                branch=appointment.branch,
                old_values={'status': old_status},
                new_values={'status': appointment.status, 'reason': reason},
            )
        except Exception:
            pass

        return Response(AppointmentSerializer(appointment).data)


class UpdateAppointmentStatusView(views.APIView):
    permission_classes = [IsAuthenticated, IsStaffMember, IsReadOnlyOrAdmin]
    rbac_module = 'OPD'

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
    permission_classes = [IsAuthenticated, IsStaffMember, IsClinicalStaff, IsReadOnlyOrAdmin]
    rbac_module = 'OPD'

    def post(self, request, pk):
        if not request.user.is_superuser:
            prof = resolve_user_profile(request)
            if not prof or not prof.role or prof.role.name not in [RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR, RoleEnum.DEPARTMENT_HEAD, RoleEnum.SUPER_ADMIN]:
                ActivityLogService.record(
                    action='CONSULTATION_RECORD_DENIED',
                    entity_type='Appointment',
                    entity_id=str(pk),
                    module='OPD',
                    request=request,
                    user_profile=prof,
                    status='DENIED',
                    description="Unauthorized attempt to record medical diagnosis/consultation. Only Doctors can record diagnoses.",
                )
                return Response(
                    {'error': 'Only licensed Doctors can record medical diagnoses and finalize consultations.'},
                    status=status.HTTP_403_FORBIDDEN
                )

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

        ActivityLogService.record(
            action='DOCTOR_CONSULTATION_COMPLETED',
            entity_type='Appointment',
            entity_id=str(appointment.id),
            module='OPD',
            request=request,
            branch=appointment.branch,
            new_values={'appointment_number': appointment.appointment_number, 'diagnosis': appointment.diagnosis},
            description=f"Completed consultation {appointment.appointment_number} with diagnosis: {appointment.diagnosis}.",
        )
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
        bed_id = data.get('bed_id') or data.get('bed')
        patient_id = data.get('patient_id') or data.get('patient')
        doctor_id = data.get('admitting_doctor_id') or data.get('admitting_doctor')
        diagnosis = data.get('initial_diagnosis', 'Inpatient Evaluation')
        priority = data.get('priority', 'ROUTINE')
        requested_ward_type = data.get('requested_ward_type', '')
        admission_source = data.get('admission_source', 'DIRECT')
        deposit = Decimal(str(data.get('admission_deposit') or 0.00))

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=doctor_id).first()
        if not doctor:
            doctor = StaffProfile.objects.first()

        branch = doctor.branch if doctor else getattr(patient, 'primary_branch', None)

        bed = None
        if bed_id:
            bed = Bed.objects.select_for_update().filter(id=bed_id).first()
            if not bed:
                return Response({'error': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)
            if bed.status != BedStatus.AVAILABLE:
                return Response({'error': f'Bed {bed.bed_number} is already {bed.status}. Please select an available bed.'}, status=status.HTTP_409_CONFLICT)
            bed.status = BedStatus.OCCUPIED
            bed.save()
            branch = bed.ward.branch

        adm_number = f"IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        admission = InpatientAdmission.objects.create(
            admission_number=adm_number,
            patient=patient,
            bed=bed,
            admitting_doctor=doctor,
            branch=branch,
            admission_source=admission_source,
            priority=priority,
            requested_ward_type=requested_ward_type,
            initial_diagnosis=diagnosis,
            admission_deposit=deposit,
            status=AdmissionStatus.ADMITTED if bed else AdmissionStatus.REQUESTED
        )

        # Initialize running IPD bill
        if branch:
            inv_number = f"INV-IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            invoice = Invoice.objects.create(
                invoice_number=inv_number,
                patient=patient,
                branch=branch,
                admission=admission,
                encounter_type='IPD',
                is_interim=True,
                subtotal=Decimal('0.00'),
                total_amount=Decimal('0.00'),
                deposit_applied_amount=deposit,
                paid_amount=deposit,
                balance_amount=Decimal('0.00'),
                status=InvoiceStatus.ISSUED,
                notes=f"Inpatient Stay #{adm_number}"
            )
            admission.invoice = invoice
            admission.save(update_fields=['invoice'])

        if bed and admission.admitting_doctor:
            try:
                DoctorNotification.objects.create(
                    recipient_doctor=admission.admitting_doctor,
                    branch=branch,
                    notification_type=DoctorNotificationType.INPATIENT_ALERT,
                    title=f"Bed Allocated: {patient.user_profile.full_name}",
                    message=f"Bed {bed.bed_number} ({bed.ward.name}) allocated for {patient.user_profile.full_name}.",
                    priority='ROUTINE',
                    patient=patient,
                    target_url=f"/staff/inpatient?admission={admission.id}",
                    metadata={'admission_id': str(admission.id), 'bed_number': bed.bed_number}
                )
            except Exception:
                pass

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

        # Free the bed (AVAILABLE by default, or CLEANING if explicit turnover required)
        bed = admission.bed
        if bed:
            requires_cleaning = data.get('requires_cleaning', False)
            bed.status = BedStatus.CLEANING if requires_cleaning else BedStatus.AVAILABLE
            bed.save(update_fields=['status'])

        # Finalize bed charges on invoice if present
        if admission.invoice and bed:
            diff_days = max(1, (admission.discharge_date - admission.admission_date).days)
            bed_cost = Decimal(str(diff_days)) * bed.daily_rate
            existing_bed_item = admission.invoice.items.filter(item_type='BED_CHARGE').first()
            if not existing_bed_item:
                from apps.billing_finance.models import InvoiceItem, ChargeItemType
                InvoiceItem.objects.create(
                    invoice=admission.invoice,
                    item_type=ChargeItemType.BED_CHARGE,
                    description=f"Bed Charges ({diff_days} days @ ₹{bed.daily_rate}/day) - {bed.ward.name} Bed {bed.bed_number}",
                    quantity=diff_days,
                    unit_price=bed.daily_rate,
                    subtotal=bed_cost
                )
                admission.invoice.recalculate_totals()

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
        pat_profile = getattr(user, 'profile', None) and getattr(user.profile, 'patient_profile', None)
        if not pat_profile:
            pat_profile = get_patient_profile(user)
        if pat_profile:
            return qs.filter(patient=pat_profile)
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
    permission_classes = [IsAuthenticated, IsStaffMember, IsReadOnlyOrAdmin]
    rbac_module = 'LAB'

    def post(self, request, pk):
        prof = resolve_user_profile(request)
        if not request.user.is_superuser:
            allowed_lab_roles = [
                RoleEnum.LAB_TECHNICIAN, RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR,
                RoleEnum.DEPARTMENT_HEAD, RoleEnum.SUPER_ADMIN
            ]
            if not prof or not prof.role or prof.role.name not in allowed_lab_roles:
                ActivityLogService.record(
                    action='LAB_RESULT_MODIFY_DENIED',
                    entity_type='LabOrderItem',
                    entity_id=str(pk),
                    module='LAB',
                    request=request,
                    user_profile=prof,
                    status='DENIED',
                    description="Unauthorized attempt to enter or modify laboratory test result.",
                )
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

        ActivityLogService.record(
            action='LAB_RESULT_VERIFIED',
            entity_type='LabOrderItem',
            entity_id=str(item.id),
            module='LAB',
            request=request,
            branch=order.branch,
            new_values={'order_number': order.order_number, 'result_value': item.result_value, 'is_abnormal': item.is_abnormal},
            description=f"Entered and verified laboratory result for {order.order_number}.",
        )
        return Response({'success': True, 'message': 'Result published.'})


class RadiologyOrderViewSet(viewsets.ModelViewSet):
    serializer_class = RadiologyOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RadiologyOrder.objects.select_related('patient__user_profile', 'doctor__user_profile', 'radiologist__user_profile')
        pat_profile = getattr(user, 'profile', None) and getattr(user.profile, 'patient_profile', None)
        if not pat_profile:
            pat_profile = get_patient_profile(user)
        if pat_profile:
            return qs.filter(patient=pat_profile)
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
