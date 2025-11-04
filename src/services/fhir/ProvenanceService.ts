/**
 * FHIR Provenance Service
 * Manages audit trails and data provenance tracking (FHIR R4)
 *
 * @see https://hl7.org/fhir/R4/provenance.html
 */

import { supabase } from '../../lib/supabaseClient';
import type { FHIRApiResponse } from '../../types/fhir';

export const ProvenanceService = {
  /**
   * Get provenance for a resource
   */
  async getForResource(resourceId: string, resourceType?: string): Promise<FHIRApiResponse<any[]>> {
    try {
      let query = supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [resourceId])
        .order('recorded', { ascending: false });

      if (resourceType) {
        query = query.contains('target_types', [resourceType]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance',
      };
    }
  },

  /**
   * Get provenance by agent (who did it)
   */
  async getByAgent(agentId: string): Promise<FHIRApiResponse<any[]>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('agent', [{ who_id: agentId }])
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch provenance by agent',
      };
    }
  },

  /**
   * Get audit trail for patient
   */
  async getAuditTrail(patientId: string, days: number = 90): Promise<FHIRApiResponse<any[]>> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('fhir_provenance')
        .select('*')
        .contains('target_references', [patientId])
        .gte('recorded', since.toISOString())
        .order('recorded', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audit trail',
      };
    }
  },

  /**
   * Create provenance record
   */
  async create(provenance: any): Promise<FHIRApiResponse<any>> {
    try {
      const { data, error } = await supabase
        .from('fhir_provenance')
        .insert([{
          ...provenance,
          recorded: provenance.recorded || new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create provenance',
      };
    }
  },

  /**
   * Record audit event (helper method)
   */
  async recordAudit(params: {
    targetReferences: string[];
    targetTypes?: string[];
    activity: string;
    agentId: string;
    agentType?: string;
    agentRole?: string;
    onBehalfOfId?: string;
    reason?: string;
  }): Promise<FHIRApiResponse<any>> {
    const provenance = {
      target_references: params.targetReferences,
      target_types: params.targetTypes,
      recorded: new Date().toISOString(),
      activity: {
        code: params.activity,
        system: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
      },
      agent: [{
        who_id: params.agentId,
        type: params.agentType ? {
          code: params.agentType,
          system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
        } : undefined,
        role: params.agentRole ? [{
          code: params.agentRole,
          system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        }] : undefined,
        on_behalf_of_id: params.onBehalfOfId,
      }],
      reason: params.reason ? [{
        code: params.reason,
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
      }] : undefined,
    };

    return this.create(provenance);
  },
};
