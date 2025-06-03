// src/components/RequireAuth.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js'; // Import Session type

interface RequireAuthProps {
  children: JSX.Element;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();

  // 1) Preview flag
  const isPreview = Boolean(localStorage.getItem('exploreStartTime'));

  // 2) Phone+PIN stored locally
  const phone = localStorage.getItem('wellfitPhone');
  const pin   = localStorage.getItem('wellfitPin');

  // 3) (Optional) Supabase session—for email-based users
  const [sessionActive, setSessionActive] = useState<boolean>(false); // Renamed to avoid conflict with imported Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }: { data: { session: Session | null } }) => {
      setSessionActive(!!currentSession);
    });
  }, []);

  // 4) Communication consent
  const communicationConsentGiven = localStorage.getItem('communicationConsent') === 'true';

  // If communication consent is not given, or if not a preview and not phone+PIN and not logged-in via email, block access
  if (!communicationConsentGiven || (!isPreview && !(phone && pin) && !sessionActive)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Otherwise render the protected content
  return children;
};

export default RequireAuth;

