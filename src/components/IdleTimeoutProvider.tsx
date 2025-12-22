/**
 * IdleTimeoutProvider Component
 *
 * Wraps the app with idle timeout functionality.
 * Shows warning modal before auto-logout.
 * Only active when user is logged in.
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { IdleTimeoutWarning } from './IdleTimeoutWarning';

interface IdleTimeoutProviderProps {
  children: React.ReactNode;
  /** Timeout in minutes (default: 15) */
  timeoutMinutes?: number;
  /** Warning before logout in minutes (default: 2) */
  warningMinutes?: number;
}

export const IdleTimeoutProvider: React.FC<IdleTimeoutProviderProps> = ({
  children,
  timeoutMinutes = 15,
  warningMinutes = 2,
}) => {
  const { session } = useAuth();
  const isLoggedIn = !!session;

  const {
    showWarning,
    secondsRemaining,
    extendSession,
    logoutNow,
  } = useIdleTimeout({
    timeoutMs: timeoutMinutes * 60 * 1000,
    warningBeforeMs: warningMinutes * 60 * 1000,
    enabled: isLoggedIn,
  });

  return (
    <>
      {children}
      <IdleTimeoutWarning
        show={showWarning}
        secondsRemaining={secondsRemaining}
        onStayLoggedIn={extendSession}
        onLogout={logoutNow}
      />
    </>
  );
};

export default IdleTimeoutProvider;
