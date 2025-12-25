// Context Provider pour l'authentification
import React, { createContext, useContext, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { onAuthChange, getCurrentUser, getUserProfile, AuthUser } from '../lib/firebase-auth';
import { UserProfile } from '../lib/types';
import { FIREBASE_ENABLED } from './firebase-config';
import { getCurrentLocalUser, getLocalUserProfile, LocalUser, localSignOut } from './local-auth';
import { migrateIncorrectWeights } from './migrate-profile';

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
          
          if (authUser) {
            const userProfile = await getUserProfile(authUser.uid);
            setProfile(userProfile);
            
            if (userProfile && !userProfile.onboardingCompleted) {
              router.replace('/onboarding');
            } else if (userProfile) {
              router.replace('/(tabs)');
            }
          } else {
            setProfile(null);
            router.replace('/auth');
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
          // Vérifier si l'email est vérifié
          if (!currentUser.emailVerified) {
            console.log('[AuthContext] Email non vérifié, redirect to verify-email');
            setInitialRoutingDone(true);
            router.replace('/verify-email');
            setLoading(false);
            return;
          }

          const userProfile = await getLocalUserProfile(currentUser.id);
          console.log('[AuthContext] initAuth - userProfile:', JSON.stringify(userProfile, null, 2));
          setProfile(userProfile);
          
          // Routing initial seulement si pas déjà fait
          if (!initialRoutingDone) {
            setInitialRoutingDone(true);
            if (!userProfile || !userProfile.onboardingCompleted) {
              console.log('[AuthContext] Routing to /onboarding');
              router.replace('/onboarding');
            } else {
              console.log('[AuthContext] Routing to /(tabs)');
              router.replace('/(tabs)');
            }
          }
        } else {
          console.log('[AuthContext] No user, routing to /auth');
          if (!initialRoutingDone) {
            setInitialRoutingDone(true);
            router.replace('/auth');
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
    router.replace('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
