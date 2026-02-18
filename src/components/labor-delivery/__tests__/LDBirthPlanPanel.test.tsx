/**
 * LDBirthPlanPanel Component Tests
 * Tier 1-2: Tests AI birth plan generation display + user interaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDBirthPlanPanel from '../LDBirthPlanPanel';

const mockGenerateBirthPlan = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier3', () => ({
  generateBirthPlan: (...args: unknown[]) => mockGenerateBirthPlan(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const birthPlanSuccess = {
  success: true as const,
  data: {
    patientId: 'p1',
    generatedAt: '2026-02-18T10:00:00.000Z',
    sections: {
      labor_environment: {
        title: 'Labor Environment',
        content: 'Patient prefers a calm, dimly lit room.',
        preferences: ['Dim lighting', 'Soft music allowed', 'Minimal staff interruptions'],
      },
      pain_management: {
        title: 'Pain Management',
        content: 'Patient requests epidural analgesia.',
        preferences: ['Epidural preferred', 'IV pain medication as backup'],
      },
      delivery_preferences: {
        title: 'Delivery Preferences',
        content: 'Patient prefers vaginal delivery if medically possible.',
        preferences: ['Avoid episiotomy if possible', 'Mirror available for viewing'],
      },
      newborn_care: {
        title: 'Newborn Care',
        content: 'Immediate skin-to-skin contact requested.',
        preferences: ['Delayed cord clamping', 'Skin-to-skin immediately after birth'],
      },
      feeding_plan: {
        title: 'Feeding Plan',
        content: 'Patient plans to breastfeed exclusively.',
        preferences: ['No formula supplementation', 'Lactation consultant requested'],
      },
      support_team: {
        title: 'Support Team',
        content: 'Partner and doula will be present.',
        preferences: ['Partner present at all times', 'Doula permitted in delivery room'],
      },
      emergency_preferences: {
        title: 'Emergency Preferences',
        content: 'In emergency, provider judgment deferred to.',
        preferences: ['Discuss options before C-section if time allows'],
      },
      postpartum_wishes: {
        title: 'Postpartum Wishes',
        content: 'Patient requests private recovery room.',
        preferences: ['Rooming-in with newborn', 'Limit visitor hours first 24h'],
      },
    },
    requiresReview: true as const,
    confidenceScore: 0.85,
  },
  error: null,
};

describe('LDBirthPlanPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Generate Birth Plan button and title before plan is generated', () => {
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    expect(screen.getByText('Generate Birth Plan')).toBeInTheDocument();
    expect(screen.getByText('AI Birth Plan Generator')).toBeInTheDocument();
  });

  it('shows loading state while birth plan is being generated', async () => {
    mockGenerateBirthPlan.mockReturnValue(new Promise(() => {}));
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('displays all 8 birth plan section titles after successful generation', async () => {
    mockGenerateBirthPlan.mockResolvedValue(birthPlanSuccess);
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));

    // Section titles are rendered with an emoji prefix as a sibling text node,
    // so we match by regex to find the title text within the heading element.
    await waitFor(() => {
      expect(screen.getByText(/Labor Environment/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Pain Management/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery Preferences/)).toBeInTheDocument();
    expect(screen.getByText(/Newborn Care/)).toBeInTheDocument();
    expect(screen.getByText(/Feeding Plan/)).toBeInTheDocument();
    expect(screen.getByText(/Support Team/)).toBeInTheDocument();
    expect(screen.getByText(/Emergency Preferences/)).toBeInTheDocument();
    expect(screen.getByText(/Postpartum Wishes/)).toBeInTheDocument();
  });

  it('displays section content and preferences from birth plan result', async () => {
    mockGenerateBirthPlan.mockResolvedValue(birthPlanSuccess);
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));

    await waitFor(() => {
      expect(screen.getByText('Patient prefers a calm, dimly lit room.')).toBeInTheDocument();
    });
    expect(screen.getByText('Dim lighting')).toBeInTheDocument();
    expect(screen.getByText('Epidural preferred')).toBeInTheDocument();
    expect(screen.getByText('Delayed cord clamping')).toBeInTheDocument();
    expect(screen.getByText('Rooming-in with newborn')).toBeInTheDocument();
  });

  it('shows Clinical Review Required disclaimer with confidence score after generation', async () => {
    mockGenerateBirthPlan.mockResolvedValue(birthPlanSuccess);
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));

    await waitFor(() => {
      expect(screen.getByText('Clinical Review Required:')).toBeInTheDocument();
    });
    expect(screen.getByText(/85%/)).toBeInTheDocument();
  });

  it('shows Print and Regenerate buttons after birth plan is displayed', async () => {
    mockGenerateBirthPlan.mockResolvedValue(birthPlanSuccess);
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));

    await waitFor(() => {
      expect(screen.getByText('Print')).toBeInTheDocument();
    });
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('displays error message when birth plan generation fails', async () => {
    mockGenerateBirthPlan.mockResolvedValue({
      success: false as const,
      data: null,
      error: {
        code: 'AI_SERVICE_ERROR' as const,
        message: 'Edge function timeout during birth plan generation',
      },
    });
    render(
      <LDBirthPlanPanel patientId="p1" providerId="prov1" />
    );
    fireEvent.click(screen.getByText('Generate Birth Plan'));

    await waitFor(() => {
      expect(screen.getByText('Edge function timeout during birth plan generation')).toBeInTheDocument();
    });
  });
});
