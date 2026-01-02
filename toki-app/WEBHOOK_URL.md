# URL du Webhook Stripe - FeedToki

## URL Complète du Webhook

```
https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
```

## Détails

- **Région:** `us-central1` (Iowa, USA)
- **Projet:** `feed-toki`
- **Function:** `handleStripeWebhook`

Cette région a été confirmée via `firebase functions:list` qui montre que vos functions existantes utilisent `us-central1`.

## Pour Configurer dans Stripe Dashboard

1. Aller dans Stripe Dashboard > Developers > Webhooks
2. Cliquer "Add endpoint"
3. Coller cette URL: `https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook`
4. Sélectionner les événements:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copier le Webhook Signing Secret (commence par `whsec_...`)

## Important

⚠️ **Le webhook doit être configuré APRÈS avoir déployé la function `handleStripeWebhook`!**

Si vous n'avez pas encore déployé la function, l'URL ne sera pas accessible. Déployez d'abord:

```bash
cd toki-app/functions
npm install stripe
npm run build
cd ..
firebase deploy --only functions:handleStripeWebhook
```
