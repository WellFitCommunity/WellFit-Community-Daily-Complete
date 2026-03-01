/**
 * MCP Key Management Service
 *
 * CRUD operations for MCP API keys used in machine-to-machine auth.
 * All operations require super_admin role (enforced by RLS on mcp_keys).
 *
 * @module mcpKeyManagementService
 */

import { supabase } from '../lib/supabaseClient';
import { ServiceResult, success, failure } from './_base';

// =====================================================
// Types
// =====================================================

export interface MCPKey {
  id: string;
  key_prefix: string;
  name: string;
  description: string | null;
  scopes: string[];
  created_by: string | null;
  tenant_id: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  last_used_at: string | null;
  use_count: number;
}

export interface MCPKeyCreateInput {
  name: string;
  scopes: string[];
  tenant_id?: string;
  description?: string;
  expires_at?: string;
}

export interface MCPKeyCreateResult {
  key_id: string;
  raw_key: string;
  key_prefix: string;
}

export interface MCPKeyAuditEntry {
  id: string;
  key_id: string;
  key_prefix: string;
  request_id: string;
  server_name: string;
  tool_name: string | null;
  outcome: string;
  error_message: string | null;
  created_at: string;
}

export type KeyStatus = 'active' | 'expired' | 'revoked' | 'expiring_soon';

/** Days before expiry to flag as "expiring soon" */
const EXPIRY_WARNING_DAYS = 14;

// =====================================================
// Helpers
// =====================================================

function getKeyStatus(key: MCPKey): KeyStatus {
  if (key.revoked_at) return 'revoked';
  if (key.expires_at) {
    const expiresAt = new Date(key.expires_at);
    if (expiresAt < new Date()) return 'expired';
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + EXPIRY_WARNING_DAYS);
    if (expiresAt < warningDate) return 'expiring_soon';
  }
  return 'active';
}

// =====================================================
// Service
// =====================================================

export const mcpKeyManagementService = {
  /**
   * List all MCP keys visible to the current user (super_admin only via RLS).
   */
  async listKeys(): Promise<ServiceResult<(MCPKey & { status: KeyStatus })[]>> {
    try {
      const { data, error } = await supabase
        .from('mcp_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const keys = (data || []) as MCPKey[];
      const keysWithStatus = keys.map(k => ({ ...k, status: getKeyStatus(k) }));
      return success(keysWithStatus);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to list MCP keys', err);
    }
  },

  /**
   * Create a new MCP key via the create_mcp_key RPC.
   * Returns the raw key ONCE — it is never stored or retrievable again.
   */
  async createKey(input: MCPKeyCreateInput): Promise<ServiceResult<MCPKeyCreateResult>> {
    try {
      const { data, error } = await supabase.rpc('create_mcp_key', {
        p_name: input.name,
        p_scopes: input.scopes,
        p_tenant_id: input.tenant_id || null,
        p_description: input.description || null,
        p_expires_at: input.expires_at || null,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const result = (data as MCPKeyCreateResult[])?.[0];
      if (!result) {
        return failure('OPERATION_FAILED', 'Key creation returned no result');
      }

      return success(result);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to create MCP key', err);
    }
  },

  /**
   * Revoke an MCP key via the revoke_mcp_key RPC.
   */
  async revokeKey(keyId: string, reason?: string): Promise<ServiceResult<boolean>> {
    try {
      const { data, error } = await supabase.rpc('revoke_mcp_key', {
        p_key_id: keyId,
        p_reason: reason || null,
      });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success(data as boolean);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to revoke MCP key', err);
    }
  },

  /**
   * Rotate a key: create a new key with the same config, then revoke the old one.
   */
  async rotateKey(
    oldKeyId: string,
    oldKey: MCPKey
  ): Promise<ServiceResult<MCPKeyCreateResult>> {
    try {
      // Create replacement key with same config
      const createResult = await this.createKey({
        name: `${oldKey.name} (rotated)`,
        scopes: oldKey.scopes,
        tenant_id: oldKey.tenant_id || undefined,
        description: oldKey.description || undefined,
        expires_at: oldKey.expires_at || undefined,
      });

      if (!createResult.success) {
        return createResult;
      }

      // Revoke old key
      const revokeResult = await this.revokeKey(oldKeyId, 'Rotated — replaced by new key');
      if (!revokeResult.success) {
        // New key was created but old wasn't revoked — warn but still return new key
        return success({
          ...createResult.data,
        });
      }

      return success(createResult.data);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to rotate MCP key', err);
    }
  },

  /**
   * Get recent audit log entries for a specific key.
   */
  async getKeyAuditLog(keyId: string, limit = 50): Promise<ServiceResult<MCPKeyAuditEntry[]>> {
    try {
      const { data, error } = await supabase
        .from('mcp_key_audit_log')
        .select('*')
        .eq('key_id', keyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      return success((data || []) as MCPKeyAuditEntry[]);
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch audit log', err);
    }
  },

  /**
   * Get keys that are expiring within the warning window.
   */
  async getExpiringKeys(): Promise<ServiceResult<(MCPKey & { status: KeyStatus })[]>> {
    try {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + EXPIRY_WARNING_DAYS);

      const { data, error } = await supabase
        .from('mcp_keys')
        .select('*')
        .is('revoked_at', null)
        .not('expires_at', 'is', null)
        .lte('expires_at', warningDate.toISOString())
        .order('expires_at', { ascending: true });

      if (error) {
        return failure('DATABASE_ERROR', error.message, error);
      }

      const keys = (data || []) as MCPKey[];
      return success(keys.map(k => ({ ...k, status: getKeyStatus(k) })));
    } catch (err: unknown) {
      return failure('UNKNOWN_ERROR', 'Failed to fetch expiring keys', err);
    }
  },
};
