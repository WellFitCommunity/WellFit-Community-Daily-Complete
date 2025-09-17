// src/components/HCaptchaWidget.tsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const SITE_KEY =
  process.env.REACT_APP_HCAPTCHA_SITE_KEY ||
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
  size?: Size;
  theme?: Theme;
};

const HCaptchaWidget = forwardRef<HCaptchaRef, Props>(
  ({ onVerify, onError, onExpire, size = 'normal', theme = 'light' }, ref) => {
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
          if (token) return resolve(token);

          resolveRef.current = resolve;
          rejectRef.current = reject;

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
          hCaptcha not configured (missing REACT_APP_HCAPTCHA_SITE_KEY / NEXT_PUBLIC_HCAPTCHA_SITE_KEY)
        </div>
      );
    }

    return (
      <HCaptcha
        ref={widgetRef}
        sitekey={SITE_KEY}
        size={size}
        theme={theme}
        onVerify={handleVerify}
        onError={handleError}
        onExpire={handleExpire}
      />
    );
  }
);

HCaptchaWidget.displayName = 'HCaptchaWidget';
export default HCaptchaWidget;
