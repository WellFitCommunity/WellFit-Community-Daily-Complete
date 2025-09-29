// Apply the migration SQL via Supabase Management API
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

async function executeMigrationSQL() {
  console.log('📄 Reading migration file...\n');

  const migrationSQL = fs.readFileSync(
    'supabase/migrations/20250923150000_add_missing_community_features.sql',
    'utf8'
  );

  // Remove the migrate:up/down comments and begin/commit
  const cleanSQL = migrationSQL
    .replace(/-- migrate:up/g, '')
    .replace(/-- migrate:down/g, '')
    .replace(/^begin;/gim, '')
    .replace(/^commit;/gim, '');

  console.log('🚀 Executing migration SQL via PostgREST...\n');

  // Execute via SQL query endpoint
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/pg_execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: cleanSQL })
    });

    if (!response.ok) {
      const error = await response.json();
      console.log('❌ pg_execute not available:', error.message);
      console.log('\n📝 Trying alternative: SQL Admin API...\n');

      // Try the SQL Admin API endpoint (requires service role key)
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

      if (!projectRef) {
        throw new Error('Could not extract project ref from URL');
      }

      const sqlResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          query: cleanSQL
        })
      });

      if (!sqlResponse.ok) {
        const sqlError = await sqlResponse.text();
        throw new Error(`SQL Admin API failed: ${sqlError}`);
      }

      const sqlResult = await sqlResponse.json();
      console.log('✅ SQL executed via Admin API!');
      console.log('   Result:', sqlResult);
    } else {
      console.log('✅ SQL executed successfully!');
    }

    // Wait and verify
    console.log('\n⏳ Waiting 3 seconds for PostgREST to refresh...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify table now appears
    const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    });

    const schema = await schemaResponse.json();
    const tables = Object.keys(schema.definitions || {});

    if (tables.includes('community_moments')) {
      console.log('✅ SUCCESS! community_moments is now in the schema!');
      return true;
    } else {
      console.log('⚠️  Table not yet visible in schema. Try:');
      console.log('   node scripts/check-table-exists-db.js');
      return false;
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n💡 Manual workaround:');
    console.log('   1. Copy the migration SQL from:');
    console.log('      supabase/migrations/20250923150000_add_missing_community_features.sql');
    console.log('   2. Go to: https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new');
    console.log('   3. Paste and run the SQL');
    return false;
  }
}

executeMigrationSQL().then(success => {
  process.exit(success ? 0 : 1);
});