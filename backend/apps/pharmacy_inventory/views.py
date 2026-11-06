import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember, IsPharmacyStaff, IsReadOnlyOrAdmin, resolve_user_profile
from apps.core.activity_log_service import ActivityLogService
from apps.core.models import Branch
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType
from apps.authentication.models import PatientProfile, StaffProfile, RoleEnum
from apps.authentication.utils import get_staff_profile, get_patient_profile
from .models import (
    Medicine, MedicineBatch, Prescription, PrescriptionItem,
    DispenseRecord, DispenseItem, Supplier, PurchaseOrder,
    PurchaseOrderItem, PurchaseOrderStatus, StockMovement,
    MovementType, HospitalAsset, AssetMaintenanceLog
)
from .serializers import (
    MedicineSerializer, PrescriptionSerializer,
    DispenseRecordSerializer, SupplierSerializer,
    PurchaseOrderSerializer, StockMovementSerializer,
    HospitalAssetSerializer
)


class MedicineViewSet(viewsets.ModelViewSet):
    """
    Hospital Drug Formulary & Batch Inventory.
    """
    serializer_class = MedicineSerializer
    permission_classes = [IsAuthenticated, IsReadOnlyOrAdmin]
    rbac_module = 'PHARMACY'

    def get_queryset(self):
        qs = Medicine.objects.prefetch_related('batches')
        category = self.request.query_params.get('category')
        search = self.request.query_params.get('search')
        if category:
            qs = qs.filter(category=category)
        if search:
            qs = qs.filter(brand_name__icontains=search) | qs.filter(generic_name__icontains=search)
        return qs


class PrescriptionViewSet(viewsets.ModelViewSet):
    """
    Prescriptions issued by doctors, viewable by patients and pharmacists.
    Strictly enforces that ONLY Doctors / Medical Directors / Dept Heads can create prescriptions.
    Nurses, Pharmacists, Receptionists, and Branch Managers are strictly prohibited from creating prescriptions.
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated, IsReadOnlyOrAdmin]
    rbac_module = 'PHARMACY'

    def get_queryset(self):
        user = self.request.user
        qs = Prescription.objects.prefetch_related('items__medicine').select_related(
            'patient__user_profile', 'doctor__user_profile', 'branch'
        )
        patient = get_patient_profile(user)
        if patient:
            return qs.filter(patient=patient)
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            prof = resolve_user_profile(request)
            allowed_prescribers = [RoleEnum.DOCTOR, RoleEnum.MEDICAL_DIRECTOR, RoleEnum.DEPARTMENT_HEAD, RoleEnum.SUPER_ADMIN]
            if not prof or not prof.role or prof.role.name not in allowed_prescribers:
                ActivityLogService.record(
                    action='PRESCRIPTION_CREATE_DENIED',
                    entity_type='Prescription',
                    module='PHARMACY',
                    request=request,
                    user_profile=prof,
                    status='DENIED',
                    description=f"Unauthorized attempt to create prescription by role '{prof.role.name if (prof and prof.role) else 'UNKNOWN'}'. Only authorized doctors can create prescriptions.",
                )
                return Response(
                    {'error': 'Prescription authority required. Only licensed Doctors can issue medical prescriptions.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        data = request.data
        doctor = StaffProfile.objects.filter(id=data.get('doctor_id')).first() if data.get('doctor_id') else get_staff_profile(request.user)
        if not doctor:
            doctor = StaffProfile.objects.first()

        patient = PatientProfile.objects.filter(id=data['patient_id']).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        rx_num = f"RX-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        prescription = Prescription.objects.create(
            prescription_number=rx_num,
            patient=patient,
            doctor=doctor,
            branch=doctor.branch,
            diagnosis=data.get('diagnosis', 'Clinical Evaluation'),
            clinical_notes=data.get('clinical_notes', '')
        )

        for item in data.get('items', []):
            med = Medicine.objects.filter(id=item['medicine_id']).first()
            if med:
                PrescriptionItem.objects.create(
                    prescription=prescription,
                    medicine=med,
                    dosage=item.get('dosage', '1 Tablet'),
                    frequency=item.get('frequency', '1-0-1'),
                    duration_days=item.get('duration_days', 5),
                    total_quantity=item.get('total_quantity', 10),
                    instructions=item.get('instructions', '')
                )

        ActivityLogService.record(
            action='PRESCRIPTION_ISSUED',
            entity_type='Prescription',
            entity_id=str(prescription.id),
            module='PHARMACY',
            request=request,
            branch=prescription.branch,
            new_values={'prescription_number': rx_num, 'patient_mrn': patient.medical_record_number},
            description=f"Dr. {doctor.user_profile.full_name} issued prescription {rx_num} for {patient.user_profile.full_name}.",
        )
        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)


class DispenseMedicationView(views.APIView):
    """
    Dispense medications against prescriptions with atomic stock deduction and movement audit.
    Strictly restricted to PHARMACIST (and SUPER_ADMIN). Doctors, Nurses, and Branch Managers cannot dispense medicines.
    """
    permission_classes = [IsAuthenticated, IsStaffMember, IsPharmacyStaff, IsReadOnlyOrAdmin]
    rbac_module = 'PHARMACY'

    @transaction.atomic
    def post(self, request):
        if not request.user.is_superuser:
            prof = resolve_user_profile(request)
            if not prof or not prof.role or prof.role.name not in [RoleEnum.PHARMACIST, RoleEnum.SUPER_ADMIN]:
                ActivityLogService.record(
                    action='MEDICINE_DISPENSE_DENIED',
                    entity_type='DispenseRecord',
                    module='PHARMACY',
                    request=request,
                    user_profile=prof,
                    status='DENIED',
                    description="Unauthorized attempt to dispense medication. Only Pharmacists are authorized to dispense medicines.",
                )
                return Response(
                    {'error': 'Only licensed Pharmacists are authorized to dispense medications.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        data = request.data
        patient_id = data.get('patient_id')
        prescription_id = data.get('prescription_id')
        items = data.get('items', [])  # list of {batch_id, quantity}

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        pharmacist = get_staff_profile(request.user)

        disp_number = f"DISP-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        dispense_record = DispenseRecord.objects.create(
            dispense_number=disp_number,
            prescription_id=prescription_id or None,
            patient=patient,
            pharmacist=pharmacist,
            branch=pharmacist.branch,
            total_amount=Decimal('0.00')
        )

        total_amount = Decimal('0.00')

        for itm in items:
            batch = MedicineBatch.objects.select_for_update().filter(id=itm['batch_id']).first()
            if not batch:
                return Response({'error': f"Batch not found: {itm['batch_id']}"}, status=status.HTTP_404_NOT_FOUND)

            qty = int(itm['quantity'])
            if batch.quantity_in_stock < qty:
                return Response({
                    'error': f"Insufficient stock for {batch.medicine.brand_name} (Batch: {batch.batch_number}). Available: {batch.quantity_in_stock}, Requested: {qty}"
                }, status=status.HTTP_409_CONFLICT)

            # Deduct stock
            prev_stock = batch.quantity_in_stock
            batch.quantity_in_stock -= qty
            batch.save()

            subtotal = batch.unit_selling_price * Decimal(str(qty))
            total_amount += subtotal

            DispenseItem.objects.create(
                dispense_record=dispense_record,
                batch=batch,
                quantity=qty,
                unit_price=batch.unit_selling_price,
                subtotal=subtotal
            )

            # Record audited stock movement
            StockMovement.objects.create(
                branch=batch.branch,
                item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                batch_reference=batch.batch_number,
                movement_type=MovementType.DISPENSE,
                quantity_delta=-qty,
                previous_stock=prev_stock,
                new_stock=batch.quantity_in_stock,
                recorded_by=pharmacist,
                remarks=f"Dispensed in receipt {disp_number} to {patient.user_profile.full_name}"
            )

        dispense_record.total_amount = total_amount
        dispense_record.save()

        # Financial Integration: Attach pharmacy charges to active patient invoice without double billing
        target_invoice = None
        prescription = None
        if prescription_id:
            prescription = Prescription.objects.select_related('appointment__invoice', 'admission__invoice').filter(id=prescription_id).first()
            if prescription:
                if prescription.admission and prescription.admission.invoice:
                    target_invoice = prescription.admission.invoice
                    dispense_record.is_ipd_issue = True
                elif prescription.appointment and prescription.appointment.invoice:
                    target_invoice = prescription.appointment.invoice

        if not target_invoice:
            # Check for active running inpatient admission invoice
            from apps.clinical.models import InpatientAdmission, AdmissionStatus
            active_adm = InpatientAdmission.objects.filter(patient=patient, status=AdmissionStatus.ADMITTED).first()
            if active_adm and active_adm.invoice:
                target_invoice = active_adm.invoice
                dispense_record.is_ipd_issue = True
                if active_adm.bed and active_adm.bed.ward:
                    dispense_record.ward_location = f"{active_adm.bed.ward.name} - Bed {active_adm.bed.bed_number}"

        if not target_invoice:
            target_invoice = Invoice.objects.filter(
                patient=patient,
                branch=dispense_record.branch,
                status__in=[InvoiceStatus.ISSUED, InvoiceStatus.DRAFT]
            ).first()

        if not target_invoice:
            inv_number = f"INV-PHARM-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            target_invoice = Invoice.objects.create(
                invoice_number=inv_number,
                patient=patient,
                branch=dispense_record.branch,
                encounter_type='PHARMACY',
                subtotal=Decimal('0.00'),
                total_amount=Decimal('0.00'),
                balance_amount=Decimal('0.00'),
                status=InvoiceStatus.ISSUED,
                notes=f"Pharmacy Dispense #{disp_number}"
            )

        # Create InvoiceItems for dispensed batches
        for itm in dispense_record.items.all():
            InvoiceItem.objects.create(
                invoice=target_invoice,
                item_type=ChargeItemType.PHARMACY,
                description=f"Medication: {itm.batch.medicine.brand_name} ({itm.batch.medicine.generic_name}) - Batch {itm.batch.batch_number}",
                source_reference=f"DISPENSE:{dispense_record.id}",
                quantity=itm.quantity,
                unit_price=itm.unit_price
            )
            if prescription:
                PrescriptionItem.objects.filter(
                    prescription=prescription,
                    medicine=itm.batch.medicine
                ).update(dispensed_quantity=itm.quantity)

        target_invoice.recalculate_totals()
        dispense_record.invoice = target_invoice
        dispense_record.save(update_fields=['invoice', 'is_ipd_issue', 'ward_location'])

        if prescription:
            prescription.is_dispensed = True
            prescription.save(update_fields=['is_dispensed'])

        ActivityLogService.record(
            action='MEDICINE_DISPENSED',
            entity_type='DispenseRecord',
            entity_id=str(dispense_record.id),
            module='PHARMACY',
            request=request,
            branch=dispense_record.branch,
            new_values={'dispense_number': disp_number, 'total_amount': str(total_amount)},
            description=f"Pharmacist dispensed medicines ({disp_number}) to {patient.user_profile.full_name}.",
        )
        return Response(DispenseRecordSerializer(dispense_record).data, status=status.HTTP_201_CREATED)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, IsPharmacyStaff, IsReadOnlyOrAdmin]
    rbac_module = 'INVENTORY'
    queryset = Supplier.objects.all()


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    Procurement Purchase Orders.
    """
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsStaffMember, IsPharmacyStaff, IsReadOnlyOrAdmin]
    rbac_module = 'INVENTORY'

    def get_queryset(self):
        qs = PurchaseOrder.objects.prefetch_related('items').select_related('supplier', 'ordered_by__user_profile')
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        supplier = Supplier.objects.filter(id=data['supplier_id']).first()
        if not supplier:
            return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)

        po_number = f"PO-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        po = PurchaseOrder.objects.create(
            po_number=po_number,
            branch=staff.branch,
            supplier=supplier,
            ordered_by=staff,
            expected_delivery_date=data.get('expected_delivery_date') or None,
            notes=data.get('notes', ''),
            status=PurchaseOrderStatus.SUBMITTED
        )

        total = Decimal('0.00')
        for item in data.get('items', []):
            qty = int(item['quantity'])
            cost = Decimal(str(item['unit_cost']))
            subtotal = cost * Decimal(str(qty))
            total += subtotal
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                item_name=item['item_name'],
                quantity=qty,
                unit_cost=cost,
                subtotal=subtotal
            )

        po.total_amount = total
        po.save()

        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)


class ReceiveGoodsView(views.APIView):
    """
    Receive goods against PO, update status, and replenish inventory.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request, pk):
        po = PurchaseOrder.objects.filter(id=pk).first()
        if not po:
            return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if po.status == PurchaseOrderStatus.RECEIVED:
            return Response({'error': 'Goods have already been received for this PO.'}, status=status.HTTP_400_BAD_REQUEST)

        po.status = PurchaseOrderStatus.RECEIVED
        po.save()

        staff = get_staff_profile(request.user)

        # Replenish stock movement for items
        for item in po.items.all():
            StockMovement.objects.create(
                branch=po.branch,
                item_name=item.item_name,
                batch_reference=f"PO-{po.po_number[-4:]}",
                movement_type=MovementType.PURCHASE_RECEIPT,
                quantity_delta=item.quantity,
                previous_stock=0,
                new_stock=item.quantity,
                recorded_by=staff,
                remarks=f"Goods received from {po.supplier.name} under {po.po_number}"
            )

        return Response({'success': True, 'message': f'Goods received and stocked for {po.po_number}'})


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = StockMovement.objects.select_related('recorded_by__user_profile')
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs


class HospitalAssetViewSet(viewsets.ModelViewSet):
    serializer_class = HospitalAssetSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = HospitalAsset.objects.prefetch_related('maintenance_logs').select_related('branch', 'department')
        branch_id = self.request.query_params.get('branch_id')
        category = self.request.query_params.get('category')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if category:
            qs = qs.filter(category=category)
        return qs
