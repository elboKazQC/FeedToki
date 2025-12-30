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
import { bustWebCache, getCacheStatus } from '../lib/web-cache-buster';
import { useTheme } from '../lib/theme-context';

export default function VersionScreen() {
  const { colors, isDark } = useTheme();
  const [cacheStatus, setCacheStatus] = useState<{
    hasServiceWorker: boolean;
    serviceWorkerCount: number;
    cacheNames: string[];
    lastBustedVersion: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);

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
              // Force le reload même si déjà effectué cette session
              await bustWebCache(true);
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
                  <Text style={styles.infoLabel}>Dernier nettoyage:</Text>
                  <Text style={styles.infoValue}>
                    {cacheStatus.lastBustedVersion || 'Jamais'}
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
