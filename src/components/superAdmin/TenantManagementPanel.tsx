/**
 * TenantManagementPanel - Enhanced Tenant Administration
 *
 * Comprehensive tenant management with:
 * - Product filtering (WellFit, Atlus, Both)
 * - Tenant creation wizard
 * - License tier management
 * - Suspend/activate controls
 * - Module configuration
 *
 * Uses Envision Atlus design system.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { SuperAdminService } from '../../services/superAdminService';
import { TenantWithStatus, SuperAdminUser, ProductFilter, LicensedProduct } from '../../types/superAdmin';
import {
  Building2,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  Edit2,
  Hash,
  Sliders,
  Plus,
  Heart,
  Stethoscope,
  Layers,
  Filter,
  Search,
  Calendar,
  Shield,
  DollarSign
} from 'lucide-react';
import { auditLogger } from '../../services/auditLogger';
import { SuperAdminTenantModuleConfig } from './SuperAdminTenantModuleConfig';
import TenantCreationWizard from './TenantCreationWizard';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';

interface TenantManagementPanelProps {
  onViewTenant?: (tenantId: string) => void;
}

const PRODUCT_FILTERS: { value: ProductFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'All Tenants', icon: Layers },
  { value: 'wellfit', label: 'WellFit Only', icon: Heart },
  { value: 'atlus', label: 'Atlus Only', icon: Stethoscope },
  { value: 'both', label: 'Both Products', icon: Layers },
];

const TenantManagementPanel: React.FC<TenantManagementPanelProps> = ({ onViewTenant }) => {
  const [tenants, setTenants] = useState<TenantWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [superAdmin, setSuperAdmin] = useState<SuperAdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithStatus | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'suspend' | 'activate' | null>(null);
  const [showEditCodeDialog, setShowEditCodeDialog] = useState(false);
  const [editTenantCode, setEditTenantCode] = useState('');
  const [showModuleConfig, setShowModuleConfig] = useState(false);
  const [moduleConfigTenant, setModuleConfigTenant] = useState<TenantWithStatus | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // Filters
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tenantsData, adminData] = await Promise.all([
        SuperAdminService.getAllTenants(),
        SuperAdminService.getCurrentSuperAdmin()
      ]);
      setTenants(tenantsData);
      setSuperAdmin(adminData);
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANTS_LOAD_FAILED', err as Error, {
        category: 'ADMINISTRATIVE'
      });
      setError('Failed to load tenant data');
    } finally {
      setLoading(false);
    }
  };

  // Filter tenants based on product, search, and status
  const filteredTenants = useMemo(() => {
    return tenants.filter(tenant => {
      // Product filter
      if (productFilter !== 'all') {
        const products = tenant.licensedProducts || ['wellfit', 'atlus'];
        const hasWellfit = products.includes('wellfit');
        const hasAtlus = products.includes('atlus');

        if (productFilter === 'wellfit' && !(hasWellfit && !hasAtlus)) return false;
        if (productFilter === 'atlus' && !(hasAtlus && !hasWellfit)) return false;
        if (productFilter === 'both' && !(hasWellfit && hasAtlus)) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const status = tenant.isSuspended ? 'suspended' : 'active';
        if (statusFilter !== status) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = tenant.tenantName.toLowerCase().includes(query);
        const matchesCode = tenant.tenantCode?.toLowerCase().includes(query);
        const matchesSubdomain = tenant.subdomain?.toLowerCase().includes(query);
        if (!matchesName && !matchesCode && !matchesSubdomain) return false;
      }

      return true;
    });
  }, [tenants, productFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const active = tenants.filter(t => !t.isSuspended).length;
    const suspended = tenants.filter(t => t.isSuspended).length;
    const totalUsers = tenants.reduce((sum, t) => sum + (t.userCount || 0), 0);
    const totalSavings = tenants.reduce((sum, t) => sum + (t.totalSavings || 0), 0);
    const wellfitOnly = tenants.filter(t => {
      const p = t.licensedProducts || [];
      return p.includes('wellfit') && !p.includes('atlus');
    }).length;
    const atlusOnly = tenants.filter(t => {
      const p = t.licensedProducts || [];
      return p.includes('atlus') && !p.includes('wellfit');
    }).length;
    const both = tenants.filter(t => {
      const p = t.licensedProducts || [];
      return p.includes('wellfit') && p.includes('atlus');
    }).length;

    return { active, suspended, totalUsers, totalSavings, wellfitOnly, atlusOnly, both };
  }, [tenants]);

  const getProductBadges = (products: LicensedProduct[]) => {
    const hasWellfit = products.includes('wellfit');
    const hasAtlus = products.includes('atlus');

    if (hasWellfit && hasAtlus) {
      return (
        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30 flex items-center gap-1">
          <Layers className="w-3 h-3" />
          Both
        </span>
      );
    }
    if (hasWellfit) {
      return (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30 flex items-center gap-1">
          <Heart className="w-3 h-3" />
          WellFit
        </span>
      );
    }
    if (hasAtlus) {
      return (
        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30 flex items-center gap-1">
          <Stethoscope className="w-3 h-3" />
          Atlus
        </span>
      );
    }
    return null;
  };

  const handleSuspendTenant = async (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setConfirmAction('suspend');
    setShowConfirmDialog(true);
  };

  const handleActivateTenant = async (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setConfirmAction('activate');
    setShowConfirmDialog(true);
  };

  const confirmTenantAction = async () => {
    if (!selectedTenant || !superAdmin || !confirmAction) return;

    try {
      setActionLoading(selectedTenant.tenantId);
      setShowConfirmDialog(false);

      if (confirmAction === 'suspend') {
        await SuperAdminService.suspendTenant({
          tenantId: selectedTenant.tenantId,
          reason: `Suspended by ${superAdmin.displayName || superAdmin.fullName || superAdmin.email}`,
          superAdminId: superAdmin.id
        });
      } else {
        await SuperAdminService.activateTenant({
          tenantId: selectedTenant.tenantId,
          superAdminId: superAdmin.id
        });
      }

      await loadData();
    } catch (err) {
      await auditLogger.error(`SUPER_ADMIN_TENANT_${confirmAction?.toUpperCase()}_FAILED`, err as Error, {
        category: 'SECURITY_EVENT',
        tenantId: selectedTenant.tenantId,
        action: confirmAction
      });
      setError(`Failed to ${confirmAction} tenant`);
    } finally {
      setActionLoading(null);
      setSelectedTenant(null);
      setConfirmAction(null);
    }
  };

  const handleEditTenantCode = (tenant: TenantWithStatus) => {
    setSelectedTenant(tenant);
    setEditTenantCode(tenant.tenantCode || '');
    setShowEditCodeDialog(true);
  };

  const saveTenantCode = async () => {
    if (!selectedTenant || !superAdmin) return;

    const codePattern = /^[A-Z]{1,4}-[0-9]{4,6}$/;
    if (editTenantCode && !codePattern.test(editTenantCode.toUpperCase())) {
      setError('Invalid format. Use PREFIX-NUMBER (e.g., "MH-6702")');
      return;
    }

    try {
      setActionLoading(selectedTenant.tenantId);
      setShowEditCodeDialog(false);

      await SuperAdminService.updateTenantCode({
        tenantId: selectedTenant.tenantId,
        tenantCode: editTenantCode.toUpperCase(),
        superAdminId: superAdmin.id
      });

      await loadData();
    } catch (err) {
      await auditLogger.error('SUPER_ADMIN_TENANT_CODE_UPDATE_FAILED', err as Error, {
        category: 'ADMINISTRATIVE',
        tenantId: selectedTenant.tenantId
      });
      setError((err as Error).message || 'Failed to update tenant code');
    } finally {
      setActionLoading(null);
      setSelectedTenant(null);
      setEditTenantCode('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
        <EACard>
          <EACardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-700 rounded w-1/3"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-slate-700 rounded"></div>
                ))}
              </div>
            </div>
          </EACardContent>
        </EACard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <EACard variant="elevated">
          <EACardHeader
            icon={<Building2 className="w-6 h-6" />}
            action={
              <div className="flex items-center gap-3">
                <EAButton variant="ghost" onClick={loadData} icon={<Activity className="w-4 h-4" />}>
                  Refresh
                </EAButton>
                <EAButton variant="primary" onClick={() => setShowCreateWizard(true)} icon={<Plus className="w-4 h-4" />}>
                  Create Tenant
                </EAButton>
              </div>
            }
          >
            <h1 className="text-2xl font-bold text-white">Tenant Administration</h1>
            <p className="text-sm text-slate-400">Manage all white-label tenants across WellFit and Envision Atlus</p>
          </EACardHeader>

          <EACardContent>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-slate-400">Active</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.active}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-slate-400">Suspended</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.suspended}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-slate-400">Total Users</span>
                </div>
                <div className="text-2xl font-bold text-white">{stats.totalUsers.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-emerald-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-400">Total Saved</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">${stats.totalSavings.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-400">WellFit Only</span>
                </div>
                <div className="text-2xl font-bold text-green-400">{stats.wellfitOnly}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-blue-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Atlus Only</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">{stats.atlusOnly}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-purple-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-400">Both Products</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">{stats.both}</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              {/* Product Filter */}
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                {PRODUCT_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setProductFilter(filter.value)}
                    className={`
                      px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
                      ${productFilter === filter.value
                        ? 'bg-[#00857a] text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }
                    `}
                  >
                    <filter.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{filter.label}</span>
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:border-[#00857a] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, code, or subdomain..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-sm focus:border-[#00857a] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-slate-400 mb-4">
              Showing {filteredTenants.length} of {tenants.length} tenants
            </p>
          </EACardContent>
        </EACard>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tenant List */}
        <div className="space-y-4">
          {filteredTenants.map((tenant) => (
            <EACard key={tenant.tenantId} className="hover:border-slate-600 transition-colors">
              <EACardContent>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Tenant Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`
                      p-3 rounded-lg shrink-0
                      ${tenant.isSuspended ? 'bg-red-500/10' : 'bg-[#00857a]/10'}
                    `}>
                      <Building2 className={`w-6 h-6 ${tenant.isSuspended ? 'text-red-400' : 'text-[#00857a]'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold text-white truncate">{tenant.tenantName}</h3>
                        <button
                          onClick={() => handleEditTenantCode(tenant)}
                          className="p-1 text-slate-400 hover:text-[#00857a] hover:bg-slate-700 rounded transition-colors"
                          title="Edit tenant code"
                          disabled={actionLoading === tenant.tenantId}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-sm text-slate-400">{tenant.subdomain}.wellfit.com</p>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {tenant.tenantCode && (
                          <span className="px-2 py-0.5 bg-slate-700 text-[#00857a] text-xs font-mono font-bold rounded flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {tenant.tenantCode}
                          </span>
                        )}
                        {getProductBadges(tenant.licensedProducts || ['wellfit', 'atlus'])}
                        <span className={`
                          px-2 py-0.5 rounded text-xs flex items-center gap-1
                          ${tenant.isSuspended
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                          }
                        `}>
                          {tenant.isSuspended ? (
                            <><XCircle className="w-3 h-3" /> Suspended</>
                          ) : (
                            <><CheckCircle className="w-3 h-3" /> Active</>
                          )}
                        </span>
                        {tenant.licenseTier && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded capitalize border border-amber-500/30">
                            {tenant.licenseTier}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <EAButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setModuleConfigTenant(tenant);
                        setShowModuleConfig(true);
                      }}
                      icon={<Sliders className="w-4 h-4" />}
                    >
                      Modules
                    </EAButton>
                    {onViewTenant && (
                      <EAButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewTenant(tenant.tenantId)}
                        icon={<Eye className="w-4 h-4" />}
                      >
                        View
                      </EAButton>
                    )}
                    {tenant.isSuspended ? (
                      <EAButton
                        variant="primary"
                        size="sm"
                        onClick={() => handleActivateTenant(tenant)}
                        disabled={actionLoading === tenant.tenantId}
                        loading={actionLoading === tenant.tenantId}
                        icon={<CheckCircle className="w-4 h-4" />}
                      >
                        Activate
                      </EAButton>
                    ) : (
                      <EAButton
                        variant="danger"
                        size="sm"
                        onClick={() => handleSuspendTenant(tenant)}
                        disabled={actionLoading === tenant.tenantId}
                        loading={actionLoading === tenant.tenantId}
                        icon={<XCircle className="w-4 h-4" />}
                      >
                        Suspend
                      </EAButton>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-700">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Users</div>
                    <div className="text-lg font-semibold text-white">
                      {tenant.userCount?.toLocaleString() || 0}
                      {tenant.maxUsers && (
                        <span className="text-xs text-slate-500 font-normal"> / {tenant.maxUsers.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Patients</div>
                    <div className="text-lg font-semibold text-white">
                      {tenant.patientCount?.toLocaleString() || 0}
                      {tenant.maxPatients && (
                        <span className="text-xs text-slate-500 font-normal"> / {tenant.maxPatients.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      Total Saved
                    </div>
                    <div className="text-lg font-semibold text-emerald-400">
                      ${(tenant.totalSavings ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Created</div>
                    <div className="text-lg font-semibold text-white">
                      {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Last Active</div>
                    <div className="text-lg font-semibold text-white">
                      {tenant.lastActivityAt ? new Date(tenant.lastActivityAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </EACardContent>
            </EACard>
          ))}

          {filteredTenants.length === 0 && (
            <EACard>
              <EACardContent className="text-center py-12">
                <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No tenants found</h3>
                <p className="text-slate-400 mb-4">
                  {searchQuery || productFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first tenant to get started'
                  }
                </p>
                <EAButton variant="primary" onClick={() => setShowCreateWizard(true)} icon={<Plus className="w-4 h-4" />}>
                  Create Tenant
                </EAButton>
              </EACardContent>
            </EACard>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <EACard variant="elevated" className="max-w-md w-full">
            <EACardHeader icon={<Shield className="w-5 h-5" />}>
              <h3 className="text-lg font-semibold text-white">
                Confirm {confirmAction === 'suspend' ? 'Suspension' : 'Activation'}
              </h3>
            </EACardHeader>
            <EACardContent>
              <p className="text-slate-300 mb-4">
                Are you sure you want to {confirmAction} <strong className="text-white">{selectedTenant.tenantName}</strong>?
              </p>
              {confirmAction === 'suspend' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                  <p className="text-red-400 text-sm">
                    This will prevent all users from accessing this tenant!
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 justify-end">
                <EAButton
                  variant="ghost"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setSelectedTenant(null);
                    setConfirmAction(null);
                  }}
                >
                  Cancel
                </EAButton>
                <EAButton
                  variant={confirmAction === 'suspend' ? 'danger' : 'primary'}
                  onClick={confirmTenantAction}
                >
                  Confirm {confirmAction === 'suspend' ? 'Suspension' : 'Activation'}
                </EAButton>
              </div>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* Edit Tenant Code Dialog */}
      {showEditCodeDialog && selectedTenant && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <EACard variant="elevated" className="max-w-md w-full">
            <EACardHeader icon={<Hash className="w-5 h-5" />}>
              <h3 className="text-lg font-semibold text-white">Edit Tenant Code</h3>
              <p className="text-sm text-slate-400">{selectedTenant.tenantName}</p>
            </EACardHeader>
            <EACardContent>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tenant Code
                </label>
                <input
                  type="text"
                  value={editTenantCode}
                  onChange={(e) => setEditTenantCode(e.target.value.toUpperCase())}
                  placeholder="MH-6702"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 font-mono focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-none"
                  maxLength={11}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Format: PREFIX-NUMBER (e.g., "MH-6702", "VG-0002")
                </p>
                <p className="text-xs text-slate-500">
                  License digit: 0 = Both, 8 = Atlus only, 9 = WellFit only
                </p>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <EAButton
                  variant="ghost"
                  onClick={() => {
                    setShowEditCodeDialog(false);
                    setSelectedTenant(null);
                    setEditTenantCode('');
                  }}
                >
                  Cancel
                </EAButton>
                <EAButton
                  variant="primary"
                  onClick={saveTenantCode}
                  disabled={!editTenantCode.trim()}
                  icon={<Hash className="w-4 h-4" />}
                >
                  Save Code
                </EAButton>
              </div>
            </EACardContent>
          </EACard>
        </div>
      )}

      {/* Module Configuration Modal */}
      {showModuleConfig && moduleConfigTenant && (
        <SuperAdminTenantModuleConfig
          tenant={moduleConfigTenant}
          onClose={() => {
            setShowModuleConfig(false);
            setModuleConfigTenant(null);
          }}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {/* Create Tenant Wizard */}
      {showCreateWizard && (
        <TenantCreationWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
};

export default TenantManagementPanel;
