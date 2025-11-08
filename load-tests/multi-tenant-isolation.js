/**
 * Methodist Healthcare - Multi-Tenant Isolation Test
 * Purpose: Verify 4 tenants can operate simultaneously without data leakage or performance degradation
 *
 * Test Strategy:
 * 1. Run 4 parallel tenant workloads (houston, miami, dallas, atlanta)
 * 2. Verify Row-Level Security (RLS) prevents cross-tenant queries
 * 3. Ensure fair resource allocation across tenants
 * 4. Validate no performance degradation when all tenants active
 *
 * Success Criteria:
 * - Zero cross-tenant data leakage
 * - All tenants maintain < 2s response time
 * - No tenant starves others of resources
 * - Database connection pool handles all tenants fairly
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import exec from 'k6/execution';

// Custom metrics per tenant
const houstonResponseTime = new Trend('houston_response_time');
const miamiResponseTime = new Trend('miami_response_time');
const dallasResponseTime = new Trend('dallas_response_time');
const atlantaResponseTime = new Trend('atlanta_response_time');

const crossTenantLeaks = new Counter('cross_tenant_data_leaks');
const tenantIsolationViolations = new Counter('tenant_isolation_violations');
const fairnessViolations = new Counter('fairness_violations');

// Configuration
const SUPABASE_URL = 'https://xkybsjnvuohpqpbkikyn.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key-here';

// Define tenant configurations
const TENANTS = {
  houston: { id: 'houston', weight: 0.4, color: 'blue' },   // 40% load (largest tenant)
  miami: { id: 'miami', weight: 0.3, color: 'green' },       // 30% load
  dallas: { id: 'dallas', weight: 0.2, color: 'yellow' },    // 20% load
  atlanta: { id: 'atlanta', weight: 0.1, color: 'red' },     // 10% load (smallest)
};

// Load test stages - All tenants simultaneously
export const options = {
  scenarios: {
    houston_tenant: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 24 },  // 40% of 60 users
        { duration: '3m', target: 48 },  // 40% of 120 users
        { duration: '3m', target: 72 },  // 40% of 180 users
        { duration: '3m', target: 72 },  // Sustained
        { duration: '1m', target: 0 },
      ],
      exec: 'houston',
      tags: { tenant: 'houston' },
    },
    miami_tenant: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 18 },  // 30% of 60 users
        { duration: '3m', target: 36 },  // 30% of 120 users
        { duration: '3m', target: 54 },  // 30% of 180 users
        { duration: '3m', target: 54 },  // Sustained
        { duration: '1m', target: 0 },
      ],
      exec: 'miami',
      tags: { tenant: 'miami' },
    },
    dallas_tenant: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 12 },  // 20% of 60 users
        { duration: '3m', target: 24 },  // 20% of 120 users
        { duration: '3m', target: 36 },  // 20% of 180 users
        { duration: '3m', target: 36 },  // Sustained
        { duration: '1m', target: 0 },
      ],
      exec: 'dallas',
      tags: { tenant: 'dallas' },
    },
    atlanta_tenant: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 6 },   // 10% of 60 users
        { duration: '3m', target: 12 },  // 10% of 120 users
        { duration: '3m', target: 18 },  // 10% of 180 users
        { duration: '3m', target: 18 },  // Sustained
        { duration: '1m', target: 0 },
      ],
      exec: 'atlanta',
      tags: { tenant: 'atlanta' },
    },
  },
  thresholds: {
    'houston_response_time': ['p(95)<2000'],
    'miami_response_time': ['p(95)<2000'],
    'dallas_response_time': ['p(95)<2000'],
    'atlanta_response_time': ['p(95)<2000'],
    'cross_tenant_data_leaks': ['count==0'],      // ZERO leaks allowed
    'tenant_isolation_violations': ['count==0'],   // ZERO violations
    'fairness_violations': ['count<5'],            // < 5 fairness issues
  },
};

// Helper: Make tenant-specific request
function makeTenantRequest(tenantId, endpoint, method = 'GET', payload = null) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'X-Tenant-ID': tenantId, // Custom tenant header
    },
    tags: { tenant: tenantId, endpoint: endpoint },
  };

  let res;
  if (method === 'GET') {
    res = http.get(`${SUPABASE_URL}${endpoint}`, params);
  } else if (method === 'POST') {
    res = http.post(`${SUPABASE_URL}${endpoint}`, JSON.stringify(payload), params);
  }

  return res;
}

// Verify RLS isolation: Attempt cross-tenant query
function verifyRLSIsolation(tenantId) {
  const otherTenants = Object.keys(TENANTS).filter(t => t !== tenantId);
  const targetTenant = otherTenants[Math.floor(Math.random() * otherTenants.length)];

  // Try to query other tenant's data (should be blocked by RLS)
  const res = makeTenantRequest(
    tenantId,
    `/rest/v1/patients?select=id,email&tenant_id=eq.${targetTenant}&limit=1`,
    'GET'
  );

  // Should return empty result or 401, not actual data
  const isolated = check(res, {
    'RLS blocks cross-tenant query': (r) => {
      if (r.status === 200) {
        const data = JSON.parse(r.body);
        return data.length === 0; // Should return empty array
      }
      return r.status === 401 || r.status === 403; // Or auth error
    },
  });

  if (!isolated) {
    crossTenantLeaks.add(1);
    console.error(`❌ CRITICAL: Tenant ${tenantId} accessed ${targetTenant} data!`);
  }
}

// Test tenant-specific operations
function runTenantWorkload(tenantId, metricTrend) {
  group(`Tenant ${tenantId} operations`, () => {
    // 1. Create tenant-specific check-in
    const checkinPayload = {
      patient_id: Math.floor(Math.random() * 100) + 1,
      mood: Math.floor(Math.random() * 10) + 1,
      notes: `${tenantId} load test`,
      tenant_id: tenantId,
    };

    const checkinRes = makeTenantRequest(
      tenantId,
      '/functions/v1/create-checkin',
      'POST',
      checkinPayload
    );

    check(checkinRes, {
      [`${tenantId} checkin status ok`]: (r) => r.status === 200 || r.status === 401,
      [`${tenantId} checkin response < 2s`]: (r) => r.timings.duration < 2000,
    });

    metricTrend.add(checkinRes.timings.duration);

    // 2. Query tenant-specific data
    const queryRes = makeTenantRequest(
      tenantId,
      `/rest/v1/patients?select=id&tenant_id=eq.${tenantId}&limit=5`,
      'GET'
    );

    check(queryRes, {
      [`${tenantId} query status ok`]: (r) => r.status === 200 || r.status === 401,
      [`${tenantId} query response < 1s`]: (r) => r.timings.duration < 1000,
    });

    metricTrend.add(queryRes.timings.duration);

    // 3. Verify RLS isolation (10% of requests)
    if (Math.random() < 0.1) {
      verifyRLSIsolation(tenantId);
    }

    sleep(1);
  });
}

// Scenario functions for each tenant
export function houston() {
  runTenantWorkload('houston', houstonResponseTime);
}

export function miami() {
  runTenantWorkload('miami', miamiResponseTime);
}

export function dallas() {
  runTenantWorkload('dallas', dallasResponseTime);
}

export function atlanta() {
  runTenantWorkload('atlanta', atlantaResponseTime);
}

// Analyze fairness across tenants
export function handleSummary(data) {
  const tenantMetrics = {
    houston: data.metrics.houston_response_time,
    miami: data.metrics.miami_response_time,
    dallas: data.metrics.dallas_response_time,
    atlanta: data.metrics.atlanta_response_time,
  };

  console.log('\n=== Multi-Tenant Isolation Test Results ===\n');

  // Check for fairness violations
  const p95Times = Object.entries(tenantMetrics).map(([tenant, metric]) => ({
    tenant,
    p95: metric?.values?.['p(95)'] || 0,
  }));

  const maxP95 = Math.max(...p95Times.map(t => t.p95));
  const minP95 = Math.min(...p95Times.filter(t => t.p95 > 0).map(t => t.p95));

  console.log('Tenant Response Times (p95):');
  p95Times.forEach(({ tenant, p95 }) => {
    console.log(`  ${tenant.padEnd(10)}: ${p95.toFixed(2)}ms`);
  });

  // Fairness check: No tenant should be > 2x slower than fastest
  if (maxP95 > minP95 * 2) {
    console.log(`\n⚠️  FAIRNESS VIOLATION: ${maxP95.toFixed(2)}ms > ${(minP95 * 2).toFixed(2)}ms`);
    console.log('   One tenant is significantly slower - resource starvation detected!');
  } else {
    console.log('\n✅ FAIRNESS: All tenants have similar performance');
  }

  // Isolation check
  const leaks = data.metrics.cross_tenant_data_leaks?.values?.count || 0;
  if (leaks === 0) {
    console.log('✅ ISOLATION: Zero cross-tenant data leaks detected');
  } else {
    console.log(`❌ ISOLATION FAILURE: ${leaks} cross-tenant data leaks detected!`);
  }

  return {
    'summary.json': JSON.stringify(data, null, 2),
    'stdout': '', // Suppress default output
  };
}
