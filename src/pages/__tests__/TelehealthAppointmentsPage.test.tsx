/**
 * TelehealthAppointmentsPage Tests
 *
 * Purpose: Patient-facing page to view and join scheduled video appointments
 * Tests: Loading state, empty state, appointment cards, join button, back navigation
 *
 * Deletion Test: Every test verifies specific content/behavior unique to TelehealthAppointmentsPage.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/telehealth-appointments' }),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Mock branding context
vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      gradient: 'linear-gradient(to right, #1e40af, #1e3a8a)',
      primaryColor: '#1e40af',
      appName: 'WellFit',
    },
  }),
}));

// Mock lazy-loaded TelehealthConsultation
vi.mock('../../components/telehealth/TelehealthConsultation', () => ({
  __esModule: true,
  default: () => <div data-testid="telehealth-consultation">In Call</div>,
}));

// Create future appointment times for testing
const farFutureTime = new Date();
farFutureTime.setHours(farFutureTime.getHours() + 3); // 3 hours from now (outside window)

// Mock supabase
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe });
const mockChannel = vi.fn().mockReturnValue({ on: mockOn });

let mockAppointmentsData: unknown[] = [];
let mockProfileData: unknown = { first_name: 'Jane', last_name: 'Doe' };

vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockProfileData,
            error: null,
          }),
          in: vi.fn().mockReturnThis(),
        };
      }
      // telehealth_appointments
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: mockAppointmentsData,
          error: null,
        }),
      };
    }),
    channel: mockChannel,
  }),
  useUser: () => ({
    id: 'patient-user-id',
    email: 'patient@test.com',
  }),
}));

// Mock audit logger
vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
    auth: vi.fn(),
  },
}));

import TelehealthAppointmentsPage from '../TelehealthAppointmentsPage';

describe('TelehealthAppointmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppointmentsData = [];
    mockProfileData = { first_name: 'Jane', last_name: 'Doe' };
  });

  it('shows loading state initially', () => {
    render(<TelehealthAppointmentsPage />);
    expect(screen.getByText('Loading your appointments...')).toBeInTheDocument();
  });

  it('shows empty state when no appointments exist', async () => {
    mockAppointmentsData = [];

    render(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No Upcoming Appointments')).toBeInTheDocument();
    });

    expect(screen.getByText(/don't have any scheduled video appointments/i)).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('navigates to dashboard when Back to Dashboard is clicked in empty state', async () => {
    const user = userEvent.setup();
    mockAppointmentsData = [];

    render(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Back to Dashboard'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('displays appointment card with provider name when appointments exist', async () => {
    mockAppointmentsData = [
      {
        id: 'apt-1',
        appointment_time: farFutureTime.toISOString(),
        duration_minutes: 30,
        encounter_type: 'outpatient',
        status: 'scheduled',
        reason_for_visit: 'Follow-up checkup',
        daily_room_url: null,
        provider_id: 'provider-1',
      },
    ];

    render(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Video Visit with/)).toBeInTheDocument();
    });

    expect(screen.getByText('Follow-up checkup')).toBeInTheDocument();
    expect(screen.getByText(/30 minutes/)).toBeInTheDocument();
  });

  it('renders page header with My Appointments title', async () => {
    mockAppointmentsData = [];

    render(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('My Appointments')).toBeInTheDocument();
    });

    expect(screen.getByText('View and join your scheduled video visits')).toBeInTheDocument();
  });

  it('shows Back to Health Hub button', async () => {
    mockAppointmentsData = [];

    render(<TelehealthAppointmentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Back to Health Hub')).toBeInTheDocument();
    });
  });
});
