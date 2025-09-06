// src/contexts/DemoModeContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

type DemoContextValue = {
  /** NEW canonical flag */
  isDemo: boolean;

  /** Compatibility aliases (so old code keeps working) */
  demoMode?: boolean;
  demoTimeLeft: number;      // seconds - always defined, defaults to 0
  endTime?: number | null;    // epoch ms

  /** Canonical timing fields */
  startedAt: number | null;   // epoch ms when demo started
  remainingMs: number | null; // ms until auto-disable (null if none)

  /** Controls */
  enableDemo: (opts?: { durationMs?: number }) => void;
  disableDemo: () => void;
  endDemo: () => void;        // Added this missing method
  toggleDemo: (opts?: { durationMs?: number }) => void;
};

const DemoModeContext = createContext<DemoContextValue | undefined>(undefined);

const LS_KEY_ENABLED = 'demoMode.enabled';
const LS_KEY_STARTED = 'demoMode.startedAt';
const LS_KEY_DURATION = 'demoMode.durationMs';

function nowMs(): number {
  return Date.now();
}

function readBoolLS(key: string, fallback = false): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === 'true' ? true : v === 'false' ? false : fallback;
  } catch {
    return fallback;
  }
}

function readNumLS(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota/security errors */
  }
}

export function DemoModeProvider({
  children,
  enabled = false,
  userId = null, // optional; when provided, demo will auto-end on login
}: {
  children: ReactNode;
  enabled?: boolean;
  userId?: string | null;
}) {
  // ---- State (unconditional hooks) ----
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (!enabled) return false;
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (sp.get('demo') === '1') return true;
    } catch { /* SSR */ }
    return typeof window !== 'undefined' ? readBoolLS(LS_KEY_ENABLED, false) : false;
  });

  const [startedAt, setStartedAt] = useState<number | null>(() => {
    if (!enabled) return null;
    return typeof window !== 'undefined' ? readNumLS(LS_KEY_STARTED) : null;
  });

  const [durationMs, setDurationMs] = useState<number | null>(() => {
    if (!enabled) return null;
    return typeof window !== 'undefined' ? readNumLS(LS_KEY_DURATION) : null;
  });

  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Respect feature toggle
  useEffect(() => {
    if (!enabled) {
      setIsDemo(false);
      setStartedAt(null);
      setDurationMs(null);
      setRemainingMs(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [enabled]);

  // Persist flags
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    writeLS(LS_KEY_ENABLED, String(isDemo));
    writeLS(LS_KEY_STARTED, startedAt != null ? String(startedAt) : '');
    writeLS(LS_KEY_DURATION, durationMs != null ? String(durationMs) : '');
  }, [enabled, isDemo, startedAt, durationMs]);

  // Countdown + auto-disable
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (enabled && isDemo && startedAt != null && durationMs != null) {
      const tick = () => {
        const elapsed = nowMs() - startedAt;
        const remain = Math.max(durationMs - elapsed, 0);
        setRemainingMs(remain);
        if (remain === 0) {
          setIsDemo(false);
          setStartedAt(null);
          setDurationMs(null);
        }
      };
      tick(); // compute once immediately
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      setRemainingMs(null);
    }
  }, [enabled, isDemo, startedAt, durationMs]);

  // Auto-end when real user logs in
  useEffect(() => {
    if (!enabled) return;
    if (userId && isDemo) {
      setIsDemo(false);
      setStartedAt(null);
      setDurationMs(null);
      setRemainingMs(null);
    }
  }, [enabled, userId, isDemo]);

  const value = useMemo<DemoContextValue>(() => {
    const enableDemo = (opts?: { durationMs?: number }) => {
      if (!enabled) return;
      setIsDemo(true);
      const t = nowMs();
      setStartedAt(t);
      setDurationMs(opts?.durationMs && Number.isFinite(opts.durationMs) ? opts.durationMs : null);
    };

    const disableDemo = () => {
      setIsDemo(false);
      setStartedAt(null);
      setDurationMs(null);
      setRemainingMs(null);
    };

    // Add endDemo as an alias for disableDemo
    const endDemo = disableDemo;

    const toggleDemo = (opts?: { durationMs?: number }) => {
      if (!enabled) return;
      if (isDemo) disableDemo(); else enableDemo(opts);
    };

    // Compatibility aliases
    const endTime = startedAt != null && durationMs != null ? startedAt + durationMs : null;
    const demoTimeLeft = remainingMs != null ? Math.ceil(remainingMs / 1000) : 0;

    return {
      isDemo,
      demoMode: isDemo,          // alias for older code
      startedAt,
      remainingMs,
      demoTimeLeft,              // alias (seconds)
      endTime,                   // alias (epoch ms)
      enableDemo,
      disableDemo,
      endDemo,                   // Added this missing method
      toggleDemo,
    };
  }, [enabled, isDemo, startedAt, remainingMs, durationMs]);

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
}