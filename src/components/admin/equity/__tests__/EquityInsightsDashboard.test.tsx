/**
 * Behavioral tests for EquityInsightsDashboard.
 *
 * Verifies the dashboard loads the catalog, runs a built query and renders the report (values +
 * low-N flag), surfaces a clarification when the AI asks for one, and shows a graceful
 * insufficient-data state — each fails if the component logic were removed (deletion test).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Real recharts is rendered (no stub) — ResizeObserver is polyfilled in setupTests.ts. The chart's
// visual correctness is confirmed by visual acceptance in the browser; these tests assert the
// component's behavior (catalog-driven controls, report values, clarification, empty state).
vi.mock('../../../../services/equityAnalytics/equityAnalyticsService', () => ({
  equityAnalyticsService: {
    getCatalog: vi.fn(),
    runQuery: vi.fn(),
    ask: vi.fn(),
  },
}));

import { EquityInsightsDashboard } from '../EquityInsightsDashboard';
import { equityAnalyticsService } from '../../../../services/equityAnalytics/equityAnalyticsService';

const getCatalog = equityAnalyticsService.getCatalog as unknown as Mock;
const runQuery = equityAnalyticsService.runQuery as unknown as Mock;
const ask = equityAnalyticsService.ask as unknown as Mock;

const CATALOG = {
  members: {
    key: 'members',
    label: 'Members',
    description: 'Enrolled members.',
    timeSeries: false,
    dimensions: [{ key: 'gender', label: 'Gender', kind: 'category' }],
    measures: [{ key: 'member_count', label: 'Member count', kind: 'count' }],
  },
};

function catalogOk() {
  getCatalog.mockResolvedValue({ success: true, data: { catalog: CATALOG, tier: 'standard' } });
}

beforeEach(() => {
  getCatalog.mockReset();
  runQuery.mockReset();
  ask.mockReset();
});

describe('EquityInsightsDashboard', () => {
  it('loads the catalog and renders the builder', async () => {
    catalogOk();
    render(<EquityInsightsDashboard />);

    expect(screen.getByText(/Equity & Population-Health Insights/i)).toBeInTheDocument();
    // Source select is populated from the catalog (not hardcoded).
    expect(await screen.findByText('Members')).toBeInTheDocument();
    expect(screen.getByLabelText(/Ask in plain language/i)).toBeInTheDocument();
  });

  it('runs a built query and renders report values with the low-N flag', async () => {
    catalogOk();
    runQuery.mockResolvedValue({
      success: true,
      data: {
        rows: [
          { value: 7, cell_n: 7, low_n: true, gender: 'Female' },
          { value: 34, cell_n: 34, low_n: false, gender: 'Unknown' },
        ],
        meta: {
          source: 'members', measure: 'member_count', dimensions: ['gender'], timeGrain: null,
          tier: 'standard', cellCount: 2, lowNCellCount: 1, smallCellsDropped: false,
          generatedAt: '2026-06-25T00:00:00.000Z',
        },
      },
    });

    render(<EquityInsightsDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /Run report/i }));

    // The data table renders the actual aggregate values...
    expect(await screen.findByText('Female')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getAllByText('34').length).toBeGreaterThan(0);
    // ...and the small group is flagged, not hidden.
    expect(screen.getAllByText(/small/i).length).toBeGreaterThan(0);
    expect(runQuery).toHaveBeenCalledTimes(1);
  });

  it('shows a clarification when the AI asks for more detail', async () => {
    catalogOk();
    ask.mockResolvedValue({
      success: true,
      data: { kind: 'clarification', message: 'Which measure did you mean?', question: 'huh' },
    });

    render(<EquityInsightsDashboard />);
    const input = await screen.findByLabelText(/Ask in plain language/i);
    fireEvent.change(input, { target: { value: 'huh' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/i }));

    expect(await screen.findByText('Which measure did you mean?')).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith('huh');
  });

  it('renders a graceful insufficient-data state for an empty report', async () => {
    catalogOk();
    runQuery.mockResolvedValue({
      success: true,
      data: {
        rows: [],
        meta: {
          source: 'members', measure: 'member_count', dimensions: ['gender'], timeGrain: null,
          tier: 'standard', cellCount: 0, lowNCellCount: 0, smallCellsDropped: false,
          generatedAt: '2026-06-25T00:00:00.000Z',
        },
      },
    });

    render(<EquityInsightsDashboard />);
    fireEvent.click(await screen.findByRole('button', { name: /Run report/i }));

    expect(await screen.findByText(/Insufficient data for this breakdown/i)).toBeInTheDocument();
  });

  it('shows an error when the catalog fails to load', async () => {
    getCatalog.mockResolvedValue({ success: false, error: { code: 'UNKNOWN_ERROR', message: 'nope' } });
    render(<EquityInsightsDashboard />);
    expect(await screen.findByText(/Could not load analytics/i)).toBeInTheDocument();
  });
});
