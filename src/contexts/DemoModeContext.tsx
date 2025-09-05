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
  isDemo: boolean;
  startedAt: number | null;        // epoch ms when demo started
  remainingMs: number | null;      // time until auto-disable, if a timeout was set
  enableDemo: (opts?: { durationMs?: number }) => void;
  disableDemo: () => void;
  toggleDemo: (opts?: { durationMs?: number }) => void;
};

const DemoModeContext = createContext<DemoContextValue | undefined>(undefined);

const LS_KEY_ENABLED = 'demoMode.enabled';
const LS_KEY_STARTED = 'demoMode.startedAt';
const LS_KEY_DURATION = 'demoMode.durationMs';

function safeNow(): number {
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
    // ignore quota/security errors
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
  // ---- Hooks must be unconditional & top-level ----
  const [isDemo, setIsDemo] = useState<boolean>(() => {
    if (!enabled) return false;
    // Try querystring first (demo=1), otherwise localStorage
    try {
      const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      if (sp.get('demo') === '1') return true;
    } catch {
      /* no window in SSR */
    }
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

  const tickRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // If demo gets disabled by env/prop, immediately clear state and timers
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

  // Persist to localStorage whenever flags change (only if enabled)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    writeLS(LS_KEY_ENABLED, String(isDemo));
    if (startedAt != null) writeLS(LS_KEY_STARTED, String(startedAt));
    else writeLS(LS_KEY_STARTED, '');
    if (durationMs != null) writeLS(LS_KEY_DURATION, String(durationMs));
    else writeLS(LS_KEY_DURATION, '');
  }, [enabled, isDemo, startedAt, durationMs]);

  // Drive remaining time + auto-disable if duration was set (only if enabled)
  useEffect(() => {
    // clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enabled && isDemo && startedAt != null && durationMs != null) {
      const update = () => {
        const now = safeNow();
        const el = now - startedAt;
        const remain = Math.max(durationMs - el, 0);
        setRemainingMs(remain);
        if (remain === 0) {
          // auto-disable once
          setIsDemo(false);
          setStartedAt(null);
          setDurationMs(null);
        }
      };
      update(); // compute immediately
      intervalRef.current = setInterval(update, 1000);
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

  // Auto-end demo when a real user logs in (only if enabled)
  useEffect(() => {
    if (!enabled) return;
    if (userId && isDemo) {
      setIsDemo(false);
      setStartedAt(null);
      setDurationMs(null);
      setRemainingMs(null);
    }
  }, [enabled, userId, isDemo]);

  // Memoized API (unconditional hook)
  const value = useMemo<DemoContextValue>(() => {
    const enableDemo = (opts?: { durationMs?: number }) => {
      if (!enabled) return; // no-op if feature disabled
      setIsDemo(true);
      const now = safeNow();
      setStartedAt(now);
      if (opts?.durationMs && Number.isFinite(opts.durationMs)) {
        setDurationMs(opts.durationMs);
      } else {
        setDurationMs(null);
      }
      tickRef.current = now;
    };

    const disableDemo = () => {
      setIsDemo(false);
      setStartedAt(null);
      setDurationMs(null);
      setRemainingMs(null);
    };

    const toggleDemo = (opts?: { durationMs?: number }) => {
      if (!enabled) return; // no-op if feature disabled
      if (isDemo) disableDemo();
      else enableDemo(opts);
    };

    return {
      isDemo,
      startedAt,
      remainingMs,
      enableDemo,
      disableDemo,
      toggleDemo,
    };
  }, [enabled, isDemo, startedAt, remainingMs]);

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
}
