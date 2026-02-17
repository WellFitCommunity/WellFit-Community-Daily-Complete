/**
 * Tests for ClinicalPatientBanner
 *
 * ATLUS: Unity - Verifies patient banner renders correctly
 * for clinical users on clinical routes and is hidden from community routes.
 * Boundary enforcement: avatar never leaks into WellFit community UI.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
// HELPERS
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

/** Render component wrapped in a MemoryRouter at the given route */
function renderAtRoute(route: string, className?: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ClinicalPatientBanner className={className} />
    </MemoryRouter>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('ClinicalPatientBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Clinical user on clinical routes — banner visible', () => {
    beforeEach(() => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));
    });

    it('shows banner on /admin route', () => {
      renderAtRoute('/admin');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('shows banner on /nurse-dashboard route', () => {
      renderAtRoute('/nurse-dashboard');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('shows banner on /physician-dashboard route', () => {
      renderAtRoute('/physician-dashboard');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('shows banner on /patient-avatar/:patientId route', () => {
      renderAtRoute('/patient-avatar/abc-123');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('shows banner on /nurse-census route', () => {
      renderAtRoute('/nurse-census');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('shows banner on /shift-handoff route', () => {
      renderAtRoute('/shift-handoff');
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('passes className prop to EAPatientBanner', () => {
      renderAtRoute('/admin', 'sticky top-0 z-40');
      const banner = screen.getByTestId('ea-patient-banner');
      expect(banner).toHaveClass('sticky');
      expect(banner).toHaveClass('top-0');
      expect(banner).toHaveClass('z-40');
    });
  });

  describe('Clinical user on community routes — banner hidden (boundary enforcement)', () => {
    beforeEach(() => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        isAdmin: true,
        loading: false,
      }));
    });

    it('hides banner on /dashboard (WellFit community)', () => {
      const { container } = renderAtRoute('/dashboard');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /check-in (WellFit community)', () => {
      const { container } = renderAtRoute('/check-in');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /my-health (WellFit community)', () => {
      const { container } = renderAtRoute('/my-health');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /community (WellFit community)', () => {
      const { container } = renderAtRoute('/community');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /settings (WellFit community)', () => {
      const { container } = renderAtRoute('/settings');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /profile (WellFit community)', () => {
      const { container } = renderAtRoute('/profile');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on / (public landing)', () => {
      const { container } = renderAtRoute('/');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner on /caregiver-dashboard', () => {
      const { container } = renderAtRoute('/caregiver-dashboard');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });
  });

  describe('Non-clinical user — banner always hidden', () => {
    beforeEach(() => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));
    });

    it('hides banner for community user on community route', () => {
      const { container } = renderAtRoute('/dashboard');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner for community user even on clinical route', () => {
      const { container } = renderAtRoute('/admin');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });
  });

  describe('Loading state', () => {
    it('hides banner while loading on clinical route', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container } = renderAtRoute('/admin');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });

    it('hides banner while loading on community route', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        loading: true,
      }));

      const { container } = renderAtRoute('/dashboard');
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });
  });

  describe('State transitions', () => {
    it('shows banner after loading completes for clinical user on clinical route', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container, rerender } = render(
        <MemoryRouter initialEntries={['/nurse-dashboard']}>
          <ClinicalPatientBanner />
        </MemoryRouter>
      );
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();

      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      rerender(
        <MemoryRouter initialEntries={['/nurse-dashboard']}>
          <ClinicalPatientBanner />
        </MemoryRouter>
      );
      expect(screen.getByTestId('ea-patient-banner')).toBeInTheDocument();
    });

    it('remains hidden after loading for clinical user on community route', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container, rerender } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ClinicalPatientBanner />
        </MemoryRouter>
      );
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();

      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      rerender(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ClinicalPatientBanner />
        </MemoryRouter>
      );
      expect(container.querySelector('[data-testid="ea-patient-banner"]')).toBeNull();
    });
  });
});
