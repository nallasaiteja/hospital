import uuid
from collections import Counter
from datetime import datetime, timedelta, date
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
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType, Payment, PaymentMethod
from apps.pharmacy_inventory.models import Medicine, Prescription, PrescriptionItem, DispenseRecord
from .models import (
    EmergencyEncounter, TriageAcuity, EmergencyStatus,
    Ward, WardType, Bed, BedStatus,
    InpatientAdmission, AdmissionStatus, PatientTransfer,
    DailyProgressNote, LabOrder, RadiologyOrder
)
from .serializers import (
    EmergencyEncounterSerializer, WardSerializer, BedSerializer,
    InpatientAdmissionSerializer, PatientTransferSerializer,
    DailyProgressNoteSerializer
)


def log_audit(user, action, entity_type, entity_id, branch=None, old_val=None, new_val=None):
    """Helper to record audit trail for emergency & IPD operations."""
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


class EmergencyIPDDashboardStatsView(views.APIView):
    """
    Real-time database-driven Emergency and Inpatient (IPD) KPIs and Statistics.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        branch_id = request.query_params.get('branch_id')

        er_qs = EmergencyEncounter.objects.all()
        ipd_qs = InpatientAdmission.objects.all()
        bed_qs = Bed.objects.all()

        if branch_id:
            er_qs = er_qs.filter(branch_id=branch_id)
            ipd_qs = ipd_qs.filter(branch_id=branch_id)
            bed_qs = bed_qs.filter(ward__branch_id=branch_id)

        # 1. Emergency Metrics
        er_today = er_qs.filter(arrival_time__date=today).count()
        er_active = er_qs.filter(status__in=[EmergencyStatus.TRIAGED, EmergencyStatus.UNDER_TREATMENT]).count()
        er_admitted_to_ipd = er_qs.filter(status=EmergencyStatus.TRANSFERRED_TO_IPD).count()

        # 2. Inpatient Admissions & Census
        pending_requests = ipd_qs.filter(status__in=[AdmissionStatus.REQUESTED, AdmissionStatus.APPROVED]).count()
        current_census = ipd_qs.filter(status__in=[AdmissionStatus.ADMITTED, AdmissionStatus.AWAITING_DISCHARGE]).count()
        awaiting_discharge = ipd_qs.filter(status=AdmissionStatus.AWAITING_DISCHARGE).count()
        discharges_today = ipd_qs.filter(status=AdmissionStatus.DISCHARGED, discharge_date__date=today).count()
        icu_patients = ipd_qs.filter(
            status__in=[AdmissionStatus.ADMITTED, AdmissionStatus.AWAITING_DISCHARGE],
            bed__ward__ward_type=WardType.ICU
        ).count()

        # 3. Bed Occupancy & Maintenance
        total_beds = bed_qs.count()
        occupied_beds = bed_qs.filter(status=BedStatus.OCCUPIED).count()
        available_beds = bed_qs.filter(status=BedStatus.AVAILABLE).count()
        cleaning_beds = bed_qs.filter(status=BedStatus.CLEANING).count()
        maintenance_beds = bed_qs.filter(status=BedStatus.MAINTENANCE).count()
        reserved_beds = bed_qs.filter(status=BedStatus.RESERVED).count()

        occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0

        # 4. Average Length of Stay (ALOS) across discharged patients
        discharged_adms = ipd_qs.filter(status=AdmissionStatus.DISCHARGED, discharge_date__isnull=False)
        total_stay_days = 0
        discharged_count = discharged_adms.count()
        for adm in discharged_adms:
            diff = (adm.discharge_date - adm.admission_date).days
            total_stay_days += max(1, diff)

        alos_days = round(total_stay_days / discharged_count, 1) if discharged_count > 0 else 0

        # 5. Transfers count today
        transfers_today = PatientTransfer.objects.filter(transfer_time__date=today).count()

        return Response({
            'date': str(today),
            'emergency_visits_today': er_today,
            'patients_currently_in_emergency': er_active,
            'emergency_admitted_to_ipd': er_admitted_to_ipd,
            'pending_admission_requests': pending_requests,
            'current_inpatient_census': current_census,
            'icu_patients': icu_patients,
            'total_beds': total_beds,
            'occupied_beds': occupied_beds,
            'available_beds': available_beds,
            'cleaning_beds': cleaning_beds,
            'maintenance_beds': maintenance_beds,
            'reserved_beds': reserved_beds,
            'occupancy_rate_percent': occupancy_rate,
            'patients_awaiting_discharge': awaiting_discharge,
            'discharges_completed_today': discharges_today,
            'average_length_of_stay_days': alos_days,
            'transfers_today': transfers_today
        })


class EmergencyEncounterViewSet(viewsets.ModelViewSet):
    """
    Casualty, Emergency Triage, Treatment Notes, and Immediate IPD Admission.
    Emergency care is unblocked by payment.
    """
    serializer_class = EmergencyEncounterSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = EmergencyEncounter.objects.select_related(
            'patient__user_profile', 'attending_doctor__user_profile', 'triage_nurse__user_profile',
            'branch', 'linked_admission'
        )
        branch_id = self.request.query_params.get('branch_id')
        acuity = self.request.query_params.get('acuity')
        status_filter = self.request.query_params.get('status')
        search = self.request.query_params.get('search')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if acuity:
            qs = qs.filter(triage_acuity=acuity)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(encounter_number__icontains=search) |
                Q(unregistered_patient_name__icontains=search) |
                Q(patient__user_profile__first_name__icontains=search) |
                Q(patient__user_profile__last_name__icontains=search) |
                Q(patient__medical_record_number__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """
        Register Emergency Patient with Triage Acuity.
        Supports both registered patients and unidentified/unregistered emergency victims.
        """
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
            arrival_time=data.get('arrival_time') or timezone.now(),
            chief_complaint=data.get('chief_complaint', 'Acute Medical Emergency'),
            vitals_on_arrival=data.get('vitals_on_arrival', {}),
            attending_doctor_id=data.get('attending_doctor_id') or None,
            triage_nurse_id=data.get('triage_nurse_id') or None,
            status=EmergencyStatus.TRIAGED
        )

        log_audit(
            request.user,
            action='EMERGENCY_PATIENT_TRIAGED',
            entity_type='EmergencyEncounter',
            entity_id=encounter.id,
            branch=branch,
            new_val={'encounter': encounter_number, 'acuity': encounter.triage_acuity}
        )

        return Response(EmergencyEncounterSerializer(encounter).data, status=status.HTTP_201_CREATED)


class EmergencyActionView(views.APIView):
    """
    Emergency actions: update treatment, reconcile unidentified patient,
    initiate inpatient admission request, or discharge from emergency.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        encounter = EmergencyEncounter.objects.filter(id=pk).first()
        if not encounter:
            return Response({'error': 'Emergency encounter not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        now = timezone.now()

        if action == 'UPDATE_TREATMENT':
            encounter.treatment_given = request.data.get('treatment_given', encounter.treatment_given)
            encounter.status = EmergencyStatus.UNDER_TREATMENT
            if request.data.get('attending_doctor_id'):
                encounter.attending_doctor_id = request.data.get('attending_doctor_id')
            encounter.save()

        elif action == 'RECONCILE_PATIENT':
            patient_id = request.data.get('patient_id')
            patient = PatientProfile.objects.filter(id=patient_id).first()
            if not patient:
                return Response({'error': 'Valid patient profile not found for reconciliation.'}, status=status.HTTP_404_NOT_FOUND)
            encounter.patient = patient
            encounter.save()
            log_audit(
                request.user,
                action='EMERGENCY_PATIENT_RECONCILED',
                entity_type='EmergencyEncounter',
                entity_id=encounter.id,
                branch=encounter.branch,
                new_val={'patient_mrn': patient.medical_record_number}
            )

        elif action == 'REQUEST_IPD_ADMISSION':
            # Patient must be registered or identified before formal IPD admission
            if not encounter.patient:
                return Response({
                    'error': 'Cannot initiate inpatient admission for an unidentified patient. Please reconcile with a registered patient first.'
                }, status=status.HTTP_400_BAD_REQUEST)

            doctor_id = request.data.get('admitting_doctor_id') or encounter.attending_doctor_id
            doctor = StaffProfile.objects.filter(id=doctor_id).first() or StaffProfile.objects.first()

            today_str = now.strftime('%Y%m%d')
            unique_suffix = uuid.uuid4().hex[:6].upper()
            adm_number = f"IPD-ER-{today_str}-{unique_suffix}"

            with transaction.atomic():
                admission = InpatientAdmission.objects.create(
                    admission_number=adm_number,
                    patient=encounter.patient,
                    branch=encounter.branch,
                    admission_source='EMERGENCY',
                    priority='STAT_EMERGENCY',
                    requested_ward_type=request.data.get('requested_ward_type', WardType.ICU),
                    admitting_doctor=doctor,
                    requesting_doctor=encounter.attending_doctor or doctor,
                    initial_diagnosis=f"Emergency Admission: {encounter.chief_complaint}",
                    status=AdmissionStatus.REQUESTED
                )
                encounter.linked_admission = admission
                encounter.status = EmergencyStatus.TRANSFERRED_TO_IPD
                encounter.save()

                log_audit(
                    request.user,
                    action='EMERGENCY_ADMISSION_REQUESTED',
                    entity_type='InpatientAdmission',
                    entity_id=admission.id,
                    branch=encounter.branch,
                    new_val={'admission_number': adm_number, 'priority': 'STAT_EMERGENCY'}
                )

            return Response({
                'message': f"Inpatient admission {adm_number} requested successfully from Emergency.",
                'admission': InpatientAdmissionSerializer(admission).data,
                'encounter': EmergencyEncounterSerializer(encounter).data
            })

        elif action == 'DISCHARGE_EMERGENCY':
            encounter.status = EmergencyStatus.DISCHARGED
            encounter.discharge_summary = request.data.get('discharge_summary', 'Discharged from Emergency after stabilization.')
            encounter.discharged_at = now
            encounter.save()

            log_audit(
                request.user,
                action='EMERGENCY_PATIENT_DISCHARGED',
                entity_type='EmergencyEncounter',
                entity_id=encounter.id,
                branch=encounter.branch,
                new_val={'summary': encounter.discharge_summary}
            )

        else:
            return Response({'error': f'Invalid action "{action}".'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(EmergencyEncounterSerializer(encounter).data)


class InpatientAdmissionViewSet(viewsets.ModelViewSet):
    """
    Inpatient (IPD) Admission Requests, Approvals, Bed Allocations, and Census.
    """
    serializer_class = InpatientAdmissionSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = InpatientAdmission.objects.select_related(
            'patient__user_profile', 'bed__ward', 'admitting_doctor__user_profile',
            'requesting_doctor__user_profile', 'approved_by__user_profile', 'branch', 'invoice'
        )
        branch_id = self.request.query_params.get('branch_id')
        status_filter = self.request.query_params.get('status')
        ward_id = self.request.query_params.get('ward_id')
        search = self.request.query_params.get('search')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if ward_id:
            qs = qs.filter(bed__ward_id=ward_id)
        if search:
            qs = qs.filter(
                Q(admission_number__icontains=search) |
                Q(patient__user_profile__first_name__icontains=search) |
                Q(patient__user_profile__last_name__icontains=search) |
                Q(patient__medical_record_number__icontains=search) |
                Q(bed__bed_number__icontains=search)
            )
        return qs

    def create(self, request, *args, **kwargs):
        """
        Initiate an Inpatient Admission Request.
        Can directly allocate an available bed or initiate in REQUESTED status.
        """
        data = request.data
        patient_id = data.get('patient_id')
        admitting_doctor_id = data.get('admitting_doctor_id')
        branch_id = data.get('branch_id')
        bed_id = data.get('bed_id')
        initial_diagnosis = data.get('initial_diagnosis', '')
        admission_source = data.get('admission_source', 'DIRECT')
        priority = data.get('priority', 'ROUTINE')
        requested_ward_type = data.get('requested_ward_type', WardType.GENERAL)
        admission_deposit = Decimal(str(data.get('admission_deposit') or '0.00'))

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=admitting_doctor_id).first()
        if not doctor:
            return Response({'error': 'Admitting doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        branch = Branch.objects.filter(id=branch_id).first() or doctor.branch or Branch.objects.first()

        adm_number = f"IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            # If a bed is immediately requested for allocation:
            allocated_bed = None
            adm_status = AdmissionStatus.REQUESTED

            if bed_id:
                allocated_bed = Bed.objects.select_for_update().filter(id=bed_id).first()
                if not allocated_bed:
                    return Response({'error': 'Selected bed not found.'}, status=status.HTTP_404_NOT_FOUND)
                if allocated_bed.status != BedStatus.AVAILABLE:
                    return Response({
                        'error': f"Bed {allocated_bed.bed_number} is currently {allocated_bed.status}. Only AVAILABLE beds can be allocated."
                    }, status=status.HTTP_409_CONFLICT)

                allocated_bed.status = BedStatus.OCCUPIED
                allocated_bed.save(update_fields=['status'])
                adm_status = AdmissionStatus.ADMITTED

            admission = InpatientAdmission.objects.create(
                admission_number=adm_number,
                patient=patient,
                bed=allocated_bed,
                admitting_doctor=doctor,
                requesting_doctor=doctor,
                branch=branch,
                admission_source=admission_source,
                priority=priority,
                requested_ward_type=requested_ward_type,
                initial_diagnosis=initial_diagnosis,
                status=adm_status,
                admission_deposit=admission_deposit,
                admission_date=timezone.now()
            )

            # Auto-create initial Inpatient Invoice
            inv_number = f"INV-IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            invoice = Invoice.objects.create(
                invoice_number=inv_number,
                patient=patient,
                branch=branch,
                invoice_date=timezone.now().date(),
                subtotal=Decimal('0.00'),
                total_amount=Decimal('0.00'),
                balance_amount=Decimal('0.00'),
                status=InvoiceStatus.ISSUED,
                notes=f"Inpatient Admission Billing ({adm_number}) - Bed {allocated_bed.bed_number if allocated_bed else 'TBD'}"
            )
            admission.invoice = invoice
            admission.save(update_fields=['invoice'])

            log_audit(
                request.user,
                action='INPATIENT_ADMISSION_CREATED',
                entity_type='InpatientAdmission',
                entity_id=admission.id,
                branch=branch,
                new_val={'admission': adm_number, 'bed': allocated_bed.bed_number if allocated_bed else None, 'status': adm_status}
            )

        return Response(InpatientAdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)


class InpatientAdmissionActionView(views.APIView):
    """
    Inpatient Admission lifecycle actions:
    APPROVE, ALLOCATE_BED, REQUEST_DISCHARGE, CLEAR_DISCHARGE, FINALIZE_DISCHARGE, REJECT.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        admission = InpatientAdmission.objects.select_related('patient__user_profile', 'bed__ward', 'branch', 'invoice').filter(id=pk).first()
        if not admission:
            return Response({'error': 'Inpatient admission not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        now = timezone.now()

        if action == 'APPROVE':
            staff = get_staff_profile(request.user)
            admission.status = AdmissionStatus.APPROVED
            admission.approved_by = staff
            admission.approved_at = now
            admission.save()

            log_audit(
                request.user,
                action='INPATIENT_ADMISSION_APPROVED',
                entity_type='InpatientAdmission',
                entity_id=admission.id,
                branch=admission.branch,
                new_val={'status': admission.status}
            )

        elif action == 'ALLOCATE_BED':
            bed_id = request.data.get('bed_id')
            if not bed_id:
                return Response({'error': 'bed_id is required for bed allocation.'}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                new_bed = Bed.objects.select_for_update().filter(id=bed_id).first()
                if not new_bed:
                    return Response({'error': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)
                if new_bed.status != BedStatus.AVAILABLE:
                    return Response({'error': f'Bed {new_bed.bed_number} is not available (currently {new_bed.status}).'}, status=status.HTTP_409_CONFLICT)

                # If previously had a bed, release it to cleaning
                if admission.bed:
                    admission.bed.status = BedStatus.CLEANING
                    admission.bed.save(update_fields=['status'])

                new_bed.status = BedStatus.OCCUPIED
                new_bed.save(update_fields=['status'])

                admission.bed = new_bed
                admission.status = AdmissionStatus.ADMITTED
                admission.save()

                log_audit(
                    request.user,
                    action='INPATIENT_BED_ALLOCATED',
                    entity_type='InpatientAdmission',
                    entity_id=admission.id,
                    branch=admission.branch,
                    new_val={'bed_number': new_bed.bed_number, 'ward': new_bed.ward.name}
                )

        elif action == 'REQUEST_DISCHARGE':
            if admission.status != AdmissionStatus.ADMITTED:
                return Response({'error': f'Cannot initiate discharge for admission in {admission.status} state.'}, status=status.HTTP_400_BAD_REQUEST)

            admission.status = AdmissionStatus.AWAITING_DISCHARGE
            admission.discharge_condition = request.data.get('discharge_condition', 'Clinically Stable')
            admission.discharge_summary = request.data.get('discharge_summary', '')
            admission.follow_up_instructions = request.data.get('follow_up_instructions', '')
            admission.discharge_medications = request.data.get('discharge_medications', [])
            admission.save()

            log_audit(
                request.user,
                action='INPATIENT_DISCHARGE_REQUESTED',
                entity_type='InpatientAdmission',
                entity_id=admission.id,
                branch=admission.branch,
                new_val={'condition': admission.discharge_condition}
            )

        elif action == 'DISCHARGE_CLEARANCE':
            # Update individual clearance flags: clinical, nursing, pharmacy, billing
            staff = get_staff_profile(request.user)
            if 'clinical_clearance' in request.data:
                admission.clinical_clearance = bool(request.data['clinical_clearance'])
            if 'nursing_clearance' in request.data:
                admission.nursing_clearance = bool(request.data['nursing_clearance'])
            if 'pharmacy_clearance' in request.data:
                admission.pharmacy_clearance = bool(request.data['pharmacy_clearance'])
            if 'billing_clearance' in request.data:
                admission.billing_clearance = bool(request.data['billing_clearance'])

            admission.cleared_by = staff
            admission.save()

        elif action == 'FINALIZE_DISCHARGE':
            # Check 4-point clearance (or authorized override)
            override = request.data.get('override', False)
            if not override:
                missing = []
                if not admission.clinical_clearance: missing.append('Clinical Clearance')
                if not admission.nursing_clearance: missing.append('Nursing Clearance')
                if not admission.pharmacy_clearance: missing.append('Pharmacy Clearance')
                if not admission.billing_clearance: missing.append('Billing Clearance')
                if missing:
                    return Response({
                        'error': f"Cannot finalize discharge. Pending clearances: {', '.join(missing)}."
                    }, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                admission.status = AdmissionStatus.DISCHARGED
                admission.discharge_date = now

                # Release allocated bed into CLEANING status for turnover
                if admission.bed:
                    admission.bed.status = BedStatus.CLEANING
                    admission.bed.save(update_fields=['status'])

                # Finalize bill: calculate total bed charges and add to invoice
                if admission.invoice and admission.bed:
                    diff_days = max(1, (admission.discharge_date - admission.admission_date).days)
                    bed_cost = Decimal(str(diff_days)) * admission.bed.daily_rate

                    # Check if bed item already added
                    existing_bed_item = admission.invoice.items.filter(item_type=ChargeItemType.BED_CHARGE).first()
                    if not existing_bed_item:
                        InvoiceItem.objects.create(
                            invoice=admission.invoice,
                            item_type=ChargeItemType.BED_CHARGE,
                            description=f"Inpatient Bed Charges ({diff_days} days @ ₹{admission.bed.daily_rate}/day) - {admission.bed.ward.name} Bed {admission.bed.bed_number}",
                            quantity=diff_days,
                            unit_price=admission.bed.daily_rate,
                            subtotal=bed_cost
                        )
                        admission.invoice.recalculate_totals()

                admission.save()

                log_audit(
                    request.user,
                    action='INPATIENT_DISCHARGE_FINALIZED',
                    entity_type='InpatientAdmission',
                    entity_id=admission.id,
                    branch=admission.branch,
                    new_val={'discharge_date': str(now), 'bed_released': admission.bed.bed_number if admission.bed else None}
                )

        elif action == 'REJECT':
            admission.status = AdmissionStatus.REJECTED
            admission.save()

        else:
            return Response({'error': f'Invalid action "{action}".'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(InpatientAdmissionSerializer(admission).data)


class PatientTransferView(views.APIView):
    """
    Atomic Inpatient Bed/Ward/ICU Transfer with validation, rollback, and handover notes.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        qs = PatientTransfer.objects.select_related(
            'admission', 'patient__user_profile', 'from_bed__ward', 'to_bed__ward', 'requested_by__user_profile'
        )
        admission_id = request.query_params.get('admission_id')
        if admission_id:
            qs = qs.filter(admission_id=admission_id)
        return Response(PatientTransferSerializer(qs[:30], many=True).data)

    def post(self, request):
        data = request.data
        admission_id = data.get('admission_id')
        to_bed_id = data.get('to_bed_id')
        transfer_reason = data.get('transfer_reason', '')
        clinical_handover = data.get('clinical_handover_notes', '')

        if not admission_id or not to_bed_id:
            return Response({'error': 'admission_id and to_bed_id are required.'}, status=status.HTTP_400_BAD_REQUEST)

        admission = InpatientAdmission.objects.select_related('patient__user_profile', 'bed__ward', 'branch').filter(id=admission_id).first()
        if not admission:
            return Response({'error': 'Admission not found.'}, status=status.HTTP_404_NOT_FOUND)
        if admission.status != AdmissionStatus.ADMITTED:
            return Response({'error': f'Cannot transfer patient in {admission.status} state.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user) or admission.admitting_doctor

        with transaction.atomic():
            # Lock destination bed and verify availability
            destination_bed = Bed.objects.select_for_update().filter(id=to_bed_id).first()
            if not destination_bed:
                return Response({'error': 'Destination bed not found.'}, status=status.HTTP_404_NOT_FOUND)
            if destination_bed.status != BedStatus.AVAILABLE:
                return Response({
                    'error': f'Destination Bed {destination_bed.bed_number} is {destination_bed.status}. Only AVAILABLE beds can be targeted for transfer.'
                }, status=status.HTTP_409_CONFLICT)

            old_bed = admission.bed

            # Atomic swap:
            if old_bed:
                old_bed.status = BedStatus.CLEANING
                old_bed.save(update_fields=['status'])

            destination_bed.status = BedStatus.OCCUPIED
            destination_bed.save(update_fields=['status'])

            admission.bed = destination_bed
            admission.save(update_fields=['bed'])

            transfer = PatientTransfer.objects.create(
                admission=admission,
                patient=admission.patient,
                from_bed=old_bed or destination_bed,
                to_bed=destination_bed,
                requested_by=staff,
                transfer_reason=transfer_reason or 'Clinical Bed Transfer',
                clinical_handover_notes=clinical_handover,
                transfer_time=timezone.now()
            )

            log_audit(
                request.user,
                action='PATIENT_BED_TRANSFERRED',
                entity_type='PatientTransfer',
                entity_id=transfer.id,
                branch=admission.branch,
                new_val={
                    'patient_mrn': admission.patient.medical_record_number,
                    'from': f"{old_bed.ward.name} #{old_bed.bed_number}" if old_bed else 'None',
                    'to': f"{destination_bed.ward.name} #{destination_bed.bed_number}"
                }
            )

        return Response({
            'message': f"Patient transferred to {destination_bed.ward.name} - Bed {destination_bed.bed_number} successfully.",
            'transfer': PatientTransferSerializer(transfer).data,
            'admission': InpatientAdmissionSerializer(admission).data
        }, status=status.HTTP_201_CREATED)


class InpatientRunningBillView(views.APIView):
    """
    Real-time running bill calculation aggregating bed charges, pharmacy, lab, and deposits.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request, pk):
        admission = InpatientAdmission.objects.select_related(
            'patient__user_profile', 'bed__ward', 'invoice'
        ).filter(id=pk).first()

        if not admission:
            return Response({'error': 'Admission not found.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        start = admission.admission_date
        end = admission.discharge_date or now
        running_days = max(1, (end - start).days)

        bed_rate = admission.bed.daily_rate if admission.bed else Decimal('0.00')
        total_bed_charges = Decimal(str(running_days)) * bed_rate

        # Get existing invoice items
        invoice_items = []
        if admission.invoice:
            for item in admission.invoice.items.all():
                invoice_items.append({
                    'id': str(item.id),
                    'type': item.item_type,
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit_price': str(item.unit_price),
                    'subtotal': str(item.subtotal)
                })

        deposit_paid = admission.admission_deposit
        invoice_total = admission.invoice.total_amount if admission.invoice else total_bed_charges
        invoice_balance = max(Decimal('0.00'), (admission.invoice.balance_amount if admission.invoice else total_bed_charges) - deposit_paid)

        return Response({
            'admission_number': admission.admission_number,
            'patient_name': admission.patient.user_profile.full_name,
            'patient_mrn': admission.patient.medical_record_number,
            'bed_number': admission.bed.bed_number if admission.bed else '—',
            'ward_name': admission.bed.ward.name if admission.bed else '—',
            'daily_bed_rate': str(bed_rate),
            'running_days': running_days,
            'estimated_bed_charges': str(total_bed_charges),
            'admission_deposit_paid': str(deposit_paid),
            'invoice_number': admission.invoice.invoice_number if admission.invoice else None,
            'invoice_status': admission.invoice.status if admission.invoice else 'PENDING',
            'invoice_total': str(invoice_total),
            'net_balance_due': str(invoice_balance),
            'items': invoice_items
        })

    def post(self, request, pk):
        """Record an admission advance / deposit payment."""
        admission = InpatientAdmission.objects.filter(id=pk).first()
        if not admission:
            return Response({'error': 'Admission not found.'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(request.data.get('amount') or '0.00'))
        if amount <= 0:
            return Response({'error': 'Deposit amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        admission.admission_deposit += amount
        admission.save(update_fields=['admission_deposit'])

        # Update linked invoice if present
        if admission.invoice:
            admission.invoice.paid_amount += amount
            admission.invoice.balance_amount = max(Decimal('0.00'), admission.invoice.total_amount - admission.invoice.paid_amount)
            if admission.invoice.balance_amount == 0 and admission.invoice.total_amount > 0:
                admission.invoice.status = InvoiceStatus.PAID
            elif admission.invoice.paid_amount > 0:
                admission.invoice.status = InvoiceStatus.PARTIALLY_PAID
            admission.invoice.save()

        log_audit(
            request.user,
            action='INPATIENT_DEPOSIT_RECORDED',
            entity_type='InpatientAdmission',
            entity_id=admission.id,
            branch=admission.branch,
            new_val={'deposit_added': str(amount), 'total_deposit': str(admission.admission_deposit)}
        )

        return Response({
            'message': f"Advance deposit of ₹{amount} recorded successfully.",
            'total_deposit': str(admission.admission_deposit),
            'admission': InpatientAdmissionSerializer(admission).data
        })

class BedViewSet(viewsets.ModelViewSet):
    """
    Hospital Bed directory and management.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = BedSerializer

    def get_queryset(self):
        qs = Bed.objects.select_related('ward').all()
        ward_id = self.request.query_params.get('ward_id')
        status_param = self.request.query_params.get('status')
        branch_id = self.request.query_params.get('branch_id')
        if ward_id:
            qs = qs.filter(ward_id=ward_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if branch_id:
            qs = qs.filter(ward__branch_id=branch_id)
        return qs


class BedTurnoverActionView(views.APIView):
    """
    Bed turnover action: marks a bed in CLEANING or MAINTENANCE back to AVAILABLE.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        bed = Bed.objects.filter(id=pk).first()
        if not bed:
            return Response({'error': 'Bed not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action == 'MARK_CLEANED':
            bed.status = BedStatus.AVAILABLE
            bed.save(update_fields=['status'])
            log_audit(request.user, action='BED_CLEANING_COMPLETED', entity_type='Bed', entity_id=bed.id, new_val={'status': 'AVAILABLE'})
        elif action == 'SET_MAINTENANCE':
            bed.status = BedStatus.MAINTENANCE
            bed.save(update_fields=['status'])
        elif action == 'SET_RESERVED':
            bed.status = BedStatus.RESERVED
            bed.save(update_fields=['status'])
        elif action == 'SET_AVAILABLE':
            bed.status = BedStatus.AVAILABLE
            bed.save(update_fields=['status'])
        else:
            return Response({'error': f'Invalid action "{action}".'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(BedSerializer(bed).data)


class IPDReportsView(views.APIView):
    """
    Inpatient census, average length of stay (ALOS), 30-day readmissions, and bed occupancy analytics.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        branch_id = request.query_params.get('branch_id')

        admissions = InpatientAdmission.objects.select_related('patient__user_profile', 'bed__ward', 'branch')
        if branch_id:
            admissions = admissions.filter(branch_id=branch_id)

        # 1. Ward-wise Occupancy Report
        wards = Ward.objects.prefetch_related('beds').all()
        if branch_id:
            wards = wards.filter(branch_id=branch_id)

        ward_reports = []
        for w in wards:
            total_b = w.beds.count()
            occ_b = w.beds.filter(status=BedStatus.OCCUPIED).count()
            avail_b = w.beds.filter(status=BedStatus.AVAILABLE).count()
            clean_b = w.beds.filter(status=BedStatus.CLEANING).count()
            maint_b = w.beds.filter(status=BedStatus.MAINTENANCE).count()
            occ_rate = round((occ_b / total_b * 100), 1) if total_b > 0 else 0

            ward_reports.append({
                'ward_id': str(w.id),
                'ward_name': w.name,
                'ward_type': w.ward_type,
                'floor': w.floor,
                'total_beds': total_b,
                'occupied_beds': occ_b,
                'available_beds': avail_b,
                'cleaning_beds': clean_b,
                'maintenance_beds': maint_b,
                'occupancy_rate_percent': occ_rate
            })

        # 2. 30-Day Readmission Analysis
        # Defined as: patient discharged in last 30 days who has another admission thereafter
        thirty_days_ago = today - timedelta(days=30)
        recent_discharges = InpatientAdmission.objects.filter(
            status=AdmissionStatus.DISCHARGED,
            discharge_date__date__gte=thirty_days_ago
        ).values_list('patient_id', flat=True)

        patient_readmission_counts = Counter(recent_discharges)
        readmission_cases = sum(1 for count in patient_readmission_counts.values() if count > 1)
        total_recent_discharges = len(recent_discharges)
        readmission_rate = round((readmission_cases / total_recent_discharges * 100), 1) if total_recent_discharges > 0 else 0

        # 3. Source Breakdown (Emergency vs OPD vs Direct)
        source_breakdown = admissions.values('admission_source').annotate(count=Count('id'))

        return Response({
            'date': str(today),
            'ward_occupancy': ward_reports,
            'readmissions': {
                'window_days': 30,
                'total_recent_discharges': total_recent_discharges,
                'readmission_cases': readmission_cases,
                'readmission_rate_percent': readmission_rate
            },
            'admission_source_breakdown': list(source_breakdown)
        })
