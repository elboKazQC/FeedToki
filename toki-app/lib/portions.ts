// Portion sizes with visual references for easy estimation

export type PortionSize = 'small' | 'medium' | 'large' | 'custom';

export type PortionReference = {
  size: PortionSize;
  label: string;
  grams: number;
  visualRef: string; // Reference visuelle (poing, paume, etc.)
  multiplier: number; // Multiplier for base nutrition values
};

// Portions selon le type d'aliment
export const PROTEIN_PORTIONS: PortionReference[] = [
  { size: 'small', label: 'Petite', grams: 75, visualRef: '🤏 Jeu de cartes', multiplier: 0.75 },
  { size: 'medium', label: 'Moyenne', grams: 100, visualRef: '✊ Poing fermé', multiplier: 1.0 },
  { size: 'large', label: 'Grande', grams: 150, visualRef: '🖐️ Paume de main', multiplier: 1.5 },
];

export const VEGETABLE_PORTIONS: PortionReference[] = [
  { size: 'small', label: 'Petite', grams: 80, visualRef: '🤏 Poignée', multiplier: 0.8 },
  { size: 'medium', label: 'Moyenne', grams: 125, visualRef: '✊ Poing', multiplier: 1.25 },
  { size: 'large', label: 'Grande', grams: 200, visualRef: '🙌 2 mains ouvertes', multiplier: 2.0 },
];

export const STARCH_PORTIONS: PortionReference[] = [
  { size: 'small', label: 'Petite', grams: 100, visualRef: '🤏 1/2 tasse', multiplier: 0.67 },
  { size: 'medium', label: 'Moyenne', grams: 150, visualRef: '✊ Poing', multiplier: 1.0 },
  { size: 'large', label: 'Grande', grams: 250, visualRef: '🙌 2 poings', multiplier: 1.67 },
];

export const CHEESE_PORTIONS: PortionReference[] = [
  { size: 'small', label: 'Petite', grams: 30, visualRef: '👍 Pouce', multiplier: 0.5 },
  { size: 'medium', label: 'Moyenne', grams: 60, visualRef: '🤏 2 pouces', multiplier: 1.0 },
  { size: 'large', label: 'Grande', grams: 90, visualRef: '🖐️ 3 doigts', multiplier: 1.5 },
];

export const SNACK_PORTIONS: PortionReference[] = [
  { size: 'small', label: 'Petite', grams: 50, visualRef: '🤏 Petite poignée', multiplier: 0.5 },
  { size: 'medium', label: 'Moyenne', grams: 100, visualRef: '✊ Poignée', multiplier: 1.0 },
  { size: 'large', label: 'Grande', grams: 150, visualRef: '🙌 Grande poignée', multiplier: 1.5 },
];

/**
 * Get appropriate portions for a food item based on its tags
 */
export function getPortionsForItem(tags: string[]): PortionReference[] {
  if (tags.includes('proteine_maigre')) {
    return PROTEIN_PORTIONS;
  }
  if (tags.includes('legume')) {
    return VEGETABLE_PORTIONS;
  }
  if (tags.includes('feculent_simple') || tags.includes('grain_complet')) {
    return STARCH_PORTIONS;
  }
  if (tags.some(t => t === 'proteine_maigre' && tags.includes('fromage'))) {
    return CHEESE_PORTIONS;
  }
  // Ultra-processed, snacks, etc.
  return SNACK_PORTIONS;
}

/**
 * Get default portion (medium) for any item
 */
export function getDefaultPortion(tags: string[]): PortionReference {
  const portions = getPortionsForItem(tags);
  return portions.find(p => p.size === 'medium') || portions[0];
}

/**
 * Format portion label for display
 */
export function formatPortionLabel(portion: PortionReference): string {
  return `${portion.label} · ${portion.grams}g · ${portion.visualRef}`;
}
