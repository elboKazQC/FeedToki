import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider as TokiThemeProvider } from '@/lib/theme-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Composant pour gérer la navigation basée sur l'authentification
function NavigationHandler() {
  const { profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // Attendre que l'auth soit chargé

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'onboarding';
    const inAuthScreen = segments[0] === 'auth';

    if (!profile) {
      // Pas de profil = rediriger vers auth
      if (!inAuthScreen) {
        router.replace('/auth');
      }
    } else if (!profile.onboardingCompleted) {
      // Profil non complété = rediriger vers onboarding
      if (segments[0] !== 'onboarding') {
        router.replace('/onboarding');
      }
    } else {
      // Profil complété = rediriger vers l'app principale
      if (segments[0] !== '(tabs)') {
        router.replace('/(tabs)');
      }
    }
  }, [profile, loading, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <TokiThemeProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <NavigationHandler />
          <Stack>
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="verify-email" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </TokiThemeProvider>
  );
}
