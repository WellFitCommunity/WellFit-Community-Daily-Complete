// src/components/admin/ApiKeyManager.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

// NOTE: Export libraries are now lazy-loaded inside exportToExcel()
// import { saveAs } from 'file-saver';
// import * as XLSX from 'xlsx';

// Define the shape of your API key record
interface ApiKey {
  id: string;
  user_id: string | null;
  org_name: string;
  api_key_hash: string;
  active: boolean;
  usage_count: number;
  last_used: string | null;
  created_at: string;
  created_by: string | null;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

// Toast Component
const Toast: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
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

// Toast Container
const ToastContainer: React.FC<{ toasts: Toast[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite">
    {toasts.map(toast => (
      <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
    ))}
  </div>
);

// Loading Spinner Component
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
  };

  return (
    <svg className={`animate-spin ${sizeClasses[size]} text-current`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const ApiKeyManager: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof ApiKey>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  const generatedKeyRef = useRef<HTMLDivElement>(null);
  const orgNameInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const fetchApiKeys = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase
        .from('api_keys')
        .select('id, org_name, api_key_hash, active, usage_count, last_used, created_at, created_by, user_id')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw new Error(`Failed to fetch API keys: ${supabaseError.message}`);
      }

      setApiKeys((data as ApiKey[]) || []);

      if (!showLoading && data) {
        addToast('success', `Refreshed ${data.length} API keys`);
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      const message = error instanceof Error ? error.message : 'Unexpected error fetching API keys';
      addToast('error', message);
      setApiKeys([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [addToast]);

  // Auto-refresh functionality
  const startAutoRefresh = useCallback(() => {
    const id = window.setInterval(() => fetchApiKeys(false), 30000); // 30 seconds
    setRefreshInterval(id);
  }, [fetchApiKeys]);

  const stopAutoRefresh = useCallback(() => {
    if (refreshInterval) {
      window.clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [refreshInterval]);

  useEffect(() => {
    fetchApiKeys();
    return () => {
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [fetchApiKeys, refreshInterval]);

  const validateOrgName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'Organization name is required';
    if (trimmed.length < 2) return 'Organization name must be at least 2 characters';
    if (trimmed.length > 100) return 'Organization name must be less than 100 characters';
    if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmed)) return 'Organization name contains invalid characters';

    // Check for duplicate org names
    if (apiKeys.some(key => key.org_name.toLowerCase() === trimmed.toLowerCase())) {
      return 'An API key already exists for this organization';
    }

    return null;
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateOrgName(newOrgName);
    if (validationError) {
      addToast('error', validationError);
      orgNameInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setGeneratedKey(null);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'generate-api-key',
        { body: { org_name: newOrgName.trim() } }
      );

      if (functionError) {
        console.error('Supabase function error:', functionError);

        let displayError = `Error generating API key: ${functionError.message}`;
        try {
          const contextError = JSON.parse(functionError.context || '{}');
          if (contextError.error) {
            displayError = `Error generating API key: ${contextError.error}`;
          }
        } catch {
          // Ignore parsing error
        }

        throw new Error(displayError);
      }

      if (!functionData?.api_key) {
        console.error('Unexpected response from generate-api-key function:', functionData);
        throw new Error('API Key generation did not return a key. Please check function logs.');
      }

      addToast('success', 'API Key generated successfully! Copy it now as it will not be shown again.');
      setGeneratedKey(functionData.api_key);
      setNewOrgName('');

      // Focus the generated key for accessibility
      setTimeout(() => {
        generatedKeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      await fetchApiKeys(false);
    } catch (error) {
      console.error('Client-side error calling generate-api-key function:', error);
      const message = error instanceof Error ? error.message : 'Unexpected error generating key';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean, orgName: string) => {
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('api_keys')
        .update({ active: !currentStatus })
        .eq('id', keyId);

      if (updateError) {
        throw new Error(`Error updating key status: ${updateError.message}`);
      }

      const newStatus = !currentStatus ? 'enabled' : 'disabled';
      addToast('success', `API key for "${orgName}" ${newStatus} successfully`);
      await fetchApiKeys(false);
    } catch (error) {
      console.error('Error updating key status:', error);
      const message = error instanceof Error ? error.message : 'Unexpected error updating key status';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string, orgName: string) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENT ACTION\n\nRevoke the API key for "${orgName}"?\n\nThis will:\n• Immediately disable all API access\n• Cannot be undone\n• Require generating a new key if needed later\n\nClick OK to confirm.`
    );

    if (!confirmed) return;

    // Additional confirmation for high-usage keys
    const key = apiKeys.find(k => k.id === keyId);
    if (key && key.usage_count > 1000) {
      const highUsageConfirm = window.confirm(
        `This API key has ${key.usage_count.toLocaleString()} total uses. Are you absolutely sure you want to revoke it?`
      );
      if (!highUsageConfirm) return;
    }

    setLoading(true);

    try {
      const { error: deleteError } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId);

      if (deleteError) {
        throw new Error(`Error revoking key: ${deleteError.message}`);
      }

      addToast('warning', `API key for "${orgName}" has been permanently revoked`);
      await fetchApiKeys(false);
    } catch (error) {
      console.error('Error revoking key:', error);
      const message = error instanceof Error ? error.message : 'Unexpected error revoking key';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'API Key copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      addToast('error', 'Failed to copy. Please copy manually.');
    }
  };

  const displayableApiKeyRepresentation = (hash: string | undefined, orgName: string) => {
    if (!hash) return 'N/A (No Hash)';
    return `ak_${orgName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}_••••••••`;
  };

  const formatDate = (str: string | null) => {
    if (!str) return 'Never';
    try {
      return new Date(str).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getRelativeTime = (str: string | null) => {
    if (!str) return 'Never';
    try {
      const date = new Date(str);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return 'Unknown';
    }
  };

  // Safer comparator casting (optional but robust)
  const toComparable = (v: any) => {
    if (v == null) return null;
    if (typeof v === 'string' && !isNaN(Date.parse(v))) return Date.parse(v);
    if (typeof v === 'string') return v.toLowerCase();
    return v;
  };

  // Filtering and sorting logic
  const filteredAndSortedKeys = React.useMemo(() => {
    let filtered = apiKeys.filter(key => {
      const matchesSearch =
        key.org_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        key.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' ||
        (filterStatus === 'active' && key.active) ||
        (filterStatus === 'inactive' && !key.active);

      return matchesSearch && matchesFilter;
    });

    return filtered.sort((a, b) => {
      let aValue = toComparable(a[sortField]);
      let bValue = toComparable(b[sortField]);

      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue === null) return sortDirection === 'asc' ? 1 : -1;

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [apiKeys, searchTerm, filterStatus, sortField, sortDirection]);

  const handleSort = (field: keyof ApiKey) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof ApiKey) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const stats = React.useMemo(
    () => ({
      total: apiKeys.length,
      active: apiKeys.filter(k => k.active).length,
      inactive: apiKeys.filter(k => !k.active).length,
      totalUsage: apiKeys.reduce((sum, k) => sum + k.usage_count, 0),
      recentlyUsed: apiKeys.filter(k => {
        if (!k.last_used) return false;
        const daysSinceUse =
          (Date.now() - new Date(k.last_used).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUse <= 7;
      }).length
    }),
    [apiKeys]
  );

  const exportToExcel = async () => {
    try {
      // Lazy-load heavy deps only when needed
      const [{ saveAs }, XLSX] = await Promise.all([
        import('file-saver'),
        import('xlsx')
      ]);

      const exportData = filteredAndSortedKeys.map(key => ({
        Organization: key.org_name,
        Status: key.active ? 'Active' : 'Inactive',
        'Usage Count': key.usage_count,
        'Last Used': formatDate(key.last_used),
        Created: formatDate(key.created_at),
        'Created By': key.created_by || 'System'
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.max(key.length, 15)
      }));
      (ws as any)['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'API Keys');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const filename = `api_keys_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(new Blob([wbout], { type: 'application/octet-stream' }), filename);

      addToast('success', `Exported ${exportData.length} API keys to ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      addToast('error', 'Failed to export data to Excel');
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="p-6 bg-white shadow-lg rounded-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900">API Key Manager</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchApiKeys(true)}
              disabled={loading}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-1"
              title="Refresh API keys"
            >
              {loading ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
              <span className="text-sm">Refresh</span>
            </button>

            <button
              onClick={refreshInterval ? stopAutoRefresh : startAutoRefresh}
              className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                refreshInterval
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={refreshInterval ? 'Stop auto-refresh' : 'Start auto-refresh (30s)'}
            >
              {refreshInterval ? '⏸️ Auto' : '▶️ Auto'}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
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
            <div className="text-sm text-red-800">Inactive</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.totalUsage.toLocaleString()}</div>
            <div className="text-sm text-purple-800">Total Usage</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.recentlyUsed}</div>
            <div className="text-sm text-yellow-800">Used This Week</div>
          </div>
        </div>

        {/* Generate New Key Form */}
        <form onSubmit={handleGenerateKey} className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-medium mb-3">Generate New API Key</h3>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="flex-grow">
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name *
              </label>
              <input
                ref={orgNameInputRef}
                id="orgName"
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                placeholder="Enter organization name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
                maxLength={100}
                pattern="[a-zA-Z0-9\s\-_.]+"
                title="Only letters, numbers, spaces, hyphens, underscores, and periods allowed"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !newOrgName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <span>🔑</span>
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Generated Key Display */}
        {generatedKey && (
          <div ref={generatedKeyRef} className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-green-700 font-medium">🎉 New API Key Generated!</span>
            </div>
            <div className="bg-white p-3 rounded border font-mono text-sm break-all select-all">
              {generatedKey}
            </div>
            <div className="flex justify-between items-center mt-3">
              <p className="text-green-700 text-sm">
                ⚠️ Copy this key now! It will not be displayed again for security reasons.
              </p>
              <button
                onClick={() => copyToClipboard(generatedKey)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
              >
                <span>📋</span>
                <span>Copy Key</span>
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="mb-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
          <div className="flex-grow">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search API Keys
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by organization or key ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter Status
            </label>
            <select
              id="filter"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Keys</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={exportToExcel}
              disabled={loading || filteredAndSortedKeys.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
            >
              <span>📊</span>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Results Summary */}
        {searchTerm || filterStatus !== 'all' ? (
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredAndSortedKeys.length} of {apiKeys.length} API keys
            {searchTerm && ` matching "${searchTerm}"`}
            {filterStatus !== 'all' && ` (${filterStatus} only)`}
          </div>
        ) : null}

        {/* Loading State */}
        {loading && !apiKeys.length && (
          <div className="text-center py-8">
            <LoadingSpinner size="lg" />
            <p className="mt-2 text-gray-600">Loading API keys…</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !apiKeys.length && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔑</div>
            <p className="text-gray-600">No API keys found. Generate your first key above!</p>
          </div>
        )}

        {/* No Results State */}
        {!loading && apiKeys.length > 0 && filteredAndSortedKeys.length === 0 && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-600">No API keys match your current filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
              }}
              className="mt-2 text-blue-600 hover:text-blue-800 underline"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* API Keys Table */}
        {filteredAndSortedKeys.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('org_name')}
                    title="Click to sort by organization"
                  >
                    <div className="flex items-center justify-between">
                      <span>Organization</span>
                      <span className="text-xs">{getSortIcon('org_name')}</span>
                    </div>
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-left">Key Identifier</th>
                  <th
                    className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('active')}
                    title="Click to sort by status"
                  >
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className="text-xs">{getSortIcon('active')}</span>
                    </div>
                  </th>
                  <th
                    className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('usage_count')}
                    title="Click to sort by usage count"
                  >
                    <div className="flex items-center justify-between">
                      <span>Usage</span>
                      <span className="text-xs">{getSortIcon('usage_count')}</span>
                    </div>
                  </th>
                  <th
                    className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('last_used')}
                    title="Click to sort by last used date"
                  >
                    <div className="flex items-center justify-between">
                      <span>Last Used</span>
                      <span className="text-xs">{getSortIcon('last_used')}</span>
                    </div>
                  </th>
                  <th
                    className="border border-gray-300 px-4 py-3 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('created_at')}
                    title="Click to sort by creation date"
                  >
                    <div className="flex items-center justify-between">
                      <span>Created</span>
                      <span className="text-xs">{getSortIcon('created_at')}</span>
                    </div>
                  </th>
                  <th className="border border-gray-300 px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedKeys.map((key, index) => (
                  <tr
                    key={key.id}
                    className={`${loading ? 'opacity-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}
                  >
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="font-medium text-gray-900">{key.org_name}</div>
                      <div className="text-xs text-gray-500 mt-1">ID: {key.id.slice(0, 8)}...</div>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 font-mono text-sm">
                      {displayableApiKeyRepresentation(key.api_key_hash, key.org_name)}
                    </td>
                    <td className="border border-gray-300 px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          key.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 mr-1.5 rounded-full ${
                            key.active ? 'bg-green-400' : 'bg-red-400'
                          }`}
                        ></span>
                        {key.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="font-medium">{key.usage_count.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">total requests</div>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="text-sm">{formatDate(key.last_used)}</div>
                      <div className="text-xs text-gray-500">{getRelativeTime(key.last_used)}</div>
                    </td>
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="text-sm">{formatDate(key.created_at)}</div>
                      <div className="text-xs text-gray-500">{getRelativeTime(key.created_at)}</div>
                      {key.created_by && (
                        <div className="text-xs text-gray-400 mt-1">by {key.created_by}</div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-3">
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => handleToggleKeyStatus(key.id, key.active, key.org_name)}
                          disabled={loading}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                            key.active
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                          title={key.active ? 'Disable this API key' : 'Enable this API key'}
                        >
                          {key.active ? '⏸️ Disable' : '▶️ Enable'}
                        </button>

                        <button
                          onClick={() => handleRevokeKey(key.id, key.org_name)}
                          disabled={loading}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                          title="Permanently revoke this API key"
                        >
                          🗑️ Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer with Pagination Info */}
        {filteredAndSortedKeys.length > 0 && (
          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <div>
              Displaying {filteredAndSortedKeys.length}{' '}
              {filteredAndSortedKeys.length === 1 ? 'key' : 'keys'}
            </div>
            <div className="flex items-center space-x-4">
              <span>Last updated: {new Date().toLocaleTimeString()}</span>
              {refreshInterval && (
                <span className="text-green-600 flex items-center space-x-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span>Auto-refreshing</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ApiKeyManager;
