import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../lib/theme-context';
import { Colors } from '../constants/theme';
import { spacing, typography } from '../constants/design-tokens';

export default function TermsOfServiceScreen() {
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
          <Text style={[styles.title, { color: colorValue(colors.text) }]}>📜 Conditions d'Utilisation</Text>
        </View>

        <Text style={[styles.lastUpdated, { color: colorValue(colors.textSecondary) }]}>
          Dernière mise à jour : 27 janvier 2025
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>1. Acceptation des Conditions</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            En utilisant FeedToki, vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas ces Conditions, veuillez ne pas utiliser l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>2. Description du Service</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            FeedToki est une application de suivi nutritionnel gamifiee qui permet d'enregistrer vos repas, suivre vos objectifs nutritionnels, analyser vos apports, et visualiser vos statistiques.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>3. Compte Utilisateur</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vous devez créer un compte, fournir des informations exactes, maintenir la confidentialité de vos identifiants, et être responsable de toutes les activités sous votre compte. L'âge minimum est de 13 ans.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>4. Utilisation Acceptable</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vous pouvez utiliser l'application pour suivre votre nutrition. Vous ne pouvez pas l'utiliser à des fins illégales, accéder aux comptes d'autres utilisateurs, perturber le service, ou utiliser des bots.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>5. Contenu Utilisateur</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vous conservez les droits sur vos données personnelles. En ajoutant des aliments à la base globale, vous acceptez qu'ils soient partagés. Nous nous réservons le droit de supprimer tout contenu inapproprié.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>6. Propriété Intellectuelle</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            L'application et son contenu sont la propriété de FeedToki. Vous n'acquérez aucun droit de propriété en utilisant l'application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>7. Disponibilité du Service</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Nous nous efforçons de maintenir le service disponible, mais ne garantissons pas une disponibilité ininterrompue. Nous pouvons interrompre le service pour maintenance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>8. Avis Médical</Text>
          <Text style={[styles.warningText, { color: colors.warning }]}>
            IMPORTANT : FeedToki n'est pas un avis médical, diagnostic ou traitement. Consultez toujours un professionnel de la santé avant de commencer un nouveau régime.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>9. Limitation de Responsabilité</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Dans les limites permises par la loi, FeedToki ne sera pas responsable des dommages directs ou indirects. Nous ne garantissons pas l'exactitude absolue des informations nutritionnelles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>10. Résiliation</Text>
          <Text style={[styles.text, { color: colors.text.secondary }]}>
            Vous pouvez supprimer votre compte à tout moment. Nous nous réservons le droit de suspendre votre compte en cas de violation de ces Conditions.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.text.tertiary }]}>
            En utilisant FeedToki, vous reconnaissez avoir lu, compris et accepté ces Conditions d'Utilisation.
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
  text: {
    fontSize: typography.fontSize.md,
    lineHeight: typography.lineHeight.normal * typography.fontSize.md,
    marginBottom: spacing.sm,
  },
  warningText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold as any,
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


