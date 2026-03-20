// ============================================================================
// LanguageSwitcher — P3-4 Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageSwitcher, useResilienceLanguage } from '../LanguageSwitcher';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock window.location.reload
const reloadMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadMock },
  writable: true,
});

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorageMock.clear();
  });

  describe('Default State', () => {
    it('defaults to English when no language is saved', () => {
      render(<LanguageSwitcher />);
      expect(screen.getByText('English')).toBeInTheDocument();
      expect(screen.getByText('🇺🇸')).toBeInTheDocument();
    });

    it('shows "Language" label in English', () => {
      render(<LanguageSwitcher />);
      expect(screen.getByText('Language')).toBeInTheDocument();
    });

    it('has accessible aria-label', () => {
      render(<LanguageSwitcher />);
      expect(screen.getByRole('button', { name: /Switch to Spanish/ })).toBeInTheDocument();
    });
  });

  describe('Spanish State', () => {
    it('shows Spanish when saved in localStorage', () => {
      localStorageMock.getItem.mockReturnValue('es');
      render(<LanguageSwitcher />);
      expect(screen.getByText('Español')).toBeInTheDocument();
      expect(screen.getByText('🇲🇽')).toBeInTheDocument();
    });

    it('shows "Idioma" label in Spanish', () => {
      localStorageMock.getItem.mockReturnValue('es');
      render(<LanguageSwitcher />);
      expect(screen.getByText('Idioma')).toBeInTheDocument();
    });

    it('has aria-label to switch to English', () => {
      localStorageMock.getItem.mockReturnValue('es');
      render(<LanguageSwitcher />);
      expect(screen.getByRole('button', { name: /Switch to English/ })).toBeInTheDocument();
    });
  });

  describe('Toggle Behavior', () => {
    it('saves new language to localStorage on toggle', () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole('button'));
      expect(localStorageMock.setItem).toHaveBeenCalledWith('wellfit_resilience_language', 'es');
    });

    it('reloads page after toggle to apply translations', () => {
      render(<LanguageSwitcher />);
      fireEvent.click(screen.getByRole('button'));
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom className', () => {
    it('applies custom className to button', () => {
      render(<LanguageSwitcher className="ml-4" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('ml-4');
    });
  });
});

describe('useResilienceLanguage hook', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('returns "en" by default', () => {
    let result: string = '';
    const TestComponent = () => {
      result = useResilienceLanguage();
      return <div>{result}</div>;
    };
    render(<TestComponent />);
    expect(result).toBe('en');
  });

  it('returns saved language from localStorage', () => {
    localStorageMock.getItem.mockReturnValue('es');
    let result: string = '';
    const TestComponent = () => {
      result = useResilienceLanguage();
      return <div>{result}</div>;
    };
    render(<TestComponent />);
    expect(result).toBe('es');
  });
});
