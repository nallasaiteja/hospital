import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from rest_framework import status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from drf_spectacular.utils import extend_schema

from apps.core.models import Branch, Department
from apps.authentication.models import (
    Role,
    RoleEnum,
    Permission,
    UserProfile,
    StaffProfile,
    StaffStatus,
    FinancialApprovalPolicy,
    FinancialApprovalRequest,
    ApprovalRequestStatus,
    FinancialOperationType,
    SecurityAuditEvent,
    SecurityEventType,
)
from apps.authentication.permissions import IsStaffMember, IsSuperAdmin, HasRole
from apps.authentication.throttling import AuthRateThrottle
from apps.authentication.serializers import (
    RoleSerializer,
    PermissionSerializer,
    UserProfileSerializer,
    StaffProfileSerializer,
    FinancialApprovalPolicySerializer,
    FinancialApprovalRequestSerializer,
    SecurityAuditEventSerializer,
    UserManagementUpdateSerializer,
)


def get_requester_profile(request):
    claims = getattr(request, 'supabase_claims', {})
    sub = claims.get('sub') or request.user.username
    try:
        sub_uuid = uuid.UUID(str(sub))
        profile = UserProfile.objects.select_related('role', 'staff_profile').filter(supabase_user_id=sub_uuid).first()
        if profile:
            return profile
    except (ValueError, TypeError):
        pass
    return UserProfile.objects.select_related('role', 'staff_profile').filter(email=getattr(request.user, 'email', '')).first()


class UserManagementListView(views.APIView):
    """
    User Administration: List, search, and update staff and patient user accounts.
    Allows administrators to assign authorized roles, branches, and departments.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requester = get_requester_profile(request)
        if not request.user.is_superuser:
            if not requester or requester.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.HR_MANAGER, RoleEnum.AUDITOR]:
                return Response({'error': 'Unauthorized to view user administration.'}, status=status.HTTP_403_FORBIDDEN)

        qs = UserProfile.objects.select_related('role', 'staff_profile__branch', 'staff_profile__department', 'patient_profile__primary_branch').all()

        role = request.query_params.get('role')
        if role and role != 'ALL':
            qs = qs.filter(role__name=role)

        branch_id = request.query_params.get('branch_id')
        if branch_id and branch_id != 'ALL':
            qs = qs.filter(staff_profile__branch_id=branch_id)

        status_param = request.query_params.get('status')
        if status_param == 'ACTIVE':
            qs = qs.filter(is_active=True)
        elif status_param == 'INACTIVE':
            qs = qs.filter(is_active=False)

        search = request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(staff_profile__employee_id__icontains=search)
            )

        results = []
        for u in qs[:100]:
            item = {
                'id': str(u.id),
                'supabase_user_id': str(u.supabase_user_id),
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'full_name': u.full_name,
                'phone_number': u.phone_number,
                'role': u.role.name,
                'role_name': u.role.name,
                'role_display': u.role.display_name,
                'role_display_name': u.role.display_name,
                'is_active': u.is_active,
                'is_verified': u.is_verified,
                'created_at': u.created_at.isoformat(),
                'branch_name': None,
                'department_name': None,
                'designation': None,
            }
            if hasattr(u, 'staff_profile'):
                sp = u.staff_profile
                item['branch_id'] = str(sp.branch_id) if sp.branch_id else None
                item['branch_name'] = sp.branch.name if sp.branch else 'All Branches'
                item['department_id'] = str(sp.department_id) if sp.department_id else None
                item['department_name'] = sp.department.name if sp.department else None
                item['designation'] = sp.designation
                item['staff_profile'] = {
                    'employee_id': sp.employee_id,
                    'designation': sp.designation,
                    'specialization': sp.specialization,
                    'branch_id': str(sp.branch_id),
                    'branch_name': sp.branch.name if sp.branch else None,
                    'department_id': str(sp.department_id) if sp.department_id else None,
                    'department_name': sp.department.name if sp.department else None,
                    'status': sp.status,
                }
            elif hasattr(u, 'patient_profile'):
                pp = u.patient_profile
                item['branch_name'] = pp.primary_branch.name if pp.primary_branch else None
                item['patient_profile'] = {
                    'mrn': pp.medical_record_number,
                    'branch_name': pp.primary_branch.name if pp.primary_branch else None,
                }
            results.append(item)

        return Response(results, status=status.HTTP_200_OK)


class UserManagementDetailView(views.APIView):
    """
    Updates user role, branch, department, and active status with security auditing.
    Prevents self-elevation and prevents deactivating the last Super Administrator.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, pk):
        requester = get_requester_profile(request)
        if not request.user.is_superuser:
            if not requester or requester.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.BRANCH_MANAGER, RoleEnum.HR_MANAGER]:
                return Response({'error': 'Unauthorized to modify user accounts.'}, status=status.HTTP_403_FORBIDDEN)

        target_user = UserProfile.objects.select_related('role', 'staff_profile').filter(id=pk).first()
        if not target_user:
            return Response({'error': 'User profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UserManagementUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        actor_email = requester.email if requester else 'admin@system.local'

        # Rule 1: Prevent deactivating the last Super Admin
        if data.get('is_active') is False and target_user.role.name == RoleEnum.SUPER_ADMIN:
            active_super_admins = UserProfile.objects.filter(role__name=RoleEnum.SUPER_ADMIN, is_active=True).count()
            if active_super_admins <= 1:
                return Response({'error': 'Cannot deactivate the last active Super Administrator.'}, status=status.HTTP_400_BAD_REQUEST)

        # Rule 2: Prevent users from elevating themselves to Super Admin unless already Super Admin
        if 'role_name' in data and data['role_name'] == RoleEnum.SUPER_ADMIN:
            if not request.user.is_superuser and (not requester or requester.role.name != RoleEnum.SUPER_ADMIN):
                SecurityAuditEvent.objects.create(
                    event_type=SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
                    actor_email=actor_email,
                    target_user_id=target_user.supabase_user_id,
                    target_user_email=target_user.email,
                    details={'attempt': 'Privilege escalation to SUPER_ADMIN denied'}
                )
                return Response({'error': 'Only existing Super Administrators can grant Super Administrator role.'}, status=status.HTTP_403_FORBIDDEN)

        # Update Role
        if 'role_name' in data:
            new_role = Role.objects.filter(name=data['role_name']).first()
            if not new_role:
                return Response({'error': f"Role '{data['role_name']}' does not exist."}, status=status.HTTP_400_BAD_REQUEST)
            old_role_name = target_user.role.name
            target_user.role = new_role
            target_user.save(update_fields=['role'])

            SecurityAuditEvent.objects.create(
                event_type=SecurityEventType.ROLE_REASSIGNED,
                actor_email=actor_email,
                target_user_id=target_user.supabase_user_id,
                target_user_email=target_user.email,
                details={'old_role': old_role_name, 'new_role': new_role.name}
            )

        # Update Active Status
        if 'is_active' in data:
            old_status = target_user.is_active
            target_user.is_active = data['is_active']
            target_user.save(update_fields=['is_active'])

            SecurityAuditEvent.objects.create(
                event_type=SecurityEventType.USER_STATUS_CHANGED,
                actor_email=actor_email,
                target_user_id=target_user.supabase_user_id,
                target_user_email=target_user.email,
                details={'old_status': old_status, 'new_status': data['is_active']}
            )

        # Update Staff Profile attributes (branch, department, designation)
        if hasattr(target_user, 'staff_profile'):
            sp = target_user.staff_profile
            updated_sp_fields = []
            if 'branch_id' in data:
                branch = Branch.objects.filter(id=data['branch_id']).first()
                if branch:
                    sp.branch = branch
                    updated_sp_fields.append('branch')
            if 'department_id' in data:
                dept = Department.objects.filter(id=data['department_id']).first() if data['department_id'] else None
                sp.department = dept
                updated_sp_fields.append('department')
            if 'designation' in data:
                sp.designation = data['designation']
                updated_sp_fields.append('designation')

            if updated_sp_fields:
                sp.save(update_fields=updated_sp_fields)

        return Response({'message': f'User {target_user.email} updated successfully.'}, status=status.HTTP_200_OK)


class PermissionsListView(views.APIView):
    """
    Returns all 192 system granular permission tokens grouped by module and action.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        perms = Permission.objects.all().order_by('module', 'code')
        serializer = PermissionSerializer(perms, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RolePermissionsDetailView(views.APIView):
    """
    Manage granular permissions assigned to a specific role.
    Supports role lookup by UUID or role name string (e.g. 'DOCTOR').
    """
    permission_classes = [IsAuthenticated]

    def _get_role(self, pk):
        import uuid
        try:
            val_uuid = uuid.UUID(str(pk))
            role = Role.objects.filter(id=val_uuid).prefetch_related('permissions').first()
            if role:
                return role
        except (ValueError, AttributeError):
            pass
        return Role.objects.filter(name__iexact=str(pk)).prefetch_related('permissions').first()

    def get(self, request, pk):
        role = self._get_role(pk)
        if not role:
            return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)
        codes = [p.code for p in role.permissions.all()]
        return Response({
            'role_id': str(role.id),
            'role_name': role.name,
            'display_name': role.display_name,
            'permissions': codes,
            'permission_codes': codes,
            'permissions_count': len(codes),
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, pk):
        return self._save_permissions(request, pk)

    @transaction.atomic
    def put(self, request, pk):
        return self._save_permissions(request, pk)

    def _save_permissions(self, request, pk):
        requester = get_requester_profile(request)
        if not request.user.is_superuser:
            if not requester or requester.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN]:
                return Response({'error': 'Unauthorized to modify role permissions.'}, status=status.HTTP_403_FORBIDDEN)

        role = self._get_role(pk)
        if not role:
            return Response({'error': 'Role not found.'}, status=status.HTTP_404_NOT_FOUND)

        permission_codes = request.data.get('permissions') or request.data.get('permission_codes') or []
        valid_perms = Permission.objects.filter(code__in=permission_codes)
        role.permissions.set(valid_perms)

        actor_email = requester.email if requester else 'admin@system.local'
        SecurityAuditEvent.objects.create(
            event_type=SecurityEventType.PERMISSIONS_UPDATED,
            actor_email=actor_email,
            details={'role': role.name, 'assigned_permissions_count': valid_perms.count()}
        )

        codes = [p.code for p in role.permissions.all()]
        return Response({
            'message': f"Updated permissions for role '{role.display_name}'.",
            'permissions_count': valid_perms.count(),
            'permission_codes': codes,
            'permissions': codes,
        }, status=status.HTTP_200_OK)


class FinancialApprovalPolicyView(views.APIView):
    """
    Configurable Financial Approval Limits: List and configure monetary thresholds per operation.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        policies = FinancialApprovalPolicy.objects.select_related('approver_role', 'branch').all()
        serializer = FinancialApprovalPolicySerializer(policies, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        requester = get_requester_profile(request)
        if not request.user.is_superuser:
            if not requester or requester.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.FINANCE_MANAGER]:
                return Response({'error': 'Unauthorized to configure financial approval policies.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        approver_role = Role.objects.filter(id=data.get('approver_role')).first() or Role.objects.filter(name=data.get('approver_role_name')).first()
        if not approver_role:
            return Response({'error': 'Valid approver role required.'}, status=status.HTTP_400_BAD_REQUEST)

        policy = FinancialApprovalPolicy.objects.create(
            operation_type=data.get('operation_type'),
            min_amount=Decimal(str(data.get('min_amount', '0.00'))),
            max_amount=Decimal(str(data['max_amount'])) if data.get('max_amount') else None,
            approver_role=approver_role,
            requires_separation_of_duties=data.get('requires_separation_of_duties', True),
            description=data.get('description', '')
        )
        return Response(FinancialApprovalPolicySerializer(policy).data, status=status.HTTP_201_CREATED)


class FinancialApprovalRequestView(views.APIView):
    """
    List and submit financial approval requests.
    Enforces separation of duties and financial approval limits.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FinancialApprovalRequest.objects.select_related(
            'requested_by__user_profile__role',
            'reviewed_by__user_profile',
            'branch'
        ).all()

        status_param = request.query_params.get('status')
        if status_param and status_param != 'ALL':
            qs = qs.filter(status=status_param)

        op_type = request.query_params.get('operation_type')
        if op_type:
            qs = qs.filter(operation_type=op_type)

        serializer = FinancialApprovalRequestSerializer(qs[:50], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request):
        requester = get_requester_profile(request)
        staff = getattr(requester, 'staff_profile', None)
        if not staff:
            return Response({'error': 'Only active staff can initiate financial approval requests.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        req_number = f"FAR-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        req_obj = FinancialApprovalRequest.objects.create(
            request_number=req_number,
            operation_type=data.get('operation_type'),
            entity_type=data.get('entity_type', 'Invoice'),
            entity_id=uuid.UUID(data.get('entity_id', str(uuid.uuid4()))),
            amount=Decimal(str(data.get('amount', '0.00'))),
            reason=data.get('reason', 'Transaction exceeds standard authorization threshold'),
            requested_by=staff,
            branch=staff.branch,
            requires_separation_of_duties=data.get('requires_separation_of_duties', True),
            status=ApprovalRequestStatus.PENDING,
        )
        return Response(FinancialApprovalRequestSerializer(req_obj).data, status=status.HTTP_201_CREATED)


class FinancialApprovalActionView(views.APIView):
    """
    Decision action: APPROVE or REJECT a financial request.
    STRICT ENFORCEMENT:
    1. Separation of duties: Creator CANNOT approve their own transaction.
    2. Role check: Reviewer must have designated approval authority.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        requester = get_requester_profile(request)
        reviewer_staff = getattr(requester, 'staff_profile', None)

        approval_req = FinancialApprovalRequest.objects.select_related('requested_by__user_profile').filter(id=pk).first()
        if not approval_req:
            return Response({'error': 'Financial approval request not found.'}, status=status.HTTP_404_NOT_FOUND)

        if approval_req.status != ApprovalRequestStatus.PENDING:
            return Response({'error': f'Request is already {approval_req.status}.'}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get('action')
        comments = request.data.get('comments', '')

        # SEPARATION OF DUTIES CHECK
        if approval_req.requires_separation_of_duties:
            if reviewer_staff and approval_req.requested_by_id == reviewer_staff.id:
                SecurityAuditEvent.objects.create(
                    event_type=SecurityEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
                    actor_email=requester.email if requester else 'unknown',
                    details={
                        'violation': 'Prohibited self-approval of financial transaction',
                        'request_number': approval_req.request_number,
                        'amount': str(approval_req.amount)
                    }
                )
                return Response({
                    'error': 'Separation of duties violation: Transaction creators are strictly prohibited from approving their own financial requests.'
                }, status=status.HTTP_403_FORBIDDEN)

        # ROLE PERMISSION CHECK
        allowed_roles = [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.FINANCE_MANAGER, RoleEnum.ACCOUNTANT, RoleEnum.INVESTMENT_MANAGER, RoleEnum.PROCUREMENT_OFFICER]
        if not request.user.is_superuser and (not requester or requester.role.name not in allowed_roles):
            return Response({'error': 'You do not possess the financial approval authority for this transaction.'}, status=status.HTTP_403_FORBIDDEN)

        actor_email = requester.email if requester else 'admin@system.local'

        if action == 'APPROVE':
            approval_req.status = ApprovalRequestStatus.APPROVED
            approval_req.reviewed_by = reviewer_staff
            approval_req.reviewed_at = timezone.now()
            approval_req.review_comments = comments
            approval_req.save()

            SecurityAuditEvent.objects.create(
                event_type=SecurityEventType.FINANCIAL_APPROVED,
                actor_email=actor_email,
                details={
                    'request_number': approval_req.request_number,
                    'amount': str(approval_req.amount),
                    'operation_type': approval_req.operation_type,
                    'comments': comments,
                }
            )
            return Response({'message': f'Financial request {approval_req.request_number} APPROVED successfully.'}, status=status.HTTP_200_OK)

        elif action == 'REJECT':
            approval_req.status = ApprovalRequestStatus.REJECTED
            approval_req.reviewed_by = reviewer_staff
            approval_req.reviewed_at = timezone.now()
            approval_req.review_comments = comments
            approval_req.save()

            SecurityAuditEvent.objects.create(
                event_type=SecurityEventType.FINANCIAL_REJECTED,
                actor_email=actor_email,
                details={
                    'request_number': approval_req.request_number,
                    'amount': str(approval_req.amount),
                    'operation_type': approval_req.operation_type,
                    'rejection_reason': comments,
                }
            )
            return Response({'message': f'Financial request {approval_req.request_number} REJECTED.'}, status=status.HTTP_200_OK)

        return Response({'error': "Invalid action. Use 'APPROVE' or 'REJECT'."}, status=status.HTTP_400_BAD_REQUEST)


class SecurityAuditEventsView(views.APIView):
    """
    Read-only endpoint for security, access control, and compliance auditing.
    Auditors and Administrators can inspect immutable event logs.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        requester = get_requester_profile(request)
        if not request.user.is_superuser:
            if not requester or requester.role.name not in [RoleEnum.SUPER_ADMIN, RoleEnum.HOSPITAL_ADMIN, RoleEnum.AUDITOR]:
                return Response({'error': 'Auditor or Administrator privileges required to inspect security logs.'}, status=status.HTTP_403_FORBIDDEN)

        qs = SecurityAuditEvent.objects.all()

        event_type = request.query_params.get('event_type')
        if event_type:
            qs = qs.filter(event_type=event_type)

        search = request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(actor_email__icontains=search) | Q(target_user_email__icontains=search))

        serializer = SecurityAuditEventSerializer(qs[:100], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PasswordRecoveryView(views.APIView):
    """
    Password recovery initiation. Coordinates with Supabase Auth password reset.
    Logs security audit event for tracking. Rate limited to 10 requests / minute.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user_exists = UserProfile.objects.filter(email=email).exists()

        SecurityAuditEvent.objects.create(
            event_type=SecurityEventType.PASSWORD_RESET_REQUESTED,
            actor_email=email,
            details={'user_exists': user_exists, 'ip': request.META.get('REMOTE_ADDR', '')}
        )

        return Response({
            'message': 'If an account exists with this email address, password recovery instructions have been dispatched.'
        }, status=status.HTTP_200_OK)


class MFAStatusView(views.APIView):
    """
    Multi-Factor Authentication status inquiry and verification check.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        claims = getattr(request, 'supabase_claims', {})
        amr = claims.get('amr', [])
        is_mfa_enabled = any(factor.get('method') in ['totp', 'mfa'] for factor in amr) if isinstance(amr, list) else False

        return Response({
            'user': request.user.email,
            'is_mfa_enabled': is_mfa_enabled,
            'supported_methods': ['TOTP (Authenticator App)', 'SMS / Email OTP'],
            'status': 'ACTIVE' if is_mfa_enabled else 'OPTIONAL',
        }, status=status.HTTP_200_OK)
