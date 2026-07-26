/**
 * TodaysTelehealthVisits Component Tests
 *
 * Behavior coverage: the provider day view reads scheduled visits from the appointment
 * service, renders them, starts a visit (navigation), surfaces load failures instead of
 * a silent empty list, and shows an explicit empty state. Synthetic data only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TodaysTelehealthVisits } from '../TodaysTelehealthVisits';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'provider-alpha' }),
}));

const mockGetProviderAppointments = vi.fn();
vi.mock('../../../services/appointmentService', () => ({
  getProviderAppointments: (...args: unknown[]) => mockGetProviderAppointments(...args),
}));

const SYNTHETIC_VISIT = {
  id: 'appt-777',
  patient_name: 'Test Patient Alpha',
  appointment_time: '2026-07-08T15:30:00Z',
  duration_minutes: 30,
  encounter_type: 'outpatient',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProviderAppointments.mockResolvedValue({ success: true, data: [SYNTHETIC_VISIT] });
});

describe('TodaysTelehealthVisits', () => {
  it('renders the provider\'s scheduled visits from the service', async () => {
    render(<TodaysTelehealthVisits />);

    expect(await screen.findByText('Test Patient Alpha', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start visit/i })).toBeInTheDocument();
  });

  it('navigates to the visit room when Start Visit is clicked', async () => {
    render(<TodaysTelehealthVisits />);

    const startBtn = await screen.findByRole('button', { name: /start visit/i });
    fireEvent.click(startBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/provider/telehealth/appt-777');
  });

  it('surfaces a real error instead of an empty list when loading fails', async () => {
    mockGetProviderAppointments.mockResolvedValue({
      success: false,
      error: { message: 'Database unreachable' },
    });

    render(<TodaysTelehealthVisits />);

    expect(await screen.findByText('Database unreachable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start visit/i })).not.toBeInTheDocument();
  });

  it('shows an explicit empty state when there are no visits today', async () => {
    mockGetProviderAppointments.mockResolvedValue({ success: true, data: [] });

    render(<TodaysTelehealthVisits />);

    await waitFor(() =>
      expect(screen.getByText(/no telehealth visits scheduled for today/i)).toBeInTheDocument()
    );
  });
});
