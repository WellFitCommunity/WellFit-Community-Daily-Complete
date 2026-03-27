/**
 * Check-In Flow Load Test — k6
 *
 * Simulates realistic check-in creation flow under concurrent load.
 * Tests the create-checkin edge function with synthetic patient data.
 *
 * Usage:
 *   k6 run scripts/load-testing/checkin-flow.js \
 *     --env SUPABASE_URL=https://your-project.supabase.co \
 *     --env SUPABASE_ANON_KEY=your-key \
 *     --env TEST_TENANT_ID=2b902657-6a20-4435-a78a-576f397517ca
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Configuration ────────────────────────────────────────────────────────────

export const options = {
  vus: 20,
  duration: '3m',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';
const TENANT_ID = __ENV.TEST_TENANT_ID || '2b902657-6a20-4435-a78a-576f397517ca';
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// Custom metrics
const checkinDuration = new Trend('checkin_create_duration');
const checkinErrors = new Rate('checkin_error_rate');

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ANON_KEY}`,
  'apikey': ANON_KEY,
};

// ── Synthetic Data ───────────────────────────────────────────────────────────

function randomMood() {
  const moods = ['happy', 'neutral', 'sad', 'anxious', 'grateful'];
  return moods[Math.floor(Math.random() * moods.length)];
}

function randomVitals() {
  return {
    blood_pressure_systolic: 110 + Math.floor(Math.random() * 40),
    blood_pressure_diastolic: 65 + Math.floor(Math.random() * 25),
    heart_rate: 60 + Math.floor(Math.random() * 40),
    oxygen_saturation: 94 + Math.floor(Math.random() * 6),
    temperature: 97.0 + Math.random() * 2.0,
    glucose: 80 + Math.floor(Math.random() * 80),
  };
}

function buildCheckinPayload() {
  const vitals = randomVitals();
  return {
    tenant_id: TENANT_ID,
    mood: randomMood(),
    pain_level: Math.floor(Math.random() * 10),
    symptoms: [],
    notes: `Load test check-in at ${new Date().toISOString()}`,
    blood_pressure_systolic: vitals.blood_pressure_systolic,
    blood_pressure_diastolic: vitals.blood_pressure_diastolic,
    heart_rate: vitals.heart_rate,
    oxygen_saturation: vitals.oxygen_saturation,
    temperature: vitals.temperature,
    glucose: vitals.glucose,
  };
}

// ── Main Flow ────────────────────────────────────────────────────────────────

export default function () {
  // 1. CORS preflight (browsers always do this first)
  const preflightRes = http.options(`${FUNCTIONS_URL}/create-checkin`, {
    headers: {
      'Origin': 'https://app.wellfitcommunity.com',
      'Access-Control-Request-Method': 'POST',
    },
  });
  check(preflightRes, {
    'preflight: 200 or 204': (r) => r.status === 200 || r.status === 204,
  });

  // 2. Create check-in
  const payload = buildCheckinPayload();
  const checkinRes = http.post(
    `${FUNCTIONS_URL}/create-checkin`,
    JSON.stringify(payload),
    { headers }
  );

  checkinDuration.add(checkinRes.timings.duration);
  checkinErrors.add(checkinRes.status >= 500);

  check(checkinRes, {
    'checkin: not 500': (r) => r.status !== 500,
    'checkin: returns JSON': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
    'checkin: response < 2s': (r) => r.timings.duration < 2000,
  });

  // 3. Simulate user think time
  sleep(1 + Math.random() * 2);
}

// ── Summary ──────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    test: 'checkin-flow',
    timestamp: new Date().toISOString(),
    total_checkins: data.metrics.http_reqs.values.count,
    avg_duration_ms: Math.round(data.metrics.http_req_duration.values.avg),
    p95_duration_ms: Math.round(data.metrics.http_req_duration.values['p(95)']),
    error_rate: data.metrics.http_req_failed.values.rate,
    checks_passed: data.metrics.checks.values.rate,
  };

  return {
    stdout: JSON.stringify(summary, null, 2),
  };
}
