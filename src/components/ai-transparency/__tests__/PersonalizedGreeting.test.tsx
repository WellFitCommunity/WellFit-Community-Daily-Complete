/**
 * PersonalizedGreeting Tests
 *
 * Tests for personalized greeting display:
 * - Time-based greeting colors
 * - Quote display
 * - Role-specific stats
 * - Loading and empty states
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PersonalizedGreeting } from '../PersonalizedGreeting';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    h1: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <h1 {...props}>{children}</h1>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../../services/personalizedGreeting', () => ({
  generateGreeting: vi.fn(),
  getRoleSpecificStats: vi.fn(),
  getTimeBasedGreeting: vi.fn().mockReturnValue({ timeOfDay: 'morning' }),
}));

import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { generateGreeting, getRoleSpecificStats } from '../../../services/personalizedGreeting';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockGetSession = supabase.auth.getSession as ReturnType<typeof vi.fn>;
const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockGenerateGreeting = generateGreeting as ReturnType<typeof vi.fn>;
const mockGetRoleSpecificStats = getRoleSpecificStats as ReturnType<typeof vi.fn>;

describe('PersonalizedGreeting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'test-user-123' } });
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });
    mockGenerateGreeting.mockResolvedValue(null);
    mockGetRoleSpecificStats.mockResolvedValue({});
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Loading State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      render(<PersonalizedGreeting />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Greeting Display Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Greeting Display', () => {
    it('should display greeting from edge function', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Good morning, Dr. Smith!',
          quote: null,
          user_display_name: 'Dr. Smith',
          time_of_day: 'morning',
        },
        error: null,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Good morning, Dr. Smith!')).toBeInTheDocument();
      });
    });

    it('should fall back to local greeting when edge function fails', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: { message: 'Error' } });
      mockGenerateGreeting.mockResolvedValue({
        fullGreeting: 'Hello, Test User!',
        timeOfDay: 'afternoon',
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Hello, Test User!')).toBeInTheDocument();
      });
    });

    it('should return null when no greeting available', async () => {
      mockInvoke.mockResolvedValue({
        data: { show_greeting: false },
        error: null,
      });
      mockGenerateGreeting.mockResolvedValue(null);

      const { container } = render(<PersonalizedGreeting />);

      await waitFor(() => {
        // After loading, should render nothing
        const content = container.querySelector('.mb-6.space-y-3');
        expect(content).toBeNull();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Quote Display Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Quote Display', () => {
    it('should display motivational quote', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Good morning!',
          quote: {
            text: 'The best way to predict the future is to create it.',
            author: 'Peter Drucker',
            theme: 'excellence',
          },
          user_display_name: 'User',
          time_of_day: 'morning',
        },
        error: null,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText(/The best way to predict the future/)).toBeInTheDocument();
        expect(screen.getByText(/Peter Drucker/)).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should show correct theme icon for compassion', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Hello!',
          quote: {
            text: 'Test quote',
            author: 'Test Author',
            theme: 'compassion',
          },
          user_display_name: 'User',
          time_of_day: 'morning',
        },
        error: null,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('❤️')).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Role Stats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Role Stats Display', () => {
    it('should display patient count stat', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Good morning!',
          quote: null,
          time_of_day: 'morning',
        },
        error: null,
      });

      mockGenerateGreeting.mockResolvedValue({
        fullGreeting: 'Hello!',
        timeOfDay: 'morning',
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'nurse', tenant_id: 'tenant-123' },
              error: null,
            }),
          }),
        }),
      });

      mockGetRoleSpecificStats.mockResolvedValue({
        patientCount: 25,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Patients')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });

    it('should display pending alerts stat', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Good morning!',
          quote: null,
          time_of_day: 'morning',
        },
        error: null,
      });

      mockGenerateGreeting.mockResolvedValue({
        fullGreeting: 'Hello!',
        timeOfDay: 'morning',
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'admin', tenant_id: 'tenant-123' },
              error: null,
            }),
          }),
        }),
      });

      mockGetRoleSpecificStats.mockResolvedValue({
        pendingAlerts: 5,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Pending Alerts')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display critical alerts with special styling', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Good morning!',
          quote: null,
          time_of_day: 'morning',
        },
        error: null,
      });

      mockGenerateGreeting.mockResolvedValue({
        fullGreeting: 'Hello!',
        timeOfDay: 'morning',
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'admin', tenant_id: 'tenant-123' },
              error: null,
            }),
          }),
        }),
      });

      mockGetRoleSpecificStats.mockResolvedValue({
        criticalAlerts: 3,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User Not Logged In
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User Not Logged In', () => {
    it('should not fetch data when user is null', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      render(<PersonalizedGreeting />);

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle empty role stats gracefully', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Hello!',
          quote: null,
          time_of_day: 'afternoon',
        },
        error: null,
      });

      mockGetRoleSpecificStats.mockResolvedValue({});

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });

      // Stats grid should not be present
      expect(screen.queryByText('Patients')).not.toBeInTheDocument();
    });

    it('should not show critical alerts when count is 0', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          show_greeting: true,
          greeting: 'Hello!',
          quote: null,
          time_of_day: 'afternoon',
        },
        error: null,
      });

      mockGenerateGreeting.mockResolvedValue({
        fullGreeting: 'Hello!',
        timeOfDay: 'afternoon',
      });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'admin', tenant_id: 'tenant-123' },
              error: null,
            }),
          }),
        }),
      });

      mockGetRoleSpecificStats.mockResolvedValue({
        criticalAlerts: 0,
      });

      render(<PersonalizedGreeting />);

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument();
      });

      expect(screen.queryByText('Critical Alerts')).not.toBeInTheDocument();
    });
  });
});
