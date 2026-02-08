/**
 * NursePanel Tests
 *
 * Purpose: Nurse dashboard with tabbed navigation, patient selection, quick actions
 * Tests: Tab navigation, quick action buttons, patient loading, empty state, tab content
 *
 * Deletion Test: Every test verifies specific content/behavior unique to NursePanel.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/nurse' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock supabase client
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: 'nurse-user-id' } },
  error: null,
});
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockResolvedValue({
  data: [
    {
      patient_id: 'patient-1',
      profiles: {
        user_id: 'patient-1',
        first_name: 'John',
        last_name: 'Smith',
        date_of_birth: '1945-03-15',
        room_number: '204A',
      },
    },
  ],
  error: null,
});

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
    })),
  },
}));

// Mock AdminAuthContext
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    invokeAdminFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

// Mock RequireAdminAuth to just render children
vi.mock('../../auth/RequireAdminAuth', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="require-admin-auth">{children}</div>,
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="admin-header">{title}</div>,
}));

// Mock all heavy child components
vi.mock('../ShiftHandoffDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="shift-handoff-dashboard">Shift Handoff</div>,
}));

vi.mock('../../smart/RealTimeSmartScribe', () => ({
  __esModule: true,
  default: () => <div data-testid="smart-scribe">SmartScribe</div>,
}));

vi.mock('../../admin/RiskAssessmentManager', () => ({
  __esModule: true,
  default: () => <div data-testid="risk-assessment">Risk Assessment</div>,
}));

vi.mock('../../admin/ReportsSection', () => ({
  __esModule: true,
  default: () => <div data-testid="reports-section">Reports</div>,
}));

vi.mock('../../atlas/CCMTimeline', () => ({
  __esModule: true,
  default: () => <div data-testid="ccm-timeline">CCM Timeline</div>,
}));

vi.mock('../../nurseos/ResilienceHubDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="resilience-hub">Resilience Hub</div>,
}));

vi.mock('../../telehealth/TelehealthScheduler', () => ({
  __esModule: true,
  default: () => <div data-testid="telehealth-scheduler">Telehealth Scheduler</div>,
}));

vi.mock('../../claude-care/ClaudeCareAssistantPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="claude-care-assistant">Claude Care Assistant</div>,
}));

vi.mock('../../shared/PasswordGenerator', () => ({
  __esModule: true,
  default: ({ onPasswordGenerated }: { onPasswordGenerated: (pw: string) => void }) => (
    <div data-testid="password-generator">
      <button onClick={() => onPasswordGenerated('test-pass-123')}>Generate</button>
    </div>
  ),
}));

vi.mock('../../ai-transparency', () => ({
  PersonalizedGreeting: () => <div data-testid="personalized-greeting">Hello Nurse</div>,
}));

vi.mock('../../admin/NurseQuestionManager', () => ({
  __esModule: true,
  default: () => <div data-testid="nurse-question-manager">Question Manager</div>,
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

import NursePanel from '../NursePanel';

describe('NursePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the nurse dashboard header', async () => {
    render(<NursePanel />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-header')).toHaveTextContent('Nurse Dashboard');
    });
  });

  it('shows tab navigation with Clinical Tools, Telehealth, Documentation, Wellness', async () => {
    render(<NursePanel />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Tools')).toBeInTheDocument();
    });
    // Telehealth appears in both quick actions and tab bar
    expect(screen.getAllByText('Telehealth').length).toBeGreaterThanOrEqual(1);
    // Documentation may appear in multiple places too
    expect(screen.getAllByText('Documentation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Wellness').length).toBeGreaterThanOrEqual(1);
  });

  it('displays quick action buttons for ER Dashboard, Bed Board, etc.', async () => {
    render(<NursePanel />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
    expect(screen.getByText('ER Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Bed Board')).toBeInTheDocument();
    expect(screen.getByText('CHW Dashboard')).toBeInTheDocument();
  });

  it('navigates to ER Dashboard when quick action is clicked', async () => {
    const user = userEvent.setup();
    render(<NursePanel />);

    await waitFor(() => {
      expect(screen.getByText('ER Dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByText('ER Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/er-dashboard');
  });

  it('switches to Telehealth tab and shows telehealth scheduler', async () => {
    const user = userEvent.setup();
    render(<NursePanel />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getAllByText('Telehealth').length).toBeGreaterThanOrEqual(1);
    });

    // Click the Telehealth quick action button (sets activeTab to 'telehealth')
    const telehealthButtons = screen.getAllByText('Telehealth');
    await user.click(telehealthButtons[0]);

    // Telehealth tab content includes the TelehealthScheduler mock
    await waitFor(() => {
      expect(screen.getByTestId('telehealth-scheduler')).toBeInTheDocument();
    });
  });

  it('shows empty patient state when no patients are assigned', async () => {
    // Override to return no patients
    mockEq.mockResolvedValueOnce({ data: [], error: null });

    render(<NursePanel />);

    await waitFor(() => {
      expect(screen.getByText('No patients assigned. Use care team to assign patients.')).toBeInTheDocument();
    });
  });
});
