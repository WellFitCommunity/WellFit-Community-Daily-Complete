// src/components/HCaptchaWidget.tsx
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

// hCaptcha site key from environment
// Note: Using process.env for Create React App compatibility
const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';

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
    // HCaptcha component ref - uses ElementRef to get the instance type
    const widgetRef = useRef<React.ElementRef<typeof HCaptcha> | null>(null);
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

    // If hCaptcha is not configured, render nothing - don't expose config details to users
    if (!SITE_KEY) {
      return null;
    }

    // Off-screen wrapper ensures no layout jump and keeps it effectively invisible.
    // When invisible, we position it off-screen but allow focus for accessibility
    // When visible, we show it normally
    const containerStyle = size === 'invisible'
      ? {
          position: 'absolute' as const,
          left: '-9999px',
          top: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0
        }
      : {};

    return (
      <div
        style={containerStyle}
        aria-label="CAPTCHA verification widget"
        role={size === 'invisible' ? 'presentation' : undefined}
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
