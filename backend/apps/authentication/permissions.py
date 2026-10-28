import uuid
from django.core.exceptions import ValidationError
from rest_framework import permissions
from apps.authentication.models import RoleEnum


def resolve_user_profile(request):
    """
    Safely resolves the UserProfile instance attached to request.user or supabase_claims.
    Handles UUID parsing safely and falls back to email lookup.
    """
    if not (request.user and request.user.is_authenticated):
        return None
    user_prof = getattr(request, 'user_profile', None)
    if user_prof:
        return user_prof
    from apps.authentication.models import UserProfile
    claims = getattr(request, 'supabase_claims', {})
    sub = claims.get('sub') or request.user.username
    user_prof = None
    try:
        sub_uuid = uuid.UUID(str(sub))
        user_prof = UserProfile.objects.select_related('role', 'staff_profile', 'patient_profile').filter(
            supabase_user_id=sub_uuid
        ).first()
    except (ValueError, TypeError, ValidationError):
        user_prof = None

    if not user_prof:
        email = getattr(request.user, 'email', '') or claims.get('email', '')
        if email:
            user_prof = UserProfile.objects.select_related('role', 'staff_profile', 'patient_profile').filter(
                email=email
            ).first()

    if user_prof:
        request.user_profile = user_prof
    return user_prof


class IsStaffMember(permissions.BasePermission):
    """
    Allows access only to authenticated staff members with an active StaffProfile.
    Patients are strictly denied.
    """
    message = "Access restricted to authorized hospital staff members."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_profile = resolve_user_profile(request)
        if not user_profile or not user_profile.is_active:
            return False

        if user_profile.role and user_profile.role.name == RoleEnum.PATIENT:
            return False

        staff_profile = getattr(user_profile, 'staff_profile', None)
        return bool(staff_profile and staff_profile.status == 'ACTIVE')


class HasRole(permissions.BasePermission):
    """
    Allows access to users whose role matches one of the allowed roles.
    Usage: permission_classes = [HasRole(['SUPER_ADMIN', 'DOCTOR'])]
    """
    def __init__(self, allowed_roles=None):
        self.allowed_roles = allowed_roles or []

    def __call__(self):
        return self

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_profile = resolve_user_profile(request)
        if not user_profile or not user_profile.is_active:
            return False

        return user_profile.role and user_profile.role.name in self.allowed_roles


class IsSuperAdmin(permissions.BasePermission):
    """
    Allows access only to Super Administrators.
    """
    message = "Super Administrator privileges required."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_profile = resolve_user_profile(request)
        if not user_profile or not user_profile.is_active:
            return False

        return user_profile.role and user_profile.role.name == RoleEnum.SUPER_ADMIN


class IsBranchAuthorized(permissions.BasePermission):
    """
    Verifies that the staff member is assigned to the target branch or is a Super Admin.
    """
    message = "You are not authorized to perform actions in this hospital branch."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_profile = getattr(request, 'user_profile', None)
        if not user_profile:
            from apps.authentication.models import UserProfile
            try:
                user_profile = UserProfile.objects.select_related('role', 'staff_profile').get(
                    supabase_user_id=request.user.username
                )
                request.user_profile = user_profile
            except UserProfile.DoesNotExist:
                return False

        if user_profile.role.name == RoleEnum.SUPER_ADMIN:
            return True

        staff_profile = getattr(user_profile, 'staff_profile', None)
        if not staff_profile:
            return False

        # Resolve branch from object (direct branch attribute or primary_branch)
        target_branch = getattr(obj, 'branch', None) or getattr(obj, 'primary_branch', None)
        if not target_branch and hasattr(obj, 'branch_id'):
            return str(staff_profile.branch_id) == str(obj.branch_id)

        return staff_profile.branch == target_branch


class IsPatientOwner(permissions.BasePermission):
    """
    Ensures that a patient can only access their own clinical records and profile.
    Staff members can also be granted access based on clinical duties.
    """
    message = "You can only access your own patient records."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        user_profile = getattr(request, 'user_profile', None)
        if not user_profile:
            from apps.authentication.models import UserProfile
            try:
                user_profile = UserProfile.objects.select_related('role', 'patient_profile', 'staff_profile').get(
                    supabase_user_id=request.user.username
                )
                request.user_profile = user_profile
            except UserProfile.DoesNotExist:
                return False

        # Staff with clinical roles can view patient records
        if user_profile.role.name in [RoleEnum.SUPER_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.DOCTOR, RoleEnum.NURSE]:
            return True

        # Patient self-ownership check
        if user_profile.role.name == RoleEnum.PATIENT:
            patient_profile = getattr(user_profile, 'patient_profile', None)
            if not patient_profile:
                return False

            # If checking PatientProfile object itself
            if hasattr(obj, 'user_profile'):
                return obj.user_profile_id == user_profile.id
            # If checking a record linked to PatientProfile
            if hasattr(obj, 'patient'):
                return obj.patient_id == patient_profile.id

        return False


        return False


class IsClinicalStaff(permissions.BasePermission):
    """
    Allows access only to medical/clinical staff (Doctors, Nurses, Medical Directors)
    and Enterprise Administrators.
    Strictly denies non-clinical personnel (Finance, Pharmacy, HR, Reception, Patient).
    """
    message = "Clinical authorization required. Non-clinical staff cannot access or modify medical records."

    ALLOWED_ROLES = [
        RoleEnum.DOCTOR,
        RoleEnum.NURSE,
        RoleEnum.MEDICAL_DIRECTOR,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active:
            return False
        return prof.role and prof.role.name in self.ALLOWED_ROLES


class IsHRPayrollStaff(permissions.BasePermission):
    """
    Restricts confidential employee salary, payroll, and leave administration
    to HR leadership and authorized Finance executives.
    Strictly forbids Pharmacy, Nursing, Clinical, and ordinary staff from viewing payroll.
    """
    message = "Confidential Payroll Access Denied. Only HR and authorized Finance leadership have clearance."

    ALLOWED_ROLES = [
        RoleEnum.HR_MANAGER,
        RoleEnum.ACCOUNTANT,
        RoleEnum.FINANCE_MANAGER,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active:
            return False
        return prof.role and prof.role.name in self.ALLOWED_ROLES


class IsFinancialStaff(permissions.BasePermission):
    """
    Allows access to billing, invoicing, payments, accounting, and investments.
    Restricts access to Finance executives, Accountants, Billing Executives, and Cashiers.
    """
    message = "Financial administrative privileges required."

    ALLOWED_ROLES = [
        RoleEnum.ACCOUNTANT,
        RoleEnum.FINANCE_MANAGER,
        RoleEnum.CASHIER,
        RoleEnum.BILLING_EXECUTIVE,
        RoleEnum.INVESTMENT_MANAGER,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active:
            return False
        return prof.role and prof.role.name in self.ALLOWED_ROLES


class IsPharmacyStaff(permissions.BasePermission):
    """
    Restricts medication dispensing, batch receipts, and pharmacy inventory.
    """
    message = "Pharmacy and Inventory clearance required."

    ALLOWED_ROLES = [
        RoleEnum.PHARMACIST,
        RoleEnum.INVENTORY_MANAGER,
        RoleEnum.PROCUREMENT_OFFICER,
        RoleEnum.SUPER_ADMIN,
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active:
            return False
        return prof.role and prof.role.name in self.ALLOWED_ROLES


class IsReadOnlyOrAdmin(permissions.BasePermission):
    """
    Auditors and read-only users can execute safe methods (GET, HEAD, OPTIONS).
    Unsafe write actions (POST, PUT, PATCH, DELETE) require administrative/operational role.
    """
    message = "Read-only role: Modification of live records is prohibited."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active:
            return False
        if prof.role and prof.role.name == RoleEnum.AUDITOR:
            return False
        return True
