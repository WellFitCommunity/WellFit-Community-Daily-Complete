/**
 * Envision Atlus Brand Theme - Professional EMR/EHR Design
 *
 * Brand Color Hierarchy:
 * - TEAL (#1BA39C) = DOMINANT - Main backgrounds, primary UI areas, hero sections
 * - SILVER (#C0C5CB) = STATEMENT - Important callouts, featured sections, focal points
 * - BLACK (#000000) = BORDERS - All borders, dividers, outlines
 * - LIME (#C8E63D) = ACCENT - Subtle highlights, CTA buttons, success states
 *
 * Design Philosophy: Modern, sophisticated, professional
 * Replaces sterile white medical aesthetic with branded identity
 */

export const EnvisionAtlusTheme = {
  // Core brand colors with correct hierarchy
  colors: {
    // DOMINANT: Teal - Use liberally throughout interface
    dominant: {
      teal: '#1BA39C',
      tealLight: '#26C6BF',
      tealDark: '#158A84',
      tealPale: '#E8F8F7',      // Very light teal for backgrounds
      tealSubtle: '#D1F2F0',    // Subtle teal for hover states
    },

    // STATEMENT: Silver/Metallic - Use for hero sections and focal points
    statement: {
      silver: '#C0C5CB',
      silverLight: '#D8DCE0',
      silverDark: '#A8ADB3',
      platinum: '#E8EAED',
      steel: '#8B9199',
      gunmetal: '#6B7280',      // Darker metallic for text on silver
    },

    // BORDERS: Black - Use for ALL borders and dividers
    border: {
      black: '#000000',
      blackSoft: '#1A1A1A',     // Slightly softer for less harsh borders
      blackSubtle: '#2D2D2D',   // Very subtle variation
    },

    // ACCENT: Lime - Use sparingly for highlights and CTAs
    accent: {
      lime: '#C8E63D',
      limeLight: '#D9F05C',
      limeDark: '#A8C230',
      limePale: '#F4FADC',
      limeSubtle: '#E8F5C8',
    },

    // Semantic colors (status indicators)
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6',
    },

    // Neutral palette for text and subtle backgrounds
    neutral: {
      white: '#FFFFFF',
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      800: '#1F2937',
      900: '#111827',
    },
  },

  // Professional gradient combinations
  gradients: {
    // Teal dominant gradients
    tealHero: 'linear-gradient(135deg, #1BA39C 0%, #158A84 100%)',
    tealSubtle: 'linear-gradient(135deg, #E8F8F7 0%, #D1F2F0 100%)',
    tealToSilver: 'linear-gradient(135deg, #1BA39C 0%, #C0C5CB 100%)',

    // Silver statement gradients
    silverHero: 'linear-gradient(135deg, #C0C5CB 0%, #A8ADB3 100%)',
    silverSheen: 'linear-gradient(135deg, #E8EAED 0%, #C0C5CB 50%, #D8DCE0 100%)',

    // Accent gradients (use sparingly)
    limeAccent: 'linear-gradient(135deg, #C8E63D 0%, #A8C230 100%)',
  },

  // Component styling guidelines
  components: {
    // Hero sections - Silver statement with black border
    hero: {
      background: 'linear-gradient(135deg, #C0C5CB 0%, #A8ADB3 100%)',
      border: '2px solid #000000',
      text: '#1A1A1A',
      shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },

    // Main content areas - Teal dominant
    content: {
      background: '#1BA39C',
      backgroundLight: '#E8F8F7',
      border: '1px solid #000000',
      text: '#FFFFFF',
    },

    // Cards - White with black borders, teal accents
    card: {
      background: '#FFFFFF',
      border: '1px solid #000000',
      borderHover: '2px solid #1BA39C',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      shadowHover: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },

    // Headers - Silver statement pieces
    header: {
      background: 'linear-gradient(135deg, #C0C5CB 0%, #A8ADB3 100%)',
      border: '2px solid #000000',
      text: '#1A1A1A',
      accent: '#1BA39C',
    },

    // Sidebar/Navigation - Teal dominant
    sidebar: {
      background: '#1BA39C',
      border: '1px solid #000000',
      text: '#FFFFFF',
      textMuted: '#D1F2F0',
      hover: '#C0C5CB',
      active: '#C8E63D',
    },

    // Buttons
    button: {
      // Primary CTA - Lime accent
      primary: {
        background: '#C8E63D',
        hover: '#A8C230',
        text: '#1A1A1A',
        border: '2px solid #000000',
      },
      // Secondary - Teal dominant
      secondary: {
        background: '#1BA39C',
        hover: '#158A84',
        text: '#FFFFFF',
        border: '2px solid #000000',
      },
      // Tertiary - Silver statement
      tertiary: {
        background: '#C0C5CB',
        hover: '#A8ADB3',
        text: '#1A1A1A',
        border: '2px solid #000000',
      },
      // Ghost - Outline only
      ghost: {
        background: 'transparent',
        hover: '#E8F8F7',
        text: '#1BA39C',
        border: '2px solid #000000',
      },
    },

    // Badges and tags
    badge: {
      teal: 'bg-[#E8F8F7] text-[#158A84] border-2 border-black',
      silver: 'bg-[#E8EAED] text-[#6B7280] border-2 border-black',
      lime: 'bg-[#F4FADC] text-[#A8C230] border-2 border-black',
    },

    // Section headers
    section: {
      background: '#E8F8F7',
      border: '1px solid #000000',
      borderAccent: '3px solid #1BA39C',
      text: '#1A1A1A',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },

  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
    '3xl': '4rem',
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
};

// Tailwind utility class mappings - Professional design system
export const atlasClasses = {
  // === BORDERS - ALL BLACK ===
  border: 'border-black',
  border2: 'border-2 border-black',
  borderT: 'border-t border-black',
  borderB: 'border-b border-black',
  borderL: 'border-l border-black',
  borderR: 'border-r border-black',

  // === DOMINANT TEAL - Use throughout ===
  // Backgrounds
  bgTeal: 'bg-[#1BA39C]',
  bgTealLight: 'bg-[#26C6BF]',
  bgTealDark: 'bg-[#158A84]',
  bgTealPale: 'bg-[#E8F8F7]',
  bgTealSubtle: 'bg-[#D1F2F0]',

  // Text
  textTeal: 'text-[#1BA39C]',
  textTealDark: 'text-[#158A84]',

  // Hover states
  hoverBgTeal: 'hover:bg-[#1BA39C]',
  hoverBgTealDark: 'hover:bg-[#158A84]',
  hoverBgTealPale: 'hover:bg-[#E8F8F7]',

  // === STATEMENT SILVER - Use for focal points ===
  // Backgrounds
  bgSilver: 'bg-[#C0C5CB]',
  bgSilverLight: 'bg-[#D8DCE0]',
  bgSilverDark: 'bg-[#A8ADB3]',
  bgPlatinum: 'bg-[#E8EAED]',

  // Text
  textSilver: 'text-[#6B7280]',
  textGunmetal: 'text-[#6B7280]',

  // Hover states
  hoverBgSilver: 'hover:bg-[#C0C5CB]',
  hoverBgSilverDark: 'hover:bg-[#A8ADB3]',

  // === ACCENT LIME - Use sparingly ===
  // Backgrounds
  bgLime: 'bg-[#C8E63D]',
  bgLimeDark: 'bg-[#A8C230]',
  bgLimePale: 'bg-[#F4FADC]',

  // Text
  textLime: 'text-[#C8E63D]',
  textLimeDark: 'text-[#A8C230]',

  // Hover states
  hoverBgLime: 'hover:bg-[#C8E63D]',
  hoverBgLimeDark: 'hover:bg-[#A8C230]',

  // === GRADIENTS ===
  gradientTealHero: 'bg-linear-to-br from-[#1BA39C] to-[#158A84]',
  gradientTealSubtle: 'bg-linear-to-br from-[#E8F8F7] to-[#D1F2F0]',
  gradientSilverHero: 'bg-linear-to-br from-[#C0C5CB] to-[#A8ADB3]',
  gradientSilverSheen: 'bg-linear-to-br from-[#E8EAED] via-[#C0C5CB] to-[#D8DCE0]',

  // === BUTTON PRESETS ===
  // Primary CTA - Lime accent with black border
  btnPrimary: 'bg-[#C8E63D] hover:bg-[#A8C230] text-black font-semibold px-6 py-3 rounded-lg border-2 border-black transition-all shadow-md hover:shadow-lg',

  // Secondary - Teal dominant with black border
  btnSecondary: 'bg-[#1BA39C] hover:bg-[#158A84] text-white font-semibold px-6 py-3 rounded-lg border-2 border-black transition-all shadow-md hover:shadow-lg',

  // Tertiary - Silver statement with black border
  btnTertiary: 'bg-[#C0C5CB] hover:bg-[#A8ADB3] text-black font-semibold px-6 py-3 rounded-lg border-2 border-black transition-all shadow-md hover:shadow-lg',

  // Ghost - Outline with black border
  btnGhost: 'bg-transparent hover:bg-[#E8F8F7] text-[#1BA39C] font-semibold px-6 py-3 rounded-lg border-2 border-black transition-all',

  // === CARD PRESETS ===
  // Standard card - White with black border
  card: 'bg-white rounded-xl shadow-md border border-black hover:shadow-lg transition-shadow',

  // Teal card - Dominant color
  cardTeal: 'bg-[#E8F8F7] rounded-xl shadow-md border border-black hover:border-2 hover:border-[#1BA39C] transition-all',

  // Silver statement card
  cardSilver: 'bg-linear-to-br from-[#C0C5CB] to-[#A8ADB3] rounded-xl shadow-lg border-2 border-black text-black',

  // === SECTION HEADERS ===
  // Silver hero header - Statement piece
  headerHero: 'bg-linear-to-r from-[#C0C5CB] to-[#A8ADB3] text-black px-6 py-4 rounded-t-xl border-2 border-black font-bold text-xl',

  // Teal section header - Dominant use
  headerSection: 'bg-[#E8F8F7] text-[#1A1A1A] px-6 py-3 rounded-t-xl border border-black border-b-0 font-semibold',

  // Accent header - Lime (use sparingly)
  headerAccent: 'bg-[#C8E63D] text-black px-6 py-3 rounded-t-xl border-2 border-black font-bold',

  // === UTILITY CLASSES ===
  // Shadows
  shadow: 'shadow-md',
  shadowLg: 'shadow-lg',
  shadowXl: 'shadow-xl',

  // Transitions
  transition: 'transition-all duration-200',
  transitionSlow: 'transition-all duration-300',
};

export default EnvisionAtlusTheme;
