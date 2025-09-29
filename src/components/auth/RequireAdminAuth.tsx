// src/components/auth/RequireAdminAuth.tsx
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface RequireAdminAuthProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'super_admin' | 'nurse')[];
}

export default function RequireAdminAuth({
  children,
  allowedRoles = ['admin', 'super_admin', 'nurse'],
}: RequireAdminAuthProps) {
  const { isAdminAuthenticated, adminRole, isLoading } = useAdminAuth();
  const location = useLocation();

  // While verifying admin session
  if (isLoading) {
    return (
      <div className="w-full h-[40vh] flex items-center justify-center text-gray-600">
        Loading admin session…
      </div>
    );
  }

  // Not authenticated as admin → go to the admin login screen, preserve target
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin-login" state={{ from: location }} replace />;
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