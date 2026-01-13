import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { spacing, typography } from '../constants/design-tokens';

export default function PrivacyPolicyScreen() {
  const { activeTheme } = useTheme();
  const colors = Colors[activeTheme];
  const colorValue = (c: any): string => (typeof c === 'string' ? c : (c && typeof c.primary === 'string' ? c.primary : String(c)) );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colorValue(colors.background) }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={[styles.backButtonText, { color: colorValue(colors.tint) }]}>← Retour</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colorValue(colors.text) }]}>🔒 Politique de Confidentialité</Text>
        </View>

        <Text style={[styles.lastUpdated, { color: colors.text.secondary }]}>
          Dernière mise à jour : 27 janvier 2025
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>1. Introduction</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            FeedToki ("nous", "notre", "l'application") respecte votre vie privée et s'engage à protéger vos données personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons, stockons et protégeons vos informations lorsque vous utilisez notre application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>2. Données Collectées</Text>
          <Text style={[styles.subsectionTitle, { color: colors.text.primary }]}>2.1 Données Personnelles</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Nous collectons : email, nom d'affichage (optionnel), poids, objectifs, niveau d'activité, repas consommés, aliments, quantités, valeurs nutritionnelles, points quotidiens, streaks, évolution du dragon, données techniques (type d'appareil, OS, navigateur).
          </Text>
          <Text style={[styles.subsectionTitle, { color: colors.text.primary }]}>2.2 Données Non Collectées</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Nous ne collectons pas votre position géographique, vos contacts, vos photos (sauf téléchargement volontaire), ni vos paiements (si applicable, via processeur tiers sécurisé).
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>3. Utilisation des Données</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Nous utilisons vos données pour : calculer vos besoins nutritionnels, suivre vos repas et points, afficher vos statistiques, synchroniser entre appareils, améliorer l'application, analyser l'utilisation (anonymisé), corriger les bugs, développer de nouvelles fonctionnalités, et vous informer des mises à jour importantes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>4. Partage des Données</Text>
          <Text style={[styles.subsectionTitle, { color: colors.text.primary }]}>4.1 Services Tiers</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            • Firebase (Google) : Stockage, authentification, analytics{'\n'}
            • OpenAI : Analyse des descriptions de repas (texte seulement, aucune donnée personnelle){'\n'}
            • Sentry : Monitoring d'erreurs (données techniques seulement)
          </Text>
          <Text style={[styles.subsectionTitle, { color: colors.text.primary }]}>4.2 Partage avec D'autres Utilisateurs</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Les aliments personnalisés que vous ajoutez peuvent être partagés avec tous les utilisateurs (nom et valeurs nutritionnelles seulement).
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>5. Sécurité des Données</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Nous utilisons le chiffrement HTTPS, l'authentification sécurisée (Firebase Auth), des règles de sécurité Firestore, et un stockage sécurisé côté serveur (Google Cloud).
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>6. Vos Droits (RGPD)</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vous avez le droit d'accéder, corriger, supprimer, exporter vos données, et vous opposer au traitement. Contactez-nous pour exercer ces droits.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>7. Conservation des Données</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vos données sont conservées tant que votre compte est actif. Après suppression, elles sont supprimées dans les 30 jours. Les logs techniques peuvent être conservés jusqu'à 90 jours.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>8. Contact</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Pour toute question concernant cette politique ou vos données, contactez-nous via l'application (écran Aide/Contact).
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text.tertiary }]}>
            Cette politique s'applique à FeedToki version 1.0.0 et supérieures.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium as any,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold as any,
    marginBottom: spacing.sm,
  },
  lastUpdated: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xl,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold as any,
    marginBottom: spacing.md,
  },
  subsectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold as any,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.normal * typography.fontSize.md,
    marginBottom: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});


