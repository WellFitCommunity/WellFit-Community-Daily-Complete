// src/components/auth/RequireAuth.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Corrected import path
import React from 'react';

interface RequireAuthProps {
  children: JSX.Element;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const location = useLocation();
  const { session, user, isLoading, isAdmin } = useAuth(); // Use AuthContext

  // TODO: Re-evaluate communicationConsent logic.
  // This was previously from localStorage. It should ideally come from user profile (user.user_metadata or a fetched profile table)
  // For now, we'll assume consent is implicitly handled or needs to be checked elsewhere if critical post-login.
  // const communicationConsentGiven = user?.user_metadata?.communication_consent === true; // Example if stored in user_metadata

  // isPreview logic using localStorage - this is outside the scope of auth localStorage changes for now.
  const isPreview = Boolean(localStorage.getItem('exploreStartTime'));

  if (isLoading) {
    return <div>Loading session...</div>; // Or a proper spinner component
  }

  // If not in preview mode AND there is no active session (user is not logged in)
  if (!isPreview && !session) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If communication consent is a hard requirement before accessing any authenticated route,
  // it needs to be checked here. Example:
  // if (session && !communicationConsentGiven && location.pathname !== '/consent-page') { // Assuming a consent page exists
  //   return <Navigate to="/consent-page" state={{ from: location }} replace />;
  // }

  // If user is authenticated (session exists) or is in preview mode, render children
  return children;
};

export default RequireAuth;

