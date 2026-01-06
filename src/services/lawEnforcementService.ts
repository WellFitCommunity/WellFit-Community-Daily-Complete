/**
 * Law Enforcement Service
 *
 * Service layer for Precinct 3 "Are You OK" senior welfare check program
 * Handles emergency response information and welfare check dispatch
 */

import { supabase } from '../lib/supabaseClient';
import { getEmailService } from './emailService';
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
    } catch {
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
    } catch {
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

      // Type assertion for RPC result matching WelfareCheckInfo database columns
      const result = data as unknown as {
        patient_id: string;
        patient_name: string;
        patient_age: number;
        patient_phone: string;
        patient_address: string;
        building_location?: string;
        floor_number?: string;
        elevator_required?: boolean;
        parking_instructions?: string;
        mobility_status?: string;
        medical_equipment?: string[];
        communication_needs?: string;
        access_instructions?: string;
        pets?: string;
        response_priority?: string;
        special_instructions?: string;
        emergency_contacts?: Array<{ name: string; phone: string; relationship: string; email?: string; is_primary?: boolean }>;
        neighbor_name?: string;
        neighbor_address?: string;
        neighbor_phone?: string;
        fall_risk?: boolean;
        cognitive_impairment?: boolean;
        oxygen_dependent?: boolean;
        last_check_in_time?: string;
        hours_since_check_in?: number;
      } | null;

      return result ? {
        patientId: result.patient_id,
        patientName: result.patient_name,
        patientAge: result.patient_age,
        patientPhone: result.patient_phone,
        patientAddress: result.patient_address,
        buildingLocation: result.building_location,
        floorNumber: result.floor_number,
        elevatorRequired: result.elevator_required ?? false,
        parkingInstructions: result.parking_instructions,
        mobilityStatus: result.mobility_status || 'Unknown',
        medicalEquipment: result.medical_equipment || [],
        communicationNeeds: result.communication_needs || 'None specified',
        accessInstructions: result.access_instructions || 'No special instructions',
        pets: result.pets,
        responsePriority: (result.response_priority as ResponsePriority) || 'standard',
        specialInstructions: result.special_instructions,
        emergencyContacts: (result.emergency_contacts || []).map(c => ({
          name: c.name,
          relationship: c.relationship,
          phone: c.phone,
          email: c.email,
          isPrimary: c.is_primary ?? false
        })),
        neighborInfo: result.neighbor_name ? {
          name: result.neighbor_name,
          address: result.neighbor_address || '',
          phone: result.neighbor_phone || ''
        } : undefined,
        fallRisk: result.fall_risk ?? false,
        cognitiveImpairment: result.cognitive_impairment ?? false,
        oxygenDependent: result.oxygen_dependent ?? false,
        lastCheckInTime: result.last_check_in_time,
        hoursSinceCheckIn: result.hours_since_check_in
      } : null;
    } catch {
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

      // Type for RPC result rows
      type AlertRow = {
        patient_id: string;
        patient_name: string;
        patient_address: string;
        patient_phone: string;
        hours_since_check_in: number;
        response_priority: string;
        mobility_status?: string;
        special_needs?: string;
        emergency_contact_name?: string;
        emergency_contact_phone?: string;
        urgency_score: number;
      };
      return ((data || []) as AlertRow[]).map((row) => ({
        patientId: row.patient_id,
        patientName: row.patient_name,
        patientAddress: row.patient_address,
        patientPhone: row.patient_phone,
        hoursSinceCheckIn: row.hours_since_check_in,
        responsePriority: (row.response_priority as ResponsePriority) || 'standard',
        mobilityStatus: row.mobility_status || 'Unknown',
        specialNeeds: row.special_needs || 'None',
        emergencyContactName: row.emergency_contact_name || 'Not provided',
        emergencyContactPhone: row.emergency_contact_phone || 'Not provided',
        urgencyScore: row.urgency_score
      }));
    } catch {
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

      // Type for Supabase join result
      type PatientRow = {
        id: string;
        full_name: string;
        address: string;
        check_ins?: Array<{ created_at: string }>;
        law_enforcement_response_info?: Array<{ response_priority?: string; escalation_delay_hours?: number }>;
      };
      return ((data || []) as PatientRow[]).map((patient) => {
        const lastCheckIn = patient.check_ins?.[0]?.created_at;
        const hoursSinceCheckIn = lastCheckIn
          ? (Date.now() - new Date(lastCheckIn).getTime()) / (1000 * 60 * 60)
          : null;

        const priority: ResponsePriority = (patient.law_enforcement_response_info?.[0]?.response_priority as ResponsePriority) || 'standard';
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
    } catch {
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

      // Send email reminder if email available
      if (patient.email) {
        const emailService = getEmailService();
        await emailService.send({
          to: { email: patient.email, name: patient.full_name },
          subject: 'Check-In Reminder - WellFit Community',
          html: `
            <h1>Check-In Reminder</h1>
            <p>Hello ${patient.full_name},</p>
            <p>This is a friendly reminder to complete your daily check-in.</p>
            <p>Your wellness matters to us and your loved ones. Please take a moment to check in today.</p>
            <p>Best regards,<br>The WellFit Community Team</p>
          `,
          tags: ['check-in', 'reminder'],
        });
      }

      return true;
    } catch {
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

      type EmergencyContact = { name?: string; phone?: string; isPrimary?: boolean };
      const emergencyContacts = (patient.emergency_contacts || []) as EmergencyContact[];
      const primaryContact = emergencyContacts.find((c) => c.isPrimary) || emergencyContacts[0];

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
    } catch {
      // Error logged server-side
      return false;
    }
  },

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Transform database record to TypeScript interface
   * Uses type assertion at database boundary per CLAUDE.md guidelines
   */
  transformFromDb(data: Record<string, unknown>): EmergencyResponseInfo {
    // Database row transformation - cast at boundary
    const row = data as unknown as {
      id: string;
      tenant_id: string;
      patient_id: string;
      bed_bound?: boolean;
      wheelchair_bound?: boolean;
      walker_required?: boolean;
      cane_required?: boolean;
      mobility_notes?: string;
      oxygen_dependent?: boolean;
      oxygen_tank_location?: string;
      dialysis_required?: boolean;
      dialysis_schedule?: string;
      medical_equipment?: string[];
      hearing_impaired?: boolean;
      hearing_impaired_notes?: string;
      vision_impaired?: boolean;
      vision_impaired_notes?: string;
      cognitive_impairment?: boolean;
      cognitive_impairment_type?: string;
      cognitive_impairment_notes?: string;
      non_verbal?: boolean;
      language_barrier?: string;
      floor_number?: string;
      building_quadrant?: string;
      elevator_required?: boolean;
      elevator_access_code?: string;
      building_type?: string;
      stairs_to_unit?: number;
      door_code?: string;
      key_location?: string;
      access_instructions?: string;
      door_opens_inward?: boolean;
      security_system?: boolean;
      security_system_code?: string;
      pets_in_home?: string;
      parking_instructions?: string;
      gated_community_code?: string;
      lobby_access_instructions?: string;
      best_entrance?: string;
      intercom_instructions?: string;
      fall_risk_high?: boolean;
      fall_history?: string;
      home_hazards?: string;
      neighbor_name?: string;
      neighbor_address?: string;
      neighbor_phone?: string;
      building_manager_name?: string;
      building_manager_phone?: string;
      response_priority?: string;
      escalation_delay_hours?: number;
      special_instructions?: string;
      critical_medications?: string[];
      medication_location?: string;
      medical_conditions_summary?: string;
      consent_obtained?: boolean;
      consent_date?: string;
      consent_given_by?: string;
      hipaa_authorization?: boolean;
      created_at: string;
      updated_at: string;
      created_by?: string;
      updated_by?: string;
      last_verified_date?: string;
    };

    return {
      id: row.id,
      tenantId: row.tenant_id,
      patientId: row.patient_id,

      bedBound: row.bed_bound ?? false,
      wheelchairBound: row.wheelchair_bound ?? false,
      walkerRequired: row.walker_required ?? false,
      caneRequired: row.cane_required ?? false,
      mobilityNotes: row.mobility_notes,

      oxygenDependent: row.oxygen_dependent ?? false,
      oxygenTankLocation: row.oxygen_tank_location,
      dialysisRequired: row.dialysis_required ?? false,
      dialysisSchedule: row.dialysis_schedule,
      medicalEquipment: row.medical_equipment || [],

      hearingImpaired: row.hearing_impaired ?? false,
      hearingImpairedNotes: row.hearing_impaired_notes,
      visionImpaired: row.vision_impaired ?? false,
      visionImpairedNotes: row.vision_impaired_notes,
      cognitiveImpairment: row.cognitive_impairment ?? false,
      cognitiveImpairmentType: row.cognitive_impairment_type,
      cognitiveImpairmentNotes: row.cognitive_impairment_notes,
      nonVerbal: row.non_verbal ?? false,
      languageBarrier: row.language_barrier,

      floorNumber: row.floor_number,
      buildingQuadrant: row.building_quadrant,
      elevatorRequired: row.elevator_required ?? false,
      elevatorAccessCode: row.elevator_access_code,
      buildingType: row.building_type,
      stairsToUnit: row.stairs_to_unit,

      doorCode: row.door_code,
      keyLocation: row.key_location,
      accessInstructions: row.access_instructions,
      doorOpensInward: row.door_opens_inward ?? false,
      securitySystem: row.security_system ?? false,
      securitySystemCode: row.security_system_code,
      petsInHome: row.pets_in_home,
      parkingInstructions: row.parking_instructions,
      gatedCommunityCode: row.gated_community_code,
      lobbyAccessInstructions: row.lobby_access_instructions,
      bestEntrance: row.best_entrance,
      intercomInstructions: row.intercom_instructions,

      fallRiskHigh: row.fall_risk_high ?? false,
      fallHistory: row.fall_history,
      homeHazards: row.home_hazards,

      neighborName: row.neighbor_name,
      neighborAddress: row.neighbor_address,
      neighborPhone: row.neighbor_phone,
      buildingManagerName: row.building_manager_name,
      buildingManagerPhone: row.building_manager_phone,

      responsePriority: (row.response_priority as ResponsePriority) || 'standard',
      escalationDelayHours: row.escalation_delay_hours ?? 6,
      specialInstructions: row.special_instructions,

      criticalMedications: row.critical_medications || [],
      medicationLocation: row.medication_location,
      medicalConditionsSummary: row.medical_conditions_summary,

      consentObtained: row.consent_obtained ?? false,
      consentDate: row.consent_date,
      consentGivenBy: row.consent_given_by,
      hipaaAuthorization: row.hipaa_authorization ?? false,

      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      lastVerifiedDate: row.last_verified_date
    };
  },

  /**
   * Transform TypeScript interface to database record
   */
  transformToDb(data: Partial<EmergencyResponseFormData>): Record<string, unknown> {
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
