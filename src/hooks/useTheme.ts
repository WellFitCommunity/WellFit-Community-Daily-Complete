/**
 * Theme Hook
 *
 * Initializes and manages dark/light mode theme.
 * Loads from database on mount, falls back to localStorage, then system preference.
 *
 * Usage: Call useThemeInit() once in App.tsx to initialize theme on app start.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Theme = 'light' | 'dark' | 'auto';

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // Auto mode - check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  localStorage.setItem('admin_theme', theme);
}

/**
 * Initialize theme on app start
 * Call this once in App.tsx
 */
export function useThemeInit(): void {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;

    const initTheme = async () => {
      try {
        // First, apply localStorage immediately for fast paint
        const localTheme = localStorage.getItem('admin_theme') as Theme | null;
        if (localTheme) {
          applyTheme(localTheme);
        }

        // Then check if user is logged in and has database preference
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data } = await supabase
            .from('admin_settings')
            .select('theme')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (data?.theme) {
            applyTheme(data.theme as Theme);
          }
          // If no row exists, fall back to localStorage/system default (already applied above)
        }
      } catch {
        // Fail silently - use localStorage or system default
      } finally {
        setInitialized(true);
      }
    };

    initTheme();
  }, [initialized]);
}

/**
 * Listen for theme changes from other components
 */
export function useThemeListener(): void {
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin_theme' && e.newValue) {
        applyTheme(e.newValue as Theme);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
}
