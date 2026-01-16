/**
 * PatientNoShowBadge Component Tests
 *
 * Tests for the patient no-show risk indicator badge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientNoShowBadge from '../PatientNoShowBadge';

// Mock the no-show detection service
vi.mock('../../../services/noShowDetectionService', () => ({
  NoShowDetectionService: {
    getPatientNoShowStats: vi.fn(),
    checkPatientRestriction: vi.fn(),
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

describe('PatientNoShowBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching data', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockImplementation(
        () => new Promise(() => {})
      );

      render(<PatientNoShowBadge patientId="patient-1" />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Clean Record', () => {
    it('should render nothing for patients with no history when showDetails is false', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 0,
          warningLevel: 'good',
        },
        error: null,
      });

      const { container } = render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
      });

      // Should render nothing visible
      expect(container.textContent).toBe('');
    });

    it('should show "Good standing" when showDetails is true', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: null,
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 0,
          warningLevel: 'good',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" showDetails />);

      await waitFor(() => {
        expect(screen.getByText('Good standing')).toBeInTheDocument();
      });
    });
  });

  describe('No-Show History', () => {
    it('should display no-show count badge', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 10,
          completedAppointments: 7,
          noShowCount: 3,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 30,
          consecutiveNoShows: 1,
          lastNoShowDate: '2026-01-10T10:00:00Z',
          lastCompletedDate: '2026-01-11T10:00:00Z',
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'medium',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 3,
          warningLevel: 'warning',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        expect(screen.getByText('3 no-shows')).toBeInTheDocument();
      });
    });

    it('should use singular form for 1 no-show', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 5,
          completedAppointments: 4,
          noShowCount: 1,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 20,
          consecutiveNoShows: 1,
          lastNoShowDate: '2026-01-10T10:00:00Z',
          lastCompletedDate: '2026-01-11T10:00:00Z',
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'low',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 1,
          warningLevel: 'good',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        expect(screen.getByText('1 no-show')).toBeInTheDocument();
      });
    });
  });

  describe('Risk Level Styling', () => {
    it('should show warning style for medium risk', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 10,
          completedAppointments: 7,
          noShowCount: 2,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 20,
          consecutiveNoShows: 1,
          lastNoShowDate: '2026-01-10T10:00:00Z',
          lastCompletedDate: null,
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'medium',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 2,
          warningLevel: 'warning',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        const badge = screen.getByText('2 no-shows').closest('button');
        expect(badge).toHaveClass('bg-orange-100');
        expect(badge).toHaveClass('text-orange-800');
      });
    });

    it('should show restricted style for restricted patients', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 10,
          completedAppointments: 5,
          noShowCount: 5,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 50,
          consecutiveNoShows: 3,
          lastNoShowDate: '2026-01-10T10:00:00Z',
          lastCompletedDate: null,
          isRestricted: true,
          restrictionEndDate: '2026-02-12T00:00:00Z',
          restrictionReason: 'Exceeded threshold',
          riskLevel: 'high',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: true,
          restrictionEndDate: '2026-02-12T00:00:00Z',
          restrictionReason: 'Exceeded threshold',
          noShowCount: 5,
          warningLevel: 'restricted',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        const badge = screen.getByText('5 no-shows').closest('button');
        expect(badge).toHaveClass('bg-red-100');
        expect(badge).toHaveClass('text-red-800');
      });
    });
  });

  describe('Tooltip', () => {
    it('should show tooltip on hover', async () => {
      const user = userEvent.setup();
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 10,
          completedAppointments: 7,
          noShowCount: 3,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 30,
          consecutiveNoShows: 2,
          lastNoShowDate: '2026-01-10T10:00:00Z',
          lastCompletedDate: '2026-01-11T10:00:00Z',
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'medium',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 3,
          warningLevel: 'warning',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        expect(screen.getByText('3 no-shows')).toBeInTheDocument();
      });

      const badge = screen.getByText('3 no-shows').closest('button');
      if (badge) {
        await user.hover(badge);
      }

      await waitFor(() => {
        expect(screen.getByText('No-Show History')).toBeInTheDocument();
        expect(screen.getByText('Total Appointments:')).toBeInTheDocument();
        expect(screen.getByText('30.0%')).toBeInTheDocument();
      });
    });
  });

  describe('Size Variants', () => {
    it('should render small size correctly', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 5,
          completedAppointments: 4,
          noShowCount: 1,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 20,
          consecutiveNoShows: 1,
          lastNoShowDate: null,
          lastCompletedDate: null,
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'low',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 1,
          warningLevel: 'good',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" size="sm" />);

      await waitFor(() => {
        const badge = screen.getByText('1 no-show').closest('button');
        expect(badge).toHaveClass('text-xs');
      });
    });

    it('should render large size correctly', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 5,
          completedAppointments: 4,
          noShowCount: 1,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 20,
          consecutiveNoShows: 1,
          lastNoShowDate: null,
          lastCompletedDate: null,
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'low',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 1,
          warningLevel: 'good',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" size="lg" />);

      await waitFor(() => {
        const badge = screen.getByText('1 no-show').closest('button');
        expect(badge).toHaveClass('text-base');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible aria-label', async () => {
      const { NoShowDetectionService } = await import(
        '../../../services/noShowDetectionService'
      );
      vi.mocked(NoShowDetectionService.getPatientNoShowStats).mockResolvedValue({
        success: true,
        data: {
          patientId: 'patient-1',
          totalAppointments: 5,
          completedAppointments: 3,
          noShowCount: 2,
          cancelledByPatient: 0,
          lateCancellations: 0,
          noShowRate: 40,
          consecutiveNoShows: 1,
          lastNoShowDate: null,
          lastCompletedDate: null,
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          riskLevel: 'medium',
        },
        error: null,
      });
      vi.mocked(NoShowDetectionService.checkPatientRestriction).mockResolvedValue({
        success: true,
        data: {
          isRestricted: false,
          restrictionEndDate: null,
          restrictionReason: null,
          noShowCount: 2,
          warningLevel: 'warning',
        },
        error: null,
      });

      render(<PatientNoShowBadge patientId="patient-1" />);

      await waitFor(() => {
        const badge = screen.getByText('2 no-shows').closest('button');
        expect(badge).toHaveAttribute(
          'aria-label',
          expect.stringContaining('No-show risk')
        );
      });
    });
  });
});
