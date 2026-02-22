/**
 * =====================================================
 * CARDIOLOGY SERVICE
 * =====================================================
 * Purpose: CRUD operations for cardiac care management
 * Tables: card_patient_registry, card_ecg_results, card_echo_results,
 *   card_stress_tests, card_cath_reports, card_heart_failure,
 *   card_arrhythmia_events, card_device_monitoring, card_cardiac_rehab
 * =====================================================
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type {
  CardPatientRegistry,
  CardEcgResult,
  CardEchoResult,
  CardStressTest,
  CardHeartFailure,
  CardArrhythmiaEvent,
  CardDeviceMonitoring,
  CardCardiacRehab,
  CreateCardRegistryRequest,
  CreateEcgResultRequest,
  CreateEchoResultRequest,
  CreateHeartFailureRequest,
  CreateDeviceCheckRequest,
  CardiologyDashboardSummary,
  CardiacAlert,
  RehabProgress,
} from '../../types/cardiology';
import {
  interpretLVEF,
  interpretBNP,
  getWeightChangeAlert,
} from '../../types/cardiology';

export interface CardioApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =====================================================
// PATIENT REGISTRY
// =====================================================

export class CardiologyService {
  /** Enroll a patient in cardiac care */
  static async createRegistry(
    request: CreateCardRegistryRequest
  ): Promise<CardioApiResponse<CardPatientRegistry>> {
    try {
      const { data, error } = await supabase
        .from('card_patient_registry')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          conditions: request.conditions,
          risk_factors: request.risk_factors,
          nyha_class: request.nyha_class ?? null,
          lvef_percent: request.lvef_percent ?? null,
          cha2ds2_vasc_score: request.cha2ds2_vasc_score ?? null,
          primary_cardiologist_id: request.primary_cardiologist_id ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CARD_REGISTRY_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardPatientRegistry };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_REGISTRY_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  /** Get cardiac registry for a patient */
  static async getRegistry(
    patientId: string,
    tenantId: string
  ): Promise<CardioApiResponse<CardPatientRegistry>> {
    try {
      const { data, error } = await supabase
        .from('card_patient_registry')
        .select('id, patient_id, tenant_id, conditions, risk_factors, nyha_class, lvef_percent, cha2ds2_vasc_score, has_score, enrolled_date, status, primary_cardiologist_id, notes, created_at, updated_at')
        .eq('patient_id', patientId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('enrolled_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardPatientRegistry };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_REGISTRY_GET_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // ECG RESULTS
  // =====================================================

  /** Record an ECG result */
  static async createEcgResult(
    request: CreateEcgResultRequest
  ): Promise<CardioApiResponse<CardEcgResult>> {
    try {
      const { data, error } = await supabase
        .from('card_ecg_results')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          performed_date: request.performed_date,
          performed_by: request.performed_by ?? null,
          rhythm: request.rhythm,
          heart_rate: request.heart_rate,
          pr_interval_ms: request.pr_interval_ms ?? null,
          qrs_duration_ms: request.qrs_duration_ms ?? null,
          qtc_ms: request.qtc_ms ?? null,
          axis_degrees: request.axis_degrees ?? null,
          st_changes: request.st_changes,
          is_stemi: request.is_stemi,
          interpretation: request.interpretation ?? null,
          is_normal: request.is_normal,
          findings: request.findings ?? [],
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CARD_ECG_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardEcgResult };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_ECG_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  /** Get ECG history for a patient */
  static async getEcgHistory(
    patientId: string,
    tenantId: string,
    limit = 10
  ): Promise<CardioApiResponse<CardEcgResult[]>> {
    try {
      const { data, error } = await supabase
        .from('card_ecg_results')
        .select('id, patient_id, tenant_id, registry_id, performed_date, performed_by, rhythm, heart_rate, pr_interval_ms, qrs_duration_ms, qtc_ms, axis_degrees, st_changes, is_stemi, interpretation, is_normal, findings, created_at')
        .eq('patient_id', patientId)
        .eq('tenant_id', tenantId)
        .order('performed_date', { ascending: false })
        .limit(limit);

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data || []) as unknown as CardEcgResult[] };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_ECG_HISTORY_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // ECHO RESULTS
  // =====================================================

  /** Record an echocardiogram result */
  static async createEchoResult(
    request: CreateEchoResultRequest
  ): Promise<CardioApiResponse<CardEchoResult>> {
    try {
      const { data, error } = await supabase
        .from('card_echo_results')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          performed_date: request.performed_date,
          performed_by: request.performed_by ?? null,
          lvef_percent: request.lvef_percent,
          rv_function: request.rv_function,
          lv_end_diastolic_diameter_mm: request.lv_end_diastolic_diameter_mm ?? null,
          lv_end_systolic_diameter_mm: request.lv_end_systolic_diameter_mm ?? null,
          wall_motion_abnormalities: request.wall_motion_abnormalities ?? [],
          valve_results: request.valve_results ?? [],
          pericardial_effusion: request.pericardial_effusion ?? false,
          diastolic_function: request.diastolic_function ?? null,
          interpretation: request.interpretation ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CARD_ECHO_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardEchoResult };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_ECHO_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // HEART FAILURE
  // =====================================================

  /** Record a heart failure assessment */
  static async createHeartFailureAssessment(
    request: CreateHeartFailureRequest
  ): Promise<CardioApiResponse<CardHeartFailure>> {
    try {
      const { data, error } = await supabase
        .from('card_heart_failure')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          assessed_by: request.assessed_by ?? null,
          nyha_class: request.nyha_class,
          bnp_pg_ml: request.bnp_pg_ml ?? null,
          nt_pro_bnp_pg_ml: request.nt_pro_bnp_pg_ml ?? null,
          daily_weight_kg: request.daily_weight_kg,
          previous_weight_kg: request.previous_weight_kg ?? null,
          fluid_status: request.fluid_status,
          edema_grade: request.edema_grade,
          dyspnea_at_rest: request.dyspnea_at_rest,
          orthopnea: request.orthopnea,
          pnd: request.pnd,
          jugular_venous_distension: request.jugular_venous_distension,
          crackles: request.crackles,
          s3_gallop: request.s3_gallop,
          fluid_restriction_ml: request.fluid_restriction_ml ?? null,
          sodium_restriction_mg: request.sodium_restriction_mg ?? null,
          diuretic_adjustment: request.diuretic_adjustment ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CARD_HF_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardHeartFailure };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_HF_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // DEVICE MONITORING
  // =====================================================

  /** Record a device interrogation */
  static async createDeviceCheck(
    request: CreateDeviceCheckRequest
  ): Promise<CardioApiResponse<CardDeviceMonitoring>> {
    try {
      const { data, error } = await supabase
        .from('card_device_monitoring')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          registry_id: request.registry_id,
          device_type: request.device_type,
          device_manufacturer: request.device_manufacturer ?? null,
          device_model: request.device_model ?? null,
          implant_date: request.implant_date ?? null,
          checked_by: request.checked_by ?? null,
          battery_status: request.battery_status,
          battery_voltage: request.battery_voltage ?? null,
          battery_longevity_months: request.battery_longevity_months ?? null,
          atrial_pacing_percent: request.atrial_pacing_percent ?? null,
          ventricular_pacing_percent: request.ventricular_pacing_percent ?? null,
          lead_impedance_atrial_ohms: request.lead_impedance_atrial_ohms ?? null,
          lead_impedance_ventricular_ohms: request.lead_impedance_ventricular_ohms ?? null,
          shocks_delivered: request.shocks_delivered,
          anti_tachycardia_pacing_events: request.anti_tachycardia_pacing_events,
          atrial_arrhythmia_burden_percent: request.atrial_arrhythmia_burden_percent ?? null,
          alerts: request.alerts ?? [],
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('CARD_DEVICE_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as CardDeviceMonitoring };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_DEVICE_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // DASHBOARD SUMMARY
  // =====================================================

  /** Get comprehensive dashboard data for a patient */
  static async getDashboardSummary(
    patientId: string,
    tenantId: string
  ): Promise<CardioApiResponse<CardiologyDashboardSummary>> {
    try {
      // Fetch all data in parallel
      const [
        registryRes,
        ecgRes,
        echoRes,
        stressRes,
        hfRes,
        deviceRes,
        rehabRes,
        arrhythmiaRes,
      ] = await Promise.all([
        supabase.from('card_patient_registry').select('id, patient_id, tenant_id, conditions, risk_factors, nyha_class, lvef_percent, cha2ds2_vasc_score, has_score, enrolled_date, status, primary_cardiologist_id, notes, created_at, updated_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .eq('status', 'active').limit(1).single(),
        supabase.from('card_ecg_results').select('id, patient_id, tenant_id, registry_id, performed_date, performed_by, rhythm, heart_rate, pr_interval_ms, qrs_duration_ms, qtc_ms, axis_degrees, st_changes, is_stemi, interpretation, is_normal, findings, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('performed_date', { ascending: false }).limit(1).single(),
        supabase.from('card_echo_results').select('id, patient_id, tenant_id, registry_id, performed_date, performed_by, lvef_percent, rv_function, lv_end_diastolic_diameter_mm, lv_end_systolic_diameter_mm, lv_mass_index, wall_motion_abnormalities, valve_results, pericardial_effusion, diastolic_function, interpretation, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('performed_date', { ascending: false }).limit(1).single(),
        supabase.from('card_stress_tests').select('id, patient_id, tenant_id, registry_id, performed_date, performed_by, protocol, duration_min, max_heart_rate, target_heart_rate, percent_target_achieved, mets_achieved, duke_score, is_positive, ischemic_changes, arrhythmias_during, symptoms_during, bp_peak_systolic, bp_peak_diastolic, findings, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('performed_date', { ascending: false }).limit(1).single(),
        supabase.from('card_heart_failure').select('id, patient_id, tenant_id, registry_id, assessment_date, assessed_by, nyha_class, bnp_pg_ml, nt_pro_bnp_pg_ml, daily_weight_kg, previous_weight_kg, weight_change_kg, fluid_status, edema_grade, dyspnea_at_rest, orthopnea, pnd, jugular_venous_distension, crackles, s3_gallop, fluid_restriction_ml, sodium_restriction_mg, diuretic_adjustment, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('assessment_date', { ascending: false }).limit(1).single(),
        supabase.from('card_device_monitoring').select('id, patient_id, tenant_id, registry_id, device_type, device_manufacturer, device_model, implant_date, check_date, checked_by, battery_status, battery_voltage, battery_longevity_months, atrial_pacing_percent, ventricular_pacing_percent, lead_impedance_atrial_ohms, lead_impedance_ventricular_ohms, sensing_atrial_mv, sensing_ventricular_mv, threshold_atrial_v, threshold_ventricular_v, shocks_delivered, anti_tachycardia_pacing_events, atrial_arrhythmia_burden_percent, alerts, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('check_date', { ascending: false }).limit(1).single(),
        supabase.from('card_cardiac_rehab').select('id, patient_id, tenant_id, registry_id, phase, session_date, session_number, total_sessions_prescribed, exercise_type, duration_min, peak_heart_rate, target_heart_rate, resting_bp_systolic, resting_bp_diastolic, mets_achieved, rpe_score, symptoms_during, functional_improvement_notes, completed, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('session_date', { ascending: false }).limit(10),
        supabase.from('card_arrhythmia_events').select('id, patient_id, tenant_id, registry_id, event_date, detected_by, type, duration_seconds, heart_rate_during, hemodynamically_stable, symptoms, treatment_given, cardioversion_performed, notes, created_at')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('event_date', { ascending: false }).limit(5),
      ]);

      const registry = registryRes.data as unknown as CardPatientRegistry | null;
      const latestEcg = ecgRes.data as unknown as CardEcgResult | null;
      const latestEcho = echoRes.data as unknown as CardEchoResult | null;
      const latestStress = stressRes.data as unknown as CardStressTest | null;
      const latestHf = hfRes.data as unknown as CardHeartFailure | null;
      const latestDevice = deviceRes.data as unknown as CardDeviceMonitoring | null;
      const rehabSessions = (rehabRes.data || []) as unknown as CardCardiacRehab[];
      const recentArrhythmias = (arrhythmiaRes.data || []) as unknown as CardArrhythmiaEvent[];

      // Calculate rehab progress
      let rehabProgress: RehabProgress | null = null;
      if (rehabSessions.length > 0) {
        const latest = rehabSessions[0];
        rehabProgress = {
          phase: latest.phase,
          sessions_completed: latest.session_number,
          total_sessions: latest.total_sessions_prescribed,
          completion_percent: Math.round((latest.session_number / latest.total_sessions_prescribed) * 100),
          latest_mets: latest.mets_achieved,
        };
      }

      // Generate alerts
      const alerts = CardiologyService.generateAlerts(
        latestEcg, latestEcho, latestHf, latestDevice, recentArrhythmias
      );

      return {
        success: true,
        data: {
          registry,
          latest_ecg: latestEcg,
          latest_echo: latestEcho,
          latest_stress_test: latestStress,
          latest_hf_assessment: latestHf,
          latest_device_check: latestDevice,
          rehab_progress: rehabProgress,
          recent_arrhythmias: recentArrhythmias,
          alerts,
        },
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('CARD_DASHBOARD_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // ALERT GENERATION
  // =====================================================

  /** Generate clinical alerts based on latest cardiology data */
  static generateAlerts(
    ecg: CardEcgResult | null,
    echo: CardEchoResult | null,
    hf: CardHeartFailure | null,
    device: CardDeviceMonitoring | null,
    arrhythmias: CardArrhythmiaEvent[]
  ): CardiacAlert[] {
    const alerts: CardiacAlert[] = [];
    const now = new Date().toISOString();

    // STEMI detected
    if (ecg?.is_stemi) {
      alerts.push({
        id: `alert-stemi-${ecg.id}`,
        type: 'stemi_detected',
        severity: 'critical',
        message: 'STEMI detected on ECG — activate cath lab protocol',
        timestamp: now,
        source_record_id: ecg.id,
        acknowledged: false,
      });
    }

    // EF critically low
    if (echo && echo.lvef_percent < 20) {
      alerts.push({
        id: `alert-ef-${echo.id}`,
        type: 'low_ef',
        severity: 'critical',
        message: `EF ${echo.lvef_percent}% — ${interpretLVEF(echo.lvef_percent)}`,
        timestamp: now,
        source_record_id: echo.id,
        acknowledged: false,
      });
    }

    // New AFib with RVR
    if (arrhythmias.length > 0) {
      const afibRvr = arrhythmias.find(
        a => a.type === 'atrial_fibrillation' && (a.heart_rate_during ?? 0) > 100
      );
      if (afibRvr) {
        alerts.push({
          id: `alert-afib-${afibRvr.id}`,
          type: 'new_afib_rvr',
          severity: 'high',
          message: `AFib with RVR (HR ${afibRvr.heart_rate_during})`,
          timestamp: now,
          source_record_id: afibRvr.id,
          acknowledged: false,
        });
      }
    }

    // BNP elevated
    if (hf?.bnp_pg_ml && hf.bnp_pg_ml > 1000) {
      alerts.push({
        id: `alert-bnp-${hf.id}`,
        type: 'bnp_elevated',
        severity: 'high',
        message: `BNP ${hf.bnp_pg_ml} pg/mL — ${interpretBNP(hf.bnp_pg_ml)}`,
        timestamp: now,
        source_record_id: hf.id,
        acknowledged: false,
      });
    }

    // Weight gain (HF decompensation)
    if (hf?.weight_change_kg) {
      const weightAlertLevel = getWeightChangeAlert(hf.weight_change_kg);
      if (weightAlertLevel) {
        const changeLbs = (hf.weight_change_kg * 2.205).toFixed(1);
        alerts.push({
          id: `alert-weight-${hf.id}`,
          type: 'hf_decompensation',
          severity: weightAlertLevel,
          message: `Weight gain +${changeLbs} lbs — possible HF decompensation`,
          timestamp: now,
          source_record_id: hf.id,
          acknowledged: false,
        });
      }
    }

    // Symptomatic bradycardia
    if (ecg && ecg.heart_rate < 50 && ecg.rhythm === 'sinus_bradycardia') {
      alerts.push({
        id: `alert-brady-${ecg.id}`,
        type: 'symptomatic_bradycardia',
        severity: 'high',
        message: `Symptomatic bradycardia — HR ${ecg.heart_rate}`,
        timestamp: now,
        source_record_id: ecg.id,
        acknowledged: false,
      });
    }

    // Device alerts
    if (device?.battery_status === 'end_of_life') {
      alerts.push({
        id: `alert-device-${device.id}`,
        type: 'device_alert',
        severity: 'high',
        message: `${device.device_type.toUpperCase()} battery end of life — replacement needed`,
        timestamp: now,
        source_record_id: device.id,
        acknowledged: false,
      });
    }

    if (device && device.shocks_delivered > 0) {
      alerts.push({
        id: `alert-shocks-${device.id}`,
        type: 'device_alert',
        severity: 'high',
        message: `ICD delivered ${device.shocks_delivered} shock(s) since last check`,
        timestamp: now,
        source_record_id: device.id,
        acknowledged: false,
      });
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }
}
