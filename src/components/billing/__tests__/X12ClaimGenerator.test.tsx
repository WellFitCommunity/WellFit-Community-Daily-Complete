/**
 * Tests for X12ClaimGenerator Component
 *
 * Purpose: Verify X12 837P claim generator rendering and structure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { X12ClaimGenerator } from '../X12ClaimGenerator';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  },
}));

describe('X12ClaimGenerator', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    billingProviderId: 'provider-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with header', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.getByText('X12 837P Claim Generation')).toBeInTheDocument();
    });

    it('should render Generate button', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generate 837P Claim/i })).toBeInTheDocument();
    });

    it('should not show download button initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /Download X12 File/i })).not.toBeInTheDocument();
    });

    it('should not show copy button initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /Copy X12/i })).not.toBeInTheDocument();
    });

    it('should not show generated content initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByText(/Generated X12 Content/i)).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should have Generate button enabled with valid props', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Generate 837P Claim/i });
      expect(button).not.toBeDisabled();
    });
  });
});
