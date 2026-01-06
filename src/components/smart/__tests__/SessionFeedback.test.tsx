/**
 * SessionFeedback.test.tsx - Tests for SessionFeedback component
 *
 * Purpose: Verify feedback UI, submission flow, and issue selection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionFeedback } from '../SessionFeedback';

describe('SessionFeedback', () => {
  const mockOnSubmit = vi.fn();
  const mockOnSkip = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when isVisible is false', () => {
      render(
        <SessionFeedback
          isVisible={false}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.queryByText(/how was the transcription/i)).not.toBeInTheDocument();
    });

    it('should render when isVisible is true', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText(/how was the transcription quality/i)).toBeInTheDocument();
    });
  });

  describe('Initial Feedback Prompt', () => {
    it('should show thumbs up button', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByRole('button', { name: /good transcription quality/i })).toBeInTheDocument();
      expect(screen.getByText('Good!')).toBeInTheDocument();
    });

    it('should show thumbs down button', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByRole('button', { name: /poor transcription quality/i })).toBeInTheDocument();
      expect(screen.getByText('Needs work')).toBeInTheDocument();
    });

    it('should show skip button', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByText(/skip feedback/i)).toBeInTheDocument();
    });
  });

  describe('Positive Feedback Flow', () => {
    it('should call onSubmit with positive rating when thumbs up clicked', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      const thumbsUpButton = screen.getByRole('button', { name: /good transcription quality/i });
      fireEvent.click(thumbsUpButton);

      expect(mockOnSubmit).toHaveBeenCalledWith({ rating: 'positive' });
    });
  });

  describe('Negative Feedback Flow', () => {
    it('should show issue selector when thumbs down clicked', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      expect(screen.getByText(/what was the issue/i)).toBeInTheDocument();
    });

    it('should show all issue options after negative feedback', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      expect(screen.getByText('Missed words')).toBeInTheDocument();
      expect(screen.getByText('Wrong medical terms')).toBeInTheDocument();
      expect(screen.getByText('Accent not recognized')).toBeInTheDocument();
      expect(screen.getByText('Background noise issues')).toBeInTheDocument();
    });

    it('should allow selecting multiple issues', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      // Select issues
      const missedWordsButton = screen.getByText('Missed words');
      const accentButton = screen.getByText('Accent not recognized');

      fireEvent.click(missedWordsButton);
      fireEvent.click(accentButton);

      // Both should be selected (have the red border class)
      expect(missedWordsButton.closest('button')).toHaveClass('border-red-500');
      expect(accentButton.closest('button')).toHaveClass('border-red-500');
    });

    it('should toggle issue selection when clicked twice', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      // Select and deselect
      const missedWordsButton = screen.getByText('Missed words');
      fireEvent.click(missedWordsButton);
      expect(missedWordsButton.closest('button')).toHaveClass('border-red-500');

      fireEvent.click(missedWordsButton);
      expect(missedWordsButton.closest('button')).not.toHaveClass('border-red-500');
    });

    it('should submit with selected issues', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      // Select issues
      fireEvent.click(screen.getByText('Missed words'));
      fireEvent.click(screen.getByText('Wrong medical terms'));

      // Submit
      fireEvent.click(screen.getByText('Submit Feedback'));

      expect(mockOnSubmit).toHaveBeenCalledWith({
        rating: 'negative',
        issues: ['missed_words', 'wrong_medical_terms'],
      });
    });

    it('should submit without issues if none selected', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      // Submit without selecting issues
      fireEvent.click(screen.getByText('Submit Feedback'));

      expect(mockOnSubmit).toHaveBeenCalledWith({
        rating: 'negative',
        issues: undefined,
      });
    });
  });

  describe('Skip Functionality', () => {
    it('should call onSkip when skip button clicked from initial prompt', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      fireEvent.click(screen.getByText(/skip feedback/i));

      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('should call onSkip when skip button clicked from issue selector', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      // Click skip
      fireEvent.click(screen.getByText('Skip'));

      expect(mockOnSkip).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible buttons with aria-labels', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      expect(screen.getByLabelText(/good transcription quality/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/poor transcription quality/i)).toBeInTheDocument();
    });

    it('should have minimum touch target size of 44px for feedback buttons', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      const thumbsUpButton = screen.getByRole('button', { name: /good transcription quality/i });
      expect(thumbsUpButton).toHaveClass('min-h-[80px]');
      expect(thumbsUpButton).toHaveClass('min-w-[80px]');
    });

    it('should have minimum touch target size for issue buttons', () => {
      render(
        <SessionFeedback
          isVisible={true}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
        />
      );

      // Go to issue selector
      const thumbsDownButton = screen.getByRole('button', { name: /poor transcription quality/i });
      fireEvent.click(thumbsDownButton);

      const issueButton = screen.getByText('Missed words').closest('button');
      expect(issueButton).toHaveClass('min-h-[44px]');
    });
  });
});
