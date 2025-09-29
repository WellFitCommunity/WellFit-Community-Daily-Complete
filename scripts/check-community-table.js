// Quick script to check if community_moments table exists
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
  try {
    // Try to query the table
    const { data, error, count } = await supabase
      .from('community_moments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Table does not exist or is not accessible:', error.message);
      console.error('Error code:', error.code);
      return false;
    }

    console.log('✅ community_moments table exists!');
    console.log('   Total rows:', count);
    return true;
  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

async function checkAffirmations() {
  try {
    const { data, error, count } = await supabase
      .from('affirmations')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ affirmations table does not exist or is not accessible:', error.message);
      return false;
    }

    console.log('✅ affirmations table exists!');
    console.log('   Total rows:', count);
    return true;
  } catch (err) {
    console.error('❌ Unexpected error checking affirmations:', err.message);
    return false;
  }
}

async function main() {
  console.log('Checking community tables...\n');

  const momentsOk = await checkTable();
  const affirmationsOk = await checkAffirmations();

  if (momentsOk && affirmationsOk) {
    console.log('\n✅ All community tables are ready!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tables are missing. Migration may need to be applied.');
    process.exit(1);
  }
}

main();