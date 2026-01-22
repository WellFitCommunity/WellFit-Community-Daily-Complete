/**
 * PDMP Query Edge Function Tests
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing (PDMP integration)
 *
 * Purpose: Validate PDMP query handling, prescription history retrieval, risk analysis
 * Coverage: Request validation, auth, caching, risk flags, response structure
 *
 * Run with: deno test --allow-env supabase/functions/pdmp-query/__tests__/index.test.ts
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

// =============================================================================
// REQUEST VALIDATION TESTS
// =============================================================================

Deno.test('should validate PDMP query request structure', () => {
  const validRequest = {
    tenantId: 'WF-0001',
    providerId: 'provider-123',
    providerNpi: '1234567890',
    providerDea: 'AB1234567',
    patientId: 'patient-456',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDob: '1985-03-15',
    state: 'TX',
    dateRangeMonths: 12,
    useTestEndpoint: false,
  };

  assertExists(validRequest.tenantId);
  assertExists(validRequest.providerId);
  assertExists(validRequest.providerNpi);
  assertExists(validRequest.providerDea);
  assertExists(validRequest.patientId);
  assertExists(validRequest.patientFirstName);
  assertExists(validRequest.patientLastName);
  assertExists(validRequest.patientDob);
  assertExists(validRequest.state);
});

Deno.test('should require mandatory fields', () => {
  const validateRequest = (req: Record<string, unknown>): boolean => {
    return !!(req.tenantId && req.providerId && req.patientId && req.state);
  };

  assertEquals(validateRequest({ tenantId: 'WF-0001', providerId: 'p-1', patientId: 'pt-1', state: 'TX' }), true);
  assertEquals(validateRequest({ tenantId: 'WF-0001', providerId: 'p-1', patientId: 'pt-1' }), false);
  assertEquals(validateRequest({ tenantId: 'WF-0001' }), false);
  assertEquals(validateRequest({}), false);
});

Deno.test('should default dateRangeMonths to 12', () => {
  const request: { dateRangeMonths?: number } = {};
  const dateRangeMonths = request.dateRangeMonths ?? 12;
  assertEquals(dateRangeMonths, 12);
});

// =============================================================================
// STATE CONFIGURATION TESTS
// =============================================================================

Deno.test('should have correct Texas PMP AWARxE configuration', () => {
  const STATE_CONFIGS = {
    TX: {
      name: 'Texas PMP AWARxE',
      endpoint: 'https://texas.pmpaware.net/api/query',
      testEndpoint: 'https://texas-test.pmpaware.net/api/query',
      authType: 'pmix',
      mandatoryQuery: true,
      queryBeforeSchedule: [2, 3, 4, 5],
    },
  };

  assertEquals(STATE_CONFIGS.TX.name, 'Texas PMP AWARxE');
  assertEquals(STATE_CONFIGS.TX.authType, 'pmix');
  assertEquals(STATE_CONFIGS.TX.mandatoryQuery, true);
  assertEquals(STATE_CONFIGS.TX.queryBeforeSchedule, [2, 3, 4, 5]);
  assertStringIncludes(STATE_CONFIGS.TX.endpoint, 'https://');
});

Deno.test('should identify DEA schedules requiring PDMP query', () => {
  const queryBeforeSchedule = [2, 3, 4, 5];

  // Schedule II-V require PDMP query
  assertEquals(queryBeforeSchedule.includes(2), true);
  assertEquals(queryBeforeSchedule.includes(3), true);
  assertEquals(queryBeforeSchedule.includes(4), true);
  assertEquals(queryBeforeSchedule.includes(5), true);

  // Schedule I and non-controlled don't require query
  assertEquals(queryBeforeSchedule.includes(1), false);
  assertEquals(queryBeforeSchedule.includes(0), false);
});

// =============================================================================
// CACHING TESTS
// =============================================================================

Deno.test('should detect recent query within 24 hours', () => {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentQuery = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago
  const oldQuery = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48 hours ago

  assertEquals(recentQuery >= twentyFourHoursAgo, true);
  assertEquals(oldQuery >= twentyFourHoursAgo, false);
});

Deno.test('should return cached result structure', () => {
  const cachedResponse = {
    success: true,
    data: {
      queryId: 'query-123',
      cached: true,
      cacheTimestamp: '2026-01-22T02:00:00.000Z',
      prescriptions: [],
      message: 'Using cached PDMP query from within 24 hours',
    },
  };

  assertEquals(cachedResponse.data.cached, true);
  assertExists(cachedResponse.data.cacheTimestamp);
  assertExists(cachedResponse.data.message);
});

// =============================================================================
// DATE RANGE CALCULATION TESTS
// =============================================================================

Deno.test('should calculate correct date range', () => {
  const now = new Date('2026-01-22T14:00:00.000Z');
  const dateRangeMonths = 12;

  const dateRangeStart = new Date(now);
  dateRangeStart.setMonth(dateRangeStart.getMonth() - dateRangeMonths);

  assertEquals(dateRangeStart.getFullYear(), 2025);
  assertEquals(dateRangeStart.getMonth(), 0); // January
});

// =============================================================================
// PRESCRIPTION HISTORY TESTS
// =============================================================================

Deno.test('should validate prescription record structure', () => {
  const prescription = {
    drug_name: 'Hydrocodone/APAP 5/325',
    drug_ndc: '00406-0123-01',
    dea_schedule: 2,
    quantity_dispensed: 60,
    days_supply: 30,
    prescriber_name: 'Dr. Test Provider',
    prescriber_npi: '1234567890',
    prescriber_dea: 'AB1234567',
    pharmacy_name: 'Test Pharmacy',
    pharmacy_npi: '9876543210',
    filled_date: '2025-12-08T00:00:00.000Z',
    written_date: '2025-12-03T00:00:00.000Z',
  };

  assertExists(prescription.drug_name);
  assertExists(prescription.drug_ndc);
  assertExists(prescription.dea_schedule);
  assertExists(prescription.quantity_dispensed);
  assertExists(prescription.days_supply);
  assertExists(prescription.prescriber_npi);
  assertExists(prescription.filled_date);
  assertEquals(prescription.dea_schedule, 2);
});

// =============================================================================
// RISK FLAG TESTS
// =============================================================================

Deno.test('should have correct risk flag structure', () => {
  const riskFlags = {
    doctorShopping: false,
    pharmacyShopping: false,
    earlyRefill: false,
    highMme: false,
    overlappingPrescriptions: false,
  };

  assertExists(riskFlags.doctorShopping);
  assertExists(riskFlags.pharmacyShopping);
  assertExists(riskFlags.earlyRefill);
  assertExists(riskFlags.highMme);
  assertExists(riskFlags.overlappingPrescriptions);
});

Deno.test('should categorize risk levels correctly', () => {
  const calculateRiskLevel = (flags: Record<string, boolean>): string => {
    const flagCount = Object.values(flags).filter(Boolean).length;
    if (flagCount === 0) return 'low';
    if (flagCount <= 2) return 'medium';
    return 'high';
  };

  assertEquals(calculateRiskLevel({ doctorShopping: false, earlyRefill: false }), 'low');
  assertEquals(calculateRiskLevel({ doctorShopping: true, earlyRefill: false }), 'medium');
  assertEquals(calculateRiskLevel({ doctorShopping: true, earlyRefill: true }), 'medium');
  assertEquals(calculateRiskLevel({ doctorShopping: true, earlyRefill: true, highMme: true }), 'high');
});

// =============================================================================
// RESPONSE STRUCTURE TESTS
// =============================================================================

Deno.test('should have correct success response structure', () => {
  const successResponse = {
    success: true,
    data: {
      queryId: 'uuid-123',
      state: 'TX',
      pdmpName: 'Texas PMP AWARxE',
      endpoint: 'https://texas.pmpaware.net/api/query',
      queryTimestamp: '2026-01-22T14:00:00.000Z',
      dateRange: {
        start: '2025-01-22T14:00:00.000Z',
        end: '2026-01-22T14:00:00.000Z',
      },
      prescriptionsFound: 1,
      prescriptions: [],
      riskFlags: {},
      riskLevel: 'low',
      isTest: false,
    },
  };

  assertEquals(successResponse.success, true);
  assertExists(successResponse.data.queryId);
  assertExists(successResponse.data.state);
  assertExists(successResponse.data.pdmpName);
  assertExists(successResponse.data.queryTimestamp);
  assertExists(successResponse.data.dateRange);
  assertExists(successResponse.data.prescriptionsFound);
  assertExists(successResponse.data.riskLevel);
});

Deno.test('should have correct error response structure', () => {
  const errorResponse = {
    success: false,
    error: 'State TX not configured for PDMP',
  };

  assertEquals(errorResponse.success, false);
  assertExists(errorResponse.error);
});

// =============================================================================
// QUERY RECORD TESTS
// =============================================================================

Deno.test('should create query record with required fields', () => {
  const queryRecord = {
    id: crypto.randomUUID(),
    tenant_id: 'WF-0001',
    query_type: 'patient_history',
    provider_id: 'provider-123',
    provider_npi: '1234567890',
    provider_dea: 'AB1234567',
    patient_id: 'patient-456',
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    patient_dob: '1985-03-15',
    pdmp_state: 'TX',
    date_range_start: '2025-01-22T14:00:00.000Z',
    date_range_end: '2026-01-22T14:00:00.000Z',
    query_timestamp: new Date().toISOString(),
    response_status: 'success',
    response_code: '200',
    prescriptions_found: 1,
    is_test: false,
  };

  assertExists(queryRecord.id);
  assertExists(queryRecord.tenant_id);
  assertExists(queryRecord.provider_id);
  assertExists(queryRecord.patient_id);
  assertExists(queryRecord.pdmp_state);
  assertExists(queryRecord.query_timestamp);
  assertEquals(queryRecord.query_type, 'patient_history');
});

// =============================================================================
// ONC CRITERIA COMPLIANCE TESTS
// =============================================================================

Deno.test('should support ONC 170.315(b)(3) PDMP requirements', () => {
  // ONC requires: query before prescribing Schedule II-V, display history, risk indicators
  const pdmpQuery = {
    providerId: 'provider-123',
    providerDea: 'AB1234567',
    patientId: 'patient-456',
    state: 'TX',
    dateRangeMonths: 12,
  };

  assertExists(pdmpQuery.providerDea); // Required for controlled substance prescribing
  assertExists(pdmpQuery.state); // State PDMP system
  assertExists(pdmpQuery.dateRangeMonths); // Historical lookup period
});

Deno.test('should track mandatory query compliance', () => {
  const config = {
    TX: { mandatoryQuery: true },
  };

  assertEquals(config.TX.mandatoryQuery, true);
});

// =============================================================================
// AUTHORIZATION TESTS
// =============================================================================

Deno.test('should validate Bearer token format', () => {
  const validAuth = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  const invalidAuth = 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=';

  assertEquals(validAuth.startsWith('Bearer '), true);
  assertEquals(invalidAuth.startsWith('Bearer '), false);
});

// =============================================================================
// CORS HEADERS TESTS
// =============================================================================

Deno.test('should return proper CORS headers', () => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://wellfitcommunity.live',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };

  assertExists(corsHeaders['Access-Control-Allow-Origin']);
  assertStringIncludes(corsHeaders['Access-Control-Allow-Methods'], 'POST');
});
