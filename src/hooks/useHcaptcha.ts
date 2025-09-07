import { useRef, useCallback } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

type HCaptchaRefLocal = {
  execute: (opts?: { async?: boolean }) => void | Promise<string>;
  reset?: () => void;
  resetCaptcha?: () => void;
};

export function useHcaptcha(siteKey: string) {
  const captchaRef = useRef<HCaptchaRefLocal | null>(null);

  const execute = useCallback(async (): Promise<string> => {
    const maybePromise = captchaRef.current?.execute({ async: true } as any);
    const token = await (maybePromise as Promise<string> | undefined);
    if (!token) throw new Error('Failed to generate hCaptcha token');
    return token;
  }, []);

  return { HCaptcha, captchaRef, execute, siteKey };
}
