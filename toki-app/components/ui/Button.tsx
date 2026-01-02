/**
 * Button Component - Bouton standardisé avec variants et états
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, borderRadius, typography, darkTheme, lightTheme } from '../../constants/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  fullWidth = false,
}: ButtonProps) {
  const { activeTheme } = useTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  
  const isDisabled = disabled || loading;
  
  // Size styles
  const sizeStyles = {
    small: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      fontSize: typography.fontSize.sm,
    },
    medium: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      fontSize: typography.fontSize.lg,
    },
    large: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      fontSize: typography.fontSize.xl,
    },
  };
  
  // Variant styles
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? theme.border : theme.primary,
            borderWidth: 2,
            borderColor: isDisabled ? theme.border : theme.primary,
          },
          text: {
            color: theme.text.inverse,
            fontWeight: typography.fontWeight.bold as any,
          },
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: theme.surfaceElevated,
            borderWidth: 1,
            borderColor: theme.border,
          },
          text: {
            color: theme.text.primary,
            fontWeight: typography.fontWeight.medium as any,
          },
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 0,
          },
          text: {
            color: theme.text.secondary,
            fontWeight: typography.fontWeight.medium as any,
          },
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? theme.border : theme.error,
            borderWidth: 2,
            borderColor: isDisabled ? theme.border : theme.error,
          },
          text: {
            color: theme.text.inverse,
            fontWeight: typography.fontWeight.bold as any,
          },
        };
      default:
        return {
          container: {},
          text: {},
        };
    }
  };
  
  const variantStyles = getVariantStyles();
  
  const buttonStyles = [
    styles.button,
    sizeStyles[size],
    variantStyles.container,
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];
  
  const textStyles = [
    styles.text,
    { fontSize: sizeStyles[size].fontSize },
    variantStyles.text,
    isDisabled && styles.disabledText,
  ];
  
  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator 
            size="small" 
            color={variantStyles.text.color || theme.text.primary} 
            style={styles.loader}
          />
        ) : (
          <>
            {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
            <Text style={textStyles}>{label}</Text>
            {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Minimum touch target size
    minWidth: 44, // Minimum touch target size
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  disabledText: {
    opacity: 0.7,
  },
  loader: {
    marginRight: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  rightIcon: {
    marginLeft: spacing.sm,
  },
});


