/**
 * FHIR Security Service Tests
 *
 * Tests for:
 * - ErrorSanitizer: PHI removal, error message sanitization
 * - FHIRValidator: Patient, Observation, Bundle validation
 * - AuditLogger: Audit event logging
 * - RateLimiter: Rate limiting checks
 * - SecureFHIROperations: Secure import/export wrappers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorSanitizer,
  FHIRValidator,
  AuditLogger,
  RateLimiter,
  SecureFHIROperations,
} from '../fhirSecurityService';

// Mock supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

import { supabase } from '../../lib/supabaseClient';

describe('FHIRSecurityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // ErrorSanitizer Tests
  // ==========================================================================
  describe('ErrorSanitizer', () => {
    describe('sanitize', () => {
      it('should remove SSN patterns from error messages', () => {
        const error = new Error('Error for SSN 123-45-6789 not found');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).not.toContain('123-45-6789');
        expect(result).toContain('[REDACTED]');
      });

      it('should remove email addresses from error messages', () => {
        const error = new Error('User john.doe@example.com not authorized');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).not.toContain('john.doe@example.com');
        expect(result).toContain('[REDACTED]');
      });

      it('should remove phone numbers from error messages', () => {
        const error = new Error('Failed to send SMS to 555-123-4567');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).not.toContain('555-123-4567');
        expect(result).toContain('[REDACTED]');
      });

      it('should remove UUIDs from patient_id references', () => {
        const error = new Error('patient_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toContain('[REDACTED]');
      });

      it('should remove DOB references', () => {
        const error = new Error('DOB: 1990-01-15 invalid format');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toContain('[REDACTED]');
      });

      it('should replace known database error codes with friendly messages', () => {
        const error = new Error('Error code 23505: unique_violation');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toBe('Duplicate record exists');
      });

      it('should replace auth error codes with friendly messages', () => {
        const error = new Error('PGRST301 - no authorization header');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toBe('Authentication required');
      });

      it('should replace network error codes with friendly messages', () => {
        const error = new Error('ECONNREFUSED at localhost:5432');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toBe('Service temporarily unavailable');
      });

      it('should truncate long error messages', () => {
        const longMessage = 'x'.repeat(300);
        const error = new Error(longMessage);
        const result = ErrorSanitizer.sanitize(error);
        expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
      });

      it('should handle string errors', () => {
        const result = ErrorSanitizer.sanitize('Simple string error');
        expect(result).toBe('Simple string error');
      });

      it('should handle unknown error types', () => {
        const result = ErrorSanitizer.sanitize(undefined);
        expect(result).toBe('An error occurred');
      });

      it('should handle object with message property', () => {
        const result = ErrorSanitizer.sanitize({ message: 'Custom error message' });
        expect(result).toBe('Custom error message');
      });

      it('should remove stack traces', () => {
        const error = new Error('First line\nStack trace line 1\nStack trace line 2');
        const result = ErrorSanitizer.sanitize(error);
        expect(result).toBe('First line');
        expect(result).not.toContain('Stack trace');
      });
    });

    describe('createSafeError', () => {
      it('should create safe error object with sanitized message', () => {
        const error = new Error('Error with SSN 123-45-6789');
        const result = ErrorSanitizer.createSafeError(error);

        expect(result.message).toContain('[REDACTED]');
        expect(result.timestamp).toBeDefined();
        expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      });

      it('should use custom user message when provided', () => {
        const error = new Error('Internal technical error');
        const result = ErrorSanitizer.createSafeError(error, 'Something went wrong');

        expect(result.message).toBe('Something went wrong');
      });

      it('should extract error code if available', () => {
        const error = { message: 'Error', code: 'ERR_001' };
        const result = ErrorSanitizer.createSafeError(error);

        expect(result.code).toBe('ERR_001');
      });

      it('should use UNKNOWN_ERROR when no code available', () => {
        const error = new Error('Simple error');
        const result = ErrorSanitizer.createSafeError(error);

        expect(result.code).toBe('UNKNOWN_ERROR');
      });
    });

    describe('logError', () => {
      it('should log error to database via RPC', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        await ErrorSanitizer.logError(new Error('Test error'), { context: 'test' });

        expect(supabase.rpc).toHaveBeenCalledWith('log_security_event', {
          p_event_type: 'SYSTEM_ERROR',
          p_severity: 'MEDIUM',
          p_description: expect.any(String),
          p_metadata: expect.objectContaining({
            error_type: 'Error',
            context: 'test',
          }),
        });
      });

      it('should not throw if logging fails', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

        // Should not throw
        await expect(
          ErrorSanitizer.logError(new Error('Test error'))
        ).resolves.not.toThrow();
      });
    });
  });

  // ==========================================================================
  // FHIRValidator Tests
  // ==========================================================================
  describe('FHIRValidator', () => {
    describe('validatePatient', () => {
      it('should accept valid patient resource', () => {
        const patient = {
          resourceType: 'Patient',
          id: 'patient-123',
          name: [{ family: 'Doe', given: ['John'] }],
          birthDate: '1990-01-15',
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sanitizedInput).toEqual(patient);
      });

      it('should reject null patient', () => {
        const result = FHIRValidator.validatePatient(null as unknown as Record<string, unknown>);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Patient resource is required');
      });

      it('should reject wrong resource type', () => {
        const result = FHIRValidator.validatePatient({ resourceType: 'Observation' });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Resource must be of type Patient');
      });

      it('should require id or identifier', () => {
        const result = FHIRValidator.validatePatient({ resourceType: 'Patient' });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Patient must have either id or identifier');
      });

      it('should accept patient with identifier instead of id', () => {
        const patient = {
          resourceType: 'Patient',
          identifier: [{ system: 'http://hospital.org', value: 'MRN123' }],
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(true);
      });

      it('should validate name has family or given', () => {
        const patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ use: 'official' }], // Missing family and given
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Name\[0\] must have family or given name/);
      });

      it('should accept name with only family', () => {
        const patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ family: 'Doe' }],
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(true);
      });

      it('should accept name with only given', () => {
        const patient = {
          resourceType: 'Patient',
          id: '123',
          name: [{ given: ['John'] }],
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(true);
      });

      it('should validate birthDate format', () => {
        const patient = {
          resourceType: 'Patient',
          id: '123',
          birthDate: '01-15-1990', // Wrong format
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('birthDate must be in YYYY-MM-DD format');
      });

      it('should accept valid YYYY-MM-DD birthDate', () => {
        const patient = {
          resourceType: 'Patient',
          id: '123',
          birthDate: '1990-01-15',
        };

        const result = FHIRValidator.validatePatient(patient);

        expect(result.isValid).toBe(true);
      });
    });

    describe('validateObservation', () => {
      it('should accept valid observation resource', () => {
        const observation = {
          resourceType: 'Observation',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '8480-6' }] },
          subject: { reference: 'Patient/123' },
        };

        const result = FHIRValidator.validateObservation(observation);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject null observation', () => {
        const result = FHIRValidator.validateObservation(null as unknown as Record<string, unknown>);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Observation resource is required');
      });

      it('should reject wrong resource type', () => {
        const result = FHIRValidator.validateObservation({ resourceType: 'Patient' });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Resource must be of type Observation');
      });

      it('should require status', () => {
        const observation = {
          resourceType: 'Observation',
          code: {},
          subject: {},
        };

        const result = FHIRValidator.validateObservation(observation);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Observation must have status');
      });

      it('should require code', () => {
        const observation = {
          resourceType: 'Observation',
          status: 'final',
          subject: {},
        };

        const result = FHIRValidator.validateObservation(observation);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Observation must have code');
      });

      it('should require subject', () => {
        const observation = {
          resourceType: 'Observation',
          status: 'final',
          code: {},
        };

        const result = FHIRValidator.validateObservation(observation);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Observation must have subject (patient reference)');
      });
    });

    describe('validateBundle', () => {
      it('should accept valid bundle resource', () => {
        const bundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            { resource: { resourceType: 'Patient', id: '123' } },
            { resource: { resourceType: 'Observation', id: '456' } },
          ],
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject null bundle', () => {
        const result = FHIRValidator.validateBundle(null as unknown as Record<string, unknown>);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Bundle is required');
      });

      it('should reject wrong resource type', () => {
        const result = FHIRValidator.validateBundle({ resourceType: 'Patient' });

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Resource must be of type Bundle');
      });

      it('should require type', () => {
        const bundle = {
          resourceType: 'Bundle',
          entry: [],
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Bundle must have type');
      });

      it('should require entry array', () => {
        const bundle = {
          resourceType: 'Bundle',
          type: 'collection',
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Bundle must have entry array');
      });

      it('should validate each entry has resource', () => {
        const bundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [{ fullUrl: 'http://example.com/Patient/123' }],
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Entry\[0\] must have resource/);
      });

      it('should validate each resource has resourceType', () => {
        const bundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [{ resource: { id: '123' } }],
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toMatch(/Entry\[0\].resource must have resourceType/);
      });

      it('should reject oversized bundles (>10MB)', () => {
        // Create a bundle that's >10MB when stringified
        const largeEntry = { resource: { resourceType: 'Patient', data: 'x'.repeat(1024 * 1024) } };
        const bundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: Array(11).fill(largeEntry),
        };

        const result = FHIRValidator.validateBundle(bundle);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Bundle size exceeds 10MB limit');
      });
    });

    describe('sanitizeInput', () => {
      it('should remove dangerous characters from strings', () => {
        const result = FHIRValidator.sanitizeInput('test<script>alert()</script>');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
      });

      it('should trim whitespace', () => {
        const result = FHIRValidator.sanitizeInput('  test  ');
        expect(result).toBe('test');
      });

      it('should limit string length to 1000 characters', () => {
        const longString = 'x'.repeat(1500);
        const result = FHIRValidator.sanitizeInput(longString);
        expect(result.length).toBe(1000);
      });

      it('should sanitize arrays recursively', () => {
        const result = FHIRValidator.sanitizeInput(['test;', 'data<']);
        expect(result).toEqual(['test', 'data']);
      });

      it('should sanitize objects recursively', () => {
        const result = FHIRValidator.sanitizeInput({ name: 'test;', value: 'data<' });
        expect(result).toEqual({ name: 'test', value: 'data' });
      });

      it('should handle nested objects and arrays', () => {
        const input = {
          patient: {
            names: ['John;', 'Doe<'],
            age: 30,
          },
        };

        const result = FHIRValidator.sanitizeInput(input);

        expect(result).toEqual({
          patient: {
            names: ['John', 'Doe'],
            age: 30,
          },
        });
      });

      it('should pass through numbers unchanged', () => {
        const result = FHIRValidator.sanitizeInput(42);
        expect(result).toBe(42);
      });

      it('should pass through booleans unchanged', () => {
        const result = FHIRValidator.sanitizeInput(true);
        expect(result).toBe(true);
      });

      it('should pass through null unchanged', () => {
        const result = FHIRValidator.sanitizeInput(null);
        expect(result).toBe(null);
      });
    });
  });

  // ==========================================================================
  // AuditLogger Tests
  // ==========================================================================
  describe('AuditLogger', () => {
    describe('log', () => {
      it('should log audit event via RPC', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        await AuditLogger.log({
          eventType: 'FHIR_READ',
          eventCategory: 'FHIR_SYNC',
          resourceType: 'Patient',
          resourceId: '123',
          success: true,
        });

        expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', {
          p_event_type: 'FHIR_READ',
          p_event_category: 'FHIR_SYNC',
          p_resource_type: 'Patient',
          p_resource_id: '123',
          p_target_user_id: null,
          p_operation: null,
          p_metadata: {},
          p_success: true,
          p_error_message: null,
        });
      });

      it('should sanitize error messages in logs', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        await AuditLogger.log({
          eventType: 'FHIR_ERROR',
          eventCategory: 'FHIR_SYNC',
          success: false,
          errorMessage: 'Error for SSN 123-45-6789',
        });

        expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
          p_error_message: expect.stringContaining('[REDACTED]'),
        }));
      });

      it('should not throw on RPC error', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        });

        await expect(
          AuditLogger.log({
            eventType: 'TEST',
            eventCategory: 'TEST',
            success: true,
          })
        ).resolves.not.toThrow();
      });
    });

    describe('logPHIAccess', () => {
      it('should log PHI access with correct event type', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        await AuditLogger.logPHIAccess('Patient', '123', 'READ', 'user-456');

        expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
          p_event_type: 'PHI_READ',
          p_event_category: 'PHI_ACCESS',
          p_resource_type: 'Patient',
          p_resource_id: '123',
          p_target_user_id: 'user-456',
          p_operation: 'READ',
        }));
      });

      it('should support all PHI operations', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        const operations: Array<'READ' | 'WRITE' | 'UPDATE' | 'DELETE' | 'EXPORT'> = [
          'READ', 'WRITE', 'UPDATE', 'DELETE', 'EXPORT'
        ];

        for (const op of operations) {
          await AuditLogger.logPHIAccess('Patient', '123', op);
          expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
            p_event_type: `PHI_${op}`,
          }));
        }
      });
    });

    describe('logFHIROperation', () => {
      it('should log FHIR operation', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null });

        await AuditLogger.logFHIROperation('FHIR_SYNC', 'Patient', true, { count: 10 });

        expect(supabase.rpc).toHaveBeenCalledWith('log_audit_event', expect.objectContaining({
          p_event_type: 'FHIR_SYNC',
          p_event_category: 'FHIR_SYNC',
          p_resource_type: 'Patient',
          p_operation: 'FHIR_SYNC',
          p_metadata: { count: 10 },
          p_success: true,
        }));
      });
    });
  });

  // ==========================================================================
  // RateLimiter Tests
  // ==========================================================================
  describe('RateLimiter', () => {
    describe('check', () => {
      it('should return true when under rate limit', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });

        const result = await RateLimiter.check('FHIR_SYNC');

        expect(result).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith('check_rate_limit', {
          p_limit_type: 'FHIR_SYNC',
          p_threshold: 100,
          p_window_minutes: 60,
        });
      });

      it('should return false when over rate limit', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: false, error: null });

        const result = await RateLimiter.check('FHIR_EXPORT', 10, 30);

        expect(result).toBe(false);
      });

      it('should fail open (return true) on RPC error', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
          data: null,
          error: { message: 'RPC failed' },
        });

        const result = await RateLimiter.check('FHIR_SYNC');

        expect(result).toBe(true);
      });

      it('should fail open on exception', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

        const result = await RateLimiter.check('FHIR_SYNC');

        expect(result).toBe(true);
      });

      it('should support all limit types', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });

        const limitTypes: Array<'FHIR_SYNC' | 'FHIR_EXPORT' | 'API_CALL' | 'DATA_QUERY'> = [
          'FHIR_SYNC', 'FHIR_EXPORT', 'API_CALL', 'DATA_QUERY'
        ];

        for (const type of limitTypes) {
          await RateLimiter.check(type);
          expect(supabase.rpc).toHaveBeenCalledWith('check_rate_limit', expect.objectContaining({
            p_limit_type: type,
          }));
        }
      });
    });

    describe('enforce', () => {
      it('should not throw when under rate limit', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });

        await expect(RateLimiter.enforce('FHIR_SYNC')).resolves.not.toThrow();
      });

      it('should throw when over rate limit', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: false, error: null });

        await expect(RateLimiter.enforce('FHIR_EXPORT', 10, 30)).rejects.toThrow(
          'Rate limit exceeded. Maximum 10 requests per 30 minutes.'
        );
      });

      it('should log security event when rate limit exceeded', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ data: false, error: null }) // check_rate_limit
          .mockResolvedValueOnce({ data: null, error: null }); // log_security_event

        try {
          await RateLimiter.enforce('FHIR_SYNC', 100, 60);
        } catch {
          // Expected to throw
        }

        expect(supabase.rpc).toHaveBeenCalledWith('log_security_event', {
          p_event_type: 'RATE_LIMIT_EXCEEDED',
          p_severity: 'MEDIUM',
          p_description: 'Rate limit exceeded for FHIR_SYNC',
          p_metadata: {
            limit_type: 'FHIR_SYNC',
            threshold: 100,
            window_minutes: 60,
          },
        });
      });
    });
  });

  // ==========================================================================
  // SecureFHIROperations Tests
  // ==========================================================================
  describe('SecureFHIROperations', () => {
    describe('importFHIRData', () => {
      beforeEach(() => {
        // Default: rate limit not exceeded
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });
      });

      it('should successfully import valid FHIR data', async () => {
        const fhirData = {
          patient: {
            resourceType: 'Patient',
            id: '123',
            name: [{ family: 'Doe' }],
          },
        };

        const result = await SecureFHIROperations.importFHIRData('user-123', fhirData, 'conn-456');

        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should fail with validation errors for invalid patient', async () => {
        const fhirData = {
          patient: {
            resourceType: 'Patient',
            // Missing id and identifier
          },
        };

        const result = await SecureFHIROperations.importFHIRData('user-123', fhirData, 'conn-456');

        expect(result.success).toBe(false);
        expect(result.errors).toContain('Patient must have either id or identifier');
      });

      it('should fail with validation errors for invalid observations', async () => {
        const fhirData = {
          observations: [
            {
              resource: {
                resourceType: 'Observation',
                // Missing required fields
              },
            },
          ],
        };

        const result = await SecureFHIROperations.importFHIRData('user-123', fhirData, 'conn-456');

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should enforce rate limiting', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: false, error: null });

        const result = await SecureFHIROperations.importFHIRData('user-123', {}, 'conn-456');

        expect(result.success).toBe(false);
        expect(result.errors[0]).toMatch(/Rate limit exceeded/);
      });

      it('should handle exceptions gracefully', async () => {
        // First call: rate limit passes
        // Subsequent calls: throw to simulate error during audit logging
        (supabase.rpc as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ data: true, error: null }) // rate limit check
          .mockImplementation(() => {
            throw new Error('Database down');
          });

        // Provide invalid data that will fail validation after rate limit passes
        const invalidData = {
          patient: {
            resourceType: 'Patient',
            // Missing required id/identifier - will fail validation
          },
        };

        const result = await SecureFHIROperations.importFHIRData('user-123', invalidData, 'conn-456');

        // Validation failure returns success: false
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('exportFHIRData', () => {
      beforeEach(() => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });
      });

      it('should successfully export FHIR data', async () => {
        const result = await SecureFHIROperations.exportFHIRData('user-123');

        expect(result.bundle).toBeDefined();
        expect(result.error).toBeUndefined();
      });

      it('should enforce stricter rate limits for exports', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: false, error: null });

        const result = await SecureFHIROperations.exportFHIRData('user-123');

        expect(result.error).toMatch(/Rate limit exceeded/);
      });

      it('should log security event for mass export attempts', async () => {
        (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ data: true, error: null });

        await SecureFHIROperations.exportFHIRData('user-123', { includeAllPatients: true });

        expect(supabase.rpc).toHaveBeenCalledWith('log_security_event', expect.objectContaining({
          p_event_type: 'MASS_DATA_EXPORT',
          p_severity: 'HIGH',
          p_requires_investigation: true,
        }));
      });

      it('should handle rate limit exception and return sanitized error', async () => {
        // Rate limit check returns false -> enforce() throws -> caught by try/catch
        (supabase.rpc as ReturnType<typeof vi.fn>)
          .mockResolvedValueOnce({ data: false, error: null }) // rate limit exceeded
          .mockResolvedValue({ data: null, error: null }); // subsequent calls for logging

        const result = await SecureFHIROperations.exportFHIRData('user-123');

        // When rate limit is exceeded, enforce() throws and catch block returns error
        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/Rate limit exceeded/);
        expect(result.bundle).toEqual({});
      });
    });
  });
});
