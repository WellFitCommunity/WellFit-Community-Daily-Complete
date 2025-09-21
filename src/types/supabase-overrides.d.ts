import '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  // Extend the options object for signInWithPassword
  interface SignInWithPasswordOtpCredentials {
    captchaToken?: string;
  }
}
