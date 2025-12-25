// Système d'achats in-app pour Toki
// À intégrer avec expo-in-app-purchases ou RevenueCat plus tard

export type PurchaseProduct = {
  id: string;
  name: string;
  description: string;
  priceUSD: number;
  priceDisplay: string;
};

// Produits disponibles
export const PRODUCTS: Record<string, PurchaseProduct> = {
  RESURRECT_DRAGON: {
    id: 'com.toki.resurrect_dragon',
    name: 'Ressusciter le Dragon',
    description: 'Ramène ton dragon à la vie sans perdre ton streak!',
    priceUSD: 4.99,
    priceDisplay: '4,99 $',
  },
};

// État des achats (sera remplacé par le vrai système)
let purchasedItems: Set<string> = new Set();

/**
 * Simuler un achat (à remplacer par le vrai système IAP)
 * Retourne true si l'achat est réussi
 */
export async function purchaseProduct(productId: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Intégrer avec expo-in-app-purchases ou RevenueCat
  // Pour l'instant, on simule un achat réussi pour le développement
  
  console.log(`[IAP] Tentative d'achat: ${productId}`);
  
  // En mode développement, simuler un délai et réussite
  if (__DEV__) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    purchasedItems.add(productId);
    console.log(`[IAP] Achat simulé réussi: ${productId}`);
    return { success: true };
  }
  
  // En production, retourner une erreur jusqu'à ce que le vrai système soit configuré
  return { 
    success: false, 
    error: 'Les achats in-app ne sont pas encore configurés.' 
  };
}

/**
 * Vérifier si un produit a été acheté
 */
export function hasPurchased(productId: string): boolean {
  return purchasedItems.has(productId);
}

/**
 * Restaurer les achats (pour les utilisateurs qui réinstallent)
 */
export async function restorePurchases(): Promise<{ success: boolean; restoredCount: number }> {
  // TODO: Implémenter avec le vrai système IAP
  console.log('[IAP] Restauration des achats...');
  return { success: true, restoredCount: 0 };
}

/**
 * Initialiser le système d'achats
 */
export async function initializePurchases(): Promise<void> {
  // TODO: Initialiser expo-in-app-purchases ou RevenueCat
  console.log('[IAP] Système d\'achats initialisé (mode simulation)');
}

// Instructions pour l'intégration future:
// 
// 1. Installer: npx expo install expo-in-app-purchases
// 
// 2. Configurer dans app.json:
//    "plugins": [
//      ["expo-in-app-purchases"]
//    ]
//
// 3. Configurer les produits dans:
//    - App Store Connect (iOS)
//    - Google Play Console (Android)
//
// 4. Remplacer les fonctions simulées par les vraies implémentations
