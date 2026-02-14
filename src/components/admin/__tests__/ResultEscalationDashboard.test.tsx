/**
 * ResultEscalationDashboard tests — validates metric cards, escalation table,
 * severity filter, resolve flow, rules tab, and loading/error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetEscalationMetrics = vi.fn();
const mockGetActiveEscalations = vi.fn();
const mockGetRules = vi.fn();
const mockResolveEscalation = vi.fn();
const mockToggleRule = vi.fn();

vi.mock('../../../services/resultEscalationService', () => ({
  resultEscalationService: {
    getEscalationMetrics: (...args: unknown[]) => mockGetEscalationMetrics(...args),
    getActiveEscalations: (...args: unknown[]) => mockGetActiveEscalations(...args),
    getRules: (...args: unknown[]) => mockGetRules(...args),
    resolveEscalation: (...args: unknown[]) => mockResolveEscalation(...args),
    toggleRule: (...args: unknown[]) => mockToggleRule(...args),
    createRule: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

import ResultEscalationDashboard from '../ResultEscalationDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_METRICS = {
  total_active: 4,
  critical_count: 2,
  high_count: 1,
  routed_count: 3,
  resolved_today: 5,
  rules_active: 7,
};

const MOCK_ESCALATIONS = [
  {
    id: 'esc-1',
    rule_id: 'rule-1',
    result_id: 'result-1',
    result_source: 'lab_results',
    patient_id: 'pat-1',
    test_name: 'troponin',
    test_value: 0.08,
    test_unit: 'ng/mL',
    severity: 'critical',
    route_to_specialty: 'cardiology',
    routed_to_provider_id: null,
    task_id: 'task-1',
    escalation_status: 'routed',
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    tenant_id: 'tenant-1',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'esc-2',
    rule_id: 'rule-2',
    result_id: 'result-2',
    result_source: 'lab_results',
    patient_id: 'pat-2',
    test_name: 'potassium',
    test_value: 2.5,
    test_unit: 'mEq/L',
    severity: 'critical',
    route_to_specialty: 'cardiology',
    routed_to_provider_id: null,
    task_id: null,
    escalation_status: 'pending',
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    tenant_id: 'tenant-1',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'esc-3',
    rule_id: 'rule-3',
    result_id: 'result-3',
    result_source: 'fhir_diagnostic_reports',
    patient_id: 'pat-3',
    test_name: 'glucose',
    test_value: 350,
    test_unit: 'mg/dL',
    severity: 'high',
    route_to_specialty: 'endocrinology',
    routed_to_provider_id: null,
    task_id: null,
    escalation_status: 'pending',
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    tenant_id: 'tenant-1',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
];

const MOCK_RULES = [
  {
    id: 'rule-1',
    test_name: 'troponin',
    display_name: 'Troponin I',
    condition: 'above',
    threshold_high: 0.04,
    threshold_low: null,
    severity: 'critical',
    route_to_specialty: 'cardiology',
    target_minutes: 30,
    escalation_1_minutes: 60,
    escalation_2_minutes: 120,
    auto_create_task: true,
    notification_channels: ['inbox'],
    clinical_guidance: 'Acute MI possible',
    is_active: true,
    tenant_id: null,
    created_at: '2026-02-14T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  },
  {
    id: 'rule-2',
    test_name: 'potassium',
    display_name: 'Potassium',
    condition: 'below',
    threshold_high: null,
    threshold_low: 3.0,
    severity: 'critical',
    route_to_specialty: 'cardiology',
    target_minutes: 30,
    escalation_1_minutes: 60,
    escalation_2_minutes: 120,
    auto_create_task: true,
    notification_channels: ['inbox'],
    clinical_guidance: 'Hypokalemia risk',
    is_active: true,
    tenant_id: null,
    created_at: '2026-02-14T00:00:00Z',
    updated_at: '2026-02-14T00:00:00Z',
  },
];

function setupDefaults() {
  mockGetEscalationMetrics.mockResolvedValue({ success: true, data: MOCK_METRICS });
  mockGetActiveEscalations.mockResolvedValue({ success: true, data: MOCK_ESCALATIONS });
  mockGetRules.mockResolvedValue({ success: true, data: MOCK_RULES });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ResultEscalationDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ---------- Tier 1: Behavior ----------

  it('renders metric cards with correct counts', async () => {
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeInTheDocument();
    });

    expect(screen.getByText('4')).toBeInTheDocument(); // total_active
    expect(screen.getByText('5')).toBeInTheDocument(); // resolved_today
    expect(screen.getByText('7')).toBeInTheDocument(); // rules_active
  });

  it('displays escalation table with test name, value, and severity badge', async () => {
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('troponin')).toBeInTheDocument();
    });

    expect(screen.getByText('0.08 ng/mL')).toBeInTheDocument();
    expect(screen.getByText('potassium')).toBeInTheDocument();
    expect(screen.getByText('2.5 mEq/L')).toBeInTheDocument();
    expect(screen.getByText('glucose')).toBeInTheDocument();
    expect(screen.getByText('350 mg/dL')).toBeInTheDocument();

    // Severity badges
    const criticalBadges = screen.getAllByText('critical');
    expect(criticalBadges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('severity filter changes visible rows', async () => {
    const user = userEvent.setup();
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('troponin')).toBeInTheDocument();
    });

    const severitySelect = screen.getByLabelText('Filter by severity');
    await user.selectOptions(severitySelect, 'high');

    expect(screen.getByText('glucose')).toBeInTheDocument();
    expect(screen.queryByText('troponin')).not.toBeInTheDocument();
    expect(screen.queryByText('potassium')).not.toBeInTheDocument();
  });

  it('resolve button opens modal with notes field', async () => {
    const user = userEvent.setup();
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('troponin')).toBeInTheDocument();
    });

    const resolveButtons = screen.getAllByText('Resolve');
    await user.click(resolveButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Resolve Escalation')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Resolution Notes')).toBeInTheDocument();
  });

  it('rules tab shows configuration table with toggle switches', async () => {
    const user = userEvent.setup();
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('troponin')).toBeInTheDocument();
    });

    // Switch to rules tab
    await user.click(screen.getByText('Rules Configuration'));

    await waitFor(() => {
      expect(screen.getByText('Troponin I')).toBeInTheDocument();
    });

    expect(screen.getByText('Potassium')).toBeInTheDocument();
    // Toggle buttons
    expect(screen.getByLabelText('Toggle Troponin I off')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle Potassium off')).toBeInTheDocument();
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockGetEscalationMetrics.mockReturnValue(new Promise(() => {}));
    mockGetActiveEscalations.mockReturnValue(new Promise(() => {}));
    mockGetRules.mockReturnValue(new Promise(() => {}));

    render(<ResultEscalationDashboard />);

    expect(screen.getByText('Loading escalation data...')).toBeInTheDocument();
  });

  it('shows error message when service call fails', async () => {
    mockGetActiveEscalations.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Failed to load escalations' },
    });

    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load escalations')).toBeInTheDocument();
    });
  });

  it('shows empty state when no escalations exist', async () => {
    mockGetActiveEscalations.mockResolvedValue({ success: true, data: [] });
    mockGetEscalationMetrics.mockResolvedValue({
      success: true,
      data: { ...MOCK_METRICS, total_active: 0, critical_count: 0, high_count: 0 },
    });

    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No active escalations')).toBeInTheDocument();
      expect(screen.getByText('All lab results are within normal parameters.')).toBeInTheDocument();
    });
  });

  it('shows critical alert banner when critical escalations exist', async () => {
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 critical escalations requiring immediate specialist review/)).toBeInTheDocument();
    });
  });

  it('does not show critical alert when no critical escalations', async () => {
    mockGetEscalationMetrics.mockResolvedValue({
      success: true,
      data: { ...MOCK_METRICS, critical_count: 0 },
    });

    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeInTheDocument();
    });

    expect(screen.queryByText(/critical escalation/)).not.toBeInTheDocument();
  });

  // ---------- Tier 3: Integration ----------

  it('refresh button reloads data', async () => {
    const user = userEvent.setup();
    render(<ResultEscalationDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCalls = mockGetActiveEscalations.mock.calls.length;

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetActiveEscalations.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
