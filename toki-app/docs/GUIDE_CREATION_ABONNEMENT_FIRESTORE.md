# Guide : Créer l'abonnement dans Firestore

## Méthode 1 : Via Firebase Console (Recommandé)

### Étape 1 : Ouvrir le document utilisateur

1. Allez sur [Firebase Console - Document utilisateur](https://console.firebase.google.com/project/feed-toki/firestore/data/~2Fusers~2FcRHlBQJshyR9uDx1FpPMMruaaOW2)
2. Cliquez sur le document `cRHlBQJshyR9uDx1FpPMMruaaOW2`

### Étape 2 : Ajouter le champ subscription

1. Cliquez sur **"Ajouter un champ"** (ou **"Add field"**)
2. **Nom du champ** : `subscription`
3. **Type** : Sélectionnez **map** (objet)
4. Cliquez sur **"Ajouter"**

### Étape 3 : Ajouter les sous-champs

Dans le champ `subscription` qui vient d'être créé, ajoutez ces champs un par un :

| Nom du champ | Type | Valeur |
|-------------|------|--------|
| `tier` | string | `paid` |
| `status` | string | `active` |
| `subscriptionStartDate` | string | `2026-01-01T14:49:54.000Z` |
| `subscriptionEndDate` | string | `2026-02-01T14:49:54.000Z` |
| `stripeCustomerId` | string | `cus_TiDXZZf5MqNgtk` |
| `stripeSubscriptionId` | string | `sub_1SknCIGdme3i0KJAW3s35lNa` |
| `createdAt` | string | `2026-01-01T14:49:54.000Z` |

**Pour chaque sous-champ :**
1. Cliquez sur le `+` à côté de `subscription`
2. Entrez le nom du champ
3. Sélectionnez le type (string)
4. Entrez la valeur
5. Cliquez sur **"Ajouter"**

### Étape 4 : Sauvegarder

Cliquez sur **"Mettre à jour"** (ou **"Update"**)

## Méthode 2 : Via la fonction Firebase (Si vous êtes admin)

Si vous êtes connecté en tant qu'admin dans l'app, vous pouvez utiliser la fonction Firebase `createSubscriptionManually` :

```javascript
const functions = getFunctions();
const createSubscriptionManually = httpsCallable(functions, 'createSubscriptionManually');

await createSubscriptionManually({
  userId: 'cRHlBQJshyR9uDx1FpPMMruaaOW2',
  subscriptionId: 'sub_1SknCIGdme3i0KJAW3s35lNa'
});
```

## Vérification

Après avoir créé l'abonnement, vérifiez que le document contient :

```json
{
  "subscription": {
    "tier": "paid",
    "status": "active",
    "subscriptionStartDate": "2026-01-01T14:49:54.000Z",
    "subscriptionEndDate": "2026-02-01T14:49:54.000Z",
    "stripeCustomerId": "cus_TiDXZZf5MqNgtk",
    "stripeSubscriptionId": "sub_1SknCIGdme3i0KJAW3s35lNa",
    "createdAt": "2026-01-01T14:49:54.000Z"
  }
}
```

## Prochaine étape

Une fois l'abonnement créé, testez dans l'app :
1. Connectez-vous avec l'utilisateur `cRHlBQJshyR9uDx1FpPMMruaaOW2`
2. Naviguez vers l'écran "AI Logger"
3. Vérifiez que le paywall n'apparaît pas
