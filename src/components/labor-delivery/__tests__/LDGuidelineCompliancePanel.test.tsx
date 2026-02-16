/**
 * LDGuidelineCompliancePanel Component Tests
 * Tier 1-2: Tests ACOG guideline compliance display + user interaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LDGuidelineCompliancePanel from '../LDGuidelineCompliancePanel';

const mockCheckCompliance = vi.fn();

vi.mock('../../../services/laborDelivery/laborDeliveryAI_tier2', () => ({
  checkGuidelineCompliance: (...args: unknown[]) => mockCheckCompliance(...args),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const complianceSuccess = {
  success: true as const,
  data: {
    recommendations: [
      {
        category: 'screening',
        recommendation: 'Order GBS screening at 36 weeks',
        rationale: 'ACOG recommends universal GBS screening between 36-37 weeks',
        evidenceLevel: 'A',
        urgency: 'soon',
        actionItems: ['Order vaginal-rectal swab'],
        guideline: {
          guidelineId: 'acog-gbs-2020',
          guidelineName: 'ACOG GBS Screening',
          organization: 'ACOG',
          year: 2020,
          condition: 'pregnancy',
        },
      },
    ],
    adherenceGaps: [
      {
        gapType: 'missing_screening',
        description: 'Glucose tolerance test not completed',
        expectedCare: 'One-hour glucose challenge test at 24-28 weeks',
        currentState: 'Patient is 30 weeks, no glucose screening on record',
        recommendation: 'Order OGTT immediately',
        priority: 'high',
        guideline: {
          guidelineId: 'ada-gdm',
          guidelineName: 'GDM Screening Guidelines',
          organization: 'ADA',
          year: 2024,
          condition: 'gestational diabetes',
        },
      },
    ],
    preventiveScreenings: [
      {
        screeningName: 'GBS Culture',
        guidelineSource: 'ACOG',
        frequency: 'Once at 36-37 weeks',
        status: 'never_done',
        recommendation: 'Schedule GBS screening',
      },
      {
        screeningName: 'Rh Antibody Screen',
        guidelineSource: 'ACOG',
        frequency: 'First trimester + 28 weeks',
        status: 'current',
        recommendation: 'No action needed',
      },
    ],
    summary: {
      totalGuidelines: 5,
      totalRecommendations: 1,
      criticalGaps: 0,
      highPriorityGaps: 1,
      overdueScreenings: 0,
    },
    confidence: 0.87,
    requiresReview: true,
  },
  error: null,
};

describe('LDGuidelineCompliancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders check button before compliance is run', () => {
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    expect(screen.getByText('Run Compliance Check')).toBeInTheDocument();
    expect(screen.getByText('ACOG Guideline Compliance')).toBeInTheDocument();
  });

  it('shows loading state during check', () => {
    mockCheckCompliance.mockReturnValue(new Promise(() => {}));
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));
    expect(screen.getByText('Checking...')).toBeInTheDocument();
  });

  it('displays adherence gaps with priority badges', async () => {
    mockCheckCompliance.mockResolvedValue(complianceSuccess);
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText('Glucose tolerance test not completed')).toBeInTheDocument();
    });
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText(/Order OGTT immediately/)).toBeInTheDocument();
  });

  it('displays preventive screenings with status badges', async () => {
    mockCheckCompliance.mockResolvedValue(complianceSuccess);
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText('GBS Culture')).toBeInTheDocument();
    });
    expect(screen.getByText('Never Done')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('displays recommendations with evidence levels', async () => {
    mockCheckCompliance.mockResolvedValue(complianceSuccess);
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText(/GBS screening at 36 weeks/)).toBeInTheDocument();
    });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText(/ACOG GBS Screening/)).toBeInTheDocument();
  });

  it('shows high priority gap count badge', async () => {
    mockCheckCompliance.mockResolvedValue(complianceSuccess);
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText('1 High Priority')).toBeInTheDocument();
    });
  });

  it('shows clinician review warning', async () => {
    mockCheckCompliance.mockResolvedValue(complianceSuccess);
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText(/clinician review/i)).toBeInTheDocument();
    });
  });

  it('displays error message on failure', async () => {
    mockCheckCompliance.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'AI_SERVICE_ERROR', message: 'Guideline service unavailable' },
    });
    render(<LDGuidelineCompliancePanel patientId="p1" tenantId="t1" />);
    fireEvent.click(screen.getByText('Run Compliance Check'));

    await waitFor(() => {
      expect(screen.getByText('Guideline service unavailable')).toBeInTheDocument();
    });
  });
});
