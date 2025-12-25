# Toki 🐉 — App Gratuite de Nutrition par Points

**Toki** est une application mobile gratuite de suivi nutritionnel gamifiée, conçue pour tous (adultes, ados, enfants). Elle enseigne la modération alimentaire via un **système de points-budget** : chaque aliment coûte un certain nombre de points, les utilisateurs gèrent leur budget quotidien comme de l'argent.

**Vision:** Rendre le suivi calorique accessible, ludique et éducatif sans abonnements payants. Pas d'aliments interdits, juste des choix conscients.

---

## 🎯 Concept Clé

- **Points = Budget quotidien** : Les utilisateurs reçoivent des points par jour (ex: 3-12 pts selon objectif)
- **Aliments sains = gratuits ou peu chers** : Protéines maigres, légumes, fruits = 0-1 pt
- **Cheats = chers** : Poutine, pizza, fritures = 5-10 pts
- **Pas d'interdictions** : Tout est achetable, mais faut gérer son budget
- **Dragon Toki** : Mascotte gamifiée qui évolue selon les streaks de jours nourri

---

## 🚀 État Actuel (v0.9 — Prototype)

### ✅ Fonctionnalités Implémentées

- **Logging repas** : 100+ items alimentaires (focus Québec)
- **Système points** : 3 pts/jour, cap 12 pts max
- **Score 7 jours** : Moyenne santé (0-100) avec zones vert/jaune/rouge
- **Streaks** : Jours consécutifs nourri, calcul évolutions dragon (0-12)
- **Targets nutrition** : Protéines, glucides, calories personnalisables
- **Dragon mood** : États normal/inquiet/critique selon jours sans repas
- **Notifications locales** : Rappels quotidiens
- **Présets rapides** : Repas pré-configurés (Déjeuner, Poulet+Riz, etc.)

### ⚠️ Limitations Actuelles

- **Pas de comptes utilisateur** : Données locales uniquement (AsyncStorage)
- **Pas de visuels dragon** : 12 niveaux codés mais sprites manquants
- **Système points non-optimisé** : Mapping points/calories incohérent
- **Pas d'onboarding** : Targets par défaut (2000 cal) pour tous
- **Pas d'IA** : Recherche manuelle uniquement

---

## 📋 Roadmap Production (v1.0) — 8-11 Semaines

### **PHASE 1 : Smart Onboarding & Système Points Dynamique** _(3-4 semaines)_

#### Objectifs
- Personnaliser l'expérience selon objectif calorique de l'utilisateur
- Recalculer automatiquement points/jour, targets calories/protein
- Rebalancer coûts alimentaires pour cohérence énergétique

#### Tasks

**1.1 Créer Onboarding Personnalisé**
- **Fichier:** Nouveau `app/onboarding.tsx`
- **Écrans:**
  1. Bienvenue + explication concept (points = budget)
  2. Sélection objectif : Maintenance / -1 lb/sem / -2 lbs/sem / -3 lbs/sem
  3. Optionnel: Poids actuel + niveau activité (pour calcul TDEE)
  4. Résumé: "Ton objectif: 14,000 cal/sem | Points/jour: 8"
- **Calcul TDEE estimé:**
  ```
  TDEE_approx = poids_kg × 30 (sédentaire) ou × 35 (actif)
  Weekly_target = TDEE × 7 - deficit_hebdo
  ```
- **Stockage:** AsyncStorage `toki_user_profile_v1` (objectif, poids, tdee, points/jour)

**1.2 Calcul Dynamique Points/Jour**
- **Fichier:** `lib/points-calculator.ts` (nouveau)
- **Formule:**
  ```typescript
  // Budget indulgences = 30% du budget calorique hebdo
  indulgence_budget = weekly_target × 0.30
  daily_indulgence = indulgence_budget / 7
  points_per_day = Math.round(daily_indulgence / 80) // 80 cal/point avg
  max_cap = Math.min(points_per_day × 4, 12) // Cap dynamique
  ```
- **Exemples:**
  - Maintenance (17,500 cal/sem): 750 cal indulgence/sem → 9 pts/jour, cap 12
  - Déficit -1 lb/sem (15,000 cal/sem): 640 cal → 8 pts/jour, cap 10
  - Déficit -2 lbs/sem (12,500 cal/sem): 535 cal → 6 pts/jour, cap 8

**1.3 Rebalancer Coûts Alimentaires**
- **Fichier:** `lib/food-db.ts` (modifier)
- **Problème actuel:**
  - Staples 1-pt (riz, pâtes) = 200-270 cal → trop avantageux
  - Cheats 5-10 pts = 65-92 cal/pt → sous-pénalisés
- **Nouvelle formule (dans `lib/stats.ts > computeFoodPoints`):**
  ```typescript
  // Base: calorie-driven
  base_cost = calories_kcal / 100
  
  // Adjustments
  if (tags.includes('proteine_maigre') || tags.includes('legume')) {
    cost = 0 // Free
  } else if (tags.includes('ultra_transforme')) {
    cost = base_cost × 1.5 // 50% markup
  } else if (tags.includes('gras_frit')) {
    cost = base_cost × 1.3
  } else if (tags.includes('sucre') && calories > 100) {
    cost = base_cost × 1.2
  }
  
  return Math.max(0, Math.round(cost))
  ```
- **Vérifier:** 100+ items pour cohérence

**1.4 UI "Budget Points Personnalisé"**
- **Fichier:** `app/(tabs)/index.tsx` (modifier HomeScreen)
- **Afficher:**
  - Ligne 1: "Ton objectif: {weekly_cal} cal/semaine"
  - Ligne 2: "Budget quotidien: {points_per_day} pts | Cap: {max_cap} pts"
  - Ligne 3: "Aujourd'hui: {current_points} pts restants"
- **Visual:** Barre de progression circulaire (style "portefeuille")

**1.5 Explications Éducatives Inline**
- **Fichier:** `app/(tabs)/index.tsx` (AddEntryView)
- **Ajouter tooltips/infobulles:**
  - Poutine : "8 pts = 740 cal. C'est ~70% de ton budget quotidien 📊"
  - Poulet : "0 pts = Gratuit! Protéines maigres 🎉"
  - Riz : "1 pt = Staple léger, bon pour énergie ⚡"

---

### **PHASE 2 : Dragon Visuel & Multi-Comptes** _(3-4 semaines)_

#### Objectifs
- Implémenter authentification cloud (Firebase)
- Créer 12 sprites dragon pour évolutions
- Améliorer streak tracker avec gamification

#### Tasks

**2.1 Setup Firebase Authentication**
- **Installation:**
  ```bash
  npm install firebase @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
  ```
- **Config:** `firebase.config.ts` (API keys, project ID)
- **Écrans:**
  - `app/auth/login.tsx` : Email + Password
  - `app/auth/signup.tsx` : Inscription
  - `app/auth/profile.tsx` : Voir/modifier profil
- **Migration données:** AsyncStorage → Firestore au premier login

#### Production (Single-User) — Activer Firebase & Persistance Compte

Pour passer en production immédiatement en mode « un seul utilisateur » et conserver toutes tes données de compte de façon persistante (multi‑devices), active Firebase.

**Checklist rapide (Prod Single-User):**
- Installer Firebase (déjà fait) et créer un projet sur console.firebase.google.com
- Copier les clés dans `lib/firebase-config.ts` et mettre `FIREBASE_ENABLED = true`
- Démarrer l’app et te connecter via `/auth` (Firebase)
- Vérifier que l’onboarding est bien complété puis accéder à `/(tabs)`
- Optionnel: migrer tes données locales existantes vers Firestore

**Étapes détaillées:**
1. Crée un projet Firebase, active Authentication (Email/Password) et Firestore.
2. Récupère l’objet `firebaseConfig` et colle‑le dans `lib/firebase-config.ts`.
3. Mets `export const FIREBASE_ENABLED = true;` pour basculer en mode cloud.
4. Redémarre Expo:
   ```powershell
   cd "c:\Users\vcasaubon\OneDrive - Noovelia\Documents\GitHub\Toki\toki-app"
   npx expo start --clear
   ```
5. Sur l’écran `/auth`, connecte‑toi avec ton compte Firebase. L’app route automatiquement vers `/(tabs)` si ton profil existe et que l’onboarding est complété (voir `lib/auth-context.tsx`).

**Migration Local → Firebase (préserver tes données):**
- Par défaut, Toki utilise AsyncStorage en mode local. En activant Firebase, tes nouvelles données seront enregistrées côté cloud.
- Si tu avais déjà des repas/profil en local, plan de migration recommandé:
  - Ouvrir l’app en mode local une dernière fois et noter les éléments importants (profil, objectifs, dernière semaine de repas).
  - Activer Firebase (étapes ci‑dessus) puis te connecter.
  - Re‑créer les objectifs/profil si nécessaire; les prochains repas seront sauvegardés dans Firestore.
  - Option avancée: ajouter un petit utilitaire de migration qui lit tes entrées locales et les pousse dans Firestore (ex: `scripts/migrate-local-to-firestore.ts`).

**Pourquoi Firebase dès le départ (même seul utilisateur):**
- Persistance multi‑devices et sauvegarde cloud (aucune perte si le navigateur/AsyncStorage est vidé)
- Évolutif pour ouvrir à d’autres utilisateurs ensuite
- Intégration simple avec futures features (Stripe, Analytics, IA)

**2.2 Structure Firestore**
```
users/
  {userId}/
    profile: { email, createdAt, onboardingCompleted, weeklyCalTarget, pointsPerDay }
    stats: { currentStreak, longestStreak, totalFedDays, evolutionsUnlocked }
    entries/
      {entryId}: { date, items[], category, score, points_spent, createdAt }
    points: { balance, lastClaimDate }
    targets: { protein_g, carbs_g, calories_kcal }
```

**2.3 Créer 12 Sprites Dragon**
- **Options génération:**
  - Midjourney prompts : "Cute pixel art dragon, evolution level {X}, friendly, pastel colors"
  - Fiverr illustrateur (~$50-100 pour 12 sprites)
  - Stable Diffusion (gratuit, mais qualité variable)
- **Specs:**
  - 512×512 px PNG transparent
  - Style cohérent (même palette couleurs)
  - Progression visuelle: Level 1 (bébé) → Level 12 (majestueux)
- **Stockage:** `assets/images/dragon/level-{1..12}.png`

**2.4 Système Progression Dragon**
- **Fichier:** `components/dragon-display.tsx` (nouveau)
- **Props:**
  ```typescript
  interface DragonDisplayProps {
    level: number; // 0-12
    mood: 'normal' | 'inquiet' | 'critique';
    progressToNext: number; // 0-1
  }
  ```
- **Animations:** Fade-in entre niveaux, shake si mood critique

**2.5 Streak Calendar Heatmap**
- **Fichier:** `app/streak.tsx` (nouveau tab ou modal)
- **UI:** Style GitHub contributions
  - Grille 7 colonnes × ~8 semaines
  - Vert foncé = jour nourri, gris = manqué
  - Tap sur jour → voir meals logged ce jour-là
- **Librairie:** `react-native-calendars` ou custom

**2.6 Bonus Points Streaks**
- **Fichier:** `lib/stats.ts` (modifier `checkDailyPointsClaim`)
- **Règle:**
  ```typescript
  if (currentStreak % 7 === 0 && currentStreak > 0) {
    bonus = 1; // +1 pt tous les 7 jours
  }
  if (currentStreak % 30 === 0) {
    bonus = 3; // +3 pts à chaque évolution dragon
  }
  ```
- **Notification:** "🎉 Streak de 7 jours! +1 point bonus"

---

### **PHASE 3 : IA Payante & Production** _(2-3 semaines)_

#### Objectifs
- Implémenter AI Meal Logger comme feature premium
- Setup Stripe pour paiements
- Déploiement iOS/Android
- Analytics & crash reporting

#### Tasks

**3.1 Écran "Ajouter Repas via IA" (Payant)**
- **Fichier:** `app/ai-logger.tsx` (nouveau, behind paywall)
- **UI:**
  1. Textarea: "Décris ce que tu as mangé..."
  2. Bouton "Analyser (2 crédits)" ou badge "Premium requis"
  3. Résultat: Items détectés + portions + points preview
  4. User confirme/ajuste → log automatiquement
- **Paywall:** Si non-abonné, modal "Upgrade to Premium"

**3.2 Intégration GPT-4 API**
- **Fichier:** `lib/ai-meal-parser.ts` (nouveau)
- **Prompt:**
  ```
  User said: "{user_input}"
  
  Extract food items eaten. Return JSON:
  {
    "items": [
      {"name": "poulet grillé", "quantity": "200g", "category": "protein"},
      {"name": "riz brun", "quantity": "1 tasse", "category": "starch"}
    ]
  }
  
  Be specific. Use metric units. Quebec French names.
  ```
- **Coût:** ~$0.01-0.02 par request (GPT-4 mini)
- **Fallback:** Si API fail → allow manual entry

**3.3 Fuzzy Matching Items DB**
- **Fichier:** `lib/food-search.ts` (modifier)
- **Librairie:** `fuse.js` pour fuzzy search
- **Logic:**
  ```typescript
  // GPT retourne "poulet grillé"
  // Fuzzy match contre food-db.ts → trouve "Poulet" (id: chicken)
  // Auto-map + suggest au user
  ```

**3.4 Setup Stripe Payments**
- **Installation:**
  ```bash
  npm install @stripe/stripe-react-native
  expo install expo-crypto
  ```
- **Backend:** Firebase Cloud Functions (ou Vercel serverless)
  - Endpoint: `/create-subscription`
  - Produits: "AI Premium" $2.99/mois
- **UI:** `app/premium.tsx` (pricing page)

**3.5 Modèle Freemium**
- **Gratuit:**
  - Tout (logging manuel, dragon, streaks, multi-comptes)
- **Premium ($2.99/mois):**
  - IA meal parser illimité
  - (Future: Recettes suggérées, stats avancées)
- **Stockage:** Firestore `users/{userId}/subscription: {tier, expiresAt}`

**3.6 EAS Build & Déploiement**
- **iOS:**
  ```bash
  eas build --platform ios
  eas submit --platform ios
  ```
- **Android:**
  ```bash
  eas build --platform android
  eas submit --platform android
  ```
- **Config:** `eas.json` (build profiles: development, preview, production)

**3.7 Analytics & Crash Reporting**
- **Mixpanel:**
  ```bash
  npm install mixpanel-react-native
  ```
  - Événements: `meal_logged`, `dragon_evolved`, `streak_milestone`, `premium_purchased`
- **Sentry:**
  ```bash
  npm install @sentry/react-native
  ```
  - Crash tracking, performance monitoring

**3.8 Privacy & Legal**
- **Documents requis:**
  - `docs/privacy-policy.md` (GDPR/CASL Québec compliant)
  - `docs/terms-of-service.md`
  - Consent checkbox à l'inscription
- **GDPR:** Bouton "Supprimer mon compte" dans settings

---

## 📊 Architecture Technique

### Stack
- **Frontend:** React Native (Expo SDK 52)
- **Navigation:** Expo Router (file-based)
- **State:** React hooks + AsyncStorage (Phase 1-2) → Firestore (Phase 2+)
- **Auth:** Firebase Auth
- **Database:** Firestore
- **Payments:** Stripe
- **AI:** OpenAI GPT-4 API
- **Build:** EAS Build
- **Analytics:** Mixpanel + Sentry

### Structure Fichiers Clés
```
toki-app/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Home screen (view/add meals)
│   │   ├── explore.tsx         # (À repurposer: Streak calendar?)
│   │   └── _layout.tsx         # Tab navigation
│   ├── auth/                   # (Phase 2) Login/signup
│   ├── onboarding.tsx          # (Phase 1) Setup initial
│   ├── ai-logger.tsx           # (Phase 3) AI meal parser
│   ├── premium.tsx             # (Phase 3) Paywall
│   └── _layout.tsx             # Root layout
├── lib/
│   ├── food-db.ts              # 100+ food items database
│   ├── stats.ts                # Points, streaks, scores logic
│   ├── nutrition.ts            # Macro calculations
│   ├── points-calculator.ts    # (Phase 1) Dynamic points
│   ├── ai-meal-parser.ts       # (Phase 3) GPT integration
│   └── food-search.ts          # Fuzzy search
├── components/
│   ├── dragon-display.tsx      # (Phase 2) Dragon sprite + animations
│   └── ui/                     # Reusable components
├── assets/
│   └── images/
│       └── dragon/             # (Phase 2) 12 sprites
└── firebase.config.ts          # (Phase 2) Firebase setup
```

---

## 🧮 Système Points — Spécifications Détaillées

### Calcul Points/Jour (Post-Phase 1)

**Variables:**
- `weekly_cal_target` : Objectif calorique hebdomadaire (user input)
- `indulgence_ratio` : 30% (portion du budget pour indulgences)
- `avg_cal_per_point` : 80 kcal (moyenne coût énergétique par point)

**Formule:**
```typescript
const daily_indulgence_budget = (weekly_cal_target * indulgence_ratio) / 7;
const points_per_day = Math.round(daily_indulgence_budget / avg_cal_per_point);
const max_cap = Math.min(points_per_day * 4, 12); // Cap à 12 max
```

**Exemples:**
| Objectif | Weekly Cal | Daily Indulgence | Points/Jour | Cap |
|----------|-----------|------------------|-------------|-----|
| Maintenance | 17,500 | 750 | 9 | 12 |
| -1 lb/sem | 15,000 | 640 | 8 | 12 |
| -2 lbs/sem | 12,500 | 535 | 6 | 12 |
| -3 lbs/sem | 10,500 | 450 | 5 | 12 |

### Coûts Alimentaires (Post-Phase 1)

**Catégories:**
- **0 points:** Protéines maigres, légumes, fruits
- **1 point:** Staples sains (riz brun, quinoa, avoine) ~100-150 cal
- **2-3 points:** Produits laitiers, sauces, jus ~150-250 cal
- **4-6 points:** Fast-food modéré (pizza, frites, wings) ~300-450 cal
- **7-10 points:** Indulgences lourdes (poutine complète, burger deluxe) ~500-900 cal

---

## 🎮 Dragon System — Progression

### Niveaux & Unlock
- **Level 0:** Œuf (défaut pour nouveaux users)
- **Level 1-12:** Évolutions tous les 30 jours de streak continu
- **Bonus:** +1 pt tous les 7 jours, +3 pts à chaque évolution

### Moods
- **Normal:** Dernière meal ≤ 2 jours
- **Inquiet:** 2-4 jours sans meal (affiche recommendations)
- **Critique:** 5+ jours (notifications urgentes)

---

## 🗓️ Timeline Estimée

| Phase | Semaines | Livrable Principal | Milestone |
|-------|----------|-------------------|-----------|
| **Phase 1** | 3-4 | Onboarding + Points dynamiques | Beta interne testable |
| **Phase 2** | 3-4 | Auth + Dragon visuel | MVP multi-users |
| **Phase 3** | 2-3 | IA + Production | v1.0 App Stores |
| **TOTAL** | **8-11 sem** | App complète gratuite + IA premium | 🚀 Launch public |

---

## 🚧 Issues Connus (à Fixer en Phase 1)

1. **Dairy servings non-tracké** : lib/nutrition.ts manque la somme des `dairy_serving`
2. **Points/calories incohérents** : Staples 1-pt coûtent 200-270 cal (devrait être ~100-150)
3. **Pas de validation inputs** : User peut entrer targets négatifs
4. **AsyncStorage migration** : Faut gérer migration v1 → Firestore sans perte données

---

## 📝 Notes de Développement

### Quick Start (Dev Actuel)

```bash
npm install
npx expo start
```

### Conventions Code
- **TypeScript strict mode** activé
- **Naming:** camelCase (variables), PascalCase (components), kebab-case (fichiers)
- **Comments:** Expliquer le "pourquoi" pas le "quoi"
- **Types:** Exporter depuis `lib/types.ts` (à créer)

### Décisions UI (trace)
- Le calendrier Heatmap des streaks n’apparaît plus sur la Home. Il est affiché uniquement sur l’écran **Stats/Streak**, accessible via le bouton « Streak ». Objectif: éviter la redondance visuelle et concentrer la Home sur l’ajout/consultation rapide.

### Testing (À Ajouter)
- **Unit tests:** Jest pour `lib/` functions
- **E2E:** Detox pour flows critiques (onboarding, meal logging)
- **Manual QA:** TestFlight beta avant release

---

## 🤝 Contribution

**Actuellement:** Projet personnel (non open-source pour l'instant)

**Roadmap future:**
- Open-source post-v1.0
- Community food database (items soumis par users)
- Traductions (EN, ES)

---

## 📄 License

**Propriétaire** — © 2025 Toki App. Tous droits réservés.

---

## 🔗 Ressources

- **Design Inspirations:** Duolingo (streaks), MyFitnessPal (nutrition), Habitica (gamification)
- **Food Data Sources:** Santé Canada, USDA FoodData Central
- **Québec Specialties:** Research culinaire local (cabane à sucre, poutineries)

---

**Dernière mise à jour:** 25 décembre 2025  
**Version:** 0.9 (Prototype) → v1.0 (Q1 2026)
