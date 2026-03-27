/**
 * RPM Claim Service
 *
 * Orchestrates the RPM billing pipeline:
 *   eligibility check → encounter creation → procedure attachment → claim generation
 *
 * CPT Codes:
 *   99453 — Initial device setup and patient education (one-time)
 *   99454 — Device supply with daily recordings (≥16 days in 30-day period)
 *   99457 — Remote monitoring treatment management, first 20 min
 *   99458 — Each additional 20-min block beyond 99457
 *
 * Used by: Clinical billing dashboard, monthly cron job
 * Owner: Shared (billing infrastructure)
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';
import { rpmDashboardService } from './rpmDashboardService';
import type { RpmBillingEligibility } from '../types/rpm';

// ── Types ────────────────────────────────────────────────────────────────────

/** RPM CPT code definitions with default charge amounts */
interface RpmCptCode {
  code: string;
  description: string;
  defaultCharge: number;
  units: number;
}

/** Result of generating an RPM claim */
export interface RpmClaimResult {
  enrollment_id: string;
  patient_id: string;
  encounter_id: string;
  claim_id: string | null;
  procedures: { code: string; charge: number; units: number }[];
  total_charge: number;
  period_start: string;
  period_end: string;
  billing_codes: string[];
}

/** Summary of a bulk RPM billing run */
export interface RpmBillingRunSummary {
  run_date: string;
  total_enrollments: number;
  eligible_count: number;
  claims_generated: number;
  claims_failed: number;
  total_charges: number;
  results: RpmClaimResult[];
  errors: { enrollment_id: string; error: string }[];
}

// ── Fee Schedule Lookup ──────────────────────────────────────────────────────

interface FeeScheduleRateRow {
  code: string;
  rate: number;
}

/**
 * Look up RPM CPT fee schedule rates.
 * Queries fee_schedule_rates for the active Medicare RPM schedule.
 * Falls back to default CMS national average charges if no entry exists.
 */
async function getRpmFeeScheduleRates(
  _billingProviderId: string
): Promise<Record<string, number>> {
  const rpmCodes = ['99453', '99454', '99457', '99458'];
  const defaults: Record<string, number> = {
    '99453': 19.46,  // CMS national average
    '99454': 62.44,
    '99457': 50.94,
    '99458': 41.17,
  };

  try {
    // Look up the active RPM fee schedule
    const { data: schedules, error: schedErr } = await supabase
      .from('fee_schedules')
      .select('id')
      .eq('is_active', true)
      .eq('payer_type', 'medicare')
      .order('effective_date', { ascending: false })
      .limit(1);

    if (schedErr || !schedules || schedules.length === 0) {
      return defaults;
    }

    const scheduleId = (schedules[0] as { id: string }).id;

    const { data, error } = await supabase
      .from('fee_schedule_rates')
      .select('code, rate')
      .in('code', rpmCodes)
      .eq('fee_schedule_id', scheduleId);

    if (error || !data || data.length === 0) {
      return defaults;
    }

    const rates = { ...defaults };
    for (const row of data as FeeScheduleRateRow[]) {
      rates[row.code] = row.rate;
    }
    return rates;
  } catch {
    return defaults;
  }
}

// ── Encounter + Procedure Creation ──────────────────────────────────────────

interface EncounterInsert {
  patient_id: string;
  date_of_service: string;
  status: string;
  encounter_type: string;
  claim_frequency_code: string;
  subscriber_relation_code: string;
  chief_complaint: string;
  notes: string;
}

interface ProcedureInsert {
  encounter_id: string;
  code: string;
  charge_amount: number;
  units: number;
  modifiers: string[];
  service_date: string;
  diagnosis_pointers: number[];
  description: string;
}

interface DiagnosisInsert {
  encounter_id: string;
  code: string;
  sequence: number;
  description: string;
}

/**
 * Build the list of billable RPM procedures from eligibility data.
 */
function buildRpmProcedures(
  eligibility: RpmBillingEligibility,
  rates: Record<string, number>,
  serviceDate: string,
  setupCompleted: boolean
): RpmCptCode[] {
  const procedures: RpmCptCode[] = [];

  // 99453: Initial setup (one-time, only if setup was just completed this period)
  if (setupCompleted) {
    procedures.push({
      code: '99453',
      description: 'RPM device setup and patient education',
      defaultCharge: rates['99453'],
      units: 1,
    });
  }

  // 99454: Device supply with daily recordings (≥16 days)
  if (eligibility.is_eligible_99454) {
    procedures.push({
      code: '99454',
      description: 'RPM device supply with daily recordings',
      defaultCharge: rates['99454'],
      units: 1,
    });
  }

  // 99457: Treatment management, first 20 min
  if (eligibility.is_eligible_99457) {
    procedures.push({
      code: '99457',
      description: 'RPM treatment management, first 20 min',
      defaultCharge: rates['99457'],
      units: 1,
    });
  }

  // 99458: Each additional 20-min block
  if (eligibility.is_eligible_99458 && eligibility.additional_20min_units > 0) {
    procedures.push({
      code: '99458',
      description: 'RPM treatment management, each additional 20 min',
      defaultCharge: rates['99458'],
      units: eligibility.additional_20min_units,
    });
  }

  return procedures;
}

// ── Core: Generate RPM Claim ────────────────────────────────────────────────

interface GenerateRpmClaimInput {
  enrollmentId: string;
  billingProviderId: string;
  payerId?: string;
}

interface EnrollmentRow {
  id: string;
  patient_id: string;
  primary_diagnosis_code: string | null;
  monitoring_reason: string | null;
  ordering_provider_id: string | null;
  setup_completed_at: string | null;
  monitoring_start_date: string | null;
  monitoring_end_date: string | null;
  total_monitoring_minutes: number;
  tenant_id: string;
}

/**
 * Generate a claim for a single RPM enrollment.
 *
 * Pipeline: eligibility → encounter → procedures → diagnoses → claim record
 *
 * The generated encounter + procedures can then be fed to the `generate-837p`
 * edge function for X12 output, or processed directly by clearinghouse batch.
 */
async function generateRpmClaim(
  input: GenerateRpmClaimInput
): Promise<ServiceResult<RpmClaimResult>> {
  const { enrollmentId, billingProviderId, payerId } = input;

  try {
    // 1. Check billing eligibility
    const eligResult = await rpmDashboardService.getBillingEligibility(enrollmentId);
    if (!eligResult.success) {
      return failure(eligResult.error.code, eligResult.error.message);
    }

    const eligibility = eligResult.data;

    // Must be eligible for at least one CPT code
    if (!eligibility.is_eligible_99454 && !eligibility.is_eligible_99457) {
      return failure(
        'NOT_ELIGIBLE',
        `Enrollment ${enrollmentId} not eligible: ${eligibility.transmission_days} transmission days, ${eligibility.monitoring_minutes} monitoring minutes`
      );
    }

    // 2. Fetch enrollment details
    const { data: enrollment, error: enrollErr } = await supabase
      .from('rpm_enrollments')
      .select('id, patient_id, primary_diagnosis_code, monitoring_reason, ordering_provider_id, setup_completed_at, monitoring_start_date, monitoring_end_date, total_monitoring_minutes, tenant_id')
      .eq('id', enrollmentId)
      .single();

    if (enrollErr || !enrollment) {
      return failure('NOT_FOUND', `Enrollment ${enrollmentId} not found`);
    }

    const typedEnrollment = enrollment as EnrollmentRow;

    // 3. Get fee schedule rates
    const rates = await getRpmFeeScheduleRates(billingProviderId);

    // 4. Determine if setup was completed this billing period
    const setupCompletedThisPeriod = Boolean(
      typedEnrollment.setup_completed_at &&
      new Date(typedEnrollment.setup_completed_at) >= new Date(eligibility.period_start)
    );

    // 5. Build procedure list
    const serviceDate = new Date().toISOString().split('T')[0];
    const procedures = buildRpmProcedures(
      eligibility,
      rates,
      serviceDate,
      setupCompletedThisPeriod
    );

    if (procedures.length === 0) {
      return failure('NO_PROCEDURES', 'No billable RPM procedures for this period');
    }

    // 6. Create encounter
    const encounterInsert: EncounterInsert = {
      patient_id: typedEnrollment.patient_id,
      date_of_service: serviceDate,
      status: 'ready',
      encounter_type: 'rpm',
      claim_frequency_code: '1',
      subscriber_relation_code: '18',
      chief_complaint: `RPM monitoring: ${typedEnrollment.monitoring_reason || 'Remote patient monitoring'}`,
      notes: `Auto-generated RPM billing encounter. Period: ${eligibility.period_start} to ${eligibility.period_end}. Transmission days: ${eligibility.transmission_days}/${eligibility.required_days}. Monitoring minutes: ${eligibility.monitoring_minutes}.`,
    };

    // Add payer if provided
    const insertPayload: Record<string, unknown> = { ...encounterInsert };
    if (payerId) {
      insertPayload.payer_id = payerId;
    }

    const { data: encounterData, error: encErr } = await supabase
      .from('encounters')
      .insert(insertPayload)
      .select('id')
      .single();

    if (encErr || !encounterData) {
      return failure('DATABASE_ERROR', `Failed to create RPM encounter: ${encErr?.message || 'unknown'}`);
    }

    const encounterId = (encounterData as { id: string }).id;

    // 7. Insert diagnosis (primary from enrollment)
    const diagnosisCode = typedEnrollment.primary_diagnosis_code || 'Z87.39';
    const diagInsert: DiagnosisInsert = {
      encounter_id: encounterId,
      code: diagnosisCode,
      sequence: 1,
      description: typedEnrollment.monitoring_reason || 'Remote patient monitoring',
    };

    const { error: diagErr } = await supabase
      .from('encounter_diagnoses')
      .insert(diagInsert);

    if (diagErr) {
      await auditLogger.error(
        'RPM_DIAGNOSIS_INSERT_FAILED',
        new Error(diagErr.message),
        { encounterId, enrollmentId }
      );
      // Continue — diagnosis failure shouldn't block the claim
    }

    // 8. Insert procedures
    const procedureInserts: ProcedureInsert[] = procedures.map((proc) => ({
      encounter_id: encounterId,
      code: proc.code,
      charge_amount: proc.defaultCharge * proc.units,
      units: proc.units,
      modifiers: [],
      service_date: serviceDate,
      diagnosis_pointers: [1],
      description: proc.description,
    }));

    const { error: procErr } = await supabase
      .from('encounter_procedures')
      .insert(procedureInserts);

    if (procErr) {
      return failure('DATABASE_ERROR', `Failed to insert RPM procedures: ${procErr.message}`);
    }

    // 9. Create claim record (status: ready — not yet submitted to clearinghouse)
    const totalCharge = procedures.reduce(
      (sum, p) => sum + p.defaultCharge * p.units,
      0
    );

    interface ClaimInsertResult {
      id: string;
    }

    const { data: claimData, error: claimErr } = await supabase
      .from('claims')
      .insert({
        encounter_id: encounterId,
        claim_type: '837P',
        status: 'ready',
        total_charge: totalCharge,
        payer_id: payerId || null,
        billing_provider_id: billingProviderId,
      })
      .select('id')
      .single();

    const claimId = claimErr ? null : (claimData as ClaimInsertResult | null)?.id ?? null;

    if (claimErr) {
      await auditLogger.error(
        'RPM_CLAIM_INSERT_FAILED',
        new Error(claimErr.message),
        { encounterId, enrollmentId }
      );
    }

    // 10. Audit log
    await auditLogger.info('RPM_CLAIM_GENERATED', {
      enrollmentId,
      encounterId,
      claimId,
      patientId: typedEnrollment.patient_id,
      procedures: procedures.map((p) => p.code),
      totalCharge,
      periodStart: eligibility.period_start,
      periodEnd: eligibility.period_end,
      transmissionDays: eligibility.transmission_days,
      monitoringMinutes: eligibility.monitoring_minutes,
    });

    const result: RpmClaimResult = {
      enrollment_id: enrollmentId,
      patient_id: typedEnrollment.patient_id,
      encounter_id: encounterId,
      claim_id: claimId,
      procedures: procedures.map((p) => ({
        code: p.code,
        charge: p.defaultCharge * p.units,
        units: p.units,
      })),
      total_charge: totalCharge,
      period_start: eligibility.period_start,
      period_end: eligibility.period_end,
      billing_codes: procedures.map((p) => p.code),
    };

    return success(result);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_CLAIM_GENERATION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId, billingProviderId }
    );
    return failure('UNKNOWN_ERROR', 'RPM claim generation failed');
  }
}

// ── Bulk: Monthly Billing Run ───────────────────────────────────────────────

interface BulkBillingInput {
  billingProviderId: string;
  payerId?: string;
}

/**
 * Run monthly RPM billing for all active enrollments.
 *
 * Iterates through all active RPM enrollments, checks eligibility,
 * and generates claims for those that qualify. Returns a summary
 * with success/failure counts and total charges.
 */
async function runMonthlyBilling(
  input: BulkBillingInput
): Promise<ServiceResult<RpmBillingRunSummary>> {
  const { billingProviderId, payerId } = input;

  try {
    // Get all active enrollments
    const enrollResult = await rpmDashboardService.getActiveEnrollments();
    if (!enrollResult.success) {
      return failure(enrollResult.error.code, enrollResult.error.message);
    }

    const enrollments = enrollResult.data;
    const results: RpmClaimResult[] = [];
    const errors: { enrollment_id: string; error: string }[] = [];

    for (const enrollment of enrollments) {
      if (enrollment.status !== 'active') continue;

      const claimResult = await generateRpmClaim({
        enrollmentId: enrollment.id,
        billingProviderId,
        payerId,
      });

      if (claimResult.success) {
        results.push(claimResult.data);
      } else {
        errors.push({
          enrollment_id: enrollment.id,
          error: claimResult.error.message,
        });
      }
    }

    const summary: RpmBillingRunSummary = {
      run_date: new Date().toISOString().split('T')[0],
      total_enrollments: enrollments.filter((e) => e.status === 'active').length,
      eligible_count: results.length,
      claims_generated: results.filter((r) => r.claim_id !== null).length,
      claims_failed: errors.length,
      total_charges: results.reduce((sum, r) => sum + r.total_charge, 0),
      results,
      errors,
    };

    await auditLogger.info('RPM_MONTHLY_BILLING_COMPLETE', {
      runDate: summary.run_date,
      totalEnrollments: summary.total_enrollments,
      eligible: summary.eligible_count,
      generated: summary.claims_generated,
      failed: summary.claims_failed,
      totalCharges: summary.total_charges,
    });

    return success(summary);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_MONTHLY_BILLING_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { billingProviderId }
    );
    return failure('UNKNOWN_ERROR', 'Monthly RPM billing run failed');
  }
}

// ── Duplicate Check ─────────────────────────────────────────────────────────

/**
 * Check if an RPM claim already exists for this enrollment in the current period.
 * Prevents duplicate billing.
 */
async function hasExistingClaimForPeriod(
  enrollmentId: string,
  periodStart: string,
  periodEnd: string
): Promise<ServiceResult<boolean>> {
  try {
    // Look for encounters linked to this enrollment's patient in the period
    const enrollResult = await rpmDashboardService.getEnrollmentById(enrollmentId);
    if (!enrollResult.success) {
      return failure(enrollResult.error.code, enrollResult.error.message);
    }

    const { data, error } = await supabase
      .from('encounters')
      .select('id')
      .eq('patient_id', enrollResult.data.patient_id)
      .eq('encounter_type', 'rpm')
      .gte('date_of_service', periodStart)
      .lte('date_of_service', periodEnd)
      .limit(1);

    if (error) return failure('DATABASE_ERROR', error.message);

    return success((data || []).length > 0);
  } catch (err: unknown) {
    await auditLogger.error(
      'RPM_DUPLICATE_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { enrollmentId }
    );
    return failure('UNKNOWN_ERROR', 'Duplicate check failed');
  }
}

// ── Exports ──────────────────────────────────────────────────────────────────

export const rpmClaimService = {
  generateRpmClaim,
  runMonthlyBilling,
  hasExistingClaimForPeriod,
  getRpmFeeScheduleRates,
  buildRpmProcedures,
};
