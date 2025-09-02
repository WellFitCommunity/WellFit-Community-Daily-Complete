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
  }
  export default class HCaptcha extends React.Component<HCaptchaProps> {}
}
