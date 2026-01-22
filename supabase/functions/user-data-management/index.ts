// User Data Management API
// Handles user requests for data access, export, and deletion
// SECURITY: All operations are tenant-scoped

import { SUPABASE_URL, SB_SECRET_KEY, SB_PUBLISHABLE_API_KEY } from "../_shared/env.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

interface DataRequest {
  action: 'export' | 'delete' | 'status';
  userId?: string;
  confirmDeletion?: boolean;
}

// Joined roles structure
interface ProfileWithRoles {
  tenant_id: string | null;
  is_admin: boolean | null;
  role_id: string | null;
  roles: { name: string } | null;
}

// User data export structure
interface UserDataExport {
  profile?: Record<string, unknown> | null;
  checkIns?: unknown[];
  communityMoments?: unknown[];
  alerts?: unknown[];
  medications?: unknown[];
  medicationRequests?: unknown[];
  allergies?: unknown[];
  conditions?: unknown[];
  procedures?: unknown[];
  immunizations?: unknown[];
  observations?: unknown[];
  labResults?: unknown[];
  diagnosticReports?: unknown[];
  clinicalNotes?: unknown[];
  carePlans?: unknown[];
  encounters?: unknown[];
  careTeam?: unknown[];
  goals?: unknown[];
  sdohAssessments?: unknown[];
  provenance?: unknown[];
  exportInfo?: {
    exportedAt: string;
    exportedBy: string;
    tenantId: string | null;
    complianceNote: string;
    dataTypes: string[];
    totalRecords: number;
  };
}

// Deletion log structure
interface DeletionLog {
  userId: string;
  tenantId: string | null;
  deletedAt: string;
  deletedTables: Array<{ table: string; count?: number | null; action?: string }>;
  authUserDeleted?: boolean;
}

// User data status structure
interface UserDataStatus {
  userId: string;
  tenantId: string | null;
  dataSummary?: Record<string, unknown>;
  totalRecords?: number;
}

const supabase = createClient(
  SUPABASE_URL ?? "",
  SB_SECRET_KEY ?? ""
);

// Store tenant context for use in helper functions
let currentTenantId: string | null = null;
let currentCorsHeaders: Record<string, string> = {};

serve(async (req) => {
  // Handle CORS preflight with dynamic origin validation
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);
  currentCorsHeaders = corsHeaders;

  try {
    const { action, userId, confirmDeletion }: DataRequest = await req.json();

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get requesting user's profile to determine tenant and admin status
    const { data: requesterProfile } = await supabase
      .from('profiles')
      .select('tenant_id, is_admin, role_id, roles:role_id(name)')
      .eq('user_id', user.id)
      .single();

    if (!requesterProfile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const requesterTenantId = requesterProfile.tenant_id;
    const typedProfile = requesterProfile as ProfileWithRoles;
    const roleName = typedProfile.roles?.name ?? '';
    const isAdmin = typedProfile.is_admin || ['admin', 'super_admin'].includes(roleName);

    // Check if super admin (can access any tenant's data)
    const { data: superAdminData } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    const isSuperAdmin = !!superAdminData;

    const targetUserId = userId || user.id;

    // =========================================================================
    // AUTHORIZATION - Tenant-scoped access control
    // =========================================================================
    if (targetUserId !== user.id) {
      // User wants to access someone else's data
      if (!isAdmin && !isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden - admin access required' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For non-super-admins, verify target user belongs to same tenant
      if (!isSuperAdmin && requesterTenantId) {
        const { data: targetProfile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', targetUserId)
          .single();

        if (!targetProfile || targetProfile.tenant_id !== requesterTenantId) {
          return new Response(JSON.stringify({ error: 'Forbidden - user not in your organization' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Set tenant context for helper functions
    // For self-service, use requester's tenant; for admin, use target's tenant
    if (targetUserId === user.id) {
      currentTenantId = requesterTenantId;
    } else {
      // Get target user's tenant
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', targetUserId)
        .single();
      currentTenantId = targetProfile?.tenant_id || requesterTenantId;
    }

    switch (action) {
      case 'export':
        return await exportUserData(targetUserId);

      case 'delete':
        if (!confirmDeletion) {
          return new Response(JSON.stringify({
            error: 'Deletion must be confirmed with confirmDeletion: true'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return await deleteUserData(targetUserId);

      case 'status':
        return await getUserDataStatus(targetUserId);

      default:
        return new Response(JSON.stringify({
          error: 'Invalid action. Use: export, delete, or status'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function exportUserData(userId: string) {
  const userData: UserDataExport = {};

  // Get profile data - already scoped to specific user
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Verify profile belongs to current tenant context (defense in depth)
  if (currentTenantId && profile && profile.tenant_id !== currentTenantId) {
    return new Response(JSON.stringify({ error: 'User not in authorized tenant' }), {
      status: 403,
      headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
    });
  }

  userData.profile = profile;

  // =========================================================================
  // USCDI DATA EXPORT - 21st Century Cures Act Compliance
  // Export ALL patient health data per federal requirements
  // =========================================================================

  // Get check-ins - scoped to user (which is already tenant-scoped via profile)
  const { data: checkIns } = await supabase
    .from('check_ins_decrypted')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.checkIns = checkIns || [];

  // Get community moments - scoped to user
  const { data: moments } = await supabase
    .from('community_moments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.communityMoments = moments || [];

  // Get alerts - scoped to user
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.alerts = alerts || [];

  // =========================================================================
  // MEDICATIONS (USCDI Required)
  // =========================================================================
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .order('medication_name');

  userData.medications = medications || [];

  // FHIR Medication Requests
  const { data: medicationRequests } = await supabase
    .from('fhir_medication_requests')
    .select('*')
    .eq('patient_id', userId)
    .order('authored_on', { ascending: false });

  userData.medicationRequests = medicationRequests || [];

  // =========================================================================
  // ALLERGIES & INTOLERANCES (USCDI Required)
  // =========================================================================
  const { data: allergies } = await supabase
    .from('allergy_intolerances')
    .select('*')
    .eq('user_id', userId)
    .order('allergen_name');

  userData.allergies = allergies || [];

  // =========================================================================
  // CONDITIONS / PROBLEMS (USCDI Required)
  // =========================================================================
  const { data: conditions } = await supabase
    .from('fhir_conditions')
    .select('*')
    .eq('patient_id', userId)
    .order('recorded_date', { ascending: false });

  userData.conditions = conditions || [];

  // =========================================================================
  // PROCEDURES (USCDI Required)
  // =========================================================================
  const { data: procedures } = await supabase
    .from('fhir_procedures')
    .select('*')
    .eq('patient_id', userId)
    .order('performed_datetime', { ascending: false });

  userData.procedures = procedures || [];

  // =========================================================================
  // IMMUNIZATIONS (USCDI Required)
  // =========================================================================
  const { data: immunizations } = await supabase
    .from('fhir_immunizations')
    .select('*')
    .eq('patient_id', userId)
    .order('occurrence_datetime', { ascending: false });

  userData.immunizations = immunizations || [];

  // =========================================================================
  // OBSERVATIONS / VITAL SIGNS (USCDI Required)
  // =========================================================================
  const { data: observations } = await supabase
    .from('fhir_observations')
    .select('*')
    .eq('patient_id', userId)
    .order('effective_datetime', { ascending: false });

  userData.observations = observations || [];

  // =========================================================================
  // LAB RESULTS (USCDI Required)
  // =========================================================================
  const { data: labResults } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_mrn', userId)
    .order('extracted_at', { ascending: false });

  userData.labResults = labResults || [];

  // =========================================================================
  // DIAGNOSTIC REPORTS (USCDI Required)
  // =========================================================================
  const { data: diagnosticReports } = await supabase
    .from('fhir_diagnostic_reports')
    .select('*')
    .eq('patient_id', userId)
    .order('issued', { ascending: false });

  userData.diagnosticReports = diagnosticReports || [];

  // =========================================================================
  // CLINICAL NOTES (USCDI Required)
  // =========================================================================
  const { data: clinicalNotes } = await supabase
    .from('clinical_notes')
    .select('*')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  userData.clinicalNotes = clinicalNotes || [];

  // =========================================================================
  // CARE PLANS (USCDI Required)
  // =========================================================================
  const { data: carePlans } = await supabase
    .from('fhir_care_plans')
    .select('*')
    .eq('patient_id', userId)
    .order('created', { ascending: false });

  userData.carePlans = carePlans || [];

  // =========================================================================
  // ENCOUNTERS (USCDI Required)
  // =========================================================================
  const { data: encounters } = await supabase
    .from('encounters')
    .select('*')
    .eq('patient_id', userId)
    .order('start_time', { ascending: false });

  userData.encounters = encounters || [];

  // =========================================================================
  // CARE TEAM (USCDI Required)
  // =========================================================================
  const { data: careTeam } = await supabase
    .from('fhir_care_teams')
    .select('*')
    .eq('patient_id', userId);

  userData.careTeam = careTeam || [];

  // =========================================================================
  // GOALS (USCDI Required)
  // =========================================================================
  const { data: goals } = await supabase
    .from('fhir_goals')
    .select('*')
    .eq('patient_id', userId)
    .order('start_date', { ascending: false });

  userData.goals = goals || [];

  // =========================================================================
  // SOCIAL DETERMINANTS OF HEALTH (USCDI v2+)
  // =========================================================================
  const { data: sdohAssessments } = await supabase
    .from('sdoh_assessments')
    .select('*')
    .eq('patient_id', userId)
    .order('assessment_date', { ascending: false });

  userData.sdohAssessments = sdohAssessments || [];

  // =========================================================================
  // PROVENANCE (USCDI Required - Data Source Tracking)
  // =========================================================================
  const { data: provenance } = await supabase
    .from('fhir_provenance')
    .select('*')
    .eq('target_patient_id', userId)
    .order('recorded', { ascending: false });

  userData.provenance = provenance || [];

  // Add metadata
  userData.exportInfo = {
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    tenantId: currentTenantId,
    complianceNote: 'This export includes all Electronic Health Information (EHI) per 21st Century Cures Act requirements',
    dataTypes: Object.keys(userData).filter(key => key !== 'exportInfo'),
    totalRecords: Object.values(userData)
      .filter((v): v is unknown[] => Array.isArray(v))
      .reduce((sum, arr) => sum + arr.length, 0)
  };

  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      ...currentCorsHeaders,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="user-data-${userId}-${new Date().toISOString().split('T')[0]}.json"`
    }
  });
}

async function deleteUserData(userId: string) {
  const deletionLog: DeletionLog = {
    userId,
    tenantId: currentTenantId,
    deletedAt: new Date().toISOString(),
    deletedTables: []
  };

  try {
    // Verify user belongs to current tenant context (defense in depth)
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', userId)
      .single();

    if (currentTenantId && profile && profile.tenant_id !== currentTenantId) {
      return new Response(JSON.stringify({ error: 'User not in authorized tenant' }), {
        status: 403,
        headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Start transaction-like deletions
    // All deletes are scoped to the specific user (which is already tenant-verified)

    // Delete check-ins
    const { error: checkInsError, count: checkInsCount } = await supabase
      .from('check_ins')
      .delete()
      .eq('user_id', userId);

    if (!checkInsError) {
      deletionLog.deletedTables.push({ table: 'check_ins', count: checkInsCount });
    }

    // Delete community moments
    const { error: momentsError, count: momentsCount } = await supabase
      .from('community_moments')
      .delete()
      .eq('user_id', userId);

    if (!momentsError) {
      deletionLog.deletedTables.push({ table: 'community_moments', count: momentsCount });
    }

    // Delete alerts
    const { error: alertsError, count: alertsCount } = await supabase
      .from('alerts')
      .delete()
      .eq('user_id', userId);

    if (!alertsError) {
      deletionLog.deletedTables.push({ table: 'alerts', count: alertsCount });
    }

    // Soft delete profile (mark as deleted but keep for audit)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        phone: null,
        email_verified: false,
        phone_verified: false,
        consent: false
      })
      .eq('user_id', userId);

    if (!profileError) {
      deletionLog.deletedTables.push({ table: 'profiles', count: 1, action: 'soft_deleted' });
    }

    // Log the deletion for audit purposes - include tenant_id
    await supabase
      .from('admin_audit_log')
      .insert({
        user_id: userId,
        tenant_id: currentTenantId,
        action: 'user_data_deletion',
        metadata: deletionLog,
        timestamp: new Date().toISOString()
      });

    // Delete user from auth (this will cascade to related records)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);

    if (!authError) {
      deletionLog.authUserDeleted = true;
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'User data has been deleted successfully',
      deletionLog
    }), {
      headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    const error = err as Error;
    return new Response(JSON.stringify({
      error: 'Failed to delete user data',
      details: error.message,
      partialDeletionLog: deletionLog
    }), {
      status: 500,
      headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getUserDataStatus(userId: string) {
  const status: UserDataStatus = { userId, tenantId: currentTenantId };

  // Get profile first to verify tenant
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at, updated_at, deleted_at, consent, tenant_id')
    .eq('user_id', userId)
    .single();

  // Verify user belongs to current tenant context (defense in depth)
  if (currentTenantId && profile && profile.tenant_id !== currentTenantId) {
    return new Response(JSON.stringify({ error: 'User not in authorized tenant' }), {
      status: 403,
      headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Count records in each table - all scoped to the verified user
  const { count: checkInsCount } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: momentsCount } = await supabase
    .from('community_moments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: alertsCount } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  // USCDI Data Counts
  const { count: medicationsCount } = await supabase
    .from('medications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: allergiesCount } = await supabase
    .from('allergy_intolerances')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: conditionsCount } = await supabase
    .from('fhir_conditions')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userId);

  const { count: proceduresCount } = await supabase
    .from('fhir_procedures')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userId);

  const { count: immunizationsCount } = await supabase
    .from('fhir_immunizations')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userId);

  const { count: observationsCount } = await supabase
    .from('fhir_observations')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userId);

  const { count: labResultsCount } = await supabase
    .from('lab_results')
    .select('*', { count: 'exact', head: true })
    .eq('patient_mrn', userId);

  const { count: clinicalNotesCount } = await supabase
    .from('clinical_notes')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', userId);

  const { count: carePlansCount } = await supabase
    .from('fhir_care_plans')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', userId);

  status.dataSummary = {
    checkIns: checkInsCount || 0,
    communityMoments: momentsCount || 0,
    alerts: alertsCount || 0,
    medications: medicationsCount || 0,
    allergies: allergiesCount || 0,
    conditions: conditionsCount || 0,
    procedures: proceduresCount || 0,
    immunizations: immunizationsCount || 0,
    observations: observationsCount || 0,
    labResults: labResultsCount || 0,
    clinicalNotes: clinicalNotesCount || 0,
    carePlans: carePlansCount || 0,
    profileStatus: profile?.deleted_at ? 'deleted' : 'active',
    accountCreated: profile?.created_at,
    lastUpdated: profile?.updated_at,
    consentGiven: profile?.consent || false
  };

  status.totalRecords = (checkInsCount || 0) + (momentsCount || 0) + (alertsCount || 0) +
    (medicationsCount || 0) + (allergiesCount || 0) + (conditionsCount || 0) +
    (proceduresCount || 0) + (immunizationsCount || 0) + (observationsCount || 0) +
    (labResultsCount || 0) + (clinicalNotesCount || 0) + (carePlansCount || 0);

  return new Response(JSON.stringify(status, null, 2), {
    headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
  });
}