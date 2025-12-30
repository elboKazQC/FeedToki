// Calculer les repas favoris basés sur l'usage réel de l'utilisateur
import { MealEntry, FoodItemRef } from './stats';
import { FavoriteMeal } from './presets';

/**
 * Calcule les repas les plus consommés par l'utilisateur
 * @param entries Toutes les entrées de repas de l'utilisateur
 * @param maxMeals Nombre maximum de repas favoris à retourner (défaut: 8)
 * @returns Liste des repas favoris triés par fréquence
 */
export function calculateFavoriteMeals(
  entries: MealEntry[],
  maxMeals: number = 8
): FavoriteMeal[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  // Grouper les repas par "signature" (combinaison d'aliments)
  // On crée une signature basée sur les foodIds triés pour identifier les repas similaires
  const mealSignatures = new Map<string, {
    items: FoodItemRef[];
    label: string;
    count: number;
    lastUsed: Date;
  }>();

  for (const entry of entries) {
    if (!entry.items || entry.items.length === 0) continue;

    // Créer une signature: trier les foodIds et créer une clé
    const sortedFoodIds = [...entry.items]
      .map(ref => ref.foodId)
      .sort()
      .join(',');

    const existing = mealSignatures.get(sortedFoodIds);
    
    if (existing) {
      existing.count += 1;
      // Garder le label le plus récent
      const entryDate = new Date(entry.createdAt);
      if (entryDate > existing.lastUsed) {
        existing.label = entry.label;
        existing.lastUsed = entryDate;
      }
    } else {
      mealSignatures.set(sortedFoodIds, {
        items: entry.items,
        label: entry.label,
        count: 1,
        lastUsed: new Date(entry.createdAt),
      });
    }
  }

  // Convertir en tableau et trier par fréquence (puis par date récente)
  const favoriteMeals: FavoriteMeal[] = Array.from(mealSignatures.values())
    .sort((a, b) => {
      // D'abord par fréquence (décroissant)
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      // Ensuite par date récente (décroissant)
      return b.lastUsed.getTime() - a.lastUsed.getTime();
    })
    .slice(0, maxMeals)
    .map((meal, index) => ({
      id: `favorite_${index}_${meal.count}`,
      name: meal.label.length > 30 ? meal.label.substring(0, 30) + '...' : meal.label,
      items: meal.items,
    }));

  return favoriteMeals;
}

