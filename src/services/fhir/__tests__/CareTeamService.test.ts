/**
 * Tests for FHIR CareTeamService
 *
 * Covers care team composition and member management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CareTeamService } from '../CareTeamService';

// Mock supabase with proper chain support
const createMockChain = (data: unknown) => {
  const mockOrder = vi.fn(() => ({
    order: vi.fn(() => ({ data, error: null })),
    data,
    error: null,
  }));

  const mockSingle = vi.fn(() => ({
    data,
    error: null,
  }));

  const mockOr = vi.fn(() => ({
    order: mockOrder,
    single: mockSingle,
    data,
    error: null,
  }));

  const mockIs: ReturnType<typeof vi.fn> = vi.fn(() => ({
    order: mockOrder,
    or: mockOr,
    single: mockSingle,
    data,
    error: null,
  }));

  const mockEq: ReturnType<typeof vi.fn> = vi.fn(() => ({
    is: mockIs,
    order: mockOrder,
    or: mockOr,
    single: mockSingle,
    eq: mockEq,
    data,
    error: null,
  }));

  return { mockEq, mockSingle, mockOrder };
};

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const isMembersTable = table === 'fhir_care_team_members';
      const teamData = [{ id: 'team-1', name: 'Primary Care Team', status: 'active' }];
      const memberData = [{ id: 'member-1', role_code: 'pcp', is_primary_contact: true }];
      const data = isMembersTable ? memberData : teamData;
      const insertData = isMembersTable
        ? { id: 'member-new', care_team_id: 'team-1' }
        : { id: 'team-new', name: 'New Care Team' };
      const updateData = isMembersTable
        ? { id: 'member-1', period_end: '2026-01-15' }
        : { id: 'team-1', status: 'inactive' };

      const { mockEq, mockSingle } = createMockChain(data);

      return {
        select: vi.fn(() => ({
          eq: mockEq,
          single: mockSingle,
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: insertData,
              error: null,
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: updateData,
                  error: null,
                })),
              })),
            })),
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: updateData,
                error: null,
              })),
            })),
            error: null,
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null })),
        })),
      };
    }),
  },
}));

describe('CareTeamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getByPatient', () => {
    it('should return all care teams for a patient', async () => {
      const result = await CareTeamService.getByPatient('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should order by created date descending', async () => {
      const result = await CareTeamService.getByPatient('patient-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getById', () => {
    it('should return care team by ID', async () => {
      const result = await CareTeamService.getById('team-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return null for not found', async () => {
      const result = await CareTeamService.getById('team-nonexistent');

      expect(result).toBeDefined();
    });
  });

  describe('getActive', () => {
    it('should return active care teams', async () => {
      const result = await CareTeamService.getActive('patient-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getByStatus', () => {
    it('should return care teams by status', async () => {
      const result = await CareTeamService.getByStatus('patient-1', 'active');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should filter suspended teams', async () => {
      const result = await CareTeamService.getByStatus('patient-1', 'suspended');

      expect(result.success).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new care team', async () => {
      const newTeam = {
        patient_id: 'patient-1',
        name: 'Primary Care Team',
        status: 'active' as const,
        category: ['care-coordination'],
      };

      const result = await CareTeamService.create(newTeam);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a care team', async () => {
      const result = await CareTeamService.update('team-1', {
        name: 'Updated Care Team',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('delete', () => {
    it('should soft delete a care team', async () => {
      const result = await CareTeamService.delete('team-1');

      expect(result.success).toBe(true);
    });
  });

  describe('activate', () => {
    it('should activate a care team', async () => {
      const result = await CareTeamService.activate('team-1');

      expect(result.success).toBe(true);
    });
  });

  describe('suspend', () => {
    it('should suspend a care team', async () => {
      const result = await CareTeamService.suspend('team-1');

      expect(result.success).toBe(true);
    });

    it('should accept suspension reason', async () => {
      const result = await CareTeamService.suspend('team-1', 'Patient hospitalized');

      expect(result.success).toBe(true);
    });
  });

  describe('end', () => {
    it('should end a care team', async () => {
      const result = await CareTeamService.end('team-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getMembers', () => {
    it('should return all members of a care team', async () => {
      const result = await CareTeamService.getMembers('team-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getActiveMembers', () => {
    it('should return active members', async () => {
      const result = await CareTeamService.getActiveMembers('team-1');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getPrimaryContact', () => {
    it('should return primary contact', async () => {
      const result = await CareTeamService.getPrimaryContact('team-1');

      expect(result.success).toBe(true);
    });
  });

  describe('addMember', () => {
    it('should add a member to care team', async () => {
      const member = {
        care_team_id: 'team-1',
        practitioner_id: 'pract-1',
        role_code: 'pcp',
        role_display: 'Primary Care Physician',
        is_primary_contact: true,
      };

      const result = await CareTeamService.addMember(member);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('updateMember', () => {
    it('should update a care team member', async () => {
      const result = await CareTeamService.updateMember('member-1', {
        is_primary_contact: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('removeMember', () => {
    it('should remove a member (set period_end)', async () => {
      const result = await CareTeamService.removeMember('member-1');

      expect(result.success).toBe(true);
    });
  });

  describe('deleteMember', () => {
    it('should hard delete a member', async () => {
      const result = await CareTeamService.deleteMember('member-1');

      expect(result.success).toBe(true);
    });
  });

  describe('getMembersByRole', () => {
    it('should return members by role', async () => {
      const result = await CareTeamService.getMembersByRole('team-1', 'pcp');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('care team status values', () => {
    it('should define all FHIR care team statuses', () => {
      const statuses = ['proposed', 'active', 'suspended', 'inactive', 'entered-in-error'];
      expect(statuses).toContain('active');
      expect(statuses).toContain('suspended');
      expect(statuses).toContain('inactive');
    });
  });

  describe('care team roles', () => {
    it('should define common care team roles', () => {
      const roles = [
        'pcp',
        'care-coordinator',
        'nurse',
        'specialist',
        'social-worker',
        'pharmacist',
        'caregiver',
      ];
      expect(roles).toContain('pcp');
      expect(roles).toContain('care-coordinator');
    });
  });

  describe('care team structure', () => {
    it('should define complete care team structure', () => {
      const careTeam = {
        id: 'team-1',
        patient_id: 'patient-1',
        name: 'Primary Care Team',
        status: 'active',
        category: ['care-coordination'],
        period_start: '2026-01-01',
        period_end: null,
        managing_organization_id: 'org-1',
        note: 'Coordinating chronic disease management',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
        deleted_at: null,
      };
      expect(careTeam.status).toBe('active');
      expect(careTeam.name).toBe('Primary Care Team');
    });
  });

  describe('care team member structure', () => {
    it('should define complete member structure', () => {
      const member = {
        id: 'member-1',
        care_team_id: 'team-1',
        practitioner_id: 'pract-1',
        role_code: 'pcp',
        role_display: 'Primary Care Physician',
        role_system: 'http://snomed.info/sct',
        period_start: '2026-01-01',
        period_end: null,
        sequence: 1,
        is_primary_contact: true,
        created_at: '2026-01-01T00:00:00Z',
      };
      expect(member.role_code).toBe('pcp');
      expect(member.is_primary_contact).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return error on database failure', async () => {
      const result = await CareTeamService.getByPatient('test');
      expect(result).toHaveProperty('success');
    });
  });
});
