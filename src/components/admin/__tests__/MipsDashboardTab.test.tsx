/**
 * MIPS Dashboard Tab Tests
 *
 * Tests category score display, IA checklist, calculate button, and payment adjustment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('../../../services/qualityMeasures/mips/mipsCompositeService', () => ({
  getMipsComposite: vi.fn(),
  calculateMipsComposite: vi.fn(),
  getImprovementActivities: vi.fn(),
}));

import { MipsDashboardTab } from '../quality-measures/MipsDashboardTab';
import { getMipsComposite, calculateMipsComposite, getImprovementActivities } from '../../../services/qualityMeasures/mips/mipsCompositeService';

describe('MipsDashboardTab', () => {
  const mockComposite = {
    id: 'comp-1', tenantId: 'tenant-1', reportingYear: 2026,
    qualityScore: 72.5, qualityWeight: 0.30,
    costScore: 55.0, costWeight: 0.30,
    improvementActivitiesScore: 80.0, improvementActivitiesWeight: 0.15,
    promotingInteroperabilityScore: 60.0, promotingInteroperabilityWeight: 0.25,
    finalCompositeScore: 65.3,
    paymentAdjustmentPercent: 0,
    benchmarkDecile: 6,
    qualityMeasureScores: [
      { measureId: 'CMS122v12', cmsId: 'CMS122', title: 'HbA1c Poor Control', performanceRate: 0.13, benchmarkDecile: 8, points: 8, maxPoints: 10, isHighPriority: true, isBonus: false },
      { measureId: 'CMS165v12', cmsId: 'CMS165', title: 'BP Control', performanceRate: 0.865, benchmarkDecile: 9, points: 9, maxPoints: 10, isHighPriority: true, isBonus: false },
    ],
    qualityMeasuresReported: 2,
    qualityBonusPoints: 0,
    calculatedAt: '2026-01-15T00:00:00Z',
    notes: null,
  };

  const mockActivities = [
    { id: 'ia-1', tenantId: 'tenant-1', reportingYear: 2026, activityId: 'IA_BMH_1', title: 'Behavioral Health Integration', description: null, category: 'Behavioral Health', subcategory: null, weight: 'high' as const, points: 20, isAttested: true, attestationDate: '2026-01-10', attestedBy: 'user-1', evidenceNotes: null },
    { id: 'ia-2', tenantId: 'tenant-1', reportingYear: 2026, activityId: 'IA_PM_1', title: 'Population Management', description: null, category: 'Population', subcategory: null, weight: 'medium' as const, points: 10, isAttested: false, attestationDate: null, attestedBy: null, evidenceNotes: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMipsComposite).mockResolvedValue({
      success: true, data: mockComposite, error: null,
    });
    vi.mocked(getImprovementActivities).mockResolvedValue({
      success: true, data: mockActivities, error: null,
    });
    vi.mocked(calculateMipsComposite).mockResolvedValue({
      success: true, data: mockComposite, error: null,
    });
  });

  it('should display MIPS header with reporting year', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText(/MIPS Composite Score.*2026/)).toBeInTheDocument();
    });
  });

  it('should display final composite score', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('65.3')).toBeInTheDocument();
      expect(screen.getByText('Final Composite Score')).toBeInTheDocument();
    });
  });

  it('should display payment adjustment', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('Payment Adjustment')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  it('should display quality measure scores in table', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('HbA1c Poor Control')).toBeInTheDocument();
      expect(screen.getByText('BP Control')).toBeInTheDocument();
      expect(screen.getByText('Quality Measure Scores')).toBeInTheDocument();
    });
  });

  it('should display improvement activities with attestation status', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('Improvement Activities')).toBeInTheDocument();
      expect(screen.getByText('Behavioral Health Integration')).toBeInTheDocument();
      expect(screen.getByText('Population Management')).toBeInTheDocument();
    });
  });

  it('should show attested count in IA header', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText(/1 of 2 attested/)).toBeInTheDocument();
    });
  });

  it('should have calculate MIPS button', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Calculate MIPS/i })).toBeInTheDocument();
    });
  });

  it('should trigger calculation on button click', async () => {
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Calculate MIPS/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Calculate MIPS/i }));
    await waitFor(() => {
      expect(calculateMipsComposite).toHaveBeenCalledWith({ tenantId: 'tenant-1', reportingYear: 2026 });
    });
  });

  it('should show empty state when no composite exists', async () => {
    vi.mocked(getMipsComposite).mockResolvedValue({ success: true, data: null, error: null });
    vi.mocked(getImprovementActivities).mockResolvedValue({ success: true, data: [], error: null });
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    await waitFor(() => {
      expect(screen.getByText('No MIPS composite score calculated')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    vi.mocked(getMipsComposite).mockImplementation(() => new Promise(() => {}));
    vi.mocked(getImprovementActivities).mockImplementation(() => new Promise(() => {}));
    render(<MipsDashboardTab tenantId="tenant-1" reportingYear={2026} />);
    expect(screen.getByText('Loading MIPS data...')).toBeInTheDocument();
  });
});
