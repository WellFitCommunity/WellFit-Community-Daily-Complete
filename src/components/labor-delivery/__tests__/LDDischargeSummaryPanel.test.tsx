/**
 * LDDischargeSummaryPanel Component Tests
 * Tier 1-2: Tests AI discharge summary generation and display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDDischargeSummaryPanel from '../LDDischargeSummaryPanel';

const mockGenerateSummary = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI', () => ({
  generateDischargeSummary: (...args: unknown[]) => mockGenerateSummary(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const summarySuccess = {
  success: true as const,
  data: {
    hospitalCourse: 'Patient admitted in active labor at 39+2 weeks. Progressed to complete dilation. Uncomplicated spontaneous vaginal delivery of a viable male infant.',
    diagnoses: [
      { code: 'O80', display: 'Full-term uncomplicated delivery', type: 'principal' },
      { code: 'Z37.0', display: 'Single live birth', type: 'secondary' },
    ],
    procedures: ['Spontaneous vaginal delivery'],
    medications: [
      { name: 'Ibuprofen 600mg', dose: '600mg', frequency: 'Q6H PRN', instructions: 'Take with food for pain' },
      { name: 'Prenatal vitamins', dose: '1 tablet', frequency: 'Daily', instructions: 'Continue for 6 weeks postpartum' },
    ],
    followUpInstructions: [
      'OB follow-up in 6 weeks',
      'Pediatrician visit within 3-5 days of discharge',
    ],
    warningSignsMother: [
      'Heavy bleeding (soaking more than one pad per hour)',
      'Fever above 100.4°F',
    ],
    warningSignsNewborn: [
      'Difficulty breathing or blue skin color',
      'Not feeding well or refusing to eat',
    ],
    patientEducation: [
      'Breastfeeding support available via lactation consultant',
      'Perineal care instructions reviewed',
    ],
    generatedAt: new Date().toISOString(),
    requiresReview: true,
    confidenceScore: 0.91,
  },
  error: null,
};

describe('LDDischargeSummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders generate button before summary is created', () => {
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    expect(screen.getByText('Generate Discharge Summary')).toBeInTheDocument();
    expect(screen.getByText('AI Discharge Summary')).toBeInTheDocument();
  });

  it('shows loading state during generation', () => {
    mockGenerateSummary.mockReturnValue(new Promise(() => {}));
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('displays hospital course after successful generation', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText(/admitted in active labor/)).toBeInTheDocument();
    });
  });

  it('displays diagnoses with ICD codes', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText('O80')).toBeInTheDocument();
    });
    expect(screen.getByText('Full-term uncomplicated delivery')).toBeInTheDocument();
    expect(screen.getByText('Z37.0')).toBeInTheDocument();
  });

  it('displays discharge medications with dosage instructions', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText(/Ibuprofen 600mg/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Take with food for pain/)).toBeInTheDocument();
  });

  it('displays warning signs for mother and newborn', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText(/Warning Signs/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Heavy bleeding/)).toBeInTheDocument();
    expect(screen.getByText(/Difficulty breathing/)).toBeInTheDocument();
  });

  it('shows confidence score and clinician review notice', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText(/clinician review/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/91%/)).toBeInTheDocument();
  });

  it('displays follow-up instructions', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText(/OB follow-up in 6 weeks/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pediatrician visit/)).toBeInTheDocument();
  });

  it('displays error message on generation failure', async () => {
    mockGenerateSummary.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Insufficient clinical data' },
    });
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(screen.getByText('Insufficient clinical data')).toBeInTheDocument();
    });
  });

  it('passes correct params to the AI service', async () => {
    mockGenerateSummary.mockResolvedValue(summarySuccess);
    render(<LDDischargeSummaryPanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Generate Discharge Summary'));

    await waitFor(() => {
      expect(mockGenerateSummary).toHaveBeenCalledWith('p1', 't1');
    });
  });
});
