// src/components/auth/RequireAuth.tsx
import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // While we're fetching the initial session, show a loader
  if (isLoading) {
    return <div>Loading…</div>;
  }

  // If not signed in, redirect to register (preserve attempted URL)
  if (!user) {
    return <Navigate to="/register" state={{ from: location }} replace />;
  }

  // Authenticated — render the protected content
  return <>{children}</>;
};

export default RequireAuth;
