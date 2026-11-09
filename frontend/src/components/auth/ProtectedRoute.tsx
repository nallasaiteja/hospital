import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { canAccessRoute, resolveRouteModule, ROLE_DATA_SCOPES } from '../../config/rbacMatrix';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireStaff?: boolean;
  requirePatient?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireStaff = false,
  requirePatient = false,
}) => {
  const { user, role, staffProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-slate-800 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-slate-800 rounded w-1/3 animate-pulse" />
            </div>
          </div>
          <SkeletonLoader variant="card" count={2} />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (requirePatient) {
      return <Navigate to="/patient/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  // Staff requirement: Patient is denied
  if (requireStaff && role === 'PATIENT') {
    return <Navigate to="/patient/dashboard" replace />;
  }

  // Patient requirement: Staff is denied
  if (requirePatient && role && role !== 'PATIENT') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  // Explicit Role whitelist
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const fallbackRoute =
      role === 'PATIENT' ? '/patient/dashboard' :
      role === 'LAB_TECHNICIAN' ? '/staff/laboratory' :
      role === 'RADIOLOGY_TECHNICIAN' ? '/staff/radiology' :
      role === 'PHARMACIST' ? '/staff/pharmacy' :
      role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT' ? '/staff/profit-loss' :
      role === 'INSURANCE_COORDINATOR' ? '/staff/insurance' :
      role === 'BILLING_EXECUTIVE' || role === 'CASHIER' ? '/staff/billing?tab=invoices' :
      role === 'AUDITOR' ? '/staff/settings-audit' :
      role === 'HOSPITAL_ADMIN' ? '/staff/reports?tab=FINANCE' :
      role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER' ? '/staff/branch-manager' :
      role === 'DEPARTMENT_HEAD' ? '/staff/department-head' :
      role === 'HR_MANAGER' ? '/staff/hr-management' :
      role === 'INVENTORY_MANAGER' || role === 'PROCUREMENT_OFFICER' ? '/staff/inventory' :
      role === 'INVESTMENT_MANAGER' ? '/staff/investments' :
      role === 'MEDICAL_DIRECTOR' ? '/staff/doctor-workspace' :
      role === 'NURSE' ? '/staff/nurse-workspace?tab=patients' :
      '/staff/dashboard';
    return <Navigate to={fallbackRoute} replace />;
  }

  // 3D RBAC Route-Level Authorization Check for /staff/* routes
  if (requireStaff && role && !canAccessRoute(role, location.pathname)) {
    const matchedModule = resolveRouteModule(location.pathname);
    const scope = ROLE_DATA_SCOPES[role] || 'OWN';
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl bg-slate-900 border border-rose-500/30 p-8 shadow-2xl text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Lock className="w-3 h-3" /> 403 Organizational Access Restricted
            </span>
            <h1 className="text-xl font-bold text-white">
              Unauthorized Module Access
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your current role (<strong className="text-cyan-400">{role}</strong>, Scope: <strong className="text-slate-200">{scope}</strong>) is not authorized to access{' '}
              <strong className="text-white">{matchedModule?.label || location.pathname}</strong>.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-[11px] text-slate-400 space-y-1">
            <div><strong className="text-slate-300">Employee ID:</strong> {staffProfile?.employee_id || 'Staff Account'}</div>
            <div><strong className="text-slate-300">Department:</strong> {staffProfile?.department_name || 'Assigned Department'}</div>
            <div><strong className="text-slate-300">Security Policy:</strong> Hospital Role Responsibility Separation & Least Privilege Enforcement</div>
          </div>
          <div className="pt-2">
            <Link
              to={
                role === 'LAB_TECHNICIAN' ? '/staff/laboratory' :
                role === 'RADIOLOGY_TECHNICIAN' ? '/staff/radiology' :
                role === 'PHARMACIST' ? '/staff/pharmacy' :
                role === 'FINANCE_MANAGER' || role === 'ACCOUNTANT' ? '/staff/profit-loss' :
                role === 'INSURANCE_COORDINATOR' ? '/staff/insurance' :
                role === 'BILLING_EXECUTIVE' || role === 'CASHIER' ? '/staff/billing?tab=invoices' :
                role === 'AUDITOR' ? '/staff/settings-audit' :
                role === 'HOSPITAL_ADMIN' ? '/staff/reports?tab=FINANCE' :
                role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER' ? '/staff/branch-manager' :
                role === 'DEPARTMENT_HEAD' ? '/staff/department-head' :
                role === 'HR_MANAGER' ? '/staff/hr-management' :
                role === 'INVENTORY_MANAGER' || role === 'PROCUREMENT_OFFICER' ? '/staff/inventory' :
                role === 'INVESTMENT_MANAGER' ? '/staff/investments' :
                role === 'MEDICAL_DIRECTOR' ? '/staff/doctor-workspace' :
                role === 'NURSE' ? '/staff/nurse-workspace?tab=patients' :
                '/staff/dashboard'
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Authorized Workspace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
