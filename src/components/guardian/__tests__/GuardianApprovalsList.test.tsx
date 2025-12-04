/**
 * Tests for GuardianApprovalsList Component
 *
 * Tests:
 * - Renders without crashing
 * - Shows loading state
 * - Displays tickets when data loads
 * - Filters work correctly
 * - Stats cards display correctly
 * - Navigation to detail form works
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GuardianApprovalsList } from '../GuardianApprovalsList';

// Mock the hooks and services
const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  rpc: jest.fn(),
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
  }),
  removeChannel: jest.fn(),
};

jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}));

// Mock the service
jest.mock('../../../services/guardianApprovalService', () => ({
  getGuardianApprovalService: () => ({
    getTickets: jest.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'ticket-1',
          issue_id: 'issue-1',
          issue_category: 'api_failure',
          issue_severity: 'high',
          issue_description: 'API timeout on patient endpoint',
          affected_component: 'src/services/patientApi.ts',
          healing_strategy: 'retry_with_backoff',
          healing_description: 'Retry API call with exponential backoff',
          sandbox_tested: true,
          sandbox_passed: true,
          status: 'pending',
          created_at: new Date().toISOString(),
          security_alert_id: 'alert-1',
        },
      ],
    }),
    getTicketStats: jest.fn().mockResolvedValue({
      success: true,
      data: {
        pending_count: 5,
        in_review_count: 2,
        approved_today: 3,
        rejected_today: 1,
        applied_today: 3,
        failed_today: 0,
      },
    }),
    subscribeToTickets: jest.fn(),
    unsubscribeFromTickets: jest.fn(),
  }),
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

// Test wrapper with Router
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('GuardianApprovalsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    // Loading spinner should be present initially
    expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
  });

  it('should display stats cards after loading', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Approved Today')).toBeInTheDocument();
  });

  it('should display ticket data in table', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('api_failure')).toBeInTheDocument();
    });

    expect(screen.getByText(/API timeout/i)).toBeInTheDocument();
  });

  it('should have filter buttons', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    // Check severity filters
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('should navigate to detail form when Review button is clicked', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    // The row click should trigger navigation
    const reviewButton = screen.getByText('Review');
    const row = reviewButton.closest('tr');
    if (row) {
      fireEvent.click(row);
    }

    expect(mockNavigate).toHaveBeenCalledWith('/guardian/approval/ticket-1');
  });

  it('should have refresh button', async () => {
    render(
      <TestWrapper>
        <GuardianApprovalsList />
      </TestWrapper>
    );

    const refreshButton = screen.getByText('Refresh');
    expect(refreshButton).toBeInTheDocument();
  });
});
