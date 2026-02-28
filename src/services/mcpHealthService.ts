/**
 * MCP Server Health Service
 *
 * Checks health status of all 11 MCP servers via their /health endpoints.
 * Used by MCPServerHealthPanel to display real-time server status.
 */

import { supabase } from '../lib/supabaseClient';
import { type ServiceResult, success, failure } from './_base';
import { auditLogger } from './auditLogger';

export type MCPServerTier = 'admin' | 'user_scoped' | 'external_api';

export type MCPServerHealthStatus = 'healthy' | 'degraded' | 'down';

export interface MCPServerInfo {
  name: string;
  displayName: string;
  tier: MCPServerTier;
}

export interface MCPServerStatus {
  server: MCPServerInfo;
  status: MCPServerHealthStatus;
  responseTimeMs: number;
  lastChecked: string;
  dependencies: string[];
  error?: string;
}

export interface MCPHealthSummary {
  servers: MCPServerStatus[];
  healthyCount: number;
  degradedCount: number;
  downCount: number;
  totalCount: number;
  checkedAt: string;
}

export const MCP_SERVERS: MCPServerInfo[] = [
  { name: 'mcp-claude-server', displayName: 'Claude AI', tier: 'admin' },
  { name: 'mcp-fhir-server', displayName: 'FHIR R4', tier: 'admin' },
  { name: 'mcp-hl7-x12-server', displayName: 'HL7 / X12', tier: 'user_scoped' },
  { name: 'mcp-prior-auth-server', displayName: 'Prior Auth', tier: 'admin' },
  { name: 'mcp-clearinghouse-server', displayName: 'Clearinghouse', tier: 'external_api' },
  { name: 'mcp-cms-coverage-server', displayName: 'CMS Coverage', tier: 'external_api' },
  { name: 'mcp-npi-registry-server', displayName: 'NPI Registry', tier: 'external_api' },
  { name: 'mcp-postgres-server', displayName: 'Database', tier: 'user_scoped' },
  { name: 'mcp-medical-codes-server', displayName: 'Medical Codes', tier: 'external_api' },
  { name: 'mcp-edge-functions-server', displayName: 'Edge Functions', tier: 'admin' },
  { name: 'mcp-pubmed-server', displayName: 'PubMed', tier: 'external_api' },
];

const HEALTH_TIMEOUT_MS = 5000;

function getSupabaseFunctionsUrl(): string {
  const projectUrl = import.meta.env.VITE_SUPABASE_URL || '';
  return `${projectUrl}/functions/v1`;
}

async function getServiceRoleHeaders(): Promise<Record<string, string>> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function checkServerHealth(
  server: MCPServerInfo
): Promise<ServiceResult<MCPServerStatus>> {
  const startTime = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const baseUrl = getSupabaseFunctionsUrl();
    const headers = await getServiceRoleHeaders();
    const url = `${baseUrl}/${server.name}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method: 'health/check' }),
      signal: controller.signal,
    });

    const elapsed = Math.round(performance.now() - startTime);
    let dependencies: string[] = [];
    let status: MCPServerHealthStatus = 'down';

    if (response.ok) {
      try {
        const body: unknown = await response.json();
        if (isHealthResponse(body)) {
          dependencies = body.dependencies
            ? Object.keys(body.dependencies)
            : [];
          status = body.status === 'healthy' ? 'healthy' : 'degraded';
        } else {
          status = 'healthy';
        }
      } catch {
        status = 'healthy';
      }
    } else if (response.status === 503) {
      status = 'degraded';
    }

    return success({
      server,
      status,
      responseTimeMs: elapsed,
      lastChecked: new Date().toISOString(),
      dependencies,
    });
  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - startTime);
    const isTimeout = err instanceof DOMException && err.name === 'AbortError';

    return success({
      server,
      status: 'down',
      responseTimeMs: elapsed,
      lastChecked: new Date().toISOString(),
      dependencies: [],
      error: isTimeout ? 'Request timed out' : (err instanceof Error ? err.message : String(err)),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkAllServersHealth(): Promise<ServiceResult<MCPHealthSummary>> {
  try {
    const results = await Promise.allSettled(
      MCP_SERVERS.map(server => checkServerHealth(server))
    );

    const servers: MCPServerStatus[] = results.map((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        return result.value.data;
      }
      return {
        server: MCP_SERVERS[index],
        status: 'down' as MCPServerHealthStatus,
        responseTimeMs: 0,
        lastChecked: new Date().toISOString(),
        dependencies: [],
        error: result.status === 'rejected' ? String(result.reason) : 'Unknown error',
      };
    });

    const healthyCount = servers.filter(s => s.status === 'healthy').length;
    const degradedCount = servers.filter(s => s.status === 'degraded').length;
    const downCount = servers.filter(s => s.status === 'down').length;

    if (downCount > 0) {
      const downNames = servers
        .filter(s => s.status === 'down')
        .map(s => s.server.displayName)
        .join(', ');
      await auditLogger.warn('MCP_SERVERS_DOWN', {
        downCount,
        downServers: downNames,
      });
    }

    return success({
      servers,
      healthyCount,
      degradedCount,
      downCount,
      totalCount: MCP_SERVERS.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'MCP_HEALTH_CHECK_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { context: 'checkAllServersHealth' }
    );
    return failure('EXTERNAL_SERVICE_ERROR', 'Failed to check MCP server health', err);
  }
}

function isHealthResponse(
  value: unknown
): value is { status: string; dependencies?: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.status === 'string';
}
