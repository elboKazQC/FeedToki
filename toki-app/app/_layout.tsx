import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider as TokiThemeProvider } from '@/lib/theme-context';
import * as Sentry from '@sentry/react-native';

// Initialiser Sentry (seulement en production ou avec DSN configuré)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || undefined;

if (SENTRY_DSN && !__DEV__) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Activer en production uniquement
    enableInExpoDevelopment: false,
    debug: false,
  });
  console.log('[Sentry] Initialisé');
} else if (__DEV__) {
  console.log('[Sentry] Désactivé en mode développement (configurez EXPO_PUBLIC_SENTRY_DSN pour activer)');
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <TokiThemeProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="verify-email" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ai-logger" options={{ headerShown: false }} />
            <Stack.Screen name="food-request" options={{ headerShown: false }} />
            <Stack.Screen name="admin-custom-foods" options={{ headerShown: false }} />
            <Stack.Screen name="admin-requests" options={{ headerShown: false }} />
            <Stack.Screen name="stats" options={{ headerShown: false }} />
            <Stack.Screen name="help" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </TokiThemeProvider>
  );
}
