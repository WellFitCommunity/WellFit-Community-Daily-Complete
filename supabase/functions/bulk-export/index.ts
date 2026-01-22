// Bulk Export Edge Function
// Handles bulk data exports for admin users
// SECURITY: All exports are tenant-scoped to prevent cross-tenant data leakage

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createLogger } from '../_shared/auditLogger.ts';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';

interface ExportFilters {
  dateFrom: string;
  dateTo: string;
  userTypes: string[];
  includeArchived: boolean;
  format: 'csv' | 'xlsx' | 'json';
  compression: boolean;
}

interface ExportRequest {
  jobId: string;
  exportType: 'check_ins' | 'risk_assessments' | 'users_profiles' | 'billing_claims' | 'fhir_resources' | 'audit_logs';
  filters: ExportFilters;
  requestedBy: string;
  tenantId?: string; // Optional override for super-admins
}

// Profile with roles join result
interface ProfileWithRoles {
  tenant_id: string | null;
  is_admin: boolean | null;
  role_id: string | null;
  roles: { name: string } | null;
}

// Generic export record for CSV/FHIR conversion
interface ExportRecord {
  id?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  address?: string;
  mood?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  blood_oxygen?: number;
  spo2?: number;
  blood_sugar?: number;
  weight?: number;
  created_at?: string;
  [key: string]: unknown;
}

// FHIR Bundle entry structure
interface FHIRBundleEntry {
  fullUrl: string;
  resource: Record<string, unknown>;
}

// Audit logger interface
interface AuditLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
  security: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
}

// Supabase client type import
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

serve(async (req) => {
  const logger = createLogger('bulk-export', req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const { headers: corsHeaders } = corsFromRequest(req);

  const startTime = Date.now();

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

    // =========================================================================
    // AUTHENTICATION & AUTHORIZATION
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Bulk export attempted without authentication');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      logger.warn('Bulk export attempted with invalid token');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile to determine tenant and admin status
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, is_admin, role_id, roles:role_id(name)')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      logger.warn('Bulk export attempted by user without profile', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const typedProfile = profile as ProfileWithRoles;
    const roleName = typedProfile.roles?.name ?? '';
    const isAdmin = typedProfile.is_admin || ['admin', 'super_admin'].includes(roleName);

    if (!isAdmin) {
      logger.security('Bulk export denied - non-admin user', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'Admin access required for bulk exports' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if super admin (can export from any tenant)
    const { data: superAdminData } = await supabaseAdmin
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isSuperAdmin = !!superAdminData;

    // Parse request body
    const body: ExportRequest = await req.json();
    const { jobId, exportType, filters, requestedBy, tenantId: requestedTenantId } = body;

    // Determine effective tenant ID
    // Super admins can specify a tenant, regular admins use their own tenant
    let effectiveTenantId: string;
    if (isSuperAdmin && requestedTenantId) {
      effectiveTenantId = requestedTenantId;
      logger.info('Super admin exporting for specific tenant', {
        superAdminId: user.id,
        targetTenantId: requestedTenantId
      });
    } else if (profile.tenant_id) {
      effectiveTenantId = profile.tenant_id;
    } else {
      logger.warn('Bulk export attempted by user without tenant assignment', { userId: user.id });
      return new Response(
        JSON.stringify({ error: 'No tenant assigned to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logger.security('Bulk export requested', {
      jobId,
      exportType,
      requestedBy,
      userId: user.id,
      tenantId: effectiveTenantId,
      isSuperAdmin,
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
    // SECURITY: All queries are filtered by tenant_id
    let estimatedRecords = 0;
    let query;

    switch (exportType) {
      case 'check_ins':
        // Join with profiles to filter by tenant
        query = supabaseAdmin
          .from('check_ins')
          .select('*, profiles!inner(tenant_id)', { count: 'exact', head: true })
          .eq('profiles.tenant_id', effectiveTenantId);
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        break;

      case 'risk_assessments':
        // Join with profiles to filter by tenant
        query = supabaseAdmin
          .from('ai_risk_assessments')
          .select('*, profiles!inner(tenant_id)', { count: 'exact', head: true })
          .eq('profiles.tenant_id', effectiveTenantId);
        if (filters.dateFrom) {
          query = query.gte('assessed_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('assessed_at', filters.dateTo);
        }
        break;

      case 'users_profiles':
        query = supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', effectiveTenantId);
        break;

      case 'billing_claims':
        query = supabaseAdmin
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', effectiveTenantId);
        if (filters.dateFrom) {
          query = query.gte('created_at', filters.dateFrom);
        }
        if (filters.dateTo) {
          query = query.lte('created_at', filters.dateTo);
        }
        break;

      case 'fhir_resources':
        // Estimate based on encounters, filtered by tenant
        query = supabaseAdmin
          .from('encounters')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', effectiveTenantId);
        break;

      case 'audit_logs':
        query = supabaseAdmin
          .from('admin_audit_log')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', effectiveTenantId);
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

    // Create export job record with tenant_id for isolation
    const { error: insertError } = await supabaseAdmin.from('export_jobs').insert({
      id: jobId,
      export_type: exportType,
      status: 'processing',
      progress: 0,
      total_records: estimatedRecords,
      processed_records: 0,
      filters: filters,
      requested_by: requestedBy,
      tenant_id: effectiveTenantId, // SECURITY: Track which tenant this export belongs to
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
    // SECURITY: Pass tenant_id to ensure background process also filters by tenant
    processExportInBackground(jobId, exportType, filters, estimatedRecords, effectiveTenantId, supabaseAdmin, logger);

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

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const processingTime = Date.now() - startTime;
    logger.error('Error in bulk-export function', {
      error: errorMessage,
      processingTimeMs: processingTime
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Background processing function (runs asynchronously)
// SECURITY: All queries are tenant-scoped
async function processExportInBackground(
  jobId: string,
  exportType: string,
  filters: ExportFilters,
  totalRecords: number,
  tenantId: string, // REQUIRED: tenant_id for filtering
  supabaseAdmin: SupabaseClient,
  logger: AuditLogger
) {
  const processingStartTime = Date.now();

  try {
    logger.info('Background export processing started', {
      jobId,
      exportType,
      totalRecords,
      tenantId
    });

    const batchSize = 1000;
    let processedRecords = 0;
    const exportedData: ExportRecord[] = [];

    // Process data in batches
    // SECURITY: All queries filtered by tenant_id
    for (let offset = 0; offset < totalRecords; offset += batchSize) {
      const limit = Math.min(batchSize, totalRecords - offset);

      // Query data based on export type - ALL QUERIES ARE TENANT-SCOPED
      let query;
      switch (exportType) {
        case 'check_ins':
          // Join with profiles to filter by tenant
          query = supabaseAdmin
            .from('check_ins')
            .select('*, profiles!inner(tenant_id)')
            .eq('profiles.tenant_id', tenantId)
            .range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          break;

        case 'risk_assessments':
          // Join with profiles to filter by tenant
          query = supabaseAdmin
            .from('ai_risk_assessments')
            .select('*, profiles!inner(tenant_id)')
            .eq('profiles.tenant_id', tenantId)
            .range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('assessed_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('assessed_at', filters.dateTo);
          break;

        case 'users_profiles':
          query = supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenantId)
            .range(offset, offset + limit - 1);
          break;

        case 'billing_claims':
          query = supabaseAdmin
            .from('claims')
            .select('*')
            .eq('tenant_id', tenantId)
            .range(offset, offset + limit - 1);
          if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
          if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          break;

        case 'fhir_resources':
          // Fetch profiles and self_reports for FHIR Bundle generation
          // First pass: get profiles, subsequent passes: get self_reports
          if (offset === 0) {
            query = supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('tenant_id', tenantId)
              .range(offset, offset + limit - 1);
          } else {
            query = supabaseAdmin
              .from('self_reports')
              .select('*, profiles!inner(tenant_id)')
              .eq('profiles.tenant_id', tenantId)
              .range(offset - batchSize, offset + limit - batchSize - 1);
            if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
            if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
          }
          break;

        case 'audit_logs':
          query = supabaseAdmin
            .from('admin_audit_log')
            .select('*')
            .eq('tenant_id', tenantId)
            .range(offset, offset + limit - 1);
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

    // For FHIR exports, always generate a proper FHIR R4 Bundle
    if (exportType === 'fhir_resources') {
      const fhirBundle = convertToFHIRBundle(exportedData, tenantId);
      exportContent = JSON.stringify(fhirBundle, null, 2);
      contentType = 'application/fhir+json';
    } else if (format === 'json') {
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

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const processingTime = Date.now() - processingStartTime;
    logger.error('Error processing export', {
      jobId,
      exportType,
      error: errorMessage,
      processingTimeMs: processingTime
    });

    // Mark as failed
    await supabaseAdmin.from('export_jobs').update({
      status: 'failed',
      error_message: errorMessage || 'Unknown error occurred',
    }).eq('id', jobId);
  }
}

// Helper function to convert array of objects to CSV
function convertToCSV(data: ExportRecord[]): string {
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

// Helper function to convert profiles/self_reports data to FHIR R4 Bundle
function convertToFHIRBundle(data: ExportRecord[], tenantId: string): object {
  const bundleId = `bundle-${tenantId}-${Date.now()}`;
  const entries: FHIRBundleEntry[] = [];

  for (const record of data) {
    // Detect if this is a profile record or a self_report record
    if (record.first_name || record.last_name) {
      // This is a profile - convert to FHIR Patient
      entries.push({
        fullUrl: `Patient/${record.user_id || record.id}`,
        resource: {
          resourceType: 'Patient',
          id: record.user_id || record.id,
          identifier: [
            {
              system: 'http://wellfitcommunity.org/patient-id',
              value: record.user_id || record.id
            }
          ],
          name: [
            {
              use: 'official',
              family: record.last_name || '',
              given: [record.first_name || '']
            }
          ],
          telecom: [
            record.phone && {
              system: 'phone',
              value: record.phone,
              use: 'mobile'
            },
            record.email && {
              system: 'email',
              value: record.email,
              use: 'home'
            }
          ].filter(Boolean),
          birthDate: record.dob || undefined,
          address: record.address ? [
            {
              use: 'home',
              text: record.address
            }
          ] : undefined
        }
      });
    }

    // Check for self_reports fields (mood, bp_systolic, etc.)
    if (record.mood) {
      // Mood Observation
      entries.push({
        fullUrl: `Observation/mood-${record.id}`,
        resource: {
          resourceType: 'Observation',
          id: `mood-${record.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'survey',
                  display: 'Survey'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://wellfitcommunity.org/fhir/codes',
                code: 'mood-assessment',
                display: 'Mood Assessment'
              }
            ]
          },
          subject: {
            reference: `Patient/${record.user_id}`
          },
          effectiveDateTime: record.created_at,
          valueString: record.mood
        }
      });
    }

    // Blood Pressure Observation
    if (record.bp_systolic && record.bp_diastolic) {
      entries.push({
        fullUrl: `Observation/bp-${record.id}`,
        resource: {
          resourceType: 'Observation',
          id: `bp-${record.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '85354-9',
                display: 'Blood pressure panel'
              }
            ]
          },
          subject: {
            reference: `Patient/${record.user_id}`
          },
          effectiveDateTime: record.created_at,
          component: [
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic BP' }]
              },
              valueQuantity: { value: record.bp_systolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            },
            {
              code: {
                coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic BP' }]
              },
              valueQuantity: { value: record.bp_diastolic, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' }
            }
          ]
        }
      });
    }

    // Blood Oxygen (SpO2) Observation
    if (record.blood_oxygen || record.spo2) {
      entries.push({
        fullUrl: `Observation/spo2-${record.id}`,
        resource: {
          resourceType: 'Observation',
          id: `spo2-${record.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation' }]
          },
          subject: {
            reference: `Patient/${record.user_id}`
          },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.blood_oxygen || record.spo2,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          }
        }
      });
    }

    // Blood Sugar Observation
    if (record.blood_sugar) {
      entries.push({
        fullUrl: `Observation/glucose-${record.id}`,
        resource: {
          resourceType: 'Observation',
          id: `glucose-${record.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [{ system: 'http://loinc.org', code: '33747-0', display: 'Glucose' }]
          },
          subject: {
            reference: `Patient/${record.user_id}`
          },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.blood_sugar,
            unit: 'mg/dL',
            system: 'http://unitsofmeasure.org',
            code: 'mg/dL'
          }
        }
      });
    }

    // Weight Observation
    if (record.weight) {
      entries.push({
        fullUrl: `Observation/weight-${record.id}`,
        resource: {
          resourceType: 'Observation',
          id: `weight-${record.id}`,
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs'
                }
              ]
            }
          ],
          code: {
            coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }]
          },
          subject: {
            reference: `Patient/${record.user_id}`
          },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.weight,
            unit: 'lb',
            system: 'http://unitsofmeasure.org',
            code: '[lb_av]'
          }
        }
      });
    }
  }

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries
  };
}
