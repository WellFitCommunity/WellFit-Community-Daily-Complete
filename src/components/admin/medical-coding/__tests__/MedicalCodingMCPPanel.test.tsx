/**
 * Tests for MedicalCodingMCPPanel and its sub-tabs
 *
 * Tests tabbed admin panel for medical coding tools:
 * - Tab navigation between Payer Rules, DRG Grouper, Revenue
 * - Payer rule search form and results rendering
 * - DRG grouper mode toggle, advisory disclaimer, and result display
 * - Revenue projection, validation, and optimization sections
 *
 * Individual tabs are tested directly (not through lazy loading)
 * to avoid Suspense timing issues in the test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Suspense } from 'react';
import { MedicalCodingMCPPanel } from '../MedicalCodingMCPPanel';
import { PayerRulesTab } from '../PayerRulesTab';
import { DRGGrouperTab } from '../DRGGrouperTab';
import { RevenueProjectionTab } from '../RevenueProjectionTab';

// Mock the MCP service functions
const mockGetPayerRules = vi.fn().mockResolvedValue({ success: true, data: { rules: [], total: 0 } });
const mockRunDRGGrouper = vi.fn().mockResolvedValue({ success: true, data: null });
const mockGetDRGResult = vi.fn().mockResolvedValue({ success: true, data: null });
const mockGetRevenueProjection = vi.fn().mockResolvedValue({ success: true, data: null });
const mockValidateChargeCompleteness = vi.fn().mockResolvedValue({ success: true, data: null });
const mockOptimizeDailyRevenue = vi.fn().mockResolvedValue({ success: true, data: null });

vi.mock('../../../../services/mcp', () => ({
  getPayerRules: (...args: unknown[]) => mockGetPayerRules(...args),
  upsertPayerRule: vi.fn().mockResolvedValue({ success: true, data: { rule: {}, action: 'created' } }),
  aggregateDailyCharges: vi.fn().mockResolvedValue({ success: true, data: {} }),
  getDailySnapshot: vi.fn().mockResolvedValue({ success: true, data: {} }),
  saveDailySnapshot: vi.fn().mockResolvedValue({ success: true, data: {} }),
  runDRGGrouper: (...args: unknown[]) => mockRunDRGGrouper(...args),
  getDRGResult: (...args: unknown[]) => mockGetDRGResult(...args),
  optimizeDailyRevenue: (...args: unknown[]) => mockOptimizeDailyRevenue(...args),
  validateChargeCompleteness: (...args: unknown[]) => mockValidateChargeCompleteness(...args),
  getRevenueProjection: (...args: unknown[]) => mockGetRevenueProjection(...args),
}));

const renderPanel = () => {
  return render(
    <Suspense fallback={<div>Loading...</div>}>
      <MedicalCodingMCPPanel />
    </Suspense>
  );
};

describe('MedicalCodingMCPPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockGetPayerRules.mockResolvedValue({ success: true, data: { rules: [], total: 0 } });
    mockRunDRGGrouper.mockResolvedValue({ success: true, data: null });
    mockGetDRGResult.mockResolvedValue({ success: true, data: null });
    mockGetRevenueProjection.mockResolvedValue({ success: true, data: null });
    mockValidateChargeCompleteness.mockResolvedValue({ success: true, data: null });
    mockOptimizeDailyRevenue.mockResolvedValue({ success: true, data: null });
  });

  describe('tab navigation', () => {
    it('should render all three tab buttons', async () => {
      renderPanel();

      expect(await screen.findByRole('tab', { name: /payer rules/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /drg grouper/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /revenue/i })).toBeInTheDocument();
    });

    it('should show Payer Rules tab as active by default', async () => {
      renderPanel();

      const payerTab = await screen.findByRole('tab', { name: /payer rules/i });
      expect(payerTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should switch to DRG Grouper tab when clicked', async () => {
      renderPanel();

      const drgTab = await screen.findByRole('tab', { name: /drg grouper/i });
      fireEvent.click(drgTab);

      expect(drgTab).toHaveAttribute('aria-selected', 'true');

      const advisory = await screen.findByText(/advisory only/i);
      expect(advisory).toBeInTheDocument();
    });

    it('should switch to Revenue tab when clicked', async () => {
      renderPanel();

      const revenueTab = await screen.findByRole('tab', { name: /revenue/i });
      fireEvent.click(revenueTab);

      expect(revenueTab).toHaveAttribute('aria-selected', 'true');

      const projectionBtn = await screen.findByText(/revenue projection/i);
      expect(projectionBtn).toBeInTheDocument();
    });
  });

  describe('tab descriptions', () => {
    it('should show appropriate description for each tab', async () => {
      renderPanel();

      // Default: Payer Rules
      expect(await screen.findByText(/medicare drg rates/i)).toBeInTheDocument();

      // Switch to DRG
      fireEvent.click(screen.getByRole('tab', { name: /drg grouper/i }));
      expect(await screen.findByText(/3-pass ms-drg/i)).toBeInTheDocument();

      // Switch to Revenue
      fireEvent.click(screen.getByRole('tab', { name: /revenue/i }));
      expect(await screen.findByText(/projection.*charge validation/i)).toBeInTheDocument();
    });
  });
});

describe('PayerRulesTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockGetPayerRules.mockResolvedValue({ success: true, data: { rules: [], total: 0 } });
  });

  it('should render payer type dropdown and search button', () => {
    render(<PayerRulesTab />);

    expect(screen.getByLabelText(/payer type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fiscal year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search rules/i })).toBeInTheDocument();
  });

  it('should show empty state before search', () => {
    render(<PayerRulesTab />);

    expect(screen.getByText(/select a payer type/i)).toBeInTheDocument();
  });

  it('should call getPayerRules when search button clicked and display results', async () => {
    mockGetPayerRules.mockResolvedValueOnce({
      success: true,
      data: {
        rules: [{
          id: 'r1',
          payer_type: 'medicare',
          state_code: null,
          fiscal_year: 2026,
          rule_type: 'drg_based',
          acuity_tier: null,
          base_rate_amount: 6500.5,
          capital_rate_amount: 476.12,
          wage_index_factor: 1.0234,
          per_diem_rate: null,
          allowable_percentage: null,
          max_days: null,
          outlier_threshold: null,
          carve_out_codes: null,
          rule_description: null,
          source_reference: null,
          effective_date: '2025-10-01',
          expiration_date: null,
          is_active: true,
        }],
        total: 1,
      },
    });

    render(<PayerRulesTab />);

    fireEvent.click(screen.getByRole('button', { name: /search rules/i }));

    await waitFor(() => {
      expect(mockGetPayerRules).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('1 rule(s) found')).toBeInTheDocument();
    expect(screen.getByText('DRG-Based')).toBeInTheDocument();
  });

  it('should display error when search fails', async () => {
    mockGetPayerRules.mockResolvedValueOnce({
      success: false,
      error: 'Connection timeout',
    });

    render(<PayerRulesTab />);

    fireEvent.click(screen.getByRole('button', { name: /search rules/i }));

    expect(await screen.findByText(/connection timeout/i)).toBeInTheDocument();
  });
});

describe('DRGGrouperTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockRunDRGGrouper.mockResolvedValue({ success: true, data: null });
    mockGetDRGResult.mockResolvedValue({ success: true, data: null });
  });

  it('should show run and lookup mode toggle buttons', () => {
    render(<DRGGrouperTab />);

    expect(screen.getByRole('button', { name: /run grouper/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lookup result/i })).toBeInTheDocument();
  });

  it('should show advisory disclaimer banner', () => {
    render(<DRGGrouperTab />);

    expect(screen.getByText(/advisory only/i)).toBeInTheDocument();
  });

  it('should show encounter and patient ID inputs in run mode', () => {
    render(<DRGGrouperTab />);

    expect(screen.getByLabelText(/encounter id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/patient id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/principal diagnosis/i)).toBeInTheDocument();
  });

  it('should validate required fields before running', async () => {
    render(<DRGGrouperTab />);

    fireEvent.click(screen.getByRole('button', { name: /run drg grouper/i }));

    expect(await screen.findByText(/encounter id and patient id are required/i)).toBeInTheDocument();
  });

  it('should call runDRGGrouper and display result', async () => {
    mockRunDRGGrouper.mockResolvedValueOnce({
      success: true,
      data: {
        encounter_id: 'enc-1',
        drg_code: '470',
        drg_description: 'Major hip and knee joint replacement',
        drg_weight: 1.905,
        mdc: '08',
        severity: 'base',
        principal_diagnosis: 'M16.11',
        secondary_diagnoses: [],
        procedures: ['0SR9019'],
        grouper_version: 'MS-DRG v41',
        analysis: {
          base_drg: { code: '470', weight: 1.905, description: 'Major hip and knee joint replacement' },
          cc_drg: null,
          mcc_drg: null,
          selected: 'base',
          rationale: 'No CC/MCC qualifying conditions',
        },
        advisory_disclaimer: 'Advisory only — certified coder review required',
      },
    });

    render(<DRGGrouperTab />);

    fireEvent.change(screen.getByLabelText(/encounter id/i), { target: { value: 'enc-1' } });
    fireEvent.change(screen.getByLabelText(/patient id/i), { target: { value: 'pat-1' } });

    fireEvent.click(screen.getByRole('button', { name: /run drg grouper/i }));

    expect(await screen.findByText(/ms-drg 470/i)).toBeInTheDocument();
    // Weight appears in main card and 3-pass analysis
    const weightElements = screen.getAllByText(/1.9050/);
    expect(weightElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should switch to lookup mode and show only encounter input', () => {
    render(<DRGGrouperTab />);

    fireEvent.click(screen.getByRole('button', { name: /lookup result/i }));

    expect(screen.getByLabelText(/encounter id/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/patient id/i)).not.toBeInTheDocument();
  });
});

describe('RevenueProjectionTab', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockGetRevenueProjection.mockResolvedValue({ success: true, data: null });
    mockValidateChargeCompleteness.mockResolvedValue({ success: true, data: null });
    mockOptimizeDailyRevenue.mockResolvedValue({ success: true, data: null });
  });

  it('should show three sub-section toggle buttons', () => {
    render(<RevenueProjectionTab />);

    expect(screen.getByRole('button', { name: /revenue projection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /charge validation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revenue optimization/i })).toBeInTheDocument();
  });

  it('should show payer type and DRG inputs in projection mode', () => {
    render(<RevenueProjectionTab />);

    expect(screen.getByLabelText(/payer type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/drg code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/drg weight/i)).toBeInTheDocument();
  });

  it('should show service date input in validation mode', () => {
    render(<RevenueProjectionTab />);

    fireEvent.click(screen.getByRole('button', { name: /charge validation/i }));

    expect(screen.getByLabelText(/service date/i)).toBeInTheDocument();
  });

  it('should calculate and display revenue projection', async () => {
    mockGetRevenueProjection.mockResolvedValueOnce({
      success: true,
      data: {
        payer_type: 'medicare',
        drg_code: '470',
        drg_weight: 1.905,
        operating_payment: 12382.5,
        capital_payment: 907.58,
        total_expected: 13290.08,
        base_rate: 6500.5,
        wage_index: 1.0234,
        methodology: 'MS-DRG weight x adjusted base rate',
        breakdown: {},
      },
    });

    render(<RevenueProjectionTab />);

    fireEvent.click(screen.getByRole('button', { name: /^calculate$/i }));

    expect(await screen.findByText(/\$13,290\.08/)).toBeInTheDocument();
    expect(screen.getByText(/\$12,382\.50/)).toBeInTheDocument();
  });

  it('should show completeness score in validation mode', async () => {
    mockValidateChargeCompleteness.mockResolvedValueOnce({
      success: true,
      data: {
        encounter_id: 'enc-1',
        service_date: '2026-03-04',
        completeness_score: 72,
        alerts: [{
          category: 'Missing Charge',
          severity: 'warning',
          message: 'Pharmacy charges not present',
          suggested_codes: ['J0171'],
          estimated_impact: 45.0,
        }],
      },
    });

    render(<RevenueProjectionTab />);

    fireEvent.click(screen.getByRole('button', { name: /charge validation/i }));
    fireEvent.change(screen.getByLabelText(/encounter id/i), { target: { value: 'enc-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^validate$/i }));

    expect(await screen.findByText('72%')).toBeInTheDocument();
    expect(screen.getByText(/pharmacy charges not present/i)).toBeInTheDocument();
  });

  it('should show optimization findings', async () => {
    mockOptimizeDailyRevenue.mockResolvedValueOnce({
      success: true,
      data: {
        encounter_id: 'enc-1',
        service_date: '2026-03-04',
        findings: [{
          type: 'missing_code',
          severity: 'high',
          description: 'Sepsis screening documented but not coded',
          suggested_action: 'Add R65.20 as secondary diagnosis',
          estimated_impact: 4500.0,
          codes: ['R65.20'],
        }],
        summary: {
          total_findings: 1,
          estimated_revenue_impact: 4500.0,
          critical_items: 1,
        },
        advisory_disclaimer: 'Advisory only — certified coder review required',
      },
    });

    render(<RevenueProjectionTab />);

    fireEvent.click(screen.getByRole('button', { name: /revenue optimization/i }));
    fireEvent.change(screen.getByLabelText(/encounter id/i), { target: { value: 'enc-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^optimize$/i }));

    expect(await screen.findByText(/sepsis screening/i)).toBeInTheDocument();
    expect(screen.getByText(/add r65\.20/i)).toBeInTheDocument();
  });
});
