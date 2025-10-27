// Quick test to see what Supabase client receives
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xkybsjnvuohpqpbkikyn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhreWJzam52dW9ocHFwYmtpa3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5NjA5ODMsImV4cCI6MjA2MTUzNjk4M30.Y5quJr7mTi1ilYf0Mjgcfk2jgbFFI8RyP7h4eWBKQ2E'
);

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
