/**
 * Tests for FHIR MCP Client
 */

import {
  exportPatientFHIRBundle,
  getPatientClinicalSummary,
  getPatientMedications,
  getPatientConditions,
  getPatientVitals,
  // getPatientLabResults - tested indirectly
  // getPatientAllergies - tested indirectly
  // getPatientImmunizations - tested indirectly
  // getPatientCarePlans - tested indirectly
  getPatientCareTeam,
  getPatientSDOHRisks,
  validateFHIRResource,
  createCondition,
  createMedicationRequest,
  createObservation,
  listEHRConnections,
  syncPatientWithEHR,
  LOINC_CODES,
  // FHIRMCPClient - class available but not directly tested
} from '../mcpFHIRClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {
  'sb-xkybsjnvuohpqpbkikyn-auth-token': JSON.stringify({ access_token: 'test-token' })
};

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key: string) => mockLocalStorage[key] || null,
    setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
    removeItem: (key: string) => { delete mockLocalStorage[key]; },
    clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
  }
});

describe('FHIRMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportPatientFHIRBundle', () => {
    it('should export a complete patient bundle', async () => {
      const mockBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: '2024-01-15T10:00:00Z',
        total: 5,
        entry: [
          { fullUrl: 'urn:uuid:p1', resource: { resourceType: 'Patient', id: 'p1' } },
          { fullUrl: 'urn:uuid:c1', resource: { resourceType: 'Condition', id: 'c1' } }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockBundle }],
          metadata: { tool: 'export_patient_bundle', executionTimeMs: 150 }
        })
      });

      const result = await exportPatientFHIRBundle('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Bundle');
      expect(result.data?.total).toBe(5);
    });

    it('should filter by resources and date range', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { resourceType: 'Bundle', total: 2, entry: [] } }]
        })
      });

      await exportPatientFHIRBundle('patient-123', {
        resources: ['Condition', 'MedicationRequest'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"resources":["Condition","MedicationRequest"]')
        })
      );
    });
  });

  describe('getPatientClinicalSummary', () => {
    it('should return a clinical summary', async () => {
      const mockSummary = {
        patient_id: 'p1',
        generated_at: '2024-01-15T10:00:00Z',
        sections: {
          demographics: { name: 'John Doe', date_of_birth: '1950-05-15' },
          conditions: [{ code: 'I10', display: 'Hypertension', status: 'active' }],
          medications: [{ name: 'Lisinopril', dosage: '10mg daily', status: 'active' }]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockSummary }]
        })
      });

      const result = await getPatientClinicalSummary('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.sections.demographics?.name).toBe('John Doe');
      expect(result.data?.sections.conditions).toHaveLength(1);
      expect(result.data?.sections.medications).toHaveLength(1);
    });
  });

  describe('getPatientMedications', () => {
    it('should return active medications', async () => {
      const mockMeds = {
        patient_id: 'p1',
        medications: [
          { id: 'm1', name: 'Lisinopril', dosage: '10mg daily', status: 'active' },
          { id: 'm2', name: 'Metformin', dosage: '500mg twice daily', status: 'active' }
        ],
        total: 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockMeds }]
        })
      });

      const result = await getPatientMedications('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.medications).toHaveLength(2);
    });

    it('should include history when requested', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { patient_id: 'p1', medications: [], total: 5 } }]
        })
      });

      await getPatientMedications('patient-123', true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"include_history":true')
        })
      );
    });
  });

  describe('getPatientConditions', () => {
    it('should return patient conditions', async () => {
      const mockConditions = {
        patient_id: 'p1',
        conditions: [
          { id: 'c1', code: 'I10', display: 'Hypertension', clinical_status: 'active' },
          { id: 'c2', code: 'E11.9', display: 'Type 2 Diabetes', clinical_status: 'active' }
        ],
        total: 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockConditions }]
        })
      });

      const result = await getPatientConditions('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.conditions).toHaveLength(2);
    });
  });

  describe('getPatientVitals', () => {
    it('should return vital signs as FHIR bundle', async () => {
      const mockVitals = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 3,
        entry: [
          { resource: { resourceType: 'Observation', code: LOINC_CODES.BLOOD_PRESSURE_SYSTOLIC } },
          { resource: { resourceType: 'Observation', code: LOINC_CODES.HEART_RATE } }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockVitals }]
        })
      });

      const result = await getPatientVitals('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.resourceType).toBe('Bundle');
    });
  });

  describe('getPatientSDOHRisks', () => {
    it('should return SDOH assessments and flags', async () => {
      const mockSDOH = {
        patient_id: 'p1',
        assessments: [
          { id: 'a1', code: '88122-7', display: 'Food insecurity', date: '2024-01-10' }
        ],
        active_flags: [
          { id: 'f1', type: 'food-insecurity', severity: 'high', description: 'Food insecure' }
        ],
        total_assessments: 1,
        total_flags: 1
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockSDOH }]
        })
      });

      const result = await getPatientSDOHRisks('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.assessments).toHaveLength(1);
      expect(result.data?.active_flags).toHaveLength(1);
    });
  });

  describe('getPatientCareTeam', () => {
    it('should return care team members', async () => {
      const mockCareTeam = {
        patient_id: 'p1',
        care_teams: [{
          id: 'ct1',
          name: 'Primary Care Team',
          status: 'active',
          members: [
            { role: 'Primary Care Physician', name: 'Dr. Smith', specialty: 'Family Medicine' },
            { role: 'Care Coordinator', name: 'Jane Nurse' }
          ]
        }]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockCareTeam }]
        })
      });

      const result = await getPatientCareTeam('patient-123');

      expect(result.success).toBe(true);
      expect(result.data?.care_teams[0].members).toHaveLength(2);
    });
  });

  describe('validateFHIRResource', () => {
    it('should validate a valid resource', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { valid: true, errors: [] } }]
        })
      });

      const result = await validateFHIRResource('Condition', {
        code_display: 'Hypertension',
        patient_id: 'p1',
        clinical_status: 'active'
      });

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
    });

    it('should return errors for invalid resource', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { valid: false, errors: ['Missing required field: patient_id'] } }]
        })
      });

      const result = await validateFHIRResource('Condition', {
        code_display: 'Hypertension'
      });

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors).toContain('Missing required field: patient_id');
    });
  });

  describe('createCondition', () => {
    it('should create a new condition', async () => {
      const mockCondition = {
        resourceType: 'Condition',
        id: 'c-new',
        code: 'I10',
        code_display: 'Hypertension',
        clinical_status: 'active'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockCondition }]
        })
      });

      const result = await createCondition('patient-123', {
        code: 'I10',
        display: 'Hypertension'
      });

      expect(result.success).toBe(true);
      expect((result.data as { id?: string } | undefined)?.id).toBe('c-new');
    });
  });

  describe('createMedicationRequest', () => {
    it('should create a new medication request', async () => {
      const mockMedRequest = {
        resourceType: 'MedicationRequest',
        id: 'mr-new',
        medication_name: 'Lisinopril',
        dosage_instructions: '10mg daily',
        status: 'active'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockMedRequest }]
        })
      });

      const result = await createMedicationRequest('patient-123', {
        name: 'Lisinopril',
        dosage: '10mg daily'
      });

      expect(result.success).toBe(true);
      expect((result.data as { medication_name?: string } | undefined)?.medication_name).toBe('Lisinopril');
    });
  });

  describe('createObservation', () => {
    it('should create a new observation', async () => {
      const mockObservation = {
        resourceType: 'Observation',
        id: 'obs-new',
        code: LOINC_CODES.HEART_RATE,
        code_display: 'Heart Rate',
        value_quantity: { value: 72, unit: 'bpm' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockObservation }]
        })
      });

      const result = await createObservation('patient-123', {
        code: LOINC_CODES.HEART_RATE,
        codeDisplay: 'Heart Rate',
        value: 72,
        unit: 'bpm'
      });

      expect(result.success).toBe(true);
      expect((result.data as { value_quantity?: { value: number } } | undefined)?.value_quantity?.value).toBe(72);
    });
  });

  describe('EHR Integration', () => {
    describe('listEHRConnections', () => {
      it('should list active EHR connections', async () => {
        const mockConnections = {
          connections: [
            { id: 'c1', name: 'Epic Connection', ehr_type: 'epic', status: 'active' },
            { id: 'c2', name: 'Cerner Connection', ehr_type: 'cerner', status: 'active' }
          ],
          total: 2
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockConnections }]
          })
        });

        const result = await listEHRConnections();

        expect(result.success).toBe(true);
        expect(result.data?.connections).toHaveLength(2);
      });
    });

    describe('syncPatientWithEHR', () => {
      it('should trigger EHR sync', async () => {
        const mockSyncResult = {
          sync_id: 'sync-123',
          status: 'initiated',
          message: 'Sync request queued'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [{ type: 'json', data: mockSyncResult }]
          })
        });

        const result = await syncPatientWithEHR('connection-1', 'patient-123', 'pull');

        expect(result.success).toBe(true);
        expect(result.data?.sync_id).toBe('sync-123');
        expect(result.data?.status).toBe('initiated');
      });
    });
  });

  describe('LOINC_CODES', () => {
    it('should have standard LOINC codes defined', () => {
      expect(LOINC_CODES.BLOOD_PRESSURE_SYSTOLIC).toBe('8480-6');
      expect(LOINC_CODES.HEART_RATE).toBe('8867-4');
      expect(LOINC_CODES.HBA1C).toBe('4548-4');
      expect(LOINC_CODES.FOOD_INSECURITY).toBe('88122-7');
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getPatientClinicalSummary('patient-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Patient not found' }
        })
      });

      const result = await getPatientClinicalSummary('invalid-patient');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Patient not found');
    });
  });
});
