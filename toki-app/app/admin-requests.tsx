import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { FoodRequest } from './food-request';
import { checkIsAdmin } from '../lib/admin-utils';

const REQUESTS_KEY = 'feedtoki_food_requests_v1';

export default function AdminRequestsScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const userEmail = profile?.email || (user as any)?.email || '';
  const isAdmin = checkIsAdmin(user, profile);

  // Charger les demandes
  useEffect(() => {
    const loadRequests = async () => {
      try {
        const raw = await AsyncStorage.getItem(REQUESTS_KEY);
        if (raw) {
          const parsed: FoodRequest[] = JSON.parse(raw);
          // Trier par date décroissante
          parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRequests(parsed);
        }
      } catch (e) {
        console.error('Erreur chargement demandes:', e);
      } finally {
        setLoading(false);
      }
    };
    loadRequests();
  }, []);

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    const updated = requests.map(r => 
      r.id === id ? { ...r, status } : r
    );
    setRequests(updated);
    await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
  };

  const deleteRequest = async (id: string) => {
    Alert.alert(
      'Supprimer',
      'Supprimer cette demande?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const updated = requests.filter(r => r.id !== id);
            setRequests(updated);
            await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
          },
        },
      ]
    );
  };

  // Exporter les demandes en JSON pour l'agent IA
  const exportRequestsForAgent = async () => {
    const pendingOnly = requests.filter(r => r.status === 'pending');
    const exportData = {
      lastExport: new Date().toISOString(),
      exportedBy: userEmail,
      totalPending: pendingOnly.length,
      requests: pendingOnly.map(r => ({
        id: r.id,
        foodName: r.foodName,
        brand: r.brand || null,
        portion: r.portion || null,
        calories: r.calories || null,
        protein: r.protein || null,
        carbs: r.carbs || null,
        fat: r.fat || null,
        notes: r.notes || null,
        userEmail: r.userEmail,
        createdAt: r.createdAt,
      })),
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    
    try {
      await Clipboard.setStringAsync(jsonString);
      Alert.alert(
        '📋 Copié!',
        `${pendingOnly.length} demande(s) copiée(s) dans le presse-papiers.\n\nColle ce JSON dans food-requests.json puis demande à l'agent IA de les traiter.`
      );
    } catch (error) {
      console.warn('[Admin] Export clipboard failed:', error);
      // Fallback: afficher le JSON
      Alert.alert('Export JSON', jsonString);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-CA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: FoodRequest['status']) => {
    switch (status) {
      case 'pending': return { text: '⏳ En attente', color: '#f59e0b' };
      case 'approved': return { text: '✅ Approuvée', color: '#10b981' };
      case 'rejected': return { text: '❌ Refusée', color: '#ef4444' };
    }
  };

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

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const processedRequests = requests.filter(r => r.status !== 'pending');

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>← Retour</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>📋 Demandes d&apos;aliments</Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          {pendingRequests.length} demande{pendingRequests.length !== 1 ? 's' : ''} en attente
        </Text>

        {/* Bouton Export pour Agent IA */}
        {pendingRequests.length > 0 && (
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={exportRequestsForAgent}
          >
            <Text style={styles.exportButtonText}>
              🤖 Exporter pour Agent IA ({pendingRequests.length})
            </Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <Text style={[styles.loading, { color: colors.icon }]}>Chargement...</Text>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.icon }]}>
              Aucune demande pour l&apos;instant
            </Text>
          </View>
        ) : (
          <>
            {/* Demandes en attente */}
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  ⏳ En attente ({pendingRequests.length})
                </Text>
                {pendingRequests.map(req => (
                  <View 
                    key={req.id} 
                    style={[styles.requestCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}
                  >
                    <View style={styles.requestHeader}>
                      <Text style={[styles.foodName, { color: colors.text }]}>{req.foodName}</Text>
                      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={styles.badgeText}>⏳ En attente</Text>
                      </View>
                    </View>
                    
                    {req.brand && (
                      <Text style={[styles.detail, { color: colors.icon }]}>🏷️ {req.brand}</Text>
                    )}
                    {req.portion && (
                      <Text style={[styles.detail, { color: colors.icon }]}>📏 {req.portion}</Text>
                    )}
                    
                    {(req.calories || req.protein || req.carbs || req.fat) && (
                      <View style={styles.nutritionInfo}>
                        {req.calories && <Text style={styles.nutritionText}>🔥 {req.calories} kcal</Text>}
                        {req.protein && <Text style={styles.nutritionText}>🥩 {req.protein}g</Text>}
                        {req.carbs && <Text style={styles.nutritionText}>🍞 {req.carbs}g</Text>}
                        {req.fat && <Text style={styles.nutritionText}>🧈 {req.fat}g</Text>}
                      </View>
                    )}
                    
                    {req.notes && (
                      <Text style={[styles.notes, { color: colors.icon }]}>📝 {req.notes}</Text>
                    )}
                    
                    <Text style={[styles.meta, { color: colors.icon }]}>
                      👤 {req.userEmail} • {formatDate(req.createdAt)}
                    </Text>
                    
                    <View style={styles.actions}>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => updateRequestStatus(req.id, 'approved')}
                      >
                        <Text style={styles.actionButtonText}>✅ Approuver</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => updateRequestStatus(req.id, 'rejected')}
                      >
                        <Text style={styles.actionButtonText}>❌ Refuser</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => deleteRequest(req.id)}
                      >
                        <Text style={styles.actionButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Demandes traitées */}
            {processedRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  📜 Historique ({processedRequests.length})
                </Text>
                {processedRequests.map(req => {
                  const badge = getStatusBadge(req.status);
                  return (
                    <View 
                      key={req.id} 
                      style={[styles.requestCard, styles.requestCardSmall, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}
                    >
                      <View style={styles.requestHeader}>
                        <Text style={[styles.foodNameSmall, { color: colors.text }]}>{req.foodName}</Text>
                        <Text style={[styles.badgeSmall, { color: badge.color }]}>{badge.text}</Text>
                      </View>
                      <Text style={[styles.metaSmall, { color: colors.icon }]}>
                        {req.userEmail} • {formatDate(req.createdAt)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Instructions pour moi */}
        <View style={[styles.infoBox, { backgroundColor: activeTheme === 'dark' ? '#1e3a5f' : '#e0f2fe' }]}>
          <Text style={[styles.infoTitle, { color: activeTheme === 'dark' ? '#93c5fd' : '#1e40af' }]}>
            💡 Pour ajouter un aliment
          </Text>
          <Text style={[styles.infoText, { color: activeTheme === 'dark' ? '#bfdbfe' : '#1e3a8a' }]}>
            1. Approuve la demande ci-dessus{'\n'}
            2. Demande à l&apos;agent d&apos;ajouter l&apos;aliment dans food-db.ts{'\n'}
            3. Fournis: nom, calories, protéines, glucides, lipides, tags
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    fontSize: 16,
    color: '#e5e7eb',
    textAlign: 'center',
    marginTop: 40,
  },
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  loading: {
    textAlign: 'center',
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestCardSmall: {
    padding: 12,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  foodNameSmall: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeSmall: {
    fontSize: 12,
  },
  detail: {
    fontSize: 13,
    marginBottom: 4,
  },
  nutritionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  nutritionText: {
    fontSize: 12,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    color: '#374151',
  },
  notes: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  meta: {
    fontSize: 11,
    marginTop: 8,
  },
  metaSmall: {
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  approveButton: {
    backgroundColor: '#10b981',
    flex: 1,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#6b7280',
    flex: 1,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  accessDeniedEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 24,
  },
  backButtonCentered: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonCenteredText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
