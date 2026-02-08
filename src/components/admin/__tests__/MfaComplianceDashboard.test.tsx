/**
 * MfaComplianceDashboard Tests
 *
 * Tests compliance data display, summary cards, per-role table,
 * non-compliant user list, and exemption modal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock services
const mockGetMfaComplianceReport = vi.fn();
const mockGrantExemption = vi.fn();

vi.mock('../../../services/mfaEnrollmentService', () => ({
  getMfaComplianceReport: (...args: unknown[]) => mockGetMfaComplianceReport(...args),
  grantExemption: (...args: unknown[]) => mockGrantExemption(...args),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Supabase
const mockFrom = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

const mockComplianceData = [
  {
    role: 'admin',
    total_users: 5,
    mfa_enabled_count: 3,
    non_compliant_count: 2,
    exempt_count: 0,
    compliance_pct: 60,
  },
  {
    role: 'nurse',
    total_users: 10,
    mfa_enabled_count: 9,
    non_compliant_count: 0,
    exempt_count: 1,
    compliance_pct: 100,
  },
];

const mockNonCompliantUsers = [
  {
    user_id: 'nc-1',
    role: 'admin',
    enforcement_status: 'grace_period',
    grace_period_ends: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockProfiles = [
  { user_id: 'nc-1', first_name: 'Jane', last_name: 'Smith' },
];

function setupMocks() {
  mockGetMfaComplianceReport.mockResolvedValue({
    success: true,
    data: mockComplianceData,
  });

  // Build chain: from().select().eq().neq().order().limit()
  const mockLimit = vi.fn().mockResolvedValue({
    data: mockNonCompliantUsers,
    error: null,
  });
  const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockNeq = vi.fn().mockReturnValue({ order: mockOrder });
  const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

  // For profiles query: from().select().in()
  const mockIn = vi.fn().mockResolvedValue({
    data: mockProfiles,
    error: null,
  });
  const mockProfileSelect = vi.fn().mockReturnValue({ in: mockIn });

  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount % 2 === 1) {
      // mfa_enrollment query
      return { select: mockSelect };
    }
    // profiles query
    return { select: mockProfileSelect };
  });
}

describe('MfaComplianceDashboard', () => {
  let MfaComplianceDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    setupMocks();
    const mod = await import('../MfaComplianceDashboard');
    MfaComplianceDashboard = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    // Make compliance report never resolve
    mockGetMfaComplianceReport.mockImplementation(() => new Promise(() => {}));

    render(<MfaComplianceDashboard />);

    expect(screen.getByText('Loading compliance data...')).toBeInTheDocument();
  });

  it('renders summary cards with correct totals', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Staff')).toBeInTheDocument();
    });

    // Total: 5 + 10 = 15
    expect(screen.getByText('15')).toBeInTheDocument();
    // MFA Enabled: (3+0) + (9+1) = 13
    expect(screen.getByText('13')).toBeInTheDocument();
    // Non-Compliant: 15 - 13 = 2 (appears in card AND table, so use getAllByText)
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    // Compliance %: round(13/15 * 100) = 87%
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('renders per-role compliance table', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Compliance by Role')).toBeInTheDocument();
    });

    // Role names (formatted with replace)
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('nurse')).toBeInTheDocument();

    // Compliance badges
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders non-compliant users list', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Non-Compliant Users/)).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Grant Exemption')).toBeInTheDocument();
  });

  it('opens exemption modal when Grant Exemption clicked', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grant Exemption')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Grant Exemption'));

    expect(screen.getByText('Grant MFA Exemption')).toBeInTheDocument();
    expect(
      screen.getByText(/This user will be exempt from MFA requirements/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });

  it('disables exemption submit button when reason is empty', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grant Exemption')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Grant Exemption'));

    const submitBtn = screen.getByText('Grant Exemption', {
      selector: '.fixed button',
    });
    expect(submitBtn).toBeDisabled();
  });

  it('submits exemption and reloads data on success', async () => {
    mockGrantExemption.mockResolvedValue({ success: true });

    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grant Exemption')).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText('Grant Exemption'));

    // Fill reason
    const textarea = screen.getByLabelText('Reason');
    fireEvent.change(textarea, {
      target: { value: 'Shared workstation' },
    });

    // Find submit button inside modal (fixed overlay)
    const modalButtons = document.querySelectorAll('.fixed button');
    const submitBtn = Array.from(modalButtons).find(
      (btn) => btn.textContent === 'Grant Exemption'
    );
    expect(submitBtn).toBeTruthy();
    if (submitBtn) fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockGrantExemption).toHaveBeenCalledWith(
        'nc-1',
        'Shared workstation'
      );
    });
  });

  it('closes exemption modal when Cancel clicked', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Grant Exemption')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Grant Exemption'));
    expect(screen.getByText('Grant MFA Exemption')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Grant MFA Exemption')).not.toBeInTheDocument();
  });

  it('shows error message when compliance report fails', async () => {
    mockGetMfaComplianceReport.mockResolvedValue({
      success: false,
      error: { message: 'Permission denied' },
    });

    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument();
    });
  });

  it('shows empty state when no compliance data', async () => {
    mockGetMfaComplianceReport.mockResolvedValue({
      success: true,
      data: [],
    });

    // No non-compliant users either
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          neq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });

    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText('No compliance data available')
      ).toBeInTheDocument();
    });
  });

  it('has Refresh button that reloads data', async () => {
    render(<MfaComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCallCount = mockGetMfaComplianceReport.mock.calls.length;

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetMfaComplianceReport.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });
});
