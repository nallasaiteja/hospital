import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { SkeletonLoader } from '../common/SkeletonLoader';

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
  const { user, role, loading } = useAuth();
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

  // Role whitelist
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'PATIENT' ? '/patient/dashboard' : '/staff/dashboard'} replace />;
  }

  return <>{children}</>;
};
