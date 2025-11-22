/**
 * Smart Tenant Detection Service
 *
 * Automatically detects which tenant a user belongs to based on their email/phone.
 * Pre-populates tenant context for seamless login experience.
 *
 * Features:
 * - Email/phone → tenant mapping
 * - Fallback to WellFit (WF-001) as default
 * - Tenant branding pre-load
 * - Security: Only shows tenant info AFTER successful authentication
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { auditLogger } from './auditLogger';

export interface TenantInfo {
  tenant_id: string;
  tenant_code: string;
  display_name: string;
  subdomain: string;
}

export class TenantDetectionService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Detect tenant by user identifier (email or phone)
   * Returns tenant info or null if not found
   */
  async detectTenant(userIdentifier: string): Promise<TenantInfo | null> {
    if (!userIdentifier || userIdentifier.trim() === '') {
      return null;
    }

    try {
      // Call database function for smart detection
      const { data, error } = await this.supabase
        .rpc('get_tenant_by_identifier', {
          user_identifier: userIdentifier.trim().toLowerCase()
        });

      if (error) {
        await auditLogger.error('TENANT_DETECTION_FAILED', error, { userIdentifier });
        return null;
      }

      if (data && data.length > 0) {
        return {
          tenant_id: data[0].tenant_id,
          tenant_code: data[0].tenant_code,
          display_name: data[0].display_name,
          subdomain: data[0].subdomain,
        };
      }

      return null;
    } catch (err) {
      await auditLogger.error('TENANT_DETECTION_EXCEPTION', err as Error, { userIdentifier });
      return null;
    }
  }

  /**
   * Get default WellFit tenant
   */
  async getDefaultTenant(): Promise<TenantInfo | null> {
    try {
      const { data, error } = await this.supabase
        .from('tenants')
        .select('id, tenant_code, display_name, subdomain')
        .or('subdomain.eq.www,tenant_code.eq.WF-001')
        .limit(1)
        .single();

      if (error || !data) {
        await auditLogger.error('DEFAULT_TENANT_LOOKUP_FAILED', error || new Error('No data'), {});
        return null;
      }

      return {
        tenant_id: data.id,
        tenant_code: data.tenant_code || 'WF-001',
        display_name: data.display_name || 'WellFit Community',
        subdomain: data.subdomain || 'www',
      };
    } catch (err) {
      await auditLogger.error('DEFAULT_TENANT_EXCEPTION', err as Error, {});
      return null;
    }
  }

  /**
   * Verify user belongs to detected tenant
   * Called AFTER authentication for security
   */
  async verifyTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.tenant_id === tenantId;
    } catch (err) {
      await auditLogger.error('TENANT_ACCESS_VERIFICATION_FAILED', err as Error, { userId, tenantId });
      return false;
    }
  }

  /**
   * Format tenant display for UI
   */
  formatTenantDisplay(tenant: TenantInfo | null): string {
    if (!tenant) return '';

    return `${tenant.display_name} (${tenant.tenant_code})`;
  }
}

// Singleton instance factory
let tenantDetectionService: TenantDetectionService | null = null;

export const getTenantDetectionService = (supabase: SupabaseClient): TenantDetectionService => {
  if (!tenantDetectionService) {
    tenantDetectionService = new TenantDetectionService(supabase);
  }
  return tenantDetectionService;
};

export default TenantDetectionService;
