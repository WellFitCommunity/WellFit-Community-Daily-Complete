/**
 * FHIR R4 Server — Authentication & Authorization
 *
 * Token validation against smart_access_tokens table and
 * SMART on FHIR scope checking.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SB_SECRET_KEY } from '../_shared/env.ts';
import type { TokenValidation } from './types.ts';

// Service role client for token lookups
const supabase = createClient(SUPABASE_URL ?? "", SB_SECRET_KEY ?? "");

/**
 * Validate a SMART on FHIR access token.
 * Looks up the token in smart_access_tokens and checks expiration.
 */
export async function validateAccessToken(token: string): Promise<TokenValidation> {
  const { data: tokenData, error } = await supabase
    .from('smart_access_tokens')
    .select('patient_id, scopes, app_id, expires_at')
    .eq('access_token', token)
    .single();

  if (error || !tokenData) {
    return { valid: false };
  }

  // Check expiration
  if (new Date(tokenData.expires_at) < new Date()) {
    return { valid: false };
  }

  // Handle scopes - DB stores as TEXT[] (array), but handle string fallback defensively
  let parsedScopes: string[];
  if (Array.isArray(tokenData.scopes)) {
    parsedScopes = tokenData.scopes;
  } else if (typeof tokenData.scopes === 'string') {
    // Defensive fallback: if somehow stored as space-delimited string
    parsedScopes = tokenData.scopes.split(' ').filter(Boolean);
  } else {
    parsedScopes = [];
  }

  return {
    valid: true,
    patientId: tokenData.patient_id,
    scopes: parsedScopes,
    appId: tokenData.app_id
  };
}

/**
 * Check if the given scopes include access for a resource type and action.
 * Supports patient-level and user-level scopes with wildcard matching.
 */
export function hasScope(scopes: string[], resourceType: string, action: string): boolean {
  const patientScope = `patient/${resourceType}.${action}`;
  const patientWildcard = `patient/*.${action}`;
  const userScope = `user/${resourceType}.${action}`;
  const userWildcard = `user/*.${action}`;

  return scopes.some(s =>
    s === patientScope ||
    s === patientWildcard ||
    s === userScope ||
    s === userWildcard
  );
}
