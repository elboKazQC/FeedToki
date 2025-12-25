import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentLocalUser, verifyEmail, resendVerificationCode } from '../lib/local-auth';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const user = await getCurrentLocalUser();
      if (!user) {
        // Pas d'utilisateur connecté, retour à l'auth
        router.replace('/auth');
        return;
      }

      if (user.emailVerified) {
        // Déjà vérifié, continuer vers l'app
        router.replace('/onboarding');
        return;
      }

      setUserId(user.id);
      setEmail(user.email);
      setVerificationCode(user.verificationCode || '');
    } catch (error) {
      console.error('Erreur chargement utilisateur:', error);
      Alert.alert('Erreur', 'Impossible de charger les données utilisateur');
    }
  };

  const handleVerify = async () => {
    const cleanCode = code.replace(/\s/g, '').trim();
    if (cleanCode.length !== 6) {
      if (typeof window !== 'undefined') {
        window.alert('Le code doit contenir 6 chiffres');
      } else {
        Alert.alert('Erreur', 'Le code doit contenir 6 chiffres');
      }
      return;
    }

    setLoading(true);
    try {
      const success = await verifyEmail(userId, cleanCode);
      
      if (success) {
        // Naviguer directement vers onboarding sans attendre confirmation
        router.replace('/onboarding');
      }
    } catch (error: any) {
      const msg = error.message || 'Code de vérification incorrect';
      if (typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      const newCode = await resendVerificationCode(userId);
      setVerificationCode(newCode);
      Alert.alert('Code renvoyé', 'Un nouveau code de vérification a été généré');
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de renvoyer le code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Vérifiez votre email</Text>
        
        <Text style={styles.description}>
          Un code de vérification a été envoyé à
        </Text>
        <Text style={styles.email}>{email}</Text>

        {/* Affichage du code (simulation - à retirer en production) */}
        {verificationCode && (
          <View style={styles.codeDisplay}>
            <Text style={styles.codeLabel}>Votre code de vérification :</Text>
            <Text style={styles.codeText}>{verificationCode}</Text>
            <Text style={styles.codeNote}>
              (En production, ce code sera envoyé par email)
            </Text>
          </View>
        )}

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Entrez le code à 6 chiffres"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Vérification...' : 'Vérifier'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendCode}
          disabled={loading}
        >
          <Text style={styles.resendText}>
            Vous n'avez pas reçu le code ? Renvoyer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A90E2',
    textAlign: 'center',
    marginBottom: 30,
  },
  codeDisplay: {
    backgroundColor: '#F0F8FF',
    borderWidth: 2,
    borderColor: '#4A90E2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
    letterSpacing: 4,
    marginBottom: 8,
  },
  codeNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '600',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButton: {
    padding: 12,
    alignItems: 'center',
  },
  resendText: {
    color: '#4A90E2',
    fontSize: 14,
  },
});
