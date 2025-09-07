declare module '@hcaptcha/react-hcaptcha' {
  import * as React from 'react';
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
    HCaptchaProps & React.RefAttributes<any>
  >;
  export default HCaptcha;
}
