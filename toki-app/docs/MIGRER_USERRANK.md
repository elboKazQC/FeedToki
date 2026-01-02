# Migration des userRank - Guide

## Problème

Les utilisateurs existants créés avant l'implémentation du système de subscription n'ont pas de `userRank` dans leur profil Firestore. Cela cause des warnings répétés dans la console.

## Solution

Une Cloud Function `migrateUserRanks` a été créée pour calculer et ajouter le `userRank` à tous les utilisateurs existants.

## Comment exécuter la migration

### Option 1: Via Firebase Console (Recommandé)

1. Aller sur https://console.firebase.google.com/project/feed-toki/functions
2. Trouver la function `migrateUserRanks`
3. Cliquer sur "Test" ou utiliser l'onglet "Testing"
4. Cliquer "Run" (vous devez être connecté en tant qu'admin)

### Option 2: Via l'application (si vous êtes admin)

Créer un bouton admin dans l'app qui appelle la function:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const migrateUserRanks = httpsCallable(functions, 'migrateUserRanks');

const result = await migrateUserRanks({});
console.log('Migration terminée:', result.data);
```

### Option 3: Via Firebase CLI (si vous êtes admin)

```bash
# Appeler la function via curl ou un script
# Note: Nécessite un token d'authentification
```

## Résultat attendu

Après la migration, tous les utilisateurs auront un `userRank` dans leur profil:
- Rang 1-10: Beta users (gratuit à vie)
- Rang 11+: Utilisateurs normaux (paiement requis)

## Vérification

Après la migration, les warnings `[Subscription Utils] userRank manquant` devraient disparaître.

## Note

La function vérifie que l'utilisateur qui l'appelle est admin. Seuls les admins peuvent exécuter cette migration.
