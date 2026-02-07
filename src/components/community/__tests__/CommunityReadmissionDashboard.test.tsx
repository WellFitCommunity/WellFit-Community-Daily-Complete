/**
 * CommunityReadmissionDashboard tests — validates the orchestrator
 * fetches from Supabase views and delegates to sub-components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({ from: mockFrom }),
  useUser: () => ({ id: 'test-user', email: 'test@test.com' }),
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      appName: 'Test Hospital',
      contactInfo: 'TEST-0001',
    },
  }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockMetrics = {
  total_high_risk_members: 5,
  total_readmissions_30d: 2,
  cms_penalty_risk_count: 1,
  prevented_readmissions: 3,
  active_care_plans: 4,
  avg_engagement_score: 78,
  check_in_completion_rate: 84,
  medication_adherence_rate: 91,
  cost_savings_estimate: 37500,
  critical_alerts: 1,
};

const mockMembers = [
  {
    id: 'member-1',
    first_name: 'Eleanor',
    last_name: 'Vasquez',
    phone: '555-0001',
    risk_score: 85,
    risk_category: 'critical',
    total_visits_30d: 3,
    er_visits_30d: 1,
    readmissions_30d: 1,
    check_in_streak: 5,
    missed_check_ins_7d: 2,
    has_active_care_plan: true,
    sdoh_risk_factors: ['Food Insecurity'],
    engagement_score: 65,
    medication_adherence: 72,
    cms_penalty_risk: true,
  },
  {
    id: 'member-2',
    first_name: 'Robert',
    last_name: 'Johnson',
    phone: '555-0002',
    risk_score: 68,
    risk_category: 'high',
    total_visits_30d: 2,
    er_visits_30d: 0,
    readmissions_30d: 0,
    check_in_streak: 0,
    missed_check_ins_7d: 4,
    has_active_care_plan: false,
    sdoh_risk_factors: [],
    engagement_score: 45,
    medication_adherence: 88,
    cms_penalty_risk: false,
  },
];

const mockAlerts = [
  {
    alert_id: 'alert-1',
    member_id: 'member-1',
    member_name: 'Eleanor Vasquez',
    alert_type: 'readmission_risk_high',
    severity: 'critical',
    title: 'High readmission risk',
    description: 'Risk score above threshold',
    created_at: '2026-02-07T10:00:00Z',
    status: 'active',
    recommended_action: 'Schedule follow-up call',
  },
];

// ============================================================================
// SETUP
// ============================================================================

function setupMocks(options?: {
  metrics?: Record<string, unknown> | null;
  members?: Record<string, unknown>[] | null;
  alerts?: Record<string, unknown>[] | null;
}) {
  const opts = options || {};
  let callCount = 0;

  mockFrom.mockImplementation(() => {
    callCount++;
    const currentCall = callCount;

    return {
      select: () => {
        if (currentCall === 1) {
          return {
            single: () => Promise.resolve({
              data: opts.metrics !== undefined ? opts.metrics : mockMetrics,
              error: null,
            }),
          };
        } else if (currentCall === 2) {
          return Promise.resolve({
            data: opts.members !== undefined ? opts.members : mockMembers,
            error: null,
          });
        } else {
          return Promise.resolve({
            data: opts.alerts !== undefined ? opts.alerts : mockAlerts,
            error: null,
          });
        }
      },
    };
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('CommunityReadmissionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  async function renderDashboard() {
    const { default: CommunityReadmissionDashboard } = await import('../CommunityReadmissionDashboard');
    return render(<CommunityReadmissionDashboard />);
  }

  it('renders loading state initially', async () => {
    // Make the promise never resolve immediately
    mockFrom.mockReturnValue({
      select: () => ({
        single: () => new Promise(() => {}),
      }),
    });
    const { default: CommunityReadmissionDashboard } = await import('../CommunityReadmissionDashboard');
    render(<CommunityReadmissionDashboard />);

    expect(screen.getByText(/loading readmission dashboard/i)).toBeInTheDocument();
  });

  it('renders dashboard header with hospital name', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/community readmission prevention/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Test Hospital/)).toBeInTheDocument();
  });

  it('displays KPI metric cards with data from views', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('High-Risk Members')).toBeInTheDocument();
    });
    expect(screen.getByText('30-Day Readmissions')).toBeInTheDocument();
    expect(screen.getByText('Prevented Readmissions')).toBeInTheDocument();
    expect(screen.getByText('Cost Savings')).toBeInTheDocument();
    expect(screen.getByText('$38K')).toBeInTheDocument();
  });

  it('displays critical alerts banner when alerts exist', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/1 critical alert/i)).toBeInTheDocument();
    });
    expect(screen.getByText('View Alerts')).toBeInTheDocument();
  });

  it('shows period selector buttons', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('30d')).toBeInTheDocument();
    });
    expect(screen.getByText('60d')).toBeInTheDocument();
    expect(screen.getByText('90d')).toBeInTheDocument();
  });

  it('shows risk filter buttons', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('all')).toBeInTheDocument();
    });
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('renders tab navigation', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('SDOH')).toBeInTheDocument();
    // 'Engagement' appears in both tabs and overview gauges — verify at least one exists
    expect(screen.getAllByText(/engagement/i).length).toBeGreaterThan(0);
  });

  it('handles empty data gracefully', async () => {
    setupMocks({ metrics: null, members: [], alerts: [] });
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/community readmission prevention/i)).toBeInTheDocument();
    });
    // Should render without crashing — metric cards show default 0 values
    expect(screen.getByText('High-Risk Members')).toBeInTheDocument();
    expect(screen.getByText('$0K')).toBeInTheDocument();
  });

  it('switches tabs when clicking tab triggers', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    // Click Members tab
    const membersTab = screen.getByText('Members');
    await user.click(membersTab);

    // Members tab content should appear (table headers)
    await waitFor(() => {
      expect(screen.getByText('High-Risk Community Members')).toBeInTheDocument();
    });
  });

  it('queries correct view names', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('v_readmission_dashboard_metrics');
      expect(mockFrom).toHaveBeenCalledWith('v_readmission_high_risk_members');
      expect(mockFrom).toHaveBeenCalledWith('v_readmission_active_alerts');
    });
  });
});
