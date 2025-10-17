/**
 * FHIR Search API Tests
 * Comprehensive tests for FHIR R4 search functionality with US Core parameters
 */

// Jest test imports are global
import {
  searchMedicationRequests,
  searchConditions,
  searchDiagnosticReports,
  searchProcedures,
  searchAllergyIntolerances,
  FHIRSearchAPI,
  type FHIRSearchParams,
} from '../fhirSearch';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase client
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('FHIR Search API', () => {
  let mockQuery: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create chainable mock query
    mockQuery = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };

    (supabase.from as any).mockReturnValue(mockQuery);
  });

  describe('searchMedicationRequests', () => {
    it('should search by patient ID', async () => {
      const mockData = [
        { id: 'med-1', patient_id: 'patient-123', medication_display: 'Aspirin 81mg' },
        { id: 'med-2', patient_id: 'patient-123', medication_display: 'Lisinopril 10mg' },
      ];

      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      const result = await searchMedicationRequests(params);

      expect(result.resourceType).toBe('Bundle');
      expect(result.type).toBe('searchset');
      expect(result.total).toBe(2);
      expect(result.entry).toHaveLength(2);
      expect(result.entry[0].resource.id).toBe('med-1');
      expect(result.entry[0].fullUrl).toBe('MedicationRequest/med-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    });

    it('should search by status', async () => {
      const mockData = [{ id: 'med-1', status: 'active' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', status: 'active' };
      await searchMedicationRequests(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('should search by intent', async () => {
      const mockData = [{ id: 'med-1', intent: 'order' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', intent: 'order' };
      await searchMedicationRequests(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('intent', 'order');
    });

    it('should search by medication code', async () => {
      const mockData = [{ id: 'med-1', medication_code: '123456' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', medication: '123456' };
      await searchMedicationRequests(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('medication_code', '123456');
    });

    it('should apply pagination', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', _count: 50 };
      await searchMedicationRequests(params);

      expect(mockQuery.limit).toHaveBeenCalledWith(50);
    });

    it('should apply default pagination when _count not specified', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      await searchMedicationRequests(params);

      expect(mockQuery.limit).toHaveBeenCalledWith(20);
    });

    it('should apply sorting', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', _sort: '-authored_on' };
      await searchMedicationRequests(params);

      expect(mockQuery.order).toHaveBeenCalledWith('authored_on', { ascending: false });
    });

    it('should handle errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockQuery.select.mockResolvedValue({ data: null, error: new Error('Database error') });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      const result = await searchMedicationRequests(params);

      expect(result.total).toBe(0);
      expect(result.entry).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should filter by _id', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'med-1' }], error: null });

      const params: FHIRSearchParams = { _id: 'med-1' };
      await searchMedicationRequests(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'med-1');
    });
  });

  describe('searchConditions', () => {
    it('should search by patient and category', async () => {
      const mockData = [{ id: 'cond-1', patient_id: 'patient-123', category: ['problem-list-item'] }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', category: 'problem-list-item' };
      await searchConditions(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.contains).toHaveBeenCalledWith('category', ['problem-list-item']);
    });

    it('should search by clinical-status', async () => {
      const mockData = [{ id: 'cond-1', clinical_status: 'active' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', 'clinical-status': 'active' };
      await searchConditions(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('clinical_status', 'active');
    });

    it('should search by code', async () => {
      const mockData = [{ id: 'cond-1', code: 'I10' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', code: 'I10' };
      await searchConditions(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('code', 'I10');
    });

    it('should search by onset-date with greater than prefix', async () => {
      const mockData = [{ id: 'cond-1', onset_datetime: '2025-01-01' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', 'onset-date': 'gt2025-01-01' };
      await searchConditions(params);

      expect(mockQuery.gt).toHaveBeenCalledWith('onset_datetime', '2025-01-01');
    });

    it('should search by recorded-date with less than prefix', async () => {
      const mockData = [{ id: 'cond-1', recorded_date: '2025-01-01' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', 'recorded-date': 'lt2025-12-31' };
      await searchConditions(params);

      expect(mockQuery.lt).toHaveBeenCalledWith('recorded_date', '2025-12-31');
    });

    it('should search by verification-status', async () => {
      const mockData = [{ id: 'cond-1', verification_status: 'confirmed' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', 'verification-status': 'confirmed' };
      await searchConditions(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('verification_status', 'confirmed');
    });

    it('should apply default sorting by recorded_date', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      await searchConditions(params);

      expect(mockQuery.order).toHaveBeenCalledWith('recorded_date', expect.any(Object));
    });
  });

  describe('searchDiagnosticReports', () => {
    it('should search by patient and category', async () => {
      const mockData = [{ id: 'report-1', patient_id: 'patient-123', category: ['LAB'] }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', category: 'LAB' };
      await searchDiagnosticReports(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
      expect(mockQuery.contains).toHaveBeenCalledWith('category', ['LAB']);
    });

    it('should search by status', async () => {
      const mockData = [{ id: 'report-1', status: 'final' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', status: 'final' };
      await searchDiagnosticReports(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'final');
    });

    it('should search by issued date with equal prefix', async () => {
      const mockData = [{ id: 'report-1', issued: '2025-01-15' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', issued: 'eq2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should search by date parameter', async () => {
      const mockData = [{ id: 'report-1', issued: '2025-01-15' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'ge2025-01-01' };
      await searchDiagnosticReports(params);

      expect(mockQuery.gte).toHaveBeenCalledWith('issued', '2025-01-01');
    });

    it('should return Bundle with correct fullUrl', async () => {
      const mockData = [{ id: 'report-1' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      const result = await searchDiagnosticReports(params);

      expect(result.entry[0].fullUrl).toBe('DiagnosticReport/report-1');
    });
  });

  describe('searchProcedures', () => {
    it('should search by patient', async () => {
      const mockData = [{ id: 'proc-1', patient_id: 'patient-123' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      await searchProcedures(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    });

    it('should search by status and code', async () => {
      const mockData = [{ id: 'proc-1', status: 'completed', code: '99213' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', status: 'completed', code: '99213' };
      await searchProcedures(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
      expect(mockQuery.eq).toHaveBeenCalledWith('code', '99213');
    });

    it('should search by performed date', async () => {
      const mockData = [{ id: 'proc-1', performed_datetime: '2025-01-15' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', performed: 'le2025-01-31' };
      await searchProcedures(params);

      expect(mockQuery.lte).toHaveBeenCalledWith('performed_datetime', '2025-01-31');
    });

    it('should search by date parameter', async () => {
      const mockData = [{ id: 'proc-1', performed_datetime: '2025-01-15' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'gt2025-01-01' };
      await searchProcedures(params);

      expect(mockQuery.gt).toHaveBeenCalledWith('performed_datetime', '2025-01-01');
    });

    it('should search by encounter', async () => {
      const mockData = [{ id: 'proc-1', encounter_id: 'enc-123' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', encounter: 'enc-123' };
      await searchProcedures(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('encounter_id', 'enc-123');
    });
  });

  describe('searchAllergyIntolerances', () => {
    it('should search by patient', async () => {
      const mockData = [{ id: 'allergy-1', patient_id: 'patient-123' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      await searchAllergyIntolerances(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    });

    it('should search by clinical-status', async () => {
      const mockData = [{ id: 'allergy-1', clinical_status: 'active' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', 'clinical-status': 'active' };
      await searchAllergyIntolerances(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('clinical_status', 'active');
    });

    it('should search by criticality', async () => {
      const mockData = [{ id: 'allergy-1', criticality: 'high' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', criticality: 'high' };
      await searchAllergyIntolerances(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('criticality', 'high');
    });

    it('should search by type', async () => {
      const mockData = [{ id: 'allergy-1', allergen_type: 'medication' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', type: 'medication' };
      await searchAllergyIntolerances(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('allergen_type', 'medication');
    });

    it('should return Bundle with correct fullUrl', async () => {
      const mockData = [{ id: 'allergy-1' }];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const params: FHIRSearchParams = { patient: 'patient-123' };
      const result = await searchAllergyIntolerances(params);

      expect(result.entry[0].fullUrl).toBe('AllergyIntolerance/allergy-1');
    });
  });

  describe('FHIRSearchAPI.search', () => {
    it('should route to MedicationRequest search', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'med-1' }], error: null });

      const result = await FHIRSearchAPI.search('MedicationRequest', { patient: 'patient-123' });

      expect(result.entry[0].fullUrl).toBe('MedicationRequest/med-1');
    });

    it('should route to Condition search', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'cond-1' }], error: null });

      const result = await FHIRSearchAPI.search('Condition', { patient: 'patient-123' });

      expect(result.entry[0].fullUrl).toBe('Condition/cond-1');
    });

    it('should route to DiagnosticReport search', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'report-1' }], error: null });

      const result = await FHIRSearchAPI.search('DiagnosticReport', { patient: 'patient-123' });

      expect(result.entry[0].fullUrl).toBe('DiagnosticReport/report-1');
    });

    it('should route to Procedure search', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'proc-1' }], error: null });

      const result = await FHIRSearchAPI.search('Procedure', { patient: 'patient-123' });

      expect(result.entry[0].fullUrl).toBe('Procedure/proc-1');
    });

    it('should route to AllergyIntolerance search', async () => {
      mockQuery.select.mockResolvedValue({ data: [{ id: 'allergy-1' }], error: null });

      const result = await FHIRSearchAPI.search('AllergyIntolerance', { patient: 'patient-123' });

      expect(result.entry[0].fullUrl).toBe('AllergyIntolerance/allergy-1');
    });

    it('should return empty bundle for unknown resource type', async () => {
      const result = await FHIRSearchAPI.search('UnknownResource', { patient: 'patient-123' });

      expect(result.total).toBe(0);
      expect(result.entry).toHaveLength(0);
    });
  });

  describe('Date search prefixes', () => {
    it('should handle eq (equals) prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'eq2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should handle lt (less than) prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'lt2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.lt).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should handle le (less than or equal) prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'le2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.lte).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should handle gt (greater than) prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'gt2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.gt).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should handle ge (greater than or equal) prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: 'ge2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.gte).toHaveBeenCalledWith('issued', '2025-01-15');
    });

    it('should default to exact match without prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', date: '2025-01-15' };
      await searchDiagnosticReports(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('issued', '2025-01-15');
    });
  });

  describe('Sorting', () => {
    it('should sort ascending by default', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', _sort: 'issued' };
      await searchDiagnosticReports(params);

      expect(mockQuery.order).toHaveBeenCalledWith('issued', { ascending: true });
    });

    it('should sort descending with - prefix', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { patient: 'patient-123', _sort: '-issued' };
      await searchDiagnosticReports(params);

      expect(mockQuery.order).toHaveBeenCalledWith('issued', { ascending: false });
    });
  });

  describe('Bundle structure', () => {
    it('should return proper FHIR Bundle structure', async () => {
      const mockData = [
        { id: 'med-1', medication_display: 'Aspirin' },
        { id: 'med-2', medication_display: 'Lisinopril' },
      ];
      mockQuery.select.mockResolvedValue({ data: mockData, error: null });

      const result = await searchMedicationRequests({ patient: 'patient-123' });

      expect(result).toMatchObject({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 2,
        entry: [
          {
            fullUrl: 'MedicationRequest/med-1',
            resource: { id: 'med-1', medication_display: 'Aspirin' },
            search: { mode: 'match' },
          },
          {
            fullUrl: 'MedicationRequest/med-2',
            resource: { id: 'med-2', medication_display: 'Lisinopril' },
            search: { mode: 'match' },
          },
        ],
      });
    });

    it('should return empty bundle when no data', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const result = await searchMedicationRequests({ patient: 'patient-123' });

      expect(result).toMatchObject({
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: [],
      });
    });
  });

  describe('Subject parameter (alias for patient)', () => {
    it('should accept subject parameter as alias for patient', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null });

      const params: FHIRSearchParams = { subject: 'patient-123' };
      await searchMedicationRequests(params);

      expect(mockQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    });
  });
});
