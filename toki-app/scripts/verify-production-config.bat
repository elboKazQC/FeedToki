@echo off
REM Script pour vérifier la configuration Stripe PRODUCTION
REM Usage: verify-production-config.bat

echo ════════════════════════════════════════
echo Vérification configuration PRODUCTION
echo ════════════════════════════════════════
echo.

cd /d "%~dp0\.."

echo 📋 Configuration Firebase Functions:
echo.
firebase functions:config:get | findstr /C:"stripe" || echo ⚠️  Configuration Stripe non trouvée
echo.

echo 🔍 Vérifications:
echo.

REM Vérifier la clé secrète
for /f "tokens=2 delims=:" %%a in ('firebase functions:config:get 2^>nul ^| findstr /C:"secret_key"') do (
  set SECRET_KEY=%%a
  set SECRET_KEY=!SECRET_KEY:"=!
  set SECRET_KEY=!SECRET_KEY: =!
)

if "!SECRET_KEY!"=="" (
  echo ❌ STRIPE_SECRET_KEY non configurée
) else (
  echo !SECRET_KEY! | findstr /C:"sk_live_" >nul
  if !errorlevel! equ 0 (
    echo ✅ STRIPE_SECRET_KEY: PRODUCTION (sk_live_...)
  ) else (
    echo !SECRET_KEY! | findstr /C:"sk_test_" >nul
    if !errorlevel! equ 0 (
      echo ⚠️  STRIPE_SECRET_KEY: TEST (sk_test_...) - Pas en production!
    ) else (
      echo ⚠️  STRIPE_SECRET_KEY: Format inconnu
    )
  )
)

REM Vérifier le webhook secret
for /f "tokens=2 delims=:" %%a in ('firebase functions:config:get 2^>nul ^| findstr /C:"webhook_secret"') do (
  set WEBHOOK_SECRET=%%a
  set WEBHOOK_SECRET=!WEBHOOK_SECRET:"=!
  set WEBHOOK_SECRET=!WEBHOOK_SECRET: =!
)

if "!WEBHOOK_SECRET!"=="" (
  echo ❌ STRIPE_WEBHOOK_SECRET non configuré
) else (
  echo !WEBHOOK_SECRET! | findstr /C:"whsec_" >nul
  if !errorlevel! equ 0 (
    echo ✅ STRIPE_WEBHOOK_SECRET: Configuré (whsec_...)
    echo    ⚠️  Vérifiez que c'est le secret PRODUCTION, pas TEST
  ) else (
    echo ⚠️  STRIPE_WEBHOOK_SECRET: Format inconnu
  )
)

echo.
echo 📋 Price ID dans le code:
findstr /C:"price_1SkU52Gdme3i0KJAgTp4COAz" functions\src\index.ts >nul
if !errorlevel! equ 0 (
  echo ✅ Price ID PRODUCTION trouvé dans le code: price_1SkU52Gdme3i0KJAgTp4COAz
) else (
  echo ⚠️  Price ID PRODUCTION non trouvé dans le code
)

findstr /C:"price_1SkUYTGdme3i0KJAuhn1rPXJ" functions\src\index.ts >nul
if !errorlevel! equ 0 (
  echo ℹ️  Price ID TEST trouvé dans le code: price_1SkUYTGdme3i0KJAuhn1rPXJ
)

echo.
echo ════════════════════════════════════════
echo ✅ Vérification terminée
echo ════════════════════════════════════════
echo.
echo 📋 Prochaines étapes:
echo    1. Vérifier dans Stripe Dashboard que le Price ID PRODUCTION existe
echo    2. Vérifier que le webhook PRODUCTION est configuré
echo    3. Déployer les fonctions: firebase deploy --only functions
echo.

pause
