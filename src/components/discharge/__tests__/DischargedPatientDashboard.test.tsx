/**
 * Tests for DischargedPatientDashboard Component
 *
 * Purpose: Care team dashboard for monitoring discharged patients
 * Tests: Loading, metrics display, patient list, filters, patient detail modal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DischargedPatientDashboard } from '../DischargedPatientDashboard';
import { DischargeToWellnessBridgeService } from '../../../services/dischargeToWellnessBridge';
import type {
  CareTeamDashboardMetrics,
  DischargedPatientSummary,
} from '../../../types/dischargeToWellness';

// Mock the DischargeToWellnessBridgeService
vi.mock('../../../services/dischargeToWellnessBridge');

const mockPatientSummary: DischargedPatientSummary = {
  patient_id: 'patient-1',
  patient_name: 'John Smith',
  discharge_date: '2026-01-05',
  discharge_diagnosis: 'Heart Failure',
  readmission_risk_score: 65,
  readmission_risk_category: 'high',
  wellness_enrolled: true,
  wellness_enrollment_date: '2026-01-05',
  total_check_ins_expected: 10,
  total_check_ins_completed: 8,
  check_in_adherence_percentage: 80,
  last_check_in_date: '2026-01-08',
  days_since_last_check_in: 0,
  consecutive_missed_check_ins: 0,
  active_alerts_count: 1,
  highest_alert_severity: 'medium',
  warning_signs_detected: ['Increased fatigue', 'Weight gain'],
  phq9_score_latest: 5,
  gad7_score_latest: 3,
  mental_health_risk_level: 'low',
  mood_trend: 'stable',
  stress_trend: 'improving',
  needs_attention: true,
  attention_reason: 'Weight gain detected',
  recommended_action: 'Schedule follow-up call',
};

const mockMetrics: CareTeamDashboardMetrics = {
  total_discharged_patients: 45,
  patients_enrolled_in_wellness: 38,
  enrollment_rate_percentage: 84,
  patients_needing_attention: 5,
  high_risk_patients: 8,
  missed_check_ins_count: 12,
  active_alerts: 7,
  critical_alerts: 2,
  avg_check_in_adherence: 78,
  avg_readmission_risk_score: 42,
  mental_health_screenings_pending: 3,
  patients_list: [mockPatientSummary],
};

describe('DischargedPatientDashboard', () => {
  const mockGetCareTeamDashboard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockGetCareTeamDashboard.mockResolvedValue({
      success: true,
      data: mockMetrics,
    });

    (DischargeToWellnessBridgeService.getCareTeamDashboard as ReturnType<typeof vi.fn>).mockImplementation(
      mockGetCareTeamDashboard
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      mockGetCareTeamDashboard.mockImplementation(() => new Promise(() => {}));

      render(<DischargedPatientDashboard autoRefresh={false} />);

      // Check for skeleton elements (animated pulse)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should load dashboard data on mount', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledWith({
          needs_attention_only: false,
          high_risk_only: false,
          days_since_discharge: 90,
        });
      });
    });
  });

  describe('Error State', () => {
    it('should show error message when loading fails', async () => {
      mockGetCareTeamDashboard.mockResolvedValue({
        success: false,
        error: 'Failed to fetch dashboard data',
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch dashboard data')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockGetCareTeamDashboard.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button is clicked', async () => {
      mockGetCareTeamDashboard
        .mockResolvedValueOnce({
          success: false,
          error: 'Network error',
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockMetrics,
        });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Retry'));

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle exception errors', async () => {
      mockGetCareTeamDashboard.mockRejectedValue(new Error('Unexpected error'));

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Unexpected error')).toBeInTheDocument();
      });
    });
  });

  describe('Header', () => {
    it('should render dashboard title', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Discharged Patient Monitoring')).toBeInTheDocument();
      });
    });

    it('should render description text', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(
          screen.getByText('Real-time wellness tracking and readmission risk management')
        ).toBeInTheDocument();
      });
    });

    it('should render refresh button', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Refresh/)).toBeInTheDocument();
      });
    });

    it('should call loadDashboard when refresh button is clicked', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Refresh/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Refresh/));

      expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(2);
    });
  });

  describe('Metrics Cards', () => {
    it('should display total discharged patients', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('45')).toBeInTheDocument();
        expect(screen.getByText('Total Discharged (90 days)')).toBeInTheDocument();
      });
    });

    it('should display enrollment rate', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('84%')).toBeInTheDocument();
        expect(screen.getByText('Wellness Enrollment Rate')).toBeInTheDocument();
        expect(screen.getByText('38 of 45 enrolled')).toBeInTheDocument();
      });
    });

    it('should display patients needing attention', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Need Attention')).toBeInTheDocument();
        expect(screen.getByText('2 critical alerts')).toBeInTheDocument();
      });
    });

    it('should display average check-in adherence', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('78%')).toBeInTheDocument();
        expect(screen.getByText('Avg Check-In Adherence')).toBeInTheDocument();
        expect(screen.getByText('Risk Score Avg: 42')).toBeInTheDocument();
      });
    });
  });

  describe('Filters', () => {
    it('should render filter checkboxes', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Filter by:')).toBeInTheDocument();
        expect(screen.getByLabelText(/Needs Attention Only/)).toBeInTheDocument();
        expect(screen.getByLabelText(/High Risk Only/)).toBeInTheDocument();
      });
    });

    it('should apply needs attention filter when checked', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/Needs Attention Only/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText(/Needs Attention Only/));

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledWith(
          expect.objectContaining({
            needs_attention_only: true,
          })
        );
      });
    });

    it('should apply high risk filter when checked', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/High Risk Only/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText(/High Risk Only/));

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledWith(
          expect.objectContaining({
            high_risk_only: true,
          })
        );
      });
    });
  });

  describe('Patient List', () => {
    it('should render patient list table headers', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Patient')).toBeInTheDocument();
        expect(screen.getByText('Discharge Date')).toBeInTheDocument();
        expect(screen.getByText('Diagnosis')).toBeInTheDocument();
        expect(screen.getByText('Risk Level')).toBeInTheDocument();
        expect(screen.getByText('Check-In Adherence')).toBeInTheDocument();
        expect(screen.getByText('Last Check-In')).toBeInTheDocument();
        expect(screen.getByText('Mood Trend')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should display patient count in header', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Patients (1)')).toBeInTheDocument();
      });
    });

    it('should display patient name and info', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('Heart Failure')).toBeInTheDocument();
      });
    });

    it('should display risk level badge', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('HIGH')).toBeInTheDocument();
        expect(screen.getByText('Score: 65')).toBeInTheDocument();
      });
    });

    it('should display check-in adherence progress bar', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('80%')).toBeInTheDocument();
        expect(screen.getByText('8 of 10')).toBeInTheDocument();
      });
    });

    it('should display mood trend', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Stable/)).toBeInTheDocument();
      });
    });

    it('should show "NEEDS ATTENTION" status for flagged patients', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/NEEDS ATTENTION/)).toBeInTheDocument();
        expect(screen.getByText('Weight gain detected')).toBeInTheDocument();
      });
    });

    it('should show "View Details" button', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });
    });

    it('should show empty state when no patients match filters', async () => {
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('No discharged patients match your filters')).toBeInTheDocument();
      });
    });

    it('should show "Not enrolled" text for unenrolled patients', async () => {
      const unenrolledPatient = {
        ...mockPatientSummary,
        wellness_enrolled: false,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [unenrolledPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Not enrolled')).toBeInTheDocument();
      });
    });

    it('should show "Never" for patients without check-ins', async () => {
      const noCheckInPatient = {
        ...mockPatientSummary,
        last_check_in_date: undefined,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [noCheckInPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Never')).toBeInTheDocument();
      });
    });

    it('should apply red background for patients needing attention', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const row = screen.getByText('John Smith').closest('tr');
        expect(row).toHaveClass('bg-red-50');
      });
    });

    it('should show active alerts count', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('1 active alert')).toBeInTheDocument();
      });
    });
  });

  describe('Patient Detail Modal', () => {
    it('should open modal when View Details is clicked', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      expect(screen.getByRole('heading', { name: 'John Smith' })).toBeInTheDocument();
    });

    it('should display discharge information in modal', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      // Get modal by heading
      const modal = screen.getByRole('heading', { name: 'John Smith' }).closest('div[class*="fixed"]');
      expect(modal).toBeInTheDocument();

      // Check for discharge information section - use getAllByText for elements that might appear multiple times
      const dischargeInfoElements = screen.getAllByText('Discharge Information');
      expect(dischargeInfoElements.length).toBeGreaterThan(0);
    });

    it('should display check-in activity in modal', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      expect(screen.getByText('Check-In Activity')).toBeInTheDocument();
      expect(screen.getByText('Adherence Rate')).toBeInTheDocument();
      expect(screen.getByText('8 of 10 completed')).toBeInTheDocument();
    });

    it('should display warning signs in modal', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      // Use getAllByText since warning signs might appear in multiple places
      const warningSigns = screen.getAllByText('Warning Signs Detected');
      expect(warningSigns.length).toBeGreaterThan(0);
      // Warning signs data should be present
      const fatigueElements = screen.getAllByText(/Increased fatigue/);
      expect(fatigueElements.length).toBeGreaterThan(0);
    });

    it('should display mental health screening scores', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      expect(screen.getByText('Mental Health Screening')).toBeInTheDocument();
      expect(screen.getByText('PHQ-9 (Depression)')).toBeInTheDocument();
      expect(screen.getByText('GAD-7 (Anxiety)')).toBeInTheDocument();
    });

    it('should display wellness trends', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      // Wellness Trends section exists (may appear in modal and table)
      const wellnessTrendsElements = screen.getAllByText('Wellness Trends');
      expect(wellnessTrendsElements.length).toBeGreaterThan(0);
      // Mood Trend appears in both table and modal
      const moodTrendElements = screen.getAllByText('Mood Trend');
      expect(moodTrendElements.length).toBeGreaterThan(0);
    });

    it('should display action buttons in modal', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      expect(screen.getByText(/Call Patient/)).toBeInTheDocument();
      expect(screen.getByText(/Send Message/)).toBeInTheDocument();
      expect(screen.getByText(/View Full Chart/)).toBeInTheDocument();
    });

    it('should close modal when X button is clicked', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));
      expect(screen.getByRole('heading', { name: 'John Smith' })).toBeInTheDocument();

      // Find and click close button
      const closeButton = screen.getByText('×');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'John Smith' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Risk Level Colors', () => {
    it('should apply red color for very high risk', async () => {
      const veryHighRiskPatient = {
        ...mockPatientSummary,
        readmission_risk_category: 'very_high' as const,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [veryHighRiskPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const badge = screen.getByText('VERY_HIGH');
        expect(badge).toHaveClass('bg-red-100', 'text-red-800');
      });
    });

    it('should apply orange color for high risk', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const badge = screen.getByText('HIGH');
        expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
      });
    });

    it('should apply green color for low risk', async () => {
      const lowRiskPatient = {
        ...mockPatientSummary,
        readmission_risk_category: 'low' as const,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [lowRiskPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const badge = screen.getByText('LOW');
        expect(badge).toHaveClass('bg-green-100', 'text-green-800');
      });
    });
  });

  describe('Mood Trend Icons', () => {
    it('should display improving icon for improving trend', async () => {
      const improvingPatient = {
        ...mockPatientSummary,
        mood_trend: 'improving' as const,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [improvingPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/📈 Improving/)).toBeInTheDocument();
      });
    });

    it('should display declining icon for declining trend', async () => {
      const decliningPatient = {
        ...mockPatientSummary,
        mood_trend: 'declining' as const,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [decliningPatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText(/📉 Declining/)).toBeInTheDocument();
      });
    });
  });

  describe('Auto Refresh', () => {
    it('should set up auto refresh interval when enabled', async () => {
      render(<DischargedPatientDashboard autoRefresh={true} refreshIntervalSeconds={5} />);

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(1);
      });

      // Advance timer by 5 seconds
      vi.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(2);
      });
    });

    it('should not auto refresh when disabled', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(1);
      });

      // Advance timer
      vi.advanceTimersByTime(10000);

      // Should still be 1 call
      expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(1);
    });

    it('should clean up interval on unmount', async () => {
      const { unmount } = render(
        <DischargedPatientDashboard autoRefresh={true} refreshIntervalSeconds={5} />
      );

      await waitFor(() => {
        expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance timer after unmount
      vi.advanceTimersByTime(5000);

      // Should still be 1 call (no more after unmount)
      expect(mockGetCareTeamDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('Adherence Progress Bar Colors', () => {
    it('should show green progress bar for high adherence (>=80%)', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-green-600');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should show yellow progress bar for medium adherence (50-79%)', async () => {
      const mediumAdherencePatient = {
        ...mockPatientSummary,
        check_in_adherence_percentage: 60,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [mediumAdherencePatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-yellow-500');
        expect(progressBar).toBeInTheDocument();
      });
    });

    it('should show red progress bar for low adherence (<50%)', async () => {
      const lowAdherencePatient = {
        ...mockPatientSummary,
        check_in_adherence_percentage: 30,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [lowAdherencePatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const progressBar = document.querySelector('.bg-red-500');
        expect(progressBar).toBeInTheDocument();
      });
    });
  });

  describe('Mental Health Severity Display', () => {
    it('should show severity levels for PHQ-9 scores', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      // PHQ-9 score of 5 should show "Mild"
      expect(screen.getByText('Mild')).toBeInTheDocument();
    });

    it('should handle severe PHQ-9 scores', async () => {
      const severePatient = {
        ...mockPatientSummary,
        phq9_score_latest: 18,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [severePatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('View Details'));

      expect(screen.getByText('Severe')).toBeInTheDocument();
    });
  });

  describe('Days Since Discharge Display', () => {
    it('should show "Today" for same-day check-ins', async () => {
      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      });
    });

    it('should show day count with red styling for overdue check-ins', async () => {
      const overduePatient = {
        ...mockPatientSummary,
        days_since_last_check_in: 5,
      };
      mockGetCareTeamDashboard.mockResolvedValue({
        success: true,
        data: { ...mockMetrics, patients_list: [overduePatient] },
      });

      render(<DischargedPatientDashboard autoRefresh={false} />);

      await waitFor(() => {
        const dayText = screen.getByText('5 days ago');
        expect(dayText).toHaveClass('text-red-600', 'font-semibold');
      });
    });
  });
});
