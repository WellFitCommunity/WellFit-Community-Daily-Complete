// src/types/hcaptcha-react-hcaptcha.d.ts
declare module '@hcaptcha/react-hcaptcha' {
  import * as React from 'react';

  // Keep the surface tiny to avoid clashes with the library’s own types
  type HCaptchaProps = {
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
  };

  type HCaptchaHandle = {
    execute: () => void;
    resetCaptcha: () => void;
  };

  const HCaptcha: React.ForwardRefExoticComponent<
    HCaptchaProps & React.RefAttributes<HCaptchaHandle | undefined>
  >;

  export default HCaptcha;
}
