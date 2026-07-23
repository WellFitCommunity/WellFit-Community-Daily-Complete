/**
 * Tests for guardianTelemetrySink — guardian_telemetry persistence.
 *
 * These exist because the old writer hardcoded tenant 'wellfit-primary', which
 * the table's RLS (tenant_id = get_current_tenant_id()::text) rejects for every
 * non-super-admin session — telemetry was dead from 2026-07-10.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder } from '../../../test-utils';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  resolveTenantId: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: mocks.from },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: { info: mocks.info, warn: mocks.warn, error: vi.fn() },
}));

vi.mock('../tenantResolver', () => ({
  resolveTenantId: mocks.resolveTenantId,
  getCachedTenantId: vi.fn().mockReturnValue(null),
}));

import { persistTelemetryEntry } from '../guardianTelemetrySink';
import type { AuditLogEntry } from '../AuditLogger';

const entry: AuditLogEntry = {
  id: 'audit-1',
  timestamp: new Date('2026-07-23T12:00:00.000Z'),
  tenant: 'unresolved',
  module: 'TestModule',
  errorCode: 'test_category',
  action: 'test_strategy',
  validationResult: 'success',
  reason: 'test',
  issueId: 'issue-1',
  actionId: 'action-1',
  severity: 'high',
  affectedResources: ['component:Test'],
  environment: 'development',
  userAgent: 'vitest',
  metadata: {},
} as AuditLogEntry;

describe('guardianTelemetrySink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveTenantId.mockResolvedValue('tenant-uuid-1');
    mocks.from.mockReturnValue(createQueryBuilder({}));
  });

  it('persists to guardian_telemetry with the RESOLVED tenant, not the entry slug', async () => {
    const qb = createQueryBuilder({});
    mocks.from.mockReturnValue(qb);

    await persistTelemetryEntry(entry);

    expect(mocks.from).toHaveBeenCalledWith('guardian_telemetry');
    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'audit_log',
        severity: 'high',
        module: 'TestModule',
        tenant_id: 'tenant-uuid-1',
      })
    );
  });

  it('falls back to the entry tenant only when resolution returns null', async () => {
    mocks.resolveTenantId.mockResolvedValue(null);
    const qb = createQueryBuilder({});
    mocks.from.mockReturnValue(qb);

    await persistTelemetryEntry(entry);

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'unresolved' })
    );
  });

  it('logs insert failures instead of swallowing them', async () => {
    mocks.from.mockReturnValue(createQueryBuilder({ error: { message: 'rls rejected' } }));

    await persistTelemetryEntry(entry);

    expect(mocks.warn).toHaveBeenCalledWith(
      'GUARDIAN_TELEMETRY_FAILED',
      expect.objectContaining({ audit_id: 'audit-1', error: 'rls rejected' })
    );
  });

  it('passes allowlisted metadata keys through to the telemetry event', async () => {
    const qb = createQueryBuilder({});
    mocks.from.mockReturnValue(qb);

    await persistTelemetryEntry({
      ...entry,
      metadata: { stepsCompleted: 3, totalSteps: 5, blockReason: 'safety constraint' },
    });

    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_data: expect.objectContaining({
          stepsCompleted: 3,
          totalSteps: 5,
          blockReason: 'safety constraint',
        }),
      })
    );
    expect(mocks.warn).not.toHaveBeenCalled();
  });

  it('drops non-allowlisted metadata keys and logs only the key names', async () => {
    const qb = createQueryBuilder({});
    mocks.from.mockReturnValue(qb);

    await persistTelemetryEntry({
      ...entry,
      metadata: {
        stepsCompleted: 3,
        rawError: 'Patient Test Alpha (DOB 2000-01-01) failed lookup',
        databaseQuery: "SELECT dob FROM profiles WHERE user_id = 'x'",
      },
    });

    const inserted = qb.insert.mock.calls[0][0] as {
      event_data: Record<string, unknown>;
    };
    expect(inserted.event_data.stepsCompleted).toBe(3);
    expect(inserted.event_data).not.toHaveProperty('rawError');
    expect(inserted.event_data).not.toHaveProperty('databaseQuery');
    expect(JSON.stringify(inserted)).not.toContain('Test Alpha');

    expect(mocks.warn).toHaveBeenCalledWith(
      'GUARDIAN_TELEMETRY_METADATA_DROPPED',
      expect.objectContaining({
        audit_id: 'audit-1',
        dropped_keys: ['rawError', 'databaseQuery'],
      })
    );
    // The warn must carry key names only, never the refused values
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain('Test Alpha');
  });
});
