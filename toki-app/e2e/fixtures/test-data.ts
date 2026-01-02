/**
 * Données de test pour les tests E2E
 */

/**
 * Génère un email unique pour les tests
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `test+e2e+${timestamp}+${random}@example.com`;
}

/**
 * Mot de passe de test standard
 */
export const TEST_PASSWORD = 'TestPassword123!';

/**
 * Nom d'affichage de test
 */
export const TEST_DISPLAY_NAME = 'Test User E2E';

/**
 * Aliments de test pour les repas
 */
export const TEST_FOODS = {
  chicken: 'poulet',
  rice: 'riz',
  bread: 'pain',
  apple: 'pomme',
  egg: 'oeuf',
};

/**
 * Descriptions de repas de test pour l'IA
 */
export const TEST_MEAL_DESCRIPTIONS = {
  simple: 'poulet et riz',
  withQuantity: '200g de poulet, 1 tasse de riz et des légumes',
  complex: '2 toasts au beurre de peanut',
};
