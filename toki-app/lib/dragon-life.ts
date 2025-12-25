import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAYS_CRITICAL } from './stats';

export type DragonLifeStatus = {
  isAlive: boolean;
  daysSinceLastMeal: number;
  deathDate?: string; // Date à laquelle le dragon est mort
  resurrectCost: number; // Coût en points pour ressusciter
};

// Clé pour stocker l'état du dragon par utilisateur
export const getDragonStatusKey = (userId: string) => `feedtoki_dragon_status_${userId}`;

// Vérifie si le dragon est mort (5 jours sans manger)
export function checkDragonDeath(daysSinceLastMeal: number): boolean {
  return daysSinceLastMeal >= DAYS_CRITICAL;
}

// Calcule le coût pour ressusciter le dragon
// Plus tu attends, plus c'est cher!
export function calculateResurrectCost(daysSinceLastMeal: number): number {
  if (daysSinceLastMeal < DAYS_CRITICAL) return 0;
  
  const daysOverLimit = daysSinceLastMeal - DAYS_CRITICAL;
  // Base: 5 points + 2 points par jour supplémentaire
  return Math.min(50, 5 + (daysOverLimit * 2));
}

// Sauvegarde l'état de mort du dragon
export async function saveDragonDeath(userId: string, deathDate: string): Promise<void> {
  const key = getDragonStatusKey(userId);
  const data = {
    isDead: true,
    deathDate,
  };
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

// Ressuscite le dragon (appelé après paiement)
export async function resurrectDragon(userId: string): Promise<void> {
  const key = getDragonStatusKey(userId);
  await AsyncStorage.removeItem(key);
}

// Reset complet du dragon (nouveau dragon, perd tout le progrès)
export async function resetDragon(userId: string): Promise<void> {
  const key = getDragonStatusKey(userId);
  await AsyncStorage.removeItem(key);
  
  // Option: réinitialiser aussi les entries si tu veux un "nouveau départ"
  // Pour l'instant on garde les entries mais on repart à 0 streak
}

// Récupère l'état du dragon
export async function getDragonDeathStatus(userId: string): Promise<{ isDead: boolean; deathDate?: string } | null> {
  const key = getDragonStatusKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw);
}
