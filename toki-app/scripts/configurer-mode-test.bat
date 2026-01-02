@echo off
REM Script pour configurer le mode TEST Stripe
REM Usage: configurer-mode-test.bat

echo 🧪 Configuration du mode TEST Stripe
echo.
echo ⚠️  Ce script configure les clés TEST
echo    Vous devrez ensuite:
echo    1. Créer le produit en mode TEST dans Stripe Dashboard
echo    2. Mettre à jour le Price ID dans functions/src/index.ts
echo    3. Configurer le webhook en mode TEST
echo    4. Redéployer les functions
echo.

pause

echo.
echo 📦 Configuration des clés TEST...
call scripts\setup-stripe-secrets.bat

echo.
echo ✅ Clés TEST configurées!
echo.
echo 📋 PROCHAINES ÉTAPES:
echo.
echo 1. Créer le produit en mode TEST:
echo    - Aller sur https://dashboard.stripe.com/test/products
echo    - Créer "FeedToki Premium" à $10.00 CAD/mois
echo    - Copier le Price ID (commence par 'price_...')
echo.
echo 2. Mettre à jour functions/src/index.ts:
echo    - Ligne 221: Remplacer le Price ID par celui du mode TEST
echo.
echo 3. Configurer le webhook en mode TEST:
echo    - Aller sur https://dashboard.stripe.com/test/webhooks
echo    - URL: https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook
echo    - Événements: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
echo    - Copier le Webhook Secret (whsec_...)
echo.
echo 4. Configurer le webhook secret:
echo    firebase functions:config:set stripe.webhook_secret="whsec_..."
echo.
echo 5. Redéployer:
echo    cd functions && npm run build && cd .. && firebase deploy --only functions
echo.
echo 📖 Pour plus de détails: docs/PASSER_EN_MODE_TEST.md
echo.

pause
