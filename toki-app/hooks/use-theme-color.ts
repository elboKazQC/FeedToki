/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    const token = Colors[theme][colorName] as any;
    // Support legacy nested text object (text.primary) — return primary if present
    if (token && typeof token === 'object' && typeof token.primary === 'string') {
      return token.primary;
    }
    return token;
  }
}
