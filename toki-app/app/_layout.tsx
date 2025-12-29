import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider as TokiThemeProvider } from '@/lib/theme-context';

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
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </TokiThemeProvider>
  );
}
