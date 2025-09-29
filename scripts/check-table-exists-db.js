// Check if table exists directly in PostgreSQL (bypassing PostgREST cache)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableExistsInDB() {
  console.log('🔍 Checking if community_moments exists in PostgreSQL database...\n');

  // Use SQL query to check information_schema
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          table_name,
          table_type
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'community_moments';
      `
    });

    if (error) {
      console.log('⚠️  RPC method not available, trying alternative...\n');

      // Alternative: Try to list all tables using pg_catalog
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      const schemas = await response.json();
      console.log('📋 Available tables in PostgREST schema:');
      console.log(Object.keys(schemas.definitions || {}).join(', '));

      if (Object.keys(schemas.definitions || {}).includes('community_moments')) {
        console.log('\n✅ community_moments IS in the schema!');
      } else {
        console.log('\n❌ community_moments is NOT in the PostgREST schema cache yet');
        console.log('\n💡 This confirms the table exists in PostgreSQL but PostgREST needs to reload.');
      }

      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Table EXISTS in PostgreSQL database!');
      console.log('   Table name:', data[0].table_name);
      console.log('   Table type:', data[0].table_type);
    } else {
      console.log('❌ Table does NOT exist in PostgreSQL database');
      console.log('   The migration needs to be applied.');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkTableExistsInDB();