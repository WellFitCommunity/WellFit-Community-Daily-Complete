/**
 * MCPCostDashboard Tests
 *
 * Purpose: Tests the MCP Cost Dashboard component rendering, data display,
 * and conditional UI states (loading, empty, populated).
 *
 * Tests cover: loading skeleton, empty state message, hero card metrics,
 * savings percentage calculation, comparison box, cache hit rate, model
 * distribution, efficiency grade logic, daily savings table, and
 * optimization tips conditional rendering.
 *
 * Deletion Test: Every test asserts content unique to MCPCostDashboard.
 * An empty <div /> would fail all tests.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// ---- Supabase mock chain ----
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRpc = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test-001' } }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(function MotionDiv(
      { children, ...props }: { children?: React.ReactNode; [key: string]: unknown },
      ref: React.Ref<HTMLDivElement>
    ) {
      // Strip framer-motion-specific props to avoid React warnings
      const {
        initial: _i, animate: _a, transition: _t, whileHover: _wh,
        whileTap: _wt, exit: _e, variants: _v, layout: _l,
        ...htmlProps
      } = props;
      return <div ref={ref} {...htmlProps}>{children}</div>;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---- Test fixtures ----
const makeCostMetrics = (overrides: Record<string, unknown> = {}) => ({
  total_spent: 42.50,
  total_saved: 157.50,
  avg_cache_hit_rate: 72,
  total_calls: 200,
  total_cached_calls: 144,
  total_haiku_calls: 150,
  total_sonnet_calls: 50,
  ...overrides,
});

const makeDailySavings = () => [
  { date: '2026-02-01', total_cost: 5.00, saved_cost: 12.00, cache_hit_rate: 70, efficiency_score: 85 },
  { date: '2026-02-02', total_cost: 6.50, saved_cost: 14.50, cache_hit_rate: 75, efficiency_score: 90 },
  { date: '2026-02-03', total_cost: 4.20, saved_cost: 10.80, cache_hit_rate: 68, efficiency_score: 78 },
];

// ---- Helper to import the component fresh ----
async function renderDashboard() {
  const { MCPCostDashboard } = await import('../MCPCostDashboard');
  return render(<MCPCostDashboard />);
}

describe('MCPCostDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // 1. Loading state
  // ------------------------------------------------------------------
  it('shows loading skeleton with animated pulse while fetching data', async () => {
    // Never resolve — stay in loading
    mockSingle.mockReturnValue(new Promise(() => {}));
    mockRpc.mockReturnValue(new Promise(() => {}));

    const { container } = await renderDashboard();

    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------
  // 2. Empty / no data state
  // ------------------------------------------------------------------
  it('shows "MCP Cost Optimizer Active" when no metrics exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('MCP Cost Optimizer Active')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Start using Claude-powered features to see your cost savings here/)
    ).toBeInTheDocument();
  });

  it('shows info message when metrics exist but total_calls is zero', async () => {
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({ total_calls: 0 }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('MCP Cost Optimizer Active')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // 3. Hero card — total saved
  // ------------------------------------------------------------------
  it('displays total saved amount in the hero stats card', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('$157.50')).toBeInTheDocument();
    });
    expect(screen.getByText('MCP Cost Savings')).toBeInTheDocument();
    expect(screen.getByText('Total Saved')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 4. Savings percentage
  // ------------------------------------------------------------------
  it('calculates and displays savings percentage correctly', async () => {
    // total_saved=157.50, total_spent=42.50 => potential=200 => 157.50/200*100 = 78.75 => "79%"
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('79%')).toBeInTheDocument();
    });
    expect(screen.getByText('Savings Rate')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 5. Comparison box
  // ------------------------------------------------------------------
  it('shows "Without MCP" and "With MCP" cost comparison', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Without MCP:')).toBeInTheDocument();
    });
    expect(screen.getByText('With MCP:')).toBeInTheDocument();
    // Without MCP = total_spent + total_saved = 42.50 + 157.50 = 200.00
    expect(screen.getByText('$200.00')).toBeInTheDocument();
    // With MCP = total_spent = 42.50
    expect(screen.getByText('$42.50')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 6. Cache Hit Rate card
  // ------------------------------------------------------------------
  it('displays cache hit rate percentage in efficiency card', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Cache Hit Rate')).toBeInTheDocument();
    });
    // avg_cache_hit_rate = 72 => "72%"
    expect(screen.getByText('72%')).toBeInTheDocument();
    // Shows cached/total count
    expect(screen.getByText(/144 \/ 200 cached responses/)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 7. Model Distribution card
  // ------------------------------------------------------------------
  it('shows haiku and sonnet call counts in Model Usage card', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Model Usage')).toBeInTheDocument();
    });
    expect(screen.getByText('150 / 50')).toBeInTheDocument();
    // 150 haiku out of 200 total = 75%
    expect(screen.getByText(/75% using cheaper/)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 8. Efficiency Grade
  // ------------------------------------------------------------------
  it('shows A+ grade when savings percentage >= 70', async () => {
    // savings% = 157.50/200 * 100 = 78.75 >= 70 => A+
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('A+')).toBeInTheDocument();
    });
    expect(screen.getByText('Efficiency Grade')).toBeInTheDocument();
    expect(screen.getByText('Excellent optimization')).toBeInTheDocument();
  });

  it('shows A grade when savings percentage is between 50 and 69', async () => {
    // total_saved=60, total_spent=40 => potential=100 => 60% => A
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({ total_saved: 60, total_spent: 40 }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('A')).toBeInTheDocument();
    });
    expect(screen.getByText('Good optimization')).toBeInTheDocument();
  });

  it('shows B grade when savings percentage is below 50', async () => {
    // total_saved=20, total_spent=80 => potential=100 => 20% => B
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({ total_saved: 20, total_spent: 80, avg_cache_hit_rate: 25 }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('B')).toBeInTheDocument();
    });
    expect(screen.getByText('Room for improvement')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 9. Daily Savings table
  // ------------------------------------------------------------------
  it('renders daily savings rows with date, saved cost, and spent cost', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Daily Savings Trend (Last 7 Days)')).toBeInTheDocument();
    });
    // Check saved amounts appear
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByText('$14.50')).toBeInTheDocument();
    expect(screen.getByText('$10.80')).toBeInTheDocument();
    // Check spent amounts appear
    expect(screen.getByText('$5.00 spent')).toBeInTheDocument();
    expect(screen.getByText('$6.50 spent')).toBeInTheDocument();
    expect(screen.getByText('$4.20 spent')).toBeInTheDocument();
  });

  it('does not render daily savings section when no daily data exists', async () => {
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('MCP Cost Savings')).toBeInTheDocument();
    });
    expect(screen.queryByText('Daily Savings Trend (Last 7 Days)')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 10. Optimization tips — conditional rendering
  // ------------------------------------------------------------------
  it('shows "Excellent work" tip when savings >= 70%', async () => {
    // 78.75% savings => shows excellent tip
    mockSingle.mockResolvedValue({ data: makeCostMetrics(), error: null });
    mockRpc.mockResolvedValue({ data: makeDailySavings(), error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Optimization Tips')).toBeInTheDocument();
    });
    expect(screen.getByText(/Excellent work!/)).toBeInTheDocument();
  });

  it('shows low cache hit rate tip when rate < 50%', async () => {
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({ avg_cache_hit_rate: 30, total_saved: 20, total_spent: 80 }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Optimization Tips')).toBeInTheDocument();
    });
    expect(screen.getByText(/Low cache hit rate:/)).toBeInTheDocument();
  });

  it('shows high Sonnet usage tip when sonnet calls exceed 70% of total', async () => {
    // sonnet=160 out of 200 total = 80% > 70%
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({
        total_haiku_calls: 40,
        total_sonnet_calls: 160,
        total_saved: 60,
        total_spent: 40,
      }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/High Sonnet usage:/)).toBeInTheDocument();
    });
  });

  it('shows improve efficiency tip when savings < 50%', async () => {
    mockSingle.mockResolvedValue({
      data: makeCostMetrics({ total_saved: 20, total_spent: 80 }),
      error: null,
    });
    mockRpc.mockResolvedValue({ data: [], error: null });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Improve efficiency:/)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------
  // 11. Error resilience — fetch errors do not crash component
  // ------------------------------------------------------------------
  it('renders empty state gracefully when API throws an error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'INTERNAL', message: 'DB down' } });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('MCP Cost Optimizer Active')).toBeInTheDocument();
    });
  });
});
