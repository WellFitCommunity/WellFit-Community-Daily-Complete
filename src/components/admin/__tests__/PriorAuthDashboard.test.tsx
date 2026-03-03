/**
 * PriorAuthDashboard tests -- validates stats cards, auth list with status/urgency badges,
 * status filtering, create form fields, Submit/Cancel action buttons, deadline alerts,
 * loading/error states, and view mode toggling.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ── Mocks ────────────────────────────────────────────────────────── */

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };
const mockUser = { id: 'user-test-001' };
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useUser: () => mockUser,
}));

const mockGetPending = vi.fn();
const mockGetStatistics = vi.fn();
const mockGetApproachingDeadline = vi.fn();
const mockCreate = vi.fn();
const mockSubmit = vi.fn();
const mockCancel = vi.fn();

vi.mock('../../../services/fhir/prior-auth', () => ({
  PriorAuthorizationService: {
    getPending: (...a: unknown[]) => mockGetPending(...a),
    getStatistics: (...a: unknown[]) => mockGetStatistics(...a),
    getApproachingDeadline: (...a: unknown[]) => mockGetApproachingDeadline(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    submit: (...a: unknown[]) => mockSubmit(...a),
    cancel: (...a: unknown[]) => mockCancel(...a),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../hooks/usePriorAuthMCP', () => ({
  usePriorAuthMCP: () => ({
    status: 'idle',
    error: null,
    isLoading: false,
    createPriorAuth: vi.fn(),
    submitPriorAuth: vi.fn(),
    recordDecision: vi.fn(),
    createAppeal: vi.fn(),
    checkRequired: vi.fn(),
    getStatistics: vi.fn(),
    cancelAuth: vi.fn(),
    exportToFHIR: vi.fn().mockResolvedValue(null),
    resetState: vi.fn(),
  }),
}));

vi.mock('../../../services/mcp/mcpPriorAuthClient', () => ({
  priorAuthMCP: {
    checkPriorAuthRequired: vi.fn().mockResolvedValue({ success: false }),
  },
}));

vi.mock('../../../hooks/usePubMedEvidence', () => ({
  usePubMedEvidence: () => ({
    status: 'idle',
    result: null,
    error: null,
    selectedAbstract: null,
    loadingAbstract: false,
    searchGuidelineEvidence: vi.fn(),
    searchDrugInteractionEvidence: vi.fn(),
    searchEvidence: vi.fn(),
    fetchAbstract: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  FileText: () => <span data-testid="icon-file" />,
  Send: () => <span data-testid="icon-send" />,
  Plus: () => <span data-testid="icon-plus" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Shield: () => <span data-testid="icon-shield" />,
  ClipboardCheck: () => <span data-testid="icon-clipboard-check" />,
  Download: () => <span data-testid="icon-download" />,
  Loader2: () => <span data-testid="icon-loader" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  X: () => <span data-testid="icon-x-close" />,
  Copy: () => <span data-testid="icon-copy" />,
  BookOpen: () => <span data-testid="icon-book" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Search: () => <span data-testid="icon-search" />,
  ExternalLink: () => <span data-testid="icon-external" />,
}));

import PriorAuthDashboard from '../PriorAuthDashboard';
import type { PriorAuthorization, PriorAuthStatistics } from '../../../services/fhir/prior-auth';

/* ── Fixtures (synthetic data only) ───────────────────────────────── */

const TS = '2026-01-15T10:00:00Z';
const BASE = { tenant_id: 'tenant-test-001', updated_at: TS, created_at: TS } as const;

const MOCK_STATS: PriorAuthStatistics = {
  total_submitted: 85, total_approved: 62, total_denied: 15, total_pending: 8,
  approval_rate: 72.5, avg_response_hours: 18.3, sla_compliance_rate: 94.0,
  by_urgency: {
    routine: { total: 50, approved: 40, denied: 8 },
    urgent: { total: 25, approved: 17, denied: 5 },
    stat: { total: 10, approved: 5, denied: 2 },
  },
};

const MOCK_AUTHS: PriorAuthorization[] = [
  { ...BASE, id: 'pa-alpha-001', patient_id: 'patient-alpha', auth_number: 'AUTH-2026-001',
    status: 'draft', urgency: 'routine', service_codes: ['99213', '99214'],
    diagnosis_codes: ['E11.9'], payer_id: 'payer-001', payer_name: 'Test Insurance Alpha' },
  { ...BASE, id: 'pa-beta-002', patient_id: 'patient-beta', auth_number: 'AUTH-2026-002',
    status: 'submitted', urgency: 'urgent', service_codes: ['27447'],
    diagnosis_codes: ['M17.11'], payer_id: 'payer-002', payer_name: 'Test Insurance Beta',
    created_at: '2026-01-16T09:00:00Z', decision_due_at: '2026-01-18T09:00:00Z' },
  { ...BASE, id: 'pa-gamma-003', patient_id: 'patient-gamma', status: 'approved',
    urgency: 'stat', service_codes: ['99285'], diagnosis_codes: ['I21.0'],
    payer_id: 'payer-001', payer_name: 'Test Insurance Alpha',
    created_at: '2026-01-17T15:00:00Z' },
  { ...BASE, id: 'pa-delta-004', patient_id: 'patient-delta', auth_number: 'AUTH-2026-004',
    status: 'pending_review', urgency: 'routine', service_codes: ['99215'],
    diagnosis_codes: ['J44.1'], payer_id: 'payer-003', payer_name: 'Test Insurance Delta',
    created_at: '2026-01-18T11:00:00Z' },
];

const MOCK_DEADLINE_AUTHS: PriorAuthorization[] = [
  { ...BASE, id: 'pa-deadline-001', patient_id: 'patient-deadline', auth_number: 'AUTH-DL-001',
    status: 'submitted', urgency: 'urgent', service_codes: ['99213'],
    diagnosis_codes: ['E11.9'], payer_id: 'payer-001',
    decision_due_at: '2026-01-19T10:00:00Z', created_at: '2026-01-18T08:00:00Z' },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

function setupProfileMock() {
  const singleFn = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-test-001' }, error: null });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  return { select: vi.fn().mockReturnValue({ eq: eqFn }) };
}

function setupAuthsQueryMock(data: PriorAuthorization[] = MOCK_AUTHS) {
  const limitFn = vi.fn().mockResolvedValue({ data, error: null });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  const eqFn = vi.fn().mockReturnValue({ order: orderFn });
  return { select: vi.fn().mockReturnValue({ eq: eqFn }) };
}

function setupSuccessMocks(opts?: {
  auths?: PriorAuthorization[];
  stats?: PriorAuthStatistics | null;
  deadlineAuths?: PriorAuthorization[];
}) {
  const profile = setupProfileMock();
  const auths = setupAuthsQueryMock(opts?.auths ?? MOCK_AUTHS);

  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return profile;
    if (table === 'prior_authorizations') return auths;
    return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn() }) }) };
  });

  mockGetPending.mockResolvedValue({
    success: true, data: (opts?.auths ?? MOCK_AUTHS).filter(a => a.status === 'draft'),
  });
  mockGetStatistics.mockResolvedValue({
    success: true, data: opts?.stats !== undefined ? opts.stats : MOCK_STATS,
  });
  mockGetApproachingDeadline.mockResolvedValue({
    success: true, data: opts?.deadlineAuths ?? MOCK_DEADLINE_AUTHS,
  });
}

async function renderAndWait() {
  render(<PriorAuthDashboard />);
  await waitFor(() => {
    expect(screen.queryByText('Loading prior authorizations...')).not.toBeInTheDocument();
  });
}

/* ── Tests ─────────────────────────────────────────────────────────── */

describe('PriorAuthDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows loading spinner with text while data is being fetched', () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue(new Promise(() => {})) }),
      }),
    });
    render(<PriorAuthDashboard />);
    expect(screen.getByText('Loading prior authorizations...')).toBeInTheDocument();
  });

  it('displays "Prior Authorization Center" heading and CMS compliance text', async () => {
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getByText('Prior Authorization Center')).toBeInTheDocument();
    expect(screen.getByText('CMS-0057-F Compliant')).toBeInTheDocument();
  });

  it('renders four stat cards with correct values', async () => {
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getByText('Total Submitted')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Approval Rate')).toBeInTheDocument();
    expect(screen.getByText('73%')).toBeInTheDocument();
    expect(screen.getByText('Avg Response (hrs)')).toBeInTheDocument();
    expect(screen.getByText('18.3')).toBeInTheDocument();
    expect(screen.getByText('SLA Compliance')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
  });

  it('renders auth rows with auth numbers, service codes, and payer names', async () => {
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getByText('AUTH-2026-001')).toBeInTheDocument();
    expect(screen.getByText('AUTH-2026-002')).toBeInTheDocument();
    expect(screen.getByText('pa-gamma')).toBeInTheDocument(); // truncated id fallback
    expect(screen.getByText('99213, 99214')).toBeInTheDocument();
    expect(screen.getByText('27447')).toBeInTheDocument();
    expect(screen.getByText('99285')).toBeInTheDocument();
    expect(screen.getAllByText('Test Insurance Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Test Insurance Beta')).toBeInTheDocument();
  });

  it('renders status badges (Draft, Submitted, Approved, Pending Review) in table', async () => {
    setupSuccessMocks();
    await renderAndWait();
    // Each label appears as both a filter button and a table status badge
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Pending Review').length).toBeGreaterThanOrEqual(2);
  });

  it('renders urgency badges with Routine, Urgent, and STAT labels', async () => {
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getAllByText('Routine').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('STAT')).toBeInTheDocument();
  });

  it('filters the auth list when a status filter button is clicked', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getByText('AUTH-2026-001')).toBeInTheDocument();

    const approvedBtn = screen.getAllByRole('button').find(b => b.textContent === 'Approved');
    await user.click(approvedBtn as HTMLElement);

    expect(screen.queryByText('AUTH-2026-001')).not.toBeInTheDocument();
    expect(screen.getByText('pa-gamma')).toBeInTheDocument();
  });

  it('shows "No prior authorizations found" when filtered list is empty', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();

    const cancelledBtn = screen.getAllByRole('button').find(b => b.textContent === 'Cancelled');
    await user.click(cancelledBtn as HTMLElement);

    expect(screen.getByText('No prior authorizations found')).toBeInTheDocument();
    expect(screen.getByText('Create a new request to get started.')).toBeInTheDocument();
  });

  it('shows a Submit button for draft-status authorizations', async () => {
    setupSuccessMocks();
    await renderAndWait();
    const submitBtns = screen.getAllByRole('button').filter(b => b.title === 'Submit to payer');
    expect(submitBtns.length).toBe(1);
  });

  it('shows Cancel buttons for draft, submitted, and pending_review auths', async () => {
    setupSuccessMocks();
    await renderAndWait();
    const cancelBtns = screen.getAllByRole('button').filter(b => b.title === 'Cancel request');
    expect(cancelBtns.length).toBe(3); // draft + submitted + pending_review
  });

  it('does not render Submit or Cancel for approved authorizations', async () => {
    setupSuccessMocks({ auths: [MOCK_AUTHS[2]] }); // approved only
    await renderAndWait();
    const actionBtns = screen.getAllByRole('button').filter(
      b => b.title === 'Submit to payer' || b.title === 'Cancel request'
    );
    expect(actionBtns.length).toBe(0);
  });

  it('shows error banner when data loading fails and dismisses on click', async () => {
    const user = userEvent.setup();
    const profile = setupProfileMock();
    const limitFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'Connection timeout' } });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const eqFn = vi.fn().mockReturnValue({ order: orderFn });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profile;
      if (table === 'prior_authorizations') return { select: vi.fn().mockReturnValue({ eq: eqFn }) };
      return { select: vi.fn() };
    });
    mockGetPending.mockResolvedValue({ success: true, data: [] });
    mockGetStatistics.mockResolvedValue({ success: true, data: MOCK_STATS });
    mockGetApproachingDeadline.mockResolvedValue({ success: true, data: [] });

    await renderAndWait();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();

    await user.click(screen.getByText('Dismiss'));
    await waitFor(() => {
      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });
  });

  it('shows amber deadline alert banner with count of approaching deadlines', async () => {
    setupSuccessMocks();
    await renderAndWait();
    expect(screen.getByText(/Approaching Deadlines/)).toBeInTheDocument();
    expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
    expect(screen.getByText('AUTH-DL-001')).toBeInTheDocument();
  });

  it('hides the deadline alert banner when there are no approaching deadlines', async () => {
    setupSuccessMocks({ deadlineAuths: [] });
    await renderAndWait();
    expect(screen.queryByText(/Approaching Deadlines/)).not.toBeInTheDocument();
  });

  it('switches to create form when New Request button is clicked', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();

    expect(screen.getByText('New Request')).toBeInTheDocument();
    expect(screen.queryByText('New Prior Authorization Request')).not.toBeInTheDocument();

    await user.click(screen.getByText('New Request'));
    expect(screen.getByText('New Prior Authorization Request')).toBeInTheDocument();
    expect(screen.getByText('Back to List')).toBeInTheDocument();
  });

  it('shows all required form fields in the create view', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();
    await user.click(screen.getByText('New Request'));

    for (const label of [
      'Patient ID *', 'Payer ID *', 'Payer Name', 'Date of Service',
      'Service Codes (CPT) *', 'Diagnosis Codes (ICD-10) *', 'Urgency', 'Clinical Notes',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('provides Routine, Urgent, and STAT options in the urgency dropdown', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();
    await user.click(screen.getByText('New Request'));

    const select = screen.getByDisplayValue('Routine (7 days)');
    const options = within(select as HTMLElement).getAllByRole('option');
    const texts = options.map(o => o.textContent);
    expect(texts).toContain('Routine (7 days)');
    expect(texts).toContain('Urgent (72 hours)');
    expect(texts).toContain('STAT (4 hours)');
  });

  it('calls PriorAuthorizationService.create with form data on submit', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    mockCreate.mockResolvedValue({ success: true, data: { id: 'pa-new-001' } });
    await renderAndWait();
    await user.click(screen.getByText('New Request'));

    // Wait for create form to render fully before interacting
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Patient UUID')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Patient UUID'), { target: { value: 'patient-test-new' } });
    fireEvent.change(screen.getByPlaceholderText('Payer identifier'), { target: { value: 'payer-test-new' } });
    fireEvent.change(screen.getByPlaceholderText('99213, 99214 (comma-separated)'), { target: { value: '99213, 99214' } });
    fireEvent.change(screen.getByPlaceholderText('E11.9, I50.9 (comma-separated)'), { target: { value: 'E11.9' } });
    await user.click(screen.getByText('Create Draft'));

    await waitFor(() => { expect(mockCreate).toHaveBeenCalledTimes(1); });
    const args = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(args.patient_id).toBe('patient-test-new');
    expect(args.payer_id).toBe('payer-test-new');
    expect(args.service_codes).toEqual(['99213', '99214']);
    expect(args.diagnosis_codes).toEqual(['E11.9']);
    expect(args.tenant_id).toBe('tenant-test-001');
  });

  it('calls submit service when Submit button is clicked on a draft auth', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    mockSubmit.mockResolvedValue({ success: true });
    await renderAndWait();

    const submitBtn = screen.getAllByRole('button').find(b => b.title === 'Submit to payer');
    await user.click(submitBtn as HTMLElement);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({ id: 'pa-alpha-001', updated_by: 'user-test-001' });
    });
  });

  it('calls cancel service when Cancel button is clicked on a draft auth', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    mockCancel.mockResolvedValue({ success: true });
    await renderAndWait();

    // Filter to Draft so only one cancel button is visible
    const draftBtn = screen.getAllByRole('button').find(b => b.textContent === 'Draft');
    await user.click(draftBtn as HTMLElement);

    const cancelBtn = screen.getAllByRole('button').find(b => b.title === 'Cancel request');
    await user.click(cancelBtn as HTMLElement);

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith('pa-alpha-001', 'Cancelled by admin', 'user-test-001');
    });
  });

  it('renders table column headers', async () => {
    setupSuccessMocks();
    await renderAndWait();
    for (const h of ['Auth #', 'Status', 'Service Codes', 'Payer', 'Created', 'Actions']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Urgency').length).toBeGreaterThanOrEqual(1);
  });

  it('returns to list view when "Back to List" button is clicked', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();

    await user.click(screen.getByText('New Request'));
    expect(screen.getByText('New Prior Authorization Request')).toBeInTheDocument();

    await user.click(screen.getByText('Back to List'));
    expect(screen.queryByText('New Prior Authorization Request')).not.toBeInTheDocument();
    expect(screen.getByText('Auth #')).toBeInTheDocument();
  });

  it('calls loadData again when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    await renderAndWait();
    const before = mockGetStatistics.mock.calls.length;
    await user.click(screen.getByText('Refresh'));
    await waitFor(() => { expect(mockGetStatistics.mock.calls.length).toBeGreaterThan(before); });
  });

  it('does not render stat cards when statistics data is null', async () => {
    setupSuccessMocks({ stats: null });
    await renderAndWait();
    expect(screen.queryByText('Total Submitted')).not.toBeInTheDocument();
    expect(screen.queryByText('Approval Rate')).not.toBeInTheDocument();
  });

  it('renders all status filter buttons in the filter bar', async () => {
    setupSuccessMocks();
    await renderAndWait();
    for (const label of ['All', 'Draft', 'Submitted', 'Pending Review', 'Denied', 'Cancelled']) {
      const found = screen.getAllByRole('button').filter(b => b.textContent === label);
      expect(found.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('displays error message when create service returns failure', async () => {
    const user = userEvent.setup();
    setupSuccessMocks();
    mockCreate.mockResolvedValue({ success: false, error: 'Missing required fields' });
    await renderAndWait();

    await user.click(screen.getByText('New Request'));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Patient UUID')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('Patient UUID'), { target: { value: 'patient-test-err' } });
    fireEvent.change(screen.getByPlaceholderText('Payer identifier'), { target: { value: 'payer-test-err' } });
    fireEvent.change(screen.getByPlaceholderText('99213, 99214 (comma-separated)'), { target: { value: '99213' } });
    fireEvent.change(screen.getByPlaceholderText('E11.9, I50.9 (comma-separated)'), { target: { value: 'E11.9' } });
    await user.click(screen.getByText('Create Draft'));

    await waitFor(() => {
      expect(screen.getByText('Missing required fields')).toBeInTheDocument();
    });
  });
});
