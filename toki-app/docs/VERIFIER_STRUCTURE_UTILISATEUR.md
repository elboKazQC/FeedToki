# Vérifier la structure d'un utilisateur dans Firestore

## Problème potentiel

Si un utilisateur a été créé depuis le début de l'application, il est possible que :
1. Le document utilisateur n'existe pas encore dans Firestore (si créé avant la migration)
2. Le document existe mais n'a pas tous les champs nécessaires
3. Le document existe mais la structure n'est pas complète

## Solution : Vérifier via Firebase Console

### Méthode 1 : Via Firebase Console (recommandé)

1. Aller dans [Firebase Console](https://console.firebase.google.com)
2. Sélectionner le projet `feed-toki`
3. Aller dans **Firestore Database**
4. Naviguer vers `users/cRHlBQJshyR9uDx1FpPMMruaaOW2`
5. Vérifier que le document existe et contient au moins :
   - `userId` (string) - ID de l'utilisateur
   - `email` (string, optionnel) - Email de l'utilisateur
   - `displayName` (string, optionnel) - Nom d'affichage
   - `createdAt` (timestamp, optionnel) - Date de création

### Structure attendue pour l'abonnement

Le champ `subscription` n'est **pas requis** pour que le document existe. Il sera ajouté automatiquement par le webhook Stripe ou par la fonction `createSubscriptionManually`.

Structure du champ `subscription` (sera créé automatiquement) :
```json
{
  "tier": "paid",
  "status": "active",
  "subscriptionStartDate": "2026-01-01T00:00:00.000Z",
  "subscriptionEndDate": "2026-02-01T00:00:00.000Z",
  "stripeCustomerId": "cus_TiDXZZf5MqNgtk",
  "stripeSubscriptionId": "sub_1SknCIGdme3i0KJAW3s35lNa",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

## Si le document n'existe pas

Si le document utilisateur n'existe pas dans Firestore, il faut le créer. Le webhook Stripe utilise `userRef.update({ subscription: subscriptionData })` qui **échouera** si le document n'existe pas.

### Solution : Créer le document manuellement

1. Aller dans Firebase Console > Firestore
2. Cliquer sur "Ajouter un document"
3. Collection ID: `users`
4. Document ID: `cRHlBQJshyR9uDx1FpPMMruaaOW2`
5. Ajouter les champs suivants :
   ```json
   {
     "userId": "cRHlBQJshyR9uDx1FpPMMruaaOW2",
     "email": "email@example.com",
     "displayName": "Nom d'utilisateur",
     "createdAt": "2026-01-01T00:00:00.000Z"
   }
   ```
6. Cliquer sur "Enregistrer"

### Solution alternative : Utiliser le script de vérification

Si vous avez `serviceAccountKey.json` :

```bash
cd toki-app
npm install firebase-admin --save-dev
npx ts-node scripts/verify-user-structure.ts cRHlBQJshyR9uDx1FpPMMruaaOW2
```

Le script va :
- Vérifier si le document existe
- Afficher tous les champs présents
- Vérifier les champs essentiels
- Indiquer si le document peut recevoir un abonnement

## Vérification via le code

Le code dans `functions/src/index.ts` utilise :
```typescript
const userRef = admin.firestore().doc(`users/${userId}`);
await userRef.update({ subscription: subscriptionData });
```

**Important** : `update()` échoue si le document n'existe pas. Si c'est le cas, il faut utiliser `set()` avec `merge: true` :

```typescript
await userRef.set({ subscription: subscriptionData }, { merge: true });
```

## Correction dans le code

Si le problème persiste, il faudrait modifier `handleStripeWebhook` pour utiliser `set()` avec `merge: true` au lieu de `update()`, ce qui créera le document s'il n'existe pas.
