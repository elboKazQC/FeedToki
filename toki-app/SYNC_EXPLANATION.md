# Explication de la Synchronisation Multi-Appareils

## Problème identifié

L'ancienne fonction `restoreFromFirestore` ne restaurait les données que si le stockage local était **vide**. Cela signifiait que si un appareil avait déjà des données locales, les données Firestore n'étaient jamais utilisées, empêchant la synchronisation entre appareils.

## Solution implémentée

### Nouvelle fonction `syncFromFirestore`

Cette fonction **fusionne** intelligemment les données locales et Firestore :

1. **Repas (Meals)** : Fusionne les deux sources par ID, Firestore prend priorité
2. **Points** : Utilise toujours Firestore comme source de vérité
3. **Objectifs (Targets)** : Utilise Firestore si disponible, sinon local
4. **Poids (Weights)** : Fusionne par date, Firestore prend priorité
5. **Aliments personnalisés** : Déjà géré par `loadCustomFoods` qui fusionne automatiquement

### Quand la synchronisation se fait

1. **Au login** : Dans `auth-context.tsx`, `syncFromFirestore` est appelée automatiquement
2. **Au chargement de l'app** : Dans `index.tsx`, la synchronisation se fait aussi au chargement des entrées
3. **Après chaque modification** : `syncAllToFirestore` envoie les données locales vers Firestore

## Comment tester

1. Ajoute un repas sur ton téléphone
2. Attends quelques secondes (la synchronisation se fait en arrière-plan)
3. Ouvre l'app sur le web
4. Les données devraient apparaître après rafraîchissement

## Notes importantes

- La synchronisation est **bidirectionnelle** : Local → Firestore ET Firestore → Local
- Les données Firestore prennent **priorité** en cas de conflit (plus récent)
- La synchronisation se fait automatiquement, pas besoin d'action manuelle




