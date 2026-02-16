/**
 * NurseOfficeDashboard Tests
 *
 * Purpose: Nurse office practice management — tabbed dashboard aggregating
 *          intake, triage, task routing, referrals, eligibility, and shift handoff.
 * Tests: Tab navigation, section rendering, quick nav buttons, safe harbor footer.
 *
 * Deletion Test: Every test verifies specific content/behavior unique to
 * NurseOfficeDashboard. An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/nurse-office' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock supabase client
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'nurse-user-id' } },
  error: null,
});

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      is: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock AdminAuthContext
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    invokeAdminFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="admin-header">{title}</div>,
}));

// Mock NursePatientPriorityBoard
vi.mock('../NursePatientPriorityBoard', () => ({
  __esModule: true,
  default: () => <div data-testid="nurse-priority-board">Nurse Priority Board</div>,
}));

// Mock all lazy-loaded sections
vi.mock('../../admin/ProviderTaskQueueDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="provider-task-queue">Provider Tasks</div>,
}));

vi.mock('../../admin/UnacknowledgedResultsDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="unacknowledged-results">Unacknowledged Results</div>,
}));

vi.mock('../../admin/ResultEscalationDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="result-escalation">Result Escalation</div>,
}));

vi.mock('../../admin/ReferralAgingDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="referral-aging">Referral Aging</div>,
}));

vi.mock('../../admin/ReferralCompletionDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="referral-completion">Referral Completion</div>,
}));

vi.mock('../../admin/EligibilityVerificationPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="eligibility-verification">Eligibility</div>,
}));

vi.mock('../../admin/CareGapDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="care-gap-dashboard">Care Gaps</div>,
}));

vi.mock('../ShiftHandoffDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="shift-handoff">Shift Handoff</div>,
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

import NurseOfficeDashboard from '../NurseOfficeDashboard';

describe('NurseOfficeDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Nurse Office header', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-header')).toHaveTextContent('Nurse Office');
    });
  });

  it('shows all 6 tab labels', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Task Inbox')).toBeInTheDocument();
    expect(screen.getByText('Clinical Review')).toBeInTheDocument();
    expect(screen.getByText('Referrals')).toBeInTheDocument();
    expect(screen.getByText('Eligibility & Intake')).toBeInTheDocument();
    expect(screen.getByText('Shift Handoff')).toBeInTheDocument();
  });

  it('shows Nurse Priority Board on Overview tab by default', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('nurse-priority-board')).toBeInTheDocument();
    });
  });

  it('shows Care Gap Dashboard on Overview tab', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('care-gap-dashboard')).toBeInTheDocument();
    });
  });

  it('switches to Task Inbox tab and shows provider task queue', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

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
    render(<NurseOfficeDashboard />);

    await user.click(screen.getByText('Clinical Review'));

    await waitFor(() => {
      expect(screen.getByTestId('unacknowledged-results')).toBeInTheDocument();
    });
  });

  it('switches to Referrals tab and shows aging + completion dashboards', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

    await user.click(screen.getByText('Referrals'));

    await waitFor(() => {
      expect(screen.getByTestId('referral-aging')).toBeInTheDocument();
    });
    expect(screen.getByTestId('referral-completion')).toBeInTheDocument();
  });

  it('switches to Eligibility & Intake tab and shows verification panel', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

    await user.click(screen.getByText('Eligibility & Intake'));

    await waitFor(() => {
      expect(screen.getByTestId('eligibility-verification')).toBeInTheDocument();
    });
  });

  it('switches to Shift Handoff tab and shows handoff dashboard', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

    await user.click(screen.getByText('Shift Handoff'));

    await waitFor(() => {
      expect(screen.getByTestId('shift-handoff')).toBeInTheDocument();
    });
  });

  it('navigates to Nurse Dashboard when button is clicked', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Nurse Dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Nurse Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/nurse-dashboard');
  });

  it('navigates to Admin Panel when button is clicked', async () => {
    const user = userEvent.setup();
    render(<NurseOfficeDashboard />);

    await user.click(screen.getByText('Admin Panel'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('displays the Safe Harbor footer', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Safe Harbor — Nurse Office Dashboard/)).toBeInTheDocument();
    });
  });

  it('shows nurse workflow subtitle text', async () => {
    render(<NurseOfficeDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/intake, triage, coordination & handoff/)).toBeInTheDocument();
    });
  });
});
