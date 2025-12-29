# 🐉 Génération Rapide des Sprites Dragon

## Option 1: Utiliser le Script Automatique (Recommandé)

### Avec OpenAI DALL-E 3 (Meilleure qualité, ~$0.50 pour 12 images)

```bash
# 1. Installer les dépendances (si pas déjà fait)
cd toki-app
npm install

# 2. Obtenir une clé API OpenAI
# - Va sur https://platform.openai.com
# - Crée un compte (ou connecte-toi)
# - Va dans "API keys" → "Create new secret key"
# - Copie la clé

# 3. Définir la clé API (Windows PowerShell)
$env:OPENAI_API_KEY="ta-clé-api-ici"

# 3. Définir la clé API (Windows CMD)
set OPENAI_API_KEY=ta-clé-api-ici

# 3. Définir la clé API (Linux/Mac)
export OPENAI_API_KEY="ta-clé-api-ici"

# 4. Générer les sprites
node scripts/generate-dragon-sprites.js --dalle
```

### Avec Hugging Face (Gratuit, qualité variable)

```bash
# Optionnel: Obtenir une clé API (améliore les limites)
# - Va sur https://huggingface.co/settings/tokens
# - Crée un token
# - Définis-le:
export HF_API_KEY="ton-token-ici"

# Générer les sprites
node scripts/generate-dragon-sprites.js
```

---

## Option 2: Génération Manuelle avec ChatGPT (DALL-E 3)

Si tu as ChatGPT Plus, tu peux générer les images directement:

1. **Ouvre ChatGPT** (https://chat.openai.com)
2. **Pour chaque niveau**, copie-colle le prompt correspondant:

### Niveau 1
```
Cute kawaii dragon egg, simple design, subtle patterns, golden accents, white and cream colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 2
```
Cute kawaii dragon hatching from egg, cracked shell, baby dragon head visible, happy expression, pastel colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 3
```
Cute kawaii baby dragon, small size, big eyes, happy expression, tiny wings, pastel colors (pink, blue, green), front view, transparent background, game asset, PNG, 512x512
```

### Niveau 4
```
Cute kawaii young dragon, growing up, curious eyes, playful expression, small wings developing, vibrant pastel colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 5
```
Cute kawaii teenage dragon, wings growing, confident expression, medium size, vibrant colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 6
```
Cute kawaii young adult dragon, fully developed wings, majestic pose, confident expression, rich colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 7
```
Cute kawaii adult dragon, fully grown, majestic and balanced, wise expression, deep rich colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 8
```
Cute kawaii wise dragon, sage expression, subtle glow or halo, noble colors (gold, purple, deep blue), front view, transparent background, game asset, PNG, 512x512
```

### Niveau 9
```
Cute kawaii ancient dragon, majestic and impressive, elaborate details, royal colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 10
```
Cute kawaii legendary dragon, imposing presence, subtle light effects, glowing details, bright colors, front view, transparent background, game asset, PNG, 512x512
```

### Niveau 11
```
Cute kawaii mythical dragon, cosmic theme, stars and galaxy patterns, ultra-rare appearance, cosmic colors (purple, deep blue, stars), front view, transparent background, game asset, PNG, 512x512
```

### Niveau 12
```
Cute kawaii divine dragon, transcendent appearance, ultra majestic, perfect form, divine colors (gold, white, light), glowing aura, front view, transparent background, game asset, PNG, 512x512
```

3. **Télécharge chaque image** générée
4. **Renomme-les** : `level-1.png`, `level-2.png`, etc.
5. **Place-les** dans `assets/images/dragon/`

---

## Option 3: Utiliser un Service en Ligne Gratuit

### Leonardo.ai (Gratuit avec crédits quotidiens)

1. Va sur https://leonardo.ai
2. Crée un compte (gratuit, 150 crédits/jour)
3. Va dans "AI Image Generation"
4. Utilise les prompts ci-dessus
5. Paramètres recommandés:
   - Dimensions: 512×512
   - Model: Leonardo Diffusion XL
   - Style: Anime/Cartoon
6. Télécharge et place dans `assets/images/dragon/`

### Bing Image Creator (Gratuit)

1. Va sur https://www.bing.com/images/create
2. Connecte-toi avec un compte Microsoft
3. Utilise les prompts ci-dessus
4. Télécharge les images
5. Place dans `assets/images/dragon/`

---

## Après Génération

Une fois les 12 images générées:

1. **Vérifier** que les fichiers sont bien nommés `level-1.png` à `level-12.png`
2. **Vérifier** qu'ils sont dans `assets/images/dragon/`
3. **Décommenter** dans `components/dragon-display.tsx`:
   ```typescript
   const DRAGON_IMAGES: Record<number, any> = {
     1: require('../../assets/images/dragon/level-1.png'),
     2: require('../../assets/images/dragon/level-2.png'),
     // ... etc pour tous les niveaux
   };
   ```
4. **Redémarrer l'app** - les sprites devraient s'afficher!

---

## Coûts Estimés

- **OpenAI DALL-E 3**: ~$0.50-1.00 pour 12 images
- **Hugging Face**: Gratuit (mais rate limits)
- **ChatGPT Plus**: Inclus dans l'abonnement ($20/mois)
- **Leonardo.ai**: Gratuit (150 crédits/jour)
- **Bing Image Creator**: Gratuit

---

**Note:** Les images générées par IA peuvent nécessiter un peu de retouche (supprimer le fond si pas transparent, ajuster les couleurs, etc.). Tu peux utiliser des outils comme:
- Remove.bg (supprimer fond)
- GIMP / Photoshop (retouches)
- Canva (ajustements rapides)

