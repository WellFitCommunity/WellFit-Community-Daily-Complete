declare module '@hcaptcha/react-hcaptcha' {
  import * as React from 'react';

  export interface HCaptchaRef {
    execute: (opts?: { async?: boolean }) => Promise<string> | void;
    reset?: () => void;
    resetCaptcha?: () => void;
    getRespKey?: () => string | null;
    getResponse?: () => string | null;
    setData?: (data: Record<string, string>) => void;
  }

  export interface HCaptchaProps {
    sitekey: string;
    size?: 'normal' | 'compact' | 'invisible';
    theme?: 'light' | 'dark';
    tabindex?: number;
    id?: string;
    reCaptchaCompat?: boolean;
    languageOverride?: string;
    onVerify?: (token: string, ekey?: string) => void;
    onExpire?: () => void;
    onError?: (err: unknown) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onChalExpired?: () => void;
  }

  const HCaptcha: React.ForwardRefExoticComponent<
    HCaptchaProps & React.RefAttributes<HCaptchaRef>
  >;
  export default HCaptcha;
}
