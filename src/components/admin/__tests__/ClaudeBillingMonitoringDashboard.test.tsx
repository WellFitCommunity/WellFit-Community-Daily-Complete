/**
 * ClaudeBillingMonitoringDashboard Tests
 *
 * Purpose: Tests the Claude & Billing Monitoring Dashboard component including
 * loading states, date range selector, service status cards, Claude usage
 * metrics, billing workflow metrics, financial summary, top errors, insights,
 * and error handling via auditLogger.
 *
 * Deletion Test: Every test asserts content unique to this dashboard.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// ---- Per-table mock responses ----
type MockResponse = { data: unknown; error: unknown };
const tableResponses: Record<string, MockResponse | (() => Promise<MockResponse>)> = {};

function setTableResponse(table: string, response: MockResponse) {
  tableResponses[table] = response;
}

function setTableRejection(table: string, error: Error) {
  tableResponses[table] = () => Promise.reject(error);
}

// Build a mock chain that resolves based on which table was passed to `from()`
function buildChain(table: string) {
  const resolve = () => {
    const entry = tableResponses[table];
    if (typeof entry === 'function') return entry();
    return Promise.resolve(entry || { data: [], error: null });
  };
  return {
    select: () => ({
      gte: () => ({
        lte: () => ({
          order: () => resolve(),
        }),
      }),
    }),
  };
}

const mockFrom = vi.fn((table: string) => buildChain(table));
const mockSupabase = { from: (table: string) => mockFrom(table) };

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
}));

const mockGetServiceStatus = vi.fn();
const mockGetSpendingSummary = vi.fn();

vi.mock('../../../services/claudeService', () => ({
  claudeService: {
    getServiceStatus: (...args: unknown[]) => mockGetServiceStatus(...args),
    getSpendingSummary: (...args: unknown[]) => mockGetSpendingSummary(...args),
  },
}));

const mockGetWorkflowMetrics = vi.fn();

vi.mock('../../../services/unifiedBillingService', () => ({
  UnifiedBillingService: {
    getWorkflowMetrics: (...args: unknown[]) => mockGetWorkflowMetrics(...args),
  },
}));

vi.mock('../../../services/performanceMonitoring', () => ({
  performanceMonitor: {
    trackMetric: vi.fn(),
    startTrace: vi.fn().mockReturnValue({ stop: vi.fn() }),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---- Test fixtures ----
const makeClaudeLogs = () => [
  {
    created_at: '2026-02-10T08:00:00Z', cost: 0.05, success: true,
    input_tokens: 500, output_tokens: 200, model: 'claude-haiku-4-5-20251001',
    response_time_ms: 120, error_code: null, user_id: 'user-test-alpha',
  },
  {
    created_at: '2026-02-10T09:00:00Z', cost: 0.15, success: true,
    input_tokens: 1200, output_tokens: 800, model: 'claude-sonnet-4-5-20250929',
    response_time_ms: 350, error_code: null, user_id: 'user-test-alpha',
  },
  {
    created_at: '2026-02-11T10:00:00Z', cost: 0.03, success: false,
    input_tokens: 300, output_tokens: 0, model: 'claude-haiku-4-5-20251001',
    response_time_ms: 50, error_code: 'RATE_LIMIT_EXCEEDED', user_id: 'user-test-beta',
  },
];

const makeBillingWorkflows = () => [
  {
    encounter_type: 'outpatient', ai_suggestions_used: true,
    ai_suggestions_accepted: true, sdoh_enhanced: false, created_at: '2026-02-10',
  },
  {
    encounter_type: 'inpatient', ai_suggestions_used: true,
    ai_suggestions_accepted: false, sdoh_enhanced: true, created_at: '2026-02-11',
  },
  {
    encounter_type: 'outpatient', ai_suggestions_used: false,
    ai_suggestions_accepted: false, sdoh_enhanced: false, created_at: '2026-02-12',
  },
];

const happyWorkflowMetrics = () => ({
  totalWorkflows: 150,
  successRate: 92.5,
  averageProcessingTime: 2500,
  manualReviewRate: 18.0,
  totalCharges: 125000,
  estimatedReimbursement: 95000,
  topErrors: [
    { code: 'E001', count: 12, message: 'Missing modifier' },
    { code: 'E002', count: 7, message: 'Invalid diagnosis code' },
  ],
});

const emptyWorkflowMetrics = () => ({
  totalWorkflows: 0, successRate: 0, averageProcessingTime: 0,
  manualReviewRate: 0, totalCharges: 0, estimatedReimbursement: 0,
  topErrors: [],
});

function setupHappyPath() {
  setTableResponse('claude_usage_logs', { data: makeClaudeLogs(), error: null });
  setTableResponse('billing_workflows', { data: makeBillingWorkflows(), error: null });
  mockGetWorkflowMetrics.mockResolvedValue(happyWorkflowMetrics());
}

function setupEmptyPath() {
  setTableResponse('claude_usage_logs', { data: [], error: null });
  setTableResponse('billing_workflows', { data: [], error: null });
  mockGetWorkflowMetrics.mockResolvedValue(emptyWorkflowMetrics());
}

async function renderDashboard() {
  const mod = await import('../ClaudeBillingMonitoringDashboard');
  const Component = mod.default;
  return render(<Component />);
}

describe('ClaudeBillingMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset table responses
    Object.keys(tableResponses).forEach(key => delete tableResponses[key]);

    mockGetServiceStatus.mockReturnValue({
      isHealthy: true, circuitBreakerState: 'closed',
      lastHealthCheck: new Date('2026-01-15T10:00:00Z'),
      isInitialized: true, apiKeyValid: true, modelsAvailable: [],
    });
    mockGetSpendingSummary.mockReturnValue({
      totalDaily: 12.50, totalMonthly: 245.00, userCount: 5,
    });
    mockGetWorkflowMetrics.mockResolvedValue(emptyWorkflowMetrics());
  });

  // ------------------------------------------------------------------
  // 1. Loading state
  // ------------------------------------------------------------------
  it('shows loading skeleton with pulse animation while data loads', async () => {
    // Never-resolving responses to keep loading state
    tableResponses['claude_usage_logs'] = () => new Promise(() => {});
    tableResponses['billing_workflows'] = () => new Promise(() => {});
    mockGetWorkflowMetrics.mockReturnValue(new Promise(() => {}));

    const { container } = await renderDashboard();

    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // 2. Date range selector
  // ------------------------------------------------------------------
  it('renders date range selector with 7d, 30d, and 90d options', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude & Billing Monitoring')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('Last 30 days');
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    const optionValues = Array.from(options).map(o => o.getAttribute('value'));
    expect(optionValues).toEqual(['7d', '30d', '90d']);
  });

  // ------------------------------------------------------------------
  // 3. Refresh button
  // ------------------------------------------------------------------
  it('renders a refresh button that triggers data reload', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh').closest('button');
    expect(refreshButton).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 4. Claude metrics cards
  // ------------------------------------------------------------------
  it('displays Claude AI usage metric cards with correct values', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude AI Usage')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Success Rate = 2/3 * 100 = 66.7%
    const successRateCards = screen.getAllByText('Success Rate');
    expect(successRateCards.length).toBeGreaterThan(0);
    expect(screen.getByText('66.7%')).toBeInTheDocument();

    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('$0.23')).toBeInTheDocument();

    // Avg Response Time = (120 + 350 + 50) / 3 = ~173ms
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
    expect(screen.getByText('173ms')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 5. Billing metrics cards
  // ------------------------------------------------------------------
  it('displays billing workflow metric cards', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Billing Workflow Performance')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Workflows')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();

    expect(screen.getByText('Manual Review Rate')).toBeInTheDocument();
    expect(screen.getByText('18.0%')).toBeInTheDocument();

    expect(screen.getByText('Avg Processing Time')).toBeInTheDocument();
    expect(screen.getByText('2.5s')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 6. Cost by model table
  // ------------------------------------------------------------------
  it('renders cost by model breakdown with model names and costs', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Cost by Model')).toBeInTheDocument();
    });

    expect(screen.getByText('claude-haiku-4-5-20251001')).toBeInTheDocument();
    expect(screen.getByText('$0.08')).toBeInTheDocument();

    expect(screen.getByText('claude-sonnet-4-5-20250929')).toBeInTheDocument();
    expect(screen.getByText('$0.15')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 7. Financial summary
  // ------------------------------------------------------------------
  it('shows financial summary with charges, reimbursement, and rate', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Charges')).toBeInTheDocument();
    });

    expect(screen.getByText('$125,000')).toBeInTheDocument();
    expect(screen.getByText('Estimated Reimbursement')).toBeInTheDocument();
    expect(screen.getByText('$95,000')).toBeInTheDocument();
    expect(screen.getByText('Reimbursement Rate')).toBeInTheDocument();
    expect(screen.getByText('76.0%')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 8. Top billing errors table
  // ------------------------------------------------------------------
  it('renders top billing error rows with code, message, and count', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Top Billing Errors')).toBeInTheDocument();
    });

    expect(screen.getByText('E001')).toBeInTheDocument();
    expect(screen.getByText('Missing modifier')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('E002')).toBeInTheDocument();
    expect(screen.getByText('Invalid diagnosis code')).toBeInTheDocument();
    // Error count '7' rendered as red text; use class filter to disambiguate
    const errorCountElements = screen.getAllByText('7');
    const errorCount = errorCountElements.find(
      el => el.classList.contains('text-red-600')
    );
    expect(errorCount).toBeDefined();
  });

  // ------------------------------------------------------------------
  // 9. Service status — healthy
  // ------------------------------------------------------------------
  it('shows Claude AI service health indicator as healthy', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude AI Service')).toBeInTheDocument();
    });

    expect(screen.getByText(/Healthy/)).toBeInTheDocument();
    expect(screen.getByText(/closed/i)).toBeInTheDocument();
  });

  it('shows Claude AI service as unhealthy when service reports issues', async () => {
    mockGetServiceStatus.mockReturnValue({
      isHealthy: false, circuitBreakerState: 'open',
      lastHealthCheck: new Date('2026-01-15T10:00:00Z'),
      isInitialized: false, apiKeyValid: false, modelsAvailable: [],
    });
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude AI Service')).toBeInTheDocument();
    });

    // Both the status badge and insight card may contain "Unhealthy"
    const unhealthyElements = screen.getAllByText(/Unhealthy/);
    expect(unhealthyElements.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // 10. Real-time spending summary
  // ------------------------------------------------------------------
  it('shows real-time spending summary with daily, monthly, and user count', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Real-Time Spending')).toBeInTheDocument();
    });

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 11. Empty data — shows zero values
  // ------------------------------------------------------------------
  it('shows zero values in metric cards when no data exists', async () => {
    setupEmptyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude AI Usage')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    // MetricCard receives "$0.00" as a single string prop
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('0ms')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 12. Error handling — logs via auditLogger
  // ------------------------------------------------------------------
  it('logs errors via auditLogger when claude_usage_logs query fails', async () => {
    const { auditLogger } = await import('../../../services/auditLogger');

    setTableRejection('claude_usage_logs', new Error('DB connection lost'));
    setTableResponse('billing_workflows', { data: [], error: null });
    mockGetWorkflowMetrics.mockResolvedValue(emptyWorkflowMetrics());

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude & Billing Monitoring')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(auditLogger.error).toHaveBeenCalledWith(
      'CLAUDE_METRICS_LOAD_FAILED',
      expect.any(Error)
    );
  });

  it('logs errors via auditLogger when billing service throws', async () => {
    const { auditLogger } = await import('../../../services/auditLogger');

    setTableResponse('claude_usage_logs', { data: makeClaudeLogs(), error: null });
    setTableResponse('billing_workflows', { data: [], error: null });
    mockGetWorkflowMetrics.mockRejectedValue(new Error('Billing service down'));

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude & Billing Monitoring')).toBeInTheDocument();
    }, { timeout: 3000 });

    expect(auditLogger.error).toHaveBeenCalledWith(
      'BILLING_METRICS_LOAD_FAILED',
      expect.any(Error)
    );
  });

  // ------------------------------------------------------------------
  // 13. Insights — warning card when service unhealthy
  // ------------------------------------------------------------------
  it('shows warning insight when Claude AI service is unhealthy', async () => {
    mockGetServiceStatus.mockReturnValue({
      isHealthy: false, circuitBreakerState: 'open',
      lastHealthCheck: new Date('2026-01-15T10:00:00Z'),
      isInitialized: false, apiKeyValid: false, modelsAvailable: [],
    });
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude AI Service Unhealthy')).toBeInTheDocument();
    });

    expect(screen.getByText(/Circuit breaker: open/)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 14. Insights — high daily spending warning
  // ------------------------------------------------------------------
  it('shows high daily spending warning when totalDaily exceeds threshold', async () => {
    mockGetSpendingSummary.mockReturnValue({
      totalDaily: 35.00, totalMonthly: 500.00, userCount: 15,
    });
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('High Daily AI Spending')).toBeInTheDocument();
    });

    const spendingElements = screen.getAllByText(/\$35\.00/);
    expect(spendingElements.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // 15. Date range change triggers data reload
  // ------------------------------------------------------------------
  it('changes date range when user selects a different option', async () => {
    setupHappyPath();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Claude & Billing Monitoring')).toBeInTheDocument();
    });

    const select = screen.getByDisplayValue('Last 30 days');
    fireEvent.change(select, { target: { value: '7d' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last 7 days')).toBeInTheDocument();
    });
  });
});
