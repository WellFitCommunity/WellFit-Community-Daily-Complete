/**
 * FHIR Bulk Data Access IG - Export Service Tests
 *
 * Tests for the $export operation (HL7 FHIR Bulk Data Access IG):
 * - requestExport creates job in pending status with correct parameters
 * - getExportStatus returns job with progress and output manifest
 * - cancelExport transitions pending/in_progress jobs to cancelled
 * - cancelExport rejects already-completed or already-cancelled jobs
 * - listExportJobs returns array filtered by status
 * - convertToNdjson produces one JSON object per line, newline-terminated
 * - convertToNdjson with empty array returns empty string
 * - generateExportOutput processes FHIR tables and builds output manifest
 * - Error handling returns failure ServiceResult (never throws)
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fhirBulkExportService,
} from '../fhirBulkExportService';
import type {
  BulkExportRequest,
  ExportStatus,
} from '../fhirBulkExportService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../../lib/supabaseClient', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123' } },
        }),
      },
    },
  };
});

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    security: vi.fn().mockResolvedValue(undefined),
    phi: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSupabase = supabase as unknown as {
  from: ReturnType<typeof vi.fn>;
  auth: { getUser: ReturnType<typeof vi.fn> };
};

function createChainableMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}

// =============================================================================
// TESTS
// =============================================================================

describe('fhirBulkExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // requestExport
  // ---------------------------------------------------------------------------
  describe('requestExport', () => {
    it('creates a bulk export job in pending status and returns job ID + status URL', async () => {
      const mockJob = {
        id: 'job-uuid-1',
        tenant_id: 'tenant-1',
        requested_by: 'test-user-123',
        status: 'pending',
        export_type: 'system',
        resource_types: ['Patient', 'Condition'],
        output_format: 'application/fhir+ndjson',
        progress_percent: 0,
        total_resources: 0,
        exported_resources: 0,
        output_files: [],
        requested_at: '2026-02-10T20:00:00Z',
      };

      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: mockJob, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const request: BulkExportRequest = {
        exportType: 'system',
        resourceTypes: ['Patient', 'Condition'],
      };

      const result = await fhirBulkExportService.requestExport(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.jobId).toBe('job-uuid-1');
        expect(result.data.statusUrl).toBe('/fhir/$export-status/job-uuid-1');
      }
      expect(mockSupabase.from).toHaveBeenCalledWith('fhir_bulk_export_jobs');
      expect(auditLogger.info).toHaveBeenCalledWith(
        'FHIR_BULK_EXPORT_REQUESTED',
        expect.objectContaining({
          jobId: 'job-uuid-1',
          exportType: 'system',
          resourceTypes: ['Patient', 'Condition'],
        })
      );
    });

    it('returns failure when no tenant context', async () => {
      const profileChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await fhirBulkExportService.requestExport({
        exportType: 'system',
        resourceTypes: ['Patient'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns failure when user is not authenticated', async () => {
      // Both getTenantId and getCurrentUserId call getUser — mock both calls
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: null } })  // getTenantId call
        .mockResolvedValueOnce({ data: { user: null } }); // getCurrentUserId call

      // getTenantId queries profiles with empty string, returns null tenant_id
      const profileChain = createChainableMock({
        data: null,
        error: null,
      });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await fhirBulkExportService.requestExport({
        exportType: 'system',
        resourceTypes: ['Patient'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns validation error when no resource types provided', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await fhirBulkExportService.requestExport({
        exportType: 'system',
        resourceTypes: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('resource type');
      }
    });

    it('returns failure on database insert error', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({
        data: null,
        error: { message: 'Insert failed' },
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await fhirBulkExportService.requestExport({
        exportType: 'patient',
        resourceTypes: ['Observation'],
        patientId: 'patient-uuid-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // getExportStatus
  // ---------------------------------------------------------------------------
  describe('getExportStatus', () => {
    it('returns job status with progress when in_progress', async () => {
      const mockJob = {
        id: 'job-uuid-2',
        status: 'in_progress',
        progress_percent: 45,
        total_resources: 100,
        exported_resources: 45,
        output_files: [],
        error_message: null,
        requested_at: '2026-02-10T20:00:00Z',
        completed_at: null,
        expires_at: null,
      };

      const chain = createChainableMock({ data: mockJob, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.getExportStatus('job-uuid-2');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.jobId).toBe('job-uuid-2');
        expect(result.data.status).toBe('in_progress');
        expect(result.data.progressPercent).toBe(45);
        expect(result.data.totalResources).toBe(100);
        expect(result.data.exportedResources).toBe(45);
      }
    });

    it('returns completed status with output manifest', async () => {
      const outputFiles = [
        { type: 'Patient', url: '/fhir/$export-output/job-3/Patient.ndjson', count: 50 },
        { type: 'Condition', url: '/fhir/$export-output/job-3/Condition.ndjson', count: 30 },
      ];

      const mockJob = {
        id: 'job-uuid-3',
        status: 'completed',
        progress_percent: 100,
        total_resources: 80,
        exported_resources: 80,
        output_files: outputFiles,
        error_message: null,
        requested_at: '2026-02-10T20:00:00Z',
        completed_at: '2026-02-10T20:05:00Z',
        expires_at: '2026-02-11T20:05:00Z',
      };

      const chain = createChainableMock({ data: mockJob, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.getExportStatus('job-uuid-3');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
        expect(result.data.output).toHaveLength(2);
        expect(result.data.output[0].type).toBe('Patient');
        expect(result.data.output[0].count).toBe(50);
        expect(result.data.completedAt).toBe('2026-02-10T20:05:00Z');
        expect(result.data.expiresAt).toBe('2026-02-11T20:05:00Z');
      }
    });

    it('returns failure when job not found', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Not found' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.getExportStatus('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // cancelExport
  // ---------------------------------------------------------------------------
  describe('cancelExport', () => {
    it('cancels a pending job and returns cancelled status', async () => {
      const fetchChain = createChainableMock({
        data: { status: 'pending' },
        error: null,
      });
      const updateChain = createChainableMock({ data: null, error: null });
      // update chain doesn't call single(), it resolves from update().eq()
      updateChain.eq.mockResolvedValue({ error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchChain : updateChain;
      });

      const result = await fhirBulkExportService.cancelExport('job-uuid-4');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.jobId).toBe('job-uuid-4');
        expect(result.data.status).toBe('cancelled');
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'FHIR_BULK_EXPORT_CANCELLED',
        expect.objectContaining({ jobId: 'job-uuid-4' })
      );
    });

    it('cancels an in_progress job', async () => {
      const fetchChain = createChainableMock({
        data: { status: 'in_progress' },
        error: null,
      });
      const updateChain = createChainableMock({ data: null, error: null });
      updateChain.eq.mockResolvedValue({ error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchChain : updateChain;
      });

      const result = await fhirBulkExportService.cancelExport('job-uuid-5');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('cancelled');
      }
    });

    it('rejects cancellation of already-completed job', async () => {
      const fetchChain = createChainableMock({
        data: { status: 'completed' },
        error: null,
      });
      mockSupabase.from.mockReturnValue(fetchChain);

      const result = await fhirBulkExportService.cancelExport('job-completed');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('completed');
      }
    });

    it('rejects cancellation of already-cancelled job', async () => {
      const fetchChain = createChainableMock({
        data: { status: 'cancelled' },
        error: null,
      });
      mockSupabase.from.mockReturnValue(fetchChain);

      const result = await fhirBulkExportService.cancelExport('job-cancelled');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('cancelled');
      }
    });

    it('returns failure when job not found', async () => {
      const fetchChain = createChainableMock({
        data: null,
        error: { message: 'Not found' },
      });
      mockSupabase.from.mockReturnValue(fetchChain);

      const result = await fhirBulkExportService.cancelExport('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // listExportJobs
  // ---------------------------------------------------------------------------
  describe('listExportJobs', () => {
    it('returns array of export jobs ordered by requested_at desc', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'completed', requested_at: '2026-02-10T20:00:00Z' },
        { id: 'job-2', status: 'pending', requested_at: '2026-02-10T19:00:00Z' },
      ];

      const chain = createChainableMock({ data: mockJobs, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.listExportJobs();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('job-1');
      }
      expect(chain.order).toHaveBeenCalledWith('requested_at', { ascending: false });
    });

    it('filters by status when provided', async () => {
      const mockJobs = [
        { id: 'job-p1', status: 'pending' },
      ];

      // Build a chain where eq returns itself, order returns itself, limit resolves
      const chain = createChainableMock({ data: mockJobs, error: null });
      // eq('status', 'pending') needs to be chainable (returns chain)
      chain.eq.mockReturnValue(chain);
      // limit is already the terminal resolver via createChainableMock
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.listExportJobs('pending' as ExportStatus);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
      expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('returns empty array when no jobs exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.listExportJobs();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'DB connection lost' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.listExportJobs();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // convertToNdjson
  // ---------------------------------------------------------------------------
  describe('convertToNdjson', () => {
    it('produces one JSON object per line with trailing newline', () => {
      const resources = [
        { resourceType: 'Patient', id: '1', name: [{ family: 'Smith' }] },
        { resourceType: 'Patient', id: '2', name: [{ family: 'Jones' }] },
      ];

      const ndjson = fhirBulkExportService.convertToNdjson(resources);

      const lines = ndjson.split('\n');
      // Last element after final \n is empty string
      expect(lines).toHaveLength(3);
      expect(lines[2]).toBe('');

      // Each non-empty line is valid JSON
      const parsed1 = JSON.parse(lines[0]) as Record<string, unknown>;
      const parsed2 = JSON.parse(lines[1]) as Record<string, unknown>;
      expect(parsed1.id).toBe('1');
      expect(parsed2.id).toBe('2');
    });

    it('returns empty string for empty array', () => {
      const ndjson = fhirBulkExportService.convertToNdjson([]);
      expect(ndjson).toBe('');
    });

    it('handles single resource correctly', () => {
      const resources = [
        { resourceType: 'Condition', id: 'c1', code: { text: 'Hypertension' } },
      ];

      const ndjson = fhirBulkExportService.convertToNdjson(resources);

      expect(ndjson).toContain('Hypertension');
      expect(ndjson.endsWith('\n')).toBe(true);

      const lines = ndjson.split('\n').filter((l) => l.length > 0);
      expect(lines).toHaveLength(1);
    });

    it('preserves nested objects and arrays in JSON serialization', () => {
      const resources = [
        {
          resourceType: 'Observation',
          id: 'obs-1',
          valueQuantity: { value: 120, unit: 'mmHg' },
          component: [
            { code: { text: 'systolic' }, valueQuantity: { value: 120 } },
            { code: { text: 'diastolic' }, valueQuantity: { value: 80 } },
          ],
        },
      ];

      const ndjson = fhirBulkExportService.convertToNdjson(resources);
      const parsed = JSON.parse(ndjson.trim()) as Record<string, unknown>;

      expect(parsed.resourceType).toBe('Observation');
      expect(
        (parsed.component as Array<Record<string, unknown>>).length
      ).toBe(2);
    });

    it('does not contain multi-line JSON (each resource is on one line)', () => {
      const resources = [
        { resourceType: 'Patient', id: '1', address: { line: ['123 Main St'], city: 'Test' } },
        { resourceType: 'Patient', id: '2', address: { line: ['456 Oak Ave'], city: 'Demo' } },
      ];

      const ndjson = fhirBulkExportService.convertToNdjson(resources);
      const nonEmptyLines = ndjson.split('\n').filter((l) => l.length > 0);

      // Exactly 2 lines, one per resource
      expect(nonEmptyLines).toHaveLength(2);

      // Each line parses independently
      for (const line of nonEmptyLines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // generateExportOutput
  // ---------------------------------------------------------------------------
  describe('generateExportOutput', () => {
    it('processes FHIR tables and builds output manifest for completed job', async () => {
      const mockJob = {
        id: 'gen-job-1',
        tenant_id: 'tenant-1',
        status: 'pending',
        export_type: 'system',
        resource_types: ['Patient'],
        since_date: null,
        patient_id: null,
        output_format: 'application/fhir+ndjson',
      };

      const mockPatients = [
        { id: 'p1', resourceType: 'Patient', name: 'Test' },
        { id: 'p2', resourceType: 'Patient', name: 'Test2' },
      ];

      // Call sequence: fetch job, update to in_progress, query fhir_patients,
      // update progress, update to completed
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Fetch job
          return createChainableMock({ data: mockJob, error: null });
        }
        if (callCount === 2) {
          // Update status to in_progress
          const chain = createChainableMock({ data: null, error: null });
          chain.eq.mockResolvedValue({ error: null });
          return chain;
        }
        if (callCount === 3) {
          // Query fhir_patients
          const chain = createChainableMock({ data: mockPatients, error: null });
          // select('*') resolves through the chain, final resolved value
          chain.select.mockResolvedValue({ data: mockPatients, error: null });
          return chain;
        }
        if (callCount === 4) {
          // Update progress
          const chain = createChainableMock({ data: null, error: null });
          chain.eq.mockResolvedValue({ error: null });
          return chain;
        }
        // Update to completed
        const completedJob = {
          ...mockJob,
          status: 'completed',
          progress_percent: 100,
          total_resources: 2,
          exported_resources: 2,
          output_files: [
            { type: 'Patient', url: '/fhir/$export-output/gen-job-1/Patient.ndjson', count: 2 },
          ],
        };
        return createChainableMock({ data: completedJob, error: null });
      });

      const result = await fhirBulkExportService.generateExportOutput('gen-job-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('completed');
      }
      expect(auditLogger.info).toHaveBeenCalledWith(
        'FHIR_BULK_EXPORT_STARTED',
        expect.objectContaining({ jobId: 'gen-job-1' })
      );
    });

    it('returns failure when job not found', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Not found' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.generateExportOutput('nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns failure when job is already cancelled', async () => {
      const chain = createChainableMock({
        data: { id: 'cancelled-job', status: 'cancelled', resource_types: ['Patient'] },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await fhirBulkExportService.generateExportOutput('cancelled-job');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('cancelled');
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('catches exceptions and returns failure results in requestExport', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected connection failure');
      });

      const result = await fhirBulkExportService.requestExport({
        exportType: 'system',
        resourceTypes: ['Patient'],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('catches exceptions and returns failure results in getExportStatus', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network timeout');
      });

      const result = await fhirBulkExportService.getExportStatus('any-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('catches exceptions and returns failure results in cancelExport', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      const result = await fhirBulkExportService.cancelExport('any-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('OPERATION_FAILED');
      }
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('logs errors via auditLogger, never console', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('DB failure');
      });

      await fhirBulkExportService.listExportJobs();

      expect(auditLogger.error).toHaveBeenCalledWith(
        'FHIR_BULK_EXPORT_LIST_FAILED',
        expect.any(Error)
      );
    });
  });
});
