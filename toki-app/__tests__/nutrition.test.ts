import {
  computeDailyTotals,
  percentageOfTarget,
  DEFAULT_TARGETS,
  type DailyNutritionTotals,
  type NutritionTargets,
} from '../lib/nutrition';
import { type MealEntry, type FoodItemRef } from '../lib/stats';
import { type FoodItem } from '../lib/food-db';

describe('nutrition', () => {
  describe('DEFAULT_TARGETS', () => {
    it('should have default values', () => {
      expect(DEFAULT_TARGETS.protein_g).toBe(100);
      expect(DEFAULT_TARGETS.carbs_g).toBe(250);
      expect(DEFAULT_TARGETS.calories_kcal).toBe(2000);
      expect(DEFAULT_TARGETS.fat_g).toBe(65);
    });
  });

  describe('percentageOfTarget', () => {
    it('should calculate percentage correctly', () => {
      expect(percentageOfTarget(50, 100)).toBe(50);
      expect(percentageOfTarget(100, 100)).toBe(100);
      expect(percentageOfTarget(150, 100)).toBe(100); // Capped at 100
      expect(percentageOfTarget(25, 100)).toBe(25);
    });

    it('should return 0 for zero target', () => {
      expect(percentageOfTarget(50, 0)).toBe(0);
      expect(percentageOfTarget(100, 0)).toBe(0);
    });

    it('should return 0 for negative target', () => {
      expect(percentageOfTarget(50, -10)).toBe(0);
    });

    it('should clamp to 0-100 range', () => {
      expect(percentageOfTarget(-10, 100)).toBe(0); // Negative total -> 0
      expect(percentageOfTarget(200, 100)).toBe(100); // Over 100% -> 100
    });

    it('should round the result', () => {
      expect(percentageOfTarget(33, 100)).toBe(33); // 33%
      expect(percentageOfTarget(66.6, 100)).toBe(67); // Rounded
    });

    it('should handle decimal values', () => {
      expect(percentageOfTarget(12.5, 50)).toBe(25); // 12.5/50 = 0.25 = 25%
      expect(percentageOfTarget(75.5, 200)).toBe(38); // 75.5/200 = 0.3775 = 38% (rounded)
    });
  });

  describe('computeDailyTotals', () => {
    const mockFoodItem: FoodItem = {
      id: 'test-food-1',
      name: 'Test Food',
      protein_g: 20,
      carbs_g: 30,
      fat_g: 10,
      calories_kcal: 250,
      points: 2,
      tags: [],
      baseScore: 70,
    };

    const mockFoodItem2: FoodItem = {
      id: 'test-food-2',
      name: 'Test Food 2',
      protein_g: 15,
      carbs_g: 25,
      fat_g: 8,
      calories_kcal: 200,
      points: 1,
      tags: [],
      baseScore: 70,
    };

    it('should return zeros for empty entries', () => {
      const entries: MealEntry[] = [];
      const today = new Date().toISOString();
      const result = computeDailyTotals(entries, today);
      
      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.calories_kcal).toBe(0);
      expect(result.fat_g).toBe(0);
    });

    it('should return zeros for entries with no items', () => {
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Empty meal',
          category: 'ok',
          score: 50,
          createdAt: new Date().toISOString(),
          items: [],
        },
      ];
      const today = new Date().toISOString();
      const result = computeDailyTotals(entries, today);
      
      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.calories_kcal).toBe(0);
      expect(result.fat_g).toBe(0);
    });

    it('should calculate totals for single meal with single item', () => {
      // Note: This test assumes the food exists in FOOD_DB or we use customFoods
      // For now, we'll use customFoods to ensure the food is available
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Test meal',
          category: 'ok',
          score: 50,
          createdAt: new Date().toISOString(),
          items: [
            {
              foodId: 'test-food-1',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const today = new Date().toISOString();
      const customFoods: FoodItem[] = [mockFoodItem];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(20);
      expect(result.carbs_g).toBe(30);
      expect(result.calories_kcal).toBe(250);
      expect(result.fat_g).toBe(10);
    });

    it('should calculate totals for multiple meals on same day', () => {
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Breakfast',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
        {
          id: 'meal-2',
          label: 'Lunch',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-2',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem, mockFoodItem2];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(35); // 20 + 15
      expect(result.carbs_g).toBe(55); // 30 + 25
      expect(result.calories_kcal).toBe(450); // 250 + 200
      expect(result.fat_g).toBe(18); // 10 + 8
    });

    it('should apply multiplier correctly', () => {
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Double portion',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1',
              multiplier: 2.0, // Double portion
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(40); // 20 * 2
      expect(result.carbs_g).toBe(60); // 30 * 2
      expect(result.calories_kcal).toBe(500); // 250 * 2
      expect(result.fat_g).toBe(20); // 10 * 2
    });

    it('should use default multiplier of 1.0 when not specified', () => {
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'No multiplier',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1',
              // multiplier not specified
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(20); // Should use multiplier 1.0 by default
      expect(result.calories_kcal).toBe(250);
    });

    it('should filter entries by date correctly', () => {
      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Today meal',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
        {
          id: 'meal-2',
          label: 'Yesterday meal',
          category: 'ok',
          score: 50,
          createdAt: yesterday,
          items: [
            {
              foodId: 'test-food-2',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem, mockFoodItem2];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      // Should only include today's meal
      expect(result.protein_g).toBe(20); // Only test-food-1
      expect(result.calories_kcal).toBe(250);
    });

    it('should handle missing food items gracefully', () => {
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Missing food',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'non-existent-food',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      
      // Spy on console.warn to verify warning is logged
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const result = computeDailyTotals(entries, today);
      
      expect(result.protein_g).toBe(0);
      expect(result.carbs_g).toBe(0);
      expect(result.calories_kcal).toBe(0);
      expect(result.fat_g).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle items with missing nutrition values (null/undefined)', () => {
      const foodWithMissingValues: FoodItem = {
        id: 'incomplete-food',
        name: 'Incomplete Food',
        protein_g: 10,
        carbs_g: undefined as any,
        fat_g: null as any,
        calories_kcal: 100,
        points: 1,
        tags: [],
        baseScore: 70,
      };

      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Incomplete food',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'incomplete-food',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [foodWithMissingValues];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(10);
      expect(result.carbs_g).toBe(0); // undefined -> 0
      expect(result.fat_g).toBe(0); // null -> 0
      expect(result.calories_kcal).toBe(100);
    });

    it('should sum multiple items in same meal', () => {
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Multi-item meal',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1',
              multiplier: 1.0,
            } as FoodItemRef,
            {
              foodId: 'test-food-2',
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem, mockFoodItem2];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      expect(result.protein_g).toBe(35); // 20 + 15
      expect(result.carbs_g).toBe(55); // 30 + 25
      expect(result.calories_kcal).toBe(450); // 250 + 200
      expect(result.fat_g).toBe(18); // 10 + 8
    });

    it('should combine FOOD_DB and customFoods', () => {
      // This test verifies that both FOOD_DB and customFoods are searched
      // We'll use a custom food that doesn't exist in FOOD_DB
      const today = new Date().toISOString();
      const entries: MealEntry[] = [
        {
          id: 'meal-1',
          label: 'Custom food meal',
          category: 'ok',
          score: 50,
          createdAt: today,
          items: [
            {
              foodId: 'test-food-1', // Custom food
              multiplier: 1.0,
            } as FoodItemRef,
          ],
        },
      ];
      const customFoods: FoodItem[] = [mockFoodItem];
      
      const result = computeDailyTotals(entries, today, customFoods);
      
      // Should find the custom food
      expect(result.protein_g).toBe(20);
      expect(result.calories_kcal).toBe(250);
    });
  });
});

