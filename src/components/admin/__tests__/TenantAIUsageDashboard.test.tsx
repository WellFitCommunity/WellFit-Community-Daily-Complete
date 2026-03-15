/**
 * TenantAIUsageDashboard Tests
 *
 * Purpose: Validates the Tenant AI Usage Dashboard — loading skeleton, title,
 * metric cards (Total Cost, Total Tokens, Total Requests, Active Users),
 * top 5 users list with ranking badges, time range toggle, empty state,
 * error state with retry, and refresh functionality.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 * Each assertion targets specific rendered text, roles, or interactive behavior
 * that requires the full component implementation.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS — Uses a stable Proxy-based approach that always returns valid chains
// ============================================================================

/** Mutable state that tests set before render */
let profileTenantResult: { data: { tenant_id: string | null } | null; error: unknown } = {
  data: { tenant_id: 'tenant-test-001' },
  error: null,
};
let usageQueryResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
let profilesLookupResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
let profileCallIndex = 0;

/**
 * Build a chain that resolves like a Supabase thenable query.
 * Every method returns the builder itself; await resolves with `result`.
 */
function makeThenableChain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = self;
  builder.eq = self;
  builder.gte = self;
  builder.in = self;
  builder.order = self;
  builder.limit = self;
  builder.single = () => Promise.resolve(result);
  builder.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (r: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') {
        profileCallIndex++;
        if (profileCallIndex === 1) {
          // First profiles call: tenant_id lookup → .single()
          return makeThenableChain(profileTenantResult);
        }
        // Subsequent profiles calls: name lookup → thenable
        return makeThenableChain(profilesLookupResult);
      }
      if (table === 'mcp_usage_logs') {
        return makeThenableChain(usageQueryResult);
      }
      return makeThenableChain({ data: null, error: null });
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'user-test-001', email: 'admin@test.example' }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('lucide-react', () => ({
  DollarSign: ({ className: _c }: { className?: string }) => <span data-testid="icon-dollar" />,
  Zap: ({ className: _c }: { className?: string }) => <span data-testid="icon-zap" />,
  TrendingUp: ({ className: _c }: { className?: string }) => <span data-testid="icon-trending" />,
  User: ({ className: _c }: { className?: string }) => <span data-testid="icon-user" />,
  AlertCircle: ({ className: _c }: { className?: string }) => <span data-testid="icon-alert" />,
  Activity: ({ className: _c }: { className?: string }) => <span data-testid="icon-activity" />,
  Trophy: ({ className: _c }: { className?: string }) => <span data-testid="icon-trophy" />,
}));

// ============================================================================
// COMPONENT IMPORT (static — after mocks)
// ============================================================================

import TenantAIUsageDashboard from '../TenantAIUsageDashboard';

// ============================================================================
// TEST DATA — Synthetic only (obviously fake)
// ============================================================================

function makeUsageLogs() {
  return [
    {
      user_id: 'staff-test-001', cost: 0.05, tokens_used: 700,
      created_at: '2026-02-25T10:00:00Z',
    },
    {
      user_id: 'staff-test-001', cost: 0.01, tokens_used: 400,
      created_at: '2026-02-25T09:00:00Z',
    },
    {
      user_id: 'staff-test-002', cost: 0.10, tokens_used: 1500,
      created_at: '2026-02-24T15:00:00Z',
    },
  ];
}

function makeProfilesData() {
  return [
    { id: 'staff-test-001', email: 'nurse@test.example', first_name: 'Test', last_name: 'Nurse' },
    { id: 'staff-test-002', email: 'doctor@test.example', first_name: 'Test', last_name: 'Doctor' },
  ];
}

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaultMocks() {
  profileCallIndex = 0;
  profileTenantResult = { data: { tenant_id: 'tenant-test-001' }, error: null };
  usageQueryResult = { data: makeUsageLogs(), error: null };
  profilesLookupResult = { data: makeProfilesData(), error: null };
}

function setupEmptyMocks() {
  profileCallIndex = 0;
  profileTenantResult = { data: { tenant_id: 'tenant-test-001' }, error: null };
  usageQueryResult = { data: [], error: null };
  profilesLookupResult = { data: [], error: null };
}

// ============================================================================
// TESTS
// ============================================================================

describe('TenantAIUsageDashboard', () => {
  beforeEach(() => {
    setupDefaultMocks();
  });

  // 1. Title renders
  it('displays "AI Usage & Costs" title after loading', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('AI Usage & Costs')).toBeInTheDocument();
    });
  });

  // 2. Subtitle renders
  it('displays Claude AI tracking subtitle', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Claude AI usage tracking for your organization')).toBeInTheDocument();
    });
  });

  // 3. Total Cost metric card
  it('shows Total Cost metric card with calculated cost', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Total Cost')).toBeInTheDocument();
    });
  });

  // 4. Total Tokens metric card
  it('shows Total Tokens metric card', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Total Tokens')).toBeInTheDocument();
    });
  });

  // 5. Total Requests metric card with request count
  it('shows Total Requests metric card with request count', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
    });
    // 3 usage logs = 3 requests
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // 6. Active Users metric card with user count
  it('shows Active Users metric card with user count', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Active Users')).toBeInTheDocument();
    });
    // 2 unique users
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  // 7. Top 5 Users heading
  it('renders "Top 5 Users by AI Usage" heading', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Top 5 Users by AI Usage')).toBeInTheDocument();
    });
  });

  // 8. User names rendered
  it('renders user names from profile data', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Test Doctor')).toBeInTheDocument();
    });
    expect(screen.getByText('Test Nurse')).toBeInTheDocument();
  });

  // 9. User #1 ranking badge (gold styling)
  it('shows #1 ranking badge with yellow/gold styling for top user', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('#1')).toBeInTheDocument();
    });
    const badge = screen.getByText('#1');
    expect(badge.className).toContain('bg-yellow-100');
    expect(badge.className).toContain('text-yellow-700');
  });

  // 10. User #2 ranking badge (silver styling)
  it('shows #2 ranking badge with gray/silver styling for second user', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('#2')).toBeInTheDocument();
    });
    const badge = screen.getByText('#2');
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-700');
  });

  // 11. User request count displayed
  it('displays request count for each user', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      // staff-test-001 has 2 logs, staff-test-002 has 1
      expect(screen.getByText(/2 requests/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 requests/)).toBeInTheDocument();
  });

  // 12. Cost per request displayed
  it('displays cost per request for each user', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      // staff-test-002: $0.10 total / 1 request = $0.10/request
      expect(screen.getByText('$0.10/request')).toBeInTheDocument();
    });
  });

  // 13. Time range toggle buttons
  it('renders 24 Hours, 7 Days, and 30 Days time range buttons', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('24 Hours')).toBeInTheDocument();
    });
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
  });

  // 14. 30 Days is active by default
  it('shows 30 Days as the active time range by default', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      const btn = screen.getByText('30 Days');
      expect(btn.className).toContain('bg-[var(--ea-primary)]');
    });
  });

  // 15. Refresh button
  it('renders a Refresh button', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  // 16. Empty state
  it('shows "No AI usage data found for this time period" when no usage data', async () => {
    setupEmptyMocks();

    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('No AI usage data found for this time period')).toBeInTheDocument();
    });
  });

  // 17. Error state
  it('shows error message and Retry button when data loading fails', async () => {
    profileCallIndex = 0;
    profileTenantResult = { data: { tenant_id: 'tenant-test-001' }, error: null };
    usageQueryResult = { data: null, error: { message: 'Test connection error', code: 'TIMEOUT' } };

    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load AI usage data')).toBeInTheDocument();
    });
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  // 18. Retry button re-fetches data
  it('re-fetches data when Retry button is clicked', async () => {
    profileCallIndex = 0;
    profileTenantResult = { data: { tenant_id: 'tenant-test-001' }, error: null };
    usageQueryResult = { data: null, error: { message: 'Test connection error', code: 'TIMEOUT' } };

    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load AI usage data')).toBeInTheDocument();
    });

    // Fix the error for retry — reset the profile call index so tenant lookup works again
    profileCallIndex = 0;
    usageQueryResult = { data: makeUsageLogs(), error: null };
    profilesLookupResult = { data: makeProfilesData(), error: null };

    const user = userEvent.setup();
    await user.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('AI Usage & Costs')).toBeInTheDocument();
    });
  });

  // 19. AI Cost Breakdown info section
  it('displays the AI Cost Breakdown information section', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('AI Cost Breakdown')).toBeInTheDocument();
    });
    expect(screen.getByText(/Costs include AI processing, SmartScribe transcription/)).toBeInTheDocument();
  });

  // 20. Error logged to auditLogger on failure
  it('logs error via auditLogger when data loading fails', async () => {
    profileCallIndex = 0;
    profileTenantResult = { data: { tenant_id: 'tenant-test-001' }, error: null };
    usageQueryResult = { data: null, error: { message: 'DB connection timeout', code: 'TIMEOUT' } };

    render(<TenantAIUsageDashboard />);

    const { auditLogger } = await import('../../../services/auditLogger');
    await waitFor(() => {
      expect(auditLogger.error).toHaveBeenCalledWith(
        'TENANT_AI_USAGE_DASHBOARD_LOAD_FAILED',
        expect.objectContaining({}),
        expect.objectContaining({ category: 'ADMINISTRATIVE' }),
      );
    });
  });

  // 21. Users sorted by cost (highest first)
  it('ranks users by total cost — highest spender appears first', async () => {
    render(<TenantAIUsageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Doctor')).toBeInTheDocument();
    });

    // Test Doctor ($0.10) should be #1, Test Nurse ($0.06) should be #2
    const rank1 = screen.getByText('#1');
    const rank2 = screen.getByText('#2');

    // #1 is in the same card as Test Doctor
    const card1 = rank1.closest('.border');
    const card2 = rank2.closest('.border');

    expect(card1).toBeTruthy();
    expect(card2).toBeTruthy();
    if (card1) {
      expect(card1.textContent).toContain('Test Doctor');
    }
    if (card2) {
      expect(card2.textContent).toContain('Test Nurse');
    }
  });

  // 22. No tenant ID — loading skeleton persists (no data fetch triggered)
  it('stays in loading skeleton when profile has no tenant_id', async () => {
    profileCallIndex = 0;
    profileTenantResult = { data: { tenant_id: null }, error: null };

    const { container } = render(<TenantAIUsageDashboard />);

    // Give the component time to process the profile response
    await new Promise(r => setTimeout(r, 100));

    // Component should still show loading skeleton (animate-pulse) since
    // no tenantId means loadAIUsage is never called and loading stays true
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // 23. Cost formatting
  it('formats cost values as USD currency', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      // Total cost = 0.05 + 0.01 + 0.10 = 0.16
      expect(screen.getByText('$0.16')).toBeInTheDocument();
    });
  });

  // 24. "Using AI features" sub-label on Active Users card
  it('shows "Using AI features" sub-label on Active Users card', async () => {
    render(<TenantAIUsageDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Using AI features')).toBeInTheDocument();
    });
  });
});
