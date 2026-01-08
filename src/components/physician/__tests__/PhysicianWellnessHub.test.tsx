/**
 * Tests for PhysicianWellnessHub Component
 *
 * Purpose: Wellness dashboard for physicians with burnout prevention features
 * Tests: Loading, stats display, risk badge, check-in prompt, modals
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhysicianWellnessHub } from '../PhysicianWellnessHub';
import type { ResilienceHubDashboardStats, ProviderDailyCheckin } from '../../../types/nurseos';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useUser: vi.fn(() => ({ id: 'user-123', email: 'doctor@hospital.com' })),
}));

// Mock resilienceHubService
const mockGetDashboardStats = vi.fn();
const mockGetMyCheckins = vi.fn();

vi.mock('../../../services/resilienceHubService', () => ({
  getDashboardStats: () => mockGetDashboardStats(),
  getMyCheckins: (startDate: string, endDate: string) => mockGetMyCheckins(startDate, endDate),
}));

// Mock child components to avoid deep dependency chains
vi.mock('../PhysicianDailyCheckin', () => ({
  default: ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => (
    <div data-testid="mock-daily-checkin">
      <button onClick={onSuccess}>Mock Submit</button>
      <button onClick={onClose}>Mock Close</button>
    </div>
  ),
}));

vi.mock('../../nurseos/BurnoutAssessmentForm', () => ({
  default: ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => (
    <div data-testid="mock-burnout-form">
      <button onClick={onSuccess}>Mock Complete</button>
      <button onClick={onClose}>Mock Cancel</button>
    </div>
  ),
}));

vi.mock('../../nurseos/ResilienceLibrary', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mock-resilience-library">
      <button onClick={onClose}>Mock Close Library</button>
    </div>
  ),
}));

vi.mock('../../nurseos/ResourceLibrary', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mock-resource-library">
      <button onClick={onClose}>Mock Close Resources</button>
    </div>
  ),
}));

vi.mock('../PhysicianCelebrationModal', () => ({
  PhysicianCelebrationModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="mock-celebration">
      <button onClick={onClose}>Mock Close Celebration</button>
    </div>
  ),
}));

const sampleStats: ResilienceHubDashboardStats = {
  current_burnout_risk: 'moderate' as const,
  avg_stress_7_days: 5.5,
  stress_trend: 'improving' as const,
  has_checked_in_today: false,
  modules_completed: 3,
  modules_in_progress: 1,
  my_support_circles: 2,
  intervention_needed: false,
};

const sampleCheckins: ProviderDailyCheckin[] = [
  {
    id: 'checkin-1',
    provider_id: 'user-123',
    checkin_date: new Date().toISOString(),
    stress_level: 5,
    energy_level: 6,
    mood_rating: 7,
    work_setting: 'office',
    product_line: 'clarity',
    created_at: new Date().toISOString(),
  },
  {
    id: 'checkin-2',
    provider_id: 'user-123',
    checkin_date: new Date(Date.now() - 86400000).toISOString(),
    stress_level: 6,
    energy_level: 5,
    mood_rating: 6,
    work_setting: 'telehealth',
    product_line: 'clarity',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

describe('PhysicianWellnessHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboardStats.mockResolvedValue(sampleStats);
    mockGetMyCheckins.mockResolvedValue(sampleCheckins);
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      mockGetDashboardStats.mockImplementation(() => new Promise(() => {}));
      const { container } = render(<PhysicianWellnessHub />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should render wellness hub header', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText(/Physician Wellness Hub/)).toBeInTheDocument();
      });
    });

    it('should render tagline', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText(/healing starts with the healer/)).toBeInTheDocument();
      });
    });
  });

  describe('Burnout Risk Badge', () => {
    it('should display risk badge', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Moderate Risk')).toBeInTheDocument();
      });
    });

    it('should display risk message', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Consider increasing self-care activities.')).toBeInTheDocument();
      });
    });

    it('should display low risk styling', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, current_burnout_risk: 'low' });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Low Risk')).toBeInTheDocument();
      });
    });

    it('should display high risk styling', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, current_burnout_risk: 'high' });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('High Risk')).toBeInTheDocument();
      });
    });

    it('should display critical risk styling', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, current_burnout_risk: 'critical' });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Critical Risk')).toBeInTheDocument();
      });
    });

    it('should show assessment button for unknown risk', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, current_burnout_risk: 'unknown' });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Take Assessment Now (5 min)')).toBeInTheDocument();
      });
    });
  });

  describe('Intervention Alert', () => {
    it('should show intervention alert when needed', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, intervention_needed: true });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Wellness Check Recommended')).toBeInTheDocument();
      });
    });

    it('should show 988 lifeline button in alert', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, intervention_needed: true });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Call 988 Lifeline')).toBeInTheDocument();
      });
    });

    it('should not show intervention alert when not needed', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText(/Physician Wellness Hub/)).toBeInTheDocument();
      });

      expect(screen.queryByText('Wellness Check Recommended')).not.toBeInTheDocument();
    });
  });

  describe('Daily Check-In Prompt', () => {
    it('should show check-in prompt when not checked in today', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText("Haven't checked in today?")).toBeInTheDocument();
      });
    });

    it('should show quick check-in button', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Quick Check-In')).toBeInTheDocument();
      });
    });

    it('should not show prompt when already checked in', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, has_checked_in_today: true });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText(/Physician Wellness Hub/)).toBeInTheDocument();
      });

      expect(screen.queryByText("Haven't checked in today?")).not.toBeInTheDocument();
    });
  });

  describe('Stats Grid', () => {
    it('should display stress trend', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Stress Trend (7 days)')).toBeInTheDocument();
        expect(screen.getByText('5.5')).toBeInTheDocument();
      });
    });

    it('should display improving trend icon', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('📉 Improving')).toBeInTheDocument();
      });
    });

    it('should display worsening trend icon', async () => {
      mockGetDashboardStats.mockResolvedValue({ ...sampleStats, stress_trend: 'worsening' });

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('📈 Increasing')).toBeInTheDocument();
      });
    });

    it('should display modules completed', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        // Multiple "Wellness Modules" texts exist - one in stats, one in quick actions
        const allWellnessModules = screen.getAllByText('Wellness Modules');
        expect(allWellnessModules.length).toBeGreaterThan(0);
      });

      // Check for "completed" text which indicates the stats section
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('should display modules in progress', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('1 in progress')).toBeInTheDocument();
      });
    });

    it('should display support circles', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Peer Support')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should render quick actions section', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      });
    });

    it('should render daily check-in button', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Daily Check-In')).toBeInTheDocument();
      });
    });

    it('should render burnout assessment button', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Burnout Assessment')).toBeInTheDocument();
      });
    });

    it('should render wellness modules button', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        // Multiple "Wellness Modules" texts exist - one in stats, one in quick actions
        const allWellnessModules = screen.getAllByText('Wellness Modules');
        expect(allWellnessModules.length).toBeGreaterThan(0);
      });
    });

    it('should render resource library button', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Resource Library')).toBeInTheDocument();
      });
    });
  });

  describe('Recent Check-Ins', () => {
    it('should display recent check-ins section', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Recent Check-Ins (Last 7 Days)')).toBeInTheDocument();
      });
    });

    it('should display check-in entries', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        // Should show stress/energy/mood for checkins
        expect(screen.getAllByText(/Stress:/).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Modal Interactions', () => {
    it('should open check-in modal when quick check-in clicked', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Quick Check-In')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Quick Check-In'));

      expect(screen.getByTestId('mock-daily-checkin')).toBeInTheDocument();
    });

    it('should open burnout assessment modal', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Burnout Assessment')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Burnout Assessment'));

      expect(screen.getByTestId('mock-burnout-form')).toBeInTheDocument();
    });

    it('should open wellness modules library', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        // Multiple "Wellness Modules" texts - find the button in quick actions
        const allWellnessModules = screen.getAllByText('Wellness Modules');
        expect(allWellnessModules.length).toBeGreaterThan(0);
      });

      // Find the button in quick actions (the one with Evidence-based subtitle)
      const quickActionButton = screen.getByText('Evidence-based').closest('button') as HTMLElement;
      await userEvent.click(quickActionButton);

      expect(screen.getByTestId('mock-resilience-library')).toBeInTheDocument();
    });

    it('should open resource library', async () => {
      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Resource Library')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText('Resource Library'));

      expect(screen.getByTestId('mock-resource-library')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when loading fails', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Failed to load'));

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load Wellness Hub')).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      mockGetDashboardStats.mockRejectedValue(new Error('Failed to load'));

      render(<PhysicianWellnessHub />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button clicked', async () => {
      // Make it fail persistently
      mockGetDashboardStats.mockRejectedValue(new Error('Failed to load'));
      mockGetMyCheckins.mockResolvedValue([]);

      render(<PhysicianWellnessHub />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      // Record initial call count
      const initialCallCount = mockGetDashboardStats.mock.calls.length;

      // Click retry
      await userEvent.click(screen.getByText('Retry'));

      // Should have called getDashboardStats again
      await waitFor(() => {
        expect(mockGetDashboardStats.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });
});
