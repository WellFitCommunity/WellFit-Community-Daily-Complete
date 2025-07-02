import React from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Navigate, useLocation } from 'react-router-dom';

interface RequireAdminAuthProps {
  children: JSX.Element;
  allowedRoles?: ('admin' | 'super_admin')[]; // Optional: specify which admin roles are allowed
}

const RequireAdminAuth: React.FC<RequireAdminAuthProps> = ({ children, allowedRoles }) => {
  const { isAdminAuthenticated, adminRole, isLoading } = useAdminAuth();
  const location = useLocation();

  if (isLoading) {
    // Optional: Show a loading spinner or a blank page while auth state is being determined
    // especially if there's an async check on load (e.g. restoring from session storage)
    return <div>Loading admin session...</div>;
  }

  if (!isAdminAuthenticated) {
    // Redirect them to the /admin page (where AdminPanel handles PIN entry)
    // Pass the current location so we can redirect back after login.
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  // If specific roles are required, check if the current adminRole matches
  if (allowedRoles && adminRole && !allowedRoles.includes(adminRole)) {
    // User is an admin but not the correct type of admin for this route
    // Redirect to a generic admin page or show an 'unauthorized' message
    // For simplicity, redirecting to /admin, which might show their current role's view
    // or they can re-login if needed. Or show a specific "Access Denied" component.
    console.warn(`Admin role '${adminRole}' not authorized for this page. Allowed: ${allowedRoles.join(', ')}`);
    return <Navigate to="/admin" state={{ message: "You do not have the required admin role for this page." }} replace />;
  }

  return children;
};

export default RequireAdminAuth;
