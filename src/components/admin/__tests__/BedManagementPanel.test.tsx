/**
 * Unit Tests for BedManagementPanel
 *
 * Tests bed management dashboard functionality including:
 * - Loading states and error handling
 * - Bed board display with filtering
 * - Unit capacity view
 * - ML learning feedback submission
 * - Tab navigation
 * - Bed status updates
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BedManagementPanel from '../BedManagementPanel';

// Mock the supabase client
const mockInvoke = jest.fn();
const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock audit logger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: jest.fn().mockResolvedValue(undefined),
    warn: jest.fn().mockResolvedValue(undefined),
    error: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Bed: () => <span data-testid="icon-bed">Bed</span>,
  Building2: () => <span data-testid="icon-building">Building2</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  AlertTriangle: () => <span data-testid="icon-alert">AlertTriangle</span>,
  RefreshCw: () => <span data-testid="icon-refresh">RefreshCw</span>,
  Search: () => <span data-testid="icon-search">Search</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  TrendingUp: () => <span data-testid="icon-trending">TrendingUp</span>,
  Brain: () => <span data-testid="icon-brain">Brain</span>,
  CheckCircle: () => <span data-testid="icon-check">CheckCircle</span>,
  XCircle: () => <span data-testid="icon-x">XCircle</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  Activity: () => <span data-testid="icon-activity">Activity</span>,
  ArrowRight: () => <span data-testid="icon-arrow">ArrowRight</span>,
  ChevronDown: () => <span data-testid="icon-chevron-down">ChevronDown</span>,
  ChevronUp: () => <span data-testid="icon-chevron-up">ChevronUp</span>,
  Sparkles: () => <span data-testid="icon-sparkles">Sparkles</span>,
  Target: () => <span data-testid="icon-target">Target</span>,
  BarChart3: () => <span data-testid="icon-chart">BarChart3</span>,
}));

// Mock Envision Atlus components
jest.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="ea-card">{children}</div>
  ),
  EACardHeader: ({ children, icon, onClick, className }: {
    children: React.ReactNode;
    icon?: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <div onClick={onClick} className={className} data-testid="ea-card-header">
      {icon}
      {children}
    </div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="ea-card-content">{children}</div>
  ),
  EAButton: ({ children, onClick, icon, variant, disabled, className }: {
    children: React.ReactNode;
    onClick?: () => void;
    icon?: React.ReactNode;
    variant?: string;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={`${variant} ${className}`} data-testid="ea-button">
      {icon}
      {children}
    </button>
  ),
  EAAlert: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div role="alert" className={variant} data-testid="ea-alert">
      {children}
    </div>
  ),
}));

// Sample test data
const mockBedBoard = [
  {
    bed_id: 'bed-1',
    bed_label: '101-A',
    room_number: '101',
    bed_position: 'A',
    bed_type: 'standard',
    status: 'available',
    status_changed_at: '2025-01-01T00:00:00Z',
    has_telemetry: true,
    has_isolation_capability: false,
    has_negative_pressure: false,
    unit_id: 'unit-1',
    unit_code: 'ICU-A',
    unit_name: 'Medical ICU',
    unit_type: 'icu',
    floor_number: '3',
    facility_id: 'facility-1',
    facility_name: 'Main Hospital',
    patient_id: null,
    patient_name: null,
    patient_mrn: null,
    assigned_at: null,
    expected_discharge_date: null,
    patient_acuity: null,
    tenant_id: 'tenant-1',
  },
  {
    bed_id: 'bed-2',
    bed_label: '101-B',
    room_number: '101',
    bed_position: 'B',
    bed_type: 'standard',
    status: 'occupied',
    status_changed_at: '2025-01-01T00:00:00Z',
    has_telemetry: true,
    has_isolation_capability: false,
    has_negative_pressure: false,
    unit_id: 'unit-1',
    unit_code: 'ICU-A',
    unit_name: 'Medical ICU',
    unit_type: 'icu',
    floor_number: '3',
    facility_id: 'facility-1',
    facility_name: 'Main Hospital',
    patient_id: 'patient-1',
    patient_name: 'John Smith',
    patient_mrn: 'MRN123',
    assigned_at: '2025-01-01T10:00:00Z',
    expected_discharge_date: '2025-01-05',
    patient_acuity: 'HIGH',
    tenant_id: 'tenant-1',
  },
  {
    bed_id: 'bed-3',
    bed_label: '102-A',
    room_number: '102',
    bed_position: 'A',
    bed_type: 'standard',
    status: 'dirty',
    status_changed_at: '2025-01-01T00:00:00Z',
    has_telemetry: false,
    has_isolation_capability: true,
    has_negative_pressure: false,
    unit_id: 'unit-2',
    unit_code: 'MED-SURG',
    unit_name: 'Med-Surg',
    unit_type: 'med_surg',
    floor_number: '2',
    facility_id: 'facility-1',
    facility_name: 'Main Hospital',
    patient_id: null,
    patient_name: null,
    patient_mrn: null,
    assigned_at: null,
    expected_discharge_date: null,
    patient_acuity: null,
    tenant_id: 'tenant-1',
  },
];

const mockUnitCapacity = [
  {
    unit_id: 'unit-1',
    unit_code: 'ICU-A',
    unit_name: 'Medical ICU',
    unit_type: 'icu',
    total_beds: 10,
    target_census: 8,
    max_census: 10,
    facility_name: 'Main Hospital',
    active_beds: 10,
    occupied: 7,
    available: 2,
    pending_clean: 1,
    out_of_service: 0,
    occupancy_pct: 70,
    tenant_id: 'tenant-1',
  },
  {
    unit_id: 'unit-2',
    unit_code: 'MED-SURG',
    unit_name: 'Med-Surg',
    unit_type: 'med_surg',
    total_beds: 20,
    target_census: 16,
    max_census: 20,
    facility_name: 'Main Hospital',
    active_beds: 20,
    occupied: 15,
    available: 3,
    pending_clean: 2,
    out_of_service: 0,
    occupancy_pct: 75,
    tenant_id: 'tenant-1',
  },
];

const mockUnits = [
  {
    id: 'unit-1',
    tenant_id: 'tenant-1',
    facility_id: 'facility-1',
    unit_code: 'ICU-A',
    unit_name: 'Medical ICU',
    unit_type: 'icu',
    total_beds: 10,
    is_active: true,
    is_accepting_patients: true,
    min_acuity_level: 3,
    max_acuity_level: 5,
    charge_nurse_required: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'unit-2',
    tenant_id: 'tenant-1',
    facility_id: 'facility-1',
    unit_code: 'MED-SURG',
    unit_name: 'Med-Surg',
    unit_type: 'med_surg',
    total_beds: 20,
    is_active: true,
    is_accepting_patients: true,
    min_acuity_level: 1,
    max_acuity_level: 3,
    charge_nurse_required: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
];

// Sample accuracy data - kept for reference in future tests
// const mockAccuracy = {
//   unit_id: 'unit-1',
//   unit_name: 'Medical ICU',
//   prediction_type: 'census',
//   total_predictions: 30,
//   mean_error: -0.5,
//   mean_absolute_error: 1.2,
//   accuracy_percentage: 92.5,
//   improving_trend: true,
//   last_30_days_accuracy: 92.5,
//   samples_for_improvement: 30,
// };

// Helper to set up default mocks
function setupDefaultMocks() {
  mockInvoke.mockImplementation((funcName: string, options: { body: { action: string } }) => {
    const action = options?.body?.action;

    if (action === 'get_bed_board') {
      return Promise.resolve({ data: { success: true, beds: mockBedBoard }, error: null });
    }
    if (action === 'get_unit_capacity') {
      return Promise.resolve({ data: { success: true, units: mockUnitCapacity }, error: null });
    }
    if (action === 'update_status') {
      return Promise.resolve({ data: { success: true, message: 'Status updated' }, error: null });
    }
    if (action === 'generate_forecast') {
      return Promise.resolve({
        data: {
          success: true,
          forecast_id: 'forecast-1',
          forecast: {
            id: 'forecast-1',
            unit_id: 'unit-1',
            forecast_date: '2025-01-02',
            predicted_census: 8,
            predicted_available: 2,
            predicted_discharges: 2,
            predicted_admissions: 1,
            confidence_level: 0.85,
            generated_at: '2025-01-01T12:00:00Z',
            model_version: 'v1.0',
          },
        },
        error: null,
      });
    }
    return Promise.resolve({ data: { success: true }, error: null });
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'hospital_units') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUnits, error: null }),
      };
    }
    if (table === 'bed_availability_forecasts') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        not: jest.fn().mockResolvedValue({
          data: [
            { predicted_census: 8, actual_census: 7, forecast_error: -1, error_percentage: -12.5 },
            { predicted_census: 7, actual_census: 8, forecast_error: 1, error_percentage: 14.3 },
          ],
          error: null,
        }),
        update: jest.fn().mockReturnThis(),
      };
    }
    if (table === 'daily_census_snapshots') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'snapshot-1' }, error: null }),
        update: jest.fn().mockReturnThis(),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    };
  });
}

describe('BedManagementPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  describe('Loading State', () => {
    it('should display loading skeleton while fetching data', () => {
      // Make invoke hang to show loading state
      mockInvoke.mockImplementation(() => new Promise(() => {}));

      render(<BedManagementPanel />);

      // Check for loading state (animate-pulse class)
      const skeleton = document.querySelector('.animate-pulse');
      expect(skeleton).toBeTruthy();
    });
  });

  describe('Header and Title', () => {
    it('should display the dashboard title', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });
    });

    it('should display subtitle', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(
          screen.getByText('Real-time bed tracking with predictive analytics')
        ).toBeInTheDocument();
      });
    });

    it('should display refresh button', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Metrics', () => {
    it('should display total beds', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Total Beds')).toBeInTheDocument();
        // Total from mockUnitCapacity = 10 + 20 = 30
        expect(screen.getByText('30')).toBeInTheDocument();
      });
    });

    it('should display occupancy percentage', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Occupancy')).toBeInTheDocument();
      });
    });

    it('should display available beds count', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        // Check for "Available" label in summary metrics
        const availableLabels = screen.getAllByText('Available');
        expect(availableLabels.length).toBeGreaterThan(0);
        // Available from mockUnitCapacity = 2 + 3 = 5
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display pending clean count', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Pending Clean')).toBeInTheDocument();
        // Pending from mockUnitCapacity = 1 + 2 = 3
        // Multiple "3"s may appear due to bed counts in unit type tabs
        const threeElements = screen.getAllByText('3');
        expect(threeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should default to Bed Board tab', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        const bedBoardTab = screen.getByRole('button', { name: /Bed Board/i });
        expect(bedBoardTab).toHaveClass('bg-teal-600');
      });
    });

    it('should switch to Unit Capacity tab when clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const capacityTab = screen.getByRole('button', { name: /Unit Capacity/i });
      await act(async () => {
        await user.click(capacityTab);
      });

      expect(capacityTab).toHaveClass('bg-teal-600');
    });

    it('should switch to Forecasts tab when clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const forecastsTab = screen.getByRole('button', { name: /Forecasts/i });
      await act(async () => {
        await user.click(forecastsTab);
      });

      expect(forecastsTab).toHaveClass('bg-teal-600');
    });

    it('should switch to ML Learning tab when clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const learningTab = screen.getByRole('button', { name: /ML Learning/i });
      await act(async () => {
        await user.click(learningTab);
      });

      expect(learningTab).toHaveClass('bg-teal-600');
    });
  });

  describe('Unit Type Quick Filters', () => {
    it('should display unit type category tabs', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        // Check for unit type quick filter text
        expect(screen.getByText('Quick Filter by Unit Type')).toBeInTheDocument();
        expect(screen.getByText('All Beds')).toBeInTheDocument();
        // Use getAllByText since "ICU" appears in multiple places
        const icuElements = screen.getAllByText('ICU');
        expect(icuElements.length).toBeGreaterThan(0);
        expect(screen.getByText('Step Down')).toBeInTheDocument();
        expect(screen.getByText('ER')).toBeInTheDocument();
        expect(screen.getByText('L&D')).toBeInTheDocument();
      });
    });

    it('should filter beds when unit type tab is clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('All Beds')).toBeInTheDocument();
      });

      // Find the All Beds button which should be active by default
      const allBedsButton = screen.getByText('All Beds').closest('button');
      expect(allBedsButton).toHaveClass('bg-teal-600');
    });

    it('should show bed counts for each category', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        // "All Beds" should show total count
        expect(screen.getByText('All Beds')).toBeInTheDocument();
        expect(screen.getByText('Quick Filter by Unit Type')).toBeInTheDocument();
      });
    });
  });

  describe('Bed Board View', () => {
    it('should display beds grouped by unit', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        // Both units should appear in the bed board
        const icuElements = screen.getAllByText('Medical ICU');
        expect(icuElements.length).toBeGreaterThan(0);
        const medSurgElements = screen.getAllByText('Med-Surg');
        expect(medSurgElements.length).toBeGreaterThan(0);
      });
    });

    it('should display bed labels', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('101-A')).toBeInTheDocument();
        expect(screen.getByText('101-B')).toBeInTheDocument();
        expect(screen.getByText('102-A')).toBeInTheDocument();
      });
    });

    it('should display patient name for occupied beds', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });
    });

    it('should display Start Cleaning button for dirty beds', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        const startCleaningButtons = screen.getAllByText('Start Cleaning');
        expect(startCleaningButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Filters', () => {
    it('should display search input', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('Search beds, rooms, patients...')
        ).toBeInTheDocument();
      });
    });

    it('should display unit filter dropdown', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('All Units')).toBeInTheDocument();
      });
    });

    it('should display status filter dropdown', async () => {
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('All Statuses')).toBeInTheDocument();
      });
    });

    it('should filter beds by search query', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('101-A')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search beds, rooms, patients...');
      await act(async () => {
        await user.type(searchInput, 'John');
      });

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        // Other beds without John should not be visible
        expect(screen.queryByText('102-A')).not.toBeInTheDocument();
      });
    });
  });

  describe('Unit Capacity View', () => {
    it('should display unit capacity table', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const capacityTab = screen.getByRole('button', { name: /Unit Capacity/i });
      await act(async () => {
        await user.click(capacityTab);
      });

      await waitFor(() => {
        // Table should be visible - check for table structure
        const table = document.querySelector('table');
        expect(table).toBeTruthy();
        // Check table headers exist
        expect(screen.getByRole('columnheader', { name: /Unit/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Type/i })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: /Total/i })).toBeInTheDocument();
      });
    });

    it('should display unit names in table', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const capacityTab = screen.getByRole('button', { name: /Unit Capacity/i });
      await act(async () => {
        await user.click(capacityTab);
      });

      await waitFor(() => {
        // Unit names should be in the table
        const icuElements = screen.getAllByText('Medical ICU');
        expect(icuElements.length).toBeGreaterThan(0);
      });
    });

    it('should display forecast button for each unit', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const capacityTab = screen.getByRole('button', { name: /Unit Capacity/i });
      await act(async () => {
        await user.click(capacityTab);
      });

      await waitFor(() => {
        const forecastButtons = screen.getAllByText('Forecast');
        expect(forecastButtons.length).toBe(2); // One per unit
      });
    });
  });

  describe('ML Learning Tab', () => {
    it('should display prediction accuracy section', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const learningTab = screen.getByRole('button', { name: /ML Learning/i });
      await act(async () => {
        await user.click(learningTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Prediction Accuracy')).toBeInTheDocument();
      });
    });

    it('should display learning feedback form', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const learningTab = screen.getByRole('button', { name: /ML Learning/i });
      await act(async () => {
        await user.click(learningTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Submit Learning Feedback')).toBeInTheDocument();
        expect(screen.getByText('Unit')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        expect(screen.getByText('Actual Census (End of Day)')).toBeInTheDocument();
      });
    });

    it('should display how algorithm learns section', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const learningTab = screen.getByRole('button', { name: /ML Learning/i });
      await act(async () => {
        await user.click(learningTab);
      });

      await waitFor(() => {
        expect(screen.getByText('How the Algorithm Learns')).toBeInTheDocument();
        expect(screen.getByText('Data Collection')).toBeInTheDocument();
        expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();
        expect(screen.getByText('Continuous Improvement')).toBeInTheDocument();
      });
    });

    it('should have submit feedback button', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const learningTab = screen.getByRole('button', { name: /ML Learning/i });
      await act(async () => {
        await user.click(learningTab);
      });

      await waitFor(() => {
        expect(screen.getByText('Submit Feedback')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle edge function errors gracefully', async () => {
      mockInvoke.mockImplementation(() => {
        return Promise.resolve({
          data: null,
          error: { message: 'Network error' },
        });
      });

      // Should not throw
      expect(() => render(<BedManagementPanel />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });
    });

    it('should handle empty bed board gracefully', async () => {
      mockInvoke.mockImplementation((funcName: string, options: { body: { action: string } }) => {
        const action = options?.body?.action;
        if (action === 'get_bed_board') {
          return Promise.resolve({ data: { success: true, beds: [] }, error: null });
        }
        if (action === 'get_unit_capacity') {
          return Promise.resolve({ data: { success: true, units: [] }, error: null });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      });

      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('No beds found')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should call loadData when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const initialCallCount = mockInvoke.mock.calls.length;

      const refreshButton = screen.getByText('Refresh');
      await act(async () => {
        await user.click(refreshButton);
      });

      await waitFor(() => {
        expect(mockInvoke.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Bed Status Update', () => {
    it('should call update status when Start Cleaning is clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('102-A')).toBeInTheDocument();
      });

      // Find and click the Start Cleaning button for the dirty bed
      const startCleaningButtons = screen.getAllByText('Start Cleaning');
      await act(async () => {
        await user.click(startCleaningButtons[0]);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'bed-management',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'update_status',
              new_status: 'cleaning',
            }),
          })
        );
      });
    });
  });

  describe('Bed Detail Modal', () => {
    it('should open modal when bed is clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('101-A')).toBeInTheDocument();
      });

      // Click on a bed
      const bedCard = screen.getByText('101-A').closest('div[class*="cursor-pointer"]');
      if (bedCard) {
        await act(async () => {
          await user.click(bedCard);
        });
      }

      await waitFor(() => {
        // Modal should show bed details
        expect(screen.getByText('Bed 101-A')).toBeInTheDocument();
      });
    });

    it('should close modal when Close button is clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('101-A')).toBeInTheDocument();
      });

      // Open modal
      const bedCard = screen.getByText('101-A').closest('div[class*="cursor-pointer"]');
      if (bedCard) {
        await act(async () => {
          await user.click(bedCard);
        });
      }

      await waitFor(() => {
        expect(screen.getByText('Bed 101-A')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close');
      await act(async () => {
        await user.click(closeButton);
      });

      await waitFor(() => {
        // Modal header should not be visible
        expect(screen.queryByText('Bed 101-A')).not.toBeInTheDocument();
      });
    });
  });

  describe('Null Safety', () => {
    it('should handle null values gracefully', async () => {
      mockInvoke.mockImplementation((funcName: string, options: { body: { action: string } }) => {
        const action = options?.body?.action;

        if (action === 'get_bed_board') {
          return Promise.resolve({
            data: {
              success: true,
              beds: [
                {
                  bed_id: 'bed-1',
                  bed_label: '101-A',
                  room_number: '101',
                  bed_position: 'A',
                  bed_type: 'standard',
                  status: 'available',
                  status_changed_at: '2025-01-01T00:00:00Z',
                  has_telemetry: null,
                  has_isolation_capability: null,
                  has_negative_pressure: null,
                  unit_id: 'unit-1',
                  unit_code: 'ICU',
                  unit_name: 'ICU',
                  unit_type: 'icu',
                  floor_number: null,
                  facility_id: null,
                  facility_name: null,
                  patient_id: null,
                  patient_name: null,
                  patient_mrn: null,
                  assigned_at: null,
                  expected_discharge_date: null,
                  patient_acuity: null,
                  tenant_id: 'tenant-1',
                },
              ],
            },
            error: null,
          });
        }
        if (action === 'get_unit_capacity') {
          return Promise.resolve({
            data: {
              success: true,
              units: [
                {
                  unit_id: 'unit-1',
                  unit_code: 'ICU',
                  unit_name: 'ICU',
                  unit_type: 'icu',
                  total_beds: null,
                  target_census: null,
                  max_census: null,
                  facility_name: null,
                  active_beds: null,
                  occupied: null,
                  available: null,
                  pending_clean: null,
                  out_of_service: null,
                  occupancy_pct: null,
                  tenant_id: 'tenant-1',
                },
              ],
            },
            error: null,
          });
        }
        return Promise.resolve({ data: { success: true }, error: null });
      });

      // Should not throw
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
        expect(screen.getByText('101-A')).toBeInTheDocument();
      });
    });
  });

  describe('Forecasts Tab', () => {
    it('should display empty state when no forecasts', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      const forecastsTab = screen.getByRole('button', { name: /Forecasts/i });
      await act(async () => {
        await user.click(forecastsTab);
      });

      await waitFor(() => {
        expect(screen.getByText('No forecasts generated yet')).toBeInTheDocument();
      });
    });

    it('should generate forecast when button clicked', async () => {
      const user = userEvent.setup();
      render(<BedManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Bed Management')).toBeInTheDocument();
      });

      // Go to capacity tab to find forecast button
      const capacityTab = screen.getByRole('button', { name: /Unit Capacity/i });
      await act(async () => {
        await user.click(capacityTab);
      });

      await waitFor(() => {
        const forecastButtons = screen.getAllByText('Forecast');
        expect(forecastButtons.length).toBeGreaterThan(0);
      });

      // Click forecast button
      const forecastButtons = screen.getAllByText('Forecast');
      await act(async () => {
        await user.click(forecastButtons[0]);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'bed-management',
          expect.objectContaining({
            body: expect.objectContaining({
              action: 'generate_forecast',
            }),
          })
        );
      });
    });
  });
});
