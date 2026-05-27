// src/components/admin/ApiKeyManager/index.tsx
//
// Orchestrator for the API Key Manager admin panel. State + data wiring lives
// here; presentation is delegated to the sibling files in this directory.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ApiKeyManagerSkeleton } from '../../ui/skeleton';

import { useApiKeys, useToasts } from './hooks';
import { copyToClipboard as copyToClipboardImpl } from './ClipboardUtils';
import { ToastContainer } from './ToastContainer';
import { GenerateKeyForm } from './GenerateKeyForm';
import { KeyDisplayModal } from './KeyDisplayModal';
import {
  KeyList,
  selectFilteredSortedKeys,
  type FilterStatus,
  type SortDirection,
  type SortField,
} from './KeyList';
import { HeaderStats, computeStats } from './HeaderStats';
import { exportKeysToCsv, generateKey, revokeKey, toggleKeyStatus } from './handlers';

const ApiKeyManager: React.FC = () => {
  // Toast queue
  const { toasts, addToast, dismissToast } = useToasts();

  // API key data + auto-refresh
  const {
    apiKeys,
    loading,
    fetchApiKeys,
    autoRefreshActive,
    startAutoRefresh,
    stopAutoRefresh,
    setLoading,
  } = useApiKeys({ addToast });

  // Form state
  const [newOrgName, setNewOrgName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyMasked, setKeyMasked] = useState(false);

  // Search / filter / sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const generatedKeyRef = useRef<HTMLDivElement>(null);
  const orgNameInputRef = useRef<HTMLInputElement>(null);

  // Clipboard
  const onCopy = useCallback(
    (text: string, label: string = 'API Key') => {
      void copyToClipboardImpl(text, label, {
        addToast,
        onMaskKey: () => setKeyMasked(true),
      });
    },
    [addToast],
  );

  // Setters that accept the React Dispatch shape but expose a simple
  // (v) => void signature so the handlers module doesn't need to know about
  // React.Dispatch<React.SetStateAction<T>>.
  const setLoadingSimple = useCallback((v: boolean) => setLoading(v), [setLoading]);

  // Generate key
  const handleGenerateKey = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await generateKey({
        newOrgName,
        apiKeys,
        addToast,
        setLoading: setLoadingSimple,
        setGeneratedKey,
        setKeyMasked,
        setNewOrgName,
        fetchApiKeys,
        orgNameInputRef,
        generatedKeyRef,
      });
    },
    [newOrgName, apiKeys, addToast, setLoadingSimple, fetchApiKeys],
  );

  // Toggle key status
  const handleToggleKeyStatus = useCallback(
    async (keyId: string, currentStatus: boolean, orgName: string) => {
      await toggleKeyStatus(keyId, currentStatus, orgName, {
        addToast,
        setLoading: setLoadingSimple,
        fetchApiKeys,
      });
    },
    [addToast, setLoadingSimple, fetchApiKeys],
  );

  // Revoke key
  const handleRevokeKey = useCallback(
    async (keyId: string, orgName: string) => {
      await revokeKey(keyId, orgName, apiKeys, {
        addToast,
        setLoading: setLoadingSimple,
        fetchApiKeys,
      });
    },
    [apiKeys, addToast, setLoadingSimple, fetchApiKeys],
  );

  // Sorting handler
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  // Derived state
  const filteredAndSortedKeys = useMemo(
    () => selectFilteredSortedKeys(apiKeys, searchTerm, filterStatus, sortField, sortDirection),
    [apiKeys, searchTerm, filterStatus, sortField, sortDirection],
  );

  const stats = useMemo(() => computeStats(apiKeys), [apiKeys]);

  // CSV export
  const exportToCsv = useCallback(
    () => exportKeysToCsv(filteredAndSortedKeys, addToast),
    [filteredAndSortedKeys, addToast],
  );

  const onToggleAutoRefresh = useCallback(() => {
    if (autoRefreshActive) {
      stopAutoRefresh();
    } else {
      startAutoRefresh();
    }
  }, [autoRefreshActive, startAutoRefresh, stopAutoRefresh]);

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div
        className="p-6 bg-white shadow-lg rounded-lg"
        aria-label="API Key Manager"
        aria-live="polite"
      >
        <HeaderStats
          loading={loading}
          autoRefreshActive={autoRefreshActive}
          onRefresh={() => fetchApiKeys(true)}
          onToggleAutoRefresh={onToggleAutoRefresh}
          stats={stats}
        />

        <GenerateKeyForm
          newOrgName={newOrgName}
          setNewOrgName={setNewOrgName}
          loading={loading}
          onSubmit={handleGenerateKey}
          orgNameInputRef={orgNameInputRef}
        />

        <KeyDisplayModal
          generatedKey={generatedKey}
          keyMasked={keyMasked}
          onCopy={(text) => onCopy(text)}
          onDismiss={() => setGeneratedKey(null)}
          containerRef={generatedKeyRef}
        />

        {loading && !apiKeys.length && <ApiKeyManagerSkeleton />}

        {!loading && !apiKeys.length && (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔑</div>
            <p className="text-gray-600">No API keys found. Generate your first key above!</p>
          </div>
        )}

        <KeyList
          apiKeys={apiKeys}
          loading={loading}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onCopy={onCopy}
          onToggleStatus={handleToggleKeyStatus}
          onRevoke={handleRevokeKey}
          onExportCsv={exportToCsv}
          autoRefreshActive={autoRefreshActive}
          filteredAndSortedKeys={filteredAndSortedKeys}
        />
      </div>
    </>
  );
};

export default ApiKeyManager;
