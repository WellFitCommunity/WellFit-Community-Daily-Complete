/**
 * Envision Atlus Brand Theme
 *
 * Professional EMR/EHR branding for the backend admin and clinical systems.
 * Replaces the sterile white medical aesthetic with modern, sophisticated colors.
 */

export const EnvisionAtlusTheme = {
  // Primary brand colors from logo
  colors: {
    // Main brand colors
    primary: {
      teal: '#1BA39C',
      tealLight: '#26C6BF',
      tealDark: '#158A84',
      tealPale: '#E0F7F6',
    },
    accent: {
      lime: '#C8E63D',
      limeLight: '#D9F05C',
      limeDark: '#A8C230',
      limePale: '#F4FADC',
    },
    metallic: {
      silver: '#C0C5CB',
      steel: '#8B9199',
      charcoal: '#2D3339',
      platinum: '#E8EAED',
    },

    // Semantic colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Neutral palette
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },

  // Background gradients
  gradients: {
    primary: 'linear-gradient(135deg, #1BA39C 0%, #158A84 100%)',
    accent: 'linear-gradient(135deg, #C8E63D 0%, #A8C230 100%)',
    dark: 'linear-gradient(135deg, #2D3339 0%, #1F2937 100%)',
    hero: 'linear-gradient(135deg, #1BA39C 0%, #158A84 50%, #2D3339 100%)',
    subtle: 'linear-gradient(135deg, #E0F7F6 0%, #F4FADC 100%)',
  },

  // Component-specific styles
  components: {
    card: {
      background: 'white',
      border: '#E5E7EB',
      shadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      shadowHover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },

    header: {
      background: 'linear-gradient(135deg, #1BA39C 0%, #158A84 100%)',
      text: 'white',
      accent: '#C8E63D',
    },

    sidebar: {
      background: '#2D3339',
      text: '#E8EAED',
      hover: '#1BA39C',
      active: '#C8E63D',
    },

    button: {
      primary: {
        background: '#1BA39C',
        hover: '#158A84',
        text: 'white',
      },
      secondary: {
        background: '#C8E63D',
        hover: '#A8C230',
        text: '#2D3339',
      },
      ghost: {
        background: 'transparent',
        hover: '#E0F7F6',
        text: '#1BA39C',
      },
    },

    badge: {
      teal: 'bg-[#E0F7F6] text-[#158A84] border border-[#1BA39C]',
      lime: 'bg-[#F4FADC] text-[#A8C230] border border-[#C8E63D]',
      gray: 'bg-gray-100 text-gray-700 border border-gray-300',
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
  },

  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  // Border radius
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
};

// Tailwind utility class mappings for easy use in components
export const atlasClasses = {
  // Backgrounds
  bgPrimary: 'bg-[#1BA39C]',
  bgPrimaryLight: 'bg-[#26C6BF]',
  bgPrimaryDark: 'bg-[#158A84]',
  bgPrimaryPale: 'bg-[#E0F7F6]',

  bgAccent: 'bg-[#C8E63D]',
  bgAccentLight: 'bg-[#D9F05C]',
  bgAccentDark: 'bg-[#A8C230]',
  bgAccentPale: 'bg-[#F4FADC]',

  bgMetallic: 'bg-[#C0C5CB]',
  bgSteel: 'bg-[#8B9199]',
  bgCharcoal: 'bg-[#2D3339]',
  bgPlatinum: 'bg-[#E8EAED]',

  // Text colors
  textPrimary: 'text-[#1BA39C]',
  textPrimaryDark: 'text-[#158A84]',
  textAccent: 'text-[#C8E63D]',
  textAccentDark: 'text-[#A8C230]',
  textCharcoal: 'text-[#2D3339]',
  textSteel: 'text-[#8B9199]',

  // Border colors
  borderPrimary: 'border-[#1BA39C]',
  borderAccent: 'border-[#C8E63D]',
  borderCharcoal: 'border-[#2D3339]',
  borderPlatinum: 'border-[#E8EAED]',

  // Gradients (using from-to pattern)
  gradientHero: 'bg-gradient-to-br from-[#1BA39C] via-[#158A84] to-[#2D3339]',
  gradientPrimary: 'bg-gradient-to-r from-[#1BA39C] to-[#158A84]',
  gradientAccent: 'bg-gradient-to-r from-[#C8E63D] to-[#A8C230]',
  gradientDark: 'bg-gradient-to-br from-[#2D3339] to-[#1F2937]',
  gradientSubtle: 'bg-gradient-to-br from-[#E0F7F6] to-[#F4FADC]',

  // Hover states
  hoverPrimary: 'hover:bg-[#158A84]',
  hoverAccent: 'hover:bg-[#A8C230]',
  hoverPrimaryPale: 'hover:bg-[#E0F7F6]',

  // Button styles
  btnPrimary: 'bg-[#1BA39C] hover:bg-[#158A84] text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg',
  btnAccent: 'bg-[#C8E63D] hover:bg-[#A8C230] text-[#2D3339] font-semibold px-6 py-3 rounded-lg transition-all shadow-md hover:shadow-lg',
  btnGhost: 'bg-transparent hover:bg-[#E0F7F6] text-[#1BA39C] font-semibold px-6 py-3 rounded-lg transition-all border-2 border-[#1BA39C]',

  // Card styles
  cardAtlas: 'bg-white rounded-xl shadow-md border border-[#E8EAED] hover:shadow-lg transition-shadow',
  cardAtlasDark: 'bg-[#2D3339] rounded-xl shadow-md border border-[#8B9199] text-white',

  // Section headers
  headerAtlas: 'bg-gradient-to-r from-[#1BA39C] to-[#158A84] text-white px-6 py-4 rounded-t-xl',
  headerAtlasDark: 'bg-[#2D3339] text-[#C8E63D] px-6 py-4 rounded-t-xl border-b-2 border-[#1BA39C]',
};

export default EnvisionAtlusTheme;
