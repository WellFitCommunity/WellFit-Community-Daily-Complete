/**
 * RiskAssessmentForm.test.tsx — Tests for maternal risk assessment scoring form
 *
 * Tier 1 (behavior) and Tier 2 (state) tests:
 * - Renders risk factor checkboxes
 * - Score updates when factors are toggled
 * - Risk level changes based on score
 * - Form submission calls service with correct data
 * - Validation / error display
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RiskAssessmentForm from '../RiskAssessmentForm';

vi.mock('../../../services/laborDelivery', () => ({
  LaborDeliveryService: {
    createRiskAssessment: vi.fn(),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn(),
  },
}));

import { LaborDeliveryService } from '../../../services/laborDelivery';

const mockOnSuccess = vi.fn();
const mockOnCancel = vi.fn();

const defaultProps = {
  patientId: '00000000-0000-0000-0000-000000000001',
  tenantId: '2b902657-6a20-4435-a78a-576f397517ca',
  pregnancyId: '00000000-0000-0000-0000-000000000002',
  onSuccess: mockOnSuccess,
  onCancel: mockOnCancel,
};

describe('RiskAssessmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form heading and risk factor checkboxes', () => {
    render(<RiskAssessmentForm {...defaultProps} />);
    expect(screen.getByText('Maternal Risk Assessment')).toBeInTheDocument();
    expect(screen.getByText('Advanced maternal age (>35)')).toBeInTheDocument();
    expect(screen.getByText('Preeclampsia')).toBeInTheDocument();
    expect(screen.getByText('Gestational diabetes')).toBeInTheDocument();
  });

  it('starts with LOW risk level and 0 score', () => {
    render(<RiskAssessmentForm {...defaultProps} />);
    expect(screen.getByText('LOW')).toBeInTheDocument();
    expect(screen.getByText('Score: 0 points')).toBeInTheDocument();
  });

  it('updates score and risk level when factors are selected', () => {
    render(<RiskAssessmentForm {...defaultProps} />);

    // Select Preeclampsia (weight: 3) + Multiple gestation (weight: 3) = 6 → high
    fireEvent.click(screen.getByText('Preeclampsia'));
    fireEvent.click(screen.getByText('Multiple gestation'));

    expect(screen.getByText('Score: 6 points')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('calculates critical risk level for score >= 10', () => {
    render(<RiskAssessmentForm {...defaultProps} />);

    // Select: Preeclampsia (3) + Multiple gestation (3) + Placenta previa (3) + Gestational diabetes (2) = 11 → critical
    fireEvent.click(screen.getByText('Preeclampsia'));
    fireEvent.click(screen.getByText('Multiple gestation'));
    fireEvent.click(screen.getByText('Placenta previa'));
    fireEvent.click(screen.getByText('Gestational diabetes'));

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('deselects a factor when clicked again, reducing the score', () => {
    render(<RiskAssessmentForm {...defaultProps} />);

    fireEvent.click(screen.getByText('Preeclampsia')); // +3
    expect(screen.getByText('Score: 3 points')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Preeclampsia')); // -3
    expect(screen.getByText('Score: 0 points')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  it('calls service on submit with selected factors and computed risk level', async () => {
    vi.mocked(LaborDeliveryService.createRiskAssessment).mockResolvedValue({
      success: true,
      data: { id: 'r1' } as ReturnType<typeof LaborDeliveryService.createRiskAssessment> extends Promise<infer R> ? R extends { data?: infer D } ? D : never : never,
    });

    render(<RiskAssessmentForm {...defaultProps} />);

    fireEvent.click(screen.getByText('Advanced maternal age (>35)'));
    fireEvent.click(screen.getByRole('button', { name: /save risk assessment/i }));

    await waitFor(() => {
      expect(LaborDeliveryService.createRiskAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          patient_id: defaultProps.patientId,
          risk_level: 'low',
          risk_factors: ['Advanced maternal age (>35)'],
          score: 1,
          scoring_system: 'weighted_factor_sum',
        })
      );
    });
  });

  it('displays error message when service fails', async () => {
    vi.mocked(LaborDeliveryService.createRiskAssessment).mockResolvedValue({
      success: false,
      error: 'Database unavailable',
    });

    render(<RiskAssessmentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /save risk assessment/i }));

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<RiskAssessmentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows "Saving..." while submitting', async () => {
    vi.mocked(LaborDeliveryService.createRiskAssessment).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    );

    render(<RiskAssessmentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /save risk assessment/i }));

    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });
});
