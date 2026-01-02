# Diagnostic - Emails de Vérification Non Reçus

## 🔍 Problème

L'utilisateur ne reçoit pas les emails de vérification Firebase, même si Firebase indique que l'envoi a réussi.

## ✅ Vérifications à Faire

### 1. Vérifier les Logs de la Console

Ouvrez la console du navigateur (F12) et cherchez les logs qui commencent par `[Firebase Auth]` :

- Si vous voyez `✅ Email de vérification envoyé avec succès` : Firebase a bien envoyé l'email
- Si vous voyez `❌ ERREUR` : Il y a un problème côté Firebase

### 2. Vérifier Firebase Console

1. **Authentication > Templates**
   - Vérifiez que le template "Email address verification" est activé
   - Vérifiez le contenu du template
   - Vérifiez que l'URL de redirection est correcte

2. **Usage and Billing**
   - Vérifiez les quotas d'emails (limite par jour)
   - Si la limite est atteinte, Firebase arrête d'envoyer des emails silencieusement

3. **Authentication > Users**
   - Vérifiez que l'utilisateur existe
   - Vérifiez que `emailVerified` est bien `false`

### 3. Vérifier votre Boîte Email

1. **Dossier SPAM/COURRIER INDÉSIRABLE**
   - Les emails Firebase peuvent être filtrés comme spam
   - Cherchez un email de "noreply@" ou avec le nom de votre projet Firebase

2. **Filtres Email**
   - Vérifiez vos filtres de boîte de réception
   - Vérifiez les règles de sécurité de votre fournisseur email

3. **Délai de Livraison**
   - Les emails peuvent prendre quelques minutes à arriver
   - Attendez 5-10 minutes avant de réessayer

### 4. Codes d'Erreur Firebase Courants

- **`auth/too-many-requests`** : Trop d'emails envoyés récemment
  - **Solution** : Attendre 15-30 minutes avant de réessayer
  
- **`auth/user-not-found`** : L'utilisateur n'existe pas encore
  - **Solution** : Vérifier que la création du compte a bien réussi

- **`auth/invalid-email`** : Format d'email invalide
  - **Solution** : Vérifier le format de l'adresse email

### 5. Vérifier les Quotas Firebase

Firebase a des limites sur le nombre d'emails envoyés :

- **Spark (gratuit)** : ~100 emails/jour
- **Blaze (payant)** : Plus élevé selon l'utilisation

Si vous avez atteint la limite, Firebase peut arrêter d'envoyer des emails sans erreur visible.

### 6. Problèmes Spécifiques par Fournisseur Email

- **Gmail** : Vérifiez le dossier "Tous les messages" et les filtres
- **Outlook/Hotmail** : Vérifiez le dossier "Courrier indésirable"
- **Yahoo** : Vérifiez le dossier "Spam"
- **Entreprises** : Vérifiez avec votre administrateur IT si les emails Firebase sont bloqués

## 🛠️ Solutions

### Solution 1 : Renvoyer l'Email

Utilisez le bouton "Renvoyer l'email" dans l'interface. Les logs détaillés s'afficheront dans la console.

### Solution 2 : Vérifier Firebase Console

1. Allez dans Firebase Console > Authentication > Templates
2. Vérifiez que le template est bien configuré
3. Testez l'envoi depuis la console Firebase

### Solution 3 : Augmenter les Quotas

Si vous êtes sur le plan Spark (gratuit), passez au plan Blaze (payant) pour avoir plus de quotas d'emails.

### Solution 4 : Utiliser un Domaine Personnalisé

Configurez un domaine personnalisé pour les emails Firebase dans Firebase Console > Authentication > Templates > Email address verification > Customize domain.

## 📝 Logs Détaillés

Avec la version 1.0.77+, les logs incluent :
- Confirmation d'envoi avec détails
- Codes d'erreur Firebase spécifiques
- Messages d'aide pour diagnostic
- Vérifications de quotas et limites

## 🔗 Références

- [Firebase Auth Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Firebase Auth Limits](https://firebase.google.com/docs/auth/limits)
- [Troubleshooting Email Delivery](https://support.google.com/firebase/answer/9138473)
