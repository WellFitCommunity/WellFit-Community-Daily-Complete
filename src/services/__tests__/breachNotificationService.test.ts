/**
 * Breach Notification Service Tests
 *
 * Tests for HIPAA breach incident management (45 CFR 164.400-414):
 * - Incident reporting with audit logging
 * - Incident listing returns ordered array
 * - Risk assessment updates incident status
 * - Notification plan calculates 60-day deadline and media threshold at 500+
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportBreach,
  listBreachIncidents,
  assessBreachRisk,
  generateNotificationPlan,
} from '../breachNotificationService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

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
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

describe('breachNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reportBreach', () => {
    it('returns success with incident data when insert succeeds', async () => {
      const mockIncident = {
        id: 'breach-1',
        title: 'Laptop Theft',
        severity: 'high',
        individuals_affected: 150,
        status: 'reported',
      };

      // First call: profiles (getTenantId), second call: breach_incidents
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const insertChain = createChainableMock({ data: mockIncident, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? profileChain : insertChain;
      });

      const result = await reportBreach({
        title: 'Laptop Theft',
        description: 'Unencrypted laptop stolen from office',
        breach_type: 'theft',
        severity: 'high',
        phi_types_involved: ['SSN', 'DOB'],
        individuals_affected: 150,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Laptop Theft');
        expect(result.data.severity).toBe('high');
        expect(result.data.individuals_affected).toBe(150);
      }
      expect(auditLogger.security).toHaveBeenCalledWith(
        'BREACH_INCIDENT_REPORTED',
        'critical',
        expect.objectContaining({ severity: 'high', affectedCount: 150 })
      );
    });

    it('returns failure when no tenant context', async () => {
      const profileChain = createChainableMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(profileChain);

      const result = await reportBreach({
        title: 'Test',
        description: 'test',
        breach_type: 'other',
        severity: 'low',
        phi_types_involved: [],
        individuals_affected: 0,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('listBreachIncidents', () => {
    it('returns array of incidents ordered by discovered date', async () => {
      const mockIncidents = [
        { id: 'b-1', title: 'Recent Breach', discovered_date: '2026-02-01' },
        { id: 'b-2', title: 'Older Breach', discovered_date: '2026-01-15' },
      ];

      const chain = createChainableMock({ data: mockIncidents, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBreachIncidents();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].title).toBe('Recent Breach');
        expect(result.data[1].title).toBe('Older Breach');
      }
      expect(chain.order).toHaveBeenCalledWith('discovered_date', { ascending: false });
    });

    it('returns empty array when no incidents exist', async () => {
      const chain = createChainableMock({ data: [], error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBreachIncidents();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('returns failure on database error', async () => {
      const chain = createChainableMock({
        data: null,
        error: { message: 'Connection refused' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await listBreachIncidents();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  describe('assessBreachRisk', () => {
    it('updates incident status to notification_required when risk is high', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const assessmentChain = createChainableMock({ data: null, error: null });
      // assessmentChain insert returns no error; update chain for breach_incidents
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain; // profiles
        if (callCount === 2) return assessmentChain; // breach_risk_assessments insert
        return updateChain; // breach_incidents update
      });

      // Override insert to resolve directly (no .select().single())
      assessmentChain.insert.mockResolvedValue({ error: null });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await assessBreachRisk({
        breach_incident_id: 'breach-1',
        factor_1_nature_of_phi: { ssn: true },
        factor_2_unauthorized_person: { known: false },
        factor_3_acquired_or_viewed: { viewed: true },
        factor_4_mitigation: { encryption: false },
        overall_risk_level: 'notification_required',
        rationale: 'Sensitive PHI with no mitigation',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.riskLevel).toBe('notification_required');
      }
      expect(auditLogger.security).toHaveBeenCalledWith(
        'BREACH_RISK_ASSESSED',
        'high',
        expect.objectContaining({
          incidentId: 'breach-1',
          riskLevel: 'notification_required',
        })
      );
    });

    it('updates incident status to closed_no_notification for low probability', async () => {
      const profileChain = createChainableMock({
        data: { tenant_id: 'tenant-1' },
        error: null,
      });
      const assessmentChain = createChainableMock({ data: null, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return profileChain;
        if (callCount === 2) return assessmentChain;
        return updateChain;
      });

      assessmentChain.insert.mockResolvedValue({ error: null });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await assessBreachRisk({
        breach_incident_id: 'breach-2',
        factor_1_nature_of_phi: { name_only: true },
        factor_2_unauthorized_person: { known: true },
        factor_3_acquired_or_viewed: { not_viewed: true },
        factor_4_mitigation: { encryption: true },
        overall_risk_level: 'low_probability',
        rationale: 'Data was encrypted and not accessed',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.riskLevel).toBe('low_probability');
      }
    });
  });

  describe('generateNotificationPlan', () => {
    it('calculates 60-day deadline from discovered date', async () => {
      const discoveredDate = '2026-01-10T00:00:00.000Z';
      const mockIncident = {
        id: 'breach-1',
        discovered_date: discoveredDate,
        individuals_affected: 100,
      };

      const getChain = createChainableMock({ data: mockIncident, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain; // getBreachIncident
        return updateChain; // update notification plan
      });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await generateNotificationPlan('breach-1');

      expect(result.success).toBe(true);
      if (result.success) {
        const deadlineDate = new Date(result.data.deadline);
        const discoveredPlusSixty = new Date(discoveredDate);
        discoveredPlusSixty.setDate(discoveredPlusSixty.getDate() + 60);
        expect(deadlineDate.toISOString().split('T')[0]).toBe(
          discoveredPlusSixty.toISOString().split('T')[0]
        );
      }
    });

    it('requires media notification when 500+ individuals affected', async () => {
      const mockIncident = {
        id: 'breach-big',
        discovered_date: '2026-02-01T00:00:00.000Z',
        individuals_affected: 750,
      };

      const getChain = createChainableMock({ data: mockIncident, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain;
        return updateChain;
      });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await generateNotificationPlan('breach-big');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.media_notification_needed).toBe(true);
        expect(result.data.individuals_affected).toBe(750);
      }
    });

    it('does not require media notification when under 500 individuals', async () => {
      const mockIncident = {
        id: 'breach-small',
        discovered_date: '2026-02-01T00:00:00.000Z',
        individuals_affected: 499,
      };

      const getChain = createChainableMock({ data: mockIncident, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain;
        return updateChain;
      });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await generateNotificationPlan('breach-small');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.media_notification_needed).toBe(false);
      }
    });

    it('always requires individual and HHS notifications', async () => {
      const mockIncident = {
        id: 'breach-any',
        discovered_date: '2026-02-01T00:00:00.000Z',
        individuals_affected: 1,
      };

      const getChain = createChainableMock({ data: mockIncident, error: null });
      const updateChain = createChainableMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getChain;
        return updateChain;
      });
      updateChain.update.mockReturnValue(updateChain);
      updateChain.eq.mockResolvedValue({ error: null });

      const result = await generateNotificationPlan('breach-any');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.individual_notifications_needed).toBe(true);
        expect(result.data.hhs_notification_needed).toBe(true);
      }
    });
  });
});
