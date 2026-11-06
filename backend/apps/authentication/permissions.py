import uuid
from django.core.exceptions import ValidationError
from django.db.models import Q
from rest_framework import permissions
from apps.authentication.models import RoleEnum
from apps.authentication.rbac_matrix import (
    DataScope,
    STRICT_READ_ONLY_ROLES,
    has_module_action_permission,
    get_role_data_scope,
)


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
        user_prof = UserProfile.objects.select_related(
            'role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch'
        ).filter(
            supabase_user_id=sub_uuid
        ).first()
    except (ValueError, TypeError, ValidationError):
        user_prof = None

    if not user_prof:
        email = getattr(request.user, 'email', '') or claims.get('email', '')
        if email:
            user_prof = UserProfile.objects.select_related(
                'role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch'
            ).filter(
                email=email
            ).first()

    if user_prof:
        request.user_profile = user_prof
    return user_prof


def _record_denied_attempt(request, module: str, action: str, reason: str):
    """
    Records an unauthorized access or mutation attempt in SecurityAuditEvent and AuditLog.
    """
    try:
        from apps.authentication.models import SecurityAuditEvent, SecurityEventType
        from apps.core.activity_log_service import ActivityLogService

        prof = resolve_user_profile(request)
        actor_email = prof.email if prof else (getattr(request.user, 'email', '') or 'anonymous')
        SecurityAuditEvent.objects.create(
            event_type=SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
            actor_email=actor_email,
            actor_user_id=prof.supabase_user_id if prof else None,
            ip_address=request.META.get('REMOTE_ADDR', '')[:50],
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
            details={
                'path': request.path,
                'method': request.method,
                'module': module,
                'action': action,
                'role': prof.role.name if (prof and prof.role) else None,
                'reason': reason,
            }
        )
        ActivityLogService.record(
            action=f"{module}_{action.upper()}_DENIED",
            entity_type=module,
            entity_id=request.path,
            module=module,
            request=request,
            user_profile=prof,
            status='DENIED',
            description=reason,
        )
    except Exception:
        pass


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


class IsReceptionistOnly(permissions.BasePermission):
    """
    Strictly restricts Appointment Booking and Patient Token Issuing to the RECEPTIONIST role ONLY.
    Doctors, Super Admins, Branch Managers, Nurses, Pharmacists, Lab Technicians, Finance staff,
    HR, Auditors, and Patients are strictly forbidden (HTTP 403 Forbidden) from booking appointments
    or issuing patient tokens.
    """
    message = "Access Denied: Only the Receptionist role is authorized to book appointments and issue patient tokens."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        user_profile = resolve_user_profile(request)
        if not user_profile or not user_profile.is_active or not user_profile.role:
            _record_denied_attempt(request, 'OPD', 'book_or_token', self.message)
            return False

        if user_profile.role.name != RoleEnum.RECEPTIONIST:
            self.message = (
                f"Access Denied: Role '{user_profile.role.display_name}' ({user_profile.role.name}) "
                f"is not permitted to book appointments or issue patient tokens. "
                f"Only the Receptionist role has permission for this workflow."
            )
            _record_denied_attempt(request, 'OPD', 'book_or_token', self.message)
            return False

        staff_profile = getattr(user_profile, 'staff_profile', None)
        if not staff_profile or staff_profile.status != 'ACTIVE':
            self.message = "Access Denied: Active Receptionist staff profile required."
            _record_denied_attempt(request, 'OPD', 'book_or_token', self.message)
            return False

        return True


class IsBranchAuthorized(permissions.BasePermission):
    """
    Verifies that the staff member is assigned to the target branch or is a Super Admin / Auditor.
    """
    message = "You are not authorized to perform actions in this hospital branch."

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False

        if request.user.is_superuser:
            return True

        user_profile = resolve_user_profile(request)
        if not user_profile:
            return False

        if user_profile.role.name in [RoleEnum.SUPER_ADMIN, RoleEnum.AUDITOR]:
            return True

        staff_profile = getattr(user_profile, 'staff_profile', None)
        if not staff_profile:
            return False

        target_branch = getattr(obj, 'branch', None) or getattr(obj, 'primary_branch', None)
        if not target_branch and hasattr(obj, 'branch_id') and obj.branch_id:
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

        user_profile = resolve_user_profile(request)
        if not user_profile:
            return False

        # Staff with clinical / supervisory roles can view patient records (read-only for Branch Manager/Auditor)
        if user_profile.role.name in [
            RoleEnum.SUPER_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN,
            RoleEnum.MEDICAL_DIRECTOR, RoleEnum.DEPARTMENT_HEAD, RoleEnum.DOCTOR,
            RoleEnum.NURSE, RoleEnum.AUDITOR
        ]:
            if user_profile.role.name in STRICT_READ_ONLY_ROLES and request.method not in permissions.SAFE_METHODS:
                return False
            return True

        # Patient self-ownership check
        if user_profile.role.name == RoleEnum.PATIENT:
            patient_profile = getattr(user_profile, 'patient_profile', None)
            if not patient_profile:
                return False

            if hasattr(obj, 'user_profile'):
                return obj.user_profile_id == user_profile.id
            if hasattr(obj, 'patient'):
                return obj.patient_id == patient_profile.id

        return False


class IsClinicalStaff(permissions.BasePermission):
    """
    Allows clinical write operations ONLY to medical/clinical staff (Doctors, Nurses, Medical Directors, Dept Heads).
    Branch Manager, Hospital Admin, and Auditor are granted READ-ONLY (SAFE_METHODS) visibility for monitoring,
    and are strictly blocked from modifying clinical records, diagnoses, or prescriptions.
    """
    message = "Clinical authorization required. Non-clinical or supervisory monitoring roles cannot modify medical records."

    WRITE_ROLES = [
        RoleEnum.DOCTOR,
        RoleEnum.NURSE,
        RoleEnum.MEDICAL_DIRECTOR,
        RoleEnum.DEPARTMENT_HEAD,
        RoleEnum.SUPER_ADMIN,
    ]
    READ_ONLY_ROLES = [
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
        RoleEnum.AUDITOR,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        role_name = prof.role.name
        if request.method in permissions.SAFE_METHODS:
            return role_name in (self.WRITE_ROLES + self.READ_ONLY_ROLES)

        if role_name in self.READ_ONLY_ROLES:
            self.message = f"Role '{prof.role.display_name}' has read-only clinical monitoring access and cannot modify clinical records."
            _record_denied_attempt(request, 'CLINICAL', 'edit', self.message)
            return False

        return role_name in self.WRITE_ROLES


class IsHRPayrollStaff(permissions.BasePermission):
    """
    Restricts confidential employee salary, payroll, and HR administration:
    - Write/Manage access: HR_MANAGER, ACCOUNTANT, FINANCE_MANAGER, SUPER_ADMIN (and DEPARTMENT_HEAD for leave/shift approvals).
    - Read-only monitoring access (SAFE_METHODS only): BRANCH_MANAGER, HOSPITAL_ADMIN, AUDITOR.
    """
    message = "Confidential HR & Payroll Access Denied. Branch Managers and Auditors have read-only monitoring visibility and cannot modify HR or payroll records."

    WRITE_ROLES = [
        RoleEnum.HR_MANAGER,
        RoleEnum.ACCOUNTANT,
        RoleEnum.FINANCE_MANAGER,
        RoleEnum.SUPER_ADMIN,
    ]
    READ_ONLY_ROLES = [
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
        RoleEnum.AUDITOR,
        RoleEnum.DEPARTMENT_HEAD,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        role_name = prof.role.name
        if request.method in permissions.SAFE_METHODS:
            return role_name in (self.WRITE_ROLES + self.READ_ONLY_ROLES)

        if role_name in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN, RoleEnum.AUDITOR]:
            self.message = f"Role '{prof.role.display_name}' has read-only HR monitoring access and cannot modify employee or payroll records."
            _record_denied_attempt(request, 'HR_PAYROLL', 'edit', self.message)
            return False

        return role_name in self.WRITE_ROLES


class IsFinancialStaff(permissions.BasePermission):
    """
    Allows financial mutations only to Finance executives, Accountants, Billing Executives, Cashiers, and Investment Managers.
    Branch Manager, Hospital Admin, and Auditor have READ-ONLY (SAFE_METHODS) visibility.
    """
    message = "Financial administrative privileges required. Supervisory and audit roles cannot modify financial transactions."

    WRITE_ROLES = [
        RoleEnum.ACCOUNTANT,
        RoleEnum.FINANCE_MANAGER,
        RoleEnum.CASHIER,
        RoleEnum.BILLING_EXECUTIVE,
        RoleEnum.INVESTMENT_MANAGER,
        RoleEnum.INSURANCE_COORDINATOR,
        RoleEnum.SUPER_ADMIN,
    ]
    READ_ONLY_ROLES = [
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
        RoleEnum.AUDITOR,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        role_name = prof.role.name
        if request.method in permissions.SAFE_METHODS:
            return role_name in (self.WRITE_ROLES + self.READ_ONLY_ROLES)

        if role_name in self.READ_ONLY_ROLES:
            self.message = f"Role '{prof.role.display_name}' has read-only financial monitoring access and cannot modify financial transactions."
            _record_denied_attempt(request, 'FINANCE', 'edit', self.message)
            return False

        return role_name in self.WRITE_ROLES


class IsPharmacyStaff(permissions.BasePermission):
    """
    Restricts medication dispensing, batch receipts, and pharmacy inventory mutations to Pharmacy & Inventory staff.
    Branch Manager, Hospital Admin, Doctor, and Auditor have READ-ONLY visibility.
    """
    message = "Pharmacy and Inventory clearance required. Only Pharmacists and Inventory staff can modify stock or dispense medicines."

    WRITE_ROLES = [
        RoleEnum.PHARMACIST,
        RoleEnum.INVENTORY_MANAGER,
        RoleEnum.PROCUREMENT_OFFICER,
        RoleEnum.SUPER_ADMIN,
    ]
    READ_ONLY_ROLES = [
        RoleEnum.HOSPITAL_ADMIN,
        RoleEnum.BRANCH_MANAGER,
        RoleEnum.DOCTOR,
        RoleEnum.MEDICAL_DIRECTOR,
        RoleEnum.DEPARTMENT_HEAD,
        RoleEnum.AUDITOR,
    ]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        role_name = prof.role.name
        if request.method in permissions.SAFE_METHODS:
            return role_name in (self.WRITE_ROLES + self.READ_ONLY_ROLES)

        if role_name in self.READ_ONLY_ROLES:
            self.message = f"Role '{prof.role.display_name}' cannot dispense medications or modify pharmacy stock."
            _record_denied_attempt(request, 'PHARMACY', 'edit', self.message)
            return False

        return role_name in self.WRITE_ROLES


class StrictBranchManagerReadOnlyPermission(permissions.BasePermission):
    """
    Enforces absolute read-only permissions and strict branch data isolation for the
    Branch Manager (Hospital Administrator) role across the entire Hospital Management System:
    1. Blocks ALL unsafe HTTP methods (POST, PUT, PATCH, DELETE) with HTTP 403 Forbidden.
       (Only exception is standard user logout /api/v1/auth/logout/)
    2. Blocks custom action/mutation/approval endpoints even if invoked with SAFE methods.
    3. Enforces strict Branch Isolation:
       If a branch_id query parameter, URL parameter, or payload is passed, it MUST match
       the Branch Manager's assigned branch. Cross-branch access is strictly rejected with HTTP 403.
    4. Enforces object-level branch isolation via has_object_permission.
    5. Fully logs any denied mutation or cross-branch attempt in SecurityAuditEvent and ActivityLogService.
    """
    message = "Access Denied: The Branch Manager role is strictly restricted to read-only visibility within their assigned branch."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return True
        if getattr(request.user, 'is_superuser', False):
            return True

        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return True

        role_name = prof.role.name
        if role_name not in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
            return True

        # 1. Block unsafe HTTP methods
        if request.method not in permissions.SAFE_METHODS:
            if request.path.rstrip('/').endswith('/auth/logout'):
                return True
            self.message = (
                f"Access Denied (403 Forbidden): '{prof.role.display_name}' has strict READ-ONLY permissions "
                f"and is strictly prohibited from creating, updating, deleting, approving, or finalizing records."
            )
            _record_denied_attempt(request, getattr(view, 'rbac_module', 'OPERATIONS'), request.method.lower(), self.message)
            return False

        # 2. Block action/mutation endpoints even if reached via GET
        path_lower = request.path.rstrip('/').lower()
        action_tokens = [
            '/action', '/approve', '/reject', '/cancel', '/release', '/dispense',
            '/admit', '/discharge', '/settle', '/refund', '/void', '/execute',
            '/finalize', '/provision', '/toggle', '/reset'
        ]
        if any(path_lower.endswith(tok) or f"{tok}/" in path_lower for tok in action_tokens):
            self.message = (
                f"Access Denied (403 Forbidden): '{prof.role.display_name}' is restricted from "
                f"executing operational workflow actions, approvals, or mutations."
            )
            _record_denied_attempt(request, getattr(view, 'rbac_module', 'OPERATIONS'), 'action', self.message)
            return False

        # 3. Enforce Branch Isolation on query parameters and route parameters
        staff = getattr(prof, 'staff_profile', None)
        assigned_branch_id = getattr(staff, 'branch_id', None)
        if assigned_branch_id:
            req_branch = (
                request.query_params.get('branch_id') or
                request.query_params.get('branch') or
                getattr(view, 'kwargs', {}).get('branch_id')
            )
            if req_branch and str(req_branch).lower() != str(assigned_branch_id).lower() and str(req_branch).lower() not in ('null', '', 'none'):
                self.message = (
                    f"Access Denied (403 Forbidden): You are only authorized to view records belonging to your "
                    f"assigned branch ({staff.branch.name if getattr(staff, 'branch', None) else assigned_branch_id})."
                )
                _record_denied_attempt(request, getattr(view, 'rbac_module', 'OPERATIONS'), 'branch_isolation', self.message)
                return False

        return True

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return True
        if getattr(request.user, 'is_superuser', False):
            return True

        prof = resolve_user_profile(request)
        if not prof or not prof.role:
            return True

        role_name = prof.role.name
        if role_name not in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
            return True

        if request.method not in permissions.SAFE_METHODS:
            return False

        # Verify object belongs to the assigned branch
        staff = getattr(prof, 'staff_profile', None)
        assigned_branch_id = getattr(staff, 'branch_id', None)
        if assigned_branch_id:
            obj_branch_id = getattr(obj, 'branch_id', None) or (getattr(obj, 'branch', None) and getattr(obj.branch, 'id', None))
            if obj_branch_id and str(obj_branch_id).lower() != str(assigned_branch_id).lower():
                self.message = "Access Denied: Record belongs to another hospital branch."
                return False

        return True


class IsReadOnlyOrAdmin(permissions.BasePermission):
    """
    Enforces that STRICT_READ_ONLY_ROLES (BRANCH_MANAGER, HOSPITAL_ADMIN, AUDITOR)
    can only perform SAFE_METHODS (GET, HEAD, OPTIONS) on any operational endpoint,
    blocking POST, PUT, PATCH, DELETE and enforcing branch isolation.
    """
    message = "Your supervisory/audit role is restricted to read-only operational monitoring."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        if prof.role.name in STRICT_READ_ONLY_ROLES:
            if request.method not in permissions.SAFE_METHODS:
                if request.path.rstrip('/').endswith('/auth/logout'):
                    return True
                self.message = f"Access Denied (403 Forbidden): '{prof.role.display_name}' has read-only operational monitoring visibility and is prohibited from creating, editing, approving, or deleting records."
                _record_denied_attempt(request, getattr(view, 'rbac_module', 'OPERATIONS'), request.method.lower(), self.message)
                return False

            # Branch isolation check for Branch Manager
            if prof.role.name in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
                staff = getattr(prof, 'staff_profile', None)
                assigned_branch_id = getattr(staff, 'branch_id', None)
                if assigned_branch_id:
                    req_branch = (
                        request.query_params.get('branch_id') or
                        request.query_params.get('branch') or
                        getattr(view, 'kwargs', {}).get('branch_id')
                    )
                    if req_branch and str(req_branch).lower() != str(assigned_branch_id).lower() and str(req_branch).lower() not in ('null', '', 'none'):
                        self.message = "Access Denied: You are only authorized to view records for your assigned branch."
                        _record_denied_attempt(request, getattr(view, 'rbac_module', 'OPERATIONS'), 'branch_isolation', self.message)
                        return False

        return True

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True
        prof = resolve_user_profile(request)
        if not prof or not prof.role:
            return False
        if prof.role.name in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
            if request.method not in permissions.SAFE_METHODS:
                return False
            staff = getattr(prof, 'staff_profile', None)
            assigned_branch_id = getattr(staff, 'branch_id', None)
            if assigned_branch_id:
                obj_branch_id = getattr(obj, 'branch_id', None) or (getattr(obj, 'branch', None) and getattr(obj.branch, 'id', None))
                if obj_branch_id and str(obj_branch_id).lower() != str(assigned_branch_id).lower():
                    return False
        return True


class RoleModulePermission(permissions.BasePermission):
    """
    3-Dimensional RBAC Permission Class.
    Checks `view.rbac_module` and maps HTTP method or custom action to RBAC action:
      GET/HEAD/OPTIONS -> 'view'
      POST -> 'create' (or custom `view.rbac_action_map`)
      PUT/PATCH -> 'edit'
      DELETE -> 'delete'
    """
    message = "You do not have permission to perform this action in this module."

    METHOD_ACTION_MAP = {
        'GET': 'view',
        'HEAD': 'view',
        'OPTIONS': 'view',
        'POST': 'create',
        'PUT': 'edit',
        'PATCH': 'edit',
        'DELETE': 'delete',
    }

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser:
            return True

        prof = resolve_user_profile(request)
        if not prof or not prof.is_active or not prof.role:
            return False

        module = getattr(view, 'rbac_module', None)
        if not module:
            return True

        action_map = getattr(view, 'rbac_action_map', {})
        view_action = getattr(view, 'action', None)
        if view_action and view_action in action_map:
            required_action = action_map[view_action]
        else:
            required_action = self.METHOD_ACTION_MAP.get(request.method, 'view')

        allowed = has_module_action_permission(prof.role.name, module, required_action)
        if not allowed:
            self.message = f"Role '{prof.role.display_name}' is not authorized for '{required_action}' in module '{module}'."
            if request.method not in permissions.SAFE_METHODS:
                _record_denied_attempt(request, module, required_action, self.message)
        return allowed


class ScopedQuerysetMixin:
    """
    Mixin for DRF Views and ViewSets that automatically filters querysets by the user's
    DataScope (ORG, BRANCH, DEPT, ASSIGNED_PAT, ASSIGNED_WARD, OWN).
    """
    branch_field = 'branch_id'
    department_field = 'department_id'
    staff_field = 'staff_id'
    doctor_field = None
    patient_field = 'patient_id'

    def apply_organizational_scope(self, qs):
        request = getattr(self, 'request', None)
        if not request or getattr(request.user, 'is_superuser', False):
            return qs

        prof = resolve_user_profile(request)
        if not prof or not prof.role:
            return qs.none()

        role_name = prof.role.name
        scope = get_role_data_scope(role_name)
        staff = getattr(prof, 'staff_profile', None)
        patient = getattr(prof, 'patient_profile', None)

        # Patient isolation
        if role_name == RoleEnum.PATIENT:
            if not patient:
                return qs.none()
            if self.patient_field:
                return qs.filter(**{self.patient_field: patient.id})
            return qs.none()

        # Organization-wide scope
        if scope == DataScope.ORG:
            return qs

        # Branch-level scope (Branch Manager, HR, Finance, Receptionist, Lab, Pharmacy, Medical Director)
        if scope == DataScope.BRANCH and staff and staff.branch_id:
            if role_name in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
                if self.branch_field:
                    return qs.filter(**{self.branch_field: staff.branch_id})
                return qs
            if self.branch_field:
                return qs.filter(Q(**{self.branch_field: staff.branch_id}) | Q(**{f"{self.branch_field}__isnull": True}))
            return qs

        # Department-level scope (Department Head)
        if scope == DataScope.DEPT and staff:
            if self.department_field and staff.department_id:
                qs = qs.filter(Q(**{self.department_field: staff.department_id}) | Q(**{f"{self.department_field}__isnull": True}))
            elif self.branch_field and staff.branch_id:
                qs = qs.filter(Q(**{self.branch_field: staff.branch_id}) | Q(**{f"{self.branch_field}__isnull": True}))
            return qs

        # Assigned Patient / Ward clinical scope: within assigned branch
        if scope in [DataScope.ASSIGNED_PAT, DataScope.ASSIGNED_WARD] and staff:
            if self.branch_field and staff.branch_id:
                qs = qs.filter(Q(**{self.branch_field: staff.branch_id}) | Q(**{f"{self.branch_field}__isnull": True}))
            return qs

        return qs
