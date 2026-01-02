import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 * Fix pour erreur 418 (hydratation React) : toujours retourner la même valeur initiale
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const colorScheme = useRNColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Toujours retourner la valeur réelle pour éviter les erreurs d'hydratation
  // Si colorScheme est null/undefined, utiliser 'light' comme fallback
  return colorScheme || 'light';
}
