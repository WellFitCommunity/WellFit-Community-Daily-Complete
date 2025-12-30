/**
 * Tests for ClinicalModeComponents
 *
 * ATLUS: Unity - Verifies clinical mode components render correctly
 * for clinical users and are hidden from community users.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClinicalModeComponents } from '../ClinicalModeComponents';

// ============================================================================
// MOCKS
// ============================================================================

// Mock all clinical components
vi.mock('../../admin/VoiceCommandBar', () => ({
  VoiceCommandBar: () => <div data-testid="voice-command-bar">VoiceCommandBar</div>,
}));

vi.mock('../../voice/VoiceCommandButton', () => ({
  VoiceCommandButton: () => <div data-testid="voice-command-button">VoiceCommandButton</div>,
}));

vi.mock('../../voice/VoiceSearchOverlay', () => ({
  VoiceSearchOverlay: () => <div data-testid="voice-search-overlay">VoiceSearchOverlay</div>,
}));

vi.mock('../../search/GlobalSearchBar', () => ({
  GlobalSearchBar: () => <div data-testid="global-search-bar">GlobalSearchBar</div>,
}));

vi.mock('../../envision-atlus/EASessionResume', () => ({
  EASessionResume: () => <div data-testid="ea-session-resume">EASessionResume</div>,
}));

vi.mock('../../envision-atlus/EANotificationDock', () => ({
  EANotificationDock: () => <div data-testid="ea-notification-dock">EANotificationDock</div>,
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

describe('ClinicalModeComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering for Clinical Users', () => {
    it('should render all clinical components when user is clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      render(<ClinicalModeComponents />);

      expect(screen.getByTestId('voice-command-bar')).toBeInTheDocument();
      expect(screen.getByTestId('voice-command-button')).toBeInTheDocument();
      expect(screen.getByTestId('voice-search-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('global-search-bar')).toBeInTheDocument();
      expect(screen.getByTestId('ea-session-resume')).toBeInTheDocument();
      expect(screen.getByTestId('ea-notification-dock')).toBeInTheDocument();
    });

    it('should wrap GlobalSearchBar in fixed positioning container', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      const { container } = render(<ClinicalModeComponents />);

      const fixedContainer = container.querySelector('.fixed.top-4.right-4.z-50');
      expect(fixedContainer).toBeInTheDocument();
      expect(fixedContainer).toContainElement(screen.getByTestId('global-search-bar'));
    });
  });

  describe('Rendering for Non-Clinical Users', () => {
    it('should render nothing when user is not clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      const { container } = render(<ClinicalModeComponents />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('voice-command-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('voice-command-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('global-search-bar')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should render nothing while loading', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container } = render(<ClinicalModeComponents />);

      expect(container.firstChild).toBeNull();
    });

    it('should render nothing when loading even if not clinical', () => {
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        loading: true,
      }));

      const { container } = render(<ClinicalModeComponents />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should show components after loading completes for clinical user', () => {
      // Start with loading
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: true,
      }));

      const { container, rerender } = render(<ClinicalModeComponents />);
      expect(container.firstChild).toBeNull();

      // Finish loading
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: true,
        loading: false,
      }));

      rerender(<ClinicalModeComponents />);
      expect(screen.getByTestId('voice-command-bar')).toBeInTheDocument();
    });

    it('should remain hidden after loading completes for non-clinical user', () => {
      // Start with loading
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        loading: true,
      }));

      const { container, rerender } = render(<ClinicalModeComponents />);
      expect(container.firstChild).toBeNull();

      // Finish loading
      mockedUseClinicalMode.mockReturnValue(createClinicalModeInfo({
        isClinical: false,
        isCommunity: true,
        loading: false,
      }));

      rerender(<ClinicalModeComponents />);
      expect(container.firstChild).toBeNull();
    });
  });
});
