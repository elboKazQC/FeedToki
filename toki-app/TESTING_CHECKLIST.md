# Checklist de Test - FeedToki v1.0.0

## Flows Critiques à Tester

### 1. Authentification & Onboarding

- [ ] **Création de compte**
  - Créer un nouveau compte avec email/mot de passe
  - Vérifier que le profil est créé dans Firestore
  - Vérifier la redirection vers onboarding

- [ ] **Connexion**
  - Se connecter avec un compte existant
  - Vérifier que le profil est chargé correctement
  - Vérifier la redirection vers l'écran principal si onboarding complété

- [ ] **Onboarding**
  - Sélectionner un objectif de poids
  - Entrer poids et niveau d'activité
  - Vérifier que les points/jour sont calculés correctement
  - Vérifier que le profil est sauvegardé dans Firestore

### 2. Logging de Repas

- [ ] **Log manuel**
  - Rechercher un aliment dans la base
  - Sélectionner un aliment et ajuster la portion
  - Vérifier que les points sont déduits correctement
  - Vérifier que le repas apparaît dans l'historique

- [ ] **Log avec IA**
  - Entrer une description de repas (ex: "steak et riz")
  - Vérifier que l'IA détecte les aliments correctement
  - Vérifier que les valeurs nutritionnelles sont affichées
  - Confirmer et vérifier que le repas est enregistré

- [ ] **Réanalyser un item (reroll)**
  - Après analyse IA, cliquer sur "Réanalyser" pour un item
  - Spécifier le problème (match incorrect / valeurs nutritionnelles / les deux)
  - Vérifier que la nouvelle analyse est appliquée

### 3. Système de Points

- [ ] **Points quotidiens**
  - Vérifier que les points quotidiens correspondent à l'objectif
  - Vérifier que le cap maximum est respecté
  - Vérifier que les points se réinitialisent chaque jour

- [ ] **Déduction de points**
  - Ajouter un repas avec des points
  - Vérifier que les points sont déduits immédiatement
  - Vérifier que le budget restant est mis à jour

- [ ] **Cap maximum**
  - Ajouter plusieurs repas pour atteindre le cap
  - Vérifier que les points ne peuvent pas dépasser le cap

### 4. Statistiques & Streaks

- [ ] **Streak**
  - Vérifier que le streak est calculé correctement
  - Logger des repas sur plusieurs jours consécutifs
  - Vérifier que le streak augmente
  - Manquer un jour et vérifier que le streak se réinitialise

- [ ] **Calendrier streak (Duolingo-style)**
  - Vérifier que les jours complets sont affichés en vert
  - Vérifier que les jours incomplets sont différenciés
  - Vérifier que le streak actuel est affiché

- [ ] **Évolution du dragon**
  - Vérifier que le dragon évolue tous les 30 jours de streak
  - Vérifier que l'animation de niveau s'affiche
  - Vérifier que le niveau maximum est 12

### 5. Navigation

- [ ] **Navigation entre écrans**
  - Naviguer entre Home, Stats, Paramètres
  - Vérifier que le bouton retour fonctionne correctement
  - Vérifier que la navigation après login fonctionne

- [ ] **Pages légales**
  - Accéder à la Politique de Confidentialité
  - Accéder aux Conditions d'Utilisation
  - Vérifier que le contenu s'affiche correctement

### 6. Gestion des Données

- [ ] **Synchronisation Firestore**
  - Logger un repas sur un appareil
  - Se connecter sur un autre appareil
  - Vérifier que le repas apparaît sur les deux appareils

- [ ] **Base de données globale**
  - Ajouter un aliment personnalisé via l'IA Logger
  - Vérifier qu'il apparaît dans globalFoods (admin)
  - Vérifier qu'il est accessible à tous les utilisateurs

### 7. Gestion Admin

- [ ] **Protection des routes admin**
  - Accéder à /admin-custom-foods sans être admin
  - Vérifier que l'accès est refusé et redirection

- [ ] **Fonctionnalités admin**
  - Se connecter avec un compte admin (isAdmin: true)
  - Accéder à /admin-custom-foods
  - Vérifier que tous les aliments personnalisés sont listés
  - Accéder à /admin-requests
  - Vérifier que les demandes d'aliments sont listées

### 8. Performance & Erreurs

- [ ] **Gestion d'erreurs OpenAI**
  - Tester avec une clé API invalide
  - Vérifier que le parser basique est utilisé en fallback
  - Vérifier que l'erreur est affichée clairement

- [ ] **Rate limiting OpenAI**
  - Faire plus de 10 requêtes en 1 minute
  - Vérifier que le rate limit est appliqué
  - Vérifier que le message d'erreur est clair

- [ ] **Mode hors ligne**
  - Désactiver la connexion internet
  - Vérifier que l'app fonctionne en mode local (AsyncStorage)
  - Vérifier que les données sont synchronisées à la reconnexion

### 9. Interface Utilisateur

- [ ] **Responsive design**
  - Tester sur différentes tailles d'écran (mobile, tablette, desktop)
  - Vérifier que les éléments sont bien positionnés

- [ ] **Thème sombre/clair**
  - Basculer entre les thèmes
  - Vérifier que tous les éléments s'adaptent correctement

- [ ] **Affichage des repas dans l'historique**
  - Vérifier que les repas d'aujourd'hui sont mis en évidence
  - Vérifier que les repas d'hier sont différenciés
  - Vérifier que les repas plus anciens sont affichés avec moins d'opacité

### 10. Sécurité

- [ ] **Règles Firestore**
  - Vérifier qu'un utilisateur ne peut pas accéder aux données d'un autre
  - Vérifier qu'un utilisateur non-admin ne peut pas modifier globalFoods
  - Vérifier que les règles sont déployées correctement

- [ ] **Variables d'environnement**
  - Vérifier que .env.production n'est pas commité
  - Vérifier que les clés API sont bien chargées depuis les variables d'env

### 11. Déploiement

- [ ] **Build production**
  - Exécuter scripts/build-production.sh (ou .bat)
  - Vérifier que le build se termine sans erreur
  - Vérifier que les fichiers sont générés dans web-build/

- [ ] **Déploiement Firebase**
  - Déployer sur Firebase Hosting
  - Vérifier que l'app est accessible sur l'URL de production
  - Vérifier que les règles Firestore sont déployées

### 12. Monitoring

- [ ] **Sentry**
  - Forcer une erreur dans l'app
  - Vérifier que l'erreur est capturée par Sentry (si configuré)

- [ ] **Analytics Firebase**
  - Effectuer des actions (logger repas, évoluer dragon)
  - Vérifier que les événements apparaissent dans Firebase Analytics

---

## Tests Recommandés Avant Release

1. **Test complet sur mobile réel** (iOS et Android si disponible)
2. **Test sur différents navigateurs** (Chrome, Safari, Firefox)
3. **Test avec plusieurs utilisateurs** en parallèle
4. **Test de charge** avec 10+ requêtes simultanées
5. **Test de migration** depuis une ancienne version (si applicable)

---

**Date de dernière mise à jour:** 27 janvier 2025


