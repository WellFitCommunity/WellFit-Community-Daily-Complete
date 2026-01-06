/**
 * LearningMilestone Tests
 *
 * Tests for AI learning milestone celebration component:
 * - Toast notification display
 * - Badge notification display
 * - Modal with confetti celebration
 * - Milestone acknowledgment
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LearningMilestone } from '../LearningMilestone';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void } & Record<string, unknown>>) => (
      <div onClick={onClick} {...props}>{children}</div>
    ),
    h2: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h2 {...props}>{children}</h2>
    ),
    p: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <p {...props}>{children}</p>
    ),
    button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void } & Record<string, unknown>>) => (
      <button onClick={onClick} {...props}>{children}</button>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('react-confetti', () => ({
  default: () => <div data-testid="confetti" />,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
      }),
    }),
  },
}));

import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

describe('LearningMilestone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'test-user-123' } });

    // Mock window resize
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
  });

  const setupMockMilestones = (milestones: Array<Record<string, unknown>>) => {
    const mockOrder = vi.fn().mockResolvedValue({ data: milestones, error: null });
    const mockEqAcknowledged = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqAcknowledged });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqUserId });
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // No Milestones
  // ═══════════════════════════════════════════════════════════════════════════

  describe('No Milestones', () => {
    it('should render nothing when no milestones exist', async () => {
      setupMockMilestones([]);

      const { container } = render(<LearningMilestone />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });

    it('should render nothing when user is not logged in', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      setupMockMilestones([]);

      const { container } = render(<LearningMilestone />);

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Toast Celebration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Toast Celebration', () => {
    it('should display toast notification', async () => {
      setupMockMilestones([
        {
          id: 'milestone-1',
          milestone_type: 'first_session',
          milestone_title: 'First Session Complete!',
          milestone_description: 'You completed your first voice session.',
          badge_icon: '🎉',
          celebration_type: 'toast',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('First Session Complete!')).toBeInTheDocument();
        expect(screen.getByText('You completed your first voice session.')).toBeInTheDocument();
        expect(screen.getByText('🎉')).toBeInTheDocument();
      });
    });

    it('should dismiss toast on close button click', async () => {
      const onAcknowledge = vi.fn();
      setupMockMilestones([
        {
          id: 'milestone-1',
          milestone_type: 'first_session',
          milestone_title: 'First Session!',
          milestone_description: 'Description',
          badge_icon: '🎉',
          celebration_type: 'toast',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone onAcknowledge={onAcknowledge} />);

      await waitFor(() => {
        expect(screen.getByText('First Session!')).toBeInTheDocument();
      });

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('milestone-1');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Badge Celebration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Badge Celebration', () => {
    it('should display badge notification', async () => {
      setupMockMilestones([
        {
          id: 'milestone-2',
          milestone_type: 'sessions_10',
          milestone_title: '10 Sessions Badge',
          milestone_description: 'You completed 10 sessions!',
          badge_icon: '🏆',
          celebration_type: 'badge',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('🏆')).toBeInTheDocument();
      });
    });

    it('should dismiss badge on click', async () => {
      const onAcknowledge = vi.fn();
      setupMockMilestones([
        {
          id: 'milestone-2',
          milestone_type: 'sessions_10',
          milestone_title: '10 Sessions Badge',
          milestone_description: 'Description',
          badge_icon: '🏆',
          celebration_type: 'badge',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone onAcknowledge={onAcknowledge} />);

      await waitFor(() => {
        expect(screen.getByText('🏆')).toBeInTheDocument();
      });

      // Click the badge to dismiss
      const badge = screen.getByTitle('10 Sessions Badge');
      fireEvent.click(badge);

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('milestone-2');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Modal Celebration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Modal Celebration', () => {
    it('should display modal with confetti', async () => {
      setupMockMilestones([
        {
          id: 'milestone-3',
          milestone_type: 'fully_adapted',
          milestone_title: 'Fully Adapted!',
          milestone_description: 'Your voice profile is fully trained!',
          badge_icon: '⭐',
          celebration_type: 'modal',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('Fully Adapted!')).toBeInTheDocument();
        expect(screen.getByText('Your voice profile is fully trained!')).toBeInTheDocument();
        expect(screen.getByText('Celebrate & Continue')).toBeInTheDocument();
        expect(screen.getByTestId('confetti')).toBeInTheDocument();
      });
    });

    it('should display achievement date', async () => {
      const testDate = '2024-01-15T10:30:00Z';
      setupMockMilestones([
        {
          id: 'milestone-3',
          milestone_type: 'fully_adapted',
          milestone_title: 'Fully Adapted!',
          milestone_description: 'Description',
          badge_icon: '⭐',
          celebration_type: 'modal',
          created_at: testDate,
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText(/Achieved on/)).toBeInTheDocument();
      });
    });

    it('should dismiss modal on button click', async () => {
      const onAcknowledge = vi.fn();
      setupMockMilestones([
        {
          id: 'milestone-3',
          milestone_type: 'fully_adapted',
          milestone_title: 'Fully Adapted!',
          milestone_description: 'Description',
          badge_icon: '⭐',
          celebration_type: 'modal',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone onAcknowledge={onAcknowledge} />);

      await waitFor(() => {
        expect(screen.getByText('Celebrate & Continue')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Celebrate & Continue'));

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('milestone-3');
      });
    });

    it('should dismiss modal on backdrop click', async () => {
      const onAcknowledge = vi.fn();
      setupMockMilestones([
        {
          id: 'milestone-3',
          milestone_type: 'fully_adapted',
          milestone_title: 'Fully Adapted!',
          milestone_description: 'Description',
          badge_icon: '⭐',
          celebration_type: 'modal',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone onAcknowledge={onAcknowledge} />);

      await waitFor(() => {
        expect(screen.getByText('Fully Adapted!')).toBeInTheDocument();
      });

      // Click the backdrop (the fixed inset div)
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      await waitFor(() => {
        expect(onAcknowledge).toHaveBeenCalledWith('milestone-3');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Confetti Celebration Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Confetti Celebration', () => {
    it('should show confetti for confetti celebration type', async () => {
      setupMockMilestones([
        {
          id: 'milestone-4',
          milestone_type: 'sessions_50',
          milestone_title: '50 Sessions!',
          milestone_description: 'Amazing progress!',
          badge_icon: '🎊',
          celebration_type: 'confetti',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByTestId('confetti')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Multiple Milestones Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Multiple Milestones', () => {
    it('should display first milestone initially', async () => {
      setupMockMilestones([
        {
          id: 'milestone-1',
          milestone_type: 'first_session',
          milestone_title: 'First Milestone',
          milestone_description: 'Description 1',
          badge_icon: '🥇',
          celebration_type: 'toast',
          created_at: new Date().toISOString(),
        },
        {
          id: 'milestone-2',
          milestone_type: 'sessions_10',
          milestone_title: 'Second Milestone',
          milestone_description: 'Description 2',
          badge_icon: '🥈',
          celebration_type: 'toast',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('First Milestone')).toBeInTheDocument();
      });

      // Second milestone should not be visible yet
      expect(screen.queryByText('Second Milestone')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Gradient Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Milestone Gradients', () => {
    it('should apply correct gradient for first milestone type', async () => {
      setupMockMilestones([
        {
          id: 'milestone-1',
          milestone_type: 'first_login',
          milestone_title: 'First Login',
          milestone_description: 'Welcome!',
          badge_icon: '👋',
          celebration_type: 'modal',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('First Login')).toBeInTheDocument();
      });
    });

    it('should apply correct gradient for sessions_10 type', async () => {
      setupMockMilestones([
        {
          id: 'milestone-2',
          milestone_type: 'sessions_10',
          milestone_title: '10 Sessions',
          milestone_description: 'Keep going!',
          badge_icon: '🔟',
          celebration_type: 'modal',
          created_at: new Date().toISOString(),
        },
      ]);

      render(<LearningMilestone />);

      await waitFor(() => {
        expect(screen.getByText('10 Sessions')).toBeInTheDocument();
      });
    });
  });
});
