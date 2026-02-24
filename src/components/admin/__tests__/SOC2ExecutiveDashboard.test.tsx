/**
 * SOC2ExecutiveDashboard Tests
 *
 * Tests executive security summary: loading state, error state, disclaimer,
 * hero compliance score with grade mapping, trend indicators, key metrics,
 * compliance detail sections, executive summary text, recommendations,
 * and refresh button.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetExecutiveSummary = vi.fn();
const mockGetComplianceStatus = vi.fn();

vi.mock('../../../services/soc2MonitoringService', () => ({
  createSOC2MonitoringService: () => ({
    getExecutiveSummary: mockGetExecutiveSummary,
    getComplianceStatus: mockGetComplianceStatus,
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({}),
}));

// ---------------------------------------------------------------------------
// Synthetic test data — obviously fake per CLAUDE.md PHI hygiene rules
// ---------------------------------------------------------------------------

function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    totalSecurityEvents: 42,
    criticalEvents: 3,
    openInvestigations: 1,
    phiAccessCount: 128,
    complianceScore: 87,
    trendDirection: 'STABLE' as const,
    ...overrides,
  };
}

function makeCompliantControl(area: string, criterion: string) {
  return {
    control_area: area,
    soc2_criterion: criterion,
    control_description: `Test description for ${area}`,
    status: 'COMPLIANT' as const,
    details: `${area} is fully compliant`,
    test_result: 'PASS' as const,
    last_checked: '2026-01-15T00:00:00Z',
  };
}

function makeNonCompliantControl(area: string, criterion: string) {
  return {
    control_area: area,
    soc2_criterion: criterion,
    control_description: `Test description for ${area}`,
    status: 'NON_COMPLIANT' as const,
    details: `${area} requires remediation`,
    test_result: 'FAIL' as const,
    last_checked: '2026-01-15T00:00:00Z',
  };
}

function makeNeedsReviewControl(area: string, criterion: string) {
  return {
    control_area: area,
    soc2_criterion: criterion,
    control_description: `Test description for ${area}`,
    status: 'NEEDS_REVIEW' as const,
    details: `${area} needs review`,
    test_result: 'REVIEW' as const,
    last_checked: '2026-01-15T00:00:00Z',
  };
}

const defaultComplianceData = [
  makeCompliantControl('Encryption at Rest', 'CC6.1'),
  makeCompliantControl('Audit Logging', 'CC7.2'),
  makeNonCompliantControl('Vendor Assessment', 'CC9.1'),
  makeNeedsReviewControl('Access Reviews', 'CC6.3'),
];

// Lazy import so mocks are registered first
async function renderDashboard() {
  const { SOC2ExecutiveDashboard } = await import('../SOC2ExecutiveDashboard');
  return render(<SOC2ExecutiveDashboard />);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('SOC2ExecutiveDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExecutiveSummary.mockResolvedValue(makeSummary());
    mockGetComplianceStatus.mockResolvedValue(defaultComplianceData);
  });

  // 1. Loading skeleton
  it('displays loading skeleton while data is being fetched', async () => {
    // Never resolve — keep loading
    mockGetExecutiveSummary.mockReturnValue(new Promise(() => {}));
    mockGetComplianceStatus.mockReturnValue(new Promise(() => {}));

    const { container } = await renderDashboard();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    // Header should NOT be visible during loading
    expect(screen.queryByText('Executive Security Summary')).not.toBeInTheDocument();
  });

  // 2. Error state message
  it('displays error alert when data fails to load', async () => {
    mockGetExecutiveSummary.mockRejectedValue(new Error('Network failure'));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Failed to load executive summary')).toBeInTheDocument();
    });
  });

  // 3. Disclaimer alert about technical implementation
  it('shows disclaimer about technical implementation vs full SOC 2 compliance', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/technical implementation/i)).toBeInTheDocument();
      expect(screen.getByText(/formal SOC 2 Type I or Type II audit/i)).toBeInTheDocument();
    });
  });

  // 4. Hero score card shows correct percentage and grade (A+ for 100%)
  it('displays hero card with compliance score percentage and A+ grade for 100%', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: 100 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('Grade: A+')).toBeInTheDocument();
    });
  });

  // 5. Hero grade mapping: 95% = A, 80% = B, 65% = C, 50% = F
  it.each([
    { score: 95, grade: 'A' },
    { score: 80, grade: 'B' },
    { score: 65, grade: 'C' },
    { score: 50, grade: 'F' },
  ])('maps compliance score $score% to grade $grade', async ({ score, grade }) => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: score }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(`${score}%`)).toBeInTheDocument();
      expect(screen.getByText(`Grade: ${grade}`)).toBeInTheDocument();
    });
  });

  // 6. Posture text: 100% shows "All technical controls..."
  it('shows "All technical controls" posture text when score is 100%', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: 100 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/All technical controls are properly implemented/)).toBeInTheDocument();
    });
  });

  // 7. Posture text: 75% shows "significant compliance gaps"
  it('shows "significant compliance gaps" posture text when score is below 80%', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: 75 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/significant compliance gaps/)).toBeInTheDocument();
    });
  });

  // 8. Trend direction: DOWN shows "Reduced Threats"
  it('displays "Reduced Threats" when trend direction is DOWN', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ trendDirection: 'DOWN' }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Reduced Threats/)).toBeInTheDocument();
    });
  });

  // 9. Trend direction: UP shows "Increased Activity"
  it('displays "Increased Activity" when trend direction is UP', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ trendDirection: 'UP' }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Increased Activity/)).toBeInTheDocument();
    });
  });

  // 10. Key metric cards display correct values
  it('renders all four key metric cards with correct values', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Security Events (24h)')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();

      expect(screen.getByText('Critical Events')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      expect(screen.getByText('Open Investigations')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();

      expect(screen.getByText('PHI Access Events')).toBeInTheDocument();
      expect(screen.getByText('128')).toBeInTheDocument();
    });
  });

  // 11. Critical Events card: "Requires attention" when > 0
  it('shows "Requires attention" for critical events card when count is positive', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ criticalEvents: 5 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Requires attention')).toBeInTheDocument();
    });
  });

  // 12. Critical Events card: "No critical issues" when === 0
  it('shows "No critical issues" for critical events card when count is zero', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ criticalEvents: 0 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No critical issues')).toBeInTheDocument();
    });
  });

  // 13. Compliant Controls section lists compliant items
  it('lists compliant controls with control area and criterion in the compliant section', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Compliant Controls')).toBeInTheDocument();
      expect(screen.getByText('Encryption at Rest')).toBeInTheDocument();
      expect(screen.getByText('CC6.1')).toBeInTheDocument();
      expect(screen.getByText('Audit Logging')).toBeInTheDocument();
      expect(screen.getByText('CC7.2')).toBeInTheDocument();
    });
  });

  // 14. Action Required section lists non-compliant items
  it('lists non-compliant and needs-review controls in the action required section', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Action Required')).toBeInTheDocument();
      expect(screen.getByText('Vendor Assessment')).toBeInTheDocument();
      expect(screen.getByText('CC9.1')).toBeInTheDocument();
      expect(screen.getByText('Access Reviews')).toBeInTheDocument();
      expect(screen.getByText('CC6.3')).toBeInTheDocument();
    });
  });

  // 15. "All controls compliant!" when no non-compliant/needs_review items
  it('shows "All controls compliant!" when every control is compliant', async () => {
    mockGetComplianceStatus.mockResolvedValue([
      makeCompliantControl('Encryption', 'CC6.1'),
      makeCompliantControl('Logging', 'CC7.2'),
    ]);

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('All controls compliant!')).toBeInTheDocument();
    });
  });

  // 16. Recommendations: shows critical events recommendation when > 0
  it('shows immediate recommendation to resolve critical events when count is positive', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ criticalEvents: 7 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Review and resolve 7 critical/)).toBeInTheDocument();
    });
  });

  // 17. Recommendations: shows "Excellent" when 100% and 0 critical
  it('shows "Excellent" recommendation when score is 100% and critical events are zero', async () => {
    mockGetExecutiveSummary.mockResolvedValue(
      makeSummary({ complianceScore: 100, criticalEvents: 0 })
    );

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Excellent/)).toBeInTheDocument();
      expect(screen.getByText(/Maintain current security posture/)).toBeInTheDocument();
    });
  });

  // 18. Executive Summary text includes security metrics
  it('renders executive summary paragraph with compliance score and event counts', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/maintains 87% compliance/)).toBeInTheDocument();
      expect(screen.getByText(/recorded 42 security events, including 3 critical/)).toBeInTheDocument();
      expect(screen.getByText(/128 access events/)).toBeInTheDocument();
    });
  });

  // 19. Header and Refresh button
  it('displays header title and a functional refresh button', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Executive Security Summary')).toBeInTheDocument();
    });

    // First call is the initial load
    expect(mockGetExecutiveSummary).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetExecutiveSummary).toHaveBeenCalledTimes(2);
    });
  });

  // 20. Recommendations: shows open investigations recommendation when > 0
  it('shows high-priority recommendation to investigate open incidents when count is positive', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ openInvestigations: 4 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Complete investigation of 4 open/)).toBeInTheDocument();
    });
  });

  // 21. Recommendations: shows non-compliant controls recommendation
  it('shows compliance recommendation when non-compliant controls exist', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Address non-compliant controls/)).toBeInTheDocument();
    });
  });

  // 22. Ongoing recommendation always displayed
  it('always displays the ongoing monitoring recommendation', async () => {
    mockGetExecutiveSummary.mockResolvedValue(
      makeSummary({ complianceScore: 100, criticalEvents: 0, openInvestigations: 0 })
    );
    mockGetComplianceStatus.mockResolvedValue([
      makeCompliantControl('Encryption', 'CC6.1'),
    ]);

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Continue monitoring PHI access patterns/)).toBeInTheDocument();
    });
  });

  // 23. Posture text: 90% shows "strong compliance"
  it('shows "strong compliance" posture text when score is between 90 and 99', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: 92 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/strong compliance with SOC 2 standards/)).toBeInTheDocument();
    });
  });

  // 24. Posture text: 85% shows "meets most"
  it('shows "meets most" posture text when score is between 80 and 89', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ complianceScore: 85 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/meets most SOC 2 requirements/)).toBeInTheDocument();
    });
  });

  // 25. Trend direction: STABLE shows "Stable"
  it('displays "Stable" when trend direction is STABLE', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ trendDirection: 'STABLE' }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Stable/)).toBeInTheDocument();
    });
  });

  // 26. Incident response section: zero open investigations text
  it('shows "No security incidents" in executive summary when open investigations is zero', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ openInvestigations: 0 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/No security incidents currently require investigation/)).toBeInTheDocument();
    });
  });

  // 27. Incident response section: active investigations text
  it('shows active investigation message when open investigations are positive', async () => {
    mockGetExecutiveSummary.mockResolvedValue(makeSummary({ openInvestigations: 2 }));

    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/2 security incident\(s\) are currently under investigation/)).toBeInTheDocument();
    });
  });

  // 28. Executive summary shows audit trail and data protection paragraphs
  it('includes audit trail and data protection information in executive summary', async () => {
    await renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Comprehensive audit logging is active/)).toBeInTheDocument();
      expect(screen.getByText(/encrypted at rest using AES-256/)).toBeInTheDocument();
    });
  });
});
