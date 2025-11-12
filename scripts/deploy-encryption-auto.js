#!/usr/bin/env node
/**
 * Automated PHI Encryption Deployment Script
 * This script executes the SQL deployment through Supabase RPC
 */

const fs = require('fs');
const https = require('https');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Read the SQL file
const sql = fs.readFileSync('deploy-encryption-complete.sql', 'utf8');

// Split SQL into individual statements
const statements = sql
  .split(/;\s*$/gm)
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log('========================================');
console.log('PHI ENCRYPTION AUTO-DEPLOYMENT');
console.log('========================================\n');
console.log(`Found ${statements.length} SQL statements to execute\n`);

// Try to execute via Supabase REST API
// Note: This may not work for DDL statements with anon key
const url = new URL('/rest/v1/rpc/exec_sql', SUPABASE_URL);

const postData = JSON.stringify({
  sql: sql
});

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Attempting to execute SQL via Supabase API...\n');

const req = https.request(url, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Response status: ${res.statusCode}`);
    console.log(`Response: ${data}\n`);

    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ SUCCESS! PHI encryption deployed\n');
    } else {
      console.log('❌ FAILED - Manual deployment required\n');
      console.log('Please run deploy-phi-encryption.sh or manually execute deploy-encryption-complete.sql');
      console.log('in the Supabase SQL Editor at:');
      console.log('https://supabase.com/dashboard/project/xkybsjnvuohpqpbkikyn/sql/new\n');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\nManual deployment required.');
  console.log('Please run: ./deploy-phi-encryption.sh\n');
});

req.write(postData);
req.end();
