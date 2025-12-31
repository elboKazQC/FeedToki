import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
// import { spacing } from '../constants/design-tokens';
import { signIn, signUp, resendEmailVerification, getCurrentUser, signOut } from '../lib/firebase-auth';
import { FIREBASE_ENABLED } from '../lib/firebase-config';
import { localSignIn, localSignUp, getCurrentLocalUser } from '../lib/local-auth';
import { useAuth } from '../lib/auth-context';
import { reload } from 'firebase/auth';
import { checkIsAdmin } from '../lib/admin-utils';

export default function AuthScreen() {
  // Tous les hooks doivent être déclarés en premier, dans le même ordre à chaque render
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  // Cooldown pour renvoi d'email (30 secondes)
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);
  
  // Vérifier périodiquement si l'email a été vérifié (doit être déclaré avant les fonctions)
  useEffect(() => {
    // Ne vérifier que si l'utilisateur Firebase est connecté et email non vérifié
    if (!FIREBASE_ENABLED || !user || !('email' in user) || (user as any).emailVerified) {
      return;
    }
    
    const checkVerification = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser && !currentUser.emailVerified) {
          await reload(currentUser);
          if (currentUser.emailVerified) {
            // Email vérifié, recharger la page
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }
        }
      } catch (error) {
        // Ignorer les erreurs silencieusement (ex: utilisateur déjà déconnecté)
        console.error('[Auth Screen] Erreur vérification email:', error);
      }
    };
    
    // Vérifier immédiatement puis toutes les 3 secondes
    checkVerification();
    const interval = setInterval(checkVerification, 3000);
    
    return () => clearInterval(interval);
  }, [user]);
  
  // Vérifier si l'utilisateur est connecté mais email non vérifié (calculé après les hooks)
  const isFirebaseUser = FIREBASE_ENABLED && user && 'email' in user;
  const isEmailVerified = isFirebaseUser ? (user as any).emailVerified : true;
  const isAdmin = checkIsAdmin(user, profile);
  // Ne pas afficher la vérification email pour les admins (bypass)
  const showEmailVerification = isFirebaseUser && !isEmailVerified && !isAdmin;
  const userEmail = isFirebaseUser ? (user as any).email : '';
  
  // Fonction pour renvoyer l'email de vérification
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resendLoading || !user || !isFirebaseUser) return;
    
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await resendEmailVerification(user as any);
      setResendSuccess(true);
      setResendCooldown(30); // Cooldown de 30 secondes
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('✅ Courriel envoyé !\n\n⚠️ IMPORTANT : Vérifiez votre dossier SPAM/COURRIER INDÉSIRABLE. L\'email s\'y trouve très probablement.');
      }
    } catch (error: any) {
      let errorMessage = 'Erreur lors de l\'envoi de l\'email';
      
      // Messages d'erreur Firebase propres
      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Trop de demandes. Veuillez attendre quelques minutes.';
        setResendCooldown(60); // Cooldown plus long si trop de demandes
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Utilisateur non trouvé.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Erreur: ${errorMessage}`);
      }
      Alert.alert('Erreur', errorMessage);
    } finally {
      setResendLoading(false);
    }
  };
  
  // Fonction pour se déconnecter
  const handleSignOut = async () => {
    try {
      if (FIREBASE_ENABLED && user) {
        await signOut();
      } else {
        const { localSignOut } = await import('../lib/local-auth');
        await localSignOut();
      }
      // Recharger la page pour réinitialiser l'état
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur lors de la déconnexion');
    }
  };
  
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
          console.log('[Auth Screen] Début création compte pour:', email);
          const user = await signUp(email, password, displayName);
          console.log('[Auth Screen] Compte créé avec succès, user ID:', user?.uid);
          setLoading(false);
          
          // Email de vérification envoyé automatiquement par signUp
          const message = `Un email de vérification a été envoyé à ${email}.\n\n⚠️ IMPORTANT : L'email se trouve très probablement dans votre dossier SPAM/COURRIER INDÉSIRABLE.\n\nVeuillez aller le chercher et cliquer sur le lien de vérification. Vous pouvez continuer, mais certaines fonctionnalités (comme l'IA) nécessitent une vérification email.`;
          
          console.log('[Auth Screen] Affichage de l\'alerte de confirmation...');
          
          // Sur web, utiliser window.alert en plus pour être sûr que l'utilisateur voit le message
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            console.log('[Auth Screen] Affichage window.alert (web)');
            window.alert('Compte créé ! ✅\n\n' + message);
          }
          
          console.log('[Auth Screen] Affichage Alert.alert');
          Alert.alert(
            'Compte créé ! ✅',
            message,
            [{ 
              text: 'J\'ai compris, continuer', 
              onPress: () => {
                console.log('[Auth Screen] Bouton "Continuer" cliqué, redirection vers onboarding');
                // Après inscription réussie, attendre un peu pour que le contexte se mette à jour
                setTimeout(() => {
                  router.replace('/onboarding');
                }, 500);
              }
            }]
          );
          console.log('[Auth Screen] Alert.alert appelé, return...');
          return; // Important : return pour éviter d'exécuter le code après
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

        {/* Affichage si email non vérifié */}
        {showEmailVerification ? (
          <View style={styles.verificationBox}>
            <Text style={styles.verificationTitle}>⚠️ Ton email n&apos;est pas vérifié</Text>
            <Text style={styles.verificationText}>
              Un email de vérification a été envoyé à :{'\n'}
              <Text style={styles.verificationEmail}>{userEmail}</Text>
              {'\n\n'}
              <Text style={styles.spamWarning}>
                🔍 IMPORTANT : L&apos;email se trouve très probablement dans ton dossier SPAM/COURRIER INDÉSIRABLE. Va le chercher là-bas !
              </Text>
            </Text>
            
            {resendSuccess && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ Courriel envoyé !</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.resendButton, (resendCooldown > 0 || resendLoading) && styles.buttonDisabled]}
              onPress={handleResendEmail}
              disabled={resendCooldown > 0 || resendLoading}
            >
              {resendLoading ? (
                <ActivityIndicator color="#fbbf24" />
              ) : (
                <Text style={styles.resendButtonText}>
                  {resendCooldown > 0 
                    ? `Renvoyer le mail (${resendCooldown}s)`
                    : '📤 Renvoyer le mail'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutButtonText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}
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
  verificationBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  verificationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 16,
    textAlign: 'center',
  },
  verificationText: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  verificationEmail: {
    fontWeight: '600',
    color: '#fbbf24',
  },
  spamWarning: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: '#065f46',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  successText: {
    color: '#10b981',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fbbf24',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  resendButtonText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
