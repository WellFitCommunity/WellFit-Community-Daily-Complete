/**
 * Tests for DatabaseAuditLogger — Guardian's DB audit writer.
 *
 * These exist because of the 2026-07-10 incident: api_failure availability
 * events were persisted as 'unauthorized_api_access' security alerts, inserts
 * carried no tenant_id, audit_logs writes silently failed RLS (no
 * actor_user_id), and every error path was an empty block.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder } from '../../../test-utils';
import type { DetectedIssue, HealingAction, HealingResult } from '../types';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: mocks.from,
    auth: { getUser: mocks.getUser },
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: { info: vi.fn(), warn: mocks.warn, error: mocks.error },
}));

vi.mock('../tenantResolver', () => ({
  resolveTenantId: vi.fn().mockResolvedValue('tenant-uuid-1'),
}));

import { DatabaseAuditLogger } from '../DatabaseAuditLogger';

const issue: DetectedIssue = {
  id: 'issue-1',
  timestamp: new Date('2026-07-23T12:00:00Z'),
  signature: {
    id: 'api-500-server-error',
    category: 'api_failure',
    pattern: /500/,
    severity: 'critical',
    description: 'Backend service failure',
    commonCauses: [],
    healingStrategies: ['retry_with_backoff'],
    estimatedImpact: {},
  },
  context: { component: 'TestComponent', environmentState: {}, recentActions: [] },
  severity: 'critical',
  affectedResources: ['https://example.test/functions/v1/mcp-postgres-server'],
  metadata: {},
};

const action: HealingAction = {
  id: 'healing-1',
  issueId: 'issue-1',
  strategy: 'retry_with_backoff',
  timestamp: new Date('2026-07-23T12:00:01Z'),
  description: 'Retry the failing call',
  steps: [],
  expectedOutcome: 'API recovers',
  requiresApproval: false,
};

const result: HealingResult = {
  actionId: 'healing-1',
  success: false,
  timestamp: new Date('2026-07-23T12:00:10Z'),
  stepsCompleted: 0,
  totalSteps: 1,
  outcomeDescription: 'Failed at step 1: retry_operation',
  metrics: { timeToDetect: 0, timeToHeal: 9000, resourcesAffected: 1, usersImpacted: 0 },
  lessons: [],
};

describe('DatabaseAuditLogger', () => {
  let logger: DatabaseAuditLogger;
  let insertedRows: Record<string, Record<string, unknown>[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new DatabaseAuditLogger();
    insertedRows = {};

    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.from.mockImplementation((table: string) => {
      const qb = createQueryBuilder({});
      qb.insert.mockImplementation((row: Record<string, unknown>) => {
        (insertedRows[table] ??= []).push(row);
        return qb;
      });
      return qb;
    });
  });

  it('persists api_failure alerts with the HONEST api_failure alert_type, never unauthorized_api_access', async () => {
    await logger.logHealingAction(issue, action, result);

    const alert = insertedRows['security_alerts']?.[0];
    expect(alert).toBeDefined();
    expect(alert.alert_type).toBe('api_failure');
    expect(alert.alert_type).not.toBe('unauthorized_api_access');
  });

  it('stamps tenant_id on security_alerts, security_events and audit_logs inserts', async () => {
    await logger.logHealingAction(issue, action, result);

    expect(insertedRows['security_alerts']?.[0]?.tenant_id).toBe('tenant-uuid-1');
    expect(insertedRows['security_events']?.[0]?.tenant_id).toBe('tenant-uuid-1');
    expect(insertedRows['audit_logs']?.[0]?.tenant_id).toBe('tenant-uuid-1');
  });

  it('sets actor_user_id on audit_logs inserts (required by the INSERT RLS policy)', async () => {
    await logger.logHealingAction(issue, action, result);

    expect(insertedRows['audit_logs']?.[0]?.actor_user_id).toBe('user-1');
  });

  it('writes blocked-action alerts with the guardian_action_blocked type and tenant', async () => {
    await logger.logBlockedAction(issue, action, 'Rate limit exceeded for retry_with_backoff');

    const alert = insertedRows['security_alerts']?.[0];
    expect(alert?.alert_type).toBe('guardian_action_blocked');
    expect(alert?.tenant_id).toBe('tenant-uuid-1');
  });

  it('logs write failures instead of swallowing them', async () => {
    mocks.from.mockImplementation(() =>
      createQueryBuilder({ error: { message: 'insert rejected' } })
    );

    await logger.logHealingAction(issue, action, result);

    expect(mocks.warn).toHaveBeenCalledWith(
      'GUARDIAN_DB_AUDIT_WRITE_FAILED',
      expect.objectContaining({ message: 'insert rejected' })
    );
  });
});
