// src/contexts/InactivityLockContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const INACTIVITY_LOCK_TIMEOUT_MS = 48 * 60 * 60 * 1000; // 48 hours for lock screen

interface InactivityLockContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  resetInactivityTimer: () => void;
}

const InactivityLockContext = createContext<InactivityLockContextType | undefined>(undefined);

export const useInactivityLock = () => {
  const context = useContext(InactivityLockContext);
  if (!context) {
    throw new Error('useInactivityLock must be used within an InactivityLockProvider');
  }
  return context;
};

interface InactivityLockProviderProps {
  children: React.ReactNode;
}

export const InactivityLockProvider: React.FC<InactivityLockProviderProps> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const lock = useCallback(() => {
    // Prevent locking if already on lock screen or login/register pages
    if (location.pathname === '/lock-screen' || location.pathname === '/login' || location.pathname === '/register') {
      return;
    }
    console.log('Inactivity detected. Locking screen.');
    setIsLocked(true);
    navigate('/lock-screen');
  }, [navigate, location.pathname]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    // Optionally navigate to a default page or last known page if needed
    // For now, LockScreenUser will handle navigation after successful unlock.
    console.log('Screen unlocked.');
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Only set timer if user is not already locked and not on public pages
    if (!isLocked && location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/lock-screen') {
      inactivityTimerRef.current = setTimeout(lock, INACTIVITY_LOCK_TIMEOUT_MS);
    }
  }, [lock, isLocked, location.pathname]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Initialize timer on mount or when lock status/location changes
    resetInactivityTimer();

    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [resetInactivityTimer]);

  // When isLocked becomes true, clear the timer that would lead to locking again immediately.
  // The LockScreenUser component will be responsible for calling unlock(),
  // which will then allow resetInactivityTimer to set a new timer.
  useEffect(() => {
    if (isLocked && inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
  }, [isLocked]);


  return (
    <InactivityLockContext.Provider value={{ isLocked, lock, unlock, resetInactivityTimer }}>
      {children}
    </InactivityLockContext.Provider>
  );
};
