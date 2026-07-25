/**
 * KioskCheckIn Component Tests
 *
 * Pins the edge-function check-in flow: device provisioning, bilingual
 * language selection, name+DOB lookup, SMS / phone-last-4 verification,
 * privacy consent ordering, and the success/see-staff outcomes.
 * All server interaction goes through the chw-kiosk edge function — the
 * component must never query PHI tables directly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KioskCheckIn } from '../KioskCheckIn';
import { supabase } from '../../../lib/supabaseClient';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

function errorResponse(body: Record<string, unknown>, status: number) {
  return {
    data: null,
    error: { context: new Response(JSON.stringify(body), { status }) },
  };
}

function provisionDevice() {
  localStorage.setItem('chw_kiosk_id', 'kiosk-test-001');
  localStorage.setItem('chw_kiosk_token', 'test-device-token');
}

async function fillLookupAndSubmit() {
  fireEvent.click(screen.getByText('English'));
  fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Test' } });
  fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Alpha' } });
  fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '1950-01-01' } });
  fireEvent.click(screen.getByText(/Find Me/i));
}

describe('KioskCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    provisionDevice();
    // Re-establish the default implementation every test (clearAllMocks does not)
    mockInvoke.mockResolvedValue({ data: { found: false }, error: null });
  });

  describe('Device provisioning', () => {
    it('shows the staff setup screen when the kiosk has no stored credentials', () => {
      localStorage.clear();
      render(<KioskCheckIn />);
      expect(screen.getByText(/Kiosk Setup/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Kiosk ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Device Token/i)).toBeInTheDocument();
    });

    it('stores credentials and proceeds to language selection on activation', () => {
      localStorage.clear();
      render(<KioskCheckIn />);
      fireEvent.change(screen.getByLabelText(/Kiosk ID/i), { target: { value: 'kiosk-lib-002' } });
      fireEvent.change(screen.getByLabelText(/Device Token/i), { target: { value: 'secret-token' } });
      fireEvent.click(screen.getByText(/Activate Kiosk/i));

      expect(localStorage.getItem('chw_kiosk_id')).toBe('kiosk-lib-002');
      expect(localStorage.getItem('chw_kiosk_token')).toBe('secret-token');
      expect(screen.getByText(/Select Your Language/i)).toBeInTheDocument();
    });
  });

  describe('Language selection', () => {
    it('renders all three language options', () => {
      render(<KioskCheckIn />);
      expect(screen.getByText(/Select Your Language/i)).toBeInTheDocument();
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText(/Español/)).toBeInTheDocument();
      expect(screen.getByText(/Tiếng Việt/)).toBeInTheDocument();
    });

    it('shows the lookup form in Spanish when Spanish is selected', () => {
      render(<KioskCheckIn />);
      fireEvent.click(screen.getByText(/Español/));
      expect(screen.getByText(/Búsqueda de Paciente/i)).toBeInTheDocument();
    });
  });

  describe('Patient lookup', () => {
    it('collects only name and DOB — no SSN or PIN fields exist', () => {
      render(<KioskCheckIn />);
      fireEvent.click(screen.getByText('English'));
      expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/SSN/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/PIN/i)).not.toBeInTheDocument();
    });

    it('disables Find Me until all fields are filled', () => {
      render(<KioskCheckIn />);
      fireEvent.click(screen.getByText('English'));
      expect(screen.getByText(/Find Me/i)).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Test' } });
      fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Alpha' } });
      fireEvent.change(screen.getByLabelText(/Date of Birth/i), { target: { value: '1950-01-01' } });
      expect(screen.getByText(/Find Me/i)).not.toBeDisabled();
    });

    it('sends device credentials and identity to the chw-kiosk edge function', async () => {
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('chw-kiosk', {
          body: expect.objectContaining({
            action: 'lookup',
            kiosk_id: 'kiosk-test-001',
            device_token: 'test-device-token',
            first_name: 'Test',
            last_name: 'Alpha',
            dob: '1950-01-01',
          }),
        });
      });
    });

    it('shows not-found guidance when the lookup finds no record', async () => {
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      expect(await screen.findByText(/could not find your record/i)).toBeInTheDocument();
    });

    it('shows the kiosk-unavailable message when device auth fails (401)', async () => {
      mockInvoke.mockResolvedValue(errorResponse({ error: 'Device not authorized' }, 401));
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      expect(await screen.findByText(/kiosk is unavailable/i)).toBeInTheDocument();
    });

    it('routes to the see-staff screen when no verification method exists', async () => {
      mockInvoke.mockResolvedValue({ data: { found: true, method: 'none' }, error: null });
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      expect(await screen.findByText(/Please See Staff/i)).toBeInTheDocument();
    });
  });

  describe('Consent and verification', () => {
    it('shows privacy consent BEFORE verification when a match is found', async () => {
      mockInvoke.mockResolvedValue({
        data: { found: true, method: 'sms', masked_phone: '•••-•••-0100' },
        error: null,
      });
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      expect(await screen.findByText(/Privacy Consent/i)).toBeInTheDocument();
      expect(screen.getByText(/HIPAA/i)).toBeInTheDocument();
    });

    it('shows the masked phone and code entry after consent (SMS method)', async () => {
      mockInvoke.mockResolvedValue({
        data: { found: true, method: 'sms', masked_phone: '•••-•••-0100' },
        error: null,
      });
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      fireEvent.click(await screen.findByText(/I Agree/i));
      expect(await screen.findByText(/•••-•••-0100/)).toBeInTheDocument();
      expect(screen.getByLabelText(/code from your text message/i)).toBeInTheDocument();
    });

    it('asks for phone last-4 when SMS is not available', async () => {
      mockInvoke.mockResolvedValue({ data: { found: true, method: 'phone_last4' }, error: null });
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      fireEvent.click(await screen.findByText(/I Agree/i));
      expect(await screen.findByLabelText(/last 4 digits of your phone/i)).toBeInTheDocument();
    });

    it('completes check-in and shows the success screen with the first name', async () => {
      const onCheckInComplete = vi.fn();
      mockInvoke
        .mockResolvedValueOnce({ data: { found: true, method: 'phone_last4' }, error: null })
        .mockResolvedValueOnce({
          data: { verified: true, visit_id: 'visit-123', patient_first_name: 'Test' },
          error: null,
        });
      render(<KioskCheckIn onCheckInComplete={onCheckInComplete} />);
      await fillLookupAndSubmit();
      fireEvent.click(await screen.findByText(/I Agree/i));
      const factorInput = await screen.findByLabelText(/last 4 digits/i);
      fireEvent.change(factorInput, { target: { value: '0100' } });
      fireEvent.click(screen.getByText(/Check In/i));

      expect(await screen.findByText(/Checked In/i)).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(onCheckInComplete).toHaveBeenCalledWith('visit-123');
      // verify call carried the knowledge factor
      expect(mockInvoke).toHaveBeenLastCalledWith('chw-kiosk', {
        body: expect.objectContaining({ action: 'verify', phone_last4: '0100' }),
      });
    });

    it('shows a retryable error when verification fails', async () => {
      mockInvoke
        .mockResolvedValueOnce({ data: { found: true, method: 'phone_last4' }, error: null })
        .mockResolvedValueOnce(errorResponse({ verified: false, error: 'Verification failed' }, 401));
      render(<KioskCheckIn />);
      await fillLookupAndSubmit();
      fireEvent.click(await screen.findByText(/I Agree/i));
      const factorInput = await screen.findByLabelText(/last 4 digits/i);
      fireEvent.change(factorInput, { target: { value: '9999' } });
      fireEvent.click(screen.getByText(/Check In/i));

      expect(await screen.findByText(/didn’t match/i)).toBeInTheDocument();
      // still on the verify screen so the senior can retry
      expect(screen.getByLabelText(/last 4 digits/i)).toBeInTheDocument();
    });
  });
});
