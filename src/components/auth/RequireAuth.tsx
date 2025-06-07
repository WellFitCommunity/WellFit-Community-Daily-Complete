// src/components/RequireAuth.tsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

interface RequireAuthProps {
  children: JSX.Element;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const [sessionActive, setSessionActive] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then((response) => {
      setSessionActive(!!response.data.session);
    });
  }, []);

  const wellfitUserId = localStorage.getItem('wellfitUserId');
  const communicationConsentGiven = localStorage.getItem('communicationConsent') === 'true';
  const isPreview = Boolean(localStorage.getItem('exploreStartTime'));

  if (sessionActive === null && !wellfitUserId) {
    return <div>Loading session...</div>;
  }

  const isAuthenticated = wellfitUserId || sessionActive;

  if (!communicationConsentGiven) {
    // No consent, redirect to welcome page.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!isPreview && !isAuthenticated) {
    // Not in preview mode and not logged in, redirect to login page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Auth is valid or user is in preview mode
  return children;
};

export default RequireAuth;

