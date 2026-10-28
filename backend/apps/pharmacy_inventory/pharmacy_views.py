import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, F, Q
from rest_framework import status, views, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.authentication.permissions import IsStaffMember
from apps.core.models import Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile
from apps.authentication.utils import get_staff_profile
from apps.billing_finance.models import Invoice, InvoiceItem, InvoiceStatus, ChargeItemType

from .models import (
    Medicine, MedicineCategory, ItemType, MedicineBatch, BatchStatus,
    Prescription, PrescriptionItem, DispenseRecord, DispenseItem,
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    GoodsReceiptNote, GoodsReceiptItem,
    SupplierInvoice, InvoicePaymentStatus,
    PurchaseRequisition, PurchaseRequisitionItem, RequisitionStatus,
    StockTransfer, StockTransferItem, TransferStatus,
    StockAdjustment, StockAdjustmentItem, AdjustmentType,
    PharmacyReturn, PharmacyReturnItem, ReturnType,
    StockReconciliation, StockReconciliationItem, ReconciliationStatus,
    StockMovement, MovementType, HospitalAsset
)
from .serializers import (
    MedicineSerializer, MedicineBatchSerializer, PrescriptionSerializer,
    DispenseRecordSerializer, SupplierSerializer, PurchaseOrderSerializer,
    GoodsReceiptNoteSerializer, SupplierInvoiceSerializer,
    PurchaseRequisitionSerializer, StockTransferSerializer,
    StockAdjustmentSerializer, PharmacyReturnSerializer,
    StockReconciliationSerializer, StockMovementSerializer,
    HospitalAssetSerializer
)


class PharmacyDashboardStatsView(views.APIView):
    """
    Real-time dashboard metrics for Pharmacy and Inventory Management.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        thirty_days = today + timezone.timedelta(days=30)
        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        branch_id = params.get('branch_id')

        med_qs = Medicine.objects.filter(is_active=True)
        batch_qs = MedicineBatch.objects.all()
        disp_qs = DispenseRecord.objects.all()
        rx_qs = Prescription.objects.all()
        po_qs = PurchaseOrder.objects.all()
        req_qs = PurchaseRequisition.objects.all()

        if branch_id:
            batch_qs = batch_qs.filter(branch_id=branch_id)
            disp_qs = disp_qs.filter(branch_id=branch_id)
            rx_qs = rx_qs.filter(branch_id=branch_id)
            po_qs = po_qs.filter(branch_id=branch_id)
            req_qs = req_qs.filter(branch_id=branch_id)

        # Automatically mark expired batches if past date
        MedicineBatch.objects.filter(expiry_date__lte=today, status=BatchStatus.AVAILABLE).update(status=BatchStatus.EXPIRED)

        total_catalogue = med_qs.count()
        medicines_count = med_qs.filter(item_type=ItemType.MEDICINE).count()
        consumables_count = med_qs.filter(item_type=ItemType.CONSUMABLE).count()

        low_stock_count = 0
        for m in med_qs:
            usable = batch_qs.filter(
                medicine=m,
                status=BatchStatus.AVAILABLE,
                expiry_date__gt=today
            ).aggregate(total=Sum('quantity_in_stock'))['total'] or 0
            if m.min_stock_level > 0 and usable <= m.min_stock_level:
                low_stock_count += 1

        expiring_batches = batch_qs.filter(
            expiry_date__gt=today,
            expiry_date__lte=thirty_days,
            status=BatchStatus.AVAILABLE,
            quantity_in_stock__gt=0
        ).count()

        expired_batches = batch_qs.filter(
            Q(expiry_date__lte=today) | Q(status=BatchStatus.EXPIRED),
            quantity_in_stock__gt=0
        ).count()

        pending_prescriptions = rx_qs.filter(is_dispensed=False).count()
        pending_requisitions = req_qs.filter(status__in=[RequisitionStatus.SUBMITTED, RequisitionStatus.DRAFT]).count()
        pending_pos = po_qs.filter(status__in=[PurchaseOrderStatus.SUBMITTED, PurchaseOrderStatus.DRAFT]).count()

        today_dispenses = disp_qs.filter(dispensed_at__date=today)
        today_dispense_count = today_dispenses.count()
        today_revenue = today_dispenses.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        total_valuation = batch_qs.filter(
            status=BatchStatus.AVAILABLE,
            expiry_date__gt=today
        ).aggregate(
            val=Sum(F('quantity_in_stock') * F('unit_purchase_cost'))
        )['val'] or Decimal('0.00')

        return Response({
            'total_catalogue_items': total_catalogue,
            'medicines_count': medicines_count,
            'consumables_count': consumables_count,
            'low_stock_items_count': low_stock_count,
            'expiring_soon_batches_count': expiring_batches,
            'expired_batches_count': expired_batches,
            'pending_prescriptions_count': pending_prescriptions,
            'pending_requisitions_count': pending_requisitions,
            'pending_purchase_orders_count': pending_pos,
            'today_dispense_count': today_dispense_count,
            'today_revenue': today_revenue,
            'total_inventory_valuation': total_valuation,
        })


class MedicineBatchViewSet(viewsets.ModelViewSet):
    """
    Medicine Batch inventory with FEFO ordering and status management.
    """
    serializer_class = MedicineBatchSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        today = timezone.now().date()
        MedicineBatch.objects.filter(expiry_date__lte=today, status=BatchStatus.AVAILABLE).update(status=BatchStatus.EXPIRED)

        qs = MedicineBatch.objects.select_related('medicine', 'branch', 'supplier').order_by('expiry_date')
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        medicine_id = params.get('medicine_id')
        branch_id = params.get('branch_id')
        status_filter = params.get('status')
        search = params.get('search')

        if medicine_id:
            qs = qs.filter(medicine_id=medicine_id)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(batch_number__icontains=search) |
                Q(batch_barcode__icontains=search) |
                Q(medicine__brand_name__icontains=search) |
                Q(medicine__generic_name__icontains=search)
            )
        return qs


class PurchaseRequisitionViewSet(viewsets.ModelViewSet):
    """
    Internal ward/department purchase requisitions with approval lifecycle.
    """
    serializer_class = PurchaseRequisitionSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = PurchaseRequisition.objects.prefetch_related('items__medicine').select_related(
            'requesting_department', 'branch', 'requested_by__user_profile', 'approved_by__user_profile'
        )
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        status_param = params.get('status')
        branch_id = params.get('branch_id')
        if status_param:
            qs = qs.filter(status=status_param)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()
        dept_id = data.get('department_id') or (staff.department_id if staff else None)
        department = Department.objects.filter(id=dept_id).first() if dept_id else None

        req_num = f"REQ-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        requisition = PurchaseRequisition.objects.create(
            requisition_number=req_num,
            branch=branch,
            requesting_department=department,
            requesting_location=data.get('location_type', data.get('requesting_location', 'Central Pharmacy')),
            requested_by=staff,
            reason=data.get('reason', 'Stock replenishment'),
            status=RequisitionStatus.SUBMITTED
        )

        for itm in data.get('items', []):
            med = Medicine.objects.filter(id=itm['medicine_id']).first()
            if med:
                qty = int(itm['requested_quantity'])
                cost = med.purchase_cost * Decimal(str(qty))
                PurchaseRequisitionItem.objects.create(
                    requisition=requisition,
                    medicine=med,
                    quantity_requested=qty,
                    quantity_approved=qty,
                    estimated_cost=cost
                )

        return Response(PurchaseRequisitionSerializer(requisition).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status not in [RequisitionStatus.SUBMITTED, RequisitionStatus.DRAFT]:
            return Response({'error': f"Cannot approve requisition in status {req.status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        req.approved_by = staff
        req.approved_at = timezone.now()
        req.status = RequisitionStatus.APPROVED
        req.save()
        return Response(PurchaseRequisitionSerializer(req).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status not in [RequisitionStatus.SUBMITTED, RequisitionStatus.DRAFT]:
            return Response({'error': f"Cannot reject requisition in status {req.status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        req.approved_by = staff
        req.status = RequisitionStatus.REJECTED
        req.rejection_reason = request.data.get('reason', 'Rejected during administrative review')
        req.save()
        return Response(PurchaseRequisitionSerializer(req).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def convert_to_po(self, request, pk=None):
        req = self.get_object()
        if req.status != RequisitionStatus.APPROVED:
            return Response({'error': 'Only approved requisitions can be converted to Purchase Orders.'}, status=status.HTTP_400_BAD_REQUEST)

        supplier_id = request.data.get('supplier_id')
        supplier = Supplier.objects.filter(id=supplier_id).first()
        if not supplier:
            return Response({'error': 'Valid supplier is required to generate Purchase Order.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        po_num = f"PO-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        po = PurchaseOrder.objects.create(
            po_number=po_num,
            requisition=req,
            branch=req.branch,
            supplier=supplier,
            ordered_by=staff,
            order_date=timezone.localdate(),
            status=PurchaseOrderStatus.SUBMITTED,
            expected_delivery_date=request.data.get('expected_delivery_date') or None,
            notes=f"Generated from Requisition {req.requisition_number}. {request.data.get('notes', '')}"
        )

        total = Decimal('0.00')
        for item in req.items.all():
            qty = item.quantity_approved or item.quantity_requested
            unit_cost = item.medicine.purchase_cost
            subtotal = unit_cost * Decimal(str(qty))
            total += subtotal
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                medicine=item.medicine,
                item_name=item.medicine.brand_name,
                quantity=qty,
                quantity_received=0,
                unit_cost=unit_cost,
                subtotal=subtotal
            )

        po.subtotal_amount = total
        po.total_amount = total
        po.save()

        req.status = RequisitionStatus.CONVERTED_TO_PO
        req.save()

        return Response({
            'success': True,
            'message': f"Purchase Order {po.po_number} created successfully.",
            'purchase_order': PurchaseOrderSerializer(po).data
        }, status=status.HTTP_201_CREATED)


class GoodsReceiptNoteViewSet(viewsets.ModelViewSet):
    """
    Goods Receipt Notes (GRN) with atomic stock increments and audited stock movements.
    """
    serializer_class = GoodsReceiptNoteSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = GoodsReceiptNote.objects.prefetch_related('items__medicine').select_related(
            'supplier', 'purchase_order', 'branch', 'received_by__user_profile'
        )
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        po_id = params.get('po_id')
        supplier_id = params.get('supplier_id')
        if po_id:
            qs = qs.filter(purchase_order_id=po_id)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        supplier = Supplier.objects.filter(id=data.get('supplier_id')).first()
        po = PurchaseOrder.objects.filter(id=data.get('purchase_order_id')).first() if data.get('purchase_order_id') else None

        if not supplier and po:
            supplier = po.supplier

        if not supplier:
            return Response({'error': 'Supplier is required for GRN.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        branch = po.branch if po else (staff.branch if staff else Branch.objects.first())

        grn_num = f"GRN-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        grn = GoodsReceiptNote.objects.create(
            grn_number=grn_num,
            purchase_order=po,
            supplier=supplier,
            branch=branch,
            delivery_challan_number=data.get('delivery_challan_number', ''),
            received_by=staff,
            notes=data.get('notes', ''),
            total_received_value=Decimal('0.00')
        )

        total_val = Decimal('0.00')
        has_rejected = False

        for item_data in data.get('items', []):
            med_id = item_data.get('medicine_id')
            med = Medicine.objects.filter(id=med_id).first()
            if not med:
                continue

            recv_qty = int(item_data.get('received_quantity', item_data.get('quantity_received', 0)))
            acc_qty = int(item_data.get('accepted_quantity', item_data.get('quantity_accepted', recv_qty)))
            rej_qty = int(item_data.get('rejected_quantity', item_data.get('quantity_rejected', 0)))
            if rej_qty > 0:
                has_rejected = True

            unit_cost = Decimal(str(item_data.get('unit_purchase_cost', med.purchase_cost)))
            unit_sp = Decimal(str(item_data.get('unit_selling_price', med.selling_price)))
            subtotal = unit_cost * Decimal(str(acc_qty))
            total_val += subtotal

            batch_num = item_data.get('batch_number') or f"BAT-{uuid.uuid4().hex[:6].upper()}"
            expiry_date = item_data.get('expiry_date') or (timezone.now().date() + timezone.timedelta(days=365))
            mfg_date = item_data.get('mfg_date') or timezone.now().date()

            created_batch = None
            if acc_qty > 0:
                created_batch, _ = MedicineBatch.objects.get_or_create(
                    medicine=med,
                    batch_number=batch_num,
                    branch=branch,
                    defaults={
                        'supplier': supplier,
                        'unit_purchase_cost': unit_cost,
                        'unit_selling_price': unit_sp,
                        'expiry_date': expiry_date,
                        'status': BatchStatus.AVAILABLE,
                        'quantity_in_stock': 0,
                        'location_name': item_data.get('storage_location', 'Main Pharmacy Store')
                    }
                )

                prev_stock = created_batch.quantity_in_stock
                created_batch.quantity_in_stock += acc_qty
                created_batch.unit_purchase_cost = unit_cost
                created_batch.unit_selling_price = unit_sp
                created_batch.status = BatchStatus.AVAILABLE
                created_batch.save()

                StockMovement.objects.create(
                    branch=branch,
                    batch=created_batch,
                    item_name=f"{med.brand_name} ({med.generic_name})",
                    batch_reference=created_batch.batch_number,
                    movement_type=MovementType.PURCHASE_RECEIPT,
                    quantity_delta=acc_qty,
                    previous_stock=prev_stock,
                    new_stock=created_batch.quantity_in_stock,
                    reference_document=grn.grn_number,
                    unit_cost=unit_cost,
                    total_cost=subtotal,
                    recorded_by=staff,
                    remarks=f"Goods received via {grn.grn_number} from {supplier.name}"
                )

            po_item = po.items.filter(medicine=med).first() if po else None
            GoodsReceiptItem.objects.create(
                grn=grn,
                medicine=med,
                po_item=po_item,
                batch_number=batch_num,
                manufacturing_date=mfg_date,
                expiry_date=expiry_date,
                quantity_received=recv_qty,
                quantity_accepted=acc_qty,
                quantity_rejected=rej_qty,
                rejection_reason=item_data.get('rejection_reason', ''),
                unit_purchase_cost=unit_cost,
                unit_selling_price=unit_sp,
                created_batch=created_batch
            )

            if po_item and acc_qty > 0:
                po_item.quantity_received += acc_qty
                po_item.save()

        grn.total_received_value = total_val
        grn.save()

        if po:
            total_ordered = sum(i.quantity for i in po.items.all())
            total_rcvd = sum(i.quantity_received for i in po.items.all())
            if total_rcvd >= total_ordered and total_ordered > 0:
                po.status = PurchaseOrderStatus.RECEIVED
            elif total_rcvd > 0:
                po.status = PurchaseOrderStatus.PARTIALLY_RECEIVED
            po.save()

        res_data = GoodsReceiptNoteSerializer(grn).data
        res_data['status'] = 'PARTIALLY_ACCEPTED' if has_rejected else 'ACCEPTED'
        return Response(res_data, status=status.HTTP_201_CREATED)


class SupplierInvoiceViewSet(viewsets.ModelViewSet):
    """
    Accounts Payable: Supplier invoices linked to PO and GRN.
    """
    serializer_class = SupplierInvoiceSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = SupplierInvoice.objects.select_related('supplier', 'purchase_order', 'grn', 'branch', 'approved_by__user_profile')
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        supplier_id = params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier = Supplier.objects.filter(id=data.get('supplier_id')).first()
        if not supplier:
            return Response({'error': 'Supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        inv_num = data.get('invoice_number')
        if SupplierInvoice.objects.filter(supplier=supplier, invoice_number=inv_num).exists():
            return Response({'error': f"Invoice #{inv_num} already registered for supplier {supplier.name}."}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()

        invoice = SupplierInvoice.objects.create(
            invoice_number=inv_num,
            supplier=supplier,
            purchase_order_id=data.get('purchase_order_id') or None,
            grn_id=data.get('grn_id') or None,
            branch=branch,
            invoice_date=data.get('invoice_date') or timezone.localdate(),
            due_date=data.get('due_date') or (timezone.localdate() + timezone.timedelta(days=30)),
            subtotal_amount=Decimal(str(data.get('subtotal', '0.00'))),
            tax_amount=Decimal(str(data.get('tax_amount', '0.00'))),
            total_amount=Decimal(str(data.get('total_amount', '0.00'))),
            payment_status=InvoicePaymentStatus.UNPAID,
            is_approved=False,
            notes=data.get('notes', '')
        )
        res_data = SupplierInvoiceSerializer(invoice).data
        res_data['status'] = 'PENDING_REVIEW'
        return Response(res_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        inv = self.get_object()
        staff = get_staff_profile(request.user)
        inv.approved_by = staff
        inv.is_approved = True
        inv.notes = f"{inv.notes}\nApproved for payment by {staff.user_profile.full_name if staff else 'Admin'}."
        inv.save()
        res_data = SupplierInvoiceSerializer(inv).data
        res_data['status'] = 'APPROVED'
        return Response(res_data)


class PrescriptionDispenseView(views.APIView):
    """
    Prescription-based dispensing with strict batch expiry validation,
    concurrency-safe stock deduction, and billing invoice synchronization.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request):
        data = request.data
        patient_id = data.get('patient_id')
        prescription_id = data.get('prescription_id')
        items = data.get('items', [])

        if not items:
            return Response({'error': 'No medicine items specified for dispensing.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient and prescription_id:
            rx = Prescription.objects.filter(id=prescription_id).first()
            if rx:
                patient = rx.patient

        if not patient:
            return Response({'error': 'Patient is required for dispensing.'}, status=status.HTTP_404_NOT_FOUND)

        pharmacist = get_staff_profile(request.user)
        branch = pharmacist.branch if pharmacist else Branch.objects.first()
        today = timezone.now().date()

        disp_number = f"DISP-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        dispense_record = DispenseRecord.objects.create(
            dispense_number=disp_number,
            prescription_id=prescription_id or None,
            patient=patient,
            pharmacist=pharmacist,
            branch=branch,
            is_ipd_issue=(data.get('issue_type') == 'IPD'),
            ward_location=data.get('ward_location', ''),
            total_amount=Decimal('0.00')
        )

        total_amount = Decimal('0.00')

        # Find or create active Patient Invoice for billing sync
        invoice = Invoice.objects.filter(
            patient=patient,
            status__in=[InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]
        ).first()

        if not invoice:
            inv_num = f"INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            invoice = Invoice.objects.create(
                invoice_number=inv_num,
                patient=patient,
                branch=branch,
                invoice_date=today,
                status=InvoiceStatus.ISSUED,
                notes=f"Pharmacy dispensation bill {disp_number}"
            )

        for itm in items:
            batch_id = itm.get('batch_id')
            qty = int(itm.get('quantity', 0))

            if qty <= 0:
                continue

            batch = MedicineBatch.objects.select_for_update().filter(id=batch_id).first()
            if not batch:
                return Response({'error': f"Batch not found: {batch_id}"}, status=status.HTTP_404_NOT_FOUND)

            # CRITICAL CLINICAL SAFETY: Reject expired or quarantined batches
            if batch.status != BatchStatus.AVAILABLE or batch.expiry_date <= today:
                batch.status = BatchStatus.EXPIRED if batch.expiry_date <= today else batch.status
                batch.save()
                return Response({
                    'error': f"Clinical Safety Violation: Batch {batch.batch_number} of {batch.medicine.brand_name} is {batch.status} (Expiry: {batch.expiry_date}) and cannot be dispensed."
                }, status=status.HTTP_400_BAD_REQUEST)

            if batch.quantity_in_stock < qty:
                return Response({
                    'error': f"Insufficient stock for {batch.medicine.brand_name} (Batch: {batch.batch_number}). Available: {batch.quantity_in_stock}, Requested: {qty}"
                }, status=status.HTTP_409_CONFLICT)

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
                unit_cost=batch.unit_purchase_cost,
                subtotal=subtotal
            )

            StockMovement.objects.create(
                branch=branch,
                batch=batch,
                item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                batch_reference=batch.batch_number,
                movement_type=MovementType.DISPENSE,
                quantity_delta=-qty,
                previous_stock=prev_stock,
                new_stock=batch.quantity_in_stock,
                reference_document=disp_number,
                unit_cost=batch.unit_purchase_cost,
                total_cost=subtotal,
                recorded_by=pharmacist,
                remarks=f"Dispensed to {patient.user_profile.full_name} under {disp_number}"
            )

            InvoiceItem.objects.create(
                invoice=invoice,
                item_type=ChargeItemType.PHARMACY,
                description=f"{batch.medicine.brand_name} ({batch.medicine.dosage_form} {batch.medicine.strength}) - Batch: {batch.batch_number}",
                quantity=qty,
                unit_price=batch.unit_selling_price,
                subtotal=subtotal
            )

        dispense_record.total_amount = total_amount
        dispense_record.invoice = invoice
        dispense_record.save()

        invoice.recalculate_totals()

        if prescription_id:
            Prescription.objects.filter(id=prescription_id).update(is_dispensed=True)

        return Response({
            'success': True,
            'dispense_record': DispenseRecordSerializer(dispense_record).data,
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'total_amount': total_amount
        }, status=status.HTTP_201_CREATED)


class IPDMedicationIssueView(views.APIView):
    """
    IPD Medication Issues linked to Inpatient Admissions and ward administration.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    @transaction.atomic
    def post(self, request):
        data = request.data
        patient_id = data.get('patient_id')
        ward_name = data.get('ward_name', 'General Inpatient Ward')
        items = data.get('items', [])

        if not items:
            return Response({'error': 'No medications specified for IPD issue.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = PatientProfile.objects.filter(id=patient_id).first()
        if not patient:
            return Response({'error': 'Patient not found.'}, status=status.HTTP_404_NOT_FOUND)

        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()
        today = timezone.now().date()

        disp_number = f"IPD-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        dispense_record = DispenseRecord.objects.create(
            dispense_number=disp_number,
            patient=patient,
            pharmacist=staff,
            branch=branch,
            is_ipd_issue=True,
            ward_location=ward_name,
            total_amount=Decimal('0.00')
        )

        total_amount = Decimal('0.00')

        invoice = Invoice.objects.filter(
            patient=patient,
            status__in=[InvoiceStatus.DRAFT, InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID]
        ).first()

        if not invoice:
            inv_num = f"INV-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            invoice = Invoice.objects.create(
                invoice_number=inv_num,
                patient=patient,
                branch=branch,
                invoice_date=today,
                status=InvoiceStatus.ISSUED,
                notes=f"Inpatient Medication Charges {disp_number}"
            )

        for itm in items:
            batch_id = itm.get('batch_id')
            qty = int(itm.get('quantity', 0))
            if qty <= 0:
                continue

            batch = MedicineBatch.objects.select_for_update().filter(id=batch_id).first()
            if not batch:
                return Response({'error': f"Batch not found: {batch_id}"}, status=status.HTTP_404_NOT_FOUND)

            if batch.status != BatchStatus.AVAILABLE or batch.expiry_date <= today:
                return Response({
                    'error': f"Batch {batch.batch_number} is {batch.status}/expired and cannot be issued."
                }, status=status.HTTP_400_BAD_REQUEST)

            if batch.quantity_in_stock < qty:
                return Response({
                    'error': f"Insufficient stock for {batch.medicine.brand_name}. Available: {batch.quantity_in_stock}"
                }, status=status.HTTP_409_CONFLICT)

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
                unit_cost=batch.unit_purchase_cost,
                subtotal=subtotal
            )

            StockMovement.objects.create(
                branch=branch,
                batch=batch,
                item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                batch_reference=batch.batch_number,
                movement_type=MovementType.IPD_ISSUE,
                quantity_delta=-qty,
                previous_stock=prev_stock,
                new_stock=batch.quantity_in_stock,
                reference_document=disp_number,
                unit_cost=batch.unit_purchase_cost,
                total_cost=subtotal,
                recorded_by=staff,
                remarks=f"IPD Issue to Ward: {ward_name} for Patient: {patient.user_profile.full_name}"
            )

            InvoiceItem.objects.create(
                invoice=invoice,
                item_type=ChargeItemType.PHARMACY,
                description=f"[IPD {ward_name}] {batch.medicine.brand_name} - Batch: {batch.batch_number}",
                quantity=qty,
                unit_price=batch.unit_selling_price,
                subtotal=subtotal
            )

        dispense_record.total_amount = total_amount
        dispense_record.invoice = invoice
        dispense_record.save()
        invoice.recalculate_totals()

        return Response({
            'success': True,
            'dispense_record': DispenseRecordSerializer(dispense_record).data,
            'ward_name': ward_name,
            'total_amount': total_amount
        }, status=status.HTTP_201_CREATED)


class StockTransferViewSet(viewsets.ModelViewSet):
    """
    Ward and Department Stock Transfers with Dispatch and Receipt confirmation.
    """
    serializer_class = StockTransferSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = StockTransfer.objects.prefetch_related('items__medicine', 'items__batch').select_related(
            'branch', 'requested_by__user_profile', 'received_by__user_profile'
        )
        params = getattr(self.request, 'query_params', getattr(self.request, 'GET', {}))
        status_param = params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()

        transfer_num = f"TRF-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        dest_branch_id = data.get('destination_branch_id')
        notes_str = f"DEST_BRANCH:{dest_branch_id} " + data.get('notes', '') if dest_branch_id else data.get('notes', '')
        transfer = StockTransfer.objects.create(
            transfer_number=transfer_num,
            branch=branch,
            source_location=data.get('source_location', 'Central Pharmacy'),
            destination_location=data.get('destination_location', 'ICU Ward Sub-Stock'),
            requested_by=staff,
            status=TransferStatus.REQUESTED,
            notes=notes_str
        )

        for item_data in data.get('items', []):
            med = Medicine.objects.filter(id=item_data['medicine_id']).first()
            batch = MedicineBatch.objects.filter(id=item_data['batch_id']).first()
            if med and batch:
                StockTransferItem.objects.create(
                    transfer=transfer,
                    medicine=med,
                    batch=batch,
                    quantity=int(item_data['quantity'])
                )

        return Response(StockTransferSerializer(transfer).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='dispatch')
    @transaction.atomic
    def dispatch_transfer(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != TransferStatus.REQUESTED:
            return Response({'error': f"Cannot dispatch transfer in status {transfer.status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        for item in transfer.items.all():
            batch = MedicineBatch.objects.select_for_update().filter(id=item.batch_id).first()
            if not batch:
                return Response({'error': f"Batch {item.batch_id} not found."}, status=status.HTTP_404_NOT_FOUND)

            if batch.quantity_in_stock < item.quantity:
                return Response({
                    'error': f"Insufficient stock for {batch.medicine.brand_name} at source. Available: {batch.quantity_in_stock}, Required: {item.quantity}"
                }, status=status.HTTP_409_CONFLICT)

            prev_stock = batch.quantity_in_stock
            batch.quantity_in_stock -= item.quantity
            batch.save()

            StockMovement.objects.create(
                branch=transfer.branch,
                batch=batch,
                item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                batch_reference=batch.batch_number,
                movement_type=MovementType.TRANSFER_OUT,
                quantity_delta=-item.quantity,
                previous_stock=prev_stock,
                new_stock=batch.quantity_in_stock,
                reference_document=transfer.transfer_number,
                recorded_by=staff,
                remarks=f"Dispatched in transfer {transfer.transfer_number} to {transfer.destination_location}"
            )

        transfer.status = TransferStatus.DISPATCHED
        transfer.dispatched_by = staff
        transfer.dispatched_at = timezone.now()
        transfer.save()

        return Response(StockTransferSerializer(transfer).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def receive(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != TransferStatus.DISPATCHED:
            return Response({'error': f"Only dispatched transfers can be received. Current: {transfer.status}"}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        dest_branch_id = request.data.get('destination_branch_id')
        if not dest_branch_id and 'DEST_BRANCH:' in (transfer.notes or ''):
            dest_branch_id = transfer.notes.split('DEST_BRANCH:')[1].split(' ')[0]
        dest_branch = Branch.objects.filter(id=dest_branch_id).first() if dest_branch_id else transfer.branch

        for item in transfer.items.all():
            source_batch = item.batch
            dest_batch, _ = MedicineBatch.objects.get_or_create(
                medicine=item.medicine,
                batch_number=source_batch.batch_number,
                branch=dest_branch,
                defaults={
                    'supplier': source_batch.supplier,
                    'unit_purchase_cost': source_batch.unit_purchase_cost,
                    'unit_selling_price': source_batch.unit_selling_price,
                    'expiry_date': source_batch.expiry_date,
                    'status': BatchStatus.AVAILABLE,
                    'quantity_in_stock': 0,
                    'location_name': transfer.destination_location
                }
            )

            prev_stock = dest_batch.quantity_in_stock
            dest_batch.quantity_in_stock += item.quantity
            dest_batch.location_name = transfer.destination_location
            dest_batch.save()

            StockMovement.objects.create(
                branch=dest_branch,
                batch=dest_batch,
                item_name=f"{item.medicine.brand_name} ({item.medicine.generic_name})",
                batch_reference=dest_batch.batch_number,
                movement_type=MovementType.TRANSFER_IN,
                quantity_delta=item.quantity,
                previous_stock=prev_stock,
                new_stock=dest_batch.quantity_in_stock,
                reference_document=transfer.transfer_number,
                recorded_by=staff,
                remarks=f"Received in transfer {transfer.transfer_number} from {transfer.source_location}"
            )

        transfer.status = TransferStatus.RECEIVED
        transfer.received_by = staff
        transfer.received_at = timezone.now()
        transfer.save()

        return Response(StockTransferSerializer(transfer).data)


class StockAdjustmentViewSet(viewsets.ModelViewSet):
    """
    Inventory adjustments for damage write-off, expiry removal, and count corrections.
    """
    serializer_class = StockAdjustmentSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = StockAdjustment.objects.prefetch_related('items__batch__medicine').select_related(
            'branch', 'adjusted_by__user_profile', 'approved_by__user_profile'
        )
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()

        adj_num = f"ADJ-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        adj = StockAdjustment.objects.create(
            adjustment_number=adj_num,
            branch=branch,
            location_name=data.get('location', 'Central Pharmacy'),
            adjustment_type=data.get('adjustment_type', AdjustmentType.PHYSICAL_COUNT_CORRECTION),
            adjusted_by=staff,
            is_posted=False,
            reason=data.get('reason', 'Stock review adjustment')
        )

        for item_data in data.get('items', []):
            batch = MedicineBatch.objects.filter(id=item_data['batch_id']).first()
            if batch:
                qty_change = int(item_data['quantity_change'])
                StockAdjustmentItem.objects.create(
                    adjustment=adj,
                    batch=batch,
                    previous_stock=batch.quantity_in_stock,
                    quantity_delta=qty_change,
                    new_stock=batch.quantity_in_stock + qty_change
                )

        return Response(StockAdjustmentSerializer(adj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve_and_post(self, request, pk=None):
        adj = self.get_object()
        if adj.is_posted:
            return Response({'error': 'Adjustment has already been posted to ledger.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        for item in adj.items.all():
            batch = MedicineBatch.objects.select_for_update().filter(id=item.batch_id).first()
            if not batch:
                continue

            prev_stock = batch.quantity_in_stock
            new_stock = prev_stock + item.quantity_delta
            if new_stock < 0:
                return Response({
                    'error': f"Adjustment cannot reduce stock below zero for {batch.medicine.brand_name}."
                }, status=status.HTTP_409_CONFLICT)

            batch.quantity_in_stock = new_stock

            if adj.adjustment_type == AdjustmentType.DAMAGE_WRITEOFF and batch.quantity_in_stock == 0:
                batch.status = BatchStatus.DAMAGED
            elif adj.adjustment_type == AdjustmentType.EXPIRY_QUARANTINE:
                batch.status = BatchStatus.EXPIRED

            batch.save()

            m_type = MovementType.ADJUSTMENT_DAMAGE if adj.adjustment_type in [AdjustmentType.DAMAGE_WRITEOFF, AdjustmentType.EXPIRY_QUARANTINE] else MovementType.OPENING_STOCK

            StockMovement.objects.create(
                branch=adj.branch,
                batch=batch,
                item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                batch_reference=batch.batch_number,
                movement_type=m_type,
                quantity_delta=item.quantity_delta,
                previous_stock=prev_stock,
                new_stock=new_stock,
                reference_document=adj.adjustment_number,
                unit_cost=batch.unit_purchase_cost,
                total_cost=batch.unit_purchase_cost * Decimal(str(abs(item.quantity_delta))),
                recorded_by=staff,
                remarks=f"Stock adjustment: {adj.reason}"
            )

        adj.is_posted = True
        adj.approved_by = staff
        adj.approved_at = timezone.now()
        adj.save()

        return Response(StockAdjustmentSerializer(adj).data)


class PharmacyReturnViewSet(viewsets.ModelViewSet):
    """
    Patient and Supplier returns with quarantine inspection and restock/refund disposition.
    """
    serializer_class = PharmacyReturnSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = PharmacyReturn.objects.prefetch_related('items__batch__medicine').select_related(
            'patient__user_profile', 'supplier', 'branch', 'processed_by__user_profile'
        )
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()

        ret_num = f"RET-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        ret = PharmacyReturn.objects.create(
            return_number=ret_num,
            return_type=data.get('return_type', ReturnType.PATIENT_RETURN),
            patient_id=data.get('patient_id') or None,
            supplier_id=data.get('supplier_id') or None,
            branch=branch,
            reason=data.get('reason', 'Unused medication return'),
            processed_by=staff,
            is_restocked=False
        )

        total_refund = Decimal('0.00')
        for itm in data.get('items', []):
            batch = MedicineBatch.objects.filter(id=itm['batch_id']).first()
            if batch:
                qty = int(itm['quantity'])
                u_price = batch.unit_selling_price
                subtotal = u_price * Decimal(str(qty))
                total_refund += subtotal

                PharmacyReturnItem.objects.create(
                    return_record=ret,
                    batch=batch,
                    quantity=qty,
                    unit_refund_price=u_price,
                    is_usable=itm.get('is_usable', False)
                )

        ret.total_refund_amount = total_refund
        ret.save()
        return Response(PharmacyReturnSerializer(ret).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def process_disposition(self, request, pk=None):
        ret = self.get_object()
        if ret.is_restocked:
            return Response({'error': 'Return is already restocked.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        for item in ret.items.all():
            is_usable = request.data.get('is_usable', item.is_usable)
            item.is_usable = is_usable
            item.save()

            if is_usable:
                batch = MedicineBatch.objects.select_for_update().filter(id=item.batch_id).first()
                if batch and batch.expiry_date > timezone.now().date():
                    prev_stock = batch.quantity_in_stock
                    batch.quantity_in_stock += item.quantity
                    batch.save()

                    StockMovement.objects.create(
                        branch=ret.branch,
                        batch=batch,
                        item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                        batch_reference=batch.batch_number,
                        movement_type=MovementType.RETURN,
                        quantity_delta=item.quantity,
                        previous_stock=prev_stock,
                        new_stock=batch.quantity_in_stock,
                        reference_document=ret.return_number,
                        recorded_by=staff,
                        remarks=f"Restocked after inspection: {ret.reason}"
                    )

        ret.is_restocked = True
        ret.save()
        return Response(PharmacyReturnSerializer(ret).data)


class StockReconciliationViewSet(viewsets.ModelViewSet):
    """
    Physical stock audit and reconciliation with automated variance calculation and ledger posting.
    """
    serializer_class = StockReconciliationSerializer
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = StockReconciliation.objects.prefetch_related('items__batch__medicine').select_related(
            'branch', 'conducted_by__user_profile', 'approved_by__user_profile'
        )
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        staff = get_staff_profile(request.user)
        branch = staff.branch if staff else Branch.objects.first()

        rec_num = f"REC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        reconciliation = StockReconciliation.objects.create(
            reconciliation_number=rec_num,
            branch=branch,
            location_name=data.get('location', 'Central Pharmacy'),
            conducted_by=staff,
            status=ReconciliationStatus.IN_PROGRESS,
            notes=data.get('notes', '')
        )

        for item_data in data.get('items', []):
            batch = MedicineBatch.objects.filter(id=item_data['batch_id']).first()
            if batch:
                book_qty = batch.quantity_in_stock
                phys_qty = int(item_data['physical_quantity'])
                variance = phys_qty - book_qty

                StockReconciliationItem.objects.create(
                    reconciliation=reconciliation,
                    batch=batch,
                    book_quantity=book_qty,
                    counted_quantity=phys_qty,
                    discrepancy_quantity=variance,
                    discrepancy_reason=item_data.get('variance_reason', '')
                )

        return Response(StockReconciliationSerializer(reconciliation).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve_and_post(self, request, pk=None):
        rec = self.get_object()
        if rec.status == ReconciliationStatus.APPROVED_AND_POSTED:
            return Response({'error': 'Reconciliation has already been posted to ledger.'}, status=status.HTTP_400_BAD_REQUEST)

        staff = get_staff_profile(request.user)

        for item in rec.items.all():
            batch = MedicineBatch.objects.select_for_update().filter(id=item.batch_id).first()
            if not batch:
                continue

            prev_stock = batch.quantity_in_stock
            new_stock = item.counted_quantity
            delta = item.discrepancy_quantity

            batch.quantity_in_stock = new_stock
            batch.save()

            if delta != 0:
                StockMovement.objects.create(
                    branch=rec.branch,
                    batch=batch,
                    item_name=f"{batch.medicine.brand_name} ({batch.medicine.generic_name})",
                    batch_reference=batch.batch_number,
                    movement_type=MovementType.RECONCILIATION,
                    quantity_delta=delta,
                    previous_stock=prev_stock,
                    new_stock=new_stock,
                    reference_document=rec.reconciliation_number,
                    unit_cost=batch.unit_purchase_cost,
                    total_cost=batch.unit_purchase_cost * Decimal(str(abs(delta))),
                    recorded_by=staff,
                    remarks=f"Physical reconciliation variance: {item.discrepancy_reason or 'Audit correction'}"
                )

        rec.status = ReconciliationStatus.APPROVED_AND_POSTED
        rec.approved_by = staff
        rec.approved_at = timezone.now()
        rec.save()

        return Response(StockReconciliationSerializer(rec).data)


class InventoryValuationView(views.APIView):
    """
    Inventory valuation report by item, batch, and location using Weighted Average Cost and FIFO.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        branch_id = params.get('branch_id')

        batches = MedicineBatch.objects.select_related('medicine', 'branch')
        if branch_id:
            batches = batches.filter(branch_id=branch_id)

        items_map = {}
        total_usable_value = Decimal('0.00')
        total_expired_value = Decimal('0.00')

        for b in batches:
            val = Decimal(str(b.quantity_in_stock)) * b.unit_purchase_cost
            is_usable = (b.status == BatchStatus.AVAILABLE and b.expiry_date > today)

            if is_usable:
                total_usable_value += val
            else:
                total_expired_value += val

            med_id = str(b.medicine.id)
            if med_id not in items_map:
                items_map[med_id] = {
                    'medicine_id': med_id,
                    'item_code': b.medicine.code,
                    'brand_name': b.medicine.brand_name,
                    'generic_name': b.medicine.generic_name,
                    'category': b.medicine.category,
                    'item_type': b.medicine.item_type,
                    'total_stock': 0,
                    'usable_stock': 0,
                    'valuation_value': Decimal('0.00'),
                    'batches': []
                }

            items_map[med_id]['total_stock'] += b.quantity_in_stock
            if is_usable:
                items_map[med_id]['usable_stock'] += b.quantity_in_stock
                items_map[med_id]['valuation_value'] += val

            items_map[med_id]['batches'].append({
                'batch_number': b.batch_number,
                'quantity_in_stock': b.quantity_in_stock,
                'unit_purchase_cost': b.unit_purchase_cost,
                'valuation': val,
                'expiry_date': b.expiry_date,
                'status': b.status,
                'is_usable': is_usable
            })

        return Response({
            'total_usable_valuation': total_usable_value,
            'total_expired_quarantined_valuation': total_expired_value,
            'item_valuations': list(items_map.values())
        })


class PharmacyFinancialReportsView(views.APIView):
    """
    Pharmacy Sales, Cost of Goods Sold (COGS), and Gross Margin Reports.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        branch_id = params.get('branch_id')

        items_qs = DispenseItem.objects.select_related('dispense_record', 'batch__medicine')

        if start_date:
            items_qs = items_qs.filter(dispense_record__dispensed_at__date__gte=start_date)
        if end_date:
            items_qs = items_qs.filter(dispense_record__dispensed_at__date__lte=end_date)
        if branch_id:
            items_qs = items_qs.filter(dispense_record__branch_id=branch_id)

        total_sales = Decimal('0.00')
        total_cogs = Decimal('0.00')
        item_sales_map = {}

        for item in items_qs:
            sales_subtotal = item.subtotal
            cogs_subtotal = item.unit_cost * Decimal(str(item.quantity))

            total_sales += sales_subtotal
            total_cogs += cogs_subtotal

            med = item.batch.medicine if item.batch else None
            med_id = str(med.id) if med else 'unknown'
            med_name = med.brand_name if med else 'Prescribed Medicine'

            if med_id not in item_sales_map:
                item_sales_map[med_id] = {
                    'medicine_name': med_name,
                    'quantity_sold': 0,
                    'revenue': Decimal('0.00'),
                    'cogs': Decimal('0.00'),
                    'profit': Decimal('0.00'),
                }

            item_sales_map[med_id]['quantity_sold'] += item.quantity
            item_sales_map[med_id]['revenue'] += sales_subtotal
            item_sales_map[med_id]['cogs'] += cogs_subtotal
            item_sales_map[med_id]['profit'] += (sales_subtotal - cogs_subtotal)

        gross_profit = total_sales - total_cogs
        gross_margin_pct = (gross_profit / total_sales * 100) if total_sales > Decimal('0.00') else Decimal('0.00')

        return Response({
            'total_sales_revenue': total_sales,
            'cost_of_goods_sold': total_cogs,
            'gross_profit': gross_profit,
            'gross_margin_percentage': round(gross_margin_pct, 2),
            'items_breakdown': sorted(list(item_sales_map.values()), key=lambda x: x['revenue'], reverse=True)
        })


class BarcodeLookupView(views.APIView):
    """
    Fast barcode lookup for item scanning and dispensing verification.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        code = params.get('code', '').strip()
        if not code:
            return Response({'error': 'Barcode or code query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()

        batch = MedicineBatch.objects.select_related('medicine').filter(
            Q(batch_barcode=code) | Q(batch_number__iexact=code)
        ).first()

        if batch:
            is_usable = (batch.status == BatchStatus.AVAILABLE and batch.expiry_date > today)
            return Response({
                'type': 'BATCH',
                'medicine_id': batch.medicine.id,
                'brand_name': batch.medicine.brand_name,
                'generic_name': batch.medicine.generic_name,
                'batch_id': batch.id,
                'batch_number': batch.batch_number,
                'quantity_in_stock': batch.quantity_in_stock,
                'selling_price': batch.unit_selling_price,
                'expiry_date': batch.expiry_date,
                'status': batch.status,
                'is_usable': is_usable
            })

        med = Medicine.objects.filter(
            Q(barcode=code) | Q(code__iexact=code)
        ).first()

        if med:
            usable_batches = med.batches.filter(
                status=BatchStatus.AVAILABLE,
                expiry_date__gt=today,
                quantity_in_stock__gt=0
            ).order_by('expiry_date')

            return Response({
                'type': 'MEDICINE',
                'medicine_id': med.id,
                'item_code': med.code,
                'brand_name': med.brand_name,
                'generic_name': med.generic_name,
                'dosage_form': med.dosage_form,
                'strength': med.strength,
                'selling_price': med.standard_selling_price,
                'usable_stock': sum(b.quantity_in_stock for b in usable_batches),
                'available_batches': MedicineBatchSerializer(usable_batches, many=True).data
            })

        return Response({'found': False, 'message': f'No item or batch found for code: {code}'}, status=status.HTTP_404_NOT_FOUND)


class LowStockReorderAlertsView(views.APIView):
    """
    Real-time low stock, reorder, approaching expiry (<60d), and expired batch alerts.
    """
    permission_classes = [IsAuthenticated, IsStaffMember]

    def get(self, request):
        today = timezone.now().date()
        sixty_days = today + timezone.timedelta(days=60)
        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        branch_id = params.get('branch_id')

        med_qs = Medicine.objects.filter(is_active=True, min_stock_level__gt=0)
        alerts = []
        low_stock_items = []

        for m in med_qs:
            batch_qs = m.batches.filter(status=BatchStatus.AVAILABLE, expiry_date__gt=today)
            if branch_id:
                batch_qs = batch_qs.filter(branch_id=branch_id)

            usable_qty = batch_qs.aggregate(total=Sum('quantity_in_stock'))['total'] or 0

            if usable_qty <= m.min_stock_level:
                suggested_reorder = max(m.max_stock_level - usable_qty, m.min_stock_level) if m.max_stock_level > 0 else m.min_stock_level * 2
                alert_obj = {
                    'medicine_id': str(m.id),
                    'item_code': m.code,
                    'code': m.code,
                    'name': m.brand_name,
                    'brand_name': m.brand_name,
                    'generic_name': m.generic_name,
                    'category': m.category,
                    'item_type': m.item_type,
                    'usable_stock': usable_qty,
                    'current_stock': usable_qty,
                    'unit': 'units',
                    'min_stock_level': m.min_stock_level,
                    'max_stock_level': m.max_stock_level,
                    'deficit': m.min_stock_level - usable_qty,
                    'suggested_reorder_quantity': suggested_reorder,
                    'purchase_cost': float(m.purchase_cost) if m.purchase_cost else 0.0
                }
                alerts.append(alert_obj)
                low_stock_items.append(alert_obj)

        batches = MedicineBatch.objects.select_related('medicine').filter(quantity_in_stock__gt=0)
        if branch_id:
            batches = batches.filter(branch_id=branch_id)

        expiring_qs = batches.filter(expiry_date__gt=today, expiry_date__lte=sixty_days).order_by('expiry_date')
        expiring_batches = [
            {
                'batch_id': str(b.id),
                'medicine_name': b.medicine.brand_name,
                'batch_number': b.batch_number,
                'expiry_date': str(b.expiry_date),
                'quantity_in_stock': b.quantity_in_stock,
            }
            for b in expiring_qs[:50]
        ]

        expired_qs = batches.filter(expiry_date__lte=today).order_by('-expiry_date')
        expired_batches = [
            {
                'batch_id': str(b.id),
                'medicine_name': b.medicine.brand_name,
                'batch_number': b.batch_number,
                'expiry_date': str(b.expiry_date),
                'quantity_in_stock': b.quantity_in_stock,
            }
            for b in expired_qs[:50]
        ]

        return Response({
            'alerts_count': len(alerts),
            'alerts': sorted(alerts, key=lambda x: x['deficit'], reverse=True),
            'low_stock_items': sorted(low_stock_items, key=lambda x: x['deficit'], reverse=True),
            'expiring_batches': expiring_batches,
            'expired_batches': expired_batches,
        })

