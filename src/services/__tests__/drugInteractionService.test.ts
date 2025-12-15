/**
 * Drug Interaction Service Tests
 * Tests both RxNorm API integration and Claude enhancement
 */

import {
  checkDrugInteractions,
  enhanceInteractionWithClaude,
  findRxCUI,
  getMedicationDetails,
  searchMedications,
  checkInteractionsWithAI,
  getSeverityColor,
  getSeverityIcon,
  DrugInteraction,
  DrugInteractionResult
} from '../drugInteractionService';
import { supabase } from '../../lib/supabaseClient';

// Mock Supabase
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

// Mock fetch for RxNorm API calls
global.fetch = vi.fn();

describe('Drug Interaction Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDrugInteractions', () => {
    it('should successfully check interactions via edge function', async () => {
      const mockResult: DrugInteractionResult = {
        has_interactions: true,
        interactions: [
          {
            severity: 'high',
            interacting_medication: 'Aspirin',
            description: 'Increased risk of bleeding',
            source: 'rxnorm'
          }
        ],
        checked_against: ['Aspirin'],
        medication_name: 'Warfarin',
        medication_rxcui: '207106',
        total_active_medications: 1,
        cache_hit: false
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await checkDrugInteractions('207106', 'patient-123', 'Warfarin');

      expect(result.has_interactions).toBe(true);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].severity).toBe('high');
      expect(supabase.functions.invoke).toHaveBeenCalledWith('check-drug-interactions', {
        body: {
          medication_rxcui: '207106',
          patient_id: 'patient-123',
          medication_name: 'Warfarin'
        }
      });
    });

    it('should handle no interactions found', async () => {
      const mockResult: DrugInteractionResult = {
        has_interactions: false,
        interactions: [],
        checked_against: ['Metformin'],
        medication_name: 'Lisinopril',
        medication_rxcui: '314076',
        total_active_medications: 1,
        cache_hit: true
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockResult,
        error: null
      });

      const result = await checkDrugInteractions('314076', 'patient-123', 'Lisinopril');

      expect(result.has_interactions).toBe(false);
      expect(result.interactions).toHaveLength(0);
      expect(result.cache_hit).toBe(true);
    });

    it('should handle edge function errors', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Network error' }
      });

      await expect(
        checkDrugInteractions('207106', 'patient-123', 'Warfarin')
      ).rejects.toThrow('Failed to check interactions: Network error');
    });
  });

  describe('enhanceInteractionWithClaude', () => {
    const baseInteraction: DrugInteraction = {
      severity: 'high',
      interacting_medication: 'Aspirin',
      description: 'Increased bleeding risk',
      source: 'rxnorm'
    };

    it('should enhance interaction with Claude analysis', async () => {
      const claudeResponse = {
        response: JSON.stringify({
          clinical_effects: 'Both medications inhibit platelet aggregation, increasing bleeding risk.',
          management: [
            'Monitor for signs of bleeding',
            'Check INR weekly',
            'Consider alternative antiplatelet agent'
          ],
          patient_friendly_explanation: 'These medications together can increase your risk of bleeding. Watch for unusual bruising or blood in urine/stool.',
          severity: 'high',
          severity_justification: 'Major bleeding risk requiring close monitoring'
        })
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: claudeResponse,
        error: null
      });

      const enhanced = await enhanceInteractionWithClaude(
        baseInteraction,
        'Warfarin',
        { age: 65, conditions: ['Atrial fibrillation'] }
      );

      expect(enhanced.clinical_effects).toContain('platelet aggregation');
      expect(enhanced.management).toContain('Monitor for signs of bleeding');
      expect(enhanced.patient_friendly_explanation).toContain('risk of bleeding');
      expect(enhanced.confidence).toBe(0.95);
    });

    it('should handle Claude errors gracefully', async () => {
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: 'Claude timeout' }
      });

      const enhanced = await enhanceInteractionWithClaude(baseInteraction, 'Warfarin');

      // Should return original interaction if Claude fails
      expect(enhanced).toEqual(baseInteraction);
    });

    it('should parse Claude response with markdown code blocks', async () => {
      const claudeResponse = {
        response: `Here's the analysis:

\`\`\`json
{
  "clinical_effects": "Test effect",
  "management": ["Step 1", "Step 2"],
  "patient_friendly_explanation": "Test explanation",
  "severity": "moderate"
}
\`\`\`

Hope this helps!`
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: claudeResponse,
        error: null
      });

      const enhanced = await enhanceInteractionWithClaude(baseInteraction, 'Warfarin');

      expect(enhanced.clinical_effects).toBe('Test effect');
      expect(enhanced.severity).toBe('moderate');
    });
  });

  describe('findRxCUI', () => {
    it('should find RxCUI for medication name', async () => {
      const mockResponse = {
        idGroup: {
          rxnormId: ['207106']
        }
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => mockResponse
      });

      const rxcui = await findRxCUI('Warfarin');

      expect(rxcui).toBe('207106');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('rxcui.json?name=Warfarin')
      );
    });

    it('should return null if medication not found', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({})
      });

      const rxcui = await findRxCUI('NonexistentDrug123');

      expect(rxcui).toBeNull();
    });

    it('should handle API errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const rxcui = await findRxCUI('Warfarin');

      expect(rxcui).toBeNull();
    });
  });

  describe('getMedicationDetails', () => {
    it('should get medication details from RxCUI', async () => {
      const mockResponse = {
        properties: {
          name: 'Warfarin',
          genericName: 'Warfarin',
          brandNames: ['Coumadin', 'Jantoven']
        }
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => mockResponse
      });

      const details = await getMedicationDetails('207106');

      expect(details).toEqual({
        name: 'Warfarin',
        genericName: 'Warfarin',
        brandNames: ['Coumadin', 'Jantoven']
      });
    });

    it('should return null if medication not found', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => ({})
      });

      const details = await getMedicationDetails('999999');

      expect(details).toBeNull();
    });
  });

  describe('searchMedications', () => {
    it('should search and return medication suggestions', async () => {
      const mockResponse = {
        drugGroup: {
          conceptGroup: [
            {
              conceptProperties: [
                { rxcui: '207106', name: 'Warfarin' },
                { rxcui: '855332', name: 'Warfarin Sodium' }
              ]
            }
          ]
        }
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => mockResponse
      });

      const results = await searchMedications('Warf');

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Warfarin');
      expect(results[0].rxcui).toBe('207106');
    });

    it('should return empty array for short queries', async () => {
      const results = await searchMedications('W');
      expect(results).toHaveLength(0);
    });

    it('should limit results', async () => {
      const mockResponse = {
        drugGroup: {
          conceptGroup: [
            {
              conceptProperties: Array.from({ length: 20 }, (_, i) => ({
                rxcui: `${i}`,
                name: `Drug ${i}`
              }))
            }
          ]
        }
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        json: async () => mockResponse
      });

      const results = await searchMedications('Drug', 5);

      expect(results).toHaveLength(5);
    });
  });

  describe('checkInteractionsWithAI', () => {
    it('should check interactions and enhance with Claude', async () => {
      const basicResult: DrugInteractionResult = {
        has_interactions: true,
        interactions: [
          {
            severity: 'high',
            interacting_medication: 'Aspirin',
            description: 'Bleeding risk',
            source: 'rxnorm'
          }
        ],
        checked_against: ['Aspirin'],
        medication_name: 'Warfarin',
        medication_rxcui: '207106',
        total_active_medications: 1,
        cache_hit: false
      };

      const claudeResponse = {
        response: JSON.stringify({
          clinical_effects: 'Enhanced analysis',
          management: ['Monitor INR'],
          patient_friendly_explanation: 'Watch for bleeding',
          severity: 'high'
        })
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: basicResult, error: null }) // First call: check interactions
        .mockResolvedValueOnce({ data: claudeResponse, error: null }); // Second call: Claude enhancement

      const result = await checkInteractionsWithAI(
        '207106',
        'Warfarin',
        'patient-123',
        true,
        { age: 65 }
      );

      expect(result.has_interactions).toBe(true);
      expect(result.interactions[0].clinical_effects).toBe('Enhanced analysis');
    });

    it('should skip Claude enhancement when disabled', async () => {
      const basicResult: DrugInteractionResult = {
        has_interactions: true,
        interactions: [
          {
            severity: 'high',
            interacting_medication: 'Aspirin',
            description: 'Bleeding risk',
            source: 'rxnorm'
          }
        ],
        checked_against: ['Aspirin'],
        medication_name: 'Warfarin',
        medication_rxcui: '207106',
        total_active_medications: 1,
        cache_hit: false
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: basicResult,
        error: null
      });

      const result = await checkInteractionsWithAI(
        '207106',
        'Warfarin',
        'patient-123',
        false // Don't enhance with Claude
      );

      expect(result.has_interactions).toBe(true);
      expect(result.interactions[0].clinical_effects).toBeUndefined();
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1); // Only basic check
    });
  });

  describe('UI Helper Functions', () => {
    describe('getSeverityColor', () => {
      it('should return correct color for each severity', () => {
        expect(getSeverityColor('contraindicated')).toBe('#DC2626'); // Red
        expect(getSeverityColor('high')).toBe('#EA580C'); // Orange
        expect(getSeverityColor('moderate')).toBe('#F59E0B'); // Yellow
        expect(getSeverityColor('low')).toBe('#10B981'); // Green
        expect(getSeverityColor('unknown')).toBe('#6B7280'); // Gray
      });

      it('should be case-insensitive', () => {
        expect(getSeverityColor('HIGH')).toBe('#EA580C');
        expect(getSeverityColor('Moderate')).toBe('#F59E0B');
      });
    });

    describe('getSeverityIcon', () => {
      it('should return correct icon for each severity', () => {
        expect(getSeverityIcon('contraindicated')).toBe('🛑');
        expect(getSeverityIcon('high')).toBe('⚠️');
        expect(getSeverityIcon('moderate')).toBe('⚡');
        expect(getSeverityIcon('low')).toBe('ℹ️');
        expect(getSeverityIcon('unknown')).toBe('❓');
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: search -> check -> enhance', async () => {
      // Mock search
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        json: async () => ({
          drugGroup: {
            conceptGroup: [
              {
                conceptProperties: [{ rxcui: '207106', name: 'Warfarin' }]
              }
            ]
          }
        })
      });

      // Mock interaction check
      const basicResult: DrugInteractionResult = {
        has_interactions: true,
        interactions: [
          {
            severity: 'high',
            interacting_medication: 'Aspirin',
            description: 'Bleeding risk',
            source: 'rxnorm'
          }
        ],
        checked_against: ['Aspirin'],
        medication_name: 'Warfarin',
        medication_rxcui: '207106',
        total_active_medications: 1,
        cache_hit: false
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: basicResult, error: null })
        .mockResolvedValueOnce({
          data: {
            response: JSON.stringify({
              clinical_effects: 'Complete analysis',
              management: ['Full monitoring'],
              patient_friendly_explanation: 'Complete explanation',
              severity: 'high'
            })
          },
          error: null
        });

      // Step 1: Search
      const searchResults = await searchMedications('Warf');
      expect(searchResults[0].name).toBe('Warfarin');

      // Step 2: Check interactions with AI
      const result = await checkInteractionsWithAI(
        searchResults[0].rxcui,
        searchResults[0].name,
        'patient-123',
        true
      );

      expect(result.has_interactions).toBe(true);
      expect(result.interactions[0].clinical_effects).toBe('Complete analysis');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty patient context', async () => {
      const interaction: DrugInteraction = {
        severity: 'high',
        interacting_medication: 'Aspirin',
        description: 'Bleeding risk',
        source: 'rxnorm'
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          response: JSON.stringify({
            clinical_effects: 'Test',
            management: ['Test'],
            patient_friendly_explanation: 'Test',
            severity: 'high'
          })
        },
        error: null
      });

      const enhanced = await enhanceInteractionWithClaude(interaction, 'Warfarin');

      expect(enhanced.clinical_effects).toBe('Test');
    });

    it('should handle malformed Claude JSON', async () => {
      const interaction: DrugInteraction = {
        severity: 'high',
        interacting_medication: 'Aspirin',
        description: 'Bleeding risk',
        source: 'rxnorm'
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { response: 'This is not JSON at all!' },
        error: null
      });

      const enhanced = await enhanceInteractionWithClaude(interaction, 'Warfarin');

      // Should return original interaction
      expect(enhanced).toEqual(interaction);
    });

    it('should handle multiple interactions enhancement', async () => {
      const basicResult: DrugInteractionResult = {
        has_interactions: true,
        interactions: [
          {
            severity: 'high',
            interacting_medication: 'Aspirin',
            description: 'Bleeding risk',
            source: 'rxnorm'
          },
          {
            severity: 'moderate',
            interacting_medication: 'Ibuprofen',
            description: 'Reduced efficacy',
            source: 'rxnorm'
          }
        ],
        checked_against: ['Aspirin', 'Ibuprofen'],
        medication_name: 'Warfarin',
        medication_rxcui: '207106',
        total_active_medications: 2,
        cache_hit: false
      };

      (supabase.functions.invoke as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: basicResult, error: null })
        .mockResolvedValue({
          data: {
            response: JSON.stringify({
              clinical_effects: 'Enhanced',
              management: ['Monitor'],
              patient_friendly_explanation: 'Watch',
              severity: 'high'
            })
          },
          error: null
        });

      const result = await checkInteractionsWithAI(
        '207106',
        'Warfarin',
        'patient-123',
        true
      );

      expect(result.interactions).toHaveLength(2);
      expect(result.interactions[0].clinical_effects).toBe('Enhanced');
      expect(result.interactions[1].clinical_effects).toBe('Enhanced');
    });
  });
});
