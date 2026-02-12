/**
 * Enhanced FHIR Service — Data Fetching
 *
 * Handles fetching comprehensive patient data, population data,
 * recent check-ins, and cache management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ComprehensivePatientData,
  CheckInRecord,
  CacheEntry
} from './types';

/**
 * Cache management utilities for the enhanced FHIR service.
 */
export class DataCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = new Map();
  }

  getFromCache<T extends ComprehensivePatientData | ComprehensivePatientData[]>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.timestamp + cached.ttl) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key: string, data: ComprehensivePatientData | ComprehensivePatientData[], ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
}

/**
 * Fetch comprehensive patient data including profile, check-ins, and self-reports.
 * Merges check_ins and self_reports into a unified vitals array.
 */
export async function fetchComprehensivePatientData(
  supabaseClient: SupabaseClient,
  dataCache: DataCache,
  userId: string
): Promise<ComprehensivePatientData> {
  const cacheKey = `patient-${userId}`;
  const cached = dataCache.getFromCache<ComprehensivePatientData>(cacheKey);
  if (cached) return cached;

  try {
    const [profile, checkIns, healthEntries] = await Promise.all([
      supabaseClient.from('profiles').select('*').eq('user_id', userId).single(),
      supabaseClient.from('check_ins').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabaseClient.from('self_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    ]);

    // CRITICAL FIX: Merge check_ins and self_reports into a unified vitals array
    // This ensures all health data (from both sources) is available for AI analysis
    const allVitals = [
      ...(checkIns.data || []),
      ...(healthEntries.data || [])
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const data = {
      profile: profile.data,
      checkIns: checkIns.data || [],
      vitals: allVitals, // FIX: Now includes both check_ins and self_reports data
      healthEntries: healthEntries.data || []
    };

    dataCache.setCache(cacheKey, data, 300000); // 5 minutes TTL
    return data;

  } catch (error) {

    throw error;
  }
}

/**
 * Fetch population-level data for all patients.
 */
export async function fetchPopulationData(
  supabaseClient: SupabaseClient,
  dataCache: DataCache
): Promise<ComprehensivePatientData[]> {
  const cacheKey = 'population-data';
  const cached = dataCache.getFromCache<ComprehensivePatientData[]>(cacheKey);
  if (cached) return cached;

  try {
    const { data: profiles } = await supabaseClient.from('profiles').select('*');

    const populationData = await Promise.all(
      (profiles || []).map(async (profile) => {
        try {
          return await fetchComprehensivePatientData(supabaseClient, dataCache, profile.user_id);
        } catch {
          // Return minimal data if fetch fails for this patient
          return { profile, checkIns: [], vitals: [], healthEntries: [] };
        }
      })
    );

    dataCache.setCache(cacheKey, populationData, 600000); // 10 minutes TTL
    return populationData;

  } catch (error) {

    throw error;
  }
}

/**
 * Fetch check-ins from the last 15 minutes for real-time monitoring.
 */
export async function fetchRecentCheckIns(
  supabaseClient: SupabaseClient
): Promise<CheckInRecord[]> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const { data } = await supabaseClient
    .from('check_ins')
    .select('*')
    .gte('created_at', fifteenMinutesAgo.toISOString());

  return data || [];
}
