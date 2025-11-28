// User Data Management API
// Handles user requests for data access, export, and deletion

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

serve(async (req) => {
  // Handle CORS preflight with dynamic origin validation
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Get CORS headers for this request's origin
  const { headers: corsHeaders } = corsFromRequest(req);

  try {
    const { action, userId, confirmDeletion }: DataRequest = await req.json();

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const targetUserId = userId || user.id;

    // Only allow users to manage their own data (unless admin)
    if (targetUserId !== user.id) {
      const { data: adminCheck } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin']);

      if (!adminCheck || adminCheck.length === 0) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
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

  } catch (error) {
    console.error('Error in user-data-management:', error);
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

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  userData.profile = profile;

  // Get check-ins (decrypt if needed)
  const { data: checkIns } = await supabase
    .from('check_ins_decrypted')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.checkIns = checkIns;

  // Get community moments
  const { data: moments } = await supabase
    .from('community_moments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  userData.communityMoments = moments;

  // Get any other user-related data
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
    dataTypes: Object.keys(userData).filter(key => key !== 'exportInfo'),
    totalRecords: Object.values(userData)
      .filter(v => Array.isArray(v))
      .reduce((sum, arr: any) => sum + arr.length, 0)
  };

  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="user-data-${userId}-${new Date().toISOString().split('T')[0]}.json"`
    }
  });
}

async function deleteUserData(userId: string) {
  const deletionLog: any = {
    userId,
    deletedAt: new Date().toISOString(),
    deletedTables: []
  };

  try {
    // Start transaction-like deletions

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

    // Log the deletion for audit purposes
    await supabase
      .from('admin_audit_log')
      .insert({
        user_id: userId,
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting user data:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete user data',
      details: error.message,
      partialDeletionLog: deletionLog
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getUserDataStatus(userId: string) {
  const status: any = { userId };

  // Count records in each table
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at, updated_at, deleted_at, consent')
    .eq('user_id', userId)
    .single();

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
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}