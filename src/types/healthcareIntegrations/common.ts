/**
 * Healthcare Integrations — Common Types
 *
 * Shared base types used across all healthcare integration modules.
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';

export interface BaseConnection {
  id: string;
  tenantId: string;
  enabled: boolean;
  lastConnectedAt?: string;
  lastError?: string;
  connectionStatus: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}
