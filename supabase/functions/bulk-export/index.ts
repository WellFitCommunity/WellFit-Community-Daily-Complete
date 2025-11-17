// Bulk Export Edge Function
// Handles bulk data exports for admin users

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createLogger } from '../_shared/auditLogger.ts';

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
  const logger = createLogger('bulk-export', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    logger.security('Bulk export requested', {
      jobId,
      exportType,
      requestedBy,
      dateRange: `${filters?.dateFrom} to ${filters?.dateTo}`
    });

    // Validate required fields
    if (!jobId || !exportType || !requestedBy) {
      logger.warn('Missing required fields in bulk export request', {
        jobId,
        exportType,
        requestedBy
      });
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
      logger.error('Error creating export job', {
        jobId,
        exportType,
        error: insertError.message
      });
      return new Response(
        JSON.stringify({ error: 'Failed to create export job', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Export job created successfully', {
      jobId,
      exportType,
      estimatedRecords,
      requestedBy
    });

    // Start background export process (asynchronous)
    processExportInBackground(jobId, exportType, filters, estimatedRecords, supabaseAdmin, logger);

    const processingTime = Date.now() - startTime;
    logger.info('Bulk export initiated', {
      jobId,
      exportType,
      processingTimeMs: processingTime
    });

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
    const processingTime = Date.now() - startTime;
    logger.error('Error in bulk-export function', {
      error: error.message,
      processingTimeMs: processingTime
    });
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
  supabaseAdmin: any,
  logger: any
) {
  const processingStartTime = Date.now();

  try {
    logger.info('Background export processing started', {
      jobId,
      exportType,
      totalRecords
    });

    const batchSize = 1000;
    let processedRecords = 0;
    const exportedData: any[] = [];

    // Process data in batches
    for (let offset = 0; offset < totalRecords; offset += batchSize) {
      const limit = Math.min(batchSize, totalRecords - offset);

      // Query data based on export type
      let query;
      switch (exportType) {
        case 'check_ins':
          query = supabaseAdmin.from('check_ins').select('*').range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          break;

        case 'risk_assessments':
          query = supabaseAdmin.from('ai_risk_assessments').select('*').range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('assessed_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('assessed_at', filters.dateTo);
          break;

        case 'users_profiles':
          query = supabaseAdmin.from('profiles').select('*').range(offset, offset + limit - 1);
          break;

        case 'billing_claims':
          query = supabaseAdmin.from('claims').select('*').range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          break;

        case 'fhir_resources':
          query = supabaseAdmin.from('encounters').select('*').range(offset, offset + limit - 1);
          break;

        case 'audit_logs':
          query = supabaseAdmin.from('admin_audit_log').select('*').range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          break;

        default:
          throw new Error(`Unknown export type: ${exportType}`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch batch: ${error.message}`);
      }

      if (data) {
        exportedData.push(...data);
      }

      processedRecords = Math.min(offset + limit, totalRecords);
      const progress = Math.round((processedRecords / totalRecords) * 100);

      // Update progress
      await supabaseAdmin.from('export_jobs').update({
        processed_records: processedRecords,
        progress: progress,
      }).eq('id', jobId);

      logger.debug('Export batch processed', {
        jobId,
        processedRecords,
        totalRecords,
        progress
      });
    }

    // Convert to requested format
    let exportContent: string;
    let contentType: string;
    const format = filters.format || 'json';

    if (format === 'json') {
      exportContent = JSON.stringify(exportedData, null, 2);
      contentType = 'application/json';
    } else if (format === 'csv') {
      exportContent = convertToCSV(exportedData);
      contentType = 'text/csv';
    } else {
      // For XLSX, we'll use JSON format as a fallback in Deno environment
      // In production, use a proper XLSX library
      exportContent = JSON.stringify(exportedData, null, 2);
      contentType = 'application/json';
      logger.warn('XLSX format not fully implemented, using JSON', { jobId });
    }

    // Upload to Supabase Storage
    const fileName = `${jobId}.${format}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('exports')
      .upload(fileName, new Blob([exportContent], { type: contentType }), {
        contentType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload export: ${uploadError.message}`);
    }

    // Generate signed URL (valid for 48 hours)
    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('exports')
      .createSignedUrl(fileName, 48 * 60 * 60); // 48 hours

    if (urlError) {
      throw new Error(`Failed to generate download URL: ${urlError.message}`);
    }

    const downloadUrl = signedUrlData.signedUrl;

    // Mark as completed
    await supabaseAdmin.from('export_jobs').update({
      status: 'completed',
      progress: 100,
      processed_records: totalRecords,
      download_url: downloadUrl,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId);

    const processingTime = Date.now() - processingStartTime;
    logger.info('Export processing completed successfully', {
      jobId,
      exportType,
      totalRecords,
      format,
      processingTimeMs: processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - processingStartTime;
    logger.error('Error processing export', {
      jobId,
      exportType,
      error: error.message,
      processingTimeMs: processingTime
    });

    // Mark as failed
    await supabaseAdmin.from('export_jobs').update({
      status: 'failed',
      error_message: error.message || 'Unknown error occurred',
    }).eq('id', jobId);
  }
}

// Helper function to convert array of objects to CSV
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma or newline
      if (value === null || value === undefined) {
        return '';
      }
      const escaped = String(value).replace(/"/g, '""');
      return /[,\n"]/.test(escaped) ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
