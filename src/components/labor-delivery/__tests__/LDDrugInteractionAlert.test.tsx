/**
 * LDDrugInteractionAlert Component Tests
 * Tier 1-2: Tests drug interaction check auto-trigger and safety alerts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LDDrugInteractionAlert from '../LDDrugInteractionAlert';

const mockCheckInteraction = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI', () => ({
  checkLDDrugInteraction: (...args: unknown[]) => mockCheckInteraction(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const noInteractions = {
  success: true as const,
  data: {
    has_interactions: false,
    interactions: [],
    checked_against: ['Pitocin', 'Penicillin G'],
  },
  error: null,
};

const withInteractions = {
  success: true as const,
  data: {
    has_interactions: true,
    interactions: [
      {
        severity: 'high',
        interacting_medication: 'Magnesium Sulfate',
        description: 'May potentiate respiratory depression when combined with Fentanyl.',
      },
      {
        severity: 'moderate',
        interacting_medication: 'Nifedipine',
        description: 'Additive hypotensive effect.',
      },
    ],
    checked_against: ['Magnesium Sulfate', 'Nifedipine', 'Pitocin'],
    alternatives: [
      {
        medication_name: 'Morphine',
        rationale: 'Lower respiratory depression risk in this combination',
        considerations: ['Monitor sedation level'],
      },
    ],
  },
  error: null,
};

describe('LDDrugInteractionAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while checking interactions', () => {
    mockCheckInteraction.mockReturnValue(new Promise(() => {}));
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);
    expect(screen.getByText(/Checking drug interactions for Fentanyl/)).toBeInTheDocument();
  });

  it('displays green safe message when no interactions found', async () => {
    mockCheckInteraction.mockResolvedValue(noInteractions);
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/No known drug interactions found for Fentanyl/)).toBeInTheDocument();
    });
    expect(screen.getByText(/checked against 2 active medications/)).toBeInTheDocument();
  });

  it('displays red warning when interactions are found', async () => {
    mockCheckInteraction.mockResolvedValue(withInteractions);
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/Drug Interaction Warning/)).toBeInTheDocument();
    });
    expect(screen.getByText('Magnesium Sulfate')).toBeInTheDocument();
    expect(screen.getByText(/May potentiate respiratory depression/)).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MODERATE')).toBeInTheDocument();
  });

  it('displays AI-suggested alternatives when interactions found', async () => {
    mockCheckInteraction.mockResolvedValue(withInteractions);
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);

    await waitFor(() => {
      expect(screen.getByText('AI-Suggested Alternatives')).toBeInTheDocument();
    });
    expect(screen.getByText('Morphine')).toBeInTheDocument();
    expect(screen.getByText(/Lower respiratory depression risk/)).toBeInTheDocument();
  });

  it('calls onSafetyCheck with true when no interactions', async () => {
    mockCheckInteraction.mockResolvedValue(noInteractions);
    const onSafetyCheck = vi.fn();
    render(
      <LDDrugInteractionAlert
        medicationName="Fentanyl"
        patientId="p1"
        onSafetyCheck={onSafetyCheck}
      />
    );

    await waitFor(() => {
      expect(onSafetyCheck).toHaveBeenCalledWith(true);
    });
  });

  it('calls onSafetyCheck with false when interactions exist', async () => {
    mockCheckInteraction.mockResolvedValue(withInteractions);
    const onSafetyCheck = vi.fn();
    render(
      <LDDrugInteractionAlert
        medicationName="Fentanyl"
        patientId="p1"
        onSafetyCheck={onSafetyCheck}
      />
    );

    await waitFor(() => {
      expect(onSafetyCheck).toHaveBeenCalledWith(false);
    });
  });

  it('shows pharmacist review advisory when interactions found', async () => {
    mockCheckInteraction.mockResolvedValue(withInteractions);
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/Review with pharmacist/)).toBeInTheDocument();
    });
  });

  it('renders nothing when no medication name provided', () => {
    const { container } = render(
      <LDDrugInteractionAlert medicationName="" patientId="p1" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('handles check failure gracefully', async () => {
    mockCheckInteraction.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Service unavailable' },
    });
    render(<LDDrugInteractionAlert medicationName="Fentanyl" patientId="p1" />);

    await waitFor(() => {
      expect(screen.getByText(/Drug interaction check unavailable/)).toBeInTheDocument();
    });
  });
});
