/**
 * SDOH Indicator Service
 *
 * Enhanced service layer for comprehensive SDOH visual indicator system.
 * Builds on top of existing SDOHService with additional features:
 * - Comprehensive category coverage (26+ SDOH categories)
 * - Visual indicator data transformation
 * - Risk scoring and complexity assessment
 * - Multi-tenant data isolation
 * - Intervention tracking
 *
 * @see /src/types/sdohIndicators.ts
 * @see /src/services/fhir/SDOHService.ts
 */

import { supabase } from '../lib/supabaseClient';
import { SDOHService } from './fhir/SDOHService';
import type {
  SDOHProfile,
  SDOHFactor,
  SDOHCategory,
  SDOHRiskLevel,
  SDOHInterventionStatus,
  SDOHReferral,
  SDOHResource,
  SDOHScreening,
  calculateOverallSDOHRisk,
  calculateComplexityTier
} from '../types/sdohIndicators';

/**
 * SDOH Indicator Service
 */
export const SDOHIndicatorService = {
  /**
   * Get complete SDOH profile for a patient
   * @param patientId - Patient ID (multi-tenant isolated)
   * @returns Complete SDOH profile with all factors and risk scores
   */
  async getPatientProfile(patientId: string): Promise<SDOHProfile> {
    try {
      // Fetch all SDOH observations from database
      const observations = await SDOHService.getAll(patientId);

      // Transform database records to SDOHFactor format
      const factors: SDOHFactor[] = observations.map((obs: any) => ({
        category: obs.category as SDOHCategory,
        riskLevel: obs.risk_level as SDOHRiskLevel || 'unknown',
        interventionStatus: this.mapInterventionStatus(obs),
        lastAssessed: obs.effective_datetime,
        assessedBy: obs.performer_id,
        nextAssessmentDue: obs.next_assessment_date,
        zCodes: obs.z_codes || [],
        loincCode: obs.loinc_code,
        snomedCode: obs.snomed_code,
        description: obs.value_text || obs.interpretation,
        notes: obs.notes,
        referrals: [], // Loaded separately if needed
        resources: [], // Loaded separately if needed
        impactOnHealth: obs.health_impact,
        priorityLevel: obs.priority_level || this.calculatePriorityFromRisk(obs.risk_level)
      }));

      // Calculate summary metrics using imported helper
      const { calculateOverallSDOHRisk, calculateComplexityTier } = await import('../types/sdohIndicators');
      const overallRiskScore = calculateOverallSDOHRisk(factors);
      const complexityTier = calculateComplexityTier(factors);

      const highRiskCount = factors.filter(f =>
        f.riskLevel === 'high' || f.riskLevel === 'critical'
      ).length;

      const activeInterventionCount = factors.filter(f =>
        f.interventionStatus === 'in-progress' || f.interventionStatus === 'referral-made'
      ).length;

      // Build complete profile
      const profile: SDOHProfile = {
        patientId,
        lastUpdated: new Date().toISOString(),
        factors,
        overallRiskScore,
        highRiskCount,
        activeInterventionCount,
        complexityTier,
        ccmEligible: complexityTier !== 'minimal' && highRiskCount > 0,
        screeningHistory: [] // Could be loaded separately if needed
      };

      return profile;
    } catch (error) {
      console.error('Error fetching SDOH profile:', error);
      throw error;
    }
  },

  /**
   * Update a specific SDOH factor
   * @param patientId - Patient ID
   * @param category - SDOH category to update
   * @param updates - Updated factor data
   */
  async updateFactor(
    patientId: string,
    category: SDOHCategory,
    updates: Partial<SDOHFactor>
  ): Promise<SDOHFactor> {
    try {
      // Find existing observation
      const observations = await SDOHService.getByCategory(patientId, category);
      const latestObs = observations[0];

      if (!latestObs) {
        throw new Error(`No SDOH observation found for category: ${category}`);
      }

      // Map SDOHFactor updates to database format
      const dbUpdates: any = {
        risk_level: updates.riskLevel,
        notes: updates.notes,
        health_impact: updates.impactOnHealth,
        priority_level: updates.priorityLevel,
        next_assessment_date: updates.nextAssessmentDue,
        z_codes: updates.zCodes,
        loinc_code: updates.loincCode,
        snomed_code: updates.snomedCode,
        updated_at: new Date().toISOString()
      };

      // Update intervention status if provided
      if (updates.interventionStatus) {
        Object.assign(dbUpdates, this.mapInterventionStatusToDb(updates.interventionStatus));
      }

      // Update in database
      const { data, error } = await supabase
        .from('sdoh_observations')
        .update(dbUpdates)
        .eq('id', latestObs.id)
        .eq('patient_id', patientId) // Multi-tenant isolation
        .select()
        .single();

      if (error) throw error;

      // Transform back to SDOHFactor
      return {
        category,
        riskLevel: data.risk_level,
        interventionStatus: this.mapInterventionStatus(data),
        lastAssessed: data.effective_datetime,
        assessedBy: data.performer_id,
        nextAssessmentDue: data.next_assessment_date,
        zCodes: data.z_codes,
        loincCode: data.loinc_code,
        snomedCode: data.snomed_code,
        description: data.value_text,
        notes: data.notes,
        impactOnHealth: data.health_impact,
        priorityLevel: data.priority_level
      };
    } catch (error) {
      console.error('Error updating SDOH factor:', error);
      throw error;
    }
  },

  /**
   * Add a referral for a SDOH factor
   * @param patientId - Patient ID
   * @param category - SDOH category
   * @param referral - Referral details
   */
  async addReferral(
    patientId: string,
    category: SDOHCategory,
    referral: Omit<SDOHReferral, 'id'>
  ): Promise<SDOHReferral> {
    try {
      const { data, error } = await supabase
        .from('sdoh_referrals')
        .insert([{
          patient_id: patientId,
          category,
          service: referral.service,
          organization: referral.organization,
          contact_info: referral.contactInfo,
          date_referred: referral.dateReferred,
          status: referral.status,
          follow_up_date: referral.followUpDate,
          notes: referral.notes,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        service: data.service,
        organization: data.organization,
        contactInfo: data.contact_info,
        dateReferred: data.date_referred,
        status: data.status,
        followUpDate: data.follow_up_date,
        notes: data.notes
      };
    } catch (error) {
      console.error('Error adding SDOH referral:', error);
      throw error;
    }
  },

  /**
   * Add a resource provided to patient
   * @param patientId - Patient ID
   * @param category - SDOH category
   * @param resource - Resource details
   */
  async addResource(
    patientId: string,
    category: SDOHCategory,
    resource: Omit<SDOHResource, 'id'>
  ): Promise<SDOHResource> {
    try {
      const { data, error } = await supabase
        .from('sdoh_resources')
        .insert([{
          patient_id: patientId,
          category,
          type: resource.type,
          name: resource.name,
          description: resource.description,
          date_provided: resource.dateProvided,
          provided_by: resource.providedBy,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        type: data.type,
        name: data.name,
        description: data.description,
        dateProvided: data.date_provided,
        providedBy: data.provided_by
      };
    } catch (error) {
      console.error('Error adding SDOH resource:', error);
      throw error;
    }
  },

  /**
   * Record a new SDOH screening event
   * @param patientId - Patient ID
   * @param screening - Screening details
   */
  async recordScreening(
    patientId: string,
    screening: Omit<SDOHScreening, 'id'>
  ): Promise<SDOHScreening> {
    try {
      const { data, error } = await supabase
        .from('sdoh_screenings')
        .insert([{
          patient_id: patientId,
          date: screening.date,
          type: screening.type,
          tool: screening.tool,
          screened_by: screening.screenedBy,
          factors_identified: screening.factorsIdentified,
          factors_addressed: screening.factorsAddressed,
          notes: screening.notes,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        date: data.date,
        type: data.type,
        tool: data.tool,
        screenedBy: data.screened_by,
        factorsIdentified: data.factors_identified,
        factorsAddressed: data.factors_addressed,
        notes: data.notes
      };
    } catch (error) {
      console.error('Error recording SDOH screening:', error);
      throw error;
    }
  },

  /**
   * Get referrals for a specific category
   * @param patientId - Patient ID
   * @param category - SDOH category
   */
  async getReferrals(patientId: string, category: SDOHCategory): Promise<SDOHReferral[]> {
    try {
      const { data, error } = await supabase
        .from('sdoh_referrals')
        .select('*')
        .eq('patient_id', patientId)
        .eq('category', category)
        .order('date_referred', { ascending: false });

      if (error) throw error;

      return (data || []).map((ref: any) => ({
        id: ref.id,
        service: ref.service,
        organization: ref.organization,
        contactInfo: ref.contact_info,
        dateReferred: ref.date_referred,
        status: ref.status,
        followUpDate: ref.follow_up_date,
        notes: ref.notes
      }));
    } catch (error) {
      console.error('Error fetching SDOH referrals:', error);
      return [];
    }
  },

  /**
   * Get resources for a specific category
   * @param patientId - Patient ID
   * @param category - SDOH category
   */
  async getResources(patientId: string, category: SDOHCategory): Promise<SDOHResource[]> {
    try {
      const { data, error } = await supabase
        .from('sdoh_resources')
        .select('*')
        .eq('patient_id', patientId)
        .eq('category', category)
        .order('date_provided', { ascending: false });

      if (error) throw error;

      return (data || []).map((res: any) => ({
        id: res.id,
        type: res.type,
        name: res.name,
        description: res.description,
        dateProvided: res.date_provided,
        providedBy: res.provided_by
      }));
    } catch (error) {
      console.error('Error fetching SDOH resources:', error);
      return [];
    }
  },

  /**
   * Get complete factor with referrals and resources
   * @param patientId - Patient ID
   * @param category - SDOH category
   */
  async getCompleteFacto(patientId: string, category: SDOHCategory): Promise<SDOHFactor | null> {
    try {
      const observations = await SDOHService.getByCategory(patientId, category);
      if (observations.length === 0) return null;

      const obs = observations[0];
      const [referrals, resources] = await Promise.all([
        this.getReferrals(patientId, category),
        this.getResources(patientId, category)
      ]);

      return {
        category,
        riskLevel: obs.risk_level,
        interventionStatus: this.mapInterventionStatus(obs),
        lastAssessed: obs.effective_datetime,
        assessedBy: obs.performer_id,
        nextAssessmentDue: obs.next_assessment_date,
        zCodes: obs.z_codes,
        loincCode: obs.loinc_code,
        snomedCode: obs.snomed_code,
        description: obs.value_text,
        notes: obs.notes,
        referrals,
        resources,
        impactOnHealth: obs.health_impact,
        priorityLevel: obs.priority_level
      };
    } catch (error) {
      console.error('Error fetching complete SDOH factor:', error);
      return null;
    }
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Map database fields to intervention status
   */
  mapInterventionStatus(obs: any): SDOHInterventionStatus {
    if (!obs.status || obs.status === 'preliminary') return 'not-assessed';
    if (obs.status === 'cancelled') return 'declined';

    if (obs.intervention_provided && obs.referral_made) return 'in-progress';
    if (obs.referral_made) return 'referral-made';
    if (obs.intervention_provided) return 'resolved';
    if (obs.status === 'final') return 'identified';

    return 'not-assessed';
  },

  /**
   * Map intervention status to database fields
   */
  mapInterventionStatusToDb(status: SDOHInterventionStatus): any {
    const mapping = {
      'not-assessed': { status: 'preliminary', intervention_provided: false, referral_made: false },
      'identified': { status: 'final', intervention_provided: false, referral_made: false },
      'referral-made': { status: 'final', intervention_provided: false, referral_made: true },
      'in-progress': { status: 'final', intervention_provided: true, referral_made: true },
      'resolved': { status: 'final', intervention_provided: true, referral_made: false },
      'declined': { status: 'cancelled', intervention_provided: false, referral_made: false }
    };

    return mapping[status] || mapping['not-assessed'];
  },

  /**
   * Calculate priority level from risk level
   */
  calculatePriorityFromRisk(riskLevel: string): number {
    const priorityMap: Record<string, number> = {
      'critical': 5,
      'high': 4,
      'moderate': 3,
      'low': 2,
      'none': 1,
      'unknown': 1
    };

    return priorityMap[riskLevel] || 1;
  },

  /**
   * Get high-priority alerts for a patient
   * Returns factors that need immediate attention
   */
  async getHighPriorityAlerts(patientId: string): Promise<SDOHFactor[]> {
    try {
      const profile = await this.getPatientProfile(patientId);
      return profile.factors.filter(factor =>
        (factor.riskLevel === 'critical' || factor.riskLevel === 'high') &&
        (factor.interventionStatus === 'identified' || factor.interventionStatus === 'not-assessed')
      );
    } catch (error) {
      console.error('Error fetching high-priority SDOH alerts:', error);
      return [];
    }
  }
};

export default SDOHIndicatorService;
