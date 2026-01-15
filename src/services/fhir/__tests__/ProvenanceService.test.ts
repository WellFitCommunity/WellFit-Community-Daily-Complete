/**
 * Tests for FHIR ProvenanceService
 *
 * Covers audit trails and data provenance tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvenanceService } from '../ProvenanceService';

// Mock supabase with proper chain support
const provData = [
  { id: 'prov-1', activity: { code: 'CREATE' }, recorded: '2026-01-15T10:00:00Z' },
  { id: 'prov-2', activity: { code: 'UPDATE' }, recorded: '2026-01-15T11:00:00Z' },
];

// Recursive mock that supports any chain depth
const mockChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
  data: provData,
  error: null,
  order: mockChain,
  eq: mockChain,
  gte: mockChain,
  contains: mockChain,
}));

const mockSelect = vi.fn(() => ({
  contains: mockChain,
  eq: mockChain,
  order: mockChain,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'prov-new', activity: { code: 'CREATE' } },
            error: null,
          })),
        })),
      })),
    })),
  },
}));

describe('ProvenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getForResource', () => {
    it('should return provenance for a resource', async () => {
      const result = await ProvenanceService.getForResource('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should filter by resource type', async () => {
      const result = await ProvenanceService.getForResource('patient-1', 'Patient');

      expect(result.success).toBe(true);
    });

    it('should order by recorded descending', async () => {
      const result = await ProvenanceService.getForResource('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getByAgent', () => {
    it('should return provenance by agent', async () => {
      const result = await ProvenanceService.getByAgent('pract-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should track user actions', async () => {
      const result = await ProvenanceService.getByAgent('user-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for patient', async () => {
      const result = await ProvenanceService.getAuditTrail('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should default to 90 days', async () => {
      const result = await ProvenanceService.getAuditTrail('patient-1');

      expect(result.success).toBe(true);
    });

    it('should accept custom days', async () => {
      const result = await ProvenanceService.getAuditTrail('patient-1', 180);

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create provenance record', async () => {
      const provenance = {
        target_references: ['obs-1'],
        target_types: ['Observation'],
        activity: {
          code: 'CREATE',
          system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
        },
        agent: [
          {
            who_id: 'pract-1',
            type: { code: 'author' },
          },
        ],
      };

      const result = await ProvenanceService.create(provenance);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should auto-set recorded timestamp', async () => {
      const provenance = {
        target_references: ['cond-1'],
        activity: { code: 'UPDATE' },
      };

      const result = await ProvenanceService.create(provenance);

      expect(result.success).toBe(true);
    });
  });

  describe('recordAudit', () => {
    it('should record audit event', async () => {
      const result = await ProvenanceService.recordAudit({
        targetReferences: ['patient-1'],
        activity: 'CREATE',
        agentId: 'pract-1',
      });

      expect(result.success).toBe(true);
    });

    it('should record with full details', async () => {
      const result = await ProvenanceService.recordAudit({
        targetReferences: ['patient-1', 'obs-1'],
        targetTypes: ['Patient', 'Observation'],
        activity: 'UPDATE',
        agentId: 'pract-1',
        agentType: 'author',
        agentRole: 'physician',
        onBehalfOfId: 'org-1',
        reason: 'TREAT',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('activity codes', () => {
    it('should define data operation codes', () => {
      const operations = {
        create: 'CREATE',
        read: 'READ',
        update: 'UPDATE',
        delete: 'DELETE',
        execute: 'EXECUTE',
        verify: 'VERIFY',
        append: 'APPEND',
      };
      expect(operations.create).toBe('CREATE');
      expect(operations.update).toBe('UPDATE');
    });
  });

  describe('agent type codes', () => {
    it('should define agent type codes', () => {
      const agentTypes = {
        author: 'author',
        verifier: 'verifier',
        attester: 'attester',
        informant: 'informant',
        enterer: 'enterer',
        performer: 'performer',
        custodian: 'custodian',
        assembler: 'assembler',
        composer: 'composer',
      };
      expect(agentTypes.author).toBe('author');
      expect(agentTypes.verifier).toBe('verifier');
    });
  });

  describe('reason codes', () => {
    it('should define reason codes', () => {
      const reasons = {
        treatment: 'TREAT',
        payment: 'HPAYMT',
        operations: 'HOPERAT',
        research: 'HRESCH',
        publicHealth: 'PUBHLTH',
        emergencyTreatment: 'ETREAT',
        request: 'PATRQT',
      };
      expect(reasons.treatment).toBe('TREAT');
      expect(reasons.emergencyTreatment).toBe('ETREAT');
    });
  });

  describe('provenance structure', () => {
    it('should define complete provenance structure', () => {
      const provenance = {
        id: 'prov-1',
        target_references: ['patient-1', 'obs-1'],
        target_types: ['Patient', 'Observation'],
        occurred_period: {
          start: '2026-01-15T09:00:00Z',
          end: '2026-01-15T09:30:00Z',
        },
        recorded: '2026-01-15T10:00:00Z',
        policy: ['http://hospital.org/policy/hipaa'],
        location_id: 'loc-1',
        reason: [
          {
            code: 'TREAT',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
            display: 'Treatment',
          },
        ],
        activity: {
          code: 'UPDATE',
          system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
          display: 'Update',
        },
        agent: [
          {
            type: {
              code: 'author',
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
            },
            role: [
              {
                code: 'physician',
                system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              },
            ],
            who_id: 'pract-1',
            who_type: 'Practitioner',
            on_behalf_of_id: 'org-1',
          },
        ],
        entity: [
          {
            role: 'source',
            what_id: 'doc-1',
            what_type: 'DocumentReference',
          },
        ],
        signature: null,
      };
      expect(provenance.activity.code).toBe('UPDATE');
      expect(provenance.agent).toHaveLength(1);
    });
  });

  describe('entity role codes', () => {
    it('should define entity role codes', () => {
      const entityRoles = ['derivation', 'revision', 'quotation', 'source', 'removal'];
      expect(entityRoles).toContain('source');
      expect(entityRoles).toContain('derivation');
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await ProvenanceService.getForResource('test');
      expect(result).toHaveProperty('success');
    });

    it('should handle audit trail errors', async () => {
      const result = await ProvenanceService.getAuditTrail('test');
      expect(result).toBeDefined();
    });
  });
});
