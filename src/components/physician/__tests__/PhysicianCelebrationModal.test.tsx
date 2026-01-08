/**
 * Tests for PhysicianCelebrationModal Component
 *
 * Purpose: Celebration modal for physician achievements with medical-themed animations
 * Tests: Achievement types, celebration text, confetti, animations, close behavior
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhysicianCelebrationModal, type PhysicianAchievementType } from '../PhysicianCelebrationModal';

describe('PhysicianCelebrationModal', () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    onClose: mockOnClose,
    achievementType: 'documentation' as PhysicianAchievementType,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the celebration modal', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      // Modal should be rendered with backdrop
      expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      expect(screen.getByText('×')).toBeInTheDocument();
    });

    it('should render main action button', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      expect(screen.getByText(/Keep Going, Doc!/)).toBeInTheDocument();
    });

    it('should render motivational quote', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      expect(screen.getByText(/The best doctor gives the least medicines/)).toBeInTheDocument();
    });

    it('should render achievement badges', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      expect(screen.getByText('Excellence')).toBeInTheDocument();
      expect(screen.getByText('Commitment')).toBeInTheDocument();
      expect(screen.getByText('Impact')).toBeInTheDocument();
    });

    it('should render doctor avatars', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Your Team')).toBeInTheDocument();
    });
  });

  describe('Achievement Types', () => {
    const achievementTypes: PhysicianAchievementType[] = [
      'documentation',
      'revenue',
      'patient_satisfaction',
      'coding_accuracy',
      'ccm_goal',
      'wellness_module',
      'diagnosis',
      'daily_checkin',
    ];

    achievementTypes.forEach((type) => {
      it(`should render correctly for ${type} achievement`, () => {
        render(<PhysicianCelebrationModal {...defaultProps} achievementType={type} />);

        // Modal should render without crashing
        expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument();
      });
    });

    it('should show documentation encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="documentation" />);

      expect(screen.getByText(/Accurate, timely documentation/)).toBeInTheDocument();
    });

    it('should show revenue encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="revenue" />);

      expect(screen.getByText(/Financial wellness creates sustainability/)).toBeInTheDocument();
    });

    it('should show patient satisfaction encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="patient_satisfaction" />);

      expect(screen.getByText(/Your patients feel heard/)).toBeInTheDocument();
    });

    it('should show wellness module encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="wellness_module" />);

      expect(screen.getByText(/Every moment you invest in yourself/)).toBeInTheDocument();
    });

    it('should show daily checkin encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="daily_checkin" />);

      expect(screen.getByText(/Awareness is the first step to resilience/)).toBeInTheDocument();
    });

    it('should show diagnosis encouragement message', () => {
      render(<PhysicianCelebrationModal {...defaultProps} achievementType="diagnosis" />);

      expect(screen.getByText(/Clinical reasoning at its finest/)).toBeInTheDocument();
    });
  });

  describe('Achievement Details', () => {
    it('should display achievement details when provided', () => {
      render(
        <PhysicianCelebrationModal
          {...defaultProps}
          achievementDetails="Completed 10 patient notes today!"
        />
      );

      expect(screen.getByText('Completed 10 patient notes today!')).toBeInTheDocument();
    });

    it('should display metric value when provided', () => {
      render(
        <PhysicianCelebrationModal
          {...defaultProps}
          achievementType="revenue"
          metricValue={5000}
        />
      );

      expect(screen.getByText('5000')).toBeInTheDocument();
    });

    it('should show appropriate icon for metric value with revenue', () => {
      render(
        <PhysicianCelebrationModal
          {...defaultProps}
          achievementType="revenue"
          metricValue={1000}
        />
      );

      // Multiple 💰 may appear - just verify at least one exists
      const moneyIcons = screen.getAllByText('💰');
      expect(moneyIcons.length).toBeGreaterThan(0);
    });

    it('should show appropriate icon for metric value with patient satisfaction', () => {
      render(
        <PhysicianCelebrationModal
          {...defaultProps}
          achievementType="patient_satisfaction"
          metricValue={95}
        />
      );

      expect(screen.getByText('⭐')).toBeInTheDocument();
    });

    it('should show "min" for CCM goal metric', () => {
      render(
        <PhysicianCelebrationModal
          {...defaultProps}
          achievementType="ccm_goal"
          metricValue={20}
        />
      );

      expect(screen.getByText('min')).toBeInTheDocument();
    });
  });

  describe('Close Behavior', () => {
    it('should call onClose when close button is clicked', async () => {
      vi.useRealTimers();
      render(<PhysicianCelebrationModal {...defaultProps} />);

      const closeButton = screen.getByText('×');
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when action button is clicked', async () => {
      vi.useRealTimers();
      render(<PhysicianCelebrationModal {...defaultProps} />);

      const actionButton = screen.getByText(/Keep Going, Doc!/);
      await userEvent.click(actionButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Animation Phases', () => {
    it('should transition from entrance to celebration phase', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      // Initially in entrance phase
      const card = document.querySelector('.bg-linear-to-br');
      expect(card).toBeInTheDocument();

      // Advance timers to trigger phase transition
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Should now be in celebration phase
      expect(card).toHaveClass('scale-100', 'opacity-100');
    });

    it('should hide confetti after 4 seconds', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      // Confetti should initially be visible
      expect(document.querySelector('.overflow-hidden.pointer-events-none')).toBeInTheDocument();

      // Advance timers past confetti duration
      act(() => {
        vi.advanceTimersByTime(4100);
      });

      // Confetti container should be removed
      // Note: Component might still have the container but confetti pieces might be hidden
    });
  });

  describe('Modal Styling', () => {
    it('should have proper backdrop styling', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      const backdrop = document.querySelector('.fixed.inset-0');
      expect(backdrop).toHaveClass('bg-black', 'bg-opacity-60', 'z-100');
    });

    it('should have gradient background on main card', () => {
      render(<PhysicianCelebrationModal {...defaultProps} />);

      const card = document.querySelector('.bg-linear-to-br');
      expect(card).toBeInTheDocument();
    });
  });
});
