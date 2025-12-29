import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { signIn, signUp } from '../lib/firebase-auth';
import { FIREBASE_ENABLED } from '../lib/firebase-config';
import { localSignIn, localSignUp, getCurrentLocalUser } from '../lib/local-auth';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Merci de remplir tous les champs');
      return;
    }

    if (mode === 'signup' && !displayName) {
      Alert.alert('Erreur', 'Merci d\'entrer un nom');
      return;
    }

    setLoading(true);
    try {
      if (FIREBASE_ENABLED) {
        // Mode Firebase
        if (mode === 'signup') {
          await signUp(email, password, displayName);
          // Après inscription réussie, attendre un peu pour que le contexte se mette à jour
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Redirection vers onboarding (nouveau compte)
          router.replace('/onboarding');
        } else {
          const user = await signIn(email, password);
          console.log('[Auth Screen] Connexion réussie, user:', user?.uid);
          
          // Attendre que le contexte d'authentification charge le profil
          // Le contexte devrait mettre à jour le profil via onAuthStateChanged
          // On attend un peu plus longtemps pour s'assurer que le profil est chargé
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Vérifier si le profil existe dans Firestore
          try {
            const { getUserProfile } = await import('../lib/firebase-auth');
            const profile = await getUserProfile(user.uid);
            console.log('[Auth Screen] Profil chargé:', profile ? 'oui' : 'non');
            
            if (profile && profile.onboardingCompleted) {
              // Profil complété, aller directement aux tabs
              router.replace('/(tabs)');
            } else if (profile && !profile.onboardingCompleted) {
              // Profil non complété, aller à onboarding
              router.replace('/onboarding');
            } else {
              // Pas de profil, rediriger vers index qui gérera la navigation
              router.replace('/');
            }
          } catch (profileError) {
            console.error('[Auth Screen] Erreur chargement profil:', profileError);
            // En cas d'erreur, rediriger vers index qui gérera la navigation
            router.replace('/');
          }
        }
      } else {
        // Mode local
        if (mode === 'signup') {
          await localSignUp(email, password, displayName);
          Alert.alert(
            'Compte créé !',
            'Votre compte a été créé. Vous allez recevoir un code de vérification.',
            [{ text: 'OK', onPress: () => router.replace('/verify-email') }]
          );
        } else {
          await localSignIn(email, password);
          const user = await getCurrentLocalUser();
          
          if (user && !user.emailVerified) {
            router.replace('/verify-email');
          } else {
            // Forcer un rechargement complet pour réinitialiser le contexte Auth
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            } else {
              router.replace('/(tabs)');
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Auth Screen] Erreur:', error);
      console.error('[Auth Screen] Error code:', error?.code);
      console.error('[Auth Screen] Error message:', error?.message);
      console.error('[Auth Screen] Full error:', JSON.stringify(error, null, 2));
      
      // Toujours afficher l'erreur, même si elle semble silencieuse
      const errorMessage = error?.message || error?.code || 'Une erreur est survenue. Vérifiez que Firebase Authentication est activé dans Firebase Console.';
      
      // Sur mobile, utiliser Alert.alert, sur web utiliser window.alert aussi pour être sûr
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Erreur d'authentification: ${errorMessage}`);
      }
      
      Alert.alert(
        'Erreur d\'authentification',
        errorMessage,
        [
          { text: 'OK' },
          ...(errorMessage.includes('Authentication') || errorMessage.includes('Firebase') ? [{
            text: 'Voir guide',
            onPress: () => {
              // Ouvrir le guide dans un nouvel onglet
              if (typeof window !== 'undefined') {
                window.open('https://firebase.google.com/docs/auth/web/start', '_blank');
              }
            }
          }] : [])
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🐉 Toki</Text>
        <Text style={styles.tagline}>Nourris ton dragon, apprends la modération</Text>

        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Nom"
              placeholderTextColor="#6b7280"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchMode}
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            <Text style={styles.switchModeText}>
              {mode === 'login' 
                ? "Pas de compte ? Créer un compte" 
                : "Déjà un compte ? Se connecter"}
            </Text>
          </TouchableOpacity>

          {/* Bouton continuer sans compte */}
          {!FIREBASE_ENABLED && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => router.replace('/onboarding')}
            >
              <Text style={styles.skipButtonText}>
                Continuer sans compte (mode local)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 48,
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  button: {
    backgroundColor: '#fbbf24',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#111827',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchMode: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchModeText: {
    color: '#fbbf24',
    fontSize: 14,
  },
  skipButton: {
    marginTop: 32,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
