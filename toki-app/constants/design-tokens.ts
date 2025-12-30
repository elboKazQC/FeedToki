/**
 * Design Tokens - Système de design cohérent pour Toki
 * Centralise les valeurs de design (couleurs, espacements, typographie, etc.)
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const borderWidth = {
  thin: 1,
  medium: 2,
  thick: 3,
} as const;

export const typography = {
  fontSize: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 28,
    '4xl': 32,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Palette de couleurs Toki
export const colors = {
  // Primary (Jaune/Amber - couleur principale de Toki)
  primary: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24', // Primary principal
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  // Secondary (Cyan/Turquoise)
  secondary: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#4ECDC4', // Secondary principal
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  // Success (Green)
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  // Warning (Orange)
  warning: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  // Error (Red)
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  // Neutral (Gray)
  neutral: {
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
    950: '#020617',
  },
} as const;

// Thème Light
export const lightTheme = {
  // Background
  background: '#ffffff',
  surface: '#f9fafb',
  surfaceElevated: '#ffffff',
  
  // Text
  text: {
    primary: '#111827',
    secondary: '#6b7280',
    tertiary: '#9ca3af',
    inverse: '#ffffff',
  },
  
  // Borders
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  
  // Interactive
  primary: colors.primary[400],
  primaryHover: colors.primary[500],
  secondary: colors.secondary[400],
  secondaryHover: colors.secondary[500],
  
  // Status
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.secondary[500],
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',
} as const;

// Thème Dark
export const darkTheme = {
  // Background
  background: '#020617',
  surface: '#111827',
  surfaceElevated: '#1f2937',
  
  // Text
  text: {
    primary: '#e5e7eb',
    secondary: '#9ca3af',
    tertiary: '#6b7280',
    inverse: '#111827',
  },
  
  // Borders
  border: '#374151',
  borderLight: '#1f2937',
  
  // Interactive
  primary: colors.primary[400],
  primaryHover: colors.primary[300],
  secondary: colors.secondary[400],
  secondaryHover: colors.secondary[300],
  
  // Status
  success: colors.success[500],
  warning: colors.warning[500],
  error: colors.error[500],
  info: colors.secondary[400],
  
  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
} as const;

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type TypographySize = keyof typeof typography.fontSize;
export type ColorPalette = keyof typeof colors;
export type ThemeMode = 'light' | 'dark';


