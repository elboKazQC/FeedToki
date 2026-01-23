import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { useTheme } from '../../lib/theme-context';
import { Colors } from '../../constants/theme';
import { checkIsAdmin, setAdminFlag } from '../../lib/admin-utils';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { arePointsEnabled } from '../../lib/points-toggle';

export default function TabTwoScreen() {
  const { user, profile, signOut } = useAuth();
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
  const isAdmin = checkIsAdmin(user, profile);

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
      // Utiliser la fonction signOut du contexte qui gère tout (Firebase + local)
      await signOut();
      
      // Redirection sécurisée pour Safari mobile
      // Utiliser setTimeout pour s'assurer que le state est mis à jour avant la redirection
      setTimeout(() => {
        if (Platform.OS === 'web') {
          // Sur web, utiliser router.replace avec un fallback
          try {
            router.replace('/auth');
          } catch (error) {
            // Fallback: redirection via window.location si router échoue
            console.warn('[Explore] Router.replace failed, using window.location:', error);
            if (typeof window !== 'undefined') {
              window.location.href = '/auth';
            }
          }
        } else {
          // Sur mobile natif
          router.replace('/auth');
        }
      }, 100);
    } catch (error: any) {
      console.error('[Explore] Erreur lors de la déconnexion:', error);
      Alert.alert('Erreur', error.message || 'Erreur lors de la déconnexion');
    }
  };

  const handleThemeToggle = async (value: boolean) => {
    setIsDarkMode(value);
    await setTheme(value ? 'dark' : 'light');
  };

  const handleSetAdminFlag = async () => {
    const userId = (user as any)?.uid || profile?.userId;
    if (!userId) {
      Alert.alert('Erreur', 'Impossible de déterminer l\'ID utilisateur');
      return;
    }

    try {
      await setAdminFlag(userId);
      Alert.alert('✅ Succès', 'Le flag isAdmin a été défini dans votre profil Firestore.');
    } catch (error: any) {
      Alert.alert('❌ Erreur', error.message || 'Impossible de définir le flag isAdmin');
    }
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

        <Text style={[styles.title, { color: colors.text.primary }]}>⚙️ Paramètres</Text>

        {/* Section Apparence */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Apparence</Text>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <View style={styles.row}>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.text.primary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Mon compte</Text>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.label, { color: colors.icon }]}>Email</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>{displayEmail}</Text>
          </View>
          <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
            <Text style={[styles.label, { color: colors.icon }]}>Nom</Text>
            <Text style={[styles.value, { color: colors.text.primary }]}>{displayName}</Text>
          </View>
        </View>

        {/* Section Objectifs */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Mes objectifs</Text>
          {profile && (
            <>
              <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                <Text style={[styles.label, { color: colors.icon }]}>Objectif calorique hebdomadaire</Text>
                <Text style={[styles.value, { color: colors.text.primary }]}>{profile.weeklyCalorieTarget?.toLocaleString()} cal</Text>
              </View>
              {arePointsEnabled() && (
                <>
                  <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                    <Text style={[styles.label, { color: colors.icon }]}>Points quotidiens</Text>
                    <Text style={[styles.value, { color: colors.text.primary }]}>{profile.dailyPointsBudget} pts</Text>
                  </View>
                  <View style={[styles.card, { backgroundColor: activeTheme === 'dark' ? '#1f2937' : '#fff' }]}>
                    <Text style={[styles.label, { color: colors.icon }]}>Cap maximum</Text>
                    <Text style={[styles.value, { color: colors.text.primary }]}>{profile.maxPointsCap} pts</Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Boutons */}
        <TouchableOpacity style={styles.button} onPress={handleEditProfile}>
          <Text style={styles.buttonText}>✏️ Modifier mes objectifs</Text>
        </TouchableOpacity>

        {isAdmin && (
          <>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/admin-requests')}>
              <Text style={styles.buttonText}>📋 Voir les demandes (Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/admin-custom-foods' as any)}>
              <Text style={styles.buttonText}>🍽️ Aliments personnalisés (Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/admin-kpi' as any)}>
              <Text style={styles.buttonText}>📊 Dashboard KPI (Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => router.push('/admin-beta-users' as any)}>
              <Text style={styles.buttonText}>🔓 Débloquer Beta Users (Admin)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#8b5cf6' }]} onPress={handleSetAdminFlag}>
              <Text style={styles.buttonText}>🔧 Définir flag isAdmin (Admin)</Text>
            </TouchableOpacity>
          </>
        )}

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
