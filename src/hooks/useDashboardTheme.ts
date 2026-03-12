/**
 * useDashboardTheme — Maps tenant branding to dashboard CSS custom properties
 *
 * Purpose: Bridge between BrandingContext (tenant colors) and EA design system (CSS vars).
 * The hook injects CSS custom properties on :root so EA components automatically
 * render with the tenant's branding. Also provides computed Tailwind classes
 * for dashboards that mix EA components with raw Tailwind.
 *
 * Usage:
 *   const { theme } = useDashboardTheme();
 *   <div className={theme.pageBg}>...</div>
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { useEffect, useMemo } from 'react';
import { useBranding } from '../BrandingContext';
import { readableTextOn } from '../branding.config';

/**
 * Darken a hex color by a percentage (0-100).
 * Returns a hex string.
 */
function darkenHex(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;

  const r = Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * (1 - percent / 100)));
  const g = Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * (1 - percent / 100)));
  const b = Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * (1 - percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface DashboardTheme {
  /** Primary brand color (hex) */
  primary: string;
  /** Primary hover state (10% darker) */
  primaryHover: string;
  /** Primary active state (20% darker) */
  primaryActive: string;
  /** Secondary brand color (hex) */
  secondary: string;
  /** Text color for content on primary bg */
  textOnPrimary: string;
  /** CSS gradient string */
  gradient: string;
  /** Tailwind: page background using brand gradient */
  pageBg: string;
  /** Tailwind: primary button class */
  buttonPrimary: string;
  /** Tailwind: card border using brand color */
  cardHighlight: string;
  /** Whether branding is still loading */
  loading: boolean;
}

/**
 * Hook that:
 * 1. Reads tenant branding from BrandingContext
 * 2. Injects CSS custom properties on :root
 * 3. Returns computed Tailwind classes for dashboard use
 */
export function useDashboardTheme(): { theme: DashboardTheme } {
  const { branding, loading } = useBranding();

  // Inject CSS custom properties on :root whenever branding changes
  useEffect(() => {
    if (loading) return;

    const root = document.documentElement;
    const primary = branding.primaryColor || '#00857a';
    const secondary = branding.secondaryColor || '#FF6B35';
    const textOnPrimary = readableTextOn(primary);

    root.style.setProperty('--ea-primary', primary);
    root.style.setProperty('--ea-primary-hover', darkenHex(primary, 10));
    root.style.setProperty('--ea-primary-active', darkenHex(primary, 20));
    root.style.setProperty('--ea-secondary', secondary);
    root.style.setProperty('--ea-text-on-primary', textOnPrimary);
    root.style.setProperty('--ea-text-primary', branding.textColor || '#f8fafc');
    root.style.setProperty('--ea-gradient', branding.gradient || `linear-gradient(to bottom right, ${primary}, ${secondary})`);

    // Also update the legacy CSS vars from envision-atlus-theme
    root.style.setProperty('--ea-teal-500', primary);
    root.style.setProperty('--ea-teal-600', darkenHex(primary, 10));
    root.style.setProperty('--ea-teal-700', darkenHex(primary, 20));
    root.style.setProperty('--ea-accent-500', secondary);
  }, [branding, loading]);

  const theme = useMemo<DashboardTheme>(() => {
    const primary = branding.primaryColor || '#00857a';
    const secondary = branding.secondaryColor || '#FF6B35';

    return {
      primary,
      primaryHover: darkenHex(primary, 10),
      primaryActive: darkenHex(primary, 20),
      secondary,
      textOnPrimary: readableTextOn(primary),
      gradient: branding.gradient || `linear-gradient(to bottom right, ${primary}, ${secondary})`,
      pageBg: 'min-h-screen bg-linear-to-br from-slate-900 to-slate-800',
      buttonPrimary: 'bg-[var(--ea-primary)] hover:bg-[var(--ea-primary-hover)] active:bg-[var(--ea-primary-active)] text-[var(--ea-text-on-primary)]',
      cardHighlight: 'border-[var(--ea-primary)]/30',
      loading,
    };
  }, [branding, loading]);

  return { theme };
}
