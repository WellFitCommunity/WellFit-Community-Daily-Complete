// src/components/admin/ApiKeyManager/hooks.ts
//
// Custom hooks for the ApiKeyManager: toast queue, API key data + auto-refresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import type { ApiKey, ApiKeyRow, ToastData, ToastType } from './types';

// ---------------------------------------------------------------------------
// useToasts — manage the toast queue
// ---------------------------------------------------------------------------

export interface UseToastsResult {
  toasts: ToastData[];
  addToast: (type: ToastType, message: string) => void;
  dismissToast: (id: string) => void;
}

export function useToasts(): UseToastsResult {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, addToast, dismissToast };
}

// ---------------------------------------------------------------------------
// useApiKeys — fetch keys + auto-refresh
// ---------------------------------------------------------------------------

/**
 * Transform raw `api_keys` rows into the `ApiKey` shape consumed by the UI.
 * The computed fields (`active`, `org_name`, etc.) compensate for the legacy
 * column names in the database.
 */
function transformRows(rows: ApiKeyRow[] | null): ApiKey[] {
  return (rows ?? []).map((key) => ({
    ...key,
    org_name: key.label,
    api_key_hash: key.key_hash,
    active: !key.revoked_at,
    usage_count: 0, // Not tracked in current schema
    last_used: null, // Not tracked in current schema
    user_id: key.created_by,
  }));
}

export interface UseApiKeysOptions {
  addToast: (type: ToastType, message: string) => void;
}

export interface UseApiKeysResult {
  apiKeys: ApiKey[];
  loading: boolean;
  /** Manually trigger a fetch. `showLoading=false` is a silent refresh. */
  fetchApiKeys: (showLoading?: boolean) => Promise<void>;
  /** True when auto-refresh is currently running. */
  autoRefreshActive: boolean;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  /** Imperatively flip the loading flag (used by parent for mutate-then-refetch). */
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useApiKeys({ addToast }: UseApiKeysOptions): UseApiKeysResult {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);

  // Latest fetchApiKeys closure — stored in a ref so the interval callback
  // always calls the freshest version without needing to be torn down on every
  // re-render. This avoids a cyclic dep between fetchApiKeys and refreshInterval.
  const fetchRef = useRef<((showLoading?: boolean) => Promise<void>) | null>(null);

  const fetchApiKeys = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);

      try {
        const { data, error: supabaseError } = await supabase
          .from('api_keys')
          .select('id, label, key_hash, created_by, created_at, revoked_at')
          .order('created_at', { ascending: false });

        if (supabaseError) {
          throw new Error(`Failed to fetch API keys: ${supabaseError.message}`);
        }

        const transformedData = transformRows(data as ApiKeyRow[] | null);
        setApiKeys(transformedData);

        if (!showLoading && data) {
          addToast('success', `Refreshed ${data.length} API keys`);
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unexpected error fetching API keys';
        addToast('error', message);
        setApiKeys([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [addToast],
  );

  // Keep the ref in sync with the latest fetchApiKeys closure.
  useEffect(() => {
    fetchRef.current = fetchApiKeys;
  }, [fetchApiKeys]);

  const startAutoRefresh = useCallback(() => {
    const id = window.setInterval(() => {
      fetchRef.current?.(false);
    }, 30000); // 30 seconds
    setRefreshInterval(id);
  }, []);

  const stopAutoRefresh = useCallback(() => {
    setRefreshInterval((current) => {
      if (current !== null) {
        window.clearInterval(current);
      }
      return null;
    });
  }, []);

  // Initial load — preserves original behavior (one fetch on mount, cleanup on unmount).
  // The effect re-runs when `refreshInterval` changes so the cleanup closure sees
  // the latest interval id; this mirrors the pre-refactor behavior 1:1.
  useEffect(() => {
    fetchApiKeys();
    return () => {
      if (refreshInterval) window.clearInterval(refreshInterval);
    };
  }, [fetchApiKeys, refreshInterval]);

  return {
    apiKeys,
    loading,
    fetchApiKeys,
    autoRefreshActive: refreshInterval !== null,
    startAutoRefresh,
    stopAutoRefresh,
    setLoading,
  };
}
