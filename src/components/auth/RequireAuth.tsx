// src/components/RequireAuth.tsx
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
<<<<<<< HEAD:src/components/RequireAuth.tsx
import { supabase } from '../lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
=======
import { supabase } from '../../lib/supabaseClient';
>>>>>>> 0d60695e000b23b8b168752c2686ce686e47468f:src/components/auth/RequireAuth.tsx

interface RequireAuthProps {
  children: JSX.Element;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const [sessionActive, setSessionActive] = useState<boolean | null>(null); // null while loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }: { data: { session: Session | null } }) => {
      setSessionActive(!!currentSession);
    });

    // Optional: Listen for auth changes if needed, though getSession is usually enough for a load check
    // const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    //   setSessionActive(!!session);
    // });
    // return () => authListener?.subscription.unsubscribe();
  }, []);

  const wellfitUserId = localStorage.getItem('wellfitUserId');
  const communicationConsentGiven = localStorage.getItem('communicationConsent') === 'true';
  const isPreview = Boolean(localStorage.getItem('exploreStartTime')); // Retain preview flag if needed

  // Wait for session check to complete
  if (sessionActive === null && !wellfitUserId) {
    // If no wellfitUserId, we might be relying on Supabase session, so wait for it.
    // If wellfitUserId exists, we can proceed without waiting for Supabase session check for this logic path.
    return <div>Loading session...</div>; // Or some loading spinner
  }

  const isAuthenticated = wellfitUserId || sessionActive;

  if (!communicationConsentGiven) {
    // If communication consent is not given, always redirect to WelcomePage to re-consent.
    // This page should ideally not require auth itself.
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!isPreview && !isAuthenticated) {
    // If not in preview mode AND not authenticated (neither wellfitUserId nor Supabase session), redirect to login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If all checks pass (or in preview mode), render the protected content.
  return children;
};

export default RequireAuth;
