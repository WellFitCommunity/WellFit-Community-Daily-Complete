/**
 * Tests for GuardianApprovalForm Component
 *
 * Tests:
 * - Renders without crashing
 * - Shows loading state
 * - Displays ticket details when loaded
 * - Validation prevents approval without checklist
 * - Form submission works correctly
 * - Rejection flow works
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { GuardianApprovalForm } from '../GuardianApprovalForm';

// Mock ticket data
const mockTicket = {
  id: 'ticket-123',
  security_alert_id: 'alert-123',
  issue_id: 'issue-1',
  issue_category: 'api_failure',
  issue_severity: 'high' as const,
  issue_description: 'API timeout on patient endpoint',
  affected_component: 'src/services/patientApi.ts',
  affected_resources: ['src/services/patientApi.ts', 'src/hooks/usePatient.ts'],
  stack_trace: 'Error: Timeout\n  at patientApi.ts:42',
  detection_context: {},
  action_id: 'action-1',
  healing_strategy: 'retry_with_backoff' as const,
  healing_description: 'Retry API call with exponential backoff',
  healing_steps: [
    {
      id: 'step-1',
      order: 1,
      action: 'Configure retry parameters',
      target: 'patientApi.ts',
      parameters: { maxRetries: 3, backoffMs: 1000 },
    },
  ],
  rollback_plan: [
    {
      id: 'rollback-1',
      order: 1,
      action: 'Revert to original config',
      target: 'patientApi.ts',
      parameters: {},
    },
  ],
  expected_outcome: 'API calls should succeed with retry logic',
  sandbox_tested: true,
  sandbox_test_results: {
    passed: true,
    tests_run: 5,
    tests_passed: 5,
    tests_failed: 0,
    execution_time_ms: 1200,
  },
  sandbox_passed: true,
  status: 'pending' as const,
  reviewed_by: null,
  reviewed_at: null,
  reviewer_name: null,
  code_reviewed: false,
  impact_understood: false,
  rollback_understood: false,
  review_notes: null,
  review_metadata: {},
  applied_at: null,
  applied_by: null,
  application_result: {} as any,
  application_error: null,
  rolled_back_at: null,
  rolled_back_by: null,
  rollback_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock the service
const mockApproveTicket = jest.fn().mockResolvedValue({ success: true, status: 'approved' });
const mockRejectTicket = jest.fn().mockResolvedValue({ success: true, status: 'rejected' });
const mockGetTicketById = jest.fn().mockResolvedValue({ success: true, data: mockTicket });
const mockMarkInReview = jest.fn().mockResolvedValue({ success: true });

jest.mock('../../../services/guardianApprovalService', () => ({
  getGuardianApprovalService: () => ({
    getTicketById: mockGetTicketById,
    markInReview: mockMarkInReview,
    approveTicket: mockApproveTicket,
    rejectTicket: mockRejectTicket,
  }),
}));

// Mock hooks
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}));

// Mock useNavigate and useParams
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ ticketId: 'ticket-123' }),
}));

// Mock audit logger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Test wrapper with Router
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('GuardianApprovalForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Guardian Approval Review')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    expect(screen.getByText('Loading review ticket...')).toBeInTheDocument();
  });

  it('should display ticket details after loading', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Issue Details')).toBeInTheDocument();
    });

    expect(screen.getByText('api_failure')).toBeInTheDocument();
    expect(screen.getByText(/API timeout/i)).toBeInTheDocument();
    expect(screen.getByText('Proposed Fix')).toBeInTheDocument();
  });

  it('should display sandbox test results', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Sandbox Test Results')).toBeInTheDocument();
    });

    expect(screen.getByText('5')).toBeInTheDocument(); // Tests run
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('should show review checklist', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Review Checklist')).toBeInTheDocument();
    });

    expect(screen.getByText(/I have reviewed the proposed code changes/i)).toBeInTheDocument();
    expect(screen.getByText(/I understand the impact on the system/i)).toBeInTheDocument();
    expect(screen.getByText(/I understand the rollback procedure/i)).toBeInTheDocument();
  });

  it('should show error when approving without checking all checkboxes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Approve & Auto-Apply')).toBeInTheDocument();
    });

    // Fill in notes but don't check checkboxes
    const notesField = screen.getByPlaceholderText(/Explain what you reviewed/i);
    await user.type(notesField, 'Test notes');

    // Try to approve
    const approveButton = screen.getByText('Approve & Auto-Apply');
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/You must check all review checkboxes/i)).toBeInTheDocument();
    });
  });

  it('should show error when approving without notes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Approve & Auto-Apply')).toBeInTheDocument();
    });

    // Check all checkboxes but don't add notes
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    // Try to approve
    const approveButton = screen.getByText('Approve & Auto-Apply');
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText(/Review notes are required/i)).toBeInTheDocument();
    });
  });

  it('should successfully approve when all requirements met', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Approve & Auto-Apply')).toBeInTheDocument();
    });

    // Check all checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      await user.click(checkbox);
    }

    // Add notes
    const notesField = screen.getByPlaceholderText(/Explain what you reviewed/i);
    await user.type(notesField, 'Reviewed the retry logic, looks safe to apply');

    // Approve
    const approveButton = screen.getByText('Approve & Auto-Apply');
    await user.click(approveButton);

    await waitFor(() => {
      expect(mockApproveTicket).toHaveBeenCalledWith('ticket-123', {
        code_reviewed: true,
        impact_understood: true,
        rollback_understood: true,
        review_notes: 'Reviewed the retry logic, looks safe to apply',
      });
    });
  });

  it('should show error when rejecting without notes', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    // Try to reject without notes
    const rejectButton = screen.getByText('Reject');
    await user.click(rejectButton);

    await waitFor(() => {
      expect(screen.getByText(/Review notes are required to reject/i)).toBeInTheDocument();
    });
  });

  it('should successfully reject when notes provided', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    // Add notes
    const notesField = screen.getByPlaceholderText(/Explain what you reviewed/i);
    await user.type(notesField, 'Too risky, need manual intervention');

    // Reject
    const rejectButton = screen.getByText('Reject');
    await user.click(rejectButton);

    await waitFor(() => {
      expect(mockRejectTicket).toHaveBeenCalledWith('ticket-123', {
        review_notes: 'Too risky, need manual intervention',
      });
    });
  });

  it('should navigate back when back button clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Back to Approvals/i)).toBeInTheDocument();
    });

    const backButton = screen.getByText(/Back to Approvals/i);
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/guardian/approvals');
  });

  it('should show 404 when ticket not found', async () => {
    mockGetTicketById.mockResolvedValueOnce({ success: false, error: 'Not found' });

    render(
      <TestWrapper>
        <GuardianApprovalForm />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Ticket Not Found')).toBeInTheDocument();
    });
  });
});
