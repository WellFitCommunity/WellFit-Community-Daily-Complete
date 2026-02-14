/**
 * State Configuration Lookup
 *
 * Database-driven state health department endpoint resolution.
 * Falls back to hardcoded defaults when no DB row exists.
 *
 * ONC Criteria: 170.315(f)(1), (f)(2), (f)(5)
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface StateConfig {
  name: string;
  endpoint: string;
  testEndpoint: string;
  format: string;
  authType: string;
}

export type ReportingType = 'syndromic' | 'immunization' | 'ecr';

/**
 * Look up state configuration from the database.
 * Returns null if no active config found (caller should fall back to hardcoded).
 */
export async function getStateConfig(
  supabase: SupabaseClient,
  tenantId: string,
  stateCode: string,
  reportingType: ReportingType
): Promise<StateConfig | null> {
  try {
    const { data, error } = await supabase
      .from('public_health_state_configs')
      .select('registry_name, endpoint, test_endpoint, format, auth_type')
      .eq('tenant_id', tenantId)
      .eq('state_code', stateCode.toUpperCase())
      .eq('reporting_type', reportingType)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      name: data.registry_name,
      endpoint: data.endpoint,
      testEndpoint: data.test_endpoint,
      format: data.format,
      authType: data.auth_type,
    };
  } catch (_err: unknown) {
    // Silently return null — caller uses hardcoded fallback
    return null;
  }
}
