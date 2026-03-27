/**
 * Edge Function Load Test — k6
 *
 * Tests health endpoints, CORS preflight, and auth flows under concurrent load.
 * Default: 10 virtual users for 1 minute.
 *
 * Usage:
 *   k6 run scripts/load-testing/edge-functions.js \
 *     --env SUPABASE_URL=https://your-project.supabase.co \
 *     --env SUPABASE_ANON_KEY=your-key
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Configuration ────────────────────────────────────────────────────────────

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// Custom metrics
const healthCheckDuration = new Trend('health_check_duration');
const corsCheckDuration = new Trend('cors_preflight_duration');
const authCheckDuration = new Trend('auth_endpoint_duration');
const errorRate = new Rate('custom_error_rate');

// ── Headers ──────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ANON_KEY}`,
  'apikey': ANON_KEY,
};

// ── Scenarios ────────────────────────────────────────────────────────────────

export default function () {
  // 1. Health Monitor endpoint
  const healthRes = http.get(`${FUNCTIONS_URL}/health-monitor`, { headers });
  healthCheckDuration.add(healthRes.timings.duration);
  check(healthRes, {
    'health-monitor: status 200': (r) => r.status === 200,
    'health-monitor: has body': (r) => r.body.length > 0,
  });

  // 2. CORS Preflight (OPTIONS)
  const corsRes = http.options(`${FUNCTIONS_URL}/login`, {
    headers: {
      'Origin': 'https://app.wellfitcommunity.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,authorization',
    },
  });
  corsCheckDuration.add(corsRes.timings.duration);
  check(corsRes, {
    'CORS preflight: status 200 or 204': (r) => r.status === 200 || r.status === 204,
    'CORS: has allow-origin header': (r) =>
      r.headers['Access-Control-Allow-Origin'] !== undefined ||
      r.headers['access-control-allow-origin'] !== undefined,
  });

  // 3. Login endpoint (invalid creds — should return 400/401, not crash)
  const loginRes = http.post(
    `${FUNCTIONS_URL}/login`,
    JSON.stringify({ email: 'loadtest@example.com', password: 'invalid' }),
    { headers }
  );
  authCheckDuration.add(loginRes.timings.duration);
  check(loginRes, {
    'login: returns 4xx (not crash)': (r) => r.status >= 400 && r.status < 500,
    'login: has JSON body': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  // 4. AI function with empty body (should return 400, not WORKER_ERROR)
  const aiRes = http.post(
    `${FUNCTIONS_URL}/ai-readmission-predictor`,
    JSON.stringify({}),
    { headers }
  );
  check(aiRes, {
    'ai-readmission: returns 400 for empty input': (r) => r.status === 400,
    'ai-readmission: not 500': (r) => r.status !== 500,
  });
  errorRate.add(aiRes.status >= 500);

  // 5. System status
  const statusRes = http.get(`${FUNCTIONS_URL}/system-status`, { headers });
  check(statusRes, {
    'system-status: status 200': (r) => r.status === 200,
  });

  sleep(0.5);
}

// ── Summary ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    total_requests: data.metrics.http_reqs.values.count,
    avg_duration_ms: Math.round(data.metrics.http_req_duration.values.avg),
    p95_duration_ms: Math.round(data.metrics.http_req_duration.values['p(95)']),
    p99_duration_ms: Math.round(data.metrics.http_req_duration.values['p(99)']),
    error_rate: data.metrics.http_req_failed.values.rate,
    checks_passed: data.metrics.checks.values.rate,
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
