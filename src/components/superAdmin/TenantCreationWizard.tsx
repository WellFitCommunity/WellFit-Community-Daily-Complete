/**
 * TenantCreationWizard - Create New Tenant Wizard
 *
 * Multi-step wizard for creating new tenants with proper licensing.
 * Uses Envision Atlus design system.
 *
 * Steps:
 * 1. Organization Info (name, prefix, subdomain)
 * 2. Product Selection (WellFit, Atlus, or Both)
 * 3. License & Quotas (tier, limits)
 * 4. Admin Setup (billing contact)
 * 5. Review & Create
 */

import React, { useState } from 'react';
import {
  Building2,
  Package,
  CreditCard,
  UserCog,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Heart,
  Stethoscope,
  Layers,
  AlertCircle
} from 'lucide-react';
import { EACard, EACardHeader, EACardContent, EACardFooter } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { SuperAdminService } from '../../services/superAdminService';
import { auditLogger } from '../../services/auditLogger';

interface TenantCreationWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

interface TenantFormData {
  // Step 1: Organization
  name: string;
  orgPrefix: string;
  subdomain: string;

  // Step 2: Products
  products: ('wellfit' | 'atlus')[];

  // Step 3: License
  licenseTier: 'trial' | 'basic' | 'standard' | 'premium' | 'enterprise';
  maxUsers: number;
  maxPatients: number;
  storageQuotaGb: number;

  // Step 4: Admin
  billingEmail: string;
  billingContact: string;
  notes: string;
}

const STEPS = [
  { id: 1, label: 'Organization', icon: Building2 },
  { id: 2, label: 'Products', icon: Package },
  { id: 3, label: 'License', icon: CreditCard },
  { id: 4, label: 'Admin', icon: UserCog },
  { id: 5, label: 'Review', icon: CheckCircle2 },
];

const LICENSE_TIERS = [
  { value: 'trial', label: 'Trial', description: '30-day free trial', maxUsers: 10, maxPatients: 50 },
  { value: 'basic', label: 'Basic', description: 'Small organizations', maxUsers: 25, maxPatients: 200 },
  { value: 'standard', label: 'Standard', description: 'Growing organizations', maxUsers: 100, maxPatients: 500 },
  { value: 'premium', label: 'Premium', description: 'Large organizations', maxUsers: 500, maxPatients: 2500 },
  { value: 'enterprise', label: 'Enterprise', description: 'Unlimited scale', maxUsers: 10000, maxPatients: 50000 },
];

const TenantCreationWizard: React.FC<TenantCreationWizardProps> = ({ onClose, onCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    orgPrefix: '',
    subdomain: '',
    products: ['wellfit', 'atlus'],
    licenseTier: 'standard',
    maxUsers: 100,
    maxPatients: 500,
    storageQuotaGb: 50,
    billingEmail: '',
    billingContact: '',
    notes: '',
  });

  const updateFormData = (updates: Partial<TenantFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setError(null);
  };

  const getLicenseDigit = (): number => {
    const hasWellfit = formData.products.includes('wellfit');
    const hasAtlus = formData.products.includes('atlus');

    if (hasWellfit && hasAtlus) return 0;
    if (hasAtlus && !hasWellfit) return 8;
    if (hasWellfit && !hasAtlus) return 9;
    return 0;
  };

  const getGeneratedTenantCode = (): string => {
    const prefix = formData.orgPrefix.toUpperCase() || 'XX';
    const digit = getLicenseDigit();
    return `${prefix}-${digit}001`;
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError('Organization name is required');
          return false;
        }
        if (!formData.orgPrefix.trim() || formData.orgPrefix.length < 2 || formData.orgPrefix.length > 4) {
          setError('Organization prefix must be 2-4 letters');
          return false;
        }
        if (!/^[A-Za-z]+$/.test(formData.orgPrefix)) {
          setError('Prefix must contain only letters');
          return false;
        }
        if (!formData.subdomain.trim() || formData.subdomain.length < 3) {
          setError('Subdomain must be at least 3 characters');
          return false;
        }
        if (!/^[a-z0-9-]+$/.test(formData.subdomain)) {
          setError('Subdomain can only contain lowercase letters, numbers, and hyphens');
          return false;
        }
        return true;

      case 2:
        if (formData.products.length === 0) {
          setError('At least one product must be selected');
          return false;
        }
        return true;

      case 3:
        if (formData.maxUsers < 1) {
          setError('Max users must be at least 1');
          return false;
        }
        if (formData.maxPatients < 1) {
          setError('Max patients must be at least 1');
          return false;
        }
        return true;

      case 4:
        // Billing info is optional
        return true;

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const superAdmin = await SuperAdminService.getCurrentSuperAdmin();
      if (!superAdmin) {
        throw new Error('Unauthorized');
      }

      // Call RPC to create tenant
      const { data, error: rpcError } = await (await import('../../lib/supabaseClient')).supabase.rpc('create_tenant', {
        p_name: formData.name,
        p_org_prefix: formData.orgPrefix.toUpperCase(),
        p_subdomain: formData.subdomain.toLowerCase(),
        p_products: formData.products,
        p_license_tier: formData.licenseTier,
        p_max_users: formData.maxUsers,
        p_max_patients: formData.maxPatients,
        p_billing_email: formData.billingEmail || null,
        p_super_admin_id: superAdmin.id,
      });

      if (rpcError) {
        throw rpcError;
      }

      await auditLogger.info('TENANT_CREATED', {
        category: 'ADMINISTRATIVE',
        tenantCode: getGeneratedTenantCode(),
        tenantName: formData.name,
        products: formData.products,
        licenseTier: formData.licenseTier,
      });

      onCreated();
      onClose();
    } catch (err) {
      await auditLogger.error('TENANT_CREATION_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        tenantName: formData.name,
      });
      setError((err as Error).message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (product: 'wellfit' | 'atlus') => {
    const current = formData.products;
    if (current.includes(product)) {
      // Don't allow removing if it's the last one
      if (current.length > 1) {
        updateFormData({ products: current.filter(p => p !== product) });
      }
    } else {
      updateFormData({ products: [...current, product] });
    }
  };

  const selectLicenseTier = (tier: typeof formData.licenseTier) => {
    const tierInfo = LICENSE_TIERS.find(t => t.value === tier);
    updateFormData({
      licenseTier: tier,
      maxUsers: tierInfo?.maxUsers || 100,
      maxPatients: tierInfo?.maxPatients || 500,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <EACard variant="elevated" className="overflow-hidden">
          {/* Header */}
          <EACardHeader
            icon={<Building2 className="w-6 h-6" />}
            action={
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            }
          >
            <h2 className="text-xl font-semibold text-white">Create New Tenant</h2>
            <p className="text-sm text-slate-400">Step {currentStep} of 5</p>
          </EACardHeader>

          {/* Progress Bar */}
          <div className="px-6 py-3 bg-slate-900/50 border-b border-slate-700">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        transition-colors duration-200
                        ${currentStep >= step.id
                          ? 'bg-[#00857a] text-white'
                          : 'bg-slate-700 text-slate-400'
                        }
                      `}
                    >
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`
                        text-sm hidden sm:block
                        ${currentStep >= step.id ? 'text-white' : 'text-slate-500'}
                      `}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`
                        flex-1 h-0.5 mx-2
                        ${currentStep > step.id ? 'bg-[#00857a]' : 'bg-slate-700'}
                      `}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Content */}
          <EACardContent className="overflow-y-auto max-h-[50vh]">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Organization */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateFormData({ name: e.target.value })}
                    placeholder="Houston Community Hospital"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Organization Prefix * (2-4 letters)
                    </label>
                    <input
                      type="text"
                      value={formData.orgPrefix}
                      onChange={(e) => updateFormData({ orgPrefix: e.target.value.toUpperCase().slice(0, 4) })}
                      placeholder="HCH"
                      maxLength={4}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden font-mono uppercase"
                    />
                    <p className="mt-1 text-xs text-slate-500">Used in tenant code (e.g., HCH-0001)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Subdomain *
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={formData.subdomain}
                        onChange={(e) => updateFormData({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="houston-hospital"
                        className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-l-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                      />
                      <span className="px-3 py-3 bg-slate-600 border border-l-0 border-slate-600 rounded-r-lg text-slate-400 text-sm">
                        .wellfit.com
                      </span>
                    </div>
                  </div>
                </div>

                {formData.orgPrefix && (
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">Generated Tenant Code:</p>
                    <p className="text-lg font-mono font-bold text-[#00857a]">{getGeneratedTenantCode()}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Final code depends on selected products
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Products */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <p className="text-slate-300">
                  Select which products this tenant will have access to:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* WellFit Card */}
                  <div
                    onClick={() => toggleProduct('wellfit')}
                    className={`
                      p-6 rounded-lg border-2 cursor-pointer transition-all
                      ${formData.products.includes('wellfit')
                        ? 'border-[#00857a] bg-[#00857a]/10'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        p-3 rounded-lg
                        ${formData.products.includes('wellfit') ? 'bg-[#00857a]/20' : 'bg-slate-700'}
                      `}>
                        <Heart className={`w-6 h-6 ${formData.products.includes('wellfit') ? 'text-[#00857a]' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">WellFit</h3>
                        <p className="text-sm text-slate-400 mt-1">
                          Community engagement platform for seniors, caregivers, and community organizations.
                        </p>
                        <ul className="mt-3 text-xs text-slate-500 space-y-1">
                          <li>• Check-ins & wellness tracking</li>
                          <li>• Community messaging</li>
                          <li>• Caregiver dashboard</li>
                          <li>• Event management</li>
                        </ul>
                      </div>
                      {formData.products.includes('wellfit') && (
                        <CheckCircle2 className="w-6 h-6 text-[#00857a]" />
                      )}
                    </div>
                  </div>

                  {/* Envision Atlus Card */}
                  <div
                    onClick={() => toggleProduct('atlus')}
                    className={`
                      p-6 rounded-lg border-2 cursor-pointer transition-all
                      ${formData.products.includes('atlus')
                        ? 'border-[#00857a] bg-[#00857a]/10'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                      }
                    `}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`
                        p-3 rounded-lg
                        ${formData.products.includes('atlus') ? 'bg-[#00857a]/20' : 'bg-slate-700'}
                      `}>
                        <Stethoscope className={`w-6 h-6 ${formData.products.includes('atlus') ? 'text-[#00857a]' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">Envision Atlus</h3>
                        <p className="text-sm text-slate-400 mt-1">
                          Clinical care management engine for healthcare providers and clinicians.
                        </p>
                        <ul className="mt-3 text-xs text-slate-500 space-y-1">
                          <li>• AI-powered documentation</li>
                          <li>• EHR/FHIR integration</li>
                          <li>• Risk assessment & predictions</li>
                          <li>• Telehealth capabilities</li>
                        </ul>
                      </div>
                      {formData.products.includes('atlus') && (
                        <CheckCircle2 className="w-6 h-6 text-[#00857a]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Both Products Badge */}
                {formData.products.includes('wellfit') && formData.products.includes('atlus') && (
                  <div className="p-4 bg-linear-to-r from-[#00857a]/20 to-[#FF6B35]/20 rounded-lg border border-[#00857a]/30 flex items-center gap-3">
                    <Layers className="w-6 h-6 text-[#00857a]" />
                    <div>
                      <p className="font-medium text-white">Full Platform Access</p>
                      <p className="text-sm text-slate-400">
                        Tenant code will use prefix <span className="font-mono text-[#00857a]">-0</span> (Both products)
                      </p>
                    </div>
                  </div>
                )}

                {formData.products.length === 1 && (
                  <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-sm text-slate-400">
                      Tenant code will use prefix{' '}
                      <span className="font-mono text-[#00857a]">
                        -{formData.products.includes('atlus') ? '8' : '9'}
                      </span>
                      {' '}({formData.products.includes('atlus') ? 'Atlus Only' : 'WellFit Only'})
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: License */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    License Tier
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {LICENSE_TIERS.map((tier) => (
                      <div
                        key={tier.value}
                        onClick={() => selectLicenseTier(tier.value as typeof formData.licenseTier)}
                        className={`
                          p-4 rounded-lg border-2 cursor-pointer transition-all
                          ${formData.licenseTier === tier.value
                            ? 'border-[#00857a] bg-[#00857a]/10'
                            : 'border-slate-600 bg-slate-800 hover:border-slate-500'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-white">{tier.label}</span>
                          {formData.licenseTier === tier.value && (
                            <CheckCircle2 className="w-5 h-5 text-[#00857a]" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{tier.description}</p>
                        <div className="mt-2 text-xs text-slate-500">
                          <span>{tier.maxUsers.toLocaleString()} users</span>
                          <span className="mx-1">•</span>
                          <span>{tier.maxPatients.toLocaleString()} patients</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Max Users
                    </label>
                    <input
                      type="number"
                      value={formData.maxUsers}
                      onChange={(e) => updateFormData({ maxUsers: parseInt(e.target.value) || 0 })}
                      min={1}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Max Patients
                    </label>
                    <input
                      type="number"
                      value={formData.maxPatients}
                      onChange={(e) => updateFormData({ maxPatients: parseInt(e.target.value) || 0 })}
                      min={1}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Storage (GB)
                    </label>
                    <input
                      type="number"
                      value={formData.storageQuotaGb}
                      onChange={(e) => updateFormData({ storageQuotaGb: parseInt(e.target.value) || 0 })}
                      min={1}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Admin */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billingEmail}
                    onChange={(e) => updateFormData({ billingEmail: e.target.value })}
                    placeholder="billing@organization.com"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Billing Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.billingContact}
                    onChange={(e) => updateFormData({ billingContact: e.target.value })}
                    placeholder="John Smith"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Internal Notes (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateFormData({ notes: e.target.value })}
                    placeholder="Any internal notes about this tenant..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-hidden resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#00857a]" />
                    Review Tenant Details
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Organization Name</p>
                      <p className="text-white font-medium">{formData.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Tenant Code</p>
                      <p className="text-[#00857a] font-mono font-bold">{getGeneratedTenantCode()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Subdomain</p>
                      <p className="text-white">{formData.subdomain}.wellfit.com</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Products</p>
                      <div className="flex gap-2 mt-1">
                        {formData.products.includes('wellfit') && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-sm">WellFit</span>
                        )}
                        {formData.products.includes('atlus') && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-sm">Atlus</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">License Tier</p>
                      <p className="text-white capitalize">{formData.licenseTier}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Limits</p>
                      <p className="text-white">
                        {formData.maxUsers.toLocaleString()} users / {formData.maxPatients.toLocaleString()} patients
                      </p>
                    </div>
                    {formData.billingEmail && (
                      <div className="col-span-2">
                        <p className="text-xs text-slate-500">Billing Email</p>
                        <p className="text-white">{formData.billingEmail}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-[#00857a]/10 border border-[#00857a]/30 rounded-lg">
                  <p className="text-sm text-slate-300">
                    <strong className="text-white">Ready to create!</strong> Click "Create Tenant" to provision
                    this new tenant with all the configured settings.
                  </p>
                </div>
              </div>
            )}
          </EACardContent>

          {/* Footer */}
          <EACardFooter className="justify-between">
            <EAButton
              variant="ghost"
              onClick={currentStep === 1 ? onClose : handleBack}
              disabled={loading}
              icon={currentStep === 1 ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </EAButton>

            {currentStep < 5 ? (
              <EAButton
                variant="primary"
                onClick={handleNext}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Continue
              </EAButton>
            ) : (
              <EAButton
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Create Tenant
              </EAButton>
            )}
          </EACardFooter>
        </EACard>
      </div>
    </div>
  );
};

export default TenantCreationWizard;
