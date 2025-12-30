/**
 * Tests for ClinicalPatientBanner
 *
 * ATLUS: Unity - Verifies patient banner renders correctly
 * for clinical users and is hidden from community users.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClinicalPatientBanner } from '../ClinicalPatientBanner';

// ============================================================================
// MOCKS
// ============================================================================

// Mock EAPatientBanner
vi.mock('../../envision-atlus/EAPatientBanner', () => ({
  EAPatientBanner: ({ className }: { className?: string }) => (
    <div data-testid="ea-patient-banner" className={className}>
      EAPatientBanner
    </div>
  ),
}));

// Mock useClinicalMode hook
vi.mock('../../../hooks/useClinicalMode', () => ({
  useClinicalMode: vi.fn(),
}));

import { useClinicalMode, ClinicalModeInfo } from '../../../hooks/useClinicalMode';
const mockedUseClinicalMode = vi.mocked(useClinicalMode);

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

const createClinicalModeInfo = (overrides: Partial<ClinicalModeInfo> = {}): ClinicalModeInfo => ({
  isClinical: false,
  isCommunity: false,
  isCaregiver: false,
  isAdmin: false,
  role: null,
  roleCode: null,
  loading: false,
  ...overrides,
});

// ============================================================================
// TESTS
// ============================================================================

describe('ClinicalPatientBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering for Clinical Users', () => {
    it('should render patient banner when user is clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      render(<ClinicalPatientBanner />);

      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('should pass className prop to EAPatientBanner', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      render(<ClinicalPatientBanner className="sticky top-0 z-40" />);

      const banner = screen.getByTestId('ea-patient-banner');
      expect(banner).toHaveClass('sticky');
      expect(banner).toHaveClass('top-0');
      expect(banner).toHaveClass('z-40');
    });

    it('should render without className when not provided', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      render(<ClinicalPatientBanner />);

      const banner = screen.getByTestId('ea-patient-banner');
      expect(banner).toBeInTheDocument();
      expect(banner.className).toBe('');
    });
  });

  describe('Rendering for Non-Clinical Users', () => {
    it('should render nothing when user is not clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      const { container } = render(<ClinicalPatientBanner />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('ea-patient-banner')).not.toBeInTheDocument();
    });

    it('should render nothing for community users even with className', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      const { container } = render(<ClinicalPatientBanner className="sticky top-0" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Loading State', () => {
    it('should render nothing while loading for clinical users', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container } = render(<ClinicalPatientBanner />);

      expect(container.firstChild).toBeNull();
    });

    it('should render nothing while loading for non-clinical users', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        loading: true,
      }));

      const { container } = render(<ClinicalPatientBanner />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should show banner after loading completes for clinical user', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container, rerender } = render(<ClinicalPatientBanner />);
      expect(container.firstChild).toBeNull();

      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      rerender(<ClinicalPatientBanner />);
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('should remain hidden after loading completes for non-clinical user', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        loading: true,
      }));

      const { container, rerender } = render(<ClinicalPatientBanner />);
      expect(container.firstChild).toBeNull();

      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      rerender(<ClinicalPatientBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('should hide banner when user mode changes from clinical to non-clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      const { container, rerender } = render(<ClinicalPatientBanner />);
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();

      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      rerender(<ClinicalPatientBanner />);
      expect(container.firstChild).toBeNull();
    });
  });
});
