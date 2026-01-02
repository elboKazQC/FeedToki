@echo off
REM Script pour installer Stripe et déployer les functions Firebase
REM Usage: deploy-functions-stripe.bat

echo 🔧 Installation de Stripe et déploiement des functions...
echo.

cd functions

echo 📦 Installation de Stripe...
call npm install stripe

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors de l'installation de Stripe
    pause
    exit /b 1
)

echo.
echo 🔨 Build des functions...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors du build
    pause
    exit /b 1
)

echo.
echo 🚀 Déploiement des functions...
cd ..
call firebase deploy --only functions

if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erreur lors du déploiement
    pause
    exit /b 1
)

echo.
echo ✅ Déploiement réussi!
echo.
echo 📋 Prochaines étapes:
echo    1. Vérifier que handleStripeWebhook est déployée: firebase functions:list
echo    2. Tester le paiement dans l'app
echo    3. Vérifier les webhooks dans Stripe Dashboard
echo.

pause
