/**
 * PatientEngagementDashboard Test Suite
 *
 * Behavioral tests for the patient engagement monitoring dashboard.
 * Tests loading states, summary stat cards, patient table rendering,
 * risk level badges, mood indicators, filtering, sorting, pagination,
 * error handling, retry, refresh, and legend display.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 * Each assertion targets specific rendered text, roles, or interactive behavior
 * that requires the full component implementation.
 *
 * Location: src/components/admin/__tests__/PatientEngagementDashboard.test.tsx
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// === MOCKS ===================================================================

const mockSupabase = { from: vi.fn(), rpc: vi.fn() };

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
}));

const mockGetAllPatientEngagementScores = vi.fn();

vi.mock('../../../services/engagementTracking', () => ({
  getAllPatientEngagementScores: (...args: unknown[]) =>
    mockGetAllPatientEngagementScores(...args),
}));

vi.mock('../../ui/skeleton', () => ({
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton">Loading...</div>,
}));

// === SYNTHETIC TEST DATA (obviously fake per CLAUDE.md PHI rules) ============

interface EngagementScore {
  user_id: string;
  email: string;
  check_ins_30d: number;
  trivia_games_30d: number;
  word_games_30d: number;
  self_reports_30d: number;
  questions_asked_30d: number;
  check_ins_7d: number;
  trivia_games_7d: number;
  last_check_in: string | null;
  last_trivia_game: string | null;
  last_word_game: string | null;
  last_self_report: string | null;
  avg_trivia_score_pct: number | null;
  avg_trivia_completion_time: number | null;
  avg_mood_score_30d: number | null;
  latest_mood: string | null;
  negative_moods_30d: number;
  symptom_reports_30d: number;
  engagement_score: number;
}

const makeEngagementData = (): EngagementScore[] => [
  {
    user_id: 'user-001',
    email: 'alpha@test.example',
    check_ins_30d: 25,
    trivia_games_30d: 10,
    word_games_30d: 8,
    self_reports_30d: 5,
    questions_asked_30d: 3,
    check_ins_7d: 6,
    trivia_games_7d: 3,
    last_check_in: new Date().toISOString(),
    last_trivia_game: null,
    last_word_game: null,
    last_self_report: null,
    avg_trivia_score_pct: 85,
    avg_trivia_completion_time: 120,
    avg_mood_score_30d: 4.2,
    latest_mood: 'Great',
    negative_moods_30d: 0,
    symptom_reports_30d: 0,
    engagement_score: 85, // HIGH
  },
  {
    user_id: 'user-002',
    email: 'beta@test.example',
    check_ins_30d: 12,
    trivia_games_30d: 4,
    word_games_30d: 3,
    self_reports_30d: 2,
    questions_asked_30d: 1,
    check_ins_7d: 2,
    trivia_games_7d: 1,
    last_check_in: '2026-02-20T10:00:00Z',
    last_trivia_game: null,
    last_word_game: null,
    last_self_report: '2026-02-19T08:00:00Z',
    avg_trivia_score_pct: 60,
    avg_trivia_completion_time: 180,
    avg_mood_score_30d: 3.1,
    latest_mood: 'Okay',
    negative_moods_30d: 2,
    symptom_reports_30d: 1,
    engagement_score: 55, // MEDIUM
  },
  {
    user_id: 'user-003',
    email: 'gamma@test.example',
    check_ins_30d: 4,
    trivia_games_30d: 1,
    word_games_30d: 0,
    self_reports_30d: 1,
    questions_asked_30d: 0,
    check_ins_7d: 0,
    trivia_games_7d: 0,
    last_check_in: '2026-02-10T10:00:00Z',
    last_trivia_game: null,
    last_word_game: null,
    last_self_report: null,
    avg_trivia_score_pct: null,
    avg_trivia_completion_time: null,
    avg_mood_score_30d: 2.5,
    latest_mood: 'Sad',
    negative_moods_30d: 5,
    symptom_reports_30d: 3,
    engagement_score: 28, // LOW
  },
  {
    user_id: 'user-004',
    email: 'delta@test.example',
    check_ins_30d: 0,
    trivia_games_30d: 0,
    word_games_30d: 0,
    self_reports_30d: 0,
    questions_asked_30d: 0,
    check_ins_7d: 0,
    trivia_games_7d: 0,
    last_check_in: null,
    last_trivia_game: null,
    last_word_game: null,
    last_self_report: null,
    avg_trivia_score_pct: null,
    avg_trivia_completion_time: null,
    avg_mood_score_30d: null,
    latest_mood: null,
    negative_moods_30d: 0,
    symptom_reports_30d: 0,
    engagement_score: 5, // CRITICAL
  },
];

// === HELPERS =================================================================

/** Render component after the async load completes and dashboard is visible */
async function renderDashboard() {
  const result = render(
    React.createElement(
      (await import('../PatientEngagementDashboard')).default
    )
  );
  await waitFor(() => {
    expect(screen.getByText('Patient Engagement Dashboard')).toBeInTheDocument();
  });
  return result;
}

/** Render component and wait for error state */
async function renderDashboardError() {
  const result = render(
    React.createElement(
      (await import('../PatientEngagementDashboard')).default
    )
  );
  await waitFor(() => {
    expect(screen.getByText(/Error Loading Engagement Data/)).toBeInTheDocument();
  });
  return result;
}

/**
 * Get the summary stats grid (the 5-column grid with stat cards).
 * The grid has class "grid grid-cols-1 md:grid-cols-5 gap-4".
 */
function getSummaryGrid(): HTMLElement {
  const grid = document.querySelector('.grid.gap-4') as HTMLElement;
  expect(grid).not.toBeNull();
  return grid;
}

/**
 * Find a table row containing a specific email, scoped to the table body.
 */
function getPatientRow(email: string): HTMLElement {
  const emailCell = screen.getByText(email);
  const row = emailCell.closest('tr') as HTMLElement;
  expect(row).not.toBeNull();
  return row;
}

// === TESTS ===================================================================

describe('PatientEngagementDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllPatientEngagementScores.mockResolvedValue({
      data: makeEngagementData(),
      error: null,
    });
  });

  // ---------------------------------------------------------------------------
  // 1. Loading State
  // ---------------------------------------------------------------------------
  describe('Loading State', () => {
    it('shows DashboardSkeleton while data is loading', async () => {
      // Keep the promise pending to capture loading state
      let resolvePromise: (value: unknown) => void = () => {};
      mockGetAllPatientEngagementScores.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      render(
        React.createElement(
          (await import('../PatientEngagementDashboard')).default
        )
      );

      expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // Resolve so cleanup doesn't trigger act warnings
      resolvePromise({ data: [], error: null });
      await waitFor(() => {
        expect(screen.queryByTestId('dashboard-skeleton')).not.toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Dashboard Header
  // ---------------------------------------------------------------------------
  describe('Dashboard Header', () => {
    it('displays the dashboard title', async () => {
      await renderDashboard();
      expect(screen.getByText('Patient Engagement Dashboard')).toBeInTheDocument();
    });

    it('displays the subtitle describing dashboard purpose', async () => {
      await renderDashboard();
      expect(
        screen.getByText(/Monitor senior activity levels to identify at-risk patients/)
      ).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Summary Stats
  // ---------------------------------------------------------------------------
  describe('Summary Stats', () => {
    it('shows total patients count of 4', async () => {
      await renderDashboard();
      const grid = getSummaryGrid();
      // Total Patients is the first card (branded primary border)
      const primaryCard = grid.querySelector('[class*="border-[var(--ea-primary"]') as HTMLElement;
      expect(primaryCard).not.toBeNull();
      expect(within(primaryCard).getByText('Total Patients')).toBeInTheDocument();
      expect(within(primaryCard).getByText('4')).toBeInTheDocument();
    });

    it('shows high engagement count of 1', async () => {
      await renderDashboard();
      const grid = getSummaryGrid();
      const greenCard = grid.querySelector('[class*="border-green-500"]') as HTMLElement;
      expect(greenCard).not.toBeNull();
      expect(within(greenCard).getByText('High Engagement')).toBeInTheDocument();
      expect(within(greenCard).getByText('1')).toBeInTheDocument();
    });

    it('shows medium engagement count of 1', async () => {
      await renderDashboard();
      const grid = getSummaryGrid();
      const yellowCard = grid.querySelector('[class*="border-yellow-500"]') as HTMLElement;
      expect(yellowCard).not.toBeNull();
      expect(within(yellowCard).getByText('Medium Engagement')).toBeInTheDocument();
      expect(within(yellowCard).getByText('1')).toBeInTheDocument();
    });

    it('shows high risk (low engagement) count of 1', async () => {
      await renderDashboard();
      const grid = getSummaryGrid();
      const orangeCard = grid.querySelector('[class*="border-orange-500"]') as HTMLElement;
      expect(orangeCard).not.toBeNull();
      expect(within(orangeCard).getByText('High Risk')).toBeInTheDocument();
      expect(within(orangeCard).getByText('1')).toBeInTheDocument();
    });

    it('shows CRITICAL count of 1', async () => {
      await renderDashboard();
      const grid = getSummaryGrid();
      const redCard = grid.querySelector('[class*="border-red-600"]') as HTMLElement;
      expect(redCard).not.toBeNull();
      expect(within(redCard).getByText(/CRITICAL/)).toBeInTheDocument();
      expect(within(redCard).getByText('1')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Patient Table — Email & Score
  // ---------------------------------------------------------------------------
  describe('Patient Table', () => {
    it('shows email addresses for all patients', async () => {
      await renderDashboard();
      expect(screen.getByText('alpha@test.example')).toBeInTheDocument();
      expect(screen.getByText('beta@test.example')).toBeInTheDocument();
      expect(screen.getByText('gamma@test.example')).toBeInTheDocument();
      expect(screen.getByText('delta@test.example')).toBeInTheDocument();
    });

    it('shows engagement scores in each patient row', async () => {
      await renderDashboard();
      // Scope score assertions to each patient's row to avoid ambiguity
      const alphaRow = getPatientRow('alpha@test.example');
      expect(within(alphaRow).getByText('85')).toBeInTheDocument();

      const betaRow = getPatientRow('beta@test.example');
      expect(within(betaRow).getByText('55')).toBeInTheDocument();

      const gammaRow = getPatientRow('gamma@test.example');
      expect(within(gammaRow).getByText('28')).toBeInTheDocument();

      const deltaRow = getPatientRow('delta@test.example');
      expect(within(deltaRow).getByText('5')).toBeInTheDocument();
    });

    it('shows "/ 100" label next to each score', async () => {
      await renderDashboard();
      const scoreLabels = screen.getAllByText('/ 100');
      expect(scoreLabels.length).toBe(4);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Risk Level Badges
  // ---------------------------------------------------------------------------
  describe('Risk Level Badges', () => {
    it('shows "Low Risk" badge for high engagement patient (score 85)', async () => {
      await renderDashboard();
      const row = getPatientRow('alpha@test.example');
      expect(within(row).getByText('Low Risk')).toBeInTheDocument();
    });

    it('shows "Medium Risk" badge for medium engagement patient (score 55)', async () => {
      await renderDashboard();
      const row = getPatientRow('beta@test.example');
      expect(within(row).getByText('Medium Risk')).toBeInTheDocument();
    });

    it('shows "High Risk" badge for low engagement patient (score 28)', async () => {
      await renderDashboard();
      const row = getPatientRow('gamma@test.example');
      expect(within(row).getByText('High Risk')).toBeInTheDocument();
    });

    it('shows CRITICAL RISK badge for critical engagement patient (score 5)', async () => {
      await renderDashboard();
      const row = getPatientRow('delta@test.example');
      expect(within(row).getByText(/CRITICAL RISK/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. 30-Day Activity Counts
  // ---------------------------------------------------------------------------
  describe('30-Day Activity Counts', () => {
    it('shows check-in counts scoped to each patient row', async () => {
      await renderDashboard();
      const alphaRow = getPatientRow('alpha@test.example');
      expect(within(alphaRow).getByText('25')).toBeInTheDocument();

      const betaRow = getPatientRow('beta@test.example');
      expect(within(betaRow).getByText('12')).toBeInTheDocument();
    });

    it('shows combined game counts (trivia + word) in each row', async () => {
      await renderDashboard();
      // user-001: trivia 10 + word 8 = 18
      const alphaRow = getPatientRow('alpha@test.example');
      expect(within(alphaRow).getByText('18')).toBeInTheDocument();

      // user-002: trivia 4 + word 3 = 7
      const betaRow = getPatientRow('beta@test.example');
      expect(within(betaRow).getByText('7')).toBeInTheDocument();
    });

    it('shows self-report counts per patient', async () => {
      await renderDashboard();
      // All rows should have a "Self-Reports:" label
      const selfReportLabels = screen.getAllByText(/Self-Reports:/);
      expect(selfReportLabels.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Mood Indicators
  // ---------------------------------------------------------------------------
  describe('Mood Indicators', () => {
    it('shows "Great" mood in green for high-engagement patient', async () => {
      await renderDashboard();
      const greatMood = screen.getByText('Great');
      expect(greatMood).toBeInTheDocument();
      expect(greatMood.className).toContain('text-green-600');
    });

    it('shows "Sad" mood in red bold for low-engagement patient', async () => {
      await renderDashboard();
      const sadMood = screen.getByText('Sad');
      expect(sadMood).toBeInTheDocument();
      expect(sadMood.className).toContain('text-red-600');
      expect(sadMood.className).toContain('font-bold');
    });

    it('shows "Okay" mood in neutral styling for medium-engagement patient', async () => {
      await renderDashboard();
      const okayMood = screen.getByText('Okay');
      expect(okayMood).toBeInTheDocument();
      expect(okayMood.className).toContain('text-gray-700');
    });

    it('shows "No mood data" for patient with null latest_mood', async () => {
      await renderDashboard();
      expect(screen.getByText('No mood data')).toBeInTheDocument();
    });

    it('shows average mood score "4.2/5" for the high-engagement patient', async () => {
      await renderDashboard();
      expect(screen.getByText('4.2/5')).toBeInTheDocument();
    });

    it('shows average mood score "3.1/5" for the medium-engagement patient', async () => {
      await renderDashboard();
      expect(screen.getByText('3.1/5')).toBeInTheDocument();
    });

    it('shows average mood score "2.5/5" in red for the low-engagement patient', async () => {
      await renderDashboard();
      const lowMoodAvg = screen.getByText('2.5/5');
      expect(lowMoodAvg).toBeInTheDocument();
      expect(lowMoodAvg.className).toContain('text-red-600');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Negative Mood & Symptom Flags
  // ---------------------------------------------------------------------------
  describe('Negative Mood & Symptom Flags', () => {
    it('shows negative mood warning count for patients with negative moods', async () => {
      await renderDashboard();
      // user-002 has 2 negative, user-003 has 5 negative
      expect(screen.getByText(/2 negative/)).toBeInTheDocument();
      expect(screen.getByText(/5 negative/)).toBeInTheDocument();
    });

    it('does not show negative mood warning for patient with 0 negative moods', async () => {
      await renderDashboard();
      // user-001 has 0 negative moods -- should NOT show a "0 negative" flag
      expect(screen.queryByText(/0 negative/)).not.toBeInTheDocument();
    });

    it('shows symptom report count for patients with symptoms', async () => {
      await renderDashboard();
      // user-002 has 1 symptom, user-003 has 3 symptoms
      expect(screen.getByText(/1 symptoms/)).toBeInTheDocument();
      expect(screen.getByText(/3 symptoms/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Last Activity Formatting
  // ---------------------------------------------------------------------------
  describe('Last Activity', () => {
    it('shows "Today" for patient with today\'s check-in', async () => {
      await renderDashboard();
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('shows "Never" for patient with null last_check_in', async () => {
      await renderDashboard();
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Error State
  // ---------------------------------------------------------------------------
  describe('Error State', () => {
    it('shows error message when service returns an error', async () => {
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: null,
        error: { message: 'Database connection timeout' },
      });

      await renderDashboardError();

      expect(screen.getByText('Error Loading Engagement Data')).toBeInTheDocument();
      expect(screen.getByText('Database connection timeout')).toBeInTheDocument();
    });

    it('shows Retry button in error state', async () => {
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: null,
        error: { message: 'Network error' },
      });

      await renderDashboardError();

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('clicking Retry re-fetches data from service', async () => {
      const user = userEvent.setup();

      // First call fails
      mockGetAllPatientEngagementScores.mockResolvedValueOnce({
        data: null,
        error: { message: 'Temporary failure' },
      });

      await renderDashboardError();

      // Second call succeeds
      mockGetAllPatientEngagementScores.mockResolvedValueOnce({
        data: makeEngagementData(),
        error: null,
      });

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Patient Engagement Dashboard')).toBeInTheDocument();
      });
      expect(mockGetAllPatientEngagementScores).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Filtering by Engagement Level
  // ---------------------------------------------------------------------------
  describe('Filtering', () => {
    it('filters to show only high engagement patients', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      const filterSelect = screen.getByDisplayValue('All Patients');
      await user.selectOptions(filterSelect, 'high');

      await waitFor(() => {
        expect(screen.getByText('alpha@test.example')).toBeInTheDocument();
        expect(screen.queryByText('beta@test.example')).not.toBeInTheDocument();
        expect(screen.queryByText('gamma@test.example')).not.toBeInTheDocument();
        expect(screen.queryByText('delta@test.example')).not.toBeInTheDocument();
      });
    });

    it('filters to show only critical risk patients', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      const filterSelect = screen.getByDisplayValue('All Patients');
      await user.selectOptions(filterSelect, 'critical');

      await waitFor(() => {
        expect(screen.getByText('delta@test.example')).toBeInTheDocument();
        expect(screen.queryByText('alpha@test.example')).not.toBeInTheDocument();
        expect(screen.queryByText('beta@test.example')).not.toBeInTheDocument();
        expect(screen.queryByText('gamma@test.example')).not.toBeInTheDocument();
      });
    });

    it('shows "No patients match the current filter" when filter matches nothing', async () => {
      const user = userEvent.setup();

      // Only provide high-engagement patients
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: [makeEngagementData()[0]],
        error: null,
      });

      await renderDashboard();

      const filterSelect = screen.getByDisplayValue('All Patients');
      await user.selectOptions(filterSelect, 'critical');

      await waitFor(() => {
        expect(screen.getByText('No patients match the current filter')).toBeInTheDocument();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 12. Sorting
  // ---------------------------------------------------------------------------
  describe('Sorting', () => {
    it('default sort shows highest engagement score first', async () => {
      await renderDashboard();

      const rows = screen.getAllByText(/@test\.example/);
      expect(rows[0].textContent).toBe('alpha@test.example');
      expect(rows[1].textContent).toBe('beta@test.example');
      expect(rows[2].textContent).toBe('gamma@test.example');
      expect(rows[3].textContent).toBe('delta@test.example');
    });

    it('sorting by last activity puts most recently active first', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      const sortSelect = screen.getByDisplayValue('Engagement Score');
      await user.selectOptions(sortSelect, 'last_activity');

      await waitFor(() => {
        const rows = screen.getAllByText(/@test\.example/);
        // user-001 has today's check-in (most recent)
        expect(rows[0].textContent).toBe('alpha@test.example');
        // user-004 with all nulls (epoch 0) should be last
        expect(rows[3].textContent).toBe('delta@test.example');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 13. Refresh Data
  // ---------------------------------------------------------------------------
  describe('Refresh Data', () => {
    it('Refresh Data button re-fetches data from service', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      expect(mockGetAllPatientEngagementScores).toHaveBeenCalledTimes(1);

      await user.click(screen.getByRole('button', { name: 'Refresh Data' }));

      await waitFor(() => {
        expect(mockGetAllPatientEngagementScores).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 14. Pagination
  // ---------------------------------------------------------------------------
  describe('Pagination', () => {
    it('shows per page control with default options', async () => {
      await renderDashboard();

      // The Per Page select defaults to "10"
      const perPageSelect = screen.getByDisplayValue('10');
      expect(perPageSelect).toBeInTheDocument();

      const options = within(perPageSelect as HTMLElement).getAllByRole('option');
      const optionValues = options.map((o) => (o as HTMLOptionElement).value);
      expect(optionValues).toContain('5');
      expect(optionValues).toContain('10');
      expect(optionValues).toContain('25');
      expect(optionValues).toContain('50');
      expect(optionValues).toContain('100');
    });

    it('does not show pagination controls when all items fit on one page', async () => {
      await renderDashboard();
      // 4 items, default 10 per page = no pagination buttons
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    });

    it('shows pagination controls when items exceed page size', async () => {
      const user = userEvent.setup();

      // Provide 12 items from the start
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: Array.from({ length: 12 }, (_, i) => ({
          ...makeEngagementData()[0],
          user_id: `user-pag-${i}`,
          email: `pag-${i}@test.example`,
          engagement_score: 90 - i,
        })),
        error: null,
      });

      await renderDashboard();

      // Change to 5 per page (12 items = 3 pages)
      const perPageSelect = screen.getByDisplayValue('10');
      await user.selectOptions(perPageSelect, '5');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      });
    });

    it('Previous button is disabled on first page', async () => {
      const user = userEvent.setup();

      // Provide enough data for multiple pages
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: Array.from({ length: 15 }, (_, i) => ({
          ...makeEngagementData()[0],
          user_id: `user-prev-${i}`,
          email: `prev-${i}@test.example`,
          engagement_score: 90 - i,
        })),
        error: null,
      });

      await renderDashboard();

      // Set to 5 per page
      const perPageSelect = screen.getByDisplayValue('10');
      await user.selectOptions(perPageSelect, '5');

      await waitFor(() => {
        const prevButton = screen.getByRole('button', { name: 'Previous' });
        expect(prevButton).toBeDisabled();
      });
    });

    it('clicking Next advances to the next page of patients', async () => {
      const user = userEvent.setup();

      // 8 items at 5/page = 2 pages
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: Array.from({ length: 8 }, (_, i) => ({
          ...makeEngagementData()[0],
          user_id: `user-next-${i}`,
          email: `next-${i}@test.example`,
          engagement_score: 90 - i * 5,
        })),
        error: null,
      });

      await renderDashboard();

      const perPageSelect = screen.getByDisplayValue('10');
      await user.selectOptions(perPageSelect, '5');

      await waitFor(() => {
        expect(screen.getByText('next-0@test.example')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: 'Next' });
      await user.click(nextButton);

      await waitFor(() => {
        // Page 2 should show items 5-7 (zero-indexed)
        expect(screen.getByText('next-5@test.example')).toBeInTheDocument();
        // Page 1 items should be gone
        expect(screen.queryByText('next-0@test.example')).not.toBeInTheDocument();
      });
    });

    it('shows pagination summary with correct range', async () => {
      await renderDashboard();
      // 4 items, 10 per page: "Showing 1-4 of 4 patients"
      expect(screen.getByText(/Showing 1-4 of 4 patients/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 15. Legend Section
  // ---------------------------------------------------------------------------
  describe('Legend Section', () => {
    it('shows "Understanding Engagement Scores" heading', async () => {
      await renderDashboard();
      expect(screen.getByText('Understanding Engagement Scores')).toBeInTheDocument();
    });

    it('shows High engagement level description (70-100)', async () => {
      await renderDashboard();
      expect(screen.getByText(/High \(70-100\)/)).toBeInTheDocument();
      expect(screen.getByText(/LOW RISK/)).toBeInTheDocument();
    });

    it('shows Medium engagement level description (40-69)', async () => {
      await renderDashboard();
      expect(screen.getByText(/Medium \(40-69\)/)).toBeInTheDocument();
      expect(screen.getByText(/MEDIUM RISK/)).toBeInTheDocument();
    });

    it('shows Low engagement level description (20-39)', async () => {
      await renderDashboard();
      expect(screen.getByText(/Low \(20-39\)/)).toBeInTheDocument();
    });

    it('shows CRITICAL level description (0-19) with intervention text', async () => {
      await renderDashboard();
      expect(screen.getByText(/CRITICAL \(0-19\)/)).toBeInTheDocument();
      expect(screen.getByText(/IMMEDIATE INTERVENTION REQUIRED/)).toBeInTheDocument();
    });

    it('shows mood indicators explanation', async () => {
      await renderDashboard();
      expect(screen.getByText(/Mood Indicators/)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 16. Service Integration
  // ---------------------------------------------------------------------------
  describe('Service Integration', () => {
    it('calls getAllPatientEngagementScores with the supabase client on mount', async () => {
      await renderDashboard();
      expect(mockGetAllPatientEngagementScores).toHaveBeenCalledWith(mockSupabase);
    });

    it('handles empty data array gracefully', async () => {
      mockGetAllPatientEngagementScores.mockResolvedValue({
        data: [],
        error: null,
      });

      await renderDashboard();

      expect(screen.getByText('No patients match the current filter')).toBeInTheDocument();
      // Summary stats should show 0 in the Total Patients card
      const grid = getSummaryGrid();
      const primaryCard = grid.querySelector('[class*="border-[var(--ea-primary"]') as HTMLElement;
      expect(primaryCard).not.toBeNull();
      expect(within(primaryCard).getByText('0')).toBeInTheDocument();
    });
  });
});
