/**
 * UndercodingDetectionDashboard tests — validates metric cards, alert banner,
 * gap table rows, gap type badges, filters, dismiss action, loading/empty states.
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

const mockGetUndercodingGaps = vi.fn();
const mockGetUndercodingStats = vi.fn();
const mockDismissGap = vi.fn();

vi.mock('../../../services/undercodingDetectionService', () => ({
  undercodingDetectionService: {
    getUndercodingGaps: (...args: unknown[]) => mockGetUndercodingGaps(...args),
    getUndercodingStats: (...args: unknown[]) => mockGetUndercodingStats(...args),
    dismissGap: (...args: unknown[]) => mockDismissGap(...args),
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

import UndercodingDetectionDashboard from '../UndercodingDetectionDashboard';

// =============================================================================
// FIXTURES
// =============================================================================

const MOCK_GAPS = [
  {
    id: 'sug-1-99214',
    encounter_id: 'enc-1',
    date_of_service: '2026-02-10',
    encounter_type: 'outpatient',
    suggested_code: '99214',
    suggested_description: 'Office visit level 4',
    billed_code: '99213',
    billed_description: null,
    suggested_charge: 180,
    billed_charge: 120,
    revenue_gap: 60,
    confidence: 0.92,
    rationale: 'Complex medical decision',
    gap_type: 'lower_em_level' as const,
    status: 'open' as const,
  },
  {
    id: 'sug-1-36415',
    encounter_id: 'enc-1',
    date_of_service: '2026-02-10',
    encounter_type: 'outpatient',
    suggested_code: '36415',
    suggested_description: 'Venipuncture',
    billed_code: null,
    billed_description: null,
    suggested_charge: 25,
    billed_charge: 0,
    revenue_gap: 25,
    confidence: 0.88,
    rationale: 'Lab draw performed',
    gap_type: 'missed_code' as const,
    status: 'open' as const,
  },
  {
    id: 'sug-2-99215',
    encounter_id: 'enc-2',
    date_of_service: '2026-02-11',
    encounter_type: 'outpatient',
    suggested_code: '99215',
    suggested_description: 'Office visit level 5',
    billed_code: '99213',
    billed_description: null,
    suggested_charge: 250,
    billed_charge: 120,
    revenue_gap: 130,
    confidence: 0.85,
    rationale: 'High complexity',
    gap_type: 'lower_em_level' as const,
    status: 'open' as const,
  },
];

const MOCK_STATS = {
  total_gaps: 3,
  total_revenue_opportunity: 6215,
  avg_gap_per_encounter: 3107.50,
  encounters_with_gaps: 2,
  most_common_gap_code: '99214',
  gaps_by_type: {
    lower_em_level: 2,
    missed_code: 1,
    lower_value_code: 0,
  },
};

const MOCK_GAPS_RESULT = {
  success: true,
  data: MOCK_GAPS,
};

const MOCK_STATS_RESULT = {
  success: true,
  data: MOCK_STATS,
};

const MOCK_EMPTY_GAPS = {
  success: true,
  data: [],
};

const MOCK_EMPTY_STATS = {
  success: true,
  data: {
    total_gaps: 0,
    total_revenue_opportunity: 0,
    avg_gap_per_encounter: 0,
    encounters_with_gaps: 0,
    most_common_gap_code: null,
    gaps_by_type: { lower_em_level: 0, missed_code: 0, lower_value_code: 0 },
  },
};

// =============================================================================
// SETUP
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUndercodingGaps.mockResolvedValue(MOCK_GAPS_RESULT);
  mockGetUndercodingStats.mockResolvedValue(MOCK_STATS_RESULT);
  mockDismissGap.mockResolvedValue({ success: true, data: true });
});

// =============================================================================
// TESTS
// =============================================================================

describe('UndercodingDetectionDashboard', () => {
  it('renders 4 metric cards with correct labels', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Gaps')).toBeInTheDocument();
    });

    expect(screen.getByText('Revenue Opportunity')).toBeInTheDocument();
    expect(screen.getByText('Avg Gap / Encounter')).toBeInTheDocument();
    expect(screen.getByText('Encounters Affected')).toBeInTheDocument();
  });

  it('displays metric card values from stats', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // total_gaps
    });

    expect(screen.getByText('2')).toBeInTheDocument(); // encounters_with_gaps
  });

  it('shows alert banner when revenue opportunity exceeds $5,000', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/\$6,215\.00 in potential revenue/)).toBeInTheDocument();
    });
  });

  it('does not show alert banner when revenue opportunity is below threshold', async () => {
    mockGetUndercodingStats.mockResolvedValue({
      success: true,
      data: {
        ...MOCK_STATS,
        total_revenue_opportunity: 2000,
      },
    });

    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Gaps')).toBeInTheDocument();
    });

    expect(screen.queryByText(/in potential revenue/)).not.toBeInTheDocument();
  });

  it('displays gap data in table rows with correct codes', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    expect(screen.getByText('36415')).toBeInTheDocument();
    expect(screen.getByText('99215')).toBeInTheDocument();
  });

  it('shows gap type badges with correct labels', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    // Two E/M level gaps shown as badges (plus one in the dropdown option)
    const emBadges = screen.getAllByText('Lower E/M Level');
    // 2 table row badges + 1 dropdown option = 3 total matches
    expect(emBadges.length).toBe(3);

    // Missed Charge shown as badge (plus one in dropdown option)
    const missedBadges = screen.getAllByText('Missed Charge');
    // 1 table row badge + 1 dropdown option = 2 total matches
    expect(missedBadges.length).toBe(2);
  });

  it('shows "None" for billed_code when code was missed', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('36415')).toBeInTheDocument();
    });

    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('filters by gap type via dropdown', async () => {
    const user = userEvent.setup();
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    const gapTypeSelect = screen.getByLabelText('Filter by gap type');
    await user.selectOptions(gapTypeSelect, 'missed_code');

    // Only missed_code gaps should remain
    expect(screen.getByText('36415')).toBeInTheDocument();
    expect(screen.queryByText('99214')).not.toBeInTheDocument();
    expect(screen.queryByText('99215')).not.toBeInTheDocument();
  });

  it('filters by search query', async () => {
    const user = userEvent.setup();
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search codes');
    await user.type(searchInput, '36415');

    expect(screen.getByText('36415')).toBeInTheDocument();
    expect(screen.queryByText('99214')).not.toBeInTheDocument();
  });

  it('opens dismiss modal and calls service on confirm', async () => {
    const user = userEvent.setup();
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    // Click the first Dismiss button
    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    // The Dismiss buttons are in the table rows (not the modal)
    const tableDismissBtn = dismissButtons.find(btn => {
      const row = btn.closest('.flex');
      return row && within(row as HTMLElement).queryByText('99214');
    }) || dismissButtons[0];

    await user.click(tableDismissBtn);

    // Modal should appear
    await waitFor(() => {
      expect(screen.getByText('Dismiss Gap')).toBeInTheDocument();
    });

    // Type reason
    const textarea = screen.getByLabelText('Reason for dismissal');
    await user.type(textarea, 'Coding is correct per provider');

    // Click Dismiss in modal — find the button inside the dialog
    const dialog = screen.getByRole('dialog');
    const modalDismissBtn = within(dialog).getByRole('button', { name: 'Dismiss' });
    await user.click(modalDismissBtn);

    await waitFor(() => {
      expect(mockDismissGap).toHaveBeenCalledWith(
        expect.any(String),
        'Coding is correct per provider'
      );
    });
  });

  it('shows loading state while fetching data', () => {
    // Don't resolve the promises
    mockGetUndercodingGaps.mockReturnValue(new Promise(() => {}));
    mockGetUndercodingStats.mockReturnValue(new Promise(() => {}));

    render(<UndercodingDetectionDashboard />);

    expect(screen.getByText('Analyzing coding gaps...')).toBeInTheDocument();
  });

  it('shows empty state when no gaps exist', async () => {
    mockGetUndercodingGaps.mockResolvedValue(MOCK_EMPTY_GAPS);
    mockGetUndercodingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No undercoding gaps detected')).toBeInTheDocument();
    });

    expect(screen.getByText('AI-suggested codes match billed codes.')).toBeInTheDocument();
  });

  it('shows error message when service returns failure', async () => {
    mockGetUndercodingGaps.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });

    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('displays confidence percentage correctly', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('92%')).toBeInTheDocument(); // 0.92 * 100
    });

    expect(screen.getByText('88%')).toBeInTheDocument(); // 0.88
    expect(screen.getByText('85%')).toBeInTheDocument(); // 0.85
  });

  it('displays revenue gap amounts in dollar format', async () => {
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$130.00')).toBeInTheDocument();
    });

    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
  });

  it('has a refresh button that reloads data', async () => {
    const user = userEvent.setup();
    render(<UndercodingDetectionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('99214')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    await user.click(refreshButton);

    // Should call the service again
    expect(mockGetUndercodingGaps).toHaveBeenCalledTimes(2);
    expect(mockGetUndercodingStats).toHaveBeenCalledTimes(2);
  });
});
