// src/lib/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// These logs are NOT conditional
console.log('Supabase Client Init: REACT_APP_SUPABASE_URL =', process.env.REACT_APP_SUPABASE_URL);
console.log('Supabase Client Init: REACT_APP_SUPABASE_ANON_KEY =', process.env.REACT_APP_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Missing Supabase credentials in environment variables.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

