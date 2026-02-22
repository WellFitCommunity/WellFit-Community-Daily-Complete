/**
 * FHIR R4 Server — Shared Utilities
 *
 * Supabase client and FHIR error response helper shared
 * across handler modules.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';

/** Service role Supabase client for data access */
export const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "");

/**
 * Build a FHIR OperationOutcome error response.
 */
export function fhirError(
  code: string,
  message: string,
  status: number,
  headers: Record<string, string>
) {
  const operationOutcome = {
    resourceType: "OperationOutcome",
    issue: [{
      severity: "error",
      code,
      diagnostics: message
    }]
  };
  return new Response(JSON.stringify(operationOutcome), { status, headers });
}
