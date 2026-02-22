/**
 * Tests for PatientContextService orchestrator
 *
 * Verifies:
 * - getPatientContext assembles all sections and metadata
 * - Options control which sections are fetched
 * - getMinimalContext skips all optional sections
 * - getFullContext includes all sections
 * - patientExists returns boolean
 * - NOT_FOUND returned when demographics fail
 * - context_meta includes data_sources, warnings, request_id
 * - PHI access is audit-logged
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock CareTeamService
vi.mock('../../fhir/CareTeamService', () => ({
  CareTeamService: {
    getActive: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getActiveMembers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

// Mock ObservationService
vi.mock('../../fhir/ObservationService', () => ({
  ObservationService: {
    getVitalSigns: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}));

// Mock EncounterService
vi.mock('../../fhir/EncounterService', () => ({
  EncounterService: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

import { PatientContextService } from '../PatientContextService';
import { supabase } from '../../../lib/supabaseClient';
import { auditLogger } from '../../auditLogger';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const PATIENT_ID = 'patient-test-001';

const mockProfile = {
  user_id: PATIENT_ID,
  first_name: 'John',
  last_name: 'Doe',
  dob: '1952-03-15',
  gender: 'male',
  phone: '555-1234',
  preferred_language: 'en',
  enrollment_type: 'hospital',
  tenant_id: 'tenant-001',
  mrn: 'MRN-12345',
};

/**
 * Set up Supabase mock to return profile for demographics
 * and empty results for all other tables
 */
function setupDefaultMocks(profileData: unknown = mockProfile) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
          }),
        }),
      };
    }

    if (table === 'caregiver_access') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }

    if (table === 'emergency_contacts') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }

    if (table === 'check_ins') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'care_team_alerts') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      };
    }

    if (table === 'patient_risk_registry') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116', message: 'Not found' },
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'patient_admissions') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      };
    }

    if (table === 'care_coordination_plans') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'Not found' },
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === 'self_reports') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }

    // Fallback
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
  });
}

describe('PatientContextService', () => {
  let service: PatientContextService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientContextService();
  });

  describe('getPatientContext', () => {
    it('returns demographics for a valid patient', async () => {
      setupDefaultMocks();

      const result = await service.getPatientContext(PATIENT_ID, {
        includeContacts: false,
        includeTimeline: false,
        includeRisk: false,
        includeCarePlan: false,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.demographics.patient_id).toBe(PATIENT_ID);
      expect(result.data.demographics.first_name).toBe('John');
      expect(result.data.demographics.last_name).toBe('Doe');
      expect(result.data.demographics.mrn).toBe('MRN-12345');
    });

    it('returns NOT_FOUND when patient does not exist', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      }));

      const result = await service.getPatientContext('nonexistent-id');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('includes context_meta with request_id and data_sources', async () => {
      setupDefaultMocks();

      const result = await service.getPatientContext(PATIENT_ID, {
        includeContacts: false,
        includeTimeline: false,
        includeRisk: false,
        includeCarePlan: false,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      const meta = result.data.context_meta;
      expect(meta.request_id).toMatch(/^pctx_/);
      expect(meta.data_sources.length).toBeGreaterThanOrEqual(1);
      expect(meta.generated_at).toBeTruthy();
      expect(meta.fetch_duration_ms).toBeGreaterThanOrEqual(0);
      expect(meta.data_freshness).toBe('real_time');
    });

    it('logs PHI access via auditLogger', async () => {
      setupDefaultMocks();

      await service.getPatientContext(PATIENT_ID, {
        includeContacts: false,
        includeTimeline: false,
        includeRisk: false,
        includeCarePlan: false,
      });

      expect(auditLogger.phi).toHaveBeenCalledWith(
        'READ',
        PATIENT_ID,
        expect.objectContaining({
          resourceType: 'patient_context',
        })
      );
    });

    it('skips optional sections when options are false', async () => {
      setupDefaultMocks();

      const result = await service.getPatientContext(PATIENT_ID, {
        includeContacts: false,
        includeTimeline: false,
        includeRisk: false,
        includeCarePlan: false,
        includeHospitalDetails: false,
        includeSelfReports: false,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.contacts).toBeNull();
      expect(result.data.timeline).toBeNull();
      expect(result.data.risk).toBeNull();
      expect(result.data.care_plan).toBeNull();
      expect(result.data.hospital_details).toBeNull();
      expect(result.data.self_reports).toBeNull();
    });

    it('includes all sections with default options', async () => {
      setupDefaultMocks();

      const result = await service.getPatientContext(PATIENT_ID);

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Default options include contacts, timeline, risk, care_plan (not hospital_details)
      expect(result.data.contacts).not.toBeNull();
      expect(result.data.timeline).not.toBeNull();
      expect(result.data.risk).not.toBeNull();
      expect(result.data.care_plan).not.toBeNull();
      expect(result.data.hospital_details).toBeNull(); // opt-in only
    });
  });

  describe('getMinimalContext', () => {
    it('returns only demographics, no optional sections', async () => {
      setupDefaultMocks();

      const result = await service.getMinimalContext(PATIENT_ID);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.demographics.patient_id).toBe(PATIENT_ID);
      expect(result.data.contacts).toBeNull();
      expect(result.data.timeline).toBeNull();
      expect(result.data.risk).toBeNull();
      expect(result.data.care_plan).toBeNull();
      expect(result.data.hospital_details).toBeNull();
      expect(result.data.self_reports).toBeNull();
    });
  });

  describe('getFullContext', () => {
    it('includes all sections including hospital details', async () => {
      setupDefaultMocks();

      const result = await service.getFullContext(PATIENT_ID);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.contacts).not.toBeNull();
      expect(result.data.timeline).not.toBeNull();
      expect(result.data.risk).not.toBeNull();
      expect(result.data.care_plan).not.toBeNull();
      expect(result.data.hospital_details).not.toBeNull();
    });
  });

  describe('getBatchDemographics', () => {
    it('returns demographics map for multiple patients', async () => {
      const profile2 = { ...mockProfile, user_id: 'patient-test-002', first_name: 'Jane' };

      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [mockProfile, profile2],
            error: null,
          }),
        }),
      }));

      const result = await service.getBatchDemographics([PATIENT_ID, 'patient-test-002']);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.size).toBe(2);
      expect(result.data.get(PATIENT_ID)?.first_name).toBe('John');
      expect(result.data.get('patient-test-002')?.first_name).toBe('Jane');
    });

    it('returns empty map for empty input', async () => {
      const result = await service.getBatchDemographics([]);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.size).toBe(0);
    });

    it('rejects batch size over 500', async () => {
      const bigBatch = Array.from({ length: 501 }, (_, i) => `patient-${i}`);

      const result = await service.getBatchDemographics(bigBatch);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('handles database errors gracefully', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection refused' },
          }),
        }),
      }));

      const result = await service.getBatchDemographics([PATIENT_ID]);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.code).toBe('DATABASE_ERROR');
    });

    it('logs PHI access for batch operations', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [mockProfile],
            error: null,
          }),
        }),
      }));

      await service.getBatchDemographics([PATIENT_ID]);

      expect(auditLogger.phi).toHaveBeenCalledWith(
        'READ',
        'batch',
        expect.objectContaining({
          resourceType: 'patient_demographics_batch',
          requestedCount: 1,
          returnedCount: 1,
        })
      );
    });

    it('maps profile rows to PatientDemographics correctly', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [mockProfile],
            error: null,
          }),
        }),
      }));

      const result = await service.getBatchDemographics([PATIENT_ID]);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const demo = result.data.get(PATIENT_ID);
      expect(demo).toBeDefined();
      expect(demo?.patient_id).toBe(PATIENT_ID);
      expect(demo?.first_name).toBe('John');
      expect(demo?.last_name).toBe('Doe');
      expect(demo?.dob).toBe('1952-03-15');
      expect(demo?.mrn).toBe('MRN-12345');
      expect(demo?.enrollment_type).toBe('hospital');
      expect(demo?.tenant_id).toBe('tenant-001');
    });
  });

  describe('patientExists', () => {
    it('returns true when patient profile exists', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { user_id: PATIENT_ID },
              error: null,
            }),
          }),
        }),
      }));

      const exists = await service.patientExists(PATIENT_ID);
      expect(exists).toBe(true);
    });

    it('returns false when patient not found', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      }));

      const exists = await service.patientExists('nonexistent');
      expect(exists).toBe(false);
    });

    it('returns false when database throws', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('DB down')),
          }),
        }),
      }));

      const exists = await service.patientExists(PATIENT_ID);
      expect(exists).toBe(false);
    });
  });
});
