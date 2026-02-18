/**
 * LDPatientEducationPanel Component Tests
 * Tier 1-2: Tests topic selection, generate button state, content display,
 * topic-change clearing, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDPatientEducationPanel from '../LDPatientEducationPanel';
import type { LDEducationTopicKey } from '../../../services/laborDelivery/laborDeliveryAI_tier3';

const mockGenerateEducation = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier3', () => ({
  generateLDPatientEducation: (...args: unknown[]) => mockGenerateEducation(...args),
  LD_EDUCATION_TOPICS: {
    labor_preparation: {
      topic: 'labor_preparation',
      label: 'Labor & Delivery Preparation',
      condition: 'pregnancy labor preparation',
    },
    breastfeeding: {
      topic: 'breastfeeding',
      label: 'Breastfeeding Guidance',
      condition: 'breastfeeding lactation newborn feeding',
    },
    postpartum_warning_signs: {
      topic: 'postpartum_warning_signs',
      label: 'Postpartum Warning Signs',
      condition: 'postpartum complications warning signs maternal',
    },
    newborn_care: {
      topic: 'newborn_care',
      label: 'Newborn Care Basics',
      condition: 'newborn infant care bathing feeding sleep safety',
    },
  } as const,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const ALL_TOPICS: LDEducationTopicKey[] = [
  'labor_preparation',
  'breastfeeding',
  'postpartum_warning_signs',
  'newborn_care',
];

const educationSuccess = {
  success: true as const,
  data: {
    topic: 'breastfeeding',
    title: 'Breastfeeding Guidance for New Mothers',
    content: 'Breastfeeding provides optimal nutrition for your newborn. Skin-to-skin contact in the first hour supports milk production.',
    format: 'text' as const,
    generatedAt: '2026-01-15T10:00:00.000Z',
    requiresReview: true,
  },
  error: null,
};

describe('LDPatientEducationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows topic dropdown populated with all available topics', () => {
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    expect(screen.getByRole('combobox', { name: /education topic/i })).toBeInTheDocument();
    expect(screen.getByText('Labor & Delivery Preparation')).toBeInTheDocument();
    expect(screen.getByText('Breastfeeding Guidance')).toBeInTheDocument();
    expect(screen.getByText('Postpartum Warning Signs')).toBeInTheDocument();
    expect(screen.getByText('Newborn Care Basics')).toBeInTheDocument();
  });

  it('renders only the topics supplied via availableTopics prop', () => {
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={['labor_preparation']}
      />
    );

    expect(screen.getByText('Labor & Delivery Preparation')).toBeInTheDocument();
    expect(screen.queryByText('Breastfeeding Guidance')).not.toBeInTheDocument();
    expect(screen.queryByText('Postpartum Warning Signs')).not.toBeInTheDocument();
    expect(screen.queryByText('Newborn Care Basics')).not.toBeInTheDocument();
  });

  it('Generate button is disabled when no topic is selected', () => {
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    const button = screen.getByRole('button', { name: /generate/i });
    expect(button).toBeDisabled();
  });

  it('Generate button becomes enabled after a topic is selected', () => {
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'breastfeeding' },
    });

    expect(screen.getByRole('button', { name: /generate/i })).not.toBeDisabled();
  });

  it('displays education title, content, and Review Required badge after successful generation', async () => {
    mockGenerateEducation.mockResolvedValue(educationSuccess);
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'breastfeeding' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Breastfeeding Guidance for New Mothers')).toBeInTheDocument();
    });
    expect(screen.getByText(/optimal nutrition for your newborn/)).toBeInTheDocument();
    expect(screen.getByText('Review Required')).toBeInTheDocument();
  });

  it('passes topic label, condition, patientId, and format to the AI service', async () => {
    mockGenerateEducation.mockResolvedValue(educationSuccess);
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'breastfeeding' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(mockGenerateEducation).toHaveBeenCalledWith(
        'Breastfeeding Guidance',
        'breastfeeding lactation newborn feeding',
        'patient-001',
        'text'
      );
    });
  });

  it('clears previously generated content when a new topic is selected', async () => {
    mockGenerateEducation.mockResolvedValue(educationSuccess);
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'breastfeeding' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Breastfeeding Guidance for New Mothers')).toBeInTheDocument();
    });

    // Switch to a different topic — content must disappear before re-generating
    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'newborn_care' },
    });

    expect(screen.queryByText('Breastfeeding Guidance for New Mothers')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Required')).not.toBeInTheDocument();
  });

  it('shows error message when generation fails', async () => {
    mockGenerateEducation.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Education service unavailable' },
    });
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'labor_preparation' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Education service unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('Review Required')).not.toBeInTheDocument();
  });

  it('clears a previous error message when the topic is changed', async () => {
    mockGenerateEducation.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Education service unavailable' },
    });
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'labor_preparation' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByText('Education service unavailable')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'newborn_care' },
    });

    expect(screen.queryByText('Education service unavailable')).not.toBeInTheDocument();
  });

  it('shows loading state while generation is in progress', () => {
    mockGenerateEducation.mockReturnValue(new Promise(() => {}));
    render(
      <LDPatientEducationPanel
        patientId="patient-001"
        availableTopics={ALL_TOPICS}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /education topic/i }), {
      target: { value: 'postpartum_warning_signs' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(screen.getByText('Generating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
  });
});
