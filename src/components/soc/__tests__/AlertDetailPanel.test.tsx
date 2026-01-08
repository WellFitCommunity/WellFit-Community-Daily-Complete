/**
 * Tests for AlertDetailPanel Component
 *
 * Purpose: Detailed view of a security alert with team messaging and actions
 * Tests: Rendering, action buttons, modals, messaging, guardian approval
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AlertDetailPanel } from '../AlertDetailPanel';
import { SecurityAlert, SOCPresence } from '../../../types/socDashboard';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  }),
}));

// Mock SOC Dashboard Service
vi.mock('../../../services/socDashboardService', () => ({
  getSOCDashboardService: () => ({
    getAlertMessages: vi.fn().mockResolvedValue([]),
    addMessage: vi.fn().mockResolvedValue(true),
    subscribeToMessages: vi.fn(),
    unsubscribeFromMessages: vi.fn(),
  }),
}));

// Mock EAButton and EABadge
vi.mock('../../envision-atlus/EAButton', () => ({
  EAButton: ({ children, onClick, disabled, variant, size }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock('../../envision-atlus/EABadge', () => ({
  EABadge: ({ children, variant, pulse }: {
    children: React.ReactNode;
    variant?: string;
    pulse?: boolean;
  }) => (
    <span data-variant={variant} data-pulse={pulse}>
      {children}
    </span>
  ),
}));

// Mock alert data
const createMockAlert = (overrides: Partial<SecurityAlert> = {}): SecurityAlert => ({
  id: 'alert-123',
  title: 'Suspicious Login Attempt',
  description: 'Multiple failed login attempts from IP 192.168.1.100',
  severity: 'high',
  status: 'new',
  alert_type: 'authentication',
  detection_method: 'threshold',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source_ip: '192.168.1.100',
  confidence_score: 0.85,
  escalated: false,
  metadata: { user_agent: 'Mozilla/5.0' },
  ...overrides,
});

// Mock operators
const mockOperators: SOCPresence[] = [
  {
    user_id: 'op-1',
    user_name: 'Alice Smith',
    status: 'online',
    last_seen: new Date().toISOString(),
  },
  {
    user_id: 'op-2',
    user_name: 'Bob Jones',
    status: 'busy',
    current_alert_id: 'other-alert',
    last_seen: new Date().toISOString(),
  },
];

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('AlertDetailPanel', () => {
  const mockOnAcknowledge = vi.fn();
  const mockOnAssign = vi.fn();
  const mockOnResolve = vi.fn();
  const mockOnFalsePositive = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
    });

    it('should display alert title', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Suspicious Login Attempt');
    });

    it('should display alert description', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Multiple failed login attempts from IP 192.168.1.100')).toBeInTheDocument();
    });

    it('should display severity badge', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('should display status badge', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('New')).toBeInTheDocument();
    });

    it('should display ESCALATED badge when escalated', () => {
      const escalatedAlert = createMockAlert({ escalated: true });

      renderWithRouter(
        <AlertDetailPanel
          alert={escalatedAlert}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('ESCALATED')).toBeInTheDocument();
    });

    it('should display source IP when available', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      // Source IP field shows in Detection section
      expect(screen.getByText(/Source IP:/)).toBeInTheDocument();
    });

    it('should display confidence score when available', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Confidence: 85%/)).toBeInTheDocument();
    });

    it('should display metadata when available', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show Acknowledge button for new alerts', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert({ status: 'new' })}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Acknowledge/)).toBeInTheDocument();
    });

    it('should not show Acknowledge button for non-new alerts', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert({ status: 'investigating' })}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('✋ Acknowledge')).not.toBeInTheDocument();
    });

    it('should always show Assign button', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Assign/)).toBeInTheDocument();
    });

    it('should show Resolve button for non-resolved alerts', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Resolve/)).toBeInTheDocument();
    });

    it('should not show Resolve button for resolved alerts', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert({ status: 'resolved' })}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('✅ Resolve')).not.toBeInTheDocument();
    });

    it('should show False Positive button for non-resolved alerts', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/False Positive/)).toBeInTheDocument();
    });

    it('should call onAcknowledge when Acknowledge button is clicked', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const acknowledgeButton = screen.getByText(/Acknowledge/);
      await userEvent.click(acknowledgeButton);

      expect(mockOnAcknowledge).toHaveBeenCalled();
    });
  });

  describe('Close Button', () => {
    it('should call onClose when close button is clicked', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByText('×');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Assign Modal', () => {
    it('should open assign modal when Assign button is clicked', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const assignButton = screen.getByText(/Assign/);
      await userEvent.click(assignButton);

      expect(screen.getByText('Assign Alert')).toBeInTheDocument();
    });

    it('should display operators in assign modal', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const assignButton = screen.getByText(/Assign/);
      await userEvent.click(assignButton);

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('should call onAssign when operator is selected', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const assignButton = screen.getByText(/Assign/);
      await userEvent.click(assignButton);

      const aliceButton = screen.getByText('Alice Smith');
      await userEvent.click(aliceButton);

      expect(mockOnAssign).toHaveBeenCalledWith('op-1');
    });

    it('should show "No operators online" when operators list is empty', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={[]}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const assignButton = screen.getByText(/Assign/);
      await userEvent.click(assignButton);

      expect(screen.getByText('No operators online')).toBeInTheDocument();
    });
  });

  describe('Resolve Modal', () => {
    it('should open resolve modal when Resolve button is clicked', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const resolveButton = screen.getByText(/Resolve/);
      await userEvent.click(resolveButton);

      // Check for modal heading
      expect(screen.getByRole('heading', { name: 'Resolve Alert' })).toBeInTheDocument();
    });

    it('should require resolution text before resolving', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const resolveButton = screen.getByText(/Resolve/);
      await userEvent.click(resolveButton);

      const submitButton = screen.getByRole('button', { name: 'Resolve Alert' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable resolve button when text is entered', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const resolveButton = screen.getByText(/Resolve/);
      await userEvent.click(resolveButton);

      const textarea = screen.getByPlaceholderText(/Describe how the alert was resolved/);
      await userEvent.type(textarea, 'Issue resolved by blocking IP');

      const submitButton = screen.getByRole('button', { name: 'Resolve Alert' });
      expect(submitButton).not.toBeDisabled();
    });

    it('should call onResolve with resolution text', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const resolveButton = screen.getByText(/Resolve/);
      await userEvent.click(resolveButton);

      const textarea = screen.getByPlaceholderText(/Describe how the alert was resolved/);
      await userEvent.type(textarea, 'Issue resolved by blocking IP');

      const submitButton = screen.getByRole('button', { name: 'Resolve Alert' });
      await userEvent.click(submitButton);

      expect(mockOnResolve).toHaveBeenCalledWith('Issue resolved by blocking IP');
    });
  });

  describe('False Positive Modal', () => {
    it('should open false positive modal when button is clicked', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const fpButton = screen.getByText(/False Positive/);
      await userEvent.click(fpButton);

      // Check for modal heading
      expect(screen.getByRole('heading', { name: 'Mark as False Positive' })).toBeInTheDocument();
    });

    it('should call onFalsePositive with reason', async () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const fpButton = screen.getByText(/False Positive/);
      await userEvent.click(fpButton);

      const textarea = screen.getByPlaceholderText(/Explain why this is a false positive/);
      await userEvent.type(textarea, 'Legitimate user testing');

      const submitButton = screen.getByRole('button', { name: /Mark as False Positive/ });
      await userEvent.click(submitButton);

      expect(mockOnFalsePositive).toHaveBeenCalledWith('Legitimate user testing');
    });
  });

  describe('Guardian Approval', () => {
    it('should show Guardian approval notice for guardian_approval_required alerts', () => {
      const guardianAlert = createMockAlert({
        alert_type: 'guardian_approval_required',
        metadata: { ticket_id: 'ticket-123' },
      });

      renderWithRouter(
        <AlertDetailPanel
          alert={guardianAlert}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Guardian Approval Required')).toBeInTheDocument();
    });

    it('should show Review in Guardian button for guardian alerts', () => {
      const guardianAlert = createMockAlert({
        alert_type: 'guardian_approval_required',
        metadata: { ticket_id: 'ticket-123' },
      });

      renderWithRouter(
        <AlertDetailPanel
          alert={guardianAlert}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Review in Guardian/)).toBeInTheDocument();
    });

    it('should navigate to guardian approval page when button is clicked', async () => {
      const guardianAlert = createMockAlert({
        alert_type: 'guardian_approval_required',
        metadata: { ticket_id: 'ticket-123' },
      });

      renderWithRouter(
        <AlertDetailPanel
          alert={guardianAlert}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      const guardianButton = screen.getByText(/Review in Guardian/);
      await userEvent.click(guardianButton);

      expect(mockNavigate).toHaveBeenCalledWith('/guardian/approval/ticket-123');
    });
  });

  describe('Team Discussion', () => {
    it('should display team discussion section', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Team Discussion')).toBeInTheDocument();
    });

    it('should show message input', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });

    it('should show Send button', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Send')).toBeInTheDocument();
    });

    it('should show empty message state when no messages', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('No messages yet. Start the discussion.')).toBeInTheDocument();
    });
  });

  describe('Alert Details Section', () => {
    it('should display detection method', () => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert()}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Method:/)).toBeInTheDocument();
    });

    it('should display threshold values when available', () => {
      const alertWithThreshold = createMockAlert({
        threshold_value: 5,
        actual_value: 10,
      });

      renderWithRouter(
        <AlertDetailPanel
          alert={alertWithThreshold}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Threshold')).toBeInTheDocument();
    });
  });

  describe('Severity Display', () => {
    it.each([
      ['critical', 'Critical'],
      ['high', 'High'],
      ['medium', 'Medium'],
      ['low', 'Low'],
    ] as const)('should display %s severity correctly', (severity, label) => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert({ severity })}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it.each([
      ['new', 'New'],
      ['investigating', 'Investigating'],
      ['resolved', 'Resolved'],
      ['false_positive', 'False Positive'],
      ['escalated', 'Escalated'],
    ] as const)('should display %s status correctly', (status, label) => {
      renderWithRouter(
        <AlertDetailPanel
          alert={createMockAlert({ status })}
          operators={mockOperators}
          onAcknowledge={mockOnAcknowledge}
          onAssign={mockOnAssign}
          onResolve={mockOnResolve}
          onFalsePositive={mockOnFalsePositive}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
