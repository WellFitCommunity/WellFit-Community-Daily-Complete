/**
 * =====================================================
 * LABOR & DELIVERY — ALERT GENERATION
 * =====================================================
 * Purpose: Generate clinical alerts from L&D data
 * Extracted from laborDeliveryService.ts for 600-line compliance
 * =====================================================
 */

import type {
  LDPregnancy,
  LDPrenatalVisit,
  LDFetalMonitoring,
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDPostpartumAssessment,
  LDAlert,
} from '../../types/laborDelivery';
import { interpretAPGAR, isSeverePreeclampsia } from '../../types/laborDelivery';

/** Generate L&D clinical alerts from patient data */
export function generateLDAlerts(
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

  // GBS positive without antibiotics
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
