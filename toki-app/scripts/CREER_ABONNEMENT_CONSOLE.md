# Créer l'abonnement via Firebase Console

## Méthode rapide (recommandée)

### Étape 1 : Ouvrir Firebase Console

1. Allez sur [Firebase Console](https://console.firebase.google.com/project/feed-toki/firestore)
2. Ouvrez **Firestore Database**
3. Naviguez vers `users/cRHlBQJshyR9uDx1FpPMMruaaOW2`

### Étape 2 : Ajouter le champ subscription

1. Cliquez sur le document `cRHlBQJshyR9uDx1FpPMMruaaOW2`
2. Cliquez sur **"Ajouter un champ"** (ou **"Add field"**)
3. Nom du champ : `subscription`
4. Type : **map** (objet)
5. Cliquez sur **"Ajouter"**

### Étape 3 : Ajouter les sous-champs

Dans le champ `subscription`, ajoutez ces champs :

| Nom du champ | Type | Valeur |
|-------------|------|--------|
| `tier` | string | `paid` |
| `status` | string | `active` |
| `subscriptionStartDate` | string | `2026-01-01T14:49:54.000Z` |
| `subscriptionEndDate` | string | `2026-02-01T14:49:54.000Z` |
| `stripeCustomerId` | string | `cus_TiDXZZf5MqNgtk` |
| `stripeSubscriptionId` | string | `sub_1SknCIGdme3i0KJAW3s35lNa` |
| `createdAt` | string | `2026-01-01T14:49:54.000Z` |

### Étape 4 : Sauvegarder

Cliquez sur **"Mettre à jour"** (ou **"Update"**)

## ✅ Vérification

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

## 📝 Notes

- Les dates sont basées sur la date de création de l'abonnement Stripe (2026-01-01 14:49:54 UTC)
- La date de fin est 1 mois après (2026-02-01 14:49:54 UTC)
- Si vous avez les vraies dates depuis Stripe Dashboard, utilisez-les à la place

## 🔗 Alternative : Utiliser Firebase CLI

Si vous préférez utiliser la ligne de commande :

```bash
cd toki-app
firebase firestore:set users/cRHlBQJshyR9uDx1FpPMMruaaOW2/subscription scripts/subscription-data.json --project feed-toki
```

**Note:** Cette commande nécessite que `subscription` soit un sous-document. Si vous voulez l'ajouter comme champ dans le document utilisateur, utilisez plutôt la méthode Firebase Console ci-dessus.
