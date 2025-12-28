// Simple food database with tags and base scores

export type FoodTag =
  | 'proteine_maigre'
  | 'legume'
  | 'feculent_simple'
  | 'grain_complet'
  | 'ultra_transforme'
  | 'sucre'
  | 'alcool'
  | 'gras_frit'
  | 'dessert_sante';

export type FoodItem = {
  id: string;
  name: string;
  tags: FoodTag[];
  baseScore: number; // 0-100, higher = healthier
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number; // lipides en grammes
  calories_kcal?: number;
  points?: number; // explicit points cost (0 for healthy; higher for indulgent)
};

export const FOOD_DB: FoodItem[] = [
  { id: 'poulet', name: 'Poulet', tags: ['proteine_maigre'], baseScore: 85, protein_g: 30, carbs_g: 0, fat_g: 3.5, calories_kcal: 165, points: 0 },
  { id: 'dinde', name: 'Dinde', tags: ['proteine_maigre'], baseScore: 85, protein_g: 30, carbs_g: 0, fat_g: 2, calories_kcal: 160, points: 0 },
  { id: 'poisson', name: 'Poisson', tags: ['proteine_maigre'], baseScore: 80, protein_g: 25, carbs_g: 0, fat_g: 6, calories_kcal: 160, points: 0 },
  { id: 'oeufs', name: 'Oeufs', tags: ['proteine_maigre'], baseScore: 75, protein_g: 12, carbs_g: 1, fat_g: 11, calories_kcal: 155, points: 0 },
  { id: 'tofu', name: 'Tofu', tags: ['proteine_maigre'], baseScore: 80, protein_g: 20, carbs_g: 4, fat_g: 11, calories_kcal: 180, points: 0 },
  { id: 'yaourt', name: 'Yogourt', tags: ['proteine_maigre'], baseScore: 70, protein_g: 10, carbs_g: 8, fat_g: 5, calories_kcal: 120, points: 1 },
  { id: 'fromage', name: 'Fromage', tags: ['proteine_maigre'], baseScore: 55, protein_g: 7, carbs_g: 1, fat_g: 9, calories_kcal: 110, points: 2 },
  { id: 'legumes', name: 'Légumes', tags: ['legume'], baseScore: 90, protein_g: 3, carbs_g: 10, fat_g: 0.5, calories_kcal: 60, points: 0 },
  { id: 'salade', name: 'Salade verte', tags: ['legume'], baseScore: 90, protein_g: 2, carbs_g: 5, fat_g: 0.2, calories_kcal: 30, points: 0 },
  { id: 'brocoli', name: 'Brocoli', tags: ['legume'], baseScore: 95, protein_g: 3, carbs_g: 6, fat_g: 0.4, calories_kcal: 55, points: 0 },
  { id: 'chou_fleur', name: 'Chou-fleur', tags: ['legume'], baseScore: 94, protein_g: 2, carbs_g: 5, fat_g: 0.3, calories_kcal: 50, points: 0 },
  { id: 'carottes', name: 'Carottes', tags: ['legume'], baseScore: 90, protein_g: 1, carbs_g: 10, fat_g: 0.2, calories_kcal: 45, points: 0 },
  { id: 'epinards', name: 'Épinards', tags: ['legume'], baseScore: 95, protein_g: 3, carbs_g: 4, fat_g: 0.4, calories_kcal: 23, points: 0 },
  { id: 'tomates', name: 'Tomates', tags: ['legume'], baseScore: 90, protein_g: 1, carbs_g: 5, fat_g: 0.2, calories_kcal: 22, points: 0 },
  { id: 'poivrons', name: 'Poivrons', tags: ['legume'], baseScore: 90, protein_g: 1, carbs_g: 6, fat_g: 0.3, calories_kcal: 30, points: 0 },
  { id: 'banane', name: 'Banane', tags: ['legume'], baseScore: 80, protein_g: 1, carbs_g: 27, fat_g: 0.4, calories_kcal: 105, points: 0 },
  { id: 'pomme', name: 'Pomme', tags: ['legume'], baseScore: 85, protein_g: 0, carbs_g: 25, fat_g: 0.3, calories_kcal: 95, points: 0 },
  { id: 'baies', name: 'Baies', tags: ['legume'], baseScore: 90, protein_g: 1, carbs_g: 15, fat_g: 0.5, calories_kcal: 70, points: 0 },
  { id: 'riz', name: 'Riz', tags: ['feculent_simple'], baseScore: 60, protein_g: 4, carbs_g: 45, fat_g: 0.5, calories_kcal: 200, points: 2 },
  { id: 'pates', name: 'Pâtes', tags: ['feculent_simple'], baseScore: 55, protein_g: 7, carbs_g: 42, fat_g: 1.5, calories_kcal: 210, points: 2 },
  { id: 'patate', name: 'Patate', tags: ['feculent_simple'], baseScore: 55, protein_g: 4, carbs_g: 37, fat_g: 0.2, calories_kcal: 160, points: 2 },
  { id: 'toasts', name: 'Toasts', tags: ['feculent_simple'], baseScore: 50, protein_g: 4, carbs_g: 20, fat_g: 2, calories_kcal: 120, points: 1 },
  { id: 'quinoa', name: 'Quinoa', tags: ['feculent_simple'], baseScore: 70, protein_g: 8, carbs_g: 39, fat_g: 3.5, calories_kcal: 220, points: 2 },
  { id: 'avoine', name: "Flocons d'avoine", tags: ['feculent_simple'], baseScore: 65, protein_g: 6, carbs_g: 27, fat_g: 3, calories_kcal: 150, points: 1 },
  { id: 'pain_complet', name: 'Pain complet', tags: ['grain_complet'], baseScore: 70, protein_g: 6, carbs_g: 20, fat_g: 2, calories_kcal: 120, points: 1 },
  { id: 'riz_brun', name: 'Riz brun', tags: ['grain_complet'], baseScore: 70, protein_g: 5, carbs_g: 45, fat_g: 1.5, calories_kcal: 215, points: 2 },
  { id: 'orge', name: 'Orge', tags: ['grain_complet'], baseScore: 70, protein_g: 7, carbs_g: 45, fat_g: 1, calories_kcal: 270, points: 3 },
  { id: 'pizza', name: 'Pizza', tags: ['ultra_transforme', 'gras_frit'], baseScore: 25, protein_g: 12, carbs_g: 35, fat_g: 11, calories_kcal: 285, points: 4 },
  // ===== POUTINES VARIÉES (par taille et restaurant) =====
  // Poutine génériques
  { id: 'poutine_petite', name: 'Poutine petite (cassecroûte)', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 8, carbs_g: 35, fat_g: 20, calories_kcal: 420, points: 5 },
  { id: 'poutine', name: 'Poutine moyenne (cassecroûte)', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 14, carbs_g: 50, fat_g: 35, calories_kcal: 740, points: 8 },
  { id: 'poutine_grosse', name: 'Poutine grosse/familiale (cassecroûte)', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 18, carbs_g: 65, fat_g: 48, calories_kcal: 980, points: 11 },
  // Poutine McDo
  { id: 'poutine_mcdo', name: 'Poutine McDo - Small', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 8, carbs_g: 40, fat_g: 18, calories_kcal: 430, points: 5 },
  { id: 'poutine_mcdo_medium', name: 'Poutine McDo - Medium', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 12, carbs_g: 55, fat_g: 26, calories_kcal: 610, points: 7 },
  { id: 'poutine_mcdo_large', name: 'Poutine McDo - Large', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 15, carbs_g: 70, fat_g: 34, calories_kcal: 790, points: 9 },
  // Poutine A&W
  { id: 'poutine_aw', name: 'Poutine A&W - Regular', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 10, carbs_g: 45, fat_g: 24, calories_kcal: 510, points: 6 },
  { id: 'poutine_aw_large', name: 'Poutine A&W - Large', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 15, carbs_g: 60, fat_g: 32, calories_kcal: 680, points: 8 },
  // Poutines spéciales
  { id: 'poutine_fromage', name: 'Poutine fromage/sauce BBQ', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 16, carbs_g: 55, fat_g: 42, calories_kcal: 820, points: 9 },
  { id: 'poutine_bacon', name: 'Poutine bacon & fromage', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 18, carbs_g: 52, fat_g: 46, calories_kcal: 880, points: 10 },
  { id: 'poutine_complete', name: 'Poutine complète (bacon/œuf)', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 20, carbs_g: 60, fat_g: 48, calories_kcal: 900, points: 10 },
  { id: 'poutine_chicken', name: 'Poutine au poulet frit', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 22, carbs_g: 55, fat_g: 42, calories_kcal: 870, points: 10 },
  { id: 'poutine_gravy_extra', name: 'Poutine extra sauce brune', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 16, carbs_g: 60, fat_g: 40, calories_kcal: 860, points: 10 },
  
  { id: 'chips', name: 'Chips', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 2, carbs_g: 15, fat_g: 10, calories_kcal: 160, points: 2 },
  { id: 'beigne', name: 'Beigne (standard)', tags: ['ultra_transforme', 'sucre'], baseScore: 10, protein_g: 3, carbs_g: 45, fat_g: 12, calories_kcal: 300, points: 5 },
  { id: 'soda', name: 'Boisson sucrée (355 ml)', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 39, fat_g: 0, calories_kcal: 150, points: 3 },
  { id: 'jus', name: 'Jus de fruits (250 ml)', tags: ['sucre'], baseScore: 25, protein_g: 1, carbs_g: 26, fat_g: 0, calories_kcal: 110, points: 3 },
  { id: 'alcool', name: 'Alcool fort (45 ml, shot)', tags: ['alcool'], baseScore: 5, protein_g: 0, carbs_g: 0, fat_g: 0, calories_kcal: 120, points: 2 },
  { id: 'biere', name: 'Bière blonde (355 ml)', tags: ['alcool'], baseScore: 5, protein_g: 2, carbs_g: 13, fat_g: 0, calories_kcal: 150, points: 3 },
  { id: 'biere_grande', name: 'Bière grande (473 ml)', tags: ['alcool'], baseScore: 5, protein_g: 3, carbs_g: 18, fat_g: 0, calories_kcal: 200, points: 4 },
  { id: 'cocktail', name: 'Cocktail alcoolisé (150 ml)', tags: ['alcool'], baseScore: 5, protein_g: 0, carbs_g: 15, fat_g: 0, calories_kcal: 180, points: 4 },
  { id: 'frites', name: 'Frites', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 4, carbs_g: 35, fat_g: 17, calories_kcal: 365, points: 5 },
  { id: 'burger', name: 'Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 20, carbs_g: 30, fat_g: 32, calories_kcal: 550, points: 7 },
  { id: 'croissant', name: 'Croissant', tags: ['ultra_transforme', 'sucre'], baseScore: 20, protein_g: 5, carbs_g: 25, fat_g: 15, calories_kcal: 270, points: 4 },
  // Shakes de protéine
  { id: 'shake_protein', name: 'Shake de protéine', tags: ['proteine_maigre'], baseScore: 75, protein_g: 25, carbs_g: 5, fat_g: 2, calories_kcal: 150, points: 0 },
  { id: 'shake_chocolate', name: 'Shake protéine Chocolat', tags: ['proteine_maigre', 'sucre'], baseScore: 70, protein_g: 25, carbs_g: 8, fat_g: 2, calories_kcal: 170, points: 1 },
  { id: 'shake_vanille', name: 'Shake protéine Vanille', tags: ['proteine_maigre', 'sucre'], baseScore: 70, protein_g: 25, carbs_g: 8, fat_g: 2, calories_kcal: 170, points: 1 },
  { id: 'shake_fruits', name: 'Shake protéine Fruits rouges', tags: ['proteine_maigre', 'sucre'], baseScore: 70, protein_g: 24, carbs_g: 10, fat_g: 2.5, calories_kcal: 180, points: 1 },
  // Plats québécois populaires
  { id: 'pate_chin', name: 'Pâté Chinois', tags: ['ultra_transforme'], baseScore: 35, protein_g: 18, carbs_g: 32, fat_g: 22, calories_kcal: 450, points: 5 },
  { id: 'macaroni_viande', name: 'Macaroni à la viande', tags: ['ultra_transforme'], baseScore: 30, protein_g: 20, carbs_g: 40, fat_g: 25, calories_kcal: 500, points: 6 },
  { id: 'tourtiere', name: 'Tourtière', tags: ['ultra_transforme', 'gras_frit'], baseScore: 25, protein_g: 22, carbs_g: 28, fat_g: 28, calories_kcal: 520, points: 7 },
  { id: 'sauce_brune', name: 'Sauce brune / Gravy', tags: ['gras_frit'], baseScore: 20, protein_g: 2, carbs_g: 5, fat_g: 4, calories_kcal: 80, points: 2 },
  { id: 'cabane_sucre', name: 'Jambon à la cabane à sucre', tags: ['gras_frit'], baseScore: 30, protein_g: 28, carbs_g: 3, fat_g: 26, calories_kcal: 380, points: 5 },
  { id: 'cretons', name: 'Creton', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 8, carbs_g: 2, fat_g: 12, calories_kcal: 150, points: 4 },
  { id: 'pain_pain', name: 'Pain de viande', tags: ['ultra_transforme'], baseScore: 35, protein_g: 22, carbs_g: 15, fat_g: 18, calories_kcal: 340, points: 4 },
  { id: 'ragoût', name: 'Ragoût de pattes de cochon', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 20, carbs_g: 25, fat_g: 24, calories_kcal: 450, points: 6 },
  { id: 'soupe_pois', name: 'Soupe aux pois', tags: ['feculent_simple'], baseScore: 55, protein_g: 12, carbs_g: 30, fat_g: 8, calories_kcal: 250, points: 2 },
  { id: 'feves', name: 'Fèves au lard', tags: ['ultra_transforme'], baseScore: 40, protein_g: 10, carbs_g: 35, fat_g: 16, calories_kcal: 350, points: 4 },
  { id: 'poutine_fromage', name: 'Poutine fromage/sauce BBQ', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 16, carbs_g: 55, fat_g: 42, calories_kcal: 820, points: 9 },
  { id: 'smoked_viande', name: 'Viande fumée', tags: ['ultra_transforme'], baseScore: 30, protein_g: 25, carbs_g: 2, fat_g: 16, calories_kcal: 280, points: 3 },
  { id: 'sandwich_viande', name: 'Sandwich à la viande fumée', tags: ['ultra_transforme'], baseScore: 25, protein_g: 28, carbs_g: 35, fat_g: 24, calories_kcal: 520, points: 6 },
  { id: 'hot_dog', name: 'Hot-dog', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 12, carbs_g: 25, fat_g: 22, calories_kcal: 380, points: 5 },
  { id: 'nachos', name: 'Nachos avec fromage', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 10, carbs_g: 40, fat_g: 28, calories_kcal: 520, points: 6 },
  { id: 'wings', name: 'Ailes de poulet frites', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 25, carbs_g: 15, fat_g: 28, calories_kcal: 450, points: 5 },
  { id: 'poutine_complete', name: 'Poutine complète (bacon/œuf)', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 20, carbs_g: 60, fat_g: 48, calories_kcal: 900, points: 10 },
  { id: 'bacon', name: 'Bacon', tags: ['gras_frit'], baseScore: 25, protein_g: 12, carbs_g: 1, fat_g: 14, calories_kcal: 180, points: 3 },
  { id: 'saucisse', name: 'Saucisse', tags: ['ultra_transforme', 'gras_frit'], baseScore: 20, protein_g: 14, carbs_g: 2, fat_g: 20, calories_kcal: 240, points: 4 },
  { id: 'boulette', name: 'Boulette de viande', tags: ['ultra_transforme'], baseScore: 25, protein_g: 18, carbs_g: 8, fat_g: 18, calories_kcal: 280, points: 3 },
  // Boissons énergétiques - Red Bull
  { id: 'redbull', name: 'Red Bull Original', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 27, fat_g: 0, calories_kcal: 110, points: 3 },
  { id: 'redbull_sugar_free', name: 'Red Bull Sugar Free', tags: ['sucre'], baseScore: 20, protein_g: 0, carbs_g: 2, fat_g: 0, calories_kcal: 10, points: 1 },
  { id: 'redbull_tropical', name: 'Red Bull Tropical', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 27, fat_g: 0, calories_kcal: 110, points: 3 },
  { id: 'redbull_berry', name: 'Red Bull Berry', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 27, fat_g: 0, calories_kcal: 110, points: 3 },
  { id: 'redbull_coconut', name: 'Red Bull Coconut', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 27, fat_g: 0, calories_kcal: 110, points: 3 },
  // Boissons énergétiques - Monster
  { id: 'monster', name: 'Monster Original', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 54, fat_g: 0, calories_kcal: 210, points: 5 },
  { id: 'monster_zero', name: 'Monster Zero Sugar', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 2, fat_g: 0, calories_kcal: 10, points: 1 },
  { id: 'monster_mango', name: 'Monster Mango Loco', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 54, fat_g: 0, calories_kcal: 210, points: 5 },
  { id: 'monster_punch', name: 'Monster Punch Tropical', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 54, fat_g: 0, calories_kcal: 210, points: 5 },
  { id: 'monster_melon', name: 'Monster Melon', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 54, fat_g: 0, calories_kcal: 210, points: 5 },
  { id: 'monster_ultra', name: 'Monster Ultra (Citron)', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 2, fat_g: 0, calories_kcal: 10, points: 1 },
  { id: 'monster_ultra_violet', name: 'Monster Ultra Violet', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 2, fat_g: 0, calories_kcal: 10, points: 1 },
  { id: 'monster_ultra_rosa', name: 'Monster Ultra Rosà', tags: ['sucre'], baseScore: 15, protein_g: 0, carbs_g: 2, fat_g: 0, calories_kcal: 10, points: 1 },
  // Boissons énergétiques - Guru
  { id: 'guru', name: 'Guru Original', tags: ['sucre'], baseScore: 20, protein_g: 0, carbs_g: 38, fat_g: 0, calories_kcal: 160, points: 3 },
  { id: 'guru_sugar_free', name: 'Guru Sugar Free', tags: ['sucre'], baseScore: 25, protein_g: 0, carbs_g: 0, fat_g: 0, calories_kcal: 0, points: 0 },
  { id: 'guru_tropical', name: 'Guru Tropical', tags: ['sucre'], baseScore: 20, protein_g: 0, carbs_g: 38, fat_g: 0, calories_kcal: 160, points: 3 },
  { id: 'guru_berry', name: 'Guru Baies', tags: ['sucre'], baseScore: 20, protein_g: 0, carbs_g: 38, fat_g: 0, calories_kcal: 160, points: 3 },
  { id: 'guru_peach', name: 'Guru Pêche Mangue', tags: ['sucre'], baseScore: 20, protein_g: 0, carbs_g: 38, fat_g: 0, calories_kcal: 160, points: 3 },
  { id: 'guru_lite', name: 'Guru Lite', tags: ['sucre'], baseScore: 22, protein_g: 0, carbs_g: 8, fat_g: 0, calories_kcal: 40, points: 1 },
  // Desserts santé
  { id: 'yaourt_grec', name: 'Yaourt grec nature', tags: ['dessert_sante', 'proteine_maigre'], baseScore: 75, protein_g: 17, carbs_g: 6, fat_g: 0, calories_kcal: 120, points: 0 },
  { id: 'pudding_chia', name: 'Pudding de chia', tags: ['dessert_sante'], baseScore: 70, protein_g: 6, carbs_g: 15, fat_g: 7, calories_kcal: 170, points: 1 },
  { id: 'pomme_cannelle', name: 'Pomme à la cannelle', tags: ['dessert_sante', 'legume'], baseScore: 80, protein_g: 0, carbs_g: 25, fat_g: 0.3, calories_kcal: 95, points: 0 },
  // Plats libanais/moyen-orientaux
  { id: 'cigare_chou', name: 'Cigare au chou', tags: ['proteine_maigre', 'legume'], baseScore: 70, protein_g: 18, carbs_g: 12, fat_g: 8, calories_kcal: 180, points: 1 },
  { id: 'dolma', name: 'Dolma (feuille de vigne)', tags: ['proteine_maigre', 'legume'], baseScore: 75, protein_g: 15, carbs_g: 10, fat_g: 6, calories_kcal: 150, points: 1 },
  { id: 'toast_beurre_peanut', name: 'Toast au beurre de peanut', tags: ['feculent_simple'], baseScore: 50, protein_g: 8, carbs_g: 30, fat_g: 16, calories_kcal: 280, points: 2 },
  { id: 'toast_beurre', name: 'Toast au beurre', tags: ['feculent_simple'], baseScore: 55, protein_g: 4, carbs_g: 25, fat_g: 8, calories_kcal: 180, points: 1 },

  // ===== McDONALD'S MENU =====
  // Burgers
  { id: 'mcdo_hamburger', name: 'McDo - Hamburger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 12, carbs_g: 32, fat_g: 9, calories_kcal: 250, points: 3 },
  { id: 'mcdo_cheeseburger', name: 'McDo - Cheeseburger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 15, carbs_g: 33, fat_g: 13, calories_kcal: 300, points: 4 },
  { id: 'mcdo_big_mac', name: 'McDo - Big Mac', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 25, carbs_g: 45, fat_g: 28, calories_kcal: 550, points: 7 },
  { id: 'mcdo_quarter_pounder', name: 'McDo - Quarter Pounder', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 28, carbs_g: 40, fat_g: 26, calories_kcal: 520, points: 6 },
  { id: 'mcdo_quarter_pounder_bacon', name: 'McDo - Quarter Pounder Bacon Cheese', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 32, carbs_g: 42, fat_g: 35, calories_kcal: 640, points: 8 },
  { id: 'mcdo_mcchicken', name: 'McDo - McChicken', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 14, carbs_g: 40, fat_g: 16, calories_kcal: 400, points: 5 },
  { id: 'mcdo_crispy_chicken', name: 'McDo - Crispy Chicken', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 17, carbs_g: 48, fat_g: 20, calories_kcal: 480, points: 6 },
  { id: 'mcdo_spicy_chicken', name: 'McDo - Spicy Chicken', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 17, carbs_g: 50, fat_g: 22, calories_kcal: 500, points: 6 },
  // Frites
  { id: 'mcdo_fries_small', name: 'McDo - Frites Small', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 3, carbs_g: 32, fat_g: 14, calories_kcal: 320, points: 4 },
  { id: 'mcdo_fries_medium', name: 'McDo - Frites Medium', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 4, carbs_g: 45, fat_g: 20, calories_kcal: 450, points: 5 },
  { id: 'mcdo_fries_large', name: 'McDo - Frites Large', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 5, carbs_g: 60, fat_g: 26, calories_kcal: 600, points: 7 },
  // Poulet
  { id: 'mcdo_nuggets_4', name: 'McDo - Chicken McNuggets 4pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 10, carbs_g: 18, fat_g: 12, calories_kcal: 200, points: 3 },
  { id: 'mcdo_nuggets_6', name: 'McDo - Chicken McNuggets 6pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 15, carbs_g: 26, fat_g: 18, calories_kcal: 300, points: 4 },
  { id: 'mcdo_nuggets_10', name: 'McDo - Chicken McNuggets 10pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 25, carbs_g: 44, fat_g: 30, calories_kcal: 500, points: 6 },
  { id: 'mcdo_nuggets_20', name: 'McDo - Chicken McNuggets 20pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 50, carbs_g: 88, fat_g: 60, calories_kcal: 1000, points: 12 },
  // Petit-déj
  { id: 'mcdo_egg_mcmuffin', name: 'McDo - Egg McMuffin', tags: ['ultra_transforme'], baseScore: 20, protein_g: 17, carbs_g: 30, fat_g: 12, calories_kcal: 300, points: 4 },
  { id: 'mcdo_sausage_mcmuffin', name: 'McDo - Sausage McMuffin Cheese', tags: ['ultra_transforme'], baseScore: 15, protein_g: 15, carbs_g: 30, fat_g: 18, calories_kcal: 350, points: 4 },
  { id: 'mcdo_bagel_sausage', name: 'McDo - Sausage Bagel', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 18, carbs_g: 50, fat_g: 22, calories_kcal: 500, points: 6 },
  { id: 'mcdo_hash_brown', name: 'McDo - Hash Brown', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 3, carbs_g: 15, fat_g: 9, calories_kcal: 150, points: 2 },
  // Boissons
  { id: 'mcdo_coke_small', name: 'McDo - Coca Cola Small', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 32, fat_g: 0, calories_kcal: 130, points: 2 },
  { id: 'mcdo_coke_medium', name: 'McDo - Coca Cola Medium', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 48, fat_g: 0, calories_kcal: 200, points: 3 },
  { id: 'mcdo_coke_large', name: 'McDo - Coca Cola Large', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 65, fat_g: 0, calories_kcal: 270, points: 4 },
  { id: 'mcdo_sprite_small', name: 'McDo - Sprite Small', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 30, fat_g: 0, calories_kcal: 120, points: 2 },
  { id: 'mcdo_sprite_medium', name: 'McDo - Sprite Medium', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 45, fat_g: 0, calories_kcal: 180, points: 3 },
  { id: 'mcdo_sprite_large', name: 'McDo - Sprite Large', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 60, fat_g: 0, calories_kcal: 240, points: 4 },
  { id: 'mcdo_fanta_small', name: 'McDo - Fanta Small', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 32, fat_g: 0, calories_kcal: 130, points: 2 },
  { id: 'mcdo_fanta_medium', name: 'McDo - Fanta Medium', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 48, fat_g: 0, calories_kcal: 200, points: 3 },
  { id: 'mcdo_fanta_large', name: 'McDo - Fanta Large', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 65, fat_g: 0, calories_kcal: 270, points: 4 },
  // Shake et McFlurry
  { id: 'mcdo_shake_vanilla_small', name: 'McDo - Shake Vanille Small', tags: ['sucre'], baseScore: 15, protein_g: 9, carbs_g: 60, fat_g: 7, calories_kcal: 330, points: 4 },
  { id: 'mcdo_shake_vanilla_medium', name: 'McDo - Shake Vanille Medium', tags: ['sucre'], baseScore: 15, protein_g: 12, carbs_g: 85, fat_g: 10, calories_kcal: 470, points: 6 },
  { id: 'mcdo_shake_vanilla_large', name: 'McDo - Shake Vanille Large', tags: ['sucre'], baseScore: 15, protein_g: 16, carbs_g: 115, fat_g: 13, calories_kcal: 640, points: 8 },
  { id: 'mcdo_shake_chocolate_small', name: 'McDo - Shake Chocolat Small', tags: ['sucre'], baseScore: 15, protein_g: 9, carbs_g: 65, fat_g: 8, calories_kcal: 360, points: 5 },
  { id: 'mcdo_shake_strawberry_medium', name: 'McDo - Shake Fraise Medium', tags: ['sucre'], baseScore: 15, protein_g: 12, carbs_g: 85, fat_g: 10, calories_kcal: 470, points: 6 },
  { id: 'mcdo_mcflurry', name: 'McDo - McFlurry Oreo', tags: ['sucre'], baseScore: 12, protein_g: 9, carbs_g: 70, fat_g: 12, calories_kcal: 420, points: 5 },
  // Salades
  { id: 'mcdo_salad_grilled_chicken', name: 'McDo - Salad Grilled Chicken', tags: ['proteine_maigre', 'legume'], baseScore: 70, protein_g: 32, carbs_g: 12, fat_g: 6, calories_kcal: 230, points: 2 },
  
  // ===== A&W CANADA MENU =====
  // Burgers
  { id: 'aw_burger_single', name: 'A&W - Single Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 16, carbs_g: 35, fat_g: 14, calories_kcal: 340, points: 4 },
  { id: 'aw_burger_double', name: 'A&W - Double Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 30, carbs_g: 38, fat_g: 28, calories_kcal: 620, points: 8 },
  { id: 'aw_burger_triple', name: 'A&W - Triple Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 44, carbs_g: 42, fat_g: 42, calories_kcal: 900, points: 11 },
  { id: 'aw_thick_burger', name: 'A&W - Thick Burger Single', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 18, carbs_g: 38, fat_g: 18, calories_kcal: 400, points: 5 },
  { id: 'aw_thick_burger_double', name: 'A&W - Thick Burger Double', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 35, carbs_g: 42, fat_g: 36, calories_kcal: 740, points: 9 },
  { id: 'aw_maple_burger', name: 'A&W - Maple Bacon Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 22, carbs_g: 40, fat_g: 24, calories_kcal: 520, points: 7 },
  { id: 'aw_bacon_cheese', name: 'A&W - Bacon Cheese Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 20, carbs_g: 38, fat_g: 24, calories_kcal: 500, points: 6 },
  { id: 'aw_chicken_burger', name: 'A&W - Crispy Chicken Burger', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 18, carbs_g: 44, fat_g: 18, calories_kcal: 480, points: 6 },
  { id: 'aw_grilled_chicken', name: 'A&W - Grilled Chicken Burger', tags: ['ultra_transforme'], baseScore: 25, protein_g: 28, carbs_g: 40, fat_g: 10, calories_kcal: 400, points: 5 },
  // Hot Dog
  { id: 'aw_hotdog', name: 'A&W - Hot Dog', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 10, carbs_g: 28, fat_g: 14, calories_kcal: 300, points: 4 },
  { id: 'aw_chili_cheese_dog', name: 'A&W - Chili Cheese Hot Dog', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 14, carbs_g: 32, fat_g: 20, calories_kcal: 420, points: 5 },
  // Frites
  { id: 'aw_fries_small', name: 'A&W - Frites Small', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 3, carbs_g: 35, fat_g: 15, calories_kcal: 340, points: 4 },
  { id: 'aw_fries_medium', name: 'A&W - Frites Medium', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 4, carbs_g: 48, fat_g: 22, calories_kcal: 480, points: 6 },
  { id: 'aw_fries_large', name: 'A&W - Frites Large', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 6, carbs_g: 65, fat_g: 30, calories_kcal: 650, points: 8 },
  { id: 'aw_onion_rings_small', name: 'A&W - Onion Rings Small', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 3, carbs_g: 40, fat_g: 18, calories_kcal: 380, points: 5 },
  { id: 'aw_onion_rings_medium', name: 'A&W - Onion Rings Medium', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 5, carbs_g: 58, fat_g: 26, calories_kcal: 560, points: 7 },
  { id: 'aw_onion_rings_large', name: 'A&W - Onion Rings Large', tags: ['ultra_transforme', 'gras_frit'], baseScore: 12, protein_g: 7, carbs_g: 78, fat_g: 35, calories_kcal: 760, points: 9 },
  // Poulet
  { id: 'aw_chicken_strips_3', name: 'A&W - Chicken Strips 3pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 18, carbs_g: 20, fat_g: 14, calories_kcal: 280, points: 3 },
  { id: 'aw_chicken_strips_5', name: 'A&W - Chicken Strips 5pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 30, carbs_g: 32, fat_g: 24, calories_kcal: 480, points: 6 },
  { id: 'aw_chicken_strips_8', name: 'A&W - Chicken Strips 8pc', tags: ['ultra_transforme', 'gras_frit'], baseScore: 18, protein_g: 48, carbs_g: 52, fat_g: 40, calories_kcal: 800, points: 10 },
  { id: 'aw_fish_chips_single', name: 'A&W - Fish & Chips Single', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 18, carbs_g: 45, fat_g: 20, calories_kcal: 480, points: 6 },
  { id: 'aw_fish_chips_double', name: 'A&W - Fish & Chips Double', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 32, carbs_g: 58, fat_g: 32, calories_kcal: 770, points: 9 },
  // Boissons
  { id: 'aw_rootbeer_small', name: 'A&W - A&W Root Beer Small', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 38, fat_g: 0, calories_kcal: 150, points: 2 },
  { id: 'aw_rootbeer_medium', name: 'A&W - A&W Root Beer Medium', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 55, fat_g: 0, calories_kcal: 220, points: 3 },
  { id: 'aw_rootbeer_large', name: 'A&W - A&W Root Beer Large', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 70, fat_g: 0, calories_kcal: 280, points: 4 },
  { id: 'aw_coke_small', name: 'A&W - Coca Cola Small', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 32, fat_g: 0, calories_kcal: 130, points: 2 },
  { id: 'aw_coke_medium', name: 'A&W - Coca Cola Medium', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 48, fat_g: 0, calories_kcal: 200, points: 3 },
  { id: 'aw_coke_large', name: 'A&W - Coca Cola Large', tags: ['sucre'], baseScore: 10, protein_g: 0, carbs_g: 65, fat_g: 0, calories_kcal: 270, points: 4 },
  // Shake
  { id: 'aw_shake_vanilla_small', name: 'A&W - Shake Vanille Small', tags: ['sucre'], baseScore: 15, protein_g: 9, carbs_g: 60, fat_g: 8, calories_kcal: 340, points: 4 },
  { id: 'aw_shake_vanilla_medium', name: 'A&W - Shake Vanille Medium', tags: ['sucre'], baseScore: 15, protein_g: 12, carbs_g: 85, fat_g: 11, calories_kcal: 480, points: 6 },
  { id: 'aw_shake_vanilla_large', name: 'A&W - Shake Vanille Large', tags: ['sucre'], baseScore: 15, protein_g: 16, carbs_g: 115, fat_g: 15, calories_kcal: 650, points: 8 },
  { id: 'aw_shake_chocolate_small', name: 'A&W - Shake Chocolat Small', tags: ['sucre'], baseScore: 15, protein_g: 9, carbs_g: 65, fat_g: 9, calories_kcal: 370, points: 5 },
  { id: 'aw_shake_strawberry_medium', name: 'A&W - Shake Fraise Medium', tags: ['sucre'], baseScore: 15, protein_g: 12, carbs_g: 85, fat_g: 11, calories_kcal: 480, points: 6 },
  // Petit-déj
  { id: 'aw_breakfast_sandwich', name: 'A&W - Breakfast Sandwich', tags: ['ultra_transforme'], baseScore: 20, protein_g: 16, carbs_g: 32, fat_g: 12, calories_kcal: 320, points: 4 },
  { id: 'aw_sausage_breakfast', name: 'A&W - Sausage Breakfast Sandwich', tags: ['ultra_transforme'], baseScore: 15, protein_g: 14, carbs_g: 32, fat_g: 18, calories_kcal: 380, points: 5 },
  { id: 'aw_hash_brown', name: 'A&W - Hash Brown', tags: ['ultra_transforme', 'gras_frit'], baseScore: 15, protein_g: 3, carbs_g: 17, fat_g: 10, calories_kcal: 160, points: 2 },
];
