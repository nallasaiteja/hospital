import uuid
from decimal import Decimal
from rest_framework import serializers
from apps.core.models import Branch, Department
from apps.authentication.models import (
    Role,
    RoleEnum,
    Permission,
    UserProfile,
    StaffProfile,
    PatientProfile,
    PatientStatusEnum,
    ConsentType,
    ConsentStatus,
    PatientConsent,
    PatientDocument,
    GenderEnum,
    BloodGroupEnum,
    StaffStatus,
    SecurityAuditEvent,
    SecurityEventType,
)


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'code', 'name', 'module', 'description']


class RoleSerializer(serializers.ModelSerializer):
    permissions = PermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ['id', 'name', 'display_name', 'description', 'permissions']


class UserProfileSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id',
            'supabase_user_id',
            'email',
            'first_name',
            'last_name',
            'phone_number',
            'role',
            'avatar_url',
            'is_verified',
            'is_active',
            'created_at',
            'updated_at',
        ]


class StaffProfileSerializer(serializers.ModelSerializer):
    user_profile = UserProfileSerializer(read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = StaffProfile
        fields = [
            'id',
            'employee_id',
            'user_profile',
            'branch',
            'branch_name',
            'department',
            'department_name',
            'designation',
            'specialization',
            'medical_license_number',
            'qualification',
            'consultation_fee',
            'status',
            'is_on_duty',
            'joining_date',
        ]


class PatientConsentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientConsent
        fields = [
            'id',
            'patient',
            'consent_type',
            'status',
            'recorded_by',
            'recorded_by_name',
            'recorded_at',
            'document_url',
            'notes',
            'revocation_reason',
            'revoked_at',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PatientDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.user_profile.full_name', read_only=True)

    class Meta:
        model = PatientDocument
        fields = [
            'id',
            'patient',
            'document_type',
            'title',
            'file_url',
            'file_size_kb',
            'mime_type',
            'uploaded_by',
            'uploaded_by_name',
            'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PatientProfileSerializer(serializers.ModelSerializer):
    user_profile = UserProfileSerializer(read_only=True)
    primary_branch_name = serializers.CharField(source='primary_branch.name', read_only=True)
    age = serializers.IntegerField(read_only=True)
    merged_into_mrn = serializers.CharField(source='merged_into.medical_record_number', read_only=True)
    consents_count = serializers.IntegerField(source='consents.count', read_only=True)
    documents_count = serializers.IntegerField(source='documents.count', read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            'id',
            'medical_record_number',
            'user_profile',
            'status',
            'merged_into',
            'merged_into_mrn',
            'primary_branch',
            'primary_branch_name',
            'date_of_birth',
            'age',
            'gender',
            'blood_group',
            'photo_url',
            'address',
            'city',
            'state',
            'postal_code',
            'country',
            'emergency_contact_name',
            'emergency_contact_phone',
            'emergency_contact_relation',
            'allergies',
            'chronic_conditions',
            'past_medical_history',
            'past_surgical_history',
            'family_history',
            'social_history',
            'insurance_provider',
            'insurance_policy_number',
            'consents_count',
            'documents_count',
            'created_at',
            'updated_at',
        ]


class PatientProfileInitSerializer(serializers.Serializer):
    """
    Initializes a patient profile for an authenticated Supabase user.
    Strictly forces role to PATIENT server-side.
    """
    first_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=25, required=False, allow_blank=True)
    primary_branch_id = serializers.UUIDField(required=False, allow_null=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=GenderEnum.choices, default=GenderEnum.OTHER)
    blood_group = serializers.ChoiceField(choices=BloodGroupEnum.choices, required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    emergency_contact_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=25, required=False, allow_blank=True)
    emergency_contact_relation = serializers.CharField(max_length=50, required=False, allow_blank=True)
    allergies = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    chronic_conditions = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    insurance_provider = serializers.CharField(max_length=150, required=False, allow_blank=True)
    insurance_policy_number = serializers.CharField(max_length=100, required=False, allow_blank=True)


class PatientRegistrationSerializer(serializers.Serializer):
    """
    Staff patient registration workflow (walk-in or referred patients).
    Generates unique MRN and UserProfile safely on backend.
    """
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone_number = serializers.CharField(max_length=25, required=False, allow_blank=True)
    primary_branch_id = serializers.UUIDField()
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.ChoiceField(choices=GenderEnum.choices, default=GenderEnum.OTHER)
    blood_group = serializers.ChoiceField(choices=BloodGroupEnum.choices, required=False, allow_blank=True)
    photo_url = serializers.URLField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    state = serializers.CharField(max_length=100, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=20, required=False, allow_blank=True)
    country = serializers.CharField(max_length=100, required=False, default='India')
    emergency_contact_name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    emergency_contact_phone = serializers.CharField(max_length=25, required=False, allow_blank=True)
    emergency_contact_relation = serializers.CharField(max_length=50, required=False, allow_blank=True)
    allergies = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    chronic_conditions = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    past_medical_history = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    past_surgical_history = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    family_history = serializers.CharField(required=False, allow_blank=True)
    social_history = serializers.CharField(required=False, allow_blank=True)
    insurance_provider = serializers.CharField(max_length=150, required=False, allow_blank=True)
    insurance_policy_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    # Optional initial consent
    initial_consent_type = serializers.ChoiceField(choices=ConsentType.choices, required=False, allow_blank=True)
    initial_consent_notes = serializers.CharField(required=False, allow_blank=True)


class PatientMedicalHistoryUpdateSerializer(serializers.Serializer):
    """
    Authorized clinical updates for medical history, allergies, chronic conditions.
    """
    allergies = serializers.ListField(child=serializers.CharField(), required=False)
    chronic_conditions = serializers.ListField(child=serializers.CharField(), required=False)
    past_medical_history = serializers.ListField(child=serializers.CharField(), required=False)
    past_surgical_history = serializers.ListField(child=serializers.CharField(), required=False)
    family_history = serializers.CharField(required=False, allow_blank=True)
    social_history = serializers.CharField(required=False, allow_blank=True)


class PatientMergeSerializer(serializers.Serializer):
    """
    Authorized merging of duplicate patient records with transactional safety.
    """
    source_patient_id = serializers.UUIDField(help_text="Patient record to be merged and retired")
    target_patient_id = serializers.UUIDField(help_text="Surviving master patient record")
    reason = serializers.CharField(max_length=500, help_text="Reason for merging duplicate records")



class StaffProvisioningSerializer(serializers.Serializer):
    """
    Used exclusively by Administrators to provision staff members.
    Public registration is strictly prohibited.
    """
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    phone_number = serializers.CharField(max_length=25, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=[
        (r.value, r.label) for r in RoleEnum if r != RoleEnum.PATIENT
    ])
    branch_id = serializers.UUIDField()
    department_id = serializers.UUIDField(required=False, allow_null=True)
    designation = serializers.CharField(max_length=120)
    specialization = serializers.CharField(max_length=150, required=False, allow_blank=True)
    medical_license_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    qualification = serializers.CharField(max_length=200, required=False, allow_blank=True)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    def validate_branch_id(self, value):
        if not Branch.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Active hospital branch not found with this ID.")
        return value

    def validate_department_id(self, value):
        if value and not Department.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Active hospital department not found with this ID.")
        return value


# =====================================================================
# SECTION 4: FINANCIAL APPROVAL LIMITS & AUDIT SERIALIZERS
# =====================================================================

from apps.authentication.models import (
    FinancialApprovalPolicy,
    FinancialApprovalRequest,
    SecurityAuditEvent,
    FinancialOperationType,
    ApprovalRequestStatus,
    SecurityEventType
)


class FinancialApprovalPolicySerializer(serializers.ModelSerializer):
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    approver_role_name = serializers.CharField(source='approver_role.name', read_only=True)
    approver_role_display = serializers.CharField(source='approver_role.display_name', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)

    class Meta:
        model = FinancialApprovalPolicy
        fields = [
            'id',
            'operation_type',
            'operation_type_display',
            'min_amount',
            'max_amount',
            'approver_role',
            'approver_role_name',
            'approver_role_display',
            'requires_separation_of_duties',
            'branch',
            'branch_name',
            'description',
            'created_at',
        ]


class FinancialApprovalRequestSerializer(serializers.ModelSerializer):
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.user_profile.full_name', read_only=True)
    requested_by_role = serializers.CharField(source='requested_by.user_profile.role.display_name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.user_profile.full_name', read_only=True, default=None)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)

    class Meta:
        model = FinancialApprovalRequest
        fields = [
            'id',
            'request_number',
            'operation_type',
            'operation_type_display',
            'entity_type',
            'entity_id',
            'amount',
            'reason',
            'requested_by',
            'requested_by_name',
            'requested_by_role',
            'branch',
            'branch_name',
            'status',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'review_comments',
            'requires_separation_of_duties',
            'created_at',
        ]


class SecurityAuditEventSerializer(serializers.ModelSerializer):
    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    severity = serializers.SerializerMethodField()
    action_summary = serializers.SerializerMethodField()
    actor_role = serializers.SerializerMethodField()

    class Meta:
        model = SecurityAuditEvent
        fields = [
            'id',
            'event_type',
            'event_type_display',
            'timestamp',
            'severity',
            'action_summary',
            'actor_role',
            'actor_email',
            'actor_user_id',
            'target_user_id',
            'target_user_email',
            'ip_address',
            'user_agent',
            'details',
            'created_at',
        ]

    def get_severity(self, obj):
        if obj.event_type in [SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT, SecurityEventType.FINANCIAL_REJECTED]:
            return 'CRITICAL'
        if obj.event_type in [SecurityEventType.USER_STATUS_CHANGED, SecurityEventType.PASSWORD_RESET_REQUESTED]:
            return 'WARNING'
        return 'INFO'

    def get_action_summary(self, obj):
        display = obj.get_event_type_display()
        if obj.target_user_email:
            return f"{display} for {obj.target_user_email}"
        if obj.details and isinstance(obj.details, dict):
            if 'request_number' in obj.details:
                return f"{display} - Req #{obj.details['request_number']}"
            if 'role' in obj.details:
                return f"{display} - Role: {obj.details['role']}"
        return f"{display} by {obj.actor_email or 'System'}"

    def get_actor_role(self, obj):
        if obj.details and isinstance(obj.details, dict) and 'actor_role' in obj.details:
            return obj.details['actor_role']
        return 'STAFF'


class UserManagementUpdateSerializer(serializers.Serializer):
    role_name = serializers.CharField(required=False)
    is_active = serializers.BooleanField(required=False)
    branch_id = serializers.UUIDField(required=False)
    department_id = serializers.UUIDField(required=False, allow_null=True)
    designation = serializers.CharField(required=False, max_length=120)

