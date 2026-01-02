import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { FIREBASE_ENABLED } from '@/lib/firebase-config';
import { checkIsAdmin } from '@/lib/admin-utils';
import { useEffect, useState } from 'react';

export default function Index() {
  const { profile, user, loading } = useAuth();
  const [error, setError] = useState<Error | null>(null);
  
  // État pour rendu côté client uniquement (évite erreurs d'hydratation #418 sur web)
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Gestion d'erreur globale pour éviter les pages blanches (web uniquement)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      // Ignorer les erreurs de police (MaterialIcons) qui peuvent bloquer Safari mobile
      if (event.message?.includes('Failed to decode downloaded font') || 
          event.message?.includes('OTS parsing error') ||
          event.filename?.includes('MaterialIcons') ||
          event.filename?.includes('.ttf')) {
        // Ignorer silencieusement les erreurs de police pour éviter les pages blanches
        if (__DEV__) {
          console.warn('[Index] Erreur de police ignorée (non-bloquant):', event.message);
        }
        event.preventDefault();
        return false;
      }
      
      console.error('[Index] Erreur JavaScript capturée:', event.error);
      // Empêcher la propagation pour éviter les pages blanches (Safari mobile)
      event.preventDefault();
      setError(event.error);
      return false;
    };

    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  // IMPORTANT (Web export): éviter les erreurs d'hydratation React (#418)
  // Ce return conditionnel doit être APRÈS tous les hooks
  if (!isClient) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  // Afficher un message d'erreur si une erreur est survenue
  if (error) {
    const handleReload = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.reload();
      }
    };

    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Une erreur est survenue</Text>
        <Text style={styles.errorDetail}>{error.message}</Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity onPress={handleReload}>
            <Text style={styles.errorAction}>Recharger la page</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Afficher un loader pendant le chargement
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  try {
    // Pas de profil = rediriger vers auth
    if (!profile) {
      return <Redirect href="/auth" />;
    }

    // Cas spécial: email non vérifié - rediriger vers auth qui affichera le message
    // Exception: les admins peuvent bypasser la vérification email
    const isEmailVerified = (user as any)?.emailVerified ?? (profile as any)?.emailVerified ?? true;
    const isAdmin = checkIsAdmin(user, profile);
    if (!isEmailVerified && user && !isAdmin) {
      if (FIREBASE_ENABLED && 'email' in user) {
        // Mode Firebase: rediriger vers auth qui affichera l'UI de vérification
        return <Redirect href="/auth" />;
      } else {
        // Mode local: utiliser l'écran existant
        return <Redirect href="/verify-email" />;
      }
    }

    // Profil non complété = rediriger vers onboarding
    if (!profile.onboardingCompleted) {
      return <Redirect href="/onboarding" />;
    }

    // Profil complété = rediriger vers l'app principale
    return <Redirect href="/(tabs)" />;
  } catch (err) {
    // Capturer toute erreur de rendu pour éviter la page blanche
    console.error('[Index] Erreur lors du rendu:', err);
    
    const handleGoToAuth = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
    };

    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Erreur de navigation</Text>
        <Text style={styles.errorDetail}>{err instanceof Error ? err.message : 'Erreur inconnue'}</Text>
        {Platform.OS === 'web' && (
          <TouchableOpacity onPress={handleGoToAuth}>
            <Text style={styles.errorAction}>Retour à la connexion</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorDetail: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  errorAction: {
    color: '#4ECDC4',
    fontSize: 16,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});

