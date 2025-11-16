// Bulk Export Edge Function
// Handles bulk data exports for admin users

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  jobId: string;
  exportType: 'check_ins' | 'risk_assessments' | 'users_profiles' | 'billing_claims' | 'fhir_resources' | 'audit_logs';
  filters: {
    dateFrom: string;
    dateTo: string;
    userTypes: string[];
    includeArchived: boolean;
    format: 'csv' | 'xlsx' | 'json';
    compression: boolean;
  };
  requestedBy: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const body: ExportRequest = await req.json();
    const { jobId, exportType, filters, requestedBy } = body;

    // Validate required fields
    if (!jobId || !exportType || !requestedBy) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: jobId, exportType, requestedBy' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get estimated record count based on export type
    let estimatedRecords = 0;
    let query;

    switch (exportType) {
      case 'check_ins':
        query = supabaseAdmin.from('check_ins').select('*', { count: 'exact', head: true });
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        break;

      case 'risk_assessments':
        query = supabaseAdmin.from('ai_risk_assessments').select('*', { count: 'exact', head: true });
        if (filters.dateFrom) {
          query = query.gte('assessed_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('assessed_at', filters.dateTo);
        }
        break;

      case 'users_profiles':
        query = supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
        break;

      case 'billing_claims':
        query = supabaseAdmin.from('claims').select('*', { count: 'exact', head: true });
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        break;

      case 'fhir_resources':
        // Estimate based on encounters
        query = supabaseAdmin.from('encounters').select('*', { count: 'exact', head: true });
        break;

      case 'audit_logs':
        query = supabaseAdmin.from('admin_audit_log').select('*', { count: 'exact', head: true });
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown export type: ${exportType}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Get count
    if (query) {
      const { count } = await query;
      estimatedRecords = count || 0;
    }

    // Create export job record
    const { error: insertError } = await supabaseAdmin.from('export_jobs').insert({
      id: jobId,
      export_type: exportType,
      status: 'processing',
      progress: 0,
      total_records: estimatedRecords,
      processed_records: 0,
      filters: filters,
      requested_by: requestedBy,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
    });

    if (insertError) {
      console.error('Error creating export job:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create export job', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Start background export process (asynchronous)
    // Note: In a production system, you'd use a job queue like pg_cron or external service
    processExportInBackground(jobId, exportType, filters, estimatedRecords, supabaseAdmin);

    // Return immediate response
    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        estimatedRecords,
        message: 'Export job started successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in bulk-export function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Background processing function (runs asynchronously)
async function processExportInBackground(
  jobId: string,
  exportType: string,
  filters: any,
  totalRecords: number,
  supabaseAdmin: any
) {
  try {
    // Simulate export processing
    // In production, this would:
    // 1. Query data in batches
    // 2. Convert to CSV/XLSX/JSON
    // 3. Upload to storage bucket
    // 4. Generate signed URL
    // 5. Update job status

    const batchSize = 1000;
    let processedRecords = 0;

    // Process in batches (simulated)
    for (let i = 0; i < totalRecords; i += batchSize) {
      processedRecords = Math.min(i + batchSize, totalRecords);
      const progress = Math.round((processedRecords / totalRecords) * 100);

      // Update progress
      await supabaseAdmin.from('export_jobs').update({
        processed_records: processedRecords,
        progress: progress,
      }).eq('id', jobId);

      // Small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Generate download URL (placeholder - in production, upload to storage and generate signed URL)
    const downloadUrl = `https://storage.example.com/exports/${jobId}.${filters.format}`;

    // Mark as completed
    await supabaseAdmin.from('export_jobs').update({
      status: 'completed',
      progress: 100,
      processed_records: totalRecords,
      download_url: downloadUrl,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

  } catch (error) {
    console.error('Error processing export:', error);

    // Mark as failed
    await supabaseAdmin.from('export_jobs').update({
      status: 'failed',
      error_message: error.message || 'Unknown error occurred',
    }).eq('id', jobId);
  }
}
