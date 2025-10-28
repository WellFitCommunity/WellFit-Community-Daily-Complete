/**
 * Tenant Branding Service
 * Fetches and manages dynamic tenant branding from database
 * Replaces hardcoded branding in branding.config.ts
 */

import { supabase } from '../lib/supabaseClient';
import type { BrandingConfig } from '../branding.config';
import { defaultBranding } from '../branding.config';

export interface TenantBrandingData extends BrandingConfig {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  customCss?: Record<string, any>;
  themeSettings?: Record<string, any>;
  faviconUrl?: string;
  accentColor?: string;
}

/**
 * Fetch tenant branding by subdomain from database
 */
export async function fetchTenantBrandingBySubdomain(
  subdomain: string
): Promise<TenantBrandingData | null> {
  try {
    const { data, error } = await supabase.rpc('get_tenant_branding_by_subdomain', {
      p_subdomain: subdomain,
    });

    if (error) {
      console.error('[TenantBranding] Error fetching branding:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn(`[TenantBranding] No branding found for subdomain: ${subdomain}`);
      return null;
    }

    const tenant = data[0];

    return {
      id: tenant.id,
      name: tenant.name,
      subdomain,
      appName: tenant.app_name || defaultBranding.appName,
      logoUrl: tenant.logo_url || defaultBranding.logoUrl,
      primaryColor: tenant.primary_color || defaultBranding.primaryColor,
      secondaryColor: tenant.secondary_color || defaultBranding.secondaryColor,
      accentColor: tenant.accent_color,
      textColor: tenant.text_color || defaultBranding.textColor,
      gradient: tenant.gradient || defaultBranding.gradient,
      contactInfo: tenant.contact_info || defaultBranding.contactInfo,
      customFooter: tenant.custom_footer,
      faviconUrl: tenant.favicon_url,
      isActive: true,
      customCss: tenant.custom_css || {},
      themeSettings: tenant.theme_settings || {},
    };
  } catch (error) {
    console.error('[TenantBranding] Exception fetching branding:', error);
    return null;
  }
}

/**
 * Fetch tenant branding by tenant ID (for admin panel tenant switcher)
 */
export async function fetchTenantBrandingById(
  tenantId: string
): Promise<TenantBrandingData | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[TenantBranding] Error fetching branding by ID:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      subdomain: data.subdomain || '',
      appName: data.app_name || defaultBranding.appName,
      logoUrl: data.logo_url || defaultBranding.logoUrl,
      primaryColor: data.primary_color || defaultBranding.primaryColor,
      secondaryColor: data.secondary_color || defaultBranding.secondaryColor,
      accentColor: data.accent_color,
      textColor: data.text_color || defaultBranding.textColor,
      gradient: data.gradient || defaultBranding.gradient,
      contactInfo: data.contact_info || defaultBranding.contactInfo,
      customFooter: data.custom_footer,
      faviconUrl: data.favicon_url,
      isActive: data.is_active,
      customCss: data.custom_css || {},
      themeSettings: data.theme_settings || {},
    };
  } catch (error) {
    console.error('[TenantBranding] Exception fetching branding by ID:', error);
    return null;
  }
}

/**
 * Fetch all active tenants (for admin tenant switcher dropdown)
 */
export async function fetchAllActiveTenants(): Promise<
  Array<{
    id: string;
    name: string;
    subdomain: string;
    appName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    isActive: boolean;
  }>
> {
  try {
    const { data, error } = await supabase.rpc('get_all_active_tenants');

    if (error) {
      console.error('[TenantBranding] Error fetching all tenants:', error);
      return [];
    }

    return (data || []).map((tenant: any) => ({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain || '',
      appName: tenant.app_name || tenant.name,
      logoUrl: tenant.logo_url || '',
      primaryColor: tenant.primary_color || defaultBranding.primaryColor,
      secondaryColor: tenant.secondary_color || defaultBranding.secondaryColor,
      isActive: tenant.is_active,
    }));
  } catch (error) {
    console.error('[TenantBranding] Exception fetching all tenants:', error);
    return [];
  }
}

/**
 * Update tenant branding (admin only)
 */
export async function updateTenantBranding(
  tenantId: string,
  updates: Partial<TenantBrandingData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const updateData: any = {};

    if (updates.appName !== undefined) updateData.app_name = updates.appName;
    if (updates.logoUrl !== undefined) updateData.logo_url = updates.logoUrl;
    if (updates.primaryColor !== undefined) updateData.primary_color = updates.primaryColor;
    if (updates.secondaryColor !== undefined) updateData.secondary_color = updates.secondaryColor;
    if (updates.accentColor !== undefined) updateData.accent_color = updates.accentColor;
    if (updates.textColor !== undefined) updateData.text_color = updates.textColor;
    if (updates.gradient !== undefined) updateData.gradient = updates.gradient;
    if (updates.contactInfo !== undefined) updateData.contact_info = updates.contactInfo;
    if (updates.customFooter !== undefined) updateData.custom_footer = updates.customFooter;
    if (updates.faviconUrl !== undefined) updateData.favicon_url = updates.faviconUrl;
    if (updates.customCss !== undefined) updateData.custom_css = updates.customCss;
    if (updates.themeSettings !== undefined) updateData.theme_settings = updates.themeSettings;

    const { error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', tenantId);

    if (error) {
      console.error('[TenantBranding] Error updating branding:', error);
      return { success: false, error: error.message };
    }

    console.log(`[TenantBranding] Successfully updated branding for tenant ${tenantId}`);

    return { success: true };
  } catch (error) {
    console.error('[TenantBranding] Exception updating branding:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Upload tenant logo to Supabase Storage
 */
export async function uploadTenantLogo(
  tenantId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Please upload PNG, JPG, or SVG.',
      };
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File too large. Maximum size is 5MB.',
      };
    }

    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${tenantId}/logo-${timestamp}.${extension}`;

    const { data, error } = await supabase.storage
      .from('tenant-logos')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[TenantBranding] Error uploading logo:', error);
      return { success: false, error: error.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('tenant-logos').getPublicUrl(data.path);

    const updateResult = await updateTenantBranding(tenantId, {
      logoUrl: publicUrl,
    });

    if (!updateResult.success) {
      return {
        success: false,
        error: 'Logo uploaded but failed to update tenant record',
      };
    }

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error('[TenantBranding] Exception uploading logo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current tenant branding based on hostname
 */
export async function getCurrentTenantBranding(): Promise<BrandingConfig> {
  if (typeof window === 'undefined') return defaultBranding;

  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  let subdomain = 'www';
  if (parts.length > 2 && parts[0] !== 'www') {
    subdomain = parts[0].toLowerCase();
  }

  const tenantBranding = await fetchTenantBrandingBySubdomain(subdomain);

  if (tenantBranding) {
    return {
      appName: tenantBranding.appName,
      logoUrl: tenantBranding.logoUrl,
      primaryColor: tenantBranding.primaryColor,
      secondaryColor: tenantBranding.secondaryColor,
      textColor: tenantBranding.textColor,
      gradient: tenantBranding.gradient,
      contactInfo: tenantBranding.contactInfo,
      customFooter: tenantBranding.customFooter,
    };
  }

  return defaultBranding;
}

export function generateGradient(color1: string, color2: string): string {
  return `linear-gradient(to bottom right, ${color1}, ${color2})`;
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
