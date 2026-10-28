from rest_framework import serializers
from .models import (
    Medicine, MedicineBatch, Prescription, PrescriptionItem,
    DispenseRecord, DispenseItem, Supplier, PurchaseOrder,
    PurchaseOrderItem, StockMovement, HospitalAsset, AssetMaintenanceLog,
    PurchaseRequisition, PurchaseRequisitionItem, GoodsReceiptNote,
    GoodsReceiptItem, SupplierInvoice, StockTransfer, StockTransferItem,
    StockAdjustment, StockAdjustmentItem, PharmacyReturn, PharmacyReturnItem,
    StockReconciliation, StockReconciliationItem,
    SupplierQuotation, SupplierQuotationItem, ComparativeStatement,
    SupplierReturn, SupplierReturnItem, SupplierCreditNote, SupplierPaymentSchedule
)


class MedicineBatchSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    generic_name = serializers.CharField(source='medicine.generic_name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = MedicineBatch
        fields = '__all__'


class MedicineSerializer(serializers.ModelSerializer):
    batches = MedicineBatchSerializer(many=True, read_only=True)
    code = serializers.CharField(required=False)
    item_code = serializers.CharField(source='code', required=False)
    purchase_cost = serializers.DecimalField(source='standard_purchase_cost', max_digits=10, decimal_places=2, required=False)
    selling_price = serializers.DecimalField(source='standard_selling_price', max_digits=10, decimal_places=2, required=False)
    unit_of_measure = serializers.CharField(source='unit_of_measurement', required=False)
    total_stock = serializers.SerializerMethodField()
    usable_stock = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    class Meta:
        model = Medicine
        fields = '__all__'

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'item_code' in data and 'code' not in data:
            data['code'] = data['item_code']
        if 'purchase_cost' in data and 'standard_purchase_cost' not in data:
            data['standard_purchase_cost'] = data['purchase_cost']
        if 'selling_price' in data and 'standard_selling_price' not in data:
            data['standard_selling_price'] = data['selling_price']
        if 'unit_of_measure' in data and 'unit_of_measurement' not in data:
            data['unit_of_measurement'] = data['unit_of_measure']
        return super().to_internal_value(data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['item_code'] = instance.code
        ret['purchase_cost'] = str(instance.standard_purchase_cost)
        ret['selling_price'] = str(instance.standard_selling_price)
        ret['unit_of_measure'] = instance.unit_of_measurement
        return ret

    def create(self, validated_data):
        import uuid
        if not validated_data.get('code'):
            validated_data['code'] = f"MED-{uuid.uuid4().hex[:6].upper()}"
        return super().create(validated_data)

    def get_total_stock(self, obj):
        return sum(b.quantity_in_stock for b in obj.batches.all())

    def get_usable_stock(self, obj):
        return sum(
            b.quantity_in_stock for b in obj.batches.all()
            if b.status == 'AVAILABLE' and not b.is_expired
        )

    def get_is_low_stock(self, obj):
        usable = self.get_usable_stock(obj)
        return usable <= obj.min_stock_level


class PrescriptionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    generic_name = serializers.CharField(source='medicine.generic_name', read_only=True)
    dosage_form = serializers.CharField(source='medicine.dosage_form', read_only=True)
    strength = serializers.CharField(source='medicine.strength', read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = '__all__'


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user_profile.full_name', read_only=True)
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = '__all__'


class DispenseItemSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    medicine_name = serializers.CharField(source='batch.medicine.brand_name', read_only=True)
    generic_name = serializers.CharField(source='batch.medicine.generic_name', read_only=True)

    class Meta:
        model = DispenseItem
        fields = '__all__'


class DispenseRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    patient_mrn = serializers.CharField(source='patient.medical_record_number', read_only=True)
    pharmacist_name = serializers.CharField(source='pharmacist.user_profile.full_name', read_only=True)
    items = DispenseItemSerializer(many=True, read_only=True)

    class Meta:
        model = DispenseRecord
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class PurchaseRequisitionItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    generic_name = serializers.CharField(source='medicine.generic_name', read_only=True)
    item_code = serializers.CharField(source='medicine.code', read_only=True)
    effective_name = serializers.CharField(source='effective_item_name', read_only=True)

    class Meta:
        model = PurchaseRequisitionItem
        fields = '__all__'


class PurchaseRequisitionSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    department_name = serializers.CharField(source='requesting_department.name', read_only=True)
    items = PurchaseRequisitionItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseRequisition
        fields = '__all__'


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    ordered_by_name = serializers.CharField(source='ordered_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    quotation_number = serializers.CharField(source='quotation.quotation_number', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    order_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'

    def get_order_date(self, obj):
        if hasattr(obj.order_date, 'strftime'):
            return obj.order_date.strftime('%Y-%m-%d')
        return str(obj.order_date)


class GoodsReceiptItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    generic_name = serializers.CharField(source='medicine.generic_name', read_only=True)

    class Meta:
        model = GoodsReceiptItem
        fields = '__all__'


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.user_profile.full_name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    items = GoodsReceiptItemSerializer(many=True, read_only=True)

    class Meta:
        model = GoodsReceiptNote
        fields = '__all__'


class SupplierInvoiceSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    grn_number = serializers.CharField(source='grn.grn_number', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)

    class Meta:
        model = SupplierInvoice
        fields = '__all__'


class StockTransferItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)

    class Meta:
        model = StockTransferItem
        fields = '__all__'


class StockTransferSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)
    dispatched_by_name = serializers.CharField(source='dispatched_by.user_profile.full_name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.user_profile.full_name', read_only=True)
    items = StockTransferItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockTransfer
        fields = '__all__'


class StockAdjustmentItemSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    medicine_name = serializers.CharField(source='batch.medicine.brand_name', read_only=True)

    class Meta:
        model = StockAdjustmentItem
        fields = '__all__'


class StockAdjustmentSerializer(serializers.ModelSerializer):
    adjusted_by_name = serializers.CharField(source='adjusted_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    items = StockAdjustmentItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockAdjustment
        fields = '__all__'


class PharmacyReturnItemSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    medicine_name = serializers.CharField(source='batch.medicine.brand_name', read_only=True)

    class Meta:
        model = PharmacyReturnItem
        fields = '__all__'


class PharmacyReturnSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user_profile.full_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    processed_by_name = serializers.CharField(source='processed_by.user_profile.full_name', read_only=True)
    items = PharmacyReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = PharmacyReturn
        fields = '__all__'


class StockReconciliationItemSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    medicine_name = serializers.CharField(source='batch.medicine.brand_name', read_only=True)
    variance_quantity = serializers.IntegerField(source='discrepancy_quantity', read_only=True)
    physical_quantity = serializers.IntegerField(source='counted_quantity', read_only=True)

    class Meta:
        model = StockReconciliationItem
        fields = '__all__'


class StockReconciliationSerializer(serializers.ModelSerializer):
    conducted_by_name = serializers.CharField(source='conducted_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    items = StockReconciliationItemSerializer(many=True, read_only=True)

    class Meta:
        model = StockReconciliation
        fields = '__all__'


class StockMovementSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = StockMovement
        fields = '__all__'


class AssetMaintenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetMaintenanceLog
        fields = '__all__'


class HospitalAssetSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    maintenance_logs = AssetMaintenanceLogSerializer(many=True, read_only=True)

    class Meta:
        model = HospitalAsset
        fields = '__all__'


class SupplierQuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierQuotationItem
        fields = '__all__'


class SupplierQuotationSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_code = serializers.CharField(source='supplier.code', read_only=True)
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True)
    items = SupplierQuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierQuotation
        fields = '__all__'


class ComparativeStatementSerializer(serializers.ModelSerializer):
    requisition_number = serializers.CharField(source='requisition.requisition_number', read_only=True)
    procurement_category = serializers.CharField(source='requisition.procurement_category', read_only=True)
    prepared_by_name = serializers.CharField(source='prepared_by.user_profile.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)
    selected_quotation_number = serializers.CharField(source='selected_quotation.quotation_number', read_only=True)
    selected_supplier_name = serializers.CharField(source='selected_supplier.name', read_only=True)
    quotations = serializers.SerializerMethodField()

    class Meta:
        model = ComparativeStatement
        fields = '__all__'

    def get_quotations(self, obj):
        quotes = obj.requisition.quotations.all()
        return SupplierQuotationSerializer(quotes, many=True).data


class SupplierReturnItemSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    medicine_name = serializers.CharField(source='medicine.brand_name', read_only=True)

    class Meta:
        model = SupplierReturnItem
        fields = '__all__'


class SupplierReturnSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    grn_number = serializers.CharField(source='grn.grn_number', read_only=True)
    returned_by_name = serializers.CharField(source='returned_by.user_profile.full_name', read_only=True)
    items = SupplierReturnItemSerializer(many=True, read_only=True)

    class Meta:
        model = SupplierReturn
        fields = '__all__'


class SupplierCreditNoteSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    invoice_number = serializers.CharField(source='original_invoice.invoice_number', read_only=True)
    return_number = serializers.CharField(source='supplier_return.return_number', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.user_profile.full_name', read_only=True)

    class Meta:
        model = SupplierCreditNote
        fields = '__all__'


class SupplierPaymentScheduleSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    invoice_total = serializers.DecimalField(source='invoice.total_amount', max_digits=12, decimal_places=2, read_only=True)
    invoice_due_date = serializers.DateField(source='invoice.due_date', read_only=True)

    class Meta:
        model = SupplierPaymentSchedule
        fields = '__all__'

