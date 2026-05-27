// src/components/admin/ApiKeyManager/types.ts
//
// Shared types for the ApiKeyManager component family.

/**
 * Shape of an API key record (matches actual database schema for `api_keys`).
 *
 * The DB columns are `label`, `key_hash`, `created_by`, `created_at`,
 * `revoked_at`. The computed fields (`org_name`, `api_key_hash`, `active`,
 * `usage_count`, `last_used`, `user_id`) are derived in the data layer to keep
 * UI code agnostic of the legacy column names.
 */
export interface ApiKey {
  id: string;
  label: string; // organization name in the database
  key_hash: string; // api_key_hash in the database
  created_by: string;
  created_at: string;
  revoked_at: string | null;
  // Computed fields for compatibility (always set by transformation)
  org_name: string;
  api_key_hash: string;
  active: boolean;
  usage_count: number;
  last_used: string | null;
  user_id: string | null;
}

/**
 * Raw row shape returned by `supabase.from('api_keys').select(...)` before
 * the computed fields are layered on.
 */
export interface ApiKeyRow {
  id: string;
  label: string;
  key_hash: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export type ToastType = ToastData['type'];

export type AddToast = (type: ToastType, message: string) => void;
