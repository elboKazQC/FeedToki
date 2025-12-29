# Analyse de la Logique des Points

## 📊 Système Actuel

### Règle Principale
Les points représentent le "coût" d'un aliment en termes d'indulgence/cheat meals. **Moins de points = meilleur pour tes objectifs nutritionnels**.

### Logique de Calcul (`computeFoodPoints`)

1. **Coût explicite** : Si un aliment a `points: X` défini explicitement → utilise cette valeur
2. **Protéines maigres & Légumes** : **GRATUITS (0 points)** - aident à atteindre les objectifs
3. **Base de calcul** : Calories / 100 (100 cal ≈ 1 point)
4. **Multiplicateurs** :
   - `ultra_transforme` : ×1.5 (+50%)
   - `gras_frit` : ×1.3 (+30%)
   - `sucre` (si >100 cal) : ×1.2 (+20%)
   - `grain_complet` : ×0.8 (-20%)

## ✅ Corrections Effectuées

### Shakes Protéinés
**Avant** : Shakes aromatisés (chocolat, vanille, fruits) coûtaient 1 point
**Après** : Tous les shakes protéinés sont maintenant **GRATUITS (0 points)**

**Raison** : Ce sont essentiellement des protéines maigres qui aident à atteindre les objectifs protéinés. Le tag `sucre` était juste pour la saveur, pas pour pénaliser.

### Cigares au Chou & Dolma
**Avant** : Coûtaient 1 point malgré `proteine_maigre + legume`
**Après** : **GRATUITS (0 points)**

**Raison** : Combinaison protéine maigre + légume = aliment optimal pour la santé.

## 📈 Exemples de Coûts

### Gratuits (0 points)
- Poulet, dinde, poisson, oeufs
- Tous les légumes
- Tous les shakes protéinés (y compris aromatisés)
- Yaourt grec nature
- Cigares au chou, dolma

### 1-2 points
- Yaourt normal : 1 point (un peu plus de sucre)
- Toast au beurre de peanut : 2 points (féculents + gras)

### 3-5 points
- Bière : 3-4 points
- Chips : 2-3 points
- Croissant : 4 points

### 5-7 points (Vrais cheats)
- Frites : 5 points
- Pizza : 4-5 points
- Burger : 7 points
- Poutine : ~6-8 points

## 🎯 Objectif du Système

Le système est **défensif** (agressif) mais **logique** :
- Récompense les aliments qui aident tes objectifs (protéines, légumes)
- Pénalise les aliments transformés/sucrés/gras
- Permet d'accumuler des points pour des "vrais" cheats (poutine, burger, etc.)

## 💡 Recommandation

Avec 6 points/jour et un shake protéiné maintenant gratuit :
- Si tu manges sainement (protéines maigres + légumes) : 0-2 points/jour
- Tu peux accumuler 4-6 points/jour pour des cheats
- En 2-3 jours, tu peux te permettre une poutine (6-8 points) !

## ❓ Points à Vérifier

1. **Chocolat** : Pas d'entrée dans la base actuelle. Si c'est du chocolat noir à >70% cacao en petite quantité, devrait coûter 0-1 point selon la quantité.

2. **Yaourt normal vs Yaourt grec** : Différence logique (yaourt normal a plus de sucre).

3. **Fromage** : 2 points (plus de gras que les autres protéines maigres) - logique.

