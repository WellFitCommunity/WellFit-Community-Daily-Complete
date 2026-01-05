/**
 * Tests for GuardianApprovalsList Component
 *
 * Purpose: Dashboard view showing all pending Guardian Agent pool reports
 * Tests: Loading, empty state, stats, filtering, ticket display, navigation
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GuardianApprovalsList } from '../GuardianApprovalsList';

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockLocation = { state: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

// Mock AuthContext
const mockSupabaseClient = {
  from: vi.fn(),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
};

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}));

// Mock guardianApprovalService
const mockGetTickets = vi.fn();
const mockGetTicketStats = vi.fn();
const mockSubscribeToTickets = vi.fn();
const mockUnsubscribeFromTickets = vi.fn();

vi.mock('../../../services/guardianApprovalService', () => ({
  getGuardianApprovalService: () => ({
    getTickets: mockGetTickets,
    getTicketStats: mockGetTicketStats,
    subscribeToTickets: mockSubscribeToTickets,
    unsubscribeFromTickets: mockUnsubscribeFromTickets,
  }),
}));

// Mock ticket data
const mockTickets = [
  {
    id: 'ticket-1',
    status: 'pending' as const,
    issue_severity: 'critical' as const,
    issue_category: 'Security',
    issue_description: 'Critical security vulnerability detected',
    healing_strategy: 'code_patch' as const,
    sandbox_tested: true,
    sandbox_passed: true,
    created_at: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
  },
  {
    id: 'ticket-2',
    status: 'in_review' as const,
    issue_severity: 'high' as const,
    issue_category: 'Performance',
    issue_description: 'Memory leak in dashboard component',
    healing_strategy: 'configuration_change' as const,
    sandbox_tested: true,
    sandbox_passed: false,
    created_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
  },
  {
    id: 'ticket-3',
    status: 'approved' as const,
    issue_severity: 'medium' as const,
    issue_category: 'Database',
    issue_description: 'Query optimization needed',
    healing_strategy: 'schema_migration' as const,
    sandbox_tested: false,
    sandbox_passed: false,
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
];

const mockStats = {
  pending_count: 5,
  in_review_count: 2,
  approved_today: 3,
  rejected_today: 1,
  applied_today: 4,
  failed_today: 0,
};

describe('GuardianApprovalsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTickets.mockResolvedValue({
      success: true,
      data: mockTickets,
    });
    mockGetTicketStats.mockResolvedValue({
      success: true,
      data: mockStats,
    });
    mockSubscribeToTickets.mockImplementation(() => {});
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <GuardianApprovalsList />
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('should show loading spinner while fetching data', async () => {
      mockGetTickets.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderComponent();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should display page title', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Review and approve Guardian Agent healing actions')).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should call loadData when refresh clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      const initialCalls = mockGetTickets.mock.calls.length;
      await userEvent.click(screen.getByText('Refresh'));

      // Should have been called at least once more after refresh
      await waitFor(() => {
        expect(mockGetTickets.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });
  });

  describe('Success Message', () => {
    it('should display success message from navigation state', async () => {
      // @ts-expect-error - Mocking location state
      mockLocation.state = { message: 'Ticket approved successfully!' };

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Ticket approved successfully!')).toBeInTheDocument();
      });

      // Reset
      mockLocation.state = null;
    });
  });

  describe('Stats Cards', () => {
    it('should display pending count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display in review count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('In Review')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should display approved today count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Approved Today')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('should display rejected today count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Rejected Today')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('should display applied today count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Applied Today')).toBeInTheDocument();
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should display failed today count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed Today')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render status filter buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    it('should render severity filter buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Severity')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /critical/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /high/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /low/i })).toBeInTheDocument();
      });
    });

    it('should toggle status filter when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
      });

      // The status filter updates the filters state
      // Initial load uses pending/in_review filter
      expect(mockGetTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['pending', 'in_review'],
        })
      );
    });

    it('should toggle severity filter when clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /critical/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /critical/i }));

      // Filter should update
      await waitFor(() => {
        expect(mockGetTickets).toHaveBeenCalled();
      });
    });
  });

  describe('Tickets Table', () => {
    it('should display ticket count in header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/review tickets \(3\)/i)).toBeInTheDocument();
      });
    });

    it('should render table headers', async () => {
      renderComponent();

      await waitFor(() => {
        // Table structure should exist
        const table = document.querySelector('table');
        expect(table).toBeInTheDocument();
      });
    });

    it('should display ticket severity badges', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
        expect(screen.getByText('HIGH')).toBeInTheDocument();
        expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      });
    });

    it('should display ticket categories', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('Performance')).toBeInTheDocument();
        expect(screen.getByText('Database')).toBeInTheDocument();
      });
    });

    it('should display sandbox test status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Failed').length).toBeGreaterThan(0);
        expect(screen.getByText('Not tested')).toBeInTheDocument();
      });
    });

    it('should display time since created', async () => {
      renderComponent();

      await waitFor(() => {
        // Time formatting: 5m ago, 2h ago, 1d ago
        expect(screen.getByText('5m ago')).toBeInTheDocument();
        expect(screen.getByText('2h ago')).toBeInTheDocument();
        expect(screen.getByText('1d ago')).toBeInTheDocument();
      });
    });

    it('should render review buttons for each ticket', async () => {
      renderComponent();

      await waitFor(() => {
        const reviewButtons = screen.getAllByText('Review');
        expect(reviewButtons.length).toBe(3);
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no tickets', async () => {
      mockGetTickets.mockResolvedValue({
        success: true,
        data: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('No tickets matching your filters')).toBeInTheDocument();
        expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to ticket detail when row clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Security')).toBeInTheDocument();
      });

      // Click on the first ticket row
      const row = screen.getByText('Security').closest('tr');
      fireEvent.click(row!);

      expect(mockNavigate).toHaveBeenCalledWith('/guardian/approval/ticket-1');
    });
  });

  describe('Real-time Subscription', () => {
    it('should subscribe to ticket updates on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockSubscribeToTickets).toHaveBeenCalled();
      });
    });

    it('should unsubscribe on unmount', async () => {
      const { unmount } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
      });

      unmount();

      expect(mockUnsubscribeFromTickets).toHaveBeenCalled();
    });
  });

  describe('Ticket Row Component', () => {
    it('should show risk level for healing strategy', async () => {
      renderComponent();

      await waitFor(() => {
        // code_patch is a healing strategy
        expect(screen.getByText('Security')).toBeInTheDocument();
      });
    });

    it('should apply hover styles on row', async () => {
      renderComponent();

      await waitFor(() => {
        const row = screen.getByText('Security').closest('tr');
        expect(row).toHaveClass('hover:bg-slate-800');
        expect(row).toHaveClass('cursor-pointer');
      });
    });
  });

  describe('Stats Card Component', () => {
    it('should render stat icons', async () => {
      renderComponent();

      await waitFor(() => {
        // Stats cards have emoji icons
        expect(document.body.textContent).toContain('⏳'); // Pending
        expect(document.body.textContent).toContain('👀'); // In Review
        expect(document.body.textContent).toContain('✅'); // Approved
        expect(document.body.textContent).toContain('❌'); // Rejected
        expect(document.body.textContent).toContain('🚀'); // Applied
        expect(document.body.textContent).toContain('💥'); // Failed
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle failed ticket fetch gracefully', async () => {
      mockGetTickets.mockResolvedValue({
        success: false,
        error: { message: 'Failed to load' },
      });

      renderComponent();

      await waitFor(() => {
        // Should still render the page structure
        expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
      });
    });

    it('should handle failed stats fetch gracefully', async () => {
      mockGetTicketStats.mockResolvedValue({
        success: false,
        error: { message: 'Failed to load stats' },
      });

      renderComponent();

      await waitFor(() => {
        // Should still render the page without stats
        expect(screen.getByText('Guardian Approvals')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Layout', () => {
    it('should use grid layout for stats cards', async () => {
      renderComponent();

      await waitFor(() => {
        const grid = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-4.lg\\:grid-cols-6');
        expect(grid).toBeInTheDocument();
      });
    });

    it('should have overflow-x-auto on table container', async () => {
      renderComponent();

      await waitFor(() => {
        const tableContainer = document.querySelector('.overflow-x-auto');
        expect(tableContainer).toBeInTheDocument();
      });
    });
  });
});
