/**
 * Tests for HandoffCelebration Component
 *
 * Purpose: Celebratory modal shown after successful shift handoff
 * Tests: Rendering, animations, auto-close, bypass notice, time savings display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HandoffCelebration } from '../HandoffCelebration';

describe('HandoffCelebration', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render the celebration modal', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('Handoff Accepted!')).toBeInTheDocument();
    });

    it('should render the celebration emoji', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('🎉')).toBeInTheDocument();
    });

    it('should render dancing healthcare workers', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('Dr. Maria')).toBeInTheDocument();
      expect(screen.getByText('Nurse Alex')).toBeInTheDocument();
      expect(screen.getByText('PA Jordan')).toBeInTheDocument();
    });

    it('should render success message', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText(/Great job!/)).toBeInTheDocument();
      expect(screen.getByText(/Your handoff was complete and thorough/)).toBeInTheDocument();
    });

    it('should render stats grid', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('All Reviewed')).toBeInTheDocument();
      expect(screen.getByText('Patients')).toBeInTheDocument();
      expect(screen.getByText('AI Assisted')).toBeInTheDocument();
      expect(screen.getByText('Care Transferred')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText(/Close/)).toBeInTheDocument();
    });
  });

  describe('Nurse Acceptance Display', () => {
    it('should display nurse name when provided', () => {
      render(
        <HandoffCelebration onClose={mockOnClose} nurseWhoAccepted="Sarah Johnson" />
      );

      expect(screen.getByText('Sarah Johnson received the handoff')).toBeInTheDocument();
    });

    it('should display generic message when nurse name not provided', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('Successfully transferred care')).toBeInTheDocument();
    });
  });

  describe('Bypass Notice', () => {
    it('should not show bypass notice when bypassUsed is false', () => {
      render(<HandoffCelebration onClose={mockOnClose} bypassUsed={false} />);

      expect(screen.queryByText('Emergency Override Was Used')).not.toBeInTheDocument();
    });

    it('should show bypass notice when bypassUsed is true', () => {
      render(
        <HandoffCelebration onClose={mockOnClose} bypassUsed={true} bypassNumber={1} />
      );

      expect(screen.getByText('Emergency Override Was Used')).toBeInTheDocument();
    });

    it('should show warning style for bypass 1-2', () => {
      render(
        <HandoffCelebration onClose={mockOnClose} bypassUsed={true} bypassNumber={1} />
      );

      expect(screen.getByText('⚠️')).toBeInTheDocument();
      expect(screen.getByText(/Bypass #1 of 3 allowed per week/)).toBeInTheDocument();
    });

    it('should show critical style for bypass 3+', () => {
      render(
        <HandoffCelebration onClose={mockOnClose} bypassUsed={true} bypassNumber={3} />
      );

      expect(screen.getByText('🚨')).toBeInTheDocument();
      expect(screen.getByText(/Your manager has been notified/)).toBeInTheDocument();
    });

    it('should indicate bypass has been logged', () => {
      render(
        <HandoffCelebration onClose={mockOnClose} bypassUsed={true} bypassNumber={2} />
      );

      expect(screen.getByText(/This bypass has been logged for review/)).toBeInTheDocument();
    });
  });

  describe('Time Savings Display', () => {
    it('should not show time savings when not provided', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.queryByText(/min saved/)).not.toBeInTheDocument();
    });

    it('should show time savings when provided', () => {
      render(
        <HandoffCelebration
          onClose={mockOnClose}
          timeSavedMinutes={15}
          efficiencyPercent={50}
        />
      );

      expect(screen.getByText('15 min saved')).toBeInTheDocument();
    });

    it('should show efficiency percentage', () => {
      render(
        <HandoffCelebration
          onClose={mockOnClose}
          timeSavedMinutes={15}
          efficiencyPercent={50}
        />
      );

      expect(screen.getByText(/50% faster than average/)).toBeInTheDocument();
    });

    it('should show benchmark comparison', () => {
      render(
        <HandoffCelebration
          onClose={mockOnClose}
          timeSavedMinutes={20}
          efficiencyPercent={67}
        />
      );

      expect(screen.getByText(/vs industry average \(30 min handoff\)/)).toBeInTheDocument();
    });
  });

  describe('Patient Count Display', () => {
    it('should show patient count when provided', () => {
      render(<HandoffCelebration onClose={mockOnClose} patientCount={12} />);

      expect(screen.getByText('12')).toBeInTheDocument();
    });

    it('should show dash when patient count not provided', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('Auto-Close Behavior', () => {
    it('should auto-close after 4 seconds', async () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(mockOnClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should indicate auto-close in close button text', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      expect(screen.getByText(/wait 4 seconds/)).toBeInTheDocument();
    });
  });

  describe('Manual Close', () => {
    it('should call onClose when close button is clicked', async () => {
      vi.useRealTimers(); // Use real timers for user interaction

      render(<HandoffCelebration onClose={mockOnClose} />);

      const closeButton = screen.getByText(/Close/);
      await userEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Confetti Animation', () => {
    it('should render confetti elements', () => {
      const { container } = render(<HandoffCelebration onClose={mockOnClose} />);

      // Check for confetti container
      const confettiContainer = container.querySelector('.overflow-hidden.pointer-events-none');
      expect(confettiContainer).toBeInTheDocument();
    });
  });

  describe('Dancer Animation', () => {
    it('should cycle through dancer bounce animation', async () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      // Initial dancer animations should be cycling
      const dancers = screen.getAllByText(/💃|🕺|👯|🧑|👨/);
      expect(dancers.length).toBeGreaterThan(0);

      act(() => {
        vi.advanceTimersByTime(300); // One bounce cycle
      });

      // Dancers should still be present after animation cycle
      const dancersAfter = screen.getAllByText(/💃|🕺|👯|🧑|👨/);
      expect(dancersAfter.length).toBeGreaterThan(0);
    });
  });

  describe('Modal Styling', () => {
    it('should render with backdrop', () => {
      const { container } = render(<HandoffCelebration onClose={mockOnClose} />);

      const backdrop = container.firstChild;
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('should render celebration card with animation class', () => {
      const { container } = render(<HandoffCelebration onClose={mockOnClose} />);

      const card = container.querySelector('.animate-scale-in');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible close button', () => {
      render(<HandoffCelebration onClose={mockOnClose} />);

      const closeButton = screen.getByRole('button', { name: /Close/i });
      expect(closeButton).toBeInTheDocument();
    });
  });
});
