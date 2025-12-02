import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NeuroSuiteDashboard } from '../NeuroSuiteDashboard';

// Mock the NeuroSuiteService
jest.mock('../../../services/neuroSuiteService', () => ({
  NeuroSuiteService: {
    getActiveStrokePatients: jest.fn(),
    getDementiaPatientsNeedingReassessment: jest.fn(),
    identifyHighBurdenCaregivers: jest.fn(),
  },
}));

// Mock the ParkinsonsService
jest.mock('../../../services/parkinsonsService', () => ({
  ParkinsonsService: {
    getDashboardMetrics: jest.fn(),
    getPatientSummaries: jest.fn(),
  },
}));

// Mock the AuthContext
const mockUser = { id: 'test-user-id', email: 'neurologist@test.com' };
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// Import mocked services
import { NeuroSuiteService } from '../../../services/neuroSuiteService';
import { ParkinsonsService } from '../../../services/parkinsonsService';

describe('NeuroSuiteDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupDefaultMocks = () => {
    (NeuroSuiteService.getActiveStrokePatients as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (NeuroSuiteService.getDementiaPatientsNeedingReassessment as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (NeuroSuiteService.identifyHighBurdenCaregivers as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (ParkinsonsService.getDashboardMetrics as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        totalPatients: 0,
        patientsOnDBS: 0,
        averageUPDRSScore: 0,
        averageMedicationAdherence: 0,
        highRiskPatients: 0,
        assessmentsDueThisWeek: 0,
      },
    });
    (ParkinsonsService.getPatientSummaries as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
  };

  it('should render loading state initially', () => {
    (NeuroSuiteService.getActiveStrokePatients as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    (NeuroSuiteService.getDementiaPatientsNeedingReassessment as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    (NeuroSuiteService.identifyHighBurdenCaregivers as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    (ParkinsonsService.getDashboardMetrics as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );
    (ParkinsonsService.getPatientSummaries as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(<NeuroSuiteDashboard />);

    expect(screen.getByText(/Loading NeuroSuite dashboard/i)).toBeInTheDocument();
  });

  it('should render dashboard with stroke tab active by default', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Default tab should be stroke
    expect(screen.getByText(/Active Stroke Patients/i)).toBeInTheDocument();
  });

  it('should display all tabs including parkinsons', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Check all tabs are present
    expect(screen.getByRole('button', { name: /Stroke/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dementia/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parkinsons/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alerts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wearables/i })).toBeInTheDocument();
  });

  it('should switch to Parkinson\'s tab when clicked', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Parkinson's tab
    const parkinsonsTab = screen.getByRole('button', { name: /Parkinsons/i });
    await userEvent.click(parkinsonsTab);

    // Should show Parkinson's content
    await waitFor(() => {
      expect(screen.getByText(/PD Patients/i)).toBeInTheDocument();
    });
  });

  it('should display Parkinson\'s patient data when on parkinsons tab', async () => {
    (NeuroSuiteService.getActiveStrokePatients as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (NeuroSuiteService.getDementiaPatientsNeedingReassessment as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (NeuroSuiteService.identifyHighBurdenCaregivers as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    const mockMetrics = {
      totalPatients: 15,
      patientsOnDBS: 5,
      averageUPDRSScore: 32,
      averageMedicationAdherence: 85,
      highRiskPatients: 3,
      assessmentsDueThisWeek: 2,
    };

    const mockPatients = [
      {
        patient_id: 'pd-1',
        patient_name: 'John Smith',
        hoehn_yahr_stage: '2',
        last_updrs_score: 28,
        last_updrs_date: '2025-11-15',
        medication_count: 3,
        has_dbs: false,
        risk_level: 'low',
        days_since_assessment: 17,
      },
      {
        patient_id: 'pd-2',
        patient_name: 'Mary Jones',
        hoehn_yahr_stage: '3',
        last_updrs_score: 45,
        last_updrs_date: '2025-10-01',
        medication_count: 5,
        has_dbs: true,
        risk_level: 'moderate',
        days_since_assessment: 62,
      },
    ];

    (ParkinsonsService.getDashboardMetrics as jest.Mock).mockResolvedValue({
      success: true,
      data: mockMetrics,
    });
    (ParkinsonsService.getPatientSummaries as jest.Mock).mockResolvedValue({
      success: true,
      data: mockPatients,
    });

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Parkinson's tab
    const parkinsonsTab = screen.getByRole('button', { name: /Parkinsons/i });
    await userEvent.click(parkinsonsTab);

    // Check metrics
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument(); // Total patients
      expect(screen.getByText('5')).toBeInTheDocument(); // On DBS
      expect(screen.getByText('32')).toBeInTheDocument(); // Avg UPDRS
      expect(screen.getByText('3')).toBeInTheDocument(); // High risk
    });

    // Check patient names
    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('Mary Jones')).toBeInTheDocument();
  });

  it('should display ROBERT and FORBES frameworks on Parkinson\'s tab', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Parkinson's tab
    const parkinsonsTab = screen.getByRole('button', { name: /Parkinsons/i });
    await userEvent.click(parkinsonsTab);

    // Check ROBERT framework
    await waitFor(() => {
      expect(screen.getByText(/ROBERT Framework/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Rhythm & Movement Monitoring/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimization of Medication/i)).toBeInTheDocument();

    // Check FORBES framework
    expect(screen.getByText(/FORBES Framework/i)).toBeInTheDocument();
    expect(screen.getByText(/Functional Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Speech & Swallowing Evaluation/i)).toBeInTheDocument();
  });

  it('should display empty state when no Parkinson\'s patients enrolled', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Parkinson's tab
    const parkinsonsTab = screen.getByRole('button', { name: /Parkinsons/i });
    await userEvent.click(parkinsonsTab);

    // Check empty state message
    await waitFor(() => {
      expect(screen.getByText(/No Parkinson's patients enrolled/i)).toBeInTheDocument();
    });
  });

  it('should display dementia patients needing reassessment', async () => {
    (NeuroSuiteService.getActiveStrokePatients as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (NeuroSuiteService.getDementiaPatientsNeedingReassessment as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          patient_id: 'dem-1',
          patient_name: 'Alice Brown',
          last_assessment_date: '2025-06-01',
          dementia_stage: 'Mild',
          days_overdue: 30,
        },
      ],
    });
    (NeuroSuiteService.identifyHighBurdenCaregivers as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });
    (ParkinsonsService.getDashboardMetrics as jest.Mock).mockResolvedValue({
      success: true,
      data: { totalPatients: 0, patientsOnDBS: 0, averageUPDRSScore: 0, averageMedicationAdherence: 0, highRiskPatients: 0, assessmentsDueThisWeek: 0 },
    });
    (ParkinsonsService.getPatientSummaries as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Dementia tab
    const dementiaTab = screen.getByRole('button', { name: /Dementia/i });
    await userEvent.click(dementiaTab);

    // Check patient appears
    await waitFor(() => {
      expect(screen.getByText('Alice Brown')).toBeInTheDocument();
    });
  });

  it('should have quick action buttons', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Check quick actions
    expect(screen.getByText(/Quick Actions/i)).toBeInTheDocument();
    expect(screen.getByText(/New Stroke Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Cognitive Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/Caregiver Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Parkinson's UPDRS/i)).toBeInTheDocument();
    expect(screen.getByText(/Quality Reports/i)).toBeInTheDocument();
  });

  it('should navigate to parkinsons tab via quick action button', async () => {
    setupDefaultMocks();

    render(<NeuroSuiteDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/NeuroSuite Dashboard/i)).toBeInTheDocument();
    });

    // Click on Parkinson's quick action
    const parkinsonsQuickAction = screen.getByText(/Parkinson's UPDRS/i);
    await userEvent.click(parkinsonsQuickAction);

    // Should show Parkinson's content
    await waitFor(() => {
      expect(screen.getByText(/PD Patients/i)).toBeInTheDocument();
    });
  });
});
