# 🎯 Plan de Match - FeedToki

**Date:** 26 décembre 2025  
**Version actuelle:** 0.9 (Prototype)  
**Objectif:** Préparer la v1.0 pour production

---

## 📊 État Actuel

### ✅ Ce qui fonctionne
- **Firebase activé** : Auth + Firestore configurés et opérationnels
- **Onboarding** : Écran complet avec calcul TDEE et points dynamiques
- **Système de points** : Calculateur dynamique implémenté (`lib/points-calculator.ts`)
- **Base de données alimentaire** : 100+ items avec coûts ajustés
- **Logging repas** : Interface fonctionnelle (manuel)
- **Recommandations intelligentes** : Système basique en place
- **Poids & graphique** : Suivi du poids avec visualisation
- **Déploiement web** : PWA déployée sur Firebase Hosting

### ⚠️ À améliorer/Compléter
- **Sprites dragon** : 12 niveaux codés mais visuels manquants
- **IA meal parser** : Module basique (règles simples), pas d'intégration OpenAI
- **Validation données** : Partiellement implémentée
- **Tests** : Aucun test automatisé
- **Analytics** : Pas d'analytics/crash reporting

---

## 🎯 Priorités Immédiates (Prochaines 2-4 semaines)

### PRIORITÉ 1 : Finaliser l'Expérience Utilisateur Core ⭐⭐⭐

#### 1.1 Sprites Dragon (1-2 semaines)
**Impact:** Élevé - Gamification visuelle essentielle  
**Effort:** Moyen

**Actions:**
- [ ] Générer/créer 12 sprites dragon (512×512px PNG transparent)
  - Option A: Midjourney/DALL-E prompts (gratuit mais variable)
  - Option B: Fiverr illustrateur (~$50-100)
  - Option C: Stable Diffusion local (gratuit, qualité variable)
- [ ] Créer composant `components/dragon-display.tsx` avec animations
- [ ] Intégrer dans HomeScreen avec transitions entre niveaux
- [ ] Tester progression visuelle (0→12)

**Fichiers à créer/modifier:**
- `assets/images/dragon/level-{1..12}.png`
- `components/dragon-display.tsx` (nouveau)
- `app/(tabs)/index.tsx` (intégration)

#### 1.2 Améliorer IA Meal Parser (1 semaine)
**Impact:** Moyen-Élevé - Feature différenciante  
**Effort:** Moyen

**Actions:**
- [ ] Évaluer qualité actuelle du parser (`lib/ai-meal-parser.ts`)
- [ ] Améliorer règles de détection (plats composés, quantités)
- [ ] Ajouter fuzzy matching plus robuste (`lib/food-matcher.ts`)
- [ ] Tester avec cas réels (ex: "2 toasts au beurre de peanut")
- [ ] Optionnel: Intégrer OpenAI API (Phase 3)

**Fichiers à modifier:**
- `lib/ai-meal-parser.ts`
- `lib/food-matcher.ts`
- `app/ai-logger.tsx` (si existe)

#### 1.3 Validation & Robustesse (3-5 jours)
**Impact:** Moyen - Évite bugs utilisateur  
**Effort:** Faible

**Actions:**
- [ ] Valider tous les inputs utilisateur (poids, targets, portions)
- [ ] Ajouter messages d'erreur clairs en français
- [ ] Gérer cas limites (poids négatif, calories > 10000, etc.)
- [ ] Tester edge cases (données corrompues, AsyncStorage vide)

**Fichiers à vérifier:**
- `app/onboarding.tsx` ✅ (déjà validé)
- `app/(tabs)/index.tsx` ✅ (déjà validé)
- `lib/portions.ts` (vérifier validation portions)

---

### PRIORITÉ 2 : Préparation Production ⭐⭐

#### 2.1 Tests Critiques (1 semaine)
**Impact:** Élevé - Qualité avant release  
**Effort:** Moyen

**Actions:**
- [ ] Setup Jest + React Native Testing Library
- [ ] Tests unitaires pour:
  - `lib/points-calculator.ts` (calcul points/jour)
  - `lib/stats.ts` (streaks, scores)
  - `lib/nutrition.ts` (calculs macros)
- [ ] Tests d'intégration pour:
  - Flow onboarding complet
  - Logging repas → calcul points
  - Synchronisation Firebase

**Fichiers à créer:**
- `__tests__/points-calculator.test.ts`
- `__tests__/stats.test.ts`
- `jest.config.js`

#### 2.2 Analytics & Monitoring (3-5 jours)
**Impact:** Moyen - Insights utilisateurs  
**Effort:** Faible-Moyen

**Actions:**
- [ ] Installer Sentry pour crash reporting
- [ ] Installer Mixpanel (ou Firebase Analytics) pour événements
- [ ] Tracker événements clés:
  - `meal_logged`, `dragon_evolved`, `streak_milestone`
  - `onboarding_completed`, `target_updated`
- [ ] Dashboard Firebase Analytics

**Commandes:**
```bash
npm install @sentry/react-native
npm install mixpanel-react-native  # ou utiliser Firebase Analytics
```

#### 2.3 Documentation Utilisateur (2-3 jours)
**Impact:** Faible-Moyen - Support utilisateurs  
**Effort:** Faible

**Actions:**
- [ ] Finaliser `docs/user-guide.md` (déjà commencé)
- [ ] Ajouter FAQ dans l'app (écran Help/FAQ)
- [ ] Créer vidéo tutoriel (optionnel)
- [ ] Préparer Privacy Policy & Terms of Service (Phase 3)

---

### PRIORITÉ 3 : Features Avancées (Post-v1.0) ⭐

#### 3.1 IA Premium avec OpenAI (2-3 semaines)
**Impact:** Élevé - Monétisation  
**Effort:** Élevé

**Actions:**
- [ ] Intégrer OpenAI GPT-4 API dans `lib/ai-meal-parser.ts`
- [ ] Setup Stripe pour paiements
- [ ] Créer écran Premium/Paywall
- [ ] Modèle freemium (gratuit = manuel, premium = IA illimitée)

**Fichiers à créer/modifier:**
- `lib/ai-meal-parser.ts` (intégration OpenAI)
- `app/premium.tsx` (nouveau)
- `lib/purchases.ts` (nouveau, gestion abonnements)

#### 3.2 Scan Codes-Barres (Optionnel)
**Impact:** Moyen - Convenience  
**Effort:** Moyen

**Actions:**
- [ ] Installer `expo-barcode-scanner`
- [ ] Intégrer Open Food Facts API
- [ ] UI scan + fallback manuel

---

## 📅 Timeline Recommandée

### Semaine 1-2 : Sprites Dragon + Améliorations IA
- **Jours 1-3:** Générer/créer sprites dragon
- **Jours 4-5:** Composant dragon-display + intégration
- **Jours 6-7:** Améliorer parser IA + tests manuels
- **Jours 8-10:** Validation & robustesse
- **Jours 11-14:** Tests critiques + corrections

### Semaine 3 : Analytics + Documentation
- **Jours 1-3:** Setup Sentry + Analytics
- **Jours 4-5:** Documentation utilisateur
- **Jours 6-7:** Tests finaux + polish UI

### Semaine 4 : Préparation Release
- **Jours 1-2:** Build production (EAS Build)
- **Jours 3-4:** Tests sur TestFlight/Play Store (beta)
- **Jours 5-7:** Corrections bugs critiques + release v1.0

---

## 🎯 Objectifs v1.0 (MVP Production)

### Critères de Succès
- ✅ Onboarding complet et fonctionnel
- ✅ Système de points cohérent et testé
- ✅ Dragon visuel avec 12 niveaux
- ✅ IA meal parser amélioré (au moins règles robustes)
- ✅ Firebase Auth + Firestore opérationnel
- ✅ Validation inputs complète
- ✅ Tests critiques passés
- ✅ Analytics basique en place
- ✅ Déploiement web fonctionnel
- ✅ Documentation utilisateur complète

### Non-inclus dans v1.0 (Post-release)
- ❌ IA OpenAI (Phase 3)
- ❌ Stripe/Paiements (Phase 3)
- ❌ Scan codes-barres (Phase 4)
- ❌ Tests E2E automatisés (post-v1.0)

---

## 🔧 Actions Immédiates (Cette Semaine)

### À faire MAINTENANT:
1. **Décider méthode sprites dragon** (Midjourney/Fiverr/Stable Diffusion)
2. **Tester parser IA actuel** avec cas réels
3. **Lister tous les edge cases** à valider
4. **Setup Jest** pour commencer tests

### Commandes utiles:
```bash
# Tester l'app localement
cd toki-app
npx expo start

# Build web pour déploiement
npx expo export:web
firebase deploy --only hosting

# Lancer simulateur points (validation)
npm run simulate
```

---

## 📊 Métriques de Succès

### Avant v1.0
- [ ] 0 crash critique non géré
- [ ] 100% des inputs validés
- [ ] Tests unitaires > 80% coverage (lib/)
- [ ] Dragon affiche correctement niveaux 0-12
- [ ] Parser IA détecte > 80% des repas simples

### Post-v1.0 (Premier mois)
- [ ] 0 crash non géré (Sentry)
- [ ] Taux de complétion onboarding > 70%
- [ ] Taux de rétention jour 7 > 40%
- [ ] Feedback utilisateurs positif (> 4/5)

---

## 🚨 Risques & Mitigation

### Risque 1: Sprites dragon de mauvaise qualité
**Mitigation:** Tester plusieurs méthodes, avoir backup (Fiverr)

### Risque 2: Parser IA insuffisant
**Mitigation:** Améliorer règles progressivement, garder fallback manuel

### Risque 3: Bugs en production
**Mitigation:** Tests critiques + Sentry + beta TestFlight avant release

### Risque 4: Performance Firebase
**Mitigation:** Optimiser requêtes Firestore, cache local

---

## 💡 Notes & Décisions

- **Firebase activé:** Bon pour persistance multi-devices
- **Onboarding complet:** Points dynamiques fonctionnent
- **Base alimentaire:** 100+ items, coûts ajustés récemment
- **Web déployé:** PWA accessible, bon pour tests

**Prochaine décision importante:** Méthode génération sprites dragon

---

**Dernière mise à jour:** 26 décembre 2025  
**Prochaine revue:** Après complétion sprites dragon

