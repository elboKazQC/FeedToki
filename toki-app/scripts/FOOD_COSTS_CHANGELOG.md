# 📝 Changelog — Ajustements Coûts Alimentaires

**Date:** 26 décembre 2025  
**Basé sur:** Résultats simulateur système points

---

## 🎯 Objectif

Rendre les coûts alimentaires cohérents avec la cible de **~80 kcal par point** en moyenne, tout en:
- Gardant les protéines maigres gratuites (design intentionnel)
- Rendant les féculents plus coûteux (trop avantageux avant)
- Réduisant le coût des cheats (trop pénalisés avant)

---

## ✅ Changements Appliqués

### 1. Féculents (Augmentation)

**Problème:** 200-270 kcal pour seulement 1 point (trop avantageux)

| Item | Avant | Après | Calories | Cal/Point (avant) | Cal/Point (après) |
|------|-------|-------|----------|-------------------|-------------------|
| Riz | 1 pt | **2 pts** | 200 | 200 | 100 ✅ |
| Pâtes | 1 pt | **2 pts** | 210 | 210 | 105 ✅ |
| Patate | 1 pt | **2 pts** | 160 | 160 | 80 ✅ |
| Quinoa | 1 pt | **2 pts** | 220 | 220 | 110 ✅ |
| Riz brun | 1 pt | **2 pts** | 215 | 215 | 108 ✅ |
| Orge | 1 pt | **3 pts** | 270 | 270 | 90 ✅ |

**Rationale:**
- Cible ~80-100 cal/point pour féculents simples
- Orge plus calorique → 3 points
- Reste accessible mais plus réaliste

### 2. Cheats (Réduction)

**Problème:** 40-70 kcal par point (trop pénalisés, pas assez "worth it")

| Item | Avant | Après | Calories | Cal/Point (avant) | Cal/Point (après) |
|------|-------|-------|----------|-------------------|-------------------|
| Pizza | 6 pts | **4 pts** | 285 | 48 | 71 ✅ |
| Beigne | 6 pts | **4 pts** | 300 | 50 | 75 ✅ |
| Chips | 4 pts | **2 pts** | 160 | 40 | 80 ✅ |
| Ailes de poulet | 6 pts | **5 pts** | 450 | 75 | 90 ✅ |
| Nachos | 7 pts | **6 pts** | 520 | 74 | 87 ✅ |

**Rationale:**
- Cible ~70-90 cal/point pour cheats
- Rend les indulgences plus "worth it" sans les rendre gratuits
- Encourage la gestion consciente du budget

### 3. Items Inchangés (Intentionnel)

#### Protéines Maigres (Gratuites) ✅
| Item | Points | Calories | Note |
|------|--------|----------|------|
| Poulet | 0 | 165 | ✅ Design intentionnel |
| Dinde | 0 | 160 | ✅ Encourage consommation |
| Poisson | 0 | 160 | ✅ Santé cardiovasculaire |
| Oeufs | 0 | 155 | ✅ Versatile, nutritif |
| Tofu | 0 | 180 | ✅ Option végé |

**Rationale:** Protéines maigres = pilier nutrition saine, doivent rester gratuits.

#### Légumes & Fruits (Gratuits) ✅
Tous les légumes et fruits restent **0 points** pour encourager consommation.

#### Indulgences Lourdes (Maintenues) ✅
| Item | Points | Calories | Cal/Point |
|------|--------|----------|-----------|
| Poutine | 8 | 740 | 93 |
| Poutine complète | 10 | 900 | 90 |
| Burger | 7 | 550 | 79 |

Ces items restent chers car très caloriques et peu nutritifs.

---

## ⚠️ Ajustements Recommandés (Phase 2)

### Boissons Énergétiques (Actuellement Trop Chères)

| Item | Actuel | Recommandé | Calories | Justification |
|------|--------|------------|----------|---------------|
| Monster Original | 5 pts | **4 pts** | 210 | Ratio actuel: 42 cal/pt (trop cher) |
| Red Bull Original | 3 pts | **2 pts** | 110 | Ratio actuel: 37 cal/pt (trop cher) |

**Impact:** Rendre les boissons énergétiques plus accessibles sans les encourager excessivement.

### Creton

| Item | Actuel | Recommandé | Calories | Justification |
|------|--------|------------|----------|---------------|
| Creton | 4 pts | **3 pts** | 150 | Ratio actuel: 38 cal/pt (légèrement trop cher pour un déjeuner typique québécois) |

---

## 📊 Impact Simulateur

### Avant Ajustements
- Calories/jour: **940 kcal** (trop bas)
- Perte poids: **11.3 kg en 8 sem** (excessif)
- Problème: Féculents trop cheap → users mangent trop peu

### Après Ajustements
- Calories/jour: **1400 kcal** (réaliste)
- Perte poids: **12 kg en 12 sem** (proche attendu: 10.9 kg)
- Amélioration: +46% calories, perte prévisible ✅

---

## 🎯 Principes de Coûts (Pour Futurs Items)

### Formule de Base
```typescript
base_cost = calories_kcal / 80

// Ajustements selon tags:
if (proteine_maigre || legume) → 0 pt
if (ultra_transforme) → base_cost × 1.5
if (gras_frit) → base_cost × 1.3
if (sucre && calories > 100) → base_cost × 1.2
if (grain_complet) → base_cost × 0.8

points = Math.max(0, Math.round(base_cost))
```

### Cibles Cal/Point par Catégorie

| Catégorie | Cible Cal/Point | Exemples |
|-----------|-----------------|----------|
| Protéines maigres | ∞ (gratuit) | Poulet, poisson, tofu |
| Légumes/Fruits | ∞ (gratuit) | Brocoli, pommes, carottes |
| Féculents sains | 80-110 | Riz, pâtes, quinoa |
| Produits laitiers | 60-120 | Yogourt, fromage |
| Cheats légers | 70-90 | Pizza, chips, ailes |
| Cheats lourds | 80-100 | Poutine, burger, nachos |
| Boissons sucrées | 40-60 | Soda, jus, energy drinks |

---

## ✅ Validation

**Status:** Coûts validés par simulateur (12-16 semaines, 4 profils)  
**Précision:** Perte poids observée = attendu ±10-16%  
**Prochain Test:** Bêta interne avec utilisateurs réels (4 semaines)

---

**Fichiers Modifiés:**
- `lib/food-db.ts` — Coûts explicites ajustés
- `scripts/simulate-utils.ts` — Générateur amélioré

**Commande Test:**
```bash
npm run simulate -- --weeks 12
```
