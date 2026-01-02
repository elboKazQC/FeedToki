#!/bin/bash
# Script pour configurer le webhook secret Stripe dans Firebase Functions
# Usage: ./setup-webhook-secret.sh

echo "⚠️  Configuration du webhook secret Stripe PRODUCTION"
echo ""

# Webhook secret Stripe (PRODUCTION)
STRIPE_WEBHOOK_SECRET="whsec_qf4mVsFuJD9p07K8t6eYw1nayAbMuOej"

echo "Configuration de STRIPE_WEBHOOK_SECRET..."
firebase functions:config:set stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET"

echo ""
echo "✅ Webhook secret configuré!"
echo ""
echo "📋 Résumé de la configuration Stripe:"
echo "   - Secret Key: Configuré"
echo "   - Publishable Key: Configuré"
echo "   - Webhook Secret: Configuré ✅"
echo "   - Price ID: price_1SkU52Gdme3i0KJAgTp4COAz ✅"
echo "   - Webhook URL: https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook ✅"
echo ""
echo "⚠️  PROCHAINE ÉTAPE:"
echo "   Déployer les functions pour activer le webhook:"
echo "   cd functions && npm install stripe && npm run build"
echo "   firebase deploy --only functions"
