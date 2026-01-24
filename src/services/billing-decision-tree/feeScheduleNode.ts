// Billing Decision Tree - Node F: Fee Schedule Lookup
// Implements Medicare RBRVS calculation with commercial payer multipliers
// HIPAA §164.312(b): Error logging enabled

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type {
  DecisionNode,
  FeeScheduleResult,
} from './types';

/**
 * NODE F: Fee Schedule Lookup
 */
export async function executeNodeF(
  cptCode: string,
  payerId: string,
  providerId: string,
  decisions: DecisionNode[]
): Promise<FeeScheduleResult> {
  const feeResult = await lookupFee(cptCode, payerId, providerId);

  const decision: DecisionNode = {
    nodeId: 'NODE_F',
    nodeName: 'Fee Schedule Lookup',
    question: 'Is service covered by payer fee schedule or contract?',
    answer: feeResult.feeFound ? `Yes - $${feeResult.appliedRate}` : 'No',
    result: 'proceed',
    rationale: `Applied ${feeResult.rateSource} rate: $${feeResult.appliedRate}`,
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return feeResult;
}

/**
 * Lookup fee for CPT code using RBRVS calculation
 * Implements Medicare RBRVS formula with commercial payer multipliers
 */
export async function lookupFee(
  cptCode: string,
  payerId: string,
  _providerId: string
): Promise<FeeScheduleResult> {
  try {
    // First, try to find contracted rate in fee schedule
    const { data: feeSchedule } = await supabase
      .from('fee_schedule_items')
      .select('*')
      .eq('payer_id', payerId)
      .eq('code', cptCode)
      .eq('code_type', 'CPT')
      .single();

    if (feeSchedule && feeSchedule.amount) {
      return {
        feeFound: true,
        contractedRate: feeSchedule.amount,
        appliedRate: feeSchedule.amount,
        rateSource: 'contracted'
      };
    }

    // If no contracted rate, use RBRVS calculation
    const rvuResult = await calculateRBRVSFee(cptCode, payerId);

    if (rvuResult) {
      return rvuResult;
    }

    // Fall back to chargemaster or default rates
    const { data: cptData } = await supabase
      .from('codes_cpt')
      .select('*')
      .eq('code', cptCode)
      .single();

    // Use simplified chargemaster rate
    const defaultRate = 100; // Base rate
    const appliedRate = cptData ? defaultRate * 1.5 : defaultRate;

    return {
      feeFound: true,
      chargemasterRate: appliedRate,
      appliedRate,
      rateSource: 'chargemaster'
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Fee lookup failed';
    auditLogger.error('Failed to lookup fee', errorMessage, { cptCode, payerId });
    // Return default rate if lookup fails
    return {
      feeFound: false,
      appliedRate: 100,
      rateSource: 'default'
    };
  }
}

/**
 * Calculate fee using RBRVS (Resource-Based Relative Value Scale)
 * Medicare Formula: (Work RVU + Practice RVU + Malpractice RVU) × CF × Geographic Modifier
 * Commercial payers typically pay 120-180% of Medicare rates
 */
async function calculateRBRVSFee(
  cptCode: string,
  payerId: string
): Promise<FeeScheduleResult | null> {
  try {
    // 2024 Medicare Conversion Factor (CMS updates annually)
    const MEDICARE_CF_2024 = 33.2875;

    // Get RVU values from codes_cpt table or RVU reference table
    const { data: rvuData } = await supabase
      .from('codes_cpt')
      .select('work_rvu, practice_rvu, malpractice_rvu')
      .eq('code', cptCode)
      .single();

    if (!rvuData || !rvuData.work_rvu) {
      // No RVU data available
      return null;
    }

    const workRVU = rvuData.work_rvu || 0;
    const practiceRVU = rvuData.practice_rvu || 0;
    const malpracticeRVU = rvuData.malpractice_rvu || 0;
    const totalRVUs = workRVU + practiceRVU + malpracticeRVU;

    // Calculate base Medicare rate
    const geographicModifier = 1.0; // Simplified - would vary by location (GPCI)
    const medicareRate = totalRVUs * MEDICARE_CF_2024 * geographicModifier;

    // Get payer multiplier (commercial payers pay percentage of Medicare)
    const payerMultiplier = await getPayerMedicareMultiplier(payerId);

    const appliedRate = medicareRate * payerMultiplier;

    return {
      feeFound: true,
      appliedRate,
      allowedAmount: appliedRate,
      rateSource: payerMultiplier === 1.0 ? 'medicare' : 'contracted'
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'RBRVS calculation failed';
    auditLogger.error('Failed to calculate RBRVS fee', errorMessage, { cptCode, payerId });
    return null;
  }
}

/**
 * Get commercial payer's Medicare multiplier
 * Most commercial payers pay 120-180% of Medicare rates
 */
async function getPayerMedicareMultiplier(payerId: string): Promise<number> {
  try {
    const { data: payer } = await supabase
      .from('payers')
      .select('medicare_multiplier')
      .eq('id', payerId)
      .single();

    if (payer && payer.medicare_multiplier) {
      return payer.medicare_multiplier;
    }

    // Default multipliers by payer type
    const PAYER_MULTIPLIERS: Record<string, number> = {
      'medicare': 1.0,
      'medicaid': 0.7,  // Medicaid typically pays less
      'blue_cross': 1.4, // 140% of Medicare
      'aetna': 1.35,
      'united': 1.38,
      'cigna': 1.32,
      'commercial': 1.3  // Default commercial rate
    };

    // Check if payerId contains known payer name
    const payerType = Object.keys(PAYER_MULTIPLIERS).find(type =>
      payerId.toLowerCase().includes(type)
    );

    return PAYER_MULTIPLIERS[payerType || 'commercial'];
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Payer multiplier lookup failed';
    auditLogger.error('Failed to get payer Medicare multiplier', errorMessage, { payerId });
    return 1.3; // Default to 130% of Medicare
  }
}
