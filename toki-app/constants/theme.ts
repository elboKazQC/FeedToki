/**
 * Theme colors based on design tokens
 * Uses the centralized design token system for consistency
 */

import { lightTheme, darkTheme } from './design-tokens';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: lightTheme.text.primary,
    background: lightTheme.background,
    tint: lightTheme.primary,
    icon: lightTheme.text.secondary,
    tabIconDefault: lightTheme.text.tertiary,
    tabIconSelected: lightTheme.primary,
    // Extended colors from design tokens
    surface: lightTheme.surface,
    surfaceElevated: lightTheme.surfaceElevated,
    border: lightTheme.border,
    success: lightTheme.success,
    warning: lightTheme.warning,
    error: lightTheme.error,
    primary: lightTheme.primary,
    secondary: lightTheme.secondary,
  },
  dark: {
    text: darkTheme.text.primary,
    background: darkTheme.background,
    tint: darkTheme.primary,
    icon: darkTheme.text.secondary,
    tabIconDefault: darkTheme.text.tertiary,
    tabIconSelected: darkTheme.primary,
    // Extended colors from design tokens
    surface: darkTheme.surface,
    surfaceElevated: darkTheme.surfaceElevated,
    border: darkTheme.border,
    success: darkTheme.success,
    warning: darkTheme.warning,
    error: darkTheme.error,
    primary: darkTheme.primary,
    secondary: darkTheme.secondary,
  },
};

// Re-export design tokens for convenience
export { spacing, borderRadius, borderWidth, typography, shadows, colors, breakpoints } from './design-tokens';
export { lightTheme, darkTheme } from './design-tokens';

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
