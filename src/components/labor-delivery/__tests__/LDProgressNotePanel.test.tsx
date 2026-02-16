/**
 * LDProgressNotePanel Component Tests
 * Tier 1-2: Tests AI progress note generation and SOAP display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDProgressNotePanel from '../LDProgressNotePanel';

const mockGenerateNote = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI', () => ({
  generateLaborProgressNote: (...args: unknown[]) => mockGenerateNote(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const noteSuccess = {
  success: true as const,
  data: {
    subjective: 'Patient reports increasing contraction pain, 8/10.',
    objective: 'Cervix 7cm dilated, 90% effaced, station 0. FHR 140 bpm, Cat I.',
    assessment: 'Active labor, progressing well. No complications.',
    plan: 'Continue monitoring. Reassess in 1 hour. Offer epidural if desired.',
    generatedAt: new Date().toISOString(),
    model: 'claude-haiku-4-5',
  },
  error: null,
};

describe('LDProgressNotePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders generate button before note is created', () => {
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    expect(screen.getByText('Generate Progress Note')).toBeInTheDocument();
    expect(screen.getByText('AI Progress Note')).toBeInTheDocument();
  });

  it('shows loading state during generation', () => {
    mockGenerateNote.mockReturnValue(new Promise(() => {}));
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('displays SOAP note sections after successful generation', async () => {
    mockGenerateNote.mockResolvedValue(noteSuccess);
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));

    await waitFor(() => {
      expect(screen.getByText('Subjective')).toBeInTheDocument();
    });
    expect(screen.getByText('Objective')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });

  it('displays actual note content from AI', async () => {
    mockGenerateNote.mockResolvedValue(noteSuccess);
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));

    await waitFor(() => {
      expect(screen.getByText(/increasing contraction pain/)).toBeInTheDocument();
    });
    expect(screen.getByText(/7cm dilated/)).toBeInTheDocument();
    expect(screen.getByText(/progressing well/)).toBeInTheDocument();
    expect(screen.getByText(/Reassess in 1 hour/)).toBeInTheDocument();
  });

  it('shows clinician review warning', async () => {
    mockGenerateNote.mockResolvedValue(noteSuccess);
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));

    await waitFor(() => {
      expect(screen.getByText(/clinician review/i)).toBeInTheDocument();
    });
  });

  it('displays error message on generation failure', async () => {
    mockGenerateNote.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Model unavailable' },
    });
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));

    await waitFor(() => {
      expect(screen.getByText('Model unavailable')).toBeInTheDocument();
    });
  });

  it('passes correct params to the AI service', async () => {
    mockGenerateNote.mockResolvedValue(noteSuccess);
    render(<LDProgressNotePanel patientId="p1" providerId="dr1" />);
    fireEvent.click(screen.getByText('Generate Progress Note'));

    await waitFor(() => {
      expect(mockGenerateNote).toHaveBeenCalledWith('p1', 'dr1');
    });
  });
});
