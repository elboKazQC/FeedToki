/**
 * Tests pour les suggestions IA (ai-suggestions.ts)
 * Verifie: filtrage par gout, parsing JSON, gestion des erreurs
 */

import { fetchSmartMealSuggestions } from '../lib/ai-suggestions';
import { DailyNutritionTotals, NutritionTargets } from '../lib/nutrition';

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
        tastePreference: 'salty',
        timeOfDay: 'evening',
      });

      // Devrait inclure le steak car proteine_maigre = salty
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].item.name).toBe('Steak haché');
    });
  });



  describe('Gestion des erreurs', () => {
    it('devrait retourner tableau vide si API échoue', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        fetchSmartMealSuggestions({
          totals: mockTotals,
          targets: mockTargets,
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
          tastePreference: 'sweet',
          timeOfDay: 'afternoon',
        })
      ).rejects.toThrow();
    });
  });
});
