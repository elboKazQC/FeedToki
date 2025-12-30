import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { resendEmailVerification, getCurrentUser } from '../lib/firebase-auth';
import { reload } from 'firebase/auth';
import { auth, FIREBASE_ENABLED } from '../lib/firebase-config';

export default function VerifyEmailFirebaseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    // Récupérer l'email de l'utilisateur
    if (user && FIREBASE_ENABLED && 'email' in user) {
      setEmail(user.email || '');
    } else {
      // Pas d'utilisateur Firebase, rediriger vers auth
      router.replace('/auth');
    }
  }, [user, router]);

  // Vérifier périodiquement si l'email a été vérifié
  useEffect(() => {
    if (!user || !FIREBASE_ENABLED || !('reload' in user)) {
      return;
    }

    const checkEmailVerification = async () => {
      try {
        const currentUser = getCurrentUser();
        if (currentUser) {
          await reload(currentUser);
          if (currentUser.emailVerified) {
            // Email vérifié, recharger la page pour mettre à jour le contexte
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else {
              router.replace('/');
            }
          }
        }
      } catch (error) {
        console.error('[VerifyEmailFirebase] Erreur vérification:', error);
      }
    };

    // Vérifier immédiatement
    checkEmailVerification();

    // Vérifier toutes les 3 secondes
    const interval = setInterval(checkEmailVerification, 3000);

    return () => clearInterval(interval);
  }, [user, router]);

  const handleResendEmail = async () => {
    if (!user || !FIREBASE_ENABLED || !('email' in user)) {
      Alert.alert('Erreur', 'Utilisateur non trouvé');
      return;
    }

    setLoading(true);
    try {
      await resendEmailVerification(user as any);
      
      const message = `Un nouvel email de vérification a été envoyé à ${email}.\n\nVeuillez vérifier votre boîte mail (et vos spams).`;
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Email renvoyé ! ✅\n\n' + message);
      }
      
      Alert.alert('Email renvoyé ! ✅', message);
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors de l\'envoi de l\'email';
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Erreur: ${errorMessage}`);
      }
      
      Alert.alert('Erreur', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    try {
      const currentUser = getCurrentUser();
      if (currentUser) {
        await reload(currentUser);
        if (currentUser.emailVerified) {
          // Email vérifié, recharger la page
          if (typeof window !== 'undefined') {
            window.location.reload();
          } else {
            router.replace('/');
          }
        } else {
          Alert.alert('Email non vérifié', 'Veuillez cliquer sur le lien dans l\'email de vérification que nous vous avons envoyé.');
        }
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Erreur lors de la vérification');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📧</Text>
        <Text style={styles.title}>Vérifiez votre email</Text>
        
        <Text style={styles.description}>
          Un email de vérification a été envoyé à :
        </Text>
        <Text style={styles.email}>{email}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ⚠️ Pour utiliser l'application, vous devez vérifier votre adresse email.{'\n\n'}
            1. Vérifiez votre boîte mail (et vos spams){'\n'}
            2. Cliquez sur le lien de vérification{'\n'}
            3. Revenez sur cette page - vous serez redirigé automatiquement
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.checkButton, checking && styles.buttonDisabled]}
          onPress={handleCheckVerification}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔍 Vérifier maintenant</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resendButton, loading && styles.buttonDisabled]}
          onPress={handleResendEmail}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fbbf24" />
          ) : (
            <Text style={[styles.buttonText, styles.resendButtonText]}>
              📤 Renvoyer l'email
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/auth')}
        >
          <Text style={styles.backButtonText}>← Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fbbf24',
    textAlign: 'center',
    marginBottom: 32,
  },
  infoBox: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    maxWidth: 400,
  },
  infoText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 22,
  },
  button: {
    width: '100%',
    maxWidth: 400,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  checkButton: {
    backgroundColor: '#3b82f6',
  },
  resendButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButtonText: {
    color: '#fbbf24',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});

