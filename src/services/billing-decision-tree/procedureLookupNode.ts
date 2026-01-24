// Billing Decision Tree - Node C: Procedure CPT Lookup
// Looks up CPT codes for procedures from the codes_cpt table

import { supabase } from '../../lib/supabaseClient';
import type {
  DecisionTreeInput,
  DecisionNode,
  ProcedureLookupResult,
} from './types';

/**
 * NODE C: Procedure Logic - CPT Lookup
 */
export async function executeNodeC(
  input: DecisionTreeInput,
  decisions: DecisionNode[]
): Promise<ProcedureLookupResult> {
  const procedure = input.proceduresPerformed[0];
  const lookupResult = await lookupProcedureCPT(
    procedure?.description || '',
    procedure?.cptCode
  );

  const decision: DecisionNode = {
    nodeId: 'NODE_C',
    nodeName: 'Procedure CPT Lookup',
    question: 'Is the procedure found in CPT cross-reference table?',
    answer: lookupResult.found ? `Yes - ${lookupResult.cptCode}` : 'No',
    result: lookupResult.found && !lookupResult.isUnlistedProcedure ? 'proceed' : 'manual_review',
    rationale: lookupResult.found
      ? `Matched procedure to CPT ${lookupResult.cptCode}: ${lookupResult.cptDescription}`
      : 'Procedure not found in reference table',
    timestamp: new Date().toISOString()
  };

  decisions.push(decision);
  return lookupResult;
}

/**
 * Lookup CPT code for procedure
 */
export async function lookupProcedureCPT(
  description: string,
  providedCode?: string
): Promise<ProcedureLookupResult> {
  // If code provided, validate it
  if (providedCode) {
    const { data: cptCode, error } = await supabase
      .from('codes_cpt')
      .select('*')
      .eq('code', providedCode)
      .eq('status', 'active')
      .single();

    if (!error && cptCode) {
      return {
        found: true,
        cptCode: cptCode.code,
        cptDescription: cptCode.long_desc || cptCode.short_desc || '',
        requiresModifier: false
      };
    }
  }

  // Search by description
  if (description) {
    const { data: cptCodes, error } = await supabase
      .from('codes_cpt')
      .select('*')
      .ilike('long_desc', `%${description}%`)
      .eq('status', 'active')
      .limit(1);

    if (!error && cptCodes && cptCodes.length > 0) {
      return {
        found: true,
        cptCode: cptCodes[0].code,
        cptDescription: cptCodes[0].long_desc || cptCodes[0].short_desc || '',
        requiresModifier: false
      };
    }
  }

  return {
    found: false,
    isUnlistedProcedure: true
  };
}
