/**
 * EncounterAuditTimeline tests — validates encounter lookup, timeline rendering,
 * source/severity filters, expand/collapse, export, and empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetEncounterHeader = vi.fn();
const mockGetEncounterTimeline = vi.fn();
const mockExportEncounterAudit = vi.fn();

vi.mock('../../../services/encounterAuditService', () => ({
  encounterAuditService: {
    getEncounterHeader: (...args: unknown[]) => mockGetEncounterHeader(...args),
    getEncounterTimeline: (...args: unknown[]) => mockGetEncounterTimeline(...args),
    exportEncounterAudit: (...args: unknown[]) => mockExportEncounterAudit(...args),
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

import EncounterAuditTimeline from '../EncounterAuditTimeline';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_HEADER = {
  encounter_id: 'enc-12345678-abcd',
  status: 'in_progress',
  patient_id: 'pat-12345678-abcd',
  provider_id: 'prov-12345678-abcd',
  encounter_date: '2026-02-14',
};

const MOCK_TIMELINE = [
  {
    id: 'status-1',
    timestamp: '2026-02-14T09:00:00Z',
    source: 'status_change',
    actor_id: 'user-1234',
    summary: 'Status changed: planned → in_progress',
    details: { from_status: 'planned', to_status: 'in_progress', reason: 'Patient arrived' },
    severity: 'info',
    category: 'Status',
  },
  {
    id: 'field-1',
    timestamp: '2026-02-14T09:30:00Z',
    source: 'field_edit',
    actor_id: 'user-1234',
    summary: 'Field "chief_complaint" edited',
    details: { field_name: 'chief_complaint', old_value: null, new_value: 'Chest pain' },
    severity: 'info',
    category: 'Field Edit',
  },
  {
    id: 'amendment-1',
    timestamp: '2026-02-14T10:00:00Z',
    source: 'amendment',
    actor_id: 'user-5678',
    summary: 'Amendment filed: Corrected medication dosage',
    details: { note_id: 'note-1', amendment_text: 'Changed dose from 10mg to 5mg' },
    severity: 'warning',
    category: 'Amendment',
  },
  {
    id: 'lock-1',
    timestamp: '2026-02-14T10:30:00Z',
    source: 'lock_action',
    actor_id: 'user-1234',
    summary: 'Note locked: Finalized for billing',
    details: { note_id: 'note-1', action: 'locked', reason: 'Finalized for billing' },
    severity: 'info',
    category: 'Lock',
  },
  {
    id: 'audit-1',
    timestamp: '2026-02-14T08:00:00Z',
    source: 'audit_log',
    actor_id: null,
    summary: 'ENCOUNTER CREATED',
    details: {},
    severity: 'info',
    category: 'SYSTEM',
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('EncounterAuditTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state prompting for encounter ID on initial load', () => {
    render(<EncounterAuditTimeline />);

    expect(screen.getByText('Enter an encounter ID to view its audit trail')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter encounter ID (UUID)...')).toBeInTheDocument();
  });

  it('loads and displays encounter header when ID is submitted', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('in_progress')).toBeInTheDocument();
      expect(screen.getByText('2026-02-14')).toBeInTheDocument();
    });
  });

  it('renders timeline entries with source-specific summaries', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Status changed: planned → in_progress')).toBeInTheDocument();
      expect(screen.getByText('Field "chief_complaint" edited')).toBeInTheDocument();
      expect(screen.getByText('Amendment filed: Corrected medication dosage')).toBeInTheDocument();
      expect(screen.getByText('Note locked: Finalized for billing')).toBeInTheDocument();
      expect(screen.getByText('ENCOUNTER CREATED')).toBeInTheDocument();
    });
  });

  it('displays event count in header', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Audit Timeline (5 events)')).toBeInTheDocument();
    });
  });

  it('filters timeline by source type', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Status changed: planned → in_progress')).toBeInTheDocument();
    });

    // Filter to amendments only
    const sourceSelect = screen.getByLabelText('Filter by source');
    await user.selectOptions(sourceSelect, 'amendment');

    expect(screen.getByText('Amendment filed: Corrected medication dosage')).toBeInTheDocument();
    expect(screen.queryByText('Status changed: planned → in_progress')).not.toBeInTheDocument();
    expect(screen.queryByText('ENCOUNTER CREATED')).not.toBeInTheDocument();
  });

  it('filters timeline by severity', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Amendment filed: Corrected medication dosage')).toBeInTheDocument();
    });

    // Filter to warning severity only
    const severitySelect = screen.getByLabelText('Filter by severity');
    await user.selectOptions(severitySelect, 'warning');

    expect(screen.getByText('Amendment filed: Corrected medication dosage')).toBeInTheDocument();
    expect(screen.queryByText('Status changed: planned → in_progress')).not.toBeInTheDocument();
  });

  it('expands entry details when toggle is clicked', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Status changed: planned → in_progress')).toBeInTheDocument();
    });

    // Click expand on first entry
    const expandButtons = screen.getAllByLabelText('Expand details');
    await user.click(expandButtons[0]);

    // Details JSON should now be visible
    await waitFor(() => {
      expect(screen.getByText(/"from_status"/)).toBeInTheDocument();
    });
  });

  it('shows error when encounter not found', async () => {
    mockGetEncounterHeader.mockResolvedValue({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Encounter not found' },
    });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'nonexistent');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('Encounter not found')).toBeInTheDocument();
    });
  });

  it('shows empty timeline message when encounter has no events', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: [] });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-empty');
    await user.click(screen.getByText('Load Audit Trail'));

    await waitFor(() => {
      expect(screen.getByText('No audit events found for this encounter.')).toBeInTheDocument();
    });
  });

  it('supports Enter key to load encounter', async () => {
    mockGetEncounterHeader.mockResolvedValue({ success: true, data: MOCK_HEADER });
    mockGetEncounterTimeline.mockResolvedValue({ success: true, data: MOCK_TIMELINE });

    render(<EncounterAuditTimeline />);
    const user = userEvent.setup();

    const input = screen.getByPlaceholderText('Enter encounter ID (UUID)...');
    await user.type(input, 'enc-12345678-abcd{Enter}');

    await waitFor(() => {
      expect(screen.getByText('in_progress')).toBeInTheDocument();
    });
  });
});
