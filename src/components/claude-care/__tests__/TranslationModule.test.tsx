/**
 * TranslationModule Tests
 *
 * Tests for translation module component:
 * - Language selection
 * - Context type selection
 * - Translation functionality
 * - Cultural notes display
 * - Cached indicator
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TranslationModule from '../TranslationModule';

// Mock dependencies
vi.mock('../../../services/claudeCareAssistant', () => ({
  ClaudeCareAssistant: {
    translate: vi.fn(),
  },
}));

import { ClaudeCareAssistant } from '../../../services/claudeCareAssistant';

const mockTranslate = ClaudeCareAssistant.translate as ReturnType<typeof vi.fn>;

describe('TranslationModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Basic Rendering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByText('Translation Context')).toBeInTheDocument();
    });

    it('should display language selectors', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('To')).toBeInTheDocument();
    });

    it('should display text input areas', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByText('Original Text')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter text to translate...')).toBeInTheDocument();
    });

    it('should display translate button', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByRole('button', { name: 'Translate' })).toBeInTheDocument();
    });

    it('should display info box', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByText('About Translation')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Context Type Selection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Context Type Selection', () => {
    it('should have medical context selected by default', () => {
      render(<TranslationModule userRole="physician" />);
      const contextSelect = screen.getAllByRole('combobox')[0];
      expect(contextSelect).toHaveValue('medical');
    });

    it('should allow changing context type', () => {
      render(<TranslationModule userRole="physician" />);
      const contextSelect = screen.getAllByRole('combobox')[0];

      fireEvent.change(contextSelect, { target: { value: 'administrative' } });
      expect(contextSelect).toHaveValue('administrative');
    });

    it('should display all context options', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByText('Medical/Clinical')).toBeInTheDocument();
      expect(screen.getByText('Administrative')).toBeInTheDocument();
      expect(screen.getByText('General Communication')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Language Selection
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Language Selection', () => {
    it('should have English as default source language', () => {
      render(<TranslationModule userRole="physician" />);
      const selects = screen.getAllByRole('combobox');
      // Source language is the second select (index 1)
      expect(selects[1]).toHaveValue('en');
    });

    it('should have Spanish as default target language', () => {
      render(<TranslationModule userRole="physician" />);
      const selects = screen.getAllByRole('combobox');
      // Target language is the third select (index 2)
      expect(selects[2]).toHaveValue('es');
    });

    it('should display swap languages button', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.getByTitle('Swap languages')).toBeInTheDocument();
    });

    it('should swap languages when swap button is clicked', () => {
      render(<TranslationModule userRole="physician" />);
      const selects = screen.getAllByRole('combobox');
      const swapButton = screen.getByTitle('Swap languages');

      // Initially: source=en, target=es
      expect(selects[1]).toHaveValue('en');
      expect(selects[2]).toHaveValue('es');

      fireEvent.click(swapButton);

      // After swap: source=es, target=en
      expect(selects[1]).toHaveValue('es');
      expect(selects[2]).toHaveValue('en');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Translation Functionality
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Translation Functionality', () => {
    it('should disable translate button when no text entered', () => {
      render(<TranslationModule userRole="physician" />);
      const translateButton = screen.getByRole('button', { name: 'Translate' });
      expect(translateButton).toBeDisabled();
    });

    it('should enable translate button when text is entered', () => {
      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');
      const translateButton = screen.getByRole('button', { name: 'Translate' });

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      expect(translateButton).not.toBeDisabled();
    });

    it('should disable translate button for whitespace-only text', () => {
      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      // Enter whitespace-only text
      fireEvent.change(textarea, { target: { value: '  ' } });
      const translateButton = screen.getByRole('button', { name: 'Translate' });

      // Button should remain disabled for whitespace-only text
      expect(translateButton).toBeDisabled();
    });

    it('should call translate API with correct parameters', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: [],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(mockTranslate).toHaveBeenCalledWith({
          sourceLanguage: 'en',
          targetLanguage: 'es',
          sourceText: 'Hello',
          contextType: 'medical',
        });
      });
    });

    it('should display translated text', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola mundo',
        culturalNotes: [],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        const translationOutput = screen.getByPlaceholderText('Translation will appear here...');
        expect(translationOutput).toHaveValue('Hola mundo');
      });
    });

    it('should show loading state during translation', async () => {
      let resolveTranslation: (value: unknown) => void;
      const translationPromise = new Promise((resolve) => {
        resolveTranslation = resolve;
      });
      mockTranslate.mockReturnValueOnce(translationPromise);

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      expect(screen.getByText('Translating...')).toBeInTheDocument();

      resolveTranslation!({ translatedText: 'Hola', culturalNotes: [], cached: false });

      await waitFor(() => {
        expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
      });
    });

    it('should show error message on translation failure', async () => {
      mockTranslate.mockRejectedValueOnce(new Error('API Error'));

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.getByText('Translation failed. Please try again.')).toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cultural Notes Display
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cultural Notes Display', () => {
    it('should display cultural notes when provided', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: ['Formal greeting in medical context', 'Use usted form'],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.getByText('Cultural Considerations')).toBeInTheDocument();
        expect(screen.getByText('Formal greeting in medical context')).toBeInTheDocument();
        expect(screen.getByText('Use usted form')).toBeInTheDocument();
      });
    });

    it('should not display cultural notes section when empty', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: [],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.queryByText('Cultural Considerations')).not.toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cached Indicator
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cached Indicator', () => {
    it('should show cached badge when translation is from cache', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: [],
        cached: true,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.getByText('Cached')).toBeInTheDocument();
      });
    });

    it('should not show cached badge when translation is fresh', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: [],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.queryByText('Cached')).not.toBeInTheDocument();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Copy Button
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Copy Button', () => {
    it('should not show copy button when no translation', () => {
      render(<TranslationModule userRole="physician" />);
      expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
    });

    it('should show copy button after translation', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'Hola',
        culturalNotes: [],
        cached: false,
      });

      render(<TranslationModule userRole="physician" />);
      const textarea = screen.getByPlaceholderText('Enter text to translate...');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
      });
    });
  });
});
