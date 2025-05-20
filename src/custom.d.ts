/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_FIREBASE_VAPID_KEY: string;
    REACT_APP_SUPABASE_URL: string;
    REACT_APP_SUPABASE_ANON_KEY: string;
    REACT_APP_WEATHER_API_KEY: string;
    REACT_APP_ADMIN_SECRET?: string;
  }
}
