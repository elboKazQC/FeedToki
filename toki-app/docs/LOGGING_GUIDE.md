# Guide de Logging Utilisateur - Toki

## 📊 Vue d'ensemble

Le système de logging permet de suivre les actions et erreurs de chaque utilisateur pour faciliter le debugging en production.

## 🔍 Comment voir les logs d'un utilisateur

### Option 1 : Firebase Console (Recommandé)

1. Va sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionne le projet `feed-toki`
3. Va dans **Firestore Database**
4. Ouvre la collection `user_logs`
5. Filtre par `userId` pour voir les logs d'un utilisateur spécifique

**Structure des logs :**
```
user_logs/
  {logId}/
    userId: "cRHlBQJshyR9uDx1FpPMMruaaOW2"
    level: "error" | "warn" | "info" | "debug"
    message: "Description de l'événement"
    context: "add-entry" | "ai-logger" | "points-calculation" | etc.
    data: "{...}" (JSON stringifié)
    timestamp: Timestamp
    userAgent: "Navigateur/OS"
    platform: "web" | "mobile"
```

### Option 2 : Requête Firestore (Code)

```javascript
import { getUserLogs } from './lib/user-logger';

// Récupérer les 100 derniers logs d'un utilisateur
const logs = await getUserLogs('cRHlBQJshyR9uDx1FpPMMruaaOW2', 100);

// Filtrer par niveau
const errorLogs = await getUserLogs('cRHlBQJshyR9uDx1FpPMMruaaOW2', 50, 'error');
```

## 📝 Contextes de logging disponibles

- `add-entry` : Ajout d'un repas manuellement
- `ai-logger` : Ajout d'un repas via l'IA
- `points-calculation` : Calcul et déduction de points
- `onboarding` : Processus d'onboarding
- `auth` : Authentification
- `sync` : Synchronisation avec Firestore
- `app` : Événements généraux

## 🎯 Niveaux de log

- **debug** : Informations de développement (détaillées)
- **info** : Événements normaux (ajout de repas, etc.)
- **warn** : Situations suspectes mais non bloquantes
- **error** : Erreurs qui nécessitent attention

## 💡 Exemples d'utilisation

### Logger un événement simple
```typescript
import { userLogger } from '../lib/user-logger';

await userLogger.info(userId, 'Repas ajouté avec succès', 'add-entry');
```

### Logger une erreur
```typescript
import { logError } from '../lib/user-logger';

try {
  // Code qui peut échouer
} catch (error) {
  await logError(userId, error, 'add-entry', { entryData });
}
```

### Logger avec données supplémentaires
```typescript
await userLogger.warn(
  userId,
  'Entrée ajoutée sans items',
  'add-entry',
  { entryId: newEntry.id, label: newEntry.label }
);
```

## 🔒 Règles de sécurité Firestore

Pour que les logs fonctionnent, ajoute cette règle dans Firestore :

```javascript
match /user_logs/{logId} {
  // Les utilisateurs peuvent lire leurs propres logs
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  
  // Les utilisateurs peuvent écrire leurs propres logs
  allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
  
  // Admin peut lire tous les logs (ajuster selon tes besoins)
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.admin == true;
}
```

## 📈 Optimisations

- **Cache en mémoire** : Les logs sont mis en cache et envoyés par batch toutes les 30 secondes
- **Limite de cache** : Maximum 50 logs avant envoi immédiat
- **Non-bloquant** : Si le logging échoue, l'app continue de fonctionner

## 🐛 Debugging

Si les logs n'apparaissent pas dans Firestore :

1. Vérifier que `FIREBASE_ENABLED = true`
2. Vérifier les règles Firestore
3. Vérifier la console du navigateur pour les erreurs
4. Forcer l'envoi immédiat : `await flushLogsNow()`

## 📱 Voir les logs sur mobile

Les logs sont accessibles de la même manière via Firebase Console, peu importe la plateforme (web, iOS, Android).

