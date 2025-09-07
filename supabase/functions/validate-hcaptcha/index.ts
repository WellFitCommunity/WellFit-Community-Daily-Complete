// src/types/hcaptcha-react-hcaptcha.d.ts
declare module '@hcaptcha/react-hcaptcha' {
  import * as React from 'react';

  export type HCaptchaSize = 'normal' | 'compact' | 'invisible';
  export type HCaptchaTheme = 'light' | 'dark' | 'contrast' | Record<string, any>;

  export interface HCaptchaProps {
    /** Required site key from hCaptcha dashboard */
    sitekey: string;

    /** UI & behavior */
    size?: HCaptchaSize;
    theme?: HCaptchaTheme;
    tabindex?: number;
    id?: string;
    languageOverride?: string;            // ISO 639-2 code; 'auto' by default
    reCaptchaCompat?: boolean;            // default true
    loadAsync?: boolean;                  // default true
    cleanup?: boolean;                    // default true
    scriptLocation?: Element | null;      // defaults to document.head

    /** Enterprise/advanced (optional; safe as strings) */
    apihost?: string;
    assethost?: string;
    endpoint?: string;
    host?: string;
    imghost?: string;
    reportapi?: string;
    sentry?: boolean;
    secureApi?: boolean;
    scriptSource?: string;
    custom?: boolean;

    /** Events */
    onVerify?: (token: string, ekey?: string) => void;
    onExpire?: () => void;
    onError?: (err: any) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onChalExpired?: () => void;
    onLoad?: () => void;                  // fired when API is ready
  }

  /** Methods available via ref */
  export interface HCaptchaHandle {
    /**
     * Programmatically trigger a challenge. You can pass a payload
     * (e.g., { rqdata }) for enterprise features.
     * When run asynchronously it resolves with { token, eKey }.
     */
    execute: (
      payload?: Record<string, any>
    ) => void | Promise<{ token: string; eKey?: string }>;

    /** Get the current response token (if any) */
    getResponse: () => string | null;

    /** Get the challenge reference id (ekey) */
    getRespKey: () => string | null;

    /** Reset the widget/challenge */
    resetCaptcha: () => void;

    /** Optional in some versions */
    setData?: (data: Record<string, any>) => void;
    remove?: () => void;
  }

  const HCaptcha: React.ForwardRefExoticComponent<
    HCaptchaProps & React.RefAttributes<HCaptchaHandle>
  >;

  export default HCaptcha;
}
