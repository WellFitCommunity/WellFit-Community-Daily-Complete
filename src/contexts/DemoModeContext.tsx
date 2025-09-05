import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

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

/**
 * Props:
 * - userId?: string | null    // optional; when provided, demo will auto-end on login
 * - enabled?: boolean         // optional kill switch; default true unless env disables it
 */
export function DemoModeProvider({
  children,
  userId = null,
  enabled,
}: {
  children: React.ReactNode;
  userId?: string | null;
  enabled?: boolean;
}) {
  // Kill-switch via env, but allow explicit override via prop
  const envEnabled =
    String(process.env.REACT_APP_DEMO_ENABLED ?? 'true').toLowerCase() === 'true';
  const isEnabled = typeof enabled === 'boolean' ? enabled : envEnabled;

  // If disabled, no-op provider (prevents import explosions while making it inert)
  if (!isEnabled) {
    const value = useMemo<DemoCtx>(
      () => ({ demoMode: false, demoTimeLeft: 0, startDemo: () => {}, endDemo: () => {} }),
      []
    );
    return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
  }

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

  // 🚦 Auto-start from ?demo=1 ONLY if no user is logged in (based on optional userId)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantsDemo = params.get('demo') === '1';
    if (wantsDemo && !userId && !demoMode) {
      startDemo(DEFAULT_SECONDS);
    }
    // re-run on login/logout transitions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // 🛑 If a user logs in at any time, immediately end demo (only if we received userId)
  useEffect(() => {
    if (userId && demoMode) endDemo();
  }, [userId, demoMode]);

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
