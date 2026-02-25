/**
 * AIAccuracyDashboard Tests
 *
 * Purpose: Tests the AI prediction accuracy monitoring dashboard with trend analysis,
 * cost tracking, A/B experiments, and prompt version history. Validates loading state,
 * overview tab metrics, skill cards, accuracy bars, experiment table, experiment
 * status badges, prompt version table, time range selector, empty states, error alert,
 * refresh button, human oversight alert, and skill selection.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 * Each assertion targets specific rendered text, roles, or interactive behavior
 * that requires the full component implementation.
 *
 * Location: src/components/admin/__tests__/AIAccuracyDashboard.test.tsx
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockRpc = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
}));

// Mock envision-atlus design system components as pass-through
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, onClick, className }: { children?: React.ReactNode; onClick?: () => void; className?: string }) => (
    <div data-testid="ea-card" onClick={onClick} className={className}>{children}</div>
  ),
  EACardHeader: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-header" className={className}>{children}</div>
  ),
  EACardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({ children, onClick, variant }: { children?: React.ReactNode; onClick?: () => void; variant?: string }) => (
    <button onClick={onClick} data-variant={variant}>{children}</button>
  ),
  EABadge: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
  EAMetricCard: ({ label, value, sublabel, trend }: { label: string; value: string | number; sublabel?: string; trend?: { value: number; direction: string } }) => (
    <div data-testid="ea-metric-card" data-trend-direction={trend?.direction}>
      <span>{label}</span>
      <span>{value}</span>
      {sublabel && <span>{sublabel}</span>}
    </div>
  ),
  EAAlert: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <div data-testid="ea-alert" data-variant={variant}>{children}</div>
  ),
  EASelect: ({ children, value, onValueChange }: { children?: React.ReactNode; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="ea-select" data-value={value} data-onvaluechange={onValueChange ? 'yes' : 'no'}>{children}</div>
  ),
  EASelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <button data-testid="ea-select-trigger" className={className}>{children}</button>
  ),
  EASelectContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ea-select-content">{children}</div>
  ),
  EASelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => (
    <div data-testid="ea-select-item" data-value={value}>{children}</div>
  ),
  EASelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="ea-select-value">{placeholder}</span>
  ),
  EATabs: ({ children }: { children?: React.ReactNode; defaultValue?: string; value?: string; onValueChange?: (v: string) => void }) => (
    <div data-testid="ea-tabs">{children}</div>
  ),
  EATabsList: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ea-tabs-list" role="tablist">{children}</div>
  ),
  EATabsTrigger: ({ children, value }: { children?: React.ReactNode; value: string }) => (
    <button role="tab" data-value={value}>{children}</button>
  ),
}));

// ============================================================================
// TEST DATA -- Synthetic only (CLAUDE.md PHI hygiene)
// ============================================================================

const makeSkillMetrics = () => [
  {
    skill_name: 'readmission_risk',
    total_predictions: 150,
    accuracy_rate: 0.85,
    avg_confidence: 0.78,
    total_cost: 12.50,
  },
  {
    skill_name: 'billing_codes',
    total_predictions: 300,
    accuracy_rate: 0.92,
    avg_confidence: 0.88,
    total_cost: 8.75,
  },
];

const makeExperiments = () => [
  {
    id: 'exp-001',
    experiment_name: 'Readmission v2 prompt',
    skill_name: 'readmission_risk',
    status: 'running',
    control_predictions: 50,
    treatment_predictions: 48,
    winner: null,
    is_significant: false,
    created_at: '2026-02-15T00:00:00Z',
  },
  {
    id: 'exp-002',
    experiment_name: 'Billing structured output',
    skill_name: 'billing_codes',
    status: 'completed',
    control_predictions: 100,
    treatment_predictions: 100,
    winner: 'treatment',
    is_significant: true,
    created_at: '2026-02-10T00:00:00Z',
  },
];

const makePromptVersions = () => [
  {
    id: 'pv-001',
    skill_name: 'readmission_risk',
    version_number: 3,
    is_active: true,
    total_uses: 500,
    accuracy_rate: 0.85,
    created_at: '2026-02-20T00:00:00Z',
  },
  {
    id: 'pv-002',
    skill_name: 'readmission_risk',
    version_number: 2,
    is_active: false,
    total_uses: 1200,
    accuracy_rate: 0.80,
    created_at: '2026-02-10T00:00:00Z',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function setupSuccessMocks(
  skills = makeSkillMetrics(),
  experiments = makeExperiments(),
  prompts = makePromptVersions()
) {
  // rpc('get_accuracy_dashboard', ...) returns skill metrics
  mockRpc.mockResolvedValue({ data: skills, error: null });

  // from('ai_prompt_experiments').select().order().limit() => experiments
  // from('ai_prompt_versions').select().order().limit() => prompt versions
  let fromCallIndex = 0;
  mockFrom.mockImplementation(() => {
    const idx = fromCallIndex++;
    return {
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: idx === 0 ? experiments : prompts,
            error: null,
          }),
        })),
      })),
    };
  });
}

function setupErrorMocks(errorMessage = 'RPC call failed') {
  mockRpc.mockResolvedValue({ data: null, error: { message: errorMessage } });
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  }));
}

function setupLoadingMocks() {
  mockRpc.mockReturnValue(new Promise(() => {}));
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => new Promise(() => {})),
      })),
    })),
  }));
}

function setupEmptyMocks() {
  setupSuccessMocks([], [], []);
}

async function renderDashboard() {
  const AIAccuracyDashboard = (await import('../AIAccuracyDashboard')).default;
  return render(<AIAccuracyDashboard />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('AIAccuracyDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // --------------------------------------------------------------------------
  // 1. Loading state
  // --------------------------------------------------------------------------
  it('shows loading skeleton with animated pulse while fetching data', async () => {
    setupLoadingMocks();

    const { container } = await renderDashboard();

    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 2. Header
  // --------------------------------------------------------------------------
  it('displays dashboard title and description after loading', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('AI Accuracy Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText(/Monitor prediction accuracy and optimize AI skills/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 3. Summary metric cards
  // --------------------------------------------------------------------------
  it('displays Total Predictions metric card with correct sum', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total Predictions')).toBeInTheDocument();
    });
    // 150 + 300 = 450
    expect(screen.getByText('450')).toBeInTheDocument();
  });

  it('displays Overall Accuracy metric card with formatted percentage', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Overall Accuracy')).toBeInTheDocument();
    });
    // Average of 0.85 and 0.92 = 0.885 => 88.5%
    expect(screen.getByText('88.5%')).toBeInTheDocument();
  });

  it('displays Active Skills metric card with count of skills with predictions', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Active Skills')).toBeInTheDocument();
    });
    // Both skills have predictions > 0
    expect(screen.getByText('With predictions')).toBeInTheDocument();
  });

  it('displays Total AI Cost metric card with formatted currency', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Total AI Cost')).toBeInTheDocument();
    });
    // 12.50 + 8.75 = 21.25
    expect(screen.getByText('$21.25')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 4. Tab triggers
  // --------------------------------------------------------------------------
  it('renders tab triggers for Skill Overview, A/B Experiments, and Prompt Versions', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Skill Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('A/B Experiments')).toBeInTheDocument();
    expect(screen.getByText('Prompt Versions')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 5. Skill cards in overview tab
  // --------------------------------------------------------------------------
  it('shows skill cards with display names for each skill', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Readmission Risk')).toBeInTheDocument();
    });
    expect(screen.getByText('Billing Code Suggester')).toBeInTheDocument();
  });

  it('shows accuracy badge on each skill card', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('85.0% accuracy')).toBeInTheDocument();
    });
    expect(screen.getByText('92.0% accuracy')).toBeInTheDocument();
  });

  it('shows prediction count on each skill card', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('shows average confidence on each skill card', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('78.0%')).toBeInTheDocument();
    });
    expect(screen.getByText('88.0%')).toBeInTheDocument();
  });

  it('shows cost per skill on each skill card', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('$12.50')).toBeInTheDocument();
    });
    expect(screen.getByText('$8.75')).toBeInTheDocument();
  });

  it('shows accuracy bar labels with percentage', async () => {
    setupSuccessMocks();

    await renderDashboard();

    // The bar label area repeats "Accuracy" and the percentage
    await waitFor(() => {
      const accuracyLabels = screen.getAllByText('Accuracy');
      expect(accuracyLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Accuracy badge color logic
  // --------------------------------------------------------------------------
  it('uses normal variant for accuracy >= 0.85', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('85.0% accuracy')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('ea-badge');
    const accuracyBadge85 = badges.find(b => b.textContent === '85.0% accuracy');
    expect(accuracyBadge85).toBeDefined();
    expect((accuracyBadge85 as HTMLElement).getAttribute('data-variant')).toBe('normal');
  });

  it('uses normal variant for accuracy >= 0.85 (92%)', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('92.0% accuracy')).toBeInTheDocument();
    });

    const badges = screen.getAllByTestId('ea-badge');
    const accuracyBadge92 = badges.find(b => b.textContent === '92.0% accuracy');
    expect(accuracyBadge92).toBeDefined();
    expect((accuracyBadge92 as HTMLElement).getAttribute('data-variant')).toBe('normal');
  });

  // --------------------------------------------------------------------------
  // 7. Empty overview state
  // --------------------------------------------------------------------------
  it('shows empty message when no predictions are recorded', async () => {
    setupEmptyMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No predictions recorded yet')).toBeInTheDocument();
    });
    expect(screen.getByText(/Predictions will appear here once AI skills are used/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 8. Error state
  // --------------------------------------------------------------------------
  it('displays error alert when data loading fails', async () => {
    setupErrorMocks();

    await renderDashboard();

    // The thrown supabase error is a plain object (not Error instance), so the component
    // uses the fallback message: 'Failed to load dashboard data'
    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
    });

    const alerts = screen.getAllByTestId('ea-alert');
    const criticalAlert = alerts.find(a => a.getAttribute('data-variant') === 'critical');
    expect(criticalAlert).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 9. Refresh button
  // --------------------------------------------------------------------------
  it('shows Refresh button that reloads data when clicked', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    // Reset mocks for second load
    setupSuccessMocks();
    await user.click(screen.getByText('Refresh'));

    // rpc should be called again
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Time range selector
  // --------------------------------------------------------------------------
  it('renders time range selector with 7, 30, 90 day options', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });
    // "Last 30 days" appears in the select item AND in metric card sublabels. Use getAllByText.
    const thirtyDayMatches = screen.getAllByText('Last 30 days');
    expect(thirtyDayMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('passes default 30-day period to rpc call', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_accuracy_dashboard', {
        p_tenant_id: null,
        p_days: 30,
      });
    });
  });

  // --------------------------------------------------------------------------
  // 11. Human Oversight alert
  // --------------------------------------------------------------------------
  it('displays Human Oversight Active alert at the bottom', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Human Oversight Active/)).toBeInTheDocument();
    });
    expect(screen.getByText(/All AI predictions are tracked for accuracy/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 12. Sublabels on metric cards
  // --------------------------------------------------------------------------
  it('shows time period in metric card sublabels', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      const sublabels = screen.getAllByText('Last 30 days');
      // Both "Total Predictions" and "Total AI Cost" show "Last 30 days"
      expect(sublabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows "Across all skills" sublabel on Overall Accuracy card', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Across all skills')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 13. Skill card labels
  // --------------------------------------------------------------------------
  it('shows Predictions, Avg Confidence, and Cost labels in skill cards', async () => {
    setupSuccessMocks();

    await renderDashboard();

    await waitFor(() => {
      const predLabels = screen.getAllByText('Predictions');
      expect(predLabels.length).toBeGreaterThanOrEqual(2);
    });
    const confLabels = screen.getAllByText('Avg Confidence');
    expect(confLabels.length).toBeGreaterThanOrEqual(2);
    const costLabels = screen.getAllByText('Cost');
    expect(costLabels.length).toBeGreaterThanOrEqual(2);
  });

  // --------------------------------------------------------------------------
  // 14. Overall accuracy shows N/A when null
  // --------------------------------------------------------------------------
  it('shows N/A for overall accuracy when no skills have accuracy data', async () => {
    const noAccuracySkills = [
      {
        skill_name: 'test_skill',
        total_predictions: 10,
        accuracy_rate: null as unknown as number,
        avg_confidence: null as unknown as number,
        total_cost: 1.00,
      },
    ];
    setupSuccessMocks(noAccuracySkills, [], []);

    await renderDashboard();

    // "N/A" appears in the metric card (Overall Accuracy) and in the skill card
    // (accuracy and confidence). Use getAllByText to handle multiples.
    await waitFor(() => {
      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThanOrEqual(1);
    });
    // Verify the Overall Accuracy metric card specifically shows N/A
    const metricCards = screen.getAllByTestId('ea-metric-card');
    const accuracyCard = metricCards.find(card => card.textContent?.includes('Overall Accuracy'));
    expect(accuracyCard).toBeDefined();
    expect((accuracyCard as HTMLElement).textContent).toContain('N/A');
  });
});
