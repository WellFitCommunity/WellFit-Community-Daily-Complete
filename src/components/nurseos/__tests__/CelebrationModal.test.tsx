// ============================================================================
// CelebrationModal — P3-3 Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CelebrationModal } from '../CelebrationModal';

describe('CelebrationModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    moduleName: 'Box Breathing Exercise',
    wasHelpful: true,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Celebration Content', () => {
    it('displays the completed module name', () => {
      render(<CelebrationModal {...defaultProps} />);
      expect(screen.getByText(/Box Breathing Exercise/)).toBeInTheDocument();
    });

    it('displays "Module completed" label', () => {
      render(<CelebrationModal {...defaultProps} />);
      expect(screen.getByText(/Module completed/)).toBeInTheDocument();
    });

    it('shows positive message when module was helpful', () => {
      render(<CelebrationModal {...defaultProps} wasHelpful={true} />);
      expect(screen.getByText(/builds stronger resilience/)).toBeInTheDocument();
    });

    it('shows feedback acknowledgment when module was not helpful', () => {
      render(<CelebrationModal {...defaultProps} wasHelpful={false} />);
      expect(screen.getByText(/honest feedback/)).toBeInTheDocument();
    });

    it('shows motivational quote', () => {
      render(<CelebrationModal {...defaultProps} />);
      expect(screen.getByText(/empty cup/)).toBeInTheDocument();
    });
  });

  describe('Badges', () => {
    it('displays Growth, Resilience, and Self-Care badges', () => {
      render(<CelebrationModal {...defaultProps} />);
      expect(screen.getByText('Growth')).toBeInTheDocument();
      expect(screen.getByText('Resilience')).toBeInTheDocument();
      expect(screen.getByText('Self-Care')).toBeInTheDocument();
    });
  });

  describe('High-Five Animation', () => {
    it('shows "You" and "Your Team" labels', () => {
      render(<CelebrationModal {...defaultProps} />);
      expect(screen.getByText('You')).toBeInTheDocument();
      expect(screen.getByText('Your Team')).toBeInTheDocument();
    });
  });

  describe('Confetti', () => {
    it('renders confetti particles on mount', () => {
      render(<CelebrationModal {...defaultProps} />);
      const confettiContainer = document.querySelector('.overflow-hidden.pointer-events-none');
      expect(confettiContainer).toBeInTheDocument();
      // 50 confetti pieces
      const pieces = confettiContainer?.querySelectorAll('.animate-confetti-fall');
      expect(pieces?.length).toBe(50);
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Keep Going button is clicked', () => {
      render(<CelebrationModal {...defaultProps} />);
      fireEvent.click(screen.getByText(/Keep Going/));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
      render(<CelebrationModal {...defaultProps} />);
      fireEvent.click(screen.getByText('×'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
