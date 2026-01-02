#!/bin/bash
# Script pour créer un abonnement manuellement dans Firestore via Firebase CLI
# Usage: ./create-subscription-firebase-cli.sh

USER_ID="cRHlBQJshyR9uDx1FpPMMruaaOW2"
CUSTOMER_ID="cus_TiDXZZf5MqNgtk"
SUBSCRIPTION_ID="sub_1SknCIGdme3i0KJAW3s35lNa"

# Dates par défaut (1 mois à partir de maintenant)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
END_DATE=$(date -u -d "+1 month" +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -v+1m +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%S.000Z")

echo "════════════════════════════════════════"
echo "Création manuelle d'abonnement"
echo "════════════════════════════════════════"
echo ""
echo "📋 Informations:"
echo "   User ID: $USER_ID"
echo "   Customer ID: $CUSTOMER_ID"
echo "   Subscription ID: $SUBSCRIPTION_ID"
echo ""

# Créer le document JSON pour l'abonnement
SUBSCRIPTION_JSON=$(cat <<EOF
{
  "tier": "paid",
  "status": "active",
  "subscriptionStartDate": "$NOW",
  "subscriptionEndDate": "$END_DATE",
  "stripeCustomerId": "$CUSTOMER_ID",
  "stripeSubscriptionId": "$SUBSCRIPTION_ID",
  "createdAt": "$NOW"
}
EOF
)

echo "📝 Abonnement à créer:"
echo "$SUBSCRIPTION_JSON" | jq .
echo ""

# Utiliser Firebase CLI pour mettre à jour le document
echo "🔄 Création de l'abonnement dans Firestore..."
firebase firestore:set "users/$USER_ID/subscription" "$SUBSCRIPTION_JSON" --project feed-toki

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Abonnement créé avec succès!"
  echo ""
  echo "📋 Détails:"
  echo "   Tier: paid"
  echo "   Status: active"
  echo "   Start Date: $NOW"
  echo "   End Date: $END_DATE"
  echo "   Stripe Customer ID: $CUSTOMER_ID"
  echo "   Stripe Subscription ID: $SUBSCRIPTION_ID"
  echo ""
  echo "════════════════════════════════════════"
  echo "✅ SUCCÈS!"
  echo "════════════════════════════════════════"
else
  echo ""
  echo "❌ Erreur lors de la création de l'abonnement"
  echo "   Essayez d'utiliser le script TypeScript: npx ts-node scripts/create-subscription-manually.ts"
  exit 1
fi
