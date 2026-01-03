import { useRef, useCallback } from 'react';
import HCaptcha, { HCaptchaRef } from '@hcaptcha/react-hcaptcha';

export function useHcaptcha(siteKey: string) {
  const captchaRef = useRef<HCaptchaRef | null>(null);

  const execute = useCallback(async (): Promise<string> => {
    const maybePromise = captchaRef.current?.execute({ async: true });
    const token = await maybePromise;
    if (!token) throw new Error('Failed to generate hCaptcha token');
    return token;
  }, []);

  return { HCaptcha, captchaRef, execute, siteKey };
}
