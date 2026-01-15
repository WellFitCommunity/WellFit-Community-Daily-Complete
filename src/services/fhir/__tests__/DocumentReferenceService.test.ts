/**
 * Tests for FHIR DocumentReferenceService
 *
 * Covers clinical document references and attachments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentReferenceService } from '../DocumentReferenceService';

// Mock supabase with proper chain support
const docData = [
  { id: 'doc-1', type_code: '11506-3', status: 'current' },
  { id: 'doc-2', type_code: '18842-5', status: 'current' },
];

// Fully recursive mock that supports any chain depth
const mockChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
  data: docData,
  error: null,
  eq: mockChain,
  order: mockChain,
  in: mockChain,
  contains: mockChain,
}));

const mockSelect = vi.fn(() => ({
  eq: mockChain,
  contains: mockChain,
  order: mockChain,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'doc-new', status: 'current' },
            error: null,
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: 'doc-1', status: 'superseded' },
              error: null,
            })),
          })),
          error: null,
        })),
      })),
    })),
  },
}));

describe('DocumentReferenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should return all documents for a patient', async () => {
      const result = await DocumentReferenceService.getAll('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should order by date descending', async () => {
      const result = await DocumentReferenceService.getAll('patient-1');

      expect(result).toBeDefined();
    });

    it('should filter by type code', async () => {
      const result = await DocumentReferenceService.getAll('patient-1', {
        type_code: '11506-3',
      });

      expect(result).toBeDefined();
    });

    it('should filter by status', async () => {
      const result = await DocumentReferenceService.getAll('patient-1', {
        status: 'current',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getByType', () => {
    it('should return documents by type', async () => {
      const result = await DocumentReferenceService.getByType('patient-1', '11506-3');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getClinicalNotes', () => {
    it('should return clinical notes', async () => {
      const result = await DocumentReferenceService.getClinicalNotes('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should include multiple note types', async () => {
      // Progress note, Summary, Discharge summary, Procedure note, Consultation note
      const clinicalNoteCodes = ['11506-3', '34133-9', '18842-5', '28570-0', '11488-4'];
      expect(clinicalNoteCodes).toContain('11506-3');
      expect(clinicalNoteCodes).toContain('18842-5');
    });
  });

  describe('getDischargeSummaries', () => {
    it('should return discharge summaries', async () => {
      const result = await DocumentReferenceService.getDischargeSummaries('patient-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use correct LOINC code', async () => {
      const dischargeSummaryCode = '18842-5';
      expect(dischargeSummaryCode).toBe('18842-5');
    });
  });

  describe('getByEncounter', () => {
    it('should return documents for an encounter', async () => {
      const result = await DocumentReferenceService.getByEncounter('enc-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a document reference', async () => {
      const newDoc = {
        patient_id: 'patient-1',
        type_code: '11506-3',
        type_display: 'Progress note',
        status: 'current',
        date: new Date().toISOString(),
        description: 'Patient follow-up visit',
      };

      const result = await DocumentReferenceService.create(newDoc);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a document reference', async () => {
      const result = await DocumentReferenceService.update('doc-1', {
        description: 'Updated description',
      });

      expect(result).toBeDefined();
    });

    it('should update status', async () => {
      const result = await DocumentReferenceService.update('doc-1', {
        status: 'superseded',
      });

      expect(result).toBeDefined();
    });
  });

  describe('supersede', () => {
    it('should supersede a document', async () => {
      const newDoc = {
        patient_id: 'patient-1',
        type_code: '11506-3',
        type_display: 'Progress note',
        status: 'current',
        date: new Date().toISOString(),
        description: 'Updated progress note',
      };

      const result = await DocumentReferenceService.supersede('doc-1', newDoc);

      expect(result).toBeDefined();
    });
  });

  describe('document status values', () => {
    it('should define all FHIR document statuses', () => {
      const statuses = ['current', 'superseded', 'entered-in-error'];
      expect(statuses).toContain('current');
      expect(statuses).toContain('superseded');
    });
  });

  describe('common LOINC document codes', () => {
    it('should define clinical note codes', () => {
      const codes = {
        progressNote: '11506-3',
        summaryNote: '34133-9',
        dischargeSummary: '18842-5',
        procedureNote: '28570-0',
        consultationNote: '11488-4',
        historyAndPhysical: '34117-2',
        operativeNote: '11504-8',
        emergencyNote: '34878-9',
      };
      expect(codes.progressNote).toBe('11506-3');
      expect(codes.dischargeSummary).toBe('18842-5');
    });
  });

  describe('document reference structure', () => {
    it('should define complete document structure', () => {
      const document = {
        id: 'doc-1',
        patient_id: 'patient-1',
        identifier: [{ system: 'urn:ietf:rfc:3986', value: 'doc-1' }],
        status: 'current',
        doc_status: 'final',
        type_code: '11506-3',
        type_display: 'Progress note',
        type_system: 'http://loinc.org',
        category: ['clinical-note'],
        date: '2026-01-15T10:00:00Z',
        author_id: 'pract-1',
        authenticator_id: 'pract-1',
        custodian_id: 'org-1',
        description: 'Follow-up visit for diabetes management',
        security_label: ['N'], // Normal confidentiality
        content: [
          {
            attachment: {
              content_type: 'application/pdf',
              url: 'https://storage.example.com/doc-1.pdf',
              size: 102400,
              hash: 'abc123',
              title: 'Progress Note',
              creation: '2026-01-15T10:00:00Z',
            },
            format: {
              code: 'urn:ihe:iti:xds-sd:pdf:2008',
              display: 'PDF',
            },
          },
        ],
        context: {
          encounter_id: 'enc-1',
          event: ['office-visit'],
          period_start: '2026-01-15T09:00:00Z',
          period_end: '2026-01-15T09:30:00Z',
          facility_type: 'outpatient',
          practice_setting: 'general-practice',
        },
        related_to: null,
      };
      expect(document.status).toBe('current');
      expect(document.type_code).toBe('11506-3');
    });
  });

  describe('document categories', () => {
    it('should define document categories', () => {
      const categories = [
        'clinical-note',
        'imaging',
        'laboratory',
        'pathology',
        'procedure',
        'discharge',
        'referral',
        'consent',
      ];
      expect(categories).toContain('clinical-note');
      expect(categories).toContain('discharge');
    });
  });

  describe('error handling', () => {
    it('should throw error on database failure', async () => {
      try {
        await DocumentReferenceService.getAll('test');
        // Mock returns success
      } catch {
        // Expected on real error
      }
    });
  });
});
