import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { localSignOut } from '@/lib/local-auth';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabTwoScreen() {
  const { user, profile } = useAuth();

  // Debug logging
  useEffect(() => {
    console.log('[Explore] user:', JSON.stringify(user, null, 2));
    console.log('[Explore] profile:', JSON.stringify(profile, null, 2));
    
    // Lister toutes les clés AsyncStorage pour debug
    const debugStorage = async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        console.log('[Explore] === ALL ASYNCSTORAGE KEYS ===');
        console.log('[Explore] Keys:', allKeys);
        
        // Afficher les entrées pour chaque clé feedtoki_entries
        for (const key of allKeys) {
          if (key.includes('entries')) {
            const value = await AsyncStorage.getItem(key);
            const parsed = value ? JSON.parse(value) : [];
            console.log(`[Explore] ${key}: ${parsed.length} entries`);
          }
        }
      } catch (e) {
        console.log('[Explore] Error listing keys:', e);
      }
    };
    debugStorage();
  }, [user, profile]);

  // Récupérer email et nom depuis user OU profile
  const displayEmail = (user as any)?.email || profile?.email || 'Non connecté';
  const displayName = (user as any)?.displayName || profile?.displayName || 'Utilisateur';

  const handleEditProfile = async () => {
    Alert.alert(
      'Modifier mes objectifs',
      'Tu vas retourner à l\'écran de configuration. Tes données actuelles seront remplacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: () => {
            router.push('/onboarding');
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    try {
      await localSignOut();
      router.replace('/auth');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>⚙️ Paramètres</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compte</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{displayEmail}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Nom</Text>
            <Text style={styles.value}>{displayName}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes objectifs</Text>
          {profile && (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>Objectif calorique hebdomadaire</Text>
                <Text style={styles.value}>{profile.weeklyCalorieTarget?.toLocaleString()} cal</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.label}>Points quotidiens</Text>
                <Text style={styles.value}>{profile.dailyPointsBudget} pts</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.label}>Cap maximum</Text>
                <Text style={styles.value}>{profile.maxPointsCap} pts</Text>
              </View>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
          <Text style={styles.buttonText}>✏️ Modifier mes objectifs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.buttonDanger]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>🚪 Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#111827',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDanger: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
