/**
 * Tests for EASessionResume Component
 *
 * ATLUS: Unity - Session resume prompt tests
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EASessionResume } from '../EASessionResume';

// ============================================================================
// MOCKS
// ============================================================================

const mockResumeSession = vi.fn();
const mockClearHistory = vi.fn();
const mockGetLastRoute = vi.fn();

vi.mock('../../../contexts/NavigationHistoryContext', () => ({
  useNavigationHistory: () => ({
    canResumeSession: true,
    getLastRoute: mockGetLastRoute,
    resumeSession: mockResumeSession,
    clearHistory: mockClearHistory,
  }),
}));

const mockUser = { id: 'user-123', email: 'test@example.com' };

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

// ============================================================================
// HELPERS
// ============================================================================

const originalLocation = window.location;

beforeAll(() => {
  // Mock window.location
  delete (window as any).location;
  (window as any).location = {
    pathname: '/dashboard',
    href: 'http://localhost/dashboard',
  };
});

afterAll(() => {
  (window as { location: Location }).location = originalLocation;
});

// ============================================================================
// TESTS
// ============================================================================

describe('EASessionResume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLastRoute.mockReturnValue('/shift-handoff');

    // Clear sessionStorage before each test
    sessionStorage.clear();
  });

  describe('Rendering', () => {
    it('should render when there is a resumable session', () => {
      render(<EASessionResume />);
      expect(screen.getByText('Resume Session?')).toBeInTheDocument();
    });

    it('should display the last route in a readable format', () => {
      mockGetLastRoute.mockReturnValue('/shift-handoff');
      render(<EASessionResume />);
      expect(screen.getByText('Shift Handoff')).toBeInTheDocument();
    });

    it('should format complex routes properly', () => {
      mockGetLastRoute.mockReturnValue('/neuro-suite/parkinsons');
      render(<EASessionResume />);
      expect(screen.getByText('Neuro Suite Parkinsons')).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<EASessionResume />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Resume previous session');
    });

    it('should not render when last route is a dashboard route', () => {
      mockGetLastRoute.mockReturnValue('/dashboard');
      const { container } = render(<EASessionResume />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when last route is admin dashboard', () => {
      mockGetLastRoute.mockReturnValue('/admin');
      const { container } = render(<EASessionResume />);
      expect(container.firstChild).toBeNull();
    });

    it('should not render when already at last route', () => {
      mockGetLastRoute.mockReturnValue('/dashboard');
      (window as any).location.pathname = '/dashboard';
      const { container } = render(<EASessionResume />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Resume Action', () => {
    it('should call resumeSession when Resume button is clicked', async () => {
      render(<EASessionResume />);
      const resumeButton = screen.getByText('Resume');
      await userEvent.click(resumeButton);
      expect(mockResumeSession).toHaveBeenCalled();
    });

    it('should call onResume callback when provided', async () => {
      const onResume = vi.fn();
      render(<EASessionResume onResume={onResume} />);
      const resumeButton = screen.getByText('Resume');
      await userEvent.click(resumeButton);
      expect(onResume).toHaveBeenCalled();
    });

    it('should hide the component after Resume is clicked', async () => {
      render(<EASessionResume />);
      const resumeButton = screen.getByText('Resume');
      await userEvent.click(resumeButton);
      await waitFor(() => {
        expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument();
      });
    });
  });

  describe('Start Fresh Action', () => {
    it('should call clearHistory when Start Fresh is clicked', async () => {
      render(<EASessionResume />);
      const startFreshButton = screen.getByText('Start Fresh');
      await userEvent.click(startFreshButton);
      expect(mockClearHistory).toHaveBeenCalled();
    });

    it('should call onDismiss callback when Start Fresh is clicked', async () => {
      const onDismiss = vi.fn();
      render(<EASessionResume onDismiss={onDismiss} />);
      const startFreshButton = screen.getByText('Start Fresh');
      await userEvent.click(startFreshButton);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should hide the component after Start Fresh is clicked', async () => {
      render(<EASessionResume />);
      const startFreshButton = screen.getByText('Start Fresh');
      await userEvent.click(startFreshButton);
      await waitFor(() => {
        expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument();
      });
    });
  });

  describe('Dismiss Action', () => {
    it('should hide when dismiss button is clicked', async () => {
      render(<EASessionResume />);
      const dismissButton = screen.getByTitle('Dismiss');
      await userEvent.click(dismissButton);
      await waitFor(() => {
        expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument();
      });
    });

    it('should call onDismiss callback when dismissed', async () => {
      const onDismiss = vi.fn();
      render(<EASessionResume onDismiss={onDismiss} />);
      const dismissButton = screen.getByTitle('Dismiss');
      await userEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should store dismissal in sessionStorage', async () => {
      render(<EASessionResume />);
      const dismissButton = screen.getByTitle('Dismiss');
      await userEvent.click(dismissButton);

      const dismissedAt = sessionStorage.getItem('wf_session_resume_dismissed');
      expect(dismissedAt).not.toBeNull();
    });
  });

  describe('Auto-Dismiss', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-dismiss after specified time', async () => {
      render(<EASessionResume autoDismissMs={5000} />);
      expect(screen.getByText('Resume Session?')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Resume Session?')).not.toBeInTheDocument();
      });
    });

    it('should not auto-dismiss when autoDismissMs is 0', async () => {
      render(<EASessionResume autoDismissMs={0} />);
      expect(screen.getByText('Resume Session?')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(30000);
      });

      expect(screen.getByText('Resume Session?')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('should apply custom className', () => {
      const { container } = render(<EASessionResume className="my-custom-class" />);
      const dialog = container.firstChild as HTMLElement;
      expect(dialog.className).toContain('my-custom-class');
    });
  });
});
