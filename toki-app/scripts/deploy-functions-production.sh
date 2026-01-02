#!/bin/bash
# Script pour déployer les fonctions Firebase en production
# Usage: ./deploy-functions-production.sh

echo "════════════════════════════════════════"
echo "Déploiement des fonctions Firebase"
echo "════════════════════════════════════════"
echo ""

cd "$(dirname "$0")/.."

echo "📋 Vérification de la configuration..."
echo ""

# Vérifier que les clés sont configurées
if ! firebase functions:config:get 2>/dev/null | grep -q "stripe"; then
  echo "❌ Configuration Stripe non trouvée"
  echo "   Configurez d'abord avec setup-stripe-secrets-production.sh"
  exit 1
fi

echo "✅ Configuration Stripe trouvée"
echo ""

echo "📦 Installation des dépendances..."
cd functions
npm install
if [ $? -ne 0 ]; then
  echo "❌ Erreur lors de l'installation des dépendances"
  exit 1
fi

echo ""
echo "🔨 Compilation TypeScript..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Erreur lors de la compilation"
  exit 1
fi

echo ""
echo "🚀 Déploiement des fonctions..."
cd ..
firebase deploy --only functions:handleStripeWebhook,functions:createCheckoutSession

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Erreur lors du déploiement"
  exit 1
fi

echo ""
echo "════════════════════════════════════════"
echo "✅ Déploiement terminé avec succès!"
echo "════════════════════════════════════════"
echo ""
echo "📋 Fonctions déployées:"
echo "   - handleStripeWebhook"
echo "   - createCheckoutSession"
echo ""
echo "💡 Prochaines étapes:"
echo "   1. Tester le webhook PRODUCTION depuis Stripe Dashboard"
echo "   2. Vérifier les logs: firebase functions:log --only handleStripeWebhook"
echo "   3. Tester un abonnement complet en production"
echo ""
