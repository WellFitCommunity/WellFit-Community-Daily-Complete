// Billing Decision Tree - Node B: Service Classification
// Classifies encounters as procedural or evaluation/management
// Pure logic - no database dependencies

import type {
  DecisionTreeInput,
  DecisionNode,
  ServiceClassification,
} from './types';

/**
 * NODE B: Service Classification (Procedural vs E/M)
 */
export async function executeNodeB(
  input: DecisionTreeInput,
  decisions: DecisionNode[]
): Promise<ServiceClassification> {
  const classification = await classifyService(input);

  const decision: DecisionNode = {
    nodeId: 'NODE_B',
    nodeName: 'Service Classification',
    question: 'Is the service procedural or evaluation/management?',
    answer: classification.classificationType,
    result: 'proceed',
    rationale: classification.rationale,
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return classification;
}

/**
 * Classify service as procedural or E/M (with POS validation)
 */
export async function classifyService(input: DecisionTreeInput): Promise<ServiceClassification> {
  // Validate Place of Service and adjust classification
  const posValidation = validatePlaceOfService(input.placeOfService, input.encounterType);

  if (!posValidation.valid) {
    return {
      classificationType: 'unknown',
      confidence: 30,
      rationale: `Invalid POS: ${posValidation.message}`
    };
  }

  // Simple classification based on encounter type and procedures
  const hasProcedures = input.proceduresPerformed && input.proceduresPerformed.length > 0;
  const procedureTypes: string[] = ['surgery', 'procedure', 'lab', 'radiology'];

  if (procedureTypes.includes(input.encounterType)) {
    return {
      classificationType: 'procedural',
      confidence: 95,
      rationale: `Encounter type "${input.encounterType}" is procedural in nature at POS ${input.placeOfService || '11'}`
    };
  }

  if (hasProcedures && input.proceduresPerformed[0].cptCode) {
    return {
      classificationType: 'procedural',
      confidence: 90,
      rationale: `Procedure codes documented in encounter at POS ${input.placeOfService || '11'}`
    };
  }

  if (['office_visit', 'telehealth', 'consultation', 'emergency', 'inpatient'].includes(input.encounterType)) {
    return {
      classificationType: 'evaluation_management',
      confidence: 95,
      rationale: `Encounter type "${input.encounterType}" is evaluation/management at POS ${input.placeOfService || '11'} (${posValidation.posDescription})`
    };
  }

  return {
    classificationType: 'unknown',
    confidence: 50,
    rationale: 'Unable to definitively classify encounter type'
  };
}

/**
 * Validate Place of Service code and match to encounter type
 * Returns validation status and POS description
 */
export function validatePlaceOfService(
  posCode: string | undefined,
  encounterType: string
): { valid: boolean; message: string; posDescription?: string } {
  const POS_CODES: Record<string, { name: string; validEncounterTypes: string[] }> = {
    '02': { name: 'Telehealth', validEncounterTypes: ['telehealth'] },
    '11': { name: 'Office', validEncounterTypes: ['office_visit', 'consultation'] },
    '12': { name: 'Home', validEncounterTypes: ['office_visit'] },
    '21': { name: 'Inpatient Hospital', validEncounterTypes: ['inpatient'] },
    '22': { name: 'Outpatient Hospital', validEncounterTypes: ['office_visit', 'surgery', 'procedure'] },
    '23': { name: 'Emergency Room', validEncounterTypes: ['emergency'] },
    '24': { name: 'Ambulatory Surgical Center', validEncounterTypes: ['surgery', 'procedure'] },
    '31': { name: 'Skilled Nursing Facility', validEncounterTypes: ['office_visit', 'consultation'] },
    '32': { name: 'Nursing Facility', validEncounterTypes: ['office_visit', 'consultation'] }
  };

  // Default to office (11) if not specified
  const pos = posCode || '11';

  if (!POS_CODES[pos]) {
    return {
      valid: false,
      message: `Invalid POS code: ${pos}`
    };
  }

  const posInfo = POS_CODES[pos];

  // Check if encounter type matches valid POS
  if (!posInfo.validEncounterTypes.includes(encounterType)) {
    return {
      valid: false,
      message: `POS ${pos} (${posInfo.name}) not valid for encounter type "${encounterType}"`
    };
  }

  return {
    valid: true,
    message: `Valid POS ${pos} - ${posInfo.name}`,
    posDescription: posInfo.name
  };
}

/**
 * Get appropriate E/M code range based on Place of Service
 * Different POS require different E/M codes (office vs hospital vs ER)
 */
export function getEMCodeRangeForPOS(posCode: string | undefined): { min: number; max: number } {
  const pos = posCode || '11';

  const EM_RANGES: Record<string, { min: number; max: number }> = {
    '11': { min: 99202, max: 99215 },  // Office: 99202-99205 (new), 99211-99215 (est)
    '02': { min: 99202, max: 99215 },  // Telehealth: Same as office
    '21': { min: 99221, max: 99239 },  // Inpatient: 99221-99223 (initial), 99231-99239 (subsequent)
    '23': { min: 99281, max: 99288 },  // Emergency: 99281-99285, 99288 (critical care)
    '22': { min: 99202, max: 99215 },  // Outpatient hospital: Same as office
    '31': { min: 99304, max: 99318 },  // SNF: 99304-99310 (initial), 99311-99318 (subsequent)
    '32': { min: 99304, max: 99318 }   // Nursing facility: Same as SNF
  };

  return EM_RANGES[pos] || { min: 99202, max: 99215 }; // Default to office
}
