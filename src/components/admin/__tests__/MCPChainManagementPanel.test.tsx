/**
 * MCPChainManagementPanel — Behavioral Tests
 *
 * Tier 1-4: behavior, state, integration, and edge cases.
 * Tests the full chain management UI: tabs, chain list, runs, approvals, start modal.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { failure as createFailure, success as createSuccess } from '../../../services/_base/ServiceResult';
import type { ServiceFailure } from '../../../services/_base/ServiceResult';
import type {
  ChainDefinition,
  ChainRun,
  ChainStepDefinition,
  ChainStepResult,
  ChainStatusResponse,
} from '../../../services/mcp/chainOrchestration.types';

// ============================================================
// Test data factories
// ============================================================

function makeChainDefinition(overrides: Partial<ChainDefinition> = {}): ChainDefinition {
  return {
    id: 'def-001',
    chain_key: 'medical_coding_revenue',
    display_name: 'Medical Coding Pipeline',
    description: 'End-to-end inpatient revenue pipeline',
    version: 1,
    is_active: true,
    ...overrides,
  };
}

function makeChainRun(overrides: Partial<ChainRun> = {}): ChainRun {
  return {
    id: 'run-001',
    chain_definition_id: 'def-001',
    chain_key: 'medical_coding_revenue',
    status: 'running',
    current_step_order: 1,
    input_params: { patient_id: 'patient-abc', encounter_id: 'enc-123' },
    output: null,
    started_by: 'user-123',
    tenant_id: 'tenant-001',
    error_message: null,
    error_step_key: null,
    started_at: '2026-03-04T10:00:00Z',
    completed_at: null,
    created_at: '2026-03-04T10:00:00Z',
    ...overrides,
  };
}

function makeStepDefinition(overrides: Partial<ChainStepDefinition> = {}): ChainStepDefinition {
  return {
    id: 'stepdef-001',
    chain_definition_id: 'def-001',
    step_order: 1,
    step_key: 'aggregate_charges',
    display_name: 'Aggregate Daily Charges',
    mcp_server: 'mcp-medical-coding-server',
    tool_name: 'aggregate_daily_charges',
    requires_approval: false,
    approval_role: null,
    is_conditional: false,
    is_placeholder: false,
    placeholder_message: null,
    timeout_ms: 30000,
    input_mapping: { '$.input.encounter_id': 'encounter_id' },
    max_retries: 1,
    ...overrides,
  };
}

function makeStepResult(overrides: Partial<ChainStepResult> = {}): ChainStepResult {
  return {
    id: 'step-001',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-001',
    step_order: 1,
    step_key: 'aggregate_charges',
    mcp_server: 'mcp-medical-coding-server',
    tool_name: 'aggregate_daily_charges',
    status: 'completed',
    input_args: { encounter_id: 'enc-123' },
    output_data: { total_charge_amount: 2500 },
    error_message: null,
    execution_time_ms: 450,
    approved_by: null,
    approved_at: null,
    approval_notes: null,
    placeholder_message: null,
    ...overrides,
  };
}

function ok<T>(data: T) {
  return createSuccess(data);
}

function fail(message: string): ServiceFailure {
  return createFailure('UNKNOWN_ERROR', message);
}

// ============================================================
// Mocks
// ============================================================

const mockListChains = vi.fn();
const mockListChainRuns = vi.fn();
const mockListChainSteps = vi.fn();
const mockGetChainStatus = vi.fn();
const mockStartChain = vi.fn();
const mockApproveStep = vi.fn();
const mockResumeChain = vi.fn();
const mockCancelChain = vi.fn();

vi.mock('../../../services/mcp/chainOrchestrationService', () => ({
  chainOrchestrationService: {
    listChains: (...args: unknown[]) => mockListChains(...args),
    listChainRuns: (...args: unknown[]) => mockListChainRuns(...args),
    listChainSteps: (...args: unknown[]) => mockListChainSteps(...args),
    getChainStatus: (...args: unknown[]) => mockGetChainStatus(...args),
    startChain: (...args: unknown[]) => mockStartChain(...args),
    approveStep: (...args: unknown[]) => mockApproveStep(...args),
    resumeChain: (...args: unknown[]) => mockResumeChain(...args),
    cancelChain: (...args: unknown[]) => mockCancelChain(...args),
  },
}));

// ============================================================
// Setup
// ============================================================

const DEFAULT_CHAINS = [
  makeChainDefinition(),
  makeChainDefinition({
    id: 'def-002',
    chain_key: 'claims_pipeline',
    display_name: 'Claims Submission Pipeline',
    description: 'End-to-end claim submission',
  }),
];

const DEFAULT_RUNS = [
  makeChainRun(),
  makeChainRun({
    id: 'run-002',
    chain_key: 'claims_pipeline',
    status: 'completed',
    completed_at: '2026-03-04T10:05:00Z',
  }),
];

const DEFAULT_STEPS = [
  makeStepDefinition(),
  makeStepDefinition({
    id: 'stepdef-002',
    step_order: 2,
    step_key: 'save_snapshot',
    display_name: 'Save Snapshot',
    input_mapping: {},
  }),
];

const DEFAULT_STEP_RESULTS = [
  makeStepResult(),
  makeStepResult({
    id: 'step-002',
    step_order: 2,
    step_key: 'drg_grouper',
    status: 'awaiting_approval',
    output_data: { drg_code: '470' },
    execution_time_ms: 3200,
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });

  mockListChains.mockResolvedValue(ok(DEFAULT_CHAINS));
  mockListChainRuns.mockResolvedValue(ok(DEFAULT_RUNS));
  mockListChainSteps.mockResolvedValue(ok(DEFAULT_STEPS));
  mockGetChainStatus.mockResolvedValue(
    ok<ChainStatusResponse>({ run: DEFAULT_RUNS[0], steps: DEFAULT_STEP_RESULTS })
  );
  mockStartChain.mockResolvedValue(ok({ run: makeChainRun() }));
  mockApproveStep.mockResolvedValue(
    ok({ step: makeStepResult({ status: 'approved' }) })
  );
  mockResumeChain.mockResolvedValue(
    ok({ run: makeChainRun({ status: 'running', current_step_order: 3 }) })
  );
  mockCancelChain.mockResolvedValue(
    ok({ run: makeChainRun({ status: 'cancelled' }) })
  );
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// Lazy import for MCPChainManagementPanel (handles React.lazy in barrel)
// ============================================================

async function renderPanel() {
  const { default: MCPChainManagementPanel } = await import('../mcp-chains/MCPChainManagementPanel');
  return render(<MCPChainManagementPanel />);
}

// ============================================================
// Tests
// ============================================================

describe('MCPChainManagementPanel', () => {
  // ========================================================
  // Tier 2: Loading → Data Display Lifecycle
  // ========================================================

  it('shows loading spinner before data arrives, then displays tabs', async () => {
    await renderPanel();

    expect(screen.getByTestId('chain-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('chain-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getByTestId('tab-runs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-approvals')).toBeInTheDocument();
  });

  it('displays chain definition cards on overview tab after loading', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Medical Coding Pipeline')).toBeInTheDocument();
    });

    expect(screen.getByText('Claims Submission Pipeline')).toBeInTheDocument();
    expect(screen.getByText('End-to-end inpatient revenue pipeline')).toBeInTheDocument();
  });

  it('shows version badge on each chain card', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Medical Coding Pipeline')).toBeInTheDocument();
    });

    const versionBadges = screen.getAllByText('v1');
    expect(versionBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('lazy-loads step count for each chain definition', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Medical Coding Pipeline')).toBeInTheDocument();
    });

    await waitFor(() => {
      const stepTexts = screen.getAllByText('2 steps');
      expect(stepTexts.length).toBeGreaterThanOrEqual(1);
    });

    // Called for both chain definitions
    expect(mockListChainSteps).toHaveBeenCalled();
  });

  // ========================================================
  // Tier 1: Tab Navigation
  // ========================================================

  it('switches between Overview, Runs, and Approvals tabs', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('chain-definition-list')).toBeInTheDocument();
    });

    // Switch to Runs tab
    fireEvent.click(screen.getByTestId('tab-runs'));
    await waitFor(() => {
      expect(screen.getByTestId('chain-runs-list')).toBeInTheDocument();
    });

    // Switch to Approvals tab
    fireEvent.click(screen.getByTestId('tab-approvals'));
    await waitFor(() => {
      expect(screen.getByTestId('no-approvals')).toBeInTheDocument();
    });

    // Back to Overview
    fireEvent.click(screen.getByTestId('tab-overview'));
    await waitFor(() => {
      expect(screen.getByTestId('chain-definition-list')).toBeInTheDocument();
    });
  });

  it('shows approval count badge on approvals tab when runs are awaiting', async () => {
    const awaitingRuns = [
      makeChainRun({ id: 'run-await-1', status: 'awaiting_approval' }),
    ];
    mockListChainRuns.mockResolvedValue(ok(awaitingRuns));

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('tab-approvals')).toBeInTheDocument();
    });

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  // ========================================================
  // Tier 1: Runs Table
  // ========================================================

  it('displays chain runs with status badges and chain keys', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('chain-runs-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('expands a run row to show step details', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('run-detail')).toBeInTheDocument();
    });

    expect(mockGetChainStatus).toHaveBeenCalledWith('run-001');
  });

  // ========================================================
  // Tier 1: Run Detail — Step Status Badges
  // ========================================================

  it('shows step-level status badges in run detail', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('step-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('step-aggregate_charges')).toBeInTheDocument();
    expect(screen.getByTestId('step-drg_grouper')).toBeInTheDocument();
  });

  // ========================================================
  // Tier 1: Collapsible JSON Sections
  // ========================================================

  it('shows collapsible input/output JSON when step is expanded', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('step-aggregate_charges')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-step-aggregate_charges'));

    await waitFor(() => {
      expect(screen.getByTestId('step-detail-aggregate_charges')).toBeInTheDocument();
    });

    expect(screen.getByText('Input JSON')).toBeInTheDocument();
    expect(screen.getByText('Output JSON')).toBeInTheDocument();
  });

  // ========================================================
  // Tier 1: Approval Actions
  // ========================================================

  it('shows approve/reject buttons for steps awaiting approval', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('step-drg_grouper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-step-drg_grouper'));

    await waitFor(() => {
      expect(screen.getByTestId('approval-form-drg_grouper')).toBeInTheDocument();
    });

    expect(screen.getByTestId('approve-step-drg_grouper')).toBeInTheDocument();
    expect(screen.getByTestId('reject-step-drg_grouper')).toBeInTheDocument();
    expect(screen.getByTestId('approval-notes-drg_grouper')).toBeInTheDocument();
  });

  it('calls approveStep with notes when approve button is clicked', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('step-drg_grouper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-step-drg_grouper'));

    const notesInput = await screen.findByTestId('approval-notes-drg_grouper');
    fireEvent.change(notesInput, { target: { value: 'DRG 470 confirmed' } });

    fireEvent.click(screen.getByTestId('approve-step-drg_grouper'));

    await waitFor(() => {
      expect(mockApproveStep).toHaveBeenCalledWith(
        'run-001',
        'step-002',
        'approved',
        'DRG 470 confirmed'
      );
    });
  });

  it('calls approveStep with rejected decision when reject button is clicked', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('step-drg_grouper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-step-drg_grouper'));

    await waitFor(() => {
      expect(screen.getByTestId('reject-step-drg_grouper')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('reject-step-drg_grouper'));

    await waitFor(() => {
      expect(mockApproveStep).toHaveBeenCalledWith(
        'run-001',
        'step-002',
        'rejected',
        undefined
      );
    });
  });

  // ========================================================
  // Tier 1: Start Chain Modal
  // ========================================================

  it('opens start chain modal when Start Chain button is clicked', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-modal')).toBeInTheDocument();
    });

    expect(screen.getByTestId('submit-start-chain')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-start-chain')).toBeInTheDocument();
  });

  it('renders dynamic input fields from step definitions input_mapping', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-modal')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('input-encounter_id')).toBeInTheDocument();
    });
  });

  it('submits start chain with input values and switches to runs tab', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('input-encounter_id')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('input-encounter_id'), {
      target: { value: 'enc-999' },
    });

    fireEvent.click(screen.getByTestId('submit-start-chain'));

    await waitFor(() => {
      expect(mockStartChain).toHaveBeenCalledWith(
        'medical_coding_revenue',
        { encounter_id: 'enc-999' }
      );
    });
  });

  it('shows error message when start chain fails', async () => {
    mockStartChain.mockResolvedValue(fail('Chain not found'));

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('submit-start-chain'));

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Chain not found')).toBeInTheDocument();
  });

  it('closes modal when cancel button is clicked', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-start-chain'));

    await waitFor(() => {
      expect(screen.queryByTestId('start-chain-modal')).not.toBeInTheDocument();
    });
  });

  // ========================================================
  // Tier 1: Resume / Cancel Chain Actions
  // ========================================================

  it('shows resume button for awaiting_approval runs and calls resumeChain', async () => {
    const awaitingRun = makeChainRun({ status: 'awaiting_approval' });
    mockGetChainStatus.mockResolvedValue(
      ok<ChainStatusResponse>({
        run: awaitingRun,
        steps: DEFAULT_STEP_RESULTS,
      })
    );

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    const resumeBtn = await screen.findByTestId('resume-chain');
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(mockResumeChain).toHaveBeenCalledWith('run-001');
    });
  });

  it('shows cancel button for running runs and calls cancelChain', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    const cancelBtn = await screen.findByTestId('cancel-chain');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(mockCancelChain).toHaveBeenCalledWith('run-001');
    });
  });

  // ========================================================
  // Tier 4: Empty States
  // ========================================================

  it('shows empty state when no chain definitions exist', async () => {
    mockListChains.mockResolvedValue(ok([]));

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('no-chains')).toBeInTheDocument();
    });

    expect(screen.getByText(/no chain definitions found/i)).toBeInTheDocument();
  });

  it('shows empty state when no runs exist', async () => {
    mockListChainRuns.mockResolvedValue(ok([]));

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('no-runs')).toBeInTheDocument();
    });

    expect(screen.getByText(/no chain runs found/i)).toBeInTheDocument();
  });

  it('shows empty state when no runs are awaiting approval', async () => {
    mockListChainRuns.mockResolvedValue(ok([
      makeChainRun({ status: 'completed' }),
    ]));

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-approvals'));

    await waitFor(() => {
      expect(screen.getByTestId('no-approvals')).toBeInTheDocument();
    });

    expect(screen.getByText(/no chains awaiting approval/i)).toBeInTheDocument();
  });

  // ========================================================
  // Tier 4: Error States
  // ========================================================

  it('shows error alert when data load fails', async () => {
    mockListChains.mockResolvedValue(fail('Database connection failed'));

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    expect(screen.getByText(/database connection failed/i)).toBeInTheDocument();
  });

  it('shows error when run detail fails to load', async () => {
    mockGetChainStatus.mockResolvedValue(fail('Run not found'));

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-runs'));

    await waitFor(() => {
      expect(screen.getByTestId('run-row-run-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-run-run-001'));

    await waitFor(() => {
      expect(screen.getByTestId('run-detail-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Run not found')).toBeInTheDocument();
  });

  // ========================================================
  // Tier 1: Refresh
  // ========================================================

  it('calls loadData when refresh button is clicked', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    mockListChains.mockClear();
    mockListChainRuns.mockClear();

    fireEvent.click(screen.getByTestId('refresh-chains'));

    await waitFor(() => {
      expect(mockListChains).toHaveBeenCalled();
      expect(mockListChainRuns).toHaveBeenCalled();
    });
  });

  // ========================================================
  // Tier 2: Approval Queue Tab
  // ========================================================

  it('shows awaiting approval runs in the approval queue tab', async () => {
    const awaitingRuns = [
      makeChainRun({ id: 'run-await-1', status: 'awaiting_approval' }),
      makeChainRun({ id: 'run-await-2', status: 'awaiting_approval', chain_key: 'claims_pipeline' }),
    ];
    mockListChainRuns.mockResolvedValue(ok(awaitingRuns));

    await renderPanel();

    await waitFor(() => {
      expect(screen.queryByTestId('chain-loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-approvals'));

    await waitFor(() => {
      expect(screen.getByTestId('approval-queue')).toBeInTheDocument();
    });

    expect(screen.getByText(/2 chains awaiting approval/i)).toBeInTheDocument();
    expect(screen.getByTestId('approval-item-run-await-1')).toBeInTheDocument();
    expect(screen.getByTestId('approval-item-run-await-2')).toBeInTheDocument();
  });

  // ========================================================
  // Tier 1: Start modal with no input fields
  // ========================================================

  it('shows no-input-fields message when chain has no $.input mappings', async () => {
    mockListChainSteps.mockResolvedValue(ok([
      makeStepDefinition({ input_mapping: {} }),
    ]));

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('start-chain-medical_coding_revenue')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('start-chain-medical_coding_revenue'));

    await waitFor(() => {
      expect(screen.getByTestId('no-input-fields')).toBeInTheDocument();
    });

    expect(screen.getByText(/no input parameters/i)).toBeInTheDocument();
  });
});
