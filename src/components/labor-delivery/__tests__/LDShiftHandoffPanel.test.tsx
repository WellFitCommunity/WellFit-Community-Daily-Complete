/**
 * LDShiftHandoffPanel Component Tests
 * Tier 1-2: Tests shift handoff generation and structured display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDShiftHandoffPanel from '../LDShiftHandoffPanel';

const mockGenerateHandoff = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier2', () => ({
  generateLDShiftHandoff: (...args: unknown[]) => mockGenerateHandoff(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

const handoffSuccess = {
  success: true as const,
  data: {
    sections: [
      {
        title: 'Pregnancy Overview',
        content: 'G2P1, EDD: 2026-03-15, Blood type: A+, Status: active labor',
        priority: 'routine' as const,
      },
      {
        title: 'Labor Progress',
        content: 'Stage: active labor, Cervix: 6cm / 80% effaced, Station: 0, Contractions: 4/10min',
        priority: 'notable' as const,
      },
      {
        title: 'Fetal Monitoring',
        content: 'FHR Baseline: 145 bpm, Category: I, Variability: moderate, Decelerations: none',
        priority: 'routine' as const,
      },
      {
        title: 'Active Alerts',
        content: '[HIGH] GBS positive — antibiotics not yet administered',
        priority: 'critical' as const,
      },
    ],
    urgencyLevel: 'urgent',
    generatedAt: new Date().toISOString(),
    patientSummary: 'G2P1 — active labor',
    activeAlerts: ['[HIGH] GBS positive — antibiotics not yet administered'],
    pendingActions: ['Follow up on GBS prophylaxis timing'],
  },
  error: null,
};

describe('LDShiftHandoffPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders generate button before handoff is created', () => {
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    expect(screen.getByText('Generate Handoff')).toBeInTheDocument();
    expect(screen.getByText('L&D Shift Handoff')).toBeInTheDocument();
  });

  it('shows loading state during generation', () => {
    mockGenerateHandoff.mockReturnValue(new Promise(() => {}));
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('displays all handoff sections after generation', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText('Pregnancy Overview')).toBeInTheDocument();
    });
    expect(screen.getByText('Labor Progress')).toBeInTheDocument();
    expect(screen.getByText('Fetal Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
  });

  it('displays labor progress content in handoff', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText(/6cm \/ 80% effaced/)).toBeInTheDocument();
    });
  });

  it('shows urgency badge', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText('URGENT')).toBeInTheDocument();
    });
  });

  it('displays patient summary', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText('G2P1 — active labor')).toBeInTheDocument();
    });
  });

  it('displays pending actions section', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText('Pending Actions')).toBeInTheDocument();
    });
    expect(screen.getByText(/GBS prophylaxis timing/)).toBeInTheDocument();
  });

  it('passes correct params to the handoff service', async () => {
    mockGenerateHandoff.mockResolvedValue(handoffSuccess);
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(mockGenerateHandoff).toHaveBeenCalledWith('p1', 't1', 'preg-1');
    });
  });

  it('displays error on failure', async () => {
    mockGenerateHandoff.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Database connection failed' },
    });
    render(
      <LDShiftHandoffPanel patientId="p1" tenantId="t1" pregnancyId="preg-1" />
    );
    fireEvent.click(screen.getByText('Generate Handoff'));

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });
  });
});
