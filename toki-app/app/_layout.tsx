import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider as TokiThemeProvider } from '@/lib/theme-context';
import { autoCleanupWebCache } from '@/lib/web-cache-buster';
import { BUILD_VERSION } from '@/lib/build-version';
import { SessionTrackerProvider } from '@/lib/session-tracker-context';
import { logError } from '@/lib/user-logger';

// Composant interne qui a accès au contexte d'authentification
function RootLayoutContent() {
  // État pour rendu côté client uniquement (évite erreurs d'hydratation #418 sur web)
  // IMPORTANT: Déclarer isClient AVANT les hooks qui peuvent différer entre serveur/client
  const [isClient, setIsClient] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Initialiser isClient après le premier rendu (web uniquement)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // IMPORTANT: Les hooks doivent être déclarés avant tout return conditionnel
  // Mais on ne les utilise que si isClient pour éviter les différences d'hydratation
  const colorSchemeHook = useColorScheme();
  const authData = useAuth();
  
  // Utiliser des valeurs stables pour le premier rendu (évite erreur #418)
  // Sur web, utiliser 'light' par défaut jusqu'à ce que le client soit initialisé
  const colorScheme = (!isClient && Platform.OS === 'web') ? 'light' : colorSchemeHook;
  const { profile, user } = authData;

  // Auto-cleanup des caches web au démarrage (web uniquement)
  useEffect(() => {
    autoCleanupWebCache(BUILD_VERSION).catch(err => {
      console.error('[RootLayout] Cache cleanup failed:', err);
    });
  }, []);

  // Gestion d'erreur globale pour capturer les NetworkError non gérés (web uniquement)
  useEffect(() => {
    // window n'existe que sur web
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // Empêcher TOUTES les erreurs non gérées de bloquer l'application (Safari mobile)
      // Safari mobile est plus strict et peut bloquer le rendu sur n'importe quelle erreur
      event.preventDefault();
      
      // Capturer spécifiquement les NetworkError
      if (error?.name === 'NetworkError' || error?.message?.includes('network error') || error?.message?.includes('NetworkError')) {
        console.warn('[RootLayout] NetworkError capturé:', {
          error: error?.message || error,
          stack: error?.stack,
          url: error?.url || 'unknown',
        });
        
        // Logger dans Firestore si utilisateur connecté (non-bloquant)
        const currentUserId = profile?.userId || (user as any)?.uid || (user as any)?.id || 'system';
        if (currentUserId && currentUserId !== 'guest') {
          // Ne pas attendre le logging pour ne pas bloquer
          logError(
            currentUserId,
            error instanceof Error ? error : new Error(String(error)),
            'global-network-error',
            {
              url: error?.url || 'unknown',
              platform: 'web',
            }
          ).catch((loggingError) => {
            // Ignorer les erreurs de logging
            console.error('[RootLayout] Erreur lors du logging:', loggingError);
          });
        }
      } else {
        // Logger toutes les autres erreurs non gérées pour debugging
        console.error('[RootLayout] Erreur non gérée capturée:', error);
      }
    };

    // Gestion d'erreur globale pour les erreurs synchrones (Safari mobile)
    const handleError = (event: ErrorEvent) => {
      // Ignorer les erreurs de police (MaterialIcons) qui peuvent bloquer Safari mobile
      if (event.message?.includes('Failed to decode downloaded font') || 
          event.message?.includes('OTS parsing error') ||
          event.filename?.includes('MaterialIcons') ||
          event.filename?.includes('.ttf')) {
        // Ignorer silencieusement les erreurs de police pour éviter les pages blanches
        if (__DEV__) {
          console.warn('[RootLayout] Erreur de police ignorée (non-bloquant):', event.message);
        }
        event.preventDefault();
        return false;
      }
      
      console.error('[RootLayout] Erreur JavaScript capturée:', event.error);
      // Empêcher la propagation pour éviter les pages blanches
      event.preventDefault();
      return false;
    };

    // Gestionnaire spécifique pour les erreurs de ressources (polices, images, etc.)
    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement;
      // Ignorer les erreurs de chargement de police MaterialIcons
      if (target?.tagName === 'LINK' && (target as HTMLLinkElement).href?.includes('MaterialIcons') ||
          target?.tagName === 'STYLE' && (target as HTMLStyleElement).textContent?.includes('MaterialIcons')) {
        if (__DEV__) {
          console.warn('[RootLayout] Erreur de ressource (police) ignorée:', (target as any).href || 'unknown');
        }
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    };

    // Écouter les promesses rejetées non gérées
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // Écouter les erreurs JavaScript synchrones
    window.addEventListener('error', handleError);
    // Écouter les erreurs de ressources (polices, images, etc.)
    document.addEventListener('error', handleResourceError, true);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      document.removeEventListener('error', handleResourceError, true);
    };
  }, [profile, user]);

  // IMPORTANT (Web export): éviter les erreurs d'hydratation React (#418)
  // Rendre null jusqu'à ce que le client soit initialisé pour garantir que
  // le rendu serveur et client sont identiques (tous les deux null au début)
  if (!isClient && Platform.OS === 'web') {
    return null;
  }

  // Sur web, utiliser un thème fixe (DefaultTheme) pour le premier rendu
  // pour garantir que le rendu serveur et client sont identiques
  // Une fois isClient=true, on peut utiliser le colorScheme réel
  const theme = (colorScheme === 'dark' ? DarkTheme : DefaultTheme);

  return (
    <ThemeProvider value={theme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email-firebase" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ai-logger" options={{ headerShown: false }} />
        <Stack.Screen name="admin-custom-foods" options={{ headerShown: false }} />
        <Stack.Screen name="admin-requests" options={{ headerShown: false }} />
        <Stack.Screen name="admin-beta-users" options={{ headerShown: false }} />
        <Stack.Screen name="stats" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
        <Stack.Screen name="version" options={{ headerShown: false }} />
      </Stack>
      {/* StatusBar peut causer des différences d'hydratation, donc on le rend conditionnellement */}
      {isClient && <StatusBar style="auto" />}
    </ThemeProvider>
  );
}

export default function RootLayout() {

  return (
    <TokiThemeProvider>
      <AuthProvider>
        <SessionTrackerProvider>
          <RootLayoutContent />
        </SessionTrackerProvider>
      </AuthProvider>
    </TokiThemeProvider>
  );
}
