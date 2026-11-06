import { useAuth } from '../context/AuthContext';
import {
  RBACModule,
  RBACAction,
  ROLE_DATA_SCOPES,
  STRICT_READ_ONLY_ROLES,
  HR_ASSIGNABLE_ROLES,
  canPerformModuleAction,
  canAccessRoute,
  resolveRouteModule,
} from '../config/rbacMatrix';

export function usePermissions() {
  const { role, staffProfile, userProfile } = useAuth();

  const can = (module: RBACModule, action: RBACAction = 'view'): boolean => {
    return canPerformModuleAction(role, module, action);
  };

  const isReadOnlyRole = role ? STRICT_READ_ONLY_ROLES.includes(role) : false;
  const dataScope = role ? ROLE_DATA_SCOPES[role] || 'OWN' : 'OWN';

  return {
    role,
    can,
    canAccessRoute: (pathname: string) => canAccessRoute(role, pathname),
    resolveRouteModule,
    isReadOnlyRole,
    dataScope,
    hrAssignableRoles: HR_ASSIGNABLE_ROLES,
    assignedBranchId: staffProfile?.branch || staffProfile?.branch_id || null,
    assignedBranchName: staffProfile?.branch_name || null,
    assignedDepartmentId: staffProfile?.department || staffProfile?.department_id || null,
    assignedDepartmentName: staffProfile?.department_name || null,
    userEmail: userProfile?.email || '',
  };
}

