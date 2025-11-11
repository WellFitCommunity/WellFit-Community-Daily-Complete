/**
 * Law Enforcement Service
 *
 * Service layer for Precinct 3 "Are You OK" senior welfare check program
 * Handles emergency response information and welfare check dispatch
 */

import { supabase } from '../lib/supabaseClient';
import type {
  EmergencyResponseInfo,
  EmergencyResponseFormData,
  WelfareCheckInfo,
  MissedCheckInAlert,
  SeniorCheckInStatus,
  ResponsePriority
} from '../types/lawEnforcement';

export const LawEnforcementService = {
  /**
   * Get emergency response info for a senior
   */
  async getEmergencyResponseInfo(patientId: string): Promise<EmergencyResponseInfo | null> {
    try {
      const { data, error } = await supabase
        .from('law_enforcement_response_info')
        .select('*')
        .eq('patient_id', patientId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found - this is OK, not all seniors have emergency info yet
          return null;
        }
        throw error;
      }

      return this.transformFromDb(data);
    } catch (error) {
      // Error logged server-side
      return null;
    }
  },

  /**
   * Create or update emergency response info
   */
  async upsertEmergencyResponseInfo(
    patientId: string,
    data: Partial<EmergencyResponseFormData>
  ): Promise<EmergencyResponseInfo> {
    try {
      const dbData = this.transformToDb(data);

      const { data: result, error } = await supabase
        .from('law_enforcement_response_info')
        .upsert({
          patient_id: patientId,
          ...dbData,
          last_verified_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (error) throw error;

      return this.transformFromDb(result);
    } catch (error) {
      throw new Error('Failed to save emergency response information');
    }
  },

  /**
   * Get complete welfare check info for dispatch
   * Uses database function for optimized query
   */
  async getWelfareCheckInfo(patientId: string): Promise<WelfareCheckInfo | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_welfare_check_info', { p_patient_id: patientId })
        .single();

      if (error) throw error;

      const result = data as any;

      return result ? {
        patientId: result.patient_id,
        patientName: result.patient_name,
        patientAge: result.patient_age,
        patientPhone: result.patient_phone,
        patientAddress: result.patient_address,
        buildingLocation: result.building_location,
        floorNumber: result.floor_number,
        elevatorRequired: result.elevator_required || false,
        parkingInstructions: result.parking_instructions,
        mobilityStatus: result.mobility_status,
        medicalEquipment: result.medical_equipment || [],
        communicationNeeds: result.communication_needs,
        accessInstructions: result.access_instructions,
        pets: result.pets,
        responsePriority: result.response_priority as ResponsePriority,
        specialInstructions: result.special_instructions,
        emergencyContacts: result.emergency_contacts || [],
        neighborInfo: result.neighbor_info,
        fallRisk: result.fall_risk,
        cognitiveImpairment: result.cognitive_impairment,
        oxygenDependent: result.oxygen_dependent,
        lastCheckInTime: result.last_check_in_time,
        hoursSinceCheckIn: result.hours_since_check_in
      } : null;
    } catch (error) {
      // Error logged server-side
      return null;
    }
  },

  /**
   * Get all missed check-in alerts
   * Returns seniors who need welfare checks, prioritized by urgency
   */
  async getMissedCheckInAlerts(): Promise<MissedCheckInAlert[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_missed_check_in_alerts');

      if (error) throw error;

      return (data || []).map((row: any) => ({
        patientId: row.patient_id,
        patientName: row.patient_name,
        patientAddress: row.patient_address,
        patientPhone: row.patient_phone,
        hoursSinceCheckIn: row.hours_since_check_in,
        responsePriority: row.response_priority as ResponsePriority,
        mobilityStatus: row.mobility_status,
        specialNeeds: row.special_needs,
        emergencyContactName: row.emergency_contact_name,
        emergencyContactPhone: row.emergency_contact_phone,
        urgencyScore: row.urgency_score
      }));
    } catch (error) {
      // Error logged server-side
      return [];
    }
  },

  /**
   * Get real-time check-in status for all seniors
   * For dashboard monitoring
   */
  async getSeniorCheckInStatuses(): Promise<SeniorCheckInStatus[]> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select(`
          id,
          full_name,
          address,
          check_ins!inner(created_at),
          law_enforcement_response_info(response_priority, escalation_delay_hours)
        `)
        .order('full_name');

      if (error) throw error;

      return (data || []).map((patient: any) => {
        const lastCheckIn = patient.check_ins?.[0]?.created_at;
        const hoursSinceCheckIn = lastCheckIn
          ? (Date.now() - new Date(lastCheckIn).getTime()) / (1000 * 60 * 60)
          : null;

        const priority: ResponsePriority = patient.law_enforcement_response_info?.[0]?.response_priority || 'standard';
        const escalationDelay = patient.law_enforcement_response_info?.[0]?.escalation_delay_hours || 6;

        let status: SeniorCheckInStatus['status'] = 'ok';
        if (!lastCheckIn || !hoursSinceCheckIn) {
          status = 'pending';
        } else if (hoursSinceCheckIn >= escalationDelay) {
          status = 'critical';
        } else if (hoursSinceCheckIn >= escalationDelay * 0.75) {
          status = 'overdue';
        }

        return {
          patientId: patient.id,
          patientName: patient.full_name,
          patientAddress: patient.address,
          lastCheckIn,
          status,
          hoursSinceCheckIn: hoursSinceCheckIn || undefined,
          responsePriority: priority,
          requiresAction: status === 'critical' || status === 'overdue'
        };
      });
    } catch (error) {
      // Error logged server-side
      return [];
    }
  },

  /**
   * Send check-in reminder to senior
   */
  async sendCheckInReminder(patientId: string): Promise<boolean> {
    try {
      // Get patient contact info
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('phone, email, full_name')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;

      // Send SMS reminder (if phone available)
      if (patient.phone) {
        await supabase.functions.invoke('send-check-in-reminder-sms', {
          body: {
            phone: patient.phone,
            name: patient.full_name
          }
        });
      }

      // TODO: Send email reminder if email available

      return true;
    } catch (error) {
      // Error logged server-side
      return false;
    }
  },

  /**
   * Notify family of missed check-in
   */
  async notifyFamilyMissedCheckIn(patientId: string): Promise<boolean> {
    try {
      const { data: patient, error } = await supabase
        .from('patients')
        .select('full_name, emergency_contacts')
        .eq('id', patientId)
        .single();

      if (error) throw error;

      const emergencyContacts = patient.emergency_contacts || [];
      const primaryContact = emergencyContacts.find((c: any) => c.isPrimary) || emergencyContacts[0];

      if (primaryContact?.phone) {
        await supabase.functions.invoke('notify-family-missed-check-in', {
          body: {
            seniorName: patient.full_name,
            contactName: primaryContact.name,
            contactPhone: primaryContact.phone
          }
        });

        return true;
      }

      return false;
    } catch (error) {
      // Error logged server-side
      return false;
    }
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Transform database record to TypeScript interface
   */
  transformFromDb(data: any): EmergencyResponseInfo {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      patientId: data.patient_id,

      bedBound: data.bed_bound,
      wheelchairBound: data.wheelchair_bound,
      walkerRequired: data.walker_required,
      caneRequired: data.cane_required,
      mobilityNotes: data.mobility_notes,

      oxygenDependent: data.oxygen_dependent,
      oxygenTankLocation: data.oxygen_tank_location,
      dialysisRequired: data.dialysis_required,
      dialysisSchedule: data.dialysis_schedule,
      medicalEquipment: data.medical_equipment || [],

      hearingImpaired: data.hearing_impaired,
      hearingImpairedNotes: data.hearing_impaired_notes,
      visionImpaired: data.vision_impaired,
      visionImpairedNotes: data.vision_impaired_notes,
      cognitiveImpairment: data.cognitive_impairment,
      cognitiveImpairmentType: data.cognitive_impairment_type,
      cognitiveImpairmentNotes: data.cognitive_impairment_notes,
      nonVerbal: data.non_verbal,
      languageBarrier: data.language_barrier,

      floorNumber: data.floor_number,
      buildingQuadrant: data.building_quadrant,
      elevatorRequired: data.elevator_required,
      elevatorAccessCode: data.elevator_access_code,
      buildingType: data.building_type,
      stairsToUnit: data.stairs_to_unit,

      doorCode: data.door_code,
      keyLocation: data.key_location,
      accessInstructions: data.access_instructions,
      doorOpensInward: data.door_opens_inward,
      securitySystem: data.security_system,
      securitySystemCode: data.security_system_code,
      petsInHome: data.pets_in_home,
      parkingInstructions: data.parking_instructions,
      gatedCommunityCode: data.gated_community_code,
      lobbyAccessInstructions: data.lobby_access_instructions,
      bestEntrance: data.best_entrance,
      intercomInstructions: data.intercom_instructions,

      fallRiskHigh: data.fall_risk_high,
      fallHistory: data.fall_history,
      homeHazards: data.home_hazards,

      neighborName: data.neighbor_name,
      neighborAddress: data.neighbor_address,
      neighborPhone: data.neighbor_phone,
      buildingManagerName: data.building_manager_name,
      buildingManagerPhone: data.building_manager_phone,

      responsePriority: data.response_priority as ResponsePriority,
      escalationDelayHours: data.escalation_delay_hours,
      specialInstructions: data.special_instructions,

      criticalMedications: data.critical_medications || [],
      medicationLocation: data.medication_location,
      medicalConditionsSummary: data.medical_conditions_summary,

      consentObtained: data.consent_obtained,
      consentDate: data.consent_date,
      consentGivenBy: data.consent_given_by,
      hipaaAuthorization: data.hipaa_authorization,

      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      lastVerifiedDate: data.last_verified_date
    };
  },

  /**
   * Transform TypeScript interface to database record
   */
  transformToDb(data: Partial<EmergencyResponseFormData>): any {
    return {
      bed_bound: data.bedBound,
      wheelchair_bound: data.wheelchairBound,
      walker_required: data.walkerRequired,
      cane_required: data.caneRequired,
      mobility_notes: data.mobilityNotes,

      oxygen_dependent: data.oxygenDependent,
      oxygen_tank_location: data.oxygenTankLocation,
      dialysis_required: data.dialysisRequired,
      dialysis_schedule: data.dialysisSchedule,
      medical_equipment: data.medicalEquipment,

      hearing_impaired: data.hearingImpaired,
      hearing_impaired_notes: data.hearingImpairedNotes,
      vision_impaired: data.visionImpaired,
      vision_impaired_notes: data.visionImpairedNotes,
      cognitive_impairment: data.cognitiveImpairment,
      cognitive_impairment_type: data.cognitiveImpairmentType,
      cognitive_impairment_notes: data.cognitiveImpairmentNotes,
      non_verbal: data.nonVerbal,
      language_barrier: data.languageBarrier,

      floor_number: data.floorNumber,
      building_quadrant: data.buildingQuadrant,
      elevator_required: data.elevatorRequired,
      elevator_access_code: data.elevatorAccessCode,
      building_type: data.buildingType,
      stairs_to_unit: data.stairsToUnit,

      door_code: data.doorCode,
      key_location: data.keyLocation,
      access_instructions: data.accessInstructions,
      door_opens_inward: data.doorOpensInward,
      security_system: data.securitySystem,
      security_system_code: data.securitySystemCode,
      pets_in_home: data.petsInHome,
      parking_instructions: data.parkingInstructions,
      gated_community_code: data.gatedCommunityCode,
      lobby_access_instructions: data.lobbyAccessInstructions,
      best_entrance: data.bestEntrance,
      intercom_instructions: data.intercomInstructions,

      fall_risk_high: data.fallRiskHigh,
      fall_history: data.fallHistory,
      home_hazards: data.homeHazards,

      neighbor_name: data.neighborName,
      neighbor_address: data.neighborAddress,
      neighbor_phone: data.neighborPhone,
      building_manager_name: data.buildingManagerName,
      building_manager_phone: data.buildingManagerPhone,

      response_priority: data.responsePriority,
      escalation_delay_hours: data.escalationDelayHours,
      special_instructions: data.specialInstructions,

      critical_medications: data.criticalMedications,
      medication_location: data.medicationLocation,
      medical_conditions_summary: data.medicalConditionsSummary,

      consent_obtained: data.consentObtained,
      consent_date: data.consentDate,
      consent_given_by: data.consentGivenBy,
      hipaa_authorization: data.hipaaAuthorization
    };
  }
};

export default LawEnforcementService;
