/**
 * Voice Search Service
 *
 * Provides intelligent search capabilities for voice commands.
 * Searches patients, beds, providers, and other entities by natural language.
 *
 * ATLUS: Intuitive Technology - Natural language entity search
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ParsedEntity, SearchResult } from '../contexts/VoiceActionContext';
import { auditLogger } from './auditLogger';

// ============================================================================
// TYPES
// ============================================================================

interface PatientRecord {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  mrn?: string;
  room_number?: string;
  bed_number?: string;
  risk_score?: number;
  unit?: string;
  acuity_level?: number;
}

interface BedRecord {
  id: string;
  bed_id: string;
  room_number: string;
  unit: string;
  status: string;
  patient_id?: string;
  patient_name?: string;
}

interface ProviderRecord {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  role: string;
  specialty?: string;
  department?: string;
}

// ============================================================================
// STRING MATCHING UTILITIES
// ============================================================================

/**
 * Calculate similarity score between two strings (0-100)
 * Uses a combination of exact match, starts-with, and contains logic
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 100;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return Math.round((shorter / longer) * 90);
  }

  // Starts with match
  if (s1.startsWith(s2) || s2.startsWith(s1)) {
    return 80;
  }

  // Word-by-word match
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matchedWords = 0;
  for (const w1 of words1) {
    if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
      matchedWords++;
    }
  }
  if (matchedWords > 0) {
    return Math.round((matchedWords / Math.max(words1.length, words2.length)) * 70);
  }

  // Levenshtein distance for fuzzy match
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  if (distance <= maxLen * 0.3) {
    return Math.round((1 - distance / maxLen) * 60);
  }

  return 0;
}

/**
 * Calculate Levenshtein edit distance
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Format date for display
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get risk level label from score
 */
function getRiskLabel(score?: number): string {
  if (!score) return '';
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Search for patients by name, DOB, MRN, or room
 */
export async function searchPatients(
  supabase: SupabaseClient,
  entity: ParsedEntity
): Promise<SearchResult[]> {
  try {
    const { filters } = entity;
    let query = supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name, date_of_birth, mrn, room_number, bed_number, risk_score, hospital_unit')
      .limit(20);

    // Apply filters
    if (filters.name) {
      // Search by full name (case-insensitive)
      const nameParts = filters.name.split(/\s+/);
      if (nameParts.length >= 2) {
        query = query
          .ilike('first_name', `%${nameParts[0]}%`)
          .ilike('last_name', `%${nameParts.slice(1).join(' ')}%`);
      } else {
        // Single name - search both fields
        query = query.or(`first_name.ilike.%${filters.name}%,last_name.ilike.%${filters.name}%`);
      }
    }

    if (filters.firstName && !filters.name) {
      query = query.ilike('first_name', `%${filters.firstName}%`);
    }

    if (filters.lastName && !filters.name) {
      query = query.ilike('last_name', `%${filters.lastName}%`);
    }

    if (filters.dateOfBirth) {
      query = query.eq('date_of_birth', filters.dateOfBirth);
    }

    if (filters.mrn) {
      query = query.eq('mrn', filters.mrn);
    }

    if (filters.roomNumber) {
      query = query.eq('room_number', filters.roomNumber);
    }

    if (filters.riskLevel) {
      // Filter by risk level ranges
      switch (filters.riskLevel) {
        case 'critical':
          query = query.gte('risk_score', 80);
          break;
        case 'high':
          query = query.gte('risk_score', 60);
          break;
        case 'medium':
          query = query.gte('risk_score', 40).lt('risk_score', 60);
          break;
        case 'low':
          query = query.lt('risk_score', 40);
          break;
      }
    }

    const { data, error } = await query;

    if (error) {
      auditLogger.error('VOICE_SEARCH_PATIENTS_FAILED', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate match scores and build results
    const results: SearchResult[] = data.map((patient: PatientRecord) => {
      const fullName = `${patient.first_name} ${patient.last_name}`;
      let matchScore = 0;

      // Calculate match score based on what was searched
      if (filters.name) {
        matchScore = Math.max(matchScore, calculateSimilarity(fullName, filters.name));
      }
      if (filters.firstName) {
        matchScore = Math.max(matchScore, calculateSimilarity(patient.first_name, filters.firstName));
      }
      if (filters.lastName) {
        matchScore = Math.max(matchScore, calculateSimilarity(patient.last_name, filters.lastName));
      }
      if (filters.dateOfBirth && patient.date_of_birth === filters.dateOfBirth) {
        matchScore = Math.max(matchScore, 95);
      }
      if (filters.mrn && patient.mrn === filters.mrn) {
        matchScore = 100;
      }
      if (filters.roomNumber && patient.room_number === filters.roomNumber) {
        matchScore = Math.max(matchScore, 90);
      }
      if (filters.riskLevel) {
        matchScore = 85; // Risk level filter always matches if returned
      }

      // Build secondary text with available info
      const infoParts: string[] = [];
      if (patient.date_of_birth) infoParts.push(`DOB: ${formatDate(patient.date_of_birth)}`);
      if (patient.mrn) infoParts.push(`MRN: ${patient.mrn}`);
      if (patient.room_number) infoParts.push(`Room: ${patient.room_number}`);
      if (patient.risk_score) infoParts.push(`Risk: ${getRiskLabel(patient.risk_score)}`);

      return {
        id: patient.user_id || patient.id,
        type: 'patient' as const,
        primaryText: fullName,
        secondaryText: infoParts.join(' | '),
        matchScore: Math.min(100, matchScore),
        metadata: {
          firstName: patient.first_name,
          lastName: patient.last_name,
          dateOfBirth: patient.date_of_birth,
          mrn: patient.mrn,
          roomNumber: patient.room_number,
          bedNumber: patient.bed_number,
          riskScore: patient.risk_score,
          unit: patient.unit,
        },
      };
    });

    // Sort by match score descending
    return results.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    auditLogger.error('VOICE_SEARCH_PATIENTS_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    return [];
  }
}

/**
 * Search for beds by bed ID, room number, or unit
 */
export async function searchBeds(
  supabase: SupabaseClient,
  entity: ParsedEntity
): Promise<SearchResult[]> {
  try {
    const { filters } = entity;
    let query = supabase
      .from('beds')
      .select(`
        id,
        bed_id,
        room_number,
        unit,
        status,
        current_patient_id,
        profiles:current_patient_id (first_name, last_name)
      `)
      .limit(20);

    if (filters.bedId) {
      query = query.ilike('bed_id', `%${filters.bedId}%`);
    }

    if (filters.roomNumber) {
      query = query.ilike('room_number', `%${filters.roomNumber}%`);
    }

    if (filters.unit) {
      query = query.ilike('unit', `%${filters.unit}%`);
    }

    const { data, error } = await query;

    if (error) {
      auditLogger.error('VOICE_SEARCH_BEDS_FAILED', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: SearchResult[] = data.map((bed: any) => {
      let matchScore = 0;

      if (filters.bedId) {
        matchScore = Math.max(matchScore, calculateSimilarity(bed.bed_id, filters.bedId));
      }
      if (filters.roomNumber) {
        matchScore = Math.max(matchScore, calculateSimilarity(bed.room_number, filters.roomNumber));
      }

      // Handle profiles - Supabase returns either array or object depending on relation
      const profileData = Array.isArray(bed.profiles) ? bed.profiles[0] : bed.profiles;
      const patientName = profileData
        ? `${profileData.first_name} ${profileData.last_name}`
        : null;

      const infoParts: string[] = [];
      infoParts.push(`Room ${bed.room_number}`);
      infoParts.push(bed.unit);
      infoParts.push(bed.status);
      if (patientName) infoParts.push(`Patient: ${patientName}`);

      return {
        id: bed.id,
        type: 'bed' as const,
        primaryText: `Bed ${bed.bed_id}`,
        secondaryText: infoParts.join(' | '),
        matchScore: Math.min(100, matchScore || 80),
        metadata: {
          bedId: bed.bed_id,
          roomNumber: bed.room_number,
          unit: bed.unit,
          status: bed.status,
          patientId: bed.patient_id,
          patientName,
        },
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    auditLogger.error('VOICE_SEARCH_BEDS_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    return [];
  }
}

/**
 * Search for providers by name, role, or specialty
 */
export async function searchProviders(
  supabase: SupabaseClient,
  entity: ParsedEntity
): Promise<SearchResult[]> {
  try {
    const { filters } = entity;
    let query = supabase
      .from('profiles')
      .select('id, user_id, first_name, last_name, role, specialty, department')
      .in('role', ['physician', 'doctor', 'nurse', 'provider', 'pt', 'physical_therapist'])
      .limit(20);

    if (filters.name) {
      const nameParts = filters.name.split(/\s+/);
      if (nameParts.length >= 2) {
        query = query
          .ilike('first_name', `%${nameParts[0]}%`)
          .ilike('last_name', `%${nameParts.slice(1).join(' ')}%`);
      } else {
        query = query.or(`first_name.ilike.%${filters.name}%,last_name.ilike.%${filters.name}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      auditLogger.error('VOICE_SEARCH_PROVIDERS_FAILED', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const results: SearchResult[] = data.map((provider: ProviderRecord) => {
      const fullName = `${provider.first_name} ${provider.last_name}`;
      let matchScore = 0;

      if (filters.name) {
        matchScore = calculateSimilarity(fullName, filters.name);
      }

      const infoParts: string[] = [];
      if (provider.role) infoParts.push(provider.role);
      if (provider.specialty) infoParts.push(provider.specialty);
      if (provider.department) infoParts.push(provider.department);

      return {
        id: provider.user_id || provider.id,
        type: 'provider' as const,
        primaryText: fullName,
        secondaryText: infoParts.join(' | '),
        matchScore: Math.min(100, matchScore || 70),
        metadata: {
          firstName: provider.first_name,
          lastName: provider.last_name,
          role: provider.role,
          specialty: provider.specialty,
          department: provider.department,
        },
      };
    });

    return results.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    auditLogger.error('VOICE_SEARCH_PROVIDERS_ERROR', error instanceof Error ? error : new Error('Unknown error'));
    return [];
  }
}

/**
 * Search for patients by room number (convenience function)
 */
export async function searchByRoom(
  supabase: SupabaseClient,
  roomNumber: string
): Promise<SearchResult[]> {
  return searchPatients(supabase, {
    type: 'patient',
    query: `room ${roomNumber}`,
    filters: { roomNumber },
    rawTranscript: `room ${roomNumber}`,
    confidence: 90,
  });
}

/**
 * Universal search - routes to appropriate search function based on entity type
 */
export async function voiceSearch(
  supabase: SupabaseClient,
  entity: ParsedEntity
): Promise<SearchResult[]> {
  switch (entity.type) {
    case 'patient':
      return searchPatients(supabase, entity);
    case 'bed':
      return searchBeds(supabase, entity);
    case 'room':
      // Room search returns both bed and patient results
      const bedResults = await searchBeds(supabase, entity);
      const patientResults = await searchPatients(supabase, entity);
      return [...bedResults, ...patientResults].sort((a, b) => b.matchScore - a.matchScore);
    case 'provider':
      return searchProviders(supabase, entity);
    default:
      auditLogger.warn('VOICE_SEARCH_UNKNOWN_TYPE', { entityType: entity.type });
      return [];
  }
}

export default {
  searchPatients,
  searchBeds,
  searchProviders,
  searchByRoom,
  voiceSearch,
};
