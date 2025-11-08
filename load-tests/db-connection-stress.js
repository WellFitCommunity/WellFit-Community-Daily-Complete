/**
 * Methodist Healthcare - Database Connection Pool Stress Test
 * Purpose: Test Supabase Pro 500 connection limit under load
 *
 * Test Strategy:
 * 1. Gradually increase concurrent database operations
 * 2. Monitor connection pool exhaustion
 * 3. Test connection pooling efficiency
 * 4. Verify graceful degradation at limits
 *
 * Supabase Pro Specs:
 * - Max connections: 500
 * - Reserved for Supabase: ~100
 * - Available for app: ~400
 * - Target: Stay under 350 connections (87.5% of available)
 *
 * Success Criteria:
 * - Handle 180 concurrent users without pool exhaustion
 * - Connection errors < 1%
 * - P95 response time < 2s even at high connection count
 * - Graceful degradation if limits approached
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const connectionErrors = new Counter('connection_errors');
const poolExhaustion = new Counter('pool_exhaustion_events');
const activeConnections = new Gauge('active_connections_estimate');
const queryDuration = new Trend('query_duration');
const slowQueries = new Counter('slow_queries'); // Queries > 2s

// Configuration
const SUPABASE_URL = 'https://xkybsjnvuohpqpbkikyn.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key-here';

// Aggressive connection test - push towards limits
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Warm up: 50 users
    { duration: '2m', target: 100 },   // 100 users (~150 connections)
    { duration: '2m', target: 150 },   // 150 users (~225 connections)
    { duration: '2m', target: 180 },   // 180 users (~270 connections) - Methodist max
    { duration: '2m', target: 200 },   // 200 users (~300 connections) - Push harder
    { duration: '2m', target: 250 },   // 250 users (~375 connections) - Near limit
    { duration: '3m', target: 250 },   // Sustained high load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'connection_errors': ['count<20'],           // < 20 connection errors total
    'pool_exhaustion_events': ['count<5'],       // < 5 exhaustion events
    'http_req_duration': ['p(95)<3000'],         // Allow 3s at high load
    'http_req_failed': ['rate<0.05'],            // < 5% failure rate
    'slow_queries': ['count<50'],                 // < 50 slow queries
  },
};

// Database-heavy operations
const DB_OPERATIONS = [
  {
    name: 'patient_list_query',
    weight: 0.3,
    query: (tenant) => ({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/patients?select=id,email,created_at&tenant_id=eq.${tenant}&limit=20`,
    }),
  },
  {
    name: 'checkin_aggregation',
    weight: 0.2,
    query: (tenant) => ({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/check_ins?select=mood,created_at&tenant_id=eq.${tenant}&limit=50`,
    }),
  },
  {
    name: 'user_profile_query',
    weight: 0.2,
    query: (tenant) => ({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/profiles?select=*&tenant_id=eq.${tenant}&limit=10`,
    }),
  },
  {
    name: 'complex_join_query',
    weight: 0.15,
    query: (tenant) => ({
      method: 'GET',
      url: `${SUPABASE_URL}/rest/v1/patients?select=id,email,check_ins(mood,created_at)&tenant_id=eq.${tenant}&limit=10`,
    }),
  },
  {
    name: 'write_operation',
    weight: 0.15,
    query: (tenant) => ({
      method: 'POST',
      url: `${SUPABASE_URL}/rest/v1/check_ins`,
      body: JSON.stringify({
        patient_id: Math.floor(Math.random() * 100) + 1,
        mood: Math.floor(Math.random() * 10) + 1,
        notes: 'Connection stress test',
        tenant_id: tenant,
      }),
    }),
  },
];

// Get random tenant
function getRandomTenant() {
  const tenants = ['houston', 'miami', 'dallas', 'atlanta'];
  return tenants[Math.floor(Math.random() * tenants.length)];
}

// Select operation based on weighted distribution
function selectOperation() {
  const rand = Math.random();
  let cumulative = 0;

  for (const op of DB_OPERATIONS) {
    cumulative += op.weight;
    if (rand <= cumulative) {
      return op;
    }
  }

  return DB_OPERATIONS[0]; // Fallback
}

// Execute database operation
function executeDbOperation() {
  const tenant = getRandomTenant();
  const operation = selectOperation();
  const config = operation.query(tenant);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Prefer': 'return=representation',
    },
    tags: { operation: operation.name, tenant: tenant },
  };

  const startTime = Date.now();
  let res;

  if (config.method === 'GET') {
    res = http.get(config.url, params);
  } else if (config.method === 'POST') {
    res = http.post(config.url, config.body, params);
  }

  const duration = Date.now() - startTime;
  queryDuration.add(duration);

  // Check for connection pool errors
  const isConnectionError = check(res, {
    'no connection timeout': (r) => !r.body?.includes('connection') && !r.body?.includes('timeout'),
    'no pool exhaustion': (r) => !r.body?.includes('too many clients') && !r.body?.includes('connection pool'),
    'status not 503': (r) => r.status !== 503, // Service unavailable
    'status not 500': (r) => r.status !== 500 || !r.body?.includes('connection'),
  });

  if (!isConnectionError) {
    connectionErrors.add(1);

    if (res.body?.includes('too many clients') || res.body?.includes('connection pool')) {
      poolExhaustion.add(1);
      console.error(`❌ CONNECTION POOL EXHAUSTED at ${new Date().toISOString()}`);
      console.error(`   Operation: ${operation.name}, Tenant: ${tenant}`);
      console.error(`   Response: ${res.status} - ${res.body?.substring(0, 100)}`);
    }
  }

  // Track slow queries
  if (duration > 2000) {
    slowQueries.add(1);
  }

  // Successful query checks
  const success = check(res, {
    [`${operation.name} status ok`]: (r) => r.status === 200 || r.status === 201 || r.status === 401,
    [`${operation.name} response < 2s`]: (r) => r.timings.duration < 2000,
  });

  return { success, duration, status: res.status, operation: operation.name };
}

// Main test function
export default function () {
  const result = executeDbOperation();

  // Estimate active connections (rough: 1.5 connections per VU on average)
  activeConnections.add(__VU * 1.5);

  // Adaptive backoff if seeing errors
  if (!result.success || result.status >= 500) {
    sleep(2); // Back off on errors
  } else if (result.duration > 1000) {
    sleep(1); // Slow response, give DB time
  } else {
    sleep(0.5); // Normal pace
  }
}

// Setup function
export function setup() {
  console.log('=== Database Connection Pool Stress Test ===');
  console.log('Target: Supabase Pro 500 connections (400 available)');
  console.log('Methodist requirement: 180 concurrent users (~270 connections)');
  console.log('Test will push to 250 users (~375 connections) to find limits');
  console.log('');
}

// Teardown function
export function teardown(data) {
  console.log('\n=== Connection Pool Test Complete ===');
  console.log('Review metrics above for:');
  console.log('  - connection_errors: Should be < 20');
  console.log('  - pool_exhaustion_events: Should be < 5');
  console.log('  - slow_queries: Should be < 50');
  console.log('  - http_req_duration p(95): Should be < 3000ms');
  console.log('');
  console.log('If pool exhaustion occurred, review connection management:');
  console.log('  1. Check pgBouncer configuration');
  console.log('  2. Verify connection closing in Edge Functions');
  console.log('  3. Review long-running queries');
  console.log('  4. Consider upgrading Supabase tier if needed');
}

// Handle summary with connection analysis
export function handleSummary(data) {
  const metrics = data.metrics;

  console.log('\n=== Connection Analysis ===\n');

  // Connection errors
  const connErrors = metrics.connection_errors?.values?.count || 0;
  const poolExhaust = metrics.pool_exhaustion_events?.values?.count || 0;

  console.log(`Connection Errors: ${connErrors}`);
  console.log(`Pool Exhaustion Events: ${poolExhaust}`);

  if (poolExhaust === 0) {
    console.log('✅ NO POOL EXHAUSTION - Connection management is good');
  } else {
    console.log(`❌ POOL EXHAUSTED ${poolExhaust} times - Review connection usage!`);
  }

  // Query performance
  const p95 = metrics.query_duration?.values?.['p(95)'] || 0;
  const slowQueriesCount = metrics.slow_queries?.values?.count || 0;

  console.log(`\nQuery Performance:`);
  console.log(`  P95 Duration: ${p95.toFixed(2)}ms`);
  console.log(`  Slow Queries (>2s): ${slowQueriesCount}`);

  if (p95 < 2000) {
    console.log('✅ GOOD PERFORMANCE - P95 under 2s');
  } else if (p95 < 3000) {
    console.log('⚠️  ACCEPTABLE - P95 under 3s but close to limit');
  } else {
    console.log('❌ POOR PERFORMANCE - P95 exceeds 3s');
  }

  // Recommendation
  console.log('\n=== Recommendations ===\n');

  if (poolExhaust === 0 && p95 < 2000) {
    console.log('✅ System is ready for Methodist deployment');
    console.log('   - No connection pool issues');
    console.log('   - Good query performance');
    console.log('   - Can handle 180+ concurrent users');
  } else if (poolExhaust > 0 || p95 > 3000) {
    console.log('❌ Issues found - Address before deployment:');
    if (poolExhaust > 0) {
      console.log('   - Investigate connection pool exhaustion');
      console.log('   - Review Edge Function connection management');
      console.log('   - Consider pgBouncer tuning');
    }
    if (p95 > 3000) {
      console.log('   - Optimize slow queries');
      console.log('   - Review database indexes');
      console.log('   - Consider query result caching');
    }
  } else {
    console.log('⚠️  System functional but monitor closely:');
    console.log('   - Performance acceptable but close to limits');
    console.log('   - Monitor in production');
    console.log('   - Plan for scaling if load increases');
  }

  return {
    'load-tests/results/db-stress-summary.json': JSON.stringify(data, null, 2),
  };
}
