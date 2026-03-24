// src/components/__tests__/PasskeySetup.test.tsx
// Tests for the PasskeySetup biometric authentication component

import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PasskeySetup } from '../PasskeySetup';

// Mock the passkeyService module
const mockIsPasskeySupported = vi.fn();
const mockIsPlatformAuthenticatorAvailable = vi.fn();
const mockRegisterPasskey = vi.fn();
const mockGetUserPasskeys = vi.fn();
const mockDeletePasskey = vi.fn();

vi.mock('../../services/passkeyService', () => ({
  isPasskeySupported: (...args: unknown[]) => mockIsPasskeySupported(...args),
  isPlatformAuthenticatorAvailable: (...args: unknown[]) => mockIsPlatformAuthenticatorAvailable(...args),
  registerPasskey: (...args: unknown[]) => mockRegisterPasskey(...args),
  getUserPasskeys: (...args: unknown[]) => mockGetUserPasskeys(...args),
  deletePasskey: (...args: unknown[]) => mockDeletePasskey(...args),
}));

const defaultProps = {
  userId: 'test-user-001',
  userName: 'Test Patient Alpha',
  displayName: 'Test Alpha',
};

describe('PasskeySetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations
    mockIsPasskeySupported.mockReturnValue(true);
    mockIsPlatformAuthenticatorAvailable.mockResolvedValue(true);
    mockGetUserPasskeys.mockResolvedValue([]);
    mockRegisterPasskey.mockResolvedValue({ id: 'cred-1', credential_id: 'abc123' });
    mockDeletePasskey.mockResolvedValue(undefined);
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  describe('Browser support detection', () => {
    it('shows unsupported message when WebAuthn is not available', () => {
      mockIsPasskeySupported.mockReturnValue(false);

      render(<PasskeySetup {...defaultProps} />);

      expect(screen.getByText('Biometric Login Not Available')).toBeInTheDocument();
      expect(screen.getByText(/Your browser doesn't support passkeys/)).toBeInTheDocument();
    });

    it('shows registration UI when WebAuthn is supported', async () => {
      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText('Biometric Authentication')).toBeInTheDocument();
      expect(screen.getByText('Add Biometric Authentication')).toBeInTheDocument();
    });

    it('shows platform authenticator description when available', async () => {
      mockIsPlatformAuthenticatorAvailable.mockResolvedValue(true);

      render(<PasskeySetup {...defaultProps} />);

      expect(
        await screen.findByText(/Use your fingerprint, face, or device PIN for quick/)
      ).toBeInTheDocument();
    });

    it('shows security key description when platform authenticator is not available', async () => {
      mockIsPlatformAuthenticatorAvailable.mockResolvedValue(false);

      render(<PasskeySetup {...defaultProps} />);

      expect(
        await screen.findByText(/security key for passwordless/)
      ).toBeInTheDocument();
    });
  });

  describe('Credential registration', () => {
    it('calls registerPasskey with correct arguments when register button is clicked', async () => {
      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      await waitFor(() => {
        expect(mockRegisterPasskey).toHaveBeenCalledWith(
          'test-user-001',
          'Test Patient Alpha',
          'Test Alpha',
          undefined,
          true
        );
      });
    });

    it('passes device name when provided', async () => {
      render(<PasskeySetup {...defaultProps} />);

      const input = await screen.findByPlaceholderText(/My iPhone/);
      fireEvent.change(input, { target: { value: 'My Test Device' } });

      const registerBtn = screen.getByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      await waitFor(() => {
        expect(mockRegisterPasskey).toHaveBeenCalledWith(
          'test-user-001',
          'Test Patient Alpha',
          'Test Alpha',
          'My Test Device',
          true
        );
      });
    });

    it('shows success message after registration', async () => {
      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      expect(
        await screen.findByText('Biometric authentication registered successfully!')
      ).toBeInTheDocument();
    });

    it('calls onSuccess callback after registration', async () => {
      const onSuccess = vi.fn();
      render(<PasskeySetup {...defaultProps} onSuccess={onSuccess} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows loading state during registration', async () => {
      // Make registerPasskey hang to keep loading state visible
      mockRegisterPasskey.mockImplementation(() => new Promise(() => {}));

      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      expect(await screen.findByText('Setting up...')).toBeInTheDocument();
    });

    it('shows error message when registration fails', async () => {
      mockRegisterPasskey.mockRejectedValue(new Error('Registration was cancelled or timed out'));

      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      expect(
        await screen.findByText('Registration was cancelled or timed out')
      ).toBeInTheDocument();
    });

    it('shows generic error for non-Error rejections', async () => {
      mockRegisterPasskey.mockRejectedValue('string error');

      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      expect(
        await screen.findByText('Failed to register biometric authentication')
      ).toBeInTheDocument();
    });

    it('reloads credentials after successful registration', async () => {
      mockGetUserPasskeys
        .mockResolvedValueOnce([]) // initial load
        .mockResolvedValueOnce([{ // after registration
          id: 'cred-1',
          credential_id: 'abc123',
          device_name: 'My Test Device',
          authenticator_type: 'platform',
          transports: ['internal'],
          last_used_at: null,
          created_at: '2026-01-01T00:00:00Z',
        }]);

      render(<PasskeySetup {...defaultProps} />);

      const registerBtn = await screen.findByText('Add Biometric Authentication');
      fireEvent.click(registerBtn);

      expect(await screen.findByText('My Test Device')).toBeInTheDocument();
    });
  });

  describe('Credential list display', () => {
    it('renders existing credentials with device names', async () => {
      mockGetUserPasskeys.mockResolvedValue([
        {
          id: 'cred-1',
          credential_id: 'abc123',
          device_name: 'Work MacBook',
          authenticator_type: 'platform',
          transports: ['internal'],
          last_used_at: '2026-03-20T10:00:00Z',
          created_at: '2026-01-15T09:00:00Z',
        },
        {
          id: 'cred-2',
          credential_id: 'def456',
          device_name: 'YubiKey 5',
          authenticator_type: 'cross-platform',
          transports: ['usb'],
          last_used_at: null,
          created_at: '2026-02-01T12:00:00Z',
        },
      ]);

      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText('Work MacBook')).toBeInTheDocument();
      expect(screen.getByText('YubiKey 5')).toBeInTheDocument();
      expect(screen.getByText('Your Biometric Devices')).toBeInTheDocument();
    });

    it('shows "Unknown Device" when device_name is null', async () => {
      mockGetUserPasskeys.mockResolvedValue([
        {
          id: 'cred-1',
          credential_id: 'abc123',
          device_name: null,
          authenticator_type: 'platform',
          transports: null,
          last_used_at: null,
          created_at: '2026-01-01T00:00:00Z',
        },
      ]);

      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText('Unknown Device')).toBeInTheDocument();
    });

    it('shows last used date when available', async () => {
      mockGetUserPasskeys.mockResolvedValue([
        {
          id: 'cred-1',
          credential_id: 'abc123',
          device_name: 'My Phone',
          authenticator_type: 'platform',
          transports: ['internal'],
          last_used_at: '2026-03-20T10:00:00Z',
          created_at: '2026-01-15T09:00:00Z',
        },
      ]);

      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText(/Last used:/)).toBeInTheDocument();
    });

    it('shows added date when last_used_at is null', async () => {
      mockGetUserPasskeys.mockResolvedValue([
        {
          id: 'cred-1',
          credential_id: 'abc123',
          device_name: 'My Phone',
          authenticator_type: 'platform',
          transports: null,
          last_used_at: null,
          created_at: '2026-01-15T09:00:00Z',
        },
      ]);

      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText(/Added:/)).toBeInTheDocument();
    });
  });

  describe('Credential deletion', () => {
    const credentialList = [
      {
        id: 'cred-1',
        credential_id: 'abc123',
        device_name: 'Old Device',
        authenticator_type: 'platform' as const,
        transports: ['internal'],
        last_used_at: null,
        created_at: '2026-01-01T00:00:00Z',
      },
    ];

    it('shows Remove button for each credential', async () => {
      mockGetUserPasskeys.mockResolvedValue(credentialList);

      render(<PasskeySetup {...defaultProps} />);

      expect(await screen.findByText('Remove')).toBeInTheDocument();
    });

    it('calls deletePasskey with credential_id when Remove is clicked and confirmed', async () => {
      mockGetUserPasskeys.mockResolvedValue(credentialList);

      render(<PasskeySetup {...defaultProps} />);

      const removeBtn = await screen.findByText('Remove');
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(mockDeletePasskey).toHaveBeenCalledWith('abc123');
      });
    });

    it('does not delete when user cancels confirm dialog', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      mockGetUserPasskeys.mockResolvedValue(credentialList);

      render(<PasskeySetup {...defaultProps} />);

      const removeBtn = await screen.findByText('Remove');
      fireEvent.click(removeBtn);

      expect(mockDeletePasskey).not.toHaveBeenCalled();
    });

    it('shows success message after deletion', async () => {
      mockGetUserPasskeys
        .mockResolvedValueOnce(credentialList) // initial load
        .mockResolvedValueOnce([]); // after deletion

      render(<PasskeySetup {...defaultProps} />);

      const removeBtn = await screen.findByText('Remove');
      fireEvent.click(removeBtn);

      expect(
        await screen.findByText('Biometric authentication removed')
      ).toBeInTheDocument();
    });

    it('shows error message when deletion fails', async () => {
      mockDeletePasskey.mockRejectedValue(new Error('Database error'));
      mockGetUserPasskeys.mockResolvedValue(credentialList);

      render(<PasskeySetup {...defaultProps} />);

      const removeBtn = await screen.findByText('Remove');
      fireEvent.click(removeBtn);

      expect(
        await screen.findByText('Database error')
      ).toBeInTheDocument();
    });
  });

  describe('Applies custom className', () => {
    it('passes className to root element', async () => {
      const { container } = render(
        <PasskeySetup {...defaultProps} className="custom-class" />
      );

      const rootDiv = container.firstElementChild;
      expect(rootDiv?.className).toContain('custom-class');
    });
  });
});
