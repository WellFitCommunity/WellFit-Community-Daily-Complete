/**
 * Tests for fetchTimeline — FHIR vitals, encounters, alerts integration (TODOs #3-5)
 *
 * Verifies:
 * - last_vitals populated from ObservationService with LOINC code mapping
 * - Blood pressure formatted as "systolic/diastolic" string
 * - last_encounter populated from EncounterService (newest first)
 * - active_alerts_count from care_team_alerts table
 * - Graceful degradation for each FHIR integration independently
 * - Check-in data still works as before (regression)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fetchTimeline } from '../fetchTimeline';
import type { PatientTimelineSummary } from '../../../types/patientContext';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    phi: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock ObservationService
vi.mock('../../fhir/ObservationService', () => ({
  ObservationService: {
    getVitalSigns: vi.fn(),
  },
}));

// Mock EncounterService
vi.mock('../../fhir/EncounterService', () => ({
  EncounterService: {
    getAll: vi.fn(),
  },
}));

import { supabase } from '../../../lib/supabaseClient';
import { ObservationService } from '../../fhir/ObservationService';
import { EncounterService } from '../../fhir/EncounterService';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockGetVitalSigns = ObservationService.getVitalSigns as ReturnType<typeof vi.fn>;
const mockGetAllEncounters = EncounterService.getAll as ReturnType<typeof vi.fn>;

const PATIENT_ID = 'patient-xyz-456';

/**
 * Narrow result.data to non-null for test assertions.
 */
function assertData(data: PatientTimelineSummary | null): PatientTimelineSummary {
  if (data === null) throw new Error('Expected timeline data to be non-null');
  return data;
}

/**
 * Build a Supabase chain mock for check_ins
 */
function mockCheckInChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      }),
    }),
  };
}

/**
 * Build a Supabase chain mock for care_team_alerts count
 */
function mockAlertsChain(count: number | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count, error }),
      }),
    }),
  };
}

describe('fetchTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns last check-in data from check_ins (regression)', async () => {
    const checkIn = {
      id: 'ci-1',
      user_id: PATIENT_ID,
      created_at: '2026-02-08T10:00:00Z',
      label: 'Feeling Great Today',
      emotional_state: 'good',
      heart_rate: 72,
      bp_systolic: 120,
      bp_diastolic: 80,
      glucose_mg_dl: null,
      pulse_oximeter: 97,
      notes: 'back pain',
      is_emergency: false,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(checkIn);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.last_check_in).not.toBeNull();
    expect(data.last_check_in?.mood).toBe('good');
    expect(data.last_check_in?.concerns).toEqual(['back pain']);
  });

  it('maps LOINC vital signs to last_vitals (TODO #3)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({
      success: true,
      data: [
        // Newest first (as ObservationService returns)
        { code: '8480-6', value_quantity_value: 120, effective_datetime: '2026-02-08T10:00:00Z' },
        { code: '8462-4', value_quantity_value: 80, effective_datetime: '2026-02-08T10:00:00Z' },
        { code: '8867-4', value_quantity_value: 72, effective_datetime: '2026-02-08T10:00:00Z' },
        { code: '8310-5', value_quantity_value: 98.6, effective_datetime: '2026-02-08T10:00:00Z' },
        { code: '2708-6', value_quantity_value: 97, effective_datetime: '2026-02-08T10:00:00Z' },
      ],
    });

    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.last_vitals).not.toBeNull();
    expect(data.last_vitals?.blood_pressure).toBe('120/80');
    expect(data.last_vitals?.heart_rate).toBe(72);
    expect(data.last_vitals?.temperature).toBe(98.6);
    expect(data.last_vitals?.oxygen_saturation).toBe(97);
    expect(data.last_vitals?.timestamp).toBe('2026-02-08T10:00:00Z');
  });

  it('returns null last_vitals when no observations exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(data.last_vitals).toBeNull();
  });

  it('handles partial BP (only systolic, no diastolic)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({
      success: true,
      data: [
        { code: '8480-6', value_quantity_value: 135, effective_datetime: '2026-02-08T10:00:00Z' },
        // No diastolic reading
        { code: '8867-4', value_quantity_value: 88, effective_datetime: '2026-02-08T10:00:00Z' },
      ],
    });

    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(data.last_vitals).not.toBeNull();
    // BP should be null because we need both systolic AND diastolic
    expect(data.last_vitals?.blood_pressure).toBeNull();
    expect(data.last_vitals?.heart_rate).toBe(88);
  });

  it('populates last_encounter from EncounterService (TODO #4)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });

    mockGetAllEncounters.mockResolvedValue([
      {
        id: 'enc-1',
        period_start: '2026-02-07T14:00:00Z',
        class_display: 'Outpatient',
        participant_display: 'Dr. Kim',
        reason_code_display: 'Annual physical',
      },
      {
        id: 'enc-2',
        period_start: '2026-01-15T09:00:00Z',
        class_display: 'Emergency',
      },
    ]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.last_encounter).not.toBeNull();
    expect(data.last_encounter?.timestamp).toBe('2026-02-07T14:00:00Z');
    expect(data.last_encounter?.encounter_type).toBe('Outpatient');
    expect(data.last_encounter?.provider_name).toBe('Dr. Kim');
    expect(data.last_encounter?.diagnosis_summary).toBe('Annual physical');
  });

  it('returns null last_encounter when no encounters exist', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(data.last_encounter).toBeNull();
  });

  it('populates active_alerts_count from care_team_alerts (TODO #5)', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(5);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(data.active_alerts_count).toBe(5);
  });

  it('defaults active_alerts_count to 0 when query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(null, { message: 'RLS denied' });
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.active_alerts_count).toBe(0);
  });

  it('degrades gracefully when ObservationService fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(2);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockRejectedValue(new Error('RPC timeout'));
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    // Still succeeds, vitals just null
    expect(result.success).toBe(true);
    expect(data.last_vitals).toBeNull();
    expect(data.active_alerts_count).toBe(2);
    expect(result.source.note).toContain('Vitals fetch failed');
  });

  it('degrades gracefully when EncounterService throws', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockRejectedValue(new Error('Encounters table error'));

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.last_encounter).toBeNull();
    expect(result.source.note).toContain('Encounter fetch failed');
  });

  it('includes all data sources in source field', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(null);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);

    // Source string is joined: "check_ins + fhir_observations + encounters + care_team_alerts"
    expect(result.source.source).toContain('check_ins');
    expect(result.source.source).toContain('fhir_observations');
    expect(result.source.source).toContain('encounters');
    expect(result.source.source).toContain('care_team_alerts');
  });

  it('calculates days_since_last_contact from check-in date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const checkIn = {
      id: 'ci-1',
      user_id: PATIENT_ID,
      created_at: yesterday.toISOString(),
      label: 'Morning Check-In',
      emotional_state: 'ok',
      heart_rate: null,
      bp_systolic: null,
      bp_diastolic: null,
      glucose_mg_dl: null,
      pulse_oximeter: null,
      notes: null,
      is_emergency: false,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'check_ins') return mockCheckInChain(checkIn);
      if (table === 'care_team_alerts') return mockAlertsChain(0);
      return mockCheckInChain(null);
    });

    mockGetVitalSigns.mockResolvedValue({ success: true, data: [] });
    mockGetAllEncounters.mockResolvedValue([]);

    const result = await fetchTimeline(PATIENT_ID, 7, 10);
    const data = assertData(result.data);

    expect(data.days_since_last_contact).toBe(1);
  });
});
