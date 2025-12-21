// Export Status Edge Function
// Returns status of a bulk export job

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createLogger } from '../_shared/auditLogger.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

interface StatusRequest {
  jobId: string;
}

serve(async (req) => {
  const logger = createLogger('export-status', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      SUPABASE_URL ?? '',
      SB_SECRET_KEY ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: StatusRequest = await req.json();
    const { jobId } = body;

    // Validate required fields
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get job status from database
    const { data: job, error } = await supabaseAdmin
      .from('export_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: 'Export job not found', jobId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return job status
    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        totalRecords: job.total_records,
        processedRecords: job.processed_records,
        downloadUrl: job.download_url,
        error: job.error_message,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        expiresAt: job.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error in export-status function', { error: error.message });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
