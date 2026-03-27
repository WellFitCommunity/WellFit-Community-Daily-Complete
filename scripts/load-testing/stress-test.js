/**
 * Stress Test — k6
 *
 * Ramps from 1 to 200 virtual users to find the breaking point.
 * Monitors response times, error rates, and throughput.
 *
 * Usage:
 *   k6 run scripts/load-testing/stress-test.js \
 *     --env SUPABASE_URL=https://your-project.supabase.co \
 *     --env SUPABASE_ANON_KEY=your-key
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Configuration ────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Warm up
    { duration: '2m', target: 50 },   // Normal load
    { duration: '2m', target: 100 },  // High load
    { duration: '2m', target: 200 },  // Stress load
    { duration: '1m', target: 200 },  // Hold at peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // More lenient for stress test
    http_req_failed: ['rate<0.05'],     // Allow up to 5% errors under stress
    checks: ['rate>0.90'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// Custom metrics
const degradationTrend = new Trend('response_degradation');
const errorRate = new Rate('custom_error_rate');

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ANON_KEY}`,
  'apikey': ANON_KEY,
};

// ── Scenarios ────────────────────────────────────────────────────────────────

export default function () {
  // Rotate through endpoints to simulate realistic traffic mix
  const endpoints = [
    { method: 'GET', url: `${FUNCTIONS_URL}/health-monitor`, name: 'health' },
    { method: 'GET', url: `${FUNCTIONS_URL}/system-status`, name: 'status' },
    {
      method: 'POST',
      url: `${FUNCTIONS_URL}/ai-fall-risk-predictor`,
      body: JSON.stringify({}),
      name: 'ai-fall-risk',
    },
    {
      method: 'POST',
      url: `${FUNCTIONS_URL}/ai-readmission-predictor`,
      body: JSON.stringify({}),
      name: 'ai-readmission',
    },
    {
      method: 'POST',
      url: `${FUNCTIONS_URL}/check-drug-interactions`,
      body: JSON.stringify({ medications: [] }),
      name: 'drug-interactions',
    },
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  let res;
  if (endpoint.method === 'GET') {
    res = http.get(endpoint.url, { headers, tags: { name: endpoint.name } });
  } else {
    res = http.post(endpoint.url, endpoint.body, {
      headers,
      tags: { name: endpoint.name },
    });
  }

  degradationTrend.add(res.timings.duration);
  errorRate.add(res.status >= 500);

  check(res, {
    'not 500 WORKER_ERROR': (r) => r.status !== 500,
    'response time < 5s': (r) => r.timings.duration < 5000,
    'has response body': (r) => r.body !== undefined && r.body !== null,
  });

  sleep(0.2 + Math.random() * 0.3); // 200-500ms between requests
}

// ── Summary ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    test: 'stress-test',
    timestamp: new Date().toISOString(),
    total_requests: data.metrics.http_reqs.values.count,
    peak_vus: 200,
    avg_duration_ms: Math.round(data.metrics.http_req_duration.values.avg),
    p95_duration_ms: Math.round(data.metrics.http_req_duration.values['p(95)']),
    p99_duration_ms: Math.round(data.metrics.http_req_duration.values['p(99)']),
    max_duration_ms: Math.round(data.metrics.http_req_duration.values.max),
    error_rate: data.metrics.http_req_failed.values.rate,
    checks_passed: data.metrics.checks.values.rate,
    throughput_rps: Math.round(
      data.metrics.http_reqs.values.count /
        (data.metrics.http_req_duration.values.count > 0
          ? data.state.testRunDurationMs / 1000
          : 1)
    ),
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
