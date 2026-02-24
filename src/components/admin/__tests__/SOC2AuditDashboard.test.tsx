/**
 * SOC2AuditDashboard Tests
 *
 * Tests loading, error, access-denied states, compliance score cards,
 * SOC 2 control status table, audit event summary, PHI access audit
 * trail with risk-level filtering, and refresh behavior.
 *
 * All test data is synthetic and obviously fake per CLAUDE.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// --- Mocks ---
const mockGetPHIAccessAudit = vi.fn();
const mockGetAuditSummaryStats = vi.fn();
const mockGetComplianceStatus = vi.fn();

vi.mock('../../../services/soc2MonitoringService', () => ({
  createSOC2MonitoringService: () => ({
    getPHIAccessAudit: (...args: unknown[]) => mockGetPHIAccessAudit(...args),
    getAuditSummaryStats: () => mockGetAuditSummaryStats(),
    getComplianceStatus: () => mockGetComplianceStatus(),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({}),
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ branding: { primaryColor: '#0000ff', appName: 'Test' } }),
}));

// --- Synthetic Test Data Factories ---
function makeCompliance(overrides: Record<string, unknown> = {}) {
  return {
    control_area: 'Test Control Alpha',
    soc2_criterion: 'CC1.1',
    control_description: 'Test control description for compliance',
    status: 'COMPLIANT',
    details: 'All checks passed in test environment',
    test_result: 'PASS',
    last_checked: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeStat(overrides: Record<string, unknown> = {}) {
  return {
    event_category: 'AUTHENTICATION',
    event_type: 'LOGIN_SUCCESS',
    total_events: 500,
    successful_events: 490,
    failed_events: 10,
    unique_users: 25,
    unique_roles: 3,
    earliest_event: '2026-01-01T00:00:00Z',
    latest_event: '2026-01-15T12:00:00Z',
    success_rate_percent: 98,
    ...overrides,
  };
}

function makePHI(overrides: Record<string, unknown> = {}) {
  return {
    id: 'phi-access-001',
    timestamp: '2026-01-15T14:30:00Z',
    actor_user_id: 'user-test-001',
    actor_role: 'clinician',
    actor_ip_address: '10.0.0.1',
    event_type: 'PHI_READ',
    resource_type: 'patient_record',
    resource_id: 'rec-test-001',
    target_user_id: 'patient-test-001',
    operation: 'SELECT',
    metadata: {},
    success: true,
    error_message: null,
    actor_email: 'test-actor-alpha@example.test',
    patient_name: 'Test Patient Alpha',
    access_type: 'Record View',
    risk_level: 'LOW',
    ...overrides,
  };
}

function setupMocks(overrides: {
  compliance?: Record<string, unknown>[];
  stats?: Record<string, unknown>[];
  phi?: Record<string, unknown>[];
} = {}) {
  mockGetComplianceStatus.mockResolvedValue(overrides.compliance ?? [makeCompliance()]);
  mockGetAuditSummaryStats.mockResolvedValue(overrides.stats ?? [makeStat()]);
  mockGetPHIAccessAudit.mockResolvedValue(overrides.phi ?? [makePHI()]);
}

function rejectAll(msg: string) {
  mockGetPHIAccessAudit.mockRejectedValue(new Error(msg));
  mockGetAuditSummaryStats.mockRejectedValue(new Error(msg));
  mockGetComplianceStatus.mockRejectedValue(new Error(msg));
}

function pendAll() {
  mockGetPHIAccessAudit.mockImplementation(() => new Promise(() => {}));
  mockGetAuditSummaryStats.mockImplementation(() => new Promise(() => {}));
  mockGetComplianceStatus.mockImplementation(() => new Promise(() => {}));
}

// --- Tests ---
describe('SOC2AuditDashboard', () => {
  let SOC2AuditDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const mod = await import('../SOC2AuditDashboard');
    SOC2AuditDashboard = mod.SOC2AuditDashboard;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows loading skeleton while data is being fetched', () => {
    pendAll();
    const { container } = render(<SOC2AuditDashboard />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });

  it('shows error alert when data fetching fails', async () => {
    rejectAll('Network failure');
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load audit and compliance data')).toBeInTheDocument();
    });
  });

  it('shows Access Restricted message on 403 error', async () => {
    rejectAll('403 Forbidden');
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    });
    expect(screen.getByText(/You don't have permission to view SOC 2 audit/)).toBeInTheDocument();
  });

  it('shows Fully Compliant when all controls are compliant', async () => {
    setupMocks({
      compliance: [
        makeCompliance({ control_area: 'Access Control' }),
        makeCompliance({ control_area: 'Encryption' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('100%')).toBeInTheDocument(); });
    expect(screen.getByText('Fully Compliant')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 controls compliant')).toBeInTheDocument();
  });

  it('shows Good Standing when compliance is between 80-99%', async () => {
    setupMocks({
      compliance: [
        makeCompliance({ control_area: 'A' }),
        makeCompliance({ control_area: 'B' }),
        makeCompliance({ control_area: 'C' }),
        makeCompliance({ control_area: 'D' }),
        makeCompliance({ control_area: 'E', status: 'NON_COMPLIANT' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('80%')).toBeInTheDocument(); });
    expect(screen.getByText('Good Standing')).toBeInTheDocument();
    expect(screen.getByText('4 of 5 controls compliant')).toBeInTheDocument();
  });

  it('shows Needs Attention when compliance is below 80%', async () => {
    setupMocks({
      compliance: [
        makeCompliance({ control_area: 'X' }),
        makeCompliance({ control_area: 'Y', status: 'NON_COMPLIANT' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('50%')).toBeInTheDocument(); });
    expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 controls compliant')).toBeInTheDocument();
  });

  it('renders SOC 2 control status table with area, criterion, and description', async () => {
    setupMocks({
      compliance: [makeCompliance({
        control_area: 'Data Integrity',
        soc2_criterion: 'CC7.2',
        control_description: 'Test system monitors data processing integrity',
        details: 'Automated monitoring active',
      })],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('SOC 2 Control Status')).toBeInTheDocument(); });
    expect(screen.getByText('Data Integrity')).toBeInTheDocument();
    expect(screen.getByText('CC7.2')).toBeInTheDocument();
    expect(screen.getByText('Test system monitors data processing integrity')).toBeInTheDocument();
    expect(screen.getByText('Automated monitoring active')).toBeInTheDocument();
  });

  it('renders compliance status badges for COMPLIANT, NON_COMPLIANT, NEEDS_REVIEW', async () => {
    setupMocks({
      compliance: [
        makeCompliance({ control_area: 'Area A', status: 'COMPLIANT' }),
        makeCompliance({ control_area: 'Area B', status: 'NON_COMPLIANT', test_result: 'FAIL' }),
        makeCompliance({ control_area: 'Area C', status: 'NEEDS_REVIEW', test_result: 'REVIEW' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Area A')).toBeInTheDocument(); });
    expect(screen.getByText('COMPLIANT')).toBeInTheDocument();
    expect(screen.getByText('NON_COMPLIANT')).toBeInTheDocument();
    expect(screen.getByText('NEEDS_REVIEW')).toBeInTheDocument();
  });

  it('renders test result badges with PASS and FAIL labels', async () => {
    setupMocks({
      compliance: [
        makeCompliance({ control_area: 'Passing Control', test_result: 'PASS' }),
        makeCompliance({ control_area: 'Failing Control', test_result: 'FAIL' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Passing Control')).toBeInTheDocument(); });
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('shows no compliance data message when compliance array is empty', async () => {
    setupMocks({ compliance: [] });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('No compliance data available')).toBeInTheDocument();
    });
  });

  it('renders audit event summary table with category, type, and totals', async () => {
    setupMocks({
      stats: [makeStat({
        event_category: 'DATA_ACCESS',
        event_type: 'PHI_VIEW',
        total_events: 1234,
        unique_users: 42,
        success_rate_percent: 97,
        latest_event: '2026-01-15T12:00:00Z',
      })],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Audit Event Summary (Last 30 Days)')).toBeInTheDocument();
    });
    expect(screen.getByText('DATA_ACCESS')).toBeInTheDocument();
    expect(screen.getByText('PHI VIEW')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('applies green and red color classes for success rate thresholds', async () => {
    setupMocks({
      stats: [
        makeStat({ event_category: 'AUTH', event_type: 'LOGIN_HIGH', success_rate_percent: 98 }),
        makeStat({ event_category: 'DATA', event_type: 'ACCESS_LOW', success_rate_percent: 72 }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('98%')).toBeInTheDocument(); });
    expect(screen.getByText('98%').className).toContain('text-green-600');
    expect(screen.getByText('72%').className).toContain('text-red-600');
  });

  it('shows no audit statistics message when stats array is empty', async () => {
    setupMocks({ stats: [] });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('No audit statistics available')).toBeInTheDocument();
    });
  });

  it('renders PHI access audit trail with actor, patient, and risk level', async () => {
    setupMocks({
      phi: [makePHI({
        id: 'phi-001',
        actor_email: 'test-nurse-beta@example.test',
        actor_role: 'nurse',
        patient_name: 'Test Patient Beta',
        access_type: 'Chart Review',
        risk_level: 'MEDIUM',
        actor_ip_address: '10.0.0.99',
      })],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('PHI Access Audit Trail')).toBeInTheDocument(); });
    expect(screen.getByText('test-nurse-beta@example.test')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();
    expect(screen.getByText('Chart Review')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.99')).toBeInTheDocument();
  });

  it('filters PHI access trail when High Risk filter is clicked', async () => {
    setupMocks({
      phi: [
        makePHI({ id: 'phi-h1', patient_name: 'Test Patient Gamma', risk_level: 'HIGH' }),
        makePHI({ id: 'phi-l1', patient_name: 'Test Patient Delta', risk_level: 'LOW' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Test Patient Gamma')).toBeInTheDocument();
      expect(screen.getByText('Test Patient Delta')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('High Risk'));
    expect(screen.getByText('Test Patient Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Test Patient Delta')).not.toBeInTheDocument();
  });

  it('shows no PHI access events message when phi array is empty', async () => {
    setupMocks({ phi: [] });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('No PHI access events recorded')).toBeInTheDocument();
    });
  });

  it('reloads data when Refresh button is clicked', async () => {
    setupMocks();
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Refresh')).toBeInTheDocument(); });
    const initialCalls = mockGetComplianceStatus.mock.calls.length;
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => {
      expect(mockGetComplianceStatus.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('displays Audit & Compliance Center as the page header', async () => {
    setupMocks();
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Audit & Compliance Center')).toBeInTheDocument();
    });
  });

  it('shows Access Restricted on 401 unauthorized error', async () => {
    rejectAll('401 Unauthorized');
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Access Restricted')).toBeInTheDocument(); });
  });

  it('shows all entries again when All filter is clicked after filtering', async () => {
    setupMocks({
      phi: [
        makePHI({ id: 'phi-h2', patient_name: 'Test Patient Epsilon', risk_level: 'HIGH' }),
        makePHI({ id: 'phi-l2', patient_name: 'Test Patient Zeta', risk_level: 'LOW' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Test Patient Epsilon')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('High Risk'));
    expect(screen.queryByText('Test Patient Zeta')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('All'));
    expect(screen.getByText('Test Patient Epsilon')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Zeta')).toBeInTheDocument();
  });

  it('filters to only MEDIUM risk entries when Medium Risk is clicked', async () => {
    setupMocks({
      phi: [
        makePHI({ id: 'phi-m1', patient_name: 'Test Patient Eta', risk_level: 'MEDIUM' }),
        makePHI({ id: 'phi-h3', patient_name: 'Test Patient Theta', risk_level: 'HIGH' }),
      ],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Test Patient Eta')).toBeInTheDocument();
      expect(screen.getByText('Test Patient Theta')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Medium Risk'));
    expect(screen.getByText('Test Patient Eta')).toBeInTheDocument();
    expect(screen.queryByText('Test Patient Theta')).not.toBeInTheDocument();
  });

  it('renders the SOC 2 Compliance Score card title', async () => {
    setupMocks();
    render(<SOC2AuditDashboard />);
    await waitFor(() => {
      expect(screen.getByText('SOC 2 Compliance Score')).toBeInTheDocument();
    });
  });

  it('applies yellow color for success rate between 80% and 94%', async () => {
    setupMocks({
      stats: [makeStat({ event_category: 'SYSTEM', event_type: 'BACKUP_RUN', success_rate_percent: 88 })],
    });
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('88%')).toBeInTheDocument(); });
    expect(screen.getByText('88%').className).toContain('text-yellow-600');
  });

  it('shows Access Restricted on permission denied error', async () => {
    rejectAll('permission denied for table');
    render(<SOC2AuditDashboard />);
    await waitFor(() => { expect(screen.getByText('Access Restricted')).toBeInTheDocument(); });
    expect(screen.getByText(/Contact your administrator/)).toBeInTheDocument();
  });
});
