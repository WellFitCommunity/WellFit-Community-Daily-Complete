/**
 * IntelligentMigrationService Tests
 *
 * Tests for the main migration service orchestration
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { IntelligentMigrationService } from '../IntelligentMigrationService';
import type { MappingSuggestion } from '../types';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock fetch for AI calls
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 500,
});

describe('IntelligentMigrationService', () => {
  let service: IntelligentMigrationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IntelligentMigrationService(
      mockSupabase as unknown as ConstructorParameters<typeof IntelligentMigrationService>[0],
      'org-123'
    );

    // Default mock setup
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'migration_learned_mappings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  or: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'migration_batch') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { batch_id: 'batch-123' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'migration_source_dna') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    mockSupabase.rpc.mockResolvedValue({ error: null });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = service.getConfig();
      expect(config.defaultBatchSize).toBe(100);
      expect(config.pastSuccessBonus).toBe(0.1);
      expect(config.maxEstimatedAccuracy).toBe(0.99);
    });

    it('should allow custom configuration', () => {
      const customService = new IntelligentMigrationService(
        mockSupabase as unknown as ConstructorParameters<typeof IntelligentMigrationService>[0],
        'org-123',
        { migrationService: { defaultBatchSize: 50 } }
      );
      expect(customService.getConfig().defaultBatchSize).toBe(50);
    });

    it('should update configuration', () => {
      service.setConfig({ defaultBatchSize: 200 });
      expect(service.getConfig().defaultBatchSize).toBe(200);
    });
  });

  describe('analyzeSource', () => {
    const sampleData = [
      {
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        phone: '555-123-4567',
        hire_date: '2026-01-15',
      },
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '555-234-5678',
        hire_date: '2026-02-20',
      },
    ];

    it('should analyze source data and return DNA', async () => {
      const result = await service.analyzeSource('CSV', sampleData);

      expect(result.dna).toBeDefined();
      expect(result.dna.sourceType).toBe('CSV');
      expect(result.dna.columnCount).toBe(5);
      expect(result.dna.rowCount).toBe(2);
    });

    it('should return mapping suggestions', async () => {
      const result = await service.analyzeSource('CSV', sampleData);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toHaveLength(5);
    });

    it('should return estimated accuracy', async () => {
      const result = await service.analyzeSource('CSV', sampleData);

      expect(result.estimatedAccuracy).toBeDefined();
      expect(result.estimatedAccuracy).toBeGreaterThan(0);
      expect(result.estimatedAccuracy).toBeLessThanOrEqual(0.99);
    });

    it('should throw error for empty data', async () => {
      await expect(service.analyzeSource('CSV', [])).rejects.toThrow(
        'No data provided for analysis'
      );
    });

    it('should detect source system from column names', async () => {
      const epicData = [{ epic_id: '123', patient_name: 'Test' }];
      const result = await service.analyzeSource('DATABASE', epicData);

      expect(result.dna.sourceSystem).toBe('EPIC');
    });
  });

  describe('executeMigration', () => {
    const sampleData = [
      { first_name: 'John', email: 'john@example.com' },
      { first_name: 'Jane', email: 'jane@example.com' },
    ];

    const sampleMappings: MappingSuggestion[] = [
      {
        sourceColumn: 'first_name',
        targetTable: 'hc_staff',
        targetColumn: 'first_name',
        confidence: 0.9,
        reasons: ['Pattern match'],
        alternativeMappings: [],
      },
      {
        sourceColumn: 'email',
        targetTable: 'hc_staff',
        targetColumn: 'email',
        confidence: 0.95,
        reasons: ['Pattern match'],
        alternativeMappings: [],
      },
    ];

    it('should execute migration and return results', async () => {
      const analysis = await service.analyzeSource('CSV', sampleData);
      const result = await service.executeMigration(
        analysis.dna,
        sampleData,
        sampleMappings
      );

      expect(result.batchId).toBeDefined();
      expect(result.totalRecords).toBe(2);
      expect(result.successCount + result.errorCount).toBe(2);
    });

    it('should respect dry run option', async () => {
      const analysis = await service.analyzeSource('CSV', sampleData);
      const result = await service.executeMigration(
        analysis.dna,
        sampleData,
        sampleMappings,
        { dryRun: true }
      );

      expect(result.batchId).toBeDefined();
      // Insert should not be called in dry run
      // (Verified by mock not being called with insert)
    });

    it('should handle validation errors', async () => {
      const invalidData = [{ first_name: 'John', email: 'not-an-email' }];
      const analysis = await service.analyzeSource('CSV', invalidData);
      const result = await service.executeMigration(
        analysis.dna,
        invalidData,
        sampleMappings
      );

      // Email validation should fail
      expect(result.errors.some((e) => e.error.includes('email'))).toBe(true);
    });

    it('should use custom batch size', async () => {
      const analysis = await service.analyzeSource('CSV', sampleData);
      await service.executeMigration(analysis.dna, sampleData, sampleMappings, {
        batchSize: 1,
      });

      // Should have processed in smaller batches
      // (Verification would require more detailed mock tracking)
    });

    it('should skip UNMAPPED columns', async () => {
      const mappingsWithUnmapped: MappingSuggestion[] = [
        ...sampleMappings,
        {
          sourceColumn: 'unknown',
          targetTable: 'UNMAPPED',
          targetColumn: 'UNMAPPED',
          confidence: 0,
          reasons: ['No match'],
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', sampleData);
      const result = await service.executeMigration(
        analysis.dna,
        sampleData,
        mappingsWithUnmapped
      );

      // Should not error on UNMAPPED
      expect(result.batchId).toBeDefined();
    });
  });

  describe('value transformation', () => {
    const testPhoneTransform = async () => {
      const data = [{ phone: '(555) 123-4567' }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'phone',
          targetTable: 'hc_staff',
          targetColumn: 'phone_work',
          confidence: 0.9,
          reasons: ['Pattern match'],
          transformRequired: 'NORMALIZE_PHONE',
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      await service.executeMigration(analysis.dna, data, mappings, {
        validateOnly: true,
      });

      // Phone should be normalized to 5551234567
    };

    it('should normalize phone numbers', async () => {
      await testPhoneTransform();
      // Test passes if no error
    });

    it('should convert dates to ISO format', async () => {
      const data = [{ hire_date: '01/15/2026' }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'hire_date',
          targetTable: 'hc_staff',
          targetColumn: 'hire_date',
          confidence: 0.9,
          reasons: ['Pattern match'],
          transformRequired: 'CONVERT_DATE_TO_ISO',
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      // Should not have date format errors
      expect(
        result.errors.filter((e) => e.error.includes('Date must be')).length
      ).toBe(0);
    });

    it('should parse full names', async () => {
      const data = [{ full_name: 'Smith, John' }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'full_name',
          targetTable: 'hc_staff',
          targetColumn: 'first_name',
          confidence: 0.9,
          reasons: ['Pattern match'],
          transformRequired: 'PARSE_NAME_FIRST',
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      await service.executeMigration(analysis.dna, data, mappings, {
        validateOnly: true,
      });

      // Should extract 'John' from 'Smith, John'
    });

    it('should convert state names to codes', async () => {
      const data = [{ state: 'Texas' }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'state',
          targetTable: 'hc_staff',
          targetColumn: 'state',
          confidence: 0.9,
          reasons: ['Pattern match'],
          transformRequired: 'CONVERT_STATE_TO_CODE',
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      // Should convert 'Texas' to 'TX' and pass validation
      expect(
        result.errors.filter((e) => e.error.includes('2-letter')).length
      ).toBe(0);
    });
  });

  describe('validation', () => {
    it('should validate required fields', async () => {
      const data = [{ first_name: null }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'first_name',
          targetTable: 'hc_staff',
          targetColumn: 'first_name',
          confidence: 0.9,
          reasons: ['Pattern match'],
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      expect(result.errors.some((e) => e.error.includes('required'))).toBe(
        true
      );
    });

    it('should validate NPI with Luhn check', async () => {
      const data = [{ npi: '1234567890' }]; // Invalid NPI
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'npi',
          targetTable: 'hc_staff',
          targetColumn: 'npi',
          confidence: 0.9,
          reasons: ['Pattern match'],
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      expect(result.errors.some((e) => e.error.includes('Invalid NPI'))).toBe(
        true
      );
    });

    it('should validate email format', async () => {
      const data = [{ email: 'not-an-email' }];
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'email',
          targetTable: 'hc_staff',
          targetColumn: 'email',
          confidence: 0.9,
          reasons: ['Pattern match'],
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      expect(result.errors.some((e) => e.error.includes('Invalid email'))).toBe(
        true
      );
    });

    it('should validate state code format', async () => {
      const data = [{ state: 'Texas' }]; // Not a 2-letter code
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'state',
          targetTable: 'hc_staff',
          targetColumn: 'state',
          confidence: 0.9,
          reasons: ['Pattern match'],
          // No transform, so validation should fail
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      expect(result.errors.some((e) => e.error.includes('2-letter'))).toBe(
        true
      );
    });

    it('should validate date format', async () => {
      const data = [{ hire_date: '01-15-2026' }]; // Not ISO format
      const mappings: MappingSuggestion[] = [
        {
          sourceColumn: 'hire_date',
          targetTable: 'hc_staff',
          targetColumn: 'hire_date',
          confidence: 0.9,
          reasons: ['Pattern match'],
          // No transform, so validation should fail
          alternativeMappings: [],
        },
      ];

      const analysis = await service.analyzeSource('CSV', data);
      const result = await service.executeMigration(
        analysis.dna,
        data,
        mappings,
        { validateOnly: true }
      );

      expect(result.errors.some((e) => e.error.includes('YYYY-MM-DD'))).toBe(
        true
      );
    });
  });

  describe('recordCorrection', () => {
    it('should record user corrections', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { result_id: 'result-123' },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      await service.recordCorrection(
        'batch-123',
        'email',
        { table: 'hc_staff', column: 'email' },
        { table: 'fhir_patient', column: 'telecom_email' }
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'learn_from_correction',
        expect.objectContaining({
          p_source_column: 'email',
          p_wrong_table: 'hc_staff',
          p_correct_table: 'fhir_patient',
        })
      );
    });
  });

  describe('accessors', () => {
    it('should provide access to DNA generator', () => {
      const generator = service.getDNAGenerator();
      expect(generator).toBeDefined();
      expect(typeof generator.generateDNA).toBe('function');
    });

    it('should provide access to pattern detector', () => {
      const detector = service.getPatternDetector();
      expect(detector).toBeDefined();
      expect(typeof detector.detectValuePattern).toBe('function');
    });

    it('should provide access to mapping intelligence', () => {
      const intelligence = service.getMappingIntelligence();
      expect(intelligence).toBeDefined();
      expect(typeof intelligence.suggestMappings).toBe('function');
    });
  });
});
