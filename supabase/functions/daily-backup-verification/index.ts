/**
 * Supabase Edge Function: Daily Backup Verification
 *
 * Runs automated backup verification for SOC 2 compliance.
 * Schedule: Daily at 2:00 AM UTC via Supabase Cron
 *
 * SOC 2 Controls:
 * - A1.2: Backup & Disaster Recovery (automated testing)
 * - CC9.1: Information Asset Protection (backup integrity)
 *
 * @see /workspaces/WellFit-Community-Daily-Complete/supabase/migrations/20251021150001_automated_backup_verification.sql
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this origin
  const { headers: corsHeaders, allowed } = corsFromRequest(req);

  // Reject requests from unauthorized origins
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Daily Backup Verification] Starting automated verification...');

    // Call the verify_database_backup() function
    const { data: verificationResult, error: verificationError } = await supabase
      .rpc('verify_database_backup');

    if (verificationError) {
      console.error('[Daily Backup Verification] Error during verification:', verificationError);

      // Log failure as security event
      await supabase.rpc('log_security_event', {
        p_event_type: 'BACKUP_VERIFICATION_FAILED',
        p_severity: 'CRITICAL',
        p_description: `Daily backup verification failed: ${verificationError.message}`,
        p_metadata: { error: verificationError },
        p_auto_block: false,
        p_requires_investigation: true
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: verificationError.message,
          timestamp: new Date().toISOString()
        }),
        {
          headers: corsHeaders,
          status: 500
        }
      );
    }

    console.log('[Daily Backup Verification] Verification completed successfully:', verificationResult);

    // Check if verification passed or has warnings
    const status = verificationResult?.status || 'unknown';
    const recordCount = verificationResult?.record_count || 0;
    const integrityPassed = verificationResult?.integrity_check_passed || false;

    // Log result as security event for audit trail
    if (status === 'warning' || !integrityPassed) {
      await supabase.rpc('log_security_event', {
        p_event_type: 'BACKUP_VERIFICATION_WARNING',
        p_severity: 'MEDIUM',
        p_description: `Backup verification completed with warning: ${verificationResult?.message}`,
        p_metadata: verificationResult,
        p_auto_block: false,
        p_requires_investigation: false
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: verificationResult,
        status: status,
        record_count: recordCount,
        integrity_passed: integrityPassed,
        timestamp: new Date().toISOString(),
        message: 'Daily backup verification completed'
      }),
      {
        headers: corsHeaders,
        status: 200
      }
    );

  } catch (error) {
    console.error('[Daily Backup Verification] Unexpected error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: corsHeaders,
        status: 500
      }
    );
  }
});
