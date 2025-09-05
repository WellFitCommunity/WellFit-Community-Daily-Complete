// src/components/auth/RequireAuth.tsx
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  // While checking the initial session, avoid flashing protected UI
  if (isLoading) {
    return (
      <div className="w-full h-[40vh] flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  // Not signed in → send to login; preserve attempted destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated → render protected content
  return <>{children}</>;
}
