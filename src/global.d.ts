// src/global.d.ts
export {};

declare global {
  interface Window {
    /** injected by hCaptcha script */
    hcaptcha?: {
      render: (...args: unknown[]) => string;
      reset: (widgetId?: string) => void;
      onLoad?: () => void;
    };
    /** alias used in some implementations */
    hcaptchaOnLoad?: () => void;
  }
}
