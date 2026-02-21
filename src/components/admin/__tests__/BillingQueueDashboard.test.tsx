/**
 * BillingQueueDashboard tests -- validates stat cards, encounter rows,
 * Generate button, filters, search, empty/error/loading states, refresh.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetBillingQueue = vi.fn();
const mockGetBillingQueueStats = vi.fn();
const mockGenerateSuperbillDraft = vi.fn();

vi.mock('../../../services/encounterBillingBridgeService', () => ({
  encounterBillingBridgeService: {
    getBillingQueue: (...args: unknown[]) => mockGetBillingQueue(...args),
    getBillingQueueStats: (...args: unknown[]) => mockGetBillingQueueStats(...args),
    generateSuperbillDraft: (...args: unknown[]) => mockGenerateSuperbillDraft(...args),
  },
}));

const mockValidateCodes = vi.fn().mockResolvedValue({
  status: 'valid',
  result: null,
  bundlingIssues: [],
  warningCount: 0,
  error: null,
});

vi.mock('../../../hooks/useBillingCodeValidation', () => ({
  useBillingCodeValidation: () => ({
    status: 'idle',
    result: null,
    bundlingIssues: [],
    warningCount: 0,
    error: null,
    suggestions: null,
    suggestingCodes: false,
    validateCodes: mockValidateCodes,
    suggestCodes: vi.fn(),
    lookupCode: vi.fn(),
    reset: vi.fn(),
  }),
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

import BillingQueueDashboard from '../BillingQueueDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_ENCOUNTERS = [
  {
    encounter_id: 'enc-1',
    patient_id: 'pat-1',
    patient_name: 'Smith, John',
    provider_name: 'Main Clinic',
    date_of_service: '2026-01-15',
    status: 'signed',
    signed_at: '2026-01-15T10:00:00Z',
    diagnosis_count: 3,
    procedure_count: 2,
    superbill_id: null,
    superbill_status: null,
  },
  {
    encounter_id: 'enc-2',
    patient_id: 'pat-2',
    patient_name: 'Doe, Jane',
    provider_name: 'Main Clinic',
    date_of_service: '2026-01-10',
    status: 'ready_for_billing',
    signed_at: '2026-01-10T14:00:00Z',
    diagnosis_count: 1,
    procedure_count: 1,
    superbill_id: 'sb-1',
    superbill_status: 'draft' as const,
  },
  {
    encounter_id: 'enc-3',
    patient_id: 'pat-3',
    patient_name: 'Adams, Mary',
    provider_name: 'Main Clinic',
    date_of_service: '2026-01-08',
    status: 'billed',
    signed_at: '2026-01-08T09:00:00Z',
    diagnosis_count: 2,
    procedure_count: 3,
    superbill_id: 'sb-2',
    superbill_status: 'approved' as const,
  },
];

const MOCK_STATS = {
  awaiting_superbill: 1,
  draft: 1,
  pending_review: 0,
  approved: 1,
  claimed: 0,
};

const MOCK_QUEUE_SUCCESS = {
  success: true,
  data: MOCK_ENCOUNTERS,
  error: null,
};

const MOCK_STATS_SUCCESS = {
  success: true,
  data: MOCK_STATS,
  error: null,
};

const MOCK_EMPTY_QUEUE = {
  success: true,
  data: [],
  error: null,
};

const MOCK_EMPTY_STATS = {
  success: true,
  data: {
    awaiting_superbill: 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    claimed: 0,
  },
  error: null,
};

// ============================================================================
// TESTS
// ============================================================================

describe('BillingQueueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching data', () => {
    mockGetBillingQueue.mockReturnValue(new Promise(() => {}));
    mockGetBillingQueueStats.mockReturnValue(new Promise(() => {}));

    render(<BillingQueueDashboard />);

    expect(screen.getByText('Loading billing queue...')).toBeInTheDocument();
  });

  it('displays 5 stat cards with correct labels and values', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    // Labels like "Awaiting Superbill", "Draft", "Approved" also appear in
    // the status filter dropdown, so use getAllByText and verify stat card presence.
    await waitFor(() => {
      const awaitingElements = screen.getAllByText('Awaiting Superbill');
      expect(awaitingElements.length).toBeGreaterThanOrEqual(2); // stat card + option
    });

    // "Pending Review" appears in both stat card and option
    const pendingElements = screen.getAllByText('Pending Review');
    expect(pendingElements.length).toBeGreaterThanOrEqual(2);

    // "Claimed" appears in both stat card and option
    const claimedElements = screen.getAllByText('Claimed');
    expect(claimedElements.length).toBeGreaterThanOrEqual(2);

    // Verify stat card content (find by the parent stat card structure)
    // The stat card for "Awaiting Superbill" should contain the value "1"
    const awaitingCards = screen.getAllByText('Awaiting Superbill');
    const awaitingStatCard = awaitingCards.find(el => el.tagName === 'P');
    expect(awaitingStatCard?.closest('div')).toHaveTextContent('1');
  });

  it('shows warning alert when encounters await superbills', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/1 signed encounter awaiting superbill generation/),
      ).toBeInTheDocument();
    });
  });

  it('does not show warning alert when no encounters await superbills', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_EMPTY_QUEUE);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Billing Queue')).toBeInTheDocument();
    });

    expect(screen.queryByText(/awaiting superbill generation/)).not.toBeInTheDocument();
  });

  it('renders encounter rows with patient name, status badge, and diagnosis/procedure counts', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    expect(screen.getByText('Adams, Mary')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('signed')).toBeInTheDocument();
    expect(screen.getByText('ready_for_billing')).toBeInTheDocument();
    expect(screen.getByText('billed')).toBeInTheDocument();
  });

  it('shows superbill status badges on encounters', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No Superbill')).toBeInTheDocument();
    });

    // "Draft" and "Approved" appear in both stat cards and badges.
    // Verify at least 2 instances exist (stat card + encounter row badge).
    const draftElements = screen.getAllByText('Draft');
    expect(draftElements.length).toBeGreaterThanOrEqual(2);

    const approvedElements = screen.getAllByText('Approved');
    expect(approvedElements.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Generate button only for encounters without superbills', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    // Only one Generate button (for enc-1 with no superbill)
    const generateButtons = screen.getAllByText('Generate');
    expect(generateButtons).toHaveLength(1);
  });

  it('shows Submit button for draft superbills', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    });

    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('calls generateSuperbillDraft when Generate is clicked', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockGenerateSuperbillDraft.mockResolvedValue({
      success: true,
      data: {
        id: 'sb-new',
        procedure_codes: [{ code: '99213', modifiers: [] }],
        diagnosis_codes: [{ code: 'J06.9' }],
      },
      error: null,
    });

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(mockGenerateSuperbillDraft).toHaveBeenCalledWith('enc-1', '');
    });
  });

  it('shows empty state when no encounters are in billing queue', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_EMPTY_QUEUE);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No encounters in billing queue')).toBeInTheDocument();
    });

    expect(screen.getByText('No signed encounters are waiting for billing.')).toBeInTheDocument();
  });

  it('shows error alert when queue fetch fails', async () => {
    mockGetBillingQueue.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Connection timeout' },
    });
    mockGetBillingQueueStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<BillingQueueDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });

  it('filters encounters by status when dropdown changes', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    // Filter to "draft" only
    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'draft');

    // Smith (no superbill) and Adams (approved) should be hidden
    expect(screen.queryByText('Smith, John')).not.toBeInTheDocument();
    expect(screen.queryByText('Adams, Mary')).not.toBeInTheDocument();
    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
  });

  it('filters encounters by awaiting status', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'awaiting');

    // Only Smith (no superbill) should appear
    expect(screen.getByText('Smith, John')).toBeInTheDocument();
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument();
    expect(screen.queryByText('Adams, Mary')).not.toBeInTheDocument();
  });

  it('filters encounters by patient name search', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search by patient name');
    await user.type(searchInput, 'doe');

    expect(screen.queryByText('Smith, John')).not.toBeInTheDocument();
    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    expect(screen.queryByText('Adams, Mary')).not.toBeInTheDocument();
  });

  it('shows filter-empty state when search excludes all encounters', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search by patient name');
    await user.type(searchInput, 'NonExistentPatient');

    expect(screen.getByText('No encounters in billing queue')).toBeInTheDocument();
    expect(screen.getByText('No encounters match the current filters.')).toBeInTheDocument();
  });

  it('refreshes data when Refresh button is clicked', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    expect(mockGetBillingQueue).toHaveBeenCalledTimes(1);
    expect(mockGetBillingQueueStats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetBillingQueue).toHaveBeenCalledTimes(2);
      expect(mockGetBillingQueueStats).toHaveBeenCalledTimes(2);
    });
  });

  it('shows error when superbill generation fails', async () => {
    mockGetBillingQueue.mockResolvedValue(MOCK_QUEUE_SUCCESS);
    mockGetBillingQueueStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockGenerateSuperbillDraft.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'ALREADY_EXISTS', message: 'Superbill already exists' },
    });

    render(<BillingQueueDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(screen.getByText('Superbill already exists')).toBeInTheDocument();
    });
  });
});
