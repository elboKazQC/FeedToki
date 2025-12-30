import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { FIREBASE_ENABLED } from '@/lib/firebase-config';
import { checkIsAdmin } from '@/lib/admin-utils';

export default function Index() {
  const { profile, user, loading } = useAuth();

  // Afficher un loader pendant le chargement
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
});

