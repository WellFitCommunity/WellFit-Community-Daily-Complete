// =====================================================
// MCP Medical Coding Server — Charge Aggregation Handlers
// Chain 6b: Daily Charge Aggregator
//
// Aggregates all billable activity for a patient on a
// specific date from encounter data (procedures, labs,
// imaging, meds, FHIR resources). Returns categorized
// charges for daily billing snapshots.
//
// Advisory only — never auto-files charges.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  MCPLogger,
  ChargeEntry,
  ChargesByCategory,
  DailyChargeSnapshot
} from "./types.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";

// -------------------------------------------------------
// Database row shapes (system boundary casts)
// -------------------------------------------------------
interface EncounterProcedureRow {
  id: string;
  code: string;
  charge_amount: number | null;
  units: number | null;
  modifiers: string[] | null;
  description: string | null;
  service_date: string | null;
}

interface FhirObservationRow {
  id: string;
  code: string;
  code_display: string;
  category: string[];
  effective_datetime: string | null;
  value_quantity_value: number | null;
  status: string;
}

interface FhirProcedureRow {
  id: string;
  code: string;
  code_display: string;
  billing_code: string | null;
  billing_charge_amount: number | null;
  billing_units: number | null;
  billing_modifier: string[] | null;
  performed_datetime: string | null;
  status: string;
}

interface ClaimLineRow {
  id: string;
  code_system: string;
  procedure_code: string;
  charge_amount: number;
  units: number | null;
  modifiers: string[] | null;
  service_date: string | null;
  claim_id: string;
}

interface MedicationRow {
  id: string;
  medication_name: string;
  ndc_code: string | null;
  dosage: string | null;
  route: string | null;
  prescribed_date: string | null;
  status: string;
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** Classify a charge into a billing category based on code or source */
function categorizeCharge(
  codeSystem: string,
  code: string,
  sourceTable: string,
  category?: string[]
): keyof ChargesByCategory {
  // FHIR observations with lab category
  if (sourceTable === 'fhir_observations') {
    if (category?.includes('laboratory')) return 'lab';
    if (category?.includes('imaging')) return 'imaging';
    if (category?.includes('vital-signs')) return 'nursing';
    return 'other';
  }

  // Medications
  if (sourceTable === 'medications') return 'pharmacy';

  // CPT code ranges for classification
  if (codeSystem === 'CPT' || codeSystem === 'cpt') {
    const cptNum = parseInt(code, 10);
    if (!isNaN(cptNum)) {
      if (cptNum >= 80000 && cptNum <= 89999) return 'lab';
      if (cptNum >= 70000 && cptNum <= 79999) return 'imaging';
      if (cptNum >= 90000 && cptNum <= 99999) return 'evaluation';
      if (cptNum >= 10000 && cptNum <= 69999) return 'procedure';
    }
  }

  // HCPCS codes starting with J = pharmacy
  if ((codeSystem === 'HCPCS' || codeSystem === 'hcpcs') && code.startsWith('J')) {
    return 'pharmacy';
  }

  return 'other';
}

/** Create an empty charges-by-category structure */
function emptyCharges(): ChargesByCategory {
  return {
    lab: [],
    imaging: [],
    pharmacy: [],
    nursing: [],
    procedure: [],
    evaluation: [],
    other: []
  };
}

// -------------------------------------------------------
// Exported handler factory
// -------------------------------------------------------
export function createChargeAggregationHandlers(
  sb: SupabaseClient,
  logger: MCPLogger
) {
  const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;

  // =======================================================
  // aggregate_daily_charges — Pull from all source tables
  // =======================================================
  async function handleAggregateDailyCharges(args: Record<string, unknown>) {
    const patientId = args.patient_id as string;
    const encounterId = args.encounter_id as string;
    const serviceDate = args.service_date as string;
    const tenantId = args.tenant_id as string | undefined;

    const charges = emptyCharges();
    let totalAmount = 0;
    let chargeCount = 0;

    // --- 1. Encounter Procedures (CPT codes + charge amounts) ---
    const { data: procRows, error: procErr } = await withTimeout(
      sb.from('encounter_procedures')
        .select('id, code, charge_amount, units, modifiers, description, service_date')
        .eq('encounter_id', encounterId)
        .eq('service_date', serviceDate),
      timeoutMs,
      'Encounter procedures lookup'
    );

    if (procErr) {
      logger.error('CHARGE_AGG_PROCEDURES_FAILED', {
        encounterId, serviceDate, error: String(procErr)
      });
    }

    for (const row of (procRows || []) as EncounterProcedureRow[]) {
      const amount = row.charge_amount ?? 0;
      const units = row.units ?? 1;
      const entry: ChargeEntry = {
        code: row.code,
        code_system: 'cpt',
        description: row.description || row.code,
        charge_amount: amount,
        units,
        modifiers: row.modifiers || [],
        source_table: 'encounter_procedures',
        source_id: row.id
      };

      const cat = categorizeCharge('CPT', row.code, 'encounter_procedures');
      charges[cat].push(entry);
      totalAmount += amount * units;
      chargeCount++;
    }

    // --- 2. FHIR Observations (labs, vitals — LOINC codes) ---
    {
      let obsQuery = sb.from('fhir_observations')
        .select('id, code, code_display, category, effective_datetime, value_quantity_value, status')
        .eq('patient_id', patientId)
        .in('status', ['final', 'amended', 'corrected']);

      // Filter by date: effective_datetime on the service date
      obsQuery = obsQuery
        .gte('effective_datetime', `${serviceDate}T00:00:00`)
        .lt('effective_datetime', `${serviceDate}T23:59:59.999`);

      if (encounterId) {
        obsQuery = obsQuery.eq('encounter_id', encounterId);
      }

      const { data: obsRows, error: obsErr } = await withTimeout(
        obsQuery,
        timeoutMs,
        'FHIR observations lookup'
      );

      if (obsErr) {
        logger.error('CHARGE_AGG_OBSERVATIONS_FAILED', {
          encounterId, serviceDate, error: String(obsErr)
        });
      }

      for (const row of (obsRows || []) as FhirObservationRow[]) {
        const entry: ChargeEntry = {
          code: row.code,
          code_system: 'loinc',
          description: row.code_display,
          charge_amount: 0, // Observations don't carry charge amounts directly
          units: 1,
          modifiers: [],
          source_table: 'fhir_observations',
          source_id: row.id
        };

        const cat = categorizeCharge('loinc', row.code, 'fhir_observations', row.category);
        charges[cat].push(entry);
        chargeCount++;
      }
    }

    // --- 3. FHIR Procedures (CPT/SNOMED with billing codes) ---
    {
      let fpQuery = sb.from('fhir_procedures')
        .select('id, code, code_display, billing_code, billing_charge_amount, billing_units, billing_modifier, performed_datetime, status')
        .eq('patient_id', patientId)
        .in('status', ['completed', 'in-progress']);

      fpQuery = fpQuery
        .gte('performed_datetime', `${serviceDate}T00:00:00`)
        .lt('performed_datetime', `${serviceDate}T23:59:59.999`);

      if (encounterId) {
        fpQuery = fpQuery.eq('encounter_id', encounterId);
      }

      const { data: fpRows, error: fpErr } = await withTimeout(
        fpQuery,
        timeoutMs,
        'FHIR procedures lookup'
      );

      if (fpErr) {
        logger.error('CHARGE_AGG_FHIR_PROCEDURES_FAILED', {
          encounterId, serviceDate, error: String(fpErr)
        });
      }

      for (const row of (fpRows || []) as FhirProcedureRow[]) {
        const billingCode = row.billing_code || row.code;
        const amount = row.billing_charge_amount ?? 0;
        const units = row.billing_units ?? 1;

        const entry: ChargeEntry = {
          code: billingCode,
          code_system: row.billing_code ? 'cpt' : 'snomed',
          description: row.code_display,
          charge_amount: amount,
          units,
          modifiers: row.billing_modifier || [],
          source_table: 'fhir_procedures',
          source_id: row.id
        };

        const cat = categorizeCharge('CPT', billingCode, 'fhir_procedures');
        charges[cat].push(entry);
        totalAmount += amount * units;
        chargeCount++;
      }
    }

    // --- 4. Claim Lines (already-filed charges — CPT/HCPCS) ---
    // First get claim IDs for this encounter/patient, then filter claim_lines
    {
      // Look up claims for this encounter (or patient + date as fallback)
      let claimIds: string[] = [];
      const { data: claimRows } = await withTimeout(
        encounterId
          ? sb.from('claims').select('id').eq('encounter_id', encounterId)
          : sb.from('claims').select('id').eq('patient_id', patientId).eq('service_date', serviceDate),
        timeoutMs,
        'Claims lookup for encounter'
      );
      if (claimRows) {
        claimIds = (claimRows as Array<{ id: string }>).map(r => r.id);
      }

      let clRows: unknown[] | null = null;
      let clErr: unknown = null;

      if (claimIds.length > 0) {
        const result = await withTimeout(
          sb.from('claim_lines')
            .select('id, code_system, procedure_code, charge_amount, units, modifiers, service_date, claim_id')
            .in('claim_id', claimIds)
            .in('code_system', ['CPT', 'HCPCS']),
          timeoutMs,
          'Claim lines lookup'
        );
        clRows = result.data;
        clErr = result.error;
      }

      if (clErr) {
        logger.error('CHARGE_AGG_CLAIM_LINES_FAILED', {
          encounterId, serviceDate, error: String(clErr)
        });
      }

      // Process claim lines scoped to this encounter's claims
      for (const row of (clRows || []) as ClaimLineRow[]) {
        const entry: ChargeEntry = {
          code: row.procedure_code,
          code_system: row.code_system.toLowerCase(),
          description: `${row.code_system} ${row.procedure_code}`,
          charge_amount: row.charge_amount,
          units: row.units ?? 1,
          modifiers: row.modifiers || [],
          source_table: 'claim_lines',
          source_id: row.id
        };

        const cat = categorizeCharge(row.code_system, row.procedure_code, 'claim_lines');
        charges[cat].push(entry);
        totalAmount += row.charge_amount * (row.units ?? 1);
        chargeCount++;
      }
    }

    // --- 5. Medications (NDC codes for pharmacy charges) ---
    {
      let medQuery = sb.from('medications')
        .select('id, medication_name, ndc_code, dosage, route, prescribed_date, status')
        .eq('user_id', patientId)
        .eq('status', 'active');

      if (serviceDate) {
        medQuery = medQuery.lte('prescribed_date', serviceDate);
      }

      const { data: medRows, error: medErr } = await withTimeout(
        medQuery.limit(50),
        timeoutMs,
        'Medications lookup'
      );

      if (medErr) {
        logger.error('CHARGE_AGG_MEDICATIONS_FAILED', {
          encounterId, serviceDate, error: String(medErr)
        });
      }

      for (const row of (medRows || []) as MedicationRow[]) {
        if (!row.ndc_code) continue; // Skip meds without NDC — can't bill

        const entry: ChargeEntry = {
          code: row.ndc_code,
          code_system: 'ndc',
          description: row.medication_name,
          charge_amount: 0, // NDC doesn't carry amount — needs fee schedule lookup
          units: 1,
          modifiers: [],
          source_table: 'medications',
          source_id: row.id
        };

        charges.pharmacy.push(entry);
        chargeCount++;
      }
    }

    logger.info('DAILY_CHARGES_AGGREGATED', {
      encounterId,
      serviceDate,
      chargeCount,
      totalAmount: Math.round(totalAmount * 100) / 100,
      categories: {
        lab: charges.lab.length,
        imaging: charges.imaging.length,
        pharmacy: charges.pharmacy.length,
        nursing: charges.nursing.length,
        procedure: charges.procedure.length,
        evaluation: charges.evaluation.length,
        other: charges.other.length
      }
    });

    return {
      encounter_id: encounterId,
      patient_id: patientId,
      service_date: serviceDate,
      charges,
      total_charge_amount: Math.round(totalAmount * 100) / 100,
      charge_count: chargeCount,
      sources_queried: [
        'encounter_procedures',
        'fhir_observations',
        'fhir_procedures',
        'claim_lines',
        'medications'
      ],
      advisory: 'Charges aggregated for review. Human verification required before billing.'
    };
  }

  // =======================================================
  // get_daily_snapshot — Retrieve persisted snapshot
  // =======================================================
  async function handleGetDailySnapshot(args: Record<string, unknown>) {
    const encounterId = args.encounter_id as string;
    const serviceDate = args.service_date as string | undefined;
    const tenantId = args.tenant_id as string | undefined;

    let query = sb.from('daily_charge_snapshots')
      .select('*')
      .eq('encounter_id', encounterId);

    if (serviceDate) {
      query = query.eq('service_date', serviceDate);
    }
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    query = query.order('service_date', { ascending: false });

    const { data, error } = await withTimeout(query, timeoutMs, 'Daily snapshot lookup');

    if (error) {
      logger.error('DAILY_SNAPSHOT_QUERY_FAILED', {
        encounterId, serviceDate, error: String(error)
      });
      throw error;
    }

    const snapshots = (data || []) as DailyChargeSnapshot[];

    logger.info('DAILY_SNAPSHOT_RETRIEVED', {
      encounterId,
      serviceDate: serviceDate ?? 'all',
      snapshotCount: snapshots.length
    });

    // If a specific date was requested, return single snapshot
    if (serviceDate && snapshots.length > 0) {
      return { snapshot: snapshots[0], found: true };
    }

    return {
      snapshots,
      count: snapshots.length,
      found: snapshots.length > 0
    };
  }

  // =======================================================
  // save_daily_snapshot — Persist aggregated charges
  // =======================================================
  async function handleSaveDailySnapshot(args: Record<string, unknown>) {
    const now = new Date().toISOString();

    const snapshotData = {
      tenant_id: args.tenant_id as string,
      patient_id: args.patient_id as string,
      encounter_id: args.encounter_id as string,
      admit_date: args.admit_date as string,
      service_date: args.service_date as string,
      day_number: args.day_number as number,
      charges: args.charges ?? { lab: [], imaging: [], pharmacy: [], nursing: [], procedure: [], evaluation: [], other: [] },
      total_charge_amount: (args.total_charge_amount as number) ?? 0,
      charge_count: (args.charge_count as number) ?? 0,
      projected_drg_code: (args.projected_drg_code as string) ?? null,
      projected_drg_weight: (args.projected_drg_weight as number) ?? null,
      projected_reimbursement: (args.projected_reimbursement as number) ?? null,
      revenue_codes: args.revenue_codes ?? [],
      optimization_suggestions: args.optimization_suggestions ?? [],
      missing_charge_alerts: args.missing_charge_alerts ?? [],
      documentation_gaps: args.documentation_gaps ?? [],
      status: (args.status as string) ?? 'draft',
      ai_skill_key: 'medical_coding_processor',
      ai_model_used: null,
      updated_at: now
    };

    // Upsert by encounter + service_date
    const { data, error } = await withTimeout(
      sb.from('daily_charge_snapshots')
        .upsert(snapshotData, {
          onConflict: 'tenant_id,encounter_id,service_date'
        })
        .select()
        .single(),
      timeoutMs,
      'Daily snapshot upsert'
    );

    if (error) {
      logger.error('DAILY_SNAPSHOT_SAVE_FAILED', {
        encounterId: args.encounter_id,
        serviceDate: args.service_date,
        error: String(error)
      });
      throw error;
    }

    const snapshot = data as DailyChargeSnapshot;

    logger.info('DAILY_SNAPSHOT_SAVED', {
      snapshotId: snapshot.id,
      encounterId: snapshot.encounter_id,
      serviceDate: snapshot.service_date,
      dayNumber: snapshot.day_number,
      chargeCount: snapshot.charge_count,
      totalAmount: snapshot.total_charge_amount,
      status: snapshot.status
    });

    return {
      snapshot,
      message: 'Daily charge snapshot saved successfully'
    };
  }

  return {
    handleAggregateDailyCharges,
    handleGetDailySnapshot,
    handleSaveDailySnapshot
  };
}
