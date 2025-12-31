import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { useTheme } from '../../lib/theme-context';
import { Colors } from '../../constants/theme';
import { localSignOut } from '../../lib/local-auth';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabTwoScreen() {
  const { user, profile } = useAuth();
  const { activeTheme, setTheme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(activeTheme === 'dark');
  const colors = Colors[activeTheme];

  // Synchroniser le switch avec le thème actif
  useEffect(() => {
    setIsDarkMode(activeTheme === 'dark');
  }, [activeTheme]);

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
    // Efface l'ID user courant
    await localSignOut();
    // Efface le profil local associé
    const userId = (user as any)?.userId || profile?.userId;
    if (userId) {
      await AsyncStorage.removeItem(`toki_user_profile_${userId}`);
    }
    // Redirige vers l'écran de login
    router.replace('/auth');
  };

  const handleThemeToggle = async (value: boolean) => {
    setIsDarkMode(value);
    await setTheme(value ? 'dark' : 'light');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header avec bouton retour */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(tabs)')}>
            <Text style={[styles.backButtonText, { color: colors.tint }]}>← Accueil</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>⚙️ Paramètres</Text>

        {/* Section Apparence */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Apparence</Text>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <View style={styles.row}>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {isDarkMode ? '🌙' : '☀️'} Mode sombre
                </Text>
                <Text style={[styles.labelHint, { color: colors.icon }]}>
                  {isDarkMode ? 'Activé' : 'Désactivé'}
                </Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={handleThemeToggle}
                trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                thumbColor={isDarkMode ? '#60a5fa' : '#f3f4f6'}
              />
            </View>
          </View>
        </View>

        {/* Section Compte */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mon compte</Text>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.label, { color: colors.icon }]}>Email</Text>
            <Text style={[styles.value, { color: colors.text }]}>{displayEmail}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.label, { color: colors.icon }]}>Nom</Text>
            <Text style={[styles.value, { color: colors.text }]}>{displayName}</Text>
          </View>
        </View>

        {/* Section Objectifs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mes objectifs</Text>
          {profile && (
            <>
              <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <Text style={[styles.label, { color: colors.icon }]}>Objectif calorique hebdomadaire</Text>
                <Text style={[styles.value, { color: colors.text }]}>{profile.weeklyCalorieTarget?.toLocaleString()} cal</Text>
              </View>
              <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <Text style={[styles.label, { color: colors.icon }]}>Points quotidiens</Text>
                <Text style={[styles.value, { color: colors.text }]}>{profile.dailyPointsBudget} pts</Text>
              </View>
              <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <Text style={[styles.label, { color: colors.icon }]}>Cap maximum</Text>
                <Text style={[styles.value, { color: colors.text }]}>{profile.maxPointsCap} pts</Text>
              </View>
            </>
          )}
        </View>

        {/* Boutons */}
        <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
          <Text style={styles.buttonText}>✏️ Modifier mes objectifs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push('/food-request')}>
          <Text style={styles.buttonText}>🍽️ Demander un aliment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push('/admin-requests')}>
          <Text style={styles.buttonText}>📋 Voir les demandes (Admin)</Text>
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
  },
  content: {
    padding: 20,
    paddingTop: 60,
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
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
  },
  labelHint: {
    fontSize: 12,
    marginTop: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
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
