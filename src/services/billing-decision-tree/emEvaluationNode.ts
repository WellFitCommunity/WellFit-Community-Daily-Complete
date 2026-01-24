// Billing Decision Tree - Node D: E/M Level Determination
// Evaluates E/M level based on 2023 CMS guidelines
// Supports both time-based and MDM-based coding

import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import { assessRiskLevel } from './utils';
import type {
  DecisionTreeInput,
  DecisionNode,
  EMEvaluationResult,
  EMDocumentationElements,
} from './types';

/**
 * NODE D: E/M Logic - Level Determination
 */
export async function executeNodeD(
  input: DecisionTreeInput,
  decisions: DecisionNode[]
): Promise<EMEvaluationResult> {
  // Create documentation elements from input
  const documentation: EMDocumentationElements = {
    historyOfPresentIllness: !!input.chiefComplaint,
    reviewOfSystems: false,
    pastFamilySocialHistory: false,
    examinationPerformed: input.encounterType !== 'telehealth',
    examinationDetail: 'problem_focused',
    numberOfDiagnoses: input.presentingDiagnoses.length,
    amountOfData: input.presentingDiagnoses.length > 2 ? 'moderate' : 'limited',
    riskLevel: assessRiskLevel(input),
    totalTime: input.timeSpent,
    documentationCompletenesScore: 75
  };

  const emResult = await evaluateEMLevel(input, documentation);

  const decision: DecisionNode = {
    nodeId: 'NODE_D',
    nodeName: 'E/M Level Determination',
    question: 'Does documentation meet required elements for E/M level?',
    answer: emResult.levelDetermined ? `Yes - Level ${emResult.emLevel}` : 'No',
    result: emResult.levelDetermined ? 'proceed' : 'manual_review',
    rationale: emResult.levelDetermined
      ? `E/M Level ${emResult.emLevel} determined (${emResult.emCode}). Documentation score: ${emResult.documentationScore}%`
      : `Unable to determine level. Missing: ${emResult.missingElements?.join(', ')}`,
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return emResult;
}

/**
 * Evaluate E/M level based on documentation
 * Updated to 2023 CMS E/M Guidelines with correct time thresholds
 */
export async function evaluateEMLevel(
  input: DecisionTreeInput,
  documentation: EMDocumentationElements
): Promise<EMEvaluationResult> {
  const missingElements: string[] = [];
  let emLevel = 3; // Default to level 3
  const documentationScore = documentation.documentationCompletenesScore;

  // Check if new or established patient
  const newPatient = await isNewPatient(input.patientId, input.providerId);

  // Time-based coding (2023 CMS guidelines - total visit time)
  const timeBasedCoding = !!input.timeSpent && input.timeSpent >= 10;

  // Determine level based on time if available
  if (timeBasedCoding && input.timeSpent) {
    if (newPatient) {
      // NEW PATIENT (99202-99205) - Note: 99201 deleted in 2021
      // 99202: 15-29 min, 99203: 30-44 min, 99204: 45-59 min, 99205: 60-74 min
      if (input.timeSpent >= 60) emLevel = 5;
      else if (input.timeSpent >= 45) emLevel = 4;
      else if (input.timeSpent >= 30) emLevel = 3;
      else if (input.timeSpent >= 15) emLevel = 2;
      else {
        // < 15 minutes not typical for new patient
        missingElements.push('Insufficient time documented for new patient visit');
        emLevel = 2;
      }
    } else {
      // ESTABLISHED PATIENT (99211-99215)
      // 99211: N/A, 99212: 10-19 min, 99213: 20-29 min, 99214: 30-39 min, 99215: 40-54 min
      if (input.timeSpent >= 40) emLevel = 5;
      else if (input.timeSpent >= 30) emLevel = 4;
      else if (input.timeSpent >= 20) emLevel = 3;
      else if (input.timeSpent >= 10) emLevel = 2;
      else emLevel = 1; // 99211 - minimal service (nurse visit)
    }
  } else {
    // MDM-based coding (2021+ guidelines: 2 of 3 categories)
    const mdmLevel = calculateMDMLevel(documentation);
    emLevel = mdmLevel;

    if (emLevel < 2 && newPatient) {
      // New patient cannot be level 1 (99201 deleted)
      emLevel = 2;
    }
  }

  // Generate CPT code based on POS (different codes for office vs hospital vs ER)
  const emCode = generateEMCode(emLevel, newPatient, input.placeOfService);

  return {
    levelDetermined: true,
    emLevel,
    emCode,
    newPatient,
    timeBasedCoding,
    mdmBasedCoding: !timeBasedCoding,
    documentationScore,
    missingElements: missingElements.length > 0 ? missingElements : undefined
  };
}

/**
 * Generate appropriate E/M code based on level, patient status, and POS
 */
export function generateEMCode(level: number, isNewPatient: boolean, posCode: string | undefined): string {
  const pos = posCode || '11';

  // Office/Outpatient/Telehealth (POS 11, 02, 22)
  if (['11', '02', '22', '12'].includes(pos)) {
    return isNewPatient
      ? `9920${Math.max(level, 2)}` // New patient: 99202-99205 (99201 deleted)
      : `9921${level}`; // Established: 99211-99215
  }

  // Inpatient Hospital (POS 21)
  if (pos === '21') {
    if (isNewPatient) {
      // Initial hospital care: 99221-99223
      return `9922${Math.min(level, 3)}`;
    } else {
      // Subsequent hospital care: 99231-99233
      return `9923${Math.min(level, 3)}`;
    }
  }

  // Emergency Room (POS 23)
  if (pos === '23') {
    // ER codes: 99281-99285 (no new vs established)
    return `9928${Math.min(level, 5)}`;
  }

  // Skilled Nursing Facility (POS 31, 32)
  if (['31', '32'].includes(pos)) {
    if (isNewPatient) {
      // Initial SNF care: 99304-99306
      return `9930${Math.min(level + 3, 6)}`;
    } else {
      // Subsequent SNF care: 99307-99310
      return `9930${Math.min(level + 6, 10)}`;
    }
  }

  // Default to office codes
  return isNewPatient ? `9920${Math.max(level, 2)}` : `9921${level}`;
}

/**
 * Check if patient is new or established
 * New = No face-to-face encounter with this provider (or same specialty) in past 3 years
 */
export async function isNewPatient(patientId: string, providerId: string): Promise<boolean> {
  try {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const { data: encounters, error } = await supabase
      .from('encounters')
      .select('id')
      .eq('patient_id', patientId)
      .eq('provider_id', providerId)
      .gte('encounter_date', threeYearsAgo.toISOString())
      .limit(1);

    if (error) {
      // If error, assume established to be conservative
      return false;
    }

    // If no encounters in past 3 years, patient is new
    return !encounters || encounters.length === 0;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'New patient check failed';
    auditLogger.error('Failed to check if patient is new', errorMessage, { patientId, providerId });
    // Error checking - assume established to avoid overbilling
    return false;
  }
}

/**
 * Calculate MDM Level using 2021+ CMS Guidelines (2 of 3 categories)
 * Returns E/M level 1-5 based on problem complexity, data, and risk
 */
export function calculateMDMLevel(documentation: EMDocumentationElements): number {
  // Map each MDM component to a level (1-5)
  const problemLevel = assessProblemComplexity(documentation);
  const dataLevel = assessDataComplexity(documentation);
  const riskLevel = assessRiskComplexity(documentation);

  // CMS Rule: Level is determined by 2 of 3 categories
  // If all 3 match, use that level
  // If 2 match, use that level
  // If all different, use the middle (median) value
  const levels = [problemLevel, dataLevel, riskLevel].sort((a, b) => a - b);

  // Return the median (middle value) which represents "2 of 3"
  return levels[1];
}

/**
 * Assess problem complexity for MDM
 */
export function assessProblemComplexity(documentation: EMDocumentationElements): number {
  const numDx = documentation.numberOfDiagnoses;

  // CMS 2021+ Guidelines
  if (numDx === 0) return 1; // Minimal
  if (numDx === 1) return 2; // Low (1 self-limited/minor)
  if (numDx === 2) return 3; // Moderate (2+ stable chronic OR 1 chronic + 1 acute)
  if (numDx >= 3) {
    // Check risk level to differentiate between moderate and high
    if (documentation.riskLevel === 'high') return 4; // High (1+ chronic severe)
    return 3; // Moderate
  }
  return 3; // Default moderate
}

/**
 * Assess data review complexity for MDM
 */
export function assessDataComplexity(documentation: EMDocumentationElements): number {
  const data = documentation.amountOfData;

  // CMS 2021+ Guidelines
  switch (data) {
    case 'minimal':
      return 1; // Minimal/None
    case 'limited':
      return 2; // Limited (review of labs/X-rays)
    case 'moderate':
      return 3; // Moderate (review external records, independent historian)
    case 'extensive':
      return 4; // Extensive (independent interpretation of tests)
    default:
      return 2;
  }
}

/**
 * Assess risk complexity for MDM
 */
export function assessRiskComplexity(documentation: EMDocumentationElements): number {
  const risk = documentation.riskLevel;

  // CMS 2021+ Guidelines
  switch (risk) {
    case 'minimal':
      return 1; // Minimal (rest, superficial dressings)
    case 'low':
      return 2; // Low (OTC drugs, minor surgery)
    case 'moderate':
      return 3; // Moderate (prescription drug management)
    case 'high':
      return 4; // High (parenteral controlled substances, decision for surgery)
    default:
      return 2;
  }
}
