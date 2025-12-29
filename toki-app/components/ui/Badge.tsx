/**
 * Badge Component - Badge pour afficher stats, points, labels
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, borderRadius, typography, darkTheme, lightTheme } from '../../constants/design-tokens';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';
export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  label: string | number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

export function Badge({
  label,
  variant = 'default',
  size = 'medium',
  style,
}: BadgeProps) {
  const { activeTheme } = useTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  
  // Variant colors
  const getVariantStyles = (): { backgroundColor: string; textColor: string } => {
    switch (variant) {
      case 'success':
        return {
          backgroundColor: activeTheme === 'dark' ? '#14532d' : '#dcfce7',
          textColor: activeTheme === 'dark' ? theme.success : '#166534',
        };
      case 'warning':
        return {
          backgroundColor: activeTheme === 'dark' ? '#7c2d12' : '#ffedd5',
          textColor: activeTheme === 'dark' ? theme.warning : '#c2410c',
        };
      case 'error':
        return {
          backgroundColor: activeTheme === 'dark' ? '#7f1d1d' : '#fee2e2',
          textColor: activeTheme === 'dark' ? theme.error : '#991b1b',
        };
      case 'info':
        return {
          backgroundColor: activeTheme === 'dark' ? '#164e63' : '#cffafe',
          textColor: activeTheme === 'dark' ? theme.secondary : '#0891b2',
        };
      default:
        return {
          backgroundColor: theme.border,
          textColor: theme.text.secondary,
        };
    }
  };
  
  const variantStyles = getVariantStyles();
  
  // Size styles
  const sizeStyles = {
    small: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      fontSize: typography.fontSize.xs,
    },
    medium: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.sm,
    },
    large: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.md,
    },
  };
  
  const badgeStyles = [
    styles.badge,
    {
      backgroundColor: variantStyles.backgroundColor,
      borderRadius: borderRadius.full,
    },
    sizeStyles[size],
    style,
  ];
  
  const textStyles = [
    styles.text,
    {
      color: variantStyles.textColor,
      fontSize: sizeStyles[size].fontSize,
      fontWeight: typography.fontWeight.semibold as any,
    },
  ];
  
  return (
    <View style={badgeStyles}>
      <Text style={textStyles}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});

