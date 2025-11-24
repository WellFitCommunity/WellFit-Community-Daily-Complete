/**
 * Envision Atlus Design System
 *
 * Clinical-facing B2B design system for healthcare professionals.
 * Optimized for long shifts, reduced eye strain, and quick scanning.
 *
 * Design Principles:
 * 1. Dark mode primary - reduces eye strain during 12-hour shifts
 * 2. High contrast for critical information
 * 3. Color-coded severity (consistent with medical standards)
 * 4. Generous spacing for touch targets
 * 5. Clear typography hierarchy
 */

// =====================================================
// COLOR PALETTE - Envision Atlus Teal (Darker)
// =====================================================

export const envisionAtlusColors = {
  // Primary Teal - Darker, professional healthcare teal
  teal: {
    50: '#e6f7f6',
    100: '#ccefed',
    200: '#99dfdb',
    300: '#66cfc9',
    400: '#33bfb7',
    500: '#00857a',  // Primary - darker than cyan
    600: '#006d64',  // Hover state
    700: '#00554e',  // Active/pressed
    800: '#003d38',  // Dark accent
    900: '#002522',  // Darkest
  },

  // Accent - Warm orange for CTAs and highlights
  accent: {
    400: '#ff8c5a',
    500: '#FF6B35',  // Primary accent
    600: '#e55a2b',
  },

  // Slate - UI backgrounds (dark mode optimized)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',  // Primary background
    900: '#0f172a',  // Darkest background
    950: '#020617',  // Near black
  },

  // Semantic Colors - Medical standard coding
  semantic: {
    // Critical/Emergency - Red
    critical: {
      light: '#fecaca',
      DEFAULT: '#ef4444',
      dark: '#b91c1c',
      bg: 'rgba(239, 68, 68, 0.15)',
    },
    // High Risk/Warning - Amber
    high: {
      light: '#fde68a',
      DEFAULT: '#f59e0b',
      dark: '#b45309',
      bg: 'rgba(245, 158, 11, 0.15)',
    },
    // Elevated/Caution - Yellow
    elevated: {
      light: '#fef08a',
      DEFAULT: '#eab308',
      dark: '#a16207',
      bg: 'rgba(234, 179, 8, 0.15)',
    },
    // Normal/Success - Green
    normal: {
      light: '#bbf7d0',
      DEFAULT: '#22c55e',
      dark: '#15803d',
      bg: 'rgba(34, 197, 94, 0.15)',
    },
    // Info - Blue
    info: {
      light: '#bfdbfe',
      DEFAULT: '#3b82f6',
      dark: '#1d4ed8',
      bg: 'rgba(59, 130, 246, 0.15)',
    },
  },

  // Text colors
  text: {
    primary: '#f8fafc',      // White-ish for dark bg
    secondary: '#94a3b8',    // Muted
    tertiary: '#64748b',     // Very muted
    inverse: '#0f172a',      // For light backgrounds
  },

  // Border colors
  border: {
    DEFAULT: '#334155',
    light: '#475569',
    focus: '#00857a',
  },
} as const;

// =====================================================
// COMPONENT STYLES
// =====================================================

export const envisionAtlusComponents = {
  // Card styles
  card: {
    base: 'bg-slate-800 border border-slate-700 rounded-lg',
    hover: 'hover:border-slate-600 transition-colors',
    header: 'px-6 py-4 border-b border-slate-700',
    content: 'p-6',
  },

  // Button variants
  button: {
    primary: 'bg-[#00857a] hover:bg-[#006d64] active:bg-[#00554e] text-white font-medium',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600',
    ghost: 'hover:bg-slate-700/50 text-slate-300 hover:text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    accent: 'bg-[#FF6B35] hover:bg-[#e55a2b] text-white font-medium',
  },

  // Badge/Status indicators
  badge: {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    elevated: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    normal: 'bg-green-500/20 text-green-400 border border-green-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    neutral: 'bg-slate-600/50 text-slate-300 border border-slate-500/30',
  },

  // Input styles
  input: {
    base: 'bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-md',
    focus: 'focus:border-[#00857a] focus:ring-2 focus:ring-[#00857a]/20 focus:outline-none',
    disabled: 'opacity-50 cursor-not-allowed',
  },

  // Table styles
  table: {
    header: 'bg-slate-900 text-slate-300 text-xs uppercase tracking-wider',
    row: 'border-b border-slate-700 hover:bg-slate-700/50 transition-colors',
    cell: 'px-4 py-3',
  },

  // Alert/Notification styles
  alert: {
    critical: 'bg-red-500/10 border-l-4 border-red-500 text-red-200',
    warning: 'bg-amber-500/10 border-l-4 border-amber-500 text-amber-200',
    success: 'bg-green-500/10 border-l-4 border-green-500 text-green-200',
    info: 'bg-[#00857a]/10 border-l-4 border-[#00857a] text-teal-200',
  },
} as const;

// =====================================================
// TYPOGRAPHY
// =====================================================

export const envisionAtlusTypography = {
  // Headings
  h1: 'text-3xl font-bold text-white tracking-tight',
  h2: 'text-2xl font-semibold text-white',
  h3: 'text-xl font-semibold text-white',
  h4: 'text-lg font-medium text-white',

  // Body text
  body: 'text-sm text-slate-300 leading-relaxed',
  bodyLarge: 'text-base text-slate-300 leading-relaxed',

  // Labels and captions
  label: 'text-xs font-medium text-slate-400 uppercase tracking-wide',
  caption: 'text-xs text-slate-500',

  // Data/metrics
  metric: 'text-4xl font-bold tabular-nums',
  metricLabel: 'text-xs text-slate-400 uppercase tracking-wide mt-1',
} as const;

// =====================================================
// LAYOUT
// =====================================================

export const envisionAtlusLayout = {
  // Page container
  page: 'min-h-screen bg-gradient-to-br from-slate-900 to-slate-800',

  // Content containers
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  containerNarrow: 'max-w-4xl mx-auto px-4 sm:px-6',

  // Grid systems
  grid2: 'grid grid-cols-1 md:grid-cols-2 gap-6',
  grid3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  grid4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',

  // Spacing
  section: 'py-8',
  sectionCompact: 'py-4',
} as const;

// =====================================================
// RISK LEVEL UTILITIES
// =====================================================

export type RiskLevel = 'critical' | 'high' | 'elevated' | 'normal' | 'low';

export function getRiskStyles(level: RiskLevel | string) {
  const normalizedLevel = level.toLowerCase();

  switch (normalizedLevel) {
    case 'critical':
      return {
        badge: envisionAtlusComponents.badge.critical,
        bg: 'bg-red-500',
        bgLight: 'bg-red-500/20',
        text: 'text-red-400',
        border: 'border-red-500/50',
      };
    case 'high':
      return {
        badge: envisionAtlusComponents.badge.high,
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
      };
    case 'elevated':
    case 'moderate':
      return {
        badge: envisionAtlusComponents.badge.elevated,
        bg: 'bg-yellow-500',
        bgLight: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/50',
      };
    case 'normal':
    case 'low':
    default:
      return {
        badge: envisionAtlusComponents.badge.normal,
        bg: 'bg-green-500',
        bgLight: 'bg-green-500/20',
        text: 'text-green-400',
        border: 'border-green-500/50',
      };
  }
}

// =====================================================
// CSS VARIABLES (for Tailwind config)
// =====================================================

export const envisionAtlusCSSVars = {
  '--ea-teal-500': '#00857a',
  '--ea-teal-600': '#006d64',
  '--ea-teal-700': '#00554e',
  '--ea-accent-500': '#FF6B35',
  '--ea-slate-800': '#1e293b',
  '--ea-slate-900': '#0f172a',
} as const;

// =====================================================
// GRADIENTS
// =====================================================

export const envisionAtlusGradients = {
  // Primary header gradient
  header: 'bg-gradient-to-r from-[#00857a] to-[#006d64]',

  // Page background
  pageBg: 'bg-gradient-to-br from-slate-900 to-slate-800',

  // Card highlight gradient
  cardHighlight: 'bg-gradient-to-br from-[#00857a]/10 to-transparent',

  // Accent gradient for CTAs
  accent: 'bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a]',

  // Text gradient for headings
  textTeal: 'bg-gradient-to-r from-[#33bfb7] to-[#00857a] bg-clip-text text-transparent',
} as const;

// =====================================================
// EXPORT DEFAULT THEME
// =====================================================

export const envisionAtlus = {
  colors: envisionAtlusColors,
  components: envisionAtlusComponents,
  typography: envisionAtlusTypography,
  layout: envisionAtlusLayout,
  gradients: envisionAtlusGradients,
  getRiskStyles,
} as const;

export default envisionAtlus;
