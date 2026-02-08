/**
 * AdminMfaSetupPage Tests
 *
 * Tests the TOTP setup flow: loading → scan QR → confirm code → backup codes → done.
 * Tests error handling, navigation, and user interactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock QRCode — reimport and re-set in beforeEach since restoreAllMocks resets vi.fn()
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(),
  },
}));

// Mock auth context — use mutable state so tests can override
const mockAuthState = {
  user: { id: 'user-1', email: 'admin@test.com' } as { id: string; email: string } | null,
};
const mockInvoke = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    supabase: {
      auth: { getSession: mockGetSession },
      functions: { invoke: mockInvoke },
    },
  }),
}));

// Mock services
vi.mock('../../services/mfaEnrollmentService', () => ({
  updateMfaEnabled: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import component (no resetModules — mocks are stable)
import { AdminMfaSetupPage } from '../AdminMfaSetupPage';

describe('AdminMfaSetupPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthState.user = { id: 'user-1', email: 'admin@test.com' };
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token' } },
    });

    // Re-set QRCode mock (vi.restoreAllMocks in afterEach resets vi.fn implementations)
    const QRCodeMod = await import('qrcode');
    const mockToDataURL = QRCodeMod.default.toDataURL as unknown as ReturnType<typeof vi.fn>;
    mockToDataURL.mockResolvedValue('data:image/png;base64,mock-qr');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state on mount', () => {
    mockInvoke.mockImplementation(() => new Promise(() => {}));

    render(<AdminMfaSetupPage />);

    expect(
      screen.getByText('Preparing authenticator setup...')
    ).toBeInTheDocument();
  });

  it('displays QR code and secret after begin succeeds', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        otpauth_uri: 'otpauth://totp/WellFit:admin@test.com?secret=ABCDEF',
        secret: 'ABCDEF123456',
      },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(screen.getByText('Step 1: Scan QR Code')).toBeInTheDocument();
    });

    // QR code renders after async toDataURL resolves — wait for it
    await waitFor(() => {
      expect(
        screen.getByAltText('QR code for authenticator app')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('ABCDEF123456')).toBeInTheDocument();
    expect(
      screen.getByText('Or enter this secret manually:')
    ).toBeInTheDocument();
    expect(
      screen.getByText("I've scanned the QR code")
    ).toBeInTheDocument();
  });

  it('shows error state when session is expired', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Session expired. Please log in again.')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Back to Login')).toBeInTheDocument();
  });

  it('shows error state when begin function fails', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge function error' },
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Edge function error')
      ).toBeInTheDocument();
    });
  });

  it('navigates to confirm step when scanned button clicked', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        otpauth_uri: 'otpauth://totp/WellFit:admin@test.com?secret=ABC',
        secret: 'ABC123',
      },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));

    expect(
      screen.getByText('Step 2: Enter Verification Code')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('6-Digit Code')).toBeInTheDocument();
  });

  it('restricts code input to 6 digits only', async () => {
    mockInvoke.mockResolvedValue({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));

    const input = screen.getByLabelText('6-Digit Code');
    fireEvent.change(input, { target: { value: '12abc3456789' } });

    expect((input as HTMLInputElement).value).toBe('123456');
  });

  it('disables verify button when code is less than 6 digits', async () => {
    mockInvoke.mockResolvedValue({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));

    const input = screen.getByLabelText('6-Digit Code');
    fireEvent.change(input, { target: { value: '123' } });

    const verifyBtn = screen.getByText('Verify & Enable').closest('button');
    expect(verifyBtn).toBeDisabled();
  });

  it('shows backup codes after successful verification', async () => {
    // First call: begin
    mockInvoke.mockResolvedValueOnce({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });
    // Second call: confirm
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        backup_codes: ['ABC123', 'DEF456', 'GHI789'],
      },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));
    fireEvent.change(screen.getByLabelText('6-Digit Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify & Enable'));

    await waitFor(() => {
      expect(screen.getByText('Authenticator Enabled!')).toBeInTheDocument();
    });

    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('DEF456')).toBeInTheDocument();
    expect(screen.getByText('GHI789')).toBeInTheDocument();
  });

  it('requires backup codes checkbox before Continue button works', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, backup_codes: ['CODE1'] },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));
    fireEvent.change(screen.getByLabelText('6-Digit Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify & Enable'));

    await waitFor(() => {
      expect(screen.getByText('Authenticator Enabled!')).toBeInTheDocument();
    });

    const continueBtn = screen
      .getByText('Continue to Admin Panel')
      .closest('button');
    expect(continueBtn).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(continueBtn).not.toBeDisabled();
  });

  it('navigates to admin panel after confirming backup codes', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });
    mockInvoke.mockResolvedValueOnce({
      data: { success: true, backup_codes: ['CODE1'] },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));
    fireEvent.change(screen.getByLabelText('6-Digit Code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByText('Verify & Enable'));

    await waitFor(() => {
      expect(screen.getByText('Authenticator Enabled!')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue to Admin Panel'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/system', {
      replace: true,
    });
  });

  it('redirects to admin panel if TOTP already configured', async () => {
    mockInvoke.mockResolvedValue({
      data: { already_configured: true },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/system', {
        replace: true,
      });
    });
  });

  it('shows login prompt when user is not authenticated', () => {
    mockAuthState.user = null;

    render(<AdminMfaSetupPage />);

    expect(
      screen.getByText('Please log in to set up MFA.')
    ).toBeInTheDocument();
  });

  it('displays page header with title', async () => {
    mockInvoke.mockResolvedValue({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'S' },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(screen.getByText('Set Up Authenticator')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Two-factor authentication is required for your role.'
      )
    ).toBeInTheDocument();
  });

  it('shows error from confirm step when code is wrong', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'S' },
      error: null,
    });
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'Invalid code. Please try again.' },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));
    fireEvent.change(screen.getByLabelText('6-Digit Code'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByText('Verify & Enable'));

    await waitFor(() => {
      expect(
        screen.getByText('Invalid code. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('has Back to QR Code button on confirm step', async () => {
    mockInvoke.mockResolvedValue({
      data: { otpauth_uri: 'otpauth://totp/test', secret: 'SEC' },
      error: null,
    });

    render(<AdminMfaSetupPage />);

    await waitFor(() => {
      expect(
        screen.getByText("I've scanned the QR code")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("I've scanned the QR code"));

    expect(screen.getByText('Back to QR Code')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back to QR Code'));

    expect(screen.getByText('Step 1: Scan QR Code')).toBeInTheDocument();
  });
});
