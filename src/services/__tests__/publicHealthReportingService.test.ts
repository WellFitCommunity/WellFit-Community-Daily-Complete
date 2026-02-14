/**
 * Public Health Reporting Service Tests
 *
 * Tests the unified transmission monitoring service for syndromic surveillance,
 * immunization registry, and electronic case reporting.
 *
 * Deletion Test: Every test verifies actual service behavior (data normalization,
 * filtering, stats computation, retry logic). An empty stub would fail all tests.
 *
 * ONC Criteria: 170.315(f)(1), (f)(2), (f)(5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing service
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

import { publicHealthReportingService } from '../publicHealthReportingService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

const mockFromFn = supabase.from as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers — build chained Supabase query mocks
// ---------------------------------------------------------------------------

function buildSelectChain(data: unknown[], error: unknown = null) {
  const mockLimit = vi.fn().mockResolvedValue({ data, error });
  const mockOrder = vi.fn(() => ({ limit: mockLimit }));
  const mockEq = vi.fn(() => ({ order: mockOrder }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  return { select: mockSelect };
}

function buildUpdateChain(error: unknown = null) {
  const mockEqTenant = vi.fn().mockResolvedValue({ data: null, error });
  const mockEqId = vi.fn(() => ({ eq: mockEqTenant }));
  const mockUpdate = vi.fn(() => ({ eq: mockEqId }));
  return { update: mockUpdate };
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const TENANT = 'tenant-abc';

const syndromicRow = {
  id: 'syn-1',
  submission_id: 'SYN-001',
  destination: 'State PH Lab',
  destination_endpoint: 'https://phl.gov/syndromic',
  status: 'accepted',
  submission_timestamp: '2026-02-10T10:00:00Z',
  response_code: 'AA',
  response_message: 'Accepted',
  is_test: false,
};

const immunizationRow = {
  id: 'imm-1',
  submission_id: 'IMM-001',
  registry_name: 'State IIS',
  registry_endpoint: 'https://iis.gov/submit',
  status: 'error',
  submission_timestamp: '2026-02-10T09:00:00Z',
  ack_code: 'AE',
  ack_message: 'Invalid patient ID',
  is_test: true,
  patient_id: 'patient-123',
};

const ecrRow = {
  id: 'ecr-1',
  submission_id: 'ECR-001',
  destination_name: 'CDC AIMS',
  destination_endpoint: 'https://aims.cdc.gov/ecr',
  status: 'pending',
  submission_timestamp: '2026-02-10T08:00:00Z',
  response_code: null,
  response_message: null,
  is_test: false,
};

// ---------------------------------------------------------------------------
// getTransmissions tests
// ---------------------------------------------------------------------------

describe('publicHealthReportingService.getTransmissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized unified data from all 3 tables', async () => {
    mockFromFn
      .mockReturnValueOnce(buildSelectChain([syndromicRow]))
      .mockReturnValueOnce(buildSelectChain([immunizationRow]))
      .mockReturnValueOnce(buildSelectChain([ecrRow]));

    const result = await publicHealthReportingService.getTransmissions(TENANT);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(3);

    // Verify sorted by timestamp descending (syndromic 10:00 > immunization 09:00 > ecr 08:00)
    expect(result.data[0].type).toBe('syndromic');
    expect(result.data[0].submissionId).toBe('SYN-001');
    expect(result.data[0].destination).toBe('State PH Lab');
    expect(result.data[0].status).toBe('accepted');

    expect(result.data[1].type).toBe('immunization');
    expect(result.data[1].patientId).toBe('patient-123');
    expect(result.data[1].isTest).toBe(true);
    expect(result.data[1].errorDetails).toBe('Invalid patient ID');

    expect(result.data[2].type).toBe('ecr');
    expect(result.data[2].status).toBe('pending');
    expect(result.data[2].responseCode).toBeNull();
  });

  it('with type filter only queries the matching table', async () => {
    mockFromFn.mockReturnValueOnce(buildSelectChain([syndromicRow]));

    const result = await publicHealthReportingService.getTransmissions(TENANT, {
      type: 'syndromic',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('syndromic');
    // Only 1 call to supabase.from (not 3)
    expect(mockFromFn).toHaveBeenCalledTimes(1);
    expect(mockFromFn).toHaveBeenCalledWith('syndromic_surveillance_transmissions');
  });

  it('with status filter only returns transmissions matching that status', async () => {
    mockFromFn
      .mockReturnValueOnce(buildSelectChain([syndromicRow]))   // accepted
      .mockReturnValueOnce(buildSelectChain([immunizationRow])) // error
      .mockReturnValueOnce(buildSelectChain([ecrRow]));         // pending

    const result = await publicHealthReportingService.getTransmissions(TENANT, {
      status: 'error',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Only the immunization row has status 'error'
    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('immunization');
    expect(result.data[0].status).toBe('error');
  });

  it('normalizes "failed" status to "error"', async () => {
    const failedRow = { ...syndromicRow, status: 'failed' };
    mockFromFn
      .mockReturnValueOnce(buildSelectChain([failedRow]))
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await publicHealthReportingService.getTransmissions(TENANT);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data[0].status).toBe('error');
  });

  it('returns failure and logs on exception', async () => {
    mockFromFn.mockImplementation(() => {
      throw new Error('Network failure');
    });

    const result = await publicHealthReportingService.getTransmissions(TENANT);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toBe('Failed to fetch transmissions');
    expect(auditLogger.error).toHaveBeenCalledWith(
      'PUBLIC_HEALTH_TRANSMISSIONS_FETCH_FAILED',
      expect.any(Error),
      expect.objectContaining({ tenantId: TENANT })
    );
  });
});

// ---------------------------------------------------------------------------
// getStats tests
// ---------------------------------------------------------------------------

describe('publicHealthReportingService.getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes correct totals, success, pending, errors, and byType counts', async () => {
    const submitted = { ...syndromicRow, id: 'syn-2', status: 'submitted', submission_timestamp: '2026-02-10T11:00:00Z' };
    const rejected = { ...ecrRow, id: 'ecr-2', status: 'rejected', submission_timestamp: '2026-02-10T07:00:00Z' };

    mockFromFn
      .mockReturnValueOnce(buildSelectChain([syndromicRow, submitted]))  // syndromic: 1 accepted, 1 submitted
      .mockReturnValueOnce(buildSelectChain([immunizationRow]))           // immunization: 1 error
      .mockReturnValueOnce(buildSelectChain([ecrRow, rejected]));         // ecr: 1 pending, 1 rejected

    const result = await publicHealthReportingService.getStats(TENANT);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const stats = result.data;
    expect(stats.total).toBe(5);
    // success = accepted + submitted = 2 (syndromic accepted + syndromic submitted)
    expect(stats.success).toBe(2);
    // pending = 1 (ecr pending)
    expect(stats.pending).toBe(1);
    // errors = error + rejected = 2 (immunization error + ecr rejected)
    expect(stats.errors).toBe(2);

    // byType
    expect(stats.byType.syndromic.total).toBe(2);
    expect(stats.byType.syndromic.success).toBe(2);
    expect(stats.byType.syndromic.error).toBe(0);

    expect(stats.byType.immunization.total).toBe(1);
    expect(stats.byType.immunization.success).toBe(0);
    expect(stats.byType.immunization.error).toBe(1);

    expect(stats.byType.ecr.total).toBe(2);
    expect(stats.byType.ecr.success).toBe(0);
    expect(stats.byType.ecr.error).toBe(1);
  });

  it('returns all-zero stats when no transmissions exist', async () => {
    mockFromFn
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]))
      .mockReturnValueOnce(buildSelectChain([]));

    const result = await publicHealthReportingService.getStats(TENANT);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.total).toBe(0);
    expect(result.data.success).toBe(0);
    expect(result.data.pending).toBe(0);
    expect(result.data.errors).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// retryTransmission tests
// ---------------------------------------------------------------------------

describe('publicHealthReportingService.retryTransmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls update with status pending on the correct table', async () => {
    const chain = buildUpdateChain(null);
    mockFromFn.mockReturnValueOnce(chain);

    const result = await publicHealthReportingService.retryTransmission(
      'imm-1',
      'immunization',
      TENANT
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.retried).toBe(true);

    expect(mockFromFn).toHaveBeenCalledWith('immunization_registry_submissions');
    expect(chain.update).toHaveBeenCalledWith({ status: 'pending' });
    expect(auditLogger.info).toHaveBeenCalledWith(
      'PUBLIC_HEALTH_TRANSMISSION_RETRIED',
      expect.objectContaining({ id: 'imm-1', type: 'immunization', tenantId: TENANT })
    );
  });

  it('selects correct table name for each type', async () => {
    // Test syndromic
    mockFromFn.mockReturnValueOnce(buildUpdateChain(null));
    await publicHealthReportingService.retryTransmission('syn-1', 'syndromic', TENANT);
    expect(mockFromFn).toHaveBeenCalledWith('syndromic_surveillance_transmissions');

    // Test ecr
    mockFromFn.mockReturnValueOnce(buildUpdateChain(null));
    await publicHealthReportingService.retryTransmission('ecr-1', 'ecr', TENANT);
    expect(mockFromFn).toHaveBeenCalledWith('ecr_submissions');
  });

  it('returns failure on database error', async () => {
    const dbError = { message: 'Row not found', code: 'PGRST116' };
    mockFromFn.mockReturnValueOnce(buildUpdateChain(dbError));

    const result = await publicHealthReportingService.retryTransmission(
      'bad-id',
      'syndromic',
      TENANT
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe('DATABASE_ERROR');
    expect(result.error.message).toBe('Row not found');
    expect(auditLogger.error).toHaveBeenCalledWith(
      'PUBLIC_HEALTH_RETRY_FAILED',
      dbError,
      expect.objectContaining({ id: 'bad-id' })
    );
  });

  it('returns failure and logs on thrown exception', async () => {
    mockFromFn.mockImplementation(() => {
      throw new Error('Connection timeout');
    });

    const result = await publicHealthReportingService.retryTransmission(
      'syn-1',
      'syndromic',
      TENANT
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toBe('Failed to retry transmission');
    expect(auditLogger.error).toHaveBeenCalledWith(
      'PUBLIC_HEALTH_RETRY_ERROR',
      expect.any(Error),
      expect.objectContaining({ id: 'syn-1' })
    );
  });
});
