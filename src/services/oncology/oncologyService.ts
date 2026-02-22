/**
 * =====================================================
 * ONCOLOGY SERVICE
 * =====================================================
 * Purpose: CRUD operations for comprehensive cancer care management
 * Tables: onc_cancer_registry, onc_staging, onc_treatment_plans,
 *   onc_chemotherapy_sessions, onc_radiation_sessions, onc_side_effects,
 *   onc_lab_monitoring, onc_imaging_results, onc_survivorship
 * =====================================================
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type {
  OncCancerRegistry,
  OncStaging,
  OncTreatmentPlan,
  OncChemotherapySession,
  OncRadiationSession,
  OncSideEffect,
  OncLabMonitoring,
  OncImagingResult,
  OncSurvivorship,
  CreateCancerRegistryRequest,
  CreateStagingRequest,
  CreateTreatmentPlanRequest,
  OncologyDashboardSummary,
  OncAlert,
} from '../../types/oncology';
import {
  isFebrileNeutropenia,
  isTumorMarkerSpike,
} from '../../types/oncology';

export interface OncApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// CANCER REGISTRY
// =====================================================

export class OncologyService {
  /** Register a cancer diagnosis */
  static async createRegistry(
    request: CreateCancerRegistryRequest
  ): Promise<OncApiResponse<OncCancerRegistry>> {
    try {
      const { data, error } = await supabase
        .from('onc_cancer_registry')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          primary_site: request.primary_site,
          histology: request.histology,
          icd10_code: request.icd10_code,
          diagnosis_date: request.diagnosis_date,
          biomarkers: request.biomarkers ?? {},
          ecog_status: request.ecog_status ?? 0,
          treating_oncologist_id: request.treating_oncologist_id ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ONC_REGISTRY_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as OncCancerRegistry };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ONC_REGISTRY_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  /** Get active cancer registry for a patient */
  static async getRegistry(
    patientId: string,
    tenantId: string
  ): Promise<OncApiResponse<OncCancerRegistry>> {
    try {
      const { data, error } = await supabase
        .from('onc_cancer_registry')
        .select('id, patient_id, tenant_id, primary_site, histology, icd10_code, diagnosis_date, biomarkers, ecog_status, status, treating_oncologist_id, notes, created_at, updated_at')
        .eq('patient_id', patientId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active_treatment')
        .order('diagnosis_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as OncCancerRegistry };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ONC_REGISTRY_GET_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // STAGING
  // =====================================================

  /** Record TNM staging */
  static async createStaging(
    request: CreateStagingRequest
  ): Promise<OncApiResponse<OncStaging>> {
    try {
      const { data, error } = await supabase
        .from('onc_staging')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          staging_type: request.staging_type,
          t_stage: request.t_stage,
          n_stage: request.n_stage,
          m_stage: request.m_stage,
          overall_stage: request.overall_stage,
          ajcc_edition: request.ajcc_edition ?? 8,
          staging_basis: request.staging_basis ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ONC_STAGING_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as OncStaging };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ONC_STAGING_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // TREATMENT PLANS
  // =====================================================

  /** Create a treatment plan */
  static async createTreatmentPlan(
    request: CreateTreatmentPlanRequest
  ): Promise<OncApiResponse<OncTreatmentPlan>> {
    try {
      const { data, error } = await supabase
        .from('onc_treatment_plans')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          modalities: request.modalities,
          intent: request.intent,
          regimen_name: request.regimen_name,
          drugs: request.drugs,
          cycle_count: request.cycle_count,
          cycle_length_days: request.cycle_length_days,
          planned_start_date: request.planned_start_date ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('ONC_TREATMENT_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as OncTreatmentPlan };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ONC_TREATMENT_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // DASHBOARD SUMMARY
  // =====================================================

  /** Get comprehensive oncology dashboard data */
  static async getDashboardSummary(
    patientId: string,
    tenantId: string
  ): Promise<OncApiResponse<OncologyDashboardSummary>> {
    try {
      const [
        registryRes,
        stagingRes,
        treatmentRes,
        chemoRes,
        radiationRes,
        labsRes,
        imagingRes,
        sideEffectsRes,
        survivorshipRes,
      ] = await Promise.all([
        supabase.from('onc_cancer_registry').select('id, patient_id, tenant_id, primary_site, histology, icd10_code, diagnosis_date, biomarkers, ecog_status, status, treating_oncologist_id, notes, created_at, updated_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('diagnosis_date', { ascending: false }).limit(1).single(),
        supabase.from('onc_staging').select('id, patient_id, tenant_id, registry_id, staging_date, staging_type, t_stage, n_stage, m_stage, overall_stage, ajcc_edition, staging_basis, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('staging_date', { ascending: false }).limit(1).single(),
        supabase.from('onc_treatment_plans').select('id, patient_id, tenant_id, registry_id, plan_date, modalities, intent, regimen_name, drugs, cycle_count, cycle_length_days, planned_start_date, actual_start_date, status, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('plan_date', { ascending: false }).limit(1).single(),
        supabase.from('onc_chemotherapy_sessions').select('id, patient_id, tenant_id, registry_id, treatment_plan_id, session_date, cycle_number, day_of_cycle, drugs_administered, dose_modifications, bsa_m2, pre_medications, adverse_events_during, vitals_pre, vitals_post, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('session_date', { ascending: false }).limit(5),
        supabase.from('onc_radiation_sessions').select('id, patient_id, tenant_id, registry_id, treatment_plan_id, session_date, fraction_number, total_fractions, dose_per_fraction_gy, cumulative_dose_gy, technique, treatment_site, skin_reaction_grade, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('session_date', { ascending: false }).limit(5),
        supabase.from('onc_lab_monitoring').select('id, patient_id, tenant_id, registry_id, lab_date, wbc, anc, hemoglobin, platelets, creatinine, alt, ast, tumor_marker_name, tumor_marker_value, tumor_marker_unit, baseline_marker_value, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('lab_date', { ascending: false }).limit(1).single(),
        supabase.from('onc_imaging_results').select('id, patient_id, tenant_id, registry_id, imaging_date, modality, body_region, recist_response, target_lesions, sum_of_diameters_mm, baseline_sum_mm, new_lesions, findings, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('imaging_date', { ascending: false }).limit(1).single(),
        supabase.from('onc_side_effects').select('id, patient_id, tenant_id, registry_id, reported_date, ctcae_term, ctcae_grade, ctcae_category, attribution, intervention, outcome, resolved_date, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .in('outcome', ['ongoing', 'resolving'])
          .order('reported_date', { ascending: false }).limit(10),
        supabase.from('onc_survivorship').select('id, patient_id, tenant_id, registry_id, assessment_date, status, remission_date, surveillance_schedule, late_effects, psychosocial_concerns, recurrence_date, recurrence_site, quality_of_life_score, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('assessment_date', { ascending: false }).limit(1).single(),
      ]);

      const registry = registryRes.data as unknown as OncCancerRegistry | null;
      const staging = stagingRes.data as unknown as OncStaging | null;
      const treatmentPlan = treatmentRes.data as unknown as OncTreatmentPlan | null;
      const recentChemo = (chemoRes.data || []) as unknown as OncChemotherapySession[];
      const recentRadiation = (radiationRes.data || []) as unknown as OncRadiationSession[];
      const latestLabs = labsRes.data as unknown as OncLabMonitoring | null;
      const latestImaging = imagingRes.data as unknown as OncImagingResult | null;
      const activeSideEffects = (sideEffectsRes.data || []) as unknown as OncSideEffect[];
      const survivorship = survivorshipRes.data as unknown as OncSurvivorship | null;

      const alerts = OncologyService.generateAlerts(
        latestLabs, activeSideEffects, latestImaging, treatmentPlan
      );

      return {
        success: true,
        data: {
          registry,
          staging,
          treatment_plan: treatmentPlan,
          recent_chemo_sessions: recentChemo,
          recent_radiation_sessions: recentRadiation,
          latest_labs: latestLabs,
          latest_imaging: latestImaging,
          active_side_effects: activeSideEffects,
          survivorship,
          alerts,
        },
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('ONC_DASHBOARD_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // ALERT GENERATION
  // =====================================================

  /** Generate clinical alerts based on latest oncology data */
  static generateAlerts(
    labs: OncLabMonitoring | null,
    sideEffects: OncSideEffect[],
    imaging: OncImagingResult | null,
    treatmentPlan: OncTreatmentPlan | null
  ): OncAlert[] {
    const alerts: OncAlert[] = [];
    const now = new Date().toISOString();

    // Febrile neutropenia (ANC <500 + implied fever context)
    if (labs && isFebrileNeutropenia(labs.anc, 38.5)) {
      alerts.push({
        id: `alert-fn-${labs.id}`,
        type: 'febrile_neutropenia',
        severity: 'critical',
        message: `Febrile neutropenia — ANC ${labs.anc}, initiate neutropenic fever protocol`,
        timestamp: now,
        source_record_id: labs.id,
        acknowledged: false,
      });
    }

    // Severe neutropenia without fever
    if (labs && labs.anc !== null && labs.anc < 500 && !isFebrileNeutropenia(labs.anc, 38.5)) {
      alerts.push({
        id: `alert-neutropenia-${labs.id}`,
        type: 'abnormal_pre_chemo_labs',
        severity: 'high',
        message: `Severe neutropenia — ANC ${labs.anc}, hold chemotherapy pending recovery`,
        timestamp: now,
        source_record_id: labs.id,
        acknowledged: false,
      });
    }

    // CTCAE Grade 4-5 adverse events
    const severeAEs = sideEffects.filter(se => se.ctcae_grade >= 4);
    for (const ae of severeAEs) {
      alerts.push({
        id: `alert-ctcae-${ae.id}`,
        type: 'ctcae_grade_4_5',
        severity: 'critical',
        message: `CTCAE Grade ${ae.ctcae_grade} — ${ae.ctcae_term} (${ae.ctcae_category.replace(/_/g, ' ')})`,
        timestamp: now,
        source_record_id: ae.id,
        acknowledged: false,
      });
    }

    // Tumor marker spike
    if (labs && labs.tumor_marker_value !== null && labs.baseline_marker_value !== null) {
      if (isTumorMarkerSpike(labs.tumor_marker_value, labs.baseline_marker_value)) {
        alerts.push({
          id: `alert-marker-${labs.id}`,
          type: 'tumor_marker_spike',
          severity: 'high',
          message: `${labs.tumor_marker_name} spike: ${labs.tumor_marker_value} ${labs.tumor_marker_unit} (baseline: ${labs.baseline_marker_value})`,
          timestamp: now,
          source_record_id: labs.id,
          acknowledged: false,
        });
      }
    }

    // New metastasis on imaging
    if (imaging && imaging.new_lesions) {
      alerts.push({
        id: `alert-mets-${imaging.id}`,
        type: 'new_metastasis',
        severity: 'high',
        message: `New lesion(s) on ${imaging.modality.toUpperCase()} — ${imaging.body_region}`,
        timestamp: now,
        source_record_id: imaging.id,
        acknowledged: false,
      });
    }

    // Treatment delay
    if (treatmentPlan && treatmentPlan.status === 'active' && treatmentPlan.planned_start_date) {
      const planned = new Date(treatmentPlan.planned_start_date);
      const daysSincePlanned = Math.floor(
        (Date.now() - planned.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSincePlanned > 7 && !treatmentPlan.actual_start_date) {
        alerts.push({
          id: `alert-delay-${treatmentPlan.id}`,
          type: 'treatment_delay',
          severity: 'high',
          message: `Treatment delayed ${daysSincePlanned} days past planned start — ${treatmentPlan.regimen_name}`,
          timestamp: now,
          source_record_id: treatmentPlan.id,
          acknowledged: false,
        });
      }
    }

    // Abnormal pre-chemo labs (anemia, thrombocytopenia)
    if (labs) {
      if (labs.hemoglobin !== null && labs.hemoglobin < 7) {
        alerts.push({
          id: `alert-anemia-${labs.id}`,
          type: 'anemia_severe',
          severity: 'high',
          message: `Severe anemia — Hgb ${labs.hemoglobin} g/dL, consider transfusion`,
          timestamp: now,
          source_record_id: labs.id,
          acknowledged: false,
        });
      }
      if (labs.platelets !== null && labs.platelets < 20000) {
        alerts.push({
          id: `alert-plt-${labs.id}`,
          type: 'thrombocytopenia_severe',
          severity: 'high',
          message: `Severe thrombocytopenia — PLT ${labs.platelets}, hold chemotherapy`,
          timestamp: now,
          source_record_id: labs.id,
          acknowledged: false,
        });
      }
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }
}
