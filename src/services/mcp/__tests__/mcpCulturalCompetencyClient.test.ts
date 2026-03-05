/**
 * Tests for Cultural Competency MCP Client
 *
 * Tests population-specific cultural context operations:
 * - Cultural profile retrieval
 * - Clinical considerations lookup
 * - Communication guidance
 * - Barriers to care
 * - Trust-building guidance
 * - Drug interaction cultural context
 * - SDOH code lookup
 * - Profile seeding
 */

import {
  getCulturalContext,
  getClinicalConsiderations,
  getCommunicationGuidance,
  getBarriersToCare,
  getTrustBuildingGuidance,
  checkDrugInteractionCultural,
  getSdohCodes,
  seedCulturalProfiles,
  CulturalCompetencyMCPClient,
  VALID_POPULATIONS,
  VALID_CONTEXTS
} from '../mcpCulturalCompetencyClient';

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

describe('CulturalCompetencyMCPClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCulturalContext', () => {
    it('should retrieve full cultural profile for a population', async () => {
      const mockProfile = {
        populationKey: 'veterans',
        displayName: 'Veterans',
        description: 'Military service veterans',
        caveat: 'Individual experiences vary widely',
        communication: {
          languagePreferences: ['English'],
          formalityLevel: 'moderate',
          familyInvolvementNorm: 'Varies by era and branch',
          keyPhrases: ['service-connected', 'mission'],
          avoidPhrases: ['victim'],
          contextSpecific: { medication: 'Use military time references' }
        },
        clinicalConsiderations: [
          { condition: 'PTSD', prevalence: 'High', screeningRecommendation: 'PC-PTSD-5', clinicalNote: 'Screen at intake' }
        ],
        barriers: [
          { barrier: 'Stigma around mental health', impact: 'Delayed treatment', mitigation: 'Normalize peer support' }
        ],
        culturalPractices: [],
        trustFactors: [
          { factor: 'VA system distrust', historicalContext: 'Claims backlog', trustBuildingStrategy: 'Acknowledge systemic issues' }
        ],
        supportSystems: [],
        sdohCodes: [
          { code: 'Z91.82', description: 'Personal history of military deployment', applicability: 'All veterans' }
        ],
        culturalRemedies: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockProfile }]
        })
      });

      const result = await getCulturalContext('veterans');

      expect(result.success).toBe(true);
      expect(result.data?.populationKey).toBe('veterans');
      expect(result.data?.displayName).toBe('Veterans');
      expect(result.data?.clinicalConsiderations).toHaveLength(1);
      expect(result.data?.clinicalConsiderations[0].condition).toBe('PTSD');
      expect(result.data?.barriers).toHaveLength(1);
      expect(result.data?.trustFactors).toHaveLength(1);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Population not found'
      });

      const result = await getCulturalContext('veterans');

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });
  });

  describe('getClinicalConsiderations', () => {
    it('should retrieve clinical considerations for a population', async () => {
      const mockConsiderations = {
        populationKey: 'black_aa',
        considerations: [
          { condition: 'Hypertension', prevalence: 'Higher than general population', screeningRecommendation: 'Annual BP check', clinicalNote: 'Consider thiazide diuretics' },
          { condition: 'Sickle Cell Disease', prevalence: 'Carrier rate ~8%', screeningRecommendation: 'Newborn screening', clinicalNote: 'Pain crisis protocols' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockConsiderations }]
        })
      });

      const result = await getClinicalConsiderations('black_aa');

      expect(result.success).toBe(true);
      expect(result.data?.populationKey).toBe('black_aa');
      expect(result.data?.considerations).toHaveLength(2);
      expect(result.data?.considerations[0].condition).toBe('Hypertension');
    });

    it('should pass clinical domain filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { populationKey: 'latino', considerations: [] } }]
        })
      });

      await getClinicalConsiderations('latino', 'cardiology');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"clinical_domain":"cardiology"')
        })
      );
    });
  });

  describe('getCommunicationGuidance', () => {
    it('should retrieve communication guidance for a population', async () => {
      const mockGuidance = {
        populationKey: 'isolated_elderly',
        guidance: {
          languagePreferences: ['English'],
          formalityLevel: 'formal',
          familyInvolvementNorm: 'May have limited family contact',
          keyPhrases: ['How are you feeling today?'],
          avoidPhrases: ['You should have called sooner'],
          contextSpecific: { medication: 'Write large print instructions' }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockGuidance }]
        })
      });

      const result = await getCommunicationGuidance('isolated_elderly');

      expect(result.success).toBe(true);
      expect(result.data?.guidance.formalityLevel).toBe('formal');
      expect(result.data?.guidance.keyPhrases).toContain('How are you feeling today?');
    });

    it('should pass scenario filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { populationKey: 'indigenous', guidance: {} } }]
        })
      });

      await getCommunicationGuidance('indigenous', 'discharge');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"scenario":"discharge"')
        })
      );
    });
  });

  describe('getBarriersToCare', () => {
    it('should retrieve barriers to care for a population', async () => {
      const mockBarriers = {
        populationKey: 'unhoused',
        barriers: [
          { barrier: 'No stable address', impact: 'Cannot receive mail or follow-up calls', mitigation: 'Use shelter address or community health center' },
          { barrier: 'Transportation', impact: 'Cannot attend appointments', mitigation: 'Mobile health clinics or telehealth' },
          { barrier: 'Documentation', impact: 'May lack ID for insurance enrollment', mitigation: 'Connect with social worker for ID assistance' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockBarriers }]
        })
      });

      const result = await getBarriersToCare('unhoused');

      expect(result.success).toBe(true);
      expect(result.data?.populationKey).toBe('unhoused');
      expect(result.data?.barriers).toHaveLength(3);
      expect(result.data?.barriers[0].barrier).toBe('No stable address');
      expect(result.data?.barriers[1].mitigation).toContain('telehealth');
    });
  });

  describe('getTrustBuildingGuidance', () => {
    it('should retrieve trust-building guidance for a population', async () => {
      const mockTrust = {
        populationKey: 'indigenous',
        trustFactors: [
          { factor: 'Historical trauma', historicalContext: 'Forced assimilation policies', trustBuildingStrategy: 'Acknowledge historical context explicitly' },
          { factor: 'Sovereignty', historicalContext: 'Self-governance rights', trustBuildingStrategy: 'Respect tribal health protocols' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockTrust }]
        })
      });

      const result = await getTrustBuildingGuidance('indigenous');

      expect(result.success).toBe(true);
      expect(result.data?.trustFactors).toHaveLength(2);
      expect(result.data?.trustFactors[0].factor).toBe('Historical trauma');
      expect(result.data?.trustFactors[1].trustBuildingStrategy).toContain('tribal health');
    });
  });

  describe('checkDrugInteractionCultural', () => {
    it('should check drug interactions with cultural remedies', async () => {
      const mockInteraction = {
        populationKey: 'latino',
        medications: ['warfarin', 'metformin'],
        culturalRemedies: [
          { remedy: 'Chamomile tea', commonUse: 'Sleep aid and digestive', potentialInteractions: ['May potentiate warfarin'], warningLevel: 'warning' },
          { remedy: 'Nopal cactus', commonUse: 'Blood sugar management', potentialInteractions: ['May enhance hypoglycemic effect'], warningLevel: 'caution' }
        ],
        warnings: ['Chamomile may increase bleeding risk with warfarin'],
        recommendations: ['Ask about herbal supplement use at each visit']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockInteraction }]
        })
      });

      const result = await checkDrugInteractionCultural('latino', ['warfarin', 'metformin']);

      expect(result.success).toBe(true);
      expect(result.data?.culturalRemedies).toHaveLength(2);
      expect(result.data?.culturalRemedies[0].warningLevel).toBe('warning');
      expect(result.data?.warnings).toHaveLength(1);
      expect(result.data?.recommendations).toHaveLength(1);
    });

    it('should send medications array in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { populationKey: 'veterans', medications: [], culturalRemedies: [], warnings: [], recommendations: [] } }]
        })
      });

      await checkDrugInteractionCultural('veterans', ['lisinopril']);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.arguments.medications).toEqual(['lisinopril']);
      expect(callBody.arguments.population_key).toBe('veterans');
    });
  });

  describe('getSdohCodes', () => {
    it('should retrieve SDOH Z-codes', async () => {
      const mockCodes = {
        codes: [
          { code: 'Z59.0', description: 'Homelessness', applicability: 'Unhoused populations' },
          { code: 'Z59.1', description: 'Inadequate housing', applicability: 'Housing instability' },
          { code: 'Z60.2', description: 'Living alone', applicability: 'Isolated elderly' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockCodes }]
        })
      });

      const result = await getSdohCodes();

      expect(result.success).toBe(true);
      expect(result.data?.codes).toHaveLength(3);
      expect(result.data?.codes[0].code).toBe('Z59.0');
    });

    it('should pass category filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { codes: [], category: 'housing' } }]
        })
      });

      await getSdohCodes('housing');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"category":"housing"')
        })
      );
    });
  });

  describe('seedCulturalProfiles', () => {
    it('should seed profiles and return count', async () => {
      const mockSeed = {
        seeded: 8,
        populations: ['veterans', 'unhoused', 'latino', 'black_aa', 'isolated_elderly', 'indigenous', 'immigrant_refugee', 'lgbtq_elderly']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: mockSeed }]
        })
      });

      const result = await seedCulturalProfiles();

      expect(result.success).toBe(true);
      expect(result.data?.seeded).toBe(8);
      expect(result.data?.populations).toHaveLength(8);
    });
  });

  describe('Constants', () => {
    it('should have all 8 valid populations', () => {
      expect(VALID_POPULATIONS).toHaveLength(8);
      expect(VALID_POPULATIONS).toContain('veterans');
      expect(VALID_POPULATIONS).toContain('unhoused');
      expect(VALID_POPULATIONS).toContain('latino');
      expect(VALID_POPULATIONS).toContain('black_aa');
      expect(VALID_POPULATIONS).toContain('isolated_elderly');
      expect(VALID_POPULATIONS).toContain('indigenous');
      expect(VALID_POPULATIONS).toContain('immigrant_refugee');
      expect(VALID_POPULATIONS).toContain('lgbtq_elderly');
    });

    it('should have all 5 valid communication contexts', () => {
      expect(VALID_CONTEXTS).toHaveLength(5);
      expect(VALID_CONTEXTS).toContain('medication');
      expect(VALID_CONTEXTS).toContain('diagnosis');
      expect(VALID_CONTEXTS).toContain('care_plan');
      expect(VALID_CONTEXTS).toContain('discharge');
      expect(VALID_CONTEXTS).toContain('general');
    });
  });

  describe('CulturalCompetencyMCPClient class', () => {
    it('should instantiate correctly', () => {
      const client = new CulturalCompetencyMCPClient();
      expect(client).toBeDefined();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getCulturalContext('veterans');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      });

      const result = await getCulturalContext('veterans');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid response format');
    });

    it('should send correct authorization headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { populationKey: 'veterans' } }]
        })
      });

      await getCulturalContext('veterans');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('mcp-cultural-competency-server'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'apikey': 'test-token'
          })
        })
      );
    });

    it('should call correct endpoint with tool name and arguments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'json', data: { populationKey: 'black_aa', barriers: [] } }]
        })
      });

      await getBarriersToCare('black_aa');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.name).toBe('get_barriers_to_care');
      expect(callBody.arguments.population_key).toBe('black_aa');
    });
  });
});
