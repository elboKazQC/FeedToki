@echo off
REM Script pour déployer les fonctions Firebase en production
REM Usage: deploy-functions-production.bat

echo ════════════════════════════════════════
echo Déploiement des fonctions Firebase
echo ════════════════════════════════════════
echo.

cd /d "%~dp0\.."

echo 📋 Vérification de la configuration...
echo.

REM Vérifier que les clés sont configurées
firebase functions:config:get | findstr /C:"stripe" >nul
if errorlevel 1 (
  echo ❌ Configuration Stripe non trouvée
  echo    Configurez d'abord avec setup-stripe-secrets-production.bat
  pause
  exit /b 1
)

echo ✅ Configuration Stripe trouvée
echo.

echo 📦 Installation des dépendances...
cd functions
call npm install
if errorlevel 1 (
  echo ❌ Erreur lors de l'installation des dépendances
  pause
  exit /b 1
)

echo.
echo 🔨 Compilation TypeScript...
call npm run build
if errorlevel 1 (
  echo ❌ Erreur lors de la compilation
  pause
  exit /b 1
)

echo.
echo 🚀 Déploiement des fonctions...
cd ..
firebase deploy --only functions:handleStripeWebhook,functions:createCheckoutSession

if errorlevel 1 (
  echo.
  echo ❌ Erreur lors du déploiement
  pause
  exit /b 1
)

echo.
echo ════════════════════════════════════════
echo ✅ Déploiement terminé avec succès!
echo ════════════════════════════════════════
echo.
echo 📋 Fonctions déployées:
echo    - handleStripeWebhook
echo    - createCheckoutSession
echo.
echo 💡 Prochaines étapes:
echo    1. Tester le webhook PRODUCTION depuis Stripe Dashboard
echo    2. Vérifier les logs: firebase functions:log --only handleStripeWebhook
echo    3. Tester un abonnement complet en production
echo.

pause
