/**
 * ProviderAssignmentDashboard tests — validates metric cards, encounter queue,
 * status filtering, needs-provider filtering, expandable rows, and empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: unknown[]) => {
          mockSelect(...sArgs);
          return {
            in: (...iArgs: unknown[]) => {
              mockIn(...iArgs);
              return {
                order: (...oArgs: unknown[]) => {
                  mockOrder(...oArgs);
                  return {
                    limit: (...lArgs: unknown[]) => {
                      mockLimit(...lArgs);
                      return mockLimit();
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
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

// Mock EncounterProviderPanel so we can detect it renders without full setup
vi.mock('../EncounterProviderPanel', () => ({
  EncounterProviderPanel: ({ encounterId }: { encounterId: string }) => (
    <div data-testid={`provider-panel-${encounterId}`}>Provider Panel: {encounterId}</div>
  ),
}));

import ProviderAssignmentDashboard from '../ProviderAssignmentDashboard';

// ============================================================================
// HELPERS
// ============================================================================

interface MockEncounter {
  id: string;
  patient_id: string;
  date_of_service: string;
  status: string;
  created_at: string;
  patient: { first_name: string; last_name: string } | null;
  providers: { id: string; role: string; provider_id: string; removed_at: string | null }[];
}

const MOCK_ENCOUNTERS: MockEncounter[] = [
  {
    id: 'enc-1',
    patient_id: 'pat-1',
    date_of_service: '2026-02-14',
    status: 'in_progress',
    created_at: '2026-02-14T08:00:00Z',
    patient: { first_name: 'John', last_name: 'Doe' },
    providers: [
      { id: 'ep-1', role: 'attending', provider_id: 'prov-1', removed_at: null },
    ],
  },
  {
    id: 'enc-2',
    patient_id: 'pat-2',
    date_of_service: '2026-02-14',
    status: 'draft',
    created_at: '2026-02-14T09:00:00Z',
    patient: { first_name: 'Jane', last_name: 'Smith' },
    providers: [],
  },
  {
    id: 'enc-3',
    patient_id: 'pat-3',
    date_of_service: '2026-02-13',
    status: 'scheduled',
    created_at: '2026-02-13T10:00:00Z',
    patient: { first_name: 'Bob', last_name: 'Wilson' },
    providers: [
      { id: 'ep-2', role: 'consulting', provider_id: 'prov-2', removed_at: null },
    ],
  },
];

function setupDefaultMock(data: MockEncounter[] = MOCK_ENCOUNTERS) {
  mockLimit.mockResolvedValue({ data, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ProviderAssignmentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMock();
  });

  // ---------- Tier 1: Behavior ----------

  it('renders metric cards with correct counts', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Active Encounters')).toBeInTheDocument();
    });

    // 3 encounters total, enc-2 and enc-3 missing attending, enc-1 has attending
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays encounter rows with patient name and status', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();

    // Status labels appear in both filter dropdown and rows — use getAllByText
    expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Needs Attending" badge for encounters without attending', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Smith')).toBeInTheDocument();
    });

    const needsBadges = screen.getAllByText('Needs Attending');
    // enc-2 (no providers) and enc-3 (only consulting, no attending) should show badge
    expect(needsBadges).toHaveLength(2);
  });

  it('shows provider count for encounters with attending', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1 Provider')).toBeInTheDocument();
    });
  });

  it('expanding a row renders the EncounterProviderPanel', async () => {
    const user = userEvent.setup();
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Click first encounter row
    await user.click(screen.getByText('J. Doe'));

    await waitFor(() => {
      expect(screen.getByTestId('provider-panel-enc-1')).toBeInTheDocument();
      expect(screen.getByText('Provider Panel: enc-1')).toBeInTheDocument();
    });
  });

  it('collapsing a row hides the EncounterProviderPanel', async () => {
    const user = userEvent.setup();
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Expand
    await user.click(screen.getByText('J. Doe'));
    await waitFor(() => {
      expect(screen.getByTestId('provider-panel-enc-1')).toBeInTheDocument();
    });

    // Collapse
    await user.click(screen.getByText('J. Doe'));
    await waitFor(() => {
      expect(screen.queryByTestId('provider-panel-enc-1')).not.toBeInTheDocument();
    });
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockLimit.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ProviderAssignmentDashboard />);

    expect(screen.getByText('Loading encounters...')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load encounters. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows empty state when no encounters exist', async () => {
    setupDefaultMock([]);

    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No encounters found')).toBeInTheDocument();
    });
  });

  it('shows warning alert when encounters are missing attending', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 encounters missing an attending provider/)).toBeInTheDocument();
    });
  });

  // ---------- Tier 3: Integration ----------

  it('queries encounters table with active statuses', async () => {
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('encounters');
    });

    expect(mockIn).toHaveBeenCalledWith('status', [
      'draft', 'scheduled', 'arrived', 'triaged', 'in_progress', 'ready_for_sign',
    ]);
  });

  it('refresh button reloads data', async () => {
    const user = userEvent.setup();
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCallCount = mockFrom.mock.calls.length;

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // ---------- Tier 1: Filters ----------

  it('filter by status shows only matching encounters', async () => {
    const user = userEvent.setup();
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'draft');

    // Only enc-2 (draft) should be visible
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.queryByText('J. Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('B. Wilson')).not.toBeInTheDocument();
  });

  it('needs provider filter shows only encounters without attending', async () => {
    const user = userEvent.setup();
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const checkbox = screen.getByLabelText('Needs provider only');
    await user.click(checkbox);

    // enc-1 (has attending) should be hidden; enc-2 and enc-3 visible
    expect(screen.queryByText('J. Doe')).not.toBeInTheDocument();
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
  });

  it('filtered empty state shows appropriate message', async () => {
    const user = userEvent.setup();

    // All encounters have attending
    setupDefaultMock([MOCK_ENCOUNTERS[0]]);
    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const checkbox = screen.getByLabelText('Needs provider only');
    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByText('All active encounters have an attending provider assigned.')).toBeInTheDocument();
    });
  });

  // ---------- Tier 4: Edge cases ----------

  it('handles encounters with removed providers correctly', async () => {
    setupDefaultMock([
      {
        id: 'enc-removed',
        patient_id: 'pat-r',
        date_of_service: '2026-02-14',
        status: 'draft',
        created_at: '2026-02-14T10:00:00Z',
        patient: { first_name: 'Alice', last_name: 'Removed' },
        providers: [
          { id: 'ep-r', role: 'attending', provider_id: 'prov-1', removed_at: '2026-02-14T11:00:00Z' },
        ],
      },
    ]);

    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('A. Removed')).toBeInTheDocument();
    });

    // Provider was removed, so should show Needs Attending
    expect(screen.getByText('Needs Attending')).toBeInTheDocument();
  });

  it('handles null patient gracefully', async () => {
    setupDefaultMock([
      {
        id: 'enc-null',
        patient_id: 'pat-null',
        date_of_service: '2026-02-14',
        status: 'draft',
        created_at: '2026-02-14T10:00:00Z',
        patient: null,
        providers: [],
      },
    ]);

    render(<ProviderAssignmentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});
