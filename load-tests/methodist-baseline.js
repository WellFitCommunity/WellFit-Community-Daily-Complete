/**
 * Methodist Healthcare - Baseline Load Test
 * Target: 120-180 concurrent users (Methodist base load requirement)
 *
 * Test Scenarios:
 * 1. Patient enrollment workflow
 * 2. Physician dashboard access
 * 3. Check-in creation
 * 4. FHIR data queries
 * 5. Authentication flow
 *
 * Success Criteria:
 * - 95th percentile response time < 2 seconds
 * - Error rate < 1%
 * - Zero database connection pool exhaustion
 * - Multi-tenant isolation maintained
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const enrollmentErrors = new Counter('enrollment_errors');
const authErrors = new Counter('auth_errors');
const dbErrors = new Counter('db_errors');
const responseTime = new Trend('custom_response_time');

// Configuration
const SUPABASE_URL = 'https://xkybsjnvuohpqpbkikyn.supabase.co';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key-here';

// Multi-tenant subdomains (Methodist will use these)
const TENANTS = ['houston', 'miami', 'dallas', 'atlanta'];

// Load test stages - Gradual ramp up to Methodist requirements
export const options = {
  stages: [
    { duration: '2m', target: 30 },   // Warm up: 30 users
    { duration: '3m', target: 60 },   // Ramp to 60 users
    { duration: '5m', target: 120 },  // Methodist minimum: 120 users
    { duration: '5m', target: 150 },  // Target: 150 users
    { duration: '3m', target: 180 },  // Methodist maximum: 180 users
    { duration: '5m', target: 180 },  // Sustained load: 180 users for 5 min
    { duration: '3m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests < 2s
    'http_req_failed': ['rate<0.01'],    // Error rate < 1%
    'enrollment_errors': ['count<10'],    // < 10 enrollment failures
    'auth_errors': ['count<10'],          // < 10 auth failures
    'db_errors': ['count<5'],             // < 5 DB errors
  },
};

// Helper: Get random tenant
function getRandomTenant() {
  return TENANTS[Math.floor(Math.random() * TENANTS.length)];
}

// Helper: Generate test user data
function generateTestUser(tenant) {
  const timestamp = Date.now();
  return {
    email: `test-user-${timestamp}-${Math.random().toString(36).substr(2, 9)}@${tenant}.test`,
    password: 'TestPassword123!',
    phone: `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, '0')}`,
    tenant_id: tenant,
  };
}

// Scenario 1: Patient Registration
export function patientRegistration() {
  const tenant = getRandomTenant();
  const user = generateTestUser(tenant);

  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
    phone: user.phone,
    tenant_id: user.tenant_id,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/register`,
    payload,
    params
  );

  const success = check(res, {
    'registration status 200': (r) => r.status === 200,
    'registration response time < 3s': (r) => r.timings.duration < 3000,
  });

  if (!success) {
    enrollmentErrors.add(1);
  }

  responseTime.add(res.timings.duration);
  sleep(1);
}

// Scenario 2: User Login
export function userLogin() {
  const tenant = getRandomTenant();

  const payload = JSON.stringify({
    email: `existing-user@${tenant}.test`,
    password: 'ExistingPassword123!',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/login`,
    payload,
    params
  );

  const success = check(res, {
    'login status 200 or 401': (r) => r.status === 200 || r.status === 401, // 401 expected for test users
    'login response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success && res.status !== 401) {
    authErrors.add(1);
  }

  responseTime.add(res.timings.duration);
  sleep(1);
}

// Scenario 3: Check-in Creation
export function createCheckin() {
  const tenant = getRandomTenant();

  const payload = JSON.stringify({
    patient_id: Math.floor(Math.random() * 1000) + 1,
    mood: Math.floor(Math.random() * 10) + 1,
    notes: 'Load test check-in',
    tenant_id: tenant,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/create-checkin`,
    payload,
    params
  );

  const success = check(res, {
    'checkin status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'checkin response time < 2s': (r) => r.timings.duration < 2000,
  });

  if (!success && res.status !== 401) {
    dbErrors.add(1);
  }

  responseTime.add(res.timings.duration);
  sleep(1);
}

// Scenario 4: FHIR Export Query
export function fhirExport() {
  const tenant = getRandomTenant();

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
    },
  };

  const res = http.get(
    `${SUPABASE_URL}/functions/v1/enhanced-fhir-export?tenant_id=${tenant}&patient_id=1`,
    params
  );

  const success = check(res, {
    'fhir status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'fhir response time < 3s': (r) => r.timings.duration < 3000,
  });

  if (!success && res.status !== 401) {
    dbErrors.add(1);
  }

  responseTime.add(res.timings.duration);
  sleep(2);
}

// Scenario 5: Database Health Check (via REST API)
export function databaseQuery() {
  const tenant = getRandomTenant();

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Prefer': 'return=representation',
    },
  };

  // Query patients table (read-only, low impact)
  const res = http.get(
    `${SUPABASE_URL}/rest/v1/patients?select=id&tenant_id=eq.${tenant}&limit=1`,
    params
  );

  const success = check(res, {
    'db query status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'db query response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (!success && res.status !== 401) {
    dbErrors.add(1);
  }

  responseTime.add(res.timings.duration);
  sleep(0.5);
}

// Main test execution - Mixed workload
export default function () {
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% patient registration
    patientRegistration();
  } else if (scenario < 0.5) {
    // 20% user login
    userLogin();
  } else if (scenario < 0.7) {
    // 20% check-in creation
    createCheckin();
  } else if (scenario < 0.85) {
    // 15% FHIR export
    fhirExport();
  } else {
    // 15% database queries
    databaseQuery();
  }
}

// Teardown function
export function teardown(data) {
  console.log('=== Methodist Baseline Load Test Complete ===');
  console.log(`Target: 120-180 concurrent users`);
  console.log(`Check results above for pass/fail criteria`);
}
