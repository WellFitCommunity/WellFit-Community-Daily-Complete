/**
 * LDPPDEarlyWarningPanel Component Tests
 * Tier 1-2: Tests PPD risk display, auto-trigger behavior, and intervention flagging
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDPPDEarlyWarningPanel from '../LDPPDEarlyWarningPanel';

const mockCalculatePPDRisk = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier3', () => ({
  calculatePPDRisk: (...args: unknown[]) => mockCalculatePPDRisk(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}));

const ppdSuccessLow = {
  success: true as const,
  data: {
    compositeScore: 2.8,
    riskLevel: 'low' as const,
    epdsScore: 6,
    contributingFactors: [
      {
        dimension: 'EPDS Score',
        score: 2.0,
        weight: 0.40,
        description: 'EPDS: 6/30 (normalized: 2.0/10)',
      },
      {
        dimension: 'Mental Health Risk',
        score: 3.0,
        weight: 0.25,
        description: 'Mood/stress/anxiety patterns: 3.0/10',
      },
      {
        dimension: 'Social Isolation Risk',
        score: 2.5,
        weight: 0.20,
        description: 'Social engagement patterns: 2.5/10',
      },
      {
        dimension: 'Engagement Risk',
        score: 4.0,
        weight: 0.15,
        description: 'Platform activity level: 4.0/10',
      },
    ],
    recommendedActions: ['Continue routine postpartum follow-up'],
    requiresIntervention: false,
    calculatedAt: '2026-02-18T10:00:00.000Z',
  },
  error: null,
};

const ppdSuccessHigh = {
  success: true as const,
  data: {
    compositeScore: 6.2,
    riskLevel: 'high' as const,
    epdsScore: 15,
    contributingFactors: [
      {
        dimension: 'EPDS Score',
        score: 5.0,
        weight: 0.40,
        description: 'EPDS: 15/30 (normalized: 5.0/10)',
      },
      {
        dimension: 'Mental Health Risk',
        score: 7.5,
        weight: 0.25,
        description: 'Mood/stress/anxiety patterns: 7.5/10',
      },
      {
        dimension: 'Social Isolation Risk',
        score: 7.0,
        weight: 0.20,
        description: 'Social engagement patterns: 7.0/10',
      },
      {
        dimension: 'Engagement Risk',
        score: 6.0,
        weight: 0.15,
        description: 'Platform activity level: 6.0/10',
      },
    ],
    recommendedActions: [
      'Schedule mental health follow-up within 48 hours',
      'EPDS positive screen — clinical evaluation required',
      'Assess social support network — consider peer support group referral',
    ],
    requiresIntervention: true,
    calculatedAt: '2026-02-18T10:00:00.000Z',
  },
  error: null,
};

const ppdSuccessNoEpds = {
  success: true as const,
  data: {
    compositeScore: 4.1,
    riskLevel: 'moderate' as const,
    epdsScore: null,
    contributingFactors: [
      {
        dimension: 'EPDS Score',
        score: 5.0,
        weight: 0.40,
        description: 'EPDS not yet assessed',
      },
      {
        dimension: 'Mental Health Risk',
        score: 4.0,
        weight: 0.25,
        description: 'Mood/stress/anxiety patterns: 4.0/10',
      },
      {
        dimension: 'Social Isolation Risk',
        score: 3.5,
        weight: 0.20,
        description: 'Social engagement patterns: 3.5/10',
      },
      {
        dimension: 'Engagement Risk',
        score: 2.0,
        weight: 0.15,
        description: 'Platform activity level: 2.0/10',
      },
    ],
    recommendedActions: ['Continue routine postpartum follow-up'],
    requiresIntervention: false,
    calculatedAt: '2026-02-18T10:00:00.000Z',
  },
  error: null,
};

describe('LDPPDEarlyWarningPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when hasPostpartumAssessment is false', () => {
    const { container } = render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('auto-triggers calculation when hasPostpartumAssessment is true', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="patient-123" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(mockCalculatePPDRisk).toHaveBeenCalledWith('patient-123');
    });
  });

  it('shows risk level label and composite score after calculation', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
    expect(screen.getByText('2.8')).toBeInTheDocument();
    expect(screen.getByText('/10')).toBeInTheDocument();
  });

  it('shows all four contributing factor dimensions', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Contributing Factors')).toBeInTheDocument();
    });
    expect(screen.getByText('EPDS Score')).toBeInTheDocument();
    expect(screen.getByText('Mental Health Risk')).toBeInTheDocument();
    expect(screen.getByText('Social Isolation Risk')).toBeInTheDocument();
    expect(screen.getByText('Engagement Risk')).toBeInTheDocument();
  });

  it('shows intervention required section with recommended actions when compositeScore >= 5.5', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessHigh);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Intervention Required')).toBeInTheDocument();
    });
    expect(screen.getByText('Schedule mental health follow-up within 48 hours')).toBeInTheDocument();
    expect(screen.getByText('EPDS positive screen — clinical evaluation required')).toBeInTheDocument();
    expect(screen.getByText('Assess social support network — consider peer support group referral')).toBeInTheDocument();
  });

  it('shows EPDS score in header when epdsScore is not null', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
    // The EPDS header <p> renders concatenated text: "EPDS: 6/30"
    const region = screen.getByRole('region', { name: 'PPD risk assessment' });
    expect(region.textContent).toMatch(/EPDS:\s*6\/30/);
  });

  it('omits the header EPDS score display when epdsScore is null', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessNoEpds);
    render(
      <LDPPDEarlyWarningPanel patientId="p2" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Moderate Risk')).toBeInTheDocument();
    });
    // The header <p> with "EPDS: X/30" should not render when epdsScore is null
    expect(screen.queryByText('/30')).not.toBeInTheDocument();
  });

  it('shows error message when calculatePPDRisk fails', async () => {
    mockCalculatePPDRisk.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Failed to retrieve postpartum data' },
    });
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Failed to retrieve postpartum data')).toBeInTheDocument();
    });
  });

  it('does not show intervention section when compositeScore is below 5.5', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
    expect(screen.queryByText('Intervention Required')).not.toBeInTheDocument();
  });

  it('allows manual recalculation via the Recalculate button', async () => {
    mockCalculatePPDRisk.mockResolvedValue(ppdSuccessLow);
    render(
      <LDPPDEarlyWarningPanel patientId="p1" hasPostpartumAssessment={true} />
    );
    await waitFor(() => {
      expect(screen.getByText('Recalculate')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Recalculate'));
    await waitFor(() => {
      expect(mockCalculatePPDRisk).toHaveBeenCalledTimes(2);
    });
  });
});
