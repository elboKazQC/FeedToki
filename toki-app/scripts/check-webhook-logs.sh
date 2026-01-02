#!/bin/bash
# Script pour vérifier les logs du webhook Stripe
# Usage: ./check-webhook-logs.sh [nombre_de_lignes]

LIMIT=${1:-20}

echo "════════════════════════════════════════"
echo "Vérification des logs handleStripeWebhook"
echo "════════════════════════════════════════"
echo ""
echo "📋 Affichage des $LIMIT dernières lignes..."
echo ""

cd "$(dirname "$0")/.."

firebase functions:log --only handleStripeWebhook --limit $LIMIT

echo ""
echo "════════════════════════════════════════"
echo "✅ Logs affichés"
echo "════════════════════════════════════════"
echo ""
echo "💡 Pour voir plus de logs:"
echo "   ./check-webhook-logs.sh 50"
echo ""
echo "💡 Pour filtrer les erreurs:"
echo "   firebase functions:log --only handleStripeWebhook | grep -i error"
echo ""
