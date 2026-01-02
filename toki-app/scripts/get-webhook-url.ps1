# Script PowerShell pour trouver l'URL du webhook Stripe
# Usage: .\get-webhook-url.ps1

Write-Host "Recherche de la région Firebase..." -ForegroundColor Cyan

# Tenter de trouver la région via Firebase CLI
$functionsList = firebase functions:list 2>&1

if ($functionsList -match 'https://([\w-]+)-feed-toki\.cloudfunctions\.net') {
    $region = $matches[1]
    Write-Host "`n✅ Région trouvée: $region" -ForegroundColor Green
    Write-Host "`nURL du webhook Stripe:" -ForegroundColor Yellow
    Write-Host "https://$region-feed-toki.cloudfunctions.net/handleStripeWebhook" -ForegroundColor White
} else {
    Write-Host "`n⚠️  Impossible de détecter automatiquement la région" -ForegroundColor Yellow
    Write-Host "`nVérifiez manuellement:" -ForegroundColor Cyan
    Write-Host "1. Firebase Console > Functions > Voir l'URL d'une function existante" -ForegroundColor White
    Write-Host "2. Ou essayez: https://us-central1-feed-toki.cloudfunctions.net/handleStripeWebhook" -ForegroundColor White
    Write-Host "   (us-central1 est la région par défaut)" -ForegroundColor Gray
}

Write-Host "`nAppuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
