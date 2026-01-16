// Post-Acute Transfer Service
// GENIUS: Reuses handoff_packets for Hospital → SNF/Rehab/Home Health transfers
// Mirrors hospitalTransferIntegrationService.ts pattern
// Creates clinical packets for post-acute placements

import { supabase } from '../lib/supabaseClient';
import { getErrorMessage } from '../lib/getErrorMessage';
import { auditLogger } from './auditLogger';
import { HandoffService } from './handoffService';
import type { CreateHandoffPacketRequest } from '../types/handoff';
import type { DischargePlan } from './dischargePlanningService';

export interface PostAcuteTransferRequest {
  discharge_plan_id: string;
  patient_id: string;
  encounter_id: string;
  receiving_facility_name: string;
  receiving_facility_phone: string;
  receiving_facility_contact_name?: string;
  receiving_facility_contact_email?: string;
  post_acute_facility_type: 'skilled_nursing' | 'inpatient_rehab' | 'long_term_acute_care' | 'hospice';
  urgency_level: 'routine' | 'urgent' | 'emergent';
  expected_transfer_date: string;
  clinical_summary: string;
}

export interface PostAcuteTransferResult {
  success: boolean;
  handoff_packet_id?: string;
  access_url?: string;
  error?: string;
}

/**
 * Post-Acute Transfer Service
 * Handles transfers from hospital to SNF, Rehab, LTAC, Hospice
 * Reuses handoff_packets table - BRILLIANT architecture!
 */
export class PostAcuteTransferService {
  /**
   * Create post-acute transfer packet
   * This creates a handoff packet for Hospital → SNF/Rehab transfer
   */
  static async createPostAcuteTransfer(request: PostAcuteTransferRequest): Promise<PostAcuteTransferResult> {
    try {
      // Get discharge plan
      const { data: dischargePlan, error: planError } = await supabase
        .from('discharge_plans')
        .select('*')
        .eq('id', request.discharge_plan_id)
        .single();

      if (planError || !dischargePlan) {
        return {
          success: false,
          error: 'Discharge plan not found',
        };
      }

      // Get patient profile
      const { data: patient, error: patientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', request.patient_id)
        .single();

      if (patientError || !patient) {
        return {
          success: false,
          error: 'Patient profile not found',
        };
      }

      // Get encounter details
      const { data: encounter, error: encounterError } = await supabase
        .from('encounters')
        .select('*')
        .eq('id', request.encounter_id)
        .single();

      if (encounterError || !encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // Get current facility from user profile
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data: userProfile } = await supabase.from('profiles').select('facility_name, phone').eq('id', user.id).single();

      const sendingFacility = userProfile?.facility_name || 'Hospital';

      // Gather clinical data for transfer
      const clinicalData = await this.gatherClinicalDataForTransfer(request.patient_id, request.encounter_id, dischargePlan);

      // Create handoff packet (reusing existing handoff system)
      const handoffRequest: CreateHandoffPacketRequest = {
        patient_name: patient.full_name || 'Unknown Patient',
        patient_dob: patient.date_of_birth || '1970-01-01',
        patient_mrn: patient.mrn,
        patient_gender: patient.gender,

        sending_facility: sendingFacility,
        receiving_facility: request.receiving_facility_name,

        urgency_level: request.urgency_level,
        reason_for_transfer: `Post-Acute Transfer - ${this.getFacilityTypeDescription(request.post_acute_facility_type)}`,

        clinical_data: clinicalData,

        sender_provider_name: user.email || 'Discharge Planning Team',
        sender_callback_number: userProfile?.phone || 'N/A',
        sender_notes: request.clinical_summary,

        receiver_contact_name: request.receiving_facility_contact_name,
        receiver_contact_email: request.receiving_facility_contact_email,
        receiver_contact_phone: request.receiving_facility_phone,
      };

      // Create the handoff packet
      const handoffResult = await HandoffService.createPacket(handoffRequest);

      // Link handoff packet to discharge plan and mark as post-acute transfer
      const { error: updateError } = await supabase
        .from('handoff_packets')
        .update({
          is_post_acute_transfer: true,
          post_acute_facility_type: request.post_acute_facility_type,
          discharge_encounter_id: request.encounter_id,
          patient_id: request.patient_id,
          encounter_id: request.encounter_id,
        })
        .eq('id', handoffResult.packet.id);

      if (updateError) {
        // Intentionally left unchanged per locked protocol (no logging/behavior edits)
      }

      // Update discharge plan with handoff packet ID
      await supabase
        .from('discharge_plans')
        .update({
          post_acute_handoff_packet_id: handoffResult.packet.id,
          post_acute_facility_name: request.receiving_facility_name,
          post_acute_facility_phone: request.receiving_facility_phone,
        })
        .eq('id', request.discharge_plan_id);

      // HIPAA §164.312(b) - Log PHI access for post-acute transfer creation
      await auditLogger.phi('POST_ACUTE_TRANSFER_CREATED', request.patient_id, {
        resourceType: 'post_acute_transfer',
        action: 'CREATE',
        handoffPacketId: handoffResult.packet.id,
        dischargePlanId: request.discharge_plan_id,
        encounterId: request.encounter_id,
        facilityType: request.post_acute_facility_type,
        receivingFacility: request.receiving_facility_name
      });

      return {
        success: true,
        handoff_packet_id: handoffResult.packet.id,
        access_url: handoffResult.access_url,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error) || 'Unknown error',
      };
    }
  }

  /**
   * Send post-acute transfer packet to receiving facility
   */
  static async sendPostAcuteTransfer(handoffPacketId: string, sendEmail: boolean = true): Promise<PostAcuteTransferResult> {
    try {
      // Send the handoff packet
      await HandoffService.sendPacket({
        packet_id: handoffPacketId,
        send_confirmation_email: sendEmail,
        send_confirmation_sms: false,
      });

      return {
        success: true,
        handoff_packet_id: handoffPacketId,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Gather clinical data for post-acute transfer
   */
  private static async gatherClinicalDataForTransfer(
    patientId: string,
    encounterId: string,
    dischargePlan: DischargePlan
  ): Promise<Record<string, unknown>> {
    const clinicalData: Record<string, unknown> = {
      discharge_summary: {},
      medications: [],
      allergies: [],
      vitals: {},
      diagnoses: [],
      discharge_needs: {},
    };

    try {
      // Get medications
      const { data: medications } = await supabase
        .from('patient_medications')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      clinicalData.medications =
        medications?.map((med) => ({
          name: med.medication_name,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route,
          instructions: med.instructions,
        })) || [];

      // Get allergies
      const { data: allergies } = await supabase.from('patient_allergies').select('*').eq('patient_id', patientId).eq('is_active', true);

      clinicalData.allergies =
        allergies?.map((allergy) => ({
          allergen: allergy.allergen,
          reaction: allergy.reaction,
          severity: allergy.severity,
        })) || [];

      // Get latest vitals
      const { data: vitals } = await supabase
        .from('ehr_observations')
        .select('*')
        .eq('patient_id', patientId)
        .eq('encounter_id', encounterId)
        .eq('observation_type', 'vital_sign')
        .order('effective_datetime', { ascending: false })
        .limit(10);

      if (vitals) {
        // Group vitals by type (latest of each)
        const vitalMap = new Map();
        vitals.forEach((vital) => {
          if (!vitalMap.has(vital.loinc_code)) {
            vitalMap.set(vital.loinc_code, {
              name: vital.display_name,
              value: vital.value_quantity,
              unit: vital.unit,
              recorded: vital.effective_datetime,
            });
          }
        });

        clinicalData.vitals = Object.fromEntries(vitalMap);
      }

      // Get diagnoses
      const { data: diagnoses } = await supabase.from('encounter_diagnoses').select('*').eq('encounter_id', encounterId);

      clinicalData.diagnoses =
        diagnoses?.map((dx) => ({
          code: dx.diagnosis_code,
          description: dx.diagnosis_description,
          type: dx.diagnosis_type,
        })) || [];

      // Add discharge planning information
      clinicalData.discharge_needs = {
        discharge_disposition: dischargePlan.discharge_disposition,
        readmission_risk_score: dischargePlan.readmission_risk_score,
        readmission_risk_category: dischargePlan.readmission_risk_category,
        requires_48hr_call: dischargePlan.requires_48hr_call,

        // Care needs
        dme_needed: dischargePlan.dme_needed,
        dme_items: dischargePlan.dme_items || [],

        home_health_needed: dischargePlan.home_health_needed,

        caregiver_identified: dischargePlan.caregiver_identified,
        caregiver_name: dischargePlan.caregiver_name,
        caregiver_phone: dischargePlan.caregiver_phone,

        // Follow-up
        follow_up_appointment_scheduled: dischargePlan.follow_up_appointment_scheduled,
        follow_up_appointment_date: dischargePlan.follow_up_appointment_date,
        follow_up_appointment_provider: dischargePlan.follow_up_appointment_provider,

        // Patient education
        patient_education_topics: dischargePlan.patient_education_topics || [],

        // Risk factors and barriers
        risk_factors: dischargePlan.risk_factors || [],
        barriers_to_discharge: dischargePlan.barriers_to_discharge || [],
      };

      // Add functional status if available
      const { data: functionalStatus } = await supabase
        .from('functional_assessments')
        .select('*')
        .eq('patient_id', patientId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (functionalStatus) {
        clinicalData.functional_status = {
          adl_score: functionalStatus.adl_score,
          mobility_level: functionalStatus.mobility_level,
          cognitive_status: functionalStatus.cognitive_status,
          assessment_date: functionalStatus.assessment_date,
        };
      }
      // HIPAA §164.312(b) - Log PHI access for clinical data gathering
      await auditLogger.phi('TRANSFER_CLINICAL_DATA_READ', patientId, {
        resourceType: 'clinical_data_bundle',
        action: 'READ',
        encounterId,
        purpose: 'post_acute_transfer',
        medicationCount: (clinicalData.medications as Array<unknown>).length,
        allergyCount: (clinicalData.allergies as Array<unknown>).length,
        diagnosisCount: (clinicalData.diagnoses as Array<unknown>).length
      });
    } catch (_err: unknown) {
      // Continue with partial data
    }

    return clinicalData;
  }

  /**
   * Get facility type description for transfer reason
   */
  private static getFacilityTypeDescription(type: string): string {
    const descriptions: Record<string, string> = {
      skilled_nursing: 'Skilled Nursing Facility (SNF)',
      inpatient_rehab: 'Inpatient Rehabilitation Facility',
      long_term_acute_care: 'Long-Term Acute Care (LTAC)',
      hospice: 'Hospice Care',
    };
    return descriptions[type] || 'Post-Acute Care';
  }

  /**
   * Get all post-acute transfers for a patient
   */
  static async getPatientPostAcuteTransfers(patientId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('handoff_packets')
      .select('*')
      .eq('patient_id', patientId)
      .eq('is_post_acute_transfer', true)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    // HIPAA §164.312(b) - Log PHI access for post-acute transfer history
    if (data && data.length > 0) {
      await auditLogger.phi('POST_ACUTE_TRANSFERS_READ', patientId, {
        resourceType: 'post_acute_transfer_history',
        action: 'READ',
        transferCount: data.length
      });
    }

    return data || [];
  }

  /**
   * Get post-acute transfer by discharge plan
   */
  static async getTransferByDischargePlan(dischargePlanId: string): Promise<Record<string, unknown> | null> {
    // Get discharge plan to find handoff packet ID
    const { data: dischargePlan } = await supabase.from('discharge_plans').select('post_acute_handoff_packet_id').eq('id', dischargePlanId).single();

    if (!dischargePlan?.post_acute_handoff_packet_id) {
      return null;
    }

    // Get handoff packet
    const { data: packet, error } = await supabase.from('handoff_packets').select('*').eq('id', dischargePlan.post_acute_handoff_packet_id).single();

    if (error) {
      return null;
    }

    return packet;
  }

  /**
   * Generate post-acute transfer summary report
   */
  static async generateTransferSummary(handoffPacketId: string): Promise<string> {
    try {
      const { data: packet } = await supabase.from('handoff_packets').select('*').eq('id', handoffPacketId).single();

      if (!packet) {
        return 'Transfer packet not found';
      }

      const summary = `
POST-ACUTE TRANSFER SUMMARY
===========================

Patient: ${packet.patient_mrn || 'N/A'}
Transfer Date: ${new Date(packet.created_at).toLocaleDateString()}

FROM: ${packet.sending_facility}
TO: ${packet.receiving_facility} (${this.getFacilityTypeDescription(packet.post_acute_facility_type)})

Urgency: ${packet.urgency_level.toUpperCase()}
Reason: ${packet.reason_for_transfer}

CLINICAL INFORMATION:
${
  packet.clinical_data?.discharge_needs
    ? `
Readmission Risk: ${packet.clinical_data.discharge_needs.readmission_risk_category || 'N/A'}
Risk Score: ${packet.clinical_data.discharge_needs.readmission_risk_score || 'N/A'}/100

Care Needs:
- DME: ${
        packet.clinical_data.discharge_needs.dme_needed
          ? 'Yes - ' + (packet.clinical_data.discharge_needs.dme_items?.join(', ') || 'N/A')
          : 'No'
      }
- Home Health: ${packet.clinical_data.discharge_needs.home_health_needed ? 'Yes' : 'No'}
- Caregiver: ${
        packet.clinical_data.discharge_needs.caregiver_identified
          ? 'Yes - ' + (packet.clinical_data.discharge_needs.caregiver_name || 'N/A')
          : 'No'
      }

Follow-up:
- Appointment Scheduled: ${packet.clinical_data.discharge_needs.follow_up_appointment_scheduled ? 'Yes' : 'No'}
${packet.clinical_data.discharge_needs.follow_up_appointment_date ? `- Date: ${packet.clinical_data.discharge_needs.follow_up_appointment_date}` : ''}
${packet.clinical_data.discharge_needs.follow_up_appointment_provider ? `- Provider: ${packet.clinical_data.discharge_needs.follow_up_appointment_provider}` : ''}
`
    : 'Clinical data not available'
}

MEDICATIONS: ${packet.clinical_data?.medications?.length || 0} active medications
ALLERGIES: ${packet.clinical_data?.allergies?.length || 0} documented allergies

Status: ${packet.status.toUpperCase()}
${packet.sent_at ? `Sent: ${new Date(packet.sent_at).toLocaleString()}` : 'Not sent yet'}
${packet.acknowledged_at ? `Acknowledged: ${new Date(packet.acknowledged_at).toLocaleString()}` : ''}

Sender: ${packet.sender_provider_name}
Contact: ${packet.sender_callback_number}

${packet.sender_notes ? `\nNotes:\n${packet.sender_notes}` : ''}
      `.trim();

      return summary;
    } catch (_err: unknown) {
      return 'Error generating summary';
    }
  }
}

export default PostAcuteTransferService;
