/**
 * FHIR CareTeam Service
 * Handles care team composition and member management
 *
 * FHIR R4 Resource: CareTeam
 * Purpose: Records care team members, roles, and coordination
 *
 * @see https://hl7.org/fhir/R4/careteam.html
 */

import { supabase } from '../../lib/supabaseClient';
import type {
  FHIRCareTeam,
  FHIRCareTeamMember,
  FHIRApiResponse,
} from '../../types/fhir';

export class CareTeamService {
  /**
   * Get all care teams for a patient
   * @param patientId - FHIR Patient resource ID
   * @returns All CareTeam resources ordered by date (newest first)
   */
  static async getByPatient(patientId: string): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care teams',
      };
    }
  }

  /**
   * Get care team by ID
   *
   * @param id - CareTeam resource ID
   * @returns CareTeam resource or null if not found
   */
  static async getById(id: string): Promise<FHIRApiResponse<FHIRCareTeam | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null }; // Not found
        }
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care team',
      };
    }
  }

  /**
   * Get active care teams for a patient
   *
   * Filters for status = 'active' and period_end is null or future
   *
   * @param patientId - FHIR Patient resource ID
   * @returns Active CareTeam resources
   */
  static async getActive(patientId: string): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active care teams',
      };
    }
  }

  /**
   * Get care teams by status
   *
   * Filters by FHIR status
   * Statuses: proposed, active, suspended, inactive, entered-in-error
   *
   * @param patientId - FHIR Patient resource ID
   * @param status - FHIR CareTeam status
   * @returns Filtered CareTeam resources
   */
  static async getByStatus(
    patientId: string,
    status: string
  ): Promise<FHIRApiResponse<FHIRCareTeam[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', status)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care teams by status',
      };
    }
  }

  /**
   * Create a new care team
   *
   * Common use cases:
   * - Assemble team for complex care coordination
   * - Define hospitalist team
   * - Establish longitudinal primary care team
   *
   * @param careTeam - CareTeam resource to create
   * @returns Created CareTeam with server-assigned ID
   */
  static async create(careTeam: Partial<FHIRCareTeam>): Promise<FHIRApiResponse<FHIRCareTeam>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .insert([careTeam])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create care team',
      };
    }
  }

  /**
   * Update a care team
   *
   * Common use cases:
   * - Change status
   * - Update team name
   * - Modify period
   *
   * @param id - CareTeam resource ID
   * @param updates - Partial CareTeam fields to update
   * @returns Updated CareTeam resource
   */
  static async update(
    id: string,
    updates: Partial<FHIRCareTeam>
  ): Promise<FHIRApiResponse<FHIRCareTeam>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_teams')
        .update(updates)
        .eq('id', id)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update care team',
      };
    }
  }

  /**
   * Soft delete a care team
   *
   * Sets deleted_at timestamp for audit trail compliance
   *
   * @param id - CareTeam resource ID
   * @returns Success indicator
   */
  static async delete(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('fhir_care_teams')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete care team',
      };
    }
  }

  /**
   * Activate a care team
   *
   * Sets status to 'active' and records start date
   *
   * @param id - CareTeam resource ID
   * @returns Updated CareTeam with active status
   */
  static async activate(id: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    return this.update(id, {
      status: 'active',
      period_start: new Date().toISOString(),
    });
  }

  /**
   * Suspend a care team
   *
   * Pauses care team temporarily
   * Used when care coordination is on hold
   *
   * @param id - CareTeam resource ID
   * @param reason - Optional reason for suspension
   * @returns Updated CareTeam with suspended status
   */
  static async suspend(id: string, reason?: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    const updates: Partial<FHIRCareTeam> = {
      status: 'suspended',
    };
    if (reason) {
      updates.note = reason;
    }
    return this.update(id, updates);
  }

  /**
   * End a care team (set period_end and status to inactive)
   *
   * Marks care team as no longer active
   * Used when patient discharged or care coordination completed
   *
   * @param id - CareTeam resource ID
   * @returns Updated CareTeam with inactive status
   */
  static async end(id: string): Promise<FHIRApiResponse<FHIRCareTeam>> {
    return this.update(id, {
      status: 'inactive',
      period_end: new Date().toISOString(),
    });
  }

  // ============================================================================
  // CARE TEAM MEMBERS
  // ============================================================================

  /**
   * Get all members of a care team
   *
   * @param careTeamId - CareTeam resource ID
   * @returns All CareTeamMember resources ordered by sequence
   */
  static async getMembers(careTeamId: string): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch care team members',
      };
    }
  }

  /**
   * Get active members of a care team
   *
   * Filters for members with period_end null or future
   *
   * @param careTeamId - CareTeam resource ID
   * @returns Active CareTeamMember resources
   */
  static async getActiveMembers(
    careTeamId: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('sequence', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active care team members',
      };
    }
  }

  /**
   * Get primary contact for a care team
   *
   * Returns the designated primary contact person
   * Used for care coordination communication
   *
   * @param careTeamId - CareTeam resource ID
   * @returns Primary CareTeamMember or null
   */
  static async getPrimaryContact(
    careTeamId: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember | null>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .eq('is_primary_contact', true)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: true, data: null }; // Not found
        }
        throw error;
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch primary contact',
      };
    }
  }

  /**
   * Add a member to a care team
   *
   * Common roles: primary-care-physician, care-coordinator, nurse, specialist
   *
   * @param member - CareTeamMember resource to create
   * @returns Created CareTeamMember with server-assigned ID
   */
  static async addMember(
    member: Partial<FHIRCareTeamMember>
  ): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .insert([member])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add care team member',
      };
    }
  }

  /**
   * Update a care team member
   *
   * Common use cases:
   * - Change role
   * - Update sequence/priority
   * - Set/unset primary contact
   *
   * @param id - CareTeamMember resource ID
   * @param updates - Partial CareTeamMember fields to update
   * @returns Updated CareTeamMember resource
   */
  static async updateMember(
    id: string,
    updates: Partial<FHIRCareTeamMember>
  ): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update care team member',
      };
    }
  }

  /**
   * Remove a member from a care team (set period_end)
   *
   * Soft removal - sets end date for audit trail
   *
   * @param id - CareTeamMember resource ID
   * @returns Updated CareTeamMember with period_end set
   */
  static async removeMember(id: string): Promise<FHIRApiResponse<FHIRCareTeamMember>> {
    return this.updateMember(id, {
      period_end: new Date().toISOString(),
    });
  }

  /**
   * Delete a care team member
   *
   * Hard delete - use with caution
   * Consider using removeMember() instead for audit trail
   *
   * @param id - CareTeamMember resource ID
   * @returns Success indicator
   */
  static async deleteMember(id: string): Promise<FHIRApiResponse<void>> {
    try {
      const { error } = await supabase.from('fhir_care_team_members').delete().eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete care team member',
      };
    }
  }

  /**
   * Get members by role
   *
   * Filters members by their care team role
   * Useful for finding specific providers (e.g., all nurses on team)
   *
   * @param careTeamId - CareTeam resource ID
   * @param roleCode - Role code to filter by
   * @returns Filtered CareTeamMember resources
   */
  static async getMembersByRole(
    careTeamId: string,
    roleCode: string
  ): Promise<FHIRApiResponse<FHIRCareTeamMember[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_care_team_members')
        .select('*')
        .eq('care_team_id', careTeamId)
        .eq('role_code', roleCode)
        .or('period_end.is.null,period_end.gte.' + new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch members by role',
      };
    }
  }
}
