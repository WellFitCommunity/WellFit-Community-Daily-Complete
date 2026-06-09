/**
 * Syndromic Surveillance — Service operations
 *
 * Persistence + lifecycle for ADT transmissions to the public health agency.
 * Extracted verbatim from syndromicSurveillanceService.ts (god-file decomposition).
 */

import { supabase } from '../../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../../_base';
import { auditLogger } from '../../auditLogger';
import type { ADTEventType } from '../../../types/hl7v2';
import type {
  SyndromicEncounter,
  SyndromicPatientData,
  SyndromicTransmission,
  FacilityData,
  EncounterRow,
  TransmissionRow,
} from './types';
import { TX_DSHS_CONFIG } from './constants';
import { generateMessageControlId, determineSurveillanceCategory } from './helpers';
import { generateADTMessage } from './adtMessage';

/**
 * Flag an encounter for syndromic surveillance
 */
export async function flagEncounterForSurveillance(
  tenantId: string,
  encounterId: string,
  encounterData: Omit<SyndromicEncounter, 'id' | 'tenantId' | 'encounterId' | 'status' | 'surveillanceCategory'>
): Promise<ServiceResult<{ id: string; surveillanceCategory: string | null }>> {
  try {
    // Determine surveillance category
    const surveillanceCategory = determineSurveillanceCategory(encounterData.diagnosisCodes);

    const { data, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .insert({
        tenant_id: tenantId,
        encounter_id: encounterId,
        patient_id: encounterData.patientId,
        encounter_date: encounterData.encounterDate.toISOString(),
        encounter_type: encounterData.encounterType,
        facility_id: encounterData.facilityId,
        chief_complaint: encounterData.chiefComplaint,
        chief_complaint_code: encounterData.chiefComplaintCode,
        chief_complaint_code_system: encounterData.chiefComplaintCodeSystem,
        diagnosis_codes: encounterData.diagnosisCodes,
        diagnosis_descriptions: encounterData.diagnosisDescriptions,
        disposition_code: encounterData.dispositionCode,
        disposition_description: encounterData.dispositionDescription,
        surveillance_category: surveillanceCategory,
        is_reportable: surveillanceCategory !== null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    await auditLogger.info('SYNDROMIC_ENCOUNTER_FLAGGED', {
      tenantId,
      encounterId,
      surveillanceCategory,
    });

    return success({ id: data.id, surveillanceCategory });
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_FLAG_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, encounterId }
    );
    return failure('OPERATION_FAILED', 'Failed to flag encounter');
  }
}

/**
 * Get pending encounters for transmission
 */
export async function getPendingEncounters(
  tenantId: string,
  limit = 100
): Promise<ServiceResult<SyndromicEncounter[]>> {
  try {
    const { data, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .select('id, tenant_id, encounter_id, patient_id, encounter_date, encounter_type, facility_id, chief_complaint, chief_complaint_code, chief_complaint_code_system, diagnosis_codes, diagnosis_descriptions, disposition_code, disposition_description, surveillance_category, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .eq('is_reportable', true)
      .order('encounter_date', { ascending: true })
      .limit(limit);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const encounters: SyndromicEncounter[] = ((data || []) as EncounterRow[]).map((row: EncounterRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      patientId: row.patient_id,
      encounterDate: new Date(row.encounter_date),
      encounterType: row.encounter_type as 'ED' | 'UC' | 'AMB',
      facilityId: row.facility_id,
      chiefComplaint: row.chief_complaint,
      chiefComplaintCode: row.chief_complaint_code,
      chiefComplaintCodeSystem: row.chief_complaint_code_system,
      diagnosisCodes: row.diagnosis_codes || [],
      diagnosisDescriptions: row.diagnosis_descriptions || [],
      dispositionCode: row.disposition_code,
      dispositionDescription: row.disposition_description,
      surveillanceCategory: row.surveillance_category,
      status: row.status as 'pending' | 'transmitted' | 'failed' | 'excluded',
    }));

    return success(encounters);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_GET_PENDING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get pending encounters');
  }
}

/**
 * Create and record a syndromic surveillance transmission
 */
export async function createTransmission(
  tenantId: string,
  encounter: SyndromicEncounter,
  patient: SyndromicPatientData,
  facility: FacilityData,
  eventType: ADTEventType = 'A04'
): Promise<ServiceResult<SyndromicTransmission>> {
  try {
    // Generate HL7 message
    const hl7Message = generateADTMessage({
      eventType,
      encounter,
      patient,
      facility,
    });

    const messageControlId = generateMessageControlId();

    // Save transmission record
    const { data, error } = await supabase
      .from('syndromic_surveillance_transmissions')
      .insert({
        tenant_id: tenantId,
        destination_agency: TX_DSHS_CONFIG.agency,
        destination_endpoint: TX_DSHS_CONFIG.endpoint,
        message_type: eventType,
        message_control_id: messageControlId,
        hl7_version: TX_DSHS_CONFIG.hl7Version,
        hl7_message: hl7Message,
        encounter_count: 1,
        encounter_ids: [encounter.id],
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Update encounter with transmission ID
    await supabase
      .from('syndromic_surveillance_encounters')
      .update({ transmission_id: data.id })
      .eq('id', encounter.id);

    await auditLogger.info('SYNDROMIC_TRANSMISSION_CREATED', {
      tenantId,
      transmissionId: data.id,
      messageControlId,
      encounterId: encounter.id,
    });

    return success({
      id: data.id,
      tenantId: data.tenant_id,
      destinationAgency: data.destination_agency,
      messageType: eventType,
      messageControlId: data.message_control_id,
      hl7Message: data.hl7_message,
      encounterCount: 1,
      encounterIds: [encounter.id],
      status: 'pending',
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_TRANSMISSION_CREATE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, encounterId: encounter.id }
    );
    return failure('OPERATION_FAILED', 'Failed to create transmission');
  }
}

/**
 * Record transmission result (acknowledgment)
 */
export async function recordTransmissionResult(
  transmissionId: string,
  result: {
    success: boolean;
    acknowledgmentCode?: string;
    acknowledgmentMessage?: string;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<ServiceResult<void>> {
  try {
    const status = result.success ? 'acknowledged' : 'rejected';

    const { error } = await supabase
      .from('syndromic_surveillance_transmissions')
      .update({
        status,
        sent_at: new Date().toISOString(),
        acknowledgment_received_at: new Date().toISOString(),
        acknowledgment_code: result.acknowledgmentCode,
        acknowledgment_message: result.acknowledgmentMessage,
        error_code: result.errorCode,
        error_message: result.errorMessage,
      })
      .eq('id', transmissionId);

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    // Update associated encounters
    const { data: transmission } = await supabase
      .from('syndromic_surveillance_transmissions')
      .select('encounter_ids')
      .eq('id', transmissionId)
      .single();

    if (transmission?.encounter_ids) {
      await supabase
        .from('syndromic_surveillance_encounters')
        .update({ status: result.success ? 'transmitted' : 'failed' })
        .in('id', transmission.encounter_ids);
    }

    await auditLogger.info('SYNDROMIC_TRANSMISSION_RESULT', {
      transmissionId,
      status,
      acknowledgmentCode: result.acknowledgmentCode,
    });

    return success(undefined);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_RECORD_RESULT_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { transmissionId }
    );
    return failure('OPERATION_FAILED', 'Failed to record transmission result');
  }
}

/**
 * Get transmission history
 */
export async function getTransmissionHistory(
  tenantId: string,
  options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<ServiceResult<SyndromicTransmission[]>> {
  try {
    let query = supabase
      .from('syndromic_surveillance_transmissions')
      .select('id, tenant_id, destination_agency, message_type, message_control_id, hl7_message, encounter_count, encounter_ids, status, sent_at, acknowledgment_code, acknowledgment_message, error_message')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate.toISOString());
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const transmissions: SyndromicTransmission[] = ((data || []) as TransmissionRow[]).map((row: TransmissionRow) => ({
      id: row.id,
      tenantId: row.tenant_id,
      destinationAgency: row.destination_agency,
      messageType: row.message_type as ADTEventType,
      messageControlId: row.message_control_id,
      hl7Message: row.hl7_message,
      encounterCount: row.encounter_count,
      encounterIds: row.encounter_ids,
      status: row.status as SyndromicTransmission['status'],
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      acknowledgmentCode: row.acknowledgment_code,
      acknowledgmentMessage: row.acknowledgment_message,
      errorMessage: row.error_message,
    }));

    return success(transmissions);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_GET_HISTORY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get transmission history');
  }
}

/**
 * Get surveillance statistics
 */
export async function getSurveillanceStats(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<ServiceResult<{
  totalEncounters: number;
  reportableEncounters: number;
  transmittedCount: number;
  failedCount: number;
  pendingCount: number;
  byCategory: Record<string, number>;
}>> {
  try {
    const { data: encounters, error } = await supabase
      .from('syndromic_surveillance_encounters')
      .select('status, surveillance_category, is_reportable')
      .eq('tenant_id', tenantId)
      .gte('encounter_date', startDate.toISOString())
      .lte('encounter_date', endDate.toISOString());

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    interface EncounterStats {
      status: string;
      surveillance_category?: string;
      is_reportable: boolean;
    }

    const stats = {
      totalEncounters: encounters?.length || 0,
      reportableEncounters: encounters?.filter((e: EncounterStats) => e.is_reportable).length || 0,
      transmittedCount: encounters?.filter((e: EncounterStats) => e.status === 'transmitted').length || 0,
      failedCount: encounters?.filter((e: EncounterStats) => e.status === 'failed').length || 0,
      pendingCount: encounters?.filter((e: EncounterStats) => e.status === 'pending').length || 0,
      byCategory: {} as Record<string, number>,
    };

    // Count by category
    encounters?.forEach((e: EncounterStats) => {
      if (e.surveillance_category) {
        stats.byCategory[e.surveillance_category] = (stats.byCategory[e.surveillance_category] || 0) + 1;
      }
    });

    return success(stats);
  } catch (err: unknown) {
    await auditLogger.error(
      'SYNDROMIC_STATS_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to get surveillance stats');
  }
}
