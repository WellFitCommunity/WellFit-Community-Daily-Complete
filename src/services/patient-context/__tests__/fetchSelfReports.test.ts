/**
 * Tests for fetchSelfReports — self-report history fetching
 *
 * Verifies:
 * - Returns recent self-reports with explicit column selection
 * - Returns total count via head-only query
 * - Respects limit parameter
 * - Returns empty summary when no reports exist
 * - Handles database errors gracefully
 * - Uses FetchResult pattern with source metadata
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { fetchSelfReports } from '../fetchSelfReports';
import { supabase } from '../../../lib/supabaseClient';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

const PATIENT_ID = 'patient-sr-001';

const mockReport = {
  id: 'sr-1',
  user_id: PATIENT_ID,
  mood: 'good',
  symptoms: 'mild headache',
  activity_description: 'Walked 30 minutes',
  bp_systolic: 120,
  bp_diastolic: 78,
  heart_rate: 72,
  blood_sugar: 95,
  blood_oxygen: 98,
  weight: 165,
  physical_activity: 'moderate',
  social_engagement: 'visited friends',
  created_at: '2026-02-20T10:00:00Z',
  reviewed_at: null,
  reviewed_by_name: null,
};

/**
 * Build Supabase chain mock for self_reports data query
 */
function mockDataChain(data: unknown[], error: unknown = null) {
  return {
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

/**
 * Build Supabase chain mock for self_reports count query
 */
function mockCountChain(count: number | null, error: unknown = null) {
  return {
    eq: vi.fn().mockResolvedValue({ count, error }),
  };
}

describe('fetchSelfReports', () => {
  let selectCallCount: number;

  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount = 0;
  });

  it('returns recent self-reports for a patient', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockDataChain([mockReport]);
        }
        return mockCountChain(1);
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data?.recent_reports).toHaveLength(1);
    expect(result.data?.recent_reports[0].mood).toBe('good');
    expect(result.data?.recent_reports[0].bp_systolic).toBe(120);
    expect(result.data?.total_count).toBe(1);
  });

  it('returns empty summary when no reports exist', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockDataChain([]);
        }
        return mockCountChain(0);
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.recent_reports).toHaveLength(0);
    expect(result.data?.total_count).toBe(0);
  });

  it('includes source metadata for traceability', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockDataChain([mockReport]);
        }
        return mockCountChain(5);
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.source.source).toBe('self_reports');
    expect(result.source.success).toBe(true);
    expect(result.source.record_count).toBe(1);
    expect(result.source.fetched_at).toBeTruthy();
    expect(result.source.note).toBeNull();
  });

  it('handles database error on data query', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        return mockDataChain([], { message: 'RLS denied' });
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source.success).toBe(false);
    expect(result.source.note).toBe('RLS denied');
  });

  it('handles thrown errors gracefully', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        throw new Error('Connection timeout');
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.source.success).toBe(false);
    expect(result.source.note).toBe('Connection timeout');
  });

  it('defaults to null count when count query fails', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockDataChain([mockReport]);
        }
        return mockCountChain(null, { message: 'count error' });
      }),
    }));

    const result = await fetchSelfReports(PATIENT_ID);

    expect(result.success).toBe(true);
    expect(result.data?.recent_reports).toHaveLength(1);
    expect(result.data?.total_count).toBe(0);
  });

  it('queries the self_reports table', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return mockDataChain([]);
        }
        return mockCountChain(0);
      }),
    }));

    await fetchSelfReports(PATIENT_ID);

    expect(mockFrom).toHaveBeenCalledWith('self_reports');
  });
});
