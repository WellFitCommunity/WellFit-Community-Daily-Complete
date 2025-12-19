/**
 * Tenant Assignment Service
 *
 * Manages which Envision staff members can access which tenant admin panels
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { supabase } from '../lib/supabaseClient';
import { auditLogger } from './auditLogger';

export interface TenantAssignment {
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  subdomain: string;
  isActive: boolean;
  assignedAt: string;
}

export interface SuperAdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isSuperAdmin: boolean;
  assignedTenants: TenantAssignment[];
}

export const TenantAssignmentService = {
  /**
   * Get current user's super admin profile and tenant assignments
   */
  async getCurrentUserProfile(): Promise<SuperAdminProfile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if user is a super admin
      const { data: superAdminData } = await supabase
        .from('super_admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      const isSuperAdmin = !!superAdminData;

      // Get user's profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      // Get all tenants the user has access to
      // Super admins can see all tenants, but we'll return their assigned ones
      let assignedTenants: TenantAssignment[] = [];

      if (isSuperAdmin) {
        // For super admins, get all active tenants they're assigned to
        // This query joins profiles (which has tenant_id) with tenants
        const { data: tenantsData } = await supabase
          .from('profiles')
          .select(`
            tenant_id,
            tenants!inner(
              id,
              name,
              tenant_code,
              subdomain
            )
          `)
          .eq('id', user.id);

        if (tenantsData && tenantsData.length > 0) {
          assignedTenants = tenantsData
            .filter(item => item.tenants)
            .map(item => {
              // Handle both array and object responses from Supabase join
              const tenant = Array.isArray(item.tenants) ? item.tenants[0] : item.tenants;
              return {
                tenantId: tenant.id,
                tenantName: tenant.name,
                tenantCode: tenant.tenant_code,
                subdomain: tenant.subdomain,
                isActive: true,
                assignedAt: new Date().toISOString()
              };
            });
        }
      }

      return {
        id: user.id,
        email: user.email || '',
        fullName: profileData ? ((profileData.first_name || '') + ' ' + (profileData.last_name || '')).trim() || user.email || 'Unknown' : user.email || 'Unknown',
        role: superAdminData?.role || 'user',
        isSuperAdmin,
        assignedTenants
      };
    } catch (error) {
      await auditLogger.error('TENANT_ASSIGNMENT_PROFILE_LOAD_FAILED', error as Error, {
        category: 'ADMINISTRATIVE'
      });
      return null;
    }
  },

  /**
   * Get all tenants available for assignment
   * SECURITY: Only super-admins can view all tenants
   */
  async getAllTenants(): Promise<TenantAssignment[]> {
    try {
      // SECURITY: Verify caller is a super-admin before returning all tenants
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        await auditLogger.warn('TENANT_ASSIGNMENT_GET_ALL_UNAUTHORIZED', {
          category: 'SECURITY',
          reason: 'No authenticated user'
        });
        return [];
      }

      // Check if user is a super admin
      const { data: superAdminData } = await supabase
        .from('super_admin_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!superAdminData) {
        await auditLogger.warn('TENANT_ASSIGNMENT_GET_ALL_FORBIDDEN', {
          category: 'SECURITY',
          userId: user.id,
          reason: 'User is not a super admin'
        });
        return [];
      }

      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, tenant_code, subdomain')
        .order('name');

      if (error) throw error;

      await auditLogger.info('TENANT_ASSIGNMENT_GET_ALL_SUCCESS', {
        category: 'ADMINISTRATIVE',
        userId: user.id,
        tenantCount: data?.length || 0
      });

      return (data || []).map(tenant => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantCode: tenant.tenant_code,
        subdomain: tenant.subdomain,
        isActive: true,
        assignedAt: new Date().toISOString()
      }));
    } catch (error) {
      await auditLogger.error('TENANT_ASSIGNMENT_GET_ALL_FAILED', error as Error, {
        category: 'ADMINISTRATIVE'
      });
      return [];
    }
  },

  /**
   * Check if WellFit tenant exists and return it
   */
  async getWellFitTenant(): Promise<TenantAssignment | null> {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, tenant_code, subdomain')
        .eq('tenant_code', 'WF-001')
        .single();

      let tenantData = data;

      if (error || !tenantData) {
        // Try by name as fallback
        const { data: fallbackData } = await supabase
          .from('tenants')
          .select('id, name, tenant_code, subdomain')
          .ilike('name', '%wellfit%')
          .single();

        if (!fallbackData) return null;
        tenantData = fallbackData;
      }

      return {
        tenantId: tenantData.id,
        tenantName: tenantData.name,
        tenantCode: tenantData.tenant_code,
        subdomain: tenantData.subdomain,
        isActive: true,
        assignedAt: new Date().toISOString()
      };
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if current user has access to a specific tenant
   */
  async canAccessTenant(tenantId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Check if super admin (they can access all tenants)
      const { data: superAdminData } = await supabase
        .from('super_admin_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (superAdminData) return true;

      // Check if user's profile has this tenant_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      return !!profileData;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get tenant admin panel URL
   */
  getTenantAdminUrl(tenant: TenantAssignment): string {
    // For now, return the admin route with tenant context
    // In production, this might be tenant-specific subdomains
    return `/admin?tenant=${tenant.tenantId}&code=${tenant.tenantCode || ''}`;
  }
};

export default TenantAssignmentService;
