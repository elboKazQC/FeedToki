import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { Colors } from '@/constants/theme';
import { db } from '@/lib/firebase-config';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { FoodItem } from '@/lib/food-db';

import { checkIsAdmin } from '@/lib/admin-utils';

type CustomFoodWithUser = FoodItem & {
  userId: string;
  userEmail?: string;
  createdAt?: string;
  usageCount?: number; // Nombre de fois que cet aliment a été utilisé
};

export default function AdminCustomFoodsScreen() {
  const { profile, user } = useAuth();
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  
  const [customFoods, setCustomFoods] = useState<CustomFoodWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFood, setSelectedFood] = useState<CustomFoodWithUser | null>(null);
  
  const userEmail = profile?.email || (user as any)?.email || '';
  const isAdmin = checkIsAdmin(user, profile);

  // Charger tous les aliments personnalisés depuis tous les utilisateurs
  useEffect(() => {
    const loadAllCustomFoods = async () => {
      if (!db || !isAdmin) {
        setLoading(false);
        return;
      }

      try {
        // D'abord, obtenir tous les utilisateurs (via la collection users)
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        const allCustomFoods: CustomFoodWithUser[] = [];
        const userEmailMap: Record<string, string> = {};

        // Pour chaque utilisateur, charger ses custom foods
        for (const userDoc of usersSnapshot.docs) {
          const userId = userDoc.id;
          
          // Charger l'email de l'utilisateur depuis son profil
          try {
            const userProfileDoc = await getDoc(doc(getDb(), 'users', userId));
            if (userProfileDoc.exists()) {
              const profileData = userProfileDoc.data();
              userEmailMap[userId] = profileData.email || userId;
            }
          } catch (e) {
            console.warn(`Erreur chargement profil pour ${userId}:`, e);
          }

          // Charger les custom foods de cet utilisateur
          const customFoodsRef = collection(db, 'users', userId, 'customFoods');
          const foodsSnapshot = await getDocs(customFoodsRef);
          
          foodsSnapshot.docs.forEach(foodDoc => {
            const foodData = foodDoc.data() as FoodItem;
            allCustomFoods.push({
              ...foodData,
              userId,
              userEmail: userEmailMap[userId] || userId,
            });
          });
        }

        // Trier par nom
        allCustomFoods.sort((a, b) => a.name.localeCompare(b.name));
        
        setCustomFoods(allCustomFoods);
      } catch (error) {
        console.error('[Admin Custom Foods] Erreur chargement:', error);
        Alert.alert('Erreur', 'Impossible de charger les aliments personnalisés.');
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      loadAllCustomFoods();
    }
  }, [isAdmin]);

  const formatFoodDetails = (food: CustomFoodWithUser): string => {
    return `Nom: ${food.name}
ID: ${food.id}
Tags: ${food.tags?.join(', ') || 'Aucun'}
Base Score: ${food.baseScore || 'N/A'}
Calories: ${food.calories_kcal || 0} kcal
Protéines: ${food.protein_g || 0}g
Glucides: ${food.carbs_g || 0}g
Lipides: ${food.fat_g || 0}g
Créé par: ${food.userEmail || food.userId}`;
  };

  const copyFoodToClipboard = async (food: CustomFoodWithUser) => {
    const foodCode = `{ id: '${food.id}', name: '${food.name}', tags: [${food.tags?.map(t => `'${t}'`).join(', ') || ''}], baseScore: ${food.baseScore || 50}, protein_g: ${food.protein_g || 0}, carbs_g: ${food.carbs_g || 0}, fat_g: ${food.fat_g || 0}, calories_kcal: ${food.calories_kcal || 0} },`;
    
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(foodCode);
      Alert.alert('✅ Copié!', 'Le code de l\'aliment a été copié dans le presse-papier.');
    } else {
      Alert.alert('Détails', formatFoodDetails(food));
    }
  };

  // Vérifier si admin
  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={styles.accessDeniedEmoji}>🔒</Text>
        <Text style={[styles.accessDeniedText, { color: colors.text.primary }]}>
          Accès réservé aux administrateurs
        </Text>
        <TouchableOpacity style={styles.backButtonCentered} onPress={() => router.back()}>
          <Text style={styles.backButtonCenteredText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>← Retour</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text.primary }]}>
          🍽️ Aliments Personnalisés
        </Text>
        <Text style={[styles.subtitle, { color: colors.icon }]}>
          {customFoods.length} aliment(s) créé(s) par les utilisateurs
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loading} />
        ) : customFoods.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={[styles.emptyText, { color: colors.icon }]}>
              Aucun aliment personnalisé pour le moment
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            {customFoods.map((food) => (
              <TouchableOpacity
                key={`${food.userId}-${food.id}`}
                style={[styles.foodCard, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}
                onPress={() => setSelectedFood(food)}
              >
                <View style={styles.foodHeader}>
                  <Text style={[styles.foodName, { color: colors.text.primary }]}>{food.name}</Text>
                </View>
                <View style={styles.foodDetails}>
                  <Text style={[styles.foodDetail, { color: colors.icon }]}>
                    🔥 {food.calories_kcal || 0} cal · 💪 {food.protein_g || 0}g prot · 🍞 {food.carbs_g || 0}g gluc · 🧈 {food.fat_g || 0}g lip
                  </Text>
                  <Text style={[styles.foodDetail, { color: colors.icon }]}>
                    🏷️ {food.tags?.join(', ') || 'Aucun tag'}
                  </Text>
                  <Text style={[styles.foodUser, { color: colors.icon }]}>
                    👤 {food.userEmail || food.userId}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyButton, { backgroundColor: colors.primary }]}
                  onPress={() => copyFoodToClipboard(food)}
                >
                  <Text style={styles.copyButtonText}>📋 Copier le code</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={[styles.infoBox, { backgroundColor: activeTheme === 'dark' ? '#1e3a5f' : '#e0f2fe' }]}>
          <Text style={[styles.infoTitle, { color: activeTheme === 'dark' ? '#93c5fd' : '#1e40af' }]}>
            💡 Comment utiliser
          </Text>
          <Text style={[styles.infoText, { color: activeTheme === 'dark' ? '#bfdbfe' : '#1e3a8a' }]}>
            1. Clique sur un aliment pour voir ses détails{'\n'}
            2. Utilise "Copier le code" pour copier le code TypeScript{'\n'}
            3. Colle-le dans lib/food-db.ts pour l'ajouter à la base principale{'\n'}
            4. Redéploie l'app pour que tous les utilisateurs y aient accès
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
  backButton: {
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonCentered: {
    marginTop: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  backButtonCenteredText: {
    color: '#fff',
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
  accessDeniedEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  foodCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  foodHeader: {
    marginBottom: 12,
  },
  foodName: {
    fontSize: 18,
    fontWeight: '600',
  },
  foodDetails: {
    marginBottom: 12,
  },
  foodDetail: {
    fontSize: 13,
    marginBottom: 4,
  },
  foodUser: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  copyButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
