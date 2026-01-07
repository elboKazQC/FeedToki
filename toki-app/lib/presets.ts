// Quick-pick items and meal presets to speed up entry
import { FOOD_DB, FoodItem } from './food-db';
import type { FoodItemRef } from './classifier';

export type FavoriteMeal = {
  id: string;
  name: string;
  items: FoodItemRef[];
  count?: number; // Nombre de fois que le repas a été mangé
};

// Handy quick items (chips)
export const QUICK_ITEMS: FoodItem[] = [
  // Protéines
  FOOD_DB.find((f) => f.id === 'poulet')!,
  FOOD_DB.find((f) => f.id === 'dinde')!,
  FOOD_DB.find((f) => f.id === 'poisson')!,
  FOOD_DB.find((f) => f.id === 'oeufs')!,
  FOOD_DB.find((f) => f.id === 'tofu')!,
  FOOD_DB.find((f) => f.id === 'yaourt')!,
  FOOD_DB.find((f) => f.id === 'fromage')!,
  // Légumes/fruits
  FOOD_DB.find((f) => f.id === 'legumes')!,
  FOOD_DB.find((f) => f.id === 'salade')!,
  FOOD_DB.find((f) => f.id === 'brocoli')!,
  FOOD_DB.find((f) => f.id === 'carottes')!,
  FOOD_DB.find((f) => f.id === 'epinards')!,
  FOOD_DB.find((f) => f.id === 'tomates')!,
  FOOD_DB.find((f) => f.id === 'poivrons')!,
  FOOD_DB.find((f) => f.id === 'banane')!,
  FOOD_DB.find((f) => f.id === 'pomme')!,
  FOOD_DB.find((f) => f.id === 'baies')!,
  // Grains / féculents
  FOOD_DB.find((f) => f.id === 'riz')!,
  FOOD_DB.find((f) => f.id === 'pates')!,
  FOOD_DB.find((f) => f.id === 'patate')!,
  FOOD_DB.find((f) => f.id === 'toasts')!,
  FOOD_DB.find((f) => f.id === 'quinoa')!,
  FOOD_DB.find((f) => f.id === 'avoine')!,
  FOOD_DB.find((f) => f.id === 'pain_complet')!,
  FOOD_DB.find((f) => f.id === 'riz_brun')!,
  FOOD_DB.find((f) => f.id === 'orge')!,
  // Indulgences / boissons
  FOOD_DB.find((f) => f.id === 'pizza')!,
  FOOD_DB.find((f) => f.id === 'poutine')!,
  FOOD_DB.find((f) => f.id === 'chips')!,
  FOOD_DB.find((f) => f.id === 'beigne')!,
  FOOD_DB.find((f) => f.id === 'croissant')!,
  FOOD_DB.find((f) => f.id === 'soda')!,
  FOOD_DB.find((f) => f.id === 'jus')!,
  FOOD_DB.find((f) => f.id === 'alcool')!,
  FOOD_DB.find((f) => f.id === 'biere')!,
].filter(Boolean);

// Simple favorite meals
export const QUICK_MEALS: FavoriteMeal[] = [
  {
    id: 'dej_habituel',
    name: 'Déjeuner habituel',
    items: [
      { foodId: 'oeufs' },
      { foodId: 'toasts' },
    ],
  },
  {
    id: 'poulet_riz',
    name: 'Poulet + Riz',
    items: [
      { foodId: 'poulet' },
      { foodId: 'riz' },
      { foodId: 'legumes' },
    ],
  },
  {
    id: 'bol_proteine',
    name: 'Bol protéiné',
    items: [
      { foodId: 'poulet' },
      { foodId: 'brocoli' },
      { foodId: 'riz_brun' },
    ],
  },
  {
    id: 'dej_sante',
    name: 'Déj santé',
    items: [
      { foodId: 'yaourt' },
      { foodId: 'baies' },
      { foodId: 'avoine' },
    ],
  },
  {
    id: 'vege_bowl',
    name: 'Bol végé',
    items: [
      { foodId: 'tofu' },
      { foodId: 'quinoa' },
      { foodId: 'epinards' },
    ],
  },
];
