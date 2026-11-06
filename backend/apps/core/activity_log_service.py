"""
Centralized Activity Monitoring & Immutable Audit Logging Service.

Records 14-point audit records for all clinical, HR, operational, financial, and security actions:
1. Event ID (AuditLog.id)
2. Actor User ID (AuditLog.actor_user_id)
3. Employee Name & Email (actor_email + _meta.actor_name)
4. Role (_meta.actor_role)
5. Department (_meta.department_name / _meta.department_id)
6. Branch (AuditLog.branch + _meta.branch_name)
7. Action Performed (AuditLog.action)
8. Module / Entity Type (AuditLog.entity_type + _meta.module)
9. Target Record ID (AuditLog.entity_id)
10. Timestamp (AuditLog.created_at)
11. Previous Value (AuditLog.old_values)
12. New Value (AuditLog.new_values)
13. Approval Status & Approver Information (_meta.approval_status, _meta.approver_info)
14. Action Status: SUCCESS, FAILURE, DENIED (_meta.status)
"""

import uuid
from django.db.models import Q
from apps.core.models import AuditLog, Branch
from apps.authentication.models import UserProfile, RoleEnum
from apps.authentication.rbac_matrix import AUDIT_LOG_CATEGORY_MAP


SENSITIVE_KEYS = {'password', 'token', 'secret', 'key', 'authorization', 'cvv', 'pin'}


def _sanitize_payload(data):
    if not isinstance(data, dict):
        return data
    cleaned = {}
    for k, v in data.items():
        if any(s in str(k).lower() for s in SENSITIVE_KEYS):
            cleaned[k] = '[REDACTED]'
        elif isinstance(v, dict):
            cleaned[k] = _sanitize_payload(v)
        else:
            cleaned[k] = v
    return cleaned


def _resolve_actor_profile(request=None, user=None, user_profile=None):
    if user_profile:
        return user_profile
    if request:
        claims = getattr(request, 'supabase_claims', {})
        sub = claims.get('sub') or getattr(getattr(request, 'user', None), 'username', '')
        try:
            sub_uuid = uuid.UUID(str(sub))
            prof = UserProfile.objects.select_related('role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch').filter(
                supabase_user_id=sub_uuid
            ).first()
            if prof:
                return prof
        except (ValueError, TypeError):
            pass
        email = getattr(getattr(request, 'user', None), 'email', '') or claims.get('email', '')
        if email:
            return UserProfile.objects.select_related('role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch').filter(
                email=email
            ).first()
    if user and getattr(user, 'is_authenticated', False):
        email = getattr(user, 'email', '')
        if email:
            return UserProfile.objects.select_related('role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch').filter(
                email=email
            ).first()
    return None


class ActivityLogService:
    """
    Service for recording and querying organizationally-scoped activity logs.
    """

    @classmethod
    def record(
        cls,
        action: str,
        entity_type: str,
        entity_id: str = '',
        module: str = 'GENERAL',
        request=None,
        user=None,
        user_profile=None,
        branch=None,
        old_values=None,
        new_values=None,
        status: str = 'SUCCESS',
        approval_status: str = 'N/A',
        approver_info: str = '',
        description: str = '',
    ) -> AuditLog:
        prof = _resolve_actor_profile(request=request, user=user, user_profile=user_profile)
        actor_user_id = prof.supabase_user_id if prof else None
        actor_email = prof.email if prof else (getattr(user, 'email', '') if user else 'system@aurahms.local')
        actor_name = prof.full_name if prof else 'System Process'
        actor_role = prof.role.name if (prof and prof.role) else 'SYSTEM'

        staff = getattr(prof, 'staff_profile', None) if prof else None
        patient = getattr(prof, 'patient_profile', None) if prof else None

        dept_id = str(staff.department_id) if (staff and staff.department_id) else None
        dept_name = staff.department.name if (staff and staff.department) else 'General Administration'
        emp_id = staff.employee_id if staff else (patient.medical_record_number if patient else '')

        if not branch:
            if staff and staff.branch:
                branch = staff.branch
            elif patient and patient.primary_branch:
                branch = patient.primary_branch
            else:
                branch = Branch.objects.first()

        ip_addr = None
        user_agent = ''
        if request:
            ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]

        sanitized_old = _sanitize_payload(old_values) if old_values else None
        sanitized_new = _sanitize_payload(new_values) if isinstance(new_values, dict) else ({'value': new_values} if new_values else {})

        meta = {
            'actor_name': actor_name,
            'actor_role': actor_role,
            'employee_id': emp_id,
            'department_id': dept_id,
            'department_name': dept_name,
            'branch_name': branch.name if branch else 'Main Branch',
            'module': module,
            'status': status,
            'approval_status': approval_status,
            'approver_info': approver_info,
            'description': description or f"{actor_name} ({actor_role}) performed {action} on {entity_type}",
        }
        if isinstance(sanitized_new, dict):
            sanitized_new = {**sanitized_new, '_meta': meta}

        return AuditLog.objects.create(
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id or ''),
            branch=branch,
            ip_address=ip_addr or None,
            user_agent=user_agent,
            old_values=sanitized_old,
            new_values=sanitized_new,
        )

    @classmethod
    def get_scoped_queryset(cls, request):
        """
        Applies strict role-based activity log visibility rules (Section 7):
        - Super Admin: System-wide logs, security logs, role/permission logs.
        - Auditor: Full cross-departmental read-only audit trail.
        - Branch Manager / Hospital Admin: Authorized branch operational activity logs across all branch departments.
        - Department Head: Activity logs for their assigned department only.
        - HR Manager: HR activity logs (onboarding, role assignment, shifts, attendance, leave, payroll) in branch.
        - Medical Director: Clinical activity logs across their branch.
        - Finance Manager / Accountant: Financial & billing activity logs across their branch.
        - Operational Staff (Doctor, Nurse, etc.): Own activity logs.
        - Patient: Own activity logs only.
        """
        qs = AuditLog.objects.select_related('branch').order_by('-created_at')
        if getattr(request.user, 'is_superuser', False):
            return qs

        prof = _resolve_actor_profile(request=request)
        if not prof or not prof.role:
            return qs.none()

        role_name = prof.role.name
        staff = getattr(prof, 'staff_profile', None)

        # 1. Super Admin & Auditor -> Full enterprise visibility
        if role_name in [RoleEnum.SUPER_ADMIN, RoleEnum.AUDITOR]:
            return qs

        # 2. Branch Manager / Hospital Admin -> All operational logs for their assigned branch
        if role_name in [RoleEnum.BRANCH_MANAGER, RoleEnum.HOSPITAL_ADMIN]:
            if staff and staff.branch_id:
                return qs.filter(Q(branch_id=staff.branch_id) | Q(branch__isnull=True))
            return qs

        # 3. Department Head -> Logs for their assigned department (or actors in their department)
        if role_name == RoleEnum.DEPARTMENT_HEAD:
            if staff and staff.department_id:
                dept_staff_emails = list(
                    UserProfile.objects.filter(staff_profile__department_id=staff.department_id).values_list('email', flat=True)
                )
                dept_name = staff.department.name if staff.department else ''
                q_filter = Q(actor_email__in=dept_staff_emails)
                if dept_name:
                    q_filter |= Q(new_values___meta__department_name=dept_name)
                if staff.branch_id:
                    qs = qs.filter(Q(branch_id=staff.branch_id) | Q(branch__isnull=True))
                return qs.filter(q_filter)
            return qs.filter(actor_email=prof.email)

        # 4. HR Manager -> HR category logs within their branch
        if role_name == RoleEnum.HR_MANAGER:
            if staff and staff.branch_id:
                qs = qs.filter(Q(branch_id=staff.branch_id) | Q(branch__isnull=True))
            hr_keywords = AUDIT_LOG_CATEGORY_MAP['HR'] + ['USER', 'ROLE']
            q_hr = Q(actor_email=prof.email) | Q(new_values___meta__module__in=['HR_PAYROLL', 'USERS_ROLES', 'DOCTORS_NURSING'])
            for kw in hr_keywords:
                q_hr |= Q(action__icontains=kw) | Q(entity_type__icontains=kw)
            return qs.filter(q_hr)

        # 5. Medical Director -> Clinical category logs within their branch
        if role_name == RoleEnum.MEDICAL_DIRECTOR:
            if staff and staff.branch_id:
                qs = qs.filter(Q(branch_id=staff.branch_id) | Q(branch__isnull=True))
            clin_keywords = AUDIT_LOG_CATEGORY_MAP['CLINICAL']
            q_clin = Q(actor_email=prof.email)
            for kw in clin_keywords:
                q_clin |= Q(action__icontains=kw) | Q(entity_type__icontains=kw)
            return qs.filter(q_clin)

        # 6. Finance Manager / Accountant -> Financial category logs within their branch
        if role_name in [RoleEnum.FINANCE_MANAGER, RoleEnum.ACCOUNTANT]:
            if staff and staff.branch_id:
                qs = qs.filter(Q(branch_id=staff.branch_id) | Q(branch__isnull=True))
            fin_keywords = AUDIT_LOG_CATEGORY_MAP['FINANCE']
            q_fin = Q(actor_email=prof.email)
            for kw in fin_keywords:
                q_fin |= Q(action__icontains=kw) | Q(entity_type__icontains=kw)
            return qs.filter(q_fin)

        # 7. All other staff & patients -> Strictly own activity logs
        return qs.filter(Q(actor_user_id=prof.supabase_user_id) | Q(actor_email=prof.email))

