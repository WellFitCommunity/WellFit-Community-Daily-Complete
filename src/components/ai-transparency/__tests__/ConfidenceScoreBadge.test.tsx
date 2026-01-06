/**
 * ConfidenceScoreBadge Tests
 *
 * Tests for AI confidence score display component:
 * - Score level calculations (high/medium/low)
 * - Badge and detailed variants
 * - Validation button interactions
 * - Explanation tooltip display
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfidenceScoreBadge } from '../ConfidenceScoreBadge';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

describe('ConfidenceScoreBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Score Level Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Score Level Display', () => {
    it('should display high confidence for score >= 90', () => {
      render(<ConfidenceScoreBadge score={95} />);

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('should display medium confidence for score 75-89', () => {
      render(<ConfidenceScoreBadge score={80} />);

      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should display low confidence for score < 75', () => {
      render(<ConfidenceScoreBadge score={50} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('should display correct icon for high confidence', () => {
      render(<ConfidenceScoreBadge score={92} />);
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should display correct icon for medium confidence', () => {
      render(<ConfidenceScoreBadge score={78} />);
      expect(screen.getByText('⚠')).toBeInTheDocument();
    });

    it('should display correct icon for low confidence', () => {
      render(<ConfidenceScoreBadge score={45} />);
      expect(screen.getByText('!')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Suggestion Type Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Suggestion Type Labels', () => {
    it('should display Billing for billing_code type', () => {
      render(<ConfidenceScoreBadge score={85} suggestionType="billing_code" />);
      expect(screen.getByText('Billing')).toBeInTheDocument();
    });

    it('should display Clinical for clinical type', () => {
      render(<ConfidenceScoreBadge score={85} suggestionType="clinical" />);
      expect(screen.getByText('Clinical')).toBeInTheDocument();
    });

    it('should display Drug for drug_interaction type', () => {
      render(<ConfidenceScoreBadge score={85} suggestionType="drug_interaction" />);
      expect(screen.getByText('Drug')).toBeInTheDocument();
    });

    it('should display Risk for risk_assessment type', () => {
      render(<ConfidenceScoreBadge score={85} suggestionType="risk_assessment" />);
      expect(screen.getByText('Risk')).toBeInTheDocument();
    });

    it('should default to Clinical when no type specified', () => {
      render(<ConfidenceScoreBadge score={85} />);
      expect(screen.getByText('Clinical')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Badge Variant Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Badge Variant', () => {
    it('should render badge variant by default', () => {
      render(<ConfidenceScoreBadge score={85} />);

      // Badge variant should show inline content
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should show explain button when explanation provided', () => {
      render(
        <ConfidenceScoreBadge
          score={85}
          explanation="Based on ICD-10 coding guidelines"
        />
      );

      expect(screen.getByText('Explain')).toBeInTheDocument();
    });

    it('should toggle explanation on badge click', async () => {
      render(
        <ConfidenceScoreBadge
          score={85}
          explanation="Test explanation text"
        />
      );

      // Click to show explanation
      const badge = screen.getByText('85%').closest('div');
      if (badge) {
        fireEvent.click(badge);
      }

      await waitFor(() => {
        expect(screen.getByText('AI Reasoning')).toBeInTheDocument();
        expect(screen.getByText('Test explanation text')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Detailed Variant Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Detailed Variant', () => {
    it('should render detailed variant when specified', () => {
      render(<ConfidenceScoreBadge score={85} variant="detailed" />);

      // Detailed variant should show "AI Suggestion Confidence"
      expect(screen.getByText('AI Suggestion Confidence')).toBeInTheDocument();
    });

    it('should show progress bar labels in detailed variant', () => {
      render(<ConfidenceScoreBadge score={85} variant="detailed" />);

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Low (0-74%)')).toBeInTheDocument();
      expect(screen.getByText('Medium (75-89%)')).toBeInTheDocument();
      expect(screen.getByText('High (90-100%)')).toBeInTheDocument();
    });

    it('should show explanation in detailed variant', () => {
      render(
        <ConfidenceScoreBadge
          score={85}
          variant="detailed"
          explanation="Based on clinical guidelines"
        />
      );

      expect(screen.getByText('AI Reasoning:')).toBeInTheDocument();
      expect(screen.getByText('Based on clinical guidelines')).toBeInTheDocument();
    });

    it('should show review recommendation for medium confidence', () => {
      render(<ConfidenceScoreBadge score={80} variant="detailed" />);

      expect(screen.getByText(/Review Recommended/)).toBeInTheDocument();
    });

    it('should show manual review warning for low confidence', () => {
      render(<ConfidenceScoreBadge score={60} variant="detailed" />);

      expect(screen.getByText(/Manual Review Required/)).toBeInTheDocument();
    });

    it('should not show warning for high confidence', () => {
      render(<ConfidenceScoreBadge score={95} variant="detailed" />);

      expect(screen.queryByText(/Review Recommended/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Manual Review Required/)).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Validation Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Validation Actions', () => {
    it('should show validation buttons for non-high confidence with onValidate', () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} onValidate={onValidate} />);

      expect(screen.getByTitle('Accept suggestion')).toBeInTheDocument();
      expect(screen.getByTitle('Reject suggestion')).toBeInTheDocument();
    });

    it('should NOT show validation buttons for high confidence', () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={95} onValidate={onValidate} />);

      expect(screen.queryByTitle('Accept suggestion')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Reject suggestion')).not.toBeInTheDocument();
    });

    it('should call onValidate with true when accepted', async () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} onValidate={onValidate} />);

      fireEvent.click(screen.getByTitle('Accept suggestion'));

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalledWith(true);
      });
    });

    it('should call onValidate with false when rejected', async () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} onValidate={onValidate} />);

      fireEvent.click(screen.getByTitle('Reject suggestion'));

      await waitFor(() => {
        expect(onValidate).toHaveBeenCalledWith(false);
      });
    });

    it('should show Accepted status after accepting', async () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} onValidate={onValidate} />);

      fireEvent.click(screen.getByTitle('Accept suggestion'));

      await waitFor(() => {
        expect(screen.getByText('Accepted')).toBeInTheDocument();
      });
    });

    it('should show Rejected status after rejecting', async () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} onValidate={onValidate} />);

      fireEvent.click(screen.getByTitle('Reject suggestion'));

      await waitFor(() => {
        expect(screen.getByText('Rejected')).toBeInTheDocument();
      });
    });

    it('should hide validation buttons after validation in detailed variant', async () => {
      const onValidate = vi.fn();
      render(<ConfidenceScoreBadge score={70} variant="detailed" onValidate={onValidate} />);

      fireEvent.click(screen.getByText(/Accept Suggestion/));

      await waitFor(() => {
        expect(screen.queryByText(/Accept Suggestion/)).not.toBeInTheDocument();
        expect(screen.getByText('✓ Suggestion Accepted')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Supporting Evidence Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Supporting Evidence', () => {
    it('should display supporting evidence in detailed variant', () => {
      render(
        <ConfidenceScoreBadge
          score={85}
          variant="detailed"
          supportingEvidence={{
            'ICD Code': 'J18.9',
            'Confidence': '87%',
          }}
        />
      );

      expect(screen.getByText('Supporting Evidence:')).toBeInTheDocument();
      expect(screen.getByText(/ICD Code/)).toBeInTheDocument();
    });

    it('should not display evidence section when empty', () => {
      render(
        <ConfidenceScoreBadge
          score={85}
          variant="detailed"
          supportingEvidence={{}}
        />
      );

      expect(screen.queryByText('Supporting Evidence:')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle score of exactly 90 as high', () => {
      render(<ConfidenceScoreBadge score={90} />);
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('should handle score of exactly 75 as medium', () => {
      render(<ConfidenceScoreBadge score={75} />);
      expect(screen.getByText('medium')).toBeInTheDocument();
    });

    it('should handle score of 0', () => {
      render(<ConfidenceScoreBadge score={0} />);
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('should handle score of 100', () => {
      render(<ConfidenceScoreBadge score={100} />);
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('should handle score of exactly 74 as low', () => {
      render(<ConfidenceScoreBadge score={74} />);
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('should handle score of exactly 89 as medium', () => {
      render(<ConfidenceScoreBadge score={89} />);
      expect(screen.getByText('medium')).toBeInTheDocument();
    });
  });
});
