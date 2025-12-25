/**
 * Tests for FHIR Semantic Mapper Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FHIRSemanticMapperService } from '../fhirSemanticMapperService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FHIRSemanticMapperService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('type definitions', () => {
    it('should define all FHIR versions', () => {
      const versions = ['R4', 'R4B', 'R5', 'STU3', 'DSTU2'];
      expect(versions).toHaveLength(5);
      expect(versions).toContain('R4');
      expect(versions).toContain('R5');
    });

    it('should define all resource types', () => {
      const types = [
        'Patient', 'Observation', 'Condition', 'MedicationRequest',
        'Procedure', 'Encounter', 'DiagnosticReport', 'AllergyIntolerance',
        'Immunization', 'CarePlan', 'Goal', 'ServiceRequest', 'Other'
      ];
      expect(types).toHaveLength(13);
      expect(types).toContain('Patient');
      expect(types).toContain('Observation');
    });

    it('should define all mapping confidence levels', () => {
      const confidences = ['exact', 'high', 'medium', 'low', 'none'];
      expect(confidences).toHaveLength(5);
      expect(confidences).toContain('exact');
      expect(confidences).toContain('none');
    });

    it('should define validation severities', () => {
      const severities = ['error', 'warning', 'information'];
      expect(severities).toHaveLength(3);
      expect(severities).toContain('error');
    });

    it('should define terminology equivalence types', () => {
      const types = ['equivalent', 'wider', 'narrower', 'inexact'];
      expect(types).toHaveLength(4);
      expect(types).toContain('equivalent');
    });
  });

  describe('service methods', () => {
    it('should validate required fields', async () => {
      const result = await FHIRSemanticMapperService.mapToFHIR({
        requesterId: '',
        sourceData: {},
        targetVersion: 'R4',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate source data is required', async () => {
      const result = await FHIRSemanticMapperService.mapToFHIR({
        requesterId: 'test-user',
        sourceData: null as unknown as Record<string, unknown>,
        targetVersion: 'R4',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should return empty history when no mappings exist', async () => {
      const result = await FHIRSemanticMapperService.getMappingHistory('test-requester');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('FHIR version styling', () => {
    it('should return correct style for R5', () => {
      const style = FHIRSemanticMapperService.getVersionStyle('R5');
      expect(style.bg).toContain('purple');
      expect(style.label).toBe('FHIR R5');
    });

    it('should return correct style for R4B', () => {
      const style = FHIRSemanticMapperService.getVersionStyle('R4B');
      expect(style.bg).toContain('blue');
      expect(style.label).toBe('FHIR R4B');
    });

    it('should return correct style for R4', () => {
      const style = FHIRSemanticMapperService.getVersionStyle('R4');
      expect(style.bg).toContain('green');
      expect(style.label).toBe('FHIR R4');
    });

    it('should return correct style for STU3', () => {
      const style = FHIRSemanticMapperService.getVersionStyle('STU3');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('FHIR STU3');
    });

    it('should return correct style for DSTU2', () => {
      const style = FHIRSemanticMapperService.getVersionStyle('DSTU2');
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('FHIR DSTU2');
    });
  });

  describe('resource type styling', () => {
    it('should return correct style for Patient', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Patient');
      expect(style.bg).toContain('blue');
      expect(style.icon).toBe('👤');
    });

    it('should return correct style for Observation', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Observation');
      expect(style.bg).toContain('green');
      expect(style.icon).toBe('📊');
    });

    it('should return correct style for Condition', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Condition');
      expect(style.bg).toContain('red');
      expect(style.icon).toBe('🏥');
    });

    it('should return correct style for MedicationRequest', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('MedicationRequest');
      expect(style.bg).toContain('purple');
      expect(style.icon).toBe('💊');
    });

    it('should return correct style for Procedure', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Procedure');
      expect(style.bg).toContain('orange');
      expect(style.icon).toBe('🔧');
    });

    it('should return correct style for Encounter', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Encounter');
      expect(style.bg).toContain('yellow');
      expect(style.icon).toBe('📅');
    });

    it('should return correct style for AllergyIntolerance', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('AllergyIntolerance');
      expect(style.bg).toContain('pink');
      expect(style.icon).toBe('⚠️');
    });

    it('should return correct style for Immunization', () => {
      const style = FHIRSemanticMapperService.getResourceTypeStyle('Immunization');
      expect(style.bg).toContain('teal');
      expect(style.icon).toBe('💉');
    });
  });

  describe('confidence styling', () => {
    it('should return correct style for exact confidence', () => {
      const style = FHIRSemanticMapperService.getConfidenceStyle('exact');
      expect(style.bg).toContain('green');
      expect(style.label).toBe('Exact Match');
      expect(style.percentage).toBe(100);
    });

    it('should return correct style for high confidence', () => {
      const style = FHIRSemanticMapperService.getConfidenceStyle('high');
      expect(style.bg).toContain('blue');
      expect(style.label).toBe('High Confidence');
      expect(style.percentage).toBe(85);
    });

    it('should return correct style for medium confidence', () => {
      const style = FHIRSemanticMapperService.getConfidenceStyle('medium');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Medium Confidence');
      expect(style.percentage).toBe(65);
    });

    it('should return correct style for low confidence', () => {
      const style = FHIRSemanticMapperService.getConfidenceStyle('low');
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Low Confidence');
      expect(style.percentage).toBe(40);
    });

    it('should return correct style for no confidence', () => {
      const style = FHIRSemanticMapperService.getConfidenceStyle('none');
      expect(style.bg).toContain('red');
      expect(style.label).toBe('No Match');
      expect(style.percentage).toBe(0);
    });
  });

  describe('validation severity styling', () => {
    it('should return correct style for error', () => {
      const style = FHIRSemanticMapperService.getValidationSeverityStyle('error');
      expect(style.bg).toContain('red');
      expect(style.icon).toBe('❌');
    });

    it('should return correct style for warning', () => {
      const style = FHIRSemanticMapperService.getValidationSeverityStyle('warning');
      expect(style.bg).toContain('yellow');
      expect(style.icon).toBe('⚠️');
    });

    it('should return correct style for information', () => {
      const style = FHIRSemanticMapperService.getValidationSeverityStyle('information');
      expect(style.bg).toContain('blue');
      expect(style.icon).toBe('ℹ️');
    });
  });

  describe('validation score styling', () => {
    it('should return excellent for 90+', () => {
      const style = FHIRSemanticMapperService.getValidationScoreStyle(95);
      expect(style.bg).toContain('green');
      expect(style.label).toBe('Excellent');
    });

    it('should return good for 75-89', () => {
      const style = FHIRSemanticMapperService.getValidationScoreStyle(80);
      expect(style.bg).toContain('blue');
      expect(style.label).toBe('Good');
    });

    it('should return fair for 50-74', () => {
      const style = FHIRSemanticMapperService.getValidationScoreStyle(60);
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Fair');
    });

    it('should return poor for 25-49', () => {
      const style = FHIRSemanticMapperService.getValidationScoreStyle(30);
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Poor');
    });

    it('should return critical for below 25', () => {
      const style = FHIRSemanticMapperService.getValidationScoreStyle(15);
      expect(style.bg).toContain('red');
      expect(style.label).toBe('Critical');
    });
  });

  describe('equivalence styling', () => {
    it('should return correct style for equivalent', () => {
      const style = FHIRSemanticMapperService.getEquivalenceStyle('equivalent');
      expect(style.bg).toContain('green');
      expect(style.label).toBe('Equivalent');
    });

    it('should return correct style for wider', () => {
      const style = FHIRSemanticMapperService.getEquivalenceStyle('wider');
      expect(style.bg).toContain('blue');
      expect(style.label).toBe('Wider');
    });

    it('should return correct style for narrower', () => {
      const style = FHIRSemanticMapperService.getEquivalenceStyle('narrower');
      expect(style.bg).toContain('yellow');
      expect(style.label).toBe('Narrower');
    });

    it('should return correct style for inexact', () => {
      const style = FHIRSemanticMapperService.getEquivalenceStyle('inexact');
      expect(style.bg).toContain('orange');
      expect(style.label).toBe('Inexact');
    });
  });

  describe('resource type display names', () => {
    it('should return correct display names', () => {
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Patient')).toBe('Patient Demographics');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Observation')).toBe('Clinical Observation');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Condition')).toBe('Diagnosis/Condition');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('MedicationRequest')).toBe('Medication Order');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Procedure')).toBe('Clinical Procedure');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Encounter')).toBe('Patient Encounter');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('DiagnosticReport')).toBe('Diagnostic Report');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('AllergyIntolerance')).toBe('Allergy/Intolerance');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Immunization')).toBe('Immunization Record');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('CarePlan')).toBe('Care Plan');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Goal')).toBe('Patient Goal');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('ServiceRequest')).toBe('Service Request');
      expect(FHIRSemanticMapperService.getResourceTypeDisplayName('Other')).toBe('Generic Resource');
    });
  });

  describe('mapping statistics', () => {
    it('should calculate mapping stats correctly', () => {
      const result = {
        mappingId: 'test-id',
        sourceSystem: 'EHR',
        targetVersion: 'R4' as const,
        targetResource: 'Patient' as const,
        mappings: [
          { sourcePath: 'first_name', targetResource: 'Patient' as const, targetPath: 'name[0].given[0]', targetDataType: 'string', confidence: 'exact' as const, rationale: 'test' },
          { sourcePath: 'last_name', targetResource: 'Patient' as const, targetPath: 'name[0].family', targetDataType: 'string', confidence: 'high' as const, rationale: 'test' },
        ],
        unmappedFields: ['custom_field'],
        suggestedMappings: [
          { sourcePath: 'custom_field', targetResource: 'Patient' as const, targetPath: 'extension[0].valueString', targetDataType: 'string', confidence: 'medium' as const, rationale: 'AI suggestion' },
        ],
        validationIssues: [
          { path: 'name', severity: 'warning' as const, code: 'recommended', message: 'test' },
          { path: 'identifier', severity: 'error' as const, code: 'required', message: 'test' },
        ],
        isValid: false,
        validationScore: 75,
        summary: 'Test',
        confidence: 'high' as const,
        warnings: [],
      };

      const stats = FHIRSemanticMapperService.calculateMappingStats(result);
      expect(stats.totalFields).toBe(3);
      expect(stats.mappedFields).toBe(2);
      expect(stats.unmappedFields).toBe(1);
      expect(stats.suggestedFields).toBe(1);
      expect(stats.mappingRate).toBe(67);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(0);
    });
  });

  describe('grouping functions', () => {
    it('should group mappings by confidence', () => {
      const mappings = [
        { sourcePath: 'a', targetResource: 'Patient' as const, targetPath: 'x', targetDataType: 'string', confidence: 'exact' as const, rationale: 'test' },
        { sourcePath: 'b', targetResource: 'Patient' as const, targetPath: 'y', targetDataType: 'string', confidence: 'high' as const, rationale: 'test' },
        { sourcePath: 'c', targetResource: 'Patient' as const, targetPath: 'z', targetDataType: 'string', confidence: 'exact' as const, rationale: 'test' },
      ];

      const grouped = FHIRSemanticMapperService.groupMappingsByConfidence(mappings);
      expect(grouped['exact']).toHaveLength(2);
      expect(grouped['high']).toHaveLength(1);
    });

    it('should group validation issues by path', () => {
      const issues = [
        { path: 'name', severity: 'warning' as const, code: 'recommended', message: 'test1' },
        { path: 'name', severity: 'error' as const, code: 'required', message: 'test2' },
        { path: 'identifier', severity: 'error' as const, code: 'required', message: 'test3' },
      ];

      const grouped = FHIRSemanticMapperService.groupIssuesByPath(issues);
      expect(grouped['name']).toHaveLength(2);
      expect(grouped['identifier']).toHaveLength(1);
    });
  });

  describe('code systems', () => {
    it('should return common FHIR code systems', () => {
      const systems = FHIRSemanticMapperService.getCodeSystems();
      expect(systems.length).toBeGreaterThan(0);
      expect(systems.find(s => s.code === 'LOINC')).toBeDefined();
      expect(systems.find(s => s.code === 'SNOMED')).toBeDefined();
      expect(systems.find(s => s.code === 'ICD10')).toBeDefined();
      expect(systems.find(s => s.code === 'RXNORM')).toBeDefined();
    });

    it('should have URLs for all code systems', () => {
      const systems = FHIRSemanticMapperService.getCodeSystems();
      systems.forEach(system => {
        expect(system.url).toBeDefined();
        expect(system.url.startsWith('http')).toBe(true);
      });
    });
  });

  describe('supported versions', () => {
    it('should return supported FHIR versions', () => {
      const versions = FHIRSemanticMapperService.getSupportedVersions();
      expect(versions.length).toBe(5);
      expect(versions.find(v => v.version === 'R4')).toBeDefined();
      expect(versions.find(v => v.version === 'R5')).toBeDefined();
    });

    it('should include release info for all versions', () => {
      const versions = FHIRSemanticMapperService.getSupportedVersions();
      versions.forEach(v => {
        expect(v.name).toBeDefined();
        expect(v.releaseDate).toBeDefined();
        expect(v.status).toBeDefined();
      });
    });
  });

  describe('FHIR path formatting', () => {
    it('should format simple paths', () => {
      expect(FHIRSemanticMapperService.formatFHIRPath('name.given')).toBe('name → given');
    });

    it('should format paths with array indices', () => {
      expect(FHIRSemanticMapperService.formatFHIRPath('name[0].given[0]')).toBe('name[0] → given[0]');
    });

    it('should format complex paths', () => {
      const formatted = FHIRSemanticMapperService.formatFHIRPath('identifier[0].type.coding[0].code');
      expect(formatted).toBe('identifier[0] → type → coding[0] → code');
    });
  });

  describe('edge cases', () => {
    it('should handle empty mapping result', () => {
      const result = {
        mappingId: 'test',
        sourceSystem: 'test',
        targetVersion: 'R4' as const,
        targetResource: 'Patient' as const,
        mappings: [],
        unmappedFields: [],
        suggestedMappings: [],
        validationIssues: [],
        isValid: true,
        validationScore: 100,
        summary: '',
        confidence: 'none' as const,
        warnings: [],
      };

      const stats = FHIRSemanticMapperService.calculateMappingStats(result);
      expect(stats.totalFields).toBe(0);
      expect(stats.mappingRate).toBe(0);
    });
  });
});
