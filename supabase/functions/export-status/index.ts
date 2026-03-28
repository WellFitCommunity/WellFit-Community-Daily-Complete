// Export Status Edge Function
// Returns status of a bulk export job (auth-gated, user can only see their own jobs)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createLogger } from '../_shared/auditLogger.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { requireUser, supabaseAdmin } from '../_shared/auth.ts';

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
    // 1. Require authenticated user
    let user;
    try {
      user = await requireUser(req);
    } catch (authResponse: unknown) {
      if (authResponse instanceof Response) return authResponse;
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request body
    const body: StatusRequest = await req.json();
    const { jobId } = body;

    // 3. Validate required fields
    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: jobId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Get job status — scoped to requesting user (cannot see other users' exports)
    const { data: job, error } = await supabaseAdmin
      .from('export_jobs')
      .select('id, status, progress, total_records, processed_records, download_url, error_message, started_at, completed_at, expires_at, created_by')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return new Response(
        JSON.stringify({ error: 'Export job not found', jobId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Verify the job belongs to the requesting user
    if (job.created_by && job.created_by !== user.id) {
      logger.security('Unauthorized export status access attempt', {
        caller: user.id,
        jobId,
        jobOwner: job.created_by,
      });
      return new Response(
        JSON.stringify({ error: 'Export job not found', jobId }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Return job status
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

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Error in export-status function', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
