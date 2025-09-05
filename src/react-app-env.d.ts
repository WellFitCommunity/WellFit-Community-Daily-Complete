/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_INACTIVITY_TIMEOUT_MS?: string; // e.g. "172800000" (2 days)
    REACT_APP_TIMEOUT_WARNING_MS?: string;    // e.g. "300000" (5 min)

    REACT_APP_SUPABASE_URL: string;
    REACT_APP_FIREBASE_VAPID_KEY: string;
    REACT_APP_WEATHER_API_KEY: string;
    REACT_APP_HCAPTCHA_SITE_KEY: string;
    REACT_APP_DEMO_ENABLED?: string;
    
    // --- Firebase (CRA-safe) ---
    REACT_APP_FIREBASE_API_KEY: string;
    REACT_APP_FIREBASE_AUTH_DOMAIN: string;
    REACT_APP_FIREBASE_PROJECT_ID: string;
    REACT_APP_FIREBASE_STORAGE_BUCKET: string;
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: string;
    REACT_APP_FIREBASE_APP_ID: string;
    REACT_APP_FIREBASE_MEASUREMENT_ID?: string; // optional, only if using Analytics
    REACT_APP_FIREBASE_VAPID_KEY: string;       // for web push notifications

    // --- (Optional) Raw Firebase vars, if you reference them server-side ---
    FIREBASE_API_KEY?: string;
    FIREBASE_AUTH_DOMAIN?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_MESSAGING_SENDER_ID?: string;
    FIREBASE_APP_ID?: string;
    FIREBASE_MEASUREMENT_ID?: string;

    SB_PUBLISHABLE_API_KEY?: string;  // frontend anon/publishable key
    SB_SECRET_KEY?: string;           // backend service role key (server only!)

    // Legacy naming (still supported for CRA / fallbacks)
    REACT_APP_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;

    // --- Optional: JWT (backend only) ---
    SUPABASE_JWT_SECRET?: string;

    // --- Other vars you already had ---
    REACT_APP_FIREBASE_VAPID_KEY: string;
    REACT_APP_WEATHER_API_KEY: string;
    REACT_APP_HCAPTCHA_SITE_KEY: string;
    REACT_APP_DEMO_ENABLED?: string;

    // MailerSend
    MAILERSEND_API_KEY?: string;
    MAILERSEND_SMTP_USERNAME?: string;
    MAILERSEND_SMTP_PASSWORD?: string;

    // Twilio
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_MESSAGING_SERVICE_SID?: string;
    TWILIO_PHONE_NUMBER?: string;
  }
}
  

