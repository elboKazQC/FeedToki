# Changelog - FeedToki

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

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


