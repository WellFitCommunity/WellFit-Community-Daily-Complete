/**
 * useMfaEnrollment Hook Tests
 *
 * Tests loading, success, error states, and derived boolean flags
 * (requiresSetup, isInGracePeriod, isEnforced, isExempt).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetMfaStatus = vi.fn();

vi.mock('../../services/mfaEnrollmentService', () => ({
  getMfaStatus: (...args: unknown[]) => mockGetMfaStatus(...args),
}));

describe('useMfaEnrollment', () => {
  let useMfaEnrollment: typeof import('../useMfaEnrollment').useMfaEnrollment;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('../useMfaEnrollment');
    useMfaEnrollment = mod.useMfaEnrollment;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    mockGetMfaStatus.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useMfaEnrollment('user-1'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.status).toBeNull();
    expect(result.current.requiresSetup).toBe(false);
  });

  it('returns not loading when no userId provided', async () => {
    const { result } = renderHook(() => useMfaEnrollment(undefined));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.status).toBeNull();
    expect(mockGetMfaStatus).not.toHaveBeenCalled();
  });

  it('fetches status and sets requiresSetup for grace period user', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'grace_period',
        grace_period_ends: '2026-02-15T00:00:00Z',
        days_remaining: 5,
        role: 'admin',
        mfa_method: null,
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).not.toBeNull();
    expect(result.current.requiresSetup).toBe(true);
    expect(result.current.isInGracePeriod).toBe(true);
    expect(result.current.daysRemaining).toBe(5);
    expect(result.current.isEnforced).toBe(false);
    expect(result.current.isExempt).toBe(false);
  });

  it('sets isEnforced when enforcement_status is enforced and MFA not enabled', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'enforced',
        grace_period_ends: '2026-02-08T00:00:00Z',
        days_remaining: 0,
        role: 'nurse',
        mfa_method: null,
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-2'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnforced).toBe(true);
    expect(result.current.requiresSetup).toBe(true);
    expect(result.current.isInGracePeriod).toBe(false);
  });

  it('sets isExempt when enforcement_status is exempt', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'exempt',
        grace_period_ends: null,
        days_remaining: null,
        role: 'admin',
        mfa_method: null,
        exemption_reason: 'Shared workstation',
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-3'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isExempt).toBe(true);
    expect(result.current.requiresSetup).toBe(false);
    expect(result.current.isEnforced).toBe(false);
    expect(result.current.isInGracePeriod).toBe(false);
  });

  it('shows no setup required when MFA is already enabled', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: true,
        enrollment_exists: true,
        enforcement_status: 'enforced',
        grace_period_ends: null,
        days_remaining: null,
        role: 'admin',
        mfa_method: 'totp',
        last_verified: '2026-02-07T12:00:00Z',
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-4'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.requiresSetup).toBe(false);
    expect(result.current.isInGracePeriod).toBe(false);
    expect(result.current.isEnforced).toBe(false);
  });

  it('sets error when service call fails', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: false,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-5'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Database error');
    expect(result.current.status).toBeNull();
  });

  it('defaults daysRemaining to 0 when null', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'pending',
        grace_period_ends: null,
        days_remaining: null,
        role: 'admin',
        mfa_method: null,
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-6'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.daysRemaining).toBe(0);
  });

  it('refresh triggers re-fetch', async () => {
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: false,
        enrollment_exists: true,
        enforcement_status: 'grace_period',
        grace_period_ends: '2026-02-15T00:00:00Z',
        days_remaining: 5,
        role: 'admin',
        mfa_method: null,
      },
    });

    const { result } = renderHook(() => useMfaEnrollment('user-7'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetMfaStatus).toHaveBeenCalledTimes(1);

    // Now update mock to return enabled
    mockGetMfaStatus.mockResolvedValue({
      success: true,
      data: {
        mfa_required: true,
        mfa_enabled: true,
        enrollment_exists: true,
        enforcement_status: 'enforced',
        grace_period_ends: null,
        days_remaining: null,
        role: 'admin',
        mfa_method: 'totp',
      },
    });

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.status?.mfa_enabled).toBe(true);
    });

    expect(mockGetMfaStatus).toHaveBeenCalledTimes(2);
    expect(result.current.requiresSetup).toBe(false);
  });
});
