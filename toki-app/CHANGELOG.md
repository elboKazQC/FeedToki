# Changelog - FeedToki

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.0.78] - 2026-01-02

### Amélioré

- **Messages d'envoi d'email** : Ajout d'une information sur le délai de réception (5-10 minutes)
  - Message dans l'alerte après renvoi d'email
  - Message dans la boîte de succès visible dans l'interface
  - Amélioration de l'expérience utilisateur pour réduire l'anxiété d'attente

## [1.0.77] - 2026-01-02

### Amélioré

- **Diagnostic des emails de vérification** : Ajout de logs détaillés pour diagnostiquer les problèmes d'envoi d'emails
  - Logs complets dans la console pour chaque tentative d'envoi d'email
  - Messages d'erreur plus détaillés avec codes Firebase spécifiques
  - Instructions claires pour résoudre les problèmes courants
  - Documentation complète dans `docs/DIAGNOSTIC_EMAIL_VERIFICATION.md`
  - Meilleure gestion des erreurs `auth/too-many-requests` avec messages explicites

### Documentation

- Ajout du guide `DIAGNOSTIC_EMAIL_VERIFICATION.md` avec toutes les vérifications à faire et solutions aux problèmes courants

## [1.0.76] - 2026-01-02

### Supprimé

- **Fonctionnalité de détection de pays** : Suppression complète de la géolocalisation par IP
  - Suppression du module `ip-geolocation.ts` et de toutes les références à `detectCountry()`
  - Retrait du champ `country` du type `UserProfile`
  - Retrait des métriques `usersByCountry` et `newUsersByCountry` des KPIs admin
  - Suppression du graphique "Répartition par Pays" dans l'interface admin
  - Suppression du script de migration `migrate-add-country.ts`
  - Raison : La détection de pays causait trop de problèmes (erreurs réseau, CORS, Firestore undefined)

### Modifié

- **Création de compte** : Simplification du processus sans détection de pays
  - Plus de risque d'erreur Firestore lié à `country` undefined
  - Processus d'inscription plus fiable et plus rapide

## [1.0.75] - 2026-01-02

### Corrigé

- **Erreur création de compte : champ `country` undefined** : Correction de l'erreur Firestore lors de la création d'un nouveau compte
  - Le champ `country` pouvait être `undefined` si la détection par IP échouait
  - Firestore n'accepte pas les valeurs `undefined`, ce qui causait l'erreur `Unsupported field value: undefined`
  - Correction : le champ `country` n'est ajouté au profil que s'il est défini
  - Documentation dans `docs/SOLUTION_ERREUR_COUNTRY_UNDEFINED.md`

### Documentation

- Ajout du guide `SOLUTION_ERREUR_COUNTRY_UNDEFINED.md` pour référence future

## [1.0.74] - 2026-01-02

### Corrigé

- **Erreur d'hydratation React #418** : Correction complète de l'erreur d'hydratation sur la version web
  - Ajout de l'état `isClient` dans `ThemeProvider` pour garantir une valeur stable au premier rendu
  - Retour de `null` dans `RootLayoutContent` si `!isClient` sur web pour éviter les différences serveur/client
  - Rendu conditionnel de `StatusBar` seulement après initialisation côté client
  - Documentation complète de la solution dans `docs/SOLUTION_ERREUR_HYDRATATION_REACT_418.md`

### Documentation

- Ajout du guide `SOLUTION_ERREUR_HYDRATATION_REACT_418.md` détaillant la cause, la solution et les principes clés pour éviter les erreurs d'hydratation

## [1.0.73] - 2026-01-02

### Ajouté

- **Tests E2E avec Playwright** : Suite complète de tests automatisés
  - Tests d'authentification (création de compte, connexion)
  - Tests d'onboarding
  - Tests d'ajout de repas (manuel et IA)
  - Tests de navigation à travers toutes les pages
  - Tests de flux complet utilisateur
  - Support multi-plateformes (Web, iPhone, Android)
  - Configuration Playwright avec 3 projets (web, iphone, android)
  - Helpers et fixtures pour simplification des tests
  - Documentation complète dans `e2e/README.md`

### Corrigé

- **Erreur "Platform is not defined"** : Ajout de l'import `Platform` dans `constants/theme.ts`
- **Pattern `isClient`** : Implémentation dans `app/index.tsx` pour éviter les erreurs d'hydratation

### Modifié

- Ajout de dépendances dev : `@playwright/test`, `playwright`, `firebase-admin`, `dotenv`
- Ajout de scripts npm pour exécuter les tests E2E sur différentes plateformes
- Mise à jour de `.gitignore` pour exclure les fichiers de résultats Playwright

## [1.0.0] - 2025-01-27

### Ajouté

#### Fonctionnalités Principales
- **Système d'authentification complet** avec Firebase Auth
- **Onboarding personnalisé** avec calcul TDEE et points dynamiques
- **Parser IA des repas** avec OpenAI GPT-4o-mini
- **Base de données alimentaire globale** partagée entre tous les utilisateurs
- **Système de streaks** avec calendrier Duolingo-style
- **Évolution du dragon** avec 12 niveaux d'évolution
- **Statistiques détaillées** avec meilleurs jours et totaux nutritionnels
- **Recommandations intelligentes** basées sur les besoins nutritionnels

#### Sécurité & Production
- **Règles Firestore** complètes avec protection des données utilisateurs
- **Protection des routes admin** avec vérification isAdmin
- **Variables d'environnement** pour configuration production
- **Rate limiting OpenAI** (10 requêtes/min par utilisateur)
- **Logger centralisé** pour réduire les logs en production

#### Monitoring & Analytics
- **Sentry** configuré pour le suivi d'erreurs
- **Firebase Analytics** intégré pour le suivi des événements
- **Tracking des événements** (meals logged, dragon evolved, etc.)

#### Documentation & Compliance
- **Politique de Confidentialité** (RGPD compliant)
- **Conditions d'Utilisation**
- **Guide de déploiement** pour production
- **Guide de backup** et restauration Firestore
- **Checklist de test** pour validation avant release

#### Scripts & Outils
- **Scripts de build production** (build-production.sh/.bat)
- **Configuration Firestore** dans firebase.json
- **Template .env.production.example**

### Modifié

- **Système de points** : Calcul dynamique basé sur l'objectif de poids
- **Affichage de l'historique** : Différenciation visuelle pour aujourd'hui/hier/autres jours
- **Interface utilisateur** : Améliorations UX/UI avec design system
- **Gestion des erreurs** : Meilleure gestion des erreurs OpenAI et fallback
- **Navigation** : Correction des problèmes de navigation après login

### Corrigé

- Correction du calcul de streak avec validation des calories
- Correction du matching d'aliments (fuzzy matching amélioré)
- Correction de l'affichage des valeurs nutritionnelles dans l'IA Logger
- Correction de la classification des aliments (steak haché = 0 points)
- Correction des problèmes de navigation après authentification

### Sécurité

- Implémentation des règles Firestore pour protéger les données
- Protection des routes admin avec vérification isAdmin
- Variables d'environnement sécurisées (non commitées)
- Rate limiting pour prévenir l'abus de l'API OpenAI

---

## [0.9.0] - 2024-12-25

### Ajouté
- Version prototype initiale
- Système de logging manuel des repas
- Base de données alimentaire (100+ items)
- Calcul de points basique
- Affichage des statistiques

### Limitations
- Pas de comptes utilisateurs (mode local uniquement)
- Pas de visuels dragon
- Pas d'IA pour parsing des repas
- Pas d'onboarding personnalisé

---

**Note:** Ce changelog est maintenu manuellement. Pour les versions futures, documenter tous les changements significatifs.


