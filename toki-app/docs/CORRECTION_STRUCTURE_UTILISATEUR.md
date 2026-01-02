# Correction : Structure utilisateur dans Firestore

## Problème identifié

Si un utilisateur a été créé depuis le début de l'application, il est possible que :
1. Le document utilisateur n'existe pas encore dans Firestore
2. Le webhook Stripe utilise `update()` qui **échoue** si le document n'existe pas

## Solution appliquée

### Correction dans `handleStripeWebhook`

Le code a été modifié pour :
1. Vérifier si le document utilisateur existe
2. Si le document n'existe pas, le créer avec `userId` et `subscription`
3. Si le document existe, utiliser `update()` comme avant

**Avant** :
```typescript
await userRef.update({ subscription: subscriptionData });
```

**Après** :
```typescript
const userDoc = await userRef.get();
if (!userDoc.exists) {
  console.log(`[handleStripeWebhook] ⚠️ Document utilisateur n'existe pas, création...`);
  await userRef.set({
    userId: userId,
    ...subscriptionData,
  });
} else {
  await userRef.update(subscriptionData);
}
```

### Correction dans `createSubscriptionManually`

La même logique a été appliquée à la fonction `createSubscriptionManually` pour cohérence.

## Vérification

Pour vérifier si votre utilisateur existe dans Firestore :

1. Aller dans [Firebase Console](https://console.firebase.google.com)
2. Sélectionner le projet `feed-toki`
3. Aller dans **Firestore Database**
4. Naviguer vers `users/cRHlBQJshyR9uDx1FpPMMruaaOW2`
5. Vérifier que le document existe

### Si le document n'existe pas

Le webhook créera automatiquement le document lors du prochain paiement. Vous pouvez aussi :

1. Créer le document manuellement dans Firebase Console
2. Utiliser la fonction `createSubscriptionManually` qui créera aussi le document si nécessaire

## Déploiement

Les fonctions ont été déployées avec cette correction. Le webhook devrait maintenant fonctionner même si le document utilisateur n'existe pas encore.

## Test

Pour tester :
1. Faire un nouveau paiement via Stripe Checkout
2. Vérifier dans Firebase Console que le document utilisateur a été créé
3. Vérifier que le champ `subscription` est présent et correct
