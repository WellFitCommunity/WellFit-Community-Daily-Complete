/**
 * Prescription Drug Monitoring Program (PDMP) Service
 *
 * ONC Criteria: 170.315(b)(3) - Electronic Prescribing
 * State Compliance: Texas PMP, PMP InterConnect
 *
 * This service handles PDMP queries for controlled substance prescribing:
 * - Query state PDMP databases for patient prescription history
 * - Detect potential abuse patterns (doctor shopping, pharmacy shopping)
 * - Track query history for compliance
 * - Calculate morphine milligram equivalents (MME)
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

// =====================================================
// TYPES
// =====================================================

export type QueryType = 'patient_history' | 'prescription_verification' | 'dispenser_check';

export type ResponseStatus = 'pending' | 'success' | 'error' | 'timeout' | 'no_records';

export interface PDMPQuery {
  id: string;
  tenantId: string;
  queryTimestamp: Date;
  queryType: QueryType;
  providerId: string;
  providerNpi: string;
  providerDea?: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientDob: Date;
  pdmpState: string;
  pdmpSystemName?: string;
  responseStatus: ResponseStatus;
  responseReceivedAt?: Date;
  prescriptionsFound?: number;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  flags: PDMPFlags;
  morphineMilligramEquivalent?: number;
  overlappingPrescriptions?: number;
  uniquePrescribers?: number;
  uniquePharmacies?: number;
  prescriptionId?: string;
  createdAt: Date;
}

export interface PDMPFlags {
  doctorShopping: boolean;
  pharmacyShopping: boolean;
  earlyRefill: boolean;
  highMme: boolean;
  overlappingControlled: boolean;
}

export interface PDMPPrescriptionHistory {
  id: string;
  pdmpQueryId: string;
  medicationName: string;
  medicationNdc?: string;
  deaSchedule?: number;
  quantity?: number;
  daysSupply?: number;
  refillsAuthorized?: number;
  writtenDate?: Date;
  filledDate: Date;
  prescriberName?: string;
  prescriberNpi?: string;
  prescriberDea?: string;
  pharmacyName?: string;
  pharmacyNpi?: string;
  pharmacyNcpdp?: string;
  pharmacyAddress?: string;
  morphineMilligramEquivalent?: number;
  overlapsWithOther: boolean;
  earlyRefill: boolean;
}

export interface PDMPQueryInput {
  providerId: string;
  providerNpi: string;
  providerDea?: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  patientDob: Date;
  state: string;
  queryType?: QueryType;
  prescriptionId?: string;
  dateRangeMonths?: number;
}

export interface StateConfig {
  stateCode: string;
  stateName: string;
  pdmpSystemName: string;
  pdmpApiEndpoint?: string;
  pdmpWebPortalUrl?: string;
  mandatoryQuery: boolean;
  queryTimeframeHours: number;
  schedulesCovered: number[];
  pmpInterconnectEnabled: boolean;
  nabpPmphubEnabled: boolean;
  isActive: boolean;
  notes?: string;
}

// Database row types
interface PDMPQueryRow {
  id: string;
  tenant_id: string;
  query_timestamp: string;
  query_type: string;
  provider_id: string;
  provider_npi: string;
  provider_dea?: string;
  patient_id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string;
  pdmp_state: string;
  pdmp_system_name?: string;
  response_status: string;
  response_received_at?: string;
  prescriptions_found?: number;
  date_range_start?: string;
  date_range_end?: string;
  flags: Record<string, boolean>;
  morphine_milligram_equivalent?: number;
  overlapping_prescriptions?: number;
  unique_prescribers?: number;
  unique_pharmacies?: number;
  prescription_id?: string;
  created_at: string;
}

interface PDMPHistoryRow {
  id: string;
  pdmp_query_id: string;
  medication_name: string;
  medication_ndc?: string;
  dea_schedule?: number;
  quantity?: number;
  days_supply?: number;
  refills_authorized?: number;
  written_date?: string;
  filled_date: string;
  prescriber_name?: string;
  prescriber_npi?: string;
  prescriber_dea?: string;
  pharmacy_name?: string;
  pharmacy_npi?: string;
  pharmacy_ncpdp?: string;
  pharmacy_address?: string;
  morphine_milligram_equivalent?: number;
  overlaps_with_other: boolean;
  early_refill: boolean;
}

interface StateConfigRow {
  state_code: string;
  state_name: string;
  pdmp_system_name: string;
  pdmp_api_endpoint?: string;
  pdmp_web_portal_url?: string;
  mandatory_query: boolean;
  query_timeframe_hours: number;
  schedules_covered: number[];
  pmp_interconnect_enabled: boolean;
  nabp_pmphub_enabled: boolean;
  is_active: boolean;
  notes?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

// MME conversion factors (per CDC guidelines)
const MME_CONVERSION_FACTORS: Record<string, number> = {
  // Opioid name -> MME per mg
  'codeine': 0.15,
  'fentanyl transdermal': 2.4, // per mcg/hr
  'hydrocodone': 1,
  'hydromorphone': 4,
  'methadone 1-20mg': 4,
  'methadone 21-40mg': 8,
  'methadone 41-60mg': 10,
  'methadone >60mg': 12,
  'morphine': 1,
  'oxycodone': 1.5,
  'oxymorphone': 3,
  'tapentadol': 0.4,
  'tramadol': 0.1,
};

// High MME threshold (CDC guidelines: ≥90 MME/day is high risk)
const HIGH_MME_THRESHOLD = 90;

// Multiple prescriber/pharmacy thresholds
const DOCTOR_SHOPPING_THRESHOLD = 4; // 4+ prescribers in 90 days
const PHARMACY_SHOPPING_THRESHOLD = 4; // 4+ pharmacies in 90 days

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function mapPDMPQuery(row: PDMPQueryRow): PDMPQuery {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    queryTimestamp: new Date(row.query_timestamp),
    queryType: row.query_type as QueryType,
    providerId: row.provider_id,
    providerNpi: row.provider_npi,
    providerDea: row.provider_dea,
    patientId: row.patient_id,
    patientFirstName: row.patient_first_name,
    patientLastName: row.patient_last_name,
    patientDob: new Date(row.patient_dob),
    pdmpState: row.pdmp_state,
    pdmpSystemName: row.pdmp_system_name,
    responseStatus: row.response_status as ResponseStatus,
    responseReceivedAt: row.response_received_at ? new Date(row.response_received_at) : undefined,
    prescriptionsFound: row.prescriptions_found,
    dateRangeStart: row.date_range_start ? new Date(row.date_range_start) : undefined,
    dateRangeEnd: row.date_range_end ? new Date(row.date_range_end) : undefined,
    flags: {
      doctorShopping: row.flags?.doctor_shopping ?? false,
      pharmacyShopping: row.flags?.pharmacy_shopping ?? false,
      earlyRefill: row.flags?.early_refill ?? false,
      highMme: row.flags?.high_mme ?? false,
      overlappingControlled: row.flags?.overlapping_controlled ?? false,
    },
    morphineMilligramEquivalent: row.morphine_milligram_equivalent,
    overlappingPrescriptions: row.overlapping_prescriptions,
    uniquePrescribers: row.unique_prescribers,
    uniquePharmacies: row.unique_pharmacies,
    prescriptionId: row.prescription_id,
    createdAt: new Date(row.created_at),
  };
}

function mapPDMPHistory(row: PDMPHistoryRow): PDMPPrescriptionHistory {
  return {
    id: row.id,
    pdmpQueryId: row.pdmp_query_id,
    medicationName: row.medication_name,
    medicationNdc: row.medication_ndc,
    deaSchedule: row.dea_schedule,
    quantity: row.quantity,
    daysSupply: row.days_supply,
    refillsAuthorized: row.refills_authorized,
    writtenDate: row.written_date ? new Date(row.written_date) : undefined,
    filledDate: new Date(row.filled_date),
    prescriberName: row.prescriber_name,
    prescriberNpi: row.prescriber_npi,
    prescriberDea: row.prescriber_dea,
    pharmacyName: row.pharmacy_name,
    pharmacyNpi: row.pharmacy_npi,
    pharmacyNcpdp: row.pharmacy_ncpdp,
    pharmacyAddress: row.pharmacy_address,
    morphineMilligramEquivalent: row.morphine_milligram_equivalent,
    overlapsWithOther: row.overlaps_with_other,
    earlyRefill: row.early_refill,
  };
}

function mapStateConfig(row: StateConfigRow): StateConfig {
  return {
    stateCode: row.state_code,
    stateName: row.state_name,
    pdmpSystemName: row.pdmp_system_name,
    pdmpApiEndpoint: row.pdmp_api_endpoint,
    pdmpWebPortalUrl: row.pdmp_web_portal_url,
    mandatoryQuery: row.mandatory_query,
    queryTimeframeHours: row.query_timeframe_hours,
    schedulesCovered: row.schedules_covered,
    pmpInterconnectEnabled: row.pmp_interconnect_enabled,
    nabpPmphubEnabled: row.nabp_pmphub_enabled,
    isActive: row.is_active,
    notes: row.notes,
  };
}

/**
 * Calculate MME for a medication
 */
function calculateMME(
  medicationName: string,
  dailyDose: number
): number | null {
  const normalizedName = medicationName.toLowerCase();

  for (const [drug, factor] of Object.entries(MME_CONVERSION_FACTORS)) {
    if (normalizedName.includes(drug.toLowerCase())) {
      return dailyDose * factor;
    }
  }

  return null;
}

/**
 * Check for date overlaps between prescriptions
 */
function checkDateOverlap(
  fillDate1: Date,
  daysSupply1: number,
  fillDate2: Date,
  daysSupply2: number
): boolean {
  const end1 = new Date(fillDate1);
  end1.setDate(end1.getDate() + daysSupply1);

  const end2 = new Date(fillDate2);
  end2.setDate(end2.getDate() + daysSupply2);

  // Check if ranges overlap
  return fillDate1 < end2 && fillDate2 < end1;
}

/**
 * Analyze prescription history for risk flags
 */
function analyzeRiskFlags(
  prescriptions: PDMPPrescriptionHistory[]
): {
  flags: PDMPFlags;
  mme: number;
  overlapping: number;
  uniquePrescribers: number;
  uniquePharmacies: number;
} {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Filter to last 90 days for risk analysis
  const recentRx = prescriptions.filter(
    (rx) => new Date(rx.filledDate) >= ninetyDaysAgo
  );

  // Count unique prescribers and pharmacies
  const prescribers = new Set(recentRx.map((rx) => rx.prescriberNpi).filter(Boolean));
  const pharmacies = new Set(recentRx.map((rx) => rx.pharmacyNpi).filter(Boolean));

  // Calculate total daily MME
  let totalMme = 0;
  for (const rx of recentRx) {
    if (rx.morphineMilligramEquivalent && rx.daysSupply) {
      // Daily MME = total MME / days supply
      totalMme += rx.morphineMilligramEquivalent / rx.daysSupply;
    }
  }

  // Check for overlapping prescriptions
  let overlapping = 0;
  for (let i = 0; i < recentRx.length; i++) {
    for (let j = i + 1; j < recentRx.length; j++) {
      const daysSupplyI = recentRx[i].daysSupply;
      const daysSupplyJ = recentRx[j].daysSupply;
      if (
        daysSupplyI !== undefined &&
        daysSupplyJ !== undefined &&
        checkDateOverlap(
          new Date(recentRx[i].filledDate),
          daysSupplyI,
          new Date(recentRx[j].filledDate),
          daysSupplyJ
        )
      ) {
        overlapping++;
      }
    }
  }

  // Check for early refills (filled more than 7 days early)
  let hasEarlyRefill = false;
  for (const rx of recentRx) {
    if (rx.earlyRefill) {
      hasEarlyRefill = true;
      break;
    }
  }

  const flags: PDMPFlags = {
    doctorShopping: prescribers.size >= DOCTOR_SHOPPING_THRESHOLD,
    pharmacyShopping: pharmacies.size >= PHARMACY_SHOPPING_THRESHOLD,
    earlyRefill: hasEarlyRefill,
    highMme: totalMme >= HIGH_MME_THRESHOLD,
    overlappingControlled: overlapping > 0,
  };

  return {
    flags,
    mme: Math.round(totalMme * 100) / 100,
    overlapping,
    uniquePrescribers: prescribers.size,
    uniquePharmacies: pharmacies.size,
  };
}

// =====================================================
// STATE CONFIGURATION
// =====================================================

/**
 * Get state PDMP configuration
 */
export async function getStateConfig(stateCode: string): Promise<ServiceResult<StateConfig | null>> {
  try {
    const { data, error } = await supabase
      .from('pdmp_state_config')
      .select('*')
      .eq('state_code', stateCode.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data ? mapStateConfig(data) : null);
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_STATE_CONFIG_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { stateCode }
    );
    return failure('FETCH_FAILED', 'Failed to fetch state configuration');
  }
}

/**
 * Get all active state configurations
 */
export async function getActiveStateConfigs(): Promise<ServiceResult<StateConfig[]>> {
  try {
    const { data, error } = await supabase
      .from('pdmp_state_config')
      .select('*')
      .eq('is_active', true)
      .order('state_code');

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success((data || []).map(mapStateConfig));
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_STATE_CONFIGS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err))
    );
    return failure('FETCH_FAILED', 'Failed to fetch state configurations');
  }
}

/**
 * Check if PDMP query is required for a given state and schedule
 */
export async function isPDMPQueryRequired(
  stateCode: string,
  deaSchedule: number
): Promise<ServiceResult<{ required: boolean; timeframeHours: number }>> {
  try {
    const configResult = await getStateConfig(stateCode);
    if (!configResult.success) {
      return failure(configResult.error?.code || 'FETCH_FAILED', configResult.error?.message || 'Failed to get state config');
    }

    if (!configResult.data) {
      return success({ required: false, timeframeHours: 0 });
    }

    const config = configResult.data;
    const required = config.mandatoryQuery && config.schedulesCovered.includes(deaSchedule);

    return success({
      required,
      timeframeHours: config.queryTimeframeHours,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_REQUIREMENT_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { stateCode, deaSchedule }
    );
    return failure('OPERATION_FAILED', 'Failed to check PDMP requirement');
  }
}

// =====================================================
// PDMP QUERIES
// =====================================================

/**
 * Query the PDMP for a patient's prescription history
 */
export async function queryPDMP(
  tenantId: string,
  input: PDMPQueryInput
): Promise<ServiceResult<PDMPQuery>> {
  try {
    // Get state configuration
    const configResult = await getStateConfig(input.state);
    if (!configResult.success) {
      return failure(configResult.error?.code || 'FETCH_FAILED', configResult.error?.message || 'Failed to get state config');
    }

    if (!configResult.data || !configResult.data.isActive) {
      return failure('NOT_FOUND', `PDMP not configured for state: ${input.state}`);
    }

    const stateConfig = configResult.data;

    // Calculate date range
    const dateRangeMonths = input.dateRangeMonths || 12;
    const dateRangeStart = new Date();
    dateRangeStart.setMonth(dateRangeStart.getMonth() - dateRangeMonths);
    const dateRangeEnd = new Date();

    // Create query record
    const { data: queryRecord, error: insertError } = await supabase
      .from('pdmp_queries')
      .insert({
        tenant_id: tenantId,
        query_type: input.queryType || 'patient_history',
        provider_id: input.providerId,
        provider_npi: input.providerNpi,
        provider_dea: input.providerDea,
        patient_id: input.patientId,
        patient_first_name: input.patientFirstName,
        patient_last_name: input.patientLastName,
        patient_dob: input.patientDob.toISOString().split('T')[0],
        pdmp_state: input.state.toUpperCase(),
        pdmp_system_name: stateConfig.pdmpSystemName,
        response_status: 'pending',
        date_range_start: dateRangeStart.toISOString().split('T')[0],
        date_range_end: dateRangeEnd.toISOString().split('T')[0],
        prescription_id: input.prescriptionId,
        flags: {},
      })
      .select()
      .single();

    if (insertError) {
      return failure('DATABASE_ERROR', insertError.message);
    }

    await auditLogger.info('PDMP_QUERY_INITIATED', {
      tenantId,
      queryId: queryRecord.id,
      patientId: input.patientId,
      state: input.state,
    });

    // In production, this would call the actual PDMP API
    // For now, simulate a successful query with mock data
    const pdmpResponse = await simulatePDMPQuery(queryRecord.id, input);

    // Update query with response
    const { data: updatedQuery, error: updateError } = await supabase
      .from('pdmp_queries')
      .update({
        response_status: pdmpResponse.status,
        response_received_at: new Date().toISOString(),
        prescriptions_found: pdmpResponse.prescriptions.length,
        flags: {
          doctor_shopping: pdmpResponse.flags.doctorShopping,
          pharmacy_shopping: pdmpResponse.flags.pharmacyShopping,
          early_refill: pdmpResponse.flags.earlyRefill,
          high_mme: pdmpResponse.flags.highMme,
          overlapping_controlled: pdmpResponse.flags.overlappingControlled,
        },
        morphine_milligram_equivalent: pdmpResponse.mme,
        overlapping_prescriptions: pdmpResponse.overlapping,
        unique_prescribers: pdmpResponse.uniquePrescribers,
        unique_pharmacies: pdmpResponse.uniquePharmacies,
      })
      .eq('id', queryRecord.id)
      .select()
      .single();

    if (updateError) {
      return failure('DATABASE_ERROR', updateError.message);
    }

    // Store prescription history
    if (pdmpResponse.prescriptions.length > 0) {
      const historyRecords = pdmpResponse.prescriptions.map((rx) => ({
        pdmp_query_id: queryRecord.id,
        medication_name: rx.medicationName,
        medication_ndc: rx.medicationNdc,
        dea_schedule: rx.deaSchedule,
        quantity: rx.quantity,
        days_supply: rx.daysSupply,
        refills_authorized: rx.refillsAuthorized,
        written_date: rx.writtenDate?.toISOString().split('T')[0],
        filled_date: rx.filledDate.toISOString().split('T')[0],
        prescriber_name: rx.prescriberName,
        prescriber_npi: rx.prescriberNpi,
        prescriber_dea: rx.prescriberDea,
        pharmacy_name: rx.pharmacyName,
        pharmacy_npi: rx.pharmacyNpi,
        pharmacy_ncpdp: rx.pharmacyNcpdp,
        pharmacy_address: rx.pharmacyAddress,
        morphine_milligram_equivalent: rx.morphineMilligramEquivalent,
        overlaps_with_other: rx.overlapsWithOther,
        early_refill: rx.earlyRefill,
      }));

      await supabase.from('pdmp_prescription_history').insert(historyRecords);
    }

    await auditLogger.info('PDMP_QUERY_COMPLETED', {
      tenantId,
      queryId: queryRecord.id,
      prescriptionsFound: pdmpResponse.prescriptions.length,
      flags: pdmpResponse.flags,
    });

    return success(mapPDMPQuery(updatedQuery));
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_QUERY_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId: input.patientId }
    );
    return failure('OPERATION_FAILED', 'PDMP query failed');
  }
}

/**
 * Simulate PDMP query response (production would call actual API)
 */
async function simulatePDMPQuery(
  _queryId: string,
  _input: PDMPQueryInput
): Promise<{
  status: ResponseStatus;
  prescriptions: PDMPPrescriptionHistory[];
  flags: PDMPFlags;
  mme: number;
  overlapping: number;
  uniquePrescribers: number;
  uniquePharmacies: number;
}> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Return simulated response
  // In production, this would be replaced with actual PDMP API call
  const mockPrescriptions: PDMPPrescriptionHistory[] = [];

  // Analyze risk (even with empty data in simulation)
  const analysis = analyzeRiskFlags(mockPrescriptions);

  return {
    status: 'success',
    prescriptions: mockPrescriptions,
    flags: analysis.flags,
    mme: analysis.mme,
    overlapping: analysis.overlapping,
    uniquePrescribers: analysis.uniquePrescribers,
    uniquePharmacies: analysis.uniquePharmacies,
  };
}

/**
 * Get a PDMP query by ID
 */
export async function getPDMPQuery(
  tenantId: string,
  queryId: string
): Promise<ServiceResult<PDMPQuery | null>> {
  try {
    const { data, error } = await supabase
      .from('pdmp_queries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', queryId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    return success(data ? mapPDMPQuery(data) : null);
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_QUERY_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, queryId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch PDMP query');
  }
}

/**
 * Get prescription history from a PDMP query
 */
export async function getPDMPPrescriptionHistory(
  queryId: string
): Promise<ServiceResult<PDMPPrescriptionHistory[]>> {
  try {
    const { data, error } = await supabase
      .from('pdmp_prescription_history')
      .select('*')
      .eq('pdmp_query_id', queryId)
      .order('filled_date', { ascending: false });

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success((data || []).map(mapPDMPHistory));
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_HISTORY_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { queryId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch prescription history');
  }
}

/**
 * Get recent PDMP queries for a patient
 */
export async function getPatientPDMPQueries(
  tenantId: string,
  patientId: string,
  options?: { limit?: number; hoursAgo?: number }
): Promise<ServiceResult<PDMPQuery[]>> {
  try {
    let query = supabase
      .from('pdmp_queries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .order('query_timestamp', { ascending: false });

    if (options?.hoursAgo) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - options.hoursAgo);
      query = query.gte('query_timestamp', cutoff.toISOString());
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    return success((data || []).map(mapPDMPQuery));
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_PATIENT_QUERIES_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch patient PDMP queries');
  }
}

/**
 * Check if a recent PDMP query exists for a patient
 */
export async function hasRecentPDMPQuery(
  tenantId: string,
  patientId: string,
  stateCode: string,
  maxAgeHours: number = 24
): Promise<ServiceResult<{ exists: boolean; query?: PDMPQuery }>> {
  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - maxAgeHours);

    const { data, error } = await supabase
      .from('pdmp_queries')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('patient_id', patientId)
      .eq('pdmp_state', stateCode.toUpperCase())
      .eq('response_status', 'success')
      .gte('query_timestamp', cutoff.toISOString())
      .order('query_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return failure('DATABASE_ERROR', error.message);
    }

    if (data) {
      return success({ exists: true, query: mapPDMPQuery(data) });
    }

    return success({ exists: false });
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_RECENT_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId, patientId }
    );
    return failure('OPERATION_FAILED', 'Failed to check recent PDMP query');
  }
}

// =====================================================
// STATISTICS
// =====================================================

/**
 * Get PDMP query statistics
 */
export async function getPDMPStats(
  tenantId: string,
  options?: { startDate?: Date; endDate?: Date }
): Promise<ServiceResult<{
  totalQueries: number;
  queriesWithFlags: number;
  flagBreakdown: Record<string, number>;
  avgMME: number;
  byState: Record<string, number>;
}>> {
  try {
    let query = supabase
      .from('pdmp_queries')
      .select('pdmp_state, flags, morphine_milligram_equivalent, response_status')
      .eq('tenant_id', tenantId)
      .eq('response_status', 'success');

    if (options?.startDate) {
      query = query.gte('query_timestamp', options.startDate.toISOString());
    }
    if (options?.endDate) {
      query = query.lte('query_timestamp', options.endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return failure('DATABASE_ERROR', error.message);
    }

    const queries = data || [];

    const flagBreakdown: Record<string, number> = {
      doctorShopping: 0,
      pharmacyShopping: 0,
      earlyRefill: 0,
      highMme: 0,
      overlappingControlled: 0,
    };

    const byState: Record<string, number> = {};
    let totalMME = 0;
    let mmeCount = 0;
    let queriesWithFlags = 0;

    for (const q of queries) {
      // Count by state
      byState[q.pdmp_state] = (byState[q.pdmp_state] || 0) + 1;

      // Count MME
      if (q.morphine_milligram_equivalent) {
        totalMME += q.morphine_milligram_equivalent;
        mmeCount++;
      }

      // Count flags
      const flags = q.flags || {};
      let hasFlag = false;

      if (flags.doctor_shopping) {
        flagBreakdown.doctorShopping++;
        hasFlag = true;
      }
      if (flags.pharmacy_shopping) {
        flagBreakdown.pharmacyShopping++;
        hasFlag = true;
      }
      if (flags.early_refill) {
        flagBreakdown.earlyRefill++;
        hasFlag = true;
      }
      if (flags.high_mme) {
        flagBreakdown.highMme++;
        hasFlag = true;
      }
      if (flags.overlapping_controlled) {
        flagBreakdown.overlappingControlled++;
        hasFlag = true;
      }

      if (hasFlag) {
        queriesWithFlags++;
      }
    }

    return success({
      totalQueries: queries.length,
      queriesWithFlags,
      flagBreakdown,
      avgMME: mmeCount > 0 ? Math.round((totalMME / mmeCount) * 100) / 100 : 0,
      byState,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'PDMP_STATS_FETCH_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { tenantId }
    );
    return failure('FETCH_FAILED', 'Failed to fetch PDMP statistics');
  }
}

// =====================================================
// EXPORTS
// =====================================================

export const PDMPService = {
  // State Configuration
  getStateConfig,
  getActiveStateConfigs,
  isPDMPQueryRequired,

  // PDMP Queries
  queryPDMP,
  getPDMPQuery,
  getPDMPPrescriptionHistory,
  getPatientPDMPQueries,
  hasRecentPDMPQuery,

  // Statistics
  getPDMPStats,

  // Utilities
  calculateMME,
};

export default PDMPService;
