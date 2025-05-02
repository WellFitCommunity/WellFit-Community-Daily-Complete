// testSupabase.js
const { createClient } = require('@supabase/supabase-js');

// ← Replace these with your real values
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  const { data, error } = await supabase
    .from('test_messages')
    .select('message')
    .limit(1)
    .single();
  console.log('👀 RAW RESPONSE:', { data, error });
})();
