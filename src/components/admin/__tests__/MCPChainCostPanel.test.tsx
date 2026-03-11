/**
 * MCPChainCostPanel Tests
 *
 * Behavioral tests for chain execution cost tracking:
 * - Chain run listing with summary metrics
 * - Expandable step breakdown
 * - Duration formatting
 * - Error handling
 * - Time range filtering
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// --- Hoisted mocks ---
const mockListChainRuns = vi.hoisted(() => vi.fn());
const mockGetChainStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../services/mcp/chainOrchestrationService', () => ({
  chainOrchestrationService: {
    listChainRuns: mockListChainRuns,
    getChainStatus: mockGetChainStatus,
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
}));

// --- Import (after mocks) ---
import MCPChainCostPanel from '../MCPChainCostPanel';

// --- Test Data ---
const mockRuns = [
  {
    id: 'run-001',
    chain_definition_id: 'def-1',
    chain_key: 'claims_pipeline',
    status: 'completed',
    current_step_order: 5,
    input_params: {},
    output: {},
    started_by: 'user-test-abc',
    tenant_id: 'tenant-test-123',
    started_at: '2026-03-11T10:00:00Z',
    completed_at: '2026-03-11T10:01:30Z',
    created_at: '2026-03-11T10:00:00Z',
  },
  {
    id: 'run-002',
    chain_definition_id: 'def-2',
    chain_key: 'provider_onboarding',
    status: 'failed',
    current_step_order: 2,
    input_params: {},
    output: null,
    started_by: 'user-test-abc',
    tenant_id: 'tenant-test-123',
    started_at: '2026-03-11T09:00:00Z',
    completed_at: null,
    created_at: '2026-03-11T09:00:00Z',
  },
];

const mockSteps = [
  {
    id: 'step-001',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-1',
    step_order: 1,
    step_key: 'validate_codes',
    mcp_server: 'medical-codes',
    tool_name: 'validate_code_combination',
    status: 'completed',
    input_args: {},
    output_data: {},
    error_message: null,
    execution_time_ms: 450,
    retry_count: 0,
    approved_by: null,
    approved_at: null,
    approval_notes: null,
  },
  {
    id: 'step-002',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-2',
    step_order: 2,
    step_key: 'check_prior_auth',
    mcp_server: 'cms-coverage',
    tool_name: 'check_prior_auth_required',
    status: 'completed',
    input_args: {},
    output_data: {},
    error_message: null,
    execution_time_ms: 1200,
    retry_count: 1,
    approved_by: null,
    approved_at: null,
    approval_notes: null,
  },
];

// --- Setup ---
beforeEach(() => {
  vi.clearAllMocks();
  mockListChainRuns.mockResolvedValue({
    success: true,
    data: mockRuns,
  });
});

describe('MCPChainCostPanel', () => {
  it('renders header and summary metrics', async () => {
    render(<MCPChainCostPanel />);

    expect(screen.getByText('Chain Execution Costs')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    // Summary cards
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // total
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('displays chain runs in the table', async () => {
    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    expect(screen.getByText('provider_onboarding')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('expands a run to show step breakdown', async () => {
    mockGetChainStatus.mockResolvedValue({
      success: true,
      data: {
        run: mockRuns[0],
        steps: mockSteps,
      },
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    // Click to expand
    fireEvent.click(screen.getByText('claims_pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Step Breakdown')).toBeInTheDocument();
    });

    expect(screen.getByText('validate_codes')).toBeInTheDocument();
    expect(screen.getByText('check_prior_auth')).toBeInTheDocument();
    expect(screen.getByText('medical-codes')).toBeInTheDocument();
    expect(screen.getByText('cms-coverage')).toBeInTheDocument();
    expect(screen.getByText('450ms')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
  });

  it('shows total duration in step breakdown footer', async () => {
    mockGetChainStatus.mockResolvedValue({
      success: true,
      data: {
        run: mockRuns[0],
        steps: mockSteps,
      },
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('claims_pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Total:')).toBeInTheDocument();
    });

    // 450ms + 1200ms = 1650ms = 1.6s — appears in multiple places (avg, row, footer)
    const durationElements = screen.getAllByText('1.6s');
    expect(durationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows retry count in step breakdown', async () => {
    mockGetChainStatus.mockResolvedValue({
      success: true,
      data: {
        run: mockRuns[0],
        steps: mockSteps,
      },
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('claims_pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Retries')).toBeInTheDocument();
    });
  });

  it('shows error when chain runs fail to load', async () => {
    mockListChainRuns.mockResolvedValue({
      success: false,
      error: 'Database unavailable',
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('Database unavailable')).toBeInTheDocument();
    });
  });

  it('shows empty state when no runs exist', async () => {
    mockListChainRuns.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('No chain runs found for this period')).toBeInTheDocument();
    });
  });

  it('collapses expanded run when clicked again', async () => {
    mockGetChainStatus.mockResolvedValue({
      success: true,
      data: {
        run: mockRuns[0],
        steps: mockSteps,
      },
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByText('claims_pipeline'));
    await waitFor(() => {
      expect(screen.getByText('Step Breakdown')).toBeInTheDocument();
    });

    // Collapse
    fireEvent.click(screen.getByText('claims_pipeline'));
    await waitFor(() => {
      expect(screen.queryByText('Step Breakdown')).not.toBeInTheDocument();
    });
  });

  it('renders time range buttons', () => {
    render(<MCPChainCostPanel />);

    expect(screen.getByText('24h')).toBeInTheDocument();
    expect(screen.getByText('7d')).toBeInTheDocument();
    expect(screen.getByText('30d')).toBeInTheDocument();
  });

  it('shows error messages for failed steps', async () => {
    const stepsWithError = [
      ...mockSteps,
      {
        id: 'step-003',
        chain_run_id: 'run-001',
        step_definition_id: 'stepdef-3',
        step_order: 3,
        step_key: 'submit_claim',
        mcp_server: 'clearinghouse',
        tool_name: 'submit_claim',
        status: 'failed',
        input_args: {},
        output_data: null,
        error_message: 'Clearinghouse timeout after 30s',
        execution_time_ms: 30000,
        retry_count: 3,
        approved_by: null,
        approved_at: null,
        approval_notes: null,
      },
    ];

    mockGetChainStatus.mockResolvedValue({
      success: true,
      data: {
        run: mockRuns[0],
        steps: stepsWithError,
      },
    });

    render(<MCPChainCostPanel />);

    await waitFor(() => {
      expect(screen.getByText('claims_pipeline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('claims_pipeline'));

    await waitFor(() => {
      expect(screen.getByText('Clearinghouse timeout after 30s')).toBeInTheDocument();
    });
  });
});
