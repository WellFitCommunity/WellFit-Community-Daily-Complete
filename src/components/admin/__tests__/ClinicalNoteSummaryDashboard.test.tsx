/**
 * ClinicalNoteSummaryDashboard tests — validates metric cards, clinical note list
 * with type/status badges, note selection detail panel, progress notes tab with
 * confidence display, and loading/error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
    ai: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card">{children}</div>
  ),
  EACardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-header">{children}</div>
  ),
  EACardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-content">{children}</div>
  ),
  EAButton: ({ children, onClick, variant, size }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  EABadge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
  EAMetricCard: ({ label, value, sublabel, riskLevel }: {
    label: string;
    value: string | number;
    sublabel?: string;
    riskLevel?: string;
  }) => (
    <div data-testid="ea-metric-card" data-risk-level={riskLevel}>
      <span data-testid="metric-label">{label}</span>
      <span data-testid="metric-value">{String(value)}</span>
      {sublabel && <span data-testid="metric-sublabel">{sublabel}</span>}
    </div>
  ),
  EAAlert: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div role="alert" data-variant={variant}>{children}</div>
  ),
  EATabs: ({ children, defaultValue, value, onValueChange }: {
    children: React.ReactNode;
    defaultValue?: string;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="ea-tabs" data-value={value} data-default={defaultValue}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange });
        }
        return child;
      })}
    </div>
  ),
  EATabsList: ({ children, onValueChange }: {
    children: React.ReactNode;
    onValueChange?: (v: string) => void;
  }) => (
    <div data-testid="ea-tabs-list" role="tablist">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange });
        }
        return child;
      })}
    </div>
  ),
  EATabsTrigger: ({ children, value, onValueChange }: {
    children: React.ReactNode;
    value: string;
    onValueChange?: (v: string) => void;
  }) => (
    <button role="tab" data-value={value} onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  ),
}));

import ClinicalNoteSummaryDashboard from '../ClinicalNoteSummaryDashboard';

// ============================================================================
// FIXTURES — synthetic test data only
// ============================================================================

const MOCK_CLINICAL_NOTES = [
  {
    id: 'note-alpha-001',
    patient_id: 'patient-alpha',
    encounter_id: 'enc-alpha-001',
    note_type: 'soap',
    note_content: 'Test Patient Alpha presented with mild cough and congestion. Assessment indicates upper respiratory infection. Plan includes rest and fluids.',
    status: 'draft',
    created_by: 'provider-test-001',
    created_at: '2026-01-15T10:00:00Z',
    is_locked: true,
    locked_at: '2026-01-15T14:00:00Z',
    locked_by: 'provider-test-001',
    ai_generated: true,
    reviewed_by: 'reviewer-test-001',
    reviewed_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'note-beta-002',
    patient_id: 'patient-beta',
    encounter_id: 'enc-beta-002',
    note_type: 'progress',
    note_content: 'Test Patient Beta follow-up for chronic condition management. Vitals stable.',
    status: 'draft',
    created_by: 'provider-test-002',
    created_at: '2026-01-16T09:00:00Z',
    is_locked: false,
    locked_at: null,
    locked_by: null,
    ai_generated: true,
    reviewed_by: 'reviewer-test-002',
    reviewed_at: '2026-01-16T11:00:00Z',
  },
  {
    id: 'note-gamma-003',
    patient_id: 'patient-gamma',
    encounter_id: 'enc-gamma-003',
    note_type: 'discharge',
    note_content: 'Test Patient Gamma discharge summary. Condition improved. Discharge to home with follow-up in 7 days.',
    status: 'draft',
    created_by: null,
    created_at: '2026-01-17T15:00:00Z',
    is_locked: false,
    locked_at: null,
    locked_by: null,
    ai_generated: true,
    reviewed_by: null,
    reviewed_at: null,
  },
];

const MOCK_PROGRESS_NOTES = [
  {
    id: 'prog-alpha-001',
    patient_id: 'patient-alpha',
    encounter_id: 'enc-alpha-001',
    synthesis_type: 'daily_summary',
    content: 'Synthesized daily progress for Test Patient Alpha. Overall status improving.',
    confidence_score: 0.92,
    model_used: 'claude-sonnet-4-5-20250929',
    created_at: '2026-01-15T18:00:00Z',
    reviewed: true,
    reviewer_id: 'reviewer-test-001',
  },
  {
    id: 'prog-beta-002',
    patient_id: 'patient-beta',
    encounter_id: null,
    synthesis_type: 'shift_handoff',
    content: 'Shift handoff synthesis for Test Patient Beta. Medication adherence noted.',
    confidence_score: 0.65,
    model_used: null,
    created_at: '2026-01-16T06:00:00Z',
    reviewed: false,
    reviewer_id: null,
  },
  {
    id: 'prog-gamma-003',
    patient_id: 'patient-gamma',
    encounter_id: null,
    synthesis_type: 'care_coordination',
    content: 'Care coordination notes for Test Patient Gamma.',
    confidence_score: null,
    model_used: 'claude-sonnet-4-5-20250929',
    created_at: '2026-01-17T12:00:00Z',
    reviewed: false,
    reviewer_id: null,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function buildSupabaseChain(data: unknown[], error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

function setupSuccessMocks(
  clinicalNotes = MOCK_CLINICAL_NOTES,
  progressNotes = MOCK_PROGRESS_NOTES,
) {
  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount % 2 === 1) {
      // clinical_notes query (has .eq chain)
      return buildSupabaseChain(clinicalNotes);
    }
    // ai_progress_notes query (no .eq chain — uses .order directly)
    return buildSupabaseChain(progressNotes);
  });
}

function setupErrorMocks(errorMessage: string) {
  // The component does `if (notesError) throw notesError;`
  // Since the thrown object is not an Error instance, the catch block
  // uses the fallback: 'Failed to load notes'. To test with our custom
  // message, throw an actual Error via .mockRejectedValue.
  const error = new Error(errorMessage);
  mockFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(error),
        }),
      }),
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(error),
      }),
    }),
  }));
}

// ============================================================================
// TESTS
// ============================================================================

describe('ClinicalNoteSummaryDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Tier 2: State — Loading ----------

  it('shows loading spinner while data is being fetched', () => {
    // Return a promise that never resolves to keep loading state
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(new Promise(() => {})),
          }),
        }),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue(new Promise(() => {})),
        }),
      }),
    }));

    render(<ClinicalNoteSummaryDashboard />);

    expect(screen.getByText('Loading clinical notes...')).toBeInTheDocument();
  });

  // ---------- Tier 1: Behavior — Metric Cards ----------

  it('displays metric cards with correct totals after data loads', async () => {
    setupSuccessMocks();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI-Generated Notes')).toBeInTheDocument();
    });

    // totalAINotes = 3 clinical + 3 progress = 6
    expect(screen.getByText('6')).toBeInTheDocument();

    // pendingReview: clinical pending (not reviewed and not locked) = note-gamma-003 = 1
    // progress pending (not reviewed) = prog-beta-002 + prog-gamma-003 = 2
    // total = 3
    // Verify through the metric card structure
    const metricCards = screen.getAllByTestId('ea-metric-card');
    const pendingCard = metricCards.find(
      (card) => card.querySelector('[data-testid="metric-label"]')?.textContent === 'Pending Review'
    );
    expect(pendingCard).toBeTruthy();
    const pendingValue = pendingCard?.querySelector('[data-testid="metric-value"]');
    expect(pendingValue?.textContent).toBe('3');

    // approved: clinical (reviewed_by or is_locked) = note-alpha-001 + note-beta-002 = 2
    // progress reviewed = prog-alpha-001 = 1
    // total = 3
    const approvedCard = metricCards.find(
      (card) => card.querySelector('[data-testid="metric-label"]')?.textContent === 'Approved'
    );
    expect(approvedCard).toBeTruthy();
    const approvedValue = approvedCard?.querySelector('[data-testid="metric-value"]');
    expect(approvedValue?.textContent).toBe('3');

    // avgConfidence: (0.92 + 0.65) / 2 = 0.785 -> Math.round(78.5) = 79 -> "79%"
    const confidenceCard = metricCards.find(
      (card) => card.querySelector('[data-testid="metric-label"]')?.textContent === 'Avg Confidence'
    );
    expect(confidenceCard).toBeTruthy();
    const confidenceValue = confidenceCard?.querySelector('[data-testid="metric-value"]');
    expect(confidenceValue?.textContent).toBe('79%');
  });

  // ---------- Tier 1: Behavior — Clinical Notes List ----------

  it('shows clinical notes list with note type badges', async () => {
    setupSuccessMocks();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('SOAP')).toBeInTheDocument();
    });

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Discharge')).toBeInTheDocument();
  });

  it('shows correct review status badges for each note', async () => {
    setupSuccessMocks();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      // note-alpha-001: is_locked=true -> "Signed"
      expect(screen.getByText('Signed')).toBeInTheDocument();
    });

    // note-beta-002: reviewed_by set, not locked -> "Reviewed"
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    // note-gamma-003: not reviewed, not locked -> "Pending Review"
    // "Pending Review" also appears as metric card label, so use getAllByText
    const pendingReviewItems = screen.getAllByText('Pending Review');
    expect(pendingReviewItems.length).toBeGreaterThanOrEqual(2); // metric label + badge
  });

  // ---------- Tier 4: Edge Cases — Empty State ----------

  it('shows empty state message when no AI-generated clinical notes exist', async () => {
    setupSuccessMocks([], []);
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText('No AI-generated clinical notes found.')
      ).toBeInTheDocument();
    });
  });

  // ---------- Tier 1: Behavior — Note Selection ----------

  it('clicking a note selects it and shows detail panel with full content', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    // Wait for notes to load
    await waitFor(() => {
      expect(screen.getByText('SOAP')).toBeInTheDocument();
    });

    // Before selection, detail panel shows placeholder
    expect(screen.getByText('Select a note to view details')).toBeInTheDocument();

    // Click the first note (SOAP note)
    const soapNoteButton = screen.getByText(/Test Patient Alpha presented with mild cough/);
    await user.click(soapNoteButton.closest('button') as HTMLElement);

    // Detail panel should now show the full content
    await waitFor(() => {
      expect(
        screen.getByText(
          'Test Patient Alpha presented with mild cough and congestion. Assessment indicates upper respiratory infection. Plan includes rest and fluids.'
        )
      ).toBeInTheDocument();
    });

    // Should show "Created:" label with date
    expect(screen.getByText('Created:')).toBeInTheDocument();
  });

  it('shows AI Generated badge in note detail panel', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('SOAP')).toBeInTheDocument();
    });

    // Click the SOAP note
    const soapNoteButton = screen.getByText(/Test Patient Alpha presented with mild cough/);
    await user.click(soapNoteButton.closest('button') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('AI Generated')).toBeInTheDocument();
    });
  });

  it('shows reviewed date in detail panel for reviewed notes', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('SOAP')).toBeInTheDocument();
    });

    // Click the SOAP note (has reviewed_by set)
    const soapNoteButton = screen.getByText(/Test Patient Alpha presented with mild cough/);
    await user.click(soapNoteButton.closest('button') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Reviewed:')).toBeInTheDocument();
    });
  });

  it('shows signed date in detail panel for locked notes', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('SOAP')).toBeInTheDocument();
    });

    // Click the SOAP note (has is_locked=true)
    const soapNoteButton = screen.getByText(/Test Patient Alpha presented with mild cough/);
    await user.click(soapNoteButton.closest('button') as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText('Signed:')).toBeInTheDocument();
    });
  });

  // ---------- Tier 1: Behavior — Progress Notes Tab ----------

  it('progress notes tab shows table with confidence percentages', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Note Summarization')).toBeInTheDocument();
    });

    // Switch to progress notes tab
    const progressTab = screen.getByRole('tab', { name: /AI Progress Notes/i });
    await user.click(progressTab);

    await waitFor(() => {
      expect(screen.getByText('AI Progress Note Syntheses')).toBeInTheDocument();
    });

    // Confidence scores: 0.92 -> 92%, 0.65 -> 65%, null -> N/A
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();

    // Synthesis types
    expect(screen.getByText('daily_summary')).toBeInTheDocument();
    expect(screen.getByText('shift_handoff')).toBeInTheDocument();

    // Model - null defaults to 'Claude'
    expect(screen.getByText('Claude')).toBeInTheDocument();
    // Two notes use claude-sonnet-4-5-20250929
    const modelTexts = screen.getAllByText('claude-sonnet-4-5-20250929');
    expect(modelTexts.length).toBe(2);

    // Review status badges
    const reviewedBadges = screen.getAllByText('Reviewed');
    expect(reviewedBadges.length).toBeGreaterThanOrEqual(1);
    const pendingBadges = screen.getAllByText('Pending');
    expect(pendingBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('progress notes tab shows empty state when no progress notes exist', async () => {
    setupSuccessMocks(MOCK_CLINICAL_NOTES, []);
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Note Summarization')).toBeInTheDocument();
    });

    const progressTab = screen.getByRole('tab', { name: /AI Progress Notes/i });
    await user.click(progressTab);

    await waitFor(() => {
      expect(screen.getByText('No AI progress notes found.')).toBeInTheDocument();
    });
  });

  // ---------- Tier 2: State — Error ----------

  it('error state displays warning alert with error message', async () => {
    setupErrorMocks('Database connection timeout');
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Database connection timeout')).toBeInTheDocument();
    });

    // Alert should have warning variant
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('data-variant', 'warning');
  });

  // ---------- Tier 1: Behavior — Pending Review Risk Level ----------

  it('pending review metric card shows elevated risk when count exceeds 10', async () => {
    // Create 12 pending clinical notes (not reviewed, not locked) to exceed threshold
    const manyPendingNotes = Array.from({ length: 12 }, (_, i) => ({
      id: `note-pending-${i}`,
      patient_id: `patient-pending-${i}`,
      encounter_id: `enc-pending-${i}`,
      note_type: 'soap' as const,
      note_content: `Pending note content ${i}`,
      status: 'draft' as const,
      created_by: null,
      created_at: '2026-01-20T10:00:00Z',
      is_locked: false as const,
      locked_at: null,
      locked_by: null,
      ai_generated: true as const,
      reviewed_by: null,
      reviewed_at: null,
    })) as typeof MOCK_CLINICAL_NOTES;

    setupSuccessMocks(manyPendingNotes, []);
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI-Generated Notes')).toBeInTheDocument();
    });

    // Find the Pending Review metric card and check its risk level
    const metricCards = screen.getAllByTestId('ea-metric-card');
    const pendingCard = metricCards.find(
      (card) => card.querySelector('[data-testid="metric-label"]')?.textContent === 'Pending Review'
    );
    expect(pendingCard).toBeTruthy();
    expect(pendingCard).toHaveAttribute('data-risk-level', 'elevated');
  });

  // ---------- Tier 3: Integration — Refresh ----------

  it('refresh button triggers data reload', async () => {
    setupSuccessMocks();
    const user = userEvent.setup();
    render(<ClinicalNoteSummaryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCallCount = mockFrom.mock.calls.length;

    // Re-setup mocks for the second call
    setupSuccessMocks();
    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
