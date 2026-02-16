/**
 * LDSDOHPanel Component Tests
 * Tier 1-2: Tests SDOH detection display, risk badges, scan flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDSDOHPanel from '../LDSDOHPanel';

const mockScanSDOH = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier2', () => ({
  scanPrenatalNotesForSDOH: (...args: unknown[]) => mockScanSDOH(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const sdohWithFindings = {
  success: true as const,
  data: {
    detections: [
      {
        category: 'food_insecurity',
        confidenceScore: 0.82,
        riskLevel: 'high',
        urgency: 'soon',
        zCodeMapping: 'Z59.41',
        aiSummary: 'Patient mentioned difficulty affording groceries during pregnancy',
        recommendedActions: [
          { action: 'Refer to WIC program', priority: 'high', timeframe: 'within 1 week' },
          { action: 'Screen with Hunger Vital Sign', priority: 'routine', timeframe: 'next visit' },
        ],
      },
      {
        category: 'transportation_barriers',
        confidenceScore: 0.65,
        riskLevel: 'moderate',
        urgency: 'routine',
        zCodeMapping: 'Z59.82',
        aiSummary: 'Patient has limited access to transportation for prenatal visits',
        recommendedActions: [
          { action: 'Offer telehealth for follow-ups', priority: 'routine', timeframe: 'ongoing' },
        ],
      },
    ],
    totalDetections: 2,
    hasHighRiskFindings: true,
  },
  error: null,
};

const sdohNoFindings = {
  success: true as const,
  data: {
    detections: [],
    totalDetections: 0,
    hasHighRiskFindings: false,
  },
  error: null,
};

describe('LDSDOHPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when noteText is too short', () => {
    const { container } = render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="short" sourceId="s1" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders scan button with adequate note text', () => {
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    expect(screen.getByText('Scan for SDOH')).toBeInTheDocument();
    expect(screen.getByText('SDOH Screening')).toBeInTheDocument();
  });

  it('shows loading state during scan', () => {
    mockScanSDOH.mockReturnValue(new Promise(() => {}));
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));
    expect(screen.getByText('Scanning...')).toBeInTheDocument();
  });

  it('displays detections with risk level badges and Z-codes', async () => {
    mockScanSDOH.mockResolvedValue(sdohWithFindings);
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('SDOH Findings')).toBeInTheDocument();
    });
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MODERATE')).toBeInTheDocument();
    expect(screen.getByText('Z59.41')).toBeInTheDocument();
    expect(screen.getByText('Z59.82')).toBeInTheDocument();
  });

  it('displays high risk findings badge when detections include high risk', async () => {
    mockScanSDOH.mockResolvedValue(sdohWithFindings);
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('High Risk Findings')).toBeInTheDocument();
    });
  });

  it('displays recommended actions with priority and timeframe', async () => {
    mockScanSDOH.mockResolvedValue(sdohWithFindings);
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('Refer to WIC program')).toBeInTheDocument();
    });
    expect(screen.getByText('(within 1 week)')).toBeInTheDocument();
    expect(screen.getByText('Offer telehealth for follow-ups')).toBeInTheDocument();
  });

  it('shows no concerns state when scan finds nothing', async () => {
    mockScanSDOH.mockResolvedValue(sdohNoFindings);
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('No Concerns Detected')).toBeInTheDocument();
    });
    expect(screen.getByText('SDOH Screening Complete')).toBeInTheDocument();
  });

  it('shows confidence scores for detections', async () => {
    mockScanSDOH.mockResolvedValue(sdohWithFindings);
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('82% confidence')).toBeInTheDocument();
    });
    expect(screen.getByText('65% confidence')).toBeInTheDocument();
  });

  it('passes correct params to the SDOH scan service', async () => {
    mockScanSDOH.mockResolvedValue(sdohNoFindings);
    const noteText = 'Patient reports feeling stressed about housing situation and food costs';
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText={noteText} sourceId="src-123" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(mockScanSDOH).toHaveBeenCalledWith('p1', 't1', noteText, 'src-123');
    });
  });

  it('displays error message on failure', async () => {
    mockScanSDOH.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'SDOH service unavailable' },
    });
    render(
      <LDSDOHPanel patientId="p1" tenantId="t1" noteText="Patient reports feeling stressed about housing situation and food costs" sourceId="s1" />
    );
    fireEvent.click(screen.getByText('Scan for SDOH'));

    await waitFor(() => {
      expect(screen.getByText('SDOH service unavailable')).toBeInTheDocument();
    });
  });
});
