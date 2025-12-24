// Canada Food Guide inspired simple recommendations
// Reference groups: protein foods, vegetables & fruits, whole grains, water
import { FOOD_DB, FoodItem } from './food-db';
import { MealEntry } from './stats';

export type GuideGroup = 'proteines' | 'legumes_fruits' | 'grains_entiers' | 'eau';

export type Recommendation = {
  group: GuideGroup;
  title: string;
  examples: string[]; // short item names
};

const GROUP_ITEMS: Record<GuideGroup, FoodItem['id'][]> = {
  proteines: ['poulet', 'dinde', 'poisson', 'oeufs'],
  legumes_fruits: ['legumes'],
  grains_entiers: ['riz', 'pates', 'patate', 'toasts'], // simplified
  eau: [],
};

function namesFromIds(ids: string[]): string[] {
  return ids
    .map((id) => FOOD_DB.find((f) => f.id === id)?.name)
    .filter(Boolean) as string[];
}

export function getCanadaGuideRecommendations(lastMeals: MealEntry[]): Recommendation[] {
  // Minimal logic: if no meal in last 24h -> full plate recommendation
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const recent = lastMeals.filter((m) => new Date(m.createdAt).getTime() >= dayAgo);

  const base: Recommendation[] = [
    {
      group: 'proteines',
      title: 'Ajoute des protéines',
      examples: namesFromIds(GROUP_ITEMS.proteines),
    },
    {
      group: 'legumes_fruits',
      title: 'Remplis la moitié avec légumes/fruits',
      examples: namesFromIds(GROUP_ITEMS.legumes_fruits),
    },
    {
      group: 'grains_entiers',
      title: 'Complète avec grains entiers',
      examples: namesFromIds(GROUP_ITEMS.grains_entiers),
    },
    {
      group: 'eau',
      title: 'Bois de l’eau',
      examples: ['Verre d’eau'],
    },
  ];

  if (recent.length === 0) {
    return base;
  }

  // If last meal was "cheat" or low score, emphasize proteins + veggies
  const last = recent[0];
  if (last.category === 'cheat' || last.score < 40) {
    return [
      base[0],
      base[1],
      base[3],
    ];
  }

  // Otherwise provide a balanced reminder
  return [base[1], base[0], base[3]];
}
