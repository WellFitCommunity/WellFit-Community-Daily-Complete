// src/components/admin/ApiKeyManager/handlers.ts
//
// Pure(-ish) action handlers extracted from the orchestrator. Each handler
// takes its dependencies as explicit arguments so the orchestrator stays a
// thin wiring layer.
//
// These are intentionally NOT React hooks — they're plain async functions
// invoked from `useCallback` closures in `index.tsx`.

import { supabase } from '../../../lib/supabaseClient';
import type { ApiKey, AddToast } from './types';
import { formatDate } from './sortUtils';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOrgName(name: string, existing: ApiKey[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Organization name is required';
  if (trimmed.length < 2) return 'Organization name must be at least 2 characters';
  if (trimmed.length > 100) return 'Organization name must be less than 100 characters';
  if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmed))
    return 'Organization name contains invalid characters';
  if (existing.some((key) => key.org_name.toLowerCase() === trimmed.toLowerCase())) {
    return 'An API key already exists for this organization';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generate key
// ---------------------------------------------------------------------------

export interface GenerateKeyDeps {
  newOrgName: string;
  apiKeys: ApiKey[];
  addToast: AddToast;
  setLoading: (v: boolean) => void;
  setGeneratedKey: (v: string | null) => void;
  setKeyMasked: (v: boolean) => void;
  setNewOrgName: (v: string) => void;
  fetchApiKeys: (showLoading?: boolean) => Promise<void>;
  orgNameInputRef: React.RefObject<HTMLInputElement | null>;
  generatedKeyRef: React.RefObject<HTMLDivElement | null>;
}

export async function generateKey(deps: GenerateKeyDeps): Promise<void> {
  const {
    newOrgName,
    apiKeys,
    addToast,
    setLoading,
    setGeneratedKey,
    setKeyMasked,
    setNewOrgName,
    fetchApiKeys,
    orgNameInputRef,
    generatedKeyRef,
  } = deps;

  const validationError = validateOrgName(newOrgName, apiKeys);
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
      { body: { label: newOrgName.trim() } },
    );

    if (functionError) {
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
      throw new Error('API Key generation did not return a key. Please check function logs.');
    }

    addToast(
      'success',
      'API Key generated successfully! Copy it now as it will not be shown again.',
    );
    setGeneratedKey(functionData.api_key);
    setKeyMasked(false);
    setNewOrgName('');

    setTimeout(() => {
      generatedKeyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);

    setTimeout(() => {
      setKeyMasked(true);
    }, 5000);

    await fetchApiKeys(false);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error generating key';
    addToast('error', message);
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Toggle key status (enable/disable)
// ---------------------------------------------------------------------------

export interface MutateKeyDeps {
  addToast: AddToast;
  setLoading: (v: boolean) => void;
  fetchApiKeys: (showLoading?: boolean) => Promise<void>;
}

export async function toggleKeyStatus(
  keyId: string,
  currentStatus: boolean,
  orgName: string,
  deps: MutateKeyDeps,
): Promise<void> {
  const { addToast, setLoading, fetchApiKeys } = deps;

  setLoading(true);
  try {
    const updateData = currentStatus
      ? { revoked_at: new Date().toISOString() }
      : { revoked_at: null };

    const { error: updateError } = await supabase
      .from('api_keys')
      .update(updateData)
      .eq('id', keyId);

    if (updateError) {
      throw new Error(`Error updating key status: ${updateError.message}`);
    }

    const newStatus = !currentStatus ? 'enabled' : 'disabled';
    addToast('success', `API key for "${orgName}" ${newStatus} successfully`);
    await fetchApiKeys(false);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error updating key status';
    addToast('error', message);
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// Revoke key (permanent)
// ---------------------------------------------------------------------------

export async function revokeKey(
  keyId: string,
  orgName: string,
  apiKeys: ApiKey[],
  deps: MutateKeyDeps,
): Promise<void> {
  const { addToast, setLoading, fetchApiKeys } = deps;

  const confirmed = window.confirm(
    `⚠️ PERMANENT ACTION\n\nRevoke the API key for "${orgName}"?\n\nThis will:\n• Immediately disable all API access\n• Cannot be undone\n• Require generating a new key if needed later\n\nClick OK to confirm.`,
  );
  if (!confirmed) return;

  const key = apiKeys.find((k) => k.id === keyId);
  if (key && key.usage_count > 1000) {
    const highUsageConfirm = window.confirm(
      `This API key has ${key.usage_count.toLocaleString()} total uses. Are you absolutely sure you want to revoke it?`,
    );
    if (!highUsageConfirm) return;
  }

  setLoading(true);
  try {
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', keyId);

    if (updateError) {
      throw new Error(`Error revoking key: ${updateError.message}`);
    }

    addToast('warning', `API key for "${orgName}" has been permanently revoked`);
    await fetchApiKeys(false);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error revoking key';
    addToast('error', message);
  } finally {
    setLoading(false);
  }
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export async function exportKeysToCsv(
  filteredAndSortedKeys: ApiKey[],
  addToast: AddToast,
): Promise<void> {
  try {
    const { saveAs } = await import('file-saver');

    const exportData = filteredAndSortedKeys.map((key) => ({
      Organization: key.org_name,
      Status: key.active ? 'Active' : 'Inactive',
      'Usage Count': key.usage_count,
      'Last Used': formatDate(key.last_used),
      Created: formatDate(key.created_at),
      'Created By': key.created_by || 'System',
    }));

    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row];
            return typeof value === 'string' && (value.includes(',') || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(','),
      ),
    ].join('\n');

    const filename = `api_keys_${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), filename);

    addToast('success', `Exported ${exportData.length} API keys to ${filename}`);
  } catch {
    addToast('error', 'Failed to export data to CSV');
  }
}
