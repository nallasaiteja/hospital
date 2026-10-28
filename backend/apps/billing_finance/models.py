import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.core.models import BaseUUIDModel, Branch, Department
from apps.authentication.models import PatientProfile, StaffProfile


class ServiceCategory(models.TextChoices):
    OPD_CONSULTATION = 'OPD_CONSULTATION', 'Doctor Consultation (OPD)'
    IPD_ROOM_BED = 'IPD_ROOM_BED', 'Inpatient Room & Bed Charges'
    DIAGNOSTIC_LAB = 'DIAGNOSTIC_LAB', 'Clinical Diagnostic Laboratory'
    RADIOLOGY_IMAGING = 'RADIOLOGY_IMAGING', 'Radiology & Medical Imaging'
    PHARMACY = 'PHARMACY', 'Pharmacy Dispensation'
    SURGERY_PROCEDURE = 'SURGERY_PROCEDURE', 'Surgical OT & Clinical Procedure'
    ICU_CARE = 'ICU_CARE', 'Intensive Care Unit (ICU)'
    EMERGENCY = 'EMERGENCY', 'Emergency Casualty & Triage'
    NURSING = 'NURSING', 'Nursing & Clinical Care'
    GENERAL_SERVICE = 'GENERAL_SERVICE', 'General Hospital Materials & Services'


class HospitalService(BaseUUIDModel):
    """
    Centralized Hospital Service Catalogue with standard rates, departments, and active statuses.
    """
    service_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=35, choices=ServiceCategory.choices, default=ServiceCategory.GENERAL_SERVICE)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='hospital_services')
    description = models.TextField(blank=True)
    standard_price = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))  # GST/Tax percentage
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(default=timezone.localdate)

    class Meta:
        db_table = 'hms_hospital_services'
        ordering = ['category', 'name']

    def __str__(self):
        return f"[{self.service_code}] {self.name} - ₹{self.standard_price}"


class TariffType(models.TextChoices):
    STANDARD = 'STANDARD', 'Standard Hospital Tariff'
    INSURANCE = 'INSURANCE', 'TPA / Insurance Empanelled Tariff'
    PATIENT_SPECIFIC = 'PATIENT_SPECIFIC', 'Patient-Specific Concession Tariff'
    CORPORATE = 'CORPORATE', 'Corporate / Institutional Tariff'


class TariffPlan(BaseUUIDModel):
    """
    Price Lists and Tariffs for multi-tier pricing (Standard, Insurance, Patient-Specific).
    """
    code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    tariff_type = models.CharField(max_length=30, choices=TariffType.choices, default=TariffType.STANDARD)
    insurance_provider = models.ForeignKey('InsuranceProvider', on_delete=models.SET_NULL, null=True, blank=True, related_name='tariff_plans')
    patient = models.ForeignKey(PatientProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='custom_tariffs')
    priority = models.PositiveIntegerField(default=10, help_text="Lower number indicates higher priority in resolution")
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(default=timezone.localdate)
    effective_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'hms_tariff_plans'
        ordering = ['priority', 'name']

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.tariff_type})"


class TariffRate(BaseUUIDModel):
    """
    Service-specific price override for a given tariff plan.
    """
    tariff_plan = models.ForeignKey(TariffPlan, on_delete=models.CASCADE, related_name='rates')
    service = models.ForeignKey(HospitalService, on_delete=models.CASCADE, related_name='tariff_rates')
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    effective_from = models.DateField(default=timezone.localdate)
    effective_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'hms_tariff_rates'
        unique_together = ('tariff_plan', 'service')

    def __str__(self):
        return f"{self.tariff_plan.name} -> {self.service.name}: ₹{self.rate}"


class HospitalPackage(BaseUUIDModel):
    """
    Configurable Hospital Care Bundles (e.g., Normal Delivery, Knee Replacement, Executive Health Checkup).
    """
    package_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='packages')
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    validity_days = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_hospital_packages'
        ordering = ['name']

    def __str__(self):
        return f"[{self.package_code}] {self.name} - ₹{self.total_price}"


class PackageComponent(BaseUUIDModel):
    """
    Included service item and allowable quantity under a hospital package bundle.
    """
    package = models.ForeignKey(HospitalPackage, on_delete=models.CASCADE, related_name='components')
    service = models.ForeignKey(HospitalService, on_delete=models.CASCADE, related_name='package_memberships')
    quantity_included = models.PositiveIntegerField(default=1)
    unit_price_allocation = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'hms_package_components'
        unique_together = ('package', 'service')

    def __str__(self):
        return f"{self.package.name} -> {self.service.name} (Qty: {self.quantity_included})"


class PackageSubscriptionStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active & Usable'
    EXHAUSTED = 'EXHAUSTED', 'All Included Services Consumed'
    EXPIRED = 'EXPIRED', 'Package Expired'
    CANCELLED = 'CANCELLED', 'Package Cancelled'


class PatientPackageSubscription(BaseUUIDModel):
    """
    Patient assignment of a care bundle for an encounter or admission.
    """
    subscription_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='package_subscriptions')
    package = models.ForeignKey(HospitalPackage, on_delete=models.PROTECT, related_name='patient_subscriptions')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='package_subscriptions')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='package_subscriptions')
    appointment = models.ForeignKey('clinical.Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='package_subscriptions')
    invoice = models.ForeignKey('Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='package_subscriptions')
    subscribed_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=25, choices=PackageSubscriptionStatus.choices, default=PackageSubscriptionStatus.ACTIVE)

    class Meta:
        db_table = 'hms_patient_package_subscriptions'
        ordering = ['-subscribed_at']

    def __str__(self):
        return f"[{self.subscription_number}] {self.patient.user_profile.full_name} - {self.package.name} ({self.status})"


class PackageUsageLog(BaseUUIDModel):
    """
    Tracks consumption of included services under an assigned package.
    """
    subscription = models.ForeignKey(PatientPackageSubscription, on_delete=models.CASCADE, related_name='usage_logs')
    service = models.ForeignKey(HospitalService, on_delete=models.PROTECT, related_name='package_usages')
    quantity_consumed = models.PositiveIntegerField(default=1)
    consumed_at = models.DateTimeField(default=timezone.now)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'hms_package_usage_logs'
        ordering = ['-consumed_at']


class InvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    ISSUED = 'ISSUED', 'Issued / Outstanding'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Fully Paid'
    REFUNDED = 'REFUNDED', 'Refunded'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Invoice(BaseUUIDModel):
    """
    Patient Invoices aggregating consultations, bed charges, pharmacy, lab tests, and procedures.
    """
    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='invoices')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='invoices')
    encounter_type = models.CharField(max_length=30, default='GENERAL')  # OPD, IPD, EMERGENCY, DIAGNOSTIC, PHARMACY, GENERAL
    appointment = models.ForeignKey('clinical.Appointment', on_delete=models.SET_NULL, null=True, blank=True, related_name='billing_invoices')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='billing_invoices')
    emergency_encounter = models.ForeignKey('clinical.EmergencyEncounter', on_delete=models.SET_NULL, null=True, blank=True, related_name='billing_invoices')
    tariff_plan = models.ForeignKey(TariffPlan, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    package_subscription = models.ForeignKey(PatientPackageSubscription, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    is_interim = models.BooleanField(default=False, help_text="Running interim bill for ongoing IPD stay")
    is_final = models.BooleanField(default=False, help_text="Final discharge settlement bill")
    invoice_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    approved_discount_reason = models.TextField(blank=True)
    discount_approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_discounts')
    discount_approved_at = models.DateTimeField(null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    deposit_applied_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    credit_note_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    refunded_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    balance_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=25, choices=InvoiceStatus.choices, default=InvoiceStatus.ISSUED)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_invoices'
        ordering = ['-invoice_date', '-created_at']

    def __str__(self):
        return f"[{self.invoice_number}] {self.patient.user_profile.full_name} - ₹{self.total_amount} ({self.status})"

    def recalculate_totals(self):
        if self.items.exists():
            items_total = sum((item.subtotal for item in self.items.all()), Decimal('0.00'))
            items_tax = sum((item.tax_amount for item in self.items.all()), Decimal('0.00'))
            self.subtotal = items_total
            if items_tax > Decimal('0.00') and self.tax_amount == Decimal('0.00'):
                self.tax_amount = items_tax
        self.total_amount = max(Decimal('0.00'), (self.subtotal - self.discount_amount) + self.tax_amount)
        settled_credits = (self.paid_amount + self.deposit_applied_amount + self.credit_note_amount) - self.refunded_amount
        self.balance_amount = max(Decimal('0.00'), self.total_amount - settled_credits)
        if self.balance_amount == Decimal('0.00') and (self.total_amount > Decimal('0.00') or settled_credits > Decimal('0.00')):
            self.status = InvoiceStatus.PAID
        elif settled_credits > Decimal('0.00'):
            self.status = InvoiceStatus.PARTIALLY_PAID
        self.save()


class ChargeItemType(models.TextChoices):
    CONSULTATION = 'CONSULTATION', 'Doctor Consultation'
    BED_CHARGE = 'BED_CHARGE', 'Inpatient Bed & Room Charges'
    LAB_TEST = 'LAB_TEST', 'Diagnostic Lab Test'
    RADIOLOGY = 'RADIOLOGY', 'Radiology & Imaging'
    PHARMACY = 'PHARMACY', 'Pharmacy Dispensation'
    SURGERY = 'SURGERY', 'OT & Surgical Procedure'
    ICU_CARE = 'ICU_CARE', 'Intensive Care Unit (ICU)'
    EMERGENCY = 'EMERGENCY', 'Emergency & Casualty'
    NURSING = 'NURSING', 'Nursing & Clinical Care'
    GENERAL_SERVICE = 'GENERAL_SERVICE', 'General Hospital Service'


class InvoiceItem(BaseUUIDModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    service = models.ForeignKey(HospitalService, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoice_items')
    item_type = models.CharField(max_length=30, choices=ChargeItemType.choices)
    description = models.CharField(max_length=200)
    source_reference = models.CharField(max_length=150, blank=True, help_text="e.g. LAB_ORDER:uuid, DISPENSE:uuid, BED_DAY:uuid")
    is_package_covered = models.BooleanField(default=False)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'hms_invoice_items'

    def save(self, *args, **kwargs):
        gross = Decimal(str(self.quantity)) * self.unit_price
        if self.is_package_covered:
            self.subtotal = Decimal('0.00')
            self.discount_amount = gross
            self.line_total = Decimal('0.00')
            self.tax_amount = Decimal('0.00')
        else:
            if self.discount_percent > Decimal('0.00'):
                self.discount_amount = (gross * self.discount_percent) / Decimal('100.00')
            base_after_discount = max(Decimal('0.00'), gross - self.discount_amount)
            if self.tax_rate > Decimal('0.00'):
                self.tax_amount = (base_after_discount * self.tax_rate) / Decimal('100.00')
            self.subtotal = gross
            self.line_total = base_after_discount + self.tax_amount
        super().save(*args, **kwargs)


class DiscountType(models.TextChoices):
    PERCENTAGE = 'PERCENTAGE', 'Percentage Discount'
    FIXED_AMOUNT = 'FIXED_AMOUNT', 'Fixed Amount Concession'


class DiscountStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved by Finance / Admin'
    REJECTED = 'REJECTED', 'Rejected'


class DiscountRequest(BaseUUIDModel):
    """
    Formal discount authorization requests with financial approval limits and separation of duties.
    """
    request_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='discount_requests')
    discount_type = models.CharField(max_length=20, choices=DiscountType.choices, default=DiscountType.FIXED_AMOUNT)
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    calculated_amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='requested_discounts')
    requested_at = models.DateTimeField(default=timezone.now)
    status = models.CharField(max_length=20, choices=DiscountStatus.choices, default=DiscountStatus.PENDING)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='discount_decisions')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_discount_requests'
        ordering = ['-requested_at']

    def __str__(self):
        return f"[{self.request_number}] ₹{self.calculated_amount} for {self.invoice.invoice_number} ({self.status})"


class DepositStatus(models.TextChoices):
    AVAILABLE = 'AVAILABLE', 'Available for Allocation'
    PARTIALLY_UTILIZED = 'PARTIALLY_UTILIZED', 'Partially Utilized against Bills'
    FULLY_UTILIZED = 'FULLY_UTILIZED', 'Fully Exhausted'
    REFUNDED = 'REFUNDED', 'Refunded to Patient'


class PaymentMethod(models.TextChoices):
    CASH = 'CASH', 'Cash'
    UPI = 'UPI', 'UPI / QR Payment'
    CREDIT_CARD = 'CREDIT_CARD', 'Credit Card'
    DEBIT_CARD = 'DEBIT_CARD', 'Debit Card'
    NET_BANKING = 'NET_BANKING', 'Internet Banking'
    BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Wire Transfer'
    ONLINE_GATEWAY = 'ONLINE_GATEWAY', 'Online Gateway (Razorpay)'
    INSURANCE_TPA = 'INSURANCE_TPA', 'TPA Insurance Direct Settlement'


class PatientDeposit(BaseUUIDModel):
    """
    Inpatient advance deposits and procedure security balances.
    """
    receipt_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='deposits')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='patient_deposits')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='advance_deposits')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    transaction_reference = models.CharField(max_length=100, blank=True)
    available_balance = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=25, choices=DepositStatus.choices, default=DepositStatus.AVAILABLE)
    received_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='collected_deposits')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_patient_deposits'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.receipt_number}] {self.patient.user_profile.full_name} - ₹{self.amount} (Avail: ₹{self.available_balance})"


class DepositAllocation(BaseUUIDModel):
    """
    Ledger record of a patient deposit utilized against an outstanding bill.
    """
    deposit = models.ForeignKey(PatientDeposit, on_delete=models.PROTECT, related_name='allocations')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='deposit_allocations')
    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2)
    allocated_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='deposit_allocations')
    allocated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_deposit_allocations'
        ordering = ['-allocated_at']

    def __str__(self):
        return f"₹{self.allocated_amount} from Deposit {self.deposit.receipt_number} to {self.invoice.invoice_number}"


class Payment(BaseUUIDModel):
    """
    Cashier Receipts and Patient Payment Settlements.
    """
    payment_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='payments')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='payments')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.UPI)
    transaction_reference = models.CharField(max_length=100, blank=True)
    received_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='received_payments')
    payment_date = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_payments'
        ordering = ['-payment_date']

    def __str__(self):
        return f"[{self.payment_number}] ₹{self.amount} for {self.invoice.invoice_number}"


class PaymentReceipt(BaseUUIDModel):
    """
    Official hospital payment receipt issued to the patient upon successful settlement.
    """
    receipt_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='issued_receipts')
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT, related_name='receipt')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='receipts')
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    balance_after_payment = models.DecimalField(max_digits=12, decimal_places=2)
    cashier = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='issued_receipts')
    payment_method = models.CharField(max_length=30)
    payment_date = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_payment_receipts'
        ordering = ['-payment_date']

    def __str__(self):
        return f"[{self.receipt_number}] ₹{self.amount_paid} for {self.invoice.invoice_number}"


class CreditNoteStatus(models.TextChoices):
    APPROVED = 'APPROVED', 'Approved'
    APPLIED = 'APPLIED', 'Applied to Bill Balance'
    CANCELLED = 'CANCELLED', 'Cancelled'


class PatientCreditNote(BaseUUIDModel):
    """
    Patient credit notes for billing reversals, billing corrections, and service cancellations.
    """
    credit_note_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='patient_credit_notes')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='patient_credit_notes')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=CreditNoteStatus.choices, default=CreditNoteStatus.APPROVED)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='approved_patient_credit_notes')
    approved_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_patient_credit_notes'
        ordering = ['-approved_at']

    def __str__(self):
        return f"[{self.credit_note_number}] ₹{self.amount} for {self.invoice.invoice_number}"


class RefundStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Finance Processing'
    PROCESSED = 'PROCESSED', 'Processed & Disbursed'
    FAILED = 'FAILED', 'Refund Failed'


class PatientRefund(BaseUUIDModel):
    """
    Patient refunds against excess deposits, approved credit notes, or overpayments.
    """
    refund_number = models.CharField(max_length=50, unique=True, db_index=True)
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, null=True, blank=True, related_name='patient_refunds')
    credit_note = models.ForeignKey(PatientCreditNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='refunds')
    deposit = models.ForeignKey(PatientDeposit, on_delete=models.SET_NULL, null=True, blank=True, related_name='refunds')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='refunds')
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    refund_method = models.CharField(max_length=30, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    original_payment_reference = models.CharField(max_length=100, blank=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=RefundStatus.choices, default=RefundStatus.PROCESSED)
    processed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='processed_refunds')
    gateway_refund_id = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'hms_patient_refunds'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.refund_number}] ₹{self.refund_amount} -> {self.patient.user_profile.full_name}"


class CashierShiftStatus(models.TextChoices):
    OPEN = 'OPEN', 'Shift Open / Active'
    CLOSED = 'CLOSED', 'Shift Closed / Awaiting Audit'
    RECONCILED = 'RECONCILED', 'Reconciled & Balanced'
    DISCREPANCY = 'DISCREPANCY', 'Cash Discrepancy Flagged'


class CashierShift(BaseUUIDModel):
    """
    Cashier shift opening, method-wise collection totals, physical cash counting, and variance reconciliation.
    """
    shift_number = models.CharField(max_length=50, unique=True, db_index=True)
    cashier = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='cashier_shifts')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='cashier_shifts')
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    opening_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    closing_cash_counted = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    expected_cash = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cash_variance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_cash_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_upi_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_card_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_bank_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_gateway_collected = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_refunds = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=CashierShiftStatus.choices, default=CashierShiftStatus.OPEN)
    reconciliation_notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_shifts')

    class Meta:
        db_table = 'hms_cashier_shifts'
        ordering = ['-opened_at']

    def __str__(self):
        return f"[{self.shift_number}] {self.cashier.user_profile.full_name} ({self.status})"


class GatewayOrderStatus(models.TextChoices):
    INITIATED = 'INITIATED', 'Order Initiated with Gateway'
    ATTEMPTED = 'ATTEMPTED', 'Checkout Modal Opened'
    PAID = 'PAID', 'Payment Verified & Captured'
    FAILED = 'FAILED', 'Payment Failed'
    EXPIRED = 'EXPIRED', 'Payment Order Expired'


class PaymentGatewayOrder(BaseUUIDModel):
    """
    Server-generated Razorpay / online payment orders with validated amounts and signature tracking.
    """
    gateway_order_id = models.CharField(max_length=100, unique=True, db_index=True)
    gateway_name = models.CharField(max_length=50, default='RAZORPAY')
    invoice = models.ForeignKey(Invoice, on_delete=models.SET_NULL, null=True, blank=True, related_name='gateway_orders')
    deposit = models.ForeignKey(PatientDeposit, on_delete=models.SET_NULL, null=True, blank=True, related_name='gateway_orders')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='gateway_orders')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=25, choices=GatewayOrderStatus.choices, default=GatewayOrderStatus.INITIATED)
    gateway_payment_id = models.CharField(max_length=100, blank=True)
    signature = models.CharField(max_length=255, blank=True)
    idempotency_key = models.CharField(max_length=100, unique=True, db_index=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_payment_gateway_orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.gateway_name}] {self.gateway_order_id} - ₹{self.amount} ({self.status})"


class PaymentWebhookLog(BaseUUIDModel):
    """
    Raw signed webhooks from payment gateways with cryptographic signature verification and idempotency.
    """
    gateway_name = models.CharField(max_length=50, default='RAZORPAY')
    event_id = models.CharField(max_length=100, db_index=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField(default=dict)
    signature = models.CharField(max_length=255, blank=True)
    is_verified = models.BooleanField(default=False)
    processed_at = models.DateTimeField(default=timezone.now)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_payment_webhook_logs'
        ordering = ['-processed_at']


class SettlementStatus(models.TextChoices):
    SETTLED = 'SETTLED', 'Settled to Hospital Bank Account'
    PENDING = 'PENDING', 'Pending Settlement'
    DISCREPANCY = 'DISCREPANCY', 'Fee / Amount Discrepancy'


class GatewaySettlement(BaseUUIDModel):
    """
    Reconciliation of gateway payouts, processing fees, GST on fees, and net payouts.
    """
    settlement_id = models.CharField(max_length=100, unique=True, db_index=True)
    gateway_name = models.CharField(max_length=50, default='RAZORPAY')
    settlement_date = models.DateField()
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2)
    total_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_on_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    net_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=25, choices=SettlementStatus.choices, default=SettlementStatus.SETTLED)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_gateway_settlements'
        ordering = ['-settlement_date']

    def __str__(self):
        return f"[{self.settlement_id}] Gross: ₹{self.gross_amount} | Net: ₹{self.net_amount}"


class BillingAuditEvent(BaseUUIDModel):
    """
    Immutable audit logging for sensitive financial, discount, tariff, and payment events.
    """
    action = models.CharField(max_length=100, db_index=True)
    entity_name = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=100, db_index=True)
    performed_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='billing_audit_logs')
    details = models.JSONField(default=dict)
    ip_address = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = 'hms_billing_audit_events'
        ordering = ['-created_at']


class OrganizationType(models.TextChoices):
    TPA = 'TPA', 'Third-Party Administrator (TPA)'
    PRIVATE_INSURER = 'PRIVATE_INSURER', 'Private Health Insurer'
    GOVT_SCHEME = 'GOVT_SCHEME', 'Government Health Scheme (PMJAY/CGHS/ECHS)'
    CORPORATE_TPA = 'CORPORATE_TPA', 'Corporate / Institutional TPA'


class InsuranceProvider(BaseUUIDModel):
    """
    Empanelled Third-Party Administrators (TPAs) and Private Health Insurers.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    org_type = models.CharField(max_length=30, choices=OrganizationType.choices, default=OrganizationType.TPA)
    contact_person = models.CharField(max_length=100)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    tpa_desk_email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    claim_settlement_avg_days = models.PositiveIntegerField(default=15)
    default_tariff = models.ForeignKey('TariffPlan', on_delete=models.SET_NULL, null=True, blank=True, related_name='default_providers')
    is_active = models.BooleanField(default=True)
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_insurance_providers'
        ordering = ['name']

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.org_type})"


class CorporateCustomer(BaseUUIDModel):
    """
    Corporate organizations and institutional clients under credit and corporate billing arrangements.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True, db_index=True)
    contact_person = models.CharField(max_length=100)
    phone = models.CharField(max_length=25)
    email = models.EmailField(blank=True)
    billing_address = models.TextField(blank=True)
    contract_reference = models.CharField(max_length=100, blank=True)
    corporate_tariff = models.ForeignKey('TariffPlan', on_delete=models.SET_NULL, null=True, blank=True, related_name='corporate_customers')
    valid_from = models.DateField(default=timezone.localdate)
    valid_to = models.DateField(null=True, blank=True)
    credit_terms_days = models.PositiveIntegerField(default=30)
    credit_limit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('500000.00'))
    current_credit_utilized = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    invoice_delivery_preference = models.CharField(max_length=50, default='EMAIL_AND_PORTAL')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_corporate_customers'
        ordering = ['name']

    def __str__(self):
        return f"[{self.code}] {self.name} - Credit Limit: ₹{self.credit_limit}"


class CoverageStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active / Valid'
    EXPIRED = 'EXPIRED', 'Policy Expired'
    SUSPENDED = 'SUSPENDED', 'Coverage Suspended'
    PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending Verification'


class PatientInsuranceCoverage(BaseUUIDModel):
    """
    Patient-specific policy, TPA card, or corporate beneficiary coverage record.
    """
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='insurance_coverages')
    provider = models.ForeignKey(InsuranceProvider, on_delete=models.PROTECT, null=True, blank=True, related_name='patient_coverages')
    corporate_customer = models.ForeignKey(CorporateCustomer, on_delete=models.PROTECT, null=True, blank=True, related_name='beneficiary_coverages')
    policy_number = models.CharField(max_length=100, db_index=True)
    member_id = models.CharField(max_length=100, blank=True)
    corporate_emp_id = models.CharField(max_length=100, blank=True)
    insured_person_name = models.CharField(max_length=150, blank=True)
    relation_to_patient = models.CharField(max_length=50, default='SELF')
    sum_insured = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('500000.00'))
    cumulative_utilized = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    valid_from = models.DateField(default=timezone.localdate)
    valid_to = models.DateField(null=True, blank=True)
    copay_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    deductible_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_coverages')
    verification_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=CoverageStatus.choices, default=CoverageStatus.PENDING_VERIFICATION)
    policy_document_url = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_patient_insurance_coverages'
        ordering = ['-created_at']

    def __str__(self):
        source = self.provider.name if self.provider else (self.corporate_customer.name if self.corporate_customer else "Unknown")
        return f"{self.patient.user_profile.full_name} - {source} ({self.policy_number})"


class EligibilityStatus(models.TextChoices):
    ELIGIBLE = 'ELIGIBLE', 'Eligible / Confirmed'
    INELIGIBLE = 'INELIGIBLE', 'Ineligible / Policy Inactive'
    EXPIRED = 'EXPIRED', 'Policy Lapsed or Expired'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Manual Verification Required'


class EligibilityCheck(BaseUUIDModel):
    """
    Formal eligibility verification history against TPA portal, API, or direct insurer desk.
    """
    coverage = models.ForeignKey(PatientInsuranceCoverage, on_delete=models.PROTECT, related_name='eligibility_checks')
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='eligibility_history')
    checked_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='conducted_eligibility_checks')
    verification_date = models.DateField(default=timezone.localdate)
    verification_method = models.CharField(max_length=30, default='PORTAL')  # PORTAL, API, PHONE, EMAIL
    reference_number = models.CharField(max_length=100, blank=True)
    coverage_limit_confirmed = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=30, choices=EligibilityStatus.choices, default=EligibilityStatus.ELIGIBLE)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_eligibility_checks'
        ordering = ['-verification_date', '-created_at']

    def __str__(self):
        return f"[{self.status}] Check {self.reference_number} for {self.patient.user_profile.full_name}"


class PreAuthStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft Request'
    SUBMITTED = 'SUBMITTED', 'Submitted to Insurer / TPA'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Medical Adjudication'
    QUERY_RECEIVED = 'QUERY_RECEIVED', 'Query Received from TPA'
    APPROVED = 'APPROVED', 'Approved in Full'
    PARTIALLY_APPROVED = 'PARTIALLY_APPROVED', 'Partially Approved'
    REJECTED = 'REJECTED', 'Denied / Rejected'
    EXPIRED = 'EXPIRED', 'Expired / Cancelled'


class PreAuthorizationRequest(BaseUUIDModel):
    """
    Pre-authorization request and tracking for planned and emergency admissions.
    """
    request_number = models.CharField(max_length=50, unique=True, db_index=True)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='pre_authorizations')
    coverage = models.ForeignKey(PatientInsuranceCoverage, on_delete=models.PROTECT, related_name='pre_authorizations')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='pre_authorizations')
    invoice = models.ForeignKey('billing_finance.Invoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='pre_authorizations')
    treatment_category = models.CharField(max_length=150, default='Inpatient Care')
    estimated_amount = models.DecimalField(max_digits=12, decimal_places=2)
    requested_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    approval_reference = models.CharField(max_length=100, blank=True)
    approval_date = models.DateField(null=True, blank=True)
    validity_until = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=PreAuthStatus.choices, default=PreAuthStatus.DRAFT)
    rejection_query_reason = models.TextField(blank=True)
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='initiated_pre_auths')
    processed_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_pre_auths')
    request_date = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_pre_authorization_requests'
        ordering = ['-request_date', '-created_at']

    def __str__(self):
        return f"[{self.request_number}] {self.patient.user_profile.full_name} - ₹{self.requested_amount} ({self.status})"


class ClaimType(models.TextChoices):
    CASHLESS = 'CASHLESS', 'Cashless Hospitalization Claim'
    REIMBURSEMENT = 'REIMBURSEMENT', 'Patient Reimbursement Claim'
    CORPORATE = 'CORPORATE', 'Corporate Credit Claim'


class ClaimStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft Dossier'
    DOCUMENTS_PENDING = 'DOCUMENTS_PENDING', 'Awaiting Required Documents'
    SUBMITTED = 'SUBMITTED', 'Submitted to TPA / Corporate'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Adjudication'
    QUERY_RECEIVED = 'QUERY_RECEIVED', 'TPA Query Received'
    RESUBMITTED = 'RESUBMITTED', 'Resubmitted with Query Responses'
    APPROVED = 'APPROVED', 'Claim Approved by Insurer'
    PARTIALLY_APPROVED = 'PARTIALLY_APPROVED', 'Partially Approved'
    REJECTED = 'REJECTED', 'Claim Rejected / Denied'
    PARTIALLY_SETTLED = 'PARTIALLY_SETTLED', 'Partially Settled'
    SETTLED = 'SETTLED', 'Claim Settled & Disbursed'
    CLOSED = 'CLOSED', 'Claim File Closed'


class InsuranceClaim(BaseUUIDModel):
    """
    Comprehensive Cashless, Reimbursement, and Corporate claim docket tracking.
    """
    claim_number = models.CharField(max_length=50, unique=True, db_index=True)
    claim_type = models.CharField(max_length=25, choices=ClaimType.choices, default=ClaimType.CASHLESS)
    patient = models.ForeignKey(PatientProfile, on_delete=models.PROTECT, related_name='insurance_claims')
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='insurance_claims')
    provider = models.ForeignKey(InsuranceProvider, on_delete=models.PROTECT, null=True, blank=True, related_name='claims')
    corporate_customer = models.ForeignKey(CorporateCustomer, on_delete=models.PROTECT, null=True, blank=True, related_name='claims')
    coverage = models.ForeignKey(PatientInsuranceCoverage, on_delete=models.SET_NULL, null=True, blank=True, related_name='claims')
    pre_auth = models.ForeignKey(PreAuthorizationRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='claims')
    admission = models.ForeignKey('clinical.InpatientAdmission', on_delete=models.SET_NULL, null=True, blank=True, related_name='insurance_claims')
    policy_number = models.CharField(max_length=100)
    pre_auth_number = models.CharField(max_length=100, blank=True)
    claim_amount = models.DecimalField(max_digits=12, decimal_places=2)
    approved_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    settled_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    disallowed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    patient_copay_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    deductible_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=30, choices=ClaimStatus.choices, default=ClaimStatus.DRAFT)
    submission_method = models.CharField(max_length=30, default='PORTAL')  # PORTAL, EMAIL, PHYSICAL_DESK, API
    submission_reference = models.CharField(max_length=100, blank=True)
    rejection_reason = models.TextField(blank=True)
    submitted_date = models.DateField(default=timezone.localdate)
    settlement_date = models.DateField(null=True, blank=True)
    assigned_staff = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_claims')

    class Meta:
        db_table = 'hms_insurance_claims'
        ordering = ['-submitted_date', '-created_at']

    def __str__(self):
        source = self.provider.name if self.provider else (self.corporate_customer.name if self.corporate_customer else "Unknown")
        return f"[{self.claim_number}] {source} - ₹{self.claim_amount} ({self.status})"


class ClaimDocumentType(models.TextChoices):
    POLICY_CARD = 'POLICY_CARD', 'Insurance / TPA Policy Card'
    GOVT_ID = 'GOVT_ID', 'Government Identity Proof (Aadhaar / Voter ID)'
    PRE_AUTH_FORM = 'PRE_AUTH_FORM', 'Signed Pre-Authorization Form'
    DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY', 'Clinical Discharge Summary'
    ITEMIZED_BILL = 'ITEMIZED_BILL', 'Detailed Hospital Itemized Bill'
    PAYMENT_RECEIPT = 'PAYMENT_RECEIPT', 'Payment Receipt'
    DIAGNOSTIC_REPORT = 'DIAGNOSTIC_REPORT', 'Laboratory / Radiology Report'
    PHARMACY_PRESCRIPTION = 'PHARMACY_PRESCRIPTION', 'Doctor Prescription & Dispense Slip'
    QUERY_RESPONSE = 'QUERY_RESPONSE', 'Query Response & Justification'
    FINAL_SETTLEMENT_VOUCHER = 'FINAL_SETTLEMENT_VOUCHER', 'Final Settlement Voucher'
    OTHER = 'OTHER', 'Other Supporting Clinical / Financial Document'


class ClaimDocument(BaseUUIDModel):
    """
    Secure document attachments linked to insurance claims dossiers.
    """
    claim = models.ForeignKey(InsuranceClaim, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=35, choices=ClaimDocumentType.choices, default=ClaimDocumentType.OTHER)
    document_name = models.CharField(max_length=200)
    file_url = models.CharField(max_length=500, blank=True)
    file_size_kb = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_claim_docs')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_claim_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.document_name} ({self.document_type}) for {self.claim.claim_number}"


class ClaimQueryType(models.TextChoices):
    MEDICAL_NECESSITY = 'MEDICAL_NECESSITY', 'Medical Necessity / Justification Query'
    BILLING_QUERY = 'BILLING_QUERY', 'Billing / Tariff Disallowance Query'
    DOCUMENT_DEFICIENCY = 'DOCUMENT_DEFICIENCY', 'Missing / Illegible Document Deficiency'
    IDENTITY_MISMATCH = 'IDENTITY_MISMATCH', 'Member / Identity Mismatch Query'
    OTHER = 'OTHER', 'Other TPA / Insurer Query'


class QueryStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Response'
    ANSWERED = 'ANSWERED', 'Response Submitted'
    OVERDUE = 'OVERDUE', 'Action Overdue'


class ClaimQuery(BaseUUIDModel):
    """
    Formal queries raised by TPA / Insurers with deadline and resubmission tracking.
    """
    claim = models.ForeignKey(InsuranceClaim, on_delete=models.CASCADE, related_name='queries')
    query_number = models.CharField(max_length=50, unique=True, db_index=True)
    query_type = models.CharField(max_length=35, choices=ClaimQueryType.choices, default=ClaimQueryType.BILLING_QUERY)
    query_text = models.TextField()
    received_date = models.DateField(default=timezone.localdate)
    deadline_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=QueryStatus.choices, default=QueryStatus.PENDING)
    response_text = models.TextField(blank=True)
    responded_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='responded_claim_queries')
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_claim_queries'
        ordering = ['-received_date', '-created_at']

    def __str__(self):
        return f"[{self.query_number}] {self.query_type} on {self.claim.claim_number} ({self.status})"


class SettlementReconciliationStatus(models.TextChoices):
    MATCHED = 'MATCHED', 'Fully Reconciled & Matched'
    PARTIAL = 'PARTIAL', 'Partial Settlement'
    DISCREPANCY = 'DISCREPANCY', 'Discrepancy / Deductions Under Dispute'


class ClaimSettlement(BaseUUIDModel):
    """
    Authoritative settlement receipts disbursed by TPA or Corporate.
    """
    settlement_number = models.CharField(max_length=50, unique=True, db_index=True)
    claim = models.ForeignKey(InsuranceClaim, on_delete=models.PROTECT, related_name='settlements')
    settlement_reference = models.CharField(max_length=100)
    settlement_date = models.DateField(default=timezone.localdate)
    bank_utr = models.CharField(max_length=100, blank=True)
    amount_settled = models.DecimalField(max_digits=12, decimal_places=2)
    disallowed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tds_deducted = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    reconciliation_status = models.CharField(max_length=25, choices=SettlementReconciliationStatus.choices, default=SettlementReconciliationStatus.MATCHED)
    reconciliation_notes = models.TextField(blank=True)
    settled_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='processed_settlements')

    class Meta:
        db_table = 'hms_claim_settlements'
        ordering = ['-settlement_date', '-created_at']

    def __str__(self):
        return f"[{self.settlement_number}] Settled ₹{self.amount_settled} on {self.claim.claim_number}"


class CorporateInvoiceStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft Consolidated Invoice'
    SENT = 'SENT', 'Sent to Corporate Partner'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Fully Paid'
    DISPUTED = 'DISPUTED', 'Invoice Disputed'


class CorporateInvoice(BaseUUIDModel):
    """
    Consolidated corporate billing statement for corporate clients with multiple patient visits.
    """
    invoice_number = models.CharField(max_length=50, unique=True, db_index=True)
    corporate_customer = models.ForeignKey(CorporateCustomer, on_delete=models.PROTECT, related_name='invoices')
    billing_period_start = models.DateField()
    billing_period_end = models.DateField()
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    balance_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=25, choices=CorporateInvoiceStatus.choices, default=CorporateInvoiceStatus.DRAFT)
    due_date = models.DateField()
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='created_corporate_invoices')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_corporate_invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.invoice_number}] {self.corporate_customer.name} - ₹{self.total_amount} ({self.status})"


class AccountCategoryType(models.TextChoices):
    ASSET = 'ASSET', 'Asset'
    LIABILITY = 'LIABILITY', 'Liability'
    EQUITY = 'EQUITY', 'Equity'
    REVENUE = 'REVENUE', 'Operating Revenue'
    EXPENSE = 'EXPENSE', 'Operating Expense'


class AccountCategory(BaseUUIDModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    category_type = models.CharField(max_length=20, choices=AccountCategoryType.choices)

    class Meta:
        db_table = 'hms_account_categories'
        ordering = ['code']

    def __str__(self):
        return f"[{self.code}] {self.name} ({self.category_type})"


class AccountSubType(models.TextChoices):
    CASH_BANK = 'CASH_BANK', 'Cash and Bank Accounts'
    PATIENT_RECEIVABLE = 'PATIENT_RECEIVABLE', 'Patient Accounts Receivable'
    INSURANCE_RECEIVABLE = 'INSURANCE_RECEIVABLE', 'Insurance & TPA Receivables'
    PATIENT_ADVANCE = 'PATIENT_ADVANCE', 'Patient Advance Deposits'
    SUPPLIER_PAYABLE = 'SUPPLIER_PAYABLE', 'Supplier & Vendor Payables'
    INVENTORY = 'INVENTORY', 'Inventory and Medical Supplies'
    FIXED_ASSET = 'FIXED_ASSET', 'Fixed Assets'
    ACCUMULATED_DEPRECIATION = 'ACCUMULATED_DEPRECIATION', 'Accumulated Depreciation'
    INVESTMENT_ASSET = 'INVESTMENT_ASSET', 'Investment Assets'
    INTEREST_DIVIDEND_INCOME = 'INTEREST_DIVIDEND_INCOME', 'Interest and Dividend Income'
    LOAN_LIABILITY = 'LOAN_LIABILITY', 'Loan Principal Liabilities'
    LOAN_INTEREST_EXPENSE = 'LOAN_INTEREST_EXPENSE', 'Loan Interest Expenses'
    PATIENT_SERVICE_REVENUE = 'PATIENT_SERVICE_REVENUE', 'Patient Care & Service Revenue'
    PHARMACY_DIAGNOSTIC_REVENUE = 'PHARMACY_DIAGNOSTIC_REVENUE', 'Pharmacy & Diagnostic Revenue'
    SALARIES_PAYROLL = 'SALARIES_PAYROLL', 'Salaries and Payroll'
    RENT_UTILITIES = 'RENT_UTILITIES', 'Rent and Utilities'
    BANK_CHARGES = 'BANK_CHARGES', 'Bank Charges and Fees'
    TAXES_STATUTORY = 'TAXES_STATUTORY', 'Taxes and Statutory Liabilities'
    OTHER = 'OTHER', 'Other Hospital Accounts'


class FiscalYear(BaseUUIDModel):
    """
    Hospital Financial Year configuration (e.g. FY 2026-27, Apr 1 to Mar 31).
    """
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True, db_index=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='closed_fiscal_years')

    class Meta:
        db_table = 'hms_fiscal_years'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.name} ({'CLOSED' if self.is_closed else 'OPEN'})"


class AccountingPeriod(BaseUUIDModel):
    """
    Hospital Accounting Period (Month / Quarter). Controls and prevents postings to closed periods.
    """
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.CASCADE, related_name='periods')
    period_number = models.PositiveIntegerField()
    period_name = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='closed_accounting_periods')
    reopened_at = models.DateTimeField(null=True, blank=True)
    reopened_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='reopened_accounting_periods')
    reopen_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_accounting_periods'
        ordering = ['start_date']
        unique_together = ('fiscal_year', 'period_number')

    def __str__(self):
        return f"{self.period_name} [{self.fiscal_year.code}] ({'CLOSED' if self.is_closed else 'OPEN'})"


class AccountingPeriodAuditLog(BaseUUIDModel):
    """
    Audit trail for accounting period closing and reopening.
    """
    period = models.ForeignKey(AccountingPeriod, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=30)  # CLOSED, REOPENED, CREATED
    performed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='period_audits')
    comments = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_accounting_period_audits'
        ordering = ['-created_at']


class ChartOfAccount(BaseUUIDModel):
    """
    Hospital Chart of Accounts supporting Multi-Branch Double-Entry Accounting.
    """
    account_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.ForeignKey(AccountCategory, on_delete=models.PROTECT, related_name='accounts')
    account_type = models.CharField(max_length=50, choices=AccountSubType.choices, default=AccountSubType.OTHER)
    parent_account = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_accounts')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='accounts')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='chart_accounts')
    description = models.TextField(blank=True)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    opening_balance_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_reconcilable = models.BooleanField(default=False)

    class Meta:
        db_table = 'hms_chart_of_accounts'
        ordering = ['account_code']

    def __str__(self):
        return f"{self.account_code} - {self.name} ({self.category.name})"

    @property
    def normal_balance(self):
        if self.category and self.category.category_type in [AccountCategoryType.ASSET, AccountCategoryType.EXPENSE]:
            return 'DEBIT'
        return 'CREDIT'

    @property
    def classification(self):
        return self.category.category_type if self.category else 'ASSET'


class JournalVoucherType(models.TextChoices):
    STANDARD = 'STANDARD', 'Standard Journal Voucher'
    PAYMENT = 'PAYMENT', 'Payment Voucher'
    RECEIPT = 'RECEIPT', 'Receipt Voucher'
    CONTRA = 'CONTRA', 'Contra Voucher (Inter-Account)'
    ADJUSTMENT = 'ADJUSTMENT', 'Adjustment Voucher'
    REVERSAL = 'REVERSAL', 'Reversal Voucher'
    OPENING = 'OPENING', 'Opening Balance Voucher'
    CLOSING = 'CLOSING', 'Year-End Closing Voucher'


class JournalStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    POSTED = 'POSTED', 'Posted'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'
    REVERSED = 'REVERSED', 'Reversed'


class JournalEntry(BaseUUIDModel):
    """
    Double-Entry Accounting Journal Header. Strictly enforces Debit = Credit balance before posting.
    Supports complete voucher lifecycle: Draft -> Pending Approval -> Approved -> Posted -> Reversed.
    """
    entry_number = models.CharField(max_length=60, unique=True, db_index=True)
    voucher_number = models.CharField(max_length=60, unique=True, null=True, blank=True, db_index=True)
    voucher_type = models.CharField(max_length=30, choices=JournalVoucherType.choices, default=JournalVoucherType.STANDARD)
    status = models.CharField(max_length=30, choices=JournalStatus.choices, default=JournalStatus.POSTED, db_index=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='journal_entries')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entries')
    accounting_period = models.ForeignKey(AccountingPeriod, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_entries')
    entry_date = models.DateField(default=timezone.now)
    narration = models.TextField()
    reference_number = models.CharField(max_length=100, blank=True)
    source_module = models.CharField(max_length=50, blank=True)
    source_transaction_id = models.CharField(max_length=100, blank=True, db_index=True)
    idempotency_key = models.CharField(max_length=100, null=True, blank=True, db_index=True)

    is_posted = models.BooleanField(default=False)
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_journals')
    submitted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='submitted_journals')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_journals')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_journals')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    posted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='posted_journals')
    posted_at = models.DateTimeField(null=True, blank=True)

    reversal_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversal_entries')
    reversed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='reversed_journals')
    reversed_at = models.DateTimeField(null=True, blank=True)
    reversal_reason = models.TextField(blank=True)

    total_debit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_credit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'hms_journal_entries'
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f"[{self.entry_number}] {self.entry_date}: {self.narration[:40]}"

    def validate_balanced(self):
        lines = list(self.lines.all())
        if len(lines) < 2:
            raise ValidationError("A journal voucher must have at least two line items (Debit and Credit).")
        debits = sum((l.amount if l.entry_type == 'DEBIT' else l.debit_amount for l in lines), Decimal('0.00'))
        credits = sum((l.amount if l.entry_type == 'CREDIT' else l.credit_amount for l in lines), Decimal('0.00'))
        if debits != credits:
            raise ValidationError(f"Journal entry is out of balance! Debits: ₹{debits}, Credits: ₹{credits}. Variance: ₹{abs(debits - credits)}")
        has_debit = any(l.amount > 0 or l.debit_amount > 0 for l in lines if l.entry_type == 'DEBIT' or l.debit_amount > 0)
        has_credit = any(l.amount > 0 or l.credit_amount > 0 for l in lines if l.entry_type == 'CREDIT' or l.credit_amount > 0)
        if not (has_debit and has_credit):
            raise ValidationError("Journal entry must have at least one debit line and one credit line greater than zero.")
        return True


class JournalLineType(models.TextChoices):
    DEBIT = 'DEBIT', 'Debit'
    CREDIT = 'CREDIT', 'Credit'


class JournalLineItem(BaseUUIDModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(ChartOfAccount, on_delete=models.PROTECT, related_name='journal_lines')
    entry_type = models.CharField(max_length=10, choices=JournalLineType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    debit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    description = models.CharField(max_length=255, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='journal_lines')

    class Meta:
        db_table = 'hms_journal_line_items'

    def clean(self):
        super().clean()
        if self.debit_amount < 0 or self.credit_amount < 0:
            raise ValidationError("Debit and credit amounts cannot be negative.")
        if self.debit_amount > 0 and self.credit_amount > 0:
            raise ValidationError("A single journal line cannot have both debit and credit amounts greater than zero.")

    def save(self, *args, **kwargs):
        if self.debit_amount > Decimal('0.00') and self.credit_amount == Decimal('0.00'):
            self.entry_type = JournalLineType.DEBIT
            self.amount = self.debit_amount
        elif self.credit_amount > Decimal('0.00') and self.debit_amount == Decimal('0.00'):
            self.entry_type = JournalLineType.CREDIT
            self.amount = self.credit_amount
        elif self.entry_type == JournalLineType.DEBIT and self.debit_amount == Decimal('0.00') and self.amount > Decimal('0.00'):
            self.debit_amount = self.amount
        elif self.entry_type == JournalLineType.CREDIT and self.credit_amount == Decimal('0.00') and self.amount > Decimal('0.00'):
            self.credit_amount = self.amount
        super().save(*args, **kwargs)


class JournalAuditLog(BaseUUIDModel):
    """
    Immutable audit record for every action in the journal voucher lifecycle.
    """
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)  # CREATED, SUBMITTED, APPROVED, REJECTED, POSTED, REVERSED, ADJUSTED, DOCUMENT_ATTACHED
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    performed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='journal_audit_actions')
    comments = models.TextField(blank=True)
    ip_address = models.CharField(max_length=45, blank=True)

    class Meta:
        db_table = 'hms_journal_audit_logs'
        ordering = ['-created_at']


class JournalDocument(BaseUUIDModel):
    """
    Supporting attachments and documentation for journal vouchers.
    """
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, default='VOUCHER_ATTACHMENT')
    file_name = models.CharField(max_length=255)
    file_url = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.BigIntegerField(default=0)
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='uploaded_journal_docs')

    class Meta:
        db_table = 'hms_journal_documents'
        ordering = ['-created_at']


class BankAccount(BaseUUIDModel):
    """
    Hospital Operating & Treasury Bank Accounts.
    """
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=50, unique=True)
    branch_code = models.CharField(max_length=50, blank=True)
    ifsc_code = models.CharField(max_length=20)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        db_table = 'hms_bank_accounts'

    def __str__(self):
        return f"{self.bank_name} - {self.account_number[-4:]} (₹{self.current_balance})"


class BankTransaction(BaseUUIDModel):
    """
    Imported bank statement transactions for automated bank reconciliation.
    """
    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name='transactions')
    transaction_date = models.DateField()
    reference_number = models.CharField(max_length=100)
    description = models.CharField(max_length=250)
    debit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    is_reconciled = models.BooleanField(default=False)

    class Meta:
        db_table = 'hms_bank_transactions'
        ordering = ['-transaction_date']


class InvestmentCategory(models.TextChoices):
    FIXED_DEPOSIT = 'FIXED_DEPOSIT', 'Bank Fixed Deposit'
    GOVT_BOND = 'GOVT_BOND', 'Government Securities & Bonds'
    MUTUAL_FUND = 'MUTUAL_FUND', 'Mutual Funds & Liquid Funds'
    EQUITY_SHARES = 'EQUITY_SHARES', 'Shares & Equity Securities'
    MONEY_MARKET = 'MONEY_MARKET', 'Money-Market Instruments (CP/CD/T-Bills)'
    OTHER = 'OTHER', 'Other Permitted Instruments'


class InvestmentLifecycleStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    ACTIVE = 'ACTIVE', 'Active'
    MATURED = 'MATURED', 'Matured (Pending Settlement)'
    REDEEMED = 'REDEEMED', 'Redeemed'
    SOLD = 'SOLD', 'Sold'
    CLOSED = 'CLOSED', 'Closed & Settled'
    CANCELLED = 'CANCELLED', 'Cancelled'
    REJECTED = 'REJECTED', 'Rejected'


class CompoundingFrequency(models.TextChoices):
    SIMPLE = 'SIMPLE', 'Simple Interest'
    MONTHLY = 'MONTHLY', 'Monthly Compounding'
    QUARTERLY = 'QUARTERLY', 'Quarterly Compounding'
    HALF_YEARLY = 'HALF_YEARLY', 'Half-Yearly Compounding'
    ANNUALLY = 'ANNUALLY', 'Annual Compounding'
    AT_MATURITY = 'AT_MATURITY', 'Cumulative at Maturity'


class InvestmentRegister(BaseUUIDModel):
    """
    Hospital Treasury Investments, Fixed Deposits, Bonds, and Market Securities.
    Integrates with Section 13 Financial Accounts and Section 14 Financial Transactions.
    """
    investment_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=30, choices=InvestmentCategory.choices)
    institution_name = models.CharField(max_length=150, blank=True, default='')
    reference_number = models.CharField(max_length=100, blank=True, default='', help_text="FD Receipt / Folio / ISIN")
    
    # Linked Section 13 Accounts
    financial_account = models.ForeignKey('billing_finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='investments', help_text="Designated investment asset account")
    source_financial_account = models.ForeignKey('billing_finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='source_investments', help_text="Funding bank account")
    settlement_financial_account = models.ForeignKey('billing_finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='settlement_investments', help_text="Payout/settlement bank account")

    # Financial terms
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    units = models.DecimalField(max_digits=16, decimal_places=4, default=Decimal('0.0000'), blank=True)
    purchase_price_per_unit = models.DecimalField(max_digits=14, decimal_places=4, default=Decimal('0.0000'), blank=True)
    purchase_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    interest_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    compounding_frequency = models.CharField(max_length=20, choices=CompoundingFrequency.choices, default=CompoundingFrequency.ANNUALLY)
    purchase_date = models.DateField()
    maturity_date = models.DateField(null=True, blank=True)
    expected_maturity_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    actual_maturity_proceeds = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    # Mark-to-market valuation
    current_valuation = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    valuation_date = models.DateField(null=True, blank=True)
    valuation_source = models.CharField(max_length=100, default='Placement Cost / Face Value')

    # Income & returns
    total_interest_received = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_dividend_received = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    realized_gain_loss = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    # FD specific terms
    premature_withdrawal_allowed = models.BooleanField(default=True)
    premature_penalty_rate_pct = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    auto_renew = models.BooleanField(default=False)

    # Lifecycle & status
    status = models.CharField(max_length=20, default='ACTIVE')
    lifecycle_status = models.CharField(max_length=30, choices=InvestmentLifecycleStatus.choices, default=InvestmentLifecycleStatus.ACTIVE)

    # Context linkages
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='investments')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='investments')
    notes = models.TextField(blank=True, default='')

    # Lifecycle actors
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_investments')
    submitted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='submitted_investments')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_investments')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_investments')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    closed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='closed_investments')
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_investments'
        ordering = ['maturity_date', '-created_at']

    def __str__(self):
        return f"[{self.investment_code}] {self.name} - ₹{self.principal_amount} ({self.lifecycle_status})"

    @property
    def unrealized_gain_loss(self):
        if self.current_valuation and self.principal_amount:
            return self.current_valuation - self.principal_amount
        return Decimal('0.00')


class LoanType(models.TextChoices):
    TERM_LOAN = 'TERM_LOAN', 'Term Loan'
    EQUIPMENT_FINANCING = 'EQUIPMENT_FINANCING', 'Medical Equipment Financing'
    WORKING_CAPITAL = 'WORKING_CAPITAL', 'Working Capital Loan'
    MORTGAGE = 'MORTGAGE', 'Mortgage / Real Estate Loan'
    CREDIT_LINE = 'CREDIT_LINE', 'Revolving Credit Facility'
    VEHICLE_LOAN = 'VEHICLE_LOAN', 'Ambulance & Vehicle Loan'
    UNSECURED_LOAN = 'UNSECURED_LOAN', 'Unsecured Commercial Loan'
    OTHER = 'OTHER', 'Other Borrowing'


class LoanLifecycleStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    ACTIVE = 'ACTIVE', 'Active / Disbursed'
    CLOSED = 'CLOSED', 'Closed / Settled'
    OVERDUE = 'OVERDUE', 'Overdue'
    DEFAULTED = 'DEFAULTED', 'Defaulted'
    CANCELLED = 'CANCELLED', 'Cancelled'


class LoanRepaymentFrequency(models.TextChoices):
    MONTHLY = 'MONTHLY', 'Monthly EMI'
    QUARTERLY = 'QUARTERLY', 'Quarterly'
    HALF_YEARLY = 'HALF_YEARLY', 'Half-Yearly'
    ANNUALLY = 'ANNUALLY', 'Annually'
    BULLET = 'BULLET', 'Bullet / At Maturity'


class LoanRegister(BaseUUIDModel):
    """
    Hospital Term Loans, Medical Equipment Financing, and Liabilities.
    Supports Section 16 Enterprise Debt Management, amortization schedules,
    repayment events, and Section 13/14 financial ledger integrations.
    """
    loan_account_number = models.CharField(max_length=50, unique=True, db_index=True)
    lender_name = models.CharField(max_length=150)
    loan_type = models.CharField(max_length=40, choices=LoanType.choices, default=LoanType.TERM_LOAN)
    
    # Financial amounts
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2, help_text="Total sanctioned/borrowed principal")
    sanctioned_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    disbursed_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    disbursement_date = models.DateField(null=True, blank=True)
    interest_rate_pct = models.DecimalField(max_digits=5, decimal_places=2)
    tenure_months = models.PositiveIntegerField(default=36)
    repayment_frequency = models.CharField(max_length=25, choices=LoanRepaymentFrequency.choices, default=LoanRepaymentFrequency.MONTHLY)
    monthly_emi = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Tracking balances
    total_repaid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_principal_repaid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_interest_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_fees_paid = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    outstanding_balance = models.DecimalField(max_digits=14, decimal_places=2)
    
    # Dates & status
    start_date = models.DateField()
    maturity_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVE')
    lifecycle_status = models.CharField(max_length=30, choices=LoanLifecycleStatus.choices, default=LoanLifecycleStatus.ACTIVE)
    
    # Collateral & security
    is_secured = models.BooleanField(default=True)
    collateral_details = models.TextField(blank=True, default='')
    collateral_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    purpose = models.TextField(blank=True, default='')
    processing_fees = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Linked Section 13 accounts
    liability_financial_account = models.ForeignKey('billing_finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='liability_loans')
    servicing_financial_account = models.ForeignKey('billing_finance.FinancialAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='servicing_loans')
    
    # Organizational linkages
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='loans')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='loans')
    notes = models.TextField(blank=True, default='')
    
    # Lifecycle actors
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_loans')
    submitted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='submitted_loans')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_loans')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_loans')
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    closed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='closed_loans')
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_loans'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.lender_name} Loan [{self.loan_account_number}] - Outstanding: ₹{self.outstanding_balance} ({self.lifecycle_status})"


class BudgetPlan(BaseUUIDModel):
    """
    Departmental Annual Operating Budgets and Variance Tracking.
    """
    fiscal_year = models.CharField(max_length=10, help_text="e.g. 2026-2027")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='budgets')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='budgets')
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2)
    utilized_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_budget_plans'
        unique_together = ('fiscal_year', 'branch', 'department')
        ordering = ['fiscal_year']

    @property
    def variance_remaining(self):
        return self.allocated_amount - self.utilized_amount


# ==============================================================================
# SECTION 13: FINANCIAL ACCOUNTS MANAGEMENT
# ==============================================================================

class FinancialAccountType(models.TextChoices):
    BANK = 'BANK', 'Multiple Bank Accounts'
    CASH = 'CASH', 'Cash Accounts'
    PETTY_CASH = 'PETTY_CASH', 'Petty Cash Accounts'
    GATEWAY_CLEARING = 'GATEWAY_CLEARING', 'Payment Gateway Clearing Accounts'
    UPI_SETTLEMENT = 'UPI_SETTLEMENT', 'UPI Settlement Accounts'
    CARD_SETTLEMENT = 'CARD_SETTLEMENT', 'Card Settlement Accounts'
    INVESTMENT = 'INVESTMENT', 'Investment and Brokerage Accounts'
    FIXED_DEPOSIT = 'FIXED_DEPOSIT', 'Fixed Deposit Accounts'
    LOAN_FACILITY = 'LOAN_FACILITY', 'Loan and Credit Facility Accounts'
    PATIENT_DEPOSIT_LIABILITY = 'PATIENT_DEPOSIT_LIABILITY', 'Patient Advance & Deposit Liability Accounts'
    INSURANCE_RECEIVABLE = 'INSURANCE_RECEIVABLE', 'Insurance Receivable Accounts'
    SUPPLIER_PAYABLE = 'SUPPLIER_PAYABLE', 'Supplier Payable Accounts'


class AccountingClassification(models.TextChoices):
    ASSET = 'ASSET', 'Asset'
    LIABILITY = 'LIABILITY', 'Liability'


class AccountReconciliationStatus(models.TextChoices):
    NOT_REQUIRED = 'NOT_REQUIRED', 'Not Required'
    PENDING = 'PENDING', 'Pending Reconciliation'
    RECONCILED = 'RECONCILED', 'Reconciled'
    DISCREPANCY = 'DISCREPANCY', 'Discrepancy / Overdue'


class FinancialAccount(BaseUUIDModel):
    """
    Central Master for all Hospital Financial Accounts across 12 classifications.
    Provides strict server-side validation, balance computation, masked identifiers,
    and audit capabilities.
    """
    account_code = models.CharField(max_length=50, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    account_type = models.CharField(max_length=40, choices=FinancialAccountType.choices)
    classification = models.CharField(max_length=20, choices=AccountingClassification.choices, default=AccountingClassification.ASSET)
    institution_name = models.CharField(max_length=150, blank=True, help_text="Bank, payment gateway, broker, or lender name")
    account_holder = models.CharField(max_length=150, blank=True, default="Apex Multi-Specialty Hospital Ltd.")
    account_number_raw = models.CharField(max_length=100, blank=True, help_text="Full bank account number, gateway merchant ID, or credit reference")
    branch_name = models.CharField(max_length=100, blank=True)
    ifsc_code = models.CharField(max_length=20, blank=True)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='financial_accounts')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_accounts')
    currency = models.CharField(max_length=10, default='INR')
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    opening_balance_date = models.DateField(default=timezone.localdate)
    current_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    linked_gl_account = models.ForeignKey('ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_financial_accounts')
    legacy_bank_account = models.ForeignKey('BankAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='extended_financial_accounts')
    is_active = models.BooleanField(default=True)
    reconciliation_status = models.CharField(max_length=30, choices=AccountReconciliationStatus.choices, default=AccountReconciliationStatus.PENDING)
    last_reconciled_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_financial_accounts')

    class Meta:
        db_table = 'hms_financial_accounts'
        ordering = ['account_code']

    def __str__(self):
        return f"[{self.account_code}] {self.name} ({self.get_account_type_display()})"

    @property
    def masked_account_number(self):
        """Mask sensitive banking details in lists and unauthorized contexts."""
        if not self.account_number_raw:
            return "N/A"
        raw = self.account_number_raw.strip()
        if len(raw) <= 4:
            return raw
        return f"•••• •••• {raw[-4:]}"

    def clean(self):
        super().clean()
        # Enforce validation rules by account type
        if self.account_type in [FinancialAccountType.BANK, FinancialAccountType.FIXED_DEPOSIT] and not self.institution_name:
            raise ValidationError({'institution_name': 'Bank name or financial institution is required for bank and deposit accounts.'})
        
        # Enforce correct accounting classification default if not set correctly
        liability_types = [
            FinancialAccountType.LOAN_FACILITY,
            FinancialAccountType.PATIENT_DEPOSIT_LIABILITY,
            FinancialAccountType.SUPPLIER_PAYABLE
        ]
        if self.account_type in liability_types and self.classification != AccountingClassification.LIABILITY:
            self.classification = AccountingClassification.LIABILITY
        elif self.account_type not in liability_types and self.classification != AccountingClassification.ASSET:
            self.classification = AccountingClassification.ASSET

    def calculate_balance(self):
        """
        Dynamically calculate closing balance from eligible persisted transactions and opening balance.
        Asset: Opening + Debits - Credits
        Liability: Opening + Credits - Debits
        Excludes OPENING_BALANCE ledger transactions from the debit/credit sums to prevent double-counting.
        """
        from django.db.models import Sum
        posted_txns = self.ledger_transactions.filter(posting_status='POSTED').exclude(category='OPENING_BALANCE')
        debit_sum = posted_txns.aggregate(total=Sum('debit_amount'))['total'] or Decimal('0.00')
        credit_sum = posted_txns.aggregate(total=Sum('credit_amount'))['total'] or Decimal('0.00')

        base_opening = self.opening_balance or Decimal('0.00')
        if self.classification == AccountingClassification.ASSET:
            calc = base_opening + debit_sum - credit_sum
        else:
            calc = base_opening + credit_sum - debit_sum
        return calc, debit_sum, credit_sum



class TransactionLifecycleStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    POSTED = 'POSTED', 'Posted'
    RECONCILED = 'RECONCILED', 'Reconciled'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'
    REVERSED = 'REVERSED', 'Reversed'


class TransactionType(models.TextChoices):
    DEBIT = 'DEBIT', 'Debit (Payment / Withdrawal)'
    CREDIT = 'CREDIT', 'Credit (Receipt / Deposit)'
    TRANSFER = 'TRANSFER', 'Inter-Account Transfer'


class FinancialTransactionCategory(models.TextChoices):
    PATIENT_RECEIPT_ADVANCE = 'PATIENT_RECEIPT_ADVANCE', 'Patient Receipts & Advances'
    OPD_IPD_COLLECTION = 'OPD_IPD_COLLECTION', 'OPD & IPD Collections'
    PHARMACY_DIAGNOSTIC_COLLECTION = 'PHARMACY_DIAGNOSTIC_COLLECTION', 'Pharmacy & Diagnostic Collections'
    INSURANCE_CORPORATE_COLLECTION = 'INSURANCE_CORPORATE_COLLECTION', 'Insurance & Corporate Collections'
    SUPPLIER_VENDOR_PAYMENT = 'SUPPLIER_VENDOR_PAYMENT', 'Supplier & Vendor Payments'
    PAYROLL_PAYMENT = 'PAYROLL_PAYMENT', 'Payroll Payments'
    OPERATING_EXPENSE = 'OPERATING_EXPENSE', 'Rent, Utilities & Operating Expenses'
    STATUTORY_TAX_PAYMENT = 'STATUTORY_TAX_PAYMENT', 'Taxes & Statutory Payments'
    BANK_TRANSFER_INTERACCOUNT = 'BANK_TRANSFER_INTERACCOUNT', 'Bank-to-Bank Transfers'
    GATEWAY_SETTLEMENT_FEE = 'GATEWAY_SETTLEMENT_FEE', 'Payment Gateway Settlements & Fees'
    UPI_CARD_SETTLEMENT = 'UPI_CARD_SETTLEMENT', 'UPI & Card Settlements'
    PATIENT_REFUND_REVERSAL = 'PATIENT_REFUND_REVERSAL', 'Patient Refunds & Transaction Reversals'
    FIXED_DEPOSIT_TRANSACTION = 'FIXED_DEPOSIT_TRANSACTION', 'Fixed Deposit Placements, Maturities & Interest'
    INVESTMENT_TRANSACTION = 'INVESTMENT_TRANSACTION', 'Investment Purchases, Sales, Redemptions & Income'
    LOAN_DISBURSEMENT_REPAYMENT = 'LOAN_DISBURSEMENT_REPAYMENT', 'Loan Disbursements & Repayments'
    CAPITAL_EXPENDITURE = 'CAPITAL_EXPENDITURE', 'Capital Expenditure'
    OTHER_INCOME_EXPENSE = 'OTHER_INCOME_EXPENSE', 'Other Income & Expenses'
    # Legacy & Direct Aliases
    OPENING_BALANCE = 'OPENING_BALANCE', 'Opening Balance'
    PATIENT_COLLECTION = 'PATIENT_COLLECTION', 'Patient Collection'
    BANK_CHARGES = 'BANK_CHARGES', 'Bank Charges'


class FinancialAccountTransaction(BaseUUIDModel):
    """
    Unified Financial Transaction / Cashbook Ledger entry for financial accounts.
    Tracks double-entry credits, debits, running balances, counterparties, and links
    to payments, claims, invoices, loans, investments, and journal entries.
    Supports complete Section 14 transaction lifecycle: Draft -> Pending -> Approved -> Posted -> Reconciled.
    """
    account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name='ledger_transactions')
    transaction_number = models.CharField(max_length=60, unique=True, db_index=True)
    transaction_date = models.DateField(default=timezone.localdate)
    accounting_date = models.DateField(default=timezone.localdate)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices, default=TransactionType.DEBIT)
    category = models.CharField(max_length=50, choices=FinancialTransactionCategory.choices)
    description = models.CharField(max_length=255)
    source_account = models.CharField(max_length=100, blank=True)
    destination_account = models.CharField(max_length=100, blank=True)
    destination_financial_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='transfer_incoming_transactions')
    transfer_paired_transaction = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='paired_transfers')
    counterparty = models.CharField(max_length=150, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    debit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    payment_method = models.CharField(max_length=40, blank=True)
    reference_number = models.CharField(max_length=100, blank=True)
    posting_status = models.CharField(max_length=20, default='POSTED')  # POSTED, PENDING, REVERSED
    lifecycle_status = models.CharField(max_length=30, choices=TransactionLifecycleStatus.choices, default=TransactionLifecycleStatus.POSTED, db_index=True)
    reconciliation_status = models.CharField(max_length=20, default='UNRECONCILED')  # UNRECONCILED, RECONCILED

    # Reversal and Rejection fields
    reversal_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='reversal_transactions')
    reversal_reason = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    idempotency_key = models.CharField(max_length=100, blank=True, null=True, db_index=True)

    # Contextual linkages
    branch = models.ForeignKey('core.Branch', on_delete=models.PROTECT, null=True, blank=True, related_name='financial_transactions')
    department = models.ForeignKey('core.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')

    # Linkages to existing domain records
    payment = models.ForeignKey('billing_finance.Payment', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    patient_deposit = models.ForeignKey('billing_finance.PatientDeposit', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    claim_settlement = models.ForeignKey('billing_finance.ClaimSettlement', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    loan = models.ForeignKey('billing_finance.LoanRegister', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    investment = models.ForeignKey('billing_finance.InvestmentRegister', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')
    journal_entry = models.ForeignKey('billing_finance.JournalEntry', on_delete=models.SET_NULL, null=True, blank=True, related_name='financial_transactions')

    # Lifecycle actors and audit timestamps
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_account_transactions')
    submitted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='submitted_txns')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_account_transactions')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='rejected_txns')
    rejected_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='posted_txns')
    posted_at = models.DateTimeField(null=True, blank=True)
    reversed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='reversed_txns')
    reversed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_financial_account_transactions'
        ordering = ['-transaction_date', '-created_at']

    def __str__(self):
        return f"[{self.transaction_number}] {self.account.account_code}: Dr ₹{self.debit_amount} / Cr ₹{self.credit_amount} ({self.lifecycle_status}) - {self.description[:35]}"


class FinancialTransactionAuditLog(BaseUUIDModel):
    """
    Immutable audit record for every action, status transition, and approval decision
    in the financial transaction lifecycle.
    """
    transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)  # CREATED, SUBMITTED, APPROVED, REJECTED, POSTED, REVERSED, CANCELLED, UPDATED, DOCUMENT_ATTACHED
    from_status = models.CharField(max_length=30, blank=True)
    to_status = models.CharField(max_length=30)
    performed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='tx_audit_actions')
    comments = models.TextField(blank=True)
    ip_address = models.CharField(max_length=45, blank=True)

    class Meta:
        db_table = 'hms_financial_transaction_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.transaction.transaction_number}] {self.action}: {self.from_status} -> {self.to_status}"



class BankStatementImport(BaseUUIDModel):
    """
    Import Batch record for Bank Statements uploaded via CSV.
    Prevents silent duplicates through batch tracking and checksums.
    """
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='statement_imports')
    batch_number = models.CharField(max_length=60, unique=True, db_index=True)
    file_name = models.CharField(max_length=255)
    file_size_bytes = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='uploaded_statements')
    uploaded_at = models.DateTimeField(default=timezone.now)
    total_rows = models.PositiveIntegerField(default=0)
    imported_rows = models.PositiveIntegerField(default=0)
    duplicate_rows = models.PositiveIntegerField(default=0)
    opening_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    closing_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, default='COMPLETED')  # COMPLETED, FAILED, PARTIAL
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_bank_statement_imports'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"Batch [{self.batch_number}] - {self.account.name} ({self.imported_rows} rows imported)"


class StatementEntryStatus(models.TextChoices):
    UNMATCHED = 'UNMATCHED', 'Unmatched'
    SUGGESTED = 'SUGGESTED', 'Suggested Match'
    MATCHED = 'MATCHED', 'Confirmed Match'
    ADJUSTED = 'ADJUSTED', 'Reconciliation Adjustment'


class BankStatementEntry(BaseUUIDModel):
    """
    Individual line items from imported bank statement files.
    Preserved for reconciliation, audit, and side-by-side matching.
    """
    statement_import = models.ForeignKey(BankStatementImport, on_delete=models.CASCADE, related_name='entries')
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, related_name='statement_entries')
    entry_date = models.DateField()
    value_date = models.DateField(null=True, blank=True)
    description = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=100, blank=True)
    debit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    balance_after = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    reconciliation_status = models.CharField(max_length=25, choices=StatementEntryStatus.choices, default=StatementEntryStatus.UNMATCHED)
    matched_ledger_transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_statement_entries')
    match_confidence = models.PositiveIntegerField(default=0, help_text="Confidence percentage (0-100)")
    matched_at = models.DateTimeField(null=True, blank=True)
    matched_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='matched_statements')

    class Meta:
        db_table = 'hms_bank_statement_entries'
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f"{self.entry_date} - {self.description[:30]} Dr: ₹{self.debit_amount} Cr: ₹{self.credit_amount} ({self.reconciliation_status})"


class ReconciliationSessionStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    IN_REVIEW = 'IN_REVIEW', 'Under Review'
    RECONCILED = 'RECONCILED', 'Reconciled & Finalized'
    REJECTED = 'REJECTED', 'Rejected / Reopened'


class AccountReconciliation(BaseUUIDModel):
    """
    Formal Bank & Settlement Reconciliation Session.
    Enforces separation of duties: preparer cannot approve the reconciliation.
    """
    reconciliation_number = models.CharField(max_length=60, unique=True, db_index=True)
    account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name='reconciliations')
    statement_import = models.ForeignKey(BankStatementImport, on_delete=models.SET_NULL, null=True, blank=True, related_name='reconciliations')
    period_start = models.DateField()
    period_end = models.DateField()
    statement_closing_balance = models.DecimalField(max_digits=14, decimal_places=2)
    ledger_closing_balance = models.DecimalField(max_digits=14, decimal_places=2)
    unreconciled_difference = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=25, choices=ReconciliationSessionStatus.choices, default=ReconciliationSessionStatus.DRAFT)
    prepared_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='prepared_account_reconciliations')
    prepared_at = models.DateTimeField(default=timezone.now)
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_account_reconciliations')
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_account_reconciliations'
        ordering = ['-period_end', '-created_at']

    def __str__(self):
        return f"[{self.reconciliation_number}] {self.account.name} ({self.period_start} to {self.period_end}) - {self.status}"


class FinancialDocumentType(models.TextChoices):
    BANK_STATEMENT = 'BANK_STATEMENT', 'Bank Statement'
    ACCOUNT_OPENING = 'ACCOUNT_OPENING', 'Account Opening Document'
    DEPOSIT_RECEIPT = 'DEPOSIT_RECEIPT', 'Fixed Deposit / Investment Receipt'
    RECONCILIATION_EVIDENCE = 'RECONCILIATION_EVIDENCE', 'Reconciliation Supporting Evidence'
    TRANSACTION_VOUCHER = 'TRANSACTION_VOUCHER', 'Transaction Voucher / Receipt'
    PAYMENT_PROOF = 'PAYMENT_PROOF', 'Payment Proof / Bank UTR'
    OTHER = 'OTHER', 'Other Financial Document'


class FinancialAccountDocument(BaseUUIDModel):
    """
    Supporting Documents attached to Financial Accounts, Transactions, and Reconciliation records.
    Restricted to authorized finance staff with server-side validation.
    """
    account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    investment = models.ForeignKey(InvestmentRegister, on_delete=models.CASCADE, null=True, blank=True, related_name='financial_account_documents')
    reconciliation = models.ForeignKey(AccountReconciliation, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    document_type = models.CharField(max_length=35, choices=FinancialDocumentType.choices, default=FinancialDocumentType.TRANSACTION_VOUCHER)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='financial_documents/%Y/%m/')
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='uploaded_financial_documents')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_financial_account_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        code = self.account.account_code if self.account else (self.transaction.transaction_number if self.transaction else (self.investment.investment_code if self.investment else "DOC-FIN"))
        return f"{self.title} ({self.get_document_type_display()}) - {code}"


# ==============================================================================
# SECTION 15: INVESTMENT PORTFOLIO MANAGEMENT MODELS
# ==============================================================================

class InvestmentIncomeType(models.TextChoices):
    INTEREST = 'INTEREST', 'Interest Income'
    DIVIDEND = 'DIVIDEND', 'Dividend Income'
    CAPITAL_DISTRIBUTION = 'CAPITAL_DISTRIBUTION', 'Capital Distribution / Gain'
    OTHER = 'OTHER', 'Other Investment Income'


class InvestmentIncomeRecord(BaseUUIDModel):
    """
    Hospital Treasury Investment Income Receipts (Interest & Dividends).
    Integrates directly with Section 13 Financial Accounts and Section 14 Financial Transactions.
    """
    investment = models.ForeignKey(InvestmentRegister, on_delete=models.CASCADE, related_name='income_records')
    income_type = models.CharField(max_length=30, choices=InvestmentIncomeType.choices, default=InvestmentIncomeType.INTEREST)
    receipt_date = models.DateField()
    gross_amount = models.DecimalField(max_digits=14, decimal_places=2)
    tds_withheld = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), help_text="Tax Deducted at Source")
    net_amount = models.DecimalField(max_digits=14, decimal_places=2)
    
    # Linked Section 13 receiving account and Section 14 transaction
    receiving_account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name='investment_incomes')
    financial_transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='investment_income_records')
    reference_number = models.CharField(max_length=100, blank=True, default='', help_text="Bank UTR / Broker Credit Reference")
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='recorded_investment_incomes')

    class Meta:
        db_table = 'hms_investment_income_records'
        ordering = ['-receipt_date', '-created_at']

    def __str__(self):
        return f"{self.investment.investment_code} {self.get_income_type_display()} - Net ₹{self.net_amount} ({self.receipt_date})"


class InvestmentValuationHistory(BaseUUIDModel):
    """
    Mark-to-Market Valuation History for Hospital Treasury Portfolio.
    Records historical valuations, NAV updates, and unrealized yield.
    """
    investment = models.ForeignKey(InvestmentRegister, on_delete=models.CASCADE, related_name='valuation_history')
    valuation_date = models.DateField()
    unit_price_or_nav = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    total_valuation = models.DecimalField(max_digits=14, decimal_places=2)
    valuation_source = models.CharField(max_length=100, default='Manual Appraisal / Statement')
    unrealized_gain_loss = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='recorded_valuations')

    class Meta:
        db_table = 'hms_investment_valuation_history'
        ordering = ['-valuation_date', '-created_at']

    def __str__(self):
        return f"{self.investment.investment_code} Valuation ₹{self.total_valuation} on {self.valuation_date}"


class InvestmentAuditLog(BaseUUIDModel):
    """
    Immutable Chronological Audit Trail for Section 15 Investment Portfolio.
    Records creation, approval, purchase, income receipt, valuation updates, redemption, and closure.
    """
    investment = models.ForeignKey(InvestmentRegister, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='investment_audit_logs')
    actor_name = models.CharField(max_length=150, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)
    previous_status = models.CharField(max_length=30, blank=True, default='')
    new_status = models.CharField(max_length=30, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_investment_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.investment.investment_code} - {self.action} by {self.actor_name or 'System'} at {self.created_at}"


class InvestmentDocumentType(models.TextChoices):
    DEPOSIT_CERTIFICATE = 'DEPOSIT_CERTIFICATE', 'Fixed Deposit Certificate'
    BROKER_CONTRACT = 'BROKER_CONTRACT', 'Broker Confirmation / Contract Note'
    VALUATION_STATEMENT = 'VALUATION_STATEMENT', 'Valuation / NAV Statement'
    TAX_CERTIFICATE = 'TAX_CERTIFICATE', 'TDS Withholding Certificate'
    REDEMPTION_ADVICE = 'REDEMPTION_ADVICE', 'Redemption / Maturity Payout Advice'
    OTHER = 'OTHER', 'Other Investment Document'


class InvestmentDocument(BaseUUIDModel):
    """
    Supporting Documents attached to Hospital Treasury Investments.
    Certificates, deposit slips, fund statements, TDS vouchers.
    """
    investment = models.ForeignKey(InvestmentRegister, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=40, choices=InvestmentDocumentType.choices, default=InvestmentDocumentType.DEPOSIT_CERTIFICATE)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='investment_documents/%Y/%m/')
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='uploaded_investment_documents')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_investment_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} ({self.get_document_type_display()}) - {self.investment.investment_code}"


# ==============================================================================
# SECTION 16: LOAN AND LIABILITY MANAGEMENT MODELS
# ==============================================================================

class RepaymentInstallmentStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Paid'
    OVERDUE = 'OVERDUE', 'Overdue'


class LoanRepaymentSchedule(BaseUUIDModel):
    """
    Detailed Amortization & Repayment Schedule installments for Hospital Term Loans.
    Stores principal, interest, fees, opening and closing balance per installment.
    """
    loan = models.ForeignKey(LoanRegister, on_delete=models.CASCADE, related_name='repayment_schedules')
    installment_number = models.PositiveIntegerField()
    due_date = models.DateField(db_index=True)
    opening_principal = models.DecimalField(max_digits=14, decimal_places=2)
    principal_due = models.DecimalField(max_digits=14, decimal_places=2)
    interest_due = models.DecimalField(max_digits=14, decimal_places=2)
    fee_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_due = models.DecimalField(max_digits=14, decimal_places=2)
    closing_principal = models.DecimalField(max_digits=14, decimal_places=2)
    
    # Payments tracked against this installment
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    paid_principal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    paid_interest = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    paid_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    payment_date = models.DateField(null=True, blank=True)
    payment_status = models.CharField(max_length=25, choices=RepaymentInstallmentStatus.choices, default=RepaymentInstallmentStatus.PENDING)
    notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'hms_loan_repayment_schedules'
        ordering = ['loan', 'installment_number']
        unique_together = ('loan', 'installment_number')

    def __str__(self):
        return f"{self.loan.loan_account_number} Installment #{self.installment_number} Due: {self.due_date} (₹{self.total_due} - {self.payment_status})"


class LoanRepaymentRecord(BaseUUIDModel):
    """
    Actual Repayment Transactions executed against Hospital Loans.
    Integrates directly with Section 13 Financial Accounts and Section 14 Financial Transactions.
    """
    loan = models.ForeignKey(LoanRegister, on_delete=models.CASCADE, related_name='repayment_records')
    installment = models.ForeignKey(LoanRepaymentSchedule, on_delete=models.SET_NULL, null=True, blank=True, related_name='repayment_records')
    repayment_number = models.CharField(max_length=60, unique=True, db_index=True)
    repayment_date = models.DateField(default=timezone.localdate)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    principal_amount = models.DecimalField(max_digits=14, decimal_places=2)
    interest_amount = models.DecimalField(max_digits=14, decimal_places=2)
    fee_or_penalty = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    payment_method = models.CharField(max_length=40, default='BANK_TRANSFER')
    reference_number = models.CharField(max_length=100, blank=True, default='', help_text="Bank UTR / Transaction Reference")
    servicing_account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name='loan_repayment_records')
    financial_transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='loan_repayment_records')
    is_early_payoff = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='recorded_loan_repayments')

    class Meta:
        db_table = 'hms_loan_repayment_records'
        ordering = ['-repayment_date', '-created_at']

    def __str__(self):
        return f"[{self.repayment_number}] {self.loan.loan_account_number} - ₹{self.total_amount} (Principal ₹{self.principal_amount}, Interest ₹{self.interest_amount})"


class LiabilityCategory(models.TextChoices):
    SUPPLIER_PAYABLE = 'SUPPLIER_PAYABLE', 'Supplier & Vendor Payables'
    EQUIPMENT_PAYABLE = 'EQUIPMENT_PAYABLE', 'Equipment Purchase Payables'
    OPERATING_EXPENSE = 'OPERATING_EXPENSE', 'Operating Expenses Payable'
    ACCRUED_EXPENSE = 'ACCRUED_EXPENSE', 'Accrued Expenses & Salaries'
    STATUTORY_TAX_PAYABLE = 'STATUTORY_TAX_PAYABLE', 'Statutory Duties & Taxes'
    OTHER_LIABILITY = 'OTHER_LIABILITY', 'Other Legitimate Obligations'


class LiabilityTenureType(models.TextChoices):
    SHORT_TERM = 'SHORT_TERM', 'Short-Term Liability (<= 12 Months)'
    LONG_TERM = 'LONG_TERM', 'Long-Term Liability (> 12 Months)'


class LiabilityPaymentStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending'
    PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
    PAID = 'PAID', 'Paid'
    OVERDUE = 'OVERDUE', 'Overdue'
    CANCELLED = 'CANCELLED', 'Cancelled'


class LiabilityPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'


class HospitalLiability(BaseUUIDModel):
    """
    Central Ledger for Hospital Financial Obligations and Liabilities:
    - Supplier/Vendor Payables (reusing Section 10 Supplier & SupplierInvoice)
    - Medical Equipment Financing / Purchases
    - Rent, Utilities, and Operating Expenses
    - Accrued Expenses and Statutory Taxes
    - Short-Term and Long-Term Obligations
    """
    liability_number = models.CharField(max_length=60, unique=True, db_index=True)
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=40, choices=LiabilityCategory.choices, default=LiabilityCategory.SUPPLIER_PAYABLE)
    tenure_type = models.CharField(max_length=20, choices=LiabilityTenureType.choices, default=LiabilityTenureType.SHORT_TERM)
    creditor_name = models.CharField(max_length=150)
    creditor_reference = models.CharField(max_length=100, blank=True, default='', help_text="Vendor Invoice / Bill Ref")
    
    # Direct integration with Section 10 Pharmacy/Inventory without duplicating
    linked_supplier = models.ForeignKey('pharmacy_inventory.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='hospital_liabilities')
    linked_supplier_invoice = models.ForeignKey('pharmacy_inventory.SupplierInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='hospital_liabilities')
    
    # Financial amounts
    original_amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    outstanding_amount = models.DecimalField(max_digits=14, decimal_places=2)
    
    # Dates & status
    incurred_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(db_index=True)
    payment_status = models.CharField(max_length=25, choices=LiabilityPaymentStatus.choices, default=LiabilityPaymentStatus.PENDING)
    priority = models.CharField(max_length=20, choices=LiabilityPriority.choices, default=LiabilityPriority.MEDIUM)
    
    # Linked Section 13 Chart of Accounts / Financial Account
    liability_financial_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_liabilities')
    
    # Branch & Department
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='hospital_liabilities')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='hospital_liabilities')
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_liabilities')

    class Meta:
        db_table = 'hms_hospital_liabilities'
        ordering = ['due_date', '-created_at']

    def __str__(self):
        return f"[{self.liability_number}] {self.creditor_name}: {self.title} - Outstanding ₹{self.outstanding_amount} ({self.payment_status})"


class LiabilityPaymentRecord(BaseUUIDModel):
    """
    Payments made towards Hospital Liabilities.
    Debits the servicing financial account and records Section 14 Financial Account Transaction.
    """
    liability = models.ForeignKey(HospitalLiability, on_delete=models.CASCADE, related_name='payments')
    payment_number = models.CharField(max_length=60, unique=True, db_index=True)
    payment_date = models.DateField(default=timezone.localdate)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=40, default='BANK_TRANSFER')
    reference_number = models.CharField(max_length=100, blank=True, default='', help_text="Bank UTR / Transaction Reference")
    servicing_account = models.ForeignKey(FinancialAccount, on_delete=models.PROTECT, related_name='liability_payments')
    financial_transaction = models.ForeignKey(FinancialAccountTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name='liability_payment_records')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='recorded_liability_payments')

    class Meta:
        db_table = 'hms_liability_payment_records'
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"[{self.payment_number}] Paid ₹{self.amount} for {self.liability.liability_number} ({self.payment_date})"


class LoanAuditLog(BaseUUIDModel):
    """
    Immutable chronological audit trail for Loan Management (Section 16).
    Records creation, terms amendments, approvals, disbursements, repayments, and closures.
    """
    loan = models.ForeignKey(LoanRegister, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='loan_audit_logs')
    actor_name = models.CharField(max_length=150, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)
    previous_status = models.CharField(max_length=30, blank=True, default='')
    new_status = models.CharField(max_length=30, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_loan_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.loan.loan_account_number} - {self.action} by {self.actor_name or 'System'} at {self.created_at}"


class LiabilityAuditLog(BaseUUIDModel):
    """
    Immutable chronological audit trail for Liability Management (Section 16).
    Records creation, priority adjustments, payments, write-offs, and settlements.
    """
    liability = models.ForeignKey(HospitalLiability, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50)
    actor = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='liability_audit_logs')
    actor_name = models.CharField(max_length=150, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)
    previous_status = models.CharField(max_length=30, blank=True, default='')
    new_status = models.CharField(max_length=30, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_liability_audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.liability.liability_number} - {self.action} by {self.actor_name or 'System'} at {self.created_at}"


class LoanDocumentType(models.TextChoices):
    SANCTION_LETTER = 'SANCTION_LETTER', 'Sanction Letter'
    LOAN_AGREEMENT = 'LOAN_AGREEMENT', 'Loan Agreement'
    COLLATERAL_DEED = 'COLLATERAL_DEED', 'Collateral / Hypothecation Deed'
    PROMISSORY_NOTE = 'PROMISSORY_NOTE', 'Promissory Note'
    REPAYMENT_SCHEDULE = 'REPAYMENT_SCHEDULE', 'Amortization / Repayment Schedule'
    NOC_CERTIFICATE = 'NOC_CERTIFICATE', 'No Objection / Closure Certificate'
    OTHER = 'OTHER', 'Other Loan Document'


class LoanDocument(BaseUUIDModel):
    """
    Supporting Documents attached to Hospital Loans.
    """
    loan = models.ForeignKey(LoanRegister, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=40, choices=LoanDocumentType.choices, default=LoanDocumentType.SANCTION_LETTER)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='loan_documents/%Y/%m/')
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='uploaded_loan_documents')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_loan_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} ({self.get_document_type_display()}) - {self.loan.loan_account_number}"


class LiabilityDocumentType(models.TextChoices):
    VENDOR_INVOICE = 'VENDOR_INVOICE', 'Vendor / Supplier Invoice'
    PURCHASE_ORDER = 'PURCHASE_ORDER', 'Purchase Order'
    CONTRACT_AGREEMENT = 'CONTRACT_AGREEMENT', 'Contract / Agreement'
    PAYMENT_RECEIPT = 'PAYMENT_RECEIPT', 'Payment Receipt / Bank UTR'
    TAX_CHALLAN = 'TAX_CHALLAN', 'Tax / Statutory Challan'
    OTHER = 'OTHER', 'Other Liability Document'


class LiabilityDocument(BaseUUIDModel):
    """
    Supporting Documents attached to Hospital Liabilities.
    """
    liability = models.ForeignKey(HospitalLiability, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=40, choices=LiabilityDocumentType.choices, default=LiabilityDocumentType.VENDOR_INVOICE)
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='liability_documents/%Y/%m/')
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='uploaded_liability_documents')
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_liability_documents'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.title} ({self.get_document_type_display()}) - {self.liability.liability_number}"


# ==============================================================================
# SECTION 19: CASH FLOW AND FINANCIAL PLANNING MODELS
# ==============================================================================

class BudgetPeriodType(models.TextChoices):
    ANNUAL = 'ANNUAL', 'Annual Hospital Budget'
    MONTHLY = 'MONTHLY', 'Monthly Department Budget'
    QUARTERLY = 'QUARTERLY', 'Quarterly Horizon Budget'


class BudgetCategoryType(models.TextChoices):
    EXPENSE = 'EXPENSE', 'Operating Expense Budget'
    REVENUE = 'REVENUE', 'Operating Revenue Budget'
    CAPEX = 'CAPEX', 'Capital Expenditure Budget'
    COMPREHENSIVE = 'COMPREHENSIVE', 'Comprehensive Master Budget'


class BudgetApprovalStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REVISED = 'REVISED', 'Revised'
    CLOSED = 'CLOSED', 'Closed'


class FinancialBudget(BaseUUIDModel):
    """
    Hospital Budget Management for Monthly, Quarterly, and Annual Fiscal Planning.
    Supports role-based authorization: Draft -> Pending Approval -> Approved -> Closed,
    with immutable historical tracking and revisions.
    """
    budget_code = models.CharField(max_length=60, unique=True, db_index=True)
    fiscal_year = models.CharField(max_length=15, default="2026-2027", help_text="e.g. 2026-2027")
    period_type = models.CharField(max_length=20, choices=BudgetPeriodType.choices, default=BudgetPeriodType.ANNUAL)
    month = models.PositiveSmallIntegerField(null=True, blank=True, help_text="1 to 12 for monthly budgets")
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='financial_budgets')
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name='financial_budgets')
    budget_type = models.CharField(max_length=20, choices=BudgetCategoryType.choices, default=BudgetCategoryType.EXPENSE)
    total_budget_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    actual_spent_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=25, choices=BudgetApprovalStatus.choices, default=BudgetApprovalStatus.DRAFT, db_index=True)
    notes_assumptions = models.TextField(blank=True)
    prepared_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='prepared_budgets')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='approved_budgets')
    approved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_financial_budgets'
        ordering = ['-created_at']

    def __str__(self):
        dept_str = self.department.name if self.department else "Hospital-Wide"
        return f"[{self.budget_code}] {dept_str} - FY {self.fiscal_year} (₹{self.total_budget_amount})"

    @property
    def variance_amount(self):
        """Variance = Actual - Budget. Positive = Overspending for expenses."""
        return self.actual_spent_amount - self.total_budget_amount

    @property
    def utilization_percentage(self):
        if not self.total_budget_amount or self.total_budget_amount == Decimal('0.00'):
            return Decimal('0.00')
        return round((self.actual_spent_amount / self.total_budget_amount) * Decimal('100.00'), 2)


class BudgetLineItem(BaseUUIDModel):
    """
    Detailed Line Item allocation under a Financial Budget.
    """
    budget = models.ForeignKey(FinancialBudget, on_delete=models.CASCADE, related_name='line_items')
    category_name = models.CharField(max_length=120)
    chart_of_account = models.ForeignKey('ChartOfAccount', on_delete=models.SET_NULL, null=True, blank=True, related_name='budget_line_items')
    allocated_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    utilized_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_budget_line_items'
        ordering = ['category_name']

    def __str__(self):
        return f"{self.category_name}: ₹{self.allocated_amount} (Budget: {self.budget.budget_code})"


class BudgetRevision(BaseUUIDModel):
    """
    Audit log of formal budget revisions and amount adjustments for approved budgets.
    """
    budget = models.ForeignKey(FinancialBudget, on_delete=models.CASCADE, related_name='revisions')
    revision_number = models.PositiveIntegerField(default=1)
    previous_amount = models.DecimalField(max_digits=14, decimal_places=2)
    revised_amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    revised_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='budget_revisions')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'hms_budget_revisions'
        ordering = ['-created_at']

    def __str__(self):
        return f"Revision #{self.revision_number} for {self.budget.budget_code} (₹{self.previous_amount} -> ₹{self.revised_amount})"


class CapexStatus(models.TextChoices):
    PROPOSED = 'PROPOSED', 'Proposed'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
    APPROVED_COMMITMENT = 'APPROVED_COMMITMENT', 'Approved Commitment'
    PURCHASED = 'PURCHASED', 'Purchased / Commissioned'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'


class CapitalExpenditurePlan(BaseUUIDModel):
    """
    Capital Expenditure (CapEx) Planning and Acquisition Pipeline.
    Distinguishes proposed expenditure, approved commitment, actual purchase, and cash outflow.
    """
    capex_code = models.CharField(max_length=60, unique=True, db_index=True)
    project_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    business_justification = models.TextField()
    requesting_department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='capex_plans')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='capex_plans')
    estimated_cost = models.DecimalField(max_digits=14, decimal_places=2)
    expected_purchase_date = models.DateField()
    proposed_payment_schedule = models.TextField(blank=True, help_text="e.g. 30% advance, 50% delivery, 20% warranty retention")
    budget_allocation = models.ForeignKey(FinancialBudget, on_delete=models.SET_NULL, null=True, blank=True, related_name='capex_allocations')
    status = models.CharField(max_length=30, choices=CapexStatus.choices, default=CapexStatus.PROPOSED)
    actual_expenditure = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    supplier_reference = models.CharField(max_length=200, blank=True)
    related_asset = models.ForeignKey('pharmacy_inventory.HospitalAsset', on_delete=models.SET_NULL, null=True, blank=True, related_name='capex_records')
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='requested_capex_plans')
    approved_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_capex_plans')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_capital_expenditure_plans'
        ordering = ['-expected_purchase_date']

    def __str__(self):
        return f"[{self.capex_code}] {self.project_name} - ₹{self.estimated_cost} ({self.status})"


class ThresholdSeverity(models.TextChoices):
    LOW = 'LOW', 'Low Priority'
    MEDIUM = 'MEDIUM', 'Medium Priority'
    HIGH = 'HIGH', 'High Priority'
    CRITICAL = 'CRITICAL', 'Critical Immediate Action'


class MinimumCashThreshold(BaseUUIDModel):
    """
    Configurable minimum liquidity safety margins for individual accounts or entire hospital.
    """
    financial_account = models.ForeignKey(FinancialAccount, on_delete=models.CASCADE, null=True, blank=True, related_name='minimum_cash_thresholds')
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, null=True, blank=True, related_name='minimum_cash_thresholds')
    is_hospital_wide = models.BooleanField(default=False)
    threshold_amount = models.DecimalField(max_digits=14, decimal_places=2)
    alert_severity = models.CharField(max_length=20, choices=ThresholdSeverity.choices, default=ThresholdSeverity.HIGH)
    notify_roles = models.CharField(max_length=255, default='CHIEF_FINANCIAL_OFFICER,FINANCE_MANAGER')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='created_cash_thresholds')

    class Meta:
        db_table = 'hms_minimum_cash_thresholds'
        ordering = ['-threshold_amount']

    def __str__(self):
        target = self.financial_account.name if self.financial_account else "Hospital Consolidated"
        return f"Min Threshold: {target} >= ₹{self.threshold_amount} ({self.alert_severity})"


class LiquidityAlertType(models.TextChoices):
    ACCOUNT_BELOW_MINIMUM = 'ACCOUNT_BELOW_MINIMUM', 'Account Below Minimum Threshold'
    FORECAST_DEFICIT = 'FORECAST_DEFICIT', 'Forecast Liquidity Deficit'
    LARGE_PAYMENT_DUE = 'LARGE_PAYMENT_DUE', 'Large Imminent Payment'
    PAYROLL_TAX_DUE = 'PAYROLL_TAX_DUE', 'Upcoming Payroll or Tax Obligation'
    LOAN_INSTALLMENT_DUE = 'LOAN_INSTALLMENT_DUE', 'Upcoming Loan Repayment'
    INVESTMENT_MATURED_UNSETTLED = 'INVESTMENT_MATURED_UNSETTLED', 'Matured Investment Awaiting Payout'
    RECEIVABLE_OVERDUE = 'RECEIVABLE_OVERDUE', 'Overdue Patient / Insurance Receivable'


class LiquidityAlert(BaseUUIDModel):
    """
    Dynamic Treasury & Liquidity Risk Alerts computed from real financial accounts,
    schedules, loan obligations, payroll, and cash forecasts.
    """
    alert_type = models.CharField(max_length=40, choices=LiquidityAlertType.choices)
    severity = models.CharField(max_length=20, choices=ThresholdSeverity.choices, default=ThresholdSeverity.HIGH)
    financial_account = models.ForeignKey(FinancialAccount, on_delete=models.SET_NULL, null=True, blank=True, related_name='liquidity_alerts')
    title = models.CharField(max_length=255)
    message = models.TextField()
    obligation_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    due_date = models.DateField(null=True, blank=True)
    recommended_action = models.TextField(blank=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='acknowledged_liquidity_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_liquidity_alerts'
        ordering = ['is_acknowledged', '-created_at']

    def __str__(self):
        return f"[{self.severity}] {self.title} - ₹{self.obligation_amount}"


class CashFlowForecastAssumption(BaseUUIDModel):
    """
    Documented forecasting assumptions for calculating expected collections and payouts.
    """
    name = models.CharField(max_length=150, default='Standard Hospital Horizon Model')
    horizon_days = models.IntegerField(default=30)
    patient_realization_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.85'), help_text="e.g. 0.85 = 85% collection rate")
    insurance_realization_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.90'), help_text="e.g. 0.90 = 90% claim realization rate")
    include_planned_capex = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    is_default = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_cash_flow_forecast_assumptions'
        ordering = ['-is_default', 'horizon_days']

    def __str__(self):
        return f"{self.name} ({self.horizon_days} Days Horizon)"



