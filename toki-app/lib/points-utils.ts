// Utilitaires pour calculer les points des aliments
// Version exportée de computeFoodPoints pour utilisation dans lib/

import { FoodItem } from './food-db';

/**
 * Calculer le coût en points d'un aliment
 * Même logique que dans index.tsx mais exportée pour utilisation dans lib/
 */
export function computeFoodPoints(fi: FoodItem): number {
  // Si l'item a déjà un coût explicite, l'utiliser
  if (typeof fi.points === 'number') return fi.points;
  
  // Nouvelle formule basée sur les calories (plus cohérente)
  const cal = fi.calories_kcal ?? 150;
  
  // Les protéines maigres et légumes sont gratuits
  if (fi.tags.includes('proteine_maigre') || fi.tags.includes('legume')) {
    return 0;
  }
  
  // Base: calories divisées par 100 (100 cal = ~1 point)
  let baseCost = cal / 100;
  
  // Ajustements selon les tags
  if (fi.tags.includes('ultra_transforme')) {
    baseCost *= 1.5; // 50% plus cher
  }
  
  if (fi.tags.includes('gras_frit')) {
    baseCost *= 1.3; // 30% plus cher
  }
  
  if (fi.tags.includes('sucre') && cal > 100) {
    baseCost *= 1.2; // 20% plus cher
  }
  
  // Grains complets sont légèrement avantagés
  if (fi.tags.includes('grain_complet')) {
    baseCost *= 0.8;
  }
  
  return Math.max(0, Math.round(baseCost));
}


