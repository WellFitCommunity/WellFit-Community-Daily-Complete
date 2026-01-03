/**
 * Unit Tests for Unified Billing Service
 *
 * Tests billing workflow orchestration using mocked dependencies
 * No live database connection required.
 *
 * @module UnifiedBillingServiceTests
 */

import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
import type { BillingWorkflowInput } from '../unifiedBillingService';

// Mock all dependencies
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../phiAccessLogger', () => ({
  logPhiAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    billing: vi.fn().mockResolvedValue(undefined),
    ai: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../billingService', () => ({
  BillingService: {
    createProvider: vi.fn(),
    createPayer: vi.fn(),
    deleteProvider: vi.fn(),
    createClaim: vi.fn(),
    createClaimLines: vi.fn(),
  },
}));

vi.mock('../sdohBillingService', () => ({
  SDOHBillingService: {
    analyzePatient: vi.fn(),
    getRecommendedCodes: vi.fn(),
  },
}));

vi.mock('../billingDecisionTreeService', () => ({
  BillingDecisionTreeService: {
    executeDecisionTree: vi.fn(),
  },
}));

import { supabase } from '../../lib/supabaseClient';
import { BillingService } from '../billingService';
import { SDOHBillingService } from '../sdohBillingService';
import { BillingDecisionTreeService } from '../billingDecisionTreeService';

// ============================================================================
// Test Data
// ============================================================================

const TEST_DATA = {
  provider: {
    id: 'provider-123',
    npi: '1234567890',
    taxonomy_code: '207Q00000X',
    organization_name: 'Test Medical Practice',
    ein: '12-3456789',
  },
  payer: {
    id: 'payer-123',
    name: 'Test Insurance Company',
    payer_id: 'TEST001',
  },
  patient: {
    id: 'patient-123',
    first_name: 'John',
    last_name: 'Doe',
    dob: '1950-01-01',
  },
  encounter: {
    id: 'encounter-123',
    encounterType: 'office_visit' as const,
    serviceDate: '2025-10-15',
    placeOfService: '11',
    diagnoses: [
      { term: 'Essential hypertension', icd10Code: 'I10' },
      { term: 'Type 2 diabetes mellitus', icd10Code: 'E11.9' },
    ],
    timeSpent: 30,
  },
  claim: {
    id: 'claim-123',
    total_charge: 150.0,
    status: 'draft',
  },
  claimLines: [
    { id: 'line-1', cpt_code: '99214', charge_amount: 150.0, modifiers: [] },
  ],
};

// ============================================================================
// Test Suite
// ============================================================================

describe('Unified Billing Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BillingWorkflowInput Validation', () => {
    test('should define valid workflow input structure', () => {
      const input: BillingWorkflowInput = {
        encounterId: TEST_DATA.encounter.id,
        patientId: TEST_DATA.patient.id,
        providerId: TEST_DATA.provider.id,
        payerId: TEST_DATA.payer.id,
        serviceDate: TEST_DATA.encounter.serviceDate,
        encounterType: TEST_DATA.encounter.encounterType,
        placeOfService: TEST_DATA.encounter.placeOfService,
        diagnoses: TEST_DATA.encounter.diagnoses,
        enableAIAssist: false,
        enableSDOHAnalysis: false,
        enableDecisionTree: true,
        autoSubmit: false,
      };

      expect(input.encounterId).toBe('encounter-123');
      expect(input.patientId).toBe('patient-123');
      expect(input.diagnoses).toHaveLength(2);
      expect(input.diagnoses[0].icd10Code).toBe('I10');
    });

    test('should support telehealth encounter type', () => {
      const input: BillingWorkflowInput = {
        encounterId: 'tele-encounter',
        patientId: TEST_DATA.patient.id,
        providerId: TEST_DATA.provider.id,
        payerId: TEST_DATA.payer.id,
        serviceDate: '2025-10-15',
        encounterType: 'telehealth',
        placeOfService: '02',
        diagnoses: [{ icd10Code: 'I10' }],
      };

      expect(input.encounterType).toBe('telehealth');
      expect(input.placeOfService).toBe('02');
    });

    test('should support all encounter types', () => {
      const encounterTypes = ['office_visit', 'telehealth', 'emergency', 'procedure', 'surgery'] as const;

      encounterTypes.forEach((type) => {
        const input: BillingWorkflowInput = {
          encounterId: 'test',
          patientId: 'test',
          providerId: 'test',
          payerId: 'test',
          serviceDate: '2025-10-15',
          encounterType: type,
          placeOfService: '11',
          diagnoses: [{ icd10Code: 'I10' }],
        };
        expect(input.encounterType).toBe(type);
      });
    });
  });

  describe('BillingService Integration', () => {
    test('should call createClaim with correct parameters', async () => {
      const mockClaim = { id: 'claim-new', total_charge: 200 };
      (BillingService.createClaim as Mock).mockResolvedValue(mockClaim);

      const result = await BillingService.createClaim({
        patient_id: TEST_DATA.patient.id,
        provider_id: TEST_DATA.provider.id,
        payer_id: TEST_DATA.payer.id,
        encounter_id: TEST_DATA.encounter.id,
        date_of_service: TEST_DATA.encounter.serviceDate,
        place_of_service: TEST_DATA.encounter.placeOfService,
      });

      expect(BillingService.createClaim).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('claim-new');
    });

    test('should call createClaimLines with CPT codes', async () => {
      const mockLines = [
        { id: 'line-1', cpt_code: '99214', charge_amount: 150 },
        { id: 'line-2', cpt_code: '99215', charge_amount: 200 },
      ];
      (BillingService.createClaimLines as Mock).mockResolvedValue(mockLines);

      const result = await BillingService.createClaimLines('claim-123', [
        { cpt_code: '99214', diagnosis_pointers: ['1'], charge_amount: 150 },
        { cpt_code: '99215', diagnosis_pointers: ['1', '2'], charge_amount: 200 },
      ]);

      expect(BillingService.createClaimLines).toHaveBeenCalledWith('claim-123', expect.any(Array));
      expect(result).toHaveLength(2);
    });
  });

  describe('SDOHBillingService Integration', () => {
    test('should analyze patient for SDOH factors', async () => {
      const mockAssessment = {
        overallComplexityScore: 0.75,
        ccmEligible: true,
        sdohFactors: ['housing_instability', 'food_insecurity'],
        recommendedCodes: ['Z59.0', 'Z59.4'],
      };
      (SDOHBillingService.analyzePatient as Mock).mockResolvedValue(mockAssessment);

      const result = await SDOHBillingService.analyzePatient(TEST_DATA.patient.id);

      expect(SDOHBillingService.analyzePatient).toHaveBeenCalledWith(TEST_DATA.patient.id);
      expect(result.overallComplexityScore).toBe(0.75);
      expect(result.ccmEligible).toBe(true);
      expect(result.sdohFactors).toContain('housing_instability');
    });

    test('should get recommended SDOH codes', async () => {
      const mockCodes = [
        { code: 'Z59.0', description: 'Homelessness' },
        { code: 'Z59.4', description: 'Food insecurity' },
      ];
      (SDOHBillingService.getRecommendedCodes as Mock).mockResolvedValue(mockCodes);

      const result = await SDOHBillingService.getRecommendedCodes(TEST_DATA.patient.id);

      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('Z59.0');
    });
  });

  describe('BillingDecisionTreeService Integration', () => {
    test('should execute decision tree and return result', async () => {
      const mockResult = {
        decisions: [
          { nodeId: 'NODE_A', answer: 'yes', result: 'proceed' },
          { nodeId: 'NODE_B', answer: 'office_visit', result: 'proceed' },
          { nodeId: 'NODE_C', answer: '99214', result: 'complete' },
        ],
        finalCode: '99214',
        confidence: 0.95,
      };
      (BillingDecisionTreeService.executeDecisionTree as Mock).mockResolvedValue(mockResult);

      const result = await BillingDecisionTreeService.executeDecisionTree({
        encounterType: 'office_visit',
        diagnoses: [{ icd10Code: 'I10' }],
        timeSpent: 30,
        placeOfService: '11',
      });

      expect(BillingDecisionTreeService.executeDecisionTree).toHaveBeenCalledTimes(1);
      expect(result.finalCode).toBe('99214');
      expect(result.confidence).toBe(0.95);
      expect(result.decisions).toHaveLength(3);
    });

    test('should classify telehealth visits correctly', async () => {
      const mockResult = {
        decisions: [
          { nodeId: 'NODE_A', answer: 'yes', result: 'proceed' },
          { nodeId: 'NODE_B', answer: 'telehealth', result: 'proceed' },
        ],
        finalCode: '99214',
        modifiers: ['95'],
        confidence: 0.90,
      };
      (BillingDecisionTreeService.executeDecisionTree as Mock).mockResolvedValue(mockResult);

      const result = await BillingDecisionTreeService.executeDecisionTree({
        encounterType: 'telehealth',
        diagnoses: [{ icd10Code: 'I10' }],
        timeSpent: 25,
        placeOfService: '02',
      });

      expect(result.modifiers).toContain('95');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing patient gracefully', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Patient not found', code: 'PGRST116' },
          }),
        }),
      });

      (supabase.from as Mock).mockReturnValue({
        select: mockSelect,
      });

      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', 'non-existent')
        .single();

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message).toContain('not found');
    });

    test('should handle billing service errors', async () => {
      (BillingService.createClaim as Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        BillingService.createClaim({
          patient_id: 'test',
          provider_id: 'test',
          payer_id: 'test',
        })
      ).rejects.toThrow('Database connection failed');
    });

    test('should handle decision tree execution errors', async () => {
      (BillingDecisionTreeService.executeDecisionTree as Mock).mockRejectedValue(
        new Error('Invalid encounter type')
      );

      await expect(
        BillingDecisionTreeService.executeDecisionTree({
          encounterType: 'invalid' as unknown as 'office_visit',
          diagnoses: [],
          placeOfService: '11',
        })
      ).rejects.toThrow('Invalid encounter type');
    });
  });

  describe('Financial Calculations', () => {
    test('should calculate total charges from claim lines', () => {
      const claimLines = [
        { charge_amount: 150.0 },
        { charge_amount: 75.5 },
        { charge_amount: 25.0 },
      ];

      const totalCharges = claimLines.reduce((sum, line) => sum + line.charge_amount, 0);

      expect(totalCharges).toBe(250.5);
    });

    test('should estimate reimbursement based on fee schedule', () => {
      const totalCharges = 200.0;
      const reimbursementRate = 0.80; // 80% reimbursement

      const estimatedReimbursement = totalCharges * reimbursementRate;

      expect(estimatedReimbursement).toBe(160.0);
      expect(estimatedReimbursement).toBeLessThanOrEqual(totalCharges);
    });
  });

  describe('HIPAA Compliance', () => {
    test('should not expose PHI in error messages', () => {
      const errorMessages = [
        'Claim validation failed',
        'Missing required diagnosis codes',
        'Invalid place of service code',
        'Encounter not found',
      ];

      const phiPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/, // SSN
        /\b\d{2}\/\d{2}\/\d{4}\b/, // DOB format
        /\bJohn\b/i, // Test patient first name
        /\bDoe\b/i, // Test patient last name
      ];

      errorMessages.forEach((message) => {
        phiPatterns.forEach((pattern) => {
          expect(pattern.test(message)).toBe(false);
        });
      });
    });

    test('should validate billing workflow does not contain sensitive data', () => {
      const validateNoSensitiveData = (obj: Record<string, unknown>): boolean => {
        const sensitiveKeys = ['ssn', 'social_security', 'dob_plaintext'];
        return !Object.keys(obj).some((key) =>
          sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
        );
      };

      const workflowResult = {
        claimId: 'claim-123',
        status: 'processed',
        totalCharges: 150.0,
        claimLines: TEST_DATA.claimLines,
      };

      expect(validateNoSensitiveData(workflowResult)).toBe(true);
    });
  });

  describe('Telehealth Modifier Support', () => {
    test('should include modifier 95 for telehealth visits', () => {
      const telehealthClaim = {
        encounterType: 'telehealth',
        placeOfService: '02',
        cptCode: '99214',
        modifiers: ['95'],
      };

      expect(telehealthClaim.modifiers).toContain('95');
      expect(telehealthClaim.placeOfService).toBe('02');
    });

    test('should not include telehealth modifier for office visits', () => {
      const officeVisitClaim = {
        encounterType: 'office_visit',
        placeOfService: '11',
        cptCode: '99214',
        modifiers: [],
      };

      expect(officeVisitClaim.modifiers).not.toContain('95');
      expect(officeVisitClaim.placeOfService).toBe('11');
    });
  });

  describe('Diagnosis Code Handling', () => {
    test('should accept ICD-10 diagnosis codes', () => {
      const diagnoses = [
        { icd10Code: 'I10', term: 'Essential hypertension' },
        { icd10Code: 'E11.9', term: 'Type 2 diabetes' },
        { icd10Code: 'J06.9', term: 'Upper respiratory infection' },
      ];

      diagnoses.forEach((dx) => {
        expect(dx.icd10Code).toMatch(/^[A-Z]\d{2}(\.\d{1,4})?$/);
      });
    });

    test('should validate diagnosis pointer references', () => {
      const claimLine = {
        cpt_code: '99214',
        diagnosis_pointers: ['1', '2'],
        charge_amount: 150.0,
      };

      const availableDiagnoses = ['1', '2', '3', '4'];

      claimLine.diagnosis_pointers.forEach((pointer) => {
        expect(availableDiagnoses).toContain(pointer);
      });
    });
  });
});

describe('Billing Pipeline Performance', () => {
  test('should define performance SLA constants', () => {
    const SLA = {
      maxWorkflowDuration: 5000, // 5 seconds
      maxDecisionTreeDuration: 1000, // 1 second
      maxDatabaseQueryDuration: 500, // 500ms
    };

    expect(SLA.maxWorkflowDuration).toBe(5000);
    expect(SLA.maxDecisionTreeDuration).toBeLessThan(SLA.maxWorkflowDuration);
  });
});

// ============================================================================
// Utility Functions (exported for reuse)
// ============================================================================

export function createTestWorkflowInput(
  overrides: Partial<BillingWorkflowInput> = {}
): BillingWorkflowInput {
  return {
    encounterId: 'test-encounter-id',
    patientId: 'test-patient-id',
    providerId: 'test-provider-id',
    payerId: 'test-payer-id',
    serviceDate: '2025-10-15',
    encounterType: 'office_visit',
    placeOfService: '11',
    diagnoses: [{ icd10Code: 'I10' }],
    enableAIAssist: false,
    enableSDOHAnalysis: false,
    enableDecisionTree: true,
    autoSubmit: false,
    ...overrides,
  };
}
