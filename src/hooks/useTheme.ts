/**
 * Display Preferences Hooks — theme (light/dark/auto) + font size
 *
 * Theme read order: profiles.theme (any signed-in user) → admin_settings.theme
 * (legacy admin fallback) → localStorage → system preference.
 * Font size: profiles.font_size applied as a root font-size percentage, so every
 * rem-based Tailwind utility scales app-wide with zero per-component work.
 *
 * Usage: call useDisplayPrefsInit() once at the app shell (RootLayout).
 * `dark:` variants respond to the `dark` class via the @custom-variant in
 * src/index.css — without that variant the class toggle does nothing.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { auditLogger } from '../services/auditLogger';

export type Theme = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

const THEME_STORAGE_KEY = 'admin_theme'; // legacy key kept — existing users have it
const FONT_SIZE_STORAGE_KEY = 'wellfit_font_size';

// Matches the px values the settings page historically applied (14/16/18/22px)
const FONT_SIZE_SCALE: Record<FontSize, string> = {
  small: '87.5%',
  medium: '100%',
  large: '112.5%',
  'extra-large': '137.5%',
};

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function isFontSize(value: unknown): value is FontSize {
  return value === 'small' || value === 'medium' || value === 'large' || value === 'extra-large';
}

/**
 * Apply theme to document and remember it locally.
 */
export function applyTheme(theme: Theme): void {
  const wantsDark =
    theme === 'dark' ||
    (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', wantsDark);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * Apply font size to the document root and remember it locally.
 * Rem-based utilities (all Tailwind text/spacing defaults) scale from this.
 */
export function applyFontSize(size: FontSize): void {
  document.documentElement.style.fontSize = FONT_SIZE_SCALE[size];
  localStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
}

/**
 * Persist + apply a theme choice for the signed-in user.
 * DOM/localStorage always update; the DB write is best-effort (audited on failure).
 */
export async function setTheme(theme: Theme): Promise<void> {
  applyTheme(theme);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ theme })
      .eq('user_id', session.user.id);
    if (error) throw new Error(error.message);
  } catch (err: unknown) {
    await auditLogger.error(
      'THEME_PREFERENCE_SAVE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { theme }
    );
  }
}

/**
 * Persist + apply a font-size choice for the signed-in user.
 */
export async function setFontSize(size: FontSize): Promise<void> {
  applyFontSize(size);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ font_size: size })
      .eq('user_id', session.user.id);
    if (error) throw new Error(error.message);
  } catch (err: unknown) {
    await auditLogger.error(
      'FONT_SIZE_PREFERENCE_SAVE_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { size }
    );
  }
}

/**
 * Initialize theme + font size on app start. Call once at the app shell.
 * localStorage paints immediately; the DB preference (if any) wins afterwards.
 */
export function useDisplayPrefsInit(): void {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;

    const init = async () => {
      try {
        const localTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (isTheme(localTheme)) applyTheme(localTheme);
        const localSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
        if (isFontSize(localSize)) applyFontSize(localSize);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('theme, font_size')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (isTheme(profile?.theme)) {
          applyTheme(profile.theme);
        } else {
          // Legacy admin fallback: theme predates profiles.theme for admins
          const { data: adminRow } = await supabase
            .from('admin_settings')
            .select('theme')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (isTheme(adminRow?.theme)) applyTheme(adminRow.theme);
        }

        if (isFontSize(profile?.font_size)) applyFontSize(profile.font_size);
      } catch (err: unknown) {
        // Display prefs must never block app start — log and fall back to defaults
        await auditLogger.error(
          'DISPLAY_PREFS_INIT_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          {}
        );
      } finally {
        setInitialized(true);
      }
    };

    init();
  }, [initialized]);
}

/**
 * Back-compat alias — existing call sites use useThemeInit.
 */
export const useThemeInit = useDisplayPrefsInit;

/**
 * Listen for theme changes from other tabs/components.
 */
export function useThemeListener(): void {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && isTheme(e.newValue)) {
        applyTheme(e.newValue);
      }
      if (e.key === FONT_SIZE_STORAGE_KEY && isFontSize(e.newValue)) {
        applyFontSize(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
