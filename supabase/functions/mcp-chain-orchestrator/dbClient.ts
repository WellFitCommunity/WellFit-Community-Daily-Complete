// ============================================================
// MCP Chain Orchestrator — Service Role Client
//
// Shared singleton for service-role Supabase client.
// Bypasses RLS for orchestrator operations.
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SB_SECRET_KEY } from "../_shared/env.ts";

let _serviceClient: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    if (!SUPABASE_URL || !SB_SECRET_KEY) {
      throw new Error("Missing SUPABASE_URL or SB_SECRET_KEY for chain orchestrator");
    }
    _serviceClient = createClient(SUPABASE_URL, SB_SECRET_KEY, {
      auth: { persistSession: false },
    });
  }
  return _serviceClient;
}
