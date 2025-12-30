/**
 * Input Component - Input standardisé avec label, erreur et validation
 */

import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../lib/theme-context';
import { spacing, borderRadius, typography, borderWidth, darkTheme, lightTheme } from '../../constants/design-tokens';

export type InputVariant = 'text' | 'number' | 'textarea';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  variant?: InputVariant;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  showError?: boolean;
}

export function Input({
  label,
  error,
  variant = 'text',
  containerStyle,
  inputStyle,
  showError = true,
  ...textInputProps
}: InputProps) {
  const { activeTheme } = useTheme();
  const theme = activeTheme === 'dark' ? darkTheme : lightTheme;
  
  const hasError = Boolean(error);
  const multiline = variant === 'textarea';
  
  const inputStyles = [
    styles.input,
    {
      backgroundColor: theme.surfaceElevated,
      color: theme.text.primary,
      borderColor: hasError ? theme.error : theme.border,
      borderWidth: hasError ? borderWidth.medium : borderWidth.thin,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: typography.fontSize.lg,
      minHeight: multiline ? 120 : 48, // Minimum touch target for single line
    },
    inputStyle,
  ];
  
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            {
              color: theme.text.primary,
              marginBottom: spacing.sm,
            },
          ]}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...textInputProps}
        style={inputStyles}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor={theme.text.tertiary}
        accessibilityLabel={label || textInputProps.accessibilityLabel}
        accessibilityState={{ invalid: hasError }}
      />
      {showError && hasError && (
        <Text
          style={[
            styles.errorText,
            {
              color: theme.error,
              marginTop: spacing.xs,
            },
          ]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold as any,
  },
  input: {
    fontFamily: 'system',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium as any,
  },
});


