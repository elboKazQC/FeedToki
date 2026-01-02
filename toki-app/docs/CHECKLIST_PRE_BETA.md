# Checklist Pré-Bêta - FeedToki

**Date:** 27 janvier 2025  
**Version:** 1.0.52  
**Objectif:** Actions à compléter avant de recruter des bêta-testeurs

---

## ✅ Actions Critiques (OBLIGATOIRES avant bêta)

### 1. Monitoring & Erreurs
- [x] **Configurer le système de logging (Firestore)**
  - [x] Système de logging Firestore déjà en place (`user-logger.ts`)
  - [x] Sentry désactivé - tous les logs centralisés dans Firestore
  - [x] Erreurs globales capturées et envoyées à Firestore
  - [ ] Vérifier que les erreurs sont capturées dans Firestore (tester avec une erreur volontaire)
  - **Temps estimé:** 15 minutes
  - **Priorité:** 🔴 CRITIQUE
  - **Note:** Tous les logs sont maintenant centralisés dans Firestore (collection `user_logs`)

### 2. Tests Multi-Appareils
- [ ] **Tester sur Mobile iOS**
  - [ ] Création de compte
  - [ ] Onboarding
  - [ ] Logging de repas (manuel et IA)
  - [ ] Navigation entre écrans
  - [ ] Synchronisation Firestore
  - **Temps estimé:** 30 minutes

- [ ] **Tester sur Mobile Android**
  - [ ] Création de compte
  - [ ] Onboarding
  - [ ] Logging de repas (manuel et IA)
  - [ ] Navigation entre écrans
  - [ ] Synchronisation Firestore
  - **Temps estimé:** 30 minutes

- [ ] **Tester sur Desktop (Chrome)**
  - [ ] Création de compte
  - [ ] Onboarding
  - [ ] Logging de repas (manuel et IA)
  - [ ] Navigation entre écrans
  - [ ] Synchronisation Firestore
  - **Temps estimé:** 20 minutes

- [ ] **Tester sur Desktop (Safari)**
  - [ ] Création de compte
  - [ ] Onboarding
  - [ ] Logging de repas (manuel et IA)
  - [ ] Navigation entre écrans
  - [ ] Synchronisation Firestore
  - **Temps estimé:** 20 minutes

- [ ] **Tester sur Desktop (Firefox)**
  - [ ] Création de compte
  - [ ] Onboarding
  - [ ] Logging de repas (manuel et IA)
  - [ ] Navigation entre écrans
  - [ ] Synchronisation Firestore
  - **Temps estimé:** 20 minutes

- **Temps total estimé:** 2 heures
- **Priorité:** 🔴 CRITIQUE

---

## ⚠️ Actions Recommandées (FORTEMENT RECOMMANDÉES avant bêta publique)

### 3. Performance
- [ ] **Mesurer Temps de Chargement**
  - [ ] Temps de chargement initial (mobile)
  - [ ] Temps de chargement initial (desktop)
  - [ ] Temps de synchronisation Firestore
  - [ ] Temps de parsing IA
  - [ ] Optimiser si > 3 secondes
  - **Temps estimé:** 2-3 heures
  - **Priorité:** 🟡 IMPORTANT

- [ ] **Tester avec Beaucoup de Données**
  - [ ] Créer 100+ repas
  - [ ] Vérifier performance de l'affichage
  - [ ] Vérifier performance de la recherche
  - [ ] Vérifier performance de la synchronisation
  - **Temps estimé:** 1-2 heures
  - **Priorité:** 🟡 IMPORTANT

### 4. Analytics
- [ ] **Vérifier Firebase Analytics**
  - [ ] Vérifier que les événements sont trackés
  - [ ] Vérifier le dashboard Firebase
  - [ ] Configurer des événements personnalisés si nécessaire
  - **Temps estimé:** 30 minutes
  - **Priorité:** 🟡 IMPORTANT

### 5. Documentation
- [ ] **Vérifier Guide Utilisateur**
  - [ ] Lire le guide complet
  - [ ] Vérifier que toutes les fonctionnalités sont documentées
  - [ ] Corriger les erreurs/omissions
  - **Temps estimé:** 1 heure
  - **Priorité:** 🟡 IMPORTANT

---

## 📝 Actions Optionnelles (Nice to Have)

### 6. Améliorations UX
- [ ] **Ajouter Tooltips**
  - [ ] Identifier les éléments complexes
  - [ ] Ajouter tooltips explicatifs
  - [ ] Tester la clarté
  - **Temps estimé:** 2-3 heures
  - **Priorité:** 🟢 OPTIONNEL

### 7. Fonctionnalités Manquantes
- [ ] **Réactiver Modal Dragon Mort**
  - [ ] Réimplémenter avec logique plus robuste
  - [ ] Tester les cas limites
  - [ ] Déployer
  - **Temps estimé:** 2-3 heures
  - **Priorité:** 🟢 OPTIONNEL

- [ ] **Ajouter Édition Item IA**
  - [ ] Implémenter modal d'édition
  - [ ] Tester avec différents scénarios
  - [ ] Déployer
  - **Temps estimé:** 4-6 heures
  - **Priorité:** 🟢 OPTIONNEL

### 8. Tests
- [ ] **Ajouter Tests E2E**
  - [ ] Setup Detox ou Playwright
  - [ ] Tests des flows critiques
  - [ ] Intégrer dans CI/CD
  - **Temps estimé:** 1-2 jours
  - **Priorité:** 🟢 OPTIONNEL

---

## 📊 Résumé

### Actions Critiques (Avant Bêta)
- **Temps total:** ~2.5 heures
- **Statut:** ⚠️ À compléter

### Actions Recommandées (Avant Bêta Publique)
- **Temps total:** ~4-6 heures
- **Statut:** 📝 Recommandé

### Actions Optionnelles
- **Temps total:** ~2-3 jours
- **Statut:** 💡 Nice to Have

---

## ✅ Validation Finale

Avant de lancer la bêta, vérifier que :

- [ ] Toutes les actions critiques sont complétées
- [ ] Sentry est configuré et fonctionne
- [ ] Tests multi-appareils sont passés
- [ ] Aucun bug critique n'est présent
- [ ] Documentation utilisateur est à jour
- [ ] Monitoring est en place

**Une fois toutes les actions critiques complétées, l'application est prête pour des bêta-testeurs !** 🚀

---

**Dernière mise à jour:** 27 janvier 2025
