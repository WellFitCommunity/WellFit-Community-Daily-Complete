/**
 * ErrorDisplay.test.tsx - Tests for error display components
 *
 * Purpose: Verify error message rendering, severity styles, actions, and accessibility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay, InlineError } from '../ErrorDisplay';

// Mock the error messages utility
vi.mock('../../../utils/errorMessages', () => ({
  getErrorDetails: vi.fn((error: unknown) => {
    if (error instanceof Error) {
      if (error.message.includes('network')) {
        return {
          title: 'Network Error',
          message: 'Unable to connect to the server',
          severity: 'error' as const,
          actions: ['Check your internet connection', 'Try again later'],
          technicalDetails: error.message,
        };
      }
      if (error.message.includes('warning')) {
        return {
          title: 'Warning',
          message: 'Something needs your attention',
          severity: 'warning' as const,
          actions: ['Review the issue'],
          technicalDetails: error.message,
        };
      }
    }
    return {
      title: 'Error',
      message: typeof error === 'string' ? error : 'Something went wrong',
      severity: 'error' as const,
      actions: [],
      technicalDetails: String(error),
    };
  }),
}));

describe('ErrorDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render error with title and message', () => {
      render(<ErrorDisplay error={new Error('network error')} />);

      expect(screen.getByText('Network Error')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to the server')).toBeInTheDocument();
    });

    it('should render with role="alert"', () => {
      render(<ErrorDisplay error="Test error" />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ErrorDisplay error="Test" className="custom-class" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });

    it('should render actions when provided', () => {
      render(<ErrorDisplay error={new Error('network error')} />);

      expect(screen.getByText('What you can do:')).toBeInTheDocument();
      expect(screen.getByText('Check your internet connection')).toBeInTheDocument();
      expect(screen.getByText('Try again later')).toBeInTheDocument();
    });
  });

  describe('Severity Styles', () => {
    it('should apply error styles for error severity', () => {
      render(<ErrorDisplay error={new Error('network error')} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-red-50');
      expect(alert).toHaveClass('border-red-200');
    });

    it('should apply warning styles for warning severity', () => {
      render(<ErrorDisplay error={new Error('warning message')} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('bg-yellow-50');
      expect(alert).toHaveClass('border-yellow-200');
    });
  });

  describe('Action Buttons', () => {
    it('should render Try Again button when onRetry is provided', () => {
      const onRetry = vi.fn();
      render(<ErrorDisplay error="Error" onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /Try Again/i });
      expect(retryButton).toBeInTheDocument();
    });

    it('should call onRetry when Try Again is clicked', () => {
      const onRetry = vi.fn();
      render(<ErrorDisplay error="Error" onRetry={onRetry} />);

      fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should render Dismiss button when onDismiss is provided', () => {
      const onDismiss = vi.fn();
      render(<ErrorDisplay error="Error" onDismiss={onDismiss} />);

      const dismissButton = screen.getByRole('button', { name: /Dismiss/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it('should call onDismiss when Dismiss is clicked', () => {
      const onDismiss = vi.fn();
      render(<ErrorDisplay error="Error" onDismiss={onDismiss} />);

      fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not render buttons when callbacks are not provided', () => {
      render(<ErrorDisplay error="Error" />);

      expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Dismiss/i })).not.toBeInTheDocument();
    });
  });

  describe('Technical Details', () => {
    it('should show technical details toggle when enabled', () => {
      render(<ErrorDisplay error={new Error('network error')} showTechnicalDetails />);

      const toggle = screen.getByRole('button', { name: /Show technical details/i });
      expect(toggle).toBeInTheDocument();
    });

    it('should toggle technical details visibility', () => {
      render(<ErrorDisplay error={new Error('network error')} showTechnicalDetails />);

      // Initially hidden
      expect(screen.queryByText('network error')).not.toBeInTheDocument();

      // Show details
      fireEvent.click(screen.getByRole('button', { name: /Show technical details/i }));
      expect(screen.getByText('network error')).toBeInTheDocument();

      // Hide details
      fireEvent.click(screen.getByRole('button', { name: /Hide technical details/i }));
      expect(screen.queryByText('network error')).not.toBeInTheDocument();
    });

    it('should not show toggle when showTechnicalDetails is false', () => {
      render(<ErrorDisplay error={new Error('network error')} showTechnicalDetails={false} />);

      expect(screen.queryByRole('button', { name: /technical details/i })).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-live="assertive" for immediate announcement', () => {
      render(<ErrorDisplay error="Error" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have hidden icon with aria-hidden', () => {
      const { container } = render(<ErrorDisplay error="Error" />);

      const icon = container.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });
});

describe('InlineError', () => {
  it('should render error message', () => {
    render(<InlineError error="Field is required" />);

    expect(screen.getByText('Field is required')).toBeInTheDocument();
  });

  it('should have role="alert"', () => {
    render(<InlineError error="Error" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<InlineError error="Error" className="custom-error" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('custom-error');
  });

  it('should render warning icon', () => {
    const { container } = render(<InlineError error="Error" />);

    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveTextContent('⚠️');
  });

  it('should apply red text styling', () => {
    render(<InlineError error="Error" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('text-red-600');
  });
});
