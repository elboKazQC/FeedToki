// Écran de gestion d'abonnement
// REFACTORISATION COMPLÈTE pour éviter erreur React #418
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { spacing } from '../constants/design-tokens';
import {
  getUserSubscription,
  isBetaUser,
  hasActiveSubscription,
  getUserRank,
} from '../lib/subscription-utils';
import { UserSubscription } from '../lib/types';
import { checkIsAdmin } from '../lib/admin-utils';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Composant wrapper client-only pour éviter erreur #418
function ClientOnlySubscriptionScreen() {
  const { user, profile } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  // Lire les params depuis l'URL seulement côté client
  const [params, setParams] = useState<{ success?: string; canceled?: string }>({});
  
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isBeta, setIsBeta] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [paymentTime, setPaymentTime] = useState<number | null>(null);

  const loadSubscription = async () => {
    const currentUserId = (user as any)?.uid;
    if (!currentUserId || currentUserId === 'guest') {
      setIsLoading(false);
      return;
    }

    try {
      console.log('[Subscription Screen] Chargement abonnement pour userId:', currentUserId);
      const [sub, beta, rank] = await Promise.all([
        getUserSubscription(currentUserId),
        isBetaUser(currentUserId),
        getUserRank(currentUserId),
      ]);
      
      console.log('[Subscription Screen] Abonnement chargé:', {
        subscription: sub,
        subscriptionStatus: sub?.status,
        subscriptionTier: sub?.tier,
        subscriptionEndDate: sub?.subscriptionEndDate,
        isBeta: beta,
        rank,
      });
      
      if (sub && sub.status !== 'active') {
        console.warn('[Subscription Screen] ⚠️ Abonnement trouvé mais statut:', sub.status, 'tier:', sub.tier);
      } else if (!sub) {
        console.warn('[Subscription Screen] ⚠️ Aucun abonnement trouvé dans Firestore. Le webhook Stripe n\'a peut-être pas été appelé.');
      }
      
      setSubscription(sub);
      setIsBeta(beta);
      setUserRank(rank);
    } catch (error) {
      console.error('[Subscription Screen] Erreur chargement subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lire les params depuis l'URL seulement côté client (web uniquement)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const urlParams: { success?: string; canceled?: string } = {};
        if (searchParams.get('success')) {
          urlParams.success = searchParams.get('success') || undefined;
        }
        if (searchParams.get('canceled')) {
          urlParams.canceled = searchParams.get('canceled') || undefined;
        }
        setParams(urlParams);
      } catch (error) {
        console.error('[Subscription Screen] Erreur lecture params:', error);
      }
    }
  }, []);

  useEffect(() => {
    loadSubscription();
  }, [user]);

  // Détecter le retour de Stripe et recharger l'abonnement
  useEffect(() => {
    if (params.success === 'true') {
      console.log('[Subscription Screen] ✅ Retour de Stripe avec succès - rechargement de l\'abonnement...');
      setShowSuccessMessage(true);
      setJustPaid(true);
      setPaymentTime(Date.now());
      
      const reloadAttempts = [2000, 5000, 10000, 15000];
      const timeouts: NodeJS.Timeout[] = [];
      
      reloadAttempts.forEach((delay, index) => {
        const timeoutId = setTimeout(async () => {
          console.log(`[Subscription Screen] Tentative ${index + 1}/${reloadAttempts.length} de rechargement...`);
          await loadSubscription();
          
          const currentUserId = (user as any)?.uid;
          if (currentUserId) {
            const [sub, beta] = await Promise.all([
              getUserSubscription(currentUserId),
              isBetaUser(currentUserId),
            ]);
            
            const isActive = sub?.status === 'active' && sub?.tier === 'paid';
            let isExpired = false;
            if (sub?.subscriptionEndDate) {
              const endDate = new Date(sub.subscriptionEndDate);
              isExpired = endDate < new Date();
            }
            
            if (isActive && !isExpired) {
              console.log('[Subscription Screen] ✅ Abonnement détecté comme actif!');
              setShowSuccessMessage(false);
              setJustPaid(false);
              
              // Redirection automatique après 5 secondes si on vient de Stripe
              // (donner le temps à l'utilisateur de voir le message de succès)
              if (params.success === 'true') {
                console.log('[Subscription Screen] 🔄 Redirection automatique vers l\'application dans 5 secondes...');
                setTimeout(() => {
                  if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    console.log('[Subscription Screen] 🔄 Redirection vers l\'application...');
                    router.replace('/(tabs)');
                  }
                }, 5000);
              }
            } else {
              console.log('[Subscription Screen] ⏳ Abonnement pas encore actif, statut:', sub?.status, 'tier:', sub?.tier, 'expiré:', isExpired);
            }
          }
        }, delay);
        timeouts.push(timeoutId);
      });
      
      // Nettoyer l'URL après le dernier rechargement (web uniquement)
      if (Platform.OS === 'web') {
        const finalTimeout = setTimeout(() => {
          if (typeof window !== 'undefined') {
            try {
              window.history.replaceState({}, '', '/subscription');
            } catch (error) {
              console.error('[Subscription Screen] Erreur nettoyage URL:', error);
            }
          }
        }, reloadAttempts[reloadAttempts.length - 1] + 1000);
        timeouts.push(finalTimeout);
      }
      
      const resetJustPaidTimeout = setTimeout(() => {
        setJustPaid(false);
      }, 30000);
      timeouts.push(resetJustPaidTimeout);
      
      return () => {
        timeouts.forEach(clearTimeout);
      };
    } else if (params.canceled === 'true') {
      console.log('[Subscription Screen] ❌ Paiement annulé');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.history.replaceState({}, '', '/subscription');
        } catch (error) {
          console.error('[Subscription Screen] Erreur nettoyage URL:', error);
        }
      }
    }
  }, [params.success, params.canceled, user]);

  const handleSubscribe = async () => {
    try {
      const { redirectToCheckout } = await import('../lib/subscription-service');
      const currentUserId = (user as any)?.uid;
      if (!currentUserId) {
        Alert.alert('Erreur', 'Vous devez être connecté pour vous abonner.');
        return;
      }
      await redirectToCheckout(currentUserId);
    } catch (error: any) {
      console.error('[Subscription Screen] Erreur checkout:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Erreur lors de la redirection vers le paiement. Veuillez réessayer.'
      );
    }
  };

  const handleManageSubscription = async () => {
    Alert.alert(
      'Gérer l\'abonnement',
      'La gestion d\'abonnement sera bientôt disponible.',
      [{ text: 'OK' }]
    );
  };

  const handleMigrateUserRanks = async () => {
    const isAdmin = checkIsAdmin(user, profile);
    if (!isAdmin) {
      Alert.alert('Erreur', 'Seuls les admins peuvent exécuter cette migration.');
      return;
    }

    Alert.alert(
      'Migration userRank',
      'Voulez-vous exécuter la migration des userRank pour tous les utilisateurs?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Exécuter',
          onPress: async () => {
            try {
              const functions = getFunctions();
              const migrateUserRanksFunction = httpsCallable(functions, 'migrateUserRanks');
              
              Alert.alert('Migration en cours...', 'Veuillez patienter.');
              
              const result = await migrateUserRanksFunction({});
              const data = result.data as any;
              
              Alert.alert(
                'Migration terminée!',
                `Total: ${data.total}\nMis à jour: ${data.updated}\nIgnorés: ${data.skipped}\nErreurs: ${data.errors}`
              );
            } catch (error: any) {
              console.error('[Subscription Screen] Erreur migration:', error);
              Alert.alert(
                'Erreur',
                error.message || 'Erreur lors de la migration. Vérifiez la console.'
              );
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Chargement...
        </Text>
      </View>
    );
  }

  const currentUserId = (user as any)?.uid;
  if (!currentUserId || currentUserId === 'guest') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.text }]}>
            Connexion requise
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            Veuillez vous connecter pour gérer votre abonnement.
          </Text>
          <Button
            label="Se connecter"
            onPress={() => router.push('/auth')}
            style={styles.button}
          />
        </Card>
      </View>
    );
  }

  // Déterminer le statut
  let statusText = '';
  let statusColor = colors.textSecondary;
  let actionButton: React.ReactNode = null;

  if (isBeta) {
    statusText = `Beta Tester - Gratuit à vie ✅`;
    statusColor = colors.success || colors.primary;
  } else if (subscription?.status === 'active' && subscription?.tier === 'paid') {
    const endDate = subscription.subscriptionEndDate
      ? new Date(subscription.subscriptionEndDate)
      : null;
    const now = new Date();
    const isExpired = endDate ? endDate < now : false;
    
    if (isExpired) {
      statusText = 'Abonnement expiré - Renouveler';
      statusColor = colors.error || colors.textSecondary;
      actionButton = (
        <Button
          label="S'abonner maintenant ($10/mois)"
          onPress={handleSubscribe}
          style={styles.button}
        />
      );
    } else {
      statusText = endDate
        ? `Abonné jusqu'au ${endDate.toLocaleDateString('fr-CA')}`
        : 'Abonné';
      statusColor = colors.success || colors.primary;
      actionButton = (
        <View>
          <Button
            label="Retour à l'application"
            onPress={() => router.replace('/(tabs)')}
            style={styles.button}
          />
          <Button
            label="Gérer l'abonnement"
            onPress={handleManageSubscription}
            variant="secondary"
            style={styles.button}
          />
        </View>
      );
    }
  } else if (justPaid && paymentTime && (Date.now() - paymentTime < 30000)) {
    statusText = 'Activation en cours...';
    statusColor = colors.primary;
    actionButton = null;
  } else {
    statusText = 'Abonnement expiré - Renouveler';
    statusColor = colors.error || colors.textSecondary;
    actionButton = (
      <Button
        label="S'abonner maintenant ($10/mois)"
        onPress={handleSubscribe}
        style={styles.button}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Text style={[styles.title, { color: colors.text }]}>
          Mon Abonnement
        </Text>

        {showSuccessMessage && (
          <View style={[styles.successMessage, { backgroundColor: colors.success || '#4CAF50', padding: spacing.md, borderRadius: 8, marginBottom: spacing.md }]}>
            <Text style={[styles.successText, { color: '#fff' }]}>
              ✅ Paiement réussi ! Votre abonnement est en cours d'activation...
            </Text>
          </View>
        )}

        <View style={styles.statusContainer}>
          <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
            Statut:
          </Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>


        {actionButton}

        <View style={styles.divider} />

        <View style={styles.pricingSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Tarification
          </Text>
          
          <View style={styles.priceBox}>
            <Text style={[styles.price, { color: colors.text }]}>
              $10 CAD/mois
            </Text>
            <Text style={[styles.priceDescription, { color: colors.textSecondary }]}>
              Abonnement mensuel
            </Text>
          </View>

          <View style={styles.featuresList}>
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
                Analyse nutrition IA (7/14/30 jours)
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                La nutrition = 80% du succès fitness
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={[styles.featureBullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                Annulation à tout moment
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Questions fréquentes
          </Text>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              Pourquoi pas de mois gratuit?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Chaque analyse IA génère des coûts. Pour offrir ce service de manière durable, nous demandons un abonnement qui permet de couvrir ces frais dès le début.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              Que se passe-t-il si j'annule?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Vous conservez l'accès jusqu'à la fin de la période payée. Après cela, vous pourrez toujours utiliser l'application en mode manuel (sans IA).
            </Text>
          </View>
        </View>

        {checkIsAdmin(user, profile) && (
          <>
            <View style={styles.divider} />
            <View style={styles.adminSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Outils Admin
              </Text>
              <Button
                label="Migrer userRank (Admin)"
                onPress={handleMigrateUserRanks}
                variant="secondary"
                style={styles.button}
              />
              <Text style={[styles.adminNote, { color: colors.textSecondary }]}>
                Calcule et ajoute le userRank pour tous les utilisateurs existants
              </Text>
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

// Composant principal avec protection SSR
export default function SubscriptionScreen() {
  // État pour désactiver complètement le SSR sur web
  // IMPORTANT: Tous les hooks doivent être déclarés AVANT tout return conditionnel
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // S'assurer que le composant est monté côté client seulement
    setIsMounted(true);
  }, []);

  // Sur web, ne rien rendre pendant le SSR
  // Cette vérification doit être APRÈS tous les hooks
  if (Platform.OS === 'web' && !isMounted) {
    return null; // Retourner null évite tout mismatch d'hydratation
  }

  // Une fois monté, rendre le contenu
  // ClientOnlySubscriptionScreen gère son propre useTheme() en interne
  return <ClientOnlySubscriptionScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  card: {
    padding: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    marginBottom: spacing.xs,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
  },
  rankContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  button: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: spacing.xl,
  },
  pricingSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  priceBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  priceDescription: {
    fontSize: 14,
  },
  featuresList: {
    marginTop: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
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
  faqSection: {
    marginTop: spacing.lg,
  },
  faqItem: {
    marginBottom: spacing.lg,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  adminSection: {
    marginTop: spacing.lg,
  },
  adminNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  successMessage: {
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
