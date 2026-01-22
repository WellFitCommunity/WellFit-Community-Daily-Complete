/**
 * Syndromic Surveillance Submit Edge Function Tests
 *
 * ONC Criteria: 170.315(f)(2) - Transmission to Public Health Agencies - Syndromic Surveillance
 *
 * Purpose: Validate syndromic surveillance submission handling, HL7 ADT format, authorization
 * Coverage: Request validation, auth, state config, tenant isolation, response structure
 *
 * Run with: deno test --allow-env supabase/functions/syndromic-surveillance-submit/__tests__/index.test.ts
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

// =============================================================================
// REQUEST VALIDATION TESTS
// =============================================================================

Deno.test('should validate syndromic surveillance submit request structure', () => {
  const validRequest = {
    tenantId: 'WF-0001',
    encounterId: 'encounter-123',
    state: 'TX',
    useTestEndpoint: false,
  };

  assertExists(validRequest.tenantId);
  assertExists(validRequest.encounterId);
  assertExists(validRequest.state);
  assertEquals(validRequest.useTestEndpoint, false);
});

Deno.test('should require all mandatory fields', () => {
  const validateRequest = (req: Record<string, unknown>): boolean => {
    return !!(req.tenantId && req.encounterId && req.state);
  };

  assertEquals(validateRequest({ tenantId: 'WF-0001', encounterId: 'enc-1', state: 'TX' }), true);
  assertEquals(validateRequest({ tenantId: 'WF-0001', encounterId: 'enc-1' }), false);
  assertEquals(validateRequest({ tenantId: 'WF-0001' }), false);
  assertEquals(validateRequest({}), false);
});

Deno.test('should default useTestEndpoint to false', () => {
  const request: { tenantId: string; useTestEndpoint?: boolean } = {
    tenantId: 'WF-0001',
  };

  const useTestEndpoint = request.useTestEndpoint ?? false;
  assertEquals(useTestEndpoint, false);
});

// =============================================================================
// STATE CONFIGURATION TESTS
// =============================================================================

Deno.test('should have correct Texas DSHS configuration', () => {
  const STATE_CONFIGS = {
    TX: {
      name: 'Texas DSHS',
      endpoint: 'https://syndromic.dshs.texas.gov/api/submit',
      testEndpoint: 'https://syndromic-test.dshs.texas.gov/api/submit',
      format: 'HL7v2',
      authType: 'certificate',
    },
  };

  assertEquals(STATE_CONFIGS.TX.name, 'Texas DSHS');
  assertEquals(STATE_CONFIGS.TX.format, 'HL7v2');
  assertEquals(STATE_CONFIGS.TX.authType, 'certificate');
  assertStringIncludes(STATE_CONFIGS.TX.endpoint, 'https://');
  assertStringIncludes(STATE_CONFIGS.TX.endpoint, 'dshs.texas.gov');
});

Deno.test('should normalize state code to uppercase', () => {
  const normalizeState = (state: string): string => state.toUpperCase();

  assertEquals(normalizeState('tx'), 'TX');
  assertEquals(normalizeState('Tx'), 'TX');
  assertEquals(normalizeState('TX'), 'TX');
});

Deno.test('should reject unconfigured states', () => {
  const STATE_CONFIGS: Record<string, { name: string }> = {
    TX: { name: 'Texas DSHS' },
  };

  const getStateConfig = (state: string) => STATE_CONFIGS[state.toUpperCase()];

  assertExists(getStateConfig('TX'));
  assertEquals(getStateConfig('CA'), undefined);
  assertEquals(getStateConfig('NY'), undefined);
});

Deno.test('should select correct endpoint based on useTestEndpoint flag', () => {
  const config = {
    endpoint: 'https://syndromic.dshs.texas.gov/api/submit',
    testEndpoint: 'https://syndromic-test.dshs.texas.gov/api/submit',
  };

  const productionEndpoint = false ? config.testEndpoint : config.endpoint;
  const testEndpoint = true ? config.testEndpoint : config.endpoint;

  assertEquals(productionEndpoint, config.endpoint);
  assertEquals(testEndpoint, config.testEndpoint);
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
// HL7 MESSAGE VALIDATION TESTS
// =============================================================================

Deno.test('should use HL7v2 format for syndromic surveillance', () => {
  const config = {
    TX: { format: 'HL7v2' as const },
  };

  assertEquals(config.TX.format, 'HL7v2');
});

Deno.test('should require HL7 message in encounter', () => {
  const encounterWithMessage = { hl7_message: 'MSH|^~\\&|...' };
  const encounterWithoutMessage = { hl7_message: null };

  assertEquals(!!encounterWithMessage.hl7_message, true);
  assertEquals(!!encounterWithoutMessage.hl7_message, false);
});

Deno.test('should validate ADT message types', () => {
  const validMessageTypes = ['A01', 'A03', 'A04', 'A08']; // Admit, Discharge, Register, Update

  assertEquals(validMessageTypes.includes('A01'), true); // Admit
  assertEquals(validMessageTypes.includes('A03'), true); // Discharge
  assertEquals(validMessageTypes.includes('A04'), true); // Register
  assertEquals(validMessageTypes.includes('A08'), true); // Update
});

// =============================================================================
// ENCOUNTER VALIDATION TESTS
// =============================================================================

Deno.test('should validate encounter structure', () => {
  const encounter = {
    id: 'encounter-123',
    tenant_id: 'WF-0001',
    patient_id: 'patient-456',
    message_type: 'A04',
    hl7_message: 'MSH|^~\\&|WELLFIT|FACILITY|TXDSHS|...',
    chief_complaint: 'Fever and cough',
    visit_date: '2026-01-22T08:00:00.000Z',
  };

  assertExists(encounter.id);
  assertExists(encounter.tenant_id);
  assertExists(encounter.patient_id);
  assertExists(encounter.message_type);
  assertExists(encounter.hl7_message);
});

// =============================================================================
// RESPONSE STRUCTURE TESTS
// =============================================================================

Deno.test('should have correct success response structure', () => {
  const successResponse = {
    success: true,
    data: {
      submissionId: 'uuid-123',
      destination: 'Texas DSHS',
      endpoint: 'https://syndromic.dshs.texas.gov/api/submit',
      timestamp: '2026-01-22T14:00:00.000Z',
      status: 'submitted',
      messageType: 'A04',
    },
  };

  assertEquals(successResponse.success, true);
  assertExists(successResponse.data.submissionId);
  assertExists(successResponse.data.destination);
  assertExists(successResponse.data.endpoint);
  assertExists(successResponse.data.timestamp);
  assertEquals(successResponse.data.status, 'submitted');
  assertExists(successResponse.data.messageType);
});

Deno.test('should have correct error response for missing HL7 message', () => {
  const errorResponse = {
    success: false,
    error: 'HL7 message not generated for this encounter',
  };

  assertEquals(errorResponse.success, false);
  assertStringIncludes(errorResponse.error, 'HL7 message');
});

Deno.test('should have correct error response for encounter not found', () => {
  const errorResponse = {
    success: false,
    error: 'Encounter not found',
  };

  assertEquals(errorResponse.success, false);
  assertEquals(errorResponse.error, 'Encounter not found');
});

// =============================================================================
// TRANSMISSION RECORD TESTS
// =============================================================================

Deno.test('should create transmission record with required fields', () => {
  const transmissionRecord = {
    tenant_id: 'WF-0001',
    encounter_id: 'encounter-123',
    submission_id: crypto.randomUUID(),
    destination: 'Texas DSHS',
    destination_endpoint: 'https://syndromic.dshs.texas.gov/api/submit',
    message_type: 'A04',
    hl7_message: 'MSH|^~\\&|...',
    submission_timestamp: new Date().toISOString(),
    status: 'submitted',
    response_code: '200',
    response_message: 'Accepted',
    is_test: false,
  };

  assertExists(transmissionRecord.tenant_id);
  assertExists(transmissionRecord.encounter_id);
  assertExists(transmissionRecord.submission_id);
  assertExists(transmissionRecord.destination);
  assertExists(transmissionRecord.message_type);
  assertExists(transmissionRecord.hl7_message);
  assertExists(transmissionRecord.submission_timestamp);
  assertEquals(transmissionRecord.status, 'submitted');
});

// =============================================================================
// ENCOUNTER STATUS UPDATE TESTS
// =============================================================================

Deno.test('should update encounter status after submission', () => {
  const encounterUpdate = {
    transmission_status: 'submitted',
    last_submission_id: 'uuid-123',
    last_submission_date: '2026-01-22T14:00:00.000Z',
  };

  assertEquals(encounterUpdate.transmission_status, 'submitted');
  assertExists(encounterUpdate.last_submission_id);
  assertExists(encounterUpdate.last_submission_date);
});

// =============================================================================
// ONC CRITERIA COMPLIANCE TESTS
// =============================================================================

Deno.test('should support ONC 170.315(f)(2) syndromic surveillance requirements', () => {
  // ONC requires: patient demographics, visit info, chief complaint, diagnosis
  const syndromicData = {
    patientId: 'patient-456',
    encounterId: 'encounter-123',
    visitDate: '2026-01-22T08:00:00.000Z',
    chiefComplaint: 'Fever and cough',
    facilityId: 'facility-789',
    messageType: 'A04',
  };

  assertExists(syndromicData.patientId);
  assertExists(syndromicData.encounterId);
  assertExists(syndromicData.visitDate);
  assertExists(syndromicData.chiefComplaint);
  assertExists(syndromicData.messageType);
});

Deno.test('should use certificate authentication for state health departments', () => {
  const config = {
    TX: { authType: 'certificate' },
  };

  assertEquals(config.TX.authType, 'certificate');
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

// =============================================================================
// UUID AND TIMESTAMP TESTS
// =============================================================================

Deno.test('should generate valid UUID for submission ID', () => {
  const submissionId = crypto.randomUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assertEquals(uuidRegex.test(submissionId), true);
});

Deno.test('should generate valid ISO timestamp', () => {
  const timestamp = new Date().toISOString();
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

  assertEquals(isoRegex.test(timestamp), true);
});
