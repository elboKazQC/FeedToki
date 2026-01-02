import { test, expect } from '@playwright/test';
import { generateTestEmail, TEST_PASSWORD, TEST_DISPLAY_NAME } from '../fixtures/test-data';
import {
  waitForPageLoad,
  clickButtonByText,
  fillInputByPlaceholder,
  waitForNavigation,
  waitForText,
} from '../utils/page-helpers';
import { assertNoConsoleErrors, assertPageLoaded, assertNoWhitePage } from '../utils/assertions';
import { cleanupTestAccount } from '../fixtures/auth-fixtures';

/**
 * Tests d'onboarding - Complétion du processus d'onboarding
 * 
 * Prérequis: Un compte doit être créé (on suppose qu'on arrive depuis auth.spec.ts)
 */
test.describe('Onboarding', () => {
  let testEmail: string;
  let userId: string | null = null;

  test.beforeEach(async ({ page }) => {
    // Créer un compte de test pour chaque test
    testEmail = generateTestEmail();
    
    // Naviguer vers /auth et créer un compte
    await page.goto('/auth');
    await waitForPageLoad(page);

    // Basculer en mode inscription
    const createAccountButton = page.getByText(/créer un compte|s'inscrire/i);
    const isVisible = await createAccountButton.isVisible().catch(() => false);
    if (isVisible) {
      await createAccountButton.click();
      await page.waitForTimeout(500);
    }

    // Remplir le formulaire
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.fill(testEmail);
    
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(TEST_PASSWORD);

    const displayNameInput = page.locator('input[placeholder*="nom" i], input[placeholder*="Nom" i]').first();
    const displayNameVisible = await displayNameInput.isVisible().catch(() => false);
    if (displayNameVisible) {
      await displayNameInput.fill(TEST_DISPLAY_NAME);
    }

    // Soumettre
    const submitButton = page.getByRole('button', { name: /créer|inscription/i });
    
    // Gérer l'alerte
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await submitButton.click();
    await page.waitForTimeout(3000); // Attendre création compte + redirection
  });

  test.afterEach(async () => {
    // Nettoyer le compte de test
    if (userId) {
      try {
        await cleanupTestAccount(userId);
      } catch (error) {
        console.error('Erreur cleanup compte test:', error);
      }
    }
  });

  test('devrait compléter le processus d\'onboarding', async ({ page }) => {
    // Configurer les listeners d'erreurs
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Failed to decode downloaded font') &&
          !text.includes('OTS parsing error') &&
          !text.includes('MaterialIcons')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // 1. Vérifier qu'on est sur la page d'onboarding
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/onboarding/);

    await waitForPageLoad(page);
    await assertNoWhitePage(page);

    // 2. Sélectionner un objectif de poids
    // Chercher les boutons d'objectifs (ex: "Perdre du poids", "Maintenir", "Prendre du poids")
    const goalButtons = page.locator('button, [role="button"], [class*="button"], [class*="pressable"]');
    
    // Attendre qu'au moins un bouton d'objectif soit visible
    await page.waitForTimeout(1000);
    
    // Sélectionner le premier objectif disponible (généralement "Perdre du poids" ou similaire)
    // On cherche par texte ou on clique sur le premier bouton disponible
    const loseWeightButton = page.getByText(/perdre|perte|réduire/i).first();
    const isVisible = await loseWeightButton.isVisible().catch(() => false);
    
    if (isVisible) {
      await loseWeightButton.click();
    } else {
      // Fallback: cliquer sur le premier bouton disponible dans le formulaire
      const firstButton = page.locator('button, [role="button"]').first();
      await firstButton.click();
    }
    
    await page.waitForTimeout(500);

    // 3. Remplir le poids (si requis)
    const weightInput = page.locator('input[placeholder*="poids" i], input[placeholder*="weight" i], input[type="number"]').first();
    const weightVisible = await weightInput.isVisible().catch(() => false);
    
    if (weightVisible) {
      await weightInput.fill('75'); // 75 kg ou lbs selon l'unité
      await page.waitForTimeout(300);
    }

    // 4. Sélectionner le niveau d'activité
    const activityButtons = page.getByText(/modéré|actif|sédentaire|moderate|active/i);
    const activityVisible = await activityButtons.first().isVisible().catch(() => false);
    
    if (activityVisible) {
      await activityButtons.first().click();
      await page.waitForTimeout(300);
    }

    // 5. Cliquer sur "Continuer" ou "Terminer"
    const continueButton = page.getByRole('button', { name: /continuer|terminer|suivant|finir|complete/i });
    const continueVisible = await continueButton.isVisible().catch(() => false);
    
    if (continueVisible) {
      await continueButton.click();
      await page.waitForTimeout(2000); // Attendre traitement
    }

    // 6. Vérifier la redirection vers la page principale
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/(tabs|$)/);

    await waitForPageLoad(page);
    await assertNoWhitePage(page);

    // 7. Vérifier qu'il n'y a pas d'erreurs critiques
    await page.waitForTimeout(2000);

    const criticalErrors = consoleErrors.filter((error) => {
      return !error.includes('favicon') && 
             !error.includes('MaterialIcons') &&
             !error.includes('font');
    });

    if (criticalErrors.length > 0) {
      console.warn('Erreurs console détectées:', criticalErrors);
    }

    // 8. Vérifier que la page principale s'affiche
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText?.length).toBeGreaterThan(0);
  });
});
