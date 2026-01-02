#!/bin/bash
# Script pour vérifier la configuration Stripe PRODUCTION
# Usage: ./verify-production-config.sh

echo "════════════════════════════════════════"
echo "Vérification configuration PRODUCTION"
echo "════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/.."

echo "📋 Configuration Firebase Functions:"
echo ""
firebase functions:config:get | grep -A 10 stripe || echo "⚠️  Configuration Stripe non trouvée"
echo ""

echo "🔍 Vérifications:"
echo ""

# Vérifier la clé secrète
SECRET_KEY=$(firebase functions:config:get 2>/dev/null | grep -o '"secret_key": "[^"]*' | cut -d'"' -f4)
if [ -z "$SECRET_KEY" ]; then
  echo "❌ STRIPE_SECRET_KEY non configurée"
else
  if [[ "$SECRET_KEY" == sk_live_* ]]; then
    echo "✅ STRIPE_SECRET_KEY: PRODUCTION (sk_live_...)"
  elif [[ "$SECRET_KEY" == sk_test_* ]]; then
    echo "⚠️  STRIPE_SECRET_KEY: TEST (sk_test_...) - Pas en production!"
  else
    echo "⚠️  STRIPE_SECRET_KEY: Format inconnu"
  fi
fi

# Vérifier le webhook secret
WEBHOOK_SECRET=$(firebase functions:config:get 2>/dev/null | grep -o '"webhook_secret": "[^"]*' | cut -d'"' -f4)
if [ -z "$WEBHOOK_SECRET" ]; then
  echo "❌ STRIPE_WEBHOOK_SECRET non configuré"
else
  if [[ "$WEBHOOK_SECRET" == whsec_* ]]; then
    echo "✅ STRIPE_WEBHOOK_SECRET: Configuré (whsec_...)"
    echo "   ⚠️  Vérifiez que c'est le secret PRODUCTION, pas TEST"
  else
    echo "⚠️  STRIPE_WEBHOOK_SECRET: Format inconnu"
  fi
fi

# Vérifier le Price ID dans le code
echo ""
echo "📋 Price ID dans le code:"
PRICE_ID_TEST=$(grep -o "price_1SkUYTGdme3i0KJAuhn1rPXJ" functions/src/index.ts 2>/dev/null)
PRICE_ID_PROD=$(grep -o "price_1SkU52Gdme3i0KJAgTp4COAz" functions/src/index.ts 2>/dev/null)

if [ -n "$PRICE_ID_PROD" ]; then
  echo "✅ Price ID PRODUCTION trouvé dans le code: price_1SkU52Gdme3i0KJAgTp4COAz"
else
  echo "⚠️  Price ID PRODUCTION non trouvé dans le code"
fi

if [ -n "$PRICE_ID_TEST" ]; then
  echo "ℹ️  Price ID TEST trouvé dans le code: price_1SkUYTGdme3i0KJAuhn1rPXJ"
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ Vérification terminée"
echo "════════════════════════════════════════"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Vérifier dans Stripe Dashboard que le Price ID PRODUCTION existe"
echo "   2. Vérifier que le webhook PRODUCTION est configuré"
echo "   3. Déployer les fonctions: firebase deploy --only functions"
echo ""
