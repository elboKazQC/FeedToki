# Modèle Pricing Final - FeedToki

## 🎯 Modèle de Pricing Adapté au Budget

### Beta Testeurs
**10 utilisateurs gratuits à vie** (au lieu de 50)

**Justification:**
- Coût: **$45/mois** (10 × 10 appels/jour × $0.015 = $1.50/jour)
- Respecte budget limité (chômage)
- Feedback suffisant pour MVP
- Firebase supporte facilement (2% de capacité)

### Utilisateurs Après Beta
**Paiement direct requis - PAS de mois gratuit**

**Raisons:**
1. **Couvre immédiatement coûts OpenAI** - Pas de pertes financières
2. **Filtre utilisateurs sérieux** - Meilleure qualité, moins de churn
3. **Profit positif dès le début** - Pas d'investissement négatif
4. **Modèle durable** - Chaque utilisateur payant couvre ses coûts

### Pricing Structure

**Option 1: Abonnement Mensuel (Recommandé)**
- **$10 CAD/mois** pour accès IA illimité (50 appels/jour max)
- Avantage: Revenus récurrents prévisibles
- Marge: $10 - $0.30 (coût OpenAI/jour) = **$9.70 profit/utilisateur/mois**

**Option 2: Pay-Per-Use (Alternative)**
- **$0.50 par analyse IA** (minimum $5/mois)
- Avantage: Utilisateurs occasionnels paient moins
- Inconvénient: Revenus moins prévisibles

**Recommandation:** **Option 1 (Abonnement $10/mois)**

## 💰 Projections Financières Révisées

### Phase 1: Beta Test (Mois 1-2)
- **10 beta testeurs gratuits**
- **Coûts:** $45/mois (OpenAI)
- **Revenus:** $0
- **Profit:** -$45/mois (investissement)

### Phase 2: Lancement (Mois 3-6)
- **10 beta + 140 payants**
- **Revenus:** 140 × $10 = $1,400/mois
- **Coûts:** 
  - OpenAI: $840/mois (140 × 20 appels/jour + 10 beta × 10)
  - Marketing: $500/mois
  - **Total: $1,340/mois**
- **Profit: $60/mois** ✅

### Phase 3: Scaling (Mois 7-12)
- **10 beta + 490 payants**
- **Revenus:** 490 × $10 = $4,900/mois
- **Coûts:**
  - OpenAI: $2,940/mois
  - Marketing: $1,200/mois
  - Firebase: $25/mois (Blaze Plan)
  - **Total: $4,165/mois**
- **Profit: $735/mois** ✅

### Année 1 Totale
- **Revenus:** ~$25,000
- **Coûts:** ~$18,000
- **Profit: ~$7,000** ✅

## 🎨 Implémentation Technique

### Système de Subscription

**Structure Firestore:**
```
/users/{userId}
  subscription: {
    tier: 'beta' | 'paid' | 'expired'
    status: 'active' | 'trialing' | 'past_due' | 'canceled'
    subscriptionStartDate?: string
    subscriptionEndDate?: string
    stripeCustomerId?: string
    stripeSubscriptionId?: string
  }
```

**Logique:**
1. **10 premiers utilisateurs** (rank ≤ 10): `tier: 'beta'`, accès gratuit à vie
2. **Utilisateurs suivants:** Doivent payer immédiatement pour utiliser l'IA
3. **Vérification:** Avant chaque appel IA, vérifier `hasActiveSubscription(userId)`

### Protection IA Meal Logger

**Dans `app/ai-logger.tsx`:**
```typescript
// Au début du composant
const hasAccess = await hasActiveSubscription(userId);
if (!hasAccess) {
  // Afficher modal paywall
  // Rediriger vers /subscription
  return;
}
```

**Modal Paywall:**
- Message: "L'analyse IA nécessite un abonnement pour couvrir les coûts OpenAI"
- Bouton: "S'abonner maintenant ($10/mois)"
- Lien: "En savoir plus" → `/subscription`

## 📊 Comparaison Modèles

| Modèle | Beta Users | Mois Gratuit | Profit Mois 3-6 | Profit Mois 7-12 |
|--------|-----------|--------------|------------------|------------------|
| **Original (50 beta + 1 mois gratuit)** | 50 | Oui | -$100/mois | $400/mois |
| **Révisé (10 beta + paiement direct)** | 10 | Non | **$60/mois** ✅ | **$735/mois** ✅ |

**Avantage modèle révisé:**
- ✅ Profit positif dès le début
- ✅ Pas de pertes sur utilisateurs non-convertis
- ✅ Budget gérable ($45/mois beta)
- ✅ Meilleure marge long terme

## ✅ Checklist Implémentation

### Technique
- [ ] Modifier `lib/subscription-utils.ts` pour détecter 10 premiers (au lieu de 50)
- [ ] Supprimer logique "free trial" (pas de mois gratuit)
- [ ] Protéger IA meal logger avec paywall strict
- [ ] Créer écran `/subscription` avec pricing clair
- [ ] Intégrer Stripe Checkout (paiement direct)

### Marketing
- [ ] Mettre à jour landing page (pas de "1 mois gratuit")
- [ ] Communiquer clairement: "Paiement requis pour IA"
- [ ] Créer FAQ: "Pourquoi pas de mois gratuit?" (couvrir coûts OpenAI)
- [ ] Mettre en avant: "10 premiers beta testeurs = gratuit à vie"

### Légale
- [ ] Mettre à jour Terms of Service (pricing)
- [ ] Mettre à jour Privacy Policy (mention Stripe)
- [ ] Politique remboursement (7 jours?)

---

**Dernière mise à jour:** Janvier 2025
**Version:** 2.0 (Adapté au budget)
