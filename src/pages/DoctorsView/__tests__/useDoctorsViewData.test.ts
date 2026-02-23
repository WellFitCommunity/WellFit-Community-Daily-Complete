/**
 * Tests for useDoctorsViewData hook — Phase 4 Migration
 *
 * Verifies that the hook correctly delegates self_reports to
 * patientContextService while keeping check-in and community
 * engagement queries direct.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock AuthContext
const mockUser = { id: 'user-123' };
const mockSupabase = {
  from: vi.fn(),
  auth: {},
};

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useUser: () => mockUser,
}));

// Mock patientContextService
const mockGetPatientContext = vi.fn();
vi.mock('../../../services/patient-context', () => ({
  patientContextService: {
    getPatientContext: (...args: unknown[]) => mockGetPatientContext(...args),
  },
}));

import { useDoctorsViewData } from '../useDoctorsViewData';

function mockContextResult() {
  return {
    success: true,
    data: {
      self_reports: {
        recent_reports: [
          {
            id: 'sr-1',
            user_id: 'user-123',
            mood: 'good',
            symptoms: 'headache',
            activity_description: 'Walking',
            bp_systolic: 120,
            bp_diastolic: 80,
            heart_rate: 72,
            blood_sugar: 100,
            blood_oxygen: 98,
            weight: 160,
            physical_activity: 'moderate',
            social_engagement: 'active',
            created_at: '2026-02-22T10:00:00Z',
            reviewed_at: null,
            reviewed_by_name: null,
          },
        ],
        total_count: 1,
      },
      demographics: { patient_id: 'user-123' },
      context_meta: { generated_at: '2026-02-22T10:00:00Z' },
    },
  };
}

/**
 * Build a mock Supabase query chain that is thenable (like real PostgrestFilterBuilder).
 * When awaited or passed to Promise.allSettled, resolves to `resolveValue`.
 * When `.single()` is called, returns a separate promise from `singleValue`.
 */
function buildThenableChain(
  resolveValue: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null },
  singleValue?: { data: unknown; error: unknown }
) {
  const chain: Record<string, unknown> = {};

  // Chain methods — all return chain for chaining
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);

  // single() returns a separate promise (not the chain)
  chain.single = vi.fn().mockResolvedValue(singleValue ?? { data: null, error: null });

  // Make chain thenable — used when chain itself is passed to Promise.allSettled
  chain.then = vi.fn((resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    try {
      resolve(resolveValue);
    } catch (err: unknown) {
      if (reject) reject(err);
    }
  });

  return chain;
}

describe('useDoctorsViewData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: all supabase queries return empty thenable chains
    const defaultChain = buildThenableChain();
    mockSupabase.from.mockReturnValue(defaultChain);
    mockGetPatientContext.mockResolvedValue(mockContextResult());
  });

  it('calls patientContextService for self_reports', async () => {
    renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(mockGetPatientContext).toHaveBeenCalledWith('user-123', {
        includeSelfReports: true,
        includeTimeline: false,
        includeContacts: false,
        includeRisk: false,
        includeCarePlan: false,
        includeHospitalDetails: false,
        maxSelfReports: 5,
      });
    });
  });

  it('maps self_reports from patientContextService to recentHealthEntries', async () => {
    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recentHealthEntries).toHaveLength(1);
    const entry = result.current.recentHealthEntries[0];
    expect(entry.id).toBe('sr-1');
    expect(entry.mood).toBe('good');
    expect(entry.bp_systolic).toBe(120);
    expect(entry.bp_diastolic).toBe(80);
    expect(entry.heart_rate).toBe(72);
    expect(entry.blood_sugar).toBe(100);
    expect(entry.blood_oxygen).toBe(98);
    expect(entry.weight).toBe(160);
    expect(entry.symptoms).toBe('headache');
    expect(entry.physical_activity).toBe('moderate');
    expect(entry.social_engagement).toBe('active');
  });

  it('queries check_ins directly for latest check-in with vitals', async () => {
    renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('check_ins');
    });
  });

  it('returns empty health entries when patientContextService fails', async () => {
    mockGetPatientContext.mockResolvedValue({
      success: false,
      error: 'NOT_FOUND',
      message: 'Patient not found',
    });

    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recentHealthEntries).toEqual([]);
  });

  it('provides a refresh function that re-fetches data', async () => {
    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Reset mock to track new calls
    mockGetPatientContext.mockClear();
    mockGetPatientContext.mockResolvedValue(mockContextResult());

    result.current.refresh();

    await waitFor(() => {
      expect(mockGetPatientContext).toHaveBeenCalledTimes(1);
    });
  });

  it('builds care team review from check-in data when reviewed', async () => {
    const reviewedCheckIn = {
      data: {
        id: 'ci-1',
        user_id: 'user-123',
        label: 'Daily check-in',
        created_at: '2026-02-22T09:00:00Z',
        reviewed_at: '2026-02-22T11:00:00Z',
        reviewed_by_name: 'Dr. Smith',
        emotional_state: 'calm',
        bp_systolic: 118,
        bp_diastolic: 76,
        heart_rate: 68,
        glucose_mg_dl: null,
        pulse_oximeter: 97,
      },
      error: null,
    };

    // Each from() call gets a separate chain to avoid shared-thenable issues
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Query 1: latest check-in — resolved via .single()
        return buildThenableChain({ data: null, error: null }, reviewedCheckIn);
      }
      // Queries 3, 4: community engagement — resolved via thenable
      return buildThenableChain({ data: [], error: null, count: 0 });
    });

    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Diagnose: verify check-in was processed before checking review
    expect(result.current.error).toBeNull();
    expect(result.current.latestCheckIn).not.toBeNull();
    expect(result.current.latestCheckIn?.id).toBe('ci-1');
    expect(result.current.careTeamReview).not.toBeNull();
    expect(result.current.careTeamReview?.status).toContain('Dr. Smith');
    expect(result.current.careTeamReview?.reviewed_item_type).toBe('Check-in');
  });

  it('builds awaiting review when check-in exists but not reviewed', async () => {
    const unreviewedCheckIn = {
      data: {
        id: 'ci-2',
        user_id: 'user-123',
        label: null,
        created_at: '2026-02-22T09:00:00Z',
        reviewed_at: null,
        reviewed_by_name: null,
        emotional_state: 'anxious',
        bp_systolic: null,
        bp_diastolic: null,
        heart_rate: null,
        glucose_mg_dl: null,
        pulse_oximeter: null,
      },
      error: null,
    };

    // Make self_reports return no reviewed entries
    mockGetPatientContext.mockResolvedValue({
      success: true,
      data: {
        self_reports: { recent_reports: [], total_count: 0 },
        demographics: { patient_id: 'user-123' },
        context_meta: { generated_at: '2026-02-22T10:00:00Z' },
      },
    });

    // Each from() call gets a separate chain
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return buildThenableChain({ data: null, error: null }, unreviewedCheckIn);
      }
      return buildThenableChain({ data: [], error: null, count: 0 });
    });

    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.careTeamReview?.status).toBe('Awaiting Review');
    expect(result.current.careTeamReview?.reviewed_item_type).toBe('Latest Check-in');
  });

  // NOTE: This test MUST be last because vi.spyOn on module mock
  // is not restored by vi.clearAllMocks(). Uses restoreAllMocks.
  it('returns error when no user is logged in', async () => {
    const authModule = await import('../../../contexts/AuthContext');
    const spy = vi.spyOn(authModule, 'useUser').mockReturnValue(null);

    const { result } = renderHook(() => useDoctorsViewData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('No user logged in. This view requires authentication.');
    expect(result.current.userId).toBeNull();

    spy.mockRestore();
  });
});

describe('vitalUtils', () => {
  let getVitalStatus: typeof import('../vitalUtils').getVitalStatus;
  let extractVitals: typeof import('../vitalUtils').extractVitals;
  let formatDateTime: typeof import('../vitalUtils').formatDateTime;
  let renderHealthEntryContent: typeof import('../vitalUtils').renderHealthEntryContent;

  beforeEach(async () => {
    const utils = await import('../vitalUtils');
    getVitalStatus = utils.getVitalStatus;
    extractVitals = utils.extractVitals;
    formatDateTime = utils.formatDateTime;
    renderHealthEntryContent = utils.renderHealthEntryContent;
  });

  it('classifies normal BP systolic (110-139) as normal', () => {
    expect(getVitalStatus('bp_systolic', 120)).toBe('normal');
  });

  it('classifies high BP systolic (140-179) as warning', () => {
    expect(getVitalStatus('bp_systolic', 150)).toBe('warning');
  });

  it('classifies very high BP systolic (>=180) as critical', () => {
    expect(getVitalStatus('bp_systolic', 190)).toBe('critical');
  });

  it('classifies low BP systolic (<90) as critical', () => {
    expect(getVitalStatus('bp_systolic', 85)).toBe('critical');
  });

  it('classifies normal heart rate (60-99) as normal', () => {
    expect(getVitalStatus('heart_rate', 72)).toBe('normal');
  });

  it('classifies low oxygen (<90) as critical', () => {
    expect(getVitalStatus('oxygen', 88)).toBe('critical');
  });

  it('classifies borderline oxygen (90-94) as warning', () => {
    expect(getVitalStatus('oxygen', 93)).toBe('warning');
  });

  it('returns normal for unknown vital type', () => {
    expect(getVitalStatus('unknown_type', 100)).toBe('normal');
  });

  it('extracts vitals from check-in data', () => {
    const checkIn = {
      id: 'ci-1',
      user_id: 'u1',
      label: null,
      created_at: '2026-02-22T10:00:00Z',
      bp_systolic: 130,
      bp_diastolic: 85,
      heart_rate: 78,
      glucose_mg_dl: 110,
      pulse_oximeter: 97,
    };
    const result = extractVitals(checkIn, []);
    expect(result).toHaveLength(4); // BP, HR, Glucose, SpO2
    expect(result[0].label).toBe('Blood Pressure');
    expect(result[0].value).toBe('130/85');
  });

  it('falls back to self-reports when no check-in vitals', () => {
    const entry = {
      id: 'sr-1',
      user_id: 'u1',
      mood: 'good',
      bp_systolic: 115,
      bp_diastolic: 75,
      heart_rate: 65,
      blood_sugar: 95,
      blood_oxygen: 99,
      created_at: '2026-02-22T08:00:00Z',
    };
    const result = extractVitals(null, [entry]);
    expect(result).toHaveLength(4);
    expect(result[0].value).toBe('115/75');
  });

  it('returns empty array when no data', () => {
    expect(extractVitals(null, [])).toEqual([]);
  });

  it('formats date strings correctly', () => {
    const result = formatDateTime('2026-02-22T10:00:00Z');
    expect(result).not.toBe('N/A');
    expect(result).toContain('2026');
  });

  it('returns N/A for null date', () => {
    expect(formatDateTime(null)).toBe('N/A');
    expect(formatDateTime(undefined)).toBe('N/A');
  });

  it('renders health entry content with mood and symptoms', () => {
    const entry = {
      id: 'sr-1',
      user_id: 'u1',
      mood: 'good',
      symptoms: 'headache',
      physical_activity: 'walking',
      social_engagement: 'active',
      created_at: '2026-02-22T10:00:00Z',
    };
    const content = renderHealthEntryContent(entry);
    expect(content).toContain('Mood: good');
    expect(content).toContain('Symptoms: headache');
    expect(content).toContain('Activity: walking');
    expect(content).toContain('Social: active');
  });

  it('returns default text for empty entry', () => {
    const entry = {
      id: 'sr-2',
      user_id: 'u1',
      mood: '',
      created_at: '2026-02-22T10:00:00Z',
    };
    expect(renderHealthEntryContent(entry)).toBe('No details provided');
  });
});
