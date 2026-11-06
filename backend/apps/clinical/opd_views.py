import uuid
import re
from datetime import datetime, timedelta, date, time
from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg, F
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.authentication.permissions import IsStaffMember, IsReceptionistOnly, resolve_user_profile
from apps.core.models import Branch, Department, AuditLog, Hospital
from apps.authentication.models import PatientProfile, StaffProfile, UserProfile, RoleEnum
from apps.authentication.utils import get_staff_profile, get_patient_profile
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType
from apps.pharmacy_inventory.models import Medicine, Prescription, PrescriptionItem
from .opd_payment_service import (
    OPDPaymentError,
    resolve_consultation_fee,
    create_opd_online_payment_order,
    authorize_sandbox_opd_payment,
    validate_opd_payment_payload,
    settle_opd_appointment_and_payment,
)
from .models import (
    Appointment, AppointmentStatus, AppointmentType,
    DoctorSchedule, DoctorLeave,
    LabTestCatalogue, LabOrder, LabOrderItem, LabOrderStatus,
    RadiologyOrder, ModalityEnum,
    DoctorNotification, DoctorNotificationType
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
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()

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


class OPDConsultationFeePreviewView(views.APIView):
    """
    Returns the authoritative consultation fee in Indian Rupees (₹) from the hospital's
    existing fee configuration (TariffPlan -> Doctor Profile -> Service Catalogue)
    before booking an appointment or issuing a token.
    Restricted strictly to Receptionist role.
    """
    permission_classes = [IsAuthenticated, IsReceptionistOnly]

    def get(self, request):
        doctor_id = request.query_params.get('doctor_id')
        patient_id = request.query_params.get('patient_id')
        department_id = request.query_params.get('department_id')

        if not doctor_id:
            return Response({'error': 'doctor_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor = StaffProfile.objects.select_related('user_profile', 'department', 'branch').filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        patient = PatientProfile.objects.filter(id=patient_id).first() if patient_id else None
        department = Department.objects.filter(id=department_id).first() if department_id else doctor.department

        fee_info = resolve_consultation_fee(doctor=doctor, department=department, patient=patient)
        return Response({
            'doctor_id': str(doctor.id),
            'doctor_name': doctor.user_profile.full_name,
            'specialization': doctor.specialization or 'General Medicine',
            'department_name': department.name if department else 'General OPD',
            'consultation_fee': f"{fee_info['amount']:.2f}",
            'formatted_amount': fee_info['formatted_amount'],
            'currency': 'INR',
            'currency_symbol': '₹',
            'fee_source': fee_info['fee_source'],
            'allowed_payment_methods': ['CASH', 'ONLINE'],
        })


class OPDPaymentOrderCreateView(views.APIView):
    """
    Generates a Razorpay online payment order for OPD Appointment Booking or Walk-in Token Issuing.
    Restricted strictly to Receptionist role.
    """
    permission_classes = [IsAuthenticated, IsReceptionistOnly]

    @transaction.atomic
    def post(self, request):
        data = request.data
        patient_id = data.get('patient_id')
        doctor_id = data.get('doctor_id')
        department_id = data.get('department_id')
        booking_type = str(data.get('booking_type') or 'APPOINTMENT').upper()
        idempotency_key = data.get('idempotency_key')

        if not patient_id or not doctor_id:
            return Response({'error': 'Both patient_id and doctor_id are required to generate an online payment order.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.select_related('user_profile').filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.select_related('user_profile', 'department').filter(id=doctor_id).first()
        if not doctor:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        department = Department.objects.filter(id=department_id).first() if department_id else doctor.department
        rec_profile = resolve_user_profile(request)
        rec_staff = getattr(rec_profile, 'staff_profile', None) or get_staff_profile(request.user)

        try:
            order_payload = create_opd_online_payment_order(
                request=request,
                patient=patient,
                doctor=doctor,
                department=department,
                booking_type=booking_type,
                idempotency_key=idempotency_key,
                receptionist_staff=rec_staff,
            )
            return Response(order_payload, status=status.HTTP_201_CREATED)
        except OPDPaymentError as exc:
            return Response({'error': exc.message, **exc.extra}, status=exc.status_code)


class OPDPaymentOrderAuthorizeSandboxView(views.APIView):
    """
    Server-side Razorpay sandbox authorization endpoint for OPD online payments.
    Produces a cryptographically signed (razorpay_order_id, razorpay_payment_id, razorpay_signature)
    using HMAC-SHA256 on the server or simulates a failed payment so retry can be tested.
    Restricted strictly to Receptionist role.
    """
    permission_classes = [IsAuthenticated, IsReceptionistOnly]

    @transaction.atomic
    def post(self, request):
        data = request.data
        razorpay_order_id = data.get('razorpay_order_id') or data.get('order_id')
        simulate_failure = bool(data.get('simulate_failure', False))
        rec_profile = resolve_user_profile(request)
        rec_staff = getattr(rec_profile, 'staff_profile', None) or get_staff_profile(request.user)

        try:
            auth_payload = authorize_sandbox_opd_payment(
                request=request,
                razorpay_order_id=razorpay_order_id,
                simulate_failure=simulate_failure,
                receptionist_staff=rec_staff,
            )
            return Response(auth_payload, status=status.HTTP_200_OK)
        except OPDPaymentError as exc:
            return Response({'error': exc.message, **exc.extra}, status=exc.status_code)


class OPDWalkInRegistrationView(views.APIView):
    """
    Walk-in Patient OPD Registration and Atomic Queue Token Generation.
    Strictly restricted to RECEPTIONIST role ONLY and requires mandatory payment (CASH or verified ONLINE)
    before confirming the walk-in registration or generating a queue token.
    """
    permission_classes = [IsAuthenticated, IsReceptionistOnly]

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

        patient = PatientProfile.objects.select_related('user_profile', 'primary_branch').filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

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
        department = Department.objects.filter(id=department_id).first() or doctor.department

        today = timezone.localdate()
        now_time_str = timezone.now().strftime('%H:%M')

        # Check if doctor is on approved leave today
        doctor_leave_today = DoctorLeave.objects.filter(
            doctor=doctor,
            start_date__lte=today,
            end_date__gte=today,
            is_approved=True
        ).exists()
        if doctor_leave_today:
            return Response(
                {'error': f"Dr. {doctor.user_profile.full_name} is on approved leave today and cannot take walk-in patients."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicate active walk-in token for same patient & doctor on the same day
        duplicate_walkin = Appointment.objects.filter(
            patient=patient,
            doctor=doctor,
            appointment_date=today,
            appointment_type=AppointmentType.WALK_IN,
            status__in=[AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION]
        ).first()
        if duplicate_walkin:
            return Response(
                {
                    'error': (
                        f"Duplicate token prevented: {patient.user_profile.full_name} already has an active walk-in token "
                        f"({duplicate_walkin.token_number}) with Dr. {doctor.user_profile.full_name} today."
                    )
                },
                status=status.HTTP_409_CONFLICT
            )

        try:
            with transaction.atomic():
                # Lock check for duplicate active walk-in
                locked_dup = Appointment.objects.select_for_update().filter(
                    patient=patient,
                    doctor=doctor,
                    appointment_date=today,
                    appointment_type=AppointmentType.WALK_IN,
                    status__in=[AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION]
                ).exists()
                if locked_dup:
                    return Response(
                        {'error': 'Duplicate walk-in token detected for this patient and doctor today.'},
                        status=status.HTTP_409_CONFLICT
                    )

                # Validate mandatory payment BEFORE generating token or appointment
                validated_payment = validate_opd_payment_payload(
                    data=data,
                    patient=patient,
                    doctor=doctor,
                    department=department,
                    receptionist_staff=receptionist_staff,
                    request=request,
                )

                # Generate atomic daily token number for this doctor queue
                daily_count = Appointment.objects.select_for_update().filter(
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
                            notification_type=DoctorNotificationType.PATIENT_CHECKED_IN,
                            title=f"Walk-in Checked In: {patient.user_profile.full_name}",
                            message=f"Walk-in Token {token_str} ({patient.user_profile.full_name}) has checked in and is waiting in the lounge.",
                            priority='ROUTINE',
                            patient=patient,
                            target_url=f"/staff/doctor-workspace?tab=queue",
                            metadata={'appointment_id': str(appointment.id), 'token_number': token_str}
                        )
                    except Exception:
                        pass

                log_audit(
                    request.user,
                    action='OPD_WALK_IN_REGISTERED',
                    entity_type='Appointment',
                    entity_id=appointment.id,
                    branch=branch,
                    new_val={
                        'token': token_str,
                        'patient_mrn': patient.medical_record_number,
                        'doctor': doctor.user_profile.full_name,
                        'payment_method': validated_payment['payment_method_display'],
                        'amount_paid': str(validated_payment['amount']),
                        'receipt_number': settlement['receipt'].receipt_number,
                    }
                )
        except OPDPaymentError as exc:
            err_payload = {'error': exc.message, **exc.extra}
            return Response(err_payload, status=exc.status_code)

        serializer = AppointmentSerializer(appointment)
        return Response({
            'message': f"Walk-in registered and payment (₹{validated_payment['amount']:.2f}) verified. {token_str} issued.",
            'appointment': serializer.data,
            'token_receipt': settlement['receipt_payload'],
            'receipt': settlement['receipt_payload'],
        }, status=status.HTTP_201_CREATED)


class OPDAppointmentReceiptView(views.APIView):
    """
    Retrieves the complete printable/downloadable Payment & Token Receipt for an OPD Appointment.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        appointment = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch__hospital', 'invoice'
        ).filter(id=pk).first()
        if not appointment:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Patient isolation check
        patient_caller = get_patient_profile(request.user)
        if patient_caller and appointment.patient_id != patient_caller.id:
            return Response({'error': 'You can only view receipts for your own appointments.'}, status=status.HTTP_403_FORBIDDEN)

        invoice = appointment.invoice
        payment = invoice.payments.select_related('received_by__user_profile', 'receipt').order_by('-payment_date').first() if invoice else None
        receipt = getattr(payment, 'receipt', None) if payment else None
        branch = appointment.branch or appointment.doctor.branch
        hospital = (branch.hospital if branch and getattr(branch, 'hospital', None) else None) or Hospital.objects.first()
        fee = invoice.total_amount if invoice else (appointment.doctor.consultation_fee or Decimal('500.00'))
        pay_ts = payment.payment_date if payment else appointment.created_at
        method_display = 'ONLINE' if (payment and payment.payment_method == 'ONLINE_GATEWAY') else (payment.payment_method if payment else 'CASH')

        return Response({
            'receipt_id': str(receipt.id) if receipt else None,
            'receipt_number': receipt.receipt_number if receipt else (f"REC-{appointment.appointment_number}" if invoice else None),
            'payment_id': str(payment.id) if payment else None,
            'payment_number': payment.payment_number if payment else None,
            'invoice_id': str(invoice.id) if invoice else None,
            'invoice_number': invoice.invoice_number if invoice else None,
            'invoice_status': invoice.status if invoice else 'PAID',
            'appointment_id': str(appointment.id),
            'appointment_number': appointment.appointment_number,
            'appointment_type': appointment.appointment_type,
            'token_number': appointment.token_number,
            'appointment_date': str(appointment.appointment_date),
            'time_slot': appointment.time_slot,
            'check_in_time': (appointment.checked_in_at or appointment.created_at).strftime('%H:%M:%S'),
            'date': str(appointment.appointment_date),
            'payment_date': pay_ts.isoformat(),
            'payment_date_display': pay_ts.strftime('%d %b %Y, %I:%M %p'),
            'hospital_name': hospital.name if hospital else 'Aura Multi-Specialty Hospital',
            'hospital_code': hospital.code if hospital else 'HOSP-HQ',
            'hospital_address': (
                f"{branch.address_line1}, {branch.city}, {branch.state} {branch.postal_code}".strip(', ')
                if branch and getattr(branch, 'address_line1', '')
                else 'Main Hospital Campus, Healthcare District'
            ),
            'hospital_phone': (branch.phone if branch and getattr(branch, 'phone', '') else '+91 40 2345 6789'),
            'hospital_email': (branch.email if branch and getattr(branch, 'email', '') else 'billing@aurahospital.org'),
            'branch_name': branch.name if branch else 'Main Branch',
            'patient_id': str(appointment.patient.id),
            'patient_name': appointment.patient.user_profile.full_name,
            'patient_mrn': appointment.patient.medical_record_number,
            'patient_phone': appointment.patient.user_profile.phone_number or '',
            'patient_gender': appointment.patient.gender or '',
            'patient_blood_group': appointment.patient.blood_group or '',
            'doctor_id': str(appointment.doctor.id),
            'doctor_name': appointment.doctor.user_profile.full_name,
            'specialization': appointment.doctor.specialization or 'General Medicine',
            'department_name': appointment.department.name if appointment.department else 'General OPD',
            'consultation_fee': f"{fee:.2f}",
            'amount_paid': f"{(invoice.paid_amount if invoice else fee):.2f}",
            'balance_amount': f"{(invoice.balance_amount if invoice else Decimal('0.00')):.2f}",
            'currency': 'INR',
            'currency_symbol': '₹',
            'formatted_amount': f"₹{fee:.2f}",
            'payment_method': method_display,
            'payment_status': invoice.status if invoice else 'PAID',
            'transaction_reference': payment.transaction_reference if payment else '',
            'processed_by_name': (
                payment.received_by.user_profile.full_name
                if (payment and payment.received_by and payment.received_by.user_profile)
                else 'Reception Desk'
            ),
            'processed_by_employee_id': (
                payment.received_by.employee_id if (payment and payment.received_by) else ''
            ),
        })


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
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()

        doctor_id = request.query_params.get('doctor_id')
        department_id = request.query_params.get('department_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        qs = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch', 'invoice'
        ).prefetch_related('invoice__payments__received_by__user_profile', 'invoice__payments__receipt').filter(appointment_date=target_date)

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

            latest_pay = appt.invoice.payments.first() if appt.invoice else None
            receipt_obj = getattr(latest_pay, 'receipt', None) if latest_pay else None
            pay_method_label = (
                ('ONLINE' if latest_pay.payment_method == 'ONLINE_GATEWAY' else latest_pay.payment_method)
                if latest_pay else None
            )

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
                'invoice_status': appt.invoice.status if appt.invoice else None,
                'receipt_number': receipt_obj.receipt_number if receipt_obj else None,
                'payment_method': pay_method_label,
                'transaction_reference': latest_pay.transaction_reference if latest_pay else None,
                'processed_by_name': (
                    latest_pay.received_by.user_profile.full_name
                    if (latest_pay and latest_pay.received_by and latest_pay.received_by.user_profile)
                    else None
                ),
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

            if appointment.doctor:
                try:
                    DoctorNotification.objects.create(
                        recipient_doctor=appointment.doctor,
                        branch=appointment.branch,
                        notification_type=DoctorNotificationType.PATIENT_CHECKED_IN,
                        title=f"Patient Checked In: {appointment.patient.user_profile.full_name}",
                        message=f"{appointment.token_number or 'Token'} ({appointment.patient.user_profile.full_name}) has checked in and is waiting in the lounge.",
                        priority='ROUTINE',
                        patient=appointment.patient,
                        target_url=f"/staff/doctor-workspace?tab=queue",
                        metadata={'appointment_id': str(appointment.id), 'token_number': appointment.token_number}
                    )
                except Exception:
                    pass

        elif action in ['START_CONSULTATION', 'CALL_NEXT']:
            user_prof = resolve_user_profile(request)
            role_name = getattr(user_prof.role, 'name', '') if user_prof and user_prof.role else ''
            CLINICAL_ROLES = [
                RoleEnum.DOCTOR,
                RoleEnum.MEDICAL_DIRECTOR,
                RoleEnum.DEPARTMENT_HEAD,
                RoleEnum.SUPER_ADMIN,
                RoleEnum.HOSPITAL_ADMIN,
            ]
            if role_name not in CLINICAL_ROLES:
                return Response(
                    {'error': 'Access Denied: Only attending doctors and clinical directors are authorized to call in patients and conduct consultations.'},
                    status=status.HTTP_403_FORBIDDEN
                )

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
            user_prof = resolve_user_profile(request)
            role_name = getattr(user_prof.role, 'name', '') if user_prof and user_prof.role else ''
            CLINICAL_ROLES = [
                RoleEnum.DOCTOR,
                RoleEnum.MEDICAL_DIRECTOR,
                RoleEnum.DEPARTMENT_HEAD,
                RoleEnum.SUPER_ADMIN,
                RoleEnum.HOSPITAL_ADMIN,
            ]
            if role_name not in CLINICAL_ROLES:
                return Response(
                    {'error': 'Access Denied: Only attending doctors are authorized to mark appointments as No Show.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if appointment.status == AppointmentStatus.COMPLETED:
                return Response({'error': 'Cannot mark a completed appointment as No Show.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.NO_SHOW

        elif action == 'CANCEL':
            user_prof = resolve_user_profile(request)
            role_name = getattr(user_prof.role, 'name', '') if user_prof and user_prof.role else ''
            CLINICAL_ROLES = [
                RoleEnum.DOCTOR,
                RoleEnum.MEDICAL_DIRECTOR,
                RoleEnum.DEPARTMENT_HEAD,
                RoleEnum.SUPER_ADMIN,
                RoleEnum.HOSPITAL_ADMIN,
            ]
            if role_name not in CLINICAL_ROLES:
                return Response(
                    {'error': 'Access Denied: Only attending doctors are authorized to cancel consultations.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            if appointment.status == AppointmentStatus.COMPLETED:
                return Response({'error': 'Cannot cancel an appointment that is already completed.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = AppointmentStatus.CANCELLED
            appointment.cancellation_reason = request.data.get('reason', 'Cancelled by doctor')

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
            'past_surgeries': getattr(patient, 'past_surgical_history', None) or getattr(patient, 'past_surgeries', None) or [],
            'current_medications': getattr(patient, 'current_medications', None) or [],
            'past_medical_history': getattr(patient, 'past_medical_history', None) or '',
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

        user_prof = resolve_user_profile(request)
        role_name = getattr(user_prof.role, 'name', '') if user_prof and user_prof.role else ''
        CLINICAL_ROLES = [
            RoleEnum.DOCTOR,
            RoleEnum.MEDICAL_DIRECTOR,
            RoleEnum.DEPARTMENT_HEAD,
            RoleEnum.SUPER_ADMIN,
            RoleEnum.HOSPITAL_ADMIN,
        ]
        if role_name not in CLINICAL_ROLES:
            return Response(
                {'error': 'Access Denied: Only licensed physicians and clinical directors can finalize consultations, prescribe medications, or order laboratory/radiology tests.'},
                status=status.HTTP_403_FORBIDDEN
            )

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

            # Ensure consultation fee invoice is generated before adding order line items
            consultation_inv = get_or_create_consultation_invoice(appointment, created_by=request.user)

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
                    appointment=appointment,
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
                    appointment=appointment,
                    encounter_type='OPD',
                    priority=data.get('lab_priority', 'ROUTINE'),
                    clinical_notes=f"Ordered during OPD consultation: {appointment.diagnosis}",
                    invoice=appointment.invoice
                )
                for tid in lab_test_ids:
                    test = LabTestCatalogue.objects.filter(id=tid).first()
                    if test:
                        captured_price = test.standard_rate or Decimal('250.00')
                        LabOrderItem.objects.create(
                            lab_order=lab_order,
                            test=test,
                            captured_price=captured_price,
                            reference_range=test.reference_range
                        )
                        if appointment.invoice:
                            InvoiceItem.objects.create(
                                invoice=appointment.invoice,
                                item_type=ChargeItemType.LAB_TEST,
                                description=f"Lab Test: {test.name} [{test.code}]",
                                source_reference=f"LAB_ORDER:{lab_order.id}",
                                quantity=1,
                                unit_price=captured_price
                            )

            # 4. Radiology Orders
            radiology_orders_data = data.get('radiology_orders', [])
            for rad in radiology_orders_data:
                rad_num = f"RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                rad_modality = rad.get('modality', ModalityEnum.X_RAY)
                rad_rate = Decimal('1200.00')
                if rad_modality in ['MRI']:
                    rad_rate = Decimal('8000.00')
                elif rad_modality in ['CT', 'CT_SCAN']:
                    rad_rate = Decimal('4500.00')
                elif rad_modality in ['ULTRASOUND', 'USG']:
                    rad_rate = Decimal('1800.00')

                rad_order = RadiologyOrder.objects.create(
                    order_number=rad_num,
                    patient=patient,
                    doctor=doctor,
                    branch=branch,
                    appointment=appointment,
                    encounter_type='OPD',
                    modality=rad_modality,
                    study_name=rad.get('study_name', 'Chest X-Ray PA View'),
                    clinical_indication=rad.get('clinical_indication', appointment.diagnosis),
                    priority=rad.get('priority', 'ROUTINE'),
                    captured_rate=rad_rate,
                    invoice=appointment.invoice
                )
                if appointment.invoice:
                    InvoiceItem.objects.create(
                        invoice=appointment.invoice,
                        item_type=ChargeItemType.RADIOLOGY,
                        description=f"Imaging Study: {rad_order.study_name} ({rad_order.modality})",
                        source_reference=f"RADIOLOGY:{rad_order.id}",
                        quantity=1,
                        unit_price=rad_rate
                    )

            # Recalculate invoice totals with newly ordered diagnostic investigations
            if appointment.invoice:
                appointment.invoice.recalculate_totals()

            # 5. Inpatient Admission Recommendation Integration
            if data.get('recommend_admission'):
                from .models import InpatientAdmission, AdmissionStatus
                adm_priority = data.get('admission_priority', 'ROUTINE')
                requested_ward = data.get('requested_ward_type', 'GENERAL_WARD')
                adm_diag = data.get('admission_diagnosis') or appointment.diagnosis or 'Inpatient Admission Recommended'
                adm_num = f"IPD-REQ-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

                InpatientAdmission.objects.create(
                    admission_number=adm_num,
                    patient=patient,
                    requesting_doctor=doctor,
                    admitting_doctor=doctor,
                    branch=branch,
                    admission_source='OPD',
                    priority=adm_priority,
                    requested_ward_type=requested_ward,
                    initial_diagnosis=adm_diag,
                    status=AdmissionStatus.REQUESTED
                )

            # 6. Follow-up Recommendation Only
            # Strict RBAC: Only the Receptionist role can book appointments and issue patient tokens
            # with mandatory payment collection. Doctors record the recommended follow_up_date and
            # follow_up_instructions on the current encounter record without auto-booking an unpaid appointment.

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

        today = timezone.localdate()
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


class OPDLoungeTVView(views.APIView):
    """
    Public & Patient-accessible Real-Time Lounge TV Queue Telemetry API.
    Provides live waiting lounge statistics, doctor queues, serving tokens,
    and individual patient queue status.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.localdate()
        # Automatically reconcile overdue past appointments to NO_SHOW
        try:
            Appointment.objects.filter(
                appointment_date__lt=today,
                status__in=[AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]
            ).update(status=AppointmentStatus.NO_SHOW)
        except Exception:
            pass

        query_date_str = request.query_params.get('date')
        if query_date_str:
            try:
                target_date = datetime.strptime(query_date_str, '%Y-%m-%d').date()
            except ValueError:
                target_date = today
        else:
            target_date = today

        branch_id = request.query_params.get('branch_id')
        doctor_id = request.query_params.get('doctor_id')

        # RBAC: clinicians may only view their OWN cabin queue.
        # Only RECEPTIONIST (front-desk queue controller) may view / switch across all cabins.
        if request.user and request.user.is_authenticated:
            try:
                req_profile = resolve_user_profile(request)
                req_role = getattr(getattr(req_profile, 'role', None), 'name', '') if req_profile else ''
                if req_role in [RoleEnum.DOCTOR, RoleEnum.DEPARTMENT_HEAD, RoleEnum.MEDICAL_DIRECTOR]:
                    own_staff = get_staff_profile(request.user)
                    if own_staff:
                        doctor_id = str(own_staff.id)
            except Exception:
                pass

        qs = Appointment.objects.select_related(
            'patient__user_profile', 'doctor__user_profile', 'department', 'branch'
        ).filter(appointment_date=target_date)

        from apps.core.models import Branch
        valid_branch_filter = False
        if branch_id and branch_id != '00000000-0000-0000-0000-000000000001':
            try:
                if Branch.objects.filter(id=branch_id).exists():
                    valid_branch_filter = True
            except Exception:
                valid_branch_filter = False

        if valid_branch_filter:
            qs = qs.filter(branch_id=branch_id)
        if doctor_id:
            qs = qs.filter(doctor_id=doctor_id)

        active_qs = qs.exclude(status__in=[AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW])

        # Get all active doctors using valid relations on UserProfile
        # (Q and RoleEnum are imported at module level; a local import here would
        #  shadow RoleEnum for the whole function and break the RBAC check above.)
        doc_profiles_qs = StaffProfile.objects.select_related('user_profile', 'department', 'branch').filter(
            Q(user_profile__role__name__in=[RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR]) |
            Q(medical_license_number__gt='') |
            Q(designation__icontains='Doctor') |
            Q(designation__icontains='Surgeon') |
            Q(designation__icontains='Physician') |
            Q(designation__icontains='Consultant'),
            status='ACTIVE'
        )
        if valid_branch_filter:
            branch_filtered = doc_profiles_qs.filter(branch_id=branch_id)
            if branch_filtered.exists():
                doc_profiles_qs = branch_filtered
        if doctor_id:
            doc_profiles_qs = doc_profiles_qs.filter(id=doctor_id)

        now = timezone.now()

        all_docs = list(doc_profiles_qs)
        cabin_map = {}
        for idx, doc in enumerate(all_docs, start=101):
            cabin_map[str(doc.id)] = f"OPD Cabin {idx}"

        doctor_stats = {}
        for doc in all_docs:
            d_id = str(doc.id)
            doctor_stats[d_id] = {
                'doctor_id': d_id,
                'doctor_name': doc.user_profile.full_name,
                'specialization': doc.specialization or 'Specialist Physician',
                'department_name': doc.department.name if doc.department else 'OPD Department',
                'cabin_number': cabin_map.get(d_id, 'OPD Cabin 101'),
                'total_tokens': 0,
                'waiting_in_lounge_count': 0,
                'currently_serving_token': None,
                'currently_serving_patient': None,
                'consultation_started_at': None,
                'next_tokens': [],
                'completed_count': 0,
            }

        queue_items = []
        total_tokens_today = 0
        total_waiting_in_lounge = 0
        total_in_consultation = 0
        total_completed = 0

        # Sort: IN_CONSULTATION first, then CHECKED_IN, then SCHEDULED, then COMPLETED
        def appt_sort_key(a):
            rank = (
                0 if a.status == AppointmentStatus.IN_CONSULTATION else
                1 if a.status == AppointmentStatus.CHECKED_IN else
                2 if a.status == AppointmentStatus.SCHEDULED else 3
            )
            tok_digits = re.sub(r'\D', '', str(a.token_number or ''))
            tok_num = int(tok_digits) if tok_digits else 9999
            return (rank, tok_num)

        sorted_appts = sorted(active_qs, key=appt_sort_key)

        for appt in sorted_appts:
            doc_id = str(appt.doctor.id)
            if doc_id not in doctor_stats:
                cabin_num = f"OPD Cabin {101 + len(cabin_map)}"
                cabin_map[doc_id] = cabin_num
                doctor_stats[doc_id] = {
                    'doctor_id': doc_id,
                    'doctor_name': appt.doctor.user_profile.full_name,
                    'specialization': appt.doctor.specialization or 'Specialist',
                    'department_name': appt.department.name if appt.department else 'OPD',
                    'cabin_number': cabin_num,
                    'total_tokens': 0,
                    'waiting_in_lounge_count': 0,
                    'currently_serving_token': None,
                    'currently_serving_patient': None,
                    'consultation_started_at': None,
                    'next_tokens': [],
                    'completed_count': 0,
                }

            d_entry = doctor_stats[doc_id]
            token_str = appt.token_number or '—'
            if token_str != '—':
                d_entry['total_tokens'] += 1
                total_tokens_today += 1

            fname = appt.patient.user_profile.first_name or ''
            lname = appt.patient.user_profile.last_name or ''
            display_name = f"{fname} {lname[:1]}." if lname else (fname or f"Token #{token_str}")

            wait_mins = 0
            if appt.checked_in_at:
                end_t = appt.consultation_started_at or now
                wait_mins = max(0, round((end_t - appt.checked_in_at).total_seconds() / 60))

            if appt.status == AppointmentStatus.IN_CONSULTATION:
                total_in_consultation += 1
                if not d_entry['currently_serving_token']:
                    d_entry['currently_serving_token'] = token_str
                    d_entry['currently_serving_patient'] = display_name
                    d_entry['consultation_started_at'] = appt.consultation_started_at.isoformat() if appt.consultation_started_at else None
            elif appt.status in [AppointmentStatus.CHECKED_IN, AppointmentStatus.SCHEDULED]:
                total_waiting_in_lounge += 1
                d_entry['waiting_in_lounge_count'] += 1
                if token_str != '—':
                    d_entry['next_tokens'].append(token_str)
            elif appt.status == AppointmentStatus.COMPLETED:
                total_completed += 1
                d_entry['completed_count'] += 1

            queue_items.append({
                'id': str(appt.id),
                'appointment_number': appt.appointment_number,
                'token_number': token_str,
                'status': appt.status,
                'time_slot': appt.time_slot,
                'patient_id': str(appt.patient.id),
                'patient_display_name': display_name,
                'doctor_id': doc_id,
                'doctor_name': appt.doctor.user_profile.full_name,
                'doctor_specialization': appt.doctor.specialization or '',
                'department_name': appt.department.name if appt.department else '',
                'cabin_number': d_entry['cabin_number'],
                'checked_in_at': appt.checked_in_at.isoformat() if appt.checked_in_at else None,
                'consultation_started_at': appt.consultation_started_at.isoformat() if appt.consultation_started_at else None,
                'wait_minutes': wait_mins,
            })

        patient_telemetry = None
        if request.user and request.user.is_authenticated:
            p_profile = getattr(request.user, 'patient_profile', None)
            if not p_profile:
                p_profile = get_patient_profile(request.user)
            if p_profile:
                p_appt = active_qs.filter(patient=p_profile).first()
                if p_appt:
                    p_doc_id = str(p_appt.doctor.id)
                    p_tok_digits = re.sub(r'\D', '', str(p_appt.token_number or ''))
                    p_token = int(p_tok_digits) if p_tok_digits else 0
                    tokens_ahead = 0
                    if p_token > 0 and p_appt.status in [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]:
                        for q in queue_items:
                            if q['doctor_id'] == p_doc_id and q['status'] in [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]:
                                q_tok_digits = re.sub(r'\D', '', str(q.get('token_number') or ''))
                                q_tok = int(q_tok_digits) if q_tok_digits else 9999
                                if q_tok < p_token:
                                    tokens_ahead += 1

                    p_doc_stats = doctor_stats.get(p_doc_id, {})
                    patient_telemetry = {
                        'appointment_id': str(p_appt.id),
                        'appointment_number': p_appt.appointment_number,
                        'token_number': p_appt.token_number or '—',
                        'status': p_appt.status,
                        'doctor_id': p_doc_id,
                        'doctor_name': p_appt.doctor.user_profile.full_name,
                        'specialization': p_appt.doctor.specialization or '',
                        'cabin_number': p_doc_stats.get('cabin_number', 'OPD Cabin 101'),
                        'department_name': p_appt.department.name if p_appt.department else '',
                        'tokens_ahead': tokens_ahead,
                        'total_waiting_for_doctor': p_doc_stats.get('waiting_in_lounge_count', 0),
                        'currently_serving_token': p_doc_stats.get('currently_serving_token'),
                        'currently_serving_patient': p_doc_stats.get('currently_serving_patient'),
                        'estimated_wait_minutes': max(5, tokens_ahead * 10),
                    }

        first_branch = active_qs.first().branch if active_qs.exists() else None
        branch_name = first_branch.name if first_branch else 'AURA Central Multi-Specialty Hospital'

        return Response({
            'hospital_name': 'AURA Multi-Specialty HMS',
            'branch_name': branch_name,
            'date': str(target_date),
            'current_time': now.isoformat(),
            'summary': {
                'total_tokens_today': total_tokens_today,
                'total_waiting_in_lounge': total_waiting_in_lounge,
                'total_in_consultation': total_in_consultation,
                'total_completed': total_completed,
            },
            'doctors': list(doctor_stats.values()),
            'queue': queue_items,
            'patient_telemetry': patient_telemetry,
        })
