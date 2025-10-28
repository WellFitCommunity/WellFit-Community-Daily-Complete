/**
 * Tenant Branding Manager
 * Admin UI for managing tenant branding (colors, logos, themes)
 * Replaces hardcoded branding in branding.config.ts with database-driven configuration
 */

import React, { useState, useEffect } from 'react';
import {
  fetchAllActiveTenants,
  fetchTenantBrandingById,
  updateTenantBranding,
  uploadTenantLogo,
  generateGradient,
  isValidHexColor,
  type TenantBrandingData,
} from '../../services/tenantBrandingService';

const TenantBrandingManager: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [currentBranding, setCurrentBranding] = useState<TenantBrandingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [appName, setAppName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#003865');
  const [secondaryColor, setSecondaryColor] = useState('#8cc63f');
  const [accentColor, setAccentColor] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [contactInfo, setContactInfo] = useState('');
  const [customFooter, setCustomFooter] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Load all tenants on mount
  useEffect(() => {
    loadTenants();
  }, []);

  // Load branding when tenant is selected
  useEffect(() => {
    if (selectedTenantId) {
      loadTenantBranding(selectedTenantId);
    }
  }, [selectedTenantId]);

  const loadTenants = async () => {
    setLoading(true);
    const allTenants = await fetchAllActiveTenants();
    setTenants(allTenants);
    setLoading(false);

    if (allTenants.length > 0 && !selectedTenantId) {
      setSelectedTenantId(allTenants[0].id);
    }
  };

  const loadTenantBranding = async (tenantId: string) => {
    setLoading(true);
    const branding = await fetchTenantBrandingById(tenantId);
    setCurrentBranding(branding);

    if (branding) {
      setAppName(branding.appName);
      setPrimaryColor(branding.primaryColor);
      setSecondaryColor(branding.secondaryColor);
      setAccentColor(branding.accentColor || '');
      setTextColor(branding.textColor);
      setContactInfo(branding.contactInfo);
      setCustomFooter(branding.customFooter || '');
      setLogoPreview(branding.logoUrl);
    }

    setLoading(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!selectedTenantId) return;

    // Validate colors
    if (!isValidHexColor(primaryColor)) {
      setMessage({ type: 'error', text: 'Invalid primary color format. Use hex format like #003865' });
      return;
    }
    if (!isValidHexColor(secondaryColor)) {
      setMessage({ type: 'error', text: 'Invalid secondary color format. Use hex format like #8cc63f' });
      return;
    }
    if (accentColor && !isValidHexColor(accentColor)) {
      setMessage({ type: 'error', text: 'Invalid accent color format. Use hex format like #FF6B35' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Upload logo if changed
      let logoUrl = logoPreview;
      if (logoFile) {
        const uploadResult = await uploadTenantLogo(selectedTenantId, logoFile);
        if (uploadResult.success && uploadResult.url) {
          logoUrl = uploadResult.url;
        } else {
          setMessage({ type: 'error', text: uploadResult.error || 'Failed to upload logo' });
          setSaving(false);
          return;
        }
      }

      // Update branding
      const gradient = generateGradient(primaryColor, secondaryColor);
      const result = await updateTenantBranding(selectedTenantId, {
        appName,
        logoUrl,
        primaryColor,
        secondaryColor,
        accentColor: accentColor || undefined,
        textColor,
        gradient,
        contactInfo,
        customFooter: customFooter || undefined,
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Branding updated successfully!' });
        loadTenantBranding(selectedTenantId); // Reload
        setLogoFile(null);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update branding' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const gradientPreview = generateGradient(primaryColor, secondaryColor);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🎨 Tenant Branding Manager
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Customize colors, logos, and themes for each tenant (Houston, Miami, Phoenix)
        </p>
      </div>

      {/* Tenant Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Tenant
        </label>
        <select
          value={selectedTenantId || ''}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          disabled={loading}
        >
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.subdomain})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading branding...</p>
        </div>
      )}

      {!loading && currentBranding && (
        <div className="space-y-6">
          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Live Preview */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Live Preview
            </h3>
            <div
              className="rounded-lg p-6 text-center"
              style={{ background: gradientPreview, color: textColor }}
            >
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="h-16 mx-auto mb-4" />
              )}
              <h2 className="text-2xl font-bold">{appName || 'App Name'}</h2>
              <p className="mt-2 text-sm">{contactInfo || 'Contact Info'}</p>
            </div>
          </div>

          {/* App Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Application Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="WellFit Houston"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Logo Upload
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleLogoChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              PNG, JPG, or SVG. Max 5MB.
            </p>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#003865"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Secondary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#8cc63f"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Accent Color (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={accentColor || '#FF6B35'}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#FF6B35"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Text Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="h-10 w-20 border border-gray-300 dark:border-gray-600 rounded"
                />
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contact Information
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Houston Senior Services"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Custom Footer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Custom Footer Text (Optional)
            </label>
            <textarea
              value={customFooter}
              onChange={(e) => setCustomFooter(e.target.value)}
              placeholder="© 2025 WellFit Houston. Powered by Houston Senior Services."
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => loadTenantBranding(selectedTenantId!)}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={saving}
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Branding'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantBrandingManager;
