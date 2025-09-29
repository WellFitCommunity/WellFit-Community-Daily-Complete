// Force Supabase PostgREST to reload its schema cache
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

async function reloadCache() {
  console.log('🔄 Attempting to reload PostgREST schema cache...\n');

  // Method 1: Make a request with a Prefer header to reload schema
  console.log('Method 1: Sending schema reload request...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'OPTIONS',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'schema-reload'
      }
    });

    console.log('   Response status:', response.status);
    if (response.ok || response.status === 204) {
      console.log('   ✅ Schema reload requested successfully!');
    } else {
      console.log('   ⚠️  Response:', await response.text());
    }
  } catch (err) {
    console.error('   ❌ Error:', err.message);
  }

  // Method 2: Try a query to community_moments to trigger cache update
  console.log('\nMethod 2: Attempting direct table query...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/community_moments?select=count&limit=0`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'count=exact'
      }
    });

    if (response.ok) {
      const contentRange = response.headers.get('Content-Range');
      console.log('   ✅ SUCCESS! Table is accessible');
      console.log('   📊 Content-Range:', contentRange);
      return true;
    } else {
      const error = await response.json();
      console.log('   ❌ Still not accessible:', error.message);
      console.log('   Code:', error.code);
      return false;
    }
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    return false;
  }
}

async function waitAndRetry() {
  console.log('\n⏳ Waiting 5 seconds for PostgREST to process...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('🔍 Verifying table access...\n');

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error, count } = await supabase
      .from('community_moments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Still getting error:', error.message);
      console.log('\n💡 The schema cache needs time to refresh.');
      console.log('   Options:');
      console.log('   1. Wait 2-5 minutes and try again');
      console.log('   2. Restart your Supabase project from the dashboard');
      console.log('   3. Run: node scripts/verify-community-tables.js');
      return false;
    }

    console.log('✅ SUCCESS! community_moments table is now accessible!');
    console.log('📊 Row count:', count);
    return true;
  } catch (err) {
    console.error('❌ Verification error:', err.message);
    return false;
  }
}

reloadCache()
  .then(() => waitAndRetry())
  .then(success => {
    if (success) {
      console.log('\n🎉 All done! Community Moments should now work!');
      process.exit(0);
    } else {
      console.log('\n⏰ Please wait a few minutes and run: node scripts/verify-community-tables.js');
      process.exit(1);
    }
  });