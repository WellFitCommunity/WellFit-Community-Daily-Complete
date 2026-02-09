/**
 * Tests for fetchContacts — FHIR Care Team integration (TODOs #1-2)
 *
 * Verifies:
 * - Caregivers and emergency contacts fetched from legacy tables
 * - Providers populated from CareTeamService.getActive → getActiveMembers
 * - Care team members (coordinators, nurses) split from providers
 * - Role mapping: FHIR role_code → ContactRelationType
 * - Telecom extraction: phone/email from FHIR telecom array
 * - Graceful degradation when CareTeamService fails
 * - Summary counts include all contact types
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fetchContacts } from '../fetchContacts';
import type { PatientContactGraph } from '../../../types/patientContext';

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

// Mock CareTeamService
vi.mock('../../fhir/CareTeamService', () => ({
  CareTeamService: {
    getActive: vi.fn(),
    getActiveMembers: vi.fn(),
  },
}));

import { supabase } from '../../../lib/supabaseClient';
import { CareTeamService } from '../../fhir/CareTeamService';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockGetActive = CareTeamService.getActive as ReturnType<typeof vi.fn>;
const mockGetActiveMembers = CareTeamService.getActiveMembers as ReturnType<typeof vi.fn>;

/**
 * Narrow result.data to non-null for test assertions.
 * Throws if data is null (test fails with clear message).
 */
function assertData(data: PatientContactGraph | null): PatientContactGraph {
  if (data === null) throw new Error('Expected data to be non-null');
  return data;
}

// Helpers to build Supabase chain mocks
function mockSupabaseQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

describe('fetchContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PATIENT_ID = 'patient-abc-123';

  it('returns caregivers from caregiver_access table', async () => {
    // caregiver_access returns one caregiver
    const caregiverChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{
              id: 'cg-1',
              caregiver_id: 'user-cg-1',
              caregiver_name: 'Jane Doe',
              phone: '555-1234',
              email: 'jane@example.com',
              is_primary: true,
              created_at: '2026-01-01T00:00:00Z',
            }],
            error: null,
          }),
        }),
      }),
    };
    // emergency_contacts returns empty
    const emergencyChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'caregiver_access') return caregiverChain;
      if (table === 'emergency_contacts') return emergencyChain;
      return mockSupabaseQuery(null);
    });

    mockGetActive.mockResolvedValue({ success: true, data: [] });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.caregivers).toHaveLength(1);
    expect(data.caregivers[0].name).toBe('Jane Doe');
    expect(data.caregivers[0].relationship).toBe('caregiver');
    expect(data.caregivers[0].is_primary).toBe(true);
    expect(data.caregivers[0].phone).toBe('555-1234');
  });

  it('populates providers from FHIR CareTeamService (TODO #1)', async () => {
    // Empty legacy tables
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    // CareTeamService returns a team with a physician member
    mockGetActive.mockResolvedValue({
      success: true,
      data: [{ id: 'team-1', status: 'active', patient_id: PATIENT_ID }],
    });

    mockGetActiveMembers.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'member-dr-1',
          care_team_id: 'team-1',
          role_code: 'attending-physician',
          role_display: 'Attending Physician',
          member_display: 'Dr. Sarah Chen',
          member_user_id: 'user-dr-1',
          is_primary_contact: true,
          telecom: [
            { system: 'phone', value: '555-9876', use: 'work' },
            { system: 'email', value: 'sarah.chen@hospital.org', use: 'work' },
          ],
          created_at: '2026-01-15T00:00:00Z',
        },
      ],
    });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].name).toBe('Dr. Sarah Chen');
    expect(data.providers[0].relationship).toBe('attending_physician');
    expect(data.providers[0].phone).toBe('555-9876');
    expect(data.providers[0].email).toBe('sarah.chen@hospital.org');
    expect(data.providers[0].is_primary).toBe(true);
    expect(data.summary.active_providers).toBe(1);
  });

  it('populates care_team members separately from providers (TODO #2)', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    mockGetActive.mockResolvedValue({
      success: true,
      data: [{ id: 'team-1', status: 'active', patient_id: PATIENT_ID }],
    });

    mockGetActiveMembers.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'member-coord-1',
          care_team_id: 'team-1',
          role_code: 'care-coordinator',
          role_display: 'Care Coordinator',
          member_display: 'Maria Lopez',
          is_primary_contact: false,
          telecom: [{ system: 'email', value: 'maria@hospital.org' }],
        },
        {
          id: 'member-sw-1',
          care_team_id: 'team-1',
          role_code: 'social-worker',
          role_display: 'Social Worker',
          member_display: 'Tom Johnson',
          is_primary_contact: false,
        },
        {
          id: 'member-dr-1',
          care_team_id: 'team-1',
          role_code: 'specialist',
          role_display: 'Specialist',
          member_display: 'Dr. Kim',
          is_primary_contact: false,
        },
      ],
    });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    // Specialist goes to providers
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].name).toBe('Dr. Kim');
    expect(data.providers[0].relationship).toBe('specialist');

    // Coordinator and social worker go to care_team
    expect(data.care_team).toHaveLength(2);
    const names = data.care_team.map((c) => c.name);
    expect(names).toContain('Maria Lopez');
    expect(names).toContain('Tom Johnson');

    const coord = data.care_team.find((c) => c.name === 'Maria Lopez');
    expect(coord).toBeDefined();
    if (coord) {
      expect(coord.relationship).toBe('care_coordinator');
      expect(coord.email).toBe('maria@hospital.org');
    }

    const sw = data.care_team.find((c) => c.name === 'Tom Johnson');
    expect(sw).toBeDefined();
    if (sw) {
      expect(sw.relationship).toBe('social_worker');
    }
  });

  it('degrades gracefully when CareTeamService fails', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    mockGetActive.mockRejectedValue(new Error('Network timeout'));

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    // Still succeeds — just with empty providers/care_team
    expect(result.success).toBe(true);
    expect(data.providers).toEqual([]);
    expect(data.care_team).toEqual([]);
    // Warning recorded in source note
    expect(result.source.note).toContain('CareTeam fetch failed');
  });

  it('degrades gracefully when CareTeamService returns error result', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    mockGetActive.mockResolvedValue({
      success: false,
      error: 'RLS policy denied access',
    });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    expect(result.success).toBe(true);
    expect(data.providers).toEqual([]);
    expect(data.care_team).toEqual([]);
    expect(result.source.note).toContain('CareTeamService');
  });

  it('counts all contact types in summary.total_contacts', async () => {
    // 1 caregiver
    const caregiverChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'cg-1', caregiver_name: 'CG One', is_primary: false, created_at: '2026-01-01T00:00:00Z' }],
            error: null,
          }),
        }),
      }),
    };
    // 1 emergency contact
    const emergencyChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'ec-1', name: 'EC One', created_at: '2026-01-01T00:00:00Z' }],
          error: null,
        }),
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'caregiver_access') return caregiverChain;
      if (table === 'emergency_contacts') return emergencyChain;
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    // 1 provider from CareTeamService
    mockGetActive.mockResolvedValue({
      success: true,
      data: [{ id: 'team-1', patient_id: PATIENT_ID }],
    });
    mockGetActiveMembers.mockResolvedValue({
      success: true,
      data: [{
        id: 'dr-1',
        care_team_id: 'team-1',
        role_code: 'physician',
        member_display: 'Dr. X',
      }],
    });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    // 1 caregiver + 1 emergency + 1 provider = 3
    expect(data.summary.total_contacts).toBe(3);
    expect(data.summary.active_caregivers).toBe(1);
    expect(data.summary.active_providers).toBe(1);
  });

  it('handles members with no telecom gracefully', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }));

    mockGetActive.mockResolvedValue({
      success: true,
      data: [{ id: 'team-1', patient_id: PATIENT_ID }],
    });
    mockGetActiveMembers.mockResolvedValue({
      success: true,
      data: [{
        id: 'member-1',
        care_team_id: 'team-1',
        role_code: 'nurse',
        member_display: 'Nurse Pat',
        // No telecom field at all
      }],
    });

    const result = await fetchContacts(PATIENT_ID);
    const data = assertData(result.data);

    expect(data.care_team).toHaveLength(1);
    expect(data.care_team[0].phone).toBeNull();
    expect(data.care_team[0].email).toBeNull();
  });
});
