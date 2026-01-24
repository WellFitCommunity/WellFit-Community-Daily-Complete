// Billing Decision Tree - Node E: Modifier Determination
// Determines applicable modifiers based on circumstances
// Updated with 2023 CMS modifiers

import { isEMCode } from './utils';
import type {
  DecisionTreeInput,
  DecisionNode,
  ModifierDecision,
} from './types';

/**
 * Check if prolonged services codes apply (99417, 99418)
 * 99417: Prolonged outpatient E/M (add-on for 99205/99215)
 * Add-on for each additional 15 minutes beyond the max time
 */
export async function checkProlongedServices(
  cptCode: string,
  timeSpent: number | undefined,
  isEM: boolean
): Promise<{ applies: boolean; units: number; additionalCPT?: string }> {
  // Only applies to high-level E/M codes (level 4-5)
  const eligibleCodes = ['99204', '99205', '99214', '99215'];

  if (!isEM || !timeSpent || !eligibleCodes.includes(cptCode)) {
    return { applies: false, units: 0 };
  }

  // Determine base time thresholds by CPT code
  const baseTimeLimits: Record<string, number> = {
    '99205': 60,  // New patient, Level 5: 60-74 min base
    '99204': 45,  // New patient, Level 4: 45-59 min base
    '99215': 55,  // Established, Level 5: 40-54 min base (use upper bound)
    '99214': 40   // Established, Level 4: 30-39 min base (use upper bound)
  };

  const baseTime = baseTimeLimits[cptCode];
  const extraTime = timeSpent - baseTime;

  // Prolonged services only apply if >= 15 minutes beyond base
  if (extraTime < 15) {
    return { applies: false, units: 0 };
  }

  // Calculate units (each 15 minutes = 1 unit, max 16 units = 4 hours total)
  const units = Math.min(Math.floor(extraTime / 15), 16);

  return {
    applies: true,
    units,
    additionalCPT: '99417' // Prolonged outpatient E/M
  };
}

/**
 * NODE E: Modifier Logic
 */
export async function executeNodeE(
  cptCode: string,
  input: DecisionTreeInput,
  decisions: DecisionNode[],
  prolongedServices?: { applies: boolean; units: number; additionalCPT?: string }
): Promise<ModifierDecision> {
  const circumstances: string[] = [];

  // Detect special circumstances
  if (input.encounterType === 'telehealth') {
    circumstances.push('telehealth');
  }

  // Check if E/M + procedure same encounter (need Modifier 25)
  const hasProcedures = input.proceduresPerformed && input.proceduresPerformed.length > 0;
  const isEM = isEMCode(cptCode);

  if (isEM && hasProcedures) {
    circumstances.push('em_with_procedure');
  }

  const modifierResult = await determineModifiers(cptCode, circumstances);

  // Add prolonged services info to modifier result
  if (prolongedServices && prolongedServices.applies) {
    modifierResult.prolongedServices = prolongedServices;
  }

  const decision: DecisionNode = {
    nodeId: 'NODE_E',
    nodeName: 'Modifier Determination',
    question: 'Are there special circumstances requiring modifiers?',
    answer: modifierResult.modifiersApplied.length > 0 || prolongedServices?.applies
      ? `Yes - ${modifierResult.modifiersApplied.join(', ')}${prolongedServices?.applies ? ` + Prolonged (99417 x${prolongedServices.units})` : ''}`
      : 'No',
    result: 'proceed',
    rationale: modifierResult.modifiersApplied.length > 0 || prolongedServices?.applies
      ? `Applied modifiers: ${Object.entries(modifierResult.modifierRationale).map(([mod, reason]) => `${mod} (${reason})`).join(', ')}${prolongedServices?.applies ? `. Prolonged services: +${prolongedServices.units * 15} minutes (99417 x${prolongedServices.units})` : ''}`
      : 'No modifiers required',
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return modifierResult;
}

/**
 * Determine applicable modifiers (updated with 2023 CMS modifiers)
 */
export async function determineModifiers(
  _cptCode: string,
  circumstances: string[]
): Promise<ModifierDecision> {
  const modifiersApplied: string[] = [];
  const modifierRationale: Record<string, string> = {};

  // CRITICAL: Modifier 25 - Significant, separately identifiable E/M service on same day as procedure
  // This prevents automatic denials when E/M + procedure billed together
  if (circumstances.includes('em_with_procedure')) {
    modifiersApplied.push('25');
    modifierRationale['25'] = 'Significant, separately identifiable E/M service on same day as procedure';
  }

  // Telehealth modifiers (CMS allows both 95 and GT)
  if (circumstances.includes('telehealth')) {
    modifiersApplied.push('95');
    modifierRationale['95'] = 'Telehealth service (synchronous)';
  }

  // Asynchronous telehealth (store-and-forward)
  if (circumstances.includes('telehealth_async')) {
    modifiersApplied.push('GQ');
    modifierRationale['GQ'] = 'Telehealth service (asynchronous)';
  }

  // GT modifier (alternative to 95, some payers require GT instead)
  if (circumstances.includes('telehealth_gt')) {
    modifiersApplied.push('GT');
    modifierRationale['GT'] = 'Telehealth service via interactive audio/video';
  }

  // Professional component only (e.g., physician reading X-ray)
  if (circumstances.includes('professional_component')) {
    modifiersApplied.push('26');
    modifierRationale['26'] = 'Professional component only';
  }

  // Technical component only (e.g., facility fee for equipment)
  if (circumstances.includes('technical_component')) {
    modifiersApplied.push('TC');
    modifierRationale['TC'] = 'Technical component only';
  }

  // Distinct procedural service (unbundling modifier)
  if (circumstances.includes('distinct_procedure')) {
    modifiersApplied.push('59');
    modifierRationale['59'] = 'Distinct procedural service';
  }

  // Bilateral procedure
  if (circumstances.includes('bilateral')) {
    modifiersApplied.push('50');
    modifierRationale['50'] = 'Bilateral procedure';
  }

  // Left side
  if (circumstances.includes('left_side')) {
    modifiersApplied.push('LT');
    modifierRationale['LT'] = 'Left side';
  }

  // Right side
  if (circumstances.includes('right_side')) {
    modifiersApplied.push('RT');
    modifierRationale['RT'] = 'Right side';
  }

  // Repeat procedure by same physician
  if (circumstances.includes('repeat_same_physician')) {
    modifiersApplied.push('76');
    modifierRationale['76'] = 'Repeat procedure by same physician';
  }

  // Repeat procedure by different physician
  if (circumstances.includes('repeat_different_physician')) {
    modifiersApplied.push('77');
    modifierRationale['77'] = 'Repeat procedure by different physician';
  }

  // Reduced services
  if (circumstances.includes('reduced_service')) {
    modifiersApplied.push('52');
    modifierRationale['52'] = 'Reduced services';
  }

  // Discontinued procedure
  if (circumstances.includes('discontinued')) {
    modifiersApplied.push('53');
    modifierRationale['53'] = 'Discontinued procedure';
  }

  // Assistant surgeon
  if (circumstances.includes('assistant_surgeon')) {
    modifiersApplied.push('80');
    modifierRationale['80'] = 'Assistant surgeon';
  }

  return {
    modifiersApplied,
    modifierRationale,
    specialCircumstances: circumstances
  };
}
