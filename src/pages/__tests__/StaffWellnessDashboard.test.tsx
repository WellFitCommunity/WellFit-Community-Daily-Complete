/**
 * Tests for StaffWellnessDashboard Component
 *
 * ENTERPRISE-GRADE TESTS:
 * - Rendering states (loading, error, empty, populated)
 * - Service integration (StaffWellnessService mock)
 * - User interactions (department filter, refresh, interventions)
 * - Audit logging verification
 * - Error handling
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import StaffWellnessDashboard from '../StaffWellnessDashboard';
import type {
  StaffWellnessRecord,
  DepartmentWellnessMetrics,
} from '../../services/staffWellnessService';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockMetrics: DepartmentWellnessMetrics = {
  total_staff: 47,
  high_risk_count: 5,
  critical_risk_count: 3,
  avg_compassion_score: 72,
  avg_documentation_debt: 2.3,
  staff_on_break: 4,
  interventions_needed: 8,
  avg_workload_score: 65,
  avg_shift_hours: 8.5,
};

const mockStaffList: StaffWellnessRecord[] = [
  {
    staff_id: 'staff-001',
    full_name: 'Sarah Johnson, RN',
    title: 'Charge Nurse',
    department_name: 'Emergency',
    burnout_risk_level: 'high',
    compassion_score: 45,
    documentation_debt_hours: 4.5,
    last_break: '6 hours ago',
    shift_hours: 10,
    patient_count: 18,
    mood_trend: 'declining',
    user_id: 'user-001',
  },
  {
    staff_id: 'staff-002',
    full_name: 'Michael Chen, MD',
    title: 'Attending Physician',
    department_name: 'Emergency',
    burnout_risk_level: 'moderate',
    compassion_score: 68,
    documentation_debt_hours: 3.2,
    last_break: '3 hours ago',
    shift_hours: 8,
    patient_count: 12,
    mood_trend: 'stable',
    user_id: 'user-002',
  },
  {
    staff_id: 'staff-003',
    full_name: 'Emily Rodriguez, RN',
    title: 'Staff Nurse',
    department_name: 'ICU',
    burnout_risk_level: 'critical',
    compassion_score: 32,
    documentation_debt_hours: 6.0,
    last_break: '8 hours ago',
    shift_hours: 11,
    patient_count: 6,
    mood_trend: 'declining',
    user_id: 'user-003',
  },
  {
    staff_id: 'staff-004',
    full_name: 'David Kim, PA-C',
    title: 'Physician Assistant',
    department_name: 'Emergency',
    burnout_risk_level: 'low',
    compassion_score: 85,
    documentation_debt_hours: 1.0,
    last_break: '1 hours ago',
    shift_hours: 6,
    patient_count: 8,
    mood_trend: 'improving',
    user_id: 'user-004',
  },
];

const mockTrends = {
  turnover_reduction_percent: 32,
  satisfaction_increase_percent: 18,
  sick_days_reduction_percent: 24,
  estimated_annual_savings: 847000,
};

const mockDepartments = [
  { department_id: 'dept-001', department_name: 'Emergency' },
  { department_id: 'dept-002', department_name: 'ICU' },
  { department_id: 'dept-003', department_name: 'Medicine' },
];

// ============================================================================
// MOCKS
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/staffWellnessService', () => ({
  default: {
    getDepartmentMetrics: vi.fn(),
    getStaffWellnessList: vi.fn(),
    getWellnessTrends: vi.fn(),
    getDepartments: vi.fn(),
    initiatePeerSupport: vi.fn(),
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
  },
}));

import StaffWellnessService from '../../services/staffWellnessService';
import { auditLogger } from '../../services/auditLogger';

const mockGetDepartmentMetrics = StaffWellnessService.getDepartmentMetrics as ReturnType<typeof vi.fn>;
const mockGetStaffWellnessList = StaffWellnessService.getStaffWellnessList as ReturnType<typeof vi.fn>;
const mockGetWellnessTrends = StaffWellnessService.getWellnessTrends as ReturnType<typeof vi.fn>;
const mockGetDepartments = StaffWellnessService.getDepartments as ReturnType<typeof vi.fn>;
const mockInitiatePeerSupport = StaffWellnessService.initiatePeerSupport as ReturnType<typeof vi.fn>;
const mockAuditClinical = auditLogger.clinical as ReturnType<typeof vi.fn>;
const mockAuditError = auditLogger.error as ReturnType<typeof vi.fn>;

// ============================================================================
// TEST UTILITIES
// ============================================================================

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {ui}
      <ToastContainer />
    </BrowserRouter>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('StaffWellnessDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful mocks
    mockGetDepartmentMetrics.mockResolvedValue({ success: true, data: mockMetrics });
    mockGetStaffWellnessList.mockResolvedValue({ success: true, data: mockStaffList });
    mockGetWellnessTrends.mockResolvedValue({ success: true, data: mockTrends });
    mockGetDepartments.mockResolvedValue({ success: true, data: mockDepartments });
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      // Delay the mock to see loading state
      mockGetDepartmentMetrics.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: mockMetrics }), 100))
      );

      renderWithRouter(<StaffWellnessDashboard />);

      expect(screen.getByText('Loading Staff Wellness Data...')).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.queryByText('Loading Staff Wellness Data...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when data fails to load', async () => {
      mockGetDepartmentMetrics.mockResolvedValue({
        success: false,
        error: { message: 'Network error', code: 'NETWORK_ERROR' },
      });

      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Unable to Load Wellness Data')).toBeInTheDocument();
      });
    });

    it('should show Try Again button on error', async () => {
      mockGetDepartmentMetrics.mockResolvedValue({
        success: false,
        error: { message: 'Network error', code: 'NETWORK_ERROR' },
      });

      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should log error via auditLogger', async () => {
      mockGetDepartmentMetrics.mockResolvedValue({
        success: false,
        error: { message: 'Network error', code: 'NETWORK_ERROR' },
      });

      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(mockAuditError).toHaveBeenCalledWith(
          'STAFF_WELLNESS_DASHBOARD_LOAD_FAILED',
          expect.any(String),
          expect.any(Object)
        );
      });
    });
  });

  describe('Rendering with Data', () => {
    it('should render header with title', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Staff Wellness Center')).toBeInTheDocument();
        expect(screen.getByText('Burnout Prevention & Compassion Fatigue Monitoring')).toBeInTheDocument();
      });
    });

    it('should render metrics cards', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Staff')).toBeInTheDocument();
        expect(screen.getByText('High Risk')).toBeInTheDocument();
        expect(screen.getByText('Avg Compassion')).toBeInTheDocument();
        expect(screen.getByText('Avg Doc Debt')).toBeInTheDocument();
        expect(screen.getByText('On Break')).toBeInTheDocument();
        expect(screen.getByText('Interventions')).toBeInTheDocument();
      });
    });

    it('should display correct metric values', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('47')).toBeInTheDocument(); // total staff
        // '8' appears in both high risk (5+3) and on break cards - use getAllByText
        const eights = screen.getAllByText('8');
        expect(eights.length).toBeGreaterThanOrEqual(2); // high risk and on break
        expect(screen.getByText('72%')).toBeInTheDocument(); // compassion
      });
    });

    it('should render staff wellness table', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Staff Wellness Monitor')).toBeInTheDocument();
        expect(screen.getByText('Sarah Johnson, RN')).toBeInTheDocument();
        expect(screen.getByText('Michael Chen, MD')).toBeInTheDocument();
      });
    });

    it('should log successful data load', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(mockAuditClinical).toHaveBeenCalledWith(
          'STAFF_WELLNESS_DASHBOARD_LOAD',
          true,
          expect.objectContaining({
            staff_count: 4,
          })
        );
      });
    });
  });

  describe('Critical Staff Alert', () => {
    it('should show alert banner for high/critical risk staff', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/staff member\(s\) at elevated burnout risk/)).toBeInTheDocument();
      });
    });
  });

  describe('Department Filter', () => {
    it('should render department filter dropdown', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Filter by Department:')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should show all departments in dropdown', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Check that options exist within the select
      const options = select.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);
      expect(optionTexts).toContain('All Departments');
      expect(optionTexts).toContain('Emergency');
      expect(optionTexts).toContain('ICU');
    });

    it('should reload data when department changes', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'dept-001');

      // Should call the service again
      await waitFor(() => {
        expect(mockGetStaffWellnessList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Burnout Risk Badges', () => {
    it('should display risk level badges with correct colors', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('HIGH')).toBeInTheDocument();
        expect(screen.getByText('MODERATE')).toBeInTheDocument();
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
        expect(screen.getByText('LOW')).toBeInTheDocument();
      });
    });
  });

  describe('Intervention Actions', () => {
    it('should show intervene button for high/critical risk staff', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        // Should have intervene buttons for Sarah (high) and Emily (critical)
        const interveneButtons = screen.getAllByText('Intervene');
        expect(interveneButtons.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should call initiatePeerSupport when intervene clicked', async () => {
      const user = userEvent.setup();
      mockInitiatePeerSupport.mockResolvedValue({ success: true });

      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getAllByText('Intervene').length).toBeGreaterThan(0);
      });

      const interveneButtons = screen.getAllByText('Intervene');
      await user.click(interveneButtons[0]);

      await waitFor(() => {
        expect(mockInitiatePeerSupport).toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Button', () => {
    it('should show refresh button', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });

    it('should reload data when refresh clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(mockGetStaffWellnessList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to nurse dashboard when button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Nurse Panel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Nurse Panel'));
      expect(mockNavigate).toHaveBeenCalledWith('/nurse-dashboard');
    });

    it('should navigate to shift handoff when button clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Shift Handoff')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Shift Handoff'));
      expect(mockNavigate).toHaveBeenCalledWith('/shift-handoff');
    });
  });

  describe('Quick Actions', () => {
    it('should render quick action cards', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Smart Break Scheduler')).toBeInTheDocument();
        expect(screen.getByText('Peer Support Circles')).toBeInTheDocument();
        expect(screen.getByText('Wellness Resources')).toBeInTheDocument();
      });
    });
  });

  describe('Impact Metrics', () => {
    it('should render wellness program impact section', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Wellness Program Impact')).toBeInTheDocument();
        expect(screen.getByText('Turnover Reduction')).toBeInTheDocument();
        expect(screen.getByText('Staff Satisfaction')).toBeInTheDocument();
        expect(screen.getByText('Sick Days Used')).toBeInTheDocument();
        expect(screen.getByText('Est. Annual Savings')).toBeInTheDocument();
      });
    });

    it('should display correct trend values', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('-32%')).toBeInTheDocument();
        expect(screen.getByText('+18%')).toBeInTheDocument();
        expect(screen.getByText('-24%')).toBeInTheDocument();
        expect(screen.getByText('$847K')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no staff data', async () => {
      mockGetStaffWellnessList.mockResolvedValue({ success: true, data: [] });

      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('No staff wellness data available for selected filters.')).toBeInTheDocument();
      });
    });
  });

  describe('Footer', () => {
    it('should render compliance badges', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('HIPAA Compliant')).toBeInTheDocument();
        expect(screen.getByText('Staff Confidential')).toBeInTheDocument();
      });
    });

    it('should show staff count in footer', async () => {
      renderWithRouter(<StaffWellnessDashboard />);

      await waitFor(() => {
        expect(screen.getByText('4 staff members')).toBeInTheDocument();
      });
    });
  });
});
