// src/components/ExplicitCaptcha.tsx
import { useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.REACT_APP_HCAPTCHA_SITE_KEY as string;

type Props = {
  onVerify: (token: string) => void;
  onError:  (msg: string)   => void;
};

export default function ExplicitCaptcha({ onVerify, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // render function (called immediately if hcaptcha is ready, or by onload hook)
    const renderCaptcha = () => {
      const hc = (window as any).hcaptcha;         // <-- no global typing, no TS conflict
      if (!hc) {
        onError('hCaptcha failed to load.');
        return;
      }
      const id = hc.render(container, {
        sitekey: SITE_KEY,
        size: 'normal',
        theme: 'light',
        callback: onVerify,
        'error-callback': () => onError('Captcha verification failed.'),
      });
      setWidgetId(id);
    };

    // If script already loaded, render now; otherwise, let the script call us
    if ((window as any).hcaptcha) {
      renderCaptcha();
    } else {
      (window as any).hcaptchaOnLoad = renderCaptcha;
    }

    return () => {
      try {
        if (widgetId !== null) (window as any).hcaptcha?.reset(widgetId);
      } catch {}
      delete (window as any).hcaptchaOnLoad;
    };
  }, [onVerify, onError, widgetId]);

  return <div ref={containerRef} />;
}
