// Utilitaires pour valider et nettoyer les données depuis AsyncStorage
// Gère les cas limites: données corrompues, formats invalides, etc.

/**
 * Valider et nettoyer un tableau depuis AsyncStorage
 */
export function validateAndCleanArray<T>(
  data: any,
  validator: (item: any) => item is T,
  fallback: T[] = []
): T[] {
  if (!data) {
    return fallback;
  }

  if (!Array.isArray(data)) {
    console.warn('[DataValidation] Données non-array, retour fallback');
    return fallback;
  }

  const cleaned: T[] = [];
  for (const item of data) {
    try {
      if (validator(item)) {
        cleaned.push(item);
      } else {
        console.warn('[DataValidation] Item invalide ignoré:', item);
      }
    } catch (error) {
      console.warn('[DataValidation] Erreur validation item:', error, item);
    }
  }

  return cleaned;
}

/**
 * Valider et nettoyer un objet depuis AsyncStorage
 */
export function validateAndCleanObject<T>(
  data: any,
  validator: (obj: any) => obj is T,
  fallback: T | null = null
): T | null {
  if (!data) {
    return fallback;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    console.warn('[DataValidation] Données non-object, retour fallback');
    return fallback;
  }

  try {
    if (validator(data)) {
      return data;
    } else {
      console.warn('[DataValidation] Objet invalide, retour fallback');
      return fallback;
    }
  } catch (error) {
    console.warn('[DataValidation] Erreur validation objet:', error);
    return fallback;
  }
}

/**
 * Parser JSON de manière sécurisée avec fallback
 */
export function safeJsonParse<T>(
  json: string | null,
  fallback: T,
  validator?: (data: any) => data is T
): T {
  if (!json) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(json);
    
    if (validator) {
      return validator(parsed) ? parsed : fallback;
    }
    
    return parsed as T;
  } catch (error) {
    console.warn('[DataValidation] Erreur parsing JSON:', error);
    return fallback;
  }
}

/**
 * Valider qu'un nombre est dans une plage raisonnable
 */
export function validateNumberRange(
  value: any,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return fallback;
  }

  if (value < min || value > max) {
    console.warn(`[DataValidation] Valeur ${value} hors plage [${min}, ${max}], utilisation fallback ${fallback}`);
    return fallback;
  }

  return value;
}

/**
 * Valider qu'une date est valide et raisonnable
 */
export function validateDate(
  value: any,
  fallback: string = new Date().toISOString()
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return fallback;
    }

    // Vérifier que la date n'est pas trop ancienne ou future
    const now = new Date();
    const minDate = new Date(2020, 0, 1); // 1er janvier 2020
    const maxDate = new Date(now.getFullYear() + 1, 11, 31); // 31 décembre année prochaine

    if (date < minDate || date > maxDate) {
      console.warn(`[DataValidation] Date ${value} hors plage raisonnable, utilisation fallback`);
      return fallback;
    }

    return value;
  } catch (error) {
    console.warn('[DataValidation] Erreur validation date:', error);
    return fallback;
  }
}

/**
 * Valider qu'un string n'est pas vide et a une longueur raisonnable
 */
export function validateString(
  value: any,
  maxLength: number = 1000,
  fallback: string = ''
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  if (value.length > maxLength) {
    console.warn(`[DataValidation] String trop long (${value.length} > ${maxLength}), tronqué`);
    return value.substring(0, maxLength);
  }

  return value;
}

