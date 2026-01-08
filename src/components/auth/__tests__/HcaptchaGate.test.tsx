/**
 * Tests for HcaptchaGate Component
 *
 * Purpose: Bot protection wrapper using hCaptcha
 * Tests: Rendering, form submission, verification flow, error handling
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event'; // eslint-disable-line @typescript-eslint/no-unused-vars
import HcaptchaGate from '../HcaptchaGate';

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_HCAPTCHA_SITE_KEY: 'test-site-key',
    },
  },
});

// Mock useHcaptcha hook
const mockExecute = vi.fn();
const mockCaptchaRef = { current: null };

vi.mock('hooks/useHcaptcha', () => ({
  useHcaptcha: () => ({
    HCaptcha: ({ sitekey, size, ref }: { sitekey: string; size: string; ref: React.RefObject<unknown> }) => (
      <div data-testid="hcaptcha-widget" data-sitekey={sitekey} data-size={size}>
        hCaptcha Widget
      </div>
    ),
    captchaRef: mockCaptchaRef,
    execute: mockExecute,
  }),
}));

// Mock verifyHcaptchaToken
const mockVerifyHcaptchaToken = vi.fn();
vi.mock('utils/verifyHcaptcha', () => ({
  verifyHcaptchaToken: (token: string, siteKey: string) => mockVerifyHcaptchaToken(token, siteKey),
}));

describe('HcaptchaGate', () => {
  const mockOnVerified = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnVerified.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue('test-token');
    mockVerifyHcaptchaToken.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should render form with submit button', () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    it('should render hCaptcha widget (invisible mode)', () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      const widget = screen.getByTestId('hcaptcha-widget');
      expect(widget).toBeInTheDocument();
      expect(widget).toHaveAttribute('data-size', 'invisible');
    });

    it('should have correct initial button state', () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Submit');
    });
  });

  describe('Form Submission', () => {
    it('should execute captcha on form submit', async () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      const form = screen.getByRole('button').closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockExecute).toHaveBeenCalledTimes(1);
      });
    });

    it('should verify token after captcha execution', async () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockVerifyHcaptchaToken).toHaveBeenCalled();
        expect(mockVerifyHcaptchaToken.mock.calls[0][0]).toBe('test-token');
      });
    });

    it('should call onVerified after successful verification', async () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(mockOnVerified).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading text while submitting', async () => {
      // Make verification slow
      mockVerifyHcaptchaToken.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      // Should show loading state
      expect(screen.getByRole('button')).toHaveTextContent(/verifying/i);
    });

    it('should disable button while submitting', async () => {
      mockVerifyHcaptchaToken.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should re-enable button after submission completes', async () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByRole('button')).not.toBeDisabled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when captcha execution fails', async () => {
      mockExecute.mockRejectedValue(new Error('Captcha failed'));

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Captcha failed')).toBeInTheDocument();
      });
    });

    it('should display error message when verification fails', async () => {
      mockVerifyHcaptchaToken.mockRejectedValue(new Error('Invalid token'));

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid token')).toBeInTheDocument();
      });
    });

    it('should display generic error for non-Error exceptions', async () => {
      mockExecute.mockRejectedValue('Something went wrong');

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
      });
    });

    it('should not call onVerified when verification fails', async () => {
      mockVerifyHcaptchaToken.mockRejectedValue(new Error('Invalid token'));

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Invalid token')).toBeInTheDocument();
      });

      expect(mockOnVerified).not.toHaveBeenCalled();
    });

    it('should clear error on next submit attempt', async () => {
      mockExecute.mockRejectedValueOnce(new Error('First error'));
      mockExecute.mockResolvedValueOnce('test-token');

      render(<HcaptchaGate onVerified={mockOnVerified} />);

      // First attempt - should fail
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second attempt - error should be cleared
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
      });
    });
  });

  describe('onVerified callback', () => {
    it('should handle async onVerified callback', async () => {
      const asyncOnVerified = vi.fn().mockResolvedValue(undefined);

      render(<HcaptchaGate onVerified={asyncOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(asyncOnVerified).toHaveBeenCalledTimes(1);
      });
    });

    it('should display error if onVerified throws', async () => {
      mockOnVerified.mockRejectedValue(new Error('Action failed'));

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('Action failed')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button', () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('should show error with appropriate styling', async () => {
      mockExecute.mockRejectedValue(new Error('Test error'));

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        const errorElement = screen.getByText('Test error');
        expect(errorElement).toHaveClass('text-red-600');
      });
    });
  });

  describe('Button Styling', () => {
    it('should have primary button styling', () => {
      render(<HcaptchaGate onVerified={mockOnVerified} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-600');
      expect(button).toHaveClass('text-white');
    });

    it('should have disabled opacity when submitting', async () => {
      mockVerifyHcaptchaToken.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<HcaptchaGate onVerified={mockOnVerified} />);
      fireEvent.click(screen.getByRole('button'));

      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:opacity-50');
    });
  });
});
