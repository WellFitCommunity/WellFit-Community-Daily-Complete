import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext'; // <-- add this

type DemoCtx = {
  demoMode: boolean;
  demoTimeLeft: number;              // seconds
  startDemo: (seconds?: number) => void;
  endDemo: () => void;
};

const DemoModeContext = createContext<DemoCtx>({
  demoMode: false,
  demoTimeLeft: 0,
  startDemo: () => {},
  endDemo: () => {},
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

const DEFAULT_SECONDS = 15 * 60; // 15 minutes

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); // <-- logged-in user (enrolled)
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    const saved = sessionStorage.getItem('demoMode');
    return saved === 'true';
  });
  const [demoTimeLeft, setDemoTimeLeft] = useState<number>(() => {
    const saved = sessionStorage.getItem('demoTimeLeft');
    return saved ? Math.max(0, parseInt(saved, 10)) : DEFAULT_SECONDS;
  });
  const timerRef = useRef<number | null>(null);

  const startDemo = (seconds = DEFAULT_SECONDS) => {
    setDemoMode(true);
    setDemoTimeLeft(seconds);
  };

  const endDemo = () => {
    setDemoMode(false);
    setDemoTimeLeft(DEFAULT_SECONDS);
  };

  // Persist to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('demoMode', String(demoMode));
    sessionStorage.setItem('demoTimeLeft', String(demoTimeLeft));
  }, [demoMode, demoTimeLeft]);

  // 🚦 Auto-start from ?demo=1 ONLY if no user is logged in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantsDemo = params.get('demo') === '1';
    if (wantsDemo && !user && !demoMode) {
      startDemo(DEFAULT_SECONDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // re-check when auth changes

  // 🛑 If a user logs in at any time, immediately end demo
  useEffect(() => {
    if (user && demoMode) endDemo();
  }, [user, demoMode]);

  // ⏱️ Countdown
  useEffect(() => {
    if (!demoMode) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    if (demoTimeLeft <= 0) {
      endDemo();
      return;
    }
    timerRef.current = window.setInterval(() => {
      setDemoTimeLeft((t) => t - 1);
    }, 1000) as unknown as number;

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [demoMode, demoTimeLeft]);

  const value = useMemo(
    () => ({ demoMode, demoTimeLeft, startDemo, endDemo }),
    [demoMode, demoTimeLeft]
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}
