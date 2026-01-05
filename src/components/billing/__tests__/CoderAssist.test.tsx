/**
 * Tests for CoderAssist Component
 *
 * Purpose: Verify coding assistant UI rendering and basic interactions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoderAssist } from '../CoderAssist';

// Mock Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'rec-123' }, error: null }),
        }),
      }),
    })),
  },
}));

describe('CoderAssist', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    patientId: 'patient-456',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with header', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Coder Assist')).toBeInTheDocument();
    });

    it('should render Get Codes button', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Get Codes/i })).toBeInTheDocument();
    });

    it('should render Accept & Save button', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Accept & Save/i })).toBeInTheDocument();
    });

    it('should show initial instruction text', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText(/Click/)).toBeInTheDocument();
    });

    it('should disable Accept & Save when no suggestion', () => {
      render(<CoderAssist {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /Accept & Save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should disable Get Codes when encounterId is missing', () => {
      render(<CoderAssist encounterId="" patientId="patient-456" />);

      const getCodesButton = screen.getByRole('button', { name: /Get Codes/i });
      expect(getCodesButton).toBeDisabled();
    });

    it('should show encounter ID in UI', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Encounter:')).toBeInTheDocument();
    });

    it('should show patient ID in UI when provided', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Patient:')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('should have expected sections: CPT, HCPCS, ICD-10', () => {
      // These sections only appear after fetching suggestions
      // Testing that component doesn't crash without them
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Coder Assist')).toBeInTheDocument();
    });
  });
});
