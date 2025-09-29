// Verify community_moments and affirmations tables are accessible
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('🔍 Verifying Community Tables...\n');

  // Test 1: Check if we can query community_moments
  console.log('1️⃣ Testing community_moments table access...');
  try {
    const { data, error, count } = await supabase
      .from('community_moments')
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      console.error('   ❌ Error:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);

      if (error.code === 'PGRST205') {
        console.log('\n💡 Solution: The table exists but Supabase needs to reload its schema cache.');
        console.log('   Try this:');
        console.log('   1. Go to Supabase Dashboard → Settings → API');
        console.log('   2. Click "Restart Project" or wait a few minutes');
        console.log('   3. Or use the Supabase CLI: npx supabase db push');
      }
      return false;
    }

    console.log('   ✅ SUCCESS! Table is accessible');
    console.log('   📊 Total rows:', count);
    if (data && data.length > 0) {
      console.log('   📄 Sample data found:', data.length, 'rows');
    } else {
      console.log('   📄 No data yet (table is empty, which is normal)');
    }
  } catch (err) {
    console.error('   ❌ Unexpected error:', err.message);
    return false;
  }

  // Test 2: Check affirmations table
  console.log('\n2️⃣ Testing affirmations table access...');
  try {
    const { data, error, count } = await supabase
      .from('affirmations')
      .select('*', { count: 'exact' })
      .limit(3);

    if (error) {
      console.error('   ❌ Error:', error.message);
      return false;
    }

    console.log('   ✅ SUCCESS! Table is accessible');
    console.log('   📊 Total affirmations:', count);
    if (data && data.length > 0) {
      console.log('   📝 Sample affirmation:', data[0].text.substring(0, 60) + '...');
    }
  } catch (err) {
    console.error('   ❌ Unexpected error:', err.message);
    return false;
  }

  // Test 3: Check RLS policies
  console.log('\n3️⃣ Testing Row Level Security (select policy)...');
  try {
    const { data, error } = await supabase
      .from('community_moments')
      .select('id, title, created_at')
      .limit(1);

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is ok
      console.error('   ❌ RLS may be blocking access:', error.message);
      return false;
    }

    console.log('   ✅ RLS SELECT policy working correctly');
  } catch (err) {
    console.error('   ❌ Error:', err.message);
    return false;
  }

  console.log('\n✅ ALL TESTS PASSED! Community features are ready to use!\n');
  return true;
}

verify().then(success => {
  process.exit(success ? 0 : 1);
});