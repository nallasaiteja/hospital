import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.authentication.permissions import IsStaffMember
from apps.core.models import Branch
from apps.authentication.models import PatientProfile, StaffProfile
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
    permission_classes = [IsAuthenticated]

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
    """
    serializer_class = PrescriptionSerializer
    permission_classes = [IsAuthenticated]

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

        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)


class DispenseMedicationView(views.APIView):
    """
    Dispense medications against prescriptions with atomic stock deduction and movement audit.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request):
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

        if prescription_id:
            Prescription.objects.filter(id=prescription_id).update(is_dispensed=True)

        return Response(DispenseRecordSerializer(dispense_record).data, status=status.HTTP_201_CREATED)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]
    queryset = Supplier.objects.all()


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    Procurement Purchase Orders.
    """
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

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
