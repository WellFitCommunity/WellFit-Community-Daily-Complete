/**
 * Tests for SDOHCoderAssist Component
 *
 * Purpose: Verify SDOH-enhanced billing coder functionality
 * Coverage: Tabs, SDOH analysis, CCM recommendations, compliance validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SDOHCoderAssist } from '../SDOHCoderAssist';

// Mock SDOHBillingService
vi.mock('../../../services/sdohBillingService', () => ({
  SDOHBillingService: {
    analyzeEncounter: vi.fn(),
    validateBillingCompliance: vi.fn(),
    trackCCMTime: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'rec-123' }, error: null }),
        }),
      }),
    })),
  },
}));

// Mock CCMTimeTracker
vi.mock('../CCMTimeTracker', () => ({
  CCMTimeTracker: ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
    <div data-testid="ccm-time-tracker">
      <button onClick={onCancel}>Cancel CCM</button>
      <button onClick={() => onSave()}>Save CCM</button>
    </div>
  ),
}));

import { SDOHBillingService } from '../../../services/sdohBillingService';
import { supabase } from '../../../lib/supabaseClient';

describe('SDOHCoderAssist', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    patientId: 'patient-456',
  };

  const mockEnhancedSuggestion = {
    medicalCodes: {
      icd10: [
        { code: 'I10', rationale: 'Essential hypertension', principal: true, category: 'medical' as const },
        { code: 'Z59.4', rationale: 'Food insecurity', principal: false, category: 'sdoh' as const },
      ],
    },
    procedureCodes: {
      cpt: [{ code: '99213', rationale: 'Office visit' }],
      hcpcs: [],
    },
    sdohAssessment: {
      patientId: 'patient-456',
      assessmentDate: '2024-01-15',
      housingInstability: null,
      foodInsecurity: { zCode: 'Z59.4', description: 'Food insecurity', severity: 'moderate' as const, impact: 'medium' as const, documented: true, source: 'assessment' },
      transportationBarriers: null,
      socialIsolation: null,
      financialInsecurity: null,
      educationBarriers: null,
      employmentConcerns: null,
      overallComplexityScore: 65,
      ccmEligible: true,
      ccmTier: 'standard' as const,
    },
    ccmRecommendation: {
      eligible: true,
      tier: 'standard' as const,
      expectedReimbursement: 62.43,
      justification: 'Patient has chronic conditions requiring ongoing care coordination',
      requiredDocumentation: ['Care plan', 'Time documentation', 'Patient consent'],
    },
    auditReadiness: {
      score: 85,
      missingElements: [],
      recommendations: [],
    },
    confidence: 88,
    notes: 'SDOH factors identified - additional Z-codes recommended',
  };

  const mockValidation = {
    isValid: true,
    errors: [],
    warnings: [
      { code: 'FOOD_INSECURITY', field: 'icd10.Z59.4', message: 'Patient has food insecurity', recommendation: 'Consider referral' },
    ],
    auditFlags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(SDOHBillingService.analyzeEncounter).mockResolvedValue(mockEnhancedSuggestion);
    vi.mocked(SDOHBillingService.validateBillingCompliance).mockResolvedValue(mockValidation);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with header', () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      expect(screen.getByText('SDOH Billing Encoder')).toBeInTheDocument();
      expect(screen.getByText(/Advanced coding with social determinants/)).toBeInTheDocument();
    });

    it('should render Analyze and Save buttons', () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Analyze Encounter/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Accept & Save/i })).toBeInTheDocument();
    });

    it('should show ready state message initially', () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      expect(screen.getByText(/Ready to analyze encounter/)).toBeInTheDocument();
    });

    it('should disable Accept & Save initially', () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Accept & Save/i })).toBeDisabled();
    });
  });

  describe('Analysis Flow', () => {
    it('should call SDOHBillingService.analyzeEncounter on analyze', async () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));

      await waitFor(() => {
        expect(SDOHBillingService.analyzeEncounter).toHaveBeenCalledWith('encounter-123');
      });
    });

    it('should call validateBillingCompliance after analysis', async () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));

      await waitFor(() => {
        expect(SDOHBillingService.validateBillingCompliance).toHaveBeenCalledWith(mockEnhancedSuggestion);
      });
    });

    it('should show loading state during analysis', async () => {
      vi.mocked(SDOHBillingService.analyzeEncounter).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<SDOHCoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));

      await waitFor(() => {
        expect(screen.getByText(/Analyzing…/i)).toBeInTheDocument();
      });
    });

    it('should show tabs after successful analysis', async () => {
      render(<SDOHCoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Codes/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /SDOH Analysis/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /CCM Recommendation/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Compliance/i })).toBeInTheDocument();
      });
    });

    it('should show error on analysis failure', async () => {
      vi.mocked(SDOHBillingService.analyzeEncounter).mockRejectedValue(new Error('Service unavailable'));

      render(<SDOHCoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));

      await waitFor(() => {
        expect(screen.getByText(/Service unavailable/)).toBeInTheDocument();
      });
    });
  });

  describe('Codes Tab', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByText('I10')).toBeInTheDocument();
      });
    });

    it('should display ICD-10 codes', () => {
      expect(screen.getByText('I10')).toBeInTheDocument();
      expect(screen.getByText('Essential hypertension')).toBeInTheDocument();
    });

    it('should show SDOH code badge for Z-codes', () => {
      expect(screen.getByText('SDOH Code')).toBeInTheDocument();
    });

    it('should show principal diagnosis badge', () => {
      expect(screen.getByText('Principal')).toBeInTheDocument();
    });

    it('should display CPT codes', () => {
      expect(screen.getByText('99213')).toBeInTheDocument();
    });
  });

  describe('SDOH Analysis Tab', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /SDOH Analysis/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /SDOH Analysis/i }));
    });

    it('should display complexity score', async () => {
      await waitFor(() => {
        // The complexity score appears in multiple places, so we use getAllByText
        const scores = screen.getAllByText('65');
        expect(scores.length).toBeGreaterThan(0);
        expect(screen.getByText('Complexity Score')).toBeInTheDocument();
      });
    });

    it('should display CCM eligibility', async () => {
      await waitFor(() => {
        expect(screen.getByText('CCM Eligible:')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
      });
    });

    it('should display SDOH factors', async () => {
      await waitFor(() => {
        expect(screen.getByText('Food Insecurity')).toBeInTheDocument();
        expect(screen.getByText('moderate')).toBeInTheDocument();
        expect(screen.getByText('medium impact')).toBeInTheDocument();
      });
    });
  });

  describe('CCM Recommendation Tab', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /CCM Recommendation/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /CCM Recommendation/i }));
    });

    it('should display CCM eligibility status', async () => {
      await waitFor(() => {
        expect(screen.getByText('Eligible:')).toBeInTheDocument();
      });
    });

    it('should display expected reimbursement', async () => {
      await waitFor(() => {
        expect(screen.getByText('Expected Reimbursement:')).toBeInTheDocument();
        // Reimbursement may appear in multiple places, use getAllByText
        const amounts = screen.getAllByText('$62.43');
        expect(amounts.length).toBeGreaterThan(0);
      });
    });

    it('should display required documentation', async () => {
      await waitFor(() => {
        expect(screen.getByText('Required Documentation')).toBeInTheDocument();
        expect(screen.getByText('Care plan')).toBeInTheDocument();
        expect(screen.getByText('Time documentation')).toBeInTheDocument();
      });
    });

    it('should show CCM time tracking button', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start CCM Time Tracking/i })).toBeInTheDocument();
      });
    });
  });

  describe('Compliance Tab', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Compliance/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /Compliance/i }));
    });

    it('should display compliance status', async () => {
      await waitFor(() => {
        expect(screen.getByText('Billing Compliance Status')).toBeInTheDocument();
        expect(screen.getByText('Compliant')).toBeInTheDocument();
      });
    });

    it('should display warnings', async () => {
      await waitFor(() => {
        expect(screen.getByText(/Warnings/)).toBeInTheDocument();
        expect(screen.getByText('FOOD_INSECURITY')).toBeInTheDocument();
      });
    });
  });

  describe('Summary Footer', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByText('Confidence Score')).toBeInTheDocument();
      });
    });

    it('should display confidence score', () => {
      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    it('should display audit readiness score', () => {
      expect(screen.getByText('Audit Readiness')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('should display expected revenue', () => {
      expect(screen.getByText('Expected Revenue')).toBeInTheDocument();
    });
  });

  describe('Saving Recommendation', () => {
    it('should enable Accept & Save after analysis', async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Accept & Save/i })).not.toBeDisabled();
      });
    });

    it('should save to coding_recommendations table', async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Accept & Save/i })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('coding_recommendations');
      });
    });

    it('should call onSaved callback', async () => {
      const onSaved = vi.fn();
      render(<SDOHCoderAssist {...defaultProps} onSaved={onSaved} />);

      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Accept & Save/i })).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalled();
      });
    });
  });

  describe('CCM Time Tracker Modal', () => {
    beforeEach(async () => {
      render(<SDOHCoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Analyze Encounter/i }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /CCM Recommendation/i })).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /CCM Recommendation/i }));
    });

    it('should open CCM time tracker when button clicked', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start CCM Time Tracking/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Start CCM Time Tracking/i }));

      await waitFor(() => {
        expect(screen.getByTestId('ccm-time-tracker')).toBeInTheDocument();
      });
    });

    it('should close CCM tracker on cancel', async () => {
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start CCM Time Tracking/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Start CCM Time Tracking/i }));

      await waitFor(() => {
        expect(screen.getByTestId('ccm-time-tracker')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Cancel CCM/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('ccm-time-tracker')).not.toBeInTheDocument();
      });
    });
  });
});
