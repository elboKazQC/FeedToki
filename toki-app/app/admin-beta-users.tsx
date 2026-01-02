// Page admin pour débloquer les comptes beta testers
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { checkIsAdmin } from '../lib/admin-utils';
import { createSubscription } from '../lib/subscription-utils';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing } from '../constants/design-tokens';

export default function AdminBetaUsersScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];

  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userEmail = profile?.email || (user as any)?.email || '';
  const isAdmin = checkIsAdmin(user, profile);
  const currentUserId = (user as any)?.uid || '';

  // Vérifier si admin
  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.accessDeniedEmoji}>🔒</Text>
        <Text style={[styles.accessDeniedText, { color: colors.text }]}>
          Accès réservé aux administrateurs
        </Text>
        <TouchableOpacity style={styles.backButtonCentered} onPress={() => router.back()}>
          <Text style={styles.backButtonCenteredText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleUnlock = async (targetUserId: string) => {
    if (!targetUserId || targetUserId.trim() === '') {
      const msg = 'Veuillez entrer un userId valide';
      setErrorMessage(msg);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Erreur', msg);
      }
      return;
    }

    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      console.log('[Admin Beta Users] Déblocage de l\'utilisateur:', targetUserId);
      
      // Créer la subscription beta
      await createSubscription(targetUserId, 'beta', 'active');
      
      const successMsg = `✅ Compte débloqué avec succès!\n\nUserId: ${targetUserId}\nSubscription: beta / active`;
      console.log('[Admin Beta Users]', successMsg);
      
      setSuccessMessage(successMsg);
      
      // Afficher aussi une alerte
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(successMsg);
      } else {
        Alert.alert('✅ Succès', `Compte débloqué avec succès!\n\nUserId: ${targetUserId}`);
      }
      
      // Réinitialiser le champ
      setUserId('');
      
    } catch (error: any) {
      console.error('[Admin Beta Users] Erreur déblocage:', error);
      const errorMsg = error.message || 'Erreur lors du déblocage du compte';
      setErrorMessage(errorMsg);
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Erreur: ${errorMsg}`);
      } else {
        Alert.alert('Erreur', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockMyAccount = async () => {
    if (!currentUserId) {
      const msg = 'Impossible de déterminer votre userId';
      setErrorMessage(msg);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Erreur', msg);
      }
      return;
    }
    
    await handleUnlock(currentUserId);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>← Retour</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>🔓 Débloquer Comptes Beta</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          Débloquer manuellement les comptes des beta testers
        </Text>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Text style={[styles.instructionsTitle, { color: colors.text }]}>Instructions</Text>
          <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
            1. Allez dans Firebase Console {'>'} Authentication {'>'} Users{'\n'}
            2. Trouvez le userId du beta tester{'\n'}
            3. Copiez le userId et collez-le ci-dessous{'\n'}
            4. Cliquez sur "Débloquer en tant que Beta"
          </Text>
        </Card>

        {/* Message de succès */}
        {successMessage && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* Message d'erreur */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Formulaire de déblocage */}
        <Card style={styles.formCard}>
          <Text style={[styles.label, { color: colors.text }]}>User ID</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              color: colors.text,
              borderColor: colors.border 
            }]}
            value={userId}
            onChangeText={(text) => {
              setUserId(text);
              setSuccessMessage(null);
              setErrorMessage(null);
            }}
            placeholder="Collez le userId ici"
            placeholderTextColor={colors.icon}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button
            onPress={() => handleUnlock(userId.trim())}
            disabled={loading || !userId.trim()}
            style={styles.unlockButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>🔓 Débloquer en tant que Beta</Text>
            )}
          </Button>
        </Card>

        {/* Bouton pour débloquer son propre compte */}
        {currentUserId && (
          <Card style={styles.quickUnlockCard}>
            <Text style={[styles.quickUnlockTitle, { color: colors.text }]}>
              Débloquer mon compte
            </Text>
            <Text style={[styles.quickUnlockText, { color: colors.textSecondary }]}>
              Débloquer rapidement votre propre compte (userId: {currentUserId.substring(0, 20)}...)
            </Text>
            <Button
              onPress={handleUnlockMyAccount}
              disabled={loading}
              style={styles.quickUnlockButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔓 Débloquer mon compte</Text>
              )}
            </Button>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    fontSize: 16,
  },
  backButtonCentered: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  backButtonCenteredText: {
    fontSize: 16,
    color: '#374151',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  accessDeniedEmoji: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  accessDeniedText: {
    fontSize: 18,
    textAlign: 'center',
  },
  instructionsCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 16,
    marginBottom: spacing.md,
    minHeight: 44,
  },
  unlockButton: {
    marginTop: spacing.xs,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  quickUnlockCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: '#f0f9ff',
  },
  quickUnlockTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  quickUnlockText: {
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  quickUnlockButton: {
    marginTop: spacing.xs,
  },
  successBox: {
    backgroundColor: '#d1fae5',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  successText: {
    color: '#065f46',
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#991b1b',
    fontSize: 14,
    lineHeight: 20,
  },
});
