import {
  fetchProductByBarcode,
  searchProducts,
  mapOffProductToFoodItem,
  searchAndMapBestProduct,
  type OffProduct,
} from '../lib/open-food-facts';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock fetch globalement
global.fetch = jest.fn();

describe('open-food-facts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchProductByBarcode', () => {
    it('should return null for empty barcode', async () => {
      const result = await fetchProductByBarcode('');
      expect(result).toBeNull();
    });

    it('should fetch product from API', async () => {
      const mockProduct: OffProduct = {
        code: '3017620422003',
        product_name: 'Nutella',
        brands: 'Ferrero',
        nutriments: {
          'energy-kcal_100g': 539,
          'proteins_100g': 6.3,
          'carbohydrates_100g': 57.5,
          'fat_100g': 30.9,
        },
        nutriscore_grade: 'e',
        nova_group: 4,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 1,
          product: mockProduct,
        }),
      });

      const result = await fetchProductByBarcode('3017620422003', false);
      
      expect(result).toBeDefined();
      expect(result?.code).toBe('3017620422003');
      expect(result?.product_name).toBe('Nutella');
      expect(result?.nutriments?.['energy-kcal_100g']).toBe(539);
    });

    it('should return null for non-existent product', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 0,
        }),
      });

      const result = await fetchProductByBarcode('0000000000000', false);
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchProductByBarcode('3017620422003', false);
      expect(result).toBeNull();
    });
  });

  describe('searchProducts', () => {
    it('should return null for empty query', async () => {
      const result = await searchProducts('');
      expect(result).toBeNull();
    });

    it('should search products', async () => {
      const mockProducts: OffProduct[] = [
        {
          code: '3017620422003',
          product_name: 'Nutella',
          brands: 'Ferrero',
          nutriments: {
            'energy-kcal_100g': 539,
            'proteins_100g': 6.3,
            'carbohydrates_100g': 57.5,
            'fat_100g': 30.9,
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: mockProducts,
          count: 1,
          page: 1,
          page_size: 20,
        }),
      });

      const result = await searchProducts('Nutella');
      
      expect(result).toBeDefined();
      expect(result?.products.length).toBeGreaterThan(0);
      expect(result?.products[0].product_name).toBe('Nutella');
    });
  });

  describe('mapOffProductToFoodItem', () => {
    it('should map OFF product to FoodItem', () => {
      const offProduct: OffProduct = {
        code: '3017620422003',
        product_name: 'Nutella',
        brands: 'Ferrero',
        nutriments: {
          'energy-kcal_100g': 539,
          'proteins_100g': 6.3,
          'carbohydrates_100g': 57.5,
          'fat_100g': 30.9,
        },
        nutriscore_grade: 'e',
        nova_group: 4,
      };

      const foodItem = mapOffProductToFoodItem(offProduct);

      expect(foodItem.id).toBe('off_3017620422003');
      expect(foodItem.name).toContain('Nutella');
      expect(foodItem.name).toContain('Ferrero');
      expect(foodItem.calories_kcal).toBe(539);
      expect(foodItem.protein_g).toBe(6.3);
      expect(foodItem.carbs_g).toBe(57.5);
      expect(foodItem.fat_g).toBe(30.9);
      expect(foodItem.tags).toContain('ultra_transforme');
      expect(foodItem.baseScore).toBeLessThanOrEqual(30); // Nutriscore E = mauvais score
    });

    it('should handle product without brands', () => {
      const offProduct: OffProduct = {
        code: '1234567890123',
        product_name: 'Generic Product',
        nutriments: {
          'energy-kcal_100g': 100,
          'proteins_100g': 5,
          'carbohydrates_100g': 10,
          'fat_100g': 2,
        },
      };

      const foodItem = mapOffProductToFoodItem(offProduct);

      expect(foodItem.name).toBe('Generic Product');
      expect(foodItem.id).toBe('off_1234567890123');
    });

    it('should handle product with missing nutriments', () => {
      const offProduct: OffProduct = {
        code: '1234567890123',
        product_name: 'Incomplete Product',
        nutriments: {},
      };

      const foodItem = mapOffProductToFoodItem(offProduct);

      expect(foodItem.calories_kcal).toBe(0);
      expect(foodItem.protein_g).toBe(0);
      expect(foodItem.carbs_g).toBe(0);
      expect(foodItem.fat_g).toBe(0);
    });

    it('should assign correct points based on tags', () => {
      // Produit ultra-transformé
      const ultraProcessed: OffProduct = {
        code: '1',
        product_name: 'Ultra Processed',
        nova_group: 4,
        nutriments: {},
      };

      const ultraItem = mapOffProductToFoodItem(ultraProcessed);
      expect(ultraItem.points).toBeGreaterThanOrEqual(4);

      // Produit sain (protéine)
      const healthy: OffProduct = {
        code: '2',
        product_name: 'Chicken Breast',
        nutriscore_grade: 'a',
        nutriments: {
          'proteins_100g': 30,
        },
      };

      const healthyItem = mapOffProductToFoodItem(healthy);
      expect(healthyItem.points).toBe(0);
    });
  });

  describe('searchAndMapBestProduct', () => {
    it('should return null when no products found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [],
          count: 0,
          page: 1,
          page_size: 20,
        }),
      });

      const result = await searchAndMapBestProduct('NonExistentProduct123456');
      expect(result).toBeNull();
    });

    it('should return mapped FoodItem for best match', async () => {
      const mockProduct: OffProduct = {
        code: '5000159484695',
        product_name: 'KitKat',
        brands: 'Nestlé',
        nutriments: {
          'energy-kcal_100g': 518,
          'proteins_100g': 6.9,
          'carbohydrates_100g': 59,
          'fat_100g': 27,
        },
        nutriscore_grade: 'd',
        nova_group: 4,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          products: [mockProduct],
          count: 1,
          page: 1,
          page_size: 20,
        }),
      });

      const result = await searchAndMapBestProduct('KitKat');
      
      expect(result).toBeDefined();
      expect(result?.name).toContain('KitKat');
      expect(result?.name).toContain('Nestlé');
      expect(result?.calories_kcal).toBe(518);
      expect(result?.tags).toContain('ultra_transforme');
    });
  });
});
