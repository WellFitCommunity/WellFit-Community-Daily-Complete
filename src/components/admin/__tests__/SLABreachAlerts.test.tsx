/**
 * SLABreachAlerts Tests
 *
 * Tests SLA breach monitoring: summary cards, breached orders list,
 * expand/collapse details, acknowledge workflow, filter controls,
 * approaching breach section, and loading/error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockCheckBreaches = vi.fn();
const mockGetBreachedOrders = vi.fn();
const mockGetOrdersApproachingBreach = vi.fn();
const mockGetDashboardMetrics = vi.fn();
const mockAcknowledgeBreach = vi.fn();
const mockFormatDuration = vi.fn();

vi.mock('../../../services/orderSLAService', () => ({
  orderSLAService: {
    checkBreaches: (...args: unknown[]) => mockCheckBreaches(...args),
    getBreachedOrders: (...args: unknown[]) => mockGetBreachedOrders(...args),
    getOrdersApproachingBreach: (...args: unknown[]) => mockGetOrdersApproachingBreach(...args),
    getDashboardMetrics: (...args: unknown[]) => mockGetDashboardMetrics(...args),
    acknowledgeBreach: (...args: unknown[]) => mockAcknowledgeBreach(...args),
    formatDuration: (...args: unknown[]) => mockFormatDuration(...args),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-001' } } }),
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

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
    <div data-testid="ea-card-header" className={className} onClick={onClick}>{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
  EAAlert: ({ children, onDismiss, dismissible }: { children: React.ReactNode; onDismiss?: () => void; dismissible?: boolean; variant?: string }) => (
    <div role="alert">
      {children}
      {dismissible && onDismiss && <button onClick={onDismiss}>Dismiss</button>}
    </div>
  ),
}));

vi.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <span data-testid={`icon-${name}`} className={className}>{name}</span>
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    AlertTriangle: createIcon('AlertTriangle'),
    Clock: createIcon('Clock'),
    CheckCircle: createIcon('CheckCircle'),
    RefreshCw: createIcon('RefreshCw'),
    Bell: createIcon('Bell'),
    BellOff: createIcon('BellOff'),
    ChevronDown: createIcon('ChevronDown'),
    ChevronUp: createIcon('ChevronUp'),
    Filter: createIcon('Filter'),
    Beaker: createIcon('Beaker'),
    Scan: createIcon('Scan'),
    Pill: createIcon('Pill'),
    TrendingUp: createIcon('TrendingUp'),
    TrendingDown: createIcon('TrendingDown'),
    Timer: createIcon('Timer'),
  };
});

// Import AFTER mocks
import SLABreachAlerts from '../SLABreachAlerts';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_BREACHED_ORDERS = [
  { id: 'order-001', order_type: 'lab_order' as const, patient_id: 'patient-test-001',
    internal_order_id: 'LAB-20260225-001', priority: 'stat', order_status: 'pending',
    ordered_at: '2026-02-25T08:00:00Z', sla_target_minutes: 60,
    sla_breach_at: '2026-02-25T09:00:00Z', minutes_overdue: 45,
    escalation_level: 1, sla_acknowledged_at: null },
  { id: 'order-002', order_type: 'imaging_order' as const, patient_id: 'patient-test-002',
    internal_order_id: 'IMG-20260225-001', priority: 'routine', order_status: 'in_progress',
    ordered_at: '2026-02-25T07:00:00Z', sla_target_minutes: 120,
    sla_breach_at: '2026-02-25T09:00:00Z', minutes_overdue: 30,
    escalation_level: 0, sla_acknowledged_at: '2026-02-25T09:15:00Z' },
  { id: 'order-003', order_type: 'refill_request' as const, patient_id: 'patient-test-003',
    internal_order_id: 'RX-20260225-001', priority: 'urgent', order_status: 'pending',
    ordered_at: '2026-02-25T06:00:00Z', sla_target_minutes: 240,
    sla_breach_at: '2026-02-25T10:00:00Z', minutes_overdue: 15,
    escalation_level: 0, sla_acknowledged_at: null },
];

const MOCK_APPROACHING_ORDERS = [
  { id: 'order-004', order_type: 'lab_order' as const, patient_id: 'patient-test-004',
    internal_order_id: 'LAB-20260225-002', priority: 'asap', order_status: 'pending',
    ordered_at: '2026-02-25T09:30:00Z', sla_target_minutes: 60,
    sla_breach_at: '2026-02-25T10:30:00Z', minutes_overdue: -20,
    escalation_level: 0, sla_acknowledged_at: null },
  { id: 'order-005', order_type: 'imaging_order' as const, patient_id: 'patient-test-005',
    internal_order_id: 'IMG-20260225-002', priority: 'routine', order_status: 'pending',
    ordered_at: '2026-02-25T08:00:00Z', sla_target_minutes: 180,
    sla_breach_at: '2026-02-25T11:00:00Z', minutes_overdue: -45,
    escalation_level: 0, sla_acknowledged_at: null },
];

const MOCK_METRICS = {
  period: { from: '2026-02-18T00:00:00Z', to: '2026-02-25T00:00:00Z' },
  lab_orders: { total_orders: 120, completed_orders: 115, breached_orders: 5,
    active_breaches: 1, compliance_rate: 96, avg_completion_minutes: 45 },
  imaging_orders: { total_orders: 80, completed_orders: 76, breached_orders: 4,
    active_breaches: 1, compliance_rate: 95, avg_completion_minutes: 90 },
  refill_requests: { total_orders: 50, completed_orders: 48, breached_orders: 2,
    active_breaches: 1, compliance_rate: 96, avg_completion_minutes: 180 },
  overall: { total_active_breaches: 3, avg_compliance_rate: 96 },
};

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaults() {
  mockCheckBreaches.mockResolvedValue({ success: true, data: { breaches_detected: 0 } });
  mockGetBreachedOrders.mockResolvedValue({ success: true, data: MOCK_BREACHED_ORDERS });
  mockGetOrdersApproachingBreach.mockResolvedValue({ success: true, data: MOCK_APPROACHING_ORDERS });
  mockGetDashboardMetrics.mockResolvedValue({ success: true, data: MOCK_METRICS });
  mockAcknowledgeBreach.mockResolvedValue({ success: true, data: {} });
  mockFormatDuration.mockImplementation((minutes: unknown) => {
    const min = Number(minutes);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  });
}

function setupNoBreaches() {
  mockCheckBreaches.mockResolvedValue({ success: true, data: { breaches_detected: 0 } });
  mockGetBreachedOrders.mockResolvedValue({ success: true, data: [] });
  mockGetOrdersApproachingBreach.mockResolvedValue({ success: true, data: [] });
  mockGetDashboardMetrics.mockResolvedValue({ success: true, data: MOCK_METRICS });
  mockFormatDuration.mockImplementation((minutes: unknown) => `${Number(minutes)} min`);
}

// ============================================================================
// TESTS
// ============================================================================

describe('SLABreachAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // --- Loading ---

  it('shows spinner and loading text while fetching SLA data', () => {
    mockCheckBreaches.mockReturnValue(new Promise(() => {}));
    render(<SLABreachAlerts />);
    expect(screen.getByText('Loading SLA data...')).toBeInTheDocument();
    expect(screen.getByTestId('icon-RefreshCw')).toBeInTheDocument();
  });

  // --- Summary Cards ---

  it('displays active breaches count in summary card', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Active Breaches')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies red border to Active Breaches card when breaches exist', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Active Breaches')).toBeInTheDocument();
    });
    const card = screen.getByText('Active Breaches').closest('[data-testid="ea-card"]');
    expect(card).toHaveClass('border-red-500');
  });

  it('shows unacknowledged count beneath active breaches', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Active Breaches')).toBeInTheDocument();
    });
    expect(screen.getByText('2 unacknowledged')).toBeInTheDocument();
  });

  it('displays approaching breach count in summary card', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Approaching Breach')).toBeInTheDocument();
    });
    const card = screen.getByText('Approaching Breach').closest('[data-testid="ea-card-content"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(within(card).getByText('2')).toBeInTheDocument();
  });

  it('displays 7-day compliance percentage from metrics', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('7-Day Compliance')).toBeInTheDocument();
    });
    expect(screen.getByText('96%')).toBeInTheDocument();
    expect(screen.getByText('Target: 95%')).toBeInTheDocument();
  });

  it('shows trending up icon when compliance is at or above 95%', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('7-Day Compliance')).toBeInTheDocument();
    });
    const card = screen.getByText('7-Day Compliance').closest('[data-testid="ea-card-content"]') as HTMLElement;
    expect(within(card).getByTestId('icon-TrendingUp')).toBeInTheDocument();
  });

  it('shows trending down icon when compliance is below 95%', async () => {
    mockGetDashboardMetrics.mockResolvedValue({
      success: true,
      data: { ...MOCK_METRICS, overall: { total_active_breaches: 8, avg_compliance_rate: 82 } },
    });
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('82%')).toBeInTheDocument();
    });
    const card = screen.getByText('7-Day Compliance').closest('[data-testid="ea-card-content"]') as HTMLElement;
    expect(within(card).getByTestId('icon-TrendingDown')).toBeInTheDocument();
  });

  it('displays total active orders as sum across all order types', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Total Active Orders')).toBeInTheDocument();
    });
    // 120 + 80 + 50 = 250
    expect(screen.getByText('250')).toBeInTheDocument();
  });

  // --- Breached Orders List ---

  it('renders breached order internal IDs', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });
    expect(screen.getByText('IMG-20260225-001')).toBeInTheDocument();
    expect(screen.getByText('RX-20260225-001')).toBeInTheDocument();
  });

  it('displays correct priority badges (STAT, Routine, Urgent)', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });
    expect(screen.getByText('STAT')).toBeInTheDocument();
    expect(screen.getByText('Routine')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('displays overdue time for each breached order', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });
    expect(screen.getByText('+45 min')).toBeInTheDocument();
    expect(screen.getByText('+30 min')).toBeInTheDocument();
    expect(screen.getByText('+15 min')).toBeInTheDocument();
  });

  it('displays SLA target time for each breached order', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });
    expect(screen.getByText('Target: 1h')).toBeInTheDocument();
    expect(screen.getByText('Target: 2h')).toBeInTheDocument();
    expect(screen.getByText('Target: 4h')).toBeInTheDocument();
  });

  it('shows Acknowledged label for acknowledged orders', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('IMG-20260225-001')).toBeInTheDocument();
    });
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
  });

  // --- Expand/Collapse Details ---

  it('expands order details on click showing order status', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.getByText('Order Status')).toBeInTheDocument();
    });
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows escalation level in expanded details', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.getByText('Escalation Level')).toBeInTheDocument();
    });
    expect(screen.getByText('Level 1')).toBeInTheDocument();
  });

  it('collapses expanded details when clicking the same order again', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.getByText('Order Status')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.queryByText('Order Status')).not.toBeInTheDocument();
    });
  });

  // --- Acknowledge Workflow ---

  it('shows acknowledge button for unacknowledged breaches in expanded view', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });
  });

  it('calls acknowledgeBreach service with correct parameters', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('LAB-20260225-001'));
    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Acknowledge'));
    await waitFor(() => {
      expect(mockAcknowledgeBreach).toHaveBeenCalledWith(
        'lab_order',
        'order-001',
        'user-test-001'
      );
    });
  });

  // --- Filter Controls ---

  it('calls getBreachedOrders with lab_order filter when Lab Order clicked', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    mockGetBreachedOrders.mockClear();
    await user.click(screen.getByText('Lab Order'));
    await waitFor(() => {
      expect(mockGetBreachedOrders).toHaveBeenCalledWith('lab_order');
    });
  });

  it('calls getBreachedOrders with imaging_order filter when Imaging clicked', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    mockGetBreachedOrders.mockClear();
    await user.click(screen.getByText('Imaging'));
    await waitFor(() => {
      expect(mockGetBreachedOrders).toHaveBeenCalledWith('imaging_order');
    });
  });

  it('calls getBreachedOrders without filter when All clicked after filtering', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Lab Order'));
    await waitFor(() => {
      expect(mockGetBreachedOrders).toHaveBeenCalledWith('lab_order');
    });

    mockGetBreachedOrders.mockClear();
    await user.click(screen.getByText('All'));
    await waitFor(() => {
      expect(mockGetBreachedOrders).toHaveBeenCalledWith(undefined);
    });
  });

  // --- Approaching Breach Section ---

  it('keeps approaching breach section collapsed by default', async () => {
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText(/Approaching SLA Breach/)).toBeInTheDocument();
    });
    expect(screen.queryByText('LAB-20260225-002')).not.toBeInTheDocument();
  });

  it('expands approaching breach section on click and shows orders', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText(/Approaching SLA Breach/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Approaching SLA Breach/));
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-002')).toBeInTheDocument();
    });
    expect(screen.getByText('IMG-20260225-002')).toBeInTheDocument();
  });

  it('shows minutes until breach for approaching orders', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText(/Approaching SLA Breach/)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Approaching SLA Breach/));
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-002')).toBeInTheDocument();
    });
    expect(screen.getByText('20 min until breach')).toBeInTheDocument();
    expect(screen.getByText('45 min until breach')).toBeInTheDocument();
  });

  // --- Empty State ---

  it('shows "No Active Breaches" when no breaches exist', async () => {
    setupNoBreaches();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('No Active Breaches')).toBeInTheDocument();
    });
    expect(screen.getByText('All orders are within SLA targets')).toBeInTheDocument();
  });

  it('does not apply red border to Active Breaches card when count is zero', async () => {
    setupNoBreaches();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Active Breaches')).toBeInTheDocument();
    });
    const card = screen.getByText('Active Breaches').closest('[data-testid="ea-card"]');
    expect(card).not.toHaveClass('border-red-500');
  });

  // --- Error State ---

  it('displays error alert when service calls fail', async () => {
    mockCheckBreaches.mockRejectedValue(new Error('Network failure'));
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to load SLA data')).toBeInTheDocument();
  });

  it('dismisses error alert when dismiss button is clicked', async () => {
    mockCheckBreaches.mockRejectedValue(new Error('Network failure'));
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load SLA data')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Dismiss'));
    await waitFor(() => {
      expect(screen.queryByText('Failed to load SLA data')).not.toBeInTheDocument();
    });
  });

  // --- Refresh ---

  it('triggers data reload when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<SLABreachAlerts />);
    await waitFor(() => {
      expect(screen.getByText('LAB-20260225-001')).toBeInTheDocument();
    });

    mockCheckBreaches.mockClear();
    mockGetBreachedOrders.mockClear();
    mockGetDashboardMetrics.mockClear();

    await user.click(screen.getByText('Refresh'));
    await waitFor(() => {
      expect(mockCheckBreaches).toHaveBeenCalledTimes(1);
      expect(mockGetBreachedOrders).toHaveBeenCalledTimes(1);
      expect(mockGetDashboardMetrics).toHaveBeenCalledTimes(1);
    });
  });
});
