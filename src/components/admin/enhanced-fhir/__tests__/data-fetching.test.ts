/**
 * Tests for Enhanced FHIR Data Fetching — Phase 3 Migration
 *
 * Verifies that data-fetching.ts correctly delegates to patientContextService
 * and adapts the result to the legacy ComprehensivePatientData shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock patientContextService before import
const mockGetPatientContext = vi.fn();
vi.mock('../../../../services/patient-context', () => ({
  patientContextService: {
    getPatientContext: (...args: unknown[]) => mockGetPatientContext(...args),
  },
}));

import { DataCache, fetchComprehensivePatientData, fetchPopulationData, fetchRecentCheckIns } from '../data-fetching';
import type { ComprehensivePatientData } from '../types';

// Mock Supabase client
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  return {
    from: vi.fn(() => chain),
    _chain: chain,
  } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;
}

// Standard mock patient context result
function mockPatientContext(patientId: string) {
  return {
    success: true,
    data: {
      demographics: {
        patient_id: patientId,
        first_name: 'Jane',
        last_name: 'Doe',
        dob: '1945-03-15',
        gender: 'female',
        phone: '555-0100',
        preferred_language: 'en',
        enrollment_type: 'app' as const,
        tenant_id: 'tenant-1',
        mrn: 'MRN-001',
      },
      hospital_details: null,
      contacts: null,
      timeline: {
        last_check_in: {
          timestamp: '2026-02-22T10:00:00Z',
          wellness_score: null,
          mood: 'happy',
          concerns: [],
        },
        last_vitals: null,
        last_encounter: null,
        active_alerts_count: 0,
        recent_events: [
          {
            event_id: 'evt-1',
            event_type: 'check_in' as const,
            timestamp: '2026-02-22T10:00:00Z',
            description: 'Daily check-in completed',
            severity: 'info' as const,
            related_entity_id: 'ci-1',
            related_entity_type: 'check_ins',
          },
        ],
        days_since_last_contact: 0,
      },
      risk: null,
      care_plan: null,
      self_reports: {
        recent_reports: [
          {
            id: 'sr-1',
            user_id: patientId,
            mood: 'good',
            symptoms: null,
            activity_description: 'Walking',
            bp_systolic: 120,
            bp_diastolic: 80,
            heart_rate: 72,
            blood_sugar: null,
            blood_oxygen: 98,
            weight: 150,
            physical_activity: 'moderate',
            social_engagement: 'active',
            created_at: '2026-02-21T14:00:00Z',
            reviewed_at: null,
            reviewed_by_name: null,
          },
        ],
        total_count: 5,
      },
      context_meta: {
        generated_at: '2026-02-22T10:00:00Z',
        request_id: 'pctx_test_123',
        options_requested: {},
        data_sources: [],
        data_freshness: 'real_time' as const,
        freshness_threshold_minutes: 5,
        warnings: [],
        fetch_duration_ms: 50,
      },
    },
  };
}

describe('DataCache', () => {
  let cache: DataCache;

  beforeEach(() => {
    cache = new DataCache();
  });

  it('returns null for empty cache', () => {
    expect(cache.getFromCache<ComprehensivePatientData>('key')).toBeNull();
  });

  it('stores and retrieves cached data within TTL', () => {
    const data: ComprehensivePatientData = {
      profile: { id: '1', user_id: '1' },
      checkIns: [],
      vitals: [],
      healthEntries: [],
    };
    cache.setCache('key', data, 60000);
    expect(cache.getFromCache<ComprehensivePatientData>('key')).toEqual(data);
  });

  it('returns null for expired cache entries', () => {
    const data: ComprehensivePatientData = {
      profile: { id: '1', user_id: '1' },
      checkIns: [],
      vitals: [],
      healthEntries: [],
    };
    cache.setCache('key', data, 0); // 0ms TTL = immediately expired
    expect(cache.getFromCache<ComprehensivePatientData>('key')).toBeNull();
  });
});

describe('fetchComprehensivePatientData', () => {
  let cache: DataCache;

  beforeEach(() => {
    cache = new DataCache();
    vi.clearAllMocks();
  });

  it('delegates to patientContextService.getPatientContext', async () => {
    const patientId = 'patient-123';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();
    await fetchComprehensivePatientData(mockSb, cache, patientId);

    expect(mockGetPatientContext).toHaveBeenCalledWith(patientId, {
      includeTimeline: true,
      includeSelfReports: true,
      includeHospitalDetails: false,
      includeContacts: false,
      includeRisk: false,
      includeCarePlan: false,
      maxSelfReports: 50,
    });
  });

  it('adapts PatientContext to ComprehensivePatientData shape', async () => {
    const patientId = 'patient-456';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, patientId);

    // Profile is adapted from demographics
    expect(result.profile).toBeDefined();
    expect(result.profile?.id).toBe(patientId);
    expect(result.profile?.user_id).toBe(patientId);
    expect(result.profile?.first_name).toBe('Jane');
    expect(result.profile?.last_name).toBe('Doe');
    expect(result.profile?.dob).toBe('1945-03-15');
    expect(result.profile?.phone).toBe('555-0100');
  });

  it('maps self_reports to healthEntries with correct vital fields', async () => {
    const patientId = 'patient-789';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, patientId);

    expect(result.healthEntries).toHaveLength(1);
    const entry = result.healthEntries?.[0];
    expect(entry?.bp_systolic).toBe(120);
    expect(entry?.bp_diastolic).toBe(80);
    expect(entry?.heart_rate).toBe(72);
    expect(entry?.blood_oxygen).toBe(98);
    expect(entry?.weight).toBe(150);
    expect(entry?.mood).toBe('good');
    expect(entry?.physical_activity).toBe('moderate');
    expect(entry?.social_engagement).toBe('active');
    expect(entry?.created_at).toBe('2026-02-21T14:00:00Z');
  });

  it('maps timeline check_in events to checkIns array', async () => {
    const patientId = 'patient-101';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, patientId);

    expect(result.checkIns).toHaveLength(1);
    expect(result.checkIns?.[0]?.user_id).toBe(patientId);
    expect(result.checkIns?.[0]?.created_at).toBe('2026-02-22T10:00:00Z');
  });

  it('merges checkIns and healthEntries into vitals, sorted newest first', async () => {
    const patientId = 'patient-202';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, patientId);

    // vitals should contain both check-in events and self-reports
    const vitals = result.vitals ?? [];
    expect(vitals.length).toBeGreaterThanOrEqual(2);

    // Should be sorted newest first
    for (let i = 1; i < vitals.length; i++) {
      const prev = new Date(vitals[i - 1].created_at ?? 0).getTime();
      const curr = new Date(vitals[i].created_at ?? 0).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('caches result with 5-minute TTL', async () => {
    const patientId = 'patient-303';
    mockGetPatientContext.mockResolvedValue(mockPatientContext(patientId));

    const mockSb = createMockSupabase();

    // First call fetches
    await fetchComprehensivePatientData(mockSb, cache, patientId);
    expect(mockGetPatientContext).toHaveBeenCalledTimes(1);

    // Second call returns cached
    await fetchComprehensivePatientData(mockSb, cache, patientId);
    expect(mockGetPatientContext).toHaveBeenCalledTimes(1); // Not called again
  });

  it('throws when patientContextService returns failure', async () => {
    mockGetPatientContext.mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
      message: 'Patient not found',
    });

    const mockSb = createMockSupabase();
    await expect(
      fetchComprehensivePatientData(mockSb, cache, 'nonexistent')
    ).rejects.toThrow('Failed to fetch patient context');
  });

  it('handles null demographics fields gracefully (converts to undefined)', async () => {
    const ctx = mockPatientContext('patient-null');
    // Override demographics with null fields (simulating DB nulls)
    const nullDemographics = {
      ...ctx.data.demographics,
      first_name: null as string | null,
      last_name: null as string | null,
      dob: null as string | null,
      phone: null as string | null,
    };
    mockGetPatientContext.mockResolvedValue({
      ...ctx,
      data: { ...ctx.data, demographics: nullDemographics },
    });

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, 'patient-null');

    // Should be undefined (not null) to match PatientProfile type
    expect(result.profile?.first_name).toBeUndefined();
    expect(result.profile?.last_name).toBeUndefined();
    expect(result.profile?.dob).toBeUndefined();
    expect(result.profile?.phone).toBeUndefined();
  });

  it('returns empty arrays when timeline and self_reports are null', async () => {
    const ctx = mockPatientContext('patient-empty');
    mockGetPatientContext.mockResolvedValue({
      ...ctx,
      data: { ...ctx.data, timeline: null, self_reports: null },
    });

    const mockSb = createMockSupabase();
    const result = await fetchComprehensivePatientData(mockSb, cache, 'patient-empty');

    expect(result.checkIns).toEqual([]);
    expect(result.healthEntries).toEqual([]);
    expect(result.vitals).toEqual([]);
  });
});

describe('fetchPopulationData', () => {
  let cache: DataCache;

  beforeEach(() => {
    cache = new DataCache();
    vi.clearAllMocks();
  });

  it('fetches patient IDs then calls fetchComprehensivePatientData for each', async () => {
    const profiles = [{ user_id: 'p1' }, { user_id: 'p2' }];
    const chain = {
      select: vi.fn().mockResolvedValue({ data: profiles }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    mockGetPatientContext
      .mockResolvedValueOnce(mockPatientContext('p1'))
      .mockResolvedValueOnce(mockPatientContext('p2'));

    const result = await fetchPopulationData(mockSb, cache);

    expect(result).toHaveLength(2);
    expect(result[0].profile?.user_id).toBe('p1');
    expect(result[1].profile?.user_id).toBe('p2');
  });

  it('returns empty array when no profiles exist', async () => {
    const chain = {
      select: vi.fn().mockResolvedValue({ data: [] }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    const result = await fetchPopulationData(mockSb, cache);
    expect(result).toEqual([]);
  });

  it('returns minimal data for patients that fail to fetch', async () => {
    const profiles = [{ user_id: 'good' }, { user_id: 'bad' }];
    const chain = {
      select: vi.fn().mockResolvedValue({ data: profiles }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    mockGetPatientContext
      .mockResolvedValueOnce(mockPatientContext('good'))
      .mockResolvedValueOnce({ success: false, error: 'ERROR', message: 'fail' });

    const result = await fetchPopulationData(mockSb, cache);

    expect(result).toHaveLength(2);
    // Good patient has full data
    expect(result[0].profile?.first_name).toBe('Jane');
    // Bad patient has minimal fallback data
    expect(result[1].profile?.id).toBe('bad');
    expect(result[1].checkIns).toEqual([]);
    expect(result[1].vitals).toEqual([]);
  });

  it('caches population data with 10-minute TTL', async () => {
    const profiles = [{ user_id: 'p1' }];
    const chain = {
      select: vi.fn().mockResolvedValue({ data: profiles }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    mockGetPatientContext.mockResolvedValue(mockPatientContext('p1'));

    await fetchPopulationData(mockSb, cache);
    const callCount = mockGetPatientContext.mock.calls.length;

    // Second call should use cache
    await fetchPopulationData(mockSb, cache);
    expect(mockGetPatientContext.mock.calls.length).toBe(callCount); // Not incremented
  });
});

describe('fetchRecentCheckIns', () => {
  it('queries check_ins from last 15 minutes with explicit columns', async () => {
    const mockData = [
      { user_id: 'u1', created_at: '2026-02-22T10:00:00Z', id: 'ci-1' },
    ];

    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: mockData }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    const result = await fetchRecentCheckIns(mockSb);

    expect(mockSb.from).toHaveBeenCalledWith('check_ins');
    expect(chain.select).toHaveBeenCalledWith('user_id, created_at, id');
    expect(result).toEqual(mockData);
  });

  it('returns empty array when no recent check-ins', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: null }),
    };
    const mockSb = { from: vi.fn(() => chain) } as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient>;

    const result = await fetchRecentCheckIns(mockSb);
    expect(result).toEqual([]);
  });
});
