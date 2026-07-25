/**
 * Security Tests for KioskCheckIn
 *
 * Pins the security invariants of the public kiosk surface:
 * - NO direct PHI table access from the browser (everything via chw-kiosk)
 * - client-side input validation rejects injection before any network call
 * - rate limiting and device-auth failures surface safe, generic messages
 * - inactivity timeout clears entered PHI from the screen
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { KioskCheckIn } from '../KioskCheckIn';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function errorResponse(body: Record<string, unknown>, status: number) {
  return {
    data: null,
    error: { context: new Response(JSON.stringify(body), { status }) },
  };
}

function startLookup(first: string, last: string, dob: string) {
  fireEvent.click(screen.getByText('English'));
  fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: first } });
  fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: last } });
  fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: dob } });
  fireEvent.click(screen.getByText(/Find Me/i));
}

describe('KioskCheckIn - Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('chw_kiosk_id', 'kiosk-test-001');
    localStorage.setItem('chw_kiosk_token', 'test-device-token');
    mockInvoke.mockResolvedValue({ data: { found: false }, error: null });
  });

  describe('No direct PHI access', () => {
    it('never queries database tables directly — not even on a full lookup', async () => {
      mockInvoke.mockResolvedValue({
        data: { found: true, method: 'phone_last4' },
        error: null,
      });
      render(<KioskCheckIn />);
      startLookup('Test', 'Alpha', '1950-01-01');
      await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('Input validation blocks injection before any network call', () => {
    it('rejects SQL injection in the name fields', async () => {
      render(<KioskCheckIn />);
      startLookup("Robert'); DROP TABLE profiles;--", 'Smith', '1950-01-01');
      expect(
        await screen.findByText(/Invalid input detected|invalid characters/i)
      ).toBeInTheDocument();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('rejects script tags in the name fields', async () => {
      render(<KioskCheckIn />);
      startLookup('<script>alert(1)</script>', 'Smith', '1950-01-01');
      expect(
        await screen.findByText(/Invalid input detected|invalid characters/i)
      ).toBeInTheDocument();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('rejects a malformed date of birth', async () => {
      render(<KioskCheckIn />);
      startLookup('Test', 'Alpha', 'not-a-date');
      expect(await screen.findByText(/Invalid date format/i)).toBeInTheDocument();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('accepts legitimate apostrophe names like O’Brien', async () => {
      render(<KioskCheckIn />);
      startLookup("O'Brien", 'Test', '1950-01-01');
      await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
      expect(mockInvoke).toHaveBeenCalledWith('chw-kiosk', {
        body: expect.objectContaining({ first_name: "O'Brien" }),
      });
    });
  });

  describe('Server rejection handling', () => {
    it('shows the wait message when the server rate-limits (429)', async () => {
      mockInvoke.mockResolvedValue(
        errorResponse({ error: 'Too many attempts. Please wait and try again.' }, 429)
      );
      render(<KioskCheckIn />);
      startLookup('Test', 'Alpha', '1950-01-01');
      expect(await screen.findByText(/Too many attempts/i)).toBeInTheDocument();
    });

    it('shows a generic unavailable message on device-auth failure without leaking detail', async () => {
      mockInvoke.mockResolvedValue(errorResponse({ error: 'Device not authorized' }, 401));
      render(<KioskCheckIn />);
      startLookup('Test', 'Alpha', '1950-01-01');
      expect(await screen.findByText(/kiosk is unavailable/i)).toBeInTheDocument();
      expect(screen.queryByText(/Device not authorized/i)).not.toBeInTheDocument();
    });
  });

  describe('HIPAA inactivity timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('clears entered PHI and returns to the language screen after inactivity', async () => {
      render(<KioskCheckIn />);
      fireEvent.click(screen.getByText('English'));
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Test' } });

      act(() => {
        vi.advanceTimersByTime(120000 + 5000);
      });

      expect(screen.getByText(/Select Your Language/i)).toBeInTheDocument();
      // Re-entering the lookup screen shows an empty form — PHI was cleared
      fireEvent.click(screen.getByText('English'));
      expect(screen.getByLabelText(/First Name/i)).toHaveValue('');
    });
  });
});
