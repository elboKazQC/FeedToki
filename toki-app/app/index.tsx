import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

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

  // Cas spécial: email non vérifié (mode local)
  if ((profile as any).emailVerified === false) {
    return <Redirect href="/verify-email" />;
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

