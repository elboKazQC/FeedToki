# Guide: Ajouter les Images du Dragon

## Structure des Sprites

Le dragon a **12 niveaux** d'évolution. Chaque niveau nécessite une image PNG.

### Emplacement des fichiers:
Place tes images PNG dans: `assets/images/dragon/`

### Noms de fichiers requis:
```
level-1.png   - Oeuf (niveau 0-100 points)
level-2.png   - Éclosion (101-300 points)
level-3.png   - Bébé dragon (301-600 points)
level-4.png   - Dragon enfant (601-1000 points)
level-5.png   - Dragon adolescent (1001-1500 points)
level-6.png   - Jeune dragon (1501-2200 points)
level-7.png   - Dragon adulte (2201-3000 points)
level-8.png   - Dragon sage (3001-4000 points)
level-9.png   - Dragon ancien (4001-5500 points)
level-10.png  - Dragon légendaire (5501-7500 points)
level-11.png  - Dragon mythique (7501-10000 points)
level-12.png  - Dragon divin (10001+ points)
```

## Spécifications Recommandées

### Dimensions:
- **Taille**: 512x512px (ou 1024x1024px pour haute résolution)
- **Format**: PNG avec transparence (fond transparent)
- **Ratio**: 1:1 (carré)

### Style:
- Mignon et expressif
- Évolution progressive visible
- Couleurs vives et joyeuses
- Style cartoon/kawaii adapté aux enfants

### États par niveau:
1. **Oeuf** - Oeuf simple avec motifs
2. **Éclosion** - Oeuf fissuré, début d'éclosion
3. **Bébé** - Petit dragon qui vient de naître
4. **Enfant** - Dragon qui grandit, yeux curieux
5. **Adolescent** - Plus grand, ailes qui poussent
6. **Jeune** - Ailes développées, plus confiant
7. **Adulte** - Dragon pleinement formé
8. **Sage** - Dragon avec sagesse, auréole?
9. **Ancien** - Dragon majestueux, détails élaborés
10. **Légendaire** - Dragon imposant, effets lumineux
11. **Mythique** - Dragon cosmique, étoiles/galaxie
12. **Divin** - Dragon transcendant, ultra majestueux

## Variations d'Humeur

Pour chaque niveau, tu peux aussi créer des variations d'humeur (optionnel):
- `level-X-happy.png` - Content (nourri récemment)
- `level-X-hungry.png` - A faim (besoin de points)
- `level-X-sad.png` - Triste (longtemps sans points)

Place ces fichiers dans le même dossier `assets/images/dragon/`.

## Génération d'Images

### Options:
1. **Dessiner toi-même** avec Procreate, Photoshop, etc.
2. **Commander sur Fiverr/Upwork** (~50-100$ pour 12 sprites)
3. **Utiliser des générateurs AI**:
   - DALL-E 3
   - Midjourney
   - Stable Diffusion
   
### Prompt AI suggéré:
```
"Cute kawaii dragon character evolution, level [X], 
cartoon style, friendly expression, transparent background, 
front view, colorful, game asset, PNG"
```

## Test

Une fois les images ajoutées:
1. Redémarre l'app: `npm start`
2. Les images devraient s'afficher automatiquement selon tes points totaux
3. Si une image manque, le placeholder emoji sera affiché

## Placeholder Actuel

Pour l'instant, l'app utilise des emojis comme placeholder:
- 🥚 Niveau 1
- 🐣 Niveau 2
- 🐲 Niveaux 3+

Ces emojis seront automatiquement remplacés quand tu ajouteras tes vraies images PNG.
