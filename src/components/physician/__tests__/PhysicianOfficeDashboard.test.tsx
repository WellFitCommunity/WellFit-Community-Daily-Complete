/**
 * PhysicianOfficeDashboard Tests
 *
 * Purpose: Physician office practice management — tabbed dashboard aggregating
 *          clinical revenue tracker features (tasks, results, billing, revenue, coverage).
 * Tests: Tab navigation, section rendering, quick nav buttons, safe harbor footer.
 *
 * Deletion Test: Every test verifies specific content/behavior unique to
 * PhysicianOfficeDashboard. An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/physician-office' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      is: vi.fn().mockReturnThis(),
    })),
  }),
  useUser: () => ({ id: 'test-physician-id', email: 'doc@test.com' }),
}));

// Mock PatientContext
vi.mock('../../../contexts/PatientContext', () => ({
  usePatientContext: () => ({
    selectPatient: vi.fn(),
    selectedPatient: null,
    patientHistory: [],
    clearPatient: vi.fn(),
  }),
  SelectedPatient: {},
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="admin-header">{title}</div>,
}));

// Mock PatientPriorityBoard
vi.mock('../PatientPriorityBoard', () => ({
  __esModule: true,
  default: () => <div data-testid="patient-priority-board">Priority Board</div>,
}));

// Mock all lazy-loaded admin sections
vi.mock('../../admin/ProviderTaskQueueDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="provider-task-queue">Provider Tasks</div>,
}));

vi.mock('../../admin/UnacknowledgedResultsDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="unacknowledged-results">Unacknowledged Results</div>,
}));

vi.mock('../../admin/SuperbillReviewPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="superbill-review">Superbill Review</div>,
}));

vi.mock('../../admin/EligibilityVerificationPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="eligibility-verification">Eligibility</div>,
}));

vi.mock('../../admin/BillingQueueDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="billing-queue">Billing Queue</div>,
}));

vi.mock('../../admin/ProviderAssignmentDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="provider-assignment">Provider Assignment</div>,
}));

vi.mock('../../admin/ResultEscalationDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="result-escalation">Result Escalation</div>,
}));

vi.mock('../../admin/ProviderCoverageDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="provider-coverage">Provider Coverage</div>,
}));

vi.mock('../../admin/ClaimAgingDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="claim-aging">Claim Aging</div>,
}));

vi.mock('../../admin/UndercodingDetectionDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="undercoding-detection">Undercoding</div>,
}));

vi.mock('../../admin/DocumentationGapDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="documentation-gap">Documentation Gaps</div>,
}));

vi.mock('../../admin/HCCOpportunityDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="hcc-opportunity">HCC Opportunities</div>,
}));

vi.mock('../../admin/ERAPaymentPostingDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="era-payment-posting">ERA Posting</div>,
}));

vi.mock('../../admin/ClaimResubmissionDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="claim-resubmission">Claim Resubmission</div>,
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
    auth: vi.fn(),
  },
}));

import PhysicianOfficeDashboard from '../PhysicianOfficeDashboard';

describe('PhysicianOfficeDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Physician Office header', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-header')).toHaveTextContent('Physician Office');
    });
  });

  it('shows all 6 tab labels', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Task Inbox')).toBeInTheDocument();
    expect(screen.getByText('Clinical Review')).toBeInTheDocument();
    expect(screen.getByText('Billing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Revenue Intel')).toBeInTheDocument();
    expect(screen.getByText('Coverage & Scheduling')).toBeInTheDocument();
  });

  it('shows Patient Priority Board on Overview tab by default', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('patient-priority-board')).toBeInTheDocument();
    });
  });

  it('shows Provider Assignment Dashboard on Overview tab', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('provider-assignment')).toBeInTheDocument();
    });
  });

  it('switches to Task Inbox tab and shows provider task queue', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Task Inbox')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Task Inbox'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-task-queue')).toBeInTheDocument();
    });
  });

  it('switches to Clinical Review tab and shows unacknowledged results', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await user.click(screen.getByText('Clinical Review'));

    await waitFor(() => {
      expect(screen.getByTestId('unacknowledged-results')).toBeInTheDocument();
    });
  });

  it('switches to Billing Pipeline tab and shows eligibility + superbill + claim aging', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await user.click(screen.getByText('Billing Pipeline'));

    await waitFor(() => {
      expect(screen.getByTestId('eligibility-verification')).toBeInTheDocument();
    });
    expect(screen.getByTestId('superbill-review')).toBeInTheDocument();
    expect(screen.getByTestId('claim-aging')).toBeInTheDocument();
  });

  it('switches to Revenue Intel tab and shows undercoding + documentation gaps + HCC', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await user.click(screen.getByText('Revenue Intel'));

    await waitFor(() => {
      expect(screen.getByTestId('undercoding-detection')).toBeInTheDocument();
    });
    expect(screen.getByTestId('documentation-gap')).toBeInTheDocument();
    expect(screen.getByTestId('hcc-opportunity')).toBeInTheDocument();
  });

  it('switches to Coverage & Scheduling tab and shows provider coverage', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await user.click(screen.getByText('Coverage & Scheduling'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-coverage')).toBeInTheDocument();
    });
  });

  it('navigates to Command Center when button is clicked', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Command Center')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Command Center'));
    expect(mockNavigate).toHaveBeenCalledWith('/physician-dashboard');
  });

  it('navigates to Admin Panel when button is clicked', async () => {
    const user = userEvent.setup();
    render(<PhysicianOfficeDashboard />);

    await user.click(screen.getByText('Admin Panel'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('displays the Safe Harbor footer', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Safe Harbor — Physician Office Dashboard/)).toBeInTheDocument();
    });
  });

  it('shows practice management subtitle text', async () => {
    render(<PhysicianOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/encounter to payment workflow/)).toBeInTheDocument();
    });
  });
});
