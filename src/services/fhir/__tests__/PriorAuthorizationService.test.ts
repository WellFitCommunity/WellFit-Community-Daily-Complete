/**
 * Tests for FHIR PriorAuthorizationService
 *
 * CMS-0057-F Compliant Prior Authorization API
 * Tests CRUD operations, workflow, decisions, and appeals
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriorAuthorizationService } from '../PriorAuthorizationService';

// Mock getErrorMessage
vi.mock('../../../lib/getErrorMessage', () => ({
  getErrorMessage: (err: unknown) => err instanceof Error ? err.message : 'Unknown error',
}));

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

// Sample test data
const mockPriorAuth = {
  id: 'pa-123',
  patient_id: 'patient-456',
  payer_id: 'payer-789',
  payer_name: 'Blue Cross',
  member_id: 'MEM123',
  service_codes: ['99213', '99214'],
  diagnosis_codes: ['J06.9', 'R05'],
  status: 'draft',
  urgency: 'routine',
  auth_number: null,
  created_at: '2026-01-16T00:00:00Z',
  updated_at: '2026-01-16T00:00:00Z',
  tenant_id: 'tenant-001',
};

const mockSubmittedAuth = {
  ...mockPriorAuth,
  id: 'pa-submitted',
  status: 'submitted',
  auth_number: 'PA-1705363200000-ABC123',
  trace_number: 'TRN-1705363200000',
  submitted_at: '2026-01-16T10:00:00Z',
  decision_due_at: '2026-01-23T10:00:00Z',
};

const mockDecision = {
  id: 'dec-001',
  prior_auth_id: 'pa-123',
  decision_type: 'approved',
  decision_date: '2026-01-17T10:00:00Z',
  auth_number: 'AUTH-12345',
  approved_units: 10,
  tenant_id: 'tenant-001',
};

const mockAppeal = {
  id: 'appeal-001',
  prior_auth_id: 'pa-123',
  appeal_level: 1,
  status: 'draft',
  appeal_reason: 'Medical necessity documentation provided',
  tenant_id: 'tenant-001',
};

// Recursive mock chain for supabase queries (available for complex tests)
const _createMockChain = (data: unknown, error: unknown = null) => {
  const chain: ReturnType<typeof vi.fn> = vi.fn(() => ({
    data,
    error,
    eq: chain,
    in: chain,
    order: chain,
    gte: chain,
    lte: chain,
    limit: chain,
    single: vi.fn(() => ({ data, error })),
    select: vi.fn(() => ({
      data,
      error,
      single: vi.fn(() => ({ data, error })),
    })),
  }));
  return chain;
};

// Mock supabase
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('PriorAuthorizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================================================
  // CRUD Operations
  // =====================================================

  describe('create', () => {
    it('should create a new prior authorization in draft status', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockPriorAuth, error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.create({
        patient_id: 'patient-456',
        payer_id: 'payer-789',
        service_codes: ['99213', '99214'],
        diagnosis_codes: ['J06.9', 'R05'],
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('draft');
    });

    it('should return error when insert fails', async () => {
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { message: 'Insert failed' } })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.create({
        patient_id: 'patient-456',
        payer_id: 'payer-789',
        service_codes: ['99213'],
        diagnosis_codes: ['J06.9'],
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should return prior authorization by ID', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockPriorAuth, error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getById('pa-123');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('pa-123');
    });

    it('should return null when not found', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getById('pa-nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('getByAuthNumber', () => {
    it('should return prior authorization by auth number', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockSubmittedAuth, error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getByAuthNumber('PA-1705363200000-ABC123');

      expect(result.success).toBe(true);
      expect(result.data?.auth_number).toBe('PA-1705363200000-ABC123');
    });
  });

  describe('getByPatient', () => {
    it('should return all prior authorizations for a patient', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [mockPriorAuth, mockSubmittedAuth], error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getByPatient('patient-456');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getPending', () => {
    it('should return pending prior authorizations for a tenant', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => ({ data: [mockSubmittedAuth], error: null })),
            })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getPending('tenant-001');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('update', () => {
    it('should update prior authorization fields', async () => {
      const updatedAuth = { ...mockPriorAuth, clinical_notes: 'Updated notes' };
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: updatedAuth, error: null })),
            })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.update('pa-123', {
        clinical_notes: 'Updated notes',
      });

      expect(result.success).toBe(true);
      expect(result.data?.clinical_notes).toBe('Updated notes');
    });
  });

  // =====================================================
  // Workflow Operations
  // =====================================================

  describe('submit', () => {
    it('should submit prior authorization and generate auth number', async () => {
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: mockSubmittedAuth, error: null })),
            })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.submit({ id: 'pa-123' });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('submitted');
      expect(result.data?.auth_number).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should cancel prior authorization', async () => {
      const cancelledAuth = { ...mockPriorAuth, status: 'cancelled' };
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: cancelledAuth, error: null })),
            })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.cancel('pa-123', 'No longer needed');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('cancelled');
    });
  });

  // =====================================================
  // Decision Operations
  // =====================================================

  describe('recordDecision', () => {
    it('should record approval decision', async () => {
      // Mock two calls: first for insert, second for update
      mockFrom.mockImplementation((table: string) => {
        if (table === 'prior_auth_decisions') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({ data: mockDecision, error: null })),
              })),
            })),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        };
      });

      const result = await PriorAuthorizationService.recordDecision({
        prior_auth_id: 'pa-123',
        decision_type: 'approved',
        auth_number: 'AUTH-12345',
        approved_units: 10,
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(true);
      expect(result.data?.decision_type).toBe('approved');
    });

    it('should record denial decision with reason', async () => {
      const denialDecision = {
        ...mockDecision,
        decision_type: 'denied',
        denial_reason_code: 'MED_NEC',
        denial_reason_description: 'Medical necessity not met',
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'prior_auth_decisions') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({ data: denialDecision, error: null })),
              })),
            })),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        };
      });

      const result = await PriorAuthorizationService.recordDecision({
        prior_auth_id: 'pa-123',
        decision_type: 'denied',
        denial_reason_code: 'MED_NEC',
        denial_reason_description: 'Medical necessity not met',
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(true);
      expect(result.data?.decision_type).toBe('denied');
    });
  });

  describe('getDecisions', () => {
    it('should return all decisions for a prior auth', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [mockDecision], error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getDecisions('pa-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // =====================================================
  // Appeal Operations
  // =====================================================

  describe('createAppeal', () => {
    it('should create an appeal for denied prior authorization', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'prior_auth_appeals') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ data: [], error: null })),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({ data: mockAppeal, error: null })),
              })),
            })),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        };
      });

      const result = await PriorAuthorizationService.createAppeal({
        prior_auth_id: 'pa-123',
        appeal_reason: 'Medical necessity documentation provided',
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(true);
      expect(result.data?.appeal_level).toBe(1);
    });

    it('should increment appeal level for subsequent appeals', async () => {
      const existingAppeal = { appeal_level: 1 };
      const secondAppeal = { ...mockAppeal, appeal_level: 2 };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'prior_auth_appeals') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({ data: [existingAppeal], error: null })),
                })),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({ data: secondAppeal, error: null })),
              })),
            })),
          };
        }
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null })),
          })),
        };
      });

      const result = await PriorAuthorizationService.createAppeal({
        prior_auth_id: 'pa-123',
        appeal_reason: 'Second appeal with additional documentation',
        tenant_id: 'tenant-001',
      });

      expect(result.success).toBe(true);
      expect(result.data?.appeal_level).toBe(2);
    });
  });

  describe('submitAppeal', () => {
    it('should submit appeal and set deadline', async () => {
      const submittedAppeal = {
        ...mockAppeal,
        status: 'submitted',
        submitted_at: '2026-01-16T10:00:00Z',
      };

      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({ data: submittedAppeal, error: null })),
            })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.submitAppeal('appeal-001');

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('submitted');
    });
  });

  describe('getAppeals', () => {
    it('should return all appeals for a prior auth', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [mockAppeal], error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getAppeals('pa-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // =====================================================
  // Service Lines & Documents
  // =====================================================

  describe('addServiceLines', () => {
    it('should add service lines to prior authorization', async () => {
      const serviceLines = [
        { cpt_code: '99213', requested_units: 1 },
        { cpt_code: '99214', requested_units: 1 },
      ];

      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ data: serviceLines.map((l, i) => ({ ...l, id: `line-${i}`, line_number: i + 1 })), error: null })),
        })),
      });

      const result = await PriorAuthorizationService.addServiceLines(
        'pa-123',
        serviceLines,
        'tenant-001'
      );

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('getServiceLines', () => {
    it('should return service lines for prior auth', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [{ cpt_code: '99213', line_number: 1 }], error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getServiceLines('pa-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('addDocument', () => {
    it('should add document to prior authorization', async () => {
      const mockDoc = {
        id: 'doc-001',
        prior_auth_id: 'pa-123',
        document_type: 'clinical_notes',
        document_name: 'Progress Note.pdf',
      };

      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockDoc, error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.addDocument(
        'pa-123',
        { document_type: 'clinical_notes', document_name: 'Progress Note.pdf' },
        'tenant-001'
      );

      expect(result.success).toBe(true);
      expect(result.data?.document_type).toBe('clinical_notes');
    });
  });

  describe('getDocuments', () => {
    it('should return documents for prior auth', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [{ document_type: 'clinical_notes' }], error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getDocuments('pa-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // =====================================================
  // Analytics & Reporting
  // =====================================================

  describe('getStatistics', () => {
    it('should return prior auth statistics', async () => {
      const stats = {
        total_submitted: 100,
        total_approved: 80,
        total_denied: 15,
        total_pending: 5,
        approval_rate: 80.0,
        avg_response_hours: 48.5,
        sla_compliance_rate: 95.0,
        by_urgency: {},
      };

      mockRpc.mockResolvedValue({ data: [stats], error: null });

      const result = await PriorAuthorizationService.getStatistics('tenant-001');

      expect(result.success).toBe(true);
      expect(result.data?.approval_rate).toBe(80.0);
    });
  });

  describe('getApproachingDeadline', () => {
    it('should return prior auths approaching deadline', async () => {
      mockRpc.mockResolvedValue({
        data: [{ id: 'pa-123', hours_remaining: 12 }],
        error: null,
      });

      const result = await PriorAuthorizationService.getApproachingDeadline('tenant-001', 24);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('checkForClaim', () => {
    it('should check if prior auth is required for claim', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          requires_prior_auth: true,
          missing_codes: ['99213'],
        }],
        error: null,
      });

      const result = await PriorAuthorizationService.checkForClaim(
        'tenant-001',
        'patient-456',
        ['99213'],
        '2026-01-20'
      );

      expect(result.success).toBe(true);
      expect(result.data?.requires_prior_auth).toBe(true);
    });

    it('should return existing auth when codes are covered', async () => {
      mockRpc.mockResolvedValue({
        data: [{
          requires_prior_auth: false,
          existing_auth_id: 'pa-123',
          existing_auth_number: 'AUTH-12345',
          auth_status: 'approved',
          missing_codes: [],
        }],
        error: null,
      });

      const result = await PriorAuthorizationService.checkForClaim(
        'tenant-001',
        'patient-456',
        ['99213'],
        '2026-01-20'
      );

      expect(result.success).toBe(true);
      expect(result.data?.requires_prior_auth).toBe(false);
      expect(result.data?.existing_auth_number).toBe('AUTH-12345');
    });
  });

  // =====================================================
  // FHIR Resource Conversion
  // =====================================================

  describe('toFHIRClaimResource', () => {
    it('should convert prior auth to FHIR Claim resource', () => {
      const fhirClaim = PriorAuthorizationService.toFHIRClaimResource(mockPriorAuth as any);

      expect(fhirClaim.resourceType).toBe('Claim');
      expect(fhirClaim.use).toBe('preauthorization');
      expect((fhirClaim.meta as { profile?: string[] })?.profile).toContain('http://hl7.org/fhir/us/davinci-pas/StructureDefinition/profile-claim');
    });

    it('should map urgency to FHIR priority', () => {
      const urgentAuth = { ...mockPriorAuth, urgency: 'urgent' };
      const fhirClaim = PriorAuthorizationService.toFHIRClaimResource(urgentAuth as any);

      expect((fhirClaim.priority as any)?.coding?.[0]?.code).toBe('urgent');
    });

    it('should include diagnosis codes in ICD-10 format', () => {
      const fhirClaim = PriorAuthorizationService.toFHIRClaimResource(mockPriorAuth as any);

      expect(Array.isArray(fhirClaim.diagnosis)).toBe(true);
      expect((fhirClaim.diagnosis as any)?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.system).toBe('http://hl7.org/fhir/sid/icd-10-cm');
    });

    it('should include service codes as items', () => {
      const fhirClaim = PriorAuthorizationService.toFHIRClaimResource(mockPriorAuth as any);

      expect(Array.isArray(fhirClaim.item)).toBe(true);
      expect((fhirClaim.item as any)?.[0]?.productOrService?.coding?.[0]?.system).toBe('http://www.ama-assn.org/go/cpt');
    });
  });

  describe('toFHIRClaimResponseResource', () => {
    it('should convert prior auth with decision to FHIR ClaimResponse', () => {
      const approvedAuth = { ...mockPriorAuth, status: 'approved', auth_number: 'AUTH-12345' };
      const fhirResponse = PriorAuthorizationService.toFHIRClaimResponseResource(
        approvedAuth as any,
        mockDecision as any
      );

      expect(fhirResponse.resourceType).toBe('ClaimResponse');
      expect(fhirResponse.use).toBe('preauthorization');
      expect(fhirResponse.outcome).toBe('complete');
      expect(fhirResponse.preAuthRef).toBe('AUTH-12345');
    });

    it('should set outcome to error for denied auth', () => {
      const deniedDecision = { ...mockDecision, decision_type: 'denied' };
      const fhirResponse = PriorAuthorizationService.toFHIRClaimResponseResource(
        mockPriorAuth as any,
        deniedDecision as any
      );

      expect(fhirResponse.outcome).toBe('error');
    });
  });

  // =====================================================
  // Status History
  // =====================================================

  describe('getStatusHistory', () => {
    it('should return status history for prior auth', async () => {
      const history = [
        { old_status: null, new_status: 'draft', changed_at: '2026-01-15T10:00:00Z' },
        { old_status: 'draft', new_status: 'submitted', changed_at: '2026-01-16T10:00:00Z' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: history, error: null })),
          })),
        })),
      });

      const result = await PriorAuthorizationService.getStatusHistory('pa-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });
});
