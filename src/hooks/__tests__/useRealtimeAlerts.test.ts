/**
 * Tests for useRealtimeAlerts hook
 * ATLUS: Leading (Innovation) - Push-based real-time alerts
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { AlertSeverity } from '../useRealtimeAlerts';

// Mock the dependencies BEFORE importing the hook
const mockUseRealtimeSubscription = vi.fn();

vi.mock('../useRealtimeSubscription', () => ({
  useRealtimeSubscription: (...args: any[]) => mockUseRealtimeSubscription(...args),
}));

const mockFrom = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
  },
}));

// Mock Audio API
const mockPlay = vi.fn().mockImplementation(() => Promise.reject(new Error('Not implemented')));
global.Audio = vi.fn().mockImplementation(() => ({
  play: mockPlay,
  volume: 0,
}));

// Mock AudioContext for beep fallback
const mockOscillator = {
  connect: vi.fn(),
  frequency: { value: 0 },
  type: 'sine',
  start: vi.fn(),
  stop: vi.fn(),
};
const mockGainNode = {
  connect: vi.fn(),
  gain: { value: 0 },
};
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: () => mockOscillator,
  createGain: () => mockGainNode,
  destination: {},
  close: vi.fn(),
}));

// Import after mocks are set up
import { useRealtimeAlerts } from '../useRealtimeAlerts';

describe('useRealtimeAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for useRealtimeSubscription
    mockUseRealtimeSubscription.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      isSubscribed: true,
      refresh: vi.fn(),
    });

    // Setup default mock for Supabase from()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('should return initial state correctly', () => {
    const { result } = renderHook(() => useRealtimeAlerts());

    expect(result.current.recentAlerts).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isConnected).toBe(true);
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.markAllAsRead).toBe('function');
    expect(typeof result.current.playAlertSound).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
  });

  it('should accept severity filter option', () => {
    const { result } = renderHook(() =>
      useRealtimeAlerts({
        severityFilter: ['critical', 'emergency'],
      })
    );

    expect(result.current.recentAlerts).toEqual([]);
    expect(mockUseRealtimeSubscription).toHaveBeenCalled();
  });

  it('should accept category filter option', () => {
    const { result } = renderHook(() =>
      useRealtimeAlerts({
        categoryFilter: ['clinical', 'medication'],
      })
    );

    expect(result.current.recentAlerts).toEqual([]);
  });

  it('should accept onNewAlert callback', () => {
    const onNewAlert = vi.fn();
    const { result } = renderHook(() =>
      useRealtimeAlerts({ onNewAlert })
    );

    expect(result.current.recentAlerts).toEqual([]);
  });

  it('should accept enableSound option', () => {
    const { result } = renderHook(() =>
      useRealtimeAlerts({ enableSound: false })
    );

    expect(result.current.recentAlerts).toEqual([]);
  });

  it('should accept maxAlerts option', () => {
    const { result } = renderHook(() =>
      useRealtimeAlerts({ maxAlerts: 100 })
    );

    expect(result.current.recentAlerts).toEqual([]);
  });

  it('should accept componentName option', () => {
    const { result } = renderHook(() =>
      useRealtimeAlerts({ componentName: 'TestComponent' })
    );

    expect(result.current.recentAlerts).toEqual([]);
  });

  it('should provide playAlertSound function', () => {
    const { result } = renderHook(() => useRealtimeAlerts());

    // Function should be defined
    expect(typeof result.current.playAlertSound).toBe('function');
  });

  it('should calculate unreadCount from pending alerts', async () => {
    const mockAlerts = [
      { id: '1', status: 'pending', severity: 'critical' as const, title: 'Alert 1', description: '', category: 'clinical', created_at: new Date().toISOString() },
      { id: '2', status: 'pending', severity: 'warning' as const, title: 'Alert 2', description: '', category: 'clinical', created_at: new Date().toISOString() },
      { id: '3', status: 'acknowledged', severity: 'info' as const, title: 'Alert 3', description: '', category: 'clinical', created_at: new Date().toISOString() },
    ];

    mockUseRealtimeSubscription.mockReturnValue({
      data: mockAlerts,
      loading: false,
      error: null,
      isSubscribed: true,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(result.current.recentAlerts.length).toBe(3);
    });

    // 2 pending alerts
    expect(result.current.unreadCount).toBe(2);
  });

  it('should provide markAsRead function', async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    await act(async () => {
      await result.current.markAsRead('alert-123');
    });

    expect(mockFrom).toHaveBeenCalledWith('guardian_alerts');
  });

  it('should provide markAllAsRead function', async () => {
    const mockAlerts = [
      { id: '1', status: 'pending', severity: 'critical' as const, title: 'Alert 1', description: '', category: 'clinical', created_at: new Date().toISOString() },
      { id: '2', status: 'pending', severity: 'warning' as const, title: 'Alert 2', description: '', category: 'clinical', created_at: new Date().toISOString() },
    ];

    mockUseRealtimeSubscription.mockReturnValue({
      data: mockAlerts,
      loading: false,
      error: null,
      isSubscribed: true,
      refresh: vi.fn(),
    });

    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    await waitFor(() => {
      expect(result.current.recentAlerts.length).toBe(2);
    });

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(mockFrom).toHaveBeenCalledWith('guardian_alerts');
  });

  it('should provide refresh function', async () => {
    const mockRefresh = vi.fn();

    mockUseRealtimeSubscription.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      isSubscribed: true,
      refresh: mockRefresh,
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should return isConnected from subscription', () => {
    mockUseRealtimeSubscription.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      isSubscribed: false,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    expect(result.current.isConnected).toBe(false);
  });

  it('should return error from subscription', () => {
    const mockError = new Error('Connection failed');

    mockUseRealtimeSubscription.mockReturnValue({
      data: [],
      loading: false,
      error: mockError,
      isSubscribed: false,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    expect(result.current.error).toBe(mockError);
  });

  it('should return loading state from subscription', () => {
    mockUseRealtimeSubscription.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      isSubscribed: false,
      refresh: vi.fn(),
    });

    const { result } = renderHook(() => useRealtimeAlerts());

    expect(result.current.loading).toBe(true);
  });

  it('should call useRealtimeSubscription with correct options', () => {
    renderHook(() => useRealtimeAlerts({
      severityFilter: ['critical'],
      componentName: 'TestAlerts',
    }));

    expect(mockUseRealtimeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        table: 'guardian_alerts',
        event: '*',
        componentName: 'TestAlerts',
      })
    );
  });

  it('should pass onChange callback to useRealtimeSubscription', () => {
    renderHook(() => useRealtimeAlerts());

    expect(mockUseRealtimeSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        onChange: expect.any(Function),
      })
    );
  });
});
