/**
 * Professional Business Color Palette for Farmley Reports
 * Clean, professional colors suitable for business dashboards
 * No flashy or bright colors - focused on readability and professionalism
 */

export const businessColors = {
  // Primary colors - Deep blues for main UI elements
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main primary
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },

  // Neutral grays for text and borders
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Success - Forest green for positive metrics
  success: {
    light: '#d1fae5',
    main: '#047857',
    dark: '#064e3b',
  },

  // Warning - Amber for attention
  warning: {
    light: '#fed7aa',
    main: '#d97706',
    dark: '#92400e',
  },

  // Error - Deep red for critical items
  error: {
    light: '#fecaca',
    main: '#dc2626',
    dark: '#991b1b',
  },

  // Info - Professional blue
  info: {
    light: '#dbeafe',
    main: '#2563eb',
    dark: '#1e40af',
  },

  // Background colors
  background: {
    primary: '#ffffff',
    secondary: '#f9fafb',
    tertiary: '#f3f4f6',
  },

  // Chart colors - Professional palette for data visualization
  charts: {
    blue: '#2563eb',
    slate: '#475569',
    emerald: '#047857',
    amber: '#d97706',
    purple: '#7c3aed',
    cyan: '#0891b2',
    rose: '#be123c',
    stone: '#57534e',
    // Additional colors for complex charts
    secondary: [
      '#3b82f6', // Blue
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#8b5cf6', // Violet
      '#ef4444', // Red
      '#06b6d4', // Cyan
      '#f97316', // Orange
      '#84cc16', // Lime
    ]
  },

  // Semantic colors for business metrics
  metrics: {
    revenue: '#047857',     // Green for money/revenue
    cost: '#dc2626',        // Red for costs/expenses
    profit: '#1e40af',      // Blue for profit
    neutral: '#6b7280',     // Gray for neutral metrics
    growth: '#10b981',      // Bright green for growth
    decline: '#ef4444',     // Red for decline
    target: '#f59e0b',      // Amber for targets
    achieved: '#047857',    // Green for achieved
  },

  // Table specific colors
  table: {
    headerBg: '#f3f4f6',
    headerText: '#111827',
    rowBg: '#ffffff',
    rowHoverBg: '#f9fafb',
    borderColor: '#e5e7eb',
    fixedHeaderShadow: 'rgba(0, 0, 0, 0.05)',
  },

  // Card colors
  card: {
    background: '#ffffff',
    border: '#e5e7eb',
    shadow: 'rgba(0, 0, 0, 0.05)',
    hoverShadow: 'rgba(0, 0, 0, 0.1)',
  }
}

// Utility function to get chart colors
export const getChartColor = (index: number): string => {
  return businessColors.charts.secondary[index % businessColors.charts.secondary.length]
}

// Professional gradients for special elements
export const gradients = {
  primary: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
  success: 'linear-gradient(135deg, #047857 0%, #10b981 100%)',
  warning: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  error: 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
  neutral: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)',
}

// Export type for TypeScript
export type BusinessColors = typeof businessColors
export type ChartColors = typeof businessColors.charts
export type MetricColors = typeof businessColors.metrics