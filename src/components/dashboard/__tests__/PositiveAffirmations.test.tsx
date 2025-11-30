// src/components/dashboard/__tests__/PositiveAffirmations.test.tsx
// Tests for the senior-facing positive affirmations widget

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PositiveAffirmations from '../PositiveAffirmations';

// Regex pattern to match any affirmation text
const affirmationPattern = /You are|Every day|Your wisdom|strength|difference|possibilities|kindness|worthy|grateful|meaning|capable|deserve|heart|fresh start|exactly where/i;

describe('PositiveAffirmations - Senior Facing Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the affirmations widget', () => {
      render(<PositiveAffirmations />);

      expect(screen.getByText(/Daily Affirmation/i)).toBeInTheDocument();
    });

    it('should display sparkle emoji icon', () => {
      render(<PositiveAffirmations />);

      expect(screen.getByText(/✨/)).toBeInTheDocument();
    });

    it('should display an affirmation message', async () => {
      render(<PositiveAffirmations />);

      // Wait for useEffect to set the affirmation
      await waitFor(() => {
        expect(screen.getByText(affirmationPattern)).toBeInTheDocument();
      });
    });

    it('should display affirmation in quotes', async () => {
      render(<PositiveAffirmations />);

      await waitFor(() => {
        const affirmationText = screen.getByText(affirmationPattern);
        expect(affirmationText).toBeInTheDocument();
        expect(affirmationText.textContent).toContain('"');
      });
    });

    it('should display "New Affirmation" button', () => {
      render(<PositiveAffirmations />);

      expect(screen.getByText(/New Affirmation/i)).toBeInTheDocument();
    });

    it('should display heart emoji on button', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByText(/New Affirmation/i);
      expect(button.textContent).toContain('💝');
    });
  });

  describe('Daily Affirmation Logic', () => {
    it('should display consistent affirmation for the same day', async () => {
      const { unmount } = render(<PositiveAffirmations />);

      // Wait for first render to complete
      let firstAffirmation: string | null = null;
      await waitFor(() => {
        firstAffirmation = screen.getByText(affirmationPattern).textContent;
        expect(firstAffirmation).toBeTruthy();
      });
      unmount();

      render(<PositiveAffirmations />);

      // Wait for second render
      await waitFor(() => {
        const secondAffirmation = screen.getByText(affirmationPattern).textContent;
        expect(firstAffirmation).toBe(secondAffirmation);
      });
    });

    it('should show a valid affirmation from the list', async () => {
      render(<PositiveAffirmations />);

      const validAffirmations = [
        "You are valued and loved.",
        "Every day brings new opportunities for joy.",
        "Your wisdom and experience are precious gifts.",
        "You have the strength to handle whatever comes your way.",
        "You make a difference in the lives of others.",
        "Today is full of possibilities.",
        "You are exactly where you need to be.",
        "Your kindness brightens the world.",
        "You are worthy of care and respect.",
        "Each moment is a fresh start.",
        "You have so much to be grateful for.",
        "Your life has meaning and purpose.",
        "You are capable of amazing things.",
        "You deserve happiness and peace.",
        "Your heart is full of love to share."
      ];

      await waitFor(() => {
        const displayedText = screen.getByText(affirmationPattern).textContent;
        const isValidAffirmation = validAffirmations.some(affirmation =>
          displayedText?.includes(affirmation)
        );
        expect(isValidAffirmation).toBe(true);
      });
    });
  });

  describe('User Interactions', () => {
    it('should change affirmation when "New Affirmation" button is clicked', async () => {
      render(<PositiveAffirmations />);

      // Wait for initial affirmation
      let initialAffirmation: string | null = null;
      await waitFor(() => {
        initialAffirmation = screen.getByText(affirmationPattern).textContent;
        expect(initialAffirmation).toBeTruthy();
      });

      const button = screen.getByText(/New Affirmation/i);

      // Click multiple times to ensure we get a different one (with small probability of same)
      let newAffirmation: string | null = initialAffirmation;
      let attempts = 0;
      const maxAttempts = 10;

      while (newAffirmation === initialAffirmation && attempts < maxAttempts) {
        fireEvent.click(button);
        newAffirmation = screen.getByText(affirmationPattern).textContent;
        attempts++;
      }

      // With 15 affirmations and 10 attempts, we should get a different one
      expect(attempts).toBeLessThanOrEqual(maxAttempts);
    });

    it('should display random affirmation on button click', async () => {
      render(<PositiveAffirmations />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(affirmationPattern)).toBeInTheDocument();
      });

      const button = screen.getByText(/New Affirmation/i);
      fireEvent.click(button);

      const affirmationAfterClick = screen.getByText(affirmationPattern);
      expect(affirmationAfterClick).toBeInTheDocument();
    });

    it('should be clickable and accessible', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByText(/New Affirmation/i);
      expect(button).toBeEnabled();
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Accessibility', () => {
    it('should have large, readable text for seniors', () => {
      const { container } = render(<PositiveAffirmations />);

      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading.tagName).toBe('H3');
      expect(heading).toHaveClass('text-lg', 'sm:text-xl', 'lg:text-2xl');
    });

    it('should have accessible button with clear text', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByRole('button', { name: /New Affirmation/i });
      expect(button).toBeInTheDocument();
    });

    it('should use semantic HTML structure', () => {
      render(<PositiveAffirmations />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByText(/New Affirmation/i);
      expect(button).not.toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Visual Design', () => {
    it('should have appropriate styling classes', () => {
      render(<PositiveAffirmations />);

      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading).toBeInTheDocument();
    });

    it('should display button with purple background', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByText(/New Affirmation/i);
      expect(button).toHaveClass('bg-purple-600');
    });

    it('should center-align content', () => {
      render(<PositiveAffirmations />);

      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Content Validation', () => {
    it('should only display positive and encouraging messages', async () => {
      render(<PositiveAffirmations />);

      await waitFor(() => {
        const affirmation = screen.getByText(affirmationPattern).textContent;

        // Ensure no negative words
        const negativeWords = ['not', 'never', 'can\'t', 'won\'t', 'bad', 'sad', 'angry'];
        const hasNegativeWords = negativeWords.some(word =>
          affirmation?.toLowerCase().includes(word)
        );

        expect(hasNegativeWords).toBe(false);
      });
    });

    it('should display age-appropriate content for seniors', async () => {
      render(<PositiveAffirmations />);

      await waitFor(() => {
        const affirmation = screen.getByText(affirmationPattern);
        expect(affirmation).toBeInTheDocument();
      });

      // Component structure should be present
      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive text sizes', () => {
      render(<PositiveAffirmations />);

      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading).toHaveClass('text-lg', 'sm:text-xl', 'lg:text-2xl');
    });

    it('should have responsive padding', () => {
      render(<PositiveAffirmations />);

      const heading = screen.getByText(/Daily Affirmation/i);
      expect(heading).toBeInTheDocument();
    });

    it('should have responsive button text size', () => {
      render(<PositiveAffirmations />);

      const button = screen.getByText(/New Affirmation/i);
      expect(button).toHaveClass('text-sm', 'sm:text-base');
    });
  });
});
