/**
 * DocumentationGapDashboard tests — validates metric cards, alert banner,
 * gap table rows, category/priority badges, filters, detail modal with
 * actionable steps, dismiss action, loading/empty/error states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =============================================================================
// MOCKS
// =============================================================================

const mockGetDocumentationGaps = vi.fn();
const mockGetDocumentationGapStats = vi.fn();
const mockDismissGap = vi.fn();
const mockAcknowledgeGap = vi.fn();

vi.mock('../../../services/documentationGapService', () => ({
  documentationGapService: {
    getDocumentationGaps: (...args: unknown[]) => mockGetDocumentationGaps(...args),
    getDocumentationGapStats: (...args: unknown[]) => mockGetDocumentationGapStats(...args),
    dismissGap: (...args: unknown[]) => mockDismissGap(...args),
    acknowledgeGap: (...args: unknown[]) => mockAcknowledgeGap(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

import DocumentationGapDashboard from '../DocumentationGapDashboard';

// =============================================================================
// FIXTURES
// =============================================================================

const MOCK_GAPS = [
  {
    id: 'sug-1-gap',
    encounter_id: 'enc-1',
    patient_id: 'pat-1',
    date_of_service: '2026-02-10',
    encounter_type: 'outpatient',
    provider_id: 'prov-1',
    current_em_code: '99213',
    current_em_level: 3,
    current_charge: 93,
    target_em_code: '99214',
    target_em_level: 4,
    target_charge: 135,
    revenue_opportunity: 42,
    category: 'time_gap' as const,
    gap_description: 'Document 5 more minutes to qualify for 99214',
    actionable_steps: [
      'Current time: 25 minutes. Next level requires 30 minutes.',
      'Document 5 additional minutes of face-to-face or total visit time.',
      'Include counseling/coordination time if applicable.',
    ],
    confidence: 0.90,
    priority: 'medium' as const,
    current_time_minutes: 25,
    time_needed_for_next_level: 30,
    additional_minutes_needed: 5,
    current_diagnosis_count: 2,
    diagnoses_needed_for_next_level: null,
    current_data_complexity: null,
    data_complexity_needed: null,
    current_risk_level: null,
    risk_level_needed: null,
  },
  {
    id: 'sug-2-gap',
    encounter_id: 'enc-2',
    patient_id: 'pat-2',
    date_of_service: '2026-02-11',
    encounter_type: 'outpatient',
    provider_id: 'prov-1',
    current_em_code: '99212',
    current_em_level: 2,
    current_charge: 57,
    target_em_code: '99213',
    target_em_level: 3,
    target_charge: 93,
    revenue_opportunity: 36,
    category: 'diagnosis_gap' as const,
    gap_description: 'Document 1 additional diagnosis to support 99213',
    actionable_steps: [
      'Current diagnoses: 0. Next level requires at least 1.',
      'Review patient conditions for any unaddressed active diagnoses.',
      'Document all chronic conditions managed during the encounter.',
    ],
    confidence: 0.85,
    priority: 'medium' as const,
    current_time_minutes: null,
    time_needed_for_next_level: null,
    additional_minutes_needed: null,
    current_diagnosis_count: 0,
    diagnoses_needed_for_next_level: 1,
    current_data_complexity: null,
    data_complexity_needed: null,
    current_risk_level: null,
    risk_level_needed: null,
  },
  {
    id: 'sug-3-gap',
    encounter_id: 'enc-3',
    patient_id: 'pat-3',
    date_of_service: '2026-02-12',
    encounter_type: 'outpatient',
    provider_id: 'prov-2',
    current_em_code: '99213',
    current_em_level: 3,
    current_charge: 93,
    target_em_code: '99214',
    target_em_level: 4,
    target_charge: 135,
    revenue_opportunity: 42,
    category: 'risk_gap' as const,
    gap_description: 'Upgrade risk level from "low" to "moderate" for 99214',
    actionable_steps: [
      'Current risk: low. Needs: moderate.',
      'Document prescription drug management, decision regarding minor or major surgery, or parenteral controlled substance use.',
    ],
    confidence: 0.88,
    priority: 'medium' as const,
    current_time_minutes: null,
    time_needed_for_next_level: null,
    additional_minutes_needed: null,
    current_diagnosis_count: 2,
    diagnoses_needed_for_next_level: null,
    current_data_complexity: null,
    data_complexity_needed: null,
    current_risk_level: 'low',
    risk_level_needed: 'moderate',
  },
];

const MOCK_STATS = {
  total_gaps: 3,
  total_revenue_opportunity: 120,
  avg_opportunity_per_encounter: 40,
  encounters_with_gaps: 3,
  gaps_by_category: { time_gap: 1, diagnosis_gap: 1, data_complexity_gap: 0, risk_gap: 1 },
  gaps_by_priority: { high: 0, medium: 3, low: 0 },
};

const MOCK_STATS_HIGH_REVENUE = {
  ...MOCK_STATS,
  total_revenue_opportunity: 8500,
  encounters_with_gaps: 42,
};

function setupMocks(opts: {
  gaps?: unknown[];
  gapsError?: string;
  stats?: unknown;
  statsError?: string;
} = {}) {
  if (opts.gapsError) {
    mockGetDocumentationGaps.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: opts.gapsError },
    });
  } else {
    mockGetDocumentationGaps.mockResolvedValue({
      success: true,
      data: opts.gaps ?? MOCK_GAPS,
    });
  }

  if (opts.statsError) {
    mockGetDocumentationGapStats.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: opts.statsError },
    });
  } else {
    mockGetDocumentationGapStats.mockResolvedValue({
      success: true,
      data: opts.stats ?? MOCK_STATS,
    });
  }

  mockDismissGap.mockResolvedValue({ success: true, data: true });
  mockAcknowledgeGap.mockResolvedValue({ success: true, data: true });
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DocumentationGapDashboard', () => {
  it('renders 4 metric cards with correct labels', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Gaps')).toBeInTheDocument();
      expect(screen.getByText('Revenue Opportunity')).toBeInTheDocument();
      expect(screen.getByText('Avg Opportunity / Encounter')).toBeInTheDocument();
      expect(screen.getByText('Encounters with Gaps')).toBeInTheDocument();
    });
  });

  it('displays metric card values from stats', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      // total_gaps: 3 and encounters_with_gaps: 3 appear in metric cards
      // They render as bold text inside metric card divs — verify by checking
      // the specific card content (look for $40.00 = avg_opportunity)
      expect(screen.getByText('$40.00')).toBeInTheDocument();
      expect(screen.getByText('$120.00')).toBeInTheDocument();
    });
  });

  it('displays revenue in dollar format', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$120.00')).toBeInTheDocument();
    });
  });

  it('shows alert banner when opportunity > $5,000', async () => {
    setupMocks({ stats: MOCK_STATS_HIGH_REVENUE });
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/documentation-driven revenue opportunity/)).toBeInTheDocument();
    });
  });

  it('hides alert banner when opportunity < $5,000', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Gaps')).toBeInTheDocument();
    });

    expect(screen.queryByText(/documentation-driven revenue opportunity/)).not.toBeInTheDocument();
  });

  it('displays gap rows with current and target E/M codes', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      // 99213 appears in two rows (gap 1 and gap 3)
      expect(screen.getAllByText('99213').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('99214').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('99212')).toBeInTheDocument();
    });
  });

  it('displays revenue opportunity amounts', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      // $42.00 appears for two gaps
      const amounts = screen.getAllByText('$42.00');
      expect(amounts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows category badges', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      // Category text appears in dropdown options AND badges — verify at least 2 each
      // (1 in dropdown + at least 1 in badge)
      expect(screen.getAllByText('Time Gap').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Diagnosis Gap').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Risk Level').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows priority badges', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      const mediumBadges = screen.getAllByText('medium');
      expect(mediumBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays confidence percentages', async () => {
    setupMocks();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('90%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
    });
  });

  it('filters by category dropdown', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      // All three gap rows render (each shows a category badge)
      expect(screen.getAllByText('View Details').length).toBe(3);
    });

    const categorySelect = screen.getByLabelText('Filter by category');
    await user.selectOptions(categorySelect, 'diagnosis_gap');

    // Only the diagnosis gap row should remain
    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBe(1);
    });
    // "Diagnosis Gap" appears as both dropdown option and badge — just verify 1 row
    expect(screen.getAllByText('Diagnosis Gap').length).toBeGreaterThanOrEqual(1);
  });

  it('filters by priority dropdown', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('medium').length).toBeGreaterThanOrEqual(1);
    });

    const prioritySelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioritySelect, 'high');

    // All gaps are medium priority, so none should show
    await waitFor(() => {
      expect(screen.getByText('No documentation gaps detected')).toBeInTheDocument();
    });
  });

  it('filters by search query', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBe(3);
    });

    const searchInput = screen.getByLabelText('Search codes');
    await user.type(searchInput, '99212');

    // Only the 99212 -> 99213 gap should remain
    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBe(1);
    });
    expect(screen.getByText('99212')).toBeInTheDocument();
  });

  it('opens detail modal on View Details click, shows actionable steps', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBeGreaterThanOrEqual(1);
    });

    const viewButtons = screen.getAllByText('View Details');
    await user.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Documentation Gap Details')).toBeInTheDocument();
      expect(screen.getByText(/Current time: 25 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/Document 5 additional minutes/)).toBeInTheDocument();
    });
  });

  it('acknowledge button in detail modal calls service', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('View Details')[0]);

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Acknowledge'));

    await waitFor(() => {
      expect(mockAcknowledgeGap).toHaveBeenCalledWith('sug-1-gap', 'enc-1');
    });
  });

  it('opens dismiss modal, calls service on confirm', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Dismiss').length).toBeGreaterThanOrEqual(1);
    });

    // Click the first Dismiss button (in table row)
    const dismissButtons = screen.getAllByText('Dismiss');
    await user.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Dismiss Gap')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Reason for dismissal');
    await user.type(textarea, 'Documentation already complete');

    // Find the dismiss button inside the modal — the one that is now enabled
    const modal = screen.getByRole('dialog');
    const modalButtons = within(modal).getAllByRole('button');
    const submitBtn = modalButtons.find(
      (btn) => btn.textContent === 'Dismiss' && !btn.hasAttribute('disabled')
    );
    expect(submitBtn).toBeTruthy();
    if (submitBtn) {
      await user.click(submitBtn);
    }

    await waitFor(() => {
      expect(mockDismissGap).toHaveBeenCalledWith('sug-1-gap', 'Documentation already complete');
    });
  });

  it('dismiss button disabled when reason empty', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Dismiss').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('Dismiss')[0]);

    await waitFor(() => {
      expect(screen.getByText('Dismiss Gap')).toBeInTheDocument();
    });

    // The submit button in the modal should be disabled
    const modal = screen.getByRole('dialog');
    const buttons = within(modal).getAllByRole('button');
    const dismissSubmit = buttons.find(
      b => b.textContent === 'Dismiss' && b.closest('[role="dialog"]')
    );
    expect(dismissSubmit).toBeTruthy();
    expect(dismissSubmit).toBeDisabled();
  });

  it('shows loading state', async () => {
    // Don't resolve the promises yet
    mockGetDocumentationGaps.mockReturnValue(new Promise(() => {}));
    mockGetDocumentationGapStats.mockReturnValue(new Promise(() => {}));

    render(<DocumentationGapDashboard />);

    expect(screen.getByText('Analyzing documentation gaps...')).toBeInTheDocument();
  });

  it('shows empty state when no gaps', async () => {
    setupMocks({ gaps: [] });
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No documentation gaps detected')).toBeInTheDocument();
      expect(screen.getByText('All encounters coded at optimal level.')).toBeInTheDocument();
    });
  });

  it('shows error state on failure', async () => {
    setupMocks({ gapsError: 'Connection timed out' });
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    });
  });

  it('refresh button reloads data', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<DocumentationGapDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    expect(mockGetDocumentationGaps).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetDocumentationGaps).toHaveBeenCalledTimes(2);
    });
  });
});
