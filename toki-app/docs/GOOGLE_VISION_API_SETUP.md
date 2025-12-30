# Configuration Google Cloud Vision API

## Prérequis

1. Un projet Firebase (déjà configuré: `feed-toki`)
2. Accès à Google Cloud Console

## Étapes d'activation

### 1. Activer Google Cloud Vision API

1. Va sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionne le projet `feed-toki` (ou crée-le si nécessaire)
3. Va dans **APIs & Services** > **Library**
4. Recherche "Cloud Vision API"
5. Clique sur **Cloud Vision API**
6. Clique sur **Enable** (Activer)

### 2. Configurer les permissions IAM

1. Va dans **IAM & Admin** > **IAM**
2. Vérifie que le compte de service Firebase Functions a les permissions:
   - `Cloud Vision API User` (ou `Editor` pour plus de permissions)

### 3. Configurer la facturation (si nécessaire)

Google Cloud Vision API a un **quota gratuit**:
- **1000 requêtes/mois** gratuites
- Après: ~$1.50 pour 1000 requêtes supplémentaires

Pour activer la facturation (si tu veux dépasser le quota gratuit):
1. Va dans **Billing** > **Account Management**
2. Ajoute une méthode de paiement
3. Configure des alertes de budget pour éviter les surprises

### 4. Vérifier l'activation

Une fois activé, tu peux vérifier dans:
- **APIs & Services** > **Enabled APIs**
- Tu devrais voir "Cloud Vision API" dans la liste

## Déploiement

Après activation, déploie les Firebase Functions:

```bash
cd toki-app
firebase deploy --only functions
```

## Coûts estimés

- **Gratuit**: 1000 scans/mois
- **Payant**: ~$1.50 pour 1000 scans supplémentaires
- **Recommandation**: Surveiller l'utilisation dans Google Cloud Console

## Rate Limiting

La fonction inclut une gestion d'erreurs pour:
- Quota dépassé
- Permissions manquantes
- Images invalides

Le client web a un fallback automatique vers QuaggaJS/ZXing si l'API cloud échoue.

## Dépannage

### Erreur "PERMISSION_DENIED"
- Vérifie que Cloud Vision API est activée
- Vérifie les permissions IAM du compte de service Firebase

### Erreur "INVALID_ARGUMENT"
- Vérifie que l'image est en format base64 valide
- Vérifie que l'image n'est pas trop grande (max 20MB pour Vision API)

### Quota dépassé
- Vérifie l'utilisation dans Google Cloud Console
- Active la facturation si tu veux continuer
- Le client basculera automatiquement vers le décodage local
