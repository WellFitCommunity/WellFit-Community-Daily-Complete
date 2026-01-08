/**
 * Tests for X12ClaimGenerator Component
 *
 * Purpose: Verify X12 837P claim generator rendering and functionality
 * Coverage: Rendering, generation flow, download, copy, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { X12ClaimGenerator } from '../X12ClaimGenerator';

// Mock toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

vi.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// Store mock functions for assertions
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '../../../lib/supabaseClient';

describe('X12ClaimGenerator', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    billingProviderId: 'provider-456',
  };

  const mockX12Response = {
    x12: 'ISA*00*          *00*          *ZZ*SENDER    *ZZ*RECEIVER  *230101*1200*^*00501*000000001*0*P*:~GS*HC*SENDER*RECEIVER*20230101*1200*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*000000001*20230101*1200*CH~NM1*41*2*WELLFIT COMMUNITY*****46*123456789~PER*IC*BILLING*TE*5551234567~NM1*40*2*PAYER NAME*****46*987654321~HL*1**20*1~NM1*85*2*PROVIDER NAME*****XX*1234567890~SE*10*0001~GE*1*1~IEA*1*000000001~',
    claimId: 'CLM-2023-001',
    controlNumber: '000000001',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockToastInfo.mockClear();

    // Default mock setup
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'mock-token' } },
      error: null,
    } as ReturnType<typeof supabase.auth.getSession> extends Promise<infer T> ? T : never);

    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: mockX12Response, error: null });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with title "X12 837P Claim Generation"', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.getByText('X12 837P Claim Generation')).toBeInTheDocument();
    });

    it('should render Generate 837P Claim button', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Generate 837P Claim/i })).toBeInTheDocument();
    });

    it('should not show Download X12 File button initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /Download X12 File/i })).not.toBeInTheDocument();
    });

    it('should not show Copy X12 button initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /Copy X12/i })).not.toBeInTheDocument();
    });

    it('should not show generated content initially', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      expect(screen.queryByText(/Generated X12 Content/i)).not.toBeInTheDocument();
    });
  });

  describe('Generate 837P Claim Button', () => {
    it('should have Generate button enabled with valid props', () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Generate 837P Claim/i });
      expect(button).not.toBeDisabled();
    });

    it('should call supabase function invoke on generate', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-837p', expect.objectContaining({
          body: { encounterId: 'encounter-123', billingProviderId: 'provider-456' },
        }));
      });
    });

    it('should show toast error when missing encounterId', async () => {
      render(<X12ClaimGenerator encounterId="" billingProviderId="provider-456" />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Missing encounterId or billingProviderId');
      });
    });

    it('should show toast error when missing billingProviderId', async () => {
      render(<X12ClaimGenerator encounterId="encounter-123" billingProviderId="" />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Missing encounterId or billingProviderId');
      });
    });
  });

  describe('Loading State', () => {
    it('should show "Generating..." while loading', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByText(/Generating…/)).toBeInTheDocument();
      });
    });

    it('should disable button while generating', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Generating…/i });
        expect(button).toBeDisabled();
      });
    });
  });

  describe('After Generation', () => {
    it('should show Download X12 File button after generation', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download X12 File/i })).toBeInTheDocument();
      });
    });

    it('should show Copy X12 button after generation', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy X12/i })).toBeInTheDocument();
      });
    });

    it('should display generated X12 content', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByText(/Generated X12 Content/i)).toBeInTheDocument();
        expect(screen.getByText(/ISA/)).toBeInTheDocument();
      });
    });

    it('should display Claim ID', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByText('Claim ID:')).toBeInTheDocument();
        expect(screen.getByText('CLM-2023-001')).toBeInTheDocument();
      });
    });

    it('should display Control Number', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByText('ST Control #:')).toBeInTheDocument();
        expect(screen.getByText('000000001')).toBeInTheDocument();
      });
    });

    it('should show success toast after generation', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('successfully'));
      });
    });

    it('should call onClaimGenerated callback', async () => {
      const onClaimGenerated = vi.fn();
      render(<X12ClaimGenerator {...defaultProps} onClaimGenerated={onClaimGenerated} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(onClaimGenerated).toHaveBeenCalledWith('CLM-2023-001', expect.stringContaining('ISA'));
      });
    });
  });

  describe('Download X12 File Button', () => {
    it('should create download link when clicked', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download X12 File/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Download X12 File/i }));

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should revoke object URL after download', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download X12 File/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Download X12 File/i }));

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should show info toast after download', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Download X12 File/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Download X12 File/i }));

      expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining('Downloaded'));
    });
  });

  describe('Copy X12 Button', () => {
    it('should copy to clipboard when clicked', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy X12/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Copy X12/i }));

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('ISA'));
      });
    });

    it('should show info toast after copy', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy X12/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Copy X12/i }));

      await waitFor(() => {
        expect(mockToastInfo).toHaveBeenCalledWith('X12 copied to clipboard');
      });
    });

    it('should show error toast if copy fails', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Copy X12/i })).toBeInTheDocument();
      });

      // Mock clipboard failure
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Copy failed'));

      fireEvent.click(screen.getByRole('button', { name: /Copy X12/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith('Could not copy to clipboard');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on generation failure', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Edge Function error' },
      });

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Edge Function error'));
      });
    });

    it('should show error when no X12 payload returned', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { x12: '', claimId: '', controlNumber: '' },
        error: null,
      });

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('No X12 payload returned'));
      });
    });

    it('should show error on network failure', async () => {
      vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network error'));

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Network error'));
      });
    });
  });

  describe('Raw String Response Handling', () => {
    it('should handle raw string X12 response', async () => {
      const rawX12 = 'ISA*00*          *00*          *ZZ*TEST~GE*1*1~IEA*1*1~';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: rawX12,
        error: null,
      });

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(screen.getByText(/Generated X12 Content/i)).toBeInTheDocument();
        expect(screen.getByText(/ISA/)).toBeInTheDocument();
      });
    });

    it('should generate fallback claim ID when not provided', async () => {
      const rawX12 = 'ISA*00*TEST~';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: rawX12,
        error: null,
      });

      const onClaimGenerated = vi.fn();
      render(<X12ClaimGenerator {...defaultProps} onClaimGenerated={onClaimGenerated} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        // Fallback claim ID should start with "WF"
        expect(onClaimGenerated).toHaveBeenCalledWith(expect.stringMatching(/^WF/), expect.stringContaining('ISA'));
      });
    });
  });

  describe('Auth Token Handling', () => {
    it('should pass access token in headers', async () => {
      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-837p', expect.objectContaining({
          headers: { Authorization: 'Bearer mock-token' },
        }));
      });
    });

    it('should handle missing session gracefully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as ReturnType<typeof supabase.auth.getSession> extends Promise<infer T> ? T : never);

      render(<X12ClaimGenerator {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Generate 837P Claim/i }));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-837p', expect.objectContaining({
          headers: undefined,
        }));
      });
    });
  });
});
