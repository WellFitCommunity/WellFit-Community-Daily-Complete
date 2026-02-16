/**
 * HCCOpportunityDashboard tests — validates metric cards, alert banner,
 * opportunity rows, type badges, filters, detail modal, dismiss modal,
 * loading/empty/error states.
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

const mockGetHCCOpportunities = vi.fn();
const mockGetHCCStats = vi.fn();
const mockDismissOpportunity = vi.fn();

vi.mock('../../../services/hccOpportunityService', () => ({
  hccOpportunityService: {
    getHCCOpportunities: (...args: unknown[]) => mockGetHCCOpportunities(...args),
    getHCCStats: (...args: unknown[]) => mockGetHCCStats(...args),
    dismissOpportunity: (...args: unknown[]) => mockDismissOpportunity(...args),
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

import HCCOpportunityDashboard from '../HCCOpportunityDashboard';

// =============================================================================
// FIXTURES
// =============================================================================

const MOCK_OPPORTUNITIES = [
  {
    id: 'expiring-pat-1-HCC38',
    patient_id: 'pat-1',
    encounter_id: 'enc-prior-1',
    date_of_service: '2025-06-15',
    opportunity_type: 'expiring_hcc' as const,
    icd10_code: 'E11.40',
    icd10_description: 'Type 2 DM with neuropathy',
    hcc_code: 'HCC38',
    hcc_description: 'Diabetes with Chronic Complications',
    hcc_coefficient: 0.318,
    raf_score_impact: 0.318,
    annual_payment_impact: 3498,
    confidence: 0.95,
    evidence_source: 'Prior Year Diagnosis',
    evidence_detail: 'E11.40 was documented in prior year but has not been recaptured.',
    status: 'open' as const,
  },
  {
    id: 'documented-pat-3-HCC238',
    patient_id: 'pat-3',
    encounter_id: 'enc-curr-2',
    date_of_service: '2026-01-20',
    opportunity_type: 'documented_hcc' as const,
    icd10_code: 'I48.91',
    icd10_description: 'Unspecified atrial fibrillation',
    hcc_code: 'HCC238',
    hcc_description: 'Specified Heart Arrhythmias',
    hcc_coefficient: 0.273,
    raf_score_impact: 0.273,
    annual_payment_impact: 3003,
    confidence: 1.0,
    evidence_source: 'Current Encounter',
    evidence_detail: 'I48.91 documented in encounter on 2026-01-20.',
    status: 'open' as const,
  },
  {
    id: 'suspected-pat-4-HCC38',
    patient_id: 'pat-4',
    encounter_id: null,
    date_of_service: '2026-02-16',
    opportunity_type: 'suspected_hcc' as const,
    icd10_code: 'E11.40',
    icd10_description: 'Diabetes with Chronic Complications',
    hcc_code: 'HCC38',
    hcc_description: 'Diabetes with Chronic Complications',
    hcc_coefficient: 0.318,
    raf_score_impact: 0.318,
    annual_payment_impact: 3498,
    confidence: 0.85,
    evidence_source: 'Medication Analysis',
    evidence_detail: 'Patient is on Metformin which suggests Diabetes.',
    status: 'open' as const,
  },
];

const MOCK_STATS = {
  total_opportunities: 3,
  total_annual_impact: 9999,
  avg_raf_impact_per_patient: 0.303,
  patients_with_gaps: 3,
  opportunities_by_type: { expiring_hcc: 1, suspected_hcc: 1, documented_hcc: 1 },
};

const MOCK_STATS_HIGH_IMPACT = {
  ...MOCK_STATS,
  total_annual_impact: 75000,
  patients_with_gaps: 25,
};

function setupMocks(opts: {
  opps?: unknown[];
  oppsError?: string;
  stats?: unknown;
  statsError?: string;
} = {}) {
  if (opts.oppsError) {
    mockGetHCCOpportunities.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: opts.oppsError },
    });
  } else {
    mockGetHCCOpportunities.mockResolvedValue({
      success: true,
      data: opts.opps ?? MOCK_OPPORTUNITIES,
    });
  }

  if (opts.statsError) {
    mockGetHCCStats.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: opts.statsError },
    });
  } else {
    mockGetHCCStats.mockResolvedValue({
      success: true,
      data: opts.stats ?? MOCK_STATS,
    });
  }

  mockDismissOpportunity.mockResolvedValue({ success: true, data: true });
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HCCOpportunityDashboard', () => {
  it('renders 4 metric cards with correct labels', async () => {
    setupMocks();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Opportunities')).toBeInTheDocument();
      expect(screen.getByText('Annual Revenue Impact')).toBeInTheDocument();
      expect(screen.getByText('Avg RAF Impact / Patient')).toBeInTheDocument();
      expect(screen.getByText('Patients with Gaps')).toBeInTheDocument();
    });
  });

  it('displays metric card values from stats', async () => {
    setupMocks();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$9,999')).toBeInTheDocument();
      expect(screen.getByText('+0.303')).toBeInTheDocument();
    });
  });

  it('displays opportunity rows from service', async () => {
    setupMocks();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      // E11.40 appears in two rows (expiring + suspected), HCC38 appears twice
      expect(screen.getAllByText('E11.40').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('HCC38').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('I48.91')).toBeInTheDocument();
      expect(screen.getByText('HCC238')).toBeInTheDocument();
    });
  });

  it('shows alert banner when impact exceeds $50,000', async () => {
    setupMocks({ stats: MOCK_STATS_HIGH_IMPACT });
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/risk adjustment revenue at risk/)).toBeInTheDocument();
    });
  });

  it('hides alert banner when impact below $50,000', async () => {
    setupMocks();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Opportunities')).toBeInTheDocument();
    });

    expect(screen.queryByText(/risk adjustment revenue at risk/)).not.toBeInTheDocument();
  });

  it('shows type badges for each opportunity', async () => {
    setupMocks();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      // Each type label appears in dropdown option AND as a badge in the row
      expect(screen.getAllByText('Expiring HCC').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Documented HCC').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Suspected HCC').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('filters by opportunity type dropdown', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Detail').length).toBe(3);
    });

    const typeSelect = screen.getByLabelText('Filter by opportunity type');
    await user.selectOptions(typeSelect, 'expiring_hcc');

    await waitFor(() => {
      expect(screen.getAllByText('Detail').length).toBe(1);
    });
  });

  it('opens detail modal on Detail click', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Detail').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getAllByText('Detail')[0]);

    await waitFor(() => {
      expect(screen.getByText('HCC Opportunity Details')).toBeInTheDocument();
      expect(screen.getByText('Prior Year Diagnosis')).toBeInTheDocument();
    });
  });

  it('opens dismiss modal and requires 20-character reason', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('Dismiss').length).toBeGreaterThanOrEqual(1);
    });

    // Click the first Dismiss button in table row
    await user.click(screen.getAllByText('Dismiss')[0]);

    await waitFor(() => {
      expect(screen.getByText('Dismiss Opportunity')).toBeInTheDocument();
    });

    // Submit button should be disabled when reason is too short
    const modal = screen.getByRole('dialog');
    const buttons = within(modal).getAllByRole('button');
    const submitBtn = buttons.find(b => b.textContent === 'Dismiss');
    expect(submitBtn).toBeDisabled();

    // Type a reason meeting minimum length
    const textarea = screen.getByLabelText(/Reason for dismissal/);
    await user.type(textarea, 'HCC captured in external system by specialist');

    // Now submit should be enabled
    await waitFor(() => {
      const enabledBtn = within(modal).getAllByRole('button').find(
        b => b.textContent === 'Dismiss' && !b.hasAttribute('disabled')
      );
      expect(enabledBtn).toBeTruthy();
    });
  });

  it('shows empty state when no opportunities', async () => {
    setupMocks({ opps: [] });
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No HCC opportunities detected')).toBeInTheDocument();
      expect(screen.getByText('All HCC diagnoses are current and documented.')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', async () => {
    mockGetHCCOpportunities.mockReturnValue(new Promise(() => {}));
    mockGetHCCStats.mockReturnValue(new Promise(() => {}));

    render(<HCCOpportunityDashboard />);

    expect(screen.getByText('Analyzing HCC opportunities...')).toBeInTheDocument();
  });

  it('shows error state on service failure', async () => {
    setupMocks({ oppsError: 'Connection timed out' });
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection timed out')).toBeInTheDocument();
    });
  });

  it('refresh button reloads data', async () => {
    setupMocks();
    const user = userEvent.setup();
    render(<HCCOpportunityDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    expect(mockGetHCCOpportunities).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetHCCOpportunities).toHaveBeenCalledTimes(2);
    });
  });
});
