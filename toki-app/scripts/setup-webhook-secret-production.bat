@echo off
REM Script pour configurer le webhook secret Stripe PRODUCTION dans Firebase Functions (Windows)
REM Usage: setup-webhook-secret-production.bat
REM
REM ⚠️  IMPORTANT: Remplacez whsec_... par votre vrai webhook secret PRODUCTION

echo ⚠️  Configuration du webhook secret Stripe PRODUCTION
echo.
echo ⚠️  ATTENTION: Assurez-vous d'avoir le webhook secret PRODUCTION (pas TEST)!
echo.

REM ⚠️  REMPLACER PAR LE VRAI WEBHOOK SECRET PRODUCTION
set STRIPE_WEBHOOK_SECRET=whsec_...

if "%STRIPE_WEBHOOK_SECRET%"=="whsec_..." (
  echo ❌ Erreur: Vous devez remplacer whsec_... par votre vrai webhook secret PRODUCTION
  echo.
  echo 📋 Pour obtenir le webhook secret PRODUCTION:
  echo    1. Aller sur https://dashboard.stripe.com/webhooks
  echo    2. Cliquer sur votre webhook PRODUCTION
  echo    3. Cliquer sur "Révéler" dans "Clé secrète de signature"
  echo    4. Copier le secret (commence par whsec_...)
  echo    5. Modifier ce script et remplacer whsec_... par le vrai secret
  echo.
  pause
  exit /b 1
)

echo Configuration de STRIPE_WEBHOOK_SECRET (PRODUCTION)...
firebase functions:config:set stripe.webhook_secret="%STRIPE_WEBHOOK_SECRET%"

echo.
echo ✅ Webhook secret PRODUCTION configuré!
echo.
echo 📋 Résumé de la configuration Stripe PRODUCTION:
echo    - Secret Key: Vérifiez avec verify-production-config.bat
echo    - Publishable Key: Vérifiez avec verify-production-config.bat
echo    - Webhook Secret: Configuré ✅
echo    - Price ID: price_1SkU52Gdme3i0KJAgTp4COAz ✅
echo    - Webhook URL: https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook ✅
echo.
echo ⚠️  PROCHAINE ÉTAPE:
echo    Déployer les functions pour activer le webhook:
echo    cd functions && npm install stripe && npm run build
echo    firebase deploy --only functions:handleStripeWebhook
echo.

pause
