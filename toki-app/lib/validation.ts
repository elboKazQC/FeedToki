// Utilitaires de validation pour les inputs utilisateur
// Messages d'erreur en français

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Valider un poids (en kg)
 */
export function validateWeight(weight: number, unit: 'kg' | 'lbs' = 'kg'): ValidationResult {
  if (isNaN(weight) || weight <= 0) {
    return {
      isValid: false,
      error: 'Le poids doit être un nombre positif',
    };
  }

  // Convertir en kg pour validation
  const weightInKg = unit === 'lbs' ? weight * 0.453592 : weight;

  if (weightInKg < 20 || weightInKg > 300) {
    return {
      isValid: false,
      error: unit === 'lbs'
        ? 'Le poids doit être entre 44 lbs et 660 lbs'
        : 'Le poids doit être entre 20 kg et 300 kg',
    };
  }

  return { isValid: true };
}

/**
 * Valider une valeur nutritionnelle (protéines, glucides, lipides)
 */
export function validateMacro(value: number, macroName: 'protein' | 'carbs' | 'fat'): ValidationResult {
  if (isNaN(value)) {
    return {
      isValid: false,
      error: `Les ${macroName === 'protein' ? 'protéines' : macroName === 'carbs' ? 'glucides' : 'lipides'} doivent être un nombre valide`,
    };
  }

  if (value < 0) {
    return {
      isValid: false,
      error: `Les ${macroName === 'protein' ? 'protéines' : macroName === 'carbs' ? 'glucides' : 'lipides'} ne peuvent pas être négatives`,
    };
  }

  const limits = {
    protein: { min: 0, max: 500 },
    carbs: { min: 0, max: 1000 },
    fat: { min: 0, max: 500 },
  };

  const limit = limits[macroName];
  if (value > limit.max) {
    const macroLabel = macroName === 'protein' ? 'protéines' : macroName === 'carbs' ? 'glucides' : 'lipides';
    return {
      isValid: false,
      error: `Les ${macroLabel} doivent être inférieures à ${limit.max} g`,
    };
  }

  return { isValid: true };
}

/**
 * Valider les calories
 */
export function validateCalories(calories: number): ValidationResult {
  if (isNaN(calories)) {
    return {
      isValid: false,
      error: 'Les calories doivent être un nombre valide',
    };
  }

  if (calories < 500) {
    return {
      isValid: false,
      error: 'Les calories doivent être au moins 500 kcal/jour',
    };
  }

  if (calories > 10000) {
    return {
      isValid: false,
      error: 'Les calories ne peuvent pas dépasser 10000 kcal/jour',
    };
  }

  return { isValid: true };
}

/**
 * Valider une portion (en grammes)
 */
export function validatePortion(grams: number): ValidationResult {
  if (isNaN(grams) || grams <= 0) {
    return {
      isValid: false,
      error: 'La portion doit être un nombre positif',
    };
  }

  if (grams < 1) {
    return {
      isValid: false,
      error: 'La portion doit être d\'au moins 1 g',
    };
  }

  if (grams > 5000) {
    return {
      isValid: false,
      error: 'La portion ne peut pas dépasser 5000 g (5 kg)',
    };
  }

  return { isValid: true };
}

/**
 * Valider une description de repas (pour IA)
 */
export function validateMealDescription(description: string): ValidationResult {
  if (!description || description.trim().length === 0) {
    return {
      isValid: false,
      error: 'Veuillez décrire ce que vous avez mangé',
    };
  }

  if (description.trim().length < 3) {
    return {
      isValid: false,
      error: 'La description doit contenir au moins 3 caractères',
    };
  }

  if (description.length > 500) {
    return {
      isValid: false,
      error: 'La description ne peut pas dépasser 500 caractères',
    };
  }

  return { isValid: true };
}

/**
 * Valider un nom d'aliment
 */
export function validateFoodName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Le nom de l\'aliment est requis',
    };
  }

  if (name.trim().length < 2) {
    return {
      isValid: false,
      error: 'Le nom de l\'aliment doit contenir au moins 2 caractères',
    };
  }

  if (name.length > 100) {
    return {
      isValid: false,
      error: 'Le nom de l\'aliment ne peut pas dépasser 100 caractères',
    };
  }

  return { isValid: true };
}

/**
 * Valider une valeur nutritionnelle optionnelle (pour food requests)
 */
export function validateOptionalNutrition(value: string | undefined, macroName: 'calories' | 'protein' | 'carbs' | 'fat'): ValidationResult {
  if (!value || value.trim().length === 0) {
    return { isValid: true }; // Optionnel, donc vide = OK
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    const labels: Record<string, string> = {
      calories: 'calories',
      protein: 'protéines',
      carbs: 'glucides',
      fat: 'lipides',
    };
    return {
      isValid: false,
      error: `Les ${labels[macroName]} doivent être un nombre valide`,
    };
  }

  if (numValue < 0) {
    const labels: Record<string, string> = {
      calories: 'calories',
      protein: 'protéines',
      carbs: 'glucides',
      fat: 'lipides',
    };
    return {
      isValid: false,
      error: `Les ${labels[macroName]} ne peuvent pas être négatives`,
    };
  }

  // Limites raisonnables pour les valeurs optionnelles
  const limits: Record<string, { max: number }> = {
    calories: { max: 2000 },
    protein: { max: 200 },
    carbs: { max: 500 },
    fat: { max: 200 },
  };

  const limit = limits[macroName];
  if (numValue > limit.max) {
    const labels: Record<string, string> = {
      calories: 'calories',
      protein: 'protéines',
      carbs: 'glucides',
      fat: 'lipides',
    };
    return {
      isValid: false,
      error: `Les ${labels[macroName]} semblent trop élevées (max: ${limit.max}${macroName === 'calories' ? ' kcal' : ' g'})`,
    };
  }

  return { isValid: true };
}

/**
 * Valider et nettoyer une valeur numérique depuis un string
 */
export function parseAndValidateNumber(
  value: string,
  options: {
    min?: number;
    max?: number;
    allowEmpty?: boolean;
    errorMessage?: string;
  } = {}
): { value: number | null; error?: string } {
  const { min, max, allowEmpty = false, errorMessage } = options;

  if (!value || value.trim().length === 0) {
    if (allowEmpty) {
      return { value: null };
    }
    return {
      value: null,
      error: errorMessage || 'Cette valeur est requise',
    };
  }

  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return {
      value: null,
      error: errorMessage || 'Veuillez entrer un nombre valide',
    };
  }

  if (min !== undefined && numValue < min) {
    return {
      value: null,
      error: errorMessage || `La valeur doit être au moins ${min}`,
    };
  }

  if (max !== undefined && numValue > max) {
    return {
      value: null,
      error: errorMessage || `La valeur ne peut pas dépasser ${max}`,
    };
  }

  return { value: numValue };
}

