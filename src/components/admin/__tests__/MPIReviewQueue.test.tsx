/**
 * MPIReviewQueue Tests
 *
 * Behavioral tests for the MPI Review Queue component covering:
 * - Loading, error, and empty states
 * - Candidate data display with patient demographics
 * - Stats card rendering
 * - Search, status filter, priority filter, sort controls
 * - Expand/collapse candidate details with lazy-loaded address
 * - Review actions (defer, not-a-match, confirm-match-and-merge)
 * - Auth gating, refresh, action loading, audit logging
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type {
  MPIMatchCandidate,
  MPIMatchStatus,
  MPIPriority,
} from '../../../services/mpiMatchingService';
import type { PatientDemographics } from '../../../types/patientContext';

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock so hoisted references resolve
// ---------------------------------------------------------------------------

const mockGetPendingCandidates = vi.fn();
const mockGetCandidateStats = vi.fn();
const mockReviewMatchCandidate = vi.fn();
const mockNavigate = vi.fn();
const mockGetBatchDemographics = vi.fn();
const mockAuditInfo = vi.fn().mockResolvedValue(undefined);
const mockAuditError = vi.fn().mockResolvedValue(undefined);
const mockSupabaseFrom = vi.fn();
const mockGetUser = vi.fn();

// ---------------------------------------------------------------------------
// vi.mock declarations
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../services/mpiMatchingService', () => ({
  mpiMatchingService: {
    getPendingCandidates: (...args: unknown[]) => mockGetPendingCandidates(...args),
    getCandidateStats: (...args: unknown[]) => mockGetCandidateStats(...args),
    reviewMatchCandidate: (...args: unknown[]) => mockReviewMatchCandidate(...args),
  },
}));

vi.mock('../../../services/patient-context', () => ({
  patientContextService: {
    getBatchDemographics: (...args: unknown[]) => mockGetBatchDemographics(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: (...args: unknown[]) => mockAuditInfo(...args),
    error: (...args: unknown[]) => mockAuditError(...args),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button data-testid={`ea-button-${variant ?? 'default'}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  EAAlert: ({
    children,
    onDismiss,
    variant,
  }: {
    children: React.ReactNode;
    onDismiss?: () => void;
    variant?: string;
    dismissible?: boolean;
  }) => (
    <div data-testid="ea-alert" data-variant={variant} role="alert">
      {children}
      {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
    </div>
  ),
}));

// ScoreBar and PatientComparisonCard use real implementations — they are
// simple presentational components that don't need mocking.

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const makeCandidates = (): MPIMatchCandidate[] => [
  {
    id: 'cand-001',
    patient_id_a: 'patient-aaa',
    patient_id_b: 'patient-bbb',
    identity_record_a: 'idr-aaa',
    identity_record_b: 'idr-bbb',
    tenant_id: 'test-tenant',
    overall_match_score: 92,
    match_algorithm_version: 'v2.1',
    field_scores: { first_name: 100, last_name: 100, dob: 80 },
    matching_fields_used: ['first_name', 'last_name', 'dob'],
    blocking_key: 'soundex:TEST',
    status: 'pending' as MPIMatchStatus,
    priority: 'high' as MPIPriority,
    reviewed_by: null,
    reviewed_at: null,
    review_decision: null,
    review_notes: null,
    auto_match_eligible: true,
    auto_match_blocked_reason: null,
    detected_at: '2026-02-20T10:00:00Z',
    created_at: '2026-02-20T10:00:00Z',
    updated_at: '2026-02-20T10:00:00Z',
  },
  {
    id: 'cand-002',
    patient_id_a: 'patient-ccc',
    patient_id_b: 'patient-ddd',
    identity_record_a: 'idr-ccc',
    identity_record_b: 'idr-ddd',
    tenant_id: 'test-tenant',
    overall_match_score: 67,
    match_algorithm_version: 'v2.1',
    field_scores: { first_name: 80, last_name: 60, dob: 60 },
    matching_fields_used: ['first_name', 'last_name'],
    blocking_key: null,
    status: 'pending' as MPIMatchStatus,
    priority: 'normal' as MPIPriority,
    reviewed_by: null,
    reviewed_at: null,
    review_decision: null,
    review_notes: null,
    auto_match_eligible: false,
    auto_match_blocked_reason: 'Score below threshold',
    detected_at: '2026-02-18T15:00:00Z',
    created_at: '2026-02-18T15:00:00Z',
    updated_at: '2026-02-18T15:00:00Z',
  },
];

const makeDemoMap = (): Map<string, PatientDemographics> =>
  new Map<string, PatientDemographics>([
    [
      'patient-aaa',
      {
        patient_id: 'patient-aaa',
        first_name: 'Test Patient',
        last_name: 'Alpha',
        dob: '2000-01-01',
        phone: '555-0100',
        mrn: 'MRN-001',
        gender: 'Female',
        preferred_language: null,
        enrollment_type: null,
        tenant_id: 'test-tenant',
      },
    ],
    [
      'patient-bbb',
      {
        patient_id: 'patient-bbb',
        first_name: 'Test Patient',
        last_name: 'Alfa',
        dob: '2000-01-01',
        phone: '555-0101',
        mrn: 'MRN-002',
        gender: 'Female',
        preferred_language: null,
        enrollment_type: null,
        tenant_id: 'test-tenant',
      },
    ],
    [
      'patient-ccc',
      {
        patient_id: 'patient-ccc',
        first_name: 'Test Patient',
        last_name: 'Beta',
        dob: '1990-06-15',
        phone: '555-0200',
        mrn: 'MRN-003',
        gender: 'Male',
        preferred_language: null,
        enrollment_type: null,
        tenant_id: 'test-tenant',
      },
    ],
    [
      'patient-ddd',
      {
        patient_id: 'patient-ddd',
        first_name: 'Test Patient',
        last_name: 'Bravo',
        dob: '1990-06-16',
        phone: '555-0201',
        mrn: null,
        gender: 'Male',
        preferred_language: null,
        enrollment_type: null,
        tenant_id: 'test-tenant',
      },
    ],
  ]);

const makeStats = () => ({
  total: 12,
  pending: 5,
  underReview: 2,
  merged: 3,
  confirmedNotMatch: 2,
  highPriority: 3,
  urgentPriority: 1,
});

// Supabase profile mock helpers
const makeProfileSelectChain = (data: Record<string, unknown> | null) => ({
  eq: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data, error: null }),
  }),
});

// ---------------------------------------------------------------------------
// Helpers — patient names render as "first_name last_name" in a single span,
// so we use regex for partial text matching throughout.
// ---------------------------------------------------------------------------

/** Wait for candidates to finish loading (indicated by patient name visible) */
const waitForCandidatesLoaded = async () => {
  await screen.findByText(/Test Patient Alpha/);
};

/** Click the summary row for a candidate (identified by last name regex) */
const clickCandidateRow = async (
  user: ReturnType<typeof userEvent.setup>,
  lastNamePattern: RegExp
) => {
  const nameEl = screen.getByText(lastNamePattern);
  // The onClick handler is on an ancestor div — clicking the name bubbles up
  await user.click(nameEl);
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MPIReviewQueue', () => {
  let MPIReviewQueue: React.FC<{ tenantId: string }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default happy-path mocks
    mockGetPendingCandidates.mockResolvedValue({
      success: true,
      data: makeCandidates(),
    });
    mockGetCandidateStats.mockResolvedValue({
      success: true,
      data: makeStats(),
    });
    mockGetBatchDemographics.mockResolvedValue({
      success: true,
      data: makeDemoMap(),
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'reviewer-001' } },
    });
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue(
        makeProfileSelectChain({
          address: '123 Test Street',
          city: 'Testville',
          state: 'TX',
          zip: '00000',
          email: 'test@example.com',
        })
      ),
    });

    const mod = await import('../mpi-review/MPIReviewQueue');
    MPIReviewQueue = mod.default;
  });

  // =========================================================================
  // Loading state
  // =========================================================================
  describe('Loading state', () => {
    it('shows "Loading candidates..." text while fetching data', async () => {
      // Make the fetch hang so loading state persists
      mockGetPendingCandidates.mockReturnValue(new Promise(() => {}));
      render(<MPIReviewQueue tenantId="test-tenant" />);
      expect(screen.getByText('Loading candidates...')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Data display
  // =========================================================================
  describe('Data display', () => {
    it('shows candidate cards with patient names after load', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      expect(screen.getByText(/Test Patient Alpha/)).toBeInTheDocument();
      expect(screen.getByText(/Test Patient Alfa/)).toBeInTheDocument();
      expect(screen.getByText(/Test Patient Beta/)).toBeInTheDocument();
      expect(screen.getByText(/Test Patient Bravo/)).toBeInTheDocument();
    });

    it('displays detected date for each candidate', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // Both candidates display their detected_at date
      const dateTexts = screen.getAllByText(/Detected \d/);
      expect(dateTexts.length).toBe(2);
    });

    it('displays match score for each candidate', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // ScoreBar renders score text — real component shows "92" and "67" as formatted
      expect(screen.getByText(/92/)).toBeInTheDocument();
      expect(screen.getByText(/67/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Stats cards
  // =========================================================================
  describe('Stats cards', () => {
    it('shows stat values from getCandidateStats', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // Stats labels are unique in the stats grid
      expect(screen.getByText('Total Candidates')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      // "Pending Review" appears both in stats and as candidate status badges,
      // so use getAllByText and verify at least 1 from the stats card
      expect(screen.getAllByText('Pending Review').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('High Priority')).toBeInTheDocument();
      // "Urgent" also appears in priority filter dropdown, use getAllByText
      expect(screen.getAllByText('Urgent').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Merged')).toBeInTheDocument();
      expect(screen.getByText('Not Matches')).toBeInTheDocument();
      // "Under Review" also in filter dropdown
      expect(screen.getAllByText('Under Review').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Error state
  // =========================================================================
  describe('Error state', () => {
    it('shows error alert when getPendingCandidates fails', async () => {
      mockGetPendingCandidates.mockResolvedValue({
        success: false,
        error: { message: 'Database connection failed', code: 'DB_ERROR' },
      });
      render(<MPIReviewQueue tenantId="test-tenant" />);
      expect(await screen.findByText('Database connection failed')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('shows error alert when fetch throws an exception', async () => {
      mockGetPendingCandidates.mockRejectedValue(new Error('Network timeout'));
      render(<MPIReviewQueue tenantId="test-tenant" />);
      expect(await screen.findByText('Network timeout')).toBeInTheDocument();
    });

    it('clears error when dismiss is clicked', async () => {
      const user = userEvent.setup();
      mockGetPendingCandidates.mockResolvedValue({
        success: false,
        error: { message: 'Temporary failure', code: 'TEMP' },
      });
      render(<MPIReviewQueue tenantId="test-tenant" />);
      expect(await screen.findByText('Temporary failure')).toBeInTheDocument();
      await user.click(screen.getByText('Dismiss'));
      expect(screen.queryByText('Temporary failure')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Empty states
  // =========================================================================
  describe('Empty states', () => {
    it('shows "All potential duplicates have been reviewed!" when pending filter yields no results', async () => {
      mockGetPendingCandidates.mockResolvedValue({ success: true, data: [] });
      render(<MPIReviewQueue tenantId="test-tenant" />);
      expect(
        await screen.findByText('All potential duplicates have been reviewed!')
      ).toBeInTheDocument();
    });

    it('shows "No candidates match your current filters." for non-pending filter with no results', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Switch status filter to "Under Review" — no candidates have that status
      const statusSelect = screen.getByDisplayValue('Pending');
      await user.selectOptions(statusSelect, 'under_review');

      expect(
        screen.getByText('No candidates match your current filters.')
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Search filter
  // =========================================================================
  describe('Search filter', () => {
    it('filters candidates by patient name when typing in search', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      const searchInput = screen.getByPlaceholderText('Search by patient name...');
      await user.type(searchInput, 'Alpha');

      // Candidate 1 (Alpha/Alfa) should be visible
      expect(screen.getByText(/Test Patient Alpha/)).toBeInTheDocument();
      // Candidate 2 (Beta/Bravo) should be hidden
      expect(screen.queryByText(/Test Patient Beta/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Test Patient Bravo/)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Status filter
  // =========================================================================
  describe('Status filter', () => {
    it('narrows candidates when a status filter is selected', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      const statusSelect = screen.getByDisplayValue('Pending');
      await user.selectOptions(statusSelect, 'confirmed_match');

      // Neither candidate has status 'confirmed_match', so empty state shows
      expect(
        screen.getByText('No candidates match your current filters.')
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Priority filter
  // =========================================================================
  describe('Priority filter', () => {
    it('narrows candidates when a priority filter is selected', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Select "High" priority — only cand-001 has high priority
      const prioritySelect = screen.getByDisplayValue('All Priorities');
      await user.selectOptions(prioritySelect, 'high');

      // Re-fetch happens because filterPriority is a dep of fetchCandidates
      await waitFor(() => {
        expect(mockGetPendingCandidates).toHaveBeenCalledWith(
          'test-tenant',
          expect.objectContaining({ priority: 'high' })
        );
      });
    });
  });

  // =========================================================================
  // Sorting
  // =========================================================================
  describe('Sorting', () => {
    it('sorts by score descending by default (higher score first)', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // Default sort is 'score' — cand-001 (92) before cand-002 (67)
      // Verify order by checking that body text has Alpha before Beta
      const bodyText = document.body.textContent ?? '';
      const alphaIdx = bodyText.indexOf('Alpha');
      const betaIdx = bodyText.indexOf('Beta');
      expect(alphaIdx).toBeGreaterThan(-1);
      expect(betaIdx).toBeGreaterThan(-1);
      expect(alphaIdx).toBeLessThan(betaIdx);
    });

    it('sorts by priority when "Sort by Priority" is selected', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      const sortSelect = screen.getByDisplayValue('Sort by Score');
      await user.selectOptions(sortSelect, 'priority');

      // priority order: high (1) < normal (2), so high (cand-001/Alpha) first
      const bodyText = document.body.textContent ?? '';
      const alphaIdx = bodyText.indexOf('Alpha');
      const betaIdx = bodyText.indexOf('Beta');
      expect(alphaIdx).toBeLessThan(betaIdx);
    });

    it('sorts by date when "Sort by Date" is selected (most recent first)', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      const sortSelect = screen.getByDisplayValue('Sort by Score');
      await user.selectOptions(sortSelect, 'date');

      // cand-001 detected 2026-02-20 > cand-002 detected 2026-02-18
      const bodyText = document.body.textContent ?? '';
      const alphaIdx = bodyText.indexOf('Alpha');
      const betaIdx = bodyText.indexOf('Beta');
      expect(alphaIdx).toBeLessThan(betaIdx);
    });
  });

  // =========================================================================
  // Expand / collapse
  // =========================================================================
  describe('Expand / collapse candidate', () => {
    it('shows "Field Match Scores" and "Patient Comparison" when a candidate row is clicked', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Before expansion, no Field Match Scores heading
      expect(screen.queryByText('Field Match Scores')).not.toBeInTheDocument();

      // Click the first candidate row via its name
      await clickCandidateRow(user, /Test Patient Alpha/);

      expect(screen.getByText('Field Match Scores')).toBeInTheDocument();
      expect(screen.getByText('Patient Comparison')).toBeInTheDocument();
    });

    it('collapses the expanded candidate when clicking the same row again', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      expect(screen.getByText('Field Match Scores')).toBeInTheDocument();

      await clickCandidateRow(user, /Test Patient Alpha/);
      expect(screen.queryByText('Field Match Scores')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Lazy-load address on expand
  // =========================================================================
  describe('Lazy-load address on expand', () => {
    it('calls supabase.from("profiles") when expanding a candidate for the first time', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      expect(mockSupabaseFrom).not.toHaveBeenCalledWith('profiles');

      await clickCandidateRow(user, /Test Patient Alpha/);

      await waitFor(() => {
        expect(mockSupabaseFrom).toHaveBeenCalledWith('profiles');
      });
    });
  });

  // =========================================================================
  // Action buttons visibility
  // =========================================================================
  describe('Action buttons when pending', () => {
    it('shows Defer, Not a Match, and Confirm Match & Merge buttons for pending candidates', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Expand candidate
      await clickCandidateRow(user, /Test Patient Alpha/);

      // Use role queries to disambiguate "Not a Match" button from dropdown option
      expect(screen.getByRole('button', { name: /Defer/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Not a Match/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm Match & Merge/ })).toBeInTheDocument();
    });

    it('does not show action buttons for non-pending candidates', async () => {
      const nonPendingCandidates = makeCandidates().map(c => ({
        ...c,
        status: 'confirmed_match' as MPIMatchStatus,
      }));
      mockGetPendingCandidates.mockResolvedValue({
        success: true,
        data: nonPendingCandidates,
      });

      const user = userEvent.setup();
      vi.resetModules();
      const mod = await import('../mpi-review/MPIReviewQueue');
      const FreshQueue = mod.default;

      render(<FreshQueue tenantId="test-tenant" />);
      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('Loading candidates...')).not.toBeInTheDocument();
      });
      // Switch to "Confirmed Match" to see the non-pending candidates
      const statusSelect = screen.getByDisplayValue('Pending');
      await user.selectOptions(statusSelect, 'confirmed_match');

      // Expand the first candidate
      await clickCandidateRow(user, /Test Patient Alpha/);

      // Action buttons should NOT be present for non-pending candidates
      expect(screen.queryByRole('button', { name: /Defer/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Confirm Match & Merge/ })).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Defer action
  // =========================================================================
  describe('Defer action', () => {
    it('calls reviewMatchCandidate with "deferred" when Defer is clicked', async () => {
      mockReviewMatchCandidate.mockResolvedValue({
        success: true,
        data: { ...makeCandidates()[0], status: 'deferred' },
      });
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByText('Defer'));

      await waitFor(() => {
        expect(mockReviewMatchCandidate).toHaveBeenCalledWith(
          'cand-001',
          'reviewer-001',
          'deferred',
          'Deferred for later review'
        );
      });
    });
  });

  // =========================================================================
  // Not a Match action
  // =========================================================================
  describe('Not a Match action', () => {
    it('calls reviewMatchCandidate with "confirmed_not_match" when Not a Match is clicked', async () => {
      mockReviewMatchCandidate.mockResolvedValue({
        success: true,
        data: { ...makeCandidates()[0], status: 'confirmed_not_match' },
      });
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByRole('button', { name: /Not a Match/ }));

      await waitFor(() => {
        expect(mockReviewMatchCandidate).toHaveBeenCalledWith(
          'cand-001',
          'reviewer-001',
          'confirmed_not_match',
          'Confirmed as different patients'
        );
      });
    });
  });

  // =========================================================================
  // Confirm Match & Merge action
  // =========================================================================
  describe('Confirm Match & Merge action', () => {
    it('calls reviewMatchCandidate then navigates to the merge page', async () => {
      mockReviewMatchCandidate.mockResolvedValue({
        success: true,
        data: { ...makeCandidates()[0], status: 'confirmed_match' },
      });
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByText('Confirm Match & Merge'));

      await waitFor(() => {
        expect(mockReviewMatchCandidate).toHaveBeenCalledWith(
          'cand-001',
          'reviewer-001',
          'confirmed_match',
          'Confirmed as same patient'
        );
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/admin/mpi/merge?candidateId=cand-001')
        );
      });
    });
  });

  // =========================================================================
  // Auth required for actions
  // =========================================================================
  describe('Action requires authentication', () => {
    it('shows error when supabase.auth.getUser returns no user', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByText('Defer'));

      expect(
        await screen.findByText('You must be logged in to review candidates')
      ).toBeInTheDocument();
      expect(mockReviewMatchCandidate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Refresh button
  // =========================================================================
  describe('Refresh button', () => {
    it('re-fetches candidates when Refresh is clicked', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Initial fetch = 1 call
      expect(mockGetPendingCandidates).toHaveBeenCalledTimes(1);

      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(mockGetPendingCandidates).toHaveBeenCalledTimes(2);
      });
    });
  });

  // =========================================================================
  // Action loading state
  // =========================================================================
  describe('Action loading state', () => {
    it('disables action buttons while a review action is in progress', async () => {
      // Make the review call hang
      mockReviewMatchCandidate.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByText('Defer'));

      // All three buttons should be disabled
      await waitFor(() => {
        const deferBtn = screen.getByRole('button', { name: /Defer/ });
        const notMatchBtn = screen.getByRole('button', { name: /Not a Match/ });
        const mergeBtn = screen.getByRole('button', { name: /Confirm Match & Merge/ });
        expect(deferBtn).toBeDisabled();
        expect(notMatchBtn).toBeDisabled();
        expect(mergeBtn).toBeDisabled();
      });
    });
  });

  // =========================================================================
  // Algorithm info in expanded view
  // =========================================================================
  describe('Algorithm info in expanded view', () => {
    it('shows algorithm version, blocking key, and auto-merge eligibility', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);

      expect(screen.getByText(/v2\.1/)).toBeInTheDocument();
      expect(screen.getByText(/soundex:TEST/)).toBeInTheDocument();
      expect(screen.getByText(/Auto-merge eligible: Yes/)).toBeInTheDocument();
    });

    it('shows "N/A" for blocking key when null', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      // Expand cand-002 (Beta/Bravo) which has blocking_key = null
      await clickCandidateRow(user, /Test Patient Beta/);

      expect(screen.getByText(/Blocking Key: N\/A/)).toBeInTheDocument();
      expect(screen.getByText(/Auto-merge eligible: No/)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Audit logging
  // =========================================================================
  describe('Audit logging', () => {
    it('calls auditLogger.info with MPI_QUEUE_VIEWED on successful load', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      expect(mockAuditInfo).toHaveBeenCalledWith(
        'MPI_QUEUE_VIEWED',
        expect.objectContaining({
          tenantId: 'test-tenant',
          candidateCount: 2,
        })
      );
    });

    it('calls auditLogger.error with MPI_QUEUE_FETCH_FAILED when fetch throws', async () => {
      mockGetPendingCandidates.mockRejectedValue(new Error('Connection lost'));
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await screen.findByText('Connection lost');

      expect(mockAuditError).toHaveBeenCalledWith(
        'MPI_QUEUE_FETCH_FAILED',
        expect.objectContaining({ message: 'Connection lost' }),
        expect.objectContaining({ tenantId: 'test-tenant' })
      );
    });
  });

  // =========================================================================
  // Review error from service
  // =========================================================================
  describe('Review action error handling', () => {
    it('shows error alert when reviewMatchCandidate returns failure', async () => {
      mockReviewMatchCandidate.mockResolvedValue({
        success: false,
        error: { message: 'Candidate already reviewed', code: 'CONFLICT' },
      });
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);
      await user.click(screen.getByText('Defer'));

      expect(await screen.findByText('Candidate already reviewed')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Header content
  // =========================================================================
  describe('Header content', () => {
    it('renders the queue title and description', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      expect(screen.getByText('MPI Review Queue')).toBeInTheDocument();
      expect(screen.getByText('Review and manage potential duplicate patient records')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Priority badge display
  // =========================================================================
  describe('Priority badge display', () => {
    it('shows priority labels for each candidate', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // cand-001 has "High" priority badge, cand-002 has "Normal" priority badge.
      // "High" and "Normal" also appear in the priority filter dropdown,
      // so use getAllByText to verify at least one instance from candidate badges.
      const highElements = screen.getAllByText('High');
      const normalElements = screen.getAllByText('Normal');
      // Filter dropdown has one "High" and one "Normal"; candidate badges add more
      expect(highElements.length).toBeGreaterThanOrEqual(2);
      expect(normalElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Status badge display
  // =========================================================================
  describe('Status badge display', () => {
    it('shows status labels for each candidate', async () => {
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();
      // Both candidates are "pending", which maps to "Pending Review" label
      const pendingLabels = screen.getAllByText('Pending Review');
      // At least 2 from candidate cards (stats card also has "Pending Review")
      expect(pendingLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Field scores in expanded view
  // =========================================================================
  describe('Field scores in expanded view', () => {
    it('renders individual field score bars when expanded', async () => {
      const user = userEvent.setup();
      render(<MPIReviewQueue tenantId="test-tenant" />);
      await waitForCandidatesLoaded();

      await clickCandidateRow(user, /Test Patient Alpha/);

      // Field names from field_scores: first_name, last_name, dob
      // The component renders them via ScoreBar with capitalized field names
      expect(screen.getByText('Field Match Scores')).toBeInTheDocument();
      // The real ScoreBar renders the score with "%" format
      // first_name: 100, last_name: 100, dob: 80
      const scoreTexts = screen.getAllByText(/\d+%/);
      expect(scoreTexts.length).toBeGreaterThanOrEqual(3);
    });
  });
});
