// Système d'authentification local (sans Firebase)
// Stocke les comptes dans AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from './types';

const USERS_KEY = 'toki_local_users';
const CURRENT_USER_KEY = 'toki_current_user';

export type LocalUser = {
  id: string;
  email: string;
  password: string; // En production, ce serait hashé
  displayName: string;
  createdAt: string;
  emailVerified: boolean;
  verificationCode?: string; // Code de vérification temporaire
};

/**
 * Créer un nouveau compte local
 */
export async function localSignUp(email: string, password: string, displayName: string): Promise<LocalUser> {
  try {
    // Vérifier si l'email existe déjà
    const users = await getAllUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('Un compte avec cet email existe déjà');
    }

    // Générer un code de vérification à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Créer le nouveau user
    const newUser: LocalUser = {
      id: Date.now().toString(),
      email,
      password, // En vrai projet, hasher avec bcrypt ou crypto
      displayName,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      verificationCode,
    };

    // Sauvegarder
    users.push(newUser);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Créer le profil par défaut
    const defaultProfile: UserProfile = {
      userId: newUser.id,
      displayName,
      email,
      weeklyCalorieTarget: 10500,
      dailyPointsBudget: 6, // Calculé: (10500 * 0.30 / 7) / 80 ≈ 6 pts
      maxPointsCap: 12,
      createdAt: new Date().toISOString(),
      onboardingCompleted: false,
    };

    await AsyncStorage.setItem(`toki_user_profile_${newUser.id}`, JSON.stringify(defaultProfile));

    // Set current user
    await AsyncStorage.setItem(CURRENT_USER_KEY, newUser.id);

    return newUser;
  } catch (error: any) {
    throw new Error(error.message || 'Erreur lors de la création du compte');
  }
}

/**
 * Se connecter avec un compte local
 */
export async function localSignIn(email: string, password: string): Promise<LocalUser> {
  try {
    const users = await getAllUsers();
    const user = users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!user) {
      throw new Error('Email ou mot de passe incorrect');
    }

    // Set current user
    await AsyncStorage.setItem(CURRENT_USER_KEY, user.id);

    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Erreur de connexion');
  }
}

/**
 * Se déconnecter
 */
export async function localSignOut(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
}

/**
 * Obtenir l'utilisateur actuellement connecté
 */
export async function getCurrentLocalUser(): Promise<LocalUser | null> {
  try {
    const currentUserId = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!currentUserId) return null;

    const users = await getAllUsers();
    return users.find(u => u.id === currentUserId) || null;
  } catch {
    return null;
  }
}

/**
 * Obtenir le profil de l'utilisateur
 */
export async function getLocalUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(`toki_user_profile_${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

/**
 * Mettre à jour le profil utilisateur
 */
export async function updateLocalUserProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
  try {
    const current = await getLocalUserProfile(userId);
    if (!current) throw new Error('Profil non trouvé');

    const updated = { ...current, ...updates };
    await AsyncStorage.setItem(`toki_user_profile_${userId}`, JSON.stringify(updated));
  } catch (error) {
    console.error('Error updating local profile:', error);
    throw error;
  }
}

/**
 * Obtenir tous les utilisateurs (helper privé)
 */
async function getAllUsers(): Promise<LocalUser[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Obtenir tous les comptes pour un switch de compte
 */
export async function getAllLocalAccounts(): Promise<{ id: string; displayName: string; email: string }[]> {
  const users = await getAllUsers();
  return users.map(u => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
  }));
}

/**
 * Basculer sur un utilisateur existant (pour switch de compte)
 */
export async function switchToLocalUser(userId: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_USER_KEY, userId);
}

/**
 * Vérifier l'email avec le code
 */
export async function verifyEmail(userId: string, code: string): Promise<boolean> {
  try {
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('Utilisateur non trouvé');
    }

    const user = users[userIndex];
    
    if (user.verificationCode !== code) {
      throw new Error('Code de vérification incorrect');
    }

    // Marquer comme vérifié et supprimer le code
    user.emailVerified = true;
    delete user.verificationCode;
    
    users[userIndex] = user;
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    return true;
  } catch (error: any) {
    throw new Error(error.message || 'Erreur lors de la vérification');
  }
}

/**
 * Renvoyer un code de vérification
 */
export async function resendVerificationCode(userId: string): Promise<string> {
  try {
    const users = await getAllUsers();
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex === -1) {
      throw new Error('Utilisateur non trouvé');
    }

    // Générer un nouveau code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    users[userIndex].verificationCode = newCode;
    
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    return newCode;
  } catch (error: any) {
    throw new Error(error.message || 'Erreur lors de la régénération du code');
  }
}
