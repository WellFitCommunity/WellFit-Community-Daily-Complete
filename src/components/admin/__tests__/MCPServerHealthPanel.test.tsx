import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MCPServerHealthPanel from '../MCPServerHealthPanel';
import type {
  MCPHealthSummary,
  MCPServerStatus,
} from '../../../services/mcpHealthService';

// ── Mock Data Factories ──

function makeHealthyServer(
  name: string,
  displayName: string,
  tier: 'admin' | 'user_scoped' | 'external_api' = 'admin',
  deps: string[] = []
): MCPServerStatus {
  return {
    server: { name, displayName, tier },
    status: 'healthy',
    responseTimeMs: 42,
    lastChecked: '2026-02-28T12:00:00Z',
    dependencies: deps,
  };
}

function makeAllHealthySummary(): MCPHealthSummary {
  return {
    servers: [
      makeHealthyServer('mcp-claude-server', 'Claude AI', 'admin', ['supabase']),
      makeHealthyServer('mcp-fhir-server', 'FHIR R4', 'admin', ['supabase']),
      makeHealthyServer('mcp-hl7-x12-server', 'HL7 / X12', 'user_scoped'),
      makeHealthyServer('mcp-prior-auth-server', 'Prior Auth', 'admin'),
      makeHealthyServer('mcp-clearinghouse-server', 'Clearinghouse', 'external_api'),
      makeHealthyServer('mcp-cms-coverage-server', 'CMS Coverage', 'external_api'),
      makeHealthyServer('mcp-npi-registry-server', 'NPI Registry', 'external_api'),
      makeHealthyServer('mcp-postgres-server', 'Database', 'user_scoped'),
      makeHealthyServer('mcp-medical-codes-server', 'Medical Codes', 'external_api'),
      makeHealthyServer('mcp-edge-functions-server', 'Edge Functions', 'admin'),
      makeHealthyServer('mcp-pubmed-server', 'PubMed', 'external_api'),
    ],
    healthyCount: 11,
    degradedCount: 0,
    downCount: 0,
    totalCount: 11,
    checkedAt: '2026-02-28T12:00:00Z',
  };
}

function makeMixedStatusSummary(): MCPHealthSummary {
  const servers = makeAllHealthySummary().servers;
  servers[0] = { ...servers[0], status: 'down', error: 'Request timed out' };
  servers[2] = { ...servers[2], status: 'degraded' };
  return {
    servers,
    healthyCount: 9,
    degradedCount: 1,
    downCount: 1,
    totalCount: 11,
    checkedAt: '2026-02-28T12:00:00Z',
  };
}

// ── Mock the service ──

let mockCheckAllResult: { success: true; data: MCPHealthSummary; error: null } | { success: false; data: null; error: { code: string; message: string } };

vi.mock('../../../services/mcpHealthService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../services/mcpHealthService');
  return {
    ...actual,
    checkAllServersHealth: vi.fn(() => Promise.resolve(mockCheckAllResult)),
  };
});

// ── Tests ──

describe('MCPServerHealthPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockCheckAllResult = { success: true, data: makeAllHealthySummary(), error: null };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading skeleton before data arrives, then replaces with server cards', async () => {
    render(<MCPServerHealthPanel />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Claude AI')).toBeInTheDocument();
    expect(screen.getByText('FHIR R4')).toBeInTheDocument();
  });

  it('renders all 11 server display names when data loads', async () => {
    render(<MCPServerHealthPanel />);

    const expectedNames = [
      'Claude AI', 'FHIR R4', 'HL7 / X12', 'Prior Auth',
      'Clearinghouse', 'CMS Coverage', 'NPI Registry', 'Database',
      'Medical Codes', 'Edge Functions', 'PubMed',
    ];

    for (const name of expectedNames) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
  });

  it('displays correct status badges for healthy, degraded, and down servers', async () => {
    mockCheckAllResult = { success: true, data: makeMixedStatusSummary(), error: null };
    render(<MCPServerHealthPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    const healthyBadges = screen.getAllByText('Healthy');
    expect(healthyBadges).toHaveLength(9);

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    // 'Down' appears in badge and 'Servers Down' alert title, so use getAllByText
    const downElements = screen.getAllByText('Down');
    expect(downElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows critical alert when servers are down', async () => {
    mockCheckAllResult = { success: true, data: makeMixedStatusSummary(), error: null };
    render(<MCPServerHealthPanel />);

    expect(await screen.findByText('Servers Down')).toBeInTheDocument();
    expect(screen.getByText(/Claude AI is not responding/)).toBeInTheDocument();
  });

  it('shows summary bar with healthy/degraded/down counts', async () => {
    mockCheckAllResult = { success: true, data: makeMixedStatusSummary(), error: null };
    render(<MCPServerHealthPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText(/degraded/)).toBeInTheDocument();
    expect(screen.getByText(/down/)).toBeInTheDocument();
  });

  it('refresh button triggers new health check', async () => {
    const { checkAllServersHealth } = await import('../../../services/mcpHealthService');

    render(<MCPServerHealthPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    const refreshButton = screen.getByTestId('refresh-button');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(checkAllServersHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('shows dependencies when present', async () => {
    render(<MCPServerHealthPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    const supabaseDeps = screen.getAllByText('supabase');
    expect(supabaseDeps.length).toBeGreaterThanOrEqual(1);
  });

  it('shows error message when a server has an error', async () => {
    mockCheckAllResult = { success: true, data: makeMixedStatusSummary(), error: null };
    render(<MCPServerHealthPanel />);

    expect(await screen.findByText('Request timed out')).toBeInTheDocument();
  });

  it('shows failure alert when health check completely fails', async () => {
    mockCheckAllResult = {
      success: false,
      data: null,
      error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Failed to check MCP server health' },
    };
    render(<MCPServerHealthPanel />);

    expect(await screen.findByText('Health Check Failed')).toBeInTheDocument();
    expect(screen.getByText(/Unable to retrieve MCP server health data/)).toBeInTheDocument();
  });

  it('displays tier badges for each server', async () => {
    render(<MCPServerHealthPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument();
    });

    const adminBadges = screen.getAllByText('Admin');
    expect(adminBadges).toHaveLength(4);

    const externalBadges = screen.getAllByText('External API');
    expect(externalBadges).toHaveLength(5);

    const userScopedBadges = screen.getAllByText('User Scoped');
    expect(userScopedBadges).toHaveLength(2);
  });
});
