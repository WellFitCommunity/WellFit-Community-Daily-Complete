/**
 * Tests for CoderAssist Component
 *
 * Purpose: Verify coding assistant UI rendering and functionality
 * Coverage: Rendering, API interactions, code sections, error handling, saving
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

import { supabase } from '../../../lib/supabaseClient';

describe('CoderAssist', () => {
  const defaultProps = {
    encounterId: 'encounter-123',
    patientId: 'patient-456',
  };

  const mockSuggestion = {
    cpt: [
      { code: '99213', modifiers: ['25'], rationale: 'Office or outpatient visit, established patient' },
      { code: '90834', modifiers: [], rationale: 'Psychotherapy, 45 minutes' },
    ],
    hcpcs: [
      { code: 'G2211', modifiers: [], rationale: 'Complex visit add-on' },
    ],
    icd10: [
      { code: 'I10', rationale: 'Essential hypertension', principal: true },
      { code: 'E11.9', rationale: 'Type 2 diabetes mellitus', principal: false },
    ],
    notes: 'Multiple chronic conditions documented',
    confidence: 87,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: mockSuggestion, error: null });
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'rec-123' }, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render component with title "Coder Assist"', () => {
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
      expect(screen.getByText(/to generate CPT\/HCPCS\/ICD-10 suggestions/)).toBeInTheDocument();
    });
  });

  describe('Encounter ID and Patient ID Pills', () => {
    it('should show encounter ID in UI', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Encounter:')).toBeInTheDocument();
      // Pills show first 8 characters
      expect(screen.getByText('encounte')).toBeInTheDocument();
    });

    it('should show patient ID in UI when provided', () => {
      render(<CoderAssist {...defaultProps} />);

      expect(screen.getByText('Patient:')).toBeInTheDocument();
      // Pills show first 8 characters
      expect(screen.getByText('patient-')).toBeInTheDocument();
    });

    it('should not show patient ID when not provided', () => {
      render(<CoderAssist encounterId="encounter-123" />);

      expect(screen.queryByText('Patient:')).not.toBeInTheDocument();
    });
  });

  describe('Get Codes Button', () => {
    it('should be enabled when encounterId is provided', () => {
      render(<CoderAssist {...defaultProps} />);

      const getCodesButton = screen.getByRole('button', { name: /Get Codes/i });
      expect(getCodesButton).not.toBeDisabled();
    });

    it('should be disabled when encounterId is missing', () => {
      render(<CoderAssist encounterId="" patientId="patient-456" />);

      const getCodesButton = screen.getByRole('button', { name: /Get Codes/i });
      expect(getCodesButton).toBeDisabled();
    });

    it('should trigger API call when clicked', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(supabase.functions.invoke).toHaveBeenCalledWith('coding-suggest', {
          body: {
            encounter: {
              id: 'encounter-123',
            },
          },
        });
      });
    });

    it('should show "Analyzing..." while loading', async () => {
      vi.mocked(supabase.functions.invoke).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Analyzing…/)).toBeInTheDocument();
      });
    });
  });

  describe('Accept & Save Button', () => {
    it('should be disabled without suggestion', () => {
      render(<CoderAssist {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: /Accept & Save/i });
      expect(saveButton).toBeDisabled();
    });

    it('should be enabled after getting suggestions', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Accept & Save/i });
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('should show "Saving..." while saving', async () => {
      // First mock: get codes succeeds
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({ data: mockSuggestion, error: null });

      // Second mock: save never resolves
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => new Promise(() => {})),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      render(<CoderAssist {...defaultProps} />);

      // Get codes first
      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));
      await waitFor(() => {
        expect(screen.getByText('99213')).toBeInTheDocument();
      });

      // Click save
      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(screen.getByText(/Saving…/)).toBeInTheDocument();
      });
    });
  });

  describe('Code Sections Display', () => {
    beforeEach(async () => {
      render(<CoderAssist {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));
      await waitFor(() => {
        expect(screen.getByText('CPT')).toBeInTheDocument();
      });
    });

    it('should display CPT section', () => {
      expect(screen.getByText('CPT')).toBeInTheDocument();
    });

    it('should display HCPCS section', () => {
      expect(screen.getByText('HCPCS')).toBeInTheDocument();
    });

    it('should display ICD-10 section', () => {
      expect(screen.getByText('ICD-10')).toBeInTheDocument();
    });

    it('should display CPT codes', () => {
      expect(screen.getByText('99213')).toBeInTheDocument();
      expect(screen.getByText('90834')).toBeInTheDocument();
    });

    it('should display HCPCS codes', () => {
      expect(screen.getByText('G2211')).toBeInTheDocument();
    });

    it('should display ICD-10 codes', () => {
      expect(screen.getByText('I10')).toBeInTheDocument();
      expect(screen.getByText('E11.9')).toBeInTheDocument();
    });

    it('should display Principal badge for principal diagnosis', () => {
      expect(screen.getByText('Principal')).toBeInTheDocument();
    });

    it('should display modifiers for CPT codes', () => {
      expect(screen.getByText(/Mod: 25/)).toBeInTheDocument();
    });
  });

  describe('Confidence Percentage Display', () => {
    it('should display confidence percentage', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText('87%')).toBeInTheDocument();
      });
    });

    it('should display confidence label', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Confidence:/)).toBeInTheDocument();
      });
    });

    it('should display notes if present', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Notes:/)).toBeInTheDocument();
        // Use getAllByText since notes appear in both the display and raw JSON
        const notesMatches = screen.getAllByText(/Multiple chronic conditions documented/);
        expect(notesMatches.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on failure', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'Service unavailable' },
      });

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Service unavailable/)).toBeInTheDocument();
      });
    });

    it('should show generic error message on network failure', async () => {
      vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network error'));

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('should show error message in styled error box', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: 'API Error' },
      });

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        const errorBox = screen.getByText(/API Error/).closest('div');
        expect(errorBox).toHaveClass('bg-red-50');
      });
    });
  });

  describe('Raw JSON Preview', () => {
    it('should have Raw JSON toggle after getting suggestions', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText('Raw JSON')).toBeInTheDocument();
      });
    });

    it('should expand to show raw JSON when clicked', async () => {
      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText('Raw JSON')).toBeInTheDocument();
      });

      // Click on the details/summary element
      const summary = screen.getByText('Raw JSON');
      fireEvent.click(summary);

      // Should show formatted JSON
      await waitFor(() => {
        expect(screen.getByText(/"cpt"/)).toBeInTheDocument();
      });
    });
  });

  describe('Saving Suggestion', () => {
    it('should save to coding_recommendations table', async () => {
      render(<CoderAssist {...defaultProps} />);

      // Get codes
      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));
      await waitFor(() => {
        expect(screen.getByText('99213')).toBeInTheDocument();
      });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(supabase.from).toHaveBeenCalledWith('coding_recommendations');
      });
    });

    it('should call onSaved callback after saving', async () => {
      const onSaved = vi.fn();
      render(<CoderAssist {...defaultProps} onSaved={onSaved} />);

      // Get codes
      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));
      await waitFor(() => {
        expect(screen.getByText('99213')).toBeInTheDocument();
      });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(onSaved).toHaveBeenCalledWith('rec-123');
      });
    });

    it('should show error on save failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Save failed' } }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      render(<CoderAssist {...defaultProps} />);

      // Get codes
      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));
      await waitFor(() => {
        expect(screen.getByText('99213')).toBeInTheDocument();
      });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Accept & Save/i }));

      await waitFor(() => {
        expect(screen.getByText(/Save failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty Suggestions', () => {
    it('should show "No CPT suggestions" when empty', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { cpt: [], hcpcs: [], icd10: [], confidence: 50 },
        error: null,
      });

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/No CPT suggestions/)).toBeInTheDocument();
      });
    });

    it('should show "No HCPCS suggestions" when empty', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { cpt: [], hcpcs: [], icd10: [], confidence: 50 },
        error: null,
      });

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/No HCPCS suggestions/)).toBeInTheDocument();
      });
    });

    it('should show "No ICD-10 suggestions" when empty', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { cpt: [], hcpcs: [], icd10: [], confidence: 50 },
        error: null,
      });

      render(<CoderAssist {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Get Codes/i }));

      await waitFor(() => {
        expect(screen.getByText(/No ICD-10 suggestions/)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible Get Codes button', () => {
      render(<CoderAssist {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Get Codes/i });
      expect(button).toBeInTheDocument();
    });

    it('should have accessible Accept & Save button', () => {
      render(<CoderAssist {...defaultProps} />);

      const button = screen.getByRole('button', { name: /Accept & Save/i });
      expect(button).toBeInTheDocument();
    });
  });
});
