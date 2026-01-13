# Guide de Cohérence des Calories - FeedToki

## 🎯 Objectif

Ce guide explique comment FeedToki résout les aliments et calcule les calories, et comment diagnostiquer les divergences entre appareils (mobile vs PC, iOS vs Android vs Web).

## 📋 Pipeline de Résolution d'Aliments

Quand l'utilisateur entre "2 toast au beurre de peanut", voici le flux complet:

### 1. **Parsing de la Description** (`lib/ai-meal-parser.ts`)

Le système essaie 2 modes:
- **Mode OpenAI** (si `EXPO_PUBLIC_OPENAI_API_KEY` est défini)
  - Appel à l'API OpenAI pour extraire nom, quantité, catégorie nutritionnelle
  - Retourne: `{ name: "toast au beurre de peanut", quantityNumber: 2, quantity: "2 toasts", ... }`
  
- **Mode Fallback (règles)** (si pas de clé OpenAI ou si OpenAI échoue)
  - Utilise des patterns regex et mots-clés pour détecter aliments
  - Moins précis que OpenAI, peut manquer des compositions complexes

**🔍 LOG de diagnostic:** 
```
[AI Parser] 🔍 Mode: OpenAI disponible / Fallback (règles)
[AI Parser] 🤖 Tentative avec OpenAI...
[AI Parser] ✅ OpenAI succès: X items
```

### 2. **Résolution Nutritionnelle** (`app/ai-logger.tsx`)

Pour chaque item parsé, le système cherche les données nutritionnelles dans cet ordre:

#### 2.1 **Open Food Facts (OFF)** - Produits de marque
- Recherche dans la base OFF via barcode ou nom
- Cache local: `feedtoki_off_cache_*` (7 jours)
- **Source:** `'off'`
- **Risque divergence:** Cache différent entre appareils

#### 2.2 **Base de données locale (DB)** - Aliments génériques
- Matching fuzzy dans `FOOD_DB` (via `findBestMatch()`)
- Seuil de similarité: 0.7 (ou 0.85 si `isComposite = false`)
- **Source:** `'db'`
- **Exemple:** "toast au beurre de peanut" → `toast_beurre_peanut` (390 kcal)

#### 2.3 **Custom Foods (Global)** - Aliments personnalisés partagés
- Collection Firestore: `globalFoods`
- Cache local: `feedtoki_custom_foods_global_v1`
- **Source:** `'custom'`
- **⚠️ ATTENTION:** Si un custom food a le même ID qu'un item de `FOOD_DB`, il l'écrase!

#### 2.4 **Estimation IA** - Aucun match trouvé
- Création d'un `FoodItem` estimé avec valeurs par défaut
- **Source:** `'estimated'`
- Moins fiable, à éviter pour précision

**🔍 LOG de diagnostic:**
```
[AI Logger] ✅ Item résolu: {
  input: "toast au beurre de peanut",
  matched: "Toast au beurre de peanut",
  foodId: "toast_beurre_peanut",
  source: "db",
  baseCalories: 390,
  multiplier: 2,
  finalCalories: 780,
  ...
}
```

### 3. **Calcul de la Portion** (`lib/portions.ts`)

Le système convertit la quantité en multiplier:
- **Exemple:** "2 toasts" → `quantityNumber = 2` → `multiplier = 2`
- **Formule:** `caloriesFinales = baseCalories × multiplier`
- Pour "2 toast au beurre de peanut": `390 × 2 = 780 kcal`

## 🐛 Causes de Divergences (700 vs 390 kcal)

### Cause 1: **Mode de Parsing Différent**
- **Symptôme:** PC utilise OpenAI, mobile utilise fallback (ou vice-versa)
- **Détection:** Vérifier les logs `[AI Parser] Mode: ...`
- **Solution:** S'assurer que `EXPO_PUBLIC_OPENAI_API_KEY` est définie partout (ou nulle part)

### Cause 2: **Cache OFF Différent**
- **Symptôme:** Un appareil a un produit OFF en cache, l'autre utilise la DB locale
- **Source différente:** `'off'` vs `'db'`
- **Détection:** Badge "🌐 Open Food Facts" vs "📊 Base de données" dans l'UI
- **Solution:** Vider le cache AsyncStorage: 
  ```typescript
  AsyncStorage.removeItem('feedtoki_off_cache_*')
  ```

### Cause 3: **Custom Food Override**
- **Symptôme:** Un appareil a un custom food `toast_beurre_peanut` différent en cache/Firestore
- **Détection:** Badge "👤 Personnalisé" + warning dans logs:
  ```
  [Custom Foods] ⚠️⚠️⚠️ ATTENTION: L'ID "toast_beurre_peanut" existe déjà dans la base de données de base!
  ```
- **Solution:** 
  - Utiliser un ID unique pour les custom foods (ex: `toast_beurre_peanut_custom_1234567890`)
  - Ou supprimer le custom food de `globalFoods` dans Firestore

### Cause 4: **Web Cache Stale (PC seulement)**
- **Symptôme:** PC web montre des résultats différents qu'après refresh
- **Détection:** Version de bundle différente
- **Solution:** Cache-busting:
  - Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
  - Supprimer `localStorage` / service worker cache
  - Rebuild: `npm run web` ou `expo export:web`

### Cause 5: **Matching Fuzzy Différent**
- **Symptôme:** Le nom parsé est légèrement différent, donc match différent
- **Exemple:** "toast beurre peanut" (sans "au") → peut matcher un autre item
- **Détection:** Logs `[AI Logger] input` vs `matched`
- **Solution:** Améliorer le parsing pour extraire le nom exact, ou ajuster le seuil de matching

### Cause 6: **Synchronisation Custom Foods Incomplète**
- **Symptôme:** Un appareil n'a pas encore chargé les custom foods de Firestore
- **Détection:** Logs `[Custom Foods] Chargés depuis Firestore: X aliments`
- **Solution:** Forcer un refresh (fermer/rouvrir l'app, ou appel manuel à `loadCustomFoods()`)

## 🔧 Outils de Diagnostic

### 1. **Badge Source dans l'UI**
Chaque item affiché montre maintenant sa source:
- **📊 Base de données** → `source: 'db'` → Fiable, identique partout
- **🌐 Open Food Facts** → `source: 'off'` → Peut varier (cache)
- **⚠️ Estimation IA** → `source: 'estimated'` → Peu fiable
- **👤 Personnalisé** → `source: 'custom'` → Risque d'override

### 2. **Logs Détaillés**
Dans les logs console/Flipper:
```
[AI Parser] 🔍 Mode: OpenAI disponible
[AI Parser] 🤖 Tentative avec OpenAI...
[AI Parser] ✅ OpenAI succès: 1 items
[AI Logger] ✅ Item résolu: { input: ..., matched: ..., source: "db", baseCalories: 390, finalCalories: 780 }
```

### 3. **Test Automatisé**
Le test de régression `__tests__/ai-meal-parser.test.ts`:
```typescript
describe('Regression: 2 toast au beurre de peanut', () => {
  it('should parse correctly and match to DB item', async () => {
    // Vérifie: parsing → matching → portion × 2 → 780 kcal
  });
});
```

## ✅ Checklist de Vérification

Pour diagnostiquer un écart de calories entre appareils:

1. **Reproduire sur les deux appareils** avec exactement le même texte
2. **Vérifier les logs** pour identifier:
   - [ ] Mode de parsing (OpenAI vs fallback)
   - [ ] Source de l'item (`db` vs `off` vs `custom` vs `estimated`)
   - [ ] Multiplier appliqué
   - [ ] Calories de base vs finales
3. **Vérifier les badges UI** pour chaque item
4. **Comparer les caches:**
   - [ ] AsyncStorage (`feedtoki_off_cache_*`, `feedtoki_custom_foods_global_v1`)
   - [ ] Firestore `globalFoods` collection
5. **Vérifier les variables d'environnement:**
   - [ ] `EXPO_PUBLIC_OPENAI_API_KEY` définie partout ou nulle part
6. **Test rapide:** Supprimer tous les caches et réessayer

## 🎯 Best Practices

1. **Éviter les overrides custom foods:**
   - Ne jamais réutiliser un ID de `FOOD_DB` pour un custom food
   - Utiliser un suffixe unique: `${originalId}_custom_${timestamp}`

2. **Assurer la cohérence du parser:**
   - Si OpenAI est utilisé, le déployer sur tous les environnements (mobile + web)
   - Ou utiliser uniquement le fallback partout (commenter la clé)

3. **Monitorer les sources:**
   - Encourager les utilisateurs à vérifier le badge de source
   - Logger les items avec `source: 'estimated'` pour améliorer la DB

4. **Tester régulièrement:**
   - Lancer les tests: `npm test`
   - Tester manuellement "2 toast au beurre de peanut" sur mobile et web

## 📚 Références

- **Parsing:** `lib/ai-meal-parser.ts`
- **Résolution:** `app/ai-logger.tsx` (lignes ~320-480)
- **Matching:** `lib/food-matcher.ts`
- **Custom Foods:** `lib/custom-foods.ts`
- **Base de données:** `lib/food-db.ts` (ligne 147: `toast_beurre_peanut`)
- **Tests:** `__tests__/ai-meal-parser.test.ts`

---

**Dernière mise à jour:** 2026-01-08
**Contributeurs:** FeedToki Dev Team
