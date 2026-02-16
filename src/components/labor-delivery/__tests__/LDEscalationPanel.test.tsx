/**
 * LDEscalationPanel Component Tests
 * Tier 1-2: Tests AI escalation scoring display + user interaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDEscalationPanel from '../LDEscalationPanel';

const mockRequestEscalationScore = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI', () => ({
  requestEscalationScore: (...args: unknown[]) => mockRequestEscalationScore(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const escalationSuccess = {
  success: true as const,
  data: {
    assessmentId: 'esc-001',
    overallEscalationScore: 72,
    confidenceLevel: 0.88,
    escalationCategory: 'escalate' as const,
    urgencyLevel: 'urgent' as const,
    recommendations: [
      {
        action: 'Notify attending physician',
        urgency: 'urgent' as const,
        responsible: 'Charge nurse',
        timeframe: '15 minutes',
        rationale: 'Category II tracing with recurrent late decelerations',
      },
    ],
    requiredNotifications: ['attending_physician', 'charge_nurse'],
    requiresPhysicianReview: true,
    requiresRapidResponse: false,
    clinicalSummary: 'Patient showing signs of fetal distress with category II tracing.',
    hoursToReassess: 1,
  },
  error: null,
};

describe('LDEscalationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the AI assessment button before assessment is run', () => {
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    expect(screen.getByText('Run AI Assessment')).toBeInTheDocument();
    expect(screen.getByText('AI Escalation Assessment')).toBeInTheDocument();
  });

  it('shows loading state when assessment is running', async () => {
    mockRequestEscalationScore.mockReturnValue(new Promise(() => {}));
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
  });

  it('displays escalation score and category after successful assessment', async () => {
    mockRequestEscalationScore.mockResolvedValue(escalationSuccess);
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(screen.getByText(/72/)).toBeInTheDocument();
    });
    expect(screen.getByText('/100')).toBeInTheDocument();
    expect(screen.getByText('Escalate Now')).toBeInTheDocument();
    expect(screen.getByText(/88%/)).toBeInTheDocument();
  });

  it('displays clinical summary and recommendations', async () => {
    mockRequestEscalationScore.mockResolvedValue(escalationSuccess);
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(screen.getByText(/fetal distress/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Notify attending physician')).toBeInTheDocument();
    expect(screen.getByText('URGENT')).toBeInTheDocument();
  });

  it('shows physician review flag when required', async () => {
    mockRequestEscalationScore.mockResolvedValue(escalationSuccess);
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(screen.getByText('Physician Review Required')).toBeInTheDocument();
    });
  });

  it('displays error message on assessment failure', async () => {
    mockRequestEscalationScore.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Edge function timeout' },
    });
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(screen.getByText('Edge function timeout')).toBeInTheDocument();
    });
  });

  it('passes triggerReason to the escalation scoring service', async () => {
    mockRequestEscalationScore.mockResolvedValue(escalationSuccess);
    render(
      <LDEscalationPanel
        patientId="p1"
        assessorId="a1"
        triggerReason="FHR Category III"
      />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(mockRequestEscalationScore).toHaveBeenCalledWith('p1', 'a1', 'FHR Category III');
    });
  });

  it('allows re-assessment after initial result', async () => {
    mockRequestEscalationScore.mockResolvedValue(escalationSuccess);
    render(
      <LDEscalationPanel patientId="p1" assessorId="a1" />
    );
    fireEvent.click(screen.getByText('Run AI Assessment'));

    await waitFor(() => {
      expect(screen.getByText('72')).toBeInTheDocument();
    });

    expect(screen.getByText('Re-assess')).toBeInTheDocument();
  });
});
