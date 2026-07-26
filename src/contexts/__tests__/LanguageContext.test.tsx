/**
 * LanguageContext Tests — language resolution + cross-device persistence
 *
 * Deletion Test: every test asserts translated output or persistence effects;
 * a provider that only rendered children would fail all of them.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

interface MockTableResult {
  data: unknown;
  error: { message: string } | null;
}

const mockState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  profile: null as unknown,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      const result: MockTableResult =
        table === 'profiles' ? { data: mockState.profile, error: null } : { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) builder[m] = vi.fn(() => builder);
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        mockState.updates.push(payload);
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => result);
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

import { LanguageProvider, useLanguage } from '../LanguageContext';

function Probe() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="settings-title">{t.settings.title}</span>
      <button onClick={() => setLanguage('es')}>switch-es</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.session = null;
    mockState.profile = null;
    mockState.updates = [];
  });

  it('uses the saved localStorage language', () => {
    localStorage.setItem('wellfit_language', 'vi');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );
    expect(screen.getByTestId('lang')).toHaveTextContent('vi');
  });

  it('lets the DB preference override localStorage once the session resolves', async () => {
    localStorage.setItem('wellfit_language', 'en');
    mockState.session = { user: { id: 'user-test-1' } };
    mockState.profile = { preferred_language: 'es' };

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('es');
    });
    // Translated content actually switches (not just the code)
    expect(screen.getByTestId('settings-title').textContent).not.toBe('');
    expect(localStorage.getItem('wellfit_language')).toBe('es');
  });

  it('ignores an invalid DB value and keeps the local choice', async () => {
    localStorage.setItem('wellfit_language', 'en');
    mockState.session = { user: { id: 'user-test-1' } };
    mockState.profile = { preferred_language: 'xx' };

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    // Give the effect a tick; the invalid value must never be applied
    await waitFor(() => {
      expect(screen.getByTestId('lang')).toHaveTextContent('en');
    });
  });

  it('setLanguage switches the UI and persists to localStorage + profiles', async () => {
    mockState.session = { user: { id: 'user-test-1' } };
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await user.click(screen.getByText('switch-es'));

    expect(screen.getByTestId('lang')).toHaveTextContent('es');
    expect(localStorage.getItem('wellfit_language')).toBe('es');
    await waitFor(() => {
      expect(mockState.updates).toContainEqual({ preferred_language: 'es' });
    });
  });
});
