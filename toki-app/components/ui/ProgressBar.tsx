/**
 * ProgressBar Component - Barre de progression réutilisable
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, borderRadius, darkTheme, lightTheme } from '../../constants/design-tokens';

export type ProgressBarVariant = 'primary' | 'success' | 'warning' | 'error';

export interface ProgressBarProps {
  progress: number; // 0-100
  variant?: ProgressBarVariant;
  showLabel?: boolean;
  label?: string;
  height?: number;
  style?: ViewStyle;
}

export function ProgressBar({
  progress,
  variant = 'primary',
  showLabel = false,
  label,
  height = 8,
  style,
}: ProgressBarProps) {
  const { activeTheme } = useTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));
  
  // Variant colors
  const getVariantColor = (): string => {
    switch (variant) {
      case 'success':
        return theme.success;
      case 'warning':
        return theme.warning;
      case 'error':
        return theme.error;
      default:
        return theme.primary;
    }
  };
  
  const progressColor = getVariantColor();
  
  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <View style={styles.labelContainer}>
          {label && (
            <Text style={[styles.label, { color: theme.text.secondary }]}>
              {label}
            </Text>
          )}
          <Text style={[styles.percentage, { color: theme.text.secondary }]}>
            {Math.round(clampedProgress)}%
          </Text>
        </View>
      )}
      <View
        style={[
          styles.track,
          {
            backgroundColor: theme.border,
            height,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <View
          style={[
            styles.progress,
            {
              backgroundColor: progressColor,
              width: `${clampedProgress}%`,
              height,
              borderRadius: borderRadius.full,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  percentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  progress: {
    transition: 'width 0.3s ease',
  },
});

