/**
 * PatientChartNavigator Tests
 *
 * Tests for the unified patient chart navigator with tab-based navigation.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PatientChartNavigator } from '../PatientChartNavigator';

// Mock supabase — must be vi.fn() based for proper async resolution
const mockSingle = vi.fn().mockResolvedValue({
  data: {
    user_id: 'test-patient-id',
    first_name: 'Jane',
    last_name: 'Doe',
    room_number: '302',
    dob: '1955-03-15',
  },
  error: null,
});

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  },
}));

// Mock PatientContext
const mockSelectPatient = vi.fn();
vi.mock('../../../contexts/PatientContext', () => ({
  usePatientContext: () => ({
    selectedPatient: null,
    selectPatient: mockSelectPatient,
    clearPatient: vi.fn(),
    recentPatients: [],
    hasPatient: false,
    getPatientDisplayName: () => '',
    selectFromHistory: vi.fn(),
    clearHistory: vi.fn(),
    pendingPatientId: null,
    pendingHistoryIds: [],
    markPendingLoaded: vi.fn(),
  }),
}));

// Mock auditLogger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
  },
}));

// Mock lazy-loaded components — use direct mocks (not lazy)
vi.mock('../../patient/MedicationRequestManager', () => ({
  MedicationRequestManager: ({ patientId }: { patientId: string }) => (
    <div data-testid="medication-manager">Medications for {patientId}</div>
  ),
}));

vi.mock('../../patient/CarePlanDashboard', () => ({
  __esModule: true,
  default: ({ userId }: { userId: string }) => (
    <div data-testid="care-plan-dashboard">Care Plans for {userId}</div>
  ),
}));

vi.mock('../../patient/ObservationDashboard', () => ({
  __esModule: true,
  default: ({ userId }: { userId: string }) => (
    <div data-testid="observation-dashboard">Observations for {userId}</div>
  ),
}));

vi.mock('../../patient/ImmunizationDashboard', () => ({
  __esModule: true,
  default: ({ userId }: { userId: string }) => (
    <div data-testid="immunization-dashboard">Immunizations for {userId}</div>
  ),
}));

vi.mock('../../patient-avatar/PatientAvatarPage', () => ({
  PatientAvatarPage: ({ patientId }: { patientId: string }) => (
    <div data-testid="avatar-page">Avatar for {patientId}</div>
  ),
}));

const renderChart = async (initialRoute = '/patient-chart/test-patient-id') => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <PatientChartNavigator patientId="test-patient-id" />
      </MemoryRouter>
    );
  });
};

describe('PatientChartNavigator', () => {
  beforeEach(() => {
    mockSelectPatient.mockClear();
    mockSingle.mockClear();
  });

  it('renders patient name after loading', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    });
  });

  it('shows room number and DOB', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('Room 302')).toBeInTheDocument();
      expect(screen.getByText('DOB: 1955-03-15')).toBeInTheDocument();
    });
  });

  it('syncs patient to global PatientContext', async () => {
    await renderChart();
    await waitFor(() => {
      expect(mockSelectPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-patient-id',
          firstName: 'Jane',
          lastName: 'Doe',
        })
      );
    });
  });

  it('renders all tab buttons', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Overview/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: /Medications/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Care Plans/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Labs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Immunizations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Body Map/i })).toBeInTheDocument();
  });

  it('defaults to overview tab with navigation cards', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('Select a section to view clinical data')).toBeInTheDocument();
    });
  });

  it('shows overview navigation cards', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('E-prescribing, reconciliation & adherence')).toBeInTheDocument();
      expect(screen.getByText('Treatment protocols & coordination')).toBeInTheDocument();
    });
  });

  it('switches to medications tab when clicked', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Medications/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Medications/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('medication-manager')).toBeInTheDocument();
    });
  });

  it('switches to care plans tab when clicked', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Care Plans/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Care Plans/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('care-plan-dashboard')).toBeInTheDocument();
    });
  });

  it('switches to observations tab when clicked', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Labs/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Labs/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('observation-dashboard')).toBeInTheDocument();
    });
  });

  it('switches to immunizations tab when clicked', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Immunizations/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Immunizations/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('immunization-dashboard')).toBeInTheDocument();
    });
  });

  it('switches to avatar tab when clicked', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Body Map/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: /Body Map/i }));
    });
    await waitFor(() => {
      expect(screen.getByTestId('avatar-page')).toBeInTheDocument();
    });
  });

  it('renders back button', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    });
  });

  it('renders Full Body Map quick action', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('Full Body Map')).toBeInTheDocument();
    });
  });

  it('navigates to tab from overview card click', async () => {
    await renderChart();
    await waitFor(() => {
      expect(screen.getByText('E-prescribing, reconciliation & adherence')).toBeInTheDocument();
    });
    const medsCard = screen.getByText('E-prescribing, reconciliation & adherence').closest('button');
    if (medsCard) {
      await act(async () => {
        fireEvent.click(medsCard);
      });
    }
    await waitFor(() => {
      expect(screen.getByTestId('medication-manager')).toBeInTheDocument();
    });
  });
});
