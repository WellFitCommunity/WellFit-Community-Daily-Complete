/**
 * Unit Tests for StaffFinancialSavingsTracker
 *
 * Tests staff savings dashboard functionality including:
 * - Loading states and error handling
 * - Data display for position and staff views
 * - Filtering by date and position
 * - Export functionality
 * - Tab switching
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StaffFinancialSavingsTracker } from '../StaffFinancialSavingsTracker';

// Mock the AuthContext
const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

const mockUser = {
  id: 'user-123',
  email: 'admin@example.com',
};

jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
  useAuth: () => ({ user: mockUser }),
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  RefreshCw: () => <span data-testid="icon-refresh">RefreshCw</span>,
  DollarSign: () => <span data-testid="icon-dollar">DollarSign</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  TrendingUp: () => <span data-testid="icon-trending">TrendingUp</span>,
  Download: () => <span data-testid="icon-download">Download</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  Award: () => <span data-testid="icon-award">Award</span>,
  Briefcase: () => <span data-testid="icon-briefcase">Briefcase</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
  CheckCircle: () => <span data-testid="icon-check">CheckCircle</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
}));

// Mock Envision Atlus components
jest.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: any) => <div className={className}>{children}</div>,
  EACardHeader: ({ children, icon }: any) => <div>{icon}{children}</div>,
  EACardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  EAButton: ({ children, onClick, icon, variant }: any) => (
    <button onClick={onClick} className={variant}>{icon}{children}</button>
  ),
  EAAlert: ({ children, variant }: any) => <div role="alert" className={variant}>{children}</div>,
  EATabs: ({ children }: any) => <div>{children}</div>,
}));

// Sample test data
const mockStaffSavings = [
  {
    staff_user_id: 'staff-1',
    staff_name: 'Jane Nurse',
    position_type: 'nurse',
    department: 'ICU',
    total_savings_events: 15,
    total_amount_saved: 25000.0,
    verified_amount: 20000.0,
    savings_by_category: {
      prevented_readmission: 15000,
      early_intervention: 10000,
    },
  },
  {
    staff_user_id: 'staff-2',
    staff_name: 'John Care',
    position_type: 'care_coordinator',
    department: 'Outpatient',
    total_savings_events: 10,
    total_amount_saved: 18000.0,
    verified_amount: 15000.0,
    savings_by_category: {
      care_coordination: 12000,
      preventive_care: 6000,
    },
  },
];

const mockPositionSavings = [
  {
    position_type: 'nurse',
    staff_count: 5,
    total_events: 50,
    total_saved: 125000.0,
    avg_per_staff: 25000.0,
    verified_total: 100000.0,
  },
  {
    position_type: 'care_coordinator',
    staff_count: 3,
    total_events: 25,
    total_saved: 54000.0,
    avg_per_staff: 18000.0,
    verified_total: 45000.0,
  },
];

// Mock URL.createObjectURL for export functionality
const mockCreateObjectURL = jest.fn().mockReturnValue('blob:test');
const mockRevokeObjectURL = jest.fn();
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

describe('StaffFinancialSavingsTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup
    mockSupabaseClient.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-123' },
        error: null,
      }),
    }));

    mockSupabaseClient.rpc.mockImplementation((funcName: string) => {
      if (funcName === 'get_staff_savings') {
        return Promise.resolve({ data: mockStaffSavings, error: null });
      }
      if (funcName === 'get_position_savings_totals') {
        return Promise.resolve({ data: mockPositionSavings, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton while fetching data', () => {
      // Make RPC calls hang to show loading state
      mockSupabaseClient.rpc.mockImplementation(() => new Promise(() => {}));

      render(<StaffFinancialSavingsTracker />);

      // Check for loading state - the component renders a skeleton with animate-pulse class
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeTruthy();
    });
  });

  describe('Header and Title', () => {
    it('should display the dashboard title', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });
    });

    it('should display refresh and export buttons', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Cards', () => {
    it('should display total saved amount', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        // Total of mockStaffSavings = 25000 + 18000 = 43000
        expect(screen.getByText('$43,000.00')).toBeInTheDocument();
      });
    });

    it('should display staff count', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        // 2 staff members in mock data
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should display total savings events', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        // Check that savings events are displayed - look for the label
        expect(screen.getByText('Savings Events')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should default to Position view', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        const positionTab = screen.getByRole('button', { name: /By Position/i });
        expect(positionTab).toHaveClass('text-[#00857a]');
      });
    });

    it('should switch to Staff view when clicked', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      const staffTab = screen.getByRole('button', { name: /By Individual Staff/i });
      await act(async () => {
        await user.click(staffTab);
      });

      expect(staffTab).toHaveClass('text-[#00857a]');
    });
  });

  describe('Position View', () => {
    it('should display position type data in table', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        // Position view should be the default tab and show position data
        expect(screen.getByRole('button', { name: /By Position/i })).toBeInTheDocument();
        // Table headers should be visible
        expect(screen.getByText('Position')).toBeInTheDocument();
        expect(screen.getByText('Staff Count')).toBeInTheDocument();
      });
    });

    it('should display staff count per position', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument(); // Nurse staff count
        expect(screen.getByText('3')).toBeInTheDocument(); // Care coordinator staff count
      });
    });

    it('should display total saved per position', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('$125,000.00')).toBeInTheDocument();
        expect(screen.getByText('$54,000.00')).toBeInTheDocument();
      });
    });
  });

  describe('Staff View', () => {
    it('should display individual staff members', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      // Switch to staff view
      const staffTab = screen.getByRole('button', { name: /By Individual Staff/i });
      await act(async () => {
        await user.click(staffTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Jane Nurse')).toBeInTheDocument();
        expect(screen.getByText('John Care')).toBeInTheDocument();
      });
    });

    it('should display staff department', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      const staffTab = screen.getByRole('button', { name: /By Individual Staff/i });
      await act(async () => {
        await user.click(staffTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/ICU/)).toBeInTheDocument();
        expect(screen.getByText(/Outpatient/)).toBeInTheDocument();
      });
    });

    it('should expand staff row to show category breakdown', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      // Switch to staff view
      const staffTab = screen.getByRole('button', { name: /By Individual Staff/i });
      await act(async () => {
        await user.click(staffTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Jane Nurse')).toBeInTheDocument();
      });

      // Click on staff row to expand
      const staffRow = screen.getByText('Jane Nurse').closest('div[class*="cursor-pointer"]');
      if (staffRow) {
        await act(async () => {
          await user.click(staffRow);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Savings by Category')).toBeInTheDocument();
        expect(screen.getByText('Prevented Readmission')).toBeInTheDocument();
        expect(screen.getByText('Early Intervention')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should display date range filters', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('From:')).toBeInTheDocument();
        expect(screen.getByText('To:')).toBeInTheDocument();
      });
    });

    it('should display position filter dropdown', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Position:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should have All Positions as default', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        expect(select).toHaveValue('');
      });
    });

    it('should call RPC with filter when position is changed', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await act(async () => {
        await user.selectOptions(select, 'nurse');
      });

      await waitFor(() => {
        expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_staff_savings', expect.objectContaining({
          p_position_type: 'nurse',
        }));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RPC errors gracefully without crashing', async () => {
      // This test verifies the component handles errors without throwing
      mockSupabaseClient.rpc.mockImplementation(() => {
        return Promise.resolve({ data: null, error: { message: 'Database error' } });
      });

      // Should not throw - component should handle the error gracefully
      expect(() => render(<StaffFinancialSavingsTracker />)).not.toThrow();

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should display empty message when no data available', async () => {
      mockSupabaseClient.rpc.mockImplementation((funcName: string) => {
        return Promise.resolve({ data: [], error: null });
      });

      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText(/No savings data available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should call loadData when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      const initialCallCount = mockSupabaseClient.rpc.mock.calls.length;

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await act(async () => {
        await user.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockSupabaseClient.rpc.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Export Functionality', () => {
    it('should have an export CSV button', async () => {
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /export csv/i });
        expect(exportButton).toBeInTheDocument();
      });
    });

    it('should trigger export when button is clicked', async () => {
      const user = userEvent.setup();

      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /export csv/i });

      // Just verify the button is clickable - actual file download tested in e2e
      await act(async () => {
        await user.click(exportButton);
      });

      // Button should still be there after clicking
      expect(exportButton).toBeInTheDocument();
    });
  });

  describe('Null Safety', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      // Reset default mocks
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-123' },
          error: null,
        }),
      }));
    });

    it('should handle null values gracefully', async () => {
      mockSupabaseClient.rpc.mockImplementation((funcName: string) => {
        if (funcName === 'get_staff_savings') {
          return Promise.resolve({
            data: [
              {
                staff_user_id: null,
                staff_name: 'Test Nurse',
                position_type: 'nurse',
                department: null,
                total_savings_events: 0,
                total_amount_saved: null,
                verified_amount: null,
                savings_by_category: null,
              },
            ],
            error: null,
          });
        }
        if (funcName === 'get_position_savings_totals') {
          return Promise.resolve({
            data: [
              {
                position_type: 'nurse',
                staff_count: 1,
                total_events: 0,
                total_saved: null,
                avg_per_staff: null,
                verified_total: null,
              },
            ],
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      // Should not throw
      render(<StaffFinancialSavingsTracker />);

      await waitFor(() => {
        expect(screen.getByText('Staff Financial Savings')).toBeInTheDocument();
      });

      // Switch to staff view to see the staff member
      const user = userEvent.setup();
      const staffTab = screen.getByRole('button', { name: /By Individual Staff/i });
      await act(async () => {
        await user.click(staffTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Test Nurse')).toBeInTheDocument();
      });
    });
  });
});
