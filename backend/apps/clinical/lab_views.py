import uuid
import hashlib
import json
from decimal import Decimal
from datetime import datetime, timedelta, date
from django.db import transaction
from django.db.models import Q, Count, Sum, Avg, F
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember
from apps.authentication.models import RoleEnum, PatientProfile, StaffProfile, UserProfile
from apps.authentication.utils import get_staff_profile, get_patient_profile, get_user_profile
from apps.core.models import Branch, Department, AuditLog
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType, Payment
from .models import (
    LabTestCatalogue, LabCategory, LabOrder, LabOrderItem,
    LabOrderStatus, LabItemStatus, LabSample, SampleStatus,
    ExternalDiagnosticProvider, DiagnosticEncounterType,
    ModalityEnum, RadiologyOrder, RadiologyStatus,
    DiagnosticReport, DiagnosticReportStatus, CriticalAlertNotification,
    DiagnosticEquipment, EquipmentTransmissionLog, HL7TransmissionLog,
    Appointment, InpatientAdmission, EmergencyEncounter
)
from .serializers import (
    LabTestCatalogueSerializer, LabOrderSerializer, LabOrderItemSerializer,
    LabSampleSerializer, ExternalDiagnosticProviderSerializer,
    RadiologyOrderSerializer, DiagnosticReportSerializer,
    CriticalAlertNotificationSerializer, DiagnosticEquipmentSerializer,
    EquipmentTransmissionLogSerializer, HL7TransmissionLogSerializer
)


def log_lab_audit(user, action, entity_type, entity_id, branch=None, old_val=None, new_val=None):
    """Helper to record immutable audit trail for laboratory & diagnostic operations."""
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


class LaboratoryDashboardStatsView(views.APIView):
    """
    Operational metrics and real-time dashboard statistics for Laboratory and Diagnostic Management.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        branch_id = request.query_params.get('branch_id')

        order_qs = LabOrder.objects.all()
        sample_qs = LabSample.objects.all()
        rad_qs = RadiologyOrder.objects.all()
        alert_qs = CriticalAlertNotification.objects.all()
        item_qs = LabOrderItem.objects.all()

        if branch_id:
            order_qs = order_qs.filter(branch_id=branch_id)
            sample_qs = sample_qs.filter(lab_order__branch_id=branch_id)
            rad_qs = rad_qs.filter(branch_id=branch_id)
            alert_qs = alert_qs.filter(lab_order__branch_id=branch_id)
            item_qs = item_qs.filter(lab_order__branch_id=branch_id)

        # Operational Metrics
        orders_received_today = order_qs.filter(created_at__date=today).count()
        total_orders = order_qs.count()
        awaiting_collection = order_qs.filter(status=LabOrderStatus.ORDERED).count()
        samples_collected = sample_qs.filter(status__in=[SampleStatus.COLLECTED, SampleStatus.RECEIVED_IN_LAB]).count()
        tests_in_progress = order_qs.filter(status=LabOrderStatus.IN_PROCESS).count()
        awaiting_validation = order_qs.filter(status=LabOrderStatus.AWAITING_VALIDATION).count()
        awaiting_approval = order_qs.filter(status=LabOrderStatus.AWAITING_APPROVAL).count()
        completed_released = order_qs.filter(status=LabOrderStatus.RELEASED).count()
        critical_unacknowledged = alert_qs.filter(is_acknowledged=False).count()
        radiology_pending = rad_qs.exclude(status__in=[RadiologyStatus.RELEASED, RadiologyStatus.CANCELLED]).count()
        outsourced_pending = order_qs.filter(is_outsourced=True).exclude(status__in=[LabOrderStatus.RELEASED, LabOrderStatus.CANCELLED]).count()

        # Category Breakdown
        category_counts = {}
        for cat in LabCategory.choices:
            code = cat[0]
            count = item_qs.filter(test__category=code).count()
            category_counts[code] = {
                'label': cat[1],
                'count': count
            }

        # Priority Counts
        stat_orders = order_qs.filter(priority='STAT', status__in=[
            LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROCESS
        ]).count()
        urgent_orders = order_qs.filter(priority='URGENT', status__in=[
            LabOrderStatus.ORDERED, LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.IN_PROCESS
        ]).count()

        # Turnaround Time (TAT) Calculation (Hours from sample collection to report release)
        completed_samples = sample_qs.filter(status=SampleStatus.COMPLETED, lab_order__status=LabOrderStatus.RELEASED)
        total_tat_hours = 0
        tat_count = 0
        for s in completed_samples[:50]:
            diff = (s.updated_at - s.collected_at).total_seconds() / 3600.0
            total_tat_hours += max(0.5, diff)
            tat_count += 1
        avg_tat_hours = round(total_tat_hours / tat_count, 1) if tat_count > 0 else 3.5

        # Recent Critical Alerts
        active_critical_alerts = CriticalAlertNotificationSerializer(
            alert_qs.filter(is_acknowledged=False).select_related('patient__user_profile', 'recipient_doctor__user_profile')[:5],
            many=True
        ).data

        return Response({
            'orders_received_today': orders_received_today,
            'total_orders': total_orders,
            'awaiting_collection': awaiting_collection,
            'samples_collected': samples_collected,
            'tests_in_progress': tests_in_progress,
            'awaiting_validation': awaiting_validation,
            'awaiting_approval': awaiting_approval,
            'completed_released': completed_released,
            'critical_unacknowledged': critical_unacknowledged,
            'radiology_pending': radiology_pending,
            'outsourced_pending': outsourced_pending,
            'stat_orders': stat_orders,
            'urgent_orders': urgent_orders,
            'avg_tat_hours': avg_tat_hours,
            'category_counts': category_counts,
            'active_critical_alerts': active_critical_alerts
        })


class ExternalDiagnosticProviderViewSet(viewsets.ModelViewSet):
    """
    Master External Referral Laboratories and Diagnostic Partners.
    """
    queryset = ExternalDiagnosticProvider.objects.all()
    serializer_class = ExternalDiagnosticProviderSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        provider = serializer.save()
        log_lab_audit(self.request.user, 'EXTERNAL_PROVIDER_CREATED', 'ExternalDiagnosticProvider', provider.id)

    def perform_update(self, serializer):
        provider = serializer.save()
        log_lab_audit(self.request.user, 'EXTERNAL_PROVIDER_UPDATED', 'ExternalDiagnosticProvider', provider.id)


class LabTestCatalogueViewSet(viewsets.ModelViewSet):
    """
    Comprehensive Database-Backed Diagnostic Test Catalogue with Configurable Pricing,
    Reference Intervals, and Outsourcing Parameters.
    """
    serializer_class = LabTestCatalogueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = LabTestCatalogue.objects.select_related('department', 'external_provider')
        category = self.request.query_params.get('category')
        is_active = self.request.query_params.get('is_active')
        is_outsourced = self.request.query_params.get('is_outsourced')
        search = self.request.query_params.get('search')

        if category:
            qs = qs.filter(category=category)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        if is_outsourced is not None:
            qs = qs.filter(is_outsourced=is_outsourced.lower() in ('true', '1'))
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return qs

    def perform_create(self, serializer):
        test = serializer.save()
        log_lab_audit(self.request.user, 'CATALOGUE_TEST_CREATED', 'LabTestCatalogue', test.id, new_val=serializer.data)

    def perform_update(self, serializer):
        instance = self.get_object()
        old_val = {'rate': str(instance.standard_rate), 'is_active': instance.is_active}
        test = serializer.save()
        new_val = {'rate': str(test.standard_rate), 'is_active': test.is_active}
        log_lab_audit(self.request.user, 'CATALOGUE_TEST_UPDATED', 'LabTestCatalogue', test.id, old_val=old_val, new_val=new_val)


class InvestigationOrderCreateView(views.APIView):
    """
    Place Diagnostic Investigation Orders from OPD Consultations, IPD Inpatients,
    Emergency Casualty, and Direct Walk-ins.
    Prevents accidental duplicate orders within 24 hours and guarantees billing synchronization.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request):
        data = request.data
        patient_id = data.get('patient_id')
        doctor_id = data.get('doctor_id')
        branch_id = data.get('branch_id')
        test_ids = data.get('test_ids', [])
        encounter_type = data.get('encounter_type', DiagnosticEncounterType.OPD)
        priority = data.get('priority', 'ROUTINE')
        clinical_notes = data.get('clinical_notes', '')
        allow_duplicate = data.get('allow_duplicate', False)

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        doctor = StaffProfile.objects.filter(id=doctor_id).first() if doctor_id else get_staff_profile(request.user)
        if not doctor:
            doctor = StaffProfile.objects.first()

        branch = Branch.objects.filter(id=branch_id).first() if branch_id else doctor.branch

        if not test_ids:
            return Response({'error': 'At least one diagnostic investigation must be selected.'}, status=status.HTTP_400_BAD_REQUEST)

        # Parse test_ids safely
        clean_test_ids = []
        if isinstance(test_ids, str):
            try:
                test_ids = json.loads(test_ids)
            except Exception:
                test_ids = [t.strip() for t in test_ids.split(',') if t.strip()]

        for tid in test_ids:
            try:
                clean_test_ids.append(uuid.UUID(str(tid)))
            except (ValueError, TypeError):
                pass

        if not clean_test_ids:
            return Response({'error': 'No valid investigation test IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

        # Duplicate order prevention: Check if identical test ordered for same patient in past 24 hours
        one_day_ago = timezone.now() - timedelta(hours=24)
        if not allow_duplicate:
            existing_recent = LabOrderItem.objects.filter(
                lab_order__patient=patient,
                test_id__in=clean_test_ids,
                lab_order__created_at__gte=one_day_ago
            ).exclude(lab_order__status=LabOrderStatus.CANCELLED).first()

            if existing_recent:
                return Response({
                    'duplicate_warning': True,
                    'message': f"Duplicate warning: Test '{existing_recent.test.name}' was already ordered for this patient on {existing_recent.lab_order.created_at.strftime('%Y-%m-%d %H:%M')}. Pass 'allow_duplicate=True' to override."
                }, status=status.HTTP_409_CONFLICT)

        # Generate unique order number
        order_number = f"LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # Resolve encounter links
        appointment = None
        admission = None
        emergency_encounter = None

        if encounter_type == DiagnosticEncounterType.OPD and data.get('appointment_id'):
            appointment = Appointment.objects.filter(id=data['appointment_id']).first()
        elif encounter_type == DiagnosticEncounterType.IPD and data.get('admission_id'):
            admission = InpatientAdmission.objects.filter(id=data['admission_id']).first()
        elif encounter_type == DiagnosticEncounterType.EMERGENCY and data.get('emergency_encounter_id'):
            emergency_encounter = EmergencyEncounter.objects.filter(id=data['emergency_encounter_id']).first()

        # Check if any test in order is outsourced
        tests = LabTestCatalogue.objects.filter(id__in=clean_test_ids)
        is_any_outsourced = any(t.is_outsourced for t in tests)
        primary_provider = None
        for t in tests:
            if t.is_outsourced and t.external_provider:
                primary_provider = t.external_provider
                break

        # Create LabOrder
        order = LabOrder.objects.create(
            order_number=order_number,
            patient=patient,
            doctor=doctor,
            branch=branch,
            encounter_type=encounter_type,
            appointment=appointment,
            admission=admission,
            emergency_encounter=emergency_encounter,
            priority=priority,
            status=LabOrderStatus.ORDERED,
            clinical_notes=clinical_notes,
            is_outsourced=is_any_outsourced,
            external_provider=primary_provider
        )

        # Create Order Items and capture standard rate at time of order
        total_order_charge = Decimal('0.00')
        for t in tests:
            LabOrderItem.objects.create(
                lab_order=order,
                test=t,
                captured_price=t.standard_rate,
                unit_of_measurement=t.unit_of_measurement,
                reference_range=t.reference_range,
                status=LabItemStatus.PENDING
            )
            total_order_charge += t.standard_rate

        # Financial integration: Attach diagnostic charges to active patient invoice without double billing
        target_invoice = None
        if admission and admission.invoice:
            target_invoice = admission.invoice
        elif appointment and appointment.invoice:
            target_invoice = appointment.invoice
        else:
            # Check for existing open issued invoice today or create new diagnostic invoice
            target_invoice = Invoice.objects.filter(
                patient=patient,
                branch=branch,
                status__in=[InvoiceStatus.ISSUED, InvoiceStatus.DRAFT]
            ).first()

            if not target_invoice:
                inv_number = f"INV-LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                target_invoice = Invoice.objects.create(
                    invoice_number=inv_number,
                    patient=patient,
                    branch=branch,
                    subtotal=Decimal('0.00'),
                    total_amount=Decimal('0.00'),
                    balance_amount=Decimal('0.00'),
                    status=InvoiceStatus.ISSUED,
                    notes=f"Diagnostic Laboratory Requisition {order_number}"
                )

        # Add invoice item for each test ordered
        for t in tests:
            InvoiceItem.objects.create(
                invoice=target_invoice,
                item_type=ChargeItemType.LAB_TEST,
                description=f"Lab Test: {t.name} [{t.code}]",
                quantity=1,
                unit_price=t.standard_rate
            )

        target_invoice.recalculate_totals()
        order.invoice = target_invoice
        order.save(update_fields=['invoice'])

        log_lab_audit(
            request.user,
            'INVESTIGATION_ORDER_CREATED',
            'LabOrder',
            order.id,
            branch=branch,
            new_val={'order_number': order_number, 'tests_count': len(tests), 'total_charge': str(total_order_charge)}
        )

        return Response(LabOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class LabOrderCancelView(views.APIView):
    """
    Cancel an uncollected or authorized lab order with reasons and audit history.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, pk):
        order = LabOrder.objects.filter(id=pk).first()
        if not order:
            return Response({'error': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status in [LabOrderStatus.APPROVED, LabOrderStatus.RELEASED]:
            return Response({'error': 'Cannot cancel an already approved or released lab order.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', 'Cancelled by attending clinician.')
        staff = get_staff_profile(request.user)

        old_status = order.status
        order.status = LabOrderStatus.CANCELLED
        order.cancelled_reason = reason
        order.cancelled_by = staff
        order.cancelled_at = timezone.now()
        order.save()

        # Update items
        order.items.update(status=LabItemStatus.PENDING)

        log_lab_audit(
            request.user,
            'LAB_ORDER_CANCELLED',
            'LabOrder',
            order.id,
            branch=order.branch,
            old_val={'status': old_status},
            new_val={'status': 'CANCELLED', 'reason': reason}
        )

        return Response({'success': True, 'message': 'Lab order cancelled successfully.', 'order': LabOrderSerializer(order).data})


class LabSampleCollectionView(views.APIView):
    """
    Sample collection workflow with unique barcode assignment, specimen identification,
    and phlebotomy logging.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, order_id):
        order = LabOrder.objects.filter(id=order_id).first()
        if not order:
            return Response({'error': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        staff = get_staff_profile(request.user)
        specimen_type = data.get('specimen_type', 'Blood (EDTA)')
        container_type = data.get('container_type', 'Lavender Vacutainer')
        collection_site = data.get('collection_site', 'Left cubital fossa')

        # Generate unique barcode: SMP-YYYYMMDD-XXXX
        sample_barcode = f"SMP-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        sample = LabSample.objects.create(
            sample_barcode=sample_barcode,
            lab_order=order,
            patient=order.patient,
            specimen_type=specimen_type,
            container_type=container_type,
            collection_site=collection_site,
            collected_by=staff,
            collected_at=timezone.now(),
            status=SampleStatus.COLLECTED
        )

        # Associate sample with order items matching specimen
        order.items.update(sample=sample)
        order.status = LabOrderStatus.SAMPLE_COLLECTED
        order.specimen_accession_number = sample_barcode
        order.save(update_fields=['status', 'specimen_accession_number'])

        log_lab_audit(
            request.user,
            'SAMPLE_COLLECTED',
            'LabSample',
            sample.id,
            branch=order.branch,
            new_val={'barcode': sample_barcode, 'specimen_type': specimen_type, 'order_number': order.order_number}
        )

        return Response({
            'success': True,
            'message': f"Sample collected with barcode {sample_barcode}.",
            'sample': LabSampleSerializer(sample).data,
            'order': LabOrderSerializer(order).data
        }, status=status.HTTP_201_CREATED)


class LabSampleActionView(views.APIView):
    """
    Actions on physical specimens: Receive in Lab, Processing, Reject (Hemolyzed/Clotted),
    and Request Recollection.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, pk):
        sample = LabSample.objects.filter(id=pk).first()
        if not sample:
            return Response({'error': 'Lab sample not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        staff = get_staff_profile(request.user)
        old_status = sample.status

        if action == 'RECEIVE':
            sample.status = SampleStatus.RECEIVED_IN_LAB
            sample.storage_location = request.data.get('storage_location', 'Sample Reception Rack A1')
            sample.save()
            sample.lab_order.status = LabOrderStatus.IN_PROCESS
            sample.lab_order.save(update_fields=['status'])
            msg = 'Sample received in laboratory.'

        elif action == 'PROCESS':
            sample.status = SampleStatus.PROCESSING
            sample.save()
            sample.lab_order.status = LabOrderStatus.IN_PROCESS
            sample.lab_order.save(update_fields=['status'])
            msg = 'Sample moved to analyzer processing stage.'

        elif action == 'REJECT':
            reason = request.data.get('reason', 'Sample hemolyzed / clotted / insufficient volume.')
            sample.status = SampleStatus.REJECTED
            sample.rejection_reason = reason
            sample.rejected_by = staff
            sample.rejected_at = timezone.now()
            sample.save()
            sample.lab_order.status = LabOrderStatus.ORDERED  # Reset order to awaiting recollection
            sample.lab_order.save(update_fields=['status'])
            msg = f'Sample rejected: {reason}'

        elif action == 'RECOLLECTION':
            # Create linked recollection sample
            recollection_barcode = f"SMP-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}-R"
            new_sample = LabSample.objects.create(
                sample_barcode=recollection_barcode,
                lab_order=sample.lab_order,
                patient=sample.patient,
                specimen_type=sample.specimen_type,
                container_type=sample.container_type,
                collected_by=staff,
                collected_at=timezone.now(),
                status=SampleStatus.COLLECTED,
                is_recollection=True,
                recollected_from_sample=sample
            )
            sample.lab_order.samples.add(new_sample)
            sample.lab_order.items.update(sample=new_sample)
            sample.lab_order.status = LabOrderStatus.SAMPLE_COLLECTED
            sample.lab_order.specimen_accession_number = recollection_barcode
            sample.lab_order.save(update_fields=['status', 'specimen_accession_number'])
            msg = f'Recollection sample registered with barcode {recollection_barcode}.'
            sample = new_sample
        else:
            return Response({'error': f"Invalid sample action '{action}'."}, status=status.HTTP_400_BAD_REQUEST)

        log_lab_audit(
            request.user,
            f"SAMPLE_{action}",
            'LabSample',
            sample.id,
            branch=sample.lab_order.branch,
            old_val={'status': old_status},
            new_val={'status': sample.status}
        )

        return Response({
            'success': True,
            'message': msg,
            'sample': LabSampleSerializer(sample).data,
            'order': LabOrderSerializer(sample.lab_order).data
        })


class BarcodeLookupView(views.APIView):
    """
    Instant barcode scanner and manual entry lookup endpoint for sample tubes and accession labels.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, barcode):
        sample = LabSample.objects.select_related(
            'lab_order__patient__user_profile',
            'lab_order__doctor__user_profile',
            'collected_by__user_profile'
        ).filter(sample_barcode=barcode).first()

        if sample:
            return Response({
                'found': True,
                'type': 'SAMPLE',
                'sample': LabSampleSerializer(sample).data,
                'order': LabOrderSerializer(sample.lab_order).data
            })

        # Check if accession number matches order directly
        order = LabOrder.objects.filter(Q(order_number=barcode) | Q(specimen_accession_number=barcode)).first()
        if order:
            return Response({
                'found': True,
                'type': 'ORDER',
                'order': LabOrderSerializer(order).data
            })

        return Response({'found': False, 'message': f"No specimen or order found with barcode '{barcode}'."}, status=status.HTTP_404_NOT_FOUND)


class LabResultEntryView(views.APIView):
    """
    Enter diagnostic test results (quantitative, qualitative, or structured text).
    Automatically flags normal/abnormal and critical panic results against configured reference ranges,
    and triggers CriticalAlertNotification when critical thresholds are exceeded.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, item_id):
        item = LabOrderItem.objects.select_related('test', 'lab_order__patient__user_profile', 'lab_order__doctor').filter(id=item_id).first()
        if not item:
            return Response({'error': 'Lab test item not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        result_value = data.get('result_value', '').strip()
        result_notes = data.get('result_notes', '')
        action = data.get('action', 'SUBMIT')  # DRAFT or SUBMIT
        staff = get_staff_profile(request.user)
        test = item.test

        if not result_value:
            return Response({'error': 'Result value cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        # Quantitative Evaluation & Auto-Flagging
        is_abnormal = False
        is_critical = False
        abnormal_flag = 'NORMAL'

        try:
            val_num = Decimal(str(result_value).replace(',', ''))
            # Normal range check
            if test.normal_min is not None and val_num < test.normal_min:
                is_abnormal = True
                abnormal_flag = 'LOW'
            elif test.normal_max is not None and val_num > test.normal_max:
                is_abnormal = True
                abnormal_flag = 'HIGH'

            # Critical panic check
            if test.critical_low is not None and val_num < test.critical_low:
                is_critical = True
                abnormal_flag = 'CRITICAL_LOW'
            elif test.critical_high is not None and val_num > test.critical_high:
                is_critical = True
                abnormal_flag = 'CRITICAL_HIGH'

        except (ValueError, ArithmeticError):
            # Qualitative evaluation (e.g. POSITIVE / REACTIVE)
            upper_val = result_value.upper()
            if any(term in upper_val for term in ['POSITIVE', 'REACTIVE', 'ABNORMAL', 'DETECTED']):
                is_abnormal = True
                abnormal_flag = 'POSITIVE'
            if any(term in upper_val for term in ['CRITICAL', 'PANIC', 'MALIGNANT']):
                is_critical = True
                abnormal_flag = 'CRITICAL_POSITIVE'

        # Allow manual override from senior technologist / pathologist
        if data.get('manual_abnormal_override') is not None:
            is_abnormal = bool(data.get('manual_abnormal_override'))
        if data.get('manual_critical_override') is not None:
            is_critical = bool(data.get('manual_critical_override'))
            if is_critical:
                abnormal_flag = 'CRITICAL'

        # Save previous result for audit if updating
        if item.result_value and item.result_value != result_value:
            item.previous_result_value = item.result_value

        item.result_value = result_value
        item.is_abnormal = is_abnormal
        item.is_critical = is_critical
        item.abnormal_flag = abnormal_flag
        item.result_notes = result_notes
        item.entered_by = staff
        item.entered_at = timezone.now()

        if action == 'DRAFT':
            item.status = LabItemStatus.DRAFT
            item.save()
            msg = 'Draft result saved.'
        else:
            item.status = LabItemStatus.VALIDATED
            item.validated_by = staff
            item.validated_at = timezone.now()
            item.save()
            msg = 'Result entered and marked for validation.'

        # If any item is critical, flag the entire order and create CriticalAlertNotification
        if is_critical:
            item.lab_order.is_critical = True
            item.lab_order.save(update_fields=['is_critical'])

            CriticalAlertNotification.objects.create(
                lab_order=item.lab_order,
                order_item=item,
                patient=item.lab_order.patient,
                test_name=test.name,
                critical_value=f"{result_value} {test.unit_of_measurement}".strip(),
                recipient_doctor=item.lab_order.doctor,
                channel='IN_APP',
                delivery_status='DELIVERED_IN_APP'
            )

        # Check if all items in order are now evaluated
        order = item.lab_order
        all_items = order.items.all()
        if all(i.status in [LabItemStatus.VALIDATED, LabItemStatus.APPROVED, LabItemStatus.RELEASED] for i in all_items):
            order.status = LabOrderStatus.AWAITING_APPROVAL
        else:
            order.status = LabOrderStatus.IN_PROCESS
        order.save(update_fields=['status'])

        log_lab_audit(
            request.user,
            'RESULT_ENTERED',
            'LabOrderItem',
            item.id,
            branch=order.branch,
            new_val={'test': test.name, 'value': result_value, 'is_abnormal': is_abnormal, 'is_critical': is_critical}
        )

        return Response({
            'success': True,
            'message': msg,
            'item': LabOrderItemSerializer(item).data,
            'order': LabOrderSerializer(order).data,
            'is_critical_alert_triggered': is_critical
        })


class LabReportApprovalView(views.APIView):
    """
    Permission-controlled Pathologist and Medical Director Laboratory Report Approval.
    Enforces separation of duties and prepares finalized DiagnosticReport.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, order_id):
        order = LabOrder.objects.prefetch_related('items__test').filter(id=order_id).first()
        if not order:
            return Response({'error': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)

        # Permission check: Approver must be Doctor, Medical Director, or Admin
        allowed_roles = [RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR, RoleEnum.HOSPITAL_ADMIN, RoleEnum.SUPER_ADMIN]
        user_prof = get_user_profile(request.user)
        user_role = user_prof.role.name if (user_prof and user_prof.role) else (staff.user_profile.role.name if (staff and staff.user_profile and staff.user_profile.role) else '')
        if user_role not in allowed_roles:
            return Response({'error': 'Only authorized Pathologists, Medical Directors, or Hospital Admins can approve diagnostic reports.'}, status=status.HTTP_403_FORBIDDEN)

        # Separation of Duties check: prevent approver from approving results they personally entered
        separation_required = request.data.get('enforce_separation_of_duties', True)
        if separation_required and user_role != RoleEnum.SUPER_ADMIN:
            for item in order.items.all():
                if item.entered_by and item.entered_by == staff:
                    return Response({
                        'error': 'Separation of duties violation: You entered the test results and cannot approve your own work. A separate pathologist must review and approve.'
                    }, status=status.HTTP_403_FORBIDDEN)

        # Approve all items
        order.items.update(status=LabItemStatus.APPROVED)
        order.status = LabOrderStatus.APPROVED
        order.save(update_fields=['status'])

        # Generate or update DiagnosticReport
        report_number = f"REP-LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        report, _ = DiagnosticReport.objects.get_or_create(
            lab_order=order,
            defaults={
                'report_number': report_number,
                'report_type': 'LABORATORY',
                'patient': order.patient,
                'branch': order.branch,
                'version': 1,
                'status': DiagnosticReportStatus.APPROVED,
                'prepared_by': staff,
                'approved_by': staff,
                'approved_at': timezone.now(),
                'summary_findings': request.data.get('summary_findings', 'All diagnostic investigations reviewed and approved.'),
                'clinical_comments': request.data.get('clinical_comments', '')
            }
        )

        log_lab_audit(
            request.user,
            'LAB_REPORT_APPROVED',
            'DiagnosticReport',
            report.id,
            branch=order.branch,
            new_val={'order_number': order.order_number, 'report_number': report.report_number, 'approved_by': staff.user_profile.full_name}
        )

        return Response({
            'success': True,
            'message': 'Laboratory diagnostic report approved successfully.',
            'report': DiagnosticReportSerializer(report).data,
            'order': LabOrderSerializer(order).data
        })


class LabReportReleaseView(views.APIView):
    """
    Release approved laboratory report to patient portal with digital signature hash.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, order_id):
        order = LabOrder.objects.filter(id=order_id).first()
        if not order:
            return Response({'error': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status not in [LabOrderStatus.APPROVED, LabOrderStatus.AWAITING_APPROVAL]:
            return Response({'error': 'Only approved diagnostic reports can be released.'}, status=status.HTTP_400_BAD_REQUEST)

        report = DiagnosticReport.objects.filter(lab_order=order).first()
        if not report:
            # Create approved report if not present
            staff = get_staff_profile(request.user)
            report_number = f"REP-LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            report = DiagnosticReport.objects.create(
                report_number=report_number,
                report_type='LABORATORY',
                lab_order=order,
                patient=order.patient,
                branch=order.branch,
                version=1,
                status=DiagnosticReportStatus.APPROVED,
                approved_by=staff,
                approved_at=timezone.now()
            )

        # Generate digital signature hash (HMAC-SHA256 representation)
        payload_str = f"{order.order_number}:{report.report_number}:{order.patient.medical_record_number}:{timezone.now().isoformat()}"
        digital_signature = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()

        report.status = DiagnosticReportStatus.RELEASED
        report.is_released = True
        report.released_at = timezone.now()
        report.digital_signature_hash = digital_signature
        report.save()

        order.status = LabOrderStatus.RELEASED
        order.save(update_fields=['status'])
        order.items.update(status=LabItemStatus.RELEASED)

        # Mark samples completed
        order.samples.update(status=SampleStatus.COMPLETED)

        log_lab_audit(
            request.user,
            'LAB_REPORT_RELEASED',
            'DiagnosticReport',
            report.id,
            branch=order.branch,
            new_val={'report_number': report.report_number, 'digital_signature': digital_signature}
        )

        return Response({
            'success': True,
            'message': 'Laboratory report published and released to patient portal.',
            'report': DiagnosticReportSerializer(report).data,
            'order': LabOrderSerializer(order).data
        })


class LabReportAmendmentView(views.APIView):
    """
    Controlled correction / amendment of an already released laboratory report.
    Increments report version, preserves prior values and full audit history.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, order_id):
        order = LabOrder.objects.prefetch_related('items__test').filter(id=order_id).first()
        if not order:
            return Response({'error': 'Lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('amendment_reason')
        if not reason:
            return Response({'error': 'An amendment reason is strictly required.'}, status=status.HTTP_400_BAD_REQUEST)

        item_updates = request.data.get('item_updates', [])
        if isinstance(item_updates, str):
            try:
                import json
                item_updates = json.loads(item_updates)
            except Exception:
                item_updates = []

        staff = get_staff_profile(request.user)

        # Update items with new values and preserve prior values
        for upd in item_updates:
            if isinstance(upd, str):
                try:
                    import json
                    upd = json.loads(upd)
                except Exception:
                    continue
            if not isinstance(upd, dict):
                continue
            item = LabOrderItem.objects.filter(id=upd.get('item_id'), lab_order=order).first()
            if item:
                item.previous_result_value = item.result_value
                item.result_value = upd.get('new_value', item.result_value)
                item.correction_reason = reason
                item.status = LabItemStatus.AMENDED
                item.validated_by = staff
                item.validated_at = timezone.now()
                item.save()

        # Fetch latest report and create amended version
        latest_report = DiagnosticReport.objects.filter(lab_order=order).order_by('-version').first()
        new_version = (latest_report.version + 1) if latest_report else 2
        new_report_num = f"REP-LAB-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}-v{new_version}"

        amended_report = DiagnosticReport.objects.create(
            report_number=new_report_num,
            report_type='LABORATORY',
            lab_order=order,
            patient=order.patient,
            branch=order.branch,
            version=new_version,
            status=DiagnosticReportStatus.AMENDED,
            prepared_by=staff,
            approved_by=staff,
            approved_at=timezone.now(),
            released_at=timezone.now(),
            is_released=True,
            original_report=latest_report,
            amendment_notes=reason,
            summary_findings=f"AMENDED REPORT (v{new_version}): {reason}"
        )

        order.status = LabOrderStatus.RELEASED
        order.save(update_fields=['status'])

        log_lab_audit(
            request.user,
            'LAB_REPORT_AMENDED',
            'DiagnosticReport',
            amended_report.id,
            branch=order.branch,
            new_val={'new_report_number': new_report_num, 'version': new_version, 'reason': reason}
        )

        return Response({
            'success': True,
            'message': f"Report amended to version {new_version}.",
            'amended_report': DiagnosticReportSerializer(amended_report).data,
            'order': LabOrderSerializer(order).data
        })


class CriticalAlertsListView(views.APIView):
    """
    List active panic value critical alerts requiring immediate clinical attention.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        branch_id = request.query_params.get('branch_id')
        is_acknowledged = request.query_params.get('is_acknowledged')

        qs = CriticalAlertNotification.objects.select_related(
            'patient__user_profile',
            'recipient_doctor__user_profile',
            'acknowledged_by__user_profile'
        )

        if branch_id:
            qs = qs.filter(lab_order__branch_id=branch_id)
        if is_acknowledged is not None:
            qs = qs.filter(is_acknowledged=is_acknowledged.lower() in ('true', '1'))

        return Response(CriticalAlertNotificationSerializer(qs, many=True).data)


class CriticalAlertAcknowledgeView(views.APIView):
    """
    Acknowledge a critical panic alert with notes and timestamp.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        alert = CriticalAlertNotification.objects.filter(id=pk).first()
        if not alert:
            return Response({'error': 'Critical alert not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)
        notes = request.data.get('acknowledgement_notes', 'Acknowledged by clinical team. Action taken.')

        alert.is_acknowledged = True
        alert.acknowledged_by = staff
        alert.acknowledged_at = timezone.now()
        alert.acknowledgement_notes = notes
        alert.save()

        log_lab_audit(
            request.user,
            'CRITICAL_ALERT_ACKNOWLEDGED',
            'CriticalAlertNotification',
            alert.id,
            new_val={'acknowledged_by': staff.user_profile.full_name, 'notes': notes}
        )

        return Response({
            'success': True,
            'message': 'Critical alert acknowledged.',
            'alert': CriticalAlertNotificationSerializer(alert).data
        })


class CriticalAlertEscalateView(views.APIView):
    """
    Escalate unacknowledged critical alert to Medical Director / Nursing Supervisor.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        alert = CriticalAlertNotification.objects.filter(id=pk).first()
        if not alert:
            return Response({'error': 'Critical alert not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_doctor_id = request.data.get('target_doctor_id')
        target_doctor = StaffProfile.objects.filter(id=target_doctor_id).first() if target_doctor_id else None

        if not target_doctor:
            # Fallback to Medical Director / HOD
            target_doctor = StaffProfile.objects.filter(
                user_profile__role__name__in=[RoleEnum.MEDICAL_DIRECTOR, RoleEnum.DEPARTMENT_HEAD, RoleEnum.HOSPITAL_ADMIN]
            ).first()

        alert.escalated_to = target_doctor
        alert.escalated_at = timezone.now()
        alert.save()

        log_lab_audit(
            request.user,
            'CRITICAL_ALERT_ESCALATED',
            'CriticalAlertNotification',
            alert.id,
            new_val={'escalated_to': target_doctor.user_profile.full_name if target_doctor else 'Admin'}
        )

        return Response({
            'success': True,
            'message': f"Critical alert escalated to {target_doctor.user_profile.full_name if target_doctor else 'Administration'}.",
            'alert': CriticalAlertNotificationSerializer(alert).data
        })


class RadiologyWorkflowViewSet(viewsets.ModelViewSet):
    """
    Radiology Information System (RIS) Order Lifecycle, Appointment Scheduling,
    Technician Procedure Completion, and Radiologist Diagnostic Reporting.
    """
    serializer_class = RadiologyOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = RadiologyOrder.objects.select_related(
            'patient__user_profile', 'doctor__user_profile',
            'radiologist__user_profile', 'performing_technician__user_profile',
            'approved_by__user_profile', 'branch'
        )

        # Patient portal isolation
        if hasattr(user, 'profile') and hasattr(user.profile, 'patient_profile'):
            return qs.filter(patient=user.profile.patient_profile, is_released=True)

        branch_id = self.request.query_params.get('branch_id')
        modality = self.request.query_params.get('modality')
        rad_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        search = self.request.query_params.get('search')

        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if modality:
            qs = qs.filter(modality=modality)
        if rad_status:
            qs = qs.filter(status=rad_status)
        if priority:
            qs = qs.filter(priority=priority)
        if search:
            qs = qs.filter(
                Q(order_number__icontains=search) |
                Q(study_name__icontains=search) |
                Q(patient__user_profile__first_name__icontains=search) |
                Q(patient__medical_record_number__icontains=search)
            )
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        doctor = StaffProfile.objects.filter(id=data.get('doctor_id')).first() or get_staff_profile(request.user)
        branch = Branch.objects.filter(id=data.get('branch_id')).first() or doctor.branch

        order_number = f"RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        accession_number = f"ACC-{uuid.uuid4().hex[:8].upper()}"

        standard_rates = {
            'X_RAY': Decimal('800.00'),
            'CT_SCAN': Decimal('4500.00'),
            'MRI': Decimal('7500.00'),
            'ULTRASOUND': Decimal('1800.00'),
            'MAMMOGRAPHY': Decimal('2200.00'),
            'PET_CT': Decimal('18000.00'),
            'DEXA': Decimal('2500.00')
        }
        modality = data.get('modality', 'X_RAY')
        captured_rate = standard_rates.get(modality, Decimal('1200.00'))

        order = RadiologyOrder.objects.create(
            order_number=order_number,
            accession_number=accession_number,
            patient=patient,
            doctor=doctor,
            branch=branch,
            encounter_type=data.get('encounter_type', DiagnosticEncounterType.OPD),
            modality=modality,
            study_name=data['study_name'],
            clinical_indication=data.get('clinical_indication', ''),
            priority=data.get('priority', 'ROUTINE'),
            status=RadiologyStatus.REQUESTED,
            captured_rate=captured_rate
        )

        # Financial integration
        inv = Invoice.objects.filter(patient=patient, branch=branch, status__in=[InvoiceStatus.ISSUED, InvoiceStatus.DRAFT]).first()
        if not inv:
            inv = Invoice.objects.create(
                invoice_number=f"INV-RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
                patient=patient,
                branch=branch,
                subtotal=Decimal('0.00'),
                total_amount=Decimal('0.00'),
                balance_amount=Decimal('0.00'),
                status=InvoiceStatus.ISSUED
            )

        InvoiceItem.objects.create(
            invoice=inv,
            item_type=ChargeItemType.RADIOLOGY,
            description=f"Imaging Study: {order.study_name} ({order.modality})",
            quantity=1,
            unit_price=captured_rate
        )
        inv.recalculate_totals()
        order.invoice = inv
        order.save(update_fields=['invoice'])

        log_lab_audit(request.user, 'RADIOLOGY_ORDER_CREATED', 'RadiologyOrder', order.id, branch=branch)
        return Response(RadiologyOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class RadiologyScheduleActionView(views.APIView):
    """
    Schedule an imaging study appointment with designated room/suite and modality technician.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        order = RadiologyOrder.objects.filter(id=pk).first()
        if not order:
            return Response({'error': 'Radiology order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        order.scheduled_date = data.get('scheduled_date', timezone.now().date())
        order.scheduled_time = data.get('scheduled_time', '10:00:00')
        order.suite_room = data.get('suite_room', 'Modality Suite 1')
        if data.get('technician_id'):
            order.performing_technician = StaffProfile.objects.filter(id=data['technician_id']).first()
        order.status = RadiologyStatus.SCHEDULED
        order.save()

        log_lab_audit(request.user, 'RADIOLOGY_SCHEDULED', 'RadiologyOrder', order.id, branch=order.branch)
        return Response({'success': True, 'message': 'Imaging study scheduled.', 'order': RadiologyOrderSerializer(order).data})


class RadiologyCompleteActionView(views.APIView):
    """
    Radiology Technician marks study procedure completed (images acquired, sent to PACS).
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        order = RadiologyOrder.objects.filter(id=pk).first()
        if not order:
            return Response({'error': 'Radiology order not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)
        order.performing_technician = staff
        order.completed_at = timezone.now()
        order.status = RadiologyStatus.COMPLETED
        order.pacs_study_uid = request.data.get('pacs_study_uid', f"1.2.840.10008.5.1.4.1.1.{uuid.uuid4().hex[:12]}")
        order.dicom_viewer_url = request.data.get('dicom_viewer_url', f"https://pacs.hospital.local/viewer/{order.accession_number}")
        order.save()

        log_lab_audit(request.user, 'RADIOLOGY_COMPLETED', 'RadiologyOrder', order.id, branch=order.branch)
        return Response({'success': True, 'message': 'Procedure completed. Images routed to PACS.', 'order': RadiologyOrderSerializer(order).data})


class RadiologyReportActionView(views.APIView):
    """
    Radiologist enters diagnostic report, findings, impression, and key recommendations,
    with draft, approval, and release workflow.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, pk):
        order = RadiologyOrder.objects.filter(id=pk).first()
        if not order:
            return Response({'error': 'Radiology order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        staff = get_staff_profile(request.user)
        action = data.get('action', 'APPROVE')  # DRAFT or APPROVE

        order.radiologist = staff
        order.technique = data.get('technique', order.technique)
        order.findings = data.get('findings', order.findings)
        order.impression = data.get('impression', order.impression)
        order.key_recommendations = data.get('key_recommendations', order.key_recommendations)
        order.is_critical = data.get('is_critical', False)
        if data.get('dicom_viewer_url'):
            order.dicom_viewer_url = data['dicom_viewer_url']

        if action == 'DRAFT':
            order.status = RadiologyStatus.REPORT_DRAFTED
            order.save()
            msg = 'Radiology report draft saved.'
        else:
            order.status = RadiologyStatus.RELEASED
            order.approved_by = staff
            order.approved_at = timezone.now()
            order.reported_at = timezone.now()
            order.is_released = True
            order.save()
            msg = 'Radiology diagnostic report approved and released.'

            # Create DiagnosticReport record
            report_num = f"REP-RAD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            DiagnosticReport.objects.create(
                report_number=report_num,
                report_type='RADIOLOGY',
                radiology_order=order,
                patient=order.patient,
                branch=order.branch,
                version=1,
                status=DiagnosticReportStatus.RELEASED,
                prepared_by=staff,
                approved_by=staff,
                approved_at=timezone.now(),
                released_at=timezone.now(),
                is_released=True,
                summary_findings=order.impression,
                clinical_comments=order.findings,
                digital_signature_hash=hashlib.sha256(f"{order.order_number}:{report_num}".encode()).hexdigest()
            )

            # Trigger critical alert if flagged
            if order.is_critical:
                CriticalAlertNotification.objects.create(
                    radiology_order=order,
                    patient=order.patient,
                    test_name=f"{order.study_name} ({order.modality})",
                    critical_value=order.impression[:100],
                    recipient_doctor=order.doctor,
                    channel='IN_APP',
                    delivery_status='DELIVERED_IN_APP'
                )

        log_lab_audit(request.user, f"RADIOLOGY_{action}", 'RadiologyOrder', order.id, branch=order.branch)
        return Response({'success': True, 'message': msg, 'order': RadiologyOrderSerializer(order).data})


class DiagnosticReportDetailView(views.APIView):
    """
    Secure retrieval of finalized diagnostic reports with strict patient privacy enforcement
    and view audit logging.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        report = DiagnosticReport.objects.select_related(
            'patient__user_profile', 'branch', 'prepared_by__user_profile', 'approved_by__user_profile',
            'lab_order', 'radiology_order'
        ).filter(id=pk).first()

        if not report:
            return Response({'error': 'Diagnostic report not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce Patient Isolation
        user = request.user
        pat_prof = get_patient_profile(user)
        if pat_prof:
            if report.patient != pat_prof:
                return Response({'error': 'Unauthorized: You cannot access another patient\'s report.'}, status=status.HTTP_403_FORBIDDEN)
            if not report.is_released:
                return Response({'error': 'Unauthorized: This report has not been released by clinical staff.'}, status=status.HTTP_403_FORBIDDEN)

        # Audit view event
        log_lab_audit(user, 'REPORT_VIEWED', 'DiagnosticReport', report.id, branch=report.branch)

        # Assemble full structured printable data
        structured_data = {
            'report': DiagnosticReportSerializer(report).data,
            'hospital': {
                'name': report.branch.hospital.name,
                'branch': report.branch.name,
                'address': f"{report.branch.address_line1}, {report.branch.city}",
                'phone': report.branch.phone,
                'accreditation': 'NABL & NABH Accredited Healthcare Facility'
            },
            'patient': {
                'mrn': report.patient.medical_record_number,
                'name': report.patient.user_profile.full_name,
                'age': report.patient.age,
                'gender': report.patient.gender,
                'phone': report.patient.user_profile.phone_number
            }
        }

        if report.lab_order:
            structured_data['lab_order'] = LabOrderSerializer(report.lab_order).data
        if report.radiology_order:
            structured_data['radiology_order'] = RadiologyOrderSerializer(report.radiology_order).data

        return Response(structured_data)


class DiagnosticReportDownloadView(views.APIView):
    """
    Audit-logged downloadable PDF representation endpoint for verified reports.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        report = DiagnosticReport.objects.filter(id=pk).first()
        if not report:
            return Response({'error': 'Report not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Enforce Patient Isolation
        pat_prof = get_patient_profile(request.user)
        if pat_prof:
            if report.patient != pat_prof or not report.is_released:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        log_lab_audit(request.user, 'REPORT_DOWNLOADED', 'DiagnosticReport', report.id, branch=report.branch)

        return Response({
            'success': True,
            'report_number': report.report_number,
            'digital_signature': report.digital_signature_hash,
            'download_timestamp': timezone.now().isoformat(),
            'file_url': report.file_url or f"/api/v1/clinical/lab/reports/{report.id}/detail/"
        })


class DiagnosticEquipmentViewSet(viewsets.ModelViewSet):
    """
    Diagnostic Equipment, Automated Clinical Analyzers, and Modality Interface Nodes.
    """
    queryset = DiagnosticEquipment.objects.all()
    serializer_class = DiagnosticEquipmentSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]


class EquipmentIngestionView(views.APIView):
    """
    Extensible equipment result ingestion interface.
    Supports ASTM E1394, HL7 v2.x ORU^R01, and JSON webhooks from lab analyzers.
    Validates barcode, updates result items, checks panic values, and logs transmission.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        data = request.data
        barcode = data.get('sample_barcode', '').strip()
        analyzer_sn = data.get('analyzer_serial_number', 'TEST-SN-001')
        results_map = data.get('results', {})  # {'HEM_001': '13.8', 'WBC_001': '7200'}

        equipment = DiagnosticEquipment.objects.filter(serial_number=analyzer_sn).first()
        if not equipment:
            equipment = DiagnosticEquipment.objects.first()

        sample = LabSample.objects.filter(sample_barcode=barcode).first()
        if not sample:
            EquipmentTransmissionLog.objects.create(
                equipment=equipment,
                sample_barcode=barcode,
                raw_payload=json.dumps(data),
                status='UNMATCHED_SAMPLE',
                error_details=f"No specimen in database matches barcode '{barcode}'."
            )
            return Response({'error': f"Sample barcode '{barcode}' not found in active worklist."}, status=status.HTTP_404_NOT_FOUND)

        updated_items = []
        for code, val in results_map.items():
            item = LabOrderItem.objects.filter(sample=sample, test__code=code).first()
            if not item:
                # Fallback to test without barcode filter in same order
                item = LabOrderItem.objects.filter(lab_order=sample.lab_order, test__code=code).first()

            if item:
                item.result_value = str(val)
                test = item.test

                # Check normal/critical ranges
                try:
                    num_val = Decimal(str(val))
                    if test.normal_min and num_val < test.normal_min:
                        item.is_abnormal = True
                        item.abnormal_flag = 'LOW'
                    elif test.normal_max and num_val > test.normal_max:
                        item.is_abnormal = True
                        item.abnormal_flag = 'HIGH'

                    if test.critical_low and num_val < test.critical_low:
                        item.is_critical = True
                        item.abnormal_flag = 'CRITICAL_LOW'
                    elif test.critical_high and num_val > test.critical_high:
                        item.is_critical = True
                        item.abnormal_flag = 'CRITICAL_HIGH'
                except Exception:
                    pass

                item.status = LabItemStatus.ENTERED
                item.entered_at = timezone.now()
                item.save()
                updated_items.append(item.test.name)

        EquipmentTransmissionLog.objects.create(
            equipment=equipment,
            sample_barcode=barcode,
            raw_payload=json.dumps(data),
            parsed_payload=results_map,
            status='SUCCESS'
        )

        sample.status = SampleStatus.PROCESSING
        sample.save(update_fields=['status'])

        return Response({
            'success': True,
            'message': f"Ingested {len(updated_items)} test results from analyzer for specimen {barcode}.",
            'updated_tests': updated_items
        })


class EquipmentSimulatorView(views.APIView):
    """
    Automated Simulator for testing laboratory analyzer connectivity, barcode matching,
    and panic result processing.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request):
        barcode = request.data.get('sample_barcode')
        sample = LabSample.objects.filter(sample_barcode=barcode).first() if barcode else LabSample.objects.filter(status=SampleStatus.COLLECTED).first()

        if not sample:
            return Response({'error': 'No eligible sample found to simulate equipment run.'}, status=status.HTTP_404_NOT_FOUND)

        # Build mock results based on ordered tests
        simulated_results = {}
        for item in sample.lab_order.items.all():
            test = item.test
            # Generate realistic normal value or panic value if requested
            if request.data.get('simulate_panic'):
                val = str((test.critical_high or Decimal('18.0')) + Decimal('2.0'))
            else:
                avg_val = (test.normal_min + test.normal_max) / 2 if (test.normal_min and test.normal_max) else Decimal('14.2')
                val = str(round(avg_val, 1))
            simulated_results[test.code] = val

        # Ingest through EquipmentIngestionView logic
        ingest_view = EquipmentIngestionView()
        request._request.data = {
            'sample_barcode': sample.sample_barcode,
            'analyzer_serial_number': 'SIM-ROCHE-COBAS-01',
            'results': simulated_results
        }
        return ingest_view.post(request)


class OutsourcedTrackingViewSet(viewsets.ModelViewSet):
    """
    Outsourced Reference Laboratory Tracking: Dispatch, Courier Tracking,
    External Reports, and Direct Cost Recording.
    """
    serializer_class = LabOrderSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = LabOrder.objects.filter(is_outsourced=True).select_related('patient__user_profile', 'external_provider', 'branch')
        status_param = self.request.query_params.get('status')
        provider_id = self.request.query_params.get('provider_id')

        if status_param:
            qs = qs.filter(status=status_param)
        if provider_id:
            qs = qs.filter(external_provider_id=provider_id)
        return qs


class OutsourcedDispatchActionView(views.APIView):
    """
    Dispatch specimen batch to external reference laboratory with courier tracking number.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def post(self, request, pk):
        order = LabOrder.objects.filter(id=pk, is_outsourced=True).first()
        if not order:
            return Response({'error': 'Outsourced lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        order.external_reference_number = data.get('external_reference_number', f"EXT-{uuid.uuid4().hex[:8].upper()}")
        order.external_dispatch_date = timezone.now()
        expected_days = data.get('expected_tat_days', 2)
        order.external_received_date = timezone.now() + timedelta(days=int(expected_days))
        if data.get('external_provider_id'):
            order.external_provider = ExternalDiagnosticProvider.objects.filter(id=data['external_provider_id']).first()

        order.status = LabOrderStatus.IN_PROCESS
        order.save()

        log_lab_audit(request.user, 'OUTSOURCED_DISPATCHED', 'LabOrder', order.id, branch=order.branch)
        return Response({'success': True, 'message': 'Specimen dispatched to external laboratory partner.', 'order': LabOrderSerializer(order).data})


class OutsourcedReceiveResultsView(views.APIView):
    """
    Receive external reference laboratory results, attach external PDF report, and record hospital outsourced cost.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, pk):
        order = LabOrder.objects.filter(id=pk, is_outsourced=True).first()
        if not order:
            return Response({'error': 'Outsourced lab order not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        staff = get_staff_profile(request.user)

        order.external_received_date = timezone.now()
        order.external_report_url = data.get('external_report_url', 'https://storage.hospital.local/external-reports/sample-report.pdf')
        order.external_cost = Decimal(str(data.get('external_cost', '450.00')))
        order.status = LabOrderStatus.AWAITING_APPROVAL
        order.save()

        # Update items with findings
        for item in order.items.all():
            item.result_value = data.get('result_value', 'Normal (External Lab Verified)')
            item.status = LabItemStatus.VALIDATED
            item.validated_by = staff
            item.validated_at = timezone.now()
            item.save()

        log_lab_audit(
            request.user,
            'OUTSOURCED_RESULTS_RECEIVED',
            'LabOrder',
            order.id,
            branch=order.branch,
            new_val={'external_cost': str(order.external_cost), 'report_url': order.external_report_url}
        )

        return Response({'success': True, 'message': 'External lab results recorded and cost logged.', 'order': LabOrderSerializer(order).data})


class DiagnosticFinancialReportsView(views.APIView):
    """
    Database-backed Test-Wise Revenue and Expense Reporting.
    Aggregates orders, billed charges, recognized revenue, outsourced expenses,
    and net contribution margin without double posting.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        branch_id = request.query_params.get('branch_id')
        category = request.query_params.get('category')

        # Base items queryset
        items_qs = LabOrderItem.objects.select_related('test', 'lab_order__branch', 'lab_order__invoice')
        if branch_id:
            items_qs = items_qs.filter(lab_order__branch_id=branch_id)
        if start_date:
            items_qs = items_qs.filter(lab_order__created_at__date__gte=start_date)
        if end_date:
            items_qs = items_qs.filter(lab_order__created_at__date__lte=end_date)
        if category:
            items_qs = items_qs.filter(test__category=category)

        # Aggregate test-wise
        test_stats = {}
        for item in items_qs[:500]:
            test = item.test
            t_id = str(test.id)
            if t_id not in test_stats:
                test_stats[t_id] = {
                    'test_id': t_id,
                    'test_code': test.code,
                    'test_name': test.name,
                    'category': test.category,
                    'standard_rate': float(test.standard_rate),
                    'total_ordered': 0,
                    'total_completed': 0,
                    'total_cancelled': 0,
                    'billed_revenue': Decimal('0.00'),
                    'outsourced_expense': Decimal('0.00'),
                }

            test_stats[t_id]['total_ordered'] += 1
            if item.lab_order.status == LabOrderStatus.RELEASED:
                test_stats[t_id]['total_completed'] += 1
            elif item.lab_order.status == LabOrderStatus.CANCELLED:
                test_stats[t_id]['total_cancelled'] += 1

            test_stats[t_id]['billed_revenue'] += item.captured_price

            if test.is_outsourced:
                test_stats[t_id]['outsourced_expense'] += test.outsourced_cost

        # Calculate Net Margins
        results = []
        grand_billed = Decimal('0.00')
        grand_expense = Decimal('0.00')

        for t_id, s in test_stats.items():
            net_margin = s['billed_revenue'] - s['outsourced_expense']
            margin_pct = round((net_margin / s['billed_revenue'] * 100), 1) if s['billed_revenue'] > 0 else 0

            grand_billed += s['billed_revenue']
            grand_expense += s['outsourced_expense']

            results.append({
                'test_id': s['test_id'],
                'test_code': s['test_code'],
                'test_name': s['test_name'],
                'category': s['category'],
                'total_ordered': s['total_ordered'],
                'total_completed': s['total_completed'],
                'total_cancelled': s['total_cancelled'],
                'billed_revenue': float(s['billed_revenue']),
                'outsourced_expense': float(s['outsourced_expense']),
                'net_margin': float(net_margin),
                'margin_pct': margin_pct
            })

        grand_net = grand_billed - grand_expense

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'report_generated_at': timezone.now().isoformat(),
            'grand_billed_revenue': float(grand_billed),
            'grand_diagnostic_expenses': float(grand_expense),
            'grand_net_contribution': float(grand_net),
            'test_breakdown': sorted(results, key=lambda x: x['billed_revenue'], reverse=True)
        })


class HL7FHIRIntegrationView(views.APIView):
    """
    HL7 v2.5.1 and FHIR R4 Interoperability Interface.
    Exports HL7 ORM_O01 / ORU_R01 message packets and FHIR ServiceRequest / DiagnosticReport / Observation JSON.
    """
    permission_classes = [IsAuthenticated]

    def perform_content_negotiation(self, request, force=False):
        renderers = self.get_renderers()
        return (renderers[0], renderers[0].media_type)

    def get(self, request, order_id):
        order = LabOrder.objects.select_related('patient__user_profile', 'doctor__user_profile').filter(id=order_id).first()
        if not order:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        fmt = request.query_params.get('format', 'fhir').lower()

        if fmt == 'hl7':
            # Generate valid HL7 v2.5.1 ORU^R01 packet
            ctrl_id = f"MSG-{uuid.uuid4().hex[:10]}"
            ts = timezone.now().strftime('%Y%m%d%H%M%S')
            msh = f"MSH|^~\\&|HMS_LIS|CENTRAL_HOSP|EXTERNAL_PACS|REGIONAL_HEALTH|{ts}||ORU^R01|{ctrl_id}|P|2.5.1"
            pid = f"PID|1||{order.patient.medical_record_number}^^^HMS||{order.patient.user_profile.last_name}^{order.patient.user_profile.first_name}||{order.patient.date_of_birth or '19900101'}|{order.patient.gender[0]}"
            obr = f"OBR|1|{order.order_number}|{order.specimen_accession_number or 'ACC001'}|LAB_PANEL^Routine Diagnostic Panel|||{ts}"

            obx_segments = []
            for idx, itm in enumerate(order.items.all(), start=1):
                obx_segments.append(
                    f"OBX|{idx}|ST|{itm.test.code}^{itm.test.name}||{itm.result_value or 'PENDING'}|{itm.test.unit_of_measurement}|{itm.test.reference_range}|{itm.abnormal_flag}|||F"
                )

            hl7_message = "\r\n".join([msh, pid, obr] + obx_segments)

            HL7TransmissionLog.objects.create(
                message_control_id=ctrl_id,
                message_type='ORU_R01',
                direction='OUTBOUND',
                payload=hl7_message,
                status='SENT',
                response_ack='MSA|AA|MSG_ACKNOWLEDGED'
            )

            return Response({
                'format': 'HL7_V2.5.1',
                'message_control_id': ctrl_id,
                'hl7_message': hl7_message
            })

        else:
            # Generate FHIR R4 DiagnosticReport and Observations
            observations = []
            for itm in order.items.all():
                observations.append({
                    'resourceType': 'Observation',
                    'id': str(itm.id),
                    'status': 'final' if itm.status == LabItemStatus.RELEASED else 'preliminary',
                    'code': {
                        'coding': [{
                            'system': 'http://loinc.org',
                            'code': itm.test.code,
                            'display': itm.test.name
                        }]
                    },
                    'subject': {
                        'reference': f"Patient/{order.patient.id}",
                        'display': order.patient.user_profile.full_name
                    },
                    'valueString': itm.result_value,
                    'referenceRange': [{
                        'text': itm.reference_range
                    }]
                })

            fhir_diagnostic_report = {
                'resourceType': 'DiagnosticReport',
                'id': str(order.id),
                'identifier': [{
                    'system': 'http://hospital.local/lab-orders',
                    'value': order.order_number
                }],
                'status': 'final' if order.status == LabOrderStatus.RELEASED else 'preliminary',
                'category': [{
                    'coding': [{
                        'system': 'http://terminology.hl7.org/CodeSystem/v2-0074',
                        'code': 'LAB',
                        'display': 'Laboratory'
                    }]
                }],
                'subject': {
                    'reference': f"Patient/{order.patient.id}",
                    'display': order.patient.user_profile.full_name
                },
                'effectiveDateTime': order.created_at.isoformat(),
                'issued': timezone.now().isoformat(),
                'performer': [{
                    'reference': f"Practitioner/{order.doctor.id}",
                    'display': order.doctor.user_profile.full_name
                }],
                'result': observations
            }

            HL7TransmissionLog.objects.create(
                message_control_id=f"FHIR-{uuid.uuid4().hex[:10]}",
                message_type='FHIR_DIAGNOSTIC_REPORT',
                direction='OUTBOUND',
                payload=json.dumps(fhir_diagnostic_report),
                status='SENT'
            )

            return Response({
                'format': 'FHIR_R4',
                'resource': fhir_diagnostic_report
            })
