/**
 * =====================================================
 * LABOR & DELIVERY SERVICE
 * =====================================================
 * Purpose: CRUD operations for maternal-fetal care
 * Tables: ld_pregnancies, ld_prenatal_visits, ld_labor_events,
 *   ld_fetal_monitoring, ld_delivery_records, ld_newborn_assessments,
 *   ld_postpartum_assessments, ld_medication_administrations, ld_risk_assessments
 * =====================================================
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
  CreatePregnancyRequest,
  CreatePrenatalVisitRequest,
  CreateDeliveryRecordRequest,
  LDDashboardSummary,
  LDAlert,
} from '../../types/laborDelivery';
import { interpretAPGAR, isSeverePreeclampsia } from '../../types/laborDelivery';

export interface LDApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
  // DASHBOARD SUMMARY
  // =====================================================

  /** Get comprehensive L&D dashboard data */
  static async getDashboardSummary(
    patientId: string,
    tenantId: string
  ): Promise<LDApiResponse<LDDashboardSummary>> {
    try {
      const [
        pregRes,
        prenatalRes,
        laborRes,
        fetalRes,
        deliveryRes,
        newbornRes,
        postpartumRes,
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
      ]);

      const pregnancy = pregRes.data as unknown as LDPregnancy | null;
      const prenatalVisits = (prenatalRes.data || []) as unknown as LDPrenatalVisit[];
      const laborEvents = (laborRes.data || []) as unknown as LDLaborEvent[];
      const fetalMonitoring = fetalRes.data as unknown as LDFetalMonitoring | null;
      const delivery = deliveryRes.data as unknown as LDDeliveryRecord | null;
      const newborn = newbornRes.data as unknown as LDNewbornAssessment | null;
      const postpartum = postpartumRes.data as unknown as LDPostpartumAssessment | null;

      const alerts = LaborDeliveryService.generateAlerts(
        pregnancy, prenatalVisits, fetalMonitoring, delivery, newborn, postpartum
      );

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
  // ALERT GENERATION
  // =====================================================

  /** Generate L&D clinical alerts */
  static generateAlerts(
    pregnancy: LDPregnancy | null,
    prenatalVisits: LDPrenatalVisit[],
    fetalMonitoring: LDFetalMonitoring | null,
    delivery: LDDeliveryRecord | null,
    newborn: LDNewbornAssessment | null,
    postpartum: LDPostpartumAssessment | null
  ): LDAlert[] {
    const alerts: LDAlert[] = [];
    const now = new Date().toISOString();

    // Fetal bradycardia
    if (fetalMonitoring && fetalMonitoring.fhr_baseline < 110) {
      alerts.push({
        id: `alert-fetal-brady-${fetalMonitoring.id}`,
        type: 'fetal_bradycardia',
        severity: 'critical',
        message: `Fetal bradycardia — FHR ${fetalMonitoring.fhr_baseline} bpm`,
        timestamp: now,
        source_record_id: fetalMonitoring.id,
        acknowledged: false,
      });
    }

    // Category III tracing
    if (fetalMonitoring?.fhr_category === 'III') {
      alerts.push({
        id: `alert-cat3-${fetalMonitoring.id}`,
        type: 'category_iii_tracing',
        severity: 'critical',
        message: 'Category III fetal heart rate tracing — immediate intervention required',
        timestamp: now,
        source_record_id: fetalMonitoring.id,
        acknowledged: false,
      });
    }

    // Severe preeclampsia (from latest prenatal visit)
    if (prenatalVisits.length > 0) {
      const latest = prenatalVisits[0];
      if (isSeverePreeclampsia(latest.bp_systolic, latest.bp_diastolic)) {
        alerts.push({
          id: `alert-preeclampsia-${latest.id}`,
          type: 'severe_preeclampsia',
          severity: 'critical',
          message: `Severe preeclampsia — BP ${latest.bp_systolic}/${latest.bp_diastolic}`,
          timestamp: now,
          source_record_id: latest.id,
          acknowledged: false,
        });
      }
    }

    // Postpartum hemorrhage
    if (delivery && delivery.estimated_blood_loss_ml > 1000) {
      alerts.push({
        id: `alert-pph-${delivery.id}`,
        type: 'postpartum_hemorrhage',
        severity: 'critical',
        message: `Postpartum hemorrhage — EBL ${delivery.estimated_blood_loss_ml} mL`,
        timestamp: now,
        source_record_id: delivery.id,
        acknowledged: false,
      });
    }

    // Neonatal distress
    if (newborn && newborn.apgar_5_min < 4) {
      alerts.push({
        id: `alert-apgar-${newborn.id}`,
        type: 'neonatal_distress',
        severity: 'critical',
        message: `Neonatal distress — APGAR 5min: ${newborn.apgar_5_min} (${interpretAPGAR(newborn.apgar_5_min)})`,
        timestamp: now,
        source_record_id: newborn.id,
        acknowledged: false,
      });
    }

    // GBS positive without antibiotics — check if pregnancy is GBS+ and labor in progress
    if (pregnancy?.gbs_status === 'positive') {
      alerts.push({
        id: `alert-gbs-${pregnancy.id}`,
        type: 'gbs_no_antibiotics',
        severity: 'high',
        message: 'GBS positive — verify antibiotic prophylaxis during labor',
        timestamp: now,
        source_record_id: pregnancy.id,
        acknowledged: false,
      });
    }

    // Postpartum emotional screening
    if (postpartum?.epds_score !== null && postpartum?.epds_score !== undefined && postpartum.epds_score >= 13) {
      alerts.push({
        id: `alert-ppd-${postpartum.id}`,
        type: 'maternal_fever',
        severity: 'high',
        message: `EPDS score ${postpartum.epds_score} — positive screen for postpartum depression`,
        timestamp: now,
        source_record_id: postpartum.id,
        acknowledged: false,
      });
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.severity] - order[b.severity];
    });
  }
}
