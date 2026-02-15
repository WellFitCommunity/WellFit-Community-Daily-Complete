/**
 * EligibilityVerificationPanel tests -- validates stat cards, encounter rows,
 * Verify/Re-verify buttons, coverage badges, filters, search, empty/error/loading states.
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

const mockGetEncountersForVerification = vi.fn();
const mockGetEligibilityStats = vi.fn();
const mockVerifyEncounterEligibility = vi.fn();

vi.mock('../../../services/eligibilityVerificationService', () => ({
  eligibilityVerificationService: {
    getEncountersForVerification: (...args: unknown[]) => mockGetEncountersForVerification(...args),
    getEligibilityStats: (...args: unknown[]) => mockGetEligibilityStats(...args),
    verifyEncounterEligibility: (...args: unknown[]) => mockVerifyEncounterEligibility(...args),
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

import EligibilityVerificationPanel from '../EligibilityVerificationPanel';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_ENCOUNTERS = [
  {
    encounter_id: 'enc-1',
    patient_id: 'pat-1',
    patient_name: 'Smith, John',
    payer_name: 'Aetna',
    date_of_service: '2026-01-15',
    status: 'signed',
    coverage_status: 'unverified' as const,
    coverage_verified_at: null,
    coverage_details: null,
  },
  {
    encounter_id: 'enc-2',
    patient_id: 'pat-2',
    patient_name: 'Doe, Jane',
    payer_name: 'BlueCross',
    date_of_service: '2026-01-10',
    status: 'ready_for_billing',
    coverage_status: 'active' as const,
    coverage_verified_at: '2026-01-10T12:00:00Z',
    coverage_details: {
      plan_name: 'BC Preferred',
      subscriber_id: 'BC-12345',
      copay: 25,
      coinsurance_percent: 20,
      deductible_remaining: 500,
      effective_date: '2025-01-01',
    },
  },
  {
    encounter_id: 'enc-3',
    patient_id: 'pat-3',
    patient_name: 'Adams, Mary',
    payer_name: 'Medicare',
    date_of_service: '2026-01-08',
    status: 'billed',
    coverage_status: 'expired' as const,
    coverage_verified_at: '2026-01-09T08:00:00Z',
    coverage_details: null,
  },
];

const MOCK_STATS = {
  total_encounters: 3,
  verified_active: 1,
  unverified: 1,
  inactive_or_expired: 1,
  errors: 0,
};

const MOCK_ENCOUNTERS_SUCCESS = {
  success: true,
  data: MOCK_ENCOUNTERS,
  error: null,
};

const MOCK_STATS_SUCCESS = {
  success: true,
  data: MOCK_STATS,
  error: null,
};

const MOCK_EMPTY_ENCOUNTERS = {
  success: true,
  data: [],
  error: null,
};

const MOCK_EMPTY_STATS = {
  success: true,
  data: {
    total_encounters: 0,
    verified_active: 0,
    unverified: 0,
    inactive_or_expired: 0,
    errors: 0,
  },
  error: null,
};

// ============================================================================
// TESTS
// ============================================================================

describe('EligibilityVerificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching data', () => {
    mockGetEncountersForVerification.mockReturnValue(new Promise(() => {}));
    mockGetEligibilityStats.mockReturnValue(new Promise(() => {}));

    render(<EligibilityVerificationPanel />);

    expect(screen.getByText('Loading eligibility data...')).toBeInTheDocument();
  });

  it('displays 4 stat cards with correct labels and values', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Verified Active')).toBeInTheDocument();
    });

    // "Unverified" appears in both stat card label and dropdown option, so use getAllByText
    const unverifiedElements = screen.getAllByText('Unverified');
    expect(unverifiedElements.length).toBeGreaterThanOrEqual(2); // stat card + option

    expect(screen.getByText('Inactive / Expired')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();

    const activeCard = screen.getByText('Verified Active').closest('div');
    expect(activeCard).toHaveTextContent('1');

    // Find the stat card by its label text and verify value within that card
    const inactiveCard = screen.getByText('Inactive / Expired').closest('div');
    expect(inactiveCard).toHaveTextContent('1');
  });

  it('shows warning alert for unverified encounters', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/1 encounter with unverified coverage approaching billing/),
      ).toBeInTheDocument();
    });
  });

  it('does not show warning alert when no unverified encounters', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_EMPTY_ENCOUNTERS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Eligibility Verification')).toBeInTheDocument();
    });

    expect(screen.queryByText(/unverified coverage/)).not.toBeInTheDocument();
  });

  it('renders encounter rows with patient name, payer, and coverage badge', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    expect(screen.getByText('Adams, Mary')).toBeInTheDocument();

    // Payer names
    expect(screen.getByText('Aetna')).toBeInTheDocument();
    expect(screen.getByText('BlueCross')).toBeInTheDocument();
    expect(screen.getByText('Medicare')).toBeInTheDocument();

    // Coverage status badges — "Active" also appears in the dropdown option and
    // "Expired" also appears in the dropdown option, so use getAllByText.
    const activeElements = screen.getAllByText('Active');
    expect(activeElements.length).toBeGreaterThanOrEqual(2); // badge + option

    const expiredElements = screen.getAllByText('Expired');
    expect(expiredElements.length).toBeGreaterThanOrEqual(2); // badge + option
  });

  it('shows Verify button for unverified and Re-verify for others', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    // enc-1 is unverified => "Verify"
    const verifyButtons = screen.getAllByText('Verify');
    expect(verifyButtons.length).toBeGreaterThanOrEqual(1);

    // enc-2 (active) and enc-3 (expired) => "Re-verify"
    const reverifyButtons = screen.getAllByText('Re-verify');
    expect(reverifyButtons).toHaveLength(2);
  });

  it('calls verifyEncounterEligibility when Verify is clicked', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockVerifyEncounterEligibility.mockResolvedValue({
      success: true,
      data: { ...MOCK_ENCOUNTERS[0], coverage_status: 'active' },
      error: null,
    });

    render(<EligibilityVerificationPanel />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Verify'));

    await waitFor(() => {
      expect(mockVerifyEncounterEligibility).toHaveBeenCalledWith('enc-1');
    });
  });

  it('shows empty state when no encounters need verification', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_EMPTY_ENCOUNTERS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('No encounters need verification')).toBeInTheDocument();
    });

    expect(screen.getByText('No billable encounters found.')).toBeInTheDocument();
  });

  it('shows error alert when fetch fails', async () => {
    mockGetEncountersForVerification.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Database connection lost' },
    });
    mockGetEligibilityStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<EligibilityVerificationPanel />);

    await waitFor(() => {
      expect(screen.getByText('Database connection lost')).toBeInTheDocument();
    });
  });

  it('filters encounters by coverage status', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Filter by coverage status');
    await user.selectOptions(statusSelect, 'active');

    // Only Doe (active) should remain
    expect(screen.queryByText('Smith, John')).not.toBeInTheDocument();
    expect(screen.getByText('Doe, Jane')).toBeInTheDocument();
    expect(screen.queryByText('Adams, Mary')).not.toBeInTheDocument();
  });

  it('filters encounters by patient name search', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search by patient name');
    await user.type(searchInput, 'adams');

    expect(screen.queryByText('Smith, John')).not.toBeInTheDocument();
    expect(screen.queryByText('Doe, Jane')).not.toBeInTheDocument();
    expect(screen.getByText('Adams, Mary')).toBeInTheDocument();
  });

  it('shows filter-empty state when search excludes all encounters', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<EligibilityVerificationPanel />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Smith, John')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search by patient name');
    await user.type(searchInput, 'NonExistentPatient');

    expect(screen.getByText('No encounters need verification')).toBeInTheDocument();
    expect(screen.getByText('No encounters match the current filters.')).toBeInTheDocument();
  });

  it('shows error when verification fails', async () => {
    mockGetEncountersForVerification.mockResolvedValue(MOCK_ENCOUNTERS_SUCCESS);
    mockGetEligibilityStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockVerifyEncounterEligibility.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'No payer assigned to this encounter' },
    });

    render(<EligibilityVerificationPanel />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Verify'));

    await waitFor(() => {
      expect(screen.getByText('No payer assigned to this encounter')).toBeInTheDocument();
    });
  });
});
