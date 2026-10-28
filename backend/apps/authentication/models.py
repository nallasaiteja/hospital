import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import BaseUUIDModel, Hospital, Branch, Department


class RoleEnum(models.TextChoices):
    # The 21 PDF-defined roles
    SUPER_ADMIN = 'SUPER_ADMIN', 'Super Administrator'
    HOSPITAL_ADMIN = 'HOSPITAL_ADMIN', 'Hospital Administrator'
    BRANCH_MANAGER = 'BRANCH_MANAGER', 'Branch Manager (Hospital Administrator)'  # Preserved backward-compatible alias
    MEDICAL_DIRECTOR = 'MEDICAL_DIRECTOR', 'Medical Director'
    DOCTOR = 'DOCTOR', 'Doctor'
    NURSE = 'NURSE', 'Nurse'
    RECEPTIONIST = 'RECEPTIONIST', 'Receptionist'
    BILLING_EXECUTIVE = 'BILLING_EXECUTIVE', 'Billing Executive'
    LAB_TECHNICIAN = 'LAB_TECHNICIAN', 'Laboratory Technician'
    RADIOLOGY_TECHNICIAN = 'RADIOLOGY_TECHNICIAN', 'Radiology Technician'
    PHARMACIST = 'PHARMACIST', 'Pharmacist'
    INVENTORY_MANAGER = 'INVENTORY_MANAGER', 'Inventory Manager'
    PROCUREMENT_OFFICER = 'PROCUREMENT_OFFICER', 'Procurement Officer'
    ACCOUNTANT = 'ACCOUNTANT', 'Accountant'
    FINANCE_MANAGER = 'FINANCE_MANAGER', 'Finance Manager'
    INVESTMENT_MANAGER = 'INVESTMENT_MANAGER', 'Investment Manager'
    CASHIER = 'CASHIER', 'Cashier'
    INSURANCE_COORDINATOR = 'INSURANCE_COORDINATOR', 'Insurance Coordinator'
    HR_MANAGER = 'HR_MANAGER', 'HR Manager'
    DEPARTMENT_HEAD = 'DEPARTMENT_HEAD', 'Department Head'
    AUDITOR = 'AUDITOR', 'Auditor'
    PATIENT = 'PATIENT', 'Patient'


class Permission(BaseUUIDModel):
    """
    Granular permission tokens assigned to roles.
    """
    code = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150)
    module = models.CharField(max_length=50, db_index=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_permissions'
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'
        ordering = ['module', 'code']

    def __str__(self):
        return f"{self.module}:{self.code}"


class Role(BaseUUIDModel):
    """
    Role definitions that govern staff and patient authorization levels.
    """
    name = models.CharField(max_length=50, unique=True, choices=RoleEnum.choices)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    permissions = models.ManyToManyField(Permission, blank=True, related_name='roles')

    class Meta:
        db_table = 'hms_roles'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'

    def __str__(self):
        return self.display_name


class UserProfile(BaseUUIDModel):
    """
    Primary user profile linked directly to Supabase Auth auth.users(id).
    Does NOT duplicate passwords or password hashes.
    """
    supabase_user_id = models.UUIDField(unique=True, db_index=True, help_text="Supabase Auth UUID")
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=25, blank=True)
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='users')
    avatar_url = models.URLField(max_length=500, blank=True)
    is_verified = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_user_profiles'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
        ordering = ['-created_at']

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return f"{self.full_name} ({self.role.name}) - {self.email}"


class StaffStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    ON_LEAVE = 'ON_LEAVE', 'On Leave'
    SUSPENDED = 'SUSPENDED', 'Suspended'
    RESIGNED = 'RESIGNED', 'Resigned'


class StaffProfile(BaseUUIDModel):
    """
    Clinical, operational, and administrative staff profile strictly provisioned by administrators.
    Never registered publicly.
    """
    user_profile = models.OneToOneField(UserProfile, on_delete=models.CASCADE, related_name='staff_profile')
    hospital = models.ForeignKey(Hospital, on_delete=models.PROTECT, related_name='staff_members')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='staff_members')
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_members')
    employee_id = models.CharField(max_length=50, unique=True, db_index=True)
    designation = models.CharField(max_length=120)
    specialization = models.CharField(max_length=150, blank=True)
    medical_license_number = models.CharField(max_length=100, blank=True)
    qualification = models.CharField(max_length=200, blank=True)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=StaffStatus.choices, default=StaffStatus.ACTIVE)
    is_on_duty = models.BooleanField(default=True)
    joining_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'hms_staff_profiles'
        verbose_name = 'Staff Profile'
        verbose_name_plural = 'Staff Profiles'
        ordering = ['employee_id']

    def __str__(self):
        return f"[{self.employee_id}] {self.user_profile.full_name} - {self.designation} ({self.branch.name})"


class GenderEnum(models.TextChoices):
    MALE = 'MALE', 'Male'
    FEMALE = 'FEMALE', 'Female'
    OTHER = 'OTHER', 'Other'


class BloodGroupEnum(models.TextChoices):
    A_POS = 'A+', 'A+'
    A_NEG = 'A-', 'A-'
    B_POS = 'B+', 'B+'
    B_NEG = 'B-', 'B-'
    AB_POS = 'AB+', 'AB+'
    AB_NEG = 'AB-', 'AB-'
    O_POS = 'O+', 'O+'
    O_NEG = 'O-', 'O-'


class PatientStatusEnum(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    INACTIVE = 'INACTIVE', 'Inactive'
    MERGED = 'MERGED', 'Merged'


class ConsentType(models.TextChoices):
    GENERAL_TREATMENT = 'GENERAL_TREATMENT', 'General Medical Treatment'
    SURGERY_ANESTHESIA = 'SURGERY_ANESTHESIA', 'Surgical & Anesthesia Consent'
    DATA_SHARING = 'DATA_SHARING', 'Health Records & Data Sharing'
    TELEMEDICINE = 'TELEMEDICINE', 'Telemedicine Consultation'
    RESEARCH = 'RESEARCH', 'Clinical Research & Study'


class ConsentStatus(models.TextChoices):
    GRANTED = 'GRANTED', 'Granted'
    REVOKED = 'REVOKED', 'Revoked'
    EXPIRED = 'EXPIRED', 'Expired'


class PatientProfile(BaseUUIDModel):
    """
    Patient identity, medical identifiers, emergency contacts, insurance details,
    demographics, consent, and merge tracking.
    """
    user_profile = models.OneToOneField(UserProfile, on_delete=models.CASCADE, related_name='patient_profile')
    primary_branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name='patients')
    medical_record_number = models.CharField(max_length=50, unique=True, db_index=True, help_text="Hospital unique MRN")
    status = models.CharField(max_length=20, choices=PatientStatusEnum.choices, default=PatientStatusEnum.ACTIVE, db_index=True)
    merged_into = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='merged_records')
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, choices=GenderEnum.choices)
    blood_group = models.CharField(max_length=5, choices=BloodGroupEnum.choices, blank=True)
    photo_url = models.URLField(max_length=500, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default='India', blank=True)
    emergency_contact_name = models.CharField(max_length=120, blank=True)
    emergency_contact_phone = models.CharField(max_length=25, blank=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True)
    allergies = models.JSONField(default=list, blank=True)  # List of objects or strings: [{"allergen": "Penicillin", "severity": "HIGH", "reaction": "Anaphylaxis"}]
    chronic_conditions = models.JSONField(default=list, blank=True)  # List of chronic conditions: ["Type 2 Diabetes", "Hypertension"]
    past_medical_history = models.JSONField(default=list, blank=True)  # List of past illnesses/conditions
    past_surgical_history = models.JSONField(default=list, blank=True)  # List of past surgeries
    family_history = models.TextField(blank=True)
    social_history = models.TextField(blank=True)
    insurance_provider = models.CharField(max_length=150, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'hms_patient_profiles'
        verbose_name = 'Patient Profile'
        verbose_name_plural = 'Patient Profiles'
        ordering = ['medical_record_number']

    def __str__(self):
        return f"[{self.medical_record_number}] {self.user_profile.full_name}"

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        import datetime
        today = datetime.date.today()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )


class PatientConsent(BaseUUIDModel):
    """
    Legal consent records, surgical waivers, and data sharing authorizations.
    """
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='consents')
    consent_type = models.CharField(max_length=30, choices=ConsentType.choices, default=ConsentType.GENERAL_TREATMENT)
    status = models.CharField(max_length=20, choices=ConsentStatus.choices, default=ConsentStatus.GRANTED)
    recorded_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_consents')
    recorded_at = models.DateTimeField(default=timezone.now)
    document_url = models.URLField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    revocation_reason = models.TextField(blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hms_patient_consents'
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.patient.medical_record_number} - {self.get_consent_type_display()} [{self.status}]"


class PatientDocument(BaseUUIDModel):
    """
    Encrypted / secured patient documents, IDs, external records, and consent scans.
    """
    DOCUMENT_TYPES = [
        ('GOVT_ID', 'Government ID / National Card'),
        ('INSURANCE_CARD', 'Insurance Card / TPA Letter'),
        ('CONSENT_FORM', 'Signed Consent Form'),
        ('EXTERNAL_REPORT', 'External Medical / Imaging Report'),
        ('DISCHARGE_SUMMARY', 'Discharge Summary'),
        ('OTHER', 'Other Supporting Clinical Document'),
    ]
    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPES, default='OTHER')
    title = models.CharField(max_length=200)
    file_url = models.URLField(max_length=500)
    file_size_kb = models.PositiveIntegerField(default=0)
    mime_type = models.CharField(max_length=100, default='application/pdf')
    uploaded_by = models.ForeignKey(StaffProfile, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_patient_documents')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'hms_patient_documents'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.patient.medical_record_number} - {self.title} ({self.document_type})"


# =====================================================================
# SECTION 4: FINANCIAL APPROVAL LIMITS & SEPARATION OF DUTIES MODELS
# =====================================================================

class FinancialOperationType(models.TextChoices):
    INVOICE_ADJUSTMENT = 'INVOICE_ADJUSTMENT', 'Invoice Discount / Adjustment'
    REFUND_REVERSAL = 'REFUND_REVERSAL', 'Patient Refund & Payment Reversal'
    SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT', 'Supplier & Vendor Payment'
    PURCHASE_APPROVAL = 'PURCHASE_APPROVAL', 'Purchase Order Approval'
    JOURNAL_POSTING = 'JOURNAL_POSTING', 'General Ledger Journal Posting'
    INVESTMENT_TRANSACTION = 'INVESTMENT_TRANSACTION', 'Treasury & Investment Liquidation'
    WRITE_OFF = 'WRITE_OFF', 'Bad Debt / Bad Batch Write-off'


class FinancialApprovalPolicy(BaseUUIDModel):
    """
    Configurable financial approval thresholds by operation and assigned role.
    Enforces separation of duties and prevents unauthorized posting/reversals.
    """
    operation_type = models.CharField(max_length=40, choices=FinancialOperationType.choices, db_index=True)
    min_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)
    max_amount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    approver_role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name='approval_policies')
    requires_separation_of_duties = models.BooleanField(
        default=True,
        help_text="When True, transaction creator can never approve their own request."
    )
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True, related_name='approval_policies')
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'hms_financial_approval_policies'
        ordering = ['operation_type', 'min_amount']

    def __str__(self):
        max_str = f" to ₹{self.max_amount}" if self.max_amount else "+"
        return f"{self.get_operation_type_display()} [₹{self.min_amount}{max_str}] -> {self.approver_role.display_name}"


class ApprovalRequestStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Approval'
    APPROVED = 'APPROVED', 'Approved'
    REJECTED = 'REJECTED', 'Rejected'
    CANCELLED = 'CANCELLED', 'Cancelled'


class FinancialApprovalRequest(BaseUUIDModel):
    """
    Approval requests for financial transactions exceeding limits or requiring separation of duties.
    """
    request_number = models.CharField(max_length=50, unique=True, db_index=True)
    operation_type = models.CharField(max_length=40, choices=FinancialOperationType.choices)
    entity_type = models.CharField(max_length=50, help_text="e.g. Invoice, JournalEntry, Payment, PurchaseOrder")
    entity_id = models.UUIDField(db_index=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    reason = models.TextField()
    requested_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, related_name='requested_approvals')
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, null=True, blank=True)
    status = models.CharField(max_length=20, choices=ApprovalRequestStatus.choices, default=ApprovalRequestStatus.PENDING, db_index=True)
    reviewed_by = models.ForeignKey(StaffProfile, on_delete=models.PROTECT, null=True, blank=True, related_name='reviewed_approvals')
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_comments = models.TextField(blank=True)
    requires_separation_of_duties = models.BooleanField(default=True)

    class Meta:
        db_table = 'hms_financial_approval_requests'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.request_number}] {self.operation_type} ₹{self.amount} ({self.status})"


# =====================================================================
# SECTION 4: SECURITY & ACCESS AUDIT EVENT MODEL
# =====================================================================

class SecurityEventType(models.TextChoices):
    LOGIN_SUCCESS = 'LOGIN_SUCCESS', 'Successful Authentication'
    LOGIN_FAILED = 'LOGIN_FAILED', 'Failed Authentication Attempt'
    LOGOUT = 'LOGOUT', 'User Logout'
    PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED', 'Password Recovery Requested'
    PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED', 'Password Reset Completed'
    MFA_VERIFIED = 'MFA_VERIFIED', 'Multi-Factor Challenge Verified'
    USER_PROVISIONED = 'USER_PROVISIONED', 'New User Provisioned'
    USER_STATUS_CHANGED = 'USER_STATUS_CHANGED', 'User Activated / Deactivated'
    ROLE_REASSIGNED = 'ROLE_REASSIGNED', 'User Role Reassigned'
    PERMISSIONS_UPDATED = 'PERMISSIONS_UPDATED', 'Granular Permissions Modified'
    FINANCIAL_APPROVED = 'FINANCIAL_APPROVED', 'Financial Operation Approved'
    FINANCIAL_REJECTED = 'FINANCIAL_REJECTED', 'Financial Operation Rejected'
    UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT', 'Unauthorized Endpoint Access Blocked'


class SecurityAuditEvent(BaseUUIDModel):
    """
    Immutable security and administrative audit trail recording authentication,
    authorization, role changes, and privilege enforcement.
    """
    event_type = models.CharField(max_length=40, choices=SecurityEventType.choices, db_index=True)
    actor_email = models.CharField(max_length=150, db_index=True)
    actor_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    target_user_id = models.UUIDField(null=True, blank=True, db_index=True)
    target_user_email = models.CharField(max_length=150, blank=True)
    ip_address = models.CharField(max_length=50, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'hms_security_audit_events'
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.event_type} by {self.actor_email}"


