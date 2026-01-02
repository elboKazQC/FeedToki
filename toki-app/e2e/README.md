# Tests E2E FeedToki

Suite de tests end-to-end automatisés avec Playwright pour valider le fonctionnement de l'application FeedToki sur différentes plateformes (Web, iPhone, Android).

## 📋 Prérequis

1. Node.js installé
2. L'application FeedToki doit être en cours d'exécution sur `http://localhost:8081` (ou configurer `E2E_BASE_URL` dans `.env.test`)
3. Firebase Admin SDK configuré (optionnel, pour le cleanup automatique des comptes de test)

## 🚀 Installation

Les dépendances sont déjà installées via `npm install`. Si besoin, réinstaller Playwright :

```bash
cd toki-app
npx playwright install
```

## ⚙️ Configuration

### Variables d'environnement

Créer un fichier `e2e/.env.test` (optionnel, valeurs par défaut disponibles) :

```env
FIREBASE_PROJECT_ID=feed-toki
TEST_USER_EMAIL_PREFIX=test+e2e
E2E_BASE_URL=http://localhost:8081
E2E_TIMEOUT=60000
```

### Firebase Admin SDK (pour cleanup)

Pour activer le nettoyage automatique des comptes de test, configurer Firebase Admin SDK :

1. Obtenir un fichier de service account depuis Firebase Console
2. Ajouter les credentials dans les variables d'environnement ou configurer Application Default Credentials

## 🧪 Exécution des tests

### Tous les tests (toutes les plateformes)

```bash
npm run test:e2e
```

### Tests sur une plateforme spécifique

```bash
# Web (Desktop)
npm run test:e2e:web

# iPhone (émulation Safari)
npm run test:e2e:iphone

# Android (émulation Chrome Mobile)
npm run test:e2e:android
```

### Mode debug (step-by-step)

```bash
npm run test:e2e:debug
```

### Mode UI (interface graphique)

```bash
npm run test:e2e:ui
```

## 📁 Structure

```
e2e/
├── playwright.config.ts      # Configuration Playwright
├── .env.test                 # Variables d'environnement (optionnel)
├── fixtures/
│   ├── auth-fixtures.ts      # Helpers pour authentification
│   └── test-data.ts          # Données de test
├── tests/
│   ├── auth.spec.ts          # Tests création de compte
│   ├── onboarding.spec.ts    # Tests onboarding
│   ├── meal-entry.spec.ts    # Tests ajout de nourriture
│   ├── navigation.spec.ts    # Tests navigation pages
│   └── full-flow.spec.ts     # Test complet E2E
└── utils/
    ├── page-helpers.ts       # Helpers interactions page
    ├── assertions.ts         # Assertions custom
    └── cleanup.ts            # Nettoyage comptes de test
```

## 🧩 Tests disponibles

### 1. `auth.spec.ts` - Authentification
- Création de nouveau compte
- Validation des erreurs de formulaire

### 2. `onboarding.spec.ts` - Onboarding
- Complétion du processus d'onboarding
- Validation des objectifs et données utilisateur

### 3. `meal-entry.spec.ts` - Ajout de nourriture
- Ajout de repas via recherche manuelle
- Ajout de repas via IA (si disponible)

### 4. `navigation.spec.ts` - Navigation
- Accès à toutes les pages principales
- Validation qu'il n'y a pas de pages blanches
- Détection d'erreurs JavaScript

### 5. `full-flow.spec.ts` - Flux complet
- Test complet du flux utilisateur : création → onboarding → repas → navigation

## 🔍 Détection d'erreurs

Les tests détectent automatiquement :
- **Pages blanches** : Vérification que le contenu est rendu
- **Erreurs console** : Capture des erreurs JavaScript (sauf erreurs non-bloquantes comme les polices)
- **Erreurs réseau** : Détection des requêtes failed (4xx, 5xx)

## 🧹 Cleanup automatique

Les comptes de test sont automatiquement supprimés après chaque test. Si Firebase Admin SDK n'est pas configuré, les comptes devront être supprimés manuellement depuis Firebase Console.

## 📊 Rapports

Les rapports sont générés dans :
- `playwright-report/` : Rapport HTML interactif
- `test-results/` : Screenshots et vidéos des échecs

## 🐛 Troubleshooting

### Les tests échouent avec "Page not loaded"
- Vérifier que l'application est en cours d'exécution sur `http://localhost:8081`
- Vérifier la variable `E2E_BASE_URL` dans `.env.test`

### Erreurs Firebase
- Vérifier que Firebase Authentication est activé
- Vérifier les règles Firestore (les comptes de test doivent pouvoir être créés)

### Les tests sont lents
- Augmenter les timeouts dans `playwright.config.ts` si nécessaire
- Vérifier la connexion internet (les tests utilisent Firebase)

### Cleanup ne fonctionne pas
- Vérifier que Firebase Admin SDK est configuré
- Les comptes de test peuvent être supprimés manuellement depuis Firebase Console

## 📝 Notes

- Les tests utilisent des emails uniques générés automatiquement (`test+e2e+{timestamp}@example.com`)
- Les tests sont exécutés séquentiellement pour éviter les conflits Firebase
- Les screenshots et vidéos sont générés uniquement en cas d'échec
