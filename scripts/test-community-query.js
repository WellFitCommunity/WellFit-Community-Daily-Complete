// Test the exact query used by CommunityMoments component
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log('Testing community_moments query...\n');

  try {
    const { data, error, count } = await supabase
      .from('community_moments')
      .select(
        'id, user_id, file_url, file_path, title, description, emoji, tags, is_gallery_high, created_at, profile:profiles(first_name, last_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(0, 11);

    if (error) {
      console.error('❌ Query failed:', error);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return;
    }

    console.log('✅ Query succeeded!');
    console.log('   Total count:', count);
    console.log('   Returned rows:', data?.length || 0);

    if (data && data.length > 0) {
      console.log('\n   Sample row:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('\n   No data found. This is expected if no moments have been shared yet.');
    }
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testQuery();