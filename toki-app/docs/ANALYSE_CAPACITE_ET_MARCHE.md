# Analyse de Capacité et Marché - FeedToki Québec

## 📊 Capacité Actuelle du Setup

### Firebase Free Tier (Spark Plan)

**Limites gratuites Firebase:**
- **Firestore:**
  - 50,000 reads/jour
  - 20,000 writes/jour
  - 20,000 deletes/jour
  - 1 GB stockage
- **Authentication:**
  - Illimité (gratuit)
- **Hosting:**
  - 10 GB stockage
  - 360 MB/jour transfert
- **Cloud Functions:**
  - 2 millions invocations/mois
  - 400,000 GB-secondes compute time
  - 5 GB sortie réseau

### Estimation Utilisation par Utilisateur Actif

**Par jour (utilisateur actif):**
- **Firestore Reads:** ~50-100 reads/jour
  - Chargement profil: 1 read
  - Chargement repas (30 jours): ~30 reads
  - Chargement points: ~5 reads
  - Chargement targets: ~2 reads
  - Sync operations: ~10-50 reads
- **Firestore Writes:** ~10-30 writes/jour
  - Ajout repas: 1 write
  - Mise à jour points: ~5 writes
  - Sync operations: ~5-20 writes
- **OpenAI API:** Max 50 appels/jour (limité par code)
  - Coût: ~$0.01-0.02 par appel (GPT-4o-mini)
  - Coût max/jour/utilisateur: ~$0.50-1.00

**Calcul Capacité Firebase Free Tier:**

```
Firestore Reads: 50,000 / 100 = 500 utilisateurs actifs/jour max
Firestore Writes: 20,000 / 30 = 666 utilisateurs actifs/jour max
```

**Conclusion:** ~500 utilisateurs actifs/jour peuvent être supportés avec le plan gratuit Firebase.

### Coûts OpenAI

**Scénario 1: 10 utilisateurs beta (gratuits à vie)**
- Utilisation moyenne: 10 appels/jour/utilisateur (pas tous utilisent l'IA à chaque repas)
- Coût/jour: 10 × 10 × $0.015 = **$1.50/jour**
- Coût/mois: **$45/mois** ✅ (gérable avec budget limité)

**Scénario 2: 200 utilisateurs (10 beta + 190 payants)**
- Beta (10): 10 appels/jour = $1.50/jour
- Payants (190): 20 appels/jour = $57/jour
- **Total: $58.50/jour = $1,755/mois**
- **Revenus:** 190 × $10 = $1,900/mois
- **Profit:** $145/mois ✅

**Scénario 3: 500 utilisateurs (10 beta + 490 payants)**
- Beta (10): 10 appels/jour = $1.50/jour
- Payants (490): 20 appels/jour = $147/jour
- **Total: $148.50/jour = $4,455/mois**
- **Revenus:** 490 × $10 = $4,900/mois
- **Profit:** $445/mois ✅

### Recommandation: Nombre de Beta Users Gratuits

**10 utilisateurs gratuits à vie = ADAPTÉ AU BUDGET** ✅

**Raisons:**
1. **Coût gérable:** $45/mois pour 10 beta users (10 × 10 appels/jour × $0.015 = $4.50/jour)
2. **Budget limité:** Respecte contrainte chômage
3. **Feedback critique:** 10 beta testeurs = feedback suffisant pour MVP
4. **Firebase:** 10 utilisateurs = ~1,000 reads/jour (2% de la limite gratuite)

**Modèle après beta:**
- **Pas de mois gratuit** - Utilisateurs paient directement pour utiliser l'IA
- **Pricing:** $10/mois pour accès IA (couvre coûts OpenAI + marge)
- **Alternative:** Pay-per-use (ex: $0.50 par analyse IA, minimum $5/mois)

---

## 🇨🇦 Analyse de Marché - Québec

### TAM (Total Addressable Market) - Canada

**Population cible:**
- Canada: ~38M habitants
- Québec: ~8.5M habitants (22% du Canada)
- Adultes 18-65 ans: ~5.5M au Québec

**Marché nutrition/fitness tracking:**
- Taux d'adoption apps fitness: ~25% des adultes
- Marché adressable Québec: **1.4M personnes**

### SAM (Serviceable Addressable Market) - Québec

**Segment spécifique:**
- Personnes intéressées par tracking nutrition avec gamification
- Budget pour app premium: ~10-15% du marché
- **SAM Québec: ~140,000-210,000 personnes**

### SOM (Serviceable Obtainable Market) - Année 1

**Objectif réaliste:**
- 0.1-0.5% du SAM (avec marketing limité)
- **SOM Année 1: 140-1,050 utilisateurs payants**

**Projection conservatrice:**
- Mois 1-3: 50 beta testeurs
- Mois 4-6: 100-200 utilisateurs payants
- Mois 7-12: 200-500 utilisateurs payants
- **Total fin année 1: 300-700 utilisateurs**

### Concurrence au Québec

**Apps principales:**
1. **MyFitnessPal** (gratuit avec pub, premium $10/mois)
   - Avantage: Base de données massive
   - Faiblesse: UX complexe, pas de gamification
2. **Lose It!** ($40/an)
   - Avantage: Simple, efficace
   - Faiblesse: Pas de gamification dragon
3. **Noom** ($60/mois)
   - Avantage: Coaching psychologique
   - Faiblesse: Très cher, pas de tracking simple
4. **Yazio** (gratuit, premium $10/mois)
   - Avantage: Interface moderne
   - Faiblesse: Pas de gamification

**Avantage compétitif FeedToki:**
- ✅ Gamification unique (dragon)
- ✅ IA meal logger (concurrentiel)
- ✅ Système de points simple
- ✅ Interface en français québécois
- ✅ Prix compétitif ($10/mois)

### Pricing au Québec

**Analyse concurrentielle:**
- MyFitnessPal Premium: $10/mois
- Lose It!: $3.33/mois (annuel)
- Noom: $60/mois
- Yazio: $10/mois

**Recommandation:**
- **$10 CAD/mois** = Positionnement premium mais accessible
- Alternative: **$8 CAD/mois** pour lancement (promotion)

---

## 🗺️ Roadmap d'Expansion

### Phase 1: Beta Test (Mois 1-2)
**Objectif:** Valider product-market fit avec 10 beta testeurs

**Actions:**
- [ ] Recruter 10 beta testeurs (réseaux sociaux, Reddit r/loseit, r/nutrition)
- [ ] Collecter feedback structuré (Google Form)
- [ ] Fixer bugs critiques
- [ ] Optimiser UX basé sur retours

**Métriques:**
- Engagement: >50% loggent ≥1 repas/jour
- Rétention jour 7: >60%
- Rétention jour 14: >40%
- NPS (Net Promoter Score): >30

**Coûts:**
- Firebase: Gratuit (dans limites)
- OpenAI: ~$45/mois (10 users × 10 appels/jour)
- **Total: ~$45/mois** ✅ (gérable avec budget limité)

### Phase 2: Lancement Public Québec (Mois 3-6)
**Objectif:** 100-200 utilisateurs payants

**Actions Marketing:**
1. **Content Marketing:**
   - Blog posts nutrition (SEO)
   - Posts Instagram/TikTok (demos, tips)
   - YouTube: Tutoriel app

2. **Partenariats:**
   - Influenceurs fitness québécois (micro-influenceurs 10K-50K followers)
   - Gyms locaux (offrir app gratuit pour membres)
   - Nutritionnistes (partenariat B2B)

3. **Publicité:**
   - Facebook/Instagram Ads (ciblage: 25-45 ans, intérêt fitness/nutrition)
   - Budget: $500-1000/mois
   - CAC cible: <$30

4. **App Store Optimization:**
   - Optimiser description (mots-clés: nutrition, tracking, gamification)
   - Screenshots attrayants
   - Vidéo demo

**Pricing:**
- 10 premiers: Gratuit à vie (beta)
- Nouveaux: **Paiement direct requis** - $10/mois pour accès IA
- **Pas de mois gratuit** (pour couvrir coûts OpenAI immédiatement)
- Promotion lancement: Code "-20% premiers 50" = $8/mois (optionnel)

**Projection:**
- Mois 3: 20 nouveaux utilisateurs payants
- Mois 4: 30 nouveaux
- Mois 5: 40 nouveaux
- Mois 6: 50 nouveaux
- **Total: 140 utilisateurs payants**

**Revenus:**
- 140 × $10 = $1,400/mois MRR
- Mois 3-6 cumulé: ~$4,200

**Coûts:**
- Firebase: Gratuit (si <500 users actifs/jour)
- OpenAI: ~$840/mois (140 payants × 20 appels/jour + 10 beta × 10)
- Marketing: $500/mois
- **Total: ~$1,340/mois**

**Profit:** ~$60/mois ✅ (positif dès le début!)

### Phase 3: Scaling Québec (Mois 7-12)
**Objectif:** 300-500 utilisateurs payants

**Actions:**
1. **Améliorer rétention:**
   - Notifications push (rappels repas)
   - Emails hebdomadaires (stats, conseils)
   - Défis hebdomadaires

2. **Features premium additionnelles:**
   - Stats avancées (graphiques détaillés)
   - Export données (CSV/PDF)
   - Recettes personnalisées IA

3. **Marketing:**
   - Augmenter budget pub: $1,000-1,500/mois
   - Partenariats gyms (programme de référence)
   - Webinaires nutrition (lead generation)

**Projection:**
- Mois 7-9: +150 utilisateurs
- Mois 10-12: +200 utilisateurs
- **Total: 490 utilisateurs payants**

**Revenus:**
- 490 × $10 = $4,900/mois MRR
- Année 1 cumulé: ~$25,000

**Coûts:**
- Firebase: Peut nécessiter Blaze Plan ($25/mois base + usage)
- OpenAI: ~$2,940/mois (490 payants × 20 appels/jour + 10 beta × 10)
- Marketing: $1,200/mois
- **Total: ~$4,165/mois**

**Profit:** ~$735/mois ✅ (meilleure marge!)

### Phase 4: Expansion Canada (Année 2)
**Objectif:** 1,000-2,000 utilisateurs payants (Canada-wide)

**Actions:**
1. **Expansion géographique:**
   - Marketing Ontario (Toronto, Ottawa)
   - Marketing Colombie-Britannique (Vancouver)
   - Support anglais (traduction app)

2. **Features avancées:**
   - Intégrations (Apple Health, Google Fit)
   - Mode famille (multi-comptes)
   - Coaching IA personnalisé

3. **Partenariats:**
   - Chaînes de gyms nationales
   - Services de livraison repas (partenariat)

**Projection:**
- Fin année 2: 1,500 utilisateurs payants
- Revenus: $15,000/mois MRR
- Profit: ~$8,000/mois

---

## 💰 Modèle Financier Simplifié

### Année 1 (Québec seulement)

**Revenus:**
- Mois 1-2: $0 (beta)
- Mois 3-6: $1,400/mois (140 users)
- Mois 7-12: $4,900/mois (490 users)
- **Total année 1: ~$25,000**

**Coûts:**
- Mois 1-2: $45/mois (OpenAI beta)
- Mois 3-6: $1,340/mois (OpenAI + marketing)
- Mois 7-12: $4,165/mois (OpenAI + marketing + Firebase)
- **Total année 1: ~$18,000**

**Profit année 1: ~$7,000** ✅ (meilleure marge sans mois gratuit)

### Année 2 (Canada-wide)

**Revenus:**
- Fin année 2: $15,000/mois (1,500 users)
- **Total année 2: ~$120,000**

**Coûts:**
- OpenAI: ~$5,000/mois
- Marketing: $2,000/mois
- Firebase: $100/mois
- **Total: ~$7,100/mois = ~$85,000/an**

**Profit année 2: ~$35,000**

---

## ⚠️ Risques et Mitigations

### Risque 1: Coûts OpenAI explosent
**Mitigation:**
- Limite stricte: 50 appels/jour/utilisateur (déjà implémenté)
- Cache résultats IA (éviter appels redondants)
- Fallback parser basique si limite atteinte
- Monitoring coûts quotidien

### Risque 2: Churn élevé (>10%/mois)
**Mitigation:**
- Onboarding amélioré (tutoriel interactif)
- Emails de réactivation avant expiration trial
- Features qui créent habitude (notifications, streaks)
- Support client réactif

### Risque 3: Concurrence agressive
**Mitigation:**
- Focus sur différenciation (gamification dragon)
- Community building (groupe Facebook, Discord)
- Amélioration continue basée sur feedback
- Pricing compétitif mais pas dumping

### Risque 4: Firebase dépasse free tier
**Mitigation:**
- Optimiser queries (indexes, pagination)
- Cache côté client (AsyncStorage)
- Monitoring usage quotidien
- Plan Blaze = $25/mois base (gérable)

---

## ✅ Recommandations Finales

### Nombre Beta Users Gratuits
**✅ 10 utilisateurs gratuits à vie = ADAPTÉ AU BUDGET**

**Justification:**
- Coût gérable: $45/mois max (respecte budget limité)
- Valeur marketing: 10 early adopters = feedback critique
- Feedback suffisant pour MVP
- Firebase supporte facilement (2% de capacité)

### Modèle Pricing Après Beta
**✅ Paiement direct requis - Pas de mois gratuit**

**Raisons:**
- Couvre immédiatement coûts OpenAI
- Évite pertes financières sur utilisateurs non-convertis
- Filtre utilisateurs sérieux (meilleure qualité)
- Profit positif dès le début

### Pricing
**✅ $10 CAD/mois** (après 1 mois gratuit)
- Positionnement premium mais accessible
- Compétitif avec MyFitnessPal/Yazio
- Marge suffisante pour couvrir coûts OpenAI

### Roadmap Priorités
1. **Immédiat (Mois 1-2):** Beta test, fix bugs, optimiser UX
2. **Court terme (Mois 3-6):** Marketing Québec, atteindre 100-200 users payants
3. **Moyen terme (Mois 7-12):** Scaling Québec, features premium, 300-500 users
4. **Long terme (Année 2):** Expansion Canada, 1,000-2,000 users

### Métriques Clés à Suivre
- **Engagement:** % utilisateurs actifs/jour (cible: >50%)
- **Rétention:** Jour 7 (cible: >60%), Jour 30 (cible: >40%)
- **Conversion:** Free trial → Paid (cible: 20-30%)
- **Churn:** Taux annulation/mois (cible: <5%)
- **CAC:** Coût acquisition client (cible: <$30)
- **LTV:** Lifetime value (cible: >$120 = 12 mois)

---

**Dernière mise à jour:** Janvier 2025
