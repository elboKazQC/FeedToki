# 🔧 Diagnostic Mobile - Sans Console

## Problème Résolu
Tu n'as pas accès à la console sur ton téléphone, donc j'ai ajouté un **panneau de diagnostic visible directement dans l'app**.

## Comment Utiliser

### 1. Ouvrir le Panneau de Diagnostic
1. Va dans l'écran **"Log avec IA"**
2. Clique sur le bouton **"🔧 Afficher diagnostic"** (sous le bouton "Analyser")
3. Le panneau s'ouvre et affiche toutes les infos techniques

### 2. Que Vois-Tu ?

Le panneau affiche :

#### 📱 Informations Système
- **Plateforme** : `ios`, `android`, ou `web`
- **Mode de parsing** : 
  - `OpenAI` = utilise l'IA (meilleur)
  - `Fallback (règles basiques)` ⚠️ = règles simples (moins précis)

#### 📊 Détails de Résolution (pour chaque aliment)
Pour chaque aliment analysé, tu verras :

```
Input: toast au beurre de peanut
Matched: Toast au beurre de peanut
Source: DB
Base calories: 390 kcal
Multiplier: 2.00x
Final: 780 kcal
```

**Ce que ça signifie :**
- **Input** : Ce que tu as écrit
- **Matched** : L'aliment trouvé dans la base de données
- **Source** : D'où viennent les données
  - `DB` = Base de données (fiable ✅)
  - `OFF` = Open Food Facts (peut varier selon cache)
  - `ESTIMATED` = Estimation IA (moins fiable ⚠️)
  - `CUSTOM` = Aliment personnalisé
- **Base calories** : Calories pour 1 portion standard
- **Multiplier** : Facteur de multiplication (ex: 2x = 2 portions)
- **Final** : Calories totales calculées

### 3. Comparer Mobile vs PC

Pour trouver pourquoi tu as des différences (700 vs 390 cal) :

**Sur ton téléphone :**
1. Entre "2 toast au beurre de peanut"
2. Ouvre le diagnostic
3. Prends une capture d'écran du panneau

**Sur ton PC :**
1. Entre la même chose
2. Ouvre le diagnostic
3. Prends une capture d'écran

**Compare :**
- Est-ce que le **Mode de parsing** est le même ?
- Est-ce que la **Source** est la même (DB, OFF, ESTIMATED) ?
- Est-ce que le **Multiplier** est identique ?
- Est-ce que les **Base calories** sont différentes ?

### 4. Interpréter les Différences

| Observation | Cause Probable | Solution |
|------------|---------------|----------|
| Mode différent (OpenAI vs Fallback) | Clé API manquante sur mobile | Vérifier variables d'environnement |
| Source différente (DB vs OFF) | Cache Open Food Facts différent | Vider le cache ou forcer DB |
| Multiplier différent | Parsing de quantité différent | Bug dans l'extraction de quantité |
| Base calories différentes | Aliment custom écrasant DB | Vérifier les warnings dans le log |

### 5. Exemples de Bugs Trouvables

**Cas 1 : Mobile = OFF (700 cal), PC = DB (390 cal)**
- Mobile a trouvé un produit OFF en cache
- PC utilise la base de données locale
- **Fix** : Vider le cache OFF sur mobile

**Cas 2 : Mobile = ESTIMATED (700 cal), PC = DB (390 cal)**
- Mobile ne trouve pas l'aliment dans la DB
- Matching échoue → estimation IA
- **Fix** : Améliorer le matching fuzzy

**Cas 3 : Même source (DB), calories différentes**
- Un custom food écrase la DB sur un appareil
- **Fix** : Vérifier les aliments personnalisés

## Bonus : Badges Visuels

Les badges colorés sur chaque aliment te montrent aussi la source :

- 📊 **Base de données** (vert) = Fiable
- 🌐 **Open Food Facts** (bleu) = Peut varier
- ⚠️ **Estimation IA** (orange) = Peu fiable
- 👤 **Personnalisé** (violet) = Custom

## Notes Importantes

- Le panneau reste visible pendant que tu navigues
- Tu peux le cacher en cliquant à nouveau sur le bouton
- Les infos sont mises à jour après chaque analyse
- Pas besoin de redémarrer l'app

---

**Créé le :** 2026-01-08  
**Pourquoi :** Permettre le diagnostic sur mobile sans accès console
