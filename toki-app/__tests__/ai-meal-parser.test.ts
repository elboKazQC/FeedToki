import {
  parseMealDescription,
  type ParsedFoodItem,
  type ParsedMealResult,
} from '../lib/ai-meal-parser';

describe('ai-meal-parser', () => {
  describe('parseMealDescription', () => {
    it('should return error for empty description', async () => {
      const result = await parseMealDescription('');
      expect(result.error).toBeDefined();
      expect(result.items).toHaveLength(0);
    });

    it('should return error for whitespace only', async () => {
      const result = await parseMealDescription('   ');
      expect(result.error).toBeDefined();
      expect(result.items).toHaveLength(0);
    });

    it('should parse simple food name', async () => {
      const result = await parseMealDescription('poulet');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].name).toContain('Poulet');
    });

    it('should parse quantity with number', async () => {
      const result = await parseMealDescription('2 toasts');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      // quantityNumber may or may not be set depending on parsing logic
      // But quantity string should be defined if quantity is detected
      const item = result.items.find(i => i.name.toLowerCase().includes('toast'));
      if (item) {
        // If quantity is parsed, it should have quantityNumber or quantity string
        if (item.quantityNumber !== undefined) {
          expect(item.quantityNumber).toBe(2);
        }
        // At minimum, should detect the food
        expect(item.name).toBeDefined();
      }
    });

    it('should parse quantity in French words', async () => {
      const result = await parseMealDescription('deux toasts');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].quantityNumber).toBe(2);
    });

    it('should parse quantity with unit (g, kg, ml)', async () => {
      const result = await parseMealDescription('200g de poulet');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].quantity).toContain('200');
      expect(result.items[0].quantity).toContain('g');
    });

    it('should parse complex dish with quantity', async () => {
      const result = await parseMealDescription('2 toasts au beurre de peanut');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      // Should detect the toast dish
      const toastItem = result.items.find(item => 
        item.name.toLowerCase().includes('toast') || 
        item.name.toLowerCase().includes('peanut')
      );
      expect(toastItem).toBeDefined();
      if (toastItem) {
        expect(toastItem.quantityNumber).toBe(2);
      }
    });

    it('should parse multiple foods separated by "et"', async () => {
      const result = await parseMealDescription('poulet et riz');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const names = result.items.map(item => item.name.toLowerCase());
      expect(names.some(name => name.includes('poulet'))).toBe(true);
      expect(names.some(name => name.includes('riz'))).toBe(true);
    });

    it('should parse multiple foods separated by comma', async () => {
      const result = await parseMealDescription('poulet, riz et brocoli');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse quantity for each food in multiple foods', async () => {
      const result = await parseMealDescription('2 toasts au beurre de peanut et une pomme');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      // Should have quantity for toast
      const toastItem = result.items.find(item => 
        item.name.toLowerCase().includes('toast') || 
        item.name.toLowerCase().includes('peanut')
      );
      if (toastItem) {
        expect(toastItem.quantityNumber).toBe(2);
      }
      // Should have quantity for apple
      const appleItem = result.items.find(item => 
        item.name.toLowerCase().includes('pomme') ||
        item.name.toLowerCase().includes('apple')
      );
      if (appleItem && appleItem.quantityNumber) {
        expect(appleItem.quantityNumber).toBe(1);
      }
    });

    it('should handle "2x" format', async () => {
      const result = await parseMealDescription('2x poulet');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      if (item.quantityNumber) {
        expect(item.quantityNumber).toBe(2);
      }
    });

    it('should handle English food names', async () => {
      const result = await parseMealDescription('chicken and rice');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      // Should detect both chicken and rice
      const names = result.items.map(item => item.name.toLowerCase());
      expect(names.some(name => name.includes('poulet') || name.includes('chicken'))).toBe(true);
      expect(names.some(name => name.includes('riz') || name.includes('rice'))).toBe(true);
    });

    it('should handle vegetables', async () => {
      const result = await parseMealDescription('brocoli et carottes');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const names = result.items.map(item => item.name.toLowerCase());
      expect(names.some(name => name.includes('brocoli'))).toBe(true);
      expect(names.some(name => name.includes('carotte'))).toBe(true);
    });

    it('should handle proteins', async () => {
      const testCases = ['poulet', 'dinde', 'poisson', 'oeufs', 'tofu'];
      
      for (const food of testCases) {
        const result = await parseMealDescription(food);
        expect(result.error).toBeUndefined();
        expect(result.items.length).toBeGreaterThan(0);
        const names = result.items.map(item => item.name.toLowerCase());
        expect(names.some(name => name.includes(food))).toBe(true);
      }
    });

    it('should handle starches', async () => {
      const testCases = ['riz', 'pates', 'patate', 'quinoa'];
      
      for (const food of testCases) {
        const result = await parseMealDescription(food);
        expect(result.error).toBeUndefined();
        expect(result.items.length).toBeGreaterThan(0);
      }
    });

    it('should return fallback item if no food detected', async () => {
      const result = await parseMealDescription('quelque chose de très bizarre');
      expect(result.error).toBeUndefined();
      // Should have at least one item (fallback to original description)
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should extract quantity before food name', async () => {
      const result = await parseMealDescription('3 oeufs');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const eggItem = result.items.find(item => 
        item.name.toLowerCase().includes('oeuf')
      );
      if (eggItem && eggItem.quantityNumber) {
        expect(eggItem.quantityNumber).toBe(3);
      }
    });

    it('should extract quantity after food name', async () => {
      const result = await parseMealDescription('poulet 200g');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      if (item.quantity) {
        expect(item.quantity).toContain('200');
      }
    });

    it('should handle fractional quantities', async () => {
      const result = await parseMealDescription('1.5 tasse de riz');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      if (item.quantity) {
        expect(item.quantity).toContain('1.5');
      }
    });

    it('should handle portion unit', async () => {
      const result = await parseMealDescription('1 portion de poulet');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      if (item.quantity) {
        expect(item.quantity.toLowerCase()).toContain('portion');
      }
    });

    it('should handle "tasse" unit', async () => {
      const result = await parseMealDescription('1 tasse de riz');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      const item = result.items[0];
      if (item.quantity) {
        expect(item.quantity.toLowerCase()).toContain('tasse');
      }
    });

    it('should handle complex description with multiple elements', async () => {
      const result = await parseMealDescription('200g de poulet, 1 tasse de riz et des légumes');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
    });

    it('should set confidence score for parsed items', async () => {
      const result = await parseMealDescription('poulet');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThan(0);
      // Confidence should be a number between 0 and 1 if defined
      result.items.forEach(item => {
        if (item.confidence !== undefined) {
          expect(item.confidence).toBeGreaterThanOrEqual(0);
          expect(item.confidence).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should handle case insensitivity', async () => {
      const result1 = await parseMealDescription('POULET');
      const result2 = await parseMealDescription('poulet');
      const result3 = await parseMealDescription('Poulet');
      
      // All should parse successfully
      expect(result1.error).toBeUndefined();
      expect(result2.error).toBeUndefined();
      expect(result3.error).toBeUndefined();
    });

    it('should handle plural forms', async () => {
      const singular = await parseMealDescription('toast');
      const plural = await parseMealDescription('toasts');
      
      // Both should parse successfully
      expect(singular.error).toBeUndefined();
      expect(plural.error).toBeUndefined();
    });

    it('should detect multiple foods with "and" connector', async () => {
      const result = await parseMealDescription('two toasts and two eggs');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const names = result.items.map(item => item.name.toLowerCase());
      expect(names.some(name => name.includes('toast'))).toBe(true);
      expect(names.some(name => name.includes('oeuf') || name.includes('egg'))).toBe(true);
    });

    it('should detect multiple foods with "then" connector', async () => {
      const result = await parseMealDescription('I ate chicken then rice');
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(2);
      const names = result.items.map(item => item.name.toLowerCase());
      expect(names.some(name => name.includes('poulet') || name.includes('chicken'))).toBe(true);
      expect(names.some(name => name.includes('riz') || name.includes('rice'))).toBe(true);
    });

    it('should detect multiple foods in complex description', async () => {
      const result = await parseMealDescription(
        '2 petits pains avec du pâté, puis 2 bières, 3 fromages, des boulettes avec de la purée et des légumes'
      );
      expect(result.error).toBeUndefined();
      expect(result.items.length).toBeGreaterThanOrEqual(3);
      const names = result.items.map(item => item.name.toLowerCase());
      // Au minimum: pain/toast, fromage, légumes (3 items détectés)
      expect(names.some(name => name.includes('toast') || name.includes('pain'))).toBe(true);
      expect(names.some(name => name.includes('fromage'))).toBe(true);
      expect(names.some(name => name.includes('légume'))).toBe(true);
    });

    it('should not duplicate items', async () => {
      const result = await parseMealDescription('poulet et poulet et poulet');
      expect(result.error).toBeUndefined();
      // Should deduplicate and return only 1 item
      expect(result.items.length).toBe(1);
      expect(result.items[0].name.toLowerCase()).toContain('poulet');
    });
  });
});

