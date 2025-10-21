// src/pages/__tests__/TelehealthAppointmentsPage.test.tsx
// Tests for patient-facing telehealth appointments page

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import TelehealthAppointmentsPage from '../TelehealthAppointmentsPage';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { useBranding } from '../../BrandingContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../BrandingContext');
jest.mock('../../components/telehealth/TelehealthConsultation', () => ({
  __esModule: true,
  default: () => <div>Mock TelehealthConsultation</div>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('TelehealthAppointmentsPage', () => {
  let mockSupabase: any;
  let mockUser: any;
  let mockBranding: any;

  beforeEach(() => {
    mockUser = {
      id: 'patient-123',
      email: 'patient@test.com',
    };

    mockBranding = {
      primaryColor: '#003865',
      secondaryColor: '#8cc63f',
      gradient: 'linear-gradient(to bottom right, #003865, #8cc63f)',
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(),
      }),
    };

    (useUser as jest.Mock).mockReturnValue(mockUser);
    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (useBranding as jest.Mock).mockReturnValue({ branding: mockBranding });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  test('renders loading state initially', () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: null });

    renderWithRouter(<TelehealthAppointmentsPage />);

    expect(screen.getByText(/Loading your appointments/i)).toBeInTheDocument();
  });

  test('displays no appointments message when list is empty', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No Upcoming Appointments/i)).toBeInTheDocument();
      expect(screen.getByText(/you don't have any scheduled video appointments/i)).toBeInTheDocument();
    });
  });

  test('displays upcoming appointments', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Annual checkup',
        provider: {
          full_name: 'Dr. Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          specialty: 'Family Medicine',
        },
      },
    ];

    mockSupabase.select
      .mockResolvedValueOnce({ data: { full_name: 'John Doe' }, error: null }) // Profile
      .mockResolvedValueOnce({ data: mockAppointments, error: null }); // Appointments

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Dr. Jane Smith/i)).toBeInTheDocument();
      expect(screen.getByText(/Family Medicine/i)).toBeInTheDocument();
      expect(screen.getByText(/Annual checkup/i)).toBeInTheDocument();
    });
  });

  test('shows join button when appointment is within 15 minutes', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up',
        provider: {
          full_name: 'Dr. Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          specialty: null,
        },
      },
    ];

    mockSupabase.select
      .mockResolvedValueOnce({ data: { full_name: 'John Doe' }, error: null })
      .mockResolvedValueOnce({ data: mockAppointments, error: null });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Join Video Call/i)).toBeInTheDocument();
    });
  });

  test('does not show join button when appointment is too far in future', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up',
        provider: {
          full_name: 'Dr. Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          specialty: null,
        },
      },
    ];

    mockSupabase.select
      .mockResolvedValueOnce({ data: { full_name: 'John Doe' }, error: null })
      .mockResolvedValueOnce({ data: mockAppointments, error: null });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Join Video Call/i)).not.toBeInTheDocument();
      expect(screen.getByText(/You can join this appointment 15 minutes before/i)).toBeInTheDocument();
    });
  });

  test('handles different encounter types with correct badges', async () => {
    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        duration_minutes: 30,
        encounter_type: 'er',
        status: 'scheduled',
        reason_for_visit: 'Emergency consultation',
        provider: {
          full_name: 'Dr. Emergency',
          first_name: 'Emergency',
          last_name: 'Doctor',
          specialty: null,
        },
      },
    ];

    mockSupabase.select
      .mockResolvedValueOnce({ data: { full_name: 'John Doe' }, error: null })
      .mockResolvedValueOnce({ data: mockAppointments, error: null });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/ER Visit/i)).toBeInTheDocument();
    });
  });

  test('formats appointment time correctly', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const mockAppointments = [
      {
        id: 'apt-1',
        appointment_time: tomorrow.toISOString(),
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up',
        provider: {
          full_name: 'Dr. Jane Smith',
          first_name: 'Jane',
          last_name: 'Smith',
          specialty: null,
        },
      },
    ];

    mockSupabase.select
      .mockResolvedValueOnce({ data: { full_name: 'John Doe' }, error: null })
      .mockResolvedValueOnce({ data: mockAppointments, error: null });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Tomorrow at/i)).toBeInTheDocument();
    });
  });

  test('navigates back to health hub', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    renderWithRouter(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      const backButton = screen.getByText(/Back to Health Hub/i);
      fireEvent.click(backButton);
      expect(mockNavigate).toHaveBeenCalledWith('/my-health');
    });
  });

  test('handles errors gracefully', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' },
    });

    renderWithRouter(<TelehealthAppointmentsPage />);

    // Should render without crashing
    await waitFor(() => {
      expect(screen.getByText(/My Appointments/i)).toBeInTheDocument();
    });
  });
});
