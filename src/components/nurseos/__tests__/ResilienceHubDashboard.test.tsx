// ============================================================================
// ResilienceHubDashboard — P0-4 Tests
// ============================================================================
// Tests dashboard stat rendering, intervention alert display, check-in prompt
// visibility, risk badge colors, loading/error states, and quick actions.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ResilienceHubDashboard } from '../ResilienceHubDashboard';
import type { ResilienceHubDashboardStats } from '../../../types/nurseos';

// Mock dependencies
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'test-user-123', email: 'nurse.alpha@test.com' }),
}));

vi.mock('../../../services/resilienceHubService', () => ({
  getDashboardStats: vi.fn(),
  getMyCheckins: vi.fn(),
  submitDailyCheckin: vi.fn(),
  submitBurnoutAssessment: vi.fn(),
  getActiveModules: vi.fn(),
  trackModuleStart: vi.fn(),
  trackModuleCompletion: vi.fn(),
  getMyCompletions: vi.fn(),
  getResources: vi.fn(),
  trackResourceView: vi.fn(),
}));

vi.mock('../../../components/shared/PersonalizedGreeting', () => ({
  default: () => <div data-testid="personalized-greeting">Hello!</div>,
}));

import { getDashboardStats, getMyCheckins } from '../../../services/resilienceHubService';
const mockGetStats = vi.mocked(getDashboardStats);
const mockGetCheckins = vi.mocked(getMyCheckins);

// ============================================================================
// TEST DATA
// ============================================================================

const lowRiskStats: ResilienceHubDashboardStats = {
  current_burnout_risk: 'low',
  has_checked_in_today: true,
  check_in_streak_days: 5,
  modules_completed: 3,
  modules_in_progress: 1,
  avg_stress_7_days: 3.2,
  stress_trend: 'improving',
  my_support_circles: 2,
  intervention_needed: false,
};

const recentCheckins = [
  {
    id: 'checkin-1',
    practitioner_id: 'prac-1',
    user_id: 'test-user-123',
    checkin_date: '2026-03-19',
    work_setting: 'remote' as const,
    product_line: 'clarity' as const,
    stress_level: 4,
    energy_level: 6,
    mood_rating: 7,
    created_at: '2026-03-19T10:00:00Z',
  },
  {
    id: 'checkin-2',
    practitioner_id: 'prac-1',
    user_id: 'test-user-123',
    checkin_date: '2026-03-18',
    work_setting: 'office' as const,
    product_line: 'clarity' as const,
    stress_level: 7,
    energy_level: 3,
    mood_rating: 4,
    created_at: '2026-03-18T10:00:00Z',
  },
];

// Helper: render and wait for loading to finish
const renderAndWait = async (statsOverride?: Partial<ResilienceHubDashboardStats>, checkinsOverride?: typeof recentCheckins) => {
  if (statsOverride) {
    mockGetStats.mockResolvedValue({ ...lowRiskStats, ...statsOverride } as ResilienceHubDashboardStats);
  }
  if (checkinsOverride !== undefined) {
    mockGetCheckins.mockResolvedValue({ success: true, data: checkinsOverride, error: null } as never);
  }
  render(<ResilienceHubDashboard />);
  // Wait for dashboard to finish loading by looking for a known element
  await waitFor(() => {
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });
};

// ============================================================================
// TESTS
// ============================================================================

describe('ResilienceHubDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetStats.mockResolvedValue(lowRiskStats);
    mockGetCheckins.mockResolvedValue({ success: true, data: recentCheckins, error: null } as never);
  });

  // ========================================================================
  // LOADING STATE
  // ========================================================================

  describe('Loading State', () => {
    it('shows loading skeleton while fetching data', () => {
      mockGetStats.mockImplementation(() => new Promise(() => {}));
      mockGetCheckins.mockImplementation(() => new Promise(() => {}));
      render(<ResilienceHubDashboard />);
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // ERROR STATE
  // ========================================================================

  describe('Error State', () => {
    it('shows error message when data fetch fails', async () => {
      mockGetStats.mockRejectedValue(new Error('Database unreachable'));
      mockGetCheckins.mockResolvedValue({ success: true, data: [], error: null } as never);

      render(<ResilienceHubDashboard />);

      expect(await screen.findByText('Failed to load Resilience Hub')).toBeInTheDocument();
      expect(screen.getByText('Database unreachable')).toBeInTheDocument();
    });

    it('shows generic error for non-Error thrown', async () => {
      mockGetStats.mockRejectedValue('unknown failure');
      mockGetCheckins.mockResolvedValue({ success: true, data: [], error: null } as never);

      render(<ResilienceHubDashboard />);

      expect(await screen.findByText('Failed to load dashboard')).toBeInTheDocument();
    });

    it('shows Retry button on error', async () => {
      mockGetStats.mockRejectedValue(new Error('Timeout'));
      mockGetCheckins.mockResolvedValue({ success: true, data: [], error: null } as never);

      render(<ResilienceHubDashboard />);

      expect(await screen.findByText('Retry')).toBeInTheDocument();
    });

    it('calls getDashboardStats again when Retry is clicked', async () => {
      mockGetStats.mockRejectedValue(new Error('Timeout'));
      mockGetCheckins.mockResolvedValue({ success: true, data: [], error: null } as never);

      render(<ResilienceHubDashboard />);
      await screen.findByText('Retry');

      const callCountBefore = mockGetStats.mock.calls.length;
      fireEvent.click(screen.getByText('Retry'));

      // Wait for the retry call to be made
      await waitFor(() => {
        expect(mockGetStats.mock.calls.length).toBeGreaterThan(callCountBefore);
      });
    });
  });

  // ========================================================================
  // DASHBOARD STATS RENDERING
  // ========================================================================

  describe('Stats Grid', () => {
    it('displays 7-day average stress score', async () => {
      await renderAndWait();
      expect(screen.getByText('3.2')).toBeInTheDocument();
    });

    it('displays stress trend as improving', async () => {
      await renderAndWait();
      expect(screen.getByText(/Improving/)).toBeInTheDocument();
    });

    it('displays worsening stress trend', async () => {
      await renderAndWait({ stress_trend: 'worsening' });
      expect(screen.getByText(/Increasing/)).toBeInTheDocument();
    });

    it('displays modules completed count', async () => {
      await renderAndWait();
      // modules_completed is 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays support circles count', async () => {
      await renderAndWait();
      // my_support_circles is 2
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows "N/A" when no stress data is available', async () => {
      await renderAndWait({ avg_stress_7_days: null });
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // RISK BADGE
  // ========================================================================

  describe('Risk Badge', () => {
    it('displays Low Risk badge with green styling', async () => {
      await renderAndWait();
      const badge = screen.getByText('Low Risk');
      expect(badge.className).toContain('bg-green-500');
    });

    it('displays Critical Risk badge with red styling', async () => {
      await renderAndWait({ current_burnout_risk: 'critical' });
      const badge = screen.getByText('Critical Risk');
      expect(badge.className).toContain('bg-red-600');
    });

    it('displays High Risk badge with orange styling', async () => {
      await renderAndWait({ current_burnout_risk: 'high' });
      const badge = screen.getByText('High Risk');
      expect(badge.className).toContain('bg-orange-500');
    });

    it('displays Moderate Risk badge with yellow styling', async () => {
      await renderAndWait({ current_burnout_risk: 'moderate' });
      const badge = screen.getByText('Moderate Risk');
      expect(badge.className).toContain('bg-yellow-500');
    });

    it('shows Take Assessment button when risk is unknown', async () => {
      await renderAndWait({ current_burnout_risk: 'unknown' as never });
      expect(screen.getByText(/Take Assessment Now/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // INTERVENTION ALERT
  // ========================================================================

  describe('Intervention Alert', () => {
    it('shows 988 crisis link when intervention_needed is true', async () => {
      await renderAndWait({ intervention_needed: true });
      const link = screen.getByRole('link', { name: /988/ });
      expect(link).toHaveAttribute('href', 'tel:988');
    });

    it('does not show 988 link when intervention_needed is false', async () => {
      await renderAndWait();
      expect(screen.queryByRole('link', { name: /988/ })).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // DAILY CHECK-IN PROMPT
  // ========================================================================

  describe('Daily Check-In Prompt', () => {
    it('shows check-in prompt when has_checked_in_today is false', async () => {
      await renderAndWait({ has_checked_in_today: false });
      expect(screen.getByText(/checked in today/i)).toBeInTheDocument();
    });

    it('does not show check-in prompt when already checked in', async () => {
      await renderAndWait({ has_checked_in_today: true });
      expect(screen.queryByText(/checked in today/i)).not.toBeInTheDocument();
    });

    it('opens check-in modal when prompt button is clicked', async () => {
      await renderAndWait({ has_checked_in_today: false });

      // Find the prominent check-in button in the prompt box (has bg-blue-600)
      const allButtons = screen.getAllByRole('button');
      const promptButton = allButtons.find(
        (btn) => btn.className.includes('bg-blue-600') && btn.className.includes('shadow-md')
      );
      expect(promptButton).toBeDefined();
      if (promptButton) fireEvent.click(promptButton);

      expect(await screen.findByText('Daily Emotional Check-In')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // RECENT CHECK-INS
  // ========================================================================

  describe('Recent Check-Ins', () => {
    it('displays recent check-in entries with stress indicators', async () => {
      await renderAndWait();
      // checkin-1 stress=4 → green, checkin-2 stress=7 → red
      expect(screen.getByText('🟢')).toBeInTheDocument();
      expect(screen.getByText('🔴')).toBeInTheDocument();
    });

    it('shows stress/energy/mood values for each check-in', async () => {
      await renderAndWait();
      // Checkin-1: Stress: 4/10 | Energy: 6/10 | Mood: 7/10
      expect(screen.getByText(/Stress: 4\/10/)).toBeInTheDocument();
      expect(screen.getByText(/Stress: 7\/10/)).toBeInTheDocument();
    });

    it('shows recent check-ins heading when checkins exist', async () => {
      await renderAndWait();
      expect(screen.getByText('Recent Check-Ins (Last 7 Days)')).toBeInTheDocument();
    });

    it('does not render recent check-ins section when none exist', async () => {
      await renderAndWait(undefined, []);
      expect(screen.queryByText('Recent Check-Ins (Last 7 Days)')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // QUICK ACTIONS
  // ========================================================================

  describe('Quick Actions', () => {
    it('renders all 5 quick action buttons with icons', async () => {
      await renderAndWait();
      expect(screen.getByText('📝')).toBeInTheDocument();
      expect(screen.getByText('🔍')).toBeInTheDocument();
      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('🎓')).toBeInTheDocument();
      expect(screen.getByText('📚')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // PERSONALIZED GREETING
  // ========================================================================

  describe('Personalized Greeting', () => {
    it('renders the personalized greeting component', async () => {
      await renderAndWait();
      expect(screen.getByTestId('personalized-greeting')).toBeInTheDocument();
    });
  });
});
