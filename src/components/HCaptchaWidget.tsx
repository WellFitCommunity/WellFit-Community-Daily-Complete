// src/components/HCaptchaWidget.tsx
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

// Support CRA + Vite envs
const SITE_KEY =
  process.env.REACT_APP_HCAPTCHA_SITE_KEY ||
  (import.meta as any)?.env?.VITE_HCAPTCHA_SITE_KEY ||
  '';

export interface HCaptchaRef {
  execute: () => Promise<string>;
  reset: () => void;
}

type Size = 'normal' | 'compact' | 'invisible';
type Theme = 'light' | 'dark';

type Props = {
  onVerify?: (token: string) => void;
  onError?: (msg: string) => void;
  onExpire?: () => void;
  size?: Size;   // default now 'invisible'
  theme?: Theme; // default 'light'
};

const HCaptchaWidget = forwardRef<HCaptchaRef, Props>(
  ({ onVerify, onError, onExpire, size = 'invisible', theme = 'light' }, ref) => {
    // Use `any` to avoid brittle lib type changes + null-init complaints
    const widgetRef = useRef<any>(null);
    const [token, setToken] = useState('');

    const resolveRef = useRef<null | ((t: string) => void)>(null);
    const rejectRef = useRef<null | ((e: Error) => void)>(null);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    function clearPending() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      resolveRef.current = null;
      rejectRef.current = null;
    }

    useImperativeHandle(ref, () => ({
      execute: () =>
        new Promise<string>((resolve, reject) => {
          if (!SITE_KEY) {
            const err = new Error('hCaptcha site key not configured');
            onError?.(err.message);
            return reject(err);
          }
          // If we already have a valid token, reuse it
          if (token) return resolve(token);

          resolveRef.current = resolve;
          rejectRef.current = reject;

          // In invisible mode, explicitly trigger a run
          if (size === 'invisible') {
            try {
              widgetRef.current?.execute?.();
            } catch {
              clearPending();
              const err = new Error('Failed to execute hCaptcha');
              onError?.(err.message);
              return reject(err);
            }
          }

          // Safety timeout in case onVerify never fires
          timeoutRef.current = window.setTimeout(() => {
            const err = new Error('hCaptcha timeout');
            rejectRef.current?.(err);
            clearPending();
          }, 30000);
        }),
      reset: () => {
        setToken('');
        clearPending();
        widgetRef.current?.resetCaptcha?.();
      },
    }));

    const handleVerify = (t: string) => {
      setToken(t);
      onVerify?.(t);
      if (resolveRef.current) {
        resolveRef.current(t);
        clearPending();
      }
    };

    const handleError = () => {
      setToken('');
      onError?.('hCaptcha verification failed');
      if (rejectRef.current) {
        rejectRef.current(new Error('hCaptcha verification failed'));
        clearPending();
      }
    };

    const handleExpire = () => {
      setToken('');
      onExpire?.();
      if (rejectRef.current) {
        rejectRef.current(new Error('hCaptcha expired'));
        clearPending();
      }
    };

    if (!SITE_KEY) {
      return (
        <div className="text-red-600 text-sm">
          hCaptcha not configured (set REACT_APP_HCAPTCHA_SITE_KEY or VITE_HCAPTCHA_SITE_KEY)
        </div>
      );
    }

    // Off-screen wrapper ensures no layout jump and keeps it effectively invisible.
    // Use 'inert' instead of aria-hidden to prevent focus issues (accessibility fix)
    // The 'inert' attribute prevents focus on invisible captcha widgets
    return (
      <div
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
        {...(size === 'invisible' ? { inert: '' as any } : {})}
        aria-label="CAPTCHA verification widget"
      >
        <HCaptcha
          ref={widgetRef}
          sitekey={SITE_KEY}
          size={size}
          theme={theme}
          reCaptchaCompat={false}
          onVerify={handleVerify}
          onError={handleError}
          onExpire={handleExpire}
        />
      </div>
    );
  }
);

HCaptchaWidget.displayName = 'HCaptchaWidget';
export default HCaptchaWidget;
