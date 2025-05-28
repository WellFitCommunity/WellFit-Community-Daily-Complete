// src/lib/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Debug logs (optional)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Supabase Init: URL =', supabaseUrl);
  console.log('🔧 Supabase Init: ANON KEY =', supabaseAnonKey ? '✅ Loaded' : '❌ Missing');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Missing Supabase credentials. Check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);


