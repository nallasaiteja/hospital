from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.authentication'
    verbose_name = 'Authentication & Identity'

    def ready(self):
        # Install Universal Global Security Guard for Branch Manager (Hospital Admin)
        # Guarantees that EVERY DRF APIView and ViewSet enforces strict read-only and branch isolation
        from rest_framework.views import APIView
        from rest_framework.exceptions import PermissionDenied
        from apps.authentication.models import RoleEnum
        from apps.authentication.permissions import resolve_user_profile, _record_denied_attempt

        orig_initial = APIView.initial
        orig_check_object_permissions = APIView.check_object_permissions

        def strict_branch_manager_initial(self, request, *args, **kwargs):
            orig_initial(self, request, *args, **kwargs)
            if not (request.user and request.user.is_authenticated) or getattr(request.user, 'is_superuser', False):
                return

            prof = resolve_user_profile(request)
            if not prof or not prof.role:
                return

            role_name = prof.role.name
            if role_name == RoleEnum.BRANCH_MANAGER:
                # 1. Reject ANY write/mutation method (POST, PUT, PATCH, DELETE)
                if request.method not in ('GET', 'HEAD', 'OPTIONS'):
                    if request.path.rstrip('/').endswith('/auth/logout'):
                        return
                    reason = (
                        f"Access Denied (403 Forbidden): '{prof.role.display_name}' has strict READ-ONLY permissions "
                        f"and is strictly prohibited from creating, updating, deleting, approving, or finalizing records."
                    )
                    _record_denied_attempt(request, getattr(self, 'rbac_module', 'OPERATIONS'), request.method.lower(), reason)
                    raise PermissionDenied(reason)

                # 2. Reject custom action/mutation routes even if called via GET
                path_lower = request.path.rstrip('/').lower()
                action_tokens = [
                    '/action', '/approve', '/reject', '/cancel', '/release', '/dispense',
                    '/admit', '/discharge', '/settle', '/refund', '/void', '/execute',
                    '/finalize', '/provision', '/toggle', '/reset'
                ]
                if any(path_lower.endswith(tok) or f"{tok}/" in path_lower for tok in action_tokens):
                    reason = (
                        f"Access Denied (403 Forbidden): '{prof.role.display_name}' is restricted from "
                        f"executing operational workflow actions, approvals, or mutations."
                    )
                    _record_denied_attempt(request, getattr(self, 'rbac_module', 'OPERATIONS'), 'action', reason)
                    raise PermissionDenied(reason)

                # 3. Enforce Branch Isolation on query parameters and route parameters
                staff = getattr(prof, 'staff_profile', None)
                assigned_branch_id = getattr(staff, 'branch_id', None)
                if assigned_branch_id:
                    req_branch = (
                        request.query_params.get('branch_id') or
                        request.query_params.get('branch') or
                        getattr(self, 'kwargs', {}).get('branch_id')
                    )
                    if req_branch and str(req_branch).lower() != str(assigned_branch_id).lower() and str(req_branch).lower() not in ('null', '', 'none'):
                        reason = (
                            f"Access Denied (403 Forbidden): You are only authorized to view records belonging to your "
                            f"assigned branch ({staff.branch.name if getattr(staff, 'branch', None) else assigned_branch_id})."
                        )
                        _record_denied_attempt(request, getattr(self, 'rbac_module', 'OPERATIONS'), 'branch_isolation', reason)
                        raise PermissionDenied(reason)

        def strict_branch_manager_check_object_permissions(self, request, obj):
            orig_check_object_permissions(self, request, obj)
            if not (request.user and request.user.is_authenticated) or getattr(request.user, 'is_superuser', False):
                return

            prof = resolve_user_profile(request)
            if not prof or not prof.role:
                return

            role_name = prof.role.name
            if role_name == RoleEnum.BRANCH_MANAGER:
                if request.method not in ('GET', 'HEAD', 'OPTIONS'):
                    raise PermissionDenied("Access Denied: Read-only role cannot mutate records.")

                staff = getattr(prof, 'staff_profile', None)
                assigned_branch_id = getattr(staff, 'branch_id', None)
                if assigned_branch_id:
                    obj_branch_id = getattr(obj, 'branch_id', None) or (getattr(obj, 'branch', None) and getattr(obj.branch, 'id', None))
                    if obj_branch_id and str(obj_branch_id).lower() != str(assigned_branch_id).lower():
                        raise PermissionDenied("Access Denied: Record belongs to another hospital branch.")

        APIView.initial = strict_branch_manager_initial
        APIView.check_object_permissions = strict_branch_manager_check_object_permissions
