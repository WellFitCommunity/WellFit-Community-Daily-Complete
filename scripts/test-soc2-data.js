// Quick test to see what Supabase client receives
const { createClient } = require('@supabase/supabase-js');

// Configuration - Set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing compliance_status view...\n');

  const { data, error } = await supabase
    .from('compliance_status')
    .select('*');

  if (error) {
    console.error('ERROR:', error);
    return;
  }

  console.log('Data received:', JSON.stringify(data, null, 2));
  console.log('\nCount:', data?.length);

  if (data) {
    const compliant = data.filter(c => c.status === 'COMPLIANT').length;
    const total = data.length;
    const score = total > 0 ? Math.round((compliant / total) * 100) : 0;

    console.log('\nCompliant:', compliant);
    console.log('Total:', total);
    console.log('Score:', score + '%');
    console.log('Grade:', score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'F');
  }
}

test();
