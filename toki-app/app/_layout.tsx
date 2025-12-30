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

if (SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      // Activer en développement seulement si explicitement configuré
      enableInExpoDevelopment: __DEV__ && Boolean(process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV),
      debug: __DEV__,
      // Environnement
      environment: __DEV__ ? 'development' : 'production',
      // Traces sample rate (10% en production pour réduire les coûts)
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      // Capturer les erreurs React automatiquement
      // ReactNativeTracing est inclus par défaut dans @sentry/react-native
    });
    if (__DEV__) {
      console.log('[Sentry] Initialisé (mode:', __DEV__ ? 'development' : 'production', ')');
    }
  } catch (error) {
    console.error('[Sentry] Erreur d\'initialisation:', error);
  }
} else if (__DEV__) {
  console.log('[Sentry] Désactivé - EXPO_PUBLIC_SENTRY_DSN non configuré');
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
            <Stack.Screen name="verify-email-firebase" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="ai-logger" options={{ headerShown: false }} />
            <Stack.Screen name="food-request" options={{ headerShown: false }} />
            <Stack.Screen name="admin-custom-foods" options={{ headerShown: false }} />
            <Stack.Screen name="admin-requests" options={{ headerShown: false }} />
            <Stack.Screen name="stats" options={{ headerShown: false }} />
            <Stack.Screen name="help" options={{ headerShown: false }} />
            <Stack.Screen name="points-explanation" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </TokiThemeProvider>
  );
}
