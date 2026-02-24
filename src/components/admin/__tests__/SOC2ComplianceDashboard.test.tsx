/**
 * SOC2ComplianceDashboard Tests
 *
 * Consolidated SOC2 compliance dashboard with 3 tabs: audit, security, incidents.
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only: obviously fake names, IDs, and IPs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SecurityMetrics, SecurityEvent, PHIAccessAudit, AuditSummaryStats,
  ComplianceStatus, IncidentResponseItem } from '../../../services/soc2MonitoringService';

// ---- Service mocks ----
const mockGetPHIAccessAudit = vi.fn();
const mockGetAuditSummaryStats = vi.fn();
const mockGetComplianceStatus = vi.fn();
const mockGetSecurityMetrics = vi.fn();
const mockGetSecurityEvents = vi.fn();
const mockGetIncidentResponseQueue = vi.fn();
const mockMarkEventInvestigated = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../../services/soc2MonitoringService', () => ({
  createSOC2MonitoringService: () => ({
    getPHIAccessAudit: (...a: unknown[]) => mockGetPHIAccessAudit(...a),
    getAuditSummaryStats: (...a: unknown[]) => mockGetAuditSummaryStats(...a),
    getComplianceStatus: (...a: unknown[]) => mockGetComplianceStatus(...a),
    getSecurityMetrics: (...a: unknown[]) => mockGetSecurityMetrics(...a),
    getSecurityEvents: (...a: unknown[]) => mockGetSecurityEvents(...a),
    getIncidentResponseQueue: (...a: unknown[]) => mockGetIncidentResponseQueue(...a),
    getExecutiveSummary: vi.fn(),
    markEventInvestigated: (...a: unknown[]) => mockMarkEventInvestigated(...a),
  }),
}));
vi.mock('../../../contexts/AuthContext', () => ({ useSupabaseClient: () => ({}) }));
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast, ToastContainer: () => null }),
}));
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---- Pass-through EA components ----
type P = { children?: React.ReactNode; className?: string; [k: string]: unknown };
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: P) => <div data-testid="ea-card" className={className}>{children}</div>,
  EACardHeader: ({ children, className }: P) => <div className={className}>{children}</div>,
  EACardContent: ({ children, className }: P) => <div className={className}>{children}</div>,
  EAButton: ({ children, onClick, disabled, variant, size }: P & {
    onClick?: () => void; disabled?: boolean; variant?: string; size?: string;
  }) => <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>{children}</button>,
  EABadge: ({ children, variant }: P & { variant?: string }) => <span data-variant={variant}>{children}</span>,
  EATabs: ({ children, value, className }: P & { value?: string }) => <div data-tab={value} className={className}>{children}</div>,
  EATabsList: ({ children, className }: P) => <div role="tablist" className={className}>{children}</div>,
  EATabsTrigger: ({ children, value, className }: P & { value?: string }) =>
    <button role="tab" data-value={value} className={className}>{children}</button>,
  EATabsContent: ({ children, value, className }: P & { value?: string }) =>
    <div data-tab-content={value} className={className}>{children}</div>,
}));
vi.mock('lucide-react', () => ({
  Shield: () => <span data-testid="icon-shield" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  FileSearch: () => <span data-testid="icon-search" />,
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="icon-refresh" className={className} />,
  CheckCircle2: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
  Activity: () => <span data-testid="icon-activity" />,
  Lock: () => <span data-testid="icon-lock" />,
  Zap: () => <span data-testid="icon-zap" />,
}));

// ---- Synthetic test data ----
const TS = '2026-01-15T10:00:00Z';

const MOCK_COMPLIANCE: ComplianceStatus[] = [
  { control_area: 'Access Control', soc2_criterion: 'CC6.1', control_description: 'Logical access controls',
    status: 'COMPLIANT', details: 'Verified', test_result: 'PASS', last_checked: TS },
  { control_area: 'Encryption', soc2_criterion: 'CC6.7', control_description: 'Encryption at rest/transit',
    status: 'NON_COMPLIANT', details: 'Key rotation overdue', test_result: 'FAIL', last_checked: TS },
  { control_area: 'Change Management', soc2_criterion: 'CC8.1', control_description: 'Change procedures',
    status: 'NEEDS_REVIEW', details: 'Pending review', test_result: 'REVIEW', last_checked: TS },
];

const MOCK_AUDIT_STATS: AuditSummaryStats[] = [
  { event_category: 'AUTHENTICATION', event_type: 'LOGIN_SUCCESS', total_events: 1500,
    successful_events: 1480, failed_events: 20, unique_users: 45, unique_roles: 3,
    earliest_event: '2026-01-01T00:00:00Z', latest_event: TS, success_rate_percent: 98.7 },
  { event_category: 'DATA_ACCESS', event_type: 'PHI_VIEW', total_events: 320,
    successful_events: 315, failed_events: 5, unique_users: 17, unique_roles: 2,
    earliest_event: '2026-01-01T00:00:00Z', latest_event: TS, success_rate_percent: 98.4 },
];

const MOCK_PHI: PHIAccessAudit[] = [
  { id: 'phi-test-001', timestamp: TS, actor_user_id: 'user-test-alpha', actor_role: 'clinician',
    actor_ip_address: '10.0.0.50', event_type: 'PHI_VIEW', resource_type: 'patient_record',
    resource_id: 'res-001', target_user_id: 'patient-001', operation: 'read', metadata: {},
    success: true, error_message: null, actor_email: 'testclinician@example-fake.org',
    patient_name: 'Test Patient Alpha', access_type: 'Chart View', risk_level: 'HIGH' },
  { id: 'phi-test-002', timestamp: '2026-01-15T09:30:00Z', actor_user_id: 'user-test-beta',
    actor_role: 'nurse', actor_ip_address: '10.0.0.51', event_type: 'PHI_EXPORT',
    resource_type: 'lab_results', resource_id: 'res-002', target_user_id: 'patient-002',
    operation: 'export', metadata: {}, success: true, error_message: null,
    actor_email: 'testnurse@example-fake.org', patient_name: 'Test Patient Beta',
    access_type: 'Lab Export', risk_level: 'MEDIUM' },
];

const MOCK_METRICS: SecurityMetrics = {
  security_events_24h: 142, critical_events_24h: 3, high_events_24h: 19,
  medium_events_24h: 47, low_events_24h: 80, failed_logins_24h: 28, failed_logins_1h: 4,
  unauthorized_access_24h: 7, auto_blocked_24h: 23, open_investigations: 5,
  audit_events_24h: 500, failed_operations_24h: 9, phi_access_24h: 89, last_updated: TS,
};

const EVT_BASE: SecurityEvent = {
  id: 'evt-test-001', event_type: 'brute_force_attempt', severity: 'HIGH',
  actor_user_id: 'user-test-alpha', actor_ip_address: '10.0.0.99', actor_user_agent: 'TestAgent/1.0',
  timestamp: new Date(Date.now() - 300000).toISOString(),
  description: 'Test brute force from synthetic IP', metadata: {},
  auto_blocked: false, requires_investigation: false, investigated: false,
  investigated_by: null, investigated_at: null, resolution: null,
  related_audit_log_id: null, correlation_id: null, alert_sent: false,
  alert_sent_at: null, alert_recipients: null,
};

const MOCK_EVENTS: SecurityEvent[] = [
  EVT_BASE,
  { ...EVT_BASE, id: 'evt-test-002', severity: 'CRITICAL',
    event_type: 'data_exfiltration_attempt', description: 'Synthetic exfiltration test', auto_blocked: true },
];

const INC_BASE: IncidentResponseItem = {
  id: 'inc-test-001', event_type: 'unauthorized_access', severity: 'CRITICAL',
  timestamp: '2026-01-15T08:00:00Z', actor_user_id: 'user-test-gamma',
  actor_ip_address: '10.0.0.77', description: 'Unauthorized access to synthetic admin panel',
  metadata: { target: 'test-admin-panel' }, requires_investigation: true, investigated: false,
  investigated_by: null, investigated_at: null, resolution: null,
  auto_blocked: true, alert_sent: true, correlation_id: 'corr-test-001',
  hours_since_event: 2.5, priority_score: 95, sla_status: 'SLA_BREACH',
};

const MOCK_INCIDENTS: IncidentResponseItem[] = [
  INC_BASE,
  { ...INC_BASE, id: 'inc-test-002', severity: 'HIGH', event_type: 'privilege_escalation',
    description: 'Synthetic privilege escalation', sla_status: 'WITHIN_SLA',
    hours_since_event: 1.0, auto_blocked: false },
];

// ---- Helpers ----
function setupMocks() {
  mockGetPHIAccessAudit.mockResolvedValue(MOCK_PHI);
  mockGetAuditSummaryStats.mockResolvedValue(MOCK_AUDIT_STATS);
  mockGetComplianceStatus.mockResolvedValue(MOCK_COMPLIANCE);
  mockGetSecurityMetrics.mockResolvedValue(MOCK_METRICS);
  mockGetSecurityEvents.mockResolvedValue(MOCK_EVENTS);
  mockGetIncidentResponseQueue.mockResolvedValue(MOCK_INCIDENTS);
}

async function renderDashboard() {
  const mod = await import('../SOC2ComplianceDashboard');
  return render(<mod.default />);
}

function hangAll() {
  const hang = () => new Promise(() => {});
  mockGetPHIAccessAudit.mockImplementation(hang);
  mockGetAuditSummaryStats.mockImplementation(hang);
  mockGetComplianceStatus.mockImplementation(hang);
  mockGetSecurityMetrics.mockImplementation(hang);
  mockGetSecurityEvents.mockImplementation(hang);
  mockGetIncidentResponseQueue.mockImplementation(hang);
}

function failAll() {
  const err = new Error('Network error');
  mockGetPHIAccessAudit.mockRejectedValue(err);
  mockGetAuditSummaryStats.mockRejectedValue(err);
  mockGetComplianceStatus.mockRejectedValue(err);
  mockGetSecurityMetrics.mockRejectedValue(err);
  mockGetSecurityEvents.mockRejectedValue(err);
  mockGetIncidentResponseQueue.mockRejectedValue(err);
}

// ---- Tests ----
describe('SOC2ComplianceDashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); setupMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows loading skeleton with animate-pulse while data loads', async () => {
    hangAll();
    const { container } = await renderDashboard();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders dashboard with empty states when all services fail silently', async () => {
    failAll();
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    expect(screen.getByText('No compliance data available')).toBeInTheDocument();
    expect(screen.getByText('No audit statistics available')).toBeInTheDocument();
    expect(screen.getByText('No security events recorded')).toBeInTheDocument();
    expect(screen.getByText('No PHI access events recorded')).toBeInTheDocument();
  });

  it('renders all three tab labels', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs.some((t) => t?.includes('Audit & Compliance'))).toBe(true);
    expect(tabs.some((t) => t?.includes('Security Events'))).toBe(true);
    expect(tabs.some((t) => t?.includes('Incident Response'))).toBe(true);
  });

  it('displays compliance score percentage from control data', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('33%')).toBeInTheDocument(); });
    expect(screen.getByText(/1 of 3 controls compliant/)).toBeInTheDocument();
  });

  it('renders control status table with control areas and criteria', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Control Status')).toBeInTheDocument(); });
    expect(screen.getByText('Access Control')).toBeInTheDocument();
    expect(screen.getByText('CC6.1')).toBeInTheDocument();
    expect(screen.getByText('Encryption')).toBeInTheDocument();
    expect(screen.getByText('CC6.7')).toBeInTheDocument();
    expect(screen.getByText('Change Management')).toBeInTheDocument();
    expect(screen.getByText('CC8.1')).toBeInTheDocument();
  });

  it('renders PHI access entries with actor emails and patient names', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('PHI Access Audit Trail')).toBeInTheDocument(); });
    expect(screen.getByText('testclinician@example-fake.org')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Alpha')).toBeInTheDocument();
    expect(screen.getByText('Chart View')).toBeInTheDocument();
    expect(screen.getByText('testnurse@example-fake.org')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Beta')).toBeInTheDocument();
    expect(screen.getByText('Lab Export')).toBeInTheDocument();
  });

  it('displays all 8 security metric card labels with values', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Critical Events')).toBeInTheDocument(); });
    expect(screen.getByText('High Severity')).toBeInTheDocument();
    expect(screen.getByText('Failed Logins')).toBeInTheDocument();
    expect(screen.getByText('Open Investigations')).toBeInTheDocument();
    expect(screen.getByText('Total Security Events')).toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    expect(screen.getByText('Auto-Blocked')).toBeInTheDocument();
    expect(screen.getByText('PHI Access')).toBeInTheDocument();
    // Verify specific metric values
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('4 in last hour')).toBeInTheDocument();
  });

  it('renders security events table with severity badges', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Recent Security Events')).toBeInTheDocument(); });
    expect(screen.getByText('brute force attempt')).toBeInTheDocument();
    expect(screen.getByText('data exfiltration attempt')).toBeInTheDocument();
    expect(screen.getAllByText('HIGH').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('BLOCKED')).toBeInTheDocument();
  });

  it('shows critical alert banner when SLA breaches or critical events exist', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText(/Immediate action required/)).toBeInTheDocument(); });
    expect(screen.getByText(/1 SLA breach\(es\)/)).toBeInTheDocument();
    expect(screen.getByText(/3 critical security event\(s\)/)).toBeInTheDocument();
  });

  it('displays incident summary metric cards', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Critical Open')).toBeInTheDocument(); });
    expect(screen.getByText('1 hour SLA')).toBeInTheDocument();
    expect(screen.getByText('High Priority Open')).toBeInTheDocument();
    expect(screen.getByText('4 hour SLA')).toBeInTheDocument();
    expect(screen.getByText('SLA Breaches')).toBeInTheDocument();
    expect(screen.getByText('Overdue incidents')).toBeInTheDocument();
    expect(screen.getByText('Total Open')).toBeInTheDocument();
    expect(screen.getByText('Requires investigation')).toBeInTheDocument();
  });

  it('renders investigation queue with event types and SLA badges', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Investigation Queue')).toBeInTheDocument(); });
    expect(screen.getByText('unauthorized access')).toBeInTheDocument();
    expect(screen.getByText('privilege escalation')).toBeInTheDocument();
    expect(screen.getByText('SLA BREACH')).toBeInTheDocument();
    expect(screen.getByText('WITHIN SLA')).toBeInTheDocument();
    expect(screen.getByText('AUTO-BLOCKED')).toBeInTheDocument();
  });

  it('maps severity levels to correct EABadge variants', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    const find = (text: string, variant: string) =>
      screen.getAllByText(text).find((el) => el.getAttribute('data-variant') === variant);
    expect(find('CRITICAL', 'critical')).toBeDefined();
    expect(find('HIGH', 'elevated')).toBeDefined();
    expect(find('MEDIUM', 'info')).toBeDefined();
  });

  it('maps compliance status to correct EABadge variants', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Control Status')).toBeInTheDocument(); });
    const find = (text: string, variant: string) =>
      screen.getAllByText(text).find((el) => el.getAttribute('data-variant') === variant);
    expect(find('COMPLIANT', 'normal')).toBeDefined();
    expect(find('NON_COMPLIANT', 'critical')).toBeDefined();
    expect(find('NEEDS_REVIEW', 'elevated')).toBeDefined();
  });

  it('maps SLA statuses to correct EABadge variants', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Investigation Queue')).toBeInTheDocument(); });
    const find = (text: string, variant: string) =>
      screen.getAllByText(text).find((el) => el.getAttribute('data-variant') === variant);
    expect(find('SLA BREACH', 'critical')).toBeDefined();
    expect(find('WITHIN SLA', 'normal')).toBeDefined();
  });

  it('triggers data reload when Refresh button is clicked', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    mockGetPHIAccessAudit.mockClear();
    mockGetSecurityMetrics.mockClear();
    mockGetIncidentResponseQueue.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => {
      expect(mockGetPHIAccessAudit).toHaveBeenCalled();
      expect(mockGetSecurityMetrics).toHaveBeenCalled();
      expect(mockGetIncidentResponseQueue).toHaveBeenCalled();
    });
  });

  it('shows empty message when no security events exist', async () => {
    mockGetSecurityEvents.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('No security events recorded')).toBeInTheDocument(); });
  });

  it('shows empty message when no compliance data exists', async () => {
    mockGetComplianceStatus.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('No compliance data available')).toBeInTheDocument(); });
  });

  it('shows empty message when no audit stats exist', async () => {
    mockGetAuditSummaryStats.mockResolvedValue([]);
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('No audit statistics available')).toBeInTheDocument(); });
  });

  it('renders audit event summary with categories and success rates', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Audit Event Summary (Last 30 Days)')).toBeInTheDocument(); });
    expect(screen.getByText('AUTHENTICATION')).toBeInTheDocument();
    expect(screen.getByText('LOGIN SUCCESS')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('98.7%')).toBeInTheDocument();
    expect(screen.getByText('DATA_ACCESS')).toBeInTheDocument();
    expect(screen.getByText('PHI VIEW')).toBeInTheDocument();
  });

  it('opens incident detail modal when Investigate button is clicked', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('Investigation Queue')).toBeInTheDocument(); });
    const buttons = screen.getAllByRole('button', { name: /Investigate/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    await userEvent.click(buttons[0]);
    await waitFor(() => { expect(screen.getByText('Incident Details')).toBeInTheDocument(); });
    expect(screen.getByText('Resolution Notes')).toBeInTheDocument();
    expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
  });

  it('hides critical alert banner when no SLA breaches and no critical events', async () => {
    mockGetSecurityMetrics.mockResolvedValue({ ...MOCK_METRICS, critical_events_24h: 0 });
    mockGetIncidentResponseQueue.mockResolvedValue([
      { ...INC_BASE, sla_status: 'WITHIN_SLA', severity: 'MEDIUM' },
    ]);
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    expect(screen.queryByText(/Immediate action required/)).not.toBeInTheDocument();
  });

  it('displays footer with monitoring and audit logging status', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Monitoring Active')).toBeInTheDocument(); });
    expect(screen.getByText('Audit Logging Enabled')).toBeInTheDocument();
    expect(screen.getByText(/Auto-refreshes every 30 seconds/)).toBeInTheDocument();
  });

  it('shows open incident count badge on Incident Response tab', async () => {
    await renderDashboard();
    await waitFor(() => { expect(screen.getByText('SOC2 Compliance Dashboard')).toBeInTheDocument(); });
    const tab = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Incident Response'));
    expect(tab).toBeDefined();
    expect(tab?.textContent).toContain('2');
  });
});
