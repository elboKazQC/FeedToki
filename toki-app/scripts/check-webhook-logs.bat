@echo off
REM Script pour vérifier les logs du webhook Stripe
REM Usage: check-webhook-logs.bat [nombre_de_lignes]

set LIMIT=%1
if "%LIMIT%"=="" set LIMIT=20

echo ════════════════════════════════════════
echo Vérification des logs handleStripeWebhook
echo ════════════════════════════════════════
echo.
echo 📋 Affichage des %LIMIT% dernières lignes...
echo.

cd /d "%~dp0\.."

firebase functions:log --only handleStripeWebhook --limit %LIMIT%

echo.
echo ════════════════════════════════════════
echo ✅ Logs affichés
echo ════════════════════════════════════════
echo.
echo 💡 Pour voir plus de logs:
echo    check-webhook-logs.bat 50
echo.

pause
