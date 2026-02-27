/**
 * TenantComplianceReport Tests
 *
 * Tests HIPAA compliance dashboard: loading spinner, compliance score,
 * HIPAA metric rows with status badges, recent events, download report,
 * empty events state, and needs-attention status handling.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

let mockUserId: string | null = 'user-test-compliance-001';

// Tenant lookup: .from('profiles').select('tenant_id').eq('user_id', ...).single()
const mockTenantSingle = vi.fn();

// Admin check: .from('profiles').select('user_id').eq('tenant_id', ...).eq('is_admin', true)
const mockAdminCheck = vi.fn();

// Audit logs: .from('audit_logs').select(...).eq(...).in(...).order(...).limit(...)
const mockAuditLimit = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: (cols: string) => {
            if (cols === 'tenant_id') {
              // Tenant lookup chain: .eq('user_id', ...).single()
              return {
                eq: () => ({
                  single: mockTenantSingle,
                }),
              };
            }
            // Admin check chain: .eq('tenant_id', ...).eq('is_admin', true)
            return {
              eq: () => ({
                eq: mockAdminCheck,
              }),
            };
          },
        };
      }
      if (table === 'audit_logs') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: mockAuditLimit,
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    },
  }),
  useUser: () => (mockUserId ? { id: mockUserId } : null),
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

vi.mock('lucide-react', () => ({
  Shield: ({ className }: { className?: string }) => <span data-testid="icon-shield" className={className}>Shield</span>,
  CheckCircle: ({ className }: { className?: string }) => <span data-testid="icon-check" className={className}>CheckCircle</span>,
  AlertCircle: ({ className }: { className?: string }) => <span data-testid="icon-alert" className={className}>AlertCircle</span>,
  FileText: ({ className }: { className?: string }) => <span data-testid="icon-file" className={className}>FileText</span>,
  Download: ({ className }: { className?: string }) => <span data-testid="icon-download" className={className}>Download</span>,
  TrendingUp: ({ className }: { className?: string }) => <span data-testid="icon-trending" className={className}>TrendingUp</span>,
}));

// Import AFTER mocks
import { TenantComplianceReport } from '../TenantComplianceReport';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_AUDIT_LOGS = [
  {
    id: 'log-001',
    action_type: 'ADMIN_LOGIN',
    message: 'Admin Test Alpha logged in',
    created_at: '2026-02-25T10:00:00Z',
    severity: 'info',
  },
  {
    id: 'log-002',
    action_type: 'PHI_ACCESS',
    message: 'PHI record accessed by Test Admin Beta',
    created_at: '2026-02-24T14:00:00Z',
    severity: 'warning',
  },
  {
    id: 'log-003',
    action_type: 'RLS_VIOLATION',
    message: 'RLS policy blocked unauthorized access',
    created_at: '2026-02-23T09:00:00Z',
    severity: 'error',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function setupHappyPath() {
  mockTenantSingle.mockResolvedValue({
    data: { tenant_id: 'tenant-test-compliance-001' },
    error: null,
  });
  mockAdminCheck.mockResolvedValue({
    data: [{ user_id: 'user-admin-001' }],
    error: null,
  });
  mockAuditLimit.mockResolvedValue({
    data: MOCK_AUDIT_LOGS,
    error: null,
  });
}

function setupNoAdmins() {
  mockTenantSingle.mockResolvedValue({
    data: { tenant_id: 'tenant-test-compliance-001' },
    error: null,
  });
  mockAdminCheck.mockResolvedValue({
    data: [],
    error: null,
  });
  mockAuditLimit.mockResolvedValue({
    data: [],
    error: null,
  });
}

function setupNoEvents() {
  mockTenantSingle.mockResolvedValue({
    data: { tenant_id: 'tenant-test-compliance-001' },
    error: null,
  });
  mockAdminCheck.mockResolvedValue({
    data: [{ user_id: 'user-admin-001' }],
    error: null,
  });
  mockAuditLimit.mockResolvedValue({
    data: [],
    error: null,
  });
}

function renderComponent() {
  return render(<TenantComplianceReport />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('TenantComplianceReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = 'user-test-compliance-001';
    setupHappyPath();
  });

  // --- Loading ---

  it('shows loading spinner initially', () => {
    mockTenantSingle.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // --- Header ---

  it('displays "Compliance Dashboard" title', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Compliance Dashboard')).toBeInTheDocument();
    });
  });

  it('displays subtitle about HIPAA compliance', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('HIPAA and security compliance status for your facility')).toBeInTheDocument();
    });
  });

  // --- Compliance Score ---

  it('displays 100% compliance score when all metrics pass', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  it('displays "Excellent" label when score >= 90%', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });
  });

  it('displays "Overall Compliance Score" heading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    });
  });

  it('displays "Based on HIPAA Security Rule requirements" text', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Based on HIPAA Security Rule requirements')).toBeInTheDocument();
    });
  });

  // --- HIPAA Metric Rows ---

  it('renders all 6 HIPAA requirement categories', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('PHI Access Logging')).toBeInTheDocument();
    });
    expect(screen.getByText('User Authentication')).toBeInTheDocument();
    expect(screen.getByText('Data Encryption')).toBeInTheDocument();
    expect(screen.getByText('Audit Trail Retention')).toBeInTheDocument();
    expect(screen.getByText('Access Controls')).toBeInTheDocument();
    expect(screen.getByText('Security Officer Assigned')).toBeInTheDocument();
  });

  it('shows COMPLIANT status badges for passing metrics', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('PHI Access Logging')).toBeInTheDocument();
    });
    const compliantBadges = screen.getAllByText('COMPLIANT');
    expect(compliantBadges.length).toBe(6);
  });

  it('shows "1 of 1 controls implemented" for each metric', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('PHI Access Logging')).toBeInTheDocument();
    });
    const controlTexts = screen.getAllByText('1 of 1 controls implemented');
    expect(controlTexts.length).toBe(6);
  });

  // --- Needs Attention ---

  it('shows NEEDS ATTENTION badge when no admin users exist', async () => {
    setupNoAdmins();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('NEEDS ATTENTION')).toBeInTheDocument();
    });
  });

  it('shows "0 of 1 controls implemented" for security officer when no admins', async () => {
    setupNoAdmins();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('0 of 1 controls implemented')).toBeInTheDocument();
    });
  });

  it('displays compliance score below 100% when a metric fails', async () => {
    setupNoAdmins();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('83%')).toBeInTheDocument();
    });
  });

  // --- Recent Events ---

  it('renders "Recent Compliance Events" section heading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Recent Compliance Events')).toBeInTheDocument();
    });
  });

  it('displays recent audit log event titles', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('ADMIN_LOGIN')).toBeInTheDocument();
    });
    expect(screen.getByText('PHI_ACCESS')).toBeInTheDocument();
    expect(screen.getByText('RLS_VIOLATION')).toBeInTheDocument();
  });

  it('displays event descriptions', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Admin Test Alpha logged in')).toBeInTheDocument();
    });
    expect(screen.getByText('PHI record accessed by Test Admin Beta')).toBeInTheDocument();
    expect(screen.getByText('RLS policy blocked unauthorized access')).toBeInTheDocument();
  });

  it('shows "No recent compliance events" when events list is empty', async () => {
    setupNoEvents();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No recent compliance events')).toBeInTheDocument();
    });
  });

  // --- Download Report ---

  it('renders Download Report button', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Download Report')).toBeInTheDocument();
    });
  });

  it('triggers download when Download Report is clicked', async () => {
    const user = userEvent.setup();
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    const mockClick = vi.fn();

    Object.defineProperty(window, 'URL', {
      value: {
        createObjectURL: mockCreateObjectURL,
        revokeObjectURL: mockRevokeObjectURL,
      },
      writable: true,
      configurable: true,
    });

    // Save original BEFORE spying to avoid infinite recursion
    const origCreateElement = document.createElement.bind(document);
    const mockCreateElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick } as unknown as HTMLElement;
      }
      return origCreateElement(tag);
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Download Report')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Download Report'));
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    mockCreateElement.mockRestore();
  });

  // --- Info Banner ---

  it('displays tenant-scoped compliance info banner', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Tenant-Scoped Compliance')).toBeInTheDocument();
    });
    expect(screen.getByText(/This dashboard shows compliance status for your facility only/)).toBeInTheDocument();
  });

  // --- HIPAA Security Requirements Section ---

  it('displays "HIPAA Security Requirements" section heading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('HIPAA Security Requirements')).toBeInTheDocument();
    });
    expect(screen.getByText('Individual compliance checks')).toBeInTheDocument();
  });
});
