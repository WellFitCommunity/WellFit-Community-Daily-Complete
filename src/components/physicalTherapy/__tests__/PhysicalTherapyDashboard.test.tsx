import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhysicalTherapyDashboard } from '../PhysicalTherapyDashboard';

// Mock the PhysicalTherapyService
jest.mock('../../../services/physicalTherapyService', () => ({
  PhysicalTherapyService: {
    getTherapistCaseload: jest.fn(),
    getActiveTreatmentPlan: jest.fn(),
    getOutcomeMeasures: jest.fn(),
  },
}));

// Mock the AuthContext
const mockUser = { id: 'test-therapist-id', email: 'therapist@test.com' };
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    user: mockUser,
    supabase: {},
  }),
}));

// Import mocked service
import { PhysicalTherapyService } from '../../../services/physicalTherapyService';

describe('PhysicalTherapyDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves - stays in loading
    );

    render(<PhysicalTherapyDashboard />);

    // Should show loading spinner
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render dashboard with empty caseload', async () => {
    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Physical Therapy Dashboard/i)).toBeInTheDocument();
    });

    // Should show empty state message
    expect(screen.getByText(/No active patients in caseload/i)).toBeInTheDocument();
  });

  it('should render dashboard with patient caseload', async () => {
    const mockCaseload = [
      {
        patient_id: 'patient-1',
        patient_name: 'John Smith',
        diagnosis: 'Lower Back Pain',
        visits_used: 5,
        visits_remaining: 10,
        next_scheduled_visit: '2025-12-05T10:00:00Z',
        days_since_last_visit: 3,
        progress_status: 'on_track',
      },
      {
        patient_id: 'patient-2',
        patient_name: 'Jane Doe',
        diagnosis: 'Knee Replacement',
        visits_used: 8,
        visits_remaining: 4,
        next_scheduled_visit: '2025-12-06T14:00:00Z',
        days_since_last_visit: 7,
        progress_status: 'at_risk',
      },
    ];

    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockResolvedValue({
      success: true,
      data: mockCaseload,
    });

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Physical Therapy Dashboard/i)).toBeInTheDocument();
    });

    // Should display patients
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    // Should display diagnoses
    expect(screen.getByText('Lower Back Pain')).toBeInTheDocument();
    expect(screen.getByText('Knee Replacement')).toBeInTheDocument();

    // Should display progress statuses
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  it('should display metrics correctly', async () => {
    const mockCaseload = [
      {
        patient_id: 'patient-1',
        patient_name: 'John Smith',
        diagnosis: 'Lower Back Pain',
        visits_used: 5,
        visits_remaining: 2,
        progress_status: 'on_track',
        days_since_last_visit: 3,
      },
    ];

    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockResolvedValue({
      success: true,
      data: mockCaseload,
    });

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Active Caseload/i)).toBeInTheDocument();
    });

    // Should show metric cards with labels
    expect(screen.getByText(/Active Caseload/i)).toBeInTheDocument();
    expect(screen.getByText(/At-Risk Patients/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Plans/i)).toBeInTheDocument();
    expect(screen.getByText(/Discharge Ready/i)).toBeInTheDocument();
  });

  it('should display error state with retry button', async () => {
    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Dashboard/i)).toBeInTheDocument();
    });

    // Should show retry button
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('should have quick action buttons', async () => {
    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    });

    // Should show quick action buttons
    expect(screen.getByRole('button', { name: /New Initial Evaluation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Record Treatment Session/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Outcome Measure/i })).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    (PhysicalTherapyService.getTherapistCaseload as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<PhysicalTherapyDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Physical Therapy Dashboard/i)).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    await userEvent.click(refreshButton);

    // Service should have been called again
    expect(PhysicalTherapyService.getTherapistCaseload).toHaveBeenCalledTimes(2);
  });
});
