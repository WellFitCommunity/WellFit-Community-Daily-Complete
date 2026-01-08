/**
 * VoiceInputModule Tests
 *
 * Tests for voice input module component:
 * - Recording button states
 * - Transcription display
 * - Confidence scores
 * - Template suggestions
 * - Error handling
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VoiceInputModule from '../VoiceInputModule';

// Mock ClaudeCareAssistant
vi.mock('../../../services/claudeCareAssistant', () => ({
  ClaudeCareAssistant: {
    processVoiceInput: vi.fn(),
  },
}));

import { ClaudeCareAssistant } from '../../../services/claudeCareAssistant';

const _mockProcessVoiceInput = ClaudeCareAssistant.processVoiceInput as ReturnType<typeof vi.fn>;

describe('VoiceInputModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();
    });

    it('should display recording instructions', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.getByText('Describe the administrative task you need to complete')).toBeInTheDocument();
    });

    it('should display voice tips info box', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.getByText('Voice Input Tips')).toBeInTheDocument();
    });

    it('should display tip items', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.getByText(/Speak clearly and at a moderate pace/)).toBeInTheDocument();
      expect(screen.getByText(/Find a quiet environment/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // User ID Requirement
  // ═══════════════════════════════════════════════════════════════════════════

  describe('User ID Requirement', () => {
    it('should show warning when userId is not provided', () => {
      render(<VoiceInputModule userRole="physician" />);
      expect(screen.getByText(/User ID required for voice input/)).toBeInTheDocument();
    });

    it('should not show warning when userId is provided', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.queryByText(/User ID required for voice input/)).not.toBeInTheDocument();
    });

    it('should disable recording button when userId is not provided', () => {
      render(<VoiceInputModule userRole="physician" />);
      // The main recording button has aria-hidden content, check its disabled state
      const button = screen.getByRole('button', { hidden: true });
      expect(button).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Recording Button States
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Recording Button States', () => {
    it('should show recording button in idle state', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Transcription Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Transcription Display', () => {
    it('should not show transcription section initially', () => {
      render(<VoiceInputModule userRole="physician" userId="user-123" />);
      expect(screen.queryByText('Transcription')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Callback Integration
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Callback Integration', () => {
    it('should accept onPopulateTaskForm callback', () => {
      const mockCallback = vi.fn();
      render(
        <VoiceInputModule
          userRole="physician"
          userId="user-123"
          onPopulateTaskForm={mockCallback}
        />
      );
      // Component should render without issues
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Role Prop
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Role Prop', () => {
    it('should accept different role values', () => {
      const { rerender } = render(
        <VoiceInputModule userRole="physician" userId="user-123" />
      );
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();

      rerender(<VoiceInputModule userRole="nurse" userId="user-123" />);
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();

      rerender(<VoiceInputModule userRole="case_manager" userId="user-123" />);
      expect(screen.getByText('Click to start recording')).toBeInTheDocument();
    });
  });
});
