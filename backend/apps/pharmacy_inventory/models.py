import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from apps.core.models import BaseUUIDModel, Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile


class ItemType(models.TextChoices):
    MEDICINE = 'MEDICINE', 'Pharmaceutical Medicine'
    CONSUMABLE = 'CONSUMABLE', 'Hospital Consumable'
    SURGICAL_DRESSING = 'SURGICAL_DRESSING', 'Surgical Dressing / Suture'
    DEVICE = 'DEVICE', 'Medical Device / Disposable'


class MedicineCategory(models.TextChoices):
    ANTIBIOTICS = 'ANTIBIOTICS', 'Antibiotics & Antimicrobials'
    ANALGESICS = 'ANALGESICS', 'Analgesics & Anti-Inflammatory'
    CARDIOVASCULAR = 'CARDIOVASCULAR', 'Cardiovascular & Antihypertensives'
    RESPIRATORY = 'RESPIRATORY', 'Respiratory & Antiasthmatics'
    GASTROINTESTINAL = 'GASTROINTESTINAL', 'Gastrointestinal & Antacids'
    ENDOCRINE = 'ENDOCRINE', 'Endocrine & Antidiabetic'
    PSYCHIATRIC = 'PSYCHIATRIC', 'CNS & Psychiatric'
    IV_FLUIDS = 'IV_FLUIDS', 'IV Infusions & Electrolytes'
    SURGICAL = 'SURGICAL', 'Surgical Consumables & Dressings'
    GENERAL_CONSUMABLE = 'GENERAL_CONSUMABLE', 'General Hospital Consumables'


class DosageForm(models.TextChoices):
    TABLET = 'TABLET', 'Tablet'
    CAPSULE = 'CAPSULE', 'Capsule'
    SYRUP = 'SYRUP', 'Syrup / Oral Liquid'
    INJECTION = 'INJECTION', 'Injection (IV/IM)'
    OINTMENT = 'OINTMENT', 'Ointment / Topical Gel'
    INHALER = 'INHALER', 'Inhaler / Respules'
    DROPS = 'DROPS', 'Drops (Eye/Ear)'
    PIECE = 'PIECE', 'Piece / Unit'
    PACK = 'PACK', 'Pack / Box'


class UnitOfMeasurement(models.TextChoices):
    TABLET = 'TABLET', 'Tablet'
    CAPSULE = 'CAPSULE', 'Capsule'
    VIAL = 'VIAL', 'Vial'
    AMPOULE = 'AMPOULE', 'Ampoule'
    BOTTLE = 'BOTTLE', 'Bottle'
    STRIP = 'STRIP', 'Strip'
    BOX = 'BOX', 'Box'
    PIECE = 'PIECE', 'Piece'
    PACK = 'PACK', 'Pack'
    ROLL = 'ROLL', 'Roll'
    ML = 'ML', 'Milliliter (mL)'


class BatchStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available for Dispensing'
    RESERVED = 'RESERVED', 'Reserved for IPD Order'
    EXPIRED = 'EXPIRED', 'Expired (Quarantined)'
    DAMAGED = 'DAMAGED', 'Damaged / Unusable'
    QUARANTINED = 'QUARANTINED', 'Quality Assurance Quarantine'


class Medicine(BaseUUIDModel):
    """
    Formulary Catalog of Medicines, Consumables, Formulations, and Inventory Thresholds.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    item_type = models.CharField(max_length=30, choices=ItemType.choices, default=ItemType.MEDICINE)
    generic_name = models.CharField(max_length=150, db_index=True)
    brand_name = models.CharField(max_length=150, db_index=True)
    category = models.CharField(max_length=40, choices=MedicineCategory.choices)
    dosage_form = models.CharField(max_length=30, choices=DosageForm.choices, default=DosageForm.TABLET)
    strength = models.CharField(max_length=50, blank=True, help_text="e.g. 500mg, 10ml, 5mg/ml")
    manufacturer = models.CharField(max_length=150, blank=True)
    barcode = models.CharField(max_length=100, blank=True, db_index=True)
    unit_of_measurement = models.CharField(max_length=30, default='STRIP')
    dispensing_unit = models.CharField(max_length=30, default='TABLET')
    standard_purchase_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    standard_selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    reorder_level = models.PositiveIntegerField(default=50, help_text="Minimum threshold for procurement alert")
    min_stock_level = models.PositiveIntegerField(default=20)
    max_stock_level = models.PositiveIntegerField(default=1000)
    lead_time_days = models.PositiveIntegerField(default=3)
    is_prescription_required = models.BooleanField(default=True)
    is_batch_tracked = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    storage_conditions = models.CharField(max_length=100, default='Store below 25°C in a dry place')
    contraindications = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.code:
            import uuid
            self.code = f"MED-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    @property
    def item_code(self):
        return self.code

    @item_code.setter
    def item_code(self, val):
        self.code = val

    @property
    def purchase_cost(self):
        return self.standard_purchase_cost

    @purchase_cost.setter
    def purchase_cost(self, val):
        self.standard_purchase_cost = val

    @property
    def selling_price(self):
        return self.standard_selling_price

    @selling_price.setter
    def selling_price(self, val):
        self.standard_selling_price = val

    @property
    def unit_of_measure(self):
        return self.unit_of_measurement

    @unit_of_measure.setter
    def unit_of_measure(self, val):
        self.unit_of_measurement = val

    class Meta:
        db_table = 'hms_medicines'
        ordering = ['generic_name', 'brand_name']

    def __str__(self):
        return f"{self.brand_name} ({self.generic_name} {self.strength or ''})"


class SupplierCategory(models.TextChoices):
    PHARMACEUTICALS = 'PHARMACEUTICALS', 'Pharmaceuticals & Drugs'
    SURGICAL = 'SURGICAL', 'Surgical & Disposable Supplies'
    LAB_DIAGNOSTICS = 'LAB_DIAGNOSTICS', 'Diagnostic Lab Reagents'
    EQUIPMENT = 'EQUIPMENT', 'Biomedical & Hospital Equipment'
    GENERAL = 'GENERAL', 'General Materials & Consumables'
    SERVICES = 'SERVICES', 'Hospital Maintenance & Services'


class Supplier(BaseUUIDModel):
    """
    Vendors, Medical Distributors, and Pharma Wholesalers.
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=50, choices=SupplierCategory.choices, default=SupplierCategory.PHARMACEUTICALS)
    contact_person = models.CharField(max_length=100)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    gst_or_tax_id = models.CharField(max_length=50, blank=True)
    pan_number = models.CharField(max_length=50, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc = models.CharField(max_length=20, blank=True)
    payment_terms_days = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_suppliers'
        ordering = ['name']

    def __str__(self):
        return f"[{self.code}] {self.name}"


class MedicineBatch(BaseUUIDModel):
    """
    Specific physical batches of medicine/consumables in branch stock with expiry dates.
    """
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='batches')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='medicine_batches')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='medicine_batches')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplied_batches')
    batch_number = models.CharField(max_length=50, db_index=True)
    batch_barcode = models.CharField(max_length=100, blank=True, db_index=True)
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(db_index=True)
    quantity_in_stock = models.IntegerField(default=0)
    unit_purchase_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    unit_selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=25, choices=BatchStatus.choices, default=BatchStatus.AVAILABLE)
    location_name = models.CharField(max_length=100, default='Central Pharmacy')

    class Meta:
        db_table = 'hms_medicine_batches'
        unique_together = ('branch', 'medicine', 'batch_number')
        ordering = ['expiry_date']

    def __str__(self):
        return f"[{self.batch_number}] {self.medicine.brand_name} - Qty: {self.quantity_in_stock} (Exp: {self.expiry_date})"

    @property
    def is_expired(self):
        return self.expiry_date <= timezone.now().date()

    @property
    def storage_location(self):
        return self.location_name

    @storage_location.setter
    def storage_location(self, val):
        self.location_name = val

    @property
    def barcode(self):
        return self.batch_barcode

    @barcode.setter
    def barcode(self, val):
        self.batch_barcode = val


class ProcurementCategory(models.TextChoices):
    MEDICINES = 'MEDICINES', 'Medicines & Pharmaceuticals'
    SURGICAL_SUPPLIES = 'SURGICAL_SUPPLIES', 'Surgical Supplies'
    DIAGNOSTIC_REAGENTS = 'DIAGNOSTIC_REAGENTS', 'Diagnostic Reagents'
    EQUIPMENT = 'EQUIPMENT', 'Equipment'
    GENERAL_MATERIALS = 'GENERAL_MATERIALS', 'General Hospital Materials'


class RequisitionStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted for Review'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved by HOD'
    REJECTED = 'REJECTED', 'Rejected'
    CONVERTED_TO_PO = 'CONVERTED_TO_PO', 'Converted to Purchase Order'
    CANCELLED = 'CANCELLED', 'Cancelled'


class PurchaseRequisition(BaseUUIDModel):
    """
    Internal procurement requests initiated by wards, departments, or pharmacies across 5 categories.
    """
    requisition_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='purchase_requisitions')
    procurement_category = models.CharField(max_length=50, choices=ProcurementCategory.choices, default=ProcurementCategory.MEDICINES)
    requesting_department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_requisitions')
    requesting_location = models.CharField(max_length=100, default='Central Pharmacy')
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='created_requisitions')
    requested_delivery_date = models.DateField(null=True, blank=True)
    urgency = models.CharField(max_length=25, default='ROUTINE')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requisitions')
    approved_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=RequisitionStatus.choices, default=RequisitionStatus.SUBMITTED)
    reason = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    supporting_document = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'hms_purchase_requisitions'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.requisition_number}] {self.procurement_category} - {self.requesting_location} ({self.status})"


class PurchaseRequisitionItem(BaseUUIDModel):
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, null=True, blank=True, related_name='requisition_items')
    item_name = models.CharField(max_length=150, blank=True)
    specifications = models.TextField(blank=True)
    quantity_requested = models.PositiveIntegerField()
    quantity_approved = models.PositiveIntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'hms_purchase_requisition_items'

    @property
    def effective_item_name(self):
        if self.medicine:
            return self.medicine.brand_name
        return self.item_name or 'Unspecified Item'


class QuotationStatus(models.TextChoices):
    RECEIVED = 'RECEIVED', 'Quotation Received'
    UNDER_EVALUATION = 'UNDER_EVALUATION', 'Under Comparative Evaluation'
    ACCEPTED = 'ACCEPTED', 'Quotation Accepted'
    REJECTED = 'REJECTED', 'Quotation Rejected'


class SupplierQuotation(BaseUUIDModel):
    """
    Formal price quotes submitted by suppliers against procurement requisitions.
    """
    quotation_number = models.CharField(max_length=50, unique=True, db_index=True)
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name='quotations')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='quotations')
    quotation_date = models.DateField(default=timezone.localdate)
    valid_until = models.DateField()
    delivery_lead_time_days = models.PositiveIntegerField(default=7)
    payment_terms = models.CharField(max_length=100, default='Net 30 Days')
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=25, choices=QuotationStatus.choices, default=QuotationStatus.RECEIVED)
    document_attachment = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    evaluation_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_supplier_quotations'
        ordering = ['total_amount']

    def __str__(self):
        return f"[{self.quotation_number}] {self.supplier.name} - ₹{self.total_amount} ({self.status})"


class SupplierQuotationItem(BaseUUIDModel):
    quotation = models.ForeignKey(SupplierQuotation, on_delete=models.CASCADE, related_name='items')
    item_name = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    tax_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'hms_supplier_quotation_items'


class ComparativeStatement(BaseUUIDModel):
    """
    Side-by-side comparison of supplier quotes with evaluation justification and award.
    """
    statement_number = models.CharField(max_length=50, unique=True, db_index=True)
    requisition = models.OneToOneField(PurchaseRequisition, on_delete=models.CASCADE, related_name='comparative_statement')
    prepared_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='prepared_comparative_statements')
    prepared_at = models.DateTimeField(default=timezone.now)
    selected_quotation = models.ForeignKey(SupplierQuotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='selected_statements')
    selected_supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_comparatives')
    selection_justification = models.TextField(blank=True)
    is_lowest_bidder_selected = models.BooleanField(default=True)
    approval_status = models.CharField(max_length=25, default='PENDING')  # PENDING, APPROVED, REJECTED
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_comparatives')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_comparative_statements'
        ordering = ['-prepared_at']

    def __str__(self):
        return f"[{self.statement_number}] Req: {self.requisition.requisition_number} ({self.approval_status})"


class PurchaseOrderStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    SUBMITTED = 'SUBMITTED', 'Submitted'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Purchase Approval'
    APPROVED = 'APPROVED', 'Approved'
    ISSUED = 'ISSUED', 'Issued to Supplier'
    PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED', 'Partially Received'
    RECEIVED = 'RECEIVED', 'Goods Received & Stocked'
    CANCELLED = 'CANCELLED', 'Cancelled'
    CLOSED = 'CLOSED', 'Order Closed'


class PurchaseOrder(BaseUUIDModel):
    """
    Procurement Orders for medicines, medical equipment, and consumables across all categories.
    """
    po_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='purchase_orders')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchase_orders')
    requisition = models.ForeignKey(PurchaseRequisition, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    quotation = models.ForeignKey(SupplierQuotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    comparative_statement = models.ForeignKey(ComparativeStatement, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders')
    ordered_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='created_po')
    order_date = models.DateField(default=timezone.localdate)
    expected_delivery_date = models.DateField(null=True, blank=True)
    delivery_location = models.CharField(max_length=150, default='Central Hospital Warehouse')
    payment_terms = models.CharField(max_length=100, default='Net 30 Days')
    status = models.CharField(max_length=25, choices=PurchaseOrderStatus.choices, default=PurchaseOrderStatus.DRAFT)
    approval_status = models.CharField(max_length=25, default='APPROVED')  # DRAFT, PENDING_APPROVAL, APPROVED, REJECTED
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_purchase_orders')
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_purchase_orders'
        ordering = ['-order_date']

    def save(self, *args, **kwargs):
        if hasattr(self.order_date, 'date'):
            self.order_date = self.order_date.date()
        if self.expected_delivery_date and hasattr(self.expected_delivery_date, 'date'):
            self.expected_delivery_date = self.expected_delivery_date.date()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.po_number}] {self.supplier.name} - ₹{self.total_amount} ({self.status})"


class PurchaseOrderItem(BaseUUIDModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, null=True, blank=True, related_name='po_items')
    item_name = models.CharField(max_length=150)
    quantity = models.PositiveIntegerField()
    quantity_received = models.PositiveIntegerField(default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'hms_purchase_order_items'


class GoodsReceiptNote(BaseUUIDModel):
    """
    Physical inspection and receipt document against Purchase Orders or direct deliveries.
    """
    grn_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='goods_receipts')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='goods_receipts')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='goods_receipts')
    delivery_challan_number = models.CharField(max_length=100, blank=True)
    received_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='received_grns')
    receipt_date = models.DateTimeField(default=timezone.now)
    total_received_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_goods_receipt_notes'
        ordering = ['-receipt_date']

    def __str__(self):
        return f"[{self.grn_number}] {self.supplier.name} - ₹{self.total_received_value}"


class GoodsReceiptItem(BaseUUIDModel):
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name='grn_items')
    po_item = models.ForeignKey(PurchaseOrderItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_grn_items')
    quantity_received = models.PositiveIntegerField()
    quantity_accepted = models.PositiveIntegerField()
    quantity_rejected = models.PositiveIntegerField(default=0)
    rejection_reason = models.CharField(max_length=200, blank=True)
    batch_number = models.CharField(max_length=50)
    manufacturing_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField()
    unit_purchase_cost = models.DecimalField(max_digits=10, decimal_places=2)
    unit_selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_batch = models.ForeignKey(MedicineBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='originating_grn_items')

    class Meta:
        db_table = 'hms_goods_receipt_items'


class InvoicePaymentStatus(models.TextChoices):
    UNPAID = 'UNPAID', 'Unpaid (Pending Settlement)'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Fully Paid'


class SupplierInvoice(BaseUUIDModel):
    """
    Accounts Payable Supplier Invoices matched with PO and GRN.
    """
    invoice_number = models.CharField(max_length=100, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='invoices')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='supplier_invoices')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoices')
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_invoices')
    invoice_date = models.DateField()
    due_date = models.DateField()
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_status = models.CharField(max_length=25, choices=InvoicePaymentStatus.choices, default=InvoicePaymentStatus.UNPAID)
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_supplier_invoices')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_supplier_invoices'
        unique_together = ('supplier', 'invoice_number')
        ordering = ['-invoice_date']

    def __str__(self):
        return f"[{self.invoice_number}] {self.supplier.name} - ₹{self.total_amount} ({self.payment_status})"


class SupplierReturnReason(models.TextChoices):
    DAMAGED = 'DAMAGED', 'Damaged Packaging / Broken Vials'
    DEFECTIVE = 'DEFECTIVE', 'Defective Quality / Failed QC'
    EXPIRED = 'EXPIRED', 'Received Near-Expiry / Expired'
    WRONG_ITEM = 'WRONG_ITEM', 'Incorrect Specification / Mismatch'
    RECALLED = 'RECALLED', 'Manufacturer Safety Recall'


class SupplierReturn(BaseUUIDModel):
    """
    Physical returns of defective, expired, or rejected goods back to the supplier with inventory deduction.
    """
    return_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='supplier_returns')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='supplier_returns')
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_returns')
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='supplier_returns')
    returned_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='processed_supplier_returns')
    return_date = models.DateField(default=timezone.localdate)
    reason_type = models.CharField(max_length=30, choices=SupplierReturnReason.choices, default=SupplierReturnReason.DAMAGED)
    reason_details = models.TextField(blank=True)
    dispatch_tracking_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=25, default='DISPATCHED')  # DRAFT, DISPATCHED, ACKNOWLEDGED, CREDIT_ISSUED
    total_return_value = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    class Meta:
        db_table = 'hms_supplier_returns'
        ordering = ['-return_date']

    def __str__(self):
        return f"[{self.return_number}] {self.supplier.name} - ₹{self.total_return_value} ({self.status})"


class SupplierReturnItem(BaseUUIDModel):
    supplier_return = models.ForeignKey(SupplierReturn, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, null=True, blank=True, related_name='supplier_return_items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, null=True, blank=True, related_name='supplier_return_items')
    item_name = models.CharField(max_length=150)
    quantity_returned = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = 'hms_supplier_return_items'


class CreditNoteStatus(models.TextChoices):
    APPROVED = 'APPROVED', 'Approved & Available'
    UTILIZED = 'UTILIZED', 'Fully Utilized'
    PARTIALLY_UTILIZED = 'PARTIALLY_UTILIZED', 'Partially Utilized'
    CANCELLED = 'CANCELLED', 'Cancelled'


class SupplierCreditNote(BaseUUIDModel):
    """
    Supplier Credit Notes reducing Accounts Payable obligations.
    """
    credit_note_number = models.CharField(max_length=50, unique=True, db_index=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='credit_notes')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='supplier_credit_notes')
    supplier_return = models.ForeignKey(SupplierReturn, on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_notes')
    original_invoice = models.ForeignKey(SupplierInvoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='credit_notes')
    credit_date = models.DateField(default=timezone.localdate)
    total_credit_amount = models.DecimalField(max_digits=12, decimal_places=2)
    utilized_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    remaining_balance = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=25, choices=CreditNoteStatus.choices, default=CreditNoteStatus.APPROVED)
    reason = models.TextField(blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_credit_notes')

    class Meta:
        db_table = 'hms_supplier_credit_notes'
        ordering = ['-credit_date']

    def __str__(self):
        return f"[{self.credit_note_number}] {self.supplier.name} - ₹{self.total_credit_amount} (Remaining: ₹{self.remaining_balance})"


class PaymentScheduleStatus(models.TextChoices):
    PENDING = 'PENDING', 'Scheduled (Pending Due Date)'
    DUE = 'DUE', 'Due for Payment'
    PAID = 'PAID', 'Settled & Paid'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'


class SupplierPaymentSchedule(BaseUUIDModel):
    """
    Installment payment schedules linked to verified supplier invoices.
    """
    schedule_reference = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(SupplierInvoice, on_delete=models.CASCADE, related_name='payment_schedules')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='payment_schedules')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='supplier_payment_schedules')
    installment_number = models.PositiveIntegerField(default=1)
    scheduled_date = models.DateField()
    scheduled_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=25, choices=PaymentScheduleStatus.choices, default=PaymentScheduleStatus.PENDING)
    payment_reference = models.CharField(max_length=100, blank=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_supplier_payment_schedules'
        ordering = ['scheduled_date']

    def __str__(self):
        return f"[{self.schedule_reference}] Inst #{self.installment_number}: ₹{self.scheduled_amount} on {self.scheduled_date} ({self.status})"



class Prescription(BaseUUIDModel):
    """
    Doctor's Electronic Medical Prescription for OPD/IPD Patient.
    """
    prescription_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='prescriptions')
    doctor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='issued_prescriptions')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='prescriptions')
    appointment = models.ForeignKey('clinical.Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='prescriptions')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='prescriptions')
    diagnosis = models.TextField()
    clinical_notes = models.TextField(blank=True)
    is_dispensed = models.BooleanField(default=False)

    class Meta:
        db_table = 'hms_prescriptions'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.prescription_number}] Dr. {self.doctor.user_profile.last_name} -> {self.patient.user_profile.full_name}"


class PrescriptionItem(BaseUUIDModel):
    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name='prescription_items')
    dosage = models.CharField(max_length=50, help_text="e.g. 1 Tablet")
    frequency = models.CharField(max_length=50, help_text="e.g. 1-0-1 (After Food)")
    duration_days = models.PositiveIntegerField(default=5)
    total_quantity = models.PositiveIntegerField(default=10)
    dispensed_quantity = models.PositiveIntegerField(default=0)
    instructions = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_prescription_items'


class DispenseRecord(BaseUUIDModel):
    """
    Audited dispensing records at the pharmacy counter with batch deduction and billing sync.
    """
    dispense_number = models.CharField(max_length=50, unique=True, db_index=True)
    prescription = models.ForeignKey(Prescription, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispensations')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='dispensed_medications')
    pharmacist = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='dispensations')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='dispensations')
    dispensed_at = models.DateTimeField(default=timezone.now)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    payment_status = models.CharField(max_length=20, default='PAID')
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='pharmacy_dispensations')
    is_ipd_issue = models.BooleanField(default=False)
    ward_location = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'hms_dispense_records'
        ordering = ['-dispensed_at']


class DispenseItem(BaseUUIDModel):
    dispense_record = models.ForeignKey(DispenseRecord, on_delete=models.CASCADE, related_name='items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, related_name='dispensed_items')
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'hms_dispense_items'


class TransferStatus(models.TextChoices):
    REQUESTED = 'REQUESTED', 'Transfer Requested'
    APPROVED = 'APPROVED', 'Approved by Pharmacist'
    DISPATCHED = 'DISPATCHED', 'Dispatched (In Transit)'
    RECEIVED = 'RECEIVED', 'Received at Destination'
    CANCELLED = 'CANCELLED', 'Cancelled'


class StockTransfer(BaseUUIDModel):
    """
    Stock movements between pharmacies, wards, and departmental drug lockers.
    """
    transfer_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='stock_transfers')
    source_location = models.CharField(max_length=100, default='Central Pharmacy')
    destination_location = models.CharField(max_length=100)
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='requested_transfers')
    dispatched_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='dispatched_transfers')
    dispatched_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_transfers')
    received_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=TransferStatus.choices, default=TransferStatus.REQUESTED)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_stock_transfers'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.transfer_number}] {self.source_location} -> {self.destination_location} ({self.status})"


class StockTransferItem(BaseUUIDModel):
    transfer = models.ForeignKey(StockTransfer, on_delete=models.CASCADE, related_name='items')
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name='transfer_items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, related_name='transfer_items')
    quantity = models.PositiveIntegerField()

    class Meta:
        db_table = 'hms_stock_transfer_items'


class AdjustmentType(models.TextChoices):
    DAMAGE_WRITEOFF = 'DAMAGE_WRITEOFF', 'Damaged / Contaminated Stock Write-off'
    EXPIRY_QUARANTINE = 'EXPIRY_QUARANTINE', 'Expired Stock Quarantine'
    PHYSICAL_COUNT_CORRECTION = 'PHYSICAL_COUNT_CORRECTION', 'Physical Inventory Count Adjustment'
    INITIAL_STOCK = 'INITIAL_STOCK', 'Opening Stock Balance'
    OTHER = 'OTHER', 'Other Discrepancy Correction'


class StockAdjustment(BaseUUIDModel):
    """
    Justified and audited balance corrections with management approval.
    """
    adjustment_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='stock_adjustments_hdr')
    location_name = models.CharField(max_length=100, default='Central Pharmacy')
    adjustment_type = models.CharField(max_length=35, choices=AdjustmentType.choices)
    adjusted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='created_adjustments')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_stock_adjustments')
    approved_at = models.DateTimeField(null=True, blank=True)
    is_posted = models.BooleanField(default=False)
    reason = models.TextField()

    class Meta:
        db_table = 'hms_stock_adjustments'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.adjustment_number}] {self.adjustment_type} - {self.location_name}"


class StockAdjustmentItem(BaseUUIDModel):
    adjustment = models.ForeignKey(StockAdjustment, on_delete=models.CASCADE, related_name='items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, related_name='adjustment_items')
    previous_stock = models.IntegerField()
    quantity_delta = models.IntegerField(help_text="Positive for addition, negative for write-off")
    new_stock = models.IntegerField()

    class Meta:
        db_table = 'hms_stock_adjustment_items'


class ReturnType(models.TextChoices):
    PATIENT_RETURN = 'PATIENT_RETURN', 'Unused Patient Return (Refund)'
    SUPPLIER_RETURN = 'SUPPLIER_RETURN', 'Defective / Near-Expiry Supplier Return'
    WARD_RETURN = 'WARD_RETURN', 'Unconsumed Ward Stock Return'


class PharmacyReturn(BaseUUIDModel):
    """
    Medication and consumable returns from patients, wards, or back to vendors.
    """
    return_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='pharmacy_returns')
    return_type = models.CharField(max_length=30, choices=ReturnType.choices)
    patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='pharmacy_returns')
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='pharmacy_returns')
    processed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='processed_returns')
    total_refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_restocked = models.BooleanField(default=False)
    reason = models.TextField()

    class Meta:
        db_table = 'hms_pharmacy_returns'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.return_number}] {self.return_type} - ₹{self.total_refund_amount}"


class PharmacyReturnItem(BaseUUIDModel):
    return_record = models.ForeignKey(PharmacyReturn, on_delete=models.CASCADE, related_name='items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, related_name='return_items')
    quantity = models.PositiveIntegerField()
    unit_refund_price = models.DecimalField(max_digits=10, decimal_places=2)
    is_usable = models.BooleanField(default=False, help_text="Only unopened, uncompromised stock can be returned to active inventory")

    class Meta:
        db_table = 'hms_pharmacy_return_items'


class ReconciliationStatus(models.TextChoices):
    IN_PROGRESS = 'IN_PROGRESS', 'Count in Progress'
    SUBMITTED = 'SUBMITTED', 'Submitted for Variance Review'
    APPROVED_AND_POSTED = 'APPROVED_AND_POSTED', 'Approved & Posted to Stock Ledger'
    CANCELLED = 'CANCELLED', 'Cancelled'


class StockReconciliation(BaseUUIDModel):
    """
    Periodic physical inventory count reconciliation against ledger balances.
    """
    reconciliation_number = models.CharField(max_length=50, unique=True, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='stock_reconciliations')
    location_name = models.CharField(max_length=100, default='Central Pharmacy')
    conducted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='conducted_reconciliations')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_reconciliations')
    approved_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=ReconciliationStatus.choices, default=ReconciliationStatus.IN_PROGRESS)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_stock_reconciliations'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.reconciliation_number}] {self.location_name} ({self.status})"


class StockReconciliationItem(BaseUUIDModel):
    reconciliation = models.ForeignKey(StockReconciliation, on_delete=models.CASCADE, related_name='items')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.PROTECT, related_name='reconciliation_items')
    book_quantity = models.IntegerField()
    counted_quantity = models.IntegerField()
    discrepancy_quantity = models.IntegerField()
    discrepancy_reason = models.CharField(max_length=200, blank=True)

    @property
    def variance_quantity(self):
        return self.discrepancy_quantity

    @variance_quantity.setter
    def variance_quantity(self, val):
        self.discrepancy_quantity = val

    @property
    def physical_quantity(self):
        return self.counted_quantity

    @physical_quantity.setter
    def physical_quantity(self, val):
        self.counted_quantity = val

    class Meta:
        db_table = 'hms_stock_reconciliation_items'


class MovementType(models.TextChoices):
    PURCHASE_RECEIPT = 'PURCHASE_RECEIPT', 'Purchase GRN Receipt'
    DISPENSE = 'DISPENSE', 'Patient Dispensation'
    IPD_ISSUE = 'IPD_ISSUE', 'Inpatient Ward Medication Issue'
    TRANSFER_IN = 'TRANSFER_IN', 'Location Transfer In'
    TRANSFER_OUT = 'TRANSFER_OUT', 'Location Transfer Out'
    ADJUSTMENT_DAMAGE = 'ADJUSTMENT_DAMAGE', 'Damaged / Expired Write-off'
    RETURN = 'RETURN', 'Supplier / Patient Return'
    RECONCILIATION = 'RECONCILIATION', 'Physical Count Reconciliation'
    OPENING_STOCK = 'OPENING_STOCK', 'Opening Stock Balance'


class StockMovement(BaseUUIDModel):
    """
    Immutable ledger of all physical inventory stock changes with before/after balances.
    """
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='stock_movements')
    batch = models.ForeignKey(MedicineBatch, on_delete=models.SET_NULL, null=True, blank=True, related_name='stock_movements')
    item_name = models.CharField(max_length=150)
    batch_reference = models.CharField(max_length=50, blank=True)
    location_name = models.CharField(max_length=100, default='Central Pharmacy')
    movement_type = models.CharField(max_length=30, choices=MovementType.choices)
    quantity_delta = models.IntegerField(help_text="Positive for addition, negative for deduction")
    previous_stock = models.IntegerField()
    new_stock = models.IntegerField()
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    reference_document = models.CharField(max_length=100, blank=True)
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='stock_adjustments')
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_stock_movements'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.movement_type}] {self.item_name} ({self.quantity_delta}) -> Bal: {self.new_stock}"


class AssetCategory(models.TextChoices):
    BIOMEDICAL = 'BIOMEDICAL', 'Biomedical / Diagnostic Equipment'
    SURGICAL = 'SURGICAL', 'OT / Surgical Equipment'
    IT_HARDWARE = 'IT_HARDWARE', 'IT & Infrastructure'
    FACILITY = 'FACILITY', 'Facility & Power Backup'


class HospitalAsset(BaseUUIDModel):
    """
    Hospital Capital Assets, tags, warranty, and maintenance tracking.
    """
    asset_tag = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=AssetCategory.choices)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='assets')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='assets')
    serial_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField()
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2)
    warranty_expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=25, default='OPERATIONAL')  # OPERATIONAL, MAINTENANCE, DECOMMISSIONED
    last_serviced_date = models.DateField(null=True, blank=True)
    next_service_due = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'hms_hospital_assets'
        ordering = ['name']

    def __str__(self):
        return f"[{self.asset_tag}] {self.name} ({self.get_category_display()})"


class AssetMaintenanceLog(BaseUUIDModel):
    asset = models.ForeignKey(HospitalAsset, on_delete=models.CASCADE, related_name='maintenance_logs')
    service_type = models.CharField(max_length=50, default='PREVENTIVE')  # PREVENTIVE, BREAKDOWN, CALIBRATION
    performed_by = models.CharField(max_length=150)
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    service_date = models.DateField(default=timezone.now)
    findings = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_asset_maintenance_logs'
        ordering = ['-service_date']
