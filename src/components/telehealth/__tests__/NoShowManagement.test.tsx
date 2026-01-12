/**
 * NoShowManagement Component Tests
 *
 * Tests for the provider no-show management dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoShowManagement from '../NoShowManagement';

// Mock the no-show detection service
vi.mock('../../../services/noShowDetectionService', () => ({
  NoShowDetectionService: {
    detectExpiredAppointments: vi.fn(),
    markAppointmentNoShow: vi.fn(),
    getPatientNoShowStats: vi.fn(() =>
      Promise.resolve({ success: true, data: null, error: null })
    ),
    checkPatientRestriction: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 0,
          warningLevel: 'good',
        },
        error: null,
      })
    ),
  },
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('NoShowManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching data', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<NoShowManagement />);

      expect(screen.getByText('Loading expired appointments...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no expired appointments', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('No overdue appointments')).toBeInTheDocument();
        expect(
          screen.getByText('All appointments are accounted for')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Expired Appointments List', () => {
    it('should display expired appointments', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 2,
            patientPhone: '+15551234567',
            patientEmail: 'john@example.com',
            tenantId: null,
          },
        ],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('25 min overdue')).toBeInTheDocument();
        expect(screen.getByText(/Dr. Smith/)).toBeInTheDocument();
      });
    });

    it('should show count badge in header', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
          {
            appointmentId: 'apt-2',
            patientId: 'patient-2',
            patientName: 'Jane Smith',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T11:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 10,
            patientNoShowCount: 1,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse', () => {
    it('should expand row to show details', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 2,
            patientPhone: '+15551234567',
            patientEmail: 'john@example.com',
            tenantId: null,
          },
        ],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Click expand button
      const expandButton = screen.getByLabelText('Expand');
      await user.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('Previous no-shows:')).toBeInTheDocument();
        expect(screen.getByText('+15551234567')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('Mark as No-Show')).toBeInTheDocument();
      });
    });

    it('should collapse expanded row', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Expand
      await user.click(screen.getByLabelText('Expand'));

      await waitFor(() => {
        expect(screen.getByText('Mark as No-Show')).toBeInTheDocument();
      });

      // Collapse
      await user.click(screen.getByLabelText('Collapse'));

      await waitFor(() => {
        expect(screen.queryByText('Mark as No-Show')).not.toBeInTheDocument();
      });
    });
  });

  describe('Mark as No-Show', () => {
    it('should mark appointment as no-show when button clicked', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });
      vi.mocked(NoShowDetectionService.markAppointmentNoShow).mockResolvedValue({
        success: true,
        data: {
          success: true,
          appointmentId: 'apt-1',
          patientId: 'patient-1',
          newNoShowCount: 1,
          consecutiveNoShows: 1,
          isRestricted: false,
          shouldNotifyProvider: true,
          shouldNotifyPatient: true,
          shouldNotifyCareTeam: false,
          followupEnabled: true,
        },
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Expand
      await user.click(screen.getByLabelText('Expand'));

      // Click mark as no-show
      await user.click(screen.getByText('Mark as No-Show'));

      await waitFor(() => {
        expect(NoShowDetectionService.markAppointmentNoShow).toHaveBeenCalledWith(
          'apt-1',
          'manual_provider',
          expect.any(String)
        );
      });
    });

    it('should show success message after marking', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });
      vi.mocked(NoShowDetectionService.markAppointmentNoShow).mockResolvedValue({
        success: true,
        data: {
          success: true,
          appointmentId: 'apt-1',
          patientId: 'patient-1',
          newNoShowCount: 1,
          consecutiveNoShows: 1,
          isRestricted: false,
          shouldNotifyProvider: true,
          shouldNotifyPatient: true,
          shouldNotifyCareTeam: false,
          followupEnabled: true,
        },
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Expand'));
      await user.click(screen.getByText('Mark as No-Show'));

      await waitFor(() => {
        expect(screen.getByText('Appointment marked as no-show')).toBeInTheDocument();
      });
    });

    it('should show error message on failure', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });
      vi.mocked(NoShowDetectionService.markAppointmentNoShow).mockResolvedValue({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Already marked' },
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Expand'));
      await user.click(screen.getByText('Mark as No-Show'));

      await waitFor(() => {
        expect(screen.getByText('Already marked')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh', () => {
    it('should refresh list when refresh button clicked', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [],
        error: null,
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('No overdue appointments')).toBeInTheDocument();
      });

      // Click refresh
      await user.click(screen.getByLabelText('Refresh list'));

      expect(NoShowDetectionService.detectExpiredAppointments).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should show error message when fetch fails', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: false,
        data: null,
        error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
      });

      render(<NoShowManagement />);

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
      });
    });
  });

  describe('Provider Filter', () => {
    it('should filter by provider ID when provided', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
          {
            appointmentId: 'apt-2',
            patientId: 'patient-2',
            patientName: 'Jane Smith',
            providerId: 'provider-2',
            providerName: 'Dr. Jones',
            appointmentTime: '2026-01-12T11:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 10,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });

      render(<NoShowManagement providerId="provider-1" />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('Callback', () => {
    it('should call onNoShowMarked callback when marked', async () => {
      const user = userEvent.setup();
      const onNoShowMarked = vi.fn();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.detectExpiredAppointments).mockResolvedValue({
        success: true,
        data: [
          {
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            patientName: 'John Doe',
            providerId: 'provider-1',
            providerName: 'Dr. Smith',
            appointmentTime: '2026-01-12T10:00:00Z',
            durationMinutes: 30,
            gracePeriodMinutes: 15,
            minutesOverdue: 25,
            patientNoShowCount: 0,
            patientPhone: null,
            patientEmail: null,
            tenantId: null,
          },
        ],
        error: null,
      });
      const mockResult = {
        success: true,
        appointmentId: 'apt-1',
        patientId: 'patient-1',
        newNoShowCount: 1,
        consecutiveNoShows: 1,
        isRestricted: false,
        shouldNotifyProvider: true,
        shouldNotifyPatient: true,
        shouldNotifyCareTeam: false,
        followupEnabled: true,
      };
      vi.mocked(NoShowDetectionService.markAppointmentNoShow).mockResolvedValue({
        success: true,
        data: mockResult,
        error: null,
      });

      render(<NoShowManagement onNoShowMarked={onNoShowMarked} />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Expand'));
      await user.click(screen.getByText('Mark as No-Show'));

      await waitFor(() => {
        expect(onNoShowMarked).toHaveBeenCalledWith(mockResult);
      });
    });
  });
});
