/**
 * LDContraindicationPanel Component Tests
 * Tier 1-2: Tests AI contraindication check trigger, result display, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDContraindicationPanel from '../LDContraindicationPanel';

const mockCheckLDContraindication = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier3', () => ({
  checkLDContraindication: (...args: unknown[]) => mockCheckLDContraindication(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const warningResult = {
  success: true as const,
  data: {
    assessment: 'warning' as const,
    findings: [
      {
        type: 'allergy',
        severity: 'moderate',
        description: 'Patient has documented penicillin sensitivity.',
        source: 'allergy_intolerances',
        recommendation: 'Confirm allergy history and consider alternative antibiotic.',
      },
      {
        type: 'condition',
        severity: 'low',
        description: 'Monitor closely given third-trimester gestational age.',
        source: 'pregnancy_record',
        recommendation: 'Consult MFM if prolonged use required.',
      },
    ],
    clinicalSummary:
      'Oxytocin use in this patient warrants caution due to documented penicillin allergy and advanced gestational age.',
    requiresClinicalReview: true,
    checkedAt: new Date().toISOString(),
  },
  error: null,
};

const safeResult = {
  success: true as const,
  data: {
    assessment: 'safe' as const,
    findings: [],
    clinicalSummary: 'No contraindications identified for this medication in this patient.',
    requiresClinicalReview: false,
    checkedAt: new Date().toISOString(),
  },
  error: null,
};

describe('LDContraindicationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state with medication name and trigger button', () => {
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    expect(screen.getByText('AI Contraindication Check')).toBeInTheDocument();
    expect(screen.getByText(/Oxytocin/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Contraindications' })).toBeInTheDocument();
  });

  it('shows loading state when checking contraindications', () => {
    mockCheckLDContraindication.mockReturnValue(new Promise(() => {}));
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));
    expect(screen.getByText('Checking...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
  });

  it('displays assessment badge with correct label for warning assessment', async () => {
    mockCheckLDContraindication.mockResolvedValue(warningResult);
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Oxytocin use in this patient warrants caution/)
    ).toBeInTheDocument();
  });

  it('displays findings list with descriptions and recommendations', async () => {
    mockCheckLDContraindication.mockResolvedValue(warningResult);
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(screen.getByText('Findings (2)')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Patient has documented penicillin sensitivity.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Confirm allergy history and consider alternative antibiotic.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Monitor closely given third-trimester gestational age.')
    ).toBeInTheDocument();
  });

  it('shows Clinical Review Required flag when assessment is not safe', async () => {
    mockCheckLDContraindication.mockResolvedValue(warningResult);
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(screen.getByText('Clinical Review Required')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/A physician must review before proceeding/)
    ).toBeInTheDocument();
  });

  it('does not show Clinical Review Required when assessment is safe', async () => {
    mockCheckLDContraindication.mockResolvedValue(safeResult);
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(screen.getByText('Safe')).toBeInTheDocument();
    });

    expect(screen.queryByText('Clinical Review Required')).not.toBeInTheDocument();
  });

  it('displays error message when the contraindication check fails', async () => {
    mockCheckLDContraindication.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Contraindication service unavailable' },
    });
    render(
      <LDContraindicationPanel
        patientId="p1"
        providerId="dr1"
        medicationName="Oxytocin"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(
        screen.getByText('Contraindication service unavailable')
      ).toBeInTheDocument();
    });
  });

  it('passes all props including indication to the service', async () => {
    mockCheckLDContraindication.mockResolvedValue(safeResult);
    render(
      <LDContraindicationPanel
        patientId="p2"
        providerId="dr2"
        medicationName="Penicillin G"
        indication="GBS prophylaxis"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Check Contraindications' }));

    await waitFor(() => {
      expect(mockCheckLDContraindication).toHaveBeenCalledWith(
        'p2',
        'dr2',
        'Penicillin G',
        'GBS prophylaxis'
      );
    });
  });
});
