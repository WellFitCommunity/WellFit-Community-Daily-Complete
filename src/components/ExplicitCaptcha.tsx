// src/components/ExplicitCaptcha.tsx
import React, { useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY!;

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLDivElement,
        opts: {
          sitekey: string;
          size?: string;
          theme?: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
        }
      ) => number;
      reset: (id: number) => void;
    };
    hcaptchaOnLoad?: () => void;
  }
}

interface Props {
  onVerify: (token: string) => void;
  onError:  (msg: string)   => void;
}

export default function ExplicitCaptcha({ onVerify, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<number | null>(null);

  useEffect(() => {
    const handleLoad = () => {
      if (!window.hcaptcha || !containerRef.current) {
        onError('hCaptcha failed to load.');
        return;
      }
      const id = window.hcaptcha.render(containerRef.current, {
        sitekey:          SITE_KEY,
        size:             'normal',
        theme:            'light',
        callback:         (token: string) => onVerify(token),
        'error-callback': () => onError('Captcha verification failed.')
      });
      setWidgetId(id);
    };

    // This will be called by the hcaptcha script when it’s ready
    window.hcaptchaOnLoad = handleLoad;

    return () => {
      // only reset if and when the widget actually rendered
      if (widgetId !== null) {
        window.hcaptcha?.reset(widgetId);
      }
      delete window.hcaptchaOnLoad;
    };
  }, [onVerify, onError, widgetId]);

  return <div ref={containerRef} />;
}
