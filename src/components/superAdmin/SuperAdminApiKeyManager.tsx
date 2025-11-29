/**
 * SuperAdminApiKeyManager
 *
 * Platform-level API key management for Envision Atlus super-admins.
 * This component is specifically for the enterprise admin panel and manages
 * API keys across ALL tenants.
 *
 * SECURITY: This is an atlus-admin-only component. It should never be imported
 * into tenant-admin components.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { SuperAdminService } from '../../services/superAdminService';
import { auditLogger } from '../../services/auditLogger';
import { ApiKeyManagerSkeleton } from '../ui/skeleton';

// API key interface for platform-level management
interface ApiKey {
  id: string;
  label: string;
  key_hash: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  tenant_id: string | null;
  tenant_name?: string;
  org_name: string;
  api_key_hash: string;
  active: boolean;
  usage_count: number;
  last_used: string | null;
  user_id: string | null;
}

interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Toast Component
const ToastNotification: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className={`${bgColors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex justify-between items-center min-w-[20rem] max-w-md`}>
      <div className="flex items-center space-x-2">
        <span className="font-bold">{icons[toast.type]}</span>
        <span className="text-sm">{toast.message}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-4 text-white hover:text-gray-200 font-bold text-lg"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: ToastData[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map(toast => (
      <ToastNotification key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = { sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-6 w-6' };
  return (
    <svg className={`animate-spin ${sizeClasses[size]} text-current`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const SuperAdminApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyMasked, setKeyMasked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ApiKey>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const generatedKeyRef = useRef<HTMLDivElement>(null);
  const orgNameInputRef = useRef<HTMLInputElement>(null);

  // Verify super-admin access on mount
  useEffect(() => {
    const checkSuperAdmin = async () => {
      try {
        const isAdmin = await SuperAdminService.isSuperAdmin();
        setIsSuperAdmin(isAdmin);
        if (!isAdmin) {
          await auditLogger.security('SUPER_ADMIN_API_KEY_ACCESS_DENIED', 'high', {
            reason: 'Non-super-admin attempted to access platform API key manager'
          });
        }
      } catch (error) {
        setIsSuperAdmin(false);
      } finally {
        setAuthChecking(false);
      }
    };
    checkSuperAdmin();
  }, []);

  const addToast = useCallback((type: ToastData['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fetchApiKeys = useCallback(async (showLoading = true) => {
    if (!isSuperAdmin) return;
    if (showLoading) setLoading(true);

    try {
      // Super-admin sees ALL API keys across all tenants
      const { data, error: supabaseError } = await supabase
        .from('api_keys')
        .select(`
          id,
          label,
          key_hash,
          created_by,
          created_at,
          revoked_at,
          tenant_id,
          tenants:tenant_id(name)
        `)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw new Error(`Failed to fetch API keys: ${supabaseError.message}`);
      }

      const transformedData = (data || []).map(key => ({
        ...key,
        org_name: key.label,
        api_key_hash: key.key_hash,
        active: !key.revoked_at,
        usage_count: 0,
        last_used: null,
        user_id: key.created_by,
        tenant_name: (key.tenants as any)?.name || 'Platform-level'
      }));

      setApiKeys(transformedData as ApiKey[]);

      await auditLogger.info('SUPER_ADMIN_API_KEYS_LOADED', {
        category: 'ADMINISTRATIVE',
        keyCount: transformedData.length
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error fetching API keys';
      addToast('error', message);
      setApiKeys([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isSuperAdmin, addToast]);

  useEffect(() => {
    if (isSuperAdmin && !authChecking) {
      fetchApiKeys();
    }
  }, [isSuperAdmin, authChecking, fetchApiKeys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) return;

    const trimmed = newOrgName.trim();
    if (!trimmed || trimmed.length < 2) {
      addToast('error', 'Organization name must be at least 2 characters');
      return;
    }

    setLoading(true);
    setGeneratedKey(null);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'generate-api-key',
        { body: { label: trimmed } }
      );

      if (functionError) {
        throw new Error(`Error generating API key: ${functionError.message}`);
      }

      if (!functionData?.api_key) {
        throw new Error('API Key generation did not return a key.');
      }

      await auditLogger.security('SUPER_ADMIN_API_KEY_GENERATED', 'medium', {
        orgName: trimmed
      });

      addToast('success', 'Platform API Key generated! Copy it now.');
      setGeneratedKey(functionData.api_key);
      setKeyMasked(false);
      setNewOrgName('');

      setTimeout(() => setKeyMasked(true), 5000);
      await fetchApiKeys(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string, orgName: string) => {
    if (!isSuperAdmin) return;

    const confirmed = window.confirm(
      `⚠️ PERMANENT ACTION\n\nRevoke the API key for "${orgName}"?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', keyId);

      if (updateError) throw new Error(`Error revoking key: ${updateError.message}`);

      await auditLogger.security('SUPER_ADMIN_API_KEY_REVOKED', 'high', {
        keyId,
        orgName
      });

      addToast('warning', `API key for "${orgName}" has been revoked`);
      await fetchApiKeys(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string = 'API Key') => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', `${label} copied!`);
      if (label === 'API Key') setTimeout(() => setKeyMasked(true), 500);
    } catch {
      addToast('error', 'Failed to copy. Please copy manually.');
    }
  };

  const formatDate = (str: string | null) => {
    if (!str) return 'Never';
    try {
      return new Date(str).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return 'Invalid';
    }
  };

  // Filtering and sorting
  const filteredAndSortedKeys = React.useMemo(() => {
    const filtered = apiKeys.filter(key => {
      const matchesSearch =
        key.org_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        key.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (key.tenant_name || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'active' && key.active) ||
        (filterStatus === 'inactive' && !key.active);

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (bVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [apiKeys, searchTerm, filterStatus, sortField, sortDirection]);

  const stats = React.useMemo(() => ({
    total: apiKeys.length,
    active: apiKeys.filter(k => k.active).length,
    inactive: apiKeys.filter(k => !k.active).length,
    platformKeys: apiKeys.filter(k => !k.tenant_id).length,
    tenantKeys: apiKeys.filter(k => k.tenant_id).length
  }), [apiKeys]);

  // Authorization check
  if (authChecking) {
    return (
      <div className="p-6 bg-white shadow-lg rounded-lg">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Verifying super-admin access...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🚫</span>
          <div>
            <h3 className="text-lg font-semibold text-red-800">Access Denied</h3>
            <p className="text-red-600">You must be a super-admin to access platform API key management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="p-6 bg-white shadow-lg rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Platform API Key Manager</h2>
            <p className="text-sm text-gray-500 mt-1">Manage API keys across all tenants (Super Admin)</p>
          </div>
          <button
            onClick={() => fetchApiKeys(true)}
            disabled={loading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1"
          >
            {loading ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
            <span className="text-sm">Refresh</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-800">Total Keys</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-green-800">Active</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
            <div className="text-sm text-red-800">Revoked</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.platformKeys}</div>
            <div className="text-sm text-purple-800">Platform-level</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.tenantKeys}</div>
            <div className="text-sm text-yellow-800">Tenant-level</div>
          </div>
        </div>

        {/* Generate Key Form */}
        <form onSubmit={handleGenerateKey} className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-medium mb-3">Generate Platform API Key</h3>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <input
              ref={orgNameInputRef}
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="Organization name"
              className="flex-grow border rounded-lg px-3 py-2"
              disabled={loading}
              maxLength={100}
            />
            <button
              type="submit"
              disabled={loading || !newOrgName.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : <span>🔑</span>}
              <span>Generate</span>
            </button>
          </div>
        </form>

        {/* Generated Key Display */}
        {generatedKey && (
          <div ref={generatedKeyRef} className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="font-medium text-green-700 mb-2">🎉 New Platform API Key Generated!</div>
            <div className="bg-white p-3 rounded border font-mono text-sm break-all">
              {keyMasked ? '••••••••••••••••••••••••••••••••' : generatedKey}
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-green-700">
                {keyMasked ? '🔒 Key masked' : '⚠️ Copy NOW - auto-masks in 5s'}
              </span>
              {!keyMasked && (
                <button
                  onClick={() => copyToClipboard(generatedKey)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  📋 Copy
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <input
            type="text"
            placeholder="Search by org, ID, or tenant..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-grow border rounded-lg px-3 py-2"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
            className="border rounded-lg px-3 py-2"
          >
            <option value="all">All Keys</option>
            <option value="active">Active Only</option>
            <option value="inactive">Revoked Only</option>
          </select>
        </div>

        {/* Loading State */}
        {loading && !apiKeys.length && <ApiKeyManagerSkeleton />}

        {/* Empty State */}
        {!loading && !apiKeys.length && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔑</div>
            <p className="text-gray-600">No platform API keys found.</p>
          </div>
        )}

        {/* Table */}
        {filteredAndSortedKeys.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-3 text-left">Organization</th>
                  <th className="border px-4 py-3 text-left">Tenant</th>
                  <th className="border px-4 py-3 text-left">Status</th>
                  <th className="border px-4 py-3 text-left">Created</th>
                  <th className="border px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedKeys.map((key, index) => (
                  <tr key={key.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border px-4 py-3">
                      <div className="font-medium">{key.org_name}</div>
                      <div className="text-xs text-gray-500">ID: {key.id.slice(0, 8)}...</div>
                    </td>
                    <td className="border px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        key.tenant_id ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {key.tenant_name || 'Platform'}
                      </span>
                    </td>
                    <td className="border px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        key.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {key.active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="border px-4 py-3 text-sm">{formatDate(key.created_at)}</td>
                    <td className="border px-4 py-3">
                      {key.active && (
                        <button
                          onClick={() => handleRevokeKey(key.id, key.org_name)}
                          disabled={loading}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200"
                        >
                          🗑️ Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Showing {filteredAndSortedKeys.length} of {apiKeys.length} keys
        </div>
      </div>
    </>
  );
};

export default SuperAdminApiKeyManager;
