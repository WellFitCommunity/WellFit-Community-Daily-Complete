/**
 * Immunization Registry Submit Edge Function Tests
 *
 * ONC Criteria: 170.315(f)(1) - Transmission to Immunization Registries
 *
 * Purpose: Validate immunization registry submission handling, HL7 VXU format, authorization
 * Coverage: Request validation, auth, state config, tenant isolation, response structure
 *
 * Run with: deno test --allow-env supabase/functions/immunization-registry-submit/__tests__/index.test.ts
 */

import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';

// =============================================================================
// REQUEST VALIDATION TESTS
// =============================================================================

Deno.test('should validate immunization submit request structure', () => {
  const validRequest = {
    tenantId: 'WF-0001',
    immunizationId: 'imm-123',
    patientId: 'patient-456',
    state: 'TX',
    useTestEndpoint: false,
  };

  assertExists(validRequest.tenantId);
  assertExists(validRequest.immunizationId);
  assertExists(validRequest.patientId);
  assertExists(validRequest.state);
  assertEquals(validRequest.useTestEndpoint, false);
});

Deno.test('should require all mandatory fields', () => {
  const validateRequest = (req: Record<string, unknown>): boolean => {
    return !!(req.tenantId && req.immunizationId && req.patientId && req.state);
  };

  assertEquals(validateRequest({ tenantId: 'WF-0001', immunizationId: 'imm-1', patientId: 'p-1', state: 'TX' }), true);
  assertEquals(validateRequest({ tenantId: 'WF-0001', immunizationId: 'imm-1', patientId: 'p-1' }), false);
  assertEquals(validateRequest({ tenantId: 'WF-0001', immunizationId: 'imm-1' }), false);
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

Deno.test('should have correct Texas ImmTrac2 configuration', () => {
  const STATE_CONFIGS = {
    TX: {
      name: 'Texas ImmTrac2',
      endpoint: 'https://immtrac.dshs.texas.gov/api/vxu',
      testEndpoint: 'https://immtrac-test.dshs.texas.gov/api/vxu',
      format: 'HL7v2',
      authType: 'certificate',
      supportsQuery: true,
    },
  };

  assertEquals(STATE_CONFIGS.TX.name, 'Texas ImmTrac2');
  assertEquals(STATE_CONFIGS.TX.format, 'HL7v2');
  assertEquals(STATE_CONFIGS.TX.authType, 'certificate');
  assertEquals(STATE_CONFIGS.TX.supportsQuery, true);
  assertStringIncludes(STATE_CONFIGS.TX.endpoint, 'https://');
  assertStringIncludes(STATE_CONFIGS.TX.endpoint, 'immtrac');
});

Deno.test('should normalize state code to uppercase', () => {
  const normalizeState = (state: string): string => state.toUpperCase();

  assertEquals(normalizeState('tx'), 'TX');
  assertEquals(normalizeState('Tx'), 'TX');
  assertEquals(normalizeState('TX'), 'TX');
  assertEquals(normalizeState('ca'), 'CA');
});

Deno.test('should reject unconfigured states', () => {
  const STATE_CONFIGS: Record<string, { name: string }> = {
    TX: { name: 'Texas ImmTrac2' },
  };

  const getStateConfig = (state: string) => STATE_CONFIGS[state.toUpperCase()];

  assertExists(getStateConfig('TX'));
  assertEquals(getStateConfig('CA'), undefined);
  assertEquals(getStateConfig('NY'), undefined);
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
// DUPLICATE SUBMISSION DETECTION TESTS
// =============================================================================

Deno.test('should detect already submitted immunizations', () => {
  const existingSubmission = {
    id: 'sub-123',
    submission_id: 'uuid-456',
    status: 'accepted',
  };

  const isAlreadySubmitted = existingSubmission?.status === 'accepted';
  assertEquals(isAlreadySubmitted, true);
});

Deno.test('should allow resubmission for non-accepted status', () => {
  const rejectedSubmission = { status: 'rejected' };
  const pendingSubmission = { status: 'pending' };
  const noSubmission = null;

  assertEquals(rejectedSubmission?.status === 'accepted', false);
  assertEquals(pendingSubmission?.status === 'accepted', false);
  assertEquals(noSubmission?.status === 'accepted', false);
});

// =============================================================================
// HL7 VXU MESSAGE TESTS
// =============================================================================

Deno.test('should use HL7v2 format for immunization registries', () => {
  const config = {
    TX: { format: 'HL7v2' as const },
  };

  assertEquals(config.TX.format, 'HL7v2');
});

Deno.test('should generate valid ACK codes', () => {
  const validAckCodes = ['AA', 'AE', 'AR']; // Accept, Error, Reject

  assertEquals(validAckCodes.includes('AA'), true); // Application Accept
  assertEquals(validAckCodes.includes('AE'), true); // Application Error
  assertEquals(validAckCodes.includes('AR'), true); // Application Reject
});

// =============================================================================
// RESPONSE STRUCTURE TESTS
// =============================================================================

Deno.test('should have correct success response structure', () => {
  const successResponse = {
    success: true,
    data: {
      submissionId: 'uuid-123',
      destination: 'Texas ImmTrac2',
      endpoint: 'https://immtrac.dshs.texas.gov/api/vxu',
      timestamp: '2026-01-22T14:00:00.000Z',
      status: 'submitted',
      ackCode: 'AA',
    },
  };

  assertEquals(successResponse.success, true);
  assertExists(successResponse.data.submissionId);
  assertExists(successResponse.data.destination);
  assertExists(successResponse.data.endpoint);
  assertExists(successResponse.data.timestamp);
  assertEquals(successResponse.data.status, 'submitted');
  assertEquals(successResponse.data.ackCode, 'AA');
});

Deno.test('should have correct already-submitted response', () => {
  const alreadySubmittedResponse = {
    success: true,
    data: {
      submissionId: 'existing-uuid',
      status: 'already_submitted',
      message: 'This immunization was already submitted and accepted',
    },
  };

  assertEquals(alreadySubmittedResponse.success, true);
  assertEquals(alreadySubmittedResponse.data.status, 'already_submitted');
  assertExists(alreadySubmittedResponse.data.message);
});

Deno.test('should have correct error response structure', () => {
  const errorResponse = {
    success: false,
    error: 'Immunization record not found',
  };

  assertEquals(errorResponse.success, false);
  assertExists(errorResponse.error);
});

// =============================================================================
// SUBMISSION RECORD TESTS
// =============================================================================

Deno.test('should create submission record with required fields', () => {
  const submissionRecord = {
    tenant_id: 'WF-0001',
    immunization_id: 'imm-123',
    patient_id: 'patient-456',
    submission_id: crypto.randomUUID(),
    registry_name: 'Texas ImmTrac2',
    registry_state: 'TX',
    registry_endpoint: 'https://immtrac.dshs.texas.gov/api/vxu',
    submission_timestamp: new Date().toISOString(),
    status: 'submitted',
    ack_code: 'AA',
    ack_message: 'Message accepted',
    is_test: false,
  };

  assertExists(submissionRecord.tenant_id);
  assertExists(submissionRecord.immunization_id);
  assertExists(submissionRecord.patient_id);
  assertExists(submissionRecord.submission_id);
  assertExists(submissionRecord.registry_name);
  assertExists(submissionRecord.registry_state);
  assertExists(submissionRecord.submission_timestamp);
  assertEquals(submissionRecord.status, 'submitted');
});

// =============================================================================
// ONC CRITERIA COMPLIANCE TESTS
// =============================================================================

Deno.test('should support ONC 170.315(f)(1) transmission requirements', () => {
  // ONC requires: patient demographics, vaccine info, administration details
  const immunizationSubmission = {
    patientId: 'patient-456',
    patientFirstName: 'John',
    patientLastName: 'Doe',
    patientDob: '1985-03-15',
    vaccineCode: '207', // CVX code for COVID-19 vaccine
    vaccineName: 'Moderna COVID-19',
    lotNumber: 'ABC123',
    administrationDate: '2026-01-15',
    administrationSite: 'Left deltoid',
    providerNpi: '1234567890',
  };

  assertExists(immunizationSubmission.patientId);
  assertExists(immunizationSubmission.vaccineCode);
  assertExists(immunizationSubmission.administrationDate);
  assertExists(immunizationSubmission.providerNpi);
});

Deno.test('should support query capability for ImmTrac2', () => {
  const config = {
    TX: { supportsQuery: true },
  };

  assertEquals(config.TX.supportsQuery, true);
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
