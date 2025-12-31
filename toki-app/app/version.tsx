/**
 * Écran de diagnostic de version
 * Affiche les infos de build et permet de nettoyer les caches web
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getAppVersion, getFormattedAppVersion } from '../lib/app-version';
import { BUILD_DATE, BUILD_VERSION } from '../lib/build-version';
import { bustWebCache, getCacheStatus, forceUpdate } from '../lib/web-cache-buster';
import { useTheme } from '../lib/theme-context';
import { useAuth } from '../lib/auth-context';
import { fullRepair, syncMissingCustomFoods, repairPoints } from '../lib/sync-repair';

export default function VersionScreen() {
  const { colors, isDark } = useTheme();
  const { profile, user } = useAuth();
  const [cacheStatus, setCacheStatus] = useState<{
    hasServiceWorker: boolean;
    serviceWorkerCount: number;
    cacheNames: string[];
    lastBustedVersion: string | null;
    reloadCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<{
    success: boolean;
    points?: { oldBalance: number; newBalance: number; totalSpent: number };
    customFoods?: { localToFirestore: number; firestoreToLocal: number };
    meals?: { entriesFixed: number; itemsRemoved: number; itemsAdded?: number; mealsWithItemsAdded?: number; syncedFromFirestore?: number; syncedToFirestore?: number };
    errors: string[];
  } | null>(null);

  // Charger le status des caches au montage
  useEffect(() => {
    loadCacheStatus();
  }, []);

  const loadCacheStatus = async () => {
    setIsLoading(true);
    try {
      const status = await getCacheStatus();
      setCacheStatus(status);
    } catch (error) {
      console.error('[Version] Failed to load cache status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCleanCache = async () => {
    Alert.alert(
      '🧹 Nettoyer le cache web',
      'Cette action va supprimer tous les caches web (Service Workers, Cache Storage) et recharger la page.\n\nC\'est utile si tu vois encore une ancienne version de l\'app.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Nettoyer et recharger',
          style: 'destructive',
          onPress: async () => {
            setIsCleaning(true);
            try {
              // Passer BUILD_VERSION pour forcer le reload
              await bustWebCache(BUILD_VERSION);
            } catch (error) {
              console.error('[Version] Cache cleanup failed:', error);
              Alert.alert('Erreur', 'Impossible de nettoyer le cache. Essaie de vider le cache de ton navigateur manuellement.');
              setIsCleaning(false);
            }
          },
        },
      ]
    );
  };

  const handleRepairSync = async () => {
    if (!user || !profile) {
      Alert.alert('Erreur', 'Tu dois être connecté pour utiliser la réparation de synchronisation.');
      return;
    }

    const currentUserId = profile.userId || (user as any)?.uid || (user as any)?.id;
    if (!currentUserId || currentUserId === 'guest') {
      Alert.alert('Erreur', 'Utilisateur invalide.');
      return;
    }

    Alert.alert(
      '🔧 Réparation de Synchronisation',
      'Cette action va :\n\n' +
      '1. Recalculer les points à partir des repas\n' +
      '2. Synchroniser les custom foods manquants\n' +
      '3. Réparer les repas avec items invalides\n\n' +
      'Cela peut prendre quelques secondes...',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Réparer',
          onPress: async () => {
            setIsRepairing(true);
            setRepairResult(null);
            try {
              const dailyPointsBudget = profile.dailyPointsBudget || 6;
              const maxPointsCap = profile.maxPointsCap || 12;
              
              const result = await fullRepair(currentUserId, dailyPointsBudget, maxPointsCap);
              setRepairResult(result);
              
              if (result.success) {
                const mealsInfo = [
                  result.meals.syncedFromFirestore && result.meals.syncedFromFirestore > 0 && `${result.meals.syncedFromFirestore} reçus depuis Firestore`,
                  result.meals.syncedToFirestore && result.meals.syncedToFirestore > 0 && `${result.meals.syncedToFirestore} envoyés vers Firestore`,
                  result.meals.itemsAdded && result.meals.itemsAdded > 0 && `${result.meals.itemsAdded} items ajoutés`,
                  result.meals.entriesFixed > 0 && `${result.meals.entriesFixed} corrigés`,
                  result.meals.itemsRemoved > 0 && `${result.meals.itemsRemoved} items retirés`,
                ].filter(Boolean).join(', ') || 'Aucun changement';
                
                Alert.alert(
                  '✅ Réparation terminée',
                  `Points: ${result.points.oldBalance} → ${result.points.newBalance} pts\n` +
                  `Custom foods: ${result.customFoods.localToFirestore} envoyés, ${result.customFoods.firestoreToLocal} reçus\n` +
                  `Repas: ${mealsInfo}`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert(
                  '⚠️ Réparation partielle',
                  `Certaines erreurs sont survenues:\n\n${result.errors.slice(0, 3).join('\n')}${result.errors.length > 3 ? '\n...' : ''}`,
                  [{ text: 'OK' }]
                );
              }
            } catch (error: any) {
              console.error('[Version] Repair failed:', error);
              Alert.alert('Erreur', `Impossible de réparer: ${error?.message || error}`);
            } finally {
              setIsRepairing(false);
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    header: {
      marginBottom: 24,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
      marginLeft: 4,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      paddingVertical: 4,
    },
    infoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
      flex: 1,
      textAlign: 'right',
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    badgeGreen: {
      backgroundColor: isDark ? '#16a34a' : '#dcfce7',
    },
    badgeRed: {
      backgroundColor: isDark ? '#dc2626' : '#fee2e2',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#fff' : '#000',
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonWarning: {
      backgroundColor: isDark ? '#dc2626' : '#ef4444',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    warningBox: {
      backgroundColor: isDark ? '#451a03' : '#fef3c7',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? '#78350f' : '#fbbf24',
    },
    warningTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#fbbf24' : '#78350f',
      marginBottom: 8,
    },
    warningText: {
      fontSize: 14,
      color: isDark ? '#fde047' : '#78350f',
      lineHeight: 20,
    },
    loader: {
      marginVertical: 20,
    },
    repairResult: {
      backgroundColor: isDark ? '#1e3a2e' : '#d1fae5',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    repairResultTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#10b981' : '#065f46',
      marginBottom: 8,
    },
    repairResultText: {
      fontSize: 12,
      color: isDark ? '#a7f3d0' : '#047857',
      marginBottom: 4,
    },
    errorBox: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#7f1d1d' : '#fee2e2',
    },
    errorTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#fca5a5' : '#991b1b',
      marginBottom: 4,
    },
    errorText: {
      fontSize: 11,
      color: isDark ? '#fca5a5' : '#991b1b',
      marginBottom: 2,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🔍 Diagnostic Version</Text>
          <Text style={styles.subtitle}>
            Infos de build et outils de dépannage
          </Text>
        </View>

        {/* Version Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Informations de Build</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version affichée:</Text>
            <Text style={styles.infoValue}>{getFormattedAppVersion()}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version build:</Text>
            <Text style={styles.infoValue}>{BUILD_VERSION}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date de build:</Text>
            <Text style={styles.infoValue}>
              {new Date(BUILD_DATE).toLocaleString('fr-FR')}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plateforme:</Text>
            <Text style={styles.infoValue}>{Platform.OS}</Text>
          </View>
        </View>

        {/* Cache Status (Web uniquement) */}
        {Platform.OS === 'web' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗂️ État des Caches Web</Text>
            
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            ) : cacheStatus ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Service Workers:</Text>
                  <View style={[
                    styles.badge,
                    cacheStatus.hasServiceWorker ? styles.badgeRed : styles.badgeGreen,
                  ]}>
                    <Text style={styles.badgeText}>
                      {cacheStatus.hasServiceWorker 
                        ? `${cacheStatus.serviceWorkerCount} actif(s) ⚠️`
                        : 'Aucun ✅'
                      }
                    </Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cache Storage:</Text>
                  <View style={[
                    styles.badge,
                    cacheStatus.cacheNames.length > 0 ? styles.badgeRed : styles.badgeGreen,
                  ]}>
                    <Text style={styles.badgeText}>
                      {cacheStatus.cacheNames.length > 0
                        ? `${cacheStatus.cacheNames.length} cache(s) ⚠️`
                        : 'Vide ✅'
                      }
                    </Text>
                  </View>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Version en cache:</Text>
                  <Text style={styles.infoValue}>
                    {cacheStatus.lastBustedVersion || 'Aucune'}
                  </Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Compteur reload:</Text>
                  <Text style={styles.infoValue}>
                    {cacheStatus.reloadCount}/3
                  </Text>
                </View>
              </>
            ) : (
              <Text style={styles.infoValue}>Impossible de charger le status</Text>
            )}
          </View>
        )}

        {/* Warning si caches détectés */}
        {Platform.OS === 'web' && cacheStatus && (
          cacheStatus.hasServiceWorker || cacheStatus.cacheNames.length > 0
        ) && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>⚠️ Caches Détectés</Text>
            <Text style={styles.warningText}>
              Des caches web persistants ont été détectés. Ils peuvent empêcher l'affichage
              de la dernière version de l'app. Utilise le bouton ci-dessous pour les nettoyer.
            </Text>
          </View>
        )}

        {/* Sync Repair Section */}
        {user && profile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔧 Réparation de Synchronisation</Text>
            <Text style={styles.warningText}>
              Si tu as des incohérences entre ton PC et ton téléphone (points différents, aliments manquants),
              utilise ce bouton pour réparer automatiquement.
            </Text>
            
            {repairResult && (
              <View style={styles.repairResult}>
                <Text style={styles.repairResultTitle}>
                  {repairResult.success ? '✅ Réparation réussie' : '⚠️ Réparation partielle'}
                </Text>
                {repairResult.points && (
                  <Text style={styles.repairResultText}>
                    Points: {repairResult.points.oldBalance} → {repairResult.points.newBalance} pts
                    {repairResult.points.totalSpent > 0 && ` (${repairResult.points.totalSpent} dépensés)`}
                  </Text>
                )}
                {repairResult.customFoods && (
                  <Text style={styles.repairResultText}>
                    Custom foods: {repairResult.customFoods.localToFirestore} envoyés, {repairResult.customFoods.firestoreToLocal} reçus
                  </Text>
                )}
                {repairResult.meals && (
                  <Text style={styles.repairResultText}>
                    Repas: {[
                      repairResult.meals.syncedFromFirestore && repairResult.meals.syncedFromFirestore > 0 && `${repairResult.meals.syncedFromFirestore} reçus`,
                      repairResult.meals.syncedToFirestore && repairResult.meals.syncedToFirestore > 0 && `${repairResult.meals.syncedToFirestore} envoyés`,
                      repairResult.meals.itemsAdded && repairResult.meals.itemsAdded > 0 && `${repairResult.meals.itemsAdded} items ajoutés`,
                      repairResult.meals.entriesFixed > 0 && `${repairResult.meals.entriesFixed} corrigés`,
                      repairResult.meals.itemsRemoved > 0 && `${repairResult.meals.itemsRemoved} items retirés`,
                    ].filter(Boolean).join(', ') || 'Aucun changement'}
                  </Text>
                )}
                {repairResult.errors.length > 0 && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>Erreurs:</Text>
                    {repairResult.errors.slice(0, 5).map((error, idx) => (
                      <Text key={idx} style={styles.errorText}>• {error}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isRepairing && styles.buttonDisabled]}
              onPress={handleRepairSync}
              disabled={isRepairing}
            >
              {isRepairing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔧 Réparer la synchronisation</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        {Platform.OS === 'web' && (
          <>
            <TouchableOpacity
              style={[styles.button, isCleaning && styles.buttonDisabled]}
              onPress={handleCleanCache}
              disabled={isCleaning}
            >
              {isCleaning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🧹 Nettoyer le cache web</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonWarning, isCleaning && styles.buttonDisabled]}
              onPress={handleForceUpdate}
              disabled={isCleaning}
            >
              {isCleaning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔄 Forcer la mise à jour</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={loadCacheStatus}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>🔄 Recharger le status</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Info pour mobile */}
        {Platform.OS !== 'web' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>ℹ️ Mobile</Text>
            <Text style={styles.warningText}>
              Sur mobile, les problèmes de cache sont rares. Si tu vois une ancienne version,
              essaie de fermer complètement l'app et de la rouvrir.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
