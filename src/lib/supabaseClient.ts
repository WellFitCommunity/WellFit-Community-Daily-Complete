// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (process.env.NODE_ENV === 'development') {
  console.log('Supabase Client Init: REACT_APP_SUPABASE_URL =', supabaseUrl);
  // Avoid logging the key even in dev if it's sensitive, though anon key is less so.
  // For this review, we'll keep it but acknowledge it's often omitted.
  console.log('Supabase Client Init: REACT_APP_SUPABASE_ANON_KEY (first 10 chars) =', supabaseAnonKey?.substring(0, 10));
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in environment variables. App cannot initialize.');
  throw new Error('❌ Missing Supabase credentials in environment variables.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

