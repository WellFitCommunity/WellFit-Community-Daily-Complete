/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    // Supabase
    REACT_APP_SUPABASE_URL: string;
    REACT_APP_SUPABASE_ANON_KEY: string;   // frontend
    SUPABASE_SERVICE_ROLE_KEY?: string;    // server only
    SUPABASE_JWT_SECRET?: string;          // server only

    // Firebase
    REACT_APP_FIREBASE_VAPID_KEY: string;
    REACT_APP_FIREBASE_API?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_APP_ID?: string;
    FIREBASE_MESSAGING_SENDER_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_MEASUREMENT_ID?: string;
    FIREBASE_AUTH_DOMAIN?: string;

    // hCaptcha
    REACT_APP_HCAPTCHA_SITE_KEY: string;
    HCAPTCHA_SECRET_KEY?: string;

    // Weather API
    REACT_APP_WEATHER_API_KEY: string;

    // MailerSend
    MAILERSEND_API_KEY?: string;
    MAILERSEND_SMTP_USERNAME?: string;
    MAILERSEND_SMTP_PASSWORD?: string;
    MAILERSEND_DOMAIN?: string;

    // Twilio
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_PHONE_NUMBER?: string;
    TWILIO_MESSAGING_SERVICE_SID?: string;

    // Demo toggle
    REACT_APP_DEMO_ENABLED?: string; // "true" | "false"
  }
}

// Google Analytics / gtag
interface Window {
  gtag?: (
    command: 'event' | 'config' | 'set',
    targetId: string,
    config?: Record<string, unknown>
  ) => void;
}
