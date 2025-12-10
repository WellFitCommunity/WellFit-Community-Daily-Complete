/**
 * AIFeedbackButton Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AIFeedbackButton } from '../AIFeedbackButton';

// Mock Supabase
jest.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    rpc: jest.fn(() => Promise.resolve({ error: { code: 'PGRST202' } })),
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock useUser
jest.mock('../../../contexts/AuthContext', () => ({
  useUser: () => ({ id: 'test-user-123', email: 'test@example.com' }),
}));

// Mock auditLogger
jest.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('AIFeedbackButton', () => {
  const defaultProps = {
    predictionId: 'test-prediction-123',
    skillName: 'test_skill',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders three feedback buttons', () => {
      render(<AIFeedbackButton {...defaultProps} />);

      expect(screen.getByTitle(/helpful/i)).toBeInTheDocument();
      expect(screen.getByTitle(/incorrect/i)).toBeInTheDocument();
      expect(screen.getByTitle(/safety concern/i)).toBeInTheDocument();
    });

    it('renders inline variant by default', () => {
      const { container } = render(<AIFeedbackButton {...defaultProps} />);
      expect(container.querySelector('.inline-flex')).toBeInTheDocument();
    });

    it('renders minimal variant when specified', () => {
      render(<AIFeedbackButton {...defaultProps} variant="minimal" />);
      expect(screen.getByTitle(/helpful/i)).toBeInTheDocument();
    });

    it('renders stacked variant when specified', () => {
      const { container } = render(<AIFeedbackButton {...defaultProps} variant="stacked" />);
      expect(container.querySelector('.flex-col')).toBeInTheDocument();
    });

    it('shows labels when showLabels is true', () => {
      render(<AIFeedbackButton {...defaultProps} showLabels={true} />);
      expect(screen.getByText(/rate ai/i)).toBeInTheDocument();
    });
  });

  describe('Feedback Submission', () => {
    it('shows notes modal when helpful is clicked and allowNotes is true', async () => {
      render(<AIFeedbackButton {...defaultProps} allowNotes={true} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        expect(screen.getByText(/what made this helpful/i)).toBeInTheDocument();
      });
    });

    it('submits feedback directly when allowNotes is false', async () => {
      render(<AIFeedbackButton {...defaultProps} allowNotes={false} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        expect(screen.getByText(/marked helpful/i)).toBeInTheDocument();
      });
    });

    it('always shows modal for unsafe feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} allowNotes={false} />);

      const unsafeButton = screen.getByTitle(/safety concern/i);
      fireEvent.click(unsafeButton);

      await waitFor(() => {
        expect(screen.getByText(/describe the safety concern/i)).toBeInTheDocument();
      });
    });

    it('requires notes for unsafe feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} />);

      const unsafeButton = screen.getByTitle(/safety concern/i);
      fireEvent.click(unsafeButton);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /submit/i });
        expect(submitButton).toBeDisabled();
      });
    });

    it('calls onFeedbackSubmitted callback after submission', async () => {
      const onFeedbackSubmitted = jest.fn();

      render(
        <AIFeedbackButton
          {...defaultProps}
          allowNotes={false}
          onFeedbackSubmitted={onFeedbackSubmitted}
        />
      );

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        expect(onFeedbackSubmitted).toHaveBeenCalledWith('helpful', undefined);
      });
    });
  });

  describe('Notes Modal', () => {
    it('allows typing notes', async () => {
      render(<AIFeedbackButton {...defaultProps} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/optional/i);
        fireEvent.change(textarea, { target: { value: 'This was very helpful' } });
        expect(textarea).toHaveValue('This was very helpful');
      });
    });

    it('allows skipping notes for non-unsafe feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        const skipButton = screen.getByRole('button', { name: /skip/i });
        expect(skipButton).toBeInTheDocument();
      });
    });

    it('does not show skip button for unsafe feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} />);

      const unsafeButton = screen.getByTitle(/safety concern/i);
      fireEvent.click(unsafeButton);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Submitted State', () => {
    it('shows confirmation after helpful feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} allowNotes={false} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      await waitFor(() => {
        expect(screen.getByText(/marked helpful/i)).toBeInTheDocument();
      });
    });

    it('shows confirmation after wrong feedback', async () => {
      render(<AIFeedbackButton {...defaultProps} allowNotes={false} />);

      const wrongButton = screen.getByTitle(/incorrect/i);
      fireEvent.click(wrongButton);

      await waitFor(() => {
        expect(screen.getByText(/marked incorrect/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('disables buttons when disabled prop is true', () => {
      render(<AIFeedbackButton {...defaultProps} disabled={true} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      expect(helpfulButton).toBeDisabled();
    });

    it('does not respond to clicks when disabled', () => {
      render(<AIFeedbackButton {...defaultProps} disabled={true} />);

      const helpfulButton = screen.getByTitle(/helpful/i);
      fireEvent.click(helpfulButton);

      expect(screen.queryByText(/what made this helpful/i)).not.toBeInTheDocument();
    });
  });
});
