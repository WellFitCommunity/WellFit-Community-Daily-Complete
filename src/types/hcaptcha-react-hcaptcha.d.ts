// src/types/hcaptcha-react-hcaptcha.d.ts
declare module '@hcaptcha/react-hcaptcha' {
  import * as React from 'react';

  export interface HCaptchaProps {
    sitekey: string;
    size?: 'normal' | 'compact' | 'invisible';
    theme?: 'light' | 'dark';
    tabindex?: number;
    id?: string;
    onVerify?: (token: string, ekey?: string) => void;
    onExpire?: () => void;
    onError?: (err: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
    reCaptchaCompat?: boolean;
    languageOverride?: string;
    challengeContainer?: string;
    onChalExpired?: () => void;
  }

  export interface HCaptchaHandle {
    execute: () => void;
    resetCaptcha: () => void;
    remove?: () => void;
  }

  const HCaptcha: React.ForwardRefExoticComponent<
    HCaptchaProps & React.RefAttributes<HCaptchaHandle>
  >;

  export default HCaptcha;
}
