// User Data Management API
// Handles user requests for data access, export, and deletion
// SECURITY: All operations are tenant-scoped

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsFromRequest, handleOptions } from "../_shared/cors.ts";

interface DataRequest {
  action: 'export' | 'delete' | 'status';
  userId?: string;
  confirmDeletion?: boolean;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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
    const roleName = (requesterProfile.roles as any)?.name;
    const isAdmin = requesterProfile.is_admin || ['admin', 'super_admin'].includes(roleName);

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
  const userData: any = {};

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

  // Get check-ins - scoped to user (which is already tenant-scoped via profile)
  const { data: checkIns } = await supabase
    .from('check_ins_decrypted')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.checkIns = checkIns;

  // Get community moments - scoped to user
  const { data: moments } = await supabase
    .from('community_moments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.communityMoments = moments;

  // Get alerts - scoped to user
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.alerts = alerts;

  // Add metadata
  userData.exportInfo = {
    exportedAt: new Date().toISOString(),
    exportedBy: userId,
    tenantId: currentTenantId,
    dataTypes: Object.keys(userData).filter(key => key !== 'exportInfo'),
    totalRecords: Object.values(userData)
      .filter(v => Array.isArray(v))
      .reduce((sum, arr: any) => sum + arr.length, 0)
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
  const deletionLog: any = {
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
  const status: any = { userId, tenantId: currentTenantId };

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

  status.dataSummary = {
    checkIns: checkInsCount || 0,
    communityMoments: momentsCount || 0,
    alerts: alertsCount || 0,
    profileStatus: profile?.deleted_at ? 'deleted' : 'active',
    accountCreated: profile?.created_at,
    lastUpdated: profile?.updated_at,
    consentGiven: profile?.consent || false
  };

  status.totalRecords = (checkInsCount || 0) + (momentsCount || 0) + (alertsCount || 0);

  return new Response(JSON.stringify(status, null, 2), {
    headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' }
  });
}