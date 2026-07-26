/**
 * SettingsPage Tests — load, live theme/text-size preview, save round-trip
 *
 * Deletion Test: every test asserts loaded profile values, DOM side effects of
 * the display controls, or the exact save payload; an empty <div /> fails all.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { translations } from '../../i18n/translations';

const mockNavigate = vi.fn();
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/settings' }),
}));

vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      gradient: 'linear-gradient(to right, #003865, #8cc63f)',
      primaryColor: '#003865',
      appName: 'WellFit',
    },
  }),
}));

const mockPageState = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  loadError: null as { message: string } | null,
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../contexts/AuthContext', () => {
  // Stable client identity — the page's load effect depends on it, and a fresh
  // object per render would re-run the load and reset in-progress edits.
  const stableClient = {
    from: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) builder[m] = vi.fn(() => builder);
      builder.update = vi.fn((payload: Record<string, unknown>) => {
        mockPageState.updates.push(payload);
        return builder;
      });
      builder.single = vi.fn(async () => ({
        data: mockPageState.loadError ? null : mockPageState.profile,
        error: mockPageState.loadError,
      }));
      builder.then = (onF?: (v: unknown) => unknown, onR?: (r: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onF, onR);
      return builder;
    }),
  };
  return {
    useUser: () => ({
      id: 'user-test-1',
      email: 'test.patient.alpha@example.com',
      created_at: '2026-01-01T00:00:00Z',
    }),
    useSupabaseClient: () => stableClient,
  };
});

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: translations.en,
  }),
}));

// Heavy child components with their own data dependencies — stubbed
vi.mock('../../components/PasskeySetup', () => ({
  __esModule: true,
  default: () => <div data-testid="passkey-setup" />,
}));
vi.mock('../../components/CaregiverAccessHistory', () => ({
  __esModule: true,
  default: () => <div data-testid="caregiver-access-history" />,
}));
vi.mock('../../components/LanguageSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="language-selector" />,
}));
vi.mock('../../components/ui/SmartBackButton', () => ({
  __esModule: true,
  default: ({ label }: { label: string }) => <button>{label}</button>,
}));

// useTheme's own supabase/auditLogger imports
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() })),
    auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) },
  },
}));
vi.mock('../../services/auditLogger', () => ({
  auditLogger: { error: vi.fn(async () => undefined) },
}));

import SettingsPage from '../SettingsPage';

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.fontSize = '';
    mockPageState.loadError = null;
    mockPageState.updates = [];
    mockPageState.profile = {
      font_size: 'large',
      theme: 'light',
      notifications_enabled: true,
      emergency_contact_name: 'Test Contact Alpha',
      emergency_contact_phone: '555-0100',
      first_name: 'Test Patient Alpha',
      timezone: 'America/Chicago',
      daily_reminder_time: '08:30',
      care_team_notifications: true,
      community_notifications: false,
    };
  });

  it('renders the loaded profile values in the display section', async () => {
    render(<SettingsPage />);

    // Display section is open by default; the loaded font size is selected
    const largeButton = await screen.findByRole('button', { name: 'Large' });
    expect(largeButton.className).toContain('bg-[#8cc63f]');
  });

  it('selecting Dark applies the dark class immediately (live preview)', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const darkButton = await screen.findByRole('button', { name: /Dark/ });
    await user.click(darkButton);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('selecting a text size scales the document root immediately', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const xlButton = await screen.findByRole('button', { name: 'Extra Large' });
    await user.click(xlButton);

    expect(document.documentElement.style.fontSize).toBe('137.5%');
  });

  it('save writes the full settings payload including theme', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const darkButton = await screen.findByRole('button', { name: /Dark/ });
    await user.click(darkButton);

    const saveButtons = screen.getAllByRole('button', { name: /Save All Settings/ });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(mockPageState.updates.length).toBeGreaterThan(0);
    });
    expect(mockPageState.updates[0]).toMatchObject({
      theme: 'dark',
      font_size: 'large',
      timezone: 'America/Chicago',
      daily_reminder_time: '08:30',
      community_notifications: false,
    });
    // Success feedback reaches the user
    expect(await screen.findByText(translations.en.settings.saveSuccess)).toBeInTheDocument();
  });

  it('surfaces a load failure instead of swallowing it', async () => {
    mockPageState.loadError = { message: 'permission denied' };
    render(<SettingsPage />);

    expect(await screen.findByText(translations.en.settings.saveFailed)).toBeInTheDocument();
  });
});
