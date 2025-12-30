import {
  validateWeight,
  validateMacro,
  validateCalories,
  validatePortion,
  validateMealDescription,
  validateFoodName,
  validateOptionalNutrition,
  parseAndValidateNumber,
} from '../lib/validation';

describe('validation', () => {
  describe('validateWeight', () => {
    it('should validate weight in kg within range', () => {
      const result = validateWeight(75, 'kg');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject weight below minimum (20kg)', () => {
      const result = validateWeight(15, 'kg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('entre 20 kg et 300 kg');
    });

    it('should reject weight above maximum (300kg)', () => {
      const result = validateWeight(350, 'kg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('entre 20 kg et 300 kg');
    });

    it('should reject zero weight', () => {
      const result = validateWeight(0, 'kg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should reject negative weight', () => {
      const result = validateWeight(-10, 'kg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should reject NaN', () => {
      const result = validateWeight(NaN, 'kg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should validate weight in lbs', () => {
      const result = validateWeight(150, 'lbs'); // ~68kg, valid
      expect(result.isValid).toBe(true);
    });

    it('should reject weight in lbs below minimum', () => {
      const result = validateWeight(30, 'lbs'); // ~13.6kg, invalid
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('44 lbs');
    });

    it('should reject weight in lbs above maximum', () => {
      const result = validateWeight(700, 'lbs'); // ~317kg, invalid
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('660 lbs');
    });

    it('should accept boundary values', () => {
      expect(validateWeight(20, 'kg').isValid).toBe(true);
      expect(validateWeight(300, 'kg').isValid).toBe(true);
    });
  });

  describe('validateMacro', () => {
    it('should validate protein within range', () => {
      const result = validateMacro(100, 'protein');
      expect(result.isValid).toBe(true);
    });

    it('should validate carbs within range', () => {
      const result = validateMacro(200, 'carbs');
      expect(result.isValid).toBe(true);
    });

    it('should validate fat within range', () => {
      const result = validateMacro(50, 'fat');
      expect(result.isValid).toBe(true);
    });

    it('should reject protein above maximum (500g)', () => {
      const result = validateMacro(600, 'protein');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('protéines');
      expect(result.error).toContain('500');
    });

    it('should reject carbs above maximum (1000g)', () => {
      const result = validateMacro(1500, 'carbs');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('glucides');
      expect(result.error).toContain('1000');
    });

    it('should reject fat above maximum (500g)', () => {
      const result = validateMacro(600, 'fat');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('lipides');
      expect(result.error).toContain('500');
    });

    it('should reject negative values', () => {
      const result = validateMacro(-10, 'protein');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('négatives');
    });

    it('should reject NaN', () => {
      const result = validateMacro(NaN, 'protein');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre valide');
    });

    it('should accept zero', () => {
      const result = validateMacro(0, 'protein');
      expect(result.isValid).toBe(true);
    });

    it('should accept boundary values', () => {
      expect(validateMacro(500, 'protein').isValid).toBe(true);
      expect(validateMacro(1000, 'carbs').isValid).toBe(true);
      expect(validateMacro(500, 'fat').isValid).toBe(true);
    });
  });

  describe('validateCalories', () => {
    it('should validate calories within range', () => {
      const result = validateCalories(2000);
      expect(result.isValid).toBe(true);
    });

    it('should reject calories below minimum (500)', () => {
      const result = validateCalories(300);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('au moins 500');
    });

    it('should reject calories above maximum (10000)', () => {
      const result = validateCalories(15000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10000');
    });

    it('should reject NaN', () => {
      const result = validateCalories(NaN);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre valide');
    });

    it('should accept boundary values', () => {
      expect(validateCalories(500).isValid).toBe(true);
      expect(validateCalories(10000).isValid).toBe(true);
    });

    it('should reject calories just below minimum', () => {
      const result = validateCalories(499);
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePortion', () => {
    it('should validate portion within range', () => {
      const result = validatePortion(200);
      expect(result.isValid).toBe(true);
    });

    it('should reject portion below minimum (1g)', () => {
      const result = validatePortion(0.5);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('au moins 1 g');
    });

    it('should reject portion above maximum (5000g)', () => {
      const result = validatePortion(6000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('5000');
    });

    it('should reject zero', () => {
      const result = validatePortion(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should reject negative values', () => {
      const result = validatePortion(-10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should reject NaN', () => {
      const result = validatePortion(NaN);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre positif');
    });

    it('should accept boundary values', () => {
      expect(validatePortion(1).isValid).toBe(true);
      expect(validatePortion(5000).isValid).toBe(true);
    });
  });

  describe('validateMealDescription', () => {
    it('should validate normal description', () => {
      const result = validateMealDescription('2 toasts au beurre de peanut');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateMealDescription('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('décrire');
    });

    it('should reject whitespace only', () => {
      const result = validateMealDescription('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('décrire');
    });

    it('should reject too short description (<3 chars)', () => {
      const result = validateMealDescription('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('3 caractères');
    });

    it('should accept minimum length (3 chars)', () => {
      const result = validateMealDescription('abc');
      expect(result.isValid).toBe(true);
    });

    it('should reject too long description (>500 chars)', () => {
      const longDescription = 'a'.repeat(501);
      const result = validateMealDescription(longDescription);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('500 caractères');
    });

    it('should accept maximum length (500 chars)', () => {
      const longDescription = 'a'.repeat(500);
      const result = validateMealDescription(longDescription);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFoodName', () => {
    it('should validate normal food name', () => {
      const result = validateFoodName('Poulet grillé');
      expect(result.isValid).toBe(true);
    });

    it('should reject empty string', () => {
      const result = validateFoodName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('requis');
    });

    it('should reject whitespace only', () => {
      const result = validateFoodName('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('requis');
    });

    it('should reject too short name (<2 chars)', () => {
      const result = validateFoodName('a');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('2 caractères');
    });

    it('should accept minimum length (2 chars)', () => {
      const result = validateFoodName('ab');
      expect(result.isValid).toBe(true);
    });

    it('should reject too long name (>100 chars)', () => {
      const longName = 'a'.repeat(101);
      const result = validateFoodName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100 caractères');
    });

    it('should accept maximum length (100 chars)', () => {
      const longName = 'a'.repeat(100);
      const result = validateFoodName(longName);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateOptionalNutrition', () => {
    it('should accept empty string (optional)', () => {
      const result = validateOptionalNutrition('', 'calories');
      expect(result.isValid).toBe(true);
    });

    it('should accept undefined (optional)', () => {
      const result = validateOptionalNutrition(undefined, 'calories');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid calories', () => {
      const result = validateOptionalNutrition('500', 'calories');
      expect(result.isValid).toBe(true);
    });

    it('should validate valid protein', () => {
      const result = validateOptionalNutrition('100', 'protein');
      expect(result.isValid).toBe(true);
    });

    it('should reject calories above maximum (2000)', () => {
      const result = validateOptionalNutrition('2500', 'calories');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('2000');
    });

    it('should reject protein above maximum (200g)', () => {
      const result = validateOptionalNutrition('250', 'protein');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('200');
    });

    it('should reject carbs above maximum (500g)', () => {
      const result = validateOptionalNutrition('600', 'carbs');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should reject fat above maximum (200g)', () => {
      const result = validateOptionalNutrition('250', 'fat');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('200');
    });

    it('should reject negative values', () => {
      const result = validateOptionalNutrition('-10', 'calories');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('négatives');
    });

    it('should reject NaN', () => {
      const result = validateOptionalNutrition('abc', 'calories');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('nombre valide');
    });

    it('should accept zero', () => {
      const result = validateOptionalNutrition('0', 'calories');
      expect(result.isValid).toBe(true);
    });
  });

  describe('parseAndValidateNumber', () => {
    it('should parse valid number', () => {
      const result = parseAndValidateNumber('100');
      expect(result.value).toBe(100);
      expect(result.error).toBeUndefined();
    });

    it('should parse decimal number', () => {
      const result = parseAndValidateNumber('75.5');
      expect(result.value).toBe(75.5);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty string when allowEmpty is false', () => {
      const result = parseAndValidateNumber('');
      expect(result.value).toBeNull();
      expect(result.error).toContain('requis');
    });

    it('should accept empty string when allowEmpty is true', () => {
      const result = parseAndValidateNumber('', { allowEmpty: true });
      expect(result.value).toBeNull();
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid number', () => {
      const result = parseAndValidateNumber('abc');
      expect(result.value).toBeNull();
      expect(result.error).toContain('nombre valide');
    });

    it('should enforce minimum', () => {
      const result = parseAndValidateNumber('10', { min: 20 });
      expect(result.value).toBeNull();
      expect(result.error).toContain('au moins 20');
    });

    it('should enforce maximum', () => {
      const result = parseAndValidateNumber('150', { max: 100 });
      expect(result.value).toBeNull();
      expect(result.error).toContain('dépasser 100');
    });

    it('should accept value at minimum boundary', () => {
      const result = parseAndValidateNumber('20', { min: 20 });
      expect(result.value).toBe(20);
      expect(result.error).toBeUndefined();
    });

    it('should accept value at maximum boundary', () => {
      const result = parseAndValidateNumber('100', { max: 100 });
      expect(result.value).toBe(100);
      expect(result.error).toBeUndefined();
    });

    it('should use custom error message', () => {
      const result = parseAndValidateNumber('abc', { errorMessage: 'Custom error' });
      expect(result.value).toBeNull();
      expect(result.error).toBe('Custom error');
    });

    it('should accept value within range', () => {
      const result = parseAndValidateNumber('50', { min: 10, max: 100 });
      expect(result.value).toBe(50);
      expect(result.error).toBeUndefined();
    });
  });
});


