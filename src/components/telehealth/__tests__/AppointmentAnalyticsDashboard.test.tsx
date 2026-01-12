/**
 * AppointmentAnalyticsDashboard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppointmentAnalyticsDashboard from '../AppointmentAnalyticsDashboard';

// Mock the analytics service
vi.mock('../../../services/appointmentAnalyticsService', () => ({
  AppointmentAnalyticsService: {
    getAnalyticsSummary: vi.fn(),
    getAppointmentTrends: vi.fn(),
    getProviderStats: vi.fn(),
    getNoShowPatterns: vi.fn(),
    getStatusBreakdown: vi.fn(),
    getReschedulingAnalytics: vi.fn(),
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

const mockSummary = {
  totalAppointments: 100,
  completed: 80,
  noShows: 10,
  cancelled: 5,
  inProgress: 2,
  scheduled: 3,
  confirmed: 0,
  completionRate: 80.0,
  noShowRate: 10.0,
  cancellationRate: 5.0,
  avgAppointmentsPerDay: 3.3,
  avgDurationMinutes: 30,
  totalHoursCompleted: 40.0,
  daysInRange: 30,
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-01-31T00:00:00Z',
};

const mockTrends = [
  {
    periodStart: '2026-01-01',
    periodLabel: 'Jan 01',
    totalAppointments: 10,
    completed: 8,
    noShows: 1,
    cancelled: 1,
    completionRate: 80.0,
    noShowRate: 10.0,
  },
];

const mockProviderStats = [
  {
    providerId: 'provider-1',
    providerName: 'Dr. Smith',
    providerEmail: 'dr.smith@example.com',
    totalAppointments: 50,
    completed: 45,
    noShows: 3,
    cancelled: 2,
    completionRate: 90.0,
    noShowRate: 6.0,
    totalHours: 22.5,
    avgDurationMinutes: 30,
  },
];

const mockNoShowPatterns = {
  byDayOfWeek: [
    { dayOfWeek: 0, dayName: 'Sunday', totalAppointments: 5, noShows: 1, noShowRate: 20.0 },
    { dayOfWeek: 1, dayName: 'Monday', totalAppointments: 20, noShows: 2, noShowRate: 10.0 },
  ],
  byHour: [
    { hour: 9, hourLabel: '09 AM', totalAppointments: 15, noShows: 1, noShowRate: 6.7 },
  ],
  highRiskPatients: [
    {
      patientId: 'patient-1',
      patientName: 'John Doe',
      totalAppointments: 10,
      noShowCount: 4,
      noShowRate: 40.0,
      isRestricted: true,
    },
  ],
};

const mockReschedulingData = {
  totalReschedules: 25,
  byRole: [
    { role: 'patient', count: 15, percentage: 60.0 },
  ],
  topReasons: [
    { reason: 'Schedule conflict', count: 10 },
  ],
  outcomes: [
    { status: 'completed', count: 18, percentage: 72.0 },
  ],
};

describe('AppointmentAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupMocks() {
    const { AppointmentAnalyticsService } = await import(
      '../../../services/appointmentAnalyticsService'
    );
    vi.mocked(AppointmentAnalyticsService.getAnalyticsSummary).mockResolvedValue({
      success: true,
      data: mockSummary,
      error: null,
    });
    vi.mocked(AppointmentAnalyticsService.getAppointmentTrends).mockResolvedValue({
      success: true,
      data: mockTrends,
      error: null,
    });
    vi.mocked(AppointmentAnalyticsService.getProviderStats).mockResolvedValue({
      success: true,
      data: mockProviderStats,
      error: null,
    });
    vi.mocked(AppointmentAnalyticsService.getNoShowPatterns).mockResolvedValue({
      success: true,
      data: mockNoShowPatterns,
      error: null,
    });
    vi.mocked(AppointmentAnalyticsService.getStatusBreakdown).mockResolvedValue({
      success: true,
      data: [],
      error: null,
    });
    vi.mocked(AppointmentAnalyticsService.getReschedulingAnalytics).mockResolvedValue({
      success: true,
      data: mockReschedulingData,
      error: null,
    });
  }

  describe('Loading State', () => {
    it('should show loading indicator while fetching data', async () => {
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );
      vi.mocked(AppointmentAnalyticsService.getAnalyticsSummary).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<AppointmentAnalyticsDashboard />);

      expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    });
  });

  describe('Overview Tab', () => {
    it('should display summary statistics', async () => {
      await setupMocks();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument(); // Total appointments
      });

      expect(screen.getByText('80.0%')).toBeInTheDocument(); // Completion rate
      expect(screen.getByText('10.0%')).toBeInTheDocument(); // No-show rate
      expect(screen.getByText('40.0')).toBeInTheDocument(); // Hours completed
    });

    it('should display status breakdown when expanded', async () => {
      await setupMocks();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Appointments')).toBeInTheDocument();
      });

      // Click Status Breakdown to expand
      const statusButton = screen.getByText('Status Breakdown');
      fireEvent.click(statusButton);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('No-Shows')).toBeInTheDocument();
        expect(screen.getByText('Cancelled')).toBeInTheDocument();
      });
    });
  });

  describe('Time Range Selection', () => {
    it('should allow changing time range', async () => {
      await setupMocks();
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );

      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click 7d time range button
      const sevenDayButton = screen.getByRole('button', { name: '7d' });
      fireEvent.click(sevenDayButton);

      await waitFor(() => {
        expect(AppointmentAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith(
          '7d',
          undefined,
          undefined
        );
      });
    });
  });

  describe('Trends Tab', () => {
    it('should display trends table', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click Trends tab
      const trendsTab = screen.getByRole('button', { name: /Trends/i });
      await user.click(trendsTab);

      await waitFor(() => {
        expect(screen.getByText('Appointment Trends')).toBeInTheDocument();
        expect(screen.getByText('Jan 01')).toBeInTheDocument();
      });
    });

    it('should allow changing granularity', async () => {
      await setupMocks();
      const user = userEvent.setup();
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );

      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click Trends tab
      const trendsTab = screen.getByRole('button', { name: /Trends/i });
      await user.click(trendsTab);

      await waitFor(() => {
        expect(screen.getByText('Appointment Trends')).toBeInTheDocument();
      });

      // Click Week granularity
      const weekButton = screen.getByRole('button', { name: 'Week' });
      await user.click(weekButton);

      await waitFor(() => {
        expect(AppointmentAnalyticsService.getAppointmentTrends).toHaveBeenCalledWith(
          '30d',
          'week',
          undefined,
          undefined
        );
      });
    });
  });

  describe('Providers Tab', () => {
    it('should display provider statistics', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard showProviderStats />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click Providers tab
      const providersTab = screen.getByRole('button', { name: /Providers/i });
      await user.click(providersTab);

      await waitFor(() => {
        expect(screen.getByText('Provider Performance')).toBeInTheDocument();
        expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
        expect(screen.getByText('dr.smith@example.com')).toBeInTheDocument();
      });
    });

    it('should hide providers tab when providerId is set', async () => {
      await setupMocks();
      render(<AppointmentAnalyticsDashboard providerId="provider-1" />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Providers/i })).not.toBeInTheDocument();
    });
  });

  describe('No-Show Analysis Tab', () => {
    it('should display no-show patterns by day of week', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click No-Show Analysis tab
      const noShowTab = screen.getByRole('button', { name: /No-Show Analysis/i });
      await user.click(noShowTab);

      await waitFor(() => {
        expect(screen.getByText('No-Shows by Day of Week')).toBeInTheDocument();
        expect(screen.getByText('Sun')).toBeInTheDocument();
        expect(screen.getByText('Mon')).toBeInTheDocument();
      });
    });

    it('should display high-risk patients', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click No-Show Analysis tab
      const noShowTab = screen.getByRole('button', { name: /No-Show Analysis/i });
      await user.click(noShowTab);

      await waitFor(() => {
        expect(screen.getByText('High-Risk Patients')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Restricted')).toBeInTheDocument();
      });
    });
  });

  describe('Rescheduling Tab', () => {
    it('should display rescheduling analytics', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click Rescheduling tab
      const reschedulingTab = screen.getByRole('button', { name: /Rescheduling/i });
      await user.click(reschedulingTab);

      await waitFor(() => {
        expect(screen.getByText('Total Reschedules')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });

    it('should display top rescheduling reasons', async () => {
      await setupMocks();
      const user = userEvent.setup();
      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      // Click Rescheduling tab
      const reschedulingTab = screen.getByRole('button', { name: /Rescheduling/i });
      await user.click(reschedulingTab);

      await waitFor(() => {
        expect(screen.getByText('Top Rescheduling Reasons')).toBeInTheDocument();
        expect(screen.getByText('Schedule conflict')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload data when refresh button is clicked', async () => {
      await setupMocks();
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );
      const user = userEvent.setup();

      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument();
      });

      const initialCallCount = vi.mocked(
        AppointmentAnalyticsService.getAnalyticsSummary
      ).mock.calls.length;

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      await user.click(refreshButton);

      await waitFor(() => {
        expect(
          vi.mocked(AppointmentAnalyticsService.getAnalyticsSummary).mock.calls.length
        ).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when data loading fails', async () => {
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );
      vi.mocked(AppointmentAnalyticsService.getAnalyticsSummary).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(AppointmentAnalyticsService.getAppointmentTrends).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(AppointmentAnalyticsService.getProviderStats).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(AppointmentAnalyticsService.getNoShowPatterns).mockRejectedValue(
        new Error('Network error')
      );
      vi.mocked(AppointmentAnalyticsService.getReschedulingAnalytics).mockRejectedValue(
        new Error('Network error')
      );

      render(<AppointmentAnalyticsDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument();
      });
    });
  });

  describe('Props', () => {
    it('should pass tenantId to service calls', async () => {
      await setupMocks();
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );

      render(<AppointmentAnalyticsDashboard tenantId="tenant-123" />);

      await waitFor(() => {
        expect(AppointmentAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith(
          '30d',
          'tenant-123',
          undefined
        );
      });
    });

    it('should pass providerId to service calls', async () => {
      await setupMocks();
      const { AppointmentAnalyticsService } = await import(
        '../../../services/appointmentAnalyticsService'
      );

      render(<AppointmentAnalyticsDashboard providerId="provider-456" />);

      await waitFor(() => {
        expect(AppointmentAnalyticsService.getAnalyticsSummary).toHaveBeenCalledWith(
          '30d',
          undefined,
          'provider-456'
        );
      });
    });
  });
});
