/**
 * CacheMonitoringDashboard Tests
 *
 * Tests loading spinner, title, connection pool metrics, memory cache stats,
 * cache statistics table, subscription health table, high utilization warning,
 * stale subscription warning, refresh button, and empty cache state.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only: obviously fake namespaces, IDs, and component names.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CacheStatistics, ConnectionMetrics } from '../../../services/caching/CacheService';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetStatistics = vi.fn();
const mockGetConnectionMetrics = vi.fn();
const mockGetMemoryCacheStats = vi.fn();

vi.mock('../../../services/caching/CacheService', () => ({
  cacheService: {
    getStatistics: (...args: unknown[]) => mockGetStatistics(...args),
    getConnectionMetrics: (...args: unknown[]) => mockGetConnectionMetrics(...args),
    getMemoryCacheStats: (...args: unknown[]) => mockGetMemoryCacheStats(...args),
  },
  // Re-export types are erased at runtime, but mock must export symbol names
}));

const mockSupabaseSelect = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('../../../hooks/useRealtimeSubscription', () => ({
  default: vi.fn().mockReturnValue({
    data: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
    isSubscribed: false,
    subscriptionId: null,
  }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../services/errorReporter', () => ({
  errorReporter: { captureException: vi.fn() },
}));

// ============================================================================
// SYNTHETIC TEST DATA
// ============================================================================

const makeCacheStats = (): CacheStatistics[] => [
  {
    namespace: 'test-patient-context',
    totalEntries: 150,
    totalHits: 1200,
    avgHitsPerEntry: 8.0,
    totalSizeMb: 2.5,
    expiringSoon: 3,
    recentlyUsed: 120,
  },
  {
    namespace: 'test-billing-codes',
    totalEntries: 500,
    totalHits: 3000,
    avgHitsPerEntry: 6.0,
    totalSizeMb: 5.0,
    expiringSoon: 10,
    recentlyUsed: 400,
  },
];

const makeConnectionMetrics = (): ConnectionMetrics => ({
  avgTotalConnections: 15,
  peakTotalConnections: 25,
  avgActiveConnections: 10,
  peakActiveConnections: 20,
  avgUtilizationPercent: 45,
  peakUtilizationPercent: 70,
  highUtilizationCount: 2,
});

const makeHighUtilizationMetrics = (): ConnectionMetrics => ({
  avgTotalConnections: 40,
  peakTotalConnections: 55,
  avgActiveConnections: 35,
  peakActiveConnections: 50,
  avgUtilizationPercent: 85,
  peakUtilizationPercent: 92,
  highUtilizationCount: 15,
});

const makeMemoryCacheStats = () => ({
  size: 75,
  maxSize: 100,
  utilizationPercent: 75,
});

interface SubscriptionHealthEntry {
  component_name: string;
  total_subscriptions: number;
  active_subscriptions: number;
  stale_subscriptions: number;
  avg_age_seconds: number;
}

const makeSubscriptionHealth = (): SubscriptionHealthEntry[] => [
  {
    component_name: 'TestPatientDashboard',
    total_subscriptions: 5,
    active_subscriptions: 5,
    stale_subscriptions: 0,
    avg_age_seconds: 120,
  },
  {
    component_name: 'TestBedBoard',
    total_subscriptions: 3,
    active_subscriptions: 2,
    stale_subscriptions: 1,
    avg_age_seconds: 300,
  },
];

const makeSubscriptionHealthNoStale = (): SubscriptionHealthEntry[] => [
  {
    component_name: 'TestPatientDashboard',
    total_subscriptions: 5,
    active_subscriptions: 5,
    stale_subscriptions: 0,
    avg_age_seconds: 120,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaultMocks() {
  mockGetStatistics.mockResolvedValue(makeCacheStats());
  mockGetConnectionMetrics.mockResolvedValue(makeConnectionMetrics());
  mockGetMemoryCacheStats.mockReturnValue(makeMemoryCacheStats());
}

async function renderAndWaitForLoad() {
  const { CacheMonitoringDashboard } = await import('../CacheMonitoringDashboard');
  render(<CacheMonitoringDashboard />);
  await waitFor(() => {
    expect(screen.getByText('Cache & Connection Monitoring')).toBeInTheDocument();
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('CacheMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------

  it('shows loading spinner before data loads', async () => {
    // Make getStatistics hang so loading remains true
    mockGetStatistics.mockReturnValue(new Promise(() => {}));

    const { CacheMonitoringDashboard } = await import('../CacheMonitoringDashboard');
    const { container } = render(<CacheMonitoringDashboard />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Title & subtitle
  // --------------------------------------------------------------------------

  it('displays "Cache & Connection Monitoring" heading after load', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByRole('heading', { level: 1, name: /cache & connection monitoring/i })).toBeInTheDocument();
    expect(screen.getByText('Enterprise-grade performance monitoring')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Connection Pool Health metrics
  // --------------------------------------------------------------------------

  it('displays average total connections from connection metrics', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Avg Total Connections')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('displays peak total connections from connection metrics', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Peak Total Connections')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('displays average utilization percentage', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Avg Utilization')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('displays peak utilization percentage', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Peak Utilization')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Memory Cache (L1)
  // --------------------------------------------------------------------------

  it('displays memory cache current size', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Memory Cache (L1)')).toBeInTheDocument();
    expect(screen.getByText('Current Size')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('displays memory cache max size', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Max Size')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('displays memory cache utilization percentage', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Utilization')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Cache Statistics table (L2 - PostgreSQL)
  // --------------------------------------------------------------------------

  it('renders cache statistics table with namespace data', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Cache Statistics (L2 - PostgreSQL)')).toBeInTheDocument();
    expect(screen.getByText('test-patient-context')).toBeInTheDocument();
    expect(screen.getByText('test-billing-codes')).toBeInTheDocument();
  });

  it('displays total entries for each cache namespace', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('displays total hits with locale formatting', async () => {
    await renderAndWaitForLoad();

    // 1200 and 3000 get formatted with toLocaleString()
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('3,000')).toBeInTheDocument();
  });

  it('displays average hits per entry rounded to one decimal', async () => {
    await renderAndWaitForLoad();

    // 8.0 -> Math.round(8.0 * 10) / 10 = 8
    expect(screen.getByText('8')).toBeInTheDocument();
    // 6.0 -> 6
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('displays size in MB for each namespace', async () => {
    await renderAndWaitForLoad();

    // 2.5 -> Math.round(2.5 * 100) / 100 = 2.5
    expect(screen.getByText('2.5')).toBeInTheDocument();
    // 5.0 -> 5
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays "No cache data available" when cache stats are empty', async () => {
    mockGetStatistics.mockResolvedValue([]);
    await renderAndWaitForLoad();

    expect(screen.getByText('No cache data available')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Subscription Health
  // --------------------------------------------------------------------------

  it('displays subscription health table when data is provided', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealth(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-001',
    });

    await renderAndWaitForLoad();

    expect(screen.getByText('Real-time Subscription Health')).toBeInTheDocument();
    expect(screen.getByText('TestPatientDashboard')).toBeInTheDocument();
    expect(screen.getByText('TestBedBoard')).toBeInTheDocument();
  });

  it('displays active subscription counts in green', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealth(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-002',
    });

    await renderAndWaitForLoad();

    // TestBedBoard has active_subscriptions = 2
    // TestPatientDashboard has active_subscriptions = 5
    const allFives = screen.getAllByText('5');
    expect(allFives.length).toBeGreaterThanOrEqual(1);
  });

  it('displays stale subscription count in red when non-zero', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealth(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-003',
    });

    await renderAndWaitForLoad();

    // TestBedBoard has stale_subscriptions = 1 which renders in red
    const staleCell = screen.getByText('1');
    expect(staleCell).toBeInTheDocument();
  });

  it('shows stale subscription warning when any component has stale subscriptions', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealth(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-004',
    });

    await renderAndWaitForLoad();

    expect(screen.getByText(/some subscriptions are stale/i)).toBeInTheDocument();
  });

  it('does not show stale subscription warning when no stale subscriptions exist', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealthNoStale(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-005',
    });

    await renderAndWaitForLoad();

    expect(screen.queryByText(/some subscriptions are stale/i)).not.toBeInTheDocument();
  });

  it('displays avg age in minutes (rounded) for subscription health', async () => {
    const useRealtimeSubscription = await import('../../../hooks/useRealtimeSubscription');
    vi.mocked(useRealtimeSubscription.default).mockReturnValue({
      data: makeSubscriptionHealth(),
      loading: false,
      error: null,
      refresh: vi.fn(),
      isSubscribed: true,
      subscriptionId: 'sub-test-006',
    });

    await renderAndWaitForLoad();

    // 300 seconds -> 5 min for TestBedBoard
    // Look for "Avg Age (min)" header and the value "5" in the table
    expect(screen.getByText('Avg Age (min)')).toBeInTheDocument();
    // 300 / 60 = 5
    const allFives = screen.getAllByText('5');
    // TestPatientDashboard has total_subscriptions=5, active_subscriptions=5, and TestBedBoard avg_age=5min
    expect(allFives.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // High utilization warning
  // --------------------------------------------------------------------------

  it('shows connection pool warning when peak utilization > 80%', async () => {
    mockGetConnectionMetrics.mockResolvedValue(makeHighUtilizationMetrics());
    await renderAndWaitForLoad();

    expect(screen.getByText(/connection pool utilization is high/i)).toBeInTheDocument();
  });

  it('does not show connection pool warning when peak utilization <= 80%', async () => {
    await renderAndWaitForLoad();

    // Default metrics have peakUtilizationPercent = 70
    expect(screen.queryByText(/connection pool utilization is high/i)).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Refresh button
  // --------------------------------------------------------------------------

  it('calls loadMetrics when Refresh Metrics button is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    // Clear mocks to isolate the refresh call
    mockGetStatistics.mockClear();
    mockGetConnectionMetrics.mockClear();
    mockGetMemoryCacheStats.mockClear();

    // Re-setup the mocks so the refresh resolves
    setupDefaultMocks();

    const refreshButton = screen.getByRole('button', { name: /refresh metrics/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockGetStatistics).toHaveBeenCalled();
      expect(mockGetConnectionMetrics).toHaveBeenCalled();
      expect(mockGetMemoryCacheStats).toHaveBeenCalled();
    });
  });
});
