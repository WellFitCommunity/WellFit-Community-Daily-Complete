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
  /** Optional — draft composition from the discharge flow may pre-date a plan */
  discharge_plan_id?: string;
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
      // Get discharge plan — by id when supplied, else best-effort by encounter
      // (the draft-composition path can legitimately pre-date a plan).
      const PLAN_COLUMNS =
        'id, patient_id, encounter_id, discharge_disposition, planned_discharge_date, planned_discharge_time, actual_discharge_datetime, medication_reconciliation_complete, discharge_prescriptions_sent, follow_up_appointment_scheduled, follow_up_appointment_date, follow_up_appointment_provider, follow_up_appointment_location, discharge_summary_completed, discharge_summary_sent_to_pcp, patient_education_completed, patient_education_topics, patient_understands_diagnosis, patient_understands_medications, patient_understands_followup, dme_needed, dme_ordered, dme_items, home_health_needed, home_health_ordered, home_health_agency, home_health_start_date, caregiver_identified, caregiver_name, caregiver_phone, caregiver_training_completed, transportation_arranged, transportation_method, readmission_risk_score, readmission_risk_category, requires_48hr_call, requires_72hr_call, requires_7day_pcp_visit, risk_factors, post_acute_facility_id, post_acute_facility_name, post_acute_facility_phone, post_acute_bed_confirmed, post_acute_handoff_packet_id, discharge_planning_time_minutes, care_coordination_time_minutes, billing_codes_generated, status, checklist_completion_percentage, created_by, created_at, updated_at, barriers_to_discharge';

      let dischargePlan: DischargePlan | null = null;
      if (request.discharge_plan_id) {
        const { data, error: planError } = await supabase
          .from('discharge_plans')
          .select(PLAN_COLUMNS)
          .eq('id', request.discharge_plan_id)
          .single();
        if (planError || !data) {
          return { success: false, error: 'Discharge plan not found' };
        }
        dischargePlan = data as unknown as DischargePlan;
      } else {
        const { data } = await supabase
          .from('discharge_plans')
          .select(PLAN_COLUMNS)
          .eq('encounter_id', request.encounter_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        dischargePlan = (data as unknown as DischargePlan) ?? null;
      }

      // Get patient profile (live columns: no full_name/date_of_birth/facility_name —
      // compose the name; DOB column is `dob`; the sending facility comes from the
      // caller's tenant, not the patient row. Repaired 2026-07-23, P-1.)
      const { data: patient, error: patientError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, dob, mrn, gender, phone')
        .eq('user_id', request.patient_id)
        .single();

      if (patientError || !patient) {
        return {
          success: false,
          error: 'Patient profile not found',
        };
      }

      // Get encounter details (live columns — admission_date/discharge_date never
      // existed; the operational timestamps are arrived_at/visit_ended_at)
      const { data: encounter, error: encounterError } = await supabase
        .from('encounters')
        .select('id, patient_id, encounter_type, status, chief_complaint, date_of_service, arrived_at, visit_ended_at')
        .eq('id', request.encounter_id)
        .single();

      if (encounterError || !encounter) {
        return {
          success: false,
          error: 'Encounter not found',
        };
      }

      // Get the sending clinician + their tenant (the sending facility)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, tenant_id')
        .eq('user_id', user.id)
        .single();

      let sendingFacility = 'Hospital';
      if (userProfile?.tenant_id) {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name')
          .eq('id', userProfile.tenant_id)
          .single();
        if (tenant?.name) sendingFacility = tenant.name;
      }

      // Gather clinical data for transfer
      const clinicalData = await this.gatherClinicalDataForTransfer(request.patient_id, request.encounter_id, dischargePlan);

      // Create handoff packet (reusing existing handoff system)
      const patientName =
        [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Unknown Patient';
      const handoffRequest: CreateHandoffPacketRequest = {
        patient_name: patientName,
        patient_dob: patient.dob || '1970-01-01',
        patient_mrn: patient.mrn,
        patient_gender: patient.gender,

        sending_facility: sendingFacility,
        receiving_facility: request.receiving_facility_name,

        urgency_level: request.urgency_level,
        reason_for_transfer: `Post-Acute Transfer - ${this.getFacilityTypeDescription(request.post_acute_facility_type)}`,

        clinical_data: clinicalData,

        sender_provider_name:
          [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') ||
          user.email || 'Discharge Planning Team',
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
        await auditLogger.error(
          'POST_ACUTE_PACKET_FLAG_UPDATE_FAILED',
          new Error(updateError.message),
          { handoffPacketId: handoffResult.packet.id, dischargePlanId: request.discharge_plan_id }
        );
      }

      // Update discharge plan with handoff packet ID (when one exists)
      if (dischargePlan?.id) {
        await supabase
          .from('discharge_plans')
          .update({
            post_acute_handoff_packet_id: handoffResult.packet.id,
            post_acute_facility_name: request.receiving_facility_name,
            post_acute_facility_phone: request.receiving_facility_phone,
          })
          .eq('id', dischargePlan.id);
      }

      // HIPAA §164.312(b) - Log PHI access for post-acute transfer creation
      await auditLogger.phi('POST_ACUTE_TRANSFER_CREATED', request.patient_id, {
        resourceType: 'post_acute_transfer',
        action: 'CREATE',
        handoffPacketId: handoffResult.packet.id,
        dischargePlanId: dischargePlan?.id ?? null,
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
    dischargePlan: DischargePlan | null
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
      // Get medications — live table is `medications` keyed on user_id
      // (patient_medications never existed; the column is `dosage`, not `dose`)
      const { data: medications } = await supabase
        .from('medications')
        .select('id, medication_name, dosage, frequency, route, instructions')
        .eq('user_id', patientId)
        .eq('status', 'active');

      clinicalData.medications =
        medications?.map((med) => ({
          name: med.medication_name,
          dose: med.dosage,
          frequency: med.frequency,
          route: med.route,
          instructions: med.instructions,
        })) || [];

      // Get allergies — live table is `allergy_intolerances` keyed on user_id
      const { data: allergies } = await supabase
        .from('allergy_intolerances')
        .select('id, allergen_name, reaction_description, reaction_manifestation, severity, clinical_status')
        .eq('user_id', patientId)
        .eq('clinical_status', 'active');

      clinicalData.allergies =
        allergies?.map((allergy) => ({
          allergen: allergy.allergen_name,
          reaction: allergy.reaction_description ?? allergy.reaction_manifestation ?? null,
          severity: allergy.severity,
        })) || [];

      // Get latest vitals — live store is fhir_observations (category text[])
      const { data: vitals } = await supabase
        .from('fhir_observations')
        .select('id, code, code_display, value_quantity_value, value_quantity_unit, effective_datetime')
        .eq('patient_id', patientId)
        .contains('category', ['vital-signs'])
        .order('effective_datetime', { ascending: false })
        .limit(20);

      if (vitals) {
        // Group vitals by LOINC code (latest of each)
        const vitalMap = new Map();
        vitals.forEach((vital) => {
          if (!vitalMap.has(vital.code)) {
            vitalMap.set(vital.code, {
              name: vital.code_display,
              value: vital.value_quantity_value,
              unit: vital.value_quantity_unit,
              recorded: vital.effective_datetime,
            });
          }
        });

        clinicalData.vitals = Object.fromEntries(vitalMap);
      }

      // Get diagnoses — live columns are code/description/sequence
      const { data: diagnoses } = await supabase
        .from('encounter_diagnoses')
        .select('id, code, description, sequence')
        .eq('encounter_id', encounterId)
        .order('sequence', { ascending: true });

      clinicalData.diagnoses =
        diagnoses?.map((dx) => ({
          code: dx.code,
          description: dx.description,
          sequence: dx.sequence,
        })) || [];

      // Add discharge planning information (honest note when no plan exists yet)
      clinicalData.discharge_needs = !dischargePlan ? {
        note: 'No discharge plan on file at packet composition time',
      } : {
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

      // Functional status — the live ADL/mobility/cognitive source is
      // risk_assessments, read through risk_assessments_decrypted (§17 clinical
      // key). If no assessment exists, say so honestly — never fabricate values.
      const { data: functionalStatus } = await supabase
        .from('risk_assessments_decrypted')
        .select('id, mobility_risk_score, cognitive_risk_score, overall_score, risk_level, walking_ability, bathing_ability, medication_management, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      clinicalData.functional_status = functionalStatus
        ? {
            mobility_risk_score: functionalStatus.mobility_risk_score,
            cognitive_risk_score: functionalStatus.cognitive_risk_score,
            overall_score: functionalStatus.overall_score,
            risk_level: functionalStatus.risk_level,
            walking_ability: functionalStatus.walking_ability,
            bathing_ability: functionalStatus.bathing_ability,
            medication_management: functionalStatus.medication_management,
            assessment_date: functionalStatus.created_at,
          }
        : { note: 'No functional/risk assessment on file' };
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
    } catch (err: unknown) {
      // Continue with partial data — but never silently
      await auditLogger.error(
        'POST_ACUTE_CLINICAL_GATHER_PARTIAL',
        err instanceof Error ? err : new Error(String(err)),
        { patientId, encounterId }
      );
    }

    return clinicalData;
  }

  /** Bed-board discharge disposition labels → post-acute facility types (P-2) */
  static readonly DISPOSITION_FACILITY_TYPES: Record<
    string,
    PostAcuteTransferRequest['post_acute_facility_type']
  > = {
    'Skilled Nursing Facility': 'skilled_nursing',
    'Inpatient Rehab': 'inpatient_rehab',
    'Long-Term Acute Care': 'long_term_acute_care',
    'Hospice': 'hospice',
  };

  /**
   * Compose a DRAFT post-acute packet straight from the discharge flow (P-2).
   * Auto-composes the clinical sections from the chart; the clinician then
   * completes receiving-facility contact details and SENDS from the packet
   * view — a packet never leaves without contact info and a human click
   * (HandoffService only sends status='draft' packets explicitly).
   */
  static async composeDraftForDischarge(
    patientId: string,
    dispositionLabel: string
  ): Promise<PostAcuteTransferResult> {
    const facilityType = this.DISPOSITION_FACILITY_TYPES[dispositionLabel];
    if (!facilityType) {
      return { success: false, error: `Not a post-acute disposition: ${dispositionLabel}` };
    }

    // Most recent encounter for the patient (the one being discharged)
    const { data: encounter } = await supabase
      .from('encounters')
      .select('id')
      .eq('patient_id', patientId)
      .order('date_of_service', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!encounter) {
      return { success: false, error: 'No encounter found for patient' };
    }

    return this.createPostAcuteTransfer({
      patient_id: patientId,
      encounter_id: encounter.id,
      receiving_facility_name: `${this.getFacilityTypeDescription(facilityType)} — facility to be confirmed`,
      receiving_facility_phone: 'To be completed',
      post_acute_facility_type: facilityType,
      urgency_level: 'routine',
      expected_transfer_date: new Date().toISOString(),
      clinical_summary:
        'Draft auto-composed at discharge. Complete receiving-facility details and review all sections before sending.',
    });
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
      .select('id, packet_number, patient_mrn, patient_gender, sending_facility, receiving_facility, urgency_level, reason_for_transfer, clinical_data, sender_provider_name, sender_callback_number, sender_notes, status, access_token, access_expires_at, acknowledged_by, acknowledged_at, created_at, updated_at, sent_at, created_by, patient_id, encounter_id, is_post_acute_transfer, post_acute_facility_type, discharge_encounter_id')
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
    const { data: packet, error } = await supabase.from('handoff_packets').select('id, packet_number, patient_mrn, patient_gender, sending_facility, receiving_facility, urgency_level, reason_for_transfer, clinical_data, sender_provider_name, sender_callback_number, sender_notes, status, access_token, access_expires_at, acknowledged_by, acknowledged_at, created_at, updated_at, sent_at, created_by, patient_id, encounter_id, is_post_acute_transfer, post_acute_facility_type').eq('id', dischargePlan.post_acute_handoff_packet_id).single();

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
      const { data: packet } = await supabase.from('handoff_packets').select('id, packet_number, patient_mrn, sending_facility, receiving_facility, urgency_level, reason_for_transfer, clinical_data, sender_provider_name, sender_callback_number, sender_notes, status, sent_at, acknowledged_at, created_at, post_acute_facility_type').eq('id', handoffPacketId).single();

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
