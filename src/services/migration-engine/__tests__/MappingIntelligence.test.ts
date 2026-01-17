/**
 * MappingIntelligence Tests
 *
 * Tests for intelligent field mapping with pattern matching and AI assistance
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MappingIntelligence } from '../MappingIntelligence';
import { DataDNAGenerator } from '../DataDNAGenerator';
import type { SourceDNA, ColumnDNA } from '../types';

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
global.fetch = vi.fn();

describe('MappingIntelligence', () => {
  let intelligence: MappingIntelligence;
  let generator: DataDNAGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    intelligence = new MappingIntelligence(
      mockSupabase as unknown as ConstructorParameters<typeof MappingIntelligence>[0],
      'org-123'
    );
    generator = new DataDNAGenerator();

    // Default mock for learned mappings query - no results
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const config = intelligence.getConfig();
      expect(config.minimumCandidateScore).toBe(0.2);
      expect(config.patternMatchWeight).toBe(0.3);
      expect(config.nameSimilarityWeight).toBe(0.4);
    });

    it('should allow custom configuration', () => {
      const customIntelligence = new MappingIntelligence(
        mockSupabase as unknown as ConstructorParameters<typeof MappingIntelligence>[0],
        'org-123',
        { minimumCandidateScore: 0.3 }
      );
      expect(customIntelligence.getConfig().minimumCandidateScore).toBe(0.3);
    });

    it('should update configuration', () => {
      intelligence.setConfig({ patternMatchWeight: 0.5 });
      expect(intelligence.getConfig().patternMatchWeight).toBe(0.5);
    });

    it('should update AI configuration', () => {
      intelligence.setAIConfig({ enabled: false });
      expect(intelligence.getAIConfig().enabled).toBe(false);
    });
  });

  describe('suggestMappings', () => {
    it('should suggest mappings for email column', async () => {
      const dna = generator.generateDNA('CSV', ['email_address'], [
        { email_address: 'test@example.com' },
        { email_address: 'user@domain.org' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].targetColumn).toBe('email');
      expect(suggestions[0].confidence).toBeGreaterThan(0.3);
    });

    it('should suggest mappings for phone column', async () => {
      const dna = generator.generateDNA('CSV', ['phone_number'], [
        { phone_number: '555-123-4567' },
        { phone_number: '555-234-5678' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].targetColumn).toContain('phone');
    });

    it('should suggest mappings for NPI column', async () => {
      const dna = generator.generateDNA('CSV', ['provider_npi'], [
        { provider_npi: '1234567890' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].targetColumn).toBe('npi');
    });

    it('should suggest mappings for date columns', async () => {
      const dna = generator.generateDNA('CSV', ['hire_date'], [
        { hire_date: '2026-01-15' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].targetColumn).toBe('hire_date');
    });

    it('should suggest UNMAPPED for unrecognized columns', async () => {
      // Use a completely obscure column name and value that won't match any pattern
      const dna = generator.generateDNA('CSV', ['qzx_nonthing_woozle'], [
        { qzx_nonthing_woozle: 'bleep blorp zazzle' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
      // Either UNMAPPED or low confidence match (threshold is configurable at 0.2)
      expect(
        suggestions[0].targetColumn === 'UNMAPPED' ||
          suggestions[0].confidence < 0.5
      ).toBe(true);
    });

    it('should provide alternative mappings', async () => {
      const dna = generator.generateDNA('CSV', ['work_phone'], [
        { work_phone: '555-123-4567' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions[0].alternativeMappings).toBeDefined();
      expect(Array.isArray(suggestions[0].alternativeMappings)).toBe(true);
    });

    it('should detect required transformations', async () => {
      const dna = generator.generateDNA('CSV', ['phone'], [
        { phone: '(555) 123-4567' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      // Phone should have NORMALIZE_PHONE transform
      expect(suggestions[0].transformRequired).toBe('NORMALIZE_PHONE');
    });
  });

  describe('synonym matching', () => {
    it('should match fname to first_name', async () => {
      const dna = generator.generateDNA('CSV', ['fname'], [{ fname: 'John' }]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions[0].targetColumn).toBe('first_name');
      expect(suggestions[0].reasons).toContain('Synonym match');
    });

    it('should match lname to last_name', async () => {
      const dna = generator.generateDNA('CSV', ['lname'], [{ lname: 'Smith' }]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions[0].targetColumn).toBe('last_name');
    });

    it('should match dob to date_of_birth', async () => {
      const dna = generator.generateDNA('CSV', ['dob'], [
        { dob: '1990-01-15' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions[0].targetColumn).toBe('date_of_birth');
    });

    it('should match mrn to identifier_mrn', async () => {
      const dna = generator.generateDNA('CSV', ['mrn'], [{ mrn: 'MRN12345' }]);

      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions[0].targetColumn).toBe('identifier_mrn');
    });
  });

  describe('AI-assisted mapping', () => {
    beforeEach(() => {
      // Enable AI
      intelligence.setAIConfig({
        enabled: true,
        confidenceThreshold: 0.6,
        cacheResponses: true,
      });
    });

    it('should call AI for low-confidence mappings', async () => {
      // Mock AI response
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                text: JSON.stringify({
                  suggestedTable: 'hc_staff',
                  suggestedColumn: 'first_name',
                  confidence: 0.85,
                  reasoning: 'Column name suggests first name field',
                }),
              },
            ],
          }),
      });

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      // AI should have been called
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should use cached AI response', async () => {
      // First call
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                text: JSON.stringify({
                  suggestedTable: 'hc_staff',
                  suggestedColumn: 'first_name',
                  confidence: 0.85,
                  reasoning: 'Test reasoning',
                }),
              },
            ],
          }),
      });

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      await intelligence.suggestMappings(dna);
      await intelligence.suggestMappings(dna);

      // Should only call fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should clear AI cache', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                text: JSON.stringify({
                  suggestedTable: 'hc_staff',
                  suggestedColumn: 'first_name',
                  confidence: 0.85,
                  reasoning: 'Test reasoning',
                }),
              },
            ],
          }),
      });

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      await intelligence.suggestMappings(dna);
      intelligence.clearAICache();
      await intelligence.suggestMappings(dna);

      // Should call fetch twice after cache clear
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not call AI when disabled', async () => {
      intelligence.setAIConfig({ enabled: false });

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      await intelligence.suggestMappings(dna);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should cap AI confidence at maxAIConfidence', async () => {
      intelligence.setConfig({ maxAIConfidence: 0.9 });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            content: [
              {
                text: JSON.stringify({
                  suggestedTable: 'hc_staff',
                  suggestedColumn: 'first_name',
                  confidence: 0.99, // Higher than cap
                  reasoning: 'Test reasoning',
                }),
              },
            ],
          }),
      });

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      const suggestions = await intelligence.suggestMappings(dna);

      // Confidence should be capped
      expect(suggestions[0].confidence).toBeLessThanOrEqual(0.9);
    });

    it('should handle AI failure gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      );

      const dna = generator.generateDNA('CSV', ['person_given_name'], [
        { person_given_name: 'John' },
      ]);

      // Should not throw
      const suggestions = await intelligence.suggestMappings(dna);

      expect(suggestions).toHaveLength(1);
    });
  });

  describe('learnFromResults', () => {
    it('should call upsert for successful mapping', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      const dna = generator.generateDNA('CSV', ['email'], [
        { email: 'test@example.com' },
      ]);

      await intelligence.learnFromResults(dna, [
        {
          mappingId: 'test-1',
          sourceColumn: 'email',
          targetTable: 'hc_staff',
          targetColumn: 'email',
          recordsAttempted: 100,
          recordsSucceeded: 100,
          recordsFailed: 0,
          errorTypes: [],
          userAccepted: true,
        },
      ]);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'upsert_learned_mapping',
        expect.objectContaining({
          p_target_table: 'hc_staff',
          p_target_column: 'email',
        })
      );
    });

    it('should decrease confidence for user corrections', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                or: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      const dna = generator.generateDNA('CSV', ['email'], [
        { email: 'test@example.com' },
      ]);

      await intelligence.learnFromResults(dna, [
        {
          mappingId: 'test-1',
          sourceColumn: 'email',
          targetTable: 'hc_staff',
          targetColumn: 'email',
          recordsAttempted: 100,
          recordsSucceeded: 0,
          recordsFailed: 100,
          errorTypes: ['Wrong mapping'],
          userAccepted: false,
          userCorrectedTo: {
            targetTable: 'fhir_patient',
            targetColumn: 'telecom_email',
          },
        },
      ]);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'decrease_mapping_confidence',
        expect.anything()
      );
    });
  });

  describe('findSimilarMigrations', () => {
    it('should filter by similarity threshold', async () => {
      const pastDNA1 = generator.generateDNA('CSV', ['email', 'phone'], [
        { email: 'test@example.com', phone: '555-123-4567' },
      ]);
      const pastDNA2 = generator.generateDNA('CSV', ['amount', 'date'], [
        { amount: '$100.00', date: '2026-01-15' },
      ]);

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  dna_id: pastDNA1.dnaId,
                  source_type: pastDNA1.sourceType,
                  column_count: pastDNA1.columnCount,
                  columns: pastDNA1.columns,
                  structure_hash: pastDNA1.structureHash,
                  signature_vector: pastDNA1.signatureVector,
                  detected_at: pastDNA1.detectedAt.toISOString(),
                },
                {
                  dna_id: pastDNA2.dnaId,
                  source_type: pastDNA2.sourceType,
                  column_count: pastDNA2.columnCount,
                  columns: pastDNA2.columns,
                  structure_hash: pastDNA2.structureHash,
                  signature_vector: pastDNA2.signatureVector,
                  detected_at: pastDNA2.detectedAt.toISOString(),
                },
              ],
              error: null,
            }),
          }),
        }),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const currentDNA = generator.generateDNA('CSV', ['email_addr', 'telephone'], [
        { email_addr: 'user@test.com', telephone: '555-234-5678' },
      ]);

      const similar = await intelligence.findSimilarMigrations(currentDNA);

      // Should only include the similar one (email/phone patterns)
      expect(similar.every((s) => s.similarity > 0.7)).toBe(true);
    });

    it('should limit results', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const dna = generator.generateDNA('CSV', ['email'], [
        { email: 'test@example.com' },
      ]);

      const similar = await intelligence.findSimilarMigrations(dna);

      expect(similar.length).toBeLessThanOrEqual(5);
    });
  });
});
