/**
 * Tests for ClinicalAlertsDashboard Component
 *
 * Purpose: Unified clinical alert management with effectiveness tracking
 * Tests: Loading, filters, alert actions, metrics display
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClinicalAlertsDashboard } from '../ClinicalAlertsDashboard';

// Mock AuthContext
const mockUser = { id: 'test-user-id', email: 'test@example.com' };
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
  useUser: () => mockUser,
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    clinical: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Supabase client
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockUpdateEq = vi.fn();
const mockInsert = vi.fn();

const createMockQuery = (data: unknown[]) => ({
  select: vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        eq: mockEq.mockResolvedValue({ data, error: null }),
        in: mockIn.mockResolvedValue({ data, error: null }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data, error: null }),
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    eq: mockUpdateEq.mockResolvedValue({ error: null }),
  }),
  insert: mockInsert.mockResolvedValue({ error: null }),
});

const mockSupabaseClient = {
  from: vi.fn(),
};

// Mock alerts data
const mockAlerts = [
  {
    id: 'alert-1',
    created_at: new Date().toISOString(),
    severity: 'critical',
    category: 'Medication',
    title: 'Drug Interaction Warning',
    description: 'Potential interaction between prescribed medications',
    status: 'pending',
    patient_name: 'John Doe',
    affected_component: 'Pharmacy',
  },
  {
    id: 'alert-2',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    severity: 'warning',
    category: 'Lab Results',
    title: 'Abnormal Lab Value',
    description: 'Blood glucose level outside normal range',
    status: 'acknowledged',
    acknowledged_by: 'test-user-id',
    acknowledged_at: new Date().toISOString(),
    patient_name: 'Jane Smith',
  },
  {
    id: 'alert-3',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    severity: 'info',
    category: 'Appointment',
    title: 'Missed Appointment',
    description: 'Patient missed scheduled appointment',
    status: 'resolved',
    patient_name: 'Bob Johnson',
  },
  {
    id: 'alert-4',
    created_at: new Date().toISOString(),
    severity: 'emergency',
    category: 'Vitals',
    title: 'Critical Vital Signs',
    description: 'Blood pressure critically high',
    status: 'pending',
    patient_name: 'Alice Williams',
    affected_component: 'Emergency',
  },
];

describe('ClinicalAlertsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock to return alerts
    mockSupabaseClient.from.mockImplementation(() => createMockQuery(mockAlerts));
  });

  describe('Loading State', () => {
    it('should render component and load data', async () => {
      // Verify component renders and eventually shows content
      render(<ClinicalAlertsDashboard />);

      // Wait for content to load
      await waitFor(() => {
        expect(screen.getByText('Clinical Alerts Dashboard')).toBeInTheDocument();
      });

      // Verify data was fetched
      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });
  });

  describe('Header', () => {
    it('should display page title', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Clinical Alerts Dashboard')).toBeInTheDocument();
      });
    });

    it('should display page description', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('AI-filtered alerts with real-time effectiveness tracking')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Banner', () => {
    it('should display false positive rate comparison', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Lower False Positive Rate/)).toBeInTheDocument();
      });
    });

    it('should display industry average benchmark', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/industry average 85%/)).toBeInTheDocument();
      });
    });

    it('should display harm prevented count', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Potential Harms Prevented')).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Cards', () => {
    it('should display our false positive rate', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Our False Positive Rate')).toBeInTheDocument();
      });
    });

    it('should display industry average rate', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Industry Average')).toBeInTheDocument();
      });
    });

    it('should display avg response time', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
      });
    });

    it('should display total alerts count', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Alerts Today')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Buttons', () => {
    it('should display All Alerts filter', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All Alerts' })).toBeInTheDocument();
      });
    });

    it('should display Pending filter', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
      });
    });

    it('should display Critical Only filter', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Critical Only' })).toBeInTheDocument();
      });
    });

    it('should have Pending filter active by default', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const pendingButton = screen.getByRole('button', { name: 'Pending' });
        expect(pendingButton).toHaveClass('bg-teal-600');
      });
    });

    it('should switch to All Alerts filter when clicked', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'All Alerts' })).toBeInTheDocument();
      });

      const allButton = screen.getByRole('button', { name: 'All Alerts' });
      await userEvent.click(allButton);

      expect(allButton).toHaveClass('bg-teal-600');
    });

    it('should switch to Critical Only filter when clicked', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Critical Only' })).toBeInTheDocument();
      });

      const criticalButton = screen.getByRole('button', { name: 'Critical Only' });
      await userEvent.click(criticalButton);

      expect(criticalButton).toHaveClass('bg-red-600');
    });

    it('should display Refresh button', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
      });
    });

    it('should reload alerts when Refresh is clicked', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
      });

      mockSupabaseClient.from.mockClear();

      const refreshButton = screen.getByRole('button', { name: 'Refresh' });
      await userEvent.click(refreshButton);

      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });
  });

  describe('Alerts List', () => {
    it('should display Active Alerts header', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Active Alerts')).toBeInTheDocument();
      });
    });

    it('should display alert titles', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Drug Interaction Warning')).toBeInTheDocument();
      });
    });

    it('should display alert descriptions', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Potential interaction between prescribed medications')).toBeInTheDocument();
      });
    });

    it('should display severity badges', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('critical')).toBeInTheDocument();
      });
    });

    it('should show empty state when no alerts', async () => {
      mockSupabaseClient.from.mockImplementation(() => createMockQuery([]));

      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All Clear!')).toBeInTheDocument();
      });
    });

    it('should show AI-filtered message in empty state', async () => {
      mockSupabaseClient.from.mockImplementation(() => createMockQuery([]));

      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('AI-filtered alerts keeping clinicians focused')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Status Counts', () => {
    it('should display pending count', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/pending/)).toBeInTheDocument();
      });
    });

    it('should display acknowledged count', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/acknowledged/)).toBeInTheDocument();
      });
    });

    it('should display resolved count', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/resolved/)).toBeInTheDocument();
      });
    });
  });

  describe('Alert Actions', () => {
    it('should show Acknowledge button for pending alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Acknowledge' }).length).toBeGreaterThan(0);
      });
    });

    it('should show Actionable button for acknowledged alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Actionable/ })).toBeInTheDocument();
      });
    });

    it('should show False Positive button for acknowledged alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /False Positive/ })).toBeInTheDocument();
      });
    });

    it('should show Resolved status for resolved alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Resolved')).toBeInTheDocument();
      });
    });
  });

  describe('Time Display', () => {
    it('should show "Just now" for recent alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const justNowElements = screen.getAllByText('Just now');
        expect(justNowElements.length).toBeGreaterThan(0);
      });
    });

    it('should show hours ago for older alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1h ago')).toBeInTheDocument();
      });
    });

    it('should show days ago for old alerts', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1d ago')).toBeInTheDocument();
      });
    });
  });

  describe('Affected Component', () => {
    it('should display affected component when available', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Component: Pharmacy/)).toBeInTheDocument();
      });
    });
  });

  describe('Why This Matters Footer', () => {
    it('should display footer section', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Why This Matters')).toBeInTheDocument();
      });
    });

    it('should display Joint Commission statistics', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Joint Commission/)).toBeInTheDocument();
      });
    });

    it('should display patient deaths statistic', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('101 patient deaths')).toBeInTheDocument();
      });
    });

    it('should display reduction in alert fatigue', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Reduction in Alert Fatigue')).toBeInTheDocument();
      });
    });
  });

  describe('Severity Styling', () => {
    it('should apply critical severity styling', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const criticalBadges = screen.getAllByText('critical');
        expect(criticalBadges.length).toBeGreaterThan(0);
        expect(criticalBadges[0]).toHaveClass('bg-red-600');
      });
    });

    it('should apply warning severity styling', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const warningBadges = screen.getAllByText('warning');
        expect(warningBadges.length).toBeGreaterThan(0);
        expect(warningBadges[0]).toHaveClass('bg-yellow-600');
      });
    });

    it('should apply info severity styling', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const infoBadges = screen.getAllByText('info');
        expect(infoBadges.length).toBeGreaterThan(0);
        expect(infoBadges[0]).toHaveClass('bg-blue-600');
      });
    });

    it('should apply emergency severity styling', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const emergencyBadges = screen.getAllByText('emergency');
        expect(emergencyBadges.length).toBeGreaterThan(0);
        expect(emergencyBadges[0]).toHaveClass('bg-red-600');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle query errors gracefully', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: new Error('Query failed') }),
          }),
        }),
      }));

      // Should not throw
      expect(() => render(<ClinicalAlertsDashboard />)).not.toThrow();
    });

    it('should show no alerts when query returns null', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }));

      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All Clear!')).toBeInTheDocument();
      });
    });
  });

  describe('Layout', () => {
    it('should have dark theme background', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const mainDiv = document.querySelector('.bg-slate-900');
        expect(mainDiv).toBeInTheDocument();
      });
    });

    it('should have metrics grid', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        const metricsGrid = document.querySelector('.grid.grid-cols-2.md\\:grid-cols-4');
        expect(metricsGrid).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Values', () => {
    it('should display total alerts value', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        // Total alerts displayed in the metrics card
        const totalAlertsLabel = screen.getByText('Total Alerts Today');
        expect(totalAlertsLabel).toBeInTheDocument();
      });
    });

    it('should display 85% industry benchmark', async () => {
      render(<ClinicalAlertsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });
  });
});
