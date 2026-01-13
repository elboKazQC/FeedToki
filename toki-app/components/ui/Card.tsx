/**
 * Card Component - Composant de carte réutilisable
 * Supporte différents variants et thèmes
 */

import React from 'react';
import { View, ViewStyle, StyleSheet, StyleProp } from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, borderRadius, shadows, darkTheme, lightTheme } from '../../constants/design-tokens';

export type CardVariant = 'default' | 'outlined' | 'elevated';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
}

export function Card({ 
  children, 
  variant = 'default', 
  style,
  padding = 'lg',
}: CardProps) {
  const { activeTheme } = useTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  
  const cardStyles = [
    styles.card,
    {
      backgroundColor: theme.surfaceElevated,
      padding: spacing[padding],
      borderRadius: borderRadius.md,
    },
    variant === 'outlined' && {
      borderWidth: 1,
      borderColor: theme.border,
    },
    variant === 'elevated' && shadows.md,
    style,
  ];

  return (
    <View style={cardStyles}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // Base styles applied via style prop
  },
});


