/**
 * BillingProviderForm — NPI-validated provider registration
 *
 * Purpose: Create/edit billing providers with real-time NPI Registry verification
 * Used by: Revenue & Billing admin sections
 *
 * MCP Integration: NPI Registry (Tier 1) via useNPIValidation hook
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNPIValidation, type NPIValidationStatus } from '../../hooks/useNPIValidation';
import { useCreateBillingProvider, useUpdateBillingProvider, useBillingProviders } from '../../hooks/useBillingData';
import type { BillingProvider, CreateBillingProvider } from '../../types/billing';
import { isValidNPIFormat } from '../../services/mcp/mcpNPIRegistryClient';
import { auditLogger } from '../../services/auditLogger';

interface BillingProviderFormProps {
  editingProvider?: BillingProvider | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

const statusColors: Record<NPIValidationStatus, string> = {
  idle: 'border-gray-300',
  validating: 'border-blue-400 ring-2 ring-blue-200',
  valid: 'border-green-500 ring-2 ring-green-200',
  invalid: 'border-red-500 ring-2 ring-red-200',
  error: 'border-orange-500 ring-2 ring-orange-200',
};

const statusLabels: Record<NPIValidationStatus, string> = {
  idle: '',
  validating: 'Verifying with NPI Registry...',
  valid: 'NPI verified and active',
  invalid: 'NPI not valid or inactive',
  error: 'Could not verify NPI',
};

const BillingProviderForm: React.FC<BillingProviderFormProps> = ({
  editingProvider,
  onSaved,
  onCancel,
}) => {
  const npiValidation = useNPIValidation();
  const createMutation = useCreateBillingProvider();
  const updateMutation = useUpdateBillingProvider();
  const { data: existingProviders = [] } = useBillingProviders();

  const [formData, setFormData] = useState<Partial<CreateBillingProvider>>({
    npi: editingProvider?.npi || '',
    organization_name: editingProvider?.organization_name || '',
    taxonomy_code: editingProvider?.taxonomy_code || '',
    ein: editingProvider?.ein || '',
    contact_phone: editingProvider?.contact_phone || '',
    address_line1: editingProvider?.address_line1 || '',
    city: editingProvider?.city || '',
    state: editingProvider?.state || '',
    zip: editingProvider?.zip || '',
  });

  const [showProviderList, setShowProviderList] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEditing = !!editingProvider;

  // Auto-populate form when NPI lookup returns provider details
  useEffect(() => {
    if (npiValidation.provider && npiValidation.status === 'valid') {
      const provider = npiValidation.provider;
      const primaryTaxonomy = provider.taxonomies.find(t => t.primary) || provider.taxonomies[0];
      const practiceAddress = provider.addresses.find(a => a.type === 'LOCATION') || provider.addresses[0];

      setFormData(prev => ({
        ...prev,
        organization_name: prev.organization_name || provider.name,
        taxonomy_code: prev.taxonomy_code || primaryTaxonomy?.code || '',
        address_line1: prev.address_line1 || practiceAddress?.address_1 || '',
        city: prev.city || practiceAddress?.city || '',
        state: prev.state || practiceAddress?.state || '',
        zip: prev.zip || practiceAddress?.postal_code || '',
        contact_phone: prev.contact_phone || practiceAddress?.telephone || '',
      }));
    }
  }, [npiValidation.provider, npiValidation.status]);

  const handleNPIChange = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setFormData(prev => ({ ...prev, npi: digits }));
    npiValidation.reset();
    setSaveError(null);
  }, [npiValidation]);

  const handleVerifyNPI = useCallback(async () => {
    if (!formData.npi) return;
    await npiValidation.validateAndLookup(formData.npi);
  }, [formData.npi, npiValidation]);

  const handleFieldChange = useCallback((field: keyof CreateBillingProvider, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveError(null);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!formData.npi || !isValidNPIFormat(formData.npi)) {
      setSaveError('Valid NPI is required');
      return;
    }

    // Check for duplicate NPI (only for new providers)
    if (!isEditing) {
      const duplicate = existingProviders.find(p => p.npi === formData.npi);
      if (duplicate) {
        setSaveError(`NPI ${formData.npi} is already registered to ${duplicate.organization_name || 'another provider'}`);
        return;
      }
    }

    try {
      if (isEditing && editingProvider) {
        await updateMutation.mutateAsync({
          id: editingProvider.id,
          updates: formData,
        });
        await auditLogger.clinical('BILLING_PROVIDER_UPDATED', false, {
          provider_id: editingProvider.id,
          npi: formData.npi,
        });
      } else {
        const providerData: CreateBillingProvider = {
          npi: formData.npi,
          organization_name: formData.organization_name || null,
          taxonomy_code: formData.taxonomy_code || null,
          ein: formData.ein || null,
          contact_phone: formData.contact_phone || null,
          address_line1: formData.address_line1 || null,
          city: formData.city || null,
          state: formData.state || null,
          zip: formData.zip || null,
          user_id: null,
          submitter_id: null,
        };
        await createMutation.mutateAsync(providerData);
        await auditLogger.clinical('BILLING_PROVIDER_CREATED', false, {
          npi: formData.npi,
          organization_name: formData.organization_name,
        });
      }
      onSaved?.();
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      setSaveError(error);
      await auditLogger.error(
        'BILLING_PROVIDER_SAVE_FAILED',
        err instanceof Error ? err : new Error(error),
        { npi: formData.npi }
      );
    }
  }, [formData, isEditing, editingProvider, existingProviders, createMutation, updateMutation, onSaved]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      {/* Provider List Toggle */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowProviderList(!showProviderList)}
          className="text-sm font-medium text-[#1BA39C] hover:underline"
        >
          {showProviderList ? 'Hide' : 'Show'} registered providers ({existingProviders.length})
        </button>
        {showProviderList && existingProviders.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">NPI</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Taxonomy</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {existingProviders.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">{p.npi}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{p.organization_name || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{p.taxonomy_code || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{p.state || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* NPI Input with Validation */}
        <div>
          <label htmlFor="npi" className="block text-sm font-bold text-black mb-1">
            NPI Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                id="npi"
                type="text"
                inputMode="numeric"
                pattern="\d{10}"
                maxLength={10}
                value={formData.npi || ''}
                onChange={(e) => handleNPIChange(e.target.value)}
                placeholder="Enter 10-digit NPI"
                className={`w-full px-4 py-3 text-lg font-mono border-2 rounded-lg focus:outline-none transition-all ${statusColors[npiValidation.status]}`}
                aria-describedby="npi-status"
              />
              {formData.npi && formData.npi.length === 10 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {npiValidation.formatValid ? (
                    <span className="text-green-600" title="Luhn check passed">Format OK</span>
                  ) : (
                    <span className="text-red-600" title="Luhn check failed">Bad format</span>
                  )}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleVerifyNPI}
              disabled={!formData.npi || formData.npi.length !== 10 || npiValidation.status === 'validating'}
              className="px-6 py-3 bg-[#1BA39C] text-white font-bold rounded-lg hover:bg-[#158A84] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md min-h-[44px] min-w-[44px]"
            >
              {npiValidation.status === 'validating' ? 'Verifying...' : 'Verify NPI'}
            </button>
          </div>
          <p id="npi-status" className="mt-1 text-sm" role="status">
            {npiValidation.status === 'valid' && (
              <span className="text-green-700 font-medium">{statusLabels.valid} — {npiValidation.validation?.provider_name}</span>
            )}
            {npiValidation.status === 'invalid' && (
              <span className="text-red-700 font-medium">{npiValidation.error}</span>
            )}
            {npiValidation.status === 'error' && (
              <span className="text-orange-700 font-medium">{npiValidation.error}</span>
            )}
            {npiValidation.status === 'validating' && (
              <span className="text-blue-700">{statusLabels.validating}</span>
            )}
          </p>
        </div>

        {/* Provider Details from Registry */}
        {npiValidation.provider && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-bold text-green-800 mb-2">Registry Data (auto-populated)</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-green-600">Name:</span> {npiValidation.provider.name}</div>
              <div><span className="text-green-600">Type:</span> {npiValidation.provider.type}</div>
              {npiValidation.provider.credential && (
                <div><span className="text-green-600">Credential:</span> {npiValidation.provider.credential}</div>
              )}
              {npiValidation.provider.taxonomies.length > 0 && (
                <div><span className="text-green-600">Specialty:</span> {npiValidation.provider.taxonomies[0].description}</div>
              )}
              <div><span className="text-green-600">Status:</span> {npiValidation.provider.status}</div>
              <div><span className="text-green-600">Since:</span> {npiValidation.provider.enumeration_date}</div>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="org_name" className="block text-sm font-bold text-black mb-1">Organization / Provider Name</label>
            <input
              id="org_name"
              type="text"
              value={formData.organization_name || ''}
              onChange={(e) => handleFieldChange('organization_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
          <div>
            <label htmlFor="taxonomy" className="block text-sm font-bold text-black mb-1">Taxonomy Code</label>
            <input
              id="taxonomy"
              type="text"
              value={formData.taxonomy_code || ''}
              onChange={(e) => handleFieldChange('taxonomy_code', e.target.value)}
              placeholder="e.g. 207R00000X"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C] font-mono"
            />
          </div>
          <div>
            <label htmlFor="ein" className="block text-sm font-bold text-black mb-1">EIN (Tax ID)</label>
            <input
              id="ein"
              type="text"
              value={formData.ein || ''}
              onChange={(e) => handleFieldChange('ein', e.target.value)}
              placeholder="XX-XXXXXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C] font-mono"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-bold text-black mb-1">Contact Phone</label>
            <input
              id="phone"
              type="tel"
              value={formData.contact_phone || ''}
              onChange={(e) => handleFieldChange('contact_phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
        </div>

        {/* Address */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-bold text-black mb-1">Address</label>
            <input
              id="address"
              type="text"
              value={formData.address_line1 || ''}
              onChange={(e) => handleFieldChange('address_line1', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
          <div>
            <label htmlFor="city" className="block text-sm font-bold text-black mb-1">City</label>
            <input
              id="city"
              type="text"
              value={formData.city || ''}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="state" className="block text-sm font-bold text-black mb-1">State</label>
              <input
                id="state"
                type="text"
                maxLength={2}
                value={formData.state || ''}
                onChange={(e) => handleFieldChange('state', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C] uppercase"
              />
            </div>
            <div>
              <label htmlFor="zip" className="block text-sm font-bold text-black mb-1">ZIP</label>
              <input
                id="zip"
                type="text"
                maxLength={10}
                value={formData.zip || ''}
                onChange={(e) => handleFieldChange('zip', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1BA39C] focus:border-[#1BA39C]"
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm font-medium">{saveError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving || !formData.npi}
            className="px-6 py-3 bg-[#1BA39C] text-white font-bold rounded-lg hover:bg-[#158A84] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md min-h-[44px]"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Provider' : 'Register Provider'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-all min-h-[44px]"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default BillingProviderForm;
