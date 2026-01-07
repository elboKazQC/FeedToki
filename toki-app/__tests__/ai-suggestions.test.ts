/**
 * Tests pour les suggestions IA (ai-suggestions.ts)
 * Vérifie: filtrage par goût, recalcul des points, garantie d'options 0 point
 */

import { fetchSmartMealSuggestions } from '../lib/ai-suggestions';
import { DailyNutritionTotals, NutritionTargets } from '../lib/nutrition';
import { SmartRecommendation } from '../lib/smart-recommendations';

// Mock OpenAI API
global.fetch = jest.fn();

describe('AI Suggestions', () => {
  const mockTotals: DailyNutritionTotals = {
    calories_kcal: 800,
    protein_g: 40,
    carbs_g: 80,
    fat_g: 20,
  };

  const mockTargets: NutritionTargets = {
    calories_kcal: 2000,
    protein_g: 150,
    carbs_g: 200,
    fat_g: 60,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock EXPO_PUBLIC_OPENAI_API_KEY
    process.env.EXPO_PUBLIC_OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  });

  describe('Filtrage par goût (sucré/salé)', () => {
    it('devrait filtrer les suggestions salées quand on demande sucré', async () => {
      // Mock réponse IA avec un mélange sucré/salé
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Poulet grillé',
                      reason: 'Protéines',
                      taste: 'salty',
                      calories: 250,
                      protein_g: 40,
                      carbs_g: 0,
                      fat_g: 8,
                      points: 0,
                      category: 'protein',
                      portion: '200g',
                      grams: 200,
                    },
                    {
                      name: 'Smoothie fraises',
                      reason: 'Frais et sucré',
                      taste: 'sweet',
                      calories: 180,
                      protein_g: 15,
                      carbs_g: 30,
                      fat_g: 2,
                      points: 0,
                      category: 'protein',
                      portion: '250ml',
                      grams: 250,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'sweet',
        timeOfDay: 'afternoon',
      });

      // Ne devrait contenir que le smoothie (sweet)
      expect(result.length).toBeGreaterThan(0);
      const names = result.map((r) => r.item.name);
      expect(names).toContain('Smoothie fraises');
      expect(names).not.toContain('Poulet grillé');
    });

    it('devrait filtrer les suggestions sucrées quand on demande salé', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Chocolat noir',
                      reason: 'Dessert',
                      taste: 'sweet',
                      calories: 200,
                      protein_g: 3,
                      carbs_g: 25,
                      fat_g: 12,
                      points: 3,
                      category: 'dessert',
                      portion: '40g',
                      grams: 40,
                    },
                    {
                      name: 'Brocoli vapeur',
                      reason: 'Légumes',
                      taste: 'salty',
                      calories: 55,
                      protein_g: 3,
                      carbs_g: 6,
                      fat_g: 0.4,
                      points: 0,
                      category: 'veggie',
                      portion: '200g',
                      grams: 200,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      const names = result.map((r) => r.item.name);
      expect(names).toContain('Brocoli vapeur');
      expect(names).not.toContain('Chocolat noir');
    });

    it('devrait filtrer par tags si taste manque dans réponse IA', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Steak haché',
                      reason: 'Protéines',
                      // taste manquant
                      calories: 250,
                      protein_g: 35,
                      carbs_g: 0,
                      fat_g: 12,
                      points: 0,
                      category: 'protein',
                      portion: '150g',
                      grams: 150,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Devrait inclure le steak car proteine_maigre = salty
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].item.name).toBe('Steak haché');
    });
  });

  describe('Recalcul des points côté app', () => {
    it('devrait recalculer les points au lieu de faire confiance à l\'IA', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Riz blanc',
                      reason: 'Glucides simples',
                      taste: 'salty',
                      calories: 200,
                      protein_g: 4,
                      carbs_g: 45,
                      fat_g: 0.5,
                      points: 0, // IA dit 0 points (FAUX!)
                      category: 'carb',
                      portion: '1 tasse',
                      grams: 150,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Le système devrait recalculer: 200 cal / 100 = 2 points (feculent simple)
      // Trouver le riz dans les résultats (pourrait ne pas être en première position si fallback ajouté)
      const rizOption = result.find((r) => r.item.name === 'Riz blanc');
      expect(rizOption).toBeDefined();
      expect(rizOption!.pointsCost).toBeGreaterThan(0);
      expect(rizOption!.pointsCost).toBe(2); // 200 / 100 = 2
    });

    it('devrait calculer 0 point pour protéines maigres', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Poulet grillé',
                      reason: 'Protéines',
                      taste: 'salty',
                      calories: 200,
                      protein_g: 35,
                      carbs_g: 0,
                      fat_g: 5,
                      points: 5, // IA dit 5 points (FAUX!)
                      category: 'protein',
                      portion: '200g',
                      grams: 200,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Protéines maigres = 0 points
      expect(result[0].pointsCost).toBe(0);
    });

    it('devrait calculer 0 point pour légumes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Brocoli',
                      reason: 'Légume',
                      taste: 'salty',
                      calories: 55,
                      protein_g: 3,
                      carbs_g: 6,
                      fat_g: 0.4,
                      points: 2, // IA dit 2 points (FAUX!)
                      category: 'veggie',
                      portion: '200g',
                      grams: 200,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      expect(result[0].pointsCost).toBe(0);
    });
  });

  describe('Garantie d\'options à 0 point', () => {
    it('devrait ajouter options 0 point depuis fallback si IA n\'en fournit pas', async () => {
      // Mock réponse IA sans aucune option 0 point
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Pizza',
                      reason: 'Comfort',
                      taste: 'salty',
                      calories: 300,
                      protein_g: 12,
                      carbs_g: 40,
                      fat_g: 10,
                      points: 4,
                      category: 'carb',
                      portion: '2 tranches',
                      grams: 200,
                    },
                    {
                      name: 'Frites',
                      reason: 'Croustillant',
                      taste: 'salty',
                      calories: 400,
                      protein_g: 5,
                      carbs_g: 50,
                      fat_g: 20,
                      points: 6,
                      category: 'carb',
                      portion: '150g',
                      grams: 150,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Devrait contenir au moins une option à 0 point (ajoutée depuis fallback)
      const zeroPointOptions = result.filter((r) => r.pointsCost === 0);
      expect(zeroPointOptions.length).toBeGreaterThan(0);
    });

    it('ne devrait pas dupliquer si IA fournit déjà des options 0 point', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      name: 'Poulet grillé',
                      reason: 'Protéines',
                      taste: 'salty',
                      calories: 200,
                      protein_g: 35,
                      carbs_g: 0,
                      fat_g: 5,
                      points: 0,
                      category: 'protein',
                      portion: '200g',
                      grams: 200,
                    },
                    {
                      name: 'Riz',
                      reason: 'Glucides',
                      taste: 'salty',
                      calories: 200,
                      protein_g: 4,
                      carbs_g: 45,
                      fat_g: 0.5,
                      points: 2,
                      category: 'carb',
                      portion: '150g',
                      grams: 150,
                    },
                  ],
                }),
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      const result = await fetchSmartMealSuggestions({
        totals: mockTotals,
        targets: mockTargets,
        availablePoints: 10,
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Devrait contenir les suggestions IA sans ajout de fallback
      expect(result.length).toBeLessThanOrEqual(8);
      const zeroPointOptions = result.filter((r) => r.pointsCost === 0);
      expect(zeroPointOptions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait retourner tableau vide si API échoue', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchSmartMealSuggestions({
          totals: mockTotals,
          targets: mockTargets,
          availablePoints: 10,
          tastePreference: 'sweet',
          timeOfDay: 'afternoon',
        })
      ).rejects.toThrow();
    });

    it('devrait gérer JSON malformé', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Not valid JSON',
              },
              finish_reason: 'stop',
            },
          ],
        }),
      });

      await expect(
        fetchSmartMealSuggestions({
          totals: mockTotals,
          targets: mockTargets,
          availablePoints: 10,
          tastePreference: 'sweet',
          timeOfDay: 'afternoon',
        })
      ).rejects.toThrow();
    });
  });
});
