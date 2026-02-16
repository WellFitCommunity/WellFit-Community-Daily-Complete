/**
 * =====================================================
 * LABOR & DELIVERY — BILLING CODE SUGGESTION SERVICE
 * =====================================================
 * Purpose: Auto-suggest CPT codes based on delivery record, procedures, and anesthesia
 * Uses the existing LD_BILLING_CODES constant as the code set
 * =====================================================
 */

import type {
  LDDeliveryRecord,
  LDNewbornAssessment,
  LDFetalMonitoring,
} from '../../types/laborDelivery';
import { LD_BILLING_CODES } from '../../types/laborDelivery';

export interface BillingSuggestion {
  code: string;
  description: string;
  basis: string;
  confidence: 'high' | 'medium';
}

/**
 * Generate billing code suggestions from delivery data.
 * Returns an array of suggested CPT codes with rationale.
 */
export function suggestBillingCodes(params: {
  delivery: LDDeliveryRecord;
  newborn?: LDNewbornAssessment | null;
  fetalMonitoring?: LDFetalMonitoring | null;
}): BillingSuggestion[] {
  const suggestions: BillingSuggestion[] = [];
  const { delivery, newborn, fetalMonitoring } = params;

  // Delivery method → primary procedure code
  if (delivery.method.includes('cesarean')) {
    suggestions.push({
      ...LD_BILLING_CODES.cesarean_delivery,
      basis: `Cesarean delivery (${delivery.method.replace(/_/g, ' ')})`,
      confidence: 'high',
    });
  } else {
    suggestions.push({
      ...LD_BILLING_CODES.vaginal_delivery,
      basis: `Vaginal delivery (${delivery.method.replace(/_/g, ' ')})`,
      confidence: 'high',
    });
  }

  // Anesthesia
  if (delivery.anesthesia === 'epidural' || delivery.anesthesia === 'combined_spinal_epidural') {
    suggestions.push({
      ...LD_BILLING_CODES.epidural,
      basis: `Epidural anesthesia (${delivery.anesthesia.replace(/_/g, ' ')})`,
      confidence: 'high',
    });
  }

  // Fetal monitoring during labor
  if (fetalMonitoring) {
    suggestions.push({
      ...LD_BILLING_CODES.fetal_monitoring,
      basis: `Fetal monitoring performed — Category ${fetalMonitoring.fhr_category}`,
      confidence: 'high',
    });
  }

  // Episiotomy repair (CPT 59300)
  if (delivery.episiotomy) {
    suggestions.push({
      code: '59300',
      description: 'Episiotomy repair',
      basis: 'Episiotomy documented in delivery record',
      confidence: 'high',
    });
  }

  // Laceration repair
  if (delivery.laceration_degree !== null && delivery.laceration_degree !== undefined && delivery.laceration_degree >= 2) {
    const lacerationCodes: Record<number, { code: string; description: string }> = {
      2: { code: '59300', description: '2nd degree laceration repair' },
      3: { code: '59300', description: '3rd degree laceration repair' },
      4: { code: '59300', description: '4th degree laceration repair (complex)' },
    };
    const lacerationCode = lacerationCodes[delivery.laceration_degree];
    if (lacerationCode) {
      suggestions.push({
        ...lacerationCode,
        basis: `${delivery.laceration_degree}° perineal laceration documented`,
        confidence: 'high',
      });
    }
  }

  // Newborn resuscitation (if low APGAR)
  if (newborn && newborn.apgar_1_min < 4) {
    suggestions.push({
      code: '99465',
      description: 'Newborn resuscitation',
      basis: `Low APGAR at 1 min: ${newborn.apgar_1_min}`,
      confidence: 'medium',
    });
  }

  // NICU admission
  if (newborn && newborn.disposition === 'nicu') {
    suggestions.push({
      code: '99468',
      description: 'Initial neonatal critical care',
      basis: 'Newborn admitted to NICU',
      confidence: 'medium',
    });
  }

  return suggestions;
}
