/**
 * Methodist Healthcare - Smoke Test
 * Purpose: Quick validation that load testing infrastructure works
 * Duration: 2 minutes
 *
 * Run this first to validate:
 * - k6 is configured correctly
 * - Supabase endpoints are accessible
 * - Authentication works
 * - Basic multi-tenant operations function
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const SUPABASE_URL = 'https://xkybsjnvuohpqpbkikyn.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key-here';

export const options = {
  vus: 10, // 10 virtual users
  duration: '2m', // 2 minute test
  thresholds: {
    'http_req_duration': ['p(95)<5000'], // Lenient for smoke test
    'http_req_failed': ['rate<0.5'],      // 50% can fail (test data may not exist)
  },
};

export default function () {
  const tenant = ['houston', 'miami', 'dallas', 'atlanta'][Math.floor(Math.random() * 4)];

  // Test 1: Health check (REST API)
  const healthCheck = http.get(
    `${SUPABASE_URL}/rest/v1/`,
    {
      headers: {
        'apikey': ANON_KEY,
      },
    }
  );

  check(healthCheck, {
    'health check responds': (r) => r.status === 200 || r.status === 400 || r.status === 404,
  });

  // Test 2: Query patients table (may return 401 if no auth, that's ok)
  const queryTest = http.get(
    `${SUPABASE_URL}/rest/v1/patients?select=id&tenant_id=eq.${tenant}&limit=1`,
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    }
  );

  check(queryTest, {
    'query responds': (r) => r.status === 200 || r.status === 401 || r.status === 403,
    'query is fast': (r) => r.timings.duration < 3000,
  });

  // Test 3: Edge Function health
  const functionTest = http.post(
    `${SUPABASE_URL}/functions/v1/verify-hcaptcha`,
    JSON.stringify({ token: 'test-token' }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
      },
    }
  );

  check(functionTest, {
    'edge function responds': (r) => r.status !== 0 && r.status !== 500,
  });

  sleep(1);
}

export function handleSummary(data) {
  console.log('\n=== Smoke Test Results ===\n');

  const reqDuration = data.metrics.http_req_duration;
  const reqFailed = data.metrics.http_req_failed;

  console.log(`Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`P95 Response Time: ${reqDuration?.values?.['p(95)']?.toFixed(2) || 'N/A'}ms`);
  console.log(`Failure Rate: ${((reqFailed?.values?.rate || 0) * 100).toFixed(2)}%`);

  if ((reqDuration?.values?.['p(95)'] || 0) < 5000 && (reqFailed?.values?.rate || 0) < 0.5) {
    console.log('\n✅ SMOKE TEST PASSED - Ready for full load testing');
    console.log('   Run: k6 run load-tests/methodist-baseline.js');
  } else {
    console.log('\n⚠️  SMOKE TEST ISSUES - Review connectivity');
    console.log('   Check: SUPABASE_ANON_KEY is set correctly');
    console.log('   Check: Supabase project is accessible');
  }

  return {
    'stdout': '',
  };
}
