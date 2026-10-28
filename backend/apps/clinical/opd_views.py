import uuid
from datetime import datetime, timedelta, date, time
from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg, F
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember
from apps.core.models import Branch, Department, AuditLog
from apps.authentication.models import PatientProfile, StaffProfile, UserProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType
from apps.pharmacy_inventory.models import Medicine, Prescription, PrescriptionItem
from .models import (
    Appointment, AppointmentStatus, AppointmentType,
    DoctorSchedule, DoctorLeave,
    LabTestCatalogue, LabOrder, LabOrderItem, LabOrderStatus,
    RadiologyOrder, ModalityEnum
)
from .serializers import (
    AppointmentSerializer, DoctorScheduleSerializer, DoctorLeaveSerializer,
    LabTestCatalogueSerializer, LabOrderSerializer, RadiologyOrderSerializer
)


def log_audit(user, action, entity_type, entity_id, branch=None, old_val=None, new_val=None):
    """Helper to record audit trail for clinical/OPD actions."""
    try:
        actor_uid = getattr(user, 'supabase_uid', None) or getattr(user, 'id', None)
        AuditLog.objects.create(
            actor_user_id=actor_uid,
            actor_email=getattr(user, 'email', ''),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            branch=branch,
            old_values=old_val,
            new_values=new_val
        )
    except Exception:
        pass


def get_or_create_consultation_invoice(appointment, created_by=None):
    """Ensure an invoice exists for the consultation fee."""
    if appointment.invoice:
        return appointment.invoice

    doctor = appointment.doctor
    fee = doctor.consultation_fee or Decimal('500.00')
    branch = appointment.branch or doctor.branch

    today_str = timezone.now().strftime('%Y%m%d')
    unique_suffix = uuid.uuid4().hex[:6].upper()
    inv_number = f"INV-OPD-{today_str}-{unique_suffix}"

    with transaction.atomic():
        invoice = Invoice.objects.create(
            invoice_number=inv_number,
            patient=appointment.patient,
            branch=branch,
            invoice_date=timezone.now().date(),
            subtotal=fee,
            total_amount=fee,
            balance_amount=fee,
            status=InvoiceStatus.ISSUED,
            notes=f"OPD Consultation with Dr. {doctor.user_profile.full_name} ({appointment.appointment_number})"
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            item_type=ChargeItemType.CONSULTATION,
            description=f"OPD Consultation - Dr. {doctor.user_profile.full_name} ({doctor.specialization or 'Specialist'})",
            quantity=1,
            unit_price=fee,
            subtotal=fee
        )
        appointment.invoice = invoice
        appointment.save(update_fields=['invoice'])
    return invoice


class OPDDashboardStatsView(views.APIView):
    """
    Real-time database-driven OPD KPIs and Statistics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query_date_str = request.query_params.get('date')
        if query_date_str:
            try:
                target_date = datetime.strptime(query_date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = timezone.now().date()
        else:
            target_date = timezone.now().date()

        branch_id = request.query_params.get('branch_id')
        doctor_id = request.query_params.get('doctor_id')
        department_id = request.query_params.get('department_id')

        qs = Appointment.objects.filter(appointment_date=target_date)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if department_id:
            qs = qs.filter(department_id=department_id)

        # Basic status counts
        total = qs.count()
        scheduled = qs.filter(status=AppointmentStatus.SCHEDULED).count()
        checked_in = qs.filter(status=AppointmentStatus.CHECKED_IN).count()
        in_consultation = qs.filter(status=AppointmentStatus.IN_CONSULTATION).count()
        completed = qs.filter(status=AppointmentStatus.COMPLETED).count()
        cancelled = qs.filter(status=AppointmentStatus.CANCELLED).count()
        no_show = qs.filter(status=AppointmentStatus.NO_SHOW).count()

        # Type counts
        walk_in_count = qs.filter(appointment_type=AppointmentType.WALK_IN).count()
        scheduled_type_count = qs.filter(appointment_type=AppointmentType.SCHEDULED).count()

        # Average waiting time calculation (in minutes)
        # Waiting time = consultation_started_at - checked_in_at
        appts_with_wait = qs.filter(
            checked_in_at__isnull=False,
            consultation_started_at__isnull=False
        )
        total_wait_sec = 0
        wait_count = 0
        for appt in appts_with_wait:
            if appt.consultation_started_at > appt.checked_in_at:
                diff = (appt.consultation_started_at - appt.checked_in_at).total_seconds()
                total_wait_sec += diff
                wait_count += 1

        avg_wait_minutes = round((total_wait_sec / wait_count) / 60, 1) if wait_count > 0 else 0

        # Available doctors today
        # Map weekday 0=Mon to 'MON'
        day_mapping = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
        target_day_code = day_mapping[target_date.weekday()]

        scheduled_doc_ids = DoctorSchedule.objects.filter(
            day_of_week=target_day_code,
            is_available=True
        ).values_list('doctor_id', flat=True).distinct()

        # Filter out doctors on leave on target_date
        on_leave_doc_ids = DoctorLeave.objects.filter(
            start_date__lte=target_date,
            end_date__gte=target_date,
            is_approved=True
        ).values_list('doctor_id', flat=True)

        available_doctor_count = len(set(scheduled_doc_ids) - set(on_leave_doc_ids))

        # Pending follow-ups
        pending_follow_ups = Appointment.objects.filter(
            follow_up_date__gte=target_date
        ).count()

        return Response({
            'date': str(target_date),
            'total_appointments': total,
            'scheduled': scheduled,
            'checked_in': checked_in,
            'waiting': checked_in,
            'in_consultation': in_consultation,
            'completed': completed,
            'cancelled': cancelled,
            'no_show': no_show,
            'walk_in_count': walk_in_count,
            'scheduled_type_count': scheduled_type_count,
            'average_wait_minutes': avg_wait_minutes,
            'available_doctors_count': available_doctor_count,
            'pending_follow_ups': pending_follow_ups
        })


class DoctorAvailableSlotsView(views.APIView):
    """
    Computes real-time bookable slots for a doctor on a given date.
    Accounts for weekly schedules, approved leaves, and booked appointments.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, doctor_id):
        query_date_str = request.query_params.get('date')
        if not query_date_str:
            return Response({'error': 'date parameter (YYYY-MM-DD) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.strptime(query_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor = StaffProfile.objects.filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        # 1. Check if doctor is on approved leave
        leave = DoctorLeave.objects.filter(
            doctor=doctor,
            start_date__lte=target_date,
            end_date__gte=target_date,
            is_approved=True
        ).first()

        if leave:
            return Response({
                'doctor_id': str(doctor.id),
                'doctor_name': doctor.user_profile.full_name,
                'date': str(target_date),
                'is_on_leave': True,
                'leave_reason': leave.reason or 'On Approved Leave',
                'slots': []
            })

        # 2. Check weekly schedule
        day_mapping = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
        target_day_code = day_mapping[target_date.weekday()]

        schedules = DoctorSchedule.objects.filter(
            doctor=doctor,
            day_of_week=target_day_code,
            is_available=True
        ).order_by('start_time')

        if not schedules.exists():
            return Response({
                'doctor_id': str(doctor.id),
                'doctor_name': doctor.user_profile.full_name,
                'date': str(target_date),
                'is_on_leave': False,
                'message': f'Dr. {doctor.user_profile.last_name} has no scheduled clinic hours on {target_date.strftime("%A")}.',
                'slots': []
            })

        # 3. Fetch existing booked appointments for that doctor on target_date
        booked_appts = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=target_date
        ).exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW])

        booked_slots_map = {appt.time_slot: appt for appt in booked_appts}

        # 4. Generate discrete time slots
        slots = []
        for sched in schedules:
            curr_dt = datetime.combine(target_date, sched.start_time)
            end_dt = datetime.combine(target_date, sched.end_time)
            delta = timedelta(minutes=sched.slot_duration_minutes)

            while curr_dt + delta <= end_dt:
                slot_start = curr_dt.strftime('%H:%M')
                slot_end = (curr_dt + delta).strftime('%H:%M')
                slot_label = f"{slot_start} - {slot_end}"

                is_booked = slot_label in booked_slots_map
                appt_info = None
                if is_booked:
                    appt = booked_slots_map[slot_label]
                    appt_info = {
                        'appointment_id': str(appt.id),
                        'patient_name': appt.patient.user_profile.full_name,
                        'appointment_number': appt.appointment_number,
                        'status': appt.status
                    }

                slots.append({
                    'slot': slot_label,
                    'start_time': slot_start,
                    'end_time': slot_end,
                    'is_booked': is_booked,
                    'appointment': appt_info
                })
                curr_dt += delta

        return Response({
            'doctor_id': str(doctor.id),
            'doctor_name': doctor.user_profile.full_name,
            'specialization': doctor.specialization,
            'department_name': doctor.department.name if doctor.department else 'General',
            'consultation_fee': str(doctor.consultation_fee or Decimal('500.00')),
            'date': str(target_date),
            'is_on_leave': False,
            'slots': slots
        })


class DoctorScheduleViewSet(viewsets.ModelViewSet):
    """
    CRUD for Doctor Working Hours and Weekly Roster.
    """
    serializer_class = DoctorScheduleSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = DoctorSchedule.objects.select_related('doctor__user_profile')
        doctor_id = self.request.query_params.get('doctor_id')
        day = self.request.query_params.get('day')
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if day:
            qs = qs.filter(day_of_week=day)
        return qs


class DoctorLeaveViewSet(viewsets.ModelViewSet):
    """
    CRUD for Doctor Leaves and Unavailability Windows.
    """
    serializer_class = DoctorLeaveSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = DoctorLeave.objects.select_related('doctor__user_profile')
        doctor_id = self.request.query_params.get('doctor_id')
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        return qs


class OPDWalkInRegistrationView(views.APIView):
    """
    Walk-in Patient OPD Registration and Atomic Queue Token Generation.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request):
        data = request.data
        patient_id = data.get('patient_id')
        doctor_id = data.get('doctor_id')
        department_id = data.get('department_id')
        branch_id = data.get('branch_id')
        chief_complaint = data.get('chief_complaint', '')
        reason_for_visit = data.get('reason_for_visit', chief_complaint or 'OPD Walk-in Consultation')
        vitals = data.get('vitals', {})

        if not patient_id:
            return Response({'error': 'Patient is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not doctor_id:
            return Response({'error': 'Doctor is required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(id=branch_id).first() or doctor.branch or Branch.objects.first()
        department = Department.objects.filter(id=department_id).first() or doctor.department

        today = timezone.now().date()
        now_time_str = timezone.now().strftime('%H:%M')

        with transaction.atomic():
            # Generate atomic daily token number for this doctor queue
            daily_count = Appointment.objects.filter(
                doctor=doctor,
                appointment_date=today
            ).count()

            token_str = f"Token #{daily_count + 1}"
            slot_label = f"Walk-in ({now_time_str})"
            apt_number = f"APT-WI-{today.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

            appointment = Appointment.objects.create(
                appointment_number=apt_number,
                appointment_type=AppointmentType.WALK_IN,
                booking_source='FRONT_DESK',
                patient=patient,
                doctor=doctor,
                department=department,
                branch=branch,
                appointment_date=today,
                time_slot=slot_label,
                token_number=token_str,
                status=AppointmentStatus.CHECKED_IN,
                checked_in_at=timezone.now(),
                reason_for_visit=reason_for_visit,
                chief_complaint=chief_complaint,
                vitals=vitals
            )

            # Auto-generate consultation fee invoice
            invoice = get_or_create_consultation_invoice(appointment, created_by=request.user)

            log_audit(
                request.user,
                action='OPD_WALK_IN_REGISTERED',
                entity_type='Appointment',
                entity_id=appointment.id,
                branch=branch,
                new_val={'token': token_str, 'patient_mrn': patient.medical_record_number, 'doctor': doctor.user_profile.full_name}
            )

        serializer = AppointmentSerializer(appointment)
        return Response({
            'message': f"Walk-in registered successfully. {token_str} issued.",
            'appointment': serializer.data,
            'token_receipt': {
                'token_number': token_str,
                'appointment_number': apt_number,
                'patient_name': patient.user_profile.full_name,
                'patient_mrn': patient.medical_record_number,
                'doctor_name': doctor.user_profile.full_name,
                'specialization': doctor.specialization,
                'department_name': department.name if department else '',
                'date': str(today),
                'check_in_time': timezone.now().strftime('%H:%M:%S'),
                'consultation_fee': str(doctor.consultation_fee or Decimal('500.00')),
                'invoice_number': invoice.invoice_number if invoice else None
            }
        }, status=status.HTTP_201_CREATED)


class OPDQueueView(views.APIView):
    """
    Live, real-time Patient Queue View for staff and doctors.
    Includes wait duration and real-time statuses.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        query_date_str = request.query_params.get('date')
        if query_date_str:
            try:
                target_date = datetime.strptime(query_date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = timezone.now().date()
        else:
            target_date = timezone.now().date()

        doctor_id = request.query_params.get('doctor_id')
        department_id = request.query_params.get('department_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        qs = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch', 'invoice'
        ).filter(appointment_date=target_date)

        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if department_id:
            qs = qs.filter(department_id=department_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(patient__user_profile__first_name__icontains=search) |
                Q(patient__user_profile__last_name__icontains=search) |
                Q(patient__medical_record_number__icontains=search) |
                Q(appointment_number__icontains=search) |
                Q(token_number__icontains=search)
            )

        now = timezone.now()
        queue_items = []
        for appt in qs:
            wait_minutes = 0
            if appt.checked_in_at:
                end_time = appt.consultation_started_at or now
                wait_minutes = max(0, round((end_time - appt.checked_in_at).total_seconds() / 60))

            queue_items.append({
                'id': str(appt.id),
                'appointment_number': appt.appointment_number,
                'token_number': appt.token_number or '—',
                'appointment_type': appt.appointment_type,
                'status': appt.status,
                'time_slot': appt.time_slot,
                'patient_id': str(appt.patient.id),
                'patient_name': appt.patient.user_profile.full_name,
                'patient_mrn': appt.patient.medical_record_number,
                'patient_gender': appt.patient.gender,
                'patient_blood_group': appt.patient.blood_group,
                'patient_allergies': appt.patient.allergies or [],
                'doctor_id': str(appt.doctor.id),
                'doctor_name': appt.doctor.user_profile.full_name,
                'doctor_specialization': appt.doctor.specialization,
                'doctor_fee': str(appt.doctor.consultation_fee or Decimal('500.00')),
                'department_name': appt.department.name if appt.department else '',
                'reason_for_visit': appt.reason_for_visit,
                'chief_complaint': appt.chief_complaint,
                'checked_in_at': appt.checked_in_at.isoformat() if appt.checked_in_at else None,
                'consultation_started_at': appt.consultation_started_at.isoformat() if appt.consultation_started_at else None,
                'consultation_ended_at': appt.consultation_ended_at.isoformat() if appt.consultation_ended_at else None,
                'wait_minutes': wait_minutes,
                'invoice_number': appt.invoice.invoice_number if appt.invoice else None,
                'invoice_status': appt.invoice.status if appt.invoice else None
            })

        # Sort priority: IN_CONSULTATION (0), CHECKED_IN (1), SCHEDULED (2), COMPLETED (3), CANCELLED/NO_SHOW (4)
        def sort_priority(item):
            st = item['status']
            if st == AppointmentStatus.IN_CONSULTATION:
                return (0, item['time_slot'])
            elif st == AppointmentStatus.CHECKED_IN:
                return (1, item['token_number'])
            elif st == AppointmentStatus.SCHEDULED:
                return (2, item['time_slot'])
            elif st == AppointmentStatus.COMPLETED:
                return (3, item['time_slot'])
            else:
                return (4, item['time_slot'])

        queue_items.sort(key=sort_priority)
        return Response(queue_items)


class OPDQueueActionView(views.APIView):
    """
    Execute queue actions: CHECK_IN, CALL_NEXT / START_CONSULTATION, COMPLETE, NO_SHOW, CANCEL.
    Enforces valid state machine transitions.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        appointment = Appointment.objects.filter(id=pk).first()
        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        now = timezone.now()
        old_status = appointment.status

        if action == 'CHECK_IN':
            if appointment.status in [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED]:
                return Response({'error': f'Cannot check in an appointment that is {appointment.status}.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.CHECKED_IN
            appointment.checked_in_at = now
            # Ensure consultation invoice is created
            get_or_create_consultation_invoice(appointment, created_by=request.user)

        elif action in ['START_CONSULTATION', 'CALL_NEXT']:
            if appointment.status in [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]:
                return Response({'error': f'Cannot start consultation for an appointment that is {appointment.status}.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.IN_CONSULTATION
            if not appointment.checked_in_at:
                appointment.checked_in_at = now
            appointment.consultation_started_at = now

        elif action == 'COMPLETE':
            appointment.status = AppointmentStatus.COMPLETED
            appointment.consultation_ended_at = now

        elif action == 'NO_SHOW':
            if appointment.status == AppointmentStatus.COMPLETED:
                return Response({'error': 'Cannot mark a completed appointment as No Show.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.NO_SHOW

        elif action == 'CANCEL':
            if appointment.status == AppointmentStatus.COMPLETED:
                return Response({'error': 'Cannot cancel an appointment that is already completed.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.CANCELLED
            appointment.cancellation_reason = request.data.get('reason', 'Cancelled by staff')

        else:
            return Response({'error': f'Unknown action "{action}".'}, status=status.HTTP_400_BAD_REQUEST)

        appointment.save()

        log_audit(
            request.user,
            action=f"OPD_QUEUE_{action}",
            entity_type='Appointment',
            entity_id=appointment.id,
            branch=appointment.branch,
            old_val={'status': old_status},
            new_val={'status': appointment.status}
        )

        return Response(AppointmentSerializer(appointment).data)


class OPDConsultationEncounterView(views.APIView):
    """
    Doctor Consultation Workspace & Finalization.
    Links Section 5 EMR, diagnoses, electronic prescriptions, lab/radiology orders,
    follow-up recommendations, and consultation fee billing.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request, pk):
        """Fetch clinical workspace context including patient Section 5 EMR summary."""
        appointment = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch', 'invoice'
        ).filter(id=pk).first()

        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        patient = appointment.patient
        user_p = patient.user_profile

        # Section 5 Patient EMR Summary
        emr_summary = {
            'patient_id': str(patient.id),
            'full_name': user_p.full_name,
            'mrn': patient.medical_record_number,
            'gender': patient.gender,
            'blood_group': patient.blood_group,
            'date_of_birth': str(patient.date_of_birth) if patient.date_of_birth else None,
            'phone_number': user_p.phone_number,
            'allergies': patient.allergies or [],
            'chronic_conditions': patient.chronic_conditions or [],
            'past_surgeries': patient.past_surgeries or [],
            'current_medications': patient.current_medications or [],
            'emergency_contact_name': patient.emergency_contact_name,
            'emergency_contact_phone': patient.emergency_contact_phone,
            'insurance_provider': patient.insurance_provider,
            'insurance_policy_number': patient.insurance_policy_number
        }

        # Past consultations for this patient
        past_consultations = Appointment.objects.filter(
            patient=patient,
            status=AppointmentStatus.COMPLETED
        ).exclude(id=appointment.id).order_by('-appointment_date')[:5]

        past_history = []
        for past in past_consultations:
            past_history.append({
                'id': str(past.id),
                'date': str(past.appointment_date),
                'doctor_name': past.doctor.user_profile.full_name,
                'diagnosis': past.diagnosis,
                'treatment_plan': past.treatment_plan,
                'prescription_summary': past.prescription_summary
            })

        # Test catalogue for ordering
        lab_catalogue = LabTestCatalogue.objects.all().values('id', 'code', 'name', 'category', 'standard_rate')
        medicines = Medicine.objects.all().values('id', 'code', 'brand_name', 'generic_name', 'dosage_form', 'strength')

        return Response({
            'appointment': AppointmentSerializer(appointment).data,
            'emr_summary': emr_summary,
            'past_consultations': past_history,
            'lab_catalogue': list(lab_catalogue),
            'medicines': list(medicines)
        })

    def post(self, request, pk):
        """
        Finalize consultation with comprehensive clinical record,
        E-Prescriptions, Lab/Radiology orders, follow-up scheduling, and billing.
        """
        appointment = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'branch', 'department'
        ).filter(id=pk).first()

        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        doctor = appointment.doctor
        patient = appointment.patient
        branch = appointment.branch or doctor.branch

        with transaction.atomic():
            # 1. Update Consultation Fields
            appointment.chief_complaint = data.get('chief_complaint', appointment.chief_complaint)
            appointment.examination_findings = data.get('examination_findings', appointment.examination_findings)
            appointment.diagnosis = data.get('diagnosis', appointment.diagnosis)
            appointment.treatment_plan = data.get('treatment_plan', appointment.treatment_plan)
            appointment.consultation_notes = data.get('consultation_notes', appointment.consultation_notes)
            appointment.follow_up_instructions = data.get('follow_up_instructions', appointment.follow_up_instructions)
            appointment.vitals = data.get('vitals', appointment.vitals)

            follow_up_date_str = data.get('follow_up_date')
            if follow_up_date_str:
                try:
                    appointment.follow_up_date = datetime.strptime(follow_up_date_str, '%Y-%m-%d').date()
                except ValueError:
                    pass

            appointment.status = AppointmentStatus.COMPLETED
            if not appointment.consultation_started_at:
                appointment.consultation_started_at = timezone.now() - timedelta(minutes=15)
            appointment.consultation_ended_at = timezone.now()

            # 2. Electronic Prescription Integration
            prescription_items_data = data.get('prescriptions', [])
            presc_summary_lines = []
            if prescription_items_data:
                presc_number = f"RX-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                prescription = Prescription.objects.create(
                    prescription_number=presc_number,
                    patient=patient,
                    doctor=doctor,
                    branch=branch,
                    diagnosis=appointment.diagnosis or 'OPD Assessment',
                    clinical_notes=appointment.treatment_plan or ''
                )

                for item in prescription_items_data:
                    med_id = item.get('medicine_id')
                    med = Medicine.objects.filter(id=med_id).first() if med_id else None
                    if med:
                        dosage = item.get('dosage', '1 Tablet')
                        freq = item.get('frequency', '1-0-1')
                        dur = int(item.get('duration_days', 5))
                        qty = int(item.get('total_quantity', 10))
                        inst = item.get('instructions', 'After meals')

                        PrescriptionItem.objects.create(
                            prescription=prescription,
                            medicine=med,
                            dosage=dosage,
                            frequency=freq,
                            duration_days=dur,
                            total_quantity=qty,
                            instructions=inst
                        )
                        presc_summary_lines.append(f"{med.brand_name} ({med.strength}) - {dosage} {freq} x {dur}d")

                appointment.prescription_summary = "; ".join(presc_summary_lines)

            # 3. Diagnostic Lab Orders
            lab_test_ids = data.get('lab_test_ids', [])
            if lab_test_ids:
                lab_order_num = f"LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                lab_order = LabOrder.objects.create(
                    order_number=lab_order_num,
                    patient=patient,
                    doctor=doctor,
                    branch=branch,
                    priority=data.get('lab_priority', 'ROUTINE'),
                    clinical_notes=f"Ordered during OPD consultation: {appointment.diagnosis}"
                )
                for tid in lab_test_ids:
                    test = LabTestCatalogue.objects.filter(id=tid).first()
                    if test:
                        LabOrderItem.objects.create(
                            lab_order=lab_order,
                            test=test,
                            reference_range=test.reference_range
                        )

            # 4. Radiology Orders
            radiology_orders_data = data.get('radiology_orders', [])
            for rad in radiology_orders_data:
                rad_num = f"RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                RadiologyOrder.objects.create(
                    order_number=rad_num,
                    patient=patient,
                    doctor=doctor,
                    branch=branch,
                    modality=rad.get('modality', ModalityEnum.X_RAY),
                    study_name=rad.get('study_name', 'Chest X-Ray PA View'),
                    clinical_indication=rad.get('clinical_indication', appointment.diagnosis),
                    priority=rad.get('priority', 'ROUTINE')
                )

            # 5. Book Follow-up Appointment if requested
            book_follow_up = data.get('book_follow_up', False)
            if book_follow_up and appointment.follow_up_date:
                fu_slot = data.get('follow_up_time_slot', '10:00 - 10:15')
                fu_apt_num = f"APT-FU-{appointment.follow_up_date.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

                # Ensure doctor doesn't have collision
                collision = Appointment.objects.filter(
                    doctor=doctor,
                    appointment_date=appointment.follow_up_date,
                    time_slot=fu_slot
                ).exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]).exists()

                if not collision:
                    Appointment.objects.create(
                        appointment_number=fu_apt_num,
                        appointment_type=AppointmentType.SCHEDULED,
                        booking_source='FOLLOW_UP',
                        patient=patient,
                        doctor=doctor,
                        department=appointment.department,
                        branch=branch,
                        appointment_date=appointment.follow_up_date,
                        time_slot=fu_slot,
                        status=AppointmentStatus.SCHEDULED,
                        reason_for_visit=f"Follow-up for: {appointment.diagnosis or 'Consultation'}"
                    )

            # 6. Ensure consultation fee invoice is generated
            get_or_create_consultation_invoice(appointment, created_by=request.user)

            appointment.save()

            log_audit(
                request.user,
                action='OPD_CONSULTATION_FINALIZED',
                entity_type='Appointment',
                entity_id=appointment.id,
                branch=branch,
                new_val={'diagnosis': appointment.diagnosis, 'prescription_items_count': len(prescription_items_data)}
            )

        return Response({
            'message': 'Consultation finalized and saved to patient EMR successfully.',
            'appointment': AppointmentSerializer(appointment).data
        })


class OPDReportsView(views.APIView):
    """
    Doctor-wise, Specialty-wise, and Department-wise OPD Analytics and Financial Reports.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        today = timezone.now().date()
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else today - timedelta(days=30)
        except ValueError:
            start_date = today - timedelta(days=30)

        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else today
        except ValueError:
            end_date = today

        branch_id = request.query_params.get('branch_id')
        doctor_id = request.query_params.get('doctor_id')
        department_id = request.query_params.get('department_id')

        qs = Appointment.objects.select_related(
            'doctor__user_profile', 'department', 'invoice'
        ).filter(appointment_date__range=[start_date, end_date])

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)
        if department_id:
            qs = qs.filter(department_id=department_id)

        # 1. Doctor-wise metrics
        doctor_metrics = {}
        for appt in qs:
            doc_id = str(appt.doctor.id)
            if doc_id not in doctor_metrics:
                doctor_metrics[doc_id] = {
                    'doctor_id': doc_id,
                    'doctor_name': appt.doctor.user_profile.full_name,
                    'specialization': appt.doctor.specialization,
                    'department_name': appt.department.name if appt.department else '',
                    'total': 0,
                    'completed': 0,
                    'cancelled': 0,
                    'no_show': 0,
                    'walk_in': 0,
                    'scheduled': 0,
                    'billed_revenue': Decimal('0.00'),
                    'paid_revenue': Decimal('0.00'),
                    'outstanding_balance': Decimal('0.00')
                }

            dm = doctor_metrics[doc_id]
            dm['total'] += 1
            if appt.status == AppointmentStatus.COMPLETED:
                dm['completed'] += 1
            elif appt.status == AppointmentStatus.CANCELLED:
                dm['cancelled'] += 1
            elif appt.status == AppointmentStatus.NO_SHOW:
                dm['no_show'] += 1

            if appt.appointment_type == AppointmentType.WALK_IN:
                dm['walk_in'] += 1
            else:
                dm['scheduled'] += 1

            if appt.invoice:
                dm['billed_revenue'] += appt.invoice.total_amount
                dm['paid_revenue'] += appt.invoice.paid_amount
                dm['outstanding_balance'] += appt.invoice.balance_amount

        # 2. Department-wise metrics
        dept_metrics = {}
        for appt in qs:
            dept_name = appt.department.name if appt.department else 'General OPD'
            if dept_name not in dept_metrics:
                dept_metrics[dept_name] = {
                    'department_name': dept_name,
                    'total': 0,
                    'completed': 0,
                    'cancelled': 0,
                    'billed_revenue': Decimal('0.00'),
                    'paid_revenue': Decimal('0.00')
                }
            dept_metrics[dept_name]['total'] += 1
            if appt.status == AppointmentStatus.COMPLETED:
                dept_metrics[dept_name]['completed'] += 1
            elif appt.status == AppointmentStatus.CANCELLED:
                dept_metrics[dept_name]['cancelled'] += 1

            if appt.invoice:
                dept_metrics[dept_name]['billed_revenue'] += appt.invoice.total_amount
                dept_metrics[dept_name]['paid_revenue'] += appt.invoice.paid_amount

        # Overall totals
        total_appointments = qs.count()
        total_completed = qs.filter(status=AppointmentStatus.COMPLETED).count()
        total_cancelled = qs.filter(status=AppointmentStatus.CANCELLED).count()

        invoices = [appt.invoice for appt in qs if appt.invoice]
        total_billed = sum((inv.total_amount for inv in invoices), Decimal('0.00'))
        total_paid = sum((inv.paid_amount for inv in invoices), Decimal('0.00'))
        total_outstanding = sum((inv.balance_amount for inv in invoices), Decimal('0.00'))

        return Response({
            'start_date': str(start_date),
            'end_date': str(end_date),
            'summary': {
                'total_appointments': total_appointments,
                'total_completed': total_completed,
                'total_cancelled': total_cancelled,
                'total_billed_revenue': str(total_billed),
                'total_paid_revenue': str(total_paid),
                'total_outstanding_balance': str(total_outstanding),
                'completion_rate_percent': round((total_completed / total_appointments * 100), 1) if total_appointments > 0 else 0
            },
            'doctor_reports': list(doctor_metrics.values()),
            'department_reports': list(dept_metrics.values())
        })
