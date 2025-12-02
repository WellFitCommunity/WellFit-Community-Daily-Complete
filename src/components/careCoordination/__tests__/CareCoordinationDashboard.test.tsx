import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CareCoordinationDashboard } from '../CareCoordinationDashboard';

// Mock the CareCoordinationService
jest.mock('../../../services/careCoordinationService', () => ({
  CareCoordinationService: {
    getCarePlansNeedingReview: jest.fn(),
    getActiveAlerts: jest.fn(),
    updateAlertStatus: jest.fn(),
    completeCarePlan: jest.fn(),
  },
}));

// Mock the AuthContext
const mockUser = { id: 'test-user-id', email: 'user@test.com' };
jest.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    user: mockUser,
    supabase: {},
  }),
}));

// Import mocked service
import { CareCoordinationService } from '../../../services/careCoordinationService';

describe('CareCoordinationDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(<CareCoordinationDashboard />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render dashboard with no plans needing review', async () => {
    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockResolvedValue([]);
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockResolvedValue([]);

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Care Coordination Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/All care plans are up to date/i)).toBeInTheDocument();
  });

  it('should render dashboard with care plans', async () => {
    const mockPlans = [
      {
        id: 'plan-1',
        patient_id: 'patient-1',
        title: 'Readmission Prevention Plan',
        plan_type: 'readmission_prevention',
        status: 'active',
        priority: 'high',
        start_date: '2025-11-01',
        next_review_date: '2025-12-01',
        goals: [
          { goal: 'Reduce ER visits', target: '0 visits', timeframe: '30 days', status: 'in_progress' },
        ],
        interventions: [],
      },
    ];

    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockResolvedValue(mockPlans);
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockResolvedValue([]);

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Care Coordination Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Readmission Prevention Plan')).toBeInTheDocument();
    expect(screen.getByText('Readmission Prevention')).toBeInTheDocument();
  });

  it('should display alerts when present', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        patient_id: 'patient-1',
        title: 'Missed Check-in',
        description: 'Patient missed scheduled check-in',
        alert_type: 'missed_checkin',
        severity: 'high',
        priority: 'urgent',
        status: 'active',
      },
    ];

    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockResolvedValue([]);
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockResolvedValue(mockAlerts);

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Active Alerts/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Missed Check-in')).toBeInTheDocument();
    expect(screen.getByText('Patient missed scheduled check-in')).toBeInTheDocument();
  });

  it('should display metrics correctly', async () => {
    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockResolvedValue([]);
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockResolvedValue([]);

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Active Plans/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Needs Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/Critical Alerts/i)).toBeInTheDocument();
  });

  it('should display error state with retry button', async () => {
    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockRejectedValue(
      new Error('Network error')
    );

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to Load Dashboard/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('should have quick action buttons', async () => {
    (CareCoordinationService.getCarePlansNeedingReview as jest.Mock).mockResolvedValue([]);
    (CareCoordinationService.getActiveAlerts as jest.Mock).mockResolvedValue([]);

    render(<CareCoordinationDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Create Care Plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Team Member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Alert/i })).toBeInTheDocument();
  });
});
