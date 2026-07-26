/**
 * useTheme Tests — display preference appliers + persistence + init read order
 *
 * Deletion Test: every test asserts DOM/class/storage/DB effects the hooks
 * produce; an empty implementation would fail all of them.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

interface MockTableResult {
  data: unknown;
  error: { message: string } | null;
}

const mockState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  tables: {} as Record<string, MockTableResult>,
  updates: [] as Array<{ table: string; payload: Record<string, unknown> }>,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      const result = mockState.tables[table] ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      const chain = ['select', 'eq'];
      for (const m of chain) builder[m] = vi.fn(() => builder);
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        mockState.updates.push({ table, payload });
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => result);
      builder.single = vi.fn(async () => result);
      builder.then = (
        onFulfilled?: (v: MockTableResult) => unknown,
        onRejected?: (r: unknown) => unknown
      ) => Promise.resolve(result).then(onFulfilled, onRejected);
      return builder;
    },
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: mockState.session },
        error: null,
      })),
    },
  },
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: { error: vi.fn(async () => undefined) },
}));

import {
  applyTheme,
  applyFontSize,
  setTheme,
  setFontSize,
  useDisplayPrefsInit,
} from '../useTheme';

describe('useTheme display preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.fontSize = '';
    mockState.session = null;
    mockState.tables = {};
    mockState.updates = [];
  });

  describe('applyTheme', () => {
    it('adds the dark class for dark and stores the choice', () => {
      applyTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem('admin_theme')).toBe('dark');
    });

    it('removes the dark class for light', () => {
      document.documentElement.classList.add('dark');
      applyTheme('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('admin_theme')).toBe('light');
    });

    it('follows system preference for auto (matchMedia mocked non-matching)', () => {
      applyTheme('auto');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem('admin_theme')).toBe('auto');
    });
  });

  describe('applyFontSize', () => {
    it('scales the root font size and stores the choice', () => {
      applyFontSize('extra-large');
      expect(document.documentElement.style.fontSize).toBe('137.5%');
      expect(localStorage.getItem('wellfit_font_size')).toBe('extra-large');

      applyFontSize('small');
      expect(document.documentElement.style.fontSize).toBe('87.5%');
    });
  });

  describe('setTheme / setFontSize persistence', () => {
    it('persists theme to profiles for a signed-in user', async () => {
      mockState.session = { user: { id: 'user-test-1' } };
      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(mockState.updates).toContainEqual({
        table: 'profiles',
        payload: { theme: 'dark' },
      });
    });

    it('skips the DB write when signed out but still applies locally', async () => {
      await setTheme('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(mockState.updates).toHaveLength(0);
    });

    it('persists font size to profiles for a signed-in user', async () => {
      mockState.session = { user: { id: 'user-test-1' } };
      await setFontSize('large');
      expect(document.documentElement.style.fontSize).toBe('112.5%');
      expect(mockState.updates).toContainEqual({
        table: 'profiles',
        payload: { font_size: 'large' },
      });
    });
  });

  describe('useDisplayPrefsInit read order', () => {
    it('applies the profiles preference over localStorage', async () => {
      localStorage.setItem('admin_theme', 'light');
      mockState.session = { user: { id: 'user-test-1' } };
      mockState.tables.profiles = {
        data: { theme: 'dark', font_size: 'large' },
        error: null,
      };

      renderHook(() => useDisplayPrefsInit());

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
      expect(document.documentElement.style.fontSize).toBe('112.5%');
    });

    it('falls back to admin_settings.theme when profiles.theme is null', async () => {
      mockState.session = { user: { id: 'admin-test-1' } };
      mockState.tables.profiles = { data: { theme: null, font_size: null }, error: null };
      mockState.tables.admin_settings = { data: { theme: 'dark' }, error: null };

      renderHook(() => useDisplayPrefsInit());

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
    });

    it('uses localStorage when signed out', async () => {
      localStorage.setItem('admin_theme', 'dark');
      localStorage.setItem('wellfit_font_size', 'extra-large');

      renderHook(() => useDisplayPrefsInit());

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });
      expect(document.documentElement.style.fontSize).toBe('137.5%');
    });
  });
});
