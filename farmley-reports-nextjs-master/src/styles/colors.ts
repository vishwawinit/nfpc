// Professional business color palette - muted and sophisticated
export const colors = {
  // Primary brand colors - Professional slate
  primary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',  // Main primary - Muted slate
    600: '#475569',
    700: '#334155',  // Professional dark
    800: '#1e293b',
    900: '#0f172a',
  },

  // Neutral grays
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  },

  // Success green - Muted emerald
  success: {
    light: '#d1fae5',
    main: '#059669',
    dark: '#047857',
  },

  // Warning amber - Muted
  warning: {
    light: '#fef3c7',
    main: '#d97706',
    dark: '#b45309',
  },

  // Error red
  error: {
    light: '#fee2e2',
    main: '#dc2626',
    dark: '#b91c1c',
  },

  // Info blue - Muted sky
  info: {
    light: '#e0f2fe',
    main: '#0284c7',
    dark: '#0369a1',
  },

  // Chart colors (professional muted palette)
  chart: {
    slate: '#64748b',
    sky: '#0284c7',
    emerald: '#059669',
    amber: '#d97706',
    violet: '#7c3aed',
    cyan: '#0891b2',
    lime: '#65a30d',
    rose: '#e11d48',
  },

  // Background colors
  background: {
    primary: '#ffffff',
    secondary: '#fafafa',
    tertiary: '#f4f4f5',
  }
}

// Chart color array for easy access - Professional palette
export const CHART_COLORS = {
  primary: colors.chart.slate,
  success: colors.chart.emerald,
  warning: colors.chart.amber,
  danger: colors.chart.rose,
  info: colors.chart.sky,

  // Array for multi-series charts
  array: [
    colors.chart.slate,
    colors.chart.sky,
    colors.chart.emerald,
    colors.chart.amber,
    colors.chart.violet,
    colors.chart.cyan,
    colors.chart.lime,
    colors.chart.rose,
  ]
}