// Context Provider pour l'authentification
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthChange, getCurrentUser, getUserProfile, updateUserProfile, AuthUser } from './firebase-auth';
import { UserProfile } from './types';
import { FIREBASE_ENABLED } from './firebase-config';
import { setUserId as setAnalyticsUserId, setUserProps } from './analytics';
import { getCurrentLocalUser, getLocalUserProfile, LocalUser, localSignOut } from './local-auth';
import { migrateIncorrectWeights } from './migrate-profile';
import { autoMigrateIfNeeded } from './migrate-to-firestore';

type AuthContextType = {
  user: AuthUser | LocalUser | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | LocalUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialRoutingDone, setInitialRoutingDone] = useState(false);

  const refreshProfile = async () => {
    console.log('[AuthContext] refreshProfile called');
    if (FIREBASE_ENABLED) {
      const currentUser = getCurrentUser();
      console.log('[AuthContext] Firebase currentUser:', currentUser?.uid);
      if (currentUser) {
        const userProfile = await getUserProfile(currentUser.uid);
        console.log('[AuthContext] Firebase userProfile:', JSON.stringify(userProfile, null, 2));
        setProfile(userProfile);
      }
    } else {
      const currentUser = await getCurrentLocalUser();
      console.log('[AuthContext] Local currentUser:', JSON.stringify(currentUser, null, 2));
      if (currentUser) {
        const userProfile = await getLocalUserProfile(currentUser.id);
        console.log('[AuthContext] Local userProfile:', JSON.stringify(userProfile, null, 2));
        setProfile(userProfile);
        setUser(currentUser); // Aussi mettre à jour le user
      } else {
        // Fallback: charger un profil "invité" si présent (mode sans compte)
        const raw = await AsyncStorage.getItem('toki_user_profile_v1');
        if (raw) {
          const guestProfile = JSON.parse(raw);
          console.log('[AuthContext] Loaded guest profile (v1):', JSON.stringify(guestProfile, null, 2));
          setProfile(guestProfile);
        }
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      // Migration automatique des profils avec poids incorrects
      await migrateIncorrectWeights();

      if (FIREBASE_ENABLED) {
        // Mode Firebase
        const unsubscribe = onAuthChange(async (authUser) => {
          setUser(authUser);
          
          // Mettre à jour l'ID utilisateur pour analytics
          if (authUser) {
            setAnalyticsUserId(authUser.uid);
            setUserProps({
              email: authUser.email || null,
            });
          } else {
            setAnalyticsUserId(null);
          }
          
          if (authUser) {
            // Migration automatique des données locales vers Firestore
            await autoMigrateIfNeeded(authUser.uid);
            
            // Synchroniser les données depuis Firestore (fusion intelligente)
            try {
              const { syncFromFirestore } = await import('./data-sync');
              const syncResult = await syncFromFirestore(authUser.uid);
              if (syncResult.mealsMerged > 0 || syncResult.pointsRestored || syncResult.targetsRestored || syncResult.weightsMerged > 0) {
                console.log('[AuthContext] Données synchronisées depuis Firestore:', syncResult);
                // Les composants se rechargeront via leurs useEffect qui dépendent de currentUserId
              }
            } catch (error) {
              console.error('[AuthContext] Erreur synchronisation Firestore:', error);
              // Continue même si la synchronisation échoue
            }
            
            let userProfile = await getUserProfile(authUser.uid);
            
            // Mettre à jour les objectifs nutritionnels si le profil a un poids mais pas d'objectifs personnalisés
            if (userProfile && userProfile.currentWeight) {
              try {
                const { calculateNutritionTargets, updateUserNutritionTargets } = await import('./nutrition-calculator');
                const calculatedTargets = calculateNutritionTargets(userProfile);
                
                // Vérifier si les objectifs actuels sont les valeurs par défaut (100g protéines)
                // Si oui, les mettre à jour avec les valeurs calculées
                const targetsKey = `feedtoki_targets_${authUser.uid}_v1`;
                const currentTargetsRaw = await AsyncStorage.getItem(targetsKey);
                
                if (!currentTargetsRaw || currentTargetsRaw.includes('"protein_g":100')) {
                  // Objectifs par défaut ou absents, mettre à jour
                  await updateUserNutritionTargets(authUser.uid, userProfile);
                  console.log('[AuthContext] Objectifs nutritionnels mis à jour:', calculatedTargets);
                }
              } catch (error) {
                console.error('[AuthContext] Erreur mise à jour objectifs nutritionnels:', error);
                // Continue même si la mise à jour échoue
              }
            }
            
            // Corriger les profils avec dailyPointsBudget = 45 (ancienne valeur incorrecte)
            // MAIS seulement si onboardingCompleted est true (pour éviter de rediriger vers onboarding)
            if (userProfile && userProfile.dailyPointsBudget === 45 && userProfile.onboardingCompleted) {
              console.log('[AuthContext] Correction du profil avec 45 points -> recalcul...');
              const { calculateDailyPoints, calculateMaxCap } = await import('./points-calculator');
              const correctedPoints = calculateDailyPoints(userProfile.weeklyCalorieTarget);
              const correctedCap = calculateMaxCap(correctedPoints);
              
              userProfile = {
                ...userProfile,
                dailyPointsBudget: correctedPoints,
                maxPointsCap: correctedCap,
                // Préserver onboardingCompleted
                onboardingCompleted: true,
              };
              
              // Sauvegarder la correction dans Firestore
              await updateUserProfile(authUser.uid, userProfile);
              console.log('[AuthContext] Profil corrigé:', correctedPoints, 'pts/jour');
            }
            
            setProfile(userProfile);
            
            // Vérifier si le profil local a onboardingCompleted = true mais pas Firestore
            // Si c'est le cas, mettre à jour Firestore (AVANT la vérification de routage)
            if (userProfile && !userProfile.onboardingCompleted) {
              try {
                // Vérifier dans AsyncStorage avec plusieurs clés possibles
                const localProfileKey1 = `toki_user_profile_${authUser.uid}`;
                const localProfileKey2 = 'toki_user_profile_v1';
                let localProfileRaw = await AsyncStorage.getItem(localProfileKey1);
                if (!localProfileRaw) {
                  localProfileRaw = await AsyncStorage.getItem(localProfileKey2);
                }
                
                if (localProfileRaw) {
                  const localProfile = JSON.parse(localProfileRaw);
                  if (localProfile.onboardingCompleted) {
                    // Le profil local est complété mais pas Firestore, mettre à jour Firestore
                    console.log('[AuthContext] Profil local complété mais pas Firestore, mise à jour...');
                    const cleanProfile = { ...userProfile, onboardingCompleted: true };
                    // Filtrer undefined
                    const firestoreProfile: any = {};
                    for (const [key, value] of Object.entries(cleanProfile)) {
                      if (value !== undefined) {
                        firestoreProfile[key] = value;
                      }
                    }
                    firestoreProfile.userId = authUser.uid;
                    await updateUserProfile(authUser.uid, firestoreProfile);
                    userProfile.onboardingCompleted = true;
                    setProfile(userProfile);
                    console.log('[AuthContext] Profil Firestore mis à jour avec onboardingCompleted: true');
                  }
                }
              } catch (e) {
                console.error('[AuthContext] Erreur vérification profil local:', e);
              }
            }
            
            setProfile(userProfile);
            
            // Ne rediriger que lors de l'initialisation initiale ET seulement si nécessaire
            if (!initialRoutingDone) {
              setInitialRoutingDone(true);
              
              // La navigation sera gérée par NavigationHandler dans _layout.tsx
              // On marque juste que le routing initial est fait pour éviter les redirections multiples
              console.log('[AuthContext] Profil chargé, routing initial marqué comme fait');
            }
            
            setLoading(false);
          } else {
            setProfile(null);
            // La navigation sera gérée par NavigationHandler dans _layout.tsx
            if (!initialRoutingDone) {
              setInitialRoutingDone(true);
            }
          }
          
          setLoading(false);
        });
        
        return unsubscribe;
      } else {
        // Mode local
        console.log('[AuthContext] initAuth - Mode local');
        const currentUser = await getCurrentLocalUser();
        console.log('[AuthContext] initAuth - currentUser:', JSON.stringify(currentUser, null, 2));
        setUser(currentUser);
        
        if (currentUser) {
          // Vérifier si l'email est vérifié - stocker l'info pour que index.tsx puisse rediriger
          if (!currentUser.emailVerified) {
            console.log('[AuthContext] Email non vérifié');
            // Le profile sera null, index.tsx redirigera vers /auth
            // On crée un profil temporaire pour indiquer qu'il faut vérifier l'email
            setProfile({ emailVerified: false } as any);
            setLoading(false);
            return;
          }

          const userProfile = await getLocalUserProfile(currentUser.id);
          console.log('[AuthContext] initAuth - userProfile:', JSON.stringify(userProfile, null, 2));
          setProfile(userProfile);
          // La navigation sera gérée par app/index.tsx
        } else {
          // Aucun compte local connecté
          // Fallback: si un profil invité (v1) existe et est complété, charger le profil
          const raw = await AsyncStorage.getItem('toki_user_profile_v1');
          if (raw) {
            const guestProfile = JSON.parse(raw);
            console.log('[AuthContext] Guest profile found');
            setProfile(guestProfile);
          } else {
            console.log('[AuthContext] No user found');
            // profile reste null, index.tsx redirigera vers /auth
          }
        }
        
        setLoading(false);
      }
    };

    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    setUser(null);
    setProfile(null);
    await localSignOut();
    // La redirection sera gérée par app/index.tsx quand profile devient null
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
