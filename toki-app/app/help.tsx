// Écran Help/FAQ pour la documentation utilisateur

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { router } from 'expo-router';

const FAQ_ITEMS = [
  {
    id: 'points',
    question: 'Comment fonctionne le système de points?',
    answer: 'Tu reçois un budget de points chaque jour (généralement 3-12 points selon ton objectif). Les aliments sains (protéines maigres, légumes) coûtent 0-1 point, tandis que les aliments indulgents (poutine, pizza, frites) coûtent plus cher (4-10 points). Rien n\'est interdit - tu gères ton budget comme de l\'argent!',
  },
  {
    id: 'dragon',
    question: 'Comment fonctionne l\'évolution du dragon?',
    answer: 'Toki évolue tous les 30 jours de streak continu. Il y a 12 niveaux au total. Chaque évolution débloque de nouveaux visuels. Plus tu nourris Toki régulièrement, plus il évolue!',
  },
  {
    id: 'streak',
    question: 'Qu\'est-ce qu\'un streak?',
    answer: 'Un streak = jours consécutifs où tu as mangé au moins 800 calories. Il y a des bonus tous les 7 jours de streak et un bonus spécial tous les 30 jours (évolution).',
  },
  {
    id: 'dragon-state',
    question: 'Quels sont les états du dragon?',
    answer: '🐉 Normal: Dernier repas il y a moins de 2 jours\n😟 Inquiet: 2-4 jours sans repas complet\n😰 Critique: 5+ jours sans repas complet',
  },
  {
    id: 'logging-manual',
    question: 'Comment logger un repas manuellement?',
    answer: '1. Clique sur "Partager avec Toki"\n2. Tape ou sélectionne les aliments que tu as mangés\n3. Choisis les portions\n4. Confirme - les points sont déduits automatiquement',
  },
  {
    id: 'logging-ai',
    question: 'Comment utiliser l\'IA pour logger un repas?',
    answer: '1. Clique sur "🧠 Log avec IA"\n2. Décris ce que tu as mangé en texte naturel (ex: "Cet après-midi j\'ai mangé un beef stick et une pomme")\n3. L\'IA détecte automatiquement les aliments\n4. Vérifie les détections et confirme\n\nAstuce: Sois précis dans ta description pour de meilleurs résultats!',
  },
  {
    id: 'change-goal',
    question: 'Comment changer mon objectif de poids?',
    answer: 'Pour changer ton objectif, tu dois compléter à nouveau l\'onboarding. Va dans les paramètres et sélectionne "Réinitialiser mon profil" ou contacte le support si cette option n\'est pas disponible.',
  },
  {
    id: 'missing-food',
    question: 'Que faire si un aliment n\'est pas dans la base de données?',
    answer: '1. Lors du logging, clique sur "Demander un ajout"\n2. Remplis le formulaire avec les informations de l\'aliment\n3. L\'aliment sera ajouté à la base de données après validation',
  },
  {
    id: 'ai-issues',
    question: 'L\'IA ne détecte pas correctement mes aliments',
    answer: 'Sois plus précis dans ta description et mentionne les quantités si tu les connais. Tu peux toujours utiliser le mode manuel si l\'IA échoue.',
  },
  {
    id: 'targets',
    question: 'Comment ajuster mes objectifs nutritionnels?',
    answer: '1. Clique sur l\'icône ⚙️ à côté de "Objectifs du jour"\n2. Modifie les valeurs (protéines, glucides, calories, lipides)\n3. Sauvegarde\n\nValidation: Les valeurs doivent être raisonnables (Calories: 500-10000 kcal/jour, Protéines: 0-500 g, Glucides: 0-1000 g, Lipides: 0-500 g)',
  },
  {
    id: 'backup',
    question: 'Comment restaurer mes données si je les perds?',
    answer: 'Si Firebase est activé, tes données sont automatiquement restaurées à la connexion. Si problème, contacte le support. Sans Firebase, les données locales ne peuvent pas être restaurées si perdues. Il est recommandé d\'activer Firebase pour la sauvegarde cloud.',
  },
  {
    id: 'sync',
    question: 'Comment fonctionne la synchronisation?',
    answer: 'Si tu as activé Firebase, toutes tes données sont sauvegardées dans le cloud automatiquement. Tu peux accéder à tes données depuis n\'importe quel appareil. Sans Firebase, les données sont stockées localement sur ton appareil uniquement.',
  },
];

export default function HelpScreen() {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Aide & FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Bienvenue dans le centre d'aide de Toki! 🐉
          </Text>
          <Text style={styles.introSubtext}>
            Tu trouveras ici les réponses aux questions les plus fréquentes.
          </Text>
        </View>

        {FAQ_ITEMS.map((item) => (
          <View key={item.id} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqQuestion}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <Text style={styles.faqQuestionText}>{item.question}</Text>
              <Text style={styles.expandIcon}>{expandedId === item.id ? '−' : '+'}</Text>
            </TouchableOpacity>
            {expandedId === item.id && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{item.answer}</Text>
              </View>
            )}
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besoin d'aide supplémentaire?</Text>
          <Text style={styles.sectionText}>
            Consulte le guide utilisateur complet ou contacte le support si tu as besoin d'assistance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#4ECDC4',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 70,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  intro: {
    marginBottom: 30,
    padding: 20,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  introText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  introSubtext: {
    fontSize: 14,
    color: '#666',
  },
  faqItem: {
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 12,
  },
  expandIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
    width: 30,
    textAlign: 'center',
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginTop: 12,
  },
  section: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

