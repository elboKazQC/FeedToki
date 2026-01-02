// Modal paywall pour protéger l'accès à l'IA meal logger
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { spacing } from '../constants/design-tokens';
import { useAuth } from '../lib/auth-context';

type PaywallModalProps = {
  onSubscribe?: () => void;
  onClose?: () => void;
  visible?: boolean;
};

export function PaywallModal({ onSubscribe, onClose, visible = true }: PaywallModalProps) {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    console.log('[PaywallModal] handleSubscribe appelé');
    if (onSubscribe) {
      // onSubscribe gère la fermeture du modal
      onSubscribe();
      return;
    }

    // Si pas de callback personnalisé, essayer d'appeler directement redirectToCheckout
    try {
      setIsLoading(true);
      const currentUserId = (user as any)?.uid;
      console.log('[PaywallModal] Début abonnement, userId:', currentUserId);
      
      if (!currentUserId || currentUserId === 'guest') {
        console.log('[PaywallModal] Utilisateur non connecté, redirection vers /subscription');
        // Rediriger vers /subscription si pas connecté
        router.push('/subscription');
        // Fermer le modal
        if (onClose) {
          onClose();
        }
        return;
      }

      // Appeler directement redirectToCheckout
      console.log('[PaywallModal] Appel redirectToCheckout...');
      const { redirectToCheckout } = await import('../lib/subscription-service');
      await redirectToCheckout(currentUserId);
      // Si on arrive ici, la redirection a fonctionné (window.location.href devrait changer)
      console.log('[PaywallModal] Redirection vers Stripe effectuée');
      // Le modal sera fermé automatiquement par la redirection de page
    } catch (error: any) {
      console.error('[PaywallModal] Erreur checkout:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Erreur lors de la redirection vers le paiement. Redirection vers la page d\'abonnement...'
      );
      // Fallback: rediriger vers /subscription
      router.push('/subscription');
      // Fermer le modal
      if (onClose) {
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]} pointerEvents="box-none">
        <View pointerEvents="auto">
          <Card style={[styles.modal, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Abonnement Requis
          </Text>
          
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            FeedToki est une application québécoise développée par un seul développeur indépendant.
          </Text>
          
          <View style={styles.explanation}>
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              Votre abonnement me permet de continuer à améliorer l'application, d'ajouter de nouvelles fonctionnalités et de compétitionner avec les grandes applications internationales. Ensemble, construisons une alternative québécoise!
            </Text>
          </View>

          <View style={styles.features}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              Avec votre abonnement:
            </Text>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                50 analyses IA par jour incluses
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                Analyse de repas en texte naturel
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                Annulation à tout moment
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label={isLoading ? "Redirection..." : "S'abonner maintenant ($10/mois)"}
              onPress={handleSubscribe}
              style={styles.subscribeButton}
              loading={isLoading}
              disabled={isLoading}
            />
            <TouchableOpacity
              onPress={() => {
                console.log('[PaywallModal] Cancel cliqué');
                if (onClose) {
                  onClose();
                } else {
                  router.back();
                }
              }}
              style={styles.cancelButton}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              console.log('[PaywallModal] LearnMore cliqué');
              router.push('/subscription');
              // Fermer le modal après la redirection
              if (onClose) {
                onClose();
              }
            }}
            style={styles.learnMore}
          >
            <Text style={[styles.learnMoreText, { color: colors.primary }]}>
              En savoir plus sur les abonnements
            </Text>
          </TouchableOpacity>
        </Card>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.xl,
    borderRadius: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 24,
  },
  explanation: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  features: {
    marginBottom: spacing.xl,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  featureBullet: {
    fontSize: 18,
    marginRight: spacing.sm,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    marginBottom: spacing.md,
  },
  subscribeButton: {
    marginBottom: spacing.sm,
  },
  cancelButton: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
  },
  learnMore: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  learnMoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
