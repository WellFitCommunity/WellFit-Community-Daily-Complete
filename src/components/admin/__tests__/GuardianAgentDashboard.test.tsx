import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GuardianAgentDashboard } from '../GuardianAgentDashboard';

// ── Types matching the guardian-agent service shapes ──
interface MockAgentState {
  isActive: boolean;
  mode: 'monitor' | 'diagnostic' | 'healing' | 'learning' | 'standby';
  activeIssues: Array<{
    id: string;
    timestamp: Date;
    signature: {
      id: string;
      category: string;
      pattern: string;
      severity: string;
      description: string;
      commonCauses: string[];
      healingStrategies: string[];
      estimatedImpact: Record<string, unknown>;
    };
    context: { component?: string; environmentState: Record<string, unknown>; recentActions: string[] };
    severity: string;
    affectedResources: string[];
    metadata: Record<string, unknown>;
  }>;
  healingInProgress: Array<{
    id: string;
    strategy: string;
    description: string;
    steps: unknown[];
    expectedOutcome: string;
  }>;
  recentHealings: Array<{
    actionId: string;
    success: boolean;
    timestamp: Date;
    stepsCompleted: number;
    totalSteps: number;
    outcomeDescription: string;
    metrics: { timeToDetect: number; timeToHeal: number; resourcesAffected: number; usersImpacted: number };
    lessons: string[];
  }>;
  knowledgeBase: Array<{
    id: string;
    pattern: string;
    successRate: number;
    timesEncountered: number;
    effectiveness: number;
  }>;
  performanceMetrics: Record<string, unknown>;
}

interface MockAgentStatistics {
  uptime: number;
  agentMetrics: {
    successRate: number;
    issuesDetected: number;
    issuesHealed: number;
    avgTimeToDetect: number;
    avgTimeToHeal: number;
  };
  monitoringStats: {
    metricsCollected: number;
    anomaliesDetected: number;
    anomaliesHealed: number;
  };
  securityStats: {
    total: number;
    bySeverity: {
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
  };
}

interface MockAgentHealth {
  status: 'healthy' | 'degraded' | 'critical';
  details: Record<string, unknown>;
}

// ── Factories ──
const makeAgentState = (overrides?: Partial<MockAgentState>): MockAgentState => ({
  isActive: true,
  mode: 'monitor',
  activeIssues: [
    {
      id: 'issue-001',
      timestamp: new Date('2026-02-25T10:00:00Z'),
      signature: {
        id: 'sig-001',
        category: 'performance_degradation',
        pattern: 'high_latency',
        severity: 'warning',
        description: 'High API latency detected in test environment',
        commonCauses: ['network congestion'],
        healingStrategies: ['retry_with_backoff'],
        estimatedImpact: {},
      },
      context: { component: 'TestApiGateway', environmentState: {}, recentActions: [] },
      severity: 'warning',
      affectedResources: ['resource-alpha', 'resource-beta'],
      metadata: {},
    },
  ],
  healingInProgress: [],
  recentHealings: [
    {
      actionId: 'heal-001',
      success: true,
      timestamp: new Date('2026-02-25T09:00:00Z'),
      stepsCompleted: 3,
      totalSteps: 3,
      outcomeDescription: 'Service restarted successfully in sandbox',
      metrics: { timeToDetect: 5000, timeToHeal: 12000, resourcesAffected: 2, usersImpacted: 0 },
      lessons: ['Restart resolves cache staleness in test env'],
    },
  ],
  knowledgeBase: [
    {
      id: 'kb-001',
      pattern: 'High latency after deploy',
      successRate: 0.92,
      timesEncountered: 7,
      effectiveness: 88,
    },
  ],
  performanceMetrics: {},
  ...overrides,
});

const makeStatistics = (overrides?: Partial<MockAgentStatistics>): MockAgentStatistics => ({
  uptime: 90061,
  agentMetrics: {
    successRate: 95.0,
    issuesDetected: 42,
    issuesHealed: 40,
    avgTimeToDetect: 15000,
    avgTimeToHeal: 45000,
  },
  monitoringStats: {
    metricsCollected: 1000,
    anomaliesDetected: 42,
    anomaliesHealed: 38,
  },
  securityStats: {
    total: 150,
    bySeverity: { critical: 0, high: 2 },
  },
  ...overrides,
});

const makeHealth = (overrides?: Partial<MockAgentHealth>): MockAgentHealth => ({
  status: 'healthy',
  details: {},
  ...overrides,
});

// ── Mock guardian agent service ──
const mockGetState = vi.fn<() => MockAgentState>();
const mockGetStatistics = vi.fn<() => MockAgentStatistics>();
const mockGetHealth = vi.fn<() => MockAgentHealth>();

vi.mock('../../../services/guardian-agent/GuardianAgent', () => ({
  getGuardianAgent: () => ({
    getState: mockGetState,
    getStatistics: mockGetStatistics,
    getHealth: mockGetHealth,
  }),
}));

// ── Helpers ──
function renderDashboard() {
  return render(<GuardianAgentDashboard />);
}

function setupDefaults() {
  mockGetState.mockReturnValue(makeAgentState());
  mockGetStatistics.mockReturnValue(makeStatistics());
  mockGetHealth.mockReturnValue(makeHealth());
}

describe('GuardianAgentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Loading state ──
  it('shows a loading spinner when agent state has not loaded yet', () => {
    mockGetState.mockReturnValue(undefined as unknown as MockAgentState);
    mockGetStatistics.mockReturnValue(undefined as unknown as MockAgentStatistics);
    mockGetHealth.mockReturnValue(undefined as unknown as MockAgentHealth);

    const { container } = renderDashboard();
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // ── Header ──
  it('displays the Guardian Agent title', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Guardian Agent')).toBeInTheDocument();
  });

  it('displays the Autonomous Self-Healing System subtitle', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Autonomous Self-Healing System')).toBeInTheDocument();
  });

  // ── Health badge ──
  it('shows HEALTHY health badge when status is healthy', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
  });

  it('shows DEGRADED health badge when status is degraded', () => {
    setupDefaults();
    mockGetHealth.mockReturnValue(makeHealth({ status: 'degraded' }));
    renderDashboard();
    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
  });

  it('shows CRITICAL health badge when status is critical', () => {
    setupDefaults();
    mockGetHealth.mockReturnValue(makeHealth({ status: 'critical' }));
    renderDashboard();
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  // ── Metric cards ──
  it('displays the success rate metric from agent statistics', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    // "Success Rate" appears in both the metric card and the knowledge card;
    // verify at least one is present using getAllByText
    const successRateLabels = screen.getAllByText('Success Rate');
    expect(successRateLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('displays the issues detected count with healed subtitle', () => {
    setupDefaults();
    renderDashboard();
    // "42" appears both in the Issues Detected metric card and in
    // Anomalies Detected stat row; verify both via getAllByText
    const fortyTwos = screen.getAllByText('42');
    expect(fortyTwos.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Issues Detected')).toBeInTheDocument();
    expect(screen.getByText('40 healed')).toBeInTheDocument();
  });

  it('displays the number of active issues', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Active Issues')).toBeInTheDocument();
    // 1 active issue in default state
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays formatted uptime from statistics', () => {
    setupDefaults();
    renderDashboard();
    // 90061 seconds = 1d 1h (formatUptime)
    expect(screen.getByText('1d 1h')).toBeInTheDocument();
    expect(screen.getByText('Uptime')).toBeInTheDocument();
  });

  // ── Agent mode ──
  it('displays the agent mode in uppercase', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('MONITOR')).toBeInTheDocument();
    expect(screen.getByText('Agent Mode')).toBeInTheDocument();
  });

  it('displays avg time to detect and heal', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('15000ms')).toBeInTheDocument();
    expect(screen.getByText('45000ms')).toBeInTheDocument();
  });

  // ── Active issues section ──
  it('renders active issues section with issue count', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText(/Active Issues \(1\)/)).toBeInTheDocument();
  });

  it('renders the issue description from signature', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('High API latency detected in test environment')).toBeInTheDocument();
  });

  it('shows "No active issues" message when the issues array is empty', () => {
    setupDefaults();
    mockGetState.mockReturnValue(makeAgentState({ activeIssues: [] }));
    renderDashboard();
    expect(screen.getByText(/No active issues/)).toBeInTheDocument();
  });

  it('shows affected resources count for active issues', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText(/2 resources/)).toBeInTheDocument();
  });

  // ── Recent healings section ──
  it('renders recent healings with outcome description', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Service restarted successfully in sandbox')).toBeInTheDocument();
  });

  it('shows healing metrics (steps, time, resources, users)', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('12000ms')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
  });

  it('shows lesson learned from healing result', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText(/Restart resolves cache staleness/)).toBeInTheDocument();
  });

  // ── Knowledge base ──
  it('renders knowledge base section with pattern count', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText(/Knowledge Base \(1 patterns learned\)/)).toBeInTheDocument();
  });

  it('displays knowledge entry pattern name', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('High latency after deploy')).toBeInTheDocument();
  });

  it('displays knowledge entry success rate as percentage', () => {
    setupDefaults();
    renderDashboard();
    // successRate 0.92 → (0.92 * 100).toFixed(0) = "92%"
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  // ── Monitoring stats ──
  it('renders monitoring statistics with metrics collected', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Metrics Collected')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('renders anomalies detected count in monitoring stats', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Anomalies Detected')).toBeInTheDocument();
  });

  // ── Security stats ──
  it('renders security statistics with total scans', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Total Scans')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders critical findings count in security stats', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Critical Findings')).toBeInTheDocument();
  });

  // ── Auto-refresh toggle ──
  it('renders auto-refresh checkbox that is checked by default', () => {
    setupDefaults();
    renderDashboard();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('renders auto-refresh label text', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText('Auto-refresh')).toBeInTheDocument();
  });

  it('toggles auto-refresh when checkbox is clicked', () => {
    setupDefaults();
    renderDashboard();
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  // ── Component context display ──
  it('displays the component context for active issues', () => {
    setupDefaults();
    renderDashboard();
    expect(screen.getByText(/TestApiGateway/)).toBeInTheDocument();
  });
});
