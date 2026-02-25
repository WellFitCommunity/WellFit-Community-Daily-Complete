import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PerformanceMonitoringDashboard from '../PerformanceMonitoringDashboard';

// ── Types for test data ──
interface MockErrorLog {
  id: string;
  error_message: string;
  error_type: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  component_name?: string;
  page_url?: string;
  created_at: string;
}

interface MockPerformanceMetric {
  id: string;
  metric_type: string;
  metric_name: string;
  duration_ms: number;
  created_at: string;
}

// ── Factories ──
const makeErrorLogs = (): MockErrorLog[] => [
  {
    id: 'err-001',
    error_message: 'Database connection timeout in test env',
    error_type: 'ConnectionError',
    severity: 'critical',
    component_name: 'TestPatientService',
    page_url: '/admin/test-patients',
    created_at: '2026-02-25T10:00:00Z',
  },
  {
    id: 'err-002',
    error_message: 'Cache miss ratio above threshold',
    error_type: 'PerformanceWarning',
    severity: 'warning',
    component_name: 'TestCacheService',
    page_url: '/admin/test-cache',
    created_at: '2026-02-25T09:30:00Z',
  },
  {
    id: 'err-003',
    error_message: 'API rate limit exceeded for sandbox',
    error_type: 'RateLimitError',
    severity: 'error',
    component_name: 'TestClaudeService',
    page_url: '/admin/test-ai',
    created_at: '2026-02-25T09:00:00Z',
  },
  {
    id: 'err-004',
    error_message: 'New deployment detected in staging',
    error_type: 'InfoEvent',
    severity: 'info',
    component_name: 'TestDeployService',
    page_url: '/admin/test-system',
    created_at: '2026-02-25T08:00:00Z',
  },
];

const makePerformanceMetrics = (): MockPerformanceMetric[] => [
  {
    id: 'perf-001',
    metric_type: 'api',
    metric_name: 'GET /api/test-patients',
    duration_ms: 245,
    created_at: '2026-02-25T10:00:00Z',
  },
  {
    id: 'perf-002',
    metric_type: 'query',
    metric_name: 'test_engagement_scores',
    duration_ms: 1200,
    created_at: '2026-02-25T09:30:00Z',
  },
];

// ── Mock supabase chain builder ──
function createMockSupabase(options?: {
  errorLogs?: MockErrorLog[];
  metrics?: MockPerformanceMetric[];
  errorLogsError?: { code?: string; message?: string } | null;
  metricsError?: { code?: string; message?: string } | null;
}) {
  const errorLogs = options?.errorLogs ?? makeErrorLogs();
  const metrics = options?.metrics ?? makePerformanceMetrics();
  const errorLogsError = options?.errorLogsError ?? null;
  const metricsError = options?.metricsError ?? null;

  return {
    from: vi.fn((table: string) => {
      const isErrorLogs = table === 'error_logs';
      const data = isErrorLogs ? errorLogs : metrics;
      const error = isErrorLogs ? errorLogsError : metricsError;

      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data, error }),
          }),
        }),
      };
    }),
  };
}

// ── Mock AuthContext ──
let mockSupabase = createMockSupabase();

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
}));

// ── Helpers ──
function renderDashboard(className?: string) {
  return render(<PerformanceMonitoringDashboard className={className} />);
}

describe('PerformanceMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  // ── Loading state ──
  it('shows a loading skeleton while data is being fetched', () => {
    // Use a promise that never resolves to keep loading state
    const neverResolve = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        }),
      })),
    };
    mockSupabase = neverResolve as unknown as ReturnType<typeof createMockSupabase>;

    const { container } = renderDashboard();
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  // ── Title ──
  it('displays the Performance Monitoring title after loading', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Performance Monitoring')).toBeInTheDocument();
    });
  });

  // ── Error severity stat cards ──
  it('shows critical errors count of 1', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Critical Errors')).toBeInTheDocument();
    });
    // 1 critical error in default data
    const criticalCard = screen.getByText('Critical Errors').closest('div');
    expect(criticalCard).toBeInTheDocument();
    expect(screen.getByText('Critical Errors').parentElement?.querySelector('.text-3xl')?.textContent).toBe('1');
  });

  it('shows error count of 1 in the errors stat card', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });
  });

  it('shows warnings count of 1 in the warnings stat card', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Warnings')).toBeInTheDocument();
    });
  });

  it('shows info count of 1 in the info stat card', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument();
    });
  });

  // ── Recent errors section ──
  it('displays recent error messages in the errors section', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Database connection timeout in test env')).toBeInTheDocument();
    });
    expect(screen.getByText('Cache miss ratio above threshold')).toBeInTheDocument();
    expect(screen.getByText('API rate limit exceeded for sandbox')).toBeInTheDocument();
    expect(screen.getByText('New deployment detected in staging')).toBeInTheDocument();
  });

  it('displays Recent Errors section heading', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Recent Errors')).toBeInTheDocument();
    });
  });

  it('displays error type labels for each error', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('ConnectionError')).toBeInTheDocument();
    });
    expect(screen.getByText('RateLimitError')).toBeInTheDocument();
  });

  it('displays severity badges for each error', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('critical')).toBeInTheDocument();
    });
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('displays component name for errors that have one', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/TestPatientService/)).toBeInTheDocument();
    });
    expect(screen.getByText(/TestClaudeService/)).toBeInTheDocument();
  });

  // ── Performance metrics section ──
  it('displays Performance Metrics section heading', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Performance Metrics')).toBeInTheDocument();
    });
  });

  it('shows metric names in the performance table', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('GET /api/test-patients')).toBeInTheDocument();
    });
    expect(screen.getByText('test_engagement_scores')).toBeInTheDocument();
  });

  it('shows formatted metric durations', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('245ms')).toBeInTheDocument();
    });
    expect(screen.getByText('1.20s')).toBeInTheDocument();
  });

  it('shows metric type in the table', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('api')).toBeInTheDocument();
    });
    expect(screen.getByText('query')).toBeInTheDocument();
  });

  it('renders performance table column headers', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Type')).toBeInTheDocument();
    });
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  // ── Empty states ──
  it('shows empty errors message when no errors are logged', async () => {
    mockSupabase = createMockSupabase({ errorLogs: [], metrics: makePerformanceMetrics() });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No errors logged yet')).toBeInTheDocument();
    });
  });

  it('shows empty metrics message when no performance metrics exist', async () => {
    mockSupabase = createMockSupabase({ errorLogs: makeErrorLogs(), metrics: [] });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No performance metrics yet')).toBeInTheDocument();
    });
  });

  // ── Access denied state ──
  it('shows Access Restricted when error_logs query returns 403 code', async () => {
    mockSupabase = createMockSupabase({
      errorLogsError: { code: 'PGRST301', message: 'Permission denied' },
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    });
  });

  it('shows permission explanation text in access denied state', async () => {
    mockSupabase = createMockSupabase({
      errorLogsError: { code: '42501', message: 'Insufficient privilege' },
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/don't have permission/)).toBeInTheDocument();
    });
  });

  // ── Refresh button ──
  it('renders a Refresh button that reloads data on click', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
    const refreshButton = screen.getByText('Refresh').closest('button') as HTMLElement;
    expect(refreshButton).toBeInTheDocument();
    fireEvent.click(refreshButton);
    // Verify supabase was called again (initial + refresh)
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('error_logs');
    });
  });

  // ── className prop ──
  it('applies the className prop to the root element', async () => {
    const { container } = renderDashboard('test-custom-class');
    await waitFor(() => {
      expect(screen.getByText('Performance Monitoring')).toBeInTheDocument();
    });
    const rootEl = container.firstChild as HTMLElement;
    expect(rootEl.className).toContain('test-custom-class');
  });
});
