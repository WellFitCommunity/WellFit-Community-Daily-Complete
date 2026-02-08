/**
 * MfaGracePeriodBanner Tests
 *
 * Tests visibility rules, color coding by urgency, dismiss behavior,
 * and navigation to MFA setup page.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock navigate
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useUser
const mockUser = { id: 'user-1' };

vi.mock('../../../contexts/AuthContext', () => ({
  useUser: () => mockUser,
}));

// Mock useMfaEnrollment with controllable return value
const mockMfaResult = {
  isInGracePeriod: false,
  daysRemaining: 0,
  isLoading: false,
};

vi.mock('../../../hooks/useMfaEnrollment', () => ({
  useMfaEnrollment: () => mockMfaResult,
}));

describe('MfaGracePeriodBanner', () => {
  let MfaGracePeriodBanner: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock state
    mockMfaResult.isInGracePeriod = false;
    mockMfaResult.daysRemaining = 0;
    mockMfaResult.isLoading = false;

    // Clear sessionStorage
    try {
      sessionStorage.removeItem('mfa_banner_dismissed');
    } catch {
      // test env
    }

    vi.resetModules();
    const mod = await import('../MfaGracePeriodBanner');
    MfaGracePeriodBanner = mod.MfaGracePeriodBanner;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when not in grace period', () => {
    mockMfaResult.isInGracePeriod = false;

    const { container } = render(<MfaGracePeriodBanner />);

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing while loading', () => {
    mockMfaResult.isLoading = true;
    mockMfaResult.isInGracePeriod = true;

    const { container } = render(<MfaGracePeriodBanner />);

    expect(container.innerHTML).toBe('');
  });

  it('shows banner with days remaining when in grace period', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 5;

    render(<MfaGracePeriodBanner />);

    expect(
      screen.getByText(/Multi-factor authentication required in 5 days/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Set up your authenticator app/)
    ).toBeInTheDocument();
    expect(screen.getByText('Set Up Now')).toBeInTheDocument();
  });

  it('shows "in 1 day" for singular day', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 1;

    render(<MfaGracePeriodBanner />);

    expect(
      screen.getByText(/Multi-factor authentication required in 1 day/)
    ).toBeInTheDocument();
  });

  it('shows "today" when 0 days remaining', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 0;

    render(<MfaGracePeriodBanner />);

    expect(
      screen.getByText(/Multi-factor authentication required today/)
    ).toBeInTheDocument();
  });

  it('uses yellow color for >3 days remaining', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 5;

    render(<MfaGracePeriodBanner />);

    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-yellow-50');
    expect(alert.className).toContain('border-yellow-300');
  });

  it('uses orange color for 1-3 days remaining', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 2;

    render(<MfaGracePeriodBanner />);

    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-orange-50');
    expect(alert.className).toContain('border-orange-300');
  });

  it('uses red color for <1 day remaining', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 0;

    render(<MfaGracePeriodBanner />);

    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-red-50');
    expect(alert.className).toContain('border-red-300');
  });

  it('navigates to /admin-mfa-setup when Set Up Now clicked', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 5;

    render(<MfaGracePeriodBanner />);

    fireEvent.click(screen.getByText('Set Up Now'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin-mfa-setup');
  });

  it('dismisses banner when X button clicked', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 5;

    render(<MfaGracePeriodBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Dismiss for this session'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has accessible role=alert attribute', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 3;

    render(<MfaGracePeriodBanner />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('Set Up Now button meets 44px minimum touch target', () => {
    mockMfaResult.isInGracePeriod = true;
    mockMfaResult.daysRemaining = 3;

    render(<MfaGracePeriodBanner />);

    const btn = screen.getByText('Set Up Now').closest('button');
    expect(btn?.className).toContain('min-h-[44px]');
    expect(btn?.className).toContain('min-w-[44px]');
  });
});
