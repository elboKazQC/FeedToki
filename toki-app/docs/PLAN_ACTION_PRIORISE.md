# Plan d'Action Priorisé - FeedToki

**Date:** 27 janvier 2025  
**Version:** 1.0.52  
**Objectif:** Roadmap des corrections et améliorations avec estimations de temps

---

## 🎯 Vue d'Ensemble

Ce plan d'action est organisé en 3 phases selon la criticité et l'impact sur l'expérience bêta-testeurs.

**Timeline Recommandée:**
- **Phase 1:** Avant lancement bêta (1-2 heures)
- **Phase 2:** Semaine 1-2 de bêta (1-2 jours)
- **Phase 3:** Mois 1-2 de bêta (1-2 semaines)

---

## 🔴 Phase 1: Actions Immédiates (Avant Bêta)

**Objectif:** Actions critiques à compléter avant de recruter des bêta-testeurs  
**Temps total:** 1-2 heures  
**Priorité:** CRITIQUE

### 1.1 Configurer Sentry DSN
**Impact:** Monitoring des erreurs en production  
**Effort:** 15 minutes  
**Dépendances:** Aucune

**Actions:**
1. Créer un compte Sentry (si pas déjà fait)
2. Créer un projet pour FeedToki
3. Copier le DSN
4. Ajouter `EXPO_PUBLIC_SENTRY_DSN` dans `.env.production`
5. Vérifier que les erreurs sont capturées (tester avec une erreur volontaire)

**Fichiers à modifier:**
- `.env.production` (ajouter variable)

**Critères de succès:**
- ✅ Sentry capture les erreurs en production
- ✅ Dashboard Sentry accessible

---

### 1.2 Tester sur Plusieurs Appareils
**Impact:** Validation de l'UX sur différentes plateformes  
**Effort:** 1-2 heures  
**Dépendances:** Aucune

**Actions:**
1. Tester sur mobile iOS (iPhone)
2. Tester sur mobile Android
3. Tester sur desktop (Chrome, Safari, Firefox)
4. Documenter les problèmes trouvés
5. Corriger les bugs critiques trouvés

**Tests à effectuer:**
- Création de compte
- Onboarding
- Logging de repas (manuel et IA)
- Navigation entre écrans
- Synchronisation Firestore

**Critères de succès:**
- ✅ Application fonctionne sur tous les appareils testés
- ✅ Aucun bug critique trouvé
- ✅ UX cohérente sur toutes les plateformes

---

## 🟡 Phase 2: Améliorations Court Terme (Semaine 1-2)

**Objectif:** Améliorer l'expérience utilisateur et corriger les bugs non-critiques  
**Temps total:** 1-2 jours  
**Priorité:** IMPORTANT

### 2.1 Réactiver Modal Dragon Mort
**Impact:** Fonctionnalité de gamification manquante  
**Effort:** 2-3 heures  
**Dépendances:** Aucune

**Actions:**
1. Analyser pourquoi le modal a été désactivé
2. Réimplémenter avec logique plus robuste
3. Tester les cas limites
4. Déployer

**Fichiers à modifier:**
- `app/(tabs)/index.tsx` (ligne 2283)

**Critères de succès:**
- ✅ Modal s'affiche correctement quand le dragon "meurt"
- ✅ Aucun bug de navigation
- ✅ UX fluide

---

### 2.2 Ajouter Tooltips
**Impact:** Clarté pour les utilisateurs sur les fonctionnalités complexes  
**Effort:** 2-3 heures  
**Dépendances:** Aucune

**Actions:**
1. Identifier les éléments complexes nécessitant des tooltips
2. Créer les textes explicatifs
3. Implémenter les tooltips (composant réutilisable)
4. Ajouter les tooltips aux éléments identifiés
5. Tester la clarté

**Éléments à considérer:**
- Système de points
- Calcul du streak
- Évolution du dragon
- Recommandations intelligentes

**Critères de succès:**
- ✅ Tooltips présents sur les éléments complexes
- ✅ Textes clairs et en français
- ✅ UX améliorée

---

### 2.3 Mesurer et Optimiser Performance
**Impact:** Temps de chargement et réactivité de l'application  
**Effort:** 2-3 heures  
**Dépendances:** Aucune

**Actions:**
1. Mesurer le temps de chargement initial (mobile et desktop)
2. Mesurer le temps de synchronisation Firestore
3. Mesurer le temps de parsing IA
4. Identifier les goulots d'étranglement
5. Optimiser si nécessaire

**Outils recommandés:**
- Chrome DevTools (Performance tab)
- React DevTools Profiler
- Firebase Performance Monitoring

**Critères de succès:**
- ✅ Temps de chargement < 3 secondes
- ✅ Synchronisation < 2 secondes
- ✅ Parsing IA < 5 secondes

---

## 🟢 Phase 3: Améliorations Moyen Terme (Mois 1-2)

**Objectif:** Ajouter des fonctionnalités manquantes et améliorer la qualité  
**Temps total:** 1-2 semaines  
**Priorité:** OPTIONNEL

### 3.1 Ajouter Édition Item IA
**Impact:** Permettre aux utilisateurs d'éditer les items après analyse IA  
**Effort:** 4-6 heures  
**Dépendances:** Aucune

**Actions:**
1. Créer un modal d'édition
2. Permettre l'édition du nom, quantité, et matching
3. Permettre la réanalyse d'un item
4. Tester avec différents scénarios
5. Déployer

**Fichiers à modifier:**
- `app/ai-logger.tsx` (ligne 650)

**Critères de succès:**
- ✅ Modal d'édition fonctionnel
- ✅ Utilisateur peut modifier tous les champs pertinents
- ✅ Réanalyse fonctionne correctement

---

### 3.2 Ajouter Plus de Tests E2E
**Impact:** Confiance accrue dans les flows critiques  
**Effort:** 1-2 jours  
**Dépendances:** Aucune

**Actions:**
1. Choisir un framework (Detox pour mobile, Playwright pour web)
2. Setup le framework
3. Écrire les tests pour les flows critiques:
   - Création de compte
   - Onboarding
   - Logging de repas
   - Synchronisation
4. Intégrer dans CI/CD
5. Maintenir les tests

**Flows critiques à tester:**
- Authentification complète
- Onboarding
- Logging manuel
- Logging IA
- Synchronisation multi-appareils

**Critères de succès:**
- ✅ Tests E2E passent
- ✅ Tests intégrés dans CI/CD
- ✅ Couverture des flows critiques

---

## 📊 Résumé des Estimations

| Phase | Actions | Temps Total | Priorité |
|-------|---------|-------------|----------|
| Phase 1 | 2 actions | 1-2 heures | 🔴 CRITIQUE |
| Phase 2 | 3 actions | 1-2 jours | 🟡 IMPORTANT |
| Phase 3 | 2 actions | 1-2 semaines | 🟢 OPTIONNEL |

---

## 🔄 Dépendances entre Actions

```
Phase 1 (Avant Bêta)
├── 1.1 Configurer Sentry DSN
└── 1.2 Tester sur Plusieurs Appareils

Phase 2 (Semaine 1-2)
├── 2.1 Réactiver Modal Dragon Mort
├── 2.2 Ajouter Tooltips
└── 2.3 Mesurer Performance

Phase 3 (Mois 1-2)
├── 3.1 Ajouter Édition Item IA
└── 3.2 Ajouter Tests E2E
```

**Note:** Aucune dépendance critique entre les actions. Chaque action peut être complétée indépendamment.

---

## ✅ Critères de Succès Global

L'application sera considérée prête pour bêta-testeurs lorsque:

- [x] Toutes les actions de Phase 1 sont complétées
- [ ] Score de maturité ≥ 80/100 (actuellement 78/100)
- [ ] Aucun bug critique présent
- [ ] Monitoring configuré et fonctionnel
- [ ] Tests multi-appareils passés

---

## 📅 Timeline Recommandée

### Semaine 1 (Avant Bêta)
- **Jour 1:** Compléter Phase 1 (1-2 heures)
- **Jour 2-3:** Recruter premiers bêta-testeurs (5-10 utilisateurs)
- **Jour 4-5:** Collecter feedback initial

### Semaine 2-3 (Pendant Bêta)
- **Semaine 2:** Compléter Phase 2 (1-2 jours)
- **Semaine 3:** Analyser feedback et corriger bugs

### Mois 2 (Après Bêta Initiale)
- **Semaine 4-6:** Compléter Phase 3 (1-2 semaines)
- **Semaine 7-8:** Préparer lancement public

---

**Dernière mise à jour:** 27 janvier 2025
