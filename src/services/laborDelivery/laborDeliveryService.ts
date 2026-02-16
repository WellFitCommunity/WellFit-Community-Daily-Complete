/**
 * LABOR & DELIVERY SERVICE — CRUD operations for maternal-fetal care
 * Tables: ld_pregnancies, ld_prenatal_visits, ld_labor_events, ld_fetal_monitoring,
 *   ld_delivery_records, ld_newborn_assessments, ld_postpartum_assessments,
 *   ld_medication_administrations, ld_risk_assessments
 */

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type {
  LDPregnancy,
  LDPrenatalVisit,
  LDLaborEvent,
  LDFetalMonitoring,
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDPostpartumAssessment,
  LDMedicationAdministration,
  LDRiskAssessment,
  CreatePregnancyRequest,
  CreatePrenatalVisitRequest,
  CreateDeliveryRecordRequest,
  CreateLaborEventRequest,
  CreateFetalMonitoringRequest,
  CreateNewbornAssessmentRequest,
  CreatePostpartumAssessmentRequest,
  CreateMedicationAdminRequest,
  CreateRiskAssessmentRequest,
  LDDashboardSummary,
  LDAlert,
  LDAlertType,
  LDAlertSeverity,
} from '../../types/laborDelivery';
import { generateLDAlerts } from './laborDeliveryAlerts';
import { LDAlertService } from './laborDeliveryAlertService';
import type { LDPersistedAlert } from './laborDeliveryAlertService';

export interface LDApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Map persisted alerts (DB rows) back to the LDAlert display interface */
function mapPersistedToAlerts(persisted: LDPersistedAlert[]): LDAlert[] {
  return persisted.map((p) => ({
    id: p.id,
    type: p.alert_type as LDAlertType,
    severity: p.severity as LDAlertSeverity,
    message: p.message,
    timestamp: p.created_at,
    source_record_id: p.source_record_id,
    acknowledged: p.acknowledged,
  }));
}

export class LaborDeliveryService {
  // =====================================================
  // PREGNANCY REGISTRY
  // =====================================================

  /** Register a new pregnancy */
  static async createPregnancy(
    request: CreatePregnancyRequest
  ): Promise<LDApiResponse<LDPregnancy>> {
    try {
      const { data, error } = await supabase
        .from('ld_pregnancies')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          gravida: request.gravida,
          para: request.para,
          ab: request.ab ?? 0,
          living: request.living ?? 0,
          edd: request.edd,
          lmp: request.lmp ?? null,
          blood_type: request.blood_type,
          rh_factor: request.rh_factor,
          gbs_status: request.gbs_status ?? 'unknown',
          risk_level: request.risk_level ?? 'low',
          risk_factors: request.risk_factors ?? [],
          primary_provider_id: request.primary_provider_id ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_PREGNANCY_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as LDPregnancy };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_PREGNANCY_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  /** Get active pregnancy for a patient */
  static async getActivePregnancy(
    patientId: string,
    tenantId: string
  ): Promise<LDApiResponse<LDPregnancy>> {
    try {
      const { data, error } = await supabase
        .from('ld_pregnancies')
        .select('*')
        .eq('patient_id', patientId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as unknown as LDPregnancy };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_PREGNANCY_GET_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // PRENATAL VISITS
  // =====================================================

  /** Record a prenatal visit */
  static async createPrenatalVisit(
    request: CreatePrenatalVisitRequest
  ): Promise<LDApiResponse<LDPrenatalVisit>> {
    try {
      const { data, error } = await supabase
        .from('ld_prenatal_visits')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          visit_date: request.visit_date,
          provider_id: request.provider_id ?? null,
          gestational_age_weeks: request.gestational_age_weeks,
          gestational_age_days: request.gestational_age_days,
          fundal_height_cm: request.fundal_height_cm ?? null,
          fetal_heart_rate: request.fetal_heart_rate ?? null,
          weight_kg: request.weight_kg,
          bp_systolic: request.bp_systolic,
          bp_diastolic: request.bp_diastolic,
          cervical_dilation_cm: request.cervical_dilation_cm ?? null,
          cervical_effacement_percent: request.cervical_effacement_percent ?? null,
          complaints: request.complaints ?? [],
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_PRENATAL_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as LDPrenatalVisit };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_PRENATAL_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // DELIVERY RECORD
  // =====================================================

  /** Record a delivery */
  static async createDeliveryRecord(
    request: CreateDeliveryRecordRequest
  ): Promise<LDApiResponse<LDDeliveryRecord>> {
    try {
      const { data, error } = await supabase
        .from('ld_delivery_records')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          delivery_datetime: request.delivery_datetime,
          delivery_provider_id: request.delivery_provider_id ?? null,
          method: request.method,
          anesthesia: request.anesthesia,
          labor_duration_hours: request.labor_duration_hours ?? null,
          estimated_blood_loss_ml: request.estimated_blood_loss_ml,
          complications: request.complications ?? [],
          cord_clamping: request.cord_clamping ?? 'delayed_60s',
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_DELIVERY_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }

      return { success: true, data: data as unknown as LDDeliveryRecord };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_DELIVERY_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // LABOR EVENTS
  // =====================================================

  /** Record a labor progression event */
  static async createLaborEvent(
    request: CreateLaborEventRequest
  ): Promise<LDApiResponse<LDLaborEvent>> {
    try {
      const { data, error } = await supabase
        .from('ld_labor_events')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          event_time: request.event_time,
          stage: request.stage,
          dilation_cm: request.dilation_cm,
          effacement_percent: request.effacement_percent,
          station: request.station,
          contraction_frequency_per_10min: request.contraction_frequency_per_10min ?? null,
          contraction_duration_seconds: request.contraction_duration_seconds ?? null,
          contraction_intensity: request.contraction_intensity ?? null,
          membrane_status: request.membrane_status,
          membrane_rupture_time: request.membrane_rupture_time ?? null,
          fluid_color: request.fluid_color ?? null,
          maternal_bp_systolic: request.maternal_bp_systolic ?? null,
          maternal_bp_diastolic: request.maternal_bp_diastolic ?? null,
          maternal_hr: request.maternal_hr ?? null,
          maternal_temp_c: request.maternal_temp_c ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_LABOR_EVENT_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDLaborEvent };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_LABOR_EVENT_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // FETAL MONITORING
  // =====================================================

  /** Record a fetal monitoring assessment */
  static async createFetalMonitoring(
    request: CreateFetalMonitoringRequest
  ): Promise<LDApiResponse<LDFetalMonitoring>> {
    try {
      const { data, error } = await supabase
        .from('ld_fetal_monitoring')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          assessment_time: request.assessment_time,
          assessed_by: request.assessed_by ?? null,
          fhr_baseline: request.fhr_baseline,
          variability: request.variability,
          accelerations_present: request.accelerations_present,
          deceleration_type: request.deceleration_type,
          deceleration_depth_bpm: request.deceleration_depth_bpm ?? null,
          fhr_category: request.fhr_category,
          uterine_activity: request.uterine_activity ?? null,
          interpretation: request.interpretation ?? null,
          action_taken: request.action_taken ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_FETAL_MONITORING_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDFetalMonitoring };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_FETAL_MONITORING_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // NEWBORN ASSESSMENT
  // =====================================================

  /** Record newborn assessment */
  static async createNewbornAssessment(
    request: CreateNewbornAssessmentRequest
  ): Promise<LDApiResponse<LDNewbornAssessment>> {
    try {
      const { data, error } = await supabase
        .from('ld_newborn_assessments')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          delivery_id: request.delivery_id,
          birth_datetime: request.birth_datetime,
          sex: request.sex,
          weight_g: request.weight_g,
          length_cm: request.length_cm,
          head_circumference_cm: request.head_circumference_cm,
          apgar_1_min: request.apgar_1_min,
          apgar_5_min: request.apgar_5_min,
          apgar_10_min: request.apgar_10_min ?? null,
          ballard_gestational_age_weeks: request.ballard_gestational_age_weeks ?? null,
          temperature_c: request.temperature_c ?? null,
          heart_rate: request.heart_rate ?? null,
          respiratory_rate: request.respiratory_rate ?? null,
          disposition: request.disposition,
          anomalies: request.anomalies ?? [],
          vitamin_k_given: request.vitamin_k_given ?? false,
          erythromycin_given: request.erythromycin_given ?? false,
          hepatitis_b_vaccine: request.hepatitis_b_vaccine ?? false,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_NEWBORN_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDNewbornAssessment };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_NEWBORN_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // POSTPARTUM ASSESSMENT
  // =====================================================

  /** Record postpartum assessment */
  static async createPostpartumAssessment(
    request: CreatePostpartumAssessmentRequest
  ): Promise<LDApiResponse<LDPostpartumAssessment>> {
    try {
      const { data, error } = await supabase
        .from('ld_postpartum_assessments')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          assessment_datetime: new Date().toISOString(),
          assessed_by: request.assessed_by ?? null,
          hours_postpartum: request.hours_postpartum,
          fundal_height: request.fundal_height,
          fundal_firmness: request.fundal_firmness,
          lochia: request.lochia,
          lochia_amount: request.lochia_amount,
          bp_systolic: request.bp_systolic,
          bp_diastolic: request.bp_diastolic,
          heart_rate: request.heart_rate,
          temperature_c: request.temperature_c,
          breastfeeding_status: request.breastfeeding_status,
          lactation_notes: request.lactation_notes ?? null,
          pain_score: request.pain_score,
          pain_location: request.pain_location ?? null,
          emotional_status: request.emotional_status,
          epds_score: request.epds_score ?? null,
          voiding: request.voiding ?? false,
          bowel_movement: request.bowel_movement ?? false,
          incision_intact: request.incision_intact ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_POSTPARTUM_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDPostpartumAssessment };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_POSTPARTUM_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // DASHBOARD SUMMARY
  // =====================================================

  /** Get comprehensive L&D dashboard data */
  static async getDashboardSummary(
    patientId: string,
    tenantId: string
  ): Promise<LDApiResponse<LDDashboardSummary>> {
    try {
      const [
        pregRes, prenatalRes, laborRes, fetalRes,
        deliveryRes, newbornRes, postpartumRes,
        medsRes, riskRes,
      ] = await Promise.all([
        supabase.from('ld_pregnancies').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('ld_prenatal_visits').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('visit_date', { ascending: false }).limit(10),
        supabase.from('ld_labor_events').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('event_time', { ascending: true }).limit(50),
        supabase.from('ld_fetal_monitoring').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('assessment_time', { ascending: false }).limit(1).single(),
        supabase.from('ld_delivery_records').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('delivery_datetime', { ascending: false }).limit(1).single(),
        supabase.from('ld_newborn_assessments').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('birth_datetime', { ascending: false }).limit(1).single(),
        supabase.from('ld_postpartum_assessments').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('assessment_datetime', { ascending: false }).limit(1).single(),
        supabase.from('ld_medication_administrations').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('administered_datetime', { ascending: false }).limit(20),
        supabase.from('ld_risk_assessments').select('*')
          .eq('patient_id', patientId).eq('tenant_id', tenantId)
          .order('assessment_date', { ascending: false }).limit(1).single(),
      ]);

      const pregnancy = pregRes.data as unknown as LDPregnancy | null;
      const prenatalVisits = (prenatalRes.data || []) as unknown as LDPrenatalVisit[];
      const laborEvents = (laborRes.data || []) as unknown as LDLaborEvent[];
      const fetalMonitoring = fetalRes.data as unknown as LDFetalMonitoring | null;
      const delivery = deliveryRes.data as unknown as LDDeliveryRecord | null;
      const newborn = newbornRes.data as unknown as LDNewbornAssessment | null;
      const postpartum = postpartumRes.data as unknown as LDPostpartumAssessment | null;
      const medications = (medsRes.data || []) as unknown as LDMedicationAdministration[];
      const riskAssessment = riskRes.data as unknown as LDRiskAssessment | null;

      // Compute alerts from clinical data
      const computedAlerts = generateLDAlerts(
        pregnancy, prenatalVisits, fetalMonitoring, delivery, newborn, postpartum
      );

      // Sync computed alerts to DB and fetch persisted (includes acknowledge/resolve state)
      let alerts = computedAlerts;
      if (pregnancy) {
        await LDAlertService.syncAlerts(computedAlerts, patientId, tenantId, pregnancy.id);
        const persistedResult = await LDAlertService.getActiveAlerts(patientId, tenantId);
        if (persistedResult.success && persistedResult.data) {
          alerts = mapPersistedToAlerts(persistedResult.data);
        }
      }

      return {
        success: true,
        data: {
          pregnancy,
          recent_prenatal_visits: prenatalVisits,
          labor_events: laborEvents,
          latest_fetal_monitoring: fetalMonitoring,
          delivery_record: delivery,
          newborn_assessment: newborn,
          latest_postpartum: postpartum,
          medications,
          latest_risk_assessment: riskAssessment,
          alerts,
        },
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_DASHBOARD_ERROR', error, { patientId });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // MEDICATION ADMINISTRATION
  // =====================================================

  /** Record L&D medication administration */
  static async createMedicationAdministration(
    request: CreateMedicationAdminRequest
  ): Promise<LDApiResponse<LDMedicationAdministration>> {
    try {
      const { data, error } = await supabase
        .from('ld_medication_administrations')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          administered_datetime: request.administered_datetime,
          administered_by: request.administered_by ?? null,
          medication_name: request.medication_name,
          dose: request.dose,
          route: request.route,
          indication: request.indication,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_MEDICATION_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDMedicationAdministration };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_MEDICATION_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // RISK ASSESSMENT
  // =====================================================

  /** Record a maternal risk assessment */
  static async createRiskAssessment(
    request: CreateRiskAssessmentRequest
  ): Promise<LDApiResponse<LDRiskAssessment>> {
    try {
      const { data, error } = await supabase
        .from('ld_risk_assessments')
        .insert({
          patient_id: request.patient_id,
          tenant_id: request.tenant_id,
          pregnancy_id: request.pregnancy_id,
          assessed_by: request.assessed_by ?? null,
          risk_level: request.risk_level,
          risk_factors: request.risk_factors,
          score: request.score ?? null,
          scoring_system: request.scoring_system ?? null,
          notes: request.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        await auditLogger.error('LD_RISK_CREATE_FAILED',
          new Error(error.message), { patientId: request.patient_id });
        return { success: false, error: error.message };
      }
      return { success: true, data: data as unknown as LDRiskAssessment };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('LD_RISK_CREATE_ERROR', error, {
        patientId: request.patient_id,
      });
      return { success: false, error: error.message };
    }
  }

}
