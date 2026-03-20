// ============================================================================
// BurnoutAssessmentForm — P0-2 Critical Tests
// ============================================================================
// Tests MBI scoring accuracy, risk level thresholds, form validation,
// page navigation, and crisis detection. A miscalculated score could tell
// a nurse in crisis they're "low risk" — these tests prevent that.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BurnoutAssessmentForm } from '../BurnoutAssessmentForm';
import {
  calculateCompositeBurnoutScore,
  getBurnoutRiskLevel,
  calculateMBIDimensionScore,
  BURNOUT_THRESHOLDS,
} from '../../../types/nurseos';

// Mock the service
vi.mock('../../../services/resilienceHubService', () => ({
  submitBurnoutAssessment: vi.fn(),
}));

import { submitBurnoutAssessment } from '../../../services/resilienceHubService';
const mockSubmit = vi.mocked(submitBurnoutAssessment);

// ============================================================================
// PART 1: UTILITY FUNCTION TESTS (pure math — no rendering)
// ============================================================================
// These test the scoring functions exported from nurseos.ts that the component
// and database both rely on. Getting these wrong has clinical consequences.

describe('MBI Scoring Functions', () => {
  describe('calculateMBIDimensionScore', () => {
    it('returns 0 when all responses are 0 (never)', () => {
      const responses = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 9 questions
      expect(calculateMBIDimensionScore(responses, 9)).toBe(0);
    });

    it('returns 100 when all responses are 6 (every day)', () => {
      const responses = [6, 6, 6, 6, 6, 6, 6, 6, 6]; // 9 questions
      expect(calculateMBIDimensionScore(responses, 9)).toBe(100);
    });

    it('calculates correct mid-range score for emotional exhaustion', () => {
      // 9 questions, all answered 3 → sum = 27, max = 54
      const responses = [3, 3, 3, 3, 3, 3, 3, 3, 3];
      expect(calculateMBIDimensionScore(responses, 9)).toBe(50);
    });

    it('calculates correct score for depersonalization (5 questions)', () => {
      // 5 questions, all answered 6 → sum = 30, max = 30
      const responses = [6, 6, 6, 6, 6];
      expect(calculateMBIDimensionScore(responses, 5)).toBe(100);
    });

    it('calculates correct score for personal accomplishment (8 questions)', () => {
      // 8 questions, all answered 2 → sum = 16, max = 48
      const responses = [2, 2, 2, 2, 2, 2, 2, 2];
      const expected = (16 / 48) * 100;
      expect(calculateMBIDimensionScore(responses, 8)).toBeCloseTo(expected, 2);
    });

    it('handles single question dimension', () => {
      expect(calculateMBIDimensionScore([3], 1)).toBe(50);
    });

    it('handles empty responses array', () => {
      expect(calculateMBIDimensionScore([], 0)).toBeNaN();
    });
  });

  describe('calculateCompositeBurnoutScore', () => {
    it('returns 0 when all dimensions are 0 (no burnout)', () => {
      // EE=0, DP=0, PA=100 (high accomplishment = low burnout)
      // Formula: 0*0.4 + 0*0.3 + (100-100)*0.3 = 0
      expect(calculateCompositeBurnoutScore(0, 0, 100)).toBe(0);
    });

    it('returns 100 when all dimensions indicate maximum burnout', () => {
      // EE=100, DP=100, PA=0 (no accomplishment = max burnout)
      // Formula: 100*0.4 + 100*0.3 + (100-0)*0.3 = 40+30+30 = 100
      expect(calculateCompositeBurnoutScore(100, 100, 0)).toBe(100);
    });

    it('weights emotional exhaustion at 40%', () => {
      // Only EE is non-zero, PA at 100 (cancels PA contribution)
      const score = calculateCompositeBurnoutScore(100, 0, 100);
      // 100*0.4 + 0*0.3 + (100-100)*0.3 = 40
      expect(score).toBe(40);
    });

    it('weights depersonalization at 30%', () => {
      const score = calculateCompositeBurnoutScore(0, 100, 100);
      // 0*0.4 + 100*0.3 + (100-100)*0.3 = 30
      expect(score).toBe(30);
    });

    it('weights personal accomplishment (inverted) at 30%', () => {
      const score = calculateCompositeBurnoutScore(0, 0, 0);
      // 0*0.4 + 0*0.3 + (100-0)*0.3 = 30
      expect(score).toBe(30);
    });

    it('calculates realistic moderate burnout scenario', () => {
      // Nurse with moderate EE, low DP, high PA
      const score = calculateCompositeBurnoutScore(50, 20, 80);
      // 50*0.4 + 20*0.3 + (100-80)*0.3 = 20 + 6 + 6 = 32
      expect(score).toBe(32);
    });

    it('calculates realistic critical burnout scenario', () => {
      // Nurse with very high EE, high DP, low PA
      const score = calculateCompositeBurnoutScore(90, 80, 20);
      // 90*0.4 + 80*0.3 + (100-20)*0.3 = 36 + 24 + 24 = 84
      expect(score).toBe(84);
    });
  });

  describe('getBurnoutRiskLevel', () => {
    it('returns "low" for scores 0-29', () => {
      expect(getBurnoutRiskLevel(0)).toBe('low');
      expect(getBurnoutRiskLevel(15)).toBe('low');
      expect(getBurnoutRiskLevel(29)).toBe('low');
    });

    it('returns "moderate" for scores 30-49', () => {
      expect(getBurnoutRiskLevel(30)).toBe('moderate');
      expect(getBurnoutRiskLevel(40)).toBe('moderate');
      expect(getBurnoutRiskLevel(49)).toBe('moderate');
    });

    it('returns "high" for scores 50-69', () => {
      expect(getBurnoutRiskLevel(50)).toBe('high');
      expect(getBurnoutRiskLevel(60)).toBe('high');
      expect(getBurnoutRiskLevel(69)).toBe('high');
    });

    it('returns "critical" for scores 70-100', () => {
      expect(getBurnoutRiskLevel(70)).toBe('critical');
      expect(getBurnoutRiskLevel(85)).toBe('critical');
      expect(getBurnoutRiskLevel(100)).toBe('critical');
    });

    it('matches BURNOUT_THRESHOLDS constants', () => {
      expect(BURNOUT_THRESHOLDS.low.max).toBe(29);
      expect(BURNOUT_THRESHOLDS.moderate.min).toBe(30);
      expect(BURNOUT_THRESHOLDS.moderate.max).toBe(49);
      expect(BURNOUT_THRESHOLDS.high.min).toBe(50);
      expect(BURNOUT_THRESHOLDS.high.max).toBe(69);
      expect(BURNOUT_THRESHOLDS.critical.min).toBe(70);
    });

    // CRITICAL: Boundary tests — these are the most dangerous misclassifications
    it('does NOT classify 29 as moderate (boundary between low and moderate)', () => {
      expect(getBurnoutRiskLevel(29)).not.toBe('moderate');
    });

    it('does NOT classify 49 as high (boundary between moderate and high)', () => {
      expect(getBurnoutRiskLevel(49)).not.toBe('high');
    });

    it('does NOT classify 69 as critical (boundary between high and critical)', () => {
      expect(getBurnoutRiskLevel(69)).not.toBe('critical');
    });
  });
});

// ============================================================================
// PART 2: COMPONENT RENDERING TESTS
// ============================================================================

describe('BurnoutAssessmentForm', () => {
  const defaultProps = {
    onSuccess: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockSubmit.mockResolvedValue({ success: true, data: {}, error: null } as never);
  });

  describe('Instructions Screen', () => {
    it('shows instructions screen first, not the questions', () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      expect(screen.getByText(/Maslach Burnout Inventory/i)).toBeInTheDocument();
      expect(screen.getByText('Start Assessment')).toBeInTheDocument();
    });

    it('displays 988 crisis support information', () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      expect(screen.getByText(/988/)).toBeInTheDocument();
      expect(screen.getByText(/Suicide & Crisis Lifeline/i)).toBeInTheDocument();
    });

    it('shows estimated time (5-7 minutes, 22 questions)', () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      expect(screen.getByText(/5-7 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/22 questions/)).toBeInTheDocument();
    });

    it('navigates to questions when Start Assessment is clicked', async () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
      expect(await screen.findByText('Burnout Assessment')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it('calls onClose when Cancel is clicked', () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Question Navigation', () => {
    const startAssessment = () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
    };

    it('shows first page with 5 questions', async () => {
      startAssessment();
      // First question should be visible
      expect(await screen.findByText(/emotionally drained/i)).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    });

    it('shows progress counter (0 / 22 initially)', async () => {
      startAssessment();
      expect(await screen.findByText('0 / 22 questions answered')).toBeInTheDocument();
    });

    it('disables Previous button on first page', async () => {
      startAssessment();
      const prevButton = await screen.findByText('← Previous');
      expect(prevButton).toBeDisabled();
    });

    it('disables Next button until all current page questions are answered', async () => {
      startAssessment();
      const nextButton = await screen.findByText('Next →');
      expect(nextButton).toBeDisabled();
    });

    it('enables Next button after answering all questions on current page', async () => {
      startAssessment();
      await screen.findByText(/emotionally drained/i);

      // Answer all 5 questions on page 1 by clicking "Never" for each
      const neverOptions = screen.getAllByText('Never');
      neverOptions.forEach((option) => {
        fireEvent.click(option);
      });

      const nextButton = screen.getByText('Next →');
      expect(nextButton).not.toBeDisabled();
    });

    it('updates progress counter when questions are answered', async () => {
      startAssessment();
      await screen.findByText(/emotionally drained/i);

      // Answer first question
      const neverOptions = screen.getAllByText('Never');
      fireEvent.click(neverOptions[0]);

      expect(screen.getByText('1 / 22 questions answered')).toBeInTheDocument();
    });

    it('shows warning when page is incomplete', async () => {
      startAssessment();
      await screen.findByText(/emotionally drained/i);
      expect(screen.getByText(/Please answer all questions on this page/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    // Helper to fill all 22 questions and navigate to the last page
    const fillAllQuestions = async () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
      await screen.findByText(/emotionally drained/i);

      // There are 22 questions across 5 pages (5 per page, last page has 2)
      // Fill all pages
      for (let page = 0; page < 5; page++) {
        // Answer all questions on current page with "Never" (value 0)
        const neverOptions = screen.getAllByText('Never');
        neverOptions.forEach((option) => {
          fireEvent.click(option);
        });

        if (page < 4) {
          // Navigate to next page
          const nextButton = screen.getByText('Next →');
          fireEvent.click(nextButton);
          // Wait for new page to render
          await screen.findByText(`Page ${page + 2} of 5`);
        }
      }
    };

    it('shows Submit button on the last page', async () => {
      await fillAllQuestions();
      expect(screen.getByText('Submit Assessment')).toBeInTheDocument();
    });

    it('calls submitBurnoutAssessment with calculated scores on submit', async () => {
      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSubmit.mock.calls[0][0];

      // All "Never" (0) answers:
      // EE: 0/54 = 0%, DP: 0/30 = 0%, PA: 100 - 0/48 = 100%
      expect(callArgs.emotional_exhaustion_score).toBe(0);
      expect(callArgs.depersonalization_score).toBe(0);
      expect(callArgs.personal_accomplishment_score).toBe(100);
      expect(callArgs.assessment_type).toBe('MBI-HSS');
    });

    it('includes all 22 questionnaire responses in submission', async () => {
      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockSubmit.mock.calls[0][0];
      expect(callArgs.questionnaire_responses).toHaveLength(22);

      // Each response should have question, score, and dimension
      for (const response of callArgs.questionnaire_responses ?? []) {
        expect(response).toHaveProperty('question');
        expect(response).toHaveProperty('score');
        expect(response).toHaveProperty('dimension');
        expect(['emotional_exhaustion', 'depersonalization', 'personal_accomplishment']).toContain(
          response.dimension
        );
      }
    });

    it('calls onSuccess after successful submission', async () => {
      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error message when submission returns failure', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'DATABASE_ERROR', message: 'Database connection failed' },
      } as never);

      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      expect(await screen.findByText('Database connection failed')).toBeInTheDocument();
    });

    it('shows specific error from ServiceResult', async () => {
      mockSubmit.mockResolvedValueOnce({
        success: false, data: null,
        error: { code: 'NOT_FOUND', message: 'Practitioner record not found' },
      } as never);

      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      expect(await screen.findByText('Practitioner record not found')).toBeInTheDocument();
    });

    it('disables submit button while loading', async () => {
      mockSubmit.mockImplementation(() => new Promise(() => {})); // Never resolves

      await fillAllQuestions();

      fireEvent.click(screen.getByText('Submit Assessment'));

      await waitFor(() => {
        expect(screen.getByText('Submitting...')).toBeInTheDocument();
      });
    });
  });

  describe('Scoring Accuracy (Component Integration)', () => {
    // Helper to fill specific scores and submit
    const fillWithScores = async (eeScore: number, dpScore: number, paScore: number) => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
      await screen.findByText(/emotionally drained/i);

      // Map score to frequency option index (0-6)
      const getFrequencyLabel = (value: number) => {
        const labels = [
          'Never',
          'A few times a year or less',
          'Once a month or less',
          'A few times a month',
          'Once a week',
          'A few times a week',
          'Every day',
        ];
        return labels[value];
      };

      // Fill each page
      for (let page = 0; page < 5; page++) {
        const questionsOnPage = screen.getAllByText(/^\d+\./);

        for (let q = 0; q < questionsOnPage.length; q++) {
          const globalIndex = page * 5 + q;
          let targetValue: number;

          if (globalIndex < 9) {
            // EE questions (0-8)
            targetValue = eeScore;
          } else if (globalIndex < 14) {
            // DP questions (9-13)
            targetValue = dpScore;
          } else {
            // PA questions (14-21)
            targetValue = paScore;
          }

          // Find the radio for this question with the target value
          const label = getFrequencyLabel(targetValue);
          const questionBlock = questionsOnPage[q].closest('.bg-gray-50');
          if (questionBlock) {
            const targetLabel = Array.from(questionBlock.querySelectorAll('label')).find(
              (l) => l.textContent?.includes(label)
            );
            if (targetLabel) {
              fireEvent.click(targetLabel);
            }
          }
        }

        if (page < 4) {
          fireEvent.click(screen.getByText('Next →'));
          await screen.findByText(`Page ${page + 2} of 5`);
        }
      }

      fireEvent.click(screen.getByText('Submit Assessment'));
      await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
    };

    it('calculates maximum burnout correctly (all 6s for EE/DP, all 0s for PA)', async () => {
      await fillWithScores(6, 6, 0);

      const callArgs = mockSubmit.mock.calls[0][0];
      // EE: 54/54 = 100, DP: 30/30 = 100, PA: 100 - 0/48 = 100
      expect(callArgs.emotional_exhaustion_score).toBe(100);
      expect(callArgs.depersonalization_score).toBe(100);
      expect(callArgs.personal_accomplishment_score).toBe(100);
    });

    it('calculates minimum burnout correctly (all 0s for EE/DP, all 6s for PA)', async () => {
      await fillWithScores(0, 0, 6);

      const callArgs = mockSubmit.mock.calls[0][0];
      // EE: 0, DP: 0, PA: 100 - 48/48*100 = 0
      expect(callArgs.emotional_exhaustion_score).toBe(0);
      expect(callArgs.depersonalization_score).toBe(0);
      expect(callArgs.personal_accomplishment_score).toBe(0);
    });

    it('calculates mid-range burnout correctly (all 3s)', async () => {
      await fillWithScores(3, 3, 3);

      const callArgs = mockSubmit.mock.calls[0][0];
      // EE: 27/54 = 50, DP: 15/30 = 50, PA: 100 - 24/48*100 = 50
      expect(callArgs.emotional_exhaustion_score).toBe(50);
      expect(callArgs.depersonalization_score).toBe(50);
      expect(callArgs.personal_accomplishment_score).toBe(50);
    });
  });

  describe('Form Validation', () => {
    it('shows error when trying to submit incomplete form', async () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
      await screen.findByText(/emotionally drained/i);

      // The submit button should not be visible on page 1 (only on last page)
      expect(screen.queryByText('Submit Assessment')).not.toBeInTheDocument();
    });

    it('allows going back to previous page and changing answers', async () => {
      render(<BurnoutAssessmentForm {...defaultProps} />);
      fireEvent.click(screen.getByText('Start Assessment'));
      await screen.findByText(/emotionally drained/i);

      // Answer all page 1 questions
      const neverOptions = screen.getAllByText('Never');
      neverOptions.forEach((option) => fireEvent.click(option));

      // Go to page 2
      fireEvent.click(screen.getByText('Next →'));
      await screen.findByText('Page 2 of 5');

      // Go back to page 1
      fireEvent.click(screen.getByText('← Previous'));
      await screen.findByText('Page 1 of 5');

      // First question should still be visible
      expect(screen.getByText(/emotionally drained/i)).toBeInTheDocument();
    });
  });
});
