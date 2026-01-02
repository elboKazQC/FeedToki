# Cartes de Test Stripe

Lorsque vous utilisez les clés Stripe en mode TEST, vous pouvez utiliser ces cartes de test pour simuler des paiements.

## Cartes de Test Valides

### Carte qui réussit toujours
- **Numéro:** `4242 4242 4242 4242`
- **Date d'expiration:** N'importe quelle date future (ex: `12/34`)
- **CVC:** N'importe quel 3 chiffres (ex: `123`)
- **Code postal:** N'importe quel code postal valide (ex: `H1A 1A1`)

### Autres cartes de test
- **Carte qui nécessite 3D Secure:** `4000 0025 0000 3155`
- **Carte qui est refusée:** `4000 0000 0000 0002`
- **Carte qui nécessite authentification:** `4000 0027 6000 3184`

## Tester les Abonnements

1. Utiliser la carte `4242 4242 4242 4242`
2. L'abonnement sera créé automatiquement
3. Vérifier dans Stripe Dashboard > Subscriptions que l'abonnement est actif
4. Vérifier dans Firestore que la subscription de l'utilisateur est mise à jour

## Vérifier les Webhooks

1. Aller dans Stripe Dashboard > Developers > Webhooks
2. Cliquer sur votre endpoint
3. Voir les événements reçus dans "Events"
4. Vérifier que les événements sont bien reçus et traités

## Passer en Production

Quand vous êtes prêt pour la production:
1. Créer le produit en mode LIVE dans Stripe Dashboard
2. Configurer le webhook en mode LIVE
3. Remplacer les clés TEST par les clés LIVE dans Firebase Functions
4. Mettre à jour le Price ID dans `functions/src/index.ts` avec le Price ID LIVE
