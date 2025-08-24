import { ReactNode, ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

interface RequireAdminAuthProps {
  children: ReactNode;
  allowedRoles?: ('admin' | 'super_admin')[];
}

export default function RequireAdminAuth({
  children,
  allowedRoles = ['admin', 'super_admin'],
}: RequireAdminAuthProps): ReactElement | null {
  const { isAdminAuthenticated, adminRole, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading admin session...</div>;
  }

  if (!isAdminAuthenticated) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  if (adminRole && allowedRoles.length > 0 && !allowedRoles.includes(adminRole)) {
    return (
      <Navigate
        to="/admin"
        state={{ message: 'You do not have the required admin role for this page.' }}
        replace
      />
    );
  }

  // Return a ReactElement (wrap children) — not a raw ReactNode
  return <>{children}</>;
}
