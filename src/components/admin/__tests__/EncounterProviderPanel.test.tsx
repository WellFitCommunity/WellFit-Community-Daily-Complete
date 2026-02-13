/**
 * EncounterProviderPanel tests — validates provider assignment display,
 * assign/remove workflows, editability gating, and audit trail display.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetEncounterProviders = vi.fn();
const mockAssignProvider = vi.fn();
const mockRemoveProvider = vi.fn();
const mockGetProviderAuditTrail = vi.fn();

vi.mock('../../../services/encounterProviderService', () => ({
  encounterProviderService: {
    getEncounterProviders: (...args: unknown[]) => mockGetEncounterProviders(...args),
    assignProvider: (...args: unknown[]) => mockAssignProvider(...args),
    removeProvider: (...args: unknown[]) => mockRemoveProvider(...args),
    getProviderAuditTrail: (...args: unknown[]) => mockGetProviderAuditTrail(...args),
  },
}));

const mockGetUser = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              { id: 'prov-1', npi: '1234567890', organization_name: 'Dr. Smith', taxonomy_code: '207R00000X' },
              { id: 'prov-2', npi: '0987654321', organization_name: 'Dr. Jones', taxonomy_code: '208D00000X' },
              { id: 'prov-3', npi: '1112223334', organization_name: 'Dr. Lee', taxonomy_code: '207Q00000X' },
            ],
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clinical: vi.fn(),
  },
}));

import { EncounterProviderPanel } from '../EncounterProviderPanel';

// ============================================================================
// HELPERS
// ============================================================================

const MOCK_ATTENDING = {
  id: 'assign-1',
  encounter_id: 'enc-1',
  provider_id: 'prov-1',
  role: 'attending' as const,
  is_primary: true,
  assigned_at: '2026-02-13T10:00:00Z',
  assigned_by: 'user-1',
  removed_at: null,
  removed_by: null,
  notes: null,
  tenant_id: 'tenant-1',
  created_at: '2026-02-13T10:00:00Z',
  updated_at: '2026-02-13T10:00:00Z',
  provider: {
    id: 'prov-1',
    npi: '1234567890',
    organization_name: 'Dr. Smith',
    taxonomy_code: '207R00000X',
    user_id: null,
  },
};

const MOCK_CONSULTING = {
  ...MOCK_ATTENDING,
  id: 'assign-2',
  provider_id: 'prov-2',
  role: 'consulting' as const,
  is_primary: false,
  provider: {
    id: 'prov-2',
    npi: '0987654321',
    organization_name: 'Dr. Jones',
    taxonomy_code: '208D00000X',
    user_id: null,
  },
};

function setupDefaults() {
  mockGetEncounterProviders.mockResolvedValue({
    success: true,
    data: [MOCK_ATTENDING, MOCK_CONSULTING],
  });
  mockGetProviderAuditTrail.mockResolvedValue({
    success: true,
    data: [],
  });
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'current-user-id' } },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('EncounterProviderPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ---------- Tier 1: Behavior ----------

  it('displays assigned providers with names and roles', async () => {
    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('Dr. Jones')).toBeInTheDocument();
    });

    expect(screen.getByText('Attending Provider')).toBeInTheDocument();
    expect(screen.getByText('Consulting Provider')).toBeInTheDocument();
  });

  it('shows warning when no attending provider is assigned', async () => {
    mockGetEncounterProviders.mockResolvedValue({
      success: true,
      data: [MOCK_CONSULTING],
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    await waitFor(() => {
      expect(screen.getByText(/no attending provider assigned/i)).toBeInTheDocument();
    });
  });

  it('shows assign button only when encounter is editable', async () => {
    const { rerender } = render(
      <EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" />
    );

    await waitFor(() => {
      expect(screen.getByText('Assign')).toBeInTheDocument();
    });

    rerender(
      <EncounterProviderPanel encounterId="enc-1" encounterStatus="signed" />
    );

    await waitFor(() => {
      expect(screen.queryByText('Assign')).not.toBeInTheDocument();
    });
  });

  it('shows locked message for finalized encounters', async () => {
    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="signed" />);

    await waitFor(() => {
      expect(screen.getByText(/provider assignments are locked/i)).toBeInTheDocument();
    });
  });

  it('opens assign form and calls service with correct parameters', async () => {
    const user = userEvent.setup();
    mockAssignProvider.mockResolvedValue({
      success: true,
      data: { success: true, assignment_id: 'new-assign' },
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    await waitFor(() => {
      expect(screen.getByText('Assign')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Assign'));

    await waitFor(() => {
      expect(screen.getByText('New Provider Assignment')).toBeInTheDocument();
    });

    // Select a provider from dropdown (Dr. Lee — unassigned)
    const selects = screen.getAllByRole('combobox');
    const providerSelect = selects[0];
    await user.selectOptions(providerSelect, 'prov-3');

    // Role defaults to attending; click the submit button
    await user.click(screen.getByText('Assign Provider'));

    await waitFor(() => {
      expect(mockAssignProvider).toHaveBeenCalledWith(
        'enc-1',
        'prov-3',
        'attending',
        'current-user-id',
        undefined
      );
    });
  });

  it('shows remove confirmation with reason field before removing', async () => {
    const user = userEvent.setup();
    mockRemoveProvider.mockResolvedValue({
      success: true,
      data: { success: true },
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    // Click the remove button (UserMinus icon)
    const removeButtons = screen.getAllByRole('button').filter(
      btn => btn.querySelector('svg.lucide-user-minus') !== null
    );
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/remove attending provider/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/why is this provider being removed/i)).toBeInTheDocument();
    });
  });

  it('hides remove buttons when encounter is finalized', async () => {
    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="completed" />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole('button').filter(
      btn => btn.querySelector('svg.lucide-user-minus') !== null
    );
    expect(removeButtons).toHaveLength(0);
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockGetEncounterProviders.mockReturnValue(new Promise(() => {})); // never resolves

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    expect(screen.getByText('Loading providers...')).toBeInTheDocument();
  });

  it('shows error message when provider fetch fails', async () => {
    mockGetEncounterProviders.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('shows empty state when no providers assigned', async () => {
    mockGetEncounterProviders.mockResolvedValue({
      success: true,
      data: [],
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    await waitFor(() => {
      expect(screen.getByText('No providers assigned to this encounter')).toBeInTheDocument();
    });
  });

  // ---------- Tier 3: Integration ----------

  it('calls getEncounterProviders with correct encounter ID', async () => {
    render(<EncounterProviderPanel encounterId="enc-42" encounterStatus="draft" />);

    await waitFor(() => {
      expect(mockGetEncounterProviders).toHaveBeenCalledWith('enc-42');
    });
  });

  it('calls onProviderChange callback after successful assignment', async () => {
    const onProviderChange = vi.fn();
    const user = userEvent.setup();
    mockAssignProvider.mockResolvedValue({
      success: true,
      data: { success: true, assignment_id: 'new-assign' },
    });

    render(
      <EncounterProviderPanel
        encounterId="enc-1"
        encounterStatus="draft"
        onProviderChange={onProviderChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Assign')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Assign'));

    await waitFor(() => {
      expect(screen.getByText('New Provider Assignment')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    await user.selectOptions(selects[0], 'prov-3');
    await user.click(screen.getByText('Assign Provider'));

    await waitFor(() => {
      expect(onProviderChange).toHaveBeenCalled();
    });
  });

  it('displays audit trail when audit button is clicked', async () => {
    const user = userEvent.setup();
    mockGetProviderAuditTrail.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'audit-1',
          encounter_id: 'enc-1',
          provider_id: 'prov-1',
          role: 'attending',
          action: 'assigned',
          previous_role: null,
          changed_by: 'user-1',
          changed_at: '2026-02-13T10:00:00Z',
          reason: 'Initial assignment',
          tenant_id: 'tenant-1',
        },
      ],
    });

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" />);

    await waitFor(() => {
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Audit'));

    await waitFor(() => {
      expect(screen.getByText('Assignment History')).toBeInTheDocument();
      expect(screen.getByText('Assigned')).toBeInTheDocument();
      expect(screen.getByText('Reason: Initial assignment')).toBeInTheDocument();
    });
  });

  // ---------- Tier 1: Compact mode ----------

  it('compact mode shows provider count and attending status', async () => {
    render(
      <EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" compact />
    );

    await waitFor(() => {
      expect(screen.getByText('2 Providers Assigned')).toBeInTheDocument();
    });
  });

  it('compact mode shows warning when no attending', async () => {
    mockGetEncounterProviders.mockResolvedValue({
      success: true,
      data: [],
    });

    render(
      <EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" compact />
    );

    await waitFor(() => {
      expect(screen.getByText('No Attending Provider')).toBeInTheDocument();
    });
  });

  // ---------- Tier 4: Edge cases ----------

  it('filters out already-assigned providers from the dropdown', async () => {
    const user = userEvent.setup();

    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="draft" />);

    await waitFor(() => {
      expect(screen.getByText('Assign')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Assign'));

    await waitFor(() => {
      expect(screen.getByText('New Provider Assignment')).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const providerSelect = selects[0];
    const options = within(providerSelect).getAllByRole('option');
    const optionTexts = options.map(o => o.textContent ?? '');

    // Dr. Smith (prov-1) and Dr. Jones (prov-2) are assigned, should be filtered
    const hasSmith = optionTexts.some(t => t.includes('Dr. Smith'));
    const hasJones = optionTexts.some(t => t.includes('Dr. Jones'));
    const hasLee = optionTexts.some(t => t.includes('Dr. Lee'));

    expect(hasSmith).toBe(false);
    expect(hasJones).toBe(false);
    expect(hasLee).toBe(true);
  });

  it('displays taxonomy codes alongside provider names', async () => {
    render(<EncounterProviderPanel encounterId="enc-1" encounterStatus="in_progress" />);

    await waitFor(() => {
      expect(screen.getByText('207R00000X')).toBeInTheDocument();
      expect(screen.getByText('208D00000X')).toBeInTheDocument();
    });
  });
});
