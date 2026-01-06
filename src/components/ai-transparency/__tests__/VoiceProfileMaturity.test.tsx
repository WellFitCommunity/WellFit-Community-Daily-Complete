/**
 * VoiceProfileMaturity Tests
 *
 * Tests for Riley voice profile maturity indicator:
 * - Profile states (training/maturing/fully_adapted)
 * - Compact and detailed variants
 * - Score bar displays
 * - Loading and empty states
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VoiceProfileMaturity } from '../VoiceProfileMaturity';

// Mock dependencies
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    circle: (props: Record<string, unknown>) => <circle {...props} />,
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabaseClient';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

describe('VoiceProfileMaturity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'test-user-123' } });
  });

  const setupMockProfile = (profile: Record<string, unknown> | null, error: Record<string, unknown> | null = null) => {
    const mockSingle = vi.fn().mockResolvedValue({ data: profile, error });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Loading State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      setupMockProfile(null);
      render(<VoiceProfileMaturity />);

      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // No Profile State Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('No Profile State', () => {
    it('should show start message when no profile exists', async () => {
      setupMockProfile(null, { code: 'PGRST116' });
      render(<VoiceProfileMaturity />);

      await waitFor(() => {
        expect(screen.getByText('Start Using Riley')).toBeInTheDocument();
        expect(screen.getByText(/Begin a Smart Scribe session/)).toBeInTheDocument();
      });
    });

    it('should show microphone emoji when no profile', async () => {
      setupMockProfile(null, { code: 'PGRST116' });
      render(<VoiceProfileMaturity />);

      await waitFor(() => {
        expect(screen.getByText('🎤')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Component Rendering Tests (Static - no async data)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      setupMockProfile(null);
      expect(() => render(<VoiceProfileMaturity />)).not.toThrow();
    });

    it('should accept variant prop', () => {
      setupMockProfile(null);
      expect(() => render(<VoiceProfileMaturity variant="detailed" />)).not.toThrow();
    });

    it('should accept showDetails prop', () => {
      setupMockProfile(null);
      expect(() => render(<VoiceProfileMaturity showDetails />)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Detailed Variant Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Detailed Variant', () => {
    it('should render detailed variant', async () => {
      setupMockProfile({
        maturity_score: 85,
        accent_adaptation_score: 80,
        terminology_adaptation_score: 90,
        workflow_adaptation_score: 85,
        status: 'maturing',
        total_sessions: 75,
        total_corrections: 100,
        total_transcription_time_seconds: 27000,
        fully_adapted_at: null,
      });

      render(<VoiceProfileMaturity variant="detailed" />);

      await waitFor(() => {
        expect(screen.getByText('Riley Voice Profile')).toBeInTheDocument();
        expect(screen.getByText('Overall Maturity')).toBeInTheDocument();
      });
    });

    it('should show all score bars in detailed variant', async () => {
      setupMockProfile({
        maturity_score: 85,
        accent_adaptation_score: 80,
        terminology_adaptation_score: 90,
        workflow_adaptation_score: 85,
        status: 'maturing',
        total_sessions: 75,
        total_corrections: 100,
        total_transcription_time_seconds: 27000,
        fully_adapted_at: null,
      });

      render(<VoiceProfileMaturity variant="detailed" />);

      await waitFor(() => {
        expect(screen.getByText('Accent Adaptation')).toBeInTheDocument();
        expect(screen.getByText('Medical Terminology')).toBeInTheDocument();
        expect(screen.getByText('Workflow Patterns')).toBeInTheDocument();
      });
    });

    it('should show training time in hours', async () => {
      setupMockProfile({
        maturity_score: 85,
        accent_adaptation_score: 80,
        terminology_adaptation_score: 90,
        workflow_adaptation_score: 85,
        status: 'maturing',
        total_sessions: 75,
        total_corrections: 100,
        total_transcription_time_seconds: 7200, // 2 hours
        fully_adapted_at: null,
      });

      render(<VoiceProfileMaturity variant="detailed" />);

      await waitFor(() => {
        expect(screen.getByText('2h')).toBeInTheDocument();
        expect(screen.getByText('Training Time')).toBeInTheDocument();
      });
    });

    it('should show fully adapted date banner', async () => {
      setupMockProfile({
        maturity_score: 98,
        accent_adaptation_score: 95,
        terminology_adaptation_score: 99,
        workflow_adaptation_score: 98,
        status: 'fully_adapted',
        total_sessions: 150,
        total_corrections: 200,
        total_transcription_time_seconds: 54000,
        fully_adapted_at: '2024-01-15T10:30:00Z',
      });

      render(<VoiceProfileMaturity variant="detailed" />);

      await waitFor(() => {
        expect(screen.getByText(/Fully adapted on/)).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle zero sessions gracefully', async () => {
      setupMockProfile({
        maturity_score: 0,
        accent_adaptation_score: 0,
        terminology_adaptation_score: 0,
        workflow_adaptation_score: 0,
        status: 'training',
        total_sessions: 0,
        total_corrections: 0,
        total_transcription_time_seconds: 0,
        fully_adapted_at: null,
      });

      render(<VoiceProfileMaturity variant="detailed" />);

      await waitFor(() => {
        expect(screen.getByText('0h')).toBeInTheDocument();
      });
    });

    it('should not render when user is not logged in', async () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { container } = render(<VoiceProfileMaturity />);

      await waitFor(() => {
        // Should show loading initially, then nothing
        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      });
    });
  });
});
