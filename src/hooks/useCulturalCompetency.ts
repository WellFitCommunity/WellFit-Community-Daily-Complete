/**
 * useCulturalCompetency — React hook for Cultural Competency MCP Server
 *
 * Provides client-side access to cultural competency profiles
 * via the MCP edge function. Uses React Query for caching.
 *
 * Usage:
 *   const { data: profile, isLoading } = useCulturalContext("veterans");
 *   const { data: comm } = useCommunicationGuidance("latino", "medication");
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

// =====================================================
// Types (mirrored from MCP server responses)
// =====================================================

export interface CulturalProfile {
  status: string;
  population: string;
  displayName: string;
  description: string;
  caveat: string;
  communication: {
    languagePreferences: string[];
    formalityLevel: string;
    familyInvolvementNorm: string;
    keyPhrases: string[];
    avoidPhrases: string[];
    contextSpecific: Record<string, string>;
  };
  clinicalConsiderations: Array<{
    condition: string;
    prevalence: string;
    screeningRecommendation: string;
    clinicalNote: string;
  }>;
  barriers: Array<{
    barrier: string;
    impact: string;
    mitigation: string;
  }>;
  trustFactors: Array<{
    factor: string;
    historicalContext: string;
    trustBuildingStrategy: string;
  }>;
  sdohCodes: Array<{
    code: string;
    description: string;
    applicability: string;
  }>;
  culturalRemedies: Array<{
    remedy: string;
    commonUse: string;
    potentialInteractions: string[];
    warningLevel: 'info' | 'caution' | 'warning';
  }>;
}

export interface CommunicationGuidance {
  status: string;
  population: string;
  context: string;
  caveat: string;
  languagePreferences: string[];
  formalityLevel: string;
  familyInvolvementNorm: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  contextSpecificGuidance: string | null;
}

// =====================================================
// MCP Client (browser-side)
// =====================================================

async function callCulturalMCP<T>(
  toolName: string,
  args: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    'mcp-cultural-competency-server',
    {
      body: {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: toolName, arguments: args },
        id: crypto.randomUUID(),
      },
    }
  );

  if (error) {
    throw new Error(`Cultural competency MCP error: ${error.message}`);
  }

  // MCP response path: result.content[0].text (JSON string)
  const textContent = data?.result?.content?.[0]?.text;
  if (!textContent) {
    throw new Error('Empty response from Cultural Competency MCP server');
  }

  const parsed = JSON.parse(textContent) as Record<string, unknown>;
  if (parsed.error) {
    throw new Error(String(parsed.error));
  }

  return parsed as T;
}

// =====================================================
// React Query Hooks
// =====================================================

const CULTURAL_CACHE_TIME = 1000 * 60 * 30; // 30 minutes — reference data changes rarely

/**
 * Fetch the full cultural profile for a population.
 * Returns null-safe — disabled when population is empty.
 */
export function useCulturalContext(population: string | undefined) {
  return useQuery({
    queryKey: ['cultural-competency', 'context', population],
    queryFn: () => callCulturalMCP<CulturalProfile>('get_cultural_context', { population: population ?? '' }),
    enabled: !!population,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Fetch communication guidance for a specific clinical context.
 */
export function useCommunicationGuidance(
  population: string | undefined,
  context?: 'medication' | 'diagnosis' | 'care_plan' | 'discharge'
) {
  return useQuery({
    queryKey: ['cultural-competency', 'communication', population, context],
    queryFn: () =>
      callCulturalMCP<CommunicationGuidance>('get_communication_guidance', {
        population: population ?? '',
        context: context || 'general',
      }),
    enabled: !!population,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Fetch barriers to care for a population.
 */
export function useBarriersToCare(population: string | undefined) {
  return useQuery({
    queryKey: ['cultural-competency', 'barriers', population],
    queryFn: () =>
      callCulturalMCP<{ barriers: CulturalProfile['barriers'] }>('get_barriers_to_care', {
        population: population ?? '',
      }),
    enabled: !!population,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Check cultural remedy / drug interactions.
 */
export function useDrugInteractionCultural(
  population: string | undefined,
  medications: string[]
) {
  return useQuery({
    queryKey: ['cultural-competency', 'drug-interaction', population, medications],
    queryFn: () =>
      callCulturalMCP<{ culturalRemedies: CulturalProfile['culturalRemedies'] }>(
        'check_drug_interaction_cultural',
        { population: population ?? '', medications }
      ),
    enabled: !!population && medications.length > 0,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Fetch SDOH Z-codes for a population.
 */
export function useSDOHCodes(population: string | undefined) {
  return useQuery({
    queryKey: ['cultural-competency', 'sdoh', population],
    queryFn: () =>
      callCulturalMCP<{ sdohCodes: CulturalProfile['sdohCodes'] }>('get_sdoh_codes', {
        population: population ?? '',
      }),
    enabled: !!population,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Fetch trust-building guidance for a population.
 */
export function useTrustBuildingGuidance(population: string | undefined) {
  return useQuery({
    queryKey: ['cultural-competency', 'trust', population],
    queryFn: () =>
      callCulturalMCP<{ trustFactors: CulturalProfile['trustFactors'] }>(
        'get_trust_building_guidance',
        { population: population ?? '' }
      ),
    enabled: !!population,
    staleTime: CULTURAL_CACHE_TIME,
    gcTime: CULTURAL_CACHE_TIME,
  });
}

/**
 * Available population keys for selection UI.
 */
export const AVAILABLE_POPULATIONS = [
  { key: 'veterans', label: 'Veterans / Military Service Members' },
  { key: 'unhoused', label: 'Unhoused / Experiencing Homelessness' },
  { key: 'latino', label: 'Spanish-Speaking / Latino / Hispanic' },
  { key: 'black_aa', label: 'Black / African American' },
  { key: 'isolated_elderly', label: 'Isolated Elderly / Socially Disconnected Seniors' },
  { key: 'indigenous', label: 'Indigenous / Native American / Alaska Native' },
  { key: 'immigrant_refugee', label: 'Immigrant / Refugee' },
  { key: 'lgbtq_elderly', label: 'LGBTQ+ Elderly' },
] as const;
