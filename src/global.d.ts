// src/global.d.ts
export {};

declare global {
  interface Window {
    /** injected by hCaptcha script */
    hcaptcha?: {
      render: (...args: any[]) => any;
      reset: (widgetId?: any) => void;
      onLoad?: () => void;
    };
    /** alias used in some implementations */
    hcaptchaOnLoad?: () => void;
  }
}
