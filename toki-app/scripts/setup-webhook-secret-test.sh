#!/bin/bash
# Script pour configurer le webhook secret Stripe TEST dans Firebase Functions (Linux/Mac)
# Usage: ./setup-webhook-secret-test.sh
#
# Webhook secret TEST fourni: whsec_oufgvtk4nrHCgSFwtBW945gsjT0qBjEy

echo "⚠️  Configuration du webhook secret Stripe TEST"
echo ""

# Webhook secret Stripe (TEST)
STRIPE_WEBHOOK_SECRET="whsec_oufgvtk4nrHCgSFwtBW945gsjT0qBjEy"

echo "Configuration de STRIPE_WEBHOOK_SECRET (TEST)..."
firebase functions:config:set stripe.webhook_secret="$STRIPE_WEBHOOK_SECRET"

echo ""
echo "✅ Webhook secret TEST configuré!"
echo ""
echo "📋 Résumé de la configuration Stripe TEST:"
echo "   - Secret Key: Configuré"
echo "   - Publishable Key: Configuré"
echo "   - Webhook Secret: Configuré ✅"
echo "   - Price ID: price_1SkUYTGdme3i0KJAuhn1rPXJ ✅"
echo "   - Webhook URL: https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook ✅"
echo ""
echo "⚠️  PROCHAINE ÉTAPE:"
echo "   Déployer les functions pour activer le webhook:"
echo "   cd functions && npm install stripe && npm run build"
echo "   firebase deploy --only functions:handleStripeWebhook"
echo ""
