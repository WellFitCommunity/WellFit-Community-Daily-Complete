// src/components/RequireAuth.tsx
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const location = useLocation();

  // 1) Preview flag
  const isPreview = Boolean(localStorage.getItem('exploreStartTime'));

  // 2) Phone+PIN stored locally
  const phone = localStorage.getItem('wellfitPhone');
  const pin   = localStorage.getItem('wellfitPin');

  // 3) (Optional) Supabase session—for email-based users
  const [session, setSession] = useState<boolean>(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });
  }, []);

  // If not a preview, and not phone+PIN, and not logged-in via email, block access
  if (!isPreview && !(phone && pin) && !session) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Otherwise render the protected content
  return children;
};

export default RequireAuth;

