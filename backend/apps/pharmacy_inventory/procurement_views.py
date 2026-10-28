import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Q, F, Count, Avg
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated

from apps.core.models import Branch, Department
from apps.authentication.models import StaffProfile
from .models import (
    Supplier, SupplierCategory, Medicine, MedicineBatch,
    PurchaseRequisition, PurchaseRequisitionItem, ProcurementCategory, RequisitionStatus,
    SupplierQuotation, SupplierQuotationItem, QuotationStatus,
    ComparativeStatement,
    PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus,
    GoodsReceiptNote, GoodsReceiptItem,
    SupplierInvoice, InvoicePaymentStatus,
    SupplierReturn, SupplierReturnItem, SupplierReturnReason,
    SupplierCreditNote, CreditNoteStatus,
    SupplierPaymentSchedule, PaymentScheduleStatus,
    StockMovement, MovementType
)
from .serializers import (
    SupplierSerializer,
    SupplierQuotationSerializer, SupplierQuotationItemSerializer,
    ComparativeStatementSerializer,
    PurchaseRequisitionSerializer, PurchaseRequisitionItemSerializer,
    PurchaseOrderSerializer, PurchaseOrderItemSerializer,
    SupplierReturnSerializer, SupplierReturnItemSerializer,
    SupplierCreditNoteSerializer, SupplierPaymentScheduleSerializer,
    SupplierInvoiceSerializer
)


class SupplierManagementViewSet(viewsets.ModelViewSet):
    """
    Supplier Registration, Contact Info, Tax IDs, Banking Details, and Status Control.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierSerializer

    def get_queryset(self):
        qs = Supplier.objects.all().order_by('name')
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search) | Q(contact_person__icontains=search))
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        code = data.get('code', '').strip().upper()
        if not code:
            code = f"SUP-{uuid.uuid4().hex[:6].upper()}"
        if Supplier.objects.filter(code=code).exists():
            return Response({'error': f"Supplier with code '{code}' already exists."}, status=status.HTTP_400_BAD_REQUEST)

        gst = data.get('gst_or_tax_id', '').strip()
        if gst and Supplier.objects.filter(gst_or_tax_id=gst).exists():
            return Response({'error': f"Supplier with Tax/GST ID '{gst}' is already registered."}, status=status.HTTP_400_BAD_REQUEST)

        supplier = Supplier.objects.create(
            code=code,
            name=data.get('name', '').strip(),
            category=data.get('category', SupplierCategory.PHARMACEUTICALS),
            contact_person=data.get('contact_person', '').strip(),
            phone=data.get('phone', '').strip(),
            email=data.get('email', '').strip(),
            address=data.get('address', '').strip(),
            gst_or_tax_id=gst,
            pan_number=data.get('pan_number', '').strip(),
            bank_name=data.get('bank_name', '').strip(),
            bank_account_number=data.get('bank_account_number', '').strip(),
            bank_ifsc=data.get('bank_ifsc', '').strip(),
            payment_terms_days=int(data.get('payment_terms_days', 30)),
            is_active=data.get('is_active', True),
            notes=data.get('notes', ''),
        )
        return Response({
            'message': 'Supplier registered successfully.',
            'supplier': {
                'id': str(supplier.id),
                'code': supplier.code,
                'name': supplier.name,
                'category': supplier.category,
                'contact_person': supplier.contact_person,
                'is_active': supplier.is_active,
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        supplier = self.get_object()
        supplier.is_active = not supplier.is_active
        supplier.save()
        state = "activated" if supplier.is_active else "deactivated"
        return Response({'message': f"Supplier '{supplier.name}' has been {state}.", 'is_active': supplier.is_active})


class ProcurementRequisitionViewSet(viewsets.ModelViewSet):
    """
    Purchase Requisitions across all 5 procurement categories:
    Medicines, Surgical Supplies, Diagnostic Reagents, Equipment, General Hospital Materials.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseRequisitionSerializer

    def get_queryset(self):
        qs = PurchaseRequisition.objects.all().order_by('-created_at')
        branch_id = self.request.query_params.get('branch_id')
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        cat = self.request.query_params.get('procurement_category')
        if cat:
            qs = qs.filter(procurement_category=cat)
        stat = self.request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        staff = getattr(request.user, 'staff_profile', None)
        if not staff:
            staff = StaffProfile.objects.first()

        branch_id = data.get('branch_id')
        branch = Branch.objects.filter(id=branch_id).first() if branch_id else Branch.objects.first()

        dept_id = data.get('department_id')
        dept = Department.objects.filter(id=dept_id).first() if dept_id else None

        req_num = f"REQ-{uuid.uuid4().hex[:6].upper()}"
        category = data.get('procurement_category', ProcurementCategory.MEDICINES)

        with transaction.atomic():
            requisition = PurchaseRequisition.objects.create(
                requisition_number=req_num,
                branch=branch,
                procurement_category=category,
                requesting_department=dept,
                requesting_location=data.get('requesting_location', 'Central Hospital Warehouse'),
                requested_by=staff,
                requested_delivery_date=data.get('requested_delivery_date') or None,
                urgency=data.get('urgency', 'ROUTINE'),
                reason=data.get('reason', ''),
                status=RequisitionStatus.SUBMITTED,
                supporting_document=data.get('supporting_document', ''),
            )

            items_data = data.get('items', [])
            for item in items_data:
                med_id = item.get('medicine_id')
                med = Medicine.objects.filter(id=med_id).first() if med_id else None
                qty = int(item.get('quantity_requested') or item.get('requested_quantity') or 1)
                PurchaseRequisitionItem.objects.create(
                    requisition=requisition,
                    medicine=med,
                    item_name=item.get('item_name', med.brand_name if med else 'Hospital Material'),
                    specifications=item.get('specifications', ''),
                    quantity_requested=qty,
                    quantity_approved=qty,
                    estimated_cost=Decimal(str(item.get('estimated_cost', '0.00'))),
                )

        return Response(PurchaseRequisitionSerializer(requisition).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        req = self.get_object()
        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
        req.status = RequisitionStatus.APPROVED
        req.approved_by = staff
        req.approved_at = timezone.now()
        req.save()
        return Response({'message': f"Requisition {req.requisition_number} approved.", 'status': req.status})

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        req = self.get_object()
        reason = request.data.get('reason', 'Administrative rejection')
        req.status = RequisitionStatus.REJECTED
        req.rejection_reason = reason
        req.save()
        return Response({'message': f"Requisition {req.requisition_number} rejected.", 'status': req.status})

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

        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
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
            unit_cost = (item.medicine.purchase_cost if item.medicine else Decimal('0.00')) or Decimal('0.00')
            subtotal = unit_cost * Decimal(str(qty))
            total += subtotal
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                medicine=item.medicine,
                item_name=item.item_name or (item.medicine.brand_name if item.medicine else 'Procurement Item'),
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

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        req = self.get_object()
        req.status = RequisitionStatus.CANCELLED
        req.save()
        return Response({'message': f"Requisition {req.requisition_number} cancelled."})


class SupplierQuotationViewSet(viewsets.ModelViewSet):
    """
    Supplier Quotation recording and multi-bid management for procurement requisitions.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierQuotationSerializer

    def get_queryset(self):
        qs = SupplierQuotation.objects.all().order_by('total_amount')
        req_id = self.request.query_params.get('requisition_id')
        if req_id:
            qs = qs.filter(requisition_id=req_id)
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier_id')
        supplier = Supplier.objects.filter(id=supplier_id).first()
        if not supplier:
            return Response({'error': 'Valid supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not supplier.is_active:
            return Response({'error': f"Supplier '{supplier.name}' is inactive. Cannot record quotations from inactive vendors."}, status=status.HTTP_400_BAD_REQUEST)

        req_id = data.get('requisition_id')
        requisition = PurchaseRequisition.objects.filter(id=req_id).first()
        if not requisition:
            return Response({'error': 'Valid procurement requisition reference is required.'}, status=status.HTTP_400_BAD_REQUEST)

        quotation_num = data.get('quotation_number') or f"QUO-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            valid_until = data.get('valid_until') or (timezone.localdate() + timezone.timedelta(days=30))
            quotation = SupplierQuotation.objects.create(
                quotation_number=quotation_num,
                requisition=requisition,
                supplier=supplier,
                quotation_date=data.get('quotation_date') or timezone.localdate(),
                valid_until=valid_until,
                delivery_lead_time_days=int(data.get('delivery_lead_time_days', 7)),
                payment_terms=data.get('payment_terms', 'Net 30 Days'),
                subtotal_amount=Decimal(str(data.get('subtotal_amount', '0.00'))),
                tax_amount=Decimal(str(data.get('tax_amount', '0.00'))),
                total_amount=Decimal(str(data.get('total_amount', '0.00'))),
                status=QuotationStatus.RECEIVED,
                document_attachment=data.get('document_attachment', ''),
                remarks=data.get('remarks', ''),
            )

            items_data = data.get('items', [])
            total_calc = Decimal('0.00')
            for item in items_data:
                qty = int(item.get('quantity', 1))
                price = Decimal(str(item.get('unit_price', '0.00')))
                tax = Decimal(str(item.get('tax_rate_pct', '0.00')))
                sub = (price * Decimal(str(qty))) * (Decimal('1.00') + (tax / Decimal('100.00')))
                total_calc += sub
                SupplierQuotationItem.objects.create(
                    quotation=quotation,
                    item_name=item.get('item_name', 'Quoted Item'),
                    quantity=qty,
                    unit_price=price,
                    tax_rate_pct=tax,
                    subtotal=sub,
                )

            if total_calc > Decimal('0.00'):
                quotation.total_amount = total_calc
                quotation.save(update_fields=['total_amount'])

        return Response(SupplierQuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)


class ComparativeStatementViewSet(viewsets.ModelViewSet):
    """
    Side-by-side Comparative Statements evaluating multiple vendor quotations.
    Supports non-lowest bidder selection with mandatory justification.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ComparativeStatementSerializer

    def get_queryset(self):
        return ComparativeStatement.objects.all().order_by('-prepared_at')

    def create(self, request, *args, **kwargs):
        data = request.data
        req_id = data.get('requisition_id')
        requisition = PurchaseRequisition.objects.filter(id=req_id).first()
        if not requisition:
            return Response({'error': 'Valid purchase requisition required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing
        existing = ComparativeStatement.objects.filter(requisition=requisition).first()
        if existing:
            return Response(ComparativeStatementSerializer(existing).data)

        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
        statement_num = f"CS-{uuid.uuid4().hex[:6].upper()}"

        cs = ComparativeStatement.objects.create(
            statement_number=statement_num,
            requisition=requisition,
            prepared_by=staff,
            prepared_at=timezone.now(),
            notes=data.get('notes', 'Comparative bid statement compiled.'),
        )
        return Response(ComparativeStatementSerializer(cs).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='award')
    def award_quotation(self, request, pk=None):
        cs = self.get_object()
        quotation_id = request.data.get('quotation_id')
        quotation = SupplierQuotation.objects.filter(id=quotation_id).first()
        if not quotation:
            return Response({'error': 'Valid quotation ID required for award.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if lowest bidder
        all_quotes = cs.requisition.quotations.all().order_by('total_amount')
        lowest_quote = all_quotes.first()
        is_lowest = (lowest_quote and lowest_quote.id == quotation.id)

        justification = request.data.get('selection_justification', '').strip()
        if not is_lowest and not justification:
            return Response({
                'error': 'Selection justification is required when awarding to a vendor other than the lowest bidder (e.g. superior warranty, urgent lead time, OEM certification).'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            cs.selected_quotation = quotation
            cs.selected_supplier = quotation.supplier
            cs.selection_justification = justification or 'Selected based on lowest conforming bid.'
            cs.is_lowest_bidder_selected = is_lowest
            cs.approval_status = 'APPROVED'
            cs.approved_by = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
            cs.approved_at = timezone.now()
            cs.save()

            quotation.status = QuotationStatus.ACCEPTED
            quotation.save(update_fields=['status'])

            # Reject other quotations
            cs.requisition.quotations.exclude(id=quotation.id).update(status=QuotationStatus.REJECTED)

        return Response({
            'message': f"Quotation {quotation.quotation_number} awarded successfully.",
            'comparative_statement': ComparativeStatementSerializer(cs).data
        })


class ProcurementPurchaseOrderViewSet(viewsets.ModelViewSet):
    """
    Purchase Order management: approval workflows, amendments, and PO issuance.
    Enforces that PO creation does NOT alter inventory.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        qs = PurchaseOrder.objects.all().order_by('-order_date')
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        stat = self.request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier_id')
        supplier = Supplier.objects.filter(id=supplier_id).first()
        if not supplier:
            return Response({'error': 'Valid supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not supplier.is_active:
            return Response({'error': f"Cannot create purchase order for inactive supplier '{supplier.name}'."}, status=status.HTTP_400_BAD_REQUEST)

        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
        branch = Branch.objects.filter(id=data.get('branch_id')).first() or Branch.objects.first()

        req_id = data.get('requisition_id')
        requisition = PurchaseRequisition.objects.filter(id=req_id).first() if req_id else None

        quote_id = data.get('quotation_id')
        quotation = SupplierQuotation.objects.filter(id=quote_id).first() if quote_id else None

        cs_id = data.get('comparative_statement_id')
        cs = ComparativeStatement.objects.filter(id=cs_id).first() if cs_id else None

        po_num = f"PO-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            order_date = data.get('order_date') or timezone.localdate()
            po = PurchaseOrder.objects.create(
                po_number=po_num,
                branch=branch,
                supplier=supplier,
                requisition=requisition,
                quotation=quotation,
                comparative_statement=cs,
                ordered_by=staff,
                order_date=order_date,
                expected_delivery_date=data.get('expected_delivery_date') or None,
                delivery_location=data.get('delivery_location', 'Central Hospital Warehouse'),
                payment_terms=data.get('payment_terms', 'Net 30 Days'),
                status=PurchaseOrderStatus.DRAFT,
                approval_status='PENDING_APPROVAL',
                notes=data.get('notes', ''),
            )

            items_data = data.get('items', [])
            total_sum = Decimal('0.00')
            for item in items_data:
                qty = int(item.get('quantity', 1))
                unit_cost = Decimal(str(item.get('unit_cost', '10.00')))
                subtotal = unit_cost * Decimal(str(qty))
                total_sum += subtotal
                med_id = item.get('medicine_id')
                med = Medicine.objects.filter(id=med_id).first() if med_id else None

                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    medicine=med,
                    item_name=item.get('item_name', med.brand_name if med else 'Hospital Consumable'),
                    quantity=qty,
                    unit_cost=unit_cost,
                    subtotal=subtotal,
                )

            po.subtotal_amount = total_sum
            po.total_amount = total_sum
            po.save(update_fields=['subtotal_amount', 'total_amount'])

            if requisition:
                requisition.status = RequisitionStatus.CONVERTED_TO_PO
                requisition.save(update_fields=['status'])

        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        po = self.get_object()
        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()
        po.approval_status = 'APPROVED'
        po.approved_by = staff
        po.approved_at = timezone.now()
        po.approval_notes = request.data.get('approval_notes', 'Approved by procurement officer')
        po.status = PurchaseOrderStatus.APPROVED
        po.save()
        return Response({'message': f"Purchase Order {po.po_number} approved.", 'approval_status': po.approval_status})

    @action(detail=True, methods=['post'], url_path='issue')
    def issue(self, request, pk=None):
        po = self.get_object()
        if po.approval_status != 'APPROVED':
            return Response({'error': 'Cannot issue unapproved purchase order.'}, status=status.HTTP_400_BAD_REQUEST)
        po.status = PurchaseOrderStatus.ISSUED
        po.save(update_fields=['status'])
        return Response({'message': f"Purchase Order {po.po_number} issued to supplier {po.supplier.name}."})

    @action(detail=True, methods=['post'], url_path='amend')
    def amend(self, request, pk=None):
        po = self.get_object()
        if po.status in [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED]:
            return Response({'error': f"Cannot amend PO in status {po.status}."}, status=status.HTTP_400_BAD_REQUEST)
        
        new_date = request.data.get('expected_delivery_date')
        if new_date:
            po.expected_delivery_date = new_date
        notes = request.data.get('amendment_notes')
        if notes:
            po.notes = f"{po.notes}\n[Amendment {timezone.now().strftime('%Y-%m-%d %H:%M')}]: {notes}"
        po.save()
        return Response({'message': f"Purchase Order {po.po_number} amended successfully."})


class SupplierReturnViewSet(viewsets.ModelViewSet):
    """
    Supplier Returns: Defective/damaged/expired stock returned to vendor.
    Deducts inventory stock atomically with immutable StockMovement and generates Credit Note.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierReturnSerializer

    def get_queryset(self):
        return SupplierReturn.objects.all().order_by('-return_date')

    def create(self, request, *args, **kwargs):
        data = request.data
        supplier_id = data.get('supplier_id')
        supplier = Supplier.objects.filter(id=supplier_id).first()
        if not supplier:
            return Response({'error': 'Valid supplier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        branch = Branch.objects.filter(id=data.get('branch_id')).first() or Branch.objects.first()
        staff = getattr(request.user, 'staff_profile', None) or StaffProfile.objects.first()

        po_id = data.get('purchase_order_id')
        po = PurchaseOrder.objects.filter(id=po_id).first() if po_id else None

        grn_id = data.get('grn_id')
        grn = GoodsReceiptNote.objects.filter(id=grn_id).first() if grn_id else None

        return_num = f"SRET-{uuid.uuid4().hex[:6].upper()}"

        with transaction.atomic():
            s_return = SupplierReturn.objects.create(
                return_number=return_num,
                branch=branch,
                supplier=supplier,
                purchase_order=po,
                grn=grn,
                returned_by=staff,
                return_date=data.get('return_date') or timezone.localdate(),
                reason_type=data.get('reason_type', SupplierReturnReason.DAMAGED),
                reason_details=data.get('reason_details', ''),
                dispatch_tracking_number=data.get('dispatch_tracking_number', f"TRK-{uuid.uuid4().hex[:6].upper()}"),
                status='DISPATCHED',
            )

            items_data = data.get('items', [])
            total_val = Decimal('0.00')

            for item in items_data:
                batch_id = item.get('batch_id')
                batch = MedicineBatch.objects.select_for_update().filter(id=batch_id).first()
                if not batch:
                    return Response({'error': 'Valid stock batch is required for return.'}, status=status.HTTP_400_BAD_REQUEST)

                qty = int(item.get('quantity_returned', 1))
                if qty > batch.quantity_in_stock:
                    return Response({
                        'error': f"Cannot return {qty} units. Only {batch.quantity_in_stock} available in batch {batch.batch_number}."
                    }, status=status.HTTP_400_BAD_REQUEST)

                cost = batch.unit_purchase_cost or Decimal('10.00')
                subtotal = cost * Decimal(str(qty))
                total_val += subtotal

                # Deduct inventory atomically
                prev_stock = batch.quantity_in_stock
                batch.quantity_in_stock -= qty
                batch.save(update_fields=['quantity_in_stock'])

                SupplierReturnItem.objects.create(
                    supplier_return=s_return,
                    medicine=batch.medicine,
                    batch=batch,
                    item_name=batch.medicine.brand_name,
                    quantity_returned=qty,
                    unit_cost=cost,
                    subtotal=subtotal,
                )

                # Record in immutable movement ledger
                StockMovement.objects.create(
                    branch=branch,
                    batch=batch,
                    item_name=batch.medicine.brand_name,
                    batch_reference=batch.batch_number,
                    location_name=batch.location_name,
                    movement_type=MovementType.RETURN,
                    quantity_delta=-qty,
                    previous_stock=prev_stock,
                    new_stock=batch.quantity_in_stock,
                    unit_cost=cost,
                    total_cost=subtotal,
                    reference_document=return_num,
                    recorded_by=staff,
                    remarks=f"Supplier Return to {supplier.name} ({s_return.reason_type}): {s_return.reason_details}",
                )

            s_return.total_return_value = total_val
            s_return.save(update_fields=['total_return_value'])

            # Automatically generate Supplier Credit Note
            cn_num = f"SCN-{uuid.uuid4().hex[:6].upper()}"
            SupplierCreditNote.objects.create(
                credit_note_number=cn_num,
                supplier=supplier,
                branch=branch,
                supplier_return=s_return,
                credit_date=timezone.localdate(),
                total_credit_amount=total_val,
                utilized_amount=Decimal('0.00'),
                remaining_balance=total_val,
                status=CreditNoteStatus.APPROVED,
                reason=f"Credit for Supplier Return {return_num}",
                approved_by=staff,
            )

        return Response(SupplierReturnSerializer(s_return).data, status=status.HTTP_201_CREATED)


class SupplierCreditNoteViewSet(viewsets.ModelViewSet):
    """
    Supplier Credit Notes: Manages vendor credits and application towards Accounts Payable invoices.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierCreditNoteSerializer

    def get_queryset(self):
        qs = SupplierCreditNote.objects.all().order_by('-credit_date')
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs

    @action(detail=True, methods=['post'], url_path='apply-to-invoice')
    def apply_to_invoice(self, request, pk=None):
        cn = self.get_object()
        if cn.remaining_balance <= Decimal('0.00'):
            return Response({'error': 'Credit note has already been fully utilized.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_id = request.data.get('invoice_id')
        invoice = SupplierInvoice.objects.filter(id=invoice_id).first()
        if not invoice:
            return Response({'error': 'Valid supplier invoice required.'}, status=status.HTTP_400_BAD_REQUEST)

        if invoice.supplier_id != cn.supplier_id:
            return Response({'error': 'Credit note supplier does not match invoice supplier.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_outstanding = invoice.total_amount - invoice.paid_amount
        if invoice_outstanding <= Decimal('0.00'):
            return Response({'error': 'Invoice is already fully paid.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            apply_amount = min(cn.remaining_balance, invoice_outstanding)
            cn.utilized_amount += apply_amount
            cn.remaining_balance -= apply_amount
            if cn.remaining_balance == Decimal('0.00'):
                cn.status = CreditNoteStatus.UTILIZED
            else:
                cn.status = CreditNoteStatus.PARTIALLY_UTILIZED
            cn.save()

            invoice.paid_amount += apply_amount
            if invoice.paid_amount >= invoice.total_amount:
                invoice.payment_status = InvoicePaymentStatus.PAID
            else:
                invoice.payment_status = InvoicePaymentStatus.PARTIALLY_PAID
            invoice.save(update_fields=['paid_amount', 'payment_status'])

        return Response({
            'message': f"Applied ₹{apply_amount} from Credit Note {cn.credit_note_number} to Invoice {invoice.invoice_number}.",
            'credit_remaining': str(cn.remaining_balance),
            'invoice_outstanding': str(invoice.total_amount - invoice.paid_amount)
        })


class SupplierPaymentScheduleViewSet(viewsets.ModelViewSet):
    """
    Installment payment scheduling and settlement tracking for Accounts Payable.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SupplierPaymentScheduleSerializer

    def get_queryset(self):
        qs = SupplierPaymentSchedule.objects.all().order_by('scheduled_date')
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        stat = self.request.query_params.get('status')
        if stat:
            qs = qs.filter(status=stat)
        return qs

    def create(self, request, *args, **kwargs):
        data = request.data
        invoice_id = data.get('invoice_id')
        invoice = SupplierInvoice.objects.filter(id=invoice_id).first()
        if not invoice:
            return Response({'error': 'Valid supplier invoice required.'}, status=status.HTTP_400_BAD_REQUEST)

        sched_ref = f"SCH-{uuid.uuid4().hex[:6].upper()}"
        amount = Decimal(str(data.get('scheduled_amount', invoice.total_amount)))

        sched = SupplierPaymentSchedule.objects.create(
            schedule_reference=sched_ref,
            invoice=invoice,
            supplier=invoice.supplier,
            branch=invoice.branch,
            installment_number=int(data.get('installment_number', 1)),
            scheduled_date=data.get('scheduled_date') or invoice.due_date,
            scheduled_amount=amount,
            status=PaymentScheduleStatus.PENDING,
            notes=data.get('notes', ''),
        )
        return Response(SupplierPaymentScheduleSerializer(sched).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='record-settlement')
    def record_settlement(self, request, pk=None):
        sched = self.get_object()
        ref = request.data.get('payment_reference', f"PAY-{uuid.uuid4().hex[:6].upper()}")
        
        with transaction.atomic():
            sched.status = PaymentScheduleStatus.PAID
            sched.paid_amount = sched.scheduled_amount
            sched.payment_reference = ref
            sched.settled_at = timezone.now()
            sched.save()

            # Update supplier invoice
            invoice = sched.invoice
            invoice.paid_amount = min(invoice.total_amount, invoice.paid_amount + sched.scheduled_amount)
            if invoice.paid_amount >= invoice.total_amount:
                invoice.payment_status = InvoicePaymentStatus.PAID
            else:
                invoice.payment_status = InvoicePaymentStatus.PARTIALLY_PAID
            invoice.save(update_fields=['paid_amount', 'payment_status'])

        return Response({
            'message': f"Settlement of ₹{sched.scheduled_amount} recorded under reference {ref}.",
            'schedule_status': sched.status,
            'invoice_payment_status': invoice.payment_status
        })


class SupplierOutstandingBalancesView(APIView):
    """
    Accounts Payable source of truth: Outstanding balances, credits, and aging buckets.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.localdate()
        suppliers = Supplier.objects.all().order_by('name')

        supplier_id = request.query_params.get('supplier_id')
        if supplier_id:
            suppliers = suppliers.filter(id=supplier_id)

        report = []
        grand_invoiced = Decimal('0.00')
        grand_paid = Decimal('0.00')
        grand_credits = Decimal('0.00')
        grand_outstanding = Decimal('0.00')

        for sup in suppliers:
            invoices = sup.invoices.all()
            total_invoiced = invoices.aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')
            total_paid = invoices.aggregate(s=Sum('paid_amount'))['s'] or Decimal('0.00')
            credits_remaining = sup.credit_notes.filter(status__in=[CreditNoteStatus.APPROVED, CreditNoteStatus.PARTIALLY_UTILIZED]).aggregate(s=Sum('remaining_balance'))['s'] or Decimal('0.00')

            net_outstanding = max(Decimal('0.00'), (total_invoiced - total_paid) - credits_remaining)

            # Aging breakdown of unpaid invoices
            unpaid_invoices = invoices.exclude(payment_status=InvoicePaymentStatus.PAID)
            bucket_0_30 = Decimal('0.00')
            bucket_31_60 = Decimal('0.00')
            bucket_61_90 = Decimal('0.00')
            bucket_over_90 = Decimal('0.00')

            for inv in unpaid_invoices:
                balance = inv.total_amount - inv.paid_amount
                days_overdue = (today - inv.due_date).days if inv.due_date else 0
                if days_overdue <= 30:
                    bucket_0_30 += balance
                elif days_overdue <= 60:
                    bucket_31_60 += balance
                elif days_overdue <= 90:
                    bucket_61_90 += balance
                else:
                    bucket_over_90 += balance

            grand_invoiced += total_invoiced
            grand_paid += total_paid
            grand_credits += credits_remaining
            grand_outstanding += net_outstanding

            report.append({
                'supplier_id': str(sup.id),
                'supplier_code': sup.code,
                'supplier_name': sup.name,
                'category': sup.category,
                'payment_terms_days': sup.payment_terms_days,
                'total_invoiced': str(total_invoiced),
                'total_paid': str(total_paid),
                'available_credits': str(credits_remaining),
                'net_outstanding': str(net_outstanding),
                'aging': {
                    'days_0_30': str(bucket_0_30),
                    'days_31_60': str(bucket_31_60),
                    'days_61_90': str(bucket_61_90),
                    'days_over_90': str(bucket_over_90),
                }
            })

        return Response({
            'summary': {
                'total_invoiced': str(grand_invoiced),
                'total_paid': str(grand_paid),
                'total_credits': str(grand_credits),
                'total_outstanding_payable': str(grand_outstanding),
            },
            'suppliers': report
        })


class VendorPerformanceReportView(APIView):
    """
    Traceable Vendor Performance Analytics derived from actual procurement and GRN records.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        suppliers = Supplier.objects.all().order_by('name')
        report = []

        for sup in suppliers:
            pos = sup.purchase_orders.all()
            total_orders = pos.count()
            total_order_value = pos.aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')

            # Deliveries and GRNs
            grns = sup.goods_receipts.all()
            items_received = GoodsReceiptItem.objects.filter(grn__supplier=sup)
            total_accepted_qty = items_received.aggregate(s=Sum('quantity_accepted'))['s'] or 0
            total_rejected_qty = items_received.aggregate(s=Sum('quantity_rejected'))['s'] or 0
            total_physical_received = total_accepted_qty + total_rejected_qty

            rejection_rate_pct = round((total_rejected_qty / total_physical_received * 100), 1) if total_physical_received > 0 else 0.0

            # On-time delivery rate
            completed_pos = pos.filter(status=PurchaseOrderStatus.RECEIVED, expected_delivery_date__isnull=False)
            on_time_count = 0
            for po in completed_pos:
                last_grn = po.goods_receipts.order_date = po.goods_receipts.order_by('-receipt_date').first()
                if last_grn and last_grn.receipt_date.date() <= po.expected_delivery_date:
                    on_time_count += 1
            on_time_delivery_rate = round((on_time_count / completed_pos.count() * 100), 1) if completed_pos.count() > 0 else 100.0

            # Returns
            returns_count = sup.supplier_returns.count()

            report.append({
                'supplier_id': str(sup.id),
                'supplier_code': sup.code,
                'supplier_name': sup.name,
                'category': sup.category,
                'total_purchase_orders': total_orders,
                'total_spend': str(total_order_value),
                'total_accepted_quantity': total_accepted_qty,
                'total_rejected_quantity': total_rejected_qty,
                'rejection_defect_rate_pct': rejection_rate_pct,
                'on_time_delivery_rate_pct': on_time_delivery_rate,
                'supplier_returns_count': returns_count,
            })

        return Response({'performance_reports': report})
