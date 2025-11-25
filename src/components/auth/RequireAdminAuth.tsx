// src/components/auth/RequireAdminAuth.tsx
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { StaffRole } from '../../types/roles';

interface RequireAdminAuthProps {
  children: ReactNode;
  allowedRoles?: StaffRole[];
}

export default function RequireAdminAuth({
  children,
  allowedRoles = ['admin', 'super_admin', 'it_admin'],
}: RequireAdminAuthProps) {
  const { isAdminAuthenticated, adminRole, isLoading } = useAdminAuth();
  const location = useLocation();

  // While verifying admin session
  if (isLoading) {
    return (
      <div className="w-full h-[40vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated as admin → go to the admin login screen, preserve target
  if (!isAdminAuthenticated) {
    return <Navigate
      to="/admin-login"
      state={{
        from: location,
        message: 'Please enter your admin PIN to access this page.'
      }}
      replace
    />;
  }

  // Auth'd, but role not allowed → bounce to admin-login with a message
  if (adminRole && allowedRoles.length > 0 && !allowedRoles.includes(adminRole)) {
    return (
      <Navigate
        to="/admin-login"
        state={{ from: location, message: 'You do not have the required admin role for this page.' }}
        replace
      />
    );
  }

  // All good → render protected admin content
  return <>{children}</>;
}