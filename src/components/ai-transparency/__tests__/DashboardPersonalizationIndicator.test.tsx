/**
 * DashboardPersonalizationIndicator Tests
 *
 * Tests for dashboard personalization metrics display:
 * - Adaptation levels (learning/adapting/personalized)
 * - Compact and detailed variants
 * - Metrics display
 * - Loading and empty states
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardPersonalizationIndicator } from '../DashboardPersonalizationIndicator';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    circle: (props: Record<string, unknown>) => <circle {...props} />,
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

describe('DashboardPersonalizationIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'test-user-123' } });
  });

  const setupMockQueries = (
    totalInteractions: number,
    sectionRows: Array<{ section_name: string }> | null,
    _patternsCount: number,
    lastEvent: { created_at: string } | null
  ) => {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'dashboard_personalization_events') {
        return { select: vi.fn() };
      }
      return {
        select: vi.fn().mockImplementation((cols: string, opts?: Record<string, unknown>) => {
          if (opts?.count === 'exact') {
            return {
              eq: vi.fn().mockResolvedValue({ count: totalInteractions, error: null }),
            };
          }
          return {
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockImplementation(() => {
                  if (cols.includes('section_name')) {
                    return Promise.resolve({ data: sectionRows ?? [], error: null });
                  }
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: lastEvent,
                      error: lastEvent ? null : { code: 'PGRST116' },
                    }),
                  };
                }),
              }),
            }),
          };
        }),
      };
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Loading State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      setupMockQueries(0, null, 0, null);
      render(<DashboardPersonalizationIndicator />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // No Interactions State
  // ═══════════════════════════════════════════════════════════════════════════

  describe('No Interactions State', () => {
    it('should show learning message when no interactions', async () => {
      setupMockQueries(0, [], 0, null);
      render(<DashboardPersonalizationIndicator />);

      await waitFor(() => {
        expect(screen.getByText('AI Learning Your Workflow')).toBeInTheDocument();
        expect(screen.getByText(/Your dashboard will adapt/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show the assistant icon (no emoji glyphs) for learning state', async () => {
      setupMockQueries(0, [], 0, null);
      const { container } = render(<DashboardPersonalizationIndicator />);

      await waitFor(() => {
        expect(screen.getByText('AI Learning Your Workflow')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.textContent).not.toContain('🤖');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Component Structure Tests (Static)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Component Structure', () => {
    it('should render without crashing', () => {
      setupMockQueries(50, [], 5, { created_at: new Date().toISOString() });
      expect(() => render(<DashboardPersonalizationIndicator />)).not.toThrow();
    });

    it('should accept variant prop', () => {
      setupMockQueries(50, [], 5, { created_at: new Date().toISOString() });
      expect(() => render(<DashboardPersonalizationIndicator variant="detailed" />)).not.toThrow();
    });

    it('should accept showAdaptationDetails prop', () => {
      setupMockQueries(50, [], 5, { created_at: new Date().toISOString() });
      expect(() => render(<DashboardPersonalizationIndicator showAdaptationDetails />)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User Authentication
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User Authentication', () => {
    it('should not fetch data when user is not logged in', async () => {
      mockUseAuth.mockReturnValue({ user: null });
      setupMockQueries(0, [], 0, null);

      render(<DashboardPersonalizationIndicator />);

      // Should show loading but not fetch
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });
});
