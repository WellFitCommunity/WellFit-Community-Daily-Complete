/**
 * Vital Threshold Monitor Edge Function
 *
 * Cron-triggered function that evaluates RPM-enrolled patients' vitals
 * against configurable threshold rules and creates guardian_alerts when
 * thresholds are breached.
 *
 * Data sources:
 *   - check_ins (BP, HR, SpO2, glucose)
 *   - fhir_observations (any LOINC-coded vital)
 *
 * Reuses patterns from bed-capacity-monitor:
 *   - Service-role Supabase client
 *   - Cooldown-based deduplication
 *   - Auto-resolve when readings normalize
 *
 * Copyright © 2026 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';

// ── Types ────────────────────────────────────────────────────────────────────

interface ThresholdRule {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  condition_code: string | null;
  rule_name: string;
  vital_type: string;
  threshold_operator: string;
  threshold_value: number;
  alert_type: string;
  severity: string;
  escalation_level: number;
  escalation_targets: string[];
  cooldown_minutes: number;
  auto_resolve: boolean;
}

interface Enrollment {
  id: string;
  tenant_id: string;
  patient_id: string;
  primary_diagnosis_code: string | null;
}

interface VitalReading {
  vital_type: string;
  value: number;
  source: 'check_in' | 'fhir_observation';
  recorded_at: string;
}

interface MonitorResult {
  patients_checked: number;
  alerts_created: number;
  alerts_resolved: number;
  errors: string[];
}

// ── Vital type mapping from check_in columns ─────────────────────────────────

const CHECK_IN_VITAL_MAP: Record<string, string> = {
  heart_rate: 'heart_rate',
  pulse_oximeter: 'oxygen_saturation',
  bp_systolic: 'bp_systolic',
  bp_diastolic: 'bp_diastolic',
  glucose_mg_dl: 'glucose',
};

const LOINC_VITAL_MAP: Record<string, string> = {
  '8867-4': 'heart_rate',
  '2708-6': 'oxygen_saturation',
  '8480-6': 'bp_systolic',
  '8462-4': 'bp_diastolic',
  '2339-0': 'glucose',
  '29463-7': 'weight',
  '8310-5': 'temperature',
};

// ── Threshold evaluation ─────────────────────────────────────────────────────

function evaluateThreshold(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>=': return value >= threshold;
    case '>':  return value > threshold;
    case '<=': return value <= threshold;
    case '<':  return value < threshold;
    default:   return false;
  }
}

// ── Collect vitals for a patient from last 24h ───────────────────────────────

async function collectPatientVitals(
  supabase: SupabaseClient,
  patientId: string,
  cutoff: string
): Promise<VitalReading[]> {
  const readings: VitalReading[] = [];

  // 1. Check-ins (most common source for community patients)
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select('heart_rate, pulse_oximeter, bp_systolic, bp_diastolic, glucose_mg_dl, timestamp')
    .eq('user_id', patientId)
    .gte('timestamp', cutoff)
    .order('timestamp', { ascending: false })
    .limit(50);

  for (const ci of checkIns || []) {
    for (const [col, vitalType] of Object.entries(CHECK_IN_VITAL_MAP)) {
      const val = ci[col as keyof typeof ci] as number | null;
      if (val !== null && val !== undefined) {
        readings.push({
          vital_type: vitalType,
          value: val,
          source: 'check_in',
          recorded_at: ci.timestamp as string,
        });
      }
    }
  }

  // 2. FHIR Observations (from EHR sync, wearables, or trigger-created)
  const { data: observations } = await supabase
    .from('fhir_observations')
    .select('code, value_quantity_value, components, effective_datetime')
    .eq('patient_id', patientId)
    .in('status', ['final', 'amended'])
    .gte('effective_datetime', cutoff)
    .order('effective_datetime', { ascending: false })
    .limit(50);

  for (const obs of observations || []) {
    const vitalType = LOINC_VITAL_MAP[obs.code as string];
    if (vitalType && obs.value_quantity_value !== null) {
      readings.push({
        vital_type: vitalType,
        value: Number(obs.value_quantity_value),
        source: 'fhir_observation',
        recorded_at: obs.effective_datetime as string,
      });
    }
    // Handle BP panel components
    if (obs.code === '85354-9' && Array.isArray(obs.components)) {
      for (const comp of obs.components as Array<{ code: string; value: number }>) {
        const compType = LOINC_VITAL_MAP[comp.code];
        if (compType && comp.value !== null) {
          readings.push({
            vital_type: compType,
            value: Number(comp.value),
            source: 'fhir_observation',
            recorded_at: obs.effective_datetime as string,
          });
        }
      }
    }
  }

  return readings;
}

// ── Get applicable rules for a patient ───────────────────────────────────────

function getApplicableRules(
  allRules: ThresholdRule[],
  patientId: string,
  diagnosisCode: string | null
): ThresholdRule[] {
  // Priority: patient-specific > condition-specific > general defaults
  const patientRules = allRules.filter((r) => r.patient_id === patientId);
  const conditionRules = diagnosisCode
    ? allRules.filter((r) => r.patient_id === null && r.condition_code === diagnosisCode)
    : [];
  const defaultRules = allRules.filter((r) => r.patient_id === null && r.condition_code === null);

  // For each vital_type, use most specific rule set
  const rulesByType = new Map<string, ThresholdRule[]>();

  for (const rule of [...patientRules, ...conditionRules, ...defaultRules]) {
    if (!rulesByType.has(rule.vital_type)) {
      rulesByType.set(rule.vital_type, []);
    }
    const existing = rulesByType.get(rule.vital_type)!;
    // Only add if no more specific rule exists for this vital_type + operator combo
    const hasMoreSpecific = existing.some(
      (e) =>
        e.threshold_operator === rule.threshold_operator &&
        (e.patient_id !== null || (e.condition_code !== null && rule.condition_code === null))
    );
    if (!hasMoreSpecific) {
      existing.push(rule);
    }
  }

  return Array.from(rulesByType.values()).flat();
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    if (!SUPABASE_URL || !SB_SECRET_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SB_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result: MonitorResult = {
      patients_checked: 0,
      alerts_created: 0,
      alerts_resolved: 0,
      errors: [],
    };

    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Get all active RPM enrollments
    const { data: enrollments, error: enrollErr } = await supabase
      .from('rpm_enrollments')
      .select('id, tenant_id, patient_id, primary_diagnosis_code')
      .eq('status', 'active');

    if (enrollErr) {
      throw new Error(`Failed to fetch enrollments: ${enrollErr.message}`);
    }

    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, result, message: 'No active RPM enrollments', timestamp: now.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Group enrollments by tenant for rule fetching
    const tenantEnrollments = new Map<string, Enrollment[]>();
    for (const e of enrollments as Enrollment[]) {
      if (!tenantEnrollments.has(e.tenant_id)) {
        tenantEnrollments.set(e.tenant_id, []);
      }
      tenantEnrollments.get(e.tenant_id)!.push(e);
    }

    // Process each tenant
    for (const [tenantId, tenantPatients] of tenantEnrollments) {
      // Fetch all active rules for this tenant
      const { data: rules, error: rulesErr } = await supabase
        .from('vital_threshold_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (rulesErr) {
        result.errors.push(`Failed to fetch rules for tenant ${tenantId}: ${rulesErr.message}`);
        continue;
      }

      const tenantRules = (rules || []) as ThresholdRule[];

      // Process each enrolled patient
      for (const enrollment of tenantPatients) {
        try {
          result.patients_checked++;
          const patientId = enrollment.patient_id;

          // Collect vitals from last 24h
          const readings = await collectPatientVitals(supabase, patientId, cutoff);
          if (readings.length === 0) continue;

          // Get applicable rules
          const applicableRules = getApplicableRules(
            tenantRules, patientId, enrollment.primary_diagnosis_code
          );

          // Track which vital types had all-normal readings
          const vitalTypesChecked = new Set<string>();
          const vitalTypesBreached = new Set<string>();

          // Evaluate each reading against applicable rules
          for (const reading of readings) {
            vitalTypesChecked.add(reading.vital_type);
            const rulesForType = applicableRules.filter((r) => r.vital_type === reading.vital_type);

            for (const rule of rulesForType) {
              if (!evaluateThreshold(reading.value, rule.threshold_operator, rule.threshold_value)) {
                continue;
              }

              vitalTypesBreached.add(reading.vital_type);

              // Check cooldown — no recent alert of same type for this patient
              const { data: recentAlerts } = await supabase
                .from('guardian_alerts')
                .select('id')
                .eq('reference_id', patientId)
                .eq('alert_type', rule.alert_type)
                .eq('reference_type', 'patient')
                .gte('triggered_at', new Date(now.getTime() - rule.cooldown_minutes * 60 * 1000).toISOString())
                .limit(1);

              if (recentAlerts && recentAlerts.length > 0) continue;

              // Create alert
              const { error: alertErr } = await supabase
                .from('guardian_alerts')
                .insert({
                  tenant_id: tenantId,
                  alert_type: rule.alert_type,
                  severity: rule.severity,
                  title: `${rule.rule_name}: ${reading.value} ${reading.vital_type}`,
                  description: `${rule.vital_type} reading of ${reading.value} breached threshold (${rule.threshold_operator} ${rule.threshold_value}). Source: ${reading.source}. Recorded at ${reading.recorded_at}.`,
                  reference_type: 'patient',
                  reference_id: patientId,
                  status: 'pending',
                  escalation_level: rule.escalation_level,
                  escalation_targets: rule.escalation_targets,
                  triggered_at: now.toISOString(),
                  metadata: {
                    rule_id: rule.id,
                    rule_name: rule.rule_name,
                    vital_type: rule.vital_type,
                    vital_value: reading.value,
                    threshold_operator: rule.threshold_operator,
                    threshold_value: rule.threshold_value,
                    source: reading.source,
                    enrollment_id: enrollment.id,
                  },
                });

              if (alertErr) {
                result.errors.push(`Alert insert failed for patient ${patientId}: ${alertErr.message}`);
              } else {
                result.alerts_created++;
              }
            }
          }

          // Auto-resolve: for vital types that are all normal, resolve active alerts
          for (const vitalType of vitalTypesChecked) {
            if (vitalTypesBreached.has(vitalType)) continue;

            const vitalAlertTypes = applicableRules
              .filter((r) => r.vital_type === vitalType && r.auto_resolve)
              .map((r) => r.alert_type);

            if (vitalAlertTypes.length === 0) continue;

            const { data: activeAlerts } = await supabase
              .from('guardian_alerts')
              .select('id, alert_type')
              .eq('reference_id', patientId)
              .eq('reference_type', 'patient')
              .in('alert_type', vitalAlertTypes)
              .eq('status', 'pending');

            for (const alert of activeAlerts || []) {
              const { error: resolveErr } = await supabase
                .from('guardian_alerts')
                .update({
                  status: 'resolved',
                  resolved_at: now.toISOString(),
                  resolution_notes: `Auto-resolved: ${vitalType} readings returned to normal range`,
                })
                .eq('id', alert.id);

              if (resolveErr) {
                result.errors.push(`Failed to resolve alert ${alert.id}: ${resolveErr.message}`);
              } else {
                result.alerts_resolved++;
              }
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Error processing patient ${enrollment.patient_id}: ${msg}`);
        }
      }
    }

    // Audit log the monitor run
    await supabase.from('audit_logs').insert({
      event_type: 'VITAL_THRESHOLD_MONITOR_RUN',
      event_data: {
        patients_checked: result.patients_checked,
        alerts_created: result.alerts_created,
        alerts_resolved: result.alerts_resolved,
        errors_count: result.errors.length,
      },
    });

    return new Response(
      JSON.stringify({ success: true, result, timestamp: now.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
