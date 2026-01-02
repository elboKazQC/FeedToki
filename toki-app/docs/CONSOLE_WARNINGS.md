# Analyse des Warnings Console

Ce document analyse les warnings et erreurs qui apparaissent dans la console du navigateur pour l'application FeedToki.

## Warnings Normaux (Peuvent être ignorés)

### 1. Expo Notifications
```
[expo-notifications] Listening to push token changes is not yet fully supported on web.
```
**Statut**: Normal  
**Explication**: Les notifications push ne sont pas encore entièrement supportées sur web. C'est une limitation connue d'Expo.  
**Action**: Aucune action requise.

### 2. Animated useNativeDriver
```
Animated: `useNativeDriver` is not supported because the native animated module is missing.
```
**Statut**: ✅ **CORRIGÉ**  
**Explication**: Sur web, le module d'animation native n'est pas disponible.  
**Correction appliquée**: Toutes les animations dans `lib/animations.ts` utilisent maintenant `useNativeDriver: Platform.OS !== 'web'` pour désactiver automatiquement le native driver sur web.  
**Action**: Aucune action requise - le warning ne devrait plus apparaître.

### 3. Fonts MaterialIcons
```
Failed to decode downloaded font: .../MaterialIcons.4e85bc9....ttf
OTS parsing error: invalid sfntVersion: 1008813135
```
**Statut**: Normal (cosmétique)  
**Explication**: Certaines polices MaterialIcons peuvent avoir des problèmes de parsing sur certains navigateurs, mais cela n'affecte généralement pas l'affichage.  
**Action**: Peut être ignoré sauf si des icônes ne s'affichent pas.

### 4. XSLT Deprecation
```
[Deprecation] crbug.com/435623334: This page uses XSLT, which being considered for removal from the web.
```
**Statut**: Normal (avertissement futur)  
**Explication**: Un script externe (antidote.js) utilise XSLT, qui pourrait être déprécié dans le futur. Ce n'est pas notre code.  
**Action**: Aucune action requise pour l'instant.

## Erreurs à Corriger

### 1. Firebase Permissions - API Rate Limit
```
[API Rate Limit] Erreur reset limite: FirebaseError: Missing or insufficient permissions.
[API Rate Limit] Erreur vérification limite: FirebaseError: Missing or insufficient permissions.
[API Rate Limit] Erreur incrément appel: FirebaseError: Missing or insufficient permissions.
```
**Statut**: ⚠️ **CRITIQUE**  
**Explication**: L'application essaie d'accéder à la collection `api_usage` dans Firestore mais n'a pas les permissions nécessaires.  
**Cause possible**: 
- L'utilisateur n'est pas authentifié
- Les règles Firestore ne permettent pas l'accès
- La collection n'existe pas encore

**Vérification**:
- Les règles Firestore dans `firestore.rules` semblent correctes :
  ```javascript
  match /api_usage/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```

**Actions à prendre**:
1. Vérifier que l'utilisateur est bien authentifié avant d'appeler les fonctions de rate limiting
2. Ajouter une gestion d'erreur gracieuse (logger un warning mais continuer)
3. Vérifier que la collection `api_usage` existe dans Firestore

**Fichiers concernés**:
- `toki-app/lib/openai-parser.ts` (fonctions de rate limiting)

### 2. NetworkError
```
Uncaught (in promise) NetworkError: A network error occurred.
```
**Statut**: ✅ **CORRIGÉ**  
**Explication**: Une erreur réseau s'est produite, probablement lors d'un appel API.  
**Cause possible**:
- Problème de connexion internet
- Timeout d'une requête
- Erreur Firebase/Firestore

**Correction appliquée**: 
- Gestion d'erreur globale ajoutée dans `app/_layout.tsx` pour capturer les NetworkError non gérés
- Les erreurs sont maintenant loggées avec plus de contexte (message, stack, URL)
- Les erreurs sont envoyées à Sentry en production si configuré
- Le comportement par défaut n'est pas empêché, mais les erreurs sont maintenant tracées

**Actions futures** (optionnel):
1. Ajouter un retry automatique pour les erreurs réseau temporaires
2. Afficher un message utilisateur pour les erreurs critiques

## Warnings Open Food Facts (Normaux après nos corrections)

### OFF - Aucun produit valide trouvé
```
[WARN] [OFF] Aucun produit valide trouvé pour: pâte {totalResults: 10}
[WARN] [OFF] Aucun produit valide trouvé pour: poulet {totalResults: 10}
```
**Statut**: Normal (après nos corrections)  
**Explication**: Notre validation des produits OFF rejette maintenant les produits non pertinents ou avec des valeurs à 0. C'est le comportement attendu.  
**Action**: Aucune action requise - c'est le comportement souhaité.

## Corrections Appliquées

### ✅ Animated useNativeDriver (Corrigé)
- **Fichier**: `toki-app/lib/animations.ts`
- **Modification**: Toutes les animations utilisent maintenant `useNativeDriver: Platform.OS !== 'web'`
- **Résultat**: Le warning ne devrait plus apparaître sur web

### ✅ NetworkError (Corrigé)
- **Fichier**: `toki-app/app/_layout.tsx`
- **Modification**: Ajout d'un gestionnaire d'erreur global pour capturer les NetworkError non gérés
- **Résultat**: Les erreurs réseau sont maintenant loggées et tracées

### ✅ Parsing des titres avec nombres (Corrigé)
- **Fichier**: `toki-app/lib/sync-repair.ts`
- **Modification**: Amélioration de l'extraction des mots pour ignorer les nombres au début (ex: "5 dates" -> "dates")
- **Résultat**: Les repas avec nombres dans le titre peuvent maintenant être réparés correctement

## Recommandations

1. **Firebase Permissions**: Ajouter une vérification d'authentification avant les appels rate limiting
2. **NetworkError**: Considérer l'ajout d'un retry automatique pour les erreurs réseau temporaires (amélioration future)
3. **Logs**: Réduire le niveau de log pour les warnings normaux (passer de `warn` à `debug`)

## Priorité des Corrections

1. 🔴 **Haute**: Firebase Permissions (affecte le rate limiting)
2. ✅ **Corrigé**: NetworkError (gestion d'erreur globale ajoutée)
3. ✅ **Corrigé**: Animated useNativeDriver (désactivé sur web)
4. ✅ **Corrigé**: Parsing des titres avec nombres (amélioration du matching)
5. 🟢 **Basse**: Réduire verbosité des logs normaux
